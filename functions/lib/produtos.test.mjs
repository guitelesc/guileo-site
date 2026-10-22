// GUARDA DO CATÁLOGO DE PRODUTOS — o preço certo do produto certo, ou uma pergunta.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// A agente vai COTAR e VENDER o que está em `biz_products` (db/produtos.sql). Três jeitos de isso
// custar dinheiro sem erro nenhum aparecer:
//   1. casar o produto ERRADO — a pessoa ouve o preço do creme A e vem buscar o creme B;
//   2. CHUTAR entre dois que casam igual ("cream" com dois cremes na prateleira);
//   3. oferecer o que o dono DESATIVOU, ou esconder que acabou.
// A regra fixada aqui: na dúvida, `acharProduto` devolve null e a agente pergunta. Produto
// inativo não existe para ela. Estoque controlado em zero aparece como "sem estoque" — aparece,
// não some: a resposta certa é "está em falta", não "não vendemos".
//
//   node functions/lib/produtos.test.mjs
// Importa as funções DE PRODUÇÃO (nunca uma cópia: teste de cópia atesta código que ninguém roda).
import { dinheiro, formatProdutos, acharProduto, validarProduto, LIMITE_LINHAS } from "./produtos.js";

let falhas = 0;
const igual = (titulo, obtido, esperado) => {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a !== b) { falhas++; console.error(`❌ ${titulo}\n     esperado: ${b}\n     obtido:   ${a}`); }
};

// Prateleira de exemplo — a topologia é o que importa: um nome genérico ("Shampoo") ao lado de um
// específico da MESMA marca, dois cremes que só diferem por uma palavra, um inativo, um zerado.
const P = {
  shampoo:   { id: "p1", name: "Shampoo", brand: "Kérastase", price_cents: 3200, stock: 8, active: true },
  shArgan:   { id: "p2", name: "Shampoo Argan", brand: "Kérastase", price_cents: 4150, stock: null, active: true },
  cremeHid:  { id: "p3", name: "Crème Hydratante", brand: "", price_cents: 2500, stock: 3, active: true },
  cremeNoite:{ id: "p4", name: "Night Cream", brand: "Natura", price_cents: 5400, stock: 0, active: true },
  cremeDia:  { id: "p5", name: "Day Cream", brand: "Natura", price_cents: 4800, stock: 5, active: true },
  oleo:      { id: "p6", name: "Óleo de Massagem", brand: "", price_cents: 1999, stock: null, active: true },
  antigo:    { id: "p7", name: "Body Scrub", brand: "Natura", price_cents: 3000, stock: 4, active: false },
};
const LISTA = Object.values(P);
const id = (p) => (p ? p.id : null);

// ── dinheiro ─────────────────────────────────────────────────────────────────
igual("dinheiro: redondo sai sem centavos", dinheiro(2500), "$25");
igual("dinheiro: quebrado sai com dois dígitos", dinheiro(2550), "$25.50");
igual("dinheiro: centavo único não perde o zero", dinheiro(2505), "$25.05");
igual("dinheiro: zero é zero", dinheiro(0), "$0");
igual("dinheiro: milhar sem separador (igual formatPrices)", dinheiro(120000), "$1200");
igual("dinheiro: lixo não vira $NaN", [dinheiro(null), dinheiro(undefined), dinheiro("abc"), dinheiro(-5), dinheiro(NaN)], ["", "", "", "", ""]);

// ── acharProduto ─────────────────────────────────────────────────────────────
const CASOS = [
  // [título, o que a pessoa falou, id esperado (null = a agente PERGUNTA)]
  ["nome exato", "Shampoo Argan", "p2"],
  ["nome exato ganha de marca+parcial — 'shampoo' é o Shampoo, não o Shampoo Argan", "shampoo", "p1"],
  ["sem acento e em maiúsculas", "CREME HYDRATANTE", "p3"],
  ["acento de quem digita diferente do cadastro", "oleo de massagem", "p6"],
  ["marca + nome", "kerastase shampoo", "p1"],
  ["frase inteira de quem fala (pt)", "eu quero o shampoo de argan, por favor", "p2"],
  ["frase inteira de quem fala (en)", "do you have the night cream?", "p4"],
  ["ordem das palavras trocada", "argan shampoo", "p2"],
  ["plural", "night creams", "p4"],
  ["parcial com um candidato só", "hydratante", "p3"],
  ["AMBÍGUO — dois cremes casam igual → null (pergunta, não chuta)", "cream", null],
  ["AMBÍGUO — a marca sozinha aponta para vários → null", "natura", null],
  ["marca desfaz a ambiguidade quando sobra um", "natura day", "p5"],
  ["INATIVO nunca casa, nem pelo nome exato", "Body Scrub", null],
  ["sem estoque AINDA casa (a resposta é 'em falta', não 'não vendemos')", "night cream", "p4"],
  ["o que não existe não vira outra coisa", "perfume", null],
  ["texto vazio", "", null],
  ["só enchimento", "eu quero um, por favor", null],
];
for (const [titulo, falado, esperado] of CASOS) igual(`achar: ${titulo}`, id(acharProduto(LISTA, falado)), esperado);

