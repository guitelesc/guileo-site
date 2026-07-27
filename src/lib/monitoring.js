// Error monitoring (Sentry) — OFF until you paste your DSN below.
// While SENTRY_DSN is "", nothing initializes and the SDK is never even downloaded
// (it's loaded via dynamic import only when a DSN is present), so dev/preview and the
// production bundle stay lean. Paste the DSN from your Sentry project to turn it on.
//
//   1. Create a project at sentry.io → Settings → Client Keys (DSN)
//   2. Paste the DSN string below (looks like https://<key>@o<org>.ingest.sentry.io/<id>)
//   3. Deploy. Errors (incl. React render crashes via ErrorBoundary) start reporting.
export const SENTRY_DSN = "https://156c24cf3036ab28627e9194abd19c2e@o4510752693878784.ingest.us.sentry.io/4511565868892160";

let _ready = null;   // a promise that resolves to the Sentry module once initialized, else null
let _buffer = [];    // errors captured BEFORE Sentry finished loading (flushed on init)

// Actually download + init the SDK. Idempotent (guarded by _ready). This is what
// pulls the ~470KB @sentry/react chunk, so callers must schedule it off the hot path.
function _loadSentry() {
  if (!SENTRY_DSN || _ready) return _ready;
  _ready = import("@sentry/react")
    .then((Sentry) => {
      const prod = typeof location !== "undefined" && location.hostname === "guileoai.com";
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: prod ? "production" : "preview",
        // Keep it light: sample a slice of perf traces, no session replay by default.
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        // Filter out noisy non-actionable browser errors.
        ignoreErrors: ["ResizeObserver loop limit exceeded", "ResizeObserver loop completed", "Non-Error promise rejection captured"],
      });
      // Drain anything captured before the SDK was ready.
      if (_buffer.length) {
        const pending = _buffer; _buffer = [];
        for (const { error, extra } of pending) {
          try { Sentry.captureException(error, extra ? { extra } : undefined); } catch { /* noop */ }
        }
      }
      return Sentry;
    })
    .catch(() => null); // a monitoring failure must never break the app
  return _ready;
}

// Called once at startup (src/main.jsx). No-ops cleanly when no DSN is set.
// Perf: the heavy Sentry chunk must NOT compete with the LCP, so we defer the
// download until AFTER the page's load event and then wait for browser idle time.
// A real error arriving before that still forces the load (see captureError).
export function initMonitoring() {
  if (!SENTRY_DSN || _ready || typeof window === "undefined") return;
  const idle = (cb) => (typeof requestIdleCallback === "function"
    ? requestIdleCallback(cb, { timeout: 4000 })
    : setTimeout(cb, 1));
  const schedule = () => idle(() => _loadSentry());
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  // pre-init shim: uncaught errors in the seconds before the deferred Sentry init are
  // buffered via captureError (which force-loads); listeners are cheap and idempotent.
  window.addEventListener("error", (e) => { try { captureError(e.error || e.message); } catch { /* */ } });
  window.addEventListener("unhandledrejection", (e) => { try { captureError(e.reason); } catch { /* */ } });
}

// Report a caught error (used by the ErrorBoundary and any try/catch that wants it).
// Falls back to console when monitoring is off, so nothing is ever silently swallowed.
export function captureError(error, extra) {
  if (!SENTRY_DSN) { try { console.error(error, extra || ""); } catch { /* noop */ } return; }
  if (_ready) { _ready.then((S) => { if (S) S.captureException(error, extra ? { extra } : undefined); }); return; }
  // Not loaded yet: buffer it (capped) and force the download now — a real error is
  // worth the bytes, and it will be drained the moment Sentry.init() completes.
  _buffer.push({ error, extra });
  if (_buffer.length > 50) _buffer.shift();
  _loadSentry();
}
