// functions/lib/guard.js — lightweight abuse guards for public Cloudflare Pages Functions.
// Two layers: (1) sameOrigin() blocks external CSRF/curl spam on browser-called endpoints;
// (2) ownerOnly() restricts email recipients to the account owner so endpoints can't be
// abused as an open relay to attacker-chosen victims.

// Constant-time string compare for secrets/tokens/signatures — avoids leaking length-prefix
// info via early-exit timing. Returns true only when both are non-empty and equal.
export function safeEq(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const ALLOWED_ORIGINS = ["https://guileoai.com", "https://www.guileoai.com"];
const okOrigin = (u) => ALLOWED_ORIGINS.includes(u) || /^https:\/\/[a-z0-9-]+\.guileoai\.pages\.dev$/.test(u);

// True only when the request carries an Origin/Referer from our own site. Browsers always send
// Origin on POST fetch, so legit client calls pass; a header-less curl from an attacker is blocked.
export function sameOrigin(request) {
  const o = request.headers.get("Origin") || "";
  if (o) return okOrigin(o);
  const ref = request.headers.get("Referer") || "";
  if (ref) { try { return okOrigin(new URL(ref).origin); } catch { return false; } }
  return false;
}

// The owner's known inboxes. Email-sending endpoints may only deliver here (or to env override),
// so they can never be turned into a phishing relay to arbitrary recipients.
export function ownerEmails(env) {
  const set = new Set([
    "smart@guileoai.com", "luistelesc@gmail.com",
    // TEAM — recipients Luis explicitly authorized (Growth Partners onboarding):
    "horjanapatricia8@gmail.com",
  ]);
  if (env && env.OWNER_EMAIL) env.OWNER_EMAIL.split(",").forEach((e) => set.add(e.trim().toLowerCase()));
  return set;
}
export function isOwnerEmail(to, env) {
  return ownerEmails(env).has((to || "").trim().toLowerCase());
}

// Per-IP fixed-window rate limiter on Cloudflare KV (binding RATE_LIMIT in wrangler.toml).
// FAIL-OPEN by default: if KV isn't bound or errors, the request proceeds — abuse braking
// must never break a real customer. Window buckets self-expire via TTL.
// failClosed=true flips that for costly endpoints (e.g. paid outbound calls): a missing or
// erroring KV then DENIES (returns true) so the limiter can't be bypassed by knocking out KV.
export async function rateLimited(request, env, route, limit, windowSec = 60, failClosed = false) {
  try {
    const kv = env && env.RATE_LIMIT;
    if (!kv) return failClosed;
    const ip = request.headers.get("CF-Connecting-IP") || "noip";
    const bucket = Math.floor(Date.now() / (windowSec * 1000));
    const key = `rl:${route}:${ip}:${bucket}`;
    const n = parseInt((await kv.get(key)) || "0", 10) + 1;
    if (n > limit) return true;
    await kv.put(key, String(n), { expirationTtl: windowSec * 2 });
    return false;
  } catch { return failClosed; }
}

// SECURITY: Cloudflare Pages `_headers` does NOT apply to Function responses, so API responses
// must carry their own hardening headers. nosniff stops MIME confusion; no-store keeps PII-bearing
// JSON out of shared caches.
export const apiSecurityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};
export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...apiSecurityHeaders } });
export const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", ...apiSecurityHeaders };
