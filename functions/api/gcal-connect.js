// Cloudflare Pages Function — Google Calendar connect flow (OAuth 2.0).
//   GET /api/gcal-connect?email=client@x.com        → redirects to Google consent
//   GET /api/gcal-connect?code=...&state=<email>    → callback: stores refresh token
// Needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in the Cloudflare env (Google Cloud →
// Credentials → OAuth client, redirect URI https://guileoai.com/api/gcal-connect).
// Until the keys exist → friendly 501. Tokens land in client_integrations (RLS-locked).
import { json, safeEq } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const REDIRECT = "https://guileoai.com/api/gcal-connect";

// CSRF-safe OAuth state: state = base64url(email) + "." + base64url(HMAC-SHA256(email)).
// The MAC is keyed with INGEST_SECRET (already used below for store_integration, so it always
// exists), so an attacker can't forge a `state` that binds a victim's Google tokens to their
// own email — only values WE signed in leg 1 verify in leg 2.
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function signEmail(email, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(email));
  return b64url(mac);
}
async function makeState(email, secret) {
  return `${b64url(new TextEncoder().encode(email))}.${await signEmail(email, secret)}`;
}
// Returns the verified email, or "" if the state is missing/forged.
async function verifyState(state, secret) {
  const [ePart, sig] = (state || "").split(".");
  if (!ePart || !sig) return "";
  let email = "";
  try { email = new TextDecoder().decode(Uint8Array.from(atob(ePart.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))); } catch { return ""; }
  const expected = await signEmail(email, secret);
  return safeEq(sig, expected) ? email : "";
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ ready: false, error: "Google OAuth keys not set — flow is coded and waiting for GOOGLE_CLIENT_ID/SECRET" }, 501);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // ── leg 2: Google calls back with ?code → exchange for tokens, store, close window ──
  if (code) {
    // Verify the HMAC-signed state (CSRF): only emails WE signed in leg 1 are accepted, so an
    // attacker can't forge ?state to bind these Google tokens to their own account.
    if (!env.INGEST_SECRET) return json({ error: "not configured" }, 501);
    const email = (await verifyState(url.searchParams.get("state"), env.INGEST_SECRET)).toLowerCase();
    if (!email.includes("@")) return json({ error: "bad state" }, 400);
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT, grant_type: "authorization_code",
      }),
    });
    if (!tr.ok) return json({ error: "token exchange failed" }, 502);
    const tokens = await tr.json();
    await fetch(`${SB_URL}/rest/v1/rpc/store_integration`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "gcal", p_tokens: { refresh_token: tokens.refresh_token || "", scope: tokens.scope || "" } }),
    });
    return new Response("<html><body style='font-family:system-ui;background:#161512;color:#EDE7DC;display:grid;place-items:center;height:100vh'><div style='text-align:center'><div style='font-size:40px'>✅</div><h2>Google Calendar conectado!</h2><p style='color:#948C7B'>Pode fechar esta janela e voltar ao portal.</p></div></body></html>", { headers: { "Content-Type": "text/html", "X-Content-Type-Options": "nosniff" } });
  }

  // ── leg 1: kick off consent for this client ──
  const email = (url.searchParams.get("email") || "").toLowerCase();
  if (!email.includes("@")) return json({ error: "email required" }, 400);
  if (!env.INGEST_SECRET) return json({ error: "not configured" }, 501);
  const state = await makeState(email, env.INGEST_SECRET);
  const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  consent.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID, redirect_uri: REDIRECT, response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline", prompt: "consent", state,
  }).toString();
  return Response.redirect(consent.toString(), 302);
}
