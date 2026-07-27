// ─────────────────────────────────────────────────────────────────────────────
// Guileo — SERVER-SIDE conversions API (Meta CAPI + GA4 Measurement Protocol)
//
// WHY THIS EXISTS
// ───────────────
// Browser pixels get blocked (ad-blockers, ITP, iOS). A server copy of each
// conversion — sent with the SAME event_id as the browser event — lets Meta/GA4
// COLLAPSE the two into one (dedup) so we lose zero conversions without ever
// double-counting. Two callers:
//   • functions/api/track.js  — mirrors a browser event (Lead / InitiateCheckout /
//     Contact / StartDemo). event_id = the uuid the client-side track() returned.
//   • stripe-webhook.js        — reportPurchase() on a real paid checkout. The
//     browser InitiateCheckout already fired with its own id; the PURCHASE itself
//     has no browser event (money clears server-side), so event_id = Stripe
//     session id — stable + unique, safe if Stripe retries the webhook.
//
// HONESTY / INERT-BY-DEFAULT
// ──────────────────────────
// NOTHING here calls out unless the matching SERVER env is set. IDs are public and
// may live in the client bundle; these TOKENS are secrets and live ONLY server-side
// in Cloudflare env — never import.meta.env, never the bundle:
//   • META_PIXEL_ID + META_CAPI_TOKEN   → Meta Conversions API
//   • GA4_ID        + GA4_API_SECRET    → GA4 Measurement Protocol
// Missing either half of a pair ⇒ that platform is skipped (returns {sent:false}).
// Every call is best-effort and never throws into the caller — a tracking miss must
// never break a lead capture or a Stripe credit.
// ─────────────────────────────────────────────────────────────────────────────

const META_API_VERSION = "v19.0";

// Map our canonical event names → the name each platform expects.
// Meta uses TitleCase standard events (Lead/InitiateCheckout/Contact/Purchase);
// StartDemo is a custom event (Meta accepts custom names verbatim).
// GA4 wants snake_case recommended events; unknown names pass through lowercased.
const GA4_EVENT_MAP = {
  Lead: "generate_lead",
  InitiateCheckout: "begin_checkout",
  Contact: "contact",
  Purchase: "purchase",
  StartDemo: "start_demo",
  PageView: "page_view",
};

// SHA-256 hex of a normalized string (trim + lowercase), the exact shape Meta wants
// for hashed PII (em/ph). Returns "" for empty input so we simply omit the field.
export async function sha256Hex(input) {
  const s = (input == null ? "" : String(input)).trim().toLowerCase();
  if (!s) return "";
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return ""; // no WebCrypto (shouldn't happen on Workers) → omit the hash, still send
  }
}

// Coerce a possibly-hashed / possibly-raw email into a Meta-ready SHA-256 hex.
// A 64-char hex string is assumed already hashed and passed through untouched.
async function emailHash(emailOrHash) {
  const v = (emailOrHash == null ? "" : String(emailOrHash)).trim();
  if (!v) return "";
  if (/^[a-f0-9]{64}$/i.test(v)) return v.toLowerCase();
  return sha256Hex(v);
}

// ── Meta Conversions API ─────────────────────────────────────────────────────
/**
 * sendMetaCAPI(env, payload) — POST one event to the Meta Conversions API.
 * payload: {
 *   event,               // canonical name (Lead / InitiateCheckout / Contact / Purchase / StartDemo)
 *   event_id,            // SAME id as the browser event → CAPI dedup
 *   email_hash,          // SHA-256 hex OR a raw email (auto-hashed); optional
 *   value, currency,     // optional conversion value
 *   event_source_url,    // page URL the event happened on (optional)
 *   client_ip, client_ua,// from the incoming request headers → better match rate (optional)
 *   fbc, fbp,            // Meta click/browser cookies if available (optional)
 *   test_event_code,     // Meta Events Manager "Test events" code (optional; only when debugging)
 * }
 * Inert (returns {sent:false, skipped:"no-env"}) unless BOTH META_PIXEL_ID and
 * META_CAPI_TOKEN are set. Never throws.
 */
