// Cloudflare Pages Function — /api/onboarding · THE CLIENT ONBOARDING MACHINE.
// ─────────────────────────────────────────────────────────────────────────────
// From "yes" to kickoff with no manual work: a 7-step chain where each step fires the next.
// "Automate the SENDING, never the DECIDING" — every side-effect here is a pre-approved email
// or a funnel stamp; no price/fire/refund/collect decision is ever made in this file.
//
// THE 7 STEPS (see db/onboarding.sql):
//   1 contract → 2 welcome → 3 invoice → 4 access → 5 kickoff → 6 report → 7 checkin
//   • step 4 (access) is fired by auto-provision (stripe-webhook) — we don't re-provision here.
//   • steps 6 (monthly) + 7 (30/60/90) are ALSO callable from cron-tick (idempotent).
//
// SECURITY: money-adjacent + sends CLIENT email → gated by EITHER sameOrigin (portal/admin UI)
// OR a server secret (env.INGEST_SECRET, via body.secret / x-guileo-secret header — how cron &
// stripe-webhook call it). Recipient is always the funnel's own client_email (never attacker-chosen).
// Per-IP rate-limited. Emails ALWAYS render via emailTemplates.js — never ad-hoc HTML.
import { json, sameOrigin, safeEq, rateLimited, apiSecurityHeaders } from "../lib/guard.js";
import {
  welcomePacketEmail, kickoffBriefEmail, onboardingCheckinEmail, roiReportEmail,
} from "../lib/emailTemplates.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const INGEST_LITERAL = "glo_ing_7f3da9c2b4e8"; // the RPC gate literal (also in db/onboarding.sql)

const STEPS = ["contract", "welcome", "invoice", "access", "kickoff", "report", "checkin"];

const rpc = async (name, body) => {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
};
const ing = (env) => env.INGEST_SECRET || INGEST_LITERAL;

// Branded transactional send — direct to Resend (same pattern as welcome.js / client-report.js).
// No-ops gracefully without a key so nothing breaks before email is configured.
async function sendMail(env, to, subject, html) {
  const KEY = env.RESEND_API_KEY;
  if (!KEY) return { ok: false, reason: "no key" };
  if (!to || !to.includes("@") || !html) return { ok: false, reason: "bad recipient" };
  const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    const d = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, id: d?.id || null } : { ok: false, error: d?.message || `HTTP ${r.status}` };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}

// Pull the tenant's real business facts to enrich the AI brief (business/industry/lang/prices).
async function clientFacts(env, email) {
  const p = await rpc("get_client_profile", { p_secret: ing(env), p_email: email });
  const prof = (p && typeof p === "object" && !Array.isArray(p)) ? p : {};
  return {
    business: prof.business_name || prof.business || "",
    industry: prof.industry || "",
    lang: (prof.lang || "").toString().slice(0, 2),
    prices: prof.prices || prof.menu || "",
    facts: prof,
  };
}

