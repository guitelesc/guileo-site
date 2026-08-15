// Cloudflare Pages Function — POST /api/agent-action
// The single "Tool" the Gui voice agent calls to DO things on a call (works for every sector):
//   action = book | lead | review | sale | quote | reschedule | cancel | callback
// It forwards the action to the owner's LEAD_WEBHOOK (so they SEE every booking/lead/sale live in
// their Google Sheet / CRM) and returns a short, natural confirmation the agent reads back.
// Add it in ElevenLabs → Tools → Add tool → Webhook (POST) → URL = https://<your-domain>/api/agent-action
import { safeEq } from "../lib/guard.js";
import { valorParaCobranca } from "../lib/dinheiro.js";
import { actionConfirmEmail, ownerAlertEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";
import { tenantMp, mintPix } from "../lib/pix.js";
import { sendText, sendOrFlag } from "../lib/twilio.js";
import { isEmergency, callOwnerEmergency } from "../lib/emergencyCall.js";
import { guardCharge } from "../lib/spendGuard.js";
import { sbKey, svcRpc } from "../lib/sb.js";
const isEmailAddr = (s) => /.+@.+\..+/.test((s || "").toString());
const SB_URL_DEFAULT = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON_DEFAULT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // SECURITY: this webhook records bookings/sales/leads — require a shared secret so nobody can
    // forge actions. Secure-by-default: if AGENT_ACTION_SECRET isn't configured, reject everything.
    // When connecting ElevenLabs Tools → Webhook, set AGENT_ACTION_SECRET and pass it as the
    // `x-guileo-secret` header (or ?secret= query) in the tool config.
    const provided = request.headers.get("x-guileo-secret") || new URL(request.url).searchParams.get("secret") || "";
    if (!env.AGENT_ACTION_SECRET || !safeEq(provided, env.AGENT_ACTION_SECRET)) return json({ error: "unauthorized" }, 401);
    const b = await request.json().catch(() => null);
    if (!b) return json({ error: "bad request" }, 400);
    const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));
    // MULTI-TENANT: the business is pinned by the agent's STATIC header (x-guileo-client), set at provision
    // time — NEVER trust a caller-supplied client_email from the body (that was a cross-tenant leak). Falls
    // back to the owner only for the owner's own demo agent (which sends no header).
    const tenant = ((request.headers.get("x-guileo-client") || "").toString()).trim().toLowerCase() || (env.OWNER_EMAIL || "smart@guileoai.com").toString().toLowerCase();
    const testMode = (request.headers.get("x-guileo-test") || "") === "1"; // dry-run: validate paths, send NO real email
    let action = s(b.action || "lead", 40);
    // accept friendly aliases the agent might use for billing
    if (["charge", "cobranca", "cobrança", "bill", "payment", "pay"].includes(action)) action = "invoice";
    // pay-by-CARD-on-the-call (Twilio Pay): the agent stashes the amount, then transfers the call to the
    // secure pay line (/api/twilio-pay), which reads the amount back by the caller's number. Aliases below.
    if (["voice_pay", "voicepay", "card", "card_pay", "cartao", "cartão", "pagar_cartao"].includes(action)) action = "voice_pay";
    // recurring plan/subscription → an invoice with a billing interval
    let interval = ["month", "week", "year"].includes((b.interval || "").toString().toLowerCase()) ? b.interval.toString().toLowerCase() : null;
    if (["subscribe", "subscription", "plan", "plano", "assinatura", "mensalidade", "recurring"].includes(action)) { action = "invoice"; interval = interval || "month"; }
    const rec = {
      action,
      name: s(b.name, 120),
      contact: s(b.contact || b.phone || b.email, 160),
      when: s(b.when || b.datetime, 120),
      details: s(b.details || b.need || b.message, 500),
      business: s(b.business, 160),
      industry: s(b.industry, 80),
      amount: s(b.amount, 40),
      source: "gui-call",
      at: new Date().toISOString(),
    };

    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || SB_URL_DEFAULT;
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || SB_ANON_DEFAULT;
    const lang = (b.lang || "").toString();

    // ── GRACE-PAUSE GATE — a tenant paused for non-payment (dunning stage 3, DUNNING_ENFORCE) cannot
    // have Gui take money/booking actions on their behalf. Escalation to a human is ALWAYS allowed
    // (never trap a real customer). Reversible: any successful payment un-pauses (see stripe/mp webhooks).
    const escalateAliases = ["escalate", "human", "transfer", "handoff", "agent", "operador", "atendente"];
    const tenantIsOwner = tenant === (env.OWNER_EMAIL || "smart@guileoai.com").toString().toLowerCase() || tenant === "demo@guileoai.com";
    if (env.INGEST_SECRET && !tenantIsOwner && !escalateAliases.includes(action)) {
      try {
        const pr = await fetch(`${SB_URL}/rest/v1/rpc/is_client_paused`, {
          method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: tenant }),
        });
        if (pr.ok && (await pr.json()) === true) {
          const pt = lang.toLowerCase().startsWith("pt"), es = lang.toLowerCase().startsWith("es");
          const msg = pt ? "Consigo anotar seu pedido, mas nosso sistema de agendamento/cobrança está em manutenção agora — vou pedir pra alguém da equipe te retornar já já."
            : es ? "Puedo tomar su solicitud, pero nuestro sistema de reservas/cobros está en mantenimiento ahora — pediré que alguien del equipo le contacte enseguida."
            : "I can take your request, but our booking/billing system is briefly on hold — I'll have someone from the team follow up with you shortly.";
          return json({ ok: true, paused: true, action: "escalate", message: msg, escalate: true });
        }
      } catch { /* pause check down → fail OPEN (never block a paying client over a hiccup) */ }
    }

    // ── MONEY DECISION ────────────────────────────────────────────────────────────────────────────
    // Is this a real charge we could collect? invoice/deposit with an amount + Stripe configured.
    const isCharge = ["invoice", "deposit"].includes(action);
    // BR: cobrar não depende mais só do Stripe. Um cliente brasileiro cobra por PIX (Mercado
    // Pago conectado), e antes disso caía sempre em "connect Stripe to collect" — beco sem
    // saída que matava a venda. INGEST_SECRET é o que permite consultar a conta PIX do tenant.
    const chargeable = isCharge && !!rec.amount && (!!env.STRIPE_SECRET_KEY || !!env.INGEST_SECRET);
    const isOwner = tenant === (env.OWNER_EMAIL || "smart@guileoai.com").toString().toLowerCase() || tenant === "demo@guileoai.com";
    // STRIPE CONNECT: charge on the CLIENT'S connected account so the money lands with THEM (not Guileo).
    // A single fast Supabase RPC tells us whether they can actually collect. We do this synchronously
    // (it's cheap and it decides HONESTY: promise a link only if one can truly go out).
    let connAcct = "";
    let pixReady = false;
    if (chargeable && !isOwner && env.INGEST_SECRET) {
      if (env.STRIPE_SECRET_KEY) {
        try {
          const lr = await fetch(`${SB_URL}/rest/v1/rpc/client_stripe_lookup`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: tenant }) });
          if (lr.ok) { const t = await lr.json(); if (t && t.charges_enabled && t.account_id) connAcct = t.account_id; }
        } catch { /* RPC not installed → treat as not connected */ }
      }
      // PIX é a via BRASILEIRA e só é consultada quando o Stripe não resolve — assim um
      // cliente que tem os dois continua no caminho de sempre (zero regressão).
      if (!connAcct) {
        try { const mp = await tenantMp(env, tenant); pixReady = !!mp.ready; } catch { /* não conectado */ }
      }
    }
    const canCollect = chargeable && (connAcct || pixReady || isOwner);

    // ── SPEND GUARD ───────────────────────────────────────────────────────────────────────────────
    // Defense-in-depth on money: before ANY link is minted, the amount must pass the tenant's spend
    // policy (max single, needs-human threshold). guardCharge fails CLOSED (denies + flags human on a
    // ≥$50 floor if the policy RPC is unreachable). Only guards real charges; escalation/booking pass.
    const spend = chargeable ? await guardCharge(env, { email: tenant, amountDollars: rec.amount }) : { allow: true, needsHuman: false, reason: "not_a_charge" };

    // ── DRY-RUN (eval harness) ────────────────────────────────────────────────────────────────────
    // The action-eval runner sends dry_run:true to capture the DECISION Gui WOULD make — WITHOUT any
    // side effect (no pay link, no ledger, no SMS, no emitFailure). It exercises the SAME guard code the
    // live path runs, so a money mistake is caught by the golden set before it can cost a real client.
    if (b.dry_run === true || b.dryRun === true) {
      return json({ ok: true, dry_run: true, decision: {
        action, amount: rec.amount ?? null, is_charge: isCharge, chargeable,
        can_collect: canCollect, stripe_connected: !!connAcct, is_owner: isOwner,
        needs_human: !!spend.needsHuman, blocked: chargeable ? spend.allow === false : false,
        would_send_pay_link: canCollect && spend.allow === true && !spend.needsHuman,
        reason_code: !chargeable ? "no_charge" : spend.needsHuman ? "needs_human" : spend.allow === false ? "over_limit" : canCollect ? "collect_ok" : "charge_no_connect",
      } });
    }

    if (chargeable) {
      const g = spend;
      if (g.needsHuman) {
        try { await emitFailure(env, "spend_needs_human", tenant, `Gui was asked to charge $${rec.amount} — over the human-review threshold (${g.reason}); a person must approve before collecting`, {}); } catch { /* */ }
        return json({ ok: true, held: true, needsHuman: true, message: (lang === "pt" ? "Vou confirmar esse valor com a equipe e já te retorno pra fechar." : lang === "es" ? "Voy a confirmar ese monto con el equipo y te regreso para cerrar." : "Let me confirm that amount with the team and I'll get right back to you to close.") });
      }
      if (!g.allow) {
        try { await emitFailure(env, "spend_blocked", tenant, `Gui tried to charge $${rec.amount} but it exceeds the spend policy (${g.reason}) — blocked`, {}); } catch { /* */ }
        return json({ ok: true, blocked: true, message: (lang === "pt" ? "Esse valor está acima do meu limite — deixa eu passar pra equipe confirmar." : lang === "es" ? "Ese monto supera mi límite — déjame pasarlo al equipo para confirmar." : "That amount is above my limit — let me pass it to the team to confirm.") });
      }
    }

    // ── F6 · NO ROBOT SILENCE ─────────────────────────────────────────────────────────────────────
    // When we CAN collect, the close otherwise stalls on 2 sequential Stripe calls (mint the link) +
    // a Twilio send — 1-2s of dead air right at the most delicate moment. Speak a BRIDGE line NOW and
    // do the slow work (mint link → text it → record everything) in the background via waitUntil, so
    // the caller never hears silence and the SMS lands moments later while they're still on the line.
    if (canCollect) {
      context.waitUntil((async () => {
        try {
          let payLink = "";
          if (connAcct || isOwner) {
            payLink = await stripePaymentLink(env, rec.amount, rec.business || "Guileo", interval, connAcct, tenant);
            if (payLink) rec.details = appendPayLink(rec.details, action, interval, payLink);
            else await emitFailure(env, "paylink_mint_failed", tenant, `Gui promised a pay link for $${rec.amount} but Stripe didn't create it — team must send it manually`, {});
          } else if (pixReady) {
            // BRASIL — PIX na conta do próprio cliente. `ref` é a chave de idempotência ponta a
            // ponta (Mercado Pago + banco): o MESMO pedido nunca vira dois QR nem duas receitas.
            // Preferimos o request_id do agente; sem ele, derivamos do contato + valor, que é
            // estável dentro de um atendimento (mesma lógica do reserveRef da agenda).
            const ref = (b.request_id || `${rec.contact || rec.name || "anon"}:${rec.amount}`).toString().slice(0, 120);
            const px = await mintPix(env, tenant, {
              // FONTE ÚNICA: Number("45,00") é NaN e Number("$45.00") também. O valor certo já
              // passou pela guarda; reaproveitar a mesma leitura evita duas verdades sobre o
              // mesmo dinheiro dentro da mesma requisição.
              amountCents: valorParaCobranca(rec.amount).cents,
              description: rec.details || rec.business || "Pagamento",
              payerEmail: rec.contact && rec.contact.includes("@") ? rec.contact : "",
              payerName: rec.name || "", ref,
            });
            if (px.ok) {
              // ticket_url é uma página real do MP com o QR — funciona como "link" em SMS/WhatsApp.
              payLink = px.ticketUrl || "";
              rec.details = `${rec.details ? rec.details + " · " : ""}PIX R$${(px.amountCents / 100).toFixed(2)} · copia-e-cola: ${px.copiaECola}`.slice(0, 500);
            } else {
              await emitFailure(env, "pix_mint_failed", tenant, `Gui prometeu PIX de R$${rec.amount} mas o Mercado Pago não gerou (${px.reason}${px.detail ? ": " + px.detail : ""}) — enviar manualmente`, { reason: px.reason });
            }
          }
          await sideEffects({ env, b, rec, action, interval, tenant, testMode, connAcct, payLink, SB_URL, SB_ANON });
        } catch { /* background pipeline is best-effort — the caller already got the bridge reply */ }
      })());
      return json({ ok: true, bridged: true, message: bridgePhrase(lang, rec.amount, interval) });
    }

    // ── F2 · HONEST CAPTURE (no Stripe Connect) ───────────────────────────────────────────────────
    // A charge was requested but this tenant can't actually collect (no connected account and not
    // owner/demo, OR Stripe isn't configured). We must NOT promise a link that will never arrive.
    // Flag the record, alert the owner to connect Stripe, and speak an honest "team will send it".
    if (isCharge && rec.amount && !canCollect) {
      rec.details = `${rec.details ? rec.details + " · " : ""}⚠️ payment requested ($${rec.amount}) — connect Stripe or PIX (Mercado Pago) to collect`.slice(0, 500);
      try { await emitFailure(env, "payments_not_connected", tenant, `Gui tried to charge $${rec.amount} but ${tenant} has NO payment account connected — connect Stripe (US) or Mercado Pago/PIX (BR) to collect`, {}); } catch { /* */ }
    }

    // Non-charge actions (and charge-without-collect) have NO slow Stripe calls, so they run inline:
    // never a real pay link here → payLink stays "".
    const { stored, delivered, confirmed, texted, emergencyCalled, urgentEmergency } =
      await sideEffects({ env, b, rec, action, interval, tenant, testMode, connAcct: "", payLink: "", SB_URL, SB_ANON });

    // Natural confirmation the agent speaks back to the caller — covers EVERYTHING Gui does on a call.
    const who = rec.name || "you";
    const amt = rec.amount ? `$${rec.amount}` : "";
    const msg = {
      book: `All set — booked for ${who}${rec.when ? ` on ${rec.when}` : ""}. You'll get a confirmation. Anything else?`,
      reschedule: `Done — moved ${who}'s booking${rec.when ? ` to ${rec.when}` : ""}.`,
      cancel: `Cancelled ${who}'s booking — no worries.`,
      order: `Order placed for ${who}${amt ? ` (${amt})` : ""} — I'll send a confirmation.`,
      sale: `Sale logged${amt ? ` for ${amt}` : ""} — thank you, ${who}!`,
      // invoice/deposit reach this map ONLY when we can't send a real link (see F2) → HONEST capture,
      // never "the link is on its way" (that promised an SMS that never went out).
      invoice: honestNoLink(lang, "invoice", amt, interval, who),
      deposit: honestNoLink(lang, "deposit", amt, interval, who),
      voice_pay: `Sure — I'll connect you to our secure payment line now to take your${amt ? ` ${amt}` : ""} card payment. Please have your card ready; one moment.`,
      quote: `I've captured your quote request, ${who} — you'll have it shortly.`,
      lead: `Got it, ${who}. I've saved your details and the team will follow up.`,
      qualify: `Thanks, ${who} — noted what you need; we'll match you to the right option.`,
      callback: `Perfect — I've scheduled a callback for ${who}${rec.when ? ` ${rec.when}` : ""}.`,
      escalate: `Of course — I'm flagging this for a team member to call ${who} back right away${rec.contact ? "" : ". What's the best number to reach you?"}.`,
      review: `Thanks! I've sent ${who} a review request.`,
      confirm: `Confirmation sent to ${who}.`,
      message: `Message noted — ${who} will hear from us shortly.`,
      winback: `Welcome back, ${who}! I've set up a special offer for you.`,
      noshow: `No problem — I've rebooked ${who}${rec.when ? ` for ${rec.when}` : ""} and freed your old slot.`,
      info: `Noted your question, ${who} — someone will get you the exact answer.`,
    }[action] || `Done — ${action} captured for ${who}.`;

    // 1.8 — don't promise a confirmation we can't send: if the action implies one but we have no email,
    // ask the caller for it instead of falsely saying "I'll send a confirmation".
    let finalMsg = msg;
    // Emergency escalate: tell the caller the truth about what just happened — the owner's phone
    // is RINGING (not "someone will call you back eventually").
    if (urgentEmergency) {
      finalMsg = emergencyCalled
        ? `I've got this flagged as an emergency — I'm ringing the owner's phone right now with your details${rec.contact ? ", so keep your line free" : ". What's the best number to reach you?"}. Help is on the way.`
        : `I've got this flagged as an emergency and alerted the owner immediately — you're first in line${rec.contact ? "" : ". What's the best number to reach you?"}.`;
    } else if (["order", "quote", "callback", "sale"].includes(action) && !confirmed && !texted && !isEmailAddr(rec.contact)) {
      // invoice/deposit are intentionally NOT here — their honest "team will send the link" reply
      // already sets the right expectation without asking for an email.
      const pt = lang.toLowerCase().startsWith("pt");
      const es = lang.toLowerCase().startsWith("es");
      finalMsg = pt ? `Anotado, ${rec.name || "tudo bem"}! Qual o melhor email pra eu te enviar a confirmação?`
        : es ? `¡Anotado, ${rec.name || ""}! ¿Cuál es tu correo para enviarte la confirmación?`
          : `Got it, ${rec.name || "there"}! What's the best email to send your confirmation to?`;
    }
    // Do NOT echo `rec` (caller name/phone/details) — ElevenLabs logs the response body, so
    // returning the record would leak client PII into a third party's call logs.
    return json({ ok: true, stored, delivered, confirmed, texted, message: finalMsg, needsEmail: !confirmed && !texted && ["order", "quote", "callback", "sale"].includes(action) && !isEmailAddr(rec.contact) });
  } catch {
    return json({ ok: false, message: "Sorry, I couldn't save that just now — could you repeat it?" }, 400);
  }
}

