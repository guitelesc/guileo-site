import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { portalApi, CONNECTED, toast, onToast, fetchRealData, fetchRealDataDetalhado, loadDataKey, saveDataKey } from "../lib/portalApi.js";
import {
  FaGaugeHigh, FaComments, FaBullhorn, FaUsers, FaHeadset, FaFileLines, FaListCheck,
  FaArrowLeft, FaArrowTrendUp, FaWhatsapp, FaInstagram, FaPhone, FaFacebook, FaTiktok, FaGoogle,
  FaReceipt, FaUtensils, FaBookOpen, FaBullseye, FaPhoneVolume, FaCommentSms, FaGear, FaChartLine,
  FaDownload, FaBell, FaMagnifyingGlass, FaStore, FaBrain, FaCreditCard, FaChevronDown, FaShareNodes, FaGlobe,
  FaArrowsRotate, FaClock, FaStar, FaIdCard, FaTriangleExclamation,
  FaWandMagicSparkles, FaGraduationCap,
  FaTruck, FaLocationDot, FaGift, FaTag, FaBuilding,
  FaPlug, FaStripe, FaShopify, FaSlack, FaEnvelope, FaCalendarDays, FaFileInvoiceDollar, FaMeta, FaGoogleDrive,
  FaFaceSmile,
} from "react-icons/fa6";

/* GuiMark — the Gui presence: the Guileo sprout inside a glowing brass orb. The AI's signature
   icon (orange = Gui). Used wherever Gui appears on the dashboard. Subtle neon-realista glow. */
// The Guileo sprout-in-an-orb. When `progress` (0–1) is passed it GROWS: a champagne→green ring
// fills around the orb with the month's goal, the glow intensifies, and at goal it blooms green +
// gently breathes — the plant literally grows as the business grows. Default (no progress) = unchanged.
export function GuiMark({ size = 36, progress = null, celebrate = false }) {
  const hasProg = Number.isFinite(progress);
  const p = hasProg ? Math.max(0, Math.min(1, progress)) : 0;
  const inner = hasProg ? size - 5 : size;
  const s = Math.round(inner * 0.5);
  const glow = 12 + Math.round(p * 16); // 12→28px as the goal nears
  const orb = (
    <span className="grid place-items-center rounded-full shrink-0" style={{
      width: inner, height: inner,
      background: "radial-gradient(circle at 38% 34%, #FFB06B, #FF8A33 55%, #8a431a 100%)",
      boxShadow: `0 0 0 1px rgba(255,138,51,.4), 0 0 ${hasProg ? glow : 16}px rgba(${celebrate ? "62,148,104" : "255,138,51"},.5)`,
      animation: celebrate ? "guibloom 2.4s ease-in-out infinite" : undefined,
    }}>
      <svg viewBox="0 0 32 32" width={s} height={s} fill="none" stroke="#3a1a06" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 1px rgba(74,30,8,.4))" }}>
        <path d="M16 27 V14" />
        <path d="M16 16 C16 11 12.5 8 8.5 8 C8.5 13 11.5 16 16 16 Z" fill="#3a1a06" stroke="none" />
        <path d="M16 14 C16 9 19.5 6 23.5 6 C23.5 11 20.5 14 16 14 Z" fill="#3a1a06" stroke="none" />
        <path d="M16 27 C13 27 11 25 10.5 22" />
        <path d="M16 27 C19 27 21 25 21.5 22" />
      </svg>
    </span>
  );
  if (!hasProg) return orb;
  return (
    <span className="relative grid place-items-center rounded-full shrink-0" title={`${Math.round(p * 100)}%`} style={{ width: size, height: size, background: `conic-gradient(${celebrate ? "#3E9468" : "#D6C29A"} ${Math.round(p * 360)}deg, rgba(255,255,255,0.10) ${Math.round(p * 360)}deg)` }}>
      {orb}
    </span>
  );
}

/* Signal colors by meaning — money-owed = red, waitlist = attention amber, pipeline = info blue.
   The color tells the owner what each play IS, at a glance. Neon-realista tones. */
export const PLAY_COLOR = { payments: "#E2533F", waitlist: "#FFC23D", followups: "#3FB4FF" };

/* ─────────────────── "Everything you have with Guileo" (the `grow` tab) ───────────────────
   The ONE screen that answers the owner's question: what do I actually get here — website,
   app, automations, software, ads, marketing, creative, AI? Three HONEST blocks:

     on       JÁ ESTÁ LIGADO      — ships with every account and works today
     included INCLUÍDO, É SÓ PEDIR — exists in the platform, we switch it on for you
     project  PROJETO SOB MEDIDA   — the team BUILDS it: own scope, own budget, NOT in the monthly

   Verdicts are PRODUCT-level (what the platform provably does today), never a per-tenant
   claim we cannot prove from data — a tenant-level "it's on for you" would be a lie for any
   piece that depends on an external key (Meta/A2P/Google) we cannot see from here.
   `note` = the honest caveat (what is automatic vs what a HUMAN on the team does by hand).
   `view` = an existing cockpit tab key; the CTA only links there if that tab is in this
   client's nav, otherwise it falls back to the WhatsApp ask (Grow.jsx decides). */
export const CATALOG = [
  ["on", [
    { ic: "🤖", name: "Your AI answering 24/7", desc: "Its own name, voice and phone number. It answers, quotes, books and follows up — day and night.", view: "brain" },
    { ic: "🌐", name: "Your website", desc: "A ready site with your services, hours, prices and booking link — yours to edit and publish.", view: "meusite" },
    { ic: "⚙️", name: "Automations running on our servers", desc: "Reminders, review requests, win-backs and no-show shields run on their own, 24/7.", note: "The list below is what actually runs on the server — no switch needed." },
    { ic: "📧", name: "Email marketing", desc: "Campaigns, coupons and special-date emails going out in YOUR brand, not ours.", view: "marketing" },
  ]],
  ["included", [
    { ic: "💬", name: "More channels (WhatsApp, Instagram, Messenger, SMS)", desc: "The same AI answering wherever your customer writes.", note: "Each channel waits on an outside approval (Meta / carrier). We connect it the moment it clears — we never pretend it's live before that.", view: "socialhub" },
    { ic: "📣", name: "Ads on Meta & Google", desc: "Paid campaigns to bring in new customers, tracked down to the booking.", note: "Measurement is automatic. Creating and managing the campaigns is done by hand, by our team.", view: "ads" },
    { ic: "🔎", name: "SEO & Google Business", desc: "Show up when people search nearby, with reviews answered for you.", view: "googlehub" },
    /* VERDADE (2026-08-25): esta linha dizia "Loyalty & win-back — Included" enquanto Loyalty.jsx
       responde "coming soon" para pontos e indicação. O que EXISTE de pé é gift card (motor real,
       /api/giftcards) e a reconquista de quem sumiu (churn + reengage, que a Gui já dispara).
       Catálogo e tela não podem discordar: o dono clica no que o catálogo promete. */
    { ic: "🎁", name: "Gift cards & win-back", desc: "Issue real gift cards today, and customers who stopped coming get invited back.", note: "Loyalty points and customer referrals are still being built — we switch them on when they're real, not before.", view: "retention" },
    { ic: "🏷️", name: "Coupons & promotions", desc: "Build an offer in one minute and send it to the right people.", view: "coupons" },
    { ic: "💳", name: "Payment links & collections", desc: "Charge on the call, and chase what's overdue without you having to ask.", view: "finance" },
    { ic: "📝", name: "Forms & photo quotes", desc: "Capture leads on your site and quote from a photo.", view: "capture" },
    { ic: "🔌", name: "Connect the tools you already use", desc: "Calendar, POS, booking system — the AI works across them.", view: "integrations" },
    { ic: "📍", name: "Another location", desc: "Same system, new store — its own agenda and numbers.", view: "locations" },
  ]],
  ["project", [
    { ic: "🎨", name: "Custom website or landing page", desc: "Beyond the included site: bespoke design, pages and copy built for you.", note: "Scoped and quoted separately — it is not part of the monthly." },
    { ic: "📱", name: "Mobile app (iOS / Android)", desc: "Your own app for your customers.", note: "Honest: there is NOTHING pre-built here. It's a from-scratch project with its own contract and timeline." },
    { ic: "🧩", name: "Custom software & internal systems", desc: "The system your operation needs and no off-the-shelf tool does.", note: "We build these case by case — each one gets its own scope, price and deadline." },
    { ic: "🎬", name: "Creative, video & design", desc: "Ads, posts and video made to look like your business.", note: "The AI writes the TEXT. Images, video and design are made by hand by our team — scoped separately." },
    { ic: "🛒", name: "Online ordering / store", desc: "Sell direct and keep the commissions.", note: "A build project, not a switch we flip." },
  ]],
];

/* The automations that REALLY run — on our servers, on a schedule, with or without the
   cockpit open (functions/api/automations.js + collections.js + proactive.js, fired by
   /api/cron-tick). Shown READ-ONLY: there is no per-tenant on/off endpoint for these, so a
   switch here would be a promise we cannot keep. The two opt-in ones say so explicitly. */
export const SERVER_AUTOMATIONS = [
  { ic: "⏰", name: "Booking reminders (24h and 2h before)", desc: "Cuts no-shows without anyone remembering to send anything." },
  { ic: "⭐", name: "Review request after the visit", desc: "Sent once per visit, with your review link." },
  { ic: "♻️", name: "Win-back for customers who disappeared", desc: "A warm nudge to people who stopped coming." },
  { ic: "🛡️", name: "Extra confirmation for risky appointments", desc: "Bookings likely to be missed get one more confirmation." },
  { ic: "🎂", name: "Birthdays & special dates", desc: "The right message on the day that matters.", view: "dates" },
  { ic: "🌤️", name: "Slow-day promo", desc: "Fills quiet days with a last-minute offer.", optin: "Off by default — ask us to turn it on." },
  { ic: "💸", name: "Auto-collections for overdue invoices", desc: "Chases what customers still owe you.", optin: "You switch this one on yourself, under Finance.", view: "finance" },
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
export const staffOf = (label, i) => { const a = STAFF[label] || []; return a.length ? a[i % a.length] : null; };
export const roomOf = (label, i) => { const a = ROOM[label] || []; return a.length ? a[i % a.length] : null; };
export const _dur = ["30 min", "45 min", "1 h", "1 h 30", "20 min"];
// Anti-no-show deposits (the capacity-protection money lever) — $ held per booking by sector
export const DEPOSIT = { "Restaurant": 20, "Clinic": 30, "Medical": 40, "Salon & Spa": 25, "Plumbing & HVAC": 50, "Gym & Fitness": 0, "Auto Dealership": 0, "Construction": 0, "Education": 0, "Law Firm": 0, "Real Estate": 0, "E-Commerce": 0 };
// Deterministic per-sector number: stable for a given (label,salt), distinct across
// sectors — so "store-wide" stats vary realistically instead of showing the same
// hardcoded "8 / 31 / 9" for every vertical.
function vhash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
export function vnum(label, salt, min, max) { return min + (vhash(`${label}|${salt}`) % (max - min + 1)); }

// ── Owner goal ("Meta do mês") — the monthly BOOKINGS target the owner sets on Overview.
// Stored via portalApi.saveState("owner_goal", n): localStorage is the source of truth and
// portalApi's cloud-kv mirror best-effort persists it across devices for signed-in clients.
export function monthBookings(V, real = null) {
  if (real && Array.isArray(real.events)) {
    const now = new Date(); const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return real.events.filter((e) => e.type === "booking" && new Date(e.created_at).getTime() >= m0).length;
  }
  // Demo: vnum gives the sector's stable FULL-month expectation; month-to-date scales by the
  // day so the pace math ("on pace for") reads sane instead of extrapolating to absurd numbers.
  const base = vnum(V.label, "mbookings", 24, 96);
  const now = new Date(); const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, Math.round((base * now.getDate()) / dim));
}
export function ownerGoalProgress(V, real = null) {
  const goal = Math.max(0, parseInt(portalApi.loadState("owner_goal", 0), 10) || 0);
  if (!goal) return null;
  const done = monthBookings(V, real);
  return { goal, done, pct: Math.max(0, Math.min(1, done / goal)) };
}

// Records created FROM a conversation (chat/call) persist so they genuinely appear
// at the top of the target tab — closes the "action lands in its tab" loop.
export const createdKey = (label, view) => `${label}:created:${view}`;
export function pushCreated(label, view, rec) {
  const cur = portalApi.loadState(createdKey(label, view), []);
  const id = Date.now();
  portalApi.saveState(createdKey(label, view), [{ ...rec, fromChat: true, _id: id }, ...cur].slice(0, 25));
  return id;
}
export const loadCreated = (label, view) => portalApi.loadState(createdKey(label, view), []);
// Undo a chat-created record: drop it from its tab's created list by _id.
function removeCreated(label, view, id) {
  const cur = portalApi.loadState(createdKey(label, view), []);
  portalApi.saveState(createdKey(label, view), cur.filter((r) => r._id !== id));
}
export function recordFor(view, who, channel, V) {
  if (view === "liveorders") return { id: `#${1000 + (Date.now() % 9000)}`, customer: who, items: `New order · via ${channel}`, total: 0, channel, status: "New", color: "#3E9468" };
  if (view === "schedule") return { time: "ASAP", name: who, meta: `Booked via ${channel}`, status: "Pending", ch: channel, color: "#D6C29A" };
  if (view === "deliveries") { const cfg = deliveryCfg(V); return { customer: who, who: `${cfg.who} · assigning`, eta: "Assigning…", status: "Preparing", color: "#D6C29A", addr: `From ${channel}`, via: cfg.own[0] }; }
  return null;
}
// Log a $ event to the Guileo Impact growth ledger (the revenue-share basis): when
// an order is fulfilled / a deal won / a delivery completed, the money the AI drove
// shows up in Impact and bumps the total — closing the loop to what Guileo gets paid on.
export const logImpact = (label, what, amt) => pushCreated(label, "impact", { t: "now", what, amt });

