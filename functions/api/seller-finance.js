// Cloudflare Pages Function — POST /api/seller-finance
// FINANCEIRO DO VENDEDOR — the seller (in /vendedor) opens the "💰 Financeiro" tab and gets their
// HONEST commission ledger: for every client attributed to THEM, the real payments summed and the
// commission (pct × payments) applied, plus per-client rows. Read-only. Never fabricated money.
//
// AUTH — the same seller gate as /api/onboard-draft (sellerAuthFull: DB roster → env roster / team
// code). The response is ALWAYS scoped to the AUTHENTICATED seller — the body email is NEVER used as
// scope, so a shared team code can only ever see the ledger of the identity it authenticated as.
// personal_code is never returned; the ledger carries only client_email/business/paid/commission.
//
// All DB access is through the INGEST-gated SECURITY DEFINER RPC seller_commission_ledger
// (db/seller_finance.sql); the browser never sees a secret. Same SB/ANON + json() pattern as siblings.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (mirrors /api/onboard-draft: DB roster first, then env roster / shared team code) ─────
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
  // team-code sellers are real but unverified (anyone with the shared code can claim any email);
  // still scoped to WHOEVER they authenticated as — the ref just derives from the claimed email.
  if (safeEq(c, teamCode)) return { email: e, name: e.split("@")[0], ref: slug(e.split("@")[0]) || "team", roster: false };
  return null;
}
// DB roster (db/seller_roster.sql) — source of truth when present. An RPC 404/error falls through,
// NEVER breaks login. A DB seller is roster:true and its ref is the canonical ref_slug.
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
    if (await rateLimited(request, env, "seller-finance", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const ING = env.INGEST_SECRET || "";

    // Authenticate the seller. The email/code come from the body; whatever identity they prove is the
    // ONLY scope used — we resolve the ref from the AUTHENTICATED seller, never from an arbitrary body.
    const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code || (b.seller && b.seller.code));
    if (!seller) return json({ error: "unauthorized" }, 401);
    // The SHARED team code (roster:false) must NOT open another seller's financial ledger — it lets
    // the caller type any email. Financial data needs a PERSONAL roster code (roster:true). Same guard
    // as seller-payouts.js. A team-code seller sees only their own dashboard counts, not the ledger.
    if (!seller.roster) return json({ error: "unauthorized" }, 401);

    // Call the ledger RPC with the AUTHENTICATED seller's email (wallet + pct scope) and their ref
    // (attribution slug). The RPC prefers sellers.ref_slug from the email and treats ref as fallback.
    const r = await rpc("seller_commission_ledger", {
      p_secret: ING, p_seller_email: seller.email, p_ref: seller.ref || "",
    });
    if (!r.ok) return json({ error: "finance unavailable (paste db/seller_finance.sql)" }, 500);
    const d = await r.json().catch(() => null);
    if (!d || typeof d !== "object") return json({ error: "finance unavailable" }, 500);

    // Freeze the contract shape { ok, pct, totals:{paid,commission,clients}, ledger:[...] }.
    const totals = (d.totals && typeof d.totals === "object") ? d.totals : {};
    return json({
      ok: true,
      pct: Number(d.pct) || 10,
      totals: {
        paid:       Number(totals.paid) || 0,
        commission: Number(totals.commission) || 0,
        clients:    Number(totals.clients) || 0,
      },
      ledger: Array.isArray(d.ledger) ? d.ledger : [],
    });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
