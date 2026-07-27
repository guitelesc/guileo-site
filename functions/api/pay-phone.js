// Cloudflare Pages Function — GET/POST /api/pay-phone  → returns TwiML <Pay> (T-Mobile-style phone payment)
// The caller types their card on the KEYPAD; digits go straight to Twilio → Stripe Pay Connector and
// are tokenized/charged. The Gui (and the call recording) NEVER hear or store the card = PCI-compliant.
// SECURITY: POST callbacks are verified against Twilio's HMAC signature so this can't be driven as an
// open TwiML relay with attacker-controlled amount/business.
//
// PREREQ in the Twilio Console (one-time, owner-side):
//   1) Voice → Settings → General → Enable PCI Mode  (⚠️ irreversible; recommend a SEPARATE Twilio
//      subaccount for payments so it doesn't redact your main account's logs).
//   2) Install the Stripe Pay Connector (Voice → Pay Connectors) — name it "Default" (or set PAY_CONNECTOR).
// Then point a Twilio number's voice webhook here, OR have the Gui agent transfer the call to that number.
//   /api/pay-phone?amount=49.90&business=Clinica&client_email=clinica@x.com
import { validTwilioSig } from "../lib/twilioSig.js";
const xml = (body) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } });
const escx = (s) => String(s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

async function handle(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let amount = url.searchParams.get("amount") || "";
  let business = url.searchParams.get("business") || "your appointment";
  let clientEmail = url.searchParams.get("client_email") || "";
  // also accept POST body params (Twilio posts form-encoded) — verify the Twilio signature first.
  if (request.method === "POST") {
    let params = new URLSearchParams();
    try { params = new URLSearchParams(await request.text()); } catch { /* */ }
    const sig = request.headers.get("X-Twilio-Signature") || "";
    if (!(await validTwilioSig(request.url, params, sig, env.TWILIO_AUTH_TOKEN || ""))) {
      return xml(`<Say voice="Polly.Joanna">Sorry, I can't process that right now.</Say><Hangup/>`);
    }
    amount = amount || params.get("amount") || "";
    business = params.get("business") || business;
    clientEmail = clientEmail || params.get("client_email") || "";
  }
  const amt = (parseFloat(String(amount).replace(/[^0-9.]/g, "")) || 0).toFixed(2);
  if (!(amt > 0)) return xml(`<Say voice="Polly.Joanna">Sorry, I don't have a valid amount to charge. Let me get someone to help you.</Say>`);

  const connector = env.PAY_CONNECTOR || "Default";
  const action = `${url.origin}/api/pay-result?amount=${amt}&client_email=${encodeURIComponent(clientEmail)}&business=${encodeURIComponent(business)}`;
  // <Pay> drives the secure keypad capture (card, expiry, CVV, zip) and charges via the Stripe connector.
  return xml(
    `<Say voice="Polly.Joanna">To pay ${amt} dollars for ${escx(business)}, please enter your card details on your phone keypad. Your card is handled securely — I never see or hear the numbers.</Say>` +
    `<Pay chargeAmount="${amt}" currency="usd" paymentConnector="${escx(connector)}" action="${escx(action)}" />`
  );
}
export const onRequestGet = handle;
export const onRequestPost = handle;
