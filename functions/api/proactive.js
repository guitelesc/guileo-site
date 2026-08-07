// Cloudflare Pages Function — POST /api/proactive?token=DIGEST_TOKEN  (called by the cron worker)
// The AUTONOMOUS engine (H2): Gui acts without being asked. TCPA-safe — reactivation goes by EMAIL
// (branded reengageEmail) to dormant customers who have an email; it never auto-dials. Reminders for
// upcoming appointments are collected (biz_due_reminders) and emailed where an email exists (SMS lights
// up at A2P). Per-business; iterates the configured client list (PROACTIVE_EMAILS) or the demo set.
import { json, safeEq } from "../lib/guard.js";
import { sbKey } from "../lib/sb.js";
import { reengageEmail, appointmentReminderEmail, birthdayEmail, anniversaryEmail, recallEmail, loyaltyMilestoneEmail, welcomeFirstVisitEmail, rebookEmail, promoEmail, proposalEmail, moneyRecoveredEmail } from "../lib/emailTemplates.js";
import { brandFor } from "../lib/clientBrand.js";

// Friendly date label from an ISO timestamp (UTC) — "Sex 20/06 · 14:30".
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const fmtWhen = (iso) => { try { const d = new Date(iso); return `${DOW[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} · ${d.toISOString().slice(11, 16)}`; } catch { return ""; } };

const SCHED_SB = "https://ynihodbknhjirkdogxby.supabase.co";
const SCHED_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const isEmail = (s) => /.+@.+\..+/.test((s || "").toString());
// After-hours heuristic on a captured event timestamp (UTC): call before 08:00, at/after 18:00, or on
// a weekend. Approximation (we don't hold the tenant's timezone) — feeds only the DISCLOSED estimate in
// moneyRecoveredEmail, never presented as cash. Mirrors growth-intel.js money_proof.
const isAfterHours = (iso) => { try { const d = new Date(iso); const h = d.getUTCHours(); const wd = d.getUTCDay(); return wd === 0 || wd === 6 || h < 8 || h >= 18; } catch { return false; } };
// Customer emails go out in the CLIENT profile's language — pt / es / en supported (same rule as automations.js).
const langNorm = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };

const rpc = (env, fn, body) => fetch(`${SCHED_SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: SCHED_ANON, Authorization: `Bearer ${SCHED_ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ ...body, p_secret: env.SCHED_SECRET || "" }),
}).then((r) => r.json()).catch(() => ({}));