// ── SIDE EFFECTS PIPELINE ─────────────────────────────────────────────────────────────────────────
// Everything that records/forwards/notifies an action. Shared by both the synchronous path (non-charge
// + charge-without-collect) and the F6 background path (connected charge, run via waitUntil) so the two
// never drift. Every step is best-effort and NEVER throws → the spoken reply always happens.
async function sideEffects({ env, b, rec, action, interval, tenant, testMode, connAcct, payLink, SB_URL, SB_ANON }) {
  // 1) Persist to Supabase so it shows live on /live (public anon key + RLS).
  let stored = false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/gui_actions`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ action: rec.action, name: rec.name, contact: rec.contact, slot: rec.when, details: rec.details, business: rec.business, industry: rec.industry, amount: rec.amount, source: rec.source }),
    });
    stored = r.ok;
  } catch { /* never fail the call */ }

  // 1b) REVENUE LEDGER (the cash-flow spine). Every money action the Gui closes is recorded, gated by
  //     SCHED_SECRET. An OWNER-FALLBACK pay link (payLink minted, no connected account) is ledgered by
  //     the Stripe webhook when the customer PAYS → skip creation-time here to avoid double-counting.
  //     Connected-account links are direct charges whose events never reach our webhook → ledger here.
  const webhookWillLedger = !!payLink && !connAcct;
  if (["sale", "order", "invoice", "deposit"].includes(action) && rec.amount && env.SCHED_SECRET && !webhookWillLedger) {
    try {
      // ⚠️ ESTE ERA O DEFEITO DE 100×. A guarda de cobrança cobre só invoice/deposit, mas o razão
      // grava também `sale` e `order` — que chegavam aqui com a leitura ingênua:
      //     "45,00" → $4.500,00   ·   "9,50" → $950,00   ·   "R$ 1.234,56" → $1,23
      // Contaminava revenue_record, o CRM, client_events E o retorno de anúncio (o ROI lê receita
      // real). A Gui vende em pt/es: esse formato não é entrada malformada, é o normal.
      const cents = valorParaCobranca(rec.amount).cents ?? 0;
      if (isFinite(cents) && cents > 0) {
        const RSB = SB_URL_DEFAULT;
        const RANON = SB_ANON_DEFAULT;
        // IDEMPOTENCY (money): ElevenLabs RETRIES this tool webhook. The dedupe key is built from the
        // retried BODY (never rec.at, which changes per attempt) + an hour bucket, so a retry can't
        // double-count while two genuinely separate same-amount sales still record. revenue_record_once
        // 404s until pasted → fall back to the legacy plain write. (dedupe key UNCHANGED.)
        const body = { p_secret: env.SCHED_SECRET, p_email: tenant, p_category: action, p_amount_cents: cents, p_ref: payLink || rec.contact || null, p_source: "gui", p_meta: { name: rec.name, business: rec.business } };
        const dedupe = `gui:${action}:${tenant}:${rec.contact || rec.name || ""}:${cents}:${rec.when || ""}:${rec.at.slice(0, 13)}`;
        let rr = await fetch(`${RSB}/rest/v1/rpc/revenue_record_once`, {
          method: "POST", headers: { apikey: RANON, Authorization: `Bearer ${RANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, p_dedupe: dedupe }),
        });
        if (rr.status === 404) rr = await fetch(`${RSB}/rest/v1/rpc/revenue_record`, {
          method: "POST", headers: { apikey: RANON, Authorization: `Bearer ${RANON}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!rr.ok) await emitFailure(env, "revenue_record_failed", tenant, `$${(cents / 100).toFixed(2)} ${action} closed but NOT ledgered`);
      }
    } catch { /* ledger is additive — never block the call */ }
  }

  // 1b2) INBOX / REPORT VISIBILITY — mirror every closed money action into client_events so voice
  //      revenue surfaces in the weekly report + portal Inbox. Amount in DOLLARS. Best-effort.
  if (["sale", "order", "invoice", "deposit"].includes(action) && rec.amount && env.INGEST_SECRET) {
    try {
      // mesma leitura única (ver a nota do razão acima), em dólares para quem espera dólar
      const dollars = (valorParaCobranca(rec.amount).cents ?? 0) / 100;
      if (isFinite(dollars) && dollars > 0) {
        await svcRpc(env, "ingest_client_event", {
            p_secret: env.INGEST_SECRET,
            p_email: tenant,
            p_type: action,
            p_channel: "Phone",
            p_summary: `💵 ${action} ($${rec.amount})${rec.name ? ` — ${rec.name}` : ""}${rec.business ? ` · ${rec.business}` : ""}`.slice(0, 300),
            p_amount: dollars,
            p_payload: { from: rec.contact || "", business: rec.business || "", channel: "Phone" },
        });
      }
    } catch { /* additive — never break the call's 200 response */ }
  }

  // 1c) CRM SPINE (Company OS) — resolve-or-create the contact, log a 360° event, open/win the deal.
  if (env.SCHED_SECRET && rec.contact) {
    try {
      const isEmail = isEmailAddr(rec.contact);
      const cents = rec.amount ? (valorParaCobranca(rec.amount).cents ?? 0) : 0;
      const isMoney = ["sale", "order", "invoice", "deposit"].includes(action);
      const crmRpc = (fn, body) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.SCHED_SECRET, ...body }) });
      const ur = await crmRpc("crm_upsert_contact", { p_email: tenant, p_phone: isEmail ? "" : rec.contact, p_contact_email: isEmail ? rec.contact : "", p_name: rec.name || "", p_source: `gui:${action}`, p_amount_cents: isMoney ? cents : 0 });
      const contactId = ur.ok ? (await ur.json().catch(() => null)) : null; // scalar uuid
      if (contactId) {
        crmRpc("crm_log_event", { p_email: tenant, p_contact_id: contactId, p_type: action, p_channel: "Phone", p_summary: `${action}${rec.amount ? ` $${rec.amount}` : ""}: ${rec.details || rec.name || ""}`.slice(0, 400), p_amount_cents: isMoney ? cents : 0, p_dedupe: `gui:${action}:${rec.contact}:${rec.at}`, p_payload: {} }).catch(() => {});
        if (["quote", "sale", "order", "invoice", "deposit"].includes(action)) {
          const stage = ["sale", "invoice", "deposit"].includes(action) ? "won" : action === "order" ? "booked" : "quoted";
          crmRpc("crm_deal_upsert", { p_email: tenant, p_contact_id: contactId, p_title: `${action} · ${rec.business || rec.name || "Gui"}`.slice(0, 80), p_value_cents: cents, p_stage: stage, p_source: "gui" }).catch(() => {});
        }
      }
    } catch { /* CRM not live yet → never block the call */ }
  }

  // 2) Forward to the owner's webhook if they set one (Sheet/CRM/email).
  let delivered = false;
  if (env.LEAD_WEBHOOK) {
    try {
      const r = await fetch(env.LEAD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) });
      delivered = r.ok;
    } catch { /* keep going — never fail the call */ }
  }

  // 2b) CUSTOMER CONFIRMATION EMAIL — keep the spoken promise for email contacts (branded).
  let confirmed = false;
  if (testMode && ["order", "quote", "callback", "invoice", "sale"].includes(action) && isEmailAddr(rec.contact)) {
    confirmed = true; // dry-run: the email path is valid; we just don't spend on a real send
  } else if (["order", "quote", "callback", "invoice", "sale"].includes(action) && env.RESEND_API_KEY && isEmailAddr(rec.contact)) {
    try {
      const { subject, html } = actionConfirmEmail({ kind: action, name: rec.name, business: rec.business || "", details: rec.details, amount: rec.amount, when: rec.when, payLink, lang: (b.lang || "en").toString() });
      const er = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: rec.contact, subject, html }),
      });
      confirmed = er.ok;
    } catch { /* best-effort — the spoken reply still happens */ }
  }

  // 2c) OWNER ALERT — email the BUSINESS OWNER (our client = tenant) the INSTANT Gui closes something.
  if (!testMode && env.RESEND_API_KEY && isEmailAddr(tenant) && ["order", "lead", "quote", "sale", "invoice", "deposit", "callback", "escalate"].includes(action)) {
    try {
      const { subject, html } = ownerAlertEmail({ kind: action, customer: rec.name, business: rec.business || "", details: rec.details, amount: rec.amount, when: rec.when, lang: (b.lang || "en").toString() });
      await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: tenant, subject, html }),
      });
    } catch { /* best-effort — never block the call */ }
  }

  // 2d) OWNER TEXT — even faster than email if the owner set an alert phone. Prefers WhatsApp.
  if (!testMode && env.INGEST_SECRET && isEmailAddr(tenant) && ["order", "lead", "quote", "sale", "invoice", "deposit", "callback", "escalate"].includes(action)) {
    try {
      const pr = await fetch(`${SB_URL}/rest/v1/rpc/client_notify_phone_lookup`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: tenant }) });
      const ph = pr.ok ? ((await pr.json()) || "").toString() : "";
      if (ph) await sendOrFlag(env, { tenant, motivo: "aviso ao dono", opts: { channel: "whatsapp" }, to: ph, body: `🔔 Guileo${rec.business ? ` · ${rec.business}` : ""}: novo ${action}${rec.name ? ` — ${rec.name}` : ""}${rec.amount ? ` ($${rec.amount})` : ""}${rec.when ? ` · ${rec.when}` : ""}. guileoai.com/portal`.slice(0, 300) });
    } catch { /* text best-effort */ }
  }

  // 2e) 🚨 EMERGENCY DISPATCH — a genuine after-hours emergency rings the OWNER'S PHONE. Claim-first
  //     dedupes ElevenLabs retries so one emergency rings once. (Only ever action === "escalate".)
  let emergencyCalled = false;
  const urgentEmergency = action === "escalate" && isEmergency(b, rec.details);
  if (!testMode && urgentEmergency && env.INGEST_SECRET) {
    try {
      const ing = (fn, body) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.INGEST_SECRET, ...body }) });
      // dedupe key from the retried BODY + hour bucket (UNCHANGED).
      const dedupe = `esc:${tenant}:${rec.contact || rec.name || ""}:${(rec.details || "").slice(0, 80)}:${rec.at.slice(0, 13)}`;
      const cr = await ing("emergency_claim", { p_client_email: tenant, p_contact: rec.contact, p_name: rec.name, p_note: rec.details, p_dedupe: dedupe });
      const claimId = cr.ok ? await cr.json().catch(() => null) : null;
      if (claimId) {
        const pr = await ing("client_notify_phone_lookup", { p_email: tenant });
        const ownerPhone = pr.ok ? ((await pr.json()) || "").toString() : "";
        const dispatched = await callOwnerEmergency(env, { ownerPhone, name: rec.name, service: rec.details, phone: rec.contact, business: rec.business, lang: (b.lang || "").toString() });
        emergencyCalled = !!dispatched.called;
        if (emergencyCalled) ing("emergency_mark_called", { p_client_email: tenant, p_id: claimId }).catch(() => {});
        else await emitFailure(env, "emergency_call_failed", tenant, `🚨 EMERGENCY from ${rec.name || rec.contact || "a caller"} but the owner voice call didn't go out (${dispatched.reason || "unknown"}) — ${rec.details || ""}`.slice(0, 200));
      }
    } catch { /* dispatch is additive — the email/text alerts above already fired */ }
  }

  // 0b) PAY-LINK BY SMS — text the secure link so the caller taps-and-pays while still on the line.
  const isPhone = !isEmailAddr(rec.contact) && /\+?\d[\d\s()-]{6,}/.test(rec.contact);
  let texted = false;
  if (payLink && isPhone) {
    const amt = rec.amount ? `$${rec.amount}` : "";
    const pt = (b.lang || "").toString().toLowerCase().startsWith("pt");
    const es = (b.lang || "").toString().toLowerCase().startsWith("es");
    const smsMsg = pt ? `🌱 ${rec.business || "Guileo"}: seu link seguro pra pagar${amt ? ` ${amt}` : ""}: ${payLink}`
      : es ? `🌱 ${rec.business || "Guileo"}: tu enlace seguro para pagar${amt ? ` ${amt}` : ""}: ${payLink}`
        : `🌱 ${rec.business || "Guileo"}: your secure link to pay${amt ? ` ${amt}` : ""}: ${payLink}`;
    if (testMode) { texted = true; }
    else {
      // MESMA REGRA DO AGENDAMENTO: sucesso sem comprovante não é sucesso.
      // Antes: `await sendText(...); texted = true;` — marcava enviado SEM olhar o retorno.
      // `sendText` devolve {sent:false} quando a Twilio recusa, e ela recusa HOJE (campanha A2P
      // reprovada). Ou seja: a agente dizia "já te mandei o link" e nada saía. O cliente desliga
      // esperando um SMS que nunca chega — e a venda morre em silêncio, que é o pior jeito.
      let r = null;
      try { r = await sendText(env, rec.contact, smsMsg); } catch (e) { r = { sent: false, reason: String(e).slice(0, 80) }; }
      texted = !!(r && r.sent);
      if (!texted) {
        // SEGUNDA VIA: se a mensagem não sai, o link não pode evaporar. Vai por e-mail quando
        // conhecemos um do cliente — o dinheiro não pode depender de um único canal.
        let alt = "";
        try {
          const er = await fetch(`${SB_URL}/rest/v1/rpc/crm_contact_email`, {
            method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
            body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", p_email: tenant, p_phone: rec.contact }),
          });
          if (er.ok) { const v = await er.json().catch(() => ""); if (/.+@.+\..+/.test(String(v || ""))) alt = String(v); }
        } catch { /* sem e-mail alternativo */ }
        if (alt && env.RESEND_API_KEY) {
          const mr = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [alt],
              subject: `${rec.business || "Guileo"} — seu link de pagamento`, html: `<p>${smsMsg}</p>` }),
          }).catch(() => null);
          texted = !!(mr && mr.ok);
        }
        // Falhou nos dois → o DONO precisa saber AGORA: tem uma venda pendurada.
        if (!texted) {
          try { await emitFailure(env, "paylink_nao_entregue", tenant,
            `Link de pagamento NÃO chegou ao cliente${rec.amount ? ` ($${rec.amount})` : ""} — ${rec.name || "cliente"} · ${rec.contact} · motivo: ${(r && r.reason) || `status ${(r && r.status) || "?"}`}`,
            { amount: rec.amount || "", contact: rec.contact }); } catch { /* */ }
        }
      }
    }
  }

  // VOICE-PAY HANDOFF: stash {amount, tenant} keyed by the caller's number so the secure pay line
  // (/api/twilio-pay) can pick it up when the agent transfers the call there. 5-min TTL.
  if (action === "voice_pay" && isPhone && env.RATE_LIMIT && rec.amount) {
    try {
      // SPEND GUARD parity — the card-on-call path must obey the SAME per-tenant policy as pay-links.
      // If the amount is over-limit or needs a human, DON'T stash it (the secure line then has nothing
      // to collect, so an unguarded charge can't slip through the voice channel). emitFailure, not silent.
      const g = await guardCharge(env, { email: tenant, amountDollars: rec.amount });
      if (!g.allow || g.needsHuman) {
        await emitFailure(env, g.needsHuman ? "spend_needs_human" : "spend_blocked", tenant,
          `Voice-pay $${rec.amount} ${g.needsHuman ? "needs human approval" : "exceeds spend policy"} (${g.reason}) — NOT stashed; card line won't collect it`, {});
      } else {
        const e164 = rec.contact.replace(/[^0-9+]/g, "");
        await env.RATE_LIMIT.put(`vpay:${e164}`, JSON.stringify({ amount: rec.amount, tenant, desc: (rec.details || rec.business || "Payment").slice(0, 60) }), { expirationTtl: 300 });
      }
    } catch { /* fall back to link */ }
  }

  // 3) ESCALATE / transfer-to-human: capture + alert LOUDLY, plus mirror inbound customer messages
  //    into the portal Inbox. Never drops on the floor.
  if (action === "escalate") {
    await emitFailure(env, "escalation_needed", tenant, `${urgentEmergency ? "🚨 EMERGENCY — " : ""}${rec.name || "A caller"} asked for a human · ${rec.contact || "no contact"} · ${rec.details || ""}`.slice(0, 200));
  }
  if (["message", "callback", "lead", "escalate"].includes(action) && (rec.details || rec.message || action === "escalate")) {
    try {
      const email = tenant; // attribute to the pinned tenant (never caller body)
      const whom = rec.name || rec.contact || "Caller";
      await svcRpc(env, "ingest_client_event", {
          p_secret: env.INGEST_SECRET || "",
          p_email: email,
          p_type: "message",
          p_channel: "Phone",
          p_summary: `${whom}: ${rec.details || rec.message}`.slice(0, 300),
          p_amount: 0,
          p_payload: { from: rec.contact || "", channel: "Phone" },
      });
    } catch { /* additive — never break the call's 200 response */ }
  }

  return { stored, delivered, confirmed, texted, emergencyCalled, urgentEmergency };
}

