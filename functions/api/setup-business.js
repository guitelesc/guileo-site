// Cloudflare Pages Function — POST /api/setup-business  (admin-token gated)
// Onboards a business's scheduling profile (locations, services, professionals, schedules) into the
// scheduling engine, by calling biz_admin_import. The browser never sees SCHED_SECRET — this server
// holds it. Token is verified server-side via the admin blitz_stats RPC (same gate as setup-selfserve).
import { json } from "../lib/guard.js";

const ADMIN_SB = "https://ynihodbknhjirkdogxby.supabase.co";       // where the token-gated admin RPC lives
const ADMIN_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const SCHED_SB = "https://ynihodbknhjirkdogxby.supabase.co";        // where the scheduling engine lives
const SCHED_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json();
    const token = (b.token || "").toString();
    const email = (b.business_email || "").toString().trim().toLowerCase();
    if (!email) return json({ error: "business_email required" }, 400);
    if (!env.SCHED_SECRET) return json({ error: "scheduling not configured" }, 501);

    // verify the admin token server-side (same RPC setup-selfserve uses)
    const vr = await fetch(`${ADMIN_SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ADMIN_ANON, Authorization: `Bearer ${ADMIN_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token, p_email: "" }),
    });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    // build/normalize the import payload (accept either a full payload or the discrete arrays)
    const payload = b.payload && typeof b.payload === "object"
      ? b.payload
      : { replace: !!b.replace, locations: b.locations || [], services: b.services || [], professionals: b.professionals || [] };

    const r = await fetch(`${SCHED_SB}/rest/v1/rpc/biz_admin_import`, {
      method: "POST", headers: { apikey: SCHED_ANON, Authorization: `Bearer ${SCHED_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_payload: payload }),
    });
    const out = await r.json();
    if (out?.error) return json({ error: out.error }, 400);
    return json({ ok: true, business_email: email, ...out });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
