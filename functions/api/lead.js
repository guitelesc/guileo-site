// Cloudflare Pages Function — POST /api/lead → captures a lead (name + email/phone/contact).
// Leads ALWAYS land in the gui_actions store (the same feed /admin and /live read), so Luis
// sees every lead and can close it. Optionally also forwards to LEAD_WEBHOOK (Zapier/Sheet/CRM)
// and a Supabase `leads` table.
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));
    const lead = {
      name: s(body.name, 120),
      email: s(body.email, 160),
      phone: s(body.phone, 40),
      contact: s(body.contact || body.phone || body.email, 160),
      channel: s(body.channel, 40),
      business: s(body.business, 160),
      industry: s(body.industry, 80),
      message: s(body.message, 800),
      score: s(body.score, 12),
      leak: s(body.leak, 16),
      source: s(body.source || "website", 60),
      lang: s(body.lang, 5),
      at: new Date().toISOString(),
    };
    // need at least one way to reach them
    if (!lead.email && !lead.phone && !lead.contact) return json({ error: "Need a contact" }, 400);

    // human-readable detail line for the feed
    const bits = [];
    if (lead.industry) bits.push(lead.industry);
    if (lead.score) bits.push(`score ${lead.score}/100`);
    if (lead.leak) bits.push(`leak ${lead.leak}/mo`);
    if (lead.message) bits.push(lead.message);
    const details = bits.join(" · ");

    let stored = false;

    // 1) ALWAYS persist to the gui_actions store → shows on /admin + /live (Luis closes from there)
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://fccwbafkbhkyrvauzshl.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjY3diYWZrYmhreXJ2YXV6c2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTU3NzQsImV4cCI6MjA5NDI5MTc3NH0.knDpHzK_cfpqmUzpLI4rTndAumn1yepCiRwCSAqwSNs";
    try {
      const r = await fetch(`${SB_URL}/rest/v1/gui_actions`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ action: "lead", name: lead.name, contact: lead.contact || lead.email || lead.phone, details, business: lead.business, industry: lead.industry, source: lead.source }),
      });
      stored = r.ok;
    } catch { /* never fail the capture */ }

    // 2) Optional: forward to a no-code webhook (email / Sheet / CRM)
    if (env.LEAD_WEBHOOK) {
      try { const r = await fetch(env.LEAD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) }); if (r.ok) stored = true; } catch { /* keep going */ }
    }
    // 3) Optional: dedicated Supabase `leads` table
    if (env.SUPABASE_URL && env.SUPABASE_KEY) {
      try { const r = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, { method: "POST", headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(lead) }); if (r.ok) stored = true; } catch { /* keep going */ }
    }

    // 4) Email the owner instantly (works as soon as RESEND_API_KEY is set). Defaults to the
    //    Resend account email so it delivers even before guileoai.com is DNS-verified.
    if (env.RESEND_API_KEY) {
      const OWNER = env.OWNER_EMAIL || "smart@guileoai.com";
      const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
      const kind = lead.source === "configurator" ? "quote request" : lead.source === "portal-onboard" ? "new client signup" : "lead";
      const rows = [
        ["Name", lead.name], ["Contact", lead.contact || lead.email || lead.phone], ["Business", lead.business], ["Industry", lead.industry], ["Source", lead.source], ["Details", details || lead.message],
      ].filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#888">${k}</td><td style="padding:4px 0;font-weight:600">${String(v).replace(/</g, "&lt;")}</td></tr>`).join("");
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [OWNER], subject: `🌱 New ${kind}: ${lead.name}`, html: `<div style="font-family:system-ui,sans-serif;max-width:520px"><h2 style="color:#3E9468;margin:0 0 4px">New ${kind}</h2><p style="color:#888;margin:0 0 14px">via guileoai.com</p><table style="font-size:14px">${rows}</table><p style="margin-top:18px"><a href="https://www.guileoai.com/admin" style="color:#3E9468;font-weight:700">Open /admin →</a></p></div>` }),
        });
      } catch { /* never block the capture */ }
    }

    return json({ ok: true, stored });
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
