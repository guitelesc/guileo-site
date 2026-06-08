import { useState, useEffect } from "react";

// ResultsV2 — TEST (/v2): "You don't buy AI / You buy results" merged with all 9 industries.
// Industries scroll as a marquee (real-site movement) + are clickable (pause on hover).
// Per business: what Gui DOES (action chips incl. bookings, call-backs…) + money leaking +
// the result. Guileo design system + smooth CSS motion.

const BIZ = [
  { icon: "⚖️", name: "Law Firms", loseN: 8200, why: "missed intake calls & slow follow-up", does: "Intakes cases, books consults, never misses a lead.", result: "Every caller captured & qualified — day or night.", gain: "+ qualified cases", acts: ["📅 Consults booked", "📞 Calls leads back", "📋 Case intake", "⏰ 24/7"] },
  { icon: "🏥", name: "Medical Clinics", loseN: 5400, why: "no-shows & unanswered calls", does: "Answers 24/7, books patients, sends reminders.", result: "Full schedule — fewer no-shows.", gain: "− no-shows", acts: ["📅 Bookings", "🔔 Reminders", "📞 Calls back", "🌐 Any language"] },
  { icon: "🦷", name: "Dental Clinics", loseN: 4800, why: "empty chairs & missed bookings", does: "Books cleanings & follows up on treatment.", result: "The chair stays full.", gain: "+ chair time", acts: ["📅 Cleanings booked", "🔁 Recalls", "📞 Calls back", "💳 Deposits"] },
  { icon: "🔧", name: "Plumbing & HVAC", loseN: 7600, why: "emergency calls hitting voicemail", does: "Catches emergency calls, quotes & dispatches.", result: "You win the job before the competitor calls back.", gain: "+ booked jobs", acts: ["🚨 Emergency triage", "🧾 Quotes", "📅 Dispatch", "📞 Calls back"] },
  { icon: "🛒", name: "E-Commerce", loseN: 6100, why: "support & cart questions ignored", does: "Answers support, recovers carts, wins back buyers.", result: "Instant replies. Carts recovered.", gain: "+30% LTV", acts: ["🎧 Support", "🛒 Cart recovery", "🔄 Win-back", "📦 Order tracking"] },
  { icon: "🍽️", name: "Restaurants", loseN: 3500, why: "abandoned orders on a busy line", does: "Takes orders & reservations, upsells, tracks delivery.", result: "Orders taken, upsold & delivered.", gain: "+22% orders", acts: ["🍽️ Reservations", "🛒 Orders", "➕ Upsells", "🚚 Delivery track"] },
  { icon: "🏠", name: "Real Estate", loseN: 9200, why: "leads going cold in minutes", does: "Calls leads back in seconds, qualifies, books showings.", result: "Every lead called back & qualified.", gain: "+5 deals / mo", acts: ["📞 Instant call-back", "🎯 Qualify", "📅 Showings", "🔁 Follow-up"] },
  { icon: "💪", name: "Gyms & Fitness", loseN: 4200, why: "trial leads never followed up", does: "Signs up members, books tours, wins back lapsed.", result: "More members, fewer cancellations.", gain: "+ members", acts: ["🏷️ Sign-ups", "🗓️ Tours", "🔄 Win-back", "📞 Calls back"] },
  { icon: "🚗", name: "Auto Dealerships", loseN: 11000, why: "buyers waiting & quotes not chased", does: "Books test drives, qualifies buyers, follows up.", result: "More test drives, faster closes.", gain: "+ test drives", acts: ["🚗 Test drives", "🎯 Qualify", "🧾 Quotes", "📞 Follow-up"] },
];

const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");

