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
    hearReal: "Hear the real voice", voicePlaying: "Playing…",
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
    hearReal: "Ouvir a voz real", voicePlaying: "Tocando…",
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
    hearReal: "Escuchar la voz real", voicePlaying: "Reproduciendo…",
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
    hearReal: "असली आवाज़ सुनें", voicePlaying: "चल रहा है…",
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

async function callDemo(action, payload) {
  const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
  if (!r.ok) throw new Error("demo " + action + " " + r.status);
  return r.json();
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
    try {
      const d = await callDemo("brand", { query: q });
      if (d?.brand) { const nb = normBrand(d.brand); setBrand(nb); setPullState("idle"); logView(nb, product); }
      else setPullState("err");
    } catch { setPullState("err"); }
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
          {pullState === "go" ? t.pulling : t.pull}
        </button>
        {brand && <button onClick={resetBrand} className="rounded-xl border border-g-line px-3 py-2.5 text-[12px] font-bold text-g-muted hover:text-g-word">↺ {t.reset}</button>}
      </div>
      {pullState === "err" && <div className="mt-2 text-[12px] text-g-gold">{t.pullErr}</div>}

      {/* ── BRAND KIT ── */}
      {brand && (
        <div className="mt-5 space-y-5">
          <BrandKit brand={brand} colors={colors} t={t} />

          {/* product picker */}
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-g-muted">{t.pick}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRODUCTS.map((p) => {
                const on = product === p.id;
                return (
                  <button key={p.id} onClick={() => openProduct(p.id)}
                    className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition"
                    style={on
                      ? { borderColor: colors.accent, background: colors.accent + "22", color: "var(--g-word,#efe9df)" }
                      : { borderColor: "rgba(255,255,255,.12)", color: "#9a9186" }}>
                    {p.icon} {p.label[lang] || p.label.en}
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
    case "website": return <WebsitePreview brand={brand} colors={colors} t={t} />;
    case "app": return <AppPreview brand={brand} colors={colors} t={t} />;
    case "social": return <SocialPreview brand={brand} colors={colors} t={t} lang={lang} />;
    case "voice": return <VoicePreview brand={brand} colors={colors} t={t} lang={lang} />;
    case "ads": return <AdsPreview brand={brand} colors={colors} t={t} />;
    case "seo": return <SeoPreview brand={brand} colors={colors} t={t} />;
    case "email": return <EmailPreview brand={brand} colors={colors} t={t} />;
    default: return null;
  }
}

const Frame = ({ children }) => <div className="overflow-hidden rounded-xl border border-g-line bg-[#0f0e0c]">{children}</div>;

// Website assistant → browser-frame mock of their site + Gui chat widget overlay.
function WebsitePreview({ brand, colors, t }) {
  return (
    <Frame>
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        <div className="ml-2 flex-1 truncate rounded-md bg-black/30 px-2 py-1 text-[11px] text-g-muted">🔒 {domainOf(brand)}</div>
      </div>
      <div className="relative min-h-[220px] p-6" style={{ background: `linear-gradient(135deg, ${colors.primary}14, ${colors.accent}0a)` }}>
        <Logo brand={brand} colors={colors} size={38} />
        <div className="mt-4 text-[20px] font-black leading-tight text-white">{brand.name}</div>
        {brand.tagline && <div className="mt-1 max-w-sm text-[13px] text-white/70">{brand.tagline}</div>}
        <button className="mt-4 rounded-lg px-3.5 py-2 text-[12px] font-bold text-black" style={{ background: colors.accent }}>{(brand.services && brand.services[0]) || "Book now"}</button>

        {/* Gui chat widget overlay, themed to accent */}
        <div className="absolute bottom-3 right-3 w-[210px] overflow-hidden rounded-xl border border-white/15 bg-[#161512] shadow-xl">
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: colors.accent }}>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-black/20 text-[12px]">💬</span>
            <span className="text-[12px] font-black text-black">{brand.name}</span>
          </div>
          <div className="space-y-1.5 p-2.5">
            <Bubble side="a" c={colors.accent}>{t.chat.hi}</Bubble>
            <Bubble side="u">{t.chat.u}</Bubble>
            <Bubble side="a" c={colors.accent}>{t.chat.a}</Bubble>
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

// App/software → phone mockup themed in their brand.
function AppPreview({ brand, colors, t }) {
  const items = (brand.services && brand.services.length ? brand.services : ["Home", "Bookings", "Offers", "Account"]).slice(0, 4);
  return (
    <div className="grid place-items-center rounded-xl border border-g-line bg-white/[0.03] p-5">
      <div className="w-[190px] overflow-hidden rounded-[26px] border-[5px] border-black bg-[#0f0e0c] shadow-2xl">
        <div className="px-4 pb-4 pt-3" style={{ background: `linear-gradient(160deg, ${colors.primary}, ${colors.accent})` }}>
          <div className="flex items-center gap-2">
            <Logo brand={brand} colors={colors} size={26} />
            <span className="text-[12px] font-black text-black">{brand.name}</span>
          </div>
          <div className="mt-2 text-[10px] font-bold text-black/70">{t.appHint}</div>
        </div>
        <div className="space-y-1.5 p-3">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-2">
              <span className="text-[11px] text-white/85">{it}</span>
              <span className="text-[10px]" style={{ color: colors.accent }}>›</span>
            </div>
          ))}
          <button className="mt-1 w-full rounded-lg py-2 text-[11px] font-black text-black" style={{ background: colors.accent }}>{t.tapToBook}</button>
        </div>
      </div>
    </div>
  );
}

