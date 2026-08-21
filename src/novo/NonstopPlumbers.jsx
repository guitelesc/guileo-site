// NONSTOP PLUMBERS NY — demonstration rebuild v3 (website-porta engine, Guileo)
// CONCEPT: THE DISPATCH BOARD — work-order tickets, a response clock, borough status board,
// a red emergency stripe as structure. Everything fully rounded (pills + 28-32px cards).
// Their own assets: /novo/nonstop/{hero-web.mp4,hero-poster.webp,logo-hi.webp,crew-hi.webp,boiler-hi.webp}
// Their own palette: red #d92a28 · cyan #17c6ff · navy #0c1a2e · paper #f5f7fa.
// Real content only — nonstopplumbers.com. Every fact, price, FAQ answer, address and
// borough line below is carried over from their own pages. No invented stats.
import { useEffect, useRef, useState } from "react";

const PHONE = "(212) 567-2000";
const TEL = "tel:+12125672000";
const PHONE_OFFICE = "(646) 992-9210";
const TEL_OFFICE = "tel:+16469929210";
const IG = "https://www.instagram.com/plumbingnewyork/";
const FB = "https://www.facebook.com/profile.php?id=100091333871352";
const SITE = "https://www.guileoai.com/novo/nonstop-plumbers";
const A = "/novo/nonstop/";
const SITE_ORIGIN = "https://www.guileoai.com";

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
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  hard: <path d="M4 16.5h16M6.5 16V11a5.5 5.5 0 0 1 11 0v5M10 6.2V4.6A1.1 1.1 0 0 1 11.1 3.5h1.8A1.1 1.1 0 0 1 14 4.6v1.6M4 16.5v1.4A1.1 1.1 0 0 0 5.1 19h13.8a1.1 1.1 0 0 0 1.1-1.1v-1.4" />,
  star: <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.6z" />,
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
  { b: "Manhattan", c: "MN", d: "Leaks, drain backups, gas piping compliance and high-rise service from Harlem to the Financial District." },
  { b: "Brooklyn", c: "BK", d: "Brownstones, multifamily buildings, drain backups, remodel plumbing and emergency leak response." },
  { b: "Queens", c: "QN", d: "Water heaters, water service problems, drain work, backflow compliance and emergency response." },
  { b: "Bronx", c: "BX", d: "Multifamily emergencies, drain and sewer issues, code corrections and plumbing compliance support." },
  { b: "Staten Island", c: "SI", d: "Water-main work, gas piping, fixture upgrades, drain issues and emergency plumbing support." },
];
const PLANS = [
  { wo: "WO-BSP", t: "Building Service Plans", s: "For managed buildings & commercial properties",
    from: "From $1,199 / month",
    d: ["Monthly house trap cleaning, pressure jetting, pipe inspection and valve exercising",
        "Local Law 152, FDNY and DEP inspections, backflow and standpipe support on Tier 2 and 3",
        "24/7 priority with no after-hours surcharge, and 10–20% off additional services",
        "Tier 1 $1,199 · Tier 2 $2,299 (most popular) · Tier 3 VIP $3,499 — 36-month agreement gets 2 months free"] },
  { wo: "WO-HPM", t: "Home Plumbing Memberships", s: "For homeowners and apartments",
    from: "From $99 / year",
    d: ["10–20% off all services, VIP priority scheduling and $0 dispatch fees",
        "Silver Care $99/yr — everyday savings and priority scheduling",
        "Gold Plus $399/yr — one complimentary visit, assessment and labor-only service every year",
        "Diamond Elite $799/yr — whole-home visit and two complimentary labor-only services a year"] },
];

const OFFICES = [
  { c: "Astoria", a1: "14-31 Astoria Blvd", loc: "Astoria", zip: "11102", ph: PHONE, tel: TEL, lab: "24-hour emergency service" },
  { c: "Brooklyn", a1: "555 Macon St Suite 1", loc: "Brooklyn", zip: "11233", ph: PHONE, tel: TEL, lab: "24-hour emergency service" },
  { c: "Manhattan", a1: "30 Wall St 8th Floor", loc: "New York", zip: "10005", ph: PHONE_OFFICE, tel: TEL_OFFICE, lab: "Office line" },
].map((o) => ({ ...o, n: `Nonstop Plumbers CORP — ${o.c}`, a2: `${o.loc}, NY ${o.zip}` }));

