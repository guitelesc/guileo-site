// Cloudflare Pages Function — POST /api/seller-stats
// Per-seller GOALS + activity metrics for the /vendedor hub, plus an admin-gated "all" view that
// powers Luis's central control panel (BROTO → Vendedores). Storage = the RATE_LIMIT KV namespace
// already bound in prod (no new infra, no SQL to paste) under sane key prefixes; seller keys are
// written WITHOUT a TTL so they persist. Low-sensitivity sales data; sameOrigin + rate-limited.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";

// Admin gate mirrors /api/broto: admin_site_stats raises on a wrong token → non-200.
const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const emailKey = (e) => (e || "").toString().trim().toLowerCase();
const goalKey = (e) => `sgoal:${emailKey(e)}`;
const actKey = (e) => `sact:${emailKey(e)}`;
const IDX = "sidx";

async function kvGetJson(kv, key, fallback) {
  try { const v = await kv.get(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (mirrors /api/seller-dashboard + /api/onboard-draft: DB roster first, then env
// roster / shared team code). me/log/goals may only read/write the AUTHENTICATED seller's own data,
// never an arbitrary body email. personal_code stays server-side; the access code never ships in the bundle.
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

// (commissionPct saiu daqui em 2026-08-25: o pct agora vem DO MESMO ledger que devolve o
//  valor da comissão — duas fontes para a mesma taxa era como as duas comissões nasceram.)

// Count the website leads attributed to a seller's ?ref= (lives in gui_actions.details as
// "👤ref:<ref>"). Gated by the same SCHED_SECRET RPC every server function uses. Returns null
// when the secret/ref is missing or the RPC errors → the UI then hides the "attributed leads" stat.
async function leadCount(env, ref) {
  const secret = env && env.SCHED_SECRET;
  if (!secret || !ref) return null;
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/seller_lead_count`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: secret, p_ref: ref }),
    });
    if (!r.ok) return null;
    const n = await r.json();
    return typeof n === "number" ? n : null;
  } catch { return null; }
}

// ── UM SÓ NÚMERO DE COMISSÃO (corrigido 2026-08-25) ─────────────────────────────────────────
// Metas lia `seller_conversions` (atribuição por 2 caminhos) enquanto Financeiro lia
// `seller_commission_ledger` (3 caminhos, com corte por transferência de carteira e refund-net).
// Resultado: DUAS comissões diferentes para o MESMO vendedor, nas duas abas do mesmo hub — e a
// primeira coisa que um vendedor faz ao ver dois números do próprio dinheiro é parar de acreditar
// nos dois. Agora Metas lê O MESMO LEDGER que o Financeiro. Contagem de LEADS continua vindo do
// `seller_lead_count` (é outra métrica: quem chegou, não quem pagou).
//
// ⚠️ SEM ESTIMATIVA DISFARÇADA DE FATO. Existia um `kind:"potential"` = leads × $897 × pct. Isso
// é dinheiro INVENTADO: nenhum desses leads pagou nada. Falhou a leitura → devolve o MOTIVO e a
// tela mostra estado de erro. "Não consegui ler" é informação; um número bonito e falso não é.
async function ledgerCommission(env, sellerEmail, ref) {
  const ING = env && env.INGEST_SECRET;
  if (!ING) return { erro: "INGEST_SECRET ausente no ambiente" };
  if (!sellerEmail) return { erro: "vendedor sem e-mail" };
  try {
    const r = await rpc("seller_commission_ledger", { p_secret: ING, p_seller_email: sellerEmail, p_ref: (ref || "").toString().slice(0, 40) });
    if (!r.ok) return { erro: `banco respondeu ${r.status} (cole db/seller_finance.sql)` };
    const d = await r.json().catch(() => null);
    // objeto ausente é ERRO, não "zero" — `|| {}` aqui viraria "$0 ganhos" para quem ganhou.
    if (!d || typeof d !== "object" || !d.totals || typeof d.totals !== "object") return { erro: "resposta do ledger vazia/sem totais" };
    return {
      comissao: {
        kind: "earned",
        pct: Number(d.pct) || 10,
        // `clients` do ledger = clientes que REALMENTE pagaram (o ledger só lista paid > 0).
        converted: Number(d.totals.clients) || 0,
        paid: Number(d.totals.paid) || 0,
        earned: Number(d.totals.commission) || 0,
      },
    };
  } catch (e) { return { erro: String(e).slice(0, 140) }; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "seller-stats", 40)) return json({ error: "too many requests" }, 429);
    const kv = env.RATE_LIMIT;
    if (!kv) return json({ ok: true, ready: false, note: "KV not bound — stats persistence unavailable." });

    const b = await request.json().catch(() => ({}));
    const action = (b.action || "me").toString();

    // ── admin: every seller's goals + activity (central control panel) ──
    if (action === "all") {
      const gate = await fetch(`${SB}/rest/v1/rpc/admin_site_stats`, {
        method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: (b.token || "").toString() }),
      });
      if (!gate.ok) return json({ error: "unauthorized" }, 401);
      const idx = await kvGetJson(kv, IDX, []);
      const sellers = [];
      for (const email of idx.slice(0, 500)) {
        const act = await kvGetJson(kv, actKey(email), {});
        const goals = await kvGetJson(kv, goalKey(email), {});
        const attributedLeads = await leadCount(env, act.ref);
        const lc = await ledgerCommission(env, email, act.ref);
        sellers.push({ email, name: act.name || email.split("@")[0], ref: act.ref || "", act, goals, attributedLeads,
          commissions: lc.comissao || null, commissionsErro: lc.erro || null });
      }
      return json({ ok: true, ready: true, count: sellers.length, sellers });
    }

    // ── SELLER auth: me/log/goals only ever read/write the AUTHENTICATED seller's OWN data. The body
    //    email is NEVER trusted for scope — a same-origin caller cannot read a colleague's earnings or
    //    forge another seller's analytics into the admin leaderboard. Same gate as seller-dashboard.js. ──
    const seller = await sellerAuthFull(
      env,
      b.email || b.seller_email || (b.seller && b.seller.email),
      b.seller_code || b.token || (b.seller && b.seller.code),
    );
    if (!seller) return json({ error: "unauthorized" }, 401);
    // The SHARED team code (roster:false) lets a caller CLAIM any email, so it must NOT read earnings,
    // write goals, or forge leaderboard counters under someone else's identity. Personal data requires a
    // PERSONAL roster code (roster:true) — same guard as seller-dashboard.js / seller-finance.js.
    if (!seller.roster) return json({ error: "unauthorized" }, 401);
    const email = seller.email; // authoritative scope — ignore any body email

    // ── log an activity event (login / quote / pitch) ──
    if (action === "log") {
      const kind = (b.kind || "").toString().slice(0, 24);
      const act = await kvGetJson(kv, actKey(email), { logins: 0, quotes: 0, pitches: 0 });
      // name/ref come from the AUTHENTICATED seller (never arbitrary body) so the leaderboard can't be spoofed
      if (seller.name) act.name = String(seller.name).slice(0, 60);
      if (seller.ref) act.ref = String(seller.ref).slice(0, 40);
      if (["login", "quote", "pitch"].includes(kind)) act[`${kind}s`] = (act[`${kind}s`] || 0) + 1;
      act.lastSeen = Date.now();
      await kv.put(actKey(email), JSON.stringify(act));
      // keep the index unique + bounded
      const idx = await kvGetJson(kv, IDX, []);
      if (!idx.includes(email)) { idx.push(email); await kv.put(IDX, JSON.stringify(idx.slice(-500))); }
      return json({ ok: true });
    }

    // ── set this seller's goals ──
    if (action === "goals") {
      const g = b.goals || {};
      const clean = {
        demos: Math.max(0, parseInt(g.demos, 10) || 0),
        deals: Math.max(0, parseInt(g.deals, 10) || 0),
        revenue: Math.max(0, parseInt(g.revenue, 10) || 0),
        // self-reported progress the seller logs toward the goal
        doneDemos: Math.max(0, parseInt(g.doneDemos, 10) || 0),
        doneDeals: Math.max(0, parseInt(g.doneDeals, 10) || 0),
        doneRevenue: Math.max(0, parseInt(g.doneRevenue, 10) || 0),
        period: (g.period || "month").toString().slice(0, 16),
        updated: Date.now(),
      };
      await kv.put(goalKey(email), JSON.stringify(clean));
      return json({ ok: true, goals: clean });
    }

    // ── default: this seller's goals + activity (+ leads attributed to their ref) ──
    const act = await kvGetJson(kv, actKey(email), { logins: 0, quotes: 0, pitches: 0 });
    const goals = await kvGetJson(kv, goalKey(email), null);
    const ref = (seller.ref || b.ref || act.ref || "").toString().slice(0, 40);
    const attributedLeads = await leadCount(env, ref);
    // MESMO ledger do /api/seller-finance — um vendedor, um número de comissão.
    const lc = await ledgerCommission(env, email, ref);
    return json({ ok: true, ready: true, act, goals, attributedLeads,
      commissions: lc.comissao || null, commissionsErro: lc.erro || null });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
