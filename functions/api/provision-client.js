// Cloudflare Pages Function — POST /api/provision-client
// ONE-CLICK CLIENT PROVISIONING: a single admin-gated orchestration endpoint that runs
// the full provisioning chain idempotently and returns a per-step status report. It
// composes the same building blocks used by onboard-client.js / sync-agent.js:
//   1. AUTH      — verify the admin token (blitz_stats RPC) BEFORE any side effect → 401.
//   2. AGENT     — ensure the client has their OWN ElevenLabs agent built from THEIR
//                  brain/business/industry. Create if none (client_agent_lookup →
//                  agents/create → set_client_agent); else PATCH its prompt in place.
//   3. NUMBER    — only when buyNumber===true AND the client has no number yet: buy a
//                  fresh Twilio number, wire its Voice + SMS webhooks, store it. Strictly
//                  opt-in + idempotent → NEVER double-buys.
//   4. ROUTING   — persist forward_number on the profile so twilio-voice routes calls.
//   5. Returns   { ok, steps:[{name,status,detail}], a2p:<manual 10DLC checklist> }.
//
// SAFETY: the purchase path costs real money — it is opt-in (buyNumber), idempotent, and
// every external call is wrapped so one failed step reports 'error' without aborting the
// rest. Token compare is timing-safe via the blitz_stats RPC (server-side secret check).
import { json } from "../lib/guard.js";
import { buildGuiPrompt } from "../lib/provision.js";
import { emitFailure } from "../lib/failure.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const VOICE_WEBHOOK = "https://guileoai.com/api/twilio-voice";
const SMS_WEBHOOK = "https://guileoai.com/api/twilio-inbound";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST",
  headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Delegate to the canonical buildGuiPrompt (provision.js) so EVERY path — auto-provision (Stripe),
// admin one-click, and patch — builds the SAME "close & collect" prompt. One source of truth.
function buildPrompt(business, industry, lang, brain) {
  return buildGuiPrompt({ business, industry, lang, brain }).prompt;
}

function firstMessage(business, lang) {
  return buildGuiPrompt({ business, lang }).firstMessage;
}

// Best-effort read of any already-provisioned number on the client profile, so the
// purchase path can skip and never double-buy. Returns "" when none.
async function existingNumber(env, email) {
  try {
    const r = await rpc("get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (r.ok) {
      const p = await r.json();
      if (p && typeof p === "object") {
        const n = p.number || p.twilio_number || p.phone_number || p.client_number || "";
        return (n || "").toString();
      }
    }
  } catch { /* profile is optional — treat as no number */ }
  return "";
}

