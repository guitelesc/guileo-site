// GUARDA DO DINHEIRO QUE ENTRA — o número que o dono digita ou cola tem que virar centavos certos.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// Em 2026-08-11 uma revisão adversarial achou que `paraCentavos("$1,240.00")` devolvia 124 —
// **$1.24 no lugar de $1.240,00**, mil vezes menor. É o formato padrão de export do Google Ads e
// da Meta em conta americana, ou seja: o caminho mais comum de entrada de dinheiro do motor.
//
// O que fazia disso um defeito CARO e não só um bug:
//   gasto 1000× menor  →  retorno = receita/gasto  1000× inflado  →  `reinvestir` devolve
//   acao:"subir"  →  o dono AUMENTA o orçamento de uma campanha que está queimando dinheiro.
// E não havia erro nenhum: a função devolvia um número finito, positivo, que passava por todas
// as recusas explícitas. O comentário dela jurava "nunca devolve NaN" — e é verdade. Devolvia
// coisa pior: um número plausível e errado.
//
// A causa era ordem de operações: removia o ponto-de-milhar brasileiro ANTES de fazer `,`→`.`,
// então numa quantia americana a vírgula sobrevivia e virava separador decimal.
//
// ── A REGRA QUE ESTE TESTE FIXA ──────────────────────────────────────────────────────────────
// Descobrir o FORMATO antes de limpar:
//   · os dois separadores presentes  → o ÚLTIMO é o decimal, o outro é milhar;
//   · um separador só, com exatamente 3 dígitos até o fim → é MILHAR ("1.500", "1,000");
//   · um separador só, qualquer outra contagem → é DECIMAL ("1500,50", "450.00").
// A regra dos 3 dígitos é simétrica: resolve a ambiguidade real de "1.500" igual nos dois idiomas.
//
//   node functions/lib/dinheiro.test.mjs
// Importa a função DE PRODUÇÃO, não uma cópia: teste que testa cópia envelhece sozinho e passa a
// atestar código que ninguém executa. (Uma versão anterior deste arquivo extraía a função com
// regex + `new Function` — some assim tanto o risco de injeção quanto a dependência de um formato
// de texto que qualquer refatoração quebra.)
// Importa de lib/dinheiro.js, que virou o ÚNICO lugar onde texto vira dinheiro nesta base
// (2026-08-11). Antes a mesma regra estava escrita três vezes — ads.js, spendGuard.js e
// google-ads.js — e duas delas estavam erradas em direções opostas. `api/ads.js` reexporta.
import { paraCentavos, valorParaCobranca, moedaNaoDolar } from "./dinheiro.js";

const CASOS = [
  // [entrada, centavos esperados, por que este caso importa]
  ["$1,240.00", 124000, "export Google Ads/Meta em conta US — o caso que quebrava"],
  ["1,234.56",  123456, "US com milhar e decimal"],
  ["12,345.67", 1234567, "US, cinco dígitos"],
  ["1,234,567.89", 123456789, "US com DOIS milhares — replace(',') trocava só o primeiro"],
  ["1,000",     100000, "US milhar sem decimal (3 dígitos = milhar)"],
  ["1.500",     150000, "pt-BR milhar sem decimal (mesma regra dos 3 dígitos)"],
  ["1.234.567", 123456700, "pt-BR com dois milhares"],
  ["1500,50",   150050, "pt-BR decimal"],
  ["450.00",    45000,  "US decimal simples"],
  ["$1500",     150000, "sem separador nenhum"],
  ["R$ 1.234,56", 123456, "pt-BR completo com símbolo"],
  [1500,        150000, "número puro"],
  [0,           0,      "zero é valor legítimo, não vazio"],
  ["",          null,   "vazio → recusa explícita"],
  [null,        null,   "nulo → recusa explícita"],
  ["abc",       null,   "ilegível → recusa, nunca chute"],
  ["-50",       null,   "negativo → recusa (gasto negativo não existe)"],
];

