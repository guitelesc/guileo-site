// functions/lib/guard.js — lightweight abuse guards for public Cloudflare Pages Functions.
// Two layers: (1) sameOrigin() blocks external CSRF/curl spam on browser-called endpoints;
// (2) ownerOnly() restricts email recipients to the account owner so endpoints can't be
// abused as an open relay to attacker-chosen victims.

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
  const set = new Set(["smart@guileoai.com", "luistelesc@gmail.com"]);
  if (env && env.OWNER_EMAIL) env.OWNER_EMAIL.split(",").forEach((e) => set.add(e.trim().toLowerCase()));
  return set;
}
export function isOwnerEmail(to, env) {
  return ownerEmails(env).has((to || "").trim().toLowerCase());
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
export const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
