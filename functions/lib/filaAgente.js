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

  // 🚨 UMA CHAMADA, NÃO 25. O Cloudflare limita subrequisições por invocação de Worker: um
  // enfileiramento por item estourava o teto e matava, em silêncio, as chamadas do FIM do cron —
  // justamente os `fila_conclui`, deixando item preso em `em_voo` com relatório dizendo "rodou".
  // Um item = uma viagem é o desenho errado quando a plataforma cobra por viagem.
  const itens = lista.filter((p) => p?.id).map((p) => ({
    alvo: String(p.id),
    // Quem tem SITE vem antes: o domínio é fato, resolve por busca direta e tem a maior taxa de
    // acerto — nome de negócio costuma ser título de SEO e cai na trava do xará. E quem não tem
    // NADA vem na frente de quem só falta e-mail: prospect sem telefone não vira ligação.
    prioridade: (!p.tem_fone && !p.tem_email) ? (p.site ? 1 : 3) : (p.site ? 2 : 5),
  }));
  const r = await svcJson(env, "fila_enfileira_lote", {
    p_secret: S, p_proposito: "pesquisa", p_itens: itens, p_prioridade_padrao: 5,
  }).catch((e) => ({ ok: false, detalhe: String(e).slice(0, 120) }));
  if (r?.ok !== true) return { ok: false, motivo: r?.detalhe || r?.motivo || "não consegui enfileirar" };
  return { ok: true, vistos: lista.length, novos: r.novos, duplicados: r.duplicados };
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
        // ⚠️ O campo é `business` — `prospects_sem_contato` não devolve `nome`. Eu li `f.nome` e ele
        // veio `undefined` em TODOS: quem não tinha site caía em `sem_nome` e nunca era procurado.
        // 4 dos 5 itens do segundo ciclo morreram assim, e o contador dizia "sem_dados" — verdade
        // sobre o sintoma, mentira sobre a causa.
        body: JSON.stringify({ token: S, acao: "contato", nome: f.business || f.nome || "", site: f.site || "", local: f.market || f.local || "New York, NY" }),
      });
      const d = await r.json().catch(() => null);
      if (d?.ok && (d.telefone || d.email)) {
        // GRAVA O QUE ACHOU. Achar e não guardar seria pagar a chamada do Google duas vezes.
        // A RPC NUNCA sobrescreve — só preenche vazio — então mandar tudo é seguro.
        const g = await svcJson(env, "prospect_contato_set", {
          p_secret: S, p_id: it.alvo, p_phone: d.telefone || "", p_email: d.email || "",
        }).catch(() => null);

        // 🚨 RESOLVIDO = O BURACO FECHOU, não "a chamada respondeu". No primeiro ciclo real eu
        // contei 5 resolvidos tendo preenchido ZERO: os prospects já tinham telefone, o que
        // faltava era e-mail, e eu marquei vitória por ter achado o telefone de novo.
        // "ok" sem comprovante é promessa sem lastro — aqui o comprovante é o campo que estava
        // vazio e deixou de estar.
        const faltavaFone = !f.tem_fone, faltavaMail = !f.tem_email;
        const temFoneAgora = !!(g?.phone || "").trim(), temMailAgora = !!(g?.email || "").trim();
        const fechou = (faltavaFone && temFoneAgora) || (faltavaMail && temMailAgora);
        const detalhe = fechou
          ? `${d.via || "google"}: ${[faltavaFone && temFoneAgora ? `fone ${g.phone}` : "", faltavaMail && temMailAgora ? `email ${g.email}` : ""].filter(Boolean).join(" · ")}`
          : `nada novo — faltava ${faltavaMail ? "e-mail" : "telefone"} e ${d.via || "a busca"} só trouxe ${d.telefone && !d.email ? "telefone" : "e-mail"}`;
        await svcJson(env, "fila_conclui", { p_secret: S, p_id: it.id, p_estado: g ? "feito" : "falhou", p_resultado: detalhe.slice(0, 200) }).catch(() => {});
        if (fechou) resolvidos++; else semResultado++;
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

// ── EVAL NA FILA (2026-08-22) ─────────────────────────────────────────────────────────────────
// SUBSTITUI A CORRENTE. O eval encadeava sozinho — cada lote chamava o próximo — e foi
// exatamente isso que em 17/08 zerou o saldo Anthropic e derrubou o chat do site no fallback.
// A corrente tinha três travas boas (teto de saltos, offset crescente, dry não encadeia), mas
// nenhuma delas sabe quanto DINHEIRO sobrou: ela só sabe contar casos.
//
// A fila sabe. Cada caso vira um item; o drenador puxa poucos por tique; e `askClaude` com
// `proposito:"eval"` recusa quando o teto do dia acaba — devolvendo o item para amanhã em vez de
// queimar tentativa. Um lote não pode mais virar avalanche, e uma noite perdida não custa a
// varredura inteira: ela retoma de onde parou, com o mesmo `run_id`.
//
// ⚠️ A RESERVA DO DIA CONTINUA VALENDO. Só a semente chama sem `run_id`/`offset` — que é o que o
// `ops_run_claim` usa para saber que é rodada nova. Os itens da fila são continuação e não
// reservam de novo, senão a varredura travaria no segundo caso.

export async function semeiaEval(env, { base = "https://guileoai.com", risco = true } = {}) {
  const S = env.INGEST_SECRET || "";
  const t = env.DIGEST_TOKEN || "";
  if (!S || !t) return { ok: false, motivo: "sem INGEST_SECRET/DIGEST_TOKEN" };
  try {
    // `limite=1` e SEM `cadeia=1`: roda o 1º caso, reserva o dia, e PARA. O resto vira fila.
    const r = await fetch(`${base}/api/agent-eval?token=${encodeURIComponent(t)}&limite=1${risco ? "&risco=1" : ""}`);
    const d = await r.json().catch(() => null);
    if (!d) return { ok: false, motivo: `resposta ilegível (HTTP ${r.status})` };
    if (d.skipped) return { ok: true, pulou: d.skipped };       // já rodou nesta janela — nada gasto
    if (!d.more) return { ok: true, run_id: d.run_id, nota: "conjunto acabou no 1º caso" };
    const e = await svcJson(env, "fila_enfileira", {
      p_secret: S, p_proposito: "eval", p_alvo: `${d.run_id}|${d.next_offset}`, p_prioridade: 4,
    }).catch(() => null);
    return { ok: true, run_id: d.run_id, proximo: d.next_offset, enfileirado: !!e?.ok };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 140) }; }
}