// Gui credit usage ledger — every metered task logs its cost + day, so the owner
// sees exactly what their AI credits bought (transparency drives trust + top-ups).
export function logUsage(cost, label) {
  if (!cost) return;
  const day = new Date().toISOString().slice(0, 10);
  const cur = portalApi.loadState("gui_usage", []);
  portalApi.saveState("gui_usage", [{ day, cost, label: (label || "").slice(0, 60), _id: Date.now() }, ...cur].slice(0, 200));
}
// Roll the usage ledger into the last N days (oldest→newest) for a mini bar chart.
export function usageByDay(days = 7) {
  const log = portalApi.loadState("gui_usage", []);
  const today = new Date();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const total = log.filter((u) => u.day === key).reduce((s, u) => s + (u.cost || 0), 0);
    out.push({ day: key, label: d.toLocaleDateString(UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : "en-US", { weekday: "short" }), total });
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
  "E-Commerce": { title: "Shipping & fulfilment", noun: "shipments", who: "Carrier", partners: [["UPS", "📦", "#8B6F47"], ["FedEx", "✈️", "#4D148C"], ["USPS", "📮", "#333366"], ["DHL", "🚚", "#C2A878"]], own: ["Local same-day", "Your courier for nearby orders"] },
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
export const deliveryCfg = (V) => DELIVERY[V.label] || DELIVERY["Restaurant"];

// ── Sector benchmark baselines — STATIC industry estimates (clearly labeled "estimated
// sector average" in the UI; never presented as live data). Sources: broadly published
// small-business call/booking studies, rounded. answerRate = share of inbound calls a
// typical business answers; respMins = median minutes to answer a new lead/message;
// noshowRate = share of bookings that no-show without confirmation flows. ──
export const SECTOR_BASELINES = {
  "Restaurant":      { answerRate: 0.62, respMins: 47,  noshowRate: 0.16 },
  "Clinic":          { answerRate: 0.68, respMins: 62,  noshowRate: 0.18 },
  "Medical":         { answerRate: 0.68, respMins: 62,  noshowRate: 0.19 },
  "Salon & Spa":     { answerRate: 0.58, respMins: 55,  noshowRate: 0.20 },
  "Law Firm":        { answerRate: 0.65, respMins: 180, noshowRate: 0.12 },
  "Real Estate":     { answerRate: 0.55, respMins: 90,  noshowRate: 0.14 },
  "Gym & Fitness":   { answerRate: 0.60, respMins: 70,  noshowRate: 0.22 },
  "Auto Dealership": { answerRate: 0.70, respMins: 45,  noshowRate: 0.15 },
  "Plumbing & HVAC": { answerRate: 0.52, respMins: 38,  noshowRate: 0.11 },
  "Education":       { answerRate: 0.63, respMins: 120, noshowRate: 0.17 },
  "Construction":    { answerRate: 0.50, respMins: 240, noshowRate: 0.10 },
  "E-Commerce":      { answerRate: 0.74, respMins: 95,  noshowRate: 0.08 },
};
export const sectorBaseline = (V) => SECTOR_BASELINES[V.label] || SECTOR_BASELINES["Restaurant"];

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
export const loyaltyCfg = (V) => LOYALTY[V.label] || { unit: "points", reward: "a reward", earn: "points per visit" };

// ── Team / staff per sector (reuses STAFF map for names) ──
export const TEAM_ROLE = { "Restaurant": "Server", "Clinic": "Dentist", "Medical": "Doctor", "Salon & Spa": "Stylist", "Gym & Fitness": "Coach", "Law Firm": "Attorney", "Real Estate": "Agent", "Plumbing & HVAC": "Technician", "Auto Dealership": "Advisor", "Education": "Teacher", "Construction": "Foreman", "E-Commerce": "Support rep" };
export function genLocations(V) {
  const n = V.business.name;
  return [
    { name: `${n} · Main`, addr: V.business.place || "Main St", status: "Open", revenue: vnum(V.label, "loc1", 1800, 9000), staff: (STAFF[V.label] || []).length || 3, today: vnum(V.label, "loc1o", 20, 120) },
    { name: `${n} · Downtown`, addr: "Downtown", status: "Open", revenue: vnum(V.label, "loc2", 1200, 7000), staff: 3, today: vnum(V.label, "loc2o", 14, 90) },
    { name: `${n} · Uptown`, addr: "Uptown", status: "Busy", revenue: vnum(V.label, "loc3", 900, 5000), staff: 2, today: vnum(V.label, "loc3o", 8, 60) },
  ];
}
export function genTeam(V) {
  const staff = (STAFF[V.label] || ["Team member"]).filter((s) => s && !/stand|desk|AI|Fulfillment|Packing|bay/i.test(s));
  const role = TEAM_ROLE[V.label] || "Team member";
  return staff.map((name, i) => ({ name, role: i === 0 ? `Lead ${role.toLowerCase()}` : role, status: "Active", handled: vnum(V.label, `${name}h`, 14, 92), revenue: vnum(V.label, `${name}r`, 900, 6400), rating: ((46 + vnum(V.label, `${name}rt`, 0, 3)) / 10) }));
}
export function genLoyaltyMembers(V) {
  return (V.customers || genCustomers(V)).map((c, i) => ({ name: c.name, pts: vnum(V.label, `${c.name}pts`, 120, 940), tier: i === 0 ? "Gold" : i === 1 ? "Silver" : "Bronze", channel: c.channel }));
}
export function genPayments(V) {
  const names = (V.customers || genCustomers(V)).map((c) => c.name);
  const ST = [["Paid", "#3E9468"], ["Pending", "#D6C29A"], ["Overdue", "#EF4444"], ["Paid", "#3E9468"], ["Pending", "#D6C29A"]];
  const M = ["Card", "Apple Pay", "Cash", "Transfer", "Card"];
  return (names.length ? names : ["Ana R.", "Bruno T.", "Carla M.", "Diego P."]).slice(0, 5).map((n, i) => {
    const [status, color] = ST[i % ST.length];
    return { id: `INV-${2040 + i}`, customer: n, amount: vnum(V.label, `${n}inv`, 40, 480), status, color, method: M[i % M.length], due: status === "Paid" ? "Paid" : `in ${2 + i} days` };
  });
}
export function genReferrals(V) {
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
export function genDeliveries(V) {
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
export function genCalls(V) {
  const sch = (V.ops?.schedule || []).slice(0, 4);
  if (sch.length) return sch.map((p, i) => ({ name: p.name, phone: _PHONES[i % 4], outcome: p.meta ? `${p.meta} · booked by AI` : "Handled by AI", dur: `${1 + (i % 2)}m ${(12 + i * 9) % 60}s`, time: `${2 + i * 12} min ago`, color: ["#3E9468", "#38BDF8", "#3E9468", "#7C7C7C"][i % 4] }));
  return (V.activity || []).slice(0, 4).map((a, i) => ({ name: "Caller", phone: _PHONES[i % 4], outcome: a[2], dur: "1m 02s", time: a[3], color: "#3E9468" }));
}
export function genConvos(V) {
  return (V.activity || []).slice(0, 4).map((a, i) => ({ name: (V.ops?.schedule?.[i]?.name) || a[1], last: a[2], t: a[3], unread: i === 1 ? 1 : 0 }));
}
export function genCustomers(V) {
  const noun = _NOUN[V.label] || "orders";
  return (V.ops?.schedule || []).slice(0, 4).map((p, i) => ({ name: p.name, orders: 24 - i * 5, spent: (600 - i * 120) + 0.5, last: `${2 + i * 15} min ago`, channel: p.ch && p.ch !== "—" ? p.ch : "WhatsApp", noun }));
}
// ── Leads · Daily — the qualified-lead digest + one-tap action loop. The owner's
// daily habit: Gui captured & categorized leads overnight; the owner decides with
// one tap — respond myself (free) · Gui calls (−5 credits) · Gui messages (−2). Idle
// 🔥 hot leads auto-escalate to Gui after a grace window (owner warned first). Every
// action logs credit usage, so it stays connected to Billing/Overview across the app. ──
export const TEMP = {
  hot:  { en: "Hot",  pt: "Quente", es: "Caliente", emoji: "🔥", dot: "#e0855f", ring: "border-[#e0855f]/45 bg-[#e0855f]/[0.06]" },
  warm: { en: "Warm", pt: "Morno",  es: "Tibio",    emoji: "🌤", dot: "#D6C29A", ring: "border-g-gold/35 bg-g-gold/[0.05]" },
  cold: { en: "Cold", pt: "Frio",   es: "Frío",     emoji: "❄️", dot: "#8Fb0cf", ring: "border-white/15 bg-white/[0.025]" },
};
const TEMP_NOTE = {
  hot:  { en: "Ready to book now — asked price & availability.", pt: "Pronto pra fechar — perguntou preço e disponibilidade.", es: "Listo para reservar — preguntó precio y disponibilidad." },
  warm: { en: "Interested, comparing options — needs a nudge.", pt: "Interessado, comparando — precisa de um empurrão.", es: "Interesado, comparando opciones — necesita un empujón." },
  cold: { en: "Just exploring — long-term nurture.", pt: "Só pesquisando — nutrir a longo prazo.", es: "Solo explorando — cultivar a largo plazo." },
};
const LEAD_SVC = {
  "Restaurant": ["Table for 8 · Sat", "Catering · 40 people", "Birthday booking", "Private event"],
  "Clinic": ["New patient · cleaning", "Implant consult", "Emergency · toothache", "Whitening"],
  "Medical": ["New patient intake", "Annual check-up", "Specialist referral", "Follow-up"],
  "Salon & Spa": ["Color + cut", "Bridal package", "Spa day", "Rebook · regular"],
  "Gym & Fitness": ["Trial class", "Personal training", "Membership", "Bring-a-friend"],
  "Auto Dealership": ["Test drive · SUV", "Trade-in quote", "Service booking", "Financing"],
  "Plumbing & HVAC": ["AC not cooling · urgent", "Water heater quote", "Annual tune-up", "Leak repair"],
  "Law Firm": ["Injury case intake", "Free consult", "Contract review", "Family matter"],
  "Real Estate": ["Viewing · 3BR", "Seller valuation", "Investment inquiry", "Rental"],
  "Education": ["Course enrollment", "Trial class", "Info session", "Scholarship"],
  "Construction": ["Kitchen remodel · $40k", "Site visit", "Project quote", "Renovation"],
  "E-Commerce": ["Bulk order inquiry", "VIP early access", "Wholesale", "Return/exchange"],
};
export function genLeads(V) {
  const names = (V.ops?.schedule || []).map((p) => p.name).filter(Boolean);
  const pool = names.length ? names : ["Maria S.", "João P.", "Ana L.", "Carlos M.", "Sofia R.", "Pedro A."];
  const svc = LEAD_SVC[V.label] || ["New inquiry", "Quote request", "Callback request", "Info request"];
  const chans = (V.channelMix?.items || []).map((i) => i[0]).filter((c) => c && c !== "—");
  const ch = chans.length ? chans : ["WhatsApp", "Call", "Instagram", "Web form"];
  const temps = ["hot", "hot", "warm", "warm", "warm", "cold", "cold", "hot"];
  const vals = [4200, 850, 320, 1500, 180, 90, 2600, 640];
  const urg = ["Today", "Today", "This week", "This week", "No rush", "No rush", "Today", "This week"];
  const ago = ["8 min", "26 min", "1 h", "2 h", "3 h", "5 h", "just now", "40 min"];
  return pool.concat(pool).slice(0, 8).map((n, i) => ({
    _id: `L${i}`, name: n, service: svc[i % svc.length], channel: ch[i % ch.length],
    temp: temps[i], value: vals[i], urgency: urg[i], ago: ago[i], note: TEMP_NOTE[temps[i]],
  }));
}

export function genCampaigns(V) {
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
// ── Per-sector intelligence: one source of truth that makes every vertical feel
// "this AI understands MY business" — feeds Impact events, recommendations, the
// radar, the daily briefing, audiences, next-best-action and missed-ops. ──
export const SECTOR_IQ = {
  "Restaurant": { slot: 62, brief: "tables fill fast tonight",
    radar: { n: (V) => genWaitlist(V).length || 3, en: (n) => `It's almost service and ${n} tables are still open tonight — fill them from your waitlist?`, pt: (n) => `Tá quase na hora e ${n} mesas seguem vazias hoje — encher pela lista de espera?`, es: (n) => `Ya casi es hora de servicio y ${n} mesas siguen vacías esta noche — ¿las llenas desde tu lista de espera?`, chipEn: "🍽️ Fill tables", chipPt: "🍽️ Encher mesas", chipEs: "🍽️ Llenar mesas", cmd: "request reviews" },
    recs: ["Tonight runs ~30% below capacity — blast your waitlist + regulars a same-day offer to fill the room.", "A dozen happy diners haven't been asked for a review yet — reviews drive new tables.", "Several regulars haven't ordered in 30 days — a win-back nudge brings them back."],
    impact: ["Filled a dead-night table → re-sold the slot", "Killed a no-show and re-sold the table", "Won back a regular gone 30 days"],
    missed: ["callers asked for catering / large parties — a line you don't list yet", "after-hours 'are you open?' calls now answered automatically"],
    aud: ["Regulars · 3+ visits", "Lapsed diners · 30d", "Big-spender lookalike", "Local · delivery radius"],
    nb: { top: "orders weekly — invite to your VIP club with a treat next visit.", risk: "hasn't ordered in a while — a 'we miss you' offer brings them back.", base: "loved their last meal — ask for a review while it's fresh." } },
  "Clinic": { slot: 160, brief: "recalls due this week",
    radar: { n: (V) => genFollowups(V).length || 38, en: (n) => `${n} patients are overdue for a recall — reactivate them this week (high-margin).`, pt: (n) => `${n} pacientes estão com retorno atrasado — reative esta semana (alta margem).`, es: (n) => `${n} pacientes tienen un recall pendiente — reactívalos esta semana (alto margen).`, chipEn: "🦷 Reactivate", chipPt: "🦷 Reativar", chipEs: "🦷 Reactivar", cmd: "start follow-ups" },
    recs: ["38 patients are overdue for a recall — a reactivation sequence books ~1 in 5.", "Happy patients haven't been asked to review — reviews win new patients.", "Several unconfirmed visits risk no-shows — confirm them now."],
    impact: ["Reactivated a 9-month overdue recall", "Recovered a no-show with an auto-reschedule", "Confirmed a wobbly appointment before it cancelled"],
    missed: ["patients asked about whitening/Invisalign you don't promote — high-margin demand", "after-hours 'do you take my insurance?' calls now answered"],
    aud: ["Recall-due patients", "New-patient lookalike", "Lapsed · 12mo+", "Treatment-plan follow-up"],
    nb: { top: "is due for a 6-month recall soon — pre-book the cleaning while they're warm.", risk: "lapsed on recalls — a reactivation note usually re-books them.", base: "had a great visit — ask for a review and pre-book the next." } },
  "Medical": { slot: 180, brief: "follow-ups awaiting",
    radar: { n: (V) => genFollowups(V).length || 24, en: (n) => `${n} patients need a follow-up or recall — re-engage before they drift to another provider.`, pt: (n) => `${n} pacientes precisam de retorno — reengaje antes que migrem pra outro lugar.`, es: (n) => `${n} pacientes necesitan seguimiento o recall — reconéctalos antes de que se vayan a otro proveedor.`, chipEn: "🩺 Re-engage", chipPt: "🩺 Reengajar", chipEs: "🩺 Reconectar", cmd: "start follow-ups" },
    recs: ["Open slots this week sit unfilled — pull from your new-patient demand.", "Reviews from happy patients drive new-patient search — request a batch.", "Unconfirmed visits risk no-shows — confirm them now."],
    impact: ["Filled an open slot from new-patient demand", "Recovered a no-show with an auto-reschedule", "Reactivated a patient overdue for a follow-up"],
    missed: ["patients asked about telehealth options you don't list yet", "after-hours intake calls now captured instead of lost"],
    aud: ["Recall-due patients", "New-patient lookalike", "Lapsed · 12mo+", "Telehealth-interested"],
    nb: { top: "is a high-value patient due for follow-up — book it while top of mind.", risk: "hasn't been seen in a while — a check-in note re-engages them.", base: "had a good visit — ask for a review and schedule the next." } },
  "Salon & Spa": { slot: 70, brief: "chairs to fill tomorrow",
    radar: { n: (V) => genWaitlist(V).length || 5, en: (n) => `${n} chairs sit empty tomorrow — push expiring packages + regulars to fill them.`, pt: (n) => `${n} cadeiras vazias amanhã — empurre pacotes vencendo + clientes fiéis pra preencher.`, es: (n) => `${n} sillas quedan vacías mañana — impulsa paquetes por vencer + clientes frecuentes para llenarlas.`, chipEn: "💈 Fill chairs", chipPt: "💈 Preencher", chipEs: "💈 Llenar sillas", cmd: "launch a promo" },
    recs: ["Tomorrow has open chairs — offer same-week slots to regulars and waitlist.", "Clients haven't rebooked — a rebooking nudge keeps the chair full.", "Ask happy clients for reviews — they fill new chairs."],
    impact: ["Filled an empty chair with a same-day offer", "Rebooked a client before they drifted", "Sold an expiring package before it lapsed"],
    missed: ["clients asked for treatments you don't offer yet — upsell demand", "after-hours booking requests now captured"],
    aud: ["Rebook-due clients", "Lapsed · 60d", "Package holders", "High-value lookalike"],
    nb: { top: "is a VIP — offer a loyalty perk and pre-book the next visit.", risk: "hasn't rebooked — a 'we saved your spot' note works.", base: "loved the service — ask for a review and rebook." } },
  "Law Firm": { slot: 2500, brief: "intakes awaiting follow-up",
    radar: { n: (V) => genFollowups(V).length || 11, en: (n) => `${n} intakes never got a follow-up call — each unsigned lead is worth thousands.`, pt: (n) => `${n} atendimentos não tiveram retorno — cada lead sem assinar vale milhares.`, es: (n) => `${n} consultas nunca recibieron una llamada de seguimiento — cada lead sin firmar vale miles.`, chipEn: "⚖️ Follow up", chipPt: "⚖️ Dar retorno", chipEs: "⚖️ Dar seguimiento", cmd: "start follow-ups" },
    recs: ["Several consults never got a follow-up — each unsigned lead is ~$2.5k.", "Engagement letters are unsigned — chase the e-signatures.", "Past clients are a referral goldmine — ask for intros + reviews."],
    impact: ["Captured an after-hours injury intake → signed", "Chased an unsigned engagement letter to signature", "Turned a past client into a referral"],
    missed: ["callers asked about practice areas you don't list yet", "after-hours intakes now captured instead of going to voicemail"],
    aud: ["Unsigned consults", "Past clients (referral)", "PI lookalike", "Practice-area searchers"],
    nb: { top: "is a high-value matter — fast-track the engagement letter.", risk: "consult never signed — a follow-up call recovers many.", base: "had a good outcome — ask for a review + referral." } },
  "Real Estate": { slot: 9000, brief: "hot leads to follow",
    radar: { n: (V) => genFollowups(V).length || 3, en: (n) => `${n} hot buyers viewed but never got matching listings — send them now before they go cold.`, pt: (n) => `${n} compradores quentes viram mas não receberam imóveis compatíveis — envie agora.`, es: (n) => `${n} compradores interesados vieron pero no recibieron propiedades que coincidan — envíaselas ahora antes de que se enfríen.`, chipEn: "🏠 Send listings", chipPt: "🏠 Enviar imóveis", chipEs: "🏠 Enviar propiedades", cmd: "start follow-ups" },
    recs: ["Hot buyers haven't gotten matching listings — send them today.", "Past clients drive referrals — ask for intros and reviews.", "New leads need instant replies — your AI answers in seconds."],
    impact: ["Replied to a Zillow lead in seconds → booked a showing", "Sent matching listings to a warm buyer", "Turned a past client into a referral"],
    missed: ["buyers asked about financing/mortgage — partner-referral revenue you're missing", "after-hours listing inquiries now answered instantly"],
    aud: ["Buyers by budget band", "Renters", "Past clients · referral", "Just-listed alerts"],
    nb: { top: "is an active buyer — send the newest matching listings now.", risk: "viewed but went quiet — a fresh listing re-engages them.", base: "closed happy — ask for a review and referrals." } },
  "Gym & Fitness": { slot: 90, brief: "at-risk members",
    radar: { n: (V) => genFollowups(V).length || 22, en: (n) => `${n} members went quiet (>14 days) — they churn next month without a nudge.`, pt: (n) => `${n} alunos sumiram (>14 dias) — vão cancelar mês que vem sem um empurrão.`, es: (n) => `${n} miembros se quedaron callados (>14 días) — cancelarán el próximo mes sin un empujón.`, chipEn: "💪 Re-engage", chipPt: "💪 Reengajar", chipEs: "💪 Reconectar", cmd: "start follow-ups" },
    recs: ["22 members went quiet — re-engage before they cancel.", "Trial users didn't convert — a follow-up turns them into members.", "Class spots sit empty — fill them from your waitlist."],
    impact: ["Re-engaged a member quiet 18 days", "Converted a trial that almost slipped away", "Filled an empty class spot from the waitlist"],
    missed: ["callers wanted personal training — an upsell you're not offering", "after-hours 'how much is membership?' calls now answered"],
    aud: ["At-risk members", "Trial no-shows", "Class waitlist", "Lapsed · 60d"],
    nb: { top: "is a loyal member — offer a referral perk or PT upsell.", risk: "hasn't checked in 18 days — a 'we miss you' + guest pass saves them.", base: "is engaged — ask for a review and a friend referral." } },
  "Auto Dealership": { slot: 400, brief: "leads + service-due",
    radar: { n: (V) => genFollowups(V).length || 6, en: (n) => `${n} shoppers test-drove or inquired but never got a follow-up — re-engage before they buy elsewhere.`, pt: (n) => `${n} compradores fizeram test-drive mas não tiveram retorno — reengaje antes que comprem em outro lugar.`, es: (n) => `${n} compradores hicieron una prueba de manejo o consultaron pero no recibieron seguimiento — reconéctalos antes de que compren en otro lado.`, chipEn: "🚗 Follow up", chipPt: "🚗 Dar retorno", chipEs: "🚗 Dar seguimiento", cmd: "start follow-ups" },
    recs: ["Test-drivers haven't been followed up — each is a near-sale.", "Service-due owners are easy revenue — book them in.", "New leads need instant replies — your AI answers 24/7."],
    impact: ["Followed up a test-drive → booked a sit-down", "Booked a service-due owner", "Replied to an AutoTrader lead in seconds"],
    missed: ["callers asked about trade-in values after hours — now answered", "service-plan demand you're not promoting"],
    aud: ["Service-due owners", "Test-drove · no buy", "Lease-ending", "In-market lookalike"],
    nb: { top: "is a repeat buyer — invite to a VIP trade-in offer.", risk: "test-drove but didn't buy — a follow-up recovers many.", base: "is due for service — book the appointment now." } },
  "Plumbing & HVAC": { slot: 480, brief: "jobs + after-hours calls",
    radar: { n: (V) => genFollowups(V).length || 4, en: (n) => `${n} quotes are sitting unbooked and ${"emergency"} calls come after hours — capture them before a competitor does.`, pt: (n) => `${n} orçamentos parados e chamados de emergência chegam fora do horário — capture antes do concorrente.`, es: (n) => `${n} presupuestos siguen sin agendar y las llamadas de emergencia llegan fuera de horario — captúralos antes que un competidor.`, chipEn: "🔧 Book jobs", chipPt: "🔧 Agendar", chipEs: "🔧 Agendar trabajos", cmd: "start follow-ups" },
    recs: ["Open quotes haven't been booked — a nudge converts them.", "Maintenance-plan customers are recurring revenue — offer it.", "After-hours emergencies are pure margin — your AI books them 24/7."],
    impact: ["Booked a 2 AM emergency leak → won the job", "Converted an open quote into a booked job", "Sold a maintenance plan for recurring revenue"],
    missed: ["callers needed services outside your area — partner-referral revenue", "after-hours emergency calls now booked instead of lost"],
    aud: ["Open-quote leads", "Maintenance-plan prospects", "Past customers · service-due", "Local emergency lookalike"],
    nb: { top: "is a repeat customer — offer an annual maintenance plan.", risk: "got a quote but didn't book — a follow-up wins many.", base: "had a great job — ask for a review and referral." } },
  "Education": { slot: 120, brief: "trials + at-risk students",
    radar: { n: (V) => genFollowups(V).length || 9, en: (n) => `${n} trial students didn't enroll yet — a follow-up turns trials into tuition.`, pt: (n) => `${n} alunos de aula teste ainda não matricularam — um retorno vira matrícula.`, es: (n) => `${n} estudiantes de prueba aún no se inscribieron — un seguimiento convierte pruebas en matrículas.`, chipEn: "📚 Follow up", chipPt: "📚 Dar retorno", chipEs: "📚 Dar seguimiento", cmd: "start follow-ups" },
    recs: ["Trial students haven't enrolled — nudge them to convert.", "At-risk students may drop — re-engage before they go.", "Happy parents/students drive referrals — ask for reviews."],
    impact: ["Converted a trial student into an enrollment", "Re-engaged a student about to drop", "Turned a happy parent into a referral"],
    missed: ["callers asked about courses you don't offer yet", "after-hours enrollment questions now answered"],
    aud: ["Trial · not enrolled", "At-risk students", "Past students · referral", "Course-interest lookalike"],
    nb: { top: "is highly engaged — offer an advanced course or referral perk.", risk: "is at risk of dropping — a check-in keeps them on track.", base: "is doing well — ask for a review and referral." } },
  "Construction": { slot: 44000, brief: "estimates awaiting",
    radar: { n: (V) => genFollowups(V).length || 5, en: (n) => `${n} estimates are awaiting a decision — a timely follow-up wins the bid.`, pt: (n) => `${n} orçamentos aguardam decisão — um retorno na hora ganha a obra.`, es: (n) => `${n} presupuestos esperan una decisión — un seguimiento a tiempo gana la obra.`, chipEn: "🏗️ Follow up", chipPt: "🏗️ Dar retorno", chipEs: "🏗️ Dar seguimiento", cmd: "start follow-ups" },
    recs: ["Open estimates need follow-up — each is a major project.", "Past clients drive referrals — ask for intros and reviews.", "New leads need fast replies — your AI answers instantly."],
    impact: ["Followed up an estimate → won the project", "Captured an after-hours project lead", "Turned a past client into a referral"],
    missed: ["leads asked about services outside your scope — partner-referral revenue", "after-hours project inquiries now captured"],
    aud: ["Open-estimate leads", "Past clients · referral", "Permit-pulled lookalike", "Project-type searchers"],
    nb: { top: "is a high-value client — fast-track the proposal.", risk: "got an estimate but didn't decide — a follow-up wins many.", base: "had a great project — ask for a review and referral." } },
  "E-Commerce": { slot: 124, brief: "carts recovering",
    radar: { n: (V) => genFollowups(V).length || 41, en: (n) => `${n} carts worth a few thousand are abandoning right now — start the recovery flow?`, pt: (n) => `${n} carrinhos de alguns milhares estão sendo abandonados agora — disparar a recuperação?`, es: (n) => `${n} carritos de unos miles se están abandonando ahora mismo — ¿iniciamos el flujo de recuperación?`, chipEn: "🛒 Recover carts", chipPt: "🛒 Recuperar", chipEs: "🛒 Recuperar carritos", cmd: "start follow-ups" },
    recs: ["41 carts worth ~$2.4k are unrecovered right now — fire the recovery flow.", "Past buyers haven't been re-engaged — a win-back sells again.", "Happy buyers drive social proof — request reviews."],
    impact: ["Chased an abandoned cart ($124) → paid", "Won back a buyer lapsed 60 days", "Turned a 5★ review into an ad"],
    missed: ["size/fit questions bounced — a size guide + AI sizing would have closed them", "after-hours order questions now answered instantly"],
    aud: ["Abandoned-cart · 7d", "High-AOV buyers", "Browsed · no buy", "Post-purchase · 30d"],
    nb: { top: "is a repeat buyer — offer a replenish subscription or VIP perk.", risk: "lapsed 60 days — a win-back offer brings them back.", base: "bought happy — ask for a review and cross-sell." } },
};
const iqOf = (V) => SECTOR_IQ[V.label] || SECTOR_IQ["Restaurant"];
export function genAudiences(V) {
  const iq = V && SECTOR_IQ[V.label];
  if (iq) return iq.aud.map((name, i) => ({ name, size: vnum(V.label, `aud${i}`, 90, 620), source: "CRM" }));
  return [
    { name: "Repeat customers", size: 412, source: "CRM" },
    { name: "Lapsed (no activity 30d)", size: 188, source: "CRM" },
    { name: "Lookalike · top value", size: 22000, source: "Meta" },
    { name: "Local · 3mi radius", size: 48000, source: "Google" },
  ];
}
// Growth attribution ledger — the basis of the revenue-share model
export function genImpact(V) {
  const iq = SECTOR_IQ[V.label];
  const times = ["now", "18m", "1h", "2h", "4h", "6h"];
  const amt = (i) => Math.min(1500, Math.max(40, Math.round((iq?.slot || 120) * (0.5 + vnum(V.label, `imp${i}`, 0, 80) / 100))));
  const events = iq
    ? [...iq.impact.map((what, i) => [times[i], what, amt(i)]),
       ["3h", "Captured an after-hours inquiry → booked", amt(4)],
       ["5h", "Turned a 5★ review into a new lead", amt(5)]]
    : [["now", "Recovered a missed call → booking", 120], ["14m", "Filled a cancelled slot from waitlist", 80], ["1h", "Won back a lapsed customer", 240], ["2h", "Reactivated a recall / repeat visit", 160], ["3h", "Turned a 5★ review into a new lead", 90], ["5h", "Captured an after-hours inquiry", 180]];
  return { total: V.impact?.total || 0, parts: V.impact?.parts || [], events };
}
// Universal "money leak" engine — un-converted leads, stalled quotes, trials, recalls the AI chases
export function genFollowups(V) {
  const sch = V.ops?.schedule || [];
  const TYPE = { "Law Firm": "Unsigned lead", "Construction": "Open estimate", "Real Estate": "Warm buyer", "Gym & Fitness": "Trial no-show", "Auto Dealership": "Test-drive lead", "Education": "Trial student", "Plumbing & HVAC": "Open quote", "Clinic": "Unconfirmed recall", "Medical": "Unconfirmed follow-up", "Salon & Spa": "No rebook yet", "E-Commerce": "Abandoned cart", "Restaurant": "Unconfirmed reservation" };
  const t = TYPE[V.label] || "Open lead";
  const base = sch.filter((r) => /pending|new|follow|risk/i.test(r.status));
  return (base.length ? base : sch).slice(0, 5).map((r, i) => ({ name: r.name, type: t, stage: (i % 3) + 1, value: 120 + i * 90, next: ["Nudge today", "Call back", "Send offer", "Final follow-up"][i % 4], ch: r.ch && r.ch !== "—" ? r.ch : "WhatsApp" }));
}
// Waitlist — turn empty capacity into revenue
export function genWaitlist(V) {
  const WANT = { "Restaurant": "Table for 2 tonight", "Clinic": "Earlier cleaning slot", "Medical": "Earlier appointment", "Salon & Spa": "Saturday haircut", "Gym & Fitness": "HIIT 7am spot", "Auto Dealership": "Service this week", "Plumbing & HVAC": "Same-day visit", "Education": "Evening class seat", "Law Firm": "Consultation this week", "Real Estate": "Weekend viewing", "Construction": "On-site estimate", "E-Commerce": "Back-in-stock alert" };
  const w = WANT[V.label] || "Earlier slot";
  return (V.ops?.schedule || []).slice(0, 4).map((r, i) => ({ name: r.name, want: w, since: `${5 + i * 7} min ago`, ch: r.ch && r.ch !== "—" ? r.ch : "WhatsApp" }));
}
// Reviews — reputation drives new demand (a growth lever)
// Sector-true review text (keyed by V.label) so reputation reads like a real customer of THAT business.
// A dental review mentions a painless cleaning; an auto review mentions a fair trade-in — never one generic pool.
const SECTOR_REVIEWS = {
  "Restaurant": ["Tasting menu was unforgettable, our server paired every wine perfectly.", "They squeezed us in from the waitlist on a packed Friday.", "Best brunch in town, the bottomless mimosas kept coming.", "Booked a table of twelve and catering was flawless.", "Steak cooked exactly to temp, room was warm and lively.", "Called after hours, they confirmed our reservation right away."],
  "Clinic": ["Painless cleaning and they explained my Invisalign options clearly.", "They reminded me my recall was overdue and rebooked instantly.", "Whitening results were incredible, my smile looks brand new.", "Confirmed my insurance over the phone, no surprise billing.", "Hygienist was gentle and the six-month checkup was quick.", "Reactivated me after a year away, so glad they reached out."],
  "Salon & Spa": ["My stylist nailed the balayage, color looks stunning in sunlight.", "Booked a last-minute Saturday chair, the cut was perfect.", "Relaxing facial and they rebooked my next visit on the spot.", "My package was about to expire and they reminded me.", "Best blowout I've had, lasted me through the whole week.", "Texted after hours for a slot and got one fast."],
  "Law Firm": ["Handled my injury claim with care, settled for more than expected.", "They followed up after my consult and got me signed quickly.", "Walked me through the engagement letter, e-signed in minutes.", "Answered my call after hours when I really needed help.", "Clear advice on my case, no confusing legal jargon.", "Past client here, happily referred two friends to them."],
  "E-Commerce": ["Order arrived two days early and packaging was beautiful.", "Their sizing guide nailed the fit, no return needed.", "Abandoned my cart and the reminder offer brought me back.", "Asked an order question at midnight and got an instant answer.", "Quality exceeded the photos, already reordered my favorite.", "Smooth checkout and the subscription refill is so convenient."],
  "Real Estate": ["Sent me matching listings within my budget the same day.", "Replied to my Zillow inquiry in seconds, booked a showing fast.", "Connected me with a great lender for financing too.", "Weekend viewing was easy to schedule, closed without stress.", "Knew the neighborhood inside out, found our dream home.", "Closed happy and gladly sent two referrals their way."],
  "Gym & Fitness": ["Coaches kept me accountable, the HIIT classes are addictive.", "Reached out when I went quiet and got me back training.", "My trial turned into a membership, best decision ever.", "Filled my spot in a packed 7am class from the waitlist.", "Personal training upsell was worth every penny, real results.", "Answered my membership pricing call right away, super helpful."],
  "Medical": ["Doctor was thorough and the telehealth follow-up was so convenient.", "They reminded me about my overdue follow-up before I drifted.", "Got an earlier appointment when a slot opened up.", "Confirmed my visit so I didn't miss it, great care.", "Intake call after hours was captured, never felt rushed.", "Caring staff and quick check-in, I felt heard the whole time."],
  "Plumbing & HVAC": ["Fixed my burst pipe at 2am, lifesaver after hours.", "Booked my open quote fast and the HVAC install was clean.", "Signed up for their maintenance plan, furnace runs perfectly now.", "Same-day visit and the leak was sorted in an hour.", "Honest pricing, no upsells, my AC is finally cold again.", "Followed up on my estimate and won the job, great work."],
  "Auto Dealership": ["Followed up after my test drive, made buying stress-free.", "Booked my service-due appointment and got a fair trade-in.", "Answered my trade-in value question after hours, super helpful.", "Replied to my AutoTrader inquiry in seconds, no pressure.", "Service team had me in and out, car runs like new.", "Repeat buyer here, their VIP trade-in offer was unbeatable."],
  "Education": ["My trial class hooked me, enrolled the very next week.", "They checked in when my son fell behind, real difference.", "Tutors are patient and his grades jumped in a month.", "Answered my enrollment questions late at night, so helpful.", "Advanced course was challenging and exactly what I needed.", "Happy parent here, already referred two families their way."],
  "Construction": ["Followed up on my estimate and delivered the remodel on time.", "On-site estimate was detailed and the bid was fair.", "Captured my project lead after hours, no call went unanswered.", "Crew was tidy and the kitchen build exceeded expectations.", "Clear proposal, no surprise costs, my deck looks amazing.", "Great project, happily referred them to my neighbor."],
};
export function genReviews(V) {
  const names = (V.ops?.schedule || []).map((r) => r.name).filter(Boolean);
  const texts = SECTOR_REVIEWS[V.label] || ["Amazing — fast and so friendly!", "Best experience, highly recommend 🙌", "They handled everything for me, so easy.", "Quick reply and great service.", "Will 100% come back!"];
  const base = names.length ? names : ["Marcos A.", "Maria S.", "Pedro L.", "Ana R.", "Bruno T."];
  return base.slice(0, 5).map((n, i) => ({ name: n, stars: i === 4 ? 4 : 5, text: texts[i % texts.length], ch: ["Google", "Instagram", "WhatsApp"][i % 3] }));
}

// Signature Overview ops board per sector (keyed by V.label) — the one widget that makes the
// dashboard feel like THIS owner's business, mirroring restaurant's bespoke topItems block.
// Each row is normalized to {a:primary, b:detail, pill:status, color, val:right-figure, ch:channel}.
export const SECTOR_OPS = {
  "Clinic": { title: "Recall radar", sub: "overdue patients Gui is reactivating — high-margin recovery", chip: "🦷 Reactivate all", view: "followups", rows: [
    { a: "Carla M.", b: "Cleaning + check-up · 4 mo overdue", pill: "Reactivating", color: "#38BDF8", val: "$160", ch: "WhatsApp" },
    { a: "Hugo N.", b: "Implant follow-up · 7 mo overdue", pill: "Overdue", color: "#C2A878", val: "$320", ch: "Phone" },
    { a: "Rita F.", b: "Whitening recall · 2 mo overdue", pill: "Rebooked", color: "#3E9468", val: "$210", ch: "Instagram" },
    { a: "Sofia L.", b: "Cleaning · 3 mo overdue", pill: "Due soon", color: "#D6C29A", val: "$160", ch: "WhatsApp" },
    { a: "João P.", b: "Perio maintenance · 6 mo overdue", pill: "Reactivating", color: "#38BDF8", val: "$240", ch: "Phone" } ] },
  "E-Commerce": { title: "Cart rescue", sub: "abandoned carts in flight — Gui is winning them back live", chip: "🛒 Recover all", view: "followups", rows: [
    { a: "Marcos A.", b: "Signature Hoodie, Cap · 18 min ago", pill: "Nudge 1 sent", color: "#38BDF8", val: "$124", ch: "WhatsApp" },
    { a: "Julia R.", b: "Classic Tee ×2 · 42 min ago", pill: "Offer sent", color: "#D6C29A", val: "$58", ch: "Instagram" },
    { a: "Ana L.", b: "Hoodie, Tote, Cap · 1h 10m ago", pill: "Recovered", color: "#3E9468", val: "$211", ch: "WhatsApp" },
    { a: "Bruno T.", b: "Cap · size question · 6 min ago", pill: "Detected", color: "#C2A878", val: "$39", ch: "Email" },
    { a: "Sofia P.", b: "Tote bag ×2 · 55 min ago", pill: "Recovered", color: "#3E9468", val: "$96", ch: "WhatsApp" } ] },
  "Real Estate": { title: "Hot lead pipeline", sub: "active buyers ranked by heat — Gui replies & matches instantly", chip: "🏠 Send matches", view: "followups", rows: [
    { a: "R. Almeida", b: "Buyer · 2BR Jardins · send 3 matches", pill: "Hot", color: "#3E9468", val: "R$900k–1.1M", ch: "Phone" },
    { a: "F. Lima", b: "Buyer · 3BR Pinheiros · book Sat viewing", pill: "Hot", color: "#3E9468", val: "R$1.2–1.5M", ch: "Phone" },
    { a: "T. Souza", b: "Renter · Studio Centro · confirm viewing", pill: "Warm", color: "#38BDF8", val: "R$3.5k/mo", ch: "WhatsApp" },
    { a: "P. Castro", b: "Buyer · 2BR Vila Mariana · answer financing", pill: "Warm", color: "#D6C29A", val: "R$700–850k", ch: "Web form" },
    { a: "M. Dias", b: "Buyer · House Morumbi · re-engage", pill: "Cooling", color: "#C2A878", val: "R$1.8–2.2M", ch: "Instagram" } ] },
};
// Recurring revenue — memberships / plans / subscriptions (the most valuable revenue)
export function genRecurring(V) {
  const PLAN = { "Gym & Fitness": "Monthly membership", "Clinic": "Recall plan", "Medical": "Care plan", "Salon & Spa": "Glow package", "Plumbing & HVAC": "Maintenance plan", "Auto Dealership": "Service plan", "Education": "Course subscription", "Restaurant": "VIP club", "E-Commerce": "Replenish subscription", "Real Estate": "Property mgmt", "Law Firm": "Retainer", "Construction": "Service contract" };
  const p = PLAN[V.label] || "Membership";
  return (V.ops?.schedule || []).slice(0, 5).map((r, i) => ({ name: r.name, plan: p, value: 39 + i * 12, status: i === 3 ? "Renews soon" : i === 4 ? "At risk" : "Active", color: i === 3 ? "#D6C29A" : i === 4 ? "#EF4444" : "#3E9468" }));
}
import logo from "../assets/guileo-mark.png";
import { waLink } from "../data/contact.js";
import { VERTICALS, VERTICAL_KEYS } from "../data/verticals.js";

/* Heavy tab views split into lazy chunks (performance) — code unchanged, just moved to src/portal/. */
const Hoje = lazy(() => import("../portal/Hoje.jsx")); // Hoje — a primeira tela do app: o dia inteiro em 3 respostas
const Overview = lazy(() => import("../portal/Overview.jsx"));
const Deliveries = lazy(() => import("../portal/Deliveries.jsx"));
const Support = lazy(() => import("../portal/Support.jsx"));
const Relacionamento = lazy(() => import("../portal/Relacionamento.jsx")); // Relacionamento — chamados com a thread visível + meu consultor + a nota (sem o nome)
const CommandCenter = lazy(() => import("../portal/CommandCenter.jsx"));
const CRM360 = lazy(() => import("../portal/CRM360.jsx"));
const CallLogs = lazy(() => import("../portal/CallLogs.jsx"));
const Inbox = lazy(() => import("../portal/Inbox.jsx"));
const SettingsView = lazy(() => import("../portal/SettingsView.jsx"));
const AIBrain = lazy(() => import("../portal/AIBrain.jsx"));
const Billing = lazy(() => import("../portal/Billing.jsx"));
const ScheduleScreen = lazy(() => import("../portal/ScheduleScreen.jsx"));
const AIAnalytics = lazy(() => import("../portal/AIAnalytics.jsx"));
const LeadsDigest = lazy(() => import("../portal/LeadsDigest.jsx"));
const Integrations = lazy(() => import("../portal/Integrations.jsx"));
const Operations = lazy(() => import("../portal/Operations.jsx"));
const LiveOrders = lazy(() => import("../portal/LiveOrders.jsx"));
const Kitchen = lazy(() => import("../portal/Kitchen.jsx"));
const MenuView = lazy(() => import("../portal/MenuView.jsx"));
const Customers = lazy(() => import("../portal/Customers.jsx"));
const Campaigns = lazy(() => import("../portal/Campaigns.jsx"));
const Audiences = lazy(() => import("../portal/Audiences.jsx"));
const Convos = lazy(() => import("../portal/Convos.jsx"));
const CatalogScreen = lazy(() => import("../portal/CatalogScreen.jsx"));
const SocialInbox = lazy(() => import("../portal/SocialInbox.jsx"));
const AIInsights = lazy(() => import("../portal/AIInsights.jsx"));
const Locations = lazy(() => import("../portal/Locations.jsx"));
const Team = lazy(() => import("../portal/Team.jsx"));
const Payments = lazy(() => import("../portal/Payments.jsx"));
const Loyalty = lazy(() => import("../portal/Loyalty.jsx"));
const GuileoImpact = lazy(() => import("../portal/GuileoImpact.jsx"));
const Followups = lazy(() => import("../portal/Followups.jsx"));
const Waitlist = lazy(() => import("../portal/Waitlist.jsx"));
const Reputation = lazy(() => import("../portal/Reputation.jsx"));
const Recurring = lazy(() => import("../portal/Recurring.jsx"));
const Channels = lazy(() => import("../portal/Channels.jsx"));
const Ads = lazy(() => import("../portal/Ads.jsx"));
const Leads = lazy(() => import("../portal/Leads.jsx"));
const Docs = lazy(() => import("../portal/Docs.jsx"));
const DocsArea = lazy(() => import("../portal/DocsArea.jsx"));
const GrowthDept = lazy(() => import("../portal/GrowthDept.jsx"));
const FinanceDept = lazy(() => import("../portal/FinanceDept.jsx"));
const MarketingDept = lazy(() => import("../portal/MarketingDept.jsx"));
const Dialer = lazy(() => import("../portal/Dialer.jsx"));
const Grow = lazy(() => import("../portal/Grow.jsx"));
const RiskRadar = lazy(() => import("../portal/RiskRadar.jsx"));
const ScheduleSync = lazy(() => import("../portal/ScheduleSync.jsx"));
const GoogleHub = lazy(() => import("../portal/GoogleHub.jsx"));
const SocialHub = lazy(() => import("../portal/SocialHub.jsx"));
const EmergencyLog = lazy(() => import("../portal/EmergencyLog.jsx"));
const LeadsToday = lazy(() => import("../portal/LeadsToday.jsx"));
const MeuSite = lazy(() => import("../portal/MeuSite.jsx")); // o site REAL do cliente (produto foundation)
const MarketingDates = lazy(() => import("../portal/MarketingDates.jsx"));
const Coupons = lazy(() => import("../portal/Coupons.jsx"));
const GrowthIntel = lazy(() => import("../portal/GrowthIntel.jsx"));
const CaptureTools = lazy(() => import("../portal/CaptureTools.jsx"));
const Comentarios = lazy(() => import("../portal/Comentarios.jsx"));
const QuoteEngine = lazy(() => import("../portal/QuoteEngine.jsx")); // Motor de Orçamento — fila de aprovação (teto/auto-envio)
const MarketplaceLeads = lazy(() => import("../portal/MarketplaceLeads.jsx"));
const StormMode = lazy(() => import("../portal/StormMode.jsx"));
const Trainer = lazy(() => import("../portal/Trainer.jsx"));
const KnowledgeBase = lazy(() => import("../portal/KnowledgeBase.jsx"));
const Experience = lazy(() => import("../portal/Experience.jsx")); // XM — customer-experience score (customer-of-the-customer)
const Timeline = lazy(() => import("../portal/Timeline.jsx")); // Linha do tempo — do fornecedor ao cliente: custo→lucro→risco
const MyCompanyOS = lazy(() => import("../portal/MyCompanyOS.jsx")); // Minha Empresa — the client's OWN 8 Company-OS departments, live

/* ───────────────────────── Mock data (demo — swap for Supabase/integrations later) ───────────────────────── */

export const CHANNELS = [
  { Icon: FaWhatsapp, name: "WhatsApp", color: "#25D366", convos: 642, won: 128, note: "booked 96 orders" },
  { Icon: FaInstagram, name: "Instagram", color: "#E4405F", convos: 410, won: 73, note: "closed $5.2k in DMs" },
  { Icon: FaPhone, name: "Phone (AI)", color: "#38BDF8", convos: 1240, won: 311, note: "0 missed calls" },
  { Icon: FaFacebook, name: "Facebook", color: "#1877F2", convos: 188, won: 24, note: "24 comments handled" },
  { Icon: FaTiktok, name: "TikTok", color: "#f5f5f5", convos: 96, won: 12, note: "1 viral clip · 12k views" },
  { Icon: FaGoogle, name: "Google", color: "#4285F4", convos: 140, won: 92, note: "92 reviews requested" },
];

// CAMPAIGNS (campanhas de demonstração) foi REMOVIDA em 2026-08-09. Ela alimentava a aba
// Anúncios com campanhas inventadas e um "ROAS 4.1×" fixo — um cliente pagante via desempenho
// de anúncios que nunca existiram. A aba agora lê /api/ads (dado real, NULL quando não há
// lastro). Dado falso órfão no código é armadilha para quem vier depois: some junto.

export const LEADS = [
  { name: "Marcos A.", ch: "WhatsApp", when: "2 min ago", status: "Booked", color: "#3E9468" },
  { name: "Julia R.", ch: "Instagram", when: "18 min ago", status: "Qualified", color: "#D6C29A" },
  { name: "Pedro S.", ch: "Phone", when: "41 min ago", status: "New", color: "#38BDF8" },
  { name: "Ana L.", ch: "WhatsApp", when: "1 h ago", status: "Booked", color: "#3E9468" },
  { name: "Bruno T.", ch: "Facebook", when: "2 h ago", status: "Follow-up", color: "#C2A878" },
  { name: "Carla M.", ch: "Google", when: "3 h ago", status: "Review ⭐", color: "#3E9468" },
];

export const DOCS = [
  ["📄", "Service Agreement", "Signed · Apr 2, 2026", "Signed"],
  ["🧾", "Invoice #0012", "Paid · Jun 1, 2026", "Paid"],
  ["📦", "Onboarding checklist", "Completed", "Done"],
  ["📊", "May performance report", "PDF · 1.2 MB", "View"],
];

const REVENUE = [8, 10, 9, 13, 12, 16, 15, 19, 18, 22, 24, 28]; // monthly trend (demo)

/* ───────────────────────── Tiny charts ───────────────────────── */
export function Spark({ data = REVENUE, color = "#3E9468", h = 40 }) {
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
export function Bars({ data = REVENUE, color = "#D6C29A" }) {
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
  // Cross-cutting Company-OS sections belong to every sector — inject if missing.
  const inject = (list, key, label, afterKey) => {
    if (list.some((s) => s[0] === key)) return list;
    const i = list.findIndex((s) => s[0] === afterKey);
    const out = list.slice(); out.splice(i >= 0 ? i + 1 : out.length, 0, [key, label]); return out;
  };
  // A tela HOJE é a porta do app e vem SEMPRE primeiro — inclusive no restaurante, que traz uma
  // nav própria de verticals.js. Sem isto o app abriria numa das 61 telas de profundidade.
  const ensureHoje = (list) => (list.some((x) => x[0] === "hoje") ? list : [["hoje", "Today"], ...list]);
  const ensureCRM = (list) => {
    let l = inject(list, "mycompany", "Minha Empresa", "overview"); // flagship overview — the client's OWN 8 departments
    l = inject(l, "command", "Command Center", "overview");
    l = inject(l, "trainer", "Treinadora", "brain");  // the AI that teaches the owner to use Guileo
    l = inject(l, "kb", "Cérebro do negócio", "brain"); // per-tenant Knowledge Base the agent reads
    l = inject(l, "leadstoday", "Leads do dia", "leads"); // today's leads-by-source sits next to the daily digest
    l = inject(l, "mktleads", "Leads Marketplace", "leadstoday"); // Yelp/Angi/Thumbtack speed-to-lead responder
    l = inject(l, "meusite", "Meu site", "mktleads"); // publica o site do negocio (produto foundation)
    l = inject(l, "crm", "CRM 360", "customers");
    l = inject(l, "finance", "Finance", "crm");
    l = inject(l, "marketing", "Marketing", "finance");
    l = inject(l, "dates", "Datas & Aniversários", "marketing"); // birthday + commemorative-date config
    l = inject(l, "coupons", "Cupons & Campanhas", "dates"); // per-client branded coupons + campaigns
    // ANÚNCIOS ficava INALCANÇÁVEL: a view existia no roteador e nenhum item de menu apontava
    // para ela. Com "resultado de anúncio" sendo metade do produto, a tela mais importante para
    // o cliente era a única sem porta. Fica ao lado de Cupons & Campanhas, dentro de Marketing.
    l = inject(l, "ads", "Anúncios · Resultado", "coupons");
    l = inject(l, "growthintel", "Inteligência", "ads"); // LTV + lead sources + forecast + abandoned bookings
    l = inject(l, "capture", "Captura", "growthintel"); // intake forms + photo-quote + Google Business
    l = inject(l, "comentarios", "Comentário → DM", "capture"); // IG: comentou a palavra → recebe o direct (mesmo webhook da Gui)
    l = inject(l, "orcamentos", "Orçamentos", "capture"); // Motor de Orçamento — a IA orça, acima do teto o dono aprova
    l = inject(l, "experience", "Experience", "capture"); // XM — how THIS business's own customers feel (NPS/CSAT/sentiment/drivers/detractors)
    l = inject(l, "timeline", "Linha do tempo", "experience"); // Do fornecedor ao cliente — custo→lucro→risco numa timeline só
    l = inject(l, "retention", "Growth & Retention", "marketing");
    l = inject(l, "documents", "Documents", "billing");
    l = inject(l, "relacionamento", "Relationship", "documents"); // Relacionamento — suporte com resposta visível + consultor + nota
    l = inject(l, "riskradar", "Risk Radar", "schedule"); // no-show radar rides with Operations everywhere
    l = inject(l, "schedulesync", "Conectar agenda", "schedule"); // connect MindBody/Square/Google Cal
    l = inject(l, "googlehub", "Google", "reputation"); // GBP reviews + SEO + ads
    l = inject(l, "socialhub", "Redes sociais", "googlehub"); // Meta DMs + publishing A+B
    l = inject(l, "storm", "Modo Tempestade", "riskradar"); // 1-click hurricane close+notify+reopen blast
    l = inject(l, "emergency", "Emergências", "storm"); // owner-visible log of urgent escalations (Gui rang the phone)
    l = inject(l, "grow", "Everything you have", "overview"); // the discovery screen — see below
    // The discovery tab has ONE job: answer "what do I actually have with Guileo?". It used to
    // sit inside "Your AI ✨" (an owner shopping for a website never clicks that) and the
    // restaurant's bespoke nav still ships the old "Grow with Guileo" label from verticals.js —
    // so pin BOTH the label and the position here, right under Overview, for every sector.
    l = l.map((s) => (s[0] === "grow" ? ["grow", "Everything you have"] : s));
    const gi = l.findIndex((s) => s[0] === "grow");
    const oi = l.findIndex((s) => s[0] === "overview");
    if (gi > -1 && oi > -1 && gi !== oi + 1) { const [g] = l.splice(gi, 1); l.splice(gi < oi ? oi : oi + 1, 0, g); }
    return l;
  };
  if (V.sections) { // restaurant has a bespoke nav from its reference tool — still inject Leads after Overview
    if (V.sections.some((s) => s[0] === "leads")) return ensureHoje(ensureCRM(V.sections));
    const i = V.sections.findIndex((s) => s[0] === "overview");
    const out = V.sections.slice(); out.splice(i >= 0 ? i + 1 : 0, 0, ["leads", "Leads · Daily"]); return ensureHoje(ensureCRM(out));
  }
  const sec = SECTOR_NAV[vid] || [["operations", "Operations"]];
  return ensureHoje(ensureCRM([
    ["overview", "Overview"], ["leads", "Leads · Daily"], ["impact", "Guileo Impact"], ["brain", "Train your AI"], ["analytics", "AI Analytics"], ["insights", "AI Insights"], ["integrations", "Integrations"],
    ...sec,
    ["deliveries", deliveryTab(V)],
    // payments/followups/waitlist/recurring/reputation/loyalty/campaigns/audiences are FOLDED
    // into the Finance/Marketing/Growth dept views (DeptTabs) — reachable there, off the sidebar.
    ["customers", "Customers"], ["crm", "CRM 360"],
    ["inbox", "Inbox"], ["calllogs", "Call Logs"], ["dialer", "Call Dialer"], ["whatsapp", "WhatsApp"], ["sms", "SMS"], ["social", "Social"],
    ["grow", "Everything you have"], ["locations", "Locations"], ["team", "Team"], ["billing", "Billing & Plan"], ["relacionamento", "Relationship"], ["settings", "Settings"],
  ]));
}
/* ── NAV: TELA SEM FEED NÃO ENTRA NO MENU DE QUEM PAGA (2026-08-25) ────────────────────────────
   Pedidos ao vivo e Cozinha só existem quando ALGUMA plataforma de entrega manda pedido para o
   `delivery-webhook` (que grava evento `type:"order"`). Sem esse feed as duas telas não têm o que
   mostrar em modo real: viram faixa de amostra permanente, e um restaurante pagante abre o menu e
   encontra duas telas de mentira honesta lado a lado com as suas reais.
   A trava é o PRÓPRIO dado — nenhuma flag de vertical foi inventada: se existe um pedido, existem
   as telas; se não existe, elas somem do nav. Volta ao nav sozinho quando o feed existir.
   Em modo DEMO nada muda: o vendedor precisa delas para vender.
   ⚠️ Só ESCONDE do menu — a view continua no roteador, então um link/⌘K antigo não quebra. */
function ocultaSemFeed(sections, real) {
  if (!real) return sections;
  const temPedido = Array.isArray(real.events) && real.events.some((e) => e && e.type === "order");
  if (temPedido) return sections;
  return sections.filter(([k]) => k !== "liveorders" && k !== "kitchen");
}
// Red notification counts per menu item — drives urgency badges in the sidebar
// Views that render REAL tenant data when connected — ONLY these earn the LIVE badge.
// Everything else shows an honest "Sample preview" chip even when the account is linked.
const REAL_VIEWS = new Set(["hoje", "overview", "impact", "billing", "inbox", "calllogs", "convos", "whatsapp", "sms",
  "mycompany", "crm", "command", "finance", "leadstoday", "dates", "coupons", "growthintel", "capture", "comentarios", "orcamentos", "experience", "timeline", "mktleads", "storm", "meusite",
  "riskradar", "emergency", "locations", "recurring", "kb", "brain", "settings", "support", "relacionamento", "trainer", "grow", "documents", "schedulesync", "googlehub", "socialhub", "operations"]);

function notifFor(key, V, real = null) {
  // For a connected client, these channels have no real backing data yet — don't show
  // fabricated unread counts. Demo mode keeps them so the tour looks alive.
  // real mode: every branch below is demo-derived — a red badge would be a lie. No badges.
  if (real) return 0;
  switch (key) {
    case "overview": return V.alerts ? V.alerts.items.length : 0;
    case "leads": { const a = portalApi.loadState(`${V.label}:leadActions`, {}); return genLeads(V).filter((l) => l.temp === "hot" && !a[l._id]).length; }
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
  hoje: FaCalendarDays, overview: FaGaugeHigh, operations: FaListCheck, schedule: FaListCheck, catalog: FaBookOpen, brain: FaBrain, analytics: FaChartLine, insights: FaWandMagicSparkles, integrations: FaPlug, liveorders: FaReceipt,
  kitchen: FaUtensils, menu: FaBookOpen, deliveries: FaTruck, customers: FaUsers, campaigns: FaBullhorn, audiences: FaBullseye,
  inbox: FaComments, calllogs: FaPhone, dialer: FaPhoneVolume, whatsapp: FaWhatsapp, sms: FaCommentSms, social: FaShareNodes, grow: FaStore, billing: FaCreditCard,
  impact: FaArrowTrendUp, followups: FaArrowsRotate, waitlist: FaClock, recurring: FaIdCard, reputation: FaStar, loyalty: FaGift, payments: FaReceipt,
  channels: FaComments, ads: FaBullhorn, leads: FaUsers, support: FaHeadset, relacionamento: FaHeadset, docs: FaFileLines, settings: FaGear, team: FaUsers, locations: FaLocationDot,
  crm: FaIdCard, command: FaGaugeHigh, finance: FaCreditCard, marketing: FaBullhorn, retention: FaArrowsRotate, documents: FaFileLines,
  riskradar: FaTriangleExclamation, emergency: FaBell, schedulesync: FaCalendarDays, googlehub: FaGoogle, socialhub: FaShareNodes, leadstoday: FaUsers, dates: FaGift, coupons: FaTag, growthintel: FaChartLine, capture: FaListCheck, comentarios: FaComments, orcamentos: FaFileInvoiceDollar, experience: FaFaceSmile, timeline: FaChartLine, mktleads: FaBullseye, storm: FaBell, meusite: FaGlobe,
  trainer: FaGraduationCap, kb: FaBrain, mycompany: FaBuilding,
};
// Group the (long) nav into scannable categories
// Order = everyday use first (operations/conversations/customers), then growth/strategy, then account.
const NAV_GROUPS = [
  // "grow" = "Everything you have" — the discovery screen. Second item of the top group, right
  // under Overview: it answers the question every owner asks (website? app? ads? software?), so
  // it can NOT live buried inside "Your AI ✨" where nobody shopping for a website would look.
  ["", ["hoje", "overview", "grow", "mycompany", "leads", "leadstoday", "mktleads", "meusite"]],
  ["Your AI ✨", ["command", "trainer", "brain", "kb", "analytics", "insights"]],
  ["Operations", ["liveorders", "kitchen", "menu", "schedule", "riskradar", "storm", "catalog", "deliveries", "operations"]],
  ["Conversations", ["inbox", "calllogs", "dialer", "whatsapp", "sms", "social"]],
  ["Customers", ["crm"]],
  ["Grow revenue", ["impact", "finance", "marketing", "dates", "coupons", "growthintel", "capture", "comentarios", "orcamentos", "experience", "timeline", "retention", "integrations"]],
  ["Account", ["locations", "team", "billing", "documents", "relacionamento", "support", "settings"]],
];
// Portal UI translations (PT/ES/HI) — each dictionary now lives in its own lazy
// chunk (src/portal/dict-*.js, ~60KB each) so the main Portal bundle doesn't carry
// ~180KB of strings. loadDict(lang) fills the module-level cache below; tr() reads
// it synchronously, so every call site (here and in all tab chunks) is unchanged.
// English needs no dict — tr() returns the key itself. If a dict chunk fails to
// load (offline), we silently stay on English rather than crash.
const UI_DICTS = {}; // lang → dict — module cache shared by the shell and all tabs
const DICT_LOADERS = {
  pt: () => import("../portal/dict-pt.js"),
  es: () => import("../portal/dict-es.js"),
  hi: () => import("../portal/dict-hi.js"),
};
/* Strings introduced by the "Everything you have" screen (CATALOG / SERVER_AUTOMATIONS above)
   and by the automations-honesty copy. They live HERE, next to the English source strings,
   instead of inside src/portal/dict-*.js: the feature ships self-contained and the copy can
   never drift from its translation. loadDict() merges them ON TOP of the lazy dict chunk, so
   tr() resolves them exactly like every other portal string — and they still translate even
   if the chunk fails to load. Order: [en, pt, es, hi] — the 4 UI languages of the cockpit. */
const EXTRA_ROWS = [
  // ── screen chrome ────────────────────────────────────────────────────────────────────────
  ["Everything you have", "Tudo que você tem", "Todo lo que tienes", "आपके पास जो कुछ है"],
  ["Everything you have with Guileo", "Tudo que você tem com a Guileo", "Todo lo que tienes con Guileo", "Guileo के साथ आपके पास जो कुछ है"],
  ["Website, app, automations, software, ads, marketing, creative and AI — what is already yours, what we switch on for you, and what our team builds.",
    "Site, app, automações, software, anúncios, marketing, criativos e IA — o que já é seu, o que a gente liga pra você e o que a nossa equipe constrói.",
    "Sitio web, app, automatizaciones, software, anuncios, marketing, creativos e IA — lo que ya es tuyo, lo que activamos para ti y lo que construye nuestro equipo.",
    "वेबसाइट, ऐप, ऑटोमेशन, सॉफ़्टवेयर, विज्ञापन, मार्केटिंग, क्रिएटिव और AI — क्या पहले से आपका है, क्या हम चालू कर देते हैं, और क्या हमारी टीम बनाती है।"],
  ["Already on", "Já está ligado", "Ya está activo", "पहले से चालू"],
  ["Working in your account today.", "Funcionando na sua conta hoje.", "Funcionando en tu cuenta hoy.", "आज आपके खाते में चालू है।"],
  ["Included — just ask", "Incluído, é só pedir", "Incluido — solo pídelo", "शामिल है — बस कहिए"],
  ["Already in the platform. We switch it on for you.", "Já existe na plataforma. A gente liga pra você.", "Ya existe en la plataforma. Lo activamos para ti.", "प्लेटफ़ॉर्म में पहले से है। हम आपके लिए चालू कर देते हैं।"],
  ["Custom project", "Projeto sob medida", "Proyecto a medida", "कस्टम प्रोजेक्ट"],
  ["Our team builds it. Own scope and budget — not part of your monthly plan.", "A equipe constrói. Tem escopo e orçamento próprios — não vem no mensal.", "Nuestro equipo lo construye. Con alcance y presupuesto propios — no entra en el mensual.", "हमारी टीम इसे बनाती है। अलग स्कोप और बजट — मासिक प्लान में शामिल नहीं।"],
  ["On", "Ligado", "Activo", "चालू"],
  ["Included", "Incluído", "Incluido", "शामिल"],
  ["Project", "Sob medida", "A medida", "प्रोजेक्ट"],
  ["Open →", "Abrir →", "Abrir →", "खोलें →"],
  ["Ask my team →", "Falar com meu time →", "Hablar con mi equipo →", "मेरी टीम से बात करें →"],
  // ── already on ───────────────────────────────────────────────────────────────────────────
  ["Your AI answering 24/7", "Sua IA atendendo 24/7", "Tu IA atendiendo 24/7", "आपकी AI 24/7 जवाब देती है"],
  ["Its own name, voice and phone number. It answers, quotes, books and follows up — day and night.", "Com nome, voz e número próprios. Ela atende, passa preço, agenda e faz o retorno — dia e noite.", "Con nombre, voz y número propios. Atiende, cotiza, agenda y hace el seguimiento — día y noche.", "अपना नाम, आवाज़ और नंबर। यह जवाब देती है, दाम बताती है, बुकिंग करती है और फ़ॉलो-अप करती है — दिन-रात।"],
  ["Your website", "Seu site", "Tu sitio web", "आपकी वेबसाइट"],
  ["A ready site with your services, hours, prices and booking link — yours to edit and publish.", "Um site pronto com seus serviços, horários, preços e link de agendamento — seu para editar e publicar.", "Un sitio listo con tus servicios, horarios, precios y enlace de reserva — tuyo para editar y publicar.", "आपकी सेवाओं, समय, कीमतों और बुकिंग लिंक के साथ तैयार साइट — संपादित करें और प्रकाशित करें।"],
  ["Automations running on our servers", "Automações rodando nos nossos servidores", "Automatizaciones corriendo en nuestros servidores", "हमारे सर्वर पर चलने वाले ऑटोमेशन"],
  ["Reminders, review requests, win-backs and no-show shields run on their own, 24/7.", "Lembretes, pedidos de avaliação, reconquista e proteção contra faltas rodam sozinhos, 24/7.", "Recordatorios, solicitudes de reseña, recuperación y protección contra ausencias corren solos, 24/7.", "रिमाइंडर, रिव्यू अनुरोध, वापसी संदेश और नो-शो सुरक्षा अपने आप चलते हैं, 24/7।"],
  ["The list below is what actually runs on the server — no switch needed.", "A lista abaixo é o que roda de verdade no servidor — não precisa ligar nada.", "La lista de abajo es lo que realmente corre en el servidor — no hay que activar nada.", "नीचे दी गई सूची वही है जो सर्वर पर वास्तव में चलती है — कुछ चालू करने की ज़रूरत नहीं।"],
  ["Email marketing", "Marketing por e-mail", "Marketing por email", "ईमेल मार्केटिंग"],
  ["Campaigns, coupons and special-date emails going out in YOUR brand, not ours.", "Campanhas, cupons e e-mails de datas especiais saindo com a SUA marca, não a nossa.", "Campañas, cupones y correos de fechas especiales con TU marca, no la nuestra.", "अभियान, कूपन और विशेष-तिथि ईमेल — आपकी ब्रांडिंग के साथ, हमारी नहीं।"],
  // ── included ─────────────────────────────────────────────────────────────────────────────
  ["More channels (WhatsApp, Instagram, Messenger, SMS)", "Mais canais (WhatsApp, Instagram, Messenger, SMS)", "Más canales (WhatsApp, Instagram, Messenger, SMS)", "और चैनल (WhatsApp, Instagram, Messenger, SMS)"],
  ["The same AI answering wherever your customer writes.", "A mesma IA atendendo onde o seu cliente escrever.", "La misma IA atendiendo donde te escriba tu cliente.", "वही AI, जहाँ भी आपका ग्राहक लिखे।"],
  ["Each channel waits on an outside approval (Meta / carrier). We connect it the moment it clears — we never pretend it's live before that.", "Cada canal depende de uma aprovação externa (Meta / operadora). A gente conecta assim que sai — e nunca finge que já está no ar antes disso.", "Cada canal depende de una aprobación externa (Meta / operadora). Lo conectamos apenas se aprueba — nunca fingimos que ya está activo antes.", "हर चैनल बाहरी मंज़ूरी (Meta / कैरियर) पर निर्भर है। मंज़ूरी मिलते ही हम जोड़ देते हैं — उससे पहले हम कभी नहीं कहते कि यह चालू है।"],
  ["Ads on Meta & Google", "Anúncios no Meta e Google", "Anuncios en Meta y Google", "Meta और Google पर विज्ञापन"],
  ["Paid campaigns to bring in new customers, tracked down to the booking.", "Campanhas pagas para trazer cliente novo, medidas até o agendamento.", "Campañas pagas para traer clientes nuevos, medidas hasta la reserva.", "नए ग्राहक लाने के लिए पेड कैंपेन, बुकिंग तक मापे गए।"],
  ["Measurement is automatic. Creating and managing the campaigns is done by hand, by our team.", "A medição é automática. Criar e gerenciar a campanha é feito na mão, por gente do nosso time.", "La medición es automática. Crear y gestionar la campaña lo hace a mano nuestro equipo.", "मापन स्वचालित है। कैंपेन बनाना और चलाना हमारी टीम हाथ से करती है।"],
  ["SEO & Google Business", "SEO e Google Meu Negócio", "SEO y Google Business", "SEO और Google Business"],
  ["Show up when people search nearby, with reviews answered for you.", "Aparecer quando procuram perto de você, com as avaliações respondidas.", "Aparecer cuando buscan cerca de ti, con las reseñas respondidas.", "जब लोग पास में खोजें तो दिखें, समीक्षाओं के उत्तर के साथ।"],
  ["Gift cards & win-back", "Vale-presente e reconquista", "Tarjetas de regalo y recuperación", "गिफ़्ट कार्ड और वापसी"],
  ["Issue real gift cards today, and customers who stopped coming get invited back.", "Emita vale-presente de verdade hoje, e quem parou de vir recebe um convite de volta.", "Emite tarjetas de regalo reales hoy, y quien dejó de venir recibe una invitación de vuelta.", "आज ही असली गिफ़्ट कार्ड जारी करें, और जो ग्राहक आना बंद कर चुके हैं उन्हें वापस बुलाया जाता है।"],
  ["Loyalty points and customer referrals are still being built — we switch them on when they're real, not before.", "Pontos de fidelidade e indicação ainda estão sendo construídos — a gente liga quando forem reais, não antes.", "Los puntos de fidelidad y las recomendaciones aún se están construyendo — los activamos cuando sean reales, no antes.", "लॉयल्टी पॉइंट और रेफ़रल अभी बन रहे हैं — जब वे असली होंगे तभी चालू करेंगे, उससे पहले नहीं।"],
  ["Coupons & promotions", "Cupons e promoções", "Cupones y promociones", "कूपन और प्रोमोशन"],
  ["Build an offer in one minute and send it to the right people.", "Monte uma oferta em um minuto e mande para as pessoas certas.", "Crea una oferta en un minuto y envíala a las personas correctas.", "एक मिनट में ऑफ़र बनाएँ और सही लोगों को भेजें।"],
  ["Payment links & collections", "Links de pagamento e cobrança", "Enlaces de pago y cobranza", "पेमेंट लिंक और वसूली"],
  ["Charge on the call, and chase what's overdue without you having to ask.", "Cobre na própria ligação e persiga o que está vencido sem você precisar pedir.", "Cobra en la propia llamada y persigue lo vencido sin que tengas que pedirlo.", "कॉल पर ही भुगतान लें, और बकाया अपने आप वसूला जाए।"],
  ["Forms & photo quotes", "Formulários e orçamento por foto", "Formularios y presupuesto por foto", "फ़ॉर्म और फ़ोटो से अनुमान"],
  ["Capture leads on your site and quote from a photo.", "Capture contatos no seu site e faça orçamento a partir de uma foto.", "Captura contactos en tu sitio y cotiza desde una foto.", "अपनी साइट पर लीड लें और फ़ोटो से कीमत बताएँ।"],
  ["Connect the tools you already use", "Conecte as ferramentas que você já usa", "Conecta las herramientas que ya usas", "आप जो टूल पहले से उपयोग करते हैं उन्हें जोड़ें"],
  ["Calendar, POS, booking system — the AI works across them.", "Agenda, PDV, sistema de reservas — a IA trabalha em todos.", "Agenda, PDV, sistema de reservas — la IA trabaja en todos.", "कैलेंडर, POS, बुकिंग सिस्टम — AI सब पर काम करती है।"],
  ["Another location", "Mais uma unidade", "Otra sucursal", "एक और लोकेशन"],
  ["Same system, new store — its own agenda and numbers.", "Mesmo sistema, loja nova — com agenda e números próprios.", "Mismo sistema, tienda nueva — con agenda y números propios.", "वही सिस्टम, नई शाखा — अपनी एजेंडा और अपने आँकड़े।"],
  // ── custom project ───────────────────────────────────────────────────────────────────────
  ["Custom website or landing page", "Site ou landing page sob medida", "Sitio o landing page a medida", "कस्टम वेबसाइट या लैंडिंग पेज"],
  ["Beyond the included site: bespoke design, pages and copy built for you.", "Além do site incluído: design, páginas e textos feitos sob medida para você.", "Más allá del sitio incluido: diseño, páginas y textos hechos a tu medida.", "शामिल साइट से आगे: आपके लिए बनाया गया डिज़ाइन, पेज और कॉपी।"],
  ["Scoped and quoted separately — it is not part of the monthly.", "Tem escopo e orçamento à parte — não entra no mensal.", "Tiene alcance y presupuesto aparte — no entra en el mensual.", "अलग स्कोप और अलग कीमत — मासिक में शामिल नहीं।"],
  ["Mobile app (iOS / Android)", "Aplicativo (iOS / Android)", "App móvil (iOS / Android)", "मोबाइल ऐप (iOS / Android)"],
  ["Your own app for your customers.", "Um app seu, para os seus clientes.", "Una app tuya, para tus clientes.", "आपके ग्राहकों के लिए आपका अपना ऐप।"],
  ["Honest: there is NOTHING pre-built here. It's a from-scratch project with its own contract and timeline.", "Sendo honesto: aqui NÃO existe nada pronto. É um projeto do zero, com contrato e prazo próprios.", "Siendo honestos: aquí NO hay nada ya construido. Es un proyecto desde cero, con contrato y plazo propios.", "ईमानदारी से: यहाँ कुछ भी पहले से बना नहीं है। यह शून्य से बनने वाला प्रोजेक्ट है, अपने अनुबंध और समय-सीमा के साथ।"],
  ["Custom software & internal systems", "Software e sistemas sob medida", "Software y sistemas a medida", "कस्टम सॉफ़्टवेयर और आंतरिक सिस्टम"],
  ["The system your operation needs and no off-the-shelf tool does.", "O sistema que a sua operação precisa e nenhuma ferramenta de prateleira resolve.", "El sistema que tu operación necesita y ninguna herramienta de estante resuelve.", "वह सिस्टम जिसकी आपके संचालन को ज़रूरत है और कोई तैयार टूल नहीं देता।"],
  ["We build these case by case — each one gets its own scope, price and deadline.", "A gente constrói caso a caso — cada um com escopo, preço e prazo próprios.", "Los construimos caso por caso — cada uno con alcance, precio y plazo propios.", "हम इन्हें मामला-दर-मामला बनाते हैं — हर एक का अपना स्कोप, कीमत और समय-सीमा।"],
  ["Creative, video & design", "Criativos, vídeo e design", "Creativos, video y diseño", "क्रिएटिव, वीडियो और डिज़ाइन"],
  ["Ads, posts and video made to look like your business.", "Anúncios, posts e vídeo com a cara do seu negócio.", "Anuncios, publicaciones y video con la cara de tu negocio.", "आपके व्यवसाय जैसा दिखने वाला विज्ञापन, पोस्ट और वीडियो।"],
  ["The AI writes the TEXT. Images, video and design are made by hand by our team — scoped separately.", "A IA escreve o TEXTO. Imagem, vídeo e design são feitos na mão pela equipe — com escopo à parte.", "La IA escribe el TEXTO. Imagen, video y diseño los hace a mano el equipo — con alcance aparte.", "AI केवल टेक्स्ट लिखती है। छवि, वीडियो और डिज़ाइन हमारी टीम हाथ से बनाती है — अलग स्कोप के साथ।"],
  ["Online ordering / store", "Pedido online / loja", "Pedidos online / tienda", "ऑनलाइन ऑर्डर / स्टोर"],
  ["Sell direct and keep the commissions.", "Venda direto e fique com a comissão.", "Vende directo y quédate con la comisión.", "सीधे बेचें और कमीशन अपने पास रखें।"],
  ["A build project, not a switch we flip.", "É um projeto de construção, não um botão que a gente liga.", "Es un proyecto de construcción, no un botón que encendemos.", "यह बनाने का प्रोजेक्ट है, कोई स्विच नहीं।"],
  // ── server automations (read-only list) ──────────────────────────────────────────────────
  ["What actually runs on our servers", "O que roda de verdade nos nossos servidores", "Lo que realmente corre en nuestros servidores", "हमारे सर्वर पर वास्तव में क्या चलता है"],
  ["These run 24/7, whether or not you are logged in. Shown read-only — the two opt-in ones are marked.", "Isso roda 24/7, com você logado ou não. Aqui é só leitura — os dois opcionais estão marcados.", "Esto corre 24/7, estés conectado o no. Aquí es solo lectura — los dos opcionales están marcados.", "ये 24/7 चलते हैं, चाहे आप लॉग इन हों या नहीं। यहाँ केवल पढ़ने के लिए — दो वैकल्पिक चिह्नित हैं।"],
  ["Read-only", "Somente leitura", "Solo lectura", "केवल पढ़ने के लिए"],
  ["Opt-in", "Opcional", "Opcional", "वैकल्पिक"],
  ["The “Automations” list on your Overview is your own plan inside this cockpit: it organizes and records what you ran here — it does not send anything by itself. The real sending is the list above.",
    "A lista “Automações” do seu Overview é o seu plano dentro deste painel: ela organiza e registra o que você rodou aqui — ela não envia nada sozinha. Quem envia de verdade é a lista acima.",
    "La lista “Automatizaciones” de tu Overview es tu propio plan dentro de este panel: organiza y registra lo que ejecutaste aquí — no envía nada por sí sola. Quien envía de verdad es la lista de arriba.",
    "आपके Overview की “Automations” सूची इस कॉकपिट के भीतर आपकी अपनी योजना है: यह व्यवस्थित करती है और रिकॉर्ड रखती है — यह स्वयं कुछ नहीं भेजती। असली भेजना ऊपर की सूची करती है।"],
  ["Booking reminders (24h and 2h before)", "Lembretes de horário (24h e 2h antes)", "Recordatorios de cita (24h y 2h antes)", "बुकिंग रिमाइंडर (24 घंटे और 2 घंटे पहले)"],
  ["Cuts no-shows without anyone remembering to send anything.", "Corta as faltas sem ninguém precisar lembrar de mandar nada.", "Reduce las ausencias sin que nadie tenga que acordarse de enviar nada.", "बिना किसी को याद दिलाए नो-शो घटाता है।"],
  ["Review request after the visit", "Pedido de avaliação depois do atendimento", "Solicitud de reseña después de la visita", "विज़िट के बाद समीक्षा अनुरोध"],
  ["Sent once per visit, with your review link.", "Enviado uma vez por atendimento, com o seu link de avaliação.", "Enviado una vez por visita, con tu enlace de reseña.", "प्रति विज़िट एक बार, आपके रिव्यू लिंक के साथ।"],
  ["Win-back for customers who disappeared", "Reconquista de quem sumiu", "Recuperación de quienes desaparecieron", "गायब हो चुके ग्राहकों की वापसी"],
  ["A warm nudge to people who stopped coming.", "Um empurrãozinho carinhoso para quem parou de vir.", "Un empujoncito cálido para quienes dejaron de venir.", "जो आना बंद कर चुके हैं उन्हें एक गर्मजोशी भरा संदेश।"],
  ["Extra confirmation for risky appointments", "Confirmação extra nos horários de risco", "Confirmación extra en las citas de riesgo", "जोखिम वाली अपॉइंटमेंट के लिए अतिरिक्त पुष्टि"],
  ["Bookings likely to be missed get one more confirmation.", "Os horários com cara de que vão furar recebem mais uma confirmação.", "Las citas con pinta de ausencia reciben una confirmación más.", "जिन बुकिंग के छूटने की संभावना है उन्हें एक और पुष्टि मिलती है।"],
  ["Birthdays & special dates", "Aniversários e datas especiais", "Cumpleaños y fechas especiales", "जन्मदिन और विशेष तिथियाँ"],
  ["The right message on the day that matters.", "A mensagem certa no dia que importa.", "El mensaje correcto en el día que importa.", "जिस दिन मायने रखता है, उस दिन सही संदेश।"],
  ["Slow-day promo", "Promoção de dia parado", "Promo de día flojo", "सुस्त दिन का प्रोमो"],
  ["Fills quiet days with a last-minute offer.", "Enche os dias parados com uma oferta de última hora.", "Llena los días flojos con una oferta de última hora.", "खाली दिनों को अंतिम-समय के ऑफ़र से भरता है।"],
  ["Off by default — ask us to turn it on.", "Desligada por padrão — peça pra gente ligar.", "Apagada por defecto — pídenos activarla.", "डिफ़ॉल्ट रूप से बंद — चालू करने के लिए हमें कहें।"],
  ["Auto-collections for overdue invoices", "Cobrança automática do que está vencido", "Cobranza automática de lo vencido", "बकाया चालानों की स्वचालित वसूली"],
  ["Chases what customers still owe you.", "Persegue o que os clientes ainda te devem.", "Persigue lo que los clientes aún te deben.", "जो ग्राहक अब भी देना है, उसका पीछा करता है।"],
  ["You switch this one on yourself, under Finance.", "Essa você mesmo liga, dentro de Finance.", "Esta la activas tú mismo, dentro de Finance.", "इसे आप स्वयं Finance में चालू करते हैं।"],
  // Used by the Overview "Automations" card once it is renamed to what it really is (the patch
  // is in this wave's report — Overview.jsx belongs to another owner). Pre-translated so the
  // rename lands in all 4 languages the moment it is applied.
  ["🗓️ My plan (inside this cockpit)", "🗓️ Meu plano (dentro deste painel)", "🗓️ Mi plan (dentro de este panel)", "🗓️ मेरी योजना (इस कॉकपिट में)"],
  ["Reminders you set here: Gui prepares and records them in this cockpit — they do not send anything on their own.", "Lembretes que você definiu aqui: a Gui prepara e registra neste painel — eles não enviam nada sozinhos.", "Recordatorios que definiste aquí: Gui los prepara y registra en este panel — no envían nada por sí solos.", "यहाँ आपके द्वारा तय किए गए रिमाइंडर: Gui इन्हें इस कॉकपिट में तैयार और दर्ज करती है — ये स्वयं कुछ नहीं भेजते।"],
  ["See what runs on the server →", "Ver o que roda no servidor →", "Ver lo que corre en el servidor →", "देखें सर्वर पर क्या चलता है →"],
  ["▶ Prepare now", "▶ Preparar agora", "▶ Preparar ahora", "▶ अभी तैयार करें"],
  // ── credit meter honesty (Gui assistant) ─────────────────────────────────────────────────────
  ["Couldn't read your balance", "Não consegui ler seu saldo", "No pude leer tu saldo", "आपका बैलेंस नहीं पढ़ पाया"],
  ["Top up in Billing →", "Recarregar em Cobrança →", "Recargar en Facturación →", "बिलिंग में टॉप-अप करें →"],
  // ── follow-ups honesty ───────────────────────────────────────────────────────────────────────
  ["Closed here. Your real revenue is counted from what's actually collected.", "Fechado aqui. A sua receita real é contada pelo que foi de fato recebido.", "Cerrado aquí. Tus ingresos reales se cuentan por lo que realmente se cobró.", "यहाँ बंद कर दिया। आपकी असली आमदनी उसी से गिनी जाती है जो वास्तव में वसूल हुआ।"],
  /* A linha que ficava aqui era o aviso "esta lista ainda é um layout de amostra". Ela sumiu porque
     a tela parou de ser amostra: Followups.jsx agora lê abandoned + churn (dado real do tenant).
     As linhas abaixo são o vocabulário dessa tela real. */
  // ── barra de baixo (celular) — "Money"/"Today"/"Schedule"/"Inbox" já existem nos dicts ────────
  ["Quick navigation", "Navegação rápida", "Navegación rápida", "त्वरित नेविगेशन"],
  // ── AI Insights: o bloco de intenções reais ("LIVE — from your real calls" e "of" já existem) ─
  ["Why people call you — your own calls", "Por que te ligam — das suas próprias ligações", "Por qué te llaman — de tus propias llamadas", "लोग आपको क्यों कॉल करते हैं — आपकी अपनी कॉल से"],
  ["calls with a recorded intent.", "ligações com intenção registrada.", "llamadas con intención registrada.", "कॉल जिनमें इरादा दर्ज है।"],
  ["Who's waiting on a follow-up — from your own contacts", "Quem está esperando um retorno — dos seus próprios contatos", "Quién espera un seguimiento — de tus propios contactos", "किसे फ़ॉलो-अप का इंतज़ार है — आपके अपने संपर्कों में से"],
  ["Waiting on a follow-up", "Esperando retorno", "Esperando seguimiento", "फ़ॉलो-अप का इंतज़ार"],
  ["Almost booked", "Quase agendou", "Casi reservó", "लगभग बुक हुआ"],
  ["Almost booked — dropped off mid-way", "Quase agendou — parou no meio do caminho", "Casi reservó — se detuvo a mitad de camino", "लगभग बुक हुआ — बीच में छोड़ दिया"],
  ["At risk of leaving", "Em risco de sumir", "En riesgo de irse", "छोड़ने के जोखिम में"],
  ["Loyal customer past their usual return window", "Cliente fiel passou do intervalo de sempre", "Cliente fiel pasó su intervalo habitual", "वफ़ादार ग्राहक अपनी सामान्य वापसी अवधि पार कर चुका"],
  ["Gui follows up →", "A Gui dá o retorno →", "Gui da el seguimiento →", "Gui फ़ॉलो-अप करेगी →"],
  ["Gui will follow up with", "A Gui vai dar retorno para", "Gui dará seguimiento a", "Gui फ़ॉलो-अप करेगी"],
  ["queued ✓", "na fila ✓", "en cola ✓", "क़तार में ✓"],
  ["No follow-up pending 🎉", "Nenhum retorno pendente 🎉", "Ningún seguimiento pendiente 🎉", "कोई फ़ॉलो-अप बाक़ी नहीं 🎉"],
  ["Couldn't send that follow-up — try again.", "Não consegui enviar esse retorno — tente de novo.", "No pude enviar ese seguimiento — inténtalo de nuevo.", "वह फ़ॉलो-अप नहीं भेज पाया — फिर कोशिश करें।"],
  ["The follow-up engine isn't switched on for your account yet — so this isn't a zero, it's a blank. Ask your team to turn it on.", "O motor de retorno ainda não está ligado na sua conta — então isto não é zero, é vazio. Peça para o seu time ligar.", "El motor de seguimiento aún no está activado en tu cuenta — así que esto no es un cero, es un vacío. Pídele a tu equipo que lo active.", "आपके खाते में फ़ॉलो-अप इंजन अभी चालू नहीं है — यह शून्य नहीं, खाली है। अपनी टीम से इसे चालू करने को कहें।"],
  // ── Hoje (the app's first screen) ────────────────────────────────────────────────────────────
  ["Today", "Hoje", "Hoy", "आज"],
  ["What your AI did for you today", "O que a sua IA fez por você hoje", "Lo que tu IA hizo por ti hoy", "आज आपकी AI ने आपके लिए क्या किया"],
  ["Bookings made", "Agendamentos", "Reservas", "बुकिंग"],
  ["Messages answered", "Mensagens respondidas", "Mensajes respondidos", "जवाब दिए संदेश"],
  ["New contacts", "Novos contatos", "Nuevos contactos", "नए संपर्क"],
  ["What it was worth", "Quanto isso valeu", "Cuánto valió", "इसका कितना मूल्य रहा"],
  ["Collected today", "Recebido hoje", "Cobrado hoy", "आज वसूल"],
  ["Collected this month", "Recebido no mês", "Cobrado este mes", "इस महीने वसूल"],
  ["Only money actually collected is counted here.", "Só entra aqui dinheiro que foi de fato recebido.", "Aquí solo entra el dinero realmente cobrado.", "यहाँ केवल वही पैसा गिना जाता है जो वास्तव में मिला।"],
  ["Not measured yet", "Ainda não medido", "Aún no medido", "अभी मापा नहीं गया"],
  ["Needs you", "Pedindo você", "Requiere tu atención", "आपकी ज़रूरत"],
  ["Nothing is waiting on you right now.", "Nada está esperando por você agora.", "Nada está esperando por ti ahora.", "अभी कुछ भी आपका इंतज़ार नहीं कर रहा।"],
  ["unhappy customer waiting", "cliente insatisfeito esperando", "cliente insatisfecho esperando", "असंतुष्ट ग्राहक इंतज़ार में"],
  ["unhappy customers waiting", "clientes insatisfeitos esperando", "clientes insatisfechos esperando", "असंतुष्ट ग्राहक इंतज़ार में"],
  ["booking at risk of a no-show", "agendamento com risco de falta", "reserva con riesgo de ausencia", "बुकिंग जिसमें ग़ैरहाज़िरी का जोखिम"],
  ["bookings at risk of a no-show", "agendamentos com risco de falta", "reservas con riesgo de ausencia", "बुकिंग जिनमें ग़ैरहाज़िरी का जोखिम"],
  ["Go deeper", "Ir mais fundo", "Ir más a fondo", "और गहराई में"],
  ["My schedule", "Agenda", "Agenda", "शेड्यूल"],
  ["Calls", "Ligações", "Llamadas", "कॉल"],
  ["Customers", "Clientes", "Clientes", "ग्राहक"],
  ["Pulse", "Pulse", "Pulse", "Pulse"],
  ["My site", "Meu site", "Mi sitio", "मेरी साइट"],
  ["Money", "Dinheiro", "Dinero", "पैसा"],
  ["I couldn't load your day", "Não consegui carregar o seu dia", "No pude cargar tu día", "मैं आपका दिन लोड नहीं कर पाया"],
  ["The read failed, so I'm not going to show you numbers I don't have.", "A leitura falhou, então não vou te mostrar números que eu não tenho.", "La lectura falló, así que no voy a mostrarte números que no tengo.", "पढ़ना विफल रहा, इसलिए मैं वे आँकड़े नहीं दिखाऊँगा जो मेरे पास नहीं हैं।"],
  ["Connect your account", "Conecte a sua conta", "Conecta tu cuenta", "अपना खाता कनेक्ट करें"],
  ["Add your connection code in Settings and today's real numbers show up here.", "Coloque o seu código de conexão em Configurações e os números reais de hoje aparecem aqui.", "Pon tu código de conexión en Ajustes y los números reales de hoy aparecen aquí.", "सेटिंग्स में अपना कनेक्शन कोड डालें और आज के असली आँकड़े यहाँ दिखेंगे।"],
  ["Open Settings →", "Abrir Configurações →", "Abrir Ajustes →", "सेटिंग्स खोलें →"],
  ["Showing what I last read at", "Mostrando o que li pela última vez às", "Mostrando lo último que leí a las", "पिछली बार पढ़ा गया, समय"],
  ["offline", "offline", "sin conexión", "ऑफ़लाइन"],
  ["Read at", "Lido às", "Leído a las", "पढ़ा गया"],
  ["I couldn't read this one", "Não consegui ler esta parte", "No pude leer esta parte", "यह हिस्सा मैं नहीं पढ़ पाया"],
  ["Refresh", "Atualizar", "Actualizar", "रीफ़्रेश"],
  ["the server refused the read", "o servidor recusou a leitura", "el servidor rechazó la lectura", "सर्वर ने पढ़ने से मना कर दिया"],
];
const EXTRA_DICTS = { pt: {}, es: {}, hi: {} };
EXTRA_ROWS.forEach(([en, pt, es, hi]) => { EXTRA_DICTS.pt[en] = pt; EXTRA_DICTS.es[en] = es; EXTRA_DICTS.hi[en] = hi; });
const DICT_FAILED = new Set(); // chunk didn't load (offline) → retry on the next call, don't cache the gap
export async function loadDict(lang) {
  if (!DICT_LOADERS[lang] || (UI_DICTS[lang] && !DICT_FAILED.has(lang))) return; // en, or already cached
  let base = null;
  try { base = (await DICT_LOADERS[lang]()).default || null; } catch { /* offline → EXTRA_DICTS still translate */ }
  UI_DICTS[lang] = { ...(base || {}), ...(EXTRA_DICTS[lang] || {}) };
  if (base) DICT_FAILED.delete(lang); else DICT_FAILED.add(lang);
}
// Warm the persisted language's dict the moment this module loads, so the boot
// gate's `await loadDict(...)` usually resolves instantly — zero added boot time.
loadDict(portalApi.loadState("portal_lang", "en"));
export let UI_LANG = "en";
const setUiLang = (l) => { UI_LANG = l; };
export const tr = (s, lang) => { const L = lang || UI_LANG; const T = UI_DICTS[L]; return (T && T[s]) ? T[s] : s; };

// ── Voice of Gui — browser speechSynthesis, feature-detected (graceful no-op where
// unsupported, no deps). NEVER autoplays: every call sits behind a user gesture.
// One shared speaker: a new line cancels whatever was still being said.
const speechLang = () => (UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US");
export function speakLine(text, onEnd) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance) return false;
    synth.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = speechLang();
    if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
    synth.speak(u);
    return true;
  } catch { return false; }
}
export function stopSpeaking() { try { window.speechSynthesis?.cancel(); } catch { /* unsupported */ } }

// ── REAL MODE helpers — when the client's connection code unlocks live backend data,
// these turn the raw event ledger into the numbers/feeds the cockpit shows. ──
export const EVENT_ICON = { call: "📞", booking: "📅", sale: "💳", payment: "💳", lead: "🎯", review: "⭐", message: "💬", provision: "🤖" };
const periodDays = (period) => ({ "7 days": 7, "30 days": 30, "90 days": 90 }[period] || 30);
export function eventsInPeriod(events, period) {
  const cut = Date.now() - periodDays(period) * 864e5;
  return (events || []).filter((e) => { const t = new Date(e.created_at).getTime(); return Number.isFinite(t) && t >= cut; });
}
export const sumAmounts = (events) => Math.round((events || []).reduce((s, e) => s + (Number(e.amount) || 0), 0));
/** Bucket event amounts into a per-day series (oldest→today) for the existing charts. */
export function realDaily(events, period) {
  const days = Math.min(periodDays(period), 30);
  const out = new Array(days).fill(0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  (events || []).forEach((e) => {
    const d = new Date(e.created_at); if (Number.isNaN(d.getTime())) return;
    d.setHours(0, 0, 0, 0);
    const idx = days - 1 - Math.round((today - d) / 864e5);
    if (idx >= 0 && idx < days) out[idx] += Number(e.amount) || 0;
  });
  return out.map((n) => Math.round(n));
}
/** "agora mesmo" / "12m" / "3h" / "5d" / "Jun 2" — compact relative time for the feed. */
export function relTime(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return tr("just now");
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d` : new Date(t).toLocaleDateString(UI_LANG === "pt" ? "pt-BR" : "en-US", { month: "short", day: "numeric" });
}
/** Subtle honesty chip for sections that still show sample data while real mode is on. */
export const EstChip = () => <span className="text-[9px] font-bold uppercase tracking-wide text-g-muted/70 border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>;

/** ── FAIXA DE AMOSTRA (2026-08-20) ─────────────────────────────────────────────────────────────
 *  Onze telas do cockpit ainda desenham dado gerado (fila de espera, equipe, cozinha, pedidos ao
 *  vivo, leads…). Enquanto o motor real não existe para elas, o cliente PAGANTE via números com
 *  cara de operação dele — e é aí que nasce o pedido de reembolso: não por faltar recurso, mas por
 *  ter parecido que existia. A faixa não conserta o motor; ela impede a mentira.
 *  🚨 SÓ APARECE EM MODO REAL. Em demonstração o cockpit inteiro é declaradamente amostra, e
 *  repetir o aviso ali seria ruído sobre algo que a pessoa já sabe. */
export function FaixaAmostra({ real, oQue }) {
  if (!real) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 backdrop-blur-sm">
      <span className="mt-[1px] text-[13px] leading-none">🧪</span>
      <p className="text-[11.5px] leading-relaxed text-g-muted">
        {tr("This screen still shows a sample layout — there is no live feed behind it yet.")}
        {oQue ? ` ${oQue}` : ""}
      </p>
    </div>
  );
}

// Per-tone accent moment for panels: a soft top tick + faint wash so each major
// panel reads in its semantic color (green = money, gold = premium) without neon.
const CARD_TONE = {
  green: { tick: "linear-gradient(90deg,transparent,rgba(79,176,124,0.55),transparent)", glow: "0 0 14px rgba(62,148,104,0.45)", wash: "radial-gradient(120% 55% at 50% 0%, rgba(62,148,104,0.07), transparent 62%)" },
  gold:  { tick: "linear-gradient(90deg,transparent,rgba(214,194,154,0.5),transparent)",  glow: "0 0 14px rgba(214,194,154,0.38)", wash: "radial-gradient(120% 55% at 50% 0%, rgba(214,194,154,0.06), transparent 62%)" },
  red:   { tick: "linear-gradient(90deg,transparent,rgba(248,113,113,0.45),transparent)", glow: "0 0 12px rgba(248,113,113,0.35)", wash: "radial-gradient(120% 55% at 50% 0%, rgba(248,113,113,0.05), transparent 62%)" },
};
export function Card({ children, className = "", tone }) {
  const t = tone ? CARD_TONE[tone] : null;
  return (
    <div className={`relative rounded-xl2 border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 ${className}`}>
      {t && <span aria-hidden className="pointer-events-none absolute inset-x-4 top-0 h-px rounded-full" style={{ background: t.tick, boxShadow: t.glow }} />}
      {t && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl2" style={{ background: t.wash }} />}
      {children}
    </div>
  );
}
// Portal-only motion/glow utilities (CSS keyframes; reduced-motion guarded).
const PORTAL_FX = `
.money-glow{ text-shadow:0 0 16px rgba(79,176,124,.45), 0 0 40px rgba(62,148,104,.22); }
.gold-glow{ text-shadow:0 0 14px rgba(214,194,154,.40), 0 0 34px rgba(214,194,154,.16); }
.num{ font-variant-numeric:tabular-nums; }
.live-dot{ box-shadow:0 0 8px rgba(79,176,124,.85); }
@keyframes fx-rowin{ from{ opacity:0; transform:translateX(-8px); } to{ opacity:1; transform:none; } }
.row-in{ animation:fx-rowin .35s cubic-bezier(.22,.61,.36,1) both; }
@keyframes fx-plant{ from{ opacity:0; transform:scale(.65); } to{ opacity:1; transform:scale(1); } }
.plant-stage{ animation:fx-plant .6s cubic-bezier(.22,.61,.36,1) both; transition:transform .3s ease; }
@keyframes fx-guibreathe{
  0%,100%{ box-shadow:0 0 14px rgba(255,138,51,.45), 0 0 0 1px rgba(255,138,51,.3), 0 6px 18px rgba(0,0,0,.45); }
  50%{ box-shadow:0 0 28px rgba(255,138,51,.75), 0 0 0 1px rgba(255,138,51,.5), 0 6px 18px rgba(0,0,0,.45); }
}
.gui-breathe{ animation:fx-guibreathe 3.4s ease-in-out infinite; }
.clicky{ transition:border-color .18s ease, background-color .18s ease, transform .18s ease, box-shadow .18s ease; }
.clicky:hover{ border-color:rgba(255,255,255,.22); background-color:rgba(255,255,255,.055); transform:translateY(-1px); }
.clicky:active{ transform:translateY(0); }
@media (prefers-reduced-motion: reduce){
  .row-in{ animation:none !important; }
  .plant-stage{ animation:none !important; }
  .gui-breathe{ animation:none !important; }
  .clicky:hover{ transform:none; }
}
`;
// Consistent empty state for any list that can run dry.
export function Empty({ icon = "✅", text }) {
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
    <div className="fixed bottom-36 md:bottom-20 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
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
export function Drawer({ open = true, title, subtitle, badge, fields = [], note, actions, onClose, children }) {
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
        className="fixed top-0 right-0 z-50 h-full w-full sm:max-w-sm bg-g-cream/95 backdrop-blur-xl border-l border-white/15 shadow-2xl overflow-y-auto flex flex-col outline-none">
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
export function MiniStats({ items }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(([label, value, tone], i) => (
        <Card key={i} className="py-3.5">
          <div className="text-[10px] uppercase tracking-wide text-g-muted">{tr(label)}</div>
          <div className={`text-lg font-extrabold num mt-0.5 ${tone === "good" ? "text-g-green money-glow" : tone === "bad" ? "text-red-400" : "text-g-word"}`}>{value}</div>
        </Card>
      ))}
    </div>
  );
}

// Infer which section an alert is about so "View →" jumps straight there.
export function alertTarget(text = "") {
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
export function scaleMoney(str, f) {
  const s = String(str);
  const m = s.match(/-?[\d,]+/);
  if (!m) return s;
  const n = Math.max(0, Math.round(parseInt(m[0].replace(/,/g, ""), 10) * f));
  return s.replace(m[0], n.toLocaleString());
}

// The "what should I do today to grow?" list — Guileo earns a % of growth, so the
// home screen leads with the concrete money moves, each linking to its module.
// Numbers are derived from the SAME data the modules show, so the home screen and
// the detail screens never disagree.
export function growthOps(V) {
  const wait = genWaitlist(V);
  const fups = genFollowups(V);
  const recur = genRecurring(V);
  const pay = genPayments(V).filter((p) => p.status !== "Paid");
  const pipeline = fups.reduce((s, r) => s + (r.value || 0), 0);
  const atRisk = recur.filter((r) => r.status === "At risk");
  const atRiskMo = atRisk.reduce((s, r) => s + (r.value || 0), 0);
  const outstanding = pay.reduce((s, r) => s + (r.amount || 0), 0);
  const slot = SECTOR_IQ[V.label]?.slot || 120;           // sector value per open slot
  const waitValue = wait.length * slot;                    // truthful, sector-scaled (no flat $1,240)
  const happy = (V.customers || genCustomers(V)).filter((c) => (c.rating || 5) >= 4).length || Math.min(12, (V.customers || []).length || 12);
  return [
    { ic: "💳", view: "payments", text: tr(pay.length === 1 ? "invoice to collect" : "invoices to collect"), n: pay.length, value: `$${outstanding.toLocaleString()}` },
    { ic: "🪑", view: "waitlist", text: tr(wait.length === 1 ? "person waiting for an open slot" : "people waiting for an open slot"), n: wait.length, value: `$${waitValue.toLocaleString()}` },
    { ic: "🎯", view: "followups", text: tr(fups.length === 1 ? "follow-up about to convert" : "follow-ups about to convert"), n: fups.length, value: `$${pipeline.toLocaleString()}` },
    { ic: "🛟", view: "recurring", text: tr(atRisk.length === 1 ? "at-risk plan to save this week" : "at-risk plans to save this week"), n: atRisk.length, value: `$${atRiskMo}/mo` },
    { ic: "⭐", view: "reputation", text: tr("happy customers to ask for a review"), n: happy, value: "+rating" },
  ].filter((o) => o.n > 0);
}

// Unified recent-activity feed — the latest things you + Gui actually did, across tabs.
export function recentActivity(V) {
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
export function dailyBriefing(V) {
  const alerts = V.alerts ? V.alerts.items.length : 0;
  const outstanding = genPayments(V).filter((p) => p.status !== "Paid").reduce((s, r) => s + (r.amount || 0), 0);
  const fc = genForecast(V);
  const bits = [];
  bits.push(alerts ? `${alerts} ${tr(alerts !== 1 ? "things need you" : "thing needs you")}` : tr("you're all caught up"));
  if (outstanding) bits.push(`$${outstanding.toLocaleString()} ${tr("to collect")}`);
  const iq = SECTOR_IQ[V.label];
  if (iq) bits.push(tr(iq.brief));                 // the sector's signature daily signal
  bits.push(`${tr(fc.peak)} ${tr("looks busiest")}`);
  return bits.join(" · ");
}
// R4 — auto weekly recap Gui writes itself, derived from the Impact ledger + created records.
export function weeklySummary(V) {
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
export const loadAutomations = (L) => portalApi.loadState(autoKey(L), []);
function addAutomation(L, rec) { const cur = loadAutomations(L); portalApi.saveState(autoKey(L), [{ ...rec, _id: Date.now(), on: true }, ...cur].slice(0, 12)); }
export function toggleAutomation(L, id) { const cur = loadAutomations(L); portalApi.saveState(autoKey(L), cur.map((a) => (a._id === id ? { ...a, on: !a.on } : a))); }
export function removeAutomation(L, id) { portalApi.saveState(autoKey(L), loadAutomations(L).filter((a) => a._id !== id)); }
function setAutoLastRun(L, id) { const cur = loadAutomations(L); portalApi.saveState(autoKey(L), cur.map((a) => (a._id === id ? { ...a, lastRun: Date.now() } : a))); }
// Run one PLAN entry: prepare the work inside the cockpit (records + Impact ledger).
// HONESTY (2026-08): this touches LOCAL state only — it drafts and logs, it does not send a
// single message. Every verb below therefore says "prepared/drafted", never "sent/chased":
// the real sending engines are server-side (SERVER_AUTOMATIONS / functions/api/automations.js)
// and have no on/off switch in this UI. The toast that shows these strings reads "Gui <msg>".
export function runAutomation(V, a) {
  const s = (a.what || "").toLowerCase(); const L = V.label;
  let msg;
  if (/overdue|chase|cobr|invoice|fatur/.test(s)) { const open = genPayments(V).filter((p) => p.status !== "Paid"); logImpact(L, `Plan · collection list prepared (${open.length})`, 0); msg = `prepared the list of ${open.length} overdue invoice${open.length !== 1 ? "s" : ""} — nothing was sent`; }
  else if (/review|avali/.test(s)) { (V.customers || genCustomers(V)).slice(0, 3).forEach((c) => pushCreated(L, "reviewreq", { name: c.name, ch: c.channel })); logImpact(L, "Plan · 3 review requests drafted", 0); msg = "drafted 3 review requests for you to send"; }
  else if (/promo|campaign/.test(s)) { pushCreated(L, "campaigns", { name: "Planned promo", channel: "Email", sent: 0, opened: 0, revenue: 0, status: "Draft" }); logImpact(L, "Plan · promo drafted", 0); msg = "drafted a promo — review it before it goes out"; }
  else if (/follow|nudge/.test(s)) { logImpact(L, "Plan · warm-lead follow-up listed", 0); msg = "listed the warm leads to follow up"; }
  else if (/post|instagram|social/.test(s)) { logImpact(L, "Plan · social post drafted", 0); msg = "drafted a social post"; }
  else { msg = "put together your recap"; }
  setAutoLastRun(L, a._id);
  logUsage(2, `Automation · ${a.what}`);
  return msg;
}
// Cadence → minimum ms between runs. A "due" automation has never run or is past its window.
const CADENCE_MS = { daily: 864e5, weekly: 6048e5, monthly: 2592e6 };
function cadenceMs(when) { const w = (when || "").toLowerCase(); if (/dia|daily|day/.test(w)) return CADENCE_MS.daily; if (/m[êe]s|month/.test(w)) return CADENCE_MS.monthly; return CADENCE_MS.weekly; }
export function dueAutomations(V) { const now = Date.now(); return loadAutomations(V.label).filter((a) => a.on && (!a.lastRun || now - a.lastRun >= cadenceMs(a.when))); }



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
    ["Uber Eats", "🛵", "#06C167", "Accepts, preps and dispatches Uber Eats orders automatically", "Aceita, prepara e despacha pedidos do Uber Eats automaticamente", true],
    ["DoorDash", "🚪", "#FF3008", "Auto-accepts DoorDash orders and keeps the menu in sync", "Aceita pedidos do DoorDash e mantém o cardápio sincronizado", false],
    ["Grubhub", "🍔", "#F63440", "Handles Grubhub orders and replies to customers", "Cuida dos pedidos do Grubhub e responde clientes", false],
    ["iFood", "🔴", "#EA1D2C", "Manages iFood orders, ratings and promos", "Gerencia pedidos, avaliações e promoções do iFood", false],
    ["OpenTable", "📅", "#DA3743", "Fills tables, confirms reservations and kills no-shows", "Enche mesas, confirma reservas e acaba com no-shows", false],
  ],
  "Clinic": [
    ["Dentrix", "🦷", "#0090DA", "Books recalls, confirms appointments, syncs patient charts", "Agenda retornos, confirma consultas, sincroniza prontuários", true],
    ["Open Dental", "🦷", "#2E7D32", "Syncs the schedule and patient records two-way", "Sincroniza agenda e prontuários nos dois sentidos", false],
    ["Weave", "📞", "#5B34DA", "Routes calls, texts reminders, collects copays", "Encaminha ligações, lembra por SMS, cobra coparticipação", false],
    ["NexHealth", "🩺", "#4338CA", "Online booking, reminders and recall campaigns", "Agendamento online, lembretes e campanhas de retorno", false],
  ],
  "Medical": [
    ["Epic / EHR", "🩺", "#B11116", "Syncs records, confirms visits, files follow-ups", "Sincroniza prontuários, confirma visitas, registra retornos", true],
    ["Cerner", "🏥", "#00A6CE", "Two-way records + scheduling sync", "Sincroniza prontuários e agenda nos dois sentidos", false],
    ["Zocdoc", "🗓️", "#FFB81C", "Fills open slots from new-patient demand", "Preenche horários vagos com demanda de novos pacientes", false],
    ["athenahealth", "💉", "#7B2D8E", "Confirms visits, bills and chases balances", "Confirma visitas, fatura e cobra saldos", false],
  ],
  "Salon & Spa": [
    ["Mindbody", "💆", "#6C2EB9", "Books, rebooks and fills last-minute openings", "Agenda, reagenda e preenche vagas de última hora", true],
    ["Fresha", "💈", "#0E1B39", "Takes online bookings and deposits, cuts no-shows", "Recebe agendamentos e sinais online, reduz faltas", false],
    ["Vagaro", "💅", "#1FA67A", "Online booking, memberships and reminders", "Agendamento online, planos e lembretes", false],
    ["Booksy", "💇", "#00D1B2", "Fills the calendar from Booksy's marketplace", "Enche a agenda com o marketplace do Booksy", false],
  ],
  "Law Firm": [
    ["Clio", "⚖️", "#1F3A93", "Intakes leads, schedules consults, logs matters", "Capta leads, marca consultas, registra processos", true],
    ["MyCase", "📑", "#1A73E8", "Syncs cases, deadlines and client messages", "Sincroniza casos, prazos e mensagens de clientes", false],
    ["DocuSign", "✍️", "#FFB200", "Sends and chases engagement letters & e-signatures", "Envia e cobra contratos e assinaturas eletrônicas", false],
    ["LawPay", "💳", "#2E7D32", "Sends trust-compliant payment links and chases them", "Envia links de pagamento e cobra com segurança", false],
  ],
  "Real Estate": [
    ["Zillow", "🏠", "#006AFF", "Captures and instantly replies to property leads", "Capta e responde na hora os leads de imóveis", true],
    ["MLS", "🗂️", "#2E5AAC", "Syncs listings and alerts buyers on new matches", "Sincroniza imóveis e avisa compradores de novidades", false],
    ["DocuSign", "✍️", "#FFB200", "Sends offers and closes paperwork by e-signature", "Envia propostas e fecha papelada por assinatura digital", false],
    ["Follow Up Boss", "📇", "#FF6B00", "Nurtures every lead until they tour or buy", "Nutre cada lead até a visita ou a compra", false],
  ],
  "Gym & Fitness": [
    ["Mindbody", "💪", "#6C2EB9", "Books classes, recovers cancellations, wins back lapsed members", "Agenda aulas, recupera cancelamentos, reativa ex-alunos", true],
    ["ClassPass", "🤸", "#0B2A3C", "Fills empty class spots from new-member demand", "Preenche vagas de aulas com demanda de novos alunos", false],
    ["Glofox", "🏋️", "#2F80ED", "Memberships, bookings and billing on autopilot", "Planos, agendamentos e cobrança no automático", false],
    ["Trainerize", "📲", "#1FA463", "Onboards members and keeps them engaged", "Integra alunos e mantém o engajamento", false],
  ],
  "Auto Dealership": [
    ["DealerSocket", "🚗", "#E11B22", "Replies to leads, books test-drives, follows up on quotes", "Responde leads, agenda test-drives, faz follow-up de orçamentos", true],
    ["CarGurus", "🚙", "#1E7B47", "Captures listing inquiries and books appointments", "Capta interessados nos anúncios e agenda visitas", false],
    ["CDK Global", "🔧", "#D6002A", "Syncs inventory, service and deal data", "Sincroniza estoque, serviço e dados de venda", false],
    ["AutoTrader", "🚘", "#003B7E", "Replies to AutoTrader shoppers instantly", "Responde compradores do AutoTrader na hora", false],
  ],
  "Plumbing & HVAC": [
    ["ServiceTitan", "🔧", "#0B5FFF", "Books jobs, dispatches techs, sends 'on the way' texts", "Agenda serviços, despacha técnicos, avisa 'a caminho'", true],
    ["Jobber", "🧰", "#1FA463", "Quotes, schedules and collects payment on site", "Orça, agenda e cobra no local", false],
    ["Housecall Pro", "🚐", "#2563EB", "Online booking, dispatch and follow-ups", "Agendamento online, despacho e follow-ups", false],
    ["Angi", "🛠️", "#FF6153", "Captures and instantly responds to Angi leads", "Capta e responde na hora os leads do Angi", false],
  ],
  "Education": [
    ["Canvas LMS", "📚", "#E72429", "Answers student questions, books trials, nudges enrollments", "Responde alunos, agenda aulas teste, puxa matrículas", true],
    ["Zoom", "🎥", "#2D8CFF", "Schedules classes and sends join links automatically", "Agenda aulas e envia os links automaticamente", false],
    ["Google Classroom", "🏫", "#1E8E3E", "Syncs classes, assignments and reminders", "Sincroniza turmas, tarefas e lembretes", false],
    ["Moodle", "🎓", "#F88012", "Enrolls students and nudges course progress", "Matricula alunos e estimula o progresso", false],
  ],
  "Construction": [
    ["Procore", "🏗️", "#F47E20", "Logs estimates, schedules site visits, chases approvals", "Registra orçamentos, agenda visitas, cobra aprovações", true],
    ["Buildertrend", "🧱", "#1C6FB7", "Keeps clients updated and collects draw payments", "Mantém clientes informados e cobra parcelas da obra", false],
    ["CoConstruct", "📐", "#2E7D32", "Syncs budgets, selections and client comms", "Sincroniza orçamentos, escolhas e comunicação", false],
    ["Houzz Pro", "🏡", "#4DBC15", "Captures project leads and books consults", "Capta leads de projeto e agenda consultas", false],
  ],
  "E-Commerce": [
    ["WooCommerce", "🛒", "#7F54B3", "Syncs WooCommerce orders and recovers carts", "Sincroniza pedidos do WooCommerce e recupera carrinhos", true],
    ["Klaviyo", "✉️", "#232426", "Runs win-back & post-purchase flows on autopilot", "Roda fluxos de recompra e pós-venda no automático", false],
    ["Amazon", "📦", "#FF9900", "Answers buyer messages and manages orders", "Responde mensagens de compradores e gerencia pedidos", false],
    ["Mercado Livre", "🟡", "#FFE600", "Replies to questions and handles orders & reviews", "Responde perguntas e cuida de pedidos e avaliações", false],
  ],
};
// Sector onboarding — the tools Guileo auto-connects on day one for each trade,
// so a new account reaches first value in minutes (activation = trial→paid $).
export const SECTOR_ONBOARD = {
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
export function genIntegrations(V) {
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








/* ───────────────────────── Sector screens (restaurant + reusable) ───────────────────────── */

// ── Living plant — the Guileo mark, alive in the sidebar. Its growth stage follows THIS
// month's results (plan usage), so the brand plant literally blooms as the client wins:
// seed → sprout → leafy → blooming. Demo mode grows on the demo numbers.
const PLANT_STAGES = ["🌰", "🌱", "🌿", "🌸"];
function PlantBloom({ V, real = null }) {
  if (!V.plan) return null;
  // If the owner set a monthly booking goal, the plant blooms with GOAL progress (their own
  // target beats plan usage as the "am I winning?" signal); otherwise the plan-usage stage.
  const og = ownerGoalProgress(V, real);
  const pct = og ? Math.round(og.pct * 100) : Math.min(100, Math.round((V.plan.used / (V.plan.total || 1)) * 100));
  const stage = pct >= 75 ? 3 : pct >= 40 ? 2 : pct >= 12 ? 1 : 0;
  const grew = weeklySummary(V).created || vnum(V.label, "wkc", 6, 24);
  return (
    <div className="rounded-xl2 border border-g-green/20 bg-g-green/[0.05] p-3 flex items-center gap-2.5">
      {/* key={stage} remounts the emoji on a stage change so the grow-in transition plays */}
      <span key={stage} className="plant-stage grid place-items-center h-9 w-9 rounded-full bg-g-green/10 text-xl shrink-0" aria-hidden>{PLANT_STAGES[stage]}</span>
      <div className="min-w-0 leading-tight">
        <div className="text-[11px] font-bold text-g-word">{tr("Your Gui is growing")}</div>
        <div className="text-[10px] text-g-muted mt-0.5">{tr("Your Gui grew")} {grew} {tr("bookings this week")}</div>
      </div>
    </div>
  );
}

// Reusable loading skeleton for the data-loading sections (cement shimmer, mirrors the
// real layout: 3 stat cards + a list) — shown while real data is in flight so the section
// never flashes empty/$0. aria-hidden (it's purely visual placeholder).
export function SectionSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl2 border border-white/10 bg-white/[0.04] p-5"><div className="h-3 w-20 rounded bg-white/10" /><div className="mt-3 h-7 w-24 rounded bg-white/10" /></div>
        ))}
      </div>
      <div className="rounded-xl2 border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10"><div className="h-3 w-28 rounded bg-white/10" /></div>
        <div className="divide-y divide-white/[0.06]">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5"><div className="h-9 w-9 rounded-full bg-white/10" /><div className="flex-1"><div className="h-3 w-1/3 rounded bg-white/10" /><div className="mt-2 h-2.5 w-1/4 rounded bg-white/[0.07]" /></div><div className="h-5 w-14 rounded-full bg-white/10" /></div>
          ))}
        </div>
      </div>
    </div>
  );
}
// Honest failure state — a network/RPC error no longer looks like "no data"; Gui offers a retry.
export function RetryState({ onRetry }) {
  return (
    <Card className="text-center py-10">
      <div className="text-2xl">📡</div>
      <div className="mt-2 text-sm font-bold text-g-word">{tr("I couldn't load this just now.")}</div>
      <div className="text-xs text-g-muted mt-0.5">{tr("Check your connection — I'll try again.")}</div>
      <button onClick={onRetry} className="btn-bright text-sm mt-4">{tr("↻ Try again")}</button>
    </Card>
  );
}

// Sub-tab strip shown at the top of the revenue dept views (Finance / Marketing / Growth).
// Folds the old flat nav items (payments, campaigns, audiences, follow-ups, recurring,
// loyalty, reputation, waitlist) under their parent dept — the sidebar stays lean, the
// detail is one tap away. `cur` highlights the active parent; the rest navigate via onNav.
export function DeptTabs({ cur, onNav, items }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([key, label]) => (
        <button key={key} onClick={() => key !== cur && onNav?.(key)}
          className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${key === cur ? "bg-g-gold/15 border border-g-gold/40 text-g-gold" : "border border-white/15 text-g-muted hover:text-g-word hover:border-g-gold/30"}`}>
          {tr(label)}
        </button>
      ))}
    </div>
  );
}

