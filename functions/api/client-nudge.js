// Cloudflare Pages Function — POST /api/client-nudge
// ADMIN-ONLY. Sends a branded product nudge to a CLIENT. Today: the "connect your Stripe" push
// (stripeConnectEmail) so the money Gui collects lands in the client's own account. Same admin gate
// as onboard-client (blitz_stats raises on a wrong token). Branded template only; Resend for delivery.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { stripeConnectEmail } from "../lib/emailTemplates.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "client-nudge", 20)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const kind = (b.kind || "stripe").toString();
    const email = (b.email || "").toString().trim().toLowerCase();
    const lang = (b.lang || "pt").toString();
    // ADMIN gate — same RPC as onboard-client. A wrong token raises → non-200 → 401.
    const gate = await rpc("blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
    if (!gate.ok) return json({ error: "unauthorized" }, 401);
    if (!email.includes("@")) return json({ error: "email inválido" }, 400);
    if (!env.RESEND_API_KEY) return json({ error: "email not configured (set RESEND_API_KEY)" }, 503);

    if (kind !== "stripe") return json({ error: "unknown nudge kind" }, 400);
    const tpl = stripeConnectEmail({ name: (b.name || "").toString().slice(0, 80), business: (b.business || "").toString().slice(0, 120) || "seu negócio", lang });
    const mr = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [email], subject: tpl.subject, html: tpl.html }),
    });
    if (!mr.ok) return json({ error: `email send failed (${mr.status})` }, 503);
    return json({ ok: true, sent: true, to: email, kind, lang });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
