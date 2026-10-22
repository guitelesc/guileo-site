// O "EU" DA EQUIPE NO DESK (2026-10-05): PONTO (entrada/saída) e "MEU MÊS" da profissional.
// Rota: functions/api/desk-eu.js · banco: db/desk_v7_ponto.sql (migrações desk_v7_8_*).
//
// NEGAR POR PADRÃO, com a lista PRÓPRIA deste arquivo (a de lib/deskAcesso.js é do /api/desk e não muda):
//   · o código "bal_…" é conferido no banco (desk_acesso_entrar_svc); o que segue usa SÓ o id do acesso e o
//     pro_id que o BANCO devolveu — nunca algo do navegador, nunca a chave da dona;
//   · a chave da dona só serve para o relatório e o acerto (funções com porta _desk_ok).
// Hora NUNCA inventada: turno aberto há 16 h ou mais = "esqueceu de bater a saída" e fica sem saída até a
// dona acertar (com motivo). O mesmo número mora no SQL (desk_ponto_bater_svc) — mudar os dois juntos.
import { hashCodigo } from "./deskAcesso.js";
import { podeNoDesk } from "./deskTrava.js";

export const HORAS_ESQUECIDO = 16;
const MS_ESQUECIDO = HORAS_ESQUECIDO * 3600000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

// Quem pode o quê. papeis = códigos da equipe; dono = a chave da dona.
export const ACOES_EU = {
  ponto_status: { papeis: ["recepcao", "profissional"], dono: false },
  ponto_bater: { papeis: ["recepcao", "profissional"], dono: false },
  meu_mes: { papeis: ["profissional"], dono: false },
  ponto_relatorio: { papeis: [], dono: true },
  ponto_corrigir: { papeis: [], dono: true },
};
export const acaoExiste = (acao) => Object.prototype.hasOwnProperty.call(ACOES_EU, acao);
/** quem = "dono" | "recepcao" | "profissional". Ação ou papel desconhecido = não. */
export function podeEu(quem, acao) {
  const a = acaoExiste(acao) ? ACOES_EU[acao] : null;
  if (!a) return false;
  return quem === "dono" ? a.dono : a.papeis.includes(quem);
}

// Confere o código da equipe — mesma semântica do abrirComCodigo (banco fora → 503; código errado/revogado → 401;
// ação fora da lista → 403), mas com a lista DESTE arquivo e SEM devolver a chave da dona.
export async function abrirEu(env, svc, { email, codigo, acao }) {
  const r = await svc(env, "desk_acesso_entrar_svc", { p_email: email, p_hash: await hashCodigo(codigo) }).catch((e) => ({ ok: false, erro_http: 0, detalhe: String(e) }));
  if (r && r.ok === false && !r.reason) return { ok: false, http: 503, corpo: { ok: false, erro: "Desk indisponível" } };
  if (!r || r.ok !== true || !r.id) return { ok: false, http: 401, corpo: { ok: false, erro: "unauthorized" } };
  if (r.papel === "profissional" && !r.pro_id) return { ok: false, http: 401, corpo: { ok: false, erro: "unauthorized" } };
  if (!podeEu(r.papel, acao)) return { ok: false, http: 403, corpo: { ok: false, reason: "role_forbidden", papel: r.papel } };
  return { ok: true, acesso: { id: r.id, nome: r.nome, papel: r.papel, pro_id: r.pro_id || null } };
}

// ── TURNOS ─────────────────────────────────────────────────────────────────────────────────────
/** 'fechado' | 'aberto' | 'esquecido'. Aberto há 16 h ou mais (ou já marcado pelo banco) = esquecido. */
export function situacaoDoTurno(t, agoraMs) {
  if (t && t.saida) return "fechado";
  if (!t || t.esquecido_em) return "esquecido";
  return agoraMs - Date.parse(t.entrada) >= MS_ESQUECIDO ? "esquecido" : "aberto";
}
/** Minutos trabalhados: tempo REAL entre entrada e saída (o horário de verão não come nem dá hora).
 *  Aberto → minutos até agora (em andamento); esquecido → null (não sabemos, e não inventamos). */
