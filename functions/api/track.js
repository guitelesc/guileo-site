// Cloudflare Pages Function — POST /api/track
// The CAPI dedup beacon. src/lib/analytics.js#beacon() posts here with the SAME
// event_id it already sent to the browser pixels; we mirror that event to Meta CAPI
// + GA4 server-side so the two copies dedup (recovering ad-blocked / ITP conversions
// without double-counting).
//
// INERT BY DEFAULT: if neither Meta nor GA4 server envs are set, we answer 204 and
// call nothing (analytics.js expects that — the beacon fires unconditionally once the
// visitor consents, and this endpoint is the honest gate). Same-origin only, so it
// can't be used as an open relay to spam a pixel.
import { sameOrigin, rateLimited } from "../lib/guard.js";
import { sendMetaCAPI, sendGA4 } from "../lib/adsConversions.js";

// Only these canonical events are accepted (no arbitrary event injection into the pixel).
const ALLOWED = new Set(["Lead", "InitiateCheckout", "Contact", "StartDemo", "PageView"]);

export async function onRequestPost(context) {
  const { request, env } = context;

  // No server tokens configured → tracking is OFF. Ack quietly so the browser beacon
  // (sendBeacon can't read a body anyway) is a clean no-op. This is the inert gate.
  const metaOn = !!(env.META_PIXEL_ID && env.META_CAPI_TOKEN);
  const ga4On = !!(env.GA4_ID && env.GA4_API_SECRET);
  if (!metaOn && !ga4On) return new Response(null, { status: 204 });

  try {
    // Only our own site may drive server conversions (blocks header-less curl spam).
    if (!sameOrigin(request)) return new Response(null, { status: 204 });
    // per-IP brake — generous for humans, fatal for a script hammering the beacon.
    if (await rateLimited(request, env, "track", 30)) return new Response(null, { status: 204 });

    const body = await request.json().catch(() => ({}));
    const event = String(body.event || "").slice(0, 40);
    if (!ALLOWED.has(event)) return new Response(null, { status: 204 });

    const eventId = String(body.event_id || "").slice(0, 80) || undefined;
    const url = String(body.url || "").slice(0, 1000);
    // value/plan may ride along for InitiateCheckout / (future) conversions
    const value = body.value != null && Number.isFinite(Number(body.value)) ? Number(body.value) : undefined;
    const plan = body.plan ? String(body.plan).slice(0, 120) : undefined;
    // email is optional; if present it's hashed inside adsConversions (never logged/stored here).
    const email = body.email ? String(body.email).slice(0, 200) : "";

    // Request-derived signals lift Meta's match quality (IP + UA + click cookie).
    const client_ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
    const client_ua = request.headers.get("user-agent") || "";
    const { fbc, fbp } = readFbCookies(request);

    const currency = body.currency ? String(body.currency).slice(0, 8) : "USD";

    // Fire both platforms in parallel, best-effort. context.waitUntil keeps them alive
    // past the 204 we return immediately (sendBeacon doesn't wait for a body).
    const jobs = [];
    if (metaOn) jobs.push(sendMetaCAPI(env, {
      event, event_id: eventId, email_hash: email, value, currency, plan,
      event_source_url: url, client_ip, client_ua, fbc, fbp,
    }));
    if (ga4On) jobs.push(sendGA4(env, { event, event_id: eventId, value, currency, plan, event_source_url: url }));
    context.waitUntil(Promise.allSettled(jobs));

    // 204: nothing for the browser to read; the mirror runs in the background.
    return new Response(null, { status: 204 });
  } catch {
    // Attribution must never surface an error to the page.
    return new Response(null, { status: 204 });
  }
}

// Meta's fbc/fbp first-party cookies (set by the browser pixel) sharpen match rate
// when forwarded on the server event. Absent → simply omitted.
function readFbCookies(request) {
  const out = { fbc: "", fbp: "" };
  try {
    const raw = request.headers.get("cookie") || "";
    for (const part of raw.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === "_fbc") out.fbc = decodeURIComponent(v.join("=")).slice(0, 255);
      else if (k === "_fbp") out.fbp = decodeURIComponent(v.join("=")).slice(0, 255);
    }
  } catch { /* cookies optional */ }
  return out;
}

// A stray GET (health probe / preflight) shouldn't 405-noise; just say OK-inert.
export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, endpoint: "track", note: "POST only" }), {
    headers: { "Content-Type": "application/json" },
  });
}
