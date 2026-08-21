// ============================================================================
// DemoEngine.jsx — the "vitrine" (searchable, personalized demo showcase).
//
// The seller (or a prospect) types the client's URL / @handle / brand name →
// /api/demo action:"brand" pulls a brand kit (name, tagline, facts, colors, logo,
// services) → the seller picks any Guileo product → it renders a PERSONALIZED
// PREVIEW in the client's own colors + logo, ready to sell live on a call.
//
// Everything a mock shows is labelled "prévia / simulação" — we never claim it is
// live on the client's real account. Honest by construction (repo law).
//
// Contract assumed for /api/demo (POST JSON { action, ... }) — see the parent-agent
// note; every field is read defensively so a partial backend still renders:
//   action:"brand"      { query }                  → { ok, brand }
//   action:"save"       { brand, productId, surface } → { ok, demo_token }
//   action:"get"        { token }                   → { ok, brand, productId }
//   action:"view"       { token?, productId, brand } → { ok }        (fire-and-forget)
//   action:"lead"       { name, contact, brand, productId, surface } → { ok }
//   action:"screenshot" { url }                     → { ok:false }   (inert for now)
// brand = { name, tagline, facts:[str], colors:{primary,accent}|["#.."], logo, services:[str], url, handle }
//
// Self-contained 4-lang copy (EN·PT·ES·HI). Glass-card cement look; neutral tokens
// (border-g-line / bg-white/[0.03]) so it reads on BOTH the cream Admin surface and
// the cement seller/public surfaces.
// ============================================================================
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLang } from "../i18n.jsx";
import { waLink } from "../data/contact.js";

// ── self-contained copy ──────────────────────────────────────────────────────
const T4 = {
  en: {
    eyebrow: "Demo Engine · personalized showcase",
    title: "Show any Guileo product — in their brand",
    sub: "Enter a website, @handle or business name. We pull their brand, then render any product in their colors — ready to sell on the call.",
    ph: "acme.com · @acmecoffee · Acme Coffee",
    pull: "Pull brand →", pulling: "Pulling brand…", pullErr: "Couldn't read that one — try a URL or @handle.",
    brandFrom: "Brand pulled from", facts: "What we know", services: "Services",
    pick: "Pick a product to preview", previewOf: "Preview for",
    sim: "Prévia · simulation — not live on their real account",
    share: "Copy demo link", sharing: "Building link…", shared: "Link copied ✓", shareHint: "Send it — they reopen their own demo anytime.",
    want: "I want this →", leadTitle: "Send me this demo", leadName: "Name", leadContact: "Phone or email",
    leadSend: "Send it to me", leadSent: "On its way ✓", leadErr: "Try again in a moment.",
    plans: "See plans", talk: "Talk on WhatsApp", reset: "New brand",
    startNow: "Start now →", pickPlan: "Start on a plan", checkoutErr: "Couldn't open checkout — try again.",
    analytics: "Demo funnel", fView: "Views", fLead: "Leads", fBuy: "Checkout", fPaid: "Paid", noData: "No demo activity yet.",
    chat: { hi: "Hi! How can we help?", u: "Do you have availability today?", a: "Yes — I can book you right now. What time works?" },
    dm: "Answered by their brain", callFor: "Gui answering for", live: "live", ringing: "Ringing…",
    callNow: "Hear Gui now — get the call", callPh: "Your phone (with country code)", calling: "Calling…", callSent: "Gui is calling you now ✓", callErr: "Couldn't place the call — check the number.",
    callSkipped: "Already sent — check your phone.", callCapped: "Try again in a minute.",
    hearReal: "Hear the real voice", voicePlaying: "Playing…", voiceWarm: "Voice warming up — tap again.",
    adCard: "ready-to-run ads", emailCard: "Email in their tone", seoCard: "Ranking page for",
    appHint: "Their app, their brand", tapToBook: "Tap to book",
  },
  pt: {
    eyebrow: "Motor de Demo · vitrine personalizada",
    title: "Mostre qualquer produto Guileo — na marca do cliente",
    sub: "Digite um site, @ ou nome do negócio. Puxamos a marca e renderizamos qualquer produto nas cores dele — pronto pra vender na ligação.",
    ph: "acme.com · @acmecoffee · Café Acme",
    pull: "Puxar marca →", pulling: "Puxando marca…", pullErr: "Não consegui ler — tente uma URL ou @.",
    brandFrom: "Marca puxada de", facts: "O que sabemos", services: "Serviços",
    pick: "Escolha um produto pra pré-visualizar", previewOf: "Prévia para",
    sim: "Prévia · simulação — não está no ar na conta real dele",
    share: "Copiar link da demo", sharing: "Gerando link…", shared: "Link copiado ✓", shareHint: "Mande — ele reabre a própria demo quando quiser.",
    want: "Quero isso →", leadTitle: "Me manda essa demo", leadName: "Nome", leadContact: "Telefone ou e-mail",
    leadSend: "Enviar pra mim", leadSent: "A caminho ✓", leadErr: "Tente de novo num instante.",
    plans: "Ver planos", talk: "Falar no WhatsApp", reset: "Nova marca",
    startNow: "Começar agora →", pickPlan: "Começar num plano", checkoutErr: "Não abriu o checkout — tente de novo.",
    analytics: "Funil da demo", fView: "Views", fLead: "Leads", fBuy: "Checkout", fPaid: "Pago", noData: "Sem atividade ainda.",
    chat: { hi: "Oi! Como posso ajudar?", u: "Tem horário hoje?", a: "Tenho — já posso agendar. Que horário fica bom?" },
    dm: "Respondido pelo cérebro dele", callFor: "Gui atendendo pela", live: "ao vivo", ringing: "Chamando…",
    callNow: "Ouça a Gui agora — receba a ligação", callPh: "Seu telefone com DDD", calling: "Ligando…", callSent: "A Gui está te ligando agora ✓", callErr: "Não consegui ligar — confira o número.",
    callSkipped: "Já enviamos — confira seu telefone.", callCapped: "Tente de novo em um minuto.",
    hearReal: "Ouvir a voz real", voicePlaying: "Tocando…", voiceWarm: "Voz aquecendo — toque de novo.",
    adCard: "anúncios prontos", emailCard: "E-mail no tom dele", seoCard: "Página rankeando em",
    appHint: "O app dele, a marca dele", tapToBook: "Toque pra agendar",
  },
  es: {
    eyebrow: "Motor de Demo · vitrina personalizada",
    title: "Muestra cualquier producto Guileo — en su marca",
    sub: "Escribe un sitio, @ o nombre del negocio. Traemos su marca y renderizamos cualquier producto en sus colores — listo para vender en la llamada.",
    ph: "acme.com · @acmecoffee · Café Acme",
    pull: "Traer marca →", pulling: "Trayendo marca…", pullErr: "No pude leerlo — prueba una URL o @.",
    brandFrom: "Marca traída de", facts: "Lo que sabemos", services: "Servicios",
    pick: "Elige un producto para previsualizar", previewOf: "Vista previa para",
    sim: "Vista previa · simulación — no está activa en su cuenta real",
    share: "Copiar enlace de la demo", sharing: "Generando enlace…", shared: "Enlace copiado ✓", shareHint: "Envíalo — reabre su propia demo cuando quiera.",
    want: "Quiero esto →", leadTitle: "Envíame esta demo", leadName: "Nombre", leadContact: "Teléfono o email",
    leadSend: "Enviármelo", leadSent: "En camino ✓", leadErr: "Inténtalo de nuevo en un momento.",
    plans: "Ver planes", talk: "Hablar por WhatsApp", reset: "Nueva marca",
    startNow: "Empezar ahora →", pickPlan: "Empezar en un plan", checkoutErr: "No se abrió el checkout — inténtalo de nuevo.",
    analytics: "Embudo de la demo", fView: "Vistas", fLead: "Leads", fBuy: "Checkout", fPaid: "Pagado", noData: "Sin actividad aún.",
    chat: { hi: "¡Hola! ¿Cómo puedo ayudar?", u: "¿Tienes hora hoy?", a: "Sí — puedo agendarte ahora. ¿Qué hora te queda bien?" },
    dm: "Respondido por su cerebro", callFor: "Gui atendiendo por", live: "en vivo", ringing: "Llamando…",
    callNow: "Escucha a Gui ahora — recibe la llamada", callPh: "Tu teléfono con código", calling: "Llamando…", callSent: "Gui te está llamando ahora ✓", callErr: "No pude llamar — revisa el número.",
    callSkipped: "Ya te llamamos — revisa tu teléfono.", callCapped: "Inténtalo de nuevo en un minuto.",
    hearReal: "Escuchar la voz real", voicePlaying: "Reproduciendo…", voiceWarm: "Voz calentando — toca de nuevo.",
    adCard: "anuncios listos", emailCard: "Email en su tono", seoCard: "Página posicionando en",
    appHint: "Su app, su marca", tapToBook: "Toca para reservar",
  },
  hi: {
    eyebrow: "डेमो इंजन · व्यक्तिगत शोकेस",
    title: "कोई भी Guileo प्रोडक्ट दिखाएँ — उनकी ब्रांड में",
    sub: "वेबसाइट, @हैंडल या बिज़नेस नाम डालें। हम उनकी ब्रांड लाते हैं और कोई भी प्रोडक्ट उनके रंगों में दिखाते हैं — कॉल पर बेचने के लिए तैयार।",
    ph: "acme.com · @acmecoffee · Acme Coffee",
    pull: "ब्रांड लाएँ →", pulling: "ब्रांड ला रहे हैं…", pullErr: "पढ़ नहीं सका — URL या @ आज़माएँ।",
    brandFrom: "ब्रांड यहाँ से", facts: "हम क्या जानते हैं", services: "सेवाएँ",
    pick: "प्रीव्यू के लिए प्रोडक्ट चुनें", previewOf: "प्रीव्यू:",
    sim: "प्रीव्यू · सिमुलेशन — उनके असली अकाउंट पर लाइव नहीं",
    share: "डेमो लिंक कॉपी करें", sharing: "लिंक बना रहे हैं…", shared: "लिंक कॉपी हुआ ✓", shareHint: "भेजें — वे अपनी डेमो कभी भी दोबारा खोल सकते हैं।",
    want: "मुझे यह चाहिए →", leadTitle: "मुझे यह डेमो भेजें", leadName: "नाम", leadContact: "फ़ोन या ईमेल",
    leadSend: "मुझे भेजें", leadSent: "भेज दिया ✓", leadErr: "एक पल में फिर कोशिश करें।",
    plans: "प्लान देखें", talk: "WhatsApp पर बात करें", reset: "नई ब्रांड",
    startNow: "अभी शुरू करें →", pickPlan: "किसी प्लान पर शुरू करें", checkoutErr: "चेकआउट नहीं खुला — फिर कोशिश करें।",
    analytics: "डेमो फ़नल", fView: "व्यूज़", fLead: "लीड्स", fBuy: "चेकआउट", fPaid: "पेड", noData: "अभी कोई गतिविधि नहीं।",
    chat: { hi: "नमस्ते! कैसे मदद करूँ?", u: "क्या आज समय है?", a: "हाँ — मैं अभी बुक कर सकता हूँ। कौन सा समय ठीक है?" },
    dm: "उनके ब्रेन द्वारा उत्तर", callFor: "Gui उत्तर दे रही है", live: "लाइव", ringing: "रिंग हो रहा है…",
    callNow: "Gui को अभी सुनें — कॉल पाएँ", callPh: "आपका फ़ोन (कोड सहित)", calling: "कॉल कर रहे हैं…", callSent: "Gui आपको अभी कॉल कर रही है ✓", callErr: "कॉल नहीं हो सका — नंबर जाँचें।",
    callSkipped: "पहले ही भेज दिया — अपना फ़ोन देखें।", callCapped: "एक मिनट में फिर कोशिश करें।",
    hearReal: "असली आवाज़ सुनें", voicePlaying: "चल रहा है…", voiceWarm: "आवाज़ तैयार हो रही है — फिर टैप करें।",
    adCard: "तैयार विज्ञापन", emailCard: "उनके टोन में ईमेल", seoCard: "रैंकिंग पेज:",
    appHint: "उनका ऐप, उनकी ब्रांड", tapToBook: "बुक करने के लिए टैप करें",
  },
};

