// node --test functions/lib/lojaCatalogo.test.mjs
// GET /api/loja-catalogo com o banco SIMULADO.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, prateleira } from "../api/loja-catalogo.js";

let banco = [];
let falhar = false;
let pedidos = [];
globalThis.fetch = async (url, init = {}) => {
  pedidos.push({ u: String(url), body: init.body ? JSON.parse(init.body) : null });
  if (falhar) return new Response("boom", { status: 500 });
  return new Response(JSON.stringify(banco), { status: 200, headers: { "Content-Type": "application/json" } });
};
const ler = (slug) => onRequestGet({ env: { INGEST_SECRET: "s", SUPABASE_SERVICE_ROLE: "svc" }, request: new Request(`https://guileoai.com/api/loja-catalogo?slug=${slug}`) });

beforeEach(() => { banco = []; falhar = false; pedidos = []; });

test("prateleira: só ativo e com preço; estoque exato não sai", () => {
  const p = prateleira([
    { id: "a", name: "Cream", price_cents: 1800, stock: 250, active: true, client_email: "x@y.com", location_id: "z" },
    { id: "b", name: "Consulta", price_cents: 0, stock: null, active: true },
    { id: "c", name: "Velho", price_cents: 900, stock: null, active: false },
    { id: "d", name: "Acabou", price_cents: 900, stock: 0, active: true },
  ], 10);
  assert.deepEqual(p.map((x) => [x.id, x.stock]), [["a", 10], ["d", 0]]);
  assert.equal("client_email" in p[0] || "location_id" in p[0], false);
});

test("lê o catálogo DO salão da vitrine pedida", async () => {
  banco = [{ id: "a", name: "Cream", brand: "Natura", description: "d", price_cents: 1800, stock: null, active: true }];
  const j = await (await ler("natura-spa")).json();
  assert.equal(j.ok, true);
  assert.equal(j.produtos.length, 1);
  assert.equal(pedidos[0].body.p_email, "naturaspaadm@gmail.com");
  assert.equal(pedidos[0].body.p_only_active, true);
});

test("vitrine sem loja: 404 sem tocar o banco", async () => {
  const r = await ler("outra");
  assert.equal(r.status, 404);
  assert.equal(pedidos.length, 0);
});

test("banco fora: 503, nunca lista vazia com 200", async () => {
  falhar = true;
  const r = await ler("natura-spa");
  assert.equal(r.status, 503);
  assert.equal((await r.json()).ok, false);
});
