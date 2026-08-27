// Cloudflare Pages Function — POST /api/mercadopago-webhook
// Mercado Pago (Brazil / PIX + card) → REAL Gui credits. This is the BR mirror of
// stripe-webhook.js, obeying the same money laws (ARQUITETURA.md §💰):
//   • credit ANCHORED to the exact BRL amount paid (BRL_CREDITS map) — never metadata, never a fallback;
//   • triple idempotency: mark_webhook_seen (event id) + claim_credit_event (money object) + UNIQUE table;
//   • tenant-bound: the tenant comes from the payment's external_reference (tenant|plan), never a bare id;
//   • NEVER trust the notification body — always GET /v1/payments/{id} from MP with the server token;
//   • failure is never silent → emitFailure surfaces paid-but-nothing in /admin within seconds.
// HONEST scaffold: with no MP_ACCESS_TOKEN this endpoint is inert ({ ready:false }) — it credits nothing.
//
// MP delivers { type:"payment", data:{ id } } (also as ?type=payment&data.id=…). We look the payment up,
// and only an `approved` payment credits. Refund / chargeback mirror the Stripe path (negative ledger +
// owner alert; we have no deduct RPC so credits are revoked by hand).
import { verifyMpSignature } from "../lib/mpSignature.js";
import { json, safeEq } from "../lib/guard.js";
import { ownerAlertEmail, sellerCommissionEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";
import { svcRpc } from "../lib/sb.js";
import { BRL_CREDITS_MAP, BRL_PLAN_MAP } from "../../src/data/guileoPlans.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
// dedicated server-side secret for the credit-idempotency RPC (matches db/_gui_pend_ok / credit_idempotency.sql),
// identical to the one the Stripe webhook uses so both money paths share ONE dedup table.
const PEND_FALLBACK = "gx_pend_7Qk2mZ9vR4tLpW8n_cit3l3s";
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// BRL PLAN ANCHOR — o mapa preço-exato → créditos, DERIVADO de src/data/guileoPlans.js (2026-08-25).
// Antes era literal aqui ({79900:500, 249900:2000, 549900:6000}) e estava DESATUALIZADO: os planos
// já eram $149/500, $897/3000, $1997/9000, e este arquivo ainda creditava pela tabela velha. Duas
// tabelas de preço = uma delas está errada e ninguém sabe qual. Agora existe UMA: o plano.
// ⚠️ Plano com `amountBRL: null` simplesmente NÃO existe no mapa — MAPA VAZIO = NENHUM CRÉDITO BR
// até o dono definir o preço em real. Isso é de propósito: pagamento de valor desconhecido vira
// `brl_price_indefinido` via emitFailure (o dono credita à mão) em vez de creditar errado.
// Valores em CENTAVOS de real.
const BRL_CREDITS = BRL_CREDITS_MAP;
const BRL_PLAN = BRL_PLAN_MAP;
const BRL_PRECO_DEFINIDO = Object.keys(BRL_CREDITS).length > 0;

// Mercado Pago x-signature validation (official manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
// HMAC-SHA256 with the webhook secret, hex, compared to the v1 part). data.id is lowercased for alphanumerics.
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // HONEST scaffold — no token means the BR rail was never wired; credit nothing, say so plainly.
    const MP_TOKEN = env.MP_ACCESS_TOKEN || env.MERCADOPAGO_TOKEN;
    if (!MP_TOKEN) return json({ ready: false, note: "set MP_ACCESS_TOKEN (or MERCADOPAGO_TOKEN) in Cloudflare to enable PIX/Mercado Pago crediting" });

    const url = new URL(request.url);
    const raw = await request.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }

    // Resolve the notification target. MP sends { type/topic, data:{ id } } and/or ?type=&data.id=.
    const kind = (body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "").toString().toLowerCase();
    const dataId = (body.data?.id || body.resource || url.searchParams.get("data.id") || url.searchParams.get("id") || "").toString().replace(/^.*\//, "");
    // Only payment notifications carry money. Merchant_order / plan / other topics: ack + skip.
    if (kind && kind !== "payment") return json({ received: true, ignored: kind });
    if (!dataId) return json({ received: true, note: "no payment id" });

    // SIGNATURE — when a webhook secret is configured, reject anything that doesn't verify. If it's
    // NOT configured we still proceed, because we re-fetch the payment from MP below (the body is never
    // trusted): a forged notification can at worst point us at an id MP will 404 on.
    if (env.MP_WEBHOOK_SECRET) {
      const ok = await verifyMpSignature(request.headers.get("x-signature") || "", request.headers.get("x-request-id") || "", dataId, env.MP_WEBHOOK_SECRET);
      if (!ok) return json({ error: "bad signature" }, 401);
    }

    // SOURCE OF TRUTH — never trust the notification body; fetch the real payment from MP with the token.
    const pr = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    // Unknown/forged id → 404: ack so MP stops retrying. Transient 5xx → 500 so MP re-delivers later.
    if (pr.status === 404) return json({ received: true, unknown_payment: true });
    if (!pr.ok) return json({ error: `mp payment lookup ${pr.status} — retry` }, 500);
    const pay = await pr.json().catch(() => ({}));

    const status = (pay.status || "").toString().toLowerCase();
    const currency = (pay.currency_id || "BRL").toString().toUpperCase();
    const cents = Math.round(Number(pay.transaction_amount || 0) * 100);
    const ING = env.INGEST_SECRET || "";
    const PEND_SECRET = env.PEND_SECRET || PEND_FALLBACK;
    const payerEmail = (pay.payer?.email || "").toString().toLowerCase();
    // external_reference carries the tenant (and optionally the plan) we bound at link-creation time:
    // "client@email|Personalized". The tenant email is authoritative; fall back to the payer email.
    const extRef = (pay.external_reference || "").toString();

    // ── BARREIRA cli: — cobrança DO CLIENTE nunca entra no fluxo de planos ────────
    // Cobranças PIX que a Gui cria pro cliente-do-cliente usam external_reference
    // "cli:<tenant>|<pedido>" e são tratadas em /api/pix-webhook. Elas NÃO podem ser
    // processadas aqui: "cli:spa@x.com" passa no teste de e-mail abaixo (o ":" é um
    // caractere válido antes do @), então um pagamento de R$799 de um cliente-do-cliente
    // viraria 500 créditos Guileo para um tenant fantasma. Barrar por prefixo é a única
    // checagem que não depende de ninguém lembrar dessa sutileza no futuro.
    if (extRef.startsWith("cli:")) return json({ received: true, ignored: "tenant-collection" });

    // external_reference tem HOJE 3 partes: "tenant|plano|ref_do_vendedor" (o /api/pay-link-br
    // carimba as três). Links antigos (2 partes, do /api/pay-link) continuam valendo — a 3ª volta
    // vazia e a atribuição simplesmente não acontece, sem quebrar nada.
    const partes = extRef.split("|").map((s) => (s || "").trim());
    // ⚠️ DEFESA EM PROFUNDIDADE (2026-08-27). Quem monta este campo é /api/pay-link-br, que agora
    // recusa "|" nas três partes. Mas link mintado ANTES daquela correção continua pagável, e um
    // tenant com pipe desloca o split: a 3ª parte deixa de ser o ref carimbado pela AUTH e passa a
    // ser texto escolhido por quem pediu o link — que é exatamente a comissão sendo forjada.
    // Mais de 3 partes = a string não veio do nosso formato. Creditamos o pagamento normalmente
    // (o dinheiro é real e o tenant é validado por regex logo abaixo), mas NÃO atribuímos vendedor:
    // atribuição errada é pior que atribuição nenhuma, porque paga a pessoa errada em silêncio.
    const [refTenant, refPlan] = partes;
    const refSeller = partes.length > 3 ? "" : (partes[2] || "");
    if (partes.length > 3) {
      try {
        await emitFailure(env, "mp_external_ref_malformado", refTenant || "(sem tenant)",
          `external_reference com ${partes.length} partes (esperado 2 ou 3) — atribuição de vendedor IGNORADA por segurança; confira quem gerou este link`,
          { external_reference: extRef.slice(0, 200), partes: partes.length });
      } catch { /* o diagnóstico nunca pode impedir o crédito do cliente */ }
    }
    const email = (refTenant && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refTenant) ? refTenant : payerEmail).toLowerCase();
    const payId = (pay.id || dataId).toString();

    // REFUND / CHARGEBACK — mirror the Stripe path: we have no deduct RPC, so we do NOT auto-revoke;
    // we log a negative 'refund' client_event and alert the owner to revoke by hand. Never throws.
    if (status === "refunded" || status === "charged_back" || (status === "cancelled" && Number(pay.transaction_amount_refunded || 0) > 0)) {
      // MP delivers at-least-once — without a gate a redelivery double-logs the negative event
      // and re-spams the owner. Distinct key so it never collides with the credit mark below.
      try {
        const rseen = await rpc("mark_webhook_seen", { p_secret: ING, p_provider: "mercadopago", p_event_id: `refund_${payId}` });
        if (rseen.ok && (await rseen.json()) === false) return json({ received: true, duplicate_refund: true });
      } catch { /* gate unavailable → proceed (better a rare duplicate log than a lost refund alert) */ }
      try {
        const refundedCents = Math.round(Number(pay.transaction_amount_refunded || pay.transaction_amount || 0) * 100);
        const label = status === "charged_back" ? "Chargeback" : "Refund";
        // REVOKE credits the refunded BRL bought — exact plan match first (BRL_CREDITS), else a
        // conservative per-real estimate (never over-deduct); clamped ≥ 0, idempotent by payId.
        // ⚠️ com o mapa BRL vazio (preço em real ainda não definido) NUNCA estimamos: nenhum
        // crédito foi concedido por este trilho, então "estimar" só tiraria crédito que o cliente
        // comprou por outro caminho. Sem preço definido, revoke = 0 e o alerta abaixo diz o porquê.
        const revoke = BRL_CREDITS[refundedCents] || (BRL_PRECO_DEFINIDO ? Math.round((refundedCents / 100) * 0.6) : 0);
        let balanceAfter = null;
        if (email && revoke > 0) {
          try {
            const dr = await rpc("deduct_client_credits", { p_secret: ING, p_email: email, p_credits: revoke, p_reason: status, p_ref: `mp:${status}:${payId}` });
            if (dr.ok) balanceAfter = await dr.json().catch(() => null);
          } catch { /* deduct best-effort; the negative event below still records it */ }
        }
        await svcRpc(env, "ingest_client_event", {
          p_secret: ING, p_email: email, p_type: "refund", p_channel: "mercadopago",
          p_summary: `${label} · -R$${(refundedCents / 100).toFixed(2)} · −${revoke} cr${email ? " · " + email : ""}`,
          p_amount: -(refundedCents / 100), p_payload: { id: payId, kind: status, revoked_credits: revoke, balance_after: balanceAfter },
        });
        if (env.RESEND_API_KEY) {
          const owner = (env.OWNER_EMAIL || "smart@guileoai.com").split(",")[0].trim();
          const otpl = ownerAlertEmail({
            kind: "billing", customer: email || "(sem email)", business: "Guileo billing · Mercado Pago",
            details: `⚠️ ${label} de R$${(refundedCents / 100).toFixed(2)} no Mercado Pago (payment ${payId}). ${email && revoke > 0 ? `Créditos revogados automaticamente: −${revoke}${balanceAfter != null ? ` (novo saldo: ${balanceAfter})` : ""}.` : "Nenhum crédito revogado (sem email do cliente / valor arredondado a 0)."}`,
            amount: `R$${(refundedCents / 100).toFixed(2)}`, lang: "pt",
          });
          await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [owner], subject: otpl.subject, html: otpl.html }),
          });
        }
      } catch { /* refund handling is best-effort; never throw */ }
      return json({ received: true, refund: true });
    }

    // Only an APPROVED payment credits. pending / in_process / rejected → ack, wait for the next event.
    if (status !== "approved") return json({ received: true, status });
    // GRACE-PAUSE RELEASE — a real BR payment un-pauses a previously past-due tenant automatically.
    if (email) { try { await rpc("set_client_paused", { p_secret: ING, p_email: email, p_paused: false }); } catch { /* best-effort */ } }

    // IDEMPOTENCY LAYER 1 — event/payment id seen exactly once (provider 'mercadopago'). If the check
    // can't be confirmed (RPC down), 500 so MP re-delivers rather than risk a double-credit.
    try {
      const sr = await rpc("mark_webhook_seen", { p_secret: ING, p_provider: "mercadopago", p_event_id: payId });
      if (!sr.ok) return json({ error: "idempotency check unavailable — retry" }, 500);
      if ((await sr.json()) === false) return json({ received: true, duplicate: true });
    } catch { return json({ error: "idempotency check error — retry" }, 500); }

    // CURRENCY ANCHOR — the credit map is BRL cents. A non-BRL payment must NEVER hit it.
    if (currency !== "BRL") {
      await emitFailure(env, "non_brl_payment", email, `paid ${currency} ${(cents / 100).toFixed(2)} on MP — NOT credited (BRL map only); resolve in Mercado Pago dashboard`, { payment: payId, currency });
      return json({ received: true, uncredited: "non-brl" });
    }

    // VALUE ANCHOR — credits come from the exact amount paid, never metadata, never a per-real fallback.
    const credits = BRL_CREDITS[cents];
    const plan = (refPlan || BRL_PLAN[cents] || "").toString();

    // PREÇO EM REAL AINDA NÃO DEFINIDO — o mapa BRL está VAZIO porque nenhum plano tem `amountBRL`
    // em src/data/guileoPlans.js. Não dá para saber quantos créditos R$X compra sem que o dono
    // decida o preço, e chutar uma conversão de dólar seria inventar. Grita e para: o dono credita
    // à mão e define o preço. (Some sozinho no dia em que amountBRL for preenchido.)
    if (!BRL_PRECO_DEFINIDO) {
      await emitFailure(env, "brl_price_indefinido", email, `MP aprovou R$${(cents / 100).toFixed(2)} mas NENHUM plano tem preço em real definido (amountBRL null em guileoPlans.js) — NADA creditado; defina o preço e credite à mão`, { payment: payId, cents, plano: plan || null });
      return json({ received: true, uncredited: "brl-price-undefined" });
    }

    // CLIENT-CHARGE GUARD — the MP webhook URL is registered account-wide, so a tenant's own
    // customer paying a PIX close&collect link (no external_reference tenant) can land here with
    // a plan-priced amount. Without a verified tenant email in external_reference we must NEVER
    // mint Guileo credits to the payer — alert loudly and let a human resolve it instead.
    const refIsTenant = !!(refTenant && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refTenant));
    if (!refIsTenant && credits > 0) {
      await emitFailure(env, "mp_paid_no_ref", email, `MP payment ${payId} matches a plan price (R$${(cents / 100).toFixed(2)}) but carries no tenant external_reference — NOT credited; verify and credit manually`, { payment: payId, cents });
      return json({ received: true, uncredited: "no-tenant-ref" });
    }

    if (email && credits > 0) {
      // IDEMPOTENCY LAYER 2 (defense-in-depth) — claim this money object for crediting exactly once,
      // keyed on the MP payment id. Shares the gui_credit_idem table with the Stripe path.
      let mayCredit = true;
      try {
        const clm = await rpc("claim_credit_event", { p_secret: PEND_SECRET, p_event_id: `mp_${payId}`, p_email: email });
        if (clm.ok) { const claimed = await clm.json(); if (claimed === false) mayCredit = false; }
      } catch { /* claim RPC missing → fall back to the event-id gate above */ }
      if (!mayCredit) return json({ received: true, already_credited: true });

      const cr = await rpc("add_client_credits", { p_secret: ING, p_email: email, p_credits: credits, p_plan: plan.slice(0, 80) });
      if (!cr.ok) await emitFailure(env, "credit_storage_failed", email, `MP paid R$${(cents / 100).toFixed(2)} → ${credits} cr NOT stored`, { payment: payId });
      await svcRpc(env, "ingest_client_event", {
        p_secret: ING, p_email: email, p_type: "payment", p_channel: "mercadopago",
        p_summary: `Pagamento PIX/MP · R$${(cents / 100).toFixed(2)} → +${credits} créditos${plan ? " · " + plan : ""}`,
        p_amount: cents / 100, p_payload: { payment: payId },
      });

      // [GANCHO AUTO-APPROVE — outro agente]
      // (ponto logo depois do crédito somado: é aqui que entra o snippet que aprova/provisiona
      //  sozinho o draft do cliente quando o pagamento em real cai.)

      // ATRIBUIÇÃO DO VENDEDOR — espelho EXATO do caminho Stripe (stripe-webhook.js §SELLER
      // ATTRIBUTION): grava um client_event 'attribution' com { seller_ref } no tenant NOVO (é o
      // que o motor de comissão lê depois) e avisa o vendedor que a carteira dele rendeu. Aqui o
      // ref não vem de client_reference_id e sim da 3ª parte do external_reference, carimbada pelo
      // /api/pay-link-br a partir da AUTH do vendedor — ninguém minta comissão para si.
      if (refSeller) {
        try {
          await svcRpc(env, "ingest_client_event", {
            p_secret: ING, p_email: email, p_type: "attribution", p_channel: "system",
            p_summary: `👤 Atribuição de vendedor · ${refSeller.slice(0, 60)}`,
            p_amount: 0, p_payload: { seller_ref: refSeller.slice(0, 200), payment: payId, plan },
          });
          if (env.RESEND_API_KEY) {
            const sr = await rpc("seller_by_ref", { p_secret: ING, p_ref: refSeller.slice(0, 200) });
            const sellerRow = sr.ok ? await sr.json().catch(() => null) : null;
            if (sellerRow && sellerRow.email) {
              const { subject, html } = sellerCommissionEmail({
                sellerName: sellerRow.name || "", business: email.split("@")[0],
                amount: `R$${(cents / 100).toFixed(2)}`, plan, lang: "pt",
              });
              // 🚨 "await" NÃO É "ENVIADO" (corrigido 2026-08-27). Este fetch não conferia o
              // retorno, e o bloco inteiro vive num catch mudo: um 422 do Resend (domínio não
              // verificado, endereço inválido, rate limit) sumia sem deixar UMA linha. O vendedor
              // não era avisado da comissão, concluía que a venda não foi atribuída a ele, e
              // abria disputa sobre um pagamento que tinha sido creditado direitinho.
              // O irmão deste código — functions/lib/avisoLeadVendedor.js — já fazia certo.
              const er = await fetch("https://api.resend.com/emails", {
                method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [sellerRow.email], subject, html }),
              });
              if (!er.ok) {
                const cru = await er.text().catch(() => "");
                await emitFailure(env, "aviso_comissao_nao_saiu", sellerRow.email,
                  `o aviso de COMISSÃO não saiu (HTTP ${er.status}) — a venda FOI creditada, avise o vendedor à mão`,
                  { ref: refSeller.slice(0, 60), pagamento: payId, cru: cru.slice(0, 160) }).catch(() => {});
              }
            }
          }
        } catch { /* atribuição é aditiva — o crédito acima já landed */ }
      }
      return json({ received: true, credited: credits });
    }

    // PAID-BUT-NOTHING — money cleared but we couldn't credit (amount off-map, or no tenant/email).
    // Never silent: surface it so /admin makes the customer whole by hand.
    await emitFailure(env, "paid_but_uncredited", email, `MP approved R$${(cents / 100).toFixed(2)} but ${email ? "amount not in BRL plan map (no fallback)" : "no tenant/email on the payment"} — resolve in Mercado Pago dashboard`, { payment: payId, cents });
    return json({ received: true, uncredited: true });
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 400);
  }
}
