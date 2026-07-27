import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import QuoteModal from "../components/QuoteModal";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import ExitIntent from "../components/ExitIntent.jsx";
import LiveCall from "../components/LiveCall.jsx";
import PricingConfigurator from "../components/PricingConfigurator";
import { Reveal, Magnetic, Accordion } from "../lib/ui.jsx";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { getSeoVertical } from "../data/seoVerticals.js";
import { VERTICAL_SUPERPOWERS } from "../data/verticalSuperpowers.js";
import { PITCH_CARDS } from "../data/pitchCards.js";
import mark from "../assets/guileo-mark.png";

// Maps each SEO vertical slug to its seller pitch-card id, so the public niche page
// mirrors the sales discourse (pain → leak → solution-as-gain → gains → competitive edge).
// Slugs without a sensible match simply render no extra block.
const SLUG_TO_PITCH = {
  "dental-clinics": "dental",
  "restaurants": "restaurant",
  "medical-clinics": "clinic",
  "law-firms": "law",
  "real-estate": "realestate",
  "plumbing-hvac": "homeservices",
  "auto-dealerships": "autorepair",
  "gyms-fitness": "fitness",
  "ecommerce": "retail",
  "salons-spas": "salon",
  "cleaning-services": "homeservices",
  "home-contractors": "homeservices",
  "veterinary-clinics": "vet",
  "spas": "spa",
};

// One realistic Gui line per niche for the hero phone mockup (EN + PT; ES/HI fall back to EN).
const DEMO_LINES = {
  "dental-clinics": { en: "“Confirming your cleaning tomorrow at 9 AM — reply 1 to keep, 2 to move.”", pt: "“Confirmando sua limpeza amanhã às 9h — responda 1 pra manter, 2 pra remarcar.”" },
  "restaurants": { en: "“Two larges, extra cheese — pickup at 7:15. Want drinks with that?”", pt: "“Duas grandes, mais queijo — retirada às 19:15. Vai bebida junto?”" },
  "medical-clinics": { en: "“I can fit you in Thursday at 2 PM — I'll text a reminder the day before.”", pt: "“Consigo encaixar quinta às 14h — mando um lembrete na véspera.”" },
  "law-firms": { en: "“Got your case details — a paralegal will call you within the hour.”", pt: "“Anotei os detalhes do caso — um assistente liga pra você em até uma hora.”" },
  "real-estate": { en: "“3-bed downtown under your budget? I'll text you 4 matches tonight.”", pt: "“3 quartos no centro dentro do orçamento? Te mando 4 opções hoje à noite.”" },
  "plumbing-hvac": { en: "“Your water heater's an emergency — I've got a tech there by 10 AM.”", pt: "“Seu aquecedor é emergência — tenho um técnico aí até as 10h.”" },
  "auto-dealerships": { en: "“Test drive for the SUV tomorrow at 8? I'll have it ready and warmed up.”", pt: "“Test drive do SUV amanhã às 8? Deixo separado e pronto pra você.”" },
  "gyms-fitness": { en: "“1 month free if you're back this week — want me to set it up?”", pt: "“1 mês grátis se voltar essa semana — quer que eu já ative?”" },
  "ecommerce": { en: "“Your order's 6 minutes away — driver is Marco. I'll text live updates 🚗”", pt: "“Seu pedido chega em 6 min — entregador Marco. Mando updates ao vivo 🚗”" },
  "salons-spas": { en: "“Friday at 4 works — I sent your deposit link. You're all set ✨”", pt: "“Sexta às 16h funciona — enviei o link do depósito. Tá tudo certo ✨”" },
  "cleaning-services": { en: "“Standard clean for a 2-bedroom runs ~$120 — book the first one Saturday?”", pt: "“Limpeza padrão de 2 quartos sai ~$120 — agendo a primeira no sábado?”" },
  "accountants": { en: "“Tax consult booked for Tuesday 10 AM — I'll send the doc checklist now.”", pt: "“Consultoria fiscal marcada pra terça às 10h — já te mando a lista de documentos.”" },
  "home-contractors": { en: "“Site visit Thursday 9 AM for your estimate — confirmed and on the calendar.”", pt: "“Visita técnica quinta às 9h pro orçamento — confirmada e na agenda.”" },
  "veterinary-clinics": { en: "“Bella's vaccine is due — I've got Thursday 3 PM open. Want me to hold it? 🐾”", pt: "“A vacina da Bella tá na hora — tenho quinta às 15h. Quer que eu segure? 🐾”" },
  "spas": { en: "“Friday at 2 for your massage — deposit link sent. You're all booked ✨”", pt: "“Sexta às 14h pra sua massagem — enviei o link do depósito. Tá tudo agendado ✨”" },
};

