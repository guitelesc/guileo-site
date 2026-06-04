import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { portalApi, CONNECTED, toast, onToast } from "../lib/portalApi.js";
import {
  FaGaugeHigh, FaComments, FaBullhorn, FaUsers, FaHeadset, FaFileLines, FaListCheck,
  FaArrowLeft, FaArrowTrendUp, FaArrowTrendDown, FaWhatsapp, FaInstagram, FaPhone, FaFacebook, FaTiktok, FaGoogle,
  FaReceipt, FaUtensils, FaBookOpen, FaBullseye, FaPhoneVolume, FaCommentSms, FaGear, FaChartLine,
  FaDownload, FaBell, FaMagnifyingGlass, FaStore, FaBrain, FaCreditCard, FaChevronDown, FaShareNodes,
  FaArrowsRotate, FaClock, FaStar, FaIdCard,
} from "react-icons/fa6";

/* Upsell channel — services a client can request from inside the portal (revenue engine) */
const ADDONS = [
  ["💬", "Add a Telegram / Messenger agent", "One more channel your AI answers 24/7."],
  ["📣", "Launch Meta & Google Ads", "We run and optimize your paid growth."],
  ["🌐", "New website or landing page", "Built to convert — live in days."],
  ["🔎", "SEO & Google Business", "Show up first when people search nearby."],
  ["🎁", "Loyalty & win-back program", "Bring customers back automatically."],
  ["📍", "Add another location", "Same system, brand-new store."],
  ["🛒", "Online ordering / store", "Sell direct — keep the commissions."],
  ["📧", "Email & SMS automation", "Follow-ups that recover revenue."],
  ["🤖", "Custom automation", "Connect your tools, automate a workflow."],
];

/* Generic builders — give EVERY sector the Guileo AI screens (voice/calls, chats, customers…) from its own data */
const _PHONES = ["+1 (917) 555-0142", "+1 (646) 555-0199", "+1 (917) 555-0177", "+1 (305) 555-0188"];
const _NOUN = { "Clinic": "visits", "Medical": "visits", "Law Firm": "matters", "Real Estate": "deals", "Salon & Spa": "visits", "Gym & Fitness": "check-ins", "Education": "classes", "Construction": "projects", "Plumbing & HVAC": "jobs", "Auto Dealership": "deals" };
// Who handles each booking (provider / staff) — gives the schedule real operational meaning
const STAFF = {
  "Restaurant": ["Server Ana", "Server Léo", "Host stand"],
  "Clinic": ["Dr. Ferreira", "Dr. Mendes", "Dr. Lopes", "Dr. Rocha"],
  "Medical": ["Dr. Alves", "Dr. Castro", "Dr. Nunes", "Dr. Pires"],
  "Salon & Spa": ["Bianca", "Tom", "Léa", "Marco"],
  "Law Firm": ["R. Mendes", "A. Costa", "P. Lima"],
  "E-Commerce": ["Fulfillment", "Packing", "Support AI"],
  "Real Estate": ["Agent Rui", "Agent Bea", "Agent Tom"],
  "Gym & Fitness": ["Coach Léo", "Coach Maya", "Front desk"],
  "Plumbing & HVAC": ["Tech Mike", "Tech Sara", "Tech Bruno"],
  "Auto Dealership": ["Sales · Rui", "Service bay 2", "Sales · Ana"],
  "Education": ["Teacher Ana", "Teacher Caio", "Teacher Bia"],
  "Construction": ["Crew A", "Crew B", "Estimator João"],
};
const ROOM = { "Clinic": ["Room 1", "Room 2", "Room 3", "Room 4"], "Medical": ["Room 1", "Room 2", "Room 3", "Room 4", "Room 5", "Room 6"], "Salon & Spa": ["Station 1", "Station 2", "Station 3", "Spa room"] };
const staffOf = (label, i) => { const a = STAFF[label] || []; return a.length ? a[i % a.length] : null; };
const roomOf = (label, i) => { const a = ROOM[label] || []; return a.length ? a[i % a.length] : null; };
const _dur = ["30 min", "45 min", "1 h", "1 h 30", "20 min"];
// Anti-no-show deposits (the capacity-protection money lever) — $ held per booking by sector
const DEPOSIT = { "Restaurant": 20, "Clinic": 30, "Medical": 40, "Salon & Spa": 25, "Plumbing & HVAC": 50, "Gym & Fitness": 0, "Auto Dealership": 0, "Construction": 0, "Education": 0, "Law Firm": 0, "Real Estate": 0, "E-Commerce": 0 };
function genCalls(V) {
  const sch = (V.ops?.schedule || []).slice(0, 4);
  if (sch.length) return sch.map((p, i) => ({ name: p.name, phone: _PHONES[i % 4], outcome: p.meta ? `${p.meta} · booked by AI` : "Handled by AI", dur: `${1 + (i % 2)}m ${(12 + i * 9) % 60}s`, time: `${2 + i * 12} min ago`, color: ["#3E9468", "#38BDF8", "#3E9468", "#7C7C7C"][i % 4] }));
  return (V.activity || []).slice(0, 4).map((a, i) => ({ name: "Caller", phone: _PHONES[i % 4], outcome: a[2], dur: "1m 02s", time: a[3], color: "#3E9468" }));
}
function genConvos(V) {
  return (V.activity || []).slice(0, 4).map((a, i) => ({ name: (V.ops?.schedule?.[i]?.name) || a[1], last: a[2], t: a[3], unread: i === 1 ? 1 : 0 }));
}
function genCustomers(V) {
  const noun = _NOUN[V.label] || "orders";
  return (V.ops?.schedule || []).slice(0, 4).map((p, i) => ({ name: p.name, orders: 24 - i * 5, spent: (600 - i * 120) + 0.5, last: `${2 + i * 15} min ago`, channel: p.ch && p.ch !== "—" ? p.ch : "WhatsApp", noun }));
}
function genCampaigns(V) {
  const ch = (V.channelMix?.items?.[0]?.[0]) || "WhatsApp";
  return [
    { name: "Reactivation · lapsed leads", channel: ch, sent: 840, opened: 46, revenue: 1240, status: "Active" },
    { name: "Promo · this week", channel: "Email", sent: 520, opened: 38, revenue: 820, status: "Active" },
    { name: "Win-back · 30 days inactive", channel: "SMS", sent: 300, opened: 41, revenue: 560, status: "Scheduled" },
  ];
}
function genAudiences() {
  return [
    { name: "Repeat customers", size: 412, source: "CRM" },
    { name: "Lapsed (no activity 30d)", size: 188, source: "CRM" },
    { name: "Lookalike · top value", size: 22000, source: "Meta" },
    { name: "Local · 3mi radius", size: 48000, source: "Google" },
  ];
}
// Growth attribution ledger — the basis of the revenue-share model
function genImpact(V) {
  const events = [
    ["now", "Recovered a missed call → booking", 120],
    ["14m", "Filled a cancelled slot from waitlist", 80],
    ["1h", "Won back a lapsed customer", 240],
    ["2h", "Reactivated a recall / repeat visit", 160],
    ["3h", "Turned a 5★ review into a new lead", 90],
    ["5h", "Captured an after-hours inquiry", 180],
  ];
  return { total: V.impact?.total || 0, parts: V.impact?.parts || [], events, sharePct: 12 };
}
// Universal "money leak" engine — un-converted leads, stalled quotes, trials, recalls the AI chases
function genFollowups(V) {
  const sch = V.ops?.schedule || [];
  const TYPE = { "Law Firm": "Unsigned lead", "Construction": "Open estimate", "Real Estate": "Warm buyer", "Gym & Fitness": "Trial no-show", "Auto Dealership": "Test-drive lead", "Education": "Trial student", "Plumbing & HVAC": "Open quote", "Clinic": "Unconfirmed recall", "Medical": "Unconfirmed follow-up", "Salon & Spa": "No rebook yet", "E-Commerce": "Abandoned cart", "Restaurant": "Unconfirmed reservation" };
  const t = TYPE[V.label] || "Open lead";
  const base = sch.filter((r) => /pending|new|follow|risk/i.test(r.status));
  return (base.length ? base : sch).slice(0, 5).map((r, i) => ({ name: r.name, type: t, stage: (i % 3) + 1, value: 120 + i * 90, next: ["Nudge today", "Call back", "Send offer", "Final follow-up"][i % 4], ch: r.ch && r.ch !== "—" ? r.ch : "WhatsApp" }));
}
// Waitlist — turn empty capacity into revenue
function genWaitlist(V) {
  const WANT = { "Restaurant": "Table for 2 tonight", "Clinic": "Earlier cleaning slot", "Medical": "Earlier appointment", "Salon & Spa": "Saturday haircut", "Gym & Fitness": "HIIT 7am spot", "Auto Dealership": "Service this week", "Plumbing & HVAC": "Same-day visit", "Education": "Evening class seat" };
  const w = WANT[V.label] || "Earlier slot";
  return (V.ops?.schedule || []).slice(0, 4).map((r, i) => ({ name: r.name, want: w, since: `${5 + i * 7} min ago`, ch: r.ch && r.ch !== "—" ? r.ch : "WhatsApp" }));
}
// Reviews — reputation drives new demand (a growth lever)
function genReviews(V) {
  const names = (V.ops?.schedule || []).map((r) => r.name).filter(Boolean);
  const texts = ["Amazing — fast and so friendly!", "Best experience, highly recommend 🙌", "They handled everything for me, so easy.", "Quick reply and great service.", "Will 100% come back!"];
  return (names.length ? names : ["Marcos A.", "Maria S.", "Pedro L.", "Ana R.", "Bruno T."]).slice(0, 5).map((n, i) => ({ name: n, stars: i === 4 ? 4 : 5, text: texts[i % texts.length], ch: ["Google", "Instagram", "WhatsApp"][i % 3] }));
}
// Recurring revenue — memberships / plans / subscriptions (the most valuable revenue)
function genRecurring(V) {
  const PLAN = { "Gym & Fitness": "Monthly membership", "Clinic": "Recall plan", "Medical": "Care plan", "Salon & Spa": "Glow package", "Plumbing & HVAC": "Maintenance plan", "Auto Dealership": "Service plan", "Education": "Course subscription", "Restaurant": "VIP club", "E-Commerce": "Replenish subscription", "Real Estate": "Property mgmt", "Law Firm": "Retainer", "Construction": "Service contract" };
  const p = PLAN[V.label] || "Membership";
  return (V.ops?.schedule || []).slice(0, 5).map((r, i) => ({ name: r.name, plan: p, value: 39 + i * 12, status: i === 3 ? "Renews soon" : i === 4 ? "At risk" : "Active", color: i === 3 ? "#D6C29A" : i === 4 ? "#EF4444" : "#3E9468" }));
}
import logo from "../assets/guileo-logo.png";
import { Count } from "../lib/ui.jsx";
import { waLink } from "../data/contact.js";
import { VERTICALS, VERTICAL_KEYS } from "../data/verticals.js";

