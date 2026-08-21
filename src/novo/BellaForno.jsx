import { useEffect, useRef, useState } from "react";

// Bella Forno — fictional showcase restaurant (Guileo pitch model)
const MENU = {
  Antipasti: [
    { name: "Burrata al Forno", desc: "wood-oven roasted tomatoes, basil oil, grilled sourdough", price: 16 },
    { name: "Polpette della Nonna", desc: "beef & pork meatballs, Sunday ragù, pecorino", price: 14 },
    { name: "Carciofi Croccanti", desc: "crispy artichokes, lemon aioli, mint", price: 13 },
  ],
  Primi: [
    { name: "Tagliatelle al Tartufo", desc: "hand-cut pasta, black truffle butter, parmigiano", price: 26 },
    { name: "Rigatoni alla Vodka", desc: "spicy tomato cream, calabrian chili, basil", price: 21 },
  ],
  Pizze: [
    { name: "Margherita di Bufala", desc: "san marzano, buffalo mozzarella, basil, olio", price: 19 },
    { name: "Diavola Brooklyn", desc: "soppressata, hot honey, smoked mozzarella", price: 22 },
    { name: "Funghi e Fontina", desc: "roasted mushrooms, fontina, thyme, garlic cream", price: 21 },
  ],
  Dolci: [
    { name: "Tiramisù della Casa", desc: "espresso-soaked savoiardi, mascarpone cloud", price: 11 },
    { name: "Cannoli Siciliani", desc: "ricotta, candied orange, pistachio crumble", price: 10 },
  ],
};

const REVIEWS = [
  { name: "Dana", text: "Called at 9pm on a Friday — someone actually answered, booked us in seconds. The pizza tastes like Naples decided to move to Brooklyn." },
  { name: "Marcus", text: "That tagliatelle al tartufo is the reason I no longer cook. The room glows like everything is candlelit, because it is." },
  { name: "Sofia", text: "Booked a birthday for eight over the phone during their dinner rush. Zero hold music. Cannoli for the table, obviously." },
];

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("bf-in")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".bf-reveal").forEach((el) => io.observe(el));
    // fail-open: if the observer never fires (headless, quirks), reveal everything
    const t = setTimeout(() => document.querySelectorAll(".bf-reveal").forEach((el) => el.classList.add("bf-in")), 1400);
    return () => { clearTimeout(t); io.disconnect(); };
  }, []);
}

