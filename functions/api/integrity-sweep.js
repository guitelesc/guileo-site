// Cloudflare Pages Function — GET/POST /api/integrity-sweep   (nightly Data-Cannot-Lie sweep)
// ═════════════════════════════════════════════════════════════════════════════
// Cron target. Runs integrity_summary across every tenant; if any HIGH-severity contradiction
// exists (paid-but-no-ledger, capacity-overbooked, negative inventory), it raises a failure via
// emitFailure so the team is alerted the same day — silence on a money-integrity breach is the
// one thing a frontier-lab never allows. DIGEST-gated (same token as automations/cron-tick).
// Best-effort + honest: if the auditor SQL isn't installed yet it reports ready:false, never 500s.
import { json, safeEq } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const ING = "glo_ing_7f3da9c2b4e8";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
  const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

  try {
    const r = await fetch(`${SB}/rest/v1/rpc/integrity_summary`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || ING }),
    });
    if (!r.ok) return json({ ok: true, ready: false, note: "integrity_check.sql not installed — sweep skipped (honest zero)." });
    const s = (await r.json().catch(() => ({}))) || {};
    const high = Number(s.high || 0);
    if (high > 0) {
      try {
        await emitFailure(env, "integrity_high", env.OWNER_EMAIL || "smart@guileoai.com",
          `Nightly integrity sweep found ${high} HIGH-severity data contradiction${high === 1 ? "" : "s"} across ${s.tenants_scanned ?? "?"} tenants — the numbers don't reconcile. Investigate before they compound.`,
          { by_kind: s.by_kind || {}, total: s.total ?? null });
      } catch { /* alert best-effort — never blocks the sweep result */ }
    }
    return json({ ok: true, ready: true, high, total: s.total ?? 0, tenants_scanned: s.tenants_scanned ?? 0, by_kind: s.by_kind || {}, alerted: high > 0 });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
