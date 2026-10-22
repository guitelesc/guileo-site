// node --test functions/lib/relatorioMensal.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { escolheMensais, mesAnterior } from "./relatorioMensal.js";

test("mês anterior vira o ano em janeiro", () => {
  assert.equal(mesAnterior("2026-10-01"), "2026-09");
  assert.equal(mesAnterior("2027-01-01"), "2026-12");
});
const c = (o = {}) => ({ client_email: "dona@x.com", hora: 7, tz: "America/New_York", ...o });
test("dia 1, 7h em NY → manda o mês anterior", () => {
  const agora = new Date("2026-11-01T12:10:00Z");                 // 07:10 em NY (EST — o horário de verão acaba nesse dia)
  assert.deepEqual(escolheMensais([c()], agora), [{ email: "dona@x.com", destino: "dona@x.com", lang: "en", mes: "2026-10" }]);
});
test("não é dia 1, ou não é a hora, ou o mês já foi → ninguém", () => {
  assert.equal(escolheMensais([c()], new Date("2026-11-02T12:10:00Z")).length, 0);
  assert.equal(escolheMensais([c()], new Date("2026-11-01T15:10:00Z")).length, 0);
  assert.equal(escolheMensais([c({ ultimo_mes: "2026-10" })], new Date("2026-11-01T12:10:00Z")).length, 0);
});
test("o dia 1 é o do fuso do negócio, não o de UTC", () => {
  // 2026-11-01 03:30 UTC ainda é 31/out em NY → não manda
  assert.equal(escolheMensais([c({ hora: 23 })], new Date("2026-11-01T03:30:00Z")).length, 0);
});
test("destino e idioma", () => {
  const r = escolheMensais([c({ email_destino: "contab@x.com", lang: "pt" })], new Date("2026-11-01T12:10:00Z"));
  assert.equal(r[0].destino, "contab@x.com"); assert.equal(r[0].lang, "pt");
});
