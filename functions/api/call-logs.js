// Cloudflare Pages Function — POST /api/call-logs  { email, key }
// Returns the client's real calls WITH per-call analysis (sentiment/intent/duration/why-it-ended)
// and the full transcript. Two-step, mirroring billing-portal's gate:
//   1) validate email+key via get_client_data on the legacy data project (rejects a mismatch)
//   2) read the analysis+transcript from call_logs in the OWNED project (gated by SCHED_SECRET)
import { json } from "../lib/guard.js";

// legacy data project — used ONLY to validate the connection key (same gate as fetchRealData)
const DATA_SB = "https://ynihodbknhjirkdogxby.supabase.co";
const DATA_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
// owned project — where the transcripts live
const SCHED_SB = "https://ynihodbknhjirkdogxby.supabase.co";
const SCHED_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

async function validClient(email, key) {
  try {
    const r = await fetch(`${DATA_SB}/rest/v1/rpc/get_client_data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: DATA_ANON, Authorization: `Bearer ${DATA_ANON}` },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!r.ok) return false;
    const d = await r.json();
    return d && typeof d === "object" && Array.isArray(d.events);
  } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { /* */ }
  const email = (body.email || "").toString().trim().toLowerCase();
  const key = (body.key || "").toString().trim();
  if (!email || !key) return json({ error: "missing email/key" }, 400);
  if (!env.SCHED_SECRET) return json({ calls: [] });

  if (!(await validClient(email, key))) return json({ error: "unauthorized" }, 401);

  try {
    const r = await fetch(`${SCHED_SB}/rest/v1/rpc/get_call_logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SCHED_ANON, Authorization: `Bearer ${SCHED_ANON}` },
      body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_limit: 100 }),
    });
    if (!r.ok) return json({ calls: [] });
    const d = await r.json();
    return json({ calls: Array.isArray(d?.calls) ? d.calls : [] });
  } catch { return json({ calls: [] }); }
}
