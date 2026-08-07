// Cloudflare Pages Function — POST /api/seller-login
// Per-seller access gate for the /vendedor hub. The roster is validated SERVER-SIDE so no
// access code ever ships in the client bundle. Roster source priority:
//   1. env.SELLER_ROSTER — a JSON array Luis edits in Cloudflare: [{email, code, name, ref}]
//   2. a small bootstrap roster (below) so the hub is usable immediately before SELLER_ROSTER is set.
// On success returns the seller's PUBLIC profile only (name, email, ref) — never the code.
// `ref` flows into the existing ?ref= attribution pipeline so Track-A commissions are credited.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
import { signSession } from "../lib/sellerSession.js";

// DB roster (db/seller_roster.sql) — the source of truth when present, managed from /admin. Checked
// best-effort BEFORE the env/bootstrap flow: an RPC 404/error just falls through, NEVER breaks login.
const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
async function sellerAuthDB(env, email, code) {
  const ING = env && env.INGEST_SECRET;
  if (!ING || !email || !code) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/seller_auth_check`, {
      method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: ING, p_email: email, p_code: code }),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return null;
    return { name: d.name || email.split("@")[0], email, ref: (d.ref || email.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}

// Personal-code login (db/ops_gaps.sql · seller_code_check). The code is bound to a seller's identity
// SERVER-SIDE, so it's impossible to claim another seller's ref by typing their email — the ref comes
// from the DB row the code belongs to, never from the typed email. This is the impersonation-proof path.
async function sellerCodeLogin(env, code) {
  const ING = env && env.INGEST_SECRET;
  if (!ING || !code) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/seller_code_check`, {
      method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: ING, p_code: code }),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || !d.ok || !d.seller_email) return null;
    const em = d.seller_email.toString().toLowerCase();
    return { name: d.name || em.split("@")[0], email: em, ref: (d.ref || em.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}

// May the SHARED team-invite code log in as this email? It must NOT when the email belongs to a
// protected seller — else anyone holding the team code claims that seller's ref + commissions.
// Protected = (a) listed in SELLER_ROSTER/BOOTSTRAP (checked SYNCHRONOUSLY, so it holds even if the DB
// is down), OR (b) owns a personal code in the DB. Adversarial review caught two holes in the first
// version: it ignored the env/bootstrap roster, and it failed OPEN on a DB error. Both fixed here —
// the DB check now FAILS CLOSED (can't verify → don't risk impersonation; the new collaborator just
// retries once the DB is reachable). Returns { blocked, reason }.
async function teamCodeProtected(env, email) {
  // (a) roster-listed sellers are always protected — no DB needed.
  if (roster(env).some((s) => (s.email || "").trim().toLowerCase() === email)) {
    return { blocked: true, reason: "personal_code_required" };
  }
  const ING = env && env.INGEST_SECRET;
  if (!ING) return { blocked: false }; // no DB configured → team code is the only path (legacy)
  // (b) DB personal-code check — FAIL CLOSED on any error.
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/seller_email_registered`, {
      method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: ING, p_email: email }),
    });
    if (!r.ok) return { blocked: true, reason: "verify_failed" };
    const d = await r.json().catch(() => null);
    if (!d) return { blocked: true, reason: "verify_failed" };
    return d.has_code === true ? { blocked: true, reason: "personal_code_required" } : { blocked: false };
  } catch { return { blocked: true, reason: "verify_failed" }; }
}

// Bootstrap roster — used only when SELLER_ROSTER is unset. Codes live in server source (never the
// browser bundle). Luis can set env.SELLER_ROSTER with named sellers + personal codes and rotate these.
const BOOTSTRAP = [
  { email: "luistelesc@gmail.com", code: "GUILEO-DONO", name: "Luis Teles", ref: "luis" },
  { email: "smart@guileoai.com", code: "GUILEO-DONO", name: "Guileo", ref: "guileo" },
];

// SHARED TEAM INVITE CODE — the frictionless path: any collaborator self-registers with their
// name + email + this one code (no per-seller setup). Their attribution `ref` is derived from their
// email automatically. Override via env.TEAM_INVITE_CODE; rotate by changing it and redeploying.
const TEAM_CODE_DEFAULT = "GUILEO-TIME-2026";
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function roster(env) {
  try {
    if (env && env.SELLER_ROSTER) {
      const arr = JSON.parse(env.SELLER_ROSTER);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch { /* malformed env → fall back to bootstrap */ }
  return BOOTSTRAP;
}

// Toda saída de sucesso passa por aqui: anexa o CRACHÁ assinado (sid) ao perfil.
// Sem isso o /api/pitch-ai não tem como saber que quem chama passou pelo login — era
// exatamente o buraco: as ferramentas de IA do vendedor rodavam pra qualquer visitante.
// `sid` null (sem INGEST_SECRET) NÃO quebra o login; o pitch-ai é que recusa.
async function okSeller(env, seller) {
  const sid = await signSession(env, seller.email);
  return json({ ok: true, seller: { ...seller, sid } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // Throttle credential-stuffing: ≤ 12 attempts / minute / IP.
    if (await rateLimited(request, env, "seller-login", 12)) return json({ error: "too many attempts" }, 429);
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const code = (b.code || "").toString().trim();
    const typedName = (b.name || "").toString().trim().slice(0, 60);
    if (!email || !code) return json({ error: "missing" }, 400);

    // 0) DB roster (managed in /admin) — source of truth when present. best-effort; error → fall through.
    const dbSeller = await sellerAuthDB(env, email, code);
    if (dbSeller) return okSeller(env, dbSeller);

    // 0.4) PERSONAL CODE — the code alone identifies the seller server-side (impersonation-proof: the
    //      ref comes from the DB row the code owns, NOT the typed email). Wins over the shared team code.
    const codeSeller = await sellerCodeLogin(env, code);
    if (codeSeller) return okSeller(env, codeSeller);

    // 1) Named seller with a personal code (roster) — wins, so custom name/ref are honored.
    const match = roster(env).find(
      (s) => (s.email || "").trim().toLowerCase() === email && safeEq(String(s.code || ""), code)
    );
    if (match) {
      return okSeller(env, {
        name: match.name || email.split("@")[0],
        email,
        ref: (match.ref || email.split("@")[0]).toString().slice(0, 40),
      });
    }

    // 2) Shared TEAM invite code — any collaborator self-registers; ref derived from their email.
    //    SECURITY: if this email already locked a PERSONAL code, the shared code must NOT log in as it
    //    (else anyone holding the team code could claim that seller's ref + commissions). Force the
    //    personal code. Brand-new emails (no personal code yet) still self-register frictionlessly.
    const teamCode = (env && env.TEAM_INVITE_CODE) || TEAM_CODE_DEFAULT;
    if (safeEq(code, teamCode)) {
      const prot = await teamCodeProtected(env, email);
      if (prot.blocked) {
        if (prot.reason === "verify_failed") {
          return json({ ok: false, error: "verify_unavailable",
            message: "Não consegui verificar seu acesso agora. Tente de novo em instantes." }, 503);
        }
        return json({ ok: false, error: "personal_code_required",
          message: "Este email já tem um código pessoal. Entre com ele (não o código do time) pra proteger suas comissões." }, 403);
      }
      return okSeller(env, {
        name: typedName || email.split("@")[0],
        email,
        ref: slug(email.split("@")[0]) || "team",
      });
    }

    return json({ ok: false, error: "invalid" }, 401);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
