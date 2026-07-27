// functions/lib/provision.js — the SHARED Gui-provisioning core.
// One hardened place that turns a client's brain into a live, dedicated ElevenLabs voice agent,
// so BOTH paths use identical logic:
//   • /api/onboard-client  (admin, manual, also buys/binds a number)
//   • /api/stripe-webhook  (self-serve: on payment, the Gui is born automatically)
//
// IDEMPOTENT: if the client already has an agent we UPDATE it in place (never duplicate / double-bill),
// re-applying the current voice + prompt so an existing agent picks up the latest voice on any sync.
// Never throws — returns { ok, agent_id, step } so callers can surface the exact outcome.
import { emitFailure } from "./failure.js";
import { guardSystemPrompt } from "./guiConstitution.js";
import { upsellSection } from "../../src/data/upsellPlaybook.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// SPOKEN LANGUAGES — every language the voice AGENT detects and answers in on a call (ElevenLabs
// multilingual TTS handles all of these natively). This is DISTINCT from the 4 portal/UI languages
// (EN·PT·ES·HI): the owner reads their dashboard in 4 languages, but their Gui ANSWERS THE PHONE in
// all of these. One source of truth — UIs (OnboardWizard "Idiomas", marketing) render from this list.
// Spoken languages the agent detects & answers in (ElevenLabs multilingual TTS covers all of these).
// Ordered by US-immigrant-market relevance. The OWNER'S portal UI stays 4 langs (en/pt/es/hi);
// the AGENT speaks any of these on a call — the "sua recepcionista atende em qualquer idioma" weapon.
export const LANGS_SPOKEN = [
  { code: "en",  label: "English",          native: "English" },
  { code: "es",  label: "Spanish",          native: "Español" },
  { code: "pt",  label: "Portuguese",       native: "Português" },
  { code: "hi",  label: "Hindi",            native: "हिन्दी" },
  { code: "zh",  label: "Mandarin Chinese", native: "中文（普通话）" },
  { code: "yue", label: "Cantonese",        native: "粵語" },
  { code: "ru",  label: "Russian",          native: "Русский" },
  { code: "ko",  label: "Korean",           native: "한국어" },
  { code: "ht",  label: "Haitian Creole",   native: "Kreyòl Ayisyen" },
  { code: "fr",  label: "French",           native: "Français" },
  { code: "ar",  label: "Arabic",           native: "العربية" },
  { code: "vi",  label: "Vietnamese",       native: "Tiếng Việt" },
  { code: "tl",  label: "Tagalog",          native: "Tagalog" },
  { code: "bn",  label: "Bengali",          native: "বাংলা" },
  { code: "pa",  label: "Punjabi",          native: "ਪੰਜਾਬੀ" },
  { code: "de",  label: "German",           native: "Deutsch" },
  { code: "it",  label: "Italian",          native: "Italiano" },
  { code: "pl",  label: "Polish",           native: "Polski" },
  { code: "ja",  label: "Japanese",         native: "日本語" },
  { code: "uk",  label: "Ukrainian",        native: "Українська" },
];

