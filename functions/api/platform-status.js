// Cloudflare Pages Function — GET/POST /api/platform-status?token=DIGEST_TOKEN
// ─────────────────────────────────────────────────────────────────────────────
// FUNDAÇÃO 4 — OBSERVABILIDADE/SLO CONSOLIDADO. The bug this defends against is
// FRAGMENTATION: today "is the platform healthy?" is answered by curl'ing FOUR different
// endpoints (canary for the funnel, health-monitor for the RPCs, admin feeds for failures)
// and eyeballing four JSON shapes. When health lives in four places nobody looks at all four,
// so a dead area (a crashed RPC, a 404'd pay-link) hides in plain sight. This endpoint is the
// ONE place that answers the question: it AGGREGATES the existing probes into a single JSON with
// a simple red/yellow/green SLO per business area (voz · dinheiro · agenda · agentes).
//
// FRONTIER-LAB PRINCIPLE — UMA fonte da verdade. This file does NOT re-implement any probe:
//   • the funnel uptime is REUSED by self-fetching /api/canary (built to be read-only + deduped);
//   • the RPC health REUSES health-monitor.js's RPC_PROBES array as the single source of the probe
//     list (imported, never re-declared — see the 1-line export patch below);
//   • recent failures REUSE admin_all_events (the same feed /api/backup snapshots).
// It only ADDS the aggregation + the SLO roll-up, which is genuinely new and lives nowhere else.
//
// SAFETY / DEGRADAÇÃO HONESTA: every section is best-effort and isolated — a dependency that is
// down, unconfigured (no ADMIN_TOKEN), or not-yet-pasted (SQL missing → PGRST202) degrades that
// area to "unknown"/"yellow" and is labelled as such; it never throws and never turns a
// not-configured gap into a false "red". No PII leaves the box: only counts + area colours.
//
// DIGEST-gated — same token cron-tick/health-monitor/canary/backup use. Read-only aggregation:
// it ingests nothing, alerts nobody, sends no email (the sources it reuses own their own alerts).
//
// ── 1-LINE PATCH FOR THE ORCHESTRATOR (files I don't own) ────────────────────────
//   functions/api/health-monitor.js line 120:
//       - const RPC_PROBES = [
//       + export const RPC_PROBES = [
//   That single `export` turns the probe list into a reusable single-source-of-truth. Until it
//   lands, this file degrades the "rpc" section to notReady (import yields undefined, guarded) —
//   it never breaks. (Optional: add a cron target in cron-tick.js if you want it swept, but it's
//   designed to be pulled on-demand by /admin, not pushed.)
import { json, safeEq } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const PROBE_TIMEOUT_MS = 9000; // canary self-fetch runs 4 sub-probes, give it room
const RPC_TIMEOUT_MS = 6000;
const FAIL_LOOKBACK_DAYS = 7;
const FAIL_RED_THRESHOLD = 5; // ≥ this many real failures in an area's channels in 7d ⇒ red

// The four business areas the SLO rolls up to (mirrors MOTORES.md's living map).
const AREAS = ["voz", "dinheiro", "agenda", "agentes"];

// ── area attribution — the ONE map from a probe/channel to a business area ──────────
// Canary probe → area. gui/widget chat = the agents; pay = money; call-gate = voice.
const CANARY_AREA = { gui_chat: "agentes", widget_chat: "agentes", pay_links: "dinheiro", call_gate: "voz" };
// RPC probe name → area (names come from the reused RPC_PROBES array, not re-declared here).
const RPC_AREA = {
  noshow_risk: "agenda", storm_status: "voz", mkt_leads_list: "agentes",
  emergency_list: "voz", package_list: "dinheiro", finance_overdue_list: "dinheiro",
};
// A failure/ops_alert event's channel → area, by keyword; anything agent-ish or unknown → agentes.
function channelToArea(channel, summary) {
  const s = `${channel || ""} ${summary || ""}`.toLowerCase();
  if (/\b(voz|voice|call|phone|ligac|dial|twilio)\b/.test(s)) return "voz";
  if (/\b(pay|money|stripe|charge|invoice|billing|cobran|fatura|financ|deposit|refund)\b/.test(s)) return "dinheiro";
  if (/\b(sched|agenda|book|reserv|calendar|slot|no.?show)\b/.test(s)) return "agenda";
  return "agentes";
}

