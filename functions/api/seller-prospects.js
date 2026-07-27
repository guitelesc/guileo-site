// Cloudflare Pages Function — POST /api/seller-prospects
// FOLLOW-UP — the seller's PRIVATE chase CRM. Before a lead becomes a client (that's the
// ➕ Add client / onboard-draft flow), the seller works it here: who they approached, what
// stage it's at (abordado→conversa→demo→proposta→fechado/perdido), the next touch and a note.
//
// AUTH: SELLER only, via sellerAuthFull (the SAME roster + team-code gate as /api/onboard-draft).
// The AUTHENTICATED seller.email is what every RPC receives — NEVER the email from the body — so a
// seller can only ever read/write/delete their OWN prospects (enforced again seller-side in the
// SECURITY DEFINER RPCs, db/seller_prospects.sql). Same SB/ANON + json() pattern as onboard-draft.js.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (mirrors /api/onboard-draft: DB roster → env roster / shared team code) ───────────────
const BOOTSTRAP = [
  { email: "luistelesc@gmail.com", code: "GUILEO-DONO", name: "Luis Teles", ref: "luis" },
  { email: "smart@guileoai.com", code: "GUILEO-DONO", name: "Guileo", ref: "guileo" },
];
const TEAM_CODE_DEFAULT = "GUILEO-TIME-2026";
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
function roster(env) {
  try { if (env && env.SELLER_ROSTER) { const arr = JSON.parse(env.SELLER_ROSTER); if (Array.isArray(arr) && arr.length) return arr; } } catch { /* fall back */ }
  return BOOTSTRAP;
}
function sellerAuth(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!e || !c) return null;
  const match = roster(env).find((s) => (s.email || "").trim().toLowerCase() === e && safeEq(String(s.code || ""), c));
  if (match) return { email: e, name: match.name || e.split("@")[0], ref: (match.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  const teamCode = (env && env.TEAM_INVITE_CODE) || TEAM_CODE_DEFAULT;
  if (safeEq(c, teamCode)) return { email: e, name: e.split("@")[0], ref: slug(e.split("@")[0]) || "team", roster: false };
  return null;
}
// DB roster (db/seller_roster.sql) — tried first, best-effort; an RPC 404/error just falls through.
async function sellerAuthDB(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  const ING = env && env.INGEST_SECRET;
  if (!e || !c || !ING) return null;
  try {
    const r = await rpc("seller_auth_check", { p_secret: ING, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return null;
    return { email: e, name: d.name || e.split("@")[0], ref: (d.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}
async function sellerAuthFull(env, email, code) {
  return (await sellerAuthDB(env, email, code)) || sellerAuth(env, email, code);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "seller-prospects", 90)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "").toString();
    const ING = env.INGEST_SECRET || "glo_ing_7f3da9c2b4e8";

    // AUTH — every action needs a valid seller; the authenticated email is the ONLY scope used below.
    const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code || b.token);
    if (!seller) return json({ error: "unauthorized" }, 401);

    // ── LIST (+ stats) — the seller's whole pipeline in one round-trip ──────────────────────────────
    if (action === "list") {
      const [lr, sr] = await Promise.all([
        rpc("sp_list", { p_secret: ING, p_seller_email: seller.email }),
        rpc("sp_stats", { p_secret: ING, p_seller_email: seller.email }),
      ]);
      if (!lr.ok) return json({ error: "list unavailable (paste db/seller_prospects.sql)" }, 500);
      const rows = await lr.json().catch(() => []);
      const stats = sr.ok ? await sr.json().catch(() => ({})) : {};
      return json({ ok: true, rows: Array.isArray(rows) ? rows : [], stats: stats || {} });
    }

    // ── UPSERT — create (no id) or edit (id) a prospect. seller_email is ALWAYS the authenticated one.
    if (action === "upsert" || action === "save") {
      const p = (b.prospect && typeof b.prospect === "object") ? b.prospect : b;
      const r = await rpc("sp_upsert", {
        p_secret: ING, p_seller_email: seller.email,
        p_id: (p.id || "").toString(),
        p_business: (p.business || "").toString().slice(0, 200),
        p_contact_name: (p.contact_name || "").toString().slice(0, 160),
        p_phone: (p.phone || "").toString().slice(0, 40),
        p_email: (p.email || "").toString().slice(0, 200),
        p_stage: (p.stage || "").toString().slice(0, 20),
        p_note: (p.note || "").toString().slice(0, 1500),
        p_next_at: (p.next_at || "").toString().slice(0, 40),
        p_market: (p.market || "").toString().slice(0, 4),
      });
      if (!r.ok) return json({ error: "save failed (paste db/seller_prospects.sql)" }, 500);
      const row = await r.json().catch(() => null);
      if (!row) return json({ error: "not found" }, 404); // update matched nothing (not the seller's row)
      return json({ ok: true, prospect: row });
    }

    // ── DELETE — hard delete, seller-scoped ────────────────────────────────────────────────────────
    if (action === "delete") {
      const id = (b.id || (b.prospect && b.prospect.id) || "").toString();
      if (!id) return json({ error: "id required" }, 400);
      const r = await rpc("sp_delete", { p_secret: ING, p_seller_email: seller.email, p_id: id });
      if (!r.ok) return json({ error: "delete failed" }, 500);
      return json({ ok: true, deleted: await r.json().catch(() => true) });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
