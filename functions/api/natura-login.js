// Cloudflare Pages Function — POST /api/natura-login
// Server-side login for the Natura channels module (/natura). Verifies email+password
// against the `users` table in the SEPARATE Natura Supabase project (NATURA_SUPABASE_URL),
// using the service_role key — which stays server-side here and is NEVER sent to the browser.
// On success returns a signed session token (same HMAC pattern as sellerSession.js) that the
// frontend stores and the module checks client-side; no password or hash ever reaches the browser.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { verifyPassword } from "../lib/naturaPassword.js";
import { signNaturaSession } from "../lib/naturaSessionToken.js";

// Local-dev-only origin check, scoped to THIS endpoint alone — never touches the shared
// sameOrigin() in guard.js (70+ other endpoints call that with production-only origins and
// must never be relaxed). Gate is the REQUEST's own origin/host being localhost, not an env
// flag — `wrangler pages dev` sets env.CF_PAGES="1" even locally, so that can't be the signal.
// A request can only claim an Origin of http://127.0.0.1:8788 by literally being sent to (and
// thus already running on) that local machine, so this can't be spoofed into opening prod up.
function sameOriginOrLocalDev(request) {
  if (sameOrigin(request)) return true;
  const o = request.headers.get("Origin") || request.headers.get("Referer") || "";
  const host = new URL(request.url).hostname;
  const isLocalHost = host === "127.0.0.1" || host === "localhost";
  if (!isLocalHost) return false;
  try { return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(o); } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOriginOrLocalDev(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "natura-login", 12)) return json({ error: "too many attempts" }, 429);

    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").toString().trim().toLowerCase();
    const password = (body.password || "").toString();
    if (!email || !password) return json({ error: "missing" }, 400);

    const SB_URL = env.NATURA_SUPABASE_URL;
    const SB_SERVICE_KEY = env.NATURA_SUPABASE_SERVICE_ROLE_KEY;
    if (!SB_URL || !SB_SERVICE_KEY) return json({ error: "not_configured" }, 503);

    const r = await fetch(`${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,email,password_hash,full_name`, {
      headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}` },
    });
    if (!r.ok) return json({ error: "lookup_failed" }, 502);
    const rows = await r.json().catch(() => []);
    const user = Array.isArray(rows) ? rows[0] : null;
    if (!user || !user.password_hash) return json({ ok: false, error: "invalid" }, 401);

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return json({ ok: false, error: "invalid" }, 401);

    const sid = await signNaturaSession(env, user.email);
    return json({ ok: true, user: { email: user.email, name: user.full_name || user.email, sid } });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
