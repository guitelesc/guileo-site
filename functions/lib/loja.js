// LOJA DA VITRINE — as decisões PURAS do checkout (sem rede, sem banco, sem env).
// Quem usa: functions/api/loja-checkout.js (monta o pedido e o Checkout do Stripe) e
// functions/api/stripe-webhook.js (lê de volta os itens pagos para registrar a venda) e, quando o
// negócio usa o Stripe PRÓPRIO, functions/lib/vendaOnlineNegocio.js (registra na volta / na conferência).
//
// FONTE ÚNICA: frete, retirada e o interruptor `aoVivo` vêm de src/novo/naturaStoreCatalogo.js — o
// MESMO arquivo que a vitrine mostra. Mudou o frete lá, mudou aqui; não existe um segundo valor.
//
// A REGRA QUE MANDA: o navegador manda só { id, qtd } e o tipo de entrega. Nome, preço e estoque
// saem do catálogo do TENANT no banco (biz_products). Preço vindo da página nunca é lido.
//
//   node --test functions/lib/loja.test.mjs
import { LOJA, ENTREGAS, freteDe } from "../../src/novo/naturaStoreCatalogo.js";
import { VITRINES } from "./dominio.js";

export const LINHAS_MAX = 12;          // cabe no limite de 500 caracteres de um metadado do Stripe
export const MIN_CENTS = 50;           // o mínimo que o Stripe cobra em USD
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* As lojas que existem. Só entra vitrine com loja de verdade; o resto responde "sem loja". */
export const LOJAS = {
  // 🚨 `email` = a CONTA do negócio na plataforma (catálogo, Stripe conectado, aviso de pedido), que é
  // naturaspaadm@gmail.com — NÃO o e-mail público do site (VITRINES.email = naturaspanyc@gmail.com, que
  // não tem nada na plataforma). Conferido no banco em 2026-10-05: a conta adm tem os eventos e serviços.
  "natura-spa": { slug: "natura-spa", email: "naturaspaadm@gmail.com", nome: VITRINES["natura-spa"].nome, config: LOJA, entregas: ENTREGAS, freteDe },
};
export const lojaDe = (slug) => (Object.prototype.hasOwnProperty.call(LOJAS, String(slug || "")) ? LOJAS[String(slug)] : null);

/* A frase que a CLIENTE lê na sacola quando algo dá errado (a vitrine mostra `error` como veio). */
export const FRASES = {
  fechada: "The store isn’t open yet. Nothing was charged.",
  sem_conta: "Online checkout isn’t available right now. Nothing was charged — please call the salon.",
  vazia: "Your bag is empty.",
  item_invalido: "Something in your bag is no longer available. Please refresh the page.",
  esgotado: "One of the items just sold out. Please refresh the page.",
  entrega_invalida: "Choose pickup or shipping.",
  pouco: "The order total is too low for card payment.",
  muito: "This order is above the online limit. Please call the salon.",
  catalogo: "We couldn’t load the store right now. Nothing was charged — please try again.",
  stripe: "We couldn’t open checkout. Nothing was charged — please try again.",
  origem: "Please place your order from the store page.",
  devagar: "Too many tries in a row — please wait a minute.",
  // negócio dos EUA sem o Stripe próprio conectado: a cliente lê isto; a dica para o DONO
  // (guileoai.com/receber) vai nos outros campos da resposta e no alarme.
  payments_not_connected: "Online checkout isn’t available yet. Nothing was charged — please call the salon to order.",
};

/* Junta repetidos, valida forma. Não olha o catálogo ainda. */
export function lerItens(cru, qtdMax = LOJA.qtdMax) {
  if (!Array.isArray(cru) || !cru.length) return { ok: false, code: "vazia" };
  const soma = new Map();
  for (const it of cru) {
    const id = it && typeof it.id === "string" ? it.id.trim() : "";
    const q = Math.floor(Number(it && it.qtd));
    if (!UUID.test(id) || !Number.isFinite(q) || q < 1 || q > qtdMax) return { ok: false, code: "item_invalido" };
    soma.set(id, (soma.get(id) || 0) + q);
  }
  if (soma.size > LINHAS_MAX) return { ok: false, code: "item_invalido" };
  for (const q of soma.values()) if (q > qtdMax) return { ok: false, code: "item_invalido" };
  return { ok: true, itens: [...soma].map(([id, qtd]) => ({ id, qtd })) };
}

