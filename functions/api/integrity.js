// Cloudflare Pages Function — POST /api/integrity   (Action-Integrity · Data-Cannot-Lie auditor)
// ═════════════════════════════════════════════════════════════════════════════
// The admin's "does the data contradict itself?" screen. Runs the cross-department invariant
// checks (db/integrity_check.sql): a paid event with no ledger row, a booking on a slot over
// capacity, inventory that went negative, a tenant whose numbers don't add up. These are the
// checks a frontier-lab treats as non-negotiable — actions are judged by their EFFECTS, and
// effects must reconcile. Admin-gated (blitz_stats, same door as /admin). Read-only, never mutates.
//
//   POST { token:<admin>, email? }
//     default            → integrity_summary(secret): { by_kind, total, high, tenants_scanned, checked_at }
//     { email }          → integrity_check(secret,email): jsonb[] of violations for ONE tenant
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const ING = "glo_ing_7f3da9c2b4e8";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // ADMIN gate — validate the admin token via blitz_stats (direct fetch; the rpc helper would inject
    // p_secret and 404 the function). Same door /admin and agent-backfill use.
    const av = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: (b.token || "").toString(), p_email: "" }),
    }).then((r) => r.ok).catch(() => false);
    if (!av) return json({ error: "unauthorized" }, 401);

    const secret = env.INGEST_SECRET || ING;
    const email = (b.email || "").toString().trim().toLowerCase();

    // Per-tenant deep list, or platform-wide summary.
    const fn = email ? "integrity_check" : "integrity_summary";
    const args = email ? { p_secret: secret, p_email: email } : { p_secret: secret };
    const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!r.ok) return json({ ok: false, ready: false, note: "Paste db/integrity_check.sql in Supabase to activate the auditor." });
    const data = await r.json().catch(() => null);
    return json(email ? { ok: true, ready: true, email, violations: Array.isArray(data) ? data : [] }
                      : { ok: true, ready: true, summary: data || {} });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
