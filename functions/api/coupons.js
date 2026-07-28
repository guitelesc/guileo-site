// Cloudflare Pages Function — POST /api/coupons  ("motor de crescimento PERSONALIZADO")
// The COUPONS + CAMPAIGNS backend the client (or their seller) drives from their own panel:
// quick-generate coupons, save/list/delete them, validate/redeem a code, and fire branded
// email campaigns that carry the CLIENT'S logo + accent + identity (Natura's, not Guileo's).
// Data lives behind db/coupons.sql (INGEST-gated SECURITY DEFINER RPCs). Brand comes from
// functions/lib/clientBrand.js; every email is rendered by a branded builder in
// functions/lib/emailTemplates.js (house rule: NEVER ad-hoc HTML email).
//
// PER-TENANT GATE — email + connection-key via get_client_data (identical to noshow-radar.js):
// a token can never touch another tenant's coupons/campaigns/customer PII. No OWNER_EMAIL fallback.
//
//   POST { token, email, action, ... }
//   Coupons:   list | upsert{coupon} | delete{id} | validate{code} | redeem{id,contact} | quickgen
//   Campaigns: campaign_list | campaign_upsert{campaign} | campaign_send{campaign_id | campaign}
import { json } from "../lib/guard.js";
import { brandFor, GUILEO_BRAND } from "../lib/clientBrand.js";
import * as tpl from "../lib/emailTemplates.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // ── PER-TENANT GATE (same proven bind noshow-radar / crm use) ──
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

    const action = (b.action || "list").toString();

    // ── QUICKGEN — ready-made coupon presets (NOT saved). One tap in the panel to seed a promo. ──
    if (action === "quickgen") {
      return json({ ok: true, presets: quickgenPresets() });
    }

    // ── COUPONS ──────────────────────────────────────────────────────────────
    if (action === "list") {
      const r = await rpc("coupon_list", { p_secret: secret, p_client_email: email, p_key: key });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/coupons.sql in Supabase to activate coupons.", coupons: [] });
      const coupons = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(coupons) ? coupons.length : 0, coupons });
    }

    if (action === "upsert") {
      const coupon = (b.coupon && typeof b.coupon === "object") ? b.coupon : null;
      if (!coupon || !String(coupon.code || "").trim()) return json({ error: "coupon.code required" }, 400);
      const r = await rpc("coupon_upsert", { p_secret: secret, p_client_email: email, p_coupon: coupon });
      if (!r.ok) return json({ ok: false, ready: false, note: "Paste db/coupons.sql in Supabase to activate coupons." });
      const id = await r.json().catch(() => null);
      return json({ ok: true, id });
    }

    if (action === "delete") {
      const id = (b.id || "").toString();
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid id" }, 400);
      // TENANT-BOUND (db/tenant_money_guardrails.sql): the SQL also matches client_email, so a
      // leaked UUID can never delete another tenant's coupon. 404 = guardrails not pasted yet →
      // fall back to the legacy id-only signature (same behavior as before).
      let r = await rpc("coupon_delete", { p_secret: secret, p_client_email: email, p_id: id });
      if (r.status === 404) r = await rpc("coupon_delete", { p_secret: secret, p_id: id });
      if (!r.ok) return json({ ok: false });
      const deleted = await r.json().catch(() => false);
      return json({ ok: true, deleted: deleted === true });
    }

    if (action === "validate") {
      const code = (b.code || "").toString().trim();
      if (!code) return json({ error: "code required" }, 400);
      const r = await rpc("coupon_validate", { p_secret: secret, p_client_email: email, p_code: code });
      if (!r.ok) return json({ ok: true, valid: false, note: "Paste db/coupons.sql in Supabase to activate coupons." });
      const res = await r.json().catch(() => ({ valid: false }));
      return json({ ok: true, ...(res || {}) });
    }

    if (action === "redeem") {
      const id = (b.id || "").toString();
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid id" }, 400);
      const contact = (b.contact || "").toString().slice(0, 160);
      // TENANT-BOUND redeem (db/tenant_money_guardrails.sql): the atomic increment also matches
      // client_email, so a leaked UUID can never burn another tenant's redemption cap. 404 =
      // guardrails not pasted yet → fall back to the legacy id-only signature (same as before).
      let r = await rpc("coupon_redeem", { p_secret: secret, p_client_email: email, p_id: id, p_contact: contact });
      if (r.status === 404) r = await rpc("coupon_redeem", { p_secret: secret, p_id: id, p_contact: contact });
      if (!r.ok) return json({ ok: false, note: "Paste db/coupons.sql in Supabase to activate coupons." });
      const res = await r.json().catch(() => ({ ok: false }));
      return json(res || { ok: false });
    }

    // ── CAMPAIGNS ────────────────────────────────────────────────────────────
    if (action === "campaign_list") {
      const r = await rpc("campaign_list", { p_secret: secret, p_client_email: email });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/coupons.sql in Supabase to activate campaigns.", campaigns: [] });
      const campaigns = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(campaigns) ? campaigns.length : 0, campaigns });
    }

    if (action === "campaign_upsert") {
      const campaign = (b.campaign && typeof b.campaign === "object") ? b.campaign : null;
      if (!campaign) return json({ error: "campaign required" }, 400);
      const r = await rpc("campaign_upsert", { p_secret: secret, p_client_email: email, p_campaign: campaign });
      if (!r.ok) return json({ ok: false, ready: false, note: "Paste db/coupons.sql in Supabase to activate campaigns." });
      const id = await r.json().catch(() => null);
      return json({ ok: true, id });
    }

    // ── CAMPAIGN SEND — resolve audience → render each client's BRANDED email → Resend → mark sent. ──
    if (action === "campaign_send") {
      // Accept either a saved campaign_id (loaded from campaign_list) or an inline campaign object.
      let campaign = (b.campaign && typeof b.campaign === "object") ? { ...b.campaign } : null;
      const campaignId = (b.campaign_id || (campaign && campaign.id) || "").toString();
      if (!campaign && campaignId) {
        const lr = await rpc("campaign_list", { p_secret: secret, p_client_email: email });
        const list = lr.ok ? ((await lr.json().catch(() => [])) || []) : [];
        campaign = (Array.isArray(list) ? list : []).find((c) => c && c.id === campaignId) || null;
      }
      if (!campaign) return json({ error: "campaign not found" }, 400);

      // Resolve the branded builder by name (promoEmail | couponEmail | newsEmail). Namespace import
      // keeps this file from crashing if the branded-email slice isn't deployed yet.
      const template = (campaign.template || campaign.kind || "promo").toString().toLowerCase();
      const builderName = template === "coupon" ? "couponEmail" : template === "news" ? "newsEmail" : "brandPromoEmail";
      const build = tpl[builderName];
      if (typeof build !== "function") {
        return json({ ok: true, ready: false, sent: 0, note: `Branded email builder ${builderName} not deployed yet (functions/lib/emailTemplates.js).` });
      }

      // The client's own identity (logo/accent/agent_name/business/lang) — Natura's, not Guileo's.
      const brand = await brandFor(env, email).catch(() => ({ ...GUILEO_BRAND }));

      // Attach the linked coupon (if any) so the email can print the code + terms.
      let coupon = null;
      const couponId = (campaign.coupon_id || "").toString();
      if (/^[0-9a-f-]{36}$/i.test(couponId)) {
        const cl = await rpc("coupon_list", { p_secret: secret, p_client_email: email });
        const coupons = cl.ok ? ((await cl.json().catch(() => [])) || []) : [];
        coupon = (Array.isArray(coupons) ? coupons : []).find((c) => c && c.id === couponId) || null;
      }

      // Resolve audience → recipient contacts (crm_contacts, else biz_appointments emails).
      const ar = await rpc("campaign_audience", { p_secret: secret, p_client_email: email, p_segment: (campaign.audience || "all").toString(), p_limit: 500 });
      const audience = ar.ok ? ((await ar.json().catch(() => [])) || []) : [];
      // Dedup + cap the batch (best-effort broadcast, keep it sane).
      const seen = new Set();
      const recipients = [];
      for (const p of (Array.isArray(audience) ? audience : [])) {
        const to = String((p && p.email) || "").trim().toLowerCase();
        if (!isEmail(to) || seen.has(to)) continue;
        seen.add(to);
        recipients.push({ name: (p && p.name) || "", email: to });
        if (recipients.length >= 300) break;
      }

      if (!env.RESEND_API_KEY) return json({ ok: false, sent: 0, note: "RESEND_API_KEY not configured." });

      const from = `${(brand.business || "Guileo").replace(/[<>]/g, "")} <${(env.EMAIL_FROM_ADDR || "noreply@guileoai.com")}>`;
      let sent = 0;
      for (const rcp of recipients) {
        // Render THIS client's branded email. Builders take the resolved brand + campaign fields.
        const built = build({
          brand,
          name: rcp.name || "there",
          business: brand.business,
          lang: brand.lang,
          subject: campaign.subject || "",
          headline: campaign.headline || campaign.subject || "",
          title: campaign.subject || campaign.headline || "",
          message: campaign.body || "",
          body: campaign.body || "",
          coupon,
        }) || {};
        const subject = (campaign.subject && campaign.subject.trim()) || built.subject || "";
        const html = built.html || "";
        if (!html) continue;
        const sr = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [rcp.email], subject, html }),
        });
        if (sr.ok) sent++;
      }

      // Mark the campaign sent (only for a saved campaign).
      if (campaignId && /^[0-9a-f-]{36}$/i.test(campaignId)) {
        await rpc("campaign_mark_sent", { p_secret: secret, p_id: campaignId, p_count: sent }).catch(() => {});
      }
      return json({ ok: true, ready: true, audience: recipients.length, sent });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}

