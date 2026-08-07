// Cloudflare Pages Function — POST /api/pix-webhook
//
// Confirmação de PIX pago pelo cliente-DO-cliente. FISICAMENTE SEPARADO do
// /api/mercadopago-webhook (que cuida dos PLANOS da Guileo).
//
// POR QUE DOIS ENDPOINTS E NÃO UM COM IF: os dois fluxos têm valores parecidos em BRL
// (um spa cobra R$799 de um cliente; o plano Essential também custa R$799). Um único
// endpoint com um branch é um bug de dinheiro esperando um refactor distraído — bastaria
// alguém mexer na ordem dos ifs pra um pagamento de cliente virar crédito Guileo grátis.
// Separando os arquivos, esse erro deixa de ser possível: este aqui NÃO IMPORTA nenhuma
// RPC de crédito. Não há como creditar daqui.
//
// COMO CONFIAMOS NO QUE CHEGA (nunca no corpo da notificação):
//   1. ?t=<tenant> é só uma DICA de qual token usar (o MP preserva a notification_url).
//   2. Buscamos o pagamento em GET /v1/payments/{id} com o token DESSE tenant.
//      Não está na conta dele → 404 → ignoramos. Um POST forjado não credita ninguém.
//   3. O external_reference precisa ser "cli:<mesmo tenant>|<ref>". Divergiu → ignoramos.
//   4. Só `approved` registra. E registra IDEMPOTENTE por (tenant, ref) no banco.
import { json } from "../lib/guard.js";
import { verifyMpSignature } from "../lib/mpSignature.js";
import { svcRpc } from "../lib/sb.js";
import { emitFailure } from "../lib/failure.js";
import { tenantMp, parseCliRef } from "../lib/pix.js";

const MP = "https://api.mercadopago.com";
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));

