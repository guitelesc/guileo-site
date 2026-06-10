import { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
const GuileoLogo3D = lazy(() => import("../components/GuileoLogo3D.jsx"));
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import Channels from "../components/Channels.jsx";
import LiveCall from "../components/LiveCall.jsx";
import Intro from "../components/Intro.jsx";
import LeadForm from "../components/LeadForm.jsx";
import LiveCallBar from "../components/LiveCallBar.jsx";
import LiveDemo from "../components/LiveDemo.jsx";
import { Reveal, Count, Aurora, Ticker, Circuit, Stagger, Item, Magnetic, Parallax, Spotlight, Accordion, ProductsMarquee, HumanShield, LiveFeed } from "../lib/ui.jsx";
import HeroV2 from "../components/HeroV2";
import ResultsV2 from "../components/ResultsV2";
import LegsV2 from "../components/LegsV2";
import BuildAllV2 from "../components/BuildAllV2";
import EngineV2 from "../components/EngineV2";
import ChannelsV2 from "../components/ChannelsV2";
import MethodV2 from "../components/MethodV2";
import GrowthV2 from "../components/GrowthV2";
import ProofV2 from "../components/ProofV2";
import PricingConfigurator from "../components/PricingConfigurator";
import { AnimatePresence } from "framer-motion";
import logo from "../assets/guileo-mark.png";
import mark from "../assets/guileo-mark.png";
import { TECH, COMPLIANCE, TICKER, CHANNELS, CORE_OFFER, INTEGRATIONS, COMPARISON } from "../data/site";
import { CONTACT, waLink, bookLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";

/* Shared section header — the LegsV2/MethodV2 pattern: mono uppercase champagne eyebrow
   → big font-black headline (one shimmer phrase) → short greige sub. One language everywhere. */
function SectionHead({ eyebrow, h2, sub, className = "mb-10", subMax = "max-w-xl" }) {
  return (
    <Reveal className={`mx-auto max-w-2xl text-center ${className}`}>
      <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{eyebrow}</div>
      <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
        <span className="bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{h2}</span>
      </h2>
      {sub && <p className={`mx-auto mt-4 ${subMax} text-[15px] leading-relaxed text-g-ink`}>{sub}</p>}
    </Reveal>
  );
}

/* Primary CTA — the silver/platinum pill from LegsV2 (the approved primary-CTA language). */
function SilverCta({ href = "#contact", children }) {
  return (
    <a href={href} className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3 text-[14px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
      style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
      <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
      <span className="relative">{children}</span>
      <span className="relative text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
    </a>
  );
}

/* The leak — MULTICHANNEL interactive calculator (WHY) */
function Calculator({ t }) {
  const W = t.why;
  const [contacts, setContacts] = useState(800);
  const [value, setValue] = useState(120);
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done
  // each channel: [icon, label, share of contacts, miss-rate]
  const CFG = [[0.30, 0.35], [0.25, 0.30], [0.20, 0.45], [0.15, 0.50], [0.10, 0.55]];
  const rows = (W.chans || []).map(([ic, label], i) => {
    const [share, miss] = CFG[i] || [0, 0];
    const c = Math.round(contacts * share);
    const m = Math.round(c * miss);
    return { ic, label, miss, lost: m * value, missed: m };
  });
  const lost = rows.reduce((s, r) => s + r.lost, 0);
  const totalMissed = rows.reduce((s, r) => s + r.missed, 0);
  const recovered = Math.round(totalMissed * 0.92) * value;
  const submit = async (e) => {
    e.preventDefault();
    setState("sending");
    const ctx = `Multichannel leak → ${contacts} leads/mo · $${value}/customer · losing $${lost.toLocaleString()}/mo across all channels · recoverable ~$${recovered.toLocaleString()}/mo`;
    try {
      const r = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "leak-calculator", message: ctx }) });
      const d = await r.json().catch(() => ({}));
      setState("done");
      if (!d.stored) window.open(waLink(`${t.more.lead.wamsg}\n${ctx}`), "_blank");
    } catch { setState("done"); window.open(waLink(`${t.more.lead.wamsg}\n${ctx}`), "_blank"); }
  };
  const Slider = ({ label, val, set, min, max, step, fmt, accent }) => (
    <div>
      <div className="flex items-baseline justify-between"><span className="text-sm font-semibold text-g-word">{label}</span><span className={`text-2xl font-extrabold ${accent}`}>{fmt(val)}</span></div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(+e.target.value)} className={`w-full mt-2 ${accent === "text-g-gold" ? "accent-g-gold" : "accent-g-green"}`} />
    </div>
  );
  return (
    <div className="card sm:p-8 grid md:grid-cols-2 gap-8 items-center">
      <div className="space-y-5">
        <Slider label={W.contacts} val={contacts} set={setContacts} min={100} max={5000} step={50} fmt={(v) => v.toLocaleString()} accent="text-g-green" />
        <Slider label={W.value} val={value} set={setValue} min={20} max={3000} step={20} fmt={(v) => "$" + v.toLocaleString()} accent="text-g-gold" />
        {/* per-channel loss thermometers */}
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-6 text-center text-lg shrink-0">{r.ic}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-[11px] mb-1"><span className="font-semibold text-g-word truncate">{r.label}</span><span className="font-bold text-red-400">−${r.lost.toLocaleString()}</span></div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-red-500/80 to-red-400" animate={{ width: `${Math.round(r.miss * 100)}%` }} transition={{ duration: 0.4 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl2 border border-red-500/25 bg-red-500/[0.07] p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-red-400/80">{W.losing}</div>
          <div className="text-4xl font-extrabold text-red-400 drop-shadow-[0_0_18px_rgba(239,68,68,0.3)]">−$<Count to={lost} dur={500} /><span className="text-sm text-red-400/70">/mo</span></div>
          <div className="text-[11px] text-g-muted mt-1">{W.leak}</div>
        </div>
      </div>
      <div className="rounded-xl3 bg-g-deep p-7 text-center relative overflow-hidden">
        <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-g-green/15 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-xs uppercase tracking-widest text-g-light">{W.recover}</div>
          <div className="text-5xl sm:text-6xl font-extrabold mt-1 text-g-light drop-shadow-[0_0_24px_rgba(123,200,124,0.4)]">+$<Count to={recovered} dur={700} /><span className="text-xl text-white/45">/mo</span></div>
          <div className="text-sm text-g-light/80 mt-1 font-semibold">≈ ${(recovered * 12).toLocaleString()}{W.peryear}</div>
          {state !== "done" ? (
            <form onSubmit={submit} className="mt-5 flex flex-col gap-2">
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label={W.email} placeholder={W.email}
                className="rounded-full px-4 py-2.5 text-sm text-g-word bg-white/10 border border-white/15 outline-none focus:border-g-green/60 placeholder:text-white/40" />
              <button disabled={state === "sending"} className="btn-bright text-sm disabled:opacity-70">{state === "sending" ? "…" : W.send}</button>
            </form>
          ) : <div className="mt-5 rounded-full bg-g-green/20 border border-g-green/40 text-g-light px-4 py-2.5 text-sm font-semibold">{W.sent}</div>}
        </div>
      </div>
    </div>
  );
}

