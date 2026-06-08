import { useState, useEffect } from "react";

// IndustriesV2 — TEST (/v2), sits BETWEEN Hero (beat 1) and Results (beat 2).
// "We know your business / Built for your industry." Interactive: client clicks an
// industry → detail panel crossfades to what Gui does for it; auto-rotates for movement.
// Guileo design system + smooth CSS motion.

const INDUSTRIES = [
  { icon: "⚖️", name: "Law Firms", does: "Intakes new cases, books consults, never misses a lead.", win: "+ qualified cases" },
  { icon: "🏥", name: "Medical Clinics", does: "Answers 24/7, books patients, sends reminders, cuts no-shows.", win: "− no-shows" },
  { icon: "🦷", name: "Dental Clinics", does: "Fills the chair — books cleanings and follows up on treatment.", win: "+ chair time" },
  { icon: "🔧", name: "Plumbing & HVAC", does: "Catches emergency calls, quotes the job, dispatches fast.", win: "+ booked jobs" },
  { icon: "🛒", name: "E-Commerce", does: "Answers support, recovers carts, wins back buyers.", win: "+ recovered carts" },
  { icon: "🍽️", name: "Restaurants", does: "Takes orders & reservations, upsells, tracks delivery.", win: "+ orders" },
  { icon: "🏠", name: "Real Estate", does: "Calls leads back in seconds, qualifies, books showings.", win: "+ showings" },
  { icon: "💪", name: "Gyms & Fitness", does: "Signs up members, books tours, wins back lapsed ones.", win: "+ members" },
  { icon: "🚗", name: "Auto Dealerships", does: "Books test drives, qualifies buyers, follows up on quotes.", win: "+ test drives" },
];

const PAINS = ["A patient calls at 9 PM.", "A client needs a quote on Sunday.", "A diner wants a table now."];

export default function IndustriesV2() {
  const [sel, setSel] = useState(1);
  const [auto, setAuto] = useState(true);
  const s = INDUSTRIES[sel];

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setSel((i) => (i + 1) % INDUSTRIES.length), 3200);
    return () => clearInterval(t);
  }, [auto]);

  return (
    <section className="relative overflow-hidden bg-g-cream px-5 py-20">
      <style>{`
        @keyframes ireveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ifade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ishine{to{background-position:220% center}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.28em] text-g-gold" style={{ animation: "ireveal .7s ease both" }}>We know your business</div>
        <h2 className="mt-4 font-black tracking-tight" style={{ fontSize: "clamp(2.1rem,4.8vw,3.5rem)" }}>
          <span className="bg-gradient-to-r from-g-word via-g-gold to-g-word bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "ireveal .8s cubic-bezier(.2,.7,.2,1) .05s both, ishine 8s linear infinite" }}>Built for your industry.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "ireveal .8s ease .25s both" }}>
          {PAINS.map((p, i) => (
            <span key={p} className="text-g-muted" style={{ animation: `ifade .6s ease ${0.3 + i * 0.18}s both` }}>{p} </span>
          ))}
          <span className="font-semibold text-g-word">Your AI handles it — </span><span className="font-bold text-g-green">instantly.</span>
        </p>
      </div>

      {/* interactive industry grid */}
      <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-2.5 sm:grid-cols-3" onMouseEnter={() => setAuto(false)} onMouseLeave={() => setAuto(true)}>
        {INDUSTRIES.map((it, i) => (
          <button key={it.name} onClick={() => { setSel(i); setAuto(false); }}
            className={`group flex items-center gap-2.5 rounded-xl2 border px-4 py-3 text-left transition-all duration-300 ${i === sel ? "-translate-y-0.5 border-g-green/50 bg-g-green/12 shadow-[0_20px_50px_-30px_rgba(62,148,104,0.6)]" : "border-g-line bg-white/[0.03] hover:-translate-y-0.5 hover:border-g-line/80 hover:bg-white/[0.06]"}`}
            style={{ animation: `ireveal .6s cubic-bezier(.2,.7,.2,1) ${0.15 + i * 0.05}s both` }}>
            <span className="text-xl transition-transform duration-300 group-hover:scale-110">{it.icon}</span>
            <span className={`text-[13.5px] font-bold ${i === sel ? "text-g-word" : "text-g-ink"}`}>{it.name}</span>
          </button>
        ))}
      </div>

      {/* detail panel — crossfades to the selected industry */}
      <div className="mx-auto mt-5 max-w-4xl">
        <div key={sel} className="flex flex-col items-center gap-3 rounded-2xl border border-g-line bg-white/[0.04] px-6 py-5 text-center backdrop-blur-sm sm:flex-row sm:text-left" style={{ animation: "ifade .5s ease both" }}>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-g-green/25 to-g-gold/10 text-2xl ring-1 ring-white/10">{s.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-g-word">{s.name}</div>
            <div className="text-[13.5px] text-g-ink"><span className="font-semibold text-g-green">Gui →</span> {s.does}</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-g-green/30 bg-g-green/10 px-3 py-1 text-[12px] font-black text-g-green">▲ {s.win}</span>
        </div>
      </div>
    </section>
  );
}