export default function ResultsV2() {
  const [idx, setIdx] = useState(6);
  const [paused, setPaused] = useState(false);
  const [count, setCount] = useState(0);
  const b = BIZ[idx];

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % BIZ.length), 4200);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    setCount(0);
    const steps = 34; let s = 0;
    const t = setInterval(() => { s += 1; setCount(Math.min(b.loseN, Math.round((b.loseN / steps) * s))); if (s >= steps) clearInterval(t); }, 30);
    return () => clearInterval(t);
  }, [idx]);

  return (
    <section className="relative overflow-hidden bg-g-creamd px-5 py-20">
      <style>{`
        @keyframes rvreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rvshine{to{background-position:220% center}}
        @keyframes rvsoft{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rvfall{0%{transform:translateY(-12px);opacity:0}20%{opacity:1}100%{transform:translateY(60px);opacity:0}}
        @keyframes rvmarq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_-10%,rgba(62,148,104,0.08),transparent)]" />

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "rvreveal .7s ease both" }}>We know your business · results, not tools</div>
        <h2 className="mx-auto mt-4 max-w-3xl font-black leading-[0.95] tracking-tight" style={{ fontSize: "clamp(2.1rem,4.8vw,3.5rem)" }}>
          <span className="block text-g-word" style={{ animation: "rvreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>You don't buy AI.</span>
          <span className="block bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "rvreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, rvshine 7s linear infinite" }}>You buy results.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "rvreveal .8s ease .3s both" }}>
          A patient calls at 9 PM. A client needs a quote on Sunday. A diner wants a table now. <span className="font-semibold text-g-word">Pick your business</span> — see what it's <span className="font-semibold text-[#d8916e]">leaking</span> and what Gui turns it into.
        </p>
      </div>

      {/* industries marquee — moving + clickable (pauses on hover) */}
      <div className="relative mt-8 [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent)]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="flex w-max gap-2" style={{ animation: "rvmarq 34s linear infinite", animationPlayState: paused ? "paused" : "running" }}>
          {[...BIZ, ...BIZ].map((x, i) => {
            const real = i % BIZ.length;
            const on = real === idx;
            return (
              <button key={i} onClick={() => { setIdx(real); }}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-bold transition ${on ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line bg-white/[0.03] text-g-muted hover:text-g-word"}`}>
                <span className="mr-1.5">{x.icon}</span>{x.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* combined panel: what Gui does (+ action chips) → leak → result */}
      <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-[1.75rem] border border-g-line bg-white/[0.04] p-7 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-8">
        <div key={idx} style={{ animation: "rvsoft .5s ease both" }}>
          <div className="mb-3 flex items-center justify-center gap-2 text-center text-[14px] text-g-ink">
            <span className="text-xl">{b.icon}</span>
            <span><span className="font-bold text-g-word">{b.name}</span> — <span className="font-semibold text-g-green">Gui →</span> {b.does}</span>
          </div>
          <div className="mb-6">
            <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-g-muted">Everything you can't keep up with — <span className="text-g-green">Gui handles it</span></div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {b.acts.map((a) => (
                <span key={a} className="rounded-full border border-g-green/25 bg-g-green/[0.07] px-2.5 py-0.5 text-[11.5px] font-semibold text-g-green">{a}</span>
              ))}
            </div>
          </div>

          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div className="text-center md:text-left">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8916e]">Without Gui, every month</div>
              <div className="relative mt-1 inline-block">
                <div className="text-[42px] font-black leading-none text-[#e0855f] sm:text-[50px]">{fmt(count)}</div>
                <span className="pointer-events-none absolute -right-5 top-0 text-sm" style={{ animation: "rvfall 1.6s ease-in-out infinite" }}>💸</span>
                <span className="pointer-events-none absolute -right-2 top-0 text-sm" style={{ animation: "rvfall 1.6s ease-in-out .8s infinite" }}>💸</span>
              </div>
              <div className="mt-1 text-[13px] text-g-muted">walks out — {b.why}.</div>
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
              <div className="mt-1 text-[17px] font-bold leading-snug text-g-word">{b.result}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-g-green/30 bg-g-green/10 px-3 py-1 text-[13px] font-black text-g-green">▲ {b.gain}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-7 max-w-2xl text-center" style={{ animation: "rvreveal .8s ease .6s both" }}>
        <p className="text-[14px] text-g-muted">💡 <span className="font-semibold text-g-word">Priced to the problem we solve</span> — never the tech under the hood.</p>
      </div>
    </section>
  );
}
