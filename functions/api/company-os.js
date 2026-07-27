// Cloudflare Pages Function — POST /api/company-os
// ADMIN-ONLY. Guileo roda na Guileo: o rollup vivo dos 8 departamentos da própria companhia.
// Same admin gate as company-finance / onboard-client (blitz_stats raises on a wrong token).
//   { action:"departments", token } -> { ok, departments:[{key,label,icon,accent,kpi_value,kpi_label,ready}, …] }
//   SALES (pipeline vivo, cross-tenant):
//     { action:"sales", token }                         -> { ok, ready, stages:[…], deals:[…] }
//     { action:"deal_move", token, deal_id, stage }     -> { ok, tenant, stage, status }
//     { action:"deal_followup", token, deal_id }        -> { ok, via, sent } (Gui email se contato tem email)
//   SUPPORT (fila acionável, cross-tenant — reusa os RPCs SCHED de db/support.sql):
//     { action:"support", token }                       -> { ok, tickets:[…] }
//     { action:"ticket_set", token, id, status, resolution? }  -> { ok }
//     { action:"ticket_reply", token, id, text, role? } -> { ok }
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { reengageEmail, appointmentReminderEmail, proposalEmail, loyaltyMilestoneEmail } from "../lib/emailTemplates.js";

const whenLabelOf = (iso) => { try { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")} · ${d.toISOString().slice(11,16)}`; } catch { return ""; } };

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const isEmailAddr = (s) => /.+@.+\..+/.test((s || "").toString());
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((s || "").toString());
async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !isEmailAddr(to)) return false;
  try {
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }) });
    return true;
  } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "company-os", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "departments").toString();
    const ING = env.INGEST_SECRET || "";
    // ADMIN gate — same RPC as company-finance. Wrong token raises → non-200 → 401.
    const gate = await rpc("blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
    if (!gate.ok) return json({ error: "unauthorized" }, 401);

    const SCH = env.SCHED_SECRET || "";

    if (action === "departments") {
      const r = await rpc("company_os_departments", { p_secret: ING });
      if (!r.ok) return json({ error: "departments unavailable" }, 500);
      const rows = await r.json().catch(() => []);
      if (rows && rows.error) return json({ error: "departments unavailable" }, 500);
      return json({ ok: true, departments: Array.isArray(rows) ? rows : [] });
    }

    // ── 💼 SALES — pipeline vivo cross-tenant ──
    if (action === "sales") {
      const r = await rpc("company_sales_pipeline", { p_secret: ING });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ ok: true, ready: false, stages: [], deals: [] });
      return json({ ok: true, ready: p.ready !== false, stages: p.stages || [], deals: p.deals || [] });
    }
    if (action === "deal_move") {
      if (!isUuid(b.deal_id)) return json({ error: "bad deal_id" }, 400);
      const r = await rpc("company_deal_move", { p_secret: ING, p_deal_id: b.deal_id, p_stage: (b.stage || "").toString() });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ error: p?.error || "move failed" }, 400);
      return json(p);
    }
    if (action === "deal_followup") {
      if (!isUuid(b.deal_id)) return json({ error: "bad deal_id" }, 400);
      const r = await rpc("company_deal_followup", { p_secret: ING, p_deal_id: b.deal_id });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ error: p?.error || "followup failed" }, 400);
      // Gui follows up NOW by branded email when the contact has one (works today); phone waits on A2P.
      let sent = false;
      if (isEmailAddr(p.contact_email)) {
        const { subject, html } = reengageEmail({ name: p.contact_name || "there", business: "", lang: "en" });
        sent = await sendEmail(env, p.contact_email, subject, html);
      }
      return json({ ok: true, tenant: p.tenant, title: p.title, via: sent ? "email" : "queued", sent });
    }

    // ── 🎚️ AUTONOMIA — dial por tenant (off/safe/full) + saúde dos agentes ──
    if (action === "autonomy") {
      const r = await rpc("autonomy_all", { p_secret: ING });
      const rows = r.ok ? await r.json().catch(() => []) : [];
      return json({ ok: true, levels: Array.isArray(rows) ? rows : [] });
    }
    if (action === "autonomy_set") {
      const em = (b.email || "").toString().trim().toLowerCase();
      if (!em.includes("@")) return json({ error: "bad email" }, 400);
      if (!["off", "safe", "full"].includes((b.level || "").toString())) return json({ error: "bad level" }, 400);
      const r = await rpc("autonomy_set", { p_secret: ING, p_email: em, p_level: b.level });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ error: p?.error || "set failed" }, 400);
      return json(p);
    }
    if (action === "agents_health") {
      const r = await rpc("company_agents_health", { p_secret: ING });
      const p = r.ok ? await r.json().catch(() => null) : null;
      return json({ ok: true, ...(p && !p.error ? p : { ready: false, count: 0, unhealthy: [] }) });
    }

    // ── 🧭 CENTRO DE COMANDO — "o que precisa de atenção agora" (leitura cross-dept) ──
    if (action === "brief") {
      const r = await rpc("company_os_brief", { p_secret: ING });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ ok: true, ready: false });
      return json({ ok: true, ...p });
    }

    // ── 🚀 GROWTH — fila de churn cross-tenant + Gui reativa (email real) ──
    if (action === "growth") {
      const r = await rpc("company_growth_queue", { p_secret: ING, p_limit: 40 });
      const rows = r.ok ? await r.json().catch(() => []) : [];
      return json({ ok: true, ready: r.ok, atRisk: Array.isArray(rows) ? rows : [] });
    }
    if (action === "growth_reengage") {
      if (!isUuid(b.contact_id)) return json({ error: "bad contact_id" }, 400);
      const r = await rpc("company_growth_reengage", { p_secret: ING, p_contact_id: b.contact_id });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ error: p?.error || "reengage failed" }, 400);
      let sent = false;
      if (isEmailAddr(p.contact_email)) {
        const { subject, html } = reengageEmail({ name: p.contact_name || "there", business: "", lang: "en" });
        sent = await sendEmail(env, p.contact_email, subject, html);
        if (sent) await rpc("ingest_client_event", { p_secret: ING, p_email: p.tenant, p_type: "winback", p_channel: "email",
          p_summary: `♻️ Gui reativou ${p.contact_name || "cliente"} (risco ${p.risk}%) via Company OS`.slice(0, 300),
          p_amount: 0, p_payload: { contact: (p.contact_email || "").toLowerCase(), kind: "churn", risk: p.risk } });
      }
      return json({ ok: true, tenant: p.tenant, via: sent ? "email" : "queued", sent });
    }

    // ── ⚙️ OPERATIONS — agendamentos próximos + Gui lembra (email real) ──
    if (action === "ops") {
      const r = await rpc("company_ops_upcoming", { p_secret: ING, p_hours: 48, p_limit: 60 });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ ok: true, ready: false, appointments: [] });
      return json({ ok: true, ready: p.ready !== false, appointments: p.appointments || [] });
    }
    if (action === "ops_remind") {
      if (!isUuid(b.appt_id)) return json({ error: "bad appt_id" }, 400);
      const r = await rpc("company_ops_remind", { p_secret: ING, p_appt_id: b.appt_id });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ error: p?.error || "remind failed" }, 400);
      let sent = false;
      if (isEmailAddr(p.contact)) {
        const { subject, html } = appointmentReminderEmail({ name: p.customer || "there", service: "", whenLabel: whenLabelOf(p.when), ref: "", lang: "pt", bizEmail: p.tenant });
        sent = await sendEmail(env, p.contact, subject, html);
      }
      return json({ ok: true, tenant: p.tenant, via: sent ? "email" : "queued", sent });
    }

    // ── 📣 MARKETING — leads recentes cross-tenant + Gui nutre (proposalEmail real) ──
    if (action === "marketing") {
      const r = await rpc("company_marketing_leads", { p_secret: ING, p_limit: 40 });
      const rows = r.ok ? await r.json().catch(() => []) : [];
      return json({ ok: true, ready: r.ok, leads: Array.isArray(rows) ? rows : [] });
    }
    if (action === "marketing_nurture") {
      if (!isUuid(b.contact_id)) return json({ error: "bad contact_id" }, 400);
      const r = await rpc("company_marketing_nurture", { p_secret: ING, p_contact_id: b.contact_id });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ error: p?.error || "nurture failed" }, 400);
      let sent = false;
      if (isEmailAddr(p.contact_email)) {
        const { subject, html } = proposalEmail({ name: p.contact_name || "there", business: "", lang: "en" });
        sent = await sendEmail(env, p.contact_email, subject, html);
        if (sent) await rpc("ingest_client_event", { p_secret: ING, p_email: p.tenant, p_type: "nurture", p_channel: "email",
          p_summary: `📣 Gui nutriu o lead ${p.contact_name || ""} via Company OS`.slice(0, 300),
          p_amount: 0, p_payload: { contact: (p.contact_email || "").toLowerCase(), kind: "nurture" } });
      }
      return json({ ok: true, tenant: p.tenant, via: sent ? "email" : "queued", sent });
    }

    // ── 🗂️ CRM — VIPs por LTV cross-tenant + Gui agradece (loyaltyMilestoneEmail real) ──
    if (action === "crm") {
      const r = await rpc("company_crm_vips", { p_secret: ING, p_limit: 30 });
      const rows = r.ok ? await r.json().catch(() => []) : [];
      return json({ ok: true, ready: r.ok, vips: Array.isArray(rows) ? rows : [] });
    }
    if (action === "crm_thank") {
      if (!isUuid(b.contact_id)) return json({ error: "bad contact_id" }, 400);
      const r = await rpc("company_crm_thank", { p_secret: ING, p_contact_id: b.contact_id });
      const p = r.ok ? await r.json().catch(() => null) : null;
      if (!p || p.error) return json({ error: p?.error || "thank failed" }, 400);
      let sent = false;
      if (isEmailAddr(p.contact_email)) {
        const { subject, html } = loyaltyMilestoneEmail({ name: p.contact_name || "there", business: "", milestone: p.visits || 10, lang: "en" });
        sent = await sendEmail(env, p.contact_email, subject, html);
        if (sent) await rpc("ingest_client_event", { p_secret: ING, p_email: p.tenant, p_type: "loyalty", p_channel: "email",
          p_summary: `🗂️ Gui agradeceu ${p.contact_name || "cliente VIP"} (${p.visits || 0} visitas) via Company OS`.slice(0, 300),
          p_amount: 0, p_payload: { contact: (p.contact_email || "").toLowerCase(), kind: "loyalty" } });
      }
      return json({ ok: true, tenant: p.tenant, via: sent ? "email" : "queued", sent });
    }

    // ── 🎧 SUPPORT — fila acionável cross-tenant (RPCs SCHED-gated de db/support.sql) ──
    if (action === "support") {
      const r = await rpc("support_ticket_list", { p_secret: SCH, p_email: "", p_limit: 200 });
      const rows = r.ok ? await r.json().catch(() => []) : [];
      return json({ ok: true, ready: r.ok, tickets: Array.isArray(rows) ? rows : [] });
    }
    if (action === "ticket_set") {
      if (!isUuid(b.id)) return json({ error: "bad id" }, 400);
      const r = await rpc("support_ticket_set", { p_secret: SCH, p_id: b.id, p_status: b.status || null, p_resolution: b.resolution || null, p_assigned: b.assigned || null });
      // FIX (audit): report the RPC's boolean, not the HTTP status — a no-op (ticket not found) must not read as success.
      const okb = r.ok ? (await r.json().catch(() => false)) === true : false;
      return json({ ok: okb });
    }
    if (action === "ticket_reply") {
      if (!isUuid(b.id)) return json({ error: "bad id" }, 400);
      const text = (b.text || "").toString().trim();
      if (!text) return json({ error: "empty reply" }, 400);
      const r = await rpc("support_ticket_reply", { p_secret: SCH, p_id: b.id, p_role: (b.role === "human" ? "human" : "gui"), p_text: text });
      const okb = r.ok ? (await r.json().catch(() => false)) === true : false;
      return json({ ok: okb });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
