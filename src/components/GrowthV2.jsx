import { useState, useEffect } from "react";

// GrowthV2 — TEST (/v2) finale: matched to the guileoai.com aesthetic — the real
// rocket-launch (SVG body + flame, launchpad=Performance, fuel=Sales, moon=Growth)
// inside the premium gold glass card. animate-rocketlaunch/flameflicker are global.

const STATS = [["+286%", "performance"], ["3×", "faster sales cycles"], ["24/7", "on autopilot"]];

export default function GrowthV2() {
  const [act, setAct] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAct((i) => (i + 1) % 3), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative overflow-hidden px-5 py-24">
      <style>{`@keyframes grreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes grshine{to{background-position:220% center}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.16),transparent),radial-gradient(700px_360px_at_80%_100%,rgba(214,194,154,0.12),transparent)]" />

      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mx-auto max-w-2xl font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2.2rem,5vw,3.7rem)" }}>
          <span className="text-g-word" style={{ animation: "grreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>A growth cycle </span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "grreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, grshine 6s linear infinite" }}>that runs itself.</span>
        </h2>

        {/* premium gold glass card (guileoai.com aesthetic) */}
        <div className="relative mx-auto mt-10 max-w-2xl overflow-hidden rounded-xl3 border border-g-gold/35 bg-white/[0.04] p-8 text-center shadow-lift backdrop-blur-xl sm:p-12" style={{ animation: "grreveal .8s ease .3s both" }}>
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-g-gold/10 blur-3xl animate-aurora" />
          <div className="relative mb-6 text-base font-extrabold uppercase tracking-[0.2em] text-g-gold sm:text-lg">The result</div>

          {/* ROCKET LAUNCH scene */}
          <div className="relative mx-auto h-72 w-64 select-none sm:h-80 sm:w-72">
            {/* starfield */}
            {[...Array(16)].map((_, i) => (
              <span key={i} className="absolute animate-pulse rounded-full bg-white" style={{ height: 2, width: 2, left: `${(i * 53) % 96}%`, top: `${(i * 31) % 64}%`, opacity: 0.25 + ((i * 7) % 5) / 12, animationDelay: `${(i % 5) * 0.4}s` }} />
            ))}
            {/* MOON = Growth */}
            <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
              <div className="grid h-16 w-16 animate-breathe place-items-center rounded-full bg-gradient-to-br from-[#f6efe0] via-[#e6d8b6] to-[#bca87d] text-2xl shadow-[0_0_46px_rgba(214,194,154,0.55)]">🌙</div>
              <span className="mt-1.5 whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-g-gold">🚀 Growth · the moon</span>
            </div>
            {/* trajectory */}
            <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <path d="M50 66 Q 46 42 50 26" fill="none" stroke="#D6C29A" strokeOpacity="0.45" strokeWidth="0.7" strokeDasharray="2 3" />
            </svg>
            {/* ROCKET — launches (global animate-rocketlaunch) */}
            <div className="absolute left-1/2 z-10 animate-rocketlaunch" style={{ top: "58%" }}>
              <svg width="58" height="104" viewBox="0 0 64 110" fill="none" className="drop-shadow-[0_0_16px_rgba(214,194,154,0.45)]">
                <defs>
                  <linearGradient id="rkBody2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b9a884" /><stop offset="0.48" stopColor="#fbf6ea" /><stop offset="1" stopColor="#bda77e" /></linearGradient>
                  <linearGradient id="rkFlame2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="0.45" stopColor="#fb923c" /><stop offset="1" stopColor="#ef4444" stopOpacity="0" /></linearGradient>
                </defs>
                <path className="animate-flameflicker" style={{ transformOrigin: "32px 64px" }} d="M23 64 Q32 110 41 64 Q32 80 23 64 Z" fill="url(#rkFlame2)" />
                <path d="M21 48 L9 70 L21 62 Z" fill="#3E9468" /><path d="M43 48 L55 70 L43 62 Z" fill="#3E9468" />
                <path d="M32 3 C 45 17 47 42 44 63 L20 63 C 17 42 19 17 32 3 Z" fill="url(#rkBody2)" stroke="#9c895f" strokeWidth="0.8" />
                <circle cx="32" cy="30" r="7.5" fill="#16201b" stroke="#3E9468" strokeWidth="2.2" /><circle cx="32" cy="30" r="3" fill="#7FC9A0" />
                <path d="M32 5 C 38 12 40 20 40 27 L33 24 Z" fill="#ffffff" opacity="0.28" />
              </svg>
            </div>
            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-g-light" style={{ top: "64%" }}>💰 Sales · the fuel</span>
            {/* LAUNCHPAD = Performance */}
            <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
              <div className="h-1.5 w-32 rounded-full bg-gradient-to-r from-transparent via-g-green/70 to-transparent blur-[1px]" />
              <div className="h-3 w-20 rounded-b-md border-x border-b border-white/15 bg-white/[0.06]" />
              <span className="mt-1 whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-g-green">⚡ Performance · the base</span>
            </div>
          </div>

          {/* sequence pills */}
          <div className="relative mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {[["⚡", "Performance"], ["💰", "Sales"], ["🚀", "Growth"]].map(([ic, lb], i) => {
              const on = act === i;
              return (
                <div key={lb} className="flex items-center gap-2 sm:gap-3">
                  <div className={`flex items-center gap-2 rounded-full border px-3.5 py-2.5 transition-all duration-500 sm:px-5 ${on ? "scale-105 border-g-gold/60 bg-g-gold/15 shadow-gold" : "border-white/12 bg-white/[0.04]"}`}>
                    <span className="text-lg">{ic}</span><span className="whitespace-nowrap text-sm font-extrabold text-g-word">{lb}</span>
                  </div>
                  {i < 2 && <span className="text-lg font-black text-g-gold">→</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* stats + CTA */}
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-4" style={{ animation: "grreveal .8s ease .5s both" }}>
          {STATS.map(([n, l]) => (
            <div key={l} className="rounded-2xl border border-g-line bg-white/[0.03] p-4">
              <div className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-[28px] font-black text-transparent sm:text-[36px]">{n}</div>
              <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-g-muted">{l}</div>
            </div>
          ))}
        </div>
        <a href="#contact" className="mt-9 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-g-green to-g-dark px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110" style={{ animation: "grreveal .8s ease .6s both" }}>
          🚀 Start your growth cycle <span>→</span>
        </a>
      </div>
    </section>
  );
}
