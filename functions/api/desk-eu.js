// POST /api/desk-eu — o "EU" da equipe no GUILEO DESK (2026-10-05): ponto e "meu mês".
// Toda a regra (quem pode o quê, 16 h = esqueceu a saída, horas por dia/semana no fuso do negócio, CSV)
// está em functions/lib/deskEu.js, testada em deskEu.test.mjs. Banco: db/desk_v7_ponto.sql.
//
// CORPO: { email, key, action, ... }
//   código da equipe ("bal_…"):
//     ponto_status                    → { dentro, aberto{id,entrada}, esquecidos[], hoje_min, semana_min, tz, nome, papel }
//     ponto_bater { esperado: "entrada"|"saida" }  → { ok, acao, turno, esquecido? } · situação mudou → 409 state_changed
//     meu_mes (só profissional)       → números DELA no mês até agora (fuso do negócio), { estimativa: true }
//   chave da dona:
//     ponto_relatorio { de, ate }     → dias "YYYY-MM-DD" (inclusive, até 93) · { pessoas[], turnos[], csv }
//     ponto_corrigir { id, entrada?, saida?, motivo } → acerto com motivo (fica no histórico do turno)
// Recusas: código errado/revogado 401 · ação fora do papel 403 role_forbidden · banco fora 503 · plano 402.
import { json } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { responderEu } from "../lib/deskEu.js";

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, erro: "corpo inválido" }, 400); }
  const { http, corpo } = await responderEu(env, b && typeof b === "object" ? b : {}, svcJson);
  return json(corpo, http);
}