igual("achar: lista vazia", acharProduto([], "shampoo"), null);
igual("achar: lista que não é lista", [acharProduto(null, "shampoo"), acharProduto(undefined, "shampoo"), acharProduto("x", "shampoo")], [null, null, null]);
igual("achar: texto nulo", [acharProduto(LISTA, null), acharProduto(LISTA, undefined)], [null, null]);
igual("achar: devolve o PRÓPRIO objeto da lista (com preço e estoque)", acharProduto(LISTA, "shampoo argan") === P.shArgan, true);
// o nome EXATO desempata quando outro produto tem as mesmas palavras em outra ordem
igual("achar: exato ganha de 'mesmas palavras, outra ordem'",
  id(acharProduto([{ id: "a", name: "Cream for the Day" }, { id: "b", name: "Day Cream" }], "day cream")), "b");
// dois produtos de nome idêntico (o banco proíbe, mas a função não confia): empate → null
igual("achar: nomes idênticos empatam → null", acharProduto([{ name: "Gel", price_cents: 1 }, { name: "gel", price_cents: 2 }], "gel"), null);
// só o inativo casaria exato; o ativo parcial é o único candidato de verdade
igual("achar: inativo exato não rouba do ativo parcial",
  id(acharProduto([{ id: "a", name: "Serum", active: false }, { id: "b", name: "Serum Vitamin C", active: true }], "serum")), "b");

// ── formatProdutos ───────────────────────────────────────────────────────────
igual("formato: lista vazia", formatProdutos([], "en"), "");
igual("formato: não-lista", [formatProdutos(null), formatProdutos(undefined, "pt"), formatProdutos({}, "es")], ["", "", ""]);
igual("formato: só inativos → vazio", formatProdutos([P.antigo], "en"), "");
igual("formato: en — marca entre parênteses, inativo fora, sem estoque rotulado",
  formatProdutos(LISTA, "en"),
  [
    "Shampoo (Kérastase) — $32",
    "Shampoo Argan (Kérastase) — $41.50",
    "Crème Hydratante — $25",
    "Night Cream (Natura) — $54 (out of stock)",
    "Day Cream (Natura) — $48",
    "Óleo de Massagem — $19.99",
  ].join("\n"));
igual("formato: pt — rótulo de sem estoque", formatProdutos([P.cremeNoite], "pt"), "Night Cream (Natura) — $54 (sem estoque)");
igual("formato: es — rótulo de sem estoque", formatProdutos([P.cremeNoite], "es"), "Night Cream (Natura) — $54 (agotado)");
igual("formato: idioma desconhecido cai em inglês", formatProdutos([P.cremeNoite], "hi"), "Night Cream (Natura) — $54 (out of stock)");
igual("formato: estoque NÃO controlado (null) nunca é 'sem estoque'", formatProdutos([P.shArgan], "en"), "Shampoo Argan (Kérastase) — $41.50");
igual("formato: preço zero não é anunciado como grátis",
  [formatProdutos([{ name: "Sample", price_cents: 0 }], "en"), formatProdutos([{ name: "Amostra", price_cents: 0 }], "pt")],
  ["Sample — price on request", "Amostra — sob consulta"]);
igual("formato: produto sem nome é pulado", formatProdutos([{ name: "  ", price_cents: 100 }, P.shampoo], "en"), "Shampoo (Kérastase) — $32");

