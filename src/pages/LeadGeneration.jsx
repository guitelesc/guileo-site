import { useEffect, useState } from "react";
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
import { SEO_CITIES } from "../data/seoCities.js";
import { SEO_VERTICALS } from "../data/seoVerticals.js";

// /lead-generation — the PILLAR page for the lead-gen offer (no city). Ties the three lead-gen
// mechanics together (speed-to-lead, missed-call text-back, reactivation), proves them with the live
// demo + the lost-revenue calculator, and cross-links every city/vertical page for SEO.

// The 3 mechanics that make Gui a lead-gen machine — each is a distinct, concrete promise.
const MECHANICS = [
  {
    icon: "⚡", key: "speed",
    title: { en: "60-second speed-to-lead", pt: "Resposta em 60 segundos", es: "Respuesta en 60 segundos" },
    body: {
      en: "A new lead fills your form or clicks an ad — Gui calls them back within a minute, while they're still hot. Most businesses take hours; the first to respond wins ~50% of the deals.",
      pt: "Um lead novo preenche seu formulário ou clica num anúncio — a Gui liga de volta em menos de um minuto, enquanto ele ainda está quente. A maioria demora horas; quem responde primeiro fecha ~50% dos negócios.",
      es: "Un lead nuevo llena tu formulario o hace clic en un anuncio — Gui le devuelve la llamada en menos de un minuto, mientras sigue caliente. La mayoría tarda horas; el primero en responder gana ~50% de los tratos.",
    },
  },
  {
    icon: "📲", key: "missed",
    title: { en: "Missed-call text-back", pt: "Ligação perdida vira texto", es: "Llamada perdida vuelve como texto" },
    body: {
      en: "Every call you can't pick up gets an instant text from Gui — \"Sorry we missed you, how can we help?\" — so the lead never bounces to the next business. A busy line stops being a lost customer.",
      pt: "Toda ligação que você não atende recebe na hora um texto da Gui — \"Desculpe não atender, como posso ajudar?\" — pra o lead nunca ir pro concorrente. Linha ocupada deixa de ser cliente perdido.",
      es: "Cada llamada que no contestas recibe al instante un texto de Gui — \"Perdón por no contestar, ¿cómo te ayudo?\" — para que el lead nunca se vaya con la competencia. Una línea ocupada deja de ser un cliente perdido.",
    },
  },
  {
    icon: "♻️", key: "reactivate",
    title: { en: "Reactivation & win-back", pt: "Reativação e recuperação", es: "Reactivación y recuperación" },
    body: {
      en: "Gui works your old list 24/7 — past customers, no-shows, cold leads — with the right message at the right time, turning a dead database into booked appointments and repeat sales.",
      pt: "A Gui trabalha sua lista antiga 24/7 — clientes antigos, faltas, leads frios — com a mensagem certa na hora certa, transformando um banco parado em agendamentos e vendas repetidas.",
      es: "Gui trabaja tu lista antigua 24/7 — clientes pasados, ausencias, leads fríos — con el mensaje correcto en el momento correcto, convirtiendo una base muerta en citas y ventas repetidas.",
    },
  },
];

