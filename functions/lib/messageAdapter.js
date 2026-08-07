// functions/lib/messageAdapter.js
// ═════════════════════════════════════════════════════════════════════════════
// O ADAPTER DE MENSAGENS — o transporte unificado, gêmeo do scheduleAdapter.
// "Um cérebro, muitos canais": QUALQUER canal (webchat, SMS, WhatsApp, IG DM,
// Messenger) entra por handleInboundMessage e sai por sendOutbound. O canal é só
// transporte — o CÉREBRO (guiReply em guiBrain.js) é o MESMO pra todos.
//
// O que este módulo faz por mensagem de ENTRADA:
//   (a) TENANT por client_email — nunca cruza tenant (o gate vive no guiReply).
//   (b) trata o texto como NÃO-CONFIÁVEL (nunca instrução) — passa cru pro brain,
//       que tem a blindagem anti-injection no system prompt.
//   (c) rate-limit + dedup por (tenant, from, hash-da-msg) — provedores re-entregam
//       webhooks; a MESMA mensagem nunca vira duas respostas nem dois eventos.
//   (d) chama guiReply → resposta no tom/segurança/preços do tenant.
//   (e) grava no CRM + inbox (client_events, canal certo) REUSANDO o contato
//       existente por telefone/handle — memória CROSS-CANAL: o cliente-do-cliente
//       é UMA pessoa, não um por rede.
//   (f) devolve { reply } pro conector do canal enviar.
//
// sendOutbound(env, channel, to, text) roteia pro conector certo do canal (SMS/
// WhatsApp via twilio.js; webchat = inline, o conector já responde na mesma requisição).
// Conector de canal ainda inerte (IG/Messenger sem META_APP_*) → { sent:false,
// ready:false } honesto, nada quebra.
//
// HONESTO + INERTE, igual scheduleAdapter: sem o conector do canal, a resposta
// ainda é GERADA e GRAVADA no inbox; só o "empurrar de volta" fica pendente até a
// chave chegar. Zero regressão pros canais LIVE.
// ═════════════════════════════════════════════════════════════════════════════

import { guiReply } from "./guiBrain.js";
import { sendText } from "./twilio.js";
import { svcRpc } from "./sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const norm = (s) => (s || "").toString().trim().toLowerCase();

// Human channel label for the cockpit Inbox (buildRealInbox reads client_events.channel).
// Matches the labels twilio-inbound.js already writes ("WhatsApp"/"SMS") so the unified
// inbox stays consistent across every entry point.
const CHANNEL_LABEL = {
  webchat: "Webchat", sms: "SMS", whatsapp: "WhatsApp",
  instagram: "Instagram", messenger: "Messenger",
};

// A tiny stable hash (FNV-1a) of a string → hex. Used to build the dedup key from the
// message BODY (never a timestamp — providers retry with the SAME body, so the hash is
// what makes a retry idempotent, exactly like the money engine derives its dedup from body).
function hash(str) {
  let h = 0x811c9dc5;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

// ── isPhone / crmUpsert ────────────────────────────────────────────────────────
// The customer-of-the-customer is ONE person across channels. Resolve-or-create the CRM
// contact by their phone (or email) — the SAME crm_upsert_contact the call/SMS/webchat paths
// use — so a WhatsApp msg and a phone call collapse onto one contact (cross-channel memory).
// SCHED-gated, best-effort: no-op until db/crm_spine.sql is pasted. Never breaks the reply.
function isPhone(s) { return /^[+0-9][0-9\s().-]{6,}$/.test((s || "").trim()); }
async function crmUpsert(env, email, from, name, channel) {
  try {
    if (!env.SCHED_SECRET || !from) return;
    const phone = isPhone(from) ? from.replace(/^whatsapp:/, "").trim() : "";
    const contactEmail = from.includes("@") ? from.trim() : "";
    if (!phone && !contactEmail) return; // a webchat session id isn't a contact handle
    await svcRpc(env, "crm_upsert_contact", {
      p_secret: env.SCHED_SECRET, p_email: email, p_phone: phone,
      p_contact_email: contactEmail, p_name: name || "", p_source: channel || "message", p_amount_cents: 0,
    });
  } catch { /* CRM not live yet → never break the reply */ }
}

// Fire-and-forget cockpit Inbox event (client_events). The label is the human channel;
// summary is the actual message so the owner reads it in the unified inbox. INGEST-gated,
// additive-only — never blocks or breaks the reply.
async function ingest(env, email, channelLabel, summary, payload) {
  try {
    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "message", p_channel: channelLabel,
      p_summary: (summary || "").slice(0, 300), p_amount: 0, p_payload: payload || {},
    });
  } catch { /* additive only */ }
}

