// functions/lib/unsub.js — one-click email unsubscribe tokens (CAN-SPAM).
// A tamper-proof, per-(client,contact) token so an unsubscribe link can't be forged to opt out a
// third party or enumerate contacts. HMAC-SHA256(client|contact) keyed by the server secret →
// truncated hex. Deterministic (same link every send) + verifiable server-side, nothing stored.
const enc = new TextEncoder();

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The secret keys the token. INGEST_SECRET is server-held (the campaign gate). FAIL CLOSED if it's
// absent (adversarial review 2026-07-30): NEVER fall back to a committed literal — a repo reader could
// then forge tokens and grief a business's suppression list. No secret → no token → link is inert.
const keyOf = (env) => (env && env.INGEST_SECRET) || "";

// 20-hex-char token for (client, contact). Lowercased inputs so the link is stable regardless of case.
export async function unsubToken(env, client, contact) {
  const key = keyOf(env);
  const c = String(client || "").trim().toLowerCase();
  const e = String(contact || "").trim().toLowerCase();
  if (!key || !c || !e) return "";
  return (await hmacHex(key, `${c}|${e}`)).slice(0, 20);
}

// Constant-time-ish compare + verify a presented token.
export async function unsubVerify(env, client, contact, token) {
  const want = await unsubToken(env, client, contact);
  const got = String(token || "").trim().toLowerCase();
  if (!want || want.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

// Build the public unsubscribe URL for an email footer.
export async function unsubUrl(env, base, client, contact) {
  const t = await unsubToken(env, client, contact);
  const b = (base || "https://guileoai.com").replace(/\/$/, "");
  return `${b}/api/unsubscribe?c=${encodeURIComponent(String(client).toLowerCase())}&e=${encodeURIComponent(String(contact).toLowerCase())}&t=${t}`;
}
