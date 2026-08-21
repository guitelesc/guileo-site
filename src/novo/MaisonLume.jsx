import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   MAISON LUME — fictional SoHo salon & spa. Demonstration model by Guileo.
   Editorial fashion-noir: the house "surface-real" DNA (layered radial light
   pools + film-grain in soft-light, glass with real thickness) recolored to
   near-black / blush / champagne gold / porcelain. Static premium — no motion
   except restrained scroll reveals and a sheen sweep on hover.
   ──────────────────────────────────────────────────────────────────────────── */

const SERVICES = [
  { n: "01", name: "Cut & Finish", price: "from $145", note: "Precision architecture for the face you already have. Blow-dry ritual included." },
  { n: "02", name: "Colour", price: "from $190", note: "Single-process gloss to full transformation, mixed at the chair, never from a chart." },
  { n: "03", name: "Balayage", price: "from $320", note: "Hand-painted light. Lived-in dimension that grows out like a rumor, not a line." },
  { n: "04", name: "The Lume Facial", price: "from $210", note: "Sixty minutes of sculpting, lymphatic drainage and glass-skin finishing." },
  { n: "05", name: "Brows & Lashes", price: "from $85", note: "Lamination, tint, and a cartographer's eye for the arch you were born under." },
  { n: "06", name: "Keratin Ritual", price: "from $380", note: "Smoothing for silk that survives August in Manhattan." },
  { n: "07", name: "Bridal Maison", price: "from $650", note: "Trial, day-of hair and complexion, and a calm room above Grand Street." },
];

