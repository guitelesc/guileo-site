// Venda online de pacote / vale-presente no Stripe DO NEGÓCIO: corpo exato da sessão (chave do negócio
// × plataforma), recusa honesta sem chave, entrega uma vez só. Nenhuma chamada real: fetch e banco são
// de mentira. (A trava de verdade — uma entrega por sessão — está provada em SQL na conta e2e-test.)
import test from "node:test";
import assert from "node:assert/strict";
import { decidirVenda, recusaSemConta, caminhoDaVenda, criarVendaPropria, criarAssinaturaPropria, conferirVendaOnline, RECEBER_URL, estadoDoEstorno, conferirEstornos } from "./vendaOnlineNegocio.js";
import { conferirPendentes } from "../api/venda-online-reconcile.js";
import { textoDaVolta, voltaDaLoja } from "../api/venda-paga.js";
import { onRequestPost as packagesPost } from "../api/packages.js";
import { onRequestPost as giftcardsPost } from "../api/giftcards.js";

const T = "e2e-test@guileoai.com";
const KEY = "rk_live_NEGOCIO1234567890abcdef";
const PLAT = "sk_live_PLATAFORMA_BR_123";
const PKG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const MEM = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const SESS = "cs_live_a1B2c3D4e5F6g7H8i9J0";
const ENV = { INGEST_SECRET: "ing", SCHED_SECRET: "sch", STRIPE_SECRET_KEY: PLAT, OWNER_EMAIL: "smart@guileoai.com" };
// RPCs que dariam crédito / provisionariam algo para QUEM PAGOU — nenhuma pode aparecer
const PROIBIDAS = /credit|topup|provision|claim_credit|add_credits|set_plan/i;

function banco(over = {}) {
  const chamadas = [];
  const svc = async (env, fn, a) => {
    chamadas.push({ fn, a });
    if (fn in over) return typeof over[fn] === "function" ? over[fn](a) : over[fn];
    if (fn === "stripe_own_lookup_svc") return { secret_key: KEY };
    return { ok: true };
  };
  return { svc, chamadas, de: (fn) => chamadas.filter((c) => c.fn === fn) };
}
function stripeFalso(rotas) {
  const pedidos = [];
  const f = async (url, op = {}) => {
    const u = new URL(url); const metodo = op.method || "GET";
    pedidos.push({ metodo, caminho: u.pathname, headers: op.headers || {}, corpo: op.body ? new URLSearchParams(op.body) : null });
    const chave = Object.keys(rotas).find((k) => { const [m, p] = k.split(" "); return m === metodo && u.pathname.startsWith(p); });
    const [status, data] = chave ? (typeof rotas[chave] === "function" ? rotas[chave](u, op) : rotas[chave]) : [404, { error: { message: "rota de teste ausente" } }];
    return { ok: status >= 200 && status < 300, status, json: async () => data };
  };
  return { f, pedidos };
}
const sessaoPaga = (over = {}) => ({ id: SESS, payment_status: "paid", status: "complete", amount_total: 40000,
  customer_details: { email: "Maria@Cliente.com" }, metadata: { guileo: "package", via: "stripe_own", client_email: T, id: PKG }, ...over });

// ── decisão (pura) ──────────────────────────────────────────────────────────────────────────
test("chave própria → a venda sai na conta do negócio", () => {
  const d = decidirVenda({ propria: { chave: KEY }, destino: { modo: "conectada", conta: "acct_X" } });
  assert.equal(d.via, "propria"); assert.equal(d.chave, KEY);
});
test("sem chave própria, conta conectada (BR) → o caminho de antes, na plataforma", () => {
  assert.equal(decidirVenda({ destino: { modo: "conectada", conta: "acct_1AbCdEfGhIj" } }).via, "plataforma");
  assert.equal(decidirVenda({ destino: { modo: "plataforma" } }).via, "plataforma");
});
test("negócio dos EUA sem chave → payments_not_connected com guileoai.com/receber, nunca link da plataforma", () => {
  const d = decidirVenda({ destino: { modo: "sem_conta", motivo: "nao_conectado" }, pais: "US" });
  assert.equal(d.via, "recusa");
  assert.equal(d.corpo.reason, "payments_not_connected"); assert.equal(d.corpo.hint, "use_own_stripe");
  assert.equal(d.corpo.connect_url, RECEBER_URL); assert.match(d.corpo.note, /guileoai\.com\/receber/);
});
test("negócio BR sem conta → a recusa de sempre (conectar o Stripe), sem a dica do Stripe próprio", () => {
  const c = recusaSemConta({ modo: "sem_conta", motivo: "nao_conectado" }, "BR");
  assert.equal(c.reason, "payments_not_connected"); assert.equal(c.hint, undefined); assert.match(c.note, /Settings → Payments/);
});
test("chave que não é do Stripe não vira 'própria'", () => {
  assert.equal(decidirVenda({ propria: { chave: "pk_live_x" }, destino: { modo: "sem_conta" }, pais: "US" }).via, "recusa");
});

test("caminhoDaVenda: com chave própria nem consulta a plataforma", async () => {
  const db = banco(); let consultou = false;
  const d = await caminhoDaVenda(ENV, T, { svcJson: db.svc, contaDePagamento: async () => { consultou = true; return { modo: "conectada", conta: "acct_X" }; } });
  assert.equal(d.via, "propria"); assert.equal(consultou, false);
});
test("caminhoDaVenda: spa de Nova York sem chave → recusa com a dica dos EUA", async () => {
  const db = banco({ stripe_own_lookup_svc: null, biz_tenant_fusos: { ok: true, fusos: ["America/New_York"] }, get_client_profile: {} });
  const d = await caminhoDaVenda(ENV, T, { svcJson: db.svc, contaDePagamento: async () => ({ modo: "sem_conta", motivo: "nao_conectado" }) });
  assert.equal(d.via, "recusa"); assert.equal(d.corpo.hint, "use_own_stripe");
});
test("caminhoDaVenda: clínica BR sem chave e sem conta → recusa de sempre", async () => {
  const db = banco({ stripe_own_lookup_svc: null, biz_tenant_fusos: { ok: true, fusos: ["America/Sao_Paulo"] }, get_client_profile: {} });
  const d = await caminhoDaVenda(ENV, T, { svcJson: db.svc, contaDePagamento: async () => ({ modo: "sem_conta", motivo: "nao_conectado" }) });
  assert.equal(d.via, "recusa"); assert.equal(d.corpo.hint, undefined);
});

