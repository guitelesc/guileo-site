// Cloudflare Pages Function — POST /api/agent-action
// The single "Tool" the Gui voice agent calls to DO things on a call (works for every sector):
//   action = book | lead | review | sale | quote | reschedule | cancel | callback
// It forwards the action to the owner's LEAD_WEBHOOK (so they SEE every booking/lead/sale live in
// their Google Sheet / CRM) and returns a short, natural confirmation the agent reads back.
// Add it in ElevenLabs → Tools → Add tool → Webhook (POST) → URL = https://<your-domain>/api/agent-action
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json();
    const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));
    const action = s(b.action || "lead", 40);
    const rec = {
      action,
      name: s(b.name, 120),
      contact: s(b.contact || b.phone || b.email, 160),
      when: s(b.when || b.datetime, 120),
      details: s(b.details || b.need || b.message, 500),
      business: s(b.business, 160),
      industry: s(b.industry, 80),
      amount: s(b.amount, 40),
      source: "gui-call",
      at: new Date().toISOString(),
    };

    // Forward so the owner SEES it (Zapier/Make/n8n catch hook → Google Sheet / CRM / email).
    let delivered = false;
    if (env.LEAD_WEBHOOK) {
      try {
        const r = await fetch(env.LEAD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) });
        delivered = r.ok;
      } catch { /* keep going — never fail the call */ }
    }

    // Natural confirmation the agent speaks back to the caller.
    const who = rec.name || "you";
    const msg = {
      book: `All set — booked for ${who}${rec.when ? ` on ${rec.when}` : ""}. You'll get a confirmation. Anything else?`,
      reschedule: `Done — moved ${who}'s booking${rec.when ? ` to ${rec.when}` : ""}.`,
      cancel: `Cancelled ${who}'s booking — no worries.`,
      lead: `Got it, ${who}. I've saved your details and the team will follow up shortly.`,
      callback: `Perfect — I've scheduled a callback for ${who}${rec.when ? ` ${rec.when}` : ""}.`,
      review: `Thanks! I've sent ${who} a review request.`,
      sale: `Order logged${rec.amount ? ` for ${rec.amount}` : ""} — thank you, ${who}!`,
      quote: `I've captured your quote request, ${who} — you'll have it soon.`,
    }[action] || `Done — ${action} captured for ${who}.`;

    return json({ ok: true, delivered, message: msg, record: rec });
  } catch {
    return json({ ok: false, message: "Sorry, I couldn't save that just now — could you repeat it?" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