/* What — pillars */
// The 3 Guileo engines, physically wired into YOUR BUSINESS — an engineering diagram, not a carousel.
function Pillars({ t }) {
  const items = t.pillars.items;
  const accents = ["#3E9468", "#D6C29A", "#38BDF8"]; // Brain=green · Build=gold · AD=blue
  return (
    <div className="relative">
      {/* 3 engines feeding the business */}
      <Stagger className="grid md:grid-cols-3 gap-5 relative z-10" gap={0.1}>
        {items.map((p, i) => {
          const c = accents[i % 3];
          return (
            <Item key={i} variant="up">
              <div className="card group relative h-full flex flex-col overflow-hidden">
                <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full blur-3xl pointer-events-none animate-aurora" style={{ background: c + "1f", animationDelay: `${-i * 2}s` }} />
                <div className="relative flex items-center gap-3 mb-3">
                  <span className="relative inline-grid place-items-center">
                    <span className="absolute inset-0 rounded-2xl blur-md animate-pulse" style={{ background: c + "33" }} />
                    <span className="relative grid place-items-center h-14 w-14 rounded-2xl bg-white/[0.05] border text-2xl animate-floatslow" style={{ borderColor: c + "55", animationDelay: `${-i}s` }}>{p.icon}</span>
                  </span>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: c }}>{p.tag}</div>
                    <h3 className="text-lg font-extrabold text-g-word leading-tight">{p.name}</h3>
                  </div>
                </div>
                <p className="relative text-sm text-g-muted leading-relaxed">{p.desc}</p>
                <div className="relative mt-3 flex flex-wrap gap-1.5">
                  {p.feats.slice(0, 4).map((f) => (
                    <span key={f} className="rounded-full bg-white/[0.04] border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-g-word transition-all group-hover:border-white/20" style={{ borderColor: undefined }}>{f}</span>
                  ))}
                </div>
                {/* wire node — connects down to the business */}
                <div className="mt-auto pt-5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: c }}>
                  <span className="h-px w-8" style={{ background: `linear-gradient(90deg, transparent, ${c})` }} />
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: c }} />
                  <span className="h-px w-8" style={{ background: `linear-gradient(90deg, ${c}, transparent)` }} />
                </div>
              </div>
            </Item>
          );
        })}
      </Stagger>

      {/* converging flow lines into the hub */}
      <div className="relative mx-auto h-14 w-full max-w-3xl" aria-hidden>
        <svg viewBox="0 0 600 56" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pillflow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3E9468" stopOpacity="0.7" /><stop offset="1" stopColor="#D6C29A" stopOpacity="0.7" /></linearGradient>
          </defs>
          {[100, 300, 500].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 0 C ${x} 30, 300 26, 300 56`} fill="none" stroke="url(#pillflow)" strokeWidth="1.5" strokeDasharray="4 6" />
              <circle r="3" fill={["#3E9468", "#D6C29A", "#38BDF8"][i]}>
                <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${i * 0.5}s`} path={`M${x} 0 C ${x} 30, 300 26, 300 56`} />
              </circle>
            </g>
          ))}
        </svg>
      </div>

      {/* YOUR BUSINESS hub */}
      <div className="relative mx-auto max-w-lg rounded-xl3 border border-g-gold/40 bg-gradient-to-br from-g-gold/[0.12] to-g-green/[0.08] backdrop-blur-xl p-6 text-center shadow-lift overflow-hidden">
        <div className="absolute inset-0 bg-g-gold/5 animate-breathe pointer-events-none" />
        <div className="relative flex items-center justify-center gap-3">
          <span className="text-3xl animate-floatslow">🏢</span>
          <div className="text-left">
            <div className="text-xl font-black uppercase tracking-tight bg-gradient-to-r from-g-gold via-g-word to-g-gold bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">{t.pillars.hub}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-light">{t.pillars.hubsub}</div>
          </div>
        </div>
        <Magnetic><a href="#contact" className="btn-bright mt-5 text-sm">{t.pillars.getcta}</a></Magnetic>
      </div>
    </div>
  );
}

