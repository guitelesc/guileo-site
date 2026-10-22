// Cloudflare Pages Function — POST /api/twilio-inbound
// THE GUI TEXT AGENT: point your Twilio number's "A message comes in" webhook here
// (works for WhatsApp senders AND plain SMS). Every inbound message:
//   1. is signature-verified against TWILIO_AUTH_TOKEN (rejects forgeries),
//   2. lands as a REAL `message` event in client_events (feeds the portal),
//   3. gets an instant AI sales reply via the Anthropic API (ANTHROPIC_API_KEY) —
//      without the key it still logs events and replies with a warm human-handoff line.
// Twilio config: Phone Numbers → your number → Messaging → webhook POST
//   https://guileoai.com/api/twilio-inbound
import { json, safeEq } from "./../lib/guard.js";
import { svcRpc } from "./../lib/sb.js";
import { webchatSentiment } from "./../lib/cxEngine.js";
import { guiReply } from "./../lib/guiBrain.js";
import { lerConversa, gravarTroca } from "./../lib/conversa.js";
import { svcJson } from "./../lib/sb.js";
import { debitarDepois, refMensagem, ligado } from "./../lib/creditos.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// Twilio request validation: HMAC-SHA1(url + sorted params, AUTH_TOKEN) base64 == X-Twilio-Signature
async function validTwilioSig(url, params, sig, token) {
  if (!sig || !token) return false;
  const keys = [...params.keys()].sort();
  let data = url;
  for (const k of keys) data += k + params.get(k);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return safeEq(b64, sig);
}

async function ingest(env, email, channel, summary, payload) {
  try {
    await svcRpc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "message", p_channel: channel, p_summary: summary.slice(0, 300), p_amount: 0, p_payload: payload || {} });
  } catch { /* never block the reply */ }
}

// Record a genuinely inbound customer message as a `message` event so it surfaces in the
// portal Inbox (buildRealInbox). p_channel is the human label ("WhatsApp"/"SMS"); summary is
// `<ContactName>: <text>` so the Inbox derives the contact + last line. Best-effort, never throws.
async function ingestInboundMessage(env, email, twilioChannel, fromNameOrNumber, messageBody, from) {
  try {
    const p_channel = twilioChannel === "whatsapp" ? "WhatsApp" : "SMS";
    await svcRpc(env, "ingest_client_event", {
        p_secret: env.INGEST_SECRET || "",
        p_email: email,
        p_type: "message",
        p_channel,
        p_summary: `${fromNameOrNumber}: ${messageBody}`.slice(0, 300),
        p_amount: 0,
        p_payload: { from, channel: p_channel },
    });
  } catch { /* additive — never break the Twilio response */ }
}

// CRM SPINE — every inbound SMS/WhatsApp sender becomes a real contact in the tenant's CRM, exactly
// like a call/webchat lead does. Best-effort + graceful: no-op until db/crm_spine.sql is pasted
// (crm_upsert_contact is SCHED-gated, same as lead.js/agent-action.js). Never breaks the reply.
async function crmUpsert(env, email, phone, name, source) {
  try {
    if (!env.SCHED_SECRET || !phone) return;
    await svcRpc(env, "crm_upsert_contact", { p_secret: env.SCHED_SECRET, p_email: email, p_phone: phone, p_contact_email: "", p_name: name || "", p_source: source || "sms", p_amount_cents: 0 });
  } catch { /* CRM not live yet → never break the Twilio response */ }
}

