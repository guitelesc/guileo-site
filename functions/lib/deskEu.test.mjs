import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HORAS_ESQUECIDO, podeEu, acaoExiste, abrirEu, situacaoDoTurno, minutosDoTurno, diaLocal, horaLocal, semanaDe, ehDia,
  statusDoBalcao, resumoDoPonto, csvDoPonto, validarCorrecao, responderEu,
} from "./deskEu.js";

const H = 3600000;
const NY = "America/New_York";
const codigo = "bal_" + "a".repeat(26);

// ── lista própria ──────────────────────────────────────────────────────────────────────────────
test("lista: equipe bate e vê o ponto; só a profissional vê o mês; só a dona lê e acerta", () => {
  for (const p of ["recepcao", "profissional"]) { assert.ok(podeEu(p, "ponto_status")); assert.ok(podeEu(p, "ponto_bater")); }
  assert.ok(podeEu("profissional", "meu_mes"));
  assert.equal(podeEu("recepcao", "meu_mes"), false);
  for (const p of ["recepcao", "profissional"]) { assert.equal(podeEu(p, "ponto_relatorio"), false); assert.equal(podeEu(p, "ponto_corrigir"), false); }
  assert.ok(podeEu("dono", "ponto_relatorio")); assert.ok(podeEu("dono", "ponto_corrigir"));
  for (const a of ["ponto_bater", "ponto_status", "meu_mes"]) assert.equal(podeEu("dono", a), false, a);   // a dona não bate ponto
  assert.equal(podeEu("profissional", "agenda"), false);      // a lista do /api/desk não vaza para cá
  assert.equal(podeEu("gerente", "ponto_bater"), false);
  assert.equal(acaoExiste("constructor"), false); assert.equal(acaoExiste("toString"), false);
});

test("abrirEu: código certo → acesso SEM a chave da dona; o código cru nunca vai ao banco", async () => {
  let pedido;
  const svc = async (_e, fn, body) => { pedido = { fn, body }; return { ok: true, id: "A1", nome: "Ana", papel: "profissional", pro_id: "P1", chave: "dona123" }; };
  const r = await abrirEu({}, svc, { email: "a@b.co", codigo, acao: "meu_mes" });
  assert.equal(r.ok, true); assert.deepEqual(r.acesso, { id: "A1", nome: "Ana", papel: "profissional", pro_id: "P1" });
  assert.ok(!JSON.stringify(r).includes("dona123"));
  assert.equal(pedido.fn, "desk_acesso_entrar_svc"); assert.equal(pedido.body.p_hash.length, 64); assert.ok(!JSON.stringify(pedido.body).includes(codigo));
});

test("abrirEu: 503 / 401 / 403 iguais ao abrirComCodigo", async () => {
  const a = (svc, acao = "ponto_bater") => abrirEu({}, svc, { email: "a@b.co", codigo, acao });
  assert.equal((await a(async () => ({ ok: false, erro_http: 500 }))).http, 503);
  assert.equal((await a(async () => { throw new Error("fetch failed"); })).http, 503);
  assert.equal((await a(async () => ({ ok: false, reason: "unauthorized" }))).http, 401);        // revogado
  assert.equal((await a(async () => null)).http, 401);
  assert.equal((await a(async () => ({ ok: true, id: "A", papel: "profissional", pro_id: null }))).http, 401);
  const r = await a(async () => ({ ok: true, id: "A", papel: "recepcao" }), "meu_mes");
  assert.equal(r.http, 403); assert.equal(r.corpo.reason, "role_forbidden");
});

// ── regra das 16 h ─────────────────────────────────────────────────────────────────────────────
test("16 h: aberto até 15:59 conta; 16 h ou mais = esqueceu a saída, sem hora inventada", () => {
  assert.equal(HORAS_ESQUECIDO, 16);
  const agora = Date.parse("2026-10-05T20:00:00Z");
  const t = (h) => ({ id: "t", entrada: new Date(agora - h * H).toISOString(), saida: null });
  assert.equal(situacaoDoTurno(t(15.99), agora), "aberto");
  assert.equal(minutosDoTurno(t(2), agora), 120);
  assert.equal(situacaoDoTurno(t(16), agora), "esquecido");
  assert.equal(minutosDoTurno(t(17), agora), null);
  assert.equal(situacaoDoTurno({ ...t(1), esquecido_em: "2026-10-05T19:00:00Z" }, agora), "esquecido");   // o banco já marcou
  assert.equal(situacaoDoTurno({ entrada: t(30).entrada, saida: new Date(agora - 22 * H).toISOString() }, agora), "fechado");   // acertado pela dona
});

