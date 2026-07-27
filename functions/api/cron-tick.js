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
    }
    // daily ~13:00 UTC (9am ET): dates/birthdays/rebooking + NPS + money reconcile
    // two chances (13h AND 14h): a single failed tick must not skip the whole day/week —
    // every daily/weekly target below is claim-protected/idempotent, so the 2nd tick is safe.
    if ((hourUTC === 13 || hourUTC === 14) && minute < 15) {
      targets.push({ name: "proactive", url: `${base}/api/proactive?token=${t}` });
      targets.push({ name: "nps", url: `${base}/api/nps?token=${t}` });
      // XM active survey: Gui asks each client's OWN recent customers "how was it?" (1-tap NPS/CSAT),
      // ON by default per tenant (they can disable it in the Experience tab). Claim-deduped (30-day
      // window) + capped + email-only, so the daily re-run never double-surveys anyone.
      targets.push({ name: "cx-survey", url: `${base}/api/cx-survey?token=${t}` });
      targets.push({ name: "money-reconcile", url: `${base}/api/money-reconcile?token=${t}` });
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
    return json({ ok: true, ran: results, hourUTC, minute });
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 500);
  }
}
