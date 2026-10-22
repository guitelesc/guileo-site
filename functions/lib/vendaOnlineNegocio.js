// VENDA ONLINE DE PACOTE, VALE-PRESENTE E ASSINATURA no Stripe DO NEGÓCIO (2026-10-05)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Quem chama: /api/packages (buy) e /api/giftcards (buy) para CRIAR o link; /api/venda-paga (volta da
// cliente) e /api/venda-online-reconcile (cron, de hora em hora) para ENTREGAR o que foi pago.
//
// O PROBLEMA: o link de venda saía na plataforma Stripe da Guileo, que é BR e não repassa para negócio
// dos EUA (ATIVACOES.md "NATURA · Stripe próprio"). Para o spa de Nova York o link era bloqueado/errado.
//
// A REGRA (decidirVenda, pura e testada):
//   1. o negócio colou a chave restrita PRÓPRIA (stripe_own) → a sessão nasce na conta DELE. O webhook
//      da plataforma não fica sabendo; a entrega é feita aqui, lendo a SESSÃO com a chave do negócio.
//   2. sem chave própria → exatamente o caminho de antes (contaDePagamento): conta conectada pela
//      plataforma (negócio BR) ou a própria Guileo/demo. Nada muda para o negócio BR.
//   3. sem nada → `payments_not_connected`. Negócio dos EUA recebe a dica certa: guileoai.com/receber
//      (Stripe próprio), nunca um link da plataforma.
//
// A ENTREGA (conferirVendaOnline): só com payment_status "paid" lido no Stripe DO NEGÓCIO, etiqueta
// nossa (metadata.guileo + via=stripe_own) e client_email == o negócio. Quem cria o pacote / vale é a
// MESMA SQL do webhook (package_purchase_record / giftcard_create / revenue_record), rodando dentro de
// venda_online_fulfill_svc (db/desk_v6_venda_online.sql) com trava por sessão: a volta e a conferência
// podem ver a mesma sessão e o pacote / vale nasce UMA vez. Nunca credita créditos da Guileo nem
// provisiona nada para quem pagou — tudo vai para o negócio.
//
// ASSINATURA pela chave própria reaproveita o que o Desk já tem: etiqueta `desk_membership`, volta por
// /api/sinal-pago e conferência pelo /api/sinal-reconcile (lib/sinalPago.js). Aqui só nasce o link.
//
// E-MAIL DO VALE (2026-10-05): vale entregue por ESTE caminho sai por e-mail com a marca do negócio
// (valePresenteEmail) para quem ganhou — e uma cópia para quem comprou; se quem ganhou não tem e-mail,
// só quem comprou recebe, para repassar. "Enviado" = Resend respondeu com id. Qualquer falha (sem e-mail,
// e-mail desligado, Resend recusou) vira linha no feed do dono: "vale NÃO enviado — mandar o código à
// mão", com o código no payload. O caminho da PLATAFORMA (stripe-webhook.js, ramo giftcard) usa este
// MESMO envio desde 2026-10-05 — só quando giftcard_platform_fulfill_svc diz que o vale acabou de nascer.
//
// LOJA DA VITRINE (2026-10-05): sacola paga na conta PRÓPRIA do negócio (loja-checkout.js ·
// camposDaLojaPropria). Mesma volta (/api/venda-paga?loja=<slug>) e mesma conferência de hora em hora;
// o registro é a MESMA SQL do ramo "loja" do webhook, dentro de loja_online_fulfill_svc
// (db/desk_v7_loja.sql) com a mesma trava por sessão. Feed do dono + aviso ao salão saem UMA vez.
import { svcJson } from "./sb.js";
import { contaDePagamento, paisDoNegocio } from "./contaDoCliente.js";
import { stripe, motivoDoStripe, chaveDoNegocio, nomeDaPermissao } from "./stripeDoNegocio.js";
import { emitFailure } from "./failure.js";
import { itensDaMeta, enderecoEmLinha, lojaDe } from "./loja.js";
import { avisarPedidoLoja } from "./lojaAviso.js";
import { avisarDono } from "./avisarDono.js";
import { brandFor } from "./clientBrand.js";
import { valePresenteEmail } from "./emailTemplates.js";

export const RECEBER_URL = "https://guileoai.com/receber";
const SESSAO = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const voltaDaVenda = (tenant) => `https://guileoai.com/api/venda-paga?t=${encodeURIComponent(tenant)}&s={CHECKOUT_SESSION_ID}`;
const voltaDoDesk = (tenant) => `https://guileoai.com/api/sinal-pago?t=${encodeURIComponent(tenant)}&s={CHECKOUT_SESSION_ID}`;
const expira = () => String(Math.floor(Date.now() / 1000) + 23 * 3600);   // link vale 23h (máximo do Stripe é 24h)

