// Cloudflare Pages Function — /api/money-reconcile → the "prove Stripe = ledger" engine.
// Pulls the window's money events STRAIGHT from the Stripe API (checkout.session.completed +
// checkout.session.async_payment_succeeded + invoice.paid, mirroring exactly what the webhook
// ledgers), sums the cents, and compares against what OUR ledger recorded for the same
// window (reconcile_ledger_window: client_events 'payment' rows + the close&collect revenue
// rows — see db/money_reconcile.sql for the no-double-count split). Every run is persisted in
// money_reconcile_runs; on ANY mismatch it emits a 'failure' event (visible in /admin within
// seconds) AND emails the owner the branded discrepancy list. Designed to be hit once a day by
// a cron (cron-job.org / GitHub Action). GET or POST.
//   GET  /api/money-reconcile?token=SECRET            → default window: the last 25h
//   GET  /api/money-reconcile?token=SECRET&from=ISO&to=ISO
// If DIGEST_TOKEN is set in env, the request must include a matching token (so randoms can't
// burn Stripe API calls or spam the owner). Idempotent per window: the default window is
// anchored to the top of the hour, the run row is upserted on (window_start, window_end), and
// the mismatch alert fires ONCE per broken window — cron retries never re-alarm.
import { ownerAlertEmail } from "../lib/emailTemplates.js";
import { safeEq } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// Pull ONE Stripe event type for the window, paginated. Cap at 10 pages × 100 = 1,000 events
// per type per run — far beyond a day's volume today; if we ever hit the cap the run reports
// capped:true instead of silently under-counting (a truncated total must never read as "ok").
async function pullStripeEvents(key, type, fromEpoch, toEpoch) {
  const out = []; let after = "", capped = false;
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ type, limit: "100", "created[gte]": String(fromEpoch), "created[lt]": String(toEpoch) });
    if (after) qs.set("starting_after", after);
    const r = await fetch(`https://api.stripe.com/v1/events?${qs}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`stripe ${type} HTTP ${r.status}`);
    const data = await r.json();
    const rows = Array.isArray(data.data) ? data.data : [];
    out.push(...rows);
    if (!data.has_more || rows.length === 0) return { events: out, capped };
    after = rows[rows.length - 1].id;
  }
  return { events: out, capped: true };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(request.url);
    let p = {};
    if (request.method === "POST") { p = await request.json().catch(() => ({})); }
    const q = (k) => p[k] ?? url.searchParams.get(k);

    // FAIL-CLOSED like the sibling cron endpoints: a missing DIGEST_TOKEN denies (never runs
    // unauthenticated) so a misconfig can't leave this money endpoint open to burn Stripe API
    // calls / spam the owner. Set DIGEST_TOKEN in env before the cron can hit it.
    if (!env.DIGEST_TOKEN || !safeEq((q("token") || "").toString(), env.DIGEST_TOKEN)) return json({ ok: false, error: "unauthorized" }, 401);
    if (!env.STRIPE_SECRET_KEY) return json({ ok: false, ready: false, reason: "no STRIPE_SECRET_KEY" });
    const ING = env.INGEST_SECRET || "";

    // Window — default: the last 25h (daily cron with a 1h overlap so a slow cron never leaves
    // a gap), anchored to the top of the current hour so retries land on the SAME window row.
    const anchored = new Date(); anchored.setMinutes(0, 0, 0);
    const to = q("to") ? new Date(q("to").toString()) : anchored;
    const from = q("from") ? new Date(q("from").toString()) : new Date(to.getTime() - 25 * 3600 * 1000);
    if (isNaN(from) || isNaN(to) || from >= to) return json({ ok: false, error: "bad window" }, 400);

    // ── STRIPE SIDE — mirror EXACTLY what stripe-webhook.js ledgers, so a clean day is 0-diff:
    //   • skip Connect events (event.account → client's own Stripe, never our ledger),
    //   • skip invoice.paid with billing_reason 'subscription_create' (the webhook credits that
    //     first payment from checkout.session.completed and SKIPS the twin invoice event),
    //   • skip zero-amount events (trials / $0 invoices / mode:'setup' sessions — never ledgered).
    const fromEpoch = Math.floor(from.getTime() / 1000), toEpoch = Math.floor(to.getTime() / 1000);
    const [cs, asy, inv, chOk, chRef] = await Promise.all([
      pullStripeEvents(env.STRIPE_SECRET_KEY, "checkout.session.completed", fromEpoch, toEpoch),
      pullStripeEvents(env.STRIPE_SECRET_KEY, "checkout.session.async_payment_succeeded", fromEpoch, toEpoch),
      pullStripeEvents(env.STRIPE_SECRET_KEY, "invoice.paid", fromEpoch, toEpoch),
      // CHARGE TRACK (ADD): direct charges the agent collects on the call / by pay-link
      // (Gui "Fecha & Cobra") — gui-voice-pay / phone / stripe-link. Reconciled separately
      // against the tenant revenue ledger below; never folded into the checkout/invoice totals.
      pullStripeEvents(env.STRIPE_SECRET_KEY, "charge.succeeded", fromEpoch, toEpoch),
      pullStripeEvents(env.STRIPE_SECRET_KEY, "charge.refunded", fromEpoch, toEpoch),
    ]);
    const capped = cs.capped || asy.capped || inv.capped || chOk.capped || chRef.capped;
    const stripeRows = [];
    for (const ev of [...cs.events, ...asy.events, ...inv.events]) {
      if (ev.account) continue;
      const obj = ev.data?.object || {};
      if (ev.type === "invoice.paid" && obj.billing_reason === "subscription_create") continue;
      // ASYNC METHODS (bank debit etc.): a session that completed with payment_status 'unpaid'
      // was DEFERRED by the webhook (nothing ledgered yet) — the money is counted when the
      // async_payment_succeeded event lands instead, mirroring the webhook 1:1.
      // (only 'unpaid' — the webhook defers exactly that; 'no_payment_required' IS ledgered there)
      if (ev.type === "checkout.session.completed" && obj.payment_status === "unpaid") continue;
      const cents = (ev.type.startsWith("checkout.session.") ? obj.amount_total : obj.amount_paid) || 0;
      if (cents <= 0) continue;
      const email = (obj.customer_email || obj.customer_details?.email || "").toString().toLowerCase();
      stripeRows.push({ id: ev.id, type: ev.type, cents, email, guileo: (obj.metadata?.guileo || "").toString() });
    }
    const stripeCents = stripeRows.reduce((s, r) => s + r.cents, 0);

    // ── CHARGE TRACK (ADD) — a SECOND, independent reconciliation for the close&collect
    // direct-charge money path (Gui "Fecha & Cobra"). We look ONLY at charges the tenant's
    // customer paid the tenant (metadata.guileo='client_charge') — Guileo's own SaaS
    // subscription charges (no such metadata) are deliberately ignored so they can't read as
    // a mismatch here. Kept fully separate from the checkout/invoice totals above so the
    // proven 0-diff clean-day math is untouched.
    //   • PLATFORM charges (no event.account) → reconciled against the tenant revenue ledger.
    //   • CONNECT charges (event.account present) → the client's OWN Stripe; reported
    //     explicitly as off-platform (count + cents), never silently dropped.
    // Net = succeeded − refunded. charge.refunded carries a CUMULATIVE amount_refunded per
    // charge, so we dedupe refunds by charge id taking the max seen (two partial refunds on
    // one charge fire two events but the second's amount_refunded already includes the first).
    let chargePlatformCents = 0, chargePlatformCount = 0, chargeOffCents = 0, chargeOffCount = 0;
    const refundByCharge = new Map(); // charge id → max cumulative amount_refunded (platform only)
    for (const ev of chRef.events) {
      const obj = ev.data?.object || {};
      if ((obj.metadata?.guileo || "") !== "client_charge") continue;
      if (ev.account) continue; // connect refunds net out on the client's own books, not ours
      const id = obj.id || ev.id, ref = Number(obj.amount_refunded) || 0;
      refundByCharge.set(id, Math.max(refundByCharge.get(id) || 0, ref));
    }
    for (const ev of chOk.events) {
      const obj = ev.data?.object || {};
      if ((obj.metadata?.guileo || "") !== "client_charge") continue;
      const gross = (Number(obj.amount_captured) || Number(obj.amount) || 0);
      if (gross <= 0) continue;
      if (ev.account) { chargeOffCents += gross; chargeOffCount += 1; continue; } // Connect → off-platform
      chargePlatformCents += gross - (refundByCharge.get(obj.id) || 0);
      chargePlatformCount += 1;
    }

    // ── LEDGER SIDE — one gated RPC returns both halves already de-overlapped.
    const lr = await rpc("reconcile_ledger_window", { p_secret: ING, p_from: from.toISOString(), p_to: to.toISOString() });
    if (!lr.ok) return json({ ok: false, ready: false, reason: `reconcile_ledger_window HTTP ${lr.status} — paste db/money_reconcile.sql` });
    const ledger = await lr.json();
    const ledgerCents = Number(ledger?.ledger_cents) || 0;
    const ledgerCount = Number(ledger?.ledger_count) || 0;

    // ── CHARGE-TRACK LEDGER (ADD) — revenue rows for the direct-charge sources. Graceful:
    // a missing/renamed revenue table degrades to charge_ready:false and this whole track is
    // skipped (no fake mismatch), consistent with the checkout/invoice revenue probing.
    const cr = await rpc("reconcile_charges_window", { p_secret: ING, p_from: from.toISOString(), p_to: to.toISOString() });
    let chargeReady = false, chargeLedgerCents = 0, chargeLedgerCount = 0;
    if (cr.ok) { const cj = await cr.json().catch(() => null); chargeReady = !!cj?.ready; chargeLedgerCents = Number(cj?.charge_cents) || 0; chargeLedgerCount = Number(cj?.charge_count) || 0; }

    // ── COMPARE — totals AND counts must both line up. When they don't, ship the evidence:
    // every Stripe row of the window (capped at 40) so the owner can eyeball which payment
    // never landed in the ledger (an event with no email is the usual "expected miss" — the
    // webhook can't ledger a payer it can't identify).
    const mismatches = [];
    const notes = []; // informational — recorded + returned, but does NOT flip ok
    if (capped) mismatches.push({ kind: "stripe_page_cap", note: "more than 1,000 events in the window — totals incomplete, narrow the window" });
    if (stripeCents !== ledgerCents) mismatches.push({ kind: "total", stripe_cents: stripeCents, ledger_cents: ledgerCents, diff_cents: stripeCents - ledgerCents });
    if (stripeRows.length !== ledgerCount) mismatches.push({ kind: "count", stripe_events: stripeRows.length, ledger_events: ledgerCount });
    // CHARGE TRACK (ADD): connect (off-platform) client charges are ALWAYS surfaced explicitly
    // — the money lives on the client's own Stripe, so it legitimately won't be in our ledger,
    // but a CFO must SEE it rather than have it vanish. It's a note, not a mismatch.
    if (chargeOffCount > 0) notes.push({ kind: "charge_off_platform", off_platform_cents: chargeOffCents, off_platform_events: chargeOffCount, note: "Connect (client's own Stripe) — not in our ledger by design" });
    // Platform close&collect charges: INFORMATIONAL ONLY — the payment-link metadata lands on
    // the Checkout Session, NOT on the Charge object, so charge.succeeded rows arrive without
    // metadata.guileo and the Stripe side under-counts by design. Flipping `ok` here would
    // false-alarm the owner every day there's a close&collect sale (adversarial review caught
    // this pre-launch). Until charges carry payment_intent_data metadata, this track observes.
    if (chargeReady && (chargePlatformCents !== chargeLedgerCents || chargePlatformCount !== chargeLedgerCount)) {
      notes.push({ kind: "charge_note", stripe_cents: chargePlatformCents, ledger_cents: chargeLedgerCents, diff_cents: chargePlatformCents - chargeLedgerCents, stripe_events: chargePlatformCount, ledger_events: chargeLedgerCount, note: "close&collect charges vs revenue ledger — observational (charge metadata gap), never alarms" });
    }
    if (mismatches.length > 0 && stripeRows.length > 0) {
      mismatches.push({ kind: "stripe_rows", rows: stripeRows.slice(0, 40).map((r) => ({ id: r.id, type: r.type, cents: r.cents, email: r.email || "(no email — never ledgerable)", guileo: r.guileo })) });
    }
    const ok = mismatches.length === 0;
    const recordMismatches = [...mismatches, ...notes]; // persist both; ok already computed from mismatches only

    // ── RECORD the run (idempotent per window) — and learn whether this window already alarmed.
    let runId = null, alreadyRecorded = false;
    const rr = await rpc("reconcile_run_record", {
      p_secret: ING, p_window_start: from.toISOString(), p_window_end: to.toISOString(),
      p_stripe_cents: stripeCents, p_ledger_cents: ledgerCents,
      p_credited_events: stripeRows.length, p_ledgered_events: ledgerCount,
      p_mismatches: recordMismatches, p_ok: ok,
    });
    if (rr.ok) { const rec = await rr.json().catch(() => null); runId = rec?.id ?? null; alreadyRecorded = rec ? !rec.was_new : false; }
    else await emitFailure(env, "reconcile_record_failed", "", `run not persisted (HTTP ${rr.status}) — paste db/money_reconcile.sql`, { window_start: from.toISOString() });

    // ── ALERT on mismatch — once per broken window (retries of an already-recorded window stay quiet).
    let alerted = false;
    if (!ok && !alreadyRecorded) {
      const fmt = (c) => `$${(c / 100).toFixed(2)}`;
      await emitFailure(env, "money_reconcile_mismatch", "", `Stripe ${fmt(stripeCents)} (${stripeRows.length} ev) ≠ ledger ${fmt(ledgerCents)} (${ledgerCount} ev) · ${from.toISOString()} → ${to.toISOString()}`, { run_id: runId, mismatches: mismatches.slice(0, 3) });
      if (env.RESEND_API_KEY) {
        const owner = (env.OWNER_EMAIL || "smart@guileoai.com").split(",")[0].trim();
        const lines = mismatches.filter((m) => m.kind !== "stripe_rows").map((m) =>
          m.kind === "total" ? `TOTAL: Stripe ${fmt(m.stripe_cents)} vs ledger ${fmt(m.ledger_cents)} (diferença ${fmt(m.diff_cents)})`
          : m.kind === "count" ? `CONTAGEM: ${m.stripe_events} eventos no Stripe vs ${m.ledger_events} no ledger`
          : m.kind === "charge_total" ? `COBRANÇAS (Fecha & Cobra): Stripe ${fmt(m.stripe_cents)} (${m.stripe_events}) vs ledger ${fmt(m.ledger_cents)} (${m.ledger_events}) · diferença ${fmt(m.diff_cents)}`
          : `${m.kind}: ${m.note || ""}`);
        const rowLines = stripeRows.slice(0, 15).map((r) => `${r.type} · ${fmt(r.cents)} · ${r.email || "(sem email)"}${r.guileo ? " · " + r.guileo : ""} · ${r.id}`);
        const tpl = ownerAlertEmail({
          kind: "billing", customer: "reconciliação", business: "Guileo money reconcile",
          details: `⚠️ Stripe ≠ ledger na janela ${from.toISOString().slice(0, 16)} → ${to.toISOString().slice(0, 16)} UTC. ${lines.join(" · ")}. Eventos Stripe da janela: ${rowLines.join(" | ") || "(nenhum)"}. Run #${runId || "?"} em money_reconcile_runs. Conferir /admin + Stripe Dashboard antes de fechar o caixa.`,
          amount: fmt(stripeCents - ledgerCents), lang: "pt",
        });
        const sr = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [owner], subject: tpl.subject, html: tpl.html }),
        });
        alerted = sr.ok;
      }
    }

    // ── COSTS (observability only — voice/close-collect spend + anomalies; never affects `ok`) ──────
    let costs = { ready: false, reason: "not run" };
    try {
      const csr = await rpc("recon_costs_window", { p_secret: ING, p_since: from.toISOString() });
      if (csr.ok) { const cj = await csr.json(); costs = cj || { ready: false, reason: "empty" }; }
      else costs = { ready: false, reason: `recon_costs_window HTTP ${csr.status} — paste db/ops_gaps.sql` };
    } catch (e) { costs = { ready: false, reason: String(e).slice(0, 120) }; }

    return json({
      ok, run_id: runId, alerted,
      window: { from: from.toISOString(), to: to.toISOString() },
      stripe: { cents: stripeCents, events: stripeRows.length, capped },
      ledger: { cents: ledgerCents, events: ledgerCount, revenue_ready: !!ledger?.revenue_ready },
      charges: { ready: chargeReady, platform_cents: chargePlatformCents, platform_events: chargePlatformCount, ledger_cents: chargeLedgerCents, ledger_events: chargeLedgerCount, off_platform_cents: chargeOffCents, off_platform_events: chargeOffCount },
      costs,
      mismatches: mismatches.filter((m) => m.kind !== "stripe_rows"),
      notes,
    });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...cors } });
