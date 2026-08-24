import { test } from "node:test";
import assert from "node:assert/strict";
import { feriadosDoAno, feriadosDaqui } from "./feriados.js";

// A REGRA QUE ESTE ARQUIVO EXISTE PRA PROTEGER: falha devolve `null`, nunca `[]`.
// Lista vazia LÊ como "não há feriado neste ano" — é a mesma família do `|| []` que já
// transformou motor morto em "nada encontrado" e custou 5 diagnósticos falsos num dia.
test("entrada inválida devolve null, nunca lista vazia", async () => {
  for (const p of ["", "X", "USA", "1A", null, undefined]) {
    const r = await feriadosDoAno(p, 2026);
    assert.equal(r, null, `país ${JSON.stringify(p)} devia dar null`);
  }
  for (const a of [1900, 2200, "abc", NaN]) {
    assert.equal(await feriadosDoAno("US", a), null, `ano ${a} devia dar null`);
  }
});

// Só roda quando a rede está disponível — sem isso o teste vira flaky em CI offline.
test("feriados reais dos EUA vêm ordenados e do futuro", { skip: !process.env.REDE }, async () => {
  const f = await feriadosDaqui("US", "2026-12-20");
  assert.ok(Array.isArray(f) && f.length > 0);
  assert.ok(f.every((x) => x.date >= "2026-12-20"), "não pode devolver data passada");
  assert.deepEqual([...f].sort((a, b) => (a.date < b.date ? -1 : 1)), f, "tem que vir ordenado");
  assert.ok(f.some((x) => x.date.startsWith("2027")), "tem que atravessar a virada do ano");
});
