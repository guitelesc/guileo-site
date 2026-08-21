import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   BELLA FORNO — fictional Brooklyn wood-fired Italian restaurant.
   Demonstration model for the Guileo pitch (website + AI answered line).

   Craft notes (house DNA, transplanted from src/index.css → recolored espresso):
   • Background is never flat: layered radial light pools + film-grain overlay
     (inline SVG fractalNoise, soft-light blend) — same technique as .surface-real.
   • Panels are glass WITH THICKNESS: top reflection sweep + top rim highlight
     + dark bottom inner shade (the inset box-shadow pattern from index.css:71-73).
   • Motion is static-premium: scroll reveals (fail-open), sheen sweep on hover,
     ONE slow breathing glow on the oven light. Nothing floats, nothing twinkles.
   • Zero emoji. Every icon is a drawn inline SVG stroke, 1.5px, round caps.
   ──────────────────────────────────────────────────────────────────────────── */

const MENU = [
  ["Antipasti", [
    ["Burrata al Forno", "wood-oven roasted tomatoes, basil oil, grilled sourdough", 16],
    ["Polpette della Nonna", "beef & pork meatballs, Sunday ragù, pecorino", 14],
    ["Carciofi Croccanti", "crispy artichokes, lemon aioli, mint", 13],
  ]],
  ["Primi", [
    ["Tagliatelle al Tartufo", "hand-cut pasta, black truffle butter, parmigiano", 26],
    ["Rigatoni alla Vodka", "spicy tomato cream, calabrian chili, basil", 21],
  ]],
  ["Pizze", [
    ["Margherita di Bufala", "san marzano, buffalo mozzarella, basil, olio nuovo", 19],
    ["Diavola Brooklyn", "soppressata, hot honey, smoked mozzarella", 22],
    ["Funghi e Fontina", "roasted mushrooms, fontina, thyme, garlic cream", 21],
  ]],
  ["Dolci", [
    ["Tiramisù della Casa", "espresso-soaked savoiardi, mascarpone", 11],
    ["Cannoli Siciliani", "ricotta, candied orange, pistachio crumble", 10],
  ]],
];

const REVIEWS = [
  ["Dana K.", "Called at 9pm on a Friday. Someone answered on the second ring and had us booked before the light changed. The Diavola alone is worth the walk over the bridge."],
  ["Marcus T.", "The tagliatelle al tartufo is the reason I stopped cooking. The room glows like everything is candlelit — because most of it is."],
  ["Sofia R.", "Booked a birthday for eight over the phone in the middle of their dinner rush. No hold music, no call back later. That never happens in this city."],
];

/* Drawn stroke icons — 1.5px, round caps. No emoji anywhere on this page. */
const Ic = ({ d, size = 16, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const PHONE = ["M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"];
const PIN = ["M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"];
const FLAME = ["M12 3c1 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1.5-.8-2.5-.8-2.5S17 10 17 13a5 5 0 0 1-10 0c0-4.5 4-6 5-10z"];
const ARROW = ["M5 12h14", "M13 6l6 6-6 6"];

/* Scroll reveals with the fail-open pattern: if the observer never fires
   (headless render, quirks), a 1.4s timer reveals everything anyway. */
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("bf-in")),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".bf-r").forEach((el) => io.observe(el));
    const t = setTimeout(() => document.querySelectorAll(".bf-r").forEach((el) => el.classList.add("bf-in")), 1400);
    return () => { clearTimeout(t); io.disconnect(); };
  }, []);
}

/* Small-caps label — the typographic system that replaces every chip/badge. */
const Label = ({ children, tone = "text-[#c9a06a]" }) => (
  <span className={`block text-[11px] font-semibold uppercase tracking-[0.28em] ${tone}`}>{children}</span>
);

