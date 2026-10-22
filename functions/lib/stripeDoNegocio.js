// CARTÃO SALVO, TAXA DE FALTA E ASSINATURA DA CLIENTE — no Stripe DO NEGÓCIO (2026-10-05)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Quem chama: /api/desk-pagamentos (o balcão). A confirmação na volta da cliente é do
// lib/sinalPago.js (conferirSessaoDoDesk), que lê a SESSÃO no Stripe com a chave do negócio.
//
// POR QUÊ SÓ A CHAVE PRÓPRIA: a plataforma Stripe da Guileo é BR e não repassa para conta dos EUA
// (ATIVACOES.md "NATURA · Stripe próprio"). Cobrar um cartão salvo FORA da sessão só funciona na
// conta onde o cartão foi salvo — a do negócio. Sem chave própria → `payments_not_connected`, sempre.
// Nada aqui finge: sucesso só com o PaymentIntent "succeeded" / a sessão criada (com url).
//
// MOTIVOS QUE A TELA RECEBE (src/portal/deskApi.js traduz):
//   payments_not_connected · no_saved_card · no_fee_configured · not_no_show · card_declined (+detail
//   = a mensagem do banco, +codigo) · permission_missing (+permissao = o nome EXATO no painel do
//   Stripe) · stripe_rejected_key · stripe_error · no_contact · membership_not_found · membership_price
//   cancelamento em cima da hora (v6): not_cancelled · cancel_time_unknown · not_late_cancel (+why:
//   no_window | outside_window | expired_hold) · noshow_fee_charged
//   (DeskPagamentosOnline.jsx traduz estes; o resto vem do deskApi.js)
import { svcJson } from "./sb.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API = "https://api.stripe.com/v1";
// contato válido para a ficha: e-mail, ou 7+ dígitos (mesma regra do _desk_ck do banco)
export const contatoValido = (c) => EMAIL.test(String(c || "").trim()) || String(c || "").replace(/\D/g, "").length >= 7;

// ── permissão que falta, no nome que a dona vê no painel do Stripe ────────────────────────────
// O Stripe responde 403 com "...Having the 'rak_payment_intent_write' permission would allow this
// request to continue." — o nome técnico vira o rótulo da tela "Create restricted key".
const PERMISSOES = {
  rak_checkout_session_write: "Checkout Sessions: Write", rak_checkout_session_read: "Checkout Sessions: Read",
  rak_customer_write: "Customers: Write", rak_customer_read: "Customers: Read",
  rak_payment_intent_write: "PaymentIntents: Write", rak_payment_intent_read: "PaymentIntents: Read",
  rak_setup_intent_write: "SetupIntents: Write", rak_setup_intent_read: "SetupIntents: Read",
  rak_payment_method_write: "PaymentMethods: Write", rak_payment_method_read: "PaymentMethods: Read",
  rak_subscription_write: "Subscriptions: Write", rak_subscription_read: "Subscriptions: Read",
  rak_product_write: "Products: Write", rak_plan_write: "Prices: Write",
  rak_charge_read: "Charges: Read",   // conferência de estornos (vendaOnlineNegocio.js · conferirEstornos)
};
export const nomeDaPermissao = (rak) => PERMISSOES[rak] || rak;

/** Resposta de erro do Stripe → motivo honesto para a tela. Pura (testada). */
export function motivoDoStripe(status, data) {
  const err = (data && data.error) || {};
  const msg = String(err.message || "").slice(0, 240);
  if (status === 401) return { reason: "stripe_rejected_key", detail: msg };
  const rak = (msg.match(/'(rak_[a-z_]+)'/) || [])[1] || "";
  if (status === 403 || /required permissions/i.test(msg)) {
    return { reason: "permission_missing", permissao: rak ? nomeDaPermissao(rak) : "", rak, detail: msg };
  }
  if (status === 402 || err.type === "card_error") {
    return { reason: "card_declined", detail: msg, codigo: String(err.decline_code || err.code || "").slice(0, 60) };
  }
  return { reason: "stripe_error", detail: msg || `stripe ${status}` };
}