const A2P_CHECKLIST =
  "A2P 10DLC (manual — required before US SMS will deliver): " +
  "1) In Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC, register a Brand for the client's business (legal name, EIN/tax id, address, website). " +
  "2) Create a Campaign under that Brand (use case + sample messages + opt-in/opt-out language). " +
  "3) Create a Messaging Service and add the purchased number as a sender to it. " +
  "4) Link the Messaging Service to the approved Campaign. " +
  "5) Wait for carrier approval (hours–days). Until the Brand + Campaign are APPROVED and the number is in the linked Messaging Service, outbound SMS to US numbers will be filtered/undelivered. Voice is unaffected and works immediately.";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const token = (b.token || "").toString();

    // 1) AUTH FIRST — verify the admin token before ANY side effect, before field
    // validation, so an unauthenticated probe always gets 401 (never a 400 that would
    // leak the request shape). blitz_stats does the server-side secret check.
    const vr = await rpc("blitz_stats", { p_token: token, p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    const email = (b.email || "").toString().trim().toLowerCase();
    const business = (b.business || "").toString().slice(0, 160);
    if (!email.includes("@") || !business) return json({ error: "email + business required" }, 400);

    const ING = env.INGEST_SECRET || "";
    const industry = (b.industry || "").toString().slice(0, 80);
    const brain = (b.brain || "").toString().slice(0, 4000);
    const lang = ["pt", "es", "en"].includes(b.lang) ? b.lang : "en";
    const forwardNumber = (b.forwardNumber || "").toString().replace(/[^0-9+]/g, "");
    const buyNumber = b.buyNumber === true || b.buyNumber === "true";

    const steps = [];
    const push = (name, status, detail) => steps.push({ name, status, detail });
    const result = { ok: true };

    // ── STEP: ElevenLabs agent (create-or-update, idempotent) ─────────────────────
    if (!env.ELEVENLABS_API_KEY) {
      push("agent", "skipped", "ELEVENLABS_API_KEY not set");
    } else {
      try {
        const prompt = buildPrompt(business, industry, lang, brain);
        // Does this client already have a dedicated agent?
        let agentId = "";
        try {
          const ar = await rpc("client_agent_lookup", { p_secret: ING, p_email: email });
          if (ar.ok) agentId = ((await ar.json()) || "").toString();
        } catch { /* lookup is best-effort; fall through to create */ }

        if (agentId) {
          // UPDATE in place — PATCH only the prompt text. Per the ElevenLabs rule we send
          // NEITHER tools NOR tool_ids here (never both), so we can't trip the conflict.
          const pr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
            method: "PATCH",
            headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ conversation_config: { tts: { model_id: "eleven_flash_v2_5", ...(env.ELEVEN_VOICE_ID ? { voice_id: env.ELEVEN_VOICE_ID } : {}) }, agent: { prompt: { prompt } } } }),
          });
          if (pr.ok) { result.agent_id = agentId; push("agent", "done", `updated existing agent ${agentId} (voice re-applied)`); }
          else push("agent", "error", `agent PATCH failed (${pr.status})`);
        } else {
          // CREATE a fresh dedicated agent, then persist its id via set_client_agent.
          const cr = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
            method: "POST",
            headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `Gui · ${business}`.slice(0, 60),
              conversation_config: {
                tts: { model_id: "eleven_flash_v2_5", ...(env.ELEVEN_VOICE_ID ? { voice_id: env.ELEVEN_VOICE_ID } : {}) },
                agent: { prompt: { prompt }, language: lang, first_message: firstMessage(business, lang) },
              },
            }),
          });
          if (cr.ok) {
            const d = await cr.json();
            const newId = (d.agent_id || d.id || "").toString();
            result.agent_id = newId;
            // created-but-not-linked = the client's calls will NEVER route to their paid agent —
            // report it honestly (check .ok too: fetch doesn't throw on non-2xx) instead of "done".
            let linked = false;
            if (newId) { try { const sr = await rpc("set_client_agent", { p_secret: ING, p_email: email, p_agent_id: newId }); linked = sr.ok; } catch { /* linked stays false */ } }
            if (linked) push("agent", "done", `created agent ${newId}`);
            else push("agent", "error", newId ? `created ${newId} but NOT linked — calls won't route; re-run to link` : "created_no_id");
          } else {
            push("agent", "error", `agent create failed (${cr.status})`);
          }
        }
      } catch (e) { push("agent", "error", String(e).slice(0, 120)); }
    }

    // ── STEP: phone number (opt-in + idempotent — NEVER double-buys) ──────────────
    if (!buyNumber) {
      push("number", "skipped", "skipped (set buyNumber:true to purchase)");
    } else if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      push("number", "skipped", "Twilio credentials not set");
    } else {
      try {
        const already = await existingNumber(env, email);
        if (already) {
          result.number = already;
          push("number", "skipped", `already provisioned (${already}) — not buying again`);
        } else {
          const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
          const auth = "Basic " + btoa(`${sid}:${tok}`);
          const area = (b.areaCode || b.area_code || "").toString().replace(/[^0-9]/g, "");
          // find one available US local number that does Voice + SMS
          const sr = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&VoiceEnabled=true${area ? `&AreaCode=${area}` : ""}&PageSize=1`,
            { headers: { Authorization: auth } },
          );
          const avail = sr.ok ? await sr.json() : {};
          const pick = avail?.available_phone_numbers?.[0]?.phone_number;
          if (!pick) {
            push("number", "error", sr.ok ? "no matching number available" : `search failed (${sr.status})`);
          } else {
            const pr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`, {
              method: "POST",
              headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                PhoneNumber: pick,
                VoiceUrl: VOICE_WEBHOOK, VoiceMethod: "POST",
                SmsUrl: SMS_WEBHOOK, SmsMethod: "POST",
              }),
            });
            if (pr.ok) {
              const pd = await pr.json();
              const bought = (pd.phone_number || pick).toString();
              result.number = bought;
              // a number BOUGHT but not persisted = orphaned $/mo + calls that won't route AND the
              // idempotency lookup won't see it next run (double-buy risk) — surface it, never fake "done".
              let linked = false;
              try { const snr = await rpc("set_client_number", { p_secret: ING, p_email: email, p_number: bought }); linked = snr.ok; } catch { /* linked stays false */ }
              if (linked) push("number", "done", `bought + wired ${bought} (voice→twilio-voice, sms→twilio-inbound)`);
              else { push("number", "error", `bought ${bought} but NOT linked — link manually before re-running (re-run would double-buy)`); await emitFailure(env, "number_orphaned", email, `bought ${bought} but set_client_number failed — link manually`, { number: bought }); }
            } else {
              push("number", "error", `purchase failed (${pr.status})`);
            }
          }
        }
      } catch (e) { push("number", "error", String(e).slice(0, 120)); }
    }

    // ── STEP: routing (forward_number on the profile) ─────────────────────────────
    if (!forwardNumber) {
      push("routing", "skipped", "no forwardNumber provided");
    } else {
      try {
        await rpc("set_client_profile", { p_secret: ING, p_email: email, p_profile: {
          business_name: business, industry, lang, forward_number: forwardNumber,
        } });
        result.forward_number = forwardNumber;
        push("routing", "done", `forward_number set to ${forwardNumber}`);
      } catch (e) { push("routing", "error", String(e).slice(0, 120)); }
    }

    // log the provisioning run as a real client event (never blocks the response)
    try {
      await rpc("ingest_client_event", { p_secret: ING, p_email: email, p_type: "provision", p_channel: "system",
        p_summary: `🚀 Provision run: ${business}${result.number ? " · " + result.number : ""}`, p_amount: 0,
        p_payload: { agent_id: result.agent_id || "", number: result.number || "", steps } });
    } catch { /* */ }

    result.steps = steps;
    result.a2p = A2P_CHECKLIST;
    return json(result);
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 400);
  }
}
