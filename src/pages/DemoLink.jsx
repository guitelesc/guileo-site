// PERSONALIZED DEMO LINK — /demo/:slug
// ─────────────────────────────────────────────────────────────────────────────
// SELLER URL FORMAT (copy-paste — no tooling needed, the slug is display-only):
//
//   https://guileoai.com/demo/<business-slug>?n=<ProspectFirstName>&v=<vertical>&s=<SellerName>
//
//   Examples:
//     https://guileoai.com/demo/pizzaria-do-tony?n=Tony&v=restaurant&s=Patricia
//     https://guileoai.com/demo/smile-dental?n=Dra.%20Ana&v=dental&lang=pt
//
//   Params (all optional except the slug):
//     n    = prospect first name             (personalizes the headline + the call)
//     b    = business name                   (defaults to the de-slugified slug)
//     v    = vertical key — one of: restaurant · dental · clinic/medical · law ·
//            realestate · plumbing/hvac · auto · gym · ecommerce · salon · spa ·
//            cleaning · accountants · contractors · veterinary
//            (the full SEO slugs like "dental-clinics" also work)
//     s    = seller name                     (shows "enviado por {s}")
//     lang = en | pt | es | hi               (forces the page language)
//
// The prospect only types their PHONE + consent → POST /api/call with name/business/
// industry/need pre-filled from the URL, so Gui calls them already knowing everything.
// No dedicated backend needed: /api/call already accepts name/business/industry/need/lang.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { SEO_VERTICALS } from "../data/seoVerticals.js";
import { trackLead, trackStartDemo } from "../lib/analytics.js";
import { NOME_DO_PAINEL } from "../portal/nome.js";

const DIAL = [["🇺🇸", "+1"], ["🇧🇷", "+55"], ["🇵🇹", "+351"], ["🇪🇸", "+34"], ["🇬🇧", "+44"], ["🇲🇽", "+52"], ["🇦🇷", "+54"], ["🇮🇳", "+91"], ["🇦🇺", "+61"]];

// ?v= key → { seo: SEO_VERTICALS slug, portalV: cockpit vertical id, industry: /api/call label }
const V_MAP = {
  restaurant: { seo: "restaurants", portalV: "restaurant", industry: "Restaurant" },
  restaurants: { seo: "restaurants", portalV: "restaurant", industry: "Restaurant" },
  dental: { seo: "dental-clinics", portalV: "clinic", industry: "Clinic / Dental" },
  "dental-clinics": { seo: "dental-clinics", portalV: "clinic", industry: "Clinic / Dental" },
  clinic: { seo: "medical-clinics", portalV: "medical", industry: "Medical" },
  medical: { seo: "medical-clinics", portalV: "medical", industry: "Medical" },
  "medical-clinics": { seo: "medical-clinics", portalV: "medical", industry: "Medical" },
  law: { seo: "law-firms", portalV: "law", industry: "Law Firm" },
  "law-firms": { seo: "law-firms", portalV: "law", industry: "Law Firm" },
  realestate: { seo: "real-estate", portalV: "realestate", industry: "Real Estate" },
  "real-estate": { seo: "real-estate", portalV: "realestate", industry: "Real Estate" },
  plumbing: { seo: "plumbing-hvac", portalV: "homeservices", industry: "Home Services" },
  hvac: { seo: "plumbing-hvac", portalV: "homeservices", industry: "Home Services" },
  "plumbing-hvac": { seo: "plumbing-hvac", portalV: "homeservices", industry: "Home Services" },
  auto: { seo: "auto-dealerships", portalV: "auto", industry: "Auto" },
  "auto-dealerships": { seo: "auto-dealerships", portalV: "auto", industry: "Auto" },
  gym: { seo: "gyms-fitness", portalV: "gym", industry: "Gym & Fitness" },
  "gyms-fitness": { seo: "gyms-fitness", portalV: "gym", industry: "Gym & Fitness" },
  ecommerce: { seo: "ecommerce", portalV: "ecommerce", industry: "E-Commerce" },
  salon: { seo: "salons-spas", portalV: "salon", industry: "Salon & Spa" },
  "salons-spas": { seo: "salons-spas", portalV: "salon", industry: "Salon & Spa" },
  spa: { seo: "spas", portalV: "salon", industry: "Salon & Spa" },
  spas: { seo: "spas", portalV: "salon", industry: "Salon & Spa" },
  cleaning: { seo: "cleaning-services", portalV: "homeservices", industry: "Home Services" },
  "cleaning-services": { seo: "cleaning-services", portalV: "homeservices", industry: "Home Services" },
  accountants: { seo: "accountants", portalV: "law", industry: "Other" },
  contractors: { seo: "home-contractors", portalV: "construction", industry: "Construction" },
  "home-contractors": { seo: "home-contractors", portalV: "construction", industry: "Construction" },
  veterinary: { seo: "veterinary-clinics", portalV: "medical", industry: "Medical" },
  "veterinary-clinics": { seo: "veterinary-clinics", portalV: "medical", industry: "Medical" },
};

