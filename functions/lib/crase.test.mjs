/* A CRASE DENTRO DO TEMPLATE LITERAL — o defeito que me pegou QUATRO vezes num dia.
   Dentro de `...` (inclusive em comentário), uma crase FECHA a string e o arquivo morre com um
   erro de sintaxe que aponta pra linha errada. Custou 4 builds quebrados e um deploy de dist
   velho (npm run build && deploy sobe o antigo quando o build falha).
   Este teste não julga estilo: ele só falha se o arquivo não compilar, e diz o porquê provável.
   Rodar: node --test functions/lib/crase.test.mjs */
import { test } from "node:test";
import assert from "node:assert";

test("emailTemplates.js compila (crase solta em template literal quebra tudo)", async () => {
  try {
    const m = await import("./emailTemplates.js");
    assert.equal(typeof m.websiteUpgradeEmail, "function");
    assert.equal(typeof m.achadoEmail, "function");
  } catch (e) {
    assert.fail(`emailTemplates.js NAO compila: ${e.message}\n` +
      "→ suspeita nº1: uma crase dentro de um comentario num template literal. " +
      "Comentario dentro de <style>{...} ou de HTML em template string NUNCA leva crase.");
  }
});
