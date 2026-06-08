import { useState, useEffect } from "react";

// EngineV2 — TEST (/v2): Guileo AD — the marketing engine. The data flywheel (conversation
// → YOUR data → marketing → repeat revenue → loops) inside the premium gold glass card
// (guileoai.com aesthetic). Guileo design system + smooth CSS motion.

const STEPS = [
  { n: "1", icon: "📞", title: "Every conversation", desc: "Calls, WhatsApp, SMS & web — your AI captures and understands each one." },
  { n: "2", icon: "🧠", title: "Becomes YOUR data", desc: "Unified customer profiles, with consent: who they are, what they want, when they buy." },
  { n: "3", icon: "📣", title: "Powers your marketing", desc: "Campaigns & ads built from your customers' real behavior — not guesses." },
  { n: "4", icon: "💰", title: "Drives repeat revenue", desc: "More repeat orders, fewer no-shows, smarter ad spend — on autopilot." },
];

export default function EngineV2() {
  const [act, setAct] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAct((i) => (i + 1) % STEPS.length), 1900);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative overflow-hidden bg-g-creamd px-5 py-20">
      <style>{`
        @keyframes ereveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes eshine{to{background-position:220% center}}
        @keyframes espin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}.espin{animation:none !important}}
      `}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_-10%,rgba(214,194,154,0.08),transparent)]" />

      <div className="mx-auto max-w-5xl text-center">
        <div className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "ereveal .7s ease both" }}>
          <span className="espin inline-block" style={{ animation: "espin 6s linear infinite" }}>♻️</span> Guileo AD · the marketing engine
        </div>
        <h2 className="mt-4 font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "ereveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>Every conversation </span>
          <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "ereveal .8s cubic-bezier(.2,.7,.2,1) .2s both, eshine 7s linear infinite" }}>compounds.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "ereveal .8s ease .3s both" }}>
          Guileo AD turns each call into <span className="font-semibold text-g-word">data</span>, data into smarter <span className="font-semibold text-g-gold">marketing</span>, marketing into <span className="font-semibold text-g-green">repeat revenue</span> — on a loop.
        </p>
      </div>

      {/* premium gold glass card (guileoai.com aesthetic) */}
      <div className="relative mx-auto mt-10 max-w-5xl overflow-hidden rounded-xl3 border border-g-gold/30 bg-white/[0.03] p-6 shadow-lift backdrop-blur-xl sm:p-8" style={{ animation: "ereveal .8s ease .35s both" }}>
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-g-gold/10 blur-3xl animate-aurora" />

        <div className="relative grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const on = i === act;
            return (
              <div key={s.n} className="relative">
                <div className={`h-full rounded-2xl border p-5 transition-all duration-500 ${on ? "-translate-y-1 border-g-gold/50 bg-g-gold/[0.08] shadow-gold" : "border-g-line bg-white/[0.03]"}`}>
                  <div className="flex items-center justify-between">
                    <div className={`grid h-11 w-11 place-items-center rounded-xl text-xl ring-1 ring-white/10 transition-colors duration-500 ${on ? "bg-g-gold/25" : "bg-white/[0.05]"}`}>{s.icon}</div>
                    <span className="text-[28px] font-black text-g-line">{s.n}</span>
                  </div>
                  <div className="mt-4 text-[15px] font-bold text-g-word">{s.title}</div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-g-ink">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && <span className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-g-gold lg:block">→</span>}
              </div>
            );
          })}
        </div>

        <div className="relative mx-auto mt-6 flex max-w-3xl items-center justify-center gap-2 rounded-full border border-g-green/25 bg-g-green/[0.06] px-5 py-2.5 text-center text-[13.5px] text-g-ink">
          <span className="espin inline-block" style={{ animation: "espin 5s linear infinite" }}>♻️</span>
          <span><span className="font-semibold text-g-green">And it loops</span> — revenue fuels the next conversation. Your engine spins faster every month.</span>
        </div>
      </div>
    </section>
  );
}
