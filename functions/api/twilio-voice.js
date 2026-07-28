// Cloudflare Pages Function — POST /api/twilio-voice
// THE GUI MISSED-CALL RESCUE: point your Twilio number's "A call comes in" webhook here.
//   Flow A (call comes in): forward to the client's real phone (profile.forward_number)
//     — or, with no forward number, say a one-liner and treat it as missed right away.
//   Flow B (Dial action callback): if the owner didn't pick up (no-answer/busy/failed),
//     log a 📵 `call` event AND text the caller back instantly so Gui catches the lead.
// Twilio config: Phone Numbers → your number → Voice → webhook POST
//   https://guileoai.com/api/twilio-voice
import { json, safeEq } from "./../lib/guard.js";
import { svcRpc } from "./../lib/sb.js";
import { sendText } from "./../lib/twilio.js";

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

async function ingest(env, email, summary, payload) {
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/ingest_client_event`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "call", p_channel: "voice", p_summary: summary.slice(0, 300), p_amount: 0, p_payload: payload || {} }),
    });
  } catch { /* never block the TwiML */ }
}

// Client profile (business_name / lang / forward_number) — null when none.
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

const xml = (body) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?>${body}`,
  { status: 200, headers: { "Content-Type": "text/xml", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
);

// Missed call → log the 📵 event + text the caller back so the lead never goes cold.
async function missedCallTextBack(env, email, profile, from) {
  const isPT = !profile?.lang || String(profile.lang).toLowerCase().startsWith("pt");
  const name = profile?.business_name;
  const msg = isPT
    ? `Oi! Vi que você ligou pra ${name || "a gente"} e não conseguimos atender 🌱 Sou o Gui, o assistente — me fala aqui o que você precisa que eu já resolvo!`
    : `Hi! I saw you called ${name || "us"} and we couldn't pick up 🌱 I'm Gui, the assistant — tell me here what you need and I'll get it sorted!`;
  await ingest(env, email, `📵 Missed call from ${from} — text-back sent`, { from });
  await sendText(env, from, msg);
  // CRM SPINE (Company OS) — a missed caller is a real lead: build the contact + a 360° call event.
  // Best-effort + graceful: no-op until crm_spine.sql / crm_phase2.sql are pasted.
  if (env.SCHED_SECRET && from) {
    try {
      const crm = (fn, body) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.SCHED_SECRET, ...body }) });
      const ur = await crm("crm_upsert_contact", { p_email: email, p_phone: from, p_contact_email: "", p_name: "", p_source: "missed-call", p_amount_cents: 0 });
      const cid = ur.ok ? (await ur.json().catch(() => null)) : null;
      if (cid) await crm("crm_log_event", { p_email: email, p_contact_id: cid, p_type: "call", p_channel: "Phone", p_summary: "Missed call — text-back sent", p_amount_cents: 0, p_dedupe: null, p_payload: { from } });
    } catch { /* CRM not live yet → never block the TwiML */ }
  }
}

