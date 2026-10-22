// POST /api/desk-pagamentos — o balcão cobra no Stripe DO NEGÓCIO (2026-10-05).
// Cartão salvo, taxa de falta e assinatura da cliente. A lógica e os motivos estão em
// lib/stripeDoNegocio.js; a volta da cliente é /api/sinal-pago (lib/sinalPago.js).
//
// PORTA: igual ao /api/desk — e-mail + chave de conexão, provados com desk_agenda num intervalo de
// 1 minuto ANTES de qualquer coisa; chave errada → 401. Depois, a trava por plano (lib/deskTrava.js):
// cobrar online fica no mesmo plano do link do sinal ("deposit_link"). As funções do banco são só
// service_role e recebem p_tenant = o e-mail PROVADO aqui — nunca um e-mail vindo do corpo sem a chave.
//
// AÇÕES
//   cartao_status{contact}                      → { ok, connected, mode, card:{brand,last4,exp_month,exp_year,saved_at,usable}|null }
//   salvar_cartao_link{contact,name?}           → { ok, url }  (a recepção copia e manda; não há modelo de texto/e-mail para este link)
//   cobrar_falta{id}                            → { ok, cents, card } | { ok:false, reason, detail?, permissao? }
//   cancelamento_info{id}                       → { ok, status, cancelled_at, cancelled_by, horas_antes, janela_h, late, why,
//                                                   fee_cents, fee_from, charged, connected, card:{…,usable}|null }
//   cobrar_cancelamento{id}                     → igual ao cobrar_falta; + not_cancelled · cancel_time_unknown ·
//                                                   not_late_cancel(+why) · noshow_fee_charged  (2026-10-05, v6)
//   assinaturas                                 → { ok, connected, memberships:[{id,name,price_cents,interval,perks,subscribers}] }
//   assinatura_link{membership_id,contact,name?} → { ok, url, cents, interval }
// cus_… e pm_… NUNCA voltam para o navegador.
import { json } from "../lib/guard.js";
import { SB_URL, svcJson } from "../lib/sb.js";
import { podeNoDesk } from "../lib/deskTrava.js";
import { chaveDoNegocio, contatoValido, linkSalvarCartao, cobrarTaxaDeFalta, linkAssinatura, cancelamentoTardio, cobrarTaxaDeCancelamento } from "../lib/stripeDoNegocio.js";

const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACOES = new Set(["cartao_status", "salvar_cartao_link", "cobrar_falta", "cancelamento_info", "cobrar_cancelamento", "assinaturas", "assinatura_link"]);

async function porta(email, key, f = fetch) {
  try {
    const agora = new Date();
    const r = await f(`${SB_URL}/rest/v1/rpc/desk_agenda`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key, p_from: agora.toISOString(), p_to: new Date(agora.getTime() + 60000).toISOString() }),
    });
    const texto = await r.text();
    return { ok: r.ok, status: r.status, texto: texto.slice(0, 200) };
  } catch (e) { return { ok: false, status: 0, texto: String(e).slice(0, 120) }; }
}
// O banco recusa a chave com SQLSTATE 28000, que o PostgREST entrega como 401/403 (às vezes 400).
const recusada = (r) => [400, 401, 403].includes(r.status) && /unauthorized|28000/.test(r.texto || "");

// Só o que a tela precisa: bandeira, final e validade. Nada de cus_/pm_.
const cartaoParaTela = (c, livemode) => (c ? { brand: c.brand || "", last4: c.last4 || "", exp_month: c.exp_month || null, exp_year: c.exp_year || null, saved_at: c.saved_at || null, usable: livemode == null ? false : !!c.livemode === !!livemode } : null);