/* O pedido de verdade: cada item casado com o catálogo do banco, preço do banco, frete da regra.
   `catalogo` = o que product_list devolveu. `tetoCents` = MAX_CHARGE_USD*100. */
export function montarPedido({ loja, itens, entrega, catalogo, tetoCents = 100000 * 100 }) {
  const lidos = lerItens(itens, loja.config.qtdMax);
  if (!lidos.ok) return lidos;
  const e = loja.entregas.find((x) => x.id === entrega);
  if (!e) return { ok: false, code: "entrega_invalida" };
  const porId = new Map((Array.isArray(catalogo) ? catalogo : []).map((p) => [String(p && p.id), p]));
  const linhas = [];
  for (const { id, qtd } of lidos.itens) {
    const p = porId.get(id);
    if (!p || p.active === false) return { ok: false, code: "item_invalido" };
    const preco = Math.round(Number(p.price_cents));
    if (!Number.isFinite(preco) || preco <= 0) return { ok: false, code: "item_invalido" };   // "sob consulta" não se vende online
    if (p.stock !== null && p.stock !== undefined && p.stock !== "" && Number(p.stock) < qtd) return { ok: false, code: "esgotado" };
    linhas.push({ id, qtd, nome: String(p.name || "").slice(0, 120), preco });
  }
  const subtotal = linhas.reduce((n, l) => n + l.preco * l.qtd, 0);
  const frete = loja.freteDe(subtotal, e.id);
  const total = subtotal + frete;
  if (total < MIN_CENTS) return { ok: false, code: "pouco" };
  if (total > tetoCents) return { ok: false, code: "muito" };
  return { ok: true, linhas, subtotal, frete, total, entrega: e };
}

/* Itens pagos ↔ metadado do Stripe: "id:qtd,id:qtd". O webhook lê de volta com itensDaMeta. */
export const metaDosItens = (linhas) => linhas.map((l) => `${l.id}:${l.qtd}`).join(",");
export function itensDaMeta(texto) {
  const out = [];
  for (const par of String(texto || "").split(",")) {
    const [id, q] = par.split(":");
    const n = Math.floor(Number(q));
    if (UUID.test(id || "") && Number.isFinite(n) && n >= 1 && n <= 1000) out.push({ id, qtd: n });
  }
  return out.slice(0, LINHAS_MAX);
}

/* Os campos do POST /v1/checkout/sessions (form-urlencoded). `voltar` = URL da vitrine, sem query.
   O destino do dinheiro (camposDoDestino) quem junta é o endpoint, que conhece a conta. */
export function camposDoCheckout({ loja, pedido, voltar }) {
  const f = {
    mode: "payment",
    success_url: `${voltar}?loja=ok#store`,
    cancel_url: `${voltar}?loja=cancelado#store`,
    "phone_number_collection[enabled]": "true",
    allow_promotion_codes: "false",
  };
  pedido.linhas.forEach((l, i) => {
    f[`line_items[${i}][quantity]`] = String(l.qtd);
    f[`line_items[${i}][price_data][currency]`] = "usd";
    f[`line_items[${i}][price_data][unit_amount]`] = String(l.preco);
    f[`line_items[${i}][price_data][product_data][name]`] = l.nome;
  });
  if (pedido.entrega.id === "envio") {
    f["shipping_address_collection[allowed_countries][0]"] = "US";
    f["shipping_options[0][shipping_rate_data][type]"] = "fixed_amount";
    f["shipping_options[0][shipping_rate_data][fixed_amount][amount]"] = String(pedido.frete);
    f["shipping_options[0][shipping_rate_data][fixed_amount][currency]"] = "usd";
    f["shipping_options[0][shipping_rate_data][display_name]"] = pedido.frete ? "Standard shipping" : "Free shipping";
  } else {
    f["custom_text[submit][message]"] = `${pedido.entrega.nome} — ${pedido.entrega.sub}.`.slice(0, 1000);
  }
  const meta = { guileo: "loja", client_email: loja.email, slug: loja.slug, entrega: pedido.entrega.id, itens: metaDosItens(pedido.linhas) };
  for (const [k, v] of Object.entries(meta)) {
    f[`metadata[${k}]`] = v;
    f[`payment_intent_data[metadata][${k}]`] = v;   // o estorno chega como charge: precisa da etiqueta também
  }
  return f;
}

