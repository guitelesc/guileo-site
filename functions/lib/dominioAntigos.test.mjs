// node --test functions/lib/dominioAntigos.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { ANTIGOS, redirecionamentoDe, rotaDoCliente, unidadeDoCaminho } from "./dominio.js";

test("endereço antigo do WordPress → 301 para o equivalente", () => {
  assert.deepEqual(rotaDoCliente("/about/", "natura-spa"), { tipo: "redirecionar", para: "/#about" });
  assert.deepEqual(rotaDoCliente("/Hair-Salon-Astoria", "natura-spa"), { tipo: "redirecionar", para: "/astoria" });
  assert.equal(redirecionamentoDe("natura-spa", "/services-menu-east-side/"), "/upper-east-side#menu");
});
test("o que não é antigo segue igual", () => {
  assert.equal(rotaDoCliente("/", "natura-spa").tipo, "pagina");
  assert.equal(rotaDoCliente("/astoria", "natura-spa").tipo, "pagina");
  assert.equal(rotaDoCliente("/portal", "natura-spa").tipo, "negado");
  assert.equal(rotaDoCliente("/about/extra", "natura-spa").tipo, "negado");
  assert.equal(redirecionamentoDe("outra", "/about"), null);
  assert.equal(redirecionamentoDe("natura-spa", "/__proto__"), null);
});
test("todo destino aponta para página que existe aqui", () => {
  for (const para of Object.values(ANTIGOS["natura-spa"])) {
    const caminho = para.split("#")[0];
    assert.ok(caminho === "/" || unidadeDoCaminho("natura-spa", caminho), `destino inexistente: ${para}`);
  }
});
