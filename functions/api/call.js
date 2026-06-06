// Cloudflare Pages Function — POST /api/call → triggers a real outbound AI phone call.
// PRIMARY: ElevenLabs Conversational AI (same "Gui" agent as the web widget).
//   Secrets in Cloudflare: ELEVENLABS_API_KEY, ELEVENLABS_PHONE_NUMBER_ID
//   (ELEVENLABS_AGENT_ID optional — defaults to the live Gui agent below).
// FALLBACK: Vapi (VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID).
// The caller's context (name/business/industry/need/lang) is passed as dynamic variables so the
// agent greets by name and acts on it — reference {{name}} {{business}} {{need}} in the prompt.
const ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const phone = (body.phone || "").toString().trim();
    if (!phone) return json({ error: "Missing phone" }, 400);

    const vars = {
      name: (body.name || "").toString().slice(0, 120),
      business: (body.business || "").toString().slice(0, 160),
      industry: (body.industry || "").toString().slice(0, 80),
      need: (body.need || "").toString().slice(0, 300),
      lang: (body.lang || "auto").toString().slice(0, 8),
    };

    // ── PRIMARY: ElevenLabs Conversational AI outbound call (via Twilio) ──
    if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_PHONE_NUMBER_ID) {
      const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
        method: "POST",
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: env.ELEVENLABS_AGENT_ID || ELEVEN_AGENT_ID,
          agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID,
          to_number: phone,
          conversation_initiation_client_data: { dynamic_variables: vars },
        }),
      });
      if (!res.ok) return json({ error: "call provider error", detail: (await res.text()).slice(0, 200) }, 502);
      return json({ ok: true, provider: "elevenlabs" });
    }

    // ── FALLBACK: Vapi ──
    if (env.VAPI_API_KEY && env.VAPI_ASSISTANT_ID && env.VAPI_PHONE_NUMBER_ID) {
      const res = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: env.VAPI_ASSISTANT_ID,
          phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
          customer: { number: phone, name: vars.name || undefined },
          assistantOverrides: { variableValues: vars },
        }),
      });
      if (!res.ok) return json({ error: "call provider error" }, 502);
      return json({ ok: true, provider: "vapi" });
    }

    return json({ error: "Outbound calling not configured yet" }, 501);
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
