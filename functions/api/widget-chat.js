// Cloudflare Pages Function — POST /api/widget-chat  (+ OPTIONS preflight)
// Server side of the embeddable Gui webchat (public/gui-widget.js) that CLIENTS paste
// on THEIR OWN websites. Unlike gui-chat.js this is deliberately CORS-OPEN (it runs on
// other people's origins), so it is hardened instead:
//   1. per-IP rate limit (10 msgs/min) + per-session soft cap (40 msgs/day),
//   2. `client` must be a REAL provisioned tenant (get_client_profile / client_agent_lookup,
//      INGEST-gated server-side) — unknown emails get 404 so randoms can't burn tokens,
//   3. small max_tokens + capped reply length.
// Answers come from the same Claude Haiku brain gui-chat.js uses, but with the TENANT's
// system prompt (business_name + onboarding "brain" KB + pay link), mirroring the
// profile branch of twilio-inbound.js — Gui speaks FOR the client's business.
// Each conversation start (and any visitor-shared phone) is logged via ingest_client_event
// so the owner sees "Webchat lead" in the cockpit feed.
import { json, corsHeaders, rateLimited } from "../lib/guard.js";
import { webchatSentiment } from "../lib/cxEngine.js";
import { svcRpc } from "../lib/sb.js";
import { guardSystemPrompt } from "../lib/guiConstitution.js";
import { licoesPara } from "../lib/licoes.js";
import { guiReply } from "../lib/guiBrain.js";
import { debitarDepois, refChat, ehSonda } from "../lib/creditos.js";
import { contatoDoTexto } from "../lib/identidadeChat.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
// Same fallback stripe-webhook.js uses; set PEND_SECRET in Cloudflare env to rotate.
const PEND_FALLBACK = "gx_pend_7Qk2mZ9vR4tLpW8n_cit3l3s";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST",
  headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// CRM SPINE — a webchat visitor who shares a phone or email becomes a real contact in the
// tenant's CRM, exactly like a call/SMS does. Best-effort + graceful: no-op until db/crm_spine.sql
// is pasted (crm_upsert_contact is SCHED-gated, same as lead.js/agent-action.js). Never breaks chat.
async function crmUpsert(env, email, phone, contactEmail, name) {
  try {
    if (!env.SCHED_SECRET || (!phone && !contactEmail)) return;
    await svcRpc(env, "crm_upsert_contact", {
      p_secret: env.SCHED_SECRET, p_email: email, p_phone: phone || "",
      p_contact_email: contactEmail || "", p_name: name || "", p_source: "webchat", p_amount_cents: 0,
    });
  } catch { /* CRM not live yet → never break the reply */ }
}

// ── PEDIDO DE ORÇAMENTO (2026-08-17) ─────────────────────────────────────────────────────────────
// A lição v12 manda: «NENHUMA RECUSA É A ÚLTIMA FRASE… registre como pedido de orçamento». A agente
// obedecia e dizia "já anotei seu número" — mas "registre" não tinha onde. Testado em produção com
// a Lilian: pedi CoolSculpting, dei nome e telefone, e no banco sobrou UM TELEFONE. Sem nome, sem
// serviço, sem motivo. O dono não consegue "retornar personalizado" porque não sobrou o que
// personalizar: a venda mais cara do catálogo virou uma ligação fria.
//
// ⚠️ QUEM DECIDE SE É ORÇAMENTO É O BANCO, não este arquivo. A RPC recebe a mensagem CRUA e casa
// contra os serviços SEM preço do tenant. Se a regra morasse aqui, os outros canais (voz, WhatsApp,
// SMS) precisariam de cópias dela — e regra duplicada é regra que some numa das cópias.
// Ela também se recusa a registrar sem telefone: orçamento que não dá pra responder é número em
// painel. Best-effort: nunca quebra a resposta ao visitante.
async function pedidoDeOrcamento(env, email, phone, name, message, lang) {
  try {
    if (!env.SCHED_SECRET || !phone) return null;
    const r = await svcRpc(env, "biz_quote_capture", {
      p_secret: env.SCHED_SECRET, p_email: email, p_phone: phone, p_name: name || "",
      p_message: message || "", p_channel: "webchat", p_lang: lang || "en",
    });
    if (!r || !r.ok) return null;
    return await r.json().catch(() => null); // uuid do pedido, ou null quando não era orçamento
  } catch { return null; }
}

