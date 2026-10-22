// node --test functions/lib/valePlataformaWebhook.test.mjs
// O ramo guileo:"giftcard" do functions/api/stripe-webhook.js (vale vendido pela PLATAFORMA), com
// assinatura Stripe de verdade (HMAC) e banco / Resend SIMULADOS: nenhuma chamada sai da máquina.
// A lei: o e-mail do vale sai SÓ quando giftcard_platform_fulfill_svc diz already:false; "enviado" só com
// id do Resend; qualquer falha vira linha "NÃO enviado — mandar o código à mão" no feed do dono.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../api/stripe-webhook.js";

const SEGREDO = "whsec_teste";
const T = "e2e-test@guileoai.com";
const ENV = { STRIPE_WEBHOOK_SECRET: SEGREDO, INGEST_SECRET: "s", SCHED_SECRET: "c", SUPABASE_SERVICE_ROLE: "svc", RESEND_API_KEY: "re_x" };
let env = ENV;
let chamadas = [];
let visto = true;                     // mark_webhook_seen: true = primeira entrega
let fulfill = () => ({ ok: true, already: false, result: { code: "GCPLAT1234", cents: 5000, gift_card_id: "g-1" } });
let resend = () => [200, { id: "re_msg_1" }];

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  let body = null;
  try { body = init.body ? JSON.parse(init.body) : null; } catch { body = init.body; }
  chamadas.push({ u, body });
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
  if (u.endsWith("/rpc/mark_webhook_seen")) return resp(visto);
  if (u.endsWith("/rpc/giftcard_platform_fulfill_svc")) return resp(fulfill(body));
  if (u.endsWith("/rpc/ingest_client_event")) return resp("evt-1");
  if (u.startsWith("https://api.resend.com/")) { const [st, j] = resend(body); return resp(j, st); }
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

const evento = (meta = {}, extra = {}) => ({
  id: "evt_vale_1", type: "checkout.session.completed",
  data: { object: {
    id: "cs_test_valeplat0001", object: "checkout.session", payment_intent: "pi_test_v1", payment_status: "paid", currency: "usd", amount_total: 5000,
    customer_details: { email: "Ana@Cliente.com", name: "Ana" },
    metadata: { guileo: "giftcard", client_email: T, amount_cents: "5000", recipient_contact: "bia@amiga.com", purchaser_contact: "ana@cliente.com", recipient_name: "Bia", gift_message: "Feliz aniversário", ...meta },
    ...extra,
  } },
});
const de = (fim) => chamadas.filter((c) => c.u.endsWith(fim));
const emails = () => chamadas.filter((c) => c.u.startsWith("https://api.resend.com/"));
const feedDoVale = () => de("/rpc/ingest_client_event").map((c) => c.body).filter((b) => b.p_payload?.kind === "giftcard_email");
const falhas = () => de("/rpc/ingest_client_event").map((c) => c.body).filter((b) => b.p_payload?.failure_type || /fulfill failed/.test(b.p_summary || ""));

beforeEach(() => {
  chamadas = []; env = ENV; visto = true;
  fulfill = () => ({ ok: true, already: false, result: { code: "GCPLAT1234", cents: 5000, gift_card_id: "g-1" } });
  let n = 0; resend = () => [200, { id: `re_msg_${++n}` }];
});

test("vale novo: nasce pela trava por sessão (valor PAGO) e o código sai por e-mail a quem ganhou e a quem comprou", async () => {
  const j = await (await onRequestPost({ env, request: await assinado(evento()) })).json();
  assert.equal(j.recurring, "giftcard");
  assert.deepEqual(j.email, { sent: 2, failed: 0 });
  const f = de("/rpc/giftcard_platform_fulfill_svc").map((c) => c.body);
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].p_tenant, f[0].p_session, f[0].p_cents, f[0].p_recipient], [T, "cs_test_valeplat0001", 5000, "bia@amiga.com"]);
  assert.equal(de("/rpc/giftcard_create").length, 0, "o vale não nasce mais fora da trava");
  const e = emails().map((c) => c.body);
  assert.deepEqual(e.map((x) => x.to), ["bia@amiga.com", "ana@cliente.com"]);
  assert.ok(e.every((x) => String(x.html).includes("GCPLAT1234")), "o código está no e-mail");
  assert.ok(e.every((x) => x.reply_to === T));
  const fd = feedDoVale();
  assert.equal(fd.length, 2);
  assert.ok(fd.every((b) => b.p_payload.delivery === "sent" && /^re_msg_/.test(b.p_payload.receipt) && b.p_email === T));
  assert.equal(falhas().length, 0);
});

