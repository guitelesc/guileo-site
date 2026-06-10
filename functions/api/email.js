// Cloudflare Pages Function — POST /api/email → sends a transactional email via Resend.
// Powers welcome emails, new-lead alerts to the owner, and the daily lead digest.
// Set RESEND_API_KEY (and optionally EMAIL_FROM) in Cloudflare Pages env to go live.
// Without a key it no-ops gracefully (returns {ok:false, reason:"no key"}) so nothing breaks.
import { isOwnerEmail } from "../lib/guard.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const to = (body.to || "").toString().trim();
    const subject = (body.subject || "Guileo").toString().slice(0, 200);
    const html = (body.html || body.text || "").toString();
    const text = (body.text || "").toString();
    if (!to || !html) return json({ ok: false, reason: "need to + html" }, 400);
    // SECURITY: this endpoint sends arbitrary HTML — restrict the recipient to the owner so it
    // can never be abused as an open phishing/spam relay from noreply@guileoai.com.
    if (!isOwnerEmail(to, env)) return json({ ok: false, reason: "recipient not allowed" }, 403);

    const KEY = env.RESEND_API_KEY;
    // Default to Resend's instant test sender so it works before guileoai.com is DNS-verified.
    // Once the domain is verified, set EMAIL_FROM=Guileo <noreply@guileoai.com> in Cloudflare.
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    if (!KEY) return json({ ok: false, reason: "no key" }); // not configured yet — graceful

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(text ? { text } : {}) }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, error: data?.message || data?.name || `HTTP ${r.status}`, from: FROM }, 200);
    return json({ ok: true, id: data?.id || null });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}

export async function onRequestOptions() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
