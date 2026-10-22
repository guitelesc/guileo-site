// Cloudflare Pages Function — POST /api/loja-checkout   (LOJA DA VITRINE · a cliente do negócio paga)
// A sacola da vitrine (src/novo/NaturaStore.jsx) manda { slug, itens:[{ id, qtd }], entrega } e recebe
// { url } de um Stripe Checkout. Quem confirma o pagamento, registra a venda e baixa o estoque é o
// webhook (stripe-webhook.js, ramo guileo:"loja") — aqui NADA é gravado: sessão aberta não é venda.
//
// O DINHEIRO (por onde a venda sai = lib/vendaOnlineNegocio.js · caminhoDaVenda, a MESMA regra do
// pacote e do vale-presente):
//   1. o negócio colou a chave restrita PRÓPRIA (stripe_own) → o Checkout nasce na conta DELE
//      (camposDaLojaPropria). A plataforma Stripe da Guileo é BR e não repassa para negócio dos EUA.
//      O webhook da plataforma não fica sabendo: quem registra o pedido pago é a volta
//      (/api/venda-paga?loja=<slug>) e a conferência de hora em hora (/api/venda-online-reconcile),
//      com a MESMA SQL do webhook (db/desk_v7_loja.sql · loja_online_fulfill_svc), uma vez por sessão.
//   2. sem chave própria → exatamente o caminho de antes: conta CONECTADA do negócio (cobrança de
//      destino, lib/contaDoCliente.js) e o webhook registra. Negócio BR sem conta: "sem_conta", igual.
//   3. negócio fora do BR sem chave própria → `payments_not_connected`, com a dica para o DONO
//      (guileoai.com/receber). Nunca abre Checkout na plataforma para ele. A cliente lê só a frase.
//   • preço, nome e estoque saem do catálogo do tenant no banco (product_list). O preço da página é
//     ignorado: quem edita a página não muda o que paga.
//
// TRAVAS, nesta ordem: origem (só a própria vitrine) → 10 tentativas/min por IP → loja cadastrada →
// interruptor LOJA.aoVivo (src/novo/naturaStoreCatalogo.js; false = "store isn't open") → itens e
// entrega → caminho do dinheiro (chave própria / conta conectada / recusa) → catálogo → pedido → Checkout.
//
// Falha devolve { ok:false, code, error } — `error` é a frase em inglês que a cliente lê na sacola,
// sempre dizendo que nada foi cobrado. Corpo JSON de falha nossa usa 503, nunca 502.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { camposDoDestino } from "../lib/contaDoCliente.js";
import { caminhoDaVenda } from "../lib/vendaOnlineNegocio.js";
import { stripe, motivoDoStripe } from "../lib/stripeDoNegocio.js";
import { emitFailure } from "../lib/failure.js";
import { ehNosso } from "../lib/dominio.js";
import { lojaDe, lerItens, montarPedido, camposDoCheckout, camposDaLojaPropria, metaDosItens, FRASES } from "../lib/loja.js";

const falha = (code, status = 400, extra = {}) => json({ ok: false, code, error: FRASES[code] || FRASES.stripe, ...extra }, status);

/* A vitrine é servida em guileoai.com/novo/<slug> e no domínio do próprio cliente: a chamada vem
   do MESMO host deste endpoint. Header ausente (curl) não passa. */