const FAQ = {
  en: { h2: "Lead generation, answered", items: [
    ["How fast does Gui respond to a new lead?", "Within about 60 seconds, 24/7. The moment a form, call, WhatsApp or ad-click comes in, Gui reaches out — by call or text — before the lead cools off or calls a competitor."],
    ["What counts as a lead?", "A missed call, a form fill, a WhatsApp/Instagram message, a click-to-call ad, a chat — anything where a real person raised their hand. Gui captures the name + contact and follows up automatically."],
    ["Do I need to buy ads from you?", "No. Gui captures and converts the leads you already get from every channel. If you also want us to run ads to create more leads, that's the Build/Growth track — optional."],
    ["How long to go live?", "About 7 days. We train Gui on your business, connect your number and channels, and you start catching every lead. 30-day money-back."],
  ] },
  pt: { h2: "Geração de leads, respondida", items: [
    ["Quão rápido a Gui responde um lead novo?", "Em cerca de 60 segundos, 24/7. No instante que chega um formulário, ligação, WhatsApp ou clique em anúncio, a Gui já entra em contato — por ligação ou texto — antes do lead esfriar ou ligar pro concorrente."],
    ["O que conta como lead?", "Uma ligação perdida, um formulário, uma mensagem no WhatsApp/Instagram, um anúncio click-to-call, um chat — qualquer lugar onde uma pessoa real levantou a mão. A Gui captura nome + contato e faz o follow-up sozinha."],
    ["Preciso comprar anúncios de vocês?", "Não. A Gui captura e converte os leads que você já recebe de todos os canais. Se você também quiser que a gente rode anúncios pra gerar mais leads, isso é a trilha Build/Crescimento — opcional."],
    ["Quanto tempo pra entrar no ar?", "Cerca de 7 dias. Treinamos a Gui no seu negócio, conectamos seu número e canais, e você começa a pegar cada lead. 30 dias de garantia."],
  ] },
  es: { h2: "Generación de leads, respondida", items: [
    ["¿Qué tan rápido responde Gui a un lead nuevo?", "En unos 60 segundos, 24/7. En el momento que llega un formulario, llamada, WhatsApp o clic en anuncio, Gui contacta — por llamada o texto — antes de que el lead se enfríe o llame a la competencia."],
    ["¿Qué cuenta como lead?", "Una llamada perdida, un formulario, un mensaje de WhatsApp/Instagram, un anuncio click-to-call, un chat — cualquier lugar donde una persona real levantó la mano. Gui captura nombre + contacto y da seguimiento sola."],
    ["¿Necesito comprar anuncios con ustedes?", "No. Gui captura y convierte los leads que ya recibes de todos los canales. Si además quieres que corramos anuncios para generar más leads, eso es la vía Build/Crecimiento — opcional."],
    ["¿Cuánto para estar en marcha?", "Unos 7 días. Entrenamos a Gui en tu negocio, conectamos tu número y canales, y empiezas a captar cada lead. 30 días de garantía."],
  ] },
};