export default function BellaForno() {
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState(false);
  const heroRef = useRef(null);
  useReveal();

  useEffect(() => {
    // Display serif for the brand voice
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,700&display=swap";
    document.head.appendChild(l);
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      if (heroRef.current) heroRef.current.style.transform = `translateY(${window.scrollY * 0.28}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); l.remove(); };
  }, []);

  const demoSubmit = (e) => {
    e.preventDefault();
    setToast(true);
    setTimeout(() => setToast(false), 3200);
  };

  const serif = { fontFamily: "'Fraunces', Georgia, serif" };

  return (
    <div className="min-h-screen bg-[#1a120c] text-[#f5ead8] overflow-x-hidden antialiased" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @keyframes bfFlame { 0%,100%{transform:scale(1) translateY(0);opacity:.85} 40%{transform:scale(1.06) translateY(-6px);opacity:1} 70%{transform:scale(.97) translateY(3px);opacity:.9} }
        @keyframes bfEmber { 0%{transform:translateY(0);opacity:0} 15%{opacity:.9} 100%{transform:translateY(-140px);opacity:0} }
        @keyframes bfSteam { 0%{transform:translateY(0) scaleX(1);opacity:0} 20%{opacity:.5} 100%{transform:translateY(-46px) scaleX(1.6);opacity:0} }
        @keyframes bfToast { 0%{transform:translateY(16px);opacity:0} 12%,85%{transform:translateY(0);opacity:1} 100%{transform:translateY(8px);opacity:0} }
        .bf-reveal{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1)}
        .bf-in{opacity:1;transform:none}
        .bf-dish{transition:background .3s,transform .3s}
        .bf-dish:hover{background:rgba(196,87,58,.09);transform:translateX(6px)}
        .bf-dish:hover .bf-price{color:#e8b04b}
        .bf-dots{flex:1;border-bottom:1px dotted rgba(245,234,216,.25);margin:0 .75rem;transform:translateY(-4px)}
      `}</style>

      {/* grain */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none opacity-[.05] z-[60]" aria-hidden="true">
        <filter id="bfg"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" /></filter>
        <rect width="100%" height="100%" filter="url(#bfg)" />
      </svg>

      {/* nav */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "backdrop-blur-xl bg-[#1a120c]/70 border-b border-[#c4573a]/20 py-3" : "py-6"}`}>
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between">
          <span style={serif} className="text-xl font-semibold tracking-wide">Bella <em className="text-[#c4573a] not-italic">Forno</em></span>
          <div className="hidden sm:flex items-center gap-7 text-sm text-[#f5ead8]/70">
            <a href="#menu" className="hover:text-[#e8b04b] transition-colors">Menu</a>
            <a href="#reserve" className="hover:text-[#e8b04b] transition-colors">Reserve</a>
            <a href="#visit" className="hover:text-[#e8b04b] transition-colors">Visit</a>
          </div>
          <a href="tel:+17185550134" className="text-sm font-medium bg-[#c4573a] hover:bg-[#d86847] transition-colors rounded-full px-4 py-2">📞 (718) 555-0134</a>
        </div>
      </nav>

      {/* hero — glowing wood-fired oven */}
      <header className="relative min-h-[100svh] flex items-center justify-center text-center overflow-hidden">
        <div ref={heroRef} className="absolute inset-0 will-change-transform" aria-hidden="true">
          <div className="absolute left-1/2 top-[58%] -translate-x-1/2 w-[130vw] max-w-[1100px] aspect-square rounded-full"
            style={{ background: "radial-gradient(circle, rgba(232,140,60,.55) 0%, rgba(196,87,58,.35) 26%, rgba(120,50,25,.18) 48%, transparent 68%)", animation: "bfFlame 5s ease-in-out infinite" }} />
          <div className="absolute left-1/2 top-[66%] -translate-x-1/2 w-[60vw] max-w-[520px] aspect-square rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,196,110,.5) 0%, rgba(232,120,50,.25) 40%, transparent 70%)", animation: "bfFlame 3.4s ease-in-out infinite reverse" }} />
          {/* oven arch */}
          <svg viewBox="0 0 600 300" className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[min(90vw,640px)] opacity-40">
            <path d="M60 300 Q60 90 300 90 Q540 90 540 300" fill="none" stroke="#c4573a" strokeWidth="3" />
            <path d="M100 300 Q100 130 300 130 Q500 130 500 300" fill="none" stroke="#e8b04b" strokeWidth="1.5" opacity=".6" />
          </svg>
          {/* embers */}
          {[18, 34, 50, 64, 80].map((x, i) => (
            <span key={i} className="absolute bottom-[16%] w-1.5 h-1.5 rounded-full bg-[#e8b04b]"
              style={{ left: `${x}%`, animation: `bfEmber ${3 + i * 0.7}s ease-in ${i * 0.9}s infinite` }} />
          ))}
        </div>

        <div className="relative z-10 px-5 pt-24 pb-16 max-w-3xl">
          <p className="text-[#e8b04b] tracking-[.35em] uppercase text-xs mb-5">Brooklyn · Est. 2019 · Wood-fired</p>
          <h1 style={serif} className="text-[clamp(3.2rem,10vw,6.5rem)] font-bold leading-[.95]">Bella Forno</h1>
          <p style={serif} className="mt-5 text-xl sm:text-2xl text-[#f5ead8]/85 font-light italic">The oven never sleeps. Neither does our phone.</p>
          <p className="mt-3 text-sm text-[#f5ead8]/60">Open daily 5–11pm · Fri–Sat until midnight · 214 Court St, Cobble Hill</p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="tel:+17185550134" className="group w-full sm:w-auto bg-[#c4573a] hover:bg-[#d86847] transition-all hover:-translate-y-0.5 rounded-full px-7 py-4 font-semibold shadow-[0_10px_40px_-10px_rgba(196,87,58,.7)]">
              📞 (718) 555-0134
              <span className="block text-xs font-normal opacity-85">answered 24/7, even during the rush</span>
            </a>
            <a href="#reserve" className="w-full sm:w-auto border border-[#f5ead8]/30 hover:border-[#e8b04b] hover:text-[#e8b04b] transition-colors rounded-full px-7 py-4 font-medium">Book a table</a>
          </div>
          <span className="inline-flex items-center gap-1.5 mt-5 text-[11px] tracking-wide text-[#e8b04b]/90 border border-[#e8b04b]/30 rounded-full px-3 py-1 bg-[#e8b04b]/5">
            ✦ AI concierge answers in 2 rings
          </span>
        </div>
      </header>

      {/* menu */}
      <section id="menu" className="relative max-w-5xl mx-auto px-5 py-24">
        <div className="bf-reveal text-center mb-14">
          <p className="text-[#c4573a] tracking-[.3em] uppercase text-xs mb-3">La Cucina</p>
          <h2 style={serif} className="text-4xl sm:text-5xl font-semibold">The Menu</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-x-14 gap-y-12">
          {Object.entries(MENU).map(([cat, dishes]) => (
            <div key={cat} className="bf-reveal">
              <h3 style={serif} className="text-[#e8b04b] text-lg italic mb-4 flex items-center gap-3">
                {cat}<span className="h-px flex-1 bg-gradient-to-r from-[#e8b04b]/40 to-transparent" />
              </h3>
              <ul className="space-y-1">
                {dishes.map((d) => (
                  <li key={d.name} className="bf-dish rounded-lg px-3 py-3 -mx-3">
                    <div className="flex items-baseline">
                      <span style={serif} className="font-medium text-[1.05rem]">{d.name}</span>
                      <span className="bf-dots" />
                      <span className="bf-price text-[#f5ead8]/80 transition-colors">${d.price}</span>
                    </div>
                    <p className="text-sm text-[#f5ead8]/55 mt-1">{d.desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* order & reserve */}
      <section id="reserve" className="relative py-24 px-5" style={{ background: "linear-gradient(180deg, transparent, rgba(196,87,58,.07) 30%, rgba(196,87,58,.07) 70%, transparent)" }}>
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <div className="bf-reveal">
            <p className="text-[#c4573a] tracking-[.3em] uppercase text-xs mb-3">Tonight</p>
            <h2 style={serif} className="text-4xl font-semibold leading-tight">Order &amp; Reserve</h2>
            <p className="mt-4 text-[#f5ead8]/65 text-sm leading-relaxed">Pickup in 20 minutes, delivery across brownstone Brooklyn, or a candlelit table by the oven. Call once — our concierge handles the rest.</p>
            {/* steam over a plate */}
            <div className="relative mt-10 h-28 w-28">
              <div className="absolute bottom-0 left-0 w-28 h-10 rounded-[50%] border border-[#e8b04b]/40 bg-[#2a1c12]" />
              {[8, 13, 18].map((x, i) => (
                <svg key={i} viewBox="0 0 20 60" className="absolute bottom-8 w-4" style={{ left: `${x * 4}px`, animation: `bfSteam ${2.6 + i * 0.5}s ease-out ${i * 0.8}s infinite` }}>
                  <path d="M10 55 C4 42 16 34 10 22 C5 12 13 6 10 0" fill="none" stroke="#f5ead8" strokeWidth="1.6" strokeLinecap="round" opacity=".6" />
                </svg>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={demoSubmit} className="bg-[#c4573a] hover:bg-[#d86847] hover:-translate-y-0.5 transition-all rounded-full px-6 py-3 text-sm font-semibold">Order pickup</button>
              <button onClick={demoSubmit} className="border border-[#f5ead8]/30 hover:border-[#e8b04b] hover:text-[#e8b04b] transition-colors rounded-full px-6 py-3 text-sm font-medium">Order delivery</button>
            </div>
          </div>
          <form onSubmit={demoSubmit} className="bf-reveal bg-[#241811]/80 backdrop-blur border border-[#c4573a]/25 rounded-2xl p-7 shadow-[0_20px_60px_-20px_rgba(0,0,0,.6)]">
            <h3 style={serif} className="text-xl mb-5 italic text-[#e8b04b]">Reserve a table</h3>
            {[
              ["Name", "text", "Isabella R."],
              ["Party size", "number", "2"],
              ["Date & time", "datetime-local", ""],
            ].map(([label, type, ph]) => (
              <label key={label} className="block mb-4 text-xs uppercase tracking-widest text-[#f5ead8]/55">
                {label}
                <input type={type} placeholder={ph} min={type === "number" ? 1 : undefined}
                  className="mt-1.5 w-full bg-[#1a120c] border border-[#f5ead8]/15 focus:border-[#e8b04b] outline-none rounded-lg px-4 py-3 text-sm text-[#f5ead8] transition-colors [color-scheme:dark]" />
              </label>
            ))}
            <button type="submit" className="w-full bg-[#e8b04b] text-[#1a120c] hover:bg-[#f2c366] transition-colors rounded-lg py-3.5 font-semibold text-sm mt-2">Request reservation</button>
            <p className="text-[11px] text-[#f5ead8]/40 mt-3 text-center">Or just call — the line is always answered.</p>
          </form>
        </div>
      </section>

      {/* reviews */}
      <section className="max-w-5xl mx-auto px-5 py-24">
        <div className="grid md:grid-cols-3 gap-6">
          {REVIEWS.map((r, i) => (
            <figure key={r.name} className="bf-reveal bg-[#241811]/60 border border-[#f5ead8]/10 rounded-2xl p-7 hover:border-[#c4573a]/40 transition-colors" style={{ transitionDelay: `${i * 120}ms` }}>
              <div className="text-[#e8b04b] tracking-widest text-sm mb-3">★★★★★</div>
              <blockquote style={serif} className="italic text-[.95rem] leading-relaxed text-[#f5ead8]/85">“{r.text}”</blockquote>
              <figcaption className="mt-4 text-xs uppercase tracking-widest text-[#c4573a]">— {r.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* location / footer */}
      <footer id="visit" className="border-t border-[#c4573a]/20 bg-[#140d08]">
        <div className="max-w-5xl mx-auto px-5 py-20 grid md:grid-cols-3 gap-12">
          <div className="bf-reveal">
            <h3 style={serif} className="text-2xl italic text-[#e8b04b] mb-4">Find us</h3>
            <p className="text-sm text-[#f5ead8]/70 leading-relaxed">214 Court Street<br />Cobble Hill, Brooklyn, NY 11201</p>
            <a href="tel:+17185550134" className="inline-block mt-4 text-sm text-[#c4573a] hover:text-[#d86847] font-medium">📞 (718) 555-0134</a>
          </div>
          <div className="bf-reveal">
            <h3 style={serif} className="text-2xl italic text-[#e8b04b] mb-4">Hours</h3>
            <ul className="text-sm text-[#f5ead8]/70 space-y-1.5">
              <li className="flex justify-between max-w-[220px]"><span>Sun – Thu</span><span>5pm – 11pm</span></li>
              <li className="flex justify-between max-w-[220px]"><span>Fri – Sat</span><span>5pm – 12am</span></li>
              <li className="text-[#e8b04b]/80 pt-2 text-xs">Phone answered around the clock.</li>
            </ul>
          </div>
          {/* stylized map hint */}
          <div className="bf-reveal">
            <svg viewBox="0 0 220 150" className="w-full max-w-[240px] rounded-xl border border-[#f5ead8]/10 bg-[#1a120c]">
              {[30, 70, 110].map((y) => <line key={y} x1="0" y1={y} x2="220" y2={y} stroke="#f5ead8" strokeWidth="1" opacity=".12" />)}
              {[50, 110, 170].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="150" stroke="#f5ead8" strokeWidth="1" opacity=".12" />)}
              <line x1="0" y1="115" x2="220" y2="55" stroke="#c4573a" strokeWidth="2" opacity=".5" />
              <circle cx="110" cy="70" r="7" fill="#c4573a" />
              <circle cx="110" cy="70" r="12" fill="none" stroke="#e8b04b" strokeWidth="1.5" opacity=".6" />
              <text x="110" y="100" textAnchor="middle" fill="#f5ead8" fontSize="9" opacity=".6" style={{ letterSpacing: "2px" }}>COURT ST</text>
            </svg>
          </div>
        </div>
        <div className="border-t border-[#f5ead8]/10 py-6 text-center text-xs text-[#f5ead8]/40">
          <p>© 2026 Bella Forno · Brooklyn, NY</p>
          <p className="mt-1.5">Demonstration model · ⚡ website + AI by <a href="https://www.guileoai.com" target="_blank" rel="noreferrer" className="text-[#e8b04b]/70 hover:text-[#e8b04b] underline underline-offset-2">Guileo</a></p>
        </div>
      </footer>

      {/* demo toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#f5ead8] text-[#1a120c] rounded-full px-6 py-3 text-sm font-medium shadow-2xl" style={{ animation: "bfToast 3.2s ease forwards" }}>
          This is a demonstration model
        </div>
      )}
    </div>
  );
}