// Build the SALES-FIRST Four Seasons concierge prompt + localized first message from the client's brain.
// agentName lets a client white-label the voice (e.g. "Sofia"); empty → defaults to the Guileo brand "Gui".
export function buildGuiPrompt({ business, industry, lang, brain, agentName, prices }) {
  const biz = (business || "your business").toString();
  const ind = (industry || "").toString();
  const name = (agentName || "").toString().trim().slice(0, 40) || "Gui";
  const knowledge = (brain || "").toString().slice(0, 4000);
  const priceList = (prices || "").toString().slice(0, 2000);
  const prompt = [
    `You are ${name} — a Four Seasons-caliber concierge AND the best salesperson for ${biz}${ind ? ` (a ${ind} business)` : ""}. Gracious, calm and warm; never say "I can't" — say "leave it with me". Always reply in the SAME language the caller speaks — you are fluent in EVERY major language (English, Spanish, Portuguese, Hindi, Mandarin, Cantonese, Russian, Korean, Haitian Creole, French, Arabic, Vietnamese, Tagalog, Bengali, Punjabi, German, Italian, Polish, Japanese, Ukrainian and more). Detect the caller's language from their FIRST words and answer in it natively; if they switch languages mid-call, switch with them instantly and never comment on it.`,
    knowledge ? `BUSINESS KNOWLEDGE (never invent beyond this):\n${knowledge}` : "",
    priceList ? `PRICES (quote EXACTLY from this — never guess a price; if something isn't listed, say you'll confirm and capture it as a quote request):\n${priceList}` : "",
    `EVERY CALL: greet warmly, get the caller's name; find what they need; present the right service with one clear benefit; then CLOSE — book the appointment, send the quote, or take the order. Always capture name + BOTH phone and email, and confirm clearly.`,
    `CLOSE & COLLECT (this is your job — don't just inform, COLLECT money):
• When the caller agrees to an order/service, STATE THE EXACT TOTAL out loud (sum items from PRICES), then ask "want me to text you a secure link to pay now?". On yes, call do_action with action='invoice', amount=<total in dollars>, name, contact=<their phone>, business — this texts them a secure Stripe link. Then say you've texted it.
• For APPOINTMENTS that need a deposit to hold the slot (clinics, salons, services, big reservations): after booking, offer "I can hold your spot with a small deposit — want me to text the link?" and call do_action action='deposit', amount=<deposit>, contact=<phone>.
• Offer ONE smart add-on before charging (e.g. a drink, an upgrade) to grow the ticket — only if natural.
• Never read a long URL aloud — the link goes by text. Never take card numbers by voice unless explicitly told the secure pay flow is on.`,
    // MULTILINGUAL NUMBERS — TTS reads digits literally unless told to verbalize; a price read as
    // "four five point five zero" in Mandarin or Russian kills the close. Keep the languages in sync
    // with LANGS_SPOKEN above.
    `LANGUAGES & NUMBERS: whatever language the caller speaks, say prices, dates and times the way a NATIVE speaker would — spell numbers out in words in THAT language, never as raw digits or symbols. E.g. $45.50 → "forty-five dollars and fifty cents" (EN) / "cuarenta y cinco dólares con cincuenta" (ES) / "quarenta e cinco dólares e cinquenta" (PT) / "四十五美元五十美分" (ZH) / "сорок пять долларов пятьдесят центов" (RU) / "사십오 달러 오십 센트" (KO) / "karant senk dola senkant santim" (HT); 7:30 PM → "seven thirty in the evening" / "las siete y media de la tarde" / "sete e meia da noite" / "晚上七点半". Same rule for phone numbers: read them digit by digit, in the caller's language.`,
    // SMART UPSELL — per-vertical natural add-on lines (≤600 chars, see src/data/upsellPlaybook.js)
    upsellSection(ind, lang),
    // CALLER MEMORY — {{caller_name}}/{{caller_last}}/{{caller_note}} arrive as dynamic variables
    // (injected on auto-callbacks + the inbound personalization webhook). Empty ⇒ treat as new.
    // SPECIAL DATES (db/special_dates.sql) — the booking tool refuses closed/reduced days.
    `If the requested date is closed or has special hours, the booking tool will tell you — relay it warmly and offer the nearest open alternative instead.`,
    `CALLER MEMORY: if {{caller_name}} is set, this is a returning customer — greet them by name and reference their last visit ({{caller_last}}{{caller_note}}) warmly, like a favorite regular ("the usual?"). If it's empty, treat them as a new customer and never pretend to remember them.`,
  ].filter(Boolean).join("\n\n");
  // Safety floor: the voice Gui speaks AS the business (strictest surface). One constitution, shared
  // with every other agent — change a rule in guiConstitution.js and this voice prompt changes too.
  const guardedPrompt = guardSystemPrompt(prompt, { audience: "public", asBusiness: true, business: biz, hasPriceList: !!priceList });
  const firstMessage = lang === "pt" ? `Obrigado por ligar pra ${biz}! Aqui é ${name} — como posso ajudar?`
    : lang === "es" ? `¡Gracias por llamar a ${biz}! Le atiende ${name} — ¿cómo puedo ayudar?`
      : `Thanks for calling ${biz}! This is ${name} — how can I help?`;
  return { prompt: guardedPrompt, firstMessage, name };
}

// PRICE BLOCK — turn the tenant's services (biz_lookup shape: [{ name, price_cents }]) into the
// "Service — $X" list the Gui quotes from on a call, so she closes with REAL numbers instead of "in
// the dark". A service with no set price (null/0) renders as "on request" (localized) so she never
// invents a number. Returns "" for an empty menu → buildGuiPrompt then simply omits the PRICES block.
export function formatPrices(services, lang = "en") {
  const list = Array.isArray(services) ? services : [];
  const onReq = lang === "pt" ? "sob consulta" : lang === "es" ? "a consultar" : "price on request";
  return list.map((s) => {
    const name = (s && s.name ? s.name : "").toString().trim();
    if (!name) return "";
    const cents = Number(s && s.price_cents);
    const money = Number.isFinite(cents) && cents > 0
      ? "$" + (Number.isInteger(cents / 100) ? cents / 100 : (cents / 100).toFixed(2))
      : onReq;
    return `${name} — ${money}`;
  }).filter(Boolean).join("\n");
}