// Niche-specific "Gui live" phone mockup — same visual language as the home hero, fed by the vertical.
function VerticalPhone({ v, lang }) {
  const name = v.name[lang] || v.name.en;
  const dl = DEMO_LINES[v.slug];
  const line = (dl && (dl[lang] || dl.en)) || (v.sub[lang] || v.sub.en);
  return (
    <div className="relative mx-auto w-[340px] max-w-full">
      <img src={mark} alt="" className="pointer-events-none absolute -top-10 left-1/2 w-[380px] max-w-none -translate-x-1/2 opacity-[0.14] blur-[1px] saturate-150" />
      <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,rgba(62,148,104,0.22),transparent)] blur-2xl" />
      <div className="relative rounded-[3rem] bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] p-[8px] ring-1 ring-white/10 shadow-[0_60px_150px_-30px_rgba(0,0,0,0.9)]">
        <div className="relative overflow-hidden rounded-[2.6rem] bg-[#0b0b0b]">
          <div className="absolute left-1/2 top-2.5 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black" />
          <div className="flex items-center justify-between px-6 pt-3.5 pb-2 text-[12px] font-semibold text-white/85"><span>9:41</span><span className="text-[10px] tracking-wide">▮▮▮ ⌃ 100%</span></div>
          <div className="px-6 pt-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-g-green">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" /></span>
              {lang === "pt" ? "Em ligação" : lang === "es" ? "En llamada" : "On a call"} · {name}
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0">
                <span className="absolute inset-0 rounded-full ring-2 ring-g-green/45" style={{ animation: "vpulse 2s ease-out infinite" }} />
                <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-g-green/25 to-g-gold/15 ring-1 ring-white/15"><img src={mark} className="h-9 w-9 object-contain" alt="Gui" /></div>
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5"><span className="text-[15px] font-bold text-white">Gui</span><span className="rounded-full border border-g-green/40 bg-g-green/10 px-1.5 py-[1px] text-[8px] font-black uppercase tracking-wider text-g-green">AI Voice</span></div>
                <div className="text-[11px] text-white/55">{v.icon} {name}</div>
              </div>
            </div>
          </div>
          <div className="mx-6 mt-4 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10">
            <div className="flex h-8 items-end gap-[3px]">{Array.from({ length: 22 }).map((_, i) => <span key={i} className="w-[3px] origin-bottom rounded-full bg-gradient-to-t from-g-green to-g-gold" style={{ height: `${28 + ((i * 41) % 64)}%`, animation: `vwave 1.4s ease-in-out ${(i % 8) * 0.1}s infinite` }} />)}</div>
            <p className="mt-2.5 text-[12.5px] leading-snug text-white/80">{line}</p>
          </div>
          <div className="px-6 pb-5 pt-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-white/70">{lang === "pt" ? "A Gui está cuidando · ao vivo" : lang === "es" ? "Gui se encarga · en vivo" : "Gui is handling it · live"}</span><span className="text-[9px] text-g-green">● real-time</span></div>
            <div className="space-y-2">
              {v.acts.map((a, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-3 py-2 ring-1 ring-white/10" style={{ animation: `vsoft .5s ease-in-out ${i * 0.12}s both` }}>
                  <span className="flex-1 text-[12.5px] font-semibold text-white">{a}</span><span className="text-[11px] text-g-green">✓</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// One data-driven SEO landing for every vertical (/for/:slug). Reuses the live demo (LiveCall) and
// the package builder (PricingConfigurator) so each niche page is fully conversion-ready, not a stub.
export default function Vertical() {
  const { slug } = useParams();
  const v = getSeoVertical(slug);
  const { lang, t } = useLang();
  const L = (o) => (o && (o[lang] || o.en)) || "";
  const [quote, setQuote] = useState(null);

  useSeo({
    title: v ? L(v.seoTitle) : "AI for your business | Guileo",
    description: v ? L(v.seoDesc) : "Guileo installs an AI team that answers, books and sells 24/7 for local businesses.",
    path: v ? `/for/${v.slug}` : "/for",
  });

  // Per-page Service JSON-LD (injected into <head>; removed on unmount). Controlled data only.
  useEffect(() => {
    if (!v) return;
    const ld = {
      "@context": "https://schema.org", "@type": "Service",
      name: `Guileo AI receptionist for ${v.name.en}`,
      serviceType: "AI voice agent, booking, lead capture and follow-up automation",
      areaServed: ["US", "BR"], provider: { "@type": "Organization", name: "Guileo", url: "https://guileoai.com" },
      description: L(v.seoDesc),
      offers: { "@type": "Offer", priceCurrency: "USD", price: "149", description: "Self-service from $149/mo; done-for-you from $990 setup + $1,497/mo." },
    };
    const faqItems = t?.faq?.items || [];
    const graph = faqItems.length
      ? [ld, { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqItems.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }]
      : ld;
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "vertical-jsonld";
    s.textContent = JSON.stringify(graph);
    document.head.appendChild(s);
    return () => { document.getElementById("vertical-jsonld")?.remove(); };
  }, [v, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!v) return <Navigate to="/servicos" replace />;

  const name = L(v.name);
  const yearly = (v.lose * 12).toLocaleString("en-US");

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      {/* HERO — 2-column: niche pitch (left) + live "Gui working" phone mockup (right), matching the home */}
      <section className="relative overflow-hidden px-5 pt-24 pb-14">
        <style>{`
          @keyframes vwave{0%,100%{transform:scaleY(.42)}50%{transform:scaleY(1)}}
          @keyframes vpulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}
          @keyframes vsoft{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
          @media (prefers-reduced-motion: reduce){[style*="vwave"],[style*="vpulse"],[style*="vsoft"]{animation:none !important}}
        `}</style>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1100px_500px_at_72%_-10%,rgba(62,148,104,0.12),transparent),radial-gradient(700px_360px_at_8%_15%,rgba(214,194,154,0.06),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <Reveal className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-g-gold">
              <span className="text-base">{v.icon}</span> {name} · {lang === "pt" ? "Recepcionista de IA" : lang === "es" ? "Recepcionista de IA" : "AI Receptionist"}
            </span>
            <h1 className="mt-5 text-3xl font-black leading-[1.05] tracking-tight text-g-word sm:text-[2.9rem]">{L(v.h1)}</h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-g-light/85 sm:text-lg">{L(v.sub)}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Magnetic><a href="#try" className="btn-bright text-sm">🎙️ {lang === "pt" ? "Ouça a Gui ao vivo" : lang === "es" ? "Escucha a Gui en vivo" : "Hear Gui live"}</a></Magnetic>
              <a href="#pricing" className="btn-ghost text-sm">{lang === "pt" ? "Montar meu pacote" : lang === "es" ? "Armar mi paquete" : "Build my package"}</a>
            </div>
            <p className="mt-4 text-[12px] text-g-muted">🛡️ {lang === "pt" ? "No ar em 7 dias · 30 dias de garantia · PT/EN/ES" : lang === "es" ? "En marcha en 7 días · 30 días de garantía · PT/EN/ES" : "Live in 7 days · 30-day money-back · EN/PT/ES"}</p>
          </Reveal>
          <div className="relative min-w-0">
            <VerticalPhone v={v} lang={lang} />
          </div>
        </div>
      </section>

      {/* THE LEAK — niche-specific money lost + what Gui does + the result */}
      <section className="px-5 py-12">
        <Reveal className="mx-auto max-w-4xl">
          <div className="grid items-center gap-6 rounded-xl3 border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-8 md:grid-cols-2">
            <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] p-5 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wide text-red-400/80">{lang === "pt" ? `Sem a Gui, todo mês perde-se` : lang === "es" ? `Sin Gui, cada mes se pierde` : `Without Gui, every month a ${name.toLowerCase()} loses`}</div>
              <div className="mt-1 text-4xl font-black text-red-400 drop-shadow-[0_0_18px_rgba(239,68,68,0.3)]">−${v.lose.toLocaleString("en-US")}<span className="text-sm text-red-400/70">/{lang === "pt" ? "mês" : "mo"}</span></div>
              <div className="mt-1 text-[12px] text-g-muted">{lang === "pt" ? "por causa de" : lang === "es" ? "por" : "to"} {L(v.pain)} · ≈ ${yearly}/{lang === "pt" ? "ano" : "yr"}</div>
            </div>
            <div>
              <div className="text-[12px] font-black uppercase tracking-wider text-g-green">{lang === "pt" ? "Com a Gui" : lang === "es" ? "Con Gui" : "With Gui"}</div>
              <p className="mt-1 text-lg font-extrabold text-g-word">{L(v.result)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {v.acts.map((a) => <span key={a} className="rounded-full border border-g-green/30 bg-g-green/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-g-light">{a}</span>)}
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-[12px] text-g-muted">{lang === "pt" ? "Médias ilustrativas — resultados variam conforme seu negócio." : lang === "es" ? "Promedios ilustrativos — los resultados varían según tu negocio." : "Illustrative averages — results depend on your business."}</p>
        </Reveal>
      </section>

      {/* WHY THIS NICHE GROWS WITH GUILEO — the seller pitch-card narrative, live from pitchCards.js */}
      {SLUG_TO_PITCH[v.slug] && PITCH_CARDS[SLUG_TO_PITCH[v.slug]] && (() => {
        const pc = PITCH_CARDS[SLUG_TO_PITCH[v.slug]];
        return (
          <section className="wrap py-14">
            <Reveal className="mx-auto mb-8 max-w-2xl text-center">
              <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">
                {lang === "pt" ? "Por que cresce com a Guileo" : lang === "es" ? "Por qué crece con Guileo" : "Why this grows with Guileo"}
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-g-word">
                {lang === "pt" ? `Por que ${name.toLowerCase()} crescem com a Guileo` : lang === "es" ? `Por qué ${name.toLowerCase()} crecen con Guileo` : `Why ${name.toLowerCase()} grow with Guileo`}
              </h2>
            </Reveal>
            <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
              {/* The pain + what's leaking */}
              <Reveal>
                <div className="h-full rounded-xl3 border border-red-500/25 bg-red-500/[0.06] p-6 backdrop-blur-xl">
                  <div className="text-[11px] font-black uppercase tracking-wider text-red-400/80">
                    {lang === "pt" ? "A dor" : lang === "es" ? "El dolor" : "The pain"}
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-g-light/90">{L(pc.pain)}</p>
                  <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-3.5">
                    <span className="text-[12px] font-bold uppercase tracking-wide text-red-400/80">{lang === "pt" ? "O que vaza" : lang === "es" ? "Lo que se escapa" : "What's leaking"}</span>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-g-light/85">{L(pc.leak)}</p>
                  </div>
                </div>
              </Reveal>
              {/* The solution-as-gain + the 3 gains */}
              <Reveal style={{ transitionDelay: "80ms" }}>
                <div className="h-full rounded-xl3 border border-g-green/25 bg-g-green/[0.06] p-6 backdrop-blur-xl">
                  <div className="text-[11px] font-black uppercase tracking-wider text-g-green">
                    {lang === "pt" ? "A solução" : lang === "es" ? "La solución" : "The solution"}
                  </div>
                  <p className="mt-2 text-[15px] font-semibold leading-relaxed text-g-word">{L(pc.solution)}</p>
                  <ul className="mt-4 space-y-2">
                    {pc.gain.map((g, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-g-light/90">
                        <span className="mt-[2px] shrink-0 text-g-green">✓</span>
                        <span>{L(g)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
            {/* The competitive edge — passing the competition */}
            <Reveal className="mx-auto mt-4 max-w-5xl">
              <div className="rounded-xl3 border border-g-gold/25 bg-g-gold/[0.05] p-5 backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <span className="mt-[1px] text-lg text-g-gold">🏆</span>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? "Você passa a concorrência" : lang === "es" ? "Pasas a la competencia" : "You beat the competition"}</div>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-g-light/90">{L(pc.edge)}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>
        );
      })()}

      {/* SUPERPOWERS — what Gui does that no human employee ever could (from the per-vertical playbooks) */}
      {VERTICAL_SUPERPOWERS[v.slug] && (
        <section className="wrap py-14">
          <Reveal className="mx-auto mb-8 max-w-2xl text-center">
            <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{lang === "pt" ? "O impossível pra um humano" : lang === "es" ? "Lo imposible para un humano" : "What no human could do"}</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-g-word">{lang === "pt" ? "Superpoderes da Gui no seu setor" : lang === "es" ? "Superpoderes de Gui en tu sector" : "Gui's superpowers for your business"}</h2>
          </Reveal>
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
            {VERTICAL_SUPERPOWERS[v.slug].superhuman.map((s, i) => (
              <Reveal key={i} style={{ transitionDelay: `${i * 70}ms` }}>
                <div className="h-full rounded-xl3 border border-g-gold/20 bg-g-gold/[0.05] p-5 backdrop-blur-xl transition hover:border-g-gold/40">
                  <div className="flex items-center gap-2 text-g-gold"><span className="text-lg">✦</span><h3 className="text-[15px] font-black text-g-word">{s.name}</h3></div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-g-light/85">{s.what}</p>
                </div>
              </Reveal>
            ))}
          </div>
          {VERTICAL_SUPERPOWERS[v.slug].revenue?.length > 0 && (
            <Reveal className="mx-auto mt-6 max-w-3xl">
              <div className="rounded-xl3 border border-g-green/20 bg-g-green/[0.06] p-5 text-center backdrop-blur-xl">
                <div className="text-[11px] font-black uppercase tracking-wider text-g-green">{lang === "pt" ? "Onde isso vira dinheiro" : lang === "es" ? "Dónde se vuelve dinero" : "Where this becomes money"}</div>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {VERTICAL_SUPERPOWERS[v.slug].revenue.map((r, i) => <span key={i} className="rounded-full border border-g-green/30 bg-g-green/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-g-light">{r}</span>)}
                </div>
              </div>
            </Reveal>
          )}
        </section>
      )}

      {/* LIVE DEMO — the product, working, on this page */}
      <section id="try" className="relative px-5 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.10),transparent)]" />
        <Reveal className="mx-auto mb-8 max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{lang === "pt" ? "A prova, ao vivo" : lang === "es" ? "La prueba, en vivo" : "The proof, live"}</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-g-word">{lang === "pt" ? "Deixe a Gui te ligar agora" : lang === "es" ? "Deja que Gui te llame ahora" : "Let Gui call you now"}</h2>
        </Reveal>
        <LiveCall />
      </section>

      {/* PRICING — build the package */}
      <section id="pricing" className="wrap py-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">👆 {lang === "pt" ? "Monte o seu pacote" : lang === "es" ? "Arma tu paquete" : "Build your package"}</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-g-word">{lang === "pt" ? "Toque e veja seu plano nascer" : lang === "es" ? "Toca y mira tu plan armarse" : "Tap and watch your plan build itself"}</h2>
        </Reveal>
        <div className="mt-8"><PricingConfigurator /></div>
      </section>

      {/* FAQ — reuse the shared Guileo FAQ */}
      {t.faq?.items && (
        <section className="wrap pb-16">
          <Reveal className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight text-g-word">{t.faq.h2 || "FAQ"}</h2>
          </Reveal>
          <Accordion items={t.faq.items} />
        </section>
      )}

      {/* internal links → blog articles (SEO cross-linking) */}
      <section className="wrap pb-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? "Leia mais" : lang === "es" ? "Leer más" : "Related reading"}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <a href="/blog/missed-calls-money" className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12.5px] text-g-ink transition hover:border-g-gold/40 hover:text-g-word">📉 {lang === "pt" ? "Quanto custam as ligações perdidas" : lang === "es" ? "Lo que cuestan las llamadas perdidas" : "What missed calls cost you"}</a>
            <a href="/blog/speed-to-lead" className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12.5px] text-g-ink transition hover:border-g-gold/40 hover:text-g-word">⚡ {lang === "pt" ? "Speed-to-lead: a regra dos 60s" : lang === "es" ? "Speed-to-lead: la regla de 60s" : "Speed-to-lead: the 60s rule"}</a>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 text-center">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-black tracking-tight text-g-word sm:text-3xl">{lang === "pt" ? `Pare de perder dinheiro com ${L(v.pain)}.` : lang === "es" ? `Deja de perder dinero por ${L(v.pain)}.` : `Stop losing money to ${L(v.pain)}.`}</h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Magnetic><a href="#pricing" className="btn-bright text-sm">{lang === "pt" ? "Começar agora" : lang === "es" ? "Empezar ahora" : "Get started"}</a></Magnetic>
            <button type="button" onClick={() => setQuote({ catName: L(v.name) })} className="btn-ghost text-sm">{lang === "pt" ? "Falar com a gente" : lang === "es" ? "Hablar con nosotros" : "Talk to us"}</button>
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
