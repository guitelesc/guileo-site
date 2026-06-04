import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaGaugeHigh, FaComments, FaBullhorn, FaUsers, FaHeadset, FaFileLines,
  FaArrowLeft, FaArrowTrendUp, FaArrowTrendDown, FaWhatsapp, FaInstagram, FaPhone, FaFacebook, FaTiktok, FaGoogle,
} from "react-icons/fa6";
import logo from "../assets/guileo-logo.png";
import { Count } from "../lib/ui.jsx";
import { waLink } from "../data/contact.js";

/* ───────────────────────── Mock data (demo — swap for Supabase later) ───────────────────────── */
const BUSINESS = { name: "Bella Pizza", place: "São Paulo · BR", since: "Live since Apr 2026" };

const KPIS = [
  { ic: "💰", label: "Revenue recovered", pre: "$", num: 18420, suf: "", delta: 22, color: "#3E9468" },
  { ic: "📞", label: "Calls answered by AI", pre: "", num: 1240, suf: "", delta: 100, color: "#38BDF8", note: "0 missed" },
  { ic: "📅", label: "Appointments booked", pre: "", num: 386, suf: "", delta: 18, color: "#D6C29A" },
  { ic: "⭐", label: "5★ reviews collected", pre: "", num: 92, suf: "", delta: 41, color: "#3E9468" },
];

const CHANNELS = [
  { Icon: FaWhatsapp, name: "WhatsApp", color: "#25D366", convos: 642, won: 128, note: "booked 96 orders" },
  { Icon: FaInstagram, name: "Instagram", color: "#E4405F", convos: 410, won: 73, note: "closed $5.2k in DMs" },
  { Icon: FaPhone, name: "Phone (AI)", color: "#38BDF8", convos: 1240, won: 311, note: "0 missed calls" },
  { Icon: FaFacebook, name: "Facebook", color: "#1877F2", convos: 188, won: 24, note: "24 comments handled" },
  { Icon: FaTiktok, name: "TikTok", color: "#f5f5f5", convos: 96, won: 12, note: "1 viral clip · 12k views" },
  { Icon: FaGoogle, name: "Google", color: "#4285F4", convos: 140, won: 92, note: "92 reviews requested" },
];

const CAMPAIGNS = [
  { name: "Meta · Weekend Promo", spend: 480, leads: 96, cpl: 5.0, roas: 4.2, up: true },
  { name: "Google · 'pizza near me'", spend: 360, leads: 72, cpl: 5.0, roas: 3.8, up: true },
  { name: "TikTok · Brand Awareness", spend: 220, leads: 28, cpl: 7.9, roas: 2.1, up: false },
  { name: "Instagram · Retargeting", spend: 180, leads: 51, cpl: 3.5, roas: 5.6, up: true },
];

const LEADS = [
  { name: "Marcos A.", ch: "WhatsApp", when: "2 min ago", status: "Booked", color: "#3E9468" },
  { name: "Julia R.", ch: "Instagram", when: "18 min ago", status: "Qualified", color: "#D6C29A" },
  { name: "Pedro S.", ch: "Phone", when: "41 min ago", status: "New", color: "#38BDF8" },
  { name: "Ana L.", ch: "WhatsApp", when: "1 h ago", status: "Booked", color: "#3E9468" },
  { name: "Bruno T.", ch: "Facebook", when: "2 h ago", status: "Follow-up", color: "#C2A878" },
  { name: "Carla M.", ch: "Google", when: "3 h ago", status: "Review ⭐", color: "#3E9468" },
];

const ACTIVITY = [
  ["📸", "Instagram", "AI replied to a DM and closed a $240 order", "now"],
  ["💬", "WhatsApp", "Booked a table — Saturday 8:00 PM", "3 min"],
  ["📞", "Phone", "Answered a call & took a delivery order", "12 min"],
  ["⭐", "Google", "Asked a happy client for a 5★ review", "25 min"],
  ["📘", "Meta Ads", "Cut cost per lead to $3.50", "1 h"],
];