/** Núcleo testável: já com e-mail provado. */
export async function acaoDePagamento(env, email, b, deps = {}) {
  const action = String(b.action || "");
  const svc = deps.svcJson || svcJson;
  switch (action) {
    case "cartao_status": {
      const contact = String(b.contact || "").slice(0, 160);
      if (!contatoValido(contact)) return { ok: false, reason: "no_contact" };
      const k = await chaveDoNegocio(env, email, deps);
      const r = await svc(env, "desk_card_get_svc", { p_tenant: email, p_contact: contact });
      if (r && r.erro_http) return { ok: false, reason: "unavailable" };
      return { ok: true, connected: k.ok, mode: k.ok ? (k.livemode ? "live" : "test") : null, card: cartaoParaTela(r?.card, k.ok ? k.livemode : null) };
    }
    case "salvar_cartao_link":
      return linkSalvarCartao(env, { tenant: email, contact: String(b.contact || "").slice(0, 160), name: String(b.name || "").slice(0, 120) }, deps);
    case "cobrar_falta": {
      const id = String(b.id || "");
      if (!UUID.test(id)) return { ok: false, reason: "invalid" };
      return cobrarTaxaDeFalta(env, { tenant: email, appointmentId: id }, deps);
    }
    // Cancelamento em cima da hora: quando e quem cancelou, se cai na janela do serviço, e a cobrança.
    case "cancelamento_info": {
      const id = String(b.id || "");
      if (!UUID.test(id)) return { ok: false, reason: "invalid" };
      const info = await svc(env, "desk_late_cancel_info_svc", { p_tenant: email, p_id: id });
      if (!info || info.ok !== true) return { ok: false, reason: info?.erro_http ? "unavailable" : "not_found" };
      const k = await chaveDoNegocio(env, email, deps);
      const tardio = cancelamentoTardio(info);
      const fee = info.fee && typeof info.fee === "object" ? { status: info.fee.status || "", cents: Number(info.fee.cents) || 0, card: info.fee.card || "", reason: info.fee.reason || "", at: info.fee.at || null } : null;
      return { ok: true, status: info.status, start: info.start, cancelled_at: info.cancelled_at || null, cancelled_by: info.cancelled_by || "desconhecido",
        ...tardio, fee_cents: Math.round(Number(info.fee_cents) || 0), fee_from: info.fee_from || "noshow_fee_cents", charged: !!info.charged, noshow_paid: !!info.noshow_paid,
        deposit_paid: !!info.deposit_paid, fee, connected: k.ok, card: cartaoParaTela(info.card, k.ok ? k.livemode : null) };
    }
    case "cobrar_cancelamento": {
      const id = String(b.id || "");
      if (!UUID.test(id)) return { ok: false, reason: "invalid" };
      return cobrarTaxaDeCancelamento(env, { tenant: email, appointmentId: id }, deps);
    }
    case "assinaturas": {
      const k = await chaveDoNegocio(env, email, deps);
      const lista = await svc(env, "desk_membership_list_svc", { p_tenant: email });
      if (!Array.isArray(lista)) return { ok: false, reason: "unavailable" };
      return { ok: true, connected: k.ok, memberships: lista };
    }
    case "assinatura_link": {
      const mid = String(b.membership_id || "");
      if (!UUID.test(mid)) return { ok: false, reason: "membership_not_found" };
      return linkAssinatura(env, { tenant: email, membershipId: mid, contact: String(b.contact || "").slice(0, 160) }, deps);
    }
  }
  return { ok: false, reason: "unknown_action" };
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = (await request.json()) || {}; } catch { return json({ ok: false, erro: "corpo inválido" }, 400); }
  const email = String(b.email || "").trim().toLowerCase();
  const key = String(b.key || b.dataKey || "").trim();
  const action = String(b.action || "");
  if (!email.includes("@") || !key) return json({ ok: false, erro: "unauthorized" }, 401);
  if (!ACOES.has(action)) return json({ ok: false, erro: "ação desconhecida" }, 400);

  // ── PORTA (igual ao /api/desk) ─────────────────────────────────────────────────────────────
  const p = await porta(email, key);
  if (!p.ok) return recusada(p) ? json({ ok: false, erro: "unauthorized" }, 401) : json({ ok: false, erro: "Desk indisponível", detalhe: p.texto }, 503);

  // ── TRAVA POR PLANO: cobrar online = mesmo plano do link do sinal ─────────────────────────
  const plano = await svcJson(env, "desk_plano_svc", { p_email: email }).then((r) => (typeof r === "string" ? r : null)).catch(() => null);
  const trava = podeNoDesk(plano, "deposit_link");
  if (!trava.ok) return json({ ok: false, erro: "plano", reason: "plan_required", precisa: trava.precisa, plano }, 402);

  const r = await acaoDePagamento(env, email, b);
  return json(r, r.reason === "invalid" ? 400 : 200);
}
