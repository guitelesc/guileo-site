import Navbar from "../components/Navbar";
import { useSeo } from "../lib/seo.js";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { waLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";

// NossaGente — THE BLUE OCEAN. Bilingual/immigrant + Brazil positioning.
// AI that speaks YOUR language, understands YOUR business, and serves your
// customers with the trust of someone from your community. NY 🗽 + Cuiabá 🇧🇷,
// both sides of the border. This is the differentiator nobody else owns.

const NG_COPY = {
  en: {
    eyebrow: "🌎 AI FOR OUR PEOPLE",
    h1a: "Answers, sells & grows your business — ", h1b: "in your language.",
    sub: "Portuguese, Spanish, English — Gui speaks the way you speak, understands your business, and serves your customers with the confidence of someone from your community.",
    trustLabel: "🤝 Made by people who get it",
    trustH: "ORIGEM LTDA (marca Guileo) — Cuiabá 🇧🇷, atendendo clientes nos EUA 🗽.",
    trustSub: "Language, culture and trust — not a generic call center. We're the cross-border bridge: Gui handles your business here AND keeps the family in Brazil close. Your people, served by your people.",
    cardsLabel: "💚 Why it works for us",
    cards: [
      { emoji: "💬", title: "WhatsApp that sells", desc: "In Brazil 92% of people use WhatsApp — so that's where Gui answers and closes. Right where your customer already lives." },
      { emoji: "🗣️", title: "Native voice PT / ES / EN", desc: "Not robotic translation — Gui speaks natural, with the warmth and slang of someone who actually grew up speaking it." },
      { emoji: "🤝", title: "Community trust", desc: "Word of mouth is everything for us — your people refer your people. Gui answers every one with the trust that keeps them coming." },
    ],
    flagH: "On both sides of the border",
    flagSub: "From New York to Cuiabá — Gui keeps your business and your roots connected.",
    cta: "I want Gui in my business →",
    waMsg: "Hi Guileo! I want Gui in my business — answering in my language.",
  },
  pt: {
    eyebrow: "🌎 A IA DA NOSSA GENTE",
    h1a: "Atende, vende e cresce o seu negócio — ", h1b: "na sua língua.",
    sub: "Português, espanhol, inglês — o Gui fala como você fala, entende o seu negócio, e atende seus clientes com a confiança de quem é da sua comunidade.",
    trustLabel: "🤝 Feito por quem entende",
    trustH: "ORIGEM LTDA (marca Guileo) — Cuiabá 🇧🇷, atendendo clientes nos EUA 🗽.",
    trustSub: "Língua, cultura e confiança — não é call center genérico. Somos a ponte entre os dois lados: o Gui atende seu negócio aqui E mantém a família no Brasil perto. Sua gente, atendida pela sua gente.",
    cardsLabel: "💚 Por que funciona pra nós",
    cards: [
      { emoji: "💬", title: "WhatsApp que vende", desc: "No Brasil 92% usa WhatsApp — é lá que o Gui atende e fecha. Bem onde o seu cliente já está." },
      { emoji: "🗣️", title: "Voz nativa PT / ES / EN", desc: "Não é tradução robótica — o Gui fala natural, com o calor e a gíria de quem cresceu falando aquilo." },
      { emoji: "🤝", title: "Confiança de comunidade", desc: "Boca a boca é tudo pra nós — sua gente indica sua gente. O Gui atende cada um com a confiança que faz voltar." },
    ],
    flagH: "Dos dois lados da fronteira",
    flagSub: "De New York a Cuiabá — o Gui mantém seu negócio e suas raízes conectados.",
    cta: "Quero o Gui no meu negócio →",
    waMsg: "Oi Guileo! Quero o Gui no meu negócio — atendendo na minha língua.",
  },
  es: {
    eyebrow: "🌎 LA IA DE NUESTRA GENTE",
    h1a: "Atiende, vende y hace crecer tu negocio — ", h1b: "en tu idioma.",
    sub: "Portugués, español, inglés — Gui habla como tú hablas, entiende tu negocio, y atiende a tus clientes con la confianza de alguien de tu comunidad.",
    trustLabel: "🤝 Hecho por quien lo entiende",
    trustH: "ORIGEM LTDA (marca Guileo) — Cuiabá 🇧🇷, atendendo clientes nos EUA 🗽.",
    trustSub: "Idioma, cultura y confianza — no es un call center genérico. Somos el puente entre los dos lados: Gui atiende tu negocio aquí Y mantiene a la familia en Brasil cerca. Tu gente, atendida por tu gente.",
    cardsLabel: "💚 Por qué funciona para nosotros",
    cards: [
      { emoji: "💬", title: "WhatsApp que vende", desc: "En Brasil el 92% usa WhatsApp — ahí es donde Gui atiende y cierra. Justo donde tu cliente ya está." },
      { emoji: "🗣️", title: "Voz nativa PT / ES / EN", desc: "No es traducción robótica — Gui habla natural, con la calidez y el modismo de quien creció hablándolo." },
      { emoji: "🤝", title: "Confianza de comunidad", desc: "El boca a boca lo es todo para nosotros — tu gente recomienda a tu gente. Gui atiende a cada uno con la confianza que los hace volver." },
    ],
    flagH: "En ambos lados de la frontera",
    flagSub: "De New York a Cuiabá — Gui mantiene tu negocio y tus raíces conectados.",
    cta: "Quiero a Gui en mi negocio →",
    waMsg: "¡Hola Guileo! Quiero a Gui en mi negocio — atendiendo en mi idioma.",
  },
  hi: {
    eyebrow: "🌎 हमारे लोगों की AI",
    h1a: "आपके व्यवसाय के लिए जवाब देती, बेचती और उसे बढ़ाती है — ", h1b: "आपकी भाषा में।",
    sub: "पुर्तगाली, स्पेनिश, अंग्रेज़ी — Gui वैसे बोलती है जैसे आप बोलते हैं, आपका व्यवसाय समझती है, और आपके ग्राहकों को अपने समुदाय के इंसान जैसे भरोसे से संभालती है।",
    trustLabel: "🤝 उन लोगों का बनाया जो समझते हैं",
    trustH: "ORIGEM LTDA (marca Guileo) — Cuiabá 🇧🇷, atendendo clientes nos EUA 🗽.",
    trustSub: "भाषा, संस्कृति और भरोसा — कोई जेनेरिक कॉल सेंटर नहीं। हम दोनों ओर का पुल हैं: Gui यहाँ आपका व्यवसाय संभालती है और ब्राज़ील में परिवार को भी क़रीब रखती है। आपके लोग, आपके लोगों द्वारा।",
    cardsLabel: "💚 यह हमारे लिए क्यों काम करता है",
    cards: [
      { emoji: "💬", title: "WhatsApp जो बेचता है", desc: "ब्राज़ील में 92% लोग WhatsApp इस्तेमाल करते हैं — इसलिए Gui वहीं जवाब देती और डील बंद करती है। ठीक वहाँ, जहाँ आपका ग्राहक पहले से है।" },
      { emoji: "🗣️", title: "नेटिव आवाज़ PT / ES / EN", desc: "रोबोटिक अनुवाद नहीं — Gui स्वाभाविक बोलती है, उसी गर्मजोशी और लहजे के साथ जैसे कोई उसी भाषा में पला-बढ़ा हो।" },
      { emoji: "🤝", title: "समुदाय का भरोसा", desc: "हमारे लिए मुँह-ज़ुबानी सिफ़ारिश ही सब कुछ है — आपके लोग आपके लोगों को भेजते हैं। Gui हर एक को उस भरोसे से जवाब देती है जो उन्हें लौटाता है।" },
    ],
    flagH: "सीमा के दोनों ओर",
    flagSub: "New York से Cuiabá तक — Gui आपके व्यवसाय और आपकी जड़ों को जोड़े रखती है।",
    cta: "मुझे अपने व्यवसाय में Gui चाहिए →",
    waMsg: "Hi Guileo! I want Gui in my business — answering in my language.",
  },
};

const CARD_RGB = ["62,148,104", "214,194,154", "194,168,120"];

export default function NossaGente() {
  const { lang } = useLang();
  const L = NG_COPY[lang] || NG_COPY.en;
  useSeo({
    title: lang === "pt" ? "Nossa Gente — IA bilíngue para negócios de imigrantes nos EUA | Guileo"
      : lang === "es" ? "Nossa Gente — IA bilingüe para negocios de inmigrantes en EE.UU. | Guileo"
      : "Nossa Gente — bilingual AI for immigrant-owned businesses in the US | Guileo",
    description: lang === "pt" ? "Atendimento 24/7 em português, espanhol e inglês para o seu negócio. A Guileo atende, agenda e vende por você — nenhum cliente perdido por idioma ou por ligação não atendida."
      : lang === "es" ? "Atención 24/7 en portugués, español e inglés para tu negocio. Guileo contesta, agenda y vende por ti — ningún cliente perdido por idioma ni por llamada sin contestar."
      : "24/7 answering in Portuguese, Spanish and English for your business. Guileo answers, books and sells for you — no customer lost to language or a missed call.",
    path: "/nossa-gente",
  });

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      <style>{`
        @keyframes ngreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ngshine{to{background-position:220% center}}
        @keyframes ngfloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-7px) rotate(3deg)}}
        @keyframes ngwave{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-6px) rotate(4deg)}}
        @keyframes ngpulse{0%,100%{opacity:.55}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      {/* HERO */}
      <header className="relative overflow-hidden px-5 pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.16),transparent),radial-gradient(680px_360px_at_82%_92%,rgba(214,194,154,0.12),transparent)]" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "ngreveal .7s ease both" }}>{L.eyebrow}</div>
          <h1 className="mx-auto mt-4 max-w-2xl font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2.1rem,5vw,3.6rem)" }}>
            <span className="text-g-word" style={{ animation: "ngreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{L.h1a}</span>
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "ngreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, ngshine 7s linear infinite" }}>{L.h1b}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "ngreveal .8s ease .3s both" }}>{L.sub}</p>
        </div>
      </header>

      {/* TRUST / IDENTITY */}
      <section className="relative overflow-hidden px-5 py-12">
        <div className="mx-auto max-w-2xl rounded-xl3 border border-g-gold/35 bg-white/[0.04] p-8 text-center shadow-lift backdrop-blur-xl sm:p-12" style={{ animation: "ngreveal .8s ease both" }}>
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-g-gold/10 blur-3xl animate-aurora" />
          <div className="relative">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-g-gold">{L.trustLabel}</div>
            <div className="mt-5 flex items-center justify-center gap-3 text-[44px] leading-none">
              <span style={{ filter: "drop-shadow(0 8px 18px rgba(62,148,104,0.5))", animation: "ngwave 4s ease-in-out infinite" }}>🗽</span>
              <span className="text-g-gold/60 text-[24px]">↔</span>
              <span style={{ filter: "drop-shadow(0 8px 18px rgba(214,194,154,0.5))", animation: "ngwave 4s ease-in-out 1s infinite" }}>🇧🇷</span>
            </div>
            <h2 className="mt-5 font-black leading-[1.05] tracking-tight text-g-word" style={{ fontSize: "clamp(1.4rem,3vw,2rem)" }}>{L.trustH}</h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-g-ink">{L.trustSub}</p>
          </div>
        </div>
      </section>

      {/* 3 CARDS */}
      <section className="relative px-5 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-g-gold" style={{ animation: "ngreveal .8s ease both" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-g-green shadow-[0_0_8px_rgba(62,148,104,0.9)]" style={{ animation: "ngpulse 2.2s ease-in-out infinite" }} />
            {L.cardsLabel}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {L.cards.map((c, i) => {
              const rgb = CARD_RGB[i];
              return (
                <div key={i} className="group relative overflow-hidden rounded-2xl border border-g-line bg-white/[0.03] p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
                  style={{ boxShadow: "0 18px 44px -30px rgba(0,0,0,0.85)", animation: `ngreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.12}s both` }}>
                  <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.85),transparent)` }} />
                  <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: `rgba(${rgb},0.12)` }} />
                  <div className="select-none text-[40px] leading-none" style={{ filter: `drop-shadow(0 8px 18px rgba(${rgb},0.5))`, animation: `ngfloat ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite` }}>{c.emoji}</div>
                  <h3 className="mt-4 font-black tracking-tight text-g-word" style={{ fontSize: "clamp(1.1rem,2.2vw,1.35rem)" }}>{c.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-g-ink">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FLAG ROW */}
      <section className="relative overflow-hidden px-5 py-16 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(640px_300px_at_50%_50%,rgba(62,148,104,0.12),transparent)]" />
        <div className="mx-auto flex max-w-md items-center justify-center gap-3 text-[48px] leading-none" style={{ animation: "ngreveal .8s ease both" }}>
          {["🇧🇷", "🇵🇹", "🇪🇸", "🇺🇸"].map((f, i) => (
            <span key={i} style={{ filter: "drop-shadow(0 8px 18px rgba(214,194,154,0.4))", animation: `ngwave ${3.5 + i * 0.4}s ease-in-out ${i * 0.25}s infinite` }}>{f}</span>
          ))}
        </div>
        <h2 className="mx-auto mt-6 max-w-lg font-black leading-[1.05] tracking-tight" style={{ fontSize: "clamp(1.5rem,3.5vw,2.2rem)" }}>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "ngshine 7s linear infinite" }}>{L.flagH}</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-g-ink">{L.flagSub}</p>
      </section>

      {/* CTA */}
      <section className="relative px-5 pb-24 text-center">
        <a href={waLink(L.waMsg)} target="_blank" rel="noopener" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-8 py-3.5 text-[15px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
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
