// Cloudflare Pages Function — POST /api/seller-leads
// Server side of the LEAD BOSS mini-CRM (src/data/leadBoss.js + SellerProspect.jsx). Persists each
// seller's status/notes/activity-log for the seeded prospect bench so it survives across devices
// (localStorage stays as an offline cache/fallback client-side).
//
// AUTH:
//   • seller actions (list/save) → sellerAuthFull (SAME roster + team-code gate as onboard-draft /
//     seller-prospects). The AUTHENTICATED seller.email is the ONLY scope passed to the RPC — a
//     seller can only ever read/write their OWN board.
//   • admin action (all) → blitz_stats(token) admin gate (same as seller-admin) → aggregate view.
// All DB access is via service_role (svcRpc) against SECURITY DEFINER RPCs that are NOT granted to
// anon (db/seller_lead_crm.sql), gated server-side by INGEST_SECRET. Nothing tenant-crossing.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const anonRpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (mirrors seller-prospects.js: DB roster → env roster / shared team code) ──────────
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
async function sellerAuthDB(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  const ING = env && env.INGEST_SECRET;
  if (!e || !c || !ING) return null;
  try {
    const r = await svcRpc(env, "seller_auth_check", { p_secret: ING, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return null;
    return { email: e, name: d.name || e.split("@")[0], ref: (d.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}
async function sellerAuthFull(env, email, code) {
  return (await sellerAuthDB(env, email, code)) || sellerAuth(env, email, code);
}

// Admin gate — same RPC as seller-admin / onboard-client. Wrong token raises → non-200.
async function adminOk(token) {
  try { const r = await anonRpc("blitz_stats", { p_token: (token || "").toString(), p_email: "" }); return r.ok; }
  catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "seller-leads", 120)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "list").toString();
    const ING = env.INGEST_SECRET || ""; // fail-closed: no secret literal fallback shipped

    // ADMIN aggregate — never touches per-seller identity.
    if (action === "all") {
      if (!await adminOk(b.token)) return json({ error: "unauthorized" }, 401);
      try {
        const r = await svcRpc(env, "seller_lead_crm_all", { p_secret: ING });
        const rows = r.ok ? await r.json().catch(() => []) : [];
        return json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
      } catch { return json({ ok: true, rows: [] }); }
    }

    // ADMIN — platform-wide stats for the motors built this session (email suppression/campaigns +
    // client & seller lead activity). Read-only aggregate, no per-tenant identity.
    if (action === "motors") {
      if (!await adminOk(b.token)) return json({ error: "unauthorized" }, 401);
      try {
        const r = await svcRpc(env, "platform_motor_stats", { p_secret: ING });
        const stats = r.ok ? await r.json().catch(() => ({})) : {};
        return json({ ok: true, stats: stats && typeof stats === "object" ? stats : {} });
      } catch { return json({ ok: true, stats: {} }); }
    }

    // SELLER actions — the authenticated email is the ONLY scope.
    const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code || b.token);
    if (!seller) return json({ error: "unauthorized" }, 401);

    // SECURITY (adversarial review 2026-07-30): the shared TEAM code (roster:false) accepts ANY typed
    // email with no identity binding — so a team member could pass another seller's email and read/poison
    // their DB board. Only ROSTER sellers (personal code, identity-bound) get the server-side sync; team-
    // code sellers keep their localStorage board only (the component already falls back to it). No cross-
    // seller DB access via the shared code.
    if ((action === "list" || action === "save") && !seller.roster) {
      return json(action === "list" ? { ok: true, crm: {}, local: true } : { ok: true, local: true });
    }

    if (action === "list") {
      try {
        const r = await svcRpc(env, "seller_lead_crm_list", { p_secret: ING, p_seller_email: seller.email });
        const crm = r.ok ? await r.json().catch(() => ({})) : {};
        return json({ ok: true, crm: crm && typeof crm === "object" ? crm : {} });
      } catch { return json({ ok: true, crm: {} }); }
    }

    if (action === "save") {
      const leadId = (b.lead_id || "").toString().slice(0, 80);
      if (!leadId) return json({ error: "lead_id required" }, 400);
      const status = (b.status || "novo").toString();
      const notes = (b.notes || "").toString().slice(0, 2000);
      const log = Array.isArray(b.log) ? b.log.slice(0, 40) : [];
      try {
        const r = await svcRpc(env, "seller_lead_crm_upsert", {
          p_secret: ING, p_seller_email: seller.email, p_lead_id: leadId, p_status: status, p_notes: notes, p_log: log,
        });
        const ok = r.ok && !!(await r.json().catch(() => null));
        return json({ ok });
      } catch { return json({ ok: false }); }
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 500);
  }
}
