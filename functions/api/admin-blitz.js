// Cloudflare Pages Function — POST /api/admin-blitz
// Server-side proxy so the INGEST_SECRET never ships in the public /admin bundle.
// Body: { token, email, rows:[{name,phone,channel}] }. Verifies the admin token against
// the token-gated blitz_stats RPC, then ingests the dormant list with the server's secret.
import { json } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json();
    const token = (b.token || "").toString();
    // AUTH FIRST — verify the admin token before any field validation, so an unauthenticated
    // probe always gets 401 (never a 400 that confirms the shape of a valid request).
    const vr = await rpc("blitz_stats", { p_token: token, p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    const email = (b.email || "").toString().trim().toLowerCase();
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 1000) : [];
    if (!email.includes("@") || rows.length === 0) return json({ error: "email + rows required" }, 400);

    const clean = rows
      .map((r) => ({ name: (r.name || "").toString().slice(0, 80), phone: (r.phone || "").toString().replace(/[^0-9+]/g, ""), channel: r.channel === "voice" ? "voice" : "sms" }))
      .filter((r) => r.phone.length >= 7);
    if (clean.length === 0) return json({ error: "no valid phones" }, 400);

    const ir = await rpc("ingest_dormant", { p_secret: env.INGEST_SECRET || "", p_email: email, p_rows: clean });
    if (!ir.ok) return json({ error: "ingest failed" }, 502);
    const n = await ir.json();
    return json({ ok: true, uploaded: n });
  } catch (e) {
    return json({ error: String(e).slice(0, 120) }, 400);
  }
}
