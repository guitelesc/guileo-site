import { useEffect, useRef, useState } from "react";

// Clareza Dental Studio — fictional showcase model (Guileo)
// Palette: porcelain #fafaf8 · ice #dce9f0/#7fb3cc · graphite #22272b · deep teal #0e6e6a

const GRAPHITE = "#22272b";
const TEAL = "#0e6e6a";

/* Scroll-reveal: adds .cz-in when visible */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("cz-in");
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("cz-in");
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`cz-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* Stat: value always rendered final (never a wrong low number); only fades in */
function Stat({ value, label }) {
  return (
    <div className="text-center px-6 py-8">
      <div className="font-[Sora] text-5xl md:text-6xl font-semibold tracking-tight text-[#0e6e6a]">{value}</div>
      <div className="mt-2 text-sm uppercase tracking-[0.18em] text-[#22272b]/60">{label}</div>
    </div>
  );
}

/* Minimal stroke icons */
function Icon({ d, extra }) {
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {extra && <path d={extra} />}
    </svg>
  );
}

const SERVICES = [
  { name: "Preventive Cleaning", price: 145, desc: "Gentle, thorough hygiene with ultrasonic scaling and polish.", icon: "M16 4c-4 0-7 3-7 7 0 6 2 17 4 17s2-6 3-6 1 6 3 6 4-11 4-17c0-4-3-7-7-7z" },
  { name: "Professional Whitening", price: 425, desc: "In-office brightening, up to 6 shades in a single visit.", icon: "M16 3l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" },
  { name: "Invisalign Consult", price: 95, desc: "Digital smile scan and a clear-aligner roadmap, no molds.", icon: "M6 16c0-5 4-9 10-9s10 4 10 9-4 9-10 9S6 21 6 16z", extra: "M11 16h10" },
  { name: "Implant Consult", price: 120, desc: "3D imaging and a precise plan for permanent restoration.", icon: "M16 4c-3 0-6 2-6 6 0 5 2 12 3 12h6c1 0 3-7 3-12 0-4-3-6-6-6z", extra: "M12 26h8M13 29h6" },
  { name: "Emergency Visit", price: 190, desc: "Same-day relief for pain, chips, and broken restorations.", icon: "M16 5v12M16 22v.5", extra: "M16 29c7 0 12-5 12-13S23 3 16 3 4 8 4 16s5 13 12 13z" },
  { name: "Checkup + X-Ray", price: 175, desc: "Full exam, digital radiographs, and a clear care plan.", icon: "M7 7h18v18H7z", extra: "M11 12h4M11 16h7M11 20h5" },
];

export default function ClarezaDental() {
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Manrope:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#22272b] font-[Manrope] antialiased overflow-x-hidden">
      <style>{`
        .cz-reveal { opacity: 0; transform: translateY(22px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1); }
        .cz-in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { .cz-reveal { transition: none; opacity: 1; transform: none; } }
        @keyframes czFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes czDrift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(10px,-12px) scale(1.04); } }
        @keyframes czSmile { to { stroke-dashoffset: 0; } }
        .cz-smile { stroke-dasharray: 400; stroke-dashoffset: 400; animation: czSmile 2.2s .4s cubic-bezier(.3,0,.2,1) forwards; }
        @media (prefers-reduced-motion: reduce) { .cz-smile { animation: none; stroke-dashoffset: 0; } .cz-float, .cz-drift { animation: none !important; } }
        .cz-card { transition: transform .35s ease, box-shadow .35s ease; }
        .cz-card:hover { transform: translateY(-6px); box-shadow: 0 24px 48px -18px rgba(14,110,106,.22); }
      `}</style>

      {/* Sticky glass nav */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#fafaf8]/75 border-b border-[#dce9f0]">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#top" className="font-[Sora] font-bold tracking-tight text-lg">
            Clareza<span className="text-[#0e6e6a]"> Dental</span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#22272b]/70">
            <a href="#services" className="hover:text-[#0e6e6a]">Services</a>
            <a href="#why" className="hover:text-[#0e6e6a]">Why us</a>
            <a href="#book" className="hover:text-[#0e6e6a]">Book</a>
          </nav>
          <a href="tel:+19295550107" className="text-sm font-semibold text-[#0e6e6a] whitespace-nowrap">(929) 555-0107</a>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative max-w-6xl mx-auto px-5 pt-16 md:pt-24 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <Reveal>
            <p className="text-xs uppercase tracking-[0.28em] text-[#0e6e6a] font-semibold">Astoria · Queens, NY</p>
            <h1 className="mt-4 font-[Sora] text-5xl md:text-6xl font-bold tracking-[-0.03em] leading-[1.04]">
              Calm, precise dentistry — <span className="text-[#0e6e6a]">for smiles that last.</span>
            </h1>
            <p className="mt-6 text-lg text-[#22272b]/65 max-w-md leading-relaxed">
              Modern clinical care in a quiet, light-filled studio. Every visit planned to the minute, every detail explained before we begin.
            </p>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href="#book" className="inline-flex items-center rounded-full bg-[#0e6e6a] text-white px-7 py-3.5 font-semibold text-sm shadow-[0_16px_32px_-12px_rgba(14,110,106,.5)] hover:bg-[#0b5a57] transition-colors">
                Book an appointment
              </a>
              <a href="tel:+19295550107" className="inline-flex items-center gap-2 rounded-full border border-[#7fb3cc]/50 bg-white/70 px-5 py-3 text-sm font-medium text-[#22272b]/80">
                <span aria-hidden>📞</span> (929) 555-0107 — answered 24/7 by our AI care team
              </a>
            </div>
          </Reveal>
        </div>

        {/* Abstract tooth / smile visual — pure SVG */}
        <Reveal delay={200} className="relative">
          <div className="relative aspect-square max-w-md mx-auto">
            <div className="absolute inset-0 cz-drift" style={{ animation: "czDrift 9s ease-in-out infinite" }}>
              <svg viewBox="0 0 400 400" className="w-full h-full" aria-hidden="true">
                <defs>
                  <radialGradient id="czIce" cx="35%" cy="30%" r="80%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="55%" stopColor="#dce9f0" />
                    <stop offset="100%" stopColor="#7fb3cc" stopOpacity=".55" />
                  </radialGradient>
                  <linearGradient id="czTooth" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#e8f1f6" />
                  </linearGradient>
                </defs>
                <circle cx="200" cy="200" r="170" fill="url(#czIce)" opacity=".8" />
                <ellipse cx="130" cy="120" rx="90" ry="70" fill="#dce9f0" opacity=".6" />
                <ellipse cx="280" cy="290" rx="80" ry="65" fill="#7fb3cc" opacity=".25" />
                {/* stylized tooth */}
                <path
                  d="M200 90c-42 0-70 28-70 66 0 50 20 150 42 150 18 0 14-62 28-62s10 62 28 62c22 0 42-100 42-150 0-38-28-66-70-66z"
                  fill="url(#czTooth)" stroke="#7fb3cc" strokeWidth="2.5" strokeOpacity=".6"
                  style={{ filter: "drop-shadow(0 18px 30px rgba(127,179,204,.45))" }}
                />
                <path d="M172 130c-12 8-18 20-18 34" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".9" />
                {/* animated smile curve */}
                <path className="cz-smile" d="M90 300q110 78 220 0" fill="none" stroke={TEAL} strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            {/* floating glass chips */}
            <div className="absolute -left-2 top-10 rounded-2xl bg-white/75 backdrop-blur-md border border-white px-4 py-3 shadow-[0_18px_36px_-16px_rgba(34,39,43,.25)]" style={{ animation: "czFloat 6s ease-in-out infinite" }}>
              <p className="text-xs font-semibold text-[#0e6e6a]">Next opening</p>
              <p className="text-sm font-[Sora] font-semibold">Tomorrow · 9:40 AM</p>
            </div>
            <div className="absolute -right-2 bottom-14 rounded-2xl bg-white/75 backdrop-blur-md border border-white px-4 py-3 shadow-[0_18px_36px_-16px_rgba(34,39,43,.25)]" style={{ animation: "czFloat 7s 1s ease-in-out infinite" }}>
              <p className="text-xs font-semibold text-[#0e6e6a]">Pain-free promise</p>
              <p className="text-sm font-[Sora] font-semibold">Comfort-first care</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Services */}
      <section id="services" className="bg-white border-y border-[#dce9f0]">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <Reveal>
            <h2 className="font-[Sora] text-3xl md:text-4xl font-bold tracking-tight">Care, priced clearly.</h2>
            <p className="mt-3 text-[#22272b]/60 max-w-lg">No surprises at the front desk. Every treatment starts with a written estimate.</p>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.name} delay={i * 70}>
                <div className="cz-card h-full rounded-3xl bg-[#fafaf8] border border-[#dce9f0] p-7 flex flex-col">
                  <Icon d={s.icon} extra={s.extra} />
                  <h3 className="mt-5 font-[Sora] font-semibold text-lg tracking-tight">{s.name}</h3>
                  <p className="mt-2 text-sm text-[#22272b]/60 leading-relaxed flex-1">{s.desc}</p>
                  <p className="mt-5 text-sm">
                    <span className="text-[#22272b]/50">from</span>{" "}
                    <span className="font-[Sora] text-xl font-semibold text-[#0e6e6a]">${s.price}</span>
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="why" className="max-w-6xl mx-auto px-5 py-20">
        <Reveal>
          <h2 className="font-[Sora] text-3xl md:text-4xl font-bold tracking-tight text-center">Why patients stay</h2>
        </Reveal>
        <Reveal delay={120}>
          <div className="mt-10 grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#dce9f0] rounded-3xl bg-gradient-to-br from-white to-[#dce9f0]/40 border border-[#dce9f0] shadow-[0_28px_60px_-30px_rgba(127,179,204,.5)]">
            <Stat value="98%" label="Would recommend" />
            <Stat value="4,200+" label="Smiles cared for" />
            <Stat value="9 min" label="Average wait time" />
          </div>
          <p className="mt-4 text-center text-xs text-[#22272b]/40">Sample figures — demonstration model.</p>
        </Reveal>
      </section>

      {/* Booking */}
      <section id="book" className="bg-white border-y border-[#dce9f0]">
        <div className="max-w-6xl mx-auto px-5 py-20 grid md:grid-cols-2 gap-12 items-start">
          <Reveal>
            <h2 className="font-[Sora] text-3xl md:text-4xl font-bold tracking-tight">Reserve your visit.</h2>
            <p className="mt-4 text-[#22272b]/60 leading-relaxed max-w-md">
              Choose a service and a day — our care team confirms within minutes. Prefer to talk?
              Call <a href="tel:+19295550107" className="font-semibold text-[#0e6e6a]">(929) 555-0107</a>, answered around the clock.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-[#22272b]/70">
              <li className="flex gap-3"><span className="text-[#0e6e6a]">—</span> Evening and Saturday appointments</li>
              <li className="flex gap-3"><span className="text-[#0e6e6a]">—</span> Digital records, zero paperwork on arrival</li>
              <li className="flex gap-3"><span className="text-[#0e6e6a]">—</span> Text reminders so you never miss a visit</li>
            </ul>
          </Reveal>
          <Reveal delay={140}>
            <form
              onSubmit={(e) => { e.preventDefault(); setSent(true); }}
              className="rounded-3xl bg-[#fafaf8] border border-[#dce9f0] p-7 shadow-[0_28px_60px_-30px_rgba(127,179,204,.5)] space-y-4"
            >
              <label className="block text-sm">
                <span className="font-medium">Full name</span>
                <input required type="text" placeholder="Jane Rivera" className="mt-1.5 w-full rounded-xl border border-[#dce9f0] bg-white px-4 py-3 outline-none focus:border-[#0e6e6a] focus:ring-2 focus:ring-[#0e6e6a]/15" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Phone</span>
                <input required type="tel" placeholder="(929) 555-0000" className="mt-1.5 w-full rounded-xl border border-[#dce9f0] bg-white px-4 py-3 outline-none focus:border-[#0e6e6a] focus:ring-2 focus:ring-[#0e6e6a]/15" />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="font-medium">Service</span>
                  <select className="mt-1.5 w-full rounded-xl border border-[#dce9f0] bg-white px-4 py-3 outline-none focus:border-[#0e6e6a]">
                    {SERVICES.map((s) => <option key={s.name}>{s.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Preferred date</span>
                  <input type="date" className="mt-1.5 w-full rounded-xl border border-[#dce9f0] bg-white px-4 py-3 outline-none focus:border-[#0e6e6a]" />
                </label>
              </div>
              <button type="submit" className="w-full rounded-xl bg-[#0e6e6a] text-white py-3.5 font-semibold text-sm hover:bg-[#0b5a57] transition-colors">
                Request appointment
              </button>
              {sent && (
                <p role="status" className="rounded-xl bg-[#dce9f0]/60 border border-[#7fb3cc]/40 px-4 py-3 text-sm text-[#0e6e6a]">
                  This is a demonstration model — no request was sent. On a live site, our AI care team would confirm your visit in minutes.
                </p>
              )}
            </form>
          </Reveal>
        </div>
      </section>

      {/* Insurance */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <Reveal>
          <div className="rounded-3xl border border-[#dce9f0] bg-gradient-to-r from-[#dce9f0]/40 via-white to-[#dce9f0]/40 px-8 py-10 text-center">
            <h3 className="font-[Sora] text-xl font-semibold tracking-tight">We work with most PPO plans.</h3>
            <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm text-[#22272b]/60">
              {["PPO Dental", "Employer Group Plans", "Family Dental Plans", "Indemnity Plans", "In-House Membership"].map((p) => (
                <span key={p} className="rounded-full border border-[#7fb3cc]/40 bg-white px-4 py-1.5">{p}</span>
              ))}
            </div>
            <p className="mt-4 text-xs text-[#22272b]/45">We verify your benefits before your first visit — at no charge.</p>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#dce9f0]">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#22272b]/55">
          <p>
            <span className="font-[Sora] font-semibold text-[#22272b]">Clareza Dental Studio</span> · Astoria, Queens NY ·{" "}
            <a href="tel:+19295550107" className="text-[#0e6e6a]">(929) 555-0107</a>
          </p>
          <p className="text-xs">
            Demonstration model · ⚡ website + AI by{" "}
            <a href="https://www.guileoai.com" target="_blank" rel="noreferrer" className="font-semibold text-[#0e6e6a] hover:underline">Guileo</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
