// Cloudflare Pages Function — POST /api/operations  (Company-OS · Live Ops Board)
// ═════════════════════════════════════════════════════════════════════════════
// The owner's "run-the-day" screen: today's jobs (biz_appointments) as live cards with
// status + on-time signal, read off the scheduling spine. Read-only by default + one
// non-destructive action: advance a job's status (ops_set_status). Tenant-gated exactly
// like /api/revenue.js & /api/crm.js (get_client_data binds email↔connection-key). Honest:
// before db/operations.sql / the scheduling engine is installed, ops_board returns ready:false.
//
//   POST { email, dataKey, action?, id?, status?, from?, to? }
//     (default | 'board'): { ok, ready, window, stats, jobs[] }         ← READ-only
//     'set_status' { id, status }: { ok }  status∈ booked|in_progress|completed|no_show|cancelled
import { json } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const ING = "";
const UUID_RE = /^[0-9a-f-]{36}$/i;
const rpc = (env, fn, args) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: env.INGEST_SECRET || ING, ...args }),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const dkey = (b.dataKey || b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !dkey) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE — the same door revenue.js / crm.js use. Mismatch → 401 before any read/write.
    const gd = await fetch(`${SB_URL}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: dkey }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const action = (b.action || "board").toString();

    // ── action: set_status — advance ONE job (tenant-scoped in SQL; a foreign id matches nothing). ──
    if (action === "set_status") {
      const id = (b.id || "").toString();
      const status = (b.status || "").toString();
      if (!UUID_RE.test(id)) return json({ error: "invalid id" }, 400);
      const r = await rpc(env, "ops_set_status", { p_email: email, p_id: id, p_status: status });
      if (!r.ok) return json({ ok: false, note: "Paste db/operations.sql to activate the Ops board." });
      const done = await r.json().catch(() => false);
      return json({ ok: done === true, ready: true });
    }

    // ── action: inventory — live stock + reorder feed (Action Integrity). The ops_inventory_* RPCs
    // are SCHED-gated (they mutate the same tables reserve_atomic touches), so we call them with
    // SCHED_SECRET after the per-tenant door above already proved this caller owns `email`. Read-only.
    if (action === "inventory") {
      const sched = env.SCHED_SECRET || "";
      const call = (fn) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
        method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: sched, p_email: email }),
      }).then((r) => r.ok ? r.json() : null).catch(() => null);
      const [items, due] = await Promise.all([call("ops_inventory_list"), call("ops_reorder_due")]);
      if (!Array.isArray(items) && !Array.isArray(due)) return json({ ok: true, ready: false, note: "Paste db/ops_atomic.sql in Supabase to activate inventory.", items: [], reorder: [] });
      const list = Array.isArray(items) ? items : [];
      return json({ ok: true, ready: true, items: list, reorder: Array.isArray(due) ? due : [], low_count: list.filter((i) => i && i.low_stock).length, eighty_six: list.filter((i) => i && i.is_86).map((i) => i.sku) });
    }

    if (action !== "board") return json({ error: "unknown action" }, 400);

    // ── default: the live board (stats + jobs), tenant-scoped, optional window. ──
    const args = { p_email: email };
    if (typeof b.from === "string" && b.from) args.p_from = b.from;
    if (typeof b.to === "string" && b.to) args.p_to = b.to;
    const r = await rpc(env, "ops_board", args);
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/operations.sql in Supabase to activate the Ops board.", stats: {}, jobs: [] });
    const d = await r.json().catch(() => null);
    const board = Array.isArray(d) ? (d[0] || {}) : (d || {});
    if (board.ready === false) return json({ ok: true, ready: false, note: board.note || "Ops board not ready.", stats: {}, jobs: [] });
    return json({ ok: true, ready: true, window: board.window || null, stats: board.stats || {}, jobs: Array.isArray(board.jobs) ? board.jobs : [] });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