// ── corpo da sessão no Stripe do negócio ─────────────────────────────────────────────────────
test("pacote: sessão com a chave DO NEGÓCIO, sem destino da plataforma, etiqueta e volta certas", async () => {
  const db = banco(); const s = stripeFalso({ "POST /v1/checkout/sessions": [200, { id: SESS, url: "https://checkout.stripe.com/c/pay/x" }] });
  const r = await criarVendaPropria(ENV, { tenant: T, chave: KEY, kind: "package", item: { id: PKG, name: "5 massagens" }, cents: 40000 }, { svcJson: db.svc, fetch: s.f });
  assert.equal(r.ok, true); assert.equal(r.url, "https://checkout.stripe.com/c/pay/x"); assert.equal(r.conferencia, true);
  const p = s.pedidos[0];
  assert.equal(p.headers.Authorization, `Bearer ${KEY}`);
  const c = p.corpo;
  assert.equal(c.get("mode"), "payment"); assert.equal(c.get("line_items[0][price_data][unit_amount]"), "40000");
  assert.equal(c.get("line_items[0][price_data][product_data][name]"), "5 massagens");
  assert.equal(c.get("metadata[guileo]"), "package"); assert.equal(c.get("metadata[via]"), "stripe_own");
  assert.equal(c.get("metadata[client_email]"), T); assert.equal(c.get("metadata[id]"), PKG);
  assert.equal(c.get("payment_intent_data[metadata][guileo]"), "package");
  assert.equal(c.get("allow_promotion_codes"), "false");
  assert.equal(c.get("success_url"), `https://guileoai.com/api/venda-paga?t=${encodeURIComponent(T)}&s={CHECKOUT_SESSION_ID}`);
  assert.ok(c.get("expires_at"));
  for (const k of c.keys()) assert.doesNotMatch(k, /transfer_data|on_behalf_of|application_fee/, `campo da plataforma na sessão própria: ${k}`);
  const reg = db.de("venda_online_session_add_svc")[0].a;
  assert.deepEqual([reg.p_tenant, reg.p_session, reg.p_kind, reg.p_item_id, reg.p_cents], [T, SESS, "package", PKG, 40000]);
});
test("vale-presente: valor, presenteada e compradora na etiqueta; e-mail da compradora no Checkout", async () => {
  const db = banco(); const s = stripeFalso({ "POST /v1/checkout/sessions": [200, { id: SESS, url: "https://checkout.stripe.com/c/pay/g" }] });
  const r = await criarVendaPropria(ENV, { tenant: T, chave: KEY, kind: "giftcard", cents: 5000, recipient: "bia@amiga.com", purchaser: "Ana@Cliente.com" }, { svcJson: db.svc, fetch: s.f });
  assert.equal(r.ok, true);
  const c = s.pedidos[0].corpo;
  assert.equal(c.get("metadata[guileo]"), "giftcard"); assert.equal(c.get("metadata[amount_cents]"), "5000");
  assert.equal(c.get("metadata[recipient_contact]"), "bia@amiga.com"); assert.equal(c.get("customer_email"), "ana@cliente.com");
  assert.equal(c.get("line_items[0][price_data][product_data][name]"), "Gift card — $50.00");
  assert.equal(db.de("venda_online_session_add_svc")[0].a.p_kind, "giftcard");
});
test("Stripe recusa a chave por permissão → motivo com o nome do painel, sem link", async () => {
  const db = banco(); const s = stripeFalso({ "POST /v1/checkout/sessions": [403, { error: { message: "Having the 'rak_checkout_session_write' permission would allow this request to continue." } }] });
  const r = await criarVendaPropria(ENV, { tenant: T, chave: KEY, kind: "giftcard", cents: 5000 }, { svcJson: db.svc, fetch: s.f });
  assert.equal(r.ok, false); assert.equal(r.reason, "permission_missing"); assert.equal(r.permissao, "Checkout Sessions: Write");
  assert.equal(db.de("venda_online_session_add_svc").length, 0);
});
test("assinatura pela chave própria: etiqueta do Desk (volta /api/sinal-pago) sem exigir a ficha", async () => {
  const db = banco(); const s = stripeFalso({ "POST /v1/checkout/sessions": [200, { id: SESS, url: "https://checkout.stripe.com/c/pay/m" }] });
  const r = await criarAssinaturaPropria(ENV, { tenant: T, chave: KEY, membership: { id: MEM, name: "Clube", price_cents: 9900, interval: "month" } }, { svcJson: db.svc, fetch: s.f });
  assert.equal(r.ok, true);
  const c = s.pedidos[0].corpo;
  assert.equal(c.get("mode"), "subscription"); assert.equal(c.get("metadata[guileo]"), "desk_membership");
  assert.equal(c.get("subscription_data[metadata][membership_id]"), MEM);
  assert.match(c.get("success_url"), /\/api\/sinal-pago\?t=/);
  assert.equal(db.de("desk_stripe_session_add_svc")[0].a.p_kind, "membership");
});

