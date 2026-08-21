// NONSTOP PLUMBERS NY — demonstration rebuild (website-porta engine, Guileo)
// Their own assets: /novo/nonstop/{hero-web.mp4,hero-poster.webp,logo-hi.webp,crew-hi.webp,boiler-hi.webp}
// Their own palette: red #d92a28 / #c1362d · cyan #17c6ff · navy #0c1a2e on white.
// Real content only — nonstopplumbers.com · (212) 567-2000. No prices, no invented stats.
import { useEffect, useRef, useState } from "react";

const PHONE = "(212) 567-2000";
const TEL = "tel:+12125672000";
const A = "/novo/nonstop/";

/* ── inline icons, 1.5px stroke — no emoji anywhere ── */
const I = {
  bolt: <path d="M13 2.5 4.5 13.5H11L9.8 21.5 18.5 10H12l1-7.5z" />,
  drop: <path d="M12 3.2s6 6.6 6 11a6 6 0 1 1-12 0c0-4.4 6-11 6-11zM9.5 14.5a2.6 2.6 0 0 0 2.4 2.6" />,
  wrench: <path d="M14.7 6.3a4.2 4.2 0 0 0-5.6 5.2L3.5 17.1a1.9 1.9 0 0 0 2.7 2.7l5.6-5.6a4.2 4.2 0 0 0 5.2-5.6l-2.6 2.6-2.3-.6-.6-2.3 2.6-2.6z" />,
  flame: <path d="M12 3c1.2 3-.6 4.6-1.6 6C9.2 10.6 8 12 8 14.2A4.3 4.3 0 0 0 12.3 18a4.1 4.1 0 0 0 3.7-4.2c0-1.6-.8-2.6-1.4-3.5-.5.8-.9 1.1-1.6 1.4.5-2.9-.2-6-1-8.7zM4 21h16" />,
  clip: <path d="M9 4.5h6M9.5 3h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8.5 5H7a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17 5h-1.5M8.7 12l2 2 4-4.2M9 17.5h6" />,
  valve: <path d="M12 8v13M5 21h14M12 8a4 4 0 0 1-4-4h8a4 4 0 0 1-4 4zM6.5 14.5h11" />,
  bldg: <path d="M4 21h16M6 21V5.5A1.5 1.5 0 0 1 7.5 4h6A1.5 1.5 0 0 1 15 5.5V21m0-11h3.5a.5.5 0 0 1 .5.5V21M8.5 7.5h1.5m2.5 0H14M8.5 11h1.5m2.5 0H14M8.5 14.5h1.5m2.5 0H14M10.5 21v-3h2v3" />,
  pipe: <path d="M3 8h6a2 2 0 0 1 2 2v11M3 12h4a2 2 0 0 1 2 2v7M14 3v6a2 2 0 0 0 2 2h5M14 3h7M18 11v2m-8 4h2" />,
  phone: <path d="M5.5 3.5h3l1.5 4-2 1.5a11.5 11.5 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C9.6 17.9 6.1 14.4 5 6.9A1.5 1.5 0 0 1 5.5 3.5z" />,
  shield: <path d="M12 3 5 5.8v5.4c0 4.3 2.9 7.5 7 8.8 4.1-1.3 7-4.5 7-8.8V5.8L12 3zm-2.6 8.6 2 2 4.4-4.6" />,
  clock: <><circle cx="12" cy="12" r="8.8" /><path d="M12 6.8V12l3.4 2" /></>,
};
const Ic = ({ d, s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const SERVICES = [
  { ic: I.bolt, t: "Emergency Services", d: ["24/7 emergency repairs", "Leak detection", "Water heater installation & repair", "Violation removal & compliance corrections"] },
  { ic: I.drop, t: "Drain & Sewer", d: ["Drain cleaning", "Sewer line service", "Snaking", "Camera inspections"] },
  { ic: I.wrench, t: "Installations & Remodeling", d: ["Fixture installation", "Pipe repair & repiping", "Bath & kitchen plumbing", "Gas lines"] },
  { ic: I.flame, t: "Fire Suppression", d: ["Sprinkler design & installation", "Inspections & compliance testing", "System maintenance", "Standpipe 5-year inspections"] },
  { ic: I.clip, t: "Compliance Testing", d: ["Annual backflow preventer testing", "Local Law 152 gas piping inspections", "NYC plumbing code inspections"] },
  { ic: I.valve, t: "Water Main Services", d: ["Water main repair & replacement", "Street-to-building service lines"] },
  { ic: I.bldg, t: "New Construction & Remodeling", d: ["Ground-up plumbing systems", "Full build-outs & remodels"] },
  { ic: I.pipe, t: "Service Plans & Memberships", d: ["Building service plans", "Home plumbing memberships"] },
];
const CREDS = [
  { ic: I.shield, t: "Master Plumber", s: "Licensed" },
  { ic: I.flame, t: "Master Fire Suppression", s: "Licensed" },
  { ic: I.clip, t: "Fully Insured", s: "Commercial & residential" },
  { ic: I.clock, t: "24/7 Emergency Dispatch", s: "365 days a year" },
];
const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

const CSS = `
.np{--navy:#0c1a2e;--navy-2:#16283f;--red:#d92a28;--red-d:#c1362d;--cyan:#17c6ff;--ink:#0c1a2e;--mut:#5a6b80;--line:rgba(12,26,46,.11);--paper:#f5f7fa;
 background:#fff;color:var(--ink);font-family:'Inter',system-ui,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.np *{box-sizing:border-box}
.np h1,.np h2,.np h3,.np .dsp{font-family:'Archivo',Impact,system-ui,sans-serif;font-stretch:125%;letter-spacing:-.02em;line-height:.98}
.np-w{max-width:1200px;margin:0 auto;padding:0 20px}
@media(min-width:768px){.np-w{padding:0 36px}}
.np-lab{font-family:'Archivo',system-ui,sans-serif;font-stretch:112%;font-weight:700;font-size:11px;letter-spacing:.16em;text-transform:uppercase}
/* light-surface depth = shadow discipline, never a gradient blob */
.np-card{position:relative;background:#fff;border:1px solid var(--line);border-radius:4px;
 box-shadow:0 1px 2px rgba(12,26,46,.06),0 20px 44px -34px rgba(12,26,46,.45);
 transition:transform .32s cubic-bezier(.2,.7,.3,1),box-shadow .32s,border-color .32s;overflow:hidden}
.np-card:hover{transform:translateY(-4px);border-color:rgba(12,26,46,.2);
 box-shadow:0 2px 4px rgba(12,26,46,.07),0 34px 64px -34px rgba(12,26,46,.5)}
.np-card::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(104deg,transparent 38%,rgba(23,198,255,.11) 50%,transparent 62%);
 transform:translateX(-120%);transition:transform .85s ease}
.np-card:hover::after{transform:translateX(120%)}
/* dark cinematic surfaces: layered radial light + film grain in soft-light */
.np-dark{position:relative;background-color:#08111e;background-image:
 radial-gradient(1200px 640px at 78% -12%,rgba(23,198,255,.13),transparent 60%),
 radial-gradient(900px 520px at 4% 12%,rgba(217,42,40,.12),transparent 58%),
 radial-gradient(1300px 900px at 50% 114%,rgba(120,150,190,.09),transparent 62%)}
.np-grain::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;opacity:.42;mix-blend-mode:soft-light;
 background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E")}
.np-rule{height:4px;background:linear-gradient(90deg,var(--red) 0 34%,#fff 34% 66%,var(--cyan) 66% 100%)}
.np-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:var(--red);color:#fff;
 padding:16px 26px;border-radius:3px;font-weight:800;letter-spacing:.01em;border:1px solid rgba(0,0,0,.15);
 box-shadow:0 1px 0 rgba(255,255,255,.28) inset,0 -1px 0 rgba(0,0,0,.22) inset,0 16px 34px -18px rgba(217,42,40,.75);
 transition:transform .2s,filter .2s,box-shadow .2s;text-decoration:none}
.np-btn:hover{filter:brightness(1.07);transform:translateY(-2px);box-shadow:0 1px 0 rgba(255,255,255,.3) inset,0 22px 44px -18px rgba(217,42,40,.8)}
.np-btn:active{transform:translateY(0)}
.np-btn-o{display:inline-flex;align-items:center;gap:10px;padding:15px 24px;border-radius:3px;font-weight:700;
 border:1px solid rgba(255,255,255,.3);color:#fff;text-decoration:none;background:rgba(255,255,255,.06);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -1px 0 rgba(0,0,0,.3);transition:background .25s,border-color .25s}
.np-btn-o:hover{background:rgba(255,255,255,.13);border-color:rgba(23,198,255,.65)}
.np-rev{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.3,1)}
.np-rev.np-in{opacity:1;transform:none}
.np-in-d1{transition-delay:.07s}.np-in-d2{transition-delay:.14s}.np-in-d3{transition-delay:.21s}
.np-field{width:100%;background:#fff;border:1px solid var(--line);border-radius:3px;padding:13px 14px;font-size:15px;color:var(--ink);
 box-shadow:inset 0 1px 2px rgba(12,26,46,.06);outline:none;transition:border-color .2s,box-shadow .2s}
.np-field:focus{border-color:var(--cyan);box-shadow:inset 0 1px 2px rgba(12,26,46,.05),0 0 0 3px rgba(23,198,255,.18)}
@media(prefers-reduced-motion:reduce){.np-rev{opacity:1;transform:none;transition:none}.np-card,.np-btn{transition:none}}
`;

export default function NonstopPlumbers() {
  const root = useRef(null);
  const [sent, setSent] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(m.matches);
    const on = (e) => setStill(e.matches);
    m.addEventListener?.("change", on);

    const links = [
      Object.assign(document.createElement("link"), { rel: "preconnect", href: "https://fonts.googleapis.com" }),
      Object.assign(document.createElement("link"), { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }),
      Object.assign(document.createElement("link"), {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..900&family=Inter:wght@400;500;600;700&display=swap",
      }),
    ];
    links.forEach((l) => document.head.appendChild(l));

    const els = root.current ? Array.from(root.current.querySelectorAll(".np-rev")) : [];
    const show = () => els.forEach((el) => el.classList.add("np-in"));
    let io;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (ents) => ents.forEach((e) => e.isIntersecting && (e.target.classList.add("np-in"), io.unobserve(e.target))),
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      els.forEach((el) => io.observe(el));
    }
    const failOpen = setTimeout(show, 1400); // MANDATORY fail-open

    return () => {
      clearTimeout(failOpen); io?.disconnect();
      m.removeEventListener?.("change", on);
      links.forEach((l) => l.remove());
    };
  }, []);

  return (
    <div className="np" ref={root}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b" style={{ borderColor: "var(--line)" }}>
        <div className="np-w flex items-center justify-between gap-4 h-[76px]">
          <a href="#top" className="flex items-center shrink-0">
            <img src={`${A}logo-hi.webp`} alt="Nonstop Plumbers NY" className="h-11 w-auto" width="220" height="44" />
          </a>
          <nav className="hidden lg:flex items-center gap-8 np-lab" style={{ color: "var(--mut)" }}>
            <a href="#services" className="hover:text-[color:var(--navy)] transition-colors">Services</a>
            <a href="#crew" className="hover:text-[color:var(--navy)] transition-colors">On the job</a>
            <a href="#plans" className="hover:text-[color:var(--navy)] transition-colors">Service plans</a>
            <a href="#contact" className="hover:text-[color:var(--navy)] transition-colors">Contact</a>
          </nav>
          <a href={TEL} className="np-btn !py-3 !px-4 sm:!px-5 text-sm">
            <Ic d={I.phone} s={18} />
            <span className="hidden sm:inline">{PHONE}</span>
            <span className="sm:hidden">Call 24/7</span>
          </a>
        </div>
        <div className="np-rule" />
      </header>

      {/* ── HERO — THEIR video ───────────────────────────────── */}
      <section id="top" className="relative isolate np-dark np-grain overflow-hidden">
        <div className="absolute inset-0 z-0">
          {still ? (
            <img src={`${A}hero-poster.webp`} alt="Nonstop Plumbers technicians on a New York job site"
              className="w-full h-full object-cover" />
          ) : (
            <video className="w-full h-full object-cover" autoPlay muted loop playsInline preload="metadata"
              poster={`${A}hero-poster.webp`} aria-hidden="true">
              <source src={`${A}hero-web.mp4`} type="video/mp4" />
            </video>
          )}
        </div>
        {/* scrim: readable type over their footage, in their navy */}
        <div className="absolute inset-0 z-[1]" style={{
          background:
            "linear-gradient(180deg,rgba(6,14,25,.82) 0%,rgba(6,14,25,.55) 34%,rgba(6,14,25,.72) 72%,rgba(6,14,25,.94) 100%)," +
            "linear-gradient(90deg,rgba(6,14,25,.86) 0%,rgba(6,14,25,.35) 62%,rgba(6,14,25,.2) 100%)",
        }} />
        <div className="relative z-10 np-w py-20 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <div className="np-rev np-lab flex flex-wrap items-center gap-x-3 gap-y-2" style={{ color: "var(--cyan)" }}>
              <span className="inline-block w-8 h-px" style={{ background: "var(--cyan)" }} />
              24/7/365 · All five boroughs
            </div>
            <h1 className="np-rev np-in-d1 mt-6 text-white font-black text-[42px] sm:text-6xl lg:text-[80px]">
              WHEN IT CAN&rsquo;T WAIT,<br />
              <span style={{ color: "#fff" }}>WE DON&rsquo;T </span>
              <span style={{ color: "var(--red)" }}>STOP.</span>
            </h1>
            <p className="np-rev np-in-d2 mt-6 text-[17px] sm:text-lg leading-relaxed max-w-xl" style={{ color: "#cdd8e6" }}>
              Emergency plumbing, drain &amp; sewer, fire suppression and NYC compliance —
              Master Plumber and Master Fire Suppression licensed, fully insured, across
              Manhattan, Brooklyn, Queens, the Bronx and Staten Island.
            </p>

            {/* dispatch block — the most prominent action on the page */}
            <div className="np-rev np-in-d3 mt-10 inline-block max-w-full">
              <div className="np-lab mb-3" style={{ color: "#9fb2c8", letterSpacing: ".18em" }}>
                Emergency dispatch — answered 24/7 by AI, dispatched in minutes
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href={TEL} className="np-btn text-xl sm:text-2xl dsp !py-5 !px-8">
                  <Ic d={I.phone} s={22} />{PHONE}
                </a>
                <a href="#services" className="np-btn-o justify-center">See what we handle</a>
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10 np-rule" />
      </section>

      {/* ── CREDENTIALS BAND ─────────────────────────────────── */}
      <section className="border-b" style={{ background: "var(--paper)", borderColor: "var(--line)" }}>
        <div className="np-w grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {CREDS.map((c, i) => (
            <div key={c.t} className={`np-rev np-in-d${i % 3 + 1} flex items-center gap-4 py-7 lg:py-8 px-1 lg:px-6 border-b lg:border-b-0 lg:border-r last:border-none`}
              style={{ borderColor: "var(--line)" }}>
              <span className="shrink-0 grid place-items-center w-11 h-11 rounded-[3px] text-white"
                style={{ background: "var(--navy)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.18), 0 10px 22px -14px rgba(12,26,46,.9)" }}>
                <Ic d={c.ic} s={20} />
              </span>
              <div>
                <div className="np-lab" style={{ color: "var(--navy)", fontSize: 12 }}>{c.t}</div>
                <div className="text-[13px] mt-1" style={{ color: "var(--mut)" }}>{c.s}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────── */}
      <section id="services" className="py-20 sm:py-24 bg-white">
        <div className="np-w">
          <div className="np-rev flex flex-wrap items-end justify-between gap-6 mb-12">
            <div>
              <div className="np-lab" style={{ color: "var(--red)" }}>What we handle</div>
              <h2 className="mt-3 font-black text-[34px] sm:text-5xl">EVERY LINE, VALVE<br />AND VIOLATION.</h2>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed" style={{ color: "var(--mut)" }}>
              Residential, commercial and new construction. One licensed team for the repair,
              the inspection and the paperwork that follows it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map((s, i) => (
              <article key={s.t} className={`np-card np-rev np-in-d${i % 4} p-6`}>
                <span className="grid place-items-center w-11 h-11 rounded-[3px]"
                  style={{ background: "rgba(12,26,46,.05)", color: "var(--red)", border: "1px solid var(--line)" }}>
                  <Ic d={s.ic} s={21} />
                </span>
                <h3 className="mt-5 text-[19px] font-extrabold" style={{ color: "var(--navy)" }}>{s.t}</h3>
                <ul className="mt-4 space-y-2">
                  {s.d.map((x) => (
                    <li key={x} className="flex gap-2.5 text-[14px] leading-snug" style={{ color: "var(--mut)" }}>
                      <span className="mt-[7px] shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: "var(--cyan)" }} />
                      {x}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO SHOWS UP — real crew photo + boroughs index ──── */}
      <section id="crew" className="np-dark np-grain relative py-20 sm:py-24 overflow-hidden">
        <div className="np-w relative z-10 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <figure className="np-rev relative rounded-[4px] overflow-hidden"
            style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.12), 0 40px 90px -46px rgba(0,0,0,.95)" }}>
            <img src={`${A}crew-hi.webp`} alt="Nonstop Plumbers technicians unloading tools from their van on a Brooklyn street"
              className="w-full h-full object-cover aspect-[4/3]" loading="lazy" />
            <figcaption className="absolute left-0 bottom-0 right-0 np-lab px-5 py-3 text-white"
              style={{ background: "linear-gradient(0deg,rgba(6,14,25,.9),transparent)" }}>
              Our crew · Brooklyn
            </figcaption>
          </figure>

          <div>
            <div className="np-rev np-lab" style={{ color: "var(--cyan)" }}>Who shows up</div>
            <h2 className="np-rev np-in-d1 mt-3 font-black text-white text-[34px] sm:text-5xl">
              A LICENSED TRUCK,<br />NOT A CALL CENTER.
            </h2>
            <p className="np-rev np-in-d2 mt-6 text-[16px] leading-relaxed max-w-lg" style={{ color: "#c3d0e0" }}>
              The same licensed technicians handle the emergency call, the camera inspection and the
              compliance testing that keeps your building signed off. Marked vans, stocked for the job,
              working every borough around the clock — 365 days a year.
            </p>

            <div className="np-rev np-in-d3 mt-10 pt-8 border-t" style={{ borderColor: "rgba(255,255,255,.14)" }}>
              <div className="np-lab mb-4" style={{ color: "#8fa3ba" }}>Service area</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                {BOROUGHS.map((b) => (
                  <div key={b} className="flex items-center gap-3 text-white text-[15px] font-semibold">
                    <span className="w-1.5 h-5" style={{ background: "var(--red)" }} />{b}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICE PLANS / MEMBERSHIPS ──────────────────────── */}
      <section id="plans" className="py-20 sm:py-24" style={{ background: "var(--paper)" }}>
        <div className="np-w">
          <div className="np-rev max-w-2xl mb-12">
            <div className="np-lab" style={{ color: "var(--red)" }}>Service plans</div>
            <h2 className="mt-3 font-black text-[34px] sm:text-5xl">STAY AHEAD OF<br />THE NEXT SHUTDOWN.</h2>
            <p className="mt-5 text-[15px] leading-relaxed" style={{ color: "var(--mut)" }}>
              Scheduled maintenance and priority response, so the inspection date never becomes
              an emergency call.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <article className="np-card np-rev overflow-hidden flex flex-col">
              <img src={`${A}boiler-hi.webp`} alt="Nonstop Plumbers technician servicing a boiler room"
                className="w-full aspect-[16/9] object-cover" loading="lazy" />
              <div className="p-7 flex-1 flex flex-col">
                <h3 className="text-2xl font-extrabold" style={{ color: "var(--navy)" }}>Building Service Plans</h3>
                <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--mut)" }}>
                  For managed buildings and commercial properties: scheduled maintenance,
                  compliance testing on the calendar (Local Law 152, backflow, standpipe),
                  and priority emergency dispatch.
                </p>
                <a href="#contact" className="np-btn mt-7 self-start !py-3.5 !px-6 text-[15px]">Request plan details</a>
              </div>
            </article>

            <article className="np-card np-rev np-in-d2 p-7 flex flex-col">
              <span className="grid place-items-center w-11 h-11 rounded-[3px]"
                style={{ background: "rgba(12,26,46,.05)", color: "var(--red)", border: "1px solid var(--line)" }}>
                <Ic d={I.pipe} s={21} />
              </span>
              <h3 className="mt-5 text-2xl font-extrabold" style={{ color: "var(--navy)" }}>Home Plumbing Memberships</h3>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--mut)" }}>
                For homeowners: an annual check of fixtures, water heater and drain lines,
                plus front-of-line response when something goes wrong at 2 a.m.
              </p>
              <ul className="mt-6 space-y-2.5">
                {["Annual plumbing inspection", "Water heater check & service", "Drain line maintenance", "Priority 24/7 response"].map((x) => (
                  <li key={x} className="flex gap-2.5 text-[14px]" style={{ color: "var(--mut)" }}>
                    <span className="mt-[7px] shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: "var(--cyan)" }} />{x}
                  </li>
                ))}
              </ul>
              <a href="#contact" className="np-btn mt-7 self-start !py-3.5 !px-6 text-[15px]">
                Request plan details
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* ── CONTACT ──────────────────────────────────────────── */}
      <section id="contact" className="np-dark np-grain relative py-20 sm:py-24">
        <div className="np-w relative z-10 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16">
          <div>
            <div className="np-rev np-lab" style={{ color: "var(--cyan)" }}>Contact</div>
            <h2 className="np-rev np-in-d1 mt-3 font-black text-white text-[34px] sm:text-5xl">
              ONE NUMBER,<br />ANY HOUR.
            </h2>
            <div className="np-rev np-in-d2 mt-9">
              <div className="np-lab mb-3" style={{ color: "#9fb2c8", letterSpacing: ".18em" }}>
                Emergency dispatch — answered 24/7 by AI, dispatched in minutes
              </div>
              <a href={TEL} className="dsp block font-black text-white text-[44px] sm:text-[64px] leading-none hover:text-[color:var(--cyan)] transition-colors">
                {PHONE}
              </a>
              <a href={TEL} className="np-btn mt-6 text-lg !py-4 !px-7">
                <Ic d={I.phone} s={20} />Call now
              </a>
            </div>
            <p className="np-rev np-in-d3 mt-9 text-[15px] leading-relaxed max-w-md" style={{ color: "#a9bacd" }}>
              Emergency plumbing, drain &amp; sewer, fire suppression and compliance across
              Manhattan, Brooklyn, Queens, the Bronx and Staten Island — 24 hours a day, 365 days a year.
            </p>
          </div>

          <div className="np-rev np-in-d2">
            <form className="np-card !bg-white p-7" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <h3 className="text-xl font-extrabold" style={{ color: "var(--navy)" }}>Schedule service</h3>
              <p className="mt-2 text-[14px]" style={{ color: "var(--mut)" }}>
                Not an emergency? Send the details and we&rsquo;ll come back with a time.
              </p>
              <div className="mt-6 grid gap-3">
                <input className="np-field" placeholder="Full name" aria-label="Full name" required />
                <div className="grid sm:grid-cols-2 gap-3">
                  <input className="np-field" placeholder="Phone" aria-label="Phone" type="tel" required />
                  <input className="np-field" placeholder="Email" aria-label="Email" type="email" />
                </div>
                <input className="np-field" placeholder="Address or borough" aria-label="Address or borough" />
                <select className="np-field" aria-label="Service needed" defaultValue="">
                  <option value="" disabled>Service needed</option>
                  {SERVICES.map((s) => <option key={s.t}>{s.t}</option>)}
                </select>
                <textarea className="np-field" rows="3" placeholder="What's going on?" aria-label="What's going on?" />
              </div>
              <button type="submit" className="np-btn w-full mt-5">Request a visit</button>
              {sent && (
                <p className="mt-4 text-[13px] leading-relaxed px-3 py-2.5 rounded-[3px]"
                  style={{ background: "rgba(23,198,255,.09)", border: "1px solid rgba(23,198,255,.35)", color: "var(--navy)" }} role="status">
                  This is a demonstration rebuild — the form is not connected. For real service, call {PHONE}.
                </p>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-white">
        <div className="np-rule" />
        <div className="np-w py-12 grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <img src={`${A}logo-hi.webp`} alt="Nonstop Plumbers NY" className="h-12 w-auto" width="240" height="48" loading="lazy" />
            <p className="mt-5 text-[14px] leading-relaxed max-w-sm" style={{ color: "var(--mut)" }}>
              24/7/365 emergency plumbing, drain &amp; sewer, fire suppression and NYC compliance.
              Master Plumber and Master Fire Suppression licensed · fully insured.
            </p>
          </div>
          <div>
            <div className="np-lab" style={{ color: "var(--navy)" }}>Service area</div>
            <ul className="mt-4 space-y-2 text-[14px]" style={{ color: "var(--mut)" }}>
              {BOROUGHS.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
          <div>
            <div className="np-lab" style={{ color: "var(--navy)" }}>Emergency dispatch</div>
            <a href={TEL} className="dsp mt-4 block text-3xl font-black" style={{ color: "var(--red)" }}>{PHONE}</a>
            <div className="mt-2 text-[13px]" style={{ color: "var(--mut)" }}>Answered 24/7 · dispatched in minutes</div>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: "var(--line)" }}>
          <div className="np-w py-5 flex flex-wrap items-center justify-between gap-3 text-[12px]" style={{ color: "var(--mut)" }}>
            <span>© {new Date().getFullYear()} Nonstop Plumbers NY. All rights reserved.</span>
            <a href="https://www.guileoai.com" target="_blank" rel="noopener noreferrer"
              className="hover:text-[color:var(--navy)] transition-colors">
              Demonstration rebuild proposed by Guileo · website + AI
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
