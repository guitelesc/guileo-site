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
import { registrar } from "../lib/registro.js";
import { avaliarContato, numeroFalado, contatoDaLigacao } from "../lib/contato.js";
import { svcJson } from "../lib/sb.js";
import { acharProduto, dinheiro } from "../lib/produtos.js";
import { contaDePagamento, camposDoDestino } from "../lib/contaDoCliente.js";
import { giftCardLinkEmail } from "../lib/emailTemplates.js";
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
    // BINA (2026-09-28): contato vazio / placeholder / falado por extenso → o número de quem liga.
    // 2026-09-28: telefone ditado VÁLIDO mas errado (535→525) também perde pro BINA.
    { const cl = contatoDaLigacao(rec.contact, request.headers.get("x-guileo-caller"));
      rec.contact = cl.contato;
      if (cl.ditado) rec.details = `${rec.details || ""}${rec.details ? " · " : ""}caller also gave another number: ${cl.ditado}`; }

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

    // ── PRODUTO DE PRATELEIRA: RESERVA PARA BUSCAR (2026-09-30) ─────────────────────────────────
    // A agente não cobra produto por telefone: ela SEPARA o item e a cliente paga no balcão. O que
    // ela fala vem do que o banco respondeu — reservado, em falta, ou "qual deles?".
    if (["product", "produto", "producto", "retail", "reserve_product"].includes(action)) {
      const r = await reservarProduto(env, { b, rec, tenant, lang, testMode, conv: request.headers.get("x-guileo-conv") || "" });
      if (r.reservado && !testMode) {
        // Aviso ao dono + registro pelo mesmo caminho de um pedido — SEM valor: reserva não é
        // receita recebida, e o razão só conhece dinheiro que entrou.
        const aviso = { ...rec, action: "order", amount: "", details: r.resumo };
        context.waitUntil(sideEffects({ env, b, rec: aviso, action: "order", interval: null, tenant, testMode, connAcct: "", payLink: "", SB_URL, SB_ANON, bg: (p) => context.waitUntil(p) }).catch(() => {}));
      }
      return json({ ok: r.ok, reserved: !!r.reservado, message: r.message });
    }

    // ── GIFT CARD (2026-09-30) ──────────────────────────────────────────────────────────────────
    // Com o Stripe DO NEGÓCIO conectado: link de pagamento por e-mail, e o cartão nasce quando o
    // pagamento cai (stripe-webhook). Sem ele: pedido anotado e dono avisado — e a agente diz isso.
    if (["giftcard", "gift_card", "gift", "vale_presente", "vale-presente", "tarjeta_regalo"].includes(action)) {
      const r = await pedirGiftCard(env, { b, rec, tenant, lang, testMode });
      if (!testMode && r.avisar) {
        const aviso = { ...rec, action: "lead", amount: "", details: r.resumo };
        context.waitUntil(sideEffects({ env, b, rec: aviso, action: "lead", interval: null, tenant, testMode, connAcct: "", payLink: "", SB_URL, SB_ANON, bg: (p) => context.waitUntil(p) }).catch(() => {}));
      }
      return json({ ok: r.ok, link_sent: !!r.linkEnviado, message: r.message });
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
          await sideEffects({ env, b, rec, action, interval, tenant, testMode, connAcct, payLink, SB_URL, SB_ANON, bg: (p) => context.waitUntil(p) });
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
      await sideEffects({ env, b, rec, action, interval, tenant, testMode, connAcct: "", payLink: "", SB_URL, SB_ANON, bg: (p) => context.waitUntil(p) });

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

// Frase certa no idioma da ligação. `lang` vem do corpo da ferramenta; sem ele, inglês.
const fala = (lang, en, pt, es) => { const l = String(lang || "").toLowerCase(); return l.startsWith("pt") ? pt : l.startsWith("es") ? es : en; };

// ── reservarProduto ──────────────────────────────────────────────────────────────────────────────
// Acha o produto pelo que a pessoa disse (acharProduto: empate = pergunta, nunca chute), reserva no
// banco (product_sale_record desconta o estoque na MESMA transação e é idempotente por `ref`) e
// devolve a frase. `ok:false` só quando o nosso lado falhou — aí a agente não finge que reservou.
async function reservarProduto(env, { b, rec, tenant, lang, testMode, conv }) {
  const texto = String(b.product || b.details || b.item || "").slice(0, 200);
  const mq = texto.match(/(?:^|\s)x\s?(\d{1,2})\b/i) || texto.match(/\b(\d{1,2})\s?x\b/i);
  const qty = Math.min(Math.max(parseInt(b.qty || b.quantity || (mq && mq[1]) || "1", 10) || 1, 1), 20);
  const nomeDito = texto.replace(/(?:^|\s)x\s?\d{1,2}\b/i, " ").replace(/\b\d{1,2}\s?x\b/i, " ").trim();
  const lista = await svcJson(env, "product_list", { p_secret: env.INGEST_SECRET || "", p_email: tenant, p_only_active: true });
  if (!Array.isArray(lista)) {
    return { ok: false, message: fala(lang, "I couldn't check our products just now — let me take your name and number and the front desk will set it aside for you.", "Não consegui consultar os produtos agora — me passa seu nome e telefone que a recepção separa pra você.", "No pude consultar los productos ahora — déjeme su nombre y teléfono y la recepción se lo aparta.") };
  }
  const prod = acharProduto(lista, nomeDito);
  if (!prod) {
    const nomes = lista.slice(0, 6).map((p) => p.name).join(", ");
    return { ok: true, message: lista.length
      ? fala(lang, `I want to be sure I set aside the right one — which product is it? We have: ${nomes}.`, `Quero separar o certo — qual produto é? Temos: ${nomes}.`, `Quiero apartar el correcto — ¿cuál producto es? Tenemos: ${nomes}.`)
      : fala(lang, "We don't have products listed for sale right now — I can note what you're looking for and the front desk will tell you.", "Não temos produtos cadastrados para venda agora — posso anotar o que você procura e a recepção te avisa.", "No tenemos productos listados para la venta ahora — puedo anotar lo que busca y la recepción le avisa.") };
  }
  const preco = dinheiro(prod.price_cents);
  if (testMode || b.dry_run === true) return { ok: true, message: `(dry-run) would reserve ${qty} × ${prod.name} (${preco})` };
  // Uma reserva por conversa+produto: a ElevenLabs REPETE a chamada da ferramenta, e o estoque não
  // pode descer duas vezes. Sem id de conversa, contato + dia.
  const ref = `voz:${(conv || `${rec.contact || rec.name || "anon"}:${rec.at.slice(0, 10)}`).slice(0, 120)}:${prod.id}`;
  const r = await svcJson(env, "product_sale_record", { p_secret: env.INGEST_SECRET || "", p_email: tenant, p_product_id: prod.id, p_qty: qty, p_ref: ref,
    p_customer_name: rec.name || "", p_customer_contact: rec.contact || "", p_status: "reserved", p_source: "voice" });
  if (r && r.ok === true && r.sale_id) {
    const total = dinheiro(r.total_cents);
    return { ok: true, reservado: true, resumo: `🛍️ Product reserved for pickup: ${qty} × ${prod.name} (${total}) — NOT paid yet, pay at the front desk`.slice(0, 500),
      message: fala(lang, `Done — I've set aside ${qty > 1 ? `${qty} of the ` : "the "}${prod.name} for you. It's ${total}, and you pay at the front desk when you pick it up.`,
        `Pronto — separei ${qty > 1 ? `${qty} unidades do ` : "o "}${prod.name} pra você. Fica ${total}, e você paga na recepção quando vier buscar.`,
        `Listo — le aparté ${qty > 1 ? `${qty} unidades de ` : "el "}${prod.name}. Son ${total}, y paga en recepción cuando lo recoja.`) };
  }
  if (r && r.reason === "out_of_stock") {
    return { ok: true, message: fala(lang, `I'm sorry — the ${prod.name} is out of stock right now${Number(r.stock) > 0 ? ` (only ${r.stock} left)` : ""}. Would you like me to let the front desk know you want it when it's back?`,
      `Que pena — o ${prod.name} está em falta agora${Number(r.stock) > 0 ? ` (só ${r.stock})` : ""}. Quer que eu avise a recepção que você quer quando chegar?`,
      `Lo siento — el ${prod.name} está agotado ahora${Number(r.stock) > 0 ? ` (solo ${r.stock})` : ""}. ¿Quiere que avise a recepción para cuando llegue?`) };
  }
  try { await emitFailure(env, "reserva_de_produto_falhou", tenant, `a agente tentou reservar ${qty} × ${prod.name} e o banco não confirmou (${String((r && (r.reason || r.detalhe || r.erro_http)) || "sem resposta").slice(0, 80)})`, {}); } catch { /* */ }
  return { ok: false, message: fala(lang, "I couldn't set it aside just now — let me take your name and number and the front desk will hold it for you.", "Não consegui separar agora — me passa seu nome e telefone que a recepção guarda pra você.", "No pude apartarlo ahora — déjeme su nombre y teléfono y la recepción se lo guarda.") };
}

// ── pedirGiftCard ────────────────────────────────────────────────────────────────────────────────
// Só promete link quando o link SAIU (Stripe aceitou E o e-mail foi aceito pelo Resend). Em qualquer
// outro caso a frase é a verdade: o pedido foi anotado e a equipe fecha.
async function pedirGiftCard(env, { b, rec, tenant, lang, testMode }) {
  const cents = valorParaCobranca(rec.amount).cents;
  const para = String(b.recipient || "").slice(0, 120);
  if (!cents || cents < 500) {
    return { ok: true, message: fala(lang, "Happy to — what amount would you like on the gift card?", "Com prazer — de qual valor você quer o vale-presente?", "Con gusto — ¿de qué monto quiere la tarjeta de regalo?") };
  }
  const MAX = (Number(env.MAX_CHARGE_USD) || 5000) * 100;
  const valor = dinheiro(cents);
  const resumoBase = `🎁 Gift card request: ${valor}${rec.details ? ` · ${rec.details}` : ""}${para ? ` · for ${para}` : ""}`;
  const anotado = { ok: true, avisar: true, resumo: `${resumoBase} — NOT paid yet: the team completes the sale`.slice(0, 500),
    message: fala(lang, `I've noted your ${valor} gift card request. I can't take the payment on this call — the front desk will contact you to complete it.`,
      `Anotei o seu pedido de vale-presente de ${valor}. Não consigo receber o pagamento nesta ligação — a recepção fala com você para concluir.`,
      `Anoté su pedido de tarjeta de regalo de ${valor}. No puedo cobrar en esta llamada — la recepción le contacta para completarlo.`) };
  if (testMode || b.dry_run === true) return { ...anotado, avisar: false };
  if (cents > MAX || !env.STRIPE_SECRET_KEY || !env.RESEND_API_KEY || !isEmailAddr(rec.contact)) return anotado;
  const destino = await contaDePagamento(env, tenant);
  if (destino.modo === "sem_conta") return anotado;
  let url = "";
  try {
    const form = {
      mode: "payment", "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(cents),
      "line_items[0][price_data][product_data][name]": `Gift card — ${valor}`,
      success_url: `https://guileoai.com/api/obrigado?o=gift&l=${encodeURIComponent(String(lang || "en").slice(0, 2))}`, cancel_url: "https://guileoai.com/api/obrigado?o=cancel",
      customer_email: rec.contact,
      "metadata[guileo]": "giftcard", "metadata[client_email]": tenant, "metadata[amount_cents]": String(cents),
      "metadata[recipient_contact]": para, "metadata[purchaser_contact]": rec.contact,
      "payment_intent_data[metadata][guileo]": "giftcard", "payment_intent_data[metadata][client_email]": tenant, "payment_intent_data[metadata][amount_cents]": String(cents),
      allow_promotion_codes: "false",
      ...camposDoDestino(destino, { cents, feePct: parseFloat(env.GUILEO_FEE_PCT || "0") }),
    };
    const sr = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() });
    const sd = await sr.json().catch(() => ({}));
    if (sr.ok && /^https:\/\//.test(String(sd.url || ""))) url = sd.url;
  } catch { /* sem link → pedido anotado */ }
  if (!url) { try { await emitFailure(env, "giftcard_link_falhou", tenant, `pedido de gift card de ${valor}: o Stripe não gerou o link — a equipe precisa concluir`, {}); } catch { /* */ } return anotado; }
  let enviado = false;
  try {
    const { subject, html } = giftCardLinkEmail({ name: rec.name || "", business: rec.business || "", amount: valor, recipient: para, link: url, lang: String(lang || "en") });
    const er = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: rec.contact, subject, html, ...(isEmailAddr(tenant) ? { reply_to: tenant } : {}) }) });
    const ed = await er.json().catch(() => ({}));
    enviado = er.ok && !!ed.id;
  } catch { /* não enviado */ }
  if (!enviado) return anotado;
  return { ok: true, linkEnviado: true, avisar: true, resumo: `${resumoBase} — payment link emailed to ${rec.contact}; the card is issued when it is paid`.slice(0, 500),
    message: fala(lang, `I've just emailed the secure payment link for your ${valor} gift card to ${rec.contact}. The gift card is issued as soon as it's paid.`,
      `Acabei de mandar o link seguro de pagamento do vale-presente de ${valor} para ${rec.contact}. O vale é emitido assim que o pagamento cair.`,
      `Acabo de enviar el enlace seguro de pago de la tarjeta de regalo de ${valor} a ${rec.contact}. La tarjeta se emite en cuanto se pague.`) };
}

