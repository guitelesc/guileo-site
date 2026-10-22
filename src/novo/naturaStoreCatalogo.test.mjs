// node --test src/novo/naturaStoreCatalogo.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { LOJA, PRODUTOS, usd, esgotado, limparSacola, subtotalDe, qtdDe, freteDe, faltaFreteGratis, sugerir, daLoja, vitrineDe, catsDe, rotuloDe, daCasa, marcaDe } from "./naturaStoreCatalogo.js";

test("dinheiro no formato da plataforma", () => {
  assert.equal(usd(3800), "$38");
  assert.equal(usd(3850), "$38.50");
  assert.equal(usd(0), "$0");
});

test("estoque null não é esgotado; 0 é", () => {
  assert.equal(esgotado({ stock: null }), false);
  assert.equal(esgotado({ stock: "" }), false);
  assert.equal(esgotado({ stock: 0 }), true);
  assert.equal(esgotado({ stock: 3 }), false);
});

test("sacola guardada: descarta id desconhecido, quantidade inválida e passa do teto", () => {
  const lista = [...PRODUTOS, { id: "sem", name: "X", price_cents: 100, stock: 0, active: true }, { id: "pouco", name: "Y", price_cents: 100, stock: 2, active: true }];
  const s = limparSacola({ "creme-maos": 2, fantasma: 3, shampoo: -1, mascara: "abc", "vela-jardim": 999, sem: 1, pouco: 5 }, lista);
  assert.deepEqual(s, { "creme-maos": 2, "vela-jardim": LOJA.qtdMax, pouco: 2 });
  assert.deepEqual(limparSacola(null), {});
  assert.deepEqual(limparSacola([1, 2]), {});
});

test("subtotal em centavos e contagem", () => {
  const s = { "creme-maos": 2, ritual: 1 };
  assert.equal(subtotalDe(s), 2 * 1800 + 9500);
  assert.equal(qtdDe(s), 3);
});

test("frete: retirada grátis, envio grátis só a partir do limite", () => {
  assert.equal(freteDe(1800, "astoria"), 0);
  assert.equal(freteDe(1800, "envio"), LOJA.freteCents);
  assert.equal(freteDe(LOJA.freteGratisCents, "envio"), 0);
  assert.equal(freteDe(0, "envio"), 0);
  assert.equal(faltaFreteGratis(LOJA.freteGratisCents - 500), 500);
  assert.equal(faltaFreteGratis(LOJA.freteGratisCents + 1), 0);
});

test("sugestão: no máximo 2, nunca algo que já está na sacola", () => {
  const s = { "creme-maos": 1, "shampoo-keratina": 1 };
  const r = sugerir(s);
  assert.ok(Array.isArray(r) && r.length <= 2);
  for (const p of r) assert.ok(!(p.id in s));
});

test("sugestão fecha o frete grátis: o mais barato que cobre o que falta vem primeiro", () => {
  // Hand Cream = $18 → faltam $57; o mais barato que cobre sozinho é a argola ($58), depois a fronha de seda ($64)
  const r = sugerir({ "creme-maos": 1 });
  assert.equal(r[0].id, "argola");
  assert.ok(r[0].price_cents >= faltaFreteGratis(subtotalDe({ "creme-maos": 1 })));
  assert.equal(r[1].price_cents, 6400);
  // vela + creme = $70 → faltam $5: todos cobrem, vem o mais barato que não está na sacola
  assert.equal(sugerir({ "vela-jardim": 1, "creme-corpo": 1 })[0].id, "creme-maos");
});

test("sugestão com frete grátis já garantido: os mais baratos; sacola vazia: nada", () => {
  assert.deepEqual(sugerir({ ritual: 1 }).map((p) => p.price_cents), [1800, 3200]);
  assert.deepEqual(sugerir({}), []);
});

test("produto do banco vira vitrine: categoria e embalagem pelo nome", () => {
  assert.deepEqual([vitrineDe({ name: "Amber Candle" }).cat, vitrineDe({ name: "Amber Candle" }).forma], ["Spa at Home", "vela"]);
  assert.deepEqual([vitrineDe({ name: "Keratin Care Mask" }).cat, vitrineDe({ name: "Keratin Care Mask" }).forma], ["Hair", "pote"]);
  assert.equal(vitrineDe({ name: "Olaplex No.3 Hair Perfector" }).cat, "Hair");
  assert.equal(vitrineDe({ name: "Hand Cream" }).forma, "tubo");
  assert.equal(vitrineDe({ name: "Holiday Gift Set" }).cat, "Gifts");
  assert.deepEqual([vitrineDe({ name: "Mystery Thing" }).cat, vitrineDe({ name: "Mystery Thing" }).forma], ["Skin & Body", "frasco"]);
});

test("resposta do banco: linha torta sai, nada é inventado", () => {
  const l = daLoja([
    { id: "u1", name: " Hand Cream ", brand: null, description: null, price_cents: 1800, stock: null },
    { id: "u2", name: "Sob consulta", price_cents: 0 },
    { id: "u3", name: "", price_cents: 500 },
    { name: "Sem id", price_cents: 500 },
    { id: "u4", name: "Kerastase Oil", brand: "Kerastase", price_cents: 4550, stock: 3 },
  ]);
  assert.deepEqual(l.map((p) => p.id), ["u1", "u4"]);
  assert.equal(l[0].name, "Hand Cream");
  assert.equal(l[0].description, "");
  assert.equal(l[1].stock, 3);
  assert.deepEqual(daLoja(null), []);
});

test("rótulo: marca do produto; flor só em produto da casa", () => {
  assert.equal(marcaDe({ brand: "" }), "Natura");
  assert.equal(daCasa({ brand: "Natura" }), true);
  assert.equal(daCasa({ brand: "Kerastase" }), false);
  assert.equal(rotuloDe({ name: "Kerastase Elixir Ultime Original Oil", brand: "Kerastase" }), "ORIGINAL OIL");
  assert.equal(rotuloDe({ name: "The Natura Ritual Set", brand: "Natura" }), "RITUAL SET");
  assert.equal(rotuloDe({ name: "Hand Cream" }), "HAND CREAM");
});

test("categorias só as que existem na lista", () => {
  assert.deepEqual(catsDe([{ cat: "Jewelry" }, { cat: "Hair" }]), ["All", "Hair", "Jewelry"]);
  assert.deepEqual(catsDe(PRODUTOS), ["All", "Hair", "Skin & Body", "Jewelry", "Spa at Home", "Gifts"]);
});

test("produto do banco: joia, toalha, roupão e fronha caem na categoria e no desenho certos", () => {
  const v = (name) => { const x = vitrineDe({ name }); return [x.cat, x.forma]; };
  assert.deepEqual(v("14k Gold Huggie Earrings"), ["Jewelry", "brinco"]);
  assert.deepEqual(v("Gold Plated Hoops"), ["Jewelry", "brinco"]);
  assert.deepEqual(v("Diamond Pendant Necklace"), ["Jewelry", "colar"]);
  assert.deepEqual(v("Tennis Bracelet"), ["Jewelry", "anel"]);
  assert.deepEqual(v("Turkish Cotton Bath Towel"), ["Spa at Home", "toalha"]);
  assert.deepEqual(v("Waffle Robe"), ["Spa at Home", "roupao"]);
  assert.deepEqual(v("Silk Pillowcase"), ["Spa at Home", "fronha"]);
  assert.deepEqual(v("Keratin Aftercare Shampoo"), ["Hair", "frasco"]);
  assert.deepEqual(v("Earring Gift Set"), ["Jewelry", "brinco"]);
});
