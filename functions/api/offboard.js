// Cloudflare Pages Function — POST /api/offboard  (churn capture + data-export rights)
// The cockpit's "Precisa cancelar?" flow lands here. This endpoint NEVER cancels anything —
// the actual subscription cancel stays in Stripe's own portal (/api/billing-portal). It:
//   POST { email, key, action:"survey", reason, note } → ingests a LOUD 'churn_risk'
//        client_event ("😢 pediu cancelamento: {reason}") + emails Luis (OWNER_EMAIL)
//        immediately with the reason and a concrete win-back suggestion (churnAlertEmail).
//   POST { email, key, action:"export" } → returns the client's OWN data (the same events
//        ledger get_client_data gates + their profile) as a downloadable JSON attachment,
//        satisfying data-export rights on the way out.
// PER-TENANT GATE — same as noshow-radar.js: email+connection key via get_client_data,
// NO admin/owner fallback. A token can never touch another tenant's data.
import { json, isOwnerEmail } from "../lib/guard.js";
import { churnAlertEmail } from "../lib/emailTemplates.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — bind the cockpit email to its connection key (get_client_data rejects a
    // mismatch) so a token can't read another tenant's upcoming appointments / customer PII.
    // No OWNER_EMAIL fallback.
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const ING = env.INGEST_SECRET || "";
    const action = (b.action || "").toString();

    // Profile (business name, owner, lang) — best-effort, used by both actions.
    let profile = null;
    try {
      const pr = await rpc("get_client_profile", { p_secret: ING, p_email: email });
      if (pr.ok) { const p = await pr.json(); if (p && typeof p === "object") profile = p; }
    } catch { /* profile stays null — both actions degrade gracefully */ }
    const business = (profile && profile.business_name) || email;

    if (action === "survey") {
      // 😢 CHURN CAPTURE — log it LOUD in the client's own feed (so /admin + the owner digest
      // see it) and email Luis immediately with a win-back suggestion. Rescue window opens NOW.
      const reason = (b.reason || "unspecified").toString().slice(0, 60);
      const note = (b.note || "").toString().slice(0, 500);
      const ev = await rpc("ingest_client_event", {
        p_secret: ING,
        p_email: email,
        p_type: "churn_risk",
        p_channel: "Portal",
        p_summary: `😢 pediu cancelamento: ${reason}${note ? ` — “${note.slice(0, 180)}”` : ""}`.slice(0, 300),
        p_amount: 0,
        p_payload: { kind: "churn_survey", reason, note },
      });
      let emailed = false;
      if (env.RESEND_API_KEY) {
        const OWNER = (env.OWNER_EMAIL && isOwnerEmail(env.OWNER_EMAIL, env)) ? env.OWNER_EMAIL : "smart@guileoai.com";
        const tpl = churnAlertEmail({ email, business, reason, note });
        const sr = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [OWNER], subject: tpl.subject, html: tpl.html }),
        });
        emailed = sr.ok;
      }
      return json({ ok: true, logged: ev.ok, emailed });
    }

    if (action === "export") {
      // 📥 DATA EXPORT — the client's OWN data, packaged as a downloadable JSON attachment.
      // Same data the gate call itself returned (their events ledger) + their profile. No
      // other tenant is reachable: the RPC only answers for a matching email+key pair.
      const payload = {
        exported_at: new Date().toISOString(),
        account_email: email,
        business: business,
        profile: profile || {},
        ...gdj, // events (+ any other fields get_client_data returns for this tenant)
      };
      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="guileo-data-export-${email.replace(/[^a-z0-9]/g, "_")}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