// Instagram/social → IG-style card skinned with their @/logo + a DM answered by "their brain".
function SocialPreview({ brand, colors, t, lang }) {
  const dm = (brand.facts && brand.facts[0]) || (brand.tagline || "");
  return (
    <Frame>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <Logo brand={brand} colors={colors} size={30} />
        <div className="leading-tight">
          <div className="text-[12px] font-black text-white">{handleOf(brand)}</div>
          <div className="text-[10px] text-g-muted">{brand.name}</div>
        </div>
        <span className="ml-auto rounded-md px-2 py-1 text-[10px] font-bold text-black" style={{ background: colors.accent }}>Follow</span>
      </div>
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {[0, 1, 2].map((i) => <div key={i} className="aspect-square" style={{ background: `linear-gradient(135deg, ${colors.primary}${i === 1 ? "cc" : "66"}, ${colors.accent}${i === 1 ? "66" : "22"})` }} />)}
      </div>
      <div className="border-t border-white/10 p-2.5">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.accent }}>💬 DM · {t.dm}</div>
        <div className="space-y-1.5">
          <Bubble side="u">{t.chat.u}</Bubble>
          <Bubble side="a" c={colors.accent}>{dm ? `${t.chat.a} (${dm})` : t.chat.a}</Bubble>
        </div>
      </div>
    </Frame>
  );
}

// Voice → call-card mock "Gui answering for {brand}".
function VoicePreview({ brand, colors, t, lang }) {
  // A REAL call — the hardened /api/call gate (per-IP caps + DNC + E.164) dials the visitor and
  // Gui greets AS this brand via dynamic variables ({{business}}/{{need}}). Not a mock.
  const [phone, setPhone] = useState("");
  const [st, setSt] = useState("idle"); // idle | go | done | err

  // REAL neural voice (ElevenLabs via /api/tts) speaking a line PERSONALIZED to this brand — so the
  // visitor hears "Gui" answering for THEIR business, in Victoria (♀) or Bruno (♂). Cached server-side.
  const [vVoice, setVVoice] = useState("victoria");
  const [vSt, setVSt] = useState("idle"); // idle | go
  const audioRef = useRef(null);
  // stop any playing greeting when the visitor switches product (unmounts this preview).
  useEffect(() => () => { if (audioRef.current) { try { audioRef.current.pause(); audioRef.current.src = ""; } catch { /* */ } } }, []);
  const greeting = () => {
    const n = brand?.name || (lang === "en" ? "your business" : lang === "es" ? "su negocio" : "seu negócio");
    return lang === "en" ? `Hi! This is Gui, answering for ${n}. How can I help you today?`
      : lang === "es" ? `¡Hola! Soy Gui, atendiendo por ${n}. ¿Cómo puedo ayudarle hoy?`
      : lang === "hi" ? `नमस्ते! मैं Gui हूँ, ${n} के लिए बात कर रही हूँ। मैं आपकी कैसे मदद कर सकती हूँ?`
      : `Oi! Aqui é a Gui, atendendo pela ${n}. Como posso te ajudar hoje?`;
  };
  const playVoice = async (voice) => {
    setVVoice(voice); setVSt("go");
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: greeting(), voice, lang }) });
      if (!r.ok) { setVSt("idle"); return; }
      const url = URL.createObjectURL(await r.blob());
      if (audioRef.current) { try { audioRef.current.pause(); } catch { /* */ } }
      const a = new Audio(url); audioRef.current = a;
      a.onended = () => { URL.revokeObjectURL(url); setVSt("idle"); };
      a.onerror = () => setVSt("idle");
      await a.play().catch(() => setVSt("idle"));
    } catch { setVSt("idle"); }
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
      setSt(r.ok ? "done" : "err");
    } catch { setSt("err"); }
  };
  return (
    <div className="grid place-items-center rounded-xl border border-g-line p-6" style={{ background: `radial-gradient(circle at 50% 0%, ${colors.accent}1e, transparent 70%)` }}>
      <div className="w-full max-w-[320px] rounded-2xl border border-white/10 bg-[#0f0e0c] p-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: colors.accent }}>
          <span className="text-[22px]">📞</span>
        </div>
        <div className="mt-3 text-[13px] font-black text-white">{t.callFor} {brand.name}</div>
        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: colors.accent }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: colors.accent }} /> {t.ringing}
        </div>
        <div className="mt-3 flex items-end justify-center gap-1">
          {[10, 20, 14, 26, 18, 30, 16, 22, 12].map((h, i) => <span key={i} className="w-1.5 rounded-full" style={{ height: h, background: colors.accent, opacity: 0.4 + (i % 3) * 0.25 }} />)}
        </div>
        <div className="mt-3 rounded-lg bg-white/[0.05] px-3 py-2 text-left text-[11px] text-white/80">“{brand.name}, {t.chat.hi} {t.chat.a}”</div>

        {/* REAL neural voice — hear Gui greet AS this brand, Victoria (♀) or Bruno (♂) */}
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
        </div>

        {/* REAL call trigger */}
        {st === "done" ? (
          <div className="mt-3 text-[12px] font-bold text-g-green">{t.callSent}</div>
        ) : (
          <form onSubmit={placeCall} className="mt-3 flex flex-col gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={t.callPh}
              className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] text-white placeholder:text-white/40" />
            <button type="submit" disabled={st === "go" || !phone.trim()}
              className="rounded-lg px-3 py-2 text-[12px] font-black text-black disabled:opacity-50" style={{ background: colors.accent }}>
              {st === "go" ? t.calling : "📞 " + t.callNow}
            </button>
            {st === "err" && <span className="text-[11px] text-g-gold">{t.callErr}</span>}
          </form>
        )}
      </div>
    </div>
  );
}