// Append the pay link to the record details (matches the cockpit's expected format).
function appendPayLink(details, action, interval, payLink) {
  return `${details ? details + " · " : ""}${action === "deposit" ? "deposit" : interval ? `subscribe (${interval})` : "pay"}: ${payLink}`.slice(0, 500);
}

// F6 bridge line — spoken IMMEDIATELY so there's no dead air while the link is minted + texted.
function bridgePhrase(lang, amount, interval) {
  const amt = amount ? `$${amount}` : "";
  const pt = (lang || "").toLowerCase().startsWith("pt");
  const es = (lang || "").toLowerCase().startsWith("es");
  if (pt) return `Perfeito! Só um segundinho que já te mando o link seguro${amt ? ` de ${amt}` : ""}${interval ? ` por ${interval}` : ""} pra você pagar aqui pelo celular.`;
  if (es) return `¡Perfecto! Un segundito, ya te envío el enlace seguro${amt ? ` de ${amt}` : ""} para pagar desde tu teléfono.`;
  return `Perfect — give me one second, I'm sending you a secure link${amt ? ` for ${amt}` : ""}${interval ? ` (${interval}ly)` : ""} to pay right from your phone.`;
}

// F2 honest capture — spoken when we CANNOT actually send a link (no connected Stripe). Never promises
// an SMS that won't go out; the owner is alerted separately (emitFailure) to connect Stripe.
function honestNoLink(lang, action, amt, interval, who) {
  const pt = (lang || "").toLowerCase().startsWith("pt");
  const es = (lang || "").toLowerCase().startsWith("es");
  if (action === "deposit") {
    if (pt) return `Perfeito, anotei${amt ? ` o depósito de ${amt}` : " o depósito"} — nosso time te envia o link de pagamento pra segurar o horário já já.`;
    if (es) return `Perfecto, anoté${amt ? ` el depósito de ${amt}` : " el depósito"} — nuestro equipo te envía el enlace de pago enseguida para guardar tu lugar.`;
    return `Perfect — I've noted the${amt ? ` ${amt}` : ""} deposit for ${who}; our team will send you the payment link to hold the spot shortly.`;
  }
  if (pt) return `Perfeito, anotei${amt ? ` ${amt}` : ""}${interval ? " (assinatura)" : ""} — nosso time te envia o link de pagamento já já.`;
  if (es) return `Perfecto, lo anoté${amt ? ` ${amt}` : ""}${interval ? " (suscripción)" : ""} — nuestro equipo te envía el enlace de pago enseguida.`;
  return `Perfect — I've got that${amt ? ` ${amt}${interval ? "/" + interval : ""}` : ""} down for ${who}; our team will send you the payment link shortly.`;
}