// Compose the one-page AI KICKOFF BRIEF from the intake (captured at start) + the site/profile facts.
// Uses ANTHROPIC_API_KEY with the platform's hardened model-fallback chain. Falls back to a clean
// deterministic brief if AI is unavailable — the machine never blocks on the model.
const MODEL_CHAIN = ["claude-fable-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"];
async function writeBrief(env, { email, business, industry, lang, intake, prices }) {
  const langName = { pt: "Portuguese", es: "Spanish", en: "English" }[lang] || "English";
  const facts = [
    business ? `Business: ${business}` : "",
    industry ? `Industry: ${industry}` : "",
    prices ? `Prices/menu: ${String(prices).slice(0, 800)}` : "",
    intake ? `Intake notes: ${typeof intake === "string" ? intake.slice(0, 1500) : JSON.stringify(intake).slice(0, 1500)}` : "",
  ].filter(Boolean).join("\n");
  const system = `You are Guileo's onboarding strategist. Write a crisp ONE-PAGE kickoff brief for the internal team about to launch this client's AI receptionist ("Gui"). Write in ${langName}. Use short labeled sections: SNAPSHOT (who they are, what they sell), GOALS (what winning looks like in 90 days), GUI'S FIRST JOB (the highest-value thing Gui should do on day one), RISKS/UNKNOWNS (what to confirm on the kickoff call). Be concrete and specific to the facts given — never invent numbers, prices, or claims not present in the facts. Plain text, no markdown headers with #, use UPPERCASE labels followed by a colon. Keep under 320 words.`;
  const msg = `Facts:\n${facts || "(minimal facts provided — write a tight brief and flag what to confirm on the call)"}`;
  if (env.ANTHROPIC_API_KEY) {
    for (const model of MODEL_CHAIN) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model, max_tokens: 700, system, messages: [{ role: "user", content: msg }] }),
        });
        if (r.ok) {
          const d = await r.json().catch(() => ({}));
          const text = (d?.content?.[0]?.text || "").trim();
          if (text) return { brief: text, model };
        } else if (r.status === 401 || r.status === 402) break;
      } catch { /* try next model */ }
    }
  }
  // Deterministic fallback — still a usable one-pager.
  const fb = [
    `SNAPSHOT: ${business || "This client"}${industry ? ` — a ${industry} business` : ""}.`,
    `GOALS: Get Gui answering every call and message, capturing and booking leads, from day one.`,
    `GUI'S FIRST JOB: Never let a call go unanswered — greet, qualify, and book or take a message, in the caller's language.`,
    `RISKS/UNKNOWNS: Confirm services & prices, hours, the number to forward, and the owner's alert phone on the kickoff call.`,
  ].join("\n\n");
  return { brief: fb, model: "fallback" };
}

// Which email a given step sends (welcome, kickoff, report). invoice/access/contract are stamps
// (the invoice itself is Stripe; access is provisioning) — no email fired from here for those.
async function fireStep(env, step, email, opts = {}) {
  const facts = await clientFacts(env, email);
  const lang = (opts.lang || facts.lang || "en").slice(0, 2);
  const name = (opts.name || "there").toString().slice(0, 80);
  const business = (facts.business || opts.business || "your business").toString().slice(0, 120);
  const portalUrl = "https://guileoai.com/portal";
  const kickoffUrl = env.KICKOFF_URL || opts.kickoffUrl || "";

  if (step === "welcome") {
    const { subject, html } = welcomePacketEmail({ name, business, lang, portalUrl, kickoffUrl });
    return sendMail(env, email, subject, html);
  }
  if (step === "kickoff") {
    const meta = opts.meta || {};
    const { brief } = await writeBrief(env, { email, business, industry: facts.industry, lang, intake: meta.intake, prices: facts.prices });
    const { subject, html } = kickoffBriefEmail({ name, business, lang, brief, bookingUrl: kickoffUrl, portalUrl });
    return sendMail(env, email, subject, html);
  }
  if (step === "report") {
    // Monthly ROI report — reuse the report template. loseMonthly is a pre-approved shape, not a
    // decision about the client's money (no charge/refund is made here).
    const { subject, html } = roiReportEmail({ name, business, vertical: facts.industry, loseMonthly: Number(opts.loseMonthly) || 4500, lang });
    return sendMail(env, email, subject, html);
  }
  return { ok: true, note: "no email for this step" };
}

// Authorize: sameOrigin (browser UI) OR a valid server secret (cron / stripe-webhook).
function authorized(request, env, body) {
  // SECRET-ONLY (fix, adversarial audit): this endpoint is 100% server-driven (cron + stripe-webhook)
  // — no browser calls it. sameOrigin is header-spoofable (curl -H Origin), so allowing it let anyone
  // read a tenant's facts via `brief` and send branded emails to any address (phishing relay). Require
  // the INGEST/DIGEST secret so only our own server callers can trigger.
  const tok = (body && body.secret) || request.headers.get("x-guileo-secret") || "";
  return !!tok && (safeEq(tok, ing(env)) || (env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN)));
}

const cleanEmail = (e) => (e || "").toString().trim().toLowerCase();

