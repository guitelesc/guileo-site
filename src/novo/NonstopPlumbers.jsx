// NONSTOP PLUMBERS NY — demonstration rebuild v3 (website-porta engine, Guileo)
// CONCEPT: THE DISPATCH BOARD — work-order tickets, a response clock, borough status board,
// a red emergency stripe as structure. Everything fully rounded (pills + 28-32px cards).
// Their own assets: /novo/nonstop/{hero-web.mp4,hero-poster.webp,logo-hi.webp,crew-hi.webp,boiler-hi.webp}
// Their own palette: red #d92a28 · cyan #17c6ff · navy #0c1a2e · paper #f5f7fa.
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
  pin: <path d="M12 21s6.5-6 6.5-10.6a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21zM12 12.6a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z" />,
  arrow: <path d="M4.5 12h14m-5.5-5.6 5.6 5.6-5.6 5.6" />,
};
const Ic = ({ d, s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const SERVICES = [
  { ic: I.bolt, wo: "WO-2401", t: "Emergency Services", tag: "Priority 1", d: ["24/7 emergency repairs", "Leak detection", "Water heater installation & repair", "Violation removal & compliance corrections"] },
  { ic: I.drop, wo: "WO-2402", t: "Drain & Sewer", tag: "Priority 1", d: ["Drain cleaning", "Sewer line service", "Snaking", "Camera inspections"] },
  { ic: I.valve, wo: "WO-2403", t: "Water Main Services", tag: "Priority 1", d: ["Water main repair & replacement", "Street-to-building service lines"] },
  { ic: I.flame, wo: "WO-2404", t: "Fire Suppression", tag: "Licensed", d: ["Sprinkler design & installation", "Inspections & compliance testing", "System maintenance", "Standpipe 5-year inspections"] },
  { ic: I.clip, wo: "WO-2405", t: "Compliance Testing", tag: "Scheduled", d: ["Annual backflow preventer testing", "Local Law 152 gas piping inspections", "NYC plumbing code inspections"] },
  { ic: I.wrench, wo: "WO-2406", t: "Installations & Remodeling", tag: "Scheduled", d: ["Fixture installation", "Pipe repair & repiping", "Bath & kitchen plumbing", "Gas lines"] },
  { ic: I.bldg, wo: "WO-2407", t: "New Construction", tag: "Project", d: ["Ground-up plumbing systems", "Full build-outs & remodels"] },
  { ic: I.pipe, wo: "WO-2408", t: "Service Plans", tag: "Ongoing", d: ["Building service plans", "Home plumbing memberships"] },
];
const CREDS = [
  { ic: I.shield, t: "Master Plumber Licensed" },
  { ic: I.flame, t: "Master Fire Suppression Licensed" },
  { ic: I.clip, t: "Fully Insured" },
  { ic: I.clock, t: "24/7 Emergency Dispatch" },
];
const BOROUGHS = [
  { b: "Manhattan", c: "MN" }, { b: "Brooklyn", c: "BK" }, { b: "Queens", c: "QN" },
  { b: "Bronx", c: "BX" }, { b: "Staten Island", c: "SI" },
];
const PLANS = [
  { wo: "WO-BSP", t: "Building Service Plans", s: "For managed buildings & commercial properties",
    d: ["Planned maintenance across the building's systems", "Compliance testing kept on schedule", "Priority line into the same 24/7 dispatch"] },
  { wo: "WO-HPM", t: "Home Plumbing Memberships", s: "For homeowners and apartments",
    d: ["Routine care for the plumbing you rely on", "Same licensed crew every visit", "Priority line into the same 24/7 dispatch"] },
];

const nyTime = () =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })
    .format(new Date());

