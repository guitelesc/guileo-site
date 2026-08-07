// Cloudflare Pages Function — POST /api/inbox  (UNIFIED INBOX for the cockpit)
// One place to READ + REPLY to conversations across SMS / WhatsApp / web-chat / IG, with
// the Gui answering automatically and a human able to take over any thread.
//
//   POST { token, email, action:"threads", limit? }               -> { ok, ready, threads:[...] }
//   POST { token, email, action:"thread", thread, channel? }      -> { ok, messages:[...], phone, channel, human }
//   POST { token, email, action:"takeover", thread, channel, contact, human } -> { ok }
//   POST { token, email, action:"send", thread, channel, contact, phone, body } -> { ok, sent, pending?, note? }
//
// PER-TENANT GATE: every call binds the cockpit email to its connection key via
// get_client_data (rejects a mismatch, no OWNER_EMAIL fallback) BEFORE touching the inbox —
// same shape as noshow-radar.js. The inbox read model itself lives in db/inbox.sql
// (inbox_threads / inbox_thread, INGEST-gated); until it's pasted this returns a graceful
// { ready:false, note } so the cockpit shows the honest empty state instead of a 500.
//
// SEND reuses the shared Twilio sender (functions/lib/twilio.js sendText) — it does NOT
// reimplement messaging. Web-chat / social have no push-back channel from here, so those
// replies are logged to the thread and returned as { sent:false, pending:true } with a note.
import { json } from "../lib/guard.js";
import { sendText } from "../lib/twilio.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Best-effort ledger write (reuses the existing INGEST-gated ingest_client_event). Never throws.
async function ingest(env, email, channel, summary, payload) {
  try {
    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "message", p_channel: channel,
      p_summary: (summary || "").slice(0, 300), p_amount: 0, p_payload: payload || {},
    });
  } catch { /* additive — never break the response */ }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));

    // ── PER-TENANT GATE (bind email ↔ connection key; mismatch → 401). ──
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const action = (b.action || "threads").toString();
    const INGEST = env.INGEST_SECRET || "";

    // ── THREADS — the conversation list. ──
    if (action === "threads") {
      const limit = Math.min(Math.max(parseInt(b.limit, 10) || 60, 1), 200);
      const r = await rpc("inbox_threads", { p_secret: INGEST, p_client_email: email, p_limit: limit });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/inbox.sql in Supabase to activate the unified inbox.", threads: [] });
      const threads = (await r.json().catch(() => [])) || [];
      return json({ ok: true, ready: true, threads: Array.isArray(threads) ? threads : [] });
    }

    // ── THREAD — one conversation's messages + reply route + takeover flag. ──
    if (action === "thread") {
      const thread = (b.thread || "").toString().trim();
      if (!thread) return json({ error: "thread required" }, 400);
      const channel = (b.channel || "").toString().trim() || null;
      const r = await rpc("inbox_thread", { p_secret: INGEST, p_client_email: email, p_thread: thread, p_channel: channel });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/inbox.sql in Supabase to activate the unified inbox.", messages: [] });
      const d = (await r.json().catch(() => null)) || {};
      return json({ ok: true, ready: true, messages: Array.isArray(d.messages) ? d.messages : [], phone: d.phone || "", channel: d.channel || channel || "", human: !!d.human });
    }

    // ── TAKEOVER — pause/resume Gui on a thread. Stored as a 'takeover' control event
    //    (payload.kind='takeover') so inbox_threads/inbox_thread surface the human flag. ──
    if (action === "takeover") {
      const thread = (b.thread || "").toString().trim();
      if (!thread) return json({ error: "thread required" }, 400);
      const human = b.human === true || b.human === "true";
      const contact = (b.contact || "").toString().slice(0, 120) || "Customer";
      await ingest(env, email, "Portal",
        human ? `🙋 Human took over the conversation with ${contact}` : `🤖 Gui resumed the conversation with ${contact}`,
        { kind: "takeover", thread_key: thread, channel: (b.channel || "").toString().slice(0, 40), human });
      return json({ ok: true, human });
    }

    // ── SEND — outbound human reply through the RIGHT channel. ──
    if (action === "send") {
      const body = (b.body || "").toString().trim();
      if (!body) return json({ error: "empty body" }, 400);
      const thread = (b.thread || "").toString().trim();
      const channel = (b.channel || "").toString().trim();
      const contact = (b.contact || "").toString().slice(0, 120) || "Customer";
      // Reply route: explicit phone from the thread, else the thread key itself when it's a number.
      let phone = (b.phone || "").toString().replace(/[^0-9+]/g, "");
      if (!phone && /^\+?\d{6,}$/.test(thread.replace(/[^0-9+]/g, ""))) phone = thread.replace(/[^0-9+]/g, "");
      const isSms = /sms|text/i.test(channel);
      const isWa = /whats/i.test(channel);

      // Log the human reply to the thread FIRST so the cockpit reflects it even if delivery is
      // pending (payload.to keeps it grouped on the same thread; kind='human_reply' → 'you' bubble).
      const logSummary = `${contact}: ${body}`; // stripped to `body` by the read model's prefix rule
      const logPayload = { kind: "human_reply", to: phone || thread, channel };

      if ((isSms || isWa) && phone) {
        const res = await sendText(env, phone, body, { channel: isWa ? "whatsapp" : "sms" });
        await ingest(env, email, isWa ? "WhatsApp" : "SMS", logSummary, logPayload);
        if (res.sent) return json({ ok: true, sent: true });
        // Twilio not configured / send failed → keep the logged bubble, tell the truth.
        return json({ ok: true, sent: false, pending: true, note: res.reason === "not configured" ? "Twilio not configured — reply logged but not delivered." : "Carrier/Twilio rejected the send — reply logged, not delivered." });
      }

      // Web-chat / social (or missing phone): no push-back path from here. Log it and mark pending
      // so the operator knows the customer won't receive it until that channel's sender is wired.
      await ingest(env, email, channel || "Message", logSummary, logPayload);
      return json({ ok: true, sent: false, pending: true, note: phone ? `Replies on ${channel || "this channel"} aren't deliverable from here yet — logged only.` : "No phone on this thread — reply logged only." });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
