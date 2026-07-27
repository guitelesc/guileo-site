// Cloudflare Pages Function — /api/cx-survey · the ACTIVE XM survey sweep (daily cron).
// ═════════════════════════════════════════════════════════════════════════════
// Gui automatically asks a client's OWN customers "how was it?" (1-tap NPS/CSAT) after a recent
// visit — but ONLY for tenants who leave it ON (cx_settings; ACTIVE BY DEFAULT, client can disable
// in the Experience tab). Mirrors functions/api/nps.js exactly: iterate tenants (clients_list), and
// for each ENABLED tenant list fresh emailed customers (cx_survey_candidates), take an ATOMIC 30-day
// claim (cx_survey_claim) BEFORE emailing so nobody is surveyed twice, and send the branded survey.
//
// SAFEGUARDS (this emails the CLIENT'S customers — third parties):
//   • Per-tenant toggle, ON by default but the client can turn it OFF anytime (cx_settings_set).
//   • Email ONLY (TCPA-safe) — SMS/WhatsApp stay off until A2P/WA is live.
//   • 30-day per-customer claim window + a hard per-run send cap.
//   • Only customers the business ALREADY has an email for and who visited in the last 72h.
//   • Honest soft opt-out line in the footer; the survey link is HMAC-signed (can't be forged).
//   • Until db/experience.sql + db/cx_settings.sql are pasted the RPCs 404 → the sweep reports
//     ready:false and sends NOTHING.
//
//   GET/POST /api/cx-survey?token=DIGEST_TOKEN   (called by cron-tick daily; DIGEST-gated)
import { json, safeEq } from "../lib/guard.js";
import { cxSurveyEmail } from "../lib/emailTemplates.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const SITE = "https://guileoai.com";
const MAX_SENDS = 40;        // hard cap per run (subrequest + mailer budget)
const PER_TENANT = 10;       // at most N surveys per tenant per run (spread over days)

async function rpc(env, fn, args) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// base64url + HMAC (Web Crypto — must match functions/api/cx-vote.js verification exactly).
const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function cxSig(env, email, ref) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.INGEST_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`cx:${email}:${ref}`));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const langNorm = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };
const isEmail = (s) => /.+@.+\..+/.test((s || "").toString());

export async function onRequest(context) {
  const { request, env } = context;
  const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
  if (!env.RESEND_API_KEY) return json({ ok: true, ready: false, note: "RESEND_API_KEY not set — no channel to send the survey." });

  const roster = await rpc(env, "clients_list", {});
  if (!Array.isArray(roster)) return json({ ok: true, ready: false, note: "clients_list unavailable (paste db/experience.sql + db/cx_settings.sql)." });
  const emails = [...new Set(roster.map((c) => ((c && c.client_email) || "").toString().trim().toLowerCase()).filter((e) => e.includes("@")))];

  const out = { ok: true, ready: true, tenants: 0, sent: 0, skippedDisabled: 0, claimedNone: 0, samples: [] };
  for (const email of emails) {
    if (out.sent >= MAX_SENDS) break;
    // toggle — ACTIVE BY DEFAULT; absent row = enabled. A tenant that turned it off is skipped.
    const st = await rpc(env, "cx_settings_get", { p_email: email });
    if (st && st.survey_enabled === false) { out.skippedDisabled++; continue; }
    out.tenants++;

    const cands = await rpc(env, "cx_survey_candidates", { p_email: email, p_since_hours: 72, p_window_hours: 720, p_limit: PER_TENANT });
    if (!Array.isArray(cands) || !cands.length) { out.claimedNone++; continue; }

    // tenant brand for the email (their logo/accent/name/lang) — falls back gracefully.
    const profile = (await rpc(env, "get_client_profile", { p_email: email })) || {};
    const brand = { business: profile.business || "", logo_url: profile.logo_url || "", accent: profile.accent || "#FF8A33" };
    const lang = langNorm(profile.lang);

    for (const c of cands) {
      if (out.sent >= MAX_SENDS) break;
      const ref = (c.contact_ref || "").toString().trim().toLowerCase();
      if (!isEmail(ref)) continue;                 // email-only channel
      // ATOMIC 30-day claim BEFORE sending — two racing runs can never double-survey.
      const claimed = await rpc(env, "cx_survey_claim", { p_email: email, p_contact_ref: ref, p_window_hours: 720 });
      if (claimed !== true) continue;

      const sig = await cxSig(env, email, ref);
      const voteBaseUrl = `${SITE}/api/cx-vote?e=${b64u(email)}&c=${b64u(ref)}&s=${sig}&l=${lang}`;
      const { subject, html } = cxSurveyEmail({ name: c.name || "", business: brand.business, brand, lang, voteBaseUrl });
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: ref, subject, html }),
        });
        if (r.ok) { out.sent++; if (out.samples.length < 8) out.samples.push({ tenant: email, to: ref }); }
      } catch { /* mailer hiccup → the claim already burned; next window re-surveys. best-effort. */ }
    }
  }
  return json(out);
}
