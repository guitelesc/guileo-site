// Cloudflare Pages Function — POST /api/storm-mode  (🌀 HURRICANE MODE — 1-click storm management)
// MIAMI THESIS: a hurricane is coming → the owner taps ONE button and Gui handles the whole storm:
//   activate → the calendar CLOSES for the window (db/storm_mode.sql rides the biz_special_dates
//              engine, so the voice agent already refuses bookings and SPEAKS the closed message),
//              every already-booked customer in the window gets a branded "we're closing + we'll
//              rebook you" email (WhatsApp/SMS best-effort), and the owner gets a confirmation alert;
//   reopen   → clears the remaining closed days + fires ONE "estamos de volta ✅ reagende" blast
//              (affected list first, then recent customers via crm_marketing_recipients) — the
//              reopen_blast_sent latch in SQL makes the blast idempotent;
//   cancel   → reopen semantics without the blast (false alarm);
//   status   → active storm + affected appointments + history.
// Data lives behind db/storm_mode.sql (INGEST-gated SECURITY DEFINER RPCs). Brand comes from
// functions/lib/clientBrand.js; every email is rendered by a branded builder in
// functions/lib/emailTemplates.js (house rule: NEVER ad-hoc HTML email).
//
// PER-TENANT GATE — email + connection-key via get_client_data (identical to noshow-radar.js):
// a token can never close another tenant's calendar or read their customer PII. No OWNER_EMAIL fallback.
//
//   POST { token, email, action, ... }
//   activate { starts_on?, reopen_on?, message? } | status | reopen | cancel
import { json } from "../lib/guard.js";
import { brandFor, GUILEO_BRAND } from "../lib/clientBrand.js";
import { newsEmail, brandPromoEmail, ownerAlertEmail } from "../lib/emailTemplates.js";
import { sendText, sendOrFlag } from "../lib/twilio.js";
import { emitFailure } from "../lib/failure.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const isEmailAddr = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
const isPhone = (s) => !isEmailAddr(s) && /\+?\d[\d\s()-]{6,}/.test(String(s || ""));
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const NOT_PASTED = "Paste db/storm_mode.sql in Supabase to activate hurricane mode.";

