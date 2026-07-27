// Cloudflare Pages Function — POST /api/pay-link
// Generates a Mercado Pago (Brazil) checkout link (PIX + card) for a deal, server-side, so the
// MERCADOPAGO_TOKEN secret never leaves the server. Admin-token gated. Returns { url } to paste into
// a proposal's ?pay= or hand to a BR client. US deals keep using Stripe Payment Links as before.
//   POST { token: <admin>, amount: <BRL number>, description?, payer_email?, tenant?, plan? } -> { ok, url, id }
// When tenant (the client email getting credits) is supplied, we stamp external_reference="tenant|plan"
// and a notification_url → /api/mercadopago-webhook, so the approved payment credits the RIGHT tenant,
// amount-anchored, with no manual step (mirror of the Stripe plan flow). See mercadopago-webhook.js.
import { json } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json();
    // AUTH FIRST — only the owner (admin token) may mint payment links.
    const vr = await rpc("blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);
    if (!env.MERCADOPAGO_TOKEN) return json({ error: "PIX not configured — set MERCADOPAGO_TOKEN in Cloudflare" }, 503);

    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "a valid BRL amount is required" }, 400);
    // 2.16 — cap so a typo/abuse can't mint a huge charge link (admin-gated, but defense-in-depth)
    const MAX = Number(env.MAX_CHARGE_BRL) || 100000;
    if (amount > MAX) return json({ error: `amount exceeds the ${MAX} cap` }, 400);
    const title = (b.description || "Guileo — pacote").toString().slice(0, 200);
    // Tenant binding — the client email that must receive the credits (authoritative in the webhook,
    // never a bare id). Optional plan label rides along so the webhook can name the plan. Only a valid
    // email is bound; a garbage value is dropped rather than stamped (the webhook then anchors by amount).
    const tenant = (b.tenant || b.client_email || "").toString().trim().toLowerCase();
    const plan = (b.plan || "").toString().trim().slice(0, 60);
    const externalRef = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenant) ? `${tenant}${plan ? "|" + plan : ""}` : "";

    // Mercado Pago Checkout Pro: create a preference → returns init_point (the hosted checkout URL where
    // the customer pays by PIX or card). currency BRL.
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.MERCADOPAGO_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title, quantity: 1, unit_price: amount, currency_id: "BRL" }],
        ...(b.payer_email ? { payer: { email: b.payer_email.toString().slice(0, 160) } } : {}),
        ...(externalRef ? { external_reference: externalRef, notification_url: "https://guileoai.com/api/mercadopago-webhook" } : {}),
        back_urls: { success: "https://guileoai.com/portal", pending: "https://guileoai.com", failure: "https://guileoai.com" },
        statement_descriptor: "GUILEO",
      }),
    });
    if (!res.ok) return json({ error: `mercadopago ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` }, 502);
    const d = await res.json().catch(() => ({}));
    return json({ ok: true, url: d.init_point || d.sandbox_init_point || "", id: d.id || "" });
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