export async function drenaEval(env, { base = "https://guileoai.com", n = 3 } = {}) {
  const S = env.INGEST_SECRET || "";
  const t = env.DIGEST_TOKEN || "";
  if (!S || !t) return { ok: false, motivo: "sem INGEST_SECRET/DIGEST_TOKEN" };

  // ⚠️ LÊ O NÚMERO, NÃO ADIVINHA A ASSINATURA. A 1ª versão deduzia "bateu o teto" de
  // `scored===0 && total>0` — e marcou `sem_orcamento` com 400.000 tokens intactos. Assinatura
  // inventada é instrumento errado: pergunta ao orçamento quanto sobrou e pronto.
  const orc = await svcJson(env, "orcamento_estado", { p_secret: S }).catch(() => null);
  const hoje = new Date().toISOString().slice(0, 10);
  const linha = Array.isArray(orc) ? orc.find((x) => x.dia === hoje && x.proposito === "eval") : null;
  // Não conseguir LER o orçamento não libera gasto (mesma regra da reserva): sem número, não roda.
  if (!linha) return { ok: false, motivo: "não consegui ler o orçamento do eval — isto NÃO é 'pode gastar'" };
  // Piso: um caso do eval custa alguns milhares de tokens. Entrar com menos que isso é pegar o
  // item da fila só para devolvê-lo — trabalho girando sem sair do lugar.
  const PISO = 8000;
  if ((linha.restante || 0) < PISO) {
    return { ok: true, pegos: 0, pausado: `restam ${linha.restante} tokens (piso ${PISO}) — a varredura retoma quando o teto renovar` };
  }

  const itens = await svcJson(env, "fila_pega", { p_secret: S, p_proposito: "eval", p_n: n }).catch(() => null);
  if (!Array.isArray(itens)) return { ok: false, motivo: "não consegui pegar da fila" };
  if (!itens.length) return { ok: true, pegos: 0 };

  let rodados = 0, semOrcamento = 0, falhas = 0;
  // Itens cuja CONCLUSÃO não confirmou: viram relatório, não silêncio.
  const presos = [];
  for (const it of itens) {
    const [runId, off] = String(it.alvo).split("|");
    if (!runId || off == null) { await svcJson(env, "fila_conclui", { p_secret: S, p_id: it.id, p_estado: "falhou", p_resultado: "alvo mal formado" }).catch(() => {}); continue; }
    try {
      const r = await fetch(`${base}/api/agent-eval?token=${encodeURIComponent(t)}&run_id=${encodeURIComponent(runId)}&offset=${encodeURIComponent(off)}&limite=1`);
      const d = await r.json().catch(() => null);


      // Enfileira o PRÓXIMO antes de concluir este: se o worker morrer no meio, o trabalho
      // seguinte já existe. Perder o rastro da varredura é pior que repetir um caso.
      if (d?.more && d.next_offset != null) {
        await svcJson(env, "fila_enfileira", { p_secret: S, p_proposito: "eval", p_alvo: `${d.run_id}|${d.next_offset}`, p_prioridade: 4 }).catch(() => {});
      }
      // ⚠️ `d` NULO NÃO É SUCESSO. `d?.ok !== false` é TRUE quando `d` é null — e foi assim que o
      // drenador reportou "rodados: 1" sobre uma resposta que nem deu para ler.
      const deuCerto = !!d && d.ok !== false;
      // ⚠️ CONCLUIR TEM QUE FALAR QUANDO FALHA. Com `.catch(() => {})` mudo, uma conclusão perdida
      // deixava o item preso em `em_voo` até o `fila_destrava` de 30 min — e o drenador jurava
      // que tinha terminado. Falha silenciosa aqui é trabalho parado com cara de trabalho feito.
      const fim = await svcJson(env, "fila_conclui", {
        p_secret: S, p_id: it.id, p_estado: deuCerto ? "feito" : "falhou",
        p_resultado: d ? `caso ${off}: ${d.passed ?? "?"}/${d.scored ?? "?"} ${d.more ? "· segue" : "· conjunto completo"}` : `resposta ilegível (HTTP ${r.status})`,
      }).catch((e) => ({ ok: false, motivo: String(e).slice(0, 120) }));
      // O `svcJson` JÁ devolve `erro_http` e `detalhe`. Reportar só "não confirmou" era esconder o
      // erro dentro do meu próprio relatório de erro — a lei do fallback vale para o diagnóstico
      // também, não só para o produto.
      if (fim?.ok !== true) presos.push({ id: it.id, http: fim?.erro_http ?? null, motivo: fim?.motivo || fim?.detalhe || "sem motivo devolvido" });
      if (deuCerto) rodados++; else falhas++;
    } catch (e) {
      await svcJson(env, "fila_conclui", { p_secret: S, p_id: it.id, p_estado: "falhou", p_resultado: String(e).slice(0, 160) }).catch(() => {});
    }
  }
  return { ok: true, pegos: itens.length, rodados, falhas, sem_orcamento: semOrcamento, ...(presos.length ? { nao_concluidos: presos } : {}) };
}