// Default bilingual closure message (EN first — Miami; PT mirrors the Latin WhatsApp culture).
const defaultMessage = (business) =>
  `${business || "We"} will be temporarily closed for the storm — your safety comes first. We'll reach out to rebook every appointment as soon as we reopen. / Estaremos temporariamente fechados por causa da tempestade — sua segurança vem primeiro. Vamos reagendar todos os horários assim que reabrirmos.`;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // ── PER-TENANT GATE (same proven bind noshow-radar / coupons use) ──
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

    const secret = env.INGEST_SECRET || "";
    const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const action = (b.action || "status").toString();

    // ── STATUS — active storm + affected appointments + history ─────────────
    if (action === "status") {
      const r = await rpc("storm_status", { p_secret: secret, p_email: email });
      if (!r.ok) return json({ ok: true, ready: false, note: NOT_PASTED, active: null, affected: 0, history: [] });
      const st = (await r.json().catch(() => ({}))) || {};
      let appointments = [];
      if (st.active) {
        const ar = await rpc("storm_affected_appointments", { p_secret: secret, p_email: email });
        if (ar.ok) appointments = ((await ar.json().catch(() => ({}))) || {}).appointments || [];
      }
      return json({ ok: true, ready: true, active: st.active || null, affected: st.affected || 0, history: st.history || [], appointments });
    }

    // ── ACTIVATE — 1 button: close the window + notify every affected customer ──
    if (action === "activate") {
      const brand = await brandFor(env, email).catch(() => ({ ...GUILEO_BRAND }));
      const today = new Date().toISOString().slice(0, 10);
      const starts_on = isDate(b.starts_on) ? b.starts_on : today;
      const reopen_on = isDate(b.reopen_on) ? b.reopen_on : new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
      const message = (b.message || "").toString().trim().slice(0, 600) || defaultMessage(brand.business);

      const r = await rpc("storm_activate", { p_secret: secret, p_email: email, p_starts_on: starts_on, p_reopen_on: reopen_on, p_message: message, p_key: key });
      if (!r.ok) return json({ ok: false, ready: false, note: NOT_PASTED });
      const res = (await r.json().catch(() => ({}))) || {};
      if (!res.ok) return json({ ok: false, ready: true, ...res });

      // Notify every affected appointment holder — branded email (their brand, not Guileo's)
      // + WhatsApp/SMS best-effort (US SMS pending A2P; email works today). Dedup by contact,
      // cap 200, and never re-notify below the already-notified watermark (idempotent retries).
      const ar = await rpc("storm_affected_appointments", { p_secret: secret, p_email: email });
      const appts = ar.ok ? (((await ar.json().catch(() => ({}))) || {}).appointments || []) : [];
      const already = Number(res.notified) || 0;
      let notified = 0;
      if (!res.idempotent || already < appts.length) {
        const title = brand.lang === "pt" ? "🌀 Fechados temporariamente — tempestade" : brand.lang === "es" ? "🌀 Cerrados temporalmente — tormenta" : "🌀 Temporarily closed — storm";
        const seen = new Set();
        for (const a of appts.slice(0, 200)) {
          const contact = String(a.contact || "").trim();
          if (!contact || seen.has(contact.toLowerCase())) continue;
          seen.add(contact.toLowerCase());
          try {
            if (isEmailAddr(contact) && env.RESEND_API_KEY) {
              const { subject, html } = newsEmail({ brand, title, body: message, lang: brand.lang });
              const sr = await fetch("https://api.resend.com/emails", {
                method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ from: `${(brand.business || "Guileo").replace(/[<>]/g, "")} <${env.EMAIL_FROM_ADDR || "noreply@guileoai.com"}>`, to: [contact], subject, html }),
              });
              if (sr.ok) notified++;
            } else if (isPhone(contact)) {
              // WhatsApp first (Latin culture; no A2P needed once the sender is approved) → SMS fallback.
              const tx = await sendText(env, contact.replace(/[^0-9+]/g, ""), `🌀 ${brand.business || "Guileo"}: ${message}`.slice(0, 300), { channel: "whatsapp", market: contact.includes("+55") ? "BR" : "US" });
              if (tx.sent) notified++;
            }
          } catch (e) { await emitFailure(env, "storm_notify_failed", email, `couldn't notify ${contact.slice(0, 40)}: ${String(e).slice(0, 80)}`, { storm_id: res.id }); }
        }
        await rpc("storm_mark_notified", { p_secret: secret, p_email: email, p_id: res.id, p_count: already + notified }).catch(() => {});
      }

      // Owner confirmation — email (works today) + WhatsApp/SMS best-effort (db/notify_phone.sql).
      if (env.RESEND_API_KEY) {
        try {
          const { subject, html } = ownerAlertEmail({ kind: "storm", customer: `🌀 ${brand.business || ""}`.trim(), business: brand.business || "", details: `Hurricane mode ON: closed ${starts_on} → ${reopen_on}. ${appts.length} appointment(s) in the window, ${already + notified} notified. Gui is telling callers you're closed and will rebook everyone.`, when: `${starts_on} → ${reopen_on}`, lang: brand.lang });
          await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject, html }),
          });
        } catch { /* best-effort — never block the activation */ }
      }
      if (env.INGEST_SECRET) {
        try {
          const pr = await rpc("client_notify_phone_lookup", { p_secret: env.INGEST_SECRET, p_email: email });
          const ph = pr.ok ? ((await pr.json()) || "").toString() : "";
          if (/^[0-9+]{8,}$/.test(ph)) await sendOrFlag(env, { tenant: email, motivo: "aviso de modo tempestade", opts: { channel: "whatsapp" }, to: ph, body: `🌀 Guileo: modo tempestade ATIVO (${starts_on} → ${reopen_on}). ${appts.length} agendamento(s) na janela — o Gui avisa e reagenda todo mundo. guileoai.com/portal`.slice(0, 300) });
        } catch { /* text best-effort */ }
      }

      return json({ ok: true, ready: true, id: res.id, starts_on, reopen_on, days_closed: res.days_closed || 0, affected: appts.length, notified: already + notified, idempotent: !!res.idempotent });
    }

    // ── REOPEN / CANCEL — clear the remaining closed days; reopen also fires ONE blast ──
    if (action === "reopen" || action === "cancel") {
      const canceled = action === "cancel";
      // Grab the affected list BEFORE the status flips (the RPC serves the latest storm either way).
      const ar = await rpc("storm_affected_appointments", { p_secret: secret, p_email: email });
      const appts = ar.ok ? (((await ar.json().catch(() => ({}))) || {}).appointments || []) : [];

      const r = await rpc("storm_reopen", { p_secret: secret, p_email: email, p_canceled: canceled });
      if (!r.ok) return json({ ok: false, ready: false, note: NOT_PASTED });
      const res = (await r.json().catch(() => ({}))) || {};
      if (!res.ok) return json({ ok: false, ready: true, ...res });

      // REOPEN BLAST — "estamos de volta ✅ reagende": affected list FIRST, then recent customers.
      // res.blast is true exactly once (reopen_blast_sent latches in SQL) → idempotent retries.
      let sent = 0, audience = 0;
      if (!canceled && res.blast && env.RESEND_API_KEY) {
        const brand = await brandFor(env, email).catch(() => ({ ...GUILEO_BRAND }));
        const mr = await rpc("crm_marketing_recipients", { p_secret: secret, p_client_email: email, p_days: 180, p_limit: 400 });
        const recents = mr.ok ? (((await mr.json().catch(() => ({}))) || {}).contacts || []) : [];
        const seen = new Set();
        const recipients = [];
        for (const p of [...appts.map((a) => ({ name: a.name, email: a.contact })), ...recents]) {
          const to = String((p && p.email) || "").trim().toLowerCase();
          if (!isEmailAddr(to) || seen.has(to)) continue;
          seen.add(to);
          recipients.push({ name: (p && p.name) || "", email: to });
          if (recipients.length >= 300) break;
        }
        audience = recipients.length;
        const headline = brand.lang === "pt" ? "Estamos de volta ✅" : brand.lang === "es" ? "Estamos de vuelta ✅" : "We're back ✅";
        const body = brand.lang === "pt"
          ? `A tempestade passou e ${brand.business || "nós"} já reabrimos. Se o seu horário caiu na janela fechada, reagende agora — o Gui atende 24/7 e encaixa você no melhor horário.`
          : brand.lang === "es"
          ? `La tormenta pasó y ${brand.business || "nosotros"} ya reabrimos. Si su cita cayó en la ventana cerrada, reagende ahora — Gui atiende 24/7 y le encuentra el mejor horario.`
          : `The storm has passed and ${brand.business || "we"} are open again. If your appointment fell inside the closed window, rebook now — Gui answers 24/7 and will find you the best slot.`;
        const from = `${(brand.business || "Guileo").replace(/[<>]/g, "")} <${env.EMAIL_FROM_ADDR || "noreply@guileoai.com"}>`;
        for (const rcp of recipients) {
          try {
            const built = brandPromoEmail({ brand, headline, body, lang: brand.lang }) || {};
            if (!built.html) continue;
            const sr = await fetch("https://api.resend.com/emails", {
              method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from, to: [rcp.email], subject: built.subject || headline, html: built.html }),
            });
            if (sr.ok) sent++;
          } catch (e) { await emitFailure(env, "storm_reopen_blast_failed", email, `couldn't email ${rcp.email}: ${String(e).slice(0, 80)}`, { storm_id: res.id }); }
        }
      }

      return json({ ok: true, ready: true, id: res.id, status: res.status, cleared: res.cleared || 0, blast: !!res.blast, audience, sent });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