/* ───────────────────────── Mock data (demo — swap for Supabase/integrations later) ───────────────────────── */

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
// Per-sector operational screens (reuse Schedule/Catalog renderers, named per industry).
const SECTOR_NAV = {
  clinic: [["schedule", "Appointments"], ["catalog", "Procedures"]],
  medical: [["schedule", "Appointments"], ["catalog", "Specialties"]],
  salon: [["schedule", "Schedule"], ["catalog", "Services"]],
  law: [["schedule", "Intakes"], ["catalog", "Matter types"]],
  ecommerce: [["schedule", "Orders"], ["catalog", "Products"]],
  realestate: [["schedule", "Viewings"], ["catalog", "Listings"]],
  gym: [["schedule", "Classes & trials"], ["catalog", "Class types"]],
  homeservices: [["schedule", "Jobs"], ["catalog", "Services"]],
  auto: [["schedule", "Test drives"], ["catalog", "Models"]],
  education: [["schedule", "Classes & trials"], ["catalog", "Courses"]],
  construction: [["schedule", "Site visits"], ["catalog", "Project types"]],
};
// Every sector gets the full Guileo experience — voice/calls, WhatsApp, SMS, Social, AI training — because that IS what Guileo is.
function sectionsFor(vid, V) {
  if (V.sections) return V.sections; // restaurant has a bespoke nav from its reference tool
  const sec = SECTOR_NAV[vid] || [["operations", "Operations"]];
  return [
    ["overview", "Overview"], ["impact", "Guileo Impact"], ["brain", "Train your AI"], ["analytics", "AI Analytics"],
    ...sec,
    ["followups", "Follow-ups"], ["waitlist", "Waitlist"], ["recurring", "Recurring"], ["reputation", "Reputation"],
    ["customers", "Customers"], ["campaigns", "Campaigns"], ["audiences", "Ad Audiences"],
    ["calllogs", "Call Logs"], ["dialer", "Call Dialer"], ["whatsapp", "WhatsApp"], ["sms", "SMS"], ["social", "Social"],
    ["grow", "Grow with Guileo"], ["billing", "Billing & Plan"], ["support", "Support"], ["settings", "Settings"],
  ];
}
// Red notification counts per menu item — drives urgency badges in the sidebar
function notifFor(key, V) {
  switch (key) {
    case "overview": return V.alerts ? V.alerts.items.length : 0;
    case "liveorders": return (V.liveOrders || []).filter((o) => o.status !== "Delivered").length;
    case "kitchen": return ((V.kitchen?.new || []).length + (V.kitchen?.preparing || []).length);
    case "schedule": return (V.ops?.schedule || []).filter((r) => /pending|new|unassigned|risk|follow/i.test(r.status)).length;
    case "calllogs": return 2;
    case "whatsapp": return 1;
    case "sms": return 1;
    case "social": return 3;
    case "followups": return 3;
    case "waitlist": return 2;
    case "recurring": return 1;
    default: return 0;
  }
}
const SECTION_ICON = {
  overview: FaGaugeHigh, operations: FaListCheck, schedule: FaListCheck, catalog: FaBookOpen, brain: FaBrain, analytics: FaChartLine, liveorders: FaReceipt,
  kitchen: FaUtensils, menu: FaBookOpen, customers: FaUsers, campaigns: FaBullhorn, audiences: FaBullseye,
  calllogs: FaPhone, dialer: FaPhoneVolume, whatsapp: FaWhatsapp, sms: FaCommentSms, social: FaShareNodes, grow: FaStore, billing: FaCreditCard,
  impact: FaArrowTrendUp, followups: FaArrowsRotate, waitlist: FaClock, recurring: FaIdCard, reputation: FaStar,
  channels: FaComments, ads: FaBullhorn, leads: FaUsers, support: FaHeadset, docs: FaFileLines, settings: FaGear,
};
// Group the (long) nav into scannable categories
const NAV_GROUPS = [
  ["", ["overview"]],
  ["Your AI ✨", ["brain", "analytics"]],
  ["Grow revenue", ["impact", "followups", "waitlist", "recurring", "reputation", "campaigns", "audiences", "grow"]],
  ["Operations", ["liveorders", "kitchen", "menu", "schedule", "catalog", "operations"]],
  ["Conversations", ["calllogs", "dialer", "whatsapp", "sms", "social"]],
  ["Customers", ["customers"]],
  ["Account", ["billing", "support", "settings"]],
];

