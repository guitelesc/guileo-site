import { useState, useEffect } from "react";
import { useLang } from "../i18n.jsx";

const GV_COPY = {
  en: { h1a:"A growth cycle ", h1b:"that runs itself.", result:"The result", sub:"Performance is the base, sales are the fuel — growth is where you land.", moon:"🚀 Growth · the moon", fuel:"💰 Sales · the fuel", base:"⚡ Performance · the base", pills:["Performance","Sales","Growth"], profit:"What lands in YOUR pocket", stats:[["💵","+$15K","/mo extra revenue"],["📈","3.2×","ROI in 90 days"],["♻️","−40%","ad waste recovered"]], cta:"Start your growth cycle" },
  pt: { h1a:"Um ciclo de crescimento ", h1b:"que roda sozinho.", result:"O resultado", sub:"Performance é a base, vendas são o combustível — crescimento é onde você chega.", moon:"🚀 Crescimento · a lua", fuel:"💰 Vendas · o combustível", base:"⚡ Performance · a base", pills:["Performance","Vendas","Crescimento"], profit:"O que cai no SEU bolso", stats:[["💵","+$15K","/mês a mais de receita"],["📈","3.2×","de ROI em 90 dias"],["♻️","−40%","de desperdício em ads"]], cta:"Comece seu ciclo de crescimento" },
  es: { h1a:"Un ciclo de crecimiento ", h1b:"que se mueve solo.", result:"El resultado", sub:"El rendimiento es la base, las ventas el combustible — el crecimiento es a donde llegas.", moon:"🚀 Crecimiento · la luna", fuel:"💰 Ventas · el combustible", base:"⚡ Rendimiento · la base", pills:["Rendimiento","Ventas","Crecimiento"], profit:"Lo que cae en TU bolsillo", stats:[["💵","+$15K","/mes de ingresos extra"],["📈","3.2×","ROI en 90 días"],["♻️","−40%","desperdicio recuperado"]], cta:"Empieza tu ciclo de crecimiento" },
  hi: { h1a:"एक ग्रोथ साइकल ", h1b:"जो खुद चलता है।", result:"नतीजा", sub:"परफ़ॉर्मेंस आधार है, बिक्री ईंधन — ग्रोथ वह जगह है जहाँ आप पहुँचते हैं।", moon:"🚀 ग्रोथ · चाँद", fuel:"💰 बिक्री · ईंधन", base:"⚡ परफ़ॉर्मेंस · आधार", pills:["Performance","Sales","Growth"], profit:"जो आपकी जेब में आता है", stats:[["💵","+$15K","/माह अतिरिक्त कमाई"],["📈","3.2×","ROI 90 दिनों में"],["♻️","−40%","विज्ञापन बर्बादी वापस"]], cta:"अपना ग्रोथ साइकल शुरू करें" },
};

// GrowthV2 — TEST (/v2) finale: matched to the guileoai.com aesthetic — the real
// rocket-launch (SVG body + flame, launchpad=Performance, fuel=Sales, moon=Growth)
// inside the premium gold glass card. animate-rocketlaunch/flameflicker are global.

