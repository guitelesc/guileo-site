// Cloudflare Pages Function — POST /api/call → triggers a Vapi outbound call.
// Configure secrets in Cloudflare: VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { name, phone } = await request.json();
    if (!phone) return json({ error: "Missing phone" }, 400);
    if (!env.VAPI_API_KEY || !env.VAPI_ASSISTANT_ID || !env.VAPI_PHONE_NUMBER_ID) {
      return json({ error: "Outbound calling not configured yet" }, 501);
    }
    const res = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId: env.VAPI_ASSISTANT_ID,
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        customer: { number: phone, name: name || undefined },
      }),
    });
    if (!res.ok) return json({ error: "call provider error" }, 502);
    return json({ ok: true });
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
