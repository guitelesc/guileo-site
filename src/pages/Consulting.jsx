import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { waLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { Reveal, Stagger, Item, Magnetic, Aurora } from "../lib/ui.jsx";

// ─────────────────────────────────────────────────────────────
// Guileo Consulting — 360° advisory (AI & automation + Growth +
// Business/operations). The model: a FREE strategy call is the
// lead-gen front door that converts to paid services. So the
// PRIMARY CTA everywhere is "Book a free strategy call".
// ─────────────────────────────────────────────────────────────

const T = {
  en: {
    seoTitle: "Guileo Consulting — AI + growth strategy, free strategy call",
    seoDesc: "360° advisory for your business: AI & automation, growth/marketing and operations. Start with a free 30-min strategy call — a founder diagnoses where you're leaking money and what to fix first.",
    eyebrow: "Consulting · Strategy",
    h1: "Strategy that turns your business into a system.",
    sub: "Start with a free strategy call. A founder diagnoses where your business is leaking money — and shows you what AI and growth unlock first. No commitment.",
    ctaPrimary: "Book a free strategy call →",
    ctaSecondary: "See all services →",
    waMsg: "Hi Guileo! I'd like to book a free strategy call.",

    adviseTitle: "What we advise on",
    adviseSub: "One team, three lenses on your business — so the plan is whole, not a patch.",
    cards: [
      { icon: "🤖", title: "AI & Automation strategy", body: "Where AI actually earns its keep — calls answered, follow-ups sent, bookings closed — and what to automate first for real ROI." },
      { icon: "📈", title: "Growth & Marketing", body: "A clear path to more qualified leads: positioning, offers and channels that fit your market, not generic playbooks." },
      { icon: "⚙️", title: "Business & Operations", body: "Tighten how the work flows — the bottlenecks, the handoffs, the leaks — so growth doesn't break what you've built." },
      { icon: "🧭", title: "360° Advisory (ongoing)", body: "A founder in your corner month to month: priorities, decisions and accountability as the business moves." },
    ],

    howTitle: "How it works",
    howSub: "Simple, honest, and built to move fast.",
    steps: [
      { n: "1", title: "Free strategy call", body: "A 30-minute diagnosis. We find where you're leaking money and what's worth fixing first. No commitment." },
      { n: "2", title: "A clear plan", body: "You get a roadmap — what to do, in what order, and the ROI we expect. Yours to keep, whoever executes it." },
      { n: "3", title: "We execute or advise", body: "You pick: hand it to us to build and run, or keep us as advisors while your team executes." },
    ],

    whoTitle: "Who it's for",
    whoSub: "If you run a business that lives on calls, bookings and leads, this is for you.",
    chips: ["Clinics", "Restaurants", "Home services", "E-commerce", "Agencies", "Founders"],

    bandKicker: "Free strategy call · no commitment · 30 min",
    bandTitle: "Let's find where your business is leaking — and fix it.",
    bandPrimary: "Book a free strategy call →",
    bandSecondary: "💬 Talk on WhatsApp",
  },
  pt: {
    seoTitle: "Guileo Consulting — estratégia de IA e crescimento, conversa grátis",
    seoDesc: "Consultoria 360° pro seu negócio: IA e automação, crescimento/marketing e operações. Comece com uma conversa de estratégia grátis de 30 min — um fundador mostra onde você perde dinheiro e o que ajustar primeiro.",
    eyebrow: "Consultoria · Estratégia",
    h1: "Estratégia que transforma seu negócio num sistema.",
    sub: "Comece com uma conversa de estratégia grátis. Um fundador diagnostica onde seu negócio perde dinheiro — e mostra o que IA e crescimento destravam primeiro. Sem compromisso.",
    ctaPrimary: "Agendar conversa grátis →",
    ctaSecondary: "Ver todos os serviços →",
    waMsg: "Oi Guileo! Quero agendar uma conversa de estratégia grátis.",

    adviseTitle: "No que aconselhamos",
    adviseSub: "Um time, três olhares sobre seu negócio — pra o plano ser inteiro, não um remendo.",
    cards: [
      { icon: "🤖", title: "Estratégia de IA e Automação", body: "Onde a IA realmente paga a conta — ligações atendidas, follow-ups enviados, agendamentos fechados — e o que automatizar primeiro pra ter ROI de verdade." },
      { icon: "📈", title: "Crescimento e Marketing", body: "Um caminho claro pra mais leads qualificados: posicionamento, ofertas e canais que cabem no seu mercado, não fórmulas genéricas." },
      { icon: "⚙️", title: "Negócio e Operações", body: "Ajustar como o trabalho flui — os gargalos, as passagens de bastão, os vazamentos — pra o crescimento não quebrar o que você construiu." },
      { icon: "🧭", title: "Consultoria 360° (contínua)", body: "Um fundador do seu lado mês a mês: prioridades, decisões e responsabilidade enquanto o negócio anda." },
    ],

    howTitle: "Como funciona",
    howSub: "Simples, honesto e feito pra andar rápido.",
    steps: [
      { n: "1", title: "Conversa de estratégia grátis", body: "Um diagnóstico de 30 minutos. Achamos onde você perde dinheiro e o que vale ajustar primeiro. Sem compromisso." },
      { n: "2", title: "Um plano claro", body: "Você recebe um roteiro — o que fazer, em que ordem e o ROI esperado. É seu pra ficar, quem quer que execute." },
      { n: "3", title: "A gente executa ou aconselha", body: "Você escolhe: entrega pra gente construir e operar, ou nos mantém como consultores enquanto seu time executa." },
    ],

    whoTitle: "Pra quem é",
    whoSub: "Se você toca um negócio que vive de ligações, agendamentos e leads, é pra você.",
    chips: ["Clínicas", "Restaurantes", "Serviços em casa", "E-commerce", "Agências", "Fundadores"],

    bandKicker: "Conversa grátis · sem compromisso · 30 min",
    bandTitle: "Vamos achar onde seu negócio perde dinheiro — e resolver.",
    bandPrimary: "Agendar conversa grátis →",
    bandSecondary: "💬 Falar no WhatsApp",
  },
  es: {
    seoTitle: "Guileo Consulting — estrategia de IA y crecimiento, llamada gratis",
    seoDesc: "Consultoría 360° para tu negocio: IA y automatización, crecimiento/marketing y operaciones. Empieza con una llamada de estrategia gratis de 30 min — un fundador diagnostica dónde pierdes dinero y qué corregir primero.",
    eyebrow: "Consultoría · Estrategia",
    h1: "Estrategia que convierte tu negocio en un sistema.",
    sub: "Empieza con una llamada de estrategia gratis. Un fundador diagnostica dónde tu negocio pierde dinero — y te muestra qué desbloquean la IA y el crecimiento primero. Sin compromiso.",
    ctaPrimary: "Agendar llamada gratis →",
    ctaSecondary: "Ver todos los servicios →",
    waMsg: "¡Hola Guileo! Quiero agendar una llamada de estrategia gratis.",

    adviseTitle: "En qué asesoramos",
    adviseSub: "Un equipo, tres miradas sobre tu negocio — para que el plan sea completo, no un parche.",
    cards: [
      { icon: "🤖", title: "Estrategia de IA y Automatización", body: "Dónde la IA realmente rinde — llamadas atendidas, seguimientos enviados, reservas cerradas — y qué automatizar primero para un ROI real." },
      { icon: "📈", title: "Crecimiento y Marketing", body: "Un camino claro a más leads cualificados: posicionamiento, ofertas y canales que encajan con tu mercado, no fórmulas genéricas." },
      { icon: "⚙️", title: "Negocio y Operaciones", body: "Afinar cómo fluye el trabajo — los cuellos de botella, los traspasos, las fugas — para que el crecimiento no rompa lo que construiste." },
      { icon: "🧭", title: "Asesoría 360° (continua)", body: "Un fundador a tu lado mes a mes: prioridades, decisiones y responsabilidad mientras el negocio avanza." },
    ],

    howTitle: "Cómo funciona",
    howSub: "Simple, honesto y hecho para avanzar rápido.",
    steps: [
      { n: "1", title: "Llamada de estrategia gratis", body: "Un diagnóstico de 30 minutos. Encontramos dónde pierdes dinero y qué vale corregir primero. Sin compromiso." },
      { n: "2", title: "Un plan claro", body: "Recibes una hoja de ruta — qué hacer, en qué orden y el ROI esperado. Es tuya, la ejecute quien la ejecute." },
      { n: "3", title: "Ejecutamos o asesoramos", body: "Tú eliges: déjanos construirlo y operarlo, o mantennos como asesores mientras tu equipo ejecuta." },
    ],

    whoTitle: "Para quién es",
    whoSub: "Si llevas un negocio que vive de llamadas, reservas y leads, es para ti.",
    chips: ["Clínicas", "Restaurantes", "Servicios a domicilio", "E-commerce", "Agencias", "Fundadores"],

    bandKicker: "Llamada gratis · sin compromiso · 30 min",
    bandTitle: "Encontremos dónde tu negocio pierde dinero — y arreglémoslo.",
    bandPrimary: "Agendar llamada gratis →",
    bandSecondary: "💬 Hablar por WhatsApp",
  },
};

export default function Consulting() {
  const { lang } = useLang();
  const L = T[lang] || T.en;
  const wa = waLink(L.waMsg);

  useSeo({ title: L.seoTitle, description: L.seoDesc, path: "/consulting" });

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-28 pb-20">

        {/* 1 · Hero */}
        <section className="relative">
          <Aurora />
          <Reveal className="text-center max-w-3xl mx-auto" variant="blur">
            <span className="inline-block text-[11px] font-black uppercase tracking-[0.14em] text-g-gold border border-g-gold/25 bg-g-gold/[0.08] rounded-full px-3 py-1">{L.eyebrow}</span>
            <h1 className="mt-5 text-4xl sm:text-6xl font-black text-g-word tracking-tight leading-[1.05]">{L.h1}</h1>
            <p className="mt-5 text-base sm:text-lg text-g-light/85 leading-relaxed max-w-2xl mx-auto">{L.sub}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Magnetic>
                <a href={wa} target="_blank" rel="noopener" className="btn-gold text-sm sm:text-base">{L.ctaPrimary}</a>
              </Magnetic>
              <a href="/servicos" className="btn-ghost text-sm sm:text-base">{L.ctaSecondary}</a>
            </div>
          </Reveal>
        </section>

        {/* 2 · What we advise on */}
        <section className="mt-24 sm:mt-28">
          <Reveal className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black text-g-word tracking-tight">{L.adviseTitle}</h2>
            <p className="mt-3 text-g-muted">{L.adviseSub}</p>
          </Reveal>
          <Stagger className="mt-10 grid sm:grid-cols-2 gap-5">
            {L.cards.map((c, i) => (
              <Item key={i}>
                <div className="h-full rounded-3xl border border-white/15 bg-white/[0.03] backdrop-blur p-6 sm:p-7 transition-all hover:border-g-gold/40 hover:bg-white/[0.05]">
                  <div className="grid place-items-center h-12 w-12 rounded-2xl bg-white/[0.06] border border-white/10 text-2xl">{c.icon}</div>
                  <h3 className="mt-4 text-lg font-extrabold text-g-word">{c.title}</h3>
                  <p className="mt-2 text-sm text-g-light/85 leading-relaxed">{c.body}</p>
                </div>
              </Item>
            ))}
          </Stagger>
        </section>

        {/* 3 · How it works */}
        <section className="mt-24 sm:mt-28">
          <Reveal className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black text-g-word tracking-tight">{L.howTitle}</h2>
            <p className="mt-3 text-g-muted">{L.howSub}</p>
          </Reveal>
          <Stagger className="mt-10 grid md:grid-cols-3 gap-5">
            {L.steps.map((s, i) => (
              <Item key={i}>
                <div className="relative h-full rounded-3xl border border-white/15 bg-white/[0.03] backdrop-blur p-6 sm:p-7 overflow-hidden">
                  <div className="absolute -top-4 -right-2 text-[6rem] font-black leading-none text-white/[0.04] select-none">{s.n}</div>
                  <div className="relative">
                    <span className="grid place-items-center h-10 w-10 rounded-full bg-g-green/15 border border-g-green/30 text-g-green font-black">{s.n}</span>
                    <h3 className="mt-4 text-lg font-extrabold text-g-word">{s.title}</h3>
                    <p className="mt-2 text-sm text-g-light/85 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              </Item>
            ))}
          </Stagger>
        </section>

        {/* 4 · Who it's for */}
        <section className="mt-24 sm:mt-28">
          <Reveal className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black text-g-word tracking-tight">{L.whoTitle}</h2>
            <p className="mt-3 text-g-muted">{L.whoSub}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-2.5">
              {L.chips.map((chip, i) => (
                <span key={i} className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] backdrop-blur px-4 py-2 text-sm font-semibold text-g-word transition-colors hover:border-g-gold/40">{chip}</span>
              ))}
            </div>
          </Reveal>
        </section>

        {/* 5 · Closing CTA band */}
        <section className="mt-24 sm:mt-28">
          <Reveal variant="scale">
            <div className="relative rounded-3xl border border-white/15 bg-white/[0.03] backdrop-blur-xl p-8 sm:p-14 text-center overflow-hidden shadow-lift">
              <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-g-gold/15 blur-3xl animate-aurora pointer-events-none" />
              <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-g-green/15 blur-3xl animate-aurora pointer-events-none" style={{ animationDelay: "-6s" }} />
              <div className="relative max-w-2xl mx-auto">
                <span className="inline-block text-[11px] font-black uppercase tracking-[0.14em] text-g-green border border-g-green/30 bg-g-green/[0.08] rounded-full px-3 py-1">{L.bandKicker}</span>
                <h2 className="mt-5 text-2xl sm:text-4xl font-black text-g-word tracking-tight">{L.bandTitle}</h2>
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                  <Magnetic>
                    <a href={wa} target="_blank" rel="noopener" className="btn-gold text-sm sm:text-base">{L.bandPrimary}</a>
                  </Magnetic>
                  <a href={wa} target="_blank" rel="noopener" className="btn-ghost text-sm sm:text-base">{L.bandSecondary}</a>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

      </main>
      <Footer />
      <VoiceAgent />
    </div>
  );
}