// ── entrega (volta + conferência) ────────────────────────────────────────────────────────────
function bancoComEntrega() {
  const entregues = new Map(); let criados = 0;
  const db = banco({
    venda_online_fulfill_svc: (a) => {
      if (entregues.has(a.p_session)) return { ok: true, already: true, kind: a.p_kind, result: entregues.get(a.p_session) };
      criados++; const res = a.p_kind === "giftcard" ? { kind: "giftcard", code: "GCABC12345", cents: a.p_cents } : { kind: "package", purchase_id: "pp-1", sessions: 5 };
      entregues.set(a.p_session, res); return { ok: true, already: false, kind: a.p_kind, result: res };
    },
    ingest_client_event: "evt-1",
  });
  return { ...db, criados: () => criados };
}
test("pacote pago: entrega com o item e o valor DA SESSÃO, feed uma vez; segunda volta não cria de novo", async () => {
  const db = bancoComEntrega(); const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoPaga()] });
  const alarmes = [];
  const deps = { svcJson: db.svc, fetch: s.f, emitFailure: async (...a) => alarmes.push(a) };
  const r1 = await conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, deps);
  const r2 = await conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, deps);
  assert.equal(r1.ok, true); assert.equal(r1.already, false); assert.equal(r2.ok, true); assert.equal(r2.already, true);
  assert.equal(db.criados(), 1);
  const a = db.de("venda_online_fulfill_svc")[0].a;
  assert.deepEqual([a.p_tenant, a.p_session, a.p_kind, a.p_item_id, a.p_cents, a.p_buyer], [T, SESS, "package", PKG, 40000, "maria@cliente.com"]);
  assert.equal(a.p_secret, "ing"); assert.equal(a.p_sched_secret, "sch");
  assert.equal(db.de("ingest_client_event").length, 1);
  assert.equal(db.de("ingest_client_event")[0].a.p_summary, "💳 Pacote · $400.00");
  assert.equal(s.pedidos[0].headers.Authorization, `Bearer ${KEY}`);
  assert.equal(alarmes.length, 0);
  for (const c of db.chamadas) assert.doesNotMatch(c.fn, PROIBIDAS, `RPC proibida: ${c.fn}`);
});
test("volta e conferência AO MESMO TEMPO: um vale só", async () => {
  const db = bancoComEntrega();
  const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoPaga({ amount_total: 5000, metadata: { guileo: "giftcard", via: "stripe_own", client_email: T, amount_cents: "5000", recipient_contact: "bia@amiga.com" } })] });
  const deps = { svcJson: db.svc, fetch: s.f, emitFailure: async () => null };
  const rs = await Promise.all([conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, deps), conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, deps)]);
  assert.ok(rs.every((r) => r.ok)); assert.equal(rs.filter((r) => !r.already).length, 1);
  // feed de PAGAMENTO uma vez (o aviso do e-mail do vale é outra linha, testada abaixo — aqui sem RESEND = "email_off", uma vez)
  const pagos = db.de("ingest_client_event").filter((c) => c.a.p_type === "payment");
  assert.equal(db.criados(), 1); assert.equal(pagos.length, 1);
  assert.equal(pagos[0].a.p_payload.code, "GCABC12345");
  assert.equal(db.de("ingest_client_event").filter((c) => c.a.p_payload?.kind === "giftcard_email").length, 1);
  assert.equal(db.de("venda_online_fulfill_svc")[0].a.p_cents, 5000, "o vale nasce com o valor PAGO");
});
test("não pago → nada é entregue", async () => {
  const db = bancoComEntrega(); const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoPaga({ payment_status: "unpaid", status: "open" })] });
  const r = await conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, { svcJson: db.svc, fetch: s.f });
  assert.equal(r.reason, "nao_pago"); assert.equal(db.de("venda_online_fulfill_svc").length, 0);
});
test("sessão de outro negócio, sem a etiqueta via=stripe_own, ou de outro tipo → recusa", async () => {
  for (const meta of [{ guileo: "package", via: "stripe_own", client_email: "outro@spa.com", id: PKG }, { guileo: "package", client_email: T, id: PKG }, { guileo: "desk_deposit", via: "stripe_own", client_email: T }]) {
    const db = bancoComEntrega(); const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoPaga({ metadata: meta })] });
    const r = await conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, { svcJson: db.svc, fetch: s.f });
    assert.equal(r.reason, "sessao_de_outro"); assert.equal(db.de("venda_online_fulfill_svc").length, 0);
  }
});
test("negócio sem chave própria / id de sessão inventado → não lê nada", async () => {
  const db = banco({ stripe_own_lookup_svc: null }); const s = stripeFalso({});
  assert.equal((await conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, { svcJson: db.svc, fetch: s.f })).reason, "sem_stripe_proprio");
  assert.equal((await conferirVendaOnline(ENV, { tenant: T, sessionId: "cs_live_<script>" }, { svcJson: db.svc, fetch: s.f })).reason, "sessao_invalida");
  assert.equal(s.pedidos.length, 0);
});
test("pago mas a entrega falhou → alarme ao dono uma vez; falha final já registrada não repete", async () => {
  const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoPaga()] });
  const alarmes = [];
  const db1 = banco({ venda_online_fulfill_svc: { ok: false, reason: "package_not_found" } });
  const r = await conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, { svcJson: db1.svc, fetch: s.f, emitFailure: async (...a) => alarmes.push(a) });
  assert.equal(r.ok, false); assert.equal(r.reason, "package_not_found"); assert.equal(alarmes.length, 1);
  assert.equal(alarmes[0][1], "recurring_fulfill_failed"); assert.equal(db1.de("ingest_client_event").length, 0);
  const db2 = banco({ venda_online_fulfill_svc: { ok: false, already: true, reason: "package_not_found" } });
  await conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, { svcJson: db2.svc, fetch: s.f, emitFailure: async (...a) => alarmes.push(a) });
  assert.equal(alarmes.length, 1);
});

test("conferência de hora em hora: conta entregues, já entregues, abertos e falhas", async () => {
  const db = banco({ venda_online_pending_svc: [{ tenant: T, session: "cs_test_1aaaaaaaaaaa" }, { tenant: T, session: "cs_test_2aaaaaaaaaaa" }, { tenant: T, session: "cs_test_3aaaaaaaaaaa" }, { tenant: T, session: "cs_test_4aaaaaaaaaaa" }] });
  const resp = { cs_test_1aaaaaaaaaaa: { ok: true, already: false }, cs_test_2aaaaaaaaaaa: { ok: true, already: true }, cs_test_3aaaaaaaaaaa: { ok: false, reason: "nao_pago" }, cs_test_4aaaaaaaaaaa: { ok: false, reason: "stripe_nao_respondeu" } };
  const r = await conferirPendentes(ENV, { svcJson: db.svc, conferir: async (env, { sessionId }) => resp[sessionId] });
  assert.deepEqual(r, { ok: true, conferidos: 4, entregues: 1, ja_entregues: 1, abertos: 1, falhas: 1 });
  const falhou = await conferirPendentes(ENV, { svcJson: banco({ venda_online_pending_svc: { ok: false, erro_http: 500 } }).svc });
  assert.equal(falhou.ok, false);
});
test("página da volta: só diz 'recebido' com a entrega confirmada", () => {
  assert.equal(textoDaVolta("pt", { ok: true, kind: "package" })[0], "Pacote comprado");
  assert.equal(textoDaVolta("en", { ok: true, kind: "giftcard" })[0], "Payment received");
  assert.equal(textoDaVolta("es", { ok: false, reason: "nao_pago" })[0], "Gracias");
  assert.equal(textoDaVolta("xx", null)[0], "Thank you");
});

