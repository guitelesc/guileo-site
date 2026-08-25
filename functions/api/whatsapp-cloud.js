// Cloudflare Pages Function — /api/whatsapp-cloud
// ═════════════════════════════════════════════════════════════════════════════
// WHATSAPP CLOUD API (Meta, direct) — the ALT path to WhatsApp that does NOT depend
// on Twilio's blocked A2P/10DLC registration. Same Gui brain, new transport.
//
// ONE BRAIN, MANY CHANNELS: this webhook is pure TRANSPORT. It authenticates Meta,
// resolves the tenant, and hands the message to the unified messageAdapter (the same
// text brain voice/webchat/SMS reuse). It never invents a reply of its own.
//
//   GET  /api/whatsapp-cloud  → Meta webhook verification handshake (hub.challenge).
//   POST /api/whatsapp-cloud  → inbound messages + status callbacks from Meta.
//
// SECURITY (public surface, untrusted input — anti prompt-injection posture):
//   • Every POST is verified against WHATSAPP_APP_SECRET via X-Hub-Signature-256
//     (HMAC-SHA256 of the RAW body). A bad/missing signature → 401, nothing runs.
//   • The GET handshake is gated by WHATSAPP_VERIFY_TOKEN.
//   • MULTI-TENANT ISOLATION: the tenant is resolved SOLELY from the inbound
//     metadata.phone_number_id → client_integrations(provider='whatsapp_cloud').
//     One client's Gui can never answer with another client's number/creds — the
//     reply is sent back through the SAME phone_number_id's own tenant access_token.
//   • Inbound text is treated as untrusted DATA (passed as the user turn to the
//     brain, never as instructions to this function).
//
// HONEST + INERT: with no WHATSAPP_APP_SECRET / no WHATSAPP_VERIFY_TOKEN the endpoint
// reports not-configured and does nothing. With no tenant creds for a phone_number_id
// it ACKs Meta (200) and stays silent rather than leaking or guessing. Nothing breaks.
//
// 24-HOUR CUSTOMER SERVICE WINDOW (Meta rule): free-form text messages are only
// deliverable to a user within 24h of THAT user's last inbound message. Replies to an
// inbound message are always inside the window. PROACTIVE business-initiated sends
// (reminders/win-backs) outside the window MUST use a pre-approved message TEMPLATE —
// see sendWhatsApp() / sendWhatsAppTemplate() below.
// ═════════════════════════════════════════════════════════════════════════════
import { json, safeEq } from "../lib/guard.js";
import { ouvirRecado } from "../lib/whatsappAudio.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const GRAPH = "https://graph.facebook.com/v21.0";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ── signature: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(appSecret, rawBody) ──
async function validMetaSig(rawBody, header, appSecret) {
  if (!header || !appSecret) return false;
  const m = /^sha256=([0-9a-f]+)$/i.exec((header || "").trim());
  if (!m) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return safeEq(hex, m[1].toLowerCase());
}

// ── tenant routing: phone_number_id → { client_email, tokens } ──────────────────
// The number that RECEIVED the message identifies the client (its creds live in
// client_integrations, provider='whatsapp_cloud', written at connect time). INGEST-gated.
async function tenantByPhoneId(env, phoneNumberId) {
  try {
    if (!phoneNumberId || !env.INGEST_SECRET) return null;
    const r = await rpc("whatsapp_cloud_tenant_by_pnid", { p_secret: env.INGEST_SECRET, p_phone_number_id: String(phoneNumberId) });
    if (!r.ok) return null;
    const t = await r.json().catch(() => null);
    if (t && typeof t === "object" && t.client_email) return t; // { client_email, tokens }
    return null;
  } catch { return null; }
}

// ── dedup: Meta re-delivers on any non-200/slow ACK. First-seen wins. ───────────
// Returns true if this message id is NEW (process it), false if already handled.
async function firstSeen(env, email, msgId) {
  try {
    if (!msgId || !env.INGEST_SECRET) return true; // no id → don't block (best-effort)
    const r = await rpc("whatsapp_cloud_mark_seen", { p_secret: env.INGEST_SECRET, p_email: email, p_msg_id: String(msgId) });
    if (!r.ok) return true; // RPC not pasted yet → don't drop real messages
    const v = await r.json().catch(() => null);
    return v === true; // true = inserted (new); false = duplicate
  } catch { return true; }
}

