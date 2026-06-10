import { useEffect, useRef, useState } from "react";
import {
  motion, AnimatePresence, useReducedMotion,
  useScroll, useTransform, useSpring, useMotionValue,
} from "framer-motion";

// shared entrance variants
const VARIANTS = {
  up:    { hidden: { opacity: 0, y: 26 },                    show: { opacity: 1, y: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.94 },              show: { opacity: 1, scale: 1 } },
  blur:  { hidden: { opacity: 0, y: 14, filter: "blur(10px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)" } },
  left:  { hidden: { opacity: 0, x: -34 },                   show: { opacity: 1, x: 0 } },
  right: { hidden: { opacity: 0, x: 34 },                    show: { opacity: 1, x: 0 } },
};

// Scroll reveal wrapper — spring entrance with variant
export function Reveal({ children, className = "", delay = 0, variant = "up", amount = 0.18 }) {
  const reduce = useReducedMotion();
  const v = VARIANTS[variant] || VARIANTS.up;
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={v}
      transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.7, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

// Stagger container — children cascade in (use with <Item>)
export function Stagger({ children, className = "", amount = 0.2, gap = 0.08, delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}
export function Item({ children, className = "", variant = "up" }) {
  const v = VARIANTS[variant] || VARIANTS.up;
  return (
    <motion.div className={className} variants={v} transition={{ type: "spring", stiffness: 120, damping: 18, mass: 0.7 }}>
      {children}
    </motion.div>
  );
}

// Magnetic — element drifts toward the cursor (primary CTAs)
export function Magnetic({ children, className = "", strength = 0.35 }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16 });
  const sy = useSpring(y, { stiffness: 220, damping: 16 });
  if (reduce) return <span className={className} style={{ display: "inline-flex" }}>{children}</span>;
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const onLeave = () => { x.set(0); y.set(0); };
  return (
    <motion.span ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ x: sx, y: sy, display: "inline-flex" }} className={className}>
      {children}
    </motion.span>
  );
}

// Parallax — vertical drift tied to scroll position
export function Parallax({ children, className = "", distance = 60 }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return (
    <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>
      {children}
    </motion.div>
  );
}

// Spotlight — soft champagne/green glow that follows the mouse (hero bg)
export function Spotlight() {
  const reduce = useReducedMotion();
  const [p, setP] = useState({ x: 0.72, y: 0.22 });
  useEffect(() => {
    if (reduce) return;
    const h = (e) => setP({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, [reduce]);
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute h-[42rem] w-[42rem] rounded-full blur-[90px] will-change-transform"
        style={{
          left: `${p.x * 100}%`, top: `${p.y * 100}%`,
          transform: "translate(-50%,-50%)", transition: "left .25s ease-out, top .25s ease-out",
          background: "radial-gradient(circle, rgba(214,194,154,0.11), rgba(62,148,104,0.05) 45%, transparent 70%)",
        }} />
    </div>
  );
}

// Scroll progress bar (mount once, top of page)
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const sx = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return (
    <motion.div style={{ scaleX: sx }}
      className="fixed top-0 left-0 right-0 h-[2px] origin-left z-[60] bg-gradient-to-r from-g-green via-g-gold to-g-green" />
  );
}

// Animated counter — counts up when scrolled into view
export function Count({ to, prefix = "", suffix = "", dur = 1400, decimals = 0 }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  // Start AT the value when reduced-motion (never animate from 0) so the number is never $0.
  const [val, setVal] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) { setVal(to); return; }
    const el = ref.current;
    if (!el) return;
    let raf, started = false;
    const finish = () => setVal(to);
    const animate = () => {
      if (started) return; started = true;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        setVal(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick); else finish();
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) animate(); }, { threshold: 0.4 });
    io.observe(el);
    // If the tab is hidden (rAF throttled) or backgrounded, snap to the final value so it never sticks at 0.
    const onVis = () => { if (document.visibilityState === "visible") finish(); };
    document.addEventListener("visibilitychange", onVis);
    const safety = setTimeout(finish, dur + 1200);   // belt-and-suspenders: never leave it at 0
    return () => { io.disconnect(); cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); clearTimeout(safety); };
  }, [to, dur, reduce]);
  const shown = decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString("en-US");
  return <span ref={ref}>{prefix}{shown}{suffix}</span>;
}

// Aurora animated background — discreet green + champagne + cement
export function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
      <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-g-gold/12 blur-3xl animate-aurora" />
      <div className="absolute top-20 right-0 h-[28rem] w-[28rem] rounded-full bg-g-green/10 blur-3xl animate-aurora" style={{ animationDelay: "-6s" }} />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-g-copper/10 blur-3xl animate-aurora" style={{ animationDelay: "-12s" }} />
    </div>
  );
}

