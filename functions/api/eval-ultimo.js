// Cloudflare Pages Function — POST /api/eval-ultimo
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// A LEITURA da última rodada do eval, sem depender de ninguém achar um token no painel.
//
// POR QUE EXISTE (2026-08-22): a nota do eval já estava gravada em `agent_evals` desde 18/08 —
// voz 8/17 reprovados, segurança 72,4 — com o motivo escrito pelo juiz em cada linha. Só que a
// única forma de LER era o `DIGEST_TOKEN`, que o Cloudflare guarda em mão única (nem o dono lê de
// volta). Resultado: o dado existia, ninguém alcançava, e a correção do agente ficou parada.
// É a mesma doença que o eval-report já tinha curado no e-mail — "gravado" não é "sabido" —
// sobrevivendo na porta de entrada.
//
// PORTÃO: `x-guileo-secret` = INGEST_SECRET, o mesmo segredo servidor-a-servidor que a Gui usa
// para criar orçamento e registrar evento. Não é o portão do dono (DIGEST_TOKEN) de propósito:
// isto aqui só LÊ nota de qualidade de casos SINTÉTICOS — nenhum dado de cliente, nenhuma ação.
// Escrever, rodar o eval e disparar e-mail continuam exigindo o DIGEST_TOKEN.
import { json, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

export async function onRequestPost({ request, env }) {
  const ING = (env.INGEST_SECRET || "").toString();
  const dado = (request.headers.get("x-guileo-secret") || "").toString();
  if (!ING || !safeEq(dado, ING)) return json({ error: "unauthorized" }, 401);

  const b = await request.json().catch(() => ({}));
  const agente = (b.agent || "").toString().trim().toLowerCase();
  const soReprovados = b.reprovados !== false;   // padrão: só o que interessa consertar

  const r = await svcRpc(env, "agent_evals_recent", { p_secret: ING, p_limit: 200 });
  if (!r.ok) return json({ ok: false, erro: `agent_evals_recent HTTP ${r.status}` }, 502);
  const linhas = await r.json().catch(() => null);
  // Lista ausente é ERRO, não "rodada limpa" — `|| []` aqui inventaria calma.
  if (!Array.isArray(linhas)) return json({ ok: false, erro: "não devolveu lista" }, 502);

  // run_id define "uma rodada"; run_at varia entre linhas da mesma run (a corrente leva ~20 min).
  const maisNova = linhas.filter((l) => l && l.run_id)
    .sort((a, c) => Date.parse(c.run_at || 0) - Date.parse(a.run_at || 0))[0];
  if (!maisNova) return json({ ok: false, erro: "nenhuma rodada gravada" }, 200);

  let casos = linhas.filter((l) => l.run_id === maisNova.run_id);
  if (agente) casos = casos.filter((l) => l.agent === agente);
  const reprov = casos.filter((l) => l.passed === false);

  return json({
    ok: true,
    run_id: maisNova.run_id,
    quando: maisNova.run_at,
    total_na_rodada: casos.length,
    reprovados: reprov.length,
    casos: (soReprovados ? reprov : casos).map((l) => ({
      id: l.case_id, agente: l.agent, passou: l.passed,
      score: l.score, seguranca: l.safety, adversarial: l.adversarial === true,
      juiz: (l.judge_notes || "").toString().slice(0, 700),
    })),
  });
}