// Documents area (client portal profile) — every contract & quote the tenant has, signed or pending.

// Growth & Retention department — turns churn-risk + lapsed contacts into 1-tap win-back. Demo synthesizes.

// Finance department — invoices / A/R on the live spine (crm_invoices). Demo synthesizes.

// Marketing department — segment-targeted campaigns on the live spine (crm_campaigns). Demo synthesizes.



// Unified omnichannel inbox feed — every channel normalized to the same shape so
// the operator thinks in "conversations", not "which app". Names/threads draw from
// the sector's own data so it reads true everywhere.
export function genInbox(V) {
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
export function convoAction(V) {
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
export function ConvoActions({ V, who, channel, onNav, onDone }) {
  const act = convoAction(V);
  const cfg = deliveryCfg(V);
  const fire = (msg, view) => { toast(msg); onDone?.(); if (view) onNav?.(view); };
  const firePrimary = () => { const rec = recordFor(act.view, who, channel, V); if (rec) pushCreated(V.label, act.view, rec); fire(`${act.done} from ${who}'s ${channel} ✓ — see it in the tab`, act.view); };
  const fireDelivery = () => { const rec = recordFor("deliveries", who, channel, V); pushCreated(V.label, "deliveries", rec); fire(`${who} sent to ${deliveryTab(V).toLowerCase()} ✓ — see it in the tab`, "deliveries"); };
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={firePrimary} className="text-[11px] font-bold rounded-full border border-g-green/40 bg-g-green/[0.1] px-3 py-1.5 text-g-green hover:bg-g-green/20 transition">{act.label}</button>
      <button onClick={fireDelivery} className="text-[11px] font-bold rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-g-word hover:border-g-gold/40 transition">{cfg.partners.length ? "🚚 To delivery" : "📍 Dispatch"}</button>
      <button onClick={() => fire(`${who} added to follow-ups ✓`, "followups")} className="text-[11px] font-bold rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-g-word hover:border-g-gold/40 transition">⏰ Follow-up</button>
      <button onClick={() => fire(`Saved to ${who}'s customer profile ✓`, "customers")} className="text-[11px] font-bold rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-g-word hover:border-g-gold/40 transition">👤 Save to customer</button>
    </div>
  );
}

export function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} className={`relative h-5 w-9 rounded-full transition-all cursor-pointer ${on ? "bg-g-green shadow-[0_0_10px_rgba(62,148,104,0.5)]" : "bg-white/15 hover:bg-white/25"}`} role="switch" aria-checked={on}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${on ? "left-[18px] bg-white" : "left-0.5 bg-white/70"}`} />
    </button>
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
export function kbMatch(q, kb) {
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
export function defProfile(V) {
  return { name: V.business.name, place: V.business.place, hours: "Mon–Sun, 9am–10pm", phone: "" };
}
const profBiz = (p) => `We're ${p.name}, located at ${p.place}. I can send directions on WhatsApp — want them?`;
const profHours = (p) => `We're open ${p.hours}. Want me to book you in?`;
// Save the profile AND re-sync the AI's location+hours answers in the KB, so any
// edit (Settings or onboarding) is immediately reflected by the trained AI.
export function syncProfile(label, V, profile) {
  portalApi.saveProfile(label, profile);
  const kb = portalApi.loadKB(label, seedKB(V, profile)).map((e) =>
    e.id === "biz" ? { ...e, answer: profBiz(profile) } : e.id === "hours" ? { ...e, answer: profHours(profile) } : e
  );
  portalApi.saveKB(label, kb);
}

