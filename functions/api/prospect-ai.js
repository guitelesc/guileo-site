// Cloudflare Pages Function — POST /api/prospect-ai
// Builds a seller's "hunt plan of the day" for a chosen niche + neighborhood. Same security model
// as pitch-ai.js (sameOrigin + per-IP rate limit + server-held key, hardened fallback chain).
// HONESTY RULE (locked in the prompt): the AI describes the IDEAL TARGET PROFILE and the LOCAL
// pains — it NEVER invents names of real businesses. Real targets come from the live search links
// the UI builds (Google Maps / Yelp). Returns a structured JSON object the UI renders section by
// section: { perfil, dores[], gancho, objecao, resposta, script }.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { verifySession } from "../lib/sellerSession.js";

// One hardened Claude call for every request — mirrors pitch-ai.js:
// (1) drop any leading non-user turns (Anthropic requires the first message to be role:"user");
// (2) walk the model chain on transient/upstream errors and, if all fail, surface the real status
//     instead of a masked 502 so the UI (and we) can see WHY.
// MODEL_CHAIN vem de ../lib/guiBrain.js — NÃO declare outra aqui (2026-08-12).
// Eram DEZ cópias idênticas da mesma lista de modelos, uma por arquivo. Idênticas HOJE: conferi as
// dez antes de mexer, e é exatamente por estarem iguais que a hora de unificar é agora — depois que
// uma diverge, alguém já foi atendido pelo modelo errado e ninguém sabe qual superfície foi.
// É o padrão que esta sessão inteira perseguiu: cópia sem vínculo com a fonte.
import { MODEL_CHAIN } from "../lib/guiBrain.js";
async function askClaude(env, { system, messages, max_tokens = 700 }) {
  let msgs = Array.isArray(messages) ? messages.slice() : [];
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) return { err: "empty_messages", status: 400 };
  let lastStatus = 0, lastDetail = "";
  for (const model of MODEL_CHAIN) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens, system, messages: msgs }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        const text = (d?.content?.[0]?.text || "").trim();
        if (text) return { text, model };
        lastStatus = 200; lastDetail = "empty_ai";
      } else {
        lastStatus = r.status; lastDetail = (await r.text().catch(() => "")).slice(0, 200);
        if (r.status === 401 || r.status === 402) break; // auth/billing — another model won't help
      }
    } catch (e) { lastStatus = 0; lastDetail = String(e).slice(0, 120); }
  }
  return { err: "ai_unavailable", status: lastStatus, detail: lastDetail };
}