function Card({ children, className = "" }) {
  return <div className={`rounded-xl2 border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 ${className}`}>{children}</div>;
}
// Transient action feedback, bottom-center
function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => onToast((text) => {
    const id = `${text}-${performance.now()}`;
    setItems((x) => [...x, { id, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 2600);
  }), []);
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {items.map((i) => (
          <motion.div key={i.id} initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            className="rounded-full bg-g-cream/95 backdrop-blur-xl border border-g-green/35 px-4 py-2 text-xs font-bold text-g-word shadow-lift">{i.text}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
// Slide-over detail panel — click any row to see everything + act on it
function Drawer({ title, subtitle, badge, fields, note, actions, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-g-cream/95 backdrop-blur-xl border-l border-white/12 shadow-2xl overflow-y-auto flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="min-w-0"><div className="text-base font-extrabold text-g-word truncate">{title}</div>{subtitle && <div className="text-xs text-g-muted mt-0.5">{subtitle}</div>}</div>
          <div className="flex items-center gap-2 shrink-0">{badge}<button onClick={onClose} aria-label="Close" className="text-g-muted hover:text-g-word text-lg leading-none px-1">✕</button></div>
        </div>
        <div className="p-5 space-y-2.5 flex-1">
          {fields.filter(([, v]) => v != null && v !== "").map(([k, v], i) => (
            <div key={i} className="flex justify-between gap-4 text-sm"><span className="text-g-muted">{k}</span><span className="font-bold text-g-word text-right">{v}</span></div>
          ))}
          {note && <div className="mt-3 rounded-xl2 border border-g-green/25 bg-g-green/[0.06] p-3 text-xs text-g-light"><div className="text-[10px] font-black uppercase text-g-green mb-1">🧠 Guileo AI notes</div>{note}</div>}
        </div>
        {actions && <div className="p-4 border-t border-white/10 flex flex-wrap gap-2">{actions}</div>}
      </motion.div>
    </>
  );
}
// Reusable summary strip — adds depth (stats header) to any list screen
function MiniStats({ items }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(([label, value, tone], i) => (
        <Card key={i} className="py-3.5">
          <div className="text-[10px] uppercase tracking-wide text-g-muted">{label}</div>
          <div className={`text-lg font-extrabold mt-0.5 ${tone === "good" ? "text-g-green" : tone === "bad" ? "text-red-400" : "text-g-word"}`}>{value}</div>
        </Card>
      ))}
    </div>
  );
}

/* ───────────────────────── Views ───────────────────────── */
function Overview({ V, onNav }) {
  const [resolved, setResolved] = useState([]);
  const openAlerts = V.alerts ? V.alerts.items.map((a, i) => ({ a, i })).filter(({ i }) => !resolved.includes(i)) : [];
  const quick = (V.quick || [["📋", "See today's operations", "ops"], ["💬", "Message my team", "support"], ["📣", "Ask for a campaign", "wa"]]).map(([ic, label, kind]) =>
    kind === "ops" ? { ic, label, on: () => onNav("operations") }
      : kind === "support" ? { ic, label, on: () => onNav("support") }
        : { ic, label, href: waLink(`Guileo — ${label}`) }
  );
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-g-word">Dashboard Overview</h2>
        <p className="text-xs text-g-muted">Welcome back — here's what's happening at {V.business.name} today.</p>
      </div>

      {/* NEEDS ATTENTION — urgency first, above results · actionable */}
      {V.alerts && (
        <Card className={`${openAlerts.length ? "border-red-500/30 bg-red-500/[0.06]" : "border-g-green/30 bg-g-green/[0.05]"}`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className={`text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${openAlerts.length ? "text-red-400" : "text-g-green"}`}><span className={openAlerts.length ? "animate-pulse" : ""}>{openAlerts.length ? "⚠" : "✅"}</span> {V.alerts.title}</div>
            <span className={`text-[11px] font-bold ${openAlerts.length ? "text-red-400" : "text-g-green"}`}>{openAlerts.length ? `${openAlerts.length} need action` : "All clear 🎉"}</span>
          </div>
          {openAlerts.length ? (
            <div className="grid sm:grid-cols-3 gap-2">
              {openAlerts.map(({ a, i }) => {
                const c = a.level === "danger" ? "#EF4444" : a.level === "warn" ? "#D6C29A" : "#38BDF8";
                return (
                  <div key={i} className="rounded-xl2 border-l-2 bg-white/[0.05] px-3 py-2.5 text-xs text-g-word" style={{ borderColor: c }}>
                    <div className="flex items-start gap-2"><span style={{ color: c }}>⚠</span>{a.text}</div>
                    <button onClick={() => { portalApi.resolveAlert(i); setResolved((r) => [...r, i]); toast("Alert resolved ✓"); }} className="mt-2 text-[10px] font-bold text-g-green hover:underline">Resolve ✓</button>
                  </div>
                );
              })}
            </div>
          ) : <div className="text-xs text-g-muted">Everything's handled — your AI is on top of it. 👏</div>}
        </Card>
      )}

      {/* PROFIT IMPACT — money first (the only thing the owner must see) */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-g-green/[0.12] to-g-gold/[0.06] border-g-green/30">
        <div className="absolute -top-16 -right-12 h-40 w-40 rounded-full bg-g-green/15 blur-3xl pointer-events-none animate-aurora" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold">Guileo profit impact · this month</div>
            <div className="text-4xl sm:text-5xl font-black text-g-word tracking-tight mt-1"><Count to={V.impact.total} prefix="$" /></div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {V.impact.parts.map(([label, val]) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold">
                  <span className="text-g-green">{val}</span><span className="text-g-muted">{label}</span>
                </span>
              ))}
            </div>
          </div>
          <a href={waLink("I'd like to review my Guileo results this month")} target="_blank" rel="noopener" className="btn-bright text-sm">Talk to my team →</a>
        </div>
      </Card>

      <div className={`grid gap-4 grid-cols-2 ${V.kpis.length >= 6 ? "md:grid-cols-3 xl:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {V.kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card>
              <div className="flex items-center justify-between">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] text-xl">{k.ic}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: (k.good ? "#3E9468" : k.color) + "22", color: k.good ? "#3E9468" : k.color }}>
                  {k.good ? <FaArrowTrendDown size={10} /> : <FaArrowTrendUp size={10} />} {k.note || (k.delta != null ? `+${k.delta}%` : "live")}
                </span>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-g-word tracking-tight"><Count to={k.num} prefix={k.pre || ""} suffix={k.suf || ""} /></div>
              <div className="text-[11px] text-g-muted">{k.label}</div>
              <div className="mt-2"><Spark data={V.revenue} color={k.color} h={32} /></div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* TODAY + QUICK ACTIONS — surface ops on the home screen (fewer clicks) */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{V.ops.scheduleTitle} · next up</span>
            <button onClick={() => onNav("operations")} className="text-[11px] font-bold text-g-gold hover:underline">See all →</button>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {V.ops.schedule.slice(0, 3).map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="text-xs font-bold text-g-light w-20 shrink-0 inline-block truncate align-middle" title={r.time}>{r.time}</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted truncate">{r.meta}{r.ch && r.ch !== "—" ? ` · ${r.ch}` : ""}</div></div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: r.color + "22", color: r.color }}>{r.status}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">Quick actions</div>
          <div className="space-y-2">
            {quick.map((q) => q.href ? (
              <a key={q.label} href={q.href} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl2 border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-g-word hover:border-g-gold/40 hover:-translate-y-0.5 transition-all"><span>{q.ic}</span>{q.label}<span className="ml-auto text-g-gold">→</span></a>
            ) : (
              <button key={q.label} onClick={q.on} className="w-full text-left flex items-center gap-3 rounded-xl2 border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-g-word hover:border-g-gold/40 hover:-translate-y-0.5 transition-all"><span>{q.ic}</span>{q.label}<span className="ml-auto text-g-gold">→</span></button>
            ))}
          </div>
        </Card>
      </div>

      {/* Revenue + channel breakdown (or live activity) */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold">Revenue &amp; order volume</div>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-g-muted"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-g-gold" />Revenue</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-g-green" />Orders</span></div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />Live sync</span>
          </div>
          <Bars data={V.revenue} />
        </Card>
        {V.channelMix ? (
          <Card>
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{V.channelMix.title}</div>
            <div className="text-[11px] text-g-muted mb-3">{V.channelMix.sub}</div>
            {V.channelMix.items.map(([label, pct], i) => (
              <div key={i} className="mb-2.5 last:mb-0">
                <div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{label}</span><span className="text-g-muted">{pct}%</span></div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-g-green" style={{ width: `${pct}%` }} /></div>
              </div>
            ))}
          </Card>
        ) : (
          <Card>
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">Live activity</div>
            <ul className="space-y-3">
              {V.activity.map(([ic, ch, msg, t], i) => (
                <li key={ch + t + i} className="flex items-start gap-3">
                  <span className="text-lg shrink-0">{ic}</span>
                  <div className="min-w-0"><div className="text-xs font-bold text-g-word">{ch} <span className="text-g-green">· AI</span></div><div className="text-[11px] text-g-muted leading-snug">{msg}</div></div>
                  <span className="ml-auto text-[10px] text-g-light whitespace-nowrap">{t}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Rich row: top selling (restaurant) + recent activity */}
      {(V.topItems || V.channelMix) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {V.topItems && (
          <Card>
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{V.topItems.title}</div>
            <div className="space-y-3">
              {V.topItems.items.map((it, i) => {
                const max = Math.max(...V.topItems.items.map((x) => x.sold));
                return (
                  <div key={i}>
                    <div className="flex justify-between items-baseline text-xs mb-1"><span className="font-bold text-g-word uppercase truncate pr-2">{it.name}</span><span className="text-g-muted whitespace-nowrap">{it.sold} sold · <span className="text-g-green font-bold">${it.rev.toFixed(2)}</span></span></div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${(it.sold / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </Card>
          )}
          {V.channelMix && (
          <Card>
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">Recent activity</div>
            <ul className="space-y-3">
              {V.activity.map(([ic, ch, msg, t], i) => (
                <li key={ch + t + i} className="flex items-start gap-3">
                  <span className="text-lg shrink-0">{ic}</span>
                  <div className="min-w-0"><div className="text-xs font-bold text-g-word">{ch} <span className="text-g-green">· AI</span></div><div className="text-[11px] text-g-muted leading-snug">{msg}</div></div>
                  <span className="ml-auto text-[10px] text-g-light whitespace-nowrap">{t}</span>
                </li>
              ))}
            </ul>
          </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Operations({ V }) {
  const o = V.ops;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        {o.stats.map((s) => (
          <Card key={s.label}>
            <div className="text-[11px] uppercase tracking-wide text-g-muted">{s.label}</div>
            <div className={`text-2xl font-extrabold mt-1 ${s.tone === "good" ? "text-g-green" : "text-g-word"}`}>{s.value}</div>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{o.scheduleTitle}</div>
          <div className="divide-y divide-white/[0.06]">
            {o.schedule.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="text-xs font-bold text-g-light w-20 shrink-0 inline-block truncate align-middle" title={r.time}>{r.time}</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted truncate">{r.meta}{r.ch && r.ch !== "—" ? ` · ${r.ch}` : ""}</div></div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: r.color + "22", color: r.color }}>{r.status}</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          {o.grid && (
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{o.gridTitle}</div>
              <div className="grid grid-cols-4 gap-2">
                {o.grid.map((g, i) => (
                  <div key={i} className={`grid place-items-center h-10 rounded-lg text-xs font-bold border ${g.on ? "border-g-green/50 bg-g-green/15 text-g-light" : "border-white/10 bg-white/[0.03] text-g-muted"}`}>{g.label}</div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-g-muted">● in use · ○ free</div>
            </Card>
          )}
          {o.list && (
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{o.listTitle}</div>
              {o.list.map((it, i) => {
                const max = Math.max(...o.list.map((x) => x.val));
                return (
                  <div key={i} className="mb-2.5 last:mb-0">
                    <div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{it.name}</span><span className="text-g-muted">{it.val}</span></div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${(it.val / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>

      {(o.mix || o.peak || o.channels) && (
        <div className="grid lg:grid-cols-3 gap-4">
          {o.mix && (
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{o.mix.title}</div>
              {o.mix.items.map(([label, val], i) => {
                const total = o.mix.items.reduce((s, x) => s + x[1], 0);
                return (
                  <div key={i} className="mb-2.5 last:mb-0">
                    <div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{label}</span><span className="text-g-muted">{Math.round((val / total) * 100)}%</span></div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${(val / total) * 100}%` }} /></div>
                  </div>
                );
              })}
            </Card>
          )}
          {o.peak && (
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{o.peak.title}</div>
              <Bars data={o.peak.data} color="#D6C29A" />
              {o.peak.labels && <div className="mt-1 flex justify-between text-[9px] text-g-muted">{o.peak.labels.map((l, i) => <span key={i}>{l}</span>)}</div>}
            </Card>
          )}
          {o.channels && (
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{o.channels.title}</div>
              {o.channels.items.map(([label, val], i) => (
                <div key={i} className="mb-2.5 last:mb-0">
                  <div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{label}</span><span className="text-g-muted">{val}%</span></div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-g-green" style={{ width: `${val}%` }} /></div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
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
            <textarea required rows={3} aria-label="Describe your change request" placeholder="e.g. Add a Telegram agent and a weekend promo campaign…" className="w-full rounded-xl2 border border-white/15 bg-black/20 px-4 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
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
            <button aria-label={`${action} — ${name}`} className="text-xs font-bold text-g-gold hover:underline">{action}</button>
          </div>
        ))}
      </div>
    </Card>
  );
}


