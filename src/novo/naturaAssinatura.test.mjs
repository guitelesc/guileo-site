// node --test src/novo/naturaAssinatura.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASSINATURA, EXEMPLOS, planosPublicos, perksDe, valorDe, porDe, oQueMostrar, emailValido } from "./naturaAssinatura.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

test("planosPublicos: só ativo, com preço, mensal/anual — e nunca o número de assinantes", () => {
  const out = planosPublicos([
    { id: A, name: " Monthly Glow ", price_cents: 10500, interval: "month", perks: "x", active: true, subscribers: 7, client_email: "s@x.com" },
    { id: B, name: "Yearly", price_cents: 99000, interval: "year", perks: "", active: true },
    { id: "33333333-3333-4333-8333-333333333333", name: "Off", price_cents: 5000, interval: "month", active: false },
    { id: "44444444-4444-4444-8444-444444444444", name: "Grátis", price_cents: 0, interval: "month", active: true },
    { id: "55555555-5555-4555-8555-555555555555", name: "Semanal", price_cents: 3000, interval: "week", active: true },
    { id: "ex-massage", name: "Exemplo", price_cents: 9900, interval: "month", active: true },
    null,
  ]);
  assert.deepEqual(out.map((p) => p.name), ["Yearly", "Monthly Glow"]);   // 990/12 = 82,5 por mês < 105
  assert.equal("subscribers" in out[1], false);
  assert.equal("client_email" in out[1], false);
  assert.deepEqual(planosPublicos("lixo"), []);
});

test("perksDe: quebra por linha, • e ; — tira marcadores, no máximo 6", () => {
  assert.deepEqual(perksDe("- One massage\n• One facial; Priority booking\n\n"), ["One massage", "One facial", "Priority booking"]);
  assert.equal(perksDe("a\nb\nc\nd\ne\nf\ng").length, 6);
  assert.deepEqual(perksDe(null), []);
});

test("valorDe / porDe", () => {
  assert.equal(valorDe(9900), "$99");
  assert.equal(valorDe(10450), "$104.50");
  assert.equal(porDe("year"), "year");
  assert.equal(porDe("qualquer"), "month");
});

test("oQueMostrar: exemplo só desligado; ligado sem plano some", () => {
  assert.equal(oQueMostrar({ aoVivo: false, planos: [] }), "exemplo");
  assert.equal(oQueMostrar({ aoVivo: false, planos: null }), "exemplo");
  assert.equal(oQueMostrar({ aoVivo: true, planos: [] }), "nada");
  assert.equal(oQueMostrar({ aoVivo: true, planos: [{ id: A }] }), "real");
  assert.equal(oQueMostrar({ aoVivo: false, planos: [{ id: A }] }), "real");
});

test("emailValido", () => {
  assert.equal(emailValido("maria@example.com"), true);
  assert.equal(emailValido("maria@x"), false);
  assert.equal(emailValido(""), false);
  assert.equal(emailValido(`${"a".repeat(160)}@x.com`), false);
});

test("exemplos: preço abaixo do cardápio e só serviço que EXISTE no MENU da página", () => {
  const pagina = readFileSync(new URL("./NaturaSpa.jsx", import.meta.url), "utf8");
  for (const n of ["Swedish", "Hot Stone", "Deep Tissue", "Natura Spa Signature Facial"]) assert.ok(pagina.includes(`["${n}"`), `${n} sumiu do MENU`);
  for (const e of EXEMPLOS) {
    assert.equal(e.interval, "month");
    assert.ok(!/^[0-9a-f]{8}-/.test(e.id), "exemplo não pode ter id que o checkout aceite");
  }
  assert.equal(ASSINATURA.aoVivo, false, "ligar só com plano real cadastrado e Stripe do salão");
});
