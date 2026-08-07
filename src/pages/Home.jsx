import { useEffect, lazy, Suspense } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import ExitIntent from "../components/ExitIntent.jsx";
import LiveCall from "../components/LiveCall.jsx";
import Intro from "../components/Intro.jsx";
import LeadForm from "../components/LeadForm.jsx";
import StickyCtaMobile from "../components/StickyCtaMobile.jsx";
import { Reveal, Magnetic, Accordion } from "../lib/ui.jsx";
import HeroV2 from "../components/HeroV2";
import ResultsV2 from "../components/ResultsV2";
import PillarsProducts from "../components/PillarsProducts.jsx";
import LegsV2 from "../components/LegsV2";
import ChannelsStrip from "../components/ChannelsStrip.jsx";
import MethodV2 from "../components/MethodV2";
import ProofV2 from "../components/ProofV2";
import FounderProof from "../components/FounderProof";
import PulseSection from "../components/PulseSection"; // GUILEO PULSE — standalone XM/satisfaction product wedge ($49/mo flat)
import CallSimulator from "../components/CallSimulator.jsx";
import TrustStrip from "../components/TrustStrip.jsx";
import PricingTiers from "../components/PricingTiers.jsx";
import PricingConfigurator from "../components/PricingConfigurator";
import AddOnsV2 from "../components/AddOnsV2";
import { waLink, bookLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";

// Personalized-brand demo (heavy: AI brand pull + preview surfaces) — lazy so it ships as its own
// chunk and never bloats the landing's first paint. The visitor types their site → sees THEIR
// business with Gui → becomes a captured lead feeding the onboarding funnel.
const DemoEngine = lazy(() => import("../components/DemoEngine.jsx"));


/* Shared section header — the LegsV2/MethodV2 pattern: mono uppercase champagne eyebrow
   → big font-black headline (one shimmer phrase) → short greige sub. One language everywhere. */
function SectionHead({ eyebrow, h2, sub, className = "mb-10", subMax = "max-w-xl" }) {
  return (
    <Reveal className={`mx-auto max-w-2xl text-center ${className}`}>
      <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{eyebrow}</div>
      <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
        <span className="bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{h2}</span>
      </h2>
      {sub && <p className={`mx-auto mt-4 ${subMax} text-[15px] leading-relaxed text-g-ink`}>{sub}</p>}
    </Reveal>
  );
}

/* Primary CTA — the silver/platinum pill from LegsV2 (the approved primary-CTA language). */
function SilverCta({ href = "#contact", children }) {
  return (
    <a href={href} className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3 text-[14px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
      style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
      <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
      <span className="relative">{children}</span>
      <span className="relative text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
    </a>
  );
}

export default function Home() {
  const { t, lang } = useLang();
  useSeo({
    title: lang === "pt" ? "Guileo — Soluções Inteligentes para o seu Negócio · IA que atende, agenda e vende 24/7" : lang === "es" ? "Guileo — Soluciones Inteligentes para tu Negocio · IA que atiende, agenda y vende 24/7" : "Guileo — Intelligent Solutions for Your Business · AI that Answers, Books & Sells 24/7",
    description: lang === "pt" ? "Sua IA Guileo atende ligações, responde mensagens, agenda e fecha vendas 24/7 em 16 idiomas. No ar em até 7 dias. A partir de $149/mês, 30 dias de garantia." : lang === "es" ? "Tu IA Guileo atiende llamadas, responde mensajes, agenda y cierra ventas 24/7 en 16 idiomas. En marcha en 7 días. Desde $149/mes, 30 días de garantía." : "Your Guileo AI answers calls, replies to messages, books appointments and closes sales 24/7 in 16 languages. Live in 7 days. From $149/mo, 30-day money-back.",
    path: "/",
  });
  // FAQPage JSON-LD built from the SAME items the Accordion renders, so the schema always matches
  // the visible FAQ (Google's requirement) and can surface FAQ rich results in search.
  useEffect(() => {
    const items = t?.faq?.items || [];
    if (!items.length) return;
    const ld = {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: items.map(([q, a]) => ({
        "@type": "Question", name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "home-faq-jsonld";
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
    return () => { document.getElementById("home-faq-jsonld")?.remove(); };
  }, [t]);

  // Cross-page anchors (/#try from 404/planos/navbar on another route): Home is lazy-loaded, so the
  // browser's native anchor jump fires before the section exists. Scroll once the content mounts.
  useEffect(() => {
    const id = (window.location.hash || "").slice(1);
    if (!id) return;
    // small retry loop — sections below the hero mount progressively
    let tries = 0;
    const tick = setInterval(() => {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); clearInterval(tick); }
      else if (++tries > 20) clearInterval(tick);
    }, 150);
    return () => clearInterval(tick);
  }, []);
  return (
    <div className="min-h-screen text-g-ink">
      <Intro />
      <Navbar />

      {/* ── Tightened single-buyer funnel: Hook → Problem/Result → Solution → How → Proof → Demo → Offer → Close ── */}
      <HeroV2 />              {/* Hook — never miss a call, a lead, or a sale */}
      <TrustStrip />          {/* Honest trust bar HIGH on the page — money-back · human-supervised · 7-day launch · 20+ langs */}
      <ResultsV2 />          {/* Problem + promise — you buy results; here's the leak (id=industries anchor) */}
      <LegsV2 />             {/* The WHY — the 3 pillars own performance / sales / growth (the emotional spine) */}
      <PillarsProducts />    {/* The WHAT — each pillar's REAL products → result → value (replaces WholePicture + old ProductResults; aligns landing to the platform) */}
      <ChannelsStrip />      {/* Reach — a slim logo strip (folded from the old full ChannelsV2 phone section) */}

      {/* SEE-IT-ON-YOUR-BRAND — the personalized visual demo as a landing lead magnet. Visitor types
          their site → sees their own business with Gui → captured as a lead. Feeds the onboarding funnel. */}
      <section id="veja" className="relative px-5 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(620px_320px_at_50%_0%,rgba(255,138,51,0.08),transparent)]" />
        <div className="mx-auto max-w-3xl">
          <SectionHead
            eyebrow={lang === "pt" ? "🪄 VEJA NA SUA MARCA" : lang === "es" ? "🪄 VELO EN TU MARCA" : lang === "hi" ? "🪄 अपनी ब्रांड में देखें" : "🪄 SEE IT ON YOUR BRAND"}
            h2={lang === "pt" ? "Veja sua empresa com a Gui — em segundos" : lang === "es" ? "Mira tu empresa con Gui — en segundos" : lang === "hi" ? "अपना व्यवसाय Gui के साथ देखें — सेकंडों में" : "See your business with Gui — in seconds"}
            sub={lang === "pt" ? "Digite seu site ou @ — montamos uma prévia na sua marca na hora." : lang === "es" ? "Escribe tu sitio o @ — armamos una vista previa en tu marca al instante." : lang === "hi" ? "अपनी साइट या @ डालें — हम तुरंत आपकी ब्रांड में प्रीव्यू बनाते हैं।" : "Type your site or @ — we build a preview in your brand instantly."}
            className="mb-6" subMax="max-w-2xl" />
          <Reveal>
            <Suspense fallback={<div className="rounded-2xl border border-g-line bg-white/[0.03] p-8 text-center text-[13px] text-g-muted">…</div>}>
              <DemoEngine surface="public" />
            </Suspense>
          </Reveal>
        </div>
      </section>

      <MethodV2 />           {/* How you start — live in under 7 days, human-led */}
      <ProofV2 />            {/* Trust badges, right before the demo + offer */}
      <FounderProof />       {/* Founder note + (future) real client quotes — the human voice before the demo */}
      <PulseSection />       {/* GUILEO PULSE — standalone satisfaction/XM product wedge ($49/mo flat vs Birdeye/Qualtrics) */}
      <CallSimulator />      {/* Hear-Gui teaser — moved next to the climax so the page crescendos ONCE (sim → Faena → real call) */}

      {/* FAENA MOMENT — a luxe divider + dramatic line that hands the stage to Gui */}
      <Reveal variant="scale" className="relative wrap py-14 text-center">
        <div className="mx-auto h-px w-40 bg-gradient-to-r from-transparent via-g-gold/55 to-transparent" />
        <p className="mt-7 mx-auto max-w-2xl font-black leading-[1.05] tracking-tight" style={{ fontSize: "clamp(1.5rem,3.4vw,2.4rem)" }}>
          <span className="text-g-word">{lang === "pt" ? "Agora pare de ler. " : lang === "es" ? "Ahora deja de leer. " : lang === "hi" ? "अब पढ़ना बंद करें। " : "Now stop reading. "}</span>
          <span style={{ color: "#FF8A33", textShadow: "0 0 30px rgba(255,138,51,0.40)" }}>{lang === "pt" ? "Deixe a Gui te ligar." : lang === "es" ? "Deja que Gui te llame." : lang === "hi" ? "Gui को आपको कॉल करने दें।" : "Let Gui call you."}</span>
        </p>
        <div className="mt-7 mx-auto h-px w-40 bg-gradient-to-r from-transparent via-g-gold/55 to-transparent" />
      </Reveal>

      {/* LIVE DEMO — "Let Gui call you": the product working live + a sales-ready lead */}
      <section id="try" className="relative px-5 py-20">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.10),transparent)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(520px_280px_at_50%_8%,rgba(255,138,51,0.07),transparent)]" />
        <SectionHead eyebrow={t.numbers.calleyebrow} h2={t.numbers.callh2} className="mb-8" />
        <LiveCall />
      </section>

      {/* ADD-ONS — moved ABOVE pricing: client sees the full menu of power-ups (one screen) BEFORE the price */}
      <AddOnsV2 />

      {/* REAL PRICE — the 3 canonical tiers with the actual number (audit: the price was hidden on /planos) */}
      <PricingTiers />

      {/* BUILD-YOUR-PACKAGE — the interactive configurator to tailor + close */}
      <section id="build" className="wrap py-12">
        <SectionHead
          eyebrow={lang === "pt" ? "👆 MONTE O SEU PACOTE" : lang === "es" ? "👆 ARMA TU PAQUETE" : "👆 BUILD YOUR PACKAGE"}
          h2={lang === "pt" ? "Toque e veja seu plano nascer" : lang === "es" ? "Toca y mira tu plan armarse" : "Tap and watch your plan build itself"}
          sub={lang === "pt" ? "Escolha o que quer crescer — o Gui monta o pacote, os créditos e o ROI na hora." : lang === "es" ? "Elige lo que quieres crecer — Gui arma el paquete, créditos y ROI al instante." : "Pick what you want to grow — Gui assembles the package, credits and ROI live."}
          className="mb-6" subMax="max-w-2xl" />

        {/* Build-your-package configurator — the interactive STAR (old full-menu chip block removed: the add-ons section above already shows the menu, and this lets the builder fit one screen) */}
        <Reveal><PricingConfigurator /></Reveal>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          {[["🔌",t.pricing.cap1||"Plugs into your whole stack","border-g-green/45 bg-g-green/[0.12] text-g-green"],["📞",t.pricing.cap2||"Answers 24/7, any language","border-g-gold/45 bg-g-gold/[0.12] text-g-gold"],["🚀",t.pricing.cap3||"Live in 7 days","border-sky-400/45 bg-sky-500/[0.12] text-sky-300"],["🛡️",t.pricing.cap4||"30-day money-back","border-fuchsia-400/45 bg-fuchsia-500/[0.12] text-fuchsia-300"]].map(([ic,tx,cls],i)=>(
            <span key={tx} className={`inline-flex animate-pulse items-center gap-1.5 rounded-full border px-4 py-2 font-bold ${cls}`} style={{ animationDuration: "2.4s", animationDelay: `${i * 0.45}s` }}>{ic} {tx}</span>
          ))}
        </div>
      </section>

      {/* COMPARISON — moved below pricing (decide on price, then see why Guileo wins) */}
      <section className="wrap py-20">
        <SectionHead eyebrow={t.more.comp.eyebrow} h2={t.more.comp.h2} sub={t.more.comp.sub} className="mb-3" subMax="max-w-2xl" />
        <p className="text-center text-[11px] text-g-muted mb-7">{lang === "pt" ? "✅ = faz bem · ⚠️ = em parte · ❌ = não faz — " : lang === "es" ? "✅ = lo hace bien · ⚠️ = en parte · ❌ = no lo hace — " : lang === "hi" ? "✅ = अच्छे से करता है · ⚠️ = आंशिक · ❌ = बिल्कुल नहीं — " : "✅ = does it well · ⚠️ = partly · ❌ = not at all — "}<span className="text-g-light">{lang === "pt" ? "olhe a coluna verde, é a Guileo" : lang === "es" ? "mira la columna verde, es Guileo" : lang === "hi" ? "हरे कॉलम को देखें, वही Guileo है" : "scan the green column, that's Guileo"}</span></p>
        <Reveal>
          <div className="overflow-x-auto rounded-xl3 border border-white/15 bg-gradient-to-br from-white/[0.10] to-white/[0.05] backdrop-blur-xl shadow-lift">
            <table className="w-full text-sm min-w-full md:min-w-[640px]">
              <thead>
                <tr>
                  {t.more.comp.cols.map((c, i) => (
                    <th key={i} scope="col" className={`p-4 text-left font-extrabold ${i === 1 ? "bg-g-green/15 border-b-2 border-g-green/40 text-g-word rounded-t-xl relative after:absolute after:inset-0 after:rounded-t-xl after:shadow-[inset_0_0_30px_rgba(62,148,104,0.18)] after:animate-glowpulse after:pointer-events-none" : "text-g-muted"}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.more.comp.rows.map((r, i) => (
                  <tr key={i} className="border-t border-g-line transition-colors duration-300 hover:bg-white/[0.04]">
                    {r.map((cell, j) => (
                      <td key={j} className={`p-4 ${j === 0 ? "font-semibold text-g-word" : j === 1 ? "bg-g-green/[0.06] text-center font-bold text-g-light" : "text-center text-g-muted"}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <div className="text-center mt-8"><Magnetic><SilverCta>{t.more.comp.cta}</SilverCta></Magnetic></div>
      </section>

      {/* CTA + LEAD CAPTURE (capture the lead while intent is hot) */}
      <section id="contact" className="wrap py-20 scroll-mt-24">
        <div className="rounded-xl3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 sm:p-12 shadow-lift relative overflow-hidden">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-g-green/15 blur-3xl animate-aurora pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-g-gold/15 blur-3xl animate-aurora pointer-events-none" style={{ animationDelay: "-6s" }} />
          <div className="relative max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.more.lead.title}</div>
              <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
                <span className="bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{t.final.h2}</span>
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-g-ink max-w-xl mx-auto">{t.more.lead.sub}</p>
            </div>
            <div className="mt-7"><LeadForm source="final-cta" /></div>
            <div className="mt-6 flex items-center gap-3 text-xs text-g-muted">
              <div className="h-px flex-1 bg-g-line" />{t.final.sub}<div className="h-px flex-1 bg-g-line" />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a href={waLink(t.more.lead.wamsg)} target="_blank" rel="noopener" className="btn-ghost text-sm">{t.final.wa}</a>
              <a href={bookLink()} target="_blank" rel="noopener" className="btn-ghost text-sm">{t.final.demo}</a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — last, right before the closing manifesto */}
      <section id="faq" className="wrap pb-20">
        <SectionHead eyebrow={t.faq.eyebrow} h2={t.faq.h2} className="mb-8" />
        <Accordion items={t.faq.items} />
        <div className="mt-8 text-center">
          <a href="#try" onClick={(e)=>{ e.preventDefault(); document.getElementById("try")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
            className="btn-bright inline-flex"><span className="relative flex h-2 w-2 mr-1"><span className="absolute inline-flex h-full w-full rounded-full bg-black/40 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-black/60" /></span>📞 {lang === "pt" ? "Ainda tem dúvidas? Deixe a Gui te ligar" : lang === "es" ? "¿Aún tienes dudas? Deja que Gui te llame" : lang === "hi" ? "अब भी सवाल हैं? Gui से कॉल करवाएँ" : "Still have questions? Let Gui call you"}</a>
        </div>
      </section>

      {/* MANIFESTO — the closing line that sells the dream */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-g-gold/[0.04] to-transparent pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-g-green/10 blur-3xl pointer-events-none animate-breathe" />
        <Reveal variant="scale" className="relative wrap text-center max-w-3xl mx-auto">
          <span className="text-5xl text-g-gold/40 leading-none">“</span>
          <p className="mt-1 text-2xl sm:text-4xl font-black leading-tight tracking-tight bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
            {t.manifesto.quote}
          </p>
          <p className="mt-5 text-sm sm:text-base font-bold text-g-light">{t.manifesto.tag}</p>
          <div className="mt-6 mx-auto h-px w-24 bg-gradient-to-r from-transparent via-g-gold/60 to-transparent" />
          <div className="mt-3 text-xs font-bold uppercase tracking-[0.3em] text-g-muted">Guileo</div>
        </Reveal>
      </section>

      <Footer />
      {/* spacer so the mobile sticky CTA never covers the footer's last line (safe-area) */}
      <div aria-hidden className="h-20 sm:hidden" />
      <VoiceAgent />
      <ExitIntent />
      <StickyCtaMobile />
    </div>
  );
}
