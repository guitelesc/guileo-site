// GUARDA DE ROTAS — toda rota do App.jsx precisa estar na lista branca do _middleware.js.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUE ESTE TESTE EXISTE
// O middleware devolve 404 REAL para caminho fora da lista (proteção contra soft-404 na indexação
// do Google). Boa regra — e uma armadilha: quem cria rota no App.jsx e esquece a lista publica uma
// página que existe no código e **não abre para ninguém**.
//
// Já aconteceu três vezes. A pior foi a /vitrine: o vendedor mandava o link da demo para o cliente,
// o cliente abria e via "página não encontrada". A demo funcionava; a porta é que estava trancada.
// Não dá para descobrir isso lendo o código — só abrindo a URL em produção, que é exatamente o que
// ninguém faz depois de criar uma rota.
//
// Lembrar não é um mecanismo. Isto é.
//   node functions/lib/rotas.test.mjs
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
const mid = readFileSync(new URL("../_middleware.js", import.meta.url), "utf8");

// as rotas declaradas no roteador: path="/x" e path="/x/:y" → primeiro segmento
const rotas = [...app.matchAll(/path="\/([^"/*]+)/g)].map((m) => m[1]).filter(Boolean);

// a lista branca do middleware: o bloco new Set([...]) com os nomes de primeiro segmento
const bloco = mid.match(/new Set\(\[([\s\S]*?)\]\)/);
if (!bloco) {
  console.log("❌ não achei a lista branca no _middleware.js — o formato mudou, este teste precisa ser ajustado");
  process.exit(1);
}
const permitidas = new Set([...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const faltando = [...new Set(rotas)].filter((r) => !permitidas.has(r)).sort();

if (faltando.length) {
  console.log(`❌ ${faltando.length} rota(s) do App.jsx fora da lista branca do _middleware.js:`);
  for (const r of faltando) console.log(`     /${r}  → abriria 404 REAL em produção`);
  console.log("   conserto: adicione o nome ao new Set([...]) em functions/_middleware.js");
  process.exit(1);
}
console.log(`✅ ${new Set(rotas).size} rotas do App.jsx · todas na lista branca do middleware`);
