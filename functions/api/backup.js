// Cloudflare Pages Function — GET/POST /api/backup?token=DIGEST_TOKEN
// Daily data safety: pulls ALL leads (gui_actions) + ALL real client events and emails
// the owner a CSV snapshot. Wired into the guileo-digest-cron Worker (runs after the
// digest), so even a worst-case database loss costs at most one day of data.
import { json, safeEq } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const toCsv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
    const url = new URL(request.url);
    const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
    if (!env.RESEND_API_KEY) return json({ error: "no mailer" }, 501);

    const hdrs = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" };
    const [leadsR, eventsR] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/rpc/admin_actions`, { method: "POST", headers: hdrs, body: JSON.stringify({ p_token: env.ADMIN_TOKEN || "" }) }),
      fetch(`${SB_URL}/rest/v1/rpc/admin_all_events`, { method: "POST", headers: hdrs, body: JSON.stringify({ p_token: env.ADMIN_TOKEN || "" }) }),
    ]);
    const leads = leadsR.ok ? await leadsR.json() : [];
    const events = eventsR.ok ? await eventsR.json() : [];

    const leadsCsv = toCsv(leads, ["created_at", "action", "name", "contact", "business", "industry", "source", "details"]);
    const eventsCsv = toCsv(events, ["created_at", "client_email", "type", "channel", "summary", "amount"]);
    const day = new Date().toISOString().slice(0, 10);
    const OWNER = env.OWNER_EMAIL || "smart@guileoai.com";
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";

    const sr = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [OWNER],
        subject: `🗄️ Guileo backup diário · ${day} · ${leads.length} leads · ${events.length} eventos`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px"><h2 style="color:#3E9468;margin:0 0 6px">Backup diário ✓</h2><p style="color:#888;margin:0 0 12px">${day} — ${leads.length} leads e ${events.length} eventos reais em anexo (CSV). Guarda este email: é a sua cópia de segurança.</p></div>`,
        attachments: [
          { filename: `guileo-leads-${day}.csv`, content: btoa(unescape(encodeURIComponent(leadsCsv))) },
          { filename: `guileo-eventos-${day}.csv`, content: btoa(unescape(encodeURIComponent(eventsCsv))) },
        ],
      }),
    });
    return json(sr.ok ? { ok: true, leads: leads.length, events: events.length } : { ok: false, error: `mailer ${sr.status}` }, sr.ok ? 200 : 502);
  } catch (e) {
    return json({ error: String(e).slice(0, 120) }, 500);
  }
}
