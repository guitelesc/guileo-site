// GUARDA DO SOFT-404 — status errado com conteúdo certo é pior que erro honesto.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUE ESTE TESTE EXISTE
// A SPA responde o mesmo shell em QUALQUER caminho. Se o servidor devolve 200 junto, uma URL que
// nunca existiu vira "soft-404": o Google indexa incontáveis endereços servindo a HOME INTEIRA, e
// o sinal das páginas reais (as 143 de vertical×cidade) se dilui entre elas.
//
// O _middleware.js já corrigia isso — mas a régua da extensão dava passe livre a qualquer coisa
// terminada em ponto+extensão, e `.html` cabia nela. Em 27/08/2026 `/lorem-ipsum-123.html`, uma URL
// inventada na hora, respondia 200 com a landing completa. Ficou invisível por meses porque quem
// erra a URL digita `/planoss`, não `/planoss.html` — só apareceu quando concept.html e
// experience.html foram apagados e caíram nesse balde.
//
// A correção tem DOIS lados, e este teste guarda os dois:
//   1. `.html` inexistente TEM que dar 404 (senão o soft-404 volta);
//   2. `.html` que existe de verdade NÃO pode dar 404 (senão a correção derruba página viva).
// O lado 2 é o perigoso: /index.html e /presente/<negocio>/index.html são páginas reais, e a
// segunda é a única chance de impressionar o dono de um negócio que abriu o link do e-mail.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../_middleware.js";

// context.next() finge o que o Pages faria: devolve o shell da SPA com 200.
const ctx = (u) => ({
  request: new Request(u, { method: "GET" }),
  next: async () => new Response("<html>shell da SPA</html>", {
    status: 200, headers: { "content-type": "text/html; charset=utf-8" },
  }),
});

const CASOS = [
  ["/lorem-ipsum-123.html", 404, "o BUG original: .html inexistente devolvia 200 com a home"],
  ["/concept.html", 404, "órfão apagado em 27/08"],
  ["/experience.html", 404, "órfão apagado em 27/08"],
  ["/pagina-que-nunca-existiu", 404, "rota limpa inexistente (já funcionava)"],
  ["/index.html", 200, "PÁGINA REAL — o Pages responde 308 -> /; 404 aqui quebraria o redirect"],
  ["/presente/capizzi/index.html", 200, "PÁGINA REAL de cliente"],
  ["/presente/dshal", 200, "PÁGINA REAL de cliente"],
  ["/", 200, "home"],
  ["/planos", 200, "rota conhecida"],
  ["/vendedor", 200, "rota conhecida"],
  ["/blog", 200, "rota conhecida"],
  ["/manifest.webmanifest", 200, "RAIZ por nome — navegador não instala PWA em cima de 404"],
  ["/sw.js", 200, "RAIZ por nome"],
  ["/robots.txt", 200, "RAIZ por nome"],
  ["/favicon.ico", 200, "RAIZ por nome"],
  ["/guileo-app-icon-1024.png", 200, "asset de verdade na raiz continua passando"],
];

test("soft-404: .html inexistente dá 404, .html real continua vivo", async () => {
  for (const [caminho, esperado, porque] of CASOS) {
    const res = await onRequest(ctx("https://guileoai.com" + caminho));
    assert.equal(res.status, esperado, `${caminho} devia ser ${esperado} (${porque}) — veio ${res.status}`);
  }
  console.log(`✅ ${CASOS.length} caminhos · .html inexistente 404, página real 200`);
});
