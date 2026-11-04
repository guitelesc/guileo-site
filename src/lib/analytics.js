import { NO_APP_NATIVO } from "./nativeApp.js";
// ─────────────────────────────────────────────────────────────────────────────
// Guileo — Ad pixels + conversion tracking (privacy-first, CONSENT-GATED)
//
// HOW TO TURN TRACKING ON
// ────────────────────────
// Pixel / measurement IDs come from BUILD-TIME env (Vite `import.meta.env`), so a
// secret never lives in the repo and each environment can differ:
//   • VITE_META_PIXEL_ID → Meta (Facebook) Pixel ID   e.g. "1234567890123456"
//   • VITE_GA4_ID        → GA4 Measurement ID          e.g. "G-XXXXXXXXXX"
//   • VITE_TIKTOK_ID     → TikTok Pixel ID             e.g. "CXXXXXXXXXXXXXXXXXXX"
// (Pixel IDs are PUBLIC by design — they ship in the browser bundle. The CAPI
//  server tokens are NOT here; they live server-side in Cloudflare env.)
//
// While an ID is empty that platform stays OFF. And even for a set ID, NOTHING
// loads until the visitor grants consent (see ConsentBanner.jsx) — dev, demo and
// every pre-consent pageview stay completely clean.
//
// CONSENT MODEL (documented choice): OPT-IN EVERYWHERE. We do NOT default-on for
// US visitors — a single privacy-first path is simpler to reason about, defensible
// under both LGPD and GDPR, and matches the rest of the site (we already decline
// non-essential by default). Pixels load only after an explicit "Accept". Choosing
// "essentials only" means they never load. The decision is remembered for 180 days.
// ─────────────────────────────────────────────────────────────────────────────

// meta keeps the already-wired live Guileo pixel as a fallback so existing Meta
// attribution never silently breaks if the env var is missing on a build; ga/tiktok
// are pure env (empty ⇒ inert). To rotate/replace, set the VITE_* env — env wins.
export const TRACKING_IDS = {
  meta: (import.meta.env.VITE_META_PIXEL_ID || "1296370909363981").toString(),
  ga: (import.meta.env.VITE_GA4_ID || "").toString(),
  tiktok: (import.meta.env.VITE_TIKTOK_ID || "").toString(),
};

// Where the CAPI dedup beacon goes (server mirrors the same event with the SAME
// event_id → Meta/GA4 collapse the browser + server copy into one). Inert until
// the server envs are set (functions/api/track.js short-circuits with 204).
const TRACK_BEACON = "/api/track";

const CONSENT_KEY = "guileo_consent";     // "granted" | "essential"
const UTM_KEY = "guileo_utm";             // first-touch attribution (90d)
const UTM_TTL_MS = 90 * 864e5;
const CONSENT_TTL_MS = 180 * 864e5;

// Small guard: are we in a browser at all? (Vite SSR / tests safety.)
const hasWindow = () => typeof window !== "undefined";

function uuid() {
  try { if (hasWindow() && window.crypto?.randomUUID) return window.crypto.randomUUID(); } catch { /* */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; const v = c === "x" ? r : (r & 0x3) | 0x8; return v.toString(16);
  });
}

// Round any numeric conversion value to a whole number (ad platforms prefer clean
// integers; also avoids leaking odd float artifacts). Non-numbers pass through.
function roundValue(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : v;
}

// ── Consent state ────────────────────────────────────────────────────────────

/** Read the stored consent decision (or null if the visitor hasn't chosen yet / it expired). */
function readConsent() {
  if (!hasWindow()) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    if (!raw || !raw.at || Date.now() - raw.at > CONSENT_TTL_MS) return null;
    return raw.v === "granted" ? "granted" : "essential";
  } catch { return null; }
}

/** True only when the visitor explicitly accepted analytics/ads cookies. */
export function hasConsent() {
  return readConsent() === "granted";
}

/** True once the visitor has made ANY choice — the banner uses this to stay hidden. */
export function consentDecided() {
  return readConsent() !== null;
}

function persistConsent(v) {
  if (!hasWindow()) return;
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v, at: Date.now() })); } catch { /* private mode */ }
}

/** Visitor accepted → persist + load pixels immediately (this same session). */
export function grantConsent() {
  persistConsent("granted");
  loadPixels();
}

/** Visitor chose essentials only → persist; pixels never load. */
export function denyConsent() {
  persistConsent("essential");
}

