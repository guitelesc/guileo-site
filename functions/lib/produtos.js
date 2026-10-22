// CATÁLOGO DE PRODUTOS (varejo) — as partes PURAS: sem rede, sem banco, sem env.
// O spa que vende creme e shampoo lista os produtos em db/produtos.sql (`biz_products`); daqui saem:
//   • dinheiro(cents)             → "$25" / "$25.50"   (o mesmo formato de formatPrices em provision.js)
//   • formatProdutos(list, lang)  → o bloco de texto que entra no prompt da agente
//   • acharProduto(list, texto)   → qual produto a pessoa quis dizer — ou null, para PERGUNTAR
//   • validarProduto(entrada)     → a régua do /api/produtos (nome, preço, estoque)
//
// A REGRA QUE MANDA EM acharProduto: NA DÚVIDA, null. Cotar o creme errado é pior do que perguntar
// "qual deles?" — a pessoa ouve um preço, vem buscar, e o preço era de outro produto. Por isso dois
// produtos que casam IGUALMENTE bem devolvem null, e produto inativo nunca casa.
//
//   node functions/lib/produtos.test.mjs

export const LIMITE_LINHAS = 60;          // teto do bloco no prompt (acima disso, uma linha de "+N")
export const NOME_MAX = 120;
export const PRECO_MAX_CENTS = 10000000;  // $100.000,00
export const ESTOQUE_MAX = 1000000;

const idioma = (lang) => (lang === "pt" || lang === "es" ? lang : "en");

// "$25" quando é redondo, "$25.50" quando não. Entrada que não é dinheiro → "" (nunca "$NaN").
export function dinheiro(cents) {
  if (cents === null || cents === undefined || cents === "" || typeof cents === "boolean") return "";
  const n = Number(cents);
  if (!Number.isFinite(n) || n < 0) return "";
  const c = Math.round(n);
  return "$" + (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));
}

const ativo = (p) => !!p && typeof p === "object" && p.active !== false;
const nomeDe = (p) => (p && p.name != null ? String(p.name) : "").trim();
const marcaDe = (p) => (p && p.brand != null ? String(p.brand) : "").trim();
// estoque CONTROLADO e zerado. null/undefined/"" = não controlado → nunca é "sem estoque".
const semEstoque = (p) => p.stock !== null && p.stock !== undefined && p.stock !== "" && Number(p.stock) <= 0;

const FRASES = {
  semEstoque: { en: "out of stock", pt: "sem estoque", es: "agotado" },
  // preço 0 não é "de graça": é o mesmo tratamento que formatPrices dá a serviço sem preço.
  sobConsulta: { en: "price on request", pt: "sob consulta", es: "a consultar" },
  mais: {
    en: (n) => `(+${n} more ${n === 1 ? "product" : "products"} not listed here)`,
    pt: (n) => `(+${n} ${n === 1 ? "outro produto" : "outros produtos"} fora desta lista)`,
    es: (n) => `(+${n} ${n === 1 ? "producto más" : "productos más"} fuera de esta lista)`,
  },
};

/**
 * O bloco de produtos para o prompt da agente. Uma linha por produto ATIVO:
 *   "Nome (Marca) — $25"            ·  "Nome — $25.50 (out of stock)"
 * No máximo LIMITE_LINHAS produtos; havendo mais, uma linha final diz quantos ficaram de fora
 * (a agente sabe que a lista não é o catálogo inteiro e não nega o que não leu).
 * Lista vazia / sem ativos → "" (o prompt degrada, nunca quebra).
 */
export function formatProdutos(list, lang = "en") {
  const L = idioma(lang);
  const itens = (Array.isArray(list) ? list : []).filter((p) => ativo(p) && nomeDe(p));
  if (!itens.length) return "";
  const linhas = itens.slice(0, LIMITE_LINHAS).map((p) => {
    const marca = marcaDe(p);
    const cents = Number(p.price_cents);
    const preco = Number.isFinite(cents) && cents > 0 ? dinheiro(cents) : FRASES.sobConsulta[L];
    return `${nomeDe(p)}${marca ? ` (${marca})` : ""} — ${preco}${semEstoque(p) ? ` (${FRASES.semEstoque[L]})` : ""}`;
  });
  const resto = itens.length - linhas.length;
  if (resto > 0) linhas.push(FRASES.mais[L](resto));
  return linhas.join("\n");
}

// ── CASAMENTO ────────────────────────────────────────────────────────────────
// minúsculas, sem acento, só letra/número (de qualquer alfabeto). "Crème Hydratante" e "creme hydratante" são o mesmo texto.
export const norm = (s) => String(s == null ? "" : s)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();

// Palavras de enchimento de quem FALA ("eu quero o…", "do you have the…"). Saem dos dois lados.
const ENCHIMENTO = new Set([
  "a", "an", "the", "of", "for", "and", "some", "any", "please", "i", "want", "need", "would", "like", "do", "you", "have", "buy", "get", "to", "that", "this", "one", "with",
  "o", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "e", "eu", "quero", "queria", "gostaria", "preciso", "tem", "voces", "por", "favor", "esse", "essa", "aquele", "aquela", "com", "para", "pra",
  "el", "la", "los", "las", "un", "una", "unos", "unas", "del", "y", "yo", "quiero", "quisiera", "necesito", "tienen", "ese", "esa", "con", "para",
]);
// plural simples: "creams" = "cream", "cremes" = "creme". Só corta o "s" final de palavra com 4+ letras.
const raiz = (t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t);
const palavras = (s) => norm(s).split(" ").filter(Boolean).filter((t) => !ENCHIMENTO.has(t)).map(raiz);

