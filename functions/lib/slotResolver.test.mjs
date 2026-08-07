// Teste do resolvedor de horário. Roda com: node functions/lib/slotResolver.test.mjs
//
// POR QUE ESTE TESTE EXISTE: o bug que ele guarda derrubou TODA marcação por telefone, em todos
// os clientes, sem nunca aparecer num log de erro — a agente só dizia "não tem esse horário".
// Um caso aqui vale mais que uma leitura de código: `Date.parse("amanhã às 9")` devolve
// 2001-09-01 em vez de erro, e nenhuma revisão visual pega isso.
import { resolveSlot } from "./slotResolver.js";

const TZ = "America/New_York";
// Horários livres REAIS que o motor devolveu (9h–11h em Nova York = 13h–15h UTC).
const SLOTS = ["13:00", "13:30", "14:00", "14:30", "15:00"].map((h) => ({ start: `2026-08-07T${h}:00+00:00`, pro: "Guileo" }));
const hhmm = (s) => (s ? new Date(s.start).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : null);

// Congela "agora" em 06/08/2026 para "amanhã" ser sempre 07/08 — senão o teste passa hoje e
// quebra amanhã, que é o pior tipo de teste.
const AGORA = new Date("2026-08-06T18:00:00Z").getTime();
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(AGORA); }
  static now() { return AGORA; }
};

const CASOS = [
  // [ o que a pessoa falou,        horário esperado (null = recusar e oferecer opções) ]
  ["amanhã às 9", "09:00"],
  ["amanhã as 9h", "09:00"],
  ["tomorrow at 9am", "09:00"],
  ["mañana a las 9", "09:00"],
  ["amanhã 10:30", "10:30"],
  ["tomorrow at 10:30", "10:30"],
  ["amanhã às 9 e meia", "09:30"],
  ["amanhã de manhã", "09:00"],
  ["tomorrow", "09:00"],
  ["2026-08-07T14:00:00+00:00", "10:00"],      // ISO — o caminho preferido
  ["amanhã às 11", "11:00"],
  // NÃO ARREDONDAR pedido exato: quem pede 9:15 não pode ser MOVIDO para 9:30 sem combinar.
  ["amanhã às 9:15", null],
  // Quando a própria pessoa aproxima, arredondar é o que ela espera. 9:15 está a 15 min de 9:00
  // E de 9:30 — empate. Em empate fica o MAIS CEDO: atender antes é melhor para os dois lados.
  // (Minha expectativa inicial aqui era 9:30 e o teste acusou; o código estava certo.)
  ["amanhã por volta das 9:15", "09:00"],
  ["tomorrow around 9:15", "09:00"],
  // recusas: melhor perguntar que marcar errado
  ["amanhã às 20h", null],                      // fora do expediente
  ["quero marcar", null],                       // sem dia nem hora
  ["hoje às 9", null],                          // hoje já passou das 9
  ["", null],
];

let ok = 0;
for (const [fala, esperado] of CASOS) {
  const got = hhmm(resolveSlot(fala, SLOTS, TZ));
  const passou = got === esperado;
  if (passou) ok++;
  console.log(`${passou ? "✅" : "❌"} ${JSON.stringify(fala).padEnd(30)} → ${got ?? "recusa"}${passou ? "" : `   ESPERADO: ${esperado ?? "recusa"}`}`);
}
console.log(`\n${ok}/${CASOS.length} casos corretos`);
if (ok !== CASOS.length) process.exit(1);
