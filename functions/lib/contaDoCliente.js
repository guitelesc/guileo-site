// PARA ONDE VAI O DINHEIRO DO CLIENTE DO NOSSO CLIENTE (2026-09-30)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Gift card, pacote e assinatura vendidos por um negócio são dinheiro DELE. O checkout de
// /api/giftcards e /api/packages usava a chave da plataforma sem dizer a conta de destino: o
// pagamento da cliente do spa cairia na conta Stripe da GUILEO. Nenhum negócio tinha Stripe
// conectado quando isto foi escrito (0 linhas `stripe_connect`), então nada caiu errado — mas o
// primeiro gift card vendido cairia.
//
// A REGRA
//   • conta conectada e liberada para cobrar → cobrança de DESTINO (destination charge): o
//     pagamento passa pela plataforma e o Stripe transfere para a conta do negócio. Escolhida em vez
//     da cobrança direta porque as contas são Express (stripe-connect.js) e porque o evento chega
//     no NOSSO webhook — é ele que emite o gift card / registra o pacote. Cobrança direta não avisa
//     o nosso webhook (ele ignora `event.account`), e a pessoa pagaria por um cartão que nunca nasce.
//   • sem conta conectada → NÃO VENDE. Devolve `sem_conta` e a tela diz para conectar o Stripe.
//     Nunca "cobra na nossa e acerta depois".
//   • a própria Guileo (OWNER_EMAIL / demo) vende na conta da plataforma, que é a dela.
import { svcJson } from "./sb.js";

const ACCT = /^acct_[A-Za-z0-9]{8,40}$/;

/** Parte pura: decide o destino a partir do que o cadastro diz. */
export function decidirConta({ tenant = "", owner = "", stripe = null } = {}) {
  const t = String(tenant || "").trim().toLowerCase();
  const o = String(owner || "").trim().toLowerCase();
  if (!t.includes("@")) return { modo: "sem_conta", motivo: "tenant_invalido" };
  if ((o && t === o) || t === "demo@guileoai.com") return { modo: "plataforma" };
  const s = stripe && typeof stripe === "object" ? stripe : {};
  const conta = String(s.account_id || "");
  if (!ACCT.test(conta)) return { modo: "sem_conta", motivo: "nao_conectado" };
  // `charges_enabled` é o Stripe dizendo que a conta terminou o cadastro e pode receber.
  if (s.charges_enabled !== true) return { modo: "sem_conta", motivo: "cadastro_incompleto" };
  return { modo: "conectada", conta };
}

/**
 * Campos do Checkout que mandam o dinheiro para a conta do negócio.
 * `assinatura` muda o lugar dos campos (subscription_data em vez de payment_intent_data).
 * `feePct` = a parte da Guileo (env GUILEO_FEE_PCT); 0 = nada.
 */
export function camposDoDestino(destino, { assinatura = false, cents = 0, feePct = 0 } = {}) {
  if (!destino || destino.modo !== "conectada" || !ACCT.test(String(destino.conta || ""))) return {};
  const pct = Math.min(Math.max(Number(feePct) || 0, 0), 90);
  const base = assinatura ? "subscription_data" : "payment_intent_data";
  const f = { [`${base}[transfer_data][destination]`]: destino.conta, [`${base}[on_behalf_of]`]: destino.conta };
  if (pct > 0) {
    if (assinatura) f["subscription_data[application_fee_percent]"] = String(pct);
    else { const fee = Math.round((Number(cents) || 0) * pct / 100); if (fee > 0) f["payment_intent_data[application_fee_amount]"] = String(fee); }
  }
  return f;
}

/** Lê o cadastro e decide. Falha de leitura = `sem_conta` (fail-closed: na dúvida, não cobra). */
export async function contaDePagamento(env, tenantEmail) {
  const tenant = String(tenantEmail || "").trim().toLowerCase();
  const owner = (env && env.OWNER_EMAIL) || "smart@guileoai.com";
  const previa = decidirConta({ tenant, owner, stripe: null });
  if (previa.modo === "plataforma" || previa.motivo === "tenant_invalido") return previa;
  const r = await svcJson(env, "client_stripe_lookup", { p_secret: (env && env.INGEST_SECRET) || "", p_email: tenant });
  if (r && r.erro_http) return { modo: "sem_conta", motivo: "leitura_falhou" };
  return decidirConta({ tenant, owner, stripe: r });
}

