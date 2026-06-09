import { useState, useEffect } from "react";
import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";

// Hero copy that lives in the component (richer than the shared dict) — translated inline.
const HERO_COPY = {
  en: { eyebrow:"Meet Gui · the AI that runs the business", sub:["Never miss a call, a lead, or a sale."," answers, books, quotes & sells and follows up — 24/7. Stop trading hours for tasks — the offer "," fulfills itself","."], method:["⚡ Performance","Sales","Growth"], cta:"Hear Gui work", sub2:"Real AI · real calls · real bookings." },
  pt: { eyebrow:"Conheça a Gui · a IA que toca o negócio", sub:["Nunca perca uma ligação, um lead ou uma venda."," atende, agenda, orça & vende e faz follow-up — 24/7. Pare de trocar horas por tarefas — a oferta "," se cumpre sozinha","."], method:["⚡ Performance","Vendas","Crescimento"], cta:"Ouça a Gui trabalhar", sub2:"IA de verdade · ligações reais · agendamentos reais." },
  es: { eyebrow:"Conoce a Gui · la IA que maneja el negocio", sub:["Nunca pierdas una llamada, un lead ni una venta."," contesta, agenda, cotiza & vende y hace seguimiento — 24/7. Deja de cambiar horas por tareas — la oferta "," se cumple sola","."], method:["⚡ Rendimiento","Ventas","Crecimiento"], cta:"Escucha a Gui trabajar", sub2:"IA real · llamadas reales · reservas reales." },
  hi: { eyebrow:"मिलिए Gui से · वह AI जो व्यवसाय चलाती है", sub:["कोई कॉल, लीड या बिक्री कभी न चूकें."," जवाब देती, बुकिंग, कोटेशन & बिक्री करती और फॉलो-अप करती है — 24/7। घंटे काम के बदले देना बंद करें — ऑफ़र "," खुद पूरा होता है","।"], method:["⚡ Performance","Sales","Growth"], cta:"Gui को काम करते सुनें", sub2:"असली AI · असली कॉल · असली बुकिंग।" },
};

// HeroV2 — TEST (/v2). Realistic, LIVING iPhone-2026 mockup of Gui working nonstop.
// SMOOTH motion: the action feed is a continuous gliding marquee (no janky remounts),
// the header business/line crossfades gently, the call timer ticks, the floating proof
// cards (services + profit + numbers) rotate with soft crossfades. Plant is back behind.
// All motion = CSS transforms + eased crossfades (framer `animate` is unreliable here).

const POOL = [
  { icon: "📅", label: "Booked", detail: "Maria · Sat 3:00 PM" },
  { icon: "💳", label: "Sale logged", detail: "$85 · card on file" },
  { icon: "🧾", label: "Quote sent", detail: "Kitchen remodel · $4,200" },
  { icon: "⭐", label: "Review requested", detail: "Carlos · 5-star link" },
  { icon: "🎯", label: "Lead captured", detail: "New patient · insurance ✓" },
  { icon: "↩️", label: "Follow-up sent", detail: "No-show → rebooked" },
  { icon: "💬", label: "Replied on WhatsApp", detail: "Spanish · instant" },
  { icon: "🛒", label: "Order placed", detail: "2× Large · pickup 7:15" },
  { icon: "🔗", label: "Payment link · paid", detail: "$120 · cleared" },
  { icon: "📞", label: "Callback set", detail: "Tomorrow 10:00 AM" },
  { icon: "🔁", label: "Rescheduled", detail: "João · Fri 2:00 PM" },
  { icon: "📋", label: "Intake completed", detail: "New client form" },
];

