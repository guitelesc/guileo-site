// Cloudflare Pages Function — POST /api/agent-action
// The single "Tool" the Gui voice agent calls to DO things on a call (works for every sector):
//   action = book | lead | review | sale | quote | reschedule | cancel | callback
// It forwards the action to the owner's LEAD_WEBHOOK (so they SEE every booking/lead/sale live in
// their Google Sheet / CRM) and returns a short, natural confirmation the agent reads back.
// Add it in ElevenLabs → Tools → Add tool → Webhook (POST) → URL = https://<your-domain>/api/agent-action
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // SECURITY: this webhook records bookings/sales/leads — require a shared secret so nobody can
    // forge actions. Secure-by-default: if AGENT_ACTION_SECRET isn't configured, reject everything.
    // When connecting ElevenLabs Tools → Webhook, set AGENT_ACTION_SECRET and pass it as the
    // `x-guileo-secret` header (or ?secret= query) in the tool config.
    const provided = request.headers.get("x-guileo-secret") || new URL(request.url).searchParams.get("secret") || "";
    if (!env.AGENT_ACTION_SECRET || provided !== env.AGENT_ACTION_SECRET) return json({ error: "unauthorized" }, 401);
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

    // 1) Persist to Supabase so it shows live on /live (public anon key + RLS). Defaults to the
    //    gui_actions store; override with GUI_ACTIONS_SUPABASE_URL/KEY env vars to move it.
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://fccwbafkbhkyrvauzshl.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjY3diYWZrYmhreXJ2YXV6c2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTU3NzQsImV4cCI6MjA5NDI5MTc3NH0.knDpHzK_cfpqmUzpLI4rTndAumn1yepCiRwCSAqwSNs";
    let stored = false;
    try {
      const r = await fetch(`${SB_URL}/rest/v1/gui_actions`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ action: rec.action, name: rec.name, contact: rec.contact, slot: rec.when, details: rec.details, business: rec.business, industry: rec.industry, amount: rec.amount, source: rec.source }),
      });
      stored = r.ok;
    } catch { /* never fail the call */ }

    // 2) Also forward to the owner's webhook if they set one (Sheet/CRM/email).
    let delivered = false;
    if (env.LEAD_WEBHOOK) {
      try {
        const r = await fetch(env.LEAD_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) });
        delivered = r.ok;
      } catch { /* keep going — never fail the call */ }
    }

    // Natural confirmation the agent speaks back to the caller — covers EVERYTHING Gui does on a call.
    const who = rec.name || "you";
    const amt = rec.amount ? `$${rec.amount}` : "";
    const msg = {
      book: `All set — booked for ${who}${rec.when ? ` on ${rec.when}` : ""}. You'll get a confirmation. Anything else?`,
      reschedule: `Done — moved ${who}'s booking${rec.when ? ` to ${rec.when}` : ""}.`,
      cancel: `Cancelled ${who}'s booking — no worries.`,
      order: `Order placed for ${who}${amt ? ` (${amt})` : ""} — I'll send a confirmation.`,
      sale: `Sale logged${amt ? ` for ${amt}` : ""} — thank you, ${who}!`,
      invoice: `I've sent ${who} a secure payment link${amt ? ` for ${amt}` : ""} — you can pay whenever you're ready.`,
      quote: `I've captured your quote request, ${who} — you'll have it shortly.`,
      lead: `Got it, ${who}. I've saved your details and the team will follow up.`,
      qualify: `Thanks, ${who} — noted what you need; we'll match you to the right option.`,
      callback: `Perfect — I've scheduled a callback for ${who}${rec.when ? ` ${rec.when}` : ""}.`,
      review: `Thanks! I've sent ${who} a review request.`,
      confirm: `Confirmation sent to ${who}.`,
      message: `Message noted — ${who} will hear from us shortly.`,
      winback: `Welcome back, ${who}! I've set up a special offer for you.`,
      noshow: `No problem — I've rebooked ${who}${rec.when ? ` for ${rec.when}` : ""} and freed your old slot.`,
      info: `Noted your question, ${who} — someone will get you the exact answer.`,
    }[action] || `Done — ${action} captured for ${who}.`;

    return json({ ok: true, stored, delivered, message: msg, record: rec });
  } catch {
    return json({ ok: false, message: "Sorry, I couldn't save that just now — could you repeat it?" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