// CRON DRIVER (steps 6 monthly + 7 day-30/60/90). Idempotent by construction — the due-RPCs
// atomic-claim the milestone/month, so a re-run drains an empty list (never double-sends).
// Token-gated (DIGEST_TOKEN or INGEST) via ?token= — same trust model as every other cron sweep.
async function runSweep(request, env, which) {
  const url = new URL(request.url);
  const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  const ok = !!tok && ((env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN)) || safeEq(tok, ing(env)));
  if (!ok) return json({ ok: false, error: "unauthorized" }, 401);
  const results = { checkin: 0, report: 0 };
  try {
    if (which === "checkin" || which === "all") {
      const due = await rpc("onboard_checkin_due", { p_secret: ing(env), p_limit: 100 });
      for (const c of (Array.isArray(due) ? due : [])) {
        const facts = await clientFacts(env, c.client_email);
        const lang = (c.lang || facts.lang || "en").slice(0, 2);
        const { subject, html } = onboardingCheckinEmail({ name: c.name || "there", business: facts.business || "your business", lang, day: c.day });
        const r = await sendMail(env, c.client_email, subject, html.replace(/__EMAIL__/g, encodeURIComponent(c.client_email)));
        if (r.ok) results.checkin++;
      }
    }
    if (which === "report" || which === "all") {
      const due = await rpc("onboard_report_due", { p_secret: ing(env), p_limit: 100 });
      for (const c of (Array.isArray(due) ? due : [])) {
        const r = await fireStep(env, "report", c.client_email, { name: c.name, lang: c.lang });
        if (r.ok) results.report++;
      }
    }
  } catch (e) { return json({ ok: false, error: String(e).slice(0, 160), results }, 200); }
  return json({ ok: true, swept: which, results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "onboarding", 40)) return json({ ok: false, error: "rate" }, 429);
    const sweep = new URL(request.url).searchParams.get("sweep");
    if (sweep) return runSweep(request, env, sweep);
    const body = await request.json().catch(() => ({}));
    if (!authorized(request, env, body)) return json({ ok: false, error: "forbidden" }, 403);

    const action = (body.action || "").toString();
    const email = cleanEmail(body.client_email || body.email);
    if (!email.includes("@") && action !== "") return json({ ok: false, error: "client_email required" }, 400);

    // ── start: kick the chain — record step 1 (contract), stash brand+intake, send the welcome packet.
    if (action === "start") {
      const meta = {
        brand: body.brand || {}, intake: body.intake || {},
        lang: (body.lang || "").toString().slice(0, 2),
        name: (body.name || (body.brand && body.brand.contactName) || "").toString().slice(0, 80),
      };
      const started = await rpc("onboard_start", { p_secret: ing(env), p_email: email, p_meta: meta });
      // welcome packet (step 2) — stamp first (idempotent), send only on first stamp.
      const adv = await rpc("onboard_advance", { p_secret: ing(env), p_email: email, p_step: "welcome" });
      let mail = { ok: false, skipped: true };
      if (adv && adv.fired) mail = await fireStep(env, "welcome", email, { name: meta.name, lang: meta.lang });
      return json({ ok: true, started: started || null, welcome: mail });
    }

    // ── advance: move the funnel to `step` and fire that step's email/action (once).
    if (action === "advance") {
      const step = (body.step || "").toString().toLowerCase();
      if (!STEPS.includes(step)) return json({ ok: false, error: "unknown step" }, 400);
      const adv = await rpc("onboard_advance", { p_secret: ing(env), p_email: email, p_step: step });
      let mail = { ok: true, skipped: true };
      // fire the side-effect ONLY the first time this step is stamped (idempotent — no double-send).
      if (adv && adv.fired) {
        mail = await fireStep(env, step, email, {
          name: (body.name || "").toString().slice(0, 80), lang: (body.lang || "").toString().slice(0, 2),
          business: body.business, meta: body.meta, loseMonthly: body.loseMonthly,
        });
        // access reached → auto-open the kickoff step (booking + brief) so the chain self-advances.
        if (step === "access") {
          const k = await rpc("onboard_advance", { p_secret: ing(env), p_email: email, p_step: "kickoff" });
          if (k && k.fired) await fireStep(env, "kickoff", email, { name: body.name, lang: body.lang, meta: body.meta });
        }
      }
      return json({ ok: true, advanced: adv || null, fired: mail });
    }

    // ── brief: generate (and return) the AI kickoff brief from intake + site facts. Does NOT send.
    if (action === "brief") {
      const st = await rpc("onboard_status", { p_secret: ing(env), p_email: email });
      const meta = (st && st.meta) || {};
      const facts = await clientFacts(env, email);
      const lang = (body.lang || meta.lang || facts.lang || "en").slice(0, 2);
      const out = await writeBrief(env, { email, business: facts.business, industry: facts.industry, lang, intake: meta.intake || body.intake, prices: facts.prices });
      return json({ ok: true, brief: out.brief, model: out.model, business: facts.business });
    }

    // ── status: the 7-step progress (booleans + timestamps + pct + sentiment) for the progress bar
    // AND the funnel/conversion dashboard.
    if (action === "status") {
      const st = await rpc("onboard_status", { p_secret: ing(env), p_email: email });
      return json({ ok: true, status: st || { found: false } });
    }

    // ── checkin: send the one-question day-30/60/90 check-in (stamps checkin on vote, not on send).
    if (action === "checkin") {
      const day = [30, 60, 90].includes(Number(body.day)) ? Number(body.day) : 30;
      const facts = await clientFacts(env, email);
      const st = await rpc("onboard_status", { p_secret: ing(env), p_email: email });
      const meta = (st && st.meta) || {};
      const lang = (body.lang || meta.lang || facts.lang || "en").slice(0, 2);
      const name = (body.name || meta.name || "there").toString().slice(0, 80);
      const { subject, html } = onboardingCheckinEmail({ name, business: facts.business || "your business", lang, day });
      // inject the client email into the 1-tap vote links (template leaves __EMAIL__ token).
      const personalized = html.replace(/__EMAIL__/g, encodeURIComponent(email));
      const mail = await sendMail(env, email, subject, personalized);
      return json({ ok: true, day, sent: mail });
    }

    // ── report: the monthly ROI report writes+sends itself (reuse the report engine template).
    if (action === "report") {
      const adv = await rpc("onboard_advance", { p_secret: ing(env), p_email: email, p_step: "report" });
      const mail = await fireStep(env, "report", email, { name: body.name, lang: body.lang, loseMonthly: body.loseMonthly });
      return json({ ok: true, advanced: adv || null, sent: mail });
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}

