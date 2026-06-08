import { useState, useEffect } from "react";

// LegsV2 — TEST (/v2) beat 3: the 3 legs of Guileo = the whole growth engine.
// Brain (Performance) · AD (Sales) · Build (Growth). Interactive: click a leg → its
// detail crossfades in; auto-rotates for movement. This is the PRODUCT explanation —
// Guileo is an ecosystem, not one bot. Guileo design system + smooth CSS motion.

const LEGS = [
  {
    key: "Guileo Brain", word: "Performance", icon: "🧠", accent: "green",
    line: "The AI that does the work.",
    points: ["Answers every call & message, 24/7", "Books, quotes, sells, follows up", "Speaks your customer's language"],
    out: "More done — zero extra hours",
  },
  {
    key: "Guileo AD", word: "Sales", icon: "🎯", accent: "gold",
    line: "We hunt new clients for you.",
    points: ["Finds & captures leads across every channel", "Voice · message · social · email", "Re-engages and wins back the lost ones"],
    out: "A pipeline that never runs dry",
  },
  {
    key: "Guileo Build", word: "Growth", icon: "🏗️", accent: "copper",
    line: "The assets it all runs on.",
    points: ["Websites, apps & custom software", "Built for you — and owned by you", "The foundation everything plugs into"],
    out: "Infrastructure that compounds",
  },
];

const C = {
  green: { text: "text-g-green", ring: "border-g-green/50 bg-g-green/12", dot: "bg-g-green", tile: "from-g-green/30 to-g-green/5" },
  gold: { text: "text-g-gold", ring: "border-g-gold/50 bg-g-gold/12", dot: "bg-g-gold", tile: "from-g-gold/30 to-g-gold/5" },
  copper: { text: "text-g-copper", ring: "border-g-copper/50 bg-g-copper/12", dot: "bg-g-copper", tile: "from-g-copper/30 to-g-copper/5" },
};

export default function LegsV2() {
  const [sel, setSel] = useState(0);
  const [auto, setAuto] = useState(true);
  const L = LEGS[sel];
  const c = C[L.accent];

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setSel((i) => (i + 1) % LEGS.length), 3600);
    return () => clearInterval(t);
  }, [auto]);

  return (
    <section className="relative overflow-hidden bg-g-cream px-5 py-20">
      <style>{`
        @keyframes lreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lshine{to{background-position:220% center}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.28em] text-g-gold" style={{ animation: "lreveal .7s ease both" }}>Not a bot — a growth engine</div>
        <h2 className="mt-4 font-black tracking-tight" style={{ fontSize: "clamp(2.1rem,4.8vw,3.5rem)" }}>
          <span className="text-g-word" style={{ animation: "lreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>Three engines. </span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "lreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, lshine 7s linear infinite" }}>One Guileo.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "lreveal .8s ease .3s both" }}>
          Guileo isn't one AI — it's the whole system that <span className="font-semibold text-g-green">runs</span> and <span className="font-semibold text-g-copper">grows</span> your business.
        </p>
      </div>

      {/* 3 interactive legs */}
      <div className="mx-auto mt-10 grid max-w-5xl gap-3 md:grid-cols-3" onMouseEnter={() => setAuto(false)} onMouseLeave={() => setAuto(true)}>
        {LEGS.map((leg, i) => {
          const cc = C[leg.accent];
          const on = i === sel;
          return (
            <button key={leg.key} onClick={() => { setSel(i); setAuto(false); }}
              className={`rounded-2xl border p-5 text-left transition-all duration-300 ${on ? `-translate-y-1 ${cc.ring} shadow-[0_24px_60px_-40px_rgba(0,0,0,0.8)]` : "border-g-line bg-white/[0.03] hover:-translate-y-0.5 hover:bg-white/[0.05]"}`}
              style={{ animation: `lreveal .6s cubic-bezier(.2,.7,.2,1) ${0.2 + i * 0.1}s both` }}>
              <div className="flex items-center justify-between">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${cc.tile} text-2xl ring-1 ring-white/10`}>{leg.icon}</div>
                <span className={`text-[11px] font-black uppercase tracking-widest ${cc.text}`}>{leg.word}</span>
              </div>
              <div className="mt-4 text-[17px] font-bold text-g-word">{leg.key}</div>
              <div className="mt-1 text-[13.5px] text-g-ink">{leg.line}</div>
            </button>
          );
        })}
      </div>

      {/* detail panel — crossfades to the selected leg */}
      <div className="mx-auto mt-4 max-w-5xl">
        <div key={sel} className="grid gap-5 rounded-2xl border border-g-line bg-white/[0.04] p-6 backdrop-blur-sm sm:grid-cols-[1fr_auto] sm:items-center" style={{ animation: "lfade .5s ease both" }}>
          <ul className="space-y-2">
            {L.points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[14px] text-g-ink">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} /> {p}
              </li>
            ))}
          </ul>
          <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold ${c.ring} ${c.text}`}>▲ {L.out}</div>
        </div>
      </div>

      {/* the synthesis line */}
      <div className="mx-auto mt-8 flex items-center justify-center gap-2 text-[13px] font-black uppercase tracking-wider" style={{ animation: "lreveal .8s ease .6s both" }}>
        <span className="text-g-green">⚡ Performance</span>
        <span className="text-g-muted">→</span>
        <span className="text-g-gold">Sales</span>
        <span className="text-g-muted">→</span>
        <span className="text-g-copper">Growth</span>
        <span className="ml-2 text-g-muted normal-case font-medium">— your whole business, on one system.</span>
      </div>
    </section>
  );
}
