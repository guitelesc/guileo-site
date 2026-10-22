// node --test functions/lib/assinaturaSite.test.mjs
// Os endpoints da assinatura do site (functions/api/assinatura-*.js) com banco e Stripe SIMULADOS:
// nenhuma chamada sai da máquina e nada é cobrado.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ASSINATURA } from "../../src/novo/naturaAssinatura.js";
import { onRequestPost } from "../api/assinatura-checkout.js";
import { onRequestGet } from "../api/assinatura-planos.js";

const A = "11111111-1111-4111-8111-111111111111";
const ENV = { STRIPE_SECRET_KEY: "sk_test_plataforma", INGEST_SECRET: "s", SUPABASE_SERVICE_ROLE: "svc" };
let chamadas = [];
let chavePropria = "rk_test_doSalao123";
let planos = [];
let stripeConta = { account_id: "", charges_enabled: false };

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  chamadas.push({ u, body: init.body, auth: init.headers?.Authorization || "" });
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
  if (u.endsWith("/rpc/membership_list")) return resp(planos);
  if (u.endsWith("/rpc/stripe_own_lookup_svc")) return resp(chavePropria ? { secret_key: chavePropria } : {});
  if (u.endsWith("/rpc/client_stripe_lookup")) return resp(stripeConta);
  if (u.endsWith("/rpc/desk_stripe_session_add_svc")) return resp({ ok: true });
  if (u.startsWith("https://api.stripe.com/v1/checkout/sessions")) return resp({ id: "cs_test_abcdefghijkl", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
  return resp({});
};

const pedir = (corpo, origem = "https://guileoai.com") => onRequestPost({
  env: ENV,
  request: new Request("https://guileoai.com/api/assinatura-checkout", { method: "POST", headers: { "Content-Type": "application/json", ...(origem ? { Origin: origem } : {}) }, body: JSON.stringify(corpo) }),
});
const ok = { slug: "natura-spa", id: A, email: "Maria@Example.com", price_cents: 1 };
const stripeBody = () => new URLSearchParams(chamadas.find((c) => c.u.includes("stripe.com")).body);

beforeEach(() => {
  chamadas = []; ASSINATURA.aoVivo = false; chavePropria = "rk_test_doSalao123"; stripeConta = { account_id: "", charges_enabled: false };
  planos = [{ id: A, name: "Monthly Massage", price_cents: 9900, interval: "month", perks: "", active: true, subscribers: 3 }];
});

test("planos: público, sem número de assinantes, lido da conta adm do Natura", async () => {
  const r = await onRequestGet({ env: ENV, request: new Request("https://guileoai.com/api/assinatura-planos?slug=natura-spa") });
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.planos[0].name, "Monthly Massage");
  assert.equal("subscribers" in j.planos[0], false);
  assert.equal(JSON.parse(chamadas.find((c) => c.u.endsWith("/rpc/membership_list")).body).p_client_email, "naturaspaadm@gmail.com");
});

test("planos: banco fora do ar = 503, nunca lista vazia", async () => {
  planos = { ok: false };
  const r = await onRequestGet({ env: ENV, request: new Request("https://guileoai.com/api/assinatura-planos?slug=natura-spa") });
  assert.equal(r.status, 503);
});

test("desligada: recusa sem tocar banco nem Stripe", async () => {
  const r = await pedir(ok);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, "fechada");
  assert.equal(chamadas.filter((c) => /membership_list|stripe\.com/.test(c.u)).length, 0);
});

test("chamada de fora da página não passa", async () => {
  ASSINATURA.aoVivo = true;
  assert.equal((await pedir(ok, "https://evil.example")).status, 403);
  assert.equal((await pedir(ok, null)).status, 403);
});

test("sem e-mail válido / plano de exemplo: recusa antes do Stripe", async () => {
  ASSINATURA.aoVivo = true;
  assert.equal((await (await pedir({ ...ok, email: "x" })).json()).code, "email");
  assert.equal((await (await pedir({ ...ok, id: "ex-massage" })).json()).code, "plano");
  assert.equal(chamadas.filter((c) => c.u.includes("stripe.com")).length, 0);
});

test("Stripe PRÓPRIO do salão (o caminho do Natura): sessão na chave dele, preço do banco, etiqueta do balcão", async () => {
  ASSINATURA.aoVivo = true;
  const j = await (await pedir(ok)).json();
  assert.equal(j.ok, true);
  assert.equal(j.via, "stripe_own");
  const s = chamadas.find((c) => c.u.includes("stripe.com"));
  assert.equal(s.auth, "Bearer rk_test_doSalao123");                       // nunca a chave da plataforma
  const f = stripeBody();
  assert.equal(f.get("mode"), "subscription");
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "9900");  // não o price_cents:1 da página
  assert.equal(f.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal(f.get("subscription_data[metadata][guileo]"), "desk_membership");
  assert.equal(f.get("subscription_data[metadata][membership_id]"), A);
  assert.equal(f.get("customer_email"), "maria@example.com");
  assert.ok(chamadas.some((c) => c.u.endsWith("/rpc/desk_stripe_session_add_svc")), "a conferência de hora em hora precisa saber da sessão");
});

test("sem Stripe próprio e sem conta conectada: não vende", async () => {
  ASSINATURA.aoVivo = true;
  chavePropria = "";
  const j = await (await pedir(ok)).json();
  assert.equal(j.code, "sem_conta");
  assert.equal(chamadas.filter((c) => c.u.includes("stripe.com")).length, 0);
});

test("conta CONECTADA (negócio BR): cobrança de destino, etiqueta na sessão e na assinatura, volta ao site", async () => {
  ASSINATURA.aoVivo = true;
  chavePropria = "";
  stripeConta = { account_id: "acct_1234567890AB", charges_enabled: true };
  const j = await (await pedir(ok)).json();
  assert.equal(j.via, "plataforma");
  const f = stripeBody();
  assert.equal(f.get("subscription_data[metadata][guileo]"), "membership");
  assert.equal(f.get("subscription_data[metadata][id]"), A);
  assert.equal(f.get("metadata[client_email]"), "naturaspaadm@gmail.com");
  assert.equal(f.get("subscription_data[transfer_data][destination]"), "acct_1234567890AB");
  assert.equal(f.get("success_url"), "https://guileoai.com/novo/natura-spa?assinatura=ok#membership");
  assert.equal(f.get("allow_promotion_codes"), "false");
});