// Best-effort read of the tenant's LIVE menu (biz_lookup, SCHED_SECRET) → formatted PRICE BLOCK. Used
// so BOTH provisioning and a portal brain-sync inject the current prices without the caller passing
// them. Any miss (no secret / RPC absent / empty) → "" so the prompt degrades, never throws.
export async function fetchTenantPrices(env, email, lang = "en") {
  const e = (email || "").toString().trim().toLowerCase();
  if (!env || !env.SCHED_SECRET || !e.includes("@")) return "";
  try {
    const r = await rpc("biz_lookup", { p_secret: env.SCHED_SECRET, p_email: e });
    if (!r.ok) return "";
    const menu = (await r.json()) || {};
    return formatPrices(menu.services || [], lang);
  } catch { return ""; }
}

// DAY-1 SCHEDULING SEED — a fresh client has no services/hours, so biz_lookup returns empty and the
// agent can't actually book ("we don't offer any services"). This builds a sensible default per sector
// (services + one resource + weekly hours) so booking works on the very first call. The client refines
// it later in the portal. Service names are localized; weekday 0=Sun … 6=Sat. minutes from midnight.
export function buildDefaultSchedulePayload({ industry = "", lang = "en", tz = "America/New_York" } = {}) {
  const ind = (industry || "").toString().toLowerCase();
  const L = ["pt", "es", "en"].includes(lang) ? lang : "en";
  const T = (pt, es, en) => (L === "pt" ? pt : L === "es" ? es : en);
  const loc = { name: "Main", city: "", address: "", phone: "", tz };
  // weekly hour blocks helper
  const days = (list, start, end) => list.map((w) => ({ location: "Main", weekday: w, start_min: start, end_min: end }));
  const WEEK = [0, 1, 2, 3, 4, 5, 6], MONFRI = [1, 2, 3, 4, 5], TUESAT = [2, 3, 4, 5, 6];

  const is = (...k) => k.some((x) => ind.includes(x));
  let services, pros;
  if (is("restau", "food", "pizza", "cafe", "bar", "bistro", "comida")) {
    services = [{ name: T("Reserva", "Reserva", "Reservation"), duration_min: 90, price_cents: 0, capacity: 6, buffer_after_min: 15, config: { party_size: true } }];
    pros = [{ name: T("Recepção", "Recepción", "Host"), title: T("Maître", "Maître", "Maître d'"), kind: "staff", services: [services[0].name], locations: ["Main"],
      schedule: [...days([2, 3, 4, 0], 690, 840), ...days([5, 6], 690, 870), ...days([2, 3, 4], 1080, 1350), ...days([5, 6], 1050, 1410), ...days([0], 1020, 1320)] }];
  } else if (is("clinic", "clínic", "dent", "health", "saúde", "salud", "medic", "doctor", "odont")) {
    services = [
      { name: T("Consulta", "Consulta", "Consultation"), duration_min: 30, price_cents: 5000, capacity: 1, buffer_after_min: 10 },
      { name: T("Limpeza", "Limpieza", "Cleaning"), duration_min: 45, price_cents: 3000, capacity: 1, buffer_after_min: 10 },
    ];
    pros = [{ name: T("Equipe", "Equipo", "Team"), title: T("Profissional", "Profesional", "Provider"), kind: "staff", services: services.map((s) => s.name), locations: ["Main"],
      schedule: [...days(MONFRI, 540, 750), ...days(MONFRI, 840, 1080)] }];
  } else if (is("salon", "salão", "spa", "hair", "beauty", "barb", "nail", "estét")) {
    services = [
      { name: T("Corte", "Corte", "Haircut"), duration_min: 30, price_cents: 4000, capacity: 1, buffer_after_min: 10 },
      { name: T("Coloração", "Color", "Color"), duration_min: 90, price_cents: 12000, capacity: 1, buffer_after_min: 15 },
      { name: T("Manicure", "Manicura", "Manicure"), duration_min: 45, price_cents: 3500, capacity: 1 },
    ];
    pros = [{ name: T("Equipe", "Equipo", "Team"), title: T("Especialista", "Especialista", "Specialist"), kind: "staff", services: services.map((s) => s.name), locations: ["Main"],
      schedule: days(TUESAT, 600, 1140) }];
  } else {
    services = [{ name: T("Atendimento", "Cita", "Appointment"), duration_min: 30, price_cents: 0, capacity: 1 }];
    pros = [{ name: T("Equipe", "Equipo", "Team"), title: T("Atendente", "Agente", "Staff"), kind: "staff", services: [services[0].name], locations: ["Main"],
      schedule: days(MONFRI, 540, 1020) }];
  }
  return { replace: false, locations: [loc], services, professionals: pros };
}

