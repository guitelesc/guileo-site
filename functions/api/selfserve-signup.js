// Cloudflare Pages Function — POST /api/selfserve-signup
// The /go-live wizard calls this on submit. It STORES the client's brain (business, sector,
// language, phone, brain) keyed by email in gui_pending_onboarding, so when their Stripe
// payment lands, /api/stripe-webhook builds their trained Gui automatically — no manual step.
// It does NOT create the agent here (payment is the gate → no free-creation abuse).
//   POST { email, business, industry?, lang?, brain?, phone? } -> { ok, stored }
import { sameOrigin, rateLimited } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
// dedicated server-side secret — matches public._gui_pend_ok() in the DB. Server-only (never shipped
// to browser). Set PEND_SECRET in Cloudflare env + update the DB literal to ROTATE; the inline value
// is only a fallback so signup never breaks before the env var is set.
const PEND_FALLBACK = "gx_pend_7Qk2mZ9vR4tLpW8n_cit3l3s";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "selfserve-signup", 8)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    // honeypot — silently accept bots without storing
    if ((b.website || "").toString().trim()) return json({ ok: true, stored: false });

    const email = (b.email || "").toString().trim().toLowerCase();
    if (!email.includes("@")) return json({ error: "valid email required" }, 400);

    const s = (v, n) => (v == null ? "" : v.toString().slice(0, n));
    const lang = ["pt", "es", "en"].includes(b.lang) ? b.lang : "en";
    const PEND_SECRET = env.PEND_SECRET || PEND_FALLBACK;
    const base = {
      p_secret: PEND_SECRET, p_email: email,
      p_business: s(b.business, 160), p_industry: s(b.industry, 80),
      p_lang: lang, p_brain: s(b.brain, 4000), p_phone: s(b.phone, 40),
    };
    // try the white-label-aware signature first; fall back to the 7-arg one if the agent_name
    // migration (db/pending_onboarding_agentname.sql) hasn't been applied yet — never regress signup.
    let r = await rpc("save_pending_onboarding", { ...base, p_agent_name: s(b.agent_name, 40) });
    if (!r.ok) r = await rpc("save_pending_onboarding", base);
    if (!r.ok) return json({ ok: false, stored: false, error: `db ${r.status}` }, 503);
    return json({ ok: true, stored: true });
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 400);
  }
}
