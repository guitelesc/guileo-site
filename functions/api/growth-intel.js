// Cloudflare Pages Function — POST /api/growth-intel  (GROWTH INTELLIGENCE cockpit)
// Per-tenant cockpit reader for the "Inteligência" tab: LTV, lead-source attribution,
// 7-day forecast, and the abandoned-booking recovery queue.
//   POST { token, email, action:"ltv" }       -> { ok, ready, ltv:{...} }
//   POST { token, email, action:"sources", days? } -> { ok, ready, sources:[...] }
//   POST { token, email, action:"forecast" }  -> { ok, ready, forecast:{...} }
//   POST { token, email, action:"abandoned", older_min? } -> { ok, ready, count, intents:[...] }
//   POST { token, email, action:"recover", intent_id, name?, contact? } -> { ok, claimed }
// Reads via growth_intel.sql RPCs (INGEST-gated server-side). Same proven per-tenant
// gate call-logs/crm/noshow-radar use: get_client_data binds email↔connection-key and
// returns null on a mismatch, so one tenant's key can NEVER read another tenant's data.
// No OWNER_EMAIL fallback. Graceful { ready:false } note until db/growth_intel.sql is pasted.
import { json } from "../lib/guard.js";
import { reengageEmail } from "../lib/emailTemplates.js";

const isEmailAddr = (s) => /.+@.+\..+/.test((s || "").toString());
async function sendReengageEmail(env, to, name) {
  if (!env.RESEND_API_KEY || !isEmailAddr(to)) return false;
  try {
    const { subject, html } = reengageEmail({ name: name || "there", business: "", lang: "en" });
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
    });
    return true;
  } catch { return false; }
}

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const secret = env.INGEST_SECRET || "";
    const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const notPasted = { ok: true, ready: false, note: "Paste db/growth_intel.sql in Supabase to activate Growth Intelligence." };

    const action = (b.action || "ltv").toString();

    if (action === "sources") {
      const days = Math.min(Math.max(parseInt(b.days, 10) || 90, 7), 365);
      const r = await rpc("crm_lead_sources", { p_secret: secret, p_email: email, p_days: days });
      if (!r.ok) return json({ ...notPasted, sources: [] });
      const sources = (await r.json()) || [];
      return json({ ok: true, ready: true, sources });
    }

    if (action === "forecast") {
      const r = await rpc("crm_forecast", { p_secret: secret, p_email: email });
      if (!r.ok) return json({ ...notPasted, forecast: null });
      const forecast = await r.json().catch(() => null);
      return json({ ok: true, ready: true, forecast });
    }

    if (action === "abandoned") {
      const older = Math.min(Math.max(parseInt(b.older_min, 10) || 30, 5), 1440);
      const r = await rpc("booking_intents_abandoned", { p_secret: secret, p_email: email, p_older_min: older, p_limit: 50 });
      if (!r.ok) return json({ ...notPasted, count: 0, intents: [] });
      const intents = (await r.json()) || [];
      return json({ ok: true, ready: true, count: intents.length, intents });
    }

    if (action === "recover") {
      // 1-click Gui follow-up on an abandoned booking: claim it (dedup) then log a
      // client_event so it shows in the live feed and Gui's callback picks it up.
      const intentId = (b.intent_id || "").toString().trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intentId)) return json({ error: "bad intent_id" }, 400);
      const cr = await rpc("intent_recovery_claim", { p_secret: secret, p_email: email, p_intent_id: intentId });
      if (!cr.ok) return json({ ...notPasted, claimed: false });
      const claimed = await cr.json().catch(() => false);
      if (claimed === true) {
        const who = (b.name || "").toString().slice(0, 120) || "Cliente";
        await rpc("ingest_client_event", {
          p_secret: secret, p_email: email, p_type: "message", p_channel: "Portal",
          p_summary: `Recuperação de agendamento: Gui vai chamar ${who} de volta`.slice(0, 300),
          p_amount: 0,
          p_payload: { kind: "booking-recovery", intent_id: intentId, contact: (b.contact || "").toString().slice(0, 160) },
        });
      }
      return json({ ok: true, claimed: claimed === true });
    }

    if (action === "churn") {
      // Clientes fiéis prestes a sumir: pontua 0-100 quem tem PADRÃO real (≥3 visitas, ≥14d),
      // devolve top em risco (>=50) com ação sugerida (call/sms/watch). Nunca cria falso-positivo.
      const r = await rpc("churn_risk_scan", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 25, 1), 100) });
      if (!r.ok) return json({ ...notPasted, atRisk: [] });
      const atRisk = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(atRisk) ? atRisk.length : 0, atRisk });
    }

    if (action === "reengage") {
      // 1-clique: a Gui reativa sozinha um cliente em risco. Loga um client_event que o motor
      // de callback (call.js / win-back) captura → a Gui liga ou manda SMS de volta. Mesmo padrão do recover.
      const who = (b.name || "").toString().slice(0, 120) || "Cliente";
      const contact = (b.contact || "").toString().slice(0, 160);
      if (!contact) return json({ error: "contact required" }, 400);
      const suggested = ["call", "sms", "watch"].includes((b.suggested || "").toString()) ? b.suggested : "sms";
      // If the contact is an EMAIL, Gui reactivates RIGHT NOW (branded reengageEmail, works today).
      // Phone-only routes to SMS/call when A2P/opt-in is live — logged either way so it's in the feed.
      const emailed = isEmailAddr(contact) ? await sendReengageEmail(env, contact, who) : false;
      const via = emailed ? "email" : suggested;
      await rpc("ingest_client_event", {
        p_secret: secret, p_email: email, p_type: emailed ? "winback" : (suggested === "call" ? "call" : "message"),
        p_channel: emailed ? "email" : "Portal",
        p_summary: (emailed ? `♻️ Gui reativou ${who} por email (risco de perder)` : `Reativação: Gui vai ${suggested === "call" ? "ligar para" : "mandar SMS para"} ${who} (risco de perder)`).slice(0, 300),
        p_amount: 0,
        p_payload: { kind: "churn-reengage", contact: emailed ? contact.toLowerCase() : contact, suggested, via, risk: Number(b.risk) || null },
      });
      return json({ ok: true, queued: true, via, sent: emailed });
    }

    // default: ltv
    const r = await rpc("crm_ltv", { p_secret: secret, p_email: email });
    if (!r.ok) return json({ ...notPasted, ltv: null });
    const ltv = await r.json().catch(() => null);
    return json({ ok: true, ready: true, ltv });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