// ── as rotas de verdade (/api/packages e /api/giftcards), com fetch global de mentira ─────────
function rede({ propria = true, conectada = false, fusos = ["America/New_York"] } = {}) {
  const pedidos = [];
  globalThis.fetch = async (url, op = {}) => {
    const u = new URL(url); const body = op.body ? (String(op.headers?.["Content-Type"] || "").includes("json") ? JSON.parse(op.body) : new URLSearchParams(op.body)) : null;
    pedidos.push({ host: u.host, caminho: u.pathname, headers: op.headers || {}, body });
    const r = (status, data) => ({ ok: status < 300, status, json: async () => data, text: async () => JSON.stringify(data) });
    if (u.host.endsWith("supabase.co")) {
      const fn = u.pathname.split("/").pop();
      if (fn === "get_client_data") return r(200, { events: [] });
      if (fn === "package_list") return r(200, [{ id: PKG, name: "5 massagens", sessions: 5, price_cents: 40000 }]);
      if (fn === "membership_list") return r(200, [{ id: MEM, name: "Clube", price_cents: 9900, interval: "month" }]);
      if (fn === "stripe_own_lookup_svc") return propria ? r(200, { secret_key: KEY }) : r(200, null);
      if (fn === "client_stripe_lookup") return r(200, conectada ? { account_id: "acct_1AbCdEfGhIjKlMn", charges_enabled: true } : {});
      if (fn === "biz_tenant_fusos") return r(200, { ok: true, fusos });
      if (fn === "get_client_profile") return r(200, {});
      return r(200, { ok: true });
    }
    if (u.host === "api.stripe.com") return r(200, { id: SESS, url: "https://checkout.stripe.com/c/pay/z" });
    return r(404, {});
  };
  return pedidos;
}
const chamar = async (fn, corpo) => {
  const res = await fn({ request: new Request("https://guileoai.com/api/x", { method: "POST", body: JSON.stringify({ email: T, token: "k", ...corpo }) }), env: ENV });
  return { status: res.status, d: await res.json() };
};
const stripeDe = (pedidos) => pedidos.filter((p) => p.host === "api.stripe.com");

test("rota /api/packages buy: com chave própria a sessão sai na conta do negócio", async () => {
  const fetchOriginal = globalThis.fetch;
  try {
    const p = rede({ propria: true });
    const { d } = await chamar(packagesPost, { action: "buy", kind: "package", id: PKG });
    assert.equal(d.ok, true); assert.equal(d.via, "stripe_own");
    const st = stripeDe(p); assert.equal(st.length, 1); assert.equal(st[0].headers.Authorization, `Bearer ${KEY}`);
    assert.equal(st[0].body.get("metadata[via]"), "stripe_own");
  } finally { globalThis.fetch = fetchOriginal; }
});
test("rota /api/packages buy: sem chave e com conta conectada (BR) → plataforma, igual a antes", async () => {
  const fetchOriginal = globalThis.fetch;
  try {
    const p = rede({ propria: false, conectada: true, fusos: ["America/Sao_Paulo"] });
    const { d } = await chamar(packagesPost, { action: "buy", kind: "package", id: PKG });
    assert.equal(d.ok, true); assert.equal(d.via, undefined);
    const st = stripeDe(p); assert.equal(st.length, 1); assert.equal(st[0].headers.Authorization, `Bearer ${PLAT}`);
    assert.equal(st[0].body.get("payment_intent_data[transfer_data][destination]"), "acct_1AbCdEfGhIjKlMn");
    assert.equal(st[0].body.get("metadata[via]"), null);
  } finally { globalThis.fetch = fetchOriginal; }
});
test("rota /api/packages buy (assinatura) e /api/giftcards buy: EUA sem chave → recusa honesta, ZERO chamada ao Stripe", async () => {
  const fetchOriginal = globalThis.fetch;
  try {
    let p = rede({ propria: false, conectada: false });
    let { d } = await chamar(packagesPost, { action: "buy", kind: "membership", id: MEM });
    assert.equal(d.reason, "payments_not_connected"); assert.equal(d.hint, "use_own_stripe"); assert.equal(d.connect_url, RECEBER_URL);
    assert.equal(stripeDe(p).length, 0);
    p = rede({ propria: false, conectada: false });
    ({ d } = await chamar(giftcardsPost, { action: "buy", amount_cents: 5000 }));
    assert.equal(d.reason, "payments_not_connected"); assert.equal(d.hint, "use_own_stripe");
    assert.equal(stripeDe(p).length, 0);
  } finally { globalThis.fetch = fetchOriginal; }
});
test("rota /api/giftcards buy: com chave própria, vale vendido na conta do negócio", async () => {
  const fetchOriginal = globalThis.fetch;
  try {
    const p = rede({ propria: true });
    const { d } = await chamar(giftcardsPost, { action: "buy", amount_cents: 5000, recipient_contact: "bia@amiga.com" });
    assert.equal(d.ok, true); assert.equal(d.via, "stripe_own");
    const st = stripeDe(p); assert.equal(st[0].headers.Authorization, `Bearer ${KEY}`);
    assert.equal(st[0].body.get("metadata[guileo]"), "giftcard");
    assert.ok(p.some((x) => x.caminho.endsWith("/venda_online_session_add_svc")));
  } finally { globalThis.fetch = fetchOriginal; }
});

// ═══ LOJA DA VITRINE no Stripe do negócio (2026-10-05) ═══════════════════════════════════════
// A trava de verdade (uma vez por sessão, item que esgotou não desfaz os outros, estorno acha pelo
// prefixo) está provada em SQL na conta e2e-test (db/desk_v7_loja.sql). Aqui: o JS só faz feed/aviso
// na entrega que REGISTROU, lê os itens da SESSÃO e recusa sessão de outra vitrine.
const LT = "naturaspaadm@gmail.com";   // a conta da loja natura-spa (lib/loja.js · LOJAS) — nenhum dado é tocado: tudo simulado
const ITA = "11111111-1111-4111-8111-111111111111";
const ITB = "22222222-2222-4222-8222-222222222222";
const sessaoLoja = (over = {}) => ({ id: SESS, payment_status: "paid", status: "complete", amount_total: 4495, payment_intent: "pi_3LojaTeste123456",
  customer_details: { email: "Maria@Cliente.com", name: "Maria", phone: "+15550001111" }, shipping_details: { address: { line1: "1 Main St", city: "Astoria", state: "NY", postal_code: "11103" } },
  metadata: { guileo: "loja", via: "stripe_own", client_email: LT, slug: "natura-spa", entrega: "envio", itens: `${ITA}:2,${ITB}:1` }, ...over });
