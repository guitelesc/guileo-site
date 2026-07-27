// Cloudflare Pages Function — POST /api/noshow-radar  (SUPERPOWER #3: predictive no-show radar)
// Ranks a tenant's upcoming appointments by no-show probability (0-100) so the owner — or a
// future pre-emptive automation — can over-confirm the risky ones BEFORE they ghost.
// Needs the noshow_risk RPC (db/noshow_predictor.sql); until pasted it returns a graceful note.
//   POST { token, email, days? }                                -> { ok, ready, count, highRisk, appointments:[...] }
//   POST { token, email, action:"mark_noshow", appointment_id } -> { ok, marked }   (biz_mark_noshow — feeds the model)
//   POST { token, email, action:"confirm", appointment_id?, name? } -> { ok }       (ingests a 'confirm-nudge' client_event)
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — bind the cockpit email to its connection key (get_client_data rejects a
    // mismatch) so a token can't read another tenant's upcoming appointments / customer PII.
    // No OWNER_EMAIL fallback.
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
    const days = Math.min(Math.max(parseInt(b.days, 10) || 7, 1), 30);

    // ── ACTIONS (portal Risk Radar buttons) — same per-tenant gate as the read above. ──
    const action = (b.action || "").toString();
    if (action === "mark_noshow") {
      // 👻 "Faltou" — records the no-show via biz_mark_noshow (db/noshow_predictor.sql), which
      // both frees the history AND feeds the risk model. SCHED_SECRET stays server-side.
      const apptId = (b.appointment_id || "").toString().trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apptId)) return json({ error: "bad appointment_id" }, 400);
      const mr = await fetch(`${SB}/rest/v1/rpc/biz_mark_noshow`, {
        method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", p_email: email, p_appointment_id: apptId }),
      });
      if (!mr.ok) return json({ ok: false, marked: false, note: "Paste db/noshow_predictor.sql in Supabase to activate no-show marking." });
      const marked = await mr.json().catch(() => false);
      return json({ ok: true, marked: marked === true });
    }
    if (action === "confirm") {
      // ✅ "Confirmar extra" — logs a confirm-nudge client_event so the owner sees it in the live
      // feed (and Gui's follow-up automations can pick it up). Best-effort, additive.
      const who = (b.name || "").toString().slice(0, 120) || "Customer";
      const cr = await fetch(`${SB}/rest/v1/rpc/ingest_client_event`, {
        method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_secret: env.INGEST_SECRET || "",
          p_email: email,
          p_type: "message",
          p_channel: "Portal",
          p_summary: `Extra confirmation requested for ${who} (no-show radar)`.slice(0, 300),
          p_amount: 0,
          p_payload: { kind: "confirm-nudge", appointment_id: (b.appointment_id || "").toString().slice(0, 60) },
        }),
      });
      return json({ ok: cr.ok });
    }

    const r = await fetch(`${SB}/rest/v1/rpc/noshow_risk`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", p_email: email, p_days: days }),
    });
    if (!r.ok) {
      // RPC not present yet (SQL not pasted) → graceful, honest note instead of a 500.
      return json({ ok: true, ready: false, note: "Paste db/noshow_predictor.sql in Supabase to activate the risk radar.", count: 0, highRisk: 0, appointments: [] });
    }
    const rows = (await r.json()) || [];
    const high = rows.filter((x) => (x.risk || 0) >= 60).length;
    return json({ ok: true, ready: true, count: rows.length, highRisk: high, appointments: rows.slice(0, 100) });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
