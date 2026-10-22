import { test } from "node:test";
import assert from "node:assert/strict";
import { ehCodigoDoBalcao, podeAcessoFazer, novoCodigo, hashCodigo, abrirComCodigo, filtrarAgendaDela, STATUS_DA_PROFISSIONAL } from "./deskAcesso.js";

test("código novo tem o formato e é aleatório", () => {
  const a = novoCodigo(), b = novoCodigo();
  assert.ok(ehCodigoDoBalcao(a), a);
  assert.notEqual(a, b);
  assert.equal(ehCodigoDoBalcao("a1b2c3"), false);              // chave da dona não é código de recepção
  assert.equal(ehCodigoDoBalcao("bal_" + "A".repeat(26)), false);
});

test("recepção: o dia sim, o dinheiro e os ajustes não", () => {
  for (const a of ["agenda", "book", "status", "checkout", "client_card", "day_close"]) assert.ok(podeAcessoFazer("recepcao", a), a);
  for (const a of ["void", "reports", "staff_save", "service_save", "import_clients", "acessos_criar", "acessos_list", "publico_cruzado"]) assert.equal(podeAcessoFazer("recepcao", a), false, a);
  assert.equal(podeAcessoFazer("dono", "agenda"), false);          // papel desconhecido = nada
});

test("hash é o SHA-256 em hex", async () => {
  assert.equal(await hashCodigo("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

const codigo = "bal_" + "a".repeat(26);
test("abrirComCodigo: código certo troca pela chave do servidor", async () => {
  let pedido;
  const svc = async (_e, fn, body) => { pedido = { fn, body }; return { ok: true, id: "x", nome: "Ana", papel: "recepcao", chave: "dona123" }; };
  const r = await abrirComCodigo({}, svc, { email: "a@b.co", codigo, acao: "agenda" });
  assert.equal(r.ok, true); assert.equal(r.chave, "dona123"); assert.equal(r.acesso.nome, "Ana");
  assert.equal(pedido.fn, "desk_acesso_entrar_svc");
  assert.equal(pedido.body.p_hash.length, 64);                     // o código cru nunca vai ao banco
  assert.ok(!JSON.stringify(pedido.body).includes(codigo));
});

test("abrirComCodigo: ação fora do papel → 403, sem chave", async () => {
  const svc = async () => ({ ok: true, papel: "recepcao", chave: "dona123" });
  const r = await abrirComCodigo({}, svc, { email: "a@b.co", codigo, acao: "reports" });
  assert.equal(r.http, 403); assert.equal(r.corpo.reason, "role_forbidden"); assert.equal(r.chave, undefined);
});

test("abrirComCodigo: código revogado/errado → 401; banco fora → 503", async () => {
  assert.equal((await abrirComCodigo({}, async () => ({ ok: false, reason: "unauthorized" }), { email: "a@b.co", codigo, acao: "agenda" })).http, 401);
  assert.equal((await abrirComCodigo({}, async () => null, { email: "a@b.co", codigo, acao: "agenda" })).http, 401);
  assert.equal((await abrirComCodigo({}, async () => ({ ok: false, erro_http: 500 }), { email: "a@b.co", codigo, acao: "agenda" })).http, 503);
  assert.equal((await abrirComCodigo({}, async () => ({ ok: false, detalhe: "TypeError: fetch failed" }), { email: "a@b.co", codigo, acao: "agenda" })).http, 503);
});

test("profissional: só o dia dela — nada de caixa, cliente, relatório", () => {
  for (const a of ["agenda", "note", "status", "quem"]) assert.ok(podeAcessoFazer("profissional", a), a);
  for (const a of ["book", "move", "checkout", "client_card", "client_search", "reports", "void", "day_close", "block"]) assert.equal(podeAcessoFazer("profissional", a), false, a);
  assert.ok(STATUS_DA_PROFISSIONAL.has("completed")); assert.equal(STATUS_DA_PROFISSIONAL.has("cancelled"), false); assert.equal(STATUS_DA_PROFISSIONAL.has("no_show"), false);
});

test("filtrarAgendaDela: só os agendamentos dela e sem contato", () => {
  const dados = { ok: true, locations: [{ id: "L" }], pros: [{ id: "ana" }, { id: "bia" }],
    appointments: [{ id: 1, pro_id: "ana", customer_name: "X", customer_contact: "+1718" }, { id: 2, pro_id: "bia", customer_contact: "+1999" }],
    blocks: [{ pro_id: "ana" }, { pro_id: "bia" }] };
  const f = filtrarAgendaDela(dados, "ana");
  assert.deepEqual(f.pros.map((p) => p.id), ["ana"]);
  assert.deepEqual(f.appointments.map((a) => a.id), [1]);
  assert.equal(f.appointments[0].customer_contact, "");
  assert.equal(f.appointments[0].customer_name, "X");
  assert.equal(f.blocks.length, 1);
  assert.equal(dados.appointments[0].customer_contact, "+1718");      // original intacto
  assert.ok(!JSON.stringify(f).includes("+1999"));
  assert.equal(filtrarAgendaDela(dados, "").ok, false);
});

test("abrirComCodigo: profissional sem pro_id não entra", async () => {
  const r = await abrirComCodigo({}, async () => ({ ok: true, papel: "profissional", chave: "k", pro_id: null }), { email: "a@b.co", codigo, acao: "agenda" });
  assert.equal(r.http, 401);
  const r2 = await abrirComCodigo({}, async () => ({ ok: true, papel: "profissional", chave: "k", pro_id: "ana" }), { email: "a@b.co", codigo, acao: "agenda" });
  assert.equal(r2.acesso.pro_id, "ana");
});
