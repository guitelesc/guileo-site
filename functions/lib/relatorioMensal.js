// RELATÓRIO MENSAL — quem recebe AGORA (2026-10-05). Funções puras, testadas em relatorioMensal.test.mjs.
// Regra: dia 1 do mês NO FUSO DO NEGÓCIO, na hora escolhida (a mesma do resumo da manhã), e o mês anterior
// ainda não foi enviado. Lote fechado por rodada.
import { relogioLocal, langDoResumo } from "./resumoManha.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "2026-10-01" → "2026-09" (o mês que o relatório cobre). */
export function mesAnterior(dia) {
  const [y, m] = String(dia).split("-").map(Number);
  if (!y || !m) return null;
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

export function escolheMensais(candidatos, agora = new Date(), limite = 25) {
  const out = []; const vistos = new Set();
  for (const c of Array.isArray(candidatos) ? candidatos : []) {
    if (out.length >= Math.max(0, limite)) break;
    const email = String((c && c.client_email) || "").trim().toLowerCase();
    if (!EMAIL.test(email) || vistos.has(email)) continue;
    const h = Number.isInteger(Number(c.hora)) && Number(c.hora) >= 0 && Number(c.hora) <= 23 ? Number(c.hora) : 7;
    const rel = relogioLocal(String(c.tz || "") || "America/New_York", agora);
    if (!rel || rel.hora !== h || !rel.dia.endsWith("-01")) continue;
    const mes = mesAnterior(rel.dia);
    if (!mes || String(c.ultimo_mes || "") === mes) continue;
    const destino = String(c.email_destino || "").trim().toLowerCase();
    vistos.add(email);
    out.push({ email, destino: EMAIL.test(destino) ? destino : email, lang: langDoResumo(c.lang), mes });
  }
  return out;
}
