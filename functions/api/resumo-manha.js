// /api/resumo-manha — "☀️ Um resumo para você, toda manhã" (Guileo Desk, 2026-10-05).
// Promessa da apresentação do Natura. Banco: db/desk_v6_resumo.sql (migração desk_v6_2_resumo_manha).
//
// DUAS PORTAS NA MESMA ROTA
//   1. CRON (cron-tick.js, bloco da hora): ?token=DIGEST_TOKEN (safeEq). Lê quem LIGOU o resumo,
//      escolhe quem está na hora (lib/resumoManha.js — hora local do negócio == hora escolhida e o dia
//      ainda não recebeu), reserva o dia (desk_resumo_reservar_svc, índice único → nunca em dobro),
//      monta pelo banco (desk_resumo_dados_svc) e manda pela Resend. Lote fechado (MAX_POR_RODADA).
//   2. DESK (tela Equipe e serviços → "Avisos para você"): POST {email, key, action}
//        get  → desk_avisos_get              (porta _desk_ok)
//        set  → desk_avisos_set {resumo_manha, hora, email_destino, lang}
//        test → desk_resumo_teste_reservar (3 por hora) + manda AGORA para o destino da dona
//
// 🚨 PADRÃO DESLIGADO: ninguém recebe sem ter ligado. Esta rota nunca liga o resumo para ninguém.
// 🚨 "ENVIADO" SÓ COM O ID DA RESEND. Sem id → estado 'falhou' + linha no feed do PRÓPRIO negócio
//    (ingest_client_event, tipo 'failure') e a resposta do cron sai ok:false (o cron-tick avisa o Luis).
// Inerte e honesta: sem RESEND_API_KEY ou SUPABASE_SERVICE_ROLE responde {ok:false, ready:false}.
import { json, safeEq, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { deskMorningSummaryEmail } from "../lib/emailTemplates.js";
import { escolheDevidos, langDoResumo } from "../lib/resumoManha.js";
import { podeNoDesk } from "../lib/deskTrava.js";

const MAX_POR_RODADA = 25;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMEOUT_MS = 8000;

// O banco recusa a chave com 28000 → PostgREST 401/403 (às vezes 400). Igual a desk.js.
const recusada = (r) => r && typeof r === "object" && r.ok === false && [400, 401, 403].includes(r.erro_http) && /unauthorized|28000/.test(String(r.detalhe || ""));
const falhaDeTransporte = (r) => r && typeof r === "object" && !Array.isArray(r) && r.ok === false && ("erro_http" in r || "detalhe" in r);

// ── O ENVIO (um negócio) ─────────────────────────────────────────────────────────────────────
// Nunca lança. Devolve { ok, para, resend_id?, motivo?, marcado?, feed? }.
export async function enviarResumo(env, { email, destino, lang, id, teste = false }) {
  const para = EMAIL.test(String(destino || "")) ? String(destino).toLowerCase() : email;
  const falhou = async (motivo) => {
    const marcado = id ? await svcJson(env, "desk_resumo_marcar_svc", { p_id: id, p_estado: "falhou", p_para: para, p_resend_id: null, p_motivo: motivo }).catch(() => null) : null;
    // O dono do negócio precisa saber que o resumo prometido não chegou — no feed DELE, não só num log.
    const feed = await svcJson(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "failure", p_channel: "email",
      p_summary: `⚠️ Resumo da manhã${teste ? " (teste)" : ""} NÃO saiu para ${para} — ${motivo}`.slice(0, 300),
      p_amount: 0, p_payload: { kind: "desk_resumo_manha", teste, para, motivo: String(motivo).slice(0, 300), envio_id: id || null },
    }).catch((e) => ({ ok: false, detalhe: String(e).slice(0, 80) }));
    const feedOk = typeof feed === "string" && UUID.test(feed);
    return { ok: false, para, motivo, marcado: marcado === true, feed: feedOk ? feed : false };
  };

  const dados = await svcJson(env, "desk_resumo_dados_svc", { p_email: email });
  if (!dados || dados.ok !== true) return falhou(`não consegui ler os dados (${(dados && (dados.reason || dados.erro_http || dados.detalhe)) || "?"})`);
  const L = langDoResumo(lang, dados.lang);
  let msg;
  try { msg = deskMorningSummaryEmail({ dados, lang: L, teste }); } catch (e) { return falhou(`não consegui montar o e-mail (${String(e).slice(0, 80)})`); }

  let resp, corpo;
  try {
    resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo Desk <noreply@guileoai.com>", to: para, subject: msg.subject, html: msg.html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    corpo = (await resp.json().catch(() => ({}))) || {};
  } catch (e) { return falhou(`resend não respondeu (${String(e).slice(0, 80)})`); }
  const resendId = corpo && typeof corpo.id === "string" ? corpo.id : "";
  if (!resp.ok || !resendId) return falhou(`resend ${resp.status}${corpo && corpo.message ? `: ${String(corpo.message).slice(0, 120)}` : resendId ? "" : " sem id"}`);

  const marcado = id ? await svcJson(env, "desk_resumo_marcar_svc", { p_id: id, p_estado: "enviado", p_para: para, p_resend_id: resendId, p_motivo: null }).catch(() => null) : null;
  return { ok: true, para, resend_id: resendId, marcado: marcado === true, lang: L, assunto: msg.subject };
}

