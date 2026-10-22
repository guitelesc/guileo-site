// RELATÓRIO DE PRODUTIVIDADE — guarda dos ajudantes puros (período, dinheiro, percentual).
// O erro caro aqui é de FRONTEIRA DE MÊS: "mês passado" calculado com setMonth() a partir de um
// dia 31 cai no mês errado, e o dono lê a receita de março achando que é fevereiro — sem erro
// nenhum na tela. Importa a função DE PRODUÇÃO (não uma cópia).
//   node functions/lib/produtividade.test.mjs
import { PRESETS, MAX_DIAS, periodoPreset, normalizarPeriodo, formatarDinheiro, percentual, formatarPercentual } from "./produtividade.js";

let falhas = 0;
let casos = 0;
function igual(obtido, esperado, nome) {
  casos++;
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a !== b) { falhas++; console.error(`❌ ${nome}\n     esperado: ${b}\n     obtido:   ${a}`); }
}
const em = (iso) => new Date(iso);
const soPeriodo = (p) => ({ from: p.from, to: p.to });

// ── presets ──────────────────────────────────────────────────────────────────────────────────
igual(PRESETS, ["this_month", "last_month", "last_30_days"], "os três presets, nesta ordem");

// 31 de janeiro: o mês corrente vai até 1º de fevereiro; o passado é dezembro do ANO ANTERIOR
igual(soPeriodo(periodoPreset("this_month", em("2027-01-31T15:00:00Z"))),
  { from: "2027-01-01T00:00:00.000Z", to: "2027-02-01T00:00:00.000Z" }, "este mês em 31/jan");
