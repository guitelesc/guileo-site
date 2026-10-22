// O SINAL DO AGENDAMENTO — gerar o link e ENTREGAR (2026-10-05)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Quem chama: a agente (agent-schedule.js, logo depois de marcar) e a recepção (/api/desk).
//
// POR QUE NO SERVIDOR E NÃO COMO FERRAMENTA DA AGENTE: as ligações já mostraram a agente dizendo
// "te mandei a confirmação" sem ter chamado nada. Aqui ela não precisa lembrar de nada: marcou um
// serviço com sinal → o servidor gera e manda, e devolve uma frase que só diz "mandei" quando há
// COMPROVANTE do envio (id da mensagem). Sem comprovante, a frase não promete e o dono é avisado.
//
// REGRAS
//   · Valor vem do CADASTRO do serviço (deposit_cents, ou deposit_pct do preço). Nunca do pedido.
//   · Cliente de confiança (ficha → "cliente de confiança") não paga sinal.
//   · Uma vez por agendamento: se o link já foi enviado, não manda de novo (a não ser `reenviar`).
//   · Dinheiro vai para a conta Stripe DO NEGÓCIO (lib/contaDoCliente.js). Sem conta → não existe link.
//   · Canais: texto (WhatsApp do negócio com modelo "deposit" aprovado → SMS A2P) e e-mail. Cada
//     um só conta como enviado com o id que o provedor devolveu.
//   · Conta própria: o sinal também SALVA o cartão (setup_future_usage=off_session) para a taxa de falta.
import { svcJson } from "./sb.js";
import { contaParaSinal, camposDoDestino } from "./contaDoCliente.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BR_TZ = /Sao_Paulo|Cuiaba|Fortaleza|Recife|Bahia|Manaus|Belem|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Maceio|Noronha/;
const L3 = (lang) => { const l = String(lang || "").toLowerCase().slice(0, 2); return l === "pt" || l === "es" ? l : "en"; };
const LOCALE = { pt: "pt-BR", es: "es-ES", en: "en-US" };
const SLUG = /^[a-z0-9-]{2,60}$/;

export const valorDoSinal = (cents, lang = "en", tz = "America/New_York") =>
  new Intl.NumberFormat(LOCALE[L3(lang)], { style: "currency", currency: BR_TZ.test(tz) ? "BRL" : "USD" }).format((Number(cents) || 0) / 100);

/**
 * Cria a sessão do Stripe para o sinal de UM agendamento.
 * → { ok:true, url, id, cents, info } · { ok:false, reason }   reason ∈ not_found | already_paid |
 *   trusted | no_deposit_configured | payments_not_connected | stripe_error
 */