// ── Onboarding → LIVE agent (REAL clients only) ─────────────────────────────
// The wizard's answers used to be cosmetic (local demo state only). For a REAL
// logged-in client (session + connection code), persist them through the SAME
// path the AI Brain tab uses — profile + KB via portalApi.saveProfile/saveKB,
// then POST /api/sync-agent (the existing Loop-2 endpoint that PATCHes the
// client's live ElevenLabs agent) — so their actual Gui learns the business
// type, name and covered channels the moment onboarding finishes.
// Returns true only when the answers were pushed to the real save path.
// Best-effort everywhere: onboarding must NEVER block on a failed save.
export function syncOnboardingToAgent(me, vid, extra = {}) {
  try {
    const email = (me?.email || "").toString().trim().toLowerCase();
    const key = loadDataKey();
    if (!email.includes("@") || !key || me?.demo) return false; // demo / not connected → local-only (behavior unchanged)
    const OV = VERTICALS[vid];
    if (!OV) return false;
    // 1) Merge the answers into the SAME profile + KB stores the AI Brain reads/saves.
    const prof = { ...defProfile(OV), ...portalApi.loadProfile(OV.label, defProfile(OV)) };
    if (extra.name) prof.name = extra.name;
    prof.industry = OV.label;               // business type chosen in the wizard (AIBrain sends prof.industry)
    syncProfile(OV.label, OV, prof);        // saves profile + refreshes the biz/hours KB answers
    let kb = portalApi.loadKB(OV.label, seedKB(OV, prof));
    const channels = Array.isArray(extra.channels) ? extra.channels.filter(Boolean) : [];
    if (channels.length) {
      const entry = { id: "onb_channels", topic: "Channels we cover", triggers: "channel whatsapp instagram sms call phone text reach contact", answer: `Customers can reach us on: ${channels.join(", ")} — we answer 24/7 on every one of them.`, locked: false };
      kb = kb.some((e) => e.id === "onb_channels") ? kb.map((e) => (e.id === "onb_channels" ? entry : e)) : [...kb, entry];
      portalApi.saveKB(OV.label, kb);
    }
    // 2) Push to the live voice agent — the exact payload shape AIBrain.syncLiveAgent sends.
    const brain = (kb.map((e) => `${e.topic || ""}${e.triggers ? ` (${e.triggers})` : ""}: ${e.answer || ""}`).filter((s) => s.replace(/[^a-z0-9]/gi, "").length > 2).join("\n")
      + (extra.owner ? `\nOwner: ${extra.owner}.` : "")).slice(0, 4000);
    fetch("/api/sync-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key, brain, business: prof.name || OV.business?.name || "", industry: OV.label || "", lang: UI_LANG }) }).catch(() => { /* agent will pick it up on the next Brain save */ });
    return true;
  } catch { return false; } // never block the wizard on persistence
}

// Default seed: pull real facts out of the vertical (+ saved profile) so every
// sector starts smart.
export function seedKB(V, profile = defProfile(V)) {
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

export function aiAnswer(q, V, kb) {
  const hit = kb && kbMatch(q, kb);
  if (hit) return hit.answer;
  const s = q.toLowerCase();
  if (/deliver|entrega/.test(s)) return "Yes, we deliver 🛵 — just send your address and order and I'll confirm the ETA.";
  return `Great question! I'd handle that right away for ${V.business.name} and book or answer accordingly. (Add this to your knowledge base below so I nail it every time.)`;
}






// What customers ask the AI, the missed-revenue insights, and sample transcripts —
// all per-sector so AI Analytics reads true for a clinic or a law firm, not just a restaurant.
export const BOOK_WORD = { "Restaurant": "a table", "Clinic": "an appointment", "Medical": "an appointment", "Salon & Spa": "an appointment", "Gym & Fitness": "a session", "Law Firm": "a consultation", "Real Estate": "a viewing", "Plumbing & HVAC": "a visit", "Auto Dealership": "a service slot", "Education": "a class", "Construction": "an estimate", "E-Commerce": "an order" };
export function aiIntents(V) {
  const primary = { "Restaurant": "Booking / reservation", "Clinic": "Appointment booking", "Medical": "Appointment booking", "Salon & Spa": "Appointment booking", "Gym & Fitness": "Class / session booking", "Law Firm": "Consultation request", "Real Estate": "Viewing request", "Plumbing & HVAC": "Service request", "Auto Dealership": "Service / test-drive", "Education": "Enrollment request", "Construction": "Estimate request", "E-Commerce": "Order / status" }[V.label] || "Booking request";
  return [[primary, 41], ["Hours & location", 22], ["Pricing", 18], ["Status / follow-up", 12], ["Complaint", 7]];
}
export function aiMissed(V) {
  const iq = SECTOR_IQ[V.label];
  if (iq) return [...iq.missed, "Demand peaks beyond capacity at busy hours — push the waitlist / pre-booking to capture it."];
  const svc = (V.ops?.list?.[0]?.name) || "a service";
  return [
    `3 callers asked for ${svc.toLowerCase()}-adjacent services you don't offer yet — a possible new revenue line.`,
    "Demand peaks beyond capacity at busy hours — push the waitlist / pre-booking to capture it.",
    "5 pricing questions didn't convert — a small, well-timed offer could win them back.",
  ];
}
// Proactive AI recommendations — each one applies in a click and lands in its tab.
export function genRecommendations(V) {
  const iq = SECTOR_IQ[V.label];
  const t = iq ? iq.recs : ["Your quietest weekday runs ~30% below capacity — a targeted promo fills it.", "A dozen happy customers haven't been asked for a review yet — reviews drive new demand.", "Several customers lapsed in the last 30 days — a win-back sequence recovers ~1 in 4."];
  return [
    { ic: "📣", text: t[0], cta: "Launch promo", view: "campaigns", apply: (onNav) => { onNav?.("campaigns"); toast("Opening Campaigns — type your offer in ⚡ Flash Campaign, preview who'll get it, then send for real"); } },
    { ic: "⭐", text: t[1], cta: "Request reviews", view: "reputation", apply: (onNav) => { (V.customers || genCustomers(V)).slice(0, 3).forEach((c) => pushCreated(V.label, "reviewreq", { name: c.name, ch: c.channel })); toast("Review blast queued ✓"); onNav?.("reputation"); } },
    { ic: "🔁", text: t[2], cta: "Start win-back", view: "followups", apply: (onNav) => { toast("Win-back sequence started ✓"); onNav?.("followups"); } },
  ];
}
// Predictive AI — demand forecast + no-show risk, derived deterministically per sector.
export function genForecast(V) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const load = days.map((d) => vnum(V.label, `fc${d}`, 45, 130));
  const peakIdx = load.indexOf(Math.max(...load));
  const lowIdx = load.indexOf(Math.min(...load));
  const risk = (V.ops?.schedule || []).filter((r) => /pending|new|risk|follow|unconfirmed/i.test(r.status)).slice(0, 3).map((r) => r.name);
  return { days, load, peak: days[peakIdx], peakLoad: load[peakIdx], low: days[lowIdx], risk };
}
// How the business stacks up vs its sector average — deterministic, all favorable.
export function genBenchmarks(V) {
  return [
    { label: "AI response time", you: "under 5s", avg: "4 min", delta: "60× faster", better: true },
    { label: "No-show rate", you: `${vnum(V.label, "bmns", 3, 7)}%`, avg: `${vnum(V.label, "bmnsavg", 14, 22)}%`, delta: "less than half", better: true },
    { label: "Repeat-customer rate", you: `${vnum(V.label, "bmrep", 38, 52)}%`, avg: `${vnum(V.label, "bmrepavg", 22, 31)}%`, delta: "well above", better: true },
    { label: "Reviews per month", you: `${vnum(V.label, "bmrev", 60, 130)}`, avg: `${vnum(V.label, "bmrevavg", 14, 30)}`, delta: "3–4×", better: true },
  ];
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
      <div className="fixed left-1/2 top-20 sm:top-24 -translate-x-1/2 z-50 w-[92%] max-w-lg rounded-xl3 border border-white/15 bg-g-cream/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10"><FaMagnifyingGlass size={13} className="text-g-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("Search or run a command")} placeholder={tr("Search or run a command…")} className="flex-1 bg-transparent text-sm text-g-word placeholder:text-g-muted outline-none" /><span className="text-[10px] text-g-muted border border-white/15 rounded px-1.5 py-0.5">ESC</span></div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {res.length ? res.map((it, i) => (
            <button key={i} onClick={() => { if (it.run) it.run(); else { onNav(it.key); onClose(); } }} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.06] transition">
              <span className="text-base w-5 text-center text-g-gold">{it.icon}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{it.label}</div><div className="text-[11px] text-g-muted truncate">{it.sub}</div></div>
              {it.run && <span className="text-[9px] font-black uppercase text-g-gold bg-g-gold/15 rounded px-1.5 py-0.5">{tr("Run")}</span>}
            </button>
          )) : <div className="px-3 py-6 text-center text-xs text-g-muted">{tr("No matches")}</div>}
        </div>
      </div>
    </>
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
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-md rounded-xl3 border border-white/15 bg-g-cream/95 backdrop-blur-xl p-7 shadow-lift text-center">
        <div className="flex gap-1.5 mb-5 justify-center">{steps.map((_, k) => <div key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-g-green" : "w-1.5 bg-white/15"}`} />)}</div>
        <div className="text-5xl mb-3">{s.ic}</div>
        <div className="text-lg font-extrabold text-g-word">{tr(s.title)}</div>
        <p className="text-sm text-g-muted mt-2 leading-relaxed">{tr(s.text)}</p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={onDone} className="text-[11px] font-bold text-g-muted hover:text-g-word">{tr("Skip tour")}</button>
          <button onClick={advance} className="btn-bright text-sm px-6">{tr(last ? "Got it — let's go →" : "Next →")}</button>
        </div>
      </motion.div>
    </div>
  );
}

