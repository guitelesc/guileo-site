// Cloudflare Pages Function — POST /api/pay-link-br
// PAY-LINK BR SELF-SERVE — o vendedor gera, sozinho, o link de pagamento em REAL (PIX + cartão,
// Mercado Pago Checkout Pro) do PLANO que acabou de vender. É o irmão brasileiro do /planos
// (Stripe, dólar) e a versão self-serve do /api/pay-link — que existe, funciona, mas é gated pelo
// token de ADMIN: na prática o vendedor tinha que pedir o link ao time no meio do fechamento.
// A tela do vendedor dizia isso com todas as letras ("o link é gerado com o time"). Fechamento
// que depende de outra pessoa acordar é fechamento que esfria.
//
//   POST { seller_email, seller_code | sid, tenant, plan } -> { ok:true, url }
//
// ── AS LEIS QUE ESTE ARQUIVO OBEDECE ────────────────────────────────────────────────────────
// • VALOR NUNCA VEM DO CORPO. O preço sai de `src/data/guileoPlans.js` (amountBRL) e de lugar
//   nenhum mais. Um vendedor não digita quanto o cliente paga — nem por engano, nem de propósito.
// • INERTE QUE ACENDE. Sem MERCADOPAGO_TOKEN/MP_ACCESS_TOKEN → 503 { ready:false } dizendo qual
//   env falta. Sem preço em real definido → { ready:true, configurado:false } dizendo que a
//   decisão de preço é do dono. Nunca inventamos conversão de dólar para real.
// • MOEDA EXPLÍCITA. currency_id "BRL", sempre, e o `moeda:"BRL"` volta na resposta.
// • ATRIBUIÇÃO. external_reference = "tenant|plano|ref_do_vendedor" — o webhook credita o tenant
//   certo (ancorado no VALOR) e grava a comissão do vendedor certo. Ver mercadopago-webhook.js.
// • SUCESSO PRECISA DE COMPROVANTE. Só devolve ok:true com um init_point REAL do Mercado Pago.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { authSeller } from "../lib/sellerAuth.js";
import { GUILEO_PLANS, brlCents } from "../../src/data/guileoPlans.js";

// ⚠️ O `|` ESTÁ FORA DE PROPÓSITO (corrigido 2026-08-27). O regex clássico usa [^\s@], que
// ACEITA pipe — e o pipe é o separador do external_reference ("tenant|plano|ref"). Um tenant com
// pipe deslocava o split de 3 do webhook e entregava ao chamador o controle do `ref` do vendedor:
// exatamente a coisa que o comentário da montagem abaixo promete impedir. Recusar aqui é melhor
// que limpar: um e-mail "limpo" viraria um payer.email diferente do que o cliente digitou.
const isEmail = (s) => /^[^\s@|]+@[^\s@|]+\.[^\s@|]+$/.test(String(s || ""));

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // (1) portão de origem + freio por IP — o padrão dos vizinhos chamados pelo browser.
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "pay-link-br", 20, 60)) return json({ error: "rate" }, 429);

    const b = await request.json().catch(() => ({}));

    // (2) AUTH — quem chama tem que ser vendedor. Crachá (sid) ou e-mail + código do roster.
    const seller = await authSeller(env, { sid: b.sid, email: b.seller_email, code: b.seller_code });
    if (!seller) return json({ error: "auth_required", dica: "crachá de vendedor (sid) ou e-mail + código" }, 401);

    // (3) INERTE QUE ACENDE — sem credencial do Mercado Pago não existe link. Diz qual env falta.
    const MP_TOKEN = env.MERCADOPAGO_TOKEN || env.MP_ACCESS_TOKEN;
    if (!MP_TOKEN) return json({ ready: false, note: "set MERCADOPAGO_TOKEN — ver ATIVACOES.md" }, 503);

    // (4) TENANT — o e-mail do cliente que vai receber os créditos. Obrigatório e válido: é ele
    //     que amarra o pagamento ao tenant no webhook. Sem ele, o dinheiro entra órfão.
    const tenant = (b.tenant || b.client_email || "").toString().trim().toLowerCase().slice(0, 160);
    if (!isEmail(tenant)) {
      return json({
        error: "tenant_invalido",
        motivo: tenant.includes("|")
          ? "o e-mail do cliente não pode conter '|' (é o separador da atribuição)"
          : "informe o e-mail do cliente (tenant) para amarrar o pagamento",
      }, 400);
    }

    // (5) PLANO → PREÇO. O valor sai daqui e de lugar nenhum mais.
    const key = (b.plan || "").toString().trim().toLowerCase();
    const plano = GUILEO_PLANS.find((p) => p.key === key || p.name.toLowerCase() === key);
    if (!plano) return json({ error: "plano_desconhecido", planos: GUILEO_PLANS.map((p) => p.key) }, 400);

    const cents = brlCents(plano);
    if (cents === null) {
      // O caminho está construído; falta a DECISÃO. Dizer isso é mais útil (e mais honesto) que
      // converter dólar em real por conta própria e cobrar um número que ninguém aprovou.
      return json({
        ready: true, configurado: false, plano: plano.name,
        motivo: "preço BRL do plano ainda não definido",
        note: "defina amountBRL em src/data/guileoPlans.js (e o BRL_CREDITS do mercadopago-webhook deriva sozinho) — decisão do dono",
      });
    }
    const amount = cents / 100;

    // (6) ATRIBUIÇÃO — "tenant|plano|ref". O ref do vendedor vem da AUTH, nunca do corpo (senão
    //     qualquer um mintaria comissão para si). Sem "|" dentro das partes, para o split de 3
    //     no webhook não se partir no lugar errado.
    // As TRÊS partes têm que estar livres de "|": planLabel e ref pelo clean(), e o tenant pelo
    // isEmail acima (que agora recusa pipe). Antes só duas estavam — e a que faltava era a
    // primeira, que é justamente a que desloca todas as outras no split.
    const clean = (s) => String(s || "").replace(/\|/g, "-").trim();
    const planLabel = clean(plano.name).slice(0, 60);
    const ref = clean(seller.ref).slice(0, 60);
    const externalRef = `${tenant}|${planLabel}|${ref}`;

    // (7) MINTAGEM — mesmo formato do /api/pay-link (Checkout Pro → init_point).
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title: `Guileo — ${planLabel}`.slice(0, 200), quantity: 1, unit_price: amount, currency_id: "BRL" }],
        payer: { email: tenant },
        external_reference: externalRef,
        notification_url: "https://guileoai.com/api/mercadopago-webhook",
        back_urls: { success: "https://guileoai.com/portal", pending: "https://guileoai.com", failure: "https://guileoai.com" },
        statement_descriptor: "GUILEO",
      }),
    });
    if (!res.ok) return json({ error: `mercadopago ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` }, 502);
    const d = await res.json().catch(() => ({}));
    const url = d.init_point || d.sandbox_init_point || "";
    // COMPROVANTE: "ok" sem o link não é sucesso, é promessa. Sem init_point, é 502.
    if (!url) return json({ error: "mercadopago devolveu preferência sem init_point" }, 502);

    return json({ ok: true, url, id: d.id || "", plano: plano.name, valor: amount, moeda: "BRL", tenant, ref });
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
