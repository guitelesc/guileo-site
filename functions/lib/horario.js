// Horário publicado → horas por semana com o telefone sem ninguém.
// MÓDULO PRÓPRIO porque DOIS lados precisam dele: o diagnóstico (horário do prospect) e a
// comparação com o vizinho (horário de cada concorrente). A 1ª versão deixou a função no
// diagnostico.js e fez o googleBusiness.js importar de lá — enquanto o diagnostico.js já
// importava do googleBusiness.js. Ciclo de import: o ESM aceita e depois entrega `undefined`
// em tempo de execução, do mesmo jeito que o TDZ que já comeu uma seção inteira nesta casa.
// Dependência compartilhada mora no meio, nunca em uma das pontas.

// ── HORÁRIO → HORAS FECHADAS ──────────────────────────────────────────────────────────────────
// A conta que transforma "seg-sex 9-18" na frase que dói: quantas horas por semana o telefone
// toca sem ninguém. 168h na semana menos o que está aberto. Se o site não publica horário,
// devolve null — e o achado não nasce. Um número inventado aqui seria o pior de todos: é ELE que
// o vendedor vai falar em voz alta na call.
export function horasFechadas(horarios) {
  const s = String(horarios || "");
  if (!s.trim()) return null;
  let abertas = 0, dias = 0;
  // aceita "09:00-18:00", "9-18", "9am-6pm" — em qualquer separador de dia
  const faixas = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—até to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi) || [];
  for (const f of faixas) {
    const m = f.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—até to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!m) continue;
    let ini = Number(m[1]) + (Number(m[2] || 0) / 60);
    let fim = Number(m[4]) + (Number(m[5] || 0) / 60);
    if (/pm/i.test(m[3] || "") && ini < 12) ini += 12;
    if (/pm/i.test(m[6] || "") && fim < 12) fim += 12;
    if (fim <= ini) fim += 12;               // "9-6" quer dizer 9h às 18h
    if (fim - ini > 0 && fim - ini <= 24) { abertas += fim - ini; dias++; }
  }
  if (!dias) return null;
  // Dia sem faixa declarada conta como FECHADO — é o que o cliente encontra na prática.
  const fechadas = Math.max(0, Math.round(168 - abertas));
  return { abertas: Math.round(abertas), fechadas, dias, resumo: s.slice(0, 120) };
}
