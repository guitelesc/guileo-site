// Cloudflare Pages Function — POST /api/nurture → sends one branded nurture email by `step`.
// One dispatcher for the whole drip + the /admin 1-click buttons.
// Body: { to, name, business, lang, step }  · step ∈ welcome | proof | proposal | reengage
import { welcomeEmail, proofEmail, proposalEmail, reengageEmail } from "../lib/emailTemplates.js";
import { sameOrigin } from "../lib/guard.js";

const STEPS = { welcome: welcomeEmail, proof: proofEmail, proposal: proposalEmail, reengage: reengageEmail };

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // SECURITY: only our own site (portal/admin) may trigger branded nurture mail.
    if (!sameOrigin(request)) return json({ ok: false, reason: "forbidden" }, 403);
    const b = await request.json();
    const to = (b.to || "").toString().trim();
    if (!to.includes("@")) return json({ ok: false, reason: "need a valid email" }, 400);
    const step = STEPS[b.step] ? b.step : "welcome";
    const { subject, html } = STEPS[step]({
      name: (b.name || "there").toString().slice(0, 80),
      business: (b.business || "your business").toString().slice(0, 120),
      lang: b.lang === "pt" ? "pt" : "en",
    });
    const KEY = env.RESEND_API_KEY;
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    if (!KEY) return json({ ok: false, reason: "no key" });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    const data = await r.json().catch(() => ({}));
    return json(r.ok ? { ok: true, step, id: data?.id || null } : { ok: false, error: data?.message || `HTTP ${r.status}` });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
export async function onRequestOptions() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
}
