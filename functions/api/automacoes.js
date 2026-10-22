// Cloudflare Pages Function — GET /api/automacoes · "AS AUTOMAÇÕES ESTÃO RODANDO?" (2026-10-14)
//
// POR QUE EXISTE: o Luis perguntou "onde estão as automações e como sei que funcionam?" e a resposta
// vivia só no JSON de cada tique do cron (POST /api/cron-tick), que ninguém lia. Agora o cron grava o
// último resultado de CADA alvo em KV (cron:alvos · cron:ultimo, 3 dias) e esta rota entrega a lista
// com nome, o que faz, cadência, hora da última rodada, estado e motivo curto.
//
// PÚBLICO E SEM SEGREDO, de propósito — a mesma regra do semáforo do cron-tick: aqui vai só o nome da
// rotina, o estado e o motivo curto que a própria rota devolveu. Nada de cliente, número, chave ou
// configuração. Quem quer o detalhe usa as rotas gated (/api/agente-prova, /api/canais-prova).
//
// ESTADOS (a régua do cron-tick, leAlvo): ok · inerte (falta chave externa, dito com nome) · calado
// (alguém decidiu que não rodasse) · falhou (HTTP ruim ou ok:false) · sem registro (ainda não rodou
// desde que este registro existe, ou KV fora).
import { json, rateLimited } from "../lib/guard.js";

// nome → [o que faz, cadência]. A cadência vem dos blocos do cron-tick.js (15 min · hora · dia · segunda).
const CATALOGO = {
  "automations":            ["Regras de automação de cada negócio (lembrete, reativação, aniversário)", "a cada 15 min"],
  "mindbody-sync":          ["Sincronização de agendas externas (hoje inerte: MindBody recusou a API)", "a cada 15 min"],
  "lembretes":              ["Lembrete 24h antes e pedido de avaliação 3h depois de cada visita", "a cada 15 min"],
  "lifecycle":              ["Jornada do lead: demo → onboarding → retenção", "a cada 15 min"],
  "social-sweep":           ["Publica os posts agendados nas redes", "a cada 15 min"],
  "comentarios-sweep":      ["Comentário no Instagram/Facebook → DM (Guileo Direct)", "a cada 15 min"],
  "health-monitor":         ["Queda de atividade de um cliente → alerta (defesa de churn)", "de hora em hora"],
  "canary":                 ["Testa o cérebro da IA de verdade (chat do site, chat do Gui)", "de hora em hora"],
  "sinal-reconcile":        ["Confere sinais pagos no Stripe do negócio", "de hora em hora"],
  "venda-online-reconcile": ["Confere vendas online (pacote, vale, assinatura) no Stripe do negócio", "de hora em hora"],
  "resumo-manha":           ["Resumo da manhã para quem ligou (hora local do negócio)", "de hora em hora"],
  "consulta-retorno":       ["Acompanhamento de consulta que não virou agendamento (9h–20h locais)", "de hora em hora"],
  "relatorio-mensal":       ["Relatório mensal por e-mail (dia 1, 7h locais; opt-in)", "de hora em hora · dias 1 a 7"],
  "review-responder":       ["Rascunho de resposta a avaliações do Google (dono aprova)", "de hora em hora"],
  "collections":            ["Cobrança de pendências (lembra quem deve)", "de hora em hora"],
  "credit-alerts":          ["Aviso de crédito acabando (20% e zero) ao cliente", "de hora em hora"],
  "voz-saldo":              ["Vigia a cota de voz da ElevenLabs e o flagrante de agente mudo", "de hora em hora"],
  "dunning-sweep":          ["Pausa inadimplente de verdade (dunning)", "de hora em hora"],
  "agent-evolve":           ["Mantém cada agente na última versão das lições", "de hora em hora"],
  "eval-report":            ["Avaliação diária das ligações (eval)", "diário · 2h UTC"],
  "relacionamento":         ["Volta no ciclo de cada serviço + aniversário (e-mail)", "diário · 13h UTC"],
  "proactive":              ["Proatividade: reativação, datas, fidelidade, NPS", "diário · 13h UTC"],
  "crm-classify":           ["Classifica contatos do CRM (ciclo de vida, risco)", "diário · 13h UTC"],
  "nps":                    ["Pesquisa NPS", "diário · 13h UTC"],
  "cx-survey":              ["Pesquisa de experiência", "diário · 13h UTC"],
  "money-reconcile":        ["Confere Stripe = ledger (dinheiro bate)", "diário · 13h UTC"],
  "onboarding-checkin":     ["Check-in do onboarding de cada cliente", "diário · 13h UTC"],
  "onboarding-report":      ["Relatório de onboarding (dia 1)", "mensal"],
  "integrity-sweep":        ["Varredura noturna de contradições nos dados", "diário · 13h UTC"],
  "client-report":          ["Relatório semanal ao cliente (segunda)", "segunda · 13h UTC"],
  "seller-report":          ["Relatório semanal do vendedor (segunda)", "segunda · 13h UTC"],
  "ads-vigia":              ["Vigia das campanhas de anúncios (segunda)", "segunda · 13h UTC"],
  "company-os-brief":       ["Brief diário da própria Guileo ao dono", "diário · 13h UTC"],
  "daily-digest":           ["Digest diário ao dono", "diário · 13h UTC"],
  "backup":                 ["Backup do banco", "diário · 13h UTC"],
};

export async function onRequestGet({ request, env }) {
  if (await rateLimited(request, env, "automacoes", 30, 60)) return json({ ok: false, error: "too many requests" }, 429);
  if (!env.RATE_LIMIT) return json({ ok: false, ready: false, note: "sem KV neste ambiente — o registro das rodadas não existe aqui" });
  let alvos = {}, ultimo = null;
  try { alvos = JSON.parse((await env.RATE_LIMIT.get("cron:alvos")) || "{}") || {}; } catch { alvos = {}; }
  try { ultimo = JSON.parse((await env.RATE_LIMIT.get("cron:ultimo")) || "null"); } catch { ultimo = null; }
  const nomes = [...new Set([...Object.keys(CATALOGO), ...Object.keys(alvos)])];
  const lista = nomes.map((nome) => {
    const r = alvos[nome] || null; const c = CATALOGO[nome] || ["", ""];
    return { nome, oQueFaz: c[0], cadencia: c[1], at: r ? r.at : null, estado: r ? r.estado : "sem registro", status: r ? r.status : null, motivo: r ? String(r.motivo || "").slice(0, 160) : "" };
  });
  const contagem = lista.reduce((m, a) => { m[a.estado] = (m[a.estado] || 0) + 1; return m; }, {});
  return json({ ok: true, ultimo: ultimo ? { at: ultimo.at, ok: ultimo.ok, falhas: ultimo.falhas || [], inertes: ultimo.inertes || [], semaforo: ultimo.semaforo || null, alvos_no_tique: ultimo.alvos_no_tique } : null, contagem, alvos: lista });
}
