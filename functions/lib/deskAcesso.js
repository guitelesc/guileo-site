// ACESSO DA RECEPÇÃO (2026-10-05). A recepcionista abre o Balcão com um código PRÓPRIO, não com a chave da
// dona — a chave da dona abre a Central inteira (folha, relatórios, Stripe, ajustes).
//
// NEGAR POR PADRÃO: o código "bal_…" nunca chega às funções desk_* do banco. Só o /api/desk o reconhece:
// confere o hash no banco (desk_acesso_entrar_svc, só service_role), confere a ação na lista do papel abaixo e
// SÓ ENTÃO usa a chave da dona, do lado do servidor (ela nunca volta para o navegador). Qualquer outra rota
// (desk-pagamentos, relatorio-mensal, resumo-manha, coupons, a Central) recebe um código que não confere e
// recusa sozinha. O banco guarda só o SHA-256 do código.
export const PAPEIS = {
  // O dia da recepção: agenda, marcar, chegar/faltar/cancelar, cobrar no caixa, ficha da cliente, fechamento.
  // FORA: estorno (void), equipe/serviços/produtos, relatórios, importar, campanhas, acessos, juntar fichas (merge_*).
  recepcao: new Set([
    "quem", "plano", "agenda", "availability", "book", "book_repeat", "book_group", "addons_set", "noshow_undo", "move", "note", "status", "block", "catalog",
    "checkout", "coupon_check", "sale", "receipt", "day_close", "client_search", "client_card", "client_save",
    "deposit_link", "absence_plan", "absence_notify",
    "assistente",   // a Lilian/Gui no canto do /balcao (/api/gui-voz); o que ela FAZ passa de novo por esta lista
  ]),
  // A agenda DA PROFISSIONAL (2026-10-05): o dia dela, chegou / terminou e nota — só nos agendamentos dela
  // (o /api/desk filtra a agenda e confere o dono de cada agendamento: filtrarAgendaDela / STATUS_DA_PROFISSIONAL).
  profissional: new Set(["quem", "plano", "agenda", "note", "status"]),
};
// O que a profissional pode marcar: chegou (arrived = in_progress no banco) e terminou. Faltou/cancelou é do balcão.
export const STATUS_DA_PROFISSIONAL = new Set(["arrived", "in_progress", "completed"]);

// A agenda que a profissional enxerga: só ela, só os agendamentos e bloqueios dela, e SEM o contato das
// clientes (nome e serviço bastam para atender). Nunca muda o objeto original.
export function filtrarAgendaDela(dados, proId) {
  if (!dados || typeof dados !== "object" || !proId) return { ok: false };
  const meu = (x) => x && x.pro_id === proId;
  const semContato = (a) => { const { customer_contact: _c, customer_email: _e, customer_phone: _p, ...resto } = a; return { ...resto, customer_contact: "" }; };
  return {
    ...dados,
    pros: (dados.pros || []).filter((p) => p && p.id === proId),
    appointments: (dados.appointments || []).filter(meu).map(semContato),
    blocks: Array.isArray(dados.blocks) ? dados.blocks.filter(meu) : dados.blocks,
    // desk_v10: as regras (duração/preparo/pagamento) são SÓ as dela — o pagamento das outras não é da conta dela.
    pro_rules: (dados.pro_rules || []).filter(meu),
  };
}

const CODIGO = /^bal_[a-z2-7]{26}$/;
export const ehCodigoDoBalcao = (k) => CODIGO.test(String(k || ""));
export const podeAcessoFazer = (papel, acao) => !!(PAPEIS[papel] && PAPEIS[papel].has(acao));

// 26 caracteres base32 = 130 bits: adivinhar não é um caminho.
export function novoCodigo(rand = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const abc = "abcdefghijklmnopqrstuvwxyz234567";
  const bytes = rand(26);
  let s = "bal_";
  for (let i = 0; i < 26; i++) s += abc[bytes[i] & 31];
  return s;
}

export async function hashCodigo(codigo) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(codigo)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Abre a porta para um código de recepção. Devolve { ok:true, chave, acesso } | { ok:false, http, corpo }.
// `svc` = svcJson (injetável no teste). Banco fora do ar → 503 (nunca "código errado" por engano).
export async function abrirComCodigo(env, svc, { email, codigo, acao }) {
  const r = await svc(env, "desk_acesso_entrar_svc", { p_email: email, p_hash: await hashCodigo(codigo) }).catch((e) => ({ ok: false, erro_http: 0, detalhe: String(e) }));
  if (r && r.ok === false && !r.reason) return { ok: false, http: 503, corpo: { ok: false, erro: "Desk indisponível" } };
  if (!r || r.ok !== true || typeof r.chave !== "string" || !r.chave) return { ok: false, http: 401, corpo: { ok: false, erro: "unauthorized" } };
  if (!podeAcessoFazer(r.papel, acao)) return { ok: false, http: 403, corpo: { ok: false, reason: "role_forbidden", papel: r.papel } };
  if (r.papel === "profissional" && !r.pro_id) return { ok: false, http: 401, corpo: { ok: false, erro: "unauthorized" } };
  return { ok: true, chave: r.chave, acesso: { id: r.id, nome: r.nome, papel: r.papel, pro_id: r.pro_id || null } };
}
