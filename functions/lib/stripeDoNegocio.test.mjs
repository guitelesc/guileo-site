// Cartão salvo, taxa de falta e assinatura no Stripe DO NEGÓCIO: corpo exato do pedido ao Stripe e
// motivo honesto em cada falha. Nenhuma chamada real: fetch e banco são de mentira.
import test from "node:test";
import assert from "node:assert/strict";
import { motivoDoStripe, cobrarTaxaDeFalta, linkSalvarCartao, linkAssinatura, cancelamentoTardio, cobrarTaxaDeCancelamento, conferirAssinaturas, statusLocalDaAssinatura } from "./stripeDoNegocio.js";
import { conferirSessaoDoDesk } from "./sinalPago.js";
import { criarLinkDoSinal } from "./sinal.js";
import { acaoDePagamento } from "../api/desk-pagamentos.js";

const T = "e2e-test@guileoai.com";
const KEY = "rk_live_NEGOCIO1234567890abcdef";
const APPT = "11111111-2222-4333-8444-555555555555";
const MEM = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CARD = { customer: "cus_ABC123456", payment_method: "pm_ABC123456", brand: "visa", last4: "4242", livemode: true };
const INFO = { ok: true, id: APPT, status: "no_show", customer_name: "Maria", customer_contact: "+12125550199", service: "Deep Tissue", fee_cents: 5000, charged: false, card: CARD };

// banco de mentira: grava cada chamada
function banco(over = {}) {
  const chamadas = [];
  const svc = async (env, fn, a) => {
    chamadas.push({ fn, a });
    if (fn in over) return typeof over[fn] === "function" ? over[fn](a) : over[fn];
    if (fn === "stripe_own_lookup_svc") return { secret_key: KEY };
    if (fn === "desk_noshow_info_svc") return INFO;
    if (fn === "desk_card_get_svc") return { ok: true, card: null };
    if (fn === "desk_membership_list_svc") return [{ id: MEM, name: "Membership — 1 massage", price_cents: 9900, interval: "month" }];
    if (fn === "ingest_client_event") return "evt-1";
    return { ok: true };
  };
  return { svc, chamadas, de: (fn) => chamadas.filter((c) => c.fn === fn) };
}
// Stripe de mentira: rota por "MÉTODO caminho"
function stripeFalso(rotas) {
  const pedidos = [];
  const f = async (url, op = {}) => {
    const u = new URL(url); const metodo = op.method || "GET";
    pedidos.push({ metodo, caminho: u.pathname, busca: u.search, headers: op.headers || {}, corpo: op.body ? new URLSearchParams(op.body) : null });
    const chave = Object.keys(rotas).find((k) => { const [m, p] = k.split(" "); return m === metodo && u.pathname.startsWith(p); });
    const [status, data] = chave ? rotas[chave] : [404, { error: { message: "rota de teste ausente" } }];
    return { ok: status >= 200 && status < 300, status, json: async () => data };
  };
  return { f, pedidos };
}
const env = { INGEST_SECRET: "ing" };

test("motivoDoStripe: 401, 403 com a permissão exata, 402 recusado, resto", () => {
  assert.equal(motivoDoStripe(401, { error: { message: "Invalid API Key" } }).reason, "stripe_rejected_key");
  const p = motivoDoStripe(403, { error: { type: "invalid_request_error", message: "The provided key 'rk_live_…' does not have the required permissions for this endpoint on account 'acct_1'. Having the 'rak_payment_intent_write' permission would allow this request to continue." } });
  assert.equal(p.reason, "permission_missing"); assert.equal(p.permissao, "PaymentIntents: Write");
  const d = motivoDoStripe(402, { error: { type: "card_error", code: "card_declined", decline_code: "insufficient_funds", message: "Your card has insufficient funds." } });
  assert.deepEqual([d.reason, d.codigo, d.detail], ["card_declined", "insufficient_funds", "Your card has insufficient funds."]);
  assert.equal(motivoDoStripe(500, {}).reason, "stripe_error");
});

test("taxa de falta: sem chave do negócio → payments_not_connected, nada vai ao Stripe", async () => {
  const b = banco({ stripe_own_lookup_svc: null }); const s = stripeFalso({});
  const r = await cobrarTaxaDeFalta(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.reason, "payments_not_connected"); assert.equal(s.pedidos.length, 0); assert.equal(b.de("desk_noshow_fee_mark_svc").length, 0);
});