function bancoDaLoja(itensResult = null) {
  const feitas = new Map(); let criados = 0;
  const db = banco({
    loja_online_fulfill_svc: (a) => {
      if (feitas.has(a.p_session)) return { ok: true, already: true, kind: "loja", result: feitas.get(a.p_session) };
      criados++;
      const res = { kind: "loja", itens: itensResult || a.p_itens.map((i) => ({ id: i.id, qtd: i.qtd, ok: true, name: i.id === ITA ? "Hand Cream" : "Candle" })), revenue: { ok: true, id: 1 }, problemas: 0, cents: a.p_cents };
      feitas.set(a.p_session, res); return { ok: true, already: false, kind: "loja", result: res };
    },
    ingest_client_event: "evt-1",
  });
  return { ...db, criados: () => criados };
}
const depsLoja = (db, s, extra = {}) => {
  const avisos = [], donos = [], alarmes = [];
  return { avisos, donos, alarmes, deps: { svcJson: db.svc, fetch: s.f, emitFailure: async (...a) => alarmes.push(a),
    avisarPedidoLoja: async (env, x) => { avisos.push(x); return { email: true, texto: false }; }, avisarDono: async (env, x) => { donos.push(x); return { ok: true }; }, ...extra } };
};

test("loja paga: registra com o ref do payment_intent e os itens DA SESSÃO; feed e aviso ao salão uma vez", async () => {
  const db = bancoDaLoja(); const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoLoja()] });
  const x = depsLoja(db, s);
  const r1 = await conferirVendaOnline(ENV, { tenant: LT, sessionId: SESS }, x.deps);
  const r2 = await conferirVendaOnline(ENV, { tenant: LT, sessionId: SESS }, x.deps);
  assert.equal(r1.ok, true); assert.equal(r1.kind, "loja"); assert.equal(r1.already, false); assert.equal(r1.problemas, 0);
  assert.equal(r2.ok, true); assert.equal(r2.already, true);
  assert.equal(db.criados(), 1);
  const a = db.de("loja_online_fulfill_svc")[0].a;
  assert.equal(a.p_ref_base, "pi_3LojaTeste123456"); assert.equal(a.p_session, SESS); assert.equal(a.p_cents, 4495);
  assert.deepEqual(a.p_itens, [{ id: ITA, qtd: 2 }, { id: ITB, qtd: 1 }]);
  assert.equal(a.p_customer_contact, "maria@cliente.com"); assert.equal(a.p_customer_name, "Maria"); assert.equal(a.p_entrega, "envio");
  assert.equal(a.p_secret, "ing"); assert.equal(a.p_sched_secret, "sch");
  assert.equal(db.de("ingest_client_event").length, 1);
  assert.equal(db.de("ingest_client_event")[0].a.p_summary, "🛍️ Pedido da loja · $44.95 · 3 itens · envio · Maria");
  assert.equal(x.avisos.length, 1); assert.deepEqual(x.avisos[0].itens, [{ nome: "Hand Cream", qtd: 2 }, { nome: "Candle", qtd: 1 }]);
  assert.equal(x.avisos[0].endereco, "1 Main St · Astoria, NY · 11103");
  assert.equal(x.alarmes.length, 0); assert.equal(x.donos.length, 0);
  assert.equal(s.pedidos[0].headers.Authorization, `Bearer ${KEY}`);
  for (const c of db.chamadas) assert.doesNotMatch(c.fn, PROIBIDAS, `RPC proibida: ${c.fn}`);
});
test("loja: volta e conferência AO MESMO TEMPO → um registro, um feed, um aviso", async () => {
  const db = bancoDaLoja(); const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoLoja()] });
  const x = depsLoja(db, s);
  const rs = await Promise.all([conferirVendaOnline(ENV, { tenant: LT, sessionId: SESS }, x.deps), conferirPendentes(ENV, { svcJson: banco({ venda_online_pending_svc: [{ tenant: LT, session: SESS, kind: "loja" }] }).svc, conferir: (env, p) => conferirVendaOnline(env, p, x.deps) })]);
  assert.equal(rs[0].ok, true); assert.equal(rs[1].conferidos, 1);
  assert.equal(rs[1].entregues + rs[1].ja_entregues, 1); assert.equal(rs[0].already ? 0 : 1, rs[1].entregues ? 0 : 1);
  assert.equal(db.criados(), 1); assert.equal(db.de("ingest_client_event").length, 1); assert.equal(x.avisos.length, 1);
});
test("loja: item esgotou entre a sacola e o pagamento → alarme loja_pago_sem_registro + dono avisado, uma vez", async () => {
  const db = bancoDaLoja([{ id: ITA, qtd: 2, ok: true, name: "Hand Cream" }, { id: ITB, qtd: 1, ok: false, reason: "out_of_stock" }]);
  const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoLoja()] });
  const x = depsLoja(db, s);
  const r = await conferirVendaOnline(ENV, { tenant: LT, sessionId: SESS }, x.deps);
  await conferirVendaOnline(ENV, { tenant: LT, sessionId: SESS }, x.deps);
  assert.equal(r.ok, true); assert.equal(r.problemas, 1);
  assert.equal(x.alarmes.length, 1); assert.equal(x.alarmes[0][1], "loja_pago_sem_registro"); assert.match(x.alarmes[0][3], /out_of_stock/);
  assert.equal(x.donos.length, 1); assert.equal(x.donos[0].chave, `loja:${SESS}`);
});
test("loja: salão não avisado (e-mail e texto falharam) vira problema", async () => {
  const db = bancoDaLoja(); const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoLoja()] });
  const x = depsLoja(db, s, { avisarPedidoLoja: async () => ({ email: false, texto: false }) });
  const r = await conferirVendaOnline(ENV, { tenant: LT, sessionId: SESS }, x.deps);
  assert.equal(r.problemas, 1); assert.equal(r.avisado, false); assert.match(x.alarmes[0][3], /NÃO foi avisado/);
});
test("loja: sessão não paga / de outra vitrine / sem via=stripe_own → nada é registrado", async () => {
  for (const [over, motivo] of [[{ payment_status: "unpaid", status: "open" }, "nao_pago"], [{ metadata: { ...sessaoLoja().metadata, slug: "outra-loja" } }, "sessao_de_outro"],
    [{ metadata: { ...sessaoLoja().metadata, via: undefined } }, "sessao_de_outro"], [{ metadata: { ...sessaoLoja().metadata, client_email: T } }, "sessao_de_outro"]]) {
    const db = bancoDaLoja(); const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoLoja(over)] });
    const r = await conferirVendaOnline(ENV, { tenant: LT, sessionId: SESS }, depsLoja(db, s).deps);
    assert.equal(r.reason, motivo); assert.equal(db.de("loja_online_fulfill_svc").length, 0);
  }
});
test("loja: registro falhou (banco fora) → alarme e nada de feed/aviso (a conferência tenta de novo)", async () => {
  const db = banco({ loja_online_fulfill_svc: { ok: false, erro_http: 503 } }); const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessaoLoja()] });
  const x = depsLoja(db, s);
  const r = await conferirVendaOnline(ENV, { tenant: LT, sessionId: SESS }, x.deps);
  assert.equal(r.ok, false); assert.equal(x.alarmes[0][1], "loja_pago_sem_registro"); assert.equal(x.avisos.length, 0); assert.equal(db.de("ingest_client_event").length, 0);
});
test("volta da loja: só ?loja=ok com o pedido registrado; senão ?loja=confirmando, no mesmo host", () => {
  const loja = { slug: "natura-spa" };
  assert.equal(voltaDaLoja("https://guileoai.com", "guileoai.com", loja, { ok: true, kind: "loja" }), "https://guileoai.com/novo/natura-spa?loja=ok#store");
  assert.equal(voltaDaLoja("https://guileoai.com", "guileoai.com", loja, { ok: false, reason: "nao_pago" }), "https://guileoai.com/novo/natura-spa?loja=confirmando#store");
  assert.equal(voltaDaLoja("https://naturaspanyc.com", "naturaspanyc.com", loja, { ok: true, kind: "loja" }), "https://naturaspanyc.com/?loja=ok#store");
  assert.equal(voltaDaLoja("https://guileoai.com", "guileoai.com", loja, { ok: true, kind: "package" }), "https://guileoai.com/novo/natura-spa?loja=confirmando#store");
});