// Client profile (business_name / review_link / lang / stripe_link / forward_number) — null when none.
async function getProfile(env, email) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/get_client_profile`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_email: email }),
    });
    if (r.ok) { const p = await r.json(); if (p && typeof p === "object") return p; }
  } catch { /* profile is optional */ }
  return null;
}

// ── CALLER MEMORY (inbound voice) ─────────────────────────────────────────────
// Client numbers are imported straight into ElevenLabs convai (provision.js → elevenBindNumber), so an
// inbound CALL is answered by ElevenLabs directly — no Guileo TwiML runs before pickup. The one real
// injection point is ElevenLabs' conversation-initiation (Twilio personalization) webhook, which
// provision.js points HERE (platform_settings.workspace_overrides.conversation_initiation_client_data_webhook).
// ElevenLabs POSTs JSON { caller_id, agent_id, called_number, call_sid } with our x-guileo-secret header;
// we answer { type, dynamic_variables } within ~1s so pickup is never delayed.
// ── A SAUDAÇÃO JÁ COM O NOME (2026-09-28) ────────────────────────────────────────────────────────
// Pedido do Luis: a Lilian tem que ATENDER já reconhecendo — "How can I take care of you today, Luis?".
// O caminho antigo ({{caller_ola}} dentro da primeira fala) derrubou ligações duas vezes (16 e 18/08):
// variável na primeira fala é OBRIGATÓRIA pra ElevenLabs, e qualquer tropeço do webhook mata a chamada.
// Aqui a primeira fala do agente NÃO muda. Quando — e só quando — sabemos o nome, este webhook devolve
// a frase pronta como `conversation_config_override.agent.first_message`. Sem nome, sem override: a
// ligação sai com a saudação de sempre. Duas travas contra o outro defeito conhecido ("Override for
// field 'first_message' is not allowed by config", 729 ligações em 03–05/09):
//   1. a frase-base e a PERMISSÃO são lidas do próprio agente na ElevenLabs, na hora;
//   2. sem permissão lida === true, o override não é enviado. Nada é presumido.
const _agentes = new Map(); // agent_id → { em, fala, pode } · cache de 10 min por isolate
async function agenteDaLinha(env, agentId) {
  if (!env.ELEVENLABS_API_KEY || !/^agent_[a-z0-9]+$/i.test(agentId || "")) return null;
  const c = _agentes.get(agentId);
  if (c && Date.now() - c.em < 600000) return c;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(1200) });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    const v = { em: Date.now(), fala: (d?.conversation_config?.agent?.first_message || "").toString(),
      lang: (d?.conversation_config?.agent?.language || "en").toString(),
      pode: d?.platform_settings?.overrides?.conversation_config_override?.agent?.first_message === true };
    _agentes.set(agentId, v);
    return v;
  } catch { return null; }
}
// O NOME VEM PRIMEIRO (2026-09-28, 21:47Z). A 1ª versão punha o nome no FIM ("…today, Luis?") e em
// TRÊS ligações seguidas o Luis começou a falar aos 3–5s — a frase leva 6s, o nome nunca foi ouvido.
// Reconhecer alguém é dizer o nome dele na primeira palavra, não na última.
// "Thank you for calling…" + "Luis" → "Hi Luis! Thank you for calling…". Devolve "" quando não dá pra
// fazer direito (nome estranho, frase com variável, frase vazia) — e "" significa NÃO mexer.
const OLA = { en: "Hi", pt: "Oi", es: "Hola", fr: "Bonjour", it: "Ciao", de: "Hallo" };
export function saudacaoComNome(fala, nomeCompleto, lang = "en") {
  const f = (fala || "").toString().trim();
  const nome = (nomeCompleto || "").toString().trim().split(/\s+/)[0] || "";
  if (!f || f.includes("{{") || f.length > 380) return "";
  if (!/^[\p{L}][\p{L}'’-]{1,29}$/u.test(nome)) return "";
  if (f.toLowerCase().includes(nome.toLowerCase())) return "";
  const oi = OLA[(lang || "en").toString().toLowerCase().slice(0, 2)] || OLA.en;
  return `${oi} ${nome}! ${f}`;
}

// Mesmo número dos dois lados, comparado pelos 10 últimos dígitos (o "+1" vai e vem entre provedores).
export function ehLaco(caller, called) {
  const d = (x) => String(x || "").replace(/\D/g, "").slice(-10);
  const a = d(caller), b = d(called);
  return a.length === 10 && a === b;
}

async function handleElevenInitiation(env, body) {
  // caller_phone É O BINA. Sem ele a agente pedia o telefone de quem estava ligando DAQUELE
  // telefone — o Luis teve que ditar o número duas vezes na primeira ligação real (2026-08-07).
  // Perguntar o que o sistema já sabe queima o bem mais escasso da ligação: o tempo dele.
  // `caller_ola` É O QUE FALTAVA PARA O NOME CHEGAR NA BOCA DA AGENTE (2026-08-16).
  // O webhook já entregava `caller_name` — e a agente continuava sem chamar ninguém pelo nome,
  // porque a PRIMEIRA FRASE dela é texto fixo ("Thank you for calling X. This is Y — how may I
  // help you today?"). Cano instalado, torneira fechada.
  // Não dá para enfiar {{caller_name}} cru na saudação: para quem liga pela primeira vez sairia
  // "This is Lilian,  — how may I help you", com a vírgula órfã denunciando a máquina. Então o
  // webhook entrega a SAUDAÇÃO PRONTA: ", Luis" para quem já é conhecido, "" para quem não é.
  // Quem decide a frase é quem tem o dado; o prompt só encaixa.
  const empty = { caller_name: "", caller_last: "", caller_note: "", caller_phone: "", caller_ola: "" };
  const reply = (vars, fala = "") => new Response(JSON.stringify({ type: "conversation_initiation_client_data", dynamic_variables: vars,
    ...(fala ? { conversation_config_override: { agent: { first_message: fala } } } : {}) }), {
    status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  try {
    const caller = (body.caller_id || "").toString().replace(/[^0-9+]/g, "");
    const called = (body.called_number || "").toString().replace(/[^0-9+]/g, "");
    // 🔁 A AGENTE LIGANDO PARA SI MESMA (2026-09-30). Quando ela transfere para a recepção e a linha
    // da recepção ENCAMINHA de volta para este número, chega aqui uma ligação cujo "quem liga" é o
    // próprio número dela. Atender seria duas cópias da agente conversando entre si, gastando
    // minuto, com a cliente de verdade pendurada na conferência. Recusar o início derruba só essa
    // perna: a transferência falha e a agente original volta para a cliente e anota o recado (é o
    // plano B que o prompt já manda). Nenhuma pessoa real liga DE um número PARA ele mesmo.
    if (ehLaco(caller, called)) {
      return new Response(JSON.stringify({ error: "loop", detail: "caller is the agent's own number" }), { status: 409, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    if (!caller || !called || !env.INGEST_SECRET) return reply(empty);
    const lookup = (async () => {
      // tenant = whoever owns the dialed number (same mapping SMS routing uses)
      const lr = await fetch(`${SB_URL}/rest/v1/rpc/lookup_client_by_number`, {
        method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_number: called }),
      });
      const email = lr.ok ? await lr.json().catch(() => null) : null;
      if (!email) return { ...empty, caller_phone: caller };
      // Prefer the RICHER crm_caller_context (adds last booked service) so the agent can greet with
      // the actual service; fall back to crm_caller_lookup when it isn't pasted yet. Both INGEST-gated.
      try {
        const cx = await svcRpc(env, "crm_caller_context", { p_secret: env.INGEST_SECRET, p_email: email, p_phone: caller });
        if (cx.ok) {
          const j = await cx.json().catch(() => null);
          if (j && typeof j === "object" && (j.name || j.visits_count > 1)) {
            let last = "";
            try {
              const days = Math.floor((Date.now() - new Date(j.last_visit).getTime()) / 86400000);
              last = days <= 0 ? "earlier today" : days === 1 ? "yesterday" : days < 60 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
              if (j.visits_count > 1) last += ` — visit #${j.visits_count}`;
            } catch { /* keep last empty */ }
            const note = j.last_service ? ` · last: ${String(j.last_service).slice(0, 120)}` : j.summary ? ` · last: ${String(j.summary).slice(0, 120)}` : "";
            {
              const nome = (j.name || "").toString().slice(0, 80);
              return { caller_name: nome, caller_last: last, caller_note: note, caller_phone: caller,
                       caller_ola: nome ? `, ${nome.split(/\s+/)[0]}` : "" };
            }
          }
        }
      } catch { /* fall through to crm_caller_lookup */ }
      const cr = await fetch(`${SB_URL}/rest/v1/rpc/crm_caller_lookup`, {
        method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: email, p_phone: caller }),
      });
      if (!cr.ok) return { ...empty, caller_phone: caller }; // RPC not pasted yet (db/crm_caller_lookup.sql) → graceful new-caller
      const rows = await cr.json().catch(() => []);
      const c = Array.isArray(rows) ? rows[0] : rows;
      if (!c || !c.full_name) return { ...empty, caller_phone: caller };
      let last = "";
      try {
        const days = Math.floor((Date.now() - new Date(c.last_seen_at).getTime()) / 86400000);
        last = days <= 0 ? "earlier today" : days === 1 ? "yesterday" : days < 60 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
        if (c.visit_count > 1) last += ` — visit #${c.visit_count}`;
      } catch { /* keep last empty */ }
      return {
        caller_name: (c.full_name || "").toString().slice(0, 80),
        caller_ola: (c.full_name || "") ? `, ${String(c.full_name).trim().split(/\s+/)[0].slice(0, 40)}` : "",
        caller_last: last,
        caller_note: c.last_summary ? ` · last: ${String(c.last_summary).slice(0, 120)}` : "",
        caller_phone: caller,
      };
    })();
    // TIME-BOUND: never make ElevenLabs wait on the DB — 2s or the caller is just "new".
    // 2026-09-28: era 800ms. A prova (?prova=1) mediu worker FRIO em >800ms e quente em 200–400ms;
    // ligação é rara, então quase toda ligação real pegava worker frio e o Luis virava "novo" — com
    // o nome dele no CRM. 2s de teto ainda é bem menos que um toque de telefone.
    // Mesmo no timeout o BINA vai: ele veio no próprio evento da ligação, não do banco. Perder o
    // número porque o banco demorou seria perder o dado mais certo que temos.
    const [vars, ag] = await Promise.all([
      Promise.race([lookup, new Promise((res) => setTimeout(() => res({ ...empty, caller_phone: caller }), 2000))]),
      agenteDaLinha(env, (body.agent_id || "").toString()).catch(() => null),
    ]);
    const fala = vars.caller_name && ag && ag.pode ? saudacaoComNome(ag.fala, vars.caller_name, ag.lang) : "";
    return reply(vars, fala);
  } catch { return reply(empty); }
}