// ── SIDE EFFECTS PIPELINE ─────────────────────────────────────────────────────────────────────────
// Everything that records/forwards/notifies an action. Shared by both the synchronous path (non-charge
// + charge-without-collect) and the F6 background path (connected charge, run via waitUntil) so the two
// never drift. Every step is best-effort and NEVER throws → the spoken reply always happens.
async function sideEffects({ env, b, rec, action, interval, tenant, testMode, connAcct, payLink, SB_URL, SB_ANON, bg }) {
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

  // 2a) REGISTRO (2026-09-28) — lead/orçamento/retorno/escalação vão pra planilha e (lead) pro ClickUp.
  if (!testMode && ["lead", "quote", "callback", "escalate", "order", "sale"].includes(rec.action)) {
    const c = String(rec.contact || "");
    const t = registrar(env, { cliente: tenant, tipo: rec.action === "lead" || rec.action === "quote" ? "lead" : rec.action, nome: rec.name,
      telefone: /@/.test(c) ? "" : c, email: /@/.test(c) ? c : "", servico: rec.details.slice(0, 160), quando: rec.when, resumo: rec.details, canal: "voz", ref: `acao:${rec.action}:${rec.at}` });
    // Em segundo plano: o caminho sem cobrança roda com o cliente NA LINHA — esperar a planilha
    // seria silêncio no telefone. `bg` = context.waitUntil do handler.
    if (typeof bg === "function") bg(t); else await t;
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
