// Cloudflare Pages Function — POST /api/emergency  (client cockpit: EMERGENCY DISPATCH log)
// The owner FINALLY sees the after-hours urgencies that used to be blind: when a caller has a
// real 2am emergency ("no AC", "burst pipe", "flood"), agent-action.js claims it (emergency_claim)
// and RINGS the owner's phone. This endpoint surfaces that log in the portal + lets the owner mark
// "✅ I called them back". Needs db/emergency_dispatch.sql (emergency_list / emergency_mark_called);
// both RPCs are gated by the ingest secret which stays SERVER-SIDE (env.INGEST_SECRET). Never bundled.
//   POST { token, email }                        -> { ok, ready, count, pending, emergencies:[...] }
//   POST { token, email, action:"mark_called", id } -> { ok, called }
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — bind the cockpit email to its connection key (get_client_data rejects a
    // mismatch) so a token can't read another tenant's emergency log / caller PII. No OWNER fallback.
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    // ── ACTION: mark "✅ I called them back" — same per-tenant gate as the read above. ──
    const action = (b.action || "").toString();
    if (action === "mark_called") {
      // The emergency secret stays server-side; the client only ever passes the row id it saw.
      const id = (b.id || "").toString().trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return json({ error: "bad id" }, 400);
      const mr = await fetch(`${SB}/rest/v1/rpc/emergency_mark_called`, {
        method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_client_email: email, p_id: id }),
      });
      if (!mr.ok) return json({ ok: false, called: false, note: "Paste db/emergency_dispatch.sql in Supabase to activate the emergency log." });
      const called = await mr.json().catch(() => false);
      return json({ ok: true, called: called === true });
    }

    // ── READ: the tenant's last 50 emergencies (emergency_list is client-scoped by p_client_email) ──
    const r = await fetch(`${SB}/rest/v1/rpc/emergency_list`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_client_email: email }),
    });
    if (!r.ok) {
      // RPC not present yet (SQL not pasted) → graceful, honest note instead of a 500.
      return json({ ok: true, ready: false, note: "Paste db/emergency_dispatch.sql in Supabase to activate the emergency log.", count: 0, pending: 0, emergencies: [] });
    }
    const rows = (await r.json()) || [];
    const list = Array.isArray(rows) ? rows : [];
    const pending = list.filter((x) => !x.called_owner).length;
    return json({ ok: true, ready: true, count: list.length, pending, emergencies: list.slice(0, 50) });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
