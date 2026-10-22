// Cloudflare Pages Function — POST /api/assinatura-checkout   (ASSINATURA DO SITE · a cliente do salão assina)
// A seção "Membership" (src/novo/NaturaMembership.jsx) manda { slug, id, email } e recebe { url } de um
// Stripe Checkout em modo assinatura. Aqui NADA é gravado como assinante: sessão aberta não é assinatura.
//
// PARA ONDE VAI O DINHEIRO — o mesmo caminho do "Vender assinatura" do balcão (lib/vendaOnlineNegocio.js):
//   • o salão colou a chave PRÓPRIA do Stripe (guileoai.com/receber) → a assinatura nasce na conta DELE
//     (criarAssinaturaPropria, etiqueta desk_membership). Quem registra o assinante é a volta
//     /api/sinal-pago e a conferência de hora em hora /api/sinal-reconcile. É o caminho do Natura: a
//     plataforma Stripe da Guileo é BR e não repassa para negócio dos EUA (ATIVACOES.md).
//   • sem chave própria e com conta conectada (negócio BR) → cobrança de destino na plataforma, etiqueta
//     guileo:"membership", registrada pelo webhook (stripe-webhook.js) — inclusive a cada renovação.
//   • sem nenhum dos dois → não vende ("call the salon"). Nunca cobra na conta da Guileo.
//
// TRAVAS, nesta ordem: origem (só a própria página) → 10 tentativas/min por IP → salão cadastrado →
// interruptor ASSINATURA.aoVivo (src/novo/naturaAssinatura.js) → e-mail → plano relido do banco →
// caminho do dinheiro → Checkout.
//
// Falha devolve { ok:false, code, error } — `error` é a frase em inglês que a cliente lê, sempre dizendo
// que nada foi cobrado. Corpo JSON de falha nossa usa 503, nunca 502.
import { json, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { camposDoDestino } from "../lib/contaDoCliente.js";
import { caminhoDaVenda, criarAssinaturaPropria } from "../lib/vendaOnlineNegocio.js";
import { emitFailure } from "../lib/failure.js";
import { ehNosso } from "../lib/dominio.js";
import { lojaDe } from "../lib/loja.js";
import { daPropriaVitrine } from "./loja-checkout.js";
import { ASSINATURA, planosPublicos, emailValido } from "../../src/novo/naturaAssinatura.js";

export const FRASES = {
  fechada: "Memberships aren’t open online yet. Nothing was charged — please ask at the front desk.",
  sem_conta: "Online sign-up isn’t available right now. Nothing was charged — please call the salon.",
  email: "Please enter a valid email so the salon can find your membership.",
  plano: "This plan is no longer available. Please refresh the page.",
  planos: "We couldn’t load the plans right now. Nothing was charged — please try again.",
  stripe: "We couldn’t open checkout. Nothing was charged — please try again.",
  origem: "Please sign up from the membership page.",
  devagar: "Too many tries in a row — please wait a minute.",
};
const falha = (code, status = 400, extra = {}) => json({ ok: false, code, error: FRASES[code] || FRASES.stripe, ...extra }, status);

/* Caminho da PLATAFORMA (conta conectada): os campos do Checkout. Etiqueta na sessão E na assinatura —
   a fatura de renovação só traz a da assinatura. Preço exato do banco, sem cupom. */
export function camposDaPlataforma({ tenant, plano, email, voltar }) {
  const form = {
    mode: "subscription",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(plano.price_cents),
    "line_items[0][price_data][recurring][interval]": plano.interval === "year" ? "year" : "month",
    "line_items[0][price_data][product_data][name]": plano.name.slice(0, 100),
    success_url: `${voltar}?assinatura=ok#membership`,
    cancel_url: `${voltar}?assinatura=cancelado#membership`,
    customer_email: email,
    allow_promotion_codes: "false",
  };
  for (const [k, v] of Object.entries({ guileo: "membership", client_email: tenant, id: plano.id })) {
    form[`metadata[${k}]`] = v;
    form[`subscription_data[metadata][${k}]`] = v;
  }
  return form;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!daPropriaVitrine(request)) return falha("origem", 403);
    if (await rateLimited(request, env, "assinatura-checkout", 10, 60)) return falha("devagar", 429);

    const b = await request.json().catch(() => ({}));
    const loja = lojaDe(b.slug);
    if (!loja) return falha("fechada", 404);
    if (ASSINATURA.aoVivo !== true) return falha("fechada", 503);
    const email = String(b.email || "").trim().toLowerCase();
    if (!emailValido(email)) return falha("email");
    const id = String(b.id || "");

    const lista = await svcJson(env, "membership_list", { p_secret: env.INGEST_SECRET || "", p_client_email: loja.email });
    if (!Array.isArray(lista)) return falha("planos", 503);
    const plano = planosPublicos(lista).find((m) => m.id === id);
    if (!plano) return falha("plano");
    if (plano.price_cents > (Number(env.MAX_CHARGE_USD) || 100000) * 100) return falha("sem_conta", 503);

    const caminho = await caminhoDaVenda(env, loja.email);
    if (caminho.via === "recusa") {
      await emitFailure(env, "assinatura_site_sem_stripe", loja.email, "Assinatura do site ligada (aoVivo) mas o salão não tem Stripe próprio nem conta conectada — ninguém consegue assinar", { slug: loja.slug, detalhe: caminho.corpo?.detail || "" });
      return falha("sem_conta", 503);
    }

    if (caminho.via === "propria") {
      const r = await criarAssinaturaPropria(env, { tenant: loja.email, chave: caminho.chave, membership: plano, contact: email });
      if (!r.ok) {
        await emitFailure(env, "assinatura_site_stripe", loja.email, `Stripe do salão recusou abrir a assinatura do site: ${r.reason || "?"}`, { slug: loja.slug, plano: plano.id, motivo: r.reason || "", permissao: r.permission || "" });
        return falha("stripe", 503);
      }
      return json({ ok: true, url: r.url, id: r.id, via: "stripe_own" });
    }

    if (!env.STRIPE_SECRET_KEY) return falha("sem_conta", 503);
    const u = new URL(request.url);
    const voltar = `${u.origin}${ehNosso(u.host) ? `/novo/${loja.slug}` : "/"}`;
    const form = {
      ...camposDaPlataforma({ tenant: loja.email, plano, email, voltar }),
      ...camposDoDestino(caminho.destino, { assinatura: true, cents: plano.price_cents, feePct: parseFloat(env.GUILEO_FEE_PCT || "0") }),
    };
    const sr = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const sd = await sr.json().catch(() => ({}));
    if (!sr.ok || !sd.url) {
      await emitFailure(env, "assinatura_site_stripe", loja.email, `Stripe recusou abrir a assinatura do site (${sr.status}): ${(sd?.error?.message || "").slice(0, 160)}`, { slug: loja.slug, plano: plano.id });
      return falha("stripe", 503);
    }
    return json({ ok: true, url: sd.url, id: sd.id || "", via: "plataforma" });
  } catch (e) {
    await emitFailure(env, "assinatura_site_erro", "", `assinatura-checkout quebrou: ${String(e).slice(0, 160)}`);
    return falha("stripe", 503);
  }
}
