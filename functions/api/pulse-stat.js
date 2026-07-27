// Cloudflare Pages Function — GET /api/pulse-stat  (public, aggregate-only CX pulse)
// ═════════════════════════════════════════════════════════════════════════════
// Feeds the landing's Guileo Pulse section a LIVE, real platform number. Returns ONLY
// aggregates from cx_platform_pulse() — avg CX, # businesses measuring, # signals — never
// any per-tenant row (no secret needed because there's nothing tenant-attributable to leak).
// Honest by construction: the RPC's `ready` flag is false until the number is backed by
// enough real data (≥3 businesses, ≥25 signals), so a thin platform shows static copy.
// Cached at the edge (5 min) so it never hammers the DB from landing traffic.
const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// Public read → cache at the edge so landing traffic never hammers the DB. CORS-open (aggregate, no PII).
const reply = (obj, maxAge) => new Response(JSON.stringify(obj), {
  status: 200,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": `public, max-age=${maxAge}` },
});

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "GET" && request.method !== "POST") return new Response("method", { status: 405 });
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/cx_platform_pulse`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) return reply({ ready: false }, 120);
    const d = (await r.json().catch(() => null)) || {};
    // Whitelist ONLY the aggregate fields — never pass anything else through.
    return reply({ ready: d.ready === true, avg_cx: Number(d.avg_cx) || 0, businesses: Number(d.businesses) || 0, signals: Number(d.signals) || 0 }, 300);
  } catch {
    return reply({ ready: false }, 120);
  }
}