export function daPropriaVitrine(request) {
  const aqui = new URL(request.url).origin;
  const o = request.headers.get("Origin") || "";
  if (o) return o === aqui || sameOrigin(request);
  const ref = request.headers.get("Referer") || "";
  try { return !!ref && (new URL(ref).origin === aqui || sameOrigin(request)); } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!daPropriaVitrine(request)) return falha("origem", 403);
    if (await rateLimited(request, env, "loja-checkout", 10, 60)) return falha("devagar", 429);

    const b = await request.json().catch(() => ({}));
    const loja = lojaDe(b.slug);
    if (!loja) return falha("fechada", 404);
    if (loja.config.aoVivo !== true) return falha("fechada", 503);

    // Forma antes de qualquer rede: pedido torto não custa uma leitura de banco.
    const forma = lerItens(b.itens, loja.config.qtdMax);
    if (!forma.ok) return falha(forma.code);
    if (!loja.entregas.some((e) => e.id === b.entrega)) return falha("entrega_invalida");

    const caminho = await caminhoDaVenda(env, loja.email);
    if (caminho.via === "recusa") {
      // BR sem conta: a recusa de sempre. Fora do BR: payments_not_connected + a dica do Stripe próprio.
      if (caminho.corpo?.hint !== "use_own_stripe") return falha("sem_conta", 503, { detail: caminho.corpo?.detail || "nao_conectado" });
      return falha("payments_not_connected", 503, caminho.corpo);   // corpo.ok já é false; reason/hint/connect_url/note vão junto
    }
    if (caminho.via === "plataforma" && !env.STRIPE_SECRET_KEY) {
      await emitFailure(env, "loja_sem_chave_stripe", loja.email, "Loja ligada (aoVivo) mas STRIPE_SECRET_KEY ausente — nenhuma venda sai", { slug: loja.slug });
      return falha("sem_conta", 503);
    }

    const catalogo = await svcJson(env, "product_list", { p_secret: env.INGEST_SECRET || "", p_email: loja.email, p_only_active: true });
    if (!Array.isArray(catalogo)) return falha("catalogo", 503);

    const tetoCents = (Number(env.MAX_CHARGE_USD) || 100000) * 100;
    const pedido = montarPedido({ loja, itens: b.itens, entrega: b.entrega, catalogo, tetoCents });
    if (!pedido.ok) return falha(pedido.code, pedido.code === "esgotado" ? 409 : 400);

    const u = new URL(request.url);
    const voltar = `${u.origin}${ehNosso(u.host) ? `/novo/${loja.slug}` : "/"}`;

    if (caminho.via === "propria") {
      const form = camposDaLojaPropria({ loja, pedido, voltar, origem: u.origin });
      const r = await stripe(caminho.chave, "POST", "/checkout/sessions", form);
      if (!r.ok || !r.data?.url || !/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(String(r.data?.id || ""))) {
        const m = motivoDoStripe(r.status, r.data);
        await emitFailure(env, "loja_checkout_stripe", loja.email, `O Stripe PRÓPRIO do negócio recusou abrir o checkout da loja (${r.status} · ${m.reason}${m.permissao ? ` · falta ${m.permissao}` : ""}): ${String(m.detail || "").slice(0, 140)}`, { slug: loja.slug, total: pedido.total, via: "stripe_own", reason: m.reason, permissao: m.permissao || "" });
        return falha("stripe", 503, { reason: m.reason });
      }
      // registro para a conferência de hora em hora achar quem pagou e fechou a aba antes de voltar
      const reg = await svcJson(env, "loja_online_session_add_svc", { p_tenant: loja.email, p_session: r.data.id, p_cents: pedido.total, p_itens: metaDosItens(pedido.linhas) });
      if (!reg || reg.ok !== true) {
        await emitFailure(env, "loja_registro_sessao", loja.email, `Checkout da loja aberto no Stripe próprio SEM registro para a conferência (${reg?.reason || reg?.erro_http || "sem resposta"}) — só a volta da cliente registra o pedido`, { slug: loja.slug, session: r.data.id });
      }
      return json({ ok: true, url: r.data.url, id: r.data.id, via: "stripe_own" });
    }

    const form = {
      ...camposDoCheckout({ loja, pedido, voltar }),
      ...camposDoDestino(caminho.destino, { cents: pedido.total, feePct: parseFloat(env.GUILEO_FEE_PCT || "0") }),
    };
    const sr = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const sd = await sr.json().catch(() => ({}));
    if (!sr.ok || !sd.url) {
      await emitFailure(env, "loja_checkout_stripe", loja.email, `Stripe recusou abrir o checkout da loja (${sr.status}): ${(sd?.error?.message || "").slice(0, 160)}`, { slug: loja.slug, total: pedido.total });
      return falha("stripe", 503);
    }
    return json({ ok: true, url: sd.url, id: sd.id || "" });
  } catch (e) {
    await emitFailure(env, "loja_checkout_erro", "", `loja-checkout quebrou: ${String(e).slice(0, 160)}`);
    return falha("stripe", 503);
  }
}
