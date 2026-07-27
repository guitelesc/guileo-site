// Cloudflare Pages Function — POST /api/contract  (COMPANY OS · ADMIN/LEGAL: contracts & quotes)
// Admin/portal actions (list, upsert) are gated by the same blitz_stats token as the other ops
// endpoints. The signer path (by_token, sign) needs NO login — the per-doc sign_token is the
// capability. Gracefully reports ready:false until db/contracts.sql is pasted.
import { json, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "contract", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "list").toString();
    const secret = env.SCHED_SECRET || "";

    // ── PUBLIC (capability token) — the counterparty signs without any login ──
    if (action === "by_token") {
      const r = await rpc("contract_by_token", { p_token: (b.sign_token || "").toString() });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/contracts.sql to activate contracts.", doc: null });
      const rows = (await r.json()) || [];
      return json({ ok: true, ready: true, doc: rows[0] || null });
    }
    if (action === "sign") {
      const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
      const r = await rpc("contract_sign_token", { p_token: (b.sign_token || "").toString(), p_signer_name: (b.signer_name || "").toString(), p_ip: ip.split(",")[0].trim() });
      if (!r.ok) return json({ ok: false, signed: false }, 200);
      const ok = await r.json();
      return json({ ok: true, signed: ok === true });
    }

    // ── ADMIN/PORTAL — gated by the blitz token (same as /api/crm, /api/noshow-radar) ──
    const vr = await rpc("blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);
    // require a real email — no OWNER_EMAIL fallback (a blank email must never default to the
    // owner's contracts). Dual-path per-tenant binding for `list` is tracked in docs/GO-LIVE.md.
    const email = (b.email || "").toString().trim().toLowerCase();
    if (!email.includes("@")) return json({ error: "unauthorized" }, 401);

    if (action === "upsert") {
      const r = await rpc("contract_upsert", {
        p_secret: secret, p_email: email, p_id: b.id || null, p_kind: b.kind || "contract", p_scope: b.scope || "guileo_client",
        p_template: b.template || null, p_lang: b.lang || "pt", p_title: b.title || null, p_counterparty_name: b.counterparty_name || null,
        p_counterparty_email: b.counterparty_email || null, p_amount_cents: parseInt(b.amount_cents, 10) || 0, p_body: b.body || {}, p_status: b.status || "draft", p_contact_id: b.contact_id || null,
      });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/contracts.sql to activate contracts." });
      const id = await r.json();
      return json({ ok: true, ready: true, id });
    }

    // default: list
    const r = await rpc("contract_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 1000) });
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/contracts.sql to activate contracts.", docs: [] });
    const docs = (await r.json()) || [];
    return json({ ok: true, ready: true, count: docs.length, docs });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