// BOOKING INTENT (growth intelligence) — when the chat shows booking language AND the visitor
// left a contact handle, record a booking_intent so an abandoned booking is recoverable by Gui.
// Calls the RPC directly (INGEST-gated server-side) — no hop through /api/booking-intent, whose
// sameOrigin gate would reject the foreign origins this widget legitimately runs on.
// Best-effort + graceful: no-op until db/growth_intel.sql is pasted. Never breaks the reply.
const BOOK_RX = /\b(book(ing)?|appointment|schedul\w*|reserv\w*|available|availability|agendar|agendamento|marcar|hor[aá]rio|reserva\w*|cita|turno|disponib\w*)\b|बुक|अपॉइंटमेंट/i;
async function bookingIntent(env, email, contact, name, service) {
  try {
    await rpc("booking_intent_start", {
      p_secret: env.INGEST_SECRET || "", p_client_email: email, p_contact: contact,
      p_name: name || null, p_service: service || null, p_source: "webchat",
    });
  } catch { /* growth intel not live yet → never break the reply */ }
}

// Fire-and-forget cockpit event (portal feed). Never blocks or breaks the reply.
async function ingest(env, email, type, summary, payload) {
  try {
    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: email, p_type: type, p_channel: "Webchat",
      p_summary: (summary || "").slice(0, 300), p_amount: 0, p_payload: payload || {},
    });
  } catch { /* additive only */ }
}