// COBRANÇA: create a real one-off Stripe Payment Link for an arbitrary amount (dollars string).
// Inline product_data → no product bookkeeping; returns the hosted URL the customer pays at.
// Card data never touches us. Returns "" on any failure so the call never breaks.
async function stripePaymentLink(env, amountStr, business, interval, connectedAccount = "", tenant = "") {
  try {
    // ÚLTIMA leitura ingênua da casa, fechada em 2026-08-11. Este é o link de pagamento REAL que
    // vai para o celular do cliente do cliente: "45,00" virava $4.500 e "R$ 1.234,56" virava $1,23.
    // `valorParaCobranca` devolve `ambiguo` para o único caso que o texto não decide ("1.500" —
    // pode ser mil e quinhentos ou um e meio). Aí não se escolhe no chute: não gera link.
    const leitura = valorParaCobranca(amountStr);
    if (leitura.ambiguo) return "";
    const cents = leitura.cents;
    if (cents == null || cents <= 0) return "";
    // AMOUNT INTEGRITY: the amount comes from the agent (caller-side) — bound it server-side so a
    // misheard "$5,000,000" never becomes a real charge link. Default cap is a SENSIBLE $5,000 (F10):
    // a mis-heard price should be rejected, not charged. Raise per-tenant with MAX_CHARGE_USD env.
    const MAX_CENTS = (Number(env.MAX_CHARGE_USD) || 5000) * 100;
    if (cents < 50 || cents > MAX_CENTS) return "";
    const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" };
    // DIRECT CHARGE on the client's connected account → the money lands in THEIR Stripe, not Guileo's.
    if (connectedAccount) headers["Stripe-Account"] = connectedAccount;
    const sapi = async (path, body) => {
      const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: "POST", headers, body: new URLSearchParams(body).toString() });
      if (!r.ok) throw new Error("stripe " + r.status);
      return r.json();
    };
    const priceBody = {
      unit_amount: String(cents), currency: "usd",
      "product_data[name]": `${interval ? "Subscription" : "Payment"} · ${business}`.slice(0, 240),
    };
    if (interval) priceBody["recurring[interval]"] = interval; // month | week | year → real subscription
    const price = await sapi("prices", priceBody);
    const plBody = { "line_items[0][price]": price.id, "line_items[0][quantity]": "1" };
    // TAG the link so the Stripe webhook can tell "a client's customer paid a Gui invoice" apart from
    // "someone bought a Guileo plan". Without this, an owner-account fallback charge would grant the
    // PAYER Gui credits + auto-provision them a voice agent — a wrong-credit money bug.
    plBody["metadata[guileo]"] = "client_charge";
    if (tenant) plBody["metadata[tenant]"] = tenant.slice(0, 160);
    // Guileo's automatic cut — only on a CONNECTED client's charge (never on owner/demo fallback).
    const feePct = parseFloat(env.GUILEO_FEE_PCT || "0");
    if (connectedAccount && feePct > 0) {
      const pct = Math.min(Math.max(feePct, 0), 90);
      if (interval) plBody["application_fee_percent"] = String(pct);
      else plBody["application_fee_amount"] = String(Math.round(cents * pct / 100));
    }
    const link = await sapi("payment_links", plBody);
    return link.url || "";
  } catch { return ""; }
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