// Every kind of work Gui does — inbound & outbound, confirmations, sales, support, tracking…
const SCENARIOS = [
  { biz: "Tony's Pizza", dir: "in", type: "Order", line: "“Two larges, extra cheese — pickup at 7:15. Want drinks with that?”" },
  { biz: "Bright Smiles Dental", dir: "out", type: "Confirmation", line: "“Hi! Confirming your cleaning tomorrow at 9 AM — reply 1 to keep, 2 to move.”" },
  { biz: "Glow Spa", dir: "in", type: "Booking", line: "“Friday at 4 works — I sent your deposit link. You're all set ✨”" },
  { biz: "Vértice Imóveis", dir: "in", type: "Lead qualify", line: "“3-bed downtown under R$2k? I'll text you 4 matches tonight.”" },
  { biz: "Apex Plumbing", dir: "out", type: "Sales", line: "“Your water heater's due for service — I've got Thursday 10 AM. Book it?”" },
  { biz: "Luna Café", dir: "in", type: "Support", line: "“I see the charge — refunding $20 now. You'll get a text confirmation.”" },
  { biz: "FitZone Gym", dir: "out", type: "Win-back", line: "“We miss you! 1 month free if you're back this week — want me to set it up?”" },
  { biz: "QuickShip Store", dir: "in", type: "Tracking", line: "“Your order's 6 minutes away — driver is Marco. I'll text live updates 🚗”" },
  { biz: "Sterling Law", dir: "in", type: "Intake", line: "“Got your case details — a paralegal will call you within the hour.”" },
  { biz: "Drive Auto", dir: "in", type: "Quote", line: "“Brake job is $280 out the door — I can fit you in tomorrow at 8. Sound good?”" },
  { biz: "Bella Hair", dir: "out", type: "Reminder", line: "“Reminder: your color appointment is in 1 hour. See you soon!”" },
  { biz: "Pulse Clinic", dir: "out", type: "Follow-up", line: "“Checking in after your visit — feeling better? I can rebook if you need.”" },
];

const FLOAT_L = [
  { icon: "🌙", a: "Captured at 2:14 AM", b: "while you slept" },
  { icon: "🌐", a: "Replied in Español", b: "in 2 seconds" },
  { icon: "📞", a: "17 calls answered", b: "0 missed today" },
  { icon: "⚡", a: "Quote sent", b: "in 11 seconds" },
  { icon: "🗓️", a: "Booked solid", b: "next 3 days" },
];
const FLOAT_R = [
  { icon: "📈", a: "+37% bookings", b: "this month, on autopilot" },
  { icon: "💰", a: "$1,840 collected", b: "today · hands-off" },
  { icon: "🎯", a: "28 leads captured", b: "this week" },
  { icon: "⏱️", a: "9 hours saved", b: "every week" },
  { icon: "🧾", a: "$4,200 quoted", b: "today" },
  { icon: "⭐", a: "23 reviews", b: "5-star links sent" },
];

function Waveform() {
  const bars = Array.from({ length: 26 });
  return (
    <div className="flex items-end gap-[3px] h-10">
      {bars.map((_, i) => (
        <span key={i} className="w-[3px] rounded-full bg-gradient-to-t from-g-green to-g-gold origin-bottom"
          style={{ height: `${28 + ((i * 41) % 64)}%`, animation: `gwave 1.4s ease-in-out ${(i % 8) * 0.1}s infinite` }} />
      ))}
    </div>
  );
}

function FeedRow({ a }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/10">
      <span className="text-base">{a.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold text-white">{a.label}</div>
        <div className="truncate text-[11px] text-white/50">{a.detail}</div>
      </div>
      <span className="text-[11px] text-g-green">✓</span>
    </div>
  );
}

