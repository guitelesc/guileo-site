// node --test functions/lib/analiseDaLigacao.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { leituraDaLigacao, CAMPOS_DA_LIGACAO } from "./analiseDaLigacao.js";

const comCampos = (o) => ({ data_collection_results: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { data_collection_id: k, value: v, rationale: "" }])) });

test("lê os quatro campos no formato do webhook da ElevenLabs", () => {
  const r = leituraDaLigacao(comCampos({ sentimento: "negative", intencao: "cancelar horário", nota: "reclamou da espera", resumo: "Ana ligou para cancelar." }));
  assert.deepEqual(r, { sentiment: "negative", intent: "cancelar horário", note: "reclamou da espera", resumo: "Ana ligou para cancelar." });
});

test("aceita o sentimento em português e com ruído", () => {
  assert.equal(leituraDaLigacao(comCampos({ sentimento: "Negativo." })).sentiment, "negative");
  assert.equal(leituraDaLigacao(comCampos({ sentimento: "positiva" })).sentiment, "positive");
});

test("valor desconhecido não vira humor inventado", () => {
  assert.equal(leituraDaLigacao(comCampos({ sentimento: "talvez", intencao: "preço" })).sentiment, null);
});

test("agente sem os campos → null (o webhook avisa, não inventa)", () => {
  assert.equal(leituraDaLigacao({ transcript_summary: "x" }), null);
  assert.equal(leituraDaLigacao({ data_collection_results: {} }), null);
  assert.equal(leituraDaLigacao(undefined), null);
});

test("os campos que vão para o agente têm tipo e descrição", () => {
  for (const [k, v] of Object.entries(CAMPOS_DA_LIGACAO)) { assert.equal(v.type, "string", k); assert.ok(v.description.length > 20, k); }
});

test("sem os campos, usa o humor geral da ElevenLabs", () => {
  assert.deepEqual(leituraDaLigacao({ sentiment_analysis: { overall_label: "negative" } }), { sentiment: "negative", intent: null, note: null, resumo: null });
  assert.equal(leituraDaLigacao({}, { sentiment_analysis: { overall_label: "positive" } }).sentiment, "positive");
});
