// Cloudflare Pages Function — POST /api/provision-agent
// THE MAGIC FLOW: a paying client gets their OWN ElevenLabs voice agent, built from
// their AI-brain profile (business, industry, services, tone). Fully coded; activates
// the moment ELEVENLABS_API_KEY exists in the Cloudflare env (until then → 501).
//   POST { email, business, industry, brain, language }  (secret-gated)
// On success the agent_id is recorded as a `provision` event for that client.
import { json, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const provided = request.headers.get("x-guileo-secret") || "";
    if (!env.AGENT_ACTION_SECRET || !safeEq(provided, env.AGENT_ACTION_SECRET)) {
      return json({ error: "unauthorized" }, 401);
    }
    if (!env.ELEVENLABS_API_KEY) {
      return json({ ready: false, error: "ELEVENLABS_API_KEY not set — provisioning is coded and waiting for the key" }, 501);
    }

    const body = await request.json();
    const email = (body.email || "").toString().trim().toLowerCase();
    const business = (body.business || "").toString().slice(0, 160);
    const industry = (body.industry || "").toString().slice(0, 80);
    const brain = (body.brain || "").toString().slice(0, 4000);
    const language = (body.language || "en").toString().slice(0, 5);
    if (!email || !business) return json({ error: "email and business required" }, 400);

    // build the client's dedicated Gui from their own brain — SALES-FIRST by design:
    // every call is an opportunity to book, quote or close for the client's business.
    const prompt = [
      `You are Gui — a Four Seasons-caliber concierge AND the best salesperson for ${business}${industry ? ` (a ${industry} business)` : ""}. Always gracious, calm, formal yet warm: you never say "I can't" — you say "leave it with me". Every call is a chance to delight the caller AND to book, quote or close.`,
      brain ? `BUSINESS KNOWLEDGE (answer questions about the business with this, precisely — never invent beyond it):\n${brain}` : "",
      `HOW TO SELL: greet warmly and get the caller's name; find what they need; present the matching service with one clear benefit; then CLOSE — book the appointment, send the quote, or take the order. If they hesitate, offer the easiest next step and confirm a callback.`,
      `RULES: always reply in the SAME language the caller speaks (Portuguese, English or Spanish). Keep answers short, warm and unhurried — concierge pace, never rushed. Always collect name + callback number, and confirm bookings/orders back clearly. Never make up prices or promises beyond the business knowledge above.`,
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Gui · ${business}`.slice(0, 60),
        conversation_config: { tts: { model_id: "eleven_flash_v2_5", ...(env.ELEVEN_VOICE_ID ? { voice_id: env.ELEVEN_VOICE_ID } : {}) },
          agent: { prompt: { prompt }, language, first_message: `Thanks for calling ${business}! This is Gui — how can I help you today?` },
        },
      }),
    });
    if (!res.ok) {
      try { console.log("provision error", (await res.text()).slice(0, 300)); } catch { /* */ }
      return json({ error: "provisioning failed" }, 502);
    }
    const data = await res.json();
    const agentId = data.agent_id || data.id || "";

    // record the provisioning as a real client event
    await svcRpc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "provision", p_channel: "system", p_summary: `Dedicated AI agent created for ${business}`, p_amount: 0, p_payload: { agent_id: agentId } });

    return json({ ok: true, agent_id: agentId });
  } catch (e) {
    return json({ error: String(e).slice(0, 120) }, 400);
  }
}
