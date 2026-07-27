import Navbar from "../components/Navbar";
import { useSeo } from "../lib/seo.js";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { waLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";

// Compliance — the MOAT as a trust page. TCPA / A2P 10DLC done-for-you.
// In the US, sending SMS/calls without the right rules means fines of
// $500–$1,500 PER message and carriers block your number. Guileo handles
// it all: A2P registration, consent capture, automatic opt-out.

const CM_COPY = {
  en: {
    eyebrow: "🛡️ COMPLIANCE, HANDLED",
    h1a: "Your messages never blocked. ", h1b: "You never fined.",
    sub: "In the US, sending an SMS or call without the right rules (TCPA / A2P 10DLC) costs $500 to $1,500 PER message — and carriers block your number. Guileo handles all of it: A2P registration, consent, automatic opt-out.",
    cardsLabel: "✅ What we handle for you",
    cards: [
      { emoji: "📋", title: "A2P 10DLC registration", desc: "We register your number and brand with the carriers — approved sender, messages delivered, never silently dropped." },
      { emoji: "✅", title: "Consent captured", desc: "Every lead comes with a recorded opt-in — your proof against a fine. If it's ever questioned, you have the receipt." },
      { emoji: "🚫", title: "Automatic opt-out", desc: "A customer texts \"STOP\" and Gui stops on the spot — handled automatically, so you stay protected without lifting a finger." },
    ],
    sealLabel: "🔒 Built on the standards that matter",
    cta: "Sell with confidence →",
  },
  pt: {
    eyebrow: "🛡️ CONFORMIDADE BLINDADA",
    h1a: "Suas mensagens nunca bloqueadas. ", h1b: "Você nunca multado.",
    sub: "Nos EUA, mandar SMS ou ligação sem as regras certas (TCPA / A2P 10DLC) dá multa de $500 a $1.500 POR mensagem — e as operadoras bloqueiam seu número. A Guileo cuida de tudo: registro A2P, consentimento, opt-out automático.",
    cardsLabel: "✅ O que cuidamos por você",
    cards: [
      { emoji: "📋", title: "Registro A2P 10DLC", desc: "Registramos seu número e sua marca nas operadoras — remetente aprovado, mensagens entregues, nunca derrubadas em silêncio." },
      { emoji: "✅", title: "Consentimento capturado", desc: "Cada lead vem com opt-in registrado — sua prova contra multa. Se for questionado, você tem o comprovante." },
      { emoji: "🚫", title: "Opt-out automático", desc: "O cliente manda \"STOP\" e o Gui para na hora — tratado no automático, então você fica protegido sem mexer um dedo." },
    ],
    sealLabel: "🔒 Construído nos padrões que importam",
    cta: "Vender com segurança →",
  },
  es: {
    eyebrow: "🛡️ CUMPLIMIENTO BLINDADO",
    h1a: "Tus mensajes nunca bloqueados. ", h1b: "Tú nunca multado.",
    sub: "En EE.UU., enviar un SMS o llamada sin las reglas correctas (TCPA / A2P 10DLC) cuesta de $500 a $1,500 POR mensaje — y las operadoras bloquean tu número. Guileo se encarga de todo: registro A2P, consentimiento, opt-out automático.",
    cardsLabel: "✅ Lo que manejamos por ti",
    cards: [
      { emoji: "📋", title: "Registro A2P 10DLC", desc: "Registramos tu número y tu marca con las operadoras — remitente aprobado, mensajes entregados, nunca descartados en silencio." },
      { emoji: "✅", title: "Consentimiento capturado", desc: "Cada lead viene con opt-in registrado — tu prueba contra una multa. Si se cuestiona, tienes el comprobante." },
      { emoji: "🚫", title: "Opt-out automático", desc: "El cliente escribe \"STOP\" y Gui se detiene al instante — manejado automáticamente, así que quedas protegido sin mover un dedo." },
    ],
    sealLabel: "🔒 Construido sobre los estándares que importan",
    cta: "Vender con seguridad →",
  },
};

const CARD_RGB = ["62,148,104", "214,194,154", "194,168,120"];
const SEALS = ["TCPA", "A2P 10DLC", "CTIA", "LGPD", "GDPR"];

export default function Compliance() {
  useSeo({ title: 'TCPA & A2P 10DLC Compliance for Business SMS | Guileo', description: 'Avoid $500–$1,500 per-message fines. Guileo handles STOP opt-outs, consent logging and A2P 10DLC brand registration — compliance built in, so your texts actually reach customers.', path: '/compliance' });
  const { lang } = useLang();
  const L = CM_COPY[lang] || CM_COPY.en;

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      <style>{`
        @keyframes cmreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cmshine{to{background-position:220% center}}
        @keyframes cmfloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-7px) rotate(3deg)}}
        @keyframes cmshield{0%,100%{transform:translateY(0) scale(1);filter:drop-shadow(0 10px 24px rgba(62,148,104,0.45))}50%{transform:translateY(-6px) scale(1.04);filter:drop-shadow(0 14px 30px rgba(62,148,104,0.65))}}
        @keyframes cmpulse{0%,100%{opacity:.55}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      {/* HERO */}
      <header className="relative overflow-hidden px-5 pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.16),transparent),radial-gradient(680px_360px_at_82%_92%,rgba(214,194,154,0.10),transparent)]" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="select-none text-[56px] leading-none" style={{ animation: "cmshield 4s ease-in-out infinite" }}>🛡️</div>
          <div className="mt-5 text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "cmreveal .7s ease both" }}>{L.eyebrow}</div>
          <h1 className="mx-auto mt-4 max-w-2xl font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.8vw,3.4rem)" }}>
            <span className="text-g-word" style={{ animation: "cmreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{L.h1a}</span>
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "cmreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, cmshine 7s linear infinite" }}>{L.h1b}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "cmreveal .8s ease .3s both" }}>{L.sub}</p>
        </div>
      </header>

      {/* 3 CARDS */}
      <section className="relative px-5 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-g-gold" style={{ animation: "cmreveal .8s ease both" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-g-green shadow-[0_0_8px_rgba(62,148,104,0.9)]" style={{ animation: "cmpulse 2.2s ease-in-out infinite" }} />
            {L.cardsLabel}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {L.cards.map((c, i) => {
              const rgb = CARD_RGB[i];
              return (
                <div key={i} className="group relative overflow-hidden rounded-2xl border border-g-line bg-white/[0.03] p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
                  style={{ boxShadow: "0 18px 44px -30px rgba(0,0,0,0.85)", animation: `cmreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.12}s both` }}>
                  <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.85),transparent)` }} />
                  <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: `rgba(${rgb},0.12)` }} />
                  <div className="select-none text-[40px] leading-none" style={{ filter: `drop-shadow(0 8px 18px rgba(${rgb},0.5))`, animation: `cmfloat ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite` }}>{c.emoji}</div>
                  <h3 className="mt-4 font-black tracking-tight text-g-word" style={{ fontSize: "clamp(1.1rem,2.2vw,1.35rem)" }}>{c.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-g-ink">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TRUST SEAL ROW */}
      <section className="relative overflow-hidden px-5 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(640px_300px_at_50%_50%,rgba(62,148,104,0.12),transparent)]" />
        <div className="mx-auto max-w-3xl rounded-xl3 border border-g-gold/35 bg-white/[0.04] p-8 text-center shadow-lift backdrop-blur-xl sm:p-10" style={{ animation: "cmreveal .8s ease both" }}>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-g-gold">{L.sealLabel}</div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {SEALS.map((s, i) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-g-green/35 bg-g-green/[0.08] px-4 py-2 text-[13px] font-black tracking-wide text-g-green shadow-[0_0_18px_rgba(62,148,104,0.18)]"
                style={{ animation: `cmreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.1}s both` }}>
                ✓ {s}
              </span>
            ))}
          </div>
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