export async function sendMetaCAPI(env, payload = {}) {
  const pixelId = env.META_PIXEL_ID || "";
  const token = env.META_CAPI_TOKEN || "";
  if (!pixelId || !token) return { sent: false, skipped: "no-env" };
  try {
    const em = await emailHash(payload.email_hash);
    const user_data = {};
    if (em) user_data.em = [em];
    if (payload.client_ip) user_data.client_ip_address = String(payload.client_ip);
    if (payload.client_ua) user_data.client_user_agent = String(payload.client_ua);
    if (payload.fbc) user_data.fbc = String(payload.fbc);
    if (payload.fbp) user_data.fbp = String(payload.fbp);

    const custom_data = {};
    if (payload.value != null && Number.isFinite(Number(payload.value))) {
      custom_data.value = Number(payload.value);
      custom_data.currency = (payload.currency || "USD").toString().toUpperCase();
    }
    if (payload.plan) custom_data.content_name = String(payload.plan).slice(0, 120);

    const evt = {
      event_name: payload.event || "Lead",
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data,
    };
    if (payload.event_id) evt.event_id = String(payload.event_id);
    if (payload.event_source_url) evt.event_source_url = String(payload.event_source_url).slice(0, 1000);
    if (Object.keys(custom_data).length) evt.custom_data = custom_data;

    const body = { data: [evt] };
    if (payload.test_event_code) body.test_event_code = String(payload.test_event_code);

    const url = `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { sent: r.ok, status: r.status };
  } catch (e) {
    return { sent: false, error: String(e && e.message || e) };
  }
}

// ── GA4 Measurement Protocol ─────────────────────────────────────────────────
/**
 * sendGA4(env, payload) — POST one event to GA4 via the Measurement Protocol.
 * payload: { event, event_id, value, currency, client_id, event_source_url, plan }
 * client_id: GA's _ga cookie client id when we have it; else we synthesize one from
 * event_id so the hit is still accepted (a real _ga id gives better session stitching).
 * Inert (returns {sent:false, skipped:"no-env"}) unless BOTH GA4_ID and
 * GA4_API_SECRET are set. Never throws.
 */
export async function sendGA4(env, payload = {}) {
  const measurementId = env.GA4_ID || "";
  const apiSecret = env.GA4_API_SECRET || "";
  if (!measurementId || !apiSecret) return { sent: false, skipped: "no-env" };
  try {
    const name = GA4_EVENT_MAP[payload.event] || String(payload.event || "lead").toLowerCase();
    const params = {};
    // GA4 dedups PURCHASES by transaction_id (the event_id param is Meta-only) — without
    // this a Stripe webhook retry would double-count revenue in GA4.
    if (name === "purchase" && payload.event_id) params.transaction_id = String(payload.event_id);
    if (payload.value != null && Number.isFinite(Number(payload.value))) {
      params.value = Number(payload.value);
      params.currency = (payload.currency || "USD").toString().toUpperCase();
    }
    if (payload.plan) params.items = [{ item_name: String(payload.plan).slice(0, 120) }];
    if (payload.event_id) params.event_id = String(payload.event_id); // dedup hint
    if (payload.event_source_url) params.page_location = String(payload.event_source_url).slice(0, 1000);

    // GA4 needs a stable client_id; fall back to a deterministic one from event_id so
    // retries (Stripe) map to the same pseudo-user instead of minting a new one each time.
    const client_id = (payload.client_id || "").toString() || ga4ClientIdFrom(payload.event_id);
    const body = { client_id, events: [{ name, params }] };

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // GA4 MP returns 204 on success (no body); treat any 2xx as sent.
    return { sent: r.ok, status: r.status };
  } catch (e) {
    return { sent: false, error: String(e && e.message || e) };
  }
}

// GA4 client_id is "<random>.<timestamp>". Derive a stable one from an id when we
// have no _ga cookie, so the same conversion never counts as two users on retry.
function ga4ClientIdFrom(seed) {
  const s = (seed == null ? "" : String(seed)).replace(/[^0-9]/g, "").slice(0, 10) || String(Date.now());
  return `${s.padEnd(10, "0").slice(0, 10)}.1`;
}

// ── Purchase reporter (server-authoritative, called from stripe-webhook) ──────
/**
 * reportPurchase(env, { email, amountCents, plan, eventId }) — fire the PURCHASE
 * conversion to Meta + GA4 from the server. There is NO browser Purchase event
 * (money clears in the webhook), so `eventId` MUST be the Stripe SESSION id (obj.id):
 * stable + unique, so a Stripe webhook RETRY re-sends with the SAME event_id and the
 * ad platforms dedup it — never a double-counted purchase.
 * Best-effort + awaited (wrap in context.waitUntil at the call site). Never throws.
 */
export async function reportPurchase(env, { email, amountCents, plan, eventId } = {}) {
  const value = Number.isFinite(Number(amountCents)) ? Math.round(Number(amountCents)) / 100 : undefined;
  const common = { event: "Purchase", event_id: eventId, value, currency: "USD", plan };
  try {
    const [meta, ga] = await Promise.all([
      sendMetaCAPI(env, { ...common, email_hash: email }),
      sendGA4(env, common),
    ]);
    return { meta, ga };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}
