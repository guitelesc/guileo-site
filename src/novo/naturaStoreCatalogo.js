/* NATURA STORE — catálogo e regras puras (sem React, sem rede). A tela é NaturaStore.jsx.
   Os campos de produto têm os MESMOS nomes de `biz_products` (db/produtos.sql): name, brand, description,
   price_cents, stock (null = não controlado), active. Quando a Lilian mandar a lista real, ela entra pelo
   /api/produtos e esta lista de exemplo sai — a tela não muda.

   🚨 Enquanto LOJA.aoVivo for false: nomes e preços são EXEMPLOS, a página mostra "Concept preview",
   a loja fica fora do menu público e o checkout não chama nada.

   CHECKOUT (2026-10-04): POST /api/loja-checkout { slug, itens:[{ id, qtd }], entrega } -> { url }
   (functions/api/loja-checkout.js). O servidor IMPORTA este arquivo: LOJA e ENTREGAS valem dos dois
   lados, e `aoVivo` também liga/desliga o endpoint. Preço e estoque o servidor lê do banco
   (biz_products) — os ids desta lista de EXEMPLO não são uuid e o servidor recusa, de propósito.
   Quem pagou volta em ?loja=ok#store; o webhook do Stripe registra a venda e baixa o estoque.

     node --test src/novo/naturaStoreCatalogo.test.mjs */

export const LOJA = {
  aoVivo: false,
  slug: "natura-spa",
  checkout: "/api/loja-checkout",
  freteCents: 895,            // EXEMPLO — a Lilian decide
  freteGratisCents: 7500,     // EXEMPLO — frete grátis a partir deste subtotal
  qtdMax: 10,                 // por produto, quando o estoque não é controlado
  guardar: "natura-store-bag",
};

/* Retirada nas duas unidades de salão (o Med Spa não entra: é clínica, não balcão). */
export const ENTREGAS = [
  { id: "astoria", nome: "Pick up in Astoria", sub: "30-79 Steinway Street", cents: 0 },
  { id: "ues", nome: "Pick up on the Upper East Side", sub: "842 Lexington Ave", cents: 0 },
  { id: "envio", nome: "Ship to my address", sub: "Anywhere in the US", cents: null },   // null = calcula por freteDe
];

/* O que o Natura vende no balcão (Luis, 2026-10-05: «keratina, semijoias, joias de verdade, cremes,
   toalhas, roupões»). Velas e o kit de presente ficam do modelo anterior. */
export const CATS = ["All", "Hair", "Skin & Body", "Jewelry", "Spa at Home", "Gifts"];

/* forma/cor/fundo/cat são só da vitrine (desenho da embalagem). O resto é biz_products.
   Joias: "gold-plated" = semijoia (banho de ouro 18k); "solid gold" = joia de verdade. */
