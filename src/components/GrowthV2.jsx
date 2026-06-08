import { useState, useEffect } from "react";

// GrowthV2 — TEST (/v2) finale: "The result — a growth cycle that runs itself."
// ⚡ Performance → 💰 Sales → 🚀 Growth. Made to STAND OUT (darker band, glow, launching
// rocket, big stats). Guileo design system + smooth CSS motion.

const STAGES = [
  { icon: "⚡", word: "Performance", accent: "text-g-green", glow: "rgba(62,148,104,0.5)", line: "Gui does the work — flawlessly, 24/7." },
  { icon: "💰", word: "Sales", accent: "text-g-gold", glow: "rgba(214,194,154,0.5)", line: "More booked, more closed, more revenue." },
  { icon: "🚀", word: "Growth", accent: "text-g-copper", glow: "rgba(194,168,120,0.5)", line: "It compounds — month after month." },
];

export default function GrowthV2() {
  const [act, setAct] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAct((i) => (i + 1) % STAGES.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative overflow-hidden bg-g-deep px-5 py-24">
      <style>{`
        @keyframes greveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gshine{to{background-position:220% center}}
        @keyframes glaunch{0%,100%{transform:translateY(2px)}50%{transform:translateY(-10px)}}
        @keyframes gflame{0%,100%{opacity:.5;transform:scaleY(.8)}50%{opacity:1;transform:scaleY(1.25)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      {/* dramatic glows so it stands out */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.16),transparent),radial-gradient(700px_360px_at_80%_100%,rgba(214,194,154,0.12),transparent)]" />

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.3em] text-g-gold" style={{ animation: "greveal .7s ease both" }}>The result</div>
        <h2 className="mx-auto mt-4 max-w-3xl font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2.3rem,5.2vw,4rem)" }}>
          <span className="text-g-word" style={{ animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>A growth cycle </span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .2s both, gshine 6s linear infinite" }}>that runs itself.</span>
        </h2>

        {/* the 3 stages, lighting up in sequence */}
        <div className="mx-auto mt-12 flex max-w-4xl flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
          {STAGES.map((s, i) => {
            const on = i === act;
            const isRocket = s.word === "Growth";
            return (
              <div key={s.word} className="flex items-center gap-4 sm:flex-col sm:gap-3">
                <div className="flex flex-1 flex-col items-center sm:flex-none">
                  <div className="grid h-20 w-20 place-items-center rounded-3xl border text-4xl ring-1 ring-white/10 transition-all duration-500"
                    style={{ borderColor: on ? s.glow : "rgba(43,39,32,1)", boxShadow: on ? `0 0 50px -8px ${s.glow}` : "none", background: on ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)" }}>
                    <span style={{ animation: isRocket ? "glaunch 1.6s ease-in-out infinite" : "none", display: "inline-block" }}>{s.icon}</span>
                  </div>
                  <div className={`mt-3 text-[16px] font-black uppercase tracking-wider ${s.accent}`}>{s.word}</div>
                  <div className="mt-1 max-w-[180px] text-[12.5px] leading-snug text-g-muted">{s.line}</div>
                </div>
                {i < STAGES.length - 1 && <span className="text-2xl text-g-line sm:rotate-0">→</span>}
              </div>
            );
          })}
        </div>

        {/* big proof stats */}
        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4" style={{ animation: "greveal .8s ease .5s both" }}>
          {[["+286%", "performance"], ["3×", "faster sales cycles"], ["24/7", "on autopilot"]].map(([n, l]) => (
            <div key={l} className="rounded-2xl border border-g-line bg-white/[0.03] p-4">
              <div className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-[30px] font-black text-transparent sm:text-[38px]">{n}</div>
              <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-g-muted">{l}</div>
            </div>
          ))}
        </div>

        <a href="#contact" className="mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-g-green to-g-dark px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110" style={{ animation: "greveal .8s ease .65s both" }}>
          🚀 Start your growth cycle <span>→</span>
        </a>
      </div>
    </section>
  );
}
