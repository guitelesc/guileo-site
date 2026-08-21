// Cloudflare Pages Function — POST /api/setup-selfserve  (admin-token gated)
// One-shot: creates (idempotently) the 3 Track-A Stripe products + monthly prices +
// Payment Links, PLUS the 2 one-time credit top-up links (Recarga 500 $49 / Recarga 1500
// $119), using the server's STRIPE_SECRET_KEY — the key never leaves the server.
// Returns all payment-link URLs to paste into selfServePlans.js (PLANS urls + TOPUPS urls).
//   POST { token }  (admin token)
import { json } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const PLANS = [
  // canonical names (= src/data/guileoPlans.js); legacyName renames the pre-existing Stripe
  // product in place on the next setup run — receipts flip to the new name, links stay valid.
  { id: "starter", name: "Guileo Essential", legacyName: "Guileo Starter", amount: 14900, credits: 500 },
  { id: "growth", name: "Guileo Personalized", legacyName: "Guileo Growth", amount: 89700, credits: 3000 },
  { id: "scale", name: "Guileo Full Operation", legacyName: "Guileo Scale", amount: 199700, credits: 9000 },
];

// One-time credit top-ups — mode=payment Payment Links (price has NO recurring interval,
// so the checkout is a one-off charge, not a subscription). The LINK's metadata
// { guileo:"topup", credits } is automatically copied by Stripe onto every Checkout
// Session the link creates — that's what stripe-webhook.js keys on to credit a recharge
// instead of running the plan path. Paste the minted URLs into selfServePlans.js TOPUPS.
const TOPUPS = [
  { id: "topup500", name: "Guileo Recarga 500", amount: 4900, credits: 500 },
  { id: "topup1500", name: "Guileo Recarga 1500", amount: 11900, credits: 1500 },
];

// GET /api/setup-selfserve?token=… — read-back verification: pulls each Payment Link's
// line item straight from Stripe so we confirm amount + monthly recurrence + product name.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const vr = await fetch(`${SB_URL}/rest/v1/rpc/blitz_stats`, {
    method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_email: "" }),
  });
  if (!vr.ok) return json({ error: "unauthorized" }, 401);
  if (!env.STRIPE_SECRET_KEY) return json({ ready: false }, 501);
  try {
    const res = await fetch("https://api.stripe.com/v1/payment_links?limit=100&expand[]=data.line_items", {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const data = await res.json();
    const out = [];
    for (const l of data.data || []) {
      const li = l.line_items?.data?.[0];
      const pr = li?.price;
      if (!pr) continue;
      out.push({
        url: l.url, active: l.active,
        amount: (pr.unit_amount || 0) / 100, currency: pr.currency,
        interval: pr.recurring?.interval || "one-time",
        redirect: l.after_completion?.redirect?.url || null,
        product: (pr.product && typeof pr.product === "object") ? pr.product.name : pr.product,
        // top-up links carry this tag (copied onto their checkout sessions) — surfaced so the
        // read-back proves the metadata the webhook depends on is actually set.
        guileo: l.metadata?.guileo || null, credits: l.metadata?.credits || null,
      });
    }
    return json({ ok: true, count: out.length, links: out });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e).slice(0, 200) }, 502);
  }
}

