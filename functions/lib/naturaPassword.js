// functions/lib/naturaPassword.js — password hashing for the Natura channels module login.
// PBKDF2-SHA256 via Web Crypto (crypto.subtle) — works identically in Cloudflare Workers
// (this function's real runtime) and in Node (via crypto.webcrypto, used by the seed script),
// so the hash produced by the seed script always verifies correctly here. No npm dependency.
const ITERATIONS = 100000;
const KEYLEN = 32; // bytes

function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function deriveBits(subtle, password, salt) {
  const keyMaterial = await subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  return subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, keyMaterial, KEYLEN * 8);
}

// Returns a self-contained hash string: "pbkdf2$<iterations>$<salt-b64>$<hash-b64>"
export async function hashPassword(password, subtleImpl) {
  const subtle = subtleImpl || crypto.subtle;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(subtle, password, salt);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

// Constant-time-ish compare of a candidate password against a stored hash string.
export async function verifyPassword(password, storedHash, subtleImpl) {
  try {
    const subtle = subtleImpl || crypto.subtle;
    const [scheme, iterStr, saltB64, hashB64] = String(storedHash || "").split("$");
    if (scheme !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
    const salt = fromB64(saltB64);
    const expected = fromB64(hashB64);
    const keyMaterial = await subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
    const bits = new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", salt, iterations: Number(iterStr), hash: "SHA-256" }, keyMaterial, expected.length * 8));
    if (bits.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