// ── O PAGAMENTO É DE UM CLIENTE DO NEGÓCIO? ────────────────────────────────────────────────────
// O webhook do Stripe trata primeiro os produtos DA GUILEO (recarga, taxa de setup, plano) e só
// depois as vendas que um negócio faz aos clientes dele. Três ramos decidiam pelo VALOR ou pelo
// e-mail de quem pagou, sem olhar de quem era a venda:
//   • um gift card ou pacote de exatos $199 caía no ramo "taxa de setup da Guileo" — nenhum cartão
//     era emitido e nada entrava na receita do negócio;
//   • todo gift card fora da tabela de planos disparava o alarme "valor desconhecido";
//   • o estorno de um gift card descontava CRÉDITOS DA GUILEO da conta de quem comprou.
// A etiqueta que o nosso próprio checkout grava (metadata.guileo) diz de quem é a venda.
// "loja" (2026-10-04) = a sacola da vitrine (functions/api/loja-checkout.js).
// "desk_deposit" (2026-10-05) = sinal de agendamento cobrado pelo Guileo Desk / pela agente (lib/sinal.js).
const DO_NEGOCIO = new Set(["giftcard", "package", "membership", "client_charge", "loja", "desk_deposit"]);
export function pagamentoDoClienteDoNegocio(...metas) {
  for (const m of metas) {
    if (m && typeof m === "object" && DO_NEGOCIO.has(String(m.guileo || "").toLowerCase())) return true;
  }
  return false;
}

// ── O PAÍS DA CONTA DO NEGÓCIO ─────────────────────────────────────────────────────────────────
// A conta Express era criada SEM país: o Stripe usa então o país da PLATAFORMA. Se a plataforma
// não for do mesmo país do negócio, o spa de Nova York ganharia uma conta de outro país — e país
// de conta Stripe não se muda depois, só criando outra. Aqui o país sai do que o cadastro sabe, em
// ordem de confiança; sem certeza devolve "" e a criação é RECUSADA com a pergunta certa.
const PAISES = new Set(["US", "BR", "CA", "MX", "GB", "PT", "ES"]);
const FUSO_BR = /^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Maceio|Araguaina|Noronha|Santarem)$/;
const FUSO_US = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+)|Pacific\/Honolulu|US\/.+)$/;
export function paisDoNegocio({ pedido = "", perfil = "", fusos = [], telefone = "" } = {}) {
  for (const c of [pedido, perfil]) { const p = String(c || "").trim().toUpperCase(); if (PAISES.has(p)) return p; }
  const zs = (Array.isArray(fusos) ? fusos : []).map((z) => String(z || "")).filter(Boolean);
  if (zs.length && zs.every((z) => FUSO_US.test(z))) return "US";
  if (zs.length && zs.every((z) => FUSO_BR.test(z))) return "BR";
  if (zs.length) return "";                       // fusos de países diferentes: não adivinha
  const d = String(telefone || "").replace(/[^0-9+]/g, "");
  if (/^\+55\d{10,11}$/.test(d)) return "BR";
  return "";                                       // +1 sozinho não decide (EUA e Canadá dividem o código)
}

// ── STRIPE PRÓPRIO, SÓ PARA O SINAL (2026-10-05) ──────────────────────────────────────────────
// A plataforma Stripe da Guileo é BR, e o Stripe não repassa de plataforma BR para conta nos EUA
// (docs.stripe.com/connect/cross-border-payouts). Negócio dos EUA cola uma chave RESTRITA da
// própria conta (stripe_own_save) e o sinal é cobrado DIRETO nela.
// Usado pelo SINAL. Pacote, vale-presente, assinatura e loja na conta própria passam por
// lib/vendaOnlineNegocio.js (caminhoDaVenda), que tem a MESMA garantia: entrega só na volta
// (/api/venda-paga) ou na conferência de hora em hora — nunca depende do webhook da plataforma.
// O sinal tem confirmação própria: /api/sinal-pago na volta do Stripe + conferência de hora em hora.
export async function contaParaSinal(env, tenantEmail, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const propria = await svc(env, "stripe_own_lookup_svc", { p_tenant: tenantEmail });
  if (propria && typeof propria === "object" && /^(rk|sk)_(live|test)_/.test(String(propria.secret_key || ""))) {
    return { modo: "propria", chave: String(propria.secret_key) };
  }
  return contaDePagamento(env, tenantEmail);
}
