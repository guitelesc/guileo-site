// Cloudflare Pages Function — GET/POST /api/cron-tick · O DESPERTADOR da plataforma.
// ─────────────────────────────────────────────────────────────────────────────
// Pages não tem cron nativo, então um Worker minúsculo (cron-worker/) com cron trigger
// chama ESTE endpoint a cada 15 min. Ele faz o fan-out para todos os sweeps internos
// usando env.DIGEST_TOKEN do lado do servidor — o Worker não carrega segredo nenhum.
//
// SEGURANÇA (por que pode ser público): cada sweep chamado aqui é IDEMPOTENTE por
// construção (drip_claim / marketing_date_claim / risk_confirm_claim / janela única do
// reconcile / opt-in do collections) — um atacante martelando isto no máximo ADIANTA
// um envio que já ia acontecer, nunca duplica nem dispara nada novo. Ainda assim:
// rate-limit forte (4/h por IP) + os endpoints de destino continuam token-gated.
//
// Cadência: o Worker chama a cada 15 min; os pesados (proactive/nps/reconcile) só
// rodam na janela horária certa pra não desperdiçar subrequests.
import { json, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

// PHONE RE-ENGAGEMENT EXECUTOR (#19) — turns a queued churn-reengage / booking-recovery
// client_event that carries a PHONE (not an email) into a REAL Gui callback through the single
// hardened /api/call gate. The email path already fires instantly in growth-intel.js; phone-only
// intents were logged ("queued") but nothing ever dialed them. This sweep closes that gap.
// SAFETY, in layers:
//   • CLAIM-DEDUPED — phone_reengage_claim wins each event exactly once, so a re-run (or a
//     concurrent tick) can NEVER double-dial the same intent. We claim BEFORE dialing so a failed
//     dial doesn't cause a retry storm and no other tick can also grab it.
//   • TCPA — only dials inside a conservative US calling window (16:00–00:59 UTC ≈ 8am PT–9pm ET,
//     DST-safe) because we don't capture each callee's timezone; the /api/call gate still enforces
//     the DNC / STOP opt-out list + a per-destination cooldown on top of this.
//   • PER-TENANT — dials AS the client's OWN Gui (client_email → server-side agent resolve in call.js),
//     never a cross-tenant leak: the event's client_email IS the tenant.
//   • COST — shares speed-to-lead's global daily auto-call cap (KV callday:<date>, 150) + a per-tick cap.
// service_role only (svcRpc): the RPCs return phone PII cross-tenant AND trigger paid calls, so they
// are NOT granted to anon. Inert no-op (honest note, never a fake "dialed") until db/phone_reengage.sql
// is pasted AND SUPABASE_SERVICE_ROLE is set.
async function phoneReengageSweep(env, base, hourUTC) {
  const out = { due: 0, dialed: 0, skipped: 0 };
  if (!env.INGEST_SECRET) return { ...out, note: "INGEST_SECRET missing" };
  // TCPA calling-window guard — outside it we place no unsolicited calls.
  if (!(hourUTC >= 16 || hourUTC < 1)) return { ...out, note: "outside call window" };
  let rows;
  try {
    const r = await svcRpc(env, "phone_reengage_due", { p_secret: env.INGEST_SECRET, p_limit: 30 });
    if (!r.ok) return { ...out, note: "phone_reengage_due unavailable (paste db/phone_reengage.sql / set SUPABASE_SERVICE_ROLE)" };
    rows = await r.json().catch(() => null);
  } catch { return { ...out, note: "read failed" }; }
  if (!Array.isArray(rows) || !rows.length) return out;
  out.due = rows.length;

  const MAX_DIALS = 15;                                    // per-tick ceiling (backstop to the daily cap)
  const dayKey = `callday:${new Date().toISOString().slice(0, 10)}`;
  for (const row of rows) {
    if (out.dialed >= MAX_DIALS) break;
    const email = ((row && row.client_email) || "").toString().trim().toLowerCase();
    const phone = ((row && row.contact) || "").toString().replace(/[^0-9+]/g, "");
    const evId = ((row && row.event_id) || "").toString();
    if (!email.includes("@") || !/^\+?[1-9]\d{7,14}$/.test(phone) || !evId) { out.skipped++; continue; }

    // GLOBAL DAILY CAP (shared with lead.js speed-to-lead) — a hard ceiling on autonomous outbound calls.
    if (env.RATE_LIMIT) {
      try { if (parseInt((await env.RATE_LIMIT.get(dayKey)) || "0", 10) >= 150) { out.skipped++; break; } }
      catch { /* KV down → call.js fail-closed caps backstop */ }
    }

    // CLAIM FIRST — win the event before dialing. Only the winner proceeds (idempotent across ticks).
    let won = false;
    try {
      const cr = await svcRpc(env, "phone_reengage_claim", { p_secret: env.INGEST_SECRET, p_event_id: evId, p_client_email: email });
      won = cr.ok && (await cr.json().catch(() => false)) === true;
    } catch { won = false; }
    if (!won) { out.skipped++; continue; }

    // DIAL through the single hardened gate — DNC + per-destination cooldown enforced inside call.js;
    // Origin + x-guileo-internal (== DIGEST_TOKEN) are required by that gate for an internal dial.
    try {
      const cr = await fetch(`${base}/api/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base, "x-guileo-internal": env.DIGEST_TOKEN || "" },
        body: JSON.stringify({
          phone,
          client_email: email,                              // → the client's own Gui (per-tenant agent resolve)
          name: ((row && row.name) || "").toString().slice(0, 120),
          need: (row && row.kind) === "booking-recovery" ? "Retomar o agendamento que ficou pela metade" : "Reativar cliente (risco de perder)",
          lang: "auto",
        }),
      });
      if (cr.ok) {
        out.dialed++;
        if (env.RATE_LIMIT) { try { const n = parseInt((await env.RATE_LIMIT.get(dayKey)) || "0", 10); await env.RATE_LIMIT.put(dayKey, String(n + 1), { expirationTtl: 172800 }); } catch { /* KV down → IP caps backstop */ } }
      } else { out.skipped++; }
    } catch { out.skipped++; }
  }
  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "cron-tick", 4)) return json({ error: "too many requests" }, 429);
    if (!env.DIGEST_TOKEN) return json({ ok: false, note: "DIGEST_TOKEN not configured" }, 501);

    const base = "https://guileoai.com";
    const t = encodeURIComponent(env.DIGEST_TOKEN);
    const hourUTC = new Date().getUTCHours();
    const minute = new Date().getUTCMinutes();

    // every tick (15 min): operational engines (all claim-protected)
    const targets = [
      { name: "automations", url: `${base}/api/automations?token=${t}` },
      { name: "lifecycle", url: `${base}/api/lifecycle?token=${t}` },
    ];
    // hourly (first tick of the hour): health + collections opt-in + dunning grace sweep
    if (minute < 15) {
      targets.push({ name: "health-monitor", url: `${base}/api/health-monitor?token=${t}` });
      // funnel canary: proves chat/pay-links/call-gate/widget are ALIVE every hour (no side effects)
      targets.push({ name: "canary", url: `${base}/api/canary?token=${t}` });
      // Gui replies to new Google reviews (inert until GOOGLE_BUSINESS_* + a tenant connects)
      targets.push({ name: "review-responder", url: `${base}/api/review-responder?token=${t}` });
      targets.push({ name: "collections", url: `${base}/api/collections?sweep=1&token=${t}` });
      // dunning grace-period sweep — dry-run until DUNNING_ENFORCE='1'; claim-deduped so an
      // hourly re-run never spams the last-call email or double-pauses (safe to run every hour).
      targets.push({ name: "dunning-sweep", url: `${base}/api/dunning-sweep?token=${t}` });
      // QUALIDADE DA GUI — roda o golden set (genérico + os 13 casos POR VERTICAL) contra o
      // cérebro real e grava a nota em agent_evals. Só na 1ª hora do dia (00h UTC) pra não
      // gastar modelo de hora em hora; é medição, não operação.
      // ZERO efeito colateral: o harness chama só a geração de texto pura, contra o tenant
      // sandbox. Nada de ligar, cobrar ou gravar no cliente.
      // Existe porque a nota só valia se alguém rodasse à mão — e ninguém roda à mão. Agora a
      // regressão de qualidade aparece sozinha no histórico, como qualquer outro monitor.
      if (hourUTC === 0) targets.push({ name: "agent-eval", url: `${base}/api/agent-eval?token=${t}` });
    }
    // daily ~13:00 UTC (9am ET): dates/birthdays/rebooking + NPS + money reconcile
    // two chances (13h AND 14h): a single failed tick must not skip the whole day/week —
    // every daily/weekly target below is claim-protected/idempotent, so the 2nd tick is safe.
    if ((hourUTC === 13 || hourUTC === 14) && minute < 15) {
      targets.push({ name: "proactive", url: `${base}/api/proactive?token=${t}` });
      // CLASSIFICAÇÃO DO CRM antes dos motores de retenção do dia: aniversário, win-back e
      // churn LEEM lifecycle/LTV/risco. Se a varredura não rodar primeiro, eles decidem em
      // cima da foto de ontem — ou, como era até 2026-08-04, em cima de campo vazio.
      targets.push({ name: "crm-classify", url: `${base}/api/crm-classify?token=${t}` });
      targets.push({ name: "nps", url: `${base}/api/nps?token=${t}` });
      // XM active survey: Gui asks each client's OWN recent customers "how was it?" (1-tap NPS/CSAT),
      // ON by default per tenant (they can disable it in the Experience tab). Claim-deduped (30-day
      // window) + capped + email-only, so the daily re-run never double-surveys anyone.
      targets.push({ name: "cx-survey", url: `${base}/api/cx-survey?token=${t}` });
      targets.push({ name: "money-reconcile", url: `${base}/api/money-reconcile?token=${t}` });
      // ONBOARDING MACHINE step 7: day-30/60/90 one-question check-in. Atomic-claimed per milestone
      // (onboard_checkin_due), so the daily re-run never re-sends — safe every day.
      targets.push({ name: "onboarding-checkin", url: `${base}/api/onboarding?sweep=checkin&token=${t}` });
      // ONBOARDING MACHINE step 6: monthly ROI report. Claimed per calendar month (onboard_report_due)
      // and fired on the 1st @13h only (not the 14h retry) → exactly one ROI report per client per month.
      if (hourUTC === 13 && new Date().getUTCDate() === 1) targets.push({ name: "onboarding-report", url: `${base}/api/onboarding?sweep=report&token=${t}` });
      // Data-cannot-lie: nightly cross-department invariant sweep; alerts if any HIGH contradiction.
      targets.push({ name: "integrity-sweep", url: `${base}/api/integrity-sweep?token=${t}` });
      // weekly (Monday 13:00 UTC): the "Your Gui this week" value report — skipped clients with
      // zero events, so a Monday-only fan-out is enough (was orphaned: never wired to any cron).
      if (new Date().getUTCDay() === 1) targets.push({ name: "client-report", url: `${base}/api/client-report?token=${t}` });
      // Monday: the SELLER's weekly mirror — wallet, commission, balance due, play of the week.
      if (new Date().getUTCDay() === 1) targets.push({ name: "seller-report", url: `${base}/api/seller-report?token=${t}` });
      // Company OS owner brief — "sua empresa se operou hoje". 13h ONLY (not the 14h retry) so the
      // owner gets exactly ONE daily brief (it isn't claim-deduped; a missed day is harmless).
      if (hourUTC === 13) targets.push({ name: "company-os-brief", url: `${base}/api/company-os-brief?token=${t}` });
    }

    const results = {};
    for (const tg of targets) {
      try {
        const r = await fetch(tg.url, { method: "POST" }).catch(() => null);
        const r2 = r && r.ok ? r : await fetch(tg.url); // some sweeps are GET-only
        results[tg.name] = r2 ? r2.status : 0;
      } catch { results[tg.name] = 0; }
    }
    // PHONE RE-ENGAGEMENT EXECUTOR (#19) — once per hour, dial the queued phone-contact
    // churn/booking-recovery intents (claim-deduped + TCPA-windowed inside the sweep).
    let reengage = null;
    if (minute < 15) {
      try { reengage = await phoneReengageSweep(env, base, hourUTC); }
      catch (e) { reengage = { error: String(e).slice(0, 80) }; }
    }
    return json({ ok: true, ran: results, reengage, hourUTC, minute });
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 500);
  }
}
