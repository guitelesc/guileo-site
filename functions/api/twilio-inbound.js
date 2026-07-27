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
import { webchatSentiment } from "./../lib/cxEngine.js";

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
    await fetch(`${SB_URL}/rest/v1/rpc/ingest_client_event`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "message", p_channel: channel, p_summary: summary.slice(0, 300), p_amount: 0, p_payload: payload || {} }),
    });
  } catch { /* never block the reply */ }
}

// Record a genuinely inbound customer message as a `message` event so it surfaces in the
// portal Inbox (buildRealInbox). p_channel is the human label ("WhatsApp"/"SMS"); summary is
// `<ContactName>: <text>` so the Inbox derives the contact + last line. Best-effort, never throws.
async function ingestInboundMessage(env, email, twilioChannel, fromNameOrNumber, messageBody, from) {
  try {
    const p_channel = twilioChannel === "whatsapp" ? "WhatsApp" : "SMS";
    await fetch(`${SB_URL}/rest/v1/rpc/ingest_client_event`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_secret: env.INGEST_SECRET || "",
        p_email: email,
        p_type: "message",
        p_channel,
        p_summary: `${fromNameOrNumber}: ${messageBody}`.slice(0, 300),
        p_amount: 0,
        p_payload: { from, channel: p_channel },
      }),
    });
  } catch { /* additive — never break the Twilio response */ }
}

// CRM SPINE — every inbound SMS/WhatsApp sender becomes a real contact in the tenant's CRM, exactly
// like a call/webchat lead does. Best-effort + graceful: no-op until db/crm_spine.sql is pasted
// (crm_upsert_contact is SCHED-gated, same as lead.js/agent-action.js). Never breaks the reply.
async function crmUpsert(env, email, phone, name, source) {
  try {
    if (!env.SCHED_SECRET || !phone) return;
    await fetch(`${SB_URL}/rest/v1/rpc/crm_upsert_contact`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_phone: phone, p_contact_email: "", p_name: name || "", p_source: source || "sms", p_amount_cents: 0 }),
    });
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

// AI sales reply — Gui's text brain (Claude). Falls back to a warm handoff without the key.
// With a client profile, Gui speaks FOR that business instead of selling Guileo.
async function aiReply(env, userMsg, channel, profile) {
  if (!env.ANTHROPIC_API_KEY) {
    return "Hey! This is Gui from Guileo 🌱 A real human from our team will reply to you within the hour. Meanwhile: we build AI systems that answer calls, book clients and run your marketing — guileoai.com";
  }
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-fable-5",
        max_tokens: 300,
        system: (() => {
          if (profile?.business_name) {
            let s = `You are Gui, the AI ${channel} assistant representing ${profile.business_name}. Reply in the user's language, SHORT (2-4 sentences max, this is ${channel}), warm and helpful: answer questions, help the customer book or get what they need, and capture their request clearly. Never invent prices, services or availability — when unsure, say the team will confirm shortly.`;
            if (profile.stripe_link) s += ` When the customer wants to pay or asks for the price link, share exactly this payment link: ${profile.stripe_link}`;
            return s;
          }
          return `You are Gui, Guileo's AI ${channel} agent and best SALESPERSON (guileoai.com). Guileo builds AI systems that run & grow local businesses: GUILEO BRAIN (AI agents answering calls/messages, booking, quoting 24/7 — owns PERFORMANCE), GUILEO.AD (ads/content/funnels run daily — owns SALES), GUILEO GROW (every lead followed up, monitored 24/7 — the GROWTH result), plus GUILEO BUILD (sites/apps/software). Live in under 7 days, 30-day money-back, tailored pricing (never invent a price — a specialist quotes same day). Results: +$15K/mo avg revenue, 3.2x ROI in 90 days, -40% ad waste. Reply in the user's language, SHORT (2-4 sentences max, this is ${channel}), warm, and always move toward the close: ask for their business type, then offer a tailored quote or a demo call. Never invent features or prices.`;
        })(),
        messages: [{ role: "user", content: userMsg.slice(0, 1200) }],
      }),
    });
    if (!r.ok) throw new Error("api");
    const d = await r.json();
    return (d.content?.[0]?.text || "").slice(0, 1500) || "Got it! A human from our team will follow up shortly. 🌱";
  } catch {
    return "Got your message! A real human from Guileo will reply within the hour. 🌱";
  }
}