export const PRODUTOS = [
  { id: "shampoo-keratina", cat: "Hair", name: "Keratin Aftercare Shampoo", brand: "Natura", description: "Sulfate- and salt-free — keeps your Brazilian keratin smooth for longer", size: "10 oz", price_cents: 3200, stock: null, active: true, forma: "frasco", cor: "#FFFFFF", fundo: "#F1E9EA" },
  { id: "condicionador-keratina", cat: "Hair", name: "Keratin Aftercare Conditioner", brand: "Natura", description: "Light and frizz-free between salon visits", size: "10 oz", price_cents: 3200, stock: null, active: true, forma: "frasco", cor: "#DCE8EC", fundo: "#F6F0E8" },
  { id: "mascara", cat: "Hair", name: "Keratin Care Mask", brand: "Natura", description: "Weekly deep treatment for treated hair", size: "8 oz", price_cents: 3800, stock: null, active: true, forma: "pote", cor: "#E3EDF0", fundo: "#F7F7F7" },
  { id: "creme-rosto", cat: "Skin & Body", name: "Daily Face Cream", brand: "Natura", description: "Light moisture after your facial", size: "1.7 oz", price_cents: 4600, stock: null, active: true, forma: "pote", cor: "#F4DDE1", fundo: "#F6F0E8" },
  { id: "creme-corpo", cat: "Skin & Body", name: "Daily Body Cream", brand: "Natura", description: "Cupuaçu butter, light floral scent", size: "6.7 oz", price_cents: 3200, stock: null, active: true, forma: "pote", cor: "#FBF7F2", fundo: "#F7F7F7" },
  { id: "creme-maos", cat: "Skin & Body", name: "Hand Cream", brand: "Natura", description: "Fast-absorbing, shea and açaí oil", size: "2.5 oz", price_cents: 1800, stock: null, active: true, forma: "tubo", cor: "#F4DDE1", fundo: "#F6F0E8" },
  { id: "oleo-corpo", cat: "Skin & Body", name: "Glow Body Oil", brand: "Natura", description: "Brazil nut and passion fruit oils", size: "3.4 oz", price_cents: 3400, stock: null, active: true, forma: "frasco", cor: "#E9C98F", fundo: "#F7F7F7" },
  { id: "argola", cat: "Jewelry", name: "Gold Hoop Earrings", brand: "Natura", description: "18k gold-plated, hypoallergenic", size: "Gold-plated · 25 mm", price_cents: 5800, stock: null, active: true, forma: "brinco", cor: "#FBF7F2", fundo: "#F1E9EA" },
  { id: "colar-camadas", cat: "Jewelry", name: "Layered Chain Necklace", brand: "Natura", description: "Two fine chains, 18k gold-plated", size: "Gold-plated · 16–18 in", price_cents: 7200, stock: null, active: true, forma: "colar", cor: "#F6F0E8", fundo: "#F7F7F7" },
  { id: "aneis", cat: "Jewelry", name: "Stacking Ring Trio", brand: "Natura", description: "Three thin bands, 18k gold-plated", size: "Gold-plated · sizes 5–8", price_cents: 4600, stock: null, active: true, forma: "anel", cor: "#015577", fundo: "#F6F0E8" },
  { id: "huggies-ouro", cat: "Jewelry", name: "Solid Gold Huggies", brand: "Natura", description: "Fine jewelry — 14k solid gold", size: "Solid gold · 12 mm", price_cents: 26000, stock: null, active: true, forma: "brinco", cor: "#F6F0E8", fundo: "#F6F0E8", fina: true },
  { id: "pingente-diamante", cat: "Jewelry", name: "Diamond Pendant", brand: "Natura", description: "Fine jewelry — 14k gold with a diamond accent", size: "Solid gold · 16 in", price_cents: 42000, stock: null, active: true, forma: "colar", cor: "#FBF7F2", fundo: "#F1E9EA", fina: true },
  { id: "toalha", cat: "Spa at Home", name: "Spa Bath Towel", brand: "Natura", description: "Thick Turkish cotton, the one from our rooms", size: "30 × 56 in", price_cents: 4800, stock: null, active: true, forma: "toalha", cor: "#FBF7F2", fundo: "#F6F0E8" },
  { id: "roupao", cat: "Spa at Home", name: "Waffle Spa Robe", brand: "Natura", description: "Light cotton waffle, the one you relax in here", size: "One size", price_cents: 9800, stock: null, active: true, forma: "roupao", cor: "#FFFFFF", fundo: "#F1E9EA" },
  { id: "fronha-seda", cat: "Spa at Home", name: "Silk Pillowcase", brand: "Natura", description: "Keeps your blowout and keratin smooth overnight", size: "Queen", price_cents: 6400, stock: null, active: true, forma: "fronha", cor: "#EFE3DA", fundo: "#F7F7F7" },
  { id: "vela-jardim", cat: "Spa at Home", name: "Brazilian Garden Candle", brand: "Natura", description: "Jasmine, orange blossom, green leaves", size: "8 oz · 45 hours", price_cents: 3800, stock: null, active: true, forma: "vela", cor: "#F3E3D6", fundo: "#F6F0E8" },
  { id: "ritual", cat: "Gifts", name: "The Natura Ritual Set", brand: "Natura", description: "Candle, body cream and hand cream in the tote", size: "Gift set", price_cents: 9500, stock: null, active: true, forma: "sacola", cor: "#F6F0E8", fundo: "#F1E9EA" },
];