// ── RELATÓRIOS NO IDIOMA CERTO (2026-08-22) ───────────────────────────────────────────────────
// 299 de 304 Growth Reports saíram em PORTUGUÊS — inclusive os de encanadores de Nova York —
// porque o gerador usava o idioma de quem clicou, não o do prospect. Os links já existiam,
// prontos para enviar. Mandar assim queima o prospect na primeira linha.
//
// Regera EM CIMA DO MESMO ID: link compartilhado não pode virar 404, e a marca (logo/cor) mora
// no registro. Zero Anthropic — é raspagem e Google, então o teto de tokens não se aplica; o que
// se paga aqui é chamada ao Google, por isso o lote é pequeno.

export async function semeiaRelatorios(env, { teto = 40 } = {}) {
  const S = env.INGEST_SECRET || "";
  if (!S) return { ok: false, motivo: "sem INGEST_SECRET" };
  const lista = await svcJson(env, "avaliacoes_para_traduzir", { p_secret: S, p_limit: teto }).catch(() => null);
  if (!Array.isArray(lista)) return { ok: false, motivo: "não consegui ler os relatórios — isto NÃO é 'nenhum'" };
  if (!lista.length) return { ok: true, vistos: 0, novos: 0, nota: "todos já estão em inglês" };
  const r = await svcJson(env, "fila_enfileira_lote", {
    p_secret: S, p_proposito: "relatorio_en",
    p_itens: lista.filter((x) => x?.id && x?.site).map((x) => ({ alvo: `${x.id}|${x.site}`, prioridade: 6 })),
    p_prioridade_padrao: 6,
  }).catch((e) => ({ ok: false, detalhe: String(e).slice(0, 120) }));
  if (r?.ok !== true) return { ok: false, motivo: r?.detalhe || r?.motivo || "não consegui enfileirar" };
  return { ok: true, vistos: lista.length, novos: r.novos, duplicados: r.duplicados };
}

