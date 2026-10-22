// Cloudflare Pages Function — POST /api/billing-portal
// Opens the Stripe Billing Portal for the logged-in REAL client so they can manage
// their own subscription (update card, cancel, view invoices) without leaving Guileo.
//
// Flow: { email, key } → validate the client is real via get_client_data (same gate as
// fetchRealData) → find their Stripe customer by email → create a billing_portal session →
// return { ok:true, url }. Graceful when there's no Stripe customer (paid via a plain
// Payment Link with no saved customer): { ok:false, reason:"no_customer" }.
//
// Never leaks the key. Stripe errors → 502. Missing STRIPE_SECRET_KEY → 501.
import { json, sameOrigin } from "../lib/guard.js";

// Same client-data project + anon key used by fetchRealData / the webhook. PUBLIC by design;
// the per-client `key` in the RPC is what gates the data.
const DATA_SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const DATA_SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// Validate the caller is the real client: get_client_data returns a non-null object (with an
// events array) only when email+key match. Mirrors fetchRealData's success check exactly.
async function isRealClient(email, key) {
  try {
    const r = await fetch(`${DATA_SB_URL}/rest/v1/rpc/get_client_data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: DATA_SB_ANON, Authorization: `Bearer ${DATA_SB_ANON}` },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!r.ok) return false; // includes unauthorized (400/28000) when the key doesn't match
    const data = await r.json();
    return !!(data && typeof data === "object" && Array.isArray(data.events));
  } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // Block off-origin curl/CSRF spam — this is a browser-called endpoint.
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (!env.STRIPE_SECRET_KEY) return json({ error: "not configured" }, 501);

    let body = {};
    try { body = await request.json(); } catch { /* fall through to 400 below */ }
    const email = (body.email || "").toString().trim().toLowerCase();
    const key = (body.key || "").toString().trim();
    if (!email || !key) return json({ error: "missing email or key" }, 400);

    // Gate: only the real client can open their own billing.
    if (!(await isRealClient(email, key))) return json({ error: "unauthorized" }, 401);

    const SK = env.STRIPE_SECRET_KEY;
    const stripeHeaders = { Authorization: `Bearer ${SK}`, "Content-Type": "application/x-www-form-urlencoded" };

    // Find the Stripe customer by email. Prefer the Search API; fall back to list-by-email
    // (Search is eventually-consistent and disabled on some test accounts).
    let customerId = "";
    try {
      const sr = await fetch(`https://api.stripe.com/v1/customers/search?query=${encodeURIComponent(`email:'${email}'`)}`, { headers: stripeHeaders });
      if (sr.ok) {
        const sd = await sr.json();
        customerId = sd?.data?.[0]?.id || "";
      }
      if (!customerId) {
        const lr = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, { headers: stripeHeaders });
        if (!lr.ok) return json({ error: "stripe error" }, 503);
        const ld = await lr.json();
        customerId = ld?.data?.[0]?.id || "";
      }
    } catch { return json({ error: "stripe error" }, 503); }

    // No saved customer (e.g. paid via a plain Payment Link) — handle gracefully, no portal.
    if (!customerId) return json({ ok: false, reason: "no_customer" });

    // Create the billing portal session.
    try {
      const origin = new URL(request.url).origin;
      const form = new URLSearchParams({ customer: customerId, return_url: `${origin}/portal?tab=billing` });
      const pr = await fetch("https://api.stripe.com/v1/billing_portal/sessions", { method: "POST", headers: stripeHeaders, body: form.toString() });
      if (!pr.ok) return json({ error: "stripe error" }, 503);
      const pd = await pr.json();
      if (!pd?.url) return json({ error: "stripe error" }, 503);
      return json({ ok: true, url: pd.url });
    } catch { return json({ error: "stripe error" }, 503); }
  } catch (e) {
    return json({ error: String(e).slice(0, 120) }, 400);
  }
}
