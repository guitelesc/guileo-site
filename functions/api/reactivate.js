// Cloudflare Pages Function — POST /api/reactivate  (SUPERPOWER #1: mass reactivation blitz)
// On demand, reactivate a tenant's ENTIRE lapsed-customer base at once — 1:1 personalized — by SMS and/or
// by a real Gui call. The thing no human front desk could do: reach hundreds of dormant customers in minutes.
// Reuses the existing due_winback source (so it auto-dedupes with the cron win-back and respects its window)
// and the hardened dial path (DNC honored for calls). Admin-gated; capped; every send logged.
//   POST { token, email, channel?: "sms"|"call"|"both", offer?, limit?, lang? } -> { ok, pulled, sms, calls, skipped }
import { json } from "../lib/guard.js";
import { sendText } from "../lib/twilio.js";
import { sbKey } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (env, fn, args = {}) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
}).then((r) => (r.ok ? r.json() : null)).catch(() => null);

const ingest = (env, email, summary, phone) => rpc(env, "ingest_client_event", {
  p_email: email, p_type: "winback", p_channel: "Phone", p_summary: summary.slice(0, 300), p_amount: 0, p_payload: { phone, blitz: true },
});

async function isDnc(env, phone) {
  if (!env.INGEST_SECRET) return false;
  try { const r = await fetch(`${SB}/rest/v1/rpc/is_dnc`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_phone: phone }) }); return r.ok && (await r.json()) === true; } catch { return false; }
}

async function tenantAgent(env, email) {
  const id = (await rpc(env, "client_agent_lookup", { p_email: email })) || "";
  return /^agent_[a-z0-9]+$/i.test(String(id)) ? String(id) : (env.ELEVENLABS_AGENT_ID || "agent_5901ktdkev68f5kb161fmeax1rdm");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — bind the cockpit email to its connection key (get_client_data rejects a
    // mismatch). This endpoint fires REAL SMS/calls, so a token must only ever reactivate ITS OWN
    // tenant's lapsed list — never an arbitrary email. No OWNER_EMAIL fallback.
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);
    const channel = ["sms", "call", "both"].includes(b.channel) ? b.channel : "sms";
    const offer = (b.offer || "").toString().slice(0, 160);
    const limit = Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 500); // hard ceiling 500/run
    const callCap = Math.min(limit, 60); // calls cost real money — separate, lower ceiling
    const lang = (b.lang || "").toString().toLowerCase();
    const dryRun = b.dryRun === true || b.dryRun === "1"; // preview WHO + WHAT without sending a single message
    const note = (b.note || "").toString().slice(0, 160); // free-text label from the cockpit (echoed back + logged)

    // Pull the lapsed list (global), keep only this tenant's, up to the limit.
    const rows = ((await rpc(env, "due_winback")) || []).filter((c) => (c.client_email || "").toLowerCase() === email).slice(0, limit);
    const out = { ok: true, dryRun, channel, ...(note ? { note } : {}), pulled: rows.length, sms: 0, calls: 0, skipped: 0, sample: [] };

    let calls = 0;
    for (const c of rows) {
      const phone = (c.customer_phone || "").toString();
      const e164 = phone.replace(/[^0-9+]/g, "");
      if (!/^\+?[1-9]\d{7,14}$/.test(e164)) { out.skipped++; continue; }
      const pt = lang.startsWith("pt") || (c.lang || "").toString().toLowerCase().startsWith("pt");
      const nome = c.customer_name || (pt ? "tudo bem" : "there");
      const biz = c.business_name || (pt ? "a gente" : "us");
      const last = c.last_summary || c.last_item || "";
      // 1:1 personalized message — name + business + (optional) reference to their last visit + the owner's offer.
      const msg = pt
        ? `Oi ${nome}! Sentimos sua falta n${biz === "a gente" ? "a " + biz : "a " + biz} 🌱${last ? ` (você curtiu ${last})` : ""} ${offer || "Tá com vontade de voltar essa semana? É só responder aqui!"}`.trim()
        : `Hi ${nome}! We've missed you at ${biz} 🌱${last ? ` (you loved ${last})` : ""} ${offer || "Want to come back this week? Just reply here!"}`.trim();

      if (await isDnc(env, e164)) { out.skipped++; continue; }

      // DRY RUN — show who'd be reached + a sample RENDERED message, send NOTHING, spend nothing.
      // Counts mirror the real run per channel so the cockpit preview matches what confirm would do.
      if (dryRun) {
        if (channel === "sms" || channel === "both") out.sms++;
        if ((channel === "call" || channel === "both") && out.calls < callCap) out.calls++;
        if (out.sample.length < 3) out.sample.push({ to: `${e164.slice(0, 4)}…${e164.slice(-2)}`, name: nome, msg });
        continue;
      }

      let touched = false;
      if (channel === "sms" || channel === "both") {
        const r = await sendText(env, e164, msg);
        if (r && r.sent) { out.sms++; touched = true; }
      }
      if ((channel === "call" || channel === "both") && calls < callCap && env.ELEVENLABS_API_KEY && env.ELEVENLABS_PHONE_NUMBER_ID) {
        try {
          const agent_id = await tenantAgent(env, email);
          const cr = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
            method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ agent_id, agent_phone_number_id: env.ELEVENLABS_PHONE_NUMBER_ID, to_number: e164,
              conversation_initiation_client_data: { dynamic_variables: { name: nome, business: biz, need: `win-back: ${offer || "invite them back"}`, lang: pt ? "pt" : "auto" } } }),
          });
          if (cr.ok) { out.calls++; calls++; touched = true; }
        } catch { /* SMS still counts */ }
      }

      if (touched) await ingest(env, email, `♻️ Reactivation blitz → ${nome} (${channel})`, e164);
      else out.skipped++;
    }
    return json(out);
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
