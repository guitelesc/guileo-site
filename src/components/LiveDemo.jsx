import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCalendarCheck, FaCreditCard, FaStar, FaInstagram,
  FaPhoneVolume, FaWhatsapp, FaStripe, FaGoogle, FaCircleCheck,
  FaArrowsRotate, FaClockRotateLeft, FaMicrophone, FaBullhorn, FaFileLines,
} from "react-icons/fa6";
import logo from "../assets/guileo-mark.png";

/* ───────────────────────────────────────────────────────────────
   LiveDemo — a clear, self-running showcase of Gui working.
   One task at a time: Gui PICKS IT UP → THINKS (reads your stack) →
   DOES IT → it lands in the live feed and the counters tick up.
   You watch it work; you can also tap a task to try one yourself.
   Fully client-side, self-contained.
   ─────────────────────────────────────────────────────────────── */

const NAMES = ["Maria S.", "James T.", "Aisha K.", "Diego P.", "Lena M.", "Noah R.", "Priya V.", "Omar H."];

// Each action: chip + what Gui "thinks" while doing it + how it narrates the result + the feed row + which tool lights up
const ACTIONS = [
  { key: "book", icon: FaCalendarCheck, color: "#D6C29A", chip: "Book an appointment", tool: "WhatsApp",
    think: "Checking your calendar for the best open slot…",
    say: (n) => `Booked ${n} for tomorrow 3:00 PM and sent a WhatsApp confirmation`,
    row: (n) => ({ ic: "📅", t: `Booking · ${n}`, s: "Tomorrow, 3:00 PM" }), rev: 0, kpi: "bookings" },
  { key: "invoice", icon: FaCreditCard, color: "#3E9468", chip: "Send an invoice", tool: "Stripe",
    think: "Generating a secure Stripe payment link…",
    say: (n) => `Sent ${n} a Stripe payment link for $120 — I'll chase it until it's paid`,
    row: (n) => ({ ic: "💳", t: `Invoice · ${n}`, s: "$120 · payment link sent" }), rev: 120, kpi: "revenue" },
  { key: "review", icon: FaStar, color: "#D6C29A", chip: "Request a review", tool: "Google",
    think: "Picking the perfect moment to ask…",
    say: (n) => `Asked ${n} for a Google review right after a happy visit`,
    row: (n) => ({ ic: "⭐", t: `Review requested · ${n}`, s: "via Google" }), rev: 0, kpi: "reviews" },
  { key: "call", icon: FaPhoneVolume, color: "#38BDF8", chip: "Answer a call", tool: "WhatsApp",
    think: "Listening, understanding and qualifying the caller…",
    say: (n) => `Answered ${n}'s call, qualified them and booked a callback`,
    row: (n) => ({ ic: "📞", t: `Call handled · ${n}`, s: "Qualified + callback booked" }), rev: 0, kpi: "bookings" },
  { key: "winback", icon: FaArrowsRotate, color: "#3E9468", chip: "Win back a customer", tool: "WhatsApp",
    think: "Finding lapsed customers worth re-engaging…",
    say: (n) => `Re-engaged ${n} (quiet 60 days) with a tailored offer — they're back`,
    row: (n) => ({ ic: "🔁", t: `Win-back · ${n}`, s: "Lapsed 60 days → re-booked" }), rev: 90, kpi: "revenue" },
  { key: "noshow", icon: FaClockRotateLeft, color: "#EF8E3E", chip: "Recover a no-show", tool: "WhatsApp",
    think: "Pulling the next person off your waitlist…",
    say: (n) => `${n} missed their slot — I rebooked them and refilled it from your waitlist`,
    row: (n) => ({ ic: "⏰", t: `No-show recovered · ${n}`, s: "Rebooked + slot refilled" }), rev: 0, kpi: "bookings" },
  { key: "transcribe", icon: FaFileLines, color: "#A78BFA", chip: "Transcribe a call", tool: "WhatsApp",
    think: "Transcribing and summarizing the conversation…",
    say: (n) => `Transcribed ${n}'s call, summarized it and saved the action items`,
    row: (n) => ({ ic: "📝", t: `Call transcribed · ${n}`, s: "Summary + action items saved" }), rev: 0, kpi: "tasks" },
  { key: "campaign", icon: FaBullhorn, color: "#F59E0B", chip: "Launch a campaign", tool: "Instagram",
    think: "Segmenting 240 lapsed customers…",
    say: () => `Launched a win-back campaign to 240 lapsed customers on WhatsApp + email`,
    row: () => ({ ic: "📣", t: "Campaign launched", s: "240 customers · WhatsApp + email" }), rev: 0, kpi: "tasks" },
];

