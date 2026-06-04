import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { portalApi, CONNECTED } from "../lib/portalApi.js";
import {
  FaGaugeHigh, FaComments, FaBullhorn, FaUsers, FaHeadset, FaFileLines, FaListCheck,
  FaArrowLeft, FaArrowTrendUp, FaArrowTrendDown, FaWhatsapp, FaInstagram, FaPhone, FaFacebook, FaTiktok, FaGoogle,
  FaReceipt, FaUtensils, FaBookOpen, FaBullseye, FaPhoneVolume, FaCommentSms, FaGear, FaChartLine,
  FaDownload, FaBell, FaMagnifyingGlass, FaStore, FaBrain, FaCreditCard, FaChevronDown, FaShareNodes,
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
    ["overview", "Overview"], ["brain", "Train your AI"], ["analytics", "AI Analytics", "soon"],
    ...sec,
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
    default: return 0;
  }
}
const SECTION_ICON = {
  overview: FaGaugeHigh, operations: FaListCheck, schedule: FaListCheck, catalog: FaBookOpen, brain: FaBrain, analytics: FaChartLine, liveorders: FaReceipt,
  kitchen: FaUtensils, menu: FaBookOpen, customers: FaUsers, campaigns: FaBullhorn, audiences: FaBullseye,
  calllogs: FaPhone, dialer: FaPhoneVolume, whatsapp: FaWhatsapp, sms: FaCommentSms, social: FaShareNodes, grow: FaStore, billing: FaCreditCard,
  channels: FaComments, ads: FaBullhorn, leads: FaUsers, support: FaHeadset, docs: FaFileLines, settings: FaGear,
};

