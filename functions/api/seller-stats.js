// Cloudflare Pages Function — POST /api/seller-stats
// Per-seller GOALS + activity metrics for the /vendedor hub, plus an admin-gated "all" view that
// powers Luis's central control panel (BROTO → Vendedores). Storage = the RATE_LIMIT KV namespace
// already bound in prod (no new infra, no SQL to paste) under sane key prefixes; seller keys are
// written WITHOUT a TTL so they persist. Low-sensitivity sales data; sameOrigin + rate-limited.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

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

// TRUTHFUL conversion signal — seller_conversions (db/seller_conversions.sql) joins the seller's
// attributed leads (gui_actions '👤ref:<ref>', contact email) to client_events type 'payment'.
// INGEST-gated. Returns { converted, paid } or null until the SQL is pasted / on any error —
// null makes the commission math fall back to a clearly-labeled ESTIMATE, never fake earnings.
async function conversions(env, ref) {
  const secret = env && env.INGEST_SECRET;
  if (!secret || !ref) return null;
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/seller_conversions`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: secret, p_ref: ref }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && typeof d.converted === "number" ? { converted: d.converted, paid: Number(d.paid) || 0 } : null;
  } catch { return null; }
}

// Commission math. kind:"earned" = pct × REAL registered payments from converted leads.
// kind:"potential" = an estimate (leads × mid Track-A plan × pct) — the UI must label it as
// such; NEVER present estimates as earned money. Returns null when there's nothing to compute.
const PLAN_MID = 449; // Track-A plans are $149/$449/$999 — the estimate uses the middle one
function commission(env, attributedLeads, conv) {
  const pct = Math.min(100, Math.max(0, parseFloat(env && env.SELLER_COMMISSION_PCT) || 20));
  if (conv) return { kind: "earned", pct, converted: conv.converted, paid: conv.paid, earned: Math.round(conv.paid * pct) / 100 };
  if (typeof attributedLeads !== "number") return null;
  return { kind: "potential", pct, leads: attributedLeads, planPrice: PLAN_MID, potential: Math.round(attributedLeads * PLAN_MID * pct) / 100 };
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
        const commissions = commission(env, attributedLeads, await conversions(env, act.ref));
        sellers.push({ email, name: act.name || email.split("@")[0], ref: act.ref || "", act, goals, attributedLeads, commissions });
      }
      return json({ ok: true, ready: true, count: sellers.length, sellers });
    }

    const email = emailKey(b.email || (b.seller && b.seller.email));
    if (!email.includes("@")) return json({ error: "missing email" }, 400);

    // ── log an activity event (login / quote / pitch) ──
    if (action === "log") {
      const kind = (b.kind || "").toString().slice(0, 24);
      const act = await kvGetJson(kv, actKey(email), { logins: 0, quotes: 0, pitches: 0 });
      const s = b.seller || {};
      if (s.name) act.name = String(s.name).slice(0, 60);
      if (s.ref) act.ref = String(s.ref).slice(0, 40);
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
    const ref = (b.ref || act.ref || "").toString().slice(0, 40);
    const attributedLeads = await leadCount(env, ref);
    const commissions = commission(env, attributedLeads, await conversions(env, ref));
    return json({ ok: true, ready: true, act, goals, attributedLeads, commissions });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
