import Navbar from "../components/Navbar";
import { useSeo } from "../lib/seo.js";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { waLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";

// HomeServices — niche landing for the easiest-to-close vertical:
// plumbers / HVAC / electricians / roofers. Every missed call is a job
// that went to a competitor. Speed-to-lead is the whole game here.

const HS_COPY = {
  en: {
    eyebrow: "🔧 FOR HOME SERVICES",
    h1a: "Every missed call is ", h1b: "a job that went to your competitor.",
    sub: "62% of service calls go unanswered. The competitor closes the customer in 8 minutes. Gui answers 100% of them, 24/7, and calls back everyone who hung up.",
    bleedLabel: "💸 The money bleeding out",
    stats: [
      { big: "$360K", unit: "/mo", lab: "lost in the roofer example (100 calls × $12k × 30% close)", loss: true },
      { big: "8 min", unit: "", lab: "is all the competitor needs to close your lead" },
      { big: "78%", unit: "", lab: "buy from whoever responds first" },
      { big: "24/7", unit: "", lab: "Gui never sleeps — every call, every hour" },
    ],
    doLabel: "✅ What Gui does for home services",
    cards: [
      { emoji: "📞", title: "Answers every call", desc: "Including emergencies, after-hours and weekends. No voicemail, no missed job — Gui picks up 100% of the time." },
      { emoji: "⚡", title: "Calls ad leads in 60s", desc: "A lead clicks your ad — Gui rings them back in under a minute, while they're still hot and still on your page." },
      { emoji: "📅", title: "Books the service", desc: "Gui qualifies the job, checks your calendar and schedules the visit — no back-and-forth, no dropped appointment." },
      { emoji: "⭐", title: "Asks for the review", desc: "After the job is done, Gui follows up and asks for a 5-star review — more reviews, more inbound, higher rank." },
    ],
    firstLabel: "⏱️ Speed-to-lead",
    firstA: "You're first, ", firstB: "or you're nothing.",
    firstSub: "In home services the customer doesn't shop around — they call three numbers and hire whoever picks up first. Miss the call by 5 minutes and the job is gone. Gui makes sure you're always the one who answers first.",
    cta: "Stop losing jobs →",
  },
  pt: {
    eyebrow: "🔧 PARA SERVIÇOS",
    h1a: "Cada ligação perdida é ", h1b: "um job que foi pro concorrente.",
    sub: "62% das ligações de serviço ficam sem resposta. O concorrente fecha o cliente em 8 minutos. O Gui atende 100%, 24h, e liga de volta quem desligou.",
    bleedLabel: "💸 O dinheiro escorrendo",
    stats: [
      { big: "$360K", unit: "/mês", lab: "perdidos no exemplo do telhadista (100 ligações × $12k × 30% fechamento)", loss: true },
      { big: "8 min", unit: "", lab: "é tudo que o concorrente precisa pra fechar seu lead" },
      { big: "78%", unit: "", lab: "compram de quem responde primeiro" },
      { big: "24/7", unit: "", lab: "o Gui nunca dorme — toda ligação, a qualquer hora" },
    ],
    doLabel: "✅ O que o Gui faz por serviços",
    cards: [
      { emoji: "📞", title: "Atende toda ligação", desc: "Emergência inclusive, fora de hora e fim de semana. Sem caixa postal, sem job perdido — o Gui atende 100% das vezes." },
      { emoji: "⚡", title: "Liga o lead de anúncio em 60s", desc: "O lead clica no seu anúncio — o Gui liga de volta em menos de um minuto, enquanto ainda está quente na sua página." },
      { emoji: "📅", title: "Agenda o serviço", desc: "O Gui qualifica o job, checa sua agenda e marca a visita — sem vai-e-volta, sem agendamento perdido." },
      { emoji: "⭐", title: "Pede avaliação depois", desc: "Terminou o job, o Gui dá retorno e pede a avaliação 5 estrelas — mais reviews, mais clientes, melhor ranqueamento." },
    ],
    firstLabel: "⏱️ Velocidade no lead",
    firstA: "Você é o primeiro, ", firstB: "ou você é nada.",
    firstSub: "Em serviços o cliente não fica pesquisando — ele liga pra três números e contrata quem atender primeiro. Perdeu a ligação por 5 minutos e o job já era. O Gui garante que você sempre seja o primeiro a atender.",
    cta: "Pare de perder jobs →",
  },
  es: {
    eyebrow: "🔧 PARA SERVICIOS",
    h1a: "Cada llamada perdida es ", h1b: "un trabajo que se fue a tu competencia.",
    sub: "62% de las llamadas de servicio quedan sin respuesta. El competidor cierra al cliente en 8 minutos. Gui contesta el 100%, 24h, y devuelve la llamada a quien colgó.",
    bleedLabel: "💸 El dinero que se fuga",
    stats: [
      { big: "$360K", unit: "/mes", lab: "perdidos en el ejemplo del techador (100 llamadas × $12k × 30% cierre)", loss: true },
      { big: "8 min", unit: "", lab: "es todo lo que necesita el competidor para cerrar tu lead" },
      { big: "78%", unit: "", lab: "compran a quien responde primero" },
      { big: "24/7", unit: "", lab: "Gui nunca duerme — cada llamada, a cualquier hora" },
    ],
    doLabel: "✅ Lo que Gui hace por servicios",
    cards: [
      { emoji: "📞", title: "Contesta cada llamada", desc: "Emergencias incluidas, fuera de horario y fines de semana. Sin buzón de voz, sin trabajo perdido — Gui contesta el 100%." },
      { emoji: "⚡", title: "Llama al lead de anuncio en 60s", desc: "El lead hace clic en tu anuncio — Gui le devuelve la llamada en menos de un minuto, mientras sigue caliente." },
      { emoji: "📅", title: "Agenda el servicio", desc: "Gui califica el trabajo, revisa tu calendario y agenda la visita — sin idas y vueltas, sin cita perdida." },
      { emoji: "⭐", title: "Pide la reseña después", desc: "Terminado el trabajo, Gui da seguimiento y pide la reseña de 5 estrellas — más reseñas, más clientes, mejor ranking." },
    ],
    firstLabel: "⏱️ Velocidad al lead",
    firstA: "Eres el primero, ", firstB: "o no eres nada.",
    firstSub: "En servicios el cliente no compara — llama a tres números y contrata a quien conteste primero. Pierdes la llamada por 5 minutos y el trabajo se fue. Gui asegura que siempre seas el primero en contestar.",
    cta: "Deja de perder trabajos →",
  },
};

const CARD_RGB = ["62,148,104", "214,194,154", "194,168,120", "62,148,104"];

export default function HomeServices() {
  useSeo({ title: 'AI Receptionist for Home Services — Plumbing, HVAC & Electrical | Guileo', description: "Never miss an after-hours call again. Guileo's bilingual AI answers, quotes and books jobs 24/7 for plumbers, HVAC and electricians — speed-to-lead in 60 seconds. Live in 7 days, 30-day guarantee.", path: '/home-services' });
  const { lang } = useLang();
  const L = HS_COPY[lang] || HS_COPY.en;

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      <style>{`
        @keyframes hsreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes hsshine{to{background-position:220% center}}
        @keyframes hsfloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-7px) rotate(3deg)}}
        @keyframes hsbleed{0%,100%{transform:scale(1);text-shadow:0 0 26px rgba(220,80,72,0.45)}50%{transform:scale(1.04);text-shadow:0 0 40px rgba(220,80,72,0.7)}}
        @keyframes hspulse{0%,100%{opacity:.55}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      {/* HERO */}
      <header className="relative overflow-hidden px-5 pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.14),transparent),radial-gradient(640px_340px_at_85%_90%,rgba(220,80,72,0.10),transparent)]" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "hsreveal .7s ease both" }}>{L.eyebrow}</div>
          <h1 className="mx-auto mt-4 max-w-2xl font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2.1rem,5vw,3.6rem)" }}>
            <span className="text-g-word" style={{ animation: "hsreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{L.h1a}</span>
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "hsreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, hsshine 7s linear infinite" }}>{L.h1b}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "hsreveal .8s ease .3s both" }}>{L.sub}</p>
        </div>
      </header>

      {/* MONEY BLEEDING STATS */}
      <section className="relative px-5 pb-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-g-gold" style={{ animation: "hsreveal .8s ease both" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-g-gold shadow-[0_0_8px_rgba(214,194,154,0.9)]" style={{ animation: "hspulse 2.2s ease-in-out infinite" }} />
            {L.bleedLabel}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {L.stats.map((s, i) => {
              const rgb = s.loss ? "220,80,72" : CARD_RGB[i];
              return (
                <div key={i} className="group relative overflow-hidden rounded-2xl border bg-white/[0.03] p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
                  style={{ borderColor: `rgba(${rgb},0.28)`, boxShadow: "0 18px 44px -30px rgba(0,0,0,0.85)", animation: `hsreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.12}s both` }}>
                  <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.85),transparent)` }} />
                  <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl" style={{ background: `rgba(${rgb},0.14)` }} />
                  <div className="flex items-baseline gap-1.5 font-black tabular-nums" style={{ color: `rgb(${rgb})`, fontSize: "clamp(2rem,4.5vw,2.8rem)", animation: s.loss ? "hsbleed 3.2s ease-in-out infinite" : "none", textShadow: `0 0 26px rgba(${rgb},0.45)` }}>
                    {s.big}<span className="text-[16px] font-bold opacity-80">{s.unit}</span>
                  </div>
                  <p className="mt-2 text-[13.5px] font-medium leading-snug text-g-word/85">{s.lab}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* WHAT GUI DOES */}
      <section className="relative px-5 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-g-gold" style={{ animation: "hsreveal .8s ease both" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-g-green shadow-[0_0_8px_rgba(62,148,104,0.9)]" style={{ animation: "hspulse 2.2s ease-in-out infinite" }} />
            {L.doLabel}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {L.cards.map((c, i) => {
              const rgb = CARD_RGB[i];
              return (
                <div key={i} className="group relative overflow-hidden rounded-2xl border border-g-line bg-white/[0.03] p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
                  style={{ boxShadow: "0 18px 44px -30px rgba(0,0,0,0.85)", animation: `hsreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.12}s both` }}>
                  <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: `rgba(${rgb},0.12)` }} />
                  <div className="select-none text-[40px] leading-none" style={{ filter: `drop-shadow(0 8px 18px rgba(${rgb},0.5))`, animation: `hsfloat ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite` }}>{c.emoji}</div>
                  <h3 className="mt-4 font-black tracking-tight text-g-word" style={{ fontSize: "clamp(1.15rem,2.2vw,1.4rem)" }}>{c.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-g-ink">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* YOU'RE FIRST OR YOU'RE NOTHING */}
      <section className="relative overflow-hidden px-5 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(640px_320px_at_50%_50%,rgba(62,148,104,0.12),transparent)]" />
        <div className="mx-auto max-w-2xl rounded-xl3 border border-g-gold/35 bg-white/[0.04] p-8 text-center shadow-lift backdrop-blur-xl sm:p-12" style={{ animation: "hsreveal .8s ease both" }}>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-g-gold">{L.firstLabel}</div>
          <h2 className="mt-4 font-black leading-[1.02] tracking-tight" style={{ fontSize: "clamp(1.7rem,4vw,2.6rem)" }}>
            <span className="text-g-word">{L.firstA}</span>
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "hsshine 7s linear infinite" }}>{L.firstB}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-g-ink">{L.firstSub}</p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-5 pb-24 text-center">
        <a href="/#contact" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-8 py-3.5 text-[15px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
          style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
          <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
          <span className="relative">{L.cta}</span>
        </a>
      </section>

      <Footer />
      <VoiceAgent />
    </div>
  );
}