const STANDARDS = [
  ["State-of-the-art equipment", "The right tools for the job, so plumbing problems are solved cleanly and accurately."],
  ["Prompt appointments in a busy city", "Modern scheduling and responsive dispatch, because your time counts too."],
  ["Customers who come back", "Straightforward, fair and professional from the first call to the final walkthrough."],
  ["Clean finish, not just finished", "The site is left in order — the mess doesn't stay behind for the customer."],
];

const FAQ = [
  { q: "How quickly can you send a plumber in NYC?",
    a: "For active leaks, drain backups, no-water conditions or any urgent problem, the fastest path is to call dispatch. The team routes the nearest qualified crew based on borough, building access and the actual severity. Arrival depends on traffic, access restrictions and current emergency volume — the goal is always to stabilize the property first, explain the condition clearly, then move into the right repair scope." },
  { q: "Should I call or use the contact form for an emergency?",
    a: "Call for anything active or time-sensitive: leaking water, sewer backup, no hot water in a building, gas concerns, or a shutdown already affecting occupants. Dispatch can triage immediately and tell you what to do before a technician arrives. Use the form for estimates, planned work and follow-ups — it is good for organized scope intake, but it is not the path for a live emergency." },
  { q: "What should I do before the plumber arrives for a leak or backup?",
    a: "If it is safe, shut off the local fixture or the nearest water source, stop using the affected drains and move valuables away. In multifamily or commercial buildings, notify building staff right away so access and shutdown decisions happen faster. Note which fixtures are affected and whether the problem is isolated or building-wide — that narrows the likely cause before anyone arrives." },
  { q: "What causes recurring drain backups in apartment buildings or brownstones?",
    a: "Recurring backups usually point to a deeper line condition, not a one-time surface clog: grease buildup, scale, partial collapses, root intrusion, poor pitch, or a branch line that was only opened temporarily instead of properly cleaned. In older NYC buildings, stacked systems and limited access hide where the real restriction starts, so repeat backups need a full diagnosis rather than another pass with a cable." },
  { q: "Why did my apartment or building lose hot water?",
    a: "A hot-water outage can come from the heater itself, boiler controls, recirculation problems, gas supply, electrical failures, or a larger building-system condition — and it looks different depending on whether one line, one riser or the whole property is affected. The first step is confirming whether the loss is local or building-wide and whether there is any safety concern, then diagnosis, safe restoration and any follow-up work." },
  { q: "Can you coordinate with supers, property managers and building staff?",
    a: "Yes. A large part of NYC plumbing work is coordinating around live buildings, occupied units, elevator rules, cellar access, freight windows, shutdown timing and management approval. Access needs get identified early and authority on site confirmed up front, which keeps the job moving and cuts repeat visits caused by preventable access problems." },
  { q: "Do plumbing repairs or replacements in NYC require permits?",
    a: "Some work is handled as repair or maintenance; other scopes need permits, filings, inspections or licensed sign-off. It depends on what is being changed, whether gas or water service is affected, and which agency has jurisdiction. The safest assumption is not to guess — the job is evaluated on actual site conditions and mapped to the correct code and filing path first." },
  { q: "Can you help with DOB, DEP, FDNY, gas and backflow-related scopes?",
    a: "Yes. Compliance work often overlaps gas piping, sprinkler coordination, backflow requirements, water-service issues or agency-driven corrections, where paperwork, testing and sequence matter as much as the repair. Work is handled under NYC Master Plumber License #1332, with Master Fire Suppression License #543B when the scope touches sprinkler or standpipe systems." },
  { q: "Do you provide estimates for non-emergency plumbing work?",
    a: "Yes. Fixture replacement, remodeling, water heater changes, piping upgrades, compliance corrections and building-wide improvements can all be scoped through an estimate or a site visit. The more accurate the access details and project information you send, the more useful that estimate is — and the fewer surprises later." },
  { q: "Do you service all five boroughs?",
    a: "Yes — Manhattan, Brooklyn, Queens, the Bronx and Staten Island, for emergency response, drain and sewer work, hot-water issues, compliance-driven plumbing, repairs and planned projects. Coverage is citywide, but scheduling and scope still vary by borough because access, traffic, building density and agency coordination are not the same everywhere." },
];