// ── fuso e horário de verão ────────────────────────────────────────────────────────────────────
test("horário de verão (fim, 01/11/2026 em NY): conta o tempo REAL — 8h30, não 7h30 do relógio", () => {
  // 00:30 EDT → 08:00 EST: o relógio diz 7h30, mas passaram 8h30 (a hora 1h se repete).
  const t = { entrada: "2026-11-01T04:30:00Z", saida: "2026-11-01T13:00:00Z" };
  assert.equal(minutosDoTurno(t, Date.parse("2026-11-02T00:00:00Z")), 510);
  assert.equal(horaLocal(t.entrada, NY), "2026-11-01 00:30");
  assert.equal(horaLocal(t.saida, NY), "2026-11-01 08:00");
});

test("horário de verão (início, 08/03/2026 em NY): 01:30 EST → 03:30 EDT = 1 h", () => {
  assert.equal(minutosDoTurno({ entrada: "2026-03-08T06:30:00Z", saida: "2026-03-08T07:30:00Z" }, Date.parse("2026-03-09T00:00:00Z")), 60);
  assert.equal(horaLocal("2026-03-08T07:30:00Z", NY), "2026-03-08 03:30");
});

test("dia do turno = dia da ENTRADA na parede do negócio (não o UTC)", () => {
  assert.equal(diaLocal("2026-10-06T02:00:00Z", NY), "2026-10-05");      // 22h de segunda em NY
  assert.equal(diaLocal("2026-10-06T02:00:00Z", "America/Sao_Paulo"), "2026-10-05");
  assert.equal(diaLocal("2026-10-06T04:30:00Z", NY), "2026-10-06");
});

test("semana começa na segunda (atravessa mês e o fim do horário de verão)", () => {
  assert.equal(semanaDe("2026-11-01"), "2026-10-26");   // domingo do fim do horário de verão
  assert.equal(semanaDe("2026-11-02"), "2026-11-02");
  assert.equal(semanaDe("2026-10-05"), "2026-10-05");
  assert.equal(semanaDe("2026-03-01"), "2026-02-23");
  assert.ok(ehDia("2026-02-28")); assert.equal(ehDia("2026-02-30"), false); assert.equal(ehDia("2026-2-3"), false);
});

// ── telas ──────────────────────────────────────────────────────────────────────────────────────
test("statusDoBalcao: dentro + horas de hoje/semana; esquecido não soma", () => {
  const agora = Date.parse("2026-10-07T18:00:00Z");   // quarta 14h em NY
  const r = statusDoBalcao([
    { id: "a", entrada: "2026-10-07T13:00:00Z", saida: null },                                 // aberto há 5 h
    { id: "b", entrada: "2026-10-05T13:00:00Z", saida: "2026-10-05T21:00:00Z" },               // segunda, 8 h
    { id: "c", entrada: "2026-10-06T13:00:00Z", saida: null, esquecido_em: "2026-10-07T13:00:00Z" },
    { id: "d", entrada: "2026-10-02T13:00:00Z", saida: "2026-10-02T17:00:00Z" },               // semana passada
  ], NY, agora);
  assert.equal(r.dentro, true); assert.equal(r.aberto.id, "a");
  assert.deepEqual(r.esquecidos.map((x) => x.id), ["c"]);
  assert.equal(r.hoje_min, 300); assert.equal(r.semana_min, 300 + 480);
});

test("resumoDoPonto: por pessoa, dia e semana; aberto/esquecido não viram horas; pendente de antes fica fora do total", () => {
  const agora = Date.parse("2026-11-03T15:00:00Z");
  const turnos = [
    { id: "1", acesso_id: "A", nome: "Ana", papel: "profissional", entrada: "2026-11-01T04:30:00Z", saida: "2026-11-01T13:00:00Z" },   // 510 (verão)
    { id: "2", acesso_id: "A", nome: "Ana", papel: "profissional", entrada: "2026-11-02T13:00:00Z", saida: "2026-11-02T21:00:00Z" },   // 480
    { id: "3", acesso_id: "B", nome: "Bia", papel: "recepcao", entrada: "2026-11-03T13:00:00Z", saida: null },                         // aberto
    { id: "4", acesso_id: "B", nome: "Bia", papel: "recepcao", entrada: "2026-10-20T13:00:00Z", saida: null, esquecido_em: "x" },       // pendente de antes
  ];
  const r = resumoDoPonto(turnos, NY, agora, { de: "2026-11-01", ate: "2026-11-03" });
  const ana = r.pessoas.find((p) => p.nome === "Ana"), bia = r.pessoas.find((p) => p.nome === "Bia");
  assert.equal(ana.total_min, 990);
  assert.deepEqual(ana.dias, { "2026-11-01": 510, "2026-11-02": 480 });
  assert.deepEqual(ana.semanas, { "2026-10-26": 510, "2026-11-02": 480 });
  assert.equal(bia.total_min, 0); assert.equal(bia.abertos, 1); assert.equal(bia.esquecidos, 1);
  assert.equal(r.esquecidos, 1); assert.equal(r.abertos, 1);
  const t4 = r.turnos.find((t) => t.id === "4"); assert.equal(t4.no_periodo, false); assert.equal(t4.minutos, null);
  const t3 = r.turnos.find((t) => t.id === "3"); assert.equal(t3.em_andamento_min, 120); assert.equal(t3.minutos, null);
});