// ── send via Cloud API (tenant's own phone_number_id + access_token) ────────────
// FREE-FORM text — only deliverable INSIDE the 24h customer-service window (i.e. as a
// reply to a user message). For proactive sends outside the window use sendWhatsAppTemplate.
export async function sendWhatsApp(env, tenant, to, text, opts = {}) {
  const creds = tenant && tenant.tokens ? tenant.tokens : tenant; // accept full tenant row or raw tokens
  const pnid = creds && creds.phone_number_id;
  const token = creds && creds.access_token;
  const dest = String(to || "").replace(/[^0-9]/g, "");
  if (!pnid || !token || !dest || !text) return { ok: false, reason: "not-ready" };
  try {
    const r = await fetch(`${GRAPH}/${pnid}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: dest,
        type: "text",
        text: { preview_url: !!opts.preview_url, body: String(text).slice(0, 4096) },
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, id: d?.messages?.[0]?.id || null, raw: d };

    // BR nono digito: o wa_id que a Meta entrega no webhook pode vir SEM o 9
    // (contas antigas), mas o numero que o WhatsApp aceita como destino pode ser o
    // COM o 9 — e vice-versa. Quando a primeira forma e recusada, tentamos a outra
    // uma unica vez. So dispara em erro, entao nao muda nada no caminho feliz.
    const alt = brAltNinth(dest);
    if (alt && !opts._retry) return sendWhatsApp(env, tenant, alt, text, { ...opts, _retry: true });
    return { ok: false, id: null, raw: d };
  } catch (e) { return { ok: false, reason: "transport", error: String(e) }; }
}

// 55 + DD + 9 + 8 digitos  <->  55 + DD + 8 digitos. Devolve null se nao for celular BR.
function brAltNinth(n) {
  const d = String(n || "").replace(/[^0-9]/g, "");
  if (/^55[0-9]{2}9[0-9]{8}$/.test(d)) return "55" + d.slice(2, 4) + d.slice(5);
  if (/^55[0-9]{2}[0-9]{8}$/.test(d)) return "55" + d.slice(2, 4) + "9" + d.slice(4);
  return null;
}

// ── honest failure log ─────────────────────────────────────────────────────────
// A reply the customer never received must NOT look like a delivered reply. Same
// INGEST-gated path the brain uses, so it lands in the cockpit timeline next to the
// optimistic "Gui replied" line and contradicts it out loud.
async function logSendFailure(env, email, to, why, meta = {}) {
  try {
    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "message", p_channel: "WhatsApp",
      p_summary: `⚠️ Resposta da Gui NÃO foi entregue (WhatsApp): ${String(why).slice(0, 200)}`,
      p_amount: 0, p_payload: { delivery: "failed", to: String(to || ""), reason: String(why || ""), ...meta },
    });
  } catch { /* never let logging break the webhook ACK */ }
}

// PROACTIVE / business-initiated send OUTSIDE the 24h window — MUST use a template that
// Meta has pre-approved for this WABA. `components` is the Cloud API template components
// array (body params etc.). Use this for reminders/win-backs/confirmations sent cold.
export async function sendWhatsAppTemplate(env, tenant, to, templateName, langCode = "en_US", components = []) {
  const creds = tenant && tenant.tokens ? tenant.tokens : tenant;
  const pnid = creds && creds.phone_number_id;
  const token = creds && creds.access_token;
  const dest = String(to || "").replace(/[^0-9]/g, "");
  if (!pnid || !token || !dest || !templateName) return { ok: false, reason: "not-ready" };
  try {
    const r = await fetch(`${GRAPH}/${pnid}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: dest,
        type: "template",
        template: { name: templateName, language: { code: langCode }, components },
      }),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, id: d?.messages?.[0]?.id || null, raw: d };
  } catch (e) { return { ok: false, reason: "transport", error: String(e) }; }
}

// ── unified brain: hand the inbound to messageAdapter (same brain every channel uses) ──
// Loaded dynamically so this webhook stays live even before the adapter lands; if the
// adapter isn't present we degrade honestly (ACK Meta, no reply) rather than crash.
async function brainReply(env, ctx) {
  try {
    const mod = await import("../lib/messageAdapter.js").catch(() => null);
    if (mod && typeof mod.handleInboundMessage === "function") {
      const res = await mod.handleInboundMessage(env, ctx);
      if (res && typeof res === "object") return (res.reply || res.text || "").toString();
      if (typeof res === "string") return res;
    }
  } catch { /* adapter not ready → honest silent degrade */ }
  return "";
}

// ═══════════════════════ GET — Meta webhook verification ════════════════════════
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (!env.WHATSAPP_VERIFY_TOKEN) return json({ error: "not configured — set WHATSAPP_VERIFY_TOKEN" }, 501);
  if (mode === "subscribe" && token && safeEq(token, env.WHATSAPP_VERIFY_TOKEN)) {
    return new Response(challenge || "", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  }
  return json({ error: "verification failed" }, 403);
}