// the 3 canonical self-serve checkout URLs — the ONLY links that may stay active.
const KEEP_URLS = new Set([
  "https://buy.stripe.com/bJe9AT9LldnecqjdzT3Nm0e", // Essential $149 (ex-Starter)
  // 🚨 OS ANTIGOS FICAM ATIVOS DE PROPÓSITO (repreço 2026-08-21). Quem assinou a $449/$999 renova
  // por eles todo mês; desativá-los cancelaria a cobrança de cliente pagante — o pior desfecho
  // possível de um reajuste. Os novos entram AO LADO, para quem compra a partir de agora.
  "https://buy.stripe.com/4gM7sL9Ll0AsgGz2Vf3Nm0f", // Personalized $449 — LEGADO, assinantes ativos
  "https://buy.stripe.com/bJe00j6z94QI2PJ0N73Nm0g", // Full Operation $999 — LEGADO, assinantes ativos
  "https://buy.stripe.com/eVq9ATaPp4QIcqjdzT3Nm0l", // Personalized $897 (atual)
  "https://buy.stripe.com/4gM8wP6z9gzqcqj2Vf3Nm0m", // Full Operation $1.997 (atual)
]);

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // admin-token gate (reuse the token-gated RPC, like onboard-client)
    const vr = await fetch(`${SB_URL}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: (b.token || "").toString(), p_email: "" }),
    });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);
    if (!env.STRIPE_SECRET_KEY) return json({ ready: false, error: "Set STRIPE_SECRET_KEY in Cloudflare first" }, 501);

    const SK = env.STRIPE_SECRET_KEY;
    const sapi = async (path, form, method = "POST") => {
      const res = await fetch(`https://api.stripe.com/v1/${path}`, {
        method, headers: { Authorization: `Bearer ${SK}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form ? new URLSearchParams(form).toString() : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `stripe ${path} failed`);
      return data;
    };

    // DEACTIVATE MODE — { action:"deactivate", urls:[...] }: deactivate ONLY the exact
    // payment-link URLs passed in by the caller (no server-side inference). Hard safety:
    // any URL in KEEP_URLS (the 3 live plans) is refused. Reversible (active=true re-enables).
    if (b.action === "deactivate" && Array.isArray(b.urls)) {
      const targets = new Set(b.urls.filter((u) => !KEEP_URLS.has(u)));
      const links = await sapi("payment_links?limit=100", null, "GET");
      const disabled = [], skipped = [];
      for (const l of links.data || []) {
        if (targets.has(l.url)) {
          if (l.active) { await sapi(`payment_links/${l.id}`, { active: "false" }); disabled.push(l.url); }
          else skipped.push(l.url);
        }
      }
      return json({ ok: true, disabled, disabledCount: disabled.length, alreadyOff: skipped });
    }

    const out = [];
    for (const p of PLANS) {
      // 1) product — reuse by the CANONICAL name; else find the LEGACY-named product and RENAME
      // it in place (receipts/checkout pick up the new name, payment links stay valid — never
      // create a duplicate product); only create fresh when neither exists.
      const search = await sapi(`products/search?query=${encodeURIComponent(`active:'true' AND name:'${p.name}'`)}`, null, "GET");
      let product = (search.data || [])[0];
      if (!product && p.legacyName) {
        const legacy = await sapi(`products/search?query=${encodeURIComponent(`active:'true' AND name:'${p.legacyName}'`)}`, null, "GET");
        const found = (legacy.data || [])[0];
        if (found) product = await sapi(`products/${found.id}`, { name: p.name });
      }
      if (!product) product = await sapi("products", { name: p.name, description: `${p.credits} Gui credits/month` });

      // 2) recurring monthly price for the exact amount — reuse if it exists
      const prices = await sapi(`prices?product=${product.id}&active=true&limit=100`, null, "GET");
      // currency MUST be usd — the webhook's PLAN_CREDITS map is a USD map; reusing a same-number
      // price in another currency would silently mint a mispriced link.
      let price = (prices.data || []).find((pr) => pr.unit_amount === p.amount && pr.currency === "usd" && pr.recurring?.interval === "month");
      if (!price) price = await sapi("prices", {
        product: product.id, unit_amount: p.amount, currency: "usd", "recurring[interval]": "month",
        "metadata[plan]": p.id, "metadata[credits]": String(p.credits),
      });

      // 3) payment link — reuse one already pointing at this price, else create
      const links = await sapi("payment_links?limit=100&expand[]=data.line_items", null, "GET");
      let link = (links.data || []).find((l) => (l.line_items?.data || []).some((li) => li.price?.id === price.id));
      if (!link) link = await sapi("payment_links", {
        "line_items[0][price]": price.id, "line_items[0][quantity]": 1,
        "after_completion[type]": "redirect",
        "after_completion[redirect][url]": "https://guileoai.com/portal?welcome=1",
        allow_promotion_codes: "true",
        "metadata[plan]": p.id, "metadata[credits]": String(p.credits),
      });
      out.push({ id: p.id, name: p.name, amount: p.amount / 100, credits: p.credits, url: link.url });
    }

    // ONE-TIME TOP-UPS — same idempotent product→price→link dance as the plans, except the
    // price is NON-recurring (one-off checkout) and the payment LINK itself carries
    // metadata { guileo:"topup", credits } so the webhook can tell a recharge apart.
    for (const t of TOPUPS) {
      // 1) product — reuse by name, else create
      const search = await sapi(`products/search?query=${encodeURIComponent(`active:'true' AND name:'${t.name}'`)}`, null, "GET");
      let product = (search.data || [])[0];
      if (!product) product = await sapi("products", { name: t.name, description: `${t.credits} Gui credits — one-time top-up` });

      // 2) one-time price for the exact amount — reuse if it exists (must NOT be recurring)
      const prices = await sapi(`prices?product=${product.id}&active=true&limit=100`, null, "GET");
      let price = (prices.data || []).find((pr) => pr.unit_amount === t.amount && pr.currency === "usd" && !pr.recurring);
      if (!price) price = await sapi("prices", {
        product: product.id, unit_amount: t.amount, currency: "usd",
        "metadata[guileo]": "topup", "metadata[credits]": String(t.credits),
      });

      // 3) payment link — reuse one already pointing at this price, else create. If a reused
      // link is missing the topup tag the webhook depends on, repair it in place.
      const links = await sapi("payment_links?limit=100&expand[]=data.line_items", null, "GET");
      let link = (links.data || []).find((l) => (l.line_items?.data || []).some((li) => li.price?.id === price.id));
      if (link && link.metadata?.guileo !== "topup") {
        link = await sapi(`payment_links/${link.id}`, { "metadata[guileo]": "topup", "metadata[credits]": String(t.credits) });
      }
      if (!link) link = await sapi("payment_links", {
        "line_items[0][price]": price.id, "line_items[0][quantity]": 1,
        "after_completion[type]": "redirect",
        "after_completion[redirect][url]": "https://guileoai.com/portal?topup=1",
        "metadata[guileo]": "topup", "metadata[credits]": String(t.credits),
      });
      out.push({ id: t.id, name: t.name, amount: t.amount / 100, credits: t.credits, oneTime: true, url: link.url });
    }
    return json({ ok: true, links: out });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e).slice(0, 200) }, 502);
  }
}