const D_COPY = {
  en: {
    ready: "Your Gui is ready · prepared for", knows: (n, b) => <>{n ? `${n}, ` : ""}Gui already knows how to answer for <span className="text-g-word">{b}</span>.</>,
    sentBy: (s) => `sent by ${s}`,
    promiseHead: "What Gui will show you on this call:",
    phone: "Your phone", cc: "Country code", call: "📞 Have Gui call me now →", connecting: "Connecting…",
    consent: "I agree to receive one automated demo call from Guileo at this number. Consent isn't a condition of purchase; message/data rates may apply.",
    consentErr: "Please check the consent box so Gui can call you.",
    doneT: "Gui is calling you now — pick up!", doneD: (b) => `And yes — it already knows it's answering for ${b}.`,
    webT: "Got your number ✓", webD: "Gui will ring you back in a moment.",
    panelCta: "See your business in the dashboard →",
    panelSub: `Open the ${NOME_DO_PAINEL} already set up for your business type.`,
    privacy: "No spam. One call to prove it works. Opt out anytime.",
    bridgeT: "So — did you like it? 🌱",
    bridgeD: (b) => `Gui can answer JUST like that for ${b}, starting today — plans from $149/mo, 30-day money-back.`,
    bridgeBtn: "See plans →", bridgeAlt: "Prefer a human to call you?",
  },
  pt: {
    ready: "Sua Gui está pronta · preparada para", knows: (n, b) => <>{n ? `${n}, ` : ""}a Gui já sabe atender <span className="text-g-word">{b}</span>.</>,
    sentBy: (s) => `enviado por ${s}`,
    promiseHead: "O que a Gui vai te mostrar nessa ligação:",
    phone: "Seu telefone", cc: "Código do país", call: "📞 Quero que a Gui me ligue agora →", connecting: "Conectando…",
    consent: "Concordo em receber uma ligação automática de demonstração da Guileo neste número. O consentimento não é condição de compra; podem aplicar tarifas.",
    consentErr: "Marque a caixa de consentimento para a Gui poder te ligar.",
    doneT: "A Gui está te ligando agora — atende!", doneD: (b) => `E sim — ela já sabe que está atendendo pela ${b}.`,
    webT: "Recebemos seu número ✓", webD: "A Gui te liga de volta já já.",
    panelCta: "Veja seu negócio no painel →",
    panelSub: `Abra a ${NOME_DO_PAINEL} já configurada para o seu tipo de negócio.`,
    privacy: "Sem spam. Uma ligação pra provar. Saia quando quiser.",
    bridgeT: "E aí, gostou? 🌱",
    bridgeD: (b) => `Ela pode atender ASSIM pela ${b} ainda hoje — planos a partir de $149/mês, 30 dias de garantia.`,
    bridgeBtn: "Ver planos →", bridgeAlt: "Prefere que um humano te ligue?",
  },
  es: {
    ready: "Tu Gui está lista · preparada para", knows: (n, b) => <>{n ? `${n}, ` : ""}Gui ya sabe contestar por <span className="text-g-word">{b}</span>.</>,
    sentBy: (s) => `enviado por ${s}`,
    promiseHead: "Lo que Gui te mostrará en esta llamada:",
    phone: "Tu teléfono", cc: "Código de país", call: "📞 Que Gui me llame ahora →", connecting: "Conectando…",
    consent: "Acepto recibir una llamada automática de demostración de Guileo a este número. El consentimiento no es condición de compra; pueden aplicar tarifas.",
    consentErr: "Marca la casilla de consentimiento para que Gui pueda llamarte.",
    doneT: "Gui te está llamando ahora — ¡contesta!", doneD: (b) => `Y sí — ya sabe que está contestando por ${b}.`,
    webT: "Recibimos tu número ✓", webD: "Gui te llama de vuelta en un momento.",
    panelCta: "Ve tu negocio en el panel →",
    panelSub: `Abre la ${NOME_DO_PAINEL} ya configurada para tu tipo de negocio.`,
    privacy: "Sin spam. Una llamada para probarlo. Sal cuando quieras.",
    bridgeT: "¿Y? ¿Te gustó? 🌱",
    bridgeD: (b) => `Gui puede contestar ASÍ por ${b} desde hoy — planes desde $149/mes, 30 días de garantía.`,
    bridgeBtn: "Ver planes →", bridgeAlt: "¿Prefieres que te llame un humano?",
  },
  hi: {
    ready: "आपकी Gui तैयार है · इनके लिए प्रशिक्षित", knows: (n, b) => <>{n ? `${n}, ` : ""}Gui को पहले से पता है <span className="text-g-word">{b}</span> के लिए कैसे जवाब देना है।</>,
    sentBy: (s) => `${s} द्वारा भेजा गया`,
    promiseHead: "इस कॉल पर Gui आपको क्या दिखाएगी:",
    phone: "आपका फ़ोन", cc: "देश कोड", call: "📞 Gui अभी मुझे कॉल करे →", connecting: "कनेक्ट हो रहा है…",
    consent: "मैं इस नंबर पर Guileo से एक स्वचालित डेमो कॉल प्राप्त करने के लिए सहमत हूँ। सहमति खरीद की शर्त नहीं है; मैसेज/डेटा शुल्क लागू हो सकते हैं।",
    consentErr: "कृपया सहमति बॉक्स चेक करें ताकि Gui आपको कॉल कर सके।",
    doneT: "Gui अभी आपको कॉल कर रही है — उठाएँ!", doneD: (b) => `और हाँ — उसे पहले से पता है कि वह ${b} के लिए जवाब दे रही है।`,
    webT: "आपका नंबर मिल गया ✓", webD: "Gui कुछ ही पलों में आपको कॉल करेगी।",
    panelCta: "डैशबोर्ड में अपना व्यवसाय देखें →",
    panelSub: `आपके व्यवसाय के प्रकार के लिए पहले से सेट ${NOME_DO_PAINEL} खोलें।`,
    privacy: "कोई स्पैम नहीं। साबित करने के लिए एक कॉल। जब चाहें ऑप्ट-आउट करें।",
    bridgeT: "तो — कैसा लगा? 🌱",
    bridgeD: (b) => `Gui आज से ही ${b} के लिए ठीक ऐसे ही जवाब दे सकती है — प्लान $149/माह से, 30-दिन मनी-बैक।`,
    bridgeBtn: "प्लान देखें →", bridgeAlt: "चाहते हैं कोई इंसान आपको कॉल करे?",
  },
};

