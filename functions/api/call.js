// Cloudflare Pages Function — POST /api/call → triggers a Vapi outbound call.
// Configure secrets in Cloudflare: VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID
// The business context (name/business/industry/need/lang) is forwarded so the Vapi assistant
// can greet by name and act on it — reference {{name}} {{business}} {{industry}} {{need}} in the
// assistant's system prompt (assistantOverrides.variableValues).
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const phone = (body.phone || "").toString().trim();
    if (!phone) return json({ error: "Missing phone" }, 400);
    if (!env.VAPI_API_KEY || !env.VAPI_ASSISTANT_ID || !env.VAPI_PHONE_NUMBER_ID) {
      return json({ error: "Outbound calling not configured yet" }, 501);
    }
    const ctx = {
      name: (body.name || "").toString().slice(0, 120),
      business: (body.business || "").toString().slice(0, 160),
      industry: (body.industry || "").toString().slice(0, 80),
      need: (body.need || "").toString().slice(0, 300),
      lang: (body.lang || "auto").toString().slice(0, 8),
    };
    const res = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId: env.VAPI_ASSISTANT_ID,
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: { number: phone, name: ctx.name || undefined },
        // pass context to the assistant prompt + keep it on the call record
        assistantOverrides: { variableValues: ctx },
        metadata: { source: (body.source || "website").toString().slice(0, 60), ...ctx },
      }),
    });
    if (!res.ok) return json({ error: "call provider error" }, 502);
    return json({ ok: true });
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
