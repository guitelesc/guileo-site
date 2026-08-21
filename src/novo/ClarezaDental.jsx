import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   Clareza Dental Studio — fictional showcase model (Guileo demonstration)
   Palette: porcelain #fafaf8 · ice #e3edf2 / #9dc0d4 · graphite #22272b · teal #0d5f5b
   Craft rules (house DNA, transplanted to a light ground):
   - Ground is never flat: layered radial light + paper-grain fractalNoise overlay.
   - Panels are material: 1px hairline border, tight contact shadow + soft ambient
     shadow, white top rim light. Depth from shadow discipline, not blur.
   - Motion is restrained: scroll reveals (fail-open at 1.4s) + subtle hover lift.
   ──────────────────────────────────────────────────────────────────────────── */

const INK = "#22272b";
const TEAL = "#0d5f5b";
const HAIR = "rgba(34,39,43,0.12)";

/* Paper grain, tuned for a light ground (multiply, very low opacity) */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")";

/* Scroll reveal — IntersectionObserver with a 1.4s fail-open timer */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.classList.add("cz-in");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { show(); return; }
    const failOpen = setTimeout(show, 1400);
    let io;
    try {
      io = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) { show(); clearTimeout(failOpen); io.disconnect(); } },
        { threshold: 0.12 }
      );
      io.observe(el);
    } catch { show(); }
    return () => { clearTimeout(failOpen); io && io.disconnect(); };
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

