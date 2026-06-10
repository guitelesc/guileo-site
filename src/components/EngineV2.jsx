import { useState, useEffect } from "react";
import { useLang } from "../i18n.jsx";

const EV_COPY = {
  en: { eyebrow:"Guileo AD · the marketing engine", h1a:"Every conversation ", h1b:"compounds.", sub:["Guileo AD turns each call into ","data",", data into smarter ","marketing",", marketing into ","repeat revenue"," — on a loop."], running:"Running · processing in real time", loopA:"And it loops", loopB:" — revenue fuels the next conversation. Your engine spins faster every month." },
  pt: { eyebrow:"Guileo AD · o motor de marketing", h1a:"Cada conversa ", h1b:"se acumula.", sub:["A Guileo AD transforma cada ligação em ","dados",", dados em ","marketing"," mais esperto, marketing em ","recompra"," — num ciclo."], running:"Rodando · processando em tempo real", loopA:"E faz um ciclo", loopB:" — a receita alimenta a próxima conversa. Seu motor gira mais rápido todo mês." },
  es: { eyebrow:"Guileo AD · el motor de marketing", h1a:"Cada conversación ", h1b:"se acumula.", sub:["Guileo AD convierte cada llamada en ","datos",", datos en ","marketing"," más inteligente, marketing en ","recompra"," — en bucle."], running:"En marcha · procesando en tiempo real", loopA:"Y se repite", loopB:" — el ingreso alimenta la próxima conversación. Tu motor gira más rápido cada mes." },
  hi: { eyebrow:"Guileo AD · मार्केटिंग इंजन", h1a:"हर बातचीत ", h1b:"जुड़ती जाती है।", sub:["Guileo AD हर कॉल को ","डेटा"," में बदलती है, डेटा को बेहतर ","मार्केटिंग"," में, मार्केटिंग को ","रिपीट कमाई"," में — एक चक्र में।"], running:"चल रहा है · रियल-टाइम प्रोसेसिंग", loopA:"और यह दोहराता है", loopB:" — कमाई अगली बातचीत को ईंधन देती है। आपका इंजन हर महीने तेज़ घूमता है।" },
};

// EngineV2 — TEST (/v2): Guileo AD — the marketing engine. The data flywheel (conversation
// → YOUR data → marketing → repeat revenue → loops) inside the premium gold glass card
// (guileoai.com aesthetic). Guileo design system + smooth CSS motion.

const STEPS = [
  { n: "1", icon: "📞", title: "Every conversation", desc: "Calls, WhatsApp, SMS & web — your AI captures and understands each one." },
  { n: "2", icon: "🧠", title: "Becomes YOUR data", desc: "Unified customer profiles, with consent: who they are, what they want, when they buy." },
  { n: "3", icon: "📣", title: "Powers your marketing", desc: "Campaigns & ads built from your customers' real behavior — not guesses." },
  { n: "4", icon: "💰", title: "Drives repeat revenue", desc: "More repeat orders, fewer no-shows, smarter ad spend — on autopilot." },
];

// live "the machine is processing this right now" metrics — derived from a ticking counter
function liveStat(i, n) {
  if (i === 0) return { val: (12840 + n * 3).toLocaleString("en-US"), label: "conversations captured" };
  if (i === 1) return { val: (9210 + n * 2).toLocaleString("en-US"), label: "profiles enriched" };
  if (i === 2) return { val: (43 + Math.floor(n / 3)).toLocaleString("en-US"), label: "campaigns live" };
  return { val: "$" + (48200 + n * 140).toLocaleString("en-US"), label: "revenue driven" };
}

