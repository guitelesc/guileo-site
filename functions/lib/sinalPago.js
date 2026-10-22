// CONFERIR UMA SESSÃO DO STRIPE NA CONTA PRÓPRIA DO NEGÓCIO (2026-10-05)
// Conta própria = o webhook da plataforma não fica sabendo. Quem confirma é a PRÓPRIA sessão do
// Stripe, lida com a chave do negócio. Nada vem do navegador: o id da sessão só diz ONDE olhar.
//
// Três tipos de sessão (metadata.guileo), todos com client_email == o negócio da URL:
//   · desk_deposit     — sinal: payment_status === "paid" → desk_deposit_mark. Se o Checkout salvou o
//                        cartão (setup_future_usage=off_session), grava cus_/pm_ na ficha da cliente.
//   · desk_card_setup  — "Salvar cartão": status complete + SetupIntent succeeded → grava na ficha.
//   · desk_membership  — "Vender assinatura": status complete + assinatura → membership_subscribers
//                        (e o cartão da assinatura também fica salvo na ficha).
// O cartão é um EXTRA do sinal: se ler o cartão falhar (ex.: chave sem PaymentIntents: Read), o sinal
// continua marcado como pago e o motivo volta em `cartao`.
import { svcJson } from "./sb.js";

const SESSAO = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
const KINDS = new Set(["desk_deposit", "desk_card_setup", "desk_membership"]);

async function pegar(f, chave, caminho) {
  try {
    const r = await f(`https://api.stripe.com/v1${caminho}`, { headers: { Authorization: `Bearer ${chave}` } });
    const d = await r.json().catch(() => null);
    return r.ok && d ? { ok: true, d } : { ok: false, status: r.status, d };
  } catch { return { ok: false, status: 0, d: null }; }
}

/** PaymentMethod (objeto expandido) → campos do cartão para desk_card_save_svc. */
export function cartaoDoMetodo(pm, customer, extra = {}) {
  if (!pm || typeof pm !== "object" || !pm.id) return null;
  const card = pm.card || {};
  const cus = typeof customer === "string" ? customer : customer?.id || (typeof pm.customer === "string" ? pm.customer : pm.customer?.id) || "";
  if (!/^cus_/.test(cus)) return null;
  return { customer: cus, payment_method: pm.id, brand: card.brand || "", last4: card.last4 || "", exp_month: card.exp_month || null, exp_year: card.exp_year || null, livemode: !!pm.livemode, ...extra };
}

async function salvarCartao(env, svc, { tenant, contact = "", appointmentId = null, card }) {
  if (!card) return { saved: false, motivo: "sem_cartao" };
  const r = await svc(env, "desk_card_save_svc", { p_tenant: tenant, p_contact: contact || "", p_appointment_id: appointmentId, p_card: card });
  return r?.ok === true ? { saved: true, brand: card.brand, last4: card.last4 } : { saved: false, motivo: r?.reason || "nao_gravou" };
}

