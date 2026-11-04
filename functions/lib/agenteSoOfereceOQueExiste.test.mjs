// A AGENTE SÓ OFERECE E COBRA O QUE EXISTE (v28, 2026-10-22) — os 3 defeitos achados na Lilian da Natura.
//   node functions/lib/agenteSoOfereceOQueExiste.test.mjs
import assert from "node:assert/strict";
import { buildGuiPrompt, cortarConhecimento, TETO_CONHECIMENTO } from "./provision.js";
import { upsellSection, linhaCabeNoCatalogo } from "../../src/data/upsellPlaybook.js";

let falhas = 0;
const caso = (nome, fn) => { try { fn(); console.log("ok  ", nome); } catch (e) { falhas++; console.log("FAIL", nome, "\n    ", e.message); } };

// catálogo real da Natura (formato do bloco PRICES) — sem unhas
const NATURA = `Haircut · Astoria — $60
Hair Color · Astoria — $80
Facial · Astoria — $118
Massage 60min · Astoria — $118
Lashes · Astoria (classic set) — $100`;

// ── 1. upsell só do que existe ──
caso("Natura: a linha da manicure sai do upsell", () => {
  const s = upsellSection("salon", "en", NATURA);
  assert.doesNotMatch(s, /manicure|pedicure/i, s);
  assert.match(s, /Haircut booked/);
  assert.match(s, /Color service/);
});
caso("salão que faz unhas continua recebendo manicure → pedicure", () => {
  assert.match(upsellSection("salon", "en", NATURA + "\nManicure — $35"), /pedicure/i);
});
caso("sem catálogo nada muda (as 3 linhas do salão)", () => {
  assert.equal(upsellSection("salon", "en").split("\n").length, 4);
});
caso("linha genérica sem gatilho fica sempre", () => {
  assert.equal(linhaCabeNoCatalogo("Serviço fechado → ofereça UM adicional", "Pizza — $10"), true);
});
caso("PT: 'Marcou corte' casa com 'Corte feminino'", () => {
  assert.equal(linhaCabeNoCatalogo("Marcou corte → hidratação", "Corte feminino — R$ 80"), true);
});

// ── 2. conhecimento nunca cortado no meio da frase ──
const entrada = (i) => `Q: Pergunta número ${i} sobre o spa? — A: Resposta completa número ${i}, com detalhes suficientes para ocupar espaço de verdade no prompt da agente.`;
const FAQ_GRANDE = Array.from({ length: 140 }, (_, i) => entrada(i)).join("\n"); // ~20 mil caracteres
caso("FAQ maior que o teto termina numa entrada inteira + aviso", () => {
  const k = cortarConhecimento(FAQ_GRANDE);
  assert.ok(k.length <= TETO_CONHECIMENTO + 200, `tamanho ${k.length}`);
  const ultima = k.split("\n").filter((l) => l.startsWith("Q:")).pop();
  assert.match(ultima, /prompt da agente\.$/, `última entrada cortada: ${ultima.slice(-60)}`);
  assert.match(k, /did not fit/);
});
caso("FAQ de 6 mil caracteres (a da Natura) entra INTEIRA — o teto antigo de 4.000 cortava", () => {
  const faq = Array.from({ length: 40 }, (_, i) => entrada(i)).join("\n");
  assert.ok(faq.length > 4000 && faq.length < TETO_CONHECIMENTO);
  const { prompt } = buildGuiPrompt({ business: "Natura Spa", industry: "salon", lang: "en", brain: faq, prices: NATURA, pagamentos: false });
  assert.ok(prompt.includes(entrada(39)), "a última entrada não chegou ao prompt");
});

// ── 3. cobrança só com conta + SMS ──
caso("sem pagamento: nada de link, sinal ou 'texto'", () => {
  const { prompt } = buildGuiPrompt({ business: "Natura Spa", industry: "salon", lang: "en", brain: "", prices: NATURA, pagamentos: false });
  assert.doesNotMatch(prompt, /CLOSE & COLLECT/);
  assert.doesNotMatch(prompt, /text you a secure link|PAY NOW OR LATER/);
  assert.match(prompt, /does not take payments online yet/);
  assert.match(prompt, /NEVER ask for, repeat, or write down a card number/);
});
caso("com pagamento: o bloco de cobrança continua", () => {
  const { prompt } = buildGuiPrompt({ business: "Outro", industry: "salon", lang: "en", prices: NATURA, pagamentos: true });
  assert.match(prompt, /CLOSE & COLLECT/);
});
caso("chamador antigo (sem passar pagamentos) mantém o comportamento de antes", () => {
  const { prompt } = buildGuiPrompt({ business: "Outro", industry: "salon", lang: "en", prices: NATURA });
  assert.match(prompt, /CLOSE & COLLECT/);
});
caso("prompt da Natura não fala de pedicure em lugar nenhum fora da lição", () => {
  const { prompt } = buildGuiPrompt({ business: "Natura Spa", industry: "salon", lang: "en", prices: NATURA, pagamentos: false });
  const fora = prompt.split("\n").filter((l) => /pedicure/i.test(l));
  assert.equal(fora.length, 0, fora.join(" | "));
});

console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo ok");
process.exit(falhas ? 1 : 0);