/**
 * Parte pura: por onde a venda sai.
 *   propria   → { via:"propria", chave }
 *   destino   → o que contaDePagamento respondeu (conectada | plataforma | sem_conta)
 *   pais      → "US" | "BR" | "" (só usado na recusa)
 * → { via:"propria", chave } | { via:"plataforma", destino } | { via:"recusa", corpo }
 */
export function decidirVenda({ propria = null, destino = null, pais = "" } = {}) {
  if (propria && /^(rk|sk)_(live|test)_/.test(String(propria.chave || ""))) return { via: "propria", chave: String(propria.chave) };
  const d = destino && typeof destino === "object" ? destino : { modo: "sem_conta", motivo: "leitura_falhou" };
  if (d.modo === "conectada" || d.modo === "plataforma") return { via: "plataforma", destino: d };
  return { via: "recusa", corpo: recusaSemConta(d, pais) };
}

/** Corpo honesto de "não dá para vender online ainda". Negócio fora do BR → Stripe próprio. */
export function recusaSemConta(destino, pais = "") {
  const fora = String(pais || "").toUpperCase() !== "BR";
  const corpo = { ok: false, ready: false, reason: "payments_not_connected", detail: destino?.motivo || "nao_conectado" };
  if (fora) {
    corpo.hint = "use_own_stripe";
    corpo.connect_url = RECEBER_URL;
    corpo.note = "Connect your own Stripe account at guileoai.com/receber (restricted key, \"Business in the US? Use your own Stripe account\") to sell online — the money goes straight to you.";
  } else {
    corpo.note = "Connect your Stripe account (Settings → Payments) to sell online — the money goes straight to you.";
  }
  return corpo;
}

/** O país do negócio — só para escolher a dica da recusa. Falha de leitura = "" (vira a dica dos EUA). */
async function paisDoTenant(env, tenant, svc) {
  let fusos = [], perfil = "";
  try {
    const bl = await svc(env, "biz_tenant_fusos", { p_secret: env.SCHED_SECRET || "", p_email: tenant });
    if (bl && bl.ok === true && Array.isArray(bl.fusos)) fusos = bl.fusos;
    const pf = await svc(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: tenant });
    if (pf && typeof pf === "object") perfil = String(pf.country || "");
  } catch { /* sem leitura: "" */ }
  return paisDoNegocio({ perfil, fusos });
}

/** Lê o cadastro e decide (chave própria primeiro; depois o caminho de antes). */
export async function caminhoDaVenda(env, tenant, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const k = await chaveDoNegocio(env, tenant, { svcJson: svc });
  if (k.ok) return decidirVenda({ propria: { chave: k.chave } });
  const destino = await (deps.contaDePagamento || contaDePagamento)(env, tenant);
  if (destino && (destino.modo === "conectada" || destino.modo === "plataforma")) return decidirVenda({ destino });
  return decidirVenda({ destino, pais: await paisDoTenant(env, tenant, svc) });
}

/**
 * Link de venda de PACOTE ou VALE-PRESENTE no Stripe do negócio.
 *   kind "package":  { item:{id,name}, cents }
 *   kind "giftcard": { cents, recipient, purchaser }
 * → { ok, url, id, conferencia } | { ok:false, reason, ... }
 */
export async function criarVendaPropria(env, { tenant, chave, kind, item = null, cents, recipient = "", purchaser = "", recipientName = "", message = "" }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  if (kind !== "package" && kind !== "giftcard") return { ok: false, reason: "invalid_kind" };
  const c = Math.round(Number(cents) || 0);
  if (!(c >= 50)) return { ok: false, reason: "price_too_low" };
  if (kind === "package" && !(item && UUID.test(String(item.id || "")))) return { ok: false, reason: "not_found" };
  const nome = kind === "package"
    ? String(item.name || "Package").slice(0, 120)
    : `Gift card — $${(c / 100).toFixed(2)}`;
  const meta = { guileo: kind, via: "stripe_own", client_email: tenant };
  if (kind === "package") meta.id = item.id;
  else {
    meta.amount_cents = String(c); meta.recipient_contact = String(recipient || "").slice(0, 160); meta.purchaser_contact = String(purchaser || "").slice(0, 160);
    // nome de quem ganha e o recado vão no e-mail do vale (metadado do Stripe aceita até 500 caracteres)
    const nome = String(recipientName || "").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
    const recado = String(message || "").trim().slice(0, 400);
    if (nome) meta.recipient_name = nome;
    if (recado) meta.gift_message = recado;
  }
  const form = {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(c),
    "line_items[0][price_data][product_data][name]": nome,
    success_url: voltaDaVenda(tenant),
    cancel_url: "https://guileoai.com/api/obrigado?o=cancel",
    expires_at: expira(),
    // cupom do Stripe venderia abaixo do preço cadastrado — fica no preço exato (igual ao caminho da plataforma)
    allow_promotion_codes: "false",
  };
  for (const [a, v] of Object.entries(meta)) { form[`metadata[${a}]`] = v; form[`payment_intent_data[metadata][${a}]`] = v; }
  if (EMAIL.test(String(purchaser || "").trim())) form.customer_email = String(purchaser).trim().toLowerCase();
  const r = await stripe(chave, "POST", "/checkout/sessions", form, { fetch: deps.fetch || fetch });
  if (!r.ok || !r.data?.url || !SESSAO.test(String(r.data?.id || ""))) return { ok: false, ...motivoDoStripe(r.status, r.data) };
  const reg = await svc(env, "venda_online_session_add_svc", {
    p_tenant: tenant, p_session: r.data.id, p_kind: kind, p_item_id: kind === "package" ? item.id : null,
    p_cents: c, p_recipient: meta.recipient_contact || "", p_purchaser: meta.purchaser_contact || "",
  });
  return { ok: true, url: r.data.url, id: r.data.id, via: "stripe_own", conferencia: reg?.ok === true };
}

