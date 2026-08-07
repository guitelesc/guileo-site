// Cloudflare Pages Function — POST /api/revenue
// The ROI numbers in the cockpit must read the SAME money spine as the weekly email, so the
// dashboard and the email can never diverge. That spine is `revenue_month` (db/revenue_month.sql):
// it sums the AUTHORITATIVE ledger `public.client_revenue` (in CENTS) + a crm_timeline gap-fill,
// excluding cancelled/no-show/void/refunded, positive only. client_events (what fetchRealData
// returns to the browser) is a marketing FEED — summing it yields ~0, so the cockpit headline
// must come from here instead.
//
//   POST { token, email }  ->  { ok, ready, month_cents, prev_month_cents, week_cents, series:[usd/day] }
//
// GATE: per-tenant, exactly like noshow-radar.js — bind the cockpit email to its connection key
// via get_client_data (rejects a mismatch) BEFORE any money read, so a token can never read
// another tenant's revenue. Only after that gate passes do we call the INGEST-gated RPCs with the
// server-side INGEST_SECRET. `series` is best-effort: it needs the optional revenue_series RPC
// (db/revenue_series.sql); until pasted it returns [] and the UI hides the chart (never fabricates).
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

async function rpc(name, body) {
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const centsOf = (v) => (v && typeof v.total_cents === "number" ? v.total_cents : null);

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE — same door as the rest of the cockpit; no OWNER_EMAIL fallback.
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const secret = env.INGEST_SECRET || "";
    const now = new Date();
    // UTC calendar windows — MATCHES client-report.js so the cockpit and the weekly email agree.
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 864e5).toISOString();

    // revenue_month sums [since → now]; three windows in parallel. prev-month = (prev→now) − (this→now).
    const [mRes, pRes, wRes, sRes] = await Promise.all([
      rpc("revenue_month", { p_secret: secret, p_email: email, p_since: monthStart }),
      rpc("revenue_month", { p_secret: secret, p_email: email, p_since: prevStart }),
      rpc("revenue_month", { p_secret: secret, p_email: email, p_since: weekStart }),
      rpc("revenue_series", { p_secret: secret, p_email: email, p_since: monthStart }), // optional
    ]);

    const month = centsOf(mRes);
    const prevPlus = centsOf(pRes);
    const week = centsOf(wRes);
    // Not deployed yet (revenue_month absent → all null) → honest not-ready, never a fabricated 0-with-chart.
    const ready = month !== null;
    const month_cents = ready ? month : 0;
    const prev_month_cents = (prevPlus !== null && month !== null) ? Math.max(0, prevPlus - month) : 0;
    const week_cents = week !== null ? week : 0;

    // series: dense per-day USD array for the current calendar month (day 1 → today). Real ledger
    // days only; missing days = 0. Empty when the revenue_series RPC isn't pasted → UI hides the chart.
    let series = [];
    const rawSeries = Array.isArray(sRes?.series) ? sRes.series : null;
    if (rawSeries) {
      const days = now.getUTCDate();
      const byDay = new Map(rawSeries.map((x) => [String(x.d).slice(0, 10), Number(x.cents) || 0]));
      series = Array.from({ length: days }, (_, i) => {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), i + 1)).toISOString().slice(0, 10);
        return Math.round((byDay.get(d) || 0) / 100);
      });
    }

    return json({ ok: true, ready, month_cents, prev_month_cents, week_cents, series });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