// Small rotating verb under the headline — cycles what Gui DOES, with a fixed "24/7" anchor.
// The 24/7 stays put (it's the promise); only the action swaps, so the eye reads "Gui ___ · 24/7".
function RotatingAction({ words, suffix, wordCls = "font-bold text-g-light", sufCls = "font-black text-g-green" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % words.length), 2100);
    return () => clearInterval(id);
  }, [words.length]);
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="relative inline-grid">
        {/* sizer keeps width = longest word so the 24/7 never jumps */}
        <span className={`col-start-1 row-start-1 invisible ${wordCls}`} aria-hidden>{words.reduce((a, b) => (b.length > a.length ? b : a), "")}</span>
        <motion.span key={i} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className={`col-start-1 row-start-1 ${wordCls}`}>{words[i]}</motion.span>
      </span>
      <span className={sufCls}>· {suffix}</span>
    </span>
  );
}

// Common country dial codes for the discrete hero phone capture (flag + code).
const DIAL_CODES = [["🇺🇸","+1"],["🇧🇷","+55"],["🇵🇹","+351"],["🇪🇸","+34"],["🇬🇧","+44"],["🇲🇽","+52"],["🇦🇷","+54"],["🇨🇦","+1"],["🇮🇳","+91"],["🇦🇺","+61"],["🇩🇪","+49"],["🇫🇷","+33"]];

// What Gui actually DOES with each integration category (keyed by the English group name) — so the
// tool chips aren't just logos: the visitor sees the job Gui does inside them.
// The method as a dated journey: Day 01 → built & live → sales/growth compound.
const STEP_DAYS = [["Day 01", "we study your business"], ["Days 2–7", "built & live for you"], ["Week 2 →", "sales & profit compound"]];

