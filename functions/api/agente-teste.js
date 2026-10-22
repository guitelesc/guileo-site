// POST /api/agente-teste — RODA os testes nativos da ElevenLabs contra um agente REAL.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// Por que existe: a ElevenLabs tem testes de agente (inclusive do tipo `tool`, que prova se a
// agente CHAMOU a ferramenta — o defeito exato da troca de idioma que só aparecia quando o Luis
// ligava). Eles rodam contra o agente de verdade e NÃO gastam Anthropic. Só que o comando de
// EXECUTAR não está exposto na conexão MCP desta sessão — e teste que não roda é documentação.
// A chave já mora aqui no servidor, então a execução mora aqui também.
//
// ?ver=<invocation_id> devolve o resultado de uma execução (o run é assíncrono).
// Gate: INGEST_SECRET — mesmo segredo que já reescreve o cérebro inteiro pelo /api/sync-agent.
import { json, safeEq } from "../lib/guard.js";

const EL = "https://api.elevenlabs.io/v1";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const tok = request.headers.get("x-guileo-secret") || url.searchParams.get("secret") || "";
  if (!env.INGEST_SECRET || !safeEq(tok, env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  if (!env.ELEVENLABS_API_KEY) return json({ ok: false, nao_deu_pra_rodar: true, motivo: "sem ELEVENLABS_API_KEY — isto NÃO é um ok" }, 503);
  const H = { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" };

  // ── VER o resultado de uma execução ────────────────────────────────────────────────────────
  const ver = url.searchParams.get("ver");
  if (ver) {
    const r = await fetch(`${EL}/convai/test-invocations/${encodeURIComponent(ver)}`, { headers: H });
    const t = await r.text();
    if (!r.ok) return json({ ok: false, erro: `HTTP ${r.status}`, detalhe: t.slice(0, 400) }, 503);
    let d; try { d = JSON.parse(t); } catch { return json({ ok: false, erro: "resposta não-JSON", amostra: t.slice(0, 200) }, 503); }
    const runs = Array.isArray(d?.test_runs) ? d.test_runs : [];
    return json({
      ok: true, id: ver,
      // o veredito por teste, sem curadoria: nome, estado e o que o juiz disse
      testes: runs.map((x) => ({
        teste: x?.test_name || x?.test_id,
        estado: x?.status || null,
        // ⚠️ `result` é STRING ("success"/"failure"), não booleano — comparar com `true` fazia
        // 4 testes aprovados aparecerem como 0/4 enquanto o próprio juiz escrevia "correctly
        // identified". Terceira vez no dia em que o defeito estava no MEDIDOR e não no medido.
        // Normalizo aqui, uma vez, para nenhum leitor lá fora ter que adivinhar o formato.
        passou: (() => {
          const r = x?.condition_result?.result;
          if (typeof r === "boolean") return r;
          if (typeof r === "string") return /^(success|passed|pass|true)$/i.test(r);
          return null;
        })(),
        veredito_cru: x?.condition_result?.result ?? null,
        motivo: (x?.condition_result?.rationale?.summary || x?.condition_result?.rationale || "").toString().slice(0, 400),
        resposta: (x?.agent_responses || []).map((a) => (a?.message || "").slice(0, 200)).filter(Boolean).slice(0, 3),
        ferramentas: (x?.agent_responses || []).flatMap((a) => (a?.tool_calls || []).map((c) => c?.tool_name)).filter(Boolean),
      })),
      cru: runs.length ? undefined : d,
    });
  }

  // ── RODAR ──────────────────────────────────────────────────────────────────────────────────
  const b = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const agentId = (b.agent_id || url.searchParams.get("agent_id") || "").trim();
  const ids = Array.isArray(b.tests) ? b.tests : (url.searchParams.get("tests") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!agentId || !ids.length) return json({ error: "agent_id + tests obrigatórios" }, 400);

  const r = await fetch(`${EL}/convai/agents/${encodeURIComponent(agentId)}/run-tests`, {
    method: "POST", headers: H,
    body: JSON.stringify({ tests: ids.map((id) => ({ test_id: id })) }),
  });
  const t = await r.text();
  if (!r.ok) return json({ ok: false, erro: `HTTP ${r.status}`, detalhe: t.slice(0, 500) }, 503);
  let d; try { d = JSON.parse(t); } catch { return json({ ok: false, erro: "resposta não-JSON", amostra: t.slice(0, 200) }, 503); }
  return json({ ok: true, invocation_id: d?.id || d?.test_invocation_id || null, rodando: ids.length, bruto: d });
}