/* ───────────────────────── Sector screens (restaurant + reusable) ───────────────────────── */
function LiveOrders({ V }) {
  const rows = V.liveOrders || [];
  const [sel, setSel] = useState(null);
  return (
    <>
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">Live orders</span><span className="text-[11px] text-g-muted inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{rows.length} active</span></div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map((o, i) => (
          <button key={i} onClick={() => setSel(o)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
            <span className="text-xs font-bold text-g-light w-16 shrink-0">{o.id}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{o.customer}</div><div className="text-[11px] text-g-muted truncate">{o.items} · {o.channel}</div></div>
            <span className="text-sm font-extrabold text-g-word">${o.total.toFixed(2)}</span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: o.color + "22", color: o.color }}>{o.status}</span>
          </button>
        ))}
      </div>
    </Card>
    {sel && (
      <Drawer
        title={`${sel.id} · ${sel.customer}`}
        subtitle={sel.items}
        badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: sel.color + "22", color: sel.color }}>{sel.status}</span>}
        fields={[["Items", sel.items], ["Total", `$${sel.total.toFixed(2)}`], ["Channel", sel.channel], ["Status", sel.status]]}
        note={`Taken by your AI via ${sel.channel}. Customer notified automatically with ETA + confirmation.`}
        actions={<><button onClick={() => { toast(`${sel.id} marked ready ✓`); setSel(null); }} className="btn-bright text-sm">✓ Mark ready</button><a href={waLink(`Hi ${sel.customer}, about order ${sel.id}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Message</a></>}
        onClose={() => setSel(null)}
      />
    )}
    </>
  );
}
function Kitchen({ V }) {
  const init = V.kitchen || { new: [], preparing: [], ready: [] };
  const [board, setBoard] = useState({ new: [...(init.new || [])], preparing: [...(init.preparing || [])], ready: [...(init.ready || [])] });
  const flow = ["new", "preparing", "ready", "done"];
  const advance = (col, i) => setBoard((b) => {
    const item = b[col][i]; const next = flow[flow.indexOf(col) + 1];
    portalApi.updateStatus("orders", item?.id, next);
    toast(next === "done" ? `${item?.id} completed ✓` : `${item?.id} → ${next}`);
    const nb = { ...b, [col]: b[col].filter((_, j) => j !== i) };
    if (next !== "done") nb[next] = [...b[next], item];
    return nb;
  });
  const cols = [["New", "new", "#3E9468"], ["Preparing", "preparing", "#38BDF8"], ["Ready", "ready", "#D6C29A"]];
  return (
    <div className="space-y-3">
      <p className="text-xs text-g-muted">👆 Tap an order to move it forward · in <b className="text-g-light">Ready</b>, tap to complete.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        {cols.map(([label, key, c]) => (
          <Card key={key}>
            <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold uppercase tracking-wide" style={{ color: c }}>{label}</span><span className="text-[11px] text-g-muted">{board[key].length}</span></div>
            <div className="space-y-2 min-h-[3rem]">
              {board[key].map((o, i) => (
                <button key={o.id + i} onClick={() => advance(key, i)} className="w-full text-left rounded-xl2 border border-white/10 bg-white/[0.04] p-3 hover:border-g-gold/40 hover:-translate-y-0.5 transition-all">
                  <div className="flex justify-between text-xs"><span className="font-bold text-g-word">{o.id}</span><span className="text-g-muted">{o.t}</span></div>
                  <div className="text-[11px] text-g-muted mt-0.5">{o.items}</div>
                  <div className="text-[10px] font-bold mt-1.5" style={{ color: c }}>{key === "ready" ? "Tap to complete ✓" : "Tap to advance →"}</div>
                </button>
              ))}
              {board[key].length === 0 && <div className="text-[11px] text-g-muted text-center py-4">— empty —</div>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
function MenuView({ V }) {
  const sc = (s) => s === "Out" ? "#EF4444" : s === "Low" ? "#D6C29A" : "#3E9468";
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {(V.menu || []).map((m, i) => (
        <Card key={i}>
          <div className="flex items-start justify-between gap-2">
            <div><div className="text-sm font-bold text-g-word">{m.name}</div><div className="text-[11px] text-g-muted">{m.cat}</div></div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc(m.stock) + "22", color: sc(m.stock) }}>{m.stock}</span>
          </div>
          <div className="mt-3 text-xl font-extrabold text-g-word">${m.price.toFixed(2)}</div>
        </Card>
      ))}
    </div>
  );
}
function Customers({ V }) {
  const rows = V.customers || genCustomers(V);
  const totalSpent = rows.reduce((s, c) => s + (c.spent || 0), 0);
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4">
      <MiniStats items={[["Total customers", `${rows.length * 104}`], ["New this week", `+${rows.length * 6}`, "good"], ["Avg. value", `$${Math.round(totalSpent / rows.length)}`], ["Repeat rate", "38%", "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">Customers</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap for profile</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <button key={i} onClick={() => setSel({ c, i })} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{c.name[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{c.name}{i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-g-gold/15 text-g-gold">TOP</span>}</div><div className="text-[11px] text-g-muted truncate">{c.orders} {c.noun || "orders"} · {c.channel} · {c.last}</div></div>
              <span className="text-sm font-extrabold text-g-green">${c.spent.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.c.name}
          subtitle={`${sel.c.orders} ${sel.c.noun || "orders"} · via ${sel.c.channel}`}
          badge={sel.i === 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-g-gold/15 text-g-gold">VIP</span> : null}
          fields={[["Lifetime value", `$${sel.c.spent.toFixed(2)}`], [(sel.c.noun || "orders"), sel.c.orders], ["Preferred channel", sel.c.channel], ["Last seen", sel.c.last], ["Status", sel.i === 0 ? "Top spender" : "Active"]]}
          note={`Engaged by your AI across ${sel.c.channel}. ${sel.i === 0 ? "Your most valuable customer — worth a personal touch." : "Loyal customer — keep them coming back."}`}
          actions={<a href={waLink(`Hi ${sel.c.name}! `)} target="_blank" rel="noopener" className="btn-bright text-sm">💬 Message</a>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}
function Campaigns({ V }) {
  const rows = V.campaigns || genCampaigns(V);
  const sent = rows.reduce((s, c) => s + c.sent, 0);
  const rev = rows.reduce((s, c) => s + c.revenue, 0);
  const open = Math.round(rows.reduce((s, c) => s + c.opened, 0) / rows.length);
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4">
      <MiniStats items={[["Campaigns", `${rows.length}`], ["Messages sent", sent.toLocaleString()], ["Avg. open rate", `${open}%`, "good"], ["Revenue", `$${rev.toLocaleString()}`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">Campaigns</span><a href={waLink("I'd like to launch a campaign")} target="_blank" rel="noopener" className="text-[11px] font-bold text-g-gold hover:underline">New campaign →</a></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <button key={i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name}</div><div className="text-[11px] text-g-muted">{c.channel} · {c.sent} sent · {c.opened}% opened</div></div>
              <span className="text-sm font-extrabold text-g-green">${c.revenue.toLocaleString()}</span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: (c.status === "Active" ? "#3E9468" : "#D6C29A") + "22", color: c.status === "Active" ? "#3E9468" : "#D6C29A" }}>{c.status}</span>
            </button>
          ))}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.channel} campaign`}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: (sel.status === "Active" ? "#3E9468" : "#D6C29A") + "22", color: sel.status === "Active" ? "#3E9468" : "#D6C29A" }}>{sel.status}</span>}
          fields={[["Channel", sel.channel], ["Sent", sel.sent.toLocaleString()], ["Open rate", `${sel.opened}%`], ["Revenue", `$${sel.revenue.toLocaleString()}`], ["ROI", `${(sel.revenue / (sel.sent * 0.05) || 0).toFixed(1)}×`]]}
          note={`Run automatically by Guileo. ${sel.status === "Active" ? "Live now — driving revenue while you focus on the business." : "Scheduled — will launch and optimize itself."}`}
          actions={<><button onClick={() => { toast("Campaign duplicated ✓"); setSel(null); }} className="btn-bright text-sm">⧉ Duplicate</button><button onClick={() => { toast(sel.status === "Active" ? "Campaign paused" : "Campaign resumed"); setSel(null); }} className="btn-ghost text-sm">{sel.status === "Active" ? "⏸ Pause" : "▶ Resume"}</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}