const ROLES = ["Licensed plumbers", "Drain and sewer technicians", "Helpers and apprentices",
  "Dispatch and customer coordination", "Project and compliance support"];

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
/* FAQ — native details/summary dressed as a rounded ticket row */
.np-q{list-style:none;cursor:pointer;display:flex;align-items:flex-start;gap:16px;padding:20px 22px}
.np-q::-webkit-details-marker{display:none}
.np-q:focus-visible{outline:2px solid var(--cyan);outline-offset:-3px;border-radius:24px}
.np-qi{flex:none;width:32px;height:32px;border-radius:999px;display:grid;place-items:center;
 background:rgba(217,42,40,.09);color:var(--red);transition:transform .3s cubic-bezier(.2,.7,.3,1),background .25s}
.np-fq[open] .np-qi{transform:rotate(45deg);background:var(--red);color:#fff}
.np-fq{transition:border-color .3s,box-shadow .3s}
.np-fq[open]{border-color:rgba(217,42,40,.28)}
.np-fq:hover{border-color:rgba(12,26,46,.2)}
.np-faqs{display:grid;gap:14px}
@media(min-width:1024px){.np-faqs{display:block;columns:2;column-gap:14px}
 .np-faqs>details{break-inside:avoid;margin-bottom:14px}}

/* sticky mobile call bar — sits UNDER the floating AI widget (z-40) */
.np-callbar{position:fixed;left:0;right:0;bottom:0;z-index:30;pointer-events:none;
 padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));
 background:linear-gradient(180deg,rgba(245,247,250,0),rgba(245,247,250,.94) 42%);backdrop-filter:blur(10px);
 transform:translateY(130%);transition:transform .38s cubic-bezier(.2,.7,.3,1)}
.np-callbar.np-show{transform:none;pointer-events:auto}

.np-err{border-color:rgba(217,42,40,.55)!important;box-shadow:0 0 0 3px rgba(217,42,40,.13)!important}
@media(prefers-reduced-motion:reduce){.np-rev{opacity:1;transform:none;transition:none}
 .np-tk,.np-btn,.np-live,.np-callbar,.np-qi{transition:none;animation:none}}