/* 1.5px stroke icons — drawn, not decorated */
function Icon({ paths, className = "w-7 h-7" }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const SERVICES = [
  { name: "Preventive Cleaning", price: 145, desc: "Ultrasonic scaling, hand instrumentation, and polish — unhurried, by the same hygienist each visit.", paths: ["M14 4c-3.6 0-6 2.4-6 5.8 0 4.8 1.7 13.4 3.4 13.4 1.5 0 1.2-5.4 2.6-5.4s1.1 5.4 2.6 5.4c1.7 0 3.4-8.6 3.4-13.4C20 6.4 17.6 4 14 4z"] },
  { name: "Professional Whitening", price: 425, desc: "Calibrated in-office brightening with enamel-safe protocols. Shade-mapped before and after.", paths: ["M14 3v4", "M14 21v4", "M3 14h4", "M21 14h4", "M14 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"] },
  { name: "Invisalign Consult", price: 95, desc: "Digital smile scan and a clear-aligner roadmap with staged timelines. No impressions, no molds.", paths: ["M5 15c0-4.4 4-8 9-8s9 3.6 9 8-4 8-9 8-9-3.6-9-8z", "M9 15h10"] },
  { name: "Implant Consult", price: 120, desc: "Cone-beam 3D imaging, bone assessment, and a written plan for permanent restoration.", paths: ["M14 4c-2.8 0-5 1.9-5 5 0 3.8 1.4 9 2.4 9h5.2c1 0 2.4-5.2 2.4-9 0-3.1-2.2-5-5-5z", "M11 21h6", "M12 24h4"] },
  { name: "Emergency Visit", price: 190, desc: "Same-day relief for pain, chips, and broken restorations. Held slots every weekday morning.", paths: ["M14 3 3 23h22L14 3z", "M14 11v6", "M14 20v.5"] },
  { name: "Checkup + X-Ray", price: 175, desc: "Full examination, digital radiographs at a fraction of film dose, and a plain-language care plan.", paths: ["M6 6h16v16H6z", "M10 11h5", "M10 15h8", "M10 19h6"] },
];

const HOURS = [
  ["Mon – Thu", "8:00 – 19:00"],
  ["Friday", "8:00 – 17:00"],
  ["Saturday", "9:00 – 14:00"],
  ["Sunday", "Closed"],
];

/* Technical line drawing of a tooth — blueprint, not blob */
function ToothBlueprint() {
  return (
    <svg viewBox="0 0 340 360" className="w-full h-auto" aria-hidden="true">
      <g stroke="#9dc0d4" strokeWidth="0.75" opacity="0.55">
        {[60, 120, 180, 240, 300].map((x) => <line key={`v${x}`} x1={x} y1="16" x2={x} y2="344" />)}
        {[60, 130, 200, 270].map((y) => <line key={`h${y}`} x1="20" y1={y} x2="320" y2={y} />)}
      </g>
      <circle cx="170" cy="165" r="118" fill="none" stroke="#9dc0d4" strokeWidth="0.75" strokeDasharray="3 5" opacity="0.7" />
      {/* crown + root, single confident stroke */}
      <path
        d="M170 58c-34 0-56 21-56 51 0 14 4 26 9 38 7 17 10 44 13 74 2 20 6 51 15 51 11 0 8-58 19-58s8 58 19 58c9 0 13-31 15-51 3-30 6-57 13-74 5-12 9-24 9-38 0-30-22-51-56-51z"
        fill="none" stroke={INK} strokeWidth="1.5"
      />
      <path d="M140 84c-9 6-14 15-15 25" fill="none" stroke={INK} strokeWidth="1.5" opacity="0.55" />
      <path d="M148 118c7 8 37 8 44 0" fill="none" stroke={INK} strokeWidth="1.25" opacity="0.4" />
      {/* dimension line + ticks */}
      <g stroke={TEAL} strokeWidth="1">
        <line x1="252" y1="58" x2="252" y2="272" />
        <line x1="246" y1="58" x2="258" y2="58" />
        <line x1="246" y1="272" x2="258" y2="272" />
        <line x1="114" y1="296" x2="226" y2="296" />
        <line x1="114" y1="290" x2="114" y2="302" />
        <line x1="226" y1="290" x2="226" y2="302" />
      </g>
      <g fill={TEAL} fontFamily="Sora, sans-serif" fontSize="9" letterSpacing="1.5">
        <text x="262" y="168">FIG. 01</text>
        <text x="112" y="316">OCCLUSAL PLAN</text>
        <text x="24" y="40">CLAREZA / STUDY</text>
      </g>
      <g stroke={TEAL} strokeWidth="1">
        <line x1="196" y1="96" x2="238" y2="76" />
        <circle cx="196" cy="96" r="2" fill={TEAL} />
      </g>
      <text x="228" y="70" fill={TEAL} fontFamily="Sora, sans-serif" fontSize="9" letterSpacing="1.5">ENAMEL</text>
    </svg>
  );
}

export default function ClarezaDental() {
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Manrope:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  return (
    <div className="relative min-h-screen text-[#22272b] antialiased overflow-x-hidden" style={{ fontFamily: "Manrope, system-ui, sans-serif", backgroundColor: "#fafaf8", backgroundImage: "radial-gradient(1100px 640px at 82% -8%, rgba(157,192,212,0.22), transparent 60%), radial-gradient(900px 560px at 4% 12%, rgba(13,95,91,0.06), transparent 55%), radial-gradient(1200px 800px at 50% 110%, rgba(227,237,242,0.8), transparent 62%)" }}>
      {/* paper grain — the ground is never flat */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: GRAIN, opacity: 0.05, mixBlendMode: "multiply" }} />

      <style>{`
        .cz-reveal { opacity: 0; transform: translateY(18px); transition: opacity .65s ease, transform .65s cubic-bezier(.2,.7,.2,1); }
        .cz-in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { .cz-reveal { transition: none; opacity: 1; transform: none; } }
        /* material panel: hairline + contact shadow + ambient shadow + top rim light */
        .cz-panel {
          background: #ffffff;
          border: 1px solid ${HAIR};
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(34,39,43,0.07), 0 16px 40px -20px rgba(34,39,43,0.18);
        }
        .cz-lift { transition: transform .3s ease, box-shadow .3s ease; }
        .cz-lift:hover {
          transform: translateY(-4px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 3px rgba(34,39,43,0.07), 0 26px 52px -22px rgba(34,39,43,0.24);
        }
        .cz-smallcaps { font-variant-caps: all-small-caps; letter-spacing: 0.14em; }
        .cz-input {
          width: 100%; margin-top: 6px; border-radius: 10px; padding: 11px 14px;
          background: #fafaf8; border: 1px solid ${HAIR}; outline: none;
          box-shadow: inset 0 1px 2px rgba(34,39,43,0.05);
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .cz-input:focus { border-color: ${TEAL}; box-shadow: inset 0 1px 2px rgba(34,39,43,0.05), 0 0 0 3px rgba(13,95,91,0.12); }
      `}</style>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: HAIR, background: "rgba(250,250,248,0.85)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="font-bold tracking-tight text-lg" style={{ fontFamily: "Sora, sans-serif" }}>
            Clareza<span style={{ color: TEAL }}> Dental Studio</span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#22272b]/65">
            <a href="#services" className="hover:text-[#0d5f5b] transition-colors">Services</a>
            <a href="#practice" className="hover:text-[#0d5f5b] transition-colors">The practice</a>
            <a href="#book" className="hover:text-[#0d5f5b] transition-colors">Book</a>
          </nav>
          <a href="tel:+19295550107" className="text-sm font-semibold whitespace-nowrap" style={{ color: TEAL }}>(929) 555-0107</a>
        </div>
      </header>

      {/* ── Hero: asymmetric editorial grid — copy left, blueprint + facts right ── */}
      <section id="top" className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 pt-16 md:pt-24 pb-20">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="cz-smallcaps text-sm font-semibold" style={{ color: TEAL }}>Astoria · Queens · New York</p>
              <h1 className="mt-5 font-bold tracking-[-0.035em] leading-[0.98] text-[2.9rem] sm:text-6xl lg:text-[4.6rem]" style={{ fontFamily: "Sora, sans-serif" }}>
                Dentistry,
                <br />
                practiced like
                <br />
                a <span style={{ color: TEAL }}>precise craft.</span>
              </h1>
              <p className="mt-7 text-lg text-[#22272b]/65 max-w-md leading-relaxed">
                A quiet, light-filled studio on 30th Avenue. Every visit planned to the
                minute, every cost written down before we begin.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-5">
                <a href="#book" className="inline-flex items-center rounded-full px-7 py-3.5 font-semibold text-sm text-white transition-transform hover:-translate-y-0.5" style={{ background: TEAL, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(13,95,91,0.4), 0 14px 28px -12px rgba(13,95,91,0.55)" }}>
                  Book an appointment
                </a>
                <div>
                  <a href="tel:+19295550107" className="block text-xl font-semibold tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>(929) 555-0107</a>
                  <p className="cz-smallcaps text-sm text-[#22272b]/55">answered 24/7 by our AI care team</p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-12 grid grid-cols-3 max-w-md border-t pt-5 gap-6" style={{ borderColor: HAIR }}>
                {[["Since", "2016"], ["Chairs", "4"], ["Languages", "EN · PT · ES"]].map(([k, v]) => (
                  <div key={k}>
                    <p className="cz-smallcaps text-xs text-[#22272b]/50">{k}</p>
                    <p className="mt-1 font-semibold" style={{ fontFamily: "Sora, sans-serif" }}>{v}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <Reveal delay={180}>
              <div className="cz-panel rounded-2xl p-6">
                <ToothBlueprint />
              </div>
            </Reveal>
            <Reveal delay={280}>
              <div className="cz-panel rounded-2xl p-6">
                <table className="w-full text-sm">
                  <tbody>
                    {HOURS.map(([day, time]) => (
                      <tr key={day} className="border-b last:border-0" style={{ borderColor: "rgba(34,39,43,0.07)" }}>
                        <td className="py-2 text-[#22272b]/60">{day}</td>
                        <td className="py-2 text-right font-medium" style={{ fontFamily: "Sora, sans-serif" }}>{time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 pt-4 border-t text-sm" style={{ borderColor: HAIR }}>
                  <p className="font-medium">31-07 30th Avenue, Astoria NY 11102</p>
                  <p className="mt-1 text-[#22272b]/55">Most PPO plans accepted · benefits verified before your first visit</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="relative z-10 border-y" style={{ borderColor: HAIR, background: "rgba(255,255,255,0.55)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="cz-smallcaps text-sm font-semibold" style={{ color: TEAL }}>Services</p>
                <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>Care, priced in writing.</h2>
              </div>
              <p className="text-[#22272b]/55 max-w-xs text-sm leading-relaxed">No surprises at the front desk — every treatment starts with a written estimate.</p>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.name} delay={i * 60}>
                <div className="cz-panel cz-lift h-full rounded-2xl p-7 flex flex-col">
                  <div className="flex items-start justify-between">
                    <Icon paths={s.paths} />
                    <p className="text-right leading-none">
                      <span className="cz-smallcaps text-xs text-[#22272b]/45 block">from</span>
                      <span className="text-xl font-semibold" style={{ fontFamily: "Sora, sans-serif", color: TEAL }}>${s.price}</span>
                    </p>
                  </div>
                  <h3 className="mt-5 font-semibold text-lg tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>{s.name}</h3>
                  <p className="mt-2 text-sm text-[#22272b]/60 leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats — rendered at final values, no counting up ── */}
      <section id="practice" className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <Reveal>
          <div className="cz-panel rounded-2xl grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: HAIR }}>
            {[["98%", "Would recommend"], ["4,200+", "Smiles cared for"], ["9 min", "Average wait"]].map(([v, l]) => (
              <div key={l} className="px-8 py-10" style={{ borderColor: "rgba(34,39,43,0.08)" }}>
                <p className="text-5xl font-semibold tracking-tight" style={{ fontFamily: "Sora, sans-serif", color: TEAL }}>{v}</p>
                <p className="cz-smallcaps mt-2 text-sm text-[#22272b]/55">{l}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#22272b]/40">Sample figures — demonstration model.</p>
        </Reveal>
      </section>

      {/* ── Booking ── */}
      <section id="book" className="relative z-10 border-y" style={{ borderColor: HAIR, background: "rgba(255,255,255,0.55)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="cz-smallcaps text-sm font-semibold" style={{ color: TEAL }}>Booking</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>Reserve your visit.</h2>
              <p className="mt-4 text-[#22272b]/60 leading-relaxed max-w-md">
                Choose a service and a day — the care team confirms within minutes.
                Prefer to talk? Call <a href="tel:+19295550107" className="font-semibold" style={{ color: TEAL }}>(929) 555-0107</a>.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-[#22272b]/70">
                {["Evening and Saturday appointments", "Digital records — zero paperwork on arrival", "Text reminders so you never miss a visit"].map((t) => (
                  <li key={t} className="flex gap-3">
                    <svg viewBox="0 0 16 16" className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke={TEAL} strokeWidth="1.5" strokeLinecap="round"><path d="M2 8.5l4 4 8-9" /></svg>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={120} className="lg:col-span-7">
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="cz-panel rounded-2xl p-8 space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <label className="block text-sm font-medium">Full name
                  <input required type="text" placeholder="Jane Rivera" className="cz-input font-normal" />
                </label>
                <label className="block text-sm font-medium">Phone
                  <input required type="tel" placeholder="(929) 555-0000" className="cz-input font-normal" />
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <label className="block text-sm font-medium">Service
                  <select className="cz-input font-normal">
                    {SERVICES.map((s) => <option key={s.name}>{s.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">Preferred date
                  <input type="date" className="cz-input font-normal" />
                </label>
              </div>
              <button type="submit" className="w-full rounded-xl py-3.5 font-semibold text-sm text-white transition-transform hover:-translate-y-0.5" style={{ background: TEAL, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(13,95,91,0.4), 0 14px 28px -12px rgba(13,95,91,0.55)" }}>
                Request appointment
              </button>
              {sent && (
                <p role="status" className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(13,95,91,0.06)", border: `1px solid rgba(13,95,91,0.25)`, color: TEAL }}>
                  This is a demonstration model — no request was sent. On a live site, the
                  AI care team would confirm your visit within minutes.
                </p>
              )}
            </form>
          </Reveal>
        </div>
      </section>

      {/* ── Insurance strip ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 py-16">
        <Reveal>
          <div className="cz-panel rounded-2xl px-8 py-9 flex flex-wrap items-center gap-x-10 gap-y-5">
            <div className="min-w-[200px]">
              <h3 className="font-semibold tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>We work with most PPO plans.</h3>
              <p className="mt-1 text-xs text-[#22272b]/50">Benefits verified before your first visit — at no charge.</p>
            </div>
            <div className="flex flex-wrap gap-2.5 text-sm text-[#22272b]/60">
              {["PPO Dental", "Employer Group Plans", "Family Dental Plans", "Indemnity Plans", "In-House Membership"].map((p) => (
                <span key={p} className="rounded-full px-4 py-1.5" style={{ border: `1px solid ${HAIR}`, background: "#fafaf8" }}>{p}</span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t" style={{ borderColor: HAIR }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#22272b]/55">
          <p>
            <span className="font-semibold text-[#22272b]" style={{ fontFamily: "Sora, sans-serif" }}>Clareza Dental Studio</span>
            {" "}· 31-07 30th Avenue, Astoria, Queens NY ·{" "}
            <a href="tel:+19295550107" style={{ color: TEAL }}>(929) 555-0107</a>
          </p>
          <p className="text-xs">
            Demonstration model · website + AI by{" "}
            <a href="https://www.guileoai.com" target="_blank" rel="noreferrer" className="font-semibold hover:underline" style={{ color: TEAL }}>Guileo</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