export async function criarLinkDoSinal(env, { tenant, appointmentId, reenviar = false, volta = "", lang = "" }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const info = await svc(env, "desk_deposit_info_svc", { p_tenant: tenant, p_id: appointmentId });
  if (!info || info.ok !== true) return { ok: false, reason: "not_found" };
  if (info.deposit_paid) return { ok: false, reason: "already_paid", info };
  if (info.trusted) return { ok: false, reason: "trusted", info };
  // já mandado: não abre outra sessão no Stripe nem manda de novo (só a recepção pede reenvio)
  if (info.deposit_link_sent_at && !reenviar) return { ok: false, reason: "already_sent", info };
  const cents = Math.round(Number(info.deposit_cents) || 0);
  if (cents < 50) return { ok: false, reason: "no_deposit_configured", info };
  const destino = await (deps.contaDePagamento || contaParaSinal)(env, tenant, deps);
  if (!destino || destino.modo === "sem_conta") return { ok: false, reason: "payments_not_connected", info };
  // conta PRÓPRIA do negócio: a sessão nasce nela (chave dela). Senão, a plataforma com destino.
  const chave = destino.modo === "propria" ? destino.chave : env.STRIPE_SECRET_KEY;
  if (!chave) return { ok: false, reason: "payments_not_connected", info };
  const form = {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][product_data][name]": `Deposit · ${String(info.service || "Appointment").slice(0, 100)}`,
    // Conta própria: o webhook da plataforma NÃO recebe esse pagamento — a volta da cliente passa por
    // /api/sinal-pago, que confere a sessão NA conta do negócio e marca o sinal (e o cron confere de novo).
    // `volta` (só a página pública /agendar manda): a página de volta ganha "voltar para o agendamento" e o
    // idioma em que a cliente marcou. Sem `volta` (agente, balcão) a URL é exatamente a de antes.
    success_url: destino.modo === "propria"
      ? `https://guileoai.com/api/sinal-pago?t=${encodeURIComponent(tenant)}&s={CHECKOUT_SESSION_ID}${SLUG.test(String(volta || "")) ? `&v=${volta}&l=${L3(lang)}` : ""}`
      : "https://guileoai.com/api/obrigado?o=ok",
    cancel_url: "https://guileoai.com/api/obrigado?o=cancel",
    "metadata[guileo]": "desk_deposit", "metadata[client_email]": tenant, "metadata[appointment_id]": appointmentId,
    "payment_intent_data[metadata][guileo]": "desk_deposit", "payment_intent_data[metadata][client_email]": tenant, "payment_intent_data[metadata][appointment_id]": appointmentId,
    allow_promotion_codes: "false",
    // O link vale 23h: o horário não fica pendurado num link eterno.
    expires_at: String(Math.floor(Date.now() / 1000) + 23 * 3600),
  };
  Object.assign(form, camposDoDestino(destino, { assinatura: false, cents, feePct: parseFloat(env.GUILEO_FEE_PCT || "0") }));
  // CARTÃO SALVO (2026-10-05): na conta PRÓPRIA, o sinal também guarda o cartão para depois (taxa de
  // falta, lib/stripeDoNegocio.js). O Checkout mostra à cliente o aviso de uso futuro. Cliente que já
  // tem cartão salvo nesta conta (mesmo modo teste/produção) reaproveita o cliente do Stripe; senão o
  // Checkout cria um. A volta (/api/sinal-pago) grava cus_/pm_ na ficha. Na conta da plataforma NÃO:
  // um cartão salvo lá não serve para cobrar na conta do negócio.
  if (destino.modo === "propria") {
    form["payment_intent_data[setup_future_usage]"] = "off_session";
    const live = String(chave).includes("_live_");
    const salvo = info.customer_contact ? await svc(env, "desk_card_get_svc", { p_tenant: tenant, p_contact: String(info.customer_contact) }) : null;
    const cus = salvo && salvo.card && !!salvo.card.livemode === live ? String(salvo.card.customer || "") : "";
    if (/^cus_[A-Za-z0-9]+$/.test(cus)) form.customer = cus; else form.customer_creation = "always";
  }
  const f = deps.fetch || fetch;
  const abrir = (corpo) => f("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(corpo).toString(),
  });
  try {
    let sr = await abrir(form);
    let sd = await sr.json().catch(() => ({}));
    let semCartao = false;
    // Chave sem a permissão de cliente (só "Checkout Sessions: Write", como pedia o guia antigo): o
    // SINAL não pode parar por causa do extra. Tenta de novo sem salvar o cartão e diz isso no retorno.
    if (sr.status === 403 && destino.modo === "propria" && (form.customer || form.customer_creation)) {
      const simples = { ...form };
      delete simples.customer; delete simples.customer_creation; delete simples["payment_intent_data[setup_future_usage]"];
      sr = await abrir(simples); sd = await sr.json().catch(() => ({})); semCartao = true;
    }
    if (!sr.ok || !sd.url) return { ok: false, reason: "stripe_error", detail: String(sd?.error?.message || sr.status).slice(0, 160), info };
    return { ok: true, url: sd.url, id: sd.id || "", cents, info, ...(semCartao ? { cartao: "permission_missing" } : {}) };
  } catch (e) { return { ok: false, reason: "stripe_error", detail: String(e).slice(0, 120), info }; }
}

/**
 * Gera e ENTREGA. → { ok, reason?, cents, enviado:{ texto:{sent,canal,id,motivo}, email:{sent,id,motivo} }, url? }
 * `ok` = pelo menos UM canal tem comprovante.
 */
export async function mandarLinkDoSinal(env, { tenant, appointmentId, contact = "", email = "", name = "", service = "", whenLabel = "", business = "", lang = "en", tz = "America/New_York", de = "", reenviar = false }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  const link = await criarLinkDoSinal(env, { tenant, appointmentId, reenviar }, deps);
  if (!link.ok) return { ok: false, reason: link.reason, cents: Number(link.info?.deposit_cents) || 0 };
  const amount = valorDoSinal(link.cents, lang, tz);
  const dados = { name, business, service: service || link.info?.service || "", whenLabel, amount, link: link.url };
  const enviado = { texto: { sent: false }, email: { sent: false } };

  const fone = String(contact || link.info?.customer_contact || "");
  if (fone && !EMAIL.test(fone)) {
    try {
      const { entregarAviso } = deps.aviso || (await import("./avisoPorTexto.js"));
      const r = await entregarAviso(env, { tenant, phone: fone, kind: "deposit", dados, lang: L3(lang), tz, de });
      enviado.texto = r.sent ? { sent: true, canal: r.canal, id: r.id } : { sent: false, motivo: r.motivo };
    } catch (e) { enviado.texto = { sent: false, motivo: String(e).slice(0, 100) }; }
  }
  const para = [email, contact].map((x) => String(x || "").trim()).find((x) => EMAIL.test(x)) || "";
  if (para && env.RESEND_API_KEY) {
    try {
      const { depositLinkEmail } = await import("./emailTemplates.js");
      const m = depositLinkEmail({ ...dados, lang: L3(lang) });
      const f = deps.fetch || fetch;
      const er = await f("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: para, subject: m.subject, html: m.html, reply_to: tenant }),
      });
      const ej = await er.json().catch(() => ({}));
      enviado.email = er.ok && ej.id ? { sent: true, id: ej.id, para } : { sent: false, motivo: "envio recusado" };
    } catch { enviado.email = { sent: false, motivo: "envio falhou" }; }
  }
  const ok = enviado.texto.sent || enviado.email.sent;
  if (ok) {
    const canal = enviado.texto.sent ? enviado.texto.canal : "email";
    const id = enviado.texto.sent ? enviado.texto.id : enviado.email.id;
    await svc(env, "desk_deposit_link_mark", { p_tenant: tenant, p_id: appointmentId, p_canal: canal, p_envio: id, p_session: link.id });
  }
  return { ok, reason: ok ? undefined : "not_delivered", cents: link.cents, amount, url: link.url, enviado };
}