// Live results ticker — auto-scrolling feed
export function Ticker({ items }) {
  return (
    <div className="relative overflow-hidden rounded-full border border-g-line bg-white/[0.06] py-2"
      style={{ WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}>
      <div className="flex shrink-0 animate-marquee gap-8 whitespace-nowrap pr-8">
        {[...items, ...items].map((it, i) => (
          <span key={i} className="text-sm font-semibold text-g-word inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-g-green animate-pulse" />{it}
          </span>
        ))}
      </div>
    </div>
  );
}

// Live feed "screen" — a window mockup cycling demo items (what the AI does + result)
export function LiveFeed({ label = "guileo · live", items }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((x) => x + 1), 2400); return () => clearInterval(id); }, []);
  const ordered = items.map((_, i) => items[(i + tick) % items.length]).slice(0, 4);
  return (
    <div className="rounded-xl3 border border-white/15 bg-gradient-to-br from-white/[0.12] to-white/[0.04] backdrop-blur-xl shadow-lift overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/10 bg-white/[0.04]">
        <span className="h-3.5 w-3.5 rounded-full bg-red-400/80" /><span className="h-3.5 w-3.5 rounded-full bg-g-gold/80" /><span className="h-3.5 w-3.5 rounded-full bg-g-green/80" />
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-g-green"><span className="h-2 w-2 rounded-full bg-g-green animate-pulse" />LIVE</span>
      </div>
      {/* big colored uppercase title — client reads what Guileo IS */}
      <div className="px-5 pt-4 pb-1">
        <div className="text-lg sm:text-xl font-black uppercase tracking-tight bg-gradient-to-r from-g-green via-g-gold to-g-green bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">{label}</div>
      </div>
      <div className="p-5 pt-3 space-y-3 min-h-[22rem]">
        <AnimatePresence mode="popLayout" initial={false}>
          {ordered.map((d, i) => (
            <motion.div key={d[1] + (i === 0 ? `-${tick}` : "")} layout
              initial={i === 0 ? { opacity: 0, y: -16, scale: 0.97 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.4 }}
              className={`flex items-center gap-4 rounded-xl2 border p-4 ${i === 0 ? "border-g-green/50 bg-g-green/[0.10] shadow-glow" : "border-white/10 bg-white/[0.05]"}`}>
              <span className="grid place-items-center h-12 w-12 rounded-full bg-white/[0.07] text-2xl shrink-0">{d[0]}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-base font-extrabold text-g-word">{d[1]} <span className="text-g-green font-black">· AI</span></div>
                <div className="text-xs sm:text-sm text-g-muted truncate">{d[2]}</div>
              </div>
              <span className="text-xs text-g-light whitespace-nowrap font-extrabold">{d[3]}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Human + security illustration (inline SVG) — "real humans protect your data"
export function HumanShield({ className = "" }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hs-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4FB07C" /><stop offset="1" stopColor="#D6C29A" />
        </linearGradient>
        <radialGradient id="hs-glow" cx="50%" cy="44%" r="55%">
          <stop offset="0" stopColor="rgba(79,176,124,0.30)" /><stop offset="1" stopColor="rgba(79,176,124,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="96" rx="82" ry="84" fill="url(#hs-glow)" />
      {/* shield */}
      <path d="M100 22 L162 46 V102 C162 142 134 166 100 180 C66 166 38 142 38 102 V46 Z"
        fill="rgba(255,255,255,0.04)" stroke="url(#hs-edge)" strokeWidth="2.5" strokeLinejoin="round">
        <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite" />
      </path>
      {/* person head + shoulders */}
      <circle cx="100" cy="86" r="21" fill="none" stroke="#7FC9A0" strokeWidth="3.5" />
      <path d="M64 138 C64 114 84 105 100 105 C116 105 136 114 136 138" fill="none" stroke="#7FC9A0" strokeWidth="3.5" strokeLinecap="round" />
      {/* verified badge */}
      <circle cx="140" cy="58" r="17" fill="#0B100C" stroke="#D6C29A" strokeWidth="2.5" />
      <path d="M132 58 l6 6 l10 -12" fill="none" stroke="#D6C29A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1">
        <animate attributeName="stroke-dashoffset" from="1" to="0" dur="0.9s" begin="0.4s" fill="freeze" />
      </path>
      {/* circuit accents */}
      <circle cx="50" cy="74" r="2.5" fill="#D6C29A"><animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" /></circle>
      <circle cx="152" cy="124" r="2.5" fill="#4FB07C"><animate attributeName="opacity" values="0.3;1;0.3" dur="2.4s" begin="0.6s" repeatCount="indefinite" /></circle>
      <circle cx="58" cy="128" r="2" fill="#7FC9A0"><animate attributeName="opacity" values="0.2;0.9;0.2" dur="2.8s" begin="1s" repeatCount="indefinite" /></circle>
    </svg>
  );
}

// Products marquee — two rows sliding opposite directions, makes the full offer crystal clear
export function ProductsMarquee({ line, items, sub, cta, ctaHref = "/servicos" }) {
  // Everything Guileo builds — concise inline labels (not i18n) so the marquee
  // reads as a clear product catalog: websites, software, apps + the AI stack.
  const PRODUCTS = items && items.length ? items : [
    ["🌐", "Websites"],
    ["🧩", "Custom software"],
    ["📱", "Apps"],
    ["🛒", "E-commerce"],
    ["📞", "Voice AI"],
    ["💬", "WhatsApp AI"],
    ["📅", "Booking"],
    ["⚙️", "Automations"],
    ["🗂️", "CRM"],
    ["⭐", "Reviews"],
    ["📣", "Ads"],
  ];
  const half = Math.ceil(PRODUCTS.length / 2);
  const rows = [PRODUCTS.slice(0, half), PRODUCTS.slice(half)];
  const Chip = (it, i) => (
    <span key={i} className="group inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-g-word whitespace-nowrap transition-all hover:border-g-gold/45 hover:bg-white/[0.08] hover:-translate-y-0.5">
      <span className="grid place-items-center h-7 w-7 rounded-full bg-white/[0.06] border border-white/10 text-base drop-shadow-[0_0_10px_rgba(214,194,154,0.45)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
        <span className="inline-block animate-floatslow" style={{ animationDelay: `${-(i % 6) * 0.7}s` }}>{it[0]}</span>
      </span>{it[1]}
    </span>
  );
  return (
    <section className="py-14 border-y border-g-line bg-white/[0.02] overflow-hidden">
      <div className="wrap text-center mb-9">
        <span className="eyebrow mb-3">★ Everything we build</span>
        <h2 className="h2 max-w-3xl mx-auto">{line}</h2>
        {sub && <p className="mt-3 text-g-muted max-w-2xl mx-auto">{sub}</p>}
      </div>
      <div className="space-y-3" style={{ WebkitMaskImage: "linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)" }}>
        {rows.map((data, r) => (
          <div key={r} className="flex w-max gap-3 animate-marquee hover:[animation-play-state:paused]" style={r ? { animationDirection: "reverse" } : undefined}>
            {[...data, ...data].map(Chip)}
          </div>
        ))}
      </div>
      {cta && (
        <div className="wrap text-center mt-9">
          <Magnetic><a href={ctaHref} className="btn-gold text-sm">{cta}</a></Magnetic>
        </div>
      )}
    </section>
  );
}

// FAQ accordion — smooth height animation
export function Accordion({ items }) {
  const [open, setOpen] = useState(-1);
  return (
    <div className="max-w-3xl mx-auto divide-y divide-g-line">
      {items.map(([q, a], i) => (
        <div key={q}>
          <button onClick={() => setOpen(open === i ? -1 : i)}
            className="w-full flex justify-between items-center gap-4 py-4 text-left font-bold text-g-word transition-colors hover:text-g-gold">
            <span>{q}</span>
            <span className={`text-g-green text-xl shrink-0 transition-transform duration-300 ${open === i ? "rotate-45" : ""}`}>＋</span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease: "easeInOut" }} className="overflow-hidden">
                <p className="pb-4 text-sm text-g-ink leading-relaxed">{a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// Animated circuit-line divider (nature + tech motif) — discreet green + champagne
export function Circuit({ flip = false }) {
  return (
    <div className={`relative h-12 w-full overflow-hidden ${flip ? "rotate-180" : ""}`} aria-hidden>
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 48">
        <path d="M0 24 H400 L430 6 H560 L590 42 H760 L790 24 H1200" fill="none" stroke="#3E9468" strokeWidth="1.5" strokeOpacity="0.45" strokeDasharray="4 6">
          <animate attributeName="stroke-dashoffset" from="0" to="-100" dur="3s" repeatCount="indefinite" />
        </path>
        {[400, 560, 760, 790].map((x, i) => (
          <circle key={i} cx={x} cy={i % 2 ? 42 : 6} r="3.5" fill="#D6C29A"><animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin={`${i * 0.4}s`} repeatCount="indefinite" /></circle>
        ))}
      </svg>
    </div>
  );
}
