// Cloudflare Pages Function — POST /api/gui-chat
// The public landing concierge "Gui" — answers prospect questions about Guileo and steers
// toward the live call / WhatsApp / pricing. Claude Haiku; voice agent speaks 20+ languages.
// Public (no token) but cheap + tightly scoped by the system prompt + small max_tokens.
import { factsBlock } from "../lib/productFacts.js";
import { guardSystemPrompt } from "../lib/guiConstitution.js";
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

const SYS = `You are Gui, the warm concierge AI on the website of Guileo (guileoai.com) — talk like a Four Seasons concierge: calm, confident, generous, never pushy.

WHAT GUILEO IS: an AI team that runs the front desk for local businesses (restaurants, clinics, salons, law firms, home services, real estate, gyms, e-commerce, and more). It gives the business:
- a 24/7 AI VOICE receptionist that answers every phone call,
- AI that replies on WhatsApp / SMS / Instagram / Facebook,
- instant missed-call text-back, and speed-to-lead callback (calls a new lead in ~60 seconds),
- appointment booking + reminders that cut no-shows,
- review collection, and reactivation of past customers,
- it also closes & collects (sends pay links, takes deposits),
- PLUS done-for-you websites/apps and marketing/ads.
It speaks 20+ languages on the phone (English, Spanish, Portuguese, Mandarin, Russian, Korean, Haitian Creole, Hindi and more). A REAL human supervises everything. Most businesses go live in about 7 days, with a 30-day money-back guarantee. Usage is metered in simple credits.

PRICING (only if asked — keep it light, then point to the Pricing page /planos): self-serve monthly plans start at $149/mo, and there's a done-for-you track that's quoted by proposal (a specialist sets everything up for you). For exact numbers say "the Pricing page has the current plans" and suggest /planos.

YOUR JOB: answer the visitor's question concretely in 2–4 sentences, in THEIR language. Then, when it fits, gently invite ONE next step — the strongest is "drop your number and Gui will call YOU in seconds so you can hear it live" (the live demo on this page), or message us on WhatsApp, or see plans. Never invent specific client names, fake metrics, or features that aren't above. If asked something off-topic, answer briefly and steer back to how Guileo could help their business. Reply ONLY with the plain message text — no JSON, no markdown headers.`;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // It's a website widget — reject off-site callers and cap frequency so a script can't
    // loop the LLM and burn the Anthropic quota (≤ 20 msgs / minute / IP).
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "gui-chat", 20)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const msg = (b.message || "").toString().slice(0, 1200).trim();
    const lang = (b.lang || "en").toString();
    const history = Array.isArray(b.history) ? b.history.slice(-6) : [];
    if (!msg) return json({ error: "empty" }, 400);

    // CAPTURE — if the visitor drops a phone or email in chat, save it as a lead through the same
    // pipeline every form uses (gui_actions store + owner email + consent log). Mirrors the phone/
    // email regexes in widget-chat.js. noCall:true + consent:false: an unsolicited chat message is
    // NOT an affirmative opt-in, so this must never auto-dial (TCPA). Best-effort, never blocks the reply.
    const phoneMatch = msg.match(/\+?\d[\d\s().-]{7,}\d/);
    const emailMatch = msg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (phoneMatch || emailMatch) {
      try {
        const origin = new URL(request.url).origin;
        // Origin header set so /api/lead's sameOrigin gate accepts this internal hop (same as lead.js).
        // context.waitUntil — a bare un-awaited fetch is CANCELLED when the response returns on
        // Cloudflare, so the lead silently never landed. waitUntil keeps it alive past the reply.
        context.waitUntil(fetch(`${origin}/api/lead`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify({
            name: "Landing chat visitor",
            phone: phoneMatch ? phoneMatch[0].trim() : "",
            email: emailMatch ? emailMatch[0].trim() : "",
            contact: (phoneMatch ? phoneMatch[0] : emailMatch[0]).trim(),
            source: "landing-chat", channel: "Landing chat", lang,
            message: msg.slice(0, 300), noCall: true, consent: false,
          }),
        }).catch(() => {}));
      } catch { /* capture is best-effort — never break the concierge reply */ }
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ ok: true, answer: "I'm Gui — drop your number on this page and I'll call you in seconds to show you exactly how I'd answer, book and sell for your business. Or message us on WhatsApp." });
    }
    const langName = lang === "pt" ? "Brazilian Portuguese" : lang === "es" ? "LatAm Spanish" : lang === "hi" ? "Hindi" : "English";
    const messages = [
      ...history.filter((h) => h && h.role && h.text).map((h) => ({ role: h.role === "gui" ? "assistant" : "user", content: String(h.text).slice(0, 800) })),
      { role: "user", content: msg },
    ];
    // Model fallback chain (mirrors widget-chat.js) — a transient failure on one model must not drop
    // the visitor to a generic line. Try each in order; stop early on auth/billing errors.
    let answer = "";
    for (const model of ["claude-fable-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"]) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model, max_tokens: 320, system: `${guardSystemPrompt(SYS, { audience: "public" })}\n\n${factsBlock()}\n\nReply in ${langName}.`, messages }),
        });
        if (r.ok) { const d = await r.json(); answer = (d?.content?.[0]?.text || "").trim(); if (answer) break; }
        else if (r.status === 401 || r.status === 402) break; // auth/billing won't improve with another model
      } catch { /* try next model */ }
    }
    if (!answer) answer = "I'm here. The fastest way to see Guileo is to drop your number on this page — Gui calls you in seconds. Or message us on WhatsApp.";
    return json({ ok: true, answer });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