// Ads → branded preview cards.
function AdsPreview({ brand, colors, t }) {
  const svc = (brand.services && brand.services[0]) || brand.name;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-g-line bg-[#0f0e0c]">
          <div className="grid h-20 place-items-center" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})` }}>
            <Logo brand={brand} colors={colors} size={30} />
          </div>
          <div className="p-2.5">
            <div className="text-[11px] font-black text-white">{brand.name}</div>
            <div className="mt-0.5 line-clamp-2 text-[10.5px] text-white/70">{["✨ " + svc, "📍 " + (brand.tagline || svc), "⭐ " + svc][i]}</div>
            <button className="mt-2 w-full rounded-md py-1.5 text-[10px] font-black text-black" style={{ background: colors.accent }}>Learn more</button>
          </div>
        </div>
      ))}
      <div className="sm:col-span-3 text-center text-[11px] font-bold" style={{ color: colors.accent }}>3 {t.adCard} · {brand.name}</div>
    </div>
  );
}

// SEO → branded ranking-page card.
function SeoPreview({ brand, colors, t }) {
  const city = (brand.facts && brand.facts.find((f) => /,|city|city:/i.test(f))) || "";
  return (
    <Frame>
      <div className="p-4">
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.accent }}>🔎 {t.seoCard} {city || domainOf(brand)}</div>
        <div className="mt-2 space-y-2">
          <div className="rounded-lg border p-2.5" style={{ borderColor: colors.accent + "55", background: colors.accent + "10" }}>
            <div className="text-[11px] text-white/60">{domainOf(brand)}</div>
            <div className="text-[13px] font-black" style={{ color: colors.accent }}>{brand.name} — {(brand.services && brand.services[0]) || brand.tagline || ""}</div>
            <div className="text-[11px] text-white/70">⭐⭐⭐⭐⭐ · {brand.tagline || brand.name}</div>
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-black text-black" style={{ background: colors.accent }}>#1</span>
          </div>
          {[2, 3].map((n) => <div key={n} className="rounded-lg border border-white/10 p-2 opacity-50"><div className="text-[10px] text-white/40">competitor{n}.com</div><div className="h-2 w-2/3 rounded bg-white/10" /></div>)}
        </div>
      </div>
    </Frame>
  );
}

// Email/content → branded email preview.
function EmailPreview({ brand, colors, t }) {
  return (
    <Frame>
      <div className="border-b border-white/10 px-4 py-2.5 text-[11px] text-g-muted">
        <div><span className="text-white/50">From:</span> <span className="text-white/85">{brand.name} &lt;hello@{domainOf(brand)}&gt;</span></div>
        <div><span className="text-white/50">Subject:</span> <span className="font-bold text-white">✨ {(brand.services && brand.services[0]) || brand.tagline || brand.name}</span></div>
      </div>
      <div className="p-4" style={{ background: `linear-gradient(180deg, ${colors.primary}0f, transparent)` }}>
        <div className="flex items-center gap-2"><Logo brand={brand} colors={colors} size={28} /><span className="text-[13px] font-black" style={{ color: colors.accent }}>{brand.name}</span></div>
        <div className="mt-3 text-[12px] leading-relaxed text-white/80">{t.emailCard} — {brand.tagline || brand.name}.</div>
        <button className="mt-3 rounded-lg px-3.5 py-2 text-[11px] font-black text-black" style={{ background: colors.accent }}>{(brand.services && brand.services[0]) || "Book now"}</button>
        <div className="mt-3 text-[9px] text-white/30">powered by Guileo</div>
      </div>
    </Frame>
  );
}
