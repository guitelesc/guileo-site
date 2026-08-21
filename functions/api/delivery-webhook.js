// Cloudflare Pages Function — POST /api/delivery-webhook?client=<email>&secret=<secret>
// UNIFIED DELIVERY ORDERS: one endpoint an aggregator (Otter / Deliverect / ItsaCheckmate / Cuboh) — or a
// platform directly (Uber Eats, DoorDash, Grubhub, iFood) — POSTs each new order to. We normalize the many
// payload shapes into ONE order, drop it into the Cockpit's Live Orders + the revenue ledger, and ACK 200.
//
// Multi-tenant by URL: each restaurant points its aggregator webhook at its OWN url with ?client=<their email>
// so orders are attributed to the right business. Secret-gated so nobody can forge orders.
//
// Goal: the restaurant sees EVERY order (Uber, DoorDash, Grubhub, iFood + Gui's own commission-free direct
// orders) in one screen — and the revenue rolls up in one place.
import { json, safeEq } from "../lib/guard.js";
import { sbKey, svcRpc } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// Best-effort pull of the first present field from a list of candidate keys (different aggregators name
// the same thing differently). Supports dotted paths like "customer.name".
const pick = (obj, keys) => {
  for (const k of keys) {
    const v = k.split(".").reduce((o, p) => (o == null ? o : o[p]), obj);
    if (v != null && v !== "") return v;
  }
  return "";
};

// Aggregators (Otter / Deliverect / Cuboh / ItsaCheckmate) WRAP the real marketplace, so when the
// top-level source is the aggregator we keep digging for the underlying platform (Uber/DoorDash/…).
// We want the order labeled by the MARKETPLACE the customer ordered on, not the middleware.
const AGG = /otter|deliverect|cuboh|checkmate|itsacheckmate|chowly|ordermark/;
function marketplaceName(raw) {
  if (/uber/.test(raw)) return "Uber Eats";
  if (/door/.test(raw)) return "DoorDash";
  if (/grub|seamless/.test(raw)) return "Grubhub";
  if (/ifood|i-food/.test(raw)) return "iFood";
  if (/postmates/.test(raw)) return "Postmates";
  if (/ezcater|caviar|chownow|toast|slice/.test(raw)) return raw.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 24);
  return "";
}
function platformOf(b) {
  // Try the marketplace-specific fields aggregators expose first (Deliverect: channel/channelName;
  // Otter: order.deliveryPlatform/brand; Cuboh: platform/orderSource), then the generic ones.
  const candidates = ["channel", "channelName", "order.deliveryPlatform", "deliveryPlatform", "brand",
    "orderSource", "platform", "source", "marketplace", "deliveryService", "provider"];
  for (const k of candidates) {
    const v = (pick(b, [k]) || "").toString().toLowerCase();
    const m = marketplaceName(v);
    if (m) return m; // found the real marketplace
  }
  // Fall back to whatever it called itself (skip the aggregator's own name when a better one isn't found)
  const raw = (pick(b, ["platform", "source", "channel", "marketplace", "provider"]) || "").toString().toLowerCase();
  if (raw && !AGG.test(raw)) return raw.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 24);
  return "Delivery";
}

