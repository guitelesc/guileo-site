import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { portalApi, CONNECTED, toast, onToast } from "../lib/portalApi.js";
import {
  FaGaugeHigh, FaComments, FaBullhorn, FaUsers, FaHeadset, FaFileLines, FaListCheck,
  FaArrowLeft, FaArrowTrendUp, FaArrowTrendDown, FaWhatsapp, FaInstagram, FaPhone, FaFacebook, FaTiktok, FaGoogle,
  FaReceipt, FaUtensils, FaBookOpen, FaBullseye, FaPhoneVolume, FaCommentSms, FaGear, FaChartLine,
  FaDownload, FaBell, FaMagnifyingGlass, FaStore, FaBrain, FaCreditCard, FaChevronDown, FaShareNodes,
  FaArrowsRotate, FaClock, FaStar, FaIdCard,
  FaPen, FaTrash, FaPlus, FaCircleCheck, FaWandMagicSparkles,
  FaTruck, FaLocationDot, FaGift, FaUserPlus,
  FaPlug, FaStripe, FaShopify, FaSlack, FaEnvelope, FaCalendarDays, FaFileInvoiceDollar, FaMeta, FaGoogleDrive,
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
// Deterministic per-sector number: stable for a given (label,salt), distinct across
// sectors — so "store-wide" stats vary realistically instead of showing the same
// hardcoded "8 / 31 / 9" for every vertical.
function vhash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function vnum(label, salt, min, max) { return min + (vhash(`${label}|${salt}`) % (max - min + 1)); }

// Records created FROM a conversation (chat/call) persist so they genuinely appear
// at the top of the target tab — closes the "action lands in its tab" loop.
const createdKey = (label, view) => `${label}:created:${view}`;
function pushCreated(label, view, rec) {
  const cur = portalApi.loadState(createdKey(label, view), []);
  const id = Date.now();
  portalApi.saveState(createdKey(label, view), [{ ...rec, fromChat: true, _id: id }, ...cur].slice(0, 25));
  return id;
}
const loadCreated = (label, view) => portalApi.loadState(createdKey(label, view), []);
// Undo a chat-created record: drop it from its tab's created list by _id.
function removeCreated(label, view, id) {
  const cur = portalApi.loadState(createdKey(label, view), []);
  portalApi.saveState(createdKey(label, view), cur.filter((r) => r._id !== id));
}
function recordFor(view, who, channel, V) {
  if (view === "liveorders") return { id: `#${1000 + (Date.now() % 9000)}`, customer: who, items: `New order · via ${channel}`, total: 0, channel, status: "New", color: "#3E9468" };
  if (view === "schedule") return { time: "ASAP", name: who, meta: `Booked via ${channel}`, status: "Pending", ch: channel, color: "#D6C29A" };
  if (view === "deliveries") { const cfg = deliveryCfg(V); return { customer: who, who: `${cfg.who} · assigning`, eta: "Assigning…", status: "Preparing", color: "#D6C29A", addr: `From ${channel}`, via: cfg.own[0] }; }
  return null;
}
// Log a $ event to the Guileo Impact growth ledger (the revenue-share basis): when
// an order is fulfilled / a deal won / a delivery completed, the money the AI drove
// shows up in Impact and bumps the total — closing the loop to what Guileo gets paid on.
const logImpact = (label, what, amt) => pushCreated(label, "impact", { t: "now", what, amt });

// Gui credit usage ledger — every metered task logs its cost + day, so the owner
// sees exactly what their AI credits bought (transparency drives trust + top-ups).
function logUsage(cost, label) {
  if (!cost) return;
  const day = new Date().toISOString().slice(0, 10);
  const cur = portalApi.loadState("gui_usage", []);
  portalApi.saveState("gui_usage", [{ day, cost, label: (label || "").slice(0, 60), _id: Date.now() }, ...cur].slice(0, 200));
}
// Roll the usage ledger into the last N days (oldest→newest) for a mini bar chart.
function usageByDay(days = 7) {
  const log = portalApi.loadState("gui_usage", []);
  const today = new Date();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const total = log.filter((u) => u.day === key).reduce((s, u) => s + (u.cost || 0), 0);
    out.push({ day: key, label: d.toLocaleDateString("en-US", { weekday: "short" }), total });
  }
  return out;
}

// ── Delivery / dispatch config per sector ──
// Restaurants plug into Uber Eats / DoorDash / Grubhub AND run their own drivers;
// every other vertical gets the equivalent logistics layer (carriers, field techs,
// mobile visits, couriers). `partners` = third-party platforms to connect;
// `own` = Guileo-run delivery that keeps 0% commission + the customer relationship.
const DELIVERY = {
  "Restaurant": { title: "Delivery & couriers", noun: "deliveries", who: "Driver", partners: [["Uber Eats", "🛵", "#06C167"], ["DoorDash", "🚗", "#FF3008"], ["Grubhub", "🍴", "#F63440"]], own: ["Guileo Direct", "Your own drivers — 0% commission, you keep the customer"] },
  "E-Commerce": { title: "Shipping & fulfilment", noun: "shipments", who: "Carrier", partners: [["UPS", "📦", "#8B6F47"], ["FedEx", "✈️", "#4D148C"], ["USPS", "📮", "#333366"], ["DHL", "🚚", "#D4A520"]], own: ["Local same-day", "Your courier for nearby orders"] },
  "Plumbing & HVAC": { title: "Field dispatch", noun: "jobs", who: "Tech", partners: [], own: ["Guileo Dispatch", "Auto-route technicians to the next job"] },
  "Construction": { title: "Crew & material dispatch", noun: "drops", who: "Crew", partners: [], own: ["Guileo Dispatch", "Route crews & material deliveries"] },
  "Auto Dealership": { title: "Pickup & delivery", noun: "vehicles", who: "Driver", partners: [], own: ["Valet & loaner", "Pick up and drop off customer vehicles"] },
  "Clinic": { title: "Prescriptions & home visits", noun: "deliveries", who: "Courier", partners: [["Local pharmacy", "💊", "#3E9468"]], own: ["Mobile nurse / courier", "Send meds or a nurse to the patient"] },
  "Medical": { title: "Prescriptions & home care", noun: "deliveries", who: "Courier", partners: [["Local pharmacy", "💊", "#3E9468"]], own: ["Mobile care / courier", "Home care visits and sample pickup"] },
  "Salon & Spa": { title: "At-home appointments", noun: "visits", who: "Stylist", partners: [], own: ["Mobile glow squad", "Send a stylist to the client's home"] },
  "Gym & Fitness": { title: "On-site & home training", noun: "sessions", who: "Coach", partners: [], own: ["Mobile trainers", "Train clients at home or work"] },
  "Education": { title: "On-site & home tutoring", noun: "sessions", who: "Tutor", partners: [], own: ["Mobile tutors", "Send a tutor to the student"] },
  "Law Firm": { title: "Document courier", noun: "deliveries", who: "Courier", partners: [["Legal courier", "📄", "#8B6F47"]], own: ["Same-day courier", "Get documents signed & filed on time"] },
  "Real Estate": { title: "Showings & key handoff", noun: "handoffs", who: "Agent", partners: [], own: ["Agent / lockbox", "Coordinate key handoffs and showings"] },
};
const deliveryCfg = (V) => DELIVERY[V.label] || DELIVERY["Restaurant"];

// ── Loyalty & referrals config per sector ──
const LOYALTY = {
  "Restaurant": { unit: "points", reward: "a free item", earn: "$1 spent = 1 point" },
  "E-Commerce": { unit: "points", reward: "$ off next order", earn: "$1 spent = 1 point" },
  "Clinic": { unit: "credits", reward: "a free cleaning", earn: "1 credit per visit" },
  "Medical": { unit: "credits", reward: "a free check-up", earn: "1 credit per visit" },
  "Salon & Spa": { unit: "points", reward: "a free treatment", earn: "points per visit" },
  "Gym & Fitness": { unit: "points", reward: "a free month", earn: "points per check-in" },
  "Auto Dealership": { unit: "points", reward: "a free service", earn: "points per service" },
  "Plumbing & HVAC": { unit: "credits", reward: "a free tune-up", earn: "1 credit per job" },
  "Education": { unit: "points", reward: "a free class", earn: "points per class" },
  "Law Firm": { unit: "credits", reward: "a free consult", earn: "1 credit per matter" },
  "Real Estate": { unit: "points", reward: "a closing gift", earn: "points per deal" },
  "Construction": { unit: "credits", reward: "priority scheduling", earn: "1 credit per project" },
};
const loyaltyCfg = (V) => LOYALTY[V.label] || { unit: "points", reward: "a reward", earn: "points per visit" };

// ── Team / staff per sector (reuses STAFF map for names) ──
const TEAM_ROLE = { "Restaurant": "Server", "Clinic": "Dentist", "Medical": "Doctor", "Salon & Spa": "Stylist", "Gym & Fitness": "Coach", "Law Firm": "Attorney", "Real Estate": "Agent", "Plumbing & HVAC": "Technician", "Auto Dealership": "Advisor", "Education": "Teacher", "Construction": "Foreman", "E-Commerce": "Support rep" };
function genLocations(V) {
  const n = V.business.name;
  return [
    { name: `${n} · Main`, addr: V.business.place || "Main St", status: "Open", revenue: vnum(V.label, "loc1", 1800, 9000), staff: (STAFF[V.label] || []).length || 3, today: vnum(V.label, "loc1o", 20, 120) },
    { name: `${n} · Downtown`, addr: "Downtown", status: "Open", revenue: vnum(V.label, "loc2", 1200, 7000), staff: 3, today: vnum(V.label, "loc2o", 14, 90) },
    { name: `${n} · Uptown`, addr: "Uptown", status: "Busy", revenue: vnum(V.label, "loc3", 900, 5000), staff: 2, today: vnum(V.label, "loc3o", 8, 60) },
  ];
}
function genTeam(V) {
  const staff = (STAFF[V.label] || ["Team member"]).filter((s) => s && !/stand|desk|AI|Fulfillment|Packing|bay/i.test(s));
  const role = TEAM_ROLE[V.label] || "Team member";
  return staff.map((name, i) => ({ name, role: i === 0 ? `Lead ${role.toLowerCase()}` : role, status: "Active", handled: vnum(V.label, `${name}h`, 14, 92), revenue: vnum(V.label, `${name}r`, 900, 6400), rating: ((46 + vnum(V.label, `${name}rt`, 0, 3)) / 10) }));
}
function genLoyaltyMembers(V) {
  return (V.customers || genCustomers(V)).map((c, i) => ({ name: c.name, pts: vnum(V.label, `${c.name}pts`, 120, 940), tier: i === 0 ? "Gold" : i === 1 ? "Silver" : "Bronze", channel: c.channel }));
}
function genPayments(V) {
  const names = (V.customers || genCustomers(V)).map((c) => c.name);
  const ST = [["Paid", "#3E9468"], ["Pending", "#D6C29A"], ["Overdue", "#EF4444"], ["Paid", "#3E9468"], ["Pending", "#D6C29A"]];
  const M = ["Card", "Apple Pay", "Cash", "Transfer", "Card"];
  return (names.length ? names : ["Ana R.", "Bruno T.", "Carla M.", "Diego P."]).slice(0, 5).map((n, i) => {
    const [status, color] = ST[i % ST.length];
    return { id: `INV-${2040 + i}`, customer: n, amount: vnum(V.label, `${n}inv`, 40, 480), status, color, method: M[i % M.length], due: status === "Paid" ? "Paid" : `in ${2 + i} days` };
  });
}
function genReferrals(V) {
  const sch = (V.ops?.schedule || []).map((r) => r.name).filter(Boolean);
  const reward = 20;
  return [
    { name: sch[0] || "Ana R.", note: "referred a friend who joined", status: "Joined", reward },
    { name: sch[1] || "Bruno T.", note: "invite sent · awaiting", status: "Pending", reward },
    { name: sch[2] || "Carla M.", note: "referred 2 friends", status: "Joined", reward: reward * 2 },
    { name: sch[3] || "Diego P.", note: "invite opened", status: "Pending", reward },
  ];
}
// Short sidebar label for the delivery/dispatch tab, per sector.
const deliveryTab = (V) => ({ "E-Commerce": "Shipping", "Plumbing & HVAC": "Dispatch", "Construction": "Dispatch", "Auto Dealership": "Logistics", "Salon & Spa": "Mobile visits", "Gym & Fitness": "Mobile sessions", "Education": "Mobile sessions", "Law Firm": "Courier", "Real Estate": "Handoffs", "Clinic": "Deliveries", "Medical": "Deliveries" }[V.label] || "Delivery");
function genDeliveries(V) {
  const cfg = deliveryCfg(V);
  const names = (V.ops?.schedule || []).map((r) => r.name).filter(Boolean);
  const ST = [["Preparing", "#D6C29A"], ["En route", "#38BDF8"], ["Arriving", "#3E9468"], ["Delivered", "#7C7C7C"]];
  const ppl = ["Alex", "Sam", "Júlia", "Marco", "Bia"];
  return (names.length ? names : ["Order #1049", "Order #1048", "Order #1047", "Order #1046"]).slice(0, 4).map((n, i) => {
    const [status, color] = ST[i % ST.length];
    const via = cfg.partners.length ? cfg.partners[i % cfg.partners.length][0] : cfg.own[0];
    return { customer: n, who: `${cfg.who} ${ppl[i % ppl.length]}`, eta: status === "Delivered" ? "Delivered" : `${8 + i * 6} min`, status, color, addr: `${100 + i * 37} Main St`, via };
  });
}
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
  // Vertical-aware promo so each sector's campaigns read like its real marketing.
  const PROMO = {
    "Restaurant": "Weekend special · regulars", "Clinic": "6-month cleaning recall", "Medical": "Annual check-up reminder",
    "Salon & Spa": "Rebook your glow · 20% off", "Gym & Fitness": "New year · bring a friend", "Auto Dealership": "Service due · book now",
    "Plumbing & HVAC": "Pre-winter HVAC tune-up", "Law Firm": "Free 15-min consult", "Real Estate": "New listings in your area",
    "Education": "Enroll for next term", "Construction": "Spring project slots open", "E-Commerce": "Back in stock · VIP early access",
  };
  const promo = PROMO[V.label] || "Promo · this week";
  return [
    { name: "Reactivation · lapsed leads", channel: ch, sent: 840, opened: 46, revenue: 1240, status: "Active" },
    { name: promo, channel: "Email", sent: 520, opened: 38, revenue: 820, status: "Active" },
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
  const WANT = { "Restaurant": "Table for 2 tonight", "Clinic": "Earlier cleaning slot", "Medical": "Earlier appointment", "Salon & Spa": "Saturday haircut", "Gym & Fitness": "HIIT 7am spot", "Auto Dealership": "Service this week", "Plumbing & HVAC": "Same-day visit", "Education": "Evening class seat", "Law Firm": "Consultation this week", "Real Estate": "Weekend viewing", "Construction": "On-site estimate", "E-Commerce": "Back-in-stock alert" };
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
    ["overview", "Overview"], ["impact", "Guileo Impact"], ["brain", "Train your AI"], ["analytics", "AI Analytics"], ["insights", "AI Insights"], ["integrations", "Integrations"],
    ...sec,
    ["deliveries", deliveryTab(V)],
    ["payments", "Payments"], ["followups", "Follow-ups"], ["waitlist", "Waitlist"], ["recurring", "Recurring"], ["reputation", "Reputation"], ["loyalty", "Loyalty"],
    ["customers", "Customers"], ["campaigns", "Campaigns"], ["audiences", "Ad Audiences"],
    ["inbox", "Inbox"], ["calllogs", "Call Logs"], ["dialer", "Call Dialer"], ["whatsapp", "WhatsApp"], ["sms", "SMS"], ["social", "Social"],
    ["grow", "Grow with Guileo"], ["locations", "Locations"], ["team", "Team"], ["billing", "Billing & Plan"], ["support", "Support"], ["settings", "Settings"],
  ];
}
// Red notification counts per menu item — drives urgency badges in the sidebar
function notifFor(key, V) {
  switch (key) {
    case "overview": return V.alerts ? V.alerts.items.length : 0;
    case "liveorders": return ([...loadCreated(V.label, "liveorders"), ...(V.liveOrders || [])]).filter((o) => o.status !== "Delivered").length;
    case "kitchen": return ((V.kitchen?.new || []).length + (V.kitchen?.preparing || []).length);
    case "deliveries": return ([...loadCreated(V.label, "deliveries"), ...genDeliveries(V)]).filter((r) => r.status !== "Delivered").length;
    case "inbox": return genInbox(V).filter((c) => c.unread).length;
    case "payments": return ([...loadCreated(V.label, "payments"), ...genPayments(V)]).filter((p) => p.status === "Overdue" || p.status === "Pending").length;
    case "schedule": return ([...loadCreated(V.label, "schedule"), ...(V.ops?.schedule || [])]).filter((r) => /pending|new|unassigned|risk|follow/i.test(r.status)).length;
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
  overview: FaGaugeHigh, operations: FaListCheck, schedule: FaListCheck, catalog: FaBookOpen, brain: FaBrain, analytics: FaChartLine, insights: FaWandMagicSparkles, integrations: FaPlug, liveorders: FaReceipt,
  kitchen: FaUtensils, menu: FaBookOpen, deliveries: FaTruck, customers: FaUsers, campaigns: FaBullhorn, audiences: FaBullseye,
  inbox: FaComments, calllogs: FaPhone, dialer: FaPhoneVolume, whatsapp: FaWhatsapp, sms: FaCommentSms, social: FaShareNodes, grow: FaStore, billing: FaCreditCard,
  impact: FaArrowTrendUp, followups: FaArrowsRotate, waitlist: FaClock, recurring: FaIdCard, reputation: FaStar, loyalty: FaGift, payments: FaReceipt,
  channels: FaComments, ads: FaBullhorn, leads: FaUsers, support: FaHeadset, docs: FaFileLines, settings: FaGear, team: FaUsers, locations: FaLocationDot,
};
// Group the (long) nav into scannable categories
// Order = everyday use first (operations/conversations/customers), then growth/strategy, then account.
const NAV_GROUPS = [
  ["", ["overview"]],
  ["Your AI ✨", ["brain", "analytics", "insights", "grow"]],
  ["Operations", ["liveorders", "kitchen", "menu", "schedule", "catalog", "deliveries", "operations"]],
  ["Conversations", ["inbox", "calllogs", "dialer", "whatsapp", "sms", "social"]],
  ["Customers", ["customers"]],
  ["Grow revenue", ["impact", "payments", "followups", "waitlist", "recurring", "reputation", "loyalty", "campaigns", "audiences", "integrations"]],
  ["Account", ["locations", "team", "billing", "support", "settings"]],
];
// Portal UI translation (PT) — keyed by the English string. Covers the most-visible
// chrome (nav groups, section titles, topbar). tr() returns PT when lang==='pt'.
const PT_UI = {
  // nav groups
  "Your AI ✨": "Sua IA ✨", "Operations": "Operações", "Conversations": "Conversas", "Customers": "Clientes", "Grow revenue": "Crescer receita", "Account": "Conta", "More": "Mais",
  // section labels
  "Overview": "Visão geral", "Guileo Impact": "Impacto Guileo", "Train your AI": "Treinar sua IA", "AI Analytics": "Análises de IA", "AI Insights": "Insights de IA", "Integrations": "Integrações",
  "Live Orders": "Pedidos ao vivo", "Kitchen View": "Cozinha", "Menu": "Cardápio", "Delivery": "Entregas", "Payments": "Pagamentos", "Follow-ups": "Follow-ups", "Waitlist": "Lista de espera",
  "Recurring": "Recorrentes", "Reputation": "Reputação", "Loyalty": "Fidelidade", "Customers ": "Clientes", "Campaigns": "Campanhas", "Ad Audiences": "Públicos de anúncio",
  "Inbox": "Caixa de entrada", "Call Logs": "Chamadas", "Call Dialer": "Discador", "Social": "Social", "Grow with Guileo": "Crescer com a Guileo", "Locations": "Locais", "Team": "Equipe",
  "Billing & Plan": "Plano e cobrança", "Support": "Suporte", "Settings": "Ajustes", "Operations": "Operações",
  // topbar
  "Report": "Relatório", "Search…": "Buscar…",
  "Plans": "Planos", "Current": "Atual", "mo": "mês", "Your plan": "Seu plano", "Upgrade →": "Fazer upgrade →", "Switch →": "Trocar →",
  "+ Recharge": "+ Recarregar",
  "+ Recharge credits": "+ Recarregar créditos",
  "250 free credits": "250 créditos grátis",
  "AI Call Dialer": "Discador da IA",
  "AI voice & greeting": "Voz e saudação da IA",
  "Business profile": "Perfil do negócio",
  "Connect accounts →": "Conectar contas →",
  "Connect your delivery platforms": "Conecte suas plataformas de entrega",
  "Copy link": "Copiar link",
  "Current plan": "Plano atual",
  "Customer →": "Cliente →",
  "Documents &amp; billing": "Documentos e cobrança",
  "Growth Guileo drove · this month": "Crescimento que a Guileo gerou · este mês",
  "Growth ledger · every $ the AI generated": "Razão de crescimento · cada $ que a IA gerou",
  "Gui usage · last 7 days": "Uso do Gui · últimos 7 dias",
  "Integrations &amp; webhooks": "Integrações e webhooks",
  "Invoices": "Faturas",
  "Invoices & payments": "Faturas e pagamentos",
  "Label": "Etiqueta",
  "Live activity": "Atividade ao vivo",
  "Live orders": "Pedidos ao vivo",
  "Mark all read": "Marcar tudo como lido",
  "New campaign →": "Nova campanha →",
  "Notifications & billing": "Notificações e cobrança",
  "Partnership": "Parceria",
  "Quick actions": "Ações rápidas",
  "Rating breakdown": "Distribuição de avaliações",
  "Recent activity": "Atividade recente",
  "Recent calls · answered by AI": "Chamadas recentes · atendidas pela IA",
  "Recent leads": "Leads recentes",
  "Recent reviews · collected by AI": "Avaliações recentes · coletadas pela IA",
  "Recurring revenue · the AI keeps it renewing": "Receita recorrente · a IA mantém renovando",
  "Request this →": "Pedir isto →",
  "Revenue &amp; order volume": "Receita e volume de pedidos",
  "Run": "Rodar",
  "See all →": "Ver tudo →",
  "Sentiment": "Sentimento",
  "Social inbox · AI replies on Instagram, Facebook &amp; TikTok": "Caixa social · IA responde no Instagram, Facebook e TikTok",
  "Sync to ads": "Sincronizar com anúncios",
  "Top members": "Principais membros",
  "Waitlist · turn empty slots into revenue": "Lista de espera · transforme vagas em receita",
  "What your AI handles": "O que sua IA cuida",
  "What's included": "O que está incluído",
  "Why people contact you": "Por que as pessoas te procuram",
  "Your team": "Sua equipe",
  "from chat": "do chat",
  "invited": "convidado",
  "new": "novo",
  "routes to human": "encaminha p/ humano",
  "soon": "em breve",
  "· from your training": "· do seu treinamento",
  "▶ Enter demo (sample data)": "▶ Entrar no demo (dados de exemplo)",
  "⚙️ Automations on autopilot": "⚙️ Automações no piloto automático",
  "⚠ No-show risk · AI flagged": "⚠ Risco de falta · sinalizado pela IA",
  "⚡ Next best action": "⚡ Próxima melhor ação",
  "⚡ Recommended by your AI · apply in one click": "⚡ Recomendado pela sua IA · aplique em 1 clique",
  "⚡ This week's growth moves": "⚡ Jogadas de crescimento da semana",
  "⭐ Review requests in flight": "⭐ Pedidos de avaliação em andamento",
  "🎁 Reward": "🎁 Recompensa",
  "🎯 Monthly goal": "🎯 Meta do mês",
  "🔮 Predicted demand · next 7 days": "🔮 Demanda prevista · próximos 7 dias",
  "🚀 Go-live readiness": "🚀 Prontidão para o lançamento",
  "Recent reviews": "Avaliações recentes",
  "The AI is chasing these — so you never lose them": "A IA está atrás destes — pra você nunca perder",
  "Active": "Ativo",
  "Paid": "Pago",
  "Pending": "Pendente",
  "Status": "Status",
  "Channel": "Canal",
  "Positive": "Positivo",
  "Negative": "Negativo",
  "Neutral": "Neutro",
  "Delivered": "Entregue",
  "Open": "Aberto",
  "Connected": "Conectado",
  "Not connected": "Não conectado",
  "Busy": "Ocupado",
  "Phone": "Telefone",
  "Email": "E-mail",
  "Overdue": "Em atraso",
  "New": "Novo",
  "At risk": "Em risco",
  "All": "Todos",
  "All channels": "Todos os canais",
  "Team member": "Membro da equipe",
  "Request reviews": "Solicitar avaliações",
  "Quick action": "Ação rápida",
  "Preparing": "Preparando",
  "Payment link": "Link de pagamento",
  "Onboarding": "Integração",
  "New customer": "Novo cliente",
  "Joined": "Entrou em",
  "Booked": "Agendado",
  "Book next visit": "Agendar próxima visita",
  "Appointment booking": "Agendamento de consultas",
  "Appointment booked": "Consulta agendada",
  "When": "Quando",
  "View": "Ver",
  "Plan": "Plano",
  "Revenue": "Receita",
  "Reply": "Responder",
  "Renews soon": "Renova em breve",
  "Rebook": "Reagendar",
  "Rating": "Avaliação",
  "Pipeline value": "Valor do funil",
  "Out": "Saída",
  "Mobile sessions": "Sessões no celular",
  "Off": "Desligado",
  "Order created": "Pedido criado",
  "Opening hours": "Horário de funcionamento",
  "Low": "Baixo",
  "Invited": "Convidado",
  "In stock": "Em estoque",
  "Handled by AI": "Resolvido pela IA",
  "Duration": "Duração",
  "Driver": "Motorista",
  "Dispatch": "Despacho",
  "Deliveries": "Entregas",
  "Delete": "Excluir",
  "Close": "Fechar",
  "Card": "Cartão",
  "Bookings handled": "Reservas atendidas",
  "Avg rating": "Avaliação média",
  "Appointments": "Consultas",
  "Amount": "Valor",
  "Agent": "Agente",
  "Waiting": "Aguardando",
  "Waiting now": "Aguardando agora",
  "Volume today": "Volume hoje",
  "Viewings": "Visitas",
  "View schedule": "Ver agenda",
  "View reviews": "Ver avaliações",
  "View orders": "Ver pedidos",
  "View menu": "Ver cardápio",
  "View kitchen": "Ver cozinha",
  "View follow-ups": "Ver acompanhamentos",
  "View deliveries": "Ver entregas",
  "View calls": "Ver chamadas",
  "Value": "Valor",
  "Unsaved changes": "Alterações não salvas",
  "Type": "Tipo",
  "Transfer": "Transferir",
  "Total": "Total",
  "Total growth": "Crescimento total",
  "Total customers": "Total de clientes",
  "Top spender": "Maior gasto",
  "Today's volume": "Volume de hoje",
  "Today": "Hoje",
  "Timezone": "Fuso horário",
  "Time": "Horário",
  "Team size": "Tamanho da equipe",
  "Teach your AI": "Ensine sua IA",
  "Sign out": "Sair",
  "Signed": "Assinado",
  "Sent": "Enviado",
  "Send offer": "Enviar oferta",
  "Send an invoice": "Enviar uma fatura",
  "Section": "Seção",
  "Scheduled": "Agendado",
  "Schedule": "Agendar",
  "Schedule a call": "Agendar uma ligação",
  "Resolved": "Resolvido",
  "Resolved by AI": "Resolvido pela IA",
  "Requests sent": "Solicitações enviadas",
  "Remove": "Remover",
  "Referral revenue": "Receita de indicações",
  "Redemptions": "Resgates",
  "Ready": "Pronto",
  "Qualified": "Qualificado",
  "Published": "Publicado",
  "Public phone": "Telefone público",
  "Pricing": "Preços",
  "Price": "Preço",
  "Preferred channel": "Canal preferido",
  "Phone calls": "Chamadas telefônicas",
  "Payments & Accounting": "Pagamentos e Contabilidade",
  "Password": "Senha",
  "Paid invoices": "Faturas pagas",
  "Outstanding": "Em aberto",
  "Outcome": "Resultado",
  "Orders": "Pedidos",
  "Open rate": "Taxa de abertura",
  "Open now": "Aberto agora",
  "Open menu": "Abrir menu",
  "Open inbox": "Abrir caixa de entrada",
  "Onboarding checklist": "Checklist de integração",
  "On-time": "No prazo",
  "Offered": "Oferecido",
  "Nudge today": "Lembrar hoje",
  "Not required": "Não obrigatório",
  "No-shows saved": "Faltas recuperadas",
  "No-show risk": "Risco de falta",
  "No-show rate": "Taxa de faltas",
  "No rebook yet": "Sem reagendamento ainda",
  "Next touch": "Próximo contato",
  "New this week": "Novos esta semana",
  "New lead": "Novo lead",
  "New invoice": "Nova fatura",
  "New address": "Novo endereço",
  "New teammate": "Novo colega de equipe",
  "New DM": "Nova DM",
  "Method": "Método",
  "Messaging & Social": "Mensagens e Redes Sociais",
  "Messages sent": "Mensagens enviadas",
  "Message my team": "Falar com minha equipe",
  "Membership": "Assinatura",
  "Members": "Membros",
  "Member since": "Membro desde",
  "Matter types": "Tipos de processo",
  "Maintenance plan": "Plano de manutenção",
  "Missed calls": "Chamadas perdidas",
  "Looking for": "Procurando por",
  "Loyalty & win-back program": "Programa de fidelidade e reconquista",
  "Live dashboard & monthly reports": "Painel ao vivo e relatórios mensais",
  "Hours & location": "Horários e localização",
  "Hours saved / wk": "Horas economizadas / sem",
  "Growth event": "Evento de crescimento",
  "Get started": "Começar",
  "Filter": "Filtrar",
  "Filled today": "Preenchidos hoje",
  "Edit knowledge": "Editar conhecimento",
  "Edit": "Editar",
  "Details": "Detalhes",
  "Done": "Concluído",
  "Delivery & couriers": "Entrega e entregadores",
  "Create an order": "Criar um pedido",
  "Completed": "Concluído",
  "Commission saved": "Comissão economizada",
  "Cancellations & refunds": "Cancelamentos e reembolsos",
  "Calls answered": "Chamadas atendidas",
  "Call back": "Retornar ligação",
  "Caller": "Quem ligou",
  "Business name": "Nome da empresa",
  "Bookings & appointments": "Reservas e agendamentos",
  "Booking request": "Solicitação de reserva",
  "Active sequences": "Sequências ativas",
  "Active plans": "Planos ativos",
  "Active balance": "Saldo ativo",
  "Actions this month": "Ações este mês",
  "Add another location": "Adicionar outra unidade",
  "Ads & Growth": "Anúncios e Crescimento",
  "Repeat rate": "Taxa de recompra",
  "Repeat customers": "Clientes recorrentes",
  "Renewals due": "Renovações pendentes",
  "Reviews this month": "Avaliações este mês",
  "Revenue recovered": "Receita recuperada",
  "Role": "Função",
  "Staff": "Equipe",
  "Setup": "Configuração",
  "Stock": "Estoque",
  "Send re-order link": "Enviar link de recompra",
  "Customer": "Cliente",
  "Toggle language": "Alternar idioma",
};
// Global UI language — set once by Portal on each render, read by tr() anywhere with
// no prop/context threading. Makes wrapping any string a 1-token change: {tr("Label")}.
let UI_LANG = "en";
const setUiLang = (l) => { UI_LANG = l; };
const tr = (s, lang) => { const L = lang || UI_LANG; return (L === "pt" && PT_UI[s]) ? PT_UI[s] : s; };

function Card({ children, className = "" }) {
  return <div className={`rounded-xl2 border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 ${className}`}>{children}</div>;
}
// Consistent empty state for any list that can run dry.
function Empty({ icon = "✅", text }) {
  return <div className="px-5 py-10 text-center text-xs text-g-muted">{icon} {tr(text)}</div>;
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
// Slide-over detail panel — click any row to see everything + act on it.
// Shared by every module, so a11y/keyboard lives here once: Esc closes, focus
// moves into the panel on open, body scroll locks, role=dialog for screen readers.
function Drawer({ open = true, title, subtitle, badge, fields = [], note, actions, onClose, children }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";          // lock background scroll
    panelRef.current?.focus();                          // move focus into the panel
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Details"}
        initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed top-0 right-0 z-50 h-full w-full sm:max-w-sm bg-g-cream/95 backdrop-blur-xl border-l border-white/12 shadow-2xl overflow-y-auto flex flex-col outline-none">
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="min-w-0"><div className="text-base font-extrabold text-g-word truncate">{title}</div>{subtitle && <div className="text-xs text-g-muted mt-0.5">{subtitle}</div>}</div>
          <div className="flex items-center gap-2 shrink-0">{badge}<button onClick={onClose} aria-label="Close" className="text-g-muted hover:text-g-word text-lg leading-none px-1">✕</button></div>
        </div>
        <div className="p-5 space-y-2.5 flex-1">
          {(fields || []).filter(([, v]) => v != null && v !== "").map(([k, v], i) => (
            <div key={i} className="flex justify-between gap-4 text-sm"><span className="text-g-muted">{k}</span><span className="font-bold text-g-word text-right">{v}</span></div>
          ))}
          {children}
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
          <div className="text-[10px] uppercase tracking-wide text-g-muted">{tr(label)}</div>
          <div className={`text-lg font-extrabold mt-0.5 ${tone === "good" ? "text-g-green" : tone === "bad" ? "text-red-400" : "text-g-word"}`}>{value}</div>
        </Card>
      ))}
    </div>
  );
}