function Audiences({ V }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {(V.audiences || genAudiences()).map((a, i) => (
        <Card key={i}><div className="flex items-center justify-between"><div className="text-sm font-bold text-g-word">{a.name}</div><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-g-muted">{a.source}</span></div><div className="mt-2 text-2xl font-extrabold text-g-word"><Count to={a.size} /></div><div className="text-[11px] text-g-muted">people reachable</div></Card>
      ))}
    </div>
  );
}
function CallLogs({ V }) {
  const rows = V.callLogs || genCalls(V);
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4">
      <MiniStats items={[["Calls answered", `${rows.length * 78}`], ["Missed calls", "0", "good"], ["Avg. duration", "1m 14s"], ["Handled by AI", "100%", "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">Recent calls · answered by AI</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap for transcript</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
          <button key={i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color: c.color }}><FaPhone size={13} /></span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name} <span className="text-g-muted font-normal">· {c.phone}</span></div><div className="text-[11px] text-g-muted truncate">{c.outcome}</div></div>
            <div className="text-right shrink-0"><div className="text-[11px] text-g-light font-bold">{c.dur}</div><div className="text-[10px] text-g-muted">{c.time}</div></div>
          </button>
          ))}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={sel.phone}
          badge={<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-g-green/15 text-g-green">Positive</span>}
          fields={[["Outcome", sel.outcome], ["Duration", sel.dur], ["When", sel.time], ["Channel", "Phone · AI"], ["Resolved", "By AI ✓"]]}
          note={<>Transcript summary:<div className="mt-1.5 space-y-1 text-g-word">{[["📞", `${sel.name}: ${sel.outcome.replace(/·.*/, "").trim() || "Hi, calling about my booking."}`], ["🤖", "Guileo AI: Happy to help — all sorted! Anything else?"], ["📞", `${sel.name}: That's perfect, thank you!`]].map(([ic, t], j) => <div key={j}>{ic} {t}</div>)}</div></>}
          actions={<><a href={`tel:${sel.phone.replace(/[^0-9+]/g, "")}`} className="btn-bright text-sm">📞 Call back</a><a href={waLink(`Hi ${sel.name}! `)} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Message</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}
function Dialer() {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  return (
    <div className="max-w-xs mx-auto">
      <Card className="text-center">
        <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">AI Call Dialer</div>
        <div className="h-10 rounded-xl2 bg-black/20 border border-white/10 grid place-items-center text-g-word font-bold mb-3">+1 (___) ___-____</div>
        <div className="grid grid-cols-3 gap-2">{keys.map((k) => <button key={k} className="h-12 rounded-xl2 border border-white/10 bg-white/[0.04] text-g-word font-bold hover:border-g-gold/40 transition">{k}</button>)}</div>
        <button className="btn-bright w-full mt-3 text-sm">📞 Start AI call</button>
      </Card>
    </div>
  );
}
function Convos({ V, title }) {
  const list = V.convos || genConvos(V);
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState("");
  const [threads, setThreads] = useState(() => Object.fromEntries(list.map((c, i) => [i, [
    { from: "them", text: c.last },
    { from: "ai", text: "Hi! Thanks for reaching out 😊 I can take care of that right now." },
    { from: "them", text: "Perfect, yes please." },
    { from: "ai", text: "All set ✅ Anything else I can help you with?" },
  ]])));
  const send = (e) => { e.preventDefault(); if (!draft.trim()) return; portalApi.sendMessage(title, active, draft); setThreads((t) => ({ ...t, [active]: [...(t[active] || []), { from: "you", text: draft }] })); setDraft(""); toast("Reply sent ✓"); };
  const c = list[active] || {};
  return (
    <div className="grid lg:grid-cols-3 gap-4 lg:h-[34rem]">
      <Card className="p-0 overflow-hidden lg:col-span-1 flex flex-col">
        <div className="px-4 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold shrink-0">{title} · {list.length} chats</div>
        <div className="divide-y divide-white/[0.06] overflow-y-auto">
          {list.map((cc, i) => (
            <button key={i} onClick={() => setActive(i)} className={`w-full text-left flex items-center gap-3 px-4 py-3 transition ${i === active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word shrink-0">{cc.name[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{cc.name}</div><div className="text-[11px] text-g-muted truncate">{cc.last}</div></div>
              <div className="text-right shrink-0"><div className="text-[10px] text-g-muted">{cc.t}</div>{cc.unread > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-g-green text-[10px] font-bold text-black mt-0.5">{cc.unread}</span>}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden lg:col-span-2 flex flex-col">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 shrink-0"><span className="grid place-items-center h-8 w-8 rounded-full bg-white/[0.06] text-xs font-bold text-g-word">{(c.name || "?")[0]}</span><div className="text-sm font-bold text-g-word">{c.name}</div><span className="ml-auto text-[10px] font-bold uppercase text-g-green inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />AI active</span></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[15rem]">
          {(threads[active] || []).map((m, i) => (
            <div key={i} className={`flex ${m.from === "them" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${m.from === "them" ? "bg-white/[0.06] text-g-word" : m.from === "ai" ? "bg-g-green/15 text-g-light border border-g-green/30" : "bg-g-gold/15 text-g-word border border-g-gold/30"}`}>
                {m.from === "ai" && <div className="text-[9px] font-black uppercase text-g-green mb-0.5">Guileo AI</div>}
                {m.from === "you" && <div className="text-[9px] font-black uppercase text-g-gold mb-0.5">You</div>}
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="p-3 border-t border-white/10 flex gap-2 shrink-0">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Reply" placeholder="Jump in and reply…" className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <button className="btn-bright text-sm px-5">Send</button>
        </form>
      </Card>
    </div>
  );
}
function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-g-green" : "bg-white/15"}`} role="switch" aria-checked={on}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
function SettingsView({ V }) {
  const [toggles, setToggles] = useState({ voice: true, chat: true, reviews: true, recall: true, afterhours: true, marketing: false });
  const flip = (k) => setToggles((t) => { const v = !t[k]; toast(`${LBL[k]}: ${v ? "On" : "Off"}`); return { ...t, [k]: v }; });
  const LBL = { voice: "AI voice agent", chat: "WhatsApp & SMS AI", reviews: "Auto-request reviews", recall: "Recalls & reminders", afterhours: "After-hours coverage", marketing: "Weekly marketing digest" };
  const info = [["Business name", V.business.name], ["Location", V.business.place], ["Plan", V.plan?.label || "Growth Plan"], ["Languages", "English · Português · Español"], ["Timezone", "Local"]];
  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Business</div>
        <div className="divide-y divide-white/[0.06]">
          {info.map(([k, v], i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-muted">{k}</span><span className="text-sm font-bold text-g-word text-right">{v}</span></div>
          ))}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">What your AI handles</div>
        <div className="divide-y divide-white/[0.06]">
          {Object.keys(LBL).map((k) => (
            <div key={k} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-word font-semibold">{LBL[k]}</span><Toggle on={toggles[k]} onClick={() => flip(k)} /></div>
          ))}
        </div>
      </Card>
      <p className="text-center text-[11px] text-g-muted">Changes apply instantly. Need something custom? Your team's a tap away. 💬</p>
    </div>
  );
}

function Grow() {
  const [sent, setSent] = useState(false);
  const [txt, setTxt] = useState("");
  const submit = (e) => { e.preventDefault(); setSent(true); window.open(waLink(`Hi Guileo! I wish you offered: ${txt}`), "_blank"); };
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">Grow with Guileo</div><div className="text-xs text-g-muted mt-0.5">Add a service or channel — your team sets it up for you. No extra logins, one bill.</div></div>
          <a href={waLink("Hi Guileo! I'd like to add a new service to my plan")} target="_blank" rel="noopener" className="btn-bright text-sm">Talk to my team →</a>
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADDONS.map(([ic, name, desc], i) => (
          <Card key={i} className="flex flex-col">
            <div className="flex items-center gap-3"><span className="grid place-items-center h-11 w-11 rounded-xl bg-white/[0.06] text-xl shrink-0">{ic}</span><div className="text-sm font-bold text-g-word">{name}</div></div>
            <p className="text-xs text-g-muted mt-2 flex-1">{desc}</p>
            <a href={waLink(`Hi Guileo! I'd like to add: ${name}`)} target="_blank" rel="noopener" className="mt-3 inline-flex items-center justify-center gap-1 rounded-full border border-g-gold/40 bg-g-gold/[0.08] px-4 py-2 text-xs font-bold text-g-gold hover:bg-g-gold/[0.16] transition">Request this →</a>
          </Card>
        ))}
      </div>
      {/* Demand learning — request something we don't offer yet */}
      <Card>
        <div className="text-sm font-extrabold text-g-word">Don't see what you need?</div>
        <p className="text-xs text-g-muted mt-0.5">Tell us what you wish we offered — we're always adding services, and your idea shapes what we build next.</p>
        {!sent ? (
          <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2">
            <input required value={txt} onChange={(e) => setTxt(e.target.value)} aria-label="Request a service we don't offer yet" placeholder="e.g. A reservations widget for my website…" className="flex-1 rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
            <button className="btn-bright text-sm whitespace-nowrap">Send request →</button>
          </form>
        ) : (
          <div className="mt-3 rounded-xl2 border border-g-green/40 bg-g-green/[0.1] p-3 text-sm font-bold text-g-light text-center">✅ Got it — thanks! Our team will look into it.</div>
        )}
      </Card>
    </div>
  );
}

function aiAnswer(q, V) {
  const s = q.toLowerCase();
  if (/hour|open|close|time|aberto|horário/.test(s)) return "We're open Mon–Sun, 9am–10pm. Want me to book you in?";
  if (/price|cost|how much|preço|quanto/.test(s)) return "Pricing depends on what you need — I can get you a quick quote. What are you looking for?";
  if (/book|appointment|reserv|table|schedule|agendar|marcar/.test(s)) return "Absolutely! What day and time works for you? I'll lock it in right away. 📅";
  if (/where|location|address|onde|endereço/.test(s)) return `We're at ${V.business.place}. I can send directions on WhatsApp — want them?`;
  if (/cancel|refund|reembolso|cancelar/.test(s)) return "No problem — I'll take care of that and loop in a human if needed. Can I have your name?";
  if (/deliver|entrega/.test(s)) return "Yes, we deliver 🛵 — just send your address and order and I'll confirm the ETA.";
  return `Great question! Based on ${V.business.name}'s info I'd handle that right away and book or answer accordingly. (Train me with more details to sharpen this answer.)`;
}
function AIBrain({ V }) {
  const cards = [
    ["🏢", "Business info", `${V.business.name} · ${V.business.place} · Hours: Mon–Sun, 9am–10pm`],
    ["📋", V.ops?.listTitle || "Menu & services", (V.ops?.list || []).map((x) => x.name).join(" · ") || "Set up with your team"],
    ["❓", "Top questions it answers", "Hours · Location · Pricing · Booking · Delivery · Specials"],
    ["🎙️", "Voice & languages", "Warm & friendly · English, Portuguese, Spanish"],
    ["⤴️", "Escalation rules", "Refunds & complaints → human · VIPs → owner"],
    ["⭐", "After every interaction", "Asks happy customers for a 5★ review automatically"],
  ];
  const [q, setQ] = useState("");
  const [chat, setChat] = useState([]);
  const ask = (e) => { e.preventDefault(); if (!q.trim()) return; setChat((c) => [...c, { q, a: aiAnswer(q, V) }]); setQ(""); };
  const suggestions = ["What are your hours?", "Can I book for tomorrow?", "How much does it cost?", "Where are you located?"];
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">🧠 Your AI's brain</div><div className="text-xs text-g-muted mt-0.5">Everything your AI knows and how it answers — and you can test it live, right here.</div></div>
          <a href={waLink("Hi Guileo! I'd like to update what my AI knows")} target="_blank" rel="noopener" className="btn-bright text-sm">Request an update →</a>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word"><span className="text-g-green">✓</span> Last trained 2 days ago</span>
          {["🇺🇸 English", "🇧🇷 Português", "🇪🇸 Español"].map((l) => <span key={l} className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word">{l}</span>)}
        </div>
      </Card>

      {/* THE DIFFERENTIATOR — test your AI live */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />Test your AI · see exactly how it answers your customers</div>
        <div className="p-4 space-y-2.5 min-h-[8rem] max-h-72 overflow-y-auto">
          {chat.length === 0 && <div className="text-center text-xs text-g-muted py-6">Ask your AI anything a customer might ask 👇</div>}
          {chat.map((m, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-end"><div className="max-w-[78%] rounded-2xl px-3.5 py-2 text-xs bg-g-gold/15 text-g-word border border-g-gold/30">{m.q}</div></div>
              <div className="flex justify-start"><div className="max-w-[80%] rounded-2xl px-3.5 py-2 text-xs bg-g-green/15 text-g-light border border-g-green/30"><div className="text-[9px] font-black uppercase text-g-green mb-0.5">Your AI</div>{m.a}</div></div>
            </div>
          ))}
        </div>
        {chat.length === 0 && <div className="px-4 pb-2 flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} onClick={() => setChat([{ q: s, a: aiAnswer(s, V) }])} className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition">{s}</button>)}</div>}
        <form onSubmit={ask} className="p-3 border-t border-white/10 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask your AI" placeholder="Ask your AI a question…" className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <button className="btn-bright text-sm px-5">Ask</button>
        </form>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map(([ic, title, body], i) => (
          <Card key={i}><div className="flex items-center gap-2 mb-1"><span className="text-lg">{ic}</span><span className="text-sm font-bold text-g-word">{title}</span></div><p className="text-xs text-g-muted leading-relaxed">{body}</p></Card>
        ))}
      </div>
    </div>
  );
}

function Billing({ V }) {
  const plan = V.plan || { label: "Growth Plan", used: 1, total: 2000, unit: "Actions this month" };
  const pct = Math.round((plan.used / plan.total) * 100);
  const includes = ["AI voice agent · 24/7", "WhatsApp, SMS & social replies", "Bookings & reviews automation", "Live dashboard & monthly reports", "A real human managing it for you"];
  const invoices = [["Invoice #0012", "Jun 1, 2026", "Paid"], ["Invoice #0011", "May 1, 2026", "Paid"], ["Invoice #0010", "Apr 1, 2026", "Paid"]];
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-xs font-bold uppercase tracking-wide text-g-gold">Current plan</div><div className="text-xl font-extrabold text-g-word mt-1">{plan.label}</div></div>
            <a href={waLink("I'd like to upgrade my Guileo plan")} target="_blank" rel="noopener" className="btn-bright text-sm">Upgrade →</a>
          </div>
          <div className="mt-4"><div className="flex justify-between text-xs mb-1"><span className="text-g-muted">{plan.unit}</span><span className="text-g-word font-bold">{plan.used} / {plan.total.toLocaleString()}</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${Math.max(2, pct)}%` }} /></div></div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">What's included</div>
          <ul className="space-y-1.5 text-xs text-g-word">{includes.map((x, i) => <li key={i} className="flex gap-2"><span className="text-g-green">✓</span>{x}</li>)}</ul>
        </Card>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Invoices</div>
        <div className="divide-y divide-white/[0.06]">
          {invoices.map(([n, d, s], i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3"><span className="text-lg">🧾</span><div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{n}</div><div className="text-[11px] text-g-muted">{d}</div></div><span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-g-green/15 text-g-green">{s}</span><button aria-label={`Download ${n}`} className="text-g-gold hover:text-g-word transition"><FaDownload size={12} /></button></div>
          ))}
        </div>
      </Card>
      <p className="text-center text-[11px] text-g-muted">Payment is handled securely with your team — we never ask for card details in chat.</p>
    </div>
  );
}

function ScheduleScreen({ V }) {
  const o = V.ops || {};
  const sch = o.schedule || [];
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4">
      {o.stats && (
        <div className="grid sm:grid-cols-3 gap-4">
          {o.stats.map((s) => (<Card key={s.label}><div className="text-[11px] uppercase tracking-wide text-g-muted">{s.label}</div><div className={`text-2xl font-extrabold mt-1 ${s.tone === "good" ? "text-g-green" : "text-g-word"}`}>{s.value}</div></Card>))}
        </div>
      )}
      {DEPOSIT[V.label] > 0 && (
        <Card className="border-g-green/25 bg-g-green/[0.05]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-sm font-extrabold text-g-word">🛡️ No-show protection · on</div><div className="text-xs text-g-muted mt-0.5">${DEPOSIT[V.label]} deposit held per booking · <b className="text-g-green">7 no-shows prevented</b> · $980 secured this month</div></div>
            <button onClick={() => toast("Deposit rules updated ✓")} className="btn-ghost text-sm">Manage rules</button>
          </div>
        </Card>
      )}
      {sch.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(sch.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {})).map(([st, n]) => (
            <span key={st} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word">{st} <span className="text-g-muted">{n}</span></span>
          ))}
        </div>
      )}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{o.scheduleTitle || "Today"}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap a row for full details</span></div>
        <div className="divide-y divide-white/[0.06]">
          {sch.map((r, i) => {
            const who = staffOf(V.label, i);
            return (
              <button key={i} onClick={() => setSel({ r, i, who })} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                <span className="text-xs font-bold text-g-light w-20 shrink-0 inline-block truncate align-middle" title={r.time}>{r.time}</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted truncate">{r.meta}{who ? <> · <span className="text-g-light">{who}</span></> : ""}{r.ch && r.ch !== "—" ? ` · ${r.ch}` : ""}</div></div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: r.color + "22", color: r.color }}>{r.status}</span>
              </button>
            );
          })}
        </div>
      </Card>
      {o.grid && (
        <Card><div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{o.gridTitle}</div><div className="grid grid-cols-6 sm:grid-cols-8 gap-2">{o.grid.map((g, i) => (<div key={i} className={`grid place-items-center h-10 rounded-lg text-xs font-bold border ${g.on ? "border-g-green/50 bg-g-green/15 text-g-light" : "border-white/10 bg-white/[0.03] text-g-muted"}`}>{g.label}</div>))}</div></Card>
      )}
      {sel && (
        <Drawer
          title={sel.r.name}
          subtitle={sel.r.meta}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: sel.r.color + "22", color: sel.r.color }}>{sel.r.status}</span>}
          fields={[
            ["Time", sel.r.time],
            ["With", sel.who],
            ["Location", roomOf(V.label, sel.i)],
            ["Duration", _dur[sel.i % _dur.length]],
            ["Channel", sel.r.ch && sel.r.ch !== "—" ? sel.r.ch : "—"],
            ["Deposit", DEPOSIT[V.label] > 0 ? (/pending|new/i.test(sel.r.status) ? `$${DEPOSIT[V.label]} pending` : `$${DEPOSIT[V.label]} held ✓`) : "Not required"],
            ["No-show risk", /pending|new|risk|follow/i.test(sel.r.status) ? "⚠ Higher" : "Low"],
            ["Status", sel.r.status],
          ]}
          note={`Captured by your AI ${sel.r.ch && sel.r.ch !== "—" ? `via ${sel.r.ch}` : ""}. Confirmation + reminder sent automatically. ${/pending|new|follow/i.test(sel.r.status) ? "Awaiting confirmation — the AI will follow up." : "Confirmed and on the books."}`}
          actions={<>
            <a href={waLink(`Hi ${sel.r.name}, about your ${sel.r.meta}…`)} target="_blank" rel="noopener" className="btn-bright text-sm">💬 Message</a>
            <button onClick={() => { toast(`${sel.r.name} confirmed ✓`); setSel(null); }} className="btn-ghost text-sm">✓ Confirm</button>
            <button onClick={() => { toast("Reschedule link sent"); setSel(null); }} className="btn-ghost text-sm">📅 Reschedule</button>
          </>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function CatalogScreen({ V }) {
  const o = V.ops || {}; const list = o.list || [];
  const max = Math.max(1, ...list.map((x) => x.val));
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{o.listTitle || "Catalog"}</div>
      <div className="p-5 space-y-3.5">
        {list.map((it, i) => (
          <div key={i}><div className="flex justify-between text-xs mb-1"><span className="font-bold text-g-word">{it.name}</span><span className="text-g-muted">{it.val}</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${(it.val / max) * 100}%` }} /></div></div>
        ))}
      </div>
    </Card>
  );
}

