// functions/lib/naturaSessionToken.js — signs and verifies the Natura channels module's
// session token. Shared by natura-login.js (signs on successful password check) and
// natura-data.js (verifies before returning any CRM table rows) so the two can never drift
// out of sync on the HMAC scheme. Token shape: base64url(email|expMs) + "." + HMAC-SHA256 sig.
const TTL_DAYS = 14;

function b64u(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64u(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad), (c) => c.charCodeAt(0));
}

function sessionSecret(env) {
  return env.INGEST_SECRET || env.NATURA_SUPABASE_SERVICE_ROLE_KEY || "";
}

async function hmac(secret, msg) {
  if (!secret) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}

export async function signNaturaSession(env, email) {
  const secret = sessionSecret(env);
  const exp = Date.now() + TTL_DAYS * 86400000;
  const body = `${email}|${exp}`;
  const sig = await hmac(secret, body);
  return sig ? `${b64u(new TextEncoder().encode(body))}.${sig}` : null;
}

// Returns the verified email on a valid, unexpired token — or null on any failure
// (bad shape, bad signature, expired). Constant-time-ish signature compare.
export async function verifyNaturaSession(env, token) {
  try {
    const secret = sessionSecret(env);
    if (!secret || !token) return null;
    const [bodyB64, sig] = String(token).split(".");
    if (!bodyB64 || !sig) return null;
    const expected = await hmac(secret, new TextDecoder().decode(fromB64u(bodyB64)));
    if (!expected || expected.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return null;
    const body = new TextDecoder().decode(fromB64u(bodyB64));
    const [email, expStr] = body.split("|");
    const exp = Number(expStr);
    if (!email || !Number.isFinite(exp) || Date.now() > exp) return null;
    return email;
  } catch {
    return null;
  }
}
