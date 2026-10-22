// node --test src/novo/naturaObjetivos.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { OBJETIVOS, menorPreco, servicosDoObjetivo, unidadeDoObjetivo } from "./naturaObjetivos.js";

// o MENU de verdade, lido da página (é ele que a cliente vê no cardápio)
const fonte = readFileSync(new URL("./NaturaSpa.jsx", import.meta.url), "utf8");
const i = fonte.indexOf("const MENU = ["); const j = fonte.indexOf("\n];", i);
const MENU = (0, eval)(fonte.slice(i + "const MENU = ".length, j + 2));

test("todo serviço citado existe no cardápio e tem preço em alguma unidade", () => {
  for (const o of OBJETIVOS.filter((x) => !x.medspa)) {
    for (const loc of ["astoria", "ues"]) {
      const l = servicosDoObjetivo(o, MENU, loc);
      assert.equal(l.length, o.servicos.length, `${o.id}/${loc}: algum serviço sumiu do MENU`);
      for (const s of l) assert.ok(s.desde > 0, `${o.id}: ${s.nome} sem preço`);
    }
  }
});

test("toda foto existe na pasta do site", () => {
  for (const o of OBJETIVOS) assert.ok(existsSync(new URL(`../../public/novo/natura-spa/v3/${o.foto}.webp`, import.meta.url)), o.foto);
});

test("preço 'from': o menor de cada formato do cardápio", () => {
  assert.equal(menorPreco(118), 118);
  assert.equal(menorPreco([90, 130]), 90);
  assert.equal(menorPreco({ "30 min": 80, "60 min": 118 }), 80);
  assert.equal(menorPreco(null), null);
});

test("serviço que só existe numa unidade vem marcado com o nome dela", () => {
  const unwind = OBJETIVOS.find((o) => o.id === "unwind");
  const ues = servicosDoObjetivo(unwind, MENU, "ues");
  assert.equal(ues.find((s) => s.nome === "Natura Spa Signature").so, "Astoria");   // a Signature não existe no UES
  assert.equal(unidadeDoObjetivo(unwind, MENU, "ues"), "ues");                     // 2 de 3 existem lá: fica
  assert.equal(unidadeDoObjetivo(unwind, MENU, "med"), "astoria");                 // o Med Spa não tem cardápio próprio
});
