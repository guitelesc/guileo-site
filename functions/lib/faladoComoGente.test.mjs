// Teste de IDA E VOLTA: falar → entender → mesmo horário. Roda com:
//   node functions/lib/faladoComoGente.test.mjs
//
// POR QUE ASSIM: um teste normal me obriga a escrever a resposta esperada — e minha expectativa
// já esteve errada (esperei 9:30 para "por volta das 9:15"; o código estava certo, eu não). Aqui
// não há expectativa minha: a propriedade é que a frase gerada, ao passar pelo resolvedor, tem
// que voltar para EXATAMENTE o horário de onde saiu. Se qualquer um dos dois lados mudar sozinho,
// o par para de fechar e o teste acusa — sem eu precisar adivinhar nada.
//
// Cobre os 7 dias da semana de propósito: o defeito de 2026-08-08 só aparecia quando o horário
// caía num dia que não era hoje nem amanhã, e por isso passou despercebido a semana inteira.
import { faladoComoGente } from "./faladoComoGente.js";
import { resolveSlot } from "./slotResolver.js";

const TZ = "America/New_York";
// Congela o "agora" numa QUINTA — assim "hoje", "amanhã" e "dia da semana" são todos exercitados
// numa rodada só, e o teste dá o mesmo resultado em qualquer dia em que for executado.
// 8h da manhã em NY: assim TODOS os horários da lista (9h e 14h) ainda estão no futuro, inclusive
// os de hoje. Isso importa porque o resolveSlot NÃO filtra passado — quem filtra é o motor de
// disponibilidade, que jamais oferece um horário que já foi. Pôr um horário vencido na lista
// testaria uma entrada que não existe na vida real, e a "falha" seria só da minha premissa.
const AGORA = new Date("2026-08-06T12:00:00Z").getTime();   // quinta, 8h em NY
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(AGORA); }
  static now() { return AGORA; }
};

// Horários livres nos 7 dias seguintes, às 9h e às 14h de Nova York (13h e 18h UTC).
const SLOTS = [];
for (let d = 0; d < 7; d++) {
  const dia = new RealDate(AGORA + d * 86400000).toISOString().slice(0, 10);
  SLOTS.push({ start: `${dia}T13:00:00+00:00`, pro: "Ana" });
  SLOTS.push({ start: `${dia}T18:00:00+00:00`, pro: "Ana" });
}

const rotulo = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

let ok = 0, total = 0;
for (const slot of SLOTS) {
  total++;
  const frase = faladoComoGente(slot.start, TZ);
  const devolta = resolveSlot(frase, SLOTS, TZ);
  const passou = devolta?.start === slot.start;
  if (passou) ok++;
  console.log(`${passou ? "✅" : "❌"} ${rotulo(slot.start).padEnd(26)} → "${frase}"${passou ? "" : `   VOLTOU: ${devolta ? rotulo(devolta.start) : "recusa"}`}`);
}

console.log(`\n${ok}/${total} idas-e-voltas fecharam`);
if (ok !== total) process.exit(1);
