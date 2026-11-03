// Cloudflare Pages Function — GET /api/natura-data?table=<name>&...filters
// Server-side reads for the Natura channels module dashboard. Every table in the Natura
// Supabase project has RLS enabled with NO public policy (by design — see supabase/001_schema.sql),
// so the browser's anon key can never read them directly. This route holds the service_role
// key server-side (same pattern as natura-login.js) and proxies read-only queries, gated by
// the signed session token from natura-login.js — never the raw password or key reaching the browser.
import { json, rateLimited } from "../lib/guard.js";
import { verifyNaturaSession } from "../lib/naturaSessionToken.js";

// Local-dev-only origin check — identical rationale/scope as natura-login.js's version: gated
// on the REQUEST's own host being localhost, never on an env flag (wrangler sets CF_PAGES="1"
// even in local dev), and never touches the shared sameOrigin() other endpoints rely on.
function sameOriginOrLocalDev(request) {
  const ALLOWED = ["https://guileoai.com", "https://www.guileoai.com"];
  const okOrigin = (u) => ALLOWED.includes(u) || /^https:\/\/[a-z0-9-]+\.guileoai\.pages\.dev$/.test(u);
  const o = request.headers.get("Origin") || "";
  const ref = request.headers.get("Referer") || "";
  if (o && okOrigin(o)) return true;
  if (ref) { try { if (okOrigin(new URL(ref).origin)) return true; } catch { /* fall through */ } }
  const host = new URL(request.url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") return false;
  const origin = o || ref;
  try { return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(origin); } catch { return false; }
}

// Allowlist of readable tables + the columns/order/date-column each dashboard section needs.
// Never pass the client's own `table`/`select`/`order` straight into the query string —
// that would let a crafted request read other tables or every column (service_role bypasses RLS).
// `dateCol` is the timestamp column `since`/`until` filter against (charts/KPI windows).
const TABLES = {
  customers: { select: "*", order: "updated_at.desc", filters: [], dateCol: "created_at" },
  master_leads: { select: "*", order: "updated_at.desc", filters: ["stage", "rating"], dateCol: "created_at" },
  inbound_leads: { select: "*", order: "timestamp.desc", filters: ["channel"], dateCol: "timestamp" },
  outbound_leads: { select: "*", order: "created_at.desc", filters: ["channel", "campaign_id"], dateCol: "created_at" },
  outreach_campaigns: { select: "*", order: "created_at.desc", filters: ["status"], dateCol: "created_at" },
  consent_records: { select: "*", order: "created_at.desc", filters: ["channel"], dateCol: "created_at" },
};
// Dashboards need the full recent window to compute KPIs/charts client-side, not just a page —
// 2000 rows comfortably covers months of this spa's real traffic without an aggregate SQL layer.
const LIMIT = 2000;

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    if (!sameOriginOrLocalDev(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "natura-data", 60)) return json({ error: "too many requests" }, 429);

    const auth = request.headers.get("Authorization") || "";
    const sid = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const email = await verifyNaturaSession(env, sid);
    if (!email) return json({ error: "unauthorized" }, 401);

    const url = new URL(request.url);
    const table = url.searchParams.get("table") || "";
    const spec = TABLES[table];
    if (!spec) return json({ error: "unknown_table" }, 400);

    const SB_URL = env.NATURA_SUPABASE_URL;
    const SB_SERVICE_KEY = env.NATURA_SUPABASE_SERVICE_ROLE_KEY;
    if (!SB_URL || !SB_SERVICE_KEY) return json({ error: "not_configured" }, 503);

    const qs = new URLSearchParams();
    qs.set("select", spec.select);
    qs.set("order", spec.order);
    qs.set("limit", String(LIMIT));
    for (const f of spec.filters) {
      const v = url.searchParams.get(f);
      if (v) qs.set(f, `eq.${v}`);
    }
    // since/until bound spec.dateCol (ISO strings) — used for "last 7 days" style windows.
    // PostgREST allows multiple filters on the same column via repeated query params.
    const since = url.searchParams.get("since");
    const until = url.searchParams.get("until");
    if (since) qs.append(spec.dateCol, `gte.${since}`);
    if (until) qs.append(spec.dateCol, `lte.${until}`);

    const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs.toString()}`, {
      headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}` },
    });
    if (!r.ok) return json({ error: "query_failed" }, 502);
    const rows = await r.json().catch(() => []);
    return json({ ok: true, table, rows: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