/**
 * Link de ASSINATURA no Stripe do negócio (sem precisar da ficha da cliente). Mesma etiqueta do Desk
 * (desk_membership) → a volta (/api/sinal-pago) e a conferência (/api/sinal-reconcile) já entregam.
 */
export async function criarAssinaturaPropria(env, { tenant, chave, membership, contact = "" }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  if (!membership || !UUID.test(String(membership.id || ""))) return { ok: false, reason: "membership_not_found" };
  const cents = Math.round(Number(membership.price_cents) || 0);
  if (cents < 50) return { ok: false, reason: "membership_price" };
  const contato = String(contact || "").slice(0, 160);
  const meta = { guileo: "desk_membership", client_email: tenant, membership_id: membership.id, contact: contato };
  const form = {
    mode: "subscription",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][recurring][interval]": membership.interval === "year" ? "year" : "month",
    "line_items[0][price_data][product_data][name]": String(membership.name || "Membership").slice(0, 100),
    success_url: voltaDoDesk(tenant), cancel_url: "https://guileoai.com/api/obrigado?o=cancel", expires_at: expira(),
    allow_promotion_codes: "false",
  };
  if (EMAIL.test(contato.trim())) form.customer_email = contato.trim().toLowerCase();
  for (const [a, v] of Object.entries(meta)) { form[`metadata[${a}]`] = v; form[`subscription_data[metadata][${a}]`] = v; }
  const r = await stripe(chave, "POST", "/checkout/sessions", form, { fetch: deps.fetch || fetch });
  if (!r.ok || !r.data?.url) return { ok: false, ...motivoDoStripe(r.status, r.data) };
  const reg = await svc(env, "desk_stripe_session_add_svc", { p_tenant: tenant, p_session: r.data.id, p_kind: "membership", p_contact: contato, p_membership_id: membership.id });
  return { ok: true, url: r.data.url, id: r.data.id, via: "stripe_own", conferencia: reg?.ok === true };
}

/**
 * ENTREGA: confere a sessão no Stripe DO NEGÓCIO e, se paga, cria o pacote / vale (uma vez só).
 * → { ok:true, kind, already, result } | { ok:false, reason }
 *   reasons: sessao_invalida · sem_stripe_proprio · stripe_nao_respondeu · sessao_de_outro · nao_pago ·
 *            package_not_found · nao_entregou
 */
