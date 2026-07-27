// Cloudflare Pages Function — POST /api/experience  (XM cockpit: read + act on the CLIENT's own CX)
// ═════════════════════════════════════════════════════════════════════════════
// The experience-management layer: a tenant reading how ITS OWN customers feel — the summary,
// the ranked DRIVERS behind the score, and the open DETRACTORS to win back. Sits beside Guileo's
// own tenant-NPS (/api/nps); it never touches that layer. Read-only by default; one non-destructive
// write action (close_loop) marks a detractor as followed-up.
//
//   POST { email, dataKey, action?, since?, signal_id? }
//     (default | 'summary'): { ok, ready, summary, drivers, detractors }   ← READ-only
//     'close_loop' { signal_id }: { ok, ready }                            ← mark ONE signal resolved
//
// GATE (identical to /api/revenue.js & /api/crm.js): get_client_data binds email↔connection-key and
// returns null on a mismatch, so one tenant's key can NEVER read/act on another tenant's CX. No
// OWNER_EMAIL fallback. Only after that gate passes do we call the INGEST-gated cx_* RPCs.
//
// HONEST: before db/experience.sql is pasted the RPCs 404 → we pass ready:false through with a note,
// never a fabricated score.
import { json } from "../lib/guard.js";
import { rpc, SB_URL, SB_ANON } from "../lib/cxEngine.js";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const dkey = (b.dataKey || b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !dkey) return json({ error: "unauthorized" }, 401);

    // ── PER-TENANT GATE — the same door revenue.js / crm.js use. A mismatched (email,key) or a
    //    missing key returns null → 401 before any CX read. No owner fallback. ──
    const gd = await fetch(`${SB_URL}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: dkey }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const action = (b.action || "summary").toString();
    const since = typeof b.since === "string" && b.since ? b.since : null; // optional ISO window start

    // ── action: close_loop — mark ONE detractor signal as followed-up (cx_close_loop). Tenant-scoped
    //    in SQL: the update only matches the caller's own client_email, so a key can never close
    //    another tenant's signal. Non-destructive (sets a resolved flag; deletes nothing). ──
    if (action === "close_loop") {
      const signalId = (b.signal_id || "").toString();
      if (!UUID_RE.test(signalId)) return json({ error: "invalid signal_id" }, 400);
      const res = await rpc(env, "cx_close_loop", { p_email: email, p_signal_id: signalId, p_action: (b.note || "reconquista").toString().slice(0, 200) });
      if (res === null) return json({ ok: false, ready: false, note: "Paste db/experience.sql to activate the XM layer." });
      // RPC returns the closed row (array) or a boolean/object; treat empty as "not found for this tenant".
      const okClosed = Array.isArray(res) ? res.length > 0 : (res === true || (res && res.ok === true) || (res && res.id));
      if (!okClosed) return json({ ok: false, ready: true, note: "signal not found" });
      return json({ ok: true, ready: true });
    }

    // ── action: set_survey — the tenant toggles their ACTIVE auto-survey ON/OFF (default ON). ──
    if (action === "set_survey") {
      const enabled = b.enabled !== false && b.enabled !== 0 && b.enabled !== "false"; // anything but explicit false = ON
      const res = await rpc(env, "cx_settings_set", { p_email: email, p_enabled: enabled });
      if (res === null) return json({ ok: false, ready: false, note: "Paste db/cx_settings.sql to enable the survey toggle." });
      return json({ ok: true, ready: true, survey_enabled: (res && res.survey_enabled) !== false });
    }

    if (action !== "summary") return json({ error: "unknown action" }, 400);

    // ── default: the XM read — summary + ranked drivers + open detractors, all tenant-scoped. ──
    // cx_summary/cx_drivers accept p_since; cx_detractors does NOT (its 3rd param is p_limit) → call it
    // WITHOUT the window so an explicit `since` can never 404 the detractor queue.
    const winArgs = { p_email: email, ...(since ? { p_since: since } : {}) };
    const [summaryRaw, driversRaw, detractorsRaw, settingsRaw] = await Promise.all([
      rpc(env, "cx_summary", winArgs),
      rpc(env, "cx_drivers", winArgs),
      rpc(env, "cx_detractors", { p_email: email }),
      rpc(env, "cx_settings_get", { p_email: email }),
    ]);
    // survey toggle state (absent RPC / row → ON by default, matching db/cx_settings.sql).
    const surveyEnabled = settingsRaw && settingsRaw.survey_enabled === false ? false : true;

    // HONESTY: a null (missing RPC → SQL not pasted) is passed through as ready:false, never a
    // fabricated 0. The summary RPC may ALSO return an explicit { ready:false } object — honor that too.
    if (summaryRaw === null) {
      return json({ ok: true, ready: false, note: "Paste db/experience.sql in Supabase to activate the Experience layer.", summary: null, drivers: [], detractors: [] });
    }
    const s = Array.isArray(summaryRaw) ? (summaryRaw[0] || null) : summaryRaw;
    if (s && s.ready === false) {
      return json({ ok: true, ready: false, note: s.note || "Experience layer not ready.", summary: s, drivers: [], detractors: [] });
    }

    const driversRows = Array.isArray(driversRaw) ? driversRaw : [];
    const detractorRows = Array.isArray(detractorsRaw) ? detractorsRaw : [];
    // FLATTEN to the exact shape src/portal/Experience.jsx reads (the RPCs nest under `summary` and use
    // polarity/id/occurred_at; the cockpit reads flat cx_score/nps/csat + kind/signal_id/at).
    return json({
      ok: true, ready: true,
      survey_enabled: surveyEnabled,
      cx_score: s ? s.cx_score : null, cx_n: s ? s.n : 0,
      nps: s ? s.nps : null, nps_n: s ? s.nps_n : 0,
      csat: s ? s.csat_pct : null, csat_n: s ? s.csat_n : 0,
      trend: (s && s.trend != null) ? { delta: s.trend, dir: s.trend >= 0 ? "up" : "down" } : null,
      summary: { sentiment: s ? s.sentiment : null, by_source: s ? s.by_source : null,
                 promoters: s ? s.promoters : 0, passives: s ? s.passives : 0, detractors: s ? s.detractors : 0 },
      drivers: driversRows.map((d) => ({ theme: d.theme, count: d.count, avg_score: d.avg_score, kind: d.polarity })),
      detractors: detractorRows.map((x) => ({ signal_id: x.id, contact_id: x.contact_id, name: x.name, source: x.source, score: x.score, comment: x.comment, at: x.occurred_at })),
    });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
