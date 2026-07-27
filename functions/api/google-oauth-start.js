// Cloudflare Pages Function — POST /api/google-oauth-start · begin Google Business OAuth
// ─────────────────────────────────────────────────────────────────────────────
// The tenant (logged into the cockpit) asks to connect their Google Business Profile.
// We gate by email↔connection-key (get_client_data), mint an opaque server-side `state`
// (gbp_oauth_begin — state→email lives in the DB, NEVER in the URL), and return the Google
// consent URL. The callback (google-oauth-callback.js) exchanges the code for a refresh_token.
//
// HONEST-INERT: if GOOGLE_BUSINESS_CLIENT_ID isn't set in Cloudflare (Google approves the
// Business Profile API per-project), there's nothing to authorize yet — we return ready:false
// with a clear note instead of sending the owner to a broken Google screen. Lights up on its
// own the moment the key is set. Mirrors the connect/status honesty of google-business.js.
// ─────────────────────────────────────────────────────────────────────────────
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));

const REDIRECT_DEFAULT = "https://guileoai.com/api/google-oauth-callback";
const SCOPE = "https://www.googleapis.com/auth/business.manage";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "google-oauth-start", 20)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const email = s(b.email, 160).trim().toLowerCase();
    const key = s(b.token || b.key, 200).trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE — email ↔ connection key (same as google-business.js).
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    // HONEST-INERT: no API key yet → nothing to authorize.
    if (!env.GOOGLE_BUSINESS_CLIENT_ID) {
      return json({ ok: true, ready: false, note: "Google Business ainda não liberado — falta definir GOOGLE_BUSINESS_CLIENT_ID/SECRET no Cloudflare (aprovação do Google por projeto). O botão de conectar acende sozinho quando a chave for setada. Aguardando API." });
    }

    // Mint an opaque state bound to this tenant, server-side (CSRF + tenant binding).
    let state = "";
    try {
      const r = await rpc("gbp_oauth_begin", { p_secret: env.INGEST_SECRET || "", p_email: email });
      if (r.ok) state = s(await r.json(), 200);
    } catch { /* non-fatal */ }
    if (!state) return json({ error: "could not start oauth (state)" }, 500);

    const redirectUri = s(env.GOOGLE_BUSINESS_REDIRECT || REDIRECT_DEFAULT, 300);
    const p = new URLSearchParams({
      client_id: s(env.GOOGLE_BUSINESS_CLIENT_ID, 300),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",        // required to receive a refresh_token
      prompt: "consent",             // force refresh_token even on re-auth
      include_granted_scopes: "true",
      state,
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
    return json({ ok: true, ready: true, url });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