const deslug = (s) => (s || "").replace(/[-_]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());

export default function DemoLink() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { lang, setLang } = useLang();

  // ?lang= forces the page language (the seller knows the prospect)
  useEffect(() => {
    const q = (sp.get("lang") || "").toLowerCase();
    if (["en", "pt", "es", "hi"].includes(q) && q !== lang) setLang(q);
  }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const L = D_COPY[lang] || D_COPY.en;
  const langKey = D_COPY[lang] ? lang : "en";

  const prospect = (sp.get("n") || "").slice(0, 60);
  const business = (sp.get("b") || deslug(slug) || "your business").slice(0, 120);
  const seller = (sp.get("s") || "").slice(0, 60);
  const vKey = (sp.get("v") || "").toLowerCase().trim();
  const vm = V_MAP[vKey] || null;
  const vert = useMemo(() => (vm ? SEO_VERTICALS.find((x) => x.slug === vm.seo) : null), [vm]);

  useSeo({ title: `${business} + Gui · Guileo`, description: "A personalized live demo: Gui calls you already knowing your business.", path: `/demo/${slug || ""}` });

  const [cc, setCc] = useState(lang === "pt" ? "+55" : "+1");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState(false);
  const [state, setState] = useState("idle"); // idle · calling · done · web
  const [bridge, setBridge] = useState(false); // demo→pricing bridge: warms in ~45s after the call fires

  // ~45s after the call fires (the prospect just heard Gui live), surface the next step: plans.
  // Timer cleared on unmount; never shows before the call.
  useEffect(() => {
    if (state !== "done" && state !== "web") return;
    const id = setTimeout(() => setBridge(true), 45000);
    return () => clearTimeout(id);
  }, [state]);

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) { setErr(true); return; }
    setErr(false); setState("calling");
    trackStartDemo(); trackLead();
    const full = `${cc} ${phone}`.trim();
    const industry = vm?.industry || "";
    const need = `Personalized seller demo${seller ? ` (sent by ${seller})` : ""} — show how Gui answers for ${business}${vert ? ` (${vert.name.en})` : ""}`;
    // record the lead (noCall:true — we dial below ourselves through the hardened /api/call gate)
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: prospect, phone: full, business, industry, message: need, consent, source: "demo-link", ref: seller || undefined, lang, noCall: true }) }).catch(() => {});
    try {
      const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: prospect, phone: full, business, industry, need, lang }) });
      if (r.ok) { setState("done"); return; }
      throw new Error("no backend");
    } catch { setState("web"); }
  };

  // FEATURE 2 — assisted trial: open the Growth Cockpit pre-seeded with THIS business.
  // We write the exact localStorage keys the Portal's demo login + OnboardingWizard write
  // (see src/pages/Portal.jsx demoEnter + OnboardingWizard onDone), then deep-link ?v=<vid>
  // (Portal reads ?v= on boot). pending_onboard carries the business name so it auto-applies
  // the moment the prospect connects a real account.
  const openCockpit = () => {
    const vid = vm?.portalV || "restaurant";
    try {
      localStorage.setItem("guileo_portal_session", JSON.stringify({ email: "demo@guileoai.com", name: prospect || business, role: "Owner", demo: true, at: Date.now() }));
      localStorage.setItem("guileo_onboarded", "1");
      localStorage.setItem("guileo_state_vertical", JSON.stringify(vid));
      localStorage.setItem("guileo_state_pending_onboard", JSON.stringify({ vid, extra: { name: business, owner: prospect, contact: "" }, at: Date.now() }));
    } catch { /* private mode — the ?v= deep-link still lands them on the right vertical */ }
    navigate(`/portal?v=${vid}`);
  };

  const field = "rounded-full border border-white/20 bg-black/25 px-5 py-3 text-base text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition w-full";

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />
      <section className="relative px-5 pt-32 pb-20">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(255,138,51,0.09),transparent)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(520px_280px_at_50%_20%,rgba(62,148,104,0.08),transparent)]" />
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-white/20 bg-gradient-to-br from-g-green/25 to-g-gold/15 shadow-soft">
            <img src={mark} alt="Gui" className="h-11 w-11 object-contain drop-shadow" />
          </div>
          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.26em] text-g-gold">
            {vert ? `${vert.icon} ` : ""}{L.ready} {vert ? (vert.name[langKey] || vert.name.en) : business}
          </div>
          <h1 className="mt-3 font-black leading-[1.02] tracking-tight text-g-word" style={{ fontSize: "clamp(1.7rem,5vw,2.7rem)" }}>
            {L.knows(prospect, business)}
          </h1>
          {vert && <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-g-ink">{vert.sub[langKey] || vert.sub.en}</p>}
          {seller && <p className="mt-3 text-xs font-semibold text-g-muted">✉️ {L.sentBy(seller)}</p>}

          {vert && (
            <div className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left">
              <div className="text-[10px] font-black uppercase tracking-wide text-g-muted">{L.promiseHead}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(vert.acts || []).map((a) => (
                  <span key={a} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-g-word">{a}</span>
                ))}
              </div>
              <p className="mt-3 text-[12px] font-semibold" style={{ color: "#FF8A33" }}>{vert.result[langKey] || vert.result.en}</p>
            </div>
          )}

          {/* THE one input — their phone */}
          <div className="mx-auto mt-7 max-w-md">
            {state === "done" ? (
              <div role="status" className="rounded-3xl bg-g-green/10 border border-g-green/25 p-5 text-center">
                <div className="text-3xl">📞</div>
                <div className="mt-1 font-bold text-g-word">{L.doneT}</div>
                <div className="mt-1 text-sm text-g-muted">{L.doneD(business)}</div>
                <button onClick={openCockpit} className="btn-bright mt-4 inline-flex text-sm">{L.panelCta}</button>
                <p className="mt-2 text-[11px] text-g-muted">{L.panelSub}</p>
                {bridge && (
                  <div className="mt-4 rounded-2xl border border-white/15 bg-white/[0.05] p-4 text-center">
                    <div className="font-bold text-g-word">{L.bridgeT}</div>
                    <p className="mt-1 text-sm text-g-muted">{L.bridgeD(business)}</p>
                    <a href="/planos" className="btn-bright mt-3 inline-flex text-sm">{L.bridgeBtn}</a>
                    <div><a href="/#contact" className="mt-2 inline-block text-[12px] font-semibold text-g-muted underline underline-offset-2 hover:text-g-word transition">{L.bridgeAlt}</a></div>
                  </div>
                )}
              </div>
            ) : state === "web" ? (
              <div role="status" className="rounded-3xl bg-g-gold/10 border border-g-gold/25 p-5 text-center">
                <div className="text-3xl">✅</div>
                <div className="mt-1 font-bold text-g-word">{L.webT}</div>
                <div className="mt-1 text-sm text-g-muted">{L.webD}</div>
                <button onClick={openCockpit} className="btn-bright mt-4 inline-flex text-sm">{L.panelCta}</button>
                {bridge && (
                  <div className="mt-4 rounded-2xl border border-white/15 bg-white/[0.05] p-4 text-center">
                    <div className="font-bold text-g-word">{L.bridgeT}</div>
                    <p className="mt-1 text-sm text-g-muted">{L.bridgeD(business)}</p>
                    <a href="/planos" className="btn-bright mt-3 inline-flex text-sm">{L.bridgeBtn}</a>
                    <div><a href="/#contact" className="mt-2 inline-block text-[12px] font-semibold text-g-muted underline underline-offset-2 hover:text-g-word transition">{L.bridgeAlt}</a></div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-3">
                <div className="flex gap-2">
                  <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label={L.cc} className={`${field} w-auto pr-2`}>
                    {DIAL.map(([f, c], i) => <option key={c + i} value={c} className="bg-g-deep">{f} {c}</option>)}
                  </select>
                  <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={L.phone} placeholder={L.phone} className={field} />
                </div>
                {/* TCPA consent — REQUIRED, unchecked by default (same gate as LiveCall) */}
                <label className={`flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-left text-[11px] leading-snug transition ${err && !consent ? "border-g-gold/70 bg-g-gold/10 text-g-word" : "border-white/15 bg-white/[0.04] text-g-muted"}`}>
                  <input type="checkbox" required checked={consent}
                    onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setErr(false); }}
                    aria-invalid={err && !consent} className="mt-0.5 h-4 w-4 shrink-0 accent-g-green" />
                  <span>{L.consent}</span>
                </label>
                {err && !consent && <p role="alert" className="text-center text-[12px] font-semibold text-g-gold">{L.consentErr}</p>}
                <button disabled={state === "calling" || !consent} className="btn-bright text-base disabled:opacity-70 disabled:cursor-not-allowed" style={{ boxShadow: "0 0 32px -4px rgba(255,138,51,0.45)" }}>
                  {state === "calling" ? L.connecting : L.call}
                </button>
                <p className="text-[11px] text-g-muted">{L.privacy}</p>
                {/* second door in: skip the call, explore the cockpit seeded with this business */}
                <button type="button" onClick={openCockpit} className="mt-1 py-2.5 text-[12px] font-bold text-g-muted hover:text-g-word transition">{L.panelCta}</button>
              </form>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