const INTEG_DOES = {
  "Ads & Growth": "Gui launches & optimizes your ad campaigns",
  "E-commerce": "Gui recovers carts & sells right in chat",
  "Messaging & Social": "Gui answers & sells across every inbox",
  "Calendar & CRM": "Gui books appointments & keeps your CRM current",
  "Payments & Ops": "Gui collects payments & automates the busywork",
};

// The living business loop over the plant: capabilities drop IN as seeds (planted),
// results float UP out of the fruits and fade (harvested) — a continuous cycle.
// "Plant → water → fruit → harvest → repeat" — the business logic, made visible.
function PlantCycle({ seeds = [], results = [] }) {
  const seedX = ["8%", "26%", "16%", "34%", "20%", "4%"];
  const resX = ["52%", "70%", "60%", "78%", "46%", "66%"];
  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
      {/* SEEDS — your capabilities, planted */}
      {seeds.map(([ic, tx], i) => (
        <motion.div key={"s" + tx} className="absolute whitespace-nowrap" style={{ left: seedX[i % seedX.length], top: "-4%" }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 0.95, 0.95, 0], y: [0, 120, 220, 300], scale: [0.7, 1, 1, 0.7] }}
          transition={{ duration: 5.2, delay: i * 1.05, repeat: Infinity, repeatDelay: Math.max(1, seeds.length * 0.55), ease: "easeIn" }}>
          <span className="inline-flex items-center gap-1 rounded-full border border-g-green/35 bg-g-green/[0.12] backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-g-light shadow-[0_0_14px_rgba(62,148,104,0.3)]">{ic} {tx}</span>
        </motion.div>
      ))}
      {/* RESULTS — harvested from the fruits, rising and fading */}
      {results.map(([ic, tx], i) => (
        <motion.div key={"r" + tx} className="absolute whitespace-nowrap" style={{ left: resX[i % resX.length], top: "56%" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0, 1, 1, 0], y: [10, -70, -150, -210], scale: [0.65, 1, 1, 0.95] }}
          transition={{ duration: 5.6, delay: 2.2 + i * 0.95, repeat: Infinity, repeatDelay: Math.max(1, results.length * 0.5), ease: "easeOut" }}>
          <span className="inline-flex items-center gap-1 rounded-full border border-g-gold/50 bg-g-gold/[0.16] backdrop-blur-md px-2.5 py-1 text-[11px] font-extrabold text-g-gold shadow-[0_0_18px_rgba(214,194,154,0.35)]">{ic} {tx}</span>
        </motion.div>
      ))}
    </div>
  );
}