test("CSV: horas no fuso do negócio, esquecido sem horas, sem fórmula injetada", () => {
  const agora = Date.parse("2026-11-03T15:00:00Z");
  const r = resumoDoPonto([
    { id: "1", acesso_id: "A", nome: "=HYPERLINK(\"x\")", papel: "profissional", entrada: "2026-11-01T04:30:00Z", saida: "2026-11-01T13:00:00Z", ajustes: 1, motivo: "esqueceu, acertei" },
    { id: "2", acesso_id: "B", nome: "Bia", papel: "recepcao", entrada: "2026-10-20T13:00:00Z", saida: null, esquecido_em: "x" },
  ], NY, agora);
  const linhas = csvDoPonto(r, NY).split("\n");
  assert.equal(linhas[0], "nome,papel,dia,entrada,saida,minutos,horas,situacao,acertado,motivo");
  assert.ok(linhas[2].startsWith(`"'=HYPERLINK(""x"")",profissional,2026-11-01,2026-11-01 00:30,2026-11-01 08:00,510,8.50,fechado,sim,"esqueceu, acertei"`), linhas[2]);
  assert.equal(linhas[1], "Bia,recepcao,2026-10-20,2026-10-20 09:00,,,,esqueceu a saída,,");
});

test("validarCorrecao: motivo, ordem, 24 h, futuro", () => {
  const agora = Date.parse("2026-10-05T20:00:00Z"), id = "11111111-2222-4333-8444-555555555555";
  assert.equal(validarCorrecao({ id, saida: "2026-10-05T18:00:00Z", motivo: "" }, agora).reason, "reason_required");
  assert.equal(validarCorrecao({ id: "x", saida: "2026-10-05T18:00:00Z", motivo: "ok ok" }, agora).reason, "bad_request");
  assert.equal(validarCorrecao({ id, motivo: "nada muda" }, agora).reason, "bad_request");
  assert.equal(validarCorrecao({ id, entrada: "2026-10-05T18:00:00Z", saida: "2026-10-05T17:00:00Z", motivo: "trocado" }, agora).reason, "invalid_hours");
  assert.equal(validarCorrecao({ id, entrada: "2026-10-03T18:00:00Z", saida: "2026-10-05T17:00:00Z", motivo: "longo" }, agora).reason, "too_long");
  assert.equal(validarCorrecao({ id, saida: "2026-10-05T22:00:00Z", motivo: "futuro" }, agora).reason, "future");
  const ok = validarCorrecao({ id, saida: "2026-10-05T14:00:00-04:00", motivo: "  esqueceu a saída  " }, agora);
  assert.deepEqual(ok, { ok: true, entrada: null, saida: "2026-10-05T18:00:00.000Z", motivo: "esqueceu a saída" });
});

// ── a rota inteira, com o banco de mentira ─────────────────────────────────────────────────────
function banco(acesso, extra = {}) {
  const chamadas = [];
  const svc = async (_env, fn, body) => {
    chamadas.push(fn);
    if (fn === "desk_acesso_entrar_svc") return acesso;
    if (fn === "desk_plano_svc") return null;
    if (fn in extra) return typeof extra[fn] === "function" ? extra[fn](body) : extra[fn];
    return { ok: false, erro_http: 404, detalhe: "função não esperada: " + fn };
  };
  return { svc, chamadas };
}
const ANA = { ok: true, id: "A1", nome: "Ana", papel: "profissional", pro_id: "P1", chave: "dona123" };
const REC = { ok: true, id: "R1", nome: "Rê", papel: "recepcao", chave: "dona123" };

test("rota: a equipe NÃO lê o relatório nem acerta (403 antes de qualquer leitura)", async () => {
  for (const ac of [ANA, REC]) for (const action of ["ponto_relatorio", "ponto_corrigir"]) {
    const { svc, chamadas } = banco(ac);
    const r = await responderEu({}, { email: "e@x.co", key: codigo, action, de: "2026-10-01", ate: "2026-10-05" }, svc);
    assert.equal(r.http, 403, action); assert.equal(r.corpo.reason, "role_forbidden");
    assert.deepEqual(chamadas, ["desk_acesso_entrar_svc"]);
  }
});

