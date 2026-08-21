// Cloudflare Pages Function — POST /api/contract  (COMPANY OS · ADMIN/LEGAL: contracts & quotes)
// Admin/portal actions (list, upsert) are gated by the same blitz_stats token as the other ops
// endpoints. The signer path (by_token, sign) needs NO login — the per-doc sign_token is the
// capability. Gracefully reports ready:false until db/contracts.sql is pasted.
import { json, rateLimited, safeEq } from "../lib/guard.js";
// a venda tem que voltar para quem a fez: assinatura avisa o vendedor e o dono.
import { emitFailure } from "../lib/failure.js";
import { svcJson } from "../lib/sb.js";
import { ownerAlertEmail } from "../lib/emailTemplates.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (espelha /api/seller-prospects: roster do banco → roster do env / código do time) ──
// POR QUE EXISTE: o gerador de contrato do vendedor (SellerContract.jsx) precisava GRAVAR, e o único
// portão daqui era o `blitz_stats` de admin — que o vendedor não tem. Sem isto o contrato morria na
// tela. O e-mail AUTENTICADO é o único escopo usado; o e-mail do corpo é ignorado de propósito.
const BOOTSTRAP = [
  { email: "luistelesc@gmail.com", code: "GUILEO-DONO", name: "Luis Teles", ref: "luis" },
  { email: "smart@guileoai.com", code: "GUILEO-DONO", name: "Guileo", ref: "guileo" },
];
const TEAM_CODE_DEFAULT = "GUILEO-TIME-2026";
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
function roster(env) {
  try { if (env && env.SELLER_ROSTER) { const arr = JSON.parse(env.SELLER_ROSTER); if (Array.isArray(arr) && arr.length) return arr; } } catch { /* fall back */ }
  return BOOTSTRAP;
}
function sellerAuthEnv(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!e || !c) return null;
  const match = roster(env).find((s) => (s.email || "").trim().toLowerCase() === e && safeEq(String(s.code || ""), c));
  if (match) return { email: e, name: match.name || e.split("@")[0], ref: (match.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  const teamCode = (env && env.TEAM_INVITE_CODE) || TEAM_CODE_DEFAULT;
  if (safeEq(c, teamCode)) return { email: e, name: e.split("@")[0], ref: slug(e.split("@")[0]) || "team", roster: false };
  return null;
}
async function sellerAuthDB(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  const ING = env && env.INGEST_SECRET;
  if (!e || !c || !ING) return null;
  try {
    const r = await rpc("seller_auth_check", { p_secret: ING, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return null;
    return { email: e, name: d.name || e.split("@")[0], ref: (d.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}
async function sellerAuthFull(env, email, code) {
  return (await sellerAuthDB(env, email, code)) || sellerAuthEnv(env, email, code);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "contract", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "list").toString();
    const secret = env.SCHED_SECRET || "";

    // ── PUBLIC (capability token) — the counterparty signs without any login ──
    if (action === "by_token") {
      const r = await rpc("contract_by_token", { p_token: (b.sign_token || "").toString() });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/contracts.sql to activate contracts.", doc: null });
      const rows = (await r.json()) || [];
      return json({ ok: true, ready: true, doc: rows[0] || null });
    }
    if (action === "sign") {
      const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
      // `contrato_assinar` devolve o RECIBO (dono, cliente, valor), não só um booleano — é ele
      // que permite avisar as pessoas certas sem uma segunda leitura no instante da venda.
      const r = await rpc("contrato_assinar", { p_token: (b.sign_token || "").toString(), p_signer_name: (b.signer_name || "").toString(), p_ip: ip.split(",")[0].trim() });
      // ⚠️ A RECUSA PRECISA TER MOTIVO E STATUS (2026-08-17). Antes, banco fora do ar devolvia
      // {ok:false,signed:false} com HTTP 200 — indistinguível de "token inválido" — e a página
      // reagia igual aos dois: voltava o botão ao normal e não dizia nada. No instante da
      // ASSINATURA, que é onde o dinheiro entra. Agora o motivo viaja e a tela fala.
      if (!r.ok) return json({ ok: false, signed: false, motivo: "indisponivel" }, 502);
      const rec = await r.json().catch(() => null);
      if (!rec || rec.ok !== true) return json({ ok: true, signed: false, motivo: rec?.motivo || "link_invalido_ou_ja_assinado" });

      // ── A VENDA VOLTA PARA QUEM A FEZ (2026-08-21) ────────────────────────────────────────
      // Antes daqui, assinar era um carimbo mudo no banco. Agora o vendedor dono do contrato e o
      // dono da empresa recebem a notícia no minuto em que ela acontece — porque contrato assinado
      // que ninguém vê é ativação que não começa, e cliente que assinou e ficou esperando é o
      // primeiro cliente a pedir reembolso.
      // Best-effort DEPOIS de a assinatura já estar gravada: falha de e-mail não pode desfazer,
      // nem esconder, uma assinatura que o banco já aceitou.
      // ── ASSINOU → O RASCUNHO DE ATIVAÇÃO JÁ NASCE ────────────────────────────────────────
      // Antes daqui o funil parava: alguém tinha que REDIGITAR no /admin o nome, o e-mail e o
      // plano que o contrato já continha. Entre assinar e o agente nascer havia uma pessoa
      // lembrando de fazer uma coisa — e é aí que o cliente novo fica esperando.
      // 🚨 RASCUNHO, NUNCA ATIVAÇÃO. Ativar cria agente, compra número e credita: dinheiro e
      // recursos externos, que continuam exigindo o clique humano. Automatizamos a transcrição,
      // não a decisão.
      let rascunho = null;
      try {
        // 🚨 CHAVE DE SERVIÇO, NÃO `anon`. `rascunho_do_contrato` é REVOGADA do anon de propósito
        // (ela escreve na fila de ativação). O helper `rpc` deste arquivo fala como anon — chamar
        // por ele devolvia 401 silencioso e o rascunho simplesmente não nascia, com a assinatura
        // dizendo "ok". Foi exatamente o que o primeiro teste mostrou: `rascunho: null`.
        rascunho = await svcJson(env, "rascunho_do_contrato", { p_secret: env.INGEST_SECRET || "", p_contrato: rec.id });
      } catch { /* o rascunho é conveniência; a assinatura já está gravada */ }

      try {
        await emitFailure(env, "contrato_assinado", rec.dono || "",
          `✍️ ${rec.cliente || "cliente"} assinou "${rec.titulo || ""}" — US$ ${rec.valor} · assinado por ${rec.assinante}`,
          { contrato: rec.id, valor: rec.valor }).catch(() => {});
        if (env.RESEND_API_KEY) {
          const dono = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim();
          // o VENDEDOR primeiro (é a venda dele), o dono da empresa em cópia — sem duplicar quando
          // são a mesma pessoa.
          const para = [...new Set([rec.dono, dono].filter((x) => x && String(x).includes("@")))];
          const tpl = ownerAlertEmail({
            kind: "sale", business: rec.cliente || "", customer: rec.assinante || "",
            amount: `US$ ${rec.valor}`, when: rec.quando || new Date().toISOString(), lang: "pt",
            // a frase muda conforme o rascunho existir: mandar "vá criar" quando já está criado
            // faz a pessoa procurar o que já está pronto — e desconfiar do aviso da próxima vez.
            details: `${rec.cliente} assinou "${rec.titulo}". ${rascunho?.ok
              ? (rascunho.ja_existia ? "O rascunho de ativação já estava no /admin — é só conferir e ativar."
                                     : "O rascunho de ativação JÁ FOI CRIADO no /admin: confira e aperte ativar.")
              : (rascunho?.motivo === "ja_e_cliente" ? "Este e-mail já é cliente — nada a ativar."
                                                     : "Próximo passo: cadastrar e ativar o cliente no /admin.")}`,
          });
          const mr = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: para,
              subject: `✍️ Contrato assinado — ${rec.cliente} · US$ ${rec.valor}`, html: tpl.html }),
          });
          if (!mr.ok) await emitFailure(env, "aviso_assinatura_nao_saiu", rec.dono || "", `o aviso de contrato assinado NÃO saiu (HTTP ${mr.status})`, { contrato: rec.id }).catch(() => {});
        }
      } catch { /* a assinatura já está gravada; o aviso é um extra que nunca a desfaz */ }

      return json({ ok: true, signed: true, motivo: null, rascunho: rascunho?.ok ? { id: rascunho.id, ja_existia: !!rascunho.ja_existia } : null });
    }

    // ── PORTÃO: VENDEDOR ou ADMIN ────────────────────────────────────────────────────────────────
    // 1) vendedor logado (seller_email + seller_code) → o tenant é o E-MAIL DELE, sempre. Nunca o
    //    e-mail do corpo: um vendedor jamais lê/escreve o contrato de outro.
    // 2) admin/portal → o mesmo token blitz de /api/crm.
    let email = "";
    if (b.seller_email || b.seller_code) {
      const seller = await sellerAuthFull(env, b.seller_email, b.seller_code);
      if (!seller) return json({ error: "unauthorized", motivo: "login_vendedor" }, 401);
      // O código de time (roster:false) aceita qualquer e-mail digitado → não pode virar dono de
      // contrato. Contrato exige código PESSOAL, como o CRM de prospects.
      if (!seller.roster) return json({ error: "team_code", motivo: "peca_o_codigo_pessoal" }, 401);
      email = seller.email;
    } else {
      const vr = await rpc("blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
      if (!vr.ok) return json({ error: "unauthorized" }, 401);
      // require a real email — no OWNER_EMAIL fallback (a blank email must never default to the
      // owner's contracts). Dual-path per-tenant binding for `list` is tracked in docs/GO-LIVE.md.
      email = (b.email || "").toString().trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "unauthorized" }, 401);
    }

    if (action === "upsert") {
      const r = await rpc("contract_upsert", {
        p_secret: secret, p_email: email, p_id: b.id || null, p_kind: b.kind || "contract", p_scope: b.scope || "guileo_client",
        p_template: b.template || null, p_lang: b.lang || "pt", p_title: b.title || null, p_counterparty_name: b.counterparty_name || null,
        p_counterparty_email: b.counterparty_email || null, p_amount_cents: parseInt(b.amount_cents, 10) || 0, p_body: b.body || {}, p_status: b.status || "draft", p_contact_id: b.contact_id || null,
      });
      if (!r.ok) {
        const cru = await r.text().catch(() => "");
        return json({ ok: false, ready: false, erro: "contract_upsert recusou", cru: cru.slice(0, 300) }, 502);
      }
      const id = await r.json().catch(() => null);
      // 🚨 COMPROVANTE: sem id não houve gravação. Devolver ok:true aqui é o que faz a tela dizer
      // "salvo" sobre um banco vazio — a falha exata que este repo já teve. 200 sem id vira 502.
      if (typeof id !== "string" || id.length < 10) return json({ ok: false, erro: "contract_upsert não devolveu id", cru: String(id).slice(0, 120) }, 502);
      return json({ ok: true, ready: true, id });
    }

    // ── QUAL CAMPANHA VIROU ASSINATURA (2026-08-17) ─────────────────────────────────────────────
    // Fecha o ciclo do dinheiro: sem isto o motor de anúncio otimiza por LEAD, que é métrica de meio
    // de funil. Duas campanhas com o mesmo custo por lead podem fechar em taxas 5× diferentes — e o
    // reinvestimento escolhe a errada com dado verdadeiro na mão.
    // ⚠️ NÃO usa `|| {}` no retorno: relatório ausente é ERRO, não "nenhuma venda". Um zero
    // inventado aqui vira decisão de cortar a campanha que estava vendendo.
    if (action === "performance") {
      const r = await rpc("contract_performance", { p_secret: secret, p_email: email, p_days: Math.min(Math.max(parseInt(b.days, 10) || 90, 1), 730) });
      if (!r.ok) return json({ ok: true, ready: false, note: "Cole db/contract_performance.sql para ativar o relatório por campanha." });
      const rel = await r.json().catch(() => null);
      if (!rel || typeof rel !== "object") return json({ ok: false, erro: "contract_performance não devolveu objeto" }, 502);
      return json({ ok: true, ready: true, relatorio: rel });
    }

    // default: list
    const r = await rpc("contract_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 1000) });
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/contracts.sql to activate contracts.", docs: [] });
    const docs = (await r.json()) || [];
    return json({ ok: true, ready: true, count: docs.length, docs });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
