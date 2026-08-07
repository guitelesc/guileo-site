// functions/lib/slotResolver.js — TRADUZ O QUE A PESSOA FALOU NUM HORÁRIO REAL DA AGENDA.
//
// O BUG QUE ISTO CONSERTA (2026-08-07, achado na 1ª ligação real do Luis):
// A ferramenta `schedule` pede o horário EM LINGUAGEM NATURAL — a própria descrição dizia
// "e.g. 'amanhã às 20h'". Mas o código fazia `Date.parse("amanhã às 20h")` → NaN, e comparava
// NaN com o instante do slot. NaN nunca é menor que nada: a comparação dava false SEMPRE.
// Resultado: a agente NUNCA conseguia casar o horário pedido com um horário livre. Ela tentou
// marcar 5 vezes em 61 segundos, falhou nas 5, e escalou pra um humano.
//
// Não era "sem vaga": a agenda tinha 5 horários livres naquele instante. Era um contrato
// quebrado entre duas metades do próprio sistema — e por isso NENHUM cliente jamais conseguiu
// marcar por telefone. O banco estava certo o tempo todo.
//
// ── COMO ISTO DECIDE ─────────────────────────────────────────────────────────
// A regra de ouro: só devolvemos um horário que ESTÁ na lista de horários livres que o motor
// acabou de calcular. Nunca inventamos um instante e torcemos pra estar livre — é assim que se
// marca dois pacientes no mesmo horário. Se não der pra ter certeza, devolvemos null e a agente
// oferece as opções reais. Ambiguidade vira pergunta, nunca vira chute.

// Hora/minuto locais de um instante, no fuso do NEGÓCIO (não no do servidor).
function localParts(iso, tz) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(d);
  const g = (t) => (f.find((p) => p.type === t) || {}).value;
  return {
    ymd: `${g("year")}-${g("month")}-${g("day")}`,
    hour: Number(g("hour")) % 24,
    minute: Number(g("minute")),
    weekday: (g("weekday") || "").toLowerCase(),   // sun, mon, …
  };
}

