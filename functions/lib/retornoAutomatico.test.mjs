import { test } from "node:test";
import assert from "node:assert/strict";
import { podeRetornar } from "./retornoAutomatico.js";

const livre = async () => false, bloqueado = async () => true, fora = async () => { throw new Error("x"); };

test("EUA e Brasil, lista lida e limpa: liga de volta", async () => {
  assert.deepEqual(await podeRetornar({}, "+12125550123", livre), { ok: true, e164: "+12125550123" });
  assert.equal((await podeRetornar({}, "+5565999990000", livre)).ok, true);
});
test("o golpe de 09/2026: +972 não recebe retorno", async () => {
  const r = await podeRetornar({}, "+97221234567", livre);
  assert.equal(r.ok, false); assert.equal(r.motivo, "pais_fora");
});
test("ilha cara dentro do +1 e 900 não recebem retorno", async () => {
  assert.equal((await podeRetornar({}, "+18765551234", livre)).motivo, "nanp_internacional");
  assert.equal((await podeRetornar({}, "+19005551234", livre)).motivo, "nanp_internacional");
});
test("mercado novo abre pelo CALL_DDI_EXTRA, sem deploy", async () => {
  assert.equal((await podeRetornar({ CALL_DDI_EXTRA: "+351" }, "+351912345678", livre)).ok, true);
  assert.equal((await podeRetornar({}, "+351912345678", livre)).ok, false);
});
test("quem pediu para não receber não recebe", async () => {
  assert.equal((await podeRetornar({}, "+12125550123", bloqueado)).motivo, "dnc");
});
test("lista que não foi LIDA é ligação que não sai", async () => {
  assert.equal((await podeRetornar({}, "+12125550123", fora)).motivo, "dnc_nao_lido");
  assert.equal((await podeRetornar({}, "+12125550123", async () => null)).motivo, "dnc_nao_lido");
  assert.equal((await podeRetornar({}, "+12125550123", async () => "false")).motivo, "dnc_nao_lido");
});
test("número sem + ou lixo não vira palpite de país", async () => {
  for (const n of ["2125550123", "", null, "client:abc", "+12", "anonymous"])
    assert.equal((await podeRetornar({}, n, livre)).motivo, "numero_invalido");
});
test("o destino é conferido ANTES de gastar uma leitura da lista", async () => {
  let leu = 0;
  await podeRetornar({}, "+97221234567", async () => { leu++; return false; });
  assert.equal(leu, 0);
});