// The product picker. Local list keyed to the preview renderers (productSystem.js
// records are result-metrics, not surface types — so this list drives the mocks).
const PRODUCTS = [
  { id: "website", icon: "🌐", label: { en: "Website AI assistant", pt: "Assistente do site", es: "Asistente del sitio", hi: "वेबसाइट AI असिस्टेंट" } },
  { id: "app",     icon: "📱", label: { en: "App / software",       pt: "App / software",       es: "App / software",       hi: "ऐप / सॉफ़्टवेयर" } },
  { id: "social",  icon: "📸", label: { en: "Instagram / social",   pt: "Instagram / social",   es: "Instagram / social",   hi: "इंस्टाग्राम / सोशल" } },
  { id: "voice",   icon: "📞", label: { en: "Voice agent",          pt: "Agente de voz",        es: "Agente de voz",        hi: "वॉइस एजेंट" } },
  { id: "ads",     icon: "📣", label: { en: "Ads",                  pt: "Anúncios",             es: "Anuncios",             hi: "विज्ञापन" } },
  { id: "seo",     icon: "🔎", label: { en: "SEO",                  pt: "SEO",                  es: "SEO",                  hi: "SEO" } },
  { id: "email",   icon: "✉️", label: { en: "Email / content",      pt: "E-mail / conteúdo",    es: "Email / contenido",    hi: "ईमेल / कंटेंट" } },
];

// One-line "what it delivers" blurb per product card, shown under the name in the picker grid.
// Local dictionary, same self-contained en/pt/es/hi pattern as VOICE_LBL further down.
const PRODUCT_DESC = {
  website: { en: "Answers on your site, 24/7", pt: "Atende no seu site 24/7", es: "Atiende en tu sitio 24/7", hi: "आपकी साइट पर 24/7 जवाब" },
  app:     { en: "Your app, on your brand",     pt: "Seu app na sua marca",    es: "Tu app, con tu marca",    hi: "आपका ऐप, आपकी ब्रांड में" },
  social:  { en: "Replies to DMs instantly",    pt: "Responde DM na hora",     es: "Responde DM al instante", hi: "DM का तुरंत जवाब" },
  voice:   { en: "Picks up every call",         pt: "Atende toda ligação",     es: "Contesta cada llamada",   hi: "हर कॉल उठाती है" },
  ads:     { en: "Ready-to-run ad creative",    pt: "Anúncio pronto pra rodar", es: "Anuncio listo para usar", hi: "चलाने के लिए तैयार विज्ञापन" },
  seo:     { en: "Ranks you on Google",         pt: "Ranqueia você no Google", es: "Te posiciona en Google",  hi: "गूगल पर रैंक करती है" },
  email:   { en: "Writes in your tone",         pt: "Escreve no seu tom",      es: "Escribe en tu tono",      hi: "आपके अंदाज़ में लिखती है" },
};

// Local copy for the three previews elevated 2026-08-17 (Luis: "bem mais elaborado") — WebsitePreview,
// AppPreview, SocialPreview. Same self-contained en/pt/es/hi pattern as VOICE_LBL further down.
const WEBSITE_LBL = {
  en: { greetPre: "Hi! I'm", greetPost: "— how can I help?", askPre: "How much is", askPost: "?", bookPitch: "I can book you right now — want me to?", yes: "Yes, book me!", bookedTitle: "Booked ✨", bookedSub: "Confirmation sent instantly", online: "online now" },
  pt: { greetPre: "Oi! Aqui é a", greetPost: "— como posso ajudar?", askPre: "Quanto custa", askPost: "?", bookPitch: "Posso agendar agora mesmo — quer que eu agende?", yes: "Quero, agenda pra mim!", bookedTitle: "Agendado ✨", bookedSub: "Confirmação enviada na hora", online: "on-line agora" },
  es: { greetPre: "¡Hola! Soy", greetPost: "— ¿en qué puedo ayudarle?", askPre: "¿Cuánto cuesta", askPost: "?", bookPitch: "Puedo agendarle ahora mismo — ¿quiere que lo haga?", yes: "¡Sí, resérveme!", bookedTitle: "Agendado ✨", bookedSub: "Confirmación enviada al instante", online: "en línea ahora" },
  hi: { greetPre: "नमस्ते! मैं हूँ", greetPost: "— मैं कैसे मदद कर सकती हूँ?", askPre: "कीमत क्या है", askPost: "की?", bookPitch: "मैं अभी बुक कर सकती हूँ — क्या बुक कर दूँ?", yes: "हाँ, बुक कर दीजिए!", bookedTitle: "बुक हुआ ✨", bookedSub: "पुष्टि तुरंत भेज दी गई", online: "अभी ऑनलाइन" },
};

const APP_LBL = {
  en: { nextAppt: "Next appointment", today: "Today", navHome: "Home", navBook: "Book", navChat: "Chat", navYou: "You" },
  pt: { nextAppt: "Próximo agendamento", today: "Hoje", navHome: "Início", navBook: "Agendar", navChat: "Chat", navYou: "Você" },
  es: { nextAppt: "Próxima cita", today: "Hoy", navHome: "Inicio", navBook: "Reservar", navChat: "Chat", navYou: "Tú" },
  hi: { nextAppt: "अगली अपॉइंटमेंट", today: "आज", navHome: "होम", navBook: "बुक करें", navChat: "चैट", navYou: "आप" },
};

const SOCIAL_LBL = {
  en: { followers: "followers", dmLabel: "DM · answered instantly", askPre: "Do you have", askPost: "available?", replyPitch: "Yes! I can book you right now ✨", yes: "Book me!", bookedTitle: "Booked via DM", follow: "Follow" },
  pt: { followers: "seguidores", dmLabel: "DM · respondido na hora", askPre: "Vocês têm", askPost: "disponível?", replyPitch: "Temos sim! Posso agendar agora mesmo ✨", yes: "Agenda pra mim!", bookedTitle: "Agendado pelo DM", follow: "Seguir" },
  es: { followers: "seguidores", dmLabel: "DM · respondido al instante", askPre: "¿Tienen", askPost: "disponible?", replyPitch: "¡Sí! Puedo agendarle ahora mismo ✨", yes: "¡Resérveme!", bookedTitle: "Agendado por DM", follow: "Seguir" },
  hi: { followers: "फ़ॉलोअर्स", dmLabel: "DM · तुरंत जवाब", askPre: "क्या आपके पास", askPost: "उपलब्ध है?", replyPitch: "हाँ! मैं अभी बुक कर सकती हूँ ✨", yes: "मुझे बुक करें!", bookedTitle: "DM से बुक हुआ", follow: "फ़ॉलो करें" },
};

const FALLBACK_ACCENT = "#FF8A33"; // Gui orange (signal palette)

