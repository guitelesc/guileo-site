// node --test functions/lib/lojaCheckout.test.mjs
// Roda o endpoint de verdade (functions/api/loja-checkout.js) com banco e Stripe SIMULADOS: nenhuma
// chamada sai da máquina e nada é cobrado.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { LOJA } from "../../src/novo/naturaStoreCatalogo.js";
import { onRequestPost } from "../api/loja-checkout.js";
import { onRequestGet as vendaPaga } from "../api/venda-paga.js";

const A = "11111111-1111-4111-8111-111111111111";
const ENV = { STRIPE_SECRET_KEY: "sk_test_x", INGEST_SECRET: "s", SUPABASE_SERVICE_ROLE: "svc" };
let chamadas = [];
let stripeConta = { account_id: "acct_1234567890AB", charges_enabled: true };
let propria = null;                    // chave restrita PRÓPRIA do negócio (stripe_own_lookup_svc)
let fusos = ["America/New_York"];      // o país do negócio sai daqui quando não há chave nem conta
let sessaoLida = null;                 // o que o GET /checkout/sessions/<id> devolve (volta /api/venda-paga)
const KEY = "rk_live_NEGOCIO1234567890abcdef";

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  chamadas.push({ u, body: init.body, headers: init.headers || {} });
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
  if (u.endsWith("/rpc/stripe_own_lookup_svc")) return resp(propria);
  if (u.endsWith("/rpc/biz_tenant_fusos")) return resp({ ok: true, fusos });
  if (u.endsWith("/rpc/get_client_profile")) return resp({});
  if (u.endsWith("/rpc/loja_online_session_add_svc")) return resp({ ok: true });
  if (u.endsWith("/rpc/client_stripe_lookup")) return resp(stripeConta);
  if (u.endsWith("/rpc/product_list")) return resp([{ id: A, name: "Hand Cream", price_cents: 1800, stock: null, active: true }]);
  if (u.endsWith("/rpc/loja_online_fulfill_svc")) return resp({ ok: true, already: false, kind: "loja", result: { kind: "loja", itens: [{ id: A, qtd: 2, ok: true, name: "Hand Cream" }], revenue: { ok: true }, problemas: 0 } });
  if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/") && (init.method || "GET") === "GET") return resp(sessaoLida);
  if (u.startsWith("https://api.stripe.com/v1/checkout/sessions")) return resp({ id: "cs_test_a1B2c3D4e5F6", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
  return resp({});   // feed de falhas, avisos: aceita e segue
};

const pedir = (corpo, origem = "https://guileoai.com") => onRequestPost({
  env: ENV,
  request: new Request("https://guileoai.com/api/loja-checkout", { method: "POST", headers: { "Content-Type": "application/json", ...(origem ? { Origin: origem } : {}) }, body: JSON.stringify(corpo) }),
});
const ok = { slug: "natura-spa", entrega: "envio", itens: [{ id: A, qtd: 2, preco: 1 }] };

beforeEach(() => { chamadas = []; LOJA.aoVivo = false; stripeConta = { account_id: "acct_1234567890AB", charges_enabled: true }; propria = null; fusos = ["America/New_York"]; });
const doStripe = () => chamadas.filter((c) => c.u.includes("stripe.com"));

test("loja desligada: recusa sem tocar banco nem Stripe", async () => {
  const r = await pedir(ok);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, "fechada");
  assert.equal(chamadas.filter((c) => /product_list|stripe\.com/.test(c.u)).length, 0);
});

test("chamada de fora da vitrine não passa", async () => {
  LOJA.aoVivo = true;
  assert.equal((await pedir(ok, "https://evil.example")).status, 403);
  assert.equal((await pedir(ok, null)).status, 403);
});

test("negócio BR sem conta Stripe conectada: não vende (a recusa de sempre)", async () => {
  LOJA.aoVivo = true;
  stripeConta = { account_id: "", charges_enabled: false };
  fusos = ["America/Sao_Paulo"];
  const r = await pedir(ok);
  const j = await r.json();
  assert.equal(j.code, "sem_conta"); assert.equal(j.hint, undefined);
  assert.equal(doStripe().length, 0);
});

test("negócio dos EUA sem chave própria: payments_not_connected com a dica guileoai.com/receber, ZERO Stripe", async () => {
  LOJA.aoVivo = true;
  stripeConta = { account_id: "", charges_enabled: false };
  const r = await pedir(ok);
  const j = await r.json();
  assert.equal(r.status, 503);
  assert.equal(j.ok, false); assert.equal(j.code, "payments_not_connected"); assert.equal(j.reason, "payments_not_connected");
  assert.equal(j.hint, "use_own_stripe"); assert.equal(j.connect_url, "https://guileoai.com/receber");
  assert.match(j.error, /Nothing was charged/);          // a frase que a cliente lê na sacola
  assert.equal(doStripe().length, 0);
  assert.equal(chamadas.filter((c) => c.u.endsWith("/rpc/product_list")).length, 0, "recusa antes de ler o catálogo");
});

