// node --test functions/lib/lojaWebhook.test.mjs
// O ramo guileo:"loja" do functions/api/stripe-webhook.js, com assinatura Stripe de verdade (HMAC) e
// banco SIMULADO: nenhuma chamada sai da máquina.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../api/stripe-webhook.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const SEGREDO = "whsec_teste";
const ENV = { STRIPE_WEBHOOK_SECRET: SEGREDO, INGEST_SECRET: "s", SCHED_SECRET: "c", SUPABASE_SERVICE_ROLE: "svc", RESEND_API_KEY: "re_x" };
let env = ENV;
let emailOk = true;
let estorno = () => ({ ok: true, cancelled: 2, restocked_units: 3 });
let chamadas = [];
let respostaVenda = () => ({ ok: true, duplicate: false });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  let body = null;
  try { body = init.body ? JSON.parse(init.body) : null; } catch { body = init.body; }
  chamadas.push({ u, body });
  const resp = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.endsWith("/rpc/mark_webhook_seen")) return resp(true);
  if (u.endsWith("/rpc/product_sale_record")) return resp(respostaVenda(body));
  if (u.endsWith("/rpc/product_sale_refund_loja")) return resp(estorno(body));
  if (u.endsWith("/rpc/client_notify_phone_lookup")) return resp("");
  if (u.startsWith("https://api.resend.com/")) return new Response("{}", { status: emailOk ? 200 : 500 });
  return resp({});
};

async function assinado(evento) {
  const payload = JSON.stringify(evento);
  const t = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SEGREDO), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const v1 = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new Request("https://guileoai.com/api/stripe-webhook", { method: "POST", headers: { "Stripe-Signature": `t=${t},v1=${v1}` }, body: payload });
}

const evento = (extra = {}) => ({
  id: "evt_1", type: "checkout.session.completed",
  data: { object: {
    id: "cs_test_1", object: "checkout.session", payment_intent: "pi_test_1", payment_status: "paid", currency: "usd", amount_total: 13100,
    customer_details: { email: "maria@example.com", name: "Maria Silva", phone: "+17185550100" },
    metadata: { guileo: "loja", client_email: "naturaspaadm@gmail.com", slug: "natura-spa", entrega: "astoria", itens: `${A}:2,${B}:1` },
    ...extra,
  } },
});

beforeEach(() => { chamadas = []; env = ENV; emailOk = true; respostaVenda = (b) => ({ ok: true, duplicate: false, name: b.p_product_id === A ? "Hand Cream" : "Ritual Set" }); estorno = () => ({ ok: true, cancelled: 2, restocked_units: 3 }); });

test("pedido pago: uma venda PAGA por item, ref sessão:produto, receita do salão", async () => {
  const r = await onRequestPost({ env, request: await assinado(evento()) });
  const j = await r.json();
  assert.equal(j.loja, true);
  assert.equal(j.problemas, 0);
  const vendas = chamadas.filter((c) => c.u.endsWith("/rpc/product_sale_record")).map((c) => c.body);
  assert.deepEqual(vendas.map((v) => [v.p_product_id, v.p_qty, v.p_ref, v.p_status, v.p_source, v.p_email]), [
    [A, 2, `pi_test_1:${A}`, "paid", "loja", "naturaspaadm@gmail.com"],
    [B, 1, `pi_test_1:${B}`, "paid", "loja", "naturaspaadm@gmail.com"],
  ]);
  const receita = chamadas.find((c) => c.u.endsWith("/rpc/revenue_record"));
  assert.equal(receita.body.p_category, "loja");
  assert.equal(receita.body.p_email, "naturaspaadm@gmail.com");     // do salão, nunca de quem pagou
  assert.equal(receita.body.p_amount_cents, 13100);
});

test("esgotou entre a sacola e o pagamento: registra o resto e AVISA", async () => {
  respostaVenda = (b) => (b.p_product_id === B ? { ok: false, reason: "out_of_stock", stock: 0 } : { ok: true });
  const j = await (await onRequestPost({ env, request: await assinado(evento()) })).json();
  assert.equal(j.problemas, 1);
  const feed = chamadas.filter((c) => c.u.endsWith("/rpc/ingest_client_event")).map((c) => JSON.stringify(c.body));
  assert.ok(feed.some((s) => s.includes("loja_pago_sem_registro") || s.includes("out_of_stock")));
});