// The scheduling/booking webhook tool the agent calls DURING a call to actually check availability and
// RECORD a booking (which also emails the caller a confirmation). Without this the agent only TALKS about
// booking but never acts. Scoped to this client's business via client_email. Needs AGENT_ACTION_SECRET.
function schedulingTool(env, email) {
  if (!env.AGENT_ACTION_SECRET) return null;
  return {
    type: "webhook",
    name: "schedule",
    description: "Check the business's services WITH PRICES & real availability and BOOK an appointment/reservation. Call op='lookup' to list services (each with its price), op='price' for the exact price of a service (or the whole price list) — ALWAYS consult a real price before quoting one, never guess — op='availability' for open slots, op='book' to record the booking (this also sends the customer their confirmation). NEVER tell a caller something is booked without calling op='book' first.",
    response_timeout_secs: 35,
    api_schema: {
      url: "https://guileoai.com/api/agent-schedule",
      method: "POST",
      // SECURITY (multi-tenant): the tenant is pinned server-side via a STATIC per-agent header — the LLM
      // never supplies client_email, so a caller can't book/read another business's schedule.
      request_headers: { "x-guileo-secret": env.AGENT_ACTION_SECRET, "x-guileo-client": email },
      request_body_schema: {
        type: "object",
        properties: {
          op: { type: "string", description: "One of: lookup | price | availability | book" },
          service: { type: "string", description: "The service / table / reservation type requested" },
          name: { type: "string", description: "The caller's full name" },
          contact: { type: "string", description: "The caller's email or phone — REQUIRED so the confirmation can be sent" },
          when: { type: "string", description: "Requested date & time in plain language, e.g. 'amanhã às 20h'" },
          // Multi-location: the server already resolves location names on lookup/availability/book;
          // declaring it here is what lets the LLM actually SEND it when the business has branches.
          location: { type: "string", description: "Which location/branch the caller wants (by name), when the business has more than one — op='lookup' lists them" },
        },
        required: ["op"],
      },
      content_type: "application/json",
    },
  };
}

// The business-ACTION webhook tool — everything that ISN'T a calendar booking: take an order, capture a
// lead, log a quote, create a payment link, schedule a callback. Without it the agent only TALKS about
// these. Scoped to this client via client_email. Needs AGENT_ACTION_SECRET.
function actionTool(env, email) {
  if (!env.AGENT_ACTION_SECRET) return null;
  return {
    type: "webhook",
    name: "do_action",
    description: "Record a business action that is NOT a calendar booking: take an order, capture a sales lead, log a quote request, create a payment/invoice link, schedule a callback, or ESCALATE to a human (action='escalate') when the caller asks for a person, is upset, or you can't help. Call this so the team actually receives it — NEVER promise an order/quote/callback/payment/human without calling this first. For a genuine EMERGENCY (no AC, flood, leak, burst pipe, no power, gas, roof, caller says emergency/urgente) use action='escalate' with urgent=true — it rings the owner's phone immediately.",
    response_timeout_secs: 35,
    api_schema: {
      url: "https://guileoai.com/api/agent-action",
      method: "POST",
      // SECURITY (multi-tenant): tenant pinned server-side via static per-agent header; LLM never supplies it.
      request_headers: { "x-guileo-secret": env.AGENT_ACTION_SECRET, "x-guileo-client": email },
      request_body_schema: {
        type: "object",
        properties: {
          action: { type: "string", description: "One of: order | lead | quote | sale | invoice | callback | review | escalate (escalate = caller wants a human / is upset / out of scope)" },
          urgent: { type: "boolean", description: "true ONLY for a genuine emergency (no AC, flood, leak, burst pipe, no power, gas smell, roof damage, caller says emergency/urgente) — this makes the OWNER'S PHONE RING immediately" },
          name: { type: "string", description: "The caller's name" },
          contact: { type: "string", description: "The caller's email or phone — REQUIRED so they can be followed up / sent the confirmation or payment link" },
          details: { type: "string", description: "What they want: items ordered, quote subject, the reason" },
          amount: { type: "string", description: "Amount in dollars, only for a sale or invoice (optional)" },
          when: { type: "string", description: "Requested time for a callback (optional)" },
        },
        required: ["action"],
      },
      content_type: "application/json",
    },
  };
}

