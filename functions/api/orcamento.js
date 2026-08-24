// GET/POST /api/orcamento — o teto de gasto do agente e a fila de trabalho dele.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUE EXISTE: `askClaude` devolvia "" em QUALQUER falha, inclusive crédito esgotado. String
// vazia lê como "o modelo não teve nada a dizer", não como "acabou o dinheiro" — e a plataforma
// morria calada até o Luis notar o produto parando. Ideia emprestada do trycompai/crm: o agente
// tem fila e orçamento PRÓPRIOS, decide o que olhar e **para quando o orçamento acaba**.
//
// ORÇAMENTO EM TOKENS, não em dólar: preço por modelo eu não sei sem chutar (lei nº 5), e `usage`
// é o que a Anthropic realmente devolve. Teto medido vale mais que teto estimado.
//
// GATE: portão duplo — DIGEST_TOKEN (o cron) OU a senha do /admin, lendo o CORPO de `_admin_ok`
// e nunca o status HTTP.

import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

async function porta(request, env) {
  const url = new URL(request.url);
  const tok = url.searchParams.get("secret") || request.headers.get("x-guileo-secret") || "";
  let ok = !!env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN);
  if (!ok && tok) {
    const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
    ok = a === true || a?.ok === true;   // o CORPO, não o status
  }
  return ok;
}

async function tratar(request, env) {
  if (!(await porta(request, env))) return json({ error: "unauthorized", dica: "use o token do cron OU a senha do /admin" }, 401);
  if (!env.INGEST_SECRET) return json({ ok: false, nao_deu_pra_ler: true, motivo: "sem INGEST_SECRET — isto NÃO é 'sem orçamento'" }, 503);
  const S = env.INGEST_SECRET;
  const b = request.method === "POST" ? await request.json().catch(() => ({})) : {};

  // DEFINIR o teto do dia para um propósito.
  if (b.proposito && b.teto != null) {
    const d = await svcJson(env, "orcamento_define", { p_secret: S, p_proposito: String(b.proposito), p_teto: parseInt(b.teto, 10) || 0 }).catch(() => null);
    return json({ ...(d && typeof d === "object" ? d : { ok: false, motivo: "resposta_ilegivel" }) });
  }

  // ENFILEIRAR trabalho.
  if (b.enfileira) {
    const e = b.enfileira;
    const d = await svcJson(env, "fila_enfileira", {
      p_secret: S, p_proposito: String(e.proposito || ""), p_alvo: String(e.alvo || ""),
      p_prioridade: parseInt(e.prioridade, 10) || 5,
    }).catch(() => null);
    return json({ ...(d && typeof d === "object" ? d : { ok: false, motivo: "resposta_ilegivel" }) });
  }

  // LER o estado. `null` quando não deu para perguntar — nunca [] , que leria como "nada aqui".
  const [orc, fila] = await Promise.all([
    svcJson(env, "orcamento_estado", { p_secret: S }).catch(() => null),
    svcJson(env, "fila_estado", { p_secret: S }).catch(() => null),
  ]);
  const hoje = Array.isArray(orc) ? orc.filter((x) => x.dia === new Date().toISOString().slice(0, 10)) : null;
  return json({
    ok: true,
    orcamento: Array.isArray(orc) ? orc : null,
    fila: Array.isArray(fila) ? fila : null,
    // O veredito de uma linha: alguém foi barrado hoje? É a pergunta que o dono faz.
    barrado_hoje: hoje ? hoje.filter((x) => (x.bloqueios || 0) > 0).map((x) => ({ proposito: x.proposito, bloqueios: x.bloqueios, restante: x.restante })) : null,
    sem_teto: hoje ? null : "não consegui ler o orçamento — isto NÃO é 'sem teto'",
  });
}

export const onRequestGet = (c) => tratar(c.request, c.env);
export const onRequestPost = (c) => tratar(c.request, c.env);