// ── UTM first-touch capture ──────────────────────────────────────────────────
// First ad click wins: we store {source,medium,campaign,term,content,at} once and
// keep it for 90 days so a lead that converts days later is still attributable.
// This is FIRST-PARTY localStorage (no pixel, no third party) so it's captured on
// load regardless of consent — same posture as the existing guileo_ref referral tag.
function captureUTM() {
  if (!hasWindow()) return;
  try {
    const q = new URLSearchParams(window.location.search);
    const src = q.get("utm_source") || q.get("gclid") || q.get("fbclid");
    if (!src) return; // only overwrite/refresh when THIS visit carries campaign params
    const existing = JSON.parse(localStorage.getItem(UTM_KEY) || "null");
    if (existing && existing.at && Date.now() - existing.at < UTM_TTL_MS) return; // first touch stays
    const attr = {
      source: (q.get("utm_source") || "").slice(0, 60),
      medium: (q.get("utm_medium") || "").slice(0, 60),
      campaign: (q.get("utm_campaign") || "").slice(0, 80),
      term: (q.get("utm_term") || "").slice(0, 80),
      content: (q.get("utm_content") || "").slice(0, 80),
      gclid: (q.get("gclid") || "").slice(0, 120),
      fbclid: (q.get("fbclid") || "").slice(0, 120),
      at: Date.now(),
    };
    localStorage.setItem(UTM_KEY, JSON.stringify(attr));

    // ── E TAMBÉM NUM COOKIE PRIMÁRIO ────────────────────────────────────────────────────────
    // localStorage só o JavaScript enxerga. Para o SERVIDOR saber de qual anúncio veio o lead,
    // alguém teria que costurar getUTM() em cada um dos ~10 lugares que enviam lead — e o 11º
    // nasceria sem. O cookie viaja sozinho em toda requisição para o nosso próprio domínio, então
    // /api/lead, o widget e qualquer rota futura recebem a atribuição de graça.
    //
    // PRIMÁRIO E NOSSO: nunca sai para terceiros, é o mesmo dado que já guardávamos, e serve para
    // dizer ao dono do negócio qual anúncio trouxe qual cliente — que é o motivo de ele existir.
    try {
      const enxuto = { s: attr.source, c: attr.campaign, m: attr.medium, g: attr.gclid, f: attr.fbclid };
      const valor = encodeURIComponent(JSON.stringify(enxuto)).slice(0, 700);
      document.cookie = `gui_attr=${valor}; Max-Age=${Math.floor(UTM_TTL_MS / 1000)}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch { /* cookie é bônus; o localStorage já guardou */ }
  } catch { /* never break the site over attribution */ }
}

/** Read the stored first-touch UTM (or null). Handy for LeadForm / server payloads. */
export function getUTM() {
  if (!hasWindow()) return null;
  try {
    const u = JSON.parse(localStorage.getItem(UTM_KEY) || "null");
    if (!u || !u.at || Date.now() - u.at > UTM_TTL_MS) return null;
    return u;
  } catch { return null; }
}

// ── Script injection helpers ────────────────────────────────────────────────
// Each loader mirrors the platform's official snippet, but is only ever called
// when the corresponding ID is non-empty AND consent was granted (see loadPixels).

function injectMetaPixel(id) {
  if (!hasWindow() || window.fbq) return; // already loaded
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function injectGtag(id) {
  if (!hasWindow() || window.gtag) return; // already loaded
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  /* eslint-disable */
  window.gtag = function () { window.dataLayer.push(arguments); };
  /* eslint-enable */
  window.gtag("js", new Date());
  window.gtag("config", id);
}

function injectTikTok(id) {
  if (!hasWindow() || window.ttq) return; // already loaded
  /* eslint-disable */
  !(function (w, d, t) {
    w.TiktokAnalyticsObject = t;
    var ttq = (w[t] = w[t] || []);
    ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    ttq.setAndDefer = function (e, n) {
      e[n] = function () { e.push([n].concat(Array.prototype.slice.call(arguments, 0))); };
    };
    for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (e) {
      var n = ttq._i[e] || [];
      for (var r = 0; r < ttq.methods.length; r++) ttq.setAndDefer(n, ttq.methods[r]);
      return n;
    };
    ttq.load = function (e, n) {
      var r = "https://analytics.tiktok.com/i18n/pixel/events.js", o = n && n.partner;
      ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
      ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
      ttq._o = ttq._o || {}; ttq._o[e] = n || {};
      var s = d.createElement("script");
      s.type = "text/javascript"; s.async = !0; s.src = r + "?sdkid=" + e + "&lib=" + t;
      var a = d.getElementsByTagName("script")[0];
      a.parentNode.insertBefore(s, a);
    };
    ttq.load(id);
    ttq.page();
  })(window, document, "ttq");
  /* eslint-enable */
}

let _loaded = false;
/** Inject each enabled pixel exactly once. Guarded so repeated calls are cheap. */
function loadPixels() {
  if (!hasWindow() || _loaded) return;
  if (!hasConsent()) return; // never load without an explicit accept
  if (NO_APP_NATIVO) return;  // dentro do app iOS nunca: a ficha de privacidade da App Store diz "sem rastreamento"
  _loaded = true;
  try {
    if (TRACKING_IDS.meta) injectMetaPixel(TRACKING_IDS.meta);
    if (TRACKING_IDS.ga) injectGtag(TRACKING_IDS.ga);
    if (TRACKING_IDS.tiktok) injectTikTok(TRACKING_IDS.tiktok);
  } catch { /* analytics must never break the site */ }
}

// ── CAPI dedup beacon ────────────────────────────────────────────────────────
// Mirror a browser event to the server with the SAME event_id so Meta CAPI / GA4
// Measurement Protocol dedup the two copies. Fire-and-forget; only when consent is
// granted; inert if /api/track has no server tokens (it answers 204).
function beacon(event, eventId, extra = {}) {
  if (!hasWindow() || !hasConsent()) return;
  try {
    const body = JSON.stringify({
      event, event_id: eventId,
      url: window.location.href,
      utm: getUTM() || undefined,
      ...extra,
    });
    navigator.sendBeacon?.(TRACK_BEACON, new Blob([body], { type: "application/json" })) ||
      fetch(TRACK_BEACON, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch { /* attribution must never break the site */ }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * initAnalytics() — call ONCE on app startup (main.jsx).
 * Captures first-touch UTM always, then loads pixels ONLY if consent was already
 * granted on a previous visit. A first-time visitor loads nothing until they
 * accept in the ConsentBanner (which calls grantConsent()).
 */
export function initAnalytics() {
  if (!hasWindow()) return;
  try {
    captureUTM();
    loadPixels(); // no-op unless consent already granted
  } catch { /* analytics must never break the site */ }
}

/**
 * track(event, params) — forward a conversion event to every ENABLED pixel.
 * Returns an event_id (uuid) so server-side CAPI can dedup. Safely no-ops for any
 * platform whose ID is empty, whose global isn't ready, or before consent.
 */
export function track(event, params = {}) {
  const eventId = uuid();
  if (!hasWindow() || !hasConsent()) return eventId;
  const p = { ...params };
  if (p.value != null) p.value = roundValue(p.value);
  try {
    // Meta — fbq('track', event, params, {eventID}) — eventID drives CAPI dedup.
    if (TRACKING_IDS.meta && typeof window.fbq === "function") {
      window.fbq("track", event, p, { eventID: eventId });
    }
    // GA4 — gtag('event', event, params)
    if (TRACKING_IDS.ga && typeof window.gtag === "function") {
      window.gtag("event", event, p);
    }
    // TikTok — ttq.track(event, params, {event_id})
    if (TRACKING_IDS.tiktok && window.ttq && typeof window.ttq.track === "function") {
      window.ttq.track(event, p, { event_id: eventId });
    }
  } catch { /* never let a tracking call throw into the app */ }
  return eventId;
}

/** Fire a page view for SPA route changes (the initial load is covered by each loader). */
export function trackPageView(path) {
  if (!hasWindow() || !hasConsent()) return;
  const page_path = path || window.location.pathname;
  try {
    if (TRACKING_IDS.meta && typeof window.fbq === "function") window.fbq("track", "PageView");
    if (TRACKING_IDS.ga && typeof window.gtag === "function") window.gtag("event", "page_view", { page_path });
    if (TRACKING_IDS.tiktok && window.ttq && typeof window.ttq.page === "function") window.ttq.page();
  } catch { /* analytics must never break the site */ }
}

// ── Named funnel helpers (standardized; each returns its event_id for dedup) ──

/** A lead was captured (form submit, phone entered, etc.). */
export function trackLead(extra = {}) {
  const id = track("Lead", extra);
  beacon("Lead", id, extra);
  return id;
}

/** Visitor started the live AI demo (entered phone → AI calls them). */
export function trackDemoCall(extra = {}) {
  const id = track("StartDemo", extra);
  beacon("StartDemo", id, extra);
  return id;
}

/** Visitor clicked a plan → is heading into Stripe checkout. `plan` labels it. */
export function trackInitiateCheckout(plan, value) {
  const params = { content_name: plan, value, currency: "USD" };
  const id = track("InitiateCheckout", params);
  beacon("InitiateCheckout", id, { plan, value });
  return id;
}

/** Visitor reached / submitted a contact intent. */
export function trackContact(extra = {}) {
  const id = track("Contact", extra);
  beacon("Contact", id, extra);
  return id;
}

// ── Backward-compatible aliases (existing call sites keep working unchanged) ──
// LeadForm/LeadCaptureV2 → trackLead · DemoLink → trackStartDemo · contact.js →
// trackContact · Planos → trackSubscribe. Kept so W1 doesn't have to edit files it
// doesn't own; new code should prefer trackDemoCall / trackInitiateCheckout.

/** @deprecated use trackDemoCall */
export function trackStartDemo() { return trackDemoCall(); }

/** @deprecated use trackInitiateCheckout — kept for src/pages/Planos.jsx */
export function trackSubscribe(plan, value) { return trackInitiateCheckout(plan, value); }