// Discrete in-hero "Gui calls you" capture — the killer proof, inline.
// Required: phone (country code + number) and name. Optional: a one-line business description.
// Posts the lead (/api/lead) and triggers the live call (/api/call) — same backend as LiveCallBar.
function HeroCallForm({ t }) {
  const C = t.hero;
  const [cc, setCc] = useState("+1");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [biz, setBiz] = useState("");
  const [st, setSt] = useState("idle"); // idle · calling · done
  const [open, setOpen] = useState(false); // progressive: name + business reveal once they engage
  const submit = async (e) => {
    e.preventDefault();
    setSt("calling");
    const full = `${cc} ${phone}`.trim();
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: full, name, business: biz, source: "hero-call" }) }).catch(() => {});
    try { await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: full, name }) }); } catch { /* noop */ }
    setSt("done");
  };
  if (st === "done") return (
    <div className="mt-6 max-w-md rounded-2xl border border-g-green/40 bg-g-green/[0.1] px-5 py-4 text-sm font-semibold text-g-light">
      📞 {C.callDone || "Calling you now — pick up! Gui is on the line, live."}
    </div>
  );
  const inputCls = "rounded-full border border-white/20 bg-black/25 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted/80 outline-none focus:border-g-green/70 transition";
  return (
    <form onSubmit={submit} onFocusCapture={() => setOpen(true)} className="mt-4 max-w-md grid gap-2">
      <div className="flex gap-2">
        <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label={C.phCountry || "Country code"} className={`${inputCls} pr-2`}>
          {DIAL_CODES.map(([flag, code], i) => <option key={code + i} value={code} className="bg-g-deep text-g-word">{flag} {code}</option>)}
        </select>
        <input required type="tel" value={phone} onFocus={() => setOpen(true)} onChange={(e) => setPhone(e.target.value)} aria-label={C.phPhone || "Phone number"} placeholder={C.phPhone || "Your phone (area + number)"} className={`${inputCls} flex-1`} />
      </div>
      {/* progressive: keep it to ONE line until they engage, then reveal name + business (bulletproof grid-rows height-auto) */}
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="grid gap-2 pt-0.5">
            <input required={open} value={name} onChange={(e) => setName(e.target.value)} aria-label={C.phName || "Your name"} placeholder={C.phName || "Your name"} className={inputCls} />
            <input value={biz} onChange={(e) => setBiz(e.target.value)} aria-label={C.phBiz || "Describe your business"} placeholder={C.phBiz || "Describe your business (optional)"} className={inputCls} />
          </div>
        </div>
      </div>
      <Magnetic>
        <button disabled={st === "calling"} aria-label={C.callBtn || "Call me now — hear Gui live"}
          className="group relative mt-0.5 inline-flex w-auto self-start items-center gap-2 overflow-hidden rounded-full border border-white/50 px-4 py-2 text-sm shadow-[0_3px_14px_rgba(0,0,0,0.4)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-70"
          style={{ background: "linear-gradient(180deg,#fbfbfd 0%,#dfe3e8 42%,#b7bfc8 52%,#dde1e6 70%,#f5f7f9 100%)" }}>
          {/* silver shine sweep */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-[900ms] group-hover:translate-x-full" />
          <img src={mark} alt="" className="relative h-4 w-4 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
          {st === "calling"
            ? <span className="relative font-extrabold text-g-deep">{C.callingBtn || "Calling you…"}</span>
            : <span className="relative inline-flex items-baseline gap-1.5 text-g-deep">
                <span className="font-extrabold">Gui</span>
                <RotatingAction words={C.rotors || ["answers your calls","books","quotes","sells for you","follows up"]} suffix="24/7" wordCls="font-bold text-g-deep" sufCls="font-black text-emerald-700" />
              </span>}
        </button>
      </Magnetic>
      <p className="text-[11px] text-g-muted/90">{C.callsmall || "Enter your number and Gui calls you — hear it live, right now."}</p>
    </form>
  );
}