test("mesma sessão de novo (outro evento, banco diz already:true) → nenhum e-mail", async () => {
  fulfill = () => ({ ok: true, already: true, result: { code: "GCPLAT1234", cents: 5000 } });
  const j = await (await onRequestPost({ env, request: await assinado({ ...evento(), id: "evt_vale_2", type: "checkout.session.async_payment_succeeded" }) })).json();
  assert.equal(j.recurring, "giftcard"); assert.equal(j.email, undefined);
  assert.equal(emails().length, 0); assert.equal(feedDoVale().length, 0);
});

test("retentativa do mesmo evento (mark_webhook_seen=false) → nem vale nem e-mail", async () => {
  visto = false;
  const j = await (await onRequestPost({ env, request: await assinado(evento()) })).json();
  assert.equal(j.duplicate, true);
  assert.equal(de("/rpc/giftcard_platform_fulfill_svc").length, 0); assert.equal(emails().length, 0);
});

test("Resend recusa → 'NÃO enviado — mandar o código à mão' com o código; não vira 'fulfill failed'", async () => {
  resend = () => [500, { message: "boom" }];
  const j = await (await onRequestPost({ env, request: await assinado(evento()) })).json();
  assert.deepEqual(j.email, { sent: 0, failed: 2 });
  const fd = feedDoVale();
  assert.equal(fd.length, 2);
  assert.ok(fd.every((b) => b.p_payload.delivery === "failed" && b.p_payload.code === "GCPLAT1234" && /NÃO enviado/.test(b.p_summary) && /à mão/.test(b.p_summary)));
  assert.equal(falhas().length, 0);
});

test("Resend responde 200 SEM id → não é 'enviado'", async () => {
  resend = () => [200, {}];
  const j = await (await onRequestPost({ env, request: await assinado(evento()) })).json();
  assert.deepEqual(j.email, { sent: 0, failed: 2 });
  assert.ok(feedDoVale().every((b) => b.p_payload.delivery === "failed"));
});

test("ninguém deixou e-mail → uma linha 'NÃO enviado' com o código, sem chamar o Resend", async () => {
  const ev = evento({ recipient_contact: "+17185550100", purchaser_contact: "" }, { customer_details: { name: "Ana" } });
  const j = await (await onRequestPost({ env, request: await assinado(ev) })).json();
  assert.deepEqual(j.email, { sent: 0, failed: 1 });
  assert.equal(emails().length, 0);
  const fd = feedDoVale();
  assert.equal(fd.length, 1); assert.equal(fd[0].p_payload.reason, "sem_email"); assert.equal(fd[0].p_payload.code, "GCPLAT1234");
});

test("o vale não nasceu (banco recusou) → alarme recurring_fulfill_failed e nenhum e-mail", async () => {
  fulfill = () => ({ ok: false, reason: "amount_missing" });
  const j = await (await onRequestPost({ env, request: await assinado(evento()) })).json();
  assert.equal(j.recurring, "giftcard"); assert.equal(j.email, undefined);
  assert.equal(emails().length, 0);
  assert.ok(de("/rpc/ingest_client_event").some((c) => /giftcard paid \$50\.00 but fulfill failed/.test(c.body.p_summary || "")));
});

test("pacote continua no caminho de antes (sem trava de vale, sem e-mail de vale)", async () => {
  const ev = evento({ guileo: "package", id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", sessions: "5" });
  const j = await (await onRequestPost({ env, request: await assinado(ev) })).json();
  assert.equal(j.recurring, "package"); assert.equal(j.email, undefined);
  assert.equal(de("/rpc/package_purchase_record").length, 1);
  assert.equal(de("/rpc/giftcard_platform_fulfill_svc").length, 0); assert.equal(emails().length, 0);
});