// ═══ VALE-PRESENTE: o código por e-mail (2026-10-05) ════════════════════════════════════════════
const sessaoVale = (meta = {}, over = {}) => sessaoPaga({ amount_total: 5000, customer_details: { email: "Ana@Cliente.com", name: "Ana" },
  metadata: { guileo: "giftcard", via: "stripe_own", client_email: T, amount_cents: "5000", recipient_contact: "bia@amiga.com", recipient_name: "Bia", gift_message: "Feliz aniversário!", ...meta }, ...over });
function redeComResend(sessao, resend) {
  const enviados = [];
  const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, sessao] });
  const f = async (url, op = {}) => {
    if (String(url).startsWith("https://api.resend.com/")) {
      const corpo = JSON.parse(op.body); enviados.push(corpo);
      const [status, data] = typeof resend === "function" ? resend(corpo, enviados.length) : resend;
      return { ok: status >= 200 && status < 300, status, json: async () => data };
    }
    return s.f(url, op);
  };
  return { f, enviados };
}
const ENV_MAIL = { ...ENV, RESEND_API_KEY: "re_test", EMAIL_FROM: "Guileo <noreply@guileoai.com>" };
const marca = async () => ({ business: "Spa Teste", accent: "#0063a8", lang: "en" });
const feedVale = (db) => db.de("ingest_client_event").filter((c) => c.a.p_payload?.kind === "giftcard_email");

test("vale pago: código por e-mail para quem ganhou E cópia para quem comprou; 'enviado' só com o id do Resend", async () => {
  const db = bancoComEntrega(); const n = redeComResend(sessaoVale(), (c, i) => [200, { id: `email_${i}` }]);
  const r = await conferirVendaOnline(ENV_MAIL, { tenant: T, sessionId: SESS }, { svcJson: db.svc, fetch: n.f, brandFor: marca, emitFailure: async () => null });
  assert.equal(r.ok, true);
  assert.deepEqual(r.email.sent.map((x) => [x.to, x.para, x.id]), [["bia@amiga.com", "recipient", "email_1"], ["ana@cliente.com", "buyer", "email_2"]]);
  assert.equal(r.email.failed.length, 0);
  assert.equal(n.enviados[0].to, "bia@amiga.com"); assert.equal(n.enviados[0].reply_to, T); assert.equal(n.enviados[0].from, "Spa Teste <noreply@guileoai.com>");
  assert.match(n.enviados[0].html, /GCABC12345/); assert.match(n.enviados[0].html, /\$50\.00/); assert.match(n.enviados[0].html, /Feliz aniversário!/); assert.match(n.enviados[0].html, /How to use it/);
  assert.match(n.enviados[0].subject, /Spa Teste: a gift card for you/);
  assert.match(n.enviados[1].html, /We also sent the code to bia@amiga\.com/, "a cópia só diz 'também enviamos' porque o primeiro saiu");
  const fv = feedVale(db); assert.equal(fv.length, 2); assert.ok(fv.every((c) => c.a.p_payload.delivery === "sent" && c.a.p_payload.receipt));
  // segunda volta: vale já entregue → NENHUM e-mail de novo
  await conferirVendaOnline(ENV_MAIL, { tenant: T, sessionId: SESS }, { svcJson: db.svc, fetch: n.f, brandFor: marca, emitFailure: async () => null });
  assert.equal(n.enviados.length, 2);
});
test("vale: Resend responde 200 SEM id → não conta como enviado; feed 'vale NÃO enviado — mandar o código à mão'", async () => {
  const db = bancoComEntrega(); const n = redeComResend(sessaoVale({}, { customer_details: { email: "bia@amiga.com" } }), [200, {}]);
  const r = await conferirVendaOnline(ENV_MAIL, { tenant: T, sessionId: SESS }, { svcJson: db.svc, fetch: n.f, brandFor: marca });
  assert.equal(r.email.sent.length, 0); assert.equal(r.email.failed.length, 1);
  const fv = feedVale(db); assert.equal(fv.length, 1); assert.match(fv[0].a.p_summary, /NÃO enviado.*mandar o código à mão/); assert.equal(fv[0].a.p_payload.code, "GCABC12345");
});
test("vale: quem ganhou recusado pelo Resend → a cópia de quem comprou NÃO diz 'também enviamos'", async () => {
  const db = bancoComEntrega(); const n = redeComResend(sessaoVale(), (c) => (c.to === "bia@amiga.com" ? [422, { message: "invalid" }] : [200, { id: "email_ok" }]));
  const r = await conferirVendaOnline(ENV_MAIL, { tenant: T, sessionId: SESS }, { svcJson: db.svc, fetch: n.f, brandFor: marca });
  assert.deepEqual(r.email.sent.map((x) => x.para), ["buyer"]); assert.equal(r.email.failed[0].reason, "resend 422");
  assert.doesNotMatch(n.enviados[1].html, /also sent the code/); assert.match(n.enviados[1].html, /Forward this email/);
  assert.ok(feedVale(db).some((c) => /NÃO enviado a bia@amiga\.com/.test(c.a.p_summary)));
});
test("vale: ninguém deixou e-mail / e-mail desligado → nenhum envio, feed manda fazer à mão", async () => {
  const db1 = bancoComEntrega(); const n1 = redeComResend(sessaoVale({ recipient_contact: "+15550002222" }, { customer_details: {} }), [200, { id: "x" }]);
  const r1 = await conferirVendaOnline(ENV_MAIL, { tenant: T, sessionId: SESS }, { svcJson: db1.svc, fetch: n1.f, brandFor: marca });
  assert.equal(n1.enviados.length, 0); assert.equal(r1.email.failed[0].reason, "sem_email"); assert.match(feedVale(db1)[0].a.p_summary, /NÃO enviado.*\+15550002222/);
  const db2 = bancoComEntrega(); const n2 = redeComResend(sessaoVale(), [200, { id: "x" }]);
  const r2 = await conferirVendaOnline(ENV, { tenant: T, sessionId: SESS }, { svcJson: db2.svc, fetch: n2.f, brandFor: marca });
  assert.equal(n2.enviados.length, 0); assert.equal(r2.email.failed[0].reason, "email_off");
});
test("página da volta: 'enviamos o código' só quando o Resend confirmou", () => {
  assert.match(textoDaVolta("en", { ok: true, kind: "giftcard", email: { sent: [{ id: "e1" }], failed: [] } })[1], /emailed the code/);
  assert.doesNotMatch(textoDaVolta("en", { ok: true, kind: "giftcard", email: { sent: [], failed: [{}] } })[1], /emailed/);
  assert.match(textoDaVolta("pt", { ok: true, kind: "giftcard", email: { sent: [{ id: "e1" }] } })[1], /enviamos o código por e-mail/);
});
test("vale pela chave própria: nome de quem ganha e recado vão no metadado (para o e-mail)", async () => {
  const db = banco(); const s = stripeFalso({ "POST /v1/checkout/sessions": [200, { id: SESS, url: "https://checkout.stripe.com/c/pay/g" }] });
  await criarVendaPropria(ENV, { tenant: T, chave: KEY, kind: "giftcard", cents: 5000, recipient: "bia@amiga.com", recipientName: "Bia\nSilva", message: "Parabéns!" }, { svcJson: db.svc, fetch: s.f });
  const c = s.pedidos[0].corpo;
  assert.equal(c.get("metadata[recipient_name]"), "Bia Silva"); assert.equal(c.get("metadata[gift_message]"), "Parabéns!");
});

