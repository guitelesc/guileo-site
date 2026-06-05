// Per-industry cockpit config (demo data). Hybrid depth: shared AI/growth core + sector-key ops widgets.
// Data source later = Guileo-native (Supabase) and/or client integrations; shape stays the same.

const G = "#3E9468", B = "#38BDF8", D = "#D6C29A", C = "#C2A878";

export const VERTICALS = {
  restaurant: {
    label: "Restaurant", icon: "🍽️",
    business: { name: "New York Pão de Queijo", place: "New York · US", since: "Live since Apr 2026" },
    impact: { total: 24800, parts: [["Revenue recovered", "$18,420"], ["Extra orders", "$4,200"], ["Ad return", "$2,180"]] },
    kpis: [
      { ic: "💵", label: "Total revenue", pre: "$", num: 12840, delta: 12, color: G },
      { ic: "📦", label: "Total orders", num: 506, delta: 8, color: "#8B7CF6" },
      { ic: "📈", label: "Avg order value", pre: "$", num: 25, delta: 3, color: D },
      { ic: "📞", label: "Total calls", num: 312, delta: 15, color: B },
      { ic: "🧑", label: "Total customers", num: 418, delta: 33, color: C },
      { ic: "🔁", label: "Repeat rate", num: 38, suf: "%", delta: 5, color: G },
    ],
    revenue: [8, 10, 9, 13, 12, 16, 15, 19, 18, 22, 24, 28],
    activity: [
      ["📞", "Phone", "João ordered Pão de Queijo x2 — $17.00", "2m"],
      ["💬", "WhatsApp", "Order from Maria Silva — $24.50", "8m"],
      ["✅", "Delivery", "Order #1044 delivered to 31st Ave", "15m"],
      ["⭐", "Google", "Asked a happy customer for a 5★ review", "22m"],
    ],
    quick: [["🍳", "View kitchen HUD", "ops"], ["🍽️", "Manage menu items", "wa"], ["📣", "Send a campaign", "wa"]],
    channelMix: { title: "Channel breakdown", sub: "Order distribution by source", items: [["WhatsApp", 34], ["Phone (AI)", 28], ["Delivery apps", 22], ["Walk-in / QR", 16]] },
    topItems: { title: "Top selling items", items: [
      { name: "Pão de Queijo (3 pack)", sold: 142, rev: 1207.00 },
      { name: "Brazilian Coffee", sold: 120, rev: 480.00 },
      { name: "Brigadeiro", sold: 95, rev: 285.00 },
      { name: "Coxinha", sold: 85, rev: 382.50 },
      { name: "Acai Bowl", sold: 64, rev: 768.00 },
    ] },
    alerts: { title: "Needs attention", items: [
      { level: "warn", text: "Active orders waiting in Kitchen Prep queues" },
      { level: "danger", text: "Pão de Queijo (3 pack) — low stock flagged" },
      { level: "info", text: "Inbound customer calls awaiting AI assistance" },
    ] },
    plan: { label: "Growth Plan", used: 1, total: 2000, unit: "Orders this month" },
    sections: [
      ["overview", "Overview"], ["impact", "Guileo Impact"], ["brain", "Train your AI"], ["analytics", "AI Analytics"], ["liveorders", "Live Orders"],
      ["kitchen", "Kitchen View"], ["menu", "Menu"], ["deliveries", "Delivery"], ["followups", "Follow-ups"], ["waitlist", "Waitlist"], ["payments", "Payments"], ["recurring", "Recurring"], ["reputation", "Reputation"], ["loyalty", "Loyalty"], ["customers", "Customers"], ["campaigns", "Campaigns"],
      ["audiences", "Ad Audiences"], ["inbox", "Inbox"], ["calllogs", "Call Logs"], ["dialer", "Call Dialer"],
      ["whatsapp", "WhatsApp"], ["sms", "SMS"], ["social", "Social"], ["grow", "Grow with Guileo"], ["locations", "Locations"], ["team", "Team"], ["billing", "Billing & Plan"], ["support", "Support"], ["settings", "Settings"],
    ],
    liveOrders: [
      { id: "#1049", customer: "Sofia M.", items: "Pão de Queijo x3, Guaraná", total: 29.0, channel: "iFood", status: "New", color: G },
      { id: "#1048", customer: "Diego R.", items: "Coxinha x6", total: 27.0, channel: "WhatsApp", status: "New", color: G },
      { id: "#1047", customer: "João P.", items: "Pão de Queijo x2", total: 17.0, channel: "Phone", status: "Preparing", color: B },
      { id: "#1046", customer: "Maria Silva", items: "Açaí Bowl, Coffee", total: 24.5, channel: "WhatsApp", status: "Preparing", color: B },
      { id: "#1045", customer: "Carlos M.", items: "Coxinha x4", total: 18.0, channel: "Uber Eats", status: "Ready", color: D },
      { id: "#1044", customer: "Ana R.", items: "Brigadeiro x6", total: 17.1, channel: "QR / Walk-in", status: "Delivered", color: "#7C7C7C" },
    ],
    kitchen: {
      new: [{ id: "#1049", items: "Pão de Queijo x3, Guaraná", t: "now" }, { id: "#1048", items: "Coxinha x6", t: "1 min" }],
      preparing: [{ id: "#1047", items: "Pão de Queijo x2", t: "4 min" }, { id: "#1046", items: "Açaí Bowl, Coffee", t: "5 min" }, { id: "#1043", items: "Coxinha x2, Coffee", t: "6 min" }],
      ready: [{ id: "#1045", items: "Coxinha x4", t: "ready · 2 min" }],
    },
    menu: [
      { name: "Pão de Queijo (3 pack)", price: 8.5, cat: "Savory", stock: "Low" },
      { name: "Coxinha", price: 4.5, cat: "Savory", stock: "OK" },
      { name: "Brazilian Coffee", price: 4.0, cat: "Drinks", stock: "OK" },
      { name: "Açaí Bowl", price: 12.0, cat: "Bowls", stock: "OK" },
      { name: "Brigadeiro", price: 3.0, cat: "Sweets", stock: "OK" },
      { name: "Guaraná", price: 3.5, cat: "Drinks", stock: "Out" },
    ],
    customers: [
      { name: "Maria Silva", orders: 24, spent: 612.5, last: "8 min ago", channel: "WhatsApp" },
      { name: "João P.", orders: 18, spent: 410.0, last: "2 min ago", channel: "Phone" },
      { name: "Carlos M.", orders: 11, spent: 268.0, last: "1 h ago", channel: "Delivery" },
      { name: "Ana R.", orders: 7, spent: 132.4, last: "Yesterday", channel: "QR" },
    ],
    campaigns: [
      { name: "Weekend Pão de Queijo combo", channel: "WhatsApp", sent: 1240, opened: 64, revenue: 1820, status: "Active" },
      { name: "Win-back · 30 days inactive", channel: "SMS", sent: 380, opened: 41, revenue: 640, status: "Active" },
      { name: "New Açaí launch", channel: "Email", sent: 920, opened: 38, revenue: 1110, status: "Scheduled" },
    ],
    audiences: [
      { name: "Repeat customers (3+ orders)", size: 412, source: "Orders" },
      { name: "Lapsed (no order 30d)", size: 188, source: "CRM" },
      { name: "Lookalike · top spenders", size: 22000, source: "Meta" },
      { name: "Local · 3mi radius", size: 48000, source: "Google" },
    ],
    callLogs: [
      { name: "João P.", phone: "+1 (917) 555-0142", outcome: "Order placed · $17.00", dur: "1m 12s", time: "2 min ago", color: G },
      { name: "Unknown", phone: "+1 (646) 555-0199", outcome: "Hours & menu answered", dur: "0m 48s", time: "20 min ago", color: B },
      { name: "Maria Silva", phone: "+1 (917) 555-0177", outcome: "Reservation · 4 ppl", dur: "1m 33s", time: "41 min ago", color: G },
      { name: "Robocall", phone: "+1 (800) 555-0100", outcome: "Spam · blocked", dur: "0m 04s", time: "1 h ago", color: "#EF4444" },
    ],
    convos: [
      { name: "Maria Silva", last: "Order received! ETA 25 min 🛵", t: "8m", unread: 0 },
      { name: "João P.", last: "Confirmed — Pão de Queijo x2", t: "2m", unread: 1 },
      { name: "Carlos M.", last: "Your order is out for delivery", t: "15m", unread: 0 },
      { name: "+1 (646) 555-0188", last: "What time do you close today?", t: "22m", unread: 2 },
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
      mix: { title: "Orders mix", items: [["🍽️ Dine-in", 54], ["🛵 Delivery", 31], ["🥡 Takeout", 15]] },
      peak: { title: "Covers by hour", data: [4, 6, 9, 14, 22, 38, 52, 61, 48, 30, 18, 8], labels: ["12", "", "14", "", "16", "", "18", "", "20", "", "22", ""] },
      channels: { title: "Where bookings come from", items: [["WhatsApp", 38], ["Phone", 29], ["Instagram", 21], ["Google", 12]] },
    },
  },

  clinic: {
    label: "Clinic", icon: "🦷",
    business: { name: "Sorriso Clinic", place: "Lisboa · PT", since: "Live since Mar 2026" },
    impact: { total: 21300, parts: [["Revenue recovered", "$15,900"], ["Recalls reactivated", "$3,600"], ["Ad return", "$1,800"]] },
    plan: { label: "Growth Plan", used: 312, total: 1000, unit: "Appointments this month" },
    channelMix: { title: "Channel breakdown", sub: "Where bookings come from", items: [["WhatsApp", 36], ["Phone (AI)", 31], ["Instagram", 19], ["Google", 14]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "5 patients due for recall this week" }, { level: "danger", text: "Tomorrow 9:00 — double-booking risk" }, { level: "info", text: "3 inbound calls awaiting AI follow-up" }] },
    quick: [["🦷", "See today's appointments", "ops"], ["🔁", "Reactivate recalls", "wa"], ["💬", "Message my team", "support"]],
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
    impact: { total: 16900, parts: [["Revenue recovered", "$11,200"], ["Slots filled", "$3,900"], ["Packages sold", "$1,800"]] },
    plan: { label: "Growth Plan", used: 511, total: 1500, unit: "Bookings this month" },
    channelMix: { title: "Channel breakdown", sub: "Where bookings come from", items: [["WhatsApp", 40], ["Instagram", 27], ["Phone (AI)", 20], ["Google", 13]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "5 open slots tomorrow to fill" }, { level: "info", text: "2 clients with expiring packages" }, { level: "info", text: "Inbound DMs awaiting AI" }] },
    quick: [["💈", "Fill open slots", "ops"], ["🎁", "Push a package", "wa"], ["💬", "Message my team", "support"]],
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
    impact: { total: 38400, parts: [["Signed cases", "$31,000"], ["After-hours intakes", "$5,400"], ["Ad return", "$2,000"]] },
    plan: { label: "Growth Plan", used: 64, total: 300, unit: "Intakes this month" },
    channelMix: { title: "Channel breakdown", sub: "Where leads come from", items: [["Phone (AI)", 38], ["WhatsApp", 30], ["Web form", 20], ["Email", 12]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "11 follow-ups due" }, { level: "danger", text: "1 statute deadline in 3 days" }, { level: "info", text: "After-hours intakes to review" }] },
    quick: [["⚖️", "Review new intakes", "ops"], ["⏰", "Chase follow-ups", "wa"], ["💬", "Message my team", "support"]],
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
  ecommerce: {
    label: "E-Commerce", icon: "🛒",
    business: { name: "Aurora Store", place: "Online · US", since: "Live since Apr 2026" },
    impact: { total: 27600, parts: [["Carts recovered", "$14,800"], ["Won-back customers", "$7,200"], ["Ad return", "$5,600"]] },
    plan: { label: "Growth Plan", used: 506, total: 2000, unit: "Orders this month" },
    channelMix: { title: "Channel breakdown", sub: "Where orders come from", items: [["Website", 44], ["WhatsApp", 26], ["Instagram", 18], ["Email", 12]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "41 carts recovering right now" }, { level: "danger", text: "Signature Hoodie — low stock" }, { level: "info", text: "DMs awaiting AI reply" }] },
    quick: [["🛒", "Recover carts", "wa"], ["📣", "Launch a promo", "wa"], ["💬", "Message my team", "support"]],
    kpis: [
      { ic: "📦", label: "Orders today", num: 73, delta: 16, color: G },
      { ic: "🛒", label: "Carts recovered", num: 41, delta: 0, color: B, note: "AI chased" },
      { ic: "💵", label: "Avg. order value", pre: "$", num: 58, delta: 8, color: D },
      { ic: "💰", label: "Revenue recovered", pre: "$", num: 14800, delta: 26, color: G },
    ],
    revenue: [9, 11, 10, 14, 16, 15, 18, 20, 22, 25, 27, 31],
    activity: [
      ["💬", "WhatsApp", "Recovered an abandoned cart — $124", "now"],
      ["📸", "Instagram", "Answered sizing question & closed sale", "5 min"],
      ["📧", "Email", "Won back a lapsed customer", "17 min"],
      ["⭐", "Google", "Collected a post-purchase 5★ review", "29 min"],
    ],
    ops: {
      stats: [
        { label: "Conversion rate", value: "3.4%", tone: "good" },
        { label: "Cart recovery", value: "28%", tone: "good" },
        { label: "Avg. reply time", value: "15 s", tone: "good" },
      ],
      scheduleTitle: "Latest orders",
      schedule: [
        { time: "#1042", name: "Marcos A.", meta: "2 items · $124", ch: "WhatsApp", status: "Paid", color: G },
        { time: "#1041", name: "Julia R.", meta: "1 item · $58", ch: "Instagram", status: "Paid", color: G },
        { time: "#1040", name: "Pedro S.", meta: "3 items · $211", ch: "Web", status: "Packing", color: B },
        { time: "#1039", name: "Ana L.", meta: "Recovered cart · $96", ch: "WhatsApp", status: "Paid", color: G },
        { time: "#1038", name: "Bruno T.", meta: "1 item · $39", ch: "Web", status: "Refunded", color: C },
      ],
      listTitle: "Top products (mo.)", list: [
        { name: "Signature Hoodie", val: 124 }, { name: "Classic Tee", val: 98 }, { name: "Cap", val: 61 }, { name: "Tote bag", val: 44 },
      ],
    },
  },

  realestate: {
    label: "Real Estate", icon: "🏠",
    business: { name: "Prime Imóveis", place: "São Paulo · BR", since: "Live since Mar 2026" },
    impact: { total: 32000, parts: [["Commission pipeline", "$24,000"], ["Viewings booked", "$5,500"], ["Ad return", "$2,500"]] },
    plan: { label: "Growth Plan", used: 88, total: 400, unit: "Leads this month" },
    channelMix: { title: "Channel breakdown", sub: "Where leads come from", items: [["Phone (AI)", 35], ["WhatsApp", 33], ["Web form", 20], ["Instagram", 12]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "4 viewings to confirm today" }, { level: "info", text: "3 hot buyers awaiting follow-up" }, { level: "info", text: "After-hours leads to review" }] },
    quick: [["🔑", "Today's viewings", "ops"], ["📩", "Send matching listings", "wa"], ["💬", "Message my team", "support"]],
    kpis: [
      { ic: "🔑", label: "Viewings booked today", num: 12, delta: 18, color: G },
      { ic: "🆕", label: "New leads (mo.)", num: 88, delta: 22, color: B },
      { ic: "➡️", label: "Lead → visit rate", num: 34, suf: "%", delta: 6, color: D },
      { ic: "🏘️", label: "Active listings", num: 47, color: C },
    ],
    revenue: [4, 5, 7, 6, 9, 11, 10, 13, 15, 16, 19, 22],
    activity: [
      ["📞", "Phone", "Booked a viewing — Sat 11:00, 2BR apt", "now"],
      ["💬", "WhatsApp", "Qualified a buyer's budget & timeline", "8 min"],
      ["📧", "Email", "Sent 3 matching listings automatically", "20 min"],
      ["⭐", "Google", "Requested a review after closing", "35 min"],
    ],
    ops: {
      stats: [
        { label: "After-hours leads", value: "19", tone: "good" },
        { label: "Avg. response", value: "25 s", tone: "good" },
        { label: "No-show rate", value: "7%", tone: "neutral" },
      ],
      scheduleTitle: "Today's viewings",
      schedule: [
        { time: "10:00", name: "2BR · Jardins", meta: "R. Almeida · buyer", ch: "Phone", status: "Confirmed", color: G },
        { time: "11:30", name: "Studio · Centro", meta: "T. Souza · renter", ch: "WhatsApp", status: "Confirmed", color: G },
        { time: "14:00", name: "House · Morumbi", meta: "M. Dias · buyer", ch: "Instagram", status: "Pending", color: C },
        { time: "16:30", name: "3BR · Pinheiros", meta: "F. Lima · buyer", ch: "Phone", status: "Confirmed", color: G },
      ],
      listTitle: "Hottest listings", list: [
        { name: "2BR · Jardins", val: 34 }, { name: "Studio · Centro", val: 28 }, { name: "3BR · Pinheiros", val: 21 }, { name: "House · Morumbi", val: 12 },
      ],
    },
  },

  gym: {
    label: "Gym & Fitness", icon: "💪",
    business: { name: "Pulse Fitness", place: "Austin · US", since: "Live since Apr 2026" },
    impact: { total: 19400, parts: [["New memberships", "$12,600"], ["Churn saved", "$4,300"], ["Ad return", "$2,500"]] },
    plan: { label: "Growth Plan", used: 63, total: 500, unit: "New members this month" },
    channelMix: { title: "Channel breakdown", sub: "Where leads come from", items: [["WhatsApp", 38], ["Instagram", 30], ["Phone (AI)", 20], ["Google", 12]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "22 at-risk members to re-engage" }, { level: "info", text: "HIIT 7am almost full" }, { level: "info", text: "Trial follow-ups due" }] },
    quick: [["💪", "Book a trial", "wa"], ["🛟", "Re-engage at-risk", "wa"], ["💬", "Message my team", "support"]],
    kpis: [
      { ic: "🏃", label: "Trials booked today", num: 14, delta: 21, color: G },
      { ic: "🪪", label: "New members (mo.)", num: 63, delta: 18, color: B },
      { ic: "📈", label: "Class fill rate", num: 81, suf: "%", delta: 9, color: D },
      { ic: "🛟", label: "At-risk re-engaged", num: 22, color: C, note: "auto-nudged" },
    ],
    revenue: [6, 7, 8, 10, 11, 13, 14, 16, 17, 19, 21, 23],
    activity: [
      ["💬", "WhatsApp", "Booked a free trial — tomorrow 7 AM", "now"],
      ["📞", "Phone", "Reactivated a lapsed member", "10 min"],
      ["📸", "Instagram", "Sold a 3-month plan in DMs", "24 min"],
      ["⭐", "Google", "Collected a 5★ review", "38 min"],
    ],
    ops: {
      stats: [
        { label: "Trial → member", value: "41%", tone: "good" },
        { label: "Walk-ins handled", value: "9", tone: "good" },
        { label: "At-risk re-engaged", value: "17", tone: "good" },
      ],
      scheduleTitle: "Today's trials & classes",
      schedule: [
        { time: "07:00", name: "HIIT class", meta: "18 / 20 booked", ch: "—", status: "Almost full", color: C },
        { time: "09:00", name: "Free trial · Léo", meta: "First visit", ch: "WhatsApp", status: "Confirmed", color: G },
        { time: "12:00", name: "Spin class", meta: "15 / 16 booked", ch: "—", status: "1 open", color: C },
        { time: "18:00", name: "Free trial · Maya", meta: "First visit", ch: "Instagram", status: "Confirmed", color: G },
      ],
      listTitle: "Top classes (mo.)", list: [
        { name: "HIIT", val: 142 }, { name: "Spin", val: 118 }, { name: "Yoga", val: 86 }, { name: "Boxing", val: 54 },
      ],
    },
  },
  medical: {
    label: "Medical", icon: "🏥",
    business: { name: "Vida Clinic", place: "Madrid · ES", since: "Live since Mar 2026" },
    impact: { total: 23600, parts: [["Revenue recovered", "$17,300"], ["Recalls reactivated", "$4,100"], ["Ad return", "$2,200"]] },
    plan: { label: "Growth Plan", used: 418, total: 1500, unit: "Appointments this month" },
    channelMix: { title: "Channel breakdown", sub: "Where bookings come from", items: [["WhatsApp", 34], ["Phone (AI)", 33], ["Instagram", 18], ["Google", 15]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "12 follow-ups due this week" }, { level: "danger", text: "Room 4 offline — reassign 2 appointments" }, { level: "info", text: "Inbound calls awaiting AI" }] },
    quick: [["🏥", "Today's appointments", "ops"], ["🔁", "Send recalls", "wa"], ["💬", "Message my team", "support"]],
    kpis: [
      { ic: "📅", label: "Appointments today", num: 34, delta: 9, color: G },
      { ic: "🆕", label: "New patients (mo.)", num: 52, delta: 21, color: B },
      { ic: "🚫", label: "No-show rate", num: 5, suf: "%", color: D, note: "−3 pts", good: true },
      { ic: "🔁", label: "Follow-ups due", num: 46, color: C, note: "auto-reminded" },
    ],
    revenue: [7, 8, 10, 9, 12, 13, 15, 14, 17, 19, 21, 24],
    activity: [
      ["📞", "Phone", "Booked a consultation — Wed 16:00", "now"],
      ["💬", "WhatsApp", "Confirmed & reminded a patient", "7 min"],
      ["📞", "Phone", "Rescheduled a no-show automatically", "16 min"],
      ["⭐", "Google", "Requested a review after a visit", "30 min"],
    ],
    ops: {
      stats: [
        { label: "Rooms in use", value: "5 / 6", tone: "neutral" },
        { label: "Recalls reactivated", value: "26", tone: "good" },
        { label: "No-shows recovered", value: "9", tone: "good" },
      ],
      scheduleTitle: "Today's appointments",
      schedule: [
        { time: "09:00", name: "Laura M.", meta: "General check-up", ch: "WhatsApp", status: "Confirmed", color: G },
        { time: "10:15", name: "Diego R.", meta: "Cardiology", ch: "Phone", status: "Checked-in", color: B },
        { time: "11:30", name: "Sara P.", meta: "Dermatology", ch: "Instagram", status: "Confirmed", color: G },
        { time: "15:00", name: "Iván T.", meta: "Follow-up", ch: "Phone", status: "Confirmed", color: G },
        { time: "16:30", name: "Nuria L.", meta: "Recall · check-up", ch: "WhatsApp", status: "Pending", color: C },
      ],
      gridTitle: "Rooms", grid: [
        { label: "R1", on: true }, { label: "R2", on: true }, { label: "R3", on: true }, { label: "R4", on: true }, { label: "R5", on: true }, { label: "R6", on: false },
      ],
      listTitle: "Top specialties (mo.)", list: [
        { name: "General", val: 92 }, { name: "Cardiology", val: 41 }, { name: "Dermatology", val: 33 }, { name: "Pediatrics", val: 25 },
      ],
    },
  },

  homeservices: {
    label: "Plumbing & HVAC", icon: "🔧",
    business: { name: "FlowPro Services", place: "Dallas · US", since: "Live since Apr 2026" },
    impact: { total: 29800, parts: [["Jobs won", "$21,400"], ["After-hours captured", "$6,200"], ["Ad return", "$2,200"]] },
    plan: { label: "Growth Plan", used: 84, total: 500, unit: "Jobs this month" },
    channelMix: { title: "Channel breakdown", sub: "Where jobs come from", items: [["Phone (AI)", 46], ["WhatsApp", 34], ["Web form", 12], ["Google", 8]] },
    alerts: { title: "Needs attention", items: [{ level: "danger", text: "Furnace check — unassigned tech" }, { level: "warn", text: "12 emergency calls today" }, { level: "info", text: "Quotes awaiting follow-up" }] },
    quick: [["🛠️", "Today's jobs", "ops"], ["🧾", "Send a quote", "wa"], ["💬", "Message my team", "support"]],
    kpis: [
      { ic: "🛠️", label: "Jobs booked today", num: 19, delta: 17, color: G },
      { ic: "🧾", label: "Quotes sent (mo.)", num: 84, delta: 23, color: B },
      { ic: "🚨", label: "Emergency calls won", num: 12, color: D, note: "after-hours" },
      { ic: "💰", label: "Revenue recovered", pre: "$", num: 21400, delta: 28, color: G },
    ],
    revenue: [6, 8, 7, 11, 12, 14, 13, 16, 18, 20, 22, 26],
    activity: [
      ["📞", "Phone", "Captured a 2 AM emergency leak job", "now"],
      ["💬", "WhatsApp", "Sent a quote & booked Tue 9 AM", "12 min"],
      ["📞", "Phone", "Dispatched a tech to a no-heat call", "26 min"],
      ["⭐", "Google", "Requested a review after the repair", "44 min"],
    ],
    ops: {
      stats: [
        { label: "After-hours jobs", value: "12", tone: "good" },
        { label: "Avg. response", value: "18 s", tone: "good" },
        { label: "Quote → job", value: "44%", tone: "good" },
      ],
      scheduleTitle: "Today's jobs",
      schedule: [
        { time: "08:30", name: "Water heater", meta: "Oak St · Tech Mike", ch: "Phone", status: "Dispatched", color: B },
        { time: "10:00", name: "AC tune-up", meta: "5th Ave · Tech Sara", ch: "WhatsApp", status: "Confirmed", color: G },
        { time: "13:00", name: "Leak repair", meta: "Elm Rd · Tech Mike", ch: "Phone", status: "Confirmed", color: G },
        { time: "16:00", name: "Furnace check", meta: "Pine St · unassigned", ch: "WhatsApp", status: "Pending", color: C },
      ],
      listTitle: "Top jobs (mo.)", list: [
        { name: "AC repair", val: 58 }, { name: "Leak / plumbing", val: 47 }, { name: "Water heater", val: 31 }, { name: "Furnace", val: 22 },
      ],
    },
  },

  auto: {
    label: "Auto Dealership", icon: "🚗",
    business: { name: "DriveMax Motors", place: "Houston · US", since: "Live since Feb 2026" },
    impact: { total: 41200, parts: [["Sales pipeline", "$33,000"], ["Service revenue", "$5,800"], ["Ad return", "$2,400"]] },
    plan: { label: "Growth Plan", used: 121, total: 600, unit: "Leads this month" },
    channelMix: { title: "Channel breakdown", sub: "Where leads come from", items: [["Phone (AI)", 40], ["WhatsApp", 30], ["Web form", 18], ["Instagram", 12]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "16 test drives today" }, { level: "info", text: "Service bay 80% booked" }, { level: "info", text: "After-hours leads to review" }] },
    quick: [["🚘", "Today's test drives", "ops"], ["📩", "Send matching cars", "wa"], ["💬", "Message my team", "support"]],
    kpis: [
      { ic: "🚘", label: "Test drives today", num: 16, delta: 20, color: G },
      { ic: "🔧", label: "Service appts today", num: 42, delta: 11, color: B },
      { ic: "🆕", label: "New leads (mo.)", num: 121, delta: 25, color: D },
      { ic: "➡️", label: "Lead → showroom", num: 38, suf: "%", delta: 7, color: C },
    ],
    revenue: [8, 9, 11, 10, 13, 15, 14, 18, 20, 22, 25, 29],
    activity: [
      ["📞", "Phone", "Booked a test drive — SUV, Sat 14:00", "now"],
      ["💬", "WhatsApp", "Answered financing questions & qualified", "9 min"],
      ["📧", "Email", "Sent 3 matching vehicles automatically", "22 min"],
      ["⭐", "Google", "Requested a review after delivery", "37 min"],
    ],
    ops: {
      stats: [
        { label: "After-hours leads", value: "23", tone: "good" },
        { label: "Avg. response", value: "20 s", tone: "good" },
        { label: "Show-rate", value: "72%", tone: "good" },
      ],
      scheduleTitle: "Today's test drives & service",
      schedule: [
        { time: "10:00", name: "SUV test drive", meta: "R. Costa · buyer", ch: "Phone", status: "Confirmed", color: G },
        { time: "11:30", name: "Oil change", meta: "Plate ABC-1234", ch: "WhatsApp", status: "Checked-in", color: B },
        { time: "14:00", name: "Sedan test drive", meta: "M. Reis · buyer", ch: "Instagram", status: "Confirmed", color: G },
        { time: "16:00", name: "Brake service", meta: "Plate XYZ-9988", ch: "Phone", status: "Pending", color: C },
      ],
      listTitle: "Top models (mo.)", list: [
        { name: "Compact SUV", val: 64 }, { name: "Sedan", val: 49 }, { name: "Pickup", val: 33 }, { name: "Hatch", val: 21 },
      ],
    },
  },

  education: {
    label: "Education", icon: "📚",
    business: { name: "BrightPath Academy", place: "Online · BR", since: "Live since Mar 2026" },
    impact: { total: 18700, parts: [["New enrollments", "$13,200"], ["Win-backs", "$3,300"], ["Ad return", "$2,200"]] },
    plan: { label: "Growth Plan", used: 96, total: 500, unit: "Leads this month" },
    channelMix: { title: "Channel breakdown", sub: "Where leads come from", items: [["WhatsApp", 42], ["Instagram", 26], ["Phone (AI)", 18], ["Email", 14]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "14 at-risk students" }, { level: "info", text: "Coding trial almost full" }, { level: "info", text: "Trial follow-ups due" }] },
    quick: [["🎓", "Today's trials", "ops"], ["📣", "Promote a course", "wa"], ["💬", "Message my team", "support"]],
    kpis: [
      { ic: "🎓", label: "Enrollments (mo.)", num: 58, delta: 22, color: G },
      { ic: "📝", label: "Trial classes today", num: 21, delta: 16, color: B },
      { ic: "🆕", label: "New leads (mo.)", num: 96, delta: 19, color: D },
      { ic: "🔁", label: "Retention rate", num: 88, suf: "%", delta: 5, color: C },
    ],
    revenue: [5, 6, 8, 7, 10, 11, 13, 14, 16, 18, 20, 22],
    activity: [
      ["💬", "WhatsApp", "Booked a trial class — tomorrow 18:00", "now"],
      ["📞", "Phone", "Answered course questions & enrolled", "8 min"],
      ["📧", "Email", "Won back a paused student", "23 min"],
      ["⭐", "Google", "Collected a 5★ review from a parent", "36 min"],
    ],
    ops: {
      stats: [
        { label: "Trial → enroll", value: "39%", tone: "good" },
        { label: "Avg. response", value: "16 s", tone: "good" },
        { label: "At-risk re-engaged", value: "14", tone: "good" },
      ],
      scheduleTitle: "Today's trials & classes",
      schedule: [
        { time: "16:00", name: "English · trial", meta: "Lucas · new", ch: "WhatsApp", status: "Confirmed", color: G },
        { time: "17:00", name: "Math · group", meta: "12 / 14 booked", ch: "—", status: "2 open", color: C },
        { time: "18:00", name: "Coding · trial", meta: "Bianca · new", ch: "Instagram", status: "Confirmed", color: G },
        { time: "19:30", name: "Spanish · group", meta: "10 / 10 booked", ch: "—", status: "Full", color: G },
      ],
      listTitle: "Top courses (mo.)", list: [
        { name: "English", val: 78 }, { name: "Math", val: 52 }, { name: "Coding", val: 40 }, { name: "Spanish", val: 28 },
      ],
    },
  },

  construction: {
    label: "Construction", icon: "🏗️",
    business: { name: "BuildRight Co.", place: "Phoenix · US", since: "Live since Feb 2026" },
    impact: { total: 52000, parts: [["Project pipeline", "$44,000"], ["After-hours quotes", "$5,500"], ["Ad return", "$2,500"]] },
    plan: { label: "Growth Plan", used: 39, total: 200, unit: "Qualified leads this month" },
    channelMix: { title: "Channel breakdown", sub: "Where leads come from", items: [["Phone (AI)", 44], ["WhatsApp", 32], ["Web form", 16], ["Email", 8]] },
    alerts: { title: "Needs attention", items: [{ level: "warn", text: "7 site visits today" }, { level: "info", text: "3 estimates awaiting follow-up" }, { level: "info", text: "After-hours leads to review" }] },
    quick: [["🏗️", "Today's site visits", "ops"], ["🧾", "Send an estimate", "wa"], ["💬", "Message my team", "support"]],
    kpis: [
      { ic: "🧾", label: "Quote requests today", num: 11, delta: 18, color: G },
      { ic: "🏗️", label: "Site visits booked", num: 7, delta: 14, color: B },
      { ic: "✅", label: "Qualified leads (mo.)", num: 39, delta: 24, color: D },
      { ic: "📈", label: "Pipeline value", pre: "$", num: 44000, delta: 16, color: C },
    ],
    revenue: [4, 5, 7, 9, 8, 11, 13, 12, 16, 18, 21, 25],
    activity: [
      ["📞", "Phone", "Captured a remodel quote request", "now"],
      ["💬", "WhatsApp", "Qualified budget & booked a site visit", "14 min"],
      ["📧", "Email", "Sent estimate & follow-up", "27 min"],
      ["⭐", "Google", "Requested a review after handover", "45 min"],
    ],
    ops: {
      stats: [
        { label: "After-hours leads", value: "16", tone: "good" },
        { label: "Avg. response", value: "22 s", tone: "good" },
        { label: "Quote → visit", value: "47%", tone: "good" },
      ],
      scheduleTitle: "Today's site visits",
      schedule: [
        { time: "09:00", name: "Kitchen remodel", meta: "R. Alves · estimate", ch: "Phone", status: "Confirmed", color: G },
        { time: "11:00", name: "Roof replacement", meta: "T. Nunes · estimate", ch: "WhatsApp", status: "Confirmed", color: G },
        { time: "14:00", name: "Home addition", meta: "M. Pires · estimate", ch: "Phone", status: "Pending", color: C },
        { time: "16:00", name: "Bathroom reno", meta: "F. Dias · estimate", ch: "Instagram", status: "Confirmed", color: G },
      ],
      listTitle: "Top projects (mo.)", list: [
        { name: "Remodel", val: 44 }, { name: "Roofing", val: 31 }, { name: "Addition", val: 22 }, { name: "Bathroom", val: 17 },
      ],
    },
  },
};

export const VERTICAL_KEYS = Object.keys(VERTICALS);