// Look up the client's own trained Gui agent (so the callback speaks as THEIR agent, not the generic one).
async function clientAgentId(env, email) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/client_agent_lookup`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_email: email }),
    });
    if (r.ok) { const id = ((await r.json()) || "").toString(); if (/^agent_[a-z0-9]+$/i.test(id)) return id; }
  } catch { /* fall back to default agent */ }
  return env.ELEVENLABS_AGENT_ID || "agent_5901ktdkev68f5kb161fmeax1rdm";
}

// CALLER MEMORY — look the caller up in the tenant's CRM spine (crm_caller_lookup, db/crm_caller_lookup.sql)
// so the returning Gui call greets a regular by name ("Oi Maria! O de sempre?"). STRICTLY best-effort and
// TIME-BOUND: Promise.race with an ~800ms timeout so a slow DB can NEVER delay the call flow. Unknown
// caller / RPC missing / timeout → empty vars, and the prompt treats them as a new customer.
async function callerMemory(env, email, phone) {
  const empty = { caller_name: "", caller_last: "", caller_note: "" };
  try {
    if (!env.INGEST_SECRET || !phone) return empty;
    const lookup = (async () => {
      // Prefer the RICHER crm_caller_context (name + last_visit + last_service + summary) so the
      // greeting can name the actual service; fall back to crm_caller_lookup when it isn't pasted
      // yet. Both INGEST-gated; caller_name/caller_last/caller_note stay the injected vars.
      try {
        const cx = await svcRpc(env, "crm_caller_context", { p_secret: env.INGEST_SECRET, p_email: email, p_phone: phone });
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
      const r = await fetch(`${SB_URL}/rest/v1/rpc/crm_caller_lookup`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: email, p_phone: phone }),
      });
      if (!r.ok) return empty;
      const rows = await r.json().catch(() => []);
      const c = Array.isArray(rows) ? rows[0] : rows;
      if (!c || !(c.full_name || c.visit_count > 1)) return empty; // nameless one-timer ⇒ treat as new
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
    return await Promise.race([lookup, new Promise((res) => setTimeout(() => res(empty), 800))]);
  } catch { return empty; }
}

// BUSY/MISSED → AUTO-RETURN: Gui calls the caller back so the AI handles the lead live (not just a text).
// Guarded for money + TCPA: opt-out via profile.auto_callback === false, DNC-respected, and a per-number
// hourly cap (KV) so a number can't be machine-gun-dialed. The caller just dialed the business, so a prompt
// return call is expected/consented. Never throws — a callback failure must not break the TwiML response.
async function autoCallBack(env, email, profile, from) {
  try {
    if (profile?.auto_callback === false) return;                 // per-client opt-out
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_PHONE_NUMBER_ID) return; // not configured
    const e164 = (from || "").replace(/[^0-9+]/g, "");
    if (!/^\+?[1-9]\d{7,14}$/.test(e164)) return;                  // need a real number to call back

    // per-number cap: at most one auto-callback per caller per hour (KV best-effort)
    const kv = env.RATE_LIMIT;
    if (kv) {
      const key = `cb:${e164}:${Math.floor(Date.now() / 3600000)}`;
      if (await kv.get(key)) return;                               // already called this number this hour
      await kv.put(key, "1", { expirationTtl: 3600 });
    }

    // DNC / TCPA STOP — never dial a number that opted out
    if (env.INGEST_SECRET) {
      try {
        const dr = await fetch(`${SB_URL}/rest/v1/rpc/is_dnc`, {
          method: "POST",
          headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_phone: e164 }),
        });
        if (dr.ok && (await dr.json()) === true) return;
      } catch { /* DNC down → the hourly cap still bounds volume */ }
    }

    // CALLER MEMORY: fetch agent + contact in parallel (lookup is 800ms-bounded, never delays the dial)
    const [agent_id, mem] = await Promise.all([clientAgentId(env, email), callerMemory(env, email, e164)]);
    const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id,
        agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID,
        to_number: e164,
        conversation_initiation_client_data: { dynamic_variables: { business: profile?.business_name || "", lang: profile?.lang || "auto", ...mem } },
      }),
    });
    await ingest(env, email, res.ok ? `📞 Auto-callback placed to ${from}` : `📞 Auto-callback failed (${res.status}) to ${from}`, { from, auto: true });
  } catch { /* never block the TwiML */ }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.TWILIO_AUTH_TOKEN) return json({ error: "not configured — set TWILIO_AUTH_TOKEN" }, 501);

    const raw = await request.text();
    const params = new URLSearchParams(raw);
    const sig = request.headers.get("X-Twilio-Signature") || "";
    // Twilio signs the exact public URL it was configured with
    const url = "https://guileoai.com/api/twilio-voice";
    if (!(await validTwilioSig(url, params, sig, env.TWILIO_AUTH_TOKEN))) {
      return json({ error: "bad signature" }, 401);
    }

    const from = params.get("From") || "";
    const dialStatus = params.get("DialCallStatus");

    // multi-tenant routing: the Twilio number that RECEIVED the call identifies the client
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

    // Flow B — Dial action callback: did the owner pick up?
    if (dialStatus) {
      if (dialStatus === "no-answer" || dialStatus === "busy" || dialStatus === "failed") {
        await missedCallTextBack(env, email, profile, from);
        await autoCallBack(env, email, profile, from); // busy/no-answer → Gui calls the lead back live
        return xml(`<Response><Hangup/></Response>`);
      }
      return xml(`<Response/>`); // 'completed' — they talked, nothing to rescue
    }

    // Flow A — incoming call: forward to the owner's real phone when we have one
    if (profile?.forward_number) {
      return xml(`<Response><Dial action="${url}" method="POST" timeout="18">${profile.forward_number}</Dial></Response>`);
    }
    // No forward number yet → every call is a "missed" call: text back right away + Gui returns the call
    await missedCallTextBack(env, email, profile, from);
    await autoCallBack(env, email, profile, from);
    // Set the expectation so the caller waits for the callback instead of hanging up confused.
    const isPT = !profile?.lang || String(profile.lang).toLowerCase().startsWith("pt");
    const sayMsg = isPT
      ? "Obrigado por ligar! Já te mandei uma mensagem e o Gui vai te retornar a ligação em instantes."
      : "Thanks for calling! I've just texted you and Gui will call you right back in a moment.";
    return xml(`<Response><Say voice="alice" language="${isPT ? "pt-BR" : "en-US"}">${sayMsg}</Say><Hangup/></Response>`);
  } catch {
    return xml(`<Response><Hangup/></Response>`);
  }
}
