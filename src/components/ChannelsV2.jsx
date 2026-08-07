import { FaTiktok, FaLinkedinIn, FaTelegram, FaFacebookF, FaInstagram, FaWhatsapp, FaGoogle, FaXTwitter } from "react-icons/fa6";
import { useLang } from "../i18n.jsx";

const CV_COPY = {
  en: { eyebrow:"Every channel, automated", h1a:"From LinkedIn to Telegram — ", h1b:"we run them all.", subA:"Content created, scheduled and optimized across ", subB:"all", subM:" your channels. ", subC:"One brain", subD:", every platform, always on.", live:"guileo live · working" },
  pt: { eyebrow:"Todo canal, automatizado", h1a:"Do LinkedIn ao Telegram — ", h1b:"cuidamos de todos.", subA:"Conteúdo criado, agendado e otimizado em ", subB:"todos", subM:" os seus canais. ", subC:"Um cérebro", subD:", todas as plataformas, sempre ligado.", live:"guileo ao vivo · trabalhando" },
  es: { eyebrow:"Cada canal, automatizado", h1a:"De LinkedIn a Telegram — ", h1b:"los manejamos todos.", subA:"Contenido creado, programado y optimizado en ", subB:"todos", subM:" tus canales. ", subC:"Un cerebro", subD:", cada plataforma, siempre activo.", live:"guileo en vivo · trabajando" },
  hi: { eyebrow:"हर चैनल, ऑटोमेटेड", h1a:"LinkedIn से Telegram तक — ", h1b:"हम सब संभालते हैं।", subA:"आपके ", subB:"सभी", subM:" चैनलों पर कंटेंट बनाया, शेड्यूल और ऑप्टिमाइज़ किया जाता है। ", subC:"एक दिमाग", subD:", हर प्लेटफ़ॉर्म, हमेशा ऑन।", live:"guileo लाइव · काम कर रहा है" },
};

// ChannelsV2 — TEST (/v2): "Every channel, automated." REAL brand logos (react-icons),
// phone lock-screen with live notifications streaming up. Guileo design system + CSS motion.

const CH = {
  TikTok: { Icon: FaTiktok, bg: "#010101" },
  LinkedIn: { Icon: FaLinkedinIn, bg: "#0A66C2" },
  Telegram: { Icon: FaTelegram, bg: "#26A5E4" },
  Facebook: { Icon: FaFacebookF, bg: "#1877F2" },
  Instagram: { Icon: FaInstagram, bg: "linear-gradient(45deg,#f09433,#dc2743,#bc1888)" },
  WhatsApp: { Icon: FaWhatsapp, bg: "#25D366" },
  Google: { Icon: FaGoogle, bg: "#4285F4" },
  X: { Icon: FaXTwitter, bg: "#000000" },
};

const NOTIFS = [
  { app: "TikTok", t: "3m", line: { en: "Posted a clip · 12.4k views overnight", pt: "Postou um clipe · 12,4k views da noite pro dia", es: "Publicó un clip · 12,4k vistas de la noche a la mañana", hi: "क्लिप पोस्ट की · रातभर में 12.4k व्यू" } },
  { app: "LinkedIn", t: "6m", line: { en: "Published an article · 18 new leads", pt: "Publicou um artigo · 18 novos leads", es: "Publicó un artículo · 18 nuevos leads", hi: "आर्टिकल पब्लिश किया · 18 नए लीड" } },
  { app: "Telegram", t: "9m", line: { en: "Answered 30 group questions instantly", pt: "Respondeu 30 perguntas no grupo na hora", es: "Respondió 30 preguntas del grupo al instante", hi: "ग्रुप के 30 सवालों के तुरंत जवाब दिए" } },
  { app: "Facebook", t: "12m", line: { en: "Replied to 24 comments & messages", pt: "Respondeu 24 comentários e mensagens", es: "Respondió 24 comentarios y mensajes", hi: "24 कमेंट और मैसेज के जवाब दिए" } },
  { app: "Instagram", t: "15m", line: { en: "Scheduled 5 reels for the week", pt: "Agendou 5 reels para a semana", es: "Programó 5 reels para la semana", hi: "हफ़्ते के लिए 5 रील शेड्यूल कीं" } },
  { app: "WhatsApp", t: "20m", line: { en: "Closed 3 sales right in the chat", pt: "Fechou 3 vendas direto no chat", es: "Cerró 3 ventas directo en el chat", hi: "चैट में ही 3 बिक्री पूरी कीं" } },
  { app: "Google", t: "26m", line: { en: "Replied to 7 reviews · kept 4.9★", pt: "Respondeu 7 avaliações · manteve 4,9★", es: "Respondió 7 reseñas · mantuvo 4,9★", hi: "7 समीक्षाओं के जवाब दिए · 4.9★ बनाए रखा" } },
  { app: "X", t: "31m", line: { en: "Posted a thread · 2.1k impressions", pt: "Postou uma thread · 2,1k impressões", es: "Publicó un hilo · 2,1k impresiones", hi: "थ्रेड पोस्ट किया · 2.1k इंप्रेशन" } },
];