// Infer which section an alert is about so "View →" jumps straight there.
function alertTarget(text = "") {
  const t = text.toLowerCase();
  if (/kitchen|prep/.test(t)) return { view: "kitchen", label: "View kitchen" };
  if (/deliver|courier|driver|dispatch|shipment|en route/.test(t)) return { view: "deliveries", label: "View deliveries" };
  if (/order/.test(t)) return { view: "liveorders", label: "View orders" };
  if (/stock|inventory|menu|item/.test(t)) return { view: "menu", label: "View menu" };
  if (/call|inbound|phone|voicemail/.test(t)) return { view: "calllogs", label: "View calls" };
  if (/whatsapp|message|chat|reply/.test(t)) return { view: "whatsapp", label: "Open inbox" };
  if (/appointment|booking|schedule|no-show/.test(t)) return { view: "schedule", label: "View schedule" };
  if (/review|rating|reputation/.test(t)) return { view: "reputation", label: "View reviews" };
  if (/follow|lead|quote|recall/.test(t)) return { view: "followups", label: "View follow-ups" };
  return null;
}

/* ───────────────────────── Views ───────────────────────── */
// Scale a pre-formatted money/number string ("$18,420", "120") by a factor,
// preserving its $ prefix and thousands separators. Non-numeric → returned as-is.
function scaleMoney(str, f) {
  const s = String(str);
  const m = s.match(/-?[\d,]+/);
  if (!m) return s;
  const n = Math.round(parseInt(m[0].replace(/,/g, ""), 10) * f);
  return s.replace(m[0], n.toLocaleString());
}

// The "what should I do today to grow?" list — Guileo earns a % of growth, so the
// home screen leads with the concrete money moves, each linking to its module.
// Numbers are derived from the SAME data the modules show, so the home screen and
// the detail screens never disagree.
function growthOps(V) {
  const wait = genWaitlist(V);
  const fups = genFollowups(V);
  const recur = genRecurring(V);
  const pay = genPayments(V).filter((p) => p.status !== "Paid");
  const pipeline = fups.reduce((s, r) => s + (r.value || 0), 0);
  const atRisk = recur.filter((r) => r.status === "At risk");
  const atRiskMo = atRisk.reduce((s, r) => s + (r.value || 0), 0);
  const outstanding = pay.reduce((s, r) => s + (r.amount || 0), 0);
  return [
    { ic: "💳", view: "payments", text: pay.length === 1 ? "invoice to collect" : "invoices to collect", n: pay.length, value: `$${outstanding.toLocaleString()}` },
    { ic: "🪑", view: "waitlist", text: wait.length === 1 ? "person waiting for an open slot" : "people waiting for an open slot", n: wait.length, value: "$1,240" },
    { ic: "🎯", view: "followups", text: fups.length === 1 ? "follow-up about to convert" : "follow-ups about to convert", n: fups.length, value: `$${pipeline.toLocaleString()}` },
    { ic: "🛟", view: "recurring", text: atRisk.length === 1 ? "at-risk plan to save this week" : "at-risk plans to save this week", n: atRisk.length, value: `$${atRiskMo}/mo` },
    { ic: "⭐", view: "reputation", text: "happy customers to ask for a review", n: 12, value: "+rating" },
  ].filter((o) => o.n > 0);
}

// Unified recent-activity feed — the latest things you + Gui actually did, across tabs.
function recentActivity(V) {
  const L = V.label, items = [];
  loadCreated(L, "liveorders").forEach((o) => items.push({ ic: "🧾", text: `Order ${o.id} · ${o.customer}`, view: "liveorders", _id: o._id }));
  loadCreated(L, "schedule").forEach((o) => items.push({ ic: "📅", text: `Booking · ${o.name}`, view: "schedule", _id: o._id }));
  loadCreated(L, "deliveries").forEach((o) => items.push({ ic: "🛵", text: `Delivery · ${o.customer}`, view: "deliveries", _id: o._id }));
  loadCreated(L, "payments").forEach((o) => items.push({ ic: "💳", text: `${o.id} · ${o.customer} · $${o.amount}`, view: "payments", _id: o._id }));
  loadCreated(L, "campaigns").forEach((o) => items.push({ ic: "📣", text: `Campaign · ${o.name}`, view: "campaigns", _id: o._id }));
  loadCreated(L, "reviewreq").forEach((o) => items.push({ ic: "⭐", text: `Review requested · ${o.name}`, view: "reputation", _id: o._id }));
  loadCreated(L, "impact").forEach((o) => items.push({ ic: "💰", text: `${o.what} · +$${o.amt}`, view: "impact", _id: o._id }));
  return items.sort((a, b) => (b._id || 0) - (a._id || 0)).slice(0, 6);
}
// One-line AI briefing for the home screen — derived from real signals.
function dailyBriefing(V) {
  const alerts = V.alerts ? V.alerts.items.length : 0;
  const outstanding = genPayments(V).filter((p) => p.status !== "Paid").reduce((s, r) => s + (r.amount || 0), 0);
  const fc = genForecast(V);
  const bits = [];
  bits.push(alerts ? `${alerts} thing${alerts !== 1 ? "s" : ""} need you` : "you're all caught up");
  if (outstanding) bits.push(`$${outstanding.toLocaleString()} to collect`);
  bits.push(`${fc.peak} looks busiest`);
  return bits.join(" · ");
}
// R4 — auto weekly recap Gui writes itself, derived from the Impact ledger + created records.
function weeklySummary(V) {
  const L = V.label;
  const impact = loadCreated(L, "impact");
  const driven = impact.reduce((s, r) => s + (r.amt || 0), 0);
  const created = ["liveorders", "schedule", "deliveries", "payments", "campaigns", "reviewreq"].reduce((s, k) => s + loadCreated(L, k).length, 0);
  const handled = vnum(L, "wkhandled", 40, 220) + created;     // AI-handled conversations this week
  const open = genPayments(V).filter((p) => p.status !== "Paid").length;
  const fc = genForecast(V);
  const hours = vnum(L, "wkhours", 9, 28);
  return { driven, created, handled, open, peak: fc.peak, hours };
}
// R3 — standing automations Gui sets up ("every Monday chase overdue"). Persisted; shown on Overview.
const autoKey = (L) => `${L}:automations`;
const loadAutomations = (L) => portalApi.loadState(autoKey(L), []);
function addAutomation(L, rec) { const cur = loadAutomations(L); portalApi.saveState(autoKey(L), [{ ...rec, _id: Date.now(), on: true }, ...cur].slice(0, 12)); }
function toggleAutomation(L, id) { const cur = loadAutomations(L); portalApi.saveState(autoKey(L), cur.map((a) => (a._id === id ? { ...a, on: !a.on } : a))); }
function removeAutomation(L, id) { portalApi.saveState(autoKey(L), loadAutomations(L).filter((a) => a._id !== id)); }
function setAutoLastRun(L, id) { const cur = loadAutomations(L); portalApi.saveState(autoKey(L), cur.map((a) => (a._id === id ? { ...a, lastRun: Date.now() } : a))); }
// Execute one automation: map its "what" to the real stitch (records + Impact ledger).
function runAutomation(V, a) {
  const s = (a.what || "").toLowerCase(); const L = V.label;
  let msg;
  if (/overdue|chase|cobr|invoice|fatur/.test(s)) { const open = genPayments(V).filter((p) => p.status !== "Paid"); logImpact(L, `Auto · chased ${open.length} overdue invoice${open.length !== 1 ? "s" : ""}`, 0); msg = `chased ${open.length} overdue invoice${open.length !== 1 ? "s" : ""}`; }
  else if (/review|avali/.test(s)) { (V.customers || genCustomers(V)).slice(0, 3).forEach((c) => pushCreated(L, "reviewreq", { name: c.name, ch: c.channel })); logImpact(L, "Auto · requested 3 reviews", 0); msg = "requested 3 reviews"; }
  else if (/promo|campaign/.test(s)) { pushCreated(L, "campaigns", { name: "Auto promo", channel: "Email", sent: 0, opened: 0, revenue: 0, status: "Active" }); logImpact(L, "Auto · launched a promo", 0); msg = "launched a promo"; }
  else if (/follow|nudge/.test(s)) { logImpact(L, "Auto · nudged warm leads", 0); msg = "nudged warm leads"; }
  else if (/post|instagram|social/.test(s)) { logImpact(L, "Auto · scheduled a social post", 0); msg = "scheduled a social post"; }
  else { msg = "sent you a recap"; }
  setAutoLastRun(L, a._id);
  logUsage(2, `Automation · ${a.what}`);
  return msg;
}
// Cadence → minimum ms between runs. A "due" automation has never run or is past its window.
const CADENCE_MS = { daily: 864e5, weekly: 6048e5, monthly: 2592e6 };
function cadenceMs(when) { const w = (when || "").toLowerCase(); if (/dia|daily|day/.test(w)) return CADENCE_MS.daily; if (/m[êe]s|month/.test(w)) return CADENCE_MS.monthly; return CADENCE_MS.weekly; }
function dueAutomations(V) { const now = Date.now(); return loadAutomations(V.label).filter((a) => a.on && (!a.lastRun || now - a.lastRun >= cadenceMs(a.when))); }

