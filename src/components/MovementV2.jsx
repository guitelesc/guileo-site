import { useState, useEffect } from "react";

// MovementV2 — TEST (/v2) beat 2: "Results, not tools" — CREATIVE / attention-grabbing.
// Not a generic card grid: an auto-rotating (and clickable) niche spotlight where a RED
// "money you're losing" counter ticks UP, then Gui flips it into a GREEN result.
// Message captured from the video, adapted to Guileo. Guileo design system + smooth motion.

const NICHES = [
  { key: "Clinics & Salons", icon: "🦷", loseN: 4800, why: "missed calls & no-shows", result: "Calls answered 24/7. Calendar stays full.", gain: "+38% booked" },
  { key: "Real Estate", icon: "🏠", loseN: 9200, why: "leads going cold in minutes", result: "Every lead called back in seconds — and qualified.", gain: "+5 deals / mo" },
  { key: "Restaurants", icon: "🍕", loseN: 3500, why: "abandoned orders on a busy line", result: "Orders taken, upsold & delivery tracked.", gain: "+22% orders" },
  { key: "E-commerce", icon: "🛒", loseN: 6100, why: "support & cart questions ignored", result: "Instant replies. Carts recovered. Buyers won back.", gain: "+30% LTV" },
];

const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");

export default function MovementV2() {
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(0);
  const n = NICHES[idx];

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % NICHES.length), 4800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setCount(0);
    const target = n.loseN;
    const steps = 34;
    let s = 0;
    const t = setInterval(() => {
      s += 1;
      setCount(Math.min(target, Math.round((target / steps) * s)));
      if (s >= steps) clearInterval(t);
    }, 32);
    return () => clearInterval(t);
  }, [idx]);

  return (
    <section className="relative overflow-hidden bg-g-creamd px-5 py-20">
      <style>{`
        @keyframes mreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mshine{to{background-position:220% center}}
        @keyframes msoft{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mfall{0%{transform:translateY(-12px);opacity:0}20%{opacity:1}100%{transform:translateY(60px);opacity:0}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_-10%,rgba(62,148,104,0.08),transparent)]" />

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.28em] text-g-gold" style={{ animation: "mreveal .7s ease both" }}>Results — not tools</div>
        <h2 className="mx-auto mt-4 max-w-3xl font-black leading-[0.95] tracking-tight" style={{ fontSize: "clamp(2.1rem,4.8vw,3.5rem)" }}>
          <span className="block text-g-word" style={{ animation: "mreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>You don't buy AI.</span>
          <span className="block bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "mreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, mshine 7s linear infinite" }}>You buy results.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "mreveal .8s ease .3s both" }}>
          Pick your business. See what it's <span className="font-semibold text-[#d8916e]">leaking</span> right now — and what Gui turns it into.
        </p>
      </div>

      <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2" style={{ animation: "mreveal .8s ease .4s both" }}>
        {NICHES.map((x, i) => (
          <button key={x.key} onClick={() => setIdx(i)}
            className={`rounded-full border px-4 py-2 text-[13px] font-bold transition ${i === idx ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line bg-white/[0.03] text-g-muted hover:text-g-word"}`}>
            <span className="mr-1.5">{x.icon}</span>{x.key}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-7 max-w-3xl overflow-hidden rounded-[1.75rem] border border-g-line bg-white/[0.04] p-8 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.85)] backdrop-blur-sm">
        <div key={idx} className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]" style={{ animation: "msoft .5s ease both" }}>
          <div className="text-center md:text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8916e]">Without Gui, every month</div>
            <div className="relative mt-1 inline-block">
              <div className="text-[44px] font-black leading-none text-[#e0855f] sm:text-[52px]">{fmt(count)}</div>
              <span className="pointer-events-none absolute -right-5 top-0 text-sm" style={{ animation: "mfall 1.6s ease-in-out infinite" }}>💸</span>
              <span className="pointer-events-none absolute -right-2 top-0 text-sm" style={{ animation: "mfall 1.6s ease-in-out .8s infinite" }}>💸</span>
            </div>
            <div className="mt-1 text-[13px] text-g-muted">walks out the door — {n.why}.</div>
          </div>

          <div className="flex flex-col items-center">
            <div className="relative h-16 w-16">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-g-green/30 to-g-gold/15 text-2xl ring-1 ring-white/15">🌱</div>
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[#0c0c0c] text-g-green ring-2 ring-g-green/60 text-[11px]">🎙️</span>
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-g-green">Gui catches it</div>
          </div>

          <div className="text-center md:text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-green">With Gui</div>
            <div className="mt-1 text-[18px] font-bold leading-snug text-g-word">{n.result}</div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-g-green/30 bg-g-green/10 px-3 py-1 text-[13px] font-black text-g-green">▲ {n.gain}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-7 max-w-2xl text-center" style={{ animation: "mreveal .8s ease .6s both" }}>
        <p className="text-[14px] text-g-muted">💡 <span className="font-semibold text-g-word">Priced to the problem we solve</span> — never the tech under the hood.</p>
      </div>
    </section>
  );
}