export default function GrowthV2() {
  const { lang } = useLang();
  const G = GV_COPY[lang] || GV_COPY.en;
  const STATS = G.stats;
  const [act, setAct] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAct((i) => (i + 1) % 3), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`@keyframes grreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes grshine{to{background-position:220% center}}@keyframes grfloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-6px) rotate(3deg)}}@keyframes grdot{0%,100%{opacity:.55}50%{opacity:1}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.16),transparent),radial-gradient(700px_360px_at_80%_100%,rgba(214,194,154,0.12),transparent)]" />

      <div className="mx-auto max-w-3xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "grreveal .7s ease both" }}>🚀 {G.result}</div>
        <h2 className="mx-auto mt-4 max-w-2xl font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2.2rem,5vw,3.7rem)" }}>
          <span className="text-g-word" style={{ animation: "grreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{G.h1a}</span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "grreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, grshine 6s linear infinite" }}>{G.h1b}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "grreveal .8s ease .3s both" }}>{G.sub}</p>

        {/* premium gold glass card (guileoai.com aesthetic) */}
        <div className="relative mx-auto mt-10 max-w-2xl overflow-hidden rounded-xl3 border border-g-gold/35 bg-white/[0.04] p-8 text-center shadow-lift backdrop-blur-xl sm:p-12" style={{ animation: "grreveal .8s ease .3s both" }}>
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-g-gold/10 blur-3xl animate-aurora" />

          {/* ROCKET LAUNCH scene */}
          <div className="relative mx-auto h-72 w-64 select-none sm:h-80 sm:w-72">
            {/* starfield */}
            {[...Array(16)].map((_, i) => (
              <span key={i} className="absolute animate-pulse rounded-full bg-white" style={{ height: 2, width: 2, left: `${(i * 53) % 96}%`, top: `${(i * 31) % 64}%`, opacity: 0.25 + ((i * 7) % 5) / 12, animationDelay: `${(i % 5) * 0.4}s` }} />
            ))}
            {/* MOON = Growth */}
            <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
              <div className="grid h-16 w-16 animate-breathe place-items-center rounded-full bg-gradient-to-br from-[#f6efe0] via-[#e6d8b6] to-[#bca87d] text-2xl shadow-[0_0_46px_rgba(214,194,154,0.55)]">🌙</div>
              <span className="mt-1.5 whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-g-gold">{G.moon}</span>
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
            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-g-light" style={{ top: "64%" }}>{G.fuel}</span>
            {/* LAUNCHPAD = Performance */}
            <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
              <div className="h-1.5 w-32 rounded-full bg-gradient-to-r from-transparent via-g-green/70 to-transparent blur-[1px]" />
              <div className="h-3 w-20 rounded-b-md border-x border-b border-white/15 bg-white/[0.06]" />
              <span className="mt-1 whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-g-green">{G.base}</span>
            </div>
          </div>

          {/* sequence pills */}
          <div className="relative mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {[["⚡", G.pills[0]], ["💰", G.pills[1]], ["🚀", G.pills[2]]].map(([ic, lb], i) => {
              const on = act === i;
              return (
                <div key={lb} className="flex items-center gap-2 sm:gap-3">
                  <div className={`flex items-center gap-2 rounded-full border px-3.5 py-2.5 transition-all duration-500 sm:px-5 ${on ? "scale-110 border-g-gold/60 bg-g-gold/15 shadow-gold" : "border-white/12 bg-white/[0.04]"}`}>
                    <span className={`text-lg transition-transform duration-500 ${on ? "scale-125" : ""}`}>{ic}</span><span className="whitespace-nowrap text-sm font-extrabold text-g-word">{lb}</span>
                  </div>
                  {i < 2 && <span className={`text-lg font-black transition-all duration-500 ${on ? "scale-125 text-g-gold" : "text-g-gold/40"}`}>→</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* PROFIT strip — the essence: what lands in the client's pocket */}
        <div className="mx-auto mt-8 max-w-2xl" style={{ animation: "grreveal .8s ease .45s both" }}>
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-g-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-g-gold shadow-[0_0_8px_rgba(214,194,154,0.9)]" style={{ animation: "grdot 2.2s ease-in-out infinite" }} />
            💰 {G.profit}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {STATS.map(([ic, n, l], i) => {
              const rgb = ["62,148,104", "214,194,154", "194,168,120"][i];
              return (
                <div key={l} className="group relative overflow-hidden rounded-2xl border bg-white/[0.03] p-4 pt-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
                  style={{ borderColor: `rgba(${rgb},0.25)`, boxShadow: `0 18px 44px -30px rgba(0,0,0,0.85)`, animation: `grreveal .7s cubic-bezier(.2,.7,.2,1) ${0.55 + i * 0.15}s both` }}>
                  {/* colored top tick — frames each profit fact */}
                  <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.85),transparent)` }} />
                  <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: `rgba(${rgb},0.12)` }} />
                  <span className="absolute right-3 top-3 select-none text-[18px]" style={{ animation: `grfloat ${2.8 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`, filter: `drop-shadow(0 3px 8px rgba(${rgb},0.5))` }}>{ic}</span>
                  <div className="text-[26px] font-black tabular-nums sm:text-[34px]" style={{ color: `rgb(${rgb})`, textShadow: `0 0 26px rgba(${rgb},0.45)` }}>{n}</div>
                  <div className="mt-1 text-[11.5px] font-bold leading-snug text-g-word/85">{l}</div>
                </div>
              );
            })}
          </div>
        </div>
        <a href="#try" className="group relative mt-9 inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3 text-[14px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
          style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)", animation: "grreveal .8s ease .6s both" }}>
          <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
          <span className="relative">🚀 {G.cta}</span>
          <span className="relative text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
        </a>
      </div>
    </section>
  );
}
