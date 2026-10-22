// O sinal só é anunciado com comprovante; sem Stripe/canal a agente não promete link.
import test from "node:test";
import assert from "node:assert/strict";
import { mandarLinkDoSinal, fraseDoSinal, criarLinkDoSinal } from "./sinal.js";

const INFO = { ok: true, id: "a1", customer_contact: "+12125550147", service: "Massage 60min", deposit_cents: 3000, deposit_paid: false, trusted: false };
const env = { STRIPE_SECRET_KEY: "sk_test_x", RESEND_API_KEY: "re_x", INGEST_SECRET: "i" };
const fetchOk = async (url) => ({ ok: true, json: async () => (String(url).includes("stripe") ? { url: "https://checkout.stripe.com/c/pay/cs_test_1", id: "cs_test_1" } : { id: "email_1" }) });
const conta = async () => ({ modo: "conta_do_negocio", conta: "acct_1" });
const marcas = [];
const svcBase = (info) => async (e, fn, args) => { if (fn === "desk_deposit_info_svc") return info; if (fn === "desk_deposit_link_mark") { marcas.push(args); return { ok: true }; } return null; };

test("texto entregue → ok, marca o envio e a frase diz 'mandei por mensagem'", async () => {
  marcas.length = 0;
  const r = await mandarLinkDoSinal(env, { tenant: "t@x.com", appointmentId: "a1", lang: "pt" },
    { svcJson: svcBase(INFO), fetch: fetchOk, contaDePagamento: conta, aviso: { entregarAviso: async () => ({ sent: true, canal: "sms", id: "SM1" }) } });
  assert.equal(r.ok, true); assert.equal(r.enviado.texto.id, "SM1"); assert.equal(marcas.length, 1);
  assert.match(fraseDoSinal("pt", r), /Acabei de te mandar por mensagem o link do sinal de US\$\s30,00/);
});

test("nenhum canal entregou → ok:false, nada marcado, a frase NÃO promete link", async () => {
  marcas.length = 0;
  const r = await mandarLinkDoSinal({ ...env, RESEND_API_KEY: "" }, { tenant: "t@x.com", appointmentId: "a1", lang: "en" },
    { svcJson: svcBase(INFO), fetch: fetchOk, contaDePagamento: conta, aviso: { entregarAviso: async () => ({ sent: false, motivo: "SMS bloqueado" }) } });
  assert.equal(r.ok, false); assert.equal(marcas.length, 0);
  const f = fraseDoSinal("en", r);
  assert.doesNotMatch(f, /texted|emailed|link/i); assert.match(f, /deposit/);
});

test("sem Stripe do negócio → não cria link", async () => {
  const r = await criarLinkDoSinal(env, { tenant: "t@x.com", appointmentId: "a1" }, { svcJson: svcBase(INFO), contaDePagamento: async () => ({ modo: "sem_conta" }) });
  assert.equal(r.reason, "payments_not_connected");
});

test("cliente de confiança, sinal pago, já enviado e serviço sem sinal → silêncio", async () => {
  for (const [info, motivo] of [[{ ...INFO, trusted: true }, "trusted"], [{ ...INFO, deposit_paid: true }, "already_paid"], [{ ...INFO, deposit_link_sent_at: "2026-10-05" }, "already_sent"], [{ ...INFO, deposit_cents: 0 }, "no_deposit_configured"]]) {
    const r = await mandarLinkDoSinal(env, { tenant: "t@x.com", appointmentId: "a1" }, { svcJson: svcBase(info), fetch: fetchOk, contaDePagamento: conta });
    assert.equal(r.reason, motivo); assert.equal(fraseDoSinal("en", r), "");
  }
});

test("o link do SMS nunca é cortado", async () => {
  const { textoDoAviso } = await import("./avisoPorTexto.js");
  const link = "https://checkout.stripe.com/c/pay/cs_live_" + "a".repeat(140);
  const t = textoDoAviso("deposit", { business: "Natura Spa + Salon", service: "Massage 60min · Astoria", whenLabel: "Tue, Oct 6, 10:00 AM", amount: "$30.00", link }, "en");
  assert.ok(t.includes(link));
});