// Deterministic-per-request short code (no Math.random at module scope; fine inside the handler).
function makeCode(prefix) {
  const base = (Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}${base.slice(-5)}`;
}

// Ready-made coupon presets (label/kind/value/terms + a generated CODE) — NOT persisted.
// The panel shows these as one-tap "quick generate" buttons; saving calls action:"upsert".
function quickgenPresets() {
  return [
    { kind: "bogo",    value: null, label: "BOGO — Compre 1, Leve 2",        terms: "Válido em itens selecionados. Não acumula com outras promoções.", code: makeCode("BOGO") },
    { kind: "bogo",    value: null, label: "Buy 1 Get 1 Free",               terms: "On selected items. Cannot be combined with other offers.",        code: makeCode("B1G1") },
    { kind: "bogo",    value: null, label: "Aniversário 1+1",                terms: "No mês do seu aniversário. Um por cliente.",                       code: makeCode("BDAY") },
    { kind: "percent", value: 20,   label: "20% OFF",                        terms: "Desconto de 20% no total. Por tempo limitado.",                    code: makeCode("OFF20") },
    { kind: "percent", value: 10,   label: "10% OFF primeira visita",        terms: "Somente novos clientes, na primeira visita.",                      code: makeCode("NEW10") },
    { kind: "amount",  value: 25,   label: "$25 OFF",                        terms: "Desconto de $25 em compras acima de $100.",                        code: makeCode("SAVE25") },
    { kind: "freebie", value: null, label: "Amigo indica amigo",             terms: "Indique um amigo e ambos ganham um mimo na próxima visita.",       code: makeCode("REF") },
  ];
}
