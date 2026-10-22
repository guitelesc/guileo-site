// src/portal/directConselhos.js — O QUE MELHORAR NO GUILEO DIRECT, lido das métricas.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE UM ARQUIVO PURO (2026-10-04): número sozinho não diz o que fazer. "Casou 3 de 400" é um
// dado; "poucos comentários usam suas palavras — troque pelas que as pessoas escrevem" é a ação. As
// regras ficam AQUI, sem React e sem tradução, para o teste provar cada uma (src/… não roda JSX no
// node). A tela (DirectMetricas.jsx) só troca o `id` pela frase traduzida — e por isso toda frase
// mora num tr("…") literal lá, onde o teste de i18n do portal enxerga.
//
// CADA REGRA NASCEU DE UM CASO REAL desta casa, não de um manual de growth:
//   conta_muda       → a Chigo e a MedMundo calaram em 03/09 por um alerta da Business Suite
//                      ("Confirmar acesso às mensagens do Instagram") e ninguém viu por um mês.
//   sem_link         → 3 das 5 campanhas mandam DM sem link: o lead delas nunca é contável.
//   frase_segura     → quando os dois cérebros falham sai "a equipe te confirma" — parece resposta,
//                      é desistência. Em volume, é o KB/agente do cliente quebrado.
//   falha_envio      → o 1º DM real da casa falhou com "(#3) Application does not have the capability".
//   standby          → um reel sumiu porque OUTRO app era dono da conversa.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const DIA = 86400000;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fracao = (a, b) => (b > 0 ? a / b : 0);

// Limiar de "conta muda": 14 dias. Curto demais vira alarme toda semana numa conta pequena (e alarme
// que grita à toa ninguém lê); longo demais repete o mês de silêncio da Chigo.
export const DIAS_CONTA_MUDA = 14;

/**
 * @param {object} m   retorno de direct_metricas (null/vazio → [])
 * @param {number} agoraMs
 * @returns {{id:string, nivel:"red"|"gold"|"green"|"info", vars:object}[]} ordenado do mais grave
 */
export function conselhosDoDirect(m, agoraMs = Date.now()) {
  if (!m || typeof m !== "object" || !m.funil) return [];
  const f = m.funil || {};
  const c = m.conversa || {};
  const via = m.idioma_via || {};
  const quem = c.quem_respondeu || {};
  const out = [];
  const add = (id, nivel, vars = {}) => out.push({ id, nivel, vars });

  // ── VERMELHO: alguém está ficando sem resposta ────────────────────────────────────────────
  if (Array.isArray(m.falhas) && m.falhas.length) {
    const total = m.falhas.reduce((s, x) => s + num(x && x.n), 0);
    add("falha_envio", "red", { n: total, motivo: String((m.falhas[0] && m.falhas[0].motivo) || "").slice(0, 120) });
  }
  if (num(c.nao_entregues) > 0) add("nao_entregues", "red", { n: num(c.nao_entregues) });
  const respondidas = num(c.respondidas);
  if (respondidas >= 5 && fracao(num(quem.frase_segura), respondidas) > 0.2) {
    add("frase_segura", "red", { n: num(quem.frase_segura), pct: Math.round(fracao(num(quem.frase_segura), respondidas) * 100) });
  }

  // ── DOURADO: dá para vender mais mexendo em uma coisa ─────────────────────────────────────
  // DM sem conta conhecida (histórico de quem tem 2+ contas): aí "nunca recebeu" pode ser mentira —
  // a Guileo recebeu 11 em 28/09 e nenhuma das duas contas sabia. Na dúvida, cala; as DMs ao vivo já
  // chegam com a conta, então isso se resolve sozinho com o uso.
  const dmSemConta = num(c.sem_conta) > 0;
  for (const conta of Array.isArray(m.contas) ? m.contas : []) {
    const ultima = Date.parse(conta && conta.ultima_dm_recebida);
    const nome = (conta && (conta.usuario ? `@${conta.usuario}` : conta.pagina)) || "";
    if (!Number.isFinite(ultima)) { if (!dmSemConta) add("conta_sem_dm", "gold", { conta: nome }); }
    else {
      const dias = Math.floor((agoraMs - ultima) / DIA);
      if (dias > DIAS_CONTA_MUDA) add("conta_muda", "gold", { conta: nome, n: dias });
    }
  }
  const semLink = (Array.isArray(m.por_campanha) ? m.por_campanha : []).filter((x) => x && x.ativa && !x.tem_link).length;
  if (semLink) add("sem_link", "gold", { n: semLink });

  const enviados = num(f.dm_enviado);
  if (enviados >= 5 && fracao(num(via.padrao), enviados) > 0.3) {
    add("idioma_padrao", "gold", { pct: Math.round(fracao(num(via.padrao), enviados) * 100) });
  }
  if (num(f.comentarios) >= 20 && fracao(num(f.casou), num(f.comentarios)) < 0.05) {
    add("poucos_casam", "gold", { pct: Math.round(fracao(num(f.casou), num(f.comentarios)) * 100) });
  }
  if (enviados >= 10 && fracao(num(f.conversas), enviados) < 0.1) {
    add("poucas_conversas", "gold", { pct: Math.round(fracao(num(f.conversas), enviados) * 100) });
  }
  if (num(c.standby) > 0) add("standby", "gold", { n: num(c.standby) });

  // ── INFORMAÇÃO: o freio trabalhando não é defeito, mas o dono precisa saber que existe ────
  if (num(f.segurado) > 0) add("freio", "info", { n: num(f.segurado) });

  // ── VERDE: nada a consertar — e isso também é notícia ─────────────────────────────────────
  const graves = out.some((x) => x.nivel === "red" || x.nivel === "gold");
  if (!graves && enviados > 0) add("tudo_certo", "green", { n: enviados });
  if (!enviados && !num(f.casou) && !num(c.recebidas)) add("sem_dados", "info", {});

  const peso = { red: 0, gold: 1, info: 2, green: 3 };
  return out.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}