function SocialInbox({ V }) {
  const nets = [[FaInstagram, "#E4405F", "Instagram"], [FaFacebook, "#1877F2", "Facebook"], [FaTiktok, "#e7e7e7", "TikTok"], [FaInstagram, "#E4405F", "Instagram"]];
  const rows = (V.activity || []).slice(0, 4).map((a, i) => ({ name: (V.ops?.schedule?.[i]?.name) || "New DM", last: a[2], t: a[3], unread: i % 2 }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[["Instagram", "#E4405F", 18], ["Facebook", "#1877F2", 9], ["TikTok", "#e7e7e7", 6]].map(([n, c, v]) => (
          <span key={n} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{n} <span className="text-g-muted">{v} replies today</span></span>
        ))}
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Social inbox · AI replies on Instagram, Facebook &amp; TikTok</div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => {
            const [Icon, color, net] = nets[i % 4];
            return (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color }}><Icon size={16} /></span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name} <span className="text-g-muted font-normal">· {net}</span></div><div className="text-[11px] text-g-muted truncate">{c.last}</div></div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1"><span className="text-[10px] text-g-muted">{c.t}</span>{c.unread > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-g-green text-[10px] font-bold text-black">{c.unread}</span>}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function AIAnalytics({ V }) {
  const sentiment = [["Positive", 82, "#3E9468"], ["Neutral", 13, "#D6C29A"], ["Negative", 5, "#EF4444"]];
  const intents = [["Booking / reservation", 41], ["Hours & location", 22], ["Pricing", 18], ["Order / status", 12], ["Complaint", 7]];
  const missed = ["3 callers asked for a service you don't offer yet — a possible new revenue line.", "Demand peaks 7–8pm beyond capacity — push pre-orders / waitlist.", "5 pricing questions didn't convert — a small promo could win them back."];
  const T = [
    { who: "Marcos A.", ch: "Phone", sent: "Positive", lines: [["them", "Do you have a table for 4 tonight?"], ["ai", "We do — 8:00 PM works. Shall I book it under your name?"], ["them", "Yes please, Marcos."], ["ai", "Booked ✅ See you at 8, Marcos!"]] },
    { who: "Maria S.", ch: "WhatsApp", sent: "Positive", lines: [["them", "Can I order delivery?"], ["ai", "Of course 🛵 What would you like?"], ["them", "2 Pão de Queijo packs."], ["ai", "$17 total, ETA 25 min — confirmed!"]] },
  ];
  return (
    <div className="space-y-4">
      <MiniStats items={[["Conversations analyzed", "1,842"], ["Avg sentiment", "Positive 👍", "good"], ["Resolved by AI", "91%", "good"], ["Avg handle time", "1m 12s"]]} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">Sentiment</div>
          {sentiment.map(([l, v, c]) => (<div key={l} className="mb-2.5 last:mb-0"><div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{l}</span><span className="text-g-muted">{v}%</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v}%`, background: c }} /></div></div>))}
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">Why people contact you</div>
          {intents.map(([l, v]) => (<div key={l} className="mb-2.5 last:mb-0"><div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{l}</span><span className="text-g-muted">{v}%</span></div><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-g-green" style={{ width: `${(v / 41) * 100}%` }} /></div></div>))}
        </Card>
      </div>
      <Card className="border-g-gold/30 bg-g-gold/[0.05]">
        <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">⚡ Missed opportunities the AI spotted</div>
        <div className="space-y-2">{missed.map((m, i) => (<div key={i} className="rounded-xl2 border-l-2 border-g-gold/50 bg-white/[0.05] px-3 py-2.5 text-xs text-g-word">{m}</div>))}</div>
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        {T.map((t, i) => (
          <Card key={i} className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold text-g-word">{t.who} · {t.ch}</span><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-g-green/15 text-g-green">{t.sent}</span></div>
            <div className="p-4 space-y-2">{t.lines.map(([from, text], j) => (<div key={j} className={`flex ${from === "them" ? "justify-start" : "justify-end"}`}><div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs ${from === "them" ? "bg-white/[0.06] text-g-word" : "bg-g-green/15 text-g-light border border-g-green/30"}`}>{text}</div></div>))}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Palette({ V, sections, onNav, onClose }) {
  const [q, setQ] = useState("");
  const items = [
    ...sections.map(([k, l]) => ({ icon: "›", label: l, sub: "Section", key: k })),
    ...(V.customers || genCustomers(V)).map((c) => ({ icon: "👤", label: c.name, sub: "Customer", key: "customers" })),
    ...(V.convos || genConvos(V)).map((c) => ({ icon: "💬", label: c.name, sub: "Conversation", key: "whatsapp" })),
    ...((V.ops && V.ops.schedule) || []).map((r) => ({ icon: "📅", label: r.name, sub: r.meta, key: V.sections ? "overview" : "schedule" })),
  ];
  const ql = q.trim().toLowerCase();
  const res = (ql ? items.filter((it) => (it.label + " " + it.sub).toLowerCase().includes(ql)) : items).slice(0, 14);
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-20 sm:top-24 -translate-x-1/2 z-50 w-[92%] max-w-lg rounded-xl3 border border-white/12 bg-g-cream/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10"><FaMagnifyingGlass size={13} className="text-g-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sections, customers, conversations…" className="flex-1 bg-transparent text-sm text-g-word placeholder:text-g-muted outline-none" /><span className="text-[10px] text-g-muted border border-white/15 rounded px-1.5 py-0.5">ESC</span></div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {res.length ? res.map((it, i) => (
            <button key={i} onClick={() => { onNav(it.key); onClose(); }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.06] transition">
              <span className="text-base w-5 text-center text-g-gold">{it.icon}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{it.label}</div><div className="text-[11px] text-g-muted truncate">{it.sub}</div></div>
            </button>
          )) : <div className="px-3 py-6 text-center text-xs text-g-muted">No matches</div>}
        </div>
      </div>
    </>
  );
}

