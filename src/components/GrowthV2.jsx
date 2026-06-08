import { useState, useEffect } from "react";

// GrowthV2 — TEST (/v2) finale: "A growth cycle that runs itself." STANDS OUT — a real
// rocket launch (rises with flickering flame toward the moon, loops) is the centerpiece,
// with the 3 stages as the journey. Guileo design system + smooth CSS motion.

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
        @keyframes grreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes grshine{to{background-position:220% center}}
        @keyframes grlaunch{0%{transform:translateY(60px) rotate(-8deg);opacity:0}12%{opacity:1}82%{opacity:1}100%{transform:translateY(-200px) rotate(-8deg);opacity:0}}
        @keyframes grflame{0%,100%{transform:scaleY(.65);opacity:.6}50%{transform:scaleY(1.35);opacity:1}}
        @keyframes grtwinkle{0%,100%{opacity:.25}50%{opacity:.8}}
        @keyframes grmoon{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.16),transparent),radial-gradient(700px_360px_at_80%_100%,rgba(214,194,154,0.12),transparent)]" />

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.3em] text-g-gold" style={{ animation: "grreveal .7s ease both" }}>The result</div>
        <h2 className="mx-auto mt-4 max-w-3xl font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2.3rem,5.2vw,4rem)" }}>
          <span className="text-g-word" style={{ animation: "grreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>A growth cycle </span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "grreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, grshine 6s linear infinite" }}>that runs itself.</span>
        </h2>

        {/* the launch scene — rocket flies to the moon, on a loop */}
        <div className="relative mx-auto mt-10 h-56 w-full max-w-sm">
          {/* stars */}
          {[[12, 30], [80, 18], [30, 70], [68, 55], [50, 12], [88, 78]].map(([l, t], i) => (
            <span key={i} className="absolute h-1 w-1 rounded-full bg-g-word" style={{ left: `${l}%`, top: `${t}%`, animation: `grtwinkle ${2 + (i % 3)}s ease-in-out ${i * 0.4}s infinite` }} />
          ))}
          {/* moon */}
          <div className="absolute right-6 top-2 text-5xl" style={{ animation: "grmoon 5s ease-in-out infinite", filter: "drop-shadow(0 0 18px rgba(214,194,154,0.5))" }}>🌙</div>
          {/* launch pad glow */}
          <div className="absolute bottom-3 left-1/2 h-6 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(62,148,104,0.35),transparent)] blur-md" />
          {/* rocket + flame */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2" style={{ animation: "grlaunch 3.4s ease-in infinite" }}>
            <div className="text-5xl" style={{ transform: "rotate(45deg)" }}>🚀</div>
            <div className="mx-auto -mt-1 w-3 origin-top rounded-b-full bg-gradient-to-b from-g-gold via-orange-400 to-transparent" style={{ height: "28px", animation: "grflame .18s ease-in-out infinite" }} />
          </div>
        </div>

        {/* the 3 stages */}
        <div className="mx-auto mt-6 flex max-w-3xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {STAGES.map((s, i) => {
            const on = i === act;
            return (
              <div key={s.word} className="flex items-center gap-3 sm:flex-col">
                <div className="flex flex-1 flex-col items-center sm:flex-none">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border text-2xl ring-1 ring-white/10 transition-all duration-500"
                    style={{ borderColor: on ? s.glow : "rgba(43,39,32,1)", boxShadow: on ? `0 0 40px -8px ${s.glow}` : "none", background: on ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)" }}>{s.icon}</div>
                  <div className={`mt-2 text-[14px] font-black uppercase tracking-wider ${s.accent}`}>{s.word}</div>
                </div>
                {i < STAGES.length - 1 && <span className="text-xl text-g-line">→</span>}
              </div>
            );
          })}
        </div>

        {/* big proof stats */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-4" style={{ animation: "grreveal .8s ease .5s both" }}>
          {[["+286%", "performance"], ["3×", "faster sales cycles"], ["24/7", "on autopilot"]].map(([n, l]) => (
            <div key={l} className="rounded-2xl border border-g-line bg-white/[0.03] p-4">
              <div className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-[30px] font-black text-transparent sm:text-[38px]">{n}</div>
              <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-g-muted">{l}</div>
            </div>
          ))}
        </div>

        <a href="#contact" className="mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-g-green to-g-dark px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110" style={{ animation: "grreveal .8s ease .65s both" }}>
          🚀 Start your growth cycle <span>→</span>
        </a>
      </div>
    </section>
  );
}