// The DATES/growth RPCs (marketing_*, crm_birthday_contacts, marketing_date_claim, db/growth_dates.sql)
// are INGEST-gated, not SCHED-gated — so they get the INGEST secret. Graceful: missing key → {} no-op.
const ingRpc = (env, fn, body) => fetch(`${SCHED_SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
  body: JSON.stringify({ ...body, p_secret: env.INGEST_SECRET || "" }),
}).then((r) => r.json()).catch(() => ({}));

async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !isEmail(to)) return false;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
    });
    return true;
  } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DIGEST_TOKEN || !safeEq(url.searchParams.get("token") || "", env.DIGEST_TOKEN)) return json({ error: "forbidden" }, 401);
  if (!env.SCHED_SECRET) return json({ ok: true, note: "scheduling not configured" });

  // Enumerate live tenants dynamically (same INGEST-gated clients_list RPC nps.js/health-monitor.js
  // use) so every new client joins the birthday/rebooking/dates engines on their own — no env edit.
  // Fallback to the configured env list (or the demo pair) if the RPC is empty/unavailable.
  const envList = (env.PROACTIVE_EMAILS || "clinica@teste.com,salao@teste.com").split(",").map((s) => s.trim()).filter(Boolean);
  const roster = await ingRpc(env, "clients_list", {});
  const listed = (Array.isArray(roster) ? roster : []).map((c) => ((c && c.client_email) || "").toString().trim().toLowerCase()).filter((e) => e.includes("@"));
  const allBizRaw = listed.length ? [...new Set(listed)] : envList;
  // AUTONOMY GUARDRAIL — the owner can pause a client's autonomous actions (level='off'). We read all
  // overrides once (autonomy_all) and SKIP the 'off' tenants; unset/'safe'/'full' still act (email is
  // safe). Money/voice/SMS are NEVER auto here regardless of level — this engine is email-only.
  let offSet = new Set();
  try {
    const autos = await ingRpc(env, "autonomy_all", {});
    if (Array.isArray(autos)) offSet = new Set(autos.filter((a) => a && a.level === "off").map((a) => (a.client_email || "").toLowerCase()));
  } catch { /* fail-open to 'safe' — an autonomy read error must not silently pause everyone */ }
  const allBiz = allBizRaw.filter((e) => !offSet.has(e));
  // ROTATING OFFSET — start the sweep at index (day-of-year % len) so a run that hits the per-run
  // send cap doesn't always starve the SAME tail of the roster; over a week every tenant gets served.
  const doy = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000);
  const off = allBiz.length ? doy % allBiz.length : 0;
  const businesses = off ? [...allBiz.slice(off), ...allBiz.slice(0, off)] : allBiz;
  // PER-RUN SEND CAP — one cron tick sends at most MAX_SENDS emails total (protects the Resend quota
  // and stops a huge roster from timing out mid-sweep). capSend() closes over the counter; once the
  // cap is hit every further send is a no-op and the outer loop breaks.
  const MAX_SENDS = 40;
  let sends = 0;
  const capSend = async (to, subject, html) => {
    if (sends >= MAX_SENDS) return false;
    const ok = await sendEmail(env, to, subject, html);
    if (ok) sends++;
    return ok;
  };
  let reactivated = 0, reminded = 0, birthdays = 0, anniversaries = 0, recalls = 0, loyalty = 0, welcomes = 0, rebooks = 0;
  // DATES + GROWTH (db/growth_dates.sql): crm_contacts.birth_date birthdays, per-client commemorative
  // dates (biz_marketing_dates), and post-service rebooking nudges. All dedup atomically; EMAIL now.
  let crmBirthdays = 0, marketingDates = 0, rebookNudges = 0;
  // MONTHLY VALUE EMAIL to the OWNER — counted separately from customer sends.
  let valueReports = 0;
  const yr = String(new Date().getUTCFullYear());

  for (const email of businesses) {
    if (sends >= MAX_SENDS) break; // per-run cap reached — the rotating offset serves the rest next run
    // Per-tenant language — every lifecycle email below renders in the CLIENT profile's language (was hardcoded).
    const profile = (await ingRpc(env, "get_client_profile", { p_email: email })) || {};
    const L = langNorm(profile.lang);

    // ── MONTHLY VALUE EMAIL (owner) — the branded "here's what Gui recovered for you" proof that
    // justifies the subscription. Sent ONCE per calendar month to the tenant OWNER (client_email —
    // the only owner address we hold), in their brand (logo/accent) + language. REAL numbers only:
    // the SAME data path /api/growth-intel money_proof uses (revenue_month = the authoritative money
    // spine in cents + client_events_since booking count). NEVER fabricated — if the tenant has no
    // collected money AND no bookings this month, we skip entirely (nothing to prove). Dedup is
    // atomic: we only claim the month (marketing_date_claim, kind=value_report, period=YYYY-MM) once
    // we actually have data to send, so a no-data early run doesn't burn the tenant's month, and the
    // claim makes the send idempotent across runs / the rotating offset. INGEST-gated → no-op if the
    // growth RPCs aren't pasted yet. Counts against the same per-run capSend (Resend quota).
    if (env.INGEST_SECRET && isEmail(email) && sends < MAX_SENDS) {
      const vNow = new Date();
      const vMonthStart = new Date(Date.UTC(vNow.getUTCFullYear(), vNow.getUTCMonth(), 1)).toISOString();
      const [vRev, vEvsRaw] = await Promise.all([
        ingRpc(env, "revenue_month", { p_email: email, p_since: vMonthStart }),
        ingRpc(env, "client_events_since", { p_email: email, p_since: vMonthStart }),
      ]);
      const vEvs = Array.isArray(vEvsRaw) ? vEvsRaw : [];
      const vCollectedCents = (vRev && typeof vRev.total_cents === "number") ? Math.max(0, Math.round(vRev.total_cents)) : 0;
      const vBookings = vEvs.filter((e) => e && e.type === "booking").length;
      // Derived after-hours call count (was hardcoded 0) → the monthly email stops shipping a blank stat.
      const vAfterHours = vEvs.filter((e) => e && e.type === "call" && isAfterHours(e.created_at)).length;
      // Only send when there's REAL recovered value to show (money collected or bookings booked).
      if (vCollectedCents > 0 || vBookings > 0) {
        const vPeriod = `${vNow.getUTCFullYear()}-${String(vNow.getUTCMonth() + 1).padStart(2, "0")}`;
        const vClaimed = await ingRpc(env, "marketing_date_claim", { p_client_email: email, p_kind: "value_report", p_ref: "owner", p_period: vPeriod });
        if (vClaimed === true) {
          const brand = await brandFor(env, email);
          const ML = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const vMonthLabel = `${ML[vNow.getUTCMonth()]} ${vNow.getUTCFullYear()}`;
          const { subject, html } = moneyRecoveredEmail({ business: brand.business, logo: brand.logo_url, brandColor: brand.accent, month: vMonthLabel, callsAfterHours: vAfterHours, bookings: vBookings, collectedCents: vCollectedCents, noShowsPrevented: 0, lang: brand.lang });
          if (await capSend(email, subject, html)) valueReports++;
        }
      }
    }

    // #9 churn-save — email a branded win-back to customers dormant 60+ days (only those with an email).
    // TCPA-safe: NEVER auto-dials; email only.
    const dorm = await rpc(env, "biz_dormant_customers", { p_email: email, p_days: 60, p_limit: 25 });
    for (const c of (dorm?.dormant || [])) {
      if (!isEmail(c.contact)) continue;
      const { subject, html } = reengageEmail({ name: c.name || "there", business: "", lang: L });
      if (await capSend(c.contact, subject, html)) {
        reactivated++;
        // FIX (audit HIGH): log a winback event so (a) the churn block below dedups against it in the
        // SAME run (no double reengageEmail to a dormant+at-risk customer), and (b) biz_dormant_customers
        // — now filtered on this same winback — won't re-email daily. One shared dedup ledger.
        await ingRpc(env, "ingest_client_event", { p_email: email, p_type: "winback", p_channel: "email",
          p_summary: `♻️ Reativação (dormente 60d) → ${c.name || "cliente"}`.slice(0, 300), p_amount: 0,
          p_payload: { contact: (c.contact || "").toLowerCase(), kind: "dormant" } });
      }
    }

    // CHURN-SAVE (cadence-based, SMARTER than the flat 60-day dormant): catches a LOYAL customer who
    // broke THEIR own rhythm (3× past their usual cadence) BEFORE they go fully dormant. Email-only,
    // TCPA-safe (never auto-dials). churn_reengage_candidates refreshes scores + returns only emailable
    // high-risk NOT reengaged in 30d (deduped vs the winback event we log below). Same cap/rotation.
    const churn = await ingRpc(env, "churn_reengage_candidates", { p_email: email, p_limit: 15 });
    for (const c of (Array.isArray(churn) ? churn : [])) {
      if (!isEmail(c.email)) continue;
      const { subject, html } = reengageEmail({ name: c.name || "there", business: "", lang: L });
      if (await capSend(c.email, subject, html)) {
        reactivated++;
        // log the winback so the next sweep dedupes this contact for 30d (payload.contact = email)
        await ingRpc(env, "ingest_client_event", { p_email: email, p_type: "winback", p_channel: "email",
          p_summary: `♻️ Gui reativou ${c.name || "cliente"} (risco ${c.risk}%) por email`.slice(0, 300),
          p_amount: 0, p_payload: { contact: (c.email || "").toLowerCase(), kind: "churn", risk: c.risk } });
      }
    }

    // REMINDERS — appointments in the next 24h get a gentle branded reminder EMAIL today (no A2P needed),
    // for customers whose contact is an email. biz_due_reminders marks them reminded so it fires once.
    const rem = await rpc(env, "biz_due_reminders", { p_email: email, p_hours: 24, p_limit: 50 });
    for (const a of (rem?.due || [])) {
      if (!isEmail(a.contact)) continue;
      const { subject, html } = appointmentReminderEmail({ name: a.name || "there", service: a.service || "", whenLabel: fmtWhen(a.when), ref: a.ref || "", lang: L, bizEmail: email });
      if (await capSend(a.contact, subject, html)) reminded++;
    }

    // BIRTHDAY — Gui never forgets. Celebrate every customer whose birthday is today (email).
    const bd = await rpc(env, "biz_birthdays", { p_email: email, p_within: 0, p_limit: 100 });
    for (const c of (bd?.birthdays || [])) {
      if (!isEmail(c.contact)) continue;
      const { subject, html } = birthdayEmail({ name: c.name || "there", business: "", lang: L });
      if (await capSend(c.contact, subject, html)) birthdays++;
    }

    // CLIENT ANNIVERSARY — "X years since your first visit, thank you" (email).
    const anv = await rpc(env, "biz_anniversaries", { p_email: email, p_limit: 100 });
    for (const c of (anv?.anniversaries || [])) {
      if (!isEmail(c.contact)) continue;
      const { subject, html } = anniversaryEmail({ name: c.name || "there", business: "", years: c.years || 1, lang: L });
      if (await capSend(c.contact, subject, html)) anniversaries++;
    }

    // RECALL — return-by-cadence (e.g. ~6-month routine). Fires once per visit cycle (RPC dedups).
    const rc = await rpc(env, "biz_recall_due", { p_email: email, p_days: 180, p_limit: 100 });
    for (const c of (rc?.recall || [])) {
      if (!isEmail(c.contact)) continue;
      const { subject, html } = recallEmail({ name: c.name || "there", business: "", lang: L, bizEmail: email });
      if (await capSend(c.contact, subject, html)) recalls++;
    }

    // LOYALTY MILESTONE — reward every 10th visit (RPC dedups per milestone).
    const ly = await rpc(env, "biz_loyalty_due", { p_email: email, p_step: 10, p_limit: 100 });
    for (const c of (ly?.loyalty || [])) {
      if (!isEmail(c.contact)) continue;
      const { subject, html } = loyaltyMilestoneEmail({ name: c.name || "there", business: "", milestone: c.milestone || 10, lang: L });
      if (await capSend(c.contact, subject, html)) {
        loyalty++;
        // log a 'loyalty' event so the autonomous VIP-thank below (company_crm_vips) dedups against this
        // milestone send — a customer never gets BOTH a milestone AND a VIP thank in the same window.
        await ingRpc(env, "ingest_client_event", { p_email: email, p_type: "loyalty", p_channel: "email",
          p_summary: `Loyalty milestone → ${c.name || "cliente"}`.slice(0, 300), p_amount: 0,
          p_payload: { contact: (c.contact || "").toLowerCase(), kind: "milestone" } });
      }
    }

    // WELCOME — warm welcome after a customer's first visit (fires once).
    const wc = await rpc(env, "biz_welcome_due", { p_email: email, p_limit: 100 });
    for (const c of (wc?.welcome || [])) {
      if (!isEmail(c.contact)) continue;
      const { subject, html } = welcomeFirstVisitEmail({ name: c.name || "there", business: "", lang: L });
      if (await capSend(c.contact, subject, html)) welcomes++;
    }

    // REBOOK — follow up customers who asked to reschedule, to lock a new time (fires once).
    const rb = await rpc(env, "biz_rebook_due", { p_email: email, p_limit: 100 });
    for (const c of (rb?.rebook || [])) {
      if (!isEmail(c.contact)) continue;
      const { subject, html } = rebookEmail({ name: c.name || "there", business: "", service: c.service || "", lang: L, bizEmail: email });
      if (await capSend(c.contact, subject, html)) rebooks++;
    }

    // ── DATES ENGINE (db/growth_dates.sql) — all INGEST-gated; graceful no-op until pasted ──
    // BIRTHDAY (by crm_contacts.birth_date): Gui never forgets. One email/customer/year (claim dedup).
    const bd2 = await ingRpc(env, "crm_birthday_contacts", { p_client_email: email, p_limit: 200 });
    for (const c of (bd2?.contacts || [])) {
      if (!isEmail(c.email)) continue;
      const claimed = await ingRpc(env, "marketing_date_claim", { p_client_email: email, p_kind: "birthday", p_ref: (c.id || c.email).toString(), p_period: yr });
      if (claimed !== true) continue; // already wished this year (or racing run owns it)
      const { subject, html } = birthdayEmail({ name: c.name || "there", business: "", lang: L });
      if (await capSend(c.email, subject, html)) crmBirthdays++;
    }

    // COMMEMORATIVE DATES — each active biz_marketing_dates row that lands today FIRES marketing to the
    // client's recent contacts. Per-recipient claim (kind=row.kind, ref=dateId, period=year:contactId).
    const today = await ingRpc(env, "marketing_dates_today", { p_client_email: email });
    const dates = today?.dates || [];
    if (dates.length) {
      const rcp = await ingRpc(env, "crm_marketing_recipients", { p_client_email: email, p_days: 180, p_limit: 400 });
      const recipients = rcp?.contacts || [];
      for (const dt of dates) {
        for (const c of recipients) {
          if (!isEmail(c.email)) continue;
          const claimed = await ingRpc(env, "marketing_date_claim", { p_client_email: email, p_kind: (dt.kind || "holiday").toString(), p_ref: (dt.id || "").toString(), p_period: `${yr}:${(c.id || c.email).toString()}` });
          if (claimed !== true) continue;
          const { subject, html } = promoEmail({ name: c.name || "there", business: "", headline: dt.label || "", message: dt.message || "", offer: dt.offer || "", lang: L, bizEmail: email });
          if (await capSend(c.email, subject, html)) marketingDates++;
        }
      }
    }

    // REBOOKING NUDGE — a completed service ~cadence ago with no future booking → "sua próxima em ~4 semanas?"
    // crm_rebook_due is SCHED-gated (touches biz_appointments) → rpc(); claim is INGEST-gated → ingRpc().
    const rbk = await rpc(env, "crm_rebook_due", { p_client_email: email, p_default_days: 28, p_limit: 100 });
    for (const a of (rbk?.due || [])) {
      if (!isEmail(a.contact)) continue;
      const claimed = await ingRpc(env, "marketing_date_claim", { p_client_email: email, p_kind: "rebook", p_ref: (a.appointment_id || "").toString(), p_period: "-" });
      if (claimed !== true) continue;
      const { subject, html } = rebookEmail({ name: a.name || "there", business: "", service: a.service || "", lang: L, bizEmail: email });
      if (await capSend(a.contact, subject, html)) rebookNudges++;
    }
  }

  // ── GAP #1 — as filas do Company OS agora rodam SOZINHAS (não só 1-clique). Cross-tenant, email-only,
  // respeitam o dial (pula 'off' via offSet), capadas pelo mesmo capSend, e deduped pelas próprias RPCs
  // (NOT EXISTS loyalty/nurture na janela) + logam o evento → sem double-send com os blocos acima (que
  // rodaram ANTES e já marcaram winback/loyalty; a RPC exclui quem já foi tocado). Só o que o resto NÃO fez.
  let vipThanks = 0, leadNurtures = 0;
  if (env.INGEST_SECRET) {
    // 🗂️ CRM — agradece os VIPs (maior LTV, saudáveis, não agradecidos em 60d)
    const vips = await ingRpc(env, "company_crm_vips", { p_limit: 40 });
    for (const c of (Array.isArray(vips) ? vips : [])) {
      if (sends >= 40 || !isEmail(c.email) || offSet.has((c.tenant || "").toLowerCase())) continue;
      const { subject, html } = loyaltyMilestoneEmail({ name: c.name || "there", business: "", milestone: c.visits || 10, lang: "en" });
      if (await capSend(c.email, subject, html)) {
        vipThanks++;
        await ingRpc(env, "ingest_client_event", { p_email: c.tenant, p_type: "loyalty", p_channel: "email",
          p_summary: `🗂️ Gui agradeceu ${c.name || "VIP"} (autônomo)`.slice(0, 300), p_amount: 0,
          p_payload: { contact: (c.email || "").toLowerCase(), kind: "loyalty" } });
      }
    }
    // 📣 MARKETING — nutre os leads (não nutridos em 14d) que o drip por-idade não pegou
    const leads = await ingRpc(env, "company_marketing_leads", { p_limit: 40 });
    for (const l of (Array.isArray(leads) ? leads : [])) {
      if (sends >= 40 || !isEmail(l.email) || offSet.has((l.tenant || "").toLowerCase())) continue;
      const { subject, html } = proposalEmail({ name: l.name || "there", business: "", lang: "en" });
      if (await capSend(l.email, subject, html)) {
        leadNurtures++;
        await ingRpc(env, "ingest_client_event", { p_email: l.tenant, p_type: "nurture", p_channel: "email",
          p_summary: `📣 Gui nutriu o lead ${l.name || ""} (autônomo)`.slice(0, 300), p_amount: 0,
          p_payload: { contact: (l.email || "").toLowerCase(), kind: "nurture" } });
      }
    }
  }

  return json({ ok: true, reactivated, reminded, birthdays, anniversaries, recalls, loyalty, welcomes, rebooks, crmBirthdays, marketingDates, rebookNudges, valueReports, vipThanks, leadNurtures, businesses: businesses.length });
}