/* ── PRODUTOS DO BANCO → VITRINE ───────────────────────────────────────────────────────────────
   biz_products não tem foto nem categoria. A categoria e o desenho da embalagem saem do NOME
   (palavras em inglês, como a Lilian cadastra); o rótulo mostra a MARCA do produto — um Kérastase
   nunca sai com "NATURA" escrito. Sem palavra conhecida: frasco, categoria "Body". */
const PALAVRAS = [
  [/\b(earrings?|hoops?|huggies?|studs?)\b/i, "Jewelry", "brinco"],
  [/\b(necklaces?|pendants?|chains?|chokers?)\b/i, "Jewelry", "colar"],
  [/\b(rings?|bracelets?|bangles?|anklets?)\b/i, "Jewelry", "anel"],
  [/\b(towels?|toalhas?)\b/i, "Spa at Home", "toalha"],
  [/\b(robes?|roup[aã]o|slippers?)\b/i, "Spa at Home", "roupao"],
  [/\b(pillowcases?|pillows?|scrunchies?|eye mask)\b/i, "Spa at Home", "fronha"],
  [/\b(candle|vela)s?\b/i, "Spa at Home", "vela"],
  [/\b(set|kit|gift|box|bundle)s?\b/i, "Gifts", "sacola"],
  [/\bmask\b/i, "Hair", "pote"],
  [/\b(shampoo|conditioner|hair|keratin|scalp|leave-in|serum|olaplex|kerastase)\b/i, "Hair", "frasco"],
  [/\b(hand|lip|foot)\s+(cream|balm)\b/i, "Skin & Body", "tubo"],
  [/\b(butter|scrub|balm|cream|moisturizer)\b/i, "Skin & Body", "pote"],
  [/\b(oil|lotion|wash|mist|perfume|fragrance|serum|sunscreen|spf)\b/i, "Skin & Body", "frasco"],
];
const PALETA = [
  { cor: "#F3E3D6", fundo: "#F6F0E8" }, { cor: "#FBF7F2", fundo: "#F7F7F7" }, { cor: "#F4DDE1", fundo: "#F1E9EA" },
  { cor: "#DCE8EC", fundo: "#F6F0E8" }, { cor: "#E9C98F", fundo: "#F7F7F7" }, { cor: "#E3EDF0", fundo: "#F1E9EA" },
];

export function vitrineDe(p, i = 0) {
  const nome = String(p.name || "");
  const achou = PALAVRAS.find(([re]) => re.test(nome));
  return { ...PALETA[i % PALETA.length], ...p, cat: achou ? achou[1] : "Skin & Body", forma: achou ? achou[2] : "frasco", size: p.size || "" };
}

/* O que /api/loja-catalogo devolveu → lista da vitrine. Linha torta é descartada, nunca "consertada". */
export function daLoja(cru) {
  if (!Array.isArray(cru)) return [];
  return cru
    .filter((p) => p && typeof p.id === "string" && p.id && typeof p.name === "string" && p.name.trim() && Number.isInteger(p.price_cents) && p.price_cents > 0)
    .map((p, i) => vitrineDe({
      id: p.id, name: p.name.trim().slice(0, 120), brand: String(p.brand || "").trim().slice(0, 80),
      description: String(p.description || "").trim().slice(0, 500), price_cents: p.price_cents,
      stock: p.stock === null || p.stock === undefined ? null : Math.max(0, Math.floor(Number(p.stock)) || 0), active: true,
    }, i));
}

/* As categorias que existem na lista, na ordem de CATS. */
export const catsDe = (lista) => ["All", ...CATS.slice(1).filter((c) => lista.some((p) => p.cat === c))];