/* O MESMO Checkout, aberto na conta Stripe PRÓPRIA do negócio (chave restrita, stripe_own).
   Diferenças, e só elas: sem campos de destino da plataforma (o dinheiro já nasce na conta dele);
   etiqueta via=stripe_own (a volta e a conferência só entregam sessão com ela); a volta passa por
   /api/venda-paga?loja=<slug>, que confere a sessão no Stripe do negócio, registra o pedido e manda a
   cliente de volta para a vitrine — o webhook da plataforma nunca fica sabendo desta sessão.
   `origem` = https://<host da vitrine> (guileoai.com ou o domínio do cliente). */
export function camposDaLojaPropria({ loja, pedido, voltar, origem, agora = Date.now() }) {
  const f = camposDoCheckout({ loja, pedido, voltar });
  f.success_url = `${origem}/api/venda-paga?loja=${encodeURIComponent(loja.slug)}&s={CHECKOUT_SESSION_ID}`;
  f.expires_at = String(Math.floor(agora / 1000) + 23 * 3600);   // 23h (o máximo do Stripe é 24h)
  f["metadata[via]"] = "stripe_own";
  f["payment_intent_data[metadata][via]"] = "stripe_own";
  return f;
}

/* ── DEPOIS DO PAGAMENTO (stripe-webhook.js) ──────────────────────────────────────────────────── */

/* A chave de cada venda no banco: "<payment_intent>:<produto>". O payment_intent é o que o ESTORNO
   traz (charge.payment_intent), então o estorno acha exatamente as vendas daquele pagamento
   (db/loja.sql · product_sale_refund_loja). Sessão sem payment_intent cai no id da sessão. */
export const refDaVenda = (sessao, produtoId) => `${(sessao && (sessao.payment_intent || sessao.id)) || "sem-ref"}:${produtoId}`;

const ROTULO_ENTREGA = { astoria: "Pickup · Astoria", ues: "Pickup · Upper East Side", envio: "Ship to customer" };
export const rotuloDaEntrega = (id) => ROTULO_ENTREGA[id] || String(id || "");

/* Endereço de envio do Stripe → uma linha. */
export function enderecoEmLinha(a) {
  if (!a || typeof a !== "object") return "";
  return [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(", "), a.postal_code].map((x) => String(x || "").trim()).filter(Boolean).join(" · ");
}

/* O que o salão lê no WhatsApp/SMS e no e-mail quando entra um pedido. Sem nada inventado: o que
   não veio fica de fora. `itens` = [{ nome, qtd }]. */
export function textoDoPedido({ cliente = "", itens = [], entrega = "", endereco = "", cents = 0 } = {}) {
  const lista = itens.map((i) => `${i.qtd}× ${i.nome || "item"}`).join(", ");
  const partes = [cliente, lista, rotuloDaEntrega(entrega), endereco, cents ? `$${(cents / 100).toFixed(2)}` : ""].filter(Boolean);
  return {
    texto: `🛍️ Guileo: new store order — ${partes.join(" · ")}. guileoai.com/portal`.slice(0, 300),
    detalhes: [lista, rotuloDaEntrega(entrega), endereco].filter(Boolean).join(" — "),
  };
}
