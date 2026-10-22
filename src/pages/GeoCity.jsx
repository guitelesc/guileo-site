import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import QuoteModal from "../components/QuoteModal";
import Footer from "../components/Footer";
import { planByKey } from "../data/guileoPlans.js";
import VoiceAgent from "../components/VoiceAgent";
import ExitIntent from "../components/ExitIntent.jsx";
import LiveCall from "../components/LiveCall.jsx";
import PricingConfigurator from "../components/PricingConfigurator";
import { Reveal, Magnetic, Accordion } from "../lib/ui.jsx";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { getSeoCity, SEO_CITIES } from "../data/seoCities.js";
import { SEO_VERTICALS } from "../data/seoVerticals.js";

// Local-SEO landing per city (/ai-receptionist/:city). Reuses the live demo + package builder so each
// city page is fully conversion-ready, with GENUINELY local copy (not a thin doorway page).
export default function GeoCity({ intent = "receptionist" } = {}) {
  const { city: citySlug } = useParams();
  const c = getSeoCity(citySlug);
  const { lang, t } = useLang();
  const L = (o) => (o && (o[lang] || o.en)) || "";
  const leadgen = intent === "leadgen"; // /lead-generation/:city — same conversion body, lead-gen SEO + headline
  const [quote, setQuote] = useState(null);

  const lgTitle = c && { pt: `Geração de Leads para Negócio Local em ${c.city} | Guileo`, es: `Generación de Leads para Negocio Local en ${c.city} | Guileo`, en: `Lead Generation for Local Business in ${c.city} | Guileo` };
  const lgDesc = c && { pt: `A IA da Guileo capta e faz follow-up de CADA lead 24/7 para negócios em ${c.city}: retorno em 60s (speed-to-lead), texto em ligação perdida, reativação. No ar em 7 dias.`, es: `La IA de Guileo capta y da seguimiento a CADA lead 24/7 para negocios en ${c.city}: devolución en 60s, texto en llamada perdida, reactivación. En 7 días.`, en: `Guileo's AI captures and follows up EVERY lead 24/7 for ${c.city} local businesses — 60-second speed-to-lead callbacks, missed-call text-back, reactivation. Live in 7 days.` };

  useSeo({
    title: c ? (leadgen ? L(lgTitle) : L(c.seoTitle)) : (leadgen ? "Lead Generation for Local Business | Guileo" : "AI Receptionist for your city | Guileo"),
    description: c ? (leadgen ? L(lgDesc) : L(c.seoDesc)) : "Guileo's AI captures, books and follows up every lead 24/7 for local businesses.",
    path: c ? `${leadgen ? "/lead-generation" : "/ai-receptionist"}/${c.slug}` : (leadgen ? "/lead-generation" : "/ai-receptionist"),
  });

  // Per-page JSON-LD: Service scoped to this city (+ LocalBusiness for our HQ city). Removed on unmount.
  useEffect(() => {
    if (!c) return;
    const graph = [{
      "@context": "https://schema.org", "@type": "Service",
      name: `Guileo AI receptionist in ${c.city}`,
      serviceType: "AI voice agent, WhatsApp & SMS answering, booking, lead capture and follow-up",
      areaServed: { "@type": "City", name: c.areaServed },
      provider: { "@type": "Organization", name: "Guileo", url: "https://guileoai.com" },
      description: L(c.seoDesc),
      offers: { "@type": "Offer", priceCurrency: "USD", price: String(planByKey("starter").amount), description: `Self-service from $${planByKey("starter").amount}/mo; tailored done-for-you quoted per business.` },
    }];
    if (c.hq) {
      graph.push({
        "@context": "https://schema.org", "@type": "LocalBusiness",
        name: "Guileo", url: "https://guileoai.com",
        areaServed: c.areaServed,
        address: { "@type": "PostalAddress", addressLocality: c.city, addressRegion: c.region, addressCountry: c.country },
        description: "AI receptionist and growth automation for local businesses — multilingual (16 languages), 24/7.",
      });
    }
    const faqItems = t?.faq?.items || [];
    if (faqItems.length) graph.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqItems.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "geo-jsonld";
    s.textContent = JSON.stringify(graph);
    document.head.appendChild(s);
    return () => { document.getElementById("geo-jsonld")?.remove(); };
  }, [c, lang]);

  if (!c) return <Navigate to="/servicos" replace />;

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      {/* HERO — local pitch */}
      <section className="relative overflow-hidden px-5 pt-24 pb-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1100px_500px_at_72%_-10%,rgba(62,148,104,0.12),transparent),radial-gradient(700px_360px_at_8%_15%,rgba(214,194,154,0.06),transparent)]" />
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-g-gold">
            <span className="text-base">{c.flag}</span> {leadgen ? `${lang === "pt" ? "Geração de leads" : lang === "es" ? "Generación de leads" : "Lead generation"} · ${c.city}` : c.city}
            {c.hq && <span className="rounded-full bg-g-green/15 px-2 py-[1px] text-[9px] text-g-green">{lang === "pt" ? "Escritório local" : lang === "es" ? "Oficina local" : "Local office"}</span>}
          </span>
          <h1 className="mt-5 text-3xl font-black leading-[1.06] tracking-tight text-g-word sm:text-[2.9rem]">{leadgen ? L({ pt: `Mais leads em ${c.city} — capturados e respondidos em 60 segundos`, es: `Más leads en ${c.city} — capturados y respondidos en 60 segundos`, en: `More leads in ${c.city} — captured and answered in 60 seconds` }) : L(c.h1)}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-g-light/85 sm:text-lg">{L(c.sub)}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Magnetic><a href="#try" className="btn-bright text-sm">🎙️ {lang === "pt" ? "Ouça a Gui ao vivo" : lang === "es" ? "Escucha a Gui en vivo" : "Hear Gui live"}</a></Magnetic>
            <a href="#pricing" className="btn-ghost text-sm">{lang === "pt" ? "Montar meu pacote" : lang === "es" ? "Armar mi paquete" : "Build my package"}</a>
          </div>
          <p className="mt-4 text-[12px] text-g-muted">🛡️ {lang === "pt" ? "No ar em 7 dias · 30 dias de garantia · PT/EN/ES" : lang === "es" ? "En marcha en 7 días · 30 días de garantía · PT/EN/ES" : "Live in 7 days · 30-day money-back · EN/PT/ES"}</p>
        </Reveal>
      </section>

      {/* LOCAL ANGLE — the substantive, city-specific copy (what makes this NOT a thin page) */}
      <section className="px-5 py-10">
        <Reveal className="mx-auto max-w-3xl">
          <div className="rounded-xl3 border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-8">
            <p className="text-[15px] leading-relaxed text-g-ink sm:text-base">{L(c.localAngle)}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {L(c.why).map((w, i) => (
                <div key={i} className="rounded-2xl border border-g-green/20 bg-g-green/[0.06] p-4">
                  <span className="text-g-green">✓</span>
                  <p className="mt-1.5 text-[13.5px] font-semibold leading-snug text-g-light">{w}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="text-[11px] font-black uppercase tracking-wider text-g-muted">{lang === "pt" ? "Atendemos toda a região" : lang === "es" ? "Servimos toda la zona" : "Serving the whole area"}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.neighborhoods.map((n) => <span key={n} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-g-ink">{n}</span>)}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* LIVE DEMO */}
      <section id="try" className="relative px-5 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.10),transparent)]" />
        <Reveal className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{lang === "pt" ? "A prova, ao vivo" : lang === "es" ? "La prueba, en vivo" : "The proof, live"}</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-g-word">{lang === "pt" ? `Deixe a Gui te ligar agora` : lang === "es" ? "Deja que Gui te llame ahora" : "Let Gui call you now"}</h2>
        </Reveal>
        <LiveCall />
      </section>

      {/* PRICING */}
      <section id="pricing" className="wrap py-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">👆 {lang === "pt" ? "Monte o seu pacote" : lang === "es" ? "Arma tu paquete" : "Build your package"}</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-g-word">{lang === "pt" ? "Toque e veja seu plano nascer" : lang === "es" ? "Toca y mira tu plan armarse" : "Tap and watch your plan build itself"}</h2>
        </Reveal>
        <div className="mt-8"><PricingConfigurator /></div>
      </section>

      {/* internal links → vertical × city combo pages (feeds the long-tail mesh from every city) */}
      <section className="wrap pb-6 space-y-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? `A Gui no seu setor em ${c.city}` : lang === "es" ? `Gui en tu sector en ${c.city}` : `Gui for your industry in ${c.city}`}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SEO_VERTICALS.map((v) => (
              <a key={v.slug} href={`/for/${v.slug}/${c.slug}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-g-ink transition hover:border-g-gold/40 hover:text-g-word">{v.icon} {v.name[lang] || v.name.en}</a>
            ))}
          </div>
        </Reveal>
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? "A Gui em outras cidades" : lang === "es" ? "Gui en otras ciudades" : "Gui in other cities"}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SEO_CITIES.filter((x) => x.slug !== c.slug).map((x) => (
              <a key={x.slug} href={`${leadgen ? "/lead-generation" : "/ai-receptionist"}/${x.slug}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-g-ink transition hover:border-g-gold/40 hover:text-g-word">{x.flag} {x.city}</a>
            ))}
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      {t.faq?.items && (
        <section className="wrap pb-16">
          <Reveal className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight text-g-word">{t.faq.h2 || "FAQ"}</h2>
          </Reveal>
          <Accordion items={t.faq.items} />
        </section>
      )}

      {/* CTA */}
      <section className="px-5 pb-24 text-center">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-black tracking-tight text-g-word sm:text-3xl">{lang === "pt" ? `Pare de perder clientes em ${c.city}.` : lang === "es" ? `Deja de perder clientes en ${c.city}.` : `Stop losing customers in ${c.city}.`}</h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Magnetic><a href="#pricing" className="btn-bright text-sm">{lang === "pt" ? "Começar agora" : lang === "es" ? "Empezar ahora" : "Get started"}</a></Magnetic>
            <button type="button" onClick={() => setQuote({ catName: c ? `${leadgen ? (lang === "pt" ? "Geração de leads" : lang === "es" ? "Generación de leads" : "Lead generation") : (lang === "pt" ? "Recepcionista IA" : lang === "es" ? "Recepcionista IA" : "AI receptionist")} · ${c.city}` : "" })} className="btn-ghost text-sm">{lang === "pt" ? "Falar com a gente" : lang === "es" ? "Hablar con nosotros" : "Talk to us"}</button>
          </div>
        </Reveal>
      </section>

      <Footer />
      <VoiceAgent />
      <ExitIntent />
      {quote && <QuoteModal catName={quote.catName} onClose={() => setQuote(null)} />}
    </div>
  );
}
