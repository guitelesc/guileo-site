// Cloudflare Pages Function — POST /api/seller-payouts
// REPASSES (payouts) de comissão — fecha o ciclo do dinheiro do vendedor.
//   ADMIN (gate blitz_stats, como seller-admin.js):
//     • { action:"record", seller_email, amount_cents, note, period, dedupe_key } → lança repasse (idempotente)
//     • { action:"list",   seller_email }                                          → histórico de UM vendedor
//   VENDEDOR (auth do seller-finance.js):
//     • { action:"mine" } → SÓ os repasses DELE + o saldo devido DELE (nunca de outro)
//
// Toda escrita/leitura passa pelas RPCs INGEST-gated de db/seller_payouts.sql; o browser nunca vê segredo.
// amount_cents é validado no servidor (inteiro > 0) ANTES de tocar o banco. Escopo do vendedor = SEMPRE
// a identidade autenticada; o email do body só é escopo nas ações ADMIN (que já passaram pelo gate admin).
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── ADMIN gate — same RPC as seller-admin.js. A wrong token raises → non-200. ─────────────────────────
async function adminOk(token) {
  const vr = await rpc("blitz_stats", { p_token: (token || "").toString(), p_email: "" });
  return vr.ok;
}

// ── SELLER auth (mirrors seller-finance.js: DB roster first, then env roster / shared team code) ───────
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

// Read the seller's payouts list + balance in one shot (both scoped to their email).
async function mineFor(ING, email, ref = "") {
  const [lr, br] = await Promise.all([
    rpc("seller_payouts_list", { p_secret: ING, p_seller_email: email }),
    rpc("seller_balance", { p_secret: ING, p_seller_email: email, p_ref: ref }),
  ]);
  const payouts = lr.ok ? await lr.json().catch(() => []) : null;
  const balance = br.ok ? await br.json().catch(() => null) : null;
  return { payouts: Array.isArray(payouts) ? payouts : [], balance };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "seller-payouts", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "").toString();
    const ING = env.INGEST_SECRET || "";

    // ── VENDEDOR: só o seu próprio saldo + histórico ────────────────────────────────────────────────
    if (action === "mine") {
      const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code || (b.seller && b.seller.code));
      if (!seller) return json({ error: "unauthorized" }, 401);
      if (!seller.roster) return json({ error: "unauthorized" }, 401);   // código de time compartilhado NÃO abre dados financeiros
      const { payouts, balance } = await mineFor(ING, seller.email, seller.ref || "");
      if (!balance) return json({ error: "payouts unavailable (paste db/seller_payouts.sql)" }, 500);
      return json({
        ok: true,
        balance: {
          commission_cents: Number(balance.commission_cents) || 0,
          paid_out_cents:   Number(balance.paid_out_cents) || 0,
          due_cents:        Number(balance.due_cents) || 0,
        },
        payouts,
      });
    }

    // ── ADMIN-only daqui pra baixo (mesmo gate do seller-admin.js) ───────────────────────────────────
    if (action === "record" || action === "list") {
      if (!await adminOk(b.token)) return json({ error: "unauthorized" }, 401);

      if (action === "list") {
        const email = (b.seller_email || "").toString().trim().toLowerCase();
        if (!email.includes("@")) return json({ error: "email required" }, 400);
        const { payouts, balance } = await mineFor(ING, email);
        if (!balance) return json({ error: "payouts unavailable (paste db/seller_payouts.sql)" }, 500);
        return json({ ok: true, balance, payouts });
      }

      // record — validate amount_cents as a POSITIVE INTEGER on the server before touching the bank.
      const email = (b.seller_email || "").toString().trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "email inválido" }, 400);
      const amount = Number(b.amount_cents);
      if (!Number.isInteger(amount) || amount <= 0) return json({ error: "amount_cents deve ser inteiro positivo" }, 400);
      // dois repasses LEGÍTIMOS de mesmo valor sem período colidiriam na auto-key (o 2º sumiria
      // silencioso) — exigir uma identidade explícita: dedupe_key da UI OU um period não-vazio.
      if (!(b.dedupe_key || "").toString().trim() && !(b.period || "").toString().trim())
        return json({ error: "informe period (ex.: 2026-07) ou dedupe_key" }, 400);

      const r = await rpc("seller_payout_record", {
        p_secret: ING, p_seller_email: email, p_amount_cents: amount,
        p_note: (b.note || "").toString().slice(0, 200),
        p_period: (b.period || "").toString().slice(0, 40),
        // dedupe_key: the admin UI SHOULD pass a stable idempotency token per submit; if blank the RPC
        // derives one from the body (seller+period+amount) — never from timestamp — to block double pay.
        p_dedupe_key: (b.dedupe_key || "").toString().slice(0, 80),
      });
      if (!r.ok) return json({ error: "repasse falhou (paste db/seller_payouts.sql)" }, 500);
      const d = await r.json().catch(() => null);
      if (!d || !d.ok) return json({ error: "repasse falhou" }, 500);
      return json({ ok: true, duplicate: d.duplicate === true, payout: d.payout || null });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