export async function conferirVendaOnline(env, { tenant, sessionId }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const f = deps.fetch || fetch;
  const alarme = deps.emitFailure || emitFailure;
  const t = String(tenant || "").trim().toLowerCase();
  if (!SESSAO.test(String(sessionId || "")) || !t.includes("@")) return { ok: false, reason: "sessao_invalida" };
  const k = await chaveDoNegocio(env, t, { svcJson: svc });
  if (!k.ok) return { ok: false, reason: "sem_stripe_proprio" };
  const lida = await stripe(k.chave, "GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`, null, { fetch: f });
  if (!lida.ok || !lida.data || typeof lida.data !== "object") return { ok: false, reason: "stripe_nao_respondeu" };
  const s = lida.data;
  const m = s.metadata || {};
  const kind = String(m.guileo || "");
  if ((kind !== "package" && kind !== "giftcard" && kind !== "loja") || m.via !== "stripe_own" || String(m.client_email || "").toLowerCase() !== t || s.id !== sessionId) {
    return { ok: false, reason: "sessao_de_outro" };
  }
  if (kind === "loja") {
    // a vitrine da etiqueta tem que ser DESTE negócio (a conta da loja é a mesma do tenant)
    if (lojaDe(m.slug)?.email !== t) return { ok: false, reason: "sessao_de_outro" };
    if (s.payment_status !== "paid") return { ok: false, reason: "nao_pago", status: s.payment_status || s.status || "", kind, slug: m.slug };
    return entregarLoja(env, t, s, { svc, alarme, ...deps });
  }
  if (kind === "package" && !UUID.test(String(m.id || ""))) return { ok: false, reason: "sessao_de_outro" };
  if (s.payment_status !== "paid") return { ok: false, reason: "nao_pago", status: s.payment_status || s.status || "" };

  const cents = Math.max(0, Math.round(Number(s.amount_total) || 0));
  const buyer = String(s.customer_details?.email || m.purchaser_contact || "").toLowerCase().slice(0, 160);
  const fr = await svc(env, "venda_online_fulfill_svc", {
    p_secret: env.INGEST_SECRET || "", p_sched_secret: env.SCHED_SECRET || "", p_tenant: t, p_session: s.id, p_kind: kind,
    p_item_id: kind === "package" ? m.id : null, p_cents: cents, p_buyer: buyer,
    p_recipient: String(m.recipient_contact || ""), p_purchaser: String(m.purchaser_contact || ""),
  });
  const rotulo = kind === "package" ? "Pacote" : "Gift card";
  if (!fr || fr.ok !== true) {
    const reason = (fr && fr.reason) || "nao_entregou";
    // já registrado como falha final numa volta anterior → não repete o alarme
    if (!(fr && fr.already)) {
      await Promise.resolve(alarme(env, "recurring_fulfill_failed", t,
        `${kind} paid $${(cents / 100).toFixed(2)} on the business's own Stripe but fulfill failed (${reason}) — deliver by hand or refund`,
        { session: s.id, kind, via: "stripe_own", reason, detalhe: fr?.detalhe || fr?.erro_http || "" })).catch(() => null);
    }
    return { ok: false, reason, kind };
  }
  if (!fr.already && env.INGEST_SECRET) {
    // feed do dono — mesmo resumo do webhook da plataforma; o código do vale vai junto para o dono repassar
    await Promise.resolve(svc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET, p_email: t, p_type: "payment", p_channel: "stripe",
      p_summary: `💳 ${rotulo} · $${(cents / 100).toFixed(2)}`, p_amount: cents / 100,
      p_payload: { session: s.id, kind, via: "stripe_own", ...(kind === "giftcard" ? { code: fr.result?.code || "", recipient_contact: m.recipient_contact || "" } : { package_id: m.id, purchase_id: fr.result?.purchase_id || "" }) },
    })).catch(() => null);
  }
  // o código do vale vai por e-mail UMA vez (só na entrega que criou o vale, nunca na repetição)
  let vale = null;
  if (kind === "giftcard" && !fr.already) {
    vale = await enviarValePresente(env, {
      tenant: t, session: s.id, code: fr.result?.code || "", cents: Number(fr.result?.cents) || cents,
      recipient: m.recipient_contact || "", recipientName: m.recipient_name || "", message: m.gift_message || "",
      buyer, buyerName: String(s.customer_details?.name || "").slice(0, 80),
    }, deps);
  }
  return { ok: true, kind, already: !!fr.already, cents, result: fr.result || {}, ...(vale ? { email: vale } : {}) };
}

