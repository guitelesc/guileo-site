// MethodV2 — TEST (/v2): "The Guileo Method" — led by real humans, seed → nurture →
// harvest, live in under 7 days. Builds trust before the close. Content from guileoai.com.
// Guileo design system + smooth CSS motion.

const STEPS = [
  { icon: "🌰", when: "Day 01", n: "1", title: "Plant the Seed", desc: "A human studies your business, finds your revenue leaks, and designs a system built around how you actually work.", tag: "we study your business", accent: "text-g-gold" },
  { icon: "🌿", when: "Days 2–7", n: "2", title: "Nurture Growth", desc: "We build & implement it in under 7 days — your AI working 24/7, automating sales & marketing across every channel.", tag: "built & live for you", accent: "text-g-green" },
  { icon: "🌳", when: "Week 2 →", n: "3", title: "Harvest Results", desc: "Watch profits climb. +286% performance and 3× faster sales cycles on average — with us optimizing it for you.", tag: "sales & profit compound", accent: "text-g-copper" },
];

export default function MethodV2() {
  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`
        @keyframes mvreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mvshine{to{background-position:220% center}}
        @keyframes mvgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "mvreveal .7s ease both" }}>The Guileo Method</div>
        <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "mvreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>Led by real humans — </span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "mvreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, mvshine 7s linear infinite" }}>not just bots.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "mvreveal .8s ease .3s both" }}>
          We get to know your business — <span className="font-semibold text-g-word">we'll even visit you</span> — then design and build the system that grows your profit. <span className="font-semibold text-g-green">Live in under 7 days.</span>
        </p>
      </div>

      {/* growth line */}
      <div className="mx-auto mt-10 hidden h-px max-w-4xl bg-gradient-to-r from-g-gold via-g-green to-g-copper md:block" style={{ transformOrigin: "left", animation: "mvgrow 1.2s ease .4s both" }} />

      <div className="mx-auto mt-3 grid max-w-5xl gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.n} className="rounded-2xl border border-g-line bg-white/[0.04] p-6 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm" style={{ animation: `mvreveal .7s cubic-bezier(.2,.7,.2,1) ${0.35 + i * 0.15}s both` }}>
            <div className="flex items-center justify-between">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-3xl ring-1 ring-white/10">{s.icon}</div>
              <div className="text-right">
                <div className={`text-[11px] font-black uppercase tracking-wider ${s.accent}`}>{s.when}</div>
                <div className="text-[26px] font-black text-g-line">{s.n}</div>
              </div>
            </div>
            <h3 className="mt-4 text-[18px] font-bold text-g-word">{s.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-g-ink">{s.desc}</p>
            <div className={`mt-4 inline-flex items-center gap-1.5 rounded-full border border-g-line bg-white/[0.04] px-3 py-1 text-[11.5px] font-semibold ${s.accent}`}>✓ {s.tag}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