function Logo({ app, size = 16 }) {
  const c = CH[app];
  const Icon = c.Icon;
  return (
    <span className="grid shrink-0 place-items-center rounded-[9px] text-white" style={{ width: size + 16, height: size + 16, background: c.bg }}>
      <Icon size={size} />
    </span>
  );
}

function Notif({ n, lang = "en" }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.08] px-3.5 py-2.5 backdrop-blur-md">
      <Logo app={n.app} size={16} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold text-white">{n.app} · <span className="text-g-green">Guileo AI</span></span>
          <span className="text-[10px] text-white/70">{n.t}</span>
        </div>
        <div className="truncate text-[11.5px] text-white/70">{(n.line && (n.line[lang] || n.line.en)) || n.line}</div>
      </div>
    </div>
  );
}

export default function ChannelsV2() {
  const { lang } = useLang();
  const V = CV_COPY[lang] || CV_COPY.en;
  const list = [...NOTIFS, ...NOTIFS];
  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`
        @keyframes chreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes chshine{to{background-position:220% center}}
        @keyframes chscroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}
        @keyframes chpulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes chfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        {/* LEFT — copy */}
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "chreveal .7s ease both" }}>{V.eyebrow}</div>
          <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
            <span className="text-g-word" style={{ animation: "chreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{V.h1a}</span>
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "chreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, chshine 7s linear infinite" }}>{V.h1b}</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-g-ink" style={{ animation: "chreveal .8s ease .3s both" }}>
            {V.subA}<span className="font-semibold text-g-word">{V.subB}</span>{V.subM}<span className="font-semibold text-g-green">{V.subC}</span>{V.subD}
          </p>
          <div className="mt-7 flex flex-wrap gap-3" style={{ animation: "chreveal .8s ease .4s both" }}>
            {Object.entries(CH).map(([app, c]) => {
              const Icon = c.Icon;
              return (
                <span key={app} title={app} className="grid h-12 w-12 place-items-center rounded-full text-white ring-1 ring-white/15 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.8)] transition-transform duration-300 hover:-rotate-6 hover:scale-110" style={{ background: c.bg }}>
                  <Icon size={20} />
                </span>
              );
            })}
          </div>
        </div>

        {/* RIGHT — phone lock-screen with streaming notifications */}
        <div className="relative mx-auto w-[330px] max-w-full" style={{ animation: "chreveal .9s ease .35s both" }}>
          <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,rgba(62,148,104,0.18),transparent)] blur-2xl" />
          <div className="relative rounded-[3rem] bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] p-[8px] ring-1 ring-white/10 shadow-[0_60px_150px_-30px_rgba(0,0,0,0.9)]" style={{ animation: "chfloat 7s ease-in-out 1.4s infinite" }}>
            <div className="relative overflow-hidden rounded-[2.6rem] bg-gradient-to-b from-[#10120f] to-[#0a0b08]">
              <div className="absolute left-1/2 top-2.5 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black" />
              <div className="px-6 pb-3 pt-9 text-center">
                <div className="text-[12px] font-semibold text-white/60">Saturday, June 7</div>
                <div className="text-[56px] font-bold leading-none text-white">9:41</div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-g-green/30 bg-g-green/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-g-green">
                  <span className="h-1.5 w-1.5 rounded-full bg-g-green" style={{ animation: "chpulse 1.6s ease-in-out infinite" }} /> {V.live}
                </div>
              </div>
              <div className="relative h-[300px] overflow-hidden px-3 pb-5" style={{ maskImage: "linear-gradient(to bottom,transparent,#000 10%,#000 88%,transparent)", WebkitMaskImage: "linear-gradient(to bottom,transparent,#000 10%,#000 88%,transparent)" }}>
                <div className="space-y-2.5" style={{ animation: "chscroll 22s linear infinite" }}>
                  {list.map((n, i) => <Notif key={i} n={n} lang={lang} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
