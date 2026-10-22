// Cloudflare Pages Function — POST /api/agente-limites?secret=INGEST&agent_id=…
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// PÕE OS LIMITES DE CHAMADA DO AGENTE NOS VALORES QUE JÁ SE PROVARAM ATENDENDO.
//
// POR QUE EXISTE (2026-08-25): o agente do WS Hairstyling nasceu com
// `platform_settings.call_limits.agent_concurrency_limit = -1`. A prova de vida marcou isso como
// "não deu pra provar" — `-1` tanto pode significar "sem limite" quanto um teto literal. A dúvida
// virou fato quando comparei com os DOIS agentes desta conta que atendem ligação de verdade
// (Natura e GUI): os dois usam `10`. Ou seja, `-1` não é o valor provado — é o que a criação
// deixa, e ninguém nunca discou para um agente assim.
//
// Isto não é teoria: nesta plataforma um `daily_limit: -1` já fez a ElevenLabs RECUSAR TODA
// LIGAÇÃO, tratando o sentinela como teto literal. O defeito não aparece em nenhuma tela — o
// agente existe, o número toca, e a chamada morre. Descobre-se com o dono do negócio na linha.
//
// Só escreve `call_limits`. Não toca no cérebro, na voz, nos idiomas nem nas ferramentas — mexer
// em mais do que o necessário num agente que já está de pé é como esses incidentes começam.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, safeEq } from "../lib/guard.js";

const EL = "https://api.elevenlabs.io/v1";
// Os valores PROVADOS nesta conta — lidos de agentes que atendem ligação real, não escolhidos.
const PROVADO = { daily_limit: 5000, agent_concurrency_limit: 10 };

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ING = (env.INGEST_SECRET || "").toString();
  const dado = (url.searchParams.get("secret") || request.headers.get("x-guileo-secret") || "").toString();
  if (!ING || !safeEq(dado, ING)) return json({ error: "unauthorized" }, 401);
  if (!env.ELEVENLABS_API_KEY) return json({ ok: false, erro: "sem ELEVENLABS_API_KEY" }, 503);

  const agentId = (url.searchParams.get("agent_id") || "").toString().trim();
  if (!/^agent_[A-Za-z0-9]+$/.test(agentId)) return json({ error: "agent_id inválido" }, 400);

  const h = { "xi-api-key": env.ELEVENLABS_API_KEY };

  // 1) LÊ ANTES. Sem o "antes" não dá para provar que mudou nada — e um PATCH que devolve 200
  //    sobre um campo que não existia é a forma mais silenciosa de não corrigir coisa nenhuma.
  const antesR = await fetch(`${EL}/convai/agents/${encodeURIComponent(agentId)}`, { headers: h });
  if (!antesR.ok) return json({ ok: false, erro: `leitura falhou: HTTP ${antesR.status}` }, 503);
  const antes = await antesR.json().catch(() => null);
  const clAntes = antes?.platform_settings?.call_limits || {};

  // 2) PATCH cirúrgico: só call_limits, preservando o que já estiver lá.
  const pr = await fetch(`${EL}/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH", headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ platform_settings: { call_limits: { ...clAntes, ...PROVADO } } }),
  });
  if (!pr.ok) {
    const corpo = await pr.text().catch(() => "");
    return json({ ok: false, erro: `PATCH falhou: HTTP ${pr.status}`, corpo: corpo.slice(0, 300) }, 503);
  }

  // 3) LÊ DEPOIS. "PATCH deu 200" não é prova; o valor de volta é.
  const dpsR = await fetch(`${EL}/convai/agents/${encodeURIComponent(agentId)}`, { headers: h });
  const dps = dpsR.ok ? await dpsR.json().catch(() => null) : null;
  const clDps = dps?.platform_settings?.call_limits || null;
  const aplicou = !!clDps
    && Number(clDps.agent_concurrency_limit) === PROVADO.agent_concurrency_limit
    && Number(clDps.daily_limit) === PROVADO.daily_limit;

  return json({ ok: aplicou, agent_id: agentId, antes: clAntes, depois: clDps,
    motivo: aplicou ? null : "o PATCH voltou 200 mas a releitura não bate — NÃO considere corrigido" });
}
