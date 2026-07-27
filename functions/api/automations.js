// Cloudflare Pages Function — GET/POST /api/automations?token=DIGEST_TOKEN
// The Guileo automations engine: three revenue loops in one cron-friendly endpoint.
//   1. REMINDERS — 24h + 2h WhatsApp/SMS before each booking (kills no-shows)
//   2. REVIEWS   — post-visit review request with the client's review link
//   3. WINBACK   — "we miss you" nudge to customers who stopped coming
// Wire into the guileo-digest-cron Worker alongside /api/backup. Idempotent:
// the DB RPCs only return rows not yet handled, and we only mark/ingest AFTER
// a real Twilio send — so before Twilio is configured every run is a no-op
// that reports skipped counts instead of burning the one-shot flags.
import { json, safeEq } from "../lib/guard.js";
import { sendText } from "../lib/twilio.js";
import { promoEmail } from "../lib/emailTemplates.js";

const isEmailAddr = (s) => /.+@.+\..+/.test((s || "").toString());
// Slow-day promos reach customers TODAY by email (SMS/WhatsApp light up at A2P). Best-effort.
async function sendPromoEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !isEmailAddr(to)) return false;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
    });
    return true;
  } catch { return false; }
}

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const MAX_SENDS = 60; // hard cap per run — protects against bad data blasting hundreds of texts

async function rpc(env, fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
  });
  return r.ok ? await r.json() : null;
}

const ingest = (env, email, type, channel, summary, payload) =>
  rpc(env, "ingest_client_event", { p_email: email, p_type: type, p_channel: channel, p_summary: (summary || "").slice(0, 300), p_amount: 0, p_payload: payload || {} });

// Profile lookups are cached per run — many bookings share one client.
async function profileFor(env, cache, email) {
  if (!cache.has(email)) cache.set(email, (await rpc(env, "get_client_profile", { p_email: email })) || {});
  return cache.get(email);
}

// v1 keeps times in UTC ("HH:MM") — per-client timezones come with the profile later.
const hhmm = (iso) => { try { return new Date(iso).toISOString().slice(11, 16); } catch { return ""; } };
// "20/06 às 14:30" (pt) / "20/06 a las 14:30" (es) / "06/20 at 14:30" (en) — when-label for the risk nudge.
const whenLabel = (iso, lang) => {
  try {
    const d = new Date(iso);
    const dd = String(d.getUTCDate()).padStart(2, "0"), mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return lang === "pt" ? `${dd}/${mm} às ${hhmm(iso)}` : lang === "es" ? `${dd}/${mm} a las ${hhmm(iso)}` : `${mm}/${dd} at ${hhmm(iso)}`;
  } catch { return ""; }
};
// Customer texts go out in the CLIENT profile's language — pt / es / en supported.
const langNorm = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };

