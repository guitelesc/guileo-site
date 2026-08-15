// Cloudflare Pages Function — POST /api/voice-fallback
// VOICE CONTINGENCY: Twilio calls this URL when the PRIMARY voice webhook (ElevenLabs) errors
// or times out — i.e. the AI voice platform is down. Without this, an inbound call on a client
// number dies in dead air. With it, the caller hears a warm human apology in the client's
// language, gets a WhatsApp text right away, the tenant gets a 📵 missed-call event, and
// /admin gets a "voice_platform_down" failure alert (throttled to 1 per 10 min globally).
// Twilio config: Phone Numbers → number → Voice Configuration → "Call fails" / Fallback URL:
//   https://guileoai.com/api/voice-fallback  (HTTP POST) — see db/VOICE_FALLBACK_SETUP.md
import { json, safeEq } from "./../lib/guard.js";
import { sendText, sendOrFlag } from "./../lib/twilio.js";
import { emitFailure } from "./../lib/failure.js";
import { svcRpc } from "./../lib/sb.js";

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

// Best-effort tenant event — never blocks the TwiML.
async function ingest(env, email, type, summary, payload) {
  try {
    await svcRpc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: type, p_channel: "voice", p_summary: summary.slice(0, 300), p_amount: 0, p_payload: payload || {} });
  } catch { /* never block the TwiML */ }
}

// Client profile (business_name / lang) — null when none. Cheap single RPC; used only for the lang.
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

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Warm apology in the tenant's language: EN · PT · ES · HI (defaults to EN).
const APOLOGY = {
  en: { voice: "en-US", say: "So sorry — we're having a quick hiccup on our end. I'm sending you a message right now and we'll call you back in just a few minutes!" },
  pt: { voice: "pt-BR", say: "Desculpa — estamos com uma instabilidade rapidinha. Já te mando uma mensagem e retornamos em minutos!" },
  es: { voice: "es-MX", say: "Perdón — tenemos una pequeña falla técnica. ¡Te envío un mensaje ahora mismo y te devolvemos la llamada en unos minutos!" },
  hi: { voice: "hi-IN", say: "माफ़ कीजिए — हमारी तरफ़ से एक छोटी सी तकनीकी दिक्कत है। मैं अभी आपको मैसेज भेज रहा हूँ और कुछ ही मिनटों में हम आपको वापस कॉल करेंगे!" },
};
const TEXTBACK = {
  en: (name) => `Hi! We got your call to ${name || "us"} 🌱 A quick technical hiccup on our side — we're calling you right back in a few minutes. You can also just reply here!`,
  pt: (name) => `Oi! Recebemos sua ligação pra ${name || "a gente"} 🌱 Tivemos uma instabilidade rapidinha — já estamos te retornando em minutinhos. Pode responder por aqui também!`,
  es: (name) => `¡Hola! Recibimos tu llamada a ${name || "nosotros"} 🌱 Una pequeña falla técnica de nuestro lado — te devolvemos la llamada en unos minutos. ¡También puedes responder por aquí!`,
  hi: (name) => `नमस्ते! ${name || "हम"} को आपकी कॉल मिली 🌱 हमारी तरफ़ से एक छोटी तकनीकी दिक्कत थी — कुछ ही मिनटों में हम आपको वापस कॉल कर रहे हैं। आप यहाँ जवाब भी दे सकते हैं!`,
};
const langKey = (profile) => {
  const l = String(profile?.lang || "en").toLowerCase().slice(0, 2);
  return APOLOGY[l] ? l : "en";
};

// OPS-ALERT THROTTLE: an ElevenLabs outage hits EVERY inbound call on EVERY number at once.
// The caller-facing rescue (TwiML + text-back + tenant event) runs on every call, but the
// /admin failure alert fires at most once per 10 minutes GLOBALLY (KV best-effort; if KV is
// unavailable we err on the side of alerting).
async function shouldAlert(env) {
  try {
    const kv = env.RATE_LIMIT;
    if (!kv) return true;
    const key = `voicefb:alert:${Math.floor(Date.now() / 600000)}`; // 10-min bucket
    if (await kv.get(key)) return false;
    await kv.put(key, "1", { expirationTtl: 600 });
    return true;
  } catch { return true; }
}

// Look up the client's own trained Gui agent so the callback speaks as THEIR agent (not the generic one).
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