function Phone() {
  const [secs, setSecs] = useState(134);
  const [biz, setBiz] = useState(0);
  const [stat, setStat] = useState(0);

  useEffect(() => {
    const a = setInterval(() => setSecs((s) => s + 1), 1000);
    const b = setInterval(() => setBiz((s) => s + 1), 4200); // gentle header rotation
    const c = setInterval(() => setStat((s) => s + 1), 3200); // floating cards rotation
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, []);

  const B = SCENARIOS[biz % SCENARIOS.length];
  const dirLabel = B.dir === "in" ? "Inbound" : "Outbound";
  const dirIcon = B.dir === "in" ? "↘" : "↗";
  const L = FLOAT_L[stat % FLOAT_L.length];
  const R = FLOAT_R[(stat + 2) % FLOAT_R.length];
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="relative mx-auto w-[360px] max-w-full">
      <img src={mark} alt="" className="pointer-events-none absolute -top-10 left-1/2 w-[420px] max-w-none -translate-x-1/2 opacity-[0.16] blur-[1px] saturate-150" />
      <div className="pointer-events-none absolute -inset-12 bg-[radial-gradient(closest-side,rgba(62,148,104,0.22),transparent)] blur-2xl" />

      <div className="relative rounded-[3.1rem] bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] p-[8px] ring-1 ring-white/10 shadow-[0_60px_150px_-30px_rgba(0,0,0,0.9)]">
        <div className="relative overflow-hidden rounded-[2.7rem] bg-[#0b0b0b]">
          <div className="absolute left-1/2 top-2.5 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black" />

          <div className="flex items-center justify-between px-6 pt-3.5 pb-2 text-[12px] font-semibold text-white/85">
            <span>9:41</span>
            <span className="text-[10px] tracking-wide">▮▮▮ ⌃ 100%</span>
          </div>

          <div className="px-6 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-g-green">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" />
                </span>
                On a call · {mm}:{ss}
              </div>
              <span key={"t" + biz} className="rounded-full bg-white/[0.06] px-2 py-[2px] text-[9px] font-bold uppercase tracking-wider text-white/70 ring-1 ring-white/10" style={{ animation: "gsoft .8s ease-in-out both" }}>
                {dirIcon} {dirLabel} · {B.type}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              {/* Gui avatar = Guileo plant logo + live microphone (voice AI on a call) */}
              <div className="relative h-14 w-14 shrink-0">
                <span className="absolute inset-0 rounded-full ring-2 ring-g-green/45" style={{ animation: "gpulse 2s ease-out infinite" }} />
                <span className="absolute inset-0 rounded-full ring-2 ring-g-green/30" style={{ animation: "gpulse 2s ease-out 1s infinite" }} />
                <div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-g-green/25 to-g-gold/15 ring-1 ring-white/15">
                  <img src={mark} alt="Guileo Gui" className="h-11 w-11 object-contain drop-shadow" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-[#0c0c0c] text-g-green ring-2 ring-g-green/60">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="11" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </span>
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-[16px] font-bold text-white">Gui</span>
                  <span className="rounded-full border border-g-green/40 bg-g-green/10 px-1.5 py-[1px] text-[8px] font-black uppercase tracking-wider text-g-green">AI Voice</span>
                </div>
                <div key={B.biz} className="text-[11px] text-white/55" style={{ animation: "gsoft .8s ease-in-out both" }}>answering for {B.biz}</div>
              </div>
            </div>
          </div>

          <div className="mx-6 mt-4 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10">
            <Waveform />
            <p key={B.line} className="mt-2.5 min-h-[34px] text-[12.5px] leading-snug text-white/80" style={{ animation: "gsoft .8s ease-in-out both" }}>{B.line}</p>
          </div>

          {/* SMOOTH continuous feed — glides up forever, soft fade at edges */}
          <div className="px-6 pb-5 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Gui is handling it · live</span>
              <span className="text-[9px] text-g-green">● real-time</span>
            </div>
            <div className="relative h-[232px] overflow-hidden" style={{ maskImage: "linear-gradient(to bottom,transparent,#000 14%,#000 86%,transparent)", WebkitMaskImage: "linear-gradient(to bottom,transparent,#000 14%,#000 86%,transparent)" }}>
              <div className="space-y-2" style={{ animation: "gscroll 30s linear infinite" }}>
                {[...POOL, ...POOL].map((a, i) => <FeedRow key={i} a={a} />)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* floating proof cards — rotate (services + profit + numbers), soft crossfade + float */}
      <div className="absolute -left-20 top-36 hidden w-[150px] rounded-xl2 border border-white/10 bg-[#14130F]/92 px-3 py-2 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] backdrop-blur-xl lg:block" style={{ animation: "gfloat 6s ease-in-out infinite" }}>
        <div key={"l" + stat} style={{ animation: "gsoft .8s ease-in-out both" }}>
          <div className="text-[11px] font-bold text-g-word">{L.icon} {L.a}</div>
          <div className="text-[10px] text-g-ink">{L.b}</div>
        </div>
      </div>
      <div className="absolute -right-20 bottom-44 hidden w-[160px] rounded-xl2 border border-white/10 bg-[#14130F]/92 px-3 py-2 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] backdrop-blur-xl lg:block" style={{ animation: "gfloat 7s ease-in-out 1s infinite" }}>
        <div key={"r" + stat} style={{ animation: "gsoft .8s ease-in-out both" }}>
          <div className="text-[11px] font-bold text-g-word">{R.icon} {R.a}</div>
          <div className="text-[10px] text-g-ink">{R.b}</div>
        </div>
      </div>
    </div>
  );
}

export default function HeroV2() {
  const { t, lang } = useLang();
  const H = t.hero || {};
  const C = HERO_COPY[lang] || HERO_COPY.en;
  return (
    <section className="relative overflow-hidden px-5 pt-10 pb-20 sm:pt-16">
      <style>{`
        @keyframes gwave{0%,100%{transform:scaleY(0.42)}50%{transform:scaleY(1)}}
        @keyframes gscroll{from{transform:translateY(0)}to{transform:translateY(-50%)}}
        @keyframes gsoft{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes gpulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.45);opacity:0}}
        @keyframes greveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gshine{to{background-position:220% center}}
        @media (prefers-reduced-motion: reduce){
          *{animation-duration:0.001ms !important;animation-iteration-count:1 !important}
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_500px_at_70%_-10%,rgba(62,148,104,0.10),transparent),radial-gradient(800px_400px_at_10%_20%,rgba(214,194,154,0.06),transparent)]" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-g-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-g-green" /> {C.eyebrow}
          </div>

          <h1 className="mt-5 font-black leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2.3rem,8.5vw,4.5rem)" }}>
            <span className="block text-g-word" style={{ animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{H.h1a || "Work Smart."}</span>
            <span className="block bg-gradient-to-r from-g-green via-g-light to-g-green bg-clip-text pl-[0.12em] text-transparent" style={{ backgroundSize: "220% auto", animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .2s both, gshine 7s linear infinite" }}>{H.h1b || "Grow Faster."}</span>
            <span className="block bg-gradient-to-r from-g-gold via-g-copper to-g-gold bg-clip-text pl-[0.24em] text-transparent" style={{ backgroundSize: "220% auto", animation: "greveal .8s cubic-bezier(.2,.7,.2,1) .35s both, gshine 7s linear .6s infinite" }}>{H.h1c || "Sleep Better."}</span>
          </h1>

          <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-g-ink">
            <span className="font-bold text-g-word">{C.sub[0]}</span> Gui{C.sub[1]}<span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text font-bold text-transparent">{C.sub[2]}</span>{C.sub[3]}
          </p>

          <div className="mt-6 flex items-center gap-2 text-[13px] font-black uppercase tracking-wider">
            <span className="text-g-green">{C.method[0]}</span>
            <span className="text-g-muted">→</span>
            <span className="text-g-gold">{C.method[1]}</span>
            <span className="text-g-muted">→</span>
            <span className="text-g-copper">{C.method[2]}</span>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#try" className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#181818] px-5 py-3 text-[14px] font-bold text-g-word ring-1 ring-white/15 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.8)] transition hover:ring-g-green/40">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-g-green/40 to-g-gold/30 text-xs">🌱</span>
              {C.cta}
              <span className="text-g-green">· 24/7</span>
            </a>
            <span className="text-[12px] text-g-muted">{C.sub2}</span>
          </div>
        </div>

        <div className="relative min-w-0">
          <Phone />
        </div>
      </div>
    </section>
  );
}