/** POST/GET no Stripe com a chave do negócio. → { ok, status, data } — nunca lança. */
export async function stripe(chave, metodo, caminho, form = null, { idem = "", fetch: f = fetch } = {}) {
  const headers = { Authorization: `Bearer ${chave}` };
  if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idem) headers["Idempotency-Key"] = idem;
  try {
    const r = await f(`${API}${caminho}`, { method: metodo, headers, ...(form ? { body: new URLSearchParams(form).toString() } : {}) });
    const data = await r.json().catch(() => ({}));
    return { ok: !!r.ok, status: r.status, data };
  } catch (e) { return { ok: false, status: 0, data: { error: { message: String(e).slice(0, 120) } } }; }
}

/** A chave PRÓPRIA do negócio (só ela). → { ok, chave, livemode } | { ok:false, reason } */
export async function chaveDoNegocio(env, tenant, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const conta = await svc(env, "stripe_own_lookup_svc", { p_tenant: tenant });
  const chave = String((conta && typeof conta === "object" && conta.secret_key) || "");
  if (!/^(rk|sk)_(live|test)_/.test(chave)) return { ok: false, reason: "payments_not_connected" };
  return { ok: true, chave, livemode: chave.includes("_live_") };
}

/** Cartão salvo desta cliente que SERVE para esta chave (teste × produção não se misturam). */
export async function cartaoDaCliente(env, { tenant, contact, livemode }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  if (!contatoValido(contact)) return null;
  const r = await svc(env, "desk_card_get_svc", { p_tenant: tenant, p_contact: String(contact) });
  const c = r && r.card;
  if (!c || !c.customer || !c.payment_method) return null;
  if (livemode != null && !!c.livemode !== !!livemode) return null;
  return c;
}

const voltaDoStripe = (tenant) => `https://guileoai.com/api/sinal-pago?t=${encodeURIComponent(tenant)}&s={CHECKOUT_SESSION_ID}`;
const expira = () => String(Math.floor(Date.now() / 1000) + 23 * 3600);   // link vale 23h (máximo do Stripe é 24h)

// Sem cliente no Stripe ainda: cria (precisa de Customers: Write). No modo "setup" o Checkout NÃO cria
// cliente sozinho — sem cliente o cartão não fica preso a ninguém e não dá para cobrar depois.
async function clienteNoStripe(chave, { tenant, contact, name }, deps) {
  const form = { "metadata[guileo]": "desk", "metadata[client_email]": tenant, "metadata[contact]": String(contact).slice(0, 160) };
  if (name) form.name = String(name).slice(0, 120);
  if (EMAIL.test(String(contact).trim())) form.email = String(contact).trim().toLowerCase();
  else form.phone = String(contact).slice(0, 30);
  // mesma cliente em 24h = o MESMO cliente no Stripe (clique duplo não cria dois)
  const ck = EMAIL.test(String(contact).trim()) ? String(contact).trim().toLowerCase() : String(contact).replace(/\D/g, "").slice(-10);
  const r = await stripe(chave, "POST", "/customers", form, { fetch: deps.fetch || fetch, idem: `desk-cus-${tenant}-${ck}` });
  if (!r.ok || !/^cus_/.test(String(r.data?.id || ""))) return { ok: false, ...motivoDoStripe(r.status, r.data) };
  return { ok: true, id: r.data.id };
}

/**
 * "Salvar cartão": um Checkout mode=setup no Stripe do negócio, para a cliente abrir e cadastrar o
 * cartão. Volta por /api/sinal-pago (grava na ficha) e a conferência de hora em hora pega quem fechou
 * a aba. → { ok, url, id } | { ok:false, reason, ... }
 */