test("pagamento ainda não compensado: não registra nada", async () => {
  const j = await (await onRequestPost({ env, request: await assinado(evento({ payment_status: "unpaid" })) })).json();
  assert.ok(j.deferred);
  assert.equal(chamadas.filter((c) => c.u.endsWith("/rpc/product_sale_record")).length, 0);
});

test("assinatura falsa não entra", async () => {
  const req = new Request("https://guileoai.com/api/stripe-webhook", { method: "POST", headers: { "Stripe-Signature": "t=1,v1=00" }, body: JSON.stringify(evento()) });
  assert.equal((await onRequestPost({ env, request: req })).status, 401);
  assert.equal(chamadas.length, 0);
});

test("o salão recebe o e-mail do pedido, com itens e retirada", async () => {
  await onRequestPost({ env, request: await assinado(evento()) });
  const mail = chamadas.find((c) => c.u.startsWith("https://api.resend.com/"));
  assert.ok(mail, "e-mail saiu");
  assert.equal(mail.body.to, "naturaspaadm@gmail.com");
  assert.match(mail.body.subject, /store order/i);
  assert.match(mail.body.html, /2× Hand Cream/);
  assert.match(mail.body.html, /Pickup · Astoria/);
});

test("ninguém foi avisado (e-mail falhou, sem telefone): vira problema e alarma", async () => {
  emailOk = false;
  const j = await (await onRequestPost({ env, request: await assinado(evento()) })).json();
  assert.equal(j.problemas, 1);
});

const estornoEv = (extra = {}) => ({
  id: "evt_r1", type: "charge.refunded",
  data: { object: { id: "ch_1", object: "charge", payment_intent: "pi_test_1", amount: 13100, amount_refunded: 13100, refunded: true,
    metadata: { guileo: "loja", client_email: "naturaspaadm@gmail.com", slug: "natura-spa", entrega: "astoria", itens: `${A}:2,${B}:1` }, ...extra } },
});

test("estorno total: devolve as peças daquele pagamento ao estoque", async () => {
  const j = await (await onRequestPost({ env, request: await assinado(estornoEv()) })).json();
  assert.equal(j.loja, true);
  assert.match(j.estoque, /^devolvido/);
  const c = chamadas.find((x) => x.u.endsWith("/rpc/product_sale_refund_loja"));
  assert.equal(c.body.p_ref_prefix, "pi_test_1:");
  assert.equal(c.body.p_email, "naturaspaadm@gmail.com");
});

test("estorno parcial: não mexe no estoque e avisa para conferir", async () => {
  const j = await (await onRequestPost({ env, request: await assinado(estornoEv({ amount_refunded: 1800, refunded: false })) })).json();
  assert.equal(j.estoque, "parcial");
  assert.equal(chamadas.filter((x) => x.u.endsWith("/rpc/product_sale_refund_loja")).length, 0);
});

test("estorno total com a função ainda não colada no banco: avisa para devolver à mão", async () => {
  estorno = () => ({ code: "PGRST202", message: "not found" });
  const j = await (await onRequestPost({ env, request: await assinado(estornoEv()) })).json();
  assert.match(j.estoque, /^falhou/);
});

test("assinatura: RENOVAÇÃO na API nova (dados em parent.subscription_details) é reconhecida, com o id da assinatura", async () => {
  const fatura = {
    id: "evt_ren_1", type: "invoice.paid",
    data: { object: {
      id: "in_test_2", object: "invoice", billing_reason: "subscription_cycle", currency: "usd", amount_paid: 9900, customer_email: "maria@example.com",
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_test_9", metadata: { guileo: "membership", client_email: "naturaspaadm@gmail.com", id: A } } },
    } },
  };
  const j = await (await onRequestPost({ env, request: await assinado(fatura) })).json();
  assert.equal(j.recurring, "membership");
  const reg = chamadas.find((c) => c.u.endsWith("/rpc/membership_subscriber_record"));
  assert.ok(reg, "a renovação precisa registrar");
  assert.equal(reg.body.p_stripe_sub_id, "sub_test_9");          // não o id da fatura (viraria outro assinante)
  assert.equal(reg.body.p_client_email, "naturaspaadm@gmail.com");
});