export default function EngineV2() {
  const { t, lang } = useLang();
  const E = EV_COPY[lang] || EV_COPY.en;
  const dictSteps = (t.engine && t.engine.steps) || [];
  const [act, setAct] = useState(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAct((i) => (i + 1) % STEPS.length), 1900);
    const c = setInterval(() => setN((x) => x + 1), 1100);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);

  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`
        @keyframes ereveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes eshine{to{background-position:220% center}}
        @keyframes espin{to{transform:rotate(360deg)}}
        @keyframes eflow{0%{left:-8%;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:104%;opacity:0}}
        @keyframes epulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        @keyframes efloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-7px) rotate(2deg)}}
        @keyframes ecycle{to{stroke-dashoffset:-276}}
        @keyframes espinr{to{transform:translate(-50%,-50%) rotate(-360deg)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}.espin{animation:none !important}}
      `}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_-10%,rgba(214,194,154,0.08),transparent)]" />

      <div className="mx-auto max-w-5xl text-center">
        <div className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "ereveal .7s ease both" }}>
          <span className="espin inline-block" style={{ animation: "espin 6s linear infinite" }}>♻️</span> {E.eyebrow}
        </div>
        <h2 className="mt-4 font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "ereveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{E.h1a}</span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "ereveal .8s cubic-bezier(.2,.7,.2,1) .2s both, eshine 7s linear infinite" }}>{E.h1b}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "ereveal .8s ease .3s both" }}>
          {E.sub[0]}<span className="font-semibold text-g-word">{E.sub[1]}</span>{E.sub[2]}<span className="font-semibold text-g-gold">{E.sub[3]}</span>{E.sub[4]}<span className="font-semibold text-g-green">{E.sub[5]}</span>{E.sub[6]}
        </p>
      </div>

      {/* premium gold glass card (guileoai.com aesthetic) */}
      <div className="relative mx-auto mt-10 max-w-5xl overflow-hidden rounded-xl3 border border-g-gold/30 bg-white/[0.03] p-6 shadow-lift backdrop-blur-xl sm:p-8" style={{ animation: "ereveal .8s ease .35s both" }}>
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-g-gold/10 blur-3xl animate-aurora" />

        {/* system header — reads as a real running machine, not an infographic */}
        <div className="relative z-10 mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-gold">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-g-gold/15 text-[11px] ring-1 ring-g-gold/30">⚙️</span> Guileo Engine
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-g-green">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" /></span>
            {E.running}
          </span>
        </div>

        {/* live energy track behind the row — a pulse of "data" travels the engine left→right (lg) */}
        <div className="pointer-events-none absolute inset-x-8 top-1/2 z-0 hidden h-px -translate-y-1 lg:block" style={{ background: "linear-gradient(90deg,transparent,rgba(214,194,154,0.28),rgba(62,148,104,0.28),transparent)" }}>
          <span className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-g-gold shadow-[0_0_16px_4px_rgba(214,194,154,0.55)]" style={{ animation: "eflow 3.2s linear infinite" }} />
          <span className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-g-green shadow-[0_0_12px_3px_rgba(62,148,104,0.5)]" style={{ animation: "eflow 3.2s linear infinite 1.6s" }} />
        </div>

        <div className="relative z-10 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const on = i === act;
            return (
              <div key={s.n} className="relative">
                <div className={`h-full rounded-2xl border p-5 transition-all duration-500 hover:-translate-y-1 ${on ? "-translate-y-1 border-g-gold/50 bg-g-gold/[0.08] shadow-gold" : "border-g-line bg-white/[0.03] hover:border-g-gold/35 hover:bg-white/[0.05]"}`}>
                  <div className="flex items-start justify-between">
                    {/* free-floating emoji — no box tile, gold glow swells when active */}
                    <span className="select-none text-[38px] leading-none transition-all duration-500"
                      style={{ animation: `efloat ${3 + i * 0.5}s ease-in-out ${i * 0.4}s infinite${on ? ", epulse 1.9s ease-in-out infinite" : ""}`, filter: `drop-shadow(0 6px 14px rgba(214,194,154,${on ? 0.55 : 0.28}))` }}>{s.icon}</span>
                    <span className={`text-[28px] font-black transition-colors duration-500 ${on ? "text-g-gold/70" : "text-g-line"}`}>{s.n}</span>
                  </div>
                  <div className="mt-3.5 font-black leading-[1.1] tracking-tight text-g-word" style={{ fontSize: "clamp(1.05rem,1.5vw,1.25rem)" }}>{dictSteps[i]?.[1] || s.title}</div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-g-ink">{dictSteps[i]?.[2] || s.desc}</p>
                  {(() => { const st = liveStat(i, n); return (
                    <div className="mt-3 flex items-baseline gap-1.5 border-t border-white/[0.08] pt-2.5">
                      <span className="text-[10px] text-g-green">▲</span>
                      <span className="text-[15px] font-black tabular-nums text-g-word">{st.val}</span>
                      <span className="text-[10px] font-semibold leading-tight text-g-muted">{st.label}</span>
                    </div>
                  ); })()}
                </div>
                {i < STEPS.length - 1 && <span className={`absolute -right-2.5 top-1/2 z-20 hidden -translate-y-1/2 text-lg transition-all duration-500 lg:block ${on ? "scale-125 text-g-gold" : "text-g-gold/40"}`}>→</span>}
              </div>
            );
          })}
        </div>

        {/* the flywheel CLOSES — a real CYCLE: the 4 steps orbit a spinning gold ring */}
        <div className="pointer-events-none relative mx-auto mt-7 h-28 w-28" aria-hidden="true">
          {/* soft hub glow */}
          <span className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(closest-side,rgba(214,194,154,0.14),transparent)" }} />
          {/* ring + 4 chasing gold arcs (the energy moving around the cycle) */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(214,194,154,0.18)" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(214,194,154,0.9)" strokeWidth="2" strokeLinecap="round" strokeDasharray="12 57" style={{ animation: "ecycle 3.4s linear infinite" }} />
          </svg>
          {/* the 4 step emojis orbiting (counter-spun so they stay upright) */}
          <div className="absolute inset-0" style={{ animation: "espin 16s linear infinite" }}>
            {STEPS.map((s, k) => (
              <span key={s.n} className="absolute text-[15px]"
                style={{ left: `calc(50% + ${[0, 49, 0, -49][k]}px)`, top: `calc(50% + ${[-49, 0, 49, 0][k]}px)`, filter: "drop-shadow(0 2px 6px rgba(214,194,154,0.5))", animation: "espinr 16s linear infinite" }}>{s.icon}</span>
            ))}
          </div>
          {/* the cycle heart */}
          <span className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center text-[22px]" style={{ animation: "espin 6s linear infinite" }}>♻️</span>
        </div>

        <div className="relative mx-auto mt-2 flex max-w-3xl items-center justify-center gap-2 rounded-full border border-g-green/30 bg-gradient-to-r from-g-green/[0.06] via-g-gold/[0.08] to-g-green/[0.06] bg-[length:200%_auto] px-5 py-2.5 text-center text-[13.5px] text-g-ink" style={{ animation: "eshine 6s linear infinite" }}>
          <span className="espin inline-block" style={{ animation: "espin 5s linear infinite" }}>♻️</span>
          <span><span className="font-semibold text-g-green">{E.loopA}</span>{E.loopB}</span>
        </div>
      </div>
    </section>
  );
}
