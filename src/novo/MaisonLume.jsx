import { useEffect, useRef, useState } from "react";

/* Maison Lume — fictional SoHo beauty maison. Editorial fashion-noir showcase (demonstration model). */

const NOIR = "#0d0b0e";
const BLUSH = "#e8b4b8";
const GOLD = "#d9c08f";
const PORCELAIN = "#f4efe9";

const SERVICES = [
  { n: "01", name: "Cut & Finish", price: "from $145", note: "Precision architecture for the face you already have. Blow-dry ritual included." },
  { n: "02", name: "Colour", price: "from $190", note: "Single-process gloss to full transformation, mixed at the chair, never from a chart." },
  { n: "03", name: "Balayage", price: "from $320", note: "Hand-painted light. Lived-in dimension that grows out like a rumor, not a line." },
  { n: "04", name: "The Lume Facial", price: "from $210", note: "Sixty minutes of sculpting, lymphatic drainage and glass-skin finishing." },
  { n: "05", name: "Brows & Lashes", price: "from $85", note: "Lamination, tint and a cartographer's eye for the arch you were born under." },
  { n: "06", name: "Keratin Ritual", price: "from $380", note: "Smoothing treatment for silk that survives August in Manhattan." },
  { n: "07", name: "Bridal Maison", price: "from $650", note: "Trial, day-of hair and complexion, and a calm room above Grand Street." },
];

const Sparkle = ({ className, size = 14, delay = "0s" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={{ animation: `lume-twinkle 3.6s ease-in-out ${delay} infinite` }} aria-hidden="true">
    <path d="M12 0c.8 6.6 4.6 10.4 12 12-7.4 1.6-11.2 5.4-12 12-.8-6.6-4.6-10.4-12-12C7.4 10.4 11.2 6.6 12 0z" fill={GOLD} />
  </svg>
);

/* Rotating circular "LUME · MAISON ·" badge */
const OrbitBadge = ({ size = 150 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} style={{ animation: "lume-orbit 22s linear infinite" }} aria-hidden="true">
    <defs>
      <path id="lume-ring" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
    </defs>
    <circle cx="50" cy="50" r="26" fill="none" stroke={GOLD} strokeWidth="0.5" opacity="0.6" />
    <text fontSize="8.2" letterSpacing="2.5" fill={PORCELAIN} style={{ fontFamily: "'Archivo', sans-serif", textTransform: "uppercase" }}>
      <textPath href="#lume-ring">LUME · MAISON · LUME · SOHO ·</textPath>
    </text>
    <path d="M50 42c.5 4.4 3.1 7 8 8-4.9 1-7.5 3.6-8 8-.5-4.4-3.1-7-8-8 4.9-1 7.5-3.6 8-8z" fill={BLUSH} />
  </svg>
);

/* Arch-shaped photo stand-in with soft inner gradients */
const Arch = ({ from, to, children, className = "" }) => (
  <div className={`relative overflow-hidden rounded-t-[999px] ${className}`}
    style={{ background: `linear-gradient(160deg, ${from}, ${to} 70%)`, boxShadow: `inset 0 0 60px rgba(13,11,14,.55), 0 0 0 1px ${GOLD}33` }}>
    <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(244,239,233,.14), transparent 55%)" }} />
    {children}
  </div>
);

