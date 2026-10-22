// Cloudflare Pages Function — POST /api/gui-chat
// The public landing concierge "Gui" — answers prospect questions about Guileo and steers
// toward the live call / WhatsApp / pricing. Claude Haiku; voice agent speaks 16 languages.
// Public (no token) but cheap + tightly scoped by the system prompt + small max_tokens.
import { factsBlock } from "../lib/productFacts.js";
import { guardSystemPrompt } from "../lib/guiConstitution.js";
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { falarComAgente } from "../lib/chatEleven.js";
import { askClaude } from "../lib/guiBrain.js";

const SYS = `You are Gui, the warm concierge AI on the website of Guileo (guileoai.com) — talk like a Four Seasons concierge: calm, confident, generous, never pushy.

WHAT GUILEO IS: an AI team that runs the front desk for local businesses (restaurants, clinics, salons, law firms, home services, real estate, gyms, e-commerce, and more). It gives the business:
- a 24/7 AI VOICE receptionist that answers every phone call,
- AI that replies on WhatsApp / SMS / Instagram / Facebook,
- instant missed-call text-back, and speed-to-lead callback (calls a new lead in ~60 seconds),
- appointment booking + reminders that cut no-shows,
- review collection, and reactivation of past customers,
- it also closes & collects (sends pay links, takes deposits),
- PLUS done-for-you websites/apps and marketing/ads.
It speaks 16 languages on the phone (English, Spanish, Brazilian Portuguese, Hindi, Mandarin, Russian, Korean, French, Arabic, Vietnamese, Tagalog, German, Italian, Polish, Japanese, Ukrainian). A REAL human supervises everything. Most businesses go live in about 7 days, with a 30-day money-back guarantee. Usage is metered in simple credits.

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

    if (!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) {
      return json({ ok: true, answer: "I'm Gui — drop your number on this page and I'll call you in seconds to show you exactly how I'd answer, book and sell for your business. Or message us on WhatsApp." });
    }
    const langName = lang === "pt" ? "Brazilian Portuguese" : lang === "es" ? "LatAm Spanish" : lang === "hi" ? "Hindi" : "English";
    const messages = [
      ...history.filter((h) => h && h.role && h.text).map((h) => ({ role: h.role === "gui" ? "assistant" : "user", content: String(h.text).slice(0, 800) })),
      { role: "user", content: msg },
    ];
    // 2026-10-05: sem chamada direta à Anthropic — askClaude usa o Escritor da ElevenLabs quando ela está desligada.
    // Aqui, porém, o chat é PÚBLICO: sem a chave da Anthropic ele NÃO vai pro Escritor — pula direto
    // para o agente de voz da Gui (falarComAgente, abaixo), que já atende este chat em produção.
    let answer = "";
    if (env.ANTHROPIC_API_KEY) {
      answer = await askClaude(env, { system: `${guardSystemPrompt(SYS, { audience: "public" })}\n\n${factsBlock()}\n\nReply in ${langName}.`, maxTokens: 320, messages });
    }
    // 🚨 A FRASE ENLATADA PRECISA SE IDENTIFICAR (24/08). Ela existe para o visitante nunca ver
    // uma tela muda — e isso está certo. O errado era ela sair com `ok:true` e mais nada: o
    // canário do semáforo julga "200 + texto não vazio", então esta frase mantinha o painel VERDE
    // com a Anthropic SEM SALDO e o chat respondendo enlatado havia horas. Um monitor que não
    // consegue falhar não é monitor. `cerebro:false` é o que permite o alarme existir.
    // E ela responde no IDIOMA de quem perguntou: uma frase EN numa pergunta PT é defeito nosso,
    // não degradação aceitável.
    const ENLATADA = {
      pt: "Estou aqui. O jeito mais rápido de ver a Guileo é deixar seu número nesta página — a Gui te liga em segundos. Ou fale com a gente no WhatsApp.",
      es: "Estoy aquí. La forma más rápida de ver Guileo es dejar su número en esta página — Gui le llama en segundos. O escríbanos por WhatsApp.",
      en: "I'm here. The fastest way to see Guileo is to drop your number on this page — Gui calls you in seconds. Or message us on WhatsApp.",
    };
    // ── SOCORRO PELO AGENTE DA ELEVENLABS (2026-09-22) ──────────────────────────────────────────
    // O widget-chat ganhou este degrau em 25/08 e ficou verde; este endpoint ficou só na Anthropic —
    // e quando ela cala (saldo/modelo), o canary do semáforo fica VERMELHO e o chat do portal
    // responde enlatado. É a MESMA Gui do telefone respondendo por texto, no mesmo caminho que o
    // widget já usa. Só entra se a Anthropic não respondeu; `cerebro_de` diz quem respondeu.
    let cerebroDe = answer && env.ANTHROPIC_API_KEY ? "anthropic" : null;
    if (!answer) {
      try {
        const r = await falarComAgente(env, { agentId: env.ELEVENLABS_AGENT_ID || "agent_5901ktdkev68f5kb161fmeax1rdm", texto: msg,
          vars: { name: "", business: "", need: "", lang: (b.lang || "en").toString().slice(0, 2), canal: "texto", contato: "" } });
        if (r && r.ok && r.texto) { answer = String(r.texto).trim(); cerebroDe = "elevenlabs"; }
      } catch { /* sem socorro → enlatada abaixo, identificada */ }
    }
    const cerebro = !!answer;
    if (!answer) answer = ENLATADA[(b.lang || "en").toString().slice(0, 2)] || ENLATADA.en;
    return json({ ok: true, answer, cerebro, cerebro_de: cerebroDe });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