// Just the ACTION toolset (schedule + do_action + language detection) for a given tenant email — so an
// EXISTING agent (e.g. the Guileo sales agent) can be given the tools WITHOUT overwriting its own prompt.
export function clientToolset(env, email) {
  const e = (email || "").toString().trim().toLowerCase();
  const tools = [schedulingTool(env, e), actionTool(env, e)].filter(Boolean);
  return {
    ...(tools.length ? { tools } : {}),
    built_in_tools: { language_detection: { name: "language_detection", params: { system_tool_type: "language_detection" } } },
  };
}

// Build the FULL conversation_config (voice + brain + LLM + scheduling tool) — one source of truth so the
// admin onboard and the self-serve webhook provision identical agents. llm defaults to a strong model
// (comprehension is the product); voice stays Flash v2.5 for cost.
export function buildConversationConfig(env, { business, industry, lang, brain, agentName, email, prices, services, voiceId }) {
  const L = ["pt", "es", "en"].includes(lang) ? lang : "en";
  // PRICES: prefer an explicit pre-formatted block; else format the services the caller passed
  // (biz_lookup shape). Either way the Gui gets REAL numbers to quote & close on.
  const priceBlock = (prices || "").toString().trim() || formatPrices(services, L);
  const { prompt, firstMessage } = buildGuiPrompt({ business, industry, lang: L, brain, agentName, prices: priceBlock });
  const e = (email || "").toString().trim().toLowerCase();
  const tools = [schedulingTool(env, e), actionTool(env, e)].filter(Boolean);
  const toolHint = tools.length
    ? "\n\nTOOLS — you can ACT, not just talk:\n• `schedule`: check PRICES and availability, and BOOK appointments/reservations (op=lookup|price|availability|book). Consult op='price' (or op='lookup', which lists prices) before quoting any price — never guess. Never say something is booked unless op='book' succeeded.\n• `do_action`: take an order, capture a lead, log a quote, make a payment link, schedule a callback, or ESCALATE to a human (action='escalate') the moment the caller asks for a person, sounds upset, or asks something you can't answer. Never promise any of these without calling it.\n🚨 EMERGENCY (no AC / flood / leak / burst pipe / no power / gas smell / roof damage, or the caller says it's urgent — any language): FIRST capture the best callback number, THEN call do_action with action='escalate' AND urgent=true — this rings the owner's phone immediately with the caller's details, so never skip the number.\nALWAYS capture the caller's name + a contact (email or phone) before acting, so the confirmation is sent."
    : "";
  // ElevenLabs rejects flash_v2_5 for English-PRIMARY agents ("English Agents must use turbo or flash v2");
  // turbo_v2_5 is multilingual AND accepted for English → use it for en, flash_v2_5 (multilingual) for pt/es.
  const ttsModel = L === "en" ? (env.ELEVEN_EN_MODEL || "eleven_flash_v2") : "eleven_flash_v2_5";
  // CADASTRO COMPLETO — a client can pick their OWN voice (agent.voice_key → voice_id, see
  // src/data/agentVoices.js). voiceId wins; the brand default ELEVEN_VOICE_ID is the fallback so the
  // signature stays backward-compatible (callers that don't pass voiceId keep the old behavior).
  const voice = (voiceId || env.ELEVEN_VOICE_ID || "").toString().trim();
  const ttsCfg = { model_id: ttsModel, ...(voice ? { voice_id: voice } : {}) };
  return {
    tts: ttsCfg,
    agent: {
      prompt: {
        prompt: prompt + toolHint,
        llm: env.ELEVEN_LLM || "gpt-4o",
        ...(tools.length ? { tools } : {}),
        // MULTILINGUAL: built-in language-detection system tool → the agent answers in its primary
        // language (L, the OWNER's choice — kept as-is below) but auto-detects and SWITCHES to the
        // caller's language mid-call, across the full LANGS_SPOKEN list (EN/ES/PT/HI/ZH/YUE/RU/KO/HT
        // — ElevenLabs multilingual TTS covers them all; the behavior itself lives in the prompt).
        built_in_tools: { language_detection: { name: "language_detection", params: { system_tool_type: "language_detection" } } },
      },
      language: L,
      first_message: firstMessage,
      // CALLER MEMORY defaults — the prompt references {{caller_name}}/{{caller_last}}/{{caller_note}};
      // these placeholders make an UNKNOWN caller graceful (empty ⇒ "treat as new customer") instead of
      // failing conversation-init on a missing dynamic variable.
      dynamic_variables: { dynamic_variable_placeholders: { caller_name: "", caller_last: "", caller_note: "" } },
    },
  };
}

