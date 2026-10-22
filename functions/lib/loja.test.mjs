// node --test functions/lib/loja.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { lojaDe, lerItens, montarPedido, metaDosItens, itensDaMeta, camposDoCheckout, LINHAS_MAX } from "./loja.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const CATALOGO = [
  { id: A, name: "Hand Cream", price_cents: 1800, stock: null, active: true },
  { id: B, name: "Ritual Set", price_cents: 9500, stock: 2, active: true },
  { id: C, name: "Old Candle", price_cents: 3800, stock: null, active: false },
];
const loja = lojaDe("natura-spa");

test("só existe loja para vitrine cadastrada", () => {
  assert.ok(loja && loja.email.includes("@"));
  assert.equal(lojaDe("outra"), null);
  assert.equal(lojaDe("__proto__"), null);
});

test("itens: junta repetidos e recusa forma errada", () => {
  assert.deepEqual(lerItens([{ id: A, qtd: 1 }, { id: A, qtd: 2 }]).itens, [{ id: A, qtd: 3 }]);
  assert.equal(lerItens([]).code, "vazia");
  assert.equal(lerItens([{ id: "creme-maos", qtd: 1 }]).code, "item_invalido");   // id de exemplo da vitrine não vende
  assert.equal(lerItens([{ id: A, qtd: 0 }]).code, "item_invalido");
  assert.equal(lerItens([{ id: A, qtd: 6 }, { id: A, qtd: 6 }]).code, "item_invalido");   // passa do teto somado
  const muitos = Array.from({ length: LINHAS_MAX + 1 }, (_, i) => ({ id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`, qtd: 1 }));
  assert.equal(lerItens(muitos).code, "item_invalido");
});

test("pedido usa o PREÇO DO CATÁLOGO, nunca o da página", () => {
  const r = montarPedido({ loja, itens: [{ id: A, qtd: 2, preco: 1 }], entrega: "astoria", catalogo: CATALOGO });
  assert.equal(r.ok, true);
  assert.equal(r.subtotal, 3600);
  assert.equal(r.frete, 0);
  assert.equal(r.total, 3600);
});

test("pedido recusa inativo, desconhecido, sem estoque e entrega inventada", () => {
  assert.equal(montarPedido({ loja, itens: [{ id: C, qtd: 1 }], entrega: "astoria", catalogo: CATALOGO }).code, "item_invalido");
  assert.equal(montarPedido({ loja, itens: [{ id: B, qtd: 3 }], entrega: "astoria", catalogo: CATALOGO }).code, "esgotado");
  assert.equal(montarPedido({ loja, itens: [{ id: A, qtd: 1 }], entrega: "lua", catalogo: CATALOGO }).code, "entrega_invalida");
  assert.equal(montarPedido({ loja, itens: [{ id: A, qtd: 1 }], entrega: "astoria", catalogo: [] }).code, "item_invalido");
  assert.equal(montarPedido({ loja, itens: [{ id: B, qtd: 1 }], entrega: "astoria", catalogo: CATALOGO, tetoCents: 5000 }).code, "muito");
});

test("envio cobra frete abaixo do limite e libera acima", () => {
  const pouco = montarPedido({ loja, itens: [{ id: A, qtd: 1 }], entrega: "envio", catalogo: CATALOGO });
  assert.equal(pouco.frete, loja.config.freteCents);
  const muito = montarPedido({ loja, itens: [{ id: B, qtd: 1 }], entrega: "envio", catalogo: CATALOGO });
  assert.equal(muito.frete, 0);
});

test("metadado ida e volta; lixo é descartado", () => {
  const linhas = [{ id: A, qtd: 2 }, { id: B, qtd: 1 }];
  assert.deepEqual(itensDaMeta(metaDosItens(linhas)), linhas);
  assert.deepEqual(itensDaMeta("x:1,abc,:,"), []);
  assert.ok(metaDosItens(Array.from({ length: LINHAS_MAX }, () => ({ id: A, qtd: 10 }))).length <= 500);
});

test("checkout: etiqueta da venda nos dois lugares, endereço só no envio", () => {
  const ped = montarPedido({ loja, itens: [{ id: A, qtd: 1 }], entrega: "envio", catalogo: CATALOGO });
  const f = camposDoCheckout({ loja, pedido: ped, voltar: "https://guileoai.com/novo/natura-spa" });
  assert.equal(f["metadata[guileo]"], "loja");
  assert.equal(f["payment_intent_data[metadata][guileo]"], "loja");
  assert.equal(f["metadata[client_email]"], loja.email);
  assert.equal(f["line_items[0][price_data][unit_amount]"], "1800");
  assert.equal(f["shipping_address_collection[allowed_countries][0]"], "US");
  assert.equal(f.success_url, "https://guileoai.com/novo/natura-spa?loja=ok#store");
  const ret = camposDoCheckout({ loja, pedido: montarPedido({ loja, itens: [{ id: A, qtd: 1 }], entrega: "ues", catalogo: CATALOGO }), voltar: "https://x.test/" });
  assert.equal(ret["shipping_address_collection[allowed_countries][0]"], undefined);
  assert.match(ret["custom_text[submit][message]"], /842 Lexington/);
});

import { refDaVenda, textoDoPedido, enderecoEmLinha } from "./loja.js";
test("ref da venda usa o payment_intent (o estorno traz ele)", () => {
  assert.equal(refDaVenda({ id: "cs_1", payment_intent: "pi_9" }, A), `pi_9:${A}`);
  assert.equal(refDaVenda({ id: "cs_1" }, A), `cs_1:${A}`);
});
test("aviso do pedido: só o que veio, nada inventado", () => {
  const t = textoDoPedido({ cliente: "Maria", itens: [{ nome: "Hand Cream", qtd: 2 }], entrega: "astoria", cents: 3600 });
  assert.equal(t.texto, "🛍️ Guileo: new store order — Maria · 2× Hand Cream · Pickup · Astoria · $36.00. guileoai.com/portal");
  assert.equal(enderecoEmLinha({ line1: "1 Main St", city: "Albany", state: "NY", postal_code: "12207" }), "1 Main St · Albany, NY · 12207");
  assert.equal(enderecoEmLinha(null), "");
  assert.ok(textoDoPedido({ itens: Array.from({ length: 12 }, () => ({ nome: "Very long product name here", qtd: 10 })) }).texto.length <= 300);
});
