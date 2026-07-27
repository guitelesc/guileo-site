// Twilio request-signature validation (HMAC-SHA1 over the full URL + sorted POST params,
// base64). Twilio signs the exact URL it was configured to POST to (including query string)
// concatenated with each POST param key+value in alphabetical order. Reject on mismatch so
// nobody can forge a <Pay> result (fake revenue) or drive arbitrary TwiML.
// Docs: https://www.twilio.com/docs/usage/security#validating-requests
export async function validTwilioSig(url, params, sig, token) {
  if (!sig || !token) return false;
  let data = url;
  [...params.keys()].sort().forEach((k) => { data += k + params.get(k); });
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(mac))) === sig;
}
