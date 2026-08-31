// Cloudflare Pages Function — POST /api/broto
// BROTO = our internal support/ops console (the team behind Gui). Gated by the ADMIN
// password (verified server-side via admin_site_stats), then it reaches the support +
// inventory RPCs with the server-side SCHED_SECRET. Surfaces the whole ticket queue
// across every tenant, our platform inventory (numbers/hardware/accounts), and health.
import { json, rateLimited, sameOrigin } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { supportRepliedEmail } from "../lib/emailTemplates.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Avisa o CLIENTE que o chamado dele foi respondido. Best-effort: nunca derruba a resposta.
// Cópia consciente do `avisaCliente` de support-hub.js (dono único por arquivo; o gêmeo está
// anotado nos dois lados). Assunto e idioma vêm do template único em emailTemplates.js.
async function avisaCliente(env, ticketId, replyText) {
  try {
    if (!env.RESEND_API_KEY || !env.SCHED_SECRET) return false;
    const lr = await svcRpc(env, "support_ticket_list", { p_secret: env.SCHED_SECRET, p_email: "", p_limit: 1000 });
    if (!lr.ok) return false;
    const lista = (await lr.json().catch(() => [])) || [];
    const t = (Array.isArray(lista) ? lista : []).find((x) => String(x.id) === String(ticketId));
    const to = ((t && t.client_email) || "").toString().trim().toLowerCase();
    if (!to.includes("@")) return false;
    let lang = "pt", name = "";
    try {
      const pr = await svcRpc(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: to });
      if (pr.ok) {
        const p = await pr.json().catch(() => null);
        if (p && typeof p === "object") {
          lang = ["pt", "es", "en", "hi"].includes(p.lang) ? p.lang : "pt";
          name = (p.owner || p.business_name || "").toString().slice(0, 80);
        }
      }
    } catch { /* defaults */ }
    const { subject, html } = supportRepliedEmail({
      name, lang, ticketSubject: (t && t.subject) || "", replyPreview: String(replyText || "").slice(0, 400),
    });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
    });
    // Checar o retorno do envio — "avisado" sem olhar a resposta da Resend é promessa sem lastro.
    if (!r.ok) { console.error(JSON.stringify({ aviso_chamado: ticketId, resend: r.status })); return false; }
    return true;
  } catch (e) { console.error(JSON.stringify({ aviso_chamado: ticketId, erro: String(e).slice(0, 120) })); return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // slow brute-force on the admin password (the gate below verifies it server-side)
    if (await rateLimited(request, env, "broto", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const token = (b.token || "").toString();
    const action = (b.action || "data").toString();
    const secret = env.SCHED_SECRET || "";

    // GATE: verify the admin password the same way /admin does. admin_site_stats raises on a
    // wrong token (→ non-200), so a clean 200 means this caller is our team.
    const gate = await rpc("admin_site_stats", { p_token: token });
    if (!gate.ok) return json({ error: "unauthorized" }, 401);

    if (action === "ticket_set") {
      const r = await rpc("support_ticket_set", { p_secret: secret, p_id: b.id, p_status: b.status || null, p_resolution: b.resolution || null, p_assigned: b.assigned || null });
      const okv = r.ok ? await r.json().catch(() => false) : false; // parse the RPC bool, not the HTTP status
      return json({ ok: okv === true });
    }
    if (action === "ticket_reply") {
      const r = await rpc("support_ticket_reply", { p_secret: secret, p_id: b.id, p_role: b.role || "human", p_text: b.text || "" });
      const okv = r.ok ? await r.json().catch(() => false) : false;
      // O CLIENTE PRECISA SABER QUE RESPONDEMOS (2026-08-25). Antes, a resposta do BROTO ficava
      // esperando ele lembrar de abrir o portal — atendimento rápido que o cliente sente como
      // demora. Só sai quando a gravação foi confirmada pelo BOOLEANO da RPC (não pelo 200 do
      // HTTP): avisar sobre uma resposta que não entrou na thread é pior que não avisar.
      // ⚠️ GÊMEO em support-hub.js (`avisaCliente`) — mexeu num, mexa no outro no mesmo commit.
      const avisado = okv === true ? await avisaCliente(env, b.id, b.text || "") : false;
      return json({ ok: okv === true, avisado });
    }
    if (action === "inv_upsert") {
      const r = await rpc("inventory_upsert", { p_secret: secret, p_id: b.id || null, p_kind: b.kind || "number", p_label: b.label || "", p_status: b.status || "available", p_assigned: b.assigned || null, p_meta: b.meta || {} });
      return json({ ok: r.ok, id: r.ok ? await r.json() : null });
    }

    // ACTIVATIONS: the live state of each external money-engine key. Returns ONLY presence
    // (a boolean per env var) — never the secret value. Lets BROTO show the true "ligada/apagada"
    // instead of a manual checkbox. Keys with detect:false are provider-side registrations
    // (e.g. A2P 10DLC lives in the Twilio console, not an env var) → the panel marks them "manual".
    if (action === "activations") {
      const has = (k) => !!(env[k] && String(env[k]).trim());
      const req = (arr) => arr.every(has);        // all required vars present
      // 🚨 REVISOR 2026-08-25: o dunning migrou pra platform_settings (o /admin edita, o sweep
      // obedece) e este card continuava lendo SÓ a env — o Luis ligava a cobrança no /admin e o
      // BROTO mostrava a chave apagada. Duas verdades na mesma plataforma é o defeito que a onda
      // inteira combate. Banco primeiro, env de reserva; falha de leitura degrada pra env.
      let cfgCobranca = {};
      try {
        const cr = await svcRpc(env, "platform_settings_get", { p_secret: env.INGEST_SECRET || "" });
        if (cr && cr.ok) { const j = await cr.json().catch(() => null); if (j && typeof j === "object" && !Array.isArray(j)) cfgCobranca = j; }
      } catch { /* env manda */ }
      const dunningLigado = String(cfgCobranca.dunning_enforce ?? env.DUNNING_ENFORCE ?? "") === "1";
      // REAL Stripe Connect status — GET /v1/accounts succeeds ONLY on a Connect-enabled platform.
      // "off" = key works but Connect not enabled (Stripe says so); "unknown" = no key / network hiccup.
      let stripeConnect = "unknown";
      if (has("STRIPE_SECRET_KEY")) {
        try {
          const sr = await fetch("https://api.stripe.com/v1/accounts?limit=1", { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
          if (sr.ok) stripeConnect = "on";
          else { const e = await sr.json().catch(() => ({})); stripeConnect = /connect/i.test(e?.error?.message || "") ? "off" : "unknown"; }
        } catch { stripeConnect = "unknown"; }
      }
      // ── A2P 10DLC: estado REAL da campanha na Twilio (2026-08-24) ──────────────────────────
      // Este card mostrava "⚪ Registro do provedor" — um encolher de ombros que escondia o fato
      // de que a campanha foi REPROVADA (erro 30909, CTA não verificável). Card que não distingue
      // "ainda não registrei" de "registraram e recusaram" deixa o canal mudo sem ninguém saber,
      // exatamente como o WhatsApp verde com token vencido. Pergunta-se à Twilio, não ao ambiente.
      let a2p = { detect: false, ready: null, nota: "" };
      if (has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN")) {
        try {
          const auth = "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
          const sr = await fetch("https://messaging.twilio.com/v1/Services", { headers: { Authorization: auth } });
          // ⚠️ PORTÃO DE STATUS ANTES DO FALLBACK. Sem ele um 401/429 da Twilio virava `{}` →
          // `services: []` → "nenhum A2P" — e o painel diria "não registrado" quando a verdade é
          // "não consegui perguntar". É o mesmo engano do WhatsApp verde com token vencido, que
          // esta própria função existe para não repetir.
          if (!sr.ok) {
            a2p = { detect: false, ready: null, nota: `não deu para ler a Twilio (HTTP ${sr.status}) — isto NÃO é "sem A2P"` };
            throw new Error("twilio_indisponivel");
          }
          const sd = await sr.json().catch(() => ({}));
          const svcs = (sd && sd.services) || [];
          let algumAprovado = false, falha = "";
          for (const sv of svcs.slice(0, 5)) {
            const cr = await fetch(`https://messaging.twilio.com/v1/Services/${sv.sid}/Compliance/Usa2p`, { headers: { Authorization: auth } });
            // Mesmo portão: campanha ilegível é "não sei", nunca "não tem".
            if (!cr.ok) { if (!falha) falha = `campanha ilegível (HTTP ${cr.status})`; continue; }
            const cd = await cr.json().catch(() => ({}));
            for (const it of (cd?.compliance || cd?.us_app_to_person || [])) {
              const st = String(it.campaign_status || "").toUpperCase();
              if (st === "VERIFIED" || st === "APPROVED") algumAprovado = true;
              else if (st === "FAILED" && !falha) {
                const m = (it.errors && it.errors[0] && it.errors[0].description) || "campanha reprovada";
                falha = String(m).slice(0, 140);
              }
            }
          }
          if (algumAprovado) a2p = { detect: true, ready: true, nota: "" };
          else if (falha) a2p = { detect: true, ready: false, nota: `campanha REPROVADA — ${falha}` };
          // sem campanha nenhuma: continua ⚪, porque "não registrei ainda" não é falha.
        } catch { /* rede: mantém ⚪ em vez de acusar falha que não medimos */ }
      }

      // ── CUSTO DE VOZ: o ledger é a prova, não a env var ───────────────────────────────────────
      // A TARIFA é digitada à mão de propósito: a ElevenLabs não expõe US$/minuto. O
      // GET /v1/user/subscription devolve character_count/character_limit — CARACTERES, não
      // minutos nem dólares — então converter caractere em tarifa seria inventar número.
      // Por isso a sonda não pergunta "a var existe?" e sim "ligação real virou custo?":
      // 'elevenlabs' em providers_wired significa que recordVoiceCost gravou cost_event de verdade.
      // Var setada + ZERO evento gravado é o caso perigoso — margem parece real e é piso.
      // Três estados: ready:null (⚪) quando não deu para ler o ledger, nunca "não está pronto".
      let voicecost = { detect: false, ready: null, nota: "não deu para ler o ledger de custo — isto NÃO é \"sem custo de voz\"" };
      try {
        const desde = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
        const cs = await svcRpc(env, "cost_summary_all", { p_secret: env.INGEST_SECRET || "", p_since: desde });
        if (cs && cs.ok) {
          const j = await cs.json().catch(() => null);
          if (j && j.ready === true) {
            const wired = Array.isArray(j.providers_wired) ? j.providers_wired : [];
            voicecost = wired.includes("elevenlabs")
              ? { detect: true, ready: true, nota: "" }
              : { detect: true, ready: false, nota: has("VOICE_COST_CENTS_PER_MIN")
                  ? "tarifa setada mas NENHUM custo de voz gravado neste mês — a margem é piso, não real"
                  : "sem VOICE_COST_CENTS_PER_MIN: nenhuma ligação vira custo, margem fica parcial" };
          }
        }
      } catch { /* rede: mantém ⚪ em vez de acusar falha que não medimos */ }

      // ── OS 3 CANAIS POR TENANT: quem conectou está no BANCO, não na env var ───────────────────
      // META_APP_ID, GOOGLE_BUSINESS_CLIENT_ID e MINDBODY_API_KEY são credenciais DO APP: provam
      // que a Guileo PODE integrar, jamais que alguém integrou. Quem faz o canal funcionar é o
      // token do TENANT em client_integrations — foi um token vencido de cliente que deixou o
      // WhatsApp mudo por TRÊS SEMANAS com este card verde (03/08). Mesmo padrão já usado em
      // prontidao.js para a Google Agenda: conta quem conectou de verdade, e sem leitura devolve
      // ⚪ (ready:null), nunca "não está pronto" — erro de leitura não é ausência de cliente.
      const conectados = async (provider) => {
        try {
          const r = await svcRpc(env, "client_integrations_count", { p_secret: env.INGEST_SECRET || "", p_provider: provider });
          if (!r || !r.ok) return null;
          const n = await r.json().catch(() => null);
          return typeof n === "number" ? n : null;
        } catch { return null; }
      };
      const [nWhats, nGbp, nMb] = await Promise.all([
        conectados("whatsapp_cloud"), conectados("google_business"), conectados("mindbody"),
      ]);
      // Dois motivos DIFERENTES para não estar ligado, e o dono clica em lugares diferentes:
      // falta a chave do app (é com ele) vs app pronto e ninguém conectou (é com o cliente).
      const canal = (n, appOk, faltaApp, semNinguem, vivoNota) =>
        !appOk ? { detect: true, ready: false, nota: faltaApp }
        : n === null ? { detect: false, ready: null, nota: "não deu para ler quem conectou — isto NÃO é \"ninguém conectado\"" }
        : n > 0 ? { detect: true, ready: true, nota: `${n} conectado(s)${vivoNota || ""}` }
        : { detect: true, ready: false, nota: semNinguem };

      const eWhats = canal(nWhats, req(["META_APP_ID", "META_APP_SECRET", "META_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"]),
        "faltam chaves do app Meta", "app Meta pronto, nenhum cliente conectou o WhatsApp ainda",
        // CONTAR NÃO É PROVAR QUE O TOKEN ESTÁ VIVO. O veredito ao vivo vem do Graph, token por
        // token, em /api/whatsapp-connect (auditar) — que o card do /admin já prefere.
        "");   // o veredito de token vivo é do audit; o selo aqui conta conexões, não vidas.
      const eGbp = canal(nGbp, req(["GOOGLE_BUSINESS_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_SECRET"]),
        "faltam chaves do app Google", "app Google pronto, nenhum cliente conectou o perfil ainda");
      const eMb = canal(nMb, has("MINDBODY_API_KEY"),
        "sem MINDBODY_API_KEY (exige aprovação de parceiro na MindBody)", "chave de parceiro ok, nenhum estúdio conectou ainda");

      // ── MERCADO PAGO: posse do token não é validade ───────────────────────────────────────────
      // O /api/pix já confere TODO token de tenant contra GET /users/me antes de guardar, porque
      // guardar token quebrado faz o dono ver "conectado ✅" e só descobrir na venda que não
      // cobrou. O token da PLATAFORMA nunca passou por essa mesma régua. Agora passa — e o selo
      // diz de QUAL conta MP ele é: token que responde pela conta errada cobra na conta errada.
      let eMp = { detect: true, ready: false, nota: "falta MP_ACCESS_TOKEN (ou MERCADOPAGO_TOKEN)" };
      const mpTok = (env.MP_ACCESS_TOKEN || env.MERCADOPAGO_TOKEN || "").toString().trim();
      if (mpTok) {
        let viva = null, quem = "";
        try {
          const r = await fetch("https://api.mercadopago.com/users/me", {
            headers: { Authorization: `Bearer ${mpTok}` }, signal: AbortSignal.timeout(6000),
          });
          if (r.ok) {
            const me = await r.json().catch(() => ({}));
            viva = true;
            quem = [me.nickname, me.email].filter(Boolean).join(" · ").slice(0, 60);
          } else {
            viva = false;
            quem = `HTTP ${r.status}`;
          }
        } catch { viva = null; }   // rede caiu: não medi — e não medir NÃO é acusar
        const nMp = await conectados("mercadopago");
        eMp = viva === null
          ? { detect: false, ready: null, nota: "não consegui falar com o Mercado Pago — isto NÃO é \"token inválido\"" }
          : viva === false
            ? { detect: true, ready: false, falha: true, nota: `o Mercado Pago RECUSOU o token da plataforma (${quem})` }
            : { detect: true, ready: true, nota: `${quem || "conta MP ok"}${nMp ? ` · ${nMp} tenant(s)` : ""}` };
      }

      const engines = [
        // Stripe CONNECT — now detected for real via the live API probe above (stripeConnect).
        // "on" = Connect enabled (money can route to clients); "off" = key works but Connect not on;
        // "unknown" = no key/hiccup → fall back to "verify at provider".
        { id: "stripe",   detect: stripeConnect !== "unknown", ready: stripeConnect === "on", vars: ["STRIPE_WEBHOOK_SECRET"] },
        { id: "a2p",      detect: a2p.detect, ready: a2p.ready, nota: a2p.nota, vars: [] },
        { id: "whats",    detect: eWhats.detect, ready: eWhats.ready, nota: eWhats.nota, vars: ["META_APP_ID", "META_APP_SECRET", "META_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"] },
        { id: "gbp",      detect: eGbp.detect, ready: eGbp.ready, nota: eGbp.nota, vars: ["GOOGLE_BUSINESS_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_SECRET"] },
        { id: "mindbody", detect: eMb.detect, ready: eMb.ready, nota: eMb.nota, vars: ["MINDBODY_API_KEY"] },
        { id: "voicecost",detect: voicecost.detect, ready: voicecost.ready, nota: voicecost.nota, vars: ["VOICE_COST_CENTS_PER_MIN"] },
        { id: "dunning",  detect: true,  ready: dunningLigado, nota: cfgCobranca.dunning_enforce != null ? "regra no banco (/admin)" : "regra na env", vars: ["DUNNING_ENFORCE"] },
        // MP credits with the TOKEN alone (the webhook re-fetches the payment from MP as source of
        // truth). MP_WEBHOOK_SECRET is optional signature hardening, NOT a requirement — so readiness
        // is token-presence. Either MP_ACCESS_TOKEN or MERCADOPAGO_TOKEN counts (the webhook reads both).
        { id: "mp",       detect: eMp.detect, ready: eMp.ready, nota: eMp.nota, falha: eMp.falha === true, vars: ["MP_ACCESS_TOKEN", "MERCADOPAGO_TOKEN", "MP_WEBHOOK_SECRET"] },
      ];
      // per-var presence map (booleans only — safe to send to the browser)
      const present = {};
      engines.forEach((e) => e.vars.forEach((v) => { present[v] = has(v); }));
      const already = { ELEVENLABS_API_KEY: has("ELEVENLABS_API_KEY"), STRIPE_SECRET_KEY: has("STRIPE_SECRET_KEY"), RESEND_API_KEY: has("RESEND_API_KEY"), TWILIO_ACCOUNT_SID: has("TWILIO_ACCOUNT_SID"), DIGEST_TOKEN: has("DIGEST_TOKEN"), INGEST_SECRET: has("INGEST_SECRET") };
      return json({ ok: true, engines: engines.map(({ id, detect, ready, nota, falha }) => ({ id, detect, ready, nota: nota || "", falha: falha === true })), present, already });
    }

    // default: the BROTO dashboard payload — whole queue + inventory in one round-trip.
    const [tq, iv] = await Promise.all([
      svcRpc(env, "support_ticket_list", { p_secret: secret, p_email: "", p_limit: 300 }),
      rpc("inventory_list", { p_secret: secret, p_limit: 500 }),
    ]);
    const tickets = tq.ok ? (await tq.json()) || [] : [];
    const inventory = iv.ok ? (await iv.json()) || [] : [];
    const ready = tq.ok || iv.ok;
    return json({ ok: true, ready, tickets, inventory, note: ready ? null : "Paste db/support.sql to activate." });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