export async function drenaRelatorios(env, { base = "https://guileoai.com", n = 3 } = {}) {
  const S = env.INGEST_SECRET || "";
  if (!S) return { ok: false, motivo: "sem INGEST_SECRET" };
  const itens = await svcJson(env, "fila_pega", { p_secret: S, p_proposito: "relatorio_en", p_n: n }).catch(() => null);
  if (!Array.isArray(itens)) return { ok: false, motivo: "não consegui pegar da fila" };
  if (!itens.length) return { ok: true, pegos: 0 };

  let traduzidos = 0, falhas = 0; const presos = [];
  for (const it of itens) {
    const corte = String(it.alvo).indexOf("|");
    const id = corte > 0 ? String(it.alvo).slice(0, corte) : "";
    const site = corte > 0 ? String(it.alvo).slice(corte + 1) : "";
    if (!id || !site) { await svcJson(env, "fila_conclui", { p_secret: S, p_id: it.id, p_estado: "falhou", p_resultado: "alvo mal formado" }).catch(() => {}); continue; }
    try {
      const r = await fetch(`${base}/api/avaliacao`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: S, regerar_id: id, site, lang: "en" }),
      });
      const d = await r.json().catch(() => null);
      const deuCerto = !!d && d.ok === true && d.regerado === true;
      const fim = await svcJson(env, "fila_conclui", {
        p_secret: S, p_id: it.id, p_estado: deuCerto ? "feito" : "falhou",
        // Site que não abre mais é RESULTADO, não erro de código: o negócio pode ter saído do ar.
        p_resultado: deuCerto ? `EN · ${d.business || site}` : (d?.motivo || d?.erro || `HTTP ${r.status}`),
      }).catch((e) => ({ ok: false, detalhe: String(e).slice(0, 120) }));
      if (fim?.ok !== true) presos.push({ id: it.id, motivo: fim?.detalhe || fim?.motivo || "conclusão não confirmou" });
      if (deuCerto) traduzidos++; else falhas++;
    } catch (e) {
      await svcJson(env, "fila_conclui", { p_secret: S, p_id: it.id, p_estado: "falhou", p_resultado: String(e).slice(0, 160) }).catch(() => {});
      falhas++;
    }
  }
  return { ok: true, pegos: itens.length, traduzidos, falhas, ...(presos.length ? { nao_concluidos: presos } : {}) };
}