export default function LeadGeneration() {
  const { lang } = useLang();
  const [quote, setQuote] = useState(null);
  const L = (o) => (o && (o[lang] || o.en)) || "";

  useSeo({
    title: lang === "pt" ? "Geração de Leads com IA para Negócio Local | Guileo"
      : lang === "es" ? "Generación de Leads con IA para Negocio Local | Guileo"
      : "AI Lead Generation for Local Business | Guileo",
    description: lang === "pt" ? "A IA da Guileo capta e responde CADA lead 24/7 — retorno em 60s, texto em ligação perdida, reativação de lista. Pare de perder clientes pra concorrência. No ar em 7 dias."
      : lang === "es" ? "La IA de Guileo capta y responde CADA lead 24/7 — devolución en 60s, texto en llamada perdida, reactivación de lista. Deja de perder clientes. En marcha en 7 días."
      : "Guileo's AI captures and answers EVERY lead 24/7 — 60-second callbacks, missed-call text-back, list reactivation. Stop losing customers to the competition. Live in 7 days.",
    path: "/lead-generation",
  });

  // Page-level JSON-LD for the lead-gen Service.
  useEffect(() => {
    const node = {
      "@context": "https://schema.org", "@type": "Service",
      name: "Guileo AI lead generation for local business",
      serviceType: "AI lead capture, speed-to-lead callbacks, missed-call text-back, reactivation",
      provider: { "@type": "Organization", name: "Guileo", url: "https://guileoai.com" },
      areaServed: ["United States", "Brazil"],
      description: L({
        en: "AI that captures and follows up every lead 24/7 for local businesses — 60-second callbacks, missed-call text-back, win-back.",
        pt: "IA que capta e faz follow-up de cada lead 24/7 para negócios locais — retorno em 60s, texto em ligação perdida, recuperação.",
        es: "IA que capta y da seguimiento a cada lead 24/7 para negocios locales — devolución en 60s, texto en llamada perdida, recuperación.",
      }),
      offers: { "@type": "Offer", priceCurrency: "USD", price: String(planByKey("starter").amount), description: `Self-service from $${planByKey("starter").amount}/mo; tailored done-for-you quoted per business.` },
    };
    const s = document.createElement("script");
    s.type = "application/ld+json"; s.id = "leadgen-jsonld"; s.textContent = JSON.stringify(node);
    document.head.appendChild(s);
    return () => { document.getElementById("leadgen-jsonld")?.remove(); };
  }, [lang]);

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden px-5 pt-24 pb-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1100px_500px_at_72%_-10%,rgba(62,148,104,0.12),transparent),radial-gradient(700px_360px_at_8%_15%,rgba(214,194,154,0.06),transparent)]" />
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-g-gold">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: "rgba(255,138,51,0.7)" }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#FF8A33" }} /></span>
            {lang === "pt" ? "Geração de leads para negócio local" : lang === "es" ? "Generación de leads para negocio local" : "Lead generation for local business"}
          </span>
          <h1 className="mt-5 text-3xl font-black leading-[1.06] tracking-tight text-g-word sm:text-[3rem]">
            {lang === "pt" ? "Cada lead capturado e respondido em 60 segundos — 24/7"
              : lang === "es" ? "Cada lead capturado y respondido en 60 segundos — 24/7"
              : "Every lead captured and answered in 60 seconds — 24/7"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-g-light/85 sm:text-lg">
            {lang === "pt" ? "A Gui atende a ligação, responde no WhatsApp, liga de volta o lead novo e recupera os antigos — pra você nunca mais perder um cliente pra quem respondeu primeiro."
              : lang === "es" ? "Gui contesta la llamada, responde en WhatsApp, devuelve la llamada al lead nuevo y recupera los antiguos — para que nunca pierdas un cliente con quien respondió primero."
              : "Gui answers the call, replies on WhatsApp, calls the new lead back and wins back the old ones — so you never lose another customer to whoever answered first."}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Magnetic><a href="#try" className="btn-bright text-sm">🎙️ {lang === "pt" ? "Deixe a Gui te ligar" : lang === "es" ? "Deja que Gui te llame" : "Let Gui call you"}</a></Magnetic>
            <a href="/calculator" className="btn-ghost text-sm">{lang === "pt" ? "Quanto estou perdendo?" : lang === "es" ? "¿Cuánto pierdo?" : "How much am I losing?"}</a>
          </div>
          <p className="mt-4 text-[12px] text-g-muted">🛡️ {lang === "pt" ? "No ar em 7 dias · 30 dias de garantia · PT/EN/ES" : lang === "es" ? "En marcha en 7 días · 30 días de garantía · PT/EN/ES" : "Live in 7 days · 30-day money-back · EN/PT/ES"}</p>
        </Reveal>
      </section>

      {/* THE 3 MECHANICS */}
      <section className="px-5 py-12">
        <Reveal className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{lang === "pt" ? "Como a Gui gera leads" : lang === "es" ? "Cómo Gui genera leads" : "How Gui generates leads"}</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-g-word">{lang === "pt" ? "Três motores, zero leads perdidos" : lang === "es" ? "Tres motores, cero leads perdidos" : "Three engines, zero leads lost"}</h2>
        </Reveal>
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
          {MECHANICS.map((m, i) => (
            <Reveal key={m.key} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="h-full rounded-xl3 border border-g-green/20 bg-g-green/[0.05] p-6 backdrop-blur-xl transition hover:border-g-green/40">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-g-green/15 text-2xl">{m.icon}</div>
                <h3 className="mt-4 text-lg font-black text-g-word">{L(m.title)}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-g-light/85">{L(m.body)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* LOST-REVENUE CALCULATOR teaser */}
      <section className="px-5 py-8">
        <Reveal className="mx-auto max-w-3xl">
          <div className="rounded-xl3 border border-g-gold/25 bg-g-gold/[0.06] p-6 text-center backdrop-blur-xl sm:p-8">
            <div className="text-[12px] font-bold uppercase tracking-[0.22em] text-g-gold">{lang === "pt" ? "Calculadora grátis" : lang === "es" ? "Calculadora gratis" : "Free calculator"}</div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-g-word sm:text-3xl">{lang === "pt" ? "Veja em 20s quanto leads perdidos te custam" : lang === "es" ? "Mira en 20s cuánto te cuestan los leads perdidos" : "See in 20s what lost leads cost you"}</h2>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-g-light/85">{lang === "pt" ? "Dois cliques e você vê o vazamento mensal de receita das ligações e mensagens não respondidas." : lang === "es" ? "Dos clics y ves la fuga mensual de ingresos por llamadas y mensajes sin responder." : "Two clicks and you'll see the monthly revenue leak from unanswered calls and messages."}</p>
            <div className="mt-6"><Magnetic><a href="/calculator" className="btn-bright text-sm">{lang === "pt" ? "Calcular meu vazamento →" : lang === "es" ? "Calcular mi fuga →" : "Calculate my leak →"}</a></Magnetic></div>
          </div>
        </Reveal>
      </section>

      {/* LIVE DEMO — the speed-to-lead proof */}
      <section id="try" className="relative px-5 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.10),transparent)]" />
        <Reveal className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{lang === "pt" ? "Speed-to-lead, ao vivo" : lang === "es" ? "Speed-to-lead, en vivo" : "Speed-to-lead, live"}</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-g-word">{lang === "pt" ? "Seja o lead — a Gui te liga agora" : lang === "es" ? "Sé el lead — Gui te llama ahora" : "Be the lead — Gui calls you now"}</h2>
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

      {/* CITY DIRECTORY — internal SEO cross-links */}
      <section className="wrap pb-6">
        <Reveal className="mx-auto max-w-4xl text-center">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? "Geração de leads na sua cidade" : lang === "es" ? "Generación de leads en tu ciudad" : "Lead generation in your city"}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SEO_CITIES.map((c) => (
              <a key={c.slug} href={`/lead-generation/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-g-ink transition hover:border-g-gold/40 hover:text-g-word">
                <span>{c.flag}</span> {c.city}
              </a>
            ))}
          </div>
        </Reveal>
      </section>

      {/* VERTICAL DIRECTORY */}
      <section className="wrap pb-6">
        <Reveal className="mx-auto max-w-4xl text-center">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? "Leads para o seu setor" : lang === "es" ? "Leads para tu sector" : "Leads for your industry"}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SEO_VERTICALS.slice(0, 12).map((v) => (
              <a key={v.slug} href={`/for/${v.slug}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-g-ink transition hover:border-g-gold/40 hover:text-g-word">{v.icon} {v.name[lang] || v.name.en}</a>
            ))}
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="wrap pb-16">
        <Reveal className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-g-word">{(FAQ[lang] || FAQ.en).h2}</h2>
        </Reveal>
        <Accordion items={(FAQ[lang] || FAQ.en).items} />
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 text-center">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-black tracking-tight text-g-word sm:text-3xl">{lang === "pt" ? "Pare de perder leads hoje." : lang === "es" ? "Deja de perder leads hoy." : "Stop losing leads today."}</h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Magnetic><a href="#pricing" className="btn-bright text-sm">{lang === "pt" ? "Começar agora" : lang === "es" ? "Empezar ahora" : "Get started"}</a></Magnetic>
            <button type="button" onClick={() => setQuote({ catName: lang === "pt" ? "Geração de leads" : lang === "es" ? "Generación de leads" : "Lead generation" })} className="btn-ghost text-sm">{lang === "pt" ? "Falar com a gente" : lang === "es" ? "Hablar con nosotros" : "Talk to us"}</button>
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