// O TETO: 60 produtos no bloco + UMA linha dizendo quantos ficaram de fora.
const muitos = Array.from({ length: 75 }, (_, i) => ({ name: `Item ${i + 1}`, price_cents: 1000 + i, active: true }));
{
  const linhas = formatProdutos(muitos, "en").split("\n");
  igual("teto: 60 produtos + 1 linha de resto", linhas.length, LIMITE_LINHAS + 1);
  igual("teto: o 60º é o último produto listado", linhas[LIMITE_LINHAS - 1], "Item 60 — $10.59");
  igual("teto: a linha final conta o resto (en)", linhas[LIMITE_LINHAS], "(+15 more products not listed here)");
  igual("teto: a linha final (pt)", formatProdutos(muitos, "pt").split("\n")[LIMITE_LINHAS], "(+15 outros produtos fora desta lista)");
  igual("teto: a linha final (es)", formatProdutos(muitos, "es").split("\n")[LIMITE_LINHAS], "(+15 productos más fuera de esta lista)");
  igual("teto: singular", formatProdutos(muitos.slice(0, 61), "en").split("\n")[LIMITE_LINHAS], "(+1 more product not listed here)");
  igual("teto: exatamente 60 não ganha linha de resto", formatProdutos(muitos.slice(0, 60), "en").split("\n").length, 60);
  // inativos não contam para o teto nem para o resto
  const comInativos = [...Array.from({ length: 30 }, (_, i) => ({ name: `Off ${i}`, price_cents: 1, active: false })), ...muitos.slice(0, 60)];
  igual("teto: inativo não ocupa vaga", formatProdutos(comInativos, "en").split("\n").length, 60);
}

// ── validarProduto (a régua do /api/produtos) ────────────────────────────────
const erro = (e) => { const r = validarProduto(e); return r.ok ? "ok" : r.erro; };
const base = { name: "Argan Oil", price_cents: 2500 };
igual("validar: mínimo válido", validarProduto(base),
  { ok: true, produto: { name: "Argan Oil", price_cents: 2500, stock: null, brand: "", description: "", active: true } });
igual("validar: nome é aparado", validarProduto({ ...base, name: "  Argan Oil  " }).produto.name, "Argan Oil");
igual("validar: nome vazio / ausente / não-objeto", [erro({ ...base, name: "   " }), erro({ price_cents: 1 }), erro(null), erro([])], ["name_required", "name_required", "name_required", "name_required"]);
igual("validar: nome de 120 passa, 121 não", [erro({ ...base, name: "x".repeat(120) }), erro({ ...base, name: "x".repeat(121) })], ["ok", "name_too_long"]);
igual("validar: preço — limites", [erro({ ...base, price_cents: 0 }), erro({ ...base, price_cents: 10000000 }), erro({ ...base, price_cents: 10000001 }), erro({ ...base, price_cents: -1 })],
  ["ok", "ok", "price_invalid", "price_invalid"]);
igual("validar: preço — só inteiro de verdade", [erro({ ...base, price_cents: 25.5 }), erro({ ...base, price_cents: "2500" }), erro({ name: "x" }), erro({ ...base, price_cents: null }), erro({ ...base, price_cents: NaN })],
  ["price_invalid", "price_invalid", "price_invalid", "price_invalid", "price_invalid"]);
igual("validar: estoque — null é 'não controlado'", [validarProduto({ ...base, stock: null }).produto.stock, validarProduto({ ...base, stock: "" }).produto.stock, validarProduto(base).produto.stock], [null, null, null]);
igual("validar: estoque — limites", [erro({ ...base, stock: 0 }), erro({ ...base, stock: 1000000 }), erro({ ...base, stock: 1000001 }), erro({ ...base, stock: -1 }), erro({ ...base, stock: 1.5 }), erro({ ...base, stock: "3" })],
  ["ok", "ok", "stock_invalid", "stock_invalid", "stock_invalid", "stock_invalid"]);
igual("validar: estoque zero continua zero (não vira null)", validarProduto({ ...base, stock: 0 }).produto.stock, 0);
igual("validar: id — uuid ou nada", [erro({ ...base, id: "abc" }), erro({ ...base, id: "3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b" }), erro({ ...base, id: "" })], ["id_invalid", "ok", "ok"]);
igual("validar: unidade — uuid, null limpa, lixo recusa",
  [erro({ ...base, location_id: "x" }), validarProduto({ ...base, location_id: null }).produto.location_id, "location_id" in validarProduto(base).produto],
  ["location_invalid", null, false]);
igual("validar: campo desconhecido não passa adiante (client_email jamais vem da tela)",
  Object.keys(validarProduto({ ...base, client_email: "outro@tenant.com", created_at: "x" }).produto).sort(),
  ["active", "brand", "description", "name", "price_cents", "stock"]);
igual("validar: active só desliga com false explícito", [validarProduto({ ...base, active: false }).produto.active, validarProduto({ ...base, active: 0 }).produto.active], [false, true]);
igual("validar: marca e descrição têm teto", [erro({ ...base, brand: "b".repeat(81) }), erro({ ...base, description: "d".repeat(501) })], ["brand_too_long", "description_too_long"]);

if (falhas) { console.error(`\n❌ produtos: ${falhas} caso(s) falharam.`); process.exit(1); }
console.log("✅ produtos: casamento (exato · acento/caixa · ambíguo → null · inativo fora), formato do prompt (sem estoque · teto de 60 · lista vazia), dinheiro e validação — tudo certo.");
