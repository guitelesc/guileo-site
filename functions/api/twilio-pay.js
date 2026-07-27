// Cloudflare Pages Function — POST /api/twilio-pay  (TWILIO PAY · pay-by-voice on the call)
// Secure PCI-compliant card capture DURING a phone call using Twilio's <Pay> verb. The caller reads
// their card by voice/keypad; Twilio (not us) captures it and charges via a Pay Connector you configure
// in the Twilio Console (connected to Stripe). Card data NEVER touches our servers.
//
// TWO entry points (both signed by Twilio):
//   1) GET/POST ?amount=20.00&desc=...   → returns the <Pay> TwiML that runs the secure capture.
//   2) POST (Pay action callback)        → Twilio posts the result here (Result=success + a token/charge);
//      we log the revenue + thank the caller. On failure we apologize and offer a text link instead.
//
// SETUP (your side — see db/twilio_pay_setup.md): enable Pay in the Twilio Console, create a Pay Connector
// backed by Stripe, set TWILIO_PAY_CONNECTOR to its unique name. Until then this returns a graceful fallback.
import { json } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const xml = (body) => new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`,
  { status: 200, headers: { "Content-Type": "text/xml", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

// Twilio request validation: HMAC-SHA1(url + sorted params, AUTH_TOKEN) base64 == X-Twilio-Signature
async function validTwilioSig(url, params, sig, token) {
  if (!sig || !token) return false;
  let data = url;
  [...params.keys()].sort().forEach((k) => { data += k + params.get(k); });
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(mac))) === sig;
}

async function handle(context) {
  const { request, env } = context;
  try {
    if (!env.TWILIO_AUTH_TOKEN) return xml(`<Response><Say>Payment is not configured yet.</Say><Hangup/></Response>`);
    const u = new URL(request.url);
    // Twilio signs the EXACT action URL it hit — including the ?amount&client query on the <Pay> result
    // callback. Validating against the bare base (no query) made the result HMAC never match → the card
    // was charged but nothing ledgered (silent). Reconstruct the canonical signed URL: fixed host + query.
    const url = "https://guileoai.com/api/twilio-pay" + (u.search || "");
    let params;
    if (request.method === "POST") {
      const raw = await request.text();
      params = new URLSearchParams(raw);
      const sig = request.headers.get("X-Twilio-Signature") || "";
      if (!(await validTwilioSig(url, params, sig, env.TWILIO_AUTH_TOKEN))) return xml(`<Response><Hangup/></Response>`);
    } else {
      params = u.searchParams;
    }

    // RESULT callback: Twilio posts Result + (on success) PaymentConfirmationCode / a charge token.
    // SECURITY (money): only honor a Result via POST — the POST path above is the ONLY one that
    // verified the Twilio signature. Before this, GET ?Result=success&ChargeAmount=…&client=victim
    // could inject fake revenue under any tenant with zero auth.
    const result = request.method === "POST" ? params.get("Result") : null;
    if (result) {
      const ok = result === "success";
      const email = (params.get("client") || env.OWNER_EMAIL || "smart@guileoai.com").toString().toLowerCase();
      const amount = params.get("ChargeAmount") || u.searchParams.get("amount") || "";
      const ref = params.get("PaymentConfirmationCode") || params.get("PaymentToken") || "";
      // Log to the revenue ledger so a voice-captured payment shows in the Cockpit like any other.
      if (ok && amount && env.SCHED_SECRET) {
        try {
          const cents = Math.round(parseFloat(String(amount).replace(/[^0-9.]/g, "")) * 100);
          if (isFinite(cents) && cents > 0) {
            // IDEMPOTENCY (money): Twilio retries this callback on non-2xx/timeouts — the card was
            // charged ONCE, so it must be ledgered ONCE. revenue_record_once dedups on the charge's
            // confirmation code / CallSid (db/money_hardening.sql); until that SQL is pasted it 404s
            // and we fall back to the legacy plain write (same behavior as before).
            const dedupe = ref || `${params.get("CallSid") || ""}:${amount}`;
            const body = { p_secret: env.SCHED_SECRET, p_email: email, p_category: "voice_pay", p_amount_cents: cents, p_ref: ref || null, p_source: "gui-voice-pay", p_meta: { channel: "voice" } };
            let rr = await fetch(`${SB_URL}/rest/v1/rpc/revenue_record_once`, {
              method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
              body: JSON.stringify({ ...body, p_dedupe: dedupe }),
            });
            if (rr.status === 404) rr = await fetch(`${SB_URL}/rest/v1/rpc/revenue_record`, {
              method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            // the caller's card WAS charged — a dropped ledger write is real money invisible to the
            // client, so surface it in /admin instead of swallowing it.
            if (!rr.ok) await emitFailure(env, "revenue_record_failed", email, `voice payment $${(cents / 100).toFixed(2)} charged but NOT ledgered`, { ref });
          }
        } catch { try { await emitFailure(env, "revenue_record_failed", email, `voice payment $${amount} charged but ledger write threw`, { ref }); } catch { /* */ } }
      }
      return xml(ok
        ? `<Response><Say voice="alice">Thank you — your payment went through. You're all set.</Say><Hangup/></Response>`
        : `<Response><Say voice="alice">That card didn't go through. No worries — I'll text you a secure link to pay instead.</Say><Hangup/></Response>`);
    }

    // ENTRY: build the <Pay> capture. Amount comes from the query (?amount=) OR — when the AI transferred
    // the call here — from the stash the agent saved keyed by the caller's number (vpay:<From> in KV).
    let amount = (u.searchParams.get("amount") || "").replace(/[^0-9.]/g, "");
    let desc = (u.searchParams.get("desc") || "Payment").toString().slice(0, 80).replace(/[<>&]/g, "");
    let client = (u.searchParams.get("client") || "").toString().slice(0, 120);
    if (!amount) {
      const from = (params.get("From") || "").replace(/[^0-9+]/g, "");
      if (from && env.RATE_LIMIT) {
        try {
          const raw = await env.RATE_LIMIT.get(`vpay:${from}`);
          if (raw) { const v = JSON.parse(raw); amount = String(v.amount || "").replace(/[^0-9.]/g, ""); client = v.tenant || client; desc = v.desc || desc; }
        } catch { /* no stash → fall through to fallback */ }
      }
    }
    // AMOUNT INTEGRITY: this path charges a REAL card immediately — bound the amount server-side
    // (Stripe min ~$0.50; ceiling matches the pay-link cap) so a garbled/absurd stashed amount can
    // never hit a caller's card. Out of bounds → same graceful SMS-link fallback, nothing charges.
    const amtNum = parseFloat(amount);
    const MAX_USD = Number(env.MAX_CHARGE_USD) || 100000;
    if (!isFinite(amtNum) || amtNum < 0.5 || amtNum > MAX_USD) amount = "";
    // Needs a configured connector AND a known amount — else gracefully fall back to the SMS link path.
    if (!env.TWILIO_PAY_CONNECTOR || !amount) {
      return xml(`<Response><Say voice="alice">I'll text you a secure link to pay. One moment.</Say><Hangup/></Response>`);
    }
    const actionUrl = `${url}?amount=${encodeURIComponent(amount)}${client ? `&client=${encodeURIComponent(client)}` : ""}`;
    // <Pay> captures the card securely and tokenizes/charges via the connector. tokenType="one-time" charges now.
    return xml(
      `<Response>` +
      `<Pay chargeAmount="${amount}" currency="usd" paymentConnector="${env.TWILIO_PAY_CONNECTOR}" tokenType="one-time" ` +
      `action="${actionUrl}" description="${desc}" timeout="8" maxAttempts="2">` +
      `<Prompt for="payment-card-number"><Say>Please enter or say your card number.</Say></Prompt>` +
      `</Pay>` +
      `</Response>`
    );
  } catch {
    return xml(`<Response><Hangup/></Response>`);
  }
}

export const onRequestPost = handle;
export const onRequestGet = handle;