export async function onRequest(context) {
  const { request, env } = context;
  // O MP faz um GET de teste na configuração da URL.
  if (request.method === "GET") return json({ ok: true, endpoint: "pix-webhook" });
  if (request.method !== "POST") return json({ error: "method" }, 405);

  try {
    const url = new URL(request.url);
    const hintTenant = (url.searchParams.get("t") || "").trim().toLowerCase();
    const body = await request.json().catch(() => ({}));

    // MP manda { type:"payment", data:{ id } } — e também como querystring em algumas versões.
    const type = (body?.type || body?.topic || url.searchParams.get("type") || "").toString();
    const payId = (body?.data?.id || url.searchParams.get("data.id") || body?.id || "").toString();
    if (type && type !== "payment") return json({ received: true, ignored: type });
    if (!payId || !isEmail(hintTenant)) return json({ received: true, ignored: "no-id-or-tenant" });

    // ASSINATURA — esta rota move DINHEIRO e até 2026-08-04 aceitava qualquer POST. Quem
    // descobrisse a URL forjava um "pagamento aprovado" e o sistema acreditava. O irmão
    // /api/mercadopago-webhook já verificava; agora os dois usam a MESMA lib (lib/mpSignature.js).
    // Fail-closed quando o segredo está configurado; se não estiver, seguimos (o passo abaixo
    // ainda confirma o pagamento na API do MP, que é a fonte da verdade) mas dizemos em voz alta.
    let sigChecked = false;
    if (env.MP_WEBHOOK_SECRET) {
      const okSig = await verifyMpSignature(
        request.headers.get("x-signature") || "",
        request.headers.get("x-request-id") || "",
        payId, env.MP_WEBHOOK_SECRET);
      if (!okSig) return json({ error: "bad signature" }, 401);
      sigChecked = true;
    }
    // Variável que não faz nada é verificação de mentira. Se o segredo não está configurado,
    // NINGUÉM sabe disso — então avisa uma vez por dia, em vez de aceitar POST forjado calado.
    // (A confirmação na API do MP logo abaixo ainda segura o dinheiro; isto é a porta da frente.)
    if (!sigChecked) {
      try {
        const claimed = await svcRpc(env, "ops_run_claim", { p_secret: env.INGEST_SECRET || "", p_kind: "pix_webhook_sem_assinatura", p_hours: 20 });
        if (claimed && claimed.ok && (await claimed.json().catch(() => false)) === true) {
          await emitFailure(env, "pix_webhook_unsigned", hintTenant,
            "MP_WEBHOOK_SECRET não está configurado — o webhook de PIX aceita POST sem assinatura. Configure no Cloudflare.", {});
        }
      } catch { /* nunca bloqueia o pagamento */ }
    }

    // Token do tenant indicado. Sem conta conectada → nada a fazer (e nada a vazar).
    const mp = await tenantMp(env, hintTenant);
    if (!mp.ready) return json({ received: true, ignored: "tenant-not-connected" });

    // FONTE DA VERDADE: o pagamento como o MP o conhece, na conta DESTE tenant.
    const pr = await fetch(`${MP}/v1/payments/${encodeURIComponent(payId)}`, {
      headers: { Authorization: `Bearer ${mp.access_token}` },
    });
    // 404 = não é pagamento deste tenant (ou notificação forjada). 200 = é dele de verdade.
    if (pr.status === 404) return json({ received: true, ignored: "not-this-tenant" });
    if (!pr.ok) return json({ error: "mp lookup failed — retry" }, 500); // 5xx → MP reentrega
    const pay = await pr.json().catch(() => ({}));

    // O external_reference tem que declarar o MESMO tenant. Sem isso, não é uma cobrança
    // que NÓS criamos — pode ser uma venda que o cliente fez por fora, e registrá-la aqui
    // inflaria a receita dele com dinheiro que já está em outro lugar do sistema.
    const parsed = parseCliRef(pay.external_reference);
    if (!parsed || parsed.tenant !== hintTenant) return json({ received: true, ignored: "not-a-guileo-charge" });

    const status = (pay.status || "").toString();
    const cents = Math.round(Number(pay.transaction_amount || 0) * 100);

    // Estorno: registra o negativo e avisa. Sem crédito Guileo envolvido, nada a revogar.
    if (status === "refunded" || status === "charged_back") {
      const back = Math.round(Number(pay.transaction_amount_refunded || pay.transaction_amount || 0) * 100);
      await svcRpc(env, "pix_collect_record", {
        p_secret: env.INGEST_SECRET || "", p_email: parsed.tenant,
        p_ref: `${parsed.ref}:refund`, p_amount_cents: 1, // linha marcadora; o valor real vai no evento
        p_meta: { kind: status, payment: payId, refunded_cents: back },
      }).catch(() => null);
      await svcRpc(env, "ingest_client_event", {
        p_secret: env.INGEST_SECRET || "", p_email: parsed.tenant, p_type: "refund", p_channel: "pix",
        p_summary: `${status === "charged_back" ? "Chargeback" : "Estorno"} PIX · −R$${(back / 100).toFixed(2)} · pedido ${parsed.ref}`,
        p_amount: -(back / 100), p_payload: { payment: payId, ref: parsed.ref, kind: status },
      }).catch(() => null);
      return json({ received: true, refund: true });
    }

    if (status !== "approved") return json({ received: true, status });      // pending → espera
    if (cents <= 0) return json({ received: true, ignored: "zero-amount" });

    // REGISTRO IDEMPOTENTE — (tenant, ref) é único no banco. Reentrega do MP não duplica
    // receita, e nem sobrescreve o valor já gravado.
    const rr = await svcRpc(env, "pix_collect_record", {
      p_secret: env.INGEST_SECRET || "", p_email: parsed.tenant, p_ref: parsed.ref,
      p_amount_cents: cents, p_meta: { payment: payId, method: "pix", payer: pay.payer?.email || "" },
    });
    if (!rr || !rr.ok) {
      // Dinheiro entrou e não conseguimos registrar: NUNCA silencioso. 500 faz o MP reentregar.
      await emitFailure(env, "pix_record_failed", parsed.tenant,
        `PIX de R$${(cents / 100).toFixed(2)} APROVADO (pagamento ${payId}) mas não gravou na receita — conferir`,
        { payment: payId, ref: parsed.ref, cents });
      return json({ error: "record failed — retry" }, 500);
    }
    const isNew = await rr.json().catch(() => null);
    if (isNew === false) return json({ received: true, duplicate: true });

    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: parsed.tenant, p_type: "payment", p_channel: "pix",
      p_summary: `💚 PIX recebido · R$${(cents / 100).toFixed(2)} · ${parsed.ref}`,
      p_amount: cents / 100, p_payload: { payment: payId, ref: parsed.ref, method: "pix" },
    }).catch(() => null);

    return json({ received: true, recorded: cents });
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 400);
  }
}