igual(soPeriodo(periodoPreset("last_month", em("2027-01-31T15:00:00Z"))),
  { from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" }, "mês passado em 31/jan = dezembro do ano anterior");

// fevereiro em ano bissexto (2028): 29 dias, fecha em 1º de março
igual(soPeriodo(periodoPreset("this_month", em("2028-02-29T23:59:59Z"))),
  { from: "2028-02-01T00:00:00.000Z", to: "2028-03-01T00:00:00.000Z" }, "este mês em 29/fev bissexto");
// 31 de março → mês passado é FEVEREIRO (setMonth(1) num dia 31 cairia em março)
igual(soPeriodo(periodoPreset("last_month", em("2028-03-31T12:00:00Z"))),
  { from: "2028-02-01T00:00:00.000Z", to: "2028-03-01T00:00:00.000Z" }, "mês passado em 31/mar bissexto = fevereiro inteiro");
igual((em(periodoPreset("last_month", em("2028-03-31T12:00:00Z")).to) - em(periodoPreset("last_month", em("2028-03-31T12:00:00Z")).from)) / 86400000,
  29, "fevereiro bissexto tem 29 dias");
igual((em(periodoPreset("last_month", em("2027-03-31T12:00:00Z")).to) - em(periodoPreset("last_month", em("2027-03-31T12:00:00Z")).from)) / 86400000,
  28, "fevereiro comum tem 28 dias");

// dezembro → janeiro
igual(soPeriodo(periodoPreset("this_month", em("2026-12-31T23:59:59.999Z"))),
  { from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" }, "este mês no último instante de dezembro fecha em 1º/jan");
igual(soPeriodo(periodoPreset("this_month", em("2027-01-01T00:00:00Z"))),
  { from: "2027-01-01T00:00:00.000Z", to: "2027-02-01T00:00:00.000Z" }, "este mês no primeiro instante de janeiro");
igual(soPeriodo(periodoPreset("last_month", em("2027-01-01T00:00:00Z"))),
  { from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" }, "mês passado em 1º/jan = dezembro");

// últimos 30 dias: exatamente 30×24h terminando em "agora", cruzando a virada de ano
igual(soPeriodo(periodoPreset("last_30_days", em("2027-01-10T08:30:00Z"))),
  { from: "2026-12-11T08:30:00.000Z", to: "2027-01-10T08:30:00.000Z" }, "últimos 30 dias cruzando dez→jan");
igual(soPeriodo(periodoPreset("last_30_days", em("2028-03-01T00:00:00Z"))),
  { from: "2028-01-31T00:00:00.000Z", to: "2028-03-01T00:00:00.000Z" }, "últimos 30 dias atravessando fevereiro bissexto");

// preset desconhecido cai no mês corrente, e diz que caiu
igual(periodoPreset("qualquer", em("2026-09-30T10:00:00Z")),
  { preset: "this_month", from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" }, "preset desconhecido = este mês");

// ── período do corpo do POST ─────────────────────────────────────────────────────────────────
const AGORA = em("2026-09-30T10:00:00Z");
igual(normalizarPeriodo({}, AGORA), { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z", encurtado: false }, "sem datas = mês corrente");
igual(normalizarPeriodo(null, AGORA), { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z", encurtado: false }, "corpo nulo = mês corrente");
igual(normalizarPeriodo({ from: "2026-08-01T00:00:00Z", to: "2026-09-01T00:00:00Z" }, AGORA),
  { from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z", encurtado: false }, "período válido passa igual");
igual("erro" in normalizarPeriodo({ from: "2026-08-01T00:00:00Z" }, AGORA), true, "só from = erro");
igual("erro" in normalizarPeriodo({ to: "2026-08-01T00:00:00Z" }, AGORA), true, "só to = erro");
igual("erro" in normalizarPeriodo({ from: "ontem", to: "hoje" }, AGORA), true, "data ilegível = erro");
igual("erro" in normalizarPeriodo({ from: "2026-09-01T00:00:00Z", to: "2026-09-01T00:00:00Z" }, AGORA), true, "to igual a from = erro");
igual("erro" in normalizarPeriodo({ from: "2026-09-02T00:00:00Z", to: "2026-09-01T00:00:00Z" }, AGORA), true, "to antes de from = erro");
igual(MAX_DIAS, 400, "teto de 400 dias");
igual(normalizarPeriodo({ from: "2025-01-01T00:00:00Z", to: "2026-09-01T00:00:00Z" }, AGORA),
  { from: "2025-01-01T00:00:00.000Z", to: "2026-02-05T00:00:00.000Z", encurtado: true }, "mais de 400 dias: mantém o início, encurta o fim");
igual(normalizarPeriodo({ from: "2025-01-01T00:00:00Z", to: "2026-02-05T00:00:00Z" }, AGORA).encurtado, false, "exatamente 400 dias não encurta");

// ── dinheiro ─────────────────────────────────────────────────────────────────────────────────
igual(formatarDinheiro(45000), "$450", "centavos inteiros em USD, sem casas à toa");
igual(formatarDinheiro(123456), "$1,234.56", "USD com milhar e centavos");
igual(formatarDinheiro(0), "$0", "zero");
igual(formatarDinheiro(null), "$0", "nulo vira zero, nunca NaN");
igual(formatarDinheiro("abc"), "$0", "ilegível vira zero, nunca NaN");
igual(formatarDinheiro(45000, "BRL").replace(/\s/g, " "), "R$ 450", "BRL: mesmo número, outro símbolo (sem conversão)");
igual(formatarDinheiro(123456, "BRL").replace(/\s/g, " "), "R$ 1.234,56", "BRL com milhar e centavos");
igual(formatarDinheiro(45000, "xx"), "$450", "moeda inválida cai em USD");

// ── percentual do total ──────────────────────────────────────────────────────────────────────
igual(percentual(1, 4), 25, "1 de 4");
igual(percentual(1, 3), 33.3, "1 de 3 com uma casa");
igual(percentual(2, 3), 66.7, "2 de 3 arredonda");
igual(percentual(5, 5), 100, "tudo");
igual(percentual(0, 5), 0, "zero de um total real é 0, não nulo");
igual(percentual(3, 0), null, "total zero = sem base");
igual(percentual(3, null), null, "total nulo = sem base");
igual(percentual("x", 10), null, "parte ilegível = sem base");
igual(formatarPercentual(1, 4), "25%", "inteiro sem casa");
igual(formatarPercentual(1, 3), "33.3%", "com uma casa");
igual(formatarPercentual(3, 0), "—", "sem base vira travessão");

if (falhas) { console.error(`\n❌ produtividade: ${falhas} de ${casos} casos falharam`); process.exit(1); }
console.log(`✅ produtividade: ${casos} casos — presets em UTC (31/jan, fevereiro bissexto, dez→jan), período do POST, dinheiro e percentual`);