// timed fetch with a per-call abort so one hung dependency can't stall the consolidation.
async function timedFetch(url, opts = {}, ms = RPC_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// INGEST-gated RPC helper (same shape as canary/health-monitor). Returns {ok,status,body}.
async function rpcRaw(env, fn, args, secret) {
  try {
    const r = await timedFetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: secret ?? (env.INGEST_SECRET || ""), ...args }),
    });
    const body = await r.text().catch(() => "");
    return { ok: r.ok, status: r.status, body };
  } catch (e) { return { ok: false, status: 0, body: String(e).slice(0, 160) }; }
}
async function rpcJson(env, fn, args, secret) {
  const r = await rpcRaw(env, fn, args, secret);
  if (!r.ok) return null;
  try { return JSON.parse(r.body); } catch { return null; }
}

// ── (A) FUNNEL UPTIME — REUSE /api/canary verbatim (no re-implementation) ───────────
// canary is DIGEST-gated, read-only and self-deduped; we just call it and read its `probes`.
// If it's unreachable/times out, the section is "unknown" (never a false red).
async function funnelUptime(env, origin) {
  try {
    const r = await timedFetch(`${origin}/api/canary?token=${encodeURIComponent(env.DIGEST_TOKEN || "")}`,
      { method: "POST", headers: { Origin: origin } }, PROBE_TIMEOUT_MS);
    if (!r.ok) return { source: "canary", ok: false, reachable: false, detail: `canary HTTP ${r.status}`, probes: {} };
    const d = await r.json().catch(() => ({}));
    const probes = d && d.probes ? d.probes : {};
    // normalise each probe to a status the SLO understands
    const norm = {};
    for (const [name, p] of Object.entries(probes)) norm[name] = (p && p.status) || "unknown";
    return { source: "canary", ok: !!d.ok, reachable: true, alertReady: d.alertReady, probes: norm, failed: d.failed || [] };
  } catch (e) { return { source: "canary", ok: false, reachable: false, detail: String(e).slice(0, 140), probes: {} }; }
}

// ── (B) RPC HEALTH — REUSE health-monitor.js's RPC_PROBES as the single source ──────
// Dynamic import so a not-yet-patched health-monitor (RPC_PROBES not exported) degrades to
// notReady instead of a link-time crash. We run the SAME definitions read-only, WITHOUT the
// alerting/dedup (that belongs to health-monitor — we only observe). 200 = ok (empty list still
// ok); 404/PGRST202 = SQL not pasted → notReady; anything else = failed.
async function rpcHealth(env) {
  let RPC_PROBES = [];
  try {
    const mod = await import("./health-monitor.js");
    if (Array.isArray(mod.RPC_PROBES)) RPC_PROBES = mod.RPC_PROBES;
  } catch { /* import failure → empty, section reports notReady below */ }
  if (!RPC_PROBES.length) return { source: "health-monitor.RPC_PROBES", reusable: false, note: "RPC_PROBES not exported yet (apply the 1-line patch)", results: [] };

  const clients = await rpcJson(env, "clients_list", {});
  if (!Array.isArray(clients) || !clients.length) return { source: "health-monitor.RPC_PROBES", reusable: true, results: [], note: "no tenants" };
  const email = ((clients[0] && clients[0].client_email) || "").toString().trim().toLowerCase();
  if (!email.includes("@")) return { source: "health-monitor.RPC_PROBES", reusable: true, results: [], note: "no tenant email" };

  const secretFor = (p) => (p.secret === "SCHED" ? (env.SCHED_SECRET || "") : (env.INGEST_SECRET || ""));
  const results = await Promise.all(RPC_PROBES.map(async (p) => {
    const r = await rpcRaw(env, p.name, p.args(email), secretFor(p));
    if (r.ok) return { name: p.name, status: "ok" };
    let code = ""; try { code = (JSON.parse(r.body) || {}).code || ""; } catch { /* non-JSON */ }
    if (r.status === 404 || code === "PGRST202") return { name: p.name, status: "notReady" };
    return { name: p.name, status: "failed", httpStatus: r.status };
  }));
  return { source: "health-monitor.RPC_PROBES", reusable: true, results };
}

