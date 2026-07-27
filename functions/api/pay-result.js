// Cloudflare Pages Function — POST /api/pay-result  → Twilio posts the <Pay> outcome here.
// On success we record the payment to the revenue ledger and confirm to the caller. The card never
// reaches us (Twilio/Stripe tokenized it); we only get a result + a confirmation code.
// SECURITY: verify Twilio's HMAC signature before recording ANY revenue — otherwise anyone could
// POST Result=success&amount=…&client_email=victim to inject fake revenue under any tenant.
import { validTwilioSig } from "../lib/twilioSig.js";
import { emitFailure } from "../lib/failure.js";
const xml = (body) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } });

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const amount = url.searchParams.get("amount") || "0";
  const clientEmail = url.searchParams.get("client_email") || env.OWNER_EMAIL || "clinica@teste.com";
  const business = url.searchParams.get("business") || "your appointment";

  // read the form body once, then verify Twilio's signature over the full URL + sorted params
  let params = new URLSearchParams();
  try { params = new URLSearchParams(await request.text()); } catch { /* */ }
  const sig = request.headers.get("X-Twilio-Signature") || "";
  const verified = await validTwilioSig(request.url, params, sig, env.TWILIO_AUTH_TOKEN || "");

  const result = (params.get("Result") || "").toString();
  const code = (params.get("PaymentConfirmationCode") || params.get("PaymentToken") || "").toString();

  if (result === "success") {
    // record to the revenue ledger ONLY for a verified Twilio callback (best-effort; never block audio)
    if (verified && env.SCHED_SECRET) {
      try {
        const cents = Math.round(parseFloat(String(amount).replace(/[^0-9.]/g, "")) * 100);
        const RSB = "https://ynihodbknhjirkdogxby.supabase.co";
        const RANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
        if (isFinite(cents) && cents > 0) { // guard a garbled amount → never ledger NaN/zero
          // IDEMPOTENCY (money): Twilio retries this callback on non-2xx/timeouts — the card was
          // charged ONCE, so ledger it ONCE. revenue_record_once dedups on the confirmation code /
          // CallSid (db/money_hardening.sql); until pasted it 404s → legacy plain write (unchanged).
          const dedupe = code || `${params.get("CallSid") || ""}:${amount}`;
          const body = { p_secret: env.SCHED_SECRET, p_email: clientEmail, p_category: "phone_payment", p_amount_cents: cents, p_ref: code || null, p_source: "phone", p_meta: { business } };
          let rr = await fetch(`${RSB}/rest/v1/rpc/revenue_record_once`, {
            method: "POST", headers: { apikey: RANON, Authorization: `Bearer ${RANON}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, p_dedupe: dedupe }),
          });
          if (rr.status === 404) rr = await fetch(`${RSB}/rest/v1/rpc/revenue_record`, {
            method: "POST", headers: { apikey: RANON, Authorization: `Bearer ${RANON}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          // the card WAS charged — a dropped ledger write is real money invisible to the client;
          // surface it in /admin instead of swallowing (never block the caller's audio, though).
          if (!rr.ok) await emitFailure(env, "revenue_record_failed", clientEmail, `phone payment $${(cents / 100).toFixed(2)} charged but NOT ledgered`, { code });
        }
      } catch { try { await emitFailure(env, "revenue_record_failed", clientEmail, `phone payment $${amount} charged but ledger write threw`, { code }); } catch { /* */ } }
    } else if (!verified) {
      // Result=success WITHOUT a valid Twilio signature: either a forgery attempt or a REAL charge
      // whose callback we refused to ledger (e.g. proxy mangled the URL). Both deserve eyes — alert,
      // never record. (Best-effort; the caller still hears the confirmation.)
      try { await emitFailure(env, "unverified_pay_callback", clientEmail, `Result=success ($${amount}) with bad/absent Twilio signature — NOT ledgered; verify manually`, { code }); } catch { /* */ }
    }
    return xml(`<Say voice="Polly.Joanna">Your payment went through${code ? `. Your confirmation code is ${code.split("").join(" ")}` : ""}. Thank you! Is there anything else I can help with?</Say>`);
  }
  // failure / decline → hand back gracefully
  return xml(`<Say voice="Polly.Joanna">That card didn't go through. No worries — we can try another card, or I can text you a secure payment link instead.</Say>`);
}