export function minutosDoTurno(t, agoraMs) {
  const s = situacaoDoTurno(t, agoraMs);
  if (s === "esquecido") return null;
  const fim = s === "fechado" ? Date.parse(t.saida) : agoraMs;
  return Math.max(0, Math.round((fim - Date.parse(t.entrada)) / 60000));
}

// ── FUSO DO NEGÓCIO ────────────────────────────────────────────────────────────────────────────
function partes(ms, tz) {
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${String(+p.hour % 24).padStart(2, "0")}:${p.minute}` };
}
/** Instante → "YYYY-MM-DD" na parede do negócio (o turno conta no dia em que COMEÇOU). */
export const diaLocal = (iso, tz) => partes(Date.parse(iso), tz).dia;
/** Instante → "YYYY-MM-DD HH:MM" na parede do negócio. */
export const horaLocal = (iso, tz) => { const p = partes(Date.parse(iso), tz); return `${p.dia} ${p.hora}`; };
/** Segunda-feira da semana de um dia "YYYY-MM-DD" (aritmética de calendário, sem fuso). */
export function semanaDe(dia) {
  const [y, m, d] = dia.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}
export const ehDia = (s) => DIA.test(String(s || "")) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// ── O QUE A EQUIPE VÊ NO /balcao ───────────────────────────────────────────────────────────────
/** turnos (do banco, dela) → { dentro, aberto, esquecidos, hoje_min, semana_min }. */
export function statusDoBalcao(turnos, tz, agoraMs) {
  const lista = Array.isArray(turnos) ? turnos : [];
  const aberto = lista.find((t) => situacaoDoTurno(t, agoraMs) === "aberto") || null;
  const esquecidos = lista.filter((t) => situacaoDoTurno(t, agoraMs) === "esquecido").map((t) => ({ id: t.id, entrada: t.entrada }));
  const hoje = partes(agoraMs, tz).dia, semana = semanaDe(hoje);
  let hoje_min = 0, semana_min = 0;
  for (const t of lista) {
    const m = minutosDoTurno(t, agoraMs);
    if (m == null) continue;
    const d = diaLocal(t.entrada, tz);
    if (d === hoje) hoje_min += m;
    if (semanaDe(d) === semana) semana_min += m;
  }
  return { dentro: !!aberto, aberto: aberto ? { id: aberto.id, entrada: aberto.entrada } : null, esquecidos, hoje_min, semana_min };
}

// ── RELATÓRIO DA DONA ──────────────────────────────────────────────────────────────────────────
/** turnos do período → horas por pessoa, por dia e por semana (na parede do negócio) + esquecidos/abertos.
 *  `de`/`ate` (dias, inclusive) separam o que é do período dos pendentes de antes (que só aparecem na lista). */
export function resumoDoPonto(turnos, tz, agoraMs, { de = null, ate = null } = {}) {
  const pessoas = new Map();
  const linhas = [];
  for (const t of Array.isArray(turnos) ? turnos : []) {
    const situacao = situacaoDoTurno(t, agoraMs);
    const minutos = minutosDoTurno(t, agoraMs);
    const dia = diaLocal(t.entrada, tz);
    const noPeriodo = (!de || dia >= de) && (!ate || dia <= ate);
    linhas.push({ ...t, situacao, minutos: situacao === "fechado" ? minutos : null, em_andamento_min: situacao === "aberto" ? minutos : null, dia, no_periodo: noPeriodo });
    const chave = t.acesso_id;
    if (!pessoas.has(chave)) pessoas.set(chave, { acesso_id: chave, nome: t.nome, papel: t.papel || null, revogado: !!t.revogado, total_min: 0, dias: {}, semanas: {}, turnos: 0, abertos: 0, esquecidos: 0 });
    const p = pessoas.get(chave);
    if (situacao === "esquecido") p.esquecidos += 1;
    if (situacao === "aberto") p.abertos += 1;
    if (!noPeriodo || situacao !== "fechado") continue;      // horas = só turno fechado do período (aberto ainda corre)
    p.turnos += 1; p.total_min += minutos;
    p.dias[dia] = (p.dias[dia] || 0) + minutos;
    const s = semanaDe(dia); p.semanas[s] = (p.semanas[s] || 0) + minutos;
  }
  return {
    pessoas: [...pessoas.values()].sort((a, b) => b.total_min - a.total_min || String(a.nome).localeCompare(String(b.nome))),
    turnos: linhas.sort((a, b) => Date.parse(a.entrada) - Date.parse(b.entrada)),
    esquecidos: linhas.filter((l) => l.situacao === "esquecido").length,
    abertos: linhas.filter((l) => l.situacao === "aberto").length,
  };
}

// Planilha: nada de fórmula injetada (=, +, -, @ no começo viram texto).
const celula = (v) => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** CSV do relatório: uma linha por turno, horários no fuso do negócio. Esquecido sai com "esqueceu a saída", sem horas. */
export function csvDoPonto(resumo, tz) {
  const cab = ["nome", "papel", "dia", "entrada", "saida", "minutos", "horas", "situacao", "acertado", "motivo"];
  const SIT = { fechado: "fechado", aberto: "em andamento", esquecido: "esqueceu a saída" };
  const linhas = (resumo?.turnos || []).map((t) => [
    t.nome, t.papel || "", t.dia, horaLocal(t.entrada, tz), t.saida ? horaLocal(t.saida, tz) : "",
    t.minutos ?? "", t.minutos == null ? "" : (t.minutos / 60).toFixed(2), SIT[t.situacao] || t.situacao, t.ajustes > 0 ? "sim" : "", t.motivo || "",
  ].map(celula).join(","));
  return [cab.join(","), ...linhas].join("\n");
}

/** Acerto da dona, antes de ir ao banco (o banco confere de novo). saida null = não muda a saída. */
export function validarCorrecao({ id, entrada, saida, motivo }, agoraMs) {
  if (!UUID.test(String(id || ""))) return { ok: false, reason: "bad_request" };
  const m = String(motivo || "").trim();
  if (m.length < 3) return { ok: false, reason: "reason_required" };
  const e = entrada == null || entrada === "" ? null : Date.parse(entrada);
  const s = saida == null || saida === "" ? null : Date.parse(saida);
  if ((entrada && Number.isNaN(e)) || (saida && Number.isNaN(s))) return { ok: false, reason: "bad_request" };
  if (e == null && s == null) return { ok: false, reason: "bad_request" };
  if ((e != null && e > agoraMs + 300000) || (s != null && s > agoraMs + 300000)) return { ok: false, reason: "future" };
  if (e != null && s != null) {
    if (s <= e) return { ok: false, reason: "invalid_hours" };
    if (s - e > 24 * 3600000) return { ok: false, reason: "too_long" };
  }
  return { ok: true, entrada: e == null ? null : new Date(e).toISOString(), saida: s == null ? null : new Date(s).toISOString(), motivo: m.slice(0, 300) };
}

// ── A ROTA INTEIRA (functions/api/desk-eu.js só embrulha) ─────────────────────────────────────────
// Devolve { http, corpo }. `svc` = svcJson (injetável no teste). Nunca lança.
const r503 = { http: 503, corpo: { ok: false, erro: "Desk indisponível" } };
const doBanco = (r) => (r && typeof r === "object" && (r.ok === true || r.reason) ? r : null);   // null = transporte/erro

export async function responderEu(env, b, svc, agoraMs = Date.now()) {
  const email = String(b?.email || "").trim().toLowerCase();
  const key = String(b?.key || b?.dataKey || "").trim();
  const action = String(b?.action || "");
  if (!email.includes("@") || !key) return { http: 401, corpo: { ok: false, erro: "unauthorized" } };
  if (!acaoExiste(action)) return { http: 400, corpo: { ok: false, erro: "ação desconhecida" } };
  const ehCodigo = /^bal_[a-z2-7]{26}$/.test(key);

  // ── EQUIPE (código "bal_…") ────────────────────────────────────────────────────────────────
  if (ehCodigo) {
    const p = await abrirEu(env, svc, { email, codigo: key, acao: action });
    if (!p.ok) return { http: p.http, corpo: p.corpo };
    const acesso = p.acesso;
    const trava = await travaDoPlano(env, svc, email, action);
    if (trava) return trava;
    if (action === "ponto_status") {
      const r = doBanco(await svc(env, "desk_ponto_status_svc", { p_email: email, p_acesso_id: acesso.id }));
      if (!r) return r503;
      if (r.ok !== true) return { http: 401, corpo: { ok: false, erro: "unauthorized" } };
      const agora = Date.parse(r.agora) || agoraMs;
      return { http: 200, corpo: { ok: true, nome: acesso.nome, papel: acesso.papel, tz: r.tz, agora: r.agora, ...statusDoBalcao(r.turnos, r.tz, agora) } };
    }
    if (action === "ponto_bater") {
      const esperado = b.esperado === "saida" ? "saida" : b.esperado === "entrada" ? "entrada" : null;
      if (!esperado) return { http: 400, corpo: { ok: false, reason: "bad_request" } };
      const r = doBanco(await svc(env, "desk_ponto_bater_svc", { p_email: email, p_acesso_id: acesso.id, p_esperado: esperado }));
      if (!r) return r503;
      if (r.reason === "unauthorized") return { http: 401, corpo: { ok: false, erro: "unauthorized" } };
      return { http: r.ok ? 200 : 409, corpo: r };
    }
    if (action === "meu_mes") {
      const r = doBanco(await svc(env, "desk_meu_mes_svc", { p_email: email, p_pro_id: acesso.pro_id }));
      if (!r) return r503;
      if (r.ok !== true) return { http: 401, corpo: { ok: false, erro: "unauthorized" } };
      return { http: 200, corpo: { ...r, estimativa: true } };
    }
    return { http: 403, corpo: { ok: false, reason: "role_forbidden", papel: acesso.papel } };
  }

  // ── DONA (chave de conexão) ────────────────────────────────────────────────────────────────
  if (!podeEu("dono", action)) return { http: 403, corpo: { ok: false, reason: "role_forbidden", papel: "dono" } };
  const K = { p_email: email, p_key: key };
  const porta = await svc(env, "desk_eu_dono_ok", K);
  if (!porta || porta.ok !== true) return recusada(porta) ? { http: 401, corpo: { ok: false, erro: "unauthorized" } } : r503;
  const trava = await travaDoPlano(env, svc, email, action);
  if (trava) return trava;
  if (action === "ponto_relatorio") {
    if (!ehDia(b.de) || !ehDia(b.ate) || b.ate < b.de) return { http: 400, corpo: { ok: false, reason: "invalid_range" } };
    const r = await svc(env, "desk_ponto_relatorio", { ...K, p_de: b.de, p_ate: b.ate });
    if (!doBanco(r)) return recusada(r) ? { http: 401, corpo: { ok: false, erro: "unauthorized" } } : r503;
    if (r.ok !== true) return { http: 200, corpo: r };
    const agora = Date.parse(r.agora) || agoraMs;
    const resumo = resumoDoPonto(r.turnos, r.tz, agora, { de: r.de, ate: r.ate });
    return { http: 200, corpo: { ok: true, tz: r.tz, de: r.de, ate: r.ate, from: r.from, to: r.to, agora: r.agora, horas_esquecido: HORAS_ESQUECIDO, ...resumo, csv: csvDoPonto(resumo, r.tz) } };
  }
  // ponto_corrigir
  const v = validarCorrecao(b, agoraMs);
  if (!v.ok) return { http: 400, corpo: v };
  const r = await svc(env, "desk_ponto_corrigir", { ...K, p_id: b.id, p_entrada: v.entrada, p_saida: v.saida, p_motivo: v.motivo });
  if (!doBanco(r)) return recusada(r) ? { http: 401, corpo: { ok: false, erro: "unauthorized" } } : r503;
  return { http: 200, corpo: r };
}

// O banco recusa a chave com 28000 → PostgREST 401/403 (às vezes 400) com "unauthorized" no texto.
const recusada = (r) => !!r && [400, 401, 403].includes(r.erro_http) && /unauthorized|28000/.test(String(r.detalhe || ""));

// Plano do Desk (lib/deskTrava.js): null = legado, passa. Ação nova fora do mapa = "basic".
async function travaDoPlano(env, svc, email, action) {
  const plano = await Promise.resolve(svc(env, "desk_plano_svc", { p_email: email })).then((r) => (typeof r === "string" ? r : null)).catch(() => null);
  const t = podeNoDesk(plano, action);
  return t.ok ? null : { http: 402, corpo: { ok: false, erro: "plano", reason: "plan_required", precisa: t.precisa, plano } };
}