// ═══ ESTORNO no Stripe PRÓPRIO (2026-10-05) ═════════════════════════════════════════════════════
// A conta própria não manda webhook: a conferência pergunta ao Stripe do negócio. O "uma vez" é do banco
// (venda_online_refund_mark_svc — provado em SQL no e2e-test); aqui: o que perguntamos, o que gravamos.
const PI = "pi_3PROVAestorno00001";
const cobranca = (over = {}) => ({ id: "ch_1", status: "succeeded", paid: true, amount: 4000, amount_refunded: 0, refunded: false, ...over });
const candidato = (over = {}) => ({ tenant: T, session: SESS, kind: "loja", payment_intent: null, cents: 4000, code: null, package: null, ...over });
function cenarioEstorno({ candidatos, charges = [200, { data: [cobranca({ amount_refunded: 4000, refunded: true })] }], mark, aviso } = {}) {
  const marcas = []; const avisos = []; const alarmes = [];
  const db = banco({
    venda_online_refund_candidates_svc: candidatos ?? [candidato()],
    venda_online_refund_mark_svc: (a) => { marcas.push(a); return typeof mark === "function" ? mark(a) : (mark ?? { ok: true, acao: a.p_estado === "nada" ? "nada" : a.p_estado === "parcial" ? "parcial_novo" : "total_novo", kind: "loja", estoque: { ok: true, cancelled: 1, restocked_units: 2 } }); },
    venda_online_refund_aviso_svc: (a) => { avisos.push(a); return typeof aviso === "function" ? aviso(a) : { ok: true, novo: a.p_ativo === true }; },
    ingest_client_event: "evt-1",
  });
  const s = stripeFalso({ "GET /v1/checkout/sessions/": [200, { id: SESS, payment_intent: PI }], "GET /v1/charges": charges });
  const deps = { svcJson: db.svc, fetch: s.f, emitFailure: async (...a) => alarmes.push(a) };
  const feed = () => db.de("ingest_client_event").map((c) => c.a);
  return { db, s, deps, marcas, avisos, alarmes, feed };
}

test("estadoDoEstorno: nada / parcial / total pelas cobranças pagas do payment_intent", () => {
  assert.equal(estadoDoEstorno([cobranca()]).estado, "nada");
  assert.equal(estadoDoEstorno([]).estado, "nada");
  assert.equal(estadoDoEstorno([cobranca({ status: "failed", paid: false, amount_refunded: 4000, refunded: true })]).estado, "nada", "cobrança que falhou não conta");
  assert.deepEqual(estadoDoEstorno([cobranca({ amount_refunded: 1000 })]), { estado: "parcial", refunded: 1000, total: 4000 });
  assert.deepEqual(estadoDoEstorno([cobranca({ amount_refunded: 4000, refunded: true })]), { estado: "total", refunded: 4000, total: 4000 });
});