// ═══ LOJA: registrar o pedido pago no Stripe do negócio ═════════════════════════════════════════
// Espelho do ramo guileo:"loja" do stripe-webhook.js — mesmos campos, mesmo resumo no feed, mesmo
// aviso ao salão, mesmo alarme quando pagou e não registrou. A diferença é a trava: aqui quem garante
// "uma vez" é loja_online_fulfill_svc (feed e aviso só com already:false), lá era o id do evento.
async function entregarLoja(env, t, s, { svc, alarme, ...deps }) {
  const m = s.metadata || {};
  const itens = itensDaMeta(m.itens);
  const cents = Math.max(0, Math.round(Number(s.amount_total) || 0));
  const nome = String(s.customer_details?.name || "").slice(0, 120);
  const email = String(s.customer_email || s.customer_details?.email || "").toLowerCase();
  const contato = email || String(s.customer_details?.phone || "");
  const entrega = String(m.entrega || "");
  const endereco = s.shipping_details?.address || s.collected_information?.shipping_details?.address || null;
  // ref de cada venda = "<payment_intent>:<produto>" (lib/loja.js · refDaVenda, o mesmo do webhook) —
  // é o prefixo que o estorno da loja procura. Sem payment_intent, cai no id da sessão.
  const refBase = (typeof s.payment_intent === "string" && s.payment_intent) || s.payment_intent?.id || s.id;
  const fr = await svc(env, "loja_online_fulfill_svc", {
    p_secret: env.INGEST_SECRET || "", p_sched_secret: env.SCHED_SECRET || "", p_tenant: t, p_session: s.id, p_ref_base: refBase,
    p_itens: itens, p_cents: cents, p_customer_name: nome, p_customer_contact: contato, p_entrega: entrega,
  });
  if (!fr || fr.ok !== true) {
    const reason = (fr && fr.reason) || "nao_entregou";
    await Promise.resolve(alarme(env, "loja_pago_sem_registro", t,
      `Pedido da loja PAGO ($${(cents / 100).toFixed(2)}, sessão ${s.id}) no Stripe PRÓPRIO do negócio e NÃO registrado (${reason}) — conferir estoque e entregar ou estornar`,
      { session: s.id, via: "stripe_own", reason, detalhe: fr?.detalhe || fr?.erro_http || "" })).catch(() => null);
    return { ok: false, reason, kind: "loja", slug: m.slug };
  }
  const base = { ok: true, kind: "loja", slug: m.slug, already: !!fr.already, cents, result: fr.result || {} };
  if (fr.already) return base;

  const res = fr.result || {};
  const linhas = Array.isArray(res.itens) ? res.itens : [];
  const vendidos = linhas.map((l) => ({ nome: l.name || "", qtd: Number(l.qtd) || 0 }));
  const problemas = [];
  if (!itens.length) problemas.push("sessão sem itens no metadado");
  for (const l of linhas) if (!l.ok) problemas.push(`${l.id} ×${l.qtd}: ${l.reason || l.detalhe || "sem resposta"}`);
  if (res.revenue && res.revenue.error) problemas.push(`revenue_record ${res.revenue.error}`);
  const qtd = itens.reduce((n, i) => n + i.qtd, 0);
  const rotulo = entrega === "envio" ? "envio" : `retirada ${entrega === "ues" ? "Upper East Side" : entrega === "astoria" ? "Astoria" : entrega}`;
  const feed = await Promise.resolve(svc(env, "ingest_client_event", {
    p_secret: env.INGEST_SECRET || "", p_email: t, p_type: "payment", p_channel: "stripe",
    p_summary: `🛍️ Pedido da loja · $${(cents / 100).toFixed(2)} · ${qtd} ${qtd === 1 ? "item" : "itens"} · ${rotulo}${nome ? ` · ${nome}` : ""}`,
    p_amount: cents / 100, p_payload: { session: s.id, kind: "loja", via: "stripe_own", entrega, itens, contato, endereco },
  })).catch(() => null);
  if (!feed || (typeof feed === "object" && feed.ok === false)) problemas.push("ingest_client_event falhou");
  // O SALÃO PRECISA SABER: e-mail + WhatsApp/SMS (lib/lojaAviso.js). Nenhum dos dois saiu = alarme.
  const aviso = await (deps.avisarPedidoLoja || avisarPedidoLoja)(env, { tenant: t, negocio: lojaDe(m.slug)?.nome || "", cliente: nome || contato, itens: vendidos, entrega, endereco: enderecoEmLinha(endereco), cents });
  if (!aviso || (!aviso.email && !aviso.texto)) problemas.push("o salão NÃO foi avisado do pedido (e-mail e texto falharam ou não configurados) — avisar à mão");
  if (problemas.length) {
    const resumo = `Pedido da loja PAGO ($${(cents / 100).toFixed(2)}, sessão ${s.id}, Stripe próprio) com problema no registro: ${problemas.join("; ").slice(0, 400)}. Conferir estoque e entregar ou estornar.`;
    await Promise.resolve(alarme(env, "loja_pago_sem_registro", t, resumo, { session: s.id, via: "stripe_own", problemas })).catch(() => null);
    try { await (deps.avisarDono || avisarDono)(env, { kind: "loja_pago_sem_registro", summary: resumo, cliente: t, chave: `loja:${s.id}` }); } catch { /* o alarme acima já registrou */ }
  }
  return { ...base, problemas: problemas.length, avisado: !!(aviso && (aviso.email || aviso.texto)) };
}

