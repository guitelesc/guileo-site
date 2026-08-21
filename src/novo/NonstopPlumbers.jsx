// NONSTOP PLUMBERS NY — demonstration rebuild (website-porta engine, Guileo)
// Real data only: nonstopplumbers.com · (212) 567-2000 · no prices, no fake reviews.
import { useEffect, useRef, useState } from "react";

const PHONE = "(212) 567-2000";
const TEL = "tel:+12125672000";

/* ── inline icons: 1.5px stroke, no emoji ── */
const I = {
  wrench: <path d="M14.7 6.3a4.2 4.2 0 0 0-5.6 5.2L3.5 17.1a1.9 1.9 0 0 0 2.7 2.7l5.6-5.6a4.2 4.2 0 0 0 5.2-5.6l-2.6 2.6-2.3-.6-.6-2.3 2.6-2.6z" />,
  drop: <path d="M12 3.2s6 6.6 6 11a6 6 0 1 1-12 0c0-4.4 6-11 6-11zM9.5 14.5a2.6 2.6 0 0 0 2.4 2.6" />,
  flame: <path d="M12 3c1.2 3-.6 4.6-1.6 6C9.2 10.6 8 12 8 14.2A4.3 4.3 0 0 0 12.3 18a4.1 4.1 0 0 0 3.7-4.2c0-1.6-.8-2.6-1.4-3.5-.5.8-.9 1.1-1.6 1.4.5-2.9-.2-6-1-8.7zM4 21h16" />,
  clip: <path d="M9 4.5h6M9.5 3h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8.5 5H7a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17 5h-1.5M8.7 12l2 2 4-4.2M9 17.5h6" />,
  valve: <path d="M12 8v13M5 21h14M12 8a4 4 0 0 1-4-4h8a4 4 0 0 1-4 4zM6.5 14.5h11" />,
  bldg: <path d="M4 21h16M6 21V5.5A1.5 1.5 0 0 1 7.5 4h6A1.5 1.5 0 0 1 15 5.5V21m0-11h3.5a.5.5 0 0 1 .5.5V21M8.5 7.5h1.5m2.5 0H14M8.5 11h1.5m2.5 0H14M8.5 14.5h1.5m2.5 0H14M10.5 21v-3h2v3" />,
  pipe: <path d="M3 8h6a2 2 0 0 1 2 2v11M3 12h4a2 2 0 0 1 2 2v7M14 3v6a2 2 0 0 0 2 2h5M14 3h7M18 11v2m-8 4h2" />,
  bolt: <path d="M13 2.5 4.5 13.5H11L9.8 21.5 18.5 10H12l1-7.5z" />,
  phone: <path d="M5.5 3.5h3l1.5 4-2 1.5a11.5 11.5 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C9.6 17.9 6.1 14.4 5 6.9A1.5 1.5 0 0 1 5.5 3.5z" />,
};
const Ic = ({ d, s = 22, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

/* ── engineered credential seal ── */
const Seal = ({ label, sub }) => (
  <div className="np-rev flex items-center gap-4 border-l border-[#243044] pl-5 py-1">
    <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true">
      <circle cx="23" cy="23" r="21" stroke="#c9974a" strokeWidth="1" opacity=".8" />
      <circle cx="23" cy="23" r="16.5" stroke="#c9974a" strokeWidth=".75" strokeDasharray="2.5 3.5" opacity=".65" />
      <path d="M15.5 23.5l5 5 10-11" stroke="#c9974a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <div>
      <div className="font-semibold text-[#e8edf5] text-sm tracking-wide uppercase" style={{ fontFamily: "'Archivo', sans-serif" }}>{label}</div>
      <div className="text-xs text-[#7d8aa0] mt-0.5">{sub}</div>
    </div>
  </div>
);

const SERVICES = [
  { ic: I.bolt, t: "Emergency Services", d: ["24/7 emergency repairs", "Leak detection", "Water heaters", "Violation removal & compliance corrections"] },
  { ic: I.drop, t: "Drain & Sewer", d: ["Drain cleaning & repairs", "Sewer snaking", "Camera inspections"] },
  { ic: I.wrench, t: "Installations & Remodeling", d: ["Fixture installation", "Repiping", "Bathroom & kitchen plumbing", "Gas lines"] },
  { ic: I.flame, t: "Fire Suppression Systems", d: ["Sprinkler design & installation", "Inspections & maintenance", "Standpipe 5-year inspections"] },
  { ic: I.clip, t: "Compliance Testing", d: ["Annual backflow preventer testing", "Local Law 152 gas piping inspections", "NYC plumbing code inspections"] },
  { ic: I.valve, t: "Water Main Services", d: ["Water main repair & replacement", "Street-to-building service"] },
  { ic: I.bldg, t: "New Construction & Remodeling", d: ["Ground-up plumbing systems", "Full remodels & build-outs"] },
  { ic: I.pipe, t: "Service Plans & Memberships", d: ["Building service plans", "Home plumbing memberships"] },
];

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

export default function NonstopPlumbers() {
  const rootRef = useRef(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const links = [
      Object.assign(document.createElement("link"), { rel: "preconnect", href: "https://fonts.googleapis.com" }),
      Object.assign(document.createElement("link"), { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,500..900&family=Inter:wght@400;500;600&display=swap" }),
    ];
    links.forEach((l) => document.head.appendChild(l));

    const els = rootRef.current?.querySelectorAll(".np-rev") ?? [];
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("np-in"); io.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    // fail-open: if the observer never fires, everything becomes visible anyway
    const failOpen = setTimeout(() => els.forEach((el) => el.classList.add("np-in")), 1400);
    return () => { io.disconnect(); clearTimeout(failOpen); links.forEach((l) => l.remove()); };
  }, []);

  return (
    <div ref={rootRef} className="np-root min-h-screen text-[#c3ccd9] overflow-x-clip" style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0a0e14" }}>
      <style>{`
        .np-root{position:relative;
          background-image:
            radial-gradient(1100px 620px at 82% -8%, rgba(90,130,180,.07), transparent 60%),
            radial-gradient(950px 560px at 4% 10%, rgba(201,151,74,.05), transparent 58%),
            radial-gradient(1200px 900px at 50% 112%, rgba(60,80,110,.08), transparent 62%);}
        .np-root::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.45;mix-blend-mode:soft-light;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E");}
        .np-disp{font-family:'Archivo',Impact,sans-serif;font-stretch:125%;font-weight:900;letter-spacing:-.01em;}
        /* hero: cinematic drift — light moving through dark water/steel */
        @keyframes np-drift{0%{background-position:0% 40%,100% 60%,50% 0%}50%{background-position:100% 55%,0% 45%,55% 100%}100%{background-position:0% 40%,100% 60%,50% 0%}}
        .np-hero-bg{position:absolute;inset:-6%;z-index:0;
          background-image:
            radial-gradient(70% 90% at 30% 40%, rgba(46,84,130,.55), transparent 65%),
            radial-gradient(60% 80% at 75% 65%, rgba(18,34,56,.9), transparent 70%),
            linear-gradient(160deg, #0d1420 0%, #0a0e14 45%, #060a10 100%);
          background-size:220% 220%,200% 200%,100% 100%;
          animation:np-drift 26s ease-in-out infinite;}
        .np-caustic{position:absolute;inset:0;z-index:1;width:100%;height:100%;opacity:.5;mix-blend-mode:screen;}
        .np-hero-vig{position:absolute;inset:0;z-index:2;background:
          linear-gradient(180deg, rgba(6,9,14,.55), transparent 30%, transparent 62%, #0a0e14 98%),
          radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(4,6,10,.7) 100%);}
        /* glass with studio lighting (house pattern, recolored) */
        .np-glass{position:relative;border:1px solid rgba(143,168,200,.13);background:rgba(255,255,255,.028);border-radius:14px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.09), inset 0 -1px 0 rgba(0,0,0,.30), 0 30px 70px -34px rgba(0,0,0,.85);}
        .np-glass::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1;mix-blend-mode:screen;
          background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.015) 16%, transparent 38%),
          radial-gradient(120% 70% at 82% -12%, rgba(255,255,255,.055), transparent 55%);}
        .np-card{overflow:hidden;transition:transform .3s ease,border-color .3s ease,box-shadow .3s ease;}
        .np-card::after{content:"";position:absolute;top:0;left:0;width:55%;height:100%;z-index:2;pointer-events:none;
          background:linear-gradient(105deg, transparent, rgba(255,255,255,.06), transparent);
          transform:translateX(-160%) skewX(-12deg);transition:transform .8s ease;}
        .np-card:hover{transform:translateY(-5px);border-color:rgba(201,151,74,.3);box-shadow:0 28px 60px -24px rgba(0,0,0,.8),0 0 0 1px rgba(201,151,74,.10);}
        .np-card:hover::after{transform:translateX(260%) skewX(-12deg);}
        .np-rev{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s ease;}
        .np-rev.np-in{opacity:1;transform:none;}
        .np-cta{background:linear-gradient(180deg,#ff5a33,#e83a17);color:#fff;box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 -2px 0 rgba(0,0,0,.25) inset,0 16px 40px -14px rgba(232,58,23,.55);transition:transform .25s ease,filter .25s ease;}
        .np-cta:hover{transform:scale(1.03);filter:brightness(1.08);}
        .np-hair{border-top:1px solid rgba(143,168,200,.12);}
        .np-input{background:rgba(255,255,255,.04);border:1px solid rgba(143,168,200,.18);border-radius:8px;padding:.65rem .85rem;width:100%;color:#e8edf5;font-size:.9rem;outline:none;transition:border-color .2s;}
        .np-input:focus{border-color:rgba(255,90,51,.55);}
        .np-label{font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:#7d8aa0;font-weight:600;}
        @media (prefers-reduced-motion:reduce){.np-hero-bg{animation:none}.np-rev{transition:none}}
      `}</style>

      {/* ── (1) HERO ── */}
      <header className="relative min-h-[92vh] flex flex-col overflow-hidden">
        <div className="np-hero-bg" />
        <svg className="np-caustic" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <filter id="np-water"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.026" numOctaves="2" seed="7">
            <animate attributeName="baseFrequency" dur="34s" values="0.012 0.026;0.016 0.021;0.012 0.026" repeatCount="indefinite" />
          </feTurbulence><feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.32  0 0 0 0 0.52  0 0 0 0.5 0" /><feComposite operator="in" in2="SourceGraphic" /></filter>
          <rect width="900" height="600" filter="url(#np-water)" />
        </svg>
        <div className="np-hero-vig" />

        <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
          <div className="np-disp text-lg tracking-wide text-[#e8edf5]">NONSTOP <span className="text-[#c9974a]">PLUMBERS</span> <span className="text-[#7d8aa0] font-medium text-sm">NY</span></div>
          <a href={TEL} className="hidden sm:flex items-center gap-2 text-sm font-semibold text-[#ff6a45]"><Ic d={I.phone} s={17} />{PHONE}</a>
        </nav>

        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-12 pb-16 max-w-6xl w-full mx-auto">
          <p className="np-label mb-4 text-[#8fa8c8]">Licensed Master Plumbers · All Five Boroughs of NYC</p>
          <h1 className="np-disp text-[#e8edf5] leading-[0.9]" style={{ fontSize: "clamp(3.2rem, 11vw, 8.5rem)" }}>
            NONSTOP.<br /><span className="text-[#8fa8c8]">24/7/365.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[#9aa6b8] text-base sm:text-lg">
            Emergency plumbing, drain &amp; sewer, fire suppression and NYC compliance — dispatched around the clock, every day of the year.
          </p>
          <div className="mt-10">
            <div className="np-label mb-2" style={{ color: "#ff8a6b" }}>Emergency dispatch — answered 24/7 by AI, dispatched in minutes</div>
            <a href={TEL} className="np-cta np-disp inline-block rounded-xl px-7 sm:px-10 py-4 sm:py-5 leading-none" style={{ fontSize: "clamp(1.9rem, 5.5vw, 3.6rem)", letterSpacing: ".01em" }}>
              (212) 567-2000
            </a>
          </div>
        </div>
      </header>

      {/* ── (2) CREDENTIALS BAR ── */}
      <section className="relative z-10 np-hair">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Seal label="Master Plumber" sub="Licensed" />
          <Seal label="Master Fire Suppression" sub="Licensed" />
          <Seal label="Fully Insured" sub="Every job, every borough" />
          <Seal label="24/7 Emergency Dispatch" sub="365 days a year" />
        </div>
      </section>

      {/* ── (3) SERVICES ── */}
      <section className="relative z-10 np-hair">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-16 sm:py-24">
          <div className="np-rev flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <p className="np-label mb-2">Full-scope licensed contractor</p>
              <h2 className="np-disp text-3xl sm:text-5xl text-[#e8edf5]">EVERY PIPE.<br />EVERY CODE.</h2>
            </div>
            <p className="text-sm text-[#7d8aa0] max-w-xs">From a burst line at 3 a.m. to a five-year standpipe inspection — one licensed team.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICES.map((s) => (
              <article key={s.t} className="np-rev np-glass np-card p-5">
                <div className="relative z-[3] text-[#c9974a] mb-4"><Ic d={s.ic} s={26} /></div>
                <h3 className="relative z-[3] np-disp text-[15px] uppercase tracking-wide text-[#e8edf5] mb-3">{s.t}</h3>
                <ul className="relative z-[3] space-y-1.5">
                  {s.d.map((x) => (
                    <li key={x} className="text-[13px] text-[#8b96a8] leading-snug pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 bg-[#3d5a80]" />{x}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── (4) BOROUGHS ── */}
      <section className="relative z-10 np-hair">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-14 sm:py-20">
          <p className="np-rev np-label mb-6">Coverage · All of New York City</p>
          <div className="np-rev">
            {BOROUGHS.map((b, i) => (
              <div key={b} className="flex items-baseline justify-between gap-4 py-3 sm:py-4 np-hair first:border-t-0 group">
                <div className="flex items-baseline gap-4 sm:gap-8 min-w-0">
                  <span className="text-xs text-[#3d5a80] font-semibold w-8 shrink-0">0{i + 1}</span>
                  <span className="np-disp text-2xl sm:text-4xl text-[#e8edf5] uppercase tracking-tight group-hover:text-[#c9974a] transition-colors truncate">{b}</span>
                </div>
                <span className="np-label shrink-0" style={{ color: "#8fa8c8" }}>24/7 dispatch</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── (5) PLANS ── */}
      <section className="relative z-10 np-hair">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-16 sm:py-24">
          <div className="np-rev mb-10">
            <p className="np-label mb-2">Stay ahead of the emergency</p>
            <h2 className="np-disp text-3xl sm:text-5xl text-[#e8edf5]">SERVICE PLANS &amp; MEMBERSHIPS</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { t: "Building Service Plans", tag: "For NYC buildings", pts: ["Scheduled maintenance for building systems", "Compliance testing kept on calendar — backflow, Local Law 152, code inspections", "Priority 24/7 emergency response", "Fire suppression inspection & maintenance coverage"] },
              { t: "Home Plumbing Memberships", tag: "For homes", pts: ["Ongoing care for your home's plumbing", "Priority scheduling, 24/7/365", "Emergency repairs handled by licensed master plumbers", "One number for everything: dispatch answers around the clock"] },
            ].map((p) => (
              <article key={p.t} className="np-rev np-glass np-card p-7 sm:p-9">
                <div className="relative z-[3]">
                  <p className="np-label mb-3" style={{ color: "#c9974a" }}>{p.tag}</p>
                  <h3 className="np-disp text-2xl sm:text-3xl text-[#e8edf5] mb-5">{p.t}</h3>
                  <ul className="space-y-2.5 mb-8">
                    {p.pts.map((x) => (
                      <li key={x} className="text-sm text-[#9aa6b8] leading-relaxed pl-4 relative">
                        <span className="absolute left-0 top-[9px] w-1.5 h-1.5 border border-[#c9974a]" />{x}
                      </li>
                    ))}
                  </ul>
                  <a href="#np-contact" className="inline-block text-sm font-semibold text-[#e8edf5] border border-[rgba(143,168,200,.3)] rounded-lg px-5 py-2.5 hover:border-[#c9974a] hover:text-[#c9974a] transition-colors">Request plan details</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── (6) CONTACT ── */}
      <section id="np-contact" className="relative z-10 np-hair">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="np-rev">
            <p className="np-label mb-2" style={{ color: "#ff8a6b" }}>Emergency? Don't fill a form.</p>
            <h2 className="np-disp text-3xl sm:text-5xl text-[#e8edf5] mb-6">CALL DISPATCH NOW.</h2>
            <a href={TEL} className="np-cta np-disp inline-block rounded-xl px-7 py-4 leading-none mb-6" style={{ fontSize: "clamp(1.7rem, 4vw, 2.8rem)" }}>{PHONE}</a>
            <p className="text-sm text-[#7d8aa0] max-w-sm">Answered 24/7/365. Serving Manhattan, Brooklyn, Queens, the Bronx and Staten Island.</p>
          </div>
          <form
            className="np-rev np-glass p-7 sm:p-8"
            onSubmit={(e) => { e.preventDefault(); setSent(true); }}
          >
            <div className="relative z-[3]">
              <h3 className="np-disp text-lg uppercase tracking-wide text-[#e8edf5] mb-5">Schedule service</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <label className="block"><span className="np-label block mb-1.5">Name</span><input className="np-input" name="name" autoComplete="name" required /></label>
                <label className="block"><span className="np-label block mb-1.5">Phone</span><input className="np-input" name="phone" type="tel" autoComplete="tel" required /></label>
              </div>
              <label className="block mb-4"><span className="np-label block mb-1.5">Service needed</span>
                <select className="np-input" name="service" defaultValue="">
                  <option value="" disabled>Select…</option>
                  {SERVICES.map((s) => <option key={s.t}>{s.t}</option>)}
                </select>
              </label>
              <label className="block mb-6"><span className="np-label block mb-1.5">Details</span><textarea className="np-input" name="details" rows={3} /></label>
              <button type="submit" className="np-cta np-disp w-full rounded-lg py-3.5 text-lg uppercase tracking-wide">Request service</button>
              {sent && (
                <p className="mt-4 text-sm text-[#c9974a] border border-[rgba(201,151,74,.35)] rounded-lg px-4 py-3 bg-[rgba(201,151,74,.07)]">
                  This is a demonstration rebuild — the form is not connected yet. For real service, call {PHONE}.
                </p>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* ── (7) FOOTER ── */}
      <footer className="relative z-10 np-hair">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-[#7d8aa0]">
            <span className="np-disp text-[#e8edf5] text-sm mr-2">NONSTOP PLUMBERS NY</span>
            Master Plumber Licensed · Master Fire Suppression Licensed · Fully Insured · <a href={TEL} className="text-[#ff6a45] font-semibold">{PHONE}</a>
          </div>
          <a href="https://www.guileoai.com" target="_blank" rel="noreferrer" className="text-[11px] text-[#5c6878] hover:text-[#c9974a] transition-colors">
            Demonstration rebuild proposed by Guileo · website + AI
          </a>
        </div>
      </footer>
    </div>
  );
}
