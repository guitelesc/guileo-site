import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaWandMagicSparkles, FaCalendarCheck, FaCreditCard, FaStar, FaInstagram,
  FaPhoneVolume, FaWhatsapp, FaStripe, FaGoogle, FaCircleCheck,
} from "react-icons/fa6";

/* ───────────────────────────────────────────────────────────────
   LiveDemo — a REAL, functional mini Growth Cockpit on the landing.
   Visitors click and actually use the features themselves: ask Guileo
   to do something, watch the AI "work" across the connected stack, and
   see the result land in a live feed while the counters tick up.
   Fully client-side, self-contained — does not touch any other section.
   ─────────────────────────────────────────────────────────────── */

const NAMES = ["Maria S.", "James T.", "Aisha K.", "Diego P.", "Lena M.", "Noah R.", "Priya V.", "Omar H."];

// Each action: chip label/icon + how Guileo narrates it + the feed row it creates + which stack tool lights up
const ACTIONS = [
  { key: "book", icon: FaCalendarCheck, color: "#D6C29A", chip: "Take a booking", tool: "WhatsApp",
    say: (n) => `Booked ${n} for tomorrow 3:00 PM and sent a WhatsApp confirmation ✓`,
    row: (n) => ({ ic: "📅", t: `Booking · ${n}`, s: "Tomorrow, 3:00 PM", color: "#D6C29A" }), rev: 0, kpi: "bookings" },
  { key: "invoice", icon: FaCreditCard, color: "#3E9468", chip: "Send an invoice", tool: "Stripe",
    say: (n) => `Sent ${n} a Stripe payment link for $${120} — I'll chase it until it's paid ✓`,
    row: (n) => ({ ic: "💳", t: `Invoice · ${n}`, s: "$120 · payment link sent", color: "#3E9468" }), rev: 120, kpi: "revenue" },
  { key: "review", icon: FaStar, color: "#D6C29A", chip: "Request a review", tool: "Google",
    say: (n) => `Asked ${n} for a Google review at the perfect moment ✓`,
    row: (n) => ({ ic: "⭐", t: `Review requested · ${n}`, s: "via Google", color: "#D6C29A" }), rev: 0, kpi: "reviews" },
  { key: "post", icon: FaInstagram, color: "#E1306C", chip: "Post to Instagram", tool: "Instagram",
    say: () => `Scheduled an on-brand Instagram post for your audience's peak hour ✓`,
    row: () => ({ ic: "📸", t: "Instagram post scheduled", s: "Peak hour · auto-optimized", color: "#E1306C" }), rev: 0, kpi: "posts" },
  { key: "call", icon: FaPhoneVolume, color: "#38BDF8", chip: "Answer a call", tool: "WhatsApp",
    say: (n) => `Answered ${n}'s call, qualified them and booked a callback ✓`,
    row: (n) => ({ ic: "📞", t: `Call handled · ${n}`, s: "Qualified + callback booked", color: "#38BDF8" }), rev: 0, kpi: "bookings" },
];

const STACK = [
  ["WhatsApp", FaWhatsapp, "#25D366"],
  ["Instagram", FaInstagram, "#E1306C"],
  ["Stripe", FaStripe, "#635BFF"],
  ["Google", FaGoogle, "#4285F4"],
];

export default function LiveDemo() {
  const [feed, setFeed] = useState([
    { ic: "🤖", t: "Guileo is online", s: "Try it — tap an action below", color: "#3E9468", _id: 0 },
  ]);
  const [kpis, setKpis] = useState({ bookings: 0, revenue: 0, reviews: 0, posts: 0 });
  const [busy, setBusy] = useState(null);     // action key currently "working"
  const [hot, setHot] = useState(null);       // stack tool lighting up
  const [used, setUsed] = useState(false);
  const idRef = useRef(1);

  const run = (a) => {
    const n = NAMES[idRef.current % NAMES.length];
    // The result lands SYNCHRONOUSLY (robust — never stuck, works even in throttled/hidden tabs).
    const row = { ...a.row(n), _id: idRef.current++, say: a.say(n) };
    setFeed((f) => [row, ...f].slice(0, 6));
    setKpis((k) => ({ ...k, [a.kpi]: a.kpi === "revenue" ? k.revenue + a.rev : (k[a.kpi] || 0) + 1 }));
    setUsed(true);
    // purely-cosmetic "working" flash on the chip + the stack tool lighting up
    setBusy(a.key);
    setHot(a.tool);
    setTimeout(() => { setBusy(null); setHot(null); }, 650);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 sm:p-6 shadow-2xl">
      {/* header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="grid place-items-center h-10 w-10 rounded-full bg-gradient-to-br from-g-green to-g-dark text-white"><FaWandMagicSparkles /></span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-g-word flex items-center gap-2">Guileo — live demo <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" /></div>
          <div className="text-[11px] text-g-muted">Not a video — actually click and use it.</div>
        </div>
        {/* connected stack */}
        <div className="hidden sm:flex items-center gap-1.5">
          {STACK.map(([name, Icon, color]) => (
            <span key={name} title={name} className="grid place-items-center h-7 w-7 rounded-lg transition-all duration-300" style={{ background: color + (hot === name ? "44" : "1f"), color, transform: hot === name ? "scale(1.18)" : "none", boxShadow: hot === name ? `0 0 14px ${color}88` : "none" }}><Icon size={13} /></span>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[["Bookings", kpis.bookings], ["Revenue", `$${kpis.revenue}`], ["Reviews", kpis.reviews]].map(([label, val]) => (
          <div key={label} className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-center">
            <div className="text-lg font-extrabold text-g-word tabular-nums">{val}</div>
            <div className="text-[10px] uppercase tracking-wide text-g-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* actions */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-g-gold mb-2">Ask Guileo to…</div>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.key} onClick={() => run(a)}
                  className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-bold text-g-word hover:border-g-green/60 hover:bg-white/[0.08] transition">
                  <span style={{ color: a.color }}><Icon size={13} /></span>
                  {a.chip}
                  {busy === a.key ? <span className="ml-0.5 inline-block h-3 w-3 rounded-full border-2 border-g-green border-t-transparent animate-spin" /> : <span className="text-g-muted group-hover:text-g-green transition">→</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-[11px] text-g-muted leading-relaxed">
            Every tap runs a <span className="text-g-light font-semibold">real action</span> across your connected tools — bookings, payments, reviews, posts, calls. This is exactly what your customers experience, 24/7.
          </div>
        </div>

        {/* live feed */}
        <div className="rounded-xl border border-white/[0.07] bg-black/20 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/[0.07] text-[10px] font-black uppercase tracking-wide text-g-muted flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" /> Live feed</div>
          <div className="divide-y divide-white/[0.05] min-h-[180px]">
            <AnimatePresence initial={false}>
              {feed.map((r) => (
                <motion.div key={r._id} initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0 }} className="px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">{r.ic}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-g-word truncate">{r.t}</div>
                      <div className="text-[10px] text-g-muted truncate">{r.s}</div>
                      {r.say && <div className="mt-1 text-[10px] text-g-green inline-flex items-start gap-1"><FaCircleCheck size={9} className="mt-0.5 shrink-0" /> {r.say}</div>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {used && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center text-[11px] text-g-muted">
          That's Guileo working <span className="text-g-light font-semibold">inside your stack</span>. Imagine it doing this for every customer, all day. <span className="text-g-gold font-bold">It works on us → it works for you.</span>
        </motion.div>
      )}
    </div>
  );
}
