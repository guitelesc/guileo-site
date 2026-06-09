import { useState, useEffect } from "react";
import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";

const LV_COPY = {
  en: { eyebrow:"More than automation — your whole operation", h1a:"We don't just automate. ", h1b:"We grow your business.", biz:"YOUR BUSINESS", st:["● connected","automated","growing 24/7"], cta:"Get this for my business" },
  pt: { eyebrow:"Mais que automação — sua operação inteira", h1a:"Não só automatizamos. ", h1b:"Fazemos você crescer.", biz:"SEU NEGÓCIO", st:["● conectado","automatizado","crescendo 24/7"], cta:"Quero isso no meu negócio" },
  es: { eyebrow:"Más que automatización — toda tu operación", h1a:"No solo automatizamos. ", h1b:"Hacemos crecer tu negocio.", biz:"TU NEGOCIO", st:["● conectado","automatizado","creciendo 24/7"], cta:"Quiero esto en mi negocio" },
  hi: { eyebrow:"सिर्फ़ ऑटोमेशन नहीं — आपका पूरा ऑपरेशन", h1a:"हम सिर्फ़ ऑटोमेट नहीं करते. ", h1b:"हम आपका व्यवसाय बढ़ाते हैं।", biz:"आपका व्यवसाय", st:["● कनेक्टेड","ऑटोमेटेड","24/7 बढ़ता"], cta:"मेरे व्यवसाय के लिए चाहिए" },
};

// LegsV2 — TEST (/v2) beat 3: "We run your operation." 2 columns:
// LEFT = the 3 compact engines (Brain · Build · AD). RIGHT = the Guileo plant as the
// RESULT — money & good things growing out of it (the business bearing fruit).
// Content adapted from guileoai.com. Guileo design system + smooth CSS motion.

const LEGS = [
  { tag: "Guileo Brain", icon: "🧠", accent: "green", title: "AI agents that never sleep", desc: "Answer calls, book appointments, qualify leads & close — 24/7, any language.", chips: ["🎙️ Voice", "💬 WhatsApp", "📅 Bookings", "🎧 Support"] },
  { tag: "Guileo Build", icon: "🛠️", accent: "ocean", title: "Websites · Apps · Software", desc: "AI-crafted sites, intelligent apps & custom software — built to convert & scale.", chips: ["🌐 Websites", "📱 Apps", "🛒 Shopify", "⚙️ Automation"] },
  { tag: "Guileo.AD", icon: "📈", accent: "gold", title: "Your whole operation, run", desc: "Not just tasks — content, paid ads, social & funnels across every channel.", chips: ["📝 Content", "📣 Ads −40% waste", "🎯 Leads", "🔄 Funnels"] },
];

const C = {
  green: { text: "text-g-green", on: "border-g-green/45 bg-g-green/[0.07] shadow-[0_22px_55px_-32px_rgba(62,148,104,0.8)]", tile: "from-g-green/70 to-g-green/25", tring: "ring-g-green/50", bar: "from-g-green to-g-light", chip: "border-g-green/30 bg-g-green/[0.10] text-g-green", dot: "bg-g-green" },
  ocean: { text: "text-[#4E9DB0]", on: "border-[#4E9DB0]/45 bg-[#4E9DB0]/[0.07] shadow-[0_22px_55px_-32px_rgba(78,157,176,0.8)]", tile: "from-[#4E9DB0]/70 to-[#4E9DB0]/25", tring: "ring-[#4E9DB0]/50", bar: "from-[#4E9DB0] to-[#7FC3D0]", chip: "border-[#4E9DB0]/30 bg-[#4E9DB0]/[0.12] text-[#7FC3D0]", dot: "bg-[#4E9DB0]" },
  gold: { text: "text-g-gold", on: "border-g-gold/45 bg-g-gold/[0.07] shadow-[0_22px_55px_-32px_rgba(214,194,154,0.8)]", tile: "from-g-gold/70 to-g-gold/25", tring: "ring-g-gold/50", bar: "from-g-gold to-g-copper", chip: "border-g-gold/30 bg-g-gold/[0.10] text-g-gold", dot: "bg-g-gold" },
};

// money & good things the plant "produces"
const FRUITS = ["💰", "📈", "⭐", "🎯", "💵", "📅", "🚀", "💚"];
// accent rgb for the live "energy feeding the business" connection
const ACCENT_RGB = { green: "62,148,104", ocean: "78,157,176", gold: "214,194,154" };

