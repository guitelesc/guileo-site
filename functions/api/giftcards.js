// Cloudflare Pages Function — POST /api/giftcards  ("motor de crescimento PERSONALIZADO" · RECEITA RECORRENTE)
// The GIFT-CARD backend the client (or their seller) drives from their own panel: issue a card (code +
// balance), list them, validate a code, and redeem against the balance (atomic gift_card_redeem). Data
// lives behind db/recurring_revenue.sql (INGEST-gated SECURITY DEFINER RPCs). The "buy" action mints a
// Stripe Checkout link (mode=payment) the owner can SEND so a customer pays for the gift card online; the
// stripe webhook then issues the card on success (metadata { guileo:'giftcard', client_email, amount_cents }).
//
// PER-TENANT GATE — email + connection-key via get_client_data (identical to noshow-radar.js / coupons.js):
// a token can never touch another tenant's gift cards. No OWNER_EMAIL fallback.
//
//   POST { token, email, action, ... }
//     list                                            -> { ready, cards:[...] }
//     create{ card:{amount_cents,code?,purchaser_contact?,recipient_contact?} } -> { ok, card }
//     validate{ code }                                -> { valid, card? }
//     redeem{ code, amount_cents }                    -> { ok, balance_cents, redeemed_cents }
//     buy{ amount_cents, recipient_contact?, purchaser_contact? } -> { ok, url, via? }   (Stripe Checkout:
//        Stripe PRÓPRIO do negócio quando há chave; senão plataforma; sem nenhum → payments_not_connected)
import { json } from "../lib/guard.js";
import { camposDoDestino } from "../lib/contaDoCliente.js";
import { caminhoDaVenda, criarVendaPropria } from "../lib/vendaOnlineNegocio.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

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
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const NOTE = "Paste db/recurring_revenue.sql in Supabase to activate gift cards.";

    const action = (b.action || "list").toString();

    if (action === "list") {
      const r = await rpc("giftcard_list", { p_secret: secret, p_client_email: email, p_key: key });
      if (!r.ok) return json({ ok: true, ready: false, note: NOTE, cards: [] });
      const cards = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(cards) ? cards.length : 0, cards });
    }

    if (action === "create") {
      const card = (b.card && typeof b.card === "object") ? b.card : null;
      const amt = Math.round(Number(card && card.amount_cents) || 0);
      if (!card || !isFinite(amt) || amt <= 0) return json({ error: "card.amount_cents required" }, 400);
      // Same ceiling as "buy": an absurd face value (or an int4-overflowing number) never becomes a card.
      if (amt > ((Number(env.MAX_CHARGE_USD) || 100000) * 100)) return json({ error: "amount exceeds the cap" }, 400);
      const r = await rpc("giftcard_create", { p_secret: secret, p_client_email: email, p_card: { ...card, amount_cents: amt } });
      if (!r.ok) return json({ ok: false, ready: false, note: NOTE });
      const res = await r.json().catch(() => null);
      return json({ ok: true, card: res });
    }

    if (action === "validate") {
      const code = (b.code || "").toString().trim();
      if (!code) return json({ error: "code required" }, 400);
      const r = await rpc("giftcard_validate", { p_secret: secret, p_client_email: email, p_code: code });
      if (!r.ok) return json({ ok: true, valid: false, note: NOTE });
      const res = await r.json().catch(() => ({ valid: false }));
      return json({ ok: true, ...(res || {}) });
    }

    if (action === "redeem") {
      const code = (b.code || "").toString().trim();
      const amt = Math.round(Number(b.amount_cents) || 0);
      if (!code) return json({ error: "code required" }, 400);
      if (!isFinite(amt) || amt <= 0) return json({ error: "amount_cents required" }, 400);
      // Ceiling guard: a huge redeem amount can't int4-overflow the RPC into a misleading error.
      if (amt > ((Number(env.MAX_CHARGE_USD) || 100000) * 100)) return json({ error: "amount exceeds the cap" }, 400);
      const r = await rpc("gift_card_redeem", { p_secret: secret, p_client_email: email, p_code: code, p_amount_cents: amt });
      if (!r.ok) return json({ ok: false, note: NOTE });
      const res = await r.json().catch(() => ({ ok: false }));
      return json(res || { ok: false });
    }

    // ── BUY — mint a Stripe Checkout link (mode=payment) for a gift-card amount. ──
    // The card is ISSUED by the stripe webhook on success (metadata carries the amount + contacts).
    if (action === "buy") {
      const cents = Math.round(Number(b.amount_cents) || 0);
      if (!isFinite(cents) || cents < 50) return json({ error: "amount_cents too low (min $0.50)" }, 400);
      const MAX = (Number(env.MAX_CHARGE_USD) || 100000) * 100;
      if (cents > MAX) return json({ error: "amount exceeds the cap" }, 400);
      // PARA ONDE VAI O DINHEIRO (2026-09-30): para a conta Stripe DO NEGÓCIO, ou a venda não
      // acontece. Antes este checkout saía sem destino e o pagamento cairia na conta da Guileo.
      // 2026-10-05 (lib/vendaOnlineNegocio.js): chave PRÓPRIA do negócio (Stripe dos EUA) → a sessão
      // nasce na conta dele; o vale nasce na volta /api/venda-paga ou na conferência de hora em hora
      // (mesma SQL do webhook, uma vez só). Sem nada → payments_not_connected (EUA: guileoai.com/receber).
      const recipient = (b.recipient_contact || "").toString().slice(0, 160);
      const purchaser = (b.purchaser_contact || "").toString().slice(0, 160);
      const caminho = await caminhoDaVenda(env, email);
      if (caminho.via === "recusa") return json(caminho.corpo);
      if (caminho.via === "propria") {
        const res = await criarVendaPropria(env, { tenant: email, chave: caminho.chave, kind: "giftcard", cents, recipient, purchaser, recipientName: String(b.recipient_name || ""), message: String(b.message || "") });
        if (!res.ok) return json({ ok: false, ...res }, res.reason === "stripe_error" || res.reason === "stripe_rejected_key" || res.reason === "permission_missing" ? 503 : 400);
        return json({ ok: true, url: res.url, id: res.id, via: "stripe_own", conferencia: res.conferencia });
      }
      const destino = caminho.destino;
      if (!env.STRIPE_SECRET_KEY) return json({ ok: false, ready: false, note: "Set STRIPE_SECRET_KEY in Cloudflare to sell online." });
      const form = {
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(cents),
        "line_items[0][price_data][product_data][name]": `Gift card — $${(cents / 100).toFixed(2)}`,
        // quem paga é a CLIENTE do negócio — ela não tem painel. /api/obrigado diz o que aconteceu.
        success_url: `https://guileoai.com/api/obrigado?o=${"gift"}`,
        cancel_url: "https://guileoai.com/api/obrigado?o=cancel",
        "metadata[guileo]": "giftcard",
        "metadata[client_email]": email,
        "metadata[amount_cents]": String(cents),
        "metadata[recipient_contact]": recipient,
        "metadata[purchaser_contact]": purchaser,
        // nome de quem ganha e o recado vão no e-mail do vale (webhook → enviarValePresente)
        ...(String(b.recipient_name || "").replace(/[\r\n]+/g, " ").trim() ? { "metadata[recipient_name]": String(b.recipient_name).replace(/[\r\n]+/g, " ").trim().slice(0, 80) } : {}),
        ...(String(b.message || "").trim() ? { "metadata[gift_message]": String(b.message).trim().slice(0, 400) } : {}),
        "payment_intent_data[metadata][guileo]": "giftcard",
        "payment_intent_data[metadata][client_email]": email,
        "payment_intent_data[metadata][amount_cents]": String(cents),
        // A Stripe promo code could discount a gift card below its face value — a coupon must never
        // hand out full value. Keep checkout at the exact amount the buyer is paying for.
        allow_promotion_codes: "false",
        ...camposDoDestino(destino, { cents, feePct: parseFloat(env.GUILEO_FEE_PCT || "0") }),
      };
      const sr = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(form).toString(),
      });
      const sd = await sr.json().catch(() => ({}));
      if (!sr.ok) return json({ ok: false, error: (sd?.error?.message || `stripe ${sr.status}`).slice(0, 200) }, 503);
      return json({ ok: true, url: sd.url || "", id: sd.id || "" });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
