// POST /api/stripe-own — o negócio liga a PRÓPRIA conta Stripe para o SINAL (2026-10-05).
// Por quê: a plataforma Stripe da Guileo é BR e o Stripe não repassa de plataforma BR para conta nos
// EUA (docs.stripe.com/connect/cross-border-payouts). O negócio cria uma chave RESTRITA no próprio
// Stripe e cola aqui; o sinal é cobrado direto na conta dele (lib/sinal.js + lib/contaDoCliente.js).
//   { email, key, action:"status" } → { connected, account_name, mode, last4 }
//   { email, key, action:"save", secret_key } → testa a chave no Stripe ANTES de guardar
//   { email, key, action:"remove" }
// A chave nunca volta para o navegador (stripe_own_status devolve só os 4 últimos caracteres).
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { SB_URL } from "../lib/sb.js";

const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
async function rpc(fn, body) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const texto = await r.text(); let data = null; try { data = texto ? JSON.parse(texto) : null; } catch { /* */ }
  return { ok: r.ok, status: r.status, data, texto };
}
const recusada = (r) => [400, 401, 403].includes(r.status) && /unauthorized|28000/.test(r.texto || "");

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
  if (await rateLimited(request, env, "stripe-own", 20)) return json({ ok: false, error: "too many requests" }, 429);
  let b = {}; try { b = await request.json(); } catch { return json({ ok: false, error: "bad body" }, 400); }
  const email = String(b.email || "").trim().toLowerCase();
  const key = String(b.key || b.token || "").trim();
  if (!email.includes("@") || !key) return json({ ok: false, error: "unauthorized" }, 401);
  const action = String(b.action || "status");

  if (action === "status") {
    const r = await rpc("stripe_own_status", { p_email: email, p_key: key });
    if (!r.ok) return recusada(r) ? json({ ok: false, error: "unauthorized" }, 401) : json({ ok: false, error: "unavailable" }, 503);
    return json(r.data || { ok: false });
  }
  if (action === "remove") {
    const r = await rpc("stripe_own_save", { p_email: email, p_key: key, p_secret_key: "", p_meta: null });
    if (!r.ok) return recusada(r) ? json({ ok: false, error: "unauthorized" }, 401) : json({ ok: false, error: "unavailable" }, 503);
    return json(r.data || { ok: false });
  }
  if (action !== "save") return json({ ok: false, error: "unknown action" }, 400);

  const sk = String(b.secret_key || "").trim();
  if (!/^(rk|sk)_(live|test)_[A-Za-z0-9]{20,200}$/.test(sk)) return json({ ok: false, reason: "invalid_key" }, 400);
  // Chave secreta COMPLETA (sk_) dá poder demais — pedimos a restrita. Aceita, mas avisa na tela.
  const completa = sk.startsWith("sk_");
  // 1) a chave abre o Checkout? (é a única permissão de que o sinal precisa: criar e ler sessões)
  const t = await fetch("https://api.stripe.com/v1/checkout/sessions?limit=1", { headers: { Authorization: `Bearer ${sk}` } });
  const tj = await t.json().catch(() => ({}));
  if (!t.ok) return json({ ok: false, reason: t.status === 401 ? "stripe_rejected_key" : "missing_checkout_permission", detail: String(tj?.error?.message || t.status).slice(0, 200) });
  // 2) nome e país da conta, se a chave puder ler (restrita sem "Account" não lê — tudo bem)
  let meta = {};
  try {
    const a = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${sk}` } });
    if (a.ok) { const aj = await a.json(); meta = { account_name: aj?.settings?.dashboard?.display_name || aj?.business_profile?.name || "", country: aj?.country || "", charges_enabled: !!aj?.charges_enabled }; }
  } catch { /* opcional */ }
  const r = await rpc("stripe_own_save", { p_email: email, p_key: key, p_secret_key: sk, p_meta: meta });
  if (!r.ok) return recusada(r) ? json({ ok: false, error: "unauthorized" }, 401) : json({ ok: false, error: "unavailable" }, 503);
  if (r.data?.ok !== true) return json(r.data || { ok: false });
  return json({ ok: true, mode: sk.includes("_live_") ? "live" : "test", full_key: completa, ...meta });
}
