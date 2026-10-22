// /api/relatorio-mensal — o relatório do mês por e-mail para a dona (2026-10-05). Slide 21 da apresentação do
// Natura: "De onde vem o lucro, todo mês". OPCIONAL e DESLIGADO para todos (Equipe → Avisos para você).
//
// Dois jeitos de chamar, no mesmo molde do /api/resumo-manha:
//   1. CRON (cron-tick, de hora em hora, ?token=DIGEST_TOKEN): quem ligou o relatório e está no DIA 1, na hora
//      escolhida, NO FUSO DO NEGÓCIO (lib/relatorioMensal.js) recebe o mês anterior. Reserva por (negócio, mês)
//      → nunca em dobro. "Enviado" só com id da Resend; falha vai para o feed do negócio e a rodada sai ok:false.
//   2. DESK ({email,key,action}): get · set {relatorio_mensal} · test (manda AGORA o mês anterior, com faixa de teste).
import { json, safeEq, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { deskMonthlyReportEmail } from "../lib/emailTemplates.js";
import { escolheMensais, mesAnterior } from "../lib/relatorioMensal.js";
import { relogioLocal, langDoResumo } from "../lib/resumoManha.js";
import { podeNoDesk } from "../lib/deskTrava.js";

const MAX_POR_RODADA = 25;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recusada = (r) => r && typeof r === "object" && r.ok === false && [400, 401, 403].includes(r.erro_http) && /unauthorized|28000/.test(String(r.detalhe || ""));

export async function enviarMensal(env, { email, destino, lang, mes, id = null, teste = false }) {
  const para = EMAIL.test(String(destino || "")) ? String(destino).toLowerCase() : email;
  const falhou = async (motivo) => {
    if (id) await svcJson(env, "desk_mensal_marcar_svc", { p_id: id, p_estado: "falhou", p_para: para, p_resend_id: null, p_motivo: motivo }).catch(() => null);
    await svcJson(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "failure", p_channel: "email",
      p_summary: `⚠️ Relatório mensal${teste ? " (teste)" : ""} de ${mes} NÃO saiu para ${para} — ${motivo}`.slice(0, 300), p_amount: 0,
      p_payload: { kind: "desk_relatorio_mensal", teste, mes, para, motivo: String(motivo).slice(0, 300) } }).catch(() => null);
    return { ok: false, para, motivo };
  };
  const dados = await svcJson(env, "desk_mensal_dados_mes_svc", { p_email: email, p_mes: mes });
  if (!dados || dados.ok !== true) return falhou(`não consegui ler os números (${(dados && (dados.reason || dados.erro_http || dados.detalhe)) || "?"})`);
  let msg;
  try { msg = deskMonthlyReportEmail({ dados, lang, teste }); } catch (e) { return falhou(`não consegui montar o e-mail (${String(e).slice(0, 80)})`); }
  let resp, corpo;
  try {
    resp = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo Desk <noreply@guileoai.com>", to: para, subject: msg.subject, html: msg.html }), signal: AbortSignal.timeout(8000) });
    corpo = (await resp.json().catch(() => ({}))) || {};
  } catch (e) { return falhou(`resend não respondeu (${String(e).slice(0, 80)})`); }
  const resendId = typeof corpo.id === "string" ? corpo.id : "";
  if (!resp.ok || !resendId) return falhou(`resend ${resp.status}${corpo.message ? `: ${String(corpo.message).slice(0, 120)}` : " sem id"}`);
  if (id) await svcJson(env, "desk_mensal_marcar_svc", { p_id: id, p_estado: "enviado", p_para: para, p_resend_id: resendId, p_motivo: null }).catch(() => null);
  return { ok: true, para, resend_id: resendId, mes };
}