// ── A RODADA DO CRON ─────────────────────────────────────────────────────────────────────────
export async function rodada(env, agora = new Date()) {
  if (!env.RESEND_API_KEY) return { ok: false, ready: false, motivo: "RESEND_API_KEY ausente — resumo da manhã inerte" };
  if (!env.SUPABASE_SERVICE_ROLE) return { ok: false, ready: false, motivo: "SUPABASE_SERVICE_ROLE ausente — as funções *_svc são só do service_role" };
  const cands = await svcJson(env, "desk_resumo_candidatos_svc", { p_limit: 300 });
  // "não consegui ler" ≠ "ninguém ligou": falha de leitura sai como erro (o cron-tick avisa).
  if (!Array.isArray(cands)) return { ok: false, erro: `não consegui ler quem ligou o resumo (${(cands && (cands.erro_http || cands.detalhe)) || "?"})` };
  const devidos = escolheDevidos(cands, agora, MAX_POR_RODADA);
  const out = { ok: true, candidatos: cands.length, devidos: devidos.length, enviados: 0, falhas: 0, pulados: 0, detalhe: [] };
  for (const dv of devidos) {
    // Assinatura do Desk cancelada ('nenhum') não recebe. Legado (null) e qualquer plano ativo recebem.
    const plano = await svcJson(env, "desk_plano_svc", { p_email: dv.email }).catch(() => null);
    if (plano === "nenhum" || !podeNoDesk(typeof plano === "string" ? plano : null, "resumo_manha").ok) { out.pulados++; out.detalhe.push({ dia: dv.dia, r: "plano" }); continue; }
    const id = await svcJson(env, "desk_resumo_reservar_svc", { p_email: dv.email, p_dia: dv.dia });
    if (falhaDeTransporte(id)) { out.falhas++; out.detalhe.push({ dia: dv.dia, r: "reserva ilegível" }); continue; }
    if (typeof id !== "string" || !UUID.test(id)) { out.pulados++; out.detalhe.push({ dia: dv.dia, r: "já enviado" }); continue; }
    const r = await enviarResumo(env, { email: dv.email, destino: dv.destino, lang: dv.lang, id });
    if (r.ok) out.enviados++; else out.falhas++;
    // Sem e-mail de ninguém na resposta: o cron-tick é público e guarda só números e motivos.
    out.detalhe.push({ dia: dv.dia, r: r.ok ? "enviado" : `falhou: ${String(r.motivo || "").slice(0, 80)}` });
  }
  if (out.falhas) { out.ok = false; out.erro = `${out.falhas} resumo(s) da manhã não saíram — o motivo está no feed de cada negócio`; }
  return out;
}

