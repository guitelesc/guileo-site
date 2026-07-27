// Cloudflare Pages Function — POST /api/seller-dashboard
// The seller's own PANEL (📊) for the /vendedor hub: real KPIs (clients / attributed leads /
// conversions + $ paid / estimated commission) plus an ANONYMIZED leaderboard so a rep can see
// where they rank against the team WITHOUT ever seeing another seller's email or personal code.
//
// AUTH — SELLER only, verified with the SAME roster + team-code gate as /api/onboard-draft
// (sellerAuthFull: DB roster first, env/team-code fallback). The access code never ships in the
// browser bundle. Data comes from two INGEST-gated SECURITY DEFINER RPCs (db/seller_metrics.sql);
// pitches ride from the RATE_LIMIT KV activity counter (same store as /api/seller-stats), so the
// panel shows a real number even before any DB pitch logging exists. personal_code is NEVER read
// or returned here. Same SB/ANON constants + json() helper pattern as the other functions/api files.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (mirrors /api/onboard-draft: DB roster first, then env roster / shared team code) ──
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
// DB roster (db/seller_roster.sql) — source of truth when present. Tried BEFORE the env/team-code
// flow; an RPC 404/error just falls through, NEVER breaks the existing login.
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

// All-time AI-pitch count from the RATE_LIMIT KV activity store (same key as /api/seller-stats).
// Best-effort — a missing KV/binding just yields 0, never breaks the panel.
async function pitchCount(env, email) {
  try {
    const kv = env && env.RATE_LIMIT;
    if (!kv) return 0;
    const v = await kv.get(`sact:${(email || "").toString().trim().toLowerCase()}`);
    const act = v ? JSON.parse(v) : {};
    return Math.max(0, parseInt(act.pitches, 10) || 0);
  } catch { return 0; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "seller-dashboard", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const ING = env.INGEST_SECRET || "";

    const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code || b.token);
    if (!seller) return json({ error: "unauthorized" }, 401);
    // ref: the roster slug wins; the client-supplied ref (localStorage) is a fallback for the leads join.
    const ref = (seller.ref || b.ref || (b.seller && b.seller.ref) || "").toString().slice(0, 40);

    // ── the seller's own KPIs ──
    let dashboard = { clients: { total: 0, live: 0, draft: 0 }, leads_30d: 0, converted: 0, paid: 0, commission_pct: 10, pitches: 0 };
    try {
      const dr = await rpc("seller_dashboard", { p_secret: ING, p_seller_email: seller.email, p_ref: ref });
      if (dr.ok) {
        const d = await dr.json().catch(() => null);
        if (d && typeof d === "object") dashboard = { ...dashboard, ...d };
      }
    } catch { /* degrade to zeros — never a 500 to the hub */ }
    dashboard.pitches = await pitchCount(env, seller.email);
    // estimated commission = pct × real registered payments from converted leads (honest: $0 until paid)
    dashboard.commission_est = Math.round((Number(dashboard.paid) || 0) * (Number(dashboard.commission_pct) || 10)) / 100;

    // ── anonymized team leaderboard — mark "me" here (matching my ref), then STRIP every ref so
    //    the browser never sees another seller's attribution slug. ──
    let leaderboard = [];
    try {
      const lr = await rpc("seller_leaderboard", { p_secret: ING });
      if (lr.ok) {
        const rows = await lr.json().catch(() => []);
        if (Array.isArray(rows)) {
          leaderboard = rows.map((row) => {
            const me = ref && row && row.ref && row.ref.toString().toLowerCase() === ref.toLowerCase();
            return { name: (row.name || "Vendedor").toString(), clients: Number(row.clients) || 0, paid: Number(row.paid) || 0, me: !!me };
          });
        }
      }
    } catch { /* empty board, never a 500 */ }

    return json({ ok: true, dashboard, leaderboard });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