// Normalize whatever colors shape the backend returns into { primary, accent }.
function readColors(brand) {
  const c = brand?.colors;
  if (Array.isArray(c) && c.length) return { primary: c[0], accent: c[1] || c[0] };
  if (c && typeof c === "object") return { primary: c.primary || c.accent || FALLBACK_ACCENT, accent: c.accent || c.primary || FALLBACK_ACCENT };
  return { primary: FALLBACK_ACCENT, accent: FALLBACK_ACCENT };
}
const initialsOf = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "•";
const handleOf = (brand) => brand?.handle || (brand?.name ? "@" + brand.name.toLowerCase().replace(/[^a-z0-9]/g, "") : "@brand");
const domainOf = (brand) => {
  try { return new URL(brand?.url?.startsWith("http") ? brand.url : "https://" + (brand?.url || "")).hostname; } catch { return (brand?.url || (brand?.name || "brand").toLowerCase().replace(/[^a-z0-9]/g, "") + ".com").replace(/^https?:\/\//, ""); }
};

// TIMEOUT: ler o site do cliente leva ~10s (é busca + IA). Sem teto, uma rede ruim deixa o
// botão girando pra sempre — e quem está vendo é o CLIENTE, na reunião. 30s e devolve erro.
async function callDemo(action, payload, ms = 30000) {
  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch("/api/demo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }), signal: ctrl.signal,
    });
    if (!r.ok) throw new Error("demo " + action + " " + r.status);
    return await r.json();
  } finally { clearTimeout(kill); }
}

// Normalize a brand kit into the shape the previews render: services as plain strings and facts as
// a short array of sentence strings. The backend (and older saved demos) may return services as
// {name,price} objects and facts as one paragraph string — rendering those directly crashes React
// ("Objects are not valid as a child" / string.find is not a function). This makes every path safe.
function normBrand(b) {
  if (!b || typeof b !== "object") return b;
  const services = Array.isArray(b.services)
    ? b.services.map((s) => (typeof s === "string" ? s : (s && s.name ? (s.price ? `${s.name} · ${s.price}` : s.name) : ""))).filter(Boolean).slice(0, 8)
    : [];
  const facts = Array.isArray(b.facts)
    ? b.facts
    : (typeof b.facts === "string" && b.facts.trim()
        ? b.facts.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean).slice(0, 6)
        : []);
  return { ...b, services, facts };
}

export default function DemoEngine({ surface = "public", presetToken = null }) {
  const { lang } = useLang();
  const t = T4[lang] || T4.en;

  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState(null);
  const [pullState, setPullState] = useState("idle"); // idle | go | err
  const [pullSecs, setPullSecs] = useState(0);          // segundos na espera — 10s calados parecem travamento
  const [product, setProduct] = useState("website");
  const [token, setToken] = useState(presetToken);
  const [shareState, setShareState] = useState("idle"); // idle | go | done
  const [leadOpen, setLeadOpen] = useState(false);
  const [lead, setLead] = useState({ name: "", contact: "" });
  const [leadState, setLeadState] = useState("idle"); // idle | go | done | err

  const colors = useMemo(() => readColors(brand), [brand]);

  // Preload a shared demo when a token is present (public /vitrine/:token).
  useEffect(() => {
    if (!presetToken) return;
    let alive = true;
    callDemo("get", { token: presetToken })
      .then((d) => { if (alive && d?.brand) { setBrand(normBrand(d.brand)); if (d.productId) setProduct(d.productId); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [presetToken]);

  const pull = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setPullState("go"); setBrand(null); setToken(null); setShareState("idle");
    setPullSecs(0);
    const tick = setInterval(() => setPullSecs((n) => n + 1), 1000);
    try {
      const d = await callDemo("brand", { query: q });
      if (d?.brand) { const nb = normBrand(d.brand); setBrand(nb); setPullState("idle"); logView(nb, product); }
      else setPullState("err");
    } catch { setPullState("err"); }
    finally { clearInterval(tick); }
  }, [query, product]);

  const logView = useCallback((b, pid) => { callDemo("view", { token, productId: pid, brand: b }).catch(() => {}); }, [token]);

  const openProduct = (pid) => { setProduct(pid); if (brand) logView(brand, pid); };

  const share = async () => {
    if (!brand) return;
    setShareState("go");
    try {
      let tk = token;
      if (!tk) { const d = await callDemo("save", { brand, productId: product, surface }); tk = d?.demo_token || d?.token; setToken(tk); }
      const url = `${window.location.origin}/vitrine/${tk || ""}`;
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be blocked — link still built */ }
      setShareState("done");
      setTimeout(() => setShareState("idle"), 2500);
    } catch { setShareState("idle"); }
  };

  const sendLead = async (e) => {
    e?.preventDefault?.();
    if (!lead.contact.trim()) return;
    setLeadState("go");
    try {
      await callDemo("lead", { ...lead, brand, productId: product, surface });
      setLeadState("done");
    } catch { setLeadState("err"); }
  };

  // CHECKOUT — ask the server for the plan's audited Payment Link (attributed to this demo),
  // then hand off to Stripe. Ensures a token exists first so the conversion is attributable.
  const [checkoutState, setCheckoutState] = useState("idle"); // idle | go | err
  const checkout = async (planKey) => {
    setCheckoutState("go");
    try {
      let tk = token;
      if (!tk && brand) { const d = await callDemo("save", { brand, productId: product, surface }); tk = d?.demo_token || d?.token; if (tk) setToken(tk); }
      const d = await callDemo("checkout", { token: tk, product, plan: planKey, email: lead.contact.includes("@") ? lead.contact : "" });
      if (d?.url) { window.location.href = d.url; return; }
      setCheckoutState("err");
    } catch { setCheckoutState("err"); }
  };

  // ANALYTICS — seller/admin surfaces see the live funnel (counts only).
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (surface === "public") return;
    let alive = true;
    callDemo("stats", { token: presetToken || "" })
      .then((d) => { if (alive && d?.stats) setStats(d.stats); })
      .catch(() => {});
    return () => { alive = false; };
  }, [surface, presetToken, leadState, checkoutState]);

  const resetBrand = () => { setBrand(null); setQuery(""); setPullState("idle"); setToken(null); setShareState("idle"); setLeadOpen(false); setLeadState("idle"); };

  return (
    <div className="rounded-2xl border border-g-line bg-white/[0.03] p-5 backdrop-blur-sm text-g-word">
      {/* On the public landing the section already carries its own visitor-framed heading, so the
          internal (seller-toned "show any product in THEIR brand") header is hidden to avoid a
          duplicate + wrong-audience title. Seller/admin surfaces keep it. */}
      {surface !== "public" && (
        <>
          <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: brand ? colors.accent : FALLBACK_ACCENT }}>{t.eyebrow}</div>
          <h2 className="mt-1 text-[19px] font-black leading-tight">{t.title}</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] text-g-muted">{t.sub}</p>
        </>
      )}

      {/* ── SEARCH ── */}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") pull(); }}
          placeholder={t.ph}
          className="min-w-[220px] flex-1 rounded-xl border border-g-line bg-white/[0.05] px-3.5 py-2.5 text-[13px] text-g-word placeholder:text-g-muted focus:outline-none focus:ring-1 focus:ring-g-gold/40"
        />
        <button onClick={pull} disabled={pullState === "go" || !query.trim()}
          className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-black disabled:opacity-50"
          style={{ background: FALLBACK_ACCENT }}>
          {pullState === "go" ? `${t.pulling}${pullSecs ? ` ${pullSecs}s` : ""}` : t.pull}
        </button>
        {brand && <button onClick={resetBrand} className="rounded-xl border border-g-line px-3 py-2.5 text-[12px] font-bold text-g-muted hover:text-g-word">↺ {t.reset}</button>}
      </div>
      {pullState === "go" && (
        <div className="mt-2 text-[12px] text-g-muted">
          {lang === "pt" ? "Lendo o site dele e montando a marca — costuma levar uns 10 segundos."
           : lang === "es" ? "Leyendo su sitio y armando la marca — suele tardar unos 10 segundos."
           : "Reading their site and building the brand kit — this usually takes about 10 seconds."}
        </div>
      )}
      {pullState === "err" && <div className="mt-2 text-[12px] text-g-gold">{t.pullErr}</div>}

      {/* ── BRAND KIT ── */}
      {brand && (
        <div className="mt-5 space-y-5">
          <BrandKit brand={brand} colors={colors} t={t} />

          {/* product picker */}
          <div>
            <div className="text-[14px] font-bold text-g-word">{t.pick}</div>
            <div className="stagger mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {PRODUCTS.map((p, i) => {
                const on = product === p.id;
                const desc = PRODUCT_DESC[p.id]?.[lang] || PRODUCT_DESC[p.id]?.en || "";
                return (
                  <button
                    key={p.id}
                    onClick={() => openProduct(p.id)}
                    style={{ animationDelay: `${i * 40}ms`, ...(on ? { borderColor: colors.accent, background: colors.accent + "14", boxShadow: `0 0 0 1px ${colors.accent}55, 0 6px 20px -8px ${colors.accent}66` } : {}) }}
                    className={
                      "group relative flex min-w-0 flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all duration-200 " +
                      (on
                        ? "border-transparent"
                        : "border-g-line bg-white/[0.02] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]")
                    }
                  >
                    <span className="text-[22px] leading-none">{p.icon}</span>
                    <span
                      className="mt-1 truncate w-full text-[13px] font-bold"
                      style={{ color: on ? colors.accent : "var(--g-word,#efe9df)" }}
                    >
                      {p.label[lang] || p.label.en}
                    </span>
                    <span className="truncate w-full text-[11px] text-g-muted">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* personalized preview */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[12px] font-bold text-g-word">{t.previewOf} <span style={{ color: colors.accent }}>{brand.name}</span></div>
              <span className="rounded-full border border-g-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-g-muted">👁 {t.sim}</span>
            </div>
            <Preview product={product} brand={brand} colors={colors} t={t} lang={lang} />
          </div>

          {/* actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-g-line pt-4">
            <button onClick={share} disabled={shareState === "go"}
              className="rounded-xl border border-g-line px-3.5 py-2 text-[12.5px] font-bold text-g-word hover:border-g-gold/40">
              {shareState === "go" ? t.sharing : shareState === "done" ? t.shared : "🔗 " + t.share}
            </button>
            <span className="text-[11px] text-g-muted">{t.shareHint}</span>
            <button onClick={() => setLeadOpen((v) => !v)}
              className="ml-auto rounded-xl px-4 py-2 text-[13px] font-bold text-black"
              style={{ background: colors.accent }}>
              {t.want}
            </button>
          </div>

          {/* lead capture */}
          {leadOpen && (
            <div className="rounded-xl border border-g-line bg-white/[0.04] p-4">
              {leadState === "done" ? (
                <div className="text-[13px] font-bold text-g-green">✓ {t.leadSent}</div>
              ) : (
                <form onSubmit={sendLead} className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2 text-[12px] font-bold text-g-word">{t.leadTitle}</div>
                  <input value={lead.name} onChange={(e) => setLead((s) => ({ ...s, name: e.target.value }))} placeholder={t.leadName}
                    className="rounded-lg border border-g-line bg-white/[0.05] px-3 py-2 text-[12px] text-g-word placeholder:text-g-muted" />
                  <input value={lead.contact} onChange={(e) => setLead((s) => ({ ...s, contact: e.target.value }))} placeholder={t.leadContact}
                    className="rounded-lg border border-g-line bg-white/[0.05] px-3 py-2 text-[12px] text-g-word placeholder:text-g-muted" />
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                    <button type="submit" disabled={leadState === "go" || !lead.contact.trim()}
                      className="rounded-lg px-4 py-2 text-[12.5px] font-bold text-black disabled:opacity-50" style={{ background: colors.accent }}>
                      {leadState === "go" ? "…" : t.leadSend}
                    </button>
                    <a href={waLink(`${brand.name} — ${t.want}`)} target="_blank" rel="noopener" className="rounded-lg border border-g-line px-3 py-2 text-[12px] font-bold text-g-muted hover:text-g-word">💬 {t.talk}</a>
                    {leadState === "err" && <span className="text-[12px] text-g-gold">{t.leadErr}</span>}
                  </div>
                </form>
              )}

              {/* ── CHECKOUT: start on a plan right from the demo (attributed to this demo) ── */}
              <div className="mt-3 border-t border-g-line pt-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-g-muted">{t.pickPlan}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[{ key: "starter", n: "Essential", p: "$149" }, { key: "growth", n: "Personalized", p: "$449" }, { key: "scale", n: "Full", p: "$999" }].map((pl) => (
                    <button key={pl.key} onClick={() => checkout(pl.key)} disabled={checkoutState === "go"}
                      className="rounded-lg border px-3 py-2 text-[12px] font-bold disabled:opacity-50"
                      style={pl.key === "growth"
                        ? { background: colors.accent, color: "#000", borderColor: colors.accent }
                        : { borderColor: "var(--g-line, rgba(255,255,255,.12))", color: "var(--g-word,#eee)" }}>
                      {pl.key === "growth" ? `${t.startNow} ${pl.n} ${pl.p}` : `${pl.n} ${pl.p}`}
                    </button>
                  ))}
                </div>
                {checkoutState === "err" && <div className="mt-1.5 text-[12px] text-g-gold">{t.checkoutErr}</div>}
              </div>
            </div>
          )}

          {/* ── ANALYTICS (seller/admin only) ── */}
          {surface !== "public" && <DemoFunnel stats={stats} t={t} />}
        </div>
      )}

      {/* analytics also visible before a brand is pulled, on seller/admin */}
      {!brand && surface !== "public" && <div className="mt-5"><DemoFunnel stats={stats} t={t} /></div>}
    </div>
  );
}