// GET vote capture for the one-question check-in 1-tap links. Records sentiment; lukewarm/cold is
// flagged via onboard_sentiment (the churn/XM layer + owner can act on it). Returns a tiny thank-you page.
export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const sweep = url.searchParams.get("sweep");
    if (sweep) return runSweep(request, env, sweep);
    // fix (audit): throttle the public 1-tap vote link so it can't be scripted to flip sentiment.
    if (await rateLimited(request, env, "onboarding-vote", 20)) return htmlPage("Muitas tentativas — tente de novo em instantes.");
    const vote = (url.searchParams.get("vote") || "").toLowerCase();
    const email = cleanEmail(url.searchParams.get("email"));
    if (!["warm", "lukewarm", "cold"].includes(vote) || !email.includes("@")) {
      return htmlPage("Thanks — your note didn't register, please reply to the email instead.");
    }
    await rpc("onboard_sentiment", { p_secret: ing(env), p_email: email, p_val: vote });
    const msg = vote === "warm"
      ? "Wonderful — thank you. We're glad it's going well. 🌱"
      : "Thank you for the honesty. A real person will reach out shortly to make it right.";
    return htmlPage(msg);
  } catch {
    return htmlPage("Thank you.");
  }
}

function htmlPage(msg) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guileo</title></head>
<body style="margin:0;background:#0e0d0b;color:#f4f1ea;font-family:'Inter','Segoe UI',Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="max-width:440px;text-align:center;padding:32px;"><div style="font-size:22px;font-weight:800;color:#d6c29a;margin-bottom:10px;">Guileo</div>
<div style="font-size:16px;line-height:1.6;color:#ede7dc;">${esc(msg)}</div></div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...apiSecurityHeaders } });
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestOptions() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, x-guileo-secret", ...apiSecurityHeaders } });
}