// CALLER MEMORY (inbound): agents whose Twilio number is imported straight into ElevenLabs are answered
// by ElevenLabs BEFORE any Guileo server runs — so per-call variables must come from ElevenLabs' own
// conversation-initiation (Twilio personalization) webhook. This points it at /api/twilio-inbound, which
// answers JSON requests carrying x-guileo-secret with { type, dynamic_variables:{caller_name,…} }.
// Best-effort: without AGENT_ACTION_SECRET we send no platform_settings at all (agent still provisions).
export function buildPlatformSettings(env) {
  if (!env.AGENT_ACTION_SECRET) return null;
  return {
    workspace_overrides: {
      conversation_initiation_client_data_webhook: {
        url: "https://guileoai.com/api/twilio-inbound",
        request_headers: { "x-guileo-secret": env.AGENT_ACTION_SECRET },
      },
    },
  };
}

// Create-or-update the client's dedicated Gui agent. Returns { ok, agent_id, step, created }.
// env needs ELEVENLABS_API_KEY (+ optional ELEVEN_VOICE_ID); ING is the INGEST_SECRET.
export async function provisionClientAgent(env, { email, business, industry, lang, brain, agentName, voiceId, services, prices }, ING) {
  const e = (email || "").toString().trim().toLowerCase();
  const L = ["pt", "es", "en"].includes(lang) ? lang : "en";
  if (!env.ELEVENLABS_API_KEY) return { ok: false, agent_id: "", step: "skipped (no ElevenLabs key)" };
  if (!e.includes("@")) return { ok: false, agent_id: "", step: "skipped (no email)" };

  try {
    // TENANT KNOWLEDGE BASE — the owner's own Q&A (walk-ins? parking? cancellation policy?)
    // becomes part of the VOICE brain, so the Gui answers business-specific questions on calls.
    // Best-effort: RPC missing (db/tenant_kb.sql not pasted) or empty → brain unchanged.
    let kbBrain = brain;
    try {
      const kr = await rpc("kb_for_agent", { p_secret: ING, p_email: e });
      if (kr.ok) {
        const kb = ((await kr.json()) || "").toString().slice(0, 1600);
        if (kb.trim()) kbBrain = `${brain || ""}\n\nBUSINESS FAQ (answer these exactly as the owner wrote them):\n${kb}`.trim();
      }
    } catch { /* KB is a bonus — never blocks a birth */ }
    // PRICES — the Gui must quote REAL prices, never close "in the dark". Prefer what the caller passed
    // (onboarding services / pre-formatted block); else read the tenant's live menu (biz_lookup).
    // Best-effort → "" never breaks a birth.
    let priceBlock = (prices || "").toString().trim() || formatPrices(services, L);
    if (!priceBlock) priceBlock = await fetchTenantPrices(env, e, L);
    const convCfg = buildConversationConfig(env, { business, industry, lang: L, brain: kbBrain, agentName, email: e, voiceId, prices: priceBlock });
    const platform = buildPlatformSettings(env); // caller-memory initiation webhook (null when not configured)

    // already provisioned? → update in place (idempotent, no duplicate agent / no double-bill)
    let existingId = "";
    try { const ar = await rpc("client_agent_lookup", { p_secret: ING, p_email: e }); if (ar.ok) existingId = ((await ar.json()) || "").toString(); } catch { /* best-effort */ }

    if (existingId) {
      const pr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${existingId}`, {
        method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_config: convCfg, ...(platform ? { platform_settings: platform } : {}) }),
      });
      if (pr.ok) return { ok: true, agent_id: existingId, step: `updated existing ${existingId}`, created: false };
      const patchStep = `err PATCH ${pr.status}: ${(await pr.text().catch(() => "")).slice(0, 160)}`;
      // update failed = the client's live agent kept a STALE brain/voice — visible in /admin, not just steps
      await emitFailure(env, "agent_update_failed", e, patchStep, { agent_id: existingId });
      return { ok: false, agent_id: existingId, step: patchStep, created: false };
    }

    const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
      method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Gui · ${(business || e).toString()}`.slice(0, 60), conversation_config: convCfg, ...(platform ? { platform_settings: platform } : {}) }),
    });
    if (!res.ok) {
      const createStep = `err ${res.status}: ${(await res.text().catch(() => "")).slice(0, 180)}`;
      // a client who PAID but has NO agent is the worst outcome — alert /admin even if the caller
      // drops the return value (both callers set steps, but steps can be ignored; this can't).
      await emitFailure(env, "agent_provision_failed", e, createStep, {});
      return { ok: false, agent_id: "", step: createStep, created: false };
    }
    const d = await res.json();
    const agentId = d.agent_id || d.id || "";
    if (!agentId) {
      await emitFailure(env, "agent_provision_failed", e, "created_no_id — ElevenLabs returned no agent id", {});
      return { ok: false, agent_id: "", step: "created_no_id", created: true };
    }
    // persist so calls route + portal syncs the brain; surface a persistence failure (don't fake ok)
    const sr = await rpc("set_client_agent", { p_secret: ING, p_email: e, p_agent_id: agentId });
    if (!sr.ok) {
      // agent EXISTS in ElevenLabs but the DB link failed → calls won't route AND a retry would
      // duplicate it (lookup misses). This must be finished by hand — ring the /admin bell.
      await emitFailure(env, "agent_not_linked", e, `agent ${agentId} created but set_client_agent failed — link manually or calls won't route`, { agent_id: agentId });
      return { ok: false, agent_id: agentId, step: "created_but_NOT_linked — calls won't route", created: true };
    }
    return { ok: true, agent_id: agentId, step: "created", created: true };
  } catch (err) {
    await emitFailure(env, "agent_provision_failed", e, `err: ${String(err).slice(0, 120)}`, {});
    return { ok: false, agent_id: "", step: `err: ${String(err).slice(0, 120)}`, created: false };
  }
}

