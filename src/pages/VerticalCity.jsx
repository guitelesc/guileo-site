import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import QuoteModal from "../components/QuoteModal";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import ExitIntent from "../components/ExitIntent.jsx";
import LiveCall from "../components/LiveCall.jsx";
import PricingConfigurator from "../components/PricingConfigurator";
import { Reveal, Magnetic, Accordion } from "../lib/ui.jsx";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { getSeoCity, SEO_CITIES } from "../data/seoCities.js";
import { getSeoVertical, SEO_VERTICALS } from "../data/seoVerticals.js";

// Vertical × City combo landing (/for/:vertical/:city) — the high-intent long-tail page
// ("AI receptionist for dental clinics in New York"). Each page fuses GENUINELY unique content:
// the city's local angle/neighborhoods (from seoCities) + the niche's pain/result/actions
// (from seoVerticals). 13 verticals × 11 cities = 143 conversion-ready pages, fully trilingual.
export default function VerticalCity() {
  const { vertical: vSlug, city: citySlug } = useParams();
  const v = getSeoVertical(vSlug);
  const c = getSeoCity(citySlug);
  const { lang, t } = useLang();
  const L = (o) => (o && (o[lang] || o.en)) || "";
  const [quote, setQuote] = useState(null);

  const vName = v ? L(v.name) : "";
  const recept = { en: "AI Receptionist for", pt: "Recepcionista de IA para", es: "Recepcionista de IA para" };
  const inCity = { en: "in", pt: "em", es: "en" };

  const seoTitle = v && c && {
    en: `${recept.en} ${L(v.name)} ${inCity.en} ${c.city} | Guileo`,
    pt: `${recept.pt} ${L(v.name)} ${inCity.pt} ${c.city} | Guileo`,
    es: `${recept.es} ${L(v.name)} ${inCity.es} ${c.city} | Guileo`,
  };
  // City-specific meta tail (first neighborhoods + area code) — mirrors functions/for/[vertical]/[city].js
  const descTail = c?.neighborhoods?.[1] && (() => {
    const [dn1, dn2] = c.neighborhoods;
    const dac = c.areaCodes?.[0];
    const dacL = dac ? (c.country === "BR" ? `DDD ${dac}` : `(${dac})`) : "";
    return {
      en: ` From ${dn1} to ${dn2}${dacL ? ` — every ${dacL} call answered` : ""}.`,
      pt: ` De ${dn1} a ${dn2}${dacL ? ` — toda ligação ${dacL} atendida` : ""}.`,
      es: ` De ${dn1} a ${dn2}${dacL ? ` — cada llamada ${dacL} atendida` : ""}.`,
    };
  })();
  const seoDesc = v && c && {
    en: `Guileo's AI answers, books and follows up 24/7 for ${L(v.name).toLowerCase()} in ${c.city} — voice, WhatsApp & SMS in 16 languages. ${L(v.result)} Live in 7 days.${descTail?.en || ""}`,
    pt: `A IA da Guileo atende, agenda e faz follow-up 24/7 para ${L(v.name).toLowerCase()} em ${c.city} — voz, WhatsApp e SMS, trilíngue. ${L(v.result)} No ar em 7 dias.${descTail?.pt || ""}`,
    es: `La IA de Guileo atiende, agenda y da seguimiento 24/7 para ${L(v.name).toLowerCase()} en ${c.city} — voz, WhatsApp y SMS, trilingüe. ${L(v.result)} Activo en 7 días.${descTail?.es || ""}`,
  };

  useSeo({
    title: seoTitle ? L(seoTitle) : "AI Receptionist by city & industry | Guileo",
    description: seoDesc ? L(seoDesc) : "Guileo's AI answers, books and follows up 24/7 for local businesses.",
    path: v && c ? `/for/${v.slug}/${c.slug}` : "/servicos",
  });

  // Per-page JSON-LD: Service scoped to this niche + city, plus a BreadcrumbList. Removed on unmount.
  useEffect(() => {
    if (!v || !c) return;
    const graph = [
      {
        "@context": "https://schema.org", "@type": "Service",
        name: `Guileo AI receptionist for ${L(v.name)} in ${c.city}`,
        serviceType: "AI voice agent, WhatsApp & SMS answering, booking, lead capture and follow-up",
        areaServed: { "@type": "City", name: c.areaServed },
        provider: { "@type": "Organization", name: "Guileo", url: "https://guileoai.com" },
        description: L(seoDesc),
        offers: { "@type": "Offer", priceCurrency: "USD", price: "149", description: "Self-service from $149/mo; done-for-you from $990 setup + $1,497/mo." },
      },
      {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Guileo", item: "https://guileoai.com" },
          { "@type": "ListItem", position: 2, name: L(v.name), item: `https://guileoai.com/for/${v.slug}` },
          { "@type": "ListItem", position: 3, name: `${L(v.name)} in ${c.city}`, item: `https://guileoai.com/for/${v.slug}/${c.slug}` },
        ],
      },
    ];
    const faqItems = t?.faq?.items || [];
    if (faqItems.length) graph.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqItems.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "vc-jsonld";
    s.textContent = JSON.stringify(graph);
    document.head.appendChild(s);
    return () => { document.getElementById("vc-jsonld")?.remove(); };
  }, [v, c, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!v || !c) return <Navigate to="/servicos" replace />;

  const h1 = {
    en: `The AI receptionist for ${vName.toLowerCase()} in ${c.city}.`,
    pt: `A recepcionista de IA para ${vName.toLowerCase()} em ${c.city}.`,
    es: `La recepcionista de IA para ${vName.toLowerCase()} en ${c.city}.`,
  };

  // City-specific proof paragraph: real neighborhoods + local area code + the city's own hook
  // sentence (from seoCities), so each of the 765 combo pages carries genuinely local copy.
  const n1 = c.neighborhoods?.[0];
  const n2 = c.neighborhoods?.[1];
  const ac = c.areaCodes?.[0];
  const acLabel = ac ? (c.country === "BR" ? `DDD ${ac}` : `(${ac})`) : "";
  const localLine = n1 && n2 && {
    en: `From ${n1} to ${n2}, ${vName.toLowerCase()} in ${c.city} miss calls every single day — Gui answers your ${acLabel ? `${acLabel} ` : ""}line 24/7 and turns each one into a booked appointment.${c.hook ? ` ${c.hook.en}` : ""}`,
    pt: `De ${n1} a ${n2}, ${vName.toLowerCase()} em ${c.city} perdem ligações todos os dias — a Gui atende sua linha ${acLabel ? `${acLabel} ` : ""}24/7 e transforma cada uma em agendamento.${c.hook ? ` ${c.hook.pt || c.hook.en}` : ""}`,
    es: `De ${n1} a ${n2}, ${vName.toLowerCase()} en ${c.city} pierden llamadas todos los días — Gui atiende tu línea ${acLabel ? `${acLabel} ` : ""}24/7 y convierte cada una en una cita agendada.${c.hook ? ` ${c.hook.es || c.hook.en}` : ""}`,
  };

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      {/* HERO — niche × city */}
      <section className="relative overflow-hidden px-5 pt-24 pb-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1100px_500px_at_72%_-10%,rgba(62,148,104,0.12),transparent),radial-gradient(700px_360px_at_8%_15%,rgba(214,194,154,0.06),transparent)]" />
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-g-gold">
            <span className="text-base">{v.icon}</span> {vName} · {c.flag} {c.city}
          </span>
          <h1 className="mt-5 text-3xl font-black leading-[1.06] tracking-tight text-g-word sm:text-[2.9rem]">{L(h1)}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-g-light/85 sm:text-lg">{L(v.sub)}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Magnetic><a href="#try" className="btn-bright text-sm">🎙️ {lang === "pt" ? "Ouça a Gui ao vivo" : lang === "es" ? "Escucha a Gui en vivo" : "Hear Gui live"}</a></Magnetic>
            <a href="#pricing" className="btn-ghost text-sm">{lang === "pt" ? "Montar meu pacote" : lang === "es" ? "Armar mi paquete" : "Build my package"}</a>
          </div>
          <p className="mt-4 text-[12px] text-g-muted">🛡️ {lang === "pt" ? "No ar em 7 dias · 30 dias de garantia · PT/EN/ES" : lang === "es" ? "En marcha en 7 días · 30 días de garantía · PT/EN/ES" : "Live in 7 days · 30-day money-back · EN/PT/ES"}</p>
        </Reveal>
      </section>

      {/* THE NICHE PROBLEM (unique per vertical) → THE LOCAL ANGLE (unique per city) */}
      <section className="px-5 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <Reveal>
            <div className="rounded-xl3 border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-8">
              <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? "O problema" : lang === "es" ? "El problema" : "The problem"}</div>
              <p className="mt-2 text-[17px] font-bold leading-snug text-g-word">{lang === "pt" ? "Toda ligação perdida é " : lang === "es" ? "Cada llamada perdida es " : "Every missed call is "}<span className="text-g-gold">{L(v.pain)}</span>.</p>
              <p className="mt-3 text-[15px] leading-relaxed text-g-ink">{L(v.sub)}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {v.acts.map((a) => <span key={a} className="rounded-full border border-g-green/20 bg-g-green/[0.06] px-3 py-1 text-[12.5px] font-semibold text-g-light">{a}</span>)}
              </div>
              <p className="mt-5 rounded-2xl border border-g-green/20 bg-g-green/[0.06] p-4 text-[14px] font-semibold leading-snug text-g-light"><span className="text-g-green">✓</span> {L(v.result)}</p>
            </div>
          </Reveal>

          <Reveal>
            <div className="rounded-xl3 border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-8">
              <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{c.flag} {lang === "pt" ? `Por que isso importa em ${c.city}` : lang === "es" ? `Por qué importa en ${c.city}` : `Why this matters in ${c.city}`}</div>
              <p className="mt-2 text-[15px] leading-relaxed text-g-ink sm:text-base">{L(c.localAngle)}</p>
              {localLine && <p className="mt-3 text-[15px] leading-relaxed text-g-ink sm:text-base">{L(localLine)}</p>}
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
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="try" className="relative px-5 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.10),transparent)]" />
        <Reveal className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{lang === "pt" ? "A prova, ao vivo" : lang === "es" ? "La prueba, en vivo" : "The proof, live"}</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-g-word">{lang === "pt" ? "Deixe a Gui te ligar agora" : lang === "es" ? "Deja que Gui te llame ahora" : "Let Gui call you now"}</h2>
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

      {/* CROSS-LINKS — same niche in other cities + other niches in this city (internal-link mesh) */}
      <section className="wrap pb-6 space-y-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? `${vName} em outras cidades` : lang === "es" ? `${vName} en otras ciudades` : `${vName} in other cities`}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SEO_CITIES.filter((x) => x.slug !== c.slug).slice(0, 8).map((x) => (
              <a key={x.slug} href={`/for/${v.slug}/${x.slug}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-g-ink transition hover:border-g-gold/40 hover:text-g-word">{x.flag} {x.city}</a>
            ))}
          </div>
        </Reveal>
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? `A Gui em outros setores em ${c.city}` : lang === "es" ? `Gui en otros sectores en ${c.city}` : `Gui for other industries in ${c.city}`}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SEO_VERTICALS.filter((x) => x.slug !== v.slug).slice(0, 8).map((x) => (
              <a key={x.slug} href={`/for/${x.slug}/${c.slug}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-g-ink transition hover:border-g-gold/40 hover:text-g-word">{x.icon} {x.name[lang] || x.name.en}</a>
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
          <h2 className="text-2xl font-black tracking-tight text-g-word sm:text-3xl">{lang === "pt" ? `Pare de perder clientes — ${vName.toLowerCase()} em ${c.city}.` : lang === "es" ? `Deja de perder clientes — ${vName.toLowerCase()} en ${c.city}.` : `Stop losing customers — ${vName.toLowerCase()} in ${c.city}.`}</h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Magnetic><a href="#pricing" className="btn-bright text-sm">{lang === "pt" ? "Começar agora" : lang === "es" ? "Empezar ahora" : "Get started"}</a></Magnetic>
            <button type="button" onClick={() => setQuote({ catName: `${vName} · ${c.city}` })} className="btn-ghost text-sm">{lang === "pt" ? "Falar com a gente" : lang === "es" ? "Hablar con nosotros" : "Talk to us"}</button>
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
