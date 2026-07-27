// Cloudflare Pages Function — GET /api/google-oauth-callback · finish Google Business OAuth
// ─────────────────────────────────────────────────────────────────────────────
// Google redirects the owner back here with ?code&state. We resolve the tenant from `state`
// server-side (gbp_oauth_claim — one-shot, 10-min TTL), exchange the code for a refresh_token
// at Google's token endpoint, best-effort discover the account/location, and store it per-tenant
// via store_integration (provider='google_business'). Then bounce the owner back to the cockpit
// with a status flag. The stored refresh_token is what google-business.js uses to read/reply to
// reviews and post — that whole loop was already built; this closes the "how do we GET the token".
//
// HONEST-INERT: without GOOGLE_BUSINESS_CLIENT_ID/SECRET there's no token exchange to run — we
// bounce back with google=error&reason=api_not_ready rather than pretend. Never fabricates creds.
// ─────────────────────────────────────────────────────────────────────────────
const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));

const REDIRECT_DEFAULT = "https://guileoai.com/api/google-oauth-callback";
const APP = "https://guileoai.com";

// Bounce back to the cockpit with a status the UI can read (?google=connected|error).
const back = (status, reason) => {
  const q = new URLSearchParams({ google: status, ...(reason ? { reason } : {}) });
  return Response.redirect(`${APP}/portal?${q.toString()}`, 302);
};

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const u = new URL(request.url);
    const code = s(u.searchParams.get("code"), 800);
    const state = s(u.searchParams.get("state"), 200);
    const err = s(u.searchParams.get("error"), 120);
    if (err) return back("error", err);                    // user denied / Google error
    if (!code || !state) return back("error", "missing_params");

    // Resolve tenant from state (one-shot). Bad/used/expired → null.
    let email = "";
    try {
      const r = await rpc("gbp_oauth_claim", { p_secret: env.INGEST_SECRET || "", p_state: state });
      if (r.ok) email = s(await r.json(), 160).trim().toLowerCase();
    } catch { /* non-fatal */ }
    if (!email.includes("@")) return back("error", "invalid_state");

    if (!env.GOOGLE_BUSINESS_CLIENT_ID || !env.GOOGLE_BUSINESS_CLIENT_SECRET) return back("error", "api_not_ready");

    // Exchange authorization code → refresh_token.
    const redirectUri = s(env.GOOGLE_BUSINESS_REDIRECT || REDIRECT_DEFAULT, 300);
    let refresh_token = "", access_token = "";
    try {
      const tr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: s(env.GOOGLE_BUSINESS_CLIENT_ID, 300),
          client_secret: s(env.GOOGLE_BUSINESS_CLIENT_SECRET, 300),
          redirect_uri: redirectUri, grant_type: "authorization_code",
        }).toString(),
      });
      const td = await tr.json().catch(() => ({}));
      refresh_token = s(td.refresh_token, 400);
      access_token = s(td.access_token, 800);
    } catch { /* fall through to no_token */ }
    if (!refresh_token) return back("error", "no_refresh_token");

    // Best-effort auto-discover the first account + location (owner can refine later).
    // Non-fatal: if these APIs aren't enabled yet we still store the refresh_token.
    let account_id = "", location_id = "";
    try {
      if (access_token) {
        const ar = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: { Authorization: `Bearer ${access_token}` } });
        const ad = await ar.json().catch(() => ({}));
        const acc = Array.isArray(ad.accounts) && ad.accounts[0] && ad.accounts[0].name; // "accounts/123"
        if (acc) {
          account_id = String(acc).replace(/^accounts\//, "");
          const lr = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${acc}/locations?readMask=name&pageSize=1`, { headers: { Authorization: `Bearer ${access_token}` } });
          const ld = await lr.json().catch(() => ({}));
          const loc = Array.isArray(ld.locations) && ld.locations[0] && ld.locations[0].name; // "locations/456"
          if (loc) location_id = String(loc).replace(/^locations\//, "");
        }
      }
    } catch { /* discovery optional — refresh_token already captured */ }

    try {
      await rpc("store_integration", { p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "google_business", p_tokens: { account_id, location_id, refresh_token } });
    } catch { return back("error", "store_failed"); }

    return back("connected", location_id ? "" : "needs_location");
  } catch (e) { return back("error", s(e, 60).replace(/[^a-z0-9_]/gi, "")); }
}