// Sum a total from common shapes: an explicit total, or an items[] array of {name, price/amount, quantity}.
function orderTotalAndItems(b) {
  let items = pick(b, ["items", "order.items", "lineItems", "products"]);
  let lines = [];
  let computed = 0;
  if (Array.isArray(items)) {
    for (const it of items.slice(0, 40)) {
      const name = (pick(it, ["name", "title", "productName"]) || "item").toString().slice(0, 60);
      const qty = parseInt(pick(it, ["quantity", "qty", "count"]) || "1", 10) || 1;
      const price = parseFloat(String(pick(it, ["price", "amount", "unitPrice", "totalPrice"]) || "0").replace(/[^0-9.]/g, "")) || 0;
      computed += price * (price && qty ? qty : 1);
      lines.push(`${qty}× ${name}`);
    }
  }
  const explicit = parseFloat(String(pick(b, ["total", "totalAmount", "orderTotal", "amount", "grandTotal", "payment.total"]) || "0").replace(/[^0-9.]/g, "")) || 0;
  const total = explicit || computed;
  return { total, itemsText: lines.join(", ").slice(0, 480) };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const u = new URL(request.url);
    // AUTH — shared secret (header or ?secret=). Secure-by-default: no secret configured → reject.
    const provided = request.headers.get("x-guileo-secret") || u.searchParams.get("secret") || "";
    // constant-time compare — a plain !== leaks secret length/prefix via early-exit timing.
    if (!env.DELIVERY_WEBHOOK_SECRET || !safeEq(provided, env.DELIVERY_WEBHOOK_SECRET)) return json({ error: "unauthorized" }, 401);

    const email = (u.searchParams.get("client") || env.OWNER_EMAIL || "smart@guileoai.com").toString().trim().toLowerCase();
    const b = await request.json().catch(() => ({}));

    const platform = platformOf(b);
    const customer = (pick(b, ["customer.name", "customerName", "customer.firstName", "eater.firstName", "name"]) || "Customer").toString().slice(0, 80);
    const ref = (pick(b, ["id", "orderId", "displayId", "order.id", "reference", "externalId"]) || "").toString().slice(0, 60);
    const when = (pick(b, ["pickupTime", "estimatedReadyTime", "scheduledTime", "createdAt"]) || "").toString().slice(0, 60);
    const { total, itemsText } = orderTotalAndItems(b);
    const details = `${platform}${ref ? ` #${ref}` : ""}${itemsText ? ` · ${itemsText}` : ""}`.slice(0, 500);

    // 1) Live Orders — same store Gui's own orders use, so the Cockpit shows ALL orders in one place.
    try {
      await fetch(`${SB_URL}/rest/v1/gui_actions`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ action: "order", name: customer, contact: "", slot: when, details, business: "", industry: "restaurant", amount: total ? String(total) : "", source: `delivery:${platform}` }),
      });
    } catch { /* never fail the ACK — the aggregator will retry otherwise */ }

    // 2) Revenue ledger — roll marketplace revenue into the Cockpit alongside direct orders.
    if (total > 0 && env.SCHED_SECRET) {
      try {
        const cents = Math.round(total * 100);
        if (isFinite(cents) && cents > 0) {
          await fetch(`${SB_URL}/rest/v1/rpc/revenue_record`, {
            method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
            body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_category: "order", p_amount_cents: cents, p_ref: `${platform}${ref ? ` #${ref}` : ""}`, p_source: `delivery:${platform}`, p_meta: { platform, customer } }),
          });
        }
      } catch { /* ledger is additive */ }
    }

    // 3) Inbox event — so it also surfaces in the portal feed.
    try {
      // ── O PEDIDO COMO OBJETO VIVO, além do evento histórico (2026-08-20) ────────────────
      // O evento `type:"order"` continua sendo o REGISTRO do que aconteceu — não se mexe nele.
      // `biz_orders` é o estado que MUDA: é dele que a Cozinha lê as colunas novo→preparando→pronto.
      // Antes desta linha o dono arrastava o cartão, fechava a aba, e o pedido voltava pro começo.
      // Best-effort: se a gravação do estado falhar, o evento histórico já entrou e o pedido não
      // some do painel — o inverso (perder o registro por causa do estado) seria pior.
      try {
        await svcRpc(env, "biz_order_upsert", {
          p_secret: env.INGEST_SECRET || "", p_email: email,
          p_ref: ref || "", p_platform: platform, p_customer: customer || "",
          p_contact: "", p_items: itemsText || "",
          p_total_cents: Math.round((Number(total) || 0) * 100),
        });
      } catch { /* o estado vivo é um extra; o registro histórico abaixo é o que não pode faltar */ }

      await svcRpc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "order", p_channel: platform, p_summary: `🛵 ${platform} order${total ? ` ($${total})` : ""}: ${itemsText || customer}`.slice(0, 300), p_amount: total || 0, p_payload: { platform, ref, customer } });
    } catch { /* additive */ }

    // 4) COMPANY OS — stitch the order into the customer's 360° contact timeline (best-effort).
    //    Only when we have a real handle (phone/email) to dedupe on, so we don't create junk contacts.
    if (env.SCHED_SECRET) {
      const cphone = (pick(b, ["customer.phone", "customerPhone", "phone", "eater.phone", "contact.phone"]) || "").toString().replace(/[^0-9+]/g, "").slice(0, 20);
      const cemail = (pick(b, ["customer.email", "customerEmail", "email", "eater.email"]) || "").toString().slice(0, 120);
      if (cphone || cemail) {
        try {
          const cents = total > 0 ? Math.round(total * 100) : 0;
          const crmRpc = (fn, body) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.SCHED_SECRET, ...body }) });
          const ur = await crmRpc("crm_upsert_contact", { p_email: email, p_phone: cphone, p_contact_email: cemail, p_name: customer, p_source: `delivery:${platform}`, p_amount_cents: cents });
          const contactId = ur.ok ? await ur.json() : null;
          if (contactId) {
            await crmRpc("crm_log_event", { p_email: email, p_contact_id: contactId, p_type: "order", p_channel: platform, p_summary: `🛵 ${platform} order${total ? ` ($${total})` : ""}: ${itemsText || customer}`.slice(0, 400), p_amount_cents: cents, p_dedupe: `order:${platform}:${ref || when}`, p_payload: { platform, ref } }).catch(() => {});
          }
        } catch { /* never fail the ACK */ }
      }
    }

    // ACK in the shape most aggregators accept (200 + ok). Some expect the order id echoed.
    return json({ ok: true, received: { platform, ref, total } });
  } catch {
    return json({ ok: false }, 200); // 200 so the aggregator doesn't hard-retry on our parse hiccup
  }
}