// ── A ROTA ───────────────────────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  const url = new URL(request.url);
  let b = {};
  if (request.method === "POST") b = await request.json().catch(() => ({}));
  if (!b || typeof b !== "object") b = {};
  const token = String(url.searchParams.get("token") || b.token || "");

  // 1) CRON
  if (token || !b.action) {
    if (!env.DIGEST_TOKEN) return json({ ok: false, error: "DIGEST_TOKEN not configured" }, 501);
    if (!safeEq(token, env.DIGEST_TOKEN)) return json({ ok: false, error: "unauthorized" }, 401);
    try {
      const r = await rodada(env);
      return json(r, r.ok === false && !("ready" in r) && r.erro && !("enviados" in r) ? 503 : 200);
    } catch (e) { return json({ ok: false, erro: String(e).slice(0, 160) }, 500); }
  }

  // 2) DESK
  if (request.method !== "POST") return json({ ok: false, erro: "método" }, 405);
  if (await rateLimited(request, env, "resumo-manha", 30)) return json({ ok: false, erro: "too many requests" }, 429);
  const email = String(b.email || "").trim().toLowerCase();
  const key = String(b.key || b.dataKey || "").trim();
  if (!EMAIL.test(email) || !key) return json({ ok: false, erro: "unauthorized" }, 401);
  const K = { p_email: email, p_key: key };

  const atual = await svcJson(env, "desk_avisos_get", K);
  if (recusada(atual)) return json({ ok: false, erro: "unauthorized" }, 401);
  if (!atual || atual.ok !== true) return json({ ok: false, erro: "não consegui ler os avisos", detalhe: atual && (atual.detalhe || atual.erro_http) }, 503);
  if (b.action === "get") return json(atual);

  // Trava por plano (lib/deskTrava.js): mesma regra do /api/desk; ação fora do mapa = "basic".
  const plano = await svcJson(env, "desk_plano_svc", { p_email: email }).then((r) => (typeof r === "string" ? r : null)).catch(() => null);
  const trava = podeNoDesk(plano, "resumo_manha");
  if (!trava.ok) return json({ ok: false, erro: "plano", reason: "plan_required", precisa: trava.precisa, plano }, 402);

  if (b.action === "set") {
    const hora = Number(b.hora);
    const destino = String(b.email_destino || "").trim().toLowerCase();
    if (!Number.isInteger(hora) || hora < 0 || hora > 23) return json({ ok: false, reason: "invalid_hour" }, 400);
    if (destino && !EMAIL.test(destino)) return json({ ok: false, reason: "invalid_email" }, 400);
    const r = await svcJson(env, "desk_avisos_set", { ...K, p_resumo: b.resumo_manha === true, p_hora: hora, p_email_destino: destino || null, p_lang: langDoResumo(b.lang) });
    if (!r || r.ok !== true) return json({ ok: false, reason: (r && r.reason) || "save_failed", detalhe: r && r.detalhe }, r && r.reason ? 400 : 503);
    return json(r);
  }

  if (b.action === "test") {
    if (!env.RESEND_API_KEY) return json({ ok: false, ready: false, reason: "email_not_configured" }, 503);
    const res = await svcJson(env, "desk_resumo_teste_reservar", K);
    if (res && res.reason === "rate_limited") return json({ ok: false, reason: "rate_limited" }, 429);
    if (!res || res.ok !== true || !UUID.test(String(res.id || ""))) return json({ ok: false, reason: "reserve_failed", detalhe: res && res.detalhe }, 503);
    const r = await enviarResumo(env, { email, destino: atual.email_destino || email, lang: langDoResumo(b.lang, atual.lang), id: res.id, teste: true });
    return json(r.ok ? { ok: true, para: r.para, id: r.resend_id } : { ok: false, para: r.para, reason: "send_failed", motivo: r.motivo }, r.ok ? 200 : 502);
  }
  return json({ ok: false, erro: "ação desconhecida" }, 400);
}