// BUSY/MISSED → AUTO-RETURN: the primary voice platform errored, so Gui calls the caller back to
// handle the lead live — turning the fallback's spoken "we'll call you right back" into a real call.
// Mirrors autoCallBack in twilio-voice.js with the SAME money/TCPA guards: per-client opt-out
// (profile.auto_callback === false), DNC-respected, and a per-number hourly cap (KV) so a number
// can't be machine-gun-dialed. The caller just dialed the business, so a prompt return is expected.
// Never throws — a callback failure must not turn the TwiML apology into more dead air.
async function autoCallBack(env, email, profile, from) {
  try {
    if (profile?.auto_callback === false) return;                 // per-client opt-out
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_PHONE_NUMBER_ID) return; // not configured
    const e164 = (from || "").replace(/[^0-9+]/g, "");
    if (!/^\+?[1-9]\d{7,14}$/.test(e164)) return;                 // need a real number to call back

    // per-number cap: at most one auto-callback per caller per hour (KV best-effort)
    const kv = env.RATE_LIMIT;
    if (kv) {
      const key = `cb:${e164}:${Math.floor(Date.now() / 3600000)}`;
      if (await kv.get(key)) return;                              // already called this number this hour
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

    const agent_id = await clientAgentId(env, email);
    const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id,
        agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID,
        to_number: e164,
        conversation_initiation_client_data: { dynamic_variables: { business: profile?.business_name || "", lang: profile?.lang || "auto" } },
      }),
    });
    await ingest(env, email, "call", res.ok ? `📞 Auto-callback placed to ${from} (voice-fallback rescue)` : `📞 Auto-callback failed (${res.status}) to ${from}`, { from, auto: true, fallback: true });
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
    const url = "https://guileoai.com/api/voice-fallback";
    if (!(await validTwilioSig(url, params, sig, env.TWILIO_AUTH_TOKEN))) {
      return json({ error: "bad signature" }, 403);
    }

    const from = params.get("From") || "";
    const to = (params.get("To") || "").replace("whatsapp:", "");
    const errUrl = params.get("ErrorUrl") || "";
    const errCode = params.get("ErrorCode") || "";

    // multi-tenant routing: the Twilio number that RECEIVED the call identifies the client
    let email = env.OWNER_EMAIL || "smart@guileoai.com";
    try {
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
    const lk = langKey(profile);

    // AFTER-ACTIONS (all best-effort, all before returning but each individually swallowed —
    // a DB/Twilio hiccup here must NEVER turn the apology into more dead air):
    // 1. text the CALLER (WhatsApp-first) so the lead has a live thread the second they hang up
    if (from && !from.startsWith("client:")) {
      // O text-back é a promessa principal do produto: "perdeu a ligação? mandamos mensagem na
      // hora". Falhar aqui em silêncio leva o lead junto e ninguém fica sabendo. Agora o dono é
      // avisado com o motivo, e pode recuperar o cliente na mão.
      await sendOrFlag(env, { to: from, body: TEXTBACK[lk](profile?.business_name),
        opts: { channel: "whatsapp" }, tenant: email || "", motivo: "resposta de ligação perdida" });
    }
    // 2. tenant feed: this WAS a missed call — the client must see it in their portal
    await ingest(env, email, "missed", `📵 Voice platform down — inbound call from ${from} rescued by fallback (text-back sent)`, { from, to, error_code: errCode, error_url: errUrl.slice(0, 200), fallback: true });
    // 2b. AUTO-CALLBACK — keep the spoken promise: Gui actually calls the caller back to handle the
    //     lead live (DNC + per-number hourly cap inside). Best-effort; never blocks the TwiML.
    if (from && !from.startsWith("client:")) await autoCallBack(env, email, profile, from);
    // 3. /admin ops alert — throttled so an outage emits 1 scream, not 500
    if (await shouldAlert(env)) {
      await emitFailure(env, "voice_platform_down", email, `Twilio fallback fired for ${to} (ErrorCode ${errCode || "?"}) — primary voice webhook (ElevenLabs) is erroring. Alerts throttled to 1/10min.`, { from, to, error_code: errCode, error_url: errUrl.slice(0, 200) });
    }

    const a = APOLOGY[lk];
    return xml(`<Response><Say voice="alice" language="${a.voice}">${esc(a.say)}</Say><Hangup/></Response>`);
  } catch {
    // even a total failure must answer the call with SOMETHING human, not dead air
    return xml(`<Response><Say voice="alice" language="en-US">So sorry — a quick hiccup on our end. We will call you right back in a few minutes.</Say><Hangup/></Response>`);
  }
}
