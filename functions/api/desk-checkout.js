// POST /api/desk-checkout — abre o pagamento de um plano do Guileo Desk no Stripe (2026-10-05).
//
// Sessão de ASSINATURA criada pelo nosso servidor (sem Payment Link à mão): o preço sai de
// src/data/deskPlans.js e a etiqueta { guileo:"desk_plan", desk_plan } vai na sessão E na assinatura,
// para o webhook reconhecer o primeiro pagamento e cada renovação (stripe-webhook → ramo "desk_plan").
// ⚠️ A etiqueta é OBRIGATÓRIA: sem ela, $199 cairia no ramo "Configuração Assistida" e qualquer outro valor
// no ramo padrão, que credita 1/$ e CRIA agente + COMPRA número Twilio para quem pagou.
//
// Dois jeitos de chegar: logado (dentro do Balcão — email+chave conferidos pela porta do Desk, e o e-mail
// da assinatura fica travado no da conta) ou pela página /desk (o Stripe pede o e-mail; o webhook cria a
// conta e manda o código de acesso).
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { SB_URL } from "../lib/sb.js";
import { DESK_PLANS } from "../../src/data/deskPlans.js";

const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const BASE = "https://guileoai.com";

async function contaConfere(email, key) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/desk_plano`, {
    method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_email: email, p_key: key }),
  }).catch(() => null);
  return !!(r && r.ok);
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
  if (await rateLimited(request, env, "desk-checkout", 12, 600, true)) return json({ ok: false, error: "too_many" }, 429);
  let b = {}; try { b = await request.json(); } catch { return json({ ok: false, error: "bad body" }, 400); }
  const plano = DESK_PLANS.find((p) => p.key === String(b.plan || "") && p.amount);
  if (!plano) return json({ ok: false, error: "plano inválido" }, 400);
  const unidades = Math.min(Math.max(parseInt(b.units, 10) || 1, 1), 20);
  const lang = ["pt", "es", "en"].includes(b.lang) ? b.lang : "en";
  const email = String(b.email || "").trim().toLowerCase();
  const key = String(b.key || "").trim();
  const logado = email.includes("@") && key;
  if (logado && !(await contaConfere(email, key))) return json({ ok: false, error: "unauthorized" }, 401);
  if (!env.STRIPE_SECRET_KEY) return json({ ok: false, error: "pagamento indisponível" }, 503);

  const etiqueta = { guileo: "desk_plan", desk_plan: plano.key, units: String(unidades), ...(logado ? { client_email: email } : {}) };
  const f = new URLSearchParams();
  f.set("mode", "subscription");
  f.set("line_items[0][quantity]", String(unidades));
  f.set("line_items[0][price_data][currency]", "usd");
  f.set("line_items[0][price_data][unit_amount]", String(plano.amount * 100));
  f.set("line_items[0][price_data][recurring][interval]", "month");
  f.set("line_items[0][price_data][product_data][name]", `Guileo Desk · ${typeof plano.name === "string" ? plano.name : plano.name.en}`);
  f.set("line_items[0][price_data][product_data][description]", lang === "pt" ? "Por unidade, por mês" : lang === "es" ? "Por sede, por mes" : "Per location, per month");
  for (const [k, v] of Object.entries(etiqueta)) { f.set(`metadata[${k}]`, v); f.set(`subscription_data[metadata][${k}]`, v); }
  if (logado) f.set("customer_email", email);
  f.set("allow_promotion_codes", "true");
  f.set("billing_address_collection", "auto");
  f.set("locale", lang === "pt" ? "pt-BR" : lang === "es" ? "es" : "en");
  f.set("success_url", `${BASE}/desk/obrigado?plano=${plano.key}&s={CHECKOUT_SESSION_ID}`);
  f.set("cancel_url", logado ? `${BASE}/portal?tab=desk` : `${BASE}/desk#planos`);

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST", headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: f,
  }).catch(() => null);
  const j = r ? await r.json().catch(() => null) : null;
  if (!r || !r.ok || !j?.url) return json({ ok: false, error: "stripe", detalhe: (j?.error?.message || `HTTP ${r?.status || 0}`).slice(0, 200) }, 502);
  return json({ ok: true, url: j.url });
}
