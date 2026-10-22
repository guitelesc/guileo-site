// Cloudflare Pages Function — POST /api/pitch-ai
// Personalizes a seller's pitch card for a specific prospect. Same security model as gui-chat
// (sameOrigin + per-IP rate limit + server-held key). The system prompt LOCKS the strategy:
// consultative, non-aggressive, problem→solution→gain→beat-competition. Returns plain sections.
import { factsBlock } from "../lib/productFacts.js";
import { guardSystemPrompt } from "../lib/guiConstitution.js";
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { gerarCriativoAds } from "../lib/criativoAds.js";
import { verifySession } from "../lib/sellerSession.js";

// One hardened Claude call for every mode. Fixes two field-reported failure classes:
// (1) Anthropic requires the FIRST message to be role:"user" — the practice roleplay seeds the
//     chat with the owner's (assistant) opener, which 400s the API → drop leading assistant turns.
// (2) A model the key can't reach (or a transient upstream error) used to surface as a naked 502
//     the seller saw as "…" — now we fall back down the model chain and, if everything fails,
//     return the upstream status so the UI (and we) can see WHY instead of a masked edge page.
// MODEL_CHAIN vem de ../lib/guiBrain.js — NÃO declare outra aqui (2026-08-12).
// Eram DEZ cópias idênticas da mesma lista de modelos, uma por arquivo. Idênticas HOJE: conferi as
// dez antes de mexer, e é exatamente por estarem iguais que a hora de unificar é agora — depois que
// uma diverge, alguém já foi atendido pelo modelo errado e ninguém sabe qual superfície foi.
// É o padrão que esta sessão inteira perseguiu: cópia sem vínculo com a fonte.
import { askClaude as cerebroDeTexto } from "../lib/guiBrain.js";
async function askClaude(env, { system, messages, max_tokens = 300 }) {
  let msgs = Array.isArray(messages) ? messages.slice() : [];
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) return { err: "empty_messages", status: 400 };
  // 2026-10-05: sem chamada direta à Anthropic — askClaude usa o Escritor da ElevenLabs quando ela está desligada.
  // O formato de volta ({ text, model } | { err, status, detail }) continua o mesmo; o motivo vem do `diag`.
  const diag = [];
  const text = await cerebroDeTexto(env, { system, messages: msgs, maxTokens: max_tokens, diag });
  const ult = diag[diag.length - 1] || {};
  if (text) return { text, model: ult.model || ult.cerebro || "" };
  return { err: "ai_unavailable", status: ult.status || 0, detail: String(ult.detalhe || ult.erro || ult.bloqueado || "").slice(0, 200) };
}

