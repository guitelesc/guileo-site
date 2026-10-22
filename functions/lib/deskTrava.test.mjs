// node --test functions/lib/deskTrava.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { podeNoDesk } from "./deskTrava.js";

test("legado (sem assinatura) não perde nada", () => {
  for (const a of ["agenda", "checkout", "reports", "assistente"]) assert.equal(podeNoDesk(null, a).ok, true, a);
});
test("Basic marca e vê a agenda, mas não cobra nem vê relatório", () => {
  assert.equal(podeNoDesk("basic", "book").ok, true);
  assert.deepEqual(podeNoDesk("basic", "checkout"), { ok: false, precisa: "medium" });
  assert.deepEqual(podeNoDesk("basic", "reports"), { ok: false, precisa: "pro" });
});
test("Pro tem a IA; Ultra e Personalizado têm tudo", () => {
  assert.equal(podeNoDesk("pro", "assistente").ok, true);
  assert.equal(podeNoDesk("medium", "assistente").ok, false);
  assert.equal(podeNoDesk("ultra", "reports").ok, true);
  assert.equal(podeNoDesk("custom", "deposit_link").ok, true);
});
test("assinatura cancelada só lê a agenda", () => {
  assert.equal(podeNoDesk("nenhum", "agenda").ok, true);
  assert.equal(podeNoDesk("nenhum", "book").ok, false);
});
test("ação desconhecida exige pelo menos o Basic", () => {
  assert.equal(podeNoDesk("basic", "algo_novo").ok, true);
  assert.equal(podeNoDesk("nenhum", "algo_novo").ok, false);
});
