// Cloudflare Pages Function — POST /api/coupons  ("motor de crescimento PERSONALIZADO")
// The COUPONS + CAMPAIGNS backend the client (or their seller) drives from their own panel:
// quick-generate coupons, save/list/delete them, validate/redeem a code, and fire branded
// email campaigns that carry the CLIENT'S logo + accent + identity (Natura's, not Guileo's).
// Data lives behind db/coupons.sql (INGEST-gated SECURITY DEFINER RPCs). Brand comes from
// functions/lib/clientBrand.js; every email is rendered by a branded builder in
// functions/lib/emailTemplates.js (house rule: NEVER ad-hoc HTML email).
//
// PER-TENANT GATE — email + connection-key via get_client_data (identical to noshow-radar.js):
// a token can never touch another tenant's coupons/campaigns/customer PII. No OWNER_EMAIL fallback.
//
//   POST { token, email, action, ... }
//   Coupons:   list | upsert{coupon} | delete{id} | validate{code} | redeem{id,contact} | quickgen
//   Campaigns: campaign_list | campaign_upsert{campaign} | campaign_send{campaign_id | campaign}
import { json } from "../lib/guard.js";
import { brandFor, GUILEO_BRAND } from "../lib/clientBrand.js";
import * as tpl from "../lib/emailTemplates.js";
import { unsubUrl } from "../lib/unsub.js";
import { svcRpc, svcJson } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // ── PER-TENANT GATE (same proven bind noshow-radar / crm use) ──
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const secret = env.INGEST_SECRET || "";
    const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const action = (b.action || "list").toString();

    // ── QUICKGEN — ready-made coupon presets (NOT saved). One tap in the panel to seed a promo. ──
    if (action === "quickgen") {
      return json({ ok: true, presets: quickgenPresets() });
    }

    // ── COUPONS ──────────────────────────────────────────────────────────────
    if (action === "list") {
      const r = await rpc("coupon_list", { p_secret: secret, p_client_email: email, p_key: key });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/coupons.sql in Supabase to activate coupons.", coupons: [] });
      const coupons = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(coupons) ? coupons.length : 0, coupons });
    }

    if (action === "upsert") {
      const coupon = (b.coupon && typeof b.coupon === "object") ? b.coupon : null;
      if (!coupon || !String(coupon.code || "").trim()) return json({ error: "coupon.code required" }, 400);
      const r = await rpc("coupon_upsert", { p_secret: secret, p_client_email: email, p_coupon: coupon });
      if (!r.ok) return json({ ok: false, ready: false, note: "Paste db/coupons.sql in Supabase to activate coupons." });
      const id = await r.json().catch(() => null);
      return json({ ok: true, id });
    }

    if (action === "delete") {
      const id = (b.id || "").toString();
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid id" }, 400);
      // TENANT-BOUND (db/tenant_money_guardrails.sql): the SQL also matches client_email, so a
      // leaked UUID can never delete another tenant's coupon. 404 = guardrails not pasted yet →
      // fall back to the legacy id-only signature (same behavior as before).
      let r = await rpc("coupon_delete", { p_secret: secret, p_client_email: email, p_id: id });
      if (r.status === 404) r = await rpc("coupon_delete", { p_secret: secret, p_id: id });
      if (!r.ok) return json({ ok: false });
      const deleted = await r.json().catch(() => false);
      return json({ ok: true, deleted: deleted === true });
    }

    if (action === "validate") {
      const code = (b.code || "").toString().trim();
      if (!code) return json({ error: "code required" }, 400);
      const r = await rpc("coupon_validate", { p_secret: secret, p_client_email: email, p_code: code });
      if (!r.ok) return json({ ok: true, valid: false, note: "Paste db/coupons.sql in Supabase to activate coupons." });
      const res = await r.json().catch(() => ({ valid: false }));
      return json({ ok: true, ...(res || {}) });
    }

    if (action === "redeem") {
      const id = (b.id || "").toString();
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid id" }, 400);
      const contact = (b.contact || "").toString().slice(0, 160);
      // TENANT-BOUND redeem (db/tenant_money_guardrails.sql): the atomic increment also matches
      // client_email, so a leaked UUID can never burn another tenant's redemption cap. 404 =
      // guardrails not pasted yet → fall back to the legacy id-only signature (same as before).
      let r = await rpc("coupon_redeem", { p_secret: secret, p_client_email: email, p_id: id, p_contact: contact });
      if (r.status === 404) r = await rpc("coupon_redeem", { p_secret: secret, p_id: id, p_contact: contact });
      if (!r.ok) return json({ ok: false, note: "Paste db/coupons.sql in Supabase to activate coupons." });
      const res = await r.json().catch(() => ({ ok: false }));
      return json(res || { ok: false });
    }

    // ── CAMPAIGNS ────────────────────────────────────────────────────────────
    if (action === "campaign_list") {
      const r = await rpc("campaign_list", { p_secret: secret, p_client_email: email });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/coupons.sql in Supabase to activate campaigns.", campaigns: [] });
      const campaigns = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(campaigns) ? campaigns.length : 0, campaigns });
    }

    if (action === "campaign_upsert") {
      const campaign = (b.campaign && typeof b.campaign === "object") ? b.campaign : null;
      if (!campaign) return json({ error: "campaign required" }, 400);
      const r = await rpc("campaign_upsert", { p_secret: secret, p_client_email: email, p_campaign: campaign });
      if (!r.ok) return json({ ok: false, ready: false, note: "Paste db/coupons.sql in Supabase to activate campaigns." });
      const id = await r.json().catch(() => null);
      return json({ ok: true, id });
    }

    // ── CAMPAIGN SEND — resolve audience → render each client's BRANDED email → Resend → mark sent. ──
    if (action === "campaign_send") {
      // Accept either a saved campaign_id (loaded from campaign_list) or an inline campaign object.
      let campaign = (b.campaign && typeof b.campaign === "object") ? { ...b.campaign } : null;
      const campaignId = (b.campaign_id || (campaign && campaign.id) || "").toString();
      if (!campaign && campaignId) {
        const lr = await rpc("campaign_list", { p_secret: secret, p_client_email: email });
        const list = lr.ok ? ((await lr.json().catch(() => [])) || []) : [];
        campaign = (Array.isArray(list) ? list : []).find((c) => c && c.id === campaignId) || null;
      }
      if (!campaign) return json({ error: "campaign not found" }, 400);

      // MONEY/ABUSE GATE (adversarial review 2026-07-30) — a PAUSED (past-due) tenant must NOT blast
      // emails at Guileo's Resend cost. Fail-OPEN on a transient check error (never hard-block a
      // legit send on a flaky RPC), fail-CLOSED on an explicit paused=true.
      try {
        const pr = await rpc("is_client_paused", { p_secret: secret, p_email: email });
        if (pr.ok && (await pr.json().catch(() => false)) === true) {
          return json({ ok: false, paused: true, sent: 0, note: "Account paused — resolve billing to send campaigns." });
        }
      } catch { /* transient → fall through (best-effort, matches the codebase) */ }

      // Resolve the branded builder by name (promoEmail | couponEmail | newsEmail). Namespace import
      // keeps this file from crashing if the branded-email slice isn't deployed yet.
      const template = (campaign.template || campaign.kind || "promo").toString().toLowerCase();
      const builderName = template === "coupon" ? "couponEmail" : template === "news" ? "newsEmail" : "brandPromoEmail";
      const build = tpl[builderName];
      if (typeof build !== "function") {
        return json({ ok: true, ready: false, sent: 0, note: `Branded email builder ${builderName} not deployed yet (functions/lib/emailTemplates.js).` });
      }

      // The client's own identity (logo/accent/agent_name/business/lang) — Natura's, not Guileo's.
      const brand = await brandFor(env, email).catch(() => ({ ...GUILEO_BRAND }));

      // CAN-SPAM §7704(a)(5)(A)(iii) — todo e-mail de MARKETING precisa do endereço postal do
      // remetente. clientEmailShell já sabe imprimir `brand.address`, mas brandFor() nunca devolveu
      // esse campo → NENHUMA campanha jamais saiu com endereço. Buscamos da unidade ativa do tenant
      // (db/campanhas_canspam.sql). Sem endereço cadastrado NÃO mentimos: o envio segue, mas a
      // resposta devolve canspam_address:false pra o dono saber que precisa cadastrar a unidade.
      let addressOk = false;
      try {
        const addr = await svcJson(env, "client_postal_address", { p_secret: env.INGEST_SECRET || "", p_client_email: email });
        if (typeof addr === "string" && addr.trim()) { brand.address = addr.trim().slice(0, 200); addressOk = true; }
      } catch { /* leitura de endereço nunca derruba a campanha */ }

      // Attach the linked coupon (if any) so the email can print the code + terms.
      let coupon = null;
      const couponId = (campaign.coupon_id || "").toString();
      if (/^[0-9a-f-]{36}$/i.test(couponId)) {
        // BUG CORRIGIDO (auditoria A4, 2026-08-11): faltava p_key aqui. A RPC viva é
        // coupon_list(p_secret, p_client_email, p_key) — sem p_key o PostgREST devolve 404
        // (PGRST202), `coupons` virava [] e o cupom NUNCA era anexado: a campanha "Cupom"
        // saía com o texto do desconto e SEM o código. O cliente lia "seu presente" e não
        // tinha o que resgatar. Silencioso porque a leitura é best-effort.
        const cl = await rpc("coupon_list", { p_secret: secret, p_client_email: email, p_key: key });
        const coupons = cl.ok ? ((await cl.json().catch(() => [])) || []) : [];
        coupon = (Array.isArray(coupons) ? coupons : []).find((c) => c && c.id === couponId) || null;
      }

      // Resolve audience → recipient contacts (crm_contacts, else biz_appointments emails).
      // PÚBLICO CRUZADO (2026-10-05, slide 19): "cruzada:<unidade_de>:<unidade_para>" = quem veio à unidade DE e
      // nunca foi à PARA (desk_publico_cruzado_svc, só service_role; já tira os descadastrados). Leitura que falha
      // = ninguém (nunca "todo mundo").
      const seg = (campaign.audience || "all").toString();
      const cruz = /^cruzada:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(seg);
      let audience;
      if (cruz) {
        const pc = await svcJson(env, "desk_publico_cruzado_svc", { p_tenant: email, p_de: cruz[1], p_para: cruz[2], p_limit: 500 });
        audience = Array.isArray(pc) ? pc : [];
      } else {
        const ar = await rpc("campaign_audience", { p_secret: secret, p_client_email: email, p_segment: seg, p_limit: 500 });
        audience = ar.ok ? ((await ar.json().catch(() => [])) || []) : [];
      }
      // Dedup + cap the batch (best-effort broadcast, keep it sane).
      const seen = new Set();
      const recipients = [];
      for (const p of (Array.isArray(audience) ? audience : [])) {
        const to = String((p && p.email) || "").trim().toLowerCase();
        if (!isEmail(to) || seen.has(to)) continue;
        seen.add(to);
        recipients.push({ name: (p && p.name) || "", email: to });
        if (recipients.length >= 300) break;
      }

      // CAN-SPAM — tira quem se descadastrou do marketing DESTE negócio. FAIL-CLOSED (2026-10-01):
      // antes, se a lista não pudesse ser lida, a campanha saía para todo mundo ("raro"). Raro e
      // caro: mandar promoção a quem pediu para sair é a única falha aqui que não tem conserto.
      // Lista não lida → a campanha não sai, e a tela diz por quê; o dono tenta de novo.
      let supLida = false;
      try {
        const supR = await svcRpc(env, "email_suppressed_list", { p_secret: env.INGEST_SECRET || "", p_client_email: email });
        if (supR.ok) {
          const raw = await supR.json().catch(() => null);
          if (Array.isArray(raw)) {
            supLida = true;
            const sup = new Set(raw.map((x) => String(x).toLowerCase()));
            if (sup.size) for (let i = recipients.length - 1; i >= 0; i--) if (sup.has(recipients[i].email)) recipients.splice(i, 1);
          }
        }
      } catch { /* supLida fica false → a campanha não sai */ }
      if (!supLida) return json({ ok: false, sent: 0, reason: "unsubscribe_list_unavailable", note: "Could not read the unsubscribe list, so nothing was sent. Please try again in a moment." }, 503);

      // PER-RECIPIENT IDEMPOTENCY (adversarial review 2026-07-30) — for a SAVED campaign, drop anyone
      // this campaign already emailed, so a re-send / partial-retry NEVER double-emails or double-charges.
      // Inline campaigns (no id) can't be keyed → one-shot, no dedup (rare path). Best-effort read.
      if (campaignId) {
        try {
          const sr = await svcRpc(env, "campaign_recipients_sent", { p_secret: env.INGEST_SECRET || "", p_campaign_id: campaignId });
          if (sr.ok) {
            const raw = await sr.json().catch(() => []);
            const already = new Set((Array.isArray(raw) ? raw : []).map((x) => String(x).toLowerCase()));
            if (already.size) for (let i = recipients.length - 1; i >= 0; i--) if (already.has(recipients[i].email)) recipients.splice(i, 1);
          }
        } catch { /* idempotency read failed → proceed (chunked send keeps dupes rare) */ }
      }

      if (!env.RESEND_API_KEY) return json({ ok: false, sent: 0, note: "RESEND_API_KEY not configured." });

      const from = `${(brand.business || "Guileo").replace(/[<>]/g, "")} <${(env.EMAIL_FROM_ADDR || "noreply@guileoai.com")}>`;
      // Render + send ONE branded email (best-effort → returns the email on Resend 2xx, else "").
      const sendOne = async (rcp) => {
        // Per-recipient one-click unsubscribe URL (HMAC token, tamper-proof) → into the footer + headers.
        const uUrl = await unsubUrl(env, "https://guileoai.com", email, rcp.email);
        const built = build({
          brand, name: rcp.name || "there", business: brand.business, lang: brand.lang,
          subject: campaign.subject || "", headline: campaign.headline || campaign.subject || "",
          title: campaign.subject || campaign.headline || "", message: campaign.body || "",
          body: campaign.body || "", coupon, unsubscribeUrl: uUrl,
        }) || {};
        const subject = (campaign.subject && campaign.subject.trim()) || built.subject || "";
        const html = built.html || "";
        if (!html) return "";
        try {
          const sr = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            // RFC 8058 one-click unsubscribe headers → Gmail/Apple show a native "Unsubscribe" button.
            body: JSON.stringify({ from, to: [rcp.email], subject, html, headers: { "List-Unsubscribe": `<${uUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
          });
          return sr.ok ? rcp.email : "";
        } catch { return ""; }
      };
      // Send in parallel CHUNKS: 300 sequential fetches (~45s) risked a Pages Functions wall-time /
      // subrequest timeout MID-LOOP. Chunking cuts wall-time ~10×.
      //
      // ⚠️ DINHEIRO — o que mudou aqui (auditoria A4, 2026-08-11):
      //   ANTES: (a) o livro de destinatários só era gravado DEPOIS do último chunk e (b) o ref de
      //   cobrança era `camp:<id>:<Date.now()>:<n>`. Um timeout no meio do laço (o exato risco que
      //   motivou o chunking) deixava ZERO destinatários gravados → o retry reenviava TUDO e, como o
      //   ref carregava o relógio, o crédito era debitado DE NOVO. E-mail duplicado + débito duplo.
      //   Isso contraria a lei de dinheiro do ARQUITETURA.md: "dedupe key de retry deriva do BODY,
      //   nunca de timestamp".
      //   AGORA: cada chunk (1) grava quem recebeu ANTES de cobrar e (2) cobra com um ref derivado do
      //   CONTEÚDO (hash dos e-mails realmente entregues). Retry do mesmo conjunto = mesmo ref =
      //   deduct_client_credits reconhece e não cobra. Conjunto novo = ref novo = cobra. Os dois
      //   requisitos ("ref único por envio" e "idempotente por ref") deixam de ser contraditórios
      //   quando o ref é função do QUE saiu, e não de QUANDO saiu.
      const sentEmails = [];
      let naoCobrados = 0;   // e-mails que saíram e o banco não confirmou a cobrança
      const CHUNK = 10;
      for (let i = 0; i < recipients.length; i += CHUNK) {
        const results = await Promise.all(recipients.slice(i, i + CHUNK).map(sendOne));
        const got = results.filter(Boolean);
        if (!got.length) continue;
        sentEmails.push(...got);
        // 1) LIVRO PRIMEIRO — quem recebeu fica gravado agora, não no fim. Um timeout no próximo
        //    chunk não pode mais fazer o retry reenviar quem já recebeu.
        if (campaignId) {
          try { await svcRpc(env, "campaign_recipients_mark", { p_secret: env.INGEST_SECRET || "", p_campaign_id: campaignId, p_emails: got }); } catch { /* best-effort */ }
        }
        // 2) COBRANÇA com ref derivado do conteúdo entregue (nunca do relógio).
        const meterRef = `camp:${(campaignId || "inline").toString().slice(0, 40)}:${await refDoLote(got)}`;
        // CHECAR O RETORNO. `rpc` devolve a Response, e **fetch não lança em erro HTTP** — o
        // try/catch anterior não pegava nada: um 500 do banco significava 300 e-mails enviados, a
        // Guileo sem cobrar, e ZERO registro de que isso aconteceu. É a lição que esta casa já
        // pagou duas vezes ("checar retorno de envio"). Não interrompe o envio (o e-mail já saiu,
        // reverter é impossível) — mas a falha volta na resposta e vira número visível.
        try {
          const dr = await rpc("deduct_client_credits", { p_secret: secret, p_email: email, p_credits: got.length, p_reason: "email-campaign", p_ref: meterRef });
          if (!dr || !dr.ok) naoCobrados += got.length;
        } catch { naoCobrados += got.length; }
      }
      const sent = sentEmails.length;

      // Mark the campaign sent (tenant-bound; db/campanhas_canspam.sql ACUMULA o total em vez de
      // sobrescrever — um retry parcial não pode apagar o que já tinha sido enviado). 404 = SQL nova
      // ainda não aplicada → cai na assinatura antiga (id-only), mesmo comportamento de antes.
      if (campaignId && /^[0-9a-f-]{36}$/i.test(campaignId) && sent > 0) {
        let mr = await rpc("campaign_mark_sent", { p_secret: secret, p_client_email: email, p_id: campaignId, p_count: sent }).catch(() => ({ status: 0, ok: false }));
        if (mr && mr.status === 404) await rpc("campaign_mark_sent", { p_secret: secret, p_id: campaignId, p_count: sent }).catch(() => {});
      }

      return json({
        ok: true, ready: true, audience: recipients.length, sent, credits_spent: sent - naoCobrados,
        canspam_address: addressOk,
        // A cobrança que o banco NÃO confirmou aparece. Silêncio aqui = a Guileo trabalha de graça
        // sem saber; e "credits_spent" tem que ser o que foi cobrado, não o que foi enviado.
        ...(naoCobrados ? { nao_cobrados: naoCobrados, alerta_cobranca: `${naoCobrados} e-mail(s) saíram mas o banco não confirmou a cobrança — verifique o saldo/ledger deste cliente.` } : {}),
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}

// REF DE COBRANÇA DERIVADO DO CONTEÚDO — hash estável do conjunto de e-mails REALMENTE entregues
// num lote. Ordenado antes do hash para que a mesma gente, em qualquer ordem, dê o mesmo ref: é
// isso que faz um retry ser reconhecido como repetição em vez de virar cobrança nova.
async function refDoLote(emails) {
  const chave = [...emails].map((e) => String(e).toLowerCase()).sort().join(",");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chave));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Deterministic-per-request short code (no Math.random at module scope; fine inside the handler).
function makeCode(prefix) {
  const base = (Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}${base.slice(-5)}`;
}

// Ready-made coupon presets (label/kind/value/terms + a generated CODE) — NOT persisted.
// The panel shows these as one-tap "quick generate" buttons; saving calls action:"upsert".
function quickgenPresets() {
  return [
    { kind: "bogo",    value: null, label: "BOGO — Compre 1, Leve 2",        terms: "Válido em itens selecionados. Não acumula com outras promoções.", code: makeCode("BOGO") },
    { kind: "bogo",    value: null, label: "Buy 1 Get 1 Free",               terms: "On selected items. Cannot be combined with other offers.",        code: makeCode("B1G1") },
    { kind: "bogo",    value: null, label: "Aniversário 1+1",                terms: "No mês do seu aniversário. Um por cliente.",                       code: makeCode("BDAY") },
    { kind: "percent", value: 20,   label: "20% OFF",                        terms: "Desconto de 20% no total. Por tempo limitado.",                    code: makeCode("OFF20") },
    { kind: "percent", value: 10,   label: "10% OFF primeira visita",        terms: "Somente novos clientes, na primeira visita.",                      code: makeCode("NEW10") },
    { kind: "amount",  value: 25,   label: "$25 OFF",                        terms: "Desconto de $25 em compras acima de $100.",                        code: makeCode("SAVE25") },
    { kind: "freebie", value: null, label: "Amigo indica amigo",             terms: "Indique um amigo e ambos ganham um mimo na próxima visita.",       code: makeCode("REF") },
  ];
}