function GuileoImpact({ V }) {
  const d = genImpact(V);
  const share = Math.round((d.total * d.sharePct) / 100);
  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden bg-gradient-to-br from-g-green/[0.12] to-g-gold/[0.06] border-g-green/30">
        <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-g-green/15 blur-3xl pointer-events-none animate-aurora" />
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold">Growth Guileo drove · this month</div>
          <div className="text-4xl sm:text-5xl font-black text-g-word tracking-tight mt-1"><Count to={d.total} prefix="$" /></div>
          <div className="mt-2.5 flex flex-wrap gap-2">{d.parts.map(([label, val]) => (<span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold"><span className="text-g-green">{val}</span><span className="text-g-muted">{label}</span></span>))}</div>
        </div>
      </Card>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Growth ledger · every $ the AI generated</div>
          <div className="divide-y divide-white/[0.06]">{d.events.map(([t, what, amt], i) => (<div key={i} className="flex items-center gap-3 px-5 py-3"><span className="grid place-items-center h-8 w-8 rounded-full bg-g-green/15 text-g-green text-sm font-black">＋</span><div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{what}</div><div className="text-[11px] text-g-muted">{t} ago</div></div><span className="text-sm font-extrabold text-g-green">+${amt}</span></div>))}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">Partnership</div>
          <div className="text-sm text-g-muted">You grew <b className="text-g-word">${d.total.toLocaleString()}</b> with Guileo this month.</div>
          <div className="mt-3 rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] p-3">
            <div className="text-[10px] uppercase tracking-wide text-g-gold font-bold">Guileo's share · {d.sharePct}% of growth</div>
            <div className="text-2xl font-extrabold text-g-word mt-1">${share.toLocaleString()}</div>
            <div className="text-[11px] text-g-muted mt-0.5">You keep ${(d.total - share).toLocaleString()} — we only win when you win.</div>
          </div>
          <div className="mt-3"><Bars data={V.revenue} /></div>
        </Card>
      </div>
    </div>
  );
}

function Followups({ V }) {
  const rows = genFollowups(V);
  const [done, setDone] = useState([]);
  const open = rows.map((r, i) => ({ r, i })).filter(({ i }) => !done.includes(i));
  const pipeline = open.reduce((s, { r }) => s + r.value, 0);
  return (
    <div className="space-y-4">
      <MiniStats items={[["Active sequences", `${open.length}`], ["Pipeline value", `$${pipeline.toLocaleString()}`], ["Won this week", "8", "good"], ["Auto-nudged", "31", "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">The AI is chasing these — so you never lose them</div>
        <div className="divide-y divide-white/[0.06]">
          {open.map(({ r, i }) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name} <span className="text-g-muted font-normal">· {r.type}</span></div><div className="text-[11px] text-g-muted">via {r.ch} · next: {r.next} · step {r.stage}/3</div></div>
              <span className="text-sm font-extrabold text-g-green">${r.value}</span>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => toast(`${r.name}: nudge sent`)} className="text-[10px] font-bold rounded-full border border-white/15 px-2.5 py-1 text-g-word hover:border-g-gold/40 transition">Nudge</button>
                <button onClick={() => { setDone((d) => [...d, i]); toast(`${r.name} marked won 🎉`); }} className="text-[10px] font-bold rounded-full bg-g-green/15 border border-g-green/40 px-2.5 py-1 text-g-green">Won</button>
              </div>
            </div>
          ))}
          {open.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">✅ All caught up — every lead followed up.</div>}
        </div>
      </Card>
    </div>
  );
}

function Waitlist({ V }) {
  const rows = genWaitlist(V);
  const [filled, setFilled] = useState([]);
  const open = rows.map((r, i) => ({ r, i })).filter(({ i }) => !filled.includes(i));
  return (
    <div className="space-y-4">
      <MiniStats items={[["Waiting now", `${open.length}`], ["Filled today", "9", "good"], ["No-shows saved", "7", "good"], ["Revenue recovered", "$1,240", "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Waitlist · turn empty slots into revenue</div>
        <div className="divide-y divide-white/[0.06]">
          {open.map(({ r, i }) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{r.name[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted">{r.want} · via {r.ch} · {r.since}</div></div>
              <button onClick={() => { setFilled((f) => [...f, i]); toast(`Offer sent to ${r.name} ✓`); }} className="btn-bright text-xs px-3 shrink-0">Offer slot</button>
            </div>
          ))}
          {open.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">No one waiting — capacity is full. 🎉</div>}
        </div>
      </Card>
    </div>
  );
}

function Reputation({ V }) {
  const reviews = genReviews(V);
  const dist = [["5★", 78], ["4★", 15], ["3★", 4], ["2★", 2], ["1★", 1]];
  return (
    <div className="space-y-4">
      <MiniStats items={[["Avg rating", "4.8 ★", "good"], ["Reviews this month", "92", "good"], ["Requests sent", "310"], ["Request → review", "30%", "good"]]} />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">Rating breakdown</div>
          {dist.map(([l, v]) => (<div key={l} className="mb-2 last:mb-0 flex items-center gap-2"><span className="text-xs text-g-muted w-8">{l}</span><div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green" style={{ width: `${v}%` }} /></div><span className="text-[11px] text-g-muted w-8 text-right">{v}%</span></div>))}
          <button onClick={() => toast("Review blast queued ✓")} className="btn-bright text-sm w-full mt-4 justify-center">Request reviews now</button>
        </Card>
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Recent reviews · collected by AI</div>
          <div className="divide-y divide-white/[0.06]">{reviews.map((r, i) => (<div key={i} className="px-5 py-3"><div className="flex items-center justify-between"><span className="text-sm font-bold text-g-word">{r.name}</span><span className="text-xs text-g-gold">{"★".repeat(r.stars)}<span className="text-g-muted">{"★".repeat(5 - r.stars)}</span></span></div><div className="text-[12px] text-g-muted mt-0.5">"{r.text}" <span className="text-g-light">· {r.ch}</span></div></div>))}</div>
        </Card>
      </div>
    </div>
  );
}

function Recurring({ V }) {
  const rows = genRecurring(V);
  const perMo = rows.reduce((s, r) => s + r.value, 0);
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4">
      <MiniStats items={[["Active plans", `${rows.length * 23}`], ["Monthly recurring", `$${(perMo * 23).toLocaleString()}`, "good"], ["Renewals due", "8"], ["Churn risk", "3", "bad"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">Recurring revenue · the AI keeps it renewing</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap for plan</span></div>
        <div className="divide-y divide-white/[0.06]">{rows.map((r, i) => (<button key={i} onClick={() => setSel(r)} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition"><span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{r.name[0]}</span><div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted">{r.plan} · ${r.value}/mo</div></div><span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: r.color + "22", color: r.color }}>{r.status}</span></button>))}</div>
      </Card>
      <p className="text-center text-[11px] text-g-muted">Recurring revenue is the most valuable revenue — your AI renews, reminds and rescues it automatically.</p>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={sel.plan}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: sel.color + "22", color: sel.color }}>{sel.status}</span>}
          fields={[["Plan", sel.plan], ["Value", `$${sel.value}/mo`], ["Annual value", `$${(sel.value * 12).toLocaleString()}`], ["Status", sel.status], ["Member since", "Apr 2026"]]}
          note={sel.status === "At risk" ? "⚠ Engagement dropped — the AI is running a win-back sequence to save this plan." : sel.status === "Renews soon" ? "Renewal coming up — the AI will remind and auto-renew." : "Active and healthy — auto-renewing each cycle."}
          actions={<><button onClick={() => { toast(`${sel.name} renewed ✓`); setSel(null); }} className="btn-bright text-sm">↻ Renew now</button><a href={waLink(`Hi ${sel.name}, about your ${sel.plan}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Message</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Onboarding wizard (first run) ───────────────────────── */
function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [vid, setVid] = useState("restaurant");
  const [name, setName] = useState("");
  const [chs, setChs] = useState({ "WhatsApp": true, "Phone calls": true, "Instagram": true, "SMS": false });
  const next = () => setStep((s) => s + 1);
  return (
    <div className="min-h-screen grid place-items-center px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-xl3 border border-white/12 bg-white/[0.04] backdrop-blur-xl p-7 shadow-lift">
        <div className="flex gap-1.5 mb-5">{[0, 1, 2, 3].map((i) => <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-g-green" : "bg-white/15"}`} />)}</div>
        {step === 0 && (<>
          <div className="text-lg font-extrabold text-g-word">Welcome to Guileo 👋</div>
          <p className="text-xs text-g-muted mt-1">What kind of business are we growing?</p>
          <div className="mt-4 grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {VERTICAL_KEYS.map((k) => (
              <button key={k} onClick={() => { setVid(k); setName(VERTICALS[k].business.name); next(); }} className="flex flex-col items-center gap-1 rounded-xl2 border border-white/10 bg-white/[0.03] p-3 hover:border-g-gold/50 hover:-translate-y-0.5 transition-all">
                <span className="text-2xl">{VERTICALS[k].icon}</span><span className="text-[10px] font-bold text-g-word text-center leading-tight">{VERTICALS[k].label}</span>
              </button>
            ))}
          </div>
        </>)}
        {step === 1 && (<>
          <div className="text-lg font-extrabold text-g-word">Your business name</div>
          <p className="text-xs text-g-muted mt-1">This is how your AI introduces itself to customers.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bella Pizza" className="mt-4 w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <button onClick={next} className="btn-bright text-sm w-full mt-4">Continue →</button>
        </>)}
        {step === 2 && (<>
          <div className="text-lg font-extrabold text-g-word">Which channels should your AI cover?</div>
          <p className="text-xs text-g-muted mt-1">Your AI answers 24/7 on every one you turn on.</p>
          <div className="mt-4 space-y-2">{Object.keys(chs).map((c) => (<div key={c} className="flex items-center justify-between rounded-xl2 border border-white/10 bg-white/[0.03] px-4 py-3"><span className="text-sm font-semibold text-g-word">{c}</span><Toggle on={chs[c]} onClick={() => setChs((x) => ({ ...x, [c]: !x[c] }))} /></div>))}</div>
          <button onClick={next} className="btn-bright text-sm w-full mt-4">Continue →</button>
        </>)}
        {step === 3 && (
          <div className="text-center py-3">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-lg font-extrabold text-g-word">You're all set, {name || "there"}!</div>
            <p className="text-xs text-g-muted mt-1">Your AI is live and your Growth Cockpit is ready.</p>
            <button onClick={() => onDone(vid)} className="btn-bright text-sm w-full mt-5">Enter my cockpit →</button>
          </div>
        )}
        {step < 3 && <button onClick={() => onDone(vid)} className="block mx-auto mt-4 text-[11px] font-bold text-g-muted hover:text-g-word">Skip setup</button>}
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Login gate (demo) ───────────────────────── */
function Login({ onEnter }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (em) => { setBusy(true); try { await portalApi.login(em); onEnter(); } catch { setBusy(false); } };
  return (
    <div className="min-h-screen grid place-items-center px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-xl3 border border-white/12 bg-white/[0.04] backdrop-blur-xl p-8 shadow-lift text-center">
        <img src={logo} alt="Guileo" className="h-12 w-12 object-contain mx-auto" />
        <div className="mt-3 text-xl font-black uppercase tracking-tight bg-gradient-to-r from-g-green via-g-gold to-g-green bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">Growth Cockpit</div>
        <p className="text-xs text-g-muted mt-1">Sign in to your private dashboard</p>
        <form onSubmit={(e) => { e.preventDefault(); go(email); }} className="mt-6 space-y-2.5 text-left">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <input type="password" required placeholder="Password" className="w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <button disabled={busy} className="btn-bright text-sm w-full disabled:opacity-70">{busy ? "Signing in…" : "Enter Growth Cockpit →"}</button>
        </form>
        <button onClick={() => go()} disabled={busy} className="mt-3 text-xs font-bold text-g-gold hover:underline disabled:opacity-60">▶ Enter demo (sample data)</button>
        <div className="mt-4 text-[11px] text-g-muted"><a href="/" className="hover:text-g-word">← Back to guileo.ai</a></div>
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */
export default function Portal() {
  const [authed, setAuthed] = useState(false);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState("overview");
  const [period, setPeriod] = useState("30 days");
  const [vertical, setVertical] = useState("restaurant");
  const [vertOpen, setVertOpen] = useState(false);
  const [notifsRead, setNotifsRead] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(() => { try { return !!localStorage.getItem("guileo_onboarded"); } catch { return true; } });
  useEffect(() => { portalApi.session().then((s) => { if (s) setAuthed(true); }).finally(() => setBooting(false)); }, []);
  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); } if (e.key === "Escape") setPaletteOpen(false); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  const V = VERTICALS[vertical];
  const sections = sectionsFor(vertical, V);
  const nf = (k) => (notifsRead ? 0 : notifFor(k, V));
  const totalNotif = sections.reduce((s, [k]) => s + nf(k), 0);
  const notifList = notifsRead ? [] : sections.map(([k, l]) => ({ k, l, n: notifFor(k, V) })).filter((x) => x.n > 0);
  const cur = sections.find((s) => s[0] === view);
  const title = view === "operations" ? `${V.label} operations` : (cur ? cur[1] : "Overview");
  const switchVertical = (k) => { setVertical(k); setView("overview"); setVertOpen(false); setNotifsRead(false); };
  const logout = () => portalApi.logout().then(() => setAuthed(false));
  const exportReport = () => {
    const rows = [["Metric", "Value"], ...V.kpis.map((k) => [k.label, `${k.pre || ""}${k.num}${k.suf || ""}`])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `guileo-${vertical}-report.csv`; a.click(); URL.revokeObjectURL(url);
    toast("Report downloaded ✓");
  };
  const content = {
    overview: <Overview V={V} onNav={setView} />,
    impact: <GuileoImpact V={V} />,
    followups: <Followups V={V} />,
    waitlist: <Waitlist V={V} />,
    recurring: <Recurring V={V} />,
    reputation: <Reputation V={V} />,
    operations: <Operations V={V} />,
    schedule: <ScheduleScreen V={V} />,
    catalog: <CatalogScreen V={V} />,
    social: <SocialInbox V={V} />,
    analytics: <AIAnalytics V={V} />,
    liveorders: <LiveOrders V={V} />,
    kitchen: <Kitchen V={V} />,
    menu: <MenuView V={V} />,
    customers: <Customers V={V} />,
    campaigns: <Campaigns V={V} />,
    audiences: <Audiences V={V} />,
    calllogs: <CallLogs V={V} />,
    dialer: <Dialer />,
    whatsapp: <Convos V={V} title="WhatsApp" />,
    sms: <Convos V={V} title="SMS" />,
    channels: <Channels />,
    ads: <Ads />,
    leads: <Leads />,
    support: <Support />,
    docs: <Docs />,
    grow: <Grow />,
    brain: <AIBrain V={V} />,
    billing: <Billing V={V} />,
    settings: <SettingsView V={V} />,
  }[view] || <Overview V={V} onNav={setView} />;

  if (booting) return <div className="min-h-screen grid place-items-center text-g-muted text-sm">Loading your cockpit…</div>;
  if (!authed) return <div className="min-h-screen text-g-ink"><Login onEnter={() => setAuthed(true)} /></div>;
  if (!onboarded) return <div className="min-h-screen text-g-ink"><OnboardingWizard onDone={(vid) => { setVertical(vid); setView("overview"); setOnboarded(true); try { localStorage.setItem("guileo_onboarded", "1"); } catch { /* private */ } }} /></div>;

  return (
    <div className="min-h-screen text-g-ink flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-60 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-white/10 bg-white/[0.03] backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="flex items-center gap-2 px-5 py-4">
          <img src={logo} alt="Guileo" className="h-8 w-8 object-contain" />
          <div className="leading-tight"><div className="text-sm font-extrabold text-g-word">Growth Cockpit</div><div className="text-[10px] text-g-muted">{V.icon} {V.business.name}</div></div>
        </div>
        <nav aria-label="Dashboard sections" className="flex lg:flex-col gap-1 px-3 pb-3 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto">
          {(() => {
            const renderBtn = ([key, label, flag]) => {
              const Icon = SECTION_ICON[key] || FaGaugeHigh;
              const on = view === key;
              const notif = nf(key);
              return (
                <button key={key} onClick={() => setView(key)}
                  className={`relative flex items-center gap-3 rounded-xl2 px-3.5 py-2.5 text-sm font-bold whitespace-nowrap transition-colors ${on ? "text-g-word" : "text-g-muted hover:text-g-word"}`}>
                  {on && <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl2 bg-white/[0.07] border border-g-gold/30" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                  <Icon size={15} className="relative" /><span className="relative">{label}</span>
                  {flag === "soon"
                    ? <span className="relative ml-auto text-[8px] font-black uppercase tracking-wider text-g-gold/90 bg-g-gold/10 rounded px-1 py-0.5">soon</span>
                    : notif > 0 && <span className="relative ml-auto inline-grid place-items-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black shadow-[0_0_8px_rgba(239,68,68,0.55)]">{notif}</span>}
                </button>
              );
            };
            const seen = new Set();
            const groups = NAV_GROUPS.map(([g, keys]) => {
              const items = keys.map((k) => sections.find((s) => s[0] === k)).filter(Boolean);
              items.forEach((it) => seen.add(it[0]));
              return [g, items];
            }).filter(([, items]) => items.length);
            const leftover = sections.filter((s) => !seen.has(s[0]));
            if (leftover.length) groups.push(["More", leftover]);
            return groups.map(([g, items]) => (
              <div key={g || "main"} className="contents lg:block">
                {g && <div className="hidden lg:block px-3.5 pt-3 pb-1 text-[9px] font-bold uppercase tracking-wider text-g-muted/60">{g}</div>}
                {items.map(renderBtn)}
              </div>
            ));
          })()}
        </nav>
        <div className="hidden lg:block px-4 mt-auto py-4 space-y-3">
          {V.plan && (
            <div className="rounded-xl2 border border-g-gold/25 bg-g-gold/[0.06] p-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide"><span className="text-g-gold">{V.plan.label}</span><span className="text-g-muted">{V.plan.used} / {V.plan.total.toLocaleString()}</span></div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${Math.max(2, (V.plan.used / V.plan.total) * 100)}%` }} /></div>
              <div className="mt-1.5 text-[10px] text-g-muted">{V.plan.unit}</div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="grid place-items-center h-8 w-8 rounded-full bg-g-green/15 text-xs font-bold text-g-light">JS</span>
            <div className="leading-tight min-w-0 flex-1"><div className="text-xs font-bold text-g-word truncate">Jane Staff</div><div className="text-[10px] text-g-muted truncate">{CONNECTED ? "Staff · admin" : "Demo mode"}</div></div>
            <button onClick={logout} title="Sign out" className="text-g-muted hover:text-red-400 transition text-[11px] font-bold">Sign out</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* topbar */}
        <header className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-md sticky top-0 z-20">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-g-word truncate">{title}</h1>
            <p className="text-[11px] text-g-muted truncate">{V.business.name} · {V.business.place} · {V.business.since}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setPaletteOpen(true)} className="hidden md:flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-g-muted w-40 hover:border-g-gold/40 transition"><FaMagnifyingGlass size={11} /><span className="truncate">Search… ⌘K</span></button>
            <button onClick={exportReport} className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word hover:border-g-gold/40 transition"><FaDownload size={11} /> Report</button>
            <div className="relative">
              <button onClick={() => setBellOpen((o) => !o)} className="relative grid place-items-center h-9 w-9 rounded-full border border-white/12 bg-white/[0.04] text-g-muted hover:text-g-word transition" aria-label={`Notifications (${totalNotif})`}><FaBell size={13} />{totalNotif > 0 && <span className="absolute -top-1 -right-1 inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black shadow-[0_0_8px_rgba(239,68,68,0.6)]">{totalNotif}</span>}</button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-xl2 border border-white/12 bg-g-cream/95 backdrop-blur-xl shadow-lift z-30 p-1.5">
                    <div className="flex items-center justify-between px-2.5 py-1.5"><span className="text-[10px] font-bold uppercase tracking-wide text-g-muted">Notifications</span>{totalNotif > 0 && <button onClick={() => { setNotifsRead(true); setBellOpen(false); toast("All caught up ✓"); }} className="text-[10px] font-bold text-g-gold hover:underline">Mark all read</button>}</div>
                    {notifList.length ? notifList.map(({ k, l, n }) => (
                      <button key={k} onClick={() => { setView(k); setBellOpen(false); }} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-bold text-left text-g-muted hover:text-g-word hover:bg-white/[0.06] transition">
                        <span className="grid place-items-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black">{n}</span>
                        <span className="flex-1 text-g-word">{l}</span><span className="text-g-muted">view →</span>
                      </button>
                    )) : <div className="px-2.5 py-6 text-center text-xs text-g-muted">✅ All caught up</div>}
                  </div>
                </>
              )}
            </div>
            <div className="hidden lg:flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] p-1">
              {["7 days", "30 days", "90 days"].map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-3 py-1 text-xs font-bold transition ${period === p ? "bg-g-gold/15 text-g-gold" : "text-g-muted hover:text-g-word"}`}>{p}</button>
              ))}
            </div>
            <span className="grid place-items-center h-9 w-9 rounded-full bg-g-green/15 text-sm font-extrabold text-g-light">{V.business.name[0]}</span>
          </div>
        </header>

        {/* demo banner + INDUSTRY SWITCHER (demo only — real clients get their own fixed industry) */}
        <div className="px-5 sm:px-8 pt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-g-gold/30 bg-g-gold/[0.08] px-4 py-2 text-[11px] font-bold text-g-gold inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" /> Demo data — each client sees their own industry.
          </div>
          <div className="ml-auto relative">
            <span className="text-[11px] font-bold uppercase tracking-wide text-g-muted hidden md:inline mr-2">Preview industry</span>
            <button onClick={() => setVertOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={vertOpen}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-2 text-xs font-bold text-g-word hover:border-g-gold/40 transition">
              <span className="text-base">{V.icon}</span><span>{V.label}</span><FaChevronDown size={10} className={`transition-transform ${vertOpen ? "rotate-180" : ""}`} />
            </button>
            {vertOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setVertOpen(false)} />
                <div role="listbox" className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto rounded-xl2 border border-white/12 bg-g-cream/95 backdrop-blur-xl shadow-lift z-30 p-1.5">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-g-muted">Industry · demo</div>
                  {VERTICAL_KEYS.map((k) => {
                    const on = vertical === k;
                    return (
                      <button key={k} role="option" aria-selected={on} onClick={() => { switchVertical(k); setVertOpen(false); }}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-bold text-left transition ${on ? "bg-g-green/15 text-g-light" : "text-g-muted hover:text-g-word hover:bg-white/[0.06]"}`}>
                        <span className="text-base">{VERTICALS[k].icon}</span><span className="flex-1">{VERTICALS[k].label}</span>{on && <span className="text-g-green">●</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* content — keyed by view+vertical = clean remount/fade per switch */}
        <div className="p-5 sm:p-8">
          <motion.div key={view + vertical} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {content}
          </motion.div>
        </div>
      </main>

      {/* persistent support — 1 click to your team, from any view */}
      <a href={waLink("Hi Guileo team! I need help with my account")} target="_blank" rel="noopener"
        className="fixed bottom-5 right-5 z-40 btn-bright text-sm shadow-lift">
        💬 <span className="hidden sm:inline">Talk to your team</span>
      </a>

      {paletteOpen && <Palette V={V} sections={sections} onNav={setView} onClose={() => setPaletteOpen(false)} />}
      <Toaster />
    </div>
  );
}