let falhas = 0;
for (const [entrada, esperado, porque] of CASOS) {
  const obtido = paraCentavos(entrada);
  if (obtido !== esperado) {
    falhas++;
    const fmt = (c) => (c == null ? "recusa" : `$${(c / 100).toFixed(2)}`);
    console.log(`❌ ${JSON.stringify(entrada)}\n     esperado ${String(esperado).padStart(10)} (${fmt(esperado)})`);
    console.log(`     obtido   ${String(obtido).padStart(10)} (${fmt(obtido)})   ← ${porque}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// A GUARDA DE COBRANÇA: quando o texto pode significar dois valores, ela tem que PARAR.
//
// `valorParaCobranca` compara a leitura correta com a ingênua (`replace(/[^0-9.]/g,"")`, que o
// caminho de cobrança em functions/api/agent-action.js ainda usa). Divergiram → ambíguo → o
// spendGuard nega e escala para humano em vez de cobrar um dos dois valores no chute.
//
// O caso que motivou isto: a Gui atende em português e espanhol, "45,00" é como o preço é dito
// nesses idiomas, e a leitura ingênua transforma isso em US$ 4.500 — 100× a mais. Com o teto
// padrão de aprovação humana em US$ 1.000, um serviço de R$ 9,50 vira um link de US$ 950 que
// passa por todas as travas sem acender nenhuma luz.
const CASOS_COBRANCA = [
  // [entrada, ambiguo?, centavos corretos, por que]
  ["45",        false, 4500,   "inteiro simples — as duas leituras concordam, cobra normal"],
  ["45.00",     false, 4500,   "decimal americano — concordam"],
  ["$1,240.00", false, 124000, "milhar americano — concordam (a vírgula some nas duas)"],
  // AMBÍGUO É SÓ O SEPARADOR ÚNICO COM 3 DÍGITOS. "45,00" NÃO é ambíguo — 2 dígitos depois do
  // separador é decimal em qualquer idioma. Marcar isso como ambíguo desligava o "Fecha & Cobra"
  // em português e espanhol (todo preço com centavos ia para revisão humana). Corrigido 2026-08-11.
  ["45,00",     false, 4500,   "pt/es com centavos: decimal, sem dúvida — a Gui PRECISA cobrar isto"],
  ["9,50",      false, 950,    "idem — era o caso que travava a venda nos 2 idiomas"],
  ["0,99",      false, 99,     "centavos puros em pt/es"],
  ["45,0",      false, 4500,   "1 dígito depois: decimal (milhar tem exatamente 3)"],
  ["1.240",     true,  124000, "3 dígitos, separador único → AMBÍGUO de verdade: $1.240 ou $1,24?"],
  ["1,500",     true,  150000, "mesma ambiguidade com vírgula"],
  ["1.234.567", false, 123456700, "dois separadores iguais → milhar sem dúvida, não é ambíguo"],
  ["1,234.56",  false, 123456, "dois separadores diferentes → o último é decimal, resolvido"],
  ["abc",       false, null,   "ilegível: sem valor para cobrar, não é ambiguidade"],
];

for (const [entrada, ambEsperado, centsEsperado, porque] of CASOS_COBRANCA) {
  const r = valorParaCobranca(entrada);
  if (r.ambiguo !== ambEsperado || r.cents !== centsEsperado) {
    falhas++;
    console.log(`❌ cobrança ${JSON.stringify(entrada)} — ${porque}`);
    console.log(`     esperado ambiguo=${ambEsperado} cents=${centsEsperado}`);
    console.log(`     obtido   ambiguo=${r.ambiguo} cents=${r.cents} (ingênua leu ${r.ingenuo})`);
  }
}

// MOEDA QUE NÃO É DÓLAR precisa ser VISTA. O motor inteiro mede em US$; gasto colado em real
// entra como dólar e desalinha o retorno em ~5× sem nenhum aviso.
const CASOS_MOEDA = [
  ["R$ 1.234,56", "BRL"], ["€1.200", "EUR"], ["£950", "GBP"], ["₹5000", "INR"],
  ["1234.56 BRL", "BRL"], ["$1,240.00", null], ["1500", null], ["450.00", null],
];
for (const [entrada, esperado] of CASOS_MOEDA) {
  const obtido = moedaNaoDolar(entrada);
  if (obtido !== esperado) {
    falhas++;
    console.log(`❌ moeda ${JSON.stringify(entrada)} — esperado ${esperado}, obtido ${obtido}`);
  }
}

const TOTAL = CASOS.length + CASOS_COBRANCA.length + CASOS_MOEDA.length;
if (falhas) {
  console.log(`\n${falhas}/${TOTAL} casos errados. Dinheiro errado contamina TODA conta derivada:`);
  console.log("   retorno, veredito de campanha, decisão de orçamento — e o valor que o cliente do cliente paga.");
  process.exit(1);
}
console.log(`✅ ${TOTAL}/${TOTAL} — dinheiro vira centavos certos (US e pt-BR), ambiguidade vira humano, moeda estranha é vista`);