test("sem Stripe do negócio → a agente NÃO fala de sinal (fica parado até ligar)", async () => {
  const r = await mandarLinkDoSinal(env, { tenant: "t@x.com", appointmentId: "a1" }, { svcJson: svcBase(INFO), contaDePagamento: async () => ({ modo: "sem_conta" }) });
  assert.equal(r.reason, "payments_not_connected"); assert.equal(r.cents, 3000); assert.equal(fraseDoSinal("pt", r), "");
});

test("Stripe PRÓPRIO: a sessão nasce com a chave do negócio e volta por /api/sinal-pago", async () => {
  let pedido = null;
  const fetchGrava = async (url, op) => { if (String(url).includes("stripe")) { pedido = op; return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/c/pay/cs_live_x", id: "cs_live_x" }) }; } return { ok: true, json: async () => ({ id: "e1" }) }; };
  const svc = async (e, fn) => (fn === "desk_deposit_info_svc" ? INFO : fn === "stripe_own_lookup_svc" ? { secret_key: "rk_live_NEGOCIO1234567890abcdef" } : { ok: true });
  const r = await criarLinkDoSinal({ STRIPE_SECRET_KEY: "sk_live_PLATAFORMA" }, { tenant: "t@x.com", appointmentId: "a1" }, { svcJson: svc, fetch: fetchGrava });
  assert.equal(r.ok, true);
  assert.equal(pedido.headers.Authorization, "Bearer rk_live_NEGOCIO1234567890abcdef");
  const corpo = new URLSearchParams(pedido.body);
  assert.match(corpo.get("success_url"), /\/api\/sinal-pago\?t=t%40x\.com&s=\{CHECKOUT_SESSION_ID\}/);
  assert.equal(corpo.get("payment_intent_data[transfer_data][destination]"), null);   // nada de repasse: já é a conta dela
});

test("conferência: só marca pago com payment_status=paid, etiqueta certa e negócio certo", async () => {
  const { conferirSessaoDoSinal } = await import("./sinalPago.js");
  const marcas = [];
  const svc = async (e, fn, a) => (fn === "stripe_own_lookup_svc" ? { secret_key: "rk_live_NEGOCIO1234567890abcdef" } : fn === "desk_deposit_mark" ? (marcas.push(a), { ok: true }) : null);
  const sessao = (o) => async () => ({ ok: true, json: async () => ({ id: "cs_live_abcdefghijkl", amount_total: 3000, payment_status: "paid", metadata: { guileo: "desk_deposit", client_email: "t@x.com", appointment_id: "a1" }, ...o }) });
  assert.equal((await conferirSessaoDoSinal({}, { tenant: "t@x.com", sessionId: "cs_live_abcdefghijkl" }, { svcJson: svc, fetch: sessao({}) })).ok, true);
  assert.equal(marcas.length, 1);
  assert.equal((await conferirSessaoDoSinal({}, { tenant: "t@x.com", sessionId: "cs_live_abcdefghijkl" }, { svcJson: svc, fetch: sessao({ payment_status: "unpaid" }) })).reason, "nao_pago");
  assert.equal((await conferirSessaoDoSinal({}, { tenant: "outro@x.com", sessionId: "cs_live_abcdefghijkl" }, { svcJson: svc, fetch: sessao({}) })).reason, "sessao_de_outro");
  assert.equal((await conferirSessaoDoSinal({}, { tenant: "t@x.com", sessionId: "cs_live_abcdefghijkl" }, { svcJson: svc, fetch: sessao({ metadata: { guileo: "giftcard", client_email: "t@x.com", appointment_id: "a1" } }) })).reason, "sessao_de_outro");
  assert.equal((await conferirSessaoDoSinal({}, { tenant: "t@x.com", sessionId: "lixo" }, { svcJson: svc })).reason, "sessao_invalida");
  assert.equal(marcas.length, 1);
});

// ── SINAL NA TELA (página pública /agendar, 2026-10-05) ─────────────────────────────────────────
test("tela: sinal + Stripe próprio → url, sessão registrada como 'web', janela de cancelamento e volta p/ o agendamento", async () => {
  const { sinalNaTela } = await import("./sinal.js");
  const chamadas = []; let pedido = null;
  const svc = async (e, fn, a) => { chamadas.push([fn, a]);
    return fn === "desk_deposit_info_svc" ? INFO : fn === "stripe_own_lookup_svc" ? { secret_key: "rk_test_NEGOCIO1234567890" } : fn === "desk_late_cancel_info_svc" ? { ok: true, window_h: 24 } : { ok: true }; };
  const f = async (url, op) => { pedido = op; return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/c/pay/cs_test_tela", id: "cs_test_tela" }) }; };
  const r = await sinalNaTela({}, { tenant: "t@x.com", appointmentId: "a1", volta: "natura-spa", lang: "pt" }, { svcJson: svc, fetch: f });
  assert.deepEqual(r, { ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_tela", cents: 3000, janela_h: 24 });
  const marca = chamadas.find(([fn]) => fn === "desk_deposit_link_mark");
  assert.deepEqual(marca[1], { p_tenant: "t@x.com", p_id: "a1", p_canal: "web", p_envio: "cs_test_tela", p_session: "cs_test_tela" });
  assert.match(new URLSearchParams(pedido.body).get("success_url"), /\/api\/sinal-pago\?t=t%40x\.com&s=\{CHECKOUT_SESSION_ID\}&v=natura-spa&l=pt$/);
});

test("tela: o motor já mandou o link por e-mail (already_sent) → abre a sessão do botão mesmo assim", async () => {
  const { sinalNaTela } = await import("./sinal.js");
  const svc = async (e, fn) => (fn === "desk_deposit_info_svc" ? { ...INFO, deposit_link_sent_at: "2026-10-05T10:00:00Z" } : fn === "stripe_own_lookup_svc" ? { secret_key: "rk_test_NEGOCIO1234567890" } : { ok: false });
  const r = await sinalNaTela({}, { tenant: "t@x.com", appointmentId: "a1" }, { svcJson: svc, fetch: fetchOk });
  assert.equal(r.ok, true); assert.equal(r.janela_h, 0);   // janela não lida → sem janela (nunca inventa)
});

test("tela: confiança / pago / sem sinal / sem Stripe → sem etapa de sinal, e nunca chama o Stripe", async () => {
  const { sinalNaTela } = await import("./sinal.js");
  let stripe = 0; const f = async () => { stripe++; return { ok: true, json: async () => ({ url: "https://x", id: "cs" }) }; };
  for (const [info, contaX, motivo] of [[{ ...INFO, trusted: true }, conta, "trusted"], [{ ...INFO, deposit_paid: true }, conta, "already_paid"],
    [{ ...INFO, deposit_cents: 0 }, conta, "no_deposit_configured"], [INFO, async () => ({ modo: "sem_conta" }), "payments_not_connected"]]) {
    const r = await sinalNaTela(env, { tenant: "t@x.com", appointmentId: "a1" }, { svcJson: svcBase(info), fetch: f, contaDePagamento: contaX });
    assert.equal(r.ok, false); assert.equal(r.reason, motivo); assert.equal(r.url, undefined);
  }
  assert.equal(stripe, 0);
});

test("tela: Stripe recusou → ok:false, nada registrado", async () => {
  const { sinalNaTela } = await import("./sinal.js");
  marcas.length = 0;
  const r = await sinalNaTela(env, { tenant: "t@x.com", appointmentId: "a1" }, { svcJson: svcBase(INFO), contaDePagamento: conta,
    fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "bad" } }) }) });
  assert.equal(r.ok, false); assert.equal(r.reason, "stripe_error"); assert.equal(marcas.length, 0);
});

test("agente/balcão sem `volta`: a URL de volta continua exatamente a de antes", async () => {
  let pedido = null;
  const svc = async (e, fn) => (fn === "desk_deposit_info_svc" ? INFO : fn === "stripe_own_lookup_svc" ? { secret_key: "rk_live_NEGOCIO1234567890abcdef" } : { ok: true });
  await criarLinkDoSinal({}, { tenant: "t@x.com", appointmentId: "a1" }, { svcJson: svc, fetch: async (u, op) => { pedido = op; return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/x", id: "cs_live_x" }) }; } });
  assert.equal(new URLSearchParams(pedido.body).get("success_url"), "https://guileoai.com/api/sinal-pago?t=t%40x.com&s={CHECKOUT_SESSION_ID}");
  // slug inválido também não entra
  await criarLinkDoSinal({}, { tenant: "t@x.com", appointmentId: "a1", volta: "../evil" }, { svcJson: svc, fetch: async (u, op) => { pedido = op; return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/x", id: "cs_live_x" }) }; } });
  assert.doesNotMatch(new URLSearchParams(pedido.body).get("success_url"), /&v=/);
});