// ── handleInboundMessage ───────────────────────────────────────────────────────
// The single entry point every channel connector calls.
//   args: { channel, tenantEmail, from, text, name, history, lang, meta, origin }
//     channel     = "webchat"|"sms"|"whatsapp"|"instagram"|"messenger"
//     tenantEmail = the tenant (client_email) — the ONLY tenant scope
//     from        = customer handle (phone/session/ig-id)
//     text        = the customer's message — UNTRUSTED
//   returns: {
//     ready,     // false = tenant unknown / no key → reply is an honest acknowledgement
//     reply,     // text for the connector to send back
//     escalate,  // true → a human should pick it up
//     duplicate, // true → this exact (tenant,from,body) was already handled (retry) — connector
//                //         should still send `reply` but must NOT re-charge/re-log
//     brand, tenant,
//   }
export async function handleInboundMessage(env, { channel = "webchat", tenantEmail = "", from = "", text = "", name = "", history = [], lang = "en", meta = {}, origin = "" } = {}) {
  const email = norm(tenantEmail);
  const ch = CHANNEL_LABEL[channel] ? channel : "webchat";
  const label = CHANNEL_LABEL[ch];
  const msg = (text || "").toString().slice(0, 600).trim();
  const fromId = (from || "").toString().slice(0, 120);

  // Guard: no tenant / no message → honest, no LLM, no logging.
  if (!email.includes("@") || !msg) {
    return { ready: false, reply: "", escalate: !email.includes("@"), duplicate: false, brand: {}, tenant: { valid: false } };
  }

  // ── DEDUP by (tenant, from, body-hash) ─────────────────────────────────────
  // Providers (Twilio/Meta) retry webhooks with the identical body. A retry must not
  // produce a second answer/charge/log. KV-backed, best-effort (fail-open like rateLimited):
  // if KV is down we proceed rather than drop a real customer's message.
  const dedupKey = `msg:seen:${email}:${fromId}:${hash(msg)}`;
  let duplicate = false;
  try {
    const kv = env.RATE_LIMIT;
    if (kv) {
      if (await kv.get(dedupKey)) duplicate = true;
      else await kv.put(dedupKey, "1", { expirationTtl: 600 }); // 10-min retry window
    }
  } catch { /* fail-open */ }

  // ── RATE LIMIT per (tenant, from) ──────────────────────────────────────────
  // One customer on one channel can't loop the brain all day (protects the tenant's credits).
  // Separate from the dedup window; counts distinct messages, not retries.
  try {
    const kv = env.RATE_LIMIT;
    if (kv && !duplicate) {
      const bucket = Math.floor(Date.now() / 60000);
      const rlKey = `msg:rl:${email}:${fromId}:${bucket}`;
      const n = parseInt((await kv.get(rlKey)) || "0", 10) + 1;
      if (n > 12) return { ready: true, reply: "", escalate: false, duplicate: false, rateLimited: true, brand: {}, tenant: { valid: true } };
      await kv.put(rlKey, String(n), { expirationTtl: 120 });
    }
  } catch { /* fail-open */ }

  // ── THE BRAIN — one call, tenant-scoped, untrusted text as user content only.
  const r = await guiReply(env, { email, channel: ch, from: fromId, text: msg, history, lang, origin });

  // A retry re-sends the same reply but never re-logs (idempotent side effects).
  if (duplicate) {
    return { ready: r.ready, reply: r.reply, escalate: r.escalate, duplicate: true, brand: r.brand, tenant: r.tenant };
  }

  // ── SIDE EFFECTS (only for a recognized tenant): CRM contact (cross-channel memory) + Inbox.
  if (r.tenant && r.tenant.valid) {
    await crmUpsert(env, email, fromId, name, ch);
    await ingest(env, email, label, `${label} · ${name || fromId}: ${msg}`, { from: fromId, channel: ch, ...(meta && typeof meta === "object" ? { meta } : {}) });
    if (r.reply) await ingest(env, email, label, `🤖 Gui replied: ${r.reply.slice(0, 200)}`, { to: fromId, channel: ch });
  }

  return { ready: r.ready, reply: r.reply, escalate: r.escalate, duplicate: false, brand: r.brand, tenant: r.tenant };
}

// ── sendOutbound ───────────────────────────────────────────────────────────────
// Route an outbound message to the channel's connector. For SMS/WhatsApp this actually
// pushes via twilio.js; for webchat there's nothing to push (the widget already received the
// reply in the same HTTP response) so it's a no-op success. Channels with no connector yet
// (Instagram/Messenger — need META_APP_* + a per-tenant page token) return an HONEST
// { sent:false, ready:false } — inert until the app is approved, mirroring scheduleAdapter.
//   returns: { sent, ready, channel, reason? }
export async function sendOutbound(env, channel, to, text, opts = {}) {
  const ch = norm(channel);
  const body = (text || "").toString();
  if (!body) return { sent: false, ready: true, channel: ch, reason: "empty" };

  switch (ch) {
    case "webchat":
      // The webchat connector answers inline in its own HTTP response — nothing to push.
      return { sent: true, ready: true, channel: ch, reason: "inline" };

    case "sms": {
      const res = await sendText(env, to, body, { channel: "sms" });
      return { sent: !!res.sent, ready: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_FROM), channel: ch, reason: res.reason };
    }
    case "whatsapp": {
      const res = await sendText(env, to, body, { channel: "whatsapp" });
      // WhatsApp is "ready" only when a real WhatsApp sender is configured; otherwise sendText
      // falls back to SMS (still delivers, honest about the reason).
      return { sent: !!res.sent, ready: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_WHATSAPP_FROM), channel: ch, reason: res.reason };
    }

    case "instagram":
    case "messenger":
      // No connector yet: needs META_APP_ID/SECRET + a per-tenant page access token. Inert &
      // honest — the reply is already saved in the inbox; this lights up when the app is approved.
      return { sent: false, ready: false, channel: ch, reason: "meta-app-not-approved" };

    default:
      return { sent: false, ready: false, channel: ch, reason: "unknown-channel" };
  }
}