`;

/* ── ONLINE PRESENCE: head tags + structured data, all cleaned up on unmount ── */
const META = [
  ["name", "description", "24/7 emergency plumbing in NYC since 1992 — drain & sewer, water main, fire suppression and Local Law 152 compliance across Manhattan, Brooklyn, Queens, the Bronx and Staten Island. Master Plumber licensed, fully insured. Dispatch (212) 567-2000."],
  ["name", "robots", "index,follow,max-image-preview:large"],
  ["property", "og:type", "website"],
  ["property", "og:site_name", "Nonstop Plumbers NY"],
  ["property", "og:title", "Nonstop Plumbers NY — 24/7 Emergency Plumbing Across NYC"],
  ["property", "og:description", "Licensed 24/7/365 emergency plumbing, drain & sewer, fire suppression and NYC compliance in all five boroughs. Dispatch (212) 567-2000."],
  ["property", "og:image", SITE_ORIGIN + A + "hero-poster.webp"],
  ["property", "og:url", SITE],
  ["name", "twitter:card", "summary_large_image"],
  ["name", "twitter:title", "Nonstop Plumbers NY — 24/7 Emergency Plumbing Across NYC"],
  ["name", "twitter:image", SITE_ORIGIN + A + "hero-poster.webp"],
  ["name", "twitter:description", "Emergency plumbing, drain & sewer, fire suppression and NYC compliance. Five boroughs, 24/7/365."],
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = [{ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS, opens: "00:00", closes: "23:59" }];
const addr = (street, loc, zip) => ({
  "@type": "PostalAddress", streetAddress: street, addressLocality: loc,
  addressRegion: "NY", postalCode: zip, addressCountry: "US",
});

const LD = () => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Plumber", "LocalBusiness"],
      "@id": SITE + "#business",
      name: "Nonstop Plumbers NY",
      legalName: "Nonstop Plumbers CORP",
      description: "Licensed 24/7 emergency plumbing, drain and sewer, water main, fire suppression and NYC compliance service across the five boroughs since 1992.",
      url: SITE,
      telephone: "+1-212-567-2000",
      foundingDate: "1992",
      image: SITE_ORIGIN + A + "hero-poster.webp",
      logo: SITE_ORIGIN + A + "logo-hi.webp",
      address: addr("30 Wall St 8th Floor", "New York", "10005"),
      areaServed: ["Manhattan", "Brooklyn", "Queens", "The Bronx", "Staten Island"].map((n) => ({
        "@type": "AdministrativeArea", name: n,
      })),
      openingHoursSpecification: HOURS,
      sameAs: [IG, FB],
      department: OFFICES.map((o) => ({
        "@type": ["Plumber", "LocalBusiness"],
        name: o.n,
        telephone: "+1-" + o.ph.replace(/[^0-9]/g, "").replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3"),
        address: addr(o.a1, o.loc, o.zip),
        openingHoursSpecification: HOURS,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": SITE + "#faq",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question", name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      "@id": SITE + "#breadcrumb",
      itemListElement: [["Home", ""], ["Services", "#services"], ["FAQ", "#faq"]].map(([n, h], i) => ({
        "@type": "ListItem", position: i + 1, name: n, item: SITE + h,
      })),
    },
  ],
});

export default function NonstopPlumbers() {
  const root = useRef(null);
  const [sent, setSent] = useState(false);
  // Clicar num borough do quadro leva pro formulário JÁ preenchido — o quadro
  // trabalha, não decora (Luis: "esse botão on call com cara de ai").
  const [boro, setBoro] = useState("");
  const [still, setStill] = useState(false);
  const [clock, setClock] = useState(nyTime);
  const [bar, setBar] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(m.matches);
    const on = (e) => setStill(e.matches);
    m.addEventListener?.("change", on);

    const tick = setInterval(() => setClock(nyTime()), 20000);

    const onScroll = () => setBar(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── ONLINE PRESENCE: title, meta, canonical, JSON-LD (all removed on unmount) ──
    const prevTitle = document.title;
    document.title = "Nonstop Plumbers NY — 24/7 Emergency Plumbing, Drain & Sewer Across NYC";
    // O site tem SEO global no index.html: SOBRESCREVE a tag existente e devolve
    // o valor original ao desmontar — senão a página fica com duas descrições.
    const seo = [], restore = [];
    META.forEach(([k, v, c]) => {
      const found = document.head.querySelector(`meta[${k}="${v}"]`);
      if (found) { restore.push([found, found.getAttribute("content")]); found.setAttribute("content", c); return; }
      const el = document.createElement("meta");
      el.setAttribute(k, v); el.setAttribute("content", c); el.setAttribute("data-np-seo", "1");
      document.head.appendChild(el); seo.push(el);
    });
    const oldCanon = document.head.querySelector("link[rel=canonical]");
    if (oldCanon) { restore.push([oldCanon, oldCanon.getAttribute("href"), "href"]); oldCanon.setAttribute("href", SITE); }
    else {
      const canon = document.createElement("link");
      canon.rel = "canonical"; canon.href = SITE;
      document.head.appendChild(canon); seo.push(canon);
    }
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify(LD());
    document.head.appendChild(ld); seo.push(ld);

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
      window.removeEventListener("scroll", onScroll);
      document.title = prevTitle;
      seo.forEach((el) => el.remove());
      restore.forEach(([el, val, at = "content"]) => (val === null ? el.removeAttribute(at) : el.setAttribute(at, val)));
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
            {[["#services", "Services"], ["#crew", "Boroughs"], ["#plans", "Service plans"], ["#about", "About"], ["#faq", "FAQ"], ["#contact", "Contact"]].map(([h, t]) => (
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
              className="w-full h-full object-cover" width="1920" height="1080" decoding="async" />
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
                className="w-full h-full object-cover" width="1200" height="800" loading="lazy" decoding="async" />
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
                    className="np-boro group flex items-start gap-3 rounded-[26px] px-3 sm:px-4 py-3 transition">
                    <span className="np-led shrink-0 mt-[3px]" aria-hidden="true" />
                    <span className="mono text-[11px] px-2 py-1 rounded-full shrink-0"
                      style={{ background: "rgba(23,198,255,.12)", color: "var(--cyan)" }}>{b.c}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-white font-semibold text-[15px] leading-tight">{b.b}</span>
                        <span className="np-boro-go shrink-0 flex items-center gap-1.5 np-lab" style={{ color: "var(--cyan)", fontSize: 10 }}>
                          Start a ticket <Ic d={I.arrow} s={14} />
                        </span>
                      </span>
                      <span className="block mt-1 text-[13px] leading-snug" style={{ color: "#9fb2c8" }}>{b.d}</span>
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
                  <span className="np-pill np-lab mt-4 self-start"
                    style={{ background: "rgba(217,42,40,.08)", borderColor: "rgba(217,42,40,.22)", color: "var(--red)" }}>
                    {p.from}
                  </span>
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
                className="w-full h-full object-cover" width="900" height="1200" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT — their real story + the three real offices ─── */}
      <section id="about" aria-labelledby="about-h" className="py-20 sm:py-28"
        style={{ background: "var(--paper)", "--stage": "var(--paper)" }}>
        <div className="np-w">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
            <div className="np-rev max-w-2xl">
              <div className="np-lab flex items-center gap-3" style={{ color: "var(--red)" }}>
                <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
                Since 1992
              </div>
              <h2 id="about-h" className="mt-5 text-4xl sm:text-5xl">
                The crews NYC buildings trust when the work has to be done right.
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed" style={{ color: "var(--mut)" }}>
                New York&rsquo;s premier residential and commercial buildings, institutions and private schools
                rely on Nonstop Plumbers CORP for a reason: since 1992 the reputation has been built on
                high-quality, fairly priced service and impeccable attention to detail.
              </p>
              <p className="mt-4 text-[17px] leading-relaxed" style={{ color: "var(--mut)" }}>
                We believe in doing a job right the first time, and doing it neatly, without excuses. With over
                60 trained professionals and live plumbers answering the phone, customers get immediate access to
                real help — and with locations in Astoria, Brooklyn and Manhattan, we can always be there fast.
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <span className="np-pill np-lab"><Ic d={I.shield} s={15} />NYC Master Plumber License #1332</span>
                <span className="np-pill np-lab"><Ic d={I.flame} s={15} />Master Fire Suppression License #543B</span>
                <span className="np-pill np-lab"><Ic d={I.star} s={15} />30+ years · 60+ professionals</span>
              </div>
            </div>

            <div className="np-rev np-in-d1 np-tk">
              <div className="np-tk-head px-6 py-3.5 flex items-center justify-between gap-2">
                <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>WO-STD</span>
                <span className="np-lab" style={{ color: "var(--red)", fontSize: 10 }}>Our standards</span>
              </div>
              <div className="p-7">
                <h3 className="text-[22px]" style={{ color: "var(--navy)" }}>Exceeding expectations every day</h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--mut)" }}>
                  Use the right equipment, respect the schedule, communicate clearly, and leave every
                  space clean when the job is done.
                </p>
                <div className="np-notch np-notch-l" style={{ top: 150 }} />
                <div className="np-notch np-notch-r" style={{ top: 150 }} />
                <ul className="np-perf mt-6 pt-6 space-y-4">
                  {STANDARDS.map(([t, d]) => (
                    <li key={t} className="flex gap-3.5">
                      <span className="mt-[3px] flex-none inline-flex items-center justify-center w-7 h-7 rounded-full"
                        style={{ background: "rgba(23,198,255,.12)", color: "var(--navy)" }}><Ic d={I.shield} s={15} /></span>
                      <span>
                        <span className="block font-semibold text-[15px]" style={{ color: "var(--navy)" }}>{t}</span>
                        <span className="block mt-1 text-[14px] leading-relaxed" style={{ color: "var(--mut)" }}>{d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* three real offices, one 24-hour response team */}
          <h3 className="np-rev mt-16 text-[26px] sm:text-3xl" style={{ color: "var(--navy)" }}>
            Three NYC offices backing one 24-hour response team.
          </h3>
          <div className="mt-7 grid gap-6 md:grid-cols-3">
            {OFFICES.map((o, i) => (
              <article key={o.c} className={`np-tk np-rev ${["", "np-in-d1", "np-in-d2"][i]} flex flex-col`}>
                <div className="np-tk-head px-6 py-3.5 flex items-center justify-between gap-2">
                  <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>{o.c.toUpperCase()}</span>
                  <span className="np-lab" style={{ color: "var(--red)", fontSize: 10 }}>{o.lab}</span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-full"
                    style={{ background: "var(--navy)", color: "var(--cyan)" }}><Ic d={I.pin} s={20} /></span>
                  <h4 className="mt-5 text-[19px] font-extrabold tracking-tight" style={{ color: "var(--navy)" }}>{o.n}</h4>
                  <address className="mt-2 not-italic text-[15px] leading-relaxed" style={{ color: "var(--mut)" }}>
                    {o.a1}<br />{o.a2}
                  </address>
                  <div className="np-notch np-notch-l" style={{ top: "calc(100% - 92px)" }} />
                  <div className="np-notch np-notch-r" style={{ top: "calc(100% - 92px)" }} />
                  <div className="np-perf mt-6 pt-5 mt-auto">
                    <a href={o.tel} className="np-btn w-full !py-4 text-[17px]">
                      <Ic d={I.phone} s={18} /> {o.ph}
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="np-rev mt-5 text-[13px] leading-relaxed" style={{ color: "var(--mut)" }}>
            {PHONE} is the 24-hour emergency dispatch line. {PHONE_OFFICE} is the Manhattan office line at 30 Wall St.
          </p>
        </div>
      </section>

      {/* ── FAQ — their real questions, accessible accordion ──── */}
      <section id="faq" aria-labelledby="faq-h" className="py-20 sm:py-28" style={{ background: "#fff", "--stage": "#fff" }}>
        <div className="np-w">
          <div className="np-rev max-w-2xl">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--red)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Before you call
            </div>
            <h2 id="faq-h" className="mt-5 text-4xl sm:text-5xl">Plumbing questions from NYC owners and managers.</h2>
            <p className="mt-4 text-[17px] leading-relaxed" style={{ color: "var(--mut)" }}>
              Direct answers about emergency response, drain and sewer issues, permits, compliance work
              and what to expect before a licensed NYC plumber arrives.
            </p>
          </div>

          <div className="np-faqs mt-11">
            {FAQ.map((f, i) => (
              <details key={f.q} className={`np-tk np-fq np-rev ${["", "np-in-d1", "np-in-d2", "np-in-d3"][i % 4]}`}>
                <summary className="np-q">
                  <span className="np-qi" aria-hidden="true"><Ic d={I.plus} s={16} /></span>
                  <h3 className="flex-1 text-[16.5px] leading-snug font-extrabold tracking-tight pt-[5px]"
                    style={{ color: "var(--navy)" }}>{f.q}</h3>
                </summary>
                <div className="px-[22px] pb-[22px] pl-[70px]">
                  <p className="np-perf pt-4 text-[14.5px] leading-relaxed" style={{ color: "var(--mut)" }}>{f.a}</p>
                </div>
              </details>
            ))}
          </div>

          <div className="np-rev mt-10 flex flex-col sm:flex-row gap-3 sm:items-center">
            <a href={TEL} className="np-btn"><Ic d={I.phone} s={20} /> Call 24/7 dispatch — {PHONE}</a>
            <span className="text-[14px] leading-relaxed" style={{ color: "var(--mut)" }}>
              Still not sure it&rsquo;s an emergency? Call anyway — dispatch triages it in under a minute.
            </span>
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
            <form className="np-tk" noValidate onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim() || !form.phone.trim()) {
                setSent(false);
                setErr("We need a name and a phone number to call you back — everything else is optional.");
                return;
              }
              setErr(""); setSent(true);
            }}>
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
                  <input className={`np-field ${err && !form.name.trim() ? "np-err" : ""}`} placeholder="Full name *"
                    aria-label="Full name" aria-required="true" aria-invalid={!!err && !form.name.trim()}
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input className={`np-field ${err && !form.phone.trim() ? "np-err" : ""}`} placeholder="Phone *"
                      aria-label="Phone" type="tel" aria-required="true" aria-invalid={!!err && !form.phone.trim()}
                      value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                <p className="mt-4 flex gap-2.5 text-[13px] leading-relaxed" style={{ color: "var(--mut)" }}>
                  <span className="mt-[2px] shrink-0" style={{ color: "var(--red)" }}><Ic d={I.shield} s={15} /></span>
                  What happens next: dispatch triages what you sent, calls you back, and tells you what to do
                  before a technician arrives. Anything active right now — a leak, a backup, no hot water —
                  should go straight to <a href={TEL} className="font-semibold underline whitespace-nowrap"
                    style={{ color: "var(--navy)" }}>{PHONE}</a> instead.
                </p>
                {err && (
                  <p className="mt-4 text-[13px] leading-relaxed px-4 py-3 rounded-2xl" role="alert"
                    style={{ background: "rgba(217,42,40,.08)", border: "1px solid rgba(217,42,40,.35)", color: "var(--navy)" }}>
                    {err}
                  </p>
                )}
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

      {/* ── CAREERS — real: they hire licensed NYC plumbers ───── */}
      <section id="careers" aria-labelledby="careers-h" className="relative np-dark np-grain py-16 sm:py-20"
        style={{ "--stage": "#0d1a2b" }}>
        <div className="np-w relative z-[3] grid gap-9 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div className="np-rev">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--cyan)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Careers
            </div>
            <h2 id="careers-h" className="mt-5 text-3xl sm:text-[42px] text-white">
              We hire licensed NYC plumbers.
            </h2>
            <p className="mt-4 text-[16.5px] leading-relaxed max-w-xl" style={{ color: "#bccadb" }}>
              Licensed plumbers, drain and sewer specialists, helpers, apprentices and operations support
              who want steady work, clear expectations and real NYC field experience. We look for people
              who communicate clearly, respect customers and job sites, and treat timing seriously.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <a href="#contact" className="np-btn"><Ic d={I.hard} s={20} /> Tell us where you fit</a>
              <a href={TEL} className="np-btn-o">Call the office <Ic d={I.arrow} s={18} /></a>
            </div>
          </div>
          <div className="np-rev np-in-d1 np-tk" style={{ background: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.16)" }}>
            <div className="px-6 py-3.5 np-lab" style={{ color: "#9fb2c8", borderBottom: "1px solid rgba(255,255,255,.14)" }}>
              Typical hiring paths
            </div>
            <ul className="p-6 space-y-3 text-[15px]" style={{ color: "#dbe5f0" }}>
              {ROLES.map((r) => (
                <li key={r} className="flex gap-3 items-start">
                  <span className="mt-[8px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--cyan)" }} />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── STICKY MOBILE CALL BAR — z-30, room kept for the AI widget ── */}
      <div className={`np-callbar sm:hidden ${bar ? "np-show" : ""}`}>
        <div className="pr-24">
          <a href={TEL} className="np-btn w-full !py-4 !px-5 text-[16px]" aria-label={`Call Nonstop Plumbers dispatch at ${PHONE}`}>
            <Ic d={I.phone} s={19} /> Call 24/7 dispatch
          </a>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-white">
        <div className="np-stripe" />
        <div className="np-w py-12 grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <img src={`${A}logo-hi.webp`} alt="Nonstop Plumbers NY logo" className="h-12 w-auto" width="240" height="48" loading="lazy" decoding="async" />
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
            <div className="np-lab mt-7" style={{ color: "var(--navy)" }}>Offices</div>
            <ul className="mt-4 space-y-3 text-[14px] leading-relaxed" style={{ color: "var(--mut)" }}>
              {OFFICES.map((o) => <li key={o.c}><strong style={{ color: "var(--navy)" }}>{o.c}</strong><br />{o.a1}, {o.a2}</li>)}
            </ul>
          </div>
          <div>
            <div className="np-lab" style={{ color: "var(--navy)" }}>Emergency dispatch</div>
            <a href={TEL} className="dsp mt-4 block text-3xl" style={{ color: "var(--red)" }}>{PHONE}</a>
            <p className="mt-3 text-[13px]" style={{ color: "var(--mut)" }}>Answered every hour of every day — including holidays.</p>
            <div className="np-lab mt-7" style={{ color: "var(--navy)" }}>Manhattan office</div>
            <a href={TEL_OFFICE} className="mt-2 block text-[15px] font-semibold" style={{ color: "var(--navy)" }}>{PHONE_OFFICE}</a>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <a href={IG} target="_blank" rel="noopener noreferrer" className="np-pill np-lab hover:border-[color:var(--cyan)] transition-colors" style={{ color: "var(--mut)" }}>Instagram</a>
              <a href={FB} target="_blank" rel="noopener noreferrer" className="np-pill np-lab hover:border-[color:var(--cyan)] transition-colors" style={{ color: "var(--mut)" }}>Facebook</a>
            </div>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: "var(--line)" }}>
          <div className="np-w py-5 flex flex-wrap items-center justify-between gap-3 text-[12px]" style={{ color: "var(--mut)" }}>
            <span>© {new Date().getFullYear()} Nonstop Plumbers CORP. All rights reserved. · Serving NYC since 1992.</span>
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