// ── (C) RECENT FAILURES — REUSE admin_all_events (the feed /api/backup snapshots) ───
// Count type∈{failure,ops_alert} in the last 7d, bucketed by channel (the category proxy) and
// attributed to a business area. Needs ADMIN_TOKEN; without it the section is honestly notReady.
async function recentFailures(env) {
  if (!env.ADMIN_TOKEN) return { source: "admin_all_events", ready: false, note: "no ADMIN_TOKEN", days: FAIL_LOOKBACK_DAYS, total: 0, byChannel: {}, byArea: {} };
  try {
    const r = await timedFetch(`${SB_URL}/rest/v1/rpc/admin_all_events`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: env.ADMIN_TOKEN }),
    });
    if (!r.ok) return { source: "admin_all_events", ready: false, note: `HTTP ${r.status}`, days: FAIL_LOOKBACK_DAYS, total: 0, byChannel: {}, byArea: {} };
    const rows = await r.json().catch(() => []);
    const since = Date.now() - FAIL_LOOKBACK_DAYS * 864e5;
    const byChannel = {}, byArea = {};
    let total = 0;
    for (const e of (Array.isArray(rows) ? rows : [])) {
      const type = (e.type || "").toString();
      if (type !== "failure" && type !== "ops_alert") continue;
      const t = new Date(e.created_at).getTime();
      if (!(t >= since)) continue;
      total++;
      const ch = (e.channel || "unknown").toString();
      byChannel[ch] = (byChannel[ch] || 0) + 1;
      const area = channelToArea(e.channel, e.summary);
      byArea[area] = (byArea[area] || 0) + 1;
    }
    return { source: "admin_all_events", ready: true, days: FAIL_LOOKBACK_DAYS, total, byChannel, byArea };
  } catch (e) { return { source: "admin_all_events", ready: false, note: String(e).slice(0, 120), days: FAIL_LOOKBACK_DAYS, total: 0, byChannel: {}, byArea: {} }; }
}

// ── (D) AGENT QUALITY — placeholder for the eval harness (Fundação de evals) ────────
// The agent_evals table/RPC doesn't exist yet; we probe for it so this lights up automatically the
// day it ships. PGRST202/404 → notReady placeholder (attributed to the "agentes" area). Never fails.
async function agentQuality(env) {
  const r = await rpcRaw(env, "agent_evals_latest", {}, env.INGEST_SECRET || "");
  if (r.ok) {
    let data = null; try { data = JSON.parse(r.body); } catch { /* */ }
    return { source: "agent_evals_latest", ready: true, latest: data };
  }
  let code = ""; try { code = (JSON.parse(r.body) || {}).code || ""; } catch { /* */ }
  if (r.status === 404 || code === "PGRST202") return { source: "agent_evals_latest", ready: false, note: "eval harness not deployed yet (placeholder)" };
  return { source: "agent_evals_latest", ready: false, note: `HTTP ${r.status}` };
}

