// Cloudflare Pages Function — POST /api/crm  (COMPANY OS: CRM contact book, read-only phase 1)
// Returns a tenant's unified contact spine (crm_contacts) — the 360° book every department reads.
// Admin-gated for now; graceful note until db/crm_spine.sql is pasted.
//   POST { token, email, limit? } -> { ok, ready, count, contacts:[...] }
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE: get_client_data binds email↔connection-key and returns null on a mismatch,
    // so one tenant's key can NEVER read another tenant's contacts/invoices/timeline by passing a
    // different email. Same proven gate call-logs/appointments/billing use. No OWNER_EMAIL fallback
    // (a blank email must never default to the owner's CRM).
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

    const secret = env.SCHED_SECRET || "";
    const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // ── action: timeline — a single contact's 360° history (crm_timeline) ──
    if (b.action === "timeline") {
      const contactId = (b.contact_id || "").toString();
      if (!/^[0-9a-f-]{36}$/i.test(contactId)) return json({ ok: true, ready: true, events: [] });
      const tr = await rpc("crm_timeline", { p_secret: secret, p_email: email, p_contact_id: contactId, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 100, 1), 500) });
      if (!tr.ok) return json({ ok: true, ready: false, note: "Paste db/crm_phase2.sql to activate the 360° timeline.", events: [] });
      const events = (await tr.json()) || [];
      return json({ ok: true, ready: true, count: events.length, events });
    }

    // ── action: deals — the sales pipeline (crm_deals_list) ──
    if (b.action === "deals") {
      const dr = await rpc("crm_deals_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 300, 1), 1000) });
      if (!dr.ok) return json({ ok: true, ready: false, note: "Paste db/crm_deals_list.sql to activate the pipeline board.", deals: [] });
      const deals = (await dr.json()) || [];
      return json({ ok: true, ready: true, count: deals.length, deals });
    }

    // ── action: deal_move — advance a deal one stage (crm_deal_move, INGEST-gated) ──
    // The pipeline board's "→" button. Tenant-scoped in SQL: the update only matches the
    // caller's own client_email, so a key can never move another tenant's deal.
    if (b.action === "deal_move") {
      const dealId = (b.deal_id || "").toString();
      const stage = (b.stage || "").toString();
      if (!/^[0-9a-f-]{36}$/i.test(dealId)) return json({ error: "invalid deal_id" }, 400);
      if (!["inquiry", "quoted", "booked", "won", "lost"].includes(stage)) return json({ error: "invalid stage" }, 400);
      const mr = await fetch(`${SB}/rest/v1/rpc/crm_deal_move`, {
        method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_email: email, p_deal_id: dealId, p_stage: stage, p_key: key }),
      });
      if (!mr.ok) return json({ ok: false, ready: false, note: "Paste db/crm_deal_move.sql to activate stage moves." });
      const moved = (await mr.json().catch(() => [])) || [];
      if (!Array.isArray(moved) || !moved.length) return json({ ok: false, ready: true, note: "deal not found" });
      return json({ ok: true, ready: true, deal: moved[0] });
    }

    // ── action: invoices — Finance A/R (crm_invoices_list) ──
    if (b.action === "invoices") {
      const ir = await rpc("crm_invoices_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 300, 1), 1000) });
      if (!ir.ok) return json({ ok: true, ready: false, note: "Paste db/crm_finance.sql to activate Finance.", invoices: [] });
      const invoices = (await ir.json()) || [];
      return json({ ok: true, ready: true, count: invoices.length, invoices });
    }

    // ── action: campaigns — Marketing (crm_campaigns_list) ──
    if (b.action === "campaigns") {
      const cr = await rpc("crm_campaigns_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 500) });
      if (!cr.ok) return json({ ok: true, ready: false, note: "Paste db/crm_marketing.sql to activate Marketing.", campaigns: [] });
      const campaigns = (await cr.json()) || [];
      return json({ ok: true, ready: true, count: campaigns.length, campaigns });
    }

    // ── action: segment_count — live audience size for a Marketing segment ──
    if (b.action === "segment_count") {
      const sr = await rpc("crm_segment_count", { p_secret: secret, p_email: email, p_segment: (b.segment || "all").toString() });
      if (!sr.ok) return json({ ok: true, ready: false, count: 0 });
      const n = await sr.json();
      return json({ ok: true, ready: true, count: Number(n) || 0 });
    }

    // INGEST-gated growth RPCs (crm_leads_today / marketing_dates_*) check the literal ingest
    // secret, NOT SCHED_SECRET — same gate deal_move uses. Blank → RPC 28000 → honest ready:false.
    const ingest = env.INGEST_SECRET || "";

    // ── action: leads_today — today's brand-new contacts (crm_leads_today) for "Leads do dia" ──
    if (b.action === "leads_today") {
      const lr = await rpc("crm_leads_today", { p_secret: ingest, p_email: email });
      if (!lr.ok) return json({ ok: true, ready: false, note: "Paste db/crm_capture.sql to activate Leads do dia.", count: 0, leads: [] });
      const leads = (await lr.json().catch(() => [])) || [];
      const arr = Array.isArray(leads) ? leads : [];
      return json({ ok: true, ready: true, count: arr.length, leads: arr });
    }

    // ── action: lead_callback — REAL callback through the hardened dial gate (/api/call), the SAME
    // path the funnel/marketplace responder uses. No fabricated success: {ok} reflects the actual
    // dial result, so the cockpit only toasts "calling back" when a call really fired. ──
    if (b.action === "lead_callback") {
      const phone = (b.phone || "").toString().trim();
      if (!/^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ""))) return json({ ok: false, ready: true, note: "no valid phone on this lead" });
      const origin = new URL(request.url).origin;
      let ok = false;
      try {
        const cr = await fetch(`${origin}/api/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin, "x-guileo-internal": env.DIGEST_TOKEN || "" },
          body: JSON.stringify({ phone, name: (b.name || "").toString().slice(0, 120), need: "returning your request", lang: "auto" }),
        });
        const cj = await cr.json().catch(() => ({}));
        ok = cr.ok && cj && cj.ok === true;   // skipped/opted-out/limited → ok:false, honest toast
      } catch { ok = false; }
      return json({ ok, ready: true });
    }

    // ── action: marketing_dates — commemorative dates + birthday config (marketing_dates_list) ──
    if (b.action === "marketing_dates") {
      const mr = await rpc("marketing_dates_list", { p_secret: ingest, p_client_email: email, p_key: key });
      if (!mr.ok) return json({ ok: true, ready: false, note: "Paste db/growth_dates.sql to activate marketing dates.", dates: [] });
      const mj = await mr.json().catch(() => ({}));
      return json({ ok: true, ready: true, dates: Array.isArray(mj?.dates) ? mj.dates : [] });
    }

    // ── action: marketing_date_set — add/edit a date or birthday config (marketing_dates_set) ──
    if (b.action === "marketing_date_set") {
      const d = (b.date && typeof b.date === "object") ? b.date : {};
      const month = parseInt(d.month, 10), day = parseInt(d.day, 10);
      if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return json({ ok: false, ready: true, note: "invalid month/day" });
      const id = (d.id || "").toString();
      const sr = await rpc("marketing_dates_set", {
        p_secret: ingest, p_client_email: email,
        p_kind: (d.kind || "holiday").toString(), p_label: (d.label || "").toString(),
        p_month: month, p_day: day,
        p_message: (d.message || "").toString(), p_offer: (d.offer || "").toString(),
        p_active: d.active !== false,
        p_id: /^[0-9a-f-]{36}$/i.test(id) ? id : null,
      });
      if (!sr.ok) return json({ ok: false, ready: false, note: "Paste db/growth_dates.sql to activate marketing dates." });
      const sj = await sr.json().catch(() => ({}));
      if (!sj || sj.ok !== true) return json({ ok: false, ready: true, note: sj?.reason || "not saved" });
      return json({ ok: true, ready: true, date: { id: sj.id } });
    }

    // ── action: marketing_date_delete — remove a commemorative date (marketing_dates_delete) ──
    if (b.action === "marketing_date_delete") {
      const id = (b.id || "").toString();
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid id" }, 400);
      const dr = await rpc("marketing_dates_delete", { p_secret: ingest, p_client_email: email, p_id: id });
      if (!dr.ok) return json({ ok: false, ready: false, note: "Paste db/growth_dates.sql to activate marketing dates." });
      const dj = await dr.json().catch(() => ({}));
      return json({ ok: dj?.ok === true, ready: true });
    }

    // ── UNKNOWN action → 400. NEVER silently fall through to the contact book faking {ok:true}
    // (a phantom "success" toast with no real effect = a lead lost in silence). Only a bare call
    // with no action reaches the contact-book default below. ──
    if (b.action) return json({ error: "unknown action" }, 400);

    // ── default: the contact book (crm_list_contacts) ──
    const limit = Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 1000);
    // p_key → the RPC re-asserts the client key INSIDE the DB (defense against a direct-to-Supabase
    // call that bypasses this Worker's get_client_data gate). Hardening slice 1.
    const r = await rpc("crm_list_contacts", { p_secret: secret, p_email: email, p_limit: limit, p_key: key });
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/crm_spine.sql in Supabase to activate the CRM.", count: 0, contacts: [] });
    const rows = (await r.json()) || [];
    return json({ ok: true, ready: true, count: rows.length, contacts: rows });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