const CSS = `
.np-boro{position:relative;text-decoration:none}
.np-boro:nth-child(odd){background:rgba(255,255,255,.045)}
.np-boro:hover{background:rgba(23,198,255,.09)}
.np-led{width:3px;height:22px;border-radius:99px;background:linear-gradient(180deg,#39d98a,rgba(57,217,138,.15));box-shadow:0 0 10px rgba(57,217,138,.45)}
.np-boro-go{opacity:0;transform:translateX(-4px);transition:opacity .25s ease,transform .25s ease}
.np-boro:hover .np-boro-go,.np-boro:focus-visible .np-boro-go{opacity:1;transform:none}
@media (hover:none){.np-boro-go{opacity:.7;transform:none}}

.np{--navy:#0c1a2e;--navy-2:#132741;--red:#d92a28;--red-d:#ab1f1d;--cyan:#17c6ff;--ink:#0c1a2e;--mut:#5a6b80;
 --line:rgba(12,26,46,.11);--paper:#f5f7fa;--stage:#fff;
 background:#fff;color:var(--ink);font-family:'Figtree',system-ui,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.np *{box-sizing:border-box}
.np h1,.np h2,.np h3,.np .dsp{font-family:'Figtree',system-ui,sans-serif;letter-spacing:-.03em;line-height:1.02;font-weight:900}
.np .mono{font-family:'JetBrains Mono','Space Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.np-w{max-width:1200px;margin:0 auto;padding:0 20px}
@media(min-width:768px){.np-w{padding:0 36px}}
.np-lab{font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:600;font-size:11px;letter-spacing:.16em;text-transform:uppercase}

/* the recurring structural element: emergency stripe */
.np-stripe{height:9px;background:repeating-linear-gradient(115deg,var(--red) 0 16px,var(--red-d) 16px 32px)}
.np-stripe-r{border-radius:999px}

/* fully rounded pills */
.np-pill{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:8px 15px;
 border:1px solid var(--line);background:#fff;color:var(--navy);white-space:nowrap}
.np-pill-d{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.09);color:#fff;backdrop-filter:blur(6px)}
.np-btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;background:var(--red);color:#fff;
 padding:18px 30px;border-radius:999px;font-weight:800;letter-spacing:-.01em;border:0;cursor:pointer;
 box-shadow:0 1px 0 rgba(255,255,255,.3) inset,0 18px 38px -16px rgba(217,42,40,.85);
 transition:transform .22s cubic-bezier(.2,.7,.3,1),filter .22s,box-shadow .22s;text-decoration:none}
.np-btn:hover{filter:brightness(1.06);transform:translateY(-3px);box-shadow:0 1px 0 rgba(255,255,255,.32) inset,0 26px 50px -16px rgba(217,42,40,.9)}
.np-btn:active{transform:translateY(0)}
.np-btn-o{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:17px 26px;border-radius:999px;font-weight:700;
 border:1px solid rgba(255,255,255,.3);color:#fff;text-decoration:none;background:rgba(255,255,255,.07);
 transition:background .25s,border-color .25s,transform .22s}
.np-btn-o:hover{background:rgba(255,255,255,.14);border-color:rgba(23,198,255,.7);transform:translateY(-3px)}

/* THE DISPATCH TICKET — punched notches + perforation, generous radius */
.np-tk{position:relative;background:#fff;border:1px solid var(--line);border-radius:28px;overflow:hidden;
 box-shadow:0 1px 2px rgba(12,26,46,.05),0 26px 52px -38px rgba(12,26,46,.5);
 transition:transform .34s cubic-bezier(.2,.7,.3,1),box-shadow .34s,border-color .34s}
.np-tk:hover{transform:translateY(-6px);border-color:rgba(12,26,46,.2);
 box-shadow:0 2px 4px rgba(12,26,46,.06),0 40px 70px -34px rgba(12,26,46,.55)}
.np-tk::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(104deg,transparent 38%,rgba(23,198,255,.13) 50%,transparent 62%);
 transform:translateX(-125%);transition:transform .9s ease}
.np-tk:hover::after{transform:translateX(125%)}
.np-notch{position:absolute;width:24px;height:24px;border-radius:999px;background:var(--stage);
 border:1px solid var(--line);z-index:2}
.np-notch-l{left:-13px}.np-notch-r{right:-13px}
.np-perf{border-top:1.5px dashed rgba(12,26,46,.2)}
.np-perf-d{border-top:1.5px dashed rgba(255,255,255,.24)}
.np-tk-head{background:var(--paper);border-bottom:1px solid var(--line)}

/* dark dispatch-desk surface */
.np-dark{position:relative;background-color:#08111e;background-image:
 radial-gradient(1200px 640px at 78% -12%,rgba(23,198,255,.14),transparent 60%),
 radial-gradient(900px 520px at 4% 12%,rgba(217,42,40,.13),transparent 58%)}
.np-grain::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;opacity:.4;mix-blend-mode:soft-light;
 background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E")}

.np-live{width:9px;height:9px;border-radius:999px;background:#39d98a;box-shadow:0 0 0 0 rgba(57,217,138,.6);animation:npPulse 2.4s ease-out infinite}
@keyframes npPulse{70%{box-shadow:0 0 0 9px rgba(57,217,138,0)}100%{box-shadow:0 0 0 0 rgba(57,217,138,0)}}
.np-frame{border-radius:32px;overflow:hidden;border:1px solid var(--line);
 box-shadow:0 30px 70px -40px rgba(12,26,46,.6)}
.np-rev{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.3,1)}
.np-rev.np-in{opacity:1;transform:none}
.np-in-d1{transition-delay:.07s}.np-in-d2{transition-delay:.14s}.np-in-d3{transition-delay:.21s}
.np-field{width:100%;background:#fff;border:1px solid var(--line);border-radius:999px;padding:14px 18px;font-size:15px;color:var(--ink);
 outline:none;transition:border-color .2s,box-shadow .2s;font-family:inherit}
textarea.np-field{border-radius:22px;resize:vertical}
.np-field:focus{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(23,198,255,.18)}
@media(prefers-reduced-motion:reduce){.np-rev{opacity:1;transform:none;transition:none}
 .np-tk,.np-btn,.np-live{transition:none;animation:none}}
`;