// Tenant gate + business context, KV-cached 5 min so chat turns don't hammer Supabase.
// valid = has a client profile OR a provisioned voice agent. Context = profile fields +
// the onboarding "brain" (gui_pending_onboarding keeps it after provisioning).
async function loadTenant(env, email) {
  const kv = env.RATE_LIMIT;
  const ck = `wc:tenant:${email}`;
  try { const c = kv && (await kv.get(ck)); if (c) return JSON.parse(c); } catch { /* cache miss */ }
  const t = { valid: false, business: "", industry: "", brain: "", phone: "", stripe_link: "", lang: "", agent_name: "", logo_url: "", accent: "" };
  // A negative result is only cacheable when the DB actually ANSWERED (200). A missing/wrong
  // secret (e.g. preview deployments have no secrets but SHARE this KV with prod) errors the
  // RPC — caching that as "invalid" poisons prod for 5 min. Authoritative = some RPC said 200.
  let authoritative = false;
  try {
    const r = await rpc("get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (r.ok) {
      authoritative = true;
      const p = await r.json();
      if (p && typeof p === "object" && (p.business_name || p.number || p.twilio_number || p.owner)) {
        t.valid = true;
        t.business = (p.business_name || "").toString().slice(0, 160);
        t.phone = (p.forward_number || p.number || p.twilio_number || "").toString().slice(0, 32);
        t.stripe_link = (p.stripe_link || "").toString().slice(0, 300);
        t.lang = (p.lang || "").toString().slice(0, 5);
        // white-label brand for the web widget — read straight off the profile OR its `extras` jsonb
        // (whichever the onboarding writes). All best-effort: absent fields just stay empty.
        const x = (p.extras && typeof p.extras === "object") ? p.extras : {};
        t.agent_name = (p.agent_name || x.agent_name || "").toString().slice(0, 40);
        t.logo_url = (p.logo_url || x.logo_url || "").toString().slice(0, 400);
        t.accent = (p.accent || x.accent || "").toString().slice(0, 9);
      }
    }
  } catch { /* fall through to agent lookup */ }
  if (!t.valid) {
    try {
      const ar = await rpc("client_agent_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
      if (ar.ok) { authoritative = true; if (((await ar.json()) || "").toString()) t.valid = true; }
    } catch { /* stays invalid */ }
  }
  if (t.valid) {
    try {
      const gr = await rpc("get_pending_onboarding", { p_secret: env.PEND_SECRET || PEND_FALLBACK, p_email: email });
      if (gr.ok) {
        const rows = await gr.json();
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (row && typeof row === "object") {
          t.brain = (row.brain || "").toString().slice(0, 4000);
          t.business = t.business || (row.business || "").toString().slice(0, 160);
          t.industry = (row.industry || "").toString().slice(0, 80);
          t.lang = t.lang || (row.lang || "").toString().slice(0, 5);
        }
      }
    } catch { /* brain is optional */ }
  }
  // cache invalid results too (stops tenant-enumeration re-queries) — but ONLY when the DB
  // actually answered; a failed lookup must never poison the shared KV with a false negative.
  try { if (kv && (t.valid || authoritative)) await kv.put(ck, JSON.stringify(t), { expirationTtl: 300 }); } catch { /* best-effort */ }
  return t;
}

// slug do site publicado → e-mail do dono. KV 5 min, como o loadTenant; só guarda quando achou.
async function donoDoSlug(env, bruto) {
  const slug = (bruto || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return "";
  const kv = env.RATE_LIMIT; const ck = `wc:slug:${slug}`;
  try { const c = kv && (await kv.get(ck)); if (c) return c; } catch { /* cache miss */ }
  try {
    const r = await svcRpc(env, "client_site_owner", { p_secret: env.INGEST_SECRET || "", p_slug: slug });
    if (!r.ok) return "";
    const dono = ((await r.json().catch(() => "")) || "").toString().trim().toLowerCase();
    if (!dono.includes("@")) return "";
    try { if (kv) await kv.put(ck, dono, { expirationTtl: 300 }); } catch { /* best-effort */ }
    return dono;
  } catch { return ""; }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // HARD per-IP brake — this endpoint is intentionally reachable from any origin.
    if (await rateLimited(request, env, "widget-chat", 10)) return json({ error: "too many requests" }, 429);

    const b = await request.json().catch(() => ({}));
    let client = (b.client || "").toString().trim().toLowerCase().slice(0, 120);
    // `slug` EM VEZ DE E-MAIL (2026-09-30): o chat do site do cliente (TenantChat) manda o slug do
    // site PUBLICADO e o servidor acha o dono (client_site_owner, service-role). Assim o e-mail do
    // dono não precisa ficar escrito no JavaScript da página. Slug desconhecido ou site não
    // publicado → `client` continua vazio e cai no 400 de sempre.
    if (!client.includes("@")) client = await donoDoSlug(env, (b.slug || "").toString());
    const sessionId = (b.sessionId || "").toString().slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, "");
    const msg = (b.message || "").toString().slice(0, 600).trim();
    const lang = ["en", "pt", "es", "hi"].includes(b.lang) ? b.lang : "en";
    const history = Array.isArray(b.history) ? b.history.slice(-6) : [];
    if (!client.includes("@") || !sessionId || !msg) return json({ error: "client + sessionId + message required" }, 400);

    // per-session soft cap: one visitor conversation can't loop the LLM all day
    try {
      const kv = env.RATE_LIMIT;
      if (kv) {
        const k = `wc:sess:${sessionId}`;
        const n = parseInt((await kv.get(k)) || "0", 10) + 1;
        if (n > 40) return json({ error: "session limit reached" }, 429);
        await kv.put(k, String(n), { expirationTtl: 86400 });
      }
    } catch { /* fail-open like rateLimited */ }

    // TENANT GATE — unknown emails don't get a single LLM token
    const t = await loadTenant(env, client);
    if (!t.valid) return json({ error: "unknown client" }, 404);

    // White-label brand for the widget — only the keys we actually have (widget falls back otherwise).
    const brand = {};
    if (t.agent_name) brand.name = t.agent_name;
    if (t.logo_url) brand.logo = t.logo_url;
    if (t.accent) brand.accent = t.accent;

    // cockpit feed: conversation start → "Webchat lead"; shared phone → lead event
    const isStart = b.start === true || history.length === 0;
    if (isStart) await ingest(env, client, "message", `💬 Webchat lead on ${t.business || "your site"}: ${msg}`, { session: sessionId, lang });
    const phoneMatch = msg.match(/\+?\d[\d\s().-]{7,}\d/);
    if (phoneMatch) await ingest(env, client, "lead", `💬 Webchat visitor shared a phone (${phoneMatch[0].trim()}): ${msg}`, { phone: phoneMatch[0].trim(), session: sessionId });

    // XM SIGNAL — a webchat message with CLEAR sentiment is a real CX reading (the customer-of-the-
    // customer, in their own words). High-precision heuristic → zero LLM cost, skips anything
    // ambiguous. Idempotent per session (ref='webchat:<sess>') so one conversation = one reading.
    // Best-effort: never blocks the reply, graceful until db/experience.sql is installed.
    const cxs = webchatSentiment(msg);
    if (cxs && env.INGEST_SECRET) {
      try {
        await rpc("cx_signal_upsert", {
          p_secret: env.INGEST_SECRET, p_email: client, p_contact_id: null, p_source: "webchat",
          p_score: cxs.score, p_raw_score: cxs.sentiment, p_sentiment: cxs.sentiment,
          p_theme: null, p_comment: msg.slice(0, 500), p_ref: `webchat:${sessionId}`,
          p_occurred_at: new Date().toISOString(),
        });
      } catch { /* CX signal is a bonus — never break the chat */ }
    }
    // Any identifiable signal (phone or email the visitor typed, plus an optional name the widget
    // passes) → resolve-or-create the CRM contact so the web-chat lead lands in the CRM like a call.
    const emailMatch = msg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (phoneMatch || emailMatch) {
      const visitorName = (b.name || "").toString().trim().slice(0, 80);
      await crmUpsert(env, client, phoneMatch ? phoneMatch[0].trim() : "", emailMatch ? emailMatch[0].trim() : "", visitorName);
      // ⚠️ A CONVERSA INTEIRA, NÃO SÓ A ÚLTIMA FRASE. Quem pergunta o preço numa mensagem costuma
      // dar o telefone na SEGUINTE ("quanto é o CoolSculpting?" → "meu nome é Carla, 646…"). Casar
      // só a mensagem atual perderia exatamente o caso que motivou isto: o serviço fica na 1ª e o
      // contato na 2ª. Mandamos o texto do bolso todo e o banco decide.
      const textoDaConversa = [msg, ...history.map((h) => (h && (h.text || h.content) ? String(h.text || h.content) : ""))]
        .join(" \n ").slice(0, 1500);
      await pedidoDeOrcamento(env, client, phoneMatch ? phoneMatch[0].trim() : "", visitorName, textoDaConversa, lang);
      // Booking language anywhere in this exchange (current msg or recent turns) + a contact
      // handle = a hot lead worth an abandoned-booking follow-up. Idempotent per contact
      // (booking_intent_start reopens the live intent instead of duplicating).
      const convoText = [msg, ...history.map((h) => (h && h.text ? String(h.text) : ""))].join(" \n ").slice(0, 4000);
      if (BOOK_RX.test(convoText)) {
        await bookingIntent(env, client, (phoneMatch ? phoneMatch[0].trim() : emailMatch[0].trim()).slice(0, 160), visitorName, "");
      }
    }

    const langName = lang === "pt" ? "Brazilian Portuguese" : lang === "es" ? "LatAm Spanish" : lang === "hi" ? "Hindi" : "English";
    // Sem NENHUM cérebro (nem a voz do cliente, nem a reserva) → frase honesta. Só a Anthropic faltando não é motivo:
    // o principal é o agente da ElevenLabs (2026-10-05: Anthropic desligada por decisão do Luis).
    if (!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) {
      const off = lang === "pt" ? `Recebi sua mensagem! A equipe ${t.business ? `de ${t.business} ` : ""}te responde em instantes.${t.phone ? ` Se preferir, ligue: ${t.phone}` : ""} 🌱`
        : lang === "es" ? `¡Recibí tu mensaje! El equipo ${t.business ? `de ${t.business} ` : ""}te responde enseguida.${t.phone ? ` Si prefieres, llama: ${t.phone}` : ""} 🌱`
          : `Got your message! ${t.business ? `The ${t.business} team` : "The team"} will reply shortly.${t.phone ? ` Prefer to call? ${t.phone}` : ""} 🌱`;
      return json({ ok: true, answer: off, phone: t.phone, biz: t.business, ...brand });
    }

    // Same tenant-voice rules as twilio-inbound.js's profile branch, adapted to web chat.
    let sys = `You are Gui, the AI web chat assistant on the website of ${t.business || "this business"}${t.industry ? ` (a ${t.industry} business)` : ""}. Reply in ${langName} unless the visitor clearly writes in another language — then mirror them. Keep it SHORT (2-4 sentences, this is a chat widget), warm and helpful: answer questions, help the visitor book or get what they need, and capture their request clearly. When the visitor wants to book, order or get a quote, ask for their name and phone number so the team can confirm. PRICES: the SERVICES & PRICES list below (when present) holds the business's CONFIRMED current prices — quote those numbers DIRECTLY and confidently, copying the figure from the list character by character (if the list says "— $X" for a service, say exactly $X). ⚠️ A SERVICE SHOWN WITHOUT A PRICE HAS NO PRICE AT ALL: never borrow the number from another line, never estimate from a similar service, never round from duration — say a specialist confirms the exact price, and capture the booking anyway. Only defer to the team for a service that is NOT in that list, or one shown without a price. Never invent a number that isn't in the list. Reply ONLY with the plain message text — no JSON, no markdown headers.`;
    if (t.brain) sys += `\n\nBUSINESS KNOWLEDGE (answer precisely from this — never invent beyond it):\n${t.brain}`;
    // REAL MENU + PRICES — pull the tenant's structured services straight from the scheduling engine
    // (biz_services) so the chat quotes EXACT prices/durations instead of deferring to the team.
    // SCHED-gated literal; best-effort — no menu just means we fall back to "team confirms".
    try {
      const mr = await rpc("biz_lookup", { p_secret: env.SCHED_SECRET || "", p_email: client });
      if (mr.ok) {
        const menu = await mr.json().catch(() => null);
        const svcs = (menu && Array.isArray(menu.services)) ? menu.services : [];
        const lines = svcs.filter((s) => s && s.name).map((s) => {
          // ⚠️ SERVIÇO SEM PREÇO PRECISA GRITAR (2026-08-17). Antes, a linha simplesmente NÃO TINHA
          //    o sufixo de preço — visualmente idêntica às outras numa lista de 23 itens. Numa conversa
          //    real com o cardápio do Natura, a Gui cotou $118 para 'Laser Hair Removal' (preço nulo):
          //    $118 é o preço da Massage e do Facial, duas linhas acima. Ausência é fácil de não ver;
          //    proibição escrita, não. Preço dito no telefone/chat é promessa que o dono paga no caixa.
          const price = (s.price_cents != null) ? ` — $${(s.price_cents / 100).toFixed(0)}` : ` — ⚠️ NO PRICE ON FILE (never state a number for this one)`;
          const dur = s.duration_min ? ` (${s.duration_min} min)` : "";
          return `• ${s.name}${dur}${price}`;
        });
        const locs = (menu && Array.isArray(menu.locations)) ? menu.locations.filter((l) => l && l.name).map((l) => `• ${l.name}${l.address ? ` — ${l.address}` : ""}`) : [];
        if (lines.length) sys += `\n\nSERVICES & PRICES (quote these EXACTLY; a service with no price → say a specialist confirms the exact price and still capture the booking):\n${lines.join("\n")}`;
        if (locs.length) sys += `\n\nLOCATIONS:\n${locs.join("\n")}`;
      }
    } catch { /* menu is best-effort */ }
    // TENANT KNOWLEDGE BASE — the owner's curated business Q&A (db/tenant_kb.sql, kb_for_agent is
    // INGEST-gated). Best-effort + capped ~1200 chars; no KB (or SQL not pasted) just means we skip
    // it and fall back to the brain/menu above. Lets the widget answer the business's SPECIFIC
    // questions (walk-ins, parking, cancellation policy) instead of deferring to the team.
    try {
      const kr = await rpc("kb_for_agent", { p_secret: env.INGEST_SECRET || "", p_email: client });
      if (kr.ok) {
        const kb = ((await kr.json().catch(() => "")) || "").toString().trim();
        if (kb) sys += `\n\nBUSINESS Q&A (the owner's own answers — use these VERBATIM when a visitor asks; never contradict them):\n${kb.slice(0, 1200)}`;
      }
    } catch { /* KB is best-effort — never break the reply */ }

    // ── AS LIÇÕES, QUE TAMBÉM FALTAVAM AQUI (2026-08-17) ──────────────────────────────────
    // Em 11/08 este widget foi descoberto como o ÚNICO agente sem a CONSTITUIÇÃO (o comentário
    // logo abaixo conta). Hoje, caçando por que o caso `voice-price-unknown-service` reprovava
    // no eval desde 06/08, apareceu o irmão gêmeo daquele achado: ele também era um dos dois
    // agentes sem as LIÇÕES. `licoesPara()` só chegava ao prompt de VOZ (provision.js).
    //
    // A COINCIDÊNCIA NÃO É COINCIDÊNCIA: as duas vezes o defeito nasceu do mesmo lugar — este
    // arquivo monta o system prompt SOZINHO, à mão, em vez de partir de uma base comum. Todo
    // reforço central (constituição, lições, o que vier depois) precisa ser lembrado aqui de
    // novo, e "lembrar de novo" é exatamente o que falha. Enquanto os três cérebros montarem
    // prompt cada um do seu jeito, este arquivo vai ser o último a receber tudo.
    //
    // Por que importa em dinheiro: o visitante que pergunta preço de algo fora do cardápio é
    // cliente pronto. Sem a lição "NENHUMA RECUSA É A ÚLTIMA FRASE", o widget respondia com
    // honestidade e deixava a pessoa ir embora sem nome e sem telefone.
    sys += `\n\n${licoesPara(t.industry)}`;

    if (t.stripe_link) sys += `\n\nWhen the visitor wants to pay or asks for the payment link, share exactly this link: ${t.stripe_link}`;
    if (t.phone) sys += `\n\nThe business phone number, if the visitor asks or prefers to call: ${t.phone}`;

    const messages = [
      ...history.filter((h) => h && h.role && h.text).map((h) => ({ role: h.role === "gui" ? "assistant" : "user", content: String(h.text).slice(0, 600) })),
      { role: "user", content: msg },
    ];
    // ── O WIDGET PASSA A USAR O CÉREBRO UNIFICADO (2026-09-09) ─────────────────────────────────
    // Este arquivo tinha o PRÓPRIO loop de Anthropic — e por isso ficou de fora do socorro da
    // ElevenLabs que o `guiReply` ganhou em 25/08. Resultado: quando a Anthropic zerou de novo em
    // setembro, o SMS/WhatsApp (que passa pelo guiReply) seguiu atendendo, e o chat do site do
    // Natura — a superfície mais visível do cliente pagante — respondeu "não consegui responder
    // agora" por cinco dias. O canário gritou todo dia; a causa era o widget ter um cérebro
    // paralelo que ninguém lembrava que existia.
    //
    // Agora ele chama o `guiReply`: a MESMA Gui da voz responde primeiro (decisão do Luis), a
    // Anthropic é a reserva, e a constituição é aplicada uma vez só, no lugar único. A regra de
    // 11/08 ("um agente quase coberto não está coberto") vale ao contrário também: um cérebro
    // paralelo é um cérebro que fica para trás em toda melhoria.
    //
    // O que este arquivo ainda faz sozinho: sessão/limite, captura de lead, marca do widget e a
    // frase honesta de fallback. O `sys` montado acima fica por enquanto (é usado pela captura
    // de lead mais abaixo); a redundância de RPC é conhecida e barata — limpar depois de medir.
    let answer = "";
    let cerebroDe = "";
    let reconhecido = false;
    // RECONHECER PELO NOME TEM TETO POR IP (2026-09-30). O reconhecimento usa o telefone/e-mail que
    // o visitante ESCREVEU — e o `history` vem do navegador, então dá para forjar. Sem teto, o chat
    // viraria um oráculo "digite um telefone, descubra o primeiro nome de quem é cliente". 40
    // consultas por IP por dia cobrem qualquer conversa de verdade (o limite da sessão também é
    // 40); acima disso a pessoa continua sendo atendida, só que como nova.
    const ident = contatoDoTexto(msg, history);
    const reconhecer = !(ident.phone || ident.email) || !(await rateLimited(request, env, "widget-chat-quem", 40, 86400));
    try {
      const rr = await guiReply(env, {
        reconhecer,
        email: client, channel: "webchat", from: sessionId, text: msg,
        history: history.filter((h) => h && h.role && h.text).map((h) => ({ role: h.role === "gui" ? "gui" : "user", text: String(h.text).slice(0, 600) })),
        lang, origin: new URL(request.url).origin,
      });
      // `escalate:true` com `ready:true` = os dois cérebros falharam (ou a constituição barrou):
      // o guiReply devolve a frase de handoff dele. Aqui preferimos a NOSSA frase honesta abaixo,
      // que aponta o telefone — então tratamos como "sem resposta" e deixamos `cerebro:false`.
      if (rr && rr.ready && !rr.escalate && rr.reply) { answer = String(rr.reply).trim(); cerebroDe = rr.cerebro || "anthropic"; reconhecido = !!rr.reconhecido; }
    } catch { /* o fallback honesto abaixo cobre */ }
    // 🚨 O MODO DEGRADADO DIZIA A FRASE PROIBIDA (achado 24/08). O texto era, literalmente,
    // "Anotado! A equipe te confirma em instantes." / "The team will confirm shortly." — a frase
    // que a lição v14 proíbe POR NOME em todos os agentes, porque soa resolvida e não entrega
    // nada. A regra valia para o que o modelo escreve e não para o que NÓS escrevemos quando ele
    // cai: quem ouve não sabe a diferença. Agora o fallback diz a VERDADE (não consegui responder
    // agora) e dá um caminho que funciona sem cérebro nenhum — o telefone.
    const cerebro = !!answer;
    if (!answer) {
      const tel = t.phone ? (lang === "pt" ? ` Ligue agora: ${t.phone}` : lang === "es" ? ` Llame ahora: ${t.phone}` : ` Call now: ${t.phone}`) : "";
      answer = lang === "pt" ? `Não consegui responder isso agora.${tel || " Deixe seu telefone que retornamos."}`
        : lang === "es" ? `No pude responder eso ahora.${tel || " Deje su teléfono y le devolvemos."}`
          : `I couldn't answer that right now.${tel || " Leave your number and we'll call you back."}`;
    }
    // ── MEDIDOR DE CRÉDITO (2026-09-27) ───────────────────────────────────────────────────────
    // Só quando o CÉREBRO respondeu (`cerebro:true`): a frase de emergência acima é falha NOSSA,
    // e cliente não paga pela nossa falha. A sonda do canário fala com um tenant real a cada
    // 15 min — também não paga. A referência é sessão+dia: a conversa inteira custa UM "chat",
    // não um por mensagem. Roda depois da resposta (waitUntil) e nunca lança.
    // Nasce inerte (CREDITOS_CANAIS≠1) — o porquê está no topo de functions/lib/creditos.js.
    if (cerebro && !ehSonda(sessionId)) {
      await debitarDepois(context, env, { email: client, kind: "chat", ref: refChat(client, sessionId) });
    }
    return json({ ok: true, answer: answer.slice(0, 1200), cerebro, cerebro_de: cerebroDe || null, reconhecido, phone: t.phone, biz: t.business, ...brand });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
