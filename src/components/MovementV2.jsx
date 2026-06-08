// MovementV2 — TEST (/v2) beat 2: "The real move" — the Self-Fulfilling Offer.
// Same Guileo design system: cement + ivory + green/champagne, realistic glass cards,
// smooth staggered reveal + gradient shimmer, sell RESULTS not "AI". Pure CSS motion.

const STEPS = [
  { n: "01", icon: "📦", tile: "from-g-gold/25 to-g-gold/5", title: "You package the offer", desc: "Your service, your prices, your rules — set once. That's it." },
  { n: "02", icon: "🌱", tile: "from-g-green/30 to-g-green/5", title: "Gui fulfills it", desc: "Answers, books, quotes, sells and follows up — 24/7, every call, every time." },
  { n: "03", icon: "🔁", tile: "from-g-copper/30 to-g-copper/5", title: "It sells on repeat", desc: "The same work, sold again & again — while you sleep. You stop trading hours." },
];

export default function MovementV2() {
  return (
    <section className="relative overflow-hidden bg-g-creamd px-5 py-20">
      <style>{`
        @keyframes mreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mshine{to{background-position:220% center}}
        @keyframes mdraw{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_50%_-10%,rgba(214,194,154,0.07),transparent)]" />

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.25em] text-g-gold" style={{ animation: "mreveal .7s ease both" }}>The real move</div>
        <h2 className="mx-auto mt-4 max-w-3xl font-black leading-[0.95] tracking-tight" style={{ fontSize: "clamp(2.1rem,4.6vw,3.4rem)" }}>
          <span className="block text-g-word" style={{ animation: "mreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>Package it once.</span>
          <span className="block bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "mreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, mshine 7s linear infinite" }}>It sells itself forever.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "mreveal .8s ease .3s both" }}>
          Guileo turns your business into a <span className="font-semibold text-g-gold">self-fulfilling offer</span> — the AI does the work, you keep the results.
        </p>
      </div>

      {/* 3 steps */}
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.n} className="relative rounded-xl2 border border-g-line bg-white/[0.04] p-6 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm"
            style={{ animation: `mreveal .7s cubic-bezier(.2,.7,.2,1) ${0.35 + i * 0.15}s both` }}>
            <div className="flex items-center justify-between">
              <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${s.tile} text-2xl ring-1 ring-white/10`}>{s.icon}</div>
              <span className="text-[13px] font-black tracking-widest text-g-muted">{s.n}</span>
            </div>
            <h3 className="mt-5 text-[18px] font-bold text-g-word">{s.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-g-ink">{s.desc}</p>
            {/* connector arrow (desktop) */}
            {i < STEPS.length - 1 && (
              <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-g-gold md:block">→</span>
            )}
          </div>
        ))}
      </div>

      {/* kill the old way */}
      <div className="mx-auto mt-14 max-w-2xl text-center" style={{ animation: "mreveal .8s ease .8s both" }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-g-muted">Stop</div>
        <div className="relative mt-2 inline-block">
          <span className="text-[22px] font-black text-g-word/70 sm:text-[28px]">trading your hours for deliverables.</span>
          <span className="absolute left-0 top-1/2 h-[3px] w-full origin-left rounded bg-g-green/80" style={{ animation: "mdraw .7s ease 1.1s both" }} />
        </div>
      </div>
    </section>
  );
}
