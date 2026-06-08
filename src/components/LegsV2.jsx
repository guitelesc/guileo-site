import { useState, useEffect } from "react";
import mark from "../assets/guileo-mark.png";

// LegsV2 — TEST (/v2) beat 3: "We run your operation." 2 columns:
// LEFT = the 3 compact engines (Brain · Build · AD). RIGHT = the Guileo plant as the
// RESULT — money & good things growing out of it (the business bearing fruit).
// Content adapted from guileoai.com. Guileo design system + smooth CSS motion.

const LEGS = [
  { tag: "Guileo Brain", icon: "🧠", accent: "green", title: "AI agents that never sleep", desc: "Answer calls, book appointments, qualify leads & close — 24/7, any language.", chips: ["🎙️ Voice", "💬 WhatsApp", "📅 Bookings", "🎧 Support"] },
  { tag: "Guileo Build", icon: "🛠️", accent: "copper", title: "Websites · Apps · Software", desc: "AI-crafted sites, intelligent apps & custom software — built to convert & scale.", chips: ["🌐 Websites", "📱 Apps", "🛒 Shopify", "⚙️ Automation"] },
  { tag: "Guileo.AD", icon: "📈", accent: "gold", title: "Your whole operation, run", desc: "Not just tasks — content, paid ads, social & funnels across every channel.", chips: ["📝 Content", "📣 Ads −40% waste", "🎯 Leads", "🔄 Funnels"] },
];

const C = {
  green: { text: "text-g-green", on: "border-g-green/40 bg-g-green/[0.06] shadow-[0_22px_55px_-32px_rgba(62,148,104,0.75)]", tile: "from-g-green/35 to-g-green/10", tring: "ring-g-green/30", bar: "from-g-green to-g-light", chip: "border-g-green/25 bg-g-green/[0.08] text-g-green", dot: "bg-g-green" },
  copper: { text: "text-g-copper", on: "border-g-copper/40 bg-g-copper/[0.06] shadow-[0_22px_55px_-32px_rgba(194,168,120,0.75)]", tile: "from-g-copper/35 to-g-copper/10", tring: "ring-g-copper/30", bar: "from-g-copper to-g-gold", chip: "border-g-copper/25 bg-g-copper/[0.08] text-g-copper", dot: "bg-g-copper" },
  gold: { text: "text-g-gold", on: "border-g-gold/40 bg-g-gold/[0.06] shadow-[0_22px_55px_-32px_rgba(214,194,154,0.75)]", tile: "from-g-gold/35 to-g-gold/10", tring: "ring-g-gold/30", bar: "from-g-gold to-g-copper", chip: "border-g-gold/25 bg-g-gold/[0.08] text-g-gold", dot: "bg-g-gold" },
};

// money & good things the plant "produces"
const FRUITS = ["💰", "📈", "⭐", "🎯", "💵", "📅", "🚀", "💚"];

export default function LegsV2() {
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
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "lreveal .7s ease both" }}>More than automation — your whole operation</div>
        <h2 className="mt-4 font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "lreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>We don't just automate. </span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "lreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, lshine 7s linear infinite" }}>We grow your business.</span>
        </h2>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
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
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${c.tile} text-xl ring-1 ${c.tring} transition-all duration-300 ${on ? "scale-110 ring-2" : "group-hover:scale-105"}`}>{leg.icon}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[15px] font-bold text-g-word">{leg.title}</span>
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

        {/* RIGHT — the plant = the result, money growing out of it */}
        <div className="relative grid place-items-center py-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,rgba(62,148,104,0.18),transparent)] blur-2xl" />
          {/* money & fruit floating out */}
          {FRUITS.map((f, i) => (
            <span key={i} className="pointer-events-none absolute text-xl" style={{ left: `${18 + i * 9}%`, bottom: "42%", animation: `lmoney ${3 + (i % 3)}s ease-in ${i * 0.5}s infinite` }}>{f}</span>
          ))}
          <img src={mark} alt="Guileo" className="relative z-10 w-[230px] max-w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]" style={{ animation: "lbreathe 6s ease-in-out infinite" }} />
          <div className="relative z-10 mt-2 text-center">
            <div className="text-[18px] font-black tracking-tight text-g-word">YOUR BUSINESS</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider">
              <span className="text-g-green">● connected</span> <span className="text-g-muted">·</span> <span className="text-g-gold">automated</span> <span className="text-g-muted">·</span> <span className="text-g-copper">growing 24/7</span>
            </div>
            <a href="#contact" className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#181818] px-6 py-3 text-[14px] font-bold text-g-word ring-1 ring-white/15 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.8)] transition hover:ring-g-green/40">
              Get this for my business <span className="text-g-green">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
