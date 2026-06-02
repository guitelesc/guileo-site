// Cloudflare Pages Function — POST /api/lead → captures a lead (name/email/phone/business).
// Easiest setup: set a single secret LEAD_WEBHOOK in Cloudflare (a Zapier/Make/n8n "catch hook"
// or any URL) and every lead is forwarded there (→ your email, a Google Sheet, a CRM, etc.).
// Optional Supabase: set SUPABASE_URL + SUPABASE_KEY to also insert into a `leads` table.
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const lead = {
      name: (body.name || "").toString().slice(0, 120),
      email: (body.email || "").toString().slice(0, 160),
      phone: (body.phone || "").toString().slice(0, 40),
      business: (body.business || "").toString().slice(0, 160),
      message: (body.message || "").toString().slice(0, 800),
      source: (body.source || "website").toString().slice(0, 60),
      lang: (body.lang || "").toString().slice(0, 5),
      at: new Date().toISOString(),
    };
    if (!lead.email && !lead.phone) return json({ error: "Need an email or phone" }, 400);

    let stored = false;

    // 1) Forward to a no-code webhook (Zapier / Make / n8n / your endpoint)
    if (env.LEAD_WEBHOOK) {
      try {
        const r = await fetch(env.LEAD_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead),
        });
        if (r.ok) stored = true;
      } catch { /* fall through */ }
    }

    // 2) Optional: insert into Supabase `leads` table
    if (env.SUPABASE_URL && env.SUPABASE_KEY) {
      try {
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/leads`, {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_KEY,
            Authorization: `Bearer ${env.SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(lead),
        });
        if (r.ok) stored = true;
      } catch { /* fall through */ }
    }

    // Always acknowledge; tell the client whether it was stored so it can fall back
    // (e.g. open a prefilled WhatsApp) when no destination is configured yet.
    return json({ ok: true, stored });
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