export async function linkSalvarCartao(env, { tenant, contact = "", name = "" }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  if (!contatoValido(contact)) return { ok: false, reason: "no_contact" };
  const k = await chaveDoNegocio(env, tenant, deps);
  if (!k.ok) return k;
  const ja = await cartaoDaCliente(env, { tenant, contact, livemode: k.livemode }, deps);
  let customer = ja?.customer || "";
  if (!customer) {
    const c = await clienteNoStripe(k.chave, { tenant, contact, name }, deps);
    if (!c.ok) return c;
    customer = c.id;
  }
  const meta = { guileo: "desk_card_setup", client_email: tenant, contact: String(contact).slice(0, 160) };
  const form = {
    mode: "setup", customer, "payment_method_types[0]": "card",
    success_url: voltaDoStripe(tenant), cancel_url: "https://guileoai.com/api/obrigado?o=cancel", expires_at: expira(),
  };
  for (const [a, v] of Object.entries(meta)) { form[`metadata[${a}]`] = v; form[`setup_intent_data[metadata][${a}]`] = v; }
  const r = await stripe(k.chave, "POST", "/checkout/sessions", form, { fetch: deps.fetch || fetch });
  if (!r.ok || !r.data?.url) return { ok: false, ...motivoDoStripe(r.status, r.data) };
  const reg = await svc(env, "desk_stripe_session_add_svc", { p_tenant: tenant, p_session: r.data.id, p_kind: "card_setup", p_contact: String(contact), p_membership_id: null });
  return { ok: true, url: r.data.url, id: r.data.id, conferencia: reg?.ok === true };
}

/**
 * Taxa de falta: cobra o cartão salvo FORA da sessão (off_session) no Stripe do negócio.
 * Valor = cadastro do serviço (config.noshow_fee_cents). Uma cobrança por agendamento:
 *   · o banco diz se já foi paga (não cobra de novo);
 *   · Idempotency-Key = agendamento + cartão → clique duplo / queda de rede = o MESMO PaymentIntent.
 * Grava o resultado no agendamento (attributes.noshow_fee) e no feed do dono.
 */
export async function cobrarTaxaDeFalta(env, { tenant, appointmentId }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const info = await svc(env, "desk_noshow_info_svc", { p_tenant: tenant, p_id: appointmentId });
  if (!info || info.ok !== true) return { ok: false, reason: "not_found" };
  if (info.status !== "no_show") return { ok: false, reason: "not_no_show" };
  const cents = Math.round(Number(info.fee_cents) || 0);
  if (info.charged) return { ok: true, already: true, cents: Number(info.fee?.cents) || cents, payment_intent: info.fee?.payment_intent || "" };
  if (cents < 50) return { ok: false, reason: "no_fee_configured" };
  return cobrarNoCartaoSalvo(env, svc, deps, { tenant, appointmentId, info, cents, tipo: TAXAS.falta });
}

// As duas taxas cobradas no cartão salvo: o que muda é o nome, a marca no agendamento e a chave de idempotência.
const TAXAS = {
  falta: { kind: "noshow_fee", guileo: "desk_noshow_fee", idem: "desk-noshow", marca: "desk_noshow_fee_mark_svc", descricao: "No-show fee", nome: "Taxa de falta" },
  cancelamento: { kind: "late_cancel_fee", guileo: "desk_late_cancel_fee", idem: "desk-latecancel", marca: "desk_late_cancel_fee_mark_svc", descricao: "Late cancellation fee", nome: "Taxa de cancelamento em cima da hora" },
};

