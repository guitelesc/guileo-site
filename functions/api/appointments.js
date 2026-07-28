// Cloudflare Pages Function — POST /api/appointments  { email, key }
// Returns the business's REAL upcoming appointments (booked by Gui via /api/agent-schedule),
// so the owner sees them in their portal's schedule/agenda tab. Two-step gate, like /api/call-logs:
//   1) validate email+key via get_client_data (rejects a mismatch)
//   2) read upcoming biz_appointments via biz_list_appointments (gated by SCHED_SECRET)
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

async function validClient(email, key) {
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
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
  if (!env.SCHED_SECRET) return json({ appointments: [] });
  if (!(await validClient(email, key))) return json({ error: "unauthorized" }, 401);
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/biz_list_appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_limit: 60, p_key: key }),
    });
    if (!r.ok) return json({ appointments: [] });
    const d = await r.json();
    return json({ appointments: Array.isArray(d?.appointments) ? d.appointments : [] });
  } catch { return json({ appointments: [] }); }
}