test("taxa de falta: sem taxa no cadastro, agendamento que não é falta, sem cartão, cartão de outro modo", async () => {
  const s = stripeFalso({});
  const casos = [
    [{ ...INFO, fee_cents: 0 }, "no_fee_configured"],
    [{ ...INFO, status: "booked" }, "not_no_show"],
    [{ ...INFO, card: null }, "no_saved_card"],
    [{ ...INFO, card: { ...CARD, livemode: false } }, "no_saved_card"],   // cartão salvo com rk_test_, chave agora é rk_live_
    [{ ok: false, reason: "not_found" }, "not_found"],
  ];
  for (const [info, motivo] of casos) {
    const b = banco({ desk_noshow_info_svc: info });
    assert.equal((await cobrarTaxaDeFalta(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f })).reason, motivo);
  }
  assert.equal(s.pedidos.length, 0);
});

test("taxa de falta: Stripe 200 → off_session no cartão salvo, idempotente, gravada e no feed", async () => {
  const b = banco(); const s = stripeFalso({ "POST /v1/payment_intents": [200, { id: "pi_OK1", status: "succeeded", amount: 5000 }] });
  const r = await cobrarTaxaDeFalta(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.ok, true); assert.equal(r.cents, 5000); assert.equal(r.payment_intent, "pi_OK1");
  const p = s.pedidos[0];
  assert.equal(p.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(p.headers["Idempotency-Key"], `desk-noshow-${APPT}-pm_ABC123456`);
  for (const [k, v] of [["amount", "5000"], ["currency", "usd"], ["customer", "cus_ABC123456"], ["payment_method", "pm_ABC123456"], ["off_session", "true"], ["confirm", "true"], ["metadata[guileo]", "desk_noshow_fee"], ["metadata[appointment_id]", APPT], ["metadata[client_email]", T]]) assert.equal(p.corpo.get(k), v, k);
  const marca = b.de("desk_noshow_fee_mark_svc"); assert.equal(marca.length, 1); assert.equal(marca[0].a.p_result.status, "paid");
  const ev = b.de("ingest_client_event"); assert.equal(ev.length, 1); assert.equal(ev[0].a.p_amount, 50); assert.match(ev[0].a.p_summary, /cobrada/);
});

test("taxa de falta: já cobrada → não vai ao Stripe de novo", async () => {
  const b = banco({ desk_noshow_info_svc: { ...INFO, charged: true, fee: { status: "paid", payment_intent: "pi_OLD", cents: 5000 } } }); const s = stripeFalso({});
  const r = await cobrarTaxaDeFalta(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.ok, true); assert.equal(r.already, true); assert.equal(r.payment_intent, "pi_OLD"); assert.equal(s.pedidos.length, 0);
});

test("taxa de falta: 402 cartão recusado → card_declined com a mensagem do banco, gravada como falha", async () => {
  const b = banco(); const s = stripeFalso({ "POST /v1/payment_intents": [402, { error: { type: "card_error", code: "card_declined", decline_code: "insufficient_funds", message: "Your card has insufficient funds.", payment_intent: { id: "pi_NO1", status: "requires_payment_method" } } }] });
  const r = await cobrarTaxaDeFalta(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.ok, false); assert.equal(r.reason, "card_declined"); assert.equal(r.detail, "Your card has insufficient funds.");
  const marca = b.de("desk_noshow_fee_mark_svc")[0].a.p_result;
  assert.deepEqual([marca.status, marca.reason, marca.payment_intent], ["failed", "card_declined", "pi_NO1"]);
  assert.match(b.de("ingest_client_event")[0].a.p_summary, /NÃO cobrada/);
});

test("taxa de falta: 403 chave sem permissão → permission_missing dizendo QUAL", async () => {
  const b = banco(); const s = stripeFalso({ "POST /v1/payment_intents": [403, { error: { message: "The provided key 'rk_live_x' does not have the required permissions for this endpoint on account 'acct_1'. Having the 'rak_payment_intent_write' permission would allow this request to continue." } }] });
  const r = await cobrarTaxaDeFalta(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.reason, "permission_missing"); assert.equal(r.permissao, "PaymentIntents: Write");
});

test("salvar cartão: sem cartão → cria o cliente e abre Checkout mode=setup no Stripe do negócio", async () => {
  const b = banco(); const s = stripeFalso({ "POST /v1/customers": [200, { id: "cus_NEW123456" }], "POST /v1/checkout/sessions": [200, { id: "cs_live_SETUP1234567", url: "https://checkout.stripe.com/c/pay/cs_live_SETUP1234567" }] });
  const r = await linkSalvarCartao(env, { tenant: T, contact: "maria@example.com", name: "Maria" }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.ok, true); assert.match(r.url, /checkout\.stripe\.com/);
  const [cus, ses] = s.pedidos;
  assert.equal(cus.caminho, "/v1/customers"); assert.equal(cus.corpo.get("email"), "maria@example.com"); assert.ok(cus.headers["Idempotency-Key"]);
  assert.equal(ses.headers.Authorization, `Bearer ${KEY}`);
  for (const [k, v] of [["mode", "setup"], ["customer", "cus_NEW123456"], ["payment_method_types[0]", "card"], ["metadata[guileo]", "desk_card_setup"], ["metadata[client_email]", T], ["setup_intent_data[metadata][contact]", "maria@example.com"]]) assert.equal(ses.corpo.get(k), v, k);
  assert.match(ses.corpo.get("success_url"), /\/api\/sinal-pago\?t=e2e-test%40guileoai\.com&s=\{CHECKOUT_SESSION_ID\}/);
  assert.equal(b.de("desk_stripe_session_add_svc")[0].a.p_kind, "card_setup");
});

test("salvar cartão: cliente já tem cartão → reaproveita o cliente; 403 em Customers diz a permissão; sem chave → inerte", async () => {
  let b = banco({ desk_card_get_svc: { ok: true, card: CARD } });
  let s = stripeFalso({ "POST /v1/checkout/sessions": [200, { id: "cs_live_SETUP1234567", url: "https://checkout.stripe.com/x" }] });
  await linkSalvarCartao(env, { tenant: T, contact: "+12125550199" }, { svcJson: b.svc, fetch: s.f });
  assert.equal(s.pedidos.length, 1); assert.equal(s.pedidos[0].corpo.get("customer"), "cus_ABC123456");
  b = banco(); s = stripeFalso({ "POST /v1/customers": [403, { error: { message: "… Having the 'rak_customer_write' permission would allow this request to continue." } }] });
  const r = await linkSalvarCartao(env, { tenant: T, contact: "+12125550199" }, { svcJson: b.svc, fetch: s.f });
  assert.deepEqual([r.reason, r.permissao], ["permission_missing", "Customers: Write"]);
  b = banco({ stripe_own_lookup_svc: { ok: false, erro_http: 401 } }); s = stripeFalso({});
  assert.equal((await linkSalvarCartao(env, { tenant: T, contact: "+12125550199" }, { svcJson: b.svc, fetch: s.f })).reason, "payments_not_connected");
  assert.equal((await linkSalvarCartao(env, { tenant: T, contact: "12" }, { svcJson: b.svc, fetch: s.f })).reason, "no_contact");
  assert.equal(s.pedidos.length, 0);
});

test("assinatura: Checkout mode=subscription com price_data mensal do cadastro", async () => {
  const b = banco(); const s = stripeFalso({ "POST /v1/checkout/sessions": [200, { id: "cs_live_SUB12345678", url: "https://checkout.stripe.com/s" }] });
  const r = await linkAssinatura(env, { tenant: T, membershipId: MEM, contact: "maria@example.com" }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.ok, true); assert.equal(r.cents, 9900);
  const c = s.pedidos[0].corpo;
  for (const [k, v] of [["mode", "subscription"], ["line_items[0][price_data][unit_amount]", "9900"], ["line_items[0][price_data][currency]", "usd"], ["line_items[0][price_data][recurring][interval]", "month"], ["metadata[guileo]", "desk_membership"], ["metadata[membership_id]", MEM], ["subscription_data[metadata][client_email]", T], ["customer_email", "maria@example.com"]]) assert.equal(c.get(k), v, k);
  assert.equal(b.de("desk_stripe_session_add_svc")[0].a.p_membership_id, MEM);
  assert.equal((await linkAssinatura(env, { tenant: T, membershipId: "outra", contact: "maria@example.com" }, { svcJson: b.svc, fetch: s.f })).reason, "membership_not_found");
  const sem = banco({ stripe_own_lookup_svc: null });
  assert.equal((await linkAssinatura(env, { tenant: T, membershipId: MEM, contact: "maria@example.com" }, { svcJson: sem.svc, fetch: s.f })).reason, "payments_not_connected");
});

test("sinal na conta própria: pede para salvar o cartão (e reaproveita o cliente já salvo)", async () => {
  const INFO_SINAL = { ok: true, id: APPT, customer_contact: "+12125550199", service: "Massage", deposit_cents: 3000, deposit_paid: false, trusted: false };
  for (const [salvo, esperado] of [[null, { customer_creation: "always", customer: null }], [{ ok: true, card: CARD }, { customer_creation: null, customer: "cus_ABC123456" }], [{ ok: true, card: { ...CARD, livemode: false } }, { customer_creation: "always", customer: null }]]) {
    const b = banco({ desk_deposit_info_svc: INFO_SINAL, desk_card_get_svc: salvo });
    const s = stripeFalso({ "POST /v1/checkout/sessions": [200, { id: "cs_live_DEP12345678", url: "https://checkout.stripe.com/d" }] });
    const r = await criarLinkDoSinal({}, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
    assert.equal(r.ok, true);
    const c = s.pedidos[0].corpo;
    assert.equal(c.get("payment_intent_data[setup_future_usage]"), "off_session");
    assert.equal(c.get("customer_creation"), esperado.customer_creation); assert.equal(c.get("customer"), esperado.customer);
  }
});

test("sinal: chave antiga (só Checkout) recusa salvar o cartão → o SINAL sai mesmo assim, sem o extra", async () => {
  const INFO_SINAL = { ok: true, id: APPT, customer_contact: "+12125550199", service: "Massage", deposit_cents: 3000, deposit_paid: false, trusted: false };
  const b = banco({ desk_deposit_info_svc: INFO_SINAL });
  const corpos = [];
  const f = async (url, op) => { const c = new URLSearchParams(op.body); corpos.push(c);
    return c.get("customer_creation") ? { ok: false, status: 403, json: async () => ({ error: { message: "... 'rak_customer_write' ..." } }) } : { ok: true, status: 200, json: async () => ({ id: "cs_live_DEP12345678", url: "https://checkout.stripe.com/d" }) }; };
  const r = await criarLinkDoSinal({}, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: f });
  assert.equal(r.ok, true); assert.equal(r.cartao, "permission_missing"); assert.equal(corpos.length, 2);
  assert.equal(corpos[1].get("payment_intent_data[setup_future_usage]"), null); assert.equal(corpos[1].get("line_items[0][price_data][unit_amount]"), "3000");
});

test("volta do sinal: marca pago E grava o cartão; sem permissão para ler o cartão o sinal continua pago", async () => {
  const sessao = { id: "cs_live_DEP12345678", amount_total: 3000, payment_status: "paid", status: "complete", payment_intent: "pi_DEP1", customer: "cus_DEP123456", metadata: { guileo: "desk_deposit", client_email: T, appointment_id: APPT } };
  let b = banco();
  let s = stripeFalso({ "GET /v1/checkout/sessions": [200, sessao], "GET /v1/payment_intents": [200, { id: "pi_DEP1", setup_future_usage: "off_session", customer: "cus_DEP123456", payment_method: { id: "pm_DEP123456", livemode: true, card: { brand: "mastercard", last4: "4444", exp_month: 1, exp_year: 2031 } } }] });
  let r = await conferirSessaoDoDesk({}, { tenant: T, sessionId: sessao.id }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.ok, true); assert.equal(r.cartao.saved, true);
  assert.match(s.pedidos[1].busca, /expand/);
  const card = b.de("desk_card_save_svc")[0].a;
  assert.deepEqual([card.p_appointment_id, card.p_card.customer, card.p_card.payment_method, card.p_card.last4, card.p_card.livemode, card.p_card.source], [APPT, "cus_DEP123456", "pm_DEP123456", "4444", true, "deposit"]);
  b = banco(); s = stripeFalso({ "GET /v1/checkout/sessions": [200, sessao], "GET /v1/payment_intents": [403, { error: { message: "rak_payment_intent_read" } }] });
  r = await conferirSessaoDoDesk({}, { tenant: T, sessionId: sessao.id }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.ok, true); assert.equal(b.de("desk_deposit_mark").length, 1); assert.equal(r.cartao.motivo, "permission_missing");
});

test("volta do 'Salvar cartão' e da assinatura: só grava o que o Stripe confirma", async () => {
  const setup = { id: "cs_live_SETUP1234567", status: "complete", setup_intent: "seti_1", customer: "cus_NEW123456", metadata: { guileo: "desk_card_setup", client_email: T, contact: "maria@example.com" } };
  let b = banco();
  let s = stripeFalso({ "GET /v1/checkout/sessions": [200, setup], "GET /v1/setup_intents": [200, { id: "seti_1", status: "succeeded", customer: "cus_NEW123456", payment_method: { id: "pm_NEW123456", livemode: true, card: { brand: "visa", last4: "1111" } } }] });
  let r = await conferirSessaoDoDesk({}, { tenant: T, sessionId: setup.id }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.kind, "card"); assert.equal(b.de("desk_card_save_svc")[0].a.p_contact, "maria@example.com"); assert.equal(b.de("desk_stripe_session_done_svc").length, 1);
  // sessão aberta (cliente não terminou) → nada gravado
  b = banco(); s = stripeFalso({ "GET /v1/checkout/sessions": [200, { ...setup, status: "open" }] });
  assert.equal((await conferirSessaoDoDesk({}, { tenant: T, sessionId: setup.id }, { svcJson: b.svc, fetch: s.f })).reason, "nao_pago");
  assert.equal(b.de("desk_card_save_svc").length, 0);
  // assinatura
  const sub = { id: "cs_live_SUB12345678", status: "complete", subscription: "sub_ABC123456", amount_total: 9900, customer: "cus_S123456", metadata: { guileo: "desk_membership", client_email: T, membership_id: MEM, contact: "maria@example.com" } };
  b = banco({ desk_membership_record_svc: { ok: true, id: "ms1", new: true } });
  s = stripeFalso({ "GET /v1/checkout/sessions": [200, sub], "GET /v1/subscriptions": [200, { id: "sub_ABC123456", status: "active", customer: "cus_S123456", default_payment_method: { id: "pm_S123456", livemode: true, card: { brand: "visa", last4: "2222" } } }] });
  r = await conferirSessaoDoDesk(env, { tenant: T, sessionId: sub.id }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.kind, "membership"); assert.equal(r.status, "active");
  const rec = b.de("desk_membership_record_svc")[0].a; assert.deepEqual([rec.p_membership_id, rec.p_sub_id, rec.p_contact], [MEM, "sub_ABC123456", "maria@example.com"]);
  assert.equal(b.de("desk_card_save_svc")[0].a.p_card.source, "membership");
  assert.equal(b.de("ingest_client_event").length, 1);
  // sessão de OUTRO negócio → recusa
  b = banco(); s = stripeFalso({ "GET /v1/checkout/sessions": [200, { ...sub, metadata: { ...sub.metadata, client_email: "outro@x.com" } }] });
  assert.equal((await conferirSessaoDoDesk(env, { tenant: T, sessionId: sub.id }, { svcJson: b.svc, fetch: s.f })).reason, "sessao_de_outro");
  assert.equal(b.de("desk_membership_record_svc").length, 0);
});

test("rota: cartao_status nunca devolve cus_/pm_ e diz se o cartão serve para a chave atual", async () => {
  const b = banco({ desk_card_get_svc: { ok: true, card: { ...CARD, exp_month: 12, exp_year: 2030, saved_at: "2026-10-05" } } });
  const r = await acaoDePagamento({}, T, { action: "cartao_status", contact: "+12125550199" }, { svcJson: b.svc });
  assert.equal(r.ok, true); assert.equal(r.connected, true); assert.equal(r.card.last4, "4242"); assert.equal(r.card.usable, true);
  assert.doesNotMatch(JSON.stringify(r), /cus_|pm_/);
  const sem = banco({ stripe_own_lookup_svc: null, desk_card_get_svc: { ok: true, card: null } });
  const r2 = await acaoDePagamento({}, T, { action: "cartao_status", contact: "+12125550199" }, { svcJson: sem.svc });
  assert.deepEqual([r2.connected, r2.card], [false, null]);
  assert.equal((await acaoDePagamento({}, T, { action: "cobrar_falta", id: "x" }, { svcJson: b.svc })).reason, "invalid");
});

// ═══ v6: CANCELAMENTO EM CIMA DA HORA ══════════════════════════════════════════════════════════
const INICIO = "2026-10-10T18:00:00.000Z";
const horasAntes = (h) => new Date(Date.parse(INICIO) - h * 3600000).toISOString();
const CANC = { ok: true, id: APPT, status: "cancelled", customer_name: "Maria", customer_contact: "+12125550199", service: "Deep Tissue", start: INICIO,
  window_h: 24, fee_cents: 5000, fee_from: "noshow_fee_cents", cancelled_at: horasAntes(5), cancelled_by: "balcao", charged: false, noshow_paid: false, card: CARD };

test("cancelamentoTardio: dentro da janela, fora, sem janela, depois do início, hora desconhecida, hold vencido, não cancelado", () => {
  assert.deepEqual(cancelamentoTardio(CANC), { late: true, why: null, horas_antes: 5, janela_h: 24 });
  assert.equal(cancelamentoTardio({ ...CANC, cancelled_at: horasAntes(30) }).why, "outside_window");
  assert.equal(cancelamentoTardio({ ...CANC, cancelled_at: horasAntes(24) }).why, "outside_window");    // exatamente na borda = no prazo
  assert.equal(cancelamentoTardio({ ...CANC, window_h: 0 }).why, "no_window");
  const depois = cancelamentoTardio({ ...CANC, cancelled_at: horasAntes(-1) });
  assert.deepEqual([depois.late, depois.horas_antes], [true, -1]);
  assert.equal(cancelamentoTardio({ ...CANC, cancelled_at: null }).why, "cancel_time_unknown");     // cancelado antes do gatilho existir
  assert.equal(cancelamentoTardio({ ...CANC, cancelled_by: "expirou" }).why, "expired_hold");
  assert.equal(cancelamentoTardio({ ...CANC, status: "no_show" }).why, "not_cancelled");
  assert.equal(cancelamentoTardio({ ...CANC, status: "canceled" }).late, true);
});

test("taxa de cancelamento: cada motivo honesto ANTES de ir ao Stripe", async () => {
  const s = stripeFalso({});
  const casos = [
    [{ ok: false, reason: "not_found" }, "not_found"],
    [{ ...CANC, status: "booked" }, "not_cancelled"],
    [{ ...CANC, cancelled_at: null }, "cancel_time_unknown"],
    [{ ...CANC, cancelled_at: horasAntes(48) }, "not_late_cancel"],
    [{ ...CANC, window_h: 0 }, "not_late_cancel"],
    [{ ...CANC, cancelled_by: "expirou" }, "not_late_cancel"],
    [{ ...CANC, noshow_paid: true }, "noshow_fee_charged"],
    [{ ...CANC, fee_cents: 0 }, "no_fee_configured"],
    [{ ...CANC, card: null }, "no_saved_card"],
    [{ ...CANC, card: { ...CARD, livemode: false } }, "no_saved_card"],
  ];
  for (const [info, motivo] of casos) {
    const b = banco({ desk_late_cancel_info_svc: info });
    const r = await cobrarTaxaDeCancelamento(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
    assert.equal(r.reason, motivo, JSON.stringify(info).slice(0, 80));
    assert.equal(b.de("desk_late_cancel_fee_mark_svc").length, 0);
  }
  const fora = await cobrarTaxaDeCancelamento(env, { tenant: T, appointmentId: APPT }, { svcJson: banco({ desk_late_cancel_info_svc: { ...CANC, cancelled_at: horasAntes(48) } }).svc, fetch: s.f });
  assert.deepEqual([fora.why, fora.horas_antes, fora.janela_h], ["outside_window", 48, 24]);
  assert.equal(s.pedidos.length, 0);
});

test("taxa de cancelamento: sem a chave do negócio → payments_not_connected, nada vai ao Stripe", async () => {
  const b = banco({ desk_late_cancel_info_svc: CANC, stripe_own_lookup_svc: null }); const s = stripeFalso({});
  const r = await cobrarTaxaDeCancelamento(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.reason, "payments_not_connected"); assert.equal(s.pedidos.length, 0);
});

test("taxa de cancelamento: Stripe 200 → off_session, idempotência própria (não colide com a de falta), gravada e no feed", async () => {
  const b = banco({ desk_late_cancel_info_svc: CANC }); const s = stripeFalso({ "POST /v1/payment_intents": [200, { id: "pi_LC1", status: "succeeded" }] });
  const r = await cobrarTaxaDeCancelamento(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.ok, true); assert.equal(r.cents, 5000); assert.equal(r.horas_antes, 5); assert.equal(r.fee_from, "noshow_fee_cents");
  const p = s.pedidos[0];
  assert.equal(p.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(p.headers["Idempotency-Key"], `desk-latecancel-${APPT}-pm_ABC123456`);
  for (const [k, v] of [["amount", "5000"], ["customer", "cus_ABC123456"], ["payment_method", "pm_ABC123456"], ["off_session", "true"], ["confirm", "true"], ["metadata[guileo]", "desk_late_cancel_fee"], ["metadata[appointment_id]", APPT]]) assert.equal(p.corpo.get(k), v, k);
  assert.match(p.corpo.get("description"), /^Late cancellation fee/);
  assert.equal(b.de("desk_late_cancel_fee_mark_svc")[0].a.p_result.status, "paid");
  assert.equal(b.de("desk_noshow_fee_mark_svc").length, 0);
  const ev = b.de("ingest_client_event")[0].a; assert.equal(ev.p_payload.kind, "late_cancel_fee"); assert.equal(ev.p_amount, 50);
});

test("taxa de cancelamento: já cobrada não cobra de novo; 402 e 403 viram motivo honesto gravado", async () => {
  let b = banco({ desk_late_cancel_info_svc: { ...CANC, charged: true, fee: { status: "paid", payment_intent: "pi_OLD", cents: 5000 } } }); let s = stripeFalso({});
  let r = await cobrarTaxaDeCancelamento(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.deepEqual([r.ok, r.already, r.payment_intent, s.pedidos.length], [true, true, "pi_OLD", 0]);
  b = banco({ desk_late_cancel_info_svc: CANC }); s = stripeFalso({ "POST /v1/payment_intents": [402, { error: { type: "card_error", code: "card_declined", message: "Your card was declined." } }] });
  r = await cobrarTaxaDeCancelamento(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.deepEqual([r.ok, r.reason, r.detail], [false, "card_declined", "Your card was declined."]);
  assert.equal(b.de("desk_late_cancel_fee_mark_svc")[0].a.p_result.status, "failed");
  assert.match(b.de("ingest_client_event")[0].a.p_summary, /NÃO cobrada/);
  b = banco({ desk_late_cancel_info_svc: CANC }); s = stripeFalso({ "POST /v1/payment_intents": [403, { error: { message: "… Having the 'rak_payment_intent_write' permission would allow this request to continue." } }] });
  r = await cobrarTaxaDeCancelamento(env, { tenant: T, appointmentId: APPT }, { svcJson: b.svc, fetch: s.f });
  assert.deepEqual([r.reason, r.permissao], ["permission_missing", "PaymentIntents: Write"]);
});

test("rota: cancelamento_info diz quando/quem/janela sem cus_/pm_; cobrar_cancelamento valida o id", async () => {
  const b = banco({ desk_late_cancel_info_svc: { ...CANC, fee: { status: "failed", reason: "card_declined", payment_intent: "pi_X" } } });
  const r = await acaoDePagamento({}, T, { action: "cancelamento_info", id: APPT }, { svcJson: b.svc });
  assert.equal(r.ok, true); assert.equal(r.late, true); assert.equal(r.horas_antes, 5); assert.equal(r.cancelled_by, "balcao");
  assert.equal(r.card.usable, true); assert.equal(r.fee.status, "failed"); assert.equal(r.fee_from, "noshow_fee_cents");
  assert.doesNotMatch(JSON.stringify(r), /cus_|pm_|pi_/);
  assert.equal((await acaoDePagamento({}, T, { action: "cancelamento_info", id: "x" }, { svcJson: b.svc })).reason, "invalid");
  assert.equal((await acaoDePagamento({}, T, { action: "cobrar_cancelamento", id: "x" }, { svcJson: b.svc })).reason, "invalid");
  const nf = banco({ desk_late_cancel_info_svc: { ok: false, reason: "not_found" } });
  assert.equal((await acaoDePagamento({}, T, { action: "cancelamento_info", id: APPT }, { svcJson: nf.svc })).reason, "not_found");
});

// ═══ v6: ASSINATURA EM DIA ═════════════════════════════════════════════════════════════════════
const LINHA = (n, over = {}) => ({ tenant: T, id: `ms-${n}`, sub: `sub_PROVA00${n}`, status: "active", contact: `c${n}@x.com`, membership: "Membership — 1 massage", last: null, ...over });
function bancoSync(linhas, over = {}) {
  const atual = Object.fromEntries(linhas.map((l) => [l.id, l.status]));
  return banco({ desk_membership_sync_list_svc: linhas,
    desk_membership_sync_mark_svc: (a) => { const old = atual[a.p_id]; const nw = a.p_status || old; atual[a.p_id] = nw; return { ok: true, changed: nw !== old, old, new: nw }; }, ...over });
}

test("statusLocalDaAssinatura: Stripe → active | past_due | canceled | paused", () => {
  for (const [s, l] of [["active", "active"], ["trialing", "active"], ["past_due", "past_due"], ["unpaid", "past_due"], ["incomplete", "past_due"], ["canceled", "canceled"], ["incomplete_expired", "canceled"], ["paused", "paused"], ["???", null]]) assert.equal(statusLocalDaAssinatura(s), l, s);
});

test("assinaturas: cancelada no Stripe → status local muda e o dono vê no feed; sem mudança → nada no feed", async () => {
  const b = bancoSync([LINHA(1), LINHA(2)]);
  const s = stripeFalso({ "GET /v1/subscriptions/sub_PROVA001": [200, { id: "sub_PROVA001", status: "canceled" }], "GET /v1/subscriptions/sub_PROVA002": [200, { id: "sub_PROVA002", status: "active" }] });
  const r = await conferirAssinaturas(env, { svcJson: b.svc, fetch: s.f });
  assert.deepEqual([r.conferidas, r.mudaram, r.falhas], [2, 1, 0]);
  assert.equal(s.pedidos.length, 2); assert.equal(s.pedidos[0].metodo, "GET"); assert.equal(s.pedidos[0].headers.Authorization, `Bearer ${KEY}`);
  assert.equal(b.de("desk_membership_sync_list_svc")[0].a.p_limit, 50);
  const marcas = b.de("desk_membership_sync_mark_svc").map((c) => [c.a.p_id, c.a.p_status, c.a.p_check.stripe_status]);
  assert.deepEqual(marcas, [["ms-1", "canceled", "canceled"], ["ms-2", "active", "active"]]);
  const ev = b.de("ingest_client_event"); assert.equal(ev.length, 1);
  assert.match(ev[0].a.p_summary, /c1@x\.com: ativa → cancelada/); assert.equal(ev[0].a.p_payload.kind, "membership_status");
});

test("assinaturas: pagamento atrasado; 404 no Stripe vira falha honesta sem mudar o status", async () => {
  const b = bancoSync([LINHA(1), LINHA(2)]);
  const s = stripeFalso({ "GET /v1/subscriptions/sub_PROVA001": [200, { id: "sub_PROVA001", status: "past_due" }], "GET /v1/subscriptions/sub_PROVA002": [404, { error: { code: "resource_missing", message: "No such subscription: 'sub_PROVA002'" } }] });
  const r = await conferirAssinaturas(env, { svcJson: b.svc, fetch: s.f });
  assert.deepEqual([r.mudaram, r.falhas, r.motivos.not_found_on_stripe], [1, 1, 1]);
  const m2 = b.de("desk_membership_sync_mark_svc").find((c) => c.a.p_id === "ms-2").a;
  assert.equal(m2.p_status, null); assert.equal(m2.p_check.reason, "not_found_on_stripe");
  const resumos = b.de("ingest_client_event").map((e) => e.a.p_summary);
  assert.equal(resumos.length, 2); assert.match(resumos[0], /pagamento atrasado/); assert.match(resumos[1], /Não consegui conferir 1 assinatura/);
});

test("assinaturas: chave sem Subscriptions: Read → para o negócio na 1ª, um aviso com a permissão; mesmo motivo de novo → sem aviso", async () => {
  const proib = [403, { error: { message: "… Having the 'rak_subscription_read' permission would allow this request to continue." } }];
  let b = bancoSync([LINHA(1), LINHA(2), LINHA(3)]);
  let s = stripeFalso({ "GET /v1/subscriptions": proib });
  let r = await conferirAssinaturas(env, { svcJson: b.svc, fetch: s.f });
  assert.equal(s.pedidos.length, 1); assert.deepEqual([r.conferidas, r.falhas, r.motivos.permission_missing], [3, 3, 3]);
  assert.equal(b.de("desk_membership_sync_mark_svc").length, 3);
  let ev = b.de("ingest_client_event"); assert.equal(ev.length, 1);
  assert.match(ev[0].a.p_summary, /Subscriptions: Read/); assert.equal(ev[0].a.p_payload.kind, "membership_sync_failed");
  b = bancoSync([LINHA(1, { last: { ok: false, reason: "permission_missing" } })]); s = stripeFalso({ "GET /v1/subscriptions": proib });
  r = await conferirAssinaturas(env, { svcJson: b.svc, fetch: s.f });
  assert.equal(r.falhas, 1); assert.equal(b.de("ingest_client_event").length, 0);
});

test("assinaturas: sem chave do negócio → nada vai ao Stripe, cada linha carimbada; leitura falhou → honesto; sub inválido não vira URL", async () => {
  let b = bancoSync([LINHA(1)], { stripe_own_lookup_svc: null }); let s = stripeFalso({});
  let r = await conferirAssinaturas(env, { svcJson: b.svc, fetch: s.f });
  assert.equal(s.pedidos.length, 0); assert.equal(b.de("desk_membership_sync_mark_svc")[0].a.p_check.reason, "payments_not_connected");
  assert.equal(b.de("ingest_client_event").length, 1);
  b = banco({ desk_membership_sync_list_svc: { erro_http: 500 } });
  r = await conferirAssinaturas(env, { svcJson: b.svc, fetch: s.f });
  assert.deepEqual([r.ok, r.leitura], [false, "falhou"]);
  b = bancoSync([LINHA(1, { sub: "sub_x/../../customers" })]); s = stripeFalso({});
  r = await conferirAssinaturas(env, { svcJson: b.svc, fetch: s.f });
  assert.equal(s.pedidos.length, 0); assert.equal(r.motivos.invalid_subscription, 1);
});

test("assinaturas: nunca mais que 50 por rodada", async () => {
  const linhas = Array.from({ length: 60 }, (_, i) => LINHA(i, { sub: `sub_PROVA${String(i).padStart(4, "0")}` }));
  const b = bancoSync(linhas);
  const s = stripeFalso({ "GET /v1/subscriptions": [200, { status: "active" }] });
  // o Stripe de mentira devolve id diferente → conta como falha, mas o que importa aqui é o teto
  const r = await conferirAssinaturas(env, { svcJson: b.svc, fetch: s.f }, { limite: 500 });
  assert.equal(b.de("desk_membership_sync_list_svc")[0].a.p_limit, 50);
  assert.equal(r.conferidas, 50); assert.ok(s.pedidos.length <= 50);
});