// ── SLO ROLL-UP — the ONE new thing: fold every signal into red/yellow/green per area ──
// Rank: green(0) < yellow(1) < red(2). A "notReady" (unconfigured / SQL-not-pasted) is yellow,
// never red — degradação honesta, not a false alarm. Recent failures bump an area to yellow, or
// to red past FAIL_RED_THRESHOLD. An area with zero signals is "unknown" (grey), not green.
const RANK = { green: 0, yellow: 1, red: 2 };
const COLOR = ["green", "yellow", "red"];
function statusToColor(s) {
  if (s === "ok") return "green";
  if (s === "failed") return "red";
  if (s === "notReady" || s === "unknown" || s === "degraded") return "yellow";
  return "yellow";
}
function computeSlo(funnel, rpc, failures, agents) {
  // seed every area with no signal
  const acc = {}; for (const a of AREAS) acc[a] = { color: null, signals: [] };
  const bump = (area, color, label) => {
    if (!acc[area]) return; // ignore anything off-map
    acc[area].signals.push({ label, color });
    const cur = acc[area].color;
    if (cur === null || RANK[color] > RANK[cur]) acc[area].color = color;
  };
  // canary probes
  for (const [name, st] of Object.entries(funnel.probes || {})) {
    const area = CANARY_AREA[name]; if (area) bump(area, statusToColor(st), `canary:${name}=${st}`);
  }
  if (funnel.reachable === false) for (const a of AREAS) bump(a, "yellow", "canary:unreachable");
  // rpc probes
  for (const res of (rpc.results || [])) {
    const area = RPC_AREA[res.name]; if (area) bump(area, statusToColor(res.status), `rpc:${res.name}=${res.status}`);
  }
  // recent failures per area
  if (failures.ready) {
    for (const [area, n] of Object.entries(failures.byArea || {})) {
      if (!n) continue;
      bump(area, n >= FAIL_RED_THRESHOLD ? "red" : "yellow", `failures7d:${n}`);
    }
  }
  // agent quality → agentes
  bump("agentes", agents.ready ? "green" : "yellow", `agent_evals:${agents.ready ? "ok" : "placeholder"}`);

  const areas = {};
  let worst = 0, anyKnown = false;
  for (const a of AREAS) {
    const color = acc[a].color || "unknown";
    areas[a] = { color, signals: acc[a].signals };
    if (color !== "unknown") { anyKnown = true; worst = Math.max(worst, RANK[color] ?? 0); }
  }
  const overall = anyKnown ? COLOR[worst] : "unknown";
  return { overall, areas };
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
    // Token may arrive in the POST body (the /admin QualityPanel), the query (?token=, cron), or header.
    const reqBody = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const tok = (reqBody.token || new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "").toString();
    // Accept EITHER the DIGEST_TOKEN (cron/automation) OR a valid admin password (the /admin panel —
    // validated exactly like admin-blitz.js/unit-economics: blitz_stats raises on a wrong token → !ok).
    let authed = !!env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN);
    if (!authed && tok) {
      const av = await fetch(`${SB_URL}/rest/v1/rpc/blitz_stats`, {
        method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: tok, p_email: "" }),
      }).then((r) => r.ok).catch(() => false);
      authed = av;
    }
    if (!authed) return json({ error: "unauthorized" }, 401);

    const origin = new URL(request.url).origin;

    // Every section is isolated + best-effort — one down source can never break the consolidation.
    const [funnel, rpc, failures, agents] = await Promise.all([
      funnelUptime(env, origin).catch((e) => ({ source: "canary", ok: false, reachable: false, detail: String(e).slice(0, 120), probes: {} })),
      rpcHealth(env).catch((e) => ({ source: "health-monitor.RPC_PROBES", reusable: false, note: String(e).slice(0, 120), results: [] })),
      recentFailures(env).catch((e) => ({ source: "admin_all_events", ready: false, note: String(e).slice(0, 120), total: 0, byChannel: {}, byArea: {} })),
      agentQuality(env).catch((e) => ({ source: "agent_evals_latest", ready: false, note: String(e).slice(0, 120) })),
    ]);

    const slo = computeSlo(funnel, rpc, failures, agents);

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      slo,                        // ← the one-glance answer: overall + per-area red/yellow/green
      sections: {
        funnel,                   // (A) reused canary uptime
        rpc,                      // (B) reused health-monitor RPC_PROBES
        failures,                 // (C) reused admin_all_events, 7d, by channel + area
        agents,                   // (D) agent_evals placeholder
      },
      reuse: {                    // proof-of-non-duplication: what each section leans on
        funnel: "GET /api/canary (read-only, self-deduped)",
        rpc: "import { RPC_PROBES } from ./health-monitor.js",
        failures: "rpc admin_all_events (same feed /api/backup uses)",
        agents: "rpc agent_evals_latest (future eval harness)",
      },
    });
  } catch (e) {
    // last-resort: still answer, honestly degraded — an SLO endpoint that 500s is itself an outage.
    return json({ ok: false, slo: { overall: "unknown", areas: {} }, error: String(e).slice(0, 160) }, 200);
  }
}
