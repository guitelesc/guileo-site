/* MorningBriefing — the top-of-Overview "☀️ Good morning" card. A factual one-liner built
   ENTIRELY client-side from data the Overview already has (the real event ledger, or the demo
   numbers) — no new endpoint. Yesterday's calls/bookings/collected + today's bookings, greeted
   by the hour of day, in the portal language. Honest empty states when there's nothing yet. */
import { tr, UI_LANG, vnum } from "../pages/Portal.jsx";

const L = () => (["en", "pt", "es", "hi"].includes(UI_LANG) ? UI_LANG : "en");

// Hour-of-day greeting + emoji, localized (pt/en/es/hi).
function greeting() {
  const h = new Date().getHours();
  const slot = h < 12 ? 0 : h < 19 ? 1 : 2;      // 0 morning · 1 afternoon · 2 evening
  const emoji = ["☀️", "🌤️", "🌙"][slot];
  const l = L();
  const g = {
    en: ["Good morning", "Good afternoon", "Good evening"],
    pt: ["Bom dia", "Boa tarde", "Boa noite"],
    es: ["Buenos días", "Buenas tardes", "Buenas noches"],
    hi: ["सुप्रभात", "नमस्ते", "शुभ संध्या"],
  }[l][slot];
  return { emoji, g };
}

// [start, end) epoch bounds for yesterday and today (local time).
function bounds() {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYtd = startToday - 864e5;
  return { startYtd, startToday, now: now.getTime() };
}

// Real stats from the event ledger; demo stats from stable per-tenant demo numbers.
function computeStats(V, real) {
  if (real && Array.isArray(real.events)) {
    const { startYtd, startToday, now } = bounds();
    const ev = real.events;
    const inWin = (e, a, b) => { const t = new Date(e.created_at).getTime(); return Number.isFinite(t) && t >= a && t < b; };
    const ydCalls = ev.filter((e) => e.type === "call" && inWin(e, startYtd, startToday)).length;
    const ydBookings = ev.filter((e) => e.type === "booking" && inWin(e, startYtd, startToday)).length;
    // collected yesterday — floor at 0 so a refund never renders "-$40"
    const ydMoney = Math.max(0, Math.round(ev.filter((e) => inWin(e, startYtd, startToday)).reduce((s, e) => s + (Number(e.amount) || 0), 0)));
    const todayBookings = ev.filter((e) => e.type === "booking" && inWin(e, startToday, now + 1)).length;
    const any = ydCalls || ydBookings || ydMoney || todayBookings;
    return { ydCalls, ydBookings, ydMoney, todayBookings, real: true, any };
  }
  // Demo — stable sample numbers (same seed the rest of the demo dashboard uses).
  const label = V.label;
  return {
    ydCalls: vnum(label, "mbf_calls", 6, 28),
    ydBookings: vnum(label, "mbf_book", 2, 11),
    ydMoney: vnum(label, "mbf_money", 180, 1400),
    todayBookings: (V.ops?.schedule?.length) || vnum(label, "mbf_today", 3, 9),
    real: false, any: true,
  };
}

// Build the localized "Ontem: … Hoje: …" sentence.
function sentence(s) {
  const l = L();
  const money = `$${s.ydMoney.toLocaleString()}`;
  if (!s.any) {
    // honest quiet-day state (real mode, nothing yesterday, nothing today yet)
    return l === "pt" ? "Ontem foi tranquilo — nada registrado ainda. Vamos fazer hoje render. 🌱"
      : l === "es" ? "Ayer estuvo tranquilo — aún sin registros. Hagamos que hoy rinda. 🌱"
      : l === "hi" ? "कल शांत रहा — अभी कोई रिकॉर्ड नहीं। आज को बेहतर बनाते हैं। 🌱"
      : "Yesterday was quiet — nothing logged yet. Let's make today count. 🌱";
  }
  if (l === "pt") return `Ontem: ${s.ydCalls} ligações atendidas, ${s.ydBookings} reservas, ${money} registrados. Hoje: ${s.todayBookings} agendamentos.`;
  if (l === "es") return `Ayer: ${s.ydCalls} llamadas atendidas, ${s.ydBookings} reservas, ${money} registrados. Hoy: ${s.todayBookings} citas.`;
  if (l === "hi") return `कल: ${s.ydCalls} कॉल उठाए, ${s.ydBookings} बुकिंग, ${money} दर्ज। आज: ${s.todayBookings} अपॉइंटमेंट।`;
  return `Yesterday: ${s.ydCalls} calls answered, ${s.ydBookings} bookings, ${money} collected. Today: ${s.todayBookings} appointments.`;
}

function MorningBriefing({ V, real = null }) {
  const { emoji, g } = greeting();
  const stats = computeStats(V, real);
  return (
    <div className="rounded-xl2 border border-g-gold/25 bg-gradient-to-br from-g-gold/[0.08] to-transparent px-4 py-3 flex items-start gap-3">
      <span className="text-xl shrink-0 leading-none mt-0.5" aria-hidden>{emoji}</span>
      <div className="min-w-0">
        <div className="text-sm font-extrabold text-g-word flex items-center gap-2">
          {g}!
          {stats.real
            ? <span className="inline-flex items-center gap-1 text-[9px] font-black text-g-green normal-case"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-[9px] font-black text-g-muted normal-case">{tr("sample")}</span>}
        </div>
        <div className="text-xs text-g-muted mt-0.5 leading-snug">{sentence(stats)}</div>
      </div>
    </div>
  );
}

export default MorningBriefing;