// "hoje" no fuso do negócio, e o dia seguinte — base pra "amanhã".
function ymdOffset(tz, days) {
  const d = new Date(Date.now() + days * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// ACENTO QUEBRA `\b` NO JAVASCRIPT. "amanhã" termina em ã, que o motor de regex não considera
// letra — então /\bamanhã\b/ simplesmente não casa. Foi por isso que "amanhã às 9" falhou no
// primeiro teste. A saída é tirar o acento ANTES de comparar: "amanhã" → "amanha", "às" → "as",
// "mañana" → "manana". Todos os padrões abaixo são escritos SEM acento de propósito.
const semAcento = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const DIAS = {
  sun: ["domingo", "sunday"], mon: ["segunda", "monday", "lunes"],
  tue: ["terca", "tuesday", "martes"], wed: ["quarta", "wednesday", "miercoles"],
  thu: ["quinta", "thursday", "jueves"], fri: ["sexta", "friday", "viernes"],
  sat: ["sabado", "saturday"],
};

// Números por extenso que aparecem em hora falada. Só até 12 — acima disso ninguém fala assim.
const EXTENSO = {
  uma: 1, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8,
  nove: 9, dez: 10, onze: 11, doze: 12, meio: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, noon: 12,
};

// Extrai {hour, minute} do texto. null = a pessoa não disse hora (só o dia).
function extrairHora(t) {
  // 14:30 · 14h30 · 2:30pm · 9h · 9 am · "nove e meia"
  let m = t.match(/(\d{1,2})\s*[:hH]\s*(\d{2})/);
  let hour = null, minute = 0;
  if (m) { hour = Number(m[1]); minute = Number(m[2]); }
  else {
    m = t.match(/(\d{1,2})\s*h(?!\d)/);                       // "9h"
    if (m) { hour = Number(m[1]); minute = 0; }
    else {
      m = t.match(/\b(\d{1,2})\s*(am|pm|a\.m|p\.m)\b/i);      // "2 pm"
      if (m) { hour = Number(m[1]); minute = 0; }
      else {
        for (const [p, n] of Object.entries(EXTENSO)) {       // "às nove", "at nine"
          if (new RegExp(`\\b${p}\\b`, "i").test(t)) { hour = n; break; }
        }
        // número solto só conta se vier depois de "às/at/a las" — senão "7 de agosto" vira 7h
        if (hour === null) { m = t.match(/(?:\bas|\bat|a las|para as|pra as)\s*(\d{1,2})\b/i); if (m) hour = Number(m[1]); }
      }
    }
  }
  if (hour === null) return null;
  if (/\be meia\b|\band a half\b|\by media\b|:30/.test(t)) minute = 30;

  // TARDE/NOITE: "duas da tarde" = 14h, não 2h. Sem essa correção a agente marca de madrugada.
  const pm = /\b(pm|p\.m|tarde|noite|afternoon|evening|night|noche)\b/i.test(t);
  const am = /\b(am|a\.m|manha|morning|madrugada)\b/i.test(t);
  if (pm && hour < 12) hour += 12;
  if (am && hour === 12) hour = 0;
  // sem marcador, hora comercial: "às 2" num salão é 14h, não 2 da madrugada
  if (!pm && !am && hour >= 1 && hour <= 7) hour += 12;
  return { hour, minute };
}

// Extrai o DIA alvo (YYYY-MM-DD no fuso do negócio). null = não disse dia.
function extrairDia(t, tz, slots) {
  if (/\bhoje\b|\btoday\b|\bhoy\b/.test(t)) return ymdOffset(tz, 0);
  if (/\bamanha\b|\btomorrow\b|\bmanana\b/.test(t)) return ymdOffset(tz, 1);
  if (/depois de amanha|day after tomorrow|pasado manana/.test(t)) return ymdOffset(tz, 2);
  // dia da semana ("na quinta", "on friday") → o PRÓXIMO slot livre nesse dia
  for (const [cod, nomes] of Object.entries(DIAS)) {
    if (nomes.some((n) => new RegExp(`\\b${n}\\b`, "i").test(t))) {
      const s = slots.find((x) => (localParts(x.start, tz) || {}).weekday === cod);
      return s ? localParts(s.start, tz).ymd : null;
    }
  }
  // data explícita: "dia 7", "7 de agosto", "aug 7", "07/08"
  const m = t.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/) || t.match(/\bdia\s+(\d{1,2})\b/i);
  if (m) {
    const alvo = Number(m[1]);
    const s = slots.find((x) => Number((localParts(x.start, tz) || {}).ymd.slice(-2)) === alvo);
    return s ? localParts(s.start, tz).ymd : null;
  }
  return null;
}

// resolveSlot(when, slots, tz) → o slot escolhido da lista, ou null.
// `slots` = exatamente o que biz_availability devolveu (cada um com .start ISO).
export function resolveSlot(when, slots, tz = "America/New_York") {
  const lista = Array.isArray(slots) ? slots.filter((s) => s && s.start) : [];
  const txt = String(when || "").trim();
  if (!txt || !lista.length) return null;

  // 1) ISO → casa pelo INSTANTE (tolerância de 60s). É o caminho preferido: a agente recebe os
  // horários livres em ISO e devolve o mesmo ISO.
  //
  // ⚠️ `Date.parse` NÃO PODE DECIDIR ISSO. Ele aceita lixo em silêncio:
  //      Date.parse("amanhã às 9")  →  2001-09-01   (não é NaN — é uma data INVENTADA)
  // Confiar nele aqui não só perderia o horário: uma data fabricada pode casar com um slot real
  // e marcar o paciente no DIA ERRADO. Por isso o formato é verificado por regex ANTES, e só um
  // carimbo ISO de verdade entra neste caminho.
  const pareceIso = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(txt);
  if (pareceIso) {
    const direto = Date.parse(txt);
    if (!Number.isNaN(direto)) {
      return lista.find((s) => Math.abs(Date.parse(s.start) - direto) < 60000) || null;
    }
    return null;   // parecia ISO mas não é data válida → recusa, nunca adivinha
  }

  // 2) Linguagem natural. Normaliza pra comparar sem acento/caixa.
  const t = semAcento(txt);
  const dia = extrairDia(t, tz, lista);
  const hora = extrairHora(t);

  let cand = lista;
  if (dia) cand = cand.filter((s) => (localParts(s.start, tz) || {}).ymd === dia);
  if (!cand.length) return null;

  if (hora) {
    const exato = cand.find((s) => {
      const p = localParts(s.start, tz);
      return p && p.hour === hora.hour && p.minute === hora.minute;
    });
    if (exato) return exato;

    // APROXIMAR SÓ QUANDO A PESSOA APROXIMOU. Antes, qualquer pedido caía no "mais próximo em
    // 30 min": quem pediu meio-dia era MOVIDO para 12:30 sem ninguém perguntar. O teste de ciclo
    // pegou isso — pedi 12:00 e a resposta veio "Moved to 12:30". Avisar depois não é o mesmo que
    // combinar antes, e num consultório é a diferença entre um horário e um paciente perdido.
    // Só arredondamos quando a própria fala é aproximada ("por volta das 10", "around 10").
    const aproximado = /\b(por volta|umas|la pelas|mais ou menos|around|about|approximately|alrededor|sobre las)\b/.test(t);
    if (!aproximado) return null;   // pediu exato e não tem → oferece as opções reais
    const perto = cand
      .map((s) => ({ s, d: Math.abs((localParts(s.start, tz).hour * 60 + localParts(s.start, tz).minute) - (hora.hour * 60 + hora.minute)) }))
      .sort((a, b) => a.d - b.d)[0];
    return perto && perto.d <= 30 ? perto.s : null;
  }

  // Só disse o dia ("amanhã") → o primeiro horário livre daquele dia. Sem dia nem hora não
  // adivinhamos nada: devolver "o próximo livre" pra um "quero marcar" solto marcaria a pessoa
  // num horário que ela nunca escolheu.
  return dia ? cand[0] : null;
}