export default function LegsV2() {
  const { lang } = useLang();
  const L = LV_COPY[lang] || LV_COPY.en;
  const [sel, setSel] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setSel((i) => (i + 1) % LEGS.length), 2600);
    return () => clearInterval(t);
  }, [auto]);

  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`
        @keyframes lreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lshine{to{background-position:220% center}}
        @keyframes lmoney{0%{transform:translateY(10px) scale(.7);opacity:0}18%{opacity:1}100%{transform:translateY(-120px) scale(1.15);opacity:0}}
        @keyframes lbreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes lsheen{0%{transform:translateX(-120%)}55%,100%{transform:translateX(120%)}}
        @keyframes lsonar{0%{transform:scale(.55);opacity:.55}100%{transform:scale(1.7);opacity:0}}
        @keyframes lflowin{0%{left:-2%;opacity:0}14%{opacity:1}86%{opacity:1}100%{left:100%;opacity:0}}
        @keyframes lroot{to{stroke-dashoffset:-12}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "lreveal .7s ease both" }}>{L.eyebrow}</div>
        <h2 className="mt-4 font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "lreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{L.h1a}</span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "lreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, lshine 7s linear infinite" }}>{L.h1b}</span>
        </h2>
      </div>

      <div className="relative mx-auto mt-10 grid max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        {/* ROOTS — the plant's roots reach out and plug into all 3 engines; energy feeds back into the business */}
        <svg className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {LEGS.map((leg, i) => {
            const rgb = ACCENT_RGB[leg.accent];
            const on = i === sel;
            const d = ["M68,47 C 60,30 56,16 50,16", "M68,47 C 60,47 56,47 50,47", "M68,47 C 60,64 56,78 50,78"][i];
            return (
              <g key={leg.tag}>
                <path d={d} fill="none" stroke={`rgba(${rgb},${on ? 0.45 : 0.2})`} strokeWidth={on ? 1.1 : 0.6} strokeLinecap="round" />
                <path d={d} fill="none" stroke={`rgba(${rgb},${on ? 0.95 : 0.5})`} strokeWidth={on ? 0.9 : 0.5} strokeLinecap="round" strokeDasharray="1.6 4" style={{ animation: `lroot ${on ? 1.0 : 1.6}s linear infinite` }} />
                <circle r={on ? 1.5 : 1} fill={`rgb(${rgb})`} style={{ filter: `drop-shadow(0 0 4px rgba(${rgb},0.9))` }}>
                  <animateMotion dur={`${on ? 1.0 : 1.6}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={d} />
                </circle>
              </g>
            );
          })}
        </svg>

        {/* LEFT — the 3 compact engines */}
        <div className="space-y-2.5" onMouseEnter={() => setAuto(false)} onMouseLeave={() => setAuto(true)}>
          {LEGS.map((leg, i) => {
            const c = C[leg.accent];
            const on = i === sel;
            return (
              <button key={leg.tag} onClick={() => { setSel(i); setAuto(false); }}
                className={`group relative flex w-full items-start gap-4 overflow-hidden rounded-2xl border py-4 pl-6 pr-4 text-left transition-all duration-300 ${on ? `${c.on} translate-x-1` : "border-g-line bg-white/[0.025] hover:bg-white/[0.05]"}`}
                style={{ animation: `lreveal .6s cubic-bezier(.2,.7,.2,1) ${0.15 + i * 0.1}s both` }}>
                {/* accent bar */}
                <span className={`absolute left-0 top-0 h-full bg-gradient-to-b ${c.bar} transition-all duration-300 ${on ? "w-1.5 opacity-100" : "w-1 opacity-45 group-hover:opacity-80"}`} />
                {/* sheen sweep on the active card */}
                {on && <span className="pointer-events-none absolute inset-0" style={{ animation: "lsheen 2.6s ease-in-out infinite", background: "linear-gradient(105deg,transparent,rgba(255,255,255,0.07),transparent)" }} />}
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${c.tile} text-2xl ring-1 ${c.tring} drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-all duration-300 ${on ? "scale-110 ring-2" : "group-hover:scale-105"}`}>{leg.icon}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[14px] font-black uppercase tracking-wide text-g-word">{leg.title}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${c.text}`}>
                      <span className={`h-1 w-1 rounded-full ${c.dot}`} />{leg.tag}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-snug text-g-ink">{leg.desc}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {leg.chips.map((ch) => (
                      <span key={ch} className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold ${c.chip}`}>{ch}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* RIGHT — the plant = the result; the 3 engines FEED it, live */}
        <div className="relative grid place-items-center py-6">
          <div className="pointer-events-none absolute inset-0 blur-2xl transition-colors duration-700" style={{ background: `radial-gradient(closest-side,rgba(${ACCENT_RGB[LEGS[sel].accent]},0.20),transparent)` }} />

          {/* money & fruit floating out */}
          {FRUITS.map((f, i) => (
            <span key={i} className="pointer-events-none absolute text-xl" style={{ left: `${18 + i * 9}%`, bottom: "42%", animation: `lmoney ${3 + (i % 3)}s ease-in ${i * 0.5}s infinite` }}>{f}</span>
          ))}

          {/* sonar rings — the business "receiving" the energy, in the active engine's color */}
          <span className="pointer-events-none absolute top-[42%] h-40 w-40 -translate-y-1/2 rounded-full border" style={{ borderColor: `rgba(${ACCENT_RGB[LEGS[sel].accent]},0.35)`, animation: "lsonar 2.6s ease-out infinite" }} />
          <span className="pointer-events-none absolute top-[42%] h-40 w-40 -translate-y-1/2 rounded-full border" style={{ borderColor: `rgba(${ACCENT_RGB[LEGS[sel].accent]},0.35)`, animation: "lsonar 2.6s ease-out infinite 1.3s" }} />

          <img src={mark} alt="Guileo" className="relative z-10 w-[230px] max-w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]" style={{ animation: "lbreathe 6s ease-in-out infinite" }} />
          <div className="relative z-10 mt-2 text-center">
            <div className="text-[18px] font-black tracking-tight text-g-word">{L.biz}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider">
              <span className="text-g-green">{L.st[0]}</span> <span className="text-g-muted">·</span> <span className="text-g-gold">{L.st[1]}</span> <span className="text-g-muted">·</span> <span className="text-g-copper">{L.st[2]}</span>
            </div>
            <a href="#contact" className="group relative mt-5 inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3 text-[14px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
              style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
              <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
              <span className="relative">{L.cta}</span>
              <span className="relative text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