export async function rodadaMensal(env, agora = new Date()) {
  if (!env.RESEND_API_KEY) return { ok: false, ready: false, motivo: "RESEND_API_KEY ausente — relatório mensal inerte" };
  const cands = await svcJson(env, "desk_mensal_candidatos_svc", { p_limit: 300 });
  if (!Array.isArray(cands)) return { ok: false, erro: `não consegui ler quem ligou o relatório (${(cands && (cands.erro_http || cands.detalhe)) || "?"})` };
  const devidos = escolheMensais(cands, agora, MAX_POR_RODADA);
  const out = { ok: true, candidatos: cands.length, devidos: devidos.length, enviados: 0, falhas: 0, pulados: 0 };
  for (const dv of devidos) {
    const plano = await svcJson(env, "desk_plano_svc", { p_email: dv.email }).catch(() => null);
    if (plano === "nenhum") { out.pulados++; continue; }
    const id = await svcJson(env, "desk_mensal_reservar_svc", { p_email: dv.email, p_mes: dv.mes });
    if (typeof id !== "string" || !UUID.test(id)) { out.pulados++; continue; }            // já enviado / reservado
    const r = await enviarMensal(env, { ...dv, id });
    if (r.ok) out.enviados++; else out.falhas++;
  }
  if (out.falhas) { out.ok = false; out.erro = `${out.falhas} relatório(s) mensal(is) não saíram — o motivo está no feed de cada negócio`; }
  return out;
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  const url = new URL(request.url);
  let b = {};
  if (request.method === "POST") b = await request.json().catch(() => ({}));
  if (!b || typeof b !== "object") b = {};
  const token = String(url.searchParams.get("token") || b.token || "");
  if (token || !b.action) {
    if (!env.DIGEST_TOKEN) return json({ ok: false, error: "DIGEST_TOKEN not configured" }, 501);
    if (!safeEq(token, env.DIGEST_TOKEN)) return json({ ok: false, error: "unauthorized" }, 401);
    try { const r = await rodadaMensal(env); return json(r, r.ok === false && r.erro && !("enviados" in r) ? 503 : 200); }
    catch (e) { return json({ ok: false, erro: String(e).slice(0, 160) }, 500); }
  }
  if (request.method !== "POST") return json({ ok: false, erro: "método" }, 405);
  if (await rateLimited(request, env, "relatorio-mensal", 20)) return json({ ok: false, erro: "too many requests" }, 429);
  const email = String(b.email || "").trim().toLowerCase();
  const key = String(b.key || b.dataKey || "").trim();
  if (!EMAIL.test(email) || !key) return json({ ok: false, erro: "unauthorized" }, 401);
  const K = { p_email: email, p_key: key };
  const atual = await svcJson(env, "desk_mensal_get", K);
  if (recusada(atual)) return json({ ok: false, erro: "unauthorized" }, 401);
  if (!atual || atual.ok !== true) return json({ ok: false, erro: "não consegui ler o relatório mensal" }, 503);
  if (b.action === "get") return json(atual);
  const plano = await svcJson(env, "desk_plano_svc", { p_email: email }).then((r) => (typeof r === "string" ? r : null)).catch(() => null);
  const trava = podeNoDesk(plano, "relatorio_mensal");
  if (!trava.ok) return json({ ok: false, reason: "plan_required", precisa: trava.precisa, plano }, 402);
  if (b.action === "set") {
    const r = await svcJson(env, "desk_mensal_set", { ...K, p_on: b.relatorio_mensal === true });
    return json(r && r.ok ? r : { ok: false, reason: "save_failed" }, r && r.ok ? 200 : 503);
  }
  if (b.action === "test") {
    if (!env.RESEND_API_KEY) return json({ ok: false, reason: "email_not_configured" }, 503);
    if (await rateLimited(request, env, "relatorio-mensal-teste", 3, 3600)) return json({ ok: false, reason: "rate_limited" }, 429);
    const avisos = await svcJson(env, "desk_avisos_get", K).catch(() => null);
    const tz = (avisos && avisos.tz) || "America/New_York";
    const hoje = relogioLocal(tz, new Date());
    const mes = mesAnterior(hoje ? hoje.dia : new Date().toISOString().slice(0, 10));
    const r = await enviarMensal(env, { email, destino: (avisos && avisos.email_destino) || email, lang: langDoResumo(b.lang, avisos && avisos.lang), mes, teste: true });
    return json(r.ok ? { ok: true, para: r.para, id: r.resend_id, mes } : { ok: false, reason: "send_failed", motivo: r.motivo }, r.ok ? 200 : 502);
  }
  return json({ ok: false, erro: "ação desconhecida" }, 400);
}