// ═══════════════════════ POST — inbound messages + statuses ═════════════════════
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.WHATSAPP_APP_SECRET) return json({ error: "not configured — set WHATSAPP_APP_SECRET" }, 501);

    // 1) verify signature against the RAW body (never trust unsigned webhooks)
    const raw = await request.text();
    const sig = request.headers.get("X-Hub-Signature-256") || "";
    if (!(await validMetaSig(raw, sig, env.WHATSAPP_APP_SECRET))) return json({ error: "bad signature" }, 401);

    const payload = JSON.parse(raw || "{}");
    if (payload.object !== "whatsapp_business_account") return json({ ok: true }); // ignore other objects

    // 2) walk entries → changes → messages. ACK Meta fast; do brain+reply in the background.
    const jobs = [];
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        // status callbacks (sent/delivered/read/failed) carry no `messages` — ACK & skip.
        const messages = value.messages || [];
        if (!messages.length) continue;

        const phoneNumberId = value.metadata && value.metadata.phone_number_id;
        const tenant = await tenantByPhoneId(env, phoneNumberId);
        // Unknown number → not our tenant (or creds not connected yet): ACK silently, never guess.
        if (!tenant || !tenant.client_email) continue;

        const contacts = value.contacts || [];
        const profileName = (contacts[0] && contacts[0].profile && contacts[0].profile.name) || "";

        for (const msg of messages) {
          const from = String(msg.from || "").replace(/[^0-9]/g, "");
          const msgId = msg.id || "";
          // extract text across the common inbound types (untrusted DATA only)
          let text = "";
          if (msg.type === "text") text = (msg.text && msg.text.body) || "";
          else if (msg.type === "button") text = (msg.button && msg.button.text) || "";
          else if (msg.type === "interactive") {
            const i = msg.interactive || {};
            text = (i.button_reply && i.button_reply.title) || (i.list_reply && i.list_reply.title) || "";
          } else if (msg.type === "image" || msg.type === "audio" || msg.type === "video" || msg.type === "document") {
            text = (msg[msg.type] && msg[msg.type].caption) || "";
          }

          // ── RECADO DE VOZ (2026-08-25) ──────────────────────────────────────────────────────
          // Áudio quase nunca tem legenda, então até aqui `text` fica "" e o cérebro recebia uma
          // pergunta vazia — respondia como se a pessoa não tivesse falado. Quem manda áudio e não
          // recebe nada conclui que o número está morto. Agora a gente OUVE.
          let audioFalhou = "";
          if (msg.type === "audio" && !text) {
            const mediaId = msg.audio && msg.audio.id;
            const ouvido = await ouvirRecado(env, {
              mediaId, token: tenant.tokens && tenant.tokens.access_token, lang: tenant.lang,
            });
            if (ouvido.ok) text = ouvido.texto;
            else {
              // Falha VISÍVEL, nunca silêncio: a pessoa recebe um pedido para escrever, e o dono
              // vê no cockpit por que o áudio não virou conversa.
              audioFalhou = ouvido.motivo || "não consegui transcrever";
              text = "";
            }
          }
          if (!from || !msgId) continue;

          // dedup FIRST (fast, synchronous) so a Meta retry never double-answers
          const isNew = await firstSeen(env, tenant.client_email, msgId);
          if (!isNew) continue;

          const work = (async () => {
            // Áudio que não deu para ouvir NÃO segue para o cérebro: uma pergunta vazia faz o
            // cérebro responder qualquer coisa, e o cliente ouve um não-sequitur. Pede para
            // escrever e registra o motivo REAL — falha visível vale mais que resposta errada.
            if (audioFalhou) {
              const { recadoDeFalha } = await import("../lib/whatsappAudio.js");
              const fala = recadoDeFalha(tenant.lang);
              const sent = await sendWhatsApp(env, tenant, from, fala);
              await logSendFailure(env, tenant.client_email, from, `áudio não transcrito: ${audioFalhou}`, {
                phone_number_id: String(phoneNumberId || ""), message_id: msgId, entregou_pedido_de_texto: !!(sent && sent.ok),
              });
              return;
            }

            // Hand to the UNIFIED brain (same handleInboundMessage voice/webchat/SMS use).
            // Its own signature: { channel, tenantEmail, from, text, name, origin, meta }.
            const reply = await brainReply(env, {
              channel: "whatsapp",
              tenantEmail: tenant.client_email,
              from,
              text,
              name: profileName,
              origin: new URL(request.url).origin,
              meta: { provider: "whatsapp_cloud", phone_number_id: String(phoneNumberId || ""), message_id: msgId },
            });
            // Reply goes back through THIS tenant's own Cloud-API number/token (never Twilio,
            // never another tenant). Inside the 24h window since it answers an inbound message.
            //
            // We MUST check the result. The brain already logged "🤖 Gui replied: …" before this
            // line runs, so a rejected send would leave the cockpit claiming an answer the customer
            // never got — the worst kind of failure: silent, and it looks like success. When Meta
            // refuses (expired token, number off the allow-list in dev, 24h window closed), we log
            // the real reason so the cockpit and the owner see the truth.
            if (reply) {
              const sent = await sendWhatsApp(env, tenant, from, reply);
              if (!sent || !sent.ok) {
                const err = sent?.raw?.error || {};
                const why = err.message || sent?.reason || "unknown";
                await logSendFailure(env, tenant.client_email, from, why, {
                  code: err.code ?? null, phone_number_id: String(phoneNumberId || ""), message_id: msgId,
                });
              }
            }
          })();
          jobs.push(work);
        }
      }
    }

    // fire-and-forget the brain/reply work; return 200 immediately so Meta doesn't retry
    if (context.waitUntil && jobs.length) context.waitUntil(Promise.allSettled(jobs));
    else if (jobs.length) await Promise.allSettled(jobs);
    return json({ ok: true });
  } catch {
    // ACK 200 even on internal error → Meta won't hammer retries; nothing leaks
    return json({ ok: true });
  }
}