const SYS = `You coach Guileo's sellers. You write a short, ready-to-use pitch a seller can say to a specific local-business owner.

GUILEO (use only these real capabilities): a 24/7 AI voice receptionist that answers every call; AI that replies on WhatsApp/SMS/Instagram; instant missed-call text-back and ~60-second speed-to-lead callback; appointment booking + reminders that cut no-shows; review collection; reactivation of past customers; it also closes & collects (pay links, deposits). Plus done-for-you websites/apps and marketing/ads. A real human supervises. Live in ~7 days, 30-day money-back.

STRATEGY (NON-NEGOTIABLE): the seller sells GROWTH as a specialist who solves the OWNER'S problem. NEVER aggressive. NEVER lead with "what we do / who we are / our features." ALWAYS frame around what the owner can IMPROVE, GAIN, and how they BEAT THE COMPETITION. Warm, consultative, calm — a trusted advisor, not a closer. No hype words, no fake metrics, no invented client names.

OUTPUT: reply ONLY with these labeled sections (no markdown, no preamble), each 1–2 sentences, in the requested language:
ABERTURA: <a warm, problem-first opening line to say first>
A DOR: <the specific pain this owner feels>
A SOLUÇÃO: <what improves for them, framed as their gain>
O GANHO: <2-3 concrete outcomes, comma-separated>
PASSAR A CONCORRÊNCIA: <the competitive wedge>
SE ELE HESITAR: <the likely objection + a calm one-line reframe>`;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "pitch-ai", 15)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));

    // PORTÃO DE VENDEDOR. `sameOrigin` não é autenticação — só diz que a chamada veio de uma
    // página nossa, coisa que qualquer visitante consegue. Sem isto, as ferramentas de IA do
    // vendedor rodavam pra qualquer um: gasto de modelo pago pela Guileo e o material de venda
    // (dores, objeções, cunha competitiva) servido de graça, inclusive pra concorrente.
    // O crachá é assinado no /api/seller-login e guardado com o perfil no navegador.
    const who = await verifySession(env, (b.sid || "").toString());
    if (!who) return json({ error: "auth_required", message: "Entre de novo no /vendedor pra usar as ferramentas de IA." }, 401);
    const mode = (b.mode || "pitch").toString();

    // ── CRIATIVO DE ANÚNCIO PARA O PROSPECT — o momento que fecha venda ──────────────────────
    // O vendedor está na frente do dono do negócio. Em vez de descrever o que a Guileo faria, ele
    // MOSTRA: o anúncio real, escrito para aquele negócio, naquela cidade, ali na hora. É a
    // diferença entre "a gente cuida do seu marketing" e ver o próprio negócio anunciado.
    //
    // SEM PREÇO. O prospect não tem cardápio cadastrado, então o gerador é proibido de citar
    // valor — anúncio de prospect com preço inventado é promessa que a Guileo não cumpre, e quem
    // leva a culpa na frente do cliente é o vendedor.
    if (mode === "criativo") {
      const contexto = {
        business: (b.business || "").toString().slice(0, 160).trim(),
        industry: (b.niche || b.industry || "").toString().slice(0, 80).trim(),
        lang: (b.lang || "pt").toString().slice(0, 2),
        notas: [(b.city ? `City: ${b.city}` : ""), (b.notes || "")].filter(Boolean).join("\n").slice(0, 800),
      };
      if (!contexto.business) return json({ ok: false, error: "diga o nome do negócio" }, 400);
      const r = await gerarCriativoAds(env, "", {
        plataforma: b.plataforma || "google", objetivo: b.objetivo, lang: contexto.lang, contexto,
      });
      if (!r) return json({ ok: false, error: "IA não configurada" }, 501);
      if (r.erro) return json({ ok: false, error: r.erro }, 503);
      return json({ ok: true, ...r });
    }

    // ── OBJECTION-BUSTER mode: seller types what the client said → calm, non-aggressive reframe ──
    if (mode === "objection") {
      const objection = (b.objection || "").toString().slice(0, 400).trim();
      const oNiche = (b.niche || "").toString().slice(0, 60).trim();
      const oLang = (b.lang || "pt").toString();
      if (!objection) return json({ error: "empty" }, 400);
      if (!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) return json({ ok: true, text: "(IA indisponível: configure ANTHROPIC_API_KEY.)" });
      const oLangName = oLang === "en" ? "US English" : oLang === "es" ? "LatAm Spanish" : oLang === "hi" ? "Hindi" : "Brazilian Portuguese";
      const OSYS = `You coach Guileo's sellers on handling a client objection. Guileo installs an AI team for local businesses (24/7 voice receptionist, WhatsApp/SMS/IG replies, ~60s speed-to-lead callback, booking + reminders, reactivation, close & collect; a human supervises; live ~7 days; 30-day money-back). NEVER aggressive, never defensive. Reframe to the OWNER'S gain and how it puts them ahead of competitors. No fake metrics or client names. Reply ONLY with these two short labeled lines in the requested language:\nRESPOSTA: <one calm, confident 1-2 sentence reply the seller can say out loud>\nVIRAR O JOGO: <one sentence that turns it into a next step — e.g. offering the live demo where Gui calls them>`;
      const a = await askClaude(env, { system: `${OSYS}\n\nWrite in ${oLangName} (keep the labels as given).`, max_tokens: 300, messages: [{ role: "user", content: `${oNiche ? `Business type: ${oNiche}. ` : ""}The client just said: "${objection}"` }] });
      return a.text ? json({ ok: true, text: a.text }) : json({ error: "ai_unavailable", ai_status: a.status, detail: a.detail }, 200);
    }

    // ── FEEDBACK mode: after a practice run, give the seller 2 quick coaching tips ──
    if (mode === "feedback") {
      const fLang = (b.lang || "pt").toString();
      const history = Array.isArray(b.history) ? b.history.slice(-16) : [];
      const sellerLines = history.filter((h) => h && h.role === "seller" && h.text).map((h) => String(h.text).slice(0, 400));
      if (!sellerLines.length) return json({ error: "empty" }, 400);
      if (!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) return json({ ok: true, text: "(Feedback indisponível: configure ANTHROPIC_API_KEY.)" });
      const fLangName = fLang === "en" ? "US English" : fLang === "es" ? "LatAm Spanish" : fLang === "hi" ? "Hindi" : "Brazilian Portuguese";
      const FSYS = `You are a warm, encouraging sales coach for Guileo sellers. You just watched a role-play where the seller pitched a local-business owner. Give SHORT, constructive, specific feedback — lead with what they did well, then what to sharpen. Anchor to Guileo's method: open with the owner's PAIN (missed calls, no-shows, slow follow-up), sell the GAIN not features, never be aggressive, and steer to the live demo (Gui calls the owner in ~60s). Reply ONLY with exactly two labeled lines in ${fLangName}:\nMANDOU BEM: <one specific thing they did well>\nPRA AFIAR: <one specific, actionable improvement>`;
      const transcript = history.filter((h) => h && h.role && h.text).map((h) => `${h.role === "seller" ? "SELLER" : "OWNER"}: ${String(h.text).slice(0, 300)}`).join("\n");
      const a = await askClaude(env, { system: FSYS, max_tokens: 240, messages: [{ role: "user", content: `Here is the role-play transcript:\n${transcript}` }] });
      return a.text ? json({ ok: true, text: a.text }) : json({ error: "ai_unavailable", ai_status: a.status, detail: a.detail }, 200);
    }

    // ── ROLEPLAY mode: the AI plays a busy, skeptical business owner so the seller can practice ──
    if (mode === "roleplay") {
      const rNiche = (b.niche || "").toString().slice(0, 60).trim();
      const rLang = (b.lang || "pt").toString();
      const msg = (b.message || "").toString().slice(0, 600).trim();
      const history = Array.isArray(b.history) ? b.history.slice(-10) : [];
      if (!msg) return json({ error: "empty" }, 400);
      if (!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) return json({ ok: true, reply: "(Treino indisponível: configure ANTHROPIC_API_KEY.)" });
      const rLangName = rLang === "en" ? "US English" : rLang === "es" ? "LatAm Spanish" : rLang === "hi" ? "Hindi" : "Brazilian Portuguese";
      const RSYS = `ROLE-PLAY. You are a busy, slightly skeptical owner of a ${rNiche || "local business"}. The user is a salesperson from Guileo (an AI receptionist/marketing service) practicing their pitch. Stay IN CHARACTER as the owner — react like a real, somewhat distracted owner: a bit guarded, raise realistic objections ("no time", "how much?", "I already have a receptionist", "does AI annoy customers?"), but you ARE winnable if they speak to your real problems (missed calls, no-shows, slow follow-up) and offer the live demo. Keep replies SHORT (1-3 sentences), natural and human. Never break character, never coach them, never mention you are an AI or a role-play. Reply ONLY as the owner, in ${rLangName}.`;
      const messages = [
        ...history.filter((h) => h && h.role && h.text).map((h) => ({ role: h.role === "client" ? "assistant" : "user", content: String(h.text).slice(0, 500) })),
        { role: "user", content: msg },
      ];
      const a = await askClaude(env, { system: RSYS, max_tokens: 200, messages });
      return a.text ? json({ ok: true, reply: a.text }) : json({ error: "ai_unavailable", ai_status: a.status, detail: a.detail }, 200);
    }

    const niche = (b.niche || "").toString().slice(0, 60).trim();
    const business = (b.business || "").toString().slice(0, 80).trim();
    const city = (b.city || "").toString().slice(0, 60).trim();
    const notes = (b.notes || "").toString().slice(0, 400).trim();
    const lang = (b.lang || "pt").toString();
    if (!niche && !business) return json({ error: "empty" }, 400);

    const langName = lang === "en" ? "US English" : lang === "es" ? "LatAm Spanish" : lang === "hi" ? "Hindi" : "Brazilian Portuguese";
    const ask = [
      business ? `Business: ${business}` : "",
      niche ? `Type of business: ${niche}` : "",
      city ? `City/area: ${city}` : "",
      notes ? `What the seller knows about them: ${notes}` : "",
    ].filter(Boolean).join("\n");

    if (!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) {
      return json({ ok: true, text: "ABERTURA: —\n(Personalização por IA indisponível: configure ANTHROPIC_API_KEY.)" });
    }
    const a = await askClaude(env, {
      system: `${guardSystemPrompt(SYS, { audience: "seller" })}\n\n${factsBlock({ audience: "seller" })}\n\nWrite in ${langName}. Keep the section LABELS exactly as given (they are Portuguese keys) but write the CONTENT in ${langName}.`,
      max_tokens: 520,
      messages: [{ role: "user", content: `Write the pitch for this prospect:\n${ask}` }],
    });
    if (!a.text) return json({ error: "ai_unavailable", ai_status: a.status, detail: a.detail }, 200);
    return json({ ok: true, text: a.text });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