/** A frase que a agente fala depois de marcar. Só diz "mandei" com comprovante. */
export function fraseDoSinal(lang, r) {
  const l = L3(lang);
  // payments_not_connected: o negócio ainda não cobra online — o sinal cadastrado fica PARADO até o
  // Stripe ser ligado. A agente não fala de sinal (não há como pagar) e ninguém é alertado a cada reserva.
  if (!r || !r.cents || ["trusted", "already_paid", "already_sent", "no_deposit_configured", "not_found", "payments_not_connected"].includes(r.reason)) return "";
  if (r.ok) {
    const onde = r.enviado?.texto?.sent ? { en: "texted you", pt: "te mandar por mensagem", es: "enviarle por mensaje" } : { en: "emailed you", pt: "te mandar por e-mail", es: "enviarle por correo" };
    return { en: ` I've just ${onde.en} a link for the ${r.amount} deposit to secure it — it comes off the price.`,
      pt: ` Acabei de ${onde.pt} o link do sinal de ${r.amount} para garantir o horário — ele sai do valor do serviço.`,
      es: ` Acabo de ${onde.es} el enlace del depósito de ${r.amount} para asegurar la cita — se descuenta del precio.` }[l];
  }
  // Tem sinal mas o link não saiu (sem Stripe, sem canal liberado): não promete link; o balcão resolve.
  return { en: " This service takes a deposit — the team will send you how to pay it.",
    pt: " Esse serviço tem sinal — a equipe te passa como pagar.",
    es: " Este servicio lleva depósito — el equipo le enviará cómo pagarlo." }[l];
}

/**
 * O SINAL NA TELA (2026-10-05) — a página pública /agendar/<slug>, logo depois do `marcar`.
 * A reserva JÁ está de pé (o comprovante saiu antes daqui); isto só abre o link para a cliente pagar ali
 * mesmo, com um botão grande. → { ok:true, url, cents, janela_h } · { ok:false, reason }
 *
 * Mesmas regras do sinal da agente (criarLinkDoSinal): valor do CADASTRO, cliente de confiança não paga,
 * sinal já pago não cobra de novo, sem Stripe do negócio não existe link. Nunca lança.
 *
 * "already_sent": o motor de agenda (agent-schedule.js, o mesmo da ligação) já tentou mandar o link por
 * e-mail/texto ao marcar — com e-mail da cliente, mandou. A cliente está NA TELA: abre-se outra sessão para
 * o botão (o link do e-mail continua valendo e, pago, a volta dele marca o sinal do mesmo jeito).
 * A sessão do botão é a que fica registrada (desk_deposit_link_mark, canal "web"): é a que a conferência de
 * hora em hora (/api/sinal-reconcile) acompanha, porque é a que tem mais chance de ser paga.
 */
export async function sinalNaTela(env, { tenant, appointmentId, volta = "", lang = "" }, deps = {}) {
  const svc = deps.svcJson || svcJson;
  try {
    let link = await criarLinkDoSinal(env, { tenant, appointmentId, volta, lang }, deps);
    if (!link.ok && link.reason === "already_sent") link = await criarLinkDoSinal(env, { tenant, appointmentId, volta, lang, reenviar: true }, deps);
    if (!link.ok) return { ok: false, reason: link.reason, cents: Number(link.info?.deposit_cents) || 0 };
    if (!/^https:\/\/[^\s"'<>]{8,}$/.test(String(link.url || ""))) return { ok: false, reason: "stripe_error", cents: link.cents };
    await Promise.resolve(svc(env, "desk_deposit_link_mark", { p_tenant: tenant, p_id: appointmentId, p_canal: "web", p_envio: link.id || "", p_session: link.id || "" })).catch(() => null);
    // janela de cancelamento do serviço (biz_services.cancel_window_h) — só para a frase da política.
    // Não leu → a frase sai sem a janela (nunca inventa uma).
    const pol = await Promise.resolve(svc(env, "desk_late_cancel_info_svc", { p_tenant: tenant, p_id: appointmentId })).catch(() => null);
    const janela = pol && pol.ok === true ? Math.max(0, Math.round(Number(pol.window_h) || 0)) : 0;
    return { ok: true, url: link.url, cents: link.cents, janela_h: janela };
  } catch (e) { return { ok: false, reason: "stripe_error", detail: String(e).slice(0, 120) }; }
}