export default function NonstopPlumbers() {
  const root = useRef(null);
  const [sent, setSent] = useState(false);
  // Clicar num borough do quadro leva pro formulário JÁ preenchido — o quadro
  // trabalha, não decora (Luis: "esse botão on call com cara de ai").
  const [boro, setBoro] = useState("");
  const [still, setStill] = useState(false);
  const [clock, setClock] = useState(nyTime);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(m.matches);
    const on = (e) => setStill(e.matches);
    m.addEventListener?.("change", on);

    const tick = setInterval(() => setClock(nyTime()), 20000);

    const links = [
      Object.assign(document.createElement("link"), { rel: "preconnect", href: "https://fonts.googleapis.com" }),
      Object.assign(document.createElement("link"), { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }),
      Object.assign(document.createElement("link"), {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
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
      clearTimeout(failOpen); clearInterval(tick); io?.disconnect();
      m.removeEventListener?.("change", on);
      links.forEach((l) => l.remove());
    };
  }, []);

  // Um único selo VIVO no site inteiro: diz a hora de NY agora, não repete
  // "on call" cinco vezes como enfeite. (Luis: "esse botão on call com cara de ai".)
  const DeskOpen = ({ dark }) => (
    <span className={`np-pill np-lab ${dark ? "np-pill-d" : ""}`} style={dark ? undefined : { background: "rgba(57,217,138,.1)", borderColor: "rgba(20,140,90,.28)", color: "#13603f" }}>
      <span className="np-live" /> Desk open
      <span className="mono ml-1.5" style={{ fontSize: 10.5, letterSpacing: ".06em", opacity: .85 }}>{clock} NYC</span>
    </span>
  );

  return (
    <div className="np" ref={root}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── HEADER — pill nav, pill CTA ───────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md">
        <div className="np-w flex items-center justify-between gap-4 h-[78px]">
          <a href="#top" className="flex items-center shrink-0">
            <img src={`${A}logo-hi.webp`} alt="Nonstop Plumbers NY" className="h-11 w-auto" width="220" height="44" />
          </a>
          <nav className="hidden lg:flex items-center gap-1.5 np-lab">
            {[["#services", "Services"], ["#crew", "Who shows up"], ["#plans", "Service plans"], ["#contact", "Contact"]].map(([h, t]) => (
              <a key={h} href={h} className="np-pill hover:border-[color:var(--cyan)] transition-colors"
                style={{ color: "var(--mut)", background: "var(--paper)" }}>{t}</a>
            ))}
          </nav>
          <a href={TEL} className="np-btn !py-3.5 !px-5 text-sm">
            <Ic d={I.phone} s={18} />
            <span className="hidden sm:inline">{PHONE}</span>
            <span className="sm:hidden">Call 24/7</span>
          </a>
        </div>
        <div className="np-stripe" />
      </header>

      {/* ── HERO — THEIR video + dispatch pill + live NYC clock ── */}
      <section id="top" className="relative isolate np-dark np-grain overflow-hidden">
        <div className="absolute inset-0 z-0">
          {still ? (
            <img src={`${A}hero-poster.webp`} alt="Nonstop Plumbers technicians on a New York job site"
              className="w-full h-full object-cover" />
          ) : (
            <video className="w-full h-full object-cover" style={{ filter: "contrast(1.07) saturate(1.06) brightness(1.05)" }} autoPlay muted loop playsInline preload="metadata"
              poster={`${A}hero-poster.webp`} aria-hidden="true">
              <source src={`${A}hero-web.mp4`} type="video/mp4" />
            </video>
          )}
        </div>
        <div className="absolute inset-0 z-[1]" style={{
          background:
            "linear-gradient(180deg,rgba(6,14,25,.84) 0%,rgba(6,14,25,.55) 34%,rgba(6,14,25,.74) 74%,rgba(6,14,25,.96) 100%)," +
            "linear-gradient(90deg,rgba(6,14,25,.82) 0%,rgba(6,14,25,.26) 62%,rgba(6,14,25,.10) 100%)",
        }} />
        <div className="relative z-10 np-w pt-10 pb-14 sm:pt-14 sm:pb-18 lg:pt-16 lg:pb-20">
          {/* announcement pill — real, dated, live */}
          <div className="np-rev flex flex-wrap items-center gap-2.5">
            <span className="np-pill np-lab" style={{ background: "var(--red)", borderColor: "transparent", color: "#fff" }}>
              Dispatch desk
            </span>
            <span className="np-pill np-pill-d np-lab">
              <span className="np-live" />
              Open right now — <span className="mono ml-1" style={{ color: "var(--cyan)", letterSpacing: ".06em" }}>{clock}</span>
              <span className="ml-1">in NYC</span>
            </span>
          </div>

          <div className="max-w-3xl">
            <h1 className="np-rev np-in-d1 mt-7 text-white text-[42px] sm:text-[56px] lg:text-[72px]">
              When it can&rsquo;t wait,<br />we don&rsquo;t <span style={{ color: "var(--red)" }}>stop.</span>
            </h1>
            <p className="np-rev np-in-d2 mt-5 text-[16px] sm:text-[17px] leading-relaxed max-w-xl" style={{ color: "#cdd8e6" }}>
              Emergency plumbing, drain &amp; sewer, fire suppression and NYC compliance —
              Master Plumber and Master Fire Suppression licensed, fully insured, across
              Manhattan, Brooklyn, Queens, the Bronx and Staten Island. 24/7/365.
            </p>

            <div className="np-rev np-in-d3 mt-8">
              <div className="np-lab mb-4 max-w-md leading-relaxed" style={{ color: "#9fb2c8" }}>
                Emergency dispatch — answered 24/7 by AI, dispatched in minutes
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href={TEL} className="np-btn dsp text-2xl sm:text-[28px] !py-5 !px-8">
                  <Ic d={I.phone} s={26} /> {PHONE}
                </a>
                <a href="#services" className="np-btn-o">
                  See what we dispatch <Ic d={I.arrow} s={18} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CREDENTIAL STATUS PILLS BAND ─────────────────────── */}
      <section style={{ background: "var(--navy)" }}>
        <div className="np-w py-6 flex flex-wrap items-center justify-center gap-2.5">
          <DeskOpen dark />
          {CREDS.map((c) => (
            <span key={c.t} className="np-pill np-pill-d np-lab">
              <span style={{ color: "var(--cyan)" }}><Ic d={c.ic} s={16} /></span>{c.t}
            </span>
          ))}
        </div>
      </section>

      {/* ── SERVICES — dispatch tickets ──────────────────────── */}
      <section id="services" style={{ background: "var(--paper)", "--stage": "var(--paper)" }} className="py-20 sm:py-28">
        <div className="np-w">
          <div className="np-rev max-w-2xl">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--red)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              The board
            </div>
            <h2 className="mt-5 text-4xl sm:text-5xl">Every ticket we take.</h2>
            <p className="mt-4 text-[17px] leading-relaxed" style={{ color: "var(--mut)" }}>
              One licensed crew for the emergency at 3 AM and the compliance inspection on the calendar.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <article key={s.t} className={`np-tk np-rev ${["", "np-in-d1", "np-in-d2", "np-in-d3"][i % 4]} flex flex-col`}>
                <div className="np-tk-head px-5 py-3 flex items-center justify-between gap-2">
                  <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>{s.wo}</span>
                  <span className="np-lab text-[10px] px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(217,42,40,.09)", color: "var(--red)" }}>{s.tag}</span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-full"
                    style={{ background: "var(--navy)", color: "var(--cyan)" }}><Ic d={s.ic} s={21} /></span>
                  <h3 className="mt-5 text-[21px]" style={{ color: "var(--navy)" }}>{s.t}</h3>
                  <div className="np-notch np-notch-l" style={{ top: "calc(50% + 18px)" }} />
                  <div className="np-notch np-notch-r" style={{ top: "calc(50% + 18px)" }} />
                  <ul className="np-perf mt-5 pt-5 space-y-2 text-[14px] leading-relaxed" style={{ color: "var(--mut)" }}>
                    {s.d.map((x) => (
                      <li key={x} className="flex gap-2.5">
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--red)" }} />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO SHOWS UP — crew photo + borough dispatch board ── */}
      <section id="crew" className="relative np-dark np-grain py-20 sm:py-28" style={{ "--stage": "#0d1a2b" }}>
        <div className="np-w relative z-[3] grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div className="np-rev">
            <div className="np-frame" style={{ borderColor: "rgba(255,255,255,.14)" }}>
              <img src={`${A}crew-hi.webp`} alt="Nonstop Plumbers crew and branded van on a Brooklyn street"
                className="w-full h-full object-cover" loading="lazy" />
            </div>
          </div>

          <div className="np-rev np-in-d1">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--cyan)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Who shows up
            </div>
            <h2 className="mt-5 text-4xl sm:text-[46px] text-white">
              A licensed crew and a marked van.
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed" style={{ color: "#bccadb" }}>
              The call is answered 24/7 and dispatched in minutes — then real people arrive:
              Master Plumber and Master Fire Suppression licensed, fully insured, working in
              New York buildings every day of the year.
            </p>

            {/* the borough dispatch board */}
            <div className="np-tk mt-9" style={{ background: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.16)" }}>
              <div className="px-5 py-3 flex items-center justify-between gap-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,.14)" }}>
                <span className="np-lab flex items-center gap-2" style={{ color: "#9fb2c8" }}>
                  <span className="np-live" /> Dispatch desk open
                </span>
                <span className="mono text-[11px]" style={{ color: "var(--cyan)", letterSpacing: ".08em" }}>NYC {clock}</span>
              </div>
              <div className="p-2 sm:p-3">
                {BOROUGHS.map((b) => (
                  <a key={b.b} href="#contact" onClick={() => setBoro(b.b)}
                    className="np-boro group flex items-center gap-3 rounded-full px-3 sm:px-4 py-3 transition">
                    <span className="np-led shrink-0" aria-hidden="true" />
                    <span className="mono text-[11px] px-2 py-1 rounded-full shrink-0"
                      style={{ background: "rgba(23,198,255,.12)", color: "var(--cyan)" }}>{b.c}</span>
                    <span className="min-w-0 flex-1 text-white font-semibold text-[15px] leading-tight truncate">{b.b}</span>
                    <span className="np-boro-go shrink-0 flex items-center gap-1.5 np-lab" style={{ color: "var(--cyan)", fontSize: 10 }}>
                      Start a ticket <Ic d={I.arrow} s={14} />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICE PLANS — two tickets + boiler photo ───────── */}
      <section id="plans" className="py-20 sm:py-28" style={{ background: "#fff", "--stage": "#fff" }}>
        <div className="np-w">
          <div className="np-rev max-w-2xl">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--red)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Standing orders
            </div>
            <h2 className="mt-5 text-4xl sm:text-5xl">Before it becomes an emergency.</h2>
            <p className="mt-4 text-[17px] leading-relaxed" style={{ color: "var(--mut)" }}>
              Two ways to keep us on your building&rsquo;s board all year — for property managers and for homes.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr_.86fr] items-stretch">
            {PLANS.map((p, i) => (
              <article key={p.t} className={`np-tk np-rev ${i ? "np-in-d1" : ""} flex flex-col`}>
                <div className="np-tk-head px-6 py-3.5 flex items-center justify-between gap-2">
                  <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>{p.wo}</span>
                  <span className="np-lab" style={{ color: "var(--red)", fontSize: 10 }}>Standing order</span>
                </div>
                <div className="p-7 flex-1 flex flex-col">
                  <h3 className="text-[25px]" style={{ color: "var(--navy)" }}>{p.t}</h3>
                  <p className="mt-2 text-[14px]" style={{ color: "var(--mut)" }}>{p.s}</p>
                  <div className="np-notch np-notch-l" style={{ top: "calc(50% + 26px)" }} />
                  <div className="np-notch np-notch-r" style={{ top: "calc(50% + 26px)" }} />
                  <ul className="np-perf mt-6 pt-6 space-y-3 text-[15px] leading-relaxed" style={{ color: "var(--mut)" }}>
                    {p.d.map((x) => (
                      <li key={x} className="flex gap-3">
                        <span className="mt-[8px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--red)" }} />
                        {x}
                      </li>
                    ))}
                  </ul>
                  <a href="#contact" className="np-btn mt-7 w-full !py-4">
                    Request plan details <Ic d={I.arrow} s={18} />
                  </a>
                </div>
              </article>
            ))}
            <div className="np-rev np-in-d2 np-frame min-h-[260px] lg:min-h-0">
              <img src={`${A}boiler-hi.webp`} alt="Nonstop Plumbers technician working in a boiler room"
                className="w-full h-full object-cover" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT — dispatch line + work-order ticket form ──── */}
      <section id="contact" className="py-20 sm:py-28" style={{ background: "var(--paper)", "--stage": "var(--paper)" }}>
        <div className="np-w grid gap-8 lg:grid-cols-[.95fr_1.05fr] lg:items-start">
          <div className="np-rev">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--red)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Dispatch
            </div>
            <h2 className="mt-5 text-4xl sm:text-5xl">One number, any hour.</h2>
            <p className="mt-4 text-[17px] leading-relaxed" style={{ color: "var(--mut)" }}>
              Water where it shouldn&rsquo;t be, no heat, a violation to clear, a sprinkler inspection due —
              the same line takes all of it.
            </p>

            <div className="np-tk mt-8" style={{ background: "var(--navy)", borderColor: "rgba(255,255,255,.14)" }}>
              <div className="np-stripe" />
              <div className="p-7">
                <div className="np-lab" style={{ color: "#9fb2c8" }}>Emergency dispatch — answered 24/7 by AI, dispatched in minutes</div>
                <a href={TEL} className="dsp mt-4 block text-[40px] sm:text-[52px] leading-none" style={{ color: "#fff" }}>{PHONE}</a>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <DeskOpen dark />
                  <span className="np-pill np-pill-d np-lab"><Ic d={I.clock} s={15} />24/7/365</span>
                  <span className="np-pill np-pill-d np-lab"><Ic d={I.pin} s={15} />All five boroughs</span>
                </div>
                <a href={TEL} className="np-btn mt-7 w-full"><Ic d={I.phone} s={20} /> Call the dispatch desk</a>
              </div>
            </div>
          </div>

          <div className="np-rev np-in-d1">
            <form className="np-tk" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <div className="np-tk-head px-6 py-3.5 flex items-center justify-between gap-2">
                <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>WO-NEW</span>
                <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>NYC {clock}</span>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-[25px]" style={{ color: "var(--navy)" }}>Open a work order</h3>
                <p className="mt-2 text-[14px]" style={{ color: "var(--mut)" }}>
                  Not an emergency? Send the details and we&rsquo;ll come back with a time.
                </p>
                <div className="np-notch np-notch-l" style={{ top: 158 }} />
                <div className="np-notch np-notch-r" style={{ top: 158 }} />
                <div className="np-perf mt-6 pt-6 grid gap-3">
                  <input className="np-field" placeholder="Full name" aria-label="Full name" required />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input className="np-field" placeholder="Phone" aria-label="Phone" type="tel" required />
                    <input className="np-field" placeholder="Email" aria-label="Email" type="email" />
                  </div>
                  <input className="np-field" placeholder="Address or borough" aria-label="Address or borough" value={boro} onChange={(e) => setBoro(e.target.value)} />
                  <select className="np-field" aria-label="Service needed" defaultValue="">
                    <option value="" disabled>Service needed</option>
                    {SERVICES.map((s) => <option key={s.t}>{s.t}</option>)}
                  </select>
                  <textarea className="np-field" rows="3" placeholder="What's going on?" aria-label="What's going on?" />
                </div>
                <button type="submit" className="np-btn w-full mt-5">Send the work order</button>
                {sent && (
                  <p className="mt-4 text-[13px] leading-relaxed px-4 py-3 rounded-2xl" role="status"
                    style={{ background: "rgba(23,198,255,.09)", border: "1px solid rgba(23,198,255,.35)", color: "var(--navy)" }}>
                    This is a demonstration rebuild — the form is not connected. For real service, call {PHONE}.
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-white">
        <div className="np-stripe" />
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
              {BOROUGHS.map((b) => <li key={b.b}>{b.b}</li>)}
            </ul>
          </div>
          <div>
            <div className="np-lab" style={{ color: "var(--navy)" }}>Emergency dispatch</div>
            <a href={TEL} className="dsp mt-4 block text-3xl" style={{ color: "var(--red)" }}>{PHONE}</a>
            <p className="mt-3 text-[13px]" style={{ color: "var(--mut)" }}>Answered every hour of every day — including holidays.</p>
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