// Onboarding-to-first-value: connect one real tool → watch Gui do one real sector task → first win.
function FirstValue({ V, onNav, onDone }) {
  const onb = SECTOR_ONBOARD[V.label];
  const suggested = (onb?.auto || ["WhatsApp"])[0];
  const act = convoAction(V);
  const [step, setStep] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [running, setRunning] = useState(false);
  const connect = () => { setConnecting(true); const stack = portalApi.loadState(`${V.label}:stack`, {}); portalApi.saveState(`${V.label}:stack`, { ...stack, [suggested]: true }); setTimeout(() => { setConnecting(false); setStep(1); }, 700); };
  const runTask = () => { setRunning(true); const target = (V.customers || genCustomers(V))[0]?.name || "New customer"; const rec = recordFor(act.view, target, "Gui", V); if (rec) pushCreated(V.label, act.view, rec); setTimeout(() => { setRunning(false); setStep(2); }, 900); };
  const seeIt = () => { onNav(act.view); onDone(); };
  const finish = () => { onNav("overview"); onDone(); };
  const steps = [tr("Connect"), tr("Watch Gui work"), tr("First win")];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-sm px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-xl3 border border-white/15 bg-[#0c100d]/98 backdrop-blur-xl p-7 shadow-lift">
        <div className="flex items-center gap-2 mb-5">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={`h-1 w-full rounded-full transition-colors ${i <= step ? "bg-g-green" : "bg-white/15"}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wide ${i <= step ? "text-g-green" : "text-g-muted"}`}>{s}</span>
            </div>
          ))}
        </div>
        {step === 0 && (<>
          <div className="text-lg font-extrabold text-g-word">{tr("Let's get one tool live")}</div>
          <p className="text-xs text-g-muted mt-1">{tr("Connect")} <span className="text-g-light font-semibold">{suggested}</span> {tr("and Gui starts acting through it for you.")}</p>
          <div className="mt-4 flex items-center justify-between rounded-xl2 border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="text-sm font-semibold text-g-word">{suggested}</span>
            <button onClick={connect} disabled={connecting} className="btn-bright text-sm">{connecting ? tr("Connecting…") : tr("Connect →")}</button>
          </div>
          <button onClick={finish} className="block mx-auto mt-4 text-[11px] font-bold text-g-muted hover:text-g-word">{tr("Skip")}</button>
        </>)}
        {step === 1 && (<>
          <div className="text-lg font-extrabold text-g-word">{tr("Now watch Gui do real work")}</div>
          <p className="text-xs text-g-muted mt-1">{tr("Gui will")} {act.done.toLowerCase()} {tr("— a real record in your cockpit. This is what it does 24/7.")}</p>
          <button onClick={runTask} disabled={running} className="btn-bright text-sm w-full mt-4">{running ? tr("Gui is working…") : act.label}</button>
          <button onClick={finish} className="block mx-auto mt-3 text-[11px] font-bold text-g-muted hover:text-g-word">{tr("Skip")}</button>
        </>)}
        {step === 2 && (
          <div className="text-center py-2">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300 }} className="text-5xl mb-2">🎉</motion.div>
            <div className="text-lg font-extrabold text-g-word">{tr("First win — Gui just did that for you")}</div>
            <p className="text-xs text-g-muted mt-1">{act.done} ✓ {tr("It's in your cockpit now. Gui handles this around the clock.")}</p>
            <button onClick={seeIt} className="btn-bright text-sm w-full mt-5">{tr("See it →")}</button>
            <button onClick={finish} className="block mx-auto mt-3 text-[11px] font-bold text-g-muted hover:text-g-word">{tr("Go to my cockpit")}</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [vid, setVid] = useState("restaurant");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [contact, setContact] = useState("");
  const [chs, setChs] = useState({ "WhatsApp": true, "Phone calls": true, "Instagram": true, "SMS": false });
  const next = () => setStep((s) => s + 1);
  const captureLead = () => { try { fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: owner.trim() || name.trim(), business: name.trim(), contact: contact.trim(), phone: contact.trim(), channel: "Portal signup", industry: vid, lang: UI_LANG, source: "portal-onboard" }) }); } catch { /* never block */ } };
  const sendWelcome = () => {
    try {
      const c = contact.trim();
      if (!c.includes("@")) return; // only email a real email address
      const lang = (() => { const l = portalApi.loadState("portal_lang", "en"); return l === "pt" || l === "es" ? l : "en"; })();
      const who = (owner.trim() || name.trim() || "there").split(" ")[0];
      const biz = name.trim() || (lang === "pt" ? "seu negócio" : "your business");
      // Branded welcome email (graphite + champagne template) is rendered server-side.
      fetch("/api/welcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: c, name: who, business: biz, lang }) });
    } catch { /* never block */ }
  };
  return (
    <div className="min-h-screen grid place-items-center px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-xl3 border border-white/15 bg-white/[0.04] backdrop-blur-xl p-7 shadow-lift">
        <div className="flex gap-1.5 mb-5">{[0, 1, 2, 3].map((i) => <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-g-green" : "bg-white/15"}`} />)}</div>
        {step === 0 && (<>
          <div className="text-lg font-extrabold text-g-word">{tr("Welcome to Guileo 👋")}</div>
          <p className="text-xs text-g-muted mt-1">{tr("What kind of business are we growing?")}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
            {VERTICAL_KEYS.map((k) => (
              <button key={k} onClick={() => { setVid(k); setName(VERTICALS[k].business.name); next(); }} className="flex flex-col items-center gap-1 rounded-xl2 border border-white/10 bg-white/[0.03] p-3 hover:border-g-gold/50 hover:-translate-y-0.5 transition-all">
                <span className="text-2xl">{VERTICALS[k].icon}</span><span className="text-[10px] font-bold text-g-word text-center leading-tight">{VERTICALS[k].label}</span>
              </button>
            ))}
          </div>
        </>)}
        {step === 1 && (<>
          <div className="text-lg font-extrabold text-g-word">{tr("Tell us about you")}</div>
          <p className="text-xs text-g-muted mt-1">{tr("So Gui represents your business — and we can reach you.")}</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name (e.g. Bella Pizza)" className="mt-4 w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Your name" className="mt-3 w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Your WhatsApp / phone / email" className="mt-3 w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <button onClick={next} className="btn-bright text-sm w-full mt-4">{tr("Continue →")}</button>
        </>)}
        {step === 2 && (<>
          <div className="text-lg font-extrabold text-g-word">{tr("Which channels should your AI cover?")}</div>
          <p className="text-xs text-g-muted mt-1">{tr("Your AI answers 24/7 on every one you turn on.")}</p>
          <div className="mt-4 space-y-2">{Object.keys(chs).map((c) => (<div key={c} className="flex items-center justify-between rounded-xl2 border border-white/10 bg-white/[0.03] px-4 py-3"><span className="text-sm font-semibold text-g-word">{c}</span><Toggle on={chs[c]} onClick={() => setChs((x) => ({ ...x, [c]: !x[c] }))} /></div>))}</div>
          <button onClick={next} className="btn-bright text-sm w-full mt-4">{tr("Continue →")}</button>
        </>)}
        {step === 3 && (
          <div className="text-center py-3">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-lg font-extrabold text-g-word">{tr("You're all set")}, {name || tr("there")}!</div>
            <p className="text-xs text-g-muted mt-1">{tr("Your AI is live and your Growth Cockpit is ready.")}</p>
            <button onClick={() => { captureLead(); sendWelcome(); onDone(vid, { name: name.trim(), owner: owner.trim(), contact: contact.trim(), channels: Object.keys(chs).filter((c) => chs[c]) }); }} className="btn-bright text-sm w-full mt-5">{tr("Enter my cockpit →")}</button>
          </div>
        )}
        {step < 3 && <button onClick={() => onDone(vid)} className="block mx-auto mt-4 text-[11px] font-bold text-g-muted hover:text-g-word">{tr("Skip setup")}</button>}
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
  const demoEnter = () => { try { localStorage.setItem("guileo_portal_session", JSON.stringify({ email: "demo@guileoai.com", name: "Jane Staff", role: "Staff", demo: true, at: Date.now() })); } catch { /* */ } onEnter(); };
  return (
    <div className="min-h-screen grid place-items-center px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-xl3 border border-white/15 bg-white/[0.04] backdrop-blur-xl p-8 shadow-lift text-center">
        <img src={logo} alt="Guileo" className="h-12 w-12 object-contain mx-auto" />
        <div className="mt-3 text-xl font-black uppercase tracking-tight bg-gradient-to-r from-g-green via-g-gold to-g-green bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">{tr("Growth Cockpit")}</div>
        {confirm ? (
          <div className="mt-6">
            <div className="text-3xl mb-2">📬</div>
            <div className="text-sm font-extrabold text-g-word">{tr("Confirm your email")}</div>
            <p className="text-xs text-g-muted mt-1">{tr("We sent a confirmation to")} <span className="text-g-light font-semibold">{email}</span>{tr(". Click the link, then come back and sign in.")}</p>
            <button onClick={() => { setConfirm(false); setMode("signin"); }} className="mt-4 btn-bright text-sm w-full">{tr("I confirmed — sign in →")}</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-g-muted mt-1">{tr(CONNECTED ? (mode === "signup" ? "Create your account" : "Welcome back") : "Sign in to your private dashboard")}</p>
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-6 space-y-2.5 text-left">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label={tr("Email address")} placeholder="you@email.com" className="w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
              <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} aria-label={tr("Password")} placeholder={CONNECTED ? tr("Password (min 6 chars)") : tr("Password")} className="w-full rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
              <button disabled={busy} className="btn-bright text-sm w-full disabled:opacity-70">{busy ? "…" : tr(CONNECTED ? (mode === "signup" ? "Create account →" : "Sign in →") : "Enter Growth Cockpit →")}</button>
              {err && <div className="text-[11px] text-red-400 text-center">{err}</div>}
            </form>
            {CONNECTED && (
              <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(""); }} className="mt-3 text-xs font-bold text-g-gold hover:underline">
                {tr(mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account")}
              </button>
            )}
            <button onClick={demoEnter} disabled={busy} className="block mx-auto mt-3 text-xs font-bold text-g-muted hover:text-g-word disabled:opacity-60">{tr("▶ Enter demo (sample data)")}</button>
          </>
        )}
        <div className="mt-4 text-[11px] text-g-muted"><a href="/" className="hover:text-g-word">{tr("← Back to guileoai.com")}</a></div>
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
export function guiAlerts(V) {
  const out = [];
  // Sector signature alert — the visceral, this-is-MY-business hook (top of the radar).
  const iq = SECTOR_IQ[V.label];
  if (iq?.radar) { const n = iq.radar.n(V); if (n) out.push({ key: "sector", count: n, cmd: iq.radar.cmd, en: iq.radar.en(n), pt: iq.radar.pt(n), chipEn: iq.radar.chipEn, chipPt: iq.radar.chipPt, es: iq.radar.es ? iq.radar.es(n) : iq.radar.en(n), chipEs: iq.radar.chipEs || iq.radar.chipEn }); }
  const credits = portalApi.loadState("gui_credits", 250);
  if (credits < 50) out.push({ key: "lowcredit", count: 0, cmd: "open billing", en: `Gui credits are low (${credits} left) — top up so I never pause mid-task.`, pt: `Seus créditos do Gui estão baixos (${credits}) — recarregue pra eu não parar no meio.`, chipEn: "⚡ Top up", chipPt: "⚡ Recarregar", es: `Tus créditos de Gui están bajos (${credits}) — recarga para que no me detenga a mitad de tarea.`, chipEs: "⚡ Recargar" });
  const overdue = genPayments(V).filter((p) => p.status === "Overdue");
  if (overdue.length) out.push({ key: "overdue", count: overdue.length, cmd: "remind all overdue invoices", en: `${overdue.length} invoice${overdue.length !== 1 ? "s" : ""} overdue — want me to chase them?`, pt: `${overdue.length} fatura${overdue.length !== 1 ? "s" : ""} atrasada${overdue.length !== 1 ? "s" : ""} — quer que eu cobre?`, chipEn: "💳 Chase them", chipPt: "💳 Cobrar agora", es: `${overdue.length} factura${overdue.length !== 1 ? "s" : ""} vencida${overdue.length !== 1 ? "s" : ""} — ¿quieres que las cobre?`, chipEs: "💳 Cobrar ahora" });
  const waiting = genWaitlist(V).length;
  if (waiting) out.push({ key: "waitlist", count: waiting, cmd: "request reviews", en: `${waiting} people are on your waitlist — fill those slots before they leave.`, pt: `${waiting} pessoas na sua lista de espera — preencha essas vagas antes que saiam.`, chipEn: "📅 Fill slots", chipPt: "📅 Preencher vagas", es: `${waiting} personas en tu lista de espera — llena esos cupos antes de que se vayan.`, chipEs: "📅 Llenar cupos" });
  const follow = genFollowups(V).length;
  if (follow) out.push({ key: "followups", count: follow, cmd: "start follow-ups", en: `${follow} warm lead${follow !== 1 ? "s" : ""} waiting on a follow-up — I can nudge them now.`, pt: `${follow} lead${follow !== 1 ? "s" : ""} quente${follow !== 1 ? "s" : ""} esperando follow-up — posso cutucar agora.`, chipEn: "🔁 Nudge them", chipPt: "🔁 Cutucar", es: `${follow} lead${follow !== 1 ? "s" : ""} interesado${follow !== 1 ? "s" : ""} esperando seguimiento — puedo contactarlos ahora.`, chipEs: "🔁 Contactar" });
  // Suggest a missing high-value connection (count 0 — a suggestion, not an urgent count).
  const m = missingConnection(V);
  if (m) out.push({ key: "connect", count: 0, cmd: "open integrations", en: `${m[0]} isn't connected yet — link it and I'll ${m[3].toLowerCase()}.`, pt: `${m[0]} ainda não está conectado — conecte e eu ${m[4].toLowerCase()}.`, chipEn: "🔌 Connect it", chipPt: "🔌 Conectar", es: `${m[0]} aún no está conectado — conéctalo y me encargo del resto.`, chipEs: "🔌 Conectar" });
  return out;
}
// The most valuable tool the business hasn't connected yet (industry tool first, else a universal one).
function missingConnection(V) {
  const stack = portalApi.loadState(`${V.label}:stack`, {});
  const off = ([n, , , , , def]) => (stack[n] === undefined ? !def : !stack[n]);
  const sector = SECTOR_STACK[V.label] || [];
  return sector.find(off) || null;
}
// High-stakes = sends money or a customer-facing message → gate behind approval.
const HIGH_STAKES = new Set(["invoice", "deliver", "social", "campaign", "chaseall"]);
function approvalSummary(intent, pt) {
  const en = { invoice: "send an invoice with a payment link", deliver: "dispatch to delivery", social: "post to Instagram & Facebook", campaign: "launch a live promo", chaseall: "message everyone with overdue invoices" };
  const ptd = { invoice: "enviar uma fatura com link de pagamento", deliver: "mandar pra entrega", social: "publicar no Instagram e Facebook", campaign: "lançar uma promoção ao vivo", chaseall: "cobrar todos os clientes com faturas atrasadas" };
  const esd = { invoice: "enviar una factura con enlace de pago", deliver: "enviar a reparto", social: "publicar en Instagram y Facebook", campaign: "lanzar una promoción en vivo", chaseall: "contactar a todos los clientes con facturas vencidas" };
  const d = UI_LANG === "es" ? esd : pt ? ptd : en;
  return d[intent] || (UI_LANG === "es" ? "ejecutar la acción" : pt ? "executar a ação" : "run the action");
}
// ── HONESTY GATE — the intents Gui has NO engine for ────────────────────────────────────────────
// These branches used to answer "Done ✓ / Consider it handled ✓" and DEBIT credits for work nobody
// ever performed. Their only side effect was pushCreated(), which writes to THIS browser's
// localStorage — and portalApi.js deliberately keeps ":created:" out of the cloud sync, so nothing
// ever left the device: no message sent, no customer contacted, no invoice issued. Worse, the
// counts inside the sentence came from genPayments() — invented invoices, invented names, invented
// amounts — so a paying client read "I sent reminders to 4 customers" about four people who do not
// exist. The lesson was already learned one branch above ("Promising 'automatically, from now on'
// was the old lie"); this applies it to the neighbours.
//
// RULE: no engine → Gui does not claim it acted, does not charge, creates no record. It says what
// will happen and who does it, and opens the screen where the work really lives. Demo keeps its
// sample flow (it is an openly-labelled sample cockpit); REAL accounts never see a false receipt.
// [view, en, pt, es]
const SEM_MOTOR = {
  chaseall: ["finance",
    "I don't have a sending engine for that, so I'm not going to tell you it's done. Here's your real A/R in Finance — the open invoices, with the amount and who owes it. Send from there and it's logged for real.",
    "Não tenho motor de envio pra isso, então não vou te dizer que está feito. Aqui está o seu contas-a-receber de verdade, em Finanças — as faturas em aberto, com valor e quem deve. Enviando por ali, fica registrado de verdade.",
    "No tengo un motor de envío para eso, así que no te voy a decir que está hecho. Aquí está tu cuenta por cobrar real, en Finanzas — las facturas abiertas, con importe y quién debe. Si envías desde ahí, queda registrado de verdad."],
  invoice: ["finance",
    "I can't issue that invoice myself — so I won't claim I sent it. I opened Finance with your real invoices and payment links; create it there and the payment is tracked.",
    "Não consigo emitir essa fatura sozinha — então não vou dizer que enviei. Abri Finanças com as suas faturas reais e os links de pagamento; crie por ali que o pagamento fica rastreado.",
    "No puedo emitir esa factura por mi cuenta — así que no voy a decir que la envié. Abrí Finanzas con tus facturas reales y los enlaces de pago; créala ahí y el pago queda rastreado."],
  review: ["experience",
    "Review requests go out from the Pulse screen, not from me — so no, I haven't asked anyone yet. I opened it: it shows who's happy enough to ask.",
    "Os pedidos de avaliação saem da tela do Pulse, não de mim — então não, ainda não pedi pra ninguém. Abri pra você: ela mostra quem está satisfeito o bastante pra receber o pedido.",
    "Las solicitudes de reseña salen desde la pantalla de Pulse, no desde mí — así que no, todavía no le pedí a nadie. La abrí: muestra quién está lo bastante contento para pedírselo."],
  deliver: ["operations",
    "I can't dispatch a delivery on my own — nothing was sent. I opened Operations; dispatch it there and the courier gets the real job.",
    "Não consigo despachar uma entrega sozinha — nada foi enviado. Abri Operações; despache por ali que o entregador recebe o serviço de verdade.",
    "No puedo despachar un reparto por mi cuenta — no se envió nada. Abrí Operaciones; despáchalo ahí y el repartidor recibe el trabajo real."],
  book: ["schedule",
    "I'm not going to say it's booked when it isn't — booking happens on the schedule, not in this chat. I opened your agenda: book it there and the customer gets the real confirmation.",
    "Não vou dizer que está agendado se não está — o agendamento acontece na agenda, não neste chat. Abri a sua agenda: marque por ali que o cliente recebe a confirmação de verdade.",
    "No voy a decir que está agendado si no lo está — la reserva ocurre en la agenda, no en este chat. Abrí tu agenda: resérvalo ahí y el cliente recibe la confirmación real."],
  followup: ["crm",
    "No follow-up has started — I don't have an engine that sends it. I opened your CRM with the contacts that went quiet; the win-back goes out from there.",
    "Nenhum follow-up começou — não tenho motor que envie isso. Abri o seu CRM com os contatos que sumiram; a reconquista sai de lá.",
    "No empezó ningún seguimiento — no tengo un motor que lo envíe. Abrí tu CRM con los contactos que se apagaron; la recuperación sale de ahí."],
  audience: ["marketing",
    "I didn't build an audience — that lives in Marketing, on top of your real contact list. I opened it so you segment from real data instead of a made-up one.",
    "Não montei público nenhum — isso mora em Marketing, em cima da sua lista real de contatos. Abri pra você segmentar com dado real, não com um inventado.",
    "No armé ninguna audiencia — eso vive en Marketing, sobre tu lista real de contactos. La abrí para que segmentes con datos reales, no inventados."],
  social: ["socialhub",
    "Nothing was posted — I don't publish on my own. I opened Social Hub, wired to your real accounts; schedule the post there.",
    "Nada foi publicado — eu não publico sozinha. Abri o Social Hub, ligado nas suas contas reais; agende o post por ali.",
    "No se publicó nada — yo no publico sola. Abrí el Social Hub, conectado a tus cuentas reales; programa la publicación ahí."],
  books: ["integrations",
    "I haven't synced anything — that pipe doesn't run on my side. I opened Integrations; QuickBooks syncs from there once it's really connected.",
    "Não sincronizei nada — esse cano não existe do meu lado. Abri Integrações; o QuickBooks sincroniza de lá quando estiver conectado de verdade.",
    "No sincronicé nada — esa conexión no corre de mi lado. Abrí Integraciones; QuickBooks sincroniza desde ahí cuando esté realmente conectado."],
};
/** In REAL mode → an honest zero-cost plan for an engine-less intent. In demo → null (sample flow). */
function semMotor(intent, real, pt, ctx) {
  if (!real) return null;
  const row = SEM_MOTOR[intent];
  if (!row) return null;
  const [view, en, ptStr, es] = row;
  return { cost: 0, ctx, reply: UI_LANG === "es" ? es : (UI_LANG === "pt" || pt) ? ptStr : en, run: (onNav) => onNav?.(view) };
}

function guiPlan(text, V, ctx = {}, real = null) {
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
  if (/(instagram|\bpost\b|publica|story|stories|\bfeed\b|social)/.test(s)) { const sm = semMotor("social", real, pt, ctx); if (sm) return sm; const ok = connected("Instagram"); return { intent: "social", cost: ok ? 5 : 0, ctx, reply: ok ? L("Posted ✓ — your AI scheduled an on-brand post to Instagram & Facebook, timed for when your audience is most active. It's in Social.", "Publicado ✓ — sua IA agendou um post na cara da marca pro Instagram e Facebook, na hora de pico do seu público. Está em Social.") : L("Instagram isn't connected yet — connect it in Integrations and I'll post for you.", "O Instagram ainda não está conectado — conecte em Integrações que eu publico por você."), next: ok ? undefined : [{ label: L("🔌 Open Integrations", "🔌 Abrir Integrações"), cmd: "open integrations" }], run: (onNav) => onNav?.(ok ? "social" : "integrations") }; }
  if (/(quickbooks|accounting|contabil|sync.*(book|nota)|nota fiscal|bookkeep)/.test(s)) { const sm = semMotor("books", real, pt, ctx); if (sm) return sm; const ok = connected("QuickBooks"); return { cost: ok ? 3 : 0, ctx, reply: ok ? L("Synced ✓ — every sale and invoice is flowing into QuickBooks automatically. Your books stay current with zero data entry.", "Sincronizado ✓ — cada venda e fatura entra no QuickBooks automaticamente. Sua contabilidade fica em dia sem digitar nada.") : L("QuickBooks isn't connected — connect it in Integrations and I'll keep your books in sync.", "O QuickBooks não está conectado — conecte em Integrações que eu mantenho a contabilidade sincronizada."), next: ok ? undefined : [{ label: L("🔌 Open Integrations", "🔌 Abrir Integrações"), cmd: "open integrations" }], run: (onNav) => onNav?.(ok ? "payments" : "integrations") }; }
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
    // HONESTY: this creates a PLAN inside the cockpit, not a server job. It prepares the work and
    // records it here; the sending engines that run on our servers 24/7 are a separate, read-only
    // list ("Everything you have" tab). Promising "automatically, from now on" was the old lie.
    return { cost: 3, ctx, reply: L(`Saved ✓ — I put "${what} ${day}" on your plan, on the Overview under Automations. Heads up, so there's no confusion: this is your plan inside this cockpit — I prepare it and log it here, I don't send it out on my own. What our servers DO send by themselves (reminders, review requests, win-backs) is listed under "Everything you have".`, `Anotado ✓ — coloquei "${what} ${day}" no seu plano, lá no Overview em Automações. Só pra não ter confusão: isso é o seu plano dentro deste painel — eu preparo e registro aqui, eu não disparo sozinha. O que os nossos servidores mandam sozinhos (lembretes, avaliações, reconquista) está na aba "Tudo que você tem".`), next: [{ label: L("⚙️ See automations", "⚙️ Ver automações"), cmd: "open overview" }], run: (onNav) => { addAutomation(V.label, { what: what.charAt(0).toUpperCase() + what.slice(1), when, ic }); onNav?.("overview"); } };
  }
  if (/(remind|chase|collect all|chase all|overdue|atrasad|cobrar todos|all unpaid)/.test(s)) { const sm = semMotor("chaseall", real, pt, ctx); if (sm) return sm; const open = genPayments(V).filter((p) => p.status !== "Paid"); return { intent: "chaseall", cost: 5, ctx, reply: L(`Done ✓ — I sent payment reminders to ${open.length} customer${open.length !== 1 ? "s" : ""} with open invoices. They're in Payments.`, `Pronto ✓ — enviei lembretes de pagamento para ${open.length} cliente${open.length !== 1 ? "s" : ""} com faturas em aberto. Estão em Pagamentos.`), next: [{ label: L("⭐ Ask them for reviews too", "⭐ Pedir avaliações também"), cmd: "request reviews from my recent customers" }], run: (onNav) => onNav?.("payments") }; }
  if (/(invoice|charge|bill|cobr|fatur|payment|receb)/.test(s)) return semMotor("invoice", real, pt, ctx) || { intent: "invoice", cost: 5, ctx: C(target), reply: L(`Consider it handled — I've sent ${target} the invoice with a payment link, and I'll keep an eye on it until it's paid. It's in Payments.`, `Deixa comigo — enviei a fatura para ${target} com o link de pagamento, e fico de olho até ser paga. Está em Pagamentos.`), next: [{ label: L(`📅 Book ${target} too`, `📅 Agendar ${target} também`), cmd: `book them` }, { label: L("⭐ Request a review", "⭐ Pedir avaliação"), cmd: `request a review from them` }], run: (onNav) => { const id = pushCreated(V.label, "payments", { id: `INV-${3000 + (Date.now() % 900)}`, customer: target, amount: vnum(V.label, "guiinv", 60, 320), status: "Pending", color: "#D6C29A", method: "Payment link", due: "in 3 days" }); onNav?.("payments"); return undoer([{ view: "payments", id }], "payments"); } };
  if (/(review|avalia|rating|estrela)/.test(s)) return semMotor("review", real, pt, ctx) || { cost: 5, ctx: C(who || ctx.customer), reply: L(`With pleasure — I've requested reviews${who ? ` from ${target}` : " from your happiest recent customers"}. It's all tracked in Reputation.`, `Com prazer — pedi as avaliações${who ? ` para ${target}` : " aos seus clientes mais satisfeitos"}. Deixei tudo registrado em Reputação.`), next: [{ label: L("📣 Turn 5★ reviews into ads", "📣 Virar avaliações 5★ em anúncios"), cmd: "launch a promo" }], run: (onNav) => { const rows = (who ? [{ name: target, channel: "WhatsApp" }] : customers.slice(0, 3)).map((c) => ({ view: "reviewreq", id: pushCreated(V.label, "reviewreq", { name: c.name, ch: c.channel }) })); onNav?.("reputation"); return undoer(rows, "reputation"); } };
  if (/(deliver|entrega|dispatch|despach)/.test(s)) return semMotor("deliver", real, pt, ctx) || { intent: "deliver", cost: 5, ctx: C(who || ctx.customer), reply: L(`Done ✓ — sent${forTxt} to ${deliveryTab(V).toLowerCase()}. I'll text live updates.`, `Pronto ✓ — enviado${forPt} para ${deliveryTab(V).toLowerCase()}. Vou mandar atualizações ao vivo.`), next: [{ label: L("⭐ Ask for a review on arrival", "⭐ Pedir avaliação na entrega"), cmd: `request a review from them` }], run: (onNav) => { const id = pushCreated(V.label, "deliveries", recordFor("deliveries", target, "Gui", V)); onNav?.("deliveries"); return undoer([{ view: "deliveries", id }], "deliveries"); } };
  if (/(campaign|promo|an[úu]nci|\bad\b|marketing)/.test(s)) return { cost: 0, ctx, reply: L("Let's launch a real one — I've opened Campaigns. Type your offer in ⚡ Flash Campaign, preview exactly who'll get it, then send for real.", "Vamos lançar de verdade — abri Campanhas. Escreva sua oferta no ⚡ Flash Campaign, veja exatamente quem vai receber e envie de verdade."), next: [{ label: L("👥 Build an audience first", "👥 Criar um público antes"), cmd: "build an audience from my best customers" }], run: (onNav) => onNav?.("campaigns") };
  if (/(order|pedido|book|appointment|agend|marcar|reserv|schedule)/.test(s)) return semMotor("book", real, pt, ctx) || { cost: 5, ctx: C(target), reply: L(`${act.done}${forTxt} ✓ — it's in the right tab now.`, `${act.done}${forPt} ✓ — já está na aba certa.`), next: [{ label: L("💳 Send the invoice too", "💳 Enviar a fatura também"), cmd: `send an invoice to them` }], run: (onNav) => { const rec = recordFor(act.view, target, "Gui", V); const id = rec ? pushCreated(V.label, act.view, rec) : null; onNav?.(act.view); return id ? undoer([{ view: act.view, id }], act.view) : undefined; } };
  if (/(follow|nudge|win-?back|lapse|reativ)/.test(s)) return semMotor("followup", real, pt, ctx) || { cost: 3, ctx, reply: L("Consider it handled — I've started a warm follow-up sequence to win them back. You'll find it under Follow-ups.", "Deixa comigo — comecei uma sequência de follow-up pra reconquistá-los. Está na aba Follow-ups."), run: (onNav) => onNav?.("followups") };
  if (/(audience|p[úu]blico|segment)/.test(s)) return semMotor("audience", real, pt, ctx) || { cost: 5, ctx, reply: L("Built ✓ — an audience of your most engaged customers is ready in Ad Audiences.", "Pronto ✓ — um público com seus clientes mais engajados está pronto em Públicos de Anúncio."), run: (onNav) => { const id = pushCreated(V.label, "audiences", { name: "Gui · best customers", size: vnum(V.label, "guiaud", 1200, 9000), source: "CRM" }); onNav?.("audiences"); return undoer([{ view: "audiences", id }], "audiences"); } };
  if (/(hour|open|close|price|cost|where|location|menu|service)/.test(s)) { const kb = portalApi.loadKB(V.label, seedKB(V, portalApi.loadProfile(V.label, defProfile(V)))); return { cost: 1, ctx, reply: aiAnswer(text, V, kb) }; }
  return { cost: 0, ctx, reply: L("I can create orders & bookings, send invoices, request reviews, launch promos, start follow-ups, build audiences, or push to delivery. Try: \"send an invoice to my top customer\" — then \"book them too\".", "Eu crio pedidos e agendamentos, envio faturas, peço avaliações, lanço promoções, inicio follow-ups, monto públicos ou mando pra entrega. Tente: \"manda uma fatura pro meu melhor cliente\" — depois \"agenda ele também\"."), next: [{ label: L("💳 Send an invoice", "💳 Enviar fatura"), cmd: "send an invoice to my top customer" }, { label: L("⭐ Request reviews", "⭐ Pedir avaliações"), cmd: "request reviews" }, { label: L("📣 Launch a promo", "📣 Lançar promoção"), cmd: "launch a promo" }] };
}
function Gui({ V, onNav, real = null }) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(() => portalApi.loadState("gui_credits", 250));
  const alerts = useMemo(() => guiAlerts(V), [V]);     // proactive radar — real pending items
  const alertCount = alerts.reduce((n, a) => n + (a.count || 0), 0);
  const [msgs, setMsgs] = useState(() => {
    const base = [
      { from: "gui", text: tr("Hi! I'm Gui — your AI assistant 👋 Tell me what to do and I'll handle it.") },
      { from: "gui", text: `${tr("Quick read on today:")} ${dailyBriefing(V)}. ${tr("Want me to get started?")}` },
    ];
    const al = guiAlerts(V);
    if (al.length) {
      const L = UI_LANG;
      const aTxt = (a) => L === "es" && a.es ? a.es : L === "pt" && a.pt ? a.pt : a.en;
      const aChip = (a) => L === "es" && a.chipEs ? a.chipEs : L === "pt" && a.chipPt ? a.chipPt : a.chipEn;
      const heads = L === "es" ? "Atención" : L === "pt" ? "Atenção" : "Heads up";
      base.push({ from: "gui", text: `👀 ${heads} — ${aTxt(al[0])}`, next: al.slice(0, 2).map((a) => ({ label: aChip(a), cmd: a.cmd })) });
    }
    return base;
  });
  const [q, setQ] = useState("");
  const [ctx, setCtx] = useState({});            // conversation memory (last customer, etc.)
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState(() => portalApi.loadState("gui_history", []));   // past commands
  const [showHist, setShowHist] = useState(false);
  const lastUndo = useRef(null);                  // undo closure for the most recent action
  const runRef = useRef(null);                    // points at the current run(); lets external "gui:open" events fire a command
  const lastPt = useRef(false);                   // language of the last command, for system messages
  const [pending, setPending] = useState(null);   // a high-stakes action awaiting Confirm
  useEffect(() => { const h = (e) => { setOpen(true); const cmd = e?.detail?.cmd; if (cmd) setTimeout(() => runRef.current?.(cmd), 80); }; window.addEventListener("gui:open", h); return () => window.removeEventListener("gui:open", h); }, []);
  useEffect(() => { const h = () => setCredits(portalApi.loadState("gui_credits", 250)); window.addEventListener("gui:credits", h); return () => window.removeEventListener("gui:credits", h); }, []);
  const setC = (n) => { setCredits(n); portalApi.saveState("gui_credits", n); window.dispatchEvent(new Event("gui:credits")); };
  // ── ONE BALANCE, AND IT'S THE SERVER'S ────────────────────────────────────────────────────────
  // `credits` above is a localStorage counter that seeds the SAMPLE cockpit. On a real account the
  // sidebar already shows the true balance from get_client_data, so rendering this one too put TWO
  // DIFFERENT balances in front of the same paying client. Worse, recharge() handed out 250 free
  // credits and printed "billed to your account" — a receipt for a charge that never happened.
  // Same gate Billing.jsx:195 already uses (`real ? "hidden" : ""`): in real mode the number comes
  // from the server, the local counter is never touched, and topping up goes through Billing —
  // the path that actually charges.
  const realCredits = real && Number.isFinite(Number(real.credits)) ? Number(real.credits) : null;
  // Ausência ≠ zero: a real account whose balance didn't come back shows "—", never "0 left".
  const shownCredits = real ? (realCredits == null ? null : realCredits) : credits;
  const budget = real ? (realCredits == null ? Infinity : realCredits) : credits; // what a cost is checked against
  const charge = (n) => { if (real || !n) return; setC(credits - n); };            // never debit a server-held balance
  const recharge = () => { if (real) { onNav?.("billing"); setOpen(false); return; } setC(credits + 250); toast("250 credits added ✓ — pay-as-you-go, billed to your account"); };
  const remember = (t) => { setHistory((h) => { const next = [t, ...h.filter((x) => x !== t)].slice(0, 12); portalApi.saveState("gui_history", next); return next; }); };
  const isPt = (t) => /[ãõçáàâéêíóôú]|\b(cobr|fatur|entreg|agend|marc|reserv|avali|promo|cliente|atrasad|envi|mand|cria|fa[çc]a?|desfaz|quero|pedido|preciso)/i.test(t);
  const doUndo = () => {
    const p = lastPt.current;
    if (!lastUndo.current) { setMsgs((m) => [...m, { from: "gui", text: p ? "Nada pra desfazer ainda — só desfaço a última coisa que criei." : "Nothing to undo yet — I'll only undo the last thing I created." }]); return; }
    lastUndo.current(onNav); lastUndo.current = null;
    setMsgs((m) => [...m, { from: "gui", text: p ? "Desfeito ✓ — removi a última coisa que criei. Sem cobrança." : "Undone ✓ — I removed the last thing I created. No charge for that." }]);
  };
  // The real side-effect path (shared by the instant path + the Confirm button).
  const execute = (res, t) => {
    const undo = res.run ? res.run(onNav) : undefined;
    lastUndo.current = typeof undo === "function" ? undo : null;
    charge(res.cost);
    logUsage(res.cost, t || "");
    setMsgs((m) => [...m, { from: "gui", text: res.reply, cost: res.cost, next: res.next, canUndo: typeof undo === "function" }]);
  };
  const confirmPending = () => {
    if (!pending) return;
    const { res, t } = pending; setPending(null);
    setMsgs((m) => [...m, { from: "you", text: pending.pt ? "✓ Confirmar" : "✓ Confirm" }]);
    if (res.cost > budget) { setMsgs((m) => [...m, { from: "gui", text: pending.pt ? "Acabaram os créditos — recarregue e eu já faço." : "Out of credits — top up and I'll do it.", lowCredit: true }]); return; }
    execute(res, t);
  };
  const cancelPending = () => { if (!pending) return; const p = pending.pt; setPending(null); setMsgs((m) => [...m, { from: "gui", text: p ? "Cancelado — não enviei nada. Sem cobrança." : "Cancelled — I didn't send anything. No charge." }]); };
  const run = (text) => {
    const t = text.trim(); if (!t) return;
    setShowHist(false); setPending(null); lastPt.current = isPt(t);
    if (/^(undo|desfaz|desfazer|cancela|reverte|revert)/i.test(t)) { setMsgs((m) => [...m, { from: "you", text: t }]); setQ(""); doUndo(); return; }
    setMsgs((m) => [...m, { from: "you", text: t }]); setQ(""); remember(t);
    const res = guiPlan(t, V, ctx, real);
    if (res.ctx) setCtx(res.ctx);
    if (res.cost > budget) { setMsgs((m) => [...m, { from: "gui", text: lastPt.current ? "Você ficou sem créditos pra essa — recarregue e eu já faço." : "You're out of credits for that one — top up and I'll get right on it.", lowCredit: true }]); return; }
    // Approval gate: a money/customer-facing action waits for one-tap Confirm.
    const approvalOn = portalApi.loadState(`${V.label}:settings`, {}).require_approval !== false;
    if (approvalOn && res.intent && HIGH_STAKES.has(res.intent) && res.run) {
      setPending({ res, t, pt: lastPt.current });
      setMsgs((m) => [...m, { from: "gui", confirm: true, cost: res.cost, text: lastPt.current
        ? `Quer que eu confirme antes — pronto pra ${approvalSummary(res.intent, true)}. Confirmo?`
        : `You asked me to confirm money & customer-facing actions — ready to ${approvalSummary(res.intent, false)}. Go ahead?` }]);
      return;
    }
    execute(res, t);
  };
  runRef.current = run;                           // keep the external-trigger ref on the live run()
  const send = (e) => { e.preventDefault(); run(q); };
  // Voice input via the Web Speech API (graceful no-op where unsupported).
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const dictate = () => {
    if (!SR) { toast("Voice isn't supported in this browser"); return; }
    const rec = new SR(); rec.lang = UI_LANG === "pt" ? "pt-BR" : "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (ev) => { const t = ev.results[0][0].transcript; setQ(t); setListening(false); setTimeout(() => run(t), 200); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };
  const pct = shownCredits == null ? 0 : Math.max(0, Math.min(100, Math.round((shownCredits / 250) * 100)));
  const low = shownCredits != null && shownCredits < 30;
  // Voice presence — one soft spoken hello per session, and ONLY on the click that opens
  // the panel (the user gesture browsers require). sessionStorage guards repeats.
  const greetOnce = () => {
    try {
      if (sessionStorage.getItem("gui_greeted")) return;
      if (speakLine(tr("Hi, I'm Gui — tell me what you need and I'll take care of it."))) sessionStorage.setItem("gui_greeted", "1");
    } catch { /* private mode */ }
  };
  return (
    <>
      {!open && (
        <button onClick={() => { setOpen(true); greetOnce(); }} aria-label={alertCount ? `Open Gui assistant — ${alertCount} items need action` : "Open Gui assistant"} className="gui-breathe fixed bottom-20 right-5 md:bottom-5 z-[55] grid place-items-center h-14 w-14 rounded-full hover:scale-105 active:scale-95 transition" style={{ background: "#1A1610", border: "2px solid #FF8A33", boxShadow: "0 0 20px rgba(255,138,51,.6), 0 0 0 1px rgba(255,138,51,.35), 0 6px 18px rgba(0,0,0,.45)" }}>
          <img src={logo} alt="Gui" className="h-7 w-7 object-contain" />
          {alertCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 grid place-items-center rounded-full text-[11px] font-black text-black border-2 animate-pulse" style={{ background: "#FF8A33", borderColor: "#17150F" }}>{alertCount > 9 ? "9+" : alertCount}</span>
          ) : (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2" style={{ background: "#FF8A33", borderColor: "#17150F" }} />
          )}
        </button>
      )}
      {open && (
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="fixed bottom-20 right-5 md:bottom-5 z-[55] w-[92vw] max-w-sm rounded-xl3 border border-white/15 bg-[#0c100d]/98 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden" style={{ height: "min(78vh, 560px)" }}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2.5 shrink-0">
            <GuiMark size={38} />
            <div className="flex-1 min-w-0"><div className="text-sm font-extrabold text-g-word flex items-center gap-1.5">Gui <span className="text-[9px] font-black uppercase" style={{ color: "#FF8A33" }}>{tr("· AI assistant")}</span></div><div className="text-[10px] text-g-muted">{tr("Executes tasks for you, 24/7")}</div></div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-g-muted hover:text-g-word text-lg px-1">✕</button>
          </div>
          {/* credit meter */}
          <div className="px-4 py-2 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center justify-between text-[10px] mb-1"><span className="text-g-muted font-bold uppercase tracking-wide">{tr("Credits")}</span><span className={`font-bold ${low ? "text-red-400" : "text-g-word"}`}>{shownCredits == null ? <span className="text-g-muted" title={tr("Couldn't read your balance")}>—</span> : <>{shownCredits} {tr("left")}</>}</span></div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-gradient-to-r from-g-green to-g-gold"}`} style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-g-muted"><span>{tr("Pay-as-you-go · ~5 credits per task")}</span><button onClick={recharge} className="font-bold text-g-gold hover:underline">{real ? tr("Top up in Billing →") : tr("+ Recharge")}</button></div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5" role="log" aria-live="polite" aria-label={tr("Gui assistant conversation")}>
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${m.from === "you" ? "bg-g-gold/15 text-g-word border border-g-gold/30" : "bg-[#FF8A33]/10 text-g-light border border-[#FF8A33]/30"}`}>
                  {m.from === "gui" && <div className="text-[9px] font-black uppercase mb-0.5" style={{ color: "#FF8A33" }}>Gui</div>}
                  {m.text}
                  {m.cost > 0 && <span className="ml-1.5 text-[9px] text-g-muted">−{m.cost} cr</span>}
                  {m.lowCredit && <button onClick={recharge} className="block mt-1.5 text-[11px] font-bold text-g-gold hover:underline">{real ? tr("Top up in Billing →") : tr("+ Recharge credits")}</button>}
                  {m.canUndo && i === msgs.length - 1 && <button onClick={doUndo} className="block mt-1.5 text-[11px] font-bold text-g-muted hover:text-g-word">{tr("↩ Undo this")}</button>}
                  {m.confirm && pending && i === msgs.length - 1 && (
                    <div className="mt-2 flex gap-1.5">
                      <button onClick={confirmPending} className="rounded-full bg-g-green px-3 py-1 text-[11px] font-black text-black hover:brightness-110 transition">{tr("✓ Confirm")}</button>
                      <button onClick={cancelPending} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-g-muted hover:text-g-word transition">{tr("Cancel")}</button>
                    </div>
                  )}
                  {m.next && m.next.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">{m.next.map((n) => <button key={n.cmd} onClick={() => run(n.cmd)} className="rounded-full border border-g-gold/30 bg-g-gold/10 px-2.5 py-1 text-[10px] font-bold text-g-gold hover:bg-g-gold/20 transition">{n.label}</button>)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {msgs.length <= 2 && (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5 shrink-0">{["Create an order", "Send an invoice", "Request reviews", "Launch a promo"].map((s) => <button key={s} onClick={() => run(s)} className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-g-muted hover:text-g-word transition">{tr(s)}</button>)}</div>
          )}
          {showHist && history.length > 0 && (
            <div className="px-3 pb-1 shrink-0">
              <div className="text-[9px] font-black uppercase text-g-muted mb-1">{tr("Recent commands · tap to run again")}</div>
              <div className="flex flex-wrap gap-1.5">{history.map((h) => <button key={h} onClick={() => run(h)} className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] text-g-light hover:text-g-word hover:border-g-green/40 transition truncate max-w-[180px]">{h}</button>)}</div>
            </div>
          )}
          <form onSubmit={send} className="p-3 border-t border-white/10 flex gap-2 shrink-0">
            {history.length > 0 && <button type="button" onClick={() => setShowHist((v) => !v)} aria-label="Command history" className={`grid place-items-center h-10 w-10 rounded-full border shrink-0 transition ${showHist ? "border-g-green/50 bg-g-green/15 text-g-light" : "border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>↻</button>}
            {SR && <button type="button" onClick={dictate} aria-label="Dictate to Gui" className={`grid place-items-center h-10 w-10 rounded-full border shrink-0 transition ${listening ? "border-red-400 bg-red-500/15 text-red-400 animate-pulse" : "border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>🎙️</button>}
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("Ask Gui to do something")} placeholder={listening ? tr("Listening…") : tr("Ask Gui to do something…")} className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
            <button className="btn-bright text-sm px-4">{tr("Send")}</button>
          </form>
          <a href={waLink("Hi Guileo team! I need help")} target="_blank" rel="noopener" className="px-4 pb-3 text-[10px] text-g-muted hover:text-g-word text-center shrink-0">{tr("Need a human? Talk to your team →")}</a>
        </motion.div>
      )}
    </>
  );
}

/* ───────────────────────── Page ───────────────────────── */
export default function Portal() {
  const [authed, setAuthed] = useState(false);
  const [booting, setBooting] = useState(true);
  // VOLTA DO GOOGLE — o callback do login único devolve o dono em /portal?google=…; abrir a aba
  // da Agenda é o que faz ele VER o estado real (e o aviso vermelho quando o escopo da agenda
  // não foi concedido). Sem isto, ele cairia no Hoje e acreditaria que deu certo.
  const [view, _setView] = useState(() => { try { const q = new URLSearchParams(window.location.search); return (q.get("google") ? "schedulesync" : null) || q.get("tab") || "hoje"; } catch { return "hoje"; } });
  // Keep the active section in the URL (?tab=) so Back works and any view is shareable/deep-linkable.
  const setView = useCallback((v) => { _setView(v); try { const u = new URL(window.location.href); u.searchParams.set("tab", v); window.history.replaceState({}, "", u); } catch { /* */ } }, []);
  const [period, setPeriod] = useState("30 days");
  const [lang, setLang] = useState(() => portalApi.loadState("portal_lang", "en"));
  // Render-timing guarantee: tr()/helpers read the module-global UI_LANG, so it MUST reflect the
  // current language synchronously on EVERY render — before any JSX or helper that reads it — to
  // avoid painting a frame of English. Re-assert it here at the top of the component body (not only
  // in a useEffect, which runs after paint, nor only in the useState init, which runs once).
  if (UI_LANG !== lang) setUiLang(lang);
  // Cycles EN → PT → ES → HI. Async on purpose: the next dict chunk is fetched and cached
  // BEFORE the lang state flips, so the current language stays painted while it loads —
  // flash-free by construction. Updates tr() at the change, never in render body.
  const toggleLang = async () => { const order = ["en", "pt", "es", "hi"]; const n = order[(order.indexOf(lang) + 1) % order.length] || "en"; await loadDict(n); portalApi.saveState("portal_lang", n); setUiLang(n); setLang(n); };
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
  const [me, setMe] = useState(null);            // current session (real or demo) — drives the sidebar identity
  // 🚨 CLIENTE PAGANTE NÃO É VISITANTE (2026-08-20). Isto olhava SÓ a marca no navegador, então a
  // dona do negócio clicava no link do próprio e-mail de boas-vindas e caía no assistente de
  // demonstração: escolhe um nicho, digita o nome do negócio, informa um contato — tudo que já
  // está na conta dela. Pior: enquanto ela não terminava, o cockpit mostrava um spa INVENTADO
  // ("Lumière Spa · Miami") com números de mentira, com cara de conta dela.
  // Quem chega com a chave — no link (`?code=`) ou já salva — está identificado. Não se pergunta
  // a alguém identificado o que já sabemos: entra direto, nos dados REAIS dela.
  const [onboarded, setOnboarded] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get("code")) return true;
      if (loadDataKey()) return true;
      return !!localStorage.getItem("guileo_onboarded");
    } catch { return true; }
  });
  const [tourDone, setTourDone] = useState(() => { try { return !!localStorage.getItem("guileo_tour_done"); } catch { return true; } });
  const [fvDone, setFvDone] = useState(true);   // first-value guided path — only fires right after a fresh wizard
  const finishFV = () => { setFvDone(true); try { localStorage.setItem("guileo_firstvalue_done", "1"); } catch { /* */ } };
  const finishTour = () => { setTourDone(true); try { localStorage.setItem("guileo_tour_done", "1"); } catch { /* private */ } };
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const s = await portalApi.session();
      if (s) { if (!s.demo) await portalApi.hydrate(); setMe(s); setAuthed(true); }
      // Persisted non-EN language: hold the existing boot screen until the dict chunk is
      // cached, so the first shell paint is already translated (no English flash). The
      // module-scope warm-up started this fetch at import time, so this usually resolves
      // instantly; on failure loadDict falls back to EN silently.
      await loadDict(lang);
      setBooting(false);
    })();
    // React to magic-link sign-in (the email link lands back on /portal).
    if (CONNECTED) unsub = portalApi.onAuthChange((sess) => { if (sess) { setMe((m) => m || sess); setAuthed(true); } else { setMe(null); setAuthed(false); } });
    return () => unsub();
  }, []);
  // ── REAL MODE — logged-in email + connection code → live backend data.
  // Demo stays 100% intact: `real` only becomes truthy when the RPC returns data.
  const [real, setReal] = useState(null);
  const [realLoading, setRealLoading] = useState(false);
  const [realFalha, setRealFalha] = useState(null);   // motivo da última falha de leitura, ou null
  const realSeq = useRef(0);
  const refreshReal = useCallback(async () => {
    const key = loadDataKey();
    const seq = ++realSeq.current;                  // claim the latest-request slot FIRST…
    if (!me?.email || me.demo || !key) { if (seq === realSeq.current) setReal(null); return; } // …so a late clear can't wipe fresh data from a still-in-flight fetch
    setRealLoading(true);
    // 🚨 UM PISCAR DE REDE APAGAVA A CONTA INTEIRA (auditoria 2026-08-20).
    // `setReal(null)` desliga a camada de honestidade toda de uma vez: KPIs voltam a ser amostra,
    // receita vira `V.impact.total`, agenda vira exemplo, selos vermelhos reaparecem. Um cliente
    // PAGANTE lia números fabricados como se fossem dele — e o aviso ainda o culpava.
    // Agora: falha de LEITURA preserva o que já estava na tela (o padrão que SellerDashboard.jsx:156
    // já usava e que nunca chegou aqui) e guarda o MOTIVO; só credencial ausente/errada zera.
    const res = await fetchRealDataDetalhado(me.email, key);
    if (seq !== realSeq.current) return;
    setRealFalha(res.data ? null : res.motivo);
    if (res.data) setReal(res.data);
    else if (res.motivo === "chave_invalida" || res.motivo === "sem_credencial") setReal(null);
    // rede/servidor/resposta_estranha → mantém o `real` anterior. Dado velho é melhor que dado
    // inventado, desde que a tela DIGA que não conseguiu atualizar (é o que o aviso faz agora).
    setRealLoading(false);
  }, [me]);
  // SELF-SERVE ACTIVATION LINK — the welcome email's CTA lands on /portal?code=<key>. Auto-apply
  // the connection code once on boot (same setter + event Settings uses), then strip it from the URL
  // (history.replaceState) so the key isn't left in the address bar / shared links. Runs before the
  // boot refreshReal below so the first fetch already sees the key.
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) return;
      saveDataKey(code); // localStorage `guileo_data_key` + cloud-kv mirror
      window.dispatchEvent(new Event("gui:datakey")); // Portal re-fetches real data
      const u = new URL(window.location.href); u.searchParams.delete("code"); window.history.replaceState({}, "", u);
    } catch { /* private mode / bad URL — code stays visible as email fallback */ }
  }, []);
  useEffect(() => { refreshReal(); }, [refreshReal]); // on boot / session change
  // ── GUILEO APP — registra o service worker (public/sw.js) com escopo "/portal" e SÓ aqui.
  // Escopo apertado de propósito: a landing e os sites de cliente em /site/* (que têm o worker
  // deles, por tenant) nunca ficam sob este. O worker cacheia SÓ a casca estática — /api/** é
  // rede pura, porque cockpit de cliente pagante mostrando o número de ontem com cara de hoje é
  // pior que tela em branco. Falha de registro é silenciosa: o app vira site, e site funciona.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
    const t = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js", { scope: "/portal" }).catch(() => { /* sem app offline; o cockpit segue normal */ });
    }, 1500); // depois da primeira pintura — instalar worker nunca pode atrasar o primeiro número na tela
    return () => clearTimeout(t);
  }, []);
  const lastRealFetch = useRef(0);
  useEffect(() => {
    // staleness gate: alt-tab spam must not turn into a burst of get_client_data RPCs
    const onFocus = () => { if (Date.now() - lastRealFetch.current > 60000) { lastRealFetch.current = Date.now(); refreshReal(); } }
    // T0.2 — on a connection-code CHANGE, clear the old tenant's data IMMEDIATELY (before refetch) so
    // another client's events can never flash in the new client's view during the in-flight fetch.
    const onKey = () => { setReal(null); refreshReal(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("gui:datakey", onKey);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("gui:datakey", onKey); };
  }, [refreshReal]);
  // Deferred onboarding sync — a visitor who completed the wizard in DEMO mode and LATER
  // connected for real (email + connection code → `real` data actually loads, proving the
  // key is authorized): auto-apply their stashed wizard answers to the live agent exactly
  // once. AUTO (not a prompt) because the answers came from this same person, the write is
  // additive + best-effort, and demo visuals must stay untouched (no new UI allowed).
  useEffect(() => {
    if (!real || !me?.email || me.demo) return;
    const pending = portalApi.loadState("pending_onboard", null);
    if (!pending?.vid) return;
    portalApi.saveState("pending_onboard", null); // clear FIRST so a slow/failed sync can never loop-spam the agent
    try { syncOnboardingToAgent(me, pending.vid, pending.extra || {}); } catch { /* best-effort */ }
  }, [real, me]);
  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); } if (e.key === "Escape") { setPaletteOpen(false); setNavOpen(false); setBellOpen(false); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  // 🎙️ "Ouvir minha semana" — the weekly email's audio button lands on /portal?speak=weekly.
  // Once authed + data settled, open Overview and let it try the spoken briefing (Overview
  // feature-detects speechSynthesis; if the browser blocks speech without a gesture, the
  // existing ▶ Hear-it pill is highlighted instead — honest fallback, never a crash).
  const [speakWeekly, setSpeakWeekly] = useState(false);
  useEffect(() => {
    if (booting || !authed) return;
    try {
      if (new URLSearchParams(window.location.search).get("speak") !== "weekly") return;
      if (sessionStorage.getItem("gui_speak_weekly")) return; // fire once per session
      sessionStorage.setItem("gui_speak_weekly", "1");
      setView("overview");
      setSpeakWeekly(true);
    } catch { /* private mode / no URL API — skip quietly */ }
  }, [booting, authed, setView]);
  const V = (() => {
    const base = VERTICALS[vertical];
    // Assisted-trial personalization: a /demo/:slug prospect arrives with pending_onboard
    // {extra:{name}} seeded — show THEIR business name over the sample one while in demo mode,
    // so the cockpit feels like theirs before they ever pay. Real accounts use their profile.
    // 🚨 CONTA REAL USA A IDENTIDADE REAL (2026-08-20). O comentário acima já prometia isto — e o
    // código NUNCA cumpriu: com `real` preenchido ele devolvia `base`, o negócio de AMOSTRA. Foi
    // assim que a primeira cliente pagante abriu o cockpit dela e leu "Lumière Spa · Miami".
    // Agora `get_client_data` sobe `identity` (nome, atendente, logo, cor, número) e ela manda.
    // O endereço da amostra é APAGADO junto: negócio certo com cidade errada é pior que sem cidade.
    const ident = real?.identity;
    if (ident?.business) {
      return { ...base, business: { ...base.business, name: String(ident.business).slice(0, 80), place: "" } };
    }
    if (!real) {
      try {
        const pend = portalApi.loadState("pending_onboard", null);
        const nm = (pend?.extra?.name || "").toString().trim().slice(0, 60);
        if (nm) return { ...base, business: { ...base.business, name: nm } };
      } catch { /* seeded data optional */ }
    }
    return base;
  })();
  const sections = ocultaSemFeed(sectionsFor(vertical, V), real);
  const nf = (k) => (notifsRead ? 0 : notifFor(k, V, real));
  const totalNotif = sections.reduce((s, [k]) => s + nf(k), 0);
  const notifList = notifsRead ? [] : sections.map(([k, l]) => ({ k, l, n: notifFor(k, V, real) })).filter((x) => x.n > 0);
  const cur = sections.find((s) => s[0] === view);
  const title = view === "operations" ? `${V.label} operations` : (cur ? cur[1] : "Overview");
  const switchVertical = (k) => { setVertical(k); portalApi.saveState("vertical", k); setView("overview"); setVertOpen(false); setNotifsRead(portalApi.loadState(`${k}:notifsRead`, false)); };
  const markAllRead = () => { setNotifsRead(true); portalApi.saveState(`${vertical}:notifsRead`, true); setBellOpen(false); toast("All caught up ✓"); };
  const logout = () => portalApi.logout().then(() => setAuthed(false));
  // Polished, print-ready monthly report (open → Cmd/Ctrl-P → Save as PDF).
  const exportReport = () => {
    const impact = genImpact(V);
    const usage = portalApi.loadState("gui_usage", []);
    const creditsUsed = Array.isArray(usage) ? usage.reduce((s, u) => s + (u?.cost || 0), 0) : 0;
    const roi = creditsUsed * 0.04 > 0 ? impact.total / (creditsUsed * 0.04) : 0;
    const kpiRows = V.kpis.map((k) => `<tr><td>${k.label}</td><td style="text-align:right;font-weight:700">${k.pre || ""}${k.num.toLocaleString?.() || k.num}${k.suf || ""}</td></tr>`).join("");
    const eventRows = impact.events.map(([t, what, amt]) => `<tr><td>${what}</td><td style="text-align:right;color:#1f9d57;font-weight:700">+$${amt}</td></tr>`).join("");
    // Sector-aware: which of this business's tools Guileo is acting through, + standing automations.
    const stack = portalApi.loadState(`${V.label}:stack`, {});
    const flatTools = genIntegrations(V).flatMap(([, tools]) => tools);
    const liveTools = flatTools.filter(([n, , , , , def]) => (stack[n] === undefined ? !!def : !!stack[n]));
    const toolRows = liveTools.map(([name, , , doesEn, doesPt]) => `<tr><td><b>${name}</b></td><td class="muted" style="font-size:13px">${(UI_LANG === "pt" && doesPt) ? doesPt : doesEn}</td></tr>`).join("");
    const autos = portalApi.loadState(`${V.label}:automations`, []).filter((a) => a.on);
    const autoRows = autos.map((a) => `<tr><td>${a.what}</td><td style="text-align:right" class="muted">${a.when}</td></tr>`).join("");
    // Localize every user-visible label in the exported report. Layout/structure stays identical —
    // only the text varies by UI_LANG. (Read directly so the report matches the portal's language.)
    const RL = {
      en: { docTitle: "Guileo Monthly Report", subtitle: "Monthly growth report", heroLabel: "Growth Gui drove this month",
        roi: (x, g, c) => `Return on credits: ${x}× ($${g} growth from ${c} credits)`, powered: (c) => `Powered by ${c} credits`,
        payg: "Pay-as-you-go — you only pay for what Gui does. Guileo never takes a cut of your revenue.",
        keyMetrics: "Key metrics", growthLedger: "Growth ledger", total: "Total",
        stack: (n) => `Your connected stack · ${n} tools Guileo acts through`, automations: "Automations on autopilot",
        foot: (b) => `Generated by Guileo · ${b} · This report reflects activity handled by your AI across your connected stack. Tip: print → Save as PDF.` },
      pt: { docTitle: "Relatório Mensal Guileo", subtitle: "Relatório mensal de crescimento", heroLabel: "Crescimento que a Gui gerou este mês",
        roi: (x, g, c) => `Retorno sobre créditos: ${x}× ($${g} de crescimento a partir de ${c} créditos)`, powered: (c) => `Impulsionado por ${c} créditos`,
        payg: "Pague conforme o uso — você só paga pelo que a Gui faz. A Guileo nunca fica com uma fatia da sua receita.",
        keyMetrics: "Métricas principais", growthLedger: "Razão de crescimento", total: "Total",
        stack: (n) => `Suas ferramentas conectadas · ${n} ferramentas pelas quais a Guileo atua`, automations: "Automações no piloto automático",
        foot: (b) => `Gerado pela Guileo · ${b} · Este relatório reflete a atividade gerida pela sua IA em todas as suas ferramentas conectadas. Dica: imprimir → Salvar como PDF.` },
      es: { docTitle: "Informe Mensual Guileo", subtitle: "Informe mensual de crecimiento", heroLabel: "Crecimiento que Gui generó este mes",
        roi: (x, g, c) => `Retorno sobre créditos: ${x}× ($${g} de crecimiento a partir de ${c} créditos)`, powered: (c) => `Impulsado por ${c} créditos`,
        payg: "Paga por uso — solo pagas por lo que hace Gui. Guileo nunca se queda con una parte de tus ingresos.",
        keyMetrics: "Métricas clave", growthLedger: "Libro de crecimiento", total: "Total",
        stack: (n) => `Tus herramientas conectadas · ${n} herramientas a través de las que actúa Guileo`, automations: "Automatizaciones en piloto automático",
        foot: (b) => `Generado por Guileo · ${b} · Este informe refleja la actividad gestionada por tu IA en todas tus herramientas conectadas. Consejo: imprimir → Guardar como PDF.` },
    };
    const L = RL[UI_LANG] || RL.en;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${L.docTitle} · ${V.business.name}</title><style>
      *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1f1c;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.5}
      h1{font-size:26px;margin:0}.muted{color:#6b7280}.hero{background:linear-gradient(135deg,#e9f6ef,#fbf6e8);border:1px solid #d9e9df;border-radius:16px;padding:24px;margin:20px 0}
      .big{font-size:44px;font-weight:900;letter-spacing:-1px}.share{background:#fff7e6;border:1px solid #f0d99b;border-radius:12px;padding:14px;margin-top:14px}
      table{width:100%;border-collapse:collapse;margin:8px 0 24px}td{padding:9px 4px;border-bottom:1px solid #eee;font-size:14px}h3{margin:24px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#9a7b1f}
      .foot{color:#9ca3af;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:14px}@media print{body{margin:0}}
    </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div><h1>${V.business.name}</h1><div class="muted">${V.business.place} · ${L.subtitle}</div></div>
        <div style="font-weight:900;color:#1f9d57">GUILEO</div>
      </div>
      <div class="hero"><div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9a7b1f;font-weight:700">${L.heroLabel}</div>
        <div class="big">$${impact.total.toLocaleString()}</div>
        <div class="share"><b>${roi > 0 ? L.roi(roi.toFixed(1), impact.total.toLocaleString(), creditsUsed.toLocaleString()) : L.powered(creditsUsed.toLocaleString())}</b><br><span class="muted">${L.payg}</span></div>
      </div>
      <h3>${L.keyMetrics}</h3><table>${kpiRows}</table>
      <h3>${L.growthLedger}</h3><table>${eventRows}<tr><td><b>${L.total}</b></td><td style="text-align:right"><b>$${impact.total.toLocaleString()}</b></td></tr></table>
      <h3>${L.stack(liveTools.length)}</h3><table>${toolRows}</table>
      ${autoRows ? `<h3>${L.automations}</h3><table>${autoRows}</table>` : ""}
      <div class="foot">${L.foot(V.business.name)}</div>
    </body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const win = window.open(url, "_blank");
    if (win) {
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(tr("Monthly report opened — print → Save as PDF ✓"));
    } else {
      // Popup blocked (common on mobile / without a direct gesture) — fall back to a download
      // so the report never silently no-ops.
      const a = document.createElement("a");
      a.href = url; a.download = `${V.business.name.replace(/\s+/g, "-")}-guileo-report.html`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(tr("Report downloaded — open it, then print → Save as PDF ✓"));
    }
  };
  // Lazy view registry: each entry is a thunk so ONLY the active view's element tree
  // is built per render (was instantiating all ~40 components on every toast/lang/period change).
  const views = {
    hoje: () => <Hoje V={V} onNav={setView} real={real} email={me?.email} dataKey={loadDataKey()} onRefresh={refreshReal} refreshing={realLoading} />,
    overview: () => <Overview V={V} onNav={setView} sections={sections} period={period} real={real} onRefresh={refreshReal} refreshing={realLoading} autoSpeak={speakWeekly} onAutoSpoke={() => setSpeakWeekly(false)} email={me?.email} dataKey={loadDataKey()} />,
    leads: () => <LeadsDigest V={V} onNav={setView} lang={lang} real={real} />,
    leadstoday: () => <LeadsToday V={V} onNav={setView} real={real} email={me?.email} dataKey={loadDataKey()} />,
    meusite: () => <MeuSite V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    deliveries: () => <Deliveries V={V} />,
    inbox: () => <Inbox V={V} onNav={setView} real={real} email={me?.email} dataKey={loadDataKey()} />,
    impact: () => <GuileoImpact V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    // Followups.jsx troca de tela inteira com `real && email && dataKey`: em modo real ele lê as duas
    // listas verdadeiras do /api/growth-intel (abandoned + churn) em vez de genFollowups. Montar sem
    // email/dataKey devolveria a amostra a um cliente pagante — os 3 props andam juntos, sempre.
    followups: () => <Followups V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    waitlist: () => <Waitlist V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    recurring: () => <Recurring V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    reputation: () => <Reputation V={V} onNav={setView} />,
    loyalty: () => <Loyalty V={V} />,
    payments: () => <Payments V={V} />,
    team: () => <Team V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    locations: () => <Locations V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    operations: () => <Operations V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    schedule: () => <ScheduleScreen V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    riskradar: () => <RiskRadar V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    schedulesync: () => <ScheduleSync V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    googlehub: () => <GoogleHub V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    socialhub: () => <SocialHub V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    emergency: () => <EmergencyLog V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    catalog: () => <CatalogScreen V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    social: () => <SocialInbox V={V} />,
    analytics: () => <AIAnalytics V={V} onNav={setView} sections={sections} real={real} email={me?.email} dataKey={loadDataKey()} />,
    // email/dataKey: AIInsights lê as intenções REAIS das ligações (mesma fonte da aba Analytics) —
    // sem os dois props o único bloco não-amostra da aba não desenha.
    insights: () => <AIInsights V={V} real={real} onNav={setView} sections={sections} email={me?.email} dataKey={loadDataKey()} />,
    integrations: () => <Integrations V={V} onNav={setView} lang={lang} me={me} />,
    liveorders: () => <LiveOrders V={V} real={real} />,
    kitchen: () => <Kitchen V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    menu: () => <MenuView V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    customers: () => <Customers V={V} onNav={setView} />,
    crm: () => <CRM360 V={V} onNav={setView} real={real} email={me?.email} dataKey={loadDataKey()} />,
    command: () => <CommandCenter V={V} onNav={setView} real={real} email={me?.email} dataKey={loadDataKey()} />,
    // `real` entrou para o convite NoSeuPlano (close_collect) poder gatear por plano — sem a
    // prop o convite fica mudo de propósito (o componente não chuta plano que não conhece).
    finance: () => <FinanceDept V={V} onNav={setView} real={real} email={me?.email} dataKey={loadDataKey()} />,
    marketing: () => <MarketingDept V={V} onNav={setView} email={me?.email} dataKey={loadDataKey()} />,
    dates: () => <MarketingDates V={V} onNav={setView} email={me?.email} dataKey={loadDataKey()} />,
    coupons: () => <Coupons V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    mycompany: () => <MyCompanyOS V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    growthintel: () => <GrowthIntel V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    experience: () => <Experience V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    timeline: () => <Timeline V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    capture: () => <CaptureTools V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    comentarios: () => <Comentarios V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    orcamentos: () => <QuoteEngine V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    mktleads: () => <MarketplaceLeads V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    storm: () => <StormMode V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    retention: () => <GrowthDept V={V} onNav={setView} email={me?.email} dataKey={loadDataKey()} />,
    documents: () => <DocsArea V={V} email={me?.email} dataKey={loadDataKey()} />,
    campaigns: () => <Campaigns V={V} onNav={setView} />,
    audiences: () => <Audiences V={V} onNav={setView} />,
    calllogs: () => <CallLogs V={V} onNav={setView} real={real} email={me?.email} dataKey={loadDataKey()} />,
    dialer: () => <Dialer real={real} />,
    whatsapp: () => <Convos V={V} title="WhatsApp" real={real} />,
    sms: () => <Convos V={V} title="SMS" real={real} />,
    channels: () => <Channels real={real} email={me?.email} dataKey={loadDataKey()} />,
    ads: () => <Ads email={me?.email} dataKey={loadDataKey()} real={real} />,
    support: () => <Support onNav={setView} email={me?.email} dataKey={loadDataKey()} />,
    relacionamento: () => <Relacionamento onNav={setView} email={me?.email} dataKey={loadDataKey()} />,
    trainer: () => <Trainer V={V} onNav={setView} email={me?.email} dataKey={loadDataKey()} lang={lang} />,
    kb: () => <KnowledgeBase V={V} real={real} email={me?.email} dataKey={loadDataKey()} />,
    docs: () => <Docs real={real} />,
    grow: () => <Grow onNav={setView} sections={sections} />,
    brain: () => <AIBrain V={V} me={me} />,
    billing: () => <Billing V={V} real={real} onNav={setView} email={me?.email} />,
    settings: () => <SettingsView V={V} real={real} me={me} />,
  };
  const content = (views[view] || views.overview)();

  if (booting) return <div className="min-h-screen grid place-items-center text-g-muted text-sm">{tr("Loading your cockpit…")}</div>;
  if (!authed) return <div className="min-h-screen text-g-ink"><Login onEnter={() => { portalApi.session().then((s) => s && setMe(s)); setAuthed(true); }} /></div>;
  if (!onboarded) return <div className="min-h-screen text-g-ink"><OnboardingWizard onDone={(vid, extra) => {
    setVertical(vid); portalApi.saveState("vertical", vid); setNotifsRead(portalApi.loadState(`${vid}:notifsRead`, false)); setView("overview"); setOnboarded(true);
    try { localStorage.setItem("guileo_onboarded", "1"); } catch { /* private */ }
    setFvDone(false);   // trigger the guided first-value path right after the wizard
    // Carry the business name from onboarding straight into the profile + AI.
    const OV = VERTICALS[vid];
    if (extra?.name && OV) syncProfile(OV.label, OV, { ...defProfile(OV), name: extra.name });
    // Persist the new client to the clients registry (graceful — no-op if table/auth absent).
    try { portalApi.saveClient({ name: extra?.owner || extra?.name, business: extra?.name, sector: vid, contact: extra?.contact }); } catch { /* never block */ }
    // REAL client — persist the wizard's answers (business type, name, covered channels)
    // into their live agent via the SAME save+sync path the AI Brain tab uses. Demo
    // visitors keep exactly the old behavior, but we stash the answers so they can be
    // auto-applied once if they later connect (see the deferred-sync effect above).
    try {
      const applied = syncOnboardingToAgent(me, vid, extra || {});
      if (applied) portalApi.saveState("pending_onboard", null);
      else portalApi.saveState("pending_onboard", { vid, extra: extra || {}, at: Date.now() });
    } catch { /* never block the wizard */ }
    // CLOSE THE LOOP — turn the wizard from cosmetic into a real funnel entry. Every completion
    // becomes a captured lead; if they gave an email, pre-seed their Gui brain in pending-onboarding
    // so the moment they pay (/planos → Stripe → webhook) a trained Gui is born automatically.
    // All fire-and-forget — never blocks exploring the demo.
    try {
      const contact = (extra?.contact || "").toString().trim();
      const isEmail = contact.includes("@");
      const seedBrain = `Business: ${extra?.name || OV?.label || vid}. Sector: ${OV?.label || vid}. Owner: ${extra?.owner || ""}.`.slice(0, 3500);
      if (isEmail) {
        fetch("/api/selfserve-signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: contact, business: extra?.name || "", industry: vid, lang: UI_LANG, brain: seedBrain, phone: "" }) }).catch(() => {});
      }
      fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: extra?.owner || extra?.name || "", phone: isEmail ? "" : contact, email: isEmail ? contact : "", business: extra?.name || "", industry: vid, lang: UI_LANG, source: "portal-wizard", noCall: true, consent: false }) }).catch(() => {});
    } catch { /* never block the wizard */ }
  }} /></div>;

  return (
    <div className="min-h-screen text-g-ink flex flex-col lg:flex-row">
      <style>{PORTAL_FX}</style>
      {!tourDone && fvDone && <Tour onDone={finishTour} />}
      {onboarded && !fvDone && <FirstValue V={V} onNav={setView} onDone={finishFV} />}
      {/* Mobile backdrop */}
      {navOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setNavOpen(false)} />}
      {/* Sidebar — slide-over on mobile, static on desktop */}
      <aside id="portal-sidebar" className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] overflow-y-auto transform transition-transform duration-300 ${navOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto lg:w-60 lg:max-w-none lg:min-h-screen border-r border-white/10 bg-[#070b10]/98 lg:bg-white/[0.03] backdrop-blur-xl lg:sticky lg:top-0 flex flex-col`}>
        <div className="flex items-center gap-2 px-5 py-4">
          <img src={logo} alt="Guileo" className="h-8 w-8 object-contain" />
          <div className="leading-tight flex-1 min-w-0"><div className="text-sm font-extrabold text-g-word">{tr("Growth Cockpit")}</div><div className="text-[10px] text-g-muted truncate">{V.icon} {V.business.name}</div></div>
          <button onClick={() => setNavOpen(false)} className="lg:hidden text-g-muted hover:text-g-word text-lg leading-none px-1" aria-label={tr("Close menu")}>✕</button>
        </div>
        <nav aria-label="Dashboard sections" className="flex flex-col gap-1 px-3 pb-3 overflow-y-auto">
          {(() => {
            const renderBtn = ([key, label, flag]) => {
              const Icon = SECTION_ICON[key] || FaGaugeHigh;
              const on = view === key;
              const notif = nf(key);
              return (
                <button key={key} onClick={() => { setView(key); setNavOpen(false); }}
                  className={`relative flex items-center gap-3 rounded-xl2 px-3.5 py-2.5 text-sm font-bold whitespace-nowrap transition-colors ${on ? "text-g-word" : "text-g-muted hover:text-g-word hover:bg-white/[0.04]"}`}>
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
          <PlantBloom V={V} real={real} />
          {(real || V.plan) && (() => {
            // real mode: the card shows the TENANT's plan + remaining credits — never the demo meter
            const label = real ? ({ starter: "Essential", growth: "Personalized", scale: "Full Operation" }[real.plan] || real.plan || "Plan") : V.plan.label;
            const totals = { starter: 500, growth: 2000, scale: 6000 };
            const total = real ? (totals[real.plan] || 0) : (V.plan.total || 0);
            const left = real ? (Number(real.credits) || 0) : Math.max(0, (V.plan.total || 0) - (V.plan.used || 0));
            const pct = total ? Math.max(2, Math.min(100, (left / total) * 100)) : 2;
            return (
              <div className="rounded-xl2 border border-g-gold/25 bg-g-gold/[0.06] p-3">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide"><span className="text-g-gold">{label}</span><span className="text-g-muted">{real ? `${left.toLocaleString()} / ${total ? total.toLocaleString() : "—"}` : `${V.plan.used} / ${(V.plan.total || 0).toLocaleString()}`}</span></div>
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${pct}%` }} /></div>
                <div className="mt-1.5 text-[10px] text-g-muted">{real ? tr("Gui credits remaining") : V.plan.unit}</div>
              </div>
            );
          })()}
          <div className="flex items-center gap-2">
            <span className="grid place-items-center h-8 w-8 rounded-full bg-g-green/15 text-xs font-bold text-g-light">{((me?.name || me?.email || "G").trim()[0] || "G").toUpperCase()}</span>
            <div className="leading-tight min-w-0 flex-1"><div className="text-xs font-bold text-g-word truncate">{me?.name || me?.email || "Jane Staff"}</div><div className="text-[10px] text-g-muted truncate">{me && !me.demo ? tr(me.role || "Owner") : tr("Demo mode")}</div></div>
            <button onClick={logout} title={tr("Sign out")} className="text-g-muted hover:text-red-400 transition text-[11px] font-bold">{tr("Sign out")}</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* topbar */}
        <header className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setNavOpen(true)} aria-expanded={navOpen} aria-controls="portal-sidebar" className="lg:hidden grid place-items-center h-9 w-9 rounded-xl border border-white/15 bg-white/[0.04] text-g-word shrink-0" aria-label={tr("Open menu")}>☰</button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-g-word truncate flex items-center gap-2">{tr(title, lang)}{real && REAL_VIEWS.has(view) ? <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide bg-g-green/15 text-g-green border border-g-green/40 rounded-full px-2 py-0.5 shrink-0 shadow-[0_0_10px_rgba(62,148,104,0.35)]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span> : real ? <span className="text-[9px] font-black uppercase tracking-wide bg-g-gold/15 text-g-gold border border-g-gold/30 rounded-full px-2 py-0.5 shrink-0">{tr("Sample preview")}</span> : <button onClick={() => setView("settings")} title={tr("Sample data · connect →")} className="text-[9px] font-black uppercase tracking-wide bg-g-gold/20 text-g-gold border border-g-gold/30 rounded-full px-2 py-0.5 shrink-0 hover:bg-g-gold/30 transition">{tr("Sample data · connect →")}</button>}</h1>
              <p className="text-[11px] text-g-muted truncate">{(() => { const bp = real ? portalApi.loadProfile(V.label, {}) : null; return bp && bp.name ? `${bp.name}${bp.address ? " · " + bp.address : ""}` : `${V.business.name} · ${V.business.place} · ${V.business.since}`; })()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setPaletteOpen(true)} className="hidden md:flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-g-muted w-40 hover:border-g-gold/40 transition"><FaMagnifyingGlass size={11} /><span className="truncate">{tr("Search… ⌘K")}</span></button>
            {!real && <button onClick={exportReport} className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word hover:border-g-gold/40 transition"><FaDownload size={11} /> {tr("Report", lang)}</button>}
            <button onClick={toggleLang} title={tr("Language")} aria-label={tr("Toggle language")} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-black text-g-word hover:border-g-gold/40 transition"><span className={lang === "en" ? "text-g-gold" : "text-g-muted"}>EN</span><span className="text-g-muted">·</span><span className={lang === "pt" ? "text-g-gold" : "text-g-muted"}>PT</span><span className="text-g-muted">·</span><span className={lang === "es" ? "text-g-gold" : "text-g-muted"}>ES</span><span className="text-g-muted">·</span><span className={lang === "hi" ? "text-g-gold" : "text-g-muted"}>HI</span></button>
            <div className="relative">
              <button onClick={() => setBellOpen((o) => !o)} className="relative grid place-items-center h-9 w-9 rounded-full border border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word transition" aria-label={`Notifications (${totalNotif})`}><FaBell size={13} />{totalNotif > 0 && <span className="absolute -top-1 -right-1 inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black shadow-[0_0_8px_rgba(239,68,68,0.6)]">{totalNotif}</span>}</button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-xl2 border border-white/15 bg-g-cream/95 backdrop-blur-xl shadow-lift z-30 p-1.5">
                    <div className="flex items-center justify-between px-2.5 py-1.5"><span className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{tr("Notifications")}</span>{totalNotif > 0 && <button onClick={markAllRead} className="text-[10px] font-bold text-g-gold hover:underline">{tr("Mark all read")}</button>}</div>
                    {notifList.length ? notifList.map(({ k, l, n }) => (
                      <button key={k} onClick={() => { setView(k); setBellOpen(false); }} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-bold text-left text-g-muted hover:text-g-word hover:bg-white/[0.06] transition">
                        <span className="grid place-items-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black">{n}</span>
                        <span className="flex-1 text-g-word">{l}</span><span className="text-g-muted">{tr("view →")}</span>
                      </button>
                    )) : <div className="px-2.5 py-6 text-center text-xs text-g-muted">{tr("✅ All caught up")}</div>}
                  </div>
                </>
              )}
            </div>
            <div className="hidden lg:flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] p-1">
              {["7 days", "30 days", "90 days"].map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`rounded-full px-3 py-1 text-xs font-bold transition ${period === p ? "bg-g-gold/20 text-g-gold ring-1 ring-g-gold/40 shadow-[0_0_12px_rgba(214,194,154,0.18)]" : "text-g-muted hover:text-g-word hover:bg-white/[0.05]"}`}>{tr(p)}</button>
              ))}
            </div>
            <span className="grid place-items-center h-9 w-9 rounded-full bg-g-green/15 text-sm font-extrabold text-g-light">{V.business.name[0]}</span>
          </div>
        </header>

        {/* demo banner + INDUSTRY SWITCHER (demo only — real clients get their own fixed industry; no flash before the session loads) */}
        {me?.demo && (
        <div className="px-5 sm:px-8 pt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-g-gold/30 bg-g-gold/[0.08] px-4 py-2 text-[11px] font-bold text-g-gold inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" /> {tr("Demo data — each client sees their own industry.")}
          </div>
          <div className="ml-auto relative">
            <span className="text-[11px] font-bold uppercase tracking-wide text-g-muted hidden md:inline mr-2">{tr("Preview industry")}</span>
            <button onClick={() => setVertOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={vertOpen}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-2 text-xs font-bold text-g-word hover:border-g-gold/40 transition">
              <span className="text-base">{V.icon}</span><span>{V.label}</span><FaChevronDown size={10} className={`transition-transform ${vertOpen ? "rotate-180" : ""}`} />
            </button>
            {vertOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setVertOpen(false)} />
                <div role="listbox" className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto rounded-xl2 border border-white/15 bg-g-cream/95 backdrop-blur-xl shadow-lift z-30 p-1.5">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-g-muted">{tr("Industry · demo")}</div>
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
        )}

        {/* REAL client who hasn't connected yet → label the preview prominently so fabricated
            sample numbers NEVER read as their real money. Clears the moment a valid code is pasted. */}
        {!me?.demo && !real && (
          <div className="px-5 sm:px-8 pt-4">
            <button onClick={() => setView("settings")} className="w-full text-left rounded-xl2 border border-g-gold/40 bg-g-gold/[0.10] px-4 py-3 flex flex-wrap items-center gap-3 hover:border-g-gold/70 transition">
              <span className="text-lg">📊</span>
              <div className="min-w-0 flex-1">
                {/* O aviso tem que dizer a VERDADE do caso. Antes era sempre "cole seu código" —
                    inclusive para quem já tinha colado e só perdeu a rede por um segundo. */}
                {realFalha === "rede" || realFalha === "servidor" || realFalha === "resposta_estranha" ? (
                  <>
                    <div className="text-[13px] font-bold text-g-word">{tr("I couldn't refresh your data just now.")}</div>
                    <div className="text-[11.5px] text-g-muted">{tr("This is what I read last — not a live reading. Check your connection and try again.")}</div>
                  </>
                ) : realFalha === "chave_invalida" ? (
                  <>
                    <div className="text-[13px] font-bold text-g-word">{tr("Your connection code isn't matching.")}</div>
                    <div className="text-[11.5px] text-g-muted">{tr("Paste it again in Settings — it's in your welcome email. Nothing on screen is your real data until it matches.")}</div>
                  </>
                ) : (
                  <>
                    <div className="text-[13px] font-bold text-g-word">{tr("You're seeing sample data — this isn't your real account yet.")}</div>
                    <div className="text-[11.5px] text-g-muted">{tr("Paste your connection code (from your welcome email) in Settings to see your real calls, bookings and revenue.")}</div>
                  </>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-g-gold px-3 py-1.5 text-[12px] font-extrabold text-black">{tr("Connect →")}</span>
            </button>
          </div>
        )}

        {/* content — keyed by view+vertical = clean remount/fade per switch */}
        {/* pb-28 no celular: a barra de baixo é `fixed` e cobriria a última linha do conteúdo. */}
        <div className="p-5 pb-28 sm:p-8 md:pb-8">
          <motion.div key={view + vertical} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Suspense fallback={<div className="p-8 text-g-muted text-sm">{tr("Loading your cockpit…")}</div>}>
              {content}
            </Suspense>
          </motion.div>
        </div>
      </main>

      {/* ── BARRA DE BAIXO, SÓ NO CELULAR (2026-08-25) ────────────────────────────────────────
          61 telas atrás de um hambúrguer, e a busca (⌘K) é `hidden md:flex` — no celular não havia
          NENHUM atalho: para ver a agenda o dono abria o menu, rolava a lista e caçava o item.
          Quatro destinos, os quatro que ele abre todo dia. Alvo de toque ≥44px (h-14 = 56px) e
          safe-area do iPhone respeitada, senão o último item fica embaixo da barra do sistema.
          Não toca no slide-over: o hambúrguer continua abrindo as 61 telas. */}
      {(() => {
        // cada slot escolhe a PRIMEIRA view que existe neste setor — nunca um botão que leva a lugar
        // nenhum (a nav do restaurante e a dos serviços não têm as mesmas chaves).
        const primeira = (...ks) => ks.find((k) => sections.some((s) => s[0] === k)) || null;
        const itens = [
          ["hoje", primeira("hoje", "overview"), FaCalendarDays],
          ["Schedule", primeira("schedule", "operations", "riskradar"), FaListCheck],
          ["Inbox", primeira("inbox", "calllogs"), FaComments],
          ["Money", primeira("finance", "impact", "billing"), FaCreditCard],
        ].filter(([, k]) => !!k);
        if (itens.length < 2) return null;   // setor sem destinos suficientes → barra não aparece
        return (
          <nav aria-label={tr("Quick navigation")}
            className="fixed inset-x-0 bottom-0 z-[45] md:hidden border-t border-white/10 bg-[#161512]/98 backdrop-blur-xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <div className="flex">
              {itens.map(([rotulo, key, Icon]) => {
                const on = view === key;
                return (
                  <button key={key} onClick={() => { setView(key); setNavOpen(false); }}
                    aria-current={on ? "page" : undefined}
                    className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${on ? "text-g-green" : "text-g-muted"}`}>
                    <Icon size={17} />
                    <span className="truncate px-1">{tr(rotulo === "hoje" ? "Today" : rotulo, lang)}</span>
                    {on && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-g-green" />}
                  </button>
                );
              })}
            </div>
          </nav>
        );
      })()}

      {/* Gui — the AI assistant that executes tasks (floating, from any view) */}
      <Gui V={V} onNav={setView} real={real} />

      {paletteOpen && <Palette V={V} sections={sections} onNav={setView} onClose={() => setPaletteOpen(false)} />}
      <Toaster />
    </div>
  );
}