function Card({ children, className = "" }) {
  return <div className={`rounded-xl2 border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 ${className}`}>{children}</div>;
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
                    <button onClick={() => { portalApi.resolveAlert(i); setResolved((r) => [...r, i]); }} className="mt-2 text-[10px] font-bold text-g-green hover:underline">Resolve ✓</button>
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
function ComingSoon({ title }) {
  return <Card className="text-center py-16"><div className="text-3xl mb-2">✨</div><div className="text-lg font-extrabold text-g-word">{title}</div><div className="text-sm text-g-muted mt-1">Coming soon — deep AI insights on your data.</div></Card>;
}
function LiveOrders({ V }) {
  const rows = V.liveOrders || [];
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">Live orders</span><span className="text-[11px] text-g-muted inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{rows.length} active</span></div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map((o, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <span className="text-xs font-bold text-g-light w-16 shrink-0">{o.id}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{o.customer}</div><div className="text-[11px] text-g-muted truncate">{o.items} · {o.channel}</div></div>
            <span className="text-sm font-extrabold text-g-word">${o.total.toFixed(2)}</span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: o.color + "22", color: o.color }}>{o.status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
function Kitchen({ V }) {
  const init = V.kitchen || { new: [], preparing: [], ready: [] };
  const [board, setBoard] = useState({ new: [...(init.new || [])], preparing: [...(init.preparing || [])], ready: [...(init.ready || [])] });
  const flow = ["new", "preparing", "ready", "done"];
  const advance = (col, i) => setBoard((b) => {
    const item = b[col][i]; const next = flow[flow.indexOf(col) + 1];
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
  return (
    <div className="space-y-4">
      <MiniStats items={[["Total customers", `${rows.length * 104}`], ["New this week", `+${rows.length * 6}`, "good"], ["Avg. value", `$${Math.round(totalSpent / rows.length)}`], ["Repeat rate", "38%", "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Customers</div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{c.name[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{c.name}{i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-g-gold/15 text-g-gold">TOP</span>}</div><div className="text-[11px] text-g-muted truncate">{c.orders} {c.noun || "orders"} · {c.channel} · {c.last}</div></div>
              <span className="text-sm font-extrabold text-g-green">${c.spent.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
function Campaigns({ V }) {
  const rows = V.campaigns || genCampaigns(V);
  const sent = rows.reduce((s, c) => s + c.sent, 0);
  const rev = rows.reduce((s, c) => s + c.revenue, 0);
  const open = Math.round(rows.reduce((s, c) => s + c.opened, 0) / rows.length);
  return (
    <div className="space-y-4">
      <MiniStats items={[["Campaigns", `${rows.length}`], ["Messages sent", sent.toLocaleString()], ["Avg. open rate", `${open}%`, "good"], ["Revenue", `$${rev.toLocaleString()}`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">Campaigns</span><a href={waLink("I'd like to launch a campaign")} target="_blank" rel="noopener" className="text-[11px] font-bold text-g-gold hover:underline">New campaign →</a></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name}</div><div className="text-[11px] text-g-muted">{c.channel} · {c.sent} sent · {c.opened}% opened</div></div>
              <span className="text-sm font-extrabold text-g-green">${c.revenue.toLocaleString()}</span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: (c.status === "Active" ? "#3E9468" : "#D6C29A") + "22", color: c.status === "Active" ? "#3E9468" : "#D6C29A" }}>{c.status}</span>
            </div>
          ))}
        </div>
      </Card>
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
  return (
    <div className="space-y-4">
      <MiniStats items={[["Calls answered", `${rows.length * 78}`], ["Missed calls", "0", "good"], ["Avg. duration", "1m 14s"], ["Handled by AI", "100%", "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Recent calls · answered by AI</div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color: c.color }}><FaPhone size={13} /></span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name} <span className="text-g-muted font-normal">· {c.phone}</span></div><div className="text-[11px] text-g-muted truncate">{c.outcome}</div></div>
            <div className="text-right shrink-0"><div className="text-[11px] text-g-light font-bold">{c.dur}</div><div className="text-[10px] text-g-muted">{c.time}</div></div>
          </div>
          ))}
        </div>
      </Card>
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
  const send = (e) => { e.preventDefault(); if (!draft.trim()) return; portalApi.sendMessage(title, active, draft); setThreads((t) => ({ ...t, [active]: [...(t[active] || []), { from: "you", text: draft }] })); setDraft(""); };
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
function SettingsView({ V }) {
  const rows = [["Business name", V.business.name], ["Location", V.business.place], ["AI voice agent", "On"], ["WhatsApp & SMS", "On"], ["Auto reviews", "On"], ["Language", "English"]];
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">Settings</div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-muted">{k}</span><span className="text-sm font-bold text-g-word">{v}</span></div>
        ))}
      </div>
    </Card>
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

function AIBrain({ V }) {
  const cards = [
    ["🏢", "Business info", `${V.business.name} · ${V.business.place} · Hours: Mon–Sun, 9am–10pm`],
    ["📋", V.ops?.listTitle || "Menu & services", (V.ops?.list || []).map((x) => x.name).join(" · ") || "Set up with your team"],
    ["❓", "Top questions it answers", "Hours · Location · Pricing · Booking · Delivery · Specials"],
    ["🎙️", "Voice & languages", "Warm & friendly · English, Portuguese, Spanish"],
    ["⤴️", "Escalation rules", "Refunds & complaints → human · VIPs → owner"],
    ["⭐", "After every interaction", "Asks happy customers for a 5★ review automatically"],
  ];
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">🧠 Your AI's brain</div><div className="text-xs text-g-muted mt-0.5">Everything your AI knows and how it answers. Want a change? Your team updates it for you.</div></div>
          <a href={waLink("Hi Guileo! I'd like to update what my AI knows")} target="_blank" rel="noopener" className="btn-bright text-sm">Request an update →</a>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word"><span className="text-g-green">✓</span> Last trained 2 days ago</span>
          {["🇺🇸 English", "🇧🇷 Português", "🇪🇸 Español"].map((l) => <span key={l} className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word">{l}</span>)}
        </div>
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
  return (
    <div className="space-y-4">
      {o.stats && (
        <div className="grid sm:grid-cols-3 gap-4">
          {o.stats.map((s) => (<Card key={s.label}><div className="text-[11px] uppercase tracking-wide text-g-muted">{s.label}</div><div className={`text-2xl font-extrabold mt-1 ${s.tone === "good" ? "text-g-green" : "text-g-word"}`}>{s.value}</div></Card>))}
        </div>
      )}
      {o.schedule && (
        <div className="flex flex-wrap gap-2">
          {Object.entries((o.schedule || []).reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {})).map(([st, n]) => (
            <span key={st} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word">{st} <span className="text-g-muted">{n}</span></span>
          ))}
        </div>
      )}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{o.scheduleTitle || "Today"}</div>
        <div className="divide-y divide-white/[0.06]">
          {(o.schedule || []).map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="text-xs font-bold text-g-light w-20 shrink-0 inline-block truncate align-middle" title={r.time}>{r.time}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted truncate">{r.meta}{r.ch && r.ch !== "—" ? ` · ${r.ch}` : ""}</div></div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: r.color + "22", color: r.color }}>{r.status}</span>
            </div>
          ))}
        </div>
      </Card>
      {o.grid && (
        <Card><div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{o.gridTitle}</div><div className="grid grid-cols-6 sm:grid-cols-8 gap-2">{o.grid.map((g, i) => (<div key={i} className={`grid place-items-center h-10 rounded-lg text-xs font-bold border ${g.on ? "border-g-green/50 bg-g-green/15 text-g-light" : "border-white/10 bg-white/[0.03] text-g-muted"}`}>{g.label}</div>))}</div></Card>
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
  useEffect(() => { portalApi.session().then((s) => { if (s) setAuthed(true); }).finally(() => setBooting(false)); }, []);
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
  };
  const content = {
    overview: <Overview V={V} onNav={setView} />,
    operations: <Operations V={V} />,
    schedule: <ScheduleScreen V={V} />,
    catalog: <CatalogScreen V={V} />,
    social: <SocialInbox V={V} />,
    analytics: <ComingSoon title="AI Analytics" />,
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

  return (
    <div className="min-h-screen text-g-ink flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-60 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-white/10 bg-white/[0.03] backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="flex items-center gap-2 px-5 py-4">
          <img src={logo} alt="Guileo" className="h-8 w-8 object-contain" />
          <div className="leading-tight"><div className="text-sm font-extrabold text-g-word">Growth Cockpit</div><div className="text-[10px] text-g-muted">{V.icon} {V.business.name}</div></div>
        </div>
        <nav aria-label="Dashboard sections" className="flex lg:flex-col gap-1 px-3 pb-3 overflow-x-auto">
          {sections.map(([key, label, flag]) => {
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
          })}
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
            <div className="hidden md:flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-g-muted w-40"><FaMagnifyingGlass size={11} /><span className="truncate">Search… ⌘K</span></div>
            <button onClick={exportReport} className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word hover:border-g-gold/40 transition"><FaDownload size={11} /> Report</button>
            <div className="relative">
              <button onClick={() => setBellOpen((o) => !o)} className="relative grid place-items-center h-9 w-9 rounded-full border border-white/12 bg-white/[0.04] text-g-muted hover:text-g-word transition" aria-label={`Notifications (${totalNotif})`}><FaBell size={13} />{totalNotif > 0 && <span className="absolute -top-1 -right-1 inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black shadow-[0_0_8px_rgba(239,68,68,0.6)]">{totalNotif}</span>}</button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-xl2 border border-white/12 bg-g-cream/95 backdrop-blur-xl shadow-lift z-30 p-1.5">
                    <div className="flex items-center justify-between px-2.5 py-1.5"><span className="text-[10px] font-bold uppercase tracking-wide text-g-muted">Notifications</span>{totalNotif > 0 && <button onClick={() => { setNotifsRead(true); setBellOpen(false); }} className="text-[10px] font-bold text-g-gold hover:underline">Mark all read</button>}</div>
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
    </div>
  );
}
