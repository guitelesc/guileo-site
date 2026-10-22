// functions/lib/resumoManha.js — a parte PURA do "☀️ resumo da manhã" do Guileo Desk (2026-10-05).
// Quem manda é functions/api/resumo-manha.js; aqui fica só a decisão "a quem cabe mandar AGORA",
// sem rede nem banco, para dar para provar com `node --test` (resumoManha.test.mjs).
//
// A REGRA: a dona escolheu uma hora (padrão 7). O cron passa de hora em hora. Cabe mandar quando a
// hora LOCAL do negócio (fuso da 1ª unidade) é a hora escolhida E o dia local ainda não recebeu.
// A trava de verdade contra envio em dobro é a reserva no banco (desk_resumo_reservar_svc, índice
// único por dia); esta função só evita reservar à toa.

const IDIOMAS = ["pt", "en", "es", "hi"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Primeiro idioma válido da lista; senão inglês (o padrão da casa para o dono). */
export function langDoResumo(...opcoes) {
  for (const o of opcoes) { const v = String(o || "").trim().toLowerCase(); if (IDIOMAS.includes(v)) return v; }
  return "en";
}

/** Dia (YYYY-MM-DD) e hora (0–23) na parede do fuso `tz`. Fuso inválido → null (nunca chuta). */
export function relogioLocal(tz, agora = new Date()) {
  try {
    const p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(agora).forEach((x) => { p[x.type] = x.value; });
    if (!p.year || !p.month || !p.day || p.hour == null) return null;
    return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24 };
  } catch { return null; }
}

/**
 * Das linhas de desk_resumo_candidatos_svc, quais cabem AGORA. Limitado a `limite` por rodada
 * (lote fechado: um cron não pode virar uma tempestade de e-mails nem estourar o tempo do Worker).
 * Devolve [{ email, destino, lang, dia, tz, hora }].
 */
export function escolheDevidos(candidatos, agora = new Date(), limite = 25) {
  const out = [];
  const vistos = new Set();
  for (const c of Array.isArray(candidatos) ? candidatos : []) {
    if (out.length >= Math.max(0, limite)) break;
    const email = String((c && c.client_email) || "").trim().toLowerCase();
    if (!EMAIL.test(email) || vistos.has(email)) continue;
    const h = Number.isInteger(Number(c.hora)) && Number(c.hora) >= 0 && Number(c.hora) <= 23 ? Number(c.hora) : 7;
    const tz = String(c.tz || "") || "America/New_York";
    const rel = relogioLocal(tz, agora);
    if (!rel || rel.hora !== h) continue;
    if (String(c.ultimo_dia || "").slice(0, 10) === rel.dia) continue;      // hoje já foi (ou está indo)
    const destino = String(c.email_destino || "").trim().toLowerCase();
    vistos.add(email);
    out.push({ email, destino: EMAIL.test(destino) ? destino : email, lang: langDoResumo(c.lang), dia: rel.dia, tz, hora: h });
  }
  return out;
}