// ── CALLER MEMORY (inbound voice) ─────────────────────────────────────────────
// Client numbers are imported straight into ElevenLabs convai (provision.js → elevenBindNumber), so an
// inbound CALL is answered by ElevenLabs directly — no Guileo TwiML runs before pickup. The one real
// injection point is ElevenLabs' conversation-initiation (Twilio personalization) webhook, which
// provision.js points HERE (platform_settings.workspace_overrides.conversation_initiation_client_data_webhook).
// ElevenLabs POSTs JSON { caller_id, agent_id, called_number, call_sid } with our x-guileo-secret header;
// we answer { type, dynamic_variables } within ~1s so pickup is never delayed.
async function handleElevenInitiation(env, body) {
  const empty = { caller_name: "", caller_last: "", caller_note: "" };
  const reply = (vars) => new Response(JSON.stringify({ type: "conversation_initiation_client_data", dynamic_variables: vars }), {
    status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  try {
    const caller = (body.caller_id || "").toString().replace(/[^0-9+]/g, "");
    const called = (body.called_number || "").toString().replace(/[^0-9+]/g, "");
    if (!caller || !called || !env.INGEST_SECRET) return reply(empty);
    const lookup = (async () => {
      // tenant = whoever owns the dialed number (same mapping SMS routing uses)
      const lr = await fetch(`${SB_URL}/rest/v1/rpc/lookup_client_by_number`, {
        method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_number: called }),
      });
      const email = lr.ok ? await lr.json().catch(() => null) : null;
      if (!email) return empty;
      // Prefer the RICHER crm_caller_context (adds last booked service) so the agent can greet with
      // the actual service; fall back to crm_caller_lookup when it isn't pasted yet. Both INGEST-gated.
      try {
        const cx = await fetch(`${SB_URL}/rest/v1/rpc/crm_caller_context`, {
          method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: email, p_phone: caller }),
        });
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
            return { caller_name: (j.name || "").toString().slice(0, 80), caller_last: last, caller_note: note };
          }
        }
      } catch { /* fall through to crm_caller_lookup */ }
      const cr = await fetch(`${SB_URL}/rest/v1/rpc/crm_caller_lookup`, {
        method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: email, p_phone: caller }),
      });
      if (!cr.ok) return empty; // RPC not pasted yet (db/crm_caller_lookup.sql) → graceful new-caller
      const rows = await cr.json().catch(() => []);
      const c = Array.isArray(rows) ? rows[0] : rows;
      if (!c || !c.full_name) return empty;
      let last = "";
      try {
        const days = Math.floor((Date.now() - new Date(c.last_seen_at).getTime()) / 86400000);
        last = days <= 0 ? "earlier today" : days === 1 ? "yesterday" : days < 60 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
        if (c.visit_count > 1) last += ` — visit #${c.visit_count}`;
      } catch { /* keep last empty */ }
      return {
        caller_name: (c.full_name || "").toString().slice(0, 80),
        caller_last: last,
        caller_note: c.last_summary ? ` · last: ${String(c.last_summary).slice(0, 120)}` : "",
      };
    })();
    // TIME-BOUND: never make ElevenLabs wait on the DB — 800ms or the caller is just "new".
    return reply(await Promise.race([lookup, new Promise((res) => setTimeout(() => res(empty), 800))]));
  } catch { return reply(empty); }
}

const twiml = (msg) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message></Response>`,
  { status: 200, headers: { "Content-Type": "text/xml", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
);

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // CALLER MEMORY branch: ElevenLabs' initiation webhook is JSON + our shared-secret header
    // (Twilio always posts form-encoded, so this can never shadow real SMS traffic). Auth = the
    // same AGENT_ACTION_SECRET the agent's other webhooks use; wrong/missing secret → 401.
    if ((request.headers.get("Content-Type") || "").includes("application/json")) {
      if (!env.AGENT_ACTION_SECRET || !safeEq(request.headers.get("x-guileo-secret") || "", env.AGENT_ACTION_SECRET)) {
        return json({ error: "unauthorized" }, 401);
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
    if (/^(start|unstop)$/i.test(body)) {
      // opt back in handled by carriers; we just acknowledge warmly
      return twiml("You're back in 🌱 How can Gui help you today?");
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

    const reply = await aiReply(env, body, channel, profile);
    await ingest(env, email, channel, `🤖 Gui replied: ${reply.slice(0, 140)}`, { to: from });
    return twiml(reply);
  } catch {
    return twiml("Got it! A human from Guileo will reply shortly. 🌱");
  }
}