// Núcleo da cobrança off_session (já decidido que é para cobrar `cents` neste agendamento).
async function cobrarNoCartaoSalvo(env, svc, deps, { tenant, appointmentId, info, cents, tipo }) {
  const k = await chaveDoNegocio(env, tenant, deps);
  if (!k.ok) return k;
  const c = info.card;
  if (!c || !c.customer || !c.payment_method || !!c.livemode !== k.livemode) return { ok: false, reason: "no_saved_card", cents };
  const form = {
    amount: String(cents), currency: "usd", customer: c.customer, payment_method: c.payment_method,
    "payment_method_types[0]": "card", off_session: "true", confirm: "true",
    description: `${tipo.descricao} · ${String(info.service || "Appointment").slice(0, 80)}`,
    "metadata[guileo]": tipo.guileo, "metadata[client_email]": tenant, "metadata[appointment_id]": appointmentId,
  };
  const r = await stripe(k.chave, "POST", "/payment_intents", form, { fetch: deps.fetch || fetch, idem: `${tipo.idem}-${appointmentId}-${c.payment_method}` });
  const cartao = `${String(c.brand || "card").toUpperCase()} •••• ${c.last4 || "????"}`;
  const quem = info.customer_name || "Cliente";
  if (r.ok && r.data?.status === "succeeded") {
    const pi = String(r.data.id || "");
    const marca = await svc(env, tipo.marca, { p_tenant: tenant, p_id: appointmentId, p_result: { status: "paid", payment_intent: pi, cents, card: cartao } });
    await evento(env, svc, tenant, `💳 ${tipo.nome} cobrada: ${quem} · ${cartao}`, cents / 100, { kind: tipo.kind, appointment_id: appointmentId, payment_intent: pi, status: "paid" });
    return { ok: true, cents, payment_intent: pi, card: cartao, gravado: marca?.ok === true };
  }
  const m = r.ok ? { reason: r.data?.status === "processing" ? "processing" : "card_declined", detail: `status ${r.data?.status || "?"}` } : motivoDoStripe(r.status, r.data);
  await svc(env, tipo.marca, { p_tenant: tenant, p_id: appointmentId, p_result: { status: "failed", reason: m.reason, detail: m.detail || "", codigo: m.codigo || "", payment_intent: String(r.data?.error?.payment_intent?.id || r.data?.id || "") } });
  await evento(env, svc, tenant, `💳 ${tipo.nome} NÃO cobrada: ${quem} · ${m.reason}${m.permissao ? ` (${m.permissao})` : ""}`, 0, { kind: tipo.kind, appointment_id: appointmentId, status: "failed", reason: m.reason, detail: m.detail || "" });
  return { ok: false, cents, ...m };
}

// ═══ CANCELAMENTO EM CIMA DA HORA (2026-10-05, db/desk_v6_cancelamento.sql) ═════════════════════
// O banco guarda QUANDO cancelou (attributes.cancelled_at, gatilho em biz_appointments) e QUEM
// (cliente pelo link · balcao · ia · expirou · desconhecido). Tardio = cancelou a menos de
// cancel_window_h horas do início (ou depois do início). Sem janela no serviço não há "tardio".
// Valor: NÃO existe campo próprio de taxa de cancelamento no cadastro — é a MESMA taxa de falta
// (config.noshow_fee_cents). A tela e o ATIVACOES.md dizem isso.

/** Fatos do agendamento → é cancelamento tardio? Pura (testada). → { late, horas_antes, janela_h, why } */
export function cancelamentoTardio(info) {
  const janela = Math.max(0, Number(info?.window_h) || 0);
  if (!info || !["cancelled", "canceled"].includes(info.status)) return { late: false, why: "not_cancelled", janela_h: janela };
  if (info.cancelled_by === "expirou") return { late: false, why: "expired_hold", janela_h: janela };
  const quando = Date.parse(info.cancelled_at || ""), ini = Date.parse(info.start || "");
  if (!Number.isFinite(quando) || !Number.isFinite(ini)) return { late: false, why: "cancel_time_unknown", janela_h: janela };
  const horas = Math.round(((ini - quando) / 3600000) * 10) / 10;   // negativo = cancelou depois do início
  if (!janela) return { late: false, why: "no_window", horas_antes: horas, janela_h: 0 };
  if (horas >= janela) return { late: false, why: "outside_window", horas_antes: horas, janela_h: janela };
  return { late: true, why: null, horas_antes: horas, janela_h: janela };
}

/** Taxa de cancelamento tardio no cartão salvo: mesmas regras e idempotência da taxa de falta. */
export async function cobrarTaxaDeCancelamento(env, { tenant, appointmentId }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const info = await svc(env, "desk_late_cancel_info_svc", { p_tenant: tenant, p_id: appointmentId });
  if (!info || info.ok !== true) return { ok: false, reason: "not_found" };
  const t = cancelamentoTardio(info);
  if (t.why === "not_cancelled") return { ok: false, reason: "not_cancelled" };
  const cents = Math.round(Number(info.fee_cents) || 0);
  if (info.charged) return { ok: true, already: true, cents: Number(info.fee?.cents) || cents, payment_intent: info.fee?.payment_intent || "" };
  if (info.noshow_paid) return { ok: false, reason: "noshow_fee_charged" };   // a taxa de falta já foi paga neste agendamento
  if (t.why === "cancel_time_unknown") return { ok: false, reason: "cancel_time_unknown" };
  if (!t.late) return { ok: false, reason: "not_late_cancel", why: t.why, horas_antes: t.horas_antes ?? null, janela_h: t.janela_h };
  if (cents < 50) return { ok: false, reason: "no_fee_configured" };
  const r = await cobrarNoCartaoSalvo(env, svc, deps, { tenant, appointmentId, info, cents, tipo: TAXAS.cancelamento });
  return { ...r, horas_antes: t.horas_antes, janela_h: t.janela_h, fee_from: "noshow_fee_cents" };
}