// The system prompt injects the per-vertical pains from the playbooks (passed in as `painsHint`)
// so the plan is grounded in real Guileo pattern language, not generic filler.
const SYS = `You coach Guileo's field sellers. Given a business NICHE and a CITY/NEIGHBORHOOD, you write the seller's HUNT PLAN for that specific local scene.

GUILEO (use only these real capabilities): a 24/7 AI voice receptionist that answers every call; AI that replies on WhatsApp/SMS/Instagram; instant missed-call text-back and ~60-second speed-to-lead callback; appointment booking + reminders that cut no-shows; review collection; reactivation of past customers; it also closes & collects (pay links, deposits). Plus done-for-you websites/apps and marketing/ads. A real human supervises. Live in ~7 days, 30-day money-back.

STRATEGY (NON-NEGOTIABLE): the seller sells GROWTH as a specialist who solves the OWNER'S problem. NEVER aggressive. Frame everything around what the owner can IMPROVE, GAIN, and how they BEAT LOCAL COMPETITORS. Warm, consultative, calm.

HONESTY (CRITICAL): NEVER invent names of real businesses, owners, phone numbers, or addresses. Describe the TYPE of target and its traits only. If you name anything, make it a generic descriptor ("a family-run barbershop with under 20 Google reviews"), never a fake real name.

OUTPUT: reply with ONLY a raw JSON object (no markdown, no code fence, no preamble), in the requested language, with EXACTLY these keys:
{
  "perfil": "<2-3 sentences: the ideal target profile for this niche in this area — size, signals they're leaking leads, who to ask for>",
  "dores": ["<local pain 1>", "<local pain 2>", "<local pain 3>"],
  "gancho": "<one warm opening line to say first, problem-first, non-aggressive>",
  "objecao": "<the objection this owner will most likely raise>",
  "resposta": "<one calm 1-2 sentence reframe to that objection>",
  "script": "<a short 4-6 line door-to-door / phone / DM approach script the seller can read almost verbatim>"
}`;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "prospect-ai", 15)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));

    // 🚨 CRACHÁ DE VENDEDOR, ANTES DE QUALQUER COISA (2026-08-21).
    // Este endpoint gasta crédito da ANTHROPIC a cada chamada e estava aberto: só `sameOrigin` e
    // limite de taxa. `sameOrigin` é um cabeçalho que qualquer script forja; limite de taxa
    // atrasa o abuso, não o impede. O irmão dele (`pitch-ai`) — mesma família, mesmo custo — já
    // exigia sessão desde sempre. Porta cara aberta é conta de terceiro pagando IA nossa.
    // E o portão vem ANTES de validar campo: sonda sem crachá vê 401, nunca "falta o campo X".
    const quem = await verifySession(env, (b.sid || "").toString());
    if (!quem) return json({ error: "auth_required", message: "Entre de novo no /vendedor pra usar as ferramentas de IA." }, 401);

    const niche = (b.niche || "").toString().slice(0, 60).trim();
    const city = (b.city || "").toString().slice(0, 80).trim();
    const painsHint = (b.pains || "").toString().slice(0, 400).trim();
    const lang = (b.lang || "pt").toString();
    if (!niche || !city) return json({ error: "empty" }, 400);

    const langName = lang === "en" ? "US English" : lang === "es" ? "LatAm Spanish" : lang === "hi" ? "Hindi" : "Brazilian Portuguese";

    if (!env.ANTHROPIC_API_KEY) {
      // Honest inert fallback — no invented data, clearly flagged as AI-unavailable.
      return json({ ok: true, plan: {
        perfil: "(IA indisponível: configure ANTHROPIC_API_KEY.)",
        dores: [], gancho: "", objecao: "", resposta: "", script: "",
      } });
    }

    const ask = [
      `Niche: ${niche}`,
      `City/neighborhood: ${city}`,
      painsHint ? `Known pains for this niche (use these): ${painsHint}` : "",
    ].filter(Boolean).join("\n");

    const a = await askClaude(env, {
      system: `${SYS}\n\nWrite ALL string values in ${langName}. Keep the JSON keys exactly as given (Portuguese keys). Reply with ONLY the JSON object.`,
      max_tokens: 760,
      messages: [{ role: "user", content: `Write the hunt plan for:\n${ask}` }],
    });
    if (!a.text) return json({ error: "ai_unavailable", ai_status: a.status, detail: a.detail }, 200);

    // The model sometimes wraps JSON in a code fence or adds a stray sentence — extract the object.
    let plan = null;
    try {
      const m = a.text.match(/\{[\s\S]*\}/);
      plan = JSON.parse(m ? m[0] : a.text);
    } catch { plan = null; }
    if (!plan || typeof plan !== "object") {
      // Never 500 on a parse miss — hand the raw text back so the UI can still show something.
      return json({ ok: true, raw: a.text });
    }
    // Normalize shape so the UI never crashes on a missing key.
    const out = {
      perfil: String(plan.perfil || ""),
      dores: Array.isArray(plan.dores) ? plan.dores.map((d) => String(d)).slice(0, 5) : [],
      gancho: String(plan.gancho || ""),
      objecao: String(plan.objecao || ""),
      resposta: String(plan.resposta || ""),
      script: String(plan.script || ""),
    };
    return json({ ok: true, plan: out });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