// The scheduling RPCs (noshow_risk) are gated by SCHED_SECRET, not INGEST_SECRET.
async function schedRpc(env, fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", ...args }),
  });
  return r.ok ? await r.json() : null;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
  const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

  const configured = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
  const out = { holdsReleased: 0, holdsReady: true, reminders24: 0, reminders2: 0, reviews: 0, winback: 0, riskConfirm: 0, riskClaimedDupe: 0, riskSkipped: 0, riskReady: true, slowday: 0, slowdayReady: true, sent: 0, skipped: 0, configured };
  const profiles = new Map();
  const budget = () => out.sent < MAX_SENDS; // shared cap across all three engines

  // ENGINE 0 — RELEASE EXPIRED HOLDS. Slots put on 'hold' (deposit-to-book) are cleaned
  // lazily by the biz_* RPCs, but only when the next booking touches that service — on a
  // quiet day an expired hold blocks its slot for hours. This tick sweeps them regardless
  // of traffic via the SCHED-gated wrapper (db/holds_release.sql). Best-effort, no sends,
  // never blocks the revenue loops; graceful until the wrapper is pasted (holdsReady:false).
  try {
    const hr = await schedRpc(env, "biz_holds_expire", {});
    if (hr && typeof hr.released === "number") out.holdsReleased = hr.released;
    else out.holdsReady = false; // wrapper not pasted (or RPC unreachable) → reported, not silent
  } catch { out.holdsReady = false; }

  // ENGINE 1 — booking reminders (24h then 2h before starts_at)
  for (const kind of ["24", "2"]) {
    try {
      const rows = (await rpc(env, "due_reminders", { p_kind: kind })) || [];
      for (const b of rows) {
        if (!budget()) break;
        const p = await profileFor(env, profiles, b.client_email);
        const L = langNorm(p.lang); // en default (unchanged); pt/es render natively
        const nome = b.customer_name || (L === "pt" ? "tudo bem" : "there");
        const hola = `¡Hola${b.customer_name ? ` ${b.customer_name}` : ""}!`; // es greeting handles a missing name
        const time = hhmm(b.starts_at);
        const biz = p.business_name || (L === "pt" ? "nosso espaço" : L === "es" ? "nuestro local" : "our place");
        const msg = kind === "24"
          ? (L === "pt"
            ? `Oi ${nome}! 🌱 Lembrete: você tem ${b.service || "um horário"} amanhã às ${time} em ${biz}. Responde 1 pra confirmar ou 2 pra remarcar.`
            : L === "es"
              ? `${hola} 🌱 Recordatorio: tienes ${b.service || "una cita"} mañana a las ${time} en ${biz}. Responde 1 para confirmar o 2 para reprogramar.`
              : `Hi ${nome}! 🌱 Reminder: you have ${b.service || "an appointment"} tomorrow at ${time} at ${biz}. Reply 1 to confirm or 2 to reschedule.`)
          : (L === "pt"
            ? `Oi ${nome}! Seu horário é daqui a pouco, às ${time}. Te esperamos! 🌱 (Responde 2 se precisar remarcar)`
            : L === "es"
              ? `${hola} Tu cita es en un rato, a las ${time}. ¡Te esperamos! 🌱 (Responde 2 si necesitas reprogramar)`
              : `Hi ${nome}! Your appointment is coming up soon, at ${time}. See you there! 🌱 (Reply 2 if you need to reschedule)`);
        const r = await sendText(env, b.customer_phone, msg);
        if (r.sent) {
          out.sent++; out[kind === "24" ? "reminders24" : "reminders2"]++;
          // mark only AFTER a confirmed send — unsent reminders stay due for the next run
          await rpc(env, "mark_booking", { p_id: b.id, p_field: kind === "24" ? "reminded_24" : "reminded_2" });
          await ingest(env, b.client_email, "message", "whatsapp", `📅 Reminder sent to ${nome} · ${time}`);
        } else out.skipped++;
      }
    } catch { /* one engine failing must never block the others */ }
  }

  // ENGINE 2 — post-visit review requests
  try {
    const rows = (await rpc(env, "due_review_requests")) || [];
    for (const b of rows) {
      if (!budget()) break;
      const p = await profileFor(env, profiles, b.client_email);
      const L = langNorm(p.lang);
      const nome = b.customer_name || (L === "pt" ? "tudo bem" : "there");
      const hola = `¡Hola${b.customer_name ? ` ${b.customer_name}` : ""}!`;
      const biz = b.business_name || p.business_name || (L === "pt" ? "nosso espaço" : L === "es" ? "nuestro local" : "our place");
      const link = b.review_link || p.review_link || "";
      const msg = L === "pt"
        ? `Oi ${nome}! Foi um prazer te atender na ${biz} 💚 Se puder, deixa sua avaliação — leva 30 segundos e ajuda demais: ${link}`
        : L === "es"
          ? `${hola} Fue un placer atenderte en ${biz} 💚 Si puedes, déjanos tu reseña — toma 30 segundos y ayuda muchísimo: ${link}`
          : `Hi ${nome}! It was a pleasure having you at ${biz} 💚 If you can, leave us a review — it takes 30 seconds and helps a lot: ${link}`;
      const r = await sendText(env, b.customer_phone, msg);
      if (r.sent) {
        out.sent++; out.reviews++;
        await rpc(env, "mark_booking", { p_id: b.id, p_field: "review_requested" });
        await ingest(env, b.client_email, "message", "whatsapp", `⭐ Review request sent to ${nome}`);
      } else out.skipped++;
    }
  } catch { /* isolated */ }

  // ENGINE 3 — win-back lapsed customers
  try {
    const rows = (await rpc(env, "due_winback")) || [];
    for (const c of rows) {
      if (!budget()) break;
      const p = await profileFor(env, profiles, c.client_email);
      const L = langNorm(p.lang);
      const nome = c.customer_name || (L === "pt" ? "tudo bem" : "there");
      const hola = `¡Hola${c.customer_name ? ` ${c.customer_name}` : ""}!`;
      const biz = c.business_name || p.business_name || (L === "pt" ? "nosso espaço" : L === "es" ? "nuestro local" : "our place");
      const msg = L === "pt"
        ? `Oi ${nome}! Sentimos sua falta na ${biz} 🌱 Já faz um tempinho — quer agendar um horário essa semana? É só responder aqui!`
        : L === "es"
          ? `${hola} Te extrañamos en ${biz} 🌱 Ya pasó un tiempo — ¿quieres agendar una cita esta semana? ¡Solo responde aquí!`
          : `Hi ${nome}! We've missed you at ${biz} 🌱 It's been a while — want to book a spot this week? Just reply here!`;
      const r = await sendText(env, c.customer_phone, msg);
      if (r.sent) {
        out.sent++; out.winback++;
        // payload.phone is REQUIRED: due_winback dedupes on payload->>'phone'
        await ingest(env, c.client_email, "winback", "whatsapp", `♻️ Win-back sent to ${nome}`, { phone: c.customer_phone });
      } else out.skipped++;
    }
  } catch { /* isolated */ }

  // ENGINE 4 — RISK-RADAR AUTO-CONFIRM (Superpower #3 acting on its own):
  // for every client with upcoming bookings, score them with noshow_risk (p_days=2) and send
  // ONE warm extra-confirmation WhatsApp to appointments with risk ≥ 60 in the next ~36h.
  // Idempotent via risk_confirm_claim (ATOMIC 7-day claim, db/risk_autoconfirm.sql) claimed
  // BEFORE the send; DNC-checked via the same is_dnc the dial gate uses; capped at 30/run.
  // Graceful: until db/risk_autoconfirm.sql is pasted, risk_clients is null → riskReady:false, no-op.
  try {
    const RISK_CAP = 30;             // per-run ceiling across ALL clients for this engine
    const RISK_MIN = 60;             // only genuinely risky appointments get the extra touch
    const RISK_WINDOW_MS = 36 * 3600 * 1000; // ~36h horizon — close enough to matter
    const clients = await rpc(env, "risk_clients", {});
    if (!Array.isArray(clients)) out.riskReady = false;
    else if (configured) {           // no Twilio yet → don't burn claims; retry next run
      let riskSent = 0;
      for (const c of clients) {
        if (riskSent >= RISK_CAP || !budget()) break;
        const email = ((c && c.client_email) || "").toString().trim().toLowerCase();
        if (!email.includes("@")) continue;
        const rows = (await schedRpc(env, "noshow_risk", { p_email: email, p_days: 2 })) || [];
        const p = await profileFor(env, profiles, email);
        // PT default preserved — this engine is BR-first; explicit en/es profiles get their language.
        const L = p.lang === "en" ? "en" : (p.lang || "").toString().toLowerCase().slice(0, 2) === "es" ? "es" : "pt";
        for (const a of rows) {
          if (riskSent >= RISK_CAP || !budget()) break;
          if ((a.risk || 0) < RISK_MIN) continue;
          const startMs = new Date(a.starts_at).getTime();
          if (!(startMs > Date.now() && startMs - Date.now() < RISK_WINDOW_MS)) continue;
          const phone = (a.customer_contact || "").toString().replace(/[^0-9+]/g, "");
          if (!/^\+?[1-9]\d{7,14}$/.test(phone)) { out.riskSkipped++; continue; } // contact is an email or junk
          // COMPLIANCE — same suppression list the hardened dial gate honors. Never text a STOP.
          try { if ((await rpc(env, "is_dnc", { p_phone: phone })) === true) { out.riskSkipped++; continue; } } catch { /* fail-open, matches call.js */ }
          // ATOMIC claim BEFORE the send — false means another run (or a racing one) owns it.
          const claimed = await rpc(env, "risk_confirm_claim", { p_email: email, p_appointment_id: a.appointment_id });
          if (claimed !== true) { out.riskClaimedDupe++; continue; }
          const nome = a.customer_name || (L === "pt" ? "tudo bem" : "there");
          const hola = `¡Hola${a.customer_name ? ` ${a.customer_name}` : ""}!`;
          const biz = p.business_name || (L === "pt" ? "nosso espaço" : L === "es" ? "nuestro local" : "our place");
          const quando = whenLabel(a.starts_at, L);
          const msg = L === "pt"
            ? `Oi ${nome}! Confirmando seu horário ${quando} na ${biz} 🌱 Responde SIM pra confirmar ou me avisa se precisar remarcar.`
            : L === "es"
              ? `${hola} Confirmando tu cita ${quando} en ${biz} 🌱 Responde SÍ para confirmar o avísame si necesitas reprogramar.`
              : `Hi ${nome}! Just confirming your appointment ${quando} at ${biz} 🌱 Reply YES to confirm or let me know if you need to reschedule.`;
          const r = await sendText(env, phone, msg, { channel: "whatsapp" });
          if (r.sent) {
            riskSent++; out.riskConfirm++; out.sent++;
            await ingest(env, email, "confirm", "whatsapp",
              `🛡️ confirmação extra automática — risco de falta ${a.risk || 0}%`,
              { appointment_id: a.appointment_id, phone, risk: a.risk || 0 });
          } else out.riskSkipped++; // claim stands 7d; the 24h/2h reminders still cover them
        }
      }
    }
  } catch { /* isolated — risk engine failing must never block the revenue loops */ }

  // ENGINE 5 — SLOW-DAY PROMO (OPT-IN, off by default like collections_auto). For every opted-in tenant
  // (slowday_auto_list, db/growth_dates.sql) find days in the next ~72h with low occupancy vs capacity
  // (slowday_candidates) and fire a flash promo to recent customers to fill them. EMAIL now (reaches
  // customers today), WhatsApp/SMS when A2P clears. Per-recipient claim (marketing_date_claim, kind
  // 'slowday') dedups so nobody is spammed. Capped per run. Graceful: no opt-ins / no keys → no-op.
  try {
    const SLOW_CAP = 40;                        // hard ceiling across all tenants for this engine
    const PER_DAY = 15;                          // at most N recent customers per soft day
    const optedIn = await rpc(env, "slowday_auto_list", {});
    if (!Array.isArray(optedIn)) out.slowdayReady = false;
    else {
      let slowSent = 0;
      for (const row of optedIn) {
        if (slowSent >= SLOW_CAP || !budget()) break;
        const email = ((row && row.client_email) || "").toString().trim().toLowerCase();
        if (!email.includes("@")) continue;
        const cand = await schedRpc(env, "slowday_candidates", { p_email: email, p_hours: 72, p_max_occ: 0.4, p_limit: 4 });
        const days = (cand && cand.days) || [];
        if (!days.length) continue;
        const rcp = await rpc(env, "crm_marketing_recipients", { p_client_email: email, p_days: 120, p_limit: 200 });
        const recipients = (rcp && rcp.contacts) || [];
        const p = await profileFor(env, profiles, email);
        const L = langNorm(p.lang);
        const biz = p.business_name || (L === "pt" ? "nosso espaço" : L === "es" ? "nuestro local" : "our place");
        const headline = L === "pt" ? "Uma vaga de última hora pra você 🌱" : L === "es" ? "Un lugar de última hora para ti 🌱" : "A last-minute opening for you 🌱";
        const message = L === "pt" ? `Temos horários abertos essa semana na ${biz} — adoraríamos te receber. Quer que eu encaixe você?` : L === "es" ? `Tenemos horarios libres esta semana en ${biz} — nos encantaría recibirte. ¿Te encajo un horario?` : `We have openings this week at ${biz} — we'd love to have you in. Want me to fit you in?`;
        for (const dd of days) {
          for (const c of recipients.slice(0, PER_DAY)) {
            if (slowSent >= SLOW_CAP || !budget()) break;
            const who = (c.id || c.email || c.phone || "").toString();
            const claimed = await rpc(env, "marketing_date_claim", { p_client_email: email, p_kind: "slowday", p_ref: `${dd.location_id}:${dd.day}`, p_period: who });
            if (claimed !== true) continue;         // already invited to this day (or racing run owns it)
            if (isEmailAddr(c.email)) {
              const { subject, html } = promoEmail({ name: c.name || (L === "pt" ? "tudo bem" : "there"), business: "", headline, message, offer: "", lang: L, bizEmail: email });
              if (await sendPromoEmail(env, c.email, subject, html)) { slowSent++; out.slowday++; out.sent++; } else out.skipped++;
            } else {
              const phone = (c.phone || "").toString().replace(/[^0-9+]/g, "");
              if (!/^\+?[1-9]\d{7,14}$/.test(phone)) continue;
              const r = await sendText(env, phone, `🌱 ${headline} ${message}`.slice(0, 300), { channel: "whatsapp" });
              if (r.sent) { slowSent++; out.slowday++; out.sent++; } else out.skipped++;
            }
          }
        }
      }
    }
  } catch { /* isolated — slow-day engine failing must never block the revenue loops */ }

  return json(out);
}