// ═══ ASSINATURA EM DIA (conferência de hora em hora, /api/sinal-reconcile) ═════════════════════
// A assinatura vive no Stripe DO NEGÓCIO e o webhook é da conta dele: a gente não fica sabendo quando
// ela é cancelada ou o cartão falha. Aqui: até 50 por rodada (a conferida há mais tempo primeiro), GET
// /v1/subscriptions/<sub> com a chave do negócio, grava o status e avisa no feed quando MUDA. Falha de
// leitura também vai ao feed (uma vez por motivo novo, não a cada hora).
const STATUS_LOCAL = { active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", incomplete: "past_due", canceled: "canceled", incomplete_expired: "canceled", paused: "paused" };
export const statusLocalDaAssinatura = (s) => STATUS_LOCAL[String(s || "")] || null;
const SUB = /^sub_[A-Za-z0-9]{6,80}$/;
const NOME_STATUS = { active: "ativa", past_due: "pagamento atrasado", canceled: "cancelada", paused: "pausada" };
// motivo que para o negócio inteiro nesta rodada (não adianta tentar as outras assinaturas dele)
const PARA_O_NEGOCIO = new Set(["payments_not_connected", "permission_missing", "stripe_rejected_key"]);

export async function conferirAssinaturas(env, deps = {}, { limite = 50 } = {}) {
  const svc = deps.svcJson || svcJson;
  const lista = await svc(env, "desk_membership_sync_list_svc", { p_limit: Math.min(Math.max(Number(limite) || 50, 1), 50) });
  if (!Array.isArray(lista)) return { ok: false, leitura: "falhou", conferidas: 0, mudaram: 0, falhas: 0 };
  const out = { ok: true, leitura: "ok", conferidas: 0, mudaram: 0, falhas: 0, motivos: {} };
  const porNegocio = new Map();
  for (const x of lista.slice(0, 50)) { if (!porNegocio.has(x.tenant)) porNegocio.set(x.tenant, []); porNegocio.get(x.tenant).push(x); }
  for (const [tenant, linhas] of porNegocio) {
    const k = await chaveDoNegocio(env, tenant, deps);
    let parou = k.ok ? null : { reason: k.reason };
    const novasFalhas = [];
    for (const x of linhas) {
      out.conferidas++;
      let falha = parou;
      let stripeStatus = "";
      if (!falha && !SUB.test(String(x.sub || ""))) falha = { reason: "invalid_subscription" };
      if (!falha) {
        const r = await stripe(k.chave, "GET", `/subscriptions/${x.sub}`, null, { fetch: deps.fetch || fetch });
        if (r.ok && r.data?.id === x.sub) stripeStatus = String(r.data.status || "");
        else {
          falha = r.status === 404 ? { reason: "not_found_on_stripe", detail: String(r.data?.error?.message || "").slice(0, 200) } : motivoDoStripe(r.status, r.data);
          if (PARA_O_NEGOCIO.has(falha.reason)) parou = falha;
        }
      }
      if (falha) {
        out.falhas++; out.motivos[falha.reason] = (out.motivos[falha.reason] || 0) + 1;
        await svc(env, "desk_membership_sync_mark_svc", { p_tenant: tenant, p_id: x.id, p_status: null,
          p_check: { ok: false, reason: falha.reason, detail: falha.detail || "", permissao: falha.permissao || "" } });
        if (x.last?.reason !== falha.reason) novasFalhas.push({ x, falha });
        continue;
      }
      const local = statusLocalDaAssinatura(stripeStatus);
      const m = await svc(env, "desk_membership_sync_mark_svc", { p_tenant: tenant, p_id: x.id, p_status: local, p_check: { ok: true, stripe_status: stripeStatus } });
      if (m && m.changed) {
        out.mudaram++;
        await evento(env, svc, tenant, `⭐ Assinatura ${x.membership ? `"${x.membership}" ` : ""}de ${x.contact || "cliente"}: ${NOME_STATUS[m.old] || m.old} → ${NOME_STATUS[m.new] || m.new} (Stripe: ${stripeStatus})`, 0,
          { kind: "membership_status", membership_subscriber: x.id, subscription: x.sub, from: m.old, to: m.new, stripe_status: stripeStatus });
      }
    }
    // uma linha no feed por negócio, só quando o motivo é NOVO (não repete de hora em hora)
    if (novasFalhas.length) {
      const f = novasFalhas[0].falha;
      await evento(env, svc, tenant, `⚠ Não consegui conferir ${novasFalhas.length} assinatura(s) no seu Stripe: ${f.reason}${f.permissao ? ` (falta a permissão ${f.permissao})` : ""}`, 0,
        { kind: "membership_sync_failed", reason: f.reason, permissao: f.permissao || "", detail: f.detail || "", subscriptions: novasFalhas.map((n) => n.x.sub).slice(0, 20) });
    }
  }
  return out;
}

/**
 * "Vender assinatura": Checkout mode=subscription com price_data no Stripe do negócio, a partir de
 * uma assinatura cadastrada (memberships). A volta grava em membership_subscribers.
 */
export async function linkAssinatura(env, { tenant, membershipId, contact = "" }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const lista = await svc(env, "desk_membership_list_svc", { p_tenant: tenant });
  const m = Array.isArray(lista) ? lista.find((x) => x.id === membershipId) : null;
  if (!m) return { ok: false, reason: "membership_not_found" };
  const cents = Math.round(Number(m.price_cents) || 0);
  if (cents < 50) return { ok: false, reason: "membership_price" };
  if (!contatoValido(contact)) return { ok: false, reason: "no_contact" };
  const k = await chaveDoNegocio(env, tenant, deps);
  if (!k.ok) return k;
  const ja = await cartaoDaCliente(env, { tenant, contact, livemode: k.livemode }, deps);
  const meta = { guileo: "desk_membership", client_email: tenant, membership_id: m.id, contact: String(contact).slice(0, 160) };
  const form = {
    mode: "subscription",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][recurring][interval]": m.interval === "year" ? "year" : "month",
    "line_items[0][price_data][product_data][name]": String(m.name || "Membership").slice(0, 100),
    success_url: voltaDoStripe(tenant), cancel_url: "https://guileoai.com/api/obrigado?o=cancel", expires_at: expira(),
  };
  if (ja?.customer) form.customer = ja.customer;
  else if (EMAIL.test(String(contact).trim())) form.customer_email = String(contact).trim().toLowerCase();
  for (const [a, v] of Object.entries(meta)) { form[`metadata[${a}]`] = v; form[`subscription_data[metadata][${a}]`] = v; }
  const r = await stripe(k.chave, "POST", "/checkout/sessions", form, { fetch: deps.fetch || fetch });
  if (!r.ok || !r.data?.url) return { ok: false, ...motivoDoStripe(r.status, r.data) };
  const reg = await svc(env, "desk_stripe_session_add_svc", { p_tenant: tenant, p_session: r.data.id, p_kind: "membership", p_contact: String(contact), p_membership_id: m.id });
  return { ok: true, url: r.data.url, id: r.data.id, cents, interval: form["line_items[0][price_data][recurring][interval]"], conferencia: reg?.ok === true };
}

// Feed do dono (ingest_client_event). Falha do feed não desfaz a cobrança — a cobrança já está no
// agendamento (attributes.noshow_fee) e no Stripe.
async function evento(env, svc, tenant, summary, amount, payload) {
  if (!env.INGEST_SECRET) return null;
  return Promise.resolve(svc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET, p_email: tenant, p_type: "payment", p_channel: "desk",
    p_summary: String(summary).slice(0, 300), p_amount: amount, p_payload: payload })).catch(() => null);
}
export { evento as eventoDoDesk };