const Rule = () => <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}88, transparent)` }} />;

const Label = ({ children }) => (
  <p className="text-[11px] tracking-[0.42em] uppercase" style={{ color: GOLD, fontFamily: "'Archivo', sans-serif" }}>{children}</p>
);

export default function MaisonLume() {
  const [form, setForm] = useState({ name: "", service: SERVICES[0].name, date: "" });
  const [sent, setSent] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    // Inject editorial Google Fonts
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Archivo:wght@300;400;500&display=swap";
    document.head.appendChild(link);
    // Scroll reveal
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("lume-in"), io.unobserve(e.target))),
      { threshold: 0.12 }
    );
    rootRef.current?.querySelectorAll(".lume-reveal").forEach((el) => io.observe(el));
    return () => { io.disconnect(); document.head.removeChild(link); };
  }, []);

  const serif = { fontFamily: "'Cormorant Garamond', serif" };
  const sans = { fontFamily: "'Archivo', sans-serif" };

  return (
    <div ref={rootRef} className="min-h-screen w-full overflow-x-hidden antialiased" style={{ background: NOIR, color: PORCELAIN, ...sans }}>
      <style>{`
        @keyframes lume-silk { 0%{background-position:0% 30%} 50%{background-position:100% 70%} 100%{background-position:0% 30%} }
        @keyframes lume-orbit { to { transform: rotate(360deg) } }
        @keyframes lume-twinkle { 0%,100%{opacity:.15; transform:scale(.7)} 50%{opacity:1; transform:scale(1)} }
        @keyframes lume-drift { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        .lume-reveal { opacity:0; transform:translateY(26px); transition:opacity .9s cubic-bezier(.22,.6,.2,1), transform .9s cubic-bezier(.22,.6,.2,1); }
        .lume-in { opacity:1; transform:none; }
        .lume-strip::-webkit-scrollbar { display:none }
        .lume-card { transition: border-color .5s, background .5s, transform .5s cubic-bezier(.22,.6,.2,1); }
        .lume-card:hover { border-color:${GOLD}aa !important; transform:translateY(-6px); background:rgba(232,180,184,.05) !important; }
        .lume-btn { transition: background .4s, color .4s, letter-spacing .4s; }
        .lume-btn:hover { background:${BLUSH}; color:${NOIR}; letter-spacing:.34em; }
        .lume-link:hover { color:${BLUSH} }
        input.lume-f, select.lume-f { transition: border-color .4s }
        .lume-f:focus { outline:none; border-color:${BLUSH} !important }
      `}</style>

      {/* ── Sticky glass nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl" style={{ background: "rgba(13,11,14,.62)", borderBottom: `1px solid ${GOLD}26` }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="text-xl tracking-[0.18em]" style={{ ...serif, fontStyle: "italic" }}>Maison <span style={{ color: BLUSH }}>Lume</span></a>
          <nav className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.3em] uppercase">
            {["Rituals", "Cartes", "Book"].map((t) => (
              <a key={t} href={`#${t.toLowerCase()}`} className="lume-link" style={{ color: PORCELAIN, transition: "color .3s" }}>{t}</a>
            ))}
          </nav>
          <a href="tel:+12125550186" className="text-[11px] tracking-[0.22em] uppercase px-4 py-2 rounded-full" style={{ border: `1px solid ${GOLD}66`, color: GOLD }}>
            (212) 555-0186
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="top" className="relative pt-32 md:pt-40 pb-20 md:pb-28 px-5 md:px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-[1.25fr_1fr] gap-12 items-center">
          <div>
            <Label>SoHo · Manhattan · Est. MMXXVI</Label>
            <h1 className="mt-5 leading-[0.92]" style={{ ...serif, fontSize: "clamp(3.4rem, 10vw, 7.5rem)" }}>
              Maison<br /><em style={{ color: BLUSH }}>Lume</em>
            </h1>
            <p className="mt-6 text-2xl md:text-3xl" style={{ ...serif, fontStyle: "italic", color: `${PORCELAIN}cc` }}>
              Hair. Skin. <span style={{ color: GOLD }}>Light.</span>
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a href="#book" className="lume-btn text-[12px] tracking-[0.28em] uppercase px-8 py-4" style={{ background: PORCELAIN, color: NOIR }}>
                Book your ritual
              </a>
              <a href="tel:+12125550186" className="flex items-center gap-3 px-5 py-3 rounded-full text-[12px]" style={{ border: `1px solid ${BLUSH}55`, color: `${PORCELAIN}dd` }}>
                <span aria-hidden="true">📞</span>
                <span className="tracking-[0.08em]">(212) 555-0186 — answered 24/7 by our AI concierge</span>
              </a>
            </div>
          </div>

          {/* Silk panel — slow-moving liquid gradient, arch-framed */}
          <div className="relative lume-reveal" style={{ animation: "lume-drift 9s ease-in-out infinite" }}>
            <div className="relative overflow-hidden rounded-t-[999px] rounded-b-[2rem] h-[420px] md:h-[520px]"
              style={{
                background: `linear-gradient(120deg, #1a1216, ${BLUSH}55 28%, #2a1c22 46%, ${GOLD}44 64%, #14101a 82%, ${BLUSH}33)`,
                backgroundSize: "320% 320%",
                animation: "lume-silk 16s ease-in-out infinite",
                boxShadow: `inset 0 0 90px rgba(13,11,14,.7), 0 0 0 1px ${GOLD}40, 0 40px 80px -40px ${BLUSH}33`,
              }}>
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 12%, rgba(244,239,233,.16), transparent 50%)" }} />
              <div className="absolute inset-x-0 bottom-8 flex justify-center">
                <OrbitBadge size={150} />
              </div>
            </div>
            <Sparkle className="absolute -top-3 left-8" size={18} />
            <Sparkle className="absolute top-16 -right-2" size={12} delay="1.2s" />
            <Sparkle className="absolute bottom-10 -left-4" size={15} delay="2.1s" />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 md:px-8"><Rule /></div>

      {/* ── Services — editorial cards, snap strip on mobile ── */}
      <section id="rituals" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-5 md:px-8 lume-reveal">
          <Label>The Rituals</Label>
          <h2 className="mt-4 max-w-xl leading-tight" style={{ ...serif, fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}>
            Seven ways to <em style={{ color: BLUSH }}>leave lit</em>.
          </h2>
        </div>
        <div className="lume-strip mt-12 flex md:grid md:grid-cols-3 lg:grid-cols-4 gap-5 overflow-x-auto snap-x snap-mandatory px-5 md:px-8 max-w-6xl mx-auto pb-4"
          style={{ scrollbarWidth: "none" }}>
          {SERVICES.map((s, i) => (
            <article key={s.n} className="lume-card lume-reveal snap-center shrink-0 w-[78vw] max-w-[300px] md:w-auto md:max-w-none p-6 flex flex-col rounded-sm"
              style={{ border: `1px solid ${GOLD}30`, background: "rgba(244,239,233,.02)", transitionDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between">
                <span className="text-[10px] tracking-[0.4em]" style={{ color: `${GOLD}bb` }}>{s.n}</span>
                <Sparkle size={11} delay={`${i * 0.5}s`} />
              </div>
              <h3 className="mt-8 text-2xl" style={serif}>{s.name}</h3>
              <p className="mt-3 text-[13px] leading-relaxed" style={{ color: `${PORCELAIN}99` }}>{s.note}</p>
              <p className="mt-auto pt-6 text-sm tracking-[0.14em] uppercase" style={{ color: BLUSH }}>{s.price}</p>
            </article>
          ))}
        </div>
        <p className="md:hidden text-center text-[10px] tracking-[0.3em] uppercase mt-2" style={{ color: `${PORCELAIN}55` }}>swipe →</p>
      </section>

      <div className="max-w-6xl mx-auto px-5 md:px-8"><Rule /></div>

      {/* ── Gift cards & membership ── */}
      <section id="cartes" className="py-20 md:py-28 px-5 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="lume-reveal">
            <Label>Cartes de la Maison</Label>
            <h2 className="mt-4 leading-tight" style={{ ...serif, fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}>
              Give light. <em style={{ color: GOLD }}>Keep light.</em>
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {/* Gift card */}
            <div className="lume-card lume-reveal relative overflow-hidden p-8 md:p-10 rounded-sm" style={{ border: `1px solid ${GOLD}40`, background: `linear-gradient(150deg, rgba(217,192,143,.09), rgba(13,11,14,0) 60%)` }}>
              <Arch from={`${GOLD}33`} to="#171217" className="absolute -right-8 -top-10 w-36 h-52 opacity-70" />
              <p className="text-[10px] tracking-[0.4em] uppercase" style={{ color: GOLD }}>La Carte Cadeau</p>
              <h3 className="mt-5 text-3xl md:text-4xl" style={serif}>The Gift Card</h3>
              <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: `${PORCELAIN}aa` }}>
                From $100 to carte blanche. Pressed in gold, delivered by hand or by ether, and honored for any ritual on the menu.
              </p>
              <a href="tel:+12125550186" className="inline-block mt-8 text-[11px] tracking-[0.3em] uppercase pb-1" style={{ color: PORCELAIN, borderBottom: `1px solid ${BLUSH}` }}>
                Call to arrange
              </a>
            </div>
            {/* Membership */}
            <div className="lume-card lume-reveal relative overflow-hidden p-8 md:p-10 rounded-sm" style={{ border: `1px solid ${BLUSH}44`, background: `linear-gradient(150deg, rgba(232,180,184,.09), rgba(13,11,14,0) 60%)` }}>
              <Arch from={`${BLUSH}3d`} to="#191014" className="absolute -right-8 -top-10 w-36 h-52 opacity-70" />
              <p className="text-[10px] tracking-[0.4em] uppercase" style={{ color: BLUSH }}>Le Cercle Lume</p>
              <h3 className="mt-5 text-3xl md:text-4xl" style={serif}>The Membership</h3>
              <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: `${PORCELAIN}aa` }}>
                $180 monthly. One facial or blow-dry ritual each month, 15% off everything else, and first claim on Saturday chairs.
              </p>
              <a href="#book" className="inline-block mt-8 text-[11px] tracking-[0.3em] uppercase pb-1" style={{ color: PORCELAIN, borderBottom: `1px solid ${GOLD}` }}>
                Request a place
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 md:px-8"><Rule /></div>

      {/* ── Booking ── */}
      <section id="book" className="py-20 md:py-28 px-5 md:px-8">
        <div className="max-w-3xl mx-auto text-center lume-reveal">
          <Label>Rendez-vous</Label>
          <h2 className="mt-4 leading-tight" style={{ ...serif, fontSize: "clamp(2.2rem, 5vw, 3.4rem)" }}>
            Book your <em style={{ color: BLUSH }}>ritual</em>
          </h2>
          <p className="mt-4 text-sm" style={{ color: `${PORCELAIN}88` }}>
            Or simply call <a href="tel:+12125550186" className="lume-link" style={{ color: GOLD }}>(212) 555-0186</a> — our AI concierge answers day and night.
          </p>
          {sent ? (
            <div className="mt-10 p-8 rounded-sm" style={{ border: `1px solid ${GOLD}55`, background: "rgba(217,192,143,.06)" }}>
              <p className="text-2xl" style={{ ...serif, fontStyle: "italic" }}>Merci, {form.name || "chérie"}.</p>
              <p className="mt-3 text-sm" style={{ color: `${PORCELAIN}99` }}>
                This is a demonstration model — no chair was harmed, and no appointment was made. On a live maison, your {form.service.toLowerCase()} would be confirmed within the minute.
              </p>
            </div>
          ) : (
            <form className="mt-10 grid sm:grid-cols-3 gap-4 text-left" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              {[
                <input key="n" required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="lume-f w-full bg-transparent px-4 py-4 text-sm" style={{ border: `1px solid ${GOLD}44`, color: PORCELAIN }} />,
                <select key="s" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}
                  className="lume-f w-full px-4 py-4 text-sm" style={{ border: `1px solid ${GOLD}44`, background: NOIR, color: PORCELAIN }}>
                  {SERVICES.map((s) => <option key={s.n}>{s.name}</option>)}
                </select>,
                <input key="d" required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="lume-f w-full bg-transparent px-4 py-4 text-sm" style={{ border: `1px solid ${GOLD}44`, color: PORCELAIN, colorScheme: "dark" }} />,
              ]}
              <button type="submit" className="lume-btn sm:col-span-3 mt-2 text-[12px] tracking-[0.28em] uppercase px-8 py-4" style={{ background: PORCELAIN, color: NOIR }}>
                Reserve the chair
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── House rules strip ── */}
      <div className="py-5 px-5 text-center text-[10px] tracking-[0.24em] uppercase" style={{ borderTop: `1px solid ${GOLD}22`, borderBottom: `1px solid ${GOLD}22`, color: `${PORCELAIN}77` }}>
        House rules — arrivals past 15 minutes may be rebooked · 24h notice to cancel · cappuccino always on the house
      </div>

      {/* ── Footer ── */}
      <footer className="py-14 px-5 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="text-2xl tracking-[0.14em]" style={{ ...serif, fontStyle: "italic" }}>Maison Lume</p>
            <p className="mt-2 text-[11px] tracking-[0.18em]" style={{ color: `${PORCELAIN}66` }}>
              84 Grand Street, SoHo, New York · <a href="tel:+12125550186" className="lume-link" style={{ color: `${PORCELAIN}99` }}>(212) 555-0186</a>
            </p>
          </div>
          <p className="text-[11px] tracking-[0.14em]" style={{ color: `${PORCELAIN}55` }}>
            Demonstration model · <a href="https://www.guileoai.com" target="_blank" rel="noreferrer" className="lume-link" style={{ color: GOLD }}>⚡ website + AI by Guileo</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
