// Cloudflare Pages Function — POST /api/packages  ("motor de crescimento PERSONALIZADO" · RECEITA RECORRENTE)
// The PACKAGES + MEMBERSHIPS backend the client (or their seller) drives from their own panel:
//   • Packages  — buy N sessions, redeem them one at a time (atomic package_use).
//   • Memberships — recurring clubs/subscriptions (month|year).
// Managing (save/list/delete) lives behind db/recurring_revenue.sql (INGEST-gated SECURITY DEFINER RPCs).
// The "buy" action mints a Stripe Checkout link the owner can SEND to a customer — mode=payment for a
// package, mode=subscription for a membership — carrying metadata { guileo, client_email, id } so the
// stripe webhook can fulfill on success. Gift cards have their own sibling endpoint (/api/giftcards).
//
// PER-TENANT GATE — email + connection-key via get_client_data (identical to noshow-radar.js / coupons.js):
// a token can never touch another tenant's packages/memberships/subscribers. No OWNER_EMAIL fallback.
//
//   POST { token, email, action, ... }
//   Packages:    list | upsert{package} | delete{id} | purchases | use{purchase_id}
//   Memberships: membership_list | membership_upsert{membership} | membership_delete{id}
//   Sell link:   buy{kind:'package'|'membership', id}  ->  { ok, url }   (Stripe Checkout)
import { json } from "../lib/guard.js";
import { sbKey } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // ── PER-TENANT GATE (same proven bind noshow-radar / coupons use) ──
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const secret = env.INGEST_SECRET || "";
    const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const NOTE = "Paste db/recurring_revenue.sql in Supabase to activate recurring revenue.";

    const action = (b.action || "list").toString();

    // ── PACKAGES ───────────────────────────────────────────────────────────────
    if (action === "list") {
      const r = await rpc("package_list", { p_secret: secret, p_client_email: email });
      if (!r.ok) return json({ ok: true, ready: false, note: NOTE, packages: [] });
      const packages = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(packages) ? packages.length : 0, packages });
    }

    if (action === "upsert") {
      const p = (b.package && typeof b.package === "object") ? b.package : null;
      if (!p || !String(p.name || "").trim()) return json({ error: "package.name required" }, 400);
      const r = await rpc("package_upsert", { p_secret: secret, p_client_email: email, p_package: p });
      if (!r.ok) return json({ ok: false, ready: false, note: NOTE });
      const id = await r.json().catch(() => null);
      return json({ ok: true, id });
    }

    if (action === "delete") {
      const id = (b.id || "").toString();
      if (!UUID.test(id)) return json({ error: "invalid id" }, 400);
      // TENANT-BOUND (db/tenant_money_guardrails.sql): the SQL also matches client_email, so a
      // leaked UUID can never delete another tenant's package. 404 = guardrails not pasted yet →
      // fall back to the legacy id-only signature (same behavior as before).
      let r = await rpc("package_delete", { p_secret: secret, p_client_email: email, p_id: id });
      if (r.status === 404) r = await rpc("package_delete", { p_secret: secret, p_id: id });
      if (!r.ok) return json({ ok: false });
      const deleted = await r.json().catch(() => false);
      return json({ ok: true, deleted: deleted === true });
    }

    if (action === "purchases") {
      const r = await rpc("package_purchases_list", { p_secret: secret, p_client_email: email });
      if (!r.ok) return json({ ok: true, ready: false, note: NOTE, purchases: [] });
      const purchases = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(purchases) ? purchases.length : 0, purchases });
    }

    if (action === "use") {
      const id = (b.purchase_id || b.id || "").toString();
      if (!UUID.test(id)) return json({ error: "invalid purchase_id" }, 400);
      // TENANT-BOUND redeem (db/tenant_money_guardrails.sql): the atomic decrement also matches
      // client_email, so a leaked purchase UUID can never be SPENT cross-tenant. 404 = guardrails
      // not pasted yet → fall back to the legacy id-only signature (same behavior as before).
      let r = await rpc("package_use", { p_secret: secret, p_client_email: email, p_purchase_id: id });
      if (r.status === 404) r = await rpc("package_use", { p_secret: secret, p_purchase_id: id });
      if (!r.ok) return json({ ok: false, note: NOTE });
      const res = await r.json().catch(() => ({ ok: false }));
      return json(res || { ok: false });
    }

    // ── MEMBERSHIPS ─────────────────────────────────────────────────────────────
    if (action === "membership_list") {
      const r = await rpc("membership_list", { p_secret: secret, p_client_email: email });
      if (!r.ok) return json({ ok: true, ready: false, note: NOTE, memberships: [] });
      const memberships = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(memberships) ? memberships.length : 0, memberships });
    }

    if (action === "membership_upsert") {
      const m = (b.membership && typeof b.membership === "object") ? b.membership : null;
      if (!m || !String(m.name || "").trim()) return json({ error: "membership.name required" }, 400);
      const r = await rpc("membership_upsert", { p_secret: secret, p_client_email: email, p_membership: m });
      if (!r.ok) return json({ ok: false, ready: false, note: NOTE });
      const id = await r.json().catch(() => null);
      return json({ ok: true, id });
    }

    if (action === "membership_delete") {
      const id = (b.id || "").toString();
      if (!UUID.test(id)) return json({ error: "invalid id" }, 400);
      // TENANT-BOUND (db/tenant_money_guardrails.sql) — same fallback pattern as package_delete.
      let r = await rpc("membership_delete", { p_secret: secret, p_client_email: email, p_id: id });
      if (r.status === 404) r = await rpc("membership_delete", { p_secret: secret, p_id: id });
      if (!r.ok) return json({ ok: false });
      const deleted = await r.json().catch(() => false);
      return json({ ok: true, deleted: deleted === true });
    }

    // ── BUY — mint a Stripe Checkout link to SEND to a customer. ─────────────────
    // package  → mode=payment (one-off);  membership → mode=subscription (recurring).
    if (action === "buy") {
      const kind = (b.kind || "package").toString().toLowerCase();
      const id = (b.id || "").toString();
      if (!UUID.test(id)) return json({ error: "invalid id" }, 400);
      if (kind !== "package" && kind !== "membership") return json({ error: "kind must be package|membership" }, 400);
      if (!env.STRIPE_SECRET_KEY) return json({ ok: false, ready: false, note: "Set STRIPE_SECRET_KEY in Cloudflare to sell online." });

      // Load the item server-side (never trust a price from the client).
      const listName = kind === "package" ? "package_list" : "membership_list";
      const lr = await rpc(listName, { p_secret: secret, p_client_email: email });
      if (!lr.ok) return json({ ok: false, ready: false, note: NOTE });
      const list = (await lr.json().catch(() => [])) || [];
      const item = (Array.isArray(list) ? list : []).find((x) => x && x.id === id) || null;
      if (!item) return json({ error: "not found" }, 404);
      const cents = Math.round(Number(item.price_cents) || 0);
      if (!isFinite(cents) || cents < 50) return json({ error: "price too low to sell (min $0.50)" }, 400);
      const MAX = (Number(env.MAX_CHARGE_USD) || 100000) * 100;
      if (cents > MAX) return json({ error: "price exceeds the cap" }, 400);

      const name = String(item.name || (kind === "package" ? "Package" : "Membership")).slice(0, 120);
      const interval = kind === "membership" ? (item.interval === "year" ? "year" : "month") : null;

      // Stripe Checkout Session with inline price_data (no pre-created price needed). Metadata rides on
      // BOTH the session and the payment_intent/subscription so the webhook can fulfill from either.
      const form = {
        mode: kind === "membership" ? "subscription" : "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(cents),
        "line_items[0][price_data][product_data][name]": name,
        success_url: "https://guileoai.com/portal?bought=1",
        cancel_url: "https://guileoai.com/portal",
        "metadata[guileo]": kind,
        "metadata[client_email]": email,
        "metadata[id]": id,
        // A Stripe promo code could discount the sale below the item's set price — a coupon must
        // never hand out full value. Keep checkout at the exact server-loaded price.
        allow_promotion_codes: "false",
      };
      if (kind === "membership") {
        form["line_items[0][price_data][recurring][interval]"] = interval;
        form["subscription_data[metadata][guileo]"] = "membership";
        form["subscription_data[metadata][client_email]"] = email;
        form["subscription_data[metadata][id]"] = id;
      } else {
        form["payment_intent_data[metadata][guileo]"] = "package";
        form["payment_intent_data[metadata][client_email]"] = email;
        form["payment_intent_data[metadata][id]"] = id;
      }

      const sr = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(form).toString(),
      });
      const sd = await sr.json().catch(() => ({}));
      if (!sr.ok) return json({ ok: false, error: (sd?.error?.message || `stripe ${sr.status}`).slice(0, 200) }, 502);
      return json({ ok: true, url: sd.url || "", id: sd.id || "", kind });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