test("loja estornada no Stripe do negócio: pergunta com a chave DELE, devolve o estoque pelo banco e escreve no feed", async () => {
  const x = cenarioEstorno();
  const r = await conferirEstornos(ENV, x.deps);
  assert.equal(r.ok, true); assert.equal(r.estornos, 1); assert.equal(r.falhas, 0);
  const pedidos = x.s.pedidos.map((p) => `${p.metodo} ${p.caminho}`);
  assert.deepEqual(pedidos, [`GET /v1/checkout/sessions/${SESS}`, "GET /v1/charges"]);
  assert.ok(x.s.pedidos.every((p) => p.headers.Authorization === `Bearer ${KEY}`), "só a chave do negócio");
  assert.equal(x.marcas.length, 1);
  assert.deepEqual([x.marcas[0].p_tenant, x.marcas[0].p_session, x.marcas[0].p_payment_intent, x.marcas[0].p_estado, x.marcas[0].p_refunded_cents], [T, SESS, PI, "total", 4000]);
  const f = x.feed(); assert.equal(f.length, 1);
  assert.equal(f[0].p_type, "refund"); assert.equal(f[0].p_amount, -40);
  assert.match(f[0].p_summary, /Estorno de pedido da loja · -\$40\.00 · estoque: devolvido \(1 venda\(s\), 2 peça\(s\)/);
  assert.equal(x.alarmes.length, 0);
  assert.equal(x.avisos.filter((a) => a.p_ativo === false).length, 1, "leitura funcionou → apaga marca de permissão");
});
test("payment_intent já guardado → não relê a sessão", async () => {
  const x = cenarioEstorno({ candidatos: [candidato({ payment_intent: PI })] });
  await conferirEstornos(ENV, x.deps);
  assert.deepEqual(x.s.pedidos.map((p) => p.caminho), ["/v1/charges"]);
});
test("vale estornado: NADA é anulado — uma linha no feed 'conferir o vale no Balcão' com o código", async () => {
  const x = cenarioEstorno({ candidatos: [candidato({ kind: "giftcard", code: "GCABC12345", cents: 5000 })], charges: [200, { data: [cobranca({ amount: 5000, amount_refunded: 5000, refunded: true })] }],
    mark: (a) => ({ ok: true, acao: a.p_estado === "total" ? "total_novo" : "nada", kind: "giftcard", estoque: null }) });
  const r = await conferirEstornos(ENV, x.deps);
  assert.equal(r.estornos, 1);
  const f = x.feed(); assert.equal(f.length, 1);
  assert.match(f[0].p_summary, /Estornado no Stripe — conferir o vale no Balcão · vale GCABC12345 · -\$50\.00/);
  assert.equal(f[0].p_payload.code, "GCABC12345");
  for (const c of x.db.chamadas) assert.doesNotMatch(c.fn, /gift_card_redeem|giftcard_(create|update|void)|package_/, `não mexe no saldo: ${c.fn}`);
});
test("pacote estornado: feed 'conferir o pacote no Balcão' com o nome", async () => {
  const x = cenarioEstorno({ candidatos: [candidato({ kind: "package", package: "5 massagens" })], mark: (a) => ({ ok: true, acao: "total_novo", kind: "package" }) });
  await conferirEstornos(ENV, x.deps);
  assert.match(x.feed()[0].p_summary, /conferir o pacote no Balcão · pacote "5 massagens"/);
});
test("sem estorno → só marca 'nada' (a fila anda), nenhum feed", async () => {
  const x = cenarioEstorno({ charges: [200, { data: [cobranca()] }] });
  const r = await conferirEstornos(ENV, x.deps);
  assert.equal(r.sem_estorno, 1); assert.equal(x.marcas[0].p_estado, "nada"); assert.equal(x.feed().length, 0);
});
test("já tratado (o banco diz) → nenhuma linha nova: o estorno nunca repete", async () => {
  const x = cenarioEstorno({ mark: { ok: true, acao: "ja_tratado", kind: "loja" } });
  const r = await conferirEstornos(ENV, x.deps);
  assert.equal(r.ja_tratados, 1); assert.equal(x.feed().length, 0); assert.equal(x.alarmes.length, 0);
});
test("loja com estorno PARCIAL → estoque intocado, feed + alarme uma vez", async () => {
  const x = cenarioEstorno({ charges: [200, { data: [cobranca({ amount_refunded: 1500 })] }] });
  const r = await conferirEstornos(ENV, x.deps);
  assert.equal(r.parciais, 1); assert.equal(x.marcas[0].p_estado, "parcial");
  assert.match(x.feed()[0].p_summary, /PARCIAL.*-\$15\.00 de \$40\.00.*estoque NÃO mexido/);
  assert.equal(x.alarmes[0][1], "estorno_loja_estoque");
});
test("o banco não registrou um estorno total → alarme (nunca silêncio), nenhum feed de 'devolvido'", async () => {
  const x = cenarioEstorno({ mark: (a) => (a.p_estado === "total" ? { ok: false, reason: "estorno_loja_falhou" } : { ok: true, acao: "nada" }) });
  const r = await conferirEstornos(ENV, x.deps);
  assert.equal(r.falhas, 1); assert.equal(x.feed().length, 0);
  assert.equal(x.alarmes[0][1], "estorno_loja_estoque"); assert.match(x.alarmes[0][3], /estorno_loja_falhou/);
});
test("loja estornada mas nenhuma venda achada pelo prefixo → alarme", async () => {
  const x = cenarioEstorno({ mark: { ok: true, acao: "total_novo", kind: "loja", estoque: { ok: true, cancelled: 0, restocked_units: 0 } } });
  await conferirEstornos(ENV, x.deps);
  assert.equal(x.alarmes.length, 1); assert.match(x.alarmes[0][3], /estoque NÃO voltou/);
});
test("chave sem 'Charges: Read' → UM aviso ao dono (não um por hora); a fila anda", async () => {
  const proibido = [403, { error: { message: "The provided key 'rk_live_...' does not have the required permissions for this endpoint. Having the 'rak_charge_read' permission would allow this request to continue." } }];
  const ja = new Set();
  const avisoUmaVez = (a) => { if (!a.p_ativo) { ja.delete(a.p_tenant); return { ok: true, novo: false }; } const novo = !ja.has(a.p_tenant); ja.add(a.p_tenant); return { ok: true, novo }; };
  const x = cenarioEstorno({ candidatos: [candidato(), candidato({ session: "cs_live_OUTRAsessao123456" })], charges: proibido, aviso: avisoUmaVez });
  const r1 = await conferirEstornos(ENV, x.deps);
  assert.equal(r1.sem_permissao, 2); assert.equal(r1.ok, true);
  assert.equal(x.s.pedidos.filter((p) => p.caminho === "/v1/charges").length, 1, "a 2ª venda do mesmo negócio nem pergunta");
  assert.ok(x.marcas.length === 2 && x.marcas.every((m) => m.p_estado === "nada"), "nenhuma venda é dada como estornada; só gira a fila");
  const f1 = x.feed(); assert.equal(f1.length, 1); assert.match(f1[0].p_summary, /Charges: Read/); assert.equal(f1[0].p_email, T);
  assert.equal(x.alarmes[0][1], "estorno_sem_permissao");
  // próxima hora: o aviso já foi dado
  await conferirEstornos(ENV, x.deps);
  assert.equal(x.feed().length, 1); assert.equal(x.alarmes.length, 1);
});
test("lista das vendas entregues ilegível → ok:false (o endpoint responde 503, nada é inventado)", async () => {
  const x = cenarioEstorno({ candidatos: { ok: false, erro_http: 500 } });
  const r = await conferirEstornos(ENV, x.deps);
  assert.equal(r.ok, false); assert.equal(x.s.pedidos.length, 0);
});