export default function BellaForno() {
  const [scrolled, setScrolled] = useState(false);
  const [demoNote, setDemoNote] = useState(false);
  useReveal();

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&display=swap";
    document.head.appendChild(l);
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); l.remove(); };
  }, []);

  const demoSubmit = (e) => { e.preventDefault(); setDemoNote(true); };
  const serif = { fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif" };

  return (
    <div className="bf-root relative min-h-screen overflow-x-hidden text-[#efe3cf] antialiased"
      style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <style>{`
        /* ── surface: espresso with layered light pools (never flat) ── */
        .bf-root{
          background-color:#171009;
          background-image:
            radial-gradient(1100px 640px at 78% -8%, rgba(217,165,92,0.055), transparent 60%),
            radial-gradient(900px 560px at 4% 12%, rgba(196,87,58,0.06), transparent 58%),
            radial-gradient(1200px 860px at 50% 110%, rgba(214,120,60,0.09), transparent 60%);
        }
        /* film grain — exact .surface-real technique, soft-light blend */
        .bf-grain{
          position:fixed; inset:0; z-index:40; pointer-events:none; opacity:.5; mix-blend-mode:soft-light;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        /* ── glass with thickness: reflection sweep + rim highlight + bottom shade ── */
        .bf-glass{
          position:relative; overflow:hidden;
          background:rgba(255,248,236,0.028);
          -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px);
          border:1px solid rgba(239,227,207,0.10);
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -1px 0 rgba(0,0,0,0.30), 0 30px 70px -34px rgba(0,0,0,0.85);
        }
        .bf-glass::before{
          content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:1;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.015) 16%, transparent 38%),
            radial-gradient(120% 70% at 82% -12%, rgba(255,236,200,0.06), transparent 55%);
          mix-blend-mode:screen;
        }
        /* slow sheen sweep on hover (cards only) */
        .bf-sheen::after{
          content:""; position:absolute; top:0; left:0; width:55%; height:100%; z-index:2;
          background:linear-gradient(105deg, transparent, rgba(255,244,224,0.06), transparent);
          transform:translateX(-170%) skewX(-12deg); transition:transform .9s ease; pointer-events:none;
        }
        .bf-sheen:hover::after{ transform:translateX(280%) skewX(-12deg); }
        .bf-sheen{ transition:border-color .4s ease, transform .4s ease; }
        .bf-sheen:hover{ border-color:rgba(217,165,92,0.28); transform:translateY(-3px); }
        /* the ONLY ambient motion on the page: the oven light breathes, slowly */
        @keyframes bfBreath{ 0%,100%{opacity:.8; transform:scale(1)} 50%{opacity:1; transform:scale(1.035)} }
        .bf-oven{ animation:bfBreath 7s ease-in-out infinite; transform-origin:50% 100%; }
        @media (prefers-reduced-motion:reduce){ .bf-oven{ animation:none } }
        /* reveals */
        .bf-r{ opacity:0; transform:translateY(22px); transition:opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1); }
        .bf-in{ opacity:1; transform:none }
        /* menu rows */
        .bf-dish{ border-bottom:1px solid rgba(239,227,207,0.07); transition:background .3s ease; }
        .bf-dish:hover{ background:rgba(217,165,92,0.05); }
        .bf-dish:hover .bf-price{ color:#d9a55c; }
        .bf-dots{ flex:1; margin:0 .7rem; transform:translateY(-4px); border-bottom:1px dotted rgba(239,227,207,0.28); }
        .bf-field{ width:100%; background:rgba(23,16,9,0.65); border:1px solid rgba(239,227,207,0.14); border-radius:6px;
          padding:.72rem 1rem; font-size:.875rem; color:#efe3cf; outline:none; transition:border-color .3s; color-scheme:dark; }
        .bf-field:focus{ border-color:rgba(217,165,92,0.6); }
      `}</style>

      <div className="bf-grain" aria-hidden="true" />

      {/* ── NAV — real presence: brand, links, phone as a set piece ── */}
      <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "bg-[#171009]/80 backdrop-blur-xl border-b border-[#efe3cf]/10" : "border-b border-transparent"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-baseline gap-2">
            <span style={serif} className="text-[1.35rem] font-semibold tracking-tight">Bella Forno</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.24em] text-[#efe3cf]/45 sm:block">Cobble Hill</span>
          </a>
          <div className="hidden items-center gap-8 text-[13px] font-medium text-[#efe3cf]/65 md:flex">
            {[["#menu", "Menu"], ["#reserve", "Reserve"], ["#visit", "Hours & Visit"]].map(([h, n]) => (
              <a key={h} href={h} className="transition-colors hover:text-[#d9a55c]">{n}</a>
            ))}
          </div>
          <a href="tel:+17185550134" className="group flex items-center gap-3 border-l border-[#efe3cf]/15 pl-4 text-right sm:pl-6">
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-[#c9a06a]">Answered 24/7</span>
              <span className="block text-sm font-semibold tabular-nums tracking-wide transition-colors group-hover:text-[#d9a55c]">(718) 555-0134</span>
            </div>
            <Ic d={PHONE} size={17} className="text-[#c4573a] transition-colors group-hover:text-[#d9a55c]" />
          </a>
        </div>
      </nav>

      {/* ── HERO — asymmetric 12-col composition ─────────────────────────────
          Left 1–8: oversized Fraunces display overlapping a glass panel, the
          oven rendered as a glowing arch of light INSIDE the composition.
          Right 9–12: tabular info column (hours / address / line) with rules. */}
      <header id="top" className="relative mx-auto grid max-w-6xl grid-cols-12 items-end gap-y-12 px-5 pb-20 pt-32 sm:px-8 md:min-h-[92svh] md:gap-x-8 md:pt-40">
        <div className="relative col-span-12 md:col-span-8">
          {/* the oven: an arch of warm light behind the type — integrated, not floating */}
          <div className="pointer-events-none absolute -left-10 bottom-[-5rem] h-[30rem] w-[36rem] max-w-[110vw]" aria-hidden="true">
            <div className="bf-oven absolute inset-x-0 bottom-0 h-full"
              style={{ background: "radial-gradient(58% 78% at 50% 100%, rgba(224,124,58,0.34) 0%, rgba(196,87,58,0.16) 42%, transparent 72%)" }} />
            <svg viewBox="0 0 560 320" className="absolute bottom-0 left-0 w-full opacity-60">
              <path d="M60 320 Q60 92 280 92 Q500 92 500 320" fill="none" stroke="#c4573a" strokeWidth="2" strokeLinecap="round" />
              <path d="M96 320 Q96 128 280 128 Q464 128 464 320" fill="none" stroke="#d9a55c" strokeWidth="1" strokeLinecap="round" opacity=".55" />
              <line x1="24" y1="320" x2="536" y2="320" stroke="#d9a55c" strokeWidth="1" opacity=".35" />
            </svg>
          </div>

          <div className="bf-r relative">
            <div className="mb-6 flex items-center gap-3">
              <Ic d={FLAME} size={15} className="text-[#c4573a]" />
              <Label>Wood-fired · Brooklyn · Since 2019</Label>
            </div>
            <h1 style={serif} className="relative z-10 text-[clamp(3.4rem,10vw,7.2rem)] font-medium leading-[0.92] tracking-[-0.015em]">
              The oven
              <br />
              never sleeps<span className="text-[#c4573a]">.</span>
            </h1>
            {/* textured glass panel the display type overlaps into */}
            <div className="bf-glass relative z-0 -mt-7 ml-3 max-w-xl rounded-lg p-6 pl-7 sm:-mt-9 sm:ml-14 sm:p-8 sm:pt-11">
              <p style={serif} className="relative z-[2] text-lg font-light italic leading-relaxed text-[#efe3cf]/85 sm:text-xl">
                Neither does our phone. Dough proofed three days, tomatoes from San Marzano,
                and a line that gets answered on the second ring — even at nine on a Friday.
              </p>
              <div className="relative z-[2] mt-7 flex flex-wrap items-center gap-x-8 gap-y-4">
                <a href="tel:+17185550134" className="group inline-flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-[#c4573a]/50 bg-[#c4573a]/15 text-[#e08a5a] transition-colors group-hover:border-[#d9a55c] group-hover:text-[#d9a55c]">
                    <Ic d={PHONE} size={18} />
                  </span>
                  <span>
                    <Label>Call · answered 24/7 — even during the rush</Label>
                    <span className="mt-0.5 block text-lg font-semibold tabular-nums tracking-wide">(718) 555-0134</span>
                  </span>
                </a>
                <a href="#reserve" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d9a55c] transition-colors hover:text-[#efe3cf]">
                  Book a table <Ic d={ARROW} size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* info column — proper tabular block, anchored right */}
        <aside className="bf-r col-span-12 md:col-span-4 md:pb-2">
          <div className="border-t border-[#efe3cf]/20">
            {[
              ["Hours", [["Sun – Thu", "5:00 – 11:00 pm"], ["Fri – Sat", "5:00 pm – 12:00 am"]]],
              ["Find us", [["214 Court Street", ""], ["Cobble Hill, Brooklyn 11201", ""]]],
              ["The line", [["(718) 555-0134", ""], ["Answered around the clock", ""]]],
            ].map(([head, rows]) => (
              <div key={head} className="border-b border-[#efe3cf]/10 py-4">
                <Label tone="text-[#efe3cf]/40">{head}</Label>
                <dl className="mt-2 space-y-1">
                  {rows.map(([a, b]) => (
                    <div key={a} className="flex justify-between text-[13.5px] text-[#efe3cf]/80">
                      <dt>{a}</dt>{b && <dd className="tabular-nums text-[#efe3cf]/60">{b}</dd>}
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </aside>
      </header>

      {/* ── MENU — editorial two-column with dotted leaders ── */}
      <section id="menu" className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="bf-r mb-12 grid grid-cols-12 items-end gap-4 border-b border-[#efe3cf]/15 pb-6">
          <div className="col-span-12 sm:col-span-8">
            <Label>La Cucina</Label>
            <h2 style={serif} className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">The menu</h2>
          </div>
          <p className="col-span-12 text-sm leading-relaxed text-[#efe3cf]/50 sm:col-span-4 sm:text-right">
            Everything below passes through the oven.
            <br className="hidden sm:block" /> The menu turns with the market.
          </p>
        </div>
        <div className="grid gap-x-16 gap-y-12 md:grid-cols-2">
          {MENU.map(([cat, dishes]) => (
            <div key={cat} className="bf-r">
              <div className="mb-3 flex items-center gap-4">
                <Label>{cat}</Label>
                <span className="h-px flex-1 bg-gradient-to-r from-[#d9a55c]/35 to-transparent" />
              </div>
              <ul>
                {dishes.map(([name, desc, price]) => (
                  <li key={name} className="bf-dish -mx-3 px-3 py-3.5">
                    <div className="flex items-baseline">
                      <span style={serif} className="text-[1.06rem] font-medium">{name}</span>
                      <span className="bf-dots" aria-hidden="true" />
                      <span className="bf-price tabular-nums text-[#efe3cf]/75 transition-colors">{price}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#efe3cf]/50">{desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── RESERVE — editorial split: voice on the left, form panel right ── */}
      <section id="reserve" className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="grid grid-cols-12 gap-y-12 md:gap-x-8">
          <div className="bf-r col-span-12 md:col-span-6 md:pr-8">
            <Label>Tonight</Label>
            <h2 style={serif} className="mt-3 text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
              A table by<br />the fire<span className="text-[#c4573a]">.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[#efe3cf]/60">
              Pickup ready in twenty minutes, delivery across brownstone Brooklyn,
              or a seat close enough to the oven to hear it work. One call covers all of it —
              the line is answered every hour we are not, and every hour we are.
            </p>
            <div className="mt-9 border-t border-[#efe3cf]/15">
              {[
                ["Walk-ins", "Half the room is held for the neighborhood, every night."],
                ["Large parties", "Six or more — call and it is handled on the spot."],
                ["Whole pies to go", "Order ahead; the box is open on the counter when you land."],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-6 border-b border-[#efe3cf]/10 py-4">
                  <span className="w-28 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c9a06a]">{t}</span>
                  <span className="text-sm leading-relaxed text-[#efe3cf]/65">{d}</span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={demoSubmit} className="bf-r bf-glass bf-sheen col-span-12 self-start rounded-lg p-7 sm:p-9 md:col-span-6">
            <div className="relative z-[3]">
              <div className="flex items-baseline justify-between border-b border-[#efe3cf]/12 pb-4">
                <h3 style={serif} className="text-2xl font-medium">Reserve a table</h3>
                <Label tone="text-[#efe3cf]/35">No. 214</Label>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <Label tone="text-[#efe3cf]/45">Name</Label>
                  <input type="text" placeholder="Isabella Romano" className="bf-field mt-2" />
                </label>
                <label className="block">
                  <Label tone="text-[#efe3cf]/45">Party</Label>
                  <input type="number" min="1" placeholder="2" className="bf-field mt-2" />
                </label>
                <label className="block">
                  <Label tone="text-[#efe3cf]/45">Date & time</Label>
                  <input type="datetime-local" className="bf-field mt-2" />
                </label>
              </div>
              <button type="submit"
                className="mt-7 w-full rounded-md border border-[#d9a55c]/60 bg-[#d9a55c]/12 py-3.5 text-sm font-semibold tracking-wide text-[#d9a55c] transition-colors hover:bg-[#d9a55c]/20 hover:text-[#efe3cf]">
                Request reservation
              </button>
              {demoNote && (
                <p className="mt-4 border-l-2 border-[#c4573a] pl-3 text-[13px] text-[#efe3cf]/70">
                  This is a demonstration model — on the live site, this request books a real table.
                </p>
              )}
              <p className="mt-4 text-center text-[12px] text-[#efe3cf]/40">
                Or simply call — <a href="tel:+17185550134" className="text-[#c9a06a] underline decoration-[#c9a06a]/40 underline-offset-2 hover:text-[#d9a55c]">(718) 555-0134</a> is answered 24/7.
              </p>
            </div>
          </form>
        </div>
      </section>

      {/* ── REVIEWS — three quotes, editorial rules, no chips ── */}
      <section className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="bf-r mb-10 border-b border-[#efe3cf]/15 pb-5">
          <Label>From the neighborhood</Label>
        </div>
        <div className="grid gap-x-12 gap-y-12 md:grid-cols-3">
          {REVIEWS.map(([name, text], i) => (
            <figure key={name} className="bf-r" style={{ transitionDelay: `${i * 110}ms` }}>
              <span style={serif} className="block text-5xl leading-none text-[#c4573a]/70" aria-hidden="true">&ldquo;</span>
              <blockquote style={serif} className="mt-2 text-[1.02rem] font-light italic leading-relaxed text-[#efe3cf]/85">
                {text}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="h-px w-8 bg-[#d9a55c]/50" />
                <Label tone="text-[#efe3cf]/55">{name}</Label>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── VISIT — hours, address, drawn map in a glass panel ── */}
      <section id="visit" className="relative mx-auto max-w-6xl px-5 pb-28 pt-8 sm:px-8">
        <div className="bf-r bf-glass bf-sheen grid grid-cols-12 gap-y-10 rounded-lg p-8 sm:p-10 md:gap-x-8">
          <div className="relative z-[3] col-span-12 md:col-span-4">
            <div className="mb-4 flex items-center gap-2.5 text-[#c4573a]"><Ic d={PIN} size={16} /><Label>Find us</Label></div>
            <p style={serif} className="text-xl leading-snug">214 Court Street<br />Cobble Hill, Brooklyn<br />New York 11201</p>
            <a href="tel:+17185550134" className="group mt-5 inline-flex items-center gap-2.5 text-sm font-semibold text-[#c9a06a] transition-colors hover:text-[#d9a55c]">
              <Ic d={PHONE} size={15} /> (718) 555-0134
            </a>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#efe3cf]/35">Answered 24/7 — even during the rush</p>
          </div>
          <div className="relative z-[3] col-span-12 md:col-span-4">
            <div className="mb-4 flex items-center gap-2.5 text-[#c4573a]"><Ic d={FLAME} size={16} /><Label>Hours</Label></div>
            <dl className="max-w-[250px]">
              {[["Sunday – Thursday", "5 – 11 pm"], ["Friday – Saturday", "5 pm – 12 am"], ["The phone", "always"]].map(([d, h]) => (
                <div key={d} className="flex justify-between border-b border-[#efe3cf]/10 py-2.5 text-sm text-[#efe3cf]/75">
                  <dt>{d}</dt><dd className="tabular-nums text-[#efe3cf]/55">{h}</dd>
                </div>
              ))}
            </dl>
          </div>
          {/* drawn neighborhood map — CSS/SVG only */}
          <div className="relative z-[3] col-span-12 md:col-span-4">
            <svg viewBox="0 0 260 170" className="w-full max-w-[300px] rounded-md border border-[#efe3cf]/12 bg-[#120c07]" role="img" aria-label="Map: 214 Court Street">
              {[36, 82, 128].map((y) => <line key={y} x1="0" y1={y} x2="260" y2={y} stroke="#efe3cf" strokeWidth="1" opacity=".1" />)}
              {[62, 130, 198].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="170" stroke="#efe3cf" strokeWidth="1" opacity=".1" />)}
              <line x1="0" y1="132" x2="260" y2="58" stroke="#c4573a" strokeWidth="2" opacity=".55" />
              <circle cx="130" cy="95" r="5.5" fill="#c4573a" />
              <circle cx="130" cy="95" r="11" fill="none" stroke="#d9a55c" strokeWidth="1" opacity=".55" />
              <text x="130" y="122" textAnchor="middle" fill="#efe3cf" fontSize="8.5" opacity=".55" style={{ letterSpacing: "3px" }}>COURT ST</text>
            </svg>
          </div>
        </div>
      </section>

      {/* ── FOOTER — discreet ── */}
      <footer className="relative border-t border-[#efe3cf]/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-[12px] text-[#efe3cf]/40 sm:flex-row sm:px-8">
          <p><span style={serif} className="text-[#efe3cf]/60">Bella Forno</span> · Brooklyn, NY · © 2026</p>
          <p>
            Demonstration model · website + AI by{" "}
            <a href="https://www.guileoai.com" target="_blank" rel="noreferrer"
              className="text-[#c9a06a]/80 underline decoration-[#c9a06a]/30 underline-offset-2 transition-colors hover:text-[#d9a55c]">
              Guileo
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
