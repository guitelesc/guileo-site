// Cloudflare Pages Function — POST /api/stripe-connect
// Lets a logged-in client connect THEIR OWN Stripe account (Express) so the Gui charges land in
// their bank, not Guileo's. Gated by the client's connection key (get_client_data binds email↔key).
//   action="link"   → create/get the client's connected account + an onboarding URL → { url }
//   action="status" → refresh + return { connected, charges_enabled, account_id }
// Requires STRIPE_SECRET_KEY (Guileo's platform key) + Connect enabled on the Stripe dashboard.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

async function stripe(env, method, path, body) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "stripe-connect", 20)) return json({ error: "too many requests" }, 429);
    if (!env.STRIPE_SECRET_KEY) return json({ error: "stripe not configured" }, 503);
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    const action = (b.action || "link").toString();
    const ING = env.INGEST_SECRET || "";

    // PER-TENANT GATE — the client must be authenticated with their own connection key.
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    // current connected account (if any)
    let accountId = "";
    try { const lr = await rpc("client_stripe_lookup", { p_secret: ING, p_email: email }); if (lr.ok) { const t = await lr.json(); accountId = (t && t.account_id) || ""; } } catch { /* RPC not pasted yet */ }

    // ── STATUS ──
    if (action === "status") {
      if (!accountId) return json({ ok: true, connected: false, charges_enabled: false });
      const a = await stripe(env, "GET", `accounts/${accountId}`);
      const enabled = !!a.d?.charges_enabled;
      try { await rpc("set_client_stripe", { p_secret: ING, p_email: email, p_account_id: accountId, p_charges_enabled: enabled }); } catch { /* */ }
      return json({ ok: true, connected: enabled, charges_enabled: enabled, account_id: accountId });
    }

    // ── LINK (create account if needed, return onboarding URL) ──
    if (!accountId) {
      const cre = await stripe(env, "POST", "accounts", {
        type: "express",
        email,
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
        "business_profile[name]": (b.business || email.split("@")[0]).toString().slice(0, 120),
      });
      if (!cre.ok || !cre.d?.id) return json({ error: "stripe account create failed — is Connect enabled on the Stripe dashboard?", detail: (cre.d?.error?.message || "").slice(0, 160) }, 502);
      accountId = cre.d.id;
      // MONEY-ROUTING: if the new account isn't persisted, the next "link" call creates a SECOND
      // Express account and the client may onboard onto one we lost track of — charges would then
      // fall back to the owner account. Still return the link (RPC may simply not be pasted yet),
      // but surface the miss in /admin instead of swallowing it. (Check .ok: fetch doesn't throw on non-2xx.)
      try {
        const pr = await rpc("set_client_stripe", { p_secret: ING, p_email: email, p_account_id: accountId, p_charges_enabled: false });
        if (!pr.ok) await emitFailure(env, "stripe_account_not_linked", email, `Express account ${accountId} created but set_client_stripe failed — link manually`, { account_id: accountId });
      } catch { try { await emitFailure(env, "stripe_account_not_linked", email, `Express account ${accountId} created but set_client_stripe threw — link manually`, { account_id: accountId }); } catch { /* */ } }
    }
    const origin = new URL(request.url).origin;
    const linkRes = await stripe(env, "POST", "account_links", {
      account: accountId,
      refresh_url: `${origin}/portal?stripe=refresh`,
      return_url: `${origin}/portal?stripe=connected`,
      type: "account_onboarding",
    });
    if (!linkRes.ok || !linkRes.d?.url) return json({ error: "stripe link failed", detail: (linkRes.d?.error?.message || "").slice(0, 160) }, 502);
    return json({ ok: true, url: linkRes.d.url, account_id: accountId });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
