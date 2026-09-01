/* ══════════════════════════════════════════════════════════════════════════════════════════════
   A TRAVA DA CRASE — versão das VITRINES.
   Já existia uma para functions/lib/emailTemplates.js. Não existia para src/novo/*.jsx, e em
   27/08 eu quebrei a build pela QUINTA vez do mesmo jeito: escrevi uma palavra entre crases
   dentro de um COMENTÁRIO que mora dentro do <style>{` … `}. A crase fecha a string, e o erro
   que aparece é "Expected } but found Identifier" — 300 linhas longe da causa real.

   Este teste não compila nada: ele conta as crases DENTRO de cada bloco <style>{` … `}. Se
   sobrou uma, ela não deveria estar ali. Roda em 1 segundo:  node --test src/novo/crase.test.mjs
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

test("nenhuma crase solta dentro de <style>{` … `} nas vitrines", () => {
  const arquivos = readdirSync(AQUI).filter((f) => f.endsWith(".jsx"));
  assert.ok(arquivos.length > 0, "não achei nenhuma vitrine para checar");
  const culpados = [];

  for (const f of arquivos) {
    const src = readFileSync(join(AQUI, f), "utf8");
    let i = 0;
    while (true) {
      const abre = src.indexOf("<style>{`", i);
      if (abre === -1) break;
      const ini = abre + "<style>{`".length;
      const fim = src.indexOf("`}</style>", ini);
      if (fim === -1) { culpados.push(`${f}: <style> aberto e nunca fechado`); break; }
      const dentro = src.slice(ini, fim);
      const n = (dentro.match(/`/g) || []).length;
      if (n > 0) {
        const linha = src.slice(0, ini + dentro.indexOf("`")).split("\n").length;
        culpados.push(`${f}:${linha} — ${n} crase(s) dentro do <style>`);
      }
      i = fim + 1;
    }
  }

  assert.deepEqual(culpados, [],
    "crase solta dentro de um template literal:\n  " + culpados.join("\n  ")
    + "\n→ ela FECHA a string. O erro da build aparece longe daqui. Troque por aspas ou remova.");
});