const STACK = [
  ["WhatsApp", FaWhatsapp, "#25D366"],
  ["Instagram", FaInstagram, "#E1306C"],
  ["Stripe", FaStripe, "#635BFF"],
  ["Google", FaGoogle, "#4285F4"],
];

export default function LiveDemo() {
  const [feed, setFeed] = useState([]);
  const [kpis, setKpis] = useState({ bookings: 0, revenue: 0, reviews: 0, tasks: 0 });
  const [hot, setHot] = useState(null);          // stack tool lighting up
  const [now, setNow] = useState(null);          // { a, n, phase: 'thinking' | 'done' }
  const [listening, setListening] = useState(false);
  const idRef = useRef(1);
  const timers = useRef([]);

  // Complete an action: it lands in the feed + ticks the counters.
  const complete = (a, n) => {
    const row = { ...a.row(n), _id: idRef.current++, say: a.say(n), color: a.color };
    setFeed((f) => [row, ...f].slice(0, 5));
    setKpis((k) => ({ ...k, [a.kpi]: a.kpi === "revenue" ? k.revenue + a.rev : (k[a.kpi] || 0) + 1 }));
  };

  // Run one task as a clear sequence: pick it up → think → do it.
  const play = (a, n = NAMES[idRef.current % NAMES.length]) => {
    setNow({ a, n, phase: "thinking" });
    setHot(a.tool);
    const t1 = setTimeout(() => {
      setNow({ a, n, phase: "done" });
      complete(a, n);
      const t2 = setTimeout(() => setHot(null), 500);
      timers.current.push(t2);
    }, 950);
    timers.current.push(t1);
  };

  // AUTO-PLAY: Gui works through its rounds on its own — one task at a time.
  const autoIdx = useRef(0);
  useEffect(() => {
    const tick = () => { play(ACTIONS[autoIdx.current % ACTIONS.length]); autoIdx.current++; };
    const kick = setTimeout(tick, 700);
    const id = setInterval(tick, 3000);
    return () => { clearTimeout(kick); clearInterval(id); timers.current.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voice: speak a request, Gui maps it to the right action by keyword.
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const matchAction = (s) => {
    s = s.toLowerCase();
    if (/invoice|pay|bill|charge/.test(s)) return ACTIONS.find((a) => a.key === "invoice");
    if (/review|rating|star/.test(s)) return ACTIONS.find((a) => a.key === "review");
    if (/call|phone/.test(s)) return ACTIONS.find((a) => a.key === "call");
    if (/win.?back|lapsed/.test(s)) return ACTIONS.find((a) => a.key === "winback");
    if (/no.?show|missed/.test(s)) return ACTIONS.find((a) => a.key === "noshow");
    if (/transcri|summar/.test(s)) return ACTIONS.find((a) => a.key === "transcribe");
    if (/campaign|blast|promo/.test(s)) return ACTIONS.find((a) => a.key === "campaign");
    return ACTIONS.find((a) => a.key === "book");
  };
  const dictate = () => {
    if (!SR) { play(ACTIONS[0]); return; }
    const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false;
    setListening(true);
    rec.onresult = (ev) => { setListening(false); play(matchAction(ev.results[0][0].transcript)); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const Now = now?.a;

  return (
    <div className="relative rounded-2xl border border-g-green/30 bg-white/[0.04] backdrop-blur-xl p-4 sm:p-6 shadow-2xl">
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="grid place-items-center h-11 w-11 rounded-full bg-g-green/10 ring-1 ring-g-green/30 overflow-hidden shrink-0"><img src={logo} alt="Guileo" className="h-9 w-9 object-contain" /></span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-g-word flex items-center gap-2">Gui <span className="text-[9px] font-black uppercase text-g-green">· AI assistant</span> <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />live</span></div>
          <div className="text-[11px] text-g-muted">Working your whole business — 24/7. Watch, or ask it yourself.</div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          {STACK.map(([name, Icon, color]) => (
            <span key={name} title={name} className="grid place-items-center h-7 w-7 rounded-lg transition-all duration-300" style={{ background: color + (hot === name ? "44" : "1f"), color, transform: hot === name ? "scale(1.18)" : "none", boxShadow: hot === name ? `0 0 14px ${color}88` : "none" }}><Icon size={13} /></span>
          ))}
        </div>
      </div>

      {/* NOW — the one task Gui is handling right now (the intelligent focal point) */}
      <div className="rounded-xl border border-g-green/30 bg-gradient-to-r from-g-green/[0.10] to-transparent p-3.5 mb-4 min-h-[64px] flex items-center gap-3">
        <AnimatePresence mode="wait">
          {Now ? (
            <motion.div key={now.a.key + now.phase} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="flex items-center gap-3 w-full">
              <span className="grid place-items-center h-9 w-9 rounded-lg shrink-0" style={{ background: Now.color + "22", color: Now.color }}><Now.icon size={17} /></span>
              <div className="min-w-0 flex-1">
                {now.phase === "thinking" ? (
                  <>
                    <div className="text-[11px] font-black uppercase tracking-wide text-g-green">Gui is on it…</div>
                    <div className="text-xs text-g-word truncate">{Now.think}</div>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] font-black uppercase tracking-wide text-g-gold inline-flex items-center gap-1"><FaCircleCheck size={10} className="text-g-green" /> Done</div>
                    <div className="text-xs text-g-word truncate">{Now.say(now.n)} ✓</div>
                  </>
                )}
              </div>
              {now.phase === "thinking" && <span className="shrink-0 inline-flex gap-1">{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-g-green" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }} />)}</span>}
            </motion.div>
          ) : (
            <div className="text-xs text-g-muted">Gui is online — starting its rounds…</div>
          )}
        </AnimatePresence>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[["Booked", kpis.bookings], ["Revenue", `$${kpis.revenue}`], ["Reviews", kpis.reviews]].map(([label, val]) => (
          <div key={label} className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-center">
            <motion.div key={String(val)} initial={{ scale: 1.25, color: "#7FC9A0" }} animate={{ scale: 1, color: "#EDE7DC" }} transition={{ duration: 0.4 }} className="text-lg font-extrabold tabular-nums">{val}</motion.div>
            <div className="text-[10px] uppercase tracking-wide text-g-muted">{label}</div>
          </div>
        ))}
      </div>

      {/* live feed */}
      <div className="rounded-xl border border-white/[0.07] bg-black/20 overflow-hidden mb-4">
        <div className="px-3 py-2 border-b border-white/[0.07] text-[10px] font-black uppercase tracking-wide text-g-muted flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" /> Done today</div>
        <div className="divide-y divide-white/[0.05] min-h-[150px]">
          <AnimatePresence initial={false}>
            {feed.length === 0 && <div className="px-3 py-6 text-center text-[11px] text-g-muted">Completed tasks land here…</div>}
            {feed.map((r) => (
              <motion.div key={r._id} initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0 }} className="px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">{r.ic}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-g-word truncate">{r.t}</div>
                    <div className="text-[10px] text-g-muted truncate">{r.s}</div>
                  </div>
                  <span className="text-[10px] text-g-green font-bold whitespace-nowrap mt-0.5">✓</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* try it yourself — secondary, compact */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-black uppercase tracking-wide text-g-gold">Or ask Gui yourself</div>
        <button onClick={dictate} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${listening ? "border-red-400 bg-red-500/15 text-red-400 animate-pulse" : "border-g-green/40 bg-g-green/10 text-g-green hover:bg-g-green/20"}`}>
          <FaMicrophone size={10} /> {listening ? "Listening…" : "Say it"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.key} onClick={() => play(a)}
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-g-word hover:border-g-green/60 hover:bg-white/[0.08] transition">
              <span style={{ color: a.color }}><Icon size={11} /></span>{a.chip}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.07] flex flex-wrap items-center justify-center gap-2.5 text-center">
        <span className="text-[11px] text-g-muted">This is the real product — it works on us, so you know it works for you.</span>
        <a href="#contact" className="btn-bright text-xs">Get Gui doing this for me →</a>
      </div>
    </div>
  );
}