/* Film grain — the index.css surface-real technique verbatim (inline SVG
   fractalNoise, desaturated, soft-light). Rendered once per lit surface. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E\")";

const CSS = `
  .ml-root { background-color:#0d0b0e; color:#f4efe9; min-height:100vh; overflow-x:hidden;
    font-family:'Archivo',system-ui,sans-serif; -webkit-font-smoothing:antialiased;
    /* ground is never flat: blush pool high right, gold pool low left, porcelain wash from below */
    background-image:
      radial-gradient(1100px 620px at 82% -8%, rgba(232,180,184,0.07), transparent 60%),
      radial-gradient(950px 560px at 4% 30%, rgba(217,192,143,0.06), transparent 58%),
      radial-gradient(1200px 900px at 50% 112%, rgba(244,239,233,0.05), transparent 62%);
    position:relative; }
  .ml-root::before { content:""; position:fixed; inset:0; z-index:0; pointer-events:none;
    opacity:.5; mix-blend-mode:soft-light; background-image:${GRAIN}; }
  .ml-z { position:relative; z-index:1; }

  .ml-serif { font-family:'Cormorant Garamond',Georgia,serif; }
  .ml-label { font-size:10px; font-weight:600; letter-spacing:0.32em; text-transform:uppercase;
    color:rgba(217,192,143,0.85); }
  .ml-label--dim { color:rgba(244,239,233,0.45); }
  .ml-hair { height:1px; background:linear-gradient(90deg, rgba(217,192,143,0.45), rgba(217,192,143,0.08)); }

  /* glass with thickness: top reflection + rim highlight + dark bottom inner shade */
  .ml-glass { position:relative; overflow:hidden; background:rgba(255,255,255,0.028);
    border:1px solid rgba(244,239,233,0.09); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -1px 0 rgba(0,0,0,0.32),
      0 30px 70px -34px rgba(0,0,0,0.85); }
  .ml-glass::before { content:""; position:absolute; inset:0; pointer-events:none; z-index:1;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.015) 16%, transparent 38%),
      radial-gradient(120% 70% at 82% -12%, rgba(232,180,184,0.06), transparent 55%);
    mix-blend-mode:screen; }
  /* slow sheen sweep — hover only */
  .ml-glass::after { content:""; position:absolute; top:0; left:0; width:55%; height:100%; z-index:1;
    background:linear-gradient(105deg, transparent, rgba(255,255,255,0.06), transparent);
    transform:translateX(-170%) skewX(-12deg); transition:transform 1.1s ease; pointer-events:none; }
  .ml-glass:hover::after { transform:translateX(280%) skewX(-12deg); }

  /* one large still gradient panel that reads like a lit photograph */
  .ml-photo { position:relative; overflow:hidden; border:1px solid rgba(217,192,143,0.18);
    background-color:#141014;
    background-image:
      radial-gradient(90% 120% at 72% 18%, rgba(232,180,184,0.22), transparent 58%),
      radial-gradient(70% 90% at 12% 88%, rgba(217,192,143,0.16), transparent 55%),
      radial-gradient(140% 100% at 50% 115%, rgba(13,11,14,0.9), transparent 70%),
      linear-gradient(160deg, #1a1418 0%, #0d0b0e 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.5),
      0 40px 90px -40px rgba(0,0,0,0.9); }
  .ml-photo::before { content:""; position:absolute; inset:0; pointer-events:none;
    opacity:.55; mix-blend-mode:soft-light; background-image:${GRAIN}; }

  .ml-rv { opacity:0; transform:translateY(16px); transition:opacity .9s cubic-bezier(.22,1,.36,1), transform .9s cubic-bezier(.22,1,.36,1); }
  .ml-rv.ml-in { opacity:1; transform:none; }

  .ml-row { transition:background .4s ease; }
  .ml-row:hover { background:rgba(232,180,184,0.035); }

  .ml-input { width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(244,239,233,0.14);
    color:#f4efe9; padding:13px 16px; font-size:14px; font-family:inherit; outline:none;
    transition:border-color .3s ease; }
  .ml-input:focus { border-color:rgba(217,192,143,0.6); }
  .ml-input::placeholder { color:rgba(244,239,233,0.35); }

  .ml-btn { display:inline-block; background:linear-gradient(180deg,#e6cf9d 0%,#d9c08f 55%,#c3a771 100%);
    color:#0d0b0e; font-weight:600; font-size:12px; letter-spacing:0.22em; text-transform:uppercase;
    padding:15px 34px; border:0; cursor:pointer; position:relative; overflow:hidden;
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.55), 0 18px 40px -16px rgba(217,192,143,0.35);
    transition:filter .3s ease; }
  .ml-btn:hover { filter:brightness(1.06); }

  @media (max-width: 900px) {
    .ml-hero-grid, .ml-two, .ml-photo-grid { grid-template-columns:1fr !important; }
    .ml-hero-panel { margin-top:-2.2rem !important; margin-left:1.2rem !important; }
    .ml-svc-note { display:block !important; padding-left:0 !important; margin-top:6px; }
  }
`;

/* ── restrained scroll reveal with fail-open: if the observer never fires
   (old browser, prerender), a 1.4s timer reveals everything. ── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current; if (!root) return;
    const els = Array.from(root.querySelectorAll(".ml-rv"));
    const failOpen = setTimeout(() => els.forEach((el) => el.classList.add("ml-in")), 1400);
    let io;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("ml-in"); io.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      els.forEach((el) => io.observe(el));
    }
    return () => { clearTimeout(failOpen); io?.disconnect(); };
  }, []);
  return ref;
}

const Label = ({ children, dim }) => (
  <div className={`ml-label${dim ? " ml-label--dim" : ""}`}>{children}</div>
);

export default function MaisonLume() {
  const rootRef = useReveal();

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Archivo:wght@300;400;600&display=swap";
    document.head.appendChild(l);
    const prev = document.title;
    document.title = "Maison Lume — Salon & Spa, SoHo";
    return () => { l.remove(); document.title = prev; };
  }, []);

  return (
    <div ref={rootRef} className="ml-root">
      <style>{CSS}</style>

      <div className="ml-z" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,56px)" }}>

        {/* ── masthead ─────────────────────────────────────────── */}
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "30px 0 22px", gap: 16, flexWrap: "wrap" }}>
          <div className="ml-serif" style={{ fontSize: 24, fontStyle: "italic", letterSpacing: "0.04em" }}>
            Maison <span style={{ color: "#d9c08f" }}>Lume</span>
          </div>
          <div style={{ display: "flex", gap: 28, alignItems: "baseline", flexWrap: "wrap" }}>
            <Label dim>SoHo · Manhattan</Label>
            <a href="tel:+12125550186" style={{ textDecoration: "none" }}>
              <span className="ml-label">(212) 555-0186</span>
            </a>
          </div>
        </header>
        <div className="ml-hair" />

        {/* ── hero: asymmetric, display type cropped over a glass panel ── */}
        <section style={{ padding: "clamp(56px,9vw,120px) 0 0" }}>
          <div className="ml-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", alignItems: "start" }}>
            <div className="ml-rv">
              <Label>N° 01 — The House</Label>
              <h1 className="ml-serif" style={{
                fontStyle: "italic", fontWeight: 400, margin: "22px 0 0",
                fontSize: "clamp(3.2rem,9vw,7.4rem)", lineHeight: 0.92, letterSpacing: "-0.015em",
                position: "relative", zIndex: 2,
              }}>
                Light,<br />
                worn <span style={{ color: "#e8b4b8" }}>close</span><br />
                to the skin.
              </h1>
            </div>
            <div className="ml-rv ml-hero-panel ml-glass" style={{
              marginTop: "5.5rem", marginLeft: "-3.5rem", padding: "clamp(26px,3.4vw,44px)",
            }}>
              <div style={{ position: "relative", zIndex: 2 }}>
                <Label dim>Salon & Spa — est. MMXXVI</Label>
                <p style={{ margin: "18px 0 0", fontSize: 15, lineHeight: 1.75, fontWeight: 300, color: "rgba(244,239,233,0.78)" }}>
                  A hair and skin atelier above Grand Street. Seven rituals, one chair
                  at a time, and a house rule against hurry. Walk-ins are a rumor;
                  appointments are a promise.
                </p>
                <div className="ml-hair" style={{ margin: "24px 0" }} />
                <a href="tel:+12125550186" style={{ textDecoration: "none", display: "block" }}>
                  <span className="ml-serif" style={{ fontSize: 26, fontStyle: "italic", color: "#f4efe9" }}>(212) 555-0186</span>
                </a>
                <div className="ml-label" style={{ marginTop: 10, fontVariant: "small-caps", textTransform: "none", letterSpacing: "0.28em", fontSize: 11 }}>
                  answered 24/7 by our ai concierge
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── services: an index, not cards ─────────────────────── */}
        <section style={{ padding: "clamp(80px,11vw,150px) 0 0" }}>
          <div className="ml-rv" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <Label>N° 02 — The Rituals</Label>
            <h2 className="ml-serif" style={{ fontStyle: "italic", fontWeight: 400, fontSize: "clamp(2rem,4.6vw,3.4rem)", margin: 0 }}>
              Seven services. No menu-speak.
            </h2>
          </div>
          <div className="ml-rv" style={{ marginTop: 40 }}>
            <div className="ml-hair" />
            {SERVICES.map((s) => (
              <div key={s.n}>
                <div className="ml-row" style={{ display: "flex", alignItems: "baseline", gap: "clamp(14px,3vw,34px)", padding: "22px 10px", flexWrap: "wrap" }}>
                  <span className="ml-label" style={{ minWidth: 30 }}>{s.n}</span>
                  <span className="ml-serif" style={{ fontSize: "clamp(1.35rem,2.6vw,1.9rem)", fontStyle: "italic", flex: "0 0 auto", minWidth: "min(220px,40vw)" }}>{s.name}</span>
                  <span className="ml-svc-note" style={{ flex: 1, paddingLeft: 8, fontSize: 13.5, fontWeight: 300, lineHeight: 1.6, color: "rgba(244,239,233,0.55)" }}>{s.note}</span>
                  <span className="ml-label" style={{ color: "#e8b4b8", letterSpacing: "0.18em" }}>{s.price}</span>
                </div>
                <div className="ml-hair" style={{ opacity: 0.55 }} />
              </div>
            ))}
          </div>
        </section>

        {/* ── the lit photograph: one still gradient panel ──────── */}
        <section style={{ padding: "clamp(80px,11vw,150px) 0 0" }}>
          <div className="ml-rv ml-photo ml-photo-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 380 }}>
            <div style={{ position: "relative", zIndex: 2, padding: "clamp(30px,5vw,64px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <Label>N° 03 — The Room</Label>
              <p className="ml-serif" style={{ fontStyle: "italic", fontWeight: 400, fontSize: "clamp(1.7rem,3.6vw,2.7rem)", lineHeight: 1.18, margin: "16px 0 0" }}>
                Blush light from the street,<br />gold light from the mirrors,<br />and nothing on the speakers<br />you'd have to talk over.
              </p>
            </div>
            <div style={{ position: "relative", zIndex: 2, padding: "clamp(30px,5vw,64px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-start", gap: 14 }}>
              <div className="ml-hair" style={{ width: 90 }} />
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 300, lineHeight: 1.75, color: "rgba(244,239,233,0.6)", maxWidth: 380 }}>
                One floor, six chairs, two treatment rooms. We book by the hour, not the
                head — your appointment is the only one happening in your mirror.
              </p>
              <Label dim>Grand St × Greene St, second floor</Label>
            </div>
          </div>
        </section>

        {/* ── gift card + membership: two refined panels ────────── */}
        <section style={{ padding: "clamp(80px,11vw,150px) 0 0" }}>
          <div className="ml-rv">
            <Label>N° 04 — Standing Arrangements</Label>
          </div>
          <div className="ml-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, marginTop: 34 }}>
            <div className="ml-rv ml-glass" style={{ padding: "clamp(28px,3.6vw,46px)" }}>
              <div style={{ position: "relative", zIndex: 2 }}>
                <div className="ml-serif" style={{ fontSize: "clamp(1.6rem,2.8vw,2.2rem)", fontStyle: "italic" }}>The Gift Card</div>
                <div className="ml-hair" style={{ margin: "20px 0" }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 300, lineHeight: 1.75, color: "rgba(244,239,233,0.68)" }}>
                  Any amount from $100, issued on paper the weight of an invitation.
                  Redeemable against every ritual in the house, and it never expires —
                  generosity shouldn't have a countdown.
                </p>
                <div className="ml-label" style={{ marginTop: 24 }}>from $100 · never expires</div>
              </div>
            </div>
            <div className="ml-rv ml-glass" style={{ padding: "clamp(28px,3.6vw,46px)", borderColor: "rgba(232,180,184,0.22)" }}>
              <div style={{ position: "relative", zIndex: 2 }}>
                <div className="ml-serif" style={{ fontSize: "clamp(1.6rem,2.8vw,2.2rem)", fontStyle: "italic" }}>La Maison <span style={{ color: "#e8b4b8" }}>Membership</span></div>
                <div className="ml-hair" style={{ margin: "20px 0", background: "linear-gradient(90deg, rgba(232,180,184,0.5), rgba(232,180,184,0.08))" }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 300, lineHeight: 1.75, color: "rgba(244,239,233,0.68)" }}>
                  One ritual a month, priority chairs on Saturdays, and ten percent off
                  everything else your reflection asks for. Pause anytime; loyalty is a
                  choice, not a contract.
                </p>
                <div className="ml-label" style={{ marginTop: 24, color: "rgba(232,180,184,0.9)" }}>$180 / month · pause anytime</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── booking ───────────────────────────────────────────── */}
        <section style={{ padding: "clamp(80px,11vw,150px) 0 0" }}>
          <div className="ml-two" style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: "clamp(26px,5vw,70px)", alignItems: "start" }}>
            <div className="ml-rv">
              <Label>N° 05 — An Appointment</Label>
              <h2 className="ml-serif" style={{ fontStyle: "italic", fontWeight: 400, fontSize: "clamp(2.2rem,5vw,3.6rem)", lineHeight: 1.02, margin: "20px 0 0" }}>
                The chair<br />is patient.<br /><span style={{ color: "#d9c08f" }}>You choose when.</span>
              </h2>
              <p style={{ margin: "22px 0 0", fontSize: 14, fontWeight: 300, lineHeight: 1.75, color: "rgba(244,239,233,0.6)", maxWidth: 380 }}>
                Prefer a voice? Call the maison — the line is answered around the clock,
                and the concierge already knows the book.
              </p>
              <div style={{ marginTop: 18 }}>
                <a href="tel:+12125550186" style={{ textDecoration: "none" }}>
                  <span className="ml-serif" style={{ fontSize: 22, fontStyle: "italic", color: "#f4efe9" }}>(212) 555-0186</span>
                </a>
              </div>
            </div>
            <form className="ml-rv ml-glass" style={{ padding: "clamp(28px,3.6vw,46px)" }} onSubmit={(e) => e.preventDefault()}>
              <div style={{ position: "relative", zIndex: 2, display: "grid", gap: 14 }}>
                <input className="ml-input" type="text" placeholder="Your name" aria-label="Your name" />
                <input className="ml-input" type="tel" placeholder="Phone" aria-label="Phone" />
                <select className="ml-input" defaultValue="" aria-label="Ritual" style={{ appearance: "none" }}>
                  <option value="" disabled>Choose a ritual</option>
                  {SERVICES.map((s) => <option key={s.n} value={s.name}>{s.name} — {s.price}</option>)}
                </select>
                <input className="ml-input" type="text" placeholder="A day and hour that suit you" aria-label="Preferred time" />
                <button className="ml-btn" type="submit">Request the chair</button>
                <div className="ml-label ml-label--dim" style={{ letterSpacing: "0.24em", fontSize: 9.5 }}>
                  This is a demonstration model — requests are not sent.
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* ── house rules ───────────────────────────────────────── */}
        <section style={{ padding: "clamp(70px,10vw,130px) 0 0", textAlign: "center" }}>
          <div className="ml-rv">
            <div className="ml-hair" style={{ maxWidth: 120, margin: "0 auto 26px" }} />
            <p className="ml-serif" style={{ fontStyle: "italic", fontSize: "clamp(1.1rem,2.2vw,1.5rem)", margin: 0, color: "rgba(244,239,233,0.75)" }}>
              House rules: arrive as you are, phones on silent, cancellations forgiven
              once — and the espresso is always on the house.
            </p>
          </div>
        </section>

        {/* ── footer ────────────────────────────────────────────── */}
        <footer style={{ padding: "clamp(70px,9vw,110px) 0 44px" }}>
          <div className="ml-hair" style={{ marginBottom: 28 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
            <div>
              <span className="ml-serif" style={{ fontSize: 18, fontStyle: "italic" }}>Maison <span style={{ color: "#d9c08f" }}>Lume</span></span>
              <span className="ml-label ml-label--dim" style={{ marginLeft: 16 }}>SoHo · Manhattan · (212) 555-0186</span>
            </div>
            <a href="https://www.guileoai.com" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <span className="ml-label" style={{ letterSpacing: "0.24em" }}>Demonstration model · website + AI by Guileo</span>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