// Quão bem um produto casa com o que foi dito. 0 = não casa. Degraus (do mais forte ao mais fraco):
//   100  o que foi dito É o nome                              ("argan oil"  → Argan Oil)
//    95  é marca + nome (em qualquer ordem)                   ("kerastase shampoo")
//  80+n  a frase CONTÉM todas as palavras do nome, em qualquer ("quero o shampoo de argan, por favor")
//        ordem — "shampoo argan" e "argan shampoo" são o mesmo pedido (n = nº de palavras do
//        nome: o nome mais específico ganha do mais genérico)
//    50  PARCIAL: tudo que foi dito está no nome/marca         ("shampoo" → Shampoo Argan)
// O parcial vale o MESMO para todo candidato, de propósito: "cream" não escolhe entre Night Cream
// e Hydrating Cream — empata, e empate é null.
function pontos(p, falado, palFalado) {
  const nome = norm(nomeDe(p));
  if (!nome) return 0;
  if (nome === falado) return 100;
  const marca = norm(marcaDe(p));
  if (marca && (falado === `${marca} ${nome}` || falado === `${nome} ${marca}`)) return 95;
  const palNome = palavras(nomeDe(p));
  const ditas = new Set(palFalado);
  if (palNome.length && palNome.every((t) => ditas.has(t))) return 80 + Math.min(palNome.length, 15);
  const doProduto = new Set([...palNome, ...palavras(marcaDe(p))]);
  if (palFalado.length && palFalado.every((t) => doProduto.has(t))) return 50;
  return 0;
}

/**
 * O produto que a pessoa quis dizer — ou null.
 * null quando: nada casa · texto vazio · DOIS produtos casam igualmente bem (a agente pergunta
 * "qual deles?" em vez de chutar). Produto inativo nunca entra na disputa. Produto sem estoque
 * ENTRA: a resposta certa para ele é "está em falta", não "não vendemos isso".
 */
export function acharProduto(list, texto) {
  const falado = norm(texto);
  if (!falado) return null;
  const palFalado = palavras(texto);
  let melhor = null, melhorPts = 0, empate = false;
  for (const p of Array.isArray(list) ? list : []) {
    if (!ativo(p)) continue;
    const pts = pontos(p, falado, palFalado);
    if (pts <= 0) continue;
    if (pts > melhorPts) { melhor = p; melhorPts = pts; empate = false; }
    else if (pts === melhorPts) empate = true;
  }
  return melhor && !empate ? melhor : null;
}

// ── VALIDAÇÃO (a régua do /api/produtos) ─────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inteiro = (v) => typeof v === "number" && Number.isInteger(v);

/**
 * Confere e LIMPA um produto vindo da tela. Devolve { ok:true, produto } — só com os campos que
 * a RPC conhece — ou { ok:false, erro } com um código estável:
 *   name_required · name_too_long · price_invalid · stock_invalid · id_invalid · location_invalid
 *   · brand_too_long · description_too_long
 * Dinheiro e estoque têm que chegar como NÚMERO inteiro: "25" (texto) é recusado, para que
 * nenhuma conversão implícita decida o preço de alguém.
 */
export function validarProduto(entrada) {
  const e = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? entrada : null;
  if (!e) return { ok: false, erro: "name_required" };
  const produto = {};

  if (e.id !== undefined && e.id !== null && e.id !== "") {
    if (typeof e.id !== "string" || !UUID.test(e.id)) return { ok: false, erro: "id_invalid" };
    produto.id = e.id;
  }

  const name = typeof e.name === "string" ? e.name.trim() : "";
  if (!name) return { ok: false, erro: "name_required" };
  if (name.length > NOME_MAX) return { ok: false, erro: "name_too_long" };
  produto.name = name;

  if (!inteiro(e.price_cents) || e.price_cents < 0 || e.price_cents > PRECO_MAX_CENTS) return { ok: false, erro: "price_invalid" };
  produto.price_cents = e.price_cents;

  // estoque: null/ausente = NÃO controlado. Sempre vai explícito para a RPC (null limpa o controle).
  if (e.stock === undefined || e.stock === null || e.stock === "") produto.stock = null;
  else if (!inteiro(e.stock) || e.stock < 0 || e.stock > ESTOQUE_MAX) return { ok: false, erro: "stock_invalid" };
  else produto.stock = e.stock;

  const brand = typeof e.brand === "string" ? e.brand.trim() : "";
  if (brand.length > 80) return { ok: false, erro: "brand_too_long" };
  produto.brand = brand;

  const description = typeof e.description === "string" ? e.description.trim() : "";
  if (description.length > 500) return { ok: false, erro: "description_too_long" };
  produto.description = description;

  produto.active = e.active !== false;

  if (e.location_id !== undefined) {
    if (e.location_id === null || e.location_id === "") produto.location_id = null;
    else if (typeof e.location_id !== "string" || !UUID.test(e.location_id)) return { ok: false, erro: "location_invalid" };
    else produto.location_id = e.location_id;
  }

  return { ok: true, produto };
}