function Overview({ V, onNav, sections = [], period = "30 days" }) {
  const [resolved, setResolved] = useState(() => portalApi.loadState(`${V.label}:alerts`, []));
  const [alertsOpen, setAlertsOpen] = useState(false);
  useEffect(() => { setResolved(portalApi.loadState(`${V.label}:alerts`, [])); }, [V.label]);
  const resolveAlert = (i) => { portalApi.resolveAlert(i); setResolved((r) => { const n = [...r, i]; portalApi.saveState(`${V.label}:alerts`, n); return n; }); toast("Marked as handled ✓"); };
  const validViews = new Set(sections.map(([k]) => k));
  const ops = growthOps(V).filter((o) => validViews.has(o.view)).slice(0, 3);
  const [autoTick, setAutoTick] = useState(0);                 // force re-render on automation toggle/remove
  const automations = loadAutomations(V.label); void autoTick;
  // Scheduler — on load, run any automations that are due (the client-side cron).
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return; ranRef.current = true;
    const due = dueAutomations(V).slice(0, 2);
    if (due.length) {
      const msgs = due.map((a) => runAutomation(V, a));
      setTimeout(() => { setAutoTick((t) => t + 1); toast(`Automations ran ✓ — Gui ${msgs.join(" & ")}`); }, 900);
    }
  }, [V.label]); // eslint-disable-line
  const runAutoNow = (a) => { const msg = runAutomation(V, a); setAutoTick((t) => t + 1); toast(`Done ✓ — Gui ${msg}`); };
  const wk = weeklySummary(V);
  // Monthly revenue goal — editable + persisted; tracks current + projection.
  const defGoal = Math.max(500, Math.round((V.impact.total * 2.4) / 100) * 100);
  const [goal, setGoal] = useState(() => portalApi.loadState(`${V.label}:goal`, defGoal));
  const [editGoal, setEditGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(goal);
  useEffect(() => { const g = portalApi.loadState(`${V.label}:goal`, defGoal); setGoal(g); setGoalDraft(g); }, [V.label]); // eslint-disable-line
  const saveGoal = () => { const g = Math.max(100, parseInt(String(goalDraft).replace(/\D/g, ""), 10) || defGoal); setGoal(g); portalApi.saveState(`${V.label}:goal`, g); setEditGoal(false); toast(`Monthly goal set to $${g.toLocaleString()} ✓`); };
  const projected = Math.round(V.impact.total * 1.6);
  const pctNow = Math.min(100, Math.round((V.impact.total / goal) * 100));
  const pctProj = Math.round((projected / goal) * 100);
  // The seed data represents a 30-day window; 7d/90d scale the cumulative money.
  const periodFactor = { "7 days": 7 / 30, "30 days": 1, "90 days": 3 }[period] || 1;
  const periodLabel = period === "30 days" ? "this month" : `last ${period}`;
  const openAlerts = V.alerts ? V.alerts.items.map((a, i) => ({ a, i })).filter(({ i }) => !resolved.includes(i)) : [];
  const quick = (V.quick || [["📋", "See today's operations", "ops"], ["💬", "Message my team", "support"], ["📣", "Ask for a campaign", "wa"]]).map(([ic, label, kind]) =>
    kind === "ops" ? { ic, label, on: () => onNav("operations") }
      : kind === "support" ? { ic, label, on: () => onNav("support") }
        : { ic, label, href: waLink(`Guileo — ${label}`) }
  );
  return (
    <div className="space-y-5 stagger">
      <div>
        <h2 className="text-lg font-extrabold text-g-word">Dashboard Overview</h2>
        <p className="text-xs text-g-muted">Welcome back 👋 Here's where your money is today — and the fastest way to grow it.</p>
      </div>

      {/* AI DAILY BRIEFING — a friendly, data-driven one-liner + where to start */}
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.05] border-g-green/25">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-g-green/15 text-g-green shrink-0"><FaBrain size={15} /></span>
            <div className="min-w-0"><div className="text-sm font-extrabold text-g-word flex items-center gap-2">Your AI briefing <span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" /></div><div className="text-xs text-g-muted mt-0.5">{dailyBriefing(V)}.</div></div>
          </div>
          {ops[0] && <button onClick={() => onNav(ops[0].view)} className="btn-bright text-sm shrink-0">Start here →</button>}
        </div>
      </Card>

      {/* NEEDS ATTENTION — one quiet line by default; expands only on click */}
      {V.alerts && (
        openAlerts.length ? (
          <div className="rounded-xl2 border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <button onClick={() => setAlertsOpen((o) => !o)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-white/[0.02] transition">
              <span className="h-1.5 w-1.5 rounded-full bg-g-gold shrink-0" />
              <span className="text-xs font-bold text-g-word">{openAlerts.length} {openAlerts.length === 1 ? "item needs" : "items need"} your attention</span>
              <span className="flex-1" />
              <FaChevronDown size={11} className={`text-g-muted transition-transform ${alertsOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {alertsOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                  <div className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
                    {openAlerts.map(({ a, i }) => {
                      const t0 = alertTarget(a.text);
                      const target = t0 && validViews.has(t0.view) ? t0 : null;
                      return (
                        <div key={i} className="group flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.025] transition">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${a.level === "danger" ? "bg-red-400" : a.level === "warn" ? "bg-g-gold" : "bg-sky-400"}`} />
                          <span className="flex-1 min-w-0 text-xs text-g-light leading-snug">{a.text}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {target && <button onClick={() => onNav(target.view)} className="text-[11px] font-bold text-g-muted hover:text-g-word transition px-2 py-1 rounded-lg hover:bg-white/[0.05] opacity-0 group-hover:opacity-100">{target.label} →</button>}
                            <button onClick={() => resolveAlert(i)} className="text-[11px] font-bold text-g-green border border-g-green/25 hover:bg-g-green/10 transition px-2.5 py-1 rounded-lg">Resolve</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl2 border border-g-green/15 bg-g-green/[0.03] px-3.5 py-2 text-xs text-g-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-g-green shrink-0" /> All clear — your AI is on top of everything.
          </div>
        )
      )}

      {/* PROFIT IMPACT — money first (the only thing the owner must see) */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-g-green/[0.12] to-g-gold/[0.06] border-g-green/30">
        <div className="absolute -top-16 -right-12 h-40 w-40 rounded-full bg-g-green/15 blur-3xl pointer-events-none animate-aurora" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold">Guileo profit impact · {periodLabel}</div>
            <div className="flex items-end gap-2.5 flex-wrap mt-1">
              <div className="text-4xl sm:text-5xl font-black text-g-word tracking-tight"><Count key={period} to={Math.round(V.impact.total * periodFactor)} prefix="$" /></div>
              {(() => { const last = Math.round(V.impact.total / 1.18); const up = Math.round(((V.impact.total - last) / last) * 100); return <span className="inline-flex items-center gap-1 mb-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-g-green/15 text-g-green"><FaArrowTrendUp size={10} /> +{up}% vs last month</span>; })()}
            </div>
            {period === "30 days" && <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-g-green"><FaArrowTrendUp size={10} /> On pace for ${Math.round(V.impact.total * 1.6).toLocaleString()} by month-end</div>}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {V.impact.parts.map(([label, val]) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold">
                  <span className="text-g-green">{scaleMoney(val, periodFactor)}</span><span className="text-g-muted">{label}</span>
                </span>
              ))}
            </div>
          </div>
          <a href={waLink("I'd like to review my Guileo results")} target="_blank" rel="noopener" className="btn-bright text-sm">Talk to my team →</a>
        </div>
      </Card>

      {/* MONTHLY GOAL — editable target + progress + projection vs goal */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("🎯 Monthly goal")}</div>
          {editGoal ? (
            <div className="flex items-center gap-1.5"><span className="text-g-muted text-sm">$</span><input autoFocus value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveGoal()} className="w-24 rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-sm text-g-word outline-none focus:border-g-green/70" /><button onClick={saveGoal} className="text-[11px] font-bold text-g-green hover:underline">Save</button></div>
          ) : (
            <button onClick={() => { setGoalDraft(goal); setEditGoal(true); }} className="text-sm font-extrabold text-g-word inline-flex items-center gap-1.5">${goal.toLocaleString()} <FaPen size={9} className="text-g-muted" /></button>
          )}
        </div>
        <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-g-green to-g-gold transition-all" style={{ width: `${pctNow}%` }} />
          {pctProj > pctNow && pctProj <= 100 && <div className="absolute inset-y-0 rounded-full bg-g-gold/30 transition-all" style={{ left: `${pctNow}%`, width: `${Math.min(100, pctProj) - pctNow}%` }} />}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-g-muted"><b className="text-g-word">${V.impact.total.toLocaleString()}</b> of ${goal.toLocaleString()} · <b className={pctProj >= 100 ? "text-g-green" : "text-g-gold"}>on pace for {pctProj}%</b></span>
          {pctProj < 100 && ops[0] && <button onClick={() => onNav(ops[0].view)} className="font-bold text-g-green hover:underline">Close the gap →</button>}
          {pctProj >= 100 && <span className="font-bold text-g-green">🎉 On track to beat it!</span>}
        </div>
      </Card>

      {/* GROWTH MOVES — "what to do today to grow", the revenue-share thesis on the home screen */}
      {ops.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("⚡ This week's growth moves")}</span>
            <span className="text-[10px] text-g-muted">· spotted by your AI</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {ops.map((o) => (
              <button key={o.view} onClick={() => onNav(o.view)} className="group w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-base shrink-0">{o.ic}</span>
                <div className="flex-1 min-w-0 text-sm text-g-word"><span className="font-extrabold">{o.n}</span> {o.text}</div>
                <span className="text-xs font-extrabold text-g-green whitespace-nowrap">{o.value}</span>
                <span className="text-g-muted group-hover:text-g-word transition shrink-0">→</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* RECENT ACTIVITY — the latest things you + Gui did, across every tab */}
      {(() => { const acts = recentActivity(V).filter((a) => validViews.has(a.view)); return acts.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent activity")}</span><span className="text-[10px] text-g-muted inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />live</span></div>
          <div className="divide-y divide-white/[0.05]">
            {acts.map((a, i) => (
              <button key={i} onClick={() => onNav(a.view)} className="group w-full text-left flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.03] transition">
                <span className="text-base shrink-0">{a.ic}</span>
                <div className="flex-1 min-w-0 text-xs text-g-word truncate">{a.text}</div>
                <span className="text-[10px] text-g-muted shrink-0">just now</span>
                <span className="text-g-muted group-hover:text-g-word transition shrink-0">→</span>
              </button>
            ))}
          </div>
        </Card>
      ) : null; })()}

      {/* R4 — WEEKLY RECAP Gui writes itself */}
      <Card className="bg-gradient-to-br from-g-gold/[0.08] to-transparent border-g-gold/25">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-g-gold/15 text-g-gold shrink-0"><FaWandMagicSparkles /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-g-word">Your week, by Gui</div>
            <div className="text-xs text-g-muted mt-1 leading-relaxed">This week your AI handled <span className="text-g-word font-bold">{wk.handled}</span> conversations, created <span className="text-g-word font-bold">{wk.created || vnum(V.label, "wkc", 6, 24)}</span> bookings &amp; orders{wk.driven ? <> and drove <span className="text-g-green font-bold">${wk.driven.toLocaleString()}</span> in tracked revenue</> : ""} — saving you about <span className="text-g-word font-bold">{wk.hours}h</span>. {wk.open ? <>Next: <span className="text-g-word font-semibold">{wk.open} invoice{wk.open !== 1 ? "s" : ""}</span> still to collect, and <span className="text-g-word font-semibold">{wk.peak}</span> looks busiest.</> : <>Next week <span className="text-g-word font-semibold">{wk.peak}</span> looks busiest — want a promo to fill the quiet days?</>}</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button onClick={() => onNav("impact")} className="btn-ghost text-xs px-3 py-1.5">See the impact →</button>
              {wk.open > 0 && <button onClick={() => onNav("payments")} className="btn-ghost text-xs px-3 py-1.5">Collect now →</button>}
            </div>
          </div>
        </div>
      </Card>

      {/* R3 — STANDING AUTOMATIONS Gui set up */}
      {automations.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("⚙️ Automations on autopilot")}</span><span className="text-[10px] text-g-muted">{automations.filter((a) => a.on).length} active</span></div>
          <div className="divide-y divide-white/[0.05]">
            {automations.map((a) => (
              <div key={a._id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-base shrink-0">{a.ic || "⚡"}</span>
                <div className="flex-1 min-w-0"><div className={`text-xs font-bold truncate ${a.on ? "text-g-word" : "text-g-muted line-through"}`}>{a.what}</div><div className="text-[10px] text-g-muted">{a.when}{a.lastRun ? ` · last run ${new Date(a.lastRun).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : " · not run yet"}</div></div>
                {a.on && <button onClick={() => runAutoNow(a)} className="text-[10px] font-bold text-g-green hover:text-g-light shrink-0 whitespace-nowrap">▶ Run now</button>}
                <Toggle on={!!a.on} onClick={() => { toggleAutomation(V.label, a._id); setAutoTick((t) => t + 1); }} />
                <button onClick={() => { removeAutomation(V.label, a._id); setAutoTick((t) => t + 1); toast("Automation removed"); }} aria-label="Remove" className="text-g-muted hover:text-red-400 transition shrink-0"><FaTrash size={11} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

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
            <button onClick={() => onNav("operations")} className="text-[11px] font-bold text-g-gold hover:underline">{tr("See all →")}</button>
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
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Quick actions")}</div>
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
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Revenue &amp; order volume")}</div>
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
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Live activity")}</div>
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
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Recent activity")}</div>
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

// Delivery & dispatch — third-party platforms (Uber Eats/DoorDash/Grubhub, carriers)
// + Guileo's own delivery, unified. Connections persist; every drop is trackable.
function Deliveries({ V }) {
  const cfg = deliveryCfg(V);
  const rows = [...loadCreated(V.label, "deliveries"), ...genDeliveries(V)];
  const active = rows.filter((r) => r.status !== "Delivered");
  // Connection state persists (feels like a real integration toggle). Seed: first
  // two partners connected, rest off — so both states are visible.
  const [conn, setConn] = useState(() => portalApi.loadState(`${V.label}:integrations`, Object.fromEntries(cfg.partners.map(([n], i) => [n, i < 2]))));
  useEffect(() => { setConn(portalApi.loadState(`${V.label}:integrations`, Object.fromEntries(cfg.partners.map(([n], i) => [n, i < 2])))); }, [V.label]);
  const toggle = (name) => setConn((c) => { const n = { ...c, [name]: !c[name] }; portalApi.saveState(`${V.label}:integrations`, n); toast(`${name} ${n[name] ? "connected ✓" : "disconnected"}`); return n; });
  const [ownOn, setOwnOn] = useState(() => portalApi.loadState(`${V.label}:owndelivery`, true));
  const flipOwn = () => setOwnOn((o) => { const v = !o; portalApi.saveState(`${V.label}:owndelivery`, v); toast(`${cfg.own[0]} ${v ? "on ✓" : "off"}`); return v; });
  const [sel, setSel] = useState(null);
  const onTime = vnum(V.label, "ontime", 92, 99);

  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaTruck className="text-g-green" /> {cfg.title}</div><div className="text-xs text-g-muted mt-0.5">{cfg.partners.length ? "Every order — third-party apps and your own delivery — in one place. " : "Dispatch and track every job in one place. "}Your AI texts customers live ETAs automatically.</div></div>
          <a href={waLink(`Hi Guileo! Help me set up ${cfg.title.toLowerCase()}`)} target="_blank" rel="noopener" className="btn-bright text-sm">Set up with my team →</a>
        </div>
      </Card>

      <MiniStats items={[["Active now", `${active.length}`], ["On-time", `${onTime}%`, "good"], ["Avg. time", `${vnum(V.label, "deltime", 18, 42)} min`], [cfg.partners.length ? "Commission saved" : "Auto-dispatched", cfg.partners.length ? `$${vnum(V.label, "commsave", 400, 1800).toLocaleString()}` : `${vnum(V.label, "autodisp", 20, 70)}`, "good"]]} />

      {/* Integrations — connect the platforms */}
      {cfg.partners.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Connect your delivery platforms")}</div>
          <div className="divide-y divide-white/[0.06]">
            {cfg.partners.map(([name, ic, color]) => (
              <div key={name} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid place-items-center h-10 w-10 rounded-xl text-lg" style={{ background: color + "22" }}>{ic}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word">{name}</div>
                  <div className="text-[11px] text-g-muted">{conn[name] ? `Connected · ${vnum(V.label, name, 6, 28)} ${cfg.noun} today` : "Not connected"}</div>
                </div>
                {conn[name] && <span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1"><FaCircleCheck size={10} /> Live</span>}
                <Toggle on={!!conn[name]} onClick={() => toggle(name)} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Guileo's own delivery — the differentiator: 0% commission, owns the customer */}
      <Card className="border-g-gold/30 bg-g-gold/[0.05]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-g-gold/15 text-g-gold"><FaLocationDot /></span>
            <div><div className="text-sm font-extrabold text-g-word">{cfg.own[0]} <span className="text-[10px] font-black uppercase text-g-gold ml-1">{cfg.partners.length ? "0% commission" : "in-house"}</span></div><div className="text-xs text-g-muted">{cfg.own[1]}</div></div>
          </div>
          <Toggle on={ownOn} onClick={flipOwn} />
        </div>
      </Card>

      {/* Live deliveries / dispatch board */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">Live {cfg.noun} · tap to track</span><span className="text-[11px] text-g-muted">{active.length} in progress</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((r, i) => (
            <button key={i} onClick={() => setSel(r)} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color: r.color }}><FaTruck size={13} /></span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{r.customer}{r.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("from chat")}</span>} <span className="text-g-muted font-normal">· {r.via}</span></div><div className="text-[11px] text-g-muted truncate">{r.who} · {r.addr}</div></div>
              <div className="text-right shrink-0"><div className="text-[11px] font-bold" style={{ color: r.color }}>{r.eta}</div><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: r.color + "22", color: r.color }}>{r.status}</span></div>
            </button>
          ))}
          {rows.length === 0 && <Empty icon="🛵" text={`No ${cfg.noun} in progress right now.`} />}
        </div>
      </Card>

      {sel && (
        <Drawer
          title={sel.customer}
          subtitle={`${sel.via} · ${sel.status}`}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: sel.color + "22", color: sel.color }}>{sel.eta}</span>}
          fields={[[cfg.who, sel.who], ["Channel", sel.via], ["Destination", sel.addr], ["ETA", sel.eta], ["Status", sel.status]]}
          note={`Your AI is texting ${sel.customer} live ${sel.status.toLowerCase()} updates — no “where's my order?” calls for you to answer.`}
          actions={<>
            <button onClick={() => { toast(`Live tracking link sent to ${sel.customer} ✓`); setSel(null); }} className="btn-bright text-sm">📍 Share tracking</button>
            <button onClick={() => { toast(`${sel.via}: ${cfg.who.toLowerCase()} reassigned`); setSel(null); }} className="btn-ghost text-sm">↻ Reassign</button>
            <button onClick={() => { logImpact(V.label, `Delivery to ${sel.customer} completed`, 16); toast(`${sel.customer} marked delivered ✓ — logged to Guileo Impact`); setSel(null); }} className="btn-ghost text-sm">✓ Mark delivered</button>
            {sel.status !== "Delivered" && <button onClick={() => { logImpact(V.label, `Saved ${sel.customer} with an apology coupon (late ${cfg.noun.replace(/s$/, "")})`, 12); toast(`Apology coupon sent to ${sel.customer} ✓ — retention logged to Guileo Impact`); setSel(null); }} className="btn-ghost text-sm">🎟️ Apology coupon</button>}
          </>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Integrations hub ─────────────────────────
   The differentiator: Guileo is not just another app — it plugs into the
   ENTIRE stack a business already runs on, and the AI acts ACROSS all of
   them. Each tool shows what Guileo *does* through it, not just "connected".
*/
// Industry-specific tools per sector — the systems THAT trade actually runs on.
// Icons are emoji (these niche SaaS brands have no brand-icon glyphs). [name, emoji, color, doesEn, doesPt, default-connected]
const SECTOR_STACK = {
  "Restaurant": [
    ["Toast POS", "🍞", "#FF4C00", "Pulls every order & table into one view, syncs the menu live", "Puxa cada pedido e mesa numa visão só, sincroniza o cardápio ao vivo", true],
    ["Uber Eats", "🛵", "#06C167", "Accepts, preps and dispatches delivery orders automatically", "Aceita, prepara e despacha pedidos de delivery automaticamente", false],
    ["OpenTable", "📅", "#DA3743", "Fills tables, confirms reservations and kills no-shows", "Enche mesas, confirma reservas e acaba com no-shows", false],
  ],
  "Clinic": [
    ["Dentrix", "🦷", "#0090DA", "Books recalls, confirms appointments, syncs patient charts", "Agenda retornos, confirma consultas, sincroniza prontuários", true],
    ["Weave", "📞", "#5B34DA", "Routes calls, texts reminders, collects copays", "Encaminha ligações, lembra por SMS, cobra coparticipação", false],
  ],
  "Medical": [
    ["Epic / EHR", "🩺", "#B11116", "Syncs records, confirms visits, files follow-ups", "Sincroniza prontuários, confirma visitas, registra retornos", true],
    ["Zocdoc", "🗓️", "#FFB81C", "Fills open slots from new-patient demand", "Preenche horários vagos com demanda de novos pacientes", false],
  ],
  "Salon & Spa": [
    ["Mindbody", "💆", "#6C2EB9", "Books, rebooks and fills last-minute openings", "Agenda, reagenda e preenche vagas de última hora", true],
    ["Fresha", "💈", "#0E1B39", "Takes online bookings and deposits, cuts no-shows", "Recebe agendamentos e sinais online, reduz faltas", false],
  ],
  "Law Firm": [
    ["Clio", "⚖️", "#1F3A93", "Intakes leads, schedules consults, logs matters", "Capta leads, marca consultas, registra processos", true],
    ["DocuSign", "✍️", "#FFB200", "Sends and chases engagement letters & e-signatures", "Envia e cobra contratos e assinaturas eletrônicas", false],
  ],
  "Real Estate": [
    ["Zillow", "🏠", "#006AFF", "Captures and instantly replies to property leads", "Capta e responde na hora os leads de imóveis", true],
    ["DocuSign", "✍️", "#FFB200", "Sends offers and closes paperwork by e-signature", "Envia propostas e fecha papelada por assinatura digital", false],
  ],
  "Gym & Fitness": [
    ["Mindbody", "💪", "#6C2EB9", "Books classes, recovers cancellations, wins back lapsed members", "Agenda aulas, recupera cancelamentos, reativa ex-alunos", true],
    ["ClassPass", "🤸", "#0B2A3C", "Fills empty class spots from new-member demand", "Preenche vagas de aulas com demanda de novos alunos", false],
  ],
  "Auto Dealership": [
    ["DealerSocket", "🚗", "#E11B22", "Replies to leads, books test-drives, follows up on quotes", "Responde leads, agenda test-drives, faz follow-up de orçamentos", true],
    ["CarGurus", "🚙", "#1E7B47", "Captures listing inquiries and books appointments", "Capta interessados nos anúncios e agenda visitas", false],
  ],
  "Plumbing & HVAC": [
    ["ServiceTitan", "🔧", "#0B5FFF", "Books jobs, dispatches techs, sends 'on the way' texts", "Agenda serviços, despacha técnicos, avisa 'a caminho'", true],
    ["Jobber", "🧰", "#1FA463", "Quotes, schedules and collects payment on site", "Orça, agenda e cobra no local", false],
  ],
  "Education": [
    ["Canvas LMS", "📚", "#E72429", "Answers student questions, books trials, nudges enrollments", "Responde alunos, agenda aulas teste, puxa matrículas", true],
    ["Zoom", "🎥", "#2D8CFF", "Schedules classes and sends join links automatically", "Agenda aulas e envia os links automaticamente", false],
  ],
  "Construction": [
    ["Procore", "🏗️", "#F47E20", "Logs estimates, schedules site visits, chases approvals", "Registra orçamentos, agenda visitas, cobra aprovações", true],
    ["Buildertrend", "🧱", "#1C6FB7", "Keeps clients updated and collects draw payments", "Mantém clientes informados e cobra parcelas da obra", false],
  ],
  "E-Commerce": [
    ["WooCommerce", "🛒", "#7F54B3", "Recovers carts, answers order questions, upsells buyers", "Recupera carrinhos, responde dúvidas de pedido, revende", false],
    ["Klaviyo", "✉️", "#232426", "Runs win-back & post-purchase flows on autopilot", "Roda fluxos de recompra e pós-venda no automático", false],
  ],
};
// Sector onboarding — the tools Guileo auto-connects on day one for each trade,
// so a new account reaches first value in minutes (activation = trial→paid $).
const SECTOR_ONBOARD = {
  "Restaurant": { auto: ["WhatsApp", "Toast POS", "Uber Eats", "OpenTable", "Google Calendar", "Stripe"], en: "Done — Guileo is live across your WhatsApp, Toast POS, Uber Eats, OpenTable, Google Calendar, and Stripe.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, Toast POS, Uber Eats, OpenTable, Google Calendar e Stripe." },
  "Clinic": { auto: ["WhatsApp", "Dentrix", "Weave", "Google Calendar", "Stripe"], en: "Done — Guileo is live across your WhatsApp, Dentrix, Weave, Google Calendar, and Stripe.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, Dentrix, Weave, Google Calendar e Stripe." },
  "Medical": { auto: ["WhatsApp", "Epic / EHR", "Zocdoc", "Google Calendar", "Stripe"], en: "Done — Guileo is live across your WhatsApp, Epic / EHR, Zocdoc, Google Calendar, and Stripe.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, Epic / EHR, Zocdoc, Google Calendar e Stripe." },
  "Salon & Spa": { auto: ["WhatsApp", "Instagram", "Mindbody", "Fresha", "Google Calendar", "Stripe"], en: "Done — Guileo is live across your WhatsApp, Instagram, Mindbody, Fresha, Google Calendar, and Stripe.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, Instagram, Mindbody, Fresha, Google Calendar e Stripe." },
  "Law Firm": { auto: ["Email / Gmail", "Clio", "DocuSign", "Google Calendar", "Stripe"], en: "Done — Guileo is live across your Email / Gmail, Clio, DocuSign, Google Calendar, and Stripe.", pt: "Pronto — a Guileo já está conectada ao seu Email / Gmail, Clio, DocuSign, Google Calendar e Stripe." },
  "Real Estate": { auto: ["WhatsApp", "Zillow", "DocuSign", "Google Calendar", "Email / Gmail"], en: "Done — Guileo is live across your WhatsApp, Zillow, DocuSign, Google Calendar, and Email / Gmail.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, Zillow, DocuSign, Google Calendar e Email / Gmail." },
  "Gym & Fitness": { auto: ["WhatsApp", "Instagram", "Mindbody", "ClassPass", "Google Calendar", "Stripe"], en: "Done — Guileo is live across your WhatsApp, Instagram, Mindbody, ClassPass, Google Calendar, and Stripe.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, Instagram, Mindbody, ClassPass, Google Calendar e Stripe." },
  "Auto Dealership": { auto: ["WhatsApp", "DealerSocket", "CarGurus", "Google Calendar", "Stripe"], en: "Done — Guileo is live across your WhatsApp, DealerSocket, CarGurus, Google Calendar, and Stripe.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, DealerSocket, CarGurus, Google Calendar e Stripe." },
  "Plumbing & HVAC": { auto: ["WhatsApp", "ServiceTitan", "Jobber", "Google Calendar", "Stripe"], en: "Done — Guileo is live across your WhatsApp, ServiceTitan, Jobber, Google Calendar, and Stripe.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, ServiceTitan, Jobber, Google Calendar e Stripe." },
  "Education": { auto: ["WhatsApp", "Canvas LMS", "Zoom", "Google Calendar", "Email / Gmail"], en: "Done — Guileo is live across your WhatsApp, Canvas LMS, Zoom, Google Calendar, and Email / Gmail.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, Canvas LMS, Zoom, Google Calendar e Email / Gmail." },
  "Construction": { auto: ["WhatsApp", "Procore", "Buildertrend", "Google Calendar", "QuickBooks"], en: "Done — Guileo is live across your WhatsApp, Procore, Buildertrend, Google Calendar, and QuickBooks.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, Procore, Buildertrend, Google Calendar e QuickBooks." },
  "E-Commerce": { auto: ["WhatsApp", "Shopify", "WooCommerce", "Klaviyo", "Stripe", "Meta Ads"], en: "Done — Guileo is live across your WhatsApp, Shopify, WooCommerce, Klaviyo, Stripe, and Meta Ads.", pt: "Pronto — a Guileo já está conectada ao seu WhatsApp, Shopify, WooCommerce, Klaviyo, Stripe e Meta Ads." },
};
function genIntegrations(V) {
  const sector = SECTOR_STACK[V.label] || [];
  // [name, IconComponent|emoji, brandColor, what Guileo does through it (EN), (PT), default-connected]
  return [
    ...(sector.length ? [[`${V.label} tools`, sector]] : []),
    ["Messaging & Social", [
      ["WhatsApp", FaWhatsapp, "#25D366", "Answers, books and follows up with customers 24/7", "Atende, agenda e faz follow-up com clientes 24/7", true],
      ["Instagram", FaInstagram, "#E1306C", "Replies to DMs & comments, turns followers into bookings", "Responde DMs e comentários, vira seguidores em agendamentos", true],
      ["Messenger", FaFacebook, "#1877F2", "Handles Facebook chats and re-engages old leads", "Cuida dos chats do Facebook e reativa leads antigos", false],
      ["Email / Gmail", FaEnvelope, "#EA4335", "Drafts, sends and follows up on emails automatically", "Escreve, envia e faz follow-up de e-mails sozinho", true],
    ]],
    ["Calendar & Scheduling", [
      ["Google Calendar", FaCalendarDays, "#4285F4", "Books, reschedules and reminds — zero double-bookings", "Agenda, remarca e lembra — sem choque de horário", true],
    ]],
    ["Payments & Accounting", [
      ["Stripe", FaStripe, "#635BFF", "Sends payment links, chases invoices until they're paid", "Envia links de pagamento e cobra até quitar", true],
      ["QuickBooks", FaFileInvoiceDollar, "#2CA01C", "Syncs every sale & invoice into your books automatically", "Sincroniza cada venda e fatura na contabilidade", false],
    ]],
    ["Commerce & Storefront", [
      ["Shopify", FaShopify, "#95BF47", "Recovers abandoned carts and upsells past buyers", "Recupera carrinhos abandonados e revende a clientes", false],
    ]],
    ["Ads & Growth", [
      ["Meta Ads", FaMeta, "#0866FF", "Builds audiences from your CRM and optimizes spend", "Monta públicos do seu CRM e otimiza o investimento", true],
      ["Google", FaGoogle, "#4285F4", "Turns 5★ reviews into ads and captures local search", "Vira avaliações 5★ em anúncios e capta busca local", true],
    ]],
    ["Team & Files", [
      ["Slack", FaSlack, "#4A154B", "Pings your team the moment a hot lead or VIP comes in", "Avisa sua equipe quando entra um lead quente ou VIP", false],
      ["Google Drive", FaGoogleDrive, "#1FA463", "Files contracts, receipts and docs where they belong", "Arquiva contratos, recibos e docs no lugar certo", false],
    ]],
  ];
}
function Integrations({ V, onNav, lang = "en" }) {
  const groups = useMemo(() => genIntegrations(V), [V]);
  const flat = groups.flatMap(([, tools]) => tools);
  const onb = SECTOR_ONBOARD[V.label];
  // Day-one seed: catalog defaults OR this sector's auto-connect list (activation).
  const seed = useMemo(() => Object.fromEntries(flat.map(([n, , , , , def]) => [n, !!def || (onb ? onb.auto.includes(n) : false)])), [V]); // eslint-disable-line
  const [conn, setConn] = useState(() => portalApi.loadState(`${V.label}:stack`, seed));
  useEffect(() => { setConn(portalApi.loadState(`${V.label}:stack`, seed)); }, [V.label]); // eslint-disable-line
  const [onbSeen, setOnbSeen] = useState(() => portalApi.loadState(`${V.label}:onboard_seen`, false));
  const dismissOnb = () => { setOnbSeen(true); portalApi.saveState(`${V.label}:onboard_seen`, true); };
  const toggle = (name) => setConn((c) => { const n = { ...c, [name]: !c[name] }; portalApi.saveState(`${V.label}:stack`, n); toast(`${name} ${n[name] ? "connected ✓ — your AI is now acting through it" : "disconnected"}`); return n; });
  const liveCount = flat.filter(([n]) => conn[n]).length;
  return (
    <div className="space-y-4 stagger">
      {onb && !onbSeen && (
        <Card className="border-g-green/40 bg-g-green/[0.08]">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-g-green/20 text-g-green shrink-0"><FaCircleCheck /></span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-g-word">{lang === "pt" ? "Já deixamos sua IA pronta pro seu setor" : "We set your AI up for your industry"}</div>
              <div className="text-xs text-g-light mt-0.5">{lang === "pt" ? onb.pt : onb.en} <span className="text-g-muted">{lang === "pt" ? "Ajuste o que quiser abaixo." : "Tweak anything below."}</span></div>
            </div>
            <button onClick={dismissOnb} aria-label="Dismiss" className="text-g-muted hover:text-g-word text-sm shrink-0">✕</button>
          </div>
        </Card>
      )}
      <Card className="bg-gradient-to-br from-g-green/[0.12] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-g-green/15 text-g-green"><FaPlug /></span>
            <div>
              <div className="text-sm font-extrabold text-g-word">Guileo plugs into your whole stack</div>
              <div className="text-xs text-g-muted mt-0.5">We don't replace your tools — your AI works <span className="text-g-light font-semibold">inside</span> them, across all of them. <span className="text-g-green font-bold">{liveCount} connected</span> and acting right now.</div>
            </div>
          </div>
          <a href={waLink("Hi Guileo! Help me connect my tools/systems")} target="_blank" rel="noopener" className="btn-bright text-sm">Connect a tool →</a>
        </div>
        {/* live data flow: connected tools → Guileo brain */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center -space-x-1.5 shrink-0">
            {flat.filter(([n]) => conn[n]).slice(0, 5).map(([name, Icon, color]) => (
              <span key={name} title={name} className="grid place-items-center h-7 w-7 rounded-lg ring-2 ring-g-cream" style={{ background: color + "22", color }}>{typeof Icon === "string" ? <span className="text-[11px]">{Icon}</span> : <Icon size={11} />}</span>
            ))}
          </div>
          <div className="flowtrack flex-1">
            {[0, 0.7, 1.4, 2.1].map((d, i) => <span key={i} className="flowdot" style={{ animationDelay: `${d}s` }} />)}
          </div>
          <span className="grid place-items-center h-8 w-8 rounded-full bg-gradient-to-br from-g-green to-g-dark text-white shrink-0" title="Guileo AI"><FaWandMagicSparkles size={13} /></span>
        </div>
      </Card>

      <MiniStats items={[["Connected", `${liveCount}/${flat.length}`, "good"], ["Acting 24/7", "Always-on"], ["Hours saved / wk", `${vnum(V.label, "stackhrs", 8, 26)}h`, "good"], ["Setup", "Done-for-you"]]} />

      {/* Gui recommends connecting — surfaces the highest-value disconnected tools */}
      {(() => {
        const off = flat.filter(([n]) => !conn[n]).slice(0, 2);
        return off.length ? (
          <Card className="border-g-green/30 bg-g-green/[0.06]">
            <div className="flex items-center gap-2 mb-2.5"><span className="grid place-items-center h-7 w-7 rounded-full bg-g-green/15 text-g-green"><FaWandMagicSparkles size={12} /></span><div className="text-xs font-extrabold text-g-word">Gui recommends connecting</div></div>
            <div className="space-y-2">
              {off.map(([name, Icon, color, doesEn]) => (
                <div key={name} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5">
                  <span className="grid place-items-center h-8 w-8 rounded-lg text-base" style={{ background: color + "22", color }}>{typeof Icon === "string" ? <span>{Icon}</span> : <Icon size={14} />}</span>
                  <div className="flex-1 min-w-0"><div className="text-xs font-bold text-g-word">{name}</div><div className="text-[10px] text-g-muted leading-snug">{doesEn}</div></div>
                  <button onClick={() => toggle(name)} className="btn-bright text-[11px] px-3 py-1.5 shrink-0">Connect</button>
                </div>
              ))}
            </div>
          </Card>
        ) : null;
      })()}

      {groups.map(([cat, tools]) => (
        <Card key={cat} className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{cat}</div>
          <div className="divide-y divide-white/[0.06]">
            {tools.map(([name, Icon, color, doesEn]) => (
              <div key={name} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid place-items-center h-10 w-10 rounded-xl text-lg" style={{ background: color + "22", color }}>{typeof Icon === "string" ? <span>{Icon}</span> : <Icon />}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word flex items-center gap-2">{name}{conn[name] && <span className="text-[9px] font-black uppercase text-g-green inline-flex items-center gap-1"><FaCircleCheck size={9} /> Live</span>}</div>
                  <div className="text-[11px] text-g-muted leading-snug">{doesEn}</div>
                </div>
                <Toggle on={!!conn[name]} onClick={() => toggle(name)} />
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card className="border-g-gold/25 bg-g-gold/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-g-muted">Don't see your system? If it has an API (or Zapier/Make), <span className="text-g-light font-semibold">your team wires it</span> — Guileo becomes the brain on top of everything you already run.</div>
          <button onClick={() => onNav?.("brain")} className="btn-ghost text-sm shrink-0">Train your AI on it →</button>
        </div>
      </Card>
    </div>
  );
}

function Operations({ V }) {
  const o = V.ops;
  return (
    <div className="space-y-4 stagger">
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
        <div className="space-y-4 stagger">
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
    <div className="space-y-4 stagger">
      <div className="grid sm:grid-cols-3 gap-4">
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">Ad spend</div><div className="text-2xl font-extrabold text-g-word mt-1"><Count to={totalSpend} prefix="$" /></div></Card>
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">Leads generated</div><div className="text-2xl font-extrabold text-g-light mt-1"><Count to={totalLeads} /></div></Card>
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">Avg. ROAS</div><div className="text-2xl font-extrabold text-g-green mt-1">4.1×</div></Card>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Campaigns")}</div>
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
      <p className="text-xs text-g-muted text-center">Connect Meta &amp; Google Ads to see live campaign data here. <a href={waLink("I want to connect my ad accounts to Guileo")} target="_blank" rel="noopener" className="text-g-gold font-semibold hover:underline">{tr("Connect accounts →")}</a></p>
    </div>
  );
}

function Leads() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent leads")}</span>
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
      <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Documents &amp; billing")}</div>
      <div className="divide-y divide-white/[0.06]">
        {DOCS.map(([ic, name, meta, action]) => (
          <div key={name} className="flex items-center gap-3 px-5 py-3.5">
            <span className="text-xl">{ic}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{name}</div><div className="text-[11px] text-g-muted">{meta}</div></div>
            <button onClick={() => toast(action === "View" ? `Opening ${name}…` : `${name} · ${action}`)} aria-label={`${action} — ${name}`} className="text-xs font-bold text-g-gold hover:underline">{action}</button>
          </div>
        ))}
      </div>
    </Card>
  );
}


/* ───────────────────────── Sector screens (restaurant + reusable) ───────────────────────── */
function LiveOrders({ V }) {
  const rows = [...loadCreated(V.label, "liveorders"), ...(V.liveOrders || [])];
  const [sel, setSel] = useState(null);
  return (
    <>
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Live orders")}</span><span className="text-[11px] text-g-muted inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{rows.length} active</span></div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map((o, i) => (
          <button key={i} onClick={() => setSel(o)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
            <span className="text-xs font-bold text-g-light w-16 shrink-0">{o.id}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{o.customer}{o.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("from chat")}</span>}</div><div className="text-[11px] text-g-muted truncate">{o.items} · {o.channel}</div></div>
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
        actions={<><button onClick={() => { logImpact(V.label, `${sel.id} fulfilled — taken by your AI`, Math.max(18, Math.round(sel.total) || 22)); toast(`${sel.id} marked ready ✓ — logged to Guileo Impact`); setSel(null); }} className="btn-bright text-sm">✓ Mark ready</button><a href={waLink(`Hi ${sel.customer}, about order ${sel.id}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Message</a></>}
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
    if (next === "done") { const amt = vnum(V.label, "kitchenval", 18, 42); logImpact(V.label, `${item?.id} fulfilled in kitchen`, amt); toast(`${item?.id} completed ✓ — $${amt} logged to Guileo Impact`); }
    else toast(`${item?.id} → ${next}`);
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
  const [ov, setOv] = useState({});           // local stock overrides (restock actions)
  const [sel, setSel] = useState(null);
  const stockOf = (i, m) => ov[i] || m.stock;
  const setStock = (i, s, name) => { setOv((o) => ({ ...o, [i]: s })); setSel(null); toast(`${name} → ${s === "In stock" ? "restocked ✓" : s.toLowerCase()}`); };
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {(V.menu || []).map((m, i) => {
        const stock = stockOf(i, m);
        return (
          <button key={i} onClick={() => setSel({ m, i })} className="text-left">
            <Card className="hover:border-g-gold/30 transition">
              <div className="flex items-start justify-between gap-2">
                <div><div className="text-sm font-bold text-g-word">{m.name}</div><div className="text-[11px] text-g-muted">{m.cat}</div></div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc(stock) + "22", color: sc(stock) }}>{stock}</span>
              </div>
              <div className="mt-3 text-xl font-extrabold text-g-word">${m.price.toFixed(2)}</div>
            </Card>
          </button>
        );
      })}
      {sel && (
        <Drawer
          title={sel.m.name}
          subtitle={sel.m.cat}
          badge={<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc(stockOf(sel.i, sel.m)) + "22", color: sc(stockOf(sel.i, sel.m)) }}>{stockOf(sel.i, sel.m)}</span>}
          fields={[["Price", `$${sel.m.price.toFixed(2)}`], ["Category", sel.m.cat], ["Stock", stockOf(sel.i, sel.m)]]}
          note="Your AI auto-pauses an item from suggestions when it's out of stock, and flags low stock here so you never sell what you can't deliver."
          actions={<>
            <button onClick={() => setStock(sel.i, "In stock", sel.m.name)} className="btn-bright text-sm">✓ Mark restocked</button>
            <button onClick={() => setStock(sel.i, "Out", sel.m.name)} className="btn-ghost text-sm">Mark out of stock</button>
          </>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}
// Vertical-aware "rebook" verb — Re-order for restaurants/retail, Book again for
// appointment businesses, Schedule visit for field services.
const REBOOK = { "Restaurant": "Re-order for them", "E-Commerce": "Send re-order link", "Clinic": "Book next visit", "Medical": "Book next visit", "Salon & Spa": "Book next visit", "Gym & Fitness": "Book a session", "Law Firm": "Schedule a call", "Real Estate": "Schedule a viewing", "Plumbing & HVAC": "Schedule service", "Auto Dealership": "Schedule service", "Education": "Book a class", "Construction": "Schedule a site visit" };
// A synthetic recent-activity timeline so each profile reads like a real CRM record.
function custTimeline(c, V) {
  const noun = (c.noun || "order").replace(/s$/, "");
  const L = V.label, name = c.name;
  // REAL events first — anything the operator actually did for this customer (created:* records).
  const real = [];
  loadCreated(L, "liveorders").filter((o) => o.customer === name).forEach((o) => real.push({ t: "just now", ev: `Order ${o.id} created · ${o.channel}`, ic: "🧾", real: true }));
  loadCreated(L, "schedule").filter((o) => o.name === name).forEach((o) => real.push({ t: "just now", ev: `Booked · ${o.meta || "appointment"}`, ic: "📅", real: true }));
  loadCreated(L, "deliveries").filter((o) => o.customer === name).forEach((o) => real.push({ t: "just now", ev: `Delivery · ${o.status}`, ic: "🛵", real: true }));
  loadCreated(L, "payments").filter((o) => o.customer === name).forEach((o) => real.push({ t: "just now", ev: `${o.id} · ${o.status} · $${o.amount}`, ic: "💳", real: true }));
  loadCreated(L, "reviewreq").filter((o) => o.name === name).forEach(() => real.push({ t: "just now", ev: "Review requested by your AI", ic: "⭐", real: true }));
  const base = [
    { t: c.last, ev: `Last ${noun} · via ${c.channel}`, ic: "🟢" },
    { t: "2 days ago", ev: `AI answered a question on ${c.channel}`, ic: "💬" },
    { t: "1 week ago", ev: `Left a 5★ review (AI-requested)`, ic: "⭐" },
    { t: "3 weeks ago", ev: `First ${noun} with ${V.business.name}`, ic: "✨" },
  ];
  return [...real, ...base];
}
// The revenue-share thesis, made concrete: tell the owner the single best move.
function nextBestAction(c, i) {
  if (i === 0) return "Your top spender. A personal thank-you + a small perk usually unlocks a referral. The AI can send it now.";
  if ((c.orders || 0) >= 15) return "Loyal & frequent — a perfect fit for a membership/subscription. Offer it to lock in recurring revenue.";
  return "Active but not yet loyal. One well-timed nudge with a returning-customer offer tends to convert them. The AI can handle it.";
}

function Customers({ V, onNav }) {
  const rows = V.customers || genCustomers(V);
  const totalSpent = rows.reduce((s, c) => s + (c.spent || 0), 0);
  const [sel, setSel] = useState(null);
  const rebook = (c) => { const act = convoAction(V); const rec = recordFor(act.view, c.name, c.channel, V); if (rec) pushCreated(V.label, act.view, rec); setSel(null); toast(`${REBOOK[V.label] || "Rebook"} created for ${c.name} ✓ — see it in the tab`); onNav?.(act.view); };
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Total customers", `${rows.length * 104}`], ["New this week", `+${rows.length * 6}`, "good"], ["Avg. value", `$${rows.length ? Math.round(totalSpent / rows.length) : 0}`], ["Repeat rate", `${vnum(V.label, "repeat", 31, 47)}%`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Customers")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap for profile</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <button key={i} onClick={() => setSel({ c, i })} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{c.name[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{c.name}{i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-g-gold/15 text-g-gold">{tr("TOP")}</span>}</div><div className="text-[11px] text-g-muted truncate">{c.orders} {c.noun || "orders"} · {c.channel} · {c.last}</div></div>
              <span className="text-sm font-extrabold text-g-green">${c.spent.toFixed(2)}</span>
            </button>
          ))}
          {rows.length === 0 && <Empty icon="🧑" text="No customers yet — they'll appear here as your AI books and serves them." />}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.c.name}
          subtitle={`${sel.c.orders} ${sel.c.noun || "orders"} · via ${sel.c.channel}`}
          badge={sel.i === 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-g-gold/15 text-g-gold">{tr("VIP")}</span> : null}
          fields={[["Lifetime value", `$${sel.c.spent.toFixed(2)}`], [(sel.c.noun || "orders"), sel.c.orders], ["Preferred channel", sel.c.channel], ["Last seen", sel.c.last], ["Status", sel.i === 0 ? "Top spender" : "Active"]]}
          note={<><div className="text-[10px] font-black uppercase text-g-gold mb-1">{tr("⚡ Next best action")}</div>{nextBestAction(sel.c, sel.i)}</>}
          actions={<>
            <a href={waLink(`Hi ${sel.c.name}! `)} target="_blank" rel="noopener" className="btn-bright text-sm">💬 Message</a>
            <button onClick={() => rebook(sel.c)} className="btn-ghost text-sm">🔁 {REBOOK[V.label] || "Rebook"}</button>
            <button onClick={() => { pushCreated(V.label, "reviewreq", { name: sel.c.name, ch: sel.c.channel }); toast(`Review request sent to ${sel.c.name} ✓ — tracked in Reputation`); setSel(null); onNav?.("reputation"); }} className="btn-ghost text-sm">⭐ Request review</button>
          </>}
          onClose={() => setSel(null)}
        >
          <div className="mt-1">
            <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">Recent activity</div>
            <div className="space-y-2.5">
              {custTimeline(sel.c, V).map((e, k) => (
                <div key={k} className="flex items-start gap-2.5 text-xs">
                  <span className="text-sm leading-none mt-0.5">{e.ic}</span>
                  <div className="flex-1 min-w-0"><div className="text-g-word font-semibold flex items-center gap-1.5">{e.ev}{e.real && <span className="text-[8px] font-black uppercase tracking-wide text-g-green bg-g-green/15 rounded px-1 py-0.5">live</span>}</div><div className="text-[10px] text-g-muted">{e.t}</div></div>
                </div>
              ))}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
function Campaigns({ V, onNav }) {
  const rows = [...loadCreated(V.label, "campaigns"), ...(V.campaigns || genCampaigns(V))];
  const buildAudience = (c) => { pushCreated(V.label, "audiences", { name: `${c.name} · engagers`, size: vnum(V.label, c.name, 1200, 9000), source: "CRM" }); setSel(null); toast(`Audience built from "${c.name}" ✓ — see it in Ad Audiences`); onNav?.("audiences"); };
  const sent = rows.reduce((s, c) => s + c.sent, 0);
  const rev = rows.reduce((s, c) => s + c.revenue, 0);
  const open = Math.round(rows.reduce((s, c) => s + c.opened, 0) / rows.length);
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Campaigns", `${rows.length}`], ["Messages sent", sent.toLocaleString()], ["Avg. open rate", `${open}%`, "good"], ["Revenue", `$${rev.toLocaleString()}`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Campaigns")}</span><a href={waLink("I'd like to launch a campaign")} target="_blank" rel="noopener" className="text-[11px] font-bold text-g-gold hover:underline">{tr("New campaign →")}</a></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <button key={i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{c.name}{c.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("new")}</span>}</div><div className="text-[11px] text-g-muted">{c.channel} · {c.sent} sent · {c.opened}% opened</div></div>
              <span className="text-sm font-extrabold text-g-green">${c.revenue.toLocaleString()}</span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: (c.status === "Active" ? "#3E9468" : "#D6C29A") + "22", color: c.status === "Active" ? "#3E9468" : "#D6C29A" }}>{c.status}</span>
            </button>
          ))}
          {rows.length === 0 && <Empty icon="📣" text="No campaigns yet — ask your team to launch one and watch the revenue land here." />}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.channel} campaign`}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: (sel.status === "Active" ? "#3E9468" : "#D6C29A") + "22", color: sel.status === "Active" ? "#3E9468" : "#D6C29A" }}>{sel.status}</span>}
          fields={[["Channel", sel.channel], ["Sent", sel.sent.toLocaleString()], ["Open rate", `${sel.opened}%`], ["Revenue", `$${sel.revenue.toLocaleString()}`], ["ROI", `${(sel.revenue / (sel.sent * 0.05) || 0).toFixed(1)}×`]]}
          note={`Run automatically by Guileo. ${sel.status === "Active" ? "Live now — driving revenue while you focus on the business." : "Scheduled — will launch and optimize itself."}`}
          actions={<><button onClick={() => { toast("Campaign duplicated ✓"); setSel(null); }} className="btn-bright text-sm">⧉ Duplicate</button><button onClick={() => buildAudience(sel)} className="btn-ghost text-sm">🎯 Build audience</button><button onClick={() => { toast(sel.status === "Active" ? "Campaign paused" : "Campaign resumed"); setSel(null); }} className="btn-ghost text-sm">{sel.status === "Active" ? "⏸ Pause" : "▶ Resume"}</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}
function Audiences({ V, onNav }) {
  const rows = [...loadCreated(V.label, "audiences"), ...(V.audiences || genAudiences())];
  const launch = (a) => { pushCreated(V.label, "campaigns", { name: `Campaign · ${a.name}`, channel: a.source === "Meta" ? "Meta" : a.source === "Google" ? "Google" : "Email", sent: 0, opened: 0, revenue: 0, status: "Active" }); toast(`Campaign launched to "${a.name}" ✓ — see it in Campaigns`); onNav?.("campaigns"); };
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {rows.map((a, i) => (
        <Card key={i} className="flex flex-col">
          <div className="flex items-center justify-between"><div className="text-sm font-bold text-g-word flex items-center gap-1.5">{a.name}{a.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("new")}</span>}</div><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-g-muted">{a.source}</span></div>
          <div className="mt-2 text-2xl font-extrabold text-g-word"><Count to={a.size} /></div>
          <div className="text-[11px] text-g-muted">people reachable</div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => toast(`"${a.name}" synced to ${a.source === "Meta" ? "Meta Ads" : a.source === "Google" ? "Google Ads" : "your ad platforms"} ✓`)} className="text-[11px] font-bold rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-3 py-1.5 text-g-gold hover:bg-g-gold/[0.16] transition">{tr("Sync to ads")}</button>
            <button onClick={() => launch(a)} className="text-[11px] font-bold rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-g-word hover:border-g-gold/40 transition">Use in a campaign →</button>
          </div>
        </Card>
      ))}
      {rows.length === 0 && <div className="sm:col-span-2"><Card><Empty icon="🎯" text="No audiences built yet — your AI segments customers automatically as data grows." /></Card></div>}
    </div>
  );
}
function CallLogs({ V, onNav }) {
  const rows = V.callLogs || genCalls(V);
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Calls answered", `${vnum(V.label, "callsans", 210, 540)}`], ["Missed calls", "0", "good"], ["Avg. duration", `1m ${vnum(V.label, "calldur", 2, 54)}s`], ["Handled by AI", "100%", "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent calls · answered by AI")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap for transcript</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
          <button key={i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color: c.color }}><FaPhone size={13} /></span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name} <span className="text-g-muted font-normal">· {c.phone}</span></div><div className="text-[11px] text-g-muted truncate">{c.outcome}</div></div>
            <div className="text-right shrink-0"><div className="text-[11px] text-g-light font-bold">{c.dur}</div><div className="text-[10px] text-g-muted">{c.time}</div></div>
          </button>
          ))}
          {rows.length === 0 && <Empty icon="📞" text="No calls yet — your AI is standing by to answer 24/7." />}
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
        >
          <div><div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">Turn this call into action</div><ConvoActions V={V} who={sel.name} channel="call" onNav={onNav} onDone={() => setSel(null)} /></div>
        </Drawer>
      )}
    </div>
  );
}
function Dialer() {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  const [num, setNum] = useState("");
  const [calling, setCalling] = useState(false);
  // Format the raw digits as a friendly US-style number as the user taps.
  const fmt = (s) => {
    const d = s.replace(/\D/g, "").slice(0, 10);
    if (!d) return "+1 (___) ___-____";
    const a = d.slice(0, 3).padEnd(3, "_"), b = d.slice(3, 6).padEnd(3, "_"), c = d.slice(6, 10).padEnd(4, "_");
    return `+1 (${a}) ${b}-${c}`;
  };
  const press = (k) => setNum((n) => (n.replace(/\D/g, "").length >= 10 ? n : n + k));
  const start = () => {
    if (num.replace(/\D/g, "").length < 10) { toast("Enter a 10-digit number first"); return; }
    setCalling(true); toast(`AI is calling ${fmt(num)} 📞`);
    setTimeout(() => { setCalling(false); setNum(""); toast("Call handled by AI ✓ — logged in Call Logs"); }, 2200);
  };
  return (
    <div className="max-w-xs mx-auto">
      <Card className="text-center">
        <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("AI Call Dialer")}</div>
        <div className="h-10 rounded-xl2 bg-black/20 border border-white/10 grid place-items-center text-g-word font-bold mb-3 tracking-wide">{fmt(num)}</div>
        <div className="grid grid-cols-3 gap-2">{keys.map((k) => <button key={k} onClick={() => press(k)} className="h-12 rounded-xl2 border border-white/10 bg-white/[0.04] text-g-word font-bold hover:border-g-gold/40 active:scale-95 transition">{k}</button>)}</div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setNum((n) => n.slice(0, -1))} disabled={!num} className="rounded-xl2 border border-white/15 px-4 text-g-muted hover:text-g-word disabled:opacity-30 transition" aria-label="Delete">⌫</button>
          <button onClick={start} disabled={calling} className="btn-bright flex-1 text-sm disabled:opacity-70">{calling ? "Calling…" : "📞 Start AI call"}</button>
        </div>
        <p className="mt-2.5 text-[10px] text-g-muted">The AI places the call, talks to the customer, and logs the outcome for you.</p>
      </Card>
    </div>
  );
}
// Channel metadata — one place to map a channel to its icon + brand color.
const CHANNEL_META = {
  Phone: [FaPhone, "#3E9468"], WhatsApp: [FaWhatsapp, "#25D366"], SMS: [FaCommentSms, "#38BDF8"],
  Instagram: [FaInstagram, "#E4405F"], Facebook: [FaFacebook, "#1877F2"], TikTok: [FaTiktok, "#9ca3af"],
};
// Unified omnichannel inbox feed — every channel normalized to the same shape so
// the operator thinks in "conversations", not "which app". Names/threads draw from
// the sector's own data so it reads true everywhere.
function genInbox(V) {
  const sch = (V.ops?.schedule || []).map((r) => r.name).filter(Boolean);
  const nm = (i, f) => sch[i] || f;
  const items = [
    { name: nm(0, "Sofia M."), channel: "WhatsApp", last: "Can I get this for tonight?", t: "2m", unread: 1, sentiment: "Positive" },
    { name: nm(1, "Diego R."), channel: "Phone", last: "Called — asked about availability", t: "8m", unread: 0, sentiment: "Neutral" },
    { name: nm(2, "Júlia P."), channel: "Instagram", last: "Loved it! Do you do events?", t: "15m", unread: 1, sentiment: "Positive" },
    { name: nm(3, "Marco T."), channel: "SMS", last: "Yes, 7pm works — thanks!", t: "32m", unread: 0, sentiment: "Positive" },
    { name: nm(4, "Bianca L."), channel: "Facebook", last: "What are your Sunday hours?", t: "1h", unread: 0, sentiment: "Neutral" },
    { name: "New lead", channel: "WhatsApp", last: "Hi! Are you available this week?", t: "1h", unread: 1, sentiment: "Positive" },
  ];
  return items.map((c, id) => ({ ...c, id }));
}
// From any conversation (call or text) the operator can FIRE an action that lands
// in the right tab — the actual "integration". Per-sector verb + target view.
function convoAction(V) {
  return {
    "Restaurant": { label: "🧾 Create order", view: "liveorders", done: "Order created" },
    "E-Commerce": { label: "🧾 Create order", view: "schedule", done: "Order created" },
    "Clinic": { label: "📅 Book appointment", view: "schedule", done: "Appointment booked" },
    "Medical": { label: "📅 Book appointment", view: "schedule", done: "Appointment booked" },
    "Salon & Spa": { label: "📅 Book appointment", view: "schedule", done: "Appointment booked" },
    "Gym & Fitness": { label: "📅 Book a class", view: "schedule", done: "Class booked" },
    "Law Firm": { label: "📅 Book consult", view: "schedule", done: "Consult booked" },
    "Real Estate": { label: "📅 Book viewing", view: "schedule", done: "Viewing booked" },
    "Plumbing & HVAC": { label: "🔧 Schedule a job", view: "schedule", done: "Job scheduled" },
    "Auto Dealership": { label: "📅 Book service", view: "schedule", done: "Service booked" },
    "Education": { label: "📅 Book a class", view: "schedule", done: "Class booked" },
    "Construction": { label: "📅 Schedule site visit", view: "schedule", done: "Site visit scheduled" },
  }[V.label] || { label: "📅 Book", view: "schedule", done: "Booked" };
}
// A compact, reusable action bar — drop it in the inbox thread AND the call drawer
// so a call or a text can spawn an order / booking / follow-up that lands in its tab.
function ConvoActions({ V, who, channel, onNav, onDone }) {
  const act = convoAction(V);
  const cfg = deliveryCfg(V);
  const fire = (msg, view) => { toast(msg); onDone?.(); if (view) onNav?.(view); };
  const firePrimary = () => { const rec = recordFor(act.view, who, channel, V); if (rec) pushCreated(V.label, act.view, rec); fire(`${act.done} from ${who}'s ${channel} ✓ — see it in the tab`, act.view); };
  const fireDelivery = () => { const rec = recordFor("deliveries", who, channel, V); pushCreated(V.label, "deliveries", rec); fire(`${who} sent to ${deliveryTab(V).toLowerCase()} ✓ — see it in the tab`, "deliveries"); };
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={firePrimary} className="text-[11px] font-bold rounded-full border border-g-green/40 bg-g-green/[0.1] px-3 py-1.5 text-g-green hover:bg-g-green/20 transition">{act.label}</button>
      <button onClick={fireDelivery} className="text-[11px] font-bold rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-g-word hover:border-g-gold/40 transition">{cfg.partners.length ? "🚚 To delivery" : "📍 Dispatch"}</button>
      <button onClick={() => fire(`${who} added to follow-ups ✓`, "followups")} className="text-[11px] font-bold rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-g-word hover:border-g-gold/40 transition">⏰ Follow-up</button>
      <button onClick={() => fire(`Saved to ${who}'s customer profile ✓`, "customers")} className="text-[11px] font-bold rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-g-word hover:border-g-gold/40 transition">👤 Save to customer</button>
    </div>
  );
}
const inboxThread = (c) => [
  { from: "them", text: c.last },
  { from: "ai", text: "Hi! 😊 Thanks for reaching out — I can take care of that right now." },
  { from: "them", text: "Perfect, yes please." },
  { from: "ai", text: `All set ✅ I've noted it and you'll get a confirmation on ${c.channel}. Anything else?` },
];

