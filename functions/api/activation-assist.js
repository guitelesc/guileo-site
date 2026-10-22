// Cloudflare Pages Function — POST /api/activation-assist
// The seller's ACTIVATION COPILOT. When a rep is mid-activation and stuck ("client paid but the
// portal is empty", "how do I forward a Verizon line?", "what do I send the client now?"), this
// answers in real time, in the rep's language, from the REAL activation facts — so Luis stops being
// the bottleneck for every go-live. Same security model as pitch-ai (sameOrigin + per-IP rate limit
// + server-held key) and the SAME hardened model-fallback chain (never a naked 502).
import { factsBlock } from "../lib/productFacts.js";
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

// MODEL_CHAIN vem de ../lib/guiBrain.js — NÃO declare outra aqui (2026-08-12).
// Eram DEZ cópias idênticas da mesma lista de modelos, uma por arquivo. Idênticas HOJE: conferi as
// dez antes de mexer, e é exatamente por estarem iguais que a hora de unificar é agora — depois que
// uma diverge, alguém já foi atendido pelo modelo errado e ninguém sabe qual superfície foi.
// É o padrão que esta sessão inteira perseguiu: cópia sem vínculo com a fonte.
import { askClaude as cerebroDeTexto } from "../lib/guiBrain.js";
async function askClaude(env, { system, messages, max_tokens = 500 }) {
  let msgs = Array.isArray(messages) ? messages.slice() : [];
  while (msgs.length && msgs[0].role !== "user") msgs.shift(); // Anthropic requires first msg = user
  if (!msgs.length) return { err: "empty_messages", status: 400 };
  // 2026-10-05: sem chamada direta à Anthropic — askClaude usa o Escritor da ElevenLabs quando ela está desligada.
  // O formato de volta ({ text, model } | { err, status, detail }) continua o mesmo; o motivo vem do `diag`.
  const diag = [];
  const text = await cerebroDeTexto(env, { system, messages: msgs, maxTokens: max_tokens, diag });
  const ult = diag[diag.length - 1] || {};
  if (text) return { text, model: ult.model || ult.cerebro || "" };
  return { err: "ai_unavailable", status: ult.status || 0, detail: String(ult.detalhe || ult.erro || ult.bloqueado || "").slice(0, 200) };
}

// The activation truth. These are the ONLY facts the copilot may state as how-it-works — kept in
// sync with the Ativação steps in src/pages/Vendedor.jsx. If activation changes, update BOTH.
const SYS = `You are Guileo's ACTIVATION COPILOT for a seller (a human rep) who is getting a client's AI ("Gui") live. You help the rep finish the activation and coach them on exactly what to do/say next. Answer in the rep's language (detect it from their message; default to the requested lang).

HOW ACTIVATION REALLY WORKS (state ONLY these facts as mechanics — never invent steps, URLs, or codes):
1) CLIENT PAYS on Stripe (a plan or a payment link). The trained Gui is born AUTOMATICALLY and the client gets an email with their ACCESS CODE. Nothing manual.
2) CONNECT THE PORTAL: the client signs in at guileoai.com/portal with the SAME email they paid with, and pastes the ACCESS CODE from that email. The cockpit then shows their real data.
3) FORWARD THE LINE: on the business phone, the client dials a carrier code — *72 + the Gui number = forward ALL calls; *71 = forward only missed/busy. To turn forwarding off it's usually *73. Now every call lands on Gui. (Codes are the standard US carrier codes; if a carrier differs, tell the rep to check that carrier's "call forwarding" help.)
A real human supervises. 30-day money-back. The client can also self-serve the intake the rep filled.

COMMON PROBLEMS you can solve:
- "Client paid but the portal is empty" → they must sign in with the EXACT email used on Stripe and paste the code from the birth email; if the email didn't arrive, check spam, and the rep can ask Luis to resend from /admin.
- "Calls still ring the old phone" → forwarding wasn't set: dial *72 + the Gui number from the business line; confirm they hear the confirmation tone.
- "Wrong info / prices in the agent" → the rep fixes the intake and re-approves; prices import replaces the old ones.
- "Which number does the client dial?" → the Gui number from the birth email / the number Luis mapped in /admin (never the site demo number).

STYLE: warm, calm, concrete, like a senior colleague. Short. Use numbered steps only when giving a procedure. NEVER invent access codes, phone numbers, or dashboard links. If something needs Luis (resend email, map a number, fix billing), say so plainly and tell the rep it's a /admin action.

If the rep asks you to WRITE A MESSAGE to send the client, output ONLY the message text (WhatsApp/SMS-ready, friendly, in the client's language), no preamble.`;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "activation-assist", 20)) return json({ error: "too many requests" }, 429);
    if (!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) return json({ error: "ai_unconfigured" }, 503);

    const b = await request.json().catch(() => ({}));
    const lang = ({ pt: "Portuguese", en: "English", es: "Spanish", hi: "Hindi" })[(b.lang || "pt").toString().slice(0, 2)] || "Portuguese";
    // Accept a rolling transcript [{role,content}] OR a single {message}. Keep last 10 turns, trim size.
    let messages = Array.isArray(b.messages) ? b.messages : (b.message ? [{ role: "user", content: String(b.message) }] : []);
    messages = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
    if (!messages.length) return json({ error: "empty_messages" }, 400);

    const ctx = b.context ? `\n\nCONTEXT the rep gave (business/sector/status): ${String(b.context).slice(0, 400)}` : "";
    const out = await askClaude(env, { system: `${SYS}\n\n${factsBlock({ audience: "seller" })}\n\nRespond in ${lang}.${ctx}`, messages, max_tokens: 520 });
    if (out.err) return json({ error: out.err, status: out.status, detail: out.detail }, out.status && out.status >= 400 ? 503 : 503);
    return json({ ok: true, reply: out.text, model: out.model });
  } catch (e) {
    return json({ error: "server_error", detail: String(e).slice(0, 160) }, 500);
  }
}