// ═══ VALE-PRESENTE: o código por e-mail ═════════════════════════════════════════════════════════
// → { sent:[{ to, para, id }], failed:[{ to, para, reason }] } — "sent" só com o id do Resend.
const remetente = (env, negocio) => {
  const base = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
  const nome = String(negocio || "").replace(/["<>\r\n]/g, "").trim().slice(0, 60);
  if (!nome || nome === "Guileo") return base;
  return `${nome} <${(base.match(/<([^>]+)>/) || [])[1] || base}>`;
};
export async function enviarValePresente(env, { tenant, session = "", code, cents, recipient = "", recipientName = "", message = "", buyer = "", buyerName = "" }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const f = deps.fetch || fetch;
  const out = { sent: [], failed: [] };
  const para = [];
  const rec = String(recipient || "").trim().toLowerCase();
  const comp = String(buyer || "").trim().toLowerCase();
  if (EMAIL.test(rec)) para.push({ to: rec, para: "recipient" });
  if (EMAIL.test(comp) && comp !== rec) para.push({ to: comp, para: "buyer" });
  const feed = (summary, payload) => (env.INGEST_SECRET ? Promise.resolve(svc(env, "ingest_client_event", {
    p_secret: env.INGEST_SECRET, p_email: tenant, p_type: "message", p_channel: "Email", p_summary: String(summary).slice(0, 300), p_amount: 0,
    p_payload: { kind: "giftcard_email", session, code, ...payload },
  })).catch(() => null) : null);
  const valor = `$${((Number(cents) || 0) / 100).toFixed(2)}`;
  if (!code) {
    await feed(`⚠️ Vale-presente ${valor} pago, mas sem código para enviar — conferir no painel e mandar à mão`, { delivery: "failed", reason: "sem_codigo" });
    out.failed.push({ to: "", para: "", reason: "sem_codigo" });
    return out;
  }
  if (!para.length || !env.RESEND_API_KEY) {
    const reason = !para.length ? "sem_email" : "email_off";
    await feed(`⚠️ Vale ${code} (${valor}) NÃO enviado — ${reason === "sem_email" ? "quem comprou e quem ganhou não deixaram e-mail" : "e-mail desligado"}. Mandar o código à mão${rec ? ` para ${rec}` : ""}`,
      { delivery: "failed", reason, recipient_contact: recipient || "" });
    out.failed.push({ to: "", para: "", reason });
    return out;
  }
  const marca = await (deps.brandFor || brandFor)(env, tenant).catch(() => null);
  const brand = marca && typeof marca === "object" ? marca : {};
  // quem ganhou primeiro: a cópia de quem comprou só diz "também enviamos" se o primeiro e-mail saiu
  for (const d of para) {
    let id = "", status = 0;
    try {
      // o template dentro do try: um template que explode vira "não enviado" no feed, não um erro mudo
      const { subject, html } = valePresenteEmail({ brand, code, cents, recipientName, buyerName, message, para: d.para, recipientContact: d.para === "buyer" && out.sent.some((x) => x.para === "recipient") ? rec : "", lang: brand.lang || "en" });
      const r = await f("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: remetente(env, brand.business), to: d.to, reply_to: tenant, subject, html }),
      });
      status = r.status;
      const j = await r.json().catch(() => null);
      if (r.ok && j && typeof j.id === "string" && j.id) id = j.id;
    } catch { /* fica sem id = não enviado */ }
    if (id) out.sent.push({ to: d.to, para: d.para, id });
    else out.failed.push({ to: d.to, para: d.para, reason: `resend ${status || "sem resposta"}` });
  }
  for (const x of out.sent) await feed(`🎁 Vale ${code} (${valor}) enviado por e-mail a ${x.to}${x.para === "buyer" ? " (quem comprou)" : ""}`, { delivery: "sent", to: x.to, para: x.para, receipt: x.id });
  for (const x of out.failed) await feed(`⚠️ Vale ${code} (${valor}) NÃO enviado a ${x.to} (${x.reason}) — mandar o código à mão`, { delivery: "failed", to: x.to, para: x.para, reason: x.reason });
  return out;
}

// ═══ ESTORNO feito no Stripe PRÓPRIO do negócio (2026-10-05) ═══════════════════════════════════
// A conta própria não manda webhook para nós: estorno feito no painel do Stripe do negócio nunca
// chegava. A conferência de hora em hora pergunta, para as vendas ENTREGUES nos últimos 30 dias
// (venda_online_refund_candidates_svc, lote limitado, a menos conferida primeiro), se a cobrança foi
// estornada. Quem decide "uma vez" é o banco (venda_online_refund_mark_svc, db/desk_v7_6_estorno_proprio.sql):
//   · loja, TOTAL   → a MESMA product_sale_refund_loja do webhook devolve as peças; feed do dono.
//   · loja, PARCIAL → não diz quais peças voltaram: estoque intocado, feed + alarme UMA vez.
//   · pacote / vale → NADA é anulado (pode já ter sessão usada / saldo gasto): UMA linha no feed do dono
//                     "estornado no Stripe — conferir o pacote/vale no Balcão".
// Ler cobrança exige "Charges: Read" na chave restrita. Sem ela: UM aviso por negócio (não um por hora).

/** Parte pura: as cobranças do payment_intent → { estado:"nada"|"parcial"|"total", refunded, total }. */
export function estadoDoEstorno(charges) {
  const pagas = (Array.isArray(charges) ? charges : []).filter((c) => c && (c.status === "succeeded" || c.paid === true));
  const total = pagas.reduce((n, c) => n + Math.max(0, Math.round(Number(c.amount) || 0)), 0);
  const refunded = pagas.reduce((n, c) => n + Math.max(0, Math.round(Number(c.amount_refunded) || 0)), 0);
  if (!(total > 0) || !(refunded > 0)) return { estado: "nada", refunded, total };
  const todas = pagas.every((c) => c.refunded === true);
  return { estado: todas || refunded >= total ? "total" : "parcial", refunded, total };
}

const semPermissao = (r) => r && (r.status === 403 || /required permissions|rak_/i.test(String(r.data?.error?.message || "")));
const dol = (c) => `$${((Number(c) || 0) / 100).toFixed(2)}`;

export async function conferirEstornos(env, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const f = deps.fetch || fetch;
  const alarme = deps.emitFailure || emitFailure;
  const lote = Math.min(Math.max(Number(deps.lote) || 40, 1), 100);
  const lista = await svc(env, "venda_online_refund_candidates_svc", { p_limit: lote });
  if (!Array.isArray(lista)) return { ok: false, error: "nao consegui ler as vendas entregues", detalhe: lista };
  const out = { ok: true, conferidas: 0, sem_estorno: 0, parciais: 0, estornos: 0, ja_tratados: 0, sem_permissao: 0, falhas: 0 };
  const chaves = new Map(); const travados = new Set(); const leram = new Set();
  const marcar = (p, pi, e) => svc(env, "venda_online_refund_mark_svc", {
    p_secret: env.INGEST_SECRET || "", p_tenant: p.tenant, p_session: p.session, p_payment_intent: pi || null,
    p_estado: e.estado, p_refunded_cents: e.refunded || 0, p_total_cents: e.total || 0,
  });
  // falha de leitura só faz a fila andar (refund_checked_at) — nada é dado como estornado ou não estornado
  const girar = (p, pi) => Promise.resolve(marcar(p, pi, { estado: "nada" })).catch(() => null);
  const feed = async (tenant, summary, amount, payload) => {
    const r = await Promise.resolve(svc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: tenant, p_type: "refund", p_channel: "stripe",
      p_summary: String(summary).slice(0, 300), p_amount: amount, p_payload: { via: "stripe_own", ...payload },
    })).catch(() => null);
    if (!r || (typeof r === "object" && r.ok === false)) {
      // o estorno já foi marcado como tratado: sem esta linha ninguém saberia — vira alarme
      await Promise.resolve(alarme(env, "estorno_feed_falhou", tenant, `estorno no Stripe próprio tratado mas a linha do feed do dono NÃO foi gravada: ${String(summary).slice(0, 200)}`, payload)).catch(() => null);
    }
  };

  for (const p of lista.slice(0, lote)) {
    const t = String(p.tenant || "").toLowerCase();
    if (travados.has(t)) { out.sem_permissao++; await girar(p, p.payment_intent); continue; }
    let k = chaves.get(t);
    if (!k) { k = await chaveDoNegocio(env, t, { svcJson: svc }); chaves.set(t, k); }
    if (!k.ok) { out.falhas++; continue; }
    out.conferidas++;
    let pi = String(p.payment_intent || "");
    if (!pi) {
      const ls = await stripe(k.chave, "GET", `/checkout/sessions/${encodeURIComponent(p.session)}`, null, { fetch: f });
      if (!ls.ok) { if (semPermissao(ls)) { travados.add(t); out.sem_permissao++; } else out.falhas++; await girar(p, ""); continue; }
      pi = typeof ls.data?.payment_intent === "string" ? ls.data.payment_intent : String(ls.data?.payment_intent?.id || "");
      if (!/^pi_[A-Za-z0-9_]{6,200}$/.test(pi)) { out.falhas++; await girar(p, ""); continue; }
    }
    const lc = await stripe(k.chave, "GET", `/charges?payment_intent=${encodeURIComponent(pi)}&limit=10`, null, { fetch: f });
    if (!lc.ok || !Array.isArray(lc.data?.data)) {
      if (semPermissao(lc)) { travados.add(t); out.sem_permissao++; } else out.falhas++;
      await girar(p, pi); continue;
    }
    leram.add(t);
    const e = estadoDoEstorno(lc.data.data);
    const mk = await marcar(p, pi, e);
    if (!mk || mk.ok !== true) {
      out.falhas++;
      if (e.estado !== "nada") {
        await Promise.resolve(alarme(env, p.kind === "loja" ? "estorno_loja_estoque" : "estorno_de_venda_do_negocio", t,
          `estorno ${e.estado} (${dol(e.refunded)}) no Stripe PRÓPRIO numa venda de ${p.kind} e NÃO consegui registrar (${mk?.reason || mk?.detalhe || mk?.erro_http || "sem resposta"}) — conferir à mão`,
          { session: p.session, payment_intent: pi, kind: p.kind, detalhe: mk?.detalhe || "" })).catch(() => null);
      }
      continue;
    }
    const base = { session: p.session, payment_intent: pi, kind: p.kind };
    if (mk.acao === "nada") { out.sem_estorno++; continue; }
    if (mk.acao === "ja_tratado" || mk.acao === "parcial_ja") { out.ja_tratados++; continue; }
    const oQue = p.kind === "loja" ? "pedido da loja" : p.kind === "package" ? `pacote${p.package ? ` "${p.package}"` : ""}` : `vale ${p.code || ""}`.trim();
    if (mk.acao === "parcial_novo") {
      out.parciais++;
      if (p.kind === "loja") {
        await feed(t, `↩️ Estorno PARCIAL no Stripe · ${oQue} · -${dol(e.refunded)} de ${dol(e.total)} · estoque NÃO mexido — conferir quais peças voltaram`, -(e.refunded / 100), { ...base, estado: "parcial" });
        await Promise.resolve(alarme(env, "estorno_loja_estoque", t, `estorno parcial de ${dol(e.refunded)} num pedido da loja (Stripe próprio) — estoque NÃO voltou sozinho; conferir e devolver à mão`, base)).catch(() => null);
      } else {
        await feed(t, `↩️ Estorno PARCIAL no Stripe · ${oQue} · -${dol(e.refunded)} de ${dol(e.total)} — conferir o ${p.kind === "package" ? "pacote" : "vale"} no Balcão`, -(e.refunded / 100), { ...base, estado: "parcial" });
      }
      continue;
    }
    if (mk.acao === "total_novo") {
      out.estornos++;
      if (p.kind === "loja") {
        const est = mk.estoque || {};
        const resultado = `devolvido (${Number(est.cancelled) || 0} venda(s), ${Number(est.restocked_units) || 0} peça(s) de volta ao estoque)`;
        await feed(t, `↩️ Estorno de pedido da loja · -${dol(e.refunded)} · estoque: ${resultado}`, -(e.refunded / 100), { ...base, estado: "total", estoque: est });
        if (!(Number(est.cancelled) > 0)) {
          await Promise.resolve(alarme(env, "estorno_loja_estoque", t, `estorno de ${dol(e.refunded)} num pedido da loja (Stripe próprio) — nenhuma venda achada pelo prefixo ${pi}: — estoque NÃO voltou; conferir à mão`, base)).catch(() => null);
        }
      } else {
        await feed(t, `↩️ Estornado no Stripe — conferir o ${p.kind === "package" ? "pacote" : "vale"} no Balcão · ${oQue} · -${dol(e.refunded)} (nada foi cancelado sozinho)`, -(e.refunded / 100), { ...base, estado: "total", ...(p.code ? { code: p.code } : {}) });
      }
      continue;
    }
    out.falhas++;
  }

  // UM aviso por negócio sem "Charges: Read"; quando a leitura volta, a marca some
  for (const t of travados) {
    const a = await svc(env, "venda_online_refund_aviso_svc", { p_tenant: t, p_motivo: "sem_permissao_charges", p_ativo: true });
    if (a && a.novo === true) {
      const r = await Promise.resolve(svc(env, "ingest_client_event", {
        p_secret: env.INGEST_SECRET || "", p_email: t, p_type: "message", p_channel: "stripe",
        p_summary: "⚠️ Estornos no seu Stripe: a chave não deixa a Guileo ler cobranças. Em Stripe → Developers → API keys, edite a chave restrita e marque “Charges: Read” — sem isso, estorno feito no Stripe não devolve estoque nem avisa aqui.",
        p_amount: 0, p_payload: { kind: "estorno_sem_permissao", via: "stripe_own", permissao: nomeDaPermissao("rak_charge_read") },
      })).catch(() => null);
      await Promise.resolve(alarme(env, "estorno_sem_permissao", t, `a chave Stripe própria não tem Charges: Read — estornos feitos no Stripe do negócio não são vistos${!r || r.ok === false ? " (e o aviso ao dono NÃO foi gravado)" : ""}`, {})).catch(() => null);
    } else if (!a || a.ok !== true) out.falhas++;
  }
  for (const t of leram) if (!travados.has(t)) await Promise.resolve(svc(env, "venda_online_refund_aviso_svc", { p_tenant: t, p_motivo: "sem_permissao_charges", p_ativo: false })).catch(() => null);
  return out;
}