function Inbox({ V, onNav }) {
  const all = genInbox(V);
  const FILTERS = ["All", "Phone", "WhatsApp", "SMS", "Social"];
  const inFilter = (c, f) => f === "All" || (f === "Social" ? ["Instagram", "Facebook", "TikTok"].includes(c.channel) : c.channel === f);
  const [filter, setFilter] = useState("All");
  const [activeId, setActiveId] = useState(all[0]?.id ?? 0);
  const [threads, setThreads] = useState(() => Object.fromEntries(all.map((c) => [c.id, inboxThread(c)])));
  const [draft, setDraft] = useState("");
  const count = (f) => all.filter((c) => inFilter(c, f)).length;
  const unread = (f) => all.filter((c) => inFilter(c, f) && c.unread).length;
  const list = all.filter((c) => inFilter(c, filter));
  const cur = list.find((c) => c.id === activeId) || list[0];
  const send = (e) => { e.preventDefault(); if (!draft.trim() || !cur) return; portalApi.sendMessage(cur.channel, cur.id, draft); setThreads((t) => ({ ...t, [cur.id]: [...(t[cur.id] || []), { from: "you", text: draft }] })); setDraft(""); toast(`Reply sent on ${cur.channel} ✓`); };
  const [Icon, color] = cur ? (CHANNEL_META[cur.channel] || CHANNEL_META.WhatsApp) : CHANNEL_META.WhatsApp;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition ${filter === f ? "border-g-gold/50 bg-g-gold/15 text-g-gold" : "border-white/12 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>
            {f === "All" ? "All channels" : f} <span className="text-g-muted">{count(f)}</span>{unread(f) > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black">{unread(f)}</span>}
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 lg:h-[32rem]">
        <Card className="p-0 overflow-hidden lg:col-span-1 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold shrink-0">Unified inbox · {list.length}</div>
          <div className="divide-y divide-white/[0.06] overflow-y-auto">
            {list.map((c) => {
              const [CI, cc] = CHANNEL_META[c.channel] || CHANNEL_META.WhatsApp;
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)} className={`w-full text-left flex items-center gap-3 px-4 py-3 transition ${c.id === (cur?.id) ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                  <span className="relative grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] shrink-0 text-sm font-bold text-g-word">{c.name[0]}<span className="absolute -bottom-1 -right-1 grid place-items-center h-4 w-4 rounded-full bg-g-cream" style={{ color: cc }}><CI size={9} /></span></span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name}</div><div className="text-[11px] text-g-muted truncate">{c.last}</div></div>
                  <div className="text-right shrink-0"><div className="text-[10px] text-g-muted">{c.t}</div>{c.unread > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-g-green text-[10px] font-bold text-black mt-0.5">{c.unread}</span>}</div>
                </button>
              );
            })}
            {list.length === 0 && <Empty icon="💬" text="No conversations on this channel right now." />}
          </div>
        </Card>
        <Card className="p-0 overflow-hidden lg:col-span-2 flex flex-col">
          {cur && <>
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 shrink-0">
              <span className="grid place-items-center h-8 w-8 rounded-full bg-white/[0.06]" style={{ color }}><Icon size={14} /></span>
              <div className="min-w-0"><div className="text-sm font-bold text-g-word truncate">{cur.name}</div><div className="text-[10px] text-g-muted">{cur.channel} · {cur.sentiment}</div></div>
              <button onClick={() => onNav?.("customers")} className="ml-auto text-[11px] font-bold text-g-gold hover:underline shrink-0">{tr("Customer →")}</button>
              <span className="text-[10px] font-bold uppercase text-g-green inline-flex items-center gap-1 shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />AI active</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[14rem]">
              {(threads[cur.id] || []).map((m, i) => (
                <div key={i} className={`flex ${m.from === "them" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${m.from === "them" ? "bg-white/[0.06] text-g-word" : m.from === "ai" ? "bg-g-green/15 text-g-light border border-g-green/30" : "bg-g-gold/15 text-g-word border border-g-gold/30"}`}>
                    {m.from === "ai" && <div className="text-[9px] font-black uppercase text-g-green mb-0.5">Guileo AI</div>}
                    {m.from === "you" && <div className="text-[9px] font-black uppercase text-g-gold mb-0.5">{tr("You")}</div>}
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 pt-3 shrink-0"><ConvoActions V={V} who={cur.name} channel={cur.channel} onNav={onNav} /></div>
            <form onSubmit={send} className="p-3 border-t-0 flex gap-2 shrink-0">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Reply" placeholder={`Reply on ${cur.channel}…`} className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
              <button className="btn-bright text-sm px-5">Send</button>
            </form>
          </>}
        </Card>
      </div>
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
          {list.length === 0 && <Empty icon="💬" text="No conversations yet — they'll show up here as customers message you." />}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden lg:col-span-2 flex flex-col">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 shrink-0"><span className="grid place-items-center h-8 w-8 rounded-full bg-white/[0.06] text-xs font-bold text-g-word">{(c.name || "?")[0]}</span><div className="text-sm font-bold text-g-word">{c.name}</div><span className="ml-auto text-[10px] font-bold uppercase text-g-green inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />AI active</span></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[15rem]">
          {(threads[active] || []).map((m, i) => (
            <div key={i} className={`flex ${m.from === "them" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${m.from === "them" ? "bg-white/[0.06] text-g-word" : m.from === "ai" ? "bg-g-green/15 text-g-light border border-g-green/30" : "bg-g-gold/15 text-g-word border border-g-gold/30"}`}>
                {m.from === "ai" && <div className="text-[9px] font-black uppercase text-g-green mb-0.5">Guileo AI</div>}
                {m.from === "you" && <div className="text-[9px] font-black uppercase text-g-gold mb-0.5">{tr("You")}</div>}
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

  // Editable business profile → feeds the trained AI's location & hours answers.
  const [profile, setProfile] = useState(() => portalApi.loadProfile(V.label, defProfile(V)));
  const [draft, setDraft] = useState(profile);
  useEffect(() => { const p = portalApi.loadProfile(V.label, defProfile(V)); setProfile(p); setDraft(p); }, [V.label]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const saveProfile = () => {
    syncProfile(V.label, V, draft); // persist + re-sync the AI's location & hours answers
    setProfile(draft);
    toast("Business profile saved — your AI is updated ✓");
  };
  const fieldCls = "mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70";
  const PROFILE_FIELDS = [["Business name", "name", "Your business name"], ["Address / location", "place", "123 Main St, City"], ["Opening hours", "hours", "Mon–Sun, 9am–10pm"], ["Public phone", "phone", "(optional)"]];
  // Real, persisted operating settings (shape the AI's behavior + when the owner gets pinged).
  const defS = { tone: "Friendly", greeting: "", on_booking: true, on_missed: true, on_review: true, daily_summary: true, quiet_enabled: false, quiet_start: "21:00", quiet_end: "08:00", after_hours_msg: "", fallback_number: "" };
  const [st, setSt] = useState(() => ({ ...defS, ...portalApi.loadState(`${V.label}:settings`, {}) }));
  useEffect(() => { setSt({ ...defS, ...portalApi.loadState(`${V.label}:settings`, {}) }); }, [V.label]); // eslint-disable-line
  const setS = (k, v) => setSt((s) => { const n = { ...s, [k]: v }; portalApi.saveState(`${V.label}:settings`, n); return n; });
  const [payg, setPaygS] = useState(() => portalApi.loadState("gui_payg", true));
  const flipPayg = () => setPaygS((p) => { const v = !p; portalApi.saveState("gui_payg", v); window.dispatchEvent(new Event("gui:credits")); toast(v ? "Auto top-up on ✓" : "Auto top-up off"); return v; });
  return (
    <div className="space-y-4 stagger">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Business profile")}</div>
          <span className="text-[10px] text-g-muted inline-flex items-center gap-1"><FaWandMagicSparkles size={9} className="text-g-green" /> feeds your AI's answers</span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {PROFILE_FIELDS.map(([label, k, ph]) => (
            <label key={k} className="block px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{label}</span>
              <input value={draft[k] || ""} onChange={set(k)} placeholder={ph} className={fieldCls} /></label>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3">
          <span className="text-[11px] text-g-muted">{dirty ? "Unsaved changes" : "Your AI uses these facts when customers ask."}</span>
          <button onClick={saveProfile} disabled={!dirty} className="btn-bright text-sm disabled:opacity-40 disabled:cursor-not-allowed">Save & update AI</button>
        </div>
      </Card>

      {/* AI behavior — tone + custom greeting shape every customer interaction */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("AI voice & greeting")}</div>
        <div className="divide-y divide-white/[0.06]">
          <label className="block px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">Tone</span>
            <select value={st.tone} onChange={(e) => setS("tone", e.target.value)} className={fieldCls}>{["Friendly", "Professional", "Warm & casual", "Concise", "Enthusiastic"].map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          <label className="block px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">Custom greeting</span>
            <textarea value={st.greeting} onChange={(e) => setS("greeting", e.target.value)} placeholder={`e.g. "Hi! Thanks for contacting ${draft.name || V.business.name} 👋 How can I help?"`} rows={2} className={fieldCls} /></label>
          <div className="flex items-center justify-between px-5 py-3.5"><div><div className="text-sm text-g-word font-semibold">Hand off to a human on request</div><div className="text-[11px] text-g-muted">When a customer asks for a person, the AI alerts your team.</div></div><Toggle on={st.human_handoff !== false} onClick={() => setS("human_handoff", st.human_handoff === false)} /></div>
        </div>
        <div className="px-5 py-2.5 border-t border-white/10 text-[11px] text-g-green">Saved automatically · your AI uses this on every channel ✓</div>
      </Card>

      {/* Notifications & billing — when the owner gets pinged + auto top-up (revenue safety) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Notifications & billing")}</div>
        <div className="divide-y divide-white/[0.06]">
          {[["on_booking", "New booking or order"], ["on_missed", "Missed call or lead"], ["on_review", "New review"], ["daily_summary", "Daily summary from Gui"]].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-word font-semibold">{label}</span><Toggle on={st[k] !== false} onClick={() => setS(k, st[k] === false)} /></div>
          ))}
          <div className="flex items-center justify-between px-5 py-3.5"><div><div className="text-sm text-g-word font-semibold">Auto top-up Gui credits</div><div className="text-[11px] text-g-muted">Never let the AI pause mid-task — refill when low (pay-as-you-go).</div></div><Toggle on={payg} onClick={flipPayg} /></div>
          <div className="flex items-center justify-between px-5 py-3.5"><div className="flex items-center gap-3"><span className="text-sm text-g-word font-semibold">Quiet hours</span></div><Toggle on={!!st.quiet_enabled} onClick={() => setS("quiet_enabled", !st.quiet_enabled)} /></div>
          {st.quiet_enabled && (
            <div className="flex items-center gap-3 px-5 py-3">
              <label className="flex-1"><span className="text-[10px] uppercase tracking-wide text-g-muted">From</span><input type="time" value={st.quiet_start} onChange={(e) => setS("quiet_start", e.target.value)} className={fieldCls} /></label>
              <label className="flex-1"><span className="text-[10px] uppercase tracking-wide text-g-muted">To</span><input type="time" value={st.quiet_end} onChange={(e) => setS("quiet_end", e.target.value)} className={fieldCls} /></label>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Account")}</div>
        <div className="divide-y divide-white/[0.06]">
          {[["Plan", V.plan?.label || "Growth Plan"], ["Languages", "English · Português · Español"], ["Timezone", "Local"]].map(([k, v], i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-muted">{k}</span><span className="text-sm font-bold text-g-word text-right">{v}</span></div>
          ))}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("What your AI handles")}</div>
        <div className="divide-y divide-white/[0.06]">
          {Object.keys(LBL).map((k) => (
            <div key={k} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-word font-semibold">{LBL[k]}</span><Toggle on={toggles[k]} onClick={() => flip(k)} /></div>
          ))}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Integrations &amp; webhooks")}</div>
        <div className="divide-y divide-white/[0.06]">
          {[["📅 Calendar (Google/Apple)", "Connected"], ["💳 Stripe payments", "Connected"], ["🍔 POS / orders", "Connected"], ["📣 Meta & Google Ads", "Connected"], ["🛵 Delivery platforms", "Connected"]].map(([name, st]) => (
            <div key={name} className="flex items-center justify-between px-5 py-3"><span className="text-sm text-g-word font-semibold">{name}</span><span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{st}</span></div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-white/10">
          <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">Live webhook events</div>
          <div className="space-y-1.5 font-mono text-[10px] text-g-muted">
            {[["order.created", "→ POS · just now"], ["booking.confirmed", "→ Calendar · 2m"], ["payment.succeeded", "→ Stripe · 6m"], ["review.received", "→ Reputation · 11m"]].map(([ev, meta]) => (
              <div key={ev} className="flex items-center gap-2"><span className="text-g-green">●</span><span className="text-g-word">{ev}</span><span className="flex-1" /><span>{meta}</span></div>
            ))}
          </div>
        </div>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-sm font-bold text-g-word">Demo data</div><div className="text-[11px] text-g-muted">Reset resolved alerts, won deals, filled slots & read flags back to the sample state.</div></div>
        <button onClick={() => { ["alerts", "fups", "wait", "notifsRead", "created:liveorders", "created:schedule", "created:deliveries", "created:campaigns", "created:impact", "created:audiences", "created:reviewreq", "created:payments", "created:team", "created:locations", "created:giftcards", "integrations", "owndelivery", "loyalty", "goal"].forEach((k) => { try { localStorage.removeItem(`guileo_state_${V.label}:${k}`); } catch { /* ignore */ } }); toast("Demo data reset — reloading…"); setTimeout(() => location.reload(), 600); }} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-g-muted hover:text-g-word hover:border-g-gold/40 transition shrink-0">↻ Reset demo data</button>
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
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">Grow with Guileo</div><div className="text-xs text-g-muted mt-0.5">Want more? Add a channel or service — we set it up, you keep one login and one bill. Growth on tap.</div></div>
          <a href={waLink("Hi Guileo! I'd like to add a new service to my plan")} target="_blank" rel="noopener" className="btn-bright text-sm">Talk to my team →</a>
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADDONS.map(([ic, name, desc], i) => (
          <Card key={i} className="flex flex-col">
            <div className="flex items-center gap-3"><span className="grid place-items-center h-11 w-11 rounded-xl bg-white/[0.06] text-xl shrink-0">{ic}</span><div className="text-sm font-bold text-g-word">{name}</div></div>
            <p className="text-xs text-g-muted mt-2 flex-1">{desc}</p>
            <a href={waLink(`Hi Guileo! I'd like to add: ${name}`)} target="_blank" rel="noopener" className="mt-3 inline-flex items-center justify-center gap-1 rounded-full border border-g-gold/40 bg-g-gold/[0.08] px-4 py-2 text-xs font-bold text-g-gold hover:bg-g-gold/[0.16] transition">{tr("Request this →")}</a>
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

// Words too common to carry meaning when matching a question to a trained answer.
const KB_STOP = new Set("a an the is are do does can could would i you we my your our of to for on in at and or with how what when where why which that this it me us your you're im i'm".split(" "));
const kbTokens = (s) => (s || "").toLowerCase().replace(/[^a-z0-9à-ÿ\s]/gi, " ").split(/\s+/).filter((w) => w.length > 2 && !KB_STOP.has(w));

// Match a free-text customer question against the trained knowledge base.
// Score = how many meaningful words of the entry's trigger appear in the question
// (normalised by trigger length so a tight 2-word topic isn't beaten by a long one).
// Returns the best entry above a confidence floor, else null → keyword fallback.
// Two words "match" if they're equal OR share a 4-char prefix — cheap, robust
// stemming so "located"/"location", "booking"/"book", "prices"/"pricing" collide
// without a brittle suffix-stripping table.
const wordsMatch = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));
function kbMatch(q, kb) {
  const qt = kbTokens(q);
  if (!qt.length) return null;
  let best = null, bestScore = 0;
  for (const e of kb) {
    const trig = [...new Set(kbTokens(`${e.topic} ${e.triggers || ""}`))];
    if (!trig.length) continue;
    const hits = trig.filter((w) => qt.some((x) => wordsMatch(w, x))).length;
    if (!hits) continue;
    // Raw hit count wins (more keyword overlap = more relevant); a small
    // focus bonus breaks ties toward concise entries. More triggers must HELP
    // recall, never hurt it — so we do NOT divide by trigger count.
    const score = hits + hits / trig.length * 0.1;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best; // any ≥1 keyword overlap matches; no overlap → keyword fallback
}

// The handful of facts the AI repeats most — editable in Settings, feeds the KB.
function defProfile(V) {
  return { name: V.business.name, place: V.business.place, hours: "Mon–Sun, 9am–10pm", phone: "" };
}
const profBiz = (p) => `We're ${p.name}, located at ${p.place}. I can send directions on WhatsApp — want them?`;
const profHours = (p) => `We're open ${p.hours}. Want me to book you in?`;
// Save the profile AND re-sync the AI's location+hours answers in the KB, so any
// edit (Settings or onboarding) is immediately reflected by the trained AI.
function syncProfile(label, V, profile) {
  portalApi.saveProfile(label, profile);
  const kb = portalApi.loadKB(label, seedKB(V, profile)).map((e) =>
    e.id === "biz" ? { ...e, answer: profBiz(profile) } : e.id === "hours" ? { ...e, answer: profHours(profile) } : e
  );
  portalApi.saveKB(label, kb);
}

// Default seed: pull real facts out of the vertical (+ saved profile) so every
// sector starts smart.
function seedKB(V, profile = defProfile(V)) {
  const services = (V.ops?.list || []).slice(0, 6).map((x) => x.name).filter(Boolean).join(", ");
  return [
    { id: "biz", topic: "Location & address", triggers: "where address location directions onde endereço", answer: profBiz(profile), locked: false },
    { id: "hours", topic: "Opening hours", triggers: "open close time hours aberto horário", answer: profHours(profile), locked: false },
    { id: "book", topic: "Bookings & appointments", triggers: "book booking appointment reserve table schedule agendar marcar", answer: "Absolutely! What day and time works for you? I'll lock it in right away. 📅", locked: false },
    { id: "price", topic: "Pricing & quotes", triggers: "price pricing cost quote preço quanto", answer: "Pricing depends on what you need — I can get you a quick quote. What are you looking for?", locked: false },
    { id: "services", topic: "Services offered", triggers: "service services offer menu catalog produtos", answer: services ? `We offer: ${services}. Which one can I help you with?` : "We offer a full range of services — tell me what you need and I'll guide you.", locked: false },
    { id: "cancel", topic: "Cancellations & refunds", triggers: "cancel cancellation refund reschedule reembolso cancelar", answer: "No problem — I'll take care of that and loop in a human if needed. Can I have your name?", locked: true },
  ];
}

function aiAnswer(q, V, kb) {
  const hit = kb && kbMatch(q, kb);
  if (hit) return hit.answer;
  const s = q.toLowerCase();
  if (/deliver|entrega/.test(s)) return "Yes, we deliver 🛵 — just send your address and order and I'll confirm the ETA.";
  return `Great question! I'd handle that right away for ${V.business.name} and book or answer accordingly. (Add this to your knowledge base below so I nail it every time.)`;
}

function AIBrain({ V }) {
  const [kb, setKb] = useState(() => portalApi.loadKB(V.label, seedKB(V, portalApi.loadProfile(V.label, defProfile(V)))));
  const [trainedAt, setTrainedAt] = useState("2 days ago");
  const [editing, setEditing] = useState(null); // entry being edited, or {} for new
  const [q, setQ] = useState("");
  const [chat, setChat] = useState([]);

  // Reload when switching verticals (each sector keeps its own brain + profile).
  useEffect(() => { setKb(portalApi.loadKB(V.label, seedKB(V, portalApi.loadProfile(V.label, defProfile(V))))); setChat([]); }, [V.label]);

  const persist = (next) => { setKb(next); portalApi.saveKB(V.label, next); setTrainedAt("just now"); toast("AI retrained ✓ — it'll use this on the next conversation"); };
  const saveEntry = (entry) => {
    const e = { ...entry, id: entry.id || `k${kb.length}_${entry.topic.slice(0, 4)}` };
    persist(entry.id ? kb.map((x) => (x.id === e.id ? e : x)) : [...kb, e]);
    setEditing(null);
  };
  const delEntry = (id) => persist(kb.filter((x) => x.id !== id));

  const ask = (e) => { e.preventDefault(); if (!q.trim()) return; setChat((c) => [...c, { q, a: aiAnswer(q, V, kb), trained: !!kbMatch(q, kb) }]); setQ(""); };
  const suggestions = ["What are your hours?", "Can I book for tomorrow?", "How much does it cost?", "Where are you located?"];

  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">🧠 Your AI's brain</div><div className="text-xs text-g-muted mt-0.5">Teach it in plain words — it answers your <b className="text-g-light">very next customer</b> with it. Test it live below.</div></div>
          <button onClick={() => setEditing({ topic: "", triggers: "", answer: "" })} className="btn-bright text-sm inline-flex items-center gap-2"><FaPlus size={11} /> Teach it something</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word"><FaCircleCheck className="text-g-green" size={11} /> {kb.length} things learned</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word"><span className="text-g-green">✓</span> Last trained {trainedAt}</span>
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
              <div className="flex justify-start"><div className="max-w-[80%] space-y-1">
                <div className="rounded-2xl px-3.5 py-2 text-xs bg-g-green/15 text-g-light border border-g-green/30"><div className="text-[9px] font-black uppercase text-g-green mb-0.5 flex items-center gap-1">Your AI {m.trained && <span className="text-g-gold normal-case">{tr("· from your training")}</span>}</div>{m.a}</div>
                {!m.trained && <button onClick={() => setEditing({ topic: "", triggers: m.q, answer: "" })} className="ml-1 text-[11px] font-bold text-g-gold hover:text-g-word transition inline-flex items-center gap-1"><FaPen size={9} /> Teach a better answer</button>}
              </div></div>
            </div>
          ))}
        </div>
        {chat.length === 0 && <div className="px-4 pb-2 flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} onClick={() => setChat([{ q: s, a: aiAnswer(s, V, kb), trained: !!kbMatch(s, kb) }])} className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition">{s}</button>)}</div>}
        <form onSubmit={ask} className="p-3 border-t border-white/10 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask your AI" placeholder="Ask your AI a question…" className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <button className="btn-bright text-sm px-5">Ask</button>
        </form>
      </Card>

      {/* EDITABLE KNOWLEDGE BASE */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2"><FaWandMagicSparkles size={11} /> Knowledge base · what your AI knows</div>
          <button onClick={() => setEditing({ topic: "", triggers: "", answer: "" })} className="text-[11px] font-bold text-g-green hover:text-g-word transition inline-flex items-center gap-1"><FaPlus size={10} /> Add</button>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {kb.map((e) => (
            <div key={e.id} className="px-5 py-3 flex items-start gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-g-word flex items-center gap-2">{e.topic}{e.locked && <span className="text-[9px] font-black uppercase text-g-gold border border-g-gold/30 rounded px-1.5 py-0.5">{tr("routes to human")}</span>}</div>
                <p className="text-xs text-g-muted leading-relaxed mt-0.5">{e.answer}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 opacity-60 group-hover:opacity-100 transition">
                <button onClick={() => setEditing(e)} aria-label="Edit" className="text-g-muted hover:text-g-word transition"><FaPen size={11} /></button>
                <button onClick={() => delEntry(e.id)} aria-label="Delete" className="text-g-muted hover:text-red-400 transition"><FaTrash size={11} /></button>
              </div>
            </div>
          ))}
          {kb.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">Nothing trained yet — add your first answer above.</div>}
        </div>
      </Card>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit knowledge" : "Teach your AI"}
        subtitle="Your AI uses this the moment you save it"
        fields={null}
        actions={null}
      >
        {editing && <KBForm key={editing.id || "new"} entry={editing} onSave={saveEntry} onCancel={() => setEditing(null)} />}
      </Drawer>
    </div>
  );
}

function KBForm({ entry, onSave, onCancel }) {
  const [topic, setTopic] = useState(entry.topic || "");
  const [triggers, setTriggers] = useState(entry.triggers || "");
  const [answer, setAnswer] = useState(entry.answer || "");
  const valid = topic.trim() && answer.trim();
  const field = "w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70";
  return (
    <div className="space-y-3">
      <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">Topic</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Parking & access" className={`mt-1 ${field}`} /></label>
      <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">When customers ask about… <span className="normal-case font-normal text-g-muted/70">(keywords, optional)</span></span>
        <input value={triggers} onChange={(e) => setTriggers(e.target.value)} placeholder="parking park garage valet" className={`mt-1 ${field}`} /></label>
      <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">Your AI should reply</span>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} placeholder="Free parking is available right behind the building…" className={`mt-1 ${field} resize-none`} /></label>
      <div className="flex gap-2 pt-1">
        <button disabled={!valid} onClick={() => onSave({ ...entry, topic: topic.trim(), triggers: triggers.trim(), answer: answer.trim() })} className="btn-bright text-sm flex-1 disabled:opacity-40 disabled:cursor-not-allowed">Save & retrain</button>
        <button onClick={onCancel} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-g-muted hover:text-g-word transition">Cancel</button>
      </div>
    </div>
  );
}

// Plan tiers — the upgrade ladder (display + entitlement basis; real charge = Stripe at launch).
const PLANS = [
  { key: "starter", name: "Starter", price: 49, credits: 500, current: false, features: ["AI on 1 channel", "Bookings & reviews", "500 Gui credits / mo", "Email support"], featuresPt: ["IA em 1 canal", "Agendamentos e avaliações", "500 créditos do Gui / mês", "Suporte por e-mail"] },
  { key: "growth", name: "Growth", price: 149, credits: 2000, current: true, features: ["AI on all channels", "Full integrations stack", "2,000 Gui credits / mo", "Automations + radar", "A human managing it"], featuresPt: ["IA em todos os canais", "Stack de integrações completo", "2.000 créditos do Gui / mês", "Automações + radar", "Um humano cuidando"] },
  { key: "scale", name: "Scale", price: 399, credits: 6000, current: false, features: ["Everything in Growth", "Multi-location", "6,000 Gui credits / mo", "Priority + phone support", "Custom integrations"], featuresPt: ["Tudo do Growth", "Multi-unidade", "6.000 créditos do Gui / mês", "Suporte prioritário + telefone", "Integrações sob medida"] },
];
function Billing({ V }) {
  const plan = V.plan || { label: "Growth Plan", used: 1, total: 2000, unit: "Actions this month" };
  const pct = Math.round((plan.used / plan.total) * 100);
  const includes = ["AI voice agent · 24/7", "WhatsApp, SMS & social replies", "Bookings & reviews automation", "Live dashboard & monthly reports", "A real human managing it for you"];
  const invoices = [["Invoice #0012", "Jun 1, 2026", "Paid"], ["Invoice #0011", "May 1, 2026", "Paid"], ["Invoice #0010", "Apr 1, 2026", "Paid"]];
  // Gui AI credits — same gui_credits store the assistant + its meter read, so they never disagree.
  const [credits, setCredits] = useState(() => portalApi.loadState("gui_credits", 250));
  const [payg, setPayg] = useState(() => portalApi.loadState("gui_payg", true));
  useEffect(() => { const h = () => setCredits(portalApi.loadState("gui_credits", 250)); window.addEventListener("gui:credits", h); return () => window.removeEventListener("gui:credits", h); }, []);
  const setC = (n) => { setCredits(n); portalApi.saveState("gui_credits", n); window.dispatchEvent(new Event("gui:credits")); };
  const topUp = (n) => { setC(credits + n); toast(`${n} credits added ✓ — ${payg ? "billed to your account (pay-as-you-go)" : "added to your plan"}`); };
  const usedThisMonth = vnum(V.label, "guiused", 60, 320);
  const cpct = Math.max(2, Math.min(100, Math.round((credits / 500) * 100)));
  const low = credits < 50;
  return (
    <div className="space-y-4 stagger">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Current plan")}</div><div className="text-xl font-extrabold text-g-word mt-1">{plan.label}</div></div>
            <a href={waLink("I'd like to upgrade my Guileo plan")} target="_blank" rel="noopener" className="btn-bright text-sm">Upgrade →</a>
          </div>
          <div className="mt-4"><div className="flex justify-between text-xs mb-1"><span className="text-g-muted">{plan.unit}</span><span className="text-g-word font-bold">{plan.used} / {plan.total.toLocaleString()}</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${Math.max(2, pct)}%` }} /></div></div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">{tr("What's included")}</div>
          <ul className="space-y-1.5 text-xs text-g-word">{includes.map((x, i) => <li key={i} className="flex gap-2"><span className="text-g-green">✓</span>{x}</li>)}</ul>
        </Card>
      </div>

      {/* Gui AI credits — the assistant's pay-as-you-go meter, managed here */}
      <Card className="border-g-green/25 bg-gradient-to-br from-g-green/[0.08] to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-g-green/15 text-g-green"><FaWandMagicSparkles /></span>
            <div><div className="text-sm font-extrabold text-g-word">Gui — AI assistant credits</div><div className="text-xs text-g-muted mt-0.5">Powers every task Gui runs for you · ~5 credits per action</div></div>
          </div>
          <div className="text-right"><div className={`text-2xl font-extrabold ${low ? "text-red-400" : "text-g-word"}`}>{credits}</div><div className="text-[10px] uppercase tracking-wide text-g-muted">credits left</div></div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-gradient-to-r from-g-green to-g-gold"}`} style={{ width: `${cpct}%` }} /></div>
        <div className="mt-3 grid sm:grid-cols-3 gap-2">
          {[["+250", 250, "$9"], ["+500", 500, "$16"], ["+1,200", 1200, "$32"]].map(([label, n, price]) => (
            <button key={n} onClick={() => topUp(n)} className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-center hover:border-g-green/50 hover:bg-white/[0.07] transition">
              <div className="text-sm font-extrabold text-g-word">{label} <span className="text-g-muted font-normal">credits</span></div>
              <div className="text-[10px] text-g-gold font-bold">{price}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2"><Toggle on={payg} onClick={() => { const v = !payg; setPayg(v); portalApi.saveState("gui_payg", v); toast(v ? "Pay-as-you-go on — auto-top-up when low" : "Pay-as-you-go off — Gui pauses when out of credits"); }} /><span className="text-g-muted">Auto top-up (pay-as-you-go)</span></div>
          <span className="text-g-muted">{usedThisMonth} credits used this month</span>
        </div>
        <p className="mt-2 text-[10px] text-g-muted">Top-ups are billed securely to your account on file — we never ask for card details in chat.</p>
      </Card>

      {/* Gui usage history — what your credits bought, by day */}
      {(() => {
        const days = usageByDay(7);
        const max = Math.max(1, ...days.map((d) => d.total));
        const weekTotal = days.reduce((s, d) => s + d.total, 0);
        const recent = portalApi.loadState("gui_usage", []).slice(0, 6);
        return (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Gui usage · last 7 days")}</span><span className="text-[11px] text-g-muted">{weekTotal} credits this week</span></div>
            <div className="p-5">
              <div className="flex items-end gap-2 h-24">
                {days.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-end justify-center" style={{ height: "72px" }}>
                      <div className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-g-green to-g-gold transition-all" style={{ height: `${Math.max(4, Math.round((d.total / max) * 72))}px` }} title={`${d.total} credits`} />
                    </div>
                    <span className="text-[10px] text-g-muted">{d.label}</span>
                  </div>
                ))}
              </div>
              {recent.length > 0 ? (
                <div className="mt-4 divide-y divide-white/[0.05] border-t border-white/[0.06]">
                  {recent.map((u) => (
                    <div key={u._id} className="flex items-center gap-3 py-2"><span className="text-sm">🪄</span><div className="flex-1 min-w-0 text-xs text-g-word truncate">{u.label || "AI task"}</div><span className="text-[11px] text-g-muted shrink-0">{u.day}</span><span className="text-[11px] font-bold text-g-gold shrink-0">−{u.cost} cr</span></div>
                  ))}
                </div>
              ) : <p className="mt-3 text-[11px] text-g-muted text-center">No Gui activity yet — ask Gui to do something and it'll show up here.</p>}
            </div>
          </Card>
        );
      })()}

      {/* Plan tiers — the upgrade ladder */}
      <div>
        <div className="px-1 mb-2 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Plans")}</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {PLANS.map((p) => (
            <Card key={p.key} className={`relative ${p.current ? "border-g-gold/50 bg-g-gold/[0.06]" : ""}`}>
              {p.current && <span className="absolute -top-2 left-4 text-[9px] font-black uppercase tracking-wide bg-g-gold text-black rounded-full px-2 py-0.5">{tr("Current")}</span>}
              <div className="text-sm font-extrabold text-g-word">{p.name}</div>
              <div className="mt-1 flex items-baseline gap-1"><span className="text-2xl font-extrabold text-g-word">${p.price}</span><span className="text-[11px] text-g-muted">/{tr("mo")}</span></div>
              <ul className="mt-3 space-y-1.5 text-[11px] text-g-word">{(UI_LANG === "pt" ? p.featuresPt : p.features).map((f, i) => <li key={i} className="flex gap-1.5"><span className="text-g-green">✓</span>{f}</li>)}</ul>
              {p.current
                ? <div className="mt-3 text-center text-[11px] font-bold text-g-muted">{tr("Your plan")}</div>
                : <a href={waLink(`I'd like the ${p.name} plan ($${p.price}/mo)`)} target="_blank" rel="noopener" className={`mt-3 block text-center text-sm ${p.price > 149 ? "btn-bright" : "btn-ghost"}`}>{p.price > 149 ? tr("Upgrade →") : tr("Switch →")}</a>}
            </Card>
          ))}
        </div>
      </div>

      {/* Referral credits — a CAC-reducing growth loop on the existing credit system */}
      {(() => {
        const code = `GUI-${(V.business.name || "GUILEO").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()}${vnum(V.label, "refcode", 100, 999)}`;
        const link = `https://guileoai.com/?ref=${code}`;
        const refs = portalApi.loadState("gui_referrals", 0);
        const grant = () => { setC(credits + 250); portalApi.saveState("gui_referrals", refs + 1); toast("250 credits added ✓ — referral reward"); };
        const copy = () => { try { navigator.clipboard.writeText(link); } catch { /* */ } toast("Invite link copied ✓"); };
        return (
          <Card className="border-g-gold/25 bg-g-gold/[0.05]">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-g-gold/15 text-g-gold"><FaGift /></span>
              <div className="flex-1 min-w-0"><div className="text-sm font-extrabold text-g-word">Give 250, get 250 credits</div><div className="text-xs text-g-muted mt-0.5">Invite another business — you both get <span className="text-g-gold font-bold">{tr("250 free credits")}</span> when they join. {refs > 0 && <span className="text-g-green font-bold">{refs} joined so far.</span>}</div></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-[140px] rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs font-mono text-g-light truncate">{link}</code>
              <button onClick={copy} className="btn-ghost text-sm">Copy link</button>
              <button onClick={grant} className="btn-bright text-sm">Simulate a referral →</button>
            </div>
          </Card>
        );
      })()}

      {/* Go-live readiness — what's done vs what needs your keys to operate */}
      <Card className="p-0 overflow-hidden border-g-green/20">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("🚀 Go-live readiness")}</span><span className="text-[10px] font-black uppercase text-g-green">Front ready</span></div>
        <div className="divide-y divide-white/[0.06]">
          {[
            ["Product, AI & dashboard", "Built & validated", true],
            ["Accounts that persist (Supabase)", "Needs your project keys", false],
            ["Charge for credits & plans (Stripe)", "Needs your Stripe keys", false],
            ["Real integrations (OAuth)", "Needs your app approvals", false],
            ["Public domain & publish", "Needs your DNS + your OK", false],
          ].map(([label, st, done]) => (
            <div key={label} className="flex items-center gap-3 px-5 py-3">
              <span className={done ? "text-g-green" : "text-g-muted"}>{done ? <FaCircleCheck size={14} /> : "○"}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{label}</div><div className="text-[11px] text-g-muted">{st}</div></div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3">
          <span className="text-[11px] text-g-muted">Step-by-step in <span className="text-g-light font-semibold">LAUNCH.md</span>. I'll wire each one with you when you have the keys.</span>
          <a href={waLink("I'm ready to take Guileo live — let's connect the backend")} target="_blank" rel="noopener" className="btn-bright text-sm shrink-0">I have the keys →</a>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Invoices")}</div>
        <div className="divide-y divide-white/[0.06]">
          {invoices.map(([n, d, s], i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3"><span className="text-lg">🧾</span><div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{n}</div><div className="text-[11px] text-g-muted">{d}</div></div><span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-g-green/15 text-g-green">{s}</span><button onClick={() => toast(`${n} downloaded ✓`)} aria-label={`Download ${n}`} className="text-g-gold hover:text-g-word transition"><FaDownload size={12} /></button></div>
          ))}
        </div>
      </Card>
      <p className="text-center text-[11px] text-g-muted">Payment is handled securely with your team — we never ask for card details in chat.</p>
    </div>
  );
}

function ScheduleScreen({ V }) {
  const o = V.ops || {};
  const [tick, setTick] = useState(0);
  const sch = [...loadCreated(V.label, "schedule"), ...(o.schedule || [])];
  const [sel, setSel] = useState(null);
  const fillFromWaitlist = () => {
    const w = genWaitlist(V)[0];
    if (!w) { toast("Waitlist is empty"); return; }
    pushCreated(V.label, "schedule", { time: "Filled", name: w.name, meta: `Filled from waitlist · ${w.want}`, status: "Pending", ch: w.ch, color: "#D6C29A" });
    logImpact(V.label, `Filled a no-show slot from waitlist (${w.name})`, vnum(V.label, "fillval", 40, 160));
    setTick((t) => t + 1); toast(`Open slot filled from waitlist with ${w.name} ✓ — logged to Guileo Impact`);
  };
  return (
    <div className="space-y-4 stagger">
      {o.stats && (
        <div className="grid sm:grid-cols-3 gap-4">
          {o.stats.map((s) => (<Card key={s.label}><div className="text-[11px] uppercase tracking-wide text-g-muted">{s.label}</div><div className={`text-2xl font-extrabold mt-1 ${s.tone === "good" ? "text-g-green" : "text-g-word"}`}>{s.value}</div></Card>))}
        </div>
      )}
      {DEPOSIT[V.label] > 0 && (
        <Card className="border-g-green/25 bg-g-green/[0.05]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-sm font-extrabold text-g-word">🛡️ No-show protection · on</div><div className="text-xs text-g-muted mt-0.5">${DEPOSIT[V.label]} deposit held per booking · <b className="text-g-green">7 no-shows prevented</b> · $980 secured this month</div></div>
            <div className="flex gap-2"><button onClick={fillFromWaitlist} className="btn-bright text-sm">Fill from waitlist →</button><button onClick={() => toast("Deposit rules updated ✓")} className="btn-ghost text-sm">Manage rules</button></div>
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
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{r.name}{r.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("from chat")}</span>}</div><div className="text-[11px] text-g-muted truncate">{r.meta}{who ? <> · <span className="text-g-light">{who}</span></> : ""}{r.ch && r.ch !== "—" ? ` · ${r.ch}` : ""}</div></div>
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
            <button onClick={() => { const amt = vnum(V.label, "svcval", 60, 220); logImpact(V.label, `${sel.r.name} · ${sel.r.meta} completed`, amt); toast(`${sel.r.name} marked completed ✓ — $${amt} logged to Guileo Impact`); setSel(null); }} className="btn-ghost text-sm">✓ Completed</button>
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
  const rows = (V.activity || []).slice(0, 4).map((a, i) => ({ name: (V.ops?.schedule?.[i]?.name) || "New DM", last: a[2], t: a[3], unread: i % 2, ...{ net: nets[i % 4][2], color: nets[i % 4][1] } }));
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4 stagger">
      <div className="flex flex-wrap gap-2">
        {[["Instagram", "#E4405F", 18], ["Facebook", "#1877F2", 9], ["TikTok", "#e7e7e7", 6]].map(([n, c, v]) => (
          <span key={n} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{n} <span className="text-g-muted">{v} replies today</span></span>
        ))}
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Social inbox · AI replies on Instagram, Facebook &amp; TikTok")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap to open</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => {
            const [Icon, color, net] = nets[i % 4];
            return (
              <button key={i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color }}><Icon size={16} /></span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name} <span className="text-g-muted font-normal">· {net}</span></div><div className="text-[11px] text-g-muted truncate">{c.last}</div></div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1"><span className="text-[10px] text-g-muted">{c.t}</span>{c.unread > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-g-green text-[10px] font-bold text-black">{c.unread}</span>}</div>
              </button>
            );
          })}
          {rows.length === 0 && <Empty icon="💬" text="No social DMs yet — your AI replies on Instagram, Facebook & TikTok the moment they arrive." />}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.net} · direct message`}
          badge={<span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />AI replied</span>}
          fields={[["Channel", sel.net], ["When", sel.t], ["Status", "Auto-replied by AI"]]}
          note={<>"{sel.last}"<div className="mt-2 text-g-muted">Your AI already replied on {sel.net} and offered to book — it only pings you if a human is needed.</div></>}
          actions={<><button onClick={() => { toast(`Reply sent on ${sel.net} ✓`); setSel(null); }} className="btn-bright text-sm">💬 Reply</button><button onClick={() => { toast("Marked as handled ✓"); setSel(null); }} className="btn-ghost text-sm">✓ Mark handled</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

// What customers ask the AI, the missed-revenue insights, and sample transcripts —
// all per-sector so AI Analytics reads true for a clinic or a law firm, not just a restaurant.
const BOOK_WORD = { "Restaurant": "a table", "Clinic": "an appointment", "Medical": "an appointment", "Salon & Spa": "an appointment", "Gym & Fitness": "a session", "Law Firm": "a consultation", "Real Estate": "a viewing", "Plumbing & HVAC": "a visit", "Auto Dealership": "a service slot", "Education": "a class", "Construction": "an estimate", "E-Commerce": "an order" };
function aiIntents(V) {
  const primary = { "Restaurant": "Booking / reservation", "Clinic": "Appointment booking", "Medical": "Appointment booking", "Salon & Spa": "Appointment booking", "Gym & Fitness": "Class / session booking", "Law Firm": "Consultation request", "Real Estate": "Viewing request", "Plumbing & HVAC": "Service request", "Auto Dealership": "Service / test-drive", "Education": "Enrollment request", "Construction": "Estimate request", "E-Commerce": "Order / status" }[V.label] || "Booking request";
  return [[primary, 41], ["Hours & location", 22], ["Pricing", 18], ["Status / follow-up", 12], ["Complaint", 7]];
}
function aiMissed(V) {
  const svc = (V.ops?.list?.[0]?.name) || "a service";
  return [
    `3 callers asked for ${svc.toLowerCase()}-adjacent services you don't offer yet — a possible new revenue line.`,
    "Demand peaks beyond capacity at busy hours — push the waitlist / pre-booking to capture it.",
    "5 pricing questions didn't convert — a small, well-timed offer could win them back.",
  ];
}
// Proactive AI recommendations — each one applies in a click and lands in its tab.
function genRecommendations(V) {
  return [
    { ic: "📣", text: "Your quietest weekday runs ~30% below capacity — a targeted promo fills it.", cta: "Launch promo", view: "campaigns", apply: (onNav) => { pushCreated(V.label, "campaigns", { name: "Slow-day filler promo", channel: "Email", sent: 0, opened: 0, revenue: 0, status: "Active" }); toast("Promo launched ✓ — see it in Campaigns"); onNav?.("campaigns"); } },
    { ic: "⭐", text: "A dozen happy customers haven't been asked for a review yet — reviews drive new demand.", cta: "Request reviews", view: "reputation", apply: (onNav) => { (V.customers || genCustomers(V)).slice(0, 3).forEach((c) => pushCreated(V.label, "reviewreq", { name: c.name, ch: c.channel })); toast("Review blast queued ✓"); onNav?.("reputation"); } },
    { ic: "🔁", text: "Several customers lapsed in the last 30 days — a win-back sequence recovers ~1 in 4.", cta: "Start win-back", view: "followups", apply: (onNav) => { toast("Win-back sequence started ✓"); onNav?.("followups"); } },
  ];
}
// Predictive AI — demand forecast + no-show risk, derived deterministically per sector.
function genForecast(V) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const load = days.map((d) => vnum(V.label, `fc${d}`, 45, 130));
  const peakIdx = load.indexOf(Math.max(...load));
  const lowIdx = load.indexOf(Math.min(...load));
  const risk = (V.ops?.schedule || []).filter((r) => /pending|new|risk|follow|unconfirmed/i.test(r.status)).slice(0, 3).map((r) => r.name);
  return { days, load, peak: days[peakIdx], peakLoad: load[peakIdx], low: days[lowIdx], risk };
}
// How the business stacks up vs its sector average — deterministic, all favorable.
function genBenchmarks(V) {
  return [
    { label: "AI response time", you: "under 5s", avg: "4 min", delta: "60× faster", better: true },
    { label: "No-show rate", you: `${vnum(V.label, "bmns", 3, 7)}%`, avg: `${vnum(V.label, "bmnsavg", 14, 22)}%`, delta: "less than half", better: true },
    { label: "Repeat-customer rate", you: `${vnum(V.label, "bmrep", 38, 52)}%`, avg: `${vnum(V.label, "bmrepavg", 22, 31)}%`, delta: "well above", better: true },
    { label: "Reviews per month", you: `${vnum(V.label, "bmrev", 60, 130)}`, avg: `${vnum(V.label, "bmrevavg", 14, 30)}`, delta: "3–4×", better: true },
  ];
}
// Consolidated AI Insights tab — recommendations (apply in 1 click) + demand/no-show
// forecast + industry benchmarks, all in one place.
function AIInsights({ V, onNav, sections = [] }) {
  const has = new Set(sections.map(([k]) => k));
  const recs = genRecommendations(V).filter((r) => has.has(r.view));
  const fc = genForecast(V);
  const fcMax = Math.max(...fc.load);
  const missed = aiMissed(V);
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaBrain className="text-g-green" /> AI Insights</div>
        <div className="text-xs text-g-muted mt-0.5">What your AI sees in your numbers — and the exact moves to grow faster. Apply any of them in one click.</div>
      </Card>

      <Card className="border-g-gold/30 bg-g-gold/[0.05] p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("⚡ Recommended by your AI · apply in one click")}</div>
        <div className="divide-y divide-white/[0.06]">
          {recs.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="text-lg shrink-0">{r.ic}</span>
              <div className="flex-1 min-w-0 text-xs text-g-word leading-snug">{r.text}</div>
              <button onClick={() => r.apply(onNav)} className="text-[11px] font-bold rounded-full border border-g-green/40 bg-g-green/[0.1] px-3 py-1.5 text-g-green hover:bg-g-green/20 transition shrink-0">{r.cta} →</button>
            </div>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-white/[0.06] text-[11px] text-g-muted">{missed[0]}</div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-1">{tr("🔮 Predicted demand · next 7 days")}</div>
          <div className="text-[11px] text-g-muted mb-3"><b className="text-g-green">{fc.peak}</b> peaks at <b className="text-g-word">{fc.peakLoad}%</b> — open more capacity. <b className="text-g-muted">{fc.low}</b> is quietest — a promo fills it.</div>
          <div className="flex items-end gap-1.5 h-24">
            {fc.load.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t" style={{ height: `${(v / fcMax) * 100}%`, background: v >= 100 ? "#EF4444" : v >= 80 ? "#D6C29A" : "#3E9468", minHeight: "4px" }} title={`${v}%`} />
                <span className="text-[9px] text-g-muted">{fc.days[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[9px] text-g-muted"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-g-green" />Normal</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "#D6C29A" }} />Busy</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" />Over capacity</span></div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("⚠ No-show risk · AI flagged")}</div>
          <div className="divide-y divide-white/[0.06]">
            {fc.risk.length ? fc.risk.map((name, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                <div className="flex-1 min-w-0 text-sm font-bold text-g-word truncate">{name}</div>
                <button onClick={() => toast(`Deposit + reminder sent to ${name} ✓`)} className="text-[11px] font-bold rounded-full border border-white/12 px-2.5 py-1 text-g-word hover:border-g-gold/40 transition">Secure</button>
              </div>
            )) : <Empty icon="✅" text="No high-risk bookings — your AI's reminders are keeping no-shows low." />}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">📊 How you compare · vs {V.label.toLowerCase()} average</div>
        <div className="divide-y divide-white/[0.06]">
          {genBenchmarks(V).map((b, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{b.label}</div><div className="text-[11px] text-g-muted">You: <b className="text-g-green">{b.you}</b> · Industry avg: {b.avg}</div></div>
              <span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1 shrink-0"><FaArrowTrendUp size={10} /> {b.delta}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-white/[0.06] text-[11px] text-g-muted">You're outperforming your sector on every metric your AI touches.</div>
      </Card>
    </div>
  );
}

function AIAnalytics({ V, onNav, sections = [] }) {
  const sentiment = [["Positive", 82, "#3E9468"], ["Neutral", 13, "#D6C29A"], ["Negative", 5, "#EF4444"]];
  const intents = aiIntents(V);
  const missed = aiMissed(V);
  const names = (V.ops?.schedule || []).map((r) => r.name).filter(Boolean);
  const ch1 = (V.channelMix?.items?.[0]?.[0]) || "Phone";
  const book = BOOK_WORD[V.label] || "an appointment";
  const svc = (V.ops?.list?.[0]?.name) || "your services";
  const T = V.transcripts || [
    { who: names[0] || "A customer", ch: ch1, sent: "Positive", lines: [["them", `Can I book ${book} for tomorrow?`], ["ai", `Of course! What time works best? I'll lock it in.`], ["them", "Around 2pm?"], ["ai", `2pm tomorrow it is — booked ✅ You'll get a reminder the day before.`]] },
    { who: names[1] || "Another customer", ch: "WhatsApp", sent: "Positive", lines: [["them", `How much is ${svc.toLowerCase()}?`], ["ai", `Happy to help — it depends on a couple of details. Can I ask what you need?`], ["them", "Just the basics for now."], ["ai", `Got it — I'll send a quick quote on WhatsApp and can book you in if it looks good. 👍`]] },
  ];
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Conversations analyzed", vnum(V.label, "convan", 980, 3200).toLocaleString()], ["Avg sentiment", "Positive 👍", "good"], ["Resolved by AI", `${vnum(V.label, "resai", 86, 95)}%`, "good"], ["Avg handle time", `1m ${vnum(V.label, "handle", 4, 52)}s`]]} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Sentiment")}</div>
          {sentiment.map(([l, v, c]) => (<div key={l} className="mb-2.5 last:mb-0"><div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{l}</span><span className="text-g-muted">{v}%</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v}%`, background: c }} /></div></div>))}
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Why people contact you")}</div>
          {intents.map(([l, v]) => (<div key={l} className="mb-2.5 last:mb-0"><div className="flex justify-between text-xs mb-1"><span className="text-g-word font-semibold">{l}</span><span className="text-g-muted">{v}%</span></div><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-g-green" style={{ width: `${(v / 41) * 100}%` }} /></div></div>))}
        </Card>
      </div>
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
  const has = new Set(sections.map(([k]) => k));
  const act = convoAction(V);
  // Quick ACTIONS — ⌘K isn't just search, it fires commands that land in their tab.
  const quickActions = [
    { icon: "🪄", label: "Ask Gui…", sub: "AI assistant — runs tasks for you", run: () => { window.dispatchEvent(new Event("gui:open")); onClose(); } },
    has.has(act.view) && { icon: "⚡", label: act.label.replace(/^[^A-Za-z]+/, ""), sub: "Quick action", run: () => { const rec = recordFor(act.view, "Walk-in", "manual", V); if (rec) pushCreated(V.label, act.view, rec); toast(`${act.done} ✓`); onNav(act.view); onClose(); } },
    has.has("payments") && { icon: "💳", label: "New invoice", sub: "Quick action", run: () => { const c = (V.customers || genCustomers(V))[0]; pushCreated(V.label, "payments", { id: `INV-${3000 + (Date.now() % 900)}`, customer: c?.name || "New customer", amount: vnum(V.label, "qkinv", 60, 320), status: "Pending", color: "#D6C29A", method: "Payment link", due: "in 3 days" }); toast("Payment link sent ✓"); onNav("payments"); onClose(); } },
    has.has("reputation") && { icon: "⭐", label: "Request reviews", sub: "Quick action", run: () => { (V.customers || genCustomers(V)).slice(0, 3).forEach((c) => pushCreated(V.label, "reviewreq", { name: c.name, ch: c.channel })); toast("Review blast queued ✓"); onNav("reputation"); onClose(); } },
  ].filter(Boolean);
  const items = [
    ...quickActions,
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
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10"><FaMagnifyingGlass size={13} className="text-g-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or run a command…" className="flex-1 bg-transparent text-sm text-g-word placeholder:text-g-muted outline-none" /><span className="text-[10px] text-g-muted border border-white/15 rounded px-1.5 py-0.5">ESC</span></div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {res.length ? res.map((it, i) => (
            <button key={i} onClick={() => { if (it.run) it.run(); else { onNav(it.key); onClose(); } }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.06] transition">
              <span className="text-base w-5 text-center text-g-gold">{it.icon}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{it.label}</div><div className="text-[11px] text-g-muted truncate">{it.sub}</div></div>
              {it.run && <span className="text-[9px] font-black uppercase text-g-gold bg-g-gold/15 rounded px-1.5 py-0.5">{tr("Run")}</span>}
            </button>
          )) : <div className="px-3 py-6 text-center text-xs text-g-muted">No matches</div>}
        </div>
      </div>
    </>
  );
}

// Multi-location — run every branch from one dashboard.
function Locations({ V }) {
  const rows = [...loadCreated(V.label, "locations"), ...genLocations(V)];
  const totalRev = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const [sel, setSel] = useState(null);
  const addLocation = () => { pushCreated(V.label, "locations", { name: `${V.business.name} · New branch`, addr: "New address", status: "Onboarding", revenue: 0, staff: 0, today: 0 }); toast("Location added ✓ — your AI is now covering it too"); };
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaLocationDot className="text-g-green" /> Locations</div><div className="text-xs text-g-muted mt-0.5">One AI, every branch — calls, bookings and orders routed to the right location automatically.</div></div>
          <button onClick={addLocation} className="btn-bright text-sm inline-flex items-center gap-2"><FaPlus size={11} /> Add location</button>
        </div>
      </Card>
      <MiniStats items={[["Locations", `${rows.length}`], ["Revenue (all)", `$${totalRev.toLocaleString()}`, "good"], ["Open now", `${rows.filter((r) => r.status !== "Onboarding").length}`, "good"], ["Today's volume", `${rows.reduce((s, r) => s + (r.today || 0), 0)}`]]} />
      <div className="grid sm:grid-cols-2 gap-4">
        {rows.map((r, i) => (
          <button key={i} onClick={() => setSel(r)} className="text-left">
            <Card className="hover:border-g-gold/30 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{r.name}{r.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("new")}</span>}</div><div className="text-[11px] text-g-muted">{r.addr}</div></div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: (r.status === "Open" ? "#3E9468" : r.status === "Busy" ? "#D6C29A" : "#38BDF8") + "22", color: r.status === "Open" ? "#3E9468" : r.status === "Busy" ? "#D6C29A" : "#38BDF8" }}>{r.status}</span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs"><span className="font-extrabold text-g-word">${(r.revenue || 0).toLocaleString()}<span className="text-g-muted font-normal"> /mo</span></span><span className="text-g-muted">{r.staff} staff</span><span className="text-g-muted">{r.today} today</span></div>
            </Card>
          </button>
        ))}
      </div>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={sel.addr}
          badge={<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: (sel.status === "Open" ? "#3E9468" : sel.status === "Busy" ? "#D6C29A" : "#38BDF8") + "22", color: sel.status === "Open" ? "#3E9468" : sel.status === "Busy" ? "#D6C29A" : "#38BDF8" }}>{sel.status}</span>}
          fields={[["Address", sel.addr], ["Revenue (mo.)", `$${(sel.revenue || 0).toLocaleString()}`], ["Staff", sel.staff], ["Volume today", sel.today], ["Status", sel.status]]}
          note={sel.status === "Onboarding" ? "New branch — your AI is being set up to cover its calls, bookings and chats." : `Fully live — the AI handles ${sel.name}'s customers 24/7 alongside every other branch.`}
          actions={<><button onClick={() => { toast(`${sel.name} set as default ✓`); setSel(null); }} className="btn-bright text-sm">⭐ Set default</button><a href={waLink(`Hi Guileo, about ${sel.name}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Manage</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

// Team & staff — manage the people, see who the AI is feeding work to.
function Team({ V }) {
  const rows = [...loadCreated(V.label, "team"), ...genTeam(V)];
  const active = rows.filter((r) => r.status === "Active");
  const totalRev = active.reduce((s, r) => s + (r.revenue || 0), 0);
  const avgRating = active.length ? (active.reduce((s, r) => s + (r.rating || 0), 0) / active.length).toFixed(1) : "—";
  const [sel, setSel] = useState(null);
  const invite = () => { pushCreated(V.label, "team", { name: "New teammate", role: TEAM_ROLE[V.label] || "Team member", status: "Invited", handled: 0, revenue: 0, rating: 0 }); toast("Invite link sent ✓ — they'll appear once they join"); };
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaUsers className="text-g-green" /> Team & staff</div><div className="text-xs text-g-muted mt-0.5">Your AI routes bookings, calls and chats to the right person — and tracks who's performing.</div></div>
          <button onClick={invite} className="btn-bright text-sm inline-flex items-center gap-2"><FaUserPlus size={11} /> Invite member</button>
        </div>
      </Card>
      <MiniStats items={[["Team size", `${rows.length}`], ["Bookings handled", `${active.reduce((s, r) => s + (r.handled || 0), 0)}`, "good"], ["Revenue (team)", `$${totalRev.toLocaleString()}`, "good"], ["Avg rating", `${avgRating} ★`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Your team")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap a member</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((m, i) => (
            <button key={i} onClick={() => setSel(m)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{m.name[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{m.name}{m.status === "Invited" && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("invited")}</span>}</div><div className="text-[11px] text-g-muted">{m.role}{m.status === "Active" ? ` · ${m.handled} handled · ${m.rating}★` : " · awaiting join"}</div></div>
              {m.status === "Active" && <span className="text-sm font-extrabold text-g-green">${(m.revenue || 0).toLocaleString()}</span>}
            </button>
          ))}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={sel.role}
          badge={<span className={`text-[10px] font-black uppercase ${sel.status === "Active" ? "text-g-green" : "text-g-gold"}`}>{sel.status}</span>}
          fields={sel.status === "Active" ? [["Role", sel.role], ["Bookings handled", sel.handled], ["Revenue (mo.)", `$${(sel.revenue || 0).toLocaleString()}`], ["Rating", `${sel.rating} ★`], ["Status", "Active"]] : [["Role", sel.role], ["Status", "Invited · awaiting join"]]}
          note={sel.status === "Active" ? `The AI assigns work to ${sel.name} based on availability and skills — and flags it to you if they're overloaded.` : "Invite sent — they'll get access once they accept."}
          actions={<><a href={waLink(`Hi ${sel.name}! `)} target="_blank" rel="noopener" className="btn-bright text-sm">💬 Message</a><button onClick={() => { toast(`${sel.name} set as lead ✓`); setSel(null); }} className="btn-ghost text-sm">⭐ Make lead</button><button onClick={() => { toast(`Shift scheduled for ${sel.name} ✓`); setSel(null); }} className="btn-ghost text-sm">📅 Schedule shift</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

// Payments & invoicing — the AI sends invoices/payment links and chases unpaid ones.
// Collecting a payment feeds the Guileo Impact ledger.
function Payments({ V }) {
  const rows = [...loadCreated(V.label, "payments"), ...genPayments(V)];
  const [paid, setPaid] = useState([]); // ids marked paid this session
  const [sel, setSel] = useState(null);
  const statusOf = (r) => (paid.includes(r.id) ? "Paid" : r.status);
  const colorOf = (r) => (paid.includes(r.id) ? "#3E9468" : r.color);
  const collected = rows.filter((r) => statusOf(r) === "Paid").reduce((s, r) => s + r.amount, 0);
  const outstanding = rows.filter((r) => statusOf(r) !== "Paid").reduce((s, r) => s + r.amount, 0);
  const markPaid = (r) => { setPaid((p) => [...p, r.id]); logImpact(V.label, `${r.id} paid by ${r.customer}`, r.amount); setSel(null); toast(`${r.id} marked paid ✓ — $${r.amount} logged to Guileo Impact`); };
  const newInvoice = () => { const c = (V.customers || genCustomers(V))[0]; pushCreated(V.label, "payments", { id: `INV-${3000 + (Date.now() % 900)}`, customer: c?.name || "New customer", amount: vnum(V.label, "newinv", 60, 320), status: "Pending", color: "#D6C29A", method: "Payment link", due: "in 3 days" }); toast("Payment link sent ✓ — invoice added"); };
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaCreditCard className="text-g-green" /> Payments & invoicing</div><div className="text-xs text-g-muted mt-0.5">Your AI sends invoices + payment links and chases unpaid ones automatically — you just watch the money land.</div></div>
          <button onClick={newInvoice} className="btn-bright text-sm inline-flex items-center gap-2"><FaPlus size={11} /> New invoice</button>
        </div>
      </Card>
      <MiniStats items={[["Collected", `$${collected.toLocaleString()}`, "good"], ["Outstanding", `$${outstanding.toLocaleString()}`], ["Paid invoices", `${rows.filter((r) => statusOf(r) === "Paid").length}`, "good"], ["Avg. days to pay", `${vnum(V.label, "daystopay", 1, 6)}`]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Invoices & payments")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap to manage</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((r, i) => (
            <button key={i} onClick={() => setSel(r)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
              <span className="text-xs font-bold text-g-light w-20 shrink-0">{r.id}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{r.customer}{r.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("new")}</span>}</div><div className="text-[11px] text-g-muted">{r.method} · {r.due}</div></div>
              <span className="text-sm font-extrabold text-g-word">${r.amount.toLocaleString()}</span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: colorOf(r) + "22", color: colorOf(r) }}>{statusOf(r)}</span>
            </button>
          ))}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={`${sel.id} · ${sel.customer}`}
          subtitle={`${sel.method} · ${sel.due}`}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: colorOf(sel) + "22", color: colorOf(sel) }}>{statusOf(sel)}</span>}
          fields={[["Amount", `$${sel.amount.toLocaleString()}`], ["Method", sel.method], ["Due", sel.due], ["Status", statusOf(sel)]]}
          note={statusOf(sel) === "Paid" ? "Paid & reconciled — logged to your growth." : statusOf(sel) === "Overdue" ? "⚠ Overdue — the AI is sending payment reminders automatically." : "Awaiting payment — the AI follows up until it's settled."}
          actions={statusOf(sel) === "Paid"
            ? <a href={waLink(`Hi ${sel.customer}, thanks for your payment on ${sel.id}!`)} target="_blank" rel="noopener" className="btn-bright text-sm">💬 Thank</a>
            : <><button onClick={() => markPaid(sel)} className="btn-bright text-sm">✓ Mark paid</button><button onClick={() => { toast(`Payment link re-sent to ${sel.customer} ✓`); setSel(null); }} className="btn-ghost text-sm">🔗 Send link</button><button onClick={() => { toast("Reminder sent ✓"); setSel(null); }} className="btn-ghost text-sm">⏰ Remind</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

// Loyalty & referrals — recurring engagement + word-of-mouth growth. Rewards and
// converted referrals feed the Guileo Impact ledger (real growth Guileo drove).
function Loyalty({ V }) {
  const cfg = loyaltyCfg(V);
  const members = genLoyaltyMembers(V);
  const refs = genReferrals(V);
  const [on, setOn] = useState(() => portalApi.loadState(`${V.label}:loyalty`, true));
  useEffect(() => { setOn(portalApi.loadState(`${V.label}:loyalty`, true)); }, [V.label]);
  const flip = () => setOn((o) => { const v = !o; portalApi.saveState(`${V.label}:loyalty`, v); toast(`Loyalty program ${v ? "on ✓" : "off"}`); return v; });
  const [joined, setJoined] = useState([]); // referrals marked joined this session
  const reward = (m) => { logImpact(V.label, `${m.name} redeemed ${cfg.reward}`, 14); toast(`Reward sent to ${m.name} ✓ — logged to Guileo Impact`); };
  const convert = (r, i) => { setJoined((j) => [...j, i]); logImpact(V.label, `Referral from ${r.name} joined`, r.reward * 6); toast(`Referral converted ✓ — $${r.reward * 6} new-customer value logged to Guileo Impact`); };
  const copyLink = () => { try { navigator.clipboard?.writeText(`https://refer.guileo.ai/${V.label.toLowerCase().replace(/\W+/g, "")}`); } catch { /* blocked */ } toast("Referral link copied ✓"); };
  const tierColor = (t) => (t === "Gold" ? "#D4A520" : t === "Silver" ? "#9ca3af" : "#B0764A");
  const [cards, setCards] = useState(() => loadCreated(V.label, "giftcards"));
  useEffect(() => { setCards(loadCreated(V.label, "giftcards")); }, [V.label]);
  const sellGift = (amt) => { pushCreated(V.label, "giftcards", { code: `GC-${1000 + (Date.now() % 9000)}`, balance: amt, original: amt }); setCards(loadCreated(V.label, "giftcards")); logImpact(V.label, `Gift card sold ($${amt})`, amt); toast(`$${amt} gift card sold ✓ — logged to Guileo Impact`); };
  const redeem = (code, amt) => { const next = cards.map((c) => (c.code === code ? { ...c, balance: Math.max(0, c.balance - amt) } : c)); portalApi.saveState(createdKey(V.label, "giftcards"), next); setCards(next); toast(`$${amt} redeemed from ${code} ✓`); };
  const liveBalance = cards.reduce((s, c) => s + (c.balance || 0), 0);

  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaGift className="text-g-gold" /> Loyalty & referrals</div><div className="text-xs text-g-muted mt-0.5">Earn rule: {cfg.earn} · Reward: {cfg.reward}. Your AI enrolls, reminds and rewards automatically.</div></div>
          <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-g-muted">{on ? "Active" : "Off"}</span><Toggle on={on} onClick={flip} /></div>
        </div>
      </Card>

      <MiniStats items={[["Members", `${members.length * 86}`], [`${cfg.unit} outstanding`, vnum(V.label, "ptsout", 4000, 24000).toLocaleString()], ["Redemptions", `${vnum(V.label, "redeem", 12, 60)}`, "good"], ["Referral revenue", `$${vnum(V.label, "refrev", 600, 3400).toLocaleString()}`, "good"]]} />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Loyalty members */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Top members")}</div>
          <div className="divide-y divide-white/[0.06]">
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{m.name[0]}</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{m.name}<span className="text-[9px] font-black uppercase rounded px-1.5 py-0.5" style={{ background: tierColor(m.tier) + "22", color: tierColor(m.tier) }}>{m.tier}</span></div><div className="text-[11px] text-g-muted">{m.pts.toLocaleString()} {cfg.unit}</div></div>
                <button onClick={() => reward(m)} className="text-[11px] font-bold rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-3 py-1.5 text-g-gold hover:bg-g-gold/[0.16] transition">{tr("🎁 Reward")}</button>
              </div>
            ))}
          </div>
        </Card>

        {/* Referrals */}
        <Card className="p-0 overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2"><FaUserPlus size={11} /> Referrals</div>
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 rounded-xl2 border border-white/12 bg-black/20 px-3 py-2">
              <span className="flex-1 min-w-0 text-[11px] text-g-muted truncate">refer.guileo.ai/{V.label.toLowerCase().replace(/\W+/g, "")}</span>
              <button onClick={copyLink} className="text-[11px] font-bold text-g-gold hover:text-g-word transition shrink-0">{tr("Copy link")}</button>
            </div>
            <div className="mt-1.5 text-[10px] text-g-muted">Each friend who joins earns both sides {cfg.reward}.</div>
          </div>
          <div className="divide-y divide-white/[0.06] flex-1">
            {refs.map((r, i) => {
              const isJoined = r.status === "Joined" || joined.includes(i);
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-base">{isJoined ? "🎉" : "✉️"}</span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted truncate">{isJoined ? "referred a friend who joined" : r.note}</div></div>
                  {isJoined
                    ? <span className="text-[10px] font-black uppercase text-g-green">Joined</span>
                    : <button onClick={() => convert(r, i)} className="text-[11px] font-bold rounded-full border border-g-green/40 bg-g-green/[0.1] px-2.5 py-1 text-g-green hover:bg-g-green/20 transition">Mark joined</button>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Gift cards — instant prepaid revenue, sold by the AI on chat/checkout */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2"><FaGift size={11} /> Gift cards</div>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Active balance", `$${(vnum(V.label, "giftbal", 800, 5200) + liveBalance).toLocaleString()}`], ["Sold this month", `${vnum(V.label, "giftsold", 8, 40) + cards.length}`], ["Cards live", `${cards.length}`]].map(([l, v]) => (
              <div key={l} className="rounded-xl2 border border-white/10 bg-white/[0.03] px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-g-muted">{l}</div><div className="text-base font-extrabold text-g-word mt-0.5">{v}</div></div>
            ))}
          </div>
          <div className="flex-1 min-w-[180px]">
            <div className="text-[11px] text-g-muted mb-1.5">Sell a gift card — the AI delivers it instantly on WhatsApp or at checkout.</div>
            <div className="flex flex-wrap gap-2">{[25, 50, 100].map((amt) => (<button key={amt} onClick={() => sellGift(amt)} className="text-sm font-bold rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-4 py-1.5 text-g-gold hover:bg-g-gold/[0.16] transition">Sell ${amt}</button>))}</div>
          </div>
        </div>
        {cards.length > 0 && (
          <div className="border-t border-white/[0.06] divide-y divide-white/[0.05]">
            {cards.map((c) => (
              <div key={c.code} className="flex items-center gap-3 px-5 py-2.5">
                <span className="font-mono text-[11px] text-g-muted">{c.code}</span>
                <div className="flex-1 min-w-0"><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green" style={{ width: `${(c.balance / c.original) * 100}%` }} /></div></div>
                <span className="text-xs font-bold text-g-word whitespace-nowrap">${c.balance} <span className="text-g-muted font-normal">/ ${c.original}</span></span>
                <button disabled={c.balance <= 0} onClick={() => redeem(c.code, Math.min(c.balance, 10))} className="text-[11px] font-bold rounded-full border border-white/12 px-2.5 py-1 text-g-word hover:border-g-gold/40 disabled:opacity-30 transition">Redeem $10</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function GuileoImpact({ V }) {
  const d = genImpact(V);
  const created = loadCreated(V.label, "impact"); // events logged from operational actions
  const events = [...created.map((e) => [e.t, e.what, e.amt]), ...d.events];
  const extra = created.reduce((s, e) => s + (e.amt || 0), 0);
  const total = d.total + extra;
  const share = Math.round((total * d.sharePct) / 100);
  return (
    <div className="space-y-4 stagger">
      <Card className="relative overflow-hidden bg-gradient-to-br from-g-green/[0.12] to-g-gold/[0.06] border-g-green/30">
        <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-g-green/15 blur-3xl pointer-events-none animate-aurora" />
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Growth Guileo drove · this month")}</div>
          <div className="text-4xl sm:text-5xl font-black text-g-word tracking-tight mt-1"><Count key={total} to={total} prefix="$" /></div>
          <div className="mt-2.5 flex flex-wrap gap-2">{d.parts.map(([label, val]) => (<span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold"><span className="text-g-green">{val}</span><span className="text-g-muted">{label}</span></span>))}</div>
        </div>
      </Card>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Growth ledger · every $ the AI generated")}</div>
          <div className="divide-y divide-white/[0.06]">{events.map(([t, what, amt], i) => (<div key={i} className="flex items-center gap-3 px-5 py-3"><span className="grid place-items-center h-8 w-8 rounded-full bg-g-green/15 text-g-green text-sm font-black">＋</span><div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{what}</div><div className="text-[11px] text-g-muted">{t === "now" ? "just now" : `${t} ago`}</div></div><span className="text-sm font-extrabold text-g-green">+${amt}</span></div>))}</div>
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">{tr("Partnership")}</div>
          <div className="text-sm text-g-muted">You grew <b className="text-g-word">${total.toLocaleString()}</b> with Guileo this month.</div>
          <div className="mt-3 rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] p-3">
            <div className="text-[10px] uppercase tracking-wide text-g-gold font-bold">Guileo's share · {d.sharePct}% of growth</div>
            <div className="text-2xl font-extrabold text-g-word mt-1">${share.toLocaleString()}</div>
            <div className="text-[11px] text-g-muted mt-0.5">You keep ${(total - share).toLocaleString()} — we only win when you win.</div>
            <button onClick={() => {
              const lines = [["Date", "Growth event", "Amount"], ...events.map(([t, what, amt]) => [t === "now" ? "just now" : `${t} ago`, what, `$${amt}`]), ["", "Total growth", `$${total}`], ["", `Guileo share (${d.sharePct}%)`, `$${share}`], ["", "You keep", `$${total - share}`]];
              const csv = lines.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
              const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              const a = document.createElement("a"); a.href = url; a.download = `guileo-growth-statement-${V.label}.csv`; a.click(); URL.revokeObjectURL(url);
              toast("Growth statement downloaded ✓");
            }} className="btn-bright text-sm w-full mt-3 justify-center"><FaDownload size={11} /> Download statement</button>
          </div>
          <div className="mt-3"><Bars data={V.revenue} /></div>
        </Card>
      </div>
    </div>
  );
}

function Followups({ V }) {
  const rows = genFollowups(V);
  const [done, setDone] = useState(() => portalApi.loadState(`${V.label}:fups`, []));
  const [sel, setSel] = useState(null);
  useEffect(() => { setDone(portalApi.loadState(`${V.label}:fups`, [])); }, [V.label]);
  const open = rows.map((r, i) => ({ r, i })).filter(({ i }) => !done.includes(i));
  const pipeline = open.reduce((s, { r }) => s + r.value, 0);
  const markWon = (i, name, value) => { setDone((d) => { const n = [...d, i]; portalApi.saveState(`${V.label}:fups`, n); return n; }); logImpact(V.label, `Won back ${name}`, value || 120); setSel(null); toast(`${name} marked won 🎉 — $${value || 120} logged to Guileo Impact`); };
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Active sequences", `${open.length}`], ["Pipeline value", `$${pipeline.toLocaleString()}`], ["Won this week", `${vnum(V.label, "won", 4, 14)}`, "good"], ["Auto-nudged", `${vnum(V.label, "nudge", 18, 44)}`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("The AI is chasing these — so you never lose them")}</div>
        <div className="divide-y divide-white/[0.06]">
          {open.map(({ r, i }) => (
            <button key={i} onClick={() => setSel({ r, i })} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name} <span className="text-g-muted font-normal">· {r.type}</span></div><div className="text-[11px] text-g-muted">via {r.ch} · next: {r.next} · step {r.stage}/3</div></div>
              <span className="text-sm font-extrabold text-g-green">${r.value}</span>
              <div className="flex gap-1.5 shrink-0">
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); toast(`${r.name}: nudge sent`); }} className="text-[10px] font-bold rounded-full border border-white/15 px-2.5 py-1 text-g-word hover:border-g-gold/40 transition cursor-pointer">Nudge</span>
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); markWon(i, r.name, r.value); }} className="text-[10px] font-bold rounded-full bg-g-green/15 border border-g-green/40 px-2.5 py-1 text-g-green cursor-pointer">Won</span>
              </div>
            </button>
          ))}
          {open.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">✅ All caught up — every lead followed up.</div>}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.r.name}
          subtitle={sel.r.type}
          badge={<span className="text-sm font-extrabold text-g-green">${sel.r.value}</span>}
          fields={[["Type", sel.r.type], ["Channel", sel.r.ch], ["Next touch", sel.r.next], ["Sequence stage", `${sel.r.stage} of 3`], ["Pipeline value", `$${sel.r.value}`]]}
          note={`The AI is running a ${sel.r.stage}-of-3 follow-up sequence via ${sel.r.ch}. It stops automatically the moment they convert or reply.`}
          actions={<><button onClick={() => { toast(`${sel.r.name}: nudge sent`); setSel(null); }} className="btn-bright text-sm">Send nudge now</button><button onClick={() => markWon(sel.i, sel.r.name, sel.r.value)} className="btn-ghost text-sm">🎉 Mark won</button><a href={waLink(`Hi ${sel.r.name}, following up…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Message</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function Waitlist({ V }) {
  const rows = genWaitlist(V);
  const [filled, setFilled] = useState(() => portalApi.loadState(`${V.label}:wait`, []));
  const [sel, setSel] = useState(null);
  useEffect(() => { setFilled(portalApi.loadState(`${V.label}:wait`, [])); }, [V.label]);
  const open = rows.map((r, i) => ({ r, i })).filter(({ i }) => !filled.includes(i));
  // Restaurants book into Live Orders flow; appointment/field sectors have a Schedule.
  const bookView = convoAction(V).view; // "schedule" for most, "liveorders" for restaurant
  const offer = (i, name, want) => {
    setFilled((f) => { const n = [...f, i]; portalApi.saveState(`${V.label}:wait`, n); return n; });
    // Stitch: an accepted waitlist offer becomes a pending booking/reservation in its tab.
    if (bookView === "schedule") {
      pushCreated(V.label, "schedule", { time: "Offered", name, meta: `Waitlist · ${want || "open slot"}`, status: "Pending", ch: "WhatsApp", color: "#D6C29A" });
      setSel(null); toast(`Slot offered to ${name} ✓ — pending booking added to your schedule`);
    } else {
      pushCreated(V.label, "liveorders", { id: `#${1000 + (Date.now() % 9000)}`, customer: name, items: `Reservation · ${want || "table"}`, total: 0, channel: "WhatsApp", status: "New", color: "#3E9468" });
      setSel(null); toast(`Slot offered to ${name} ✓ — reservation added`);
    }
  };
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Waiting now", `${open.length}`], ["Filled today", `${vnum(V.label, "filled", 5, 16)}`, "good"], ["No-shows saved", `${vnum(V.label, "noshow", 3, 11)}`, "good"], ["Revenue recovered", `$${vnum(V.label, "wrev", 800, 2600).toLocaleString()}`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Waitlist · turn empty slots into revenue")}</div>
        <div className="divide-y divide-white/[0.06]">
          {open.map(({ r, i }) => (
            <button key={i} onClick={() => setSel({ r, i })} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{r.name[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted">{r.want} · via {r.ch} · {r.since}</div></div>
              <span onClick={(e) => { e.stopPropagation(); offer(i, r.name, r.want); }} role="button" className="btn-bright text-xs px-3 shrink-0">Offer slot</span>
            </button>
          ))}
          {open.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">No one waiting — capacity is full. 🎉</div>}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.r.name}
          subtitle={`Wants: ${sel.r.want}`}
          fields={[["Looking for", sel.r.want], ["Channel", sel.r.ch], ["Waiting", sel.r.since]]}
          note={`The AI will text ${sel.r.name} the instant a matching slot frees up — first to reply keeps it. No empty chairs, no manual calls.`}
          actions={<><button onClick={() => offer(sel.i, sel.r.name, sel.r.want)} className="btn-bright text-sm">Offer next open slot</button><a href={waLink(`Hi ${sel.r.name}, a slot just opened for ${sel.r.want}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Message</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function Reputation({ V, onNav }) {
  const reviews = genReviews(V);
  const dist = [["5★", 78], ["4★", 15], ["3★", 4], ["2★", 2], ["1★", 1]];
  const [sel, setSel] = useState(null);
  const [reqs, setReqs] = useState(() => loadCreated(V.label, "reviewreq")); // pending review requests
  useEffect(() => { setReqs(loadCreated(V.label, "reviewreq")); }, [V.label]);
  const blast = () => { (V.customers || genCustomers(V)).slice(0, 3).forEach((c) => pushCreated(V.label, "reviewreq", { name: c.name, ch: c.channel })); setReqs(loadCreated(V.label, "reviewreq")); toast("Review blast queued to recent customers ✓"); };
  const boost = (r) => { pushCreated(V.label, "campaigns", { name: `⭐ ${r.name}'s ${r.stars}★ review → ad`, channel: r.ch || "Meta", sent: 0, opened: 0, revenue: 0, status: "Active" }); setSel(null); toast(`Review boosted as an ad ✓ — see it in Campaigns`); onNav?.("campaigns"); };
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Avg rating", `${((46 + vnum(V.label, "rate", 0, 3)) / 10).toFixed(1)} ★`, "good"], ["Reviews this month", `${vnum(V.label, "revc", 40, 140)}`, "good"], ["Requests sent", `${vnum(V.label, "reqs", 200, 420) + reqs.length}`], ["Request → review", `${vnum(V.label, "conv", 24, 38)}%`, "good"]]} />
      {reqs.length > 0 && (
        <Card className="border-g-gold/25 bg-g-gold/[0.05]">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">{tr("⭐ Review requests in flight")}</div>
          <div className="flex flex-wrap gap-2">{reqs.map((r, i) => (<span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word">{r.name} <span className="text-g-muted">· {r.ch || "WhatsApp"} · awaiting</span></span>))}</div>
        </Card>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Rating breakdown")}</div>
          {dist.map(([l, v]) => (<div key={l} className="mb-2 last:mb-0 flex items-center gap-2"><span className="text-xs text-g-muted w-8">{l}</span><div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green" style={{ width: `${v}%` }} /></div><span className="text-[11px] text-g-muted w-8 text-right">{v}%</span></div>))}
          <button onClick={blast} className="btn-bright text-sm w-full mt-4 justify-center">Request reviews now</button>
        </Card>
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent reviews · collected by AI")}</div>
          <div className="divide-y divide-white/[0.06]">{reviews.map((r, i) => (<button key={i} onClick={() => setSel(r)} className="w-full text-left px-5 py-3 hover:bg-white/[0.04] transition"><div className="flex items-center justify-between"><span className="text-sm font-bold text-g-word">{r.name}</span><span className="text-xs text-g-gold">{"★".repeat(r.stars)}<span className="text-g-muted">{"★".repeat(5 - r.stars)}</span></span></div><div className="text-[12px] text-g-muted mt-0.5">"{r.text}" <span className="text-g-light">· {r.ch}</span></div></button>))}</div>
        </Card>
      </div>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.ch} review`}
          badge={<span className="text-xs text-g-gold">{"★".repeat(sel.stars)}</span>}
          fields={[["Rating", `${sel.stars} / 5`], ["Channel", sel.ch], ["Status", "Published"]]}
          note={<>"{sel.text}"<div className="mt-2 text-g-muted">The AI requested this review automatically after a great experience.</div></>}
          actions={<><button onClick={() => { toast("Thanks reply posted ✓"); setSel(null); }} className="btn-bright text-sm">💬 Reply / thank</button>{sel.stars >= 4 && <button onClick={() => boost(sel)} className="btn-ghost text-sm">🚀 Boost as ad</button>}<button onClick={() => { toast("Shared to social ✓"); setSel(null); }} className="btn-ghost text-sm">📣 Share</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function Recurring({ V }) {
  const rows = genRecurring(V);
  const perMo = rows.reduce((s, r) => s + r.value, 0);
  const [sel, setSel] = useState(null);
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Active plans", `${rows.length * 23}`], ["Monthly recurring", `$${(perMo * 23).toLocaleString()}`, "good"], ["Renewals due", `${vnum(V.label, "renew", 4, 14)}`], ["Churn risk", `${vnum(V.label, "churn", 1, 6)}`, "bad"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recurring revenue · the AI keeps it renewing")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap for plan</span></div>
        <div className="divide-y divide-white/[0.06]">{rows.map((r, i) => (<button key={i} onClick={() => setSel(r)} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition"><span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{r.name[0]}</span><div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted">{r.plan} · ${r.value}/mo</div></div><span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: r.color + "22", color: r.color }}>{r.status}</span></button>))}{rows.length === 0 && <Empty icon="🔁" text="No recurring plans yet — offer one to start predictable monthly revenue." />}</div>
      </Card>
      <p className="text-center text-[11px] text-g-muted">Recurring revenue is the most valuable revenue — your AI renews, reminds and rescues it automatically.</p>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={sel.plan}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: sel.color + "22", color: sel.color }}>{sel.status}</span>}
          fields={[["Plan", sel.plan], ["Value", `$${sel.value}/mo`], ["Annual value", `$${(sel.value * 12).toLocaleString()}`], ["Status", sel.status], ["Member since", "Apr 2026"]]}
          note={sel.status === "At risk" ? "⚠ Engagement dropped — the AI is running a win-back sequence to save this plan." : sel.status === "Renews soon" ? "Renewal coming up — the AI will remind and auto-renew." : "Active and healthy — auto-renewing each cycle."}
          actions={<><button onClick={() => { logImpact(V.label, `${sel.name} renewed · ${sel.plan}`, sel.value || 49); toast(`${sel.name} renewed ✓ — $${sel.value || 49} logged to Guileo Impact`); setSel(null); }} className="btn-bright text-sm">↻ Renew now</button>{sel.status === "At risk" && <button onClick={() => { const saved = (sel.value || 49) * 12; logImpact(V.label, `Saved ${sel.name}'s ${sel.plan} (win-back)`, saved); toast(`Win-back run ✓ — $${saved.toLocaleString()}/yr saved, logged to Guileo Impact`); setSel(null); }} className="btn-ghost text-sm">🛟 Run win-back</button>}<a href={waLink(`Hi ${sel.name}, about your ${sel.plan}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Message</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Onboarding wizard (first run) ───────────────────────── */
// First-run welcome tour — shows once (localStorage), highlights the differentiators.
function Tour({ onDone }) {
  const steps = [
    { ic: "💬", title: "One unified inbox", text: "Every call, WhatsApp, SMS and social DM lands in one place — and from any of them you fire an order or booking that drops into the right tab." },
    { ic: "🧠", title: "Train your AI — live", text: "Teach your AI in plain words and test it instantly. What you add, it uses on the very next customer." },
    { ic: "💰", title: "Guileo Impact", text: "Every order, booking, delivery and win-back feeds a live growth ledger — the exact number Guileo earns its % on. Fully transparent." },
    { ic: "⚡", title: "Run anything with ⌘K", text: "Press ⌘K (or Ctrl-K) anywhere to search or run a command — create an order, send an invoice, request reviews." },
  ];
  const [i, setI] = useState(0);
  const last = i >= steps.length - 1;
  const s = steps[Math.min(i, steps.length - 1)]; // guard against rapid double-clicks
  const advance = () => { if (last) onDone(); else setI((x) => Math.min(x + 1, steps.length - 1)); };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-5 bg-black/55 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-md rounded-xl3 border border-white/12 bg-g-cream/95 backdrop-blur-xl p-7 shadow-lift text-center">
        <div className="flex gap-1.5 mb-5 justify-center">{steps.map((_, k) => <div key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-g-green" : "w-1.5 bg-white/15"}`} />)}</div>
        <div className="text-5xl mb-3">{s.ic}</div>
        <div className="text-lg font-extrabold text-g-word">{s.title}</div>
        <p className="text-sm text-g-muted mt-2 leading-relaxed">{s.text}</p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={onDone} className="text-[11px] font-bold text-g-muted hover:text-g-word">Skip tour</button>
          <button onClick={advance} className="btn-bright text-sm px-6">{last ? "Got it — let's go →" : "Next →"}</button>
        </div>
      </motion.div>
    </div>
  );
}

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
            <button onClick={() => onDone(vid, { name: name.trim() })} className="btn-bright text-sm w-full mt-5">Enter my cockpit →</button>
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
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("signup");   // signup | signin (real backend only)
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const res = CONNECTED
        ? (mode === "signup" ? await portalApi.signUp(email, pw) : await portalApi.login(email, pw))
        : await portalApi.login(email, pw);
      if (res?.error) { setErr(res.error); setBusy(false); }
      else if (res?.confirm) { setConfirm(true); setBusy(false); }
      else onEnter();
    } catch (e) { setErr(String(e?.message || e)); setBusy(false); }
  };
  const demoEnter = () => { try { localStorage.setItem("guileo_portal_session", JSON.stringify({ email: "demo@guileo.ai", name: "Jane Staff", role: "Staff", demo: true, at: Date.now() })); } catch { /* */ } onEnter(); };
  return (
    <div className="min-h-screen grid place-items-center px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-xl3 border border-white/12 bg-white/[0.04] backdrop-blur-xl p-8 shadow-lift text-center">
        <img src={logo} alt="Guileo" className="h-12 w-12 object-contain mx-auto" />
        <div className="mt-3 text-xl font-black uppercase tracking-tight bg-gradient-to-r from-g-green via-g-gold to-g-green bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">Growth Cockpit</div>
        {confirm ? (
          <div className="mt-6">
            <div className="text-3xl mb-2">📬</div>
            <div className="text-sm font-extrabold text-g-word">Confirm your email</div>
            <p className="text-xs text-g-muted mt-1">We sent a confirmation to <span className="text-g-light font-semibold">{email}</span>. Click the link, then come back and sign in.</p>
            <button onClick={() => { setConfirm(false); setMode("signin"); }} className="mt-4 btn-bright text-sm w-full">I confirmed — sign in →</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-g-muted mt-1">{CONNECTED ? (mode === "signup" ? "Create your account" : "Welcome back") : "Sign in to your private dashboard"}</p>
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-6 space-y-2.5 text-left">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
              <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={CONNECTED ? "Password (min 6 chars)" : "Password"} className="w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
              <button disabled={busy} className="btn-bright text-sm w-full disabled:opacity-70">{busy ? "…" : (CONNECTED ? (mode === "signup" ? "Create account →" : "Sign in →") : "Enter Growth Cockpit →")}</button>
              {err && <div className="text-[11px] text-red-400 text-center">{err}</div>}
            </form>
            {CONNECTED && (
              <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(""); }} className="mt-3 text-xs font-bold text-g-gold hover:underline">
                {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
            )}
            <button onClick={demoEnter} disabled={busy} className="block mx-auto mt-3 text-xs font-bold text-g-muted hover:text-g-word disabled:opacity-60">{tr("▶ Enter demo (sample data)")}</button>
          </>
        )}
        <div className="mt-4 text-[11px] text-g-muted"><a href="/" className="hover:text-g-word">← Back to guileo.ai</a></div>
      </motion.div>
    </div>
  );
}

// ── Gui — the in-portal AI assistant that EXECUTES tasks ──
// Interprets a request and runs the matching action (reusing the same stitches the
// rest of the app uses), so "send an invoice" actually creates one in Payments.
// Proactive radar: scan real generated data for things that need action right now.
// Returns prioritized alerts with a one-tap command + bilingual copy. Drives the
// launcher badge and Gui's opening nudge — Gui surfaces money on the table unasked.
function guiAlerts(V) {
  const out = [];
  const credits = portalApi.loadState("gui_credits", 250);
  if (credits < 50) out.push({ key: "lowcredit", count: 0, cmd: "open billing", en: `Gui credits are low (${credits} left) — top up so I never pause mid-task.`, pt: `Seus créditos do Gui estão baixos (${credits}) — recarregue pra eu não parar no meio.`, chipEn: "⚡ Top up", chipPt: "⚡ Recarregar" });
  const overdue = genPayments(V).filter((p) => p.status === "Overdue");
  if (overdue.length) out.push({ key: "overdue", count: overdue.length, cmd: "remind all overdue invoices", en: `${overdue.length} invoice${overdue.length !== 1 ? "s" : ""} overdue — want me to chase them?`, pt: `${overdue.length} fatura${overdue.length !== 1 ? "s" : ""} atrasada${overdue.length !== 1 ? "s" : ""} — quer que eu cobre?`, chipEn: "💳 Chase them", chipPt: "💳 Cobrar agora" });
  const waiting = genWaitlist(V).length;
  if (waiting) out.push({ key: "waitlist", count: waiting, cmd: "request reviews", en: `${waiting} people are on your waitlist — fill those slots before they leave.`, pt: `${waiting} pessoas na sua lista de espera — preencha essas vagas antes que saiam.`, chipEn: "📅 Fill slots", chipPt: "📅 Preencher vagas" });
  const follow = genFollowups(V).length;
  if (follow) out.push({ key: "followups", count: follow, cmd: "start follow-ups", en: `${follow} warm lead${follow !== 1 ? "s" : ""} waiting on a follow-up — I can nudge them now.`, pt: `${follow} lead${follow !== 1 ? "s" : ""} quente${follow !== 1 ? "s" : ""} esperando follow-up — posso cutucar agora.`, chipEn: "🔁 Nudge them", chipPt: "🔁 Cutucar" });
  // Suggest a missing high-value connection (count 0 — a suggestion, not an urgent count).
  const m = missingConnection(V);
  if (m) out.push({ key: "connect", count: 0, cmd: "open integrations", en: `${m[0]} isn't connected yet — link it and I'll ${m[3].toLowerCase()}.`, pt: `${m[0]} ainda não está conectado — conecte e eu ${m[4].toLowerCase()}.`, chipEn: "🔌 Connect it", chipPt: "🔌 Conectar" });
  return out;
}
// The most valuable tool the business hasn't connected yet (industry tool first, else a universal one).
function missingConnection(V) {
  const stack = portalApi.loadState(`${V.label}:stack`, {});
  const off = ([n, , , , , def]) => (stack[n] === undefined ? !def : !stack[n]);
  const sector = SECTOR_STACK[V.label] || [];
  return sector.find(off) || null;
}
function guiPlan(text, V, ctx = {}) {
  const s = text.toLowerCase();
  const act = convoAction(V);
  const customers = (V.customers || genCustomers(V));
  const named = customers.find((c) => s.includes((c.name || "").toLowerCase()));
  const pronoun = /\b(them|her|him|they|that customer|same one|ele|ela|esse cliente|essa cliente|o mesmo|a mesma)\b/.test(s);
  const who = named ? named.name : (pronoun && ctx.customer) ? ctx.customer : null;
  const target = who || customers[0]?.name || "New customer";
  const C = (cust) => ({ ...ctx, customer: cust });        // carry the customer forward in memory
  const forTxt = who ? ` for ${target}` : "";
  // Bilingual: detect Portuguese from the message (accents + PT verbs/nouns) and answer in the user's language.
  const pt = /[ãõçáàâéêíóôú]|\b(cobr|fatur|entreg|agend|marc|reserv|avali|promo|an[úu]nci|cliente|atrasad|envi|mand|cria|fa[çc]a?|obrigad|todos|meu|minha|quero|pedido|desfaz|por favor|preciso|manda)/i.test(text);
  const L = (en, ptStr) => (pt ? ptStr : en);
  const forPt = who ? ` para ${target}` : "";
  // undo a record-creating action: returns a closure that drops the created rows + navigates to show it
  const undoer = (rows, nav) => (onNav) => { rows.forEach((r) => removeCreated(V.label, r.view, r.id)); onNav?.(nav); };
  // is a stack tool connected? (Integrations hub persists to :stack)
  const stack = portalApi.loadState(`${V.label}:stack`, {});
  const connected = (name) => stack[name] !== false; // default-on if never toggled
  // R2 — explainability: Gui justifies its suggestions from the real data it sees.
  if (/\b(why|por\s?que|por\s?qu[êe]|explain|explica|explique|motivo|reason)\b/.test(s)) {
    const al = guiAlerts(V);
    const top = al[0];
    const because = top ? L(`Because I'm watching your live data: ${top.en} That's money on the table, so I flag it first. I rank actions by $ at risk × how fast they decay — overdue invoices and empty slots lose value by the hour.`, `Porque estou de olho nos seus dados ao vivo: ${top.pt} Isso é dinheiro na mesa, então priorizo. Eu ranqueio ações por $ em risco × velocidade que perdem valor — faturas atrasadas e vagas vazias perdem valor a cada hora.`) : L("I base every suggestion on your live numbers — bookings, unpaid invoices, at-risk customers and quiet hours — and rank them by the revenue at stake. Right now things look healthy.", "Eu baseio cada sugestão nos seus números ao vivo — agendamentos, faturas em aberto, clientes em risco e horários vazios — e ranqueio pela receita em jogo. Agora está tudo saudável.");
    return { cost: 0, ctx, reply: because };
  }
  // R5 — act ACROSS the connected stack (the differentiator).
  if (/(instagram|\bpost\b|publica|story|stories|\bfeed\b|social)/.test(s)) { const ok = connected("Instagram"); return { cost: ok ? 5 : 0, ctx, reply: ok ? L("Posted ✓ — your AI scheduled an on-brand post to Instagram & Facebook, timed for when your audience is most active. It's in Social.", "Publicado ✓ — sua IA agendou um post na cara da marca pro Instagram e Facebook, na hora de pico do seu público. Está em Social.") : L("Instagram isn't connected yet — connect it in Integrations and I'll post for you.", "O Instagram ainda não está conectado — conecte em Integrações que eu publico por você."), next: ok ? undefined : [{ label: L("🔌 Open Integrations", "🔌 Abrir Integrações"), cmd: "open integrations" }], run: (onNav) => onNav?.(ok ? "social" : "integrations") }; }
  if (/(quickbooks|accounting|contabil|sync.*(book|nota)|nota fiscal|bookkeep)/.test(s)) { const ok = connected("QuickBooks"); return { cost: ok ? 3 : 0, ctx, reply: ok ? L("Synced ✓ — every sale and invoice is flowing into QuickBooks automatically. Your books stay current with zero data entry.", "Sincronizado ✓ — cada venda e fatura entra no QuickBooks automaticamente. Sua contabilidade fica em dia sem digitar nada.") : L("QuickBooks isn't connected — connect it in Integrations and I'll keep your books in sync.", "O QuickBooks não está conectado — conecte em Integrações que eu mantenho a contabilidade sincronizada."), next: ok ? undefined : [{ label: L("🔌 Open Integrations", "🔌 Abrir Integrações"), cmd: "open integrations" }], run: (onNav) => onNav?.(ok ? "payments" : "integrations") }; }
  if (/(integration|integra[çc]|connect|conect|stack|my tools|minhas ferramentas)/.test(s)) return { cost: 0, ctx, reply: L("Here's your connected stack — toggle any tool and I start acting through it.", "Aqui está seu stack conectado — ligue qualquer ferramenta e eu começo a agir através dela."), run: (onNav) => onNav?.("integrations") };
  if (/(open|go to|abrir?|ver)\s+(overview|home|in[íi]cio|dashboard|automa)/.test(s)) return { cost: 0, ctx, reply: L("Here's your Overview — your automations and weekly recap are here.", "Aqui está seu Overview — suas automações e o resumo da semana estão aqui."), run: (onNav) => onNav?.("overview") };
  if (/(billing|cobran|plano|fatur.*plano|top.?up|recarregar|recarga|cr[ée]dito)/.test(s)) return { cost: 0, ctx, reply: L("Opening Billing — top up your Gui credits and manage your plan here.", "Abrindo Plano e cobrança — recarregue seus créditos do Gui e gerencie o plano aqui."), run: (onNav) => onNav?.("billing") };
  // R3 — recurring automations: "every Monday chase overdue", "toda semana peça avaliações".
  if (/\b(every|each|always|recurring|weekly|daily|automat|toda|todo|todas|todos|sempre|cada|recorrente|autom[áa]tic)/.test(s) && /(chase|overdue|remind|cobr|invoice|fatur|review|avali|promo|campaign|follow|nudge|post|instagram|social|report|resumo|recap)/.test(s)) {
    const day = /(monday|segunda)/.test(s) ? L("every Monday", "toda segunda") : /(friday|sexta)/.test(s) ? L("every Friday", "toda sexta") : /(daily|every day|todo dia|diari)/.test(s) ? L("every day", "todo dia") : /(month|m[êe]s)/.test(s) ? L("monthly", "todo mês") : L("every week", "toda semana");
    let what, ic;
    if (/(chase|overdue|remind|cobr|invoice|fatur)/.test(s)) { what = L("chase overdue invoices", "cobrar faturas atrasadas"); ic = "💳"; }
    else if (/(review|avali)/.test(s)) { what = L("request reviews from happy customers", "pedir avaliações aos clientes felizes"); ic = "⭐"; }
    else if (/(promo|campaign)/.test(s)) { what = L("launch a promo to quiet days", "lançar promoção nos dias parados"); ic = "📣"; }
    else if (/(follow|nudge)/.test(s)) { what = L("nudge warm leads with a follow-up", "cutucar leads quentes com follow-up"); ic = "🔁"; }
    else if (/(post|instagram|social)/.test(s)) { what = L("post to Instagram & Facebook", "postar no Instagram e Facebook"); ic = "📸"; }
    else { what = L("send you a recap", "te mandar um resumo"); ic = "📊"; }
    const when = day.charAt(0).toUpperCase() + day.slice(1);
    return { cost: 3, ctx, reply: L(`Set ✓ — from now on I'll ${what} ${day}, automatically. It's on your Overview under Automations, where you can pause it anytime.`, `Pronto ✓ — de agora em diante eu vou ${what} ${day}, automaticamente. Está no seu Overview em Automações, onde você pausa quando quiser.`), next: [{ label: L("⚙️ See automations", "⚙️ Ver automações"), cmd: "open overview" }], run: (onNav) => { addAutomation(V.label, { what: what.charAt(0).toUpperCase() + what.slice(1), when, ic }); onNav?.("overview"); } };
  }
  if (/(remind|chase|collect all|chase all|overdue|atrasad|cobrar todos|all unpaid)/.test(s)) { const open = genPayments(V).filter((p) => p.status !== "Paid"); return { cost: 5, ctx, reply: L(`Done ✓ — I sent payment reminders to ${open.length} customer${open.length !== 1 ? "s" : ""} with open invoices. They're in Payments.`, `Pronto ✓ — enviei lembretes de pagamento para ${open.length} cliente${open.length !== 1 ? "s" : ""} com faturas em aberto. Estão em Pagamentos.`), next: [{ label: L("⭐ Ask them for reviews too", "⭐ Pedir avaliações também"), cmd: "request reviews from my recent customers" }], run: (onNav) => onNav?.("payments") }; }
  if (/(invoice|charge|bill|cobr|fatur|payment|receb)/.test(s)) return { cost: 5, ctx: C(target), reply: L(`Done ✓ — invoice sent to ${target} with a payment link, tracked in Payments. I'll chase it until it's paid.`, `Pronto ✓ — fatura enviada para ${target} com link de pagamento, registrada em Pagamentos. Eu cobro até ser paga.`), next: [{ label: L(`📅 Book ${target} too`, `📅 Agendar ${target} também`), cmd: `book them` }, { label: L("⭐ Request a review", "⭐ Pedir avaliação"), cmd: `request a review from them` }], run: (onNav) => { const id = pushCreated(V.label, "payments", { id: `INV-${3000 + (Date.now() % 900)}`, customer: target, amount: vnum(V.label, "guiinv", 60, 320), status: "Pending", color: "#D6C29A", method: "Payment link", due: "in 3 days" }); onNav?.("payments"); return undoer([{ view: "payments", id }], "payments"); } };
  if (/(review|avalia|rating|estrela)/.test(s)) return { cost: 5, ctx: C(who || ctx.customer), reply: L(`On it ✓ — I queued review requests${who ? ` to ${target}` : " to your happiest recent customers"}. Tracked in Reputation.`, `Feito ✓ — enviei pedidos de avaliação${who ? ` para ${target}` : " aos seus clientes mais satisfeitos"}. Registrado em Reputação.`), next: [{ label: L("📣 Turn 5★ reviews into ads", "📣 Virar avaliações 5★ em anúncios"), cmd: "launch a promo" }], run: (onNav) => { const rows = (who ? [{ name: target, channel: "WhatsApp" }] : customers.slice(0, 3)).map((c) => ({ view: "reviewreq", id: pushCreated(V.label, "reviewreq", { name: c.name, ch: c.channel }) })); onNav?.("reputation"); return undoer(rows, "reputation"); } };
  if (/(deliver|entrega|dispatch|despach)/.test(s)) return { cost: 5, ctx: C(who || ctx.customer), reply: L(`Done ✓ — sent${forTxt} to ${deliveryTab(V).toLowerCase()}. I'll text live updates.`, `Pronto ✓ — enviado${forPt} para ${deliveryTab(V).toLowerCase()}. Vou mandar atualizações ao vivo.`), next: [{ label: L("⭐ Ask for a review on arrival", "⭐ Pedir avaliação na entrega"), cmd: `request a review from them` }], run: (onNav) => { const id = pushCreated(V.label, "deliveries", recordFor("deliveries", target, "Gui", V)); onNav?.("deliveries"); return undoer([{ view: "deliveries", id }], "deliveries"); } };
  if (/(campaign|promo|an[úu]nci|\bad\b|marketing)/.test(s)) return { cost: 5, ctx, reply: L("Launched ✓ — a promo is live and the AI will optimize it. It's in Campaigns.", "Lançado ✓ — uma promoção está no ar e a IA vai otimizá-la. Está em Campanhas."), next: [{ label: L("👥 Build an audience for it", "👥 Criar um público pra ela"), cmd: "build an audience from my best customers" }], run: (onNav) => { const id = pushCreated(V.label, "campaigns", { name: "Gui promo", channel: "Email", sent: 0, opened: 0, revenue: 0, status: "Active" }); onNav?.("campaigns"); return undoer([{ view: "campaigns", id }], "campaigns"); } };
  if (/(order|pedido|book|appointment|agend|marcar|reserv|schedule)/.test(s)) return { cost: 5, ctx: C(target), reply: L(`${act.done}${forTxt} ✓ — it's in the right tab now.`, `${act.done}${forPt} ✓ — já está na aba certa.`), next: [{ label: L("💳 Send the invoice too", "💳 Enviar a fatura também"), cmd: `send an invoice to them` }], run: (onNav) => { const rec = recordFor(act.view, target, "Gui", V); const id = rec ? pushCreated(V.label, act.view, rec) : null; onNav?.(act.view); return id ? undoer([{ view: act.view, id }], act.view) : undefined; } };
  if (/(follow|nudge|win-?back|lapse|reativ)/.test(s)) return { cost: 3, ctx, reply: L("Done ✓ — I started a follow-up sequence. Check the Follow-ups tab.", "Pronto ✓ — iniciei uma sequência de follow-up. Veja na aba Follow-ups."), run: (onNav) => onNav?.("followups") };
  if (/(audience|p[úu]blico|segment)/.test(s)) return { cost: 5, ctx, reply: L("Built ✓ — an audience of your most engaged customers is ready in Ad Audiences.", "Pronto ✓ — um público com seus clientes mais engajados está pronto em Públicos de Anúncio."), run: (onNav) => { const id = pushCreated(V.label, "audiences", { name: "Gui · best customers", size: vnum(V.label, "guiaud", 1200, 9000), source: "CRM" }); onNav?.("audiences"); return undoer([{ view: "audiences", id }], "audiences"); } };
  if (/(hour|open|close|price|cost|where|location|menu|service)/.test(s)) { const kb = portalApi.loadKB(V.label, seedKB(V, portalApi.loadProfile(V.label, defProfile(V)))); return { cost: 1, ctx, reply: aiAnswer(text, V, kb) }; }
  return { cost: 0, ctx, reply: L("I can create orders & bookings, send invoices, request reviews, launch promos, start follow-ups, build audiences, or push to delivery. Try: \"send an invoice to my top customer\" — then \"book them too\".", "Eu crio pedidos e agendamentos, envio faturas, peço avaliações, lanço promoções, inicio follow-ups, monto públicos ou mando pra entrega. Tente: \"manda uma fatura pro meu melhor cliente\" — depois \"agenda ele também\"."), next: [{ label: L("💳 Send an invoice", "💳 Enviar fatura"), cmd: "send an invoice to my top customer" }, { label: L("⭐ Request reviews", "⭐ Pedir avaliações"), cmd: "request reviews" }, { label: L("📣 Launch a promo", "📣 Lançar promoção"), cmd: "launch a promo" }] };
}
function Gui({ V, onNav }) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(() => portalApi.loadState("gui_credits", 250));
  const alerts = useMemo(() => guiAlerts(V), [V]);     // proactive radar — real pending items
  const alertCount = alerts.reduce((n, a) => n + (a.count || 0), 0);
  const [msgs, setMsgs] = useState(() => {
    const base = [
      { from: "gui", text: "Hi! I'm Gui — your AI assistant 👋 Tell me what to do and I'll handle it." },
      { from: "gui", text: `Quick read on today: ${dailyBriefing(V)}. Want me to get started?` },
    ];
    const al = guiAlerts(V);
    if (al.length) base.push({ from: "gui", text: `👀 Heads up — ${al[0].en}`, next: al.slice(0, 2).map((a) => ({ label: a.chipEn, cmd: a.cmd })) });
    return base;
  });
  const [q, setQ] = useState("");
  const [ctx, setCtx] = useState({});            // conversation memory (last customer, etc.)
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState(() => portalApi.loadState("gui_history", []));   // past commands
  const [showHist, setShowHist] = useState(false);
  const lastUndo = useRef(null);                  // undo closure for the most recent action
  const lastPt = useRef(false);                   // language of the last command, for system messages
  useEffect(() => { const h = () => setOpen(true); window.addEventListener("gui:open", h); return () => window.removeEventListener("gui:open", h); }, []);
  useEffect(() => { const h = () => setCredits(portalApi.loadState("gui_credits", 250)); window.addEventListener("gui:credits", h); return () => window.removeEventListener("gui:credits", h); }, []);
  const setC = (n) => { setCredits(n); portalApi.saveState("gui_credits", n); window.dispatchEvent(new Event("gui:credits")); };
  const recharge = () => { setC(credits + 250); toast("250 credits added ✓ — pay-as-you-go, billed to your account"); };
  const remember = (t) => { setHistory((h) => { const next = [t, ...h.filter((x) => x !== t)].slice(0, 12); portalApi.saveState("gui_history", next); return next; }); };
  const isPt = (t) => /[ãõçáàâéêíóôú]|\b(cobr|fatur|entreg|agend|marc|reserv|avali|promo|cliente|atrasad|envi|mand|cria|fa[çc]a?|desfaz|quero|pedido|preciso)/i.test(t);
  const doUndo = () => {
    const p = lastPt.current;
    if (!lastUndo.current) { setMsgs((m) => [...m, { from: "gui", text: p ? "Nada pra desfazer ainda — só desfaço a última coisa que criei." : "Nothing to undo yet — I'll only undo the last thing I created." }]); return; }
    lastUndo.current(onNav); lastUndo.current = null;
    setMsgs((m) => [...m, { from: "gui", text: p ? "Desfeito ✓ — removi a última coisa que criei. Sem cobrança." : "Undone ✓ — I removed the last thing I created. No charge for that." }]);
  };
  const run = (text) => {
    const t = text.trim(); if (!t) return;
    setShowHist(false); lastPt.current = isPt(t);
    if (/^(undo|desfaz|desfazer|cancela|reverte|revert)/i.test(t)) { setMsgs((m) => [...m, { from: "you", text: t }]); setQ(""); doUndo(); return; }
    setMsgs((m) => [...m, { from: "you", text: t }]); setQ(""); remember(t);
    const res = guiPlan(t, V, ctx);
    if (res.ctx) setCtx(res.ctx);
    if (res.cost > credits) { setMsgs((m) => [...m, { from: "gui", text: lastPt.current ? "Você ficou sem créditos pra essa — recarregue e eu já faço." : "You're out of credits for that one — top up and I'll get right on it.", lowCredit: true }]); return; }
    const undo = res.run ? res.run(onNav) : undefined;
    lastUndo.current = typeof undo === "function" ? undo : null;
    setC(credits - res.cost);
    logUsage(res.cost, t);
    setMsgs((m) => [...m, { from: "gui", text: res.reply, cost: res.cost, next: res.next, canUndo: typeof undo === "function" }]);
  };
  const send = (e) => { e.preventDefault(); run(q); };
  // Voice input via the Web Speech API (graceful no-op where unsupported).
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const dictate = () => {
    if (!SR) { toast("Voice isn't supported in this browser"); return; }
    const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (ev) => { const t = ev.results[0][0].transcript; setQ(t); setListening(false); setTimeout(() => run(t), 200); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };
  const pct = Math.max(0, Math.min(100, Math.round((credits / 250) * 100)));
  const low = credits < 30;
  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label={alertCount ? `Open Gui assistant — ${alertCount} items need action` : "Open Gui assistant"} className="fixed bottom-5 right-5 z-[55] grid place-items-center h-14 w-14 rounded-full bg-gradient-to-br from-g-green to-g-dark text-white shadow-lift hover:scale-105 active:scale-95 transition">
          <FaWandMagicSparkles size={18} />
          {alertCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 grid place-items-center rounded-full bg-g-gold text-[11px] font-black text-black border-2 border-g-deep animate-pulse">{alertCount > 9 ? "9+" : alertCount}</span>
          ) : (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-g-gold border-2 border-g-deep" />
          )}
        </button>
      )}
      {open && (
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="fixed bottom-5 right-5 z-[55] w-[92vw] max-w-sm rounded-xl3 border border-white/12 bg-[#0c100d]/98 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden" style={{ height: "min(78vh, 560px)" }}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2.5 shrink-0">
            <span className="grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-g-green to-g-dark text-white"><FaWandMagicSparkles size={15} /></span>
            <div className="flex-1 min-w-0"><div className="text-sm font-extrabold text-g-word flex items-center gap-1.5">Gui <span className="text-[9px] font-black uppercase text-g-green">· AI assistant</span></div><div className="text-[10px] text-g-muted">Executes tasks for you, 24/7</div></div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-g-muted hover:text-g-word text-lg px-1">✕</button>
          </div>
          {/* credit meter */}
          <div className="px-4 py-2 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center justify-between text-[10px] mb-1"><span className="text-g-muted font-bold uppercase tracking-wide">Credits</span><span className={`font-bold ${low ? "text-red-400" : "text-g-word"}`}>{credits} left</span></div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-gradient-to-r from-g-green to-g-gold"}`} style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-g-muted"><span>Pay-as-you-go · ~5 credits per task</span><button onClick={recharge} className="font-bold text-g-gold hover:underline">{tr("+ Recharge")}</button></div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${m.from === "you" ? "bg-g-gold/15 text-g-word border border-g-gold/30" : "bg-g-green/12 text-g-light border border-g-green/25"}`}>
                  {m.from === "gui" && <div className="text-[9px] font-black uppercase text-g-green mb-0.5">Gui</div>}
                  {m.text}
                  {m.cost > 0 && <span className="ml-1.5 text-[9px] text-g-muted">−{m.cost} cr</span>}
                  {m.lowCredit && <button onClick={recharge} className="block mt-1.5 text-[11px] font-bold text-g-gold hover:underline">{tr("+ Recharge credits")}</button>}
                  {m.canUndo && i === msgs.length - 1 && <button onClick={doUndo} className="block mt-1.5 text-[11px] font-bold text-g-muted hover:text-g-word">↩ Undo this</button>}
                  {m.next && m.next.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">{m.next.map((n) => <button key={n.cmd} onClick={() => run(n.cmd)} className="rounded-full border border-g-gold/30 bg-g-gold/10 px-2.5 py-1 text-[10px] font-bold text-g-gold hover:bg-g-gold/20 transition">{n.label}</button>)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {msgs.length <= 2 && (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5 shrink-0">{["Create an order", "Send an invoice", "Request reviews", "Launch a promo"].map((s) => <button key={s} onClick={() => run(s)} className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-g-muted hover:text-g-word transition">{s}</button>)}</div>
          )}
          {showHist && history.length > 0 && (
            <div className="px-3 pb-1 shrink-0">
              <div className="text-[9px] font-black uppercase text-g-muted mb-1">Recent commands · tap to run again</div>
              <div className="flex flex-wrap gap-1.5">{history.map((h) => <button key={h} onClick={() => run(h)} className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] text-g-light hover:text-g-word hover:border-g-green/40 transition truncate max-w-[180px]">{h}</button>)}</div>
            </div>
          )}
          <form onSubmit={send} className="p-3 border-t border-white/10 flex gap-2 shrink-0">
            {history.length > 0 && <button type="button" onClick={() => setShowHist((v) => !v)} aria-label="Command history" className={`grid place-items-center h-10 w-10 rounded-full border shrink-0 transition ${showHist ? "border-g-green/50 bg-g-green/15 text-g-light" : "border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>↻</button>}
            {SR && <button type="button" onClick={dictate} aria-label="Dictate to Gui" className={`grid place-items-center h-10 w-10 rounded-full border shrink-0 transition ${listening ? "border-red-400 bg-red-500/15 text-red-400 animate-pulse" : "border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>🎙️</button>}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? "Listening…" : "Ask Gui to do something…"} className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
            <button className="btn-bright text-sm px-4">Send</button>
          </form>
          <a href={waLink("Hi Guileo team! I need help")} target="_blank" rel="noopener" className="px-4 pb-3 text-[10px] text-g-muted hover:text-g-word text-center shrink-0">Need a human? Talk to your team →</a>
        </motion.div>
      )}
    </>
  );
}

/* ───────────────────────── Page ───────────────────────── */
export default function Portal() {
  const [authed, setAuthed] = useState(false);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState("overview");
  const [period, setPeriod] = useState("30 days");
  const [lang, setLang] = useState(() => portalApi.loadState("portal_lang", "en"));
  setUiLang(lang); // publish current UI language so tr() works anywhere, no prop threading
  const toggleLang = () => setLang((l) => { const n = l === "pt" ? "en" : "pt"; portalApi.saveState("portal_lang", n); return n; });
  // Vertical can be deep-linked via ?v=<id> (shareable per-sector links) and is remembered.
  const [vertical, setVertical] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("v");
      const saved = portalApi.loadState("vertical", null);
      const pick = q || saved || "restaurant";
      return VERTICALS[pick] ? pick : "restaurant";
    } catch { return "restaurant"; }
  });
  const [vertOpen, setVertOpen] = useState(false);
  const [notifsRead, setNotifsRead] = useState(() => portalApi.loadState(`${vertical}:notifsRead`, false));
  const [bellOpen, setBellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(() => { try { return !!localStorage.getItem("guileo_onboarded"); } catch { return true; } });
  const [tourDone, setTourDone] = useState(() => { try { return !!localStorage.getItem("guileo_tour_done"); } catch { return true; } });
  const finishTour = () => { setTourDone(true); try { localStorage.setItem("guileo_tour_done", "1"); } catch { /* private */ } };
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const s = await portalApi.session();
      if (s) { if (!s.demo) await portalApi.hydrate(); setAuthed(true); }
      setBooting(false);
    })();
    // React to magic-link sign-in (the email link lands back on /portal).
    if (CONNECTED) unsub = portalApi.onAuthChange((sess) => { if (sess) setAuthed(true); else setAuthed(false); });
    return () => unsub();
  }, []);
  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); } if (e.key === "Escape") { setPaletteOpen(false); setNavOpen(false); setBellOpen(false); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  const V = VERTICALS[vertical];
  const sections = sectionsFor(vertical, V);
  const nf = (k) => (notifsRead ? 0 : notifFor(k, V));
  const totalNotif = sections.reduce((s, [k]) => s + nf(k), 0);
  const notifList = notifsRead ? [] : sections.map(([k, l]) => ({ k, l, n: notifFor(k, V) })).filter((x) => x.n > 0);
  const cur = sections.find((s) => s[0] === view);
  const title = view === "operations" ? `${V.label} operations` : (cur ? cur[1] : "Overview");
  const switchVertical = (k) => { setVertical(k); portalApi.saveState("vertical", k); setView("overview"); setVertOpen(false); setNotifsRead(portalApi.loadState(`${k}:notifsRead`, false)); };
  const markAllRead = () => { setNotifsRead(true); portalApi.saveState(`${vertical}:notifsRead`, true); setBellOpen(false); toast("All caught up ✓"); };
  const logout = () => portalApi.logout().then(() => setAuthed(false));
  // Polished, print-ready monthly report (open → Cmd/Ctrl-P → Save as PDF).
  const exportReport = () => {
    const impact = genImpact(V);
    const share = Math.round((impact.total * impact.sharePct) / 100);
    const kpiRows = V.kpis.map((k) => `<tr><td>${k.label}</td><td style="text-align:right;font-weight:700">${k.pre || ""}${k.num.toLocaleString?.() || k.num}${k.suf || ""}</td></tr>`).join("");
    const eventRows = impact.events.map(([t, what, amt]) => `<tr><td>${what}</td><td style="text-align:right;color:#1f9d57;font-weight:700">+$${amt}</td></tr>`).join("");
    // Sector-aware: which of this business's tools Guileo is acting through, + standing automations.
    const stack = portalApi.loadState(`${V.label}:stack`, {});
    const flatTools = genIntegrations(V).flatMap(([, tools]) => tools);
    const liveTools = flatTools.filter(([n, , , , , def]) => (stack[n] === undefined ? !!def : !!stack[n]));
    const toolRows = liveTools.map(([name, , , doesEn]) => `<tr><td><b>${name}</b></td><td class="muted" style="font-size:13px">${doesEn}</td></tr>`).join("");
    const autos = portalApi.loadState(`${V.label}:automations`, []).filter((a) => a.on);
    const autoRows = autos.map((a) => `<tr><td>${a.what}</td><td style="text-align:right" class="muted">${a.when}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Guileo Monthly Report · ${V.business.name}</title><style>
      *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1f1c;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.5}
      h1{font-size:26px;margin:0}.muted{color:#6b7280}.hero{background:linear-gradient(135deg,#e9f6ef,#fbf6e8);border:1px solid #d9e9df;border-radius:16px;padding:24px;margin:20px 0}
      .big{font-size:44px;font-weight:900;letter-spacing:-1px}.share{background:#fff7e6;border:1px solid #f0d99b;border-radius:12px;padding:14px;margin-top:14px}
      table{width:100%;border-collapse:collapse;margin:8px 0 24px}td{padding:9px 4px;border-bottom:1px solid #eee;font-size:14px}h3{margin:24px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#9a7b1f}
      .foot{color:#9ca3af;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:14px}@media print{body{margin:0}}
    </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div><h1>${V.business.name}</h1><div class="muted">${V.business.place} · Monthly growth report</div></div>
        <div style="font-weight:900;color:#1f9d57">GUILEO</div>
      </div>
      <div class="hero"><div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9a7b1f;font-weight:700">Growth Guileo drove this month</div>
        <div class="big">$${impact.total.toLocaleString()}</div>
        <div class="share"><b>Guileo's share · ${impact.sharePct}% of growth: $${share.toLocaleString()}</b><br><span class="muted">You keep $${(impact.total - share).toLocaleString()} — we only win when you win.</span></div>
      </div>
      <h3>Key metrics</h3><table>${kpiRows}</table>
      <h3>Growth ledger</h3><table>${eventRows}<tr><td><b>Total</b></td><td style="text-align:right"><b>$${impact.total.toLocaleString()}</b></td></tr></table>
      <h3>Your connected stack · ${liveTools.length} tools Guileo acts through</h3><table>${toolRows}</table>
      ${autoRows ? `<h3>Automations on autopilot</h3><table>${autoRows}</table>` : ""}
      <div class="foot">Generated by Guileo · ${V.business.name} · This report reflects activity handled by your AI across your connected stack. Tip: print → Save as PDF.</div>
    </body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("Monthly report opened — print → Save as PDF ✓");
  };
  const content = {
    overview: <Overview V={V} onNav={setView} sections={sections} period={period} />,
    deliveries: <Deliveries V={V} />,
    inbox: <Inbox V={V} onNav={setView} />,
    impact: <GuileoImpact V={V} />,
    followups: <Followups V={V} />,
    waitlist: <Waitlist V={V} />,
    recurring: <Recurring V={V} />,
    reputation: <Reputation V={V} onNav={setView} />,
    loyalty: <Loyalty V={V} />,
    payments: <Payments V={V} />,
    team: <Team V={V} />,
    locations: <Locations V={V} />,
    operations: <Operations V={V} />,
    schedule: <ScheduleScreen V={V} />,
    catalog: <CatalogScreen V={V} />,
    social: <SocialInbox V={V} />,
    analytics: <AIAnalytics V={V} onNav={setView} sections={sections} />,
    insights: <AIInsights V={V} onNav={setView} sections={sections} />,
    integrations: <Integrations V={V} onNav={setView} lang={lang} />,
    liveorders: <LiveOrders V={V} />,
    kitchen: <Kitchen V={V} />,
    menu: <MenuView V={V} />,
    customers: <Customers V={V} onNav={setView} />,
    campaigns: <Campaigns V={V} onNav={setView} />,
    audiences: <Audiences V={V} onNav={setView} />,
    calllogs: <CallLogs V={V} onNav={setView} />,
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
  if (!onboarded) return <div className="min-h-screen text-g-ink"><OnboardingWizard onDone={(vid, extra) => {
    setVertical(vid); setView("overview"); setOnboarded(true);
    try { localStorage.setItem("guileo_onboarded", "1"); } catch { /* private */ }
    // Carry the business name from onboarding straight into the profile + AI.
    const OV = VERTICALS[vid];
    if (extra?.name && OV) syncProfile(OV.label, OV, { ...defProfile(OV), name: extra.name });
  }} /></div>;

  return (
    <div className="min-h-screen text-g-ink flex flex-col lg:flex-row">
      {!tourDone && <Tour onDone={finishTour} />}
      {/* Mobile backdrop */}
      {navOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setNavOpen(false)} />}
      {/* Sidebar — slide-over on mobile, static on desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] overflow-y-auto transform transition-transform duration-300 ${navOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto lg:w-60 lg:max-w-none lg:min-h-screen border-r border-white/10 bg-[#070b10]/98 lg:bg-white/[0.03] backdrop-blur-xl lg:sticky lg:top-0 flex flex-col`}>
        <div className="flex items-center gap-2 px-5 py-4">
          <img src={logo} alt="Guileo" className="h-8 w-8 object-contain" />
          <div className="leading-tight flex-1 min-w-0"><div className="text-sm font-extrabold text-g-word">Growth Cockpit</div><div className="text-[10px] text-g-muted truncate">{V.icon} {V.business.name}</div></div>
          <button onClick={() => setNavOpen(false)} className="lg:hidden text-g-muted hover:text-g-word text-lg leading-none px-1" aria-label="Close menu">✕</button>
        </div>
        <nav aria-label="Dashboard sections" className="flex flex-col gap-1 px-3 pb-3 overflow-y-auto">
          {(() => {
            const renderBtn = ([key, label, flag]) => {
              const Icon = SECTION_ICON[key] || FaGaugeHigh;
              const on = view === key;
              const notif = nf(key);
              return (
                <button key={key} onClick={() => { setView(key); setNavOpen(false); }}
                  className={`relative flex items-center gap-3 rounded-xl2 px-3.5 py-2.5 text-sm font-bold whitespace-nowrap transition-colors ${on ? "text-g-word" : "text-g-muted hover:text-g-word"}`}>
                  {on && <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl2 bg-white/[0.07] border border-g-gold/30" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                  <Icon size={15} className="relative" /><span className="relative">{tr(label, lang)}</span>
                  {flag === "soon"
                    ? <span className="relative ml-auto text-[8px] font-black uppercase tracking-wider text-g-gold/90 bg-g-gold/10 rounded px-1 py-0.5">{tr("soon")}</span>
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
              <div key={g || "main"} className="block">
                {g && <div className="px-3.5 pt-3 pb-1 text-[9px] font-bold uppercase tracking-wider text-g-muted/60">{tr(g, lang)}</div>}
                {items.map(renderBtn)}
              </div>
            ));
          })()}
        </nav>
        <div className="block px-4 mt-auto py-4 space-y-3">
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
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setNavOpen(true)} className="lg:hidden grid place-items-center h-9 w-9 rounded-xl border border-white/12 bg-white/[0.04] text-g-word shrink-0" aria-label="Open menu">☰</button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-g-word truncate">{tr(title, lang)}</h1>
              <p className="text-[11px] text-g-muted truncate">{V.business.name} · {V.business.place} · {V.business.since}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setPaletteOpen(true)} className="hidden md:flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-g-muted w-40 hover:border-g-gold/40 transition"><FaMagnifyingGlass size={11} /><span className="truncate">Search… ⌘K</span></button>
            <button onClick={exportReport} className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word hover:border-g-gold/40 transition"><FaDownload size={11} /> {tr("Report", lang)}</button>
            <button onClick={toggleLang} title="Language" aria-label="Toggle language" className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-black text-g-word hover:border-g-gold/40 transition"><span className={lang === "en" ? "text-g-gold" : "text-g-muted"}>EN</span><span className="text-g-muted">·</span><span className={lang === "pt" ? "text-g-gold" : "text-g-muted"}>PT</span></button>
            <div className="relative">
              <button onClick={() => setBellOpen((o) => !o)} className="relative grid place-items-center h-9 w-9 rounded-full border border-white/12 bg-white/[0.04] text-g-muted hover:text-g-word transition" aria-label={`Notifications (${totalNotif})`}><FaBell size={13} />{totalNotif > 0 && <span className="absolute -top-1 -right-1 inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black shadow-[0_0_8px_rgba(239,68,68,0.6)]">{totalNotif}</span>}</button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-xl2 border border-white/12 bg-g-cream/95 backdrop-blur-xl shadow-lift z-30 p-1.5">
                    <div className="flex items-center justify-between px-2.5 py-1.5"><span className="text-[10px] font-bold uppercase tracking-wide text-g-muted">Notifications</span>{totalNotif > 0 && <button onClick={markAllRead} className="text-[10px] font-bold text-g-gold hover:underline">{tr("Mark all read")}</button>}</div>
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

      {/* Gui — the AI assistant that executes tasks (floating, from any view) */}
      <Gui V={V} onNav={setView} />

      {paletteOpen && <Palette V={V} sections={sections} onNav={setView} onClose={() => setPaletteOpen(false)} />}
      <Toaster />
    </div>
  );
}