test("rota: a dona não bate ponto nem lê o mês de ninguém (403, nem toca no banco)", async () => {
  for (const action of ["ponto_bater", "ponto_status", "meu_mes"]) {
    const { svc, chamadas } = banco(null);
    const r = await responderEu({}, { email: "e@x.co", key: "chave-da-dona", action, esperado: "entrada" }, svc);
    assert.equal(r.http, 403, action); assert.equal(chamadas.length, 0);
  }
});

test("rota: revogado → 401; banco fora → 503; recepção não vê meu_mes", async () => {
  let r = await responderEu({}, { email: "e@x.co", key: codigo, action: "ponto_bater", esperado: "entrada" }, banco({ ok: false, reason: "unauthorized" }).svc);
  assert.equal(r.http, 401);
  r = await responderEu({}, { email: "e@x.co", key: codigo, action: "ponto_bater", esperado: "entrada" }, banco({ ok: false, erro_http: 502 }).svc);
  assert.equal(r.http, 503);
  r = await responderEu({}, { email: "e@x.co", key: codigo, action: "meu_mes" }, banco(REC).svc);
  assert.equal(r.http, 403);
  // revogado ENTRE a porta e o bater (o banco confere de novo)
  r = await responderEu({}, { email: "e@x.co", key: codigo, action: "ponto_bater", esperado: "entrada" }, banco(ANA, { desk_ponto_bater_svc: { ok: false, reason: "unauthorized" } }).svc);
  assert.equal(r.http, 401);
});

test("rota: bater manda o id do acesso conferido (não o do corpo) e devolve 409 se a situação mudou", async () => {
  let enviado;
  const { svc } = banco(ANA, { desk_ponto_bater_svc: (body) => { enviado = body; return { ok: false, reason: "state_changed", dentro: true }; } });
  const r = await responderEu({}, { email: "E@X.co", key: codigo, action: "ponto_bater", esperado: "entrada", acesso_id: "OUTRO", p_acesso_id: "OUTRO" }, svc);
  assert.equal(r.http, 409); assert.deepEqual(enviado, { p_email: "e@x.co", p_acesso_id: "A1", p_esperado: "entrada" });
  const sem = await responderEu({}, { email: "e@x.co", key: codigo, action: "ponto_bater" }, banco(ANA).svc);
  assert.equal(sem.http, 400);
});

test("rota: meu_mes usa o pro_id do BANCO e marca estimativa", async () => {
  let enviado;
  const { svc } = banco(ANA, { desk_meu_mes_svc: (body) => { enviado = body; return { ok: true, servicos_cents: 9000, comissao_cents: 3600 }; } });
  const r = await responderEu({}, { email: "e@x.co", key: codigo, action: "meu_mes", pro_id: "OUTRA" }, svc);
  assert.equal(r.http, 200); assert.equal(r.corpo.estimativa, true); assert.deepEqual(enviado, { p_email: "e@x.co", p_pro_id: "P1" });
});

test("rota: dona com chave errada → 401; relatório monta resumo + CSV", async () => {
  let r = await responderEu({}, { email: "e@x.co", key: "errada", action: "ponto_relatorio", de: "2026-10-01", ate: "2026-10-05" },
    banco(null, { desk_eu_dono_ok: { ok: false, erro_http: 401, detalhe: '{"code":"28000","message":"unauthorized"}' } }).svc);
  assert.equal(r.http, 401);
  r = await responderEu({}, { email: "e@x.co", key: "k", action: "ponto_relatorio", de: "2026-10-05", ate: "2026-10-01" }, banco(null, { desk_eu_dono_ok: { ok: true } }).svc);
  assert.equal(r.http, 400);
  r = await responderEu({}, { email: "e@x.co", key: "k", action: "ponto_relatorio", de: "2026-10-01", ate: "2026-10-05" }, banco(null, {
    desk_eu_dono_ok: { ok: true },
    desk_ponto_relatorio: { ok: true, tz: NY, de: "2026-10-01", ate: "2026-10-05", agora: "2026-10-05T20:00:00Z",
      turnos: [{ id: "1", acesso_id: "A", nome: "Ana", entrada: "2026-10-05T13:00:00Z", saida: "2026-10-05T17:00:00Z" }] },
  }).svc);
  assert.equal(r.http, 200); assert.equal(r.corpo.pessoas[0].total_min, 240); assert.ok(r.corpo.csv.includes("2026-10-05 09:00"));
});

test("rota: plano cancelado bloqueia (402) — mesma trava do /api/desk", async () => {
  const svc = async (_e, fn) => (fn === "desk_acesso_entrar_svc" ? ANA : fn === "desk_plano_svc" ? "nenhum" : { ok: true });
  const r = await responderEu({}, { email: "e@x.co", key: codigo, action: "ponto_bater", esperado: "entrada" }, svc);
  assert.equal(r.http, 402); assert.equal(r.corpo.reason, "plan_required");
});
