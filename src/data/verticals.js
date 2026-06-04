// Per-industry cockpit config (demo data). Hybrid depth: shared AI/growth core + sector-key ops widgets.
// Data source later = Guileo-native (Supabase) and/or client integrations; shape stays the same.

const G = "#3E9468", B = "#38BDF8", D = "#D6C29A", C = "#C2A878";

export const VERTICALS = {
  restaurant: {
    label: "Restaurant", icon: "🍽️",
    business: { name: "Bella Pizza", place: "São Paulo · BR", since: "Live since Apr 2026" },
    kpis: [
      { ic: "📅", label: "Reservations today", num: 48, delta: 12, color: G },
      { ic: "🍽️", label: "Covers booked", num: 132, delta: 9, color: B },
      { ic: "🚫", label: "No-show rate", num: 4, suf: "%", color: D, note: "−2 pts", good: true },
      { ic: "💰", label: "Revenue recovered", pre: "$", num: 18420, delta: 22, color: G },
    ],
    revenue: [8, 10, 9, 13, 12, 16, 15, 19, 18, 22, 24, 28],
    activity: [
      ["📞", "Phone", "Booked a table for 4 — tonight 8:00 PM", "now"],
      ["💬", "WhatsApp", "Took a delivery order — $54", "4 min"],
      ["📸", "Instagram", "Answered a menu question & upsold dessert", "11 min"],
      ["⭐", "Google", "Asked a happy diner for a 5★ review", "22 min"],
    ],
    ops: {
      stats: [
        { label: "Seated now", value: "76%", tone: "neutral" },
        { label: "Avg. table value", value: "$62", tone: "neutral" },
        { label: "No-shows saved", value: "9", tone: "good" },
      ],
      scheduleTitle: "Today's reservations",
      schedule: [
        { time: "19:00", name: "Marcos A.", meta: "Party of 2", ch: "WhatsApp", status: "Confirmed", color: G },
        { time: "19:30", name: "Julia R.", meta: "Party of 4", ch: "Phone", status: "Confirmed", color: G },
        { time: "20:00", name: "Pedro S.", meta: "Party of 6 · birthday", ch: "Instagram", status: "Seated", color: B },
        { time: "20:30", name: "Ana L.", meta: "Party of 3", ch: "WhatsApp", status: "Confirmed", color: G },
        { time: "21:00", name: "Bruno T.", meta: "Party of 2", ch: "Phone", status: "Pending", color: C },
      ],
      gridTitle: "Tables", grid: [
        { label: "T1", on: true }, { label: "T2", on: true }, { label: "T3", on: false }, { label: "T4", on: true },
        { label: "T5", on: false }, { label: "T6", on: true }, { label: "T7", on: true }, { label: "T8", on: false },
      ],
      listTitle: "Top dishes today", list: [
        { name: "Margherita", val: 42 }, { name: "Pepperoni", val: 31 }, { name: "Tiramisù", val: 18 }, { name: "Lasagna", val: 14 },
      ],
    },
  },

  clinic: {
    label: "Clinic", icon: "🦷",
    business: { name: "Sorriso Clinic", place: "Lisboa · PT", since: "Live since Mar 2026" },
    kpis: [
      { ic: "📅", label: "Appointments today", num: 26, delta: 8, color: G },
      { ic: "🆕", label: "New patients (mo.)", num: 41, delta: 24, color: B },
      { ic: "🚫", label: "No-show rate", num: 6, suf: "%", color: D, note: "−3 pts", good: true },
      { ic: "🔁", label: "Recalls due", num: 38, color: C, note: "auto-reminded" },
    ],
    revenue: [6, 7, 9, 8, 11, 12, 14, 13, 16, 18, 20, 23],
    activity: [
      ["📞", "Phone", "Booked a cleaning — Thu 10:30", "now"],
      ["💬", "WhatsApp", "Reminded patient & confirmed recall", "6 min"],
      ["📞", "Phone", "Rescheduled a no-show automatically", "15 min"],
      ["⭐", "Google", "Requested a review after a visit", "28 min"],
    ],
    ops: {
      stats: [
        { label: "Chairs in use", value: "3 / 4", tone: "neutral" },
        { label: "Recalls reactivated", value: "21", tone: "good" },
        { label: "No-shows recovered", value: "7", tone: "good" },
      ],
      scheduleTitle: "Today's appointments",
      schedule: [
        { time: "09:00", name: "Carla M.", meta: "Cleaning", ch: "WhatsApp", status: "Confirmed", color: G },
        { time: "10:30", name: "João P.", meta: "Whitening", ch: "Phone", status: "Checked-in", color: B },
        { time: "11:15", name: "Rita F.", meta: "Consultation", ch: "Instagram", status: "Confirmed", color: G },
        { time: "14:00", name: "Hugo N.", meta: "Implant follow-up", ch: "Phone", status: "Confirmed", color: G },
        { time: "15:30", name: "Sofia L.", meta: "Recall · cleaning", ch: "WhatsApp", status: "Pending", color: C },
      ],
      gridTitle: "Rooms", grid: [
        { label: "R1", on: true }, { label: "R2", on: true }, { label: "R3", on: true }, { label: "R4", on: false },
      ],
      listTitle: "Top procedures (mo.)", list: [
        { name: "Cleaning", val: 86 }, { name: "Whitening", val: 34 }, { name: "Consultation", val: 29 }, { name: "Implant", val: 11 },
      ],
    },
  },

  salon: {
    label: "Salon & Spa", icon: "💈",
    business: { name: "Lumière Spa", place: "Miami · US", since: "Live since May 2026" },
    kpis: [
      { ic: "📅", label: "Bookings today", num: 31, delta: 14, color: G },
      { ic: "📈", label: "Chair utilization", num: 82, suf: "%", delta: 11, color: B },
      { ic: "🕳️", label: "Open slots to fill", num: 5, color: D, note: "AI filling", good: true },
      { ic: "🎁", label: "Packages sold (mo.)", num: 12, delta: 33, color: G },
    ],
    revenue: [5, 6, 8, 9, 10, 12, 13, 15, 17, 19, 21, 24],
    activity: [
      ["💬", "WhatsApp", "Booked a haircut + color — Sat 14:00", "now"],
      ["📸", "Instagram", "Sold a 5-session package in DMs", "7 min"],
      ["📞", "Phone", "Filled a cancelled slot in 3 min", "19 min"],
      ["⭐", "Google", "Collected a 5★ review", "33 min"],
    ],
    ops: {
      stats: [
        { label: "Walk-ins handled", value: "8", tone: "good" },
        { label: "Avg. ticket", value: "$74", tone: "neutral" },
        { label: "Slots auto-filled", value: "5", tone: "good" },
      ],
      scheduleTitle: "Today by professional",
      schedule: [
        { time: "Bianca", name: "92% booked", meta: "Hair · 7 clients", ch: "—", status: "Full", color: G },
        { time: "Tom", name: "78% booked", meta: "Barber · 6 clients", ch: "—", status: "2 open", color: C },
        { time: "Léa", name: "85% booked", meta: "Nails · 8 clients", ch: "—", status: "1 open", color: C },
        { time: "Spa room", name: "70% booked", meta: "Massage · 4 clients", ch: "—", status: "2 open", color: C },
      ],
      gridTitle: "Stations", grid: [
        { label: "S1", on: true }, { label: "S2", on: true }, { label: "S3", on: false }, { label: "S4", on: true }, { label: "S5", on: false }, { label: "S6", on: true },
      ],
      listTitle: "Top services (mo.)", list: [
        { name: "Haircut + color", val: 61 }, { name: "Manicure", val: 48 }, { name: "Massage", val: 30 }, { name: "Facial", val: 22 },
      ],
    },
  },

  law: {
    label: "Law Firm", icon: "⚖️",
    business: { name: "Mendes & Co.", place: "São Paulo · BR", since: "Live since Feb 2026" },
    kpis: [
      { ic: "🆕", label: "New intakes (mo.)", num: 64, delta: 19, color: G },
      { ic: "📅", label: "Consults booked", num: 28, delta: 12, color: B },
      { ic: "✅", label: "Qualified leads", num: 41, delta: 22, color: G },
      { ic: "⏰", label: "Follow-ups due", num: 11, color: D, note: "auto-nudged" },
    ],
    revenue: [4, 5, 6, 8, 9, 10, 12, 13, 15, 16, 18, 21],
    activity: [
      ["📞", "Phone", "Captured an after-hours injury intake", "now"],
      ["💬", "WhatsApp", "Qualified a case & booked a consult", "9 min"],
      ["📧", "Email", "Sent intake form & follow-up", "21 min"],
      ["⭐", "Google", "Requested a review after a win", "40 min"],
    ],
    ops: {
      stats: [
        { label: "After-hours intakes", value: "17", tone: "good" },
        { label: "Avg. response", value: "20 s", tone: "good" },
        { label: "Consult show-rate", value: "88%", tone: "good" },
      ],
      scheduleTitle: "New intakes",
      schedule: [
        { time: "08:42", name: "R. Almeida", meta: "Personal injury", ch: "Phone", status: "Qualified", color: G },
        { time: "10:10", name: "T. Souza", meta: "Family law", ch: "WhatsApp", status: "Consult booked", color: B },
        { time: "12:30", name: "M. Dias", meta: "Labor", ch: "Email", status: "New", color: C },
        { time: "15:05", name: "F. Lima", meta: "Real estate", ch: "Phone", status: "Follow-up", color: C },
        { time: "18:55", name: "P. Castro", meta: "Injury · after-hours", ch: "Phone", status: "Qualified", color: G },
      ],
      listTitle: "Matter types (mo.)", list: [
        { name: "Personal injury", val: 38 }, { name: "Family law", val: 24 }, { name: "Labor", val: 19 }, { name: "Real estate", val: 12 },
      ],
    },
  },
};

export const VERTICAL_KEYS = Object.keys(VERTICALS);