const DOCS = [
  ["📄", "Service Agreement", "Signed · Apr 2, 2026", "Signed"],
  ["🧾", "Invoice #0012", "Paid · Jun 1, 2026", "Paid"],
  ["📦", "Onboarding checklist", "Completed", "Done"],
  ["📊", "May performance report", "PDF · 1.2 MB", "View"],
];

const REVENUE = [8, 10, 9, 13, 12, 16, 15, 19, 18, 22, 24, 28]; // monthly trend (demo)

/* ───────────────────────── Tiny charts ───────────────────────── */
function Spark({ data = REVENUE, color = "#3E9468", h = 40 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const id = "g" + color.replace("#", "");
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 126},${36 - ((v - min) / (max - min || 1)) * 32 - 2}`).join(" ");
  return (
    <svg viewBox="0 0 126 36" className="w-full" style={{ height: h }} preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`${pts} 126,36 0,36`} fill={`url(#${id})`} />
    </svg>
  );
}
function Bars({ data = REVENUE, color = "#D6C29A" }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {data.map((v, i) => (
        <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${(v / max) * 100}%` }} transition={{ delay: i * 0.04, type: "spring", stiffness: 120, damping: 16 }}
          className="flex-1 rounded-t-md" style={{ background: `linear-gradient(180deg, ${color}, ${color}44)` }} />
      ))}
    </div>
  );
}

/* ───────────────────────── Shell pieces ───────────────────────── */
const NAV = [
  ["overview", "Overview", FaGaugeHigh],
  ["channels", "Channels", FaComments],
  ["ads", "Marketing & Ads", FaBullhorn],
  ["leads", "Leads", FaUsers],
  ["support", "Support", FaHeadset],
  ["docs", "Documents", FaFileLines],
];

function Card({ children, className = "" }) {
  return <div className={`rounded-xl2 border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 ${className}`}>{children}</div>;
}

/* ───────────────────────── Views ───────────────────────── */
function Overview() {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card>
              <div className="flex items-center justify-between">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] text-xl">{k.ic}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: k.color + "22", color: k.color }}>
                  <FaArrowTrendUp size={10} /> {k.note || `+${k.delta}%`}
                </span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-g-word tracking-tight"><Count to={k.num} prefix={k.pre} suffix={k.suf} /></div>
              <div className="text-[11px] text-g-muted">{k.label}</div>
              <div className="mt-2"><Spark color={k.color} h={32} /></div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold">Revenue · last 12 months</div>
            <div className="text-xs text-g-muted">+186% YoY</div>
          </div>
          <Bars />
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">Live activity</div>
          <ul className="space-y-3">
            {ACTIVITY.map(([ic, ch, msg, t]) => (
              <li key={ch + t} className="flex items-start gap-3">
                <span className="text-lg shrink-0">{ic}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-g-word">{ch} <span className="text-g-green">· AI</span></div>
                  <div className="text-[11px] text-g-muted leading-snug">{msg}</div>
                </div>
                <span className="ml-auto text-[10px] text-g-light whitespace-nowrap">{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <div className="text-sm font-extrabold text-g-word">Guileo saved you ~<span className="text-g-light"><Count to={62} suffix=" hrs" /></span> this month</div>
            <div className="text-xs text-g-muted mt-0.5">…and recovered <b className="text-g-green">$18,420</b> that would've slipped away.</div>
          </div>
          <a href={waLink("I'd like to review my Guileo results this month")} target="_blank" rel="noopener" className="btn-bright text-sm">Talk to my team →</a>
        </div>
      </Card>
    </div>
  );
}

function Channels() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {CHANNELS.map((c) => (
        <Card key={c.name}>
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-white/[0.07]" style={{ color: c.color }}><c.Icon size={20} /></span>
            <div><div className="text-sm font-extrabold text-g-word">{c.name}</div><div className="text-[11px] text-g-muted">{c.note}</div></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div><div className="text-xl font-extrabold text-g-word"><Count to={c.convos} /></div><div className="text-[10px] uppercase tracking-wide text-g-muted">Conversations</div></div>
            <div><div className="text-xl font-extrabold text-g-green"><Count to={c.won} /></div><div className="text-[10px] uppercase tracking-wide text-g-muted">Won / booked</div></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Ads() {
  const totalSpend = CAMPAIGNS.reduce((s, c) => s + c.spend, 0);
  const totalLeads = CAMPAIGNS.reduce((s, c) => s + c.leads, 0);
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">Ad spend</div><div className="text-2xl font-extrabold text-g-word mt-1"><Count to={totalSpend} prefix="$" /></div></Card>
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">Leads generated</div><div className="text-2xl font-extrabold text-g-light mt-1"><Count to={totalLeads} /></div></Card>
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">Avg. ROAS</div><div className="text-2xl font-extrabold text-g-green mt-1">4.1×</div></Card>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Campaigns</div>
        <div className="divide-y divide-white/[0.06]">
          {CAMPAIGNS.map((c) => (
            <div key={c.name} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name}</div><div className="text-[11px] text-g-muted">${c.spend} spend · {c.leads} leads</div></div>
              <div className="text-right"><div className="text-xs text-g-muted">CPL</div><div className="text-sm font-bold text-g-word">${c.cpl}</div></div>
              <div className="text-right w-16"><div className="text-xs text-g-muted">ROAS</div><div className={`text-sm font-extrabold inline-flex items-center gap-1 ${c.up ? "text-g-green" : "text-red-400"}`}>{c.up ? <FaArrowTrendUp size={11} /> : <FaArrowTrendDown size={11} />}{c.roas}×</div></div>
            </div>
          ))}
        </div>
      </Card>
      <p className="text-xs text-g-muted text-center">Connect Meta &amp; Google Ads to see live campaign data here. <a href={waLink("I want to connect my ad accounts to Guileo")} target="_blank" rel="noopener" className="text-g-gold font-semibold hover:underline">Connect accounts →</a></p>
    </div>
  );
}

function Leads() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-g-gold">Recent leads</span>
        <span className="text-[11px] text-g-muted">{LEADS.length} this hour</span>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {LEADS.map((l, i) => (
          <motion.div key={l.name + i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 px-5 py-3">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{l.name[0]}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{l.name}</div><div className="text-[11px] text-g-muted">{l.ch} · {l.when}</div></div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: l.color + "22", color: l.color }}>{l.status}</span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function Support() {
  const [sent, setSent] = useState(false);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <div className="text-sm font-extrabold text-g-word">👋 Your Guileo team</div>
        <p className="text-xs text-g-muted mt-1">A real human manages your system. Reach out anytime — usually replies within hours.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={waLink("Hi Guileo team! I need help with my account")} target="_blank" rel="noopener" className="btn-bright text-sm">💬 Message my team</a>
          <a href="/#contact" className="btn-ghost text-sm">Book a call</a>
        </div>
      </Card>
      <Card>
        <div className="text-sm font-extrabold text-g-word">Request a change</div>
        <p className="text-xs text-g-muted mt-1">Want to tweak your AI, add a channel, or launch a campaign? Tell us.</p>
        {!sent ? (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="mt-3 space-y-2">
            <textarea required rows={3} placeholder="e.g. Add a Telegram agent and a weekend promo campaign…" className="w-full rounded-xl2 border border-white/15 bg-black/20 px-4 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
            <button className="btn-bright text-sm w-full">Send request →</button>
          </form>
        ) : (
          <div className="mt-3 rounded-xl2 border border-g-green/40 bg-g-green/[0.1] p-4 text-sm font-bold text-g-light text-center">✅ Got it — your team will follow up shortly.</div>
        )}
      </Card>
    </div>
  );
}

function Docs() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Documents &amp; billing</div>
      <div className="divide-y divide-white/[0.06]">
        {DOCS.map(([ic, name, meta, action]) => (
          <div key={name} className="flex items-center gap-3 px-5 py-3.5">
            <span className="text-xl">{ic}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{name}</div><div className="text-[11px] text-g-muted">{meta}</div></div>
            <button className="text-xs font-bold text-g-gold hover:underline">{action}</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

const VIEWS = { overview: Overview, channels: Channels, ads: Ads, leads: Leads, support: Support, docs: Docs };

/* ───────────────────────── Login gate (demo) ───────────────────────── */
function Login({ onEnter }) {
  return (
    <div className="min-h-screen grid place-items-center px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-xl3 border border-white/12 bg-white/[0.04] backdrop-blur-xl p-8 shadow-lift text-center">
        <img src={logo} alt="Guileo" className="h-12 w-12 object-contain mx-auto" />
        <div className="mt-3 text-xl font-black uppercase tracking-tight bg-gradient-to-r from-g-green via-g-gold to-g-green bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">Growth Cockpit</div>
        <p className="text-xs text-g-muted mt-1">Sign in to your private dashboard</p>
        <form onSubmit={(e) => { e.preventDefault(); onEnter(); }} className="mt-6 space-y-2.5 text-left">
          <input type="email" required placeholder="you@email.com" className="w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <input type="password" required placeholder="Password" className="w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <button className="btn-bright text-sm w-full">Enter Growth Cockpit →</button>
        </form>
        <button onClick={onEnter} className="mt-3 text-xs font-bold text-g-gold hover:underline">▶ Enter demo (sample data)</button>
        <div className="mt-4 text-[11px] text-g-muted"><a href="/" className="hover:text-g-word">← Back to guileo.ai</a></div>
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */
export default function Portal() {
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState("overview");
  const [period, setPeriod] = useState("30 days");
  const View = VIEWS[view];

  if (!authed) return <div className="min-h-screen text-g-ink"><Login onEnter={() => setAuthed(true)} /></div>;

  return (
    <div className="min-h-screen text-g-ink flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-60 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-white/10 bg-white/[0.03] backdrop-blur-xl lg:sticky lg:top-0">
        <div className="flex items-center gap-2 px-5 py-4">
          <img src={logo} alt="Guileo" className="h-8 w-8 object-contain" />
          <div className="leading-tight"><div className="text-sm font-extrabold text-g-word">Growth Cockpit</div><div className="text-[10px] text-g-muted">{BUSINESS.name}</div></div>
        </div>
        <nav className="flex lg:flex-col gap-1 px-3 pb-3 overflow-x-auto">
          {NAV.map(([key, label, Icon]) => {
            const on = view === key;
            return (
              <button key={key} onClick={() => setView(key)}
                className={`relative flex items-center gap-3 rounded-xl2 px-3.5 py-2.5 text-sm font-bold whitespace-nowrap transition-colors ${on ? "text-g-word" : "text-g-muted hover:text-g-word"}`}>
                {on && <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl2 bg-white/[0.07] border border-g-gold/30" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                <Icon size={15} className="relative" /><span className="relative">{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="hidden lg:block px-5 mt-auto py-4">
          <a href="/" className="inline-flex items-center gap-2 text-xs font-bold text-g-muted hover:text-g-gold transition"><FaArrowLeft size={11} /> Back to site</a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* topbar */}
        <header className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-md sticky top-0 z-20">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-g-word capitalize">{NAV.find(n => n[0] === view)[1]}</h1>
            <p className="text-[11px] text-g-muted">{BUSINESS.name} · {BUSINESS.place} · {BUSINESS.since}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] p-1">
              {["7 days", "30 days", "90 days"].map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-3 py-1 text-xs font-bold transition ${period === p ? "bg-g-gold/15 text-g-gold" : "text-g-muted hover:text-g-word"}`}>{p}</button>
              ))}
            </div>
            <span className="grid place-items-center h-9 w-9 rounded-full bg-g-green/15 text-sm font-extrabold text-g-light">{BUSINESS.name[0]}</span>
          </div>
        </header>

        {/* demo banner */}
        <div className="px-5 sm:px-8 pt-4">
          <div className="rounded-full border border-g-gold/30 bg-g-gold/[0.08] px-4 py-2 text-[11px] font-bold text-g-gold inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" /> Demo data — your real numbers appear once your system is live.
          </div>
        </div>

        {/* content — keyed remount = clean fade-in per view (no stuck-exit) */}
        <div className="p-5 sm:p-8">
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <View />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
