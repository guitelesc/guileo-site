// Cloudflare Pages Function — POST /api/stripe-webhook
// Stripe → REAL Gui credits. On checkout.session.completed / invoice.paid the payer's
// email is credited (1 credit per USD) in client_credits, which the portal reads live.
// Signature-verified with STRIPE_WEBHOOK_SECRET (whsec_…). Works in test & live mode.
import { json, safeEq } from "../lib/guard.js";
import { welcomeSelfServeEmail, ownerAlertEmail, dunningEmail, sellerCommissionEmail } from "../lib/emailTemplates.js";
import { provisionClientAgent, buyAndBindNumber, forwardingInstructions, buildDefaultSchedulePayload } from "../lib/provision.js";
import { emitFailure } from "../lib/failure.js";
import { reportPurchase } from "../lib/adsConversions.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
// dedicated server-side secret for the self-serve pending-onboarding RPCs (matches db/_gui_pend_ok).
// Set PEND_SECRET in Cloudflare env + rotate the DB literal; inline value is a fallback only.
const PEND_FALLBACK = "gx_pend_7Qk2mZ9vR4tLpW8n_cit3l3s";
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const langFromCountry = (c) => (c === "BR" ? "pt" : ["ES", "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "DO", "UY", "PY", "BO"].includes(c) ? "es" : "en");
// Derive a US/NANP area code (3 digits, first digit 2-9) from a phone string, so a self-serve
// client gets a LOCAL number near their business instead of a random US DDD (better first
// impression). Returns "" when nothing valid can be derived (→ buyAndBindNumber picks any US).
const usAreaCode = (phone) => {
  const d = (phone || "").toString().replace(/[^0-9]/g, "");
  const ten = d.length === 11 && d[0] === "1" ? d.slice(1) : (d.length === 10 ? d : "");
  const ac = ten.slice(0, 3);
  return /^[2-9]\d\d$/.test(ac) ? ac : "";
};
// Platform demo/outbound line (ELEVENLABS_PHONE_NUMBER_ID) — RESERVED, never handed to a client.
const RESERVED_NUMBER = "+19864443334";

async function verifyStripeSig(payload, sigHeader, secret) {
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  // 5-minute replay window
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return safeEq(hex, v1);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "not configured" }, 501);
    const PEND_SECRET = env.PEND_SECRET || PEND_FALLBACK;
    const payload = await request.text();
    const sig = request.headers.get("Stripe-Signature") || "";
    if (!(await verifyStripeSig(payload, sig, env.STRIPE_WEBHOOK_SECRET))) {
      return json({ error: "bad signature" }, 401);
    }

    const event = JSON.parse(payload);
    const type = event.type || "";
    const obj = event.data?.object || {};

    // CONNECTED-ACCOUNT GUARD (money): events carrying `account` belong to a CLIENT'S Stripe
    // (Gui close&collect direct charges). Their customers must NEVER be minted Guileo credits or
    // auto-provisioned an agent — that's the client's revenue, not a plan purchase. Ack + skip.
    if (event.account) return json({ received: true, connect: true });

    // Idempotency — Stripe retries webhooks; credit each event EXACTLY once. mark_webhook_seen
    // atomically records the event id and returns true the first time, false if already seen.
    // If we CAN'T confirm the check (RPC down / non-2xx / unparseable), return 500 so Stripe
    // re-delivers later instead of guessing: never double-credit (we only proceed on a confirmed
    // first delivery) and never drop a paying customer's credit (Stripe keeps retrying until ok).
    if (event.id) {
      try {
        const sr = await fetch(`${SB_URL}/rest/v1/rpc/mark_webhook_seen`, {
          method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_provider: "stripe", p_event_id: event.id }),
        });
        if (!sr.ok) return json({ error: "idempotency check unavailable — retry" }, 500);
        if ((await sr.json()) === false) return json({ received: true, duplicate: true });
        // true → first delivery of this event id; safe to credit below.
      } catch { return json({ error: "idempotency check error — retry" }, 500); }
    }

    // REFUND / DISPUTE — best-effort, never throws. Now auto-REVOKES the credits the refunded
    // dollars bought (deduct_client_credits, 1 credit/USD, clamped ≥ 0, idempotent by the charge/
    // dispute id) AND logs a negative "refund" event, then alerts the owner. The event-id gate
    // above already ran this branch exactly once; the deduct ref is a second belt-and-suspenders.
    if (type === "charge.refunded" || type === "charge.dispute.created") {
      try {
        const ING = env.INGEST_SECRET || "";
        // charge.dispute.created → obj is a dispute (obj.amount); charge.refunded → obj is a
        // charge (obj.amount_refunded). Both are in cents.
        const refundedCents = (type === "charge.dispute.created" ? obj.amount : obj.amount_refunded) || 0;
        const email = (obj.customer_email || obj.customer_details?.email || obj.receipt_email || obj.billing_details?.email || "").toString().toLowerCase();
        const kind = type === "charge.dispute.created" ? "dispute" : "refund";
        // REVOKE credits with the SAME exact-price maps the crediting path uses (plans are NOT
        // 1 credit/USD — $149→500, $449→2000, $999→6000; top-ups $49→500, $119→1500). A full refund
        // matches a plan/top-up price exactly; a partial refund falls through to a conservative
        // per-dollar estimate (never over-deducts; `least(cur,want)` clamps ≥0). Idempotent by the
        // refund/dispute object id so a Stripe retry can never double-deduct.
        const PLAN_CREDITS = { 14900: 500, 44900: 2000, 99900: 6000 };
        const TOPUP_CREDITS = { 4900: 500, 11900: 1500 };
        const revoke = PLAN_CREDITS[refundedCents] || TOPUP_CREDITS[refundedCents] || Math.round(refundedCents / 100);
        let balanceAfter = null;
        if (email && revoke > 0) {
          try {
            const dr = await rpc("deduct_client_credits", { p_secret: ING, p_email: email, p_credits: revoke, p_reason: kind, p_ref: `stripe:${kind}:${obj.id || obj.charge || event.id}` });
            if (dr.ok) balanceAfter = await dr.json().catch(() => null);
          } catch { /* deduct is best-effort; the negative event below still records it */ }
        }
        await rpc("ingest_client_event", {
          p_secret: ING, p_email: email, p_type: "refund", p_channel: "stripe",
          p_summary: `${kind === "dispute" ? "Dispute" : "Refund"} · -$${(refundedCents / 100).toFixed(2)} · −${revoke} cr${email ? " · " + email : ""}`,
          p_amount: -(refundedCents / 100), p_payload: { id: obj.id || "", charge: obj.charge || "", kind, revoked_credits: revoke, balance_after: balanceAfter },
        });
        if (env.RESEND_API_KEY) {
          const owner = (env.OWNER_EMAIL || "smart@guileoai.com").split(",")[0].trim();
          const revokedLine = email && revoke > 0
            ? `<p>Credits <b>auto-revoked: −${revoke}</b>${balanceAfter != null ? ` (new balance: <b>${balanceAfter}</b>)` : ""}.</p>`
            : `<p>No credits revoked (${email ? "amount rounded to 0" : "no customer email on the event"}).</p>`;
          await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [owner],
              subject: `⚠️ Stripe ${kind}: -$${(refundedCents / 100).toFixed(2)}${email ? " (" + email + ")" : ""}`,
              html: `<p>A Stripe <b>${kind}</b> was received.</p>`
                + `<p>Amount: <b>-$${(refundedCents / 100).toFixed(2)}</b><br>Customer: ${email || "(unknown)"}<br>Charge/Dispute id: ${obj.charge || obj.id || "(none)"}</p>`
                + revokedLine,
            }),
          });
        }
      } catch { /* refund handling is best-effort; never throw */ }
      return json({ received: true, refund: true });
    }

    // DUNNING — payment failed / subscription canceled. Best-effort, never throws.
    // IMPORTANT: provisioning is NEVER touched here — how long a client keeps their Gui after a
    // failed charge (grace period) is a business decision for Luis, not this webhook's. We only
    // (a) ledger a loud 'billing' client_event so the Cockpit + /admin show it,
    // (b) send the CLIENT a gentle branded reminder pointing at their billing portal
    //     (only on payment_failed — a canceled subscriber must NOT get a "pay now" email),
    // (c) alert the owner with full context. Idempotent via the event-id gate above.
    if (type === "invoice.payment_failed" || type === "customer.subscription.deleted") {
      try {
        const ING = env.INGEST_SECRET || "";
        const email = (obj.customer_email || obj.customer_details?.email || obj.receipt_email || obj.billing_details?.email || "").toString().toLowerCase();
        const cents = obj.amount_due ?? obj.amount_remaining ?? 0; // invoice amounts; a deleted subscription has none
        const failed = type === "invoice.payment_failed";
        const amt = cents > 0 ? `$${(cents / 100).toFixed(2)}` : "";
        await rpc("ingest_client_event", {
          p_secret: ING, p_email: email, p_type: "billing", p_channel: "stripe",
          p_summary: failed ? `⚠️ Pagamento falhou${amt ? " · " + amt : ""} — cartão recusado/expirado` : "⚠️ Assinatura cancelada no Stripe",
          p_amount: 0, p_payload: { id: obj.id || "", kind: type, attempt: obj.attempt_count || 0 },
        });
        if (env.RESEND_API_KEY && email && failed) {
          // Gentle branded dunning email (dedicated template — concierge tone, one CTA to the
          // Billing tab, no fake urgency). Language: the profile lang isn't cheaply available in
          // this branch (no tenant lookup here), so we infer it from the invoice's billing
          // country via the same langFromCountry helper provisioning uses; falls back to "en".
          const first = (obj.customer_name || "").toString().split(" ")[0] || "there";
          const dLang = langFromCountry((obj.customer_address?.country || obj.customer_details?.address?.country || "").toString().toUpperCase());
          const tpl = dunningEmail({
            name: first, business: (obj.customer_name || (dLang === "pt" ? "seu negócio" : dLang === "es" ? "tu negocio" : "your business")).toString(),
            amountLabel: amt, lang: dLang,
          });
          await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [email], subject: tpl.subject, html: tpl.html }),
          });
        }
        if (env.RESEND_API_KEY) {
          // Owner context alert (branded — ownerAlertEmail; unknown kind renders the generic 🔔 card).
          const owner = (env.OWNER_EMAIL || "smart@guileoai.com").split(",")[0].trim();
          const otpl = ownerAlertEmail({
            kind: "billing", customer: email || "(sem email)", business: "Guileo billing",
            details: failed ? `⚠️ Pagamento FALHOU${amt ? " · " + amt : ""} · tentativa ${obj.attempt_count || 1} · Stripe segue tentando. Nada foi desligado automaticamente — decidir grace period.` : `⚠️ Assinatura CANCELADA no Stripe. Nada foi desligado automaticamente — decidir o que fazer com a Gui do cliente.`,
            amount: amt, lang: "pt",
          });
          await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [owner], subject: otpl.subject, html: otpl.html }),
          });
        }
      } catch { /* dunning is best-effort; never throw */ }
      return json({ received: true, billing: true });
    }

    // ASYNC PAYMENT FAILED — a delayed-method checkout (bank debit etc.) "completed" earlier but the
    // money never cleared. Nothing was credited (the unpaid guard below deferred it); alert so the
    // owner knows this customer THINKS they bought and must be contacted. Best-effort, never throws.
    if (type === "checkout.session.async_payment_failed") {
      const aEmail = (obj.customer_email || obj.customer_details?.email || "").toString().toLowerCase();
      await emitFailure(env, "async_payment_failed", aEmail, `checkout completed but the delayed payment FAILED — $${(((obj.amount_total ?? 0)) / 100).toFixed(2)} never collected; contact the customer`, { session: obj.id || "" });
      return json({ received: true, async_failed: true });
    }

    // NOTE: invoice.payment_succeeded is deliberately NOT in this list — Stripe fires BOTH
    // invoice.paid AND invoice.payment_succeeded (different event ids) for the same renewal
    // charge, so handling both would double-credit every renewal. invoice.paid alone covers
    // every paid invoice.
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded" || type === "invoice.paid") {
      // one flag for "a checkout session with money in it" — completed (card, instant) OR the
      // delayed-method success event (same session object re-delivered once the money clears).
      const isCheckout = type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded";
      // DEDUP — a Stripe subscription's FIRST payment fires BOTH checkout.session.completed
      // AND invoice.paid, with two DIFFERENT event ids, so the event-id idempotency above does
      // NOT catch them and the customer would be credited twice in month 1.
      // checkout.session.completed already credits that first payment, so we SKIP the invoice
      // event when it's the subscription's first invoice (billing_reason ===
      // "subscription_create"). Renewals ("subscription_cycle" / any non-create reason) still
      // credit here. One-off (non-subscription) checkouts have no invoice event → credit once.
      if (type === "invoice.paid" && obj.billing_reason === "subscription_create") {
        return json({ received: true, skipped: "subscription_create (already credited by checkout.session.completed)" });
      }
      // ASYNC PAYMENT METHODS — with a delayed method the session "completes" BEFORE the money
      // clears (payment_status "unpaid"). Credit/ledger NOTHING now: crediting here would mint
      // credits for money that may never arrive. checkout.session.async_payment_succeeded
      // re-enters this exact path once the funds land (async_payment_failed alerts above).
      if (type === "checkout.session.completed" && obj.payment_status === "unpaid") {
        return json({ received: true, deferred: "awaiting async payment" });
      }
      // CURRENCY ANCHOR — every price we mint is USD (setup-selfserve), so the exact-amount
      // credit maps below are USD maps. A non-USD payment (adaptive pricing / a foreign-currency
      // price sneaking in) must NEVER hit them: 4900 JPY is ~$33, not $49. Guarded per-path below.
      const usd = !obj.currency || String(obj.currency).toLowerCase() === "usd";
      const ING = env.INGEST_SECRET || "";
      // canonical, consistent across payment + refund branches (0.4) so the same tenant is always resolved
      const email = (obj.customer_email || obj.customer_details?.email || obj.receipt_email || obj.billing_details?.email || "").toString().toLowerCase();
      // GRACE-PAUSE RELEASE — a real payment un-pauses a previously past-due tenant automatically
      // (the dunning sweep may have paused their agent actions). No-op if they weren't paused.
      if (email) { try { await rpc("set_client_paused", { p_secret: ING, p_email: email, p_paused: false }); } catch { /* best-effort */ } }
      const cents = obj.amount_total ?? obj.amount_paid ?? 0;
      const meta = obj.metadata || {};
      const lineMeta = obj.lines?.data?.[0]?.price?.metadata || {};
      // TOP-UP (one-time credit recharge) — Payment Links minted by setup-selfserve carry
      // metadata { guileo:"topup", credits } which Stripe copies onto the checkout session.
      // These payers are EXISTING clients buying loose credits: credit them + drop a friendly
      // client_event, but send NO welcome email and do NOT provision (skip the plan path
      // entirely). Amount-anchored like the plans: the exact-price map is the source of truth;
      // link metadata alone can never mint more credits than a sane per-dollar cap allows.
      if (isCheckout && meta.guileo === "topup") {
        if (!usd) {
          await emitFailure(env, "non_usd_payment", email, `topup paid ${obj.currency} ${(cents / 100).toFixed(2)} — NOT credited (USD map only); resolve in Stripe dashboard`, { session: obj.id || "", currency: obj.currency || "" });
          return json({ received: true, topup: true, uncredited: "non-usd" });
        }
        const TOPUP_CREDITS = { 4900: 500, 11900: 1500 }; // Recarga 500 / Recarga 1500
        const metaCr = Math.max(0, Math.round(Number(meta.credits) || 0));
        const topCr = TOPUP_CREDITS[cents] || (cents > 0 ? Math.min(metaCr, Math.ceil(cents / 100) * 13) : 0);
        if (email && topCr > 0) {
          // same defense-in-depth credit claim as the plan path — never double-credit a retry.
          // Keyed on the SESSION id (not the event id) so any second Stripe event carrying the
          // same money object (redelivery under a new id, async variants) can never re-credit.
          let mayCredit = true;
          if (obj.id || event.id) {
            try {
              const clm = await rpc("claim_credit_event", { p_secret: PEND_SECRET, p_event_id: obj.id || event.id, p_email: email });
              if (clm.ok) { const claimed = await clm.json(); if (claimed === false) mayCredit = false; }
            } catch { /* claim RPC missing → fall back to the event-id gate above */ }
          }
          if (!mayCredit) return json({ received: true, topup: true, already_credited: true });
          const cr = await rpc("add_client_credits", { p_secret: ING, p_email: email, p_credits: topCr, p_plan: "topup" });
          if (!cr.ok) await emitFailure(env, "credit_storage_failed", email, `topup paid $${(cents / 100).toFixed(2)} → ${topCr} cr NOT stored`, { session: obj.id || "" });
          await rpc("ingest_client_event", { p_secret: ING, p_email: email, p_type: "payment", p_channel: "stripe", p_summary: `🔋 Recarga: +${topCr} créditos`, p_amount: cents / 100, p_payload: { session: obj.id || "", topup: true } });
        } else if (cents > 0) {
          // money moved but nothing was credited (no customer email on the session / odd amount)
          // — a silent paid-but-nothing is a money-back trigger; surface it in /admin now.
          await emitFailure(env, "paid_but_uncredited", email, `topup paid $${(cents / 100).toFixed(2)} but ${email ? "0 credits computed" : "the session has NO customer email"} — resolve in Stripe dashboard`, { session: obj.id || "" });
        }
        return json({ received: true, topup: true });
      }
      // SETUP FEE (Configuração Assistida) — the client pays Guileo a ONE-TIME onboarding fee. It is
      // REVENUE, not a credit purchase: record the payment so it's visible in their billing history and
      // reconciles against the Stripe charge, but grant ZERO plan credits — so a $199 setup never falls
      // through to the default "1 credit per USD" and wrongly hands out 199 credits. Recognized by
      // metadata.guileo="setup" OR the exact 19900¢ price (STRIPE_SETUP.md · Configuração Assistida).
      if (isCheckout && (meta.guileo === "setup" || cents === 19900)) {
        if (email && cents > 0) {
          try {
            await rpc("ingest_client_event", {
              p_secret: ING, p_email: email, p_type: "payment", p_channel: "stripe",
              p_summary: `🛠️ Configuração Assistida · $${(cents / 100).toFixed(2)}`,
              p_amount: cents / 100, p_payload: { session: obj.id || "", setup: true },
            });
          } catch { /* best-effort — the Stripe side still reconciles */ }
        } else if (cents > 0) {
          await emitFailure(env, "setup_no_email", email, `Configuração Assistida $${(cents / 100).toFixed(2)} paga mas a sessão não tem email do cliente — registre manualmente`, { session: obj.id || "" });
        }
        return json({ received: true, setup: true });
      }
      // Recognize the self-serve plans by their exact price (so the Payment Links can be
      // plain — no metadata needed): $149→500cr, $449→2,000cr, $999→6,000cr. Any other
      // amount falls back to 1 credit per USD. Metadata NEVER decides credits (see below);
      // the PLAN_CREDITS exact-amount mapping is the source of truth.
      const PLAN_CREDITS = { 14900: 500, 44900: 2000, 99900: 6000 };
      const PLAN_NAME = { 14900: "Essential", 44900: "Personalized", 99900: "Full Operation" };
      // SECURITY: credits derive ONLY from the amount actually paid — NEVER from Stripe metadata
      // (price/line metadata is editable and could grant 100k credits for $0.01). Metadata = plan label only.
      const credits = PLAN_CREDITS[cents] || Math.round(cents / 100);
      const plan = (meta.plan || lineMeta.plan || PLAN_NAME[cents] || obj.lines?.data?.[0]?.description || "").toString();
      // CLIENT-CHARGE GUARD (money): Gui close&collect links on the OWNER fallback account are tagged
      // metadata.guileo="client_charge" (agent-action.js). That payer is a CLIENT'S customer — never
      // credit/provision THEM; instead ledger the payment as the tenant's revenue so "collected on the
      // call" actually lands in their Cockpit. Event-id dedup above already makes this once-only.
      if (meta.guileo === "client_charge") {
        const tenant = (meta.tenant || "").toString().toLowerCase();
        if (tenant && cents > 0 && env.SCHED_SECRET) {
          const rr = await rpc("revenue_record", { p_secret: env.SCHED_SECRET, p_email: tenant, p_category: "invoice", p_amount_cents: cents, p_ref: obj.id || null, p_source: "stripe-link", p_meta: { payer: email } });
          if (!rr.ok) await emitFailure(env, "revenue_record_failed", tenant, `customer paid $${(cents / 100).toFixed(2)} on a Gui link but NOT ledgered`, { session: obj.id || "" });
        }
        return json({ received: true, client_charge: true });
      }
      // RECURRING-REVENUE FULFILL (money): the tenant's CUSTOMER bought a package / membership / gift
      // card via a Gui sell-link (functions/api/packages.js / giftcards.js). Fulfill into the TENANT's
      // data — never credit/provision the payer. Merges subscription_details.metadata so a membership
      // RENEWAL invoice is caught too. Event-id dedup above + per-record idempotency make this once-only.
      const gmeta = { ...(obj.subscription_details?.metadata || {}), ...meta };
      if (gmeta.guileo === "package" || gmeta.guileo === "membership" || gmeta.guileo === "giftcard") {
        const tenant = (gmeta.client_email || "").toString().toLowerCase();
        const buyer = email || (gmeta.contact || gmeta.purchaser_contact || "").toString().toLowerCase();
        try {
          // fetch does NOT throw on non-2xx — every fulfill RPC must be .ok-checked or a DB 500
          // becomes a silently-dropped paid order (the catch below only saw network errors).
          if (gmeta.guileo === "package" && tenant && gmeta.id) {
            let sessions = Math.max(0, Math.round(Number(gmeta.sessions) || 0));
            if (!sessions) {
              const pl = await rpc("package_list", { p_secret: ING, p_client_email: tenant });
              if (pl.ok) { const arr = await pl.json().catch(() => []); const p = (Array.isArray(arr) ? arr : []).find((x) => x && x.id === gmeta.id); sessions = p ? Number(p.sessions) || 0 : 0; }
            }
            const fr = await rpc("package_purchase_record", { p_secret: ING, p_client_email: tenant, p_package_id: gmeta.id, p_contact: buyer, p_sessions: sessions, p_stripe_session_id: obj.id || null });
            if (!fr.ok) throw new Error(`package_purchase_record ${fr.status}`);
          } else if (gmeta.guileo === "membership" && tenant && gmeta.id) {
            const fr = await rpc("membership_subscriber_record", { p_secret: ING, p_client_email: tenant, p_membership_id: gmeta.id, p_contact: buyer, p_status: "active", p_stripe_sub_id: (obj.subscription || obj.id || "").toString() });
            if (!fr.ok) throw new Error(`membership_subscriber_record ${fr.status}`);
          } else if (gmeta.guileo === "giftcard" && tenant) {
            // anchor to the AMOUNT PAID (a promo code must shrink the card, not mint full value)
            const amt = Math.max(0, Math.round(cents || Number(gmeta.amount_cents) || 0));
            const fr = await rpc("giftcard_create", { p_secret: ING, p_client_email: tenant, p_card: { amount_cents: amt, recipient_contact: gmeta.recipient_contact || "", purchaser_contact: gmeta.purchaser_contact || buyer || "" } });
            if (!fr.ok) throw new Error(`giftcard_create ${fr.status}`);
          }
          // also ledger as the tenant's revenue so it lands in their Finance (best-effort)
          if (tenant && cents > 0 && env.SCHED_SECRET) {
            await rpc("revenue_record", { p_secret: env.SCHED_SECRET, p_email: tenant, p_category: gmeta.guileo, p_amount_cents: cents, p_ref: obj.id || null, p_source: "stripe-link", p_meta: { payer: buyer } });
          }
          await rpc("ingest_client_event", { p_secret: ING, p_email: tenant, p_type: "payment", p_channel: "stripe", p_summary: `💳 ${gmeta.guileo === "package" ? "Pacote" : gmeta.guileo === "membership" ? "Assinatura" : "Gift card"} · $${(cents / 100).toFixed(2)}`, p_amount: cents / 100, p_payload: { session: obj.id || "", kind: gmeta.guileo } });
        } catch { await emitFailure(env, "recurring_fulfill_failed", tenant, `${gmeta.guileo} paid $${(cents / 100).toFixed(2)} but fulfill failed`, { session: obj.id || "" }); }
        return json({ received: true, recurring: gmeta.guileo });
      }
      if (email && credits > 0) {
        // CURRENCY ANCHOR — a 14900-cents payment in BRL/JPY must not hit the USD PLAN_CREDITS
        // map (nor the 1-credit-per-"dollar" fallback). Non-USD = anomaly on our account:
        // credit nothing, alert loudly, let the owner resolve it by hand.
        if (!usd) {
          await emitFailure(env, "non_usd_payment", email, `paid ${obj.currency} ${(cents / 100).toFixed(2)} — NOT credited (USD maps only); resolve in Stripe dashboard`, { session: obj.id || "", currency: obj.currency || "" });
          return json({ received: true, uncredited: "non-usd" });
        }
        // IDEMPOTENCY (defense-in-depth on money): claim this event for crediting EXACTLY once. If already
        // claimed → skip (never double-credit). If the claim RPC isn't installed yet (db/credit_idempotency.sql
        // not pasted), proceed with the legacy dedup. Atomic ON CONFLICT, independent of mark_webhook_seen.
        // Keyed on the MONEY OBJECT id (session / invoice id) rather than the event id, so two
        // different Stripe events describing the same payment can never credit twice.
        let mayCredit = true;
        if (obj.id || event.id) {
          try {
            const clm = await rpc("claim_credit_event", { p_secret: PEND_SECRET, p_event_id: obj.id || event.id, p_email: email });
            if (clm.ok) { const claimed = await clm.json(); if (claimed === false) mayCredit = false; }
          } catch { /* claim RPC missing → fall back to legacy dedup */ }
        }
        if (!mayCredit) return json({ received: true, already_credited: true });
        // 1.1 — credits are what the customer PAID for; if storage fails, surface LOUDLY (a paid-but-not-
        // credited customer is a money-back trigger). We don't 500 here (the event is already marked seen,
        // so a retry would skip) — instead emit a failure event so /admin catches it within seconds.
        const cr = await rpc("add_client_credits", { p_secret: ING, p_email: email, p_credits: credits, p_plan: plan.slice(0, 80) });
        if (!cr.ok) await emitFailure(env, "credit_storage_failed", email, `paid $${(cents / 100).toFixed(2)} → ${credits} cr NOT stored`, { session: obj.id || "" });
        await rpc("ingest_client_event", { p_secret: ING, p_email: email, p_type: "payment", p_channel: "stripe", p_summary: `Payment · $${(cents / 100).toFixed(2)} → +${credits} credits${plan ? " · " + plan : ""}`, p_amount: cents / 100, p_payload: { session: obj.id || "" } });

        // ADS ATTRIBUTION — report the REAL purchase to Meta CAPI + GA4 server-side (best-effort,
        // deferred past the ACK). eventId = Stripe SESSION id: webhook retries re-send the SAME id,
        // so Meta (event_id) and GA4 (transaction_id) dedup instead of double-counting revenue.
        context.waitUntil(reportPurchase(env, { email, amountCents: cents, plan, eventId: obj.id || event.id }).catch(() => {}));

        // AUTO-PROVISION — on the FIRST payment, BUILD the client's trained Gui automatically AND give it a
        // phone number (the AI answers it). We pull the brain they entered in /go-live (gui_pending_onboarding,
        // keyed by email); if there's no captured brain (paid straight from /planos) we still create a basic
        // Gui they refine in the portal. Then we BUY a Twilio number, bind inbound, and the welcome email
        // carries the call-forwarding instructions so the client routes their own business line into the AI.
        // Best-effort: a failure never blocks the credit/welcome (it's surfaced in /admin to finish by hand).
        // pend + bizName are hoisted here so the self-serve welcome email below can use the REAL
        // business name (not a generic "seu negócio") and the failure alert has full context.
        // DEFERRED (ACK-first) — provisioning (ElevenLabs agent + Twilio number) + the self-serve
        // welcome email can take >10s, past Stripe's webhook timeout, which would make Stripe mark
        // the delivery FAILED and retry. A retry is harmless (the event-id + claim_credit_event gates
        // already made credits once-only → the retry returns duplicate:true / already_credited), but
        // the Stripe dashboard shouldn't show red for a provision that in fact succeeded. So we ACK
        // 200 fast and run this in the background via context.waitUntil. ZERO change to credit logic:
        // add_client_credits / ledger / referral all stay inline & synchronous above; only the
        // provision+welcome SCHEDULING moved here (their inner logic is byte-for-byte unchanged).
        // DEMO ATTRIBUTION (additive, deferred, wrapped) — if this session came from a
        // personalized demo, client_reference_id is demo_<token>_<product>. Close the funnel
        // with a checkout_done event. A failure here can NEVER touch the credit logic above.
        if (isCheckout) context.waitUntil((async () => {
          try {
            const ref = (obj.client_reference_id || "").toString();
            if (ref.startsWith("demo_")) {
              const rest = ref.slice(5);
              const usc = rest.indexOf("_");
              const dToken = usc > 0 ? rest.slice(0, usc) : rest;
              const dProduct = usc > 0 ? rest.slice(usc + 1) : "";
              await rpc("demo_event", { p_secret: env.INGEST_SECRET || "glo_ing_7f3da9c2b4e8", p_token: dToken, p_kind: "checkout_done", p_product: dProduct, p_contact: { email } });
            }
          } catch { /* attribution best-effort */ }
        })());

        if (isCheckout) context.waitUntil((async () => {
        let provNumber = "", provLang = langFromCountry((obj.customer_details?.address?.country || "").toString().toUpperCase()), fwd = null, pend = null, bizName = "";
        if (env.ELEVENLABS_API_KEY) {
          try {
            try {
              const gr = await rpc("get_pending_onboarding", { p_secret: PEND_SECRET, p_email: email });
              if (gr.ok) pend = (((await gr.json()) || [])[0]) || null;
            } catch { /* fall back to a basic agent below */ }
            if (!pend || pend.status !== "provisioned") {
              const buyerName = (obj.customer_details?.name || "").toString();
              bizName = (pend?.business || buyerName || email.split("@")[0]).toString();
              provLang = pend?.lang || provLang;
              // #10 THIN BIRTH — a payment straight from /planos (no /go-live capture) has no pend
              // brain: the Gui is born "magra" (empty brain, no prices/menu). DECISION: we do NOT
              // defer the number purchase — a paying client must get a working line today, and they
              // refine the brain in the portal (the welcome email points there). We only FLAG it
              // loudly so /admin can enrich it. Non-blocking: credit + agent + number still proceed.
              if (!(pend?.brain || "").toString().trim()) {
                await emitFailure(env, "thin_agent_born", email, "paid without a captured brain (/planos direct) — Gui born without prices/menu; enrich in /admin or client refines in portal", { session: obj.id || "" });
              }
              const prov = await provisionClientAgent(env, {
                email, business: bizName, industry: (pend?.industry || "").toString(),
                lang: provLang, brain: (pend?.brain || "").toString(), agentName: (pend?.agent_name || "").toString(),
              }, ING);
              if (prov.ok && prov.agent_id) {
                // DAY-1 SCHEDULING SEED (parity with /admin onboard) — without this a self-serve client who
                // paid can't actually book ("no services"). Best-effort; only seeds when empty.
                if (env.SCHED_SECRET) {
                  try {
                    const lkr = await rpc("biz_lookup", { p_secret: env.SCHED_SECRET, p_email: email });
                    const menu2 = lkr.ok ? await lkr.json() : {};
                    if (!(Array.isArray(menu2?.services) && menu2.services.length > 0)) {
                      const payload = buildDefaultSchedulePayload({ industry: (pend?.industry || "").toString(), lang: provLang, tz: (pend?.tz || "America/New_York").toString() });
                      await rpc("biz_admin_import", { p_secret: env.SCHED_SECRET, p_email: email, p_payload: payload });
                    }
                  } catch { /* best-effort */ }
                }
                // BUY + BIND the number so an inbound call is answered by their Gui (client forwards their line to it)
                // #1 LOCAL NUMBER — derive the area code from the business phone they entered in
                // /go-live (pend.phone), falling back to the phone on the Stripe checkout, so the
                // bought number is LOCAL to the client instead of a random US DDD. "" → any US.
                const areaCode = usAreaCode(pend?.phone) || usAreaCode(obj.customer_details?.phone);
                const num = await buyAndBindNumber(env, { email, agentId: prov.agent_id, areaCode, label: `Gui · ${bizName}` }, ING);
                // #2-self RESERVED GUARD — the platform demo line must NEVER become a client number,
                // even if it somehow surfaced from the pool / a mis-set lookup. Refuse it and leave the
                // number pending so /admin assigns a real one (never silently hand out the demo line).
                if (num.ok && num.number && num.number.replace(/[^0-9]/g, "") === RESERVED_NUMBER.replace(/[^0-9]/g, "")) {
                  await emitFailure(env, "reserved_number_blocked", email, `provision returned the RESERVED demo line ${RESERVED_NUMBER} — refused; assign a real number in /admin`, { agent_id: prov.agent_id });
                } else if (num.ok && num.number) { provNumber = num.number; fwd = forwardingInstructions(num.number, provLang); }
                else await emitFailure(env, "number_provision_failed", email, `agent ok but no number — finish in /admin · ${num.reason || ""}`, { agent_id: prov.agent_id });
                try { await rpc("mark_pending_provisioned", { p_secret: PEND_SECRET, p_email: email, p_agent_id: prov.agent_id }); } catch { /* */ }
                try { await rpc("ingest_client_event", { p_secret: ING, p_email: email, p_type: "provision", p_channel: "system", p_summary: `🚀 Gui ativada automaticamente no pagamento${provNumber ? " · " + provNumber : " (número pendente)"}${plan ? " · " + plan : ""}`, p_amount: 0, p_payload: { agent_id: prov.agent_id, number: provNumber } }); } catch { /* */ }
                // ONBOARDING MACHINE hook: paid → invoice+access reached. Advance the funnel (idempotent;
                // wrapped so it can NEVER touch the money path). onboard_advance stamps only once per step.
                try { await rpc("onboard_advance", { p_secret: ING, p_email: email, p_step: "invoice" }); } catch { /* */ }
                try { await rpc("onboard_advance", { p_secret: ING, p_email: email, p_step: "access" }); } catch { /* */ }
              } else {
                // surface the failure to the owner so it can be finished by hand — never silently drop it
                try { await rpc("ingest_client_event", { p_secret: ING, p_email: email, p_type: "provision_failed", p_channel: "system", p_summary: `⚠️ Gui NÃO criada no pagamento (${email}) — finalizar no /admin · ${prov.step}`, p_amount: 0, p_payload: { step: prov.step } }); } catch { /* */ }
              }
            }
          } catch { /* auto-provision is best-effort; credits + welcome already handled */ }
        }

        // SELF-SERVE ACTIVATION — on the FIRST payment, email the connection code so the
        // client can link their portal to real data themselves (no manual onboarding).
        if (env.RESEND_API_KEY) {
          try {
            const kr = await rpc("client_key_for", { p_secret: ING, p_email: email });
            const code = kr.ok ? ((await kr.json()) || "").toString() : "";
            if (code) {
              const lang = provLang;
              const business = (pend?.business || bizName || (lang === "en" ? "your business" : "seu negócio")).toString();
              const tpl = welcomeSelfServeEmail({ name: (obj.customer_details?.name || "").toString().split(" ")[0] || (lang === "en" ? "there" : "tudo bem"), business, lang, plan, code, credits, number: provNumber, forwarding: fwd });
              await fetch("https://api.resend.com/emails", {
                method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [email], subject: tpl.subject, html: tpl.html }),
              });
            } else {
              // paid + Gui born, but no activation code to send → the client can't self-connect.
              // Surface loudly so the owner sends it manually (never a silent dead-end).
              await emitFailure(env, "connection_code_missing", email, "paid + agent born but activation code missing — send manually", { session: obj.id || "" });
            }
          } catch { /* welcome email is best-effort; credits already granted */ }
        }
        })());

        // REFERRAL CONVERSION + SELLER ATTRIBUTION — did this NEW client arrive via a ref?
        // The ref rides Stripe's client_reference_id (Planos.jsx appends it from ?ref=<slug>);
        // we fall back to lead_ref_lookup (db/lifecycle.sql) for buyers who converted off-site.
        //   • Client referral (slug base64url-decodes to an email that IS a tenant): atomically
        //     convert the referral (db/referrals.sql) and grant BOTH sides bonus credits (= the
        //     purchased plan's credits, capped at 2000), plus a '🎁 Indicação convertida' event
        //     in each feed. referral_convert is a one-time claim, so a redelivered/racing event
        //     can never double-reward. add_client_credits failing → emitFailure, never silent.
        //   • Seller / unknown slug (non-decodable): log an 'attribution' event on the NEW tenant
        //     carrying { seller_ref } for the commission engine to read later. No credits.
        // Runs inside the mark_webhook_seen-gated first-delivery path (isCheckout only — invoices
        // carry no client_reference_id), so one checkout fires this at most once.
        if (isCheckout) {
          try {
            let refCode = (obj.client_reference_id || "").toString().trim();
            // A "demo_<token>_<product>" ref belongs to the Demo funnel (handled by the DEMO
            // ATTRIBUTION block above) — it is NOT a seller/referral slug. Skip it here so a
            // demo sale never pollutes the seller-commission feed or triggers a bogus lookup.
            if (refCode.startsWith("demo_")) refCode = "";
            if (!refCode) {
              // off-site conversion fallback: the ref captured on this buyer's lead rows (90d).
              const rr = await rpc("lead_ref_lookup", { p_secret: ING, p_contact: email });
              refCode = rr.ok ? ((await rr.json()) || "").toString().trim() : "";
            }
            if (refCode) {
              let refEmail = "";
              try {
                const b64 = refCode.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (refCode.length % 4)) % 4);
                refEmail = decodeURIComponent(escape(atob(b64))).toLowerCase().trim(); // reverse of Grow.jsx b64url()
              } catch { /* not base64url → a seller-name ref */ }
              const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refEmail) && refEmail !== email;
              // referrer must be an EXISTING tenant to earn the reward (anyone can craft a ?ref=).
              const isClient = isEmail && (await (async () => {
                const cv = await rpc("lead_converted", { p_secret: ING, p_email: refEmail });
                return cv.ok ? (await cv.json()) === true : false;
              })());
              if (isClient) {
                const reward = Math.min(credits, 2000); // "1 month free" = the plan they bought, capped
                // ensure a 'started' row exists, then atomically claim the conversion (once).
                await rpc("referral_record", { p_secret: ING, p_ref_code: refCode, p_referred_email: email });
                const cvr = await rpc("referral_convert", { p_secret: ING, p_referred_email: email, p_reward_credits: reward });
                const conv = cvr.ok ? (await cvr.json()) : { converted: false };
                if (conv && conv.converted === true && reward > 0) {
                  // grant the bonus to BOTH sides — the referred buyer already got their plan credits above.
                  for (const who of [refEmail, email]) {
                    const gr = await rpc("add_client_credits", { p_secret: ING, p_email: who, p_credits: reward, p_plan: "referral" });
                    if (!gr.ok) await emitFailure(env, "referral_reward_failed", who, `referral converted but +${reward} bonus credits NOT stored`, { session: obj.id || "", other: who === email ? refEmail : email });
                    await rpc("ingest_client_event", {
                      p_secret: ING, p_email: who, p_type: "referral", p_channel: "system",
                      p_summary: `🎁 Indicação convertida — +${reward} créditos (1 mês grátis)`,
                      p_amount: 0, p_payload: { referred: email, referrer: refEmail, reward, session: obj.id || "", plan },
                    });
                  }
                }
              } else {
                // seller-name / unknown slug → attribution only; the commission engine reads this later.
                await rpc("ingest_client_event", {
                  p_secret: ING, p_email: email, p_type: "attribution", p_channel: "system",
                  p_summary: `👤 Atribuição de vendedor · ${refCode.slice(0, 60)}`,
                  p_amount: 0, p_payload: { seller_ref: refCode.slice(0, 200), session: obj.id || "", plan },
                });
                // golden moment: tell the SELLER their wallet just earned — best-effort, awaited
                // (Cloudflare cancels fire-and-forget), never blocks the sale on a mail hiccup.
                try {
                  if (env.RESEND_API_KEY) {
                    const sr = await rpc("seller_by_ref", { p_secret: ING, p_ref: refCode.slice(0, 200) });
                    const seller = sr.ok ? await sr.json().catch(() => null) : null;
                    if (seller && seller.email) {
                      const { subject, html } = sellerCommissionEmail({
                        sellerName: seller.name || "", business: email.split("@")[0],
                        amount: `$${(cents / 100).toFixed(2)}`, plan, lang: "pt",
                      });
                      await fetch("https://api.resend.com/emails", {
                        method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [seller.email], subject, html }),
                      });
                    }
                  }
                } catch { /* seller notify is additive — attribution above already landed */ }
              }
            }
          } catch { /* referral/attribution is best-effort; the sale itself is already handled */ }
        }
      } else if (cents > 0) {
        // PAID-BUT-NOTHING GUARD — money moved but we couldn't credit anyone (Payment Links CAN
        // complete without a customer email, or the amount rounded to 0 credits, e.g. a 100%-off
        // promo code still needs provisioning). Never drop it silently: ledger the anomaly so
        // /admin sees it within seconds and the customer is made whole by hand.
        await emitFailure(env, "paid_but_uncredited", email, `$${(cents / 100).toFixed(2)} paid (${type}) but ${email ? "0 credits computed" : "the session has NO customer email"} — resolve in Stripe dashboard`, { session: obj.id || "", type });
      } else if (isCheckout && email) {
        // $0 checkout (100%-off promo) — nothing to credit, but the buyer still expects a live
        // Gui + welcome email; those only run inside the credited path. Alert so it's done by hand.
        await emitFailure(env, "zero_amount_checkout", email, "checkout completed at $0.00 (promo?) — NOT auto-provisioned; onboard in /admin", { session: obj.id || "" });
      }
    }

    return json({ received: true });
  } catch (e) {
    return json({ error: String(e).slice(0, 120) }, 400);
  }
}
