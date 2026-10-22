// O SINAL NA PÁGINA PÚBLICA /agendar — POST /api/vitrine-agenda op "marcar" (2026-10-05)
// Mora em functions/lib/ (não em functions/api/, que é diretório de ROTAS — ver vitrineAgenda.test.mjs).
// Tudo com fetch FALSO: nenhum Stripe, nenhum banco de verdade.
//   · sinal cadastrado + Stripe do negócio → a resposta traz `deposito:{url,cents,janela_h}`
//   · cliente de confiança → sem `deposito`
//   · negócio sem Stripe ligado → sem `deposito`
//   · Stripe lento → a reserva sai OK, sem `deposito` (o sinal nunca derruba a reserva)
//   · Stripe fora do ar (fetch lança) → idem
import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../api/vitrine-agenda.js";

const TENANT = "e2e-test@guileoai.com";
const APPT = "11111111-2222-3333-4444-555555555555";
const INFO = { ok: true, id: APPT, customer_contact: "+12125550147", service: "Massage 60min", deposit_cents: 3000, deposit_paid: false, trusted: false };

function montar({ info = INFO, propria = true, stripe = "ok", motor = {} } = {}) {
  const log = { rpc: [], stripe: 0, motor: null };
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url);
    const corpo = op.body ? (() => { try { return JSON.parse(op.body); } catch { return op.body; } })() : null;
    const resp = (d, status = 200) => ({ ok: status < 400, status, json: async () => d, text: async () => JSON.stringify(d) });
    if (u.includes("/rest/v1/rpc/")) {
      const fn = u.split("/rpc/")[1];
      log.rpc.push([fn, corpo]);
      if (fn === "client_site_owner") return resp(TENANT);
      if (fn === "desk_can_book_online") return resp(true);
      if (fn === "desk_deposit_info_svc") return resp(info);
      if (fn === "stripe_own_lookup_svc") return resp(propria ? { secret_key: "rk_test_NEGOCIO1234567890" } : null);
      if (fn === "client_stripe_lookup") return resp(null);
      if (fn === "desk_late_cancel_info_svc") return resp({ ok: true, window_h: 24 });
      return resp({ ok: true });
    }
    if (u.includes("/api/agent-schedule")) {
      log.motor = { corpo, headers: op.headers };
      return resp({ ok: true, appointment_id: APPT, status: "booked", ...motor });
    }
    if (u.includes("api.stripe.com")) {
      log.stripe++;
      if (stripe === "lento") return new Promise(() => {});           // nunca responde
      if (stripe === "caiu") throw new Error("network down");
      return resp({ url: "https://checkout.stripe.com/c/pay/cs_test_vitrine", id: "cs_test_vitrine" });
    }
    throw new Error("fetch inesperado: " + u);
  };
  return log;
}

const marcar = (env = {}) => onRequestPost({
  request: new Request("https://guileoai.com/api/vitrine-agenda", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://guileoai.com" },
    body: JSON.stringify({ slug: "e2e-test", op: "marcar", servico: "Massage 60min", quando: "2026-10-20T14:00:00Z", nome: "Teste", telefone: "+12125550147", lang: "pt" }) }),
  env: { AGENT_ACTION_SECRET: "a", INGEST_SECRET: "i", ...env },
});

test("sinal cadastrado + Stripe próprio → reserva OK com deposito {url, cents, janela_h}", async () => {
  const log = montar();
  const r = await marcar(); const d = await r.json();
  assert.equal(r.status, 200); assert.equal(d.ok, true); assert.equal(d.id, APPT);
  assert.deepEqual(d.deposito, { url: "https://checkout.stripe.com/c/pay/cs_test_vitrine", cents: 3000, janela_h: 24 });
  // o negócio continua preso no cabeçalho do motor (não mexi na chamada)
  assert.equal(log.motor.headers["x-guileo-client"], TENANT);
  assert.equal(log.motor.corpo.op, "book");
  const marca = log.rpc.find(([fn]) => fn === "desk_deposit_link_mark");
  assert.equal(marca[1].p_canal, "web"); assert.equal(marca[1].p_tenant, TENANT); assert.equal(marca[1].p_id, APPT);
});

test("cliente de confiança → reserva OK, sem deposito, Stripe nem é chamado", async () => {
  const log = montar({ info: { ...INFO, trusted: true } });
  const d = await (await marcar()).json();
  assert.equal(d.ok, true); assert.equal(d.deposito, undefined); assert.equal(log.stripe, 0);
});

test("negócio sem Stripe ligado → reserva OK, sem deposito", async () => {
  const log = montar({ propria: false });
  const d = await (await marcar()).json();
  assert.equal(d.ok, true); assert.equal(d.deposito, undefined); assert.equal(log.stripe, 0);
});

test("serviço sem sinal → reserva OK, sem deposito", async () => {
  montar({ info: { ...INFO, deposit_cents: 0 } });
  const d = await (await marcar()).json();
  assert.equal(d.ok, true); assert.equal(d.deposito, undefined);
});

test("Stripe lento → a reserva sai OK dentro do teto, sem deposito", async () => {
  const log = montar({ stripe: "lento" });
  const t0 = Date.now();
  const r = await marcar({ SINAL_TELA_MS: "80" }); const d = await r.json();
  assert.equal(r.status, 200); assert.equal(d.ok, true); assert.equal(d.id, APPT); assert.equal(d.deposito, undefined);
  assert.ok(Date.now() - t0 < 2000); assert.equal(log.stripe, 1);
});

test("Stripe fora do ar → a reserva sai OK, sem deposito", async () => {
  montar({ stripe: "caiu" });
  const d = await (await marcar()).json();
  assert.equal(d.ok, true); assert.equal(d.deposito, undefined);
});

test("horário SEGURADO (hold) → não pede sinal (igual à agente)", async () => {
  const log = montar({ motor: { status: "hold" } });
  const d = await (await marcar()).json();
  assert.equal(d.ok, true); assert.equal(d.deposito, undefined);
  assert.equal(log.rpc.filter(([fn]) => fn === "desk_deposit_info_svc").length, 0);
});

test("motor sem comprovante → falha honesta, e o sinal nem é tentado", async () => {
  const log = montar({ motor: { appointment_id: null, ok: false, message: "slot_taken" } });
  const r = await marcar();
  assert.equal(r.status, 409);
  assert.equal(log.rpc.filter(([fn]) => fn === "desk_deposit_info_svc").length, 0);
});