/* A marca no rótulo: a do produto; sem marca, a da casa. A flor só vai em produto da casa. */
export const marcaDe = (p) => (String(p.brand || "").trim() || "Natura");
export const daCasa = (p) => /^natura\b/i.test(marcaDe(p));
/* A linha pequena do rótulo: sem "The"/marca na frente; nome comprido fica com as 2 últimas palavras. */
export function rotuloDe(p) {
  const marca = marcaDe(p).toLowerCase();
  let n = String(p.name || "").replace(/^the\s+/i, "").trim();
  if (n.toLowerCase().startsWith(marca + " ")) n = n.slice(marca.length + 1);
  n = n.replace(/^(Brazilian|Lexington|Daily|Hydrating|Keratin Care|Keratin|Glow)\s+/i, "");
  const w = n.split(/\s+/);
  return (n.length > 16 && w.length > 2 ? w.slice(-2).join(" ") : n).toUpperCase();
}

/* "$38" quando é redondo, "$38.50" quando não — mesmo formato de dinheiro() em functions/lib/produtos.js. */
export const usd = (cents) => {
  const c = Math.round(Number(cents) || 0);
  return "$" + (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));
};

/* Mesma régua da plataforma: estoque null/"" = não controlado, nunca "esgotado". */
export const esgotado = (p) => p.stock !== null && p.stock !== undefined && p.stock !== "" && Number(p.stock) <= 0;
export const vendivel = (p) => !!p && p.active !== false && !esgotado(p);
export const qtdMaxDe = (p) => (p.stock === null || p.stock === undefined || p.stock === "" ? LOJA.qtdMax : Math.min(LOJA.qtdMax, Number(p.stock)));

const porId = (lista) => new Map(lista.map((p) => [p.id, p]));

/* A sacola que volta do navegador pode ser velha ou adulterada: só fica produto que existe, está à
   venda, com quantidade inteira entre 1 e o máximo daquele produto. */
export function limparSacola(cru, lista = PRODUTOS) {
  const mapa = porId(lista);
  const limpa = {};
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) return limpa;
  for (const [id, q] of Object.entries(cru)) {
    const p = mapa.get(id);
    const n = Math.floor(Number(q));
    if (p && vendivel(p) && Number.isFinite(n) && n >= 1) limpa[id] = Math.min(n, qtdMaxDe(p));
  }
  return limpa;
}

export function linhasDe(sacola, lista = PRODUTOS) {
  return lista.filter((p) => sacola[p.id] > 0).map((p) => ({ p, qtd: sacola[p.id], cents: sacola[p.id] * p.price_cents }));
}

export const subtotalDe = (sacola, lista = PRODUTOS) => linhasDe(sacola, lista).reduce((n, l) => n + l.cents, 0);
export const qtdDe = (sacola) => Object.values(sacola).reduce((n, q) => n + q, 0);

/* Frete: retirada é sempre grátis; envio é grátis a partir de freteGratisCents. */
export function freteDe(subtotal, entregaId) {
  const e = ENTREGAS.find((x) => x.id === entregaId);
  if (!e || subtotal <= 0) return 0;
  if (e.cents !== null) return e.cents;
  return subtotal >= LOJA.freteGratisCents ? 0 : LOJA.freteCents;
}
export const faltaFreteGratis = (subtotal) => Math.max(0, LOJA.freteGratisCents - subtotal);

/* "Pairs well with" — o que oferecer dentro da sacola, abaixo dos itens. No máximo 2 produtos vendíveis
   que ainda NÃO estão nela. Regra (Luis, 2026-10-04): FECHAR O FRETE GRÁTIS.
     • falta dinheiro para o frete grátis → primeiro o produto MAIS BARATO que sozinho cobre o que falta;
       se nenhum cobre, o mais caro (o que mais chega perto);
     • já tem frete grátis → os mais baratos, como um mimo a mais.
   Sacola vazia não sugere nada. */
export function sugerir(sacola, lista = PRODUTOS) {
  const subtotal = subtotalDe(sacola, lista);
  if (subtotal <= 0) return [];
  const falta = faltaFreteGratis(subtotal);
  const candidatos = lista.filter((p) => vendivel(p) && !sacola[p.id]);
  const cobre = candidatos.filter((p) => p.price_cents >= falta).sort((a, b) => a.price_cents - b.price_cents);
  const quase = candidatos.filter((p) => p.price_cents < falta).sort((a, b) => b.price_cents - a.price_cents);
  return [...cobre, ...quase].slice(0, 2);
}