test("chave própria: Checkout na conta DO NEGÓCIO, sem destino da plataforma, volta pela conferência", async () => {
  LOJA.aoVivo = true;
  propria = { secret_key: KEY };
  const r = await pedir(ok);
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.via, "stripe_own");
  const st = doStripe();
  assert.equal(st.length, 1);
  assert.equal(st[0].headers.Authorization, `Bearer ${KEY}`, "nunca a chave da plataforma");
  const f = new URLSearchParams(st[0].body);
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "1800");
  assert.equal(f.get("metadata[guileo]"), "loja"); assert.equal(f.get("metadata[via]"), "stripe_own");
  assert.equal(f.get("payment_intent_data[metadata][via]"), "stripe_own");
  assert.equal(f.get("metadata[client_email]"), "naturaspaadm@gmail.com");
  assert.equal(f.get("metadata[itens]"), `${A}:2`);
  assert.equal(f.get("success_url"), "https://guileoai.com/api/venda-paga?loja=natura-spa&s={CHECKOUT_SESSION_ID}");
  assert.equal(f.get("cancel_url"), "https://guileoai.com/novo/natura-spa?loja=cancelado#store");
  assert.ok(Number(f.get("expires_at")) > Date.now() / 1000);
  for (const k of f.keys()) assert.doesNotMatch(k, /transfer_data|on_behalf_of|application_fee/, `campo da plataforma na sessão própria: ${k}`);
  const reg = chamadas.find((c) => c.u.endsWith("/rpc/loja_online_session_add_svc"));
  assert.ok(reg, "registra a sessão para a conferência de hora em hora");
  const rb = JSON.parse(reg.body);
  assert.deepEqual([rb.p_tenant, rb.p_session, rb.p_cents, rb.p_itens], ["naturaspaadm@gmail.com", "cs_test_a1B2c3D4e5F6", 3600 + LOJA.freteCents, `${A}:2`]);
  assert.equal(chamadas.filter((c) => c.u.endsWith("/rpc/client_stripe_lookup")).length, 0, "com chave própria nem consulta a conta conectada");
});

test("chave própria no domínio do cliente: a volta fica no mesmo host", async () => {
  LOJA.aoVivo = true;
  propria = { secret_key: KEY };
  const r = await onRequestPost({ env: ENV, request: new Request("https://naturaspanyc.com/api/loja-checkout", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://naturaspanyc.com" }, body: JSON.stringify(ok) }) });
  assert.equal((await r.json()).ok, true);
  const f = new URLSearchParams(doStripe()[0].body);
  assert.equal(f.get("success_url"), "https://naturaspanyc.com/api/venda-paga?loja=natura-spa&s={CHECKOUT_SESSION_ID}");
  assert.equal(f.get("cancel_url"), "https://naturaspanyc.com/?loja=cancelado#store");
});

test("ligada: preço do banco, frete da regra, dinheiro para a conta do salão", async () => {
  LOJA.aoVivo = true;
  const r = await pedir(ok);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.match(j.url, /^https:\/\/checkout\.stripe\.com\//);
  const f = new URLSearchParams(chamadas.find((c) => c.u.includes("stripe.com")).body);
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "1800");       // não o "preco: 1" da página
  assert.equal(f.get("line_items[0][quantity]"), "2");
  assert.equal(f.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]"), String(LOJA.freteCents));
  assert.equal(f.get("payment_intent_data[transfer_data][destination]"), "acct_1234567890AB");
  assert.equal(f.get("metadata[itens]"), `${A}:2`);
  assert.equal(f.get("success_url"), "https://guileoai.com/novo/natura-spa?loja=ok#store");
});

test("ligada: id de exemplo da vitrine é recusado antes do banco", async () => {
  LOJA.aoVivo = true;
  const j = await (await pedir({ ...ok, itens: [{ id: "creme-maos", qtd: 1 }] })).json();
  assert.equal(j.code, "item_invalido");
  assert.equal(chamadas.filter((c) => /product_list|stripe\.com/.test(c.u)).length, 0);
});

test("volta da loja (/api/venda-paga?loja=natura-spa): confere no Stripe do negócio, registra e devolve à vitrine", async () => {
  propria = { secret_key: KEY };
  const S = "cs_test_a1B2c3D4e5F6";
  sessaoLida = { id: S, payment_status: "paid", amount_total: 4495, payment_intent: "pi_3Volta12345678", customer_details: { email: "maria@cliente.com", name: "Maria" },
    metadata: { guileo: "loja", via: "stripe_own", client_email: "naturaspaadm@gmail.com", slug: "natura-spa", entrega: "astoria", itens: `${A}:2` } };
  const r = await vendaPaga({ env: ENV, request: new Request(`https://guileoai.com/api/venda-paga?loja=natura-spa&s=${S}`) });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("Location"), "https://guileoai.com/novo/natura-spa?loja=ok#store");
  const leu = chamadas.find((c) => c.u === `https://api.stripe.com/v1/checkout/sessions/${S}`);
  assert.equal(leu.headers.Authorization, `Bearer ${KEY}`);
  const f = JSON.parse(chamadas.find((c) => c.u.endsWith("/rpc/loja_online_fulfill_svc")).body);
  assert.equal(f.p_tenant, "naturaspaadm@gmail.com"); assert.equal(f.p_ref_base, "pi_3Volta12345678"); assert.deepEqual(f.p_itens, [{ id: A, qtd: 2 }]);
  // não pago → "confirmando", nada registrado
  chamadas = []; sessaoLida = { ...sessaoLida, payment_status: "unpaid" };
  const r2 = await vendaPaga({ env: ENV, request: new Request(`https://guileoai.com/api/venda-paga?loja=natura-spa&s=${S}`) });
  assert.equal(r2.headers.get("Location"), "https://guileoai.com/novo/natura-spa?loja=confirmando#store");
  assert.equal(chamadas.filter((c) => c.u.endsWith("/rpc/loja_online_fulfill_svc")).length, 0);
  // loja que não existe → página comum (não redireciona para lugar nenhum)
  const r3 = await vendaPaga({ env: ENV, request: new Request(`https://guileoai.com/api/venda-paga?loja=evil.com&s=${S}`) });
  assert.equal(r3.status, 200); assert.equal(r3.headers.get("Location"), null);
});
