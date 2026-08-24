// SEMEADOR E DRENADOR DA FILA DO AGENTE (2026-08-22)
// ─────────────────────────────────────────────────────────────────────────────────────────────
// A peça que faltava para o ciclo fechar: até aqui a fila era atômica e provada, mas quem
// decidia "o que olhar em seguida" era eu ou um cron fixo. Aqui o próprio agente olha SINAIS
// REAIS do banco, enfileira o trabalho por prioridade, e mastiga enquanto houver orçamento.
//
// POR QUE ISTO NÃO É "MAIS UM CRON": um cron fixo faz a MESMA coisa toda hora, ache ou não
// trabalho. A fila faz o que existe, na ordem certa, sem repetir (índice único parcial), e PARA
// sozinha quando o orçamento acaba — devolvendo o item para amanhã em vez de queimar tentativa.
//
// SINAL Nº 1: prospect sem telefone nem e-mail. São 200+ parados hoje. Lead sem contato é lead
// que não vira ligação — a ponta mais barata do funil e a que estava mais parada.

import { svcJson } from "./sb.js";

// ── SEMEIA ────────────────────────────────────────────────────────────────────────────────────
// Enfileira até `teto` prospects sem contato. A duplicata é recusada no banco, então rodar duas
// vezes não cria trabalho dobrado — o semeador pode ser burro, a fila é que é esperta.
export async function semeiaFila(env, { teto = 25 } = {}) {
  const S = env.INGEST_SECRET || "";
  if (!S) return { ok: false, motivo: "sem INGEST_SECRET" };
  const lista = await svcJson(env, "prospects_sem_contato", { p_secret: S, p_limit: teto }).catch(() => null);
  // Lista ausente NÃO é "ninguém sem contato" (lei nº 2). Sem esta distinção, uma falha de
  // leitura viraria "não há trabalho" e a fila morreria em silêncio — o mesmo defeito que este
  // projeto inteiro existe para não repetir.
  if (!Array.isArray(lista)) return { ok: false, motivo: "não consegui ler os prospects — isto NÃO é 'nenhum'" };

  let novos = 0, duplicados = 0;
  for (const p of lista) {
    const id = p?.id; if (!id) continue;
    const r = await svcJson(env, "fila_enfileira", {
      p_secret: S, p_proposito: "pesquisa", p_alvo: String(id),
      // Quem tem SITE vem antes: o domínio é fato, resolve por busca direta e tem a maior taxa
      // de acerto. Nome de negócio costuma ser título de SEO e cai na trava do xará.
      p_prioridade: p?.site ? 2 : 5,
    }).catch(() => null);
    if (r?.ok && r.id) novos++; else if (r?.duplicado) duplicados++;
  }
  return { ok: true, vistos: lista.length, novos, duplicados };
}

// ── DRENA ─────────────────────────────────────────────────────────────────────────────────────
// Pega itens da fila e roda a busca de contato — a MESMA rota `/api/prospeccao acao:"contato"`
// que o hub do vendedor usa. Reaproveitar a rota em vez de copiar a lógica: se a trava do xará
// melhorar lá, melhora aqui no mesmo commit.
export async function drenaFila(env, { base = "https://guileoai.com", n = 5 } = {}) {
  const S = env.INGEST_SECRET || "";
  if (!S) return { ok: false, motivo: "sem INGEST_SECRET" };

  const itens = await svcJson(env, "fila_pega", { p_secret: S, p_proposito: "pesquisa", p_n: n }).catch(() => null);
  if (!Array.isArray(itens)) return { ok: false, motivo: "não consegui pegar da fila" };
  if (!itens.length) return { ok: true, pegos: 0, resolvidos: 0 };

  // O prospect precisa de nome/site para ser procurado — vem do mesmo lugar que a tela lê.
  const fichas = await svcJson(env, "prospects_sem_contato", { p_secret: S, p_limit: 200 }).catch(() => null);
  const porId = new Map(Array.isArray(fichas) ? fichas.map((f) => [String(f.id), f]) : []);

  let resolvidos = 0, semDados = 0, semResultado = 0;
  for (const it of itens) {
    const f = porId.get(String(it.alvo));
    if (!f) { await svcJson(env, "fila_conclui", { p_secret: S, p_id: it.id, p_estado: "feito", p_resultado: "já tinha contato" }).catch(() => {}); continue; }
    try {
      const r = await fetch(`${base}/api/prospeccao`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: S, acao: "contato", nome: f.nome || f.name || "", site: f.site || "", local: f.local || f.cidade || "New York, NY" }),
      });
      const d = await r.json().catch(() => null);
      if (d?.ok && (d.telefone || d.email)) {
        // GRAVA O QUE ACHOU. Achar e não guardar seria pagar a chamada do Google duas vezes.
        const g = await svcJson(env, "prospect_contato_set", {
          p_secret: S, p_id: it.alvo, p_phone: d.telefone || "", p_email: d.email || "",
        }).catch(() => null);
        await svcJson(env, "fila_conclui", { p_secret: S, p_id: it.id, p_estado: g ? "feito" : "falhou", p_resultado: `${d.via || "google"}: ${d.telefone || ""} ${d.email || ""}`.slice(0, 200) }).catch(() => {});
        if (g) resolvidos++;
      } else {
        // "Não achei" É UM RESULTADO, não um erro: marca feito com o motivo, senão o item volta
        // para sempre e a fila fica moendo o mesmo negócio que o Google não conhece.
        const motivo = d?.erro === "nome_nao_casa" ? "xará: o Google respondeu outro negócio" : (d?.motivo || d?.erro || "sem resultado");
        await svcJson(env, "fila_conclui", { p_secret: S, p_id: it.id, p_estado: "feito", p_resultado: String(motivo).slice(0, 200) }).catch(() => {});
        if (d?.erro === "sem_nome" || d?.erro === "sem_chave") semDados++; else semResultado++;
      }
    } catch (e) {
      // Erro de rede volta como `falhou`: gasta tentativa (3 e para), mas não é marcado resolvido.
      await svcJson(env, "fila_conclui", { p_secret: S, p_id: it.id, p_estado: "falhou", p_resultado: String(e).slice(0, 160) }).catch(() => {});
    }
  }
  return { ok: true, pegos: itens.length, resolvidos, sem_resultado: semResultado, sem_dados: semDados };
}
