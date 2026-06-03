import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Reveal, Count, Aurora } from "../lib/ui.jsx";
import { waLink } from "../data/contact.js";

// Live KPIs the client would watch in their cockpit (demo numbers)
const KPIS = [
  ["💰", "Revenue recovered", "$", 18420, "/mo", "+22% vs last month", "#3E9468"],
  ["📞", "Calls answered by AI", "", 1240, "", "100% — zero missed", "#38BDF8"],
  ["📅", "Appointments booked", "", 386, "", "+64 this week", "#D6C29A"],
  ["⭐", "5★ reviews collected", "", 92, "", "auto-requested", "#3E9468"],
];

// Mini sparkline (sells the "live dashboard" feel)
function Spark({ color = "#3E9468", up = true }) {
  const pts = up
    ? "0,34 14,30 28,31 42,22 56,24 70,14 84,16 98,6 112,8 126,2"
    : "0,6 14,10 28,8 42,16 56,14 70,22 84,20 98,28 112,26 126,33";
  return (
    <svg viewBox="0 0 126 36" className="w-full h-9" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`sp-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`${pts} 126,36 0,36`} fill={`url(#sp-${color})`} />
    </svg>
  );
}

export default function Portal() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const requestAccess = (e) => {
    e.preventDefault();
    setSent(true);
    window.open(waLink(`Hi Guileo! I'd like early access to my Growth Cockpit. Email: ${email}`), "_blank");
  };

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      <section className="relative pt-28 pb-16 overflow-hidden">
        <Aurora />
        <div className="wrap">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-g-gold/40 bg-g-gold/[0.08] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-g-gold mb-5 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" /> Your private portal
            </span>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-g-green via-g-gold to-g-green bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">Growth Cockpit</span>
            </h1>
            <p className="mt-4 text-lg text-g-muted">
              One screen for everything your AI does — revenue recovered, calls answered, bookings, reviews and campaigns, updating live. <b className="text-g-word">Your whole operation, at a glance.</b>
            </p>
          </Reveal>

          {/* DASHBOARD PREVIEW */}
          <Reveal variant="scale">
            <div className="relative mx-auto max-w-5xl rounded-xl3 border border-white/12 bg-white/[0.04] backdrop-blur-xl shadow-lift overflow-hidden">
              {/* window chrome */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/10 bg-white/[0.03]">
                <span className="h-3 w-3 rounded-full bg-red-400/70" /><span className="h-3 w-3 rounded-full bg-g-gold/70" /><span className="h-3 w-3 rounded-full bg-g-green/70" />
                <span className="ml-2 text-xs font-semibold text-white/50">guileo · growth cockpit</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />live</span>
              </div>

              <div className="p-5 sm:p-7">
                {/* KPI grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {KPIS.map(([ic, label, pre, num, suf, note, color], i) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                      className="rounded-xl2 border border-white/10 bg-white/[0.04] p-4 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="grid place-items-center h-9 w-9 rounded-xl bg-white/[0.06] text-lg">{ic}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: color + "22", color }}>{note}</span>
                      </div>
                      <div className="mt-3 text-2xl font-extrabold text-g-word tracking-tight"><Count to={num} prefix={pre} suffix={suf} /></div>
                      <div className="text-[11px] text-g-muted">{label}</div>
                      <div className="mt-2"><Spark color={color} up={i !== 3 ? true : true} /></div>
                    </motion.div>
                  ))}
                </div>

                {/* lower row — channels + activity */}
                <div className="grid lg:grid-cols-3 gap-4 mt-4">
                  <div className="lg:col-span-2 rounded-xl2 border border-white/10 bg-white/[0.04] p-5">
                    <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">Revenue trend · last 30 days</div>
                    <div className="h-32"><Spark color="#3E9468" up /></div>
                  </div>
                  <div className="rounded-xl2 border border-white/10 bg-white/[0.04] p-5">
                    <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">Live activity</div>
                    <ul className="space-y-2.5 text-xs">
                      {[["📸", "Instagram", "closed a $240 sale"], ["💬", "WhatsApp", "booked Sat 3:00 PM"], ["📞", "Phone", "qualified a hot lead"], ["⭐", "Google", "got a 5★ review"]].map(([ic, ch, msg]) => (
                        <li key={ch} className="flex items-center gap-2.5">
                          <span className="text-base">{ic}</span>
                          <span className="text-g-word font-bold">{ch}</span>
                          <span className="text-g-muted truncate">{msg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* sign-in overlay — coming soon */}
              <div className="absolute inset-0 grid place-items-center bg-g-cream/55 backdrop-blur-[3px]">
                <div className="text-center px-6">
                  <div className="text-2xl mb-1">🔒</div>
                  <div className="text-lg font-extrabold text-g-word">Launching soon for clients</div>
                  <p className="text-sm text-g-muted mt-1 max-w-sm mx-auto">Every Guileo client gets a private Growth Cockpit. Want early access?</p>
                  {!sent ? (
                    <form onSubmit={requestAccess} className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
                        className="rounded-full border border-white/20 bg-black/30 px-5 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition" />
                      <button className="btn-bright text-sm whitespace-nowrap">Request early access →</button>
                    </form>
                  ) : (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-g-green/40 bg-g-green/[0.1] px-5 py-2.5 text-sm font-bold text-g-light">✅ On the list — we'll be in touch.</div>
                  )}
                </div>
              </div>
            </div>
          </Reveal>

          <p className="text-center text-xs text-g-muted mt-6">Preview shown with demo data · your real numbers appear once your system is live.</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
