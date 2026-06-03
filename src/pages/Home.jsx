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
import { Reveal, Count, Aurora, Ticker, Circuit, Stagger, Item, Magnetic, Parallax, Spotlight, Accordion, ProductsMarquee, HumanShield, LiveFeed } from "../lib/ui.jsx";
import { AnimatePresence } from "framer-motion";
import logo from "../assets/guileo-logo.png";
import { TECH, COMPLIANCE, TICKER, CHANNELS, CORE_OFFER, INTEGRATIONS, COMPARISON } from "../data/site";
import { CONTACT, waLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";

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
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={W.email}
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

export default function Home() {
  const { t } = useLang();
  const [introDone, setIntroDone] = useState(false);
  const [engineActive, setEngineActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setEngineActive((a) => (a + 1) % 4), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="min-h-screen text-g-ink">
      <Intro onDone={() => setIntroDone(true)} />
      <Navbar />

      {/* HERO */}
      <section className="relative pt-28 pb-12 overflow-hidden">
        <Aurora />
        <Spotlight />
        <div className="wrap grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial="hide" animate={introDone ? "show" : "hide"} variants={{ show:{ transition:{ staggerChildren:0.14, delayChildren:0.05 } } }}>
            {[
              <span key="e" className="inline-flex items-center gap-2 rounded-full border border-g-green/40 bg-g-green/[0.08] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-g-light shadow-[0_0_28px_rgba(62,148,104,0.28)] mb-5 backdrop-blur-md">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-g-green/60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" /></span>{t.hero.eyebrow}
              </span>,
              <h1 key="h" className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.98] tracking-tight">
                <span className="block text-g-word">{t.hero.h1a}</span>
                <span className="block bg-gradient-to-r from-g-green via-g-gold to-g-green bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer drop-shadow-[0_0_45px_rgba(214,194,154,0.45)]">{t.hero.h1b}</span>
                <span className="block text-g-word">{t.hero.h1c}</span>
              </h1>,
              <p key="p" className="mt-6 text-lg text-g-muted max-w-xl leading-relaxed">{t.hero.sub_a}<b className="text-g-word">{t.hero.sub_b}</b>{t.hero.sub_c}</p>,
              <div key="trust" className="mt-5 flex flex-wrap gap-2">
                {t.hero.trust.map(([ic,tx])=>(<span key={tx} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-g-word hover:border-g-green/40 hover:text-g-light transition-colors">{ic} {tx}</span>))}
              </div>,
              <div key="b" className="mt-7 flex flex-wrap items-center gap-3"><Magnetic><a href="#why" className="btn">{t.hero.cta1}</a></Magnetic><a href="#contact" className="btn-ghost">{t.hero.cta2}</a><a href="/experience.html" className="inline-flex items-center gap-1.5 text-sm font-bold text-g-gold hover:gap-2.5 transition-all">▶ Watch the experience</a></div>,
            ].map((el,i)=>(
              <motion.div key={i} variants={{ hide:{ opacity:0, y:30, filter:"blur(8px)" }, show:{ opacity:1, y:0, filter:"blur(0px)", transition:{ type:"spring", stiffness:80, damping:18, mass:0.8 } } }}>{el}</motion.div>
            ))}
          </motion.div>
          <Parallax distance={40} className="relative h-[340px] sm:h-[440px] lg:h-[500px]">
            <motion.div className="absolute inset-0" initial={{ opacity:0, scale:0.88 }} animate={introDone ? { opacity:1, scale:1 } : { opacity:0, scale:0.88 }} transition={{ duration:1, delay:0.25, ease:[0.22,1,0.36,1] }}>
            <div className="absolute inset-6 rounded-full bg-gradient-to-tr from-g-green/20 via-transparent to-g-gold/25 blur-3xl pointer-events-none animate-breathe" />
            <div className="absolute inset-0 rounded-full border border-g-gold/10 pointer-events-none animate-aurora" />
            <Suspense fallback={<div className="w-full h-full grid place-items-center"><img src={logo} alt="Guileo" className="h-32 w-32 object-contain opacity-50 animate-floaty"/></div>}>
              <GuileoLogo3D />
            </Suspense>
            </motion.div>
            <div className="absolute top-3 right-3 rounded-full bg-white/[0.05] backdrop-blur-md shadow-soft px-3 py-1.5 text-xs font-bold text-g-light z-10 pointer-events-none animate-floatslow"><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse"/>{t.hero.b1}</span></div>
            <div className="absolute bottom-3 left-3 rounded-full bg-white/[0.05] backdrop-blur-md shadow-soft px-3 py-1.5 text-xs font-bold text-g-gold z-10 pointer-events-none animate-floatslow" style={{ animationDelay:"-3.5s" }}>{t.hero.b2}</div>
            {/* the fruits = results (the harvest) */}
            {introDone && [["💰","$3k saved/mo","top-[10%] left-[1%]"],["📈","3× sales","top-[28%] right-[1%]"],["🛒","2 stores","top-[3%] right-[16%]"],["📅","+40 bookings","top-[48%] left-[2%]"]].map(([ic,tx,pos],i)=>(
              <motion.div key={tx} initial={{ opacity:0, scale:0.5, y:10 }} animate={{ opacity:1, scale:1, y:0 }} transition={{ delay:1.1+i*0.28, type:"spring", stiffness:150, damping:13 }}
                className={`absolute ${pos} z-20 pointer-events-none animate-floatslow`} style={{ animationDelay:`${-i*1.3}s` }}>
                <span className="inline-flex items-center gap-1 rounded-full border border-g-gold/45 bg-g-gold/[0.15] backdrop-blur-md px-2.5 py-1 text-[11px] font-extrabold text-g-gold shadow-[0_0_18px_rgba(214,194,154,0.3)]">{ic} {tx}</span>
              </motion.div>
            ))}
          </Parallax>
        </div>
        <div className="wrap mt-10"><Ticker items={TICKER} /></div>
      </section>

      {/* INDUSTRIES — who we serve (moved up: identify first) */}
      <section id="industries" className="py-12 bg-white/[0.035] overflow-hidden">
        <div className="wrap text-center mb-8">
          <span className="eyebrow mb-3">{t.industries.eyebrow}</span>
          <h2 className="h2">{t.industries.h2}</h2>
          <p className="mt-2 text-g-muted max-w-2xl mx-auto">{t.industries.sub}</p>
        </div>
        <div className="group relative flex w-full" style={{ WebkitMaskImage:"linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
          <div className="flex shrink-0 animate-marquee gap-3 pr-3 group-hover:[animation-play-state:paused]">
            {[...t.indList,...t.indList].map(([i,tt],idx)=><span key={idx} className="whitespace-nowrap rounded-full border border-g-line bg-white/[0.05] backdrop-blur-md px-4 py-2 text-sm font-semibold text-g-word hover:border-g-gold/40 hover:text-g-gold transition-colors">{i} {tt}</span>)}
          </div>
        </div>
      </section>

      <Circuit />

      {/* ADVANTAGES — why us, in plain customer language (no competitor names) */}
      <section className="wrap py-12">
        <Reveal className="text-center max-w-3xl mx-auto mb-10">
          <span className="eyebrow mb-3">{t.more.adv.eyebrow}</span>
          <h2 className="h2">{t.more.adv.line}</h2>
        </Reveal>
        <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6" gap={0.08}>
          {t.more.adv.items.map(([icon, title, pre, num, suf, sub], idx) => (
            <Item key={title} variant="scale">
              <div className="card group h-full relative overflow-hidden">
                <div className={`absolute -top-16 ${idx % 2 ? "-left-12" : "-right-12"} h-44 w-44 rounded-full blur-3xl pointer-events-none animate-aurora ${idx % 2 ? "bg-g-green/10" : "bg-g-gold/10"}`} style={{ animationDelay: `${-idx * 2}s` }} />
                <div className="relative flex items-center gap-4">
                  <div className="relative inline-grid place-items-center shrink-0">
                    <span className={`absolute inset-0 rounded-2xl blur-md animate-pulse ${idx % 2 ? "bg-g-green/20" : "bg-g-gold/20"}`} />
                    <span className="relative grid place-items-center h-14 w-14 rounded-2xl bg-white/[0.05] border border-white/10 text-2xl animate-floatslow transition-transform duration-300 group-hover:scale-110" style={{ animationDelay: `${-idx}s` }}>{icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-g-word leading-tight">{title}</h3>
                    <div className="text-3xl font-extrabold text-g-light leading-none mt-1 tracking-tight"><Count to={num} prefix={pre} suffix={suf} /></div>
                    <div className="text-[11px] text-g-muted mt-0.5 leading-snug">{sub}</div>
                  </div>
                </div>
              </div>
            </Item>
          ))}
        </Stagger>
        <p className="text-center text-sm text-g-muted mt-8">{t.more.coreSupport}</p>
      </section>

      {/* Compact "AI calls you" bar — high-intent touchpoint */}
      <LiveCallBar source="bar-after-offer" />

      {/* WHY */}
      <section id="why" className="wrap py-12">
        <Reveal className="text-center max-w-2xl mx-auto mb-8">
          <span className="eyebrow mb-3">{t.why.eyebrow}</span>
          <h2 className="h2">{t.why.h2}</h2>
          <p className="mt-3 text-g-muted">{t.why.sub}</p>
        </Reveal>
        <Reveal><Calculator t={t} /></Reveal>
      </section>

      {/* FLYWHEEL */}
      <section id="engine" className="bg-white/[0.05] backdrop-blur-md border-y border-g-line py-14">
        <div className="wrap">
          <Reveal className="text-center max-w-2xl mx-auto mb-10">
            <span className="eyebrow mb-3">{t.engine.eyebrow}</span>
            <h2 className="h2">{t.engine.h2}</h2>
            <p className="mt-3 text-g-muted">{t.engine.sub_a}<b className="text-g-word">{t.engine.sub_b}</b>{t.engine.sub_c}</p>
          </Reveal>

          {/* the engine — a flywheel that visibly spins */}
          <Reveal className="flex justify-center mb-9">
            <div className="relative h-48 w-48">
              <svg viewBox="0 0 200 200" className="absolute inset-0 animate-spin" style={{ animationDuration:"18s" }} aria-hidden>
                <circle cx="100" cy="100" r="88" fill="none" stroke="#C2A878" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
              </svg>
              <svg viewBox="0 0 200 200" className="absolute inset-0 animate-spin" style={{ animationDuration:"9s", animationDirection:"reverse" }} aria-hidden>
                <defs><linearGradient id="fw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3E9468" /><stop offset="1" stopColor="#D6C29A" /></linearGradient></defs>
                <circle cx="100" cy="100" r="72" fill="none" stroke="url(#fw)" strokeWidth="3" strokeDasharray="130 320" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-3xl animate-spin" style={{ animationDuration:"7s" }}>♻️</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-g-gold mt-1">Engine</div>
                </div>
              </div>
              {["📞","🧠","📣","💰"].map((e,i)=>{ const a=(i/4)*2*Math.PI - Math.PI/2; const x=100+80*Math.cos(a); const y=100+80*Math.sin(a); return (
                <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-full bg-g-cream border border-g-gold/30 text-base shadow-soft animate-pulse" style={{ left:`${x/2}%`, top:`${y/2}%`, animationDelay:`${i*0.5}s` }}>{e}</div>
              ); })}
            </div>
          </Reveal>

          <div className="relative">
            <Stagger className="grid md:grid-cols-4 gap-4 relative" gap={0.14}>
              {t.engine.steps.map(([i,tt,d],idx)=>{ const on = engineActive===idx; return (
                <Item key={idx} variant="up">
                  <div className={`card group h-full relative transition-all duration-500 ${on ? "ring-2 ring-g-gold/60 shadow-gold -translate-y-1.5 bg-white/[0.07]" : ""}`}>
                    <div className={`absolute -top-3 -left-3 grid place-items-center h-8 w-8 rounded-full text-sm font-extrabold shadow-gold transition-all duration-500 ${on ? "bg-g-gold text-black scale-110" : "bg-g-gold/70 text-black"}`}>{idx+1}</div>
                    <div className={`text-4xl mb-3 transition-transform duration-500 ${on ? "scale-110" : "group-hover:scale-110"}`}>{i}</div>
                    <h3 className="font-bold text-g-word">{tt}</h3>
                    <p className="mt-2 text-sm text-g-muted leading-relaxed">{d}</p>
                    {idx<3 && <div className={`hidden md:block absolute top-1/2 -right-5 text-2xl transition-colors duration-500 ${on ? "text-g-gold animate-pulse" : "text-g-gold/40"}`}>→</div>}
                  </div>
                </Item>
              ); })}
            </Stagger>
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-g-muted">
            <span className="h-2 w-2 rounded-full bg-g-green animate-pulse" />{t.engine.loop}
          </div>
        </div>
      </section>

      {/* NUMBERS */}
      <section id="results" className="bg-g-deep text-white py-14 relative overflow-hidden">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-g-green/20 blur-3xl animate-aurora" />
        <div className="wrap relative grid lg:grid-cols-[0.82fr_1.18fr] gap-10 items-center">
          {/* left — narrative */}
          <Reveal variant="left">
            <span className="eyebrow mb-4">{t.numbers.eyebrow}</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight bg-gradient-to-r from-white via-g-gold to-white bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{t.numbers.h2}</h2>
            <p className="mt-4 text-white/70 leading-relaxed">{t.more.numbersMission}</p>
            {/* the loss → gain contrast (red = what you lose without us) */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl2 border border-red-500/25 bg-red-500/[0.07] p-3">
                <div className="text-[11px] uppercase tracking-wide text-red-400/80 font-bold">Without Guileo</div>
                <div className="text-2xl font-extrabold text-red-400 drop-shadow-[0_0_14px_rgba(239,68,68,0.25)]">−$300k<span className="text-sm">/yr</span></div>
                <div className="text-[11px] text-white/50">35% of calls lost</div>
              </div>
              <div className="rounded-xl2 border border-g-green/30 bg-g-green/[0.08] p-3">
                <div className="text-[11px] uppercase tracking-wide text-g-light font-bold">With Guileo</div>
                <div className="text-2xl font-extrabold text-g-light drop-shadow-[0_0_14px_rgba(123,200,124,0.3)]">+$300k<span className="text-sm">/yr</span></div>
                <div className="text-[11px] text-white/50">recovered & growing</div>
              </div>
            </div>
          </Reveal>

          {/* right — live dashboard panel */}
          <Reveal variant="right">
            <div className="rounded-xl3 border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-lift overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.03]">
                <span className="h-3 w-3 rounded-full bg-red-400/70" /><span className="h-3 w-3 rounded-full bg-g-gold/70" /><span className="h-3 w-3 rounded-full bg-g-green/70" />
                <span className="ml-2 text-xs font-semibold text-white/45 tracking-wide">guileo · live results</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-g-light"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />live</span>
              </div>
              <Stagger className="grid grid-cols-2 sm:grid-cols-3" gap={0.07}>
                {[["💰","$",15000,"+"],["📞","",0,""],["📈","+",286,"%"],["⚡","",3.2,"x"],["🎯","-",40,"%"],["📅","+",40,"%"]].map(([icon,pre,val,suf],idx)=>(
                  <Item key={idx} variant="up">
                    <div className="group h-full p-5 border-b border-r border-white/[0.06] transition-colors duration-300 hover:bg-white/[0.05]">
                      <div className="flex items-center gap-1.5 text-base mb-2">{icon}</div>
                      <div className="text-3xl sm:text-4xl font-extrabold text-sky-400 leading-none tracking-tight drop-shadow-[0_0_16px_rgba(56,189,248,0.35)]">
                        <Count to={val} prefix={pre} suffix={suf} decimals={String(val).includes(".")?1:0} />
                      </div>
                      <div className="mt-1.5 font-bold text-white text-sm">{t.numbers.stats[idx][3]}</div>
                      <div className="text-[11px] text-white/45 mt-0.5 leading-snug">{t.numbers.stats[idx][4]}</div>
                    </div>
                  </Item>
                ))}
              </Stagger>
            </div>
          </Reveal>
        </div>
        <div className="wrap relative mt-12"><LiveCall /></div>
      </section>

      <Circuit flip />

      {/* RESULTS CHARTS — growth you can see */}
      <section className="wrap py-14">
        <Reveal className="text-center max-w-2xl mx-auto mb-10">
          <span className="eyebrow mb-3">{t.more.charts.eyebrow}</span>
          <h2 className="h2">{t.more.charts.title}</h2>
        </Reveal>
        <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5" gap={0.1}>
          {t.more.charts.rows.map(([ic,label,pct,res],i)=>(
            <Item key={label} variant="scale">
              <div className="card text-center h-full">
                <div className="h-24 grid place-items-center mb-3">
                  {i===0 && (
                    <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                      <defs><linearGradient id="lc" x1="0" x2="1"><stop offset="0" stopColor="#3E9468"/><stop offset="1" stopColor="#38BDF8"/></linearGradient></defs>
                      <motion.polyline fill="none" stroke="url(#lc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points="3,46 23,38 43,29 63,18 83,9 97,3"
                        initial={{ pathLength:0 }} whileInView={{ pathLength:1 }} viewport={{ once:true }} transition={{ duration:1.4, ease:"easeInOut" }} />
                    </svg>
                  )}
                  {i===1 && (
                    <svg viewBox="0 0 44 44" className="h-20 w-20 -rotate-90">
                      <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5"/>
                      <motion.circle cx="22" cy="22" r="17" fill="none" stroke="#38BDF8" strokeWidth="5" strokeLinecap="round" strokeDasharray={2*Math.PI*17}
                        initial={{ strokeDashoffset:2*Math.PI*17 }} whileInView={{ strokeDashoffset:2*Math.PI*17*(1-pct/100) }} viewport={{ once:true }} transition={{ duration:1.4, ease:"easeOut" }} />
                    </svg>
                  )}
                  {i===2 && (
                    <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                      <motion.polyline fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points="3,6 23,13 43,21 63,29 83,38 97,45"
                        initial={{ pathLength:0 }} whileInView={{ pathLength:1 }} viewport={{ once:true }} transition={{ duration:1.4, ease:"easeInOut" }} />
                    </svg>
                  )}
                  {i===3 && (
                    <svg viewBox="0 0 100 50" className="w-full h-full">
                      {[22,34,28,44,40].map((h,j)=>(
                        <motion.rect key={j} x={6+j*19} width="13" rx="2.5" fill="#38BDF8" initial={{ height:0, y:48 }} whileInView={{ height:h, y:48-h }} viewport={{ once:true }} transition={{ duration:0.7, delay:j*0.1 }} />
                      ))}
                    </svg>
                  )}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-sky-400 drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]">{res}</div>
                <div className="text-xs font-semibold text-g-word mt-1">{ic} {label}</div>
              </div>
            </Item>
          ))}
        </Stagger>
      </section>

      {/* PILLARS */}
      <section id="pillars" className="wrap py-14">
        <Reveal className="text-center max-w-2xl mx-auto mb-8">
          <span className="eyebrow mb-3">{t.pillars.eyebrow}</span>
          <h2 className="h2">{t.pillars.h2}</h2>
          <p className="mt-3 text-g-muted">{t.pillars.sub}</p>
        </Reveal>

        {/* The 3 Guileo engines wired into your business */}
        <Reveal><Pillars t={t} /></Reveal>

      </section>

      {/* CHANNELS — real brand icons (phone mockup) */}
      <Channels t={t} />

      {/* INTEGRATIONS — works with what you already use */}
      <section className="wrap py-14">
        <Reveal className="text-center max-w-2xl mx-auto mb-10">
          <span className="eyebrow mb-3">{t.more.integ.eyebrow}</span>
          <h2 className="h2">{t.more.integ.h2}</h2>
          <p className="mt-3 text-g-muted">{t.more.integ.sub}</p>
        </Reveal>
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* live demo screen — what the AI does inside your tools */}
          <Reveal variant="left">
            <LiveFeed label="guileo · working inside your tools" items={[
              ["🛒","Shopify","Recovered $1,240 in abandoned carts","now"],
              ["📘","Meta Ads","Cut cost per lead by −40%","2m"],
              ["📅","Calendar","Booked 38 appointments this week","5m"],
              ["🟠","HubSpot","Auto-updated 210 CRM contacts","8m"],
              ["💳","Stripe","Collected $4,200 in payments","11m"],
              ["📸","Instagram","Replied & sold a product in DMs","14m"],
            ]} />
          </Reveal>
          {/* the stack groups */}
          <Stagger className="grid sm:grid-cols-2 gap-4" gap={0.07}>
            {INTEGRATIONS.map((g, gi) => (
              <Item key={g.group} variant="up">
                <div className="card h-full">
                  <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{t.more.integGroups[gi] || g.group}</div>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((it) => (
                      <span key={it} className="rounded-full bg-white/[0.035] border border-g-line px-3 py-1.5 text-xs font-semibold text-g-word hover:border-g-gold/50 hover:text-g-gold hover:-translate-y-0.5 transition-all cursor-default">{it}</span>
                    ))}
                  </div>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
        <p className="text-center text-sm text-g-muted mt-6">{t.more.integ.ask} <a href="#contact" className="text-g-gold font-semibold hover:underline">{t.more.integ.asklink}</a></p>
      </section>

      {/* RESULT CYCLE — separated, highlighted band (the payoff of the whole engine) */}
      <section className="relative py-16 border-y border-g-gold/20 bg-gradient-to-b from-transparent via-g-gold/[0.05] to-transparent overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-g-green/10 blur-3xl pointer-events-none animate-breathe" />
        <Reveal variant="scale" className="relative wrap">
          <div className="mx-auto max-w-2xl rounded-xl3 border border-g-gold/35 bg-white/[0.04] backdrop-blur-xl p-8 sm:p-14 text-center shadow-lift relative overflow-hidden">
            <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-g-gold/10 blur-3xl pointer-events-none animate-aurora" />
            <div className="relative text-base sm:text-lg font-extrabold uppercase tracking-[0.2em] text-g-gold mb-8">{t.pillars.result}</div>
            <div className="relative h-72 w-72 sm:h-80 sm:w-80 mx-auto">
              <svg viewBox="0 0 200 200" className="absolute inset-0 animate-spin" style={{ animationDuration:"16s" }} aria-hidden>
                <circle cx="100" cy="100" r="82" fill="none" stroke="#C2A878" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 8" />
              </svg>
              <svg viewBox="0 0 200 200" className="absolute inset-0 animate-spin" style={{ animationDuration:"8s", animationDirection:"reverse" }} aria-hidden>
                <defs><linearGradient id="psg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3E9468" /><stop offset="1" stopColor="#D6C29A" /></linearGradient></defs>
                <circle cx="100" cy="100" r="66" fill="none" stroke="url(#psg)" strokeWidth="3.5" strokeDasharray="100 250" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div><div className="text-4xl animate-spin" style={{ animationDuration:"6s" }}>⚙️</div><div className="text-xs font-bold uppercase tracking-[0.25em] text-g-gold mt-2">Method</div></div>
              </div>
              {[["📈","Performance"],["💰","Sales"],["🚀","Growth"]].map(([ic,lb],i)=>{ const a=(i/3)*2*Math.PI - Math.PI/2; const x=100+78*Math.cos(a); const y=100+78*Math.sin(a); const on=engineActive%3===i; return (
                <div key={lb} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-all duration-500 ${on?"scale-110":"scale-100 opacity-80"}`} style={{ left:`${x/2}%`, top:`${y/2}%` }}>
                  <span className={`grid place-items-center h-14 w-14 rounded-full border text-2xl transition-all duration-500 ${on?"border-g-gold/60 bg-g-gold/15 shadow-gold":"border-white/15 bg-white/[0.05]"}`}>{ic}</span>
                  <span className="text-xs font-bold text-g-word whitespace-nowrap">{lb}</span>
                </div>
              ); })}
            </div>

            {/* the sequence beneath — Performance → Sales → Growth (like the method) */}
            <div className="relative mt-10 flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
              {[["📈","Performance"],["💰","Sales"],["🚀","Growth"]].map(([ic,lb],i)=>{ const on=engineActive%3===i; return (
                <div key={lb} className="flex items-center gap-2 sm:gap-3">
                  <div className={`flex items-center gap-2 rounded-full border px-3.5 sm:px-5 py-2.5 transition-all duration-500 ${on?"border-g-gold/60 bg-g-gold/15 scale-105 shadow-gold":"border-white/12 bg-white/[0.04]"}`}>
                    <span className="text-lg">{ic}</span><span className="text-sm font-extrabold text-g-word whitespace-nowrap">{lb}</span>
                  </div>
                  {i < 2 && <span className="text-g-gold font-black text-lg">→</span>}
                </div>
              ); })}
            </div>
          </div>
        </Reveal>
      </section>

      {/* PRODUCTS — what we build (moved down: after they identify their industry) */}
      <ProductsMarquee line={t.more.products.line} items={t.more.products.items} sub={t.more.products.sub} cta={t.more.products.cta} ctaHref="/servicos" />

      {/* STEPS */}
      <section id="how" className="wrap py-14">
        <Reveal className="text-center max-w-2xl mx-auto mb-9">
          <span className="eyebrow mb-3">{t.steps.eyebrow}</span>
          <h2 className="h2">{t.steps.h2}</h2>
          {t.steps.sub && <p className="mt-3 text-g-muted">{t.steps.sub}</p>}
        </Reveal>
        {/* growth scene: seed → sprout → tree, with a growing connector */}
        <div className="relative">
          <svg className="hidden md:block absolute top-12 left-0 w-full h-2 -z-0" viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden>
            <motion.line x1="120" y1="4" x2="880" y2="4" stroke="#3E9468" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round"
              initial={{ pathLength:0 }} whileInView={{ pathLength:1 }} viewport={{ once:true }} transition={{ duration:1.8, ease:"easeInOut" }} />
          </svg>
          <Stagger className="grid md:grid-cols-3 gap-6 relative" gap={0.2}>
            {t.steps.items.map(([i,tt,d],idx)=>(
              <Item key={idx} variant="up"><div className="card group text-center relative overflow-hidden">
                <div className={`absolute -top-12 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full blur-3xl pointer-events-none animate-aurora ${idx===2?"bg-g-gold/15":"bg-g-green/12"}`} style={{ animationDelay:`${-idx*3}s` }} />
                <div className="relative">
                  <div className="text-6xl mb-3 animate-floatslow transition-transform duration-300 group-hover:scale-110" style={{ animationDelay:`${-idx}s` }}>{i}</div>
                  <div className="grid place-items-center h-9 w-9 mx-auto rounded-full border-2 border-g-green/50 bg-g-green/15 text-g-light font-extrabold mb-3 shadow-glow transition-transform duration-300 group-hover:scale-110">{idx+1}</div>
                  <h3 className="font-extrabold text-g-word text-lg">{tt}</h3>
                  <p className="mt-2 text-sm text-g-muted leading-relaxed">{d}</p>
                </div>
              </div></Item>
            ))}
          </Stagger>
        </div>
      </section>

      {/* PROOF — trust: human + security (super important) */}
      <section className="relative bg-white/[0.05] backdrop-blur-md border-y border-g-line py-16 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-72 w-[42rem] rounded-full bg-g-green/10 blur-3xl pointer-events-none" />
        <div className="wrap relative">
          <Reveal className="text-center mb-9"><span className="eyebrow mb-3">{t.proof.eyebrow}</span><h2 className="h2">{t.proof.h2}</h2></Reveal>

          {/* GUARANTEE SEALS — the trust medallions */}
          <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10" gap={0.08}>
            {t.proof.seals.map(([ic,title,sub])=>(
              <Item key={title} variant="scale">
                <div className="group h-full rounded-xl2 border border-g-gold/25 bg-gradient-to-b from-g-gold/[0.08] via-white/[0.02] to-transparent p-5 text-center transition-all duration-300 hover:border-g-gold/50 hover:-translate-y-1">
                  <div className="relative mx-auto mb-3 grid place-items-center h-16 w-16 rounded-full border-2 border-g-gold/40 bg-g-gold/10 text-3xl shadow-[0_0_24px_rgba(214,194,154,0.25)] transition-transform duration-300 group-hover:scale-110">
                    {ic}
                    <span className="absolute inset-0 rounded-full border border-g-gold/20 animate-aurora pointer-events-none" />
                  </div>
                  <div className="font-extrabold text-g-word text-sm leading-tight">{title}</div>
                  <div className="text-[11px] text-g-muted mt-1">{sub}</div>
                </div>
              </Item>
            ))}
          </Stagger>

          {/* tech = quality SEAL medallions · compliance = shield badges */}
          <div className="text-center text-xs font-bold uppercase tracking-widest text-g-muted mb-4">{t.proof.poweredby}</div>
          <Stagger className="flex flex-wrap items-center justify-center gap-4 mb-6" gap={0.05} amount={0.2}>
            {TECH.map(x=>(
              <Item key={x} variant="scale">
                <div className="group grid place-items-center gap-1.5 text-center">
                  <span className="relative grid place-items-center h-16 w-16 rounded-full border-2 border-g-gold/35 bg-gradient-to-b from-g-gold/[0.12] to-white/[0.02] text-xl font-extrabold text-g-gold shadow-[0_0_22px_rgba(214,194,154,0.2)] transition-transform duration-300 group-hover:scale-110">
                    {x[0]}
                    <span className="absolute inset-1 rounded-full border border-g-gold/15 animate-aurora pointer-events-none" />
                  </span>
                  <span className="text-[11px] font-semibold text-g-word">{x}</span>
                </div>
              </Item>
            ))}
          </Stagger>
          <div className="text-center text-xs font-bold uppercase tracking-widest text-g-muted mb-4">{t.proof.compliant}</div>
          <Stagger className="flex flex-wrap items-center justify-center gap-3" gap={0.05} amount={0.2}>
            {COMPLIANCE.map(x=>(
              <Item key={x} variant="scale">
                <div className="inline-flex items-center gap-2 rounded-xl2 border border-g-green/35 bg-g-green/[0.08] px-4 py-2.5 shadow-glow">
                  <span className="text-lg">🛡️</span><span className="text-sm font-extrabold text-g-light">{x}</span><span className="text-g-green text-sm">✓</span>
                </div>
              </Item>
            ))}
          </Stagger>

          <div className="grid md:grid-cols-2 gap-6 mt-10 items-stretch">
            {/* Real humans — featured with illustration */}
            <Reveal variant="left">
              <div className="card group relative overflow-hidden h-full flex flex-col sm:flex-row items-center gap-5">
                <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-g-green/15 blur-3xl pointer-events-none animate-aurora" />
                <HumanShield className="relative h-32 w-32 shrink-0 drop-shadow-[0_0_24px_rgba(79,176,124,0.25)] transition-transform duration-500 group-hover:scale-105" />
                <div className="relative text-center sm:text-left">
                  <h3 className="font-extrabold text-g-word text-lg">{t.proof.ally_t}</h3>
                  <p className="mt-2 text-sm text-g-muted leading-relaxed">{t.proof.ally_d}</p>
                </div>
              </div>
            </Reveal>
            {/* Security & consent */}
            <Reveal variant="right">
              <div className="card group relative overflow-hidden h-full">
                <div className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-g-gold/12 blur-3xl pointer-events-none animate-aurora" style={{ animationDelay:"-7s" }} />
                <div className="relative">
                  <span className="grid place-items-center h-14 w-14 rounded-2xl bg-g-green/10 border border-g-green/25 text-2xl mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">🔒</span>
                  <h3 className="font-extrabold text-g-word text-lg">{t.proof.sec_t}</h3>
                  <p className="mt-2 text-sm text-g-muted leading-relaxed">{t.proof.sec_d}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {COMPLIANCE.map(x=><span key={x} className="rounded-md bg-white/[0.04] border border-white/10 px-2 py-1 text-[11px] font-bold text-g-light">{x}</span>)}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* COMPARISON — the obvious choice */}
      <section className="wrap py-14">
        <Reveal className="text-center max-w-2xl mx-auto mb-10">
          <span className="eyebrow mb-3">{t.more.comp.eyebrow}</span>
          <h2 className="h2">{t.more.comp.h2}</h2>
          <p className="mt-3 text-g-muted">{t.more.comp.sub}</p>
        </Reveal>
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
                  <tr key={i} className="border-t border-g-line">
                    {r.map((cell, j) => (
                      <td key={j} className={`p-4 ${j === 0 ? "font-semibold text-g-word" : j === 1 ? "bg-g-green/[0.06] text-center font-bold text-g-light" : "text-center text-g-muted"}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <div className="text-center mt-8"><Magnetic><a href="#contact" className="btn">{t.more.comp.cta}</a></Magnetic></div>
      </section>

      {/* Compact "AI calls you" bar — decision moment before pricing */}
      <LiveCallBar source="bar-before-pricing" />

      {/* PRICING */}
      <section id="pricing" className="wrap py-14">
        <Reveal className="text-center max-w-2xl mx-auto mb-10">
          <span className="eyebrow mb-3">{t.pricing.eyebrow}</span>
          <h2 className="h2">{t.pricing.h2}</h2>
          <p className="mt-3 text-g-muted">{t.pricing.sub}</p>
        </Reveal>
        <Stagger className="grid md:grid-cols-3 gap-6" gap={0.1}>
          {t.priceList.map((p,pi)=>{ const ICON=["🌱","⭐","🚀"][pi]||"✨"; const COL=["text-g-green","text-g-gold","text-sky-400"][pi]||"text-g-light"; const BG=["bg-g-green/10 border-g-green/30","bg-g-gold/10 border-g-gold/30","bg-sky-400/10 border-sky-400/30"][pi]||"bg-white/5 border-white/10"; return (
            <Item key={p.name} variant="up">
            <div className={`card flex flex-col h-full relative ${p.featured ? "ring-1 ring-g-gold/50 shadow-gold" : ""}`}>
              {p.featured && <span aria-hidden className="absolute -inset-px rounded-xl2 animate-breathe pointer-events-none" />}
              {p.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-black bg-gradient-to-r from-g-gold via-g-word to-g-gold bg-[length:200%_100%] animate-shimmer">{p.tag}</span>}
              <div className={`grid place-items-center h-12 w-12 rounded-2xl border text-2xl mb-3 relative ${BG}`}>{ICON}</div>
              <div className="text-xs font-bold uppercase text-g-gold relative">{p.tag}</div>
              <div className="text-xl font-extrabold text-g-word mt-1 relative">{p.name}</div>
              <div className="mt-2 mb-4 relative"><span className="text-3xl font-extrabold text-g-word">{p.price}</span><span className="text-g-muted text-sm">{p.per}</span></div>
              <ul className="space-y-2 mb-6 flex-1 relative">{p.feats.map((f)=><li key={f} className="flex items-start gap-2 text-sm text-g-word"><span className={COL}>✓</span>{f}</li>)}</ul>
              <a href="#contact" className={`relative ${p.featured ? "btn-bright" : "btn-ghost"}`}>{p.cta}</a>
            </div>
            </Item>
          ); })}
        </Stagger>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          {[["📈","+286% growth"],["⚡","3.2x ROI in 90 days"],["🚀","Live in 7 days"],["🛡️","30-day money-back"]].map(([ic,tx])=>(
            <span key={tx} className="inline-flex items-center gap-1.5 rounded-full border border-g-green/25 bg-g-green/[0.06] px-4 py-2 font-bold text-g-light">{ic} {tx}</span>
          ))}
        </div>
      </section>

      {/* ACADEMY */}
      <section id="academy" className="wrap pb-12">
        <div className="rounded-xl3 bg-gradient-to-tr from-g-gold/10 via-transparent to-g-green/10 bg-[length:200%_200%] animate-shimmer border border-g-line p-8 sm:p-10 flex flex-col md:flex-row items-center gap-6 justify-between">
          <div>
            <div className="eyebrow mb-2">{t.academy.eyebrow}</div>
            <h3 className="text-2xl font-extrabold text-g-word">{t.academy.h2}</h3>
            <p className="mt-2 text-g-muted text-sm max-w-xl">{t.academy.sub}</p>
          </div>
          <a href="#contact" className="btn-gold shrink-0">{t.academy.cta}</a>
        </div>
      </section>

      {/* CTA + LEAD CAPTURE (moved above FAQ — capture the lead while intent is hot) */}
      <section id="contact" className="wrap py-12 scroll-mt-24">
        <div className="rounded-xl3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 sm:p-12 shadow-lift relative overflow-hidden">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-g-green/15 blur-3xl animate-aurora pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-g-gold/15 blur-3xl animate-aurora pointer-events-none" style={{ animationDelay: "-6s" }} />
          <div className="relative max-w-2xl mx-auto">
            <div className="text-center">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-g-word">{t.final.h2}</h2>
              <p className="mt-2 text-g-gold font-bold">{t.more.lead.title}</p>
              <p className="mt-2 text-sm text-g-muted max-w-xl mx-auto">{t.more.lead.sub}</p>
            </div>
            <div className="mt-7"><LeadForm source="final-cta" /></div>
            <div className="mt-6 flex items-center gap-3 text-xs text-g-muted">
              <div className="h-px flex-1 bg-g-line" />{t.final.sub}<div className="h-px flex-1 bg-g-line" />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a href={waLink(t.more.lead.wamsg)} target="_blank" rel="noopener" className="btn-ghost text-sm">{t.final.wa}</a>
              <a href={CONTACT.calendly} className="btn-ghost text-sm">{t.final.demo}</a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — last, right before the closing manifesto */}
      <section id="faq" className="wrap pb-14">
        <Reveal className="text-center mb-8"><span className="eyebrow mb-3">{t.faq.eyebrow}</span><h2 className="h2">{t.faq.h2}</h2></Reveal>
        <Accordion items={t.faq.items} />
        <div className="mt-8 text-center">
          <button onClick={()=>{ const el=document.querySelector("elevenlabs-convai"); const b=el?.shadowRoot?.querySelector("button"); if(b)b.click(); }}
            className="btn-bright inline-flex"><span className="relative flex h-2 w-2 mr-1"><span className="absolute inline-flex h-full w-full rounded-full bg-black/40 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-black/60" /></span>🎙️ Still have questions? Ask our live AI</button>
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