// ── demo funnel panel ─────────────────────────────────────────────────────────
function DemoFunnel({ stats, t }) {
  const totals = stats?.totals || {};
  const rows = Array.isArray(stats?.by_product) ? stats.by_product : [];
  const cells = [
    { k: t.fView, v: totals.view || 0 },
    { k: t.fLead, v: totals.lead || 0 },
    { k: t.fBuy, v: totals.checkout_start || 0 },
    { k: t.fPaid, v: totals.checkout_done || 0 },
  ];
  const any = cells.some((c) => c.v > 0);
  return (
    <div className="rounded-xl border border-g-line bg-white/[0.04] p-4">
      <div className="text-[11px] font-black uppercase tracking-wider text-g-muted">{t.analytics}</div>
      {!any ? (
        <div className="mt-2 text-[12px] text-g-muted">{t.noData}</div>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {cells.map((c) => (
              <div key={c.k} className="rounded-lg border border-g-line bg-white/[0.03] px-2 py-2 text-center">
                <div className="text-[17px] font-black text-g-word">{c.v}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{c.k}</div>
              </div>
            ))}
          </div>
          {rows.length > 0 && (
            <div className="mt-2 space-y-1">
              {rows.slice(0, 6).map((r) => (
                <div key={r.product} className="flex items-center justify-between text-[12px]">
                  <span className="font-bold text-g-word">{r.product}</span>
                  <span className="text-g-muted">{r.views}v · {r.leads}l · {r.checkout_start}▸ · <span className="text-g-green font-bold">{r.checkout_done}✓</span></span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── brand kit strip ──────────────────────────────────────────────────────────
function BrandKit({ brand, colors, t }) {
  const facts = Array.isArray(brand.facts) ? brand.facts.slice(0, 4) : [];
  const services = Array.isArray(brand.services) ? brand.services.slice(0, 6) : [];
  return (
    <div className="rounded-xl border border-g-line bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <Logo brand={brand} colors={colors} size={44} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-black" style={{ color: colors.accent }}>{brand.name || "—"}</div>
          {brand.tagline && <div className="truncate text-[12px] text-g-muted">{brand.tagline}</div>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {[colors.primary, colors.accent].map((c, i) => <span key={i} className="h-5 w-5 rounded-full ring-1 ring-white/20" style={{ background: c }} title={c} />)}
        </div>
      </div>
      {(facts.length > 0 || services.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {facts.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">{t.facts}</div>
              <ul className="mt-1 space-y-0.5">{facts.map((f, i) => <li key={i} className="text-[12px] text-g-word">• {f}</li>)}</ul>
            </div>
          )}
          {services.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-g-muted">{t.services}</div>
              <div className="mt-1 flex flex-wrap gap-1">{services.map((s, i) => <span key={i} className="rounded-full border border-g-line px-2 py-0.5 text-[11px] text-g-word">{s}</span>)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Logo({ brand, colors, size = 40 }) {
  if (brand?.logo) return <img src={brand.logo} alt="" className="shrink-0 rounded-lg object-contain ring-1 ring-white/10" style={{ width: size, height: size, background: "#fff" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />;
  return <div className="grid shrink-0 place-items-center rounded-lg font-black text-black ring-1 ring-white/10" style={{ width: size, height: size, background: colors.accent, fontSize: size * 0.36 }}>{initialsOf(brand?.name)}</div>;
}

// ── preview switchboard ──────────────────────────────────────────────────────
function Preview({ product, brand, colors, t, lang }) {
  switch (product) {
    case "website": return <WebsitePreview brand={brand} colors={colors} t={t} lang={lang} />;
    case "app": return <AppPreview brand={brand} colors={colors} t={t} lang={lang} />;
    case "social": return <SocialPreview brand={brand} colors={colors} t={t} lang={lang} />;
    case "voice": return <VoicePreview brand={brand} colors={colors} t={t} lang={lang} />;
    case "ads": return <AdsPreview brand={brand} colors={colors} t={t} lang={lang} />;
    case "seo": return <SeoPreview brand={brand} colors={colors} t={t} lang={lang} />;
    case "email": return <EmailPreview brand={brand} colors={colors} t={t} lang={lang} />;
    default: return null;
  }
}

const Frame = ({ children }) => <div className="overflow-hidden rounded-xl border border-g-line bg-[#0f0e0c]">{children}</div>;

// Website assistant → browser-frame mock of their site + a chat widget that REVEALS the
// conversation step by step (typing dots, then booked) instead of sitting static. 2026-08-17
// (Luis: "bem mais elaborado"). Every line is built from brand data — no invented facts.
function WebsitePreview({ brand, colors, t, lang }) {
  const L = WEBSITE_LBL[lang] || WEBSITE_LBL.en;
  const agentName = brand?.agent_name || "Gui";
  const svc = firstPricedService(brand);
  const services = Array.isArray(brand.services) ? brand.services.slice(0, 3) : [];

  const script = useMemo(() => ([
    { who: "a", text: `${L.greetPre} ${agentName} ${L.greetPost}` },
    { who: "u", text: `${L.askPre} ${svc.name || brand.name}${L.askPost}` },
    { who: "a", text: `${svc.name ? svc.name + " — " : ""}${L.bookPitch}` },
    { who: "u", text: L.yes },
  ]), [L, agentName, svc.name, brand.name]);
  const [step, setStep] = useState(0);
  const done = step >= script.length;
  const chatRef = useRef(null);
  useEffect(() => { setStep(0); }, [script]);
  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => setStep((n) => n + 1), step === 0 ? 500 : 1300);
    return () => clearTimeout(id);
  }, [step, done, script]);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [step]);

  return (
    <Frame>
      {/* browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        <div className="ml-2 flex-1 truncate rounded-md bg-black/30 px-2 py-1 text-[11px] text-g-muted">🔒 {domainOf(brand)}</div>
      </div>
      <div className="relative min-h-[260px] p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${colors.primary}1c, ${colors.accent}0a)` }}>
        <Logo brand={brand} colors={colors} size={38} />
        <div className="mt-4 max-w-[60%] text-[19px] font-black leading-tight text-white sm:max-w-none">{brand.name}</div>
        {brand.tagline && <div className="mt-1 max-w-[60%] text-[12.5px] text-white/70 sm:max-w-sm">{brand.tagline}</div>}
        {services.length > 0 && (
          <div className="mt-3 flex max-w-[62%] flex-wrap gap-1.5 sm:max-w-none">
            {services.map((s, i) => <span key={i} className="truncate rounded-full border px-2 py-1 text-[10.5px] font-bold text-white/85" style={{ borderColor: colors.accent + "40", background: colors.accent + "12" }}>{s}</span>)}
          </div>
        )}
        <button className="mt-4 rounded-lg px-3.5 py-2 text-[12px] font-bold text-black" style={{ background: colors.accent }}>{services[0] || t.tapToBook}</button>

        {/* Gui chat widget overlay — revealing the conversation live */}
        <div className="absolute bottom-3 right-3 w-[calc(100%-1.5rem)] max-w-[220px] overflow-hidden rounded-xl border border-white/15 bg-[#161512] shadow-xl">
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: colors.accent }}>
            <span className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black/20 text-[12px]">💬</span>
            <span className="min-w-0 truncate text-[12px] font-black text-black">{agentName} · {brand.name}</span>
            <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-black/50" title={L.online} />
          </div>
          <div ref={chatRef} className="max-h-[170px] space-y-1.5 overflow-y-auto p-2.5">
            {script.slice(0, step).map((m, i) => <Bubble key={i} side={m.who} c={colors.accent}>{m.text}</Bubble>)}
            {!done && (
              <div className="flex gap-1 pl-1 pt-0.5">
                {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" style={{ animationDelay: `${i * 140}ms` }} />)}
              </div>
            )}
            {done && (
              <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.06] px-2 py-1.5 text-[10.5px] text-white/85" style={{ animation: "rise .4s ease both" }}>
                <span>✅</span><span className="min-w-0 truncate font-bold">{L.bookedTitle}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Bubble({ side, c, children }) {
  const a = side === "a";
  return <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] ${a ? "" : "ml-auto bg-white/10 text-white/80"}`} style={a ? { background: (c || "#FF8A33") + "26", color: "#fff" } : undefined}>{children}</div>;
}

// App/software → phone mockup themed in their brand: status bar, header, priced service cards,
// a "next appointment" card (when a priced service exists), bottom nav with a pulsing chat badge.
// 2026-08-17 (Luis: "bem mais elaborado"). Only real brand.services/tagline render — never invented.
function AppPreview({ brand, colors, t, lang }) {
  const L = APP_LBL[lang] || APP_LBL.en;
  const items = (brand.services && brand.services.length ? brand.services : []).slice(0, 3);
  const svc = firstPricedService(brand);
  const nav = [["🏠", L.navHome, true], ["📅", L.navBook, false], ["💬", L.navChat, false], ["👤", L.navYou, false]];
  return (
    <div className="grid place-items-center rounded-xl border border-g-line bg-white/[0.03] p-5">
      <div className="w-[200px] overflow-hidden rounded-[26px] border-[5px] border-black bg-[#0f0e0c] shadow-2xl">
        {/* status bar */}
        <div className="flex items-center justify-between px-3.5 pt-2 text-[9.5px] font-bold text-white/70">
          <span>9:41</span>
          <span className="flex items-center gap-1"><span>📶</span><span>🔋</span></span>
        </div>
        {/* header */}
        <div className="px-4 pb-4 pt-2" style={{ background: `linear-gradient(160deg, ${colors.primary}, ${colors.accent})` }}>
          <div className="flex items-center gap-2">
            <Logo brand={brand} colors={colors} size={26} />
            <span className="min-w-0 truncate text-[12px] font-black text-black">{brand.name}</span>
            <span className="relative ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black/15 text-[11px]">
              🔔<span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-red-500 ring-1 ring-white" />
            </span>
          </div>
          <div className="mt-2 truncate text-[10px] font-bold text-black/70">{brand.tagline || t.appHint}</div>
        </div>
        {/* body */}
        <div className="space-y-1.5 p-3">
          {svc.name && (
            <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: colors.accent + "55", background: colors.accent + "14" }}>
              <div className="text-[8.5px] font-black uppercase tracking-wide" style={{ color: colors.accent }}>{L.today} · {L.nextAppt}</div>
              <div className="mt-0.5 min-w-0 truncate text-[11px] font-bold text-white">{svc.name}</div>
            </div>
          )}
          {(items.length ? items : [t.tapToBook]).map((it, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-2">
              <span className="min-w-0 truncate text-[11px] text-white/85">{it}</span>
              <span className="shrink-0 text-[10px]" style={{ color: colors.accent }}>›</span>
            </div>
          ))}
          <button className="mt-1 w-full rounded-lg py-2 text-[11px] font-black text-black" style={{ background: colors.accent }}>{t.tapToBook}</button>
        </div>
        {/* bottom nav */}
        <div className="flex items-center justify-around border-t border-white/10 bg-black/40 px-2 py-2">
          {nav.map(([ic, lbl, active], i) => (
            <div key={i} className="relative flex flex-col items-center gap-0.5">
              <span className="text-[13px]" style={{ opacity: active ? 1 : 0.5, color: active ? colors.accent : undefined }}>{ic}</span>
              <span className="text-[7.5px] font-bold" style={{ color: active ? colors.accent : "rgba(255,255,255,.4)" }}>{lbl}</span>
              {i === 2 && <span className="absolute -top-0.5 right-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Instagram/social → IG-style card skinned with their @/logo + a DM that REVEALS the reply step by
// step, like a real conversation landing. Follower count only renders when brand.facts actually has
// one (never invented). 2026-08-17 (Luis: "bem mais elaborado").
function SocialPreview({ brand, colors, t, lang }) {
  const L = SOCIAL_LBL[lang] || SOCIAL_LBL.en;
  const agentName = brand?.agent_name || "Gui";
  const svc = firstPricedService(brand);
  const followerFact = Array.isArray(brand.facts) ? brand.facts.find((f) => /[\d,.]+\s*(k|m)?\s*(followers?|seguidores?)/i.test(f)) : null;
  const followerCount = followerFact ? (followerFact.match(/[\d,.]+\s*[km]?/i)?.[0] || null) : null;

  const script = useMemo(() => ([
    { who: "u", text: `${L.askPre} ${svc.name || brand.name} ${L.askPost}` },
    { who: "a", text: L.replyPitch },
    { who: "u", text: L.yes },
  ]), [L, svc.name, brand.name]);
  const [step, setStep] = useState(0);
  const done = step >= script.length;
  useEffect(() => { setStep(0); }, [script]);
  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => setStep((n) => n + 1), step === 0 ? 500 : 1300);
    return () => clearTimeout(id);
  }, [step, done, script]);

  return (
    <Frame>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <Logo brand={brand} colors={colors} size={32} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[12px] font-black text-white">{handleOf(brand)}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-g-muted">
            <span className="truncate">{brand.name}</span>
            {followerCount && <span className="shrink-0">· <b className="text-white/70">{followerCount}</b> {L.followers}</span>}
          </div>
        </div>
        <span className="ml-auto shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold text-black" style={{ background: colors.accent }}>{L.follow}</span>
      </div>
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="relative aspect-square" style={{ background: `linear-gradient(135deg, ${colors.primary}${i % 3 === 1 ? "cc" : "55"}, ${colors.accent}${i % 3 === 1 ? "66" : "22"})` }}>
            {i === 1 && <span className="absolute inset-0 grid place-items-center text-[15px]">✨</span>}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-2.5">
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.accent }}>
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" style={{ background: colors.accent }} />
          <span className="truncate">{L.dmLabel} · {agentName}</span>
        </div>
        <div className="space-y-1.5">
          {script.slice(0, step).map((m, i) => <Bubble key={i} side={m.who} c={colors.accent}>{m.text}</Bubble>)}
          {!done && (
            <div className="flex gap-1 pl-1 pt-0.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" style={{ animationDelay: `${i * 140}ms` }} />)}
            </div>
          )}
          {done && (
            <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.06] px-2 py-1.5 text-[10.5px] text-white/85" style={{ animation: "rise .4s ease both" }}>
              <span>✅</span><span className="min-w-0 truncate font-bold">{L.bookedTitle}</span>
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}

// Voice → CENA DE LIGAÇÃO, não cartão parado (2026-08-17, pedido do Luis: "o preview do produto
// bem mais elaborado"). O que vende voz é VER a conversa acontecer: a agente atende com o nome
// dela, cota o preço REAL por unidade vindo do cadastro, o cliente troca de idioma no meio e a
// agente troca junto (voz nativa — o recurso que nenhum concorrente mostra), fecha o agendamento
// e embaixo aparecem os COMPROVANTES que caem no cockpit. Roteiro montado dos dados do cliente:
// nada de "Acme": se o cadastro tem "Massage $118 Astoria · $132 UES", é isso que a cena fala.
const VOICE_LBL = {
  en: { live: "LIVE CALL — simulation", answers: "answering for", switch: "switched to Portuguese · native voice", switchEs: "switched to Spanish · native voice", afterTitle: "what lands in your cockpit — instantly", art1: "Booking confirmed", art2: "CRM updated · caller remembered", art3: "Branded confirmation sent", replay: "↺ Replay the call", c1: "Hi! How much is", c1b: "?", a2: "Which location works better for you?", c3: "Ah, você fala português?!", c3es: "Ah, ¿habla español?!", a3: "Falo, sim! Posso agendar agora — amanhã às 14h está ótimo?", a3es: "¡Claro que sí! Puedo agendarle ahora — ¿mañana a las 2pm le parece bien?", c4: "Perfeito! Meu nome é Ana.", c4es: "¡Perfecto! Mi nombre es Ana.", a5: "Agendado, Ana! A confirmação já está no seu celular. Até amanhã! ✨", a5es: "¡Agendado, Ana! La confirmación ya está en su celular. ¡Hasta mañana! ✨" },
  pt: { live: "LIGAÇÃO AO VIVO — simulação", answers: "atendendo pela", switch: "trocou para inglês · voz nativa", switchEs: "trocou para espanhol · voz nativa", afterTitle: "o que cai no seu cockpit — na hora", art1: "Agendamento confirmado", art2: "CRM atualizado · cliente lembrado", art3: "Confirmação com a sua marca enviada", replay: "↺ Ver a ligação de novo", c1: "Oi! Quanto custa", c1b: "?", a2: "Qual unidade fica melhor pra você?", c3: "Oh, do you speak English?!", c3es: "Ah, ¿habla español?!", a3: "Of course! I can book you right now — tomorrow at 2pm works?", a3es: "¡Claro que sí! Puedo agendarle ahora — ¿mañana a las 2pm?", c4: "Perfect! My name is Ana.", c4es: "¡Perfecto! Mi nombre es Ana.", a5: "Booked, Ana! The confirmation is on your phone. See you tomorrow! ✨", a5es: "¡Agendado, Ana! La confirmación ya está en su celular. ✨" },
  es: { live: "LLAMADA EN VIVO — simulación", answers: "atendiendo por", switch: "cambió a portugués · voz nativa", switchEs: "cambió a inglés · voz nativa", afterTitle: "lo que llega a su cockpit — al instante", art1: "Cita confirmada", art2: "CRM actualizado · cliente recordado", art3: "Confirmación con su marca enviada", replay: "↺ Ver la llamada de nuevo", c1: "¡Hola! ¿Cuánto cuesta", c1b: "?", a2: "¿Qué ubicación le queda mejor?", c3: "Ah, você fala português?!", c3es: "Oh, do you speak English?!", a3: "Falo, sim! Posso agendar agora — amanhã às 14h?", a3es: "Of course! Tomorrow at 2pm works?", c4: "Perfeito! Meu nome é Ana.", c4es: "Perfect! My name is Ana.", a5: "Agendado, Ana! A confirmação já está no seu celular. ✨", a5es: "Booked, Ana! The confirmation is on your phone. ✨" },
  hi: { live: "LIVE CALL — simulation", answers: "answering for", switch: "switched language · native voice", switchEs: "switched language · native voice", afterTitle: "what lands in your cockpit — instantly", art1: "Booking confirmed", art2: "CRM updated", art3: "Branded confirmation sent", replay: "↺ Replay the call", c1: "Hi! How much is", c1b: "?", a2: "Which location works better?", c3: "Ah, você fala português?!", c3es: "¿Habla español?", a3: "Falo, sim! Amanhã às 14h?", a3es: "¡Claro! ¿Mañana a las 2pm?", c4: "Meu nome é Ana.", c4es: "Mi nombre es Ana.", a5: "Agendado, Ana! ✨", a5es: "¡Agendado, Ana! ✨" },
};

// nome + preço do 1º serviço COM preço do cadastro (aceita string ou {name, price}).
function firstPricedService(brand) {
  const list = Array.isArray(brand?.services) ? brand.services : [];
  for (const it of list) {
    const name = typeof it === "string" ? it : it?.name || "";
    const price = typeof it === "string" ? "" : it?.price || "";
    if (name && /\$|R\$|€|\d/.test(String(price))) return { name, price: String(price) };
  }
  const f = list[0];
  return f ? { name: typeof f === "string" ? f : f?.name || "", price: "" } : { name: "", price: "" };
}

function VoicePreview({ brand, colors, t, lang }) {
  // A REAL call — the hardened /api/call gate (per-IP caps + DNC + E.164) dials the visitor and
  // Gui greets AS this brand via dynamic variables ({{business}}/{{need}}). Not a mock.
  const [phone, setPhone] = useState("");
  const [st, setSt] = useState("idle"); // idle | go | done | skipped | capped | err  (honest: only "done" = a call was actually placed)

  // REAL neural voice (ElevenLabs via /api/tts) speaking a line PERSONALIZED to this brand — so the
  // visitor hears "Gui" answering for THEIR business, in Victoria (♀) or Bruno (♂). Cached server-side.
  const [vVoice, setVVoice] = useState("victoria");
  const [vSt, setVSt] = useState("idle"); // idle | go | warm  (warm = tts non-200/empty, honest retry hint)
  const [vHide, setVHide] = useState(false); // 501 = voice not configured → hide the block, no fake success
  const audioRef = useRef(null);
  // stop any playing greeting when the visitor switches product (unmounts this preview).
  useEffect(() => () => { if (audioRef.current) { try { audioRef.current.pause(); audioRef.current.src = ""; } catch { /* */ } } }, []);
  const greeting = () => {
    const n = brand?.name || (lang === "en" ? "your business" : lang === "es" ? "su negocio" : "seu negócio");
    // a voz real cumprimenta com o NOME da agente deste cliente (Lilian…), não um "Gui" genérico
    const g = brand?.agent_name || "Gui";
    return lang === "en" ? `Hi! This is ${g}, answering for ${n}. How can I help you today?`
      : lang === "es" ? `¡Hola! Soy ${g}, atendiendo por ${n}. ¿Cómo puedo ayudarle hoy?`
      : lang === "hi" ? `नमस्ते! मैं ${g} हूँ, ${n} के लिए बात कर रही हूँ। मैं आपकी कैसे मदद कर सकती हूँ?`
      : `Oi! Aqui é a ${g}, atendendo pela ${n}. Como posso te ajudar hoje?`;
  };
  const playVoice = async (voice) => {
    setVVoice(voice); setVSt("go");
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: greeting(), voice, lang }) });
      // Honest micro-states — never a silent no-op. 501 = voice not wired → hide the whole block.
      // Any other non-200 (502, transient) → "voice warming up — tap again". Empty body → same.
      if (r.status === 501) { setVHide(true); setVSt("idle"); return; }
      if (!r.ok) { setVSt("warm"); return; }
      const blob = await r.blob();
      if (!blob || !blob.size) { setVSt("warm"); return; }
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { try { audioRef.current.pause(); } catch { /* */ } }
      const a = new Audio(url); audioRef.current = a;
      a.onended = () => { URL.revokeObjectURL(url); setVSt("idle"); };
      a.onerror = () => setVSt("warm");
      await a.play().catch(() => setVSt("warm"));
    } catch { setVSt("warm"); }
  };

  const placeCall = async (e) => {
    e?.preventDefault?.();
    const p = phone.trim();
    if (!p) return;
    setSt("go");
    try {
      const r = await fetch("/api/call", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: p,
          business: brand?.name || "",
          industry: (Array.isArray(brand?.services) && brand.services[0]) || "",
          need: `Demonstração da Gui para ${brand?.name || "o negócio"}`,
          lang,
        }),
      });
      // Never claim "calling now" unless a call was really placed. The gate returns
      // {ok:true, skipped:...} when a call was recently sent (no new dial), 429 when capped.
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.skipped) setSt("skipped");
      else if (r.ok && d?.ok) setSt("done");
      else if (r.status === 429) setSt("capped");
      else setSt("err");
    } catch { setSt("err"); }
  };
  // ── A CENA ────────────────────────────────────────────────────────────────
  // Roteiro montado dos DADOS deste cliente: agente com o nome dela, serviço e preço do cadastro,
  // troca de idioma no meio (pra ES no site em espanhol; pra PT nos demais). Revela passo a passo.
  const L = VOICE_LBL[lang] || VOICE_LBL.en;
  const agentName = brand?.agent_name || "Gui";
  const svc = firstPricedService(brand);
  const toEs = lang === "es"; // roteiro troca PARA a língua que falta demonstrar
  const script = useMemo(() => {
    const greet = lang === "es" ? `${brand.name}, ¡hola! Soy ${agentName} — ¿cómo puedo ayudarle?`
      : lang === "pt" ? `${brand.name}, oi! Aqui é a ${agentName} — como posso ajudar?`
      : `${brand.name}, hi! This is ${agentName} — how can I help?`;
    const priceLine = svc.price
      ? `${svc.name} — ${svc.price}. ${L.a2}`
      : `${svc.name || "Sure"} — ${L.a2}`;
    return [
      { who: "a", text: greet },
      { who: "c", text: `${L.c1} ${svc.name || "a massage"}${L.c1b}` },
      { who: "a", text: priceLine },
      { who: "c", text: toEs ? L.c3es : L.c3 },
      { who: "s", text: toEs ? `🌐 ${L.switchEs}` : `🌐 ${L.switch}` },
      { who: "a", text: toEs ? L.a3es : L.a3 },
      { who: "c", text: toEs ? L.c4es : L.c4 },
      { who: "a", text: toEs ? L.a5es : L.a5 },
    ];
  }, [lang, brand?.name, agentName, svc.name, svc.price, toEs]); // eslint-disable-line
  const [step, setStep] = useState(0);
  const done = step >= script.length;
  const chatRef = useRef(null);
  useEffect(() => { setStep(0); }, [script]);
  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => setStep((n) => n + 1), step === 0 ? 700 : 1500);
    return () => clearTimeout(id);
  }, [step, done, script]);
  useEffect(() => { // acompanha a conversa sem rolar a página inteira
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [step]);
  const speaking = !done && script[step - 1]?.who === "a";

  return (
    <div className="grid place-items-center rounded-xl border border-g-line p-4 sm:p-6" style={{ background: `radial-gradient(circle at 50% 0%, ${colors.accent}1e, transparent 70%)` }}>
      <div className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-[#0f0e0c] p-4 text-center sm:p-5">
        {/* topo da ligação: avatar pulsando enquanto a agente fala */}
        <div className="flex items-center gap-3 text-left">
          <div className="relative">
            <div className="grid h-12 w-12 place-items-center rounded-full text-[19px]" style={{ background: colors.accent }}>📞</div>
            {speaking && <span className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ background: colors.accent }} />}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-black text-white">{agentName} · {L.answers} {brand.name}</div>
            <div className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide" style={{ color: colors.accent }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: colors.accent }} /> {L.live}
            </div>
          </div>
          {/* forma de onda viva só quando a agente está falando */}
          <div className="flex h-7 items-end gap-[3px]">
            {[8, 16, 11, 22, 14].map((h, i) => (
              <span key={i} className="w-1 rounded-full transition-all duration-300"
                style={{ height: speaking ? h : 4, background: colors.accent, opacity: speaking ? 0.5 + (i % 3) * 0.22 : 0.25 }} />
            ))}
          </div>
        </div>

        {/* a conversa acontecendo */}
        <div ref={chatRef} className="mt-3 max-h-[240px] space-y-1.5 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/30 p-2.5 text-left">
          {script.slice(0, step).map((m, i) => m.who === "s" ? (
            <div key={i} className="my-1 text-center">
              <span className="inline-block rounded-full border px-2.5 py-1 text-[9.5px] font-black uppercase tracking-wide"
                style={{ borderColor: colors.accent + "66", color: colors.accent, background: colors.accent + "14" }}>{m.text}</span>
            </div>
          ) : (
            <Bubble key={i} side={m.who} c={colors.accent}>{m.text}</Bubble>
          ))}
          {!done && (
            <div className="flex gap-1 pl-1 pt-0.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/40" style={{ animationDelay: `${i * 140}ms` }} />)}
            </div>
          )}
        </div>

        {/* fechou a ligação → os COMPROVANTES no cockpit + replay */}
        {done && (
          <div className="mt-3 text-left">
            <div className="text-[9.5px] font-black uppercase tracking-wider text-white/45">{L.afterTitle}</div>
            <div className="mt-1.5 grid gap-1.5">
              {[["✅", L.art1], ["📇", L.art2], ["✉️", L.art3]].map(([ic, txt], i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/85"
                  style={{ animation: `rise .4s ease ${i * 0.15}s both` }}>
                  <span>{ic}</span><span className="font-bold">{txt}</span>
                  <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: colors.accent }} />
                </div>
              ))}
            </div>
            <button onClick={() => setStep(0)} className="mt-2 w-full rounded-lg border border-white/15 py-1.5 text-[11px] font-bold text-white/70 hover:text-white">{L.replay}</button>
          </div>
        )}

        {/* REAL neural voice — hear Gui greet AS this brand, Victoria (♀) or Bruno (♂).
            Hidden entirely if TTS isn't wired (501) — never a dead button that fakes success. */}
        {!vHide && (
          <div className="mt-3">
            <div className="text-[10px] font-black uppercase tracking-wide text-white/50">{t.hearReal}</div>
            <div className="mt-1.5 flex gap-1.5">
              {[{ k: "victoria", g: "♀", n: "Victoria" }, { k: "bruno", g: "♂", n: "Bruno" }].map((v) => (
                <button key={v.k} onClick={() => playVoice(v.k)} disabled={vSt === "go"}
                  className="flex-1 rounded-lg px-2 py-2 text-[12px] font-black text-black disabled:opacity-60"
                  style={{ background: vSt === "go" && vVoice === v.k ? "#9c9485" : colors.accent }}>
                  {vSt === "go" && vVoice === v.k ? `▊ ${t.voicePlaying}` : `▶ ${v.g} ${v.n}`}
                </button>
              ))}
            </div>
            {vSt === "warm" && <div className="mt-1.5 text-[11px] font-bold text-g-gold">{t.voiceWarm}</div>}
          </div>
        )}

        {/* REAL call trigger — honest states: green only when a call was truly placed. */}
        {st === "done" ? (
          <div className="mt-3 text-[12px] font-bold text-g-green">{t.callSent}</div>
        ) : st === "skipped" ? (
          <div className="mt-3 text-[12px] font-bold text-white/80">{t.callSkipped}</div>
        ) : (
          <form onSubmit={placeCall} className="mt-3 flex flex-col gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={t.callPh}
              className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white placeholder:text-white/40" />
            <button type="submit" disabled={st === "go" || !phone.trim()}
              className="rounded-lg px-3 py-2 text-[12px] font-black text-black disabled:opacity-50" style={{ background: colors.accent }}>
              {st === "go" ? t.calling : "📞 " + t.callNow}
            </button>
            {st === "err" && <span className="text-[11px] text-g-gold">{t.callErr}</span>}
            {st === "capped" && <span className="text-[11px] text-g-gold">{t.callCapped}</span>}
          </form>
        )}
      </div>
    </div>
  );
}

// Local i18n dict for the elevated Ads/SEO/Email scenes (2026-08-17, pedido do Luis:
// "100%, bem mais elaborado"). Placed here (not at file top) to keep the edit surgical
// while VoicePreview/WebsitePreview/AppPreview/SocialPreview are edited in parallel.
// Only real brand data (name/tagline/services/facts/logo/agent_name) fills the copy —
// no invented metrics (clicks/traffic/searches/ratings). Structural chrome (format
// names, generic sitelink words) is UI, not a claim about the client's data.
const ADS_LBL = {
  en: { sim: "simulation", google: "Google Search", meta: "Instagram / Meta", remarketing: "Retargeting", sponsored: "Sponsored", ad: "Ad", learnMore: "Learn more", shopNow: "Shop now", bookNow: "Book now", youViewed: "You recently viewed", site1: "Prices", site2: "Book now", site3: "Reviews", site4: "Contact", results: "results", profile: "Business profile", website: "Website", services: "Services", inbox: "Inbox", now: "now", yourAppt: "Booking details", service: "Service", signedBy: "with", poweredBy: "powered by Guileo", scene1: "Search ad", scene2: "Feed ad", scene3: "Retargeting card" },
  pt: { sim: "simulação", google: "Google (busca)", meta: "Instagram / Meta", remarketing: "Retargeting", sponsored: "Patrocinado", ad: "Anúncio", learnMore: "Saiba mais", shopNow: "Comprar agora", bookNow: "Agendar", youViewed: "Você viu recentemente", site1: "Preços", site2: "Agendar", site3: "Avaliações", site4: "Contato", results: "resultados", profile: "Perfil do negócio", website: "Site", services: "Serviços", inbox: "Caixa de entrada", now: "agora", yourAppt: "Detalhes do agendamento", service: "Serviço", signedBy: "por", poweredBy: "powered by Guileo", scene1: "Anúncio de busca", scene2: "Anúncio no feed", scene3: "Cartão de retargeting" },
  es: { sim: "simulación", google: "Google (búsqueda)", meta: "Instagram / Meta", remarketing: "Retargeting", sponsored: "Patrocinado", ad: "Anuncio", learnMore: "Saber más", shopNow: "Comprar ahora", bookNow: "Reservar", youViewed: "Viste recientemente", site1: "Precios", site2: "Reservar", site3: "Reseñas", site4: "Contacto", results: "resultados", profile: "Perfil del negocio", website: "Sitio web", services: "Servicios", inbox: "Bandeja de entrada", now: "ahora", yourAppt: "Detalles de la cita", service: "Servicio", signedBy: "por", poweredBy: "powered by Guileo", scene1: "Anuncio de búsqueda", scene2: "Anuncio en el feed", scene3: "Tarjeta de retargeting" },
  hi: { sim: "अनुकरण", google: "Google खोज", meta: "Instagram / Meta", remarketing: "रीटार्गेटिंग", sponsored: "प्रायोजित", ad: "विज्ञापन", learnMore: "और जानें", shopNow: "अभी खरीदें", bookNow: "बुक करें", youViewed: "आपने हाल ही में देखा", site1: "कीमतें", site2: "बुक करें", site3: "समीक्षाएं", site4: "संपर्क", results: "परिणाम", profile: "व्यवसाय प्रोफ़ाइल", website: "वेबसाइट", services: "सेवाएं", inbox: "इनबॉक्स", now: "अभी", yourAppt: "बुकिंग विवरण", service: "सेवा", signedBy: "द्वारा", poweredBy: "powered by Guileo", scene1: "खोज विज्ञापन", scene2: "फ़ीड विज्ञापन", scene3: "रीटार्गेटिंग कार्ड" },
};

// Ads → three RECOGNIZABLE formats (Google Search / Meta feed / retargeting), each
// built from the real first priced service — never invented traffic/click numbers.
function AdsPreview({ brand, colors, t, lang }) {
  const L = ADS_LBL[lang] || ADS_LBL.en;
  const svc = firstPricedService(brand);
  const svcLabel = svc.name || brand.name;
  const blurb = brand.tagline || (brand.facts && brand.facts[0]) || "";
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* 1 — Google Search ad */}
        <div className="min-w-0 rounded-xl border border-g-line bg-[#0f0e0c] p-3" style={{ animation: "rise .4s ease both" }}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-g-muted">
            <span className="rounded px-1 py-0.5 text-black" style={{ background: colors.accent }}>{L.ad}</span>
            <span className="truncate">{L.google}</span>
          </div>
          <div className="truncate text-[11px] text-white/50">{domainOf(brand)}</div>
          <div className="truncate text-[14px] font-bold leading-tight" style={{ color: colors.accent }}>{brand.name}{svcLabel ? ` — ${svcLabel}` : ""}{svc.price ? ` · ${svc.price}` : ""}</div>
          {blurb && <div className="mt-0.5 line-clamp-2 text-[11px] text-white/70">{blurb}</div>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-[10px]" style={{ color: colors.accent }}>
            <span className="truncate">{L.site1}</span><span className="truncate">{L.site2}</span><span className="truncate">{L.site3}</span><span className="truncate">{L.site4}</span>
          </div>
        </div>

        {/* 2 — Meta / Instagram feed ad */}
        <div className="min-w-0 overflow-hidden rounded-xl border border-g-line bg-[#0f0e0c]" style={{ animation: "rise .4s ease .06s both" }}>
          <div className="flex items-center gap-2 px-2.5 py-2">
            <Logo brand={brand} colors={colors} size={22} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[10.5px] font-black text-white">{handleOf(brand)}</div>
              <div className="text-[9px] text-g-muted">{L.sponsored}</div>
            </div>
          </div>
          <div className="grid h-24 place-items-center px-3 text-center" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` }}>
            <div className="text-[12px] font-black text-black">{svcLabel}{svc.price ? ` · ${svc.price}` : ""}</div>
          </div>
          <div className="p-2.5">
            {blurb && <div className="line-clamp-2 text-[10.5px] text-white/70">{blurb}</div>}
            <button className="mt-2 w-full rounded-md py-1.5 text-[10px] font-black text-black" style={{ background: colors.accent }}>{L.shopNow}</button>
          </div>
        </div>
      </div>

      {/* 3 — compact retargeting card */}
      <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-g-line bg-[#0f0e0c] p-2.5" style={{ animation: "rise .4s ease .12s both" }}>
        <Logo brand={brand} colors={colors} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-wide text-g-muted">{L.youViewed}</div>
          <div className="truncate text-[11.5px] font-bold text-white">{svcLabel}{svc.price ? ` · ${svc.price}` : ""}</div>
        </div>
        <button className="shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-black text-black" style={{ background: colors.accent }}>{L.bookNow}</button>
      </div>

      <div className="text-center text-[10px] font-black uppercase tracking-wide" style={{ color: colors.accent }}>{L.scene1} · {L.scene2} · {L.scene3} — {L.sim}</div>
    </div>
  );
}

// SEO → richer results page: real query, brand result #1 with sitelinks, blurred
// anonymous competitors, and a business-profile side card. No invented rank/volume.
function SeoPreview({ brand, colors, t, lang }) {
  const L = ADS_LBL[lang] || ADS_LBL.en;
  const city = (brand.facts && brand.facts.find((f) => /,|city|city:/i.test(f))) || "";
  const svc = firstPricedService(brand);
  const query = [svc.name || brand.name, city].filter(Boolean).join(" ");
  return (
    <Frame>
      <div className="flex flex-col gap-3 p-4 sm:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5">
            <span className="text-[11px] text-g-muted">🔎</span>
            <span className="truncate text-[11.5px] text-white/85">{query}</span>
          </div>
          <div className="mt-2 text-[9.5px] text-white/30">{t.seoCard} {city || domainOf(brand)}</div>

          <div className="mt-3 min-w-0 rounded-lg border p-2.5" style={{ borderColor: colors.accent + "55", background: colors.accent + "10", animation: "rise .4s ease both" }}>
            <span className="mb-1 inline-block rounded-full px-1.5 py-0.5 text-[8px] font-black text-black" style={{ background: colors.accent }}>#1</span>
            <div className="truncate text-[11px] text-white/60">{domainOf(brand)}</div>
            <div className="truncate text-[13px] font-black" style={{ color: colors.accent }}>{brand.name}{svc.name ? ` — ${svc.name}` : brand.tagline ? ` — ${brand.tagline}` : ""}</div>
            {brand.tagline && <div className="line-clamp-2 text-[11px] text-white/70">{brand.tagline}</div>}
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px]" style={{ color: colors.accent }}>
              <span className="truncate">{L.site1}</span><span className="truncate">{L.site2}</span><span className="truncate">{L.site3}</span><span className="truncate">{L.site4}</span>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            {[2, 3].map((n) => (
              <div key={n} className="rounded-lg border border-white/10 p-2 opacity-40">
                <div className="h-2 w-1/3 rounded bg-white/10" />
                <div className="mt-1 h-2 w-2/3 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="w-full shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:w-[150px]" style={{ animation: "rise .4s ease .08s both" }}>
          <div className="text-[9px] font-black uppercase tracking-wide text-g-muted">{L.profile}</div>
          <div className="mt-2 flex items-center gap-2">
            <Logo brand={brand} colors={colors} size={30} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[11px] font-black text-white">{brand.name}</div>
              {brand.tagline && <div className="truncate text-[9.5px] text-white/50">{brand.tagline}</div>}
            </div>
          </div>
          {Array.isArray(brand.services) && brand.services.length > 0 && (
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="text-[9px] font-black uppercase tracking-wide text-g-muted">{L.services}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {brand.services.slice(0, 3).map((s, i) => (
                  <span key={i} className="truncate rounded-full border border-white/10 px-1.5 py-0.5 text-[9.5px] text-white/70">{typeof s === "string" ? s : s?.name}</span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 truncate border-t border-white/10 pt-2 text-[9.5px] text-white/40">🌐 {L.website} · {domainOf(brand)}</div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-2 text-center text-[10px] font-black uppercase tracking-wide" style={{ color: colors.accent }}>{L.sim}</div>
    </Frame>
  );
}

// Email/content → a real inbox row + the branded email itself, with a booking-details
// block signed by the client's own agent_name when the brand has one.
function EmailPreview({ brand, colors, t, lang }) {
  const L = ADS_LBL[lang] || ADS_LBL.en;
  const svc = firstPricedService(brand);
  const subject = svc.name || brand.tagline || brand.name;
  const preview = brand.tagline || (brand.facts && brand.facts[0]) || "";
  return (
    <Frame>
      <div className="border-b border-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-g-muted">📥 {L.inbox}</div>
      <div className="flex min-w-0 items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2.5" style={{ animation: "rise .35s ease both" }}>
        <Logo brand={brand} colors={colors} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[11.5px] font-black text-white">{brand.name}</span>
            <span className="ml-auto shrink-0 text-[9.5px] text-white/30">{L.now}</span>
          </div>
          <div className="truncate text-[11px] font-bold text-white/85">✨ {subject}</div>
          {preview && <div className="truncate text-[10.5px] text-white/40">{preview}</div>}
        </div>
      </div>

      <div className="px-4 pt-2.5 text-[10px] text-g-muted">
        <span className="text-white/50">{lang === "pt" ? "De" : lang === "es" ? "De" : lang === "hi" ? "प्रेषक" : "From"}:</span> <span className="text-white/70">{brand.name} &lt;hello@{domainOf(brand)}&gt;</span>
      </div>

      <div className="p-4" style={{ animation: "rise .35s ease .08s both" }}>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="flex items-center gap-2 px-3.5 py-3" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` }}>
            <Logo brand={brand} colors={colors} size={26} />
            <span className="truncate text-[13px] font-black text-black">{brand.name}</span>
          </div>
          <div className="bg-[#151310] p-3.5">
            <div className="text-[12px] leading-relaxed text-white/80">{t.emailCard} — {brand.tagline || brand.name}.</div>

            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
              <div className="text-[9px] font-black uppercase tracking-wide" style={{ color: colors.accent }}>{L.yourAppt}</div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-white/50">{L.service}</span>
                <span className="truncate font-bold text-white/90">{svc.name || brand.name}{svc.price ? ` · ${svc.price}` : ""}</span>
              </div>
            </div>

            <button className="mt-3 w-full rounded-lg py-2 text-[11px] font-black text-black" style={{ background: colors.accent }}>{svc.name || L.bookNow}</button>

            {brand.agent_name && <div className="mt-3 text-[10.5px] text-white/40">— {brand.agent_name}, {L.signedBy} {brand.name}</div>}
            <div className="mt-3 border-t border-white/10 pt-2 text-[9px] text-white/30">{L.poweredBy}</div>
          </div>
        </div>
      </div>
    </Frame>
  );
}