// INBOUND → THE CLIENT'S OWN GUI: import the client's Twilio number into ElevenLabs convai and assign
// their dedicated agent, so an inbound call is ANSWERED by their trained Gui. Best-effort; never throws.
export async function elevenBindNumber(env, number, agentId, label) {
  if (!env.ELEVENLABS_API_KEY || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !number || !agentId) return { ok: false, reason: "missing inputs" };
  try {
    const cr = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
      method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "twilio", phone_number: number, label: (label || "Gui").slice(0, 60), sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN }),
    });
    if (!cr.ok) return { ok: false, reason: `import ${cr.status}: ${(await cr.text().catch(() => "")).slice(0, 160)}` };
    const cd = await cr.json().catch(() => ({}));
    const pnId = cd.phone_number_id || cd.id || "";
    if (!pnId) return { ok: false, reason: "no phone_number_id returned" };
    const pr = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${pnId}`, {
      method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId }),
    });
    if (!pr.ok) return { ok: false, reason: `assign ${pr.status}: ${(await pr.text().catch(() => "")).slice(0, 160)}` };
    return { ok: true, phone_number_id: pnId };
  } catch (e) { return { ok: false, reason: String(e).slice(0, 120) }; }
}

// BUY a fresh US Twilio number (the AI answers it), wire its SMS+Voice webhooks to Gui, persist it,
// and bind it to the client's agent so inbound calls are answered. The client then FORWARDS their own
// existing business number to this one (see forwardingInstructions). Best-effort; returns details.
export async function buyAndBindNumber(env, { email, agentId, areaCode, label }, ING) {
  const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) return { ok: false, reason: "twilio not configured" };
  try {
    // IDEMPOTENT: if this client ALREADY has a number, never buy a second one (no duplicate
    // $/mo number on a webhook double-delivery or manual re-run). Just re-bind the existing
    // number to the agent so the outcome is identical. Graceful: if the lookup RPC isn't
    // installed (db/client_number_lookup.sql) or errors, fall through to the normal purchase.
    if (email) {
      try {
        const lr = await rpc("client_number_lookup", { p_secret: ING, p_email: email });
        const existing = lr.ok ? ((await lr.json()) || "").toString() : "";
        if (existing) {
          // NEVER bind the platform's reserved demo line to a client agent (would hijack the site demo).
          if (existing.replace(/[^0-9]/g, "") === "19864443334") {
            await emitFailure(env, "reserved_number_blocked", email || "", `refused to bind the reserved demo line to ${email} — map a real number in /admin`, { number: existing });
            return { ok: false, number: "", reason: "reserved number refused" };
          }
          let inbound = { ok: false, reason: "no agent" };
          if (agentId) {
            inbound = await elevenBindNumber(env, existing, agentId, label);
            // number is LIVE but nobody answers it — that's a paying client with a dead line; alert.
            if (!inbound.ok) await emitFailure(env, "number_unbound", email || "", `number ${existing} exists but NOT bound to agent ${agentId} — inbound won't be answered · ${inbound.reason || ""}`, { number: existing, agent_id: agentId });
          }
          return { ok: true, number: existing, inbound: inbound.ok, inboundReason: inbound.reason || "", reused: true };
        }
      } catch { /* lookup best-effort → proceed to buy a fresh number */ }
    }
    const auth = "Basic " + btoa(`${sid}:${tok}`);
    const area = (areaCode || "").toString().replace(/[^0-9]/g, "");
    const sr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&VoiceEnabled=true${area ? `&AreaCode=${area}` : ""}&PageSize=1`, { headers: { Authorization: auth } });
    const avail = sr.ok ? await sr.json() : {};
    const pick = avail?.available_phone_numbers?.[0]?.phone_number;
    if (!pick) return { ok: false, reason: "no number available" };
    const pr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`, {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ PhoneNumber: pick, SmsUrl: "https://guileoai.com/api/twilio-inbound", SmsMethod: "POST", VoiceUrl: "https://guileoai.com/api/twilio-voice", VoiceMethod: "POST" }),
    });
    if (!pr.ok) return { ok: false, reason: `buy ${pr.status}: ${(await pr.text().catch(() => "")).slice(0, 140)}` };
    const pd = await pr.json();
    const number = pd.phone_number;
    // 1.4 — a number bought but NOT linked = orphaned (client's calls won't route, money spent). Surface it.
    if (email) {
      try {
        const snr = await rpc("set_client_number", { p_secret: ING, p_email: email, p_number: number });
        if (!snr.ok) await emitFailure(env, "number_orphaned", email, `bought ${number} but set_client_number failed — link manually`, { number });
      } catch (e) { await emitFailure(env, "number_orphaned", email, `bought ${number} but link errored: ${String(e).slice(0, 80)}`, { number }); }
    }
    let inbound = { ok: false, reason: "no agent" };
    if (agentId) {
      inbound = await elevenBindNumber(env, number, agentId, label);
      // number BOUGHT ($/mo) but not answered by the agent — money spent on a dead line; alert.
      if (!inbound.ok) await emitFailure(env, "number_unbound", email || "", `bought ${number} but NOT bound to agent ${agentId} — inbound won't be answered · ${inbound.reason || ""}`, { number, agent_id: agentId });
    }
    return { ok: true, number, inbound: inbound.ok, inboundReason: inbound.reason || "" };
  } catch (e) { return { ok: false, reason: String(e).slice(0, 120) }; }
}

