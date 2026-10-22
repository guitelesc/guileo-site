// POST /api/venda-online-reconcile (x-guileo-secret = INGEST_SECRET, ou ?token=DIGEST_TOKEN do cron) —
// confere, na conta PRÓPRIA de cada negócio, os links de PACOTE e VALE-PRESENTE e os Checkouts da LOJA DA
// VITRINE (kind 'loja', db/desk_v7_loja.sql) criados e ainda não entregues (últimos 3 dias,
// venda_online_pending_svc). O tipo sai da etiqueta da SESSÃO (conferirVendaOnline decide o ramo). Pega a cliente que pagou e fechou a aba antes de
// voltar. Mesma regra da volta (/api/venda-paga): só entrega o que o Stripe diz que foi pago, uma vez só.
// Irmão do /api/sinal-reconcile (sinal, cartão salvo, assinatura) — a assinatura vendida pelo Receita
// recorrente com chave própria já é conferida lá (etiqueta desk_membership).
// ESTORNOS (2026-10-05): a mesma rodada pergunta ao Stripe do negócio se alguma venda ENTREGUE nos
// últimos 30 dias foi estornada lá (a conta própria não manda webhook) — lib/vendaOnlineNegocio.js ·
// conferirEstornos, db/desk_v7_6_estorno_proprio.sql. Loja: devolve o estoque; pacote/vale: avisa o dono.
import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { conferirVendaOnline, conferirEstornos } from "../lib/vendaOnlineNegocio.js";

const autorizado = (request, env) => {
  const tk = new URL(request.url).searchParams.get("token") || "";
  if (env.DIGEST_TOKEN && tk && safeEq(tk, env.DIGEST_TOKEN)) return true;
  const h = request.headers.get("x-guileo-secret") || "";
  return !!(env.INGEST_SECRET && h && safeEq(h, env.INGEST_SECRET));
};

/** O laço da conferência, com dependências injetáveis (testado). */
export async function conferirPendentes(env, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const conferir = deps.conferir || conferirVendaOnline;
  const lista = await svc(env, "venda_online_pending_svc", {});
  if (!Array.isArray(lista)) return { ok: false, error: "nao consegui ler os pendentes", detalhe: lista };
  const out = { ok: true, conferidos: 0, entregues: 0, ja_entregues: 0, abertos: 0, falhas: 0 };
  for (const p of lista.slice(0, 200)) {
    out.conferidos++;
    const r = await conferir(env, { tenant: p.tenant, sessionId: p.session }, deps);
    if (r.ok && r.already) out.ja_entregues++;
    else if (r.ok) out.entregues++;
    else if (r.reason === "nao_pago") out.abertos++;
    else out.falhas++;
  }
  return out;
}

export const onRequestGet = (ctx) => onRequestPost(ctx);
export async function onRequestPost({ request, env }) {
  if (!autorizado(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  const r = await conferirPendentes(env);
  // estornos rodam mesmo se a lista de pendentes falhou (são leituras independentes); falha de um
  // aparece na resposta e derruba o 200 — o cron-tick avisa todo alvo não-2xx
  let estornos;
  try { estornos = await conferirEstornos(env); } catch (e) { estornos = { ok: false, error: String(e).slice(0, 160) }; }
  return json({ ...r, estornos }, r.ok && estornos.ok ? 200 : 503);
}