const twiml = (msg) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message></Response>`,
  { status: 200, headers: { "Content-Type": "text/xml", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
);

// GET ?prova=1&de=+1…&para=+1… · x-guileo-secret: INGEST — roda O MESMO handler que a ElevenLabs
// chama no início da ligação e devolve as variáveis + o tempo. Regra de 18/08: webhook de
// identidade só se confia provado em produção, não suposto (lições "canário verde, cérebro morto").
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get("prova") !== "1") return json({ error: "not found" }, 404);
  if (!env.INGEST_SECRET || !safeEq(request.headers.get("x-guileo-secret") || "", env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  const t0 = Date.now();
  const r = await handleElevenInitiation(env, { caller_id: url.searchParams.get("de") || "", called_number: url.searchParams.get("para") || "", agent_id: url.searchParams.get("agente") || "" });
  const d = await r.json().catch(() => null);
  return json({ ok: r.status === 200, ms: Date.now() - t0, tem_agent_secret: !!env.AGENT_ACTION_SECRET, saudacao: d?.conversation_config_override?.agent?.first_message || null, resposta: d });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // CALLER MEMORY branch: ElevenLabs' initiation webhook is JSON + our shared-secret header
    // (Twilio always posts form-encoded, so this can never shadow real SMS traffic). Auth = the
    // same AGENT_ACTION_SECRET the agent's other webhooks use; wrong/missing secret → 401.
    if ((request.headers.get("Content-Type") || "").includes("application/json")) {
      if (!env.AGENT_ACTION_SECRET || !safeEq(request.headers.get("x-guileo-secret") || "", env.AGENT_ACTION_SECRET)) {
        // 2026-09-28: NUNCA 401 aqui. Com o webhook de iniciação ligado, resposta não-200 = a
        // ElevenLabs não inicia a ligação (queda de 18/08, "Missing required dynamic variables").
        // Segredo errado recebe variáveis VAZIAS — não vaza nada, e o telefone do cliente não cai.
        return new Response(JSON.stringify({ type: "conversation_initiation_client_data",
          dynamic_variables: { caller_name: "", caller_last: "", caller_note: "", caller_phone: "", caller_ola: "" } }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "x-guileo-auth": "fail" } });
      }
      const jb = await request.json().catch(() => ({}));
      return handleElevenInitiation(env, jb || {});
    }

    if (!env.TWILIO_AUTH_TOKEN) return json({ error: "not configured — set TWILIO_AUTH_TOKEN" }, 501);

    const raw = await request.text();
    const params = new URLSearchParams(raw);
    const sig = request.headers.get("X-Twilio-Signature") || "";
    // Twilio signs the EXACT request URL — derive it so preview deploys & URL drift validate.
    const url = new URL(request.url).href;
    if (!(await validTwilioSig(url, params, sig, env.TWILIO_AUTH_TOKEN))) {
      return json({ error: "bad signature" }, 401);
    }

    const from = params.get("From") || "";                  // "whatsapp:+1555..." or "+1555..."
    const body = (params.get("Body") || "").trim();
    const channel = from.startsWith("whatsapp:") ? "whatsapp" : "sms";
    if (!body) return twiml("Hi! How can Gui help you today? 🌱");

    // TCPA/A2P COMPLIANCE (the legal moat): honor opt-out keywords INSTANTLY. Add the sender
    // to do_not_contact so no automation (blitz, reminders, speed-to-lead) ever texts/calls
    // them again — this is what keeps clients out of $500-1500/msg fines.
    const fromPhone = from.replace("whatsapp:", "").replace(/[^0-9+]/g, "");
    if (/^(stop|stopall|unsubscribe|cancel|end|quit|sair|parar|baja|cancelar)$/i.test(body)) {
      try {
        await fetch(`${SB_URL}/rest/v1/rpc/add_dnc`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_phone: fromPhone, p_reason: "opt_out" }) });
      } catch { /* still confirm */ }
      return twiml("You've been unsubscribed and won't receive more messages. Reply START to opt back in. · Você saiu e não receberá mais mensagens.");
    }
    if (/^(start|unstop|yes start|voltar|iniciar)$/i.test(body)) {
      // 🚨 O START NÃO TIRAVA NINGUÉM DA LISTA (2026-09-30): a resposta dizia "você voltou" e o
      // número continuava bloqueado para sempre — a pessoa pedia para voltar a receber o lembrete
      // e nunca mais recebia. Agora sai da lista (só o bloqueio que ela mesma criou com STOP).
      try { await svcJson(env, "remove_dnc", { p_secret: env.INGEST_SECRET || "", p_phone: fromPhone }); } catch { /* confirma mesmo assim */ }
      return twiml("You're back in — you'll receive messages again. Reply STOP anytime to opt out. · Você voltou a receber mensagens.");
    }
    // HELP é palavra obrigatória das operadoras (A2P): quem é, para que serve, como sair.
    if (/^(help|info|ajuda|ayuda)$/i.test(body)) {
      return twiml("Appointment confirmations and reminders from the business you booked with, powered by Guileo. Msg&data rates may apply. Reply STOP to opt out. For help, reply here or call the business you booked with.");
    }

    // multi-tenant routing: the Twilio number that RECEIVED the message identifies the client
    // (mapped via set_client_number at provisioning). Unmapped numbers → the owner's pipeline.
    let email = env.OWNER_EMAIL || "smart@guileoai.com";
    try {
      const to = (params.get("To") || "").replace("whatsapp:", "");
      if (to) {
        const lr = await fetch(`${SB_URL}/rest/v1/rpc/lookup_client_by_number`, {
          method: "POST",
          headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_number: to }),
        });
        if (lr.ok) { const mapped = await lr.json(); if (mapped) email = mapped; }
      }
    } catch { /* fall back to owner */ }
    const profile = await getProfile(env, email);
    const isPT = !profile?.lang || String(profile.lang).toLowerCase().startsWith("pt");

    // "1"/"2" booking replies — confirm/reschedule BEFORE waking the AI brain.
    // booking_reply ingests its own event server-side, so we don't double-log here.
    // ── "C" / CONFIRM / YES AO LEMBRETE (2026-09-30) ────────────────────────────────────────────
    // O lembrete por texto pede "Reply C to confirm". A RPC antiga abaixo (booking_reply) olha
    // `client_bookings`, que a agenda de verdade não usa — a confirmação nunca achava o horário, e
    // um "YES" em inglês nem era reconhecido. Esta procura o PRÓXIMO horário da pessoa NESTE
    // negócio e grava a confirmação. Não achou → segue para a agente, que responde como gente.
    if (/^(c|confirm|confirmed|yes|y|ok|confirmar|confirmo|sim|si|sí|1)$/i.test(body) && env.SCHED_SECRET) {
      const cf = await svcJson(env, "biz_confirm_by_phone", { p_secret: env.SCHED_SECRET, p_email: email, p_phone: fromPhone, p_via: channel }).catch(() => null);
      if (cf && cf.ok === true && cf.found === true) {
        const L = (profile?.lang || "en").toString().toLowerCase().slice(0, 2);
        let quando = "";
        try { quando = new Intl.DateTimeFormat(L === "pt" ? "pt-BR" : L === "es" ? "es-US" : "en-US", { timeZone: cf.tz || "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(cf.when)); } catch { /* sem data formatada */ }
        await ingest(env, email, channel, `✅ ${fromPhone} confirmed ${cf.service || "the appointment"}${quando ? ` — ${quando}` : ""}${cf.ref ? ` (${cf.ref})` : ""}`, { from, appointment_id: cf.id });
        return twiml(L === "pt" ? `Confirmado ✅ ${cf.service ? `${cf.service}, ` : ""}${quando}. Até lá!`
          : L === "es" ? `Confirmado ✅ ${cf.service ? `${cf.service}, ` : ""}${quando}. ¡Hasta entonces!`
            : `Confirmed ✅ ${cf.service ? `${cf.service}, ` : ""}${quando}. See you then!`);
      }
    }
    const choice = { "1": "1", "confirmar": "1", "sim": "1", "2": "2", "remarcar": "2" }[body.toLowerCase()];
    if (choice) {
      try {
        const br = await fetch(`${SB_URL}/rest/v1/rpc/booking_reply`, {
          method: "POST",
          headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_phone: from.replace("whatsapp:", ""), p_choice: choice }),
        });
        if (br.ok) {
          const res = await br.json();
          if (res?.found && res.action === "confirmed") {
            let when = res.starts_at || "";
            try { when = new Intl.DateTimeFormat(isPT ? "pt-BR" : "en-US", { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(res.starts_at)); } catch { /* keep raw */ }
            return twiml(isPT ? `Confirmado! ✅ Te esperamos ${when}. Até lá! 🌱` : `Confirmed! ✅ We'll see you ${when}. See you then! 🌱`);
          }
          if (res?.found && res.action === "reschedule") {
            return twiml(isPT ? "Sem problema! Vamos te chamar pra achar um novo horário. 🌱" : "No problem! We'll reach out to find a new time. 🌱");
          }
        }
      } catch { /* not a booking reply — fall through to the AI */ }
    }

    await ingest(env, email, channel, `${channel === "whatsapp" ? "💬" : "📱"} ${from.replace("whatsapp:", "")}: ${body}`, { from });

    // Also record this inbound customer message as a `message` event with a human channel label
    // and `<Contact>: <text>` summary so it shows up in the portal Inbox (buildRealInbox).
    const fromNameOrNumber = (params.get("ProfileName") || "").trim() || from.replace("whatsapp:", "");
    await ingestInboundMessage(env, email, channel, fromNameOrNumber, body, from);

    // XM SIGNAL — an inbound SMS/WhatsApp message with CLEAR sentiment is a real CX reading (the
    // customer, in their own words). Same high-precision heuristic as webchat → zero LLM cost, skips
    // ambiguous. One reading per customer per DAY (ref) so a chatty thread can't flood the score.
    // Best-effort, never blocks the reply; graceful until db/experience.sql is installed.
    try {
      const cxs = webchatSentiment(body);
      if (cxs && env.INGEST_SECRET) {
        await fetch(`${SB_URL}/rest/v1/rpc/cx_signal_upsert`, {
          method: "POST",
          headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            p_secret: env.INGEST_SECRET, p_email: email, p_contact_id: null, p_source: channel,
            p_score: cxs.score, p_raw_score: cxs.sentiment, p_sentiment: cxs.sentiment,
            p_theme: null, p_comment: body.slice(0, 500),
            p_ref: `${channel}:${fromPhone}:${new Date().toISOString().slice(0, 10)}`,
            p_occurred_at: new Date().toISOString(),
          }),
        });
      }
    } catch { /* CX signal is a bonus — never break the reply */ }

    // CRM SPINE — resolve-or-create the sender as a contact (ProfileName is the real name when
    // WhatsApp provides it; a bare number is never stored as a name). Best-effort, never blocks.
    await crmUpsert(env, email, fromPhone, (params.get("ProfileName") || "").trim(), channel === "whatsapp" ? "whatsapp" : "sms");

    // UNIFIED TEXT BRAIN — the SAME cérebro webchat/Meta use (guiBrain.guiReply). The tenant is
    // pinned SERVER-SIDE by the number→email mapping resolved above (never the untrusted message
    // body), so Gui answers in THIS business's own voice, quotes its real biz_services prices, and
    // closes — with the constitution guard + validateOutput floor (inside guiReply) making a risky
    // refund/discount promise or off-list price impossible to send as the business. guiReply never
    // throws and always returns a warm `reply` (honest ack when the tenant/key is missing).
    // O FIO DA CONVERSA: as últimas trocas desta pessoa com este negócio (24h) — sem isto cada
    // SMS chegava ao cérebro como se fosse o primeiro.
    const anteriores = await lerConversa(env, email, channel, fromPhone);
    const gr = await guiReply(env, {
      email,
      channel,
      from: from.replace("whatsapp:", ""),
      text: body,
      history: anteriores,
      lang: (profile?.lang || "").toString().toLowerCase().slice(0, 2),
    });
    if (gr && gr.ready && gr.reply) await gravarTroca(env, email, channel, fromPhone, { anteriores, pergunta: body, resposta: gr.reply });
    const reply = (gr && gr.reply) ? gr.reply
      : (isPT ? "Recebi sua mensagem! A equipe te responde em instantes. 🌱"
              : "Got your message! The team will reply shortly. 🌱");
    await ingest(env, email, channel, `🤖 Gui replied: ${reply.slice(0, 140)}`, { to: from });
    // ── MEDIDOR DE CRÉDITO (2026-09-27) ───────────────────────────────────────────────────────
    // Três condições, todas necessárias:
    //  1) o CÉREBRO respondeu — `ready` e sem `escalate`. A frase de handoff e o "recebi sua
    //     mensagem" são enlatados: não se cobra por eles;
    //  2) o canal ENTREGA. Aqui a resposta sai por TwiML e a Twilio não nos devolve comprovante.
    //     O que sabemos é a chave do canal: com a campanha A2P reprovada (erro 30034) a operadora
    //     recusa o SMS, então cobrar seria cobrar por mensagem que não chegou. Mesmas chaves que
    //     comprovante.js usa — quando o canal for aprovado, a cobrança acende junto;
    //  3) existe MessageSid — é a referência que torna a reentrega da Twilio gratuita.
    const respostaDaIA = !!(gr && gr.ready && !gr.escalate && gr.reply);
    const canalEntrega = channel === "whatsapp" ? ligado(env.WHATSAPP_APROVADO) : ligado(env.SMS_A2P_APROVADO);
    if (respostaDaIA && canalEntrega) {
      const sid = params.get("MessageSid") || params.get("SmsMessageSid") || "";
      await debitarDepois(context, env, { email, kind: channel, ref: refMensagem(channel, sid) });
    }
    return twiml(reply);
  } catch {
    return twiml("Got it! A human from Guileo will reply shortly. 🌱");
  }
}