// The forwarding instructions handed to the client — BOTH options, they pick. Codes are the common
// US ones; carriers vary, so we say so. The client dials these ONCE on their own business line.
export function forwardingInstructions(twilioNumber, lang = "en") {
  // dial-format: forwarding codes (*72 etc.) are dialed on a keypad, so strip the leading +1 and
  // any non-digits → the 10-digit number the carrier expects after the star code.
  const n = (twilioNumber || "").toString().replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (lang === "pt") return {
    full: `Encaminhar TODAS as ligações pra IA: no telefone do negócio, disque ${"*"}72${n} e ligue. (Cancelar: ${"*"}73)`,
    missed: `Encaminhar só as PERDIDAS (ocupado/sem atender): disque ${"*"}71${n} (ou ${"*"}92 — varia por operadora).`,
    note: `Os códigos podem variar por operadora. Se algum não funcionar, a gente te passa o certo da sua.`,
  };
  if (lang === "es") return {
    full: `Reenviar TODAS las llamadas a la IA: en el teléfono del negocio, marca ${"*"}72${n} y llama. (Cancelar: ${"*"}73)`,
    missed: `Reenviar solo las PERDIDAS (ocupado/sin contestar): marca ${"*"}71${n} (o ${"*"}92 — varía por operador).`,
    note: `Los códigos pueden variar por operador. Si alguno no funciona, te pasamos el correcto.`,
  };
  return {
    full: `Forward ALL calls to the AI: on your business phone, dial ${"*"}72${n} and press call. (Cancel: ${"*"}73)`,
    missed: `Forward only MISSED calls (busy/no-answer): dial ${"*"}71${n} (or ${"*"}92 — varies by carrier).`,
    note: `Codes can vary by carrier. If one doesn't work, we'll send the exact one for yours.`,
  };
}
