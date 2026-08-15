// functions/lib/faladoComoGente.js — TRANSFORMA UM HORÁRIO REAL NA FRASE QUE UMA PESSOA DIRIA.
//
// É o inverso do slotResolver: ele traduz fala → horário; este traduz horário → fala. Existe para
// os TESTES: a única forma honesta de provar que a agente marca por telefone é pedir do jeito que
// um cliente pede ("na segunda as 9:00"), nunca com um carimbo ISO que nenhum humano fala.
//
// A LIÇÃO QUE ESTE ARQUIVO GUARDA (2026-08-08): a versão anterior só sabia dizer "hoje" ou
// "amanhã". Numa SEXTA à noite, com expediente de segunda a sexta, o próximo horário livre é
// SEGUNDA — o teste pedia "amanhã", a agente recusava CERTO (sábado não abre), e o painel pintou
// de vermelho um motor perfeito. Um falso vermelho é pior que nenhum semáforo: manda consertar o
// que está bom e queima a confiança no painel inteiro.
//
// Mora numa biblioteca, e não colado dentro de quem chama, porque no dia em que existir uma
// segunda cópia a próxima correção vai chegar só numa delas.

const DIA_PT = { Sun: "domingo", Mon: "segunda", Tue: "terca", Wed: "quarta", Thu: "quinta", Fri: "sexta", Sat: "sabado" };

// Data no formato AAAA-MM-DD, no fuso do NEGÓCIO — nunca no do servidor. O Worker roda em UTC:
// às 20h de Nova York o servidor já virou o dia, e "hoje" sairia errado por algumas horas todo dia.
const diaLocal = (d, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/**
 * @param {string} iso    início do horário (carimbo ISO vindo da disponibilidade real)
 * @param {string} tz     fuso do negócio
 * @returns {string}      ex.: "hoje as 14:30" · "amanha as 9:00" · "na segunda as 9:00"
 *                        string vazia se o carimbo não for uma data válida — quem chama decide,
 *                        porque devolver uma frase inventada faria o teste "passar" sem testar nada.
 */
export function faladoComoGente(iso, tz = "America/New_York") {
  const quandoData = new Date(iso);
  if (!iso || Number.isNaN(quandoData.getTime())) return "";

  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(quandoData);
  const g = (t) => (p.find((x) => x.type === t) || {}).value;

  const dia = `${g("year")}-${g("month")}-${g("day")}`;
  const hoje = diaLocal(new Date(), tz);
  const amanha = diaLocal(new Date(Date.now() + 86400000), tz);

  // Fora de hoje/amanhã, o nome do dia da semana — que o slotResolver entende ("na segunda").
  const sigla = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(quandoData);
  const quando = dia === hoje ? "hoje" : dia === amanha ? "amanha" : `na ${DIA_PT[sigla] || "segunda"}`;

  // Hora sem zero à esquerda ("9:00", não "09:00") porque é assim que se fala.
  return `${quando} as ${Number(g("hour"))}:${g("minute")}`;
}