/** Confere QUALQUER sessão do Desk (sinal, salvar cartão, assinatura). `so` restringe o tipo. */
export async function conferirSessaoDoDesk(env, { tenant, sessionId, so = "" }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const f = deps.fetch || fetch;
  if (!SESSAO.test(String(sessionId || ""))) return { ok: false, reason: "sessao_invalida" };
  const conta = await svc(env, "stripe_own_lookup_svc", { p_tenant: tenant });
  const chave = conta && conta.secret_key;
  if (!chave) return { ok: false, reason: "sem_stripe_proprio" };
  const lida = await pegar(f, chave, `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (!lida.ok) return { ok: false, reason: "stripe_nao_respondeu" };
  const s = lida.d;
  const m = s.metadata || {};
  const kind = String(m.guileo || "");
  if (!KINDS.has(kind) || (so && kind !== so) || String(m.client_email || "").toLowerCase() !== String(tenant).toLowerCase()) return { ok: false, reason: "sessao_de_outro" };

  // ── sinal ───────────────────────────────────────────────────────────────────────────────
  if (kind === "desk_deposit") {
    if (!m.appointment_id) return { ok: false, reason: "sessao_de_outro" };
    if (s.payment_status !== "paid") return { ok: false, reason: "nao_pago", status: s.payment_status };
    const marca = await svc(env, "desk_deposit_mark", { p_tenant: tenant, p_appointment_id: m.appointment_id, p_session: s.id, p_cents: Number(s.amount_total) || 0 });
    if (marca?.ok !== true) return { ok: false, reason: "nao_marcou" };
    let cartao = { saved: false, motivo: "nao_pedido" };
    const piId = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || "";
    if (piId) {
      const pi = await pegar(f, chave, `/payment_intents/${encodeURIComponent(piId)}?expand[]=payment_method`);
      if (!pi.ok) cartao = { saved: false, motivo: pi.status === 403 ? "permission_missing" : "stripe_nao_respondeu" };
      else if (pi.d.setup_future_usage !== "off_session") cartao = { saved: false, motivo: "nao_pedido" };
      else cartao = await salvarCartao(env, svc, { tenant, appointmentId: m.appointment_id, card: cartaoDoMetodo(pi.d.payment_method, pi.d.customer || s.customer, { source: "deposit", session_id: s.id }) });
    }
    return { ok: true, kind: "deposit", appointment_id: m.appointment_id, cents: Number(s.amount_total) || 0, cartao };
  }

  if (s.status !== "complete") return { ok: false, reason: "nao_pago", status: s.status };

  // ── salvar cartão ───────────────────────────────────────────────────────────────────────
  if (kind === "desk_card_setup") {
    const siId = typeof s.setup_intent === "string" ? s.setup_intent : s.setup_intent?.id || "";
    if (!siId) return { ok: false, reason: "sem_setup_intent" };
    const si = await pegar(f, chave, `/setup_intents/${encodeURIComponent(siId)}?expand[]=payment_method`);
    if (!si.ok) return { ok: false, reason: si.status === 403 ? "permission_missing" : "stripe_nao_respondeu" };
    if (si.d.status !== "succeeded") return { ok: false, reason: "nao_pago", status: si.d.status };
    const cartao = await salvarCartao(env, svc, { tenant, contact: m.contact, card: cartaoDoMetodo(si.d.payment_method, si.d.customer || s.customer, { source: "setup", session_id: s.id }) });
    if (!cartao.saved) return { ok: false, reason: "nao_gravou", cartao };
    await svc(env, "desk_stripe_session_done_svc", { p_tenant: tenant, p_session: s.id, p_result: { kind: "card", ...cartao } });
    return { ok: true, kind: "card", cartao };
  }

  // ── assinatura ──────────────────────────────────────────────────────────────────────────
  const subId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id || "";
  if (!subId || !m.membership_id) return { ok: false, reason: "sem_assinatura" };
  const sub = await pegar(f, chave, `/subscriptions/${encodeURIComponent(subId)}?expand[]=default_payment_method`);
  // sem Subscriptions: Read ainda dá para gravar (a sessão completa já diz que assinou); status = active
  const status = sub.ok ? String(sub.d.status || "active") : "active";
  const rec = await svc(env, "desk_membership_record_svc", { p_tenant: tenant, p_membership_id: m.membership_id, p_contact: m.contact || "", p_sub_id: subId, p_status: status });
  if (rec?.ok !== true) return { ok: false, reason: rec?.reason || "nao_gravou" };
  const cartao = sub.ok
    ? await salvarCartao(env, svc, { tenant, contact: m.contact, card: cartaoDoMetodo(sub.d.default_payment_method, sub.d.customer || s.customer, { source: "membership", session_id: s.id }) })
    : { saved: false, motivo: sub.status === 403 ? "permission_missing" : "stripe_nao_respondeu" };
  await svc(env, "desk_stripe_session_done_svc", { p_tenant: tenant, p_session: s.id, p_result: { kind: "membership", subscription: subId, status, cartao } });
  if (rec.new && env.INGEST_SECRET) {
    await Promise.resolve(svc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET, p_email: tenant, p_type: "payment", p_channel: "desk",
      p_summary: `⭐ Nova assinatura: ${m.contact || "cliente"} (${status})`.slice(0, 300), p_amount: (Number(s.amount_total) || 0) / 100,
      p_payload: { kind: "membership", membership_id: m.membership_id, subscription: subId, status } })).catch(() => null);
  }
  return { ok: true, kind: "membership", subscription: subId, status, membership_subscriber: rec.id, cartao };
}

/** O sinal (compatível com quem já chamava): só aceita sessão desk_deposit. */
export function conferirSessaoDoSinal(env, { tenant, sessionId }, deps = {}) {
  return conferirSessaoDoDesk(env, { tenant, sessionId, so: "desk_deposit" }, deps);
}