export default function Home() {
  const { t, lang } = useLang();
  // If the brand intro already played this session (or reduced-motion), paint the hero
  // INSTANTLY — no dark first-frame on reloads/navigations. First-ever visit still gets it.
  const [introDone, setIntroDone] = useState(() => {
    try {
      if (sessionStorage.getItem("guileo_intro_seen")) return true;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true;
    } catch { /* private mode */ }
    return false;
  });
  const [engineActive, setEngineActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setEngineActive((a) => (a + 1) % 4), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="min-h-screen text-g-ink">
      <Intro onDone={() => setIntroDone(true)} />
      <Navbar />

      {/* ── Approved V2 story sections (promoted into the original landing) ── */}
      <HeroV2 />
      <ResultsV2 />
      <LegsV2 />
      <EngineV2 />
      <BuildAllV2 />
      <ChannelsV2 />
      <MethodV2 />
      <GrowthV2 />
      <ProofV2 />

      {/* LIVE LEAD CAPTURE — "Let Gui call you": the product working live + a sales-ready lead */}
      <section id="try" className="relative px-5 py-20">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.10),transparent)]" />
        <SectionHead eyebrow={t.numbers.calleyebrow} h2={t.numbers.callh2} className="mb-8" />
        <LiveCall />
      </section>

      {/* ── Original sales tail kept (pricing → manifesto); prune later ── */}
      {/* PRICING */}
      <section id="pricing" className="wrap py-20">
        <SectionHead eyebrow={t.pricing.eyebrow} h2={t.pricing.h2} sub={t.pricing.sub} className="mb-8" subMax="max-w-2xl" />

        {/* FULL MENU — what Guileo actually sells (not just AI calls). Makes the scope crystal-clear at the close. */}
        <Reveal className="mx-auto mb-10 max-w-4xl">
          <div className="rounded-xl3 border border-g-gold/25 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 sm:p-7 backdrop-blur-sm">
            <div className="text-center text-[12px] font-black uppercase tracking-[0.22em] text-g-gold">{lang === "pt" ? "Tudo isso entra no seu pacote" : "All of this goes into your package"}</div>
            <p className="mx-auto mt-1.5 max-w-xl text-center text-sm text-g-muted">{lang === "pt" ? "Não é só IA. A gente cria, roda e gerencia o seu crescimento inteiro:" : "It's not just AI. We create, run & manage your whole growth:"}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {[["🎬", "Video production", "Produção de vídeo"], ["📣", "Paid ads", "Anúncios pagos"], ["✍️", "Content creation", "Criação de conteúdo"], ["📱", "Social media management", "Gestão de redes sociais"], ["🌐", "Websites", "Sites"], ["📲", "Mobile apps", "Apps"], ["⚙️", "Custom software", "Software sob medida"], ["🤖", "AI automation", "Automação com IA"], ["📞", "Voice AI agents", "Agentes de voz IA"], ["💬", "WhatsApp & SMS AI", "WhatsApp & SMS IA"], ["🛒", "E-commerce / Shopify", "E-commerce / Shopify"], ["📊", "Dashboards & CRM", "Dashboards & CRM"]].map(([ic, en, pt]) => (
                <span key={en} className="group inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-3.5 py-2 text-[13px] font-semibold text-g-word transition-all duration-300 hover:-translate-y-0.5 hover:border-g-green/45 hover:bg-g-green/[0.08] hover:text-g-light">
                  <span className="text-base transition-transform duration-300 group-hover:scale-125">{ic}</span> {lang === "pt" ? pt : en}
                </span>
              ))}
            </div>
            <p className="mt-5 text-center text-[12px] text-g-muted">{lang === "pt" ? <>Você <span className="font-semibold text-g-word">não escolhe módulos soltos</span> — um humano monta o <span className="font-semibold text-g-green">pacote sob medida</span> com o que faz sentido pro seu negócio.</> : <>You <span className="font-semibold text-g-word">don't pick loose modules</span> — a human assembles the <span className="font-semibold text-g-green">tailored package</span> with what actually moves your business.</>}</p>
          </div>
        </Reveal>

        {/* Build-your-package configurator — the interactive close (replaces the old 3-column table) */}
        <Reveal><PricingConfigurator /></Reveal>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          {[["🔌",t.pricing.cap1||"Plugs into your whole stack"],["📞",t.pricing.cap2||"Answers 24/7, any language"],["🚀",t.pricing.cap3||"Live in 7 days"],["🛡️",t.pricing.cap4||"30-day money-back"]].map(([ic,tx])=>(
            <span key={tx} className="inline-flex items-center gap-1.5 rounded-full border border-g-green/25 bg-g-green/[0.06] px-4 py-2 font-bold text-g-light">{ic} {tx}</span>
          ))}
        </div>
      </section>

      {/* COMPARISON — moved below pricing (decide on price, then see why Guileo wins) */}
      <section className="wrap py-20">
        <SectionHead eyebrow={t.more.comp.eyebrow} h2={t.more.comp.h2} sub={t.more.comp.sub} className="mb-3" subMax="max-w-2xl" />
        <p className="text-center text-[11px] text-g-muted mb-7">{lang === "pt" ? "✅ = faz bem · ⚠️ = em parte · ❌ = não faz — " : lang === "es" ? "✅ = lo hace bien · ⚠️ = en parte · ❌ = no lo hace — " : lang === "hi" ? "✅ = अच्छे से करता है · ⚠️ = आंशिक · ❌ = बिल्कुल नहीं — " : "✅ = does it well · ⚠️ = partly · ❌ = not at all — "}<span className="text-g-light">{lang === "pt" ? "olhe a coluna verde, é a Guileo" : lang === "es" ? "mira la columna verde, es Guileo" : lang === "hi" ? "हरे कॉलम को देखें, वही Guileo है" : "scan the green column, that's Guileo"}</span></p>
        <Reveal>
          <div className="overflow-x-auto rounded-xl3 border border-white/15 bg-gradient-to-br from-white/[0.10] to-white/[0.05] backdrop-blur-xl shadow-lift">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr>
                  {t.more.comp.cols.map((c, i) => (
                    <th key={i} className={`p-4 text-left font-extrabold ${i === 1 ? "bg-g-green/15 border-b-2 border-g-green/40 text-g-word rounded-t-xl relative after:absolute after:inset-0 after:rounded-t-xl after:shadow-[inset_0_0_30px_rgba(62,148,104,0.18)] after:animate-glowpulse after:pointer-events-none" : "text-g-muted"}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.more.comp.rows.map((r, i) => (
                  <tr key={i} className="border-t border-g-line transition-colors duration-300 hover:bg-white/[0.04]">
                    {r.map((cell, j) => (
                      <td key={j} className={`p-4 ${j === 0 ? "font-semibold text-g-word" : j === 1 ? "bg-g-green/[0.06] text-center font-bold text-g-light" : "text-center text-g-muted"}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <div className="text-center mt-8"><Magnetic><SilverCta>{t.more.comp.cta}</SilverCta></Magnetic></div>
      </section>

      {/* ACADEMY */}
      <section id="academy" className="wrap pb-20">
        <Reveal>
          <div className="rounded-xl3 bg-gradient-to-tr from-g-gold/10 via-transparent to-g-green/10 bg-[length:200%_200%] animate-shimmer border border-g-line p-8 sm:p-10 flex flex-col md:flex-row items-center gap-6 justify-between">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.academy.eyebrow}</div>
              <h3 className="mt-2 font-black leading-[1.05] tracking-tight text-g-word" style={{ fontSize: "clamp(1.45rem,2.6vw,1.9rem)" }}>{t.academy.h2}</h3>
              <p className="mt-2 text-g-ink text-sm leading-relaxed max-w-xl">{t.academy.sub}</p>
            </div>
            <a href="#contact" className="btn-gold shrink-0">{t.academy.cta}</a>
          </div>
        </Reveal>
      </section>

      {/* CTA + LEAD CAPTURE (moved above FAQ — capture the lead while intent is hot) */}
      <section id="contact" className="wrap py-20 scroll-mt-24">
        <div className="rounded-xl3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 sm:p-12 shadow-lift relative overflow-hidden">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-g-green/15 blur-3xl animate-aurora pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-g-gold/15 blur-3xl animate-aurora pointer-events-none" style={{ animationDelay: "-6s" }} />
          <div className="relative max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.more.lead.title}</div>
              <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
                <span className="bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{t.final.h2}</span>
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-g-ink max-w-xl mx-auto">{t.more.lead.sub}</p>
            </div>
            <div className="mt-7"><LeadForm source="final-cta" /></div>
            <div className="mt-6 flex items-center gap-3 text-xs text-g-muted">
              <div className="h-px flex-1 bg-g-line" />{t.final.sub}<div className="h-px flex-1 bg-g-line" />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a href={waLink(t.more.lead.wamsg)} target="_blank" rel="noopener" className="btn-ghost text-sm">{t.final.wa}</a>
              <a href={bookLink()} target="_blank" rel="noopener" className="btn-ghost text-sm">{t.final.demo}</a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — last, right before the closing manifesto */}
      <section id="faq" className="wrap pb-20">
        <SectionHead eyebrow={t.faq.eyebrow} h2={t.faq.h2} className="mb-8" />
        <Accordion items={t.faq.items} />
        <div className="mt-8 text-center">
          <button onClick={()=>{ const el=document.querySelector("elevenlabs-convai"); const b=el?.shadowRoot?.querySelector("button"); if(b)b.click(); }}
            className="btn-bright inline-flex"><span className="relative flex h-2 w-2 mr-1"><span className="absolute inline-flex h-full w-full rounded-full bg-black/40 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-black/60" /></span>🎙️ {lang === "pt" ? "Ainda tem dúvidas? Fale com nossa IA ao vivo" : lang === "es" ? "¿Aún tienes dudas? Habla con nuestra IA en vivo" : lang === "hi" ? "अब भी सवाल हैं? हमारी लाइव AI से पूछें" : "Still have questions? Ask our live AI"}</button>
        </div>
      </section>

      {/* MANIFESTO — the closing line that sells the dream */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-g-gold/[0.04] to-transparent pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-g-green/10 blur-3xl pointer-events-none animate-breathe" />
        <Reveal variant="scale" className="relative wrap text-center max-w-3xl mx-auto">
          <span className="text-5xl text-g-gold/40 leading-none">“</span>
          <p className="mt-1 text-2xl sm:text-4xl font-black leading-tight tracking-tight bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
            {t.manifesto.quote}
          </p>
          <p className="mt-5 text-sm sm:text-base font-bold text-g-light">{t.manifesto.tag}</p>
          <div className="mt-6 mx-auto h-px w-24 bg-gradient-to-r from-transparent via-g-gold/60 to-transparent" />
          <div className="mt-3 text-xs font-bold uppercase tracking-[0.3em] text-g-muted">Guileo</div>
        </Reveal>
      </section>

      <Footer />
      <VoiceAgent />
    </div>
  );
}
