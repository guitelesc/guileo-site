/* Split out of Portal.jsx (performance): Overview tab view — code moved verbatim. */
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaArrowTrendUp, FaChevronDown, FaPen, FaTrash, FaArrowTrendDown } from "react-icons/fa6";
import { portalApi, toast, loadDataKey } from "../lib/portalApi.js";
import { Count } from "../lib/ui.jsx";
import { waLink } from "../data/contact.js";
import { tr, growthOps, loadAutomations, dueAutomations, runAutomation, weeklySummary, eventsInPeriod, sumAmounts, realDaily, EstChip, guiAlerts, UI_LANG, Card, GuiMark, dailyBriefing, scaleMoney, alertTarget, PLAY_COLOR, EVENT_ICON, relTime, recentActivity, vnum, Toggle, toggleAutomation, removeAutomation, Spark, Bars, SECTOR_OPS, speakLine, stopSpeaking, monthBookings, sectorBaseline } from "../pages/Portal.jsx";
import GuiPlant from "./GuiPlant.jsx";
import MorningBriefing from "./MorningBriefing.jsx";

// The tenant PAYING Guileo (subscription / credit top-up) is NEVER part of the ROI Gui drove for
// them — only their own customers' money counts. In this data model a `payment` event = a charge TO
// Guileo (client-report uses it as guiCost); customer revenue is sale/order/invoice/deposit/booking.
// (get_client_data returns no payload, so this replaces any payload-based guess with a real rule.)
const isGuileoPayment = (e) =>
  !!e && e.type === "payment" && !/^💳/.test(e.summary || "") && (
    /stripe|mercado\s?pago|mercadopago|system|billing/i.test(e.channel || "") ||
    /plan|subscription|assinat|recarga|top-?up|credit|cr[eé]dito|renew|invoice guileo/i.test(e.summary || "") ||
    !(e.channel || "").trim()
  );

// Prompts a REAL client to connect their Stripe so the money Gui collects actually reaches them.
// Silent for demo (no email/key), while checking, on error, and once connected — it only ever nags
// when there's a real gap. This is what makes Stripe Connect discoverable from inside the cockpit.
function ReceberBanner({ email = "", dataKey = "" }) {
  const [st, setSt] = useState(""); // "" | checking | connected | pending
  useEffect(() => {
    if (!email || !email.includes("@") || !dataKey) return; // demo / not logged as real client → stay silent
    let alive = true;
    setSt("checking");
    fetch("/api/stripe-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", email, token: dataKey }) })
      // Only trust an explicit ok:true status. On any error shape (401/403/hiccup) stay silent — never
      // nag a client to "connect" just because a status check failed transiently.
      .then((r) => r.json()).then((d) => { if (!alive) return; if (d && d.ok === true) setSt(d.charges_enabled ? "connected" : "pending"); else setSt(""); })
      .catch(() => { if (alive) setSt(""); }); // transient error → don't nag
    return () => { alive = false; };
  }, [email, dataKey]);
  if (st !== "pending") return null; // silent unless there's a real, confirmed gap
  const L = (en, pt, es) => (UI_LANG === "pt" ? pt : UI_LANG === "es" ? es : en);
  return (
    <a href="/receber" className="block rounded-2xl border border-g-gold/40 bg-gradient-to-r from-g-gold/10 to-g-green/[0.06] px-4 py-3.5 no-underline transition hover:border-g-gold/70">
      <div className="flex items-center gap-3">
        <span className="text-2xl">💳</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-extrabold text-g-word">{L("Connect your Stripe to get paid", "Conecte seu Stripe pra receber", "Conecta tu Stripe para cobrar")}</div>
          <div className="text-[12px] text-g-muted">{L("Without it, Gui closes the sale but the money won't reach you. Connect once — then the money is yours.", "Sem isso, a Gui fecha a venda mas o dinheiro não chega até você. Conecte uma vez — aí o dinheiro é seu.", "Sin esto, Gui cierra la venta pero el dinero no llega a ti. Conéctalo una vez — luego el dinero es tuyo.")}</div>
        </div>
        <span className="shrink-0 rounded-full bg-g-gold px-3.5 py-1.5 text-[12px] font-bold text-g-deep">{L("Connect now →", "Conectar agora →", "Conectar ahora →")}</span>
      </div>
    </a>
  );
}

function Overview({ V, onNav, sections = [], period = "30 days", real = null, onRefresh, refreshing = false, autoSpeak = false, onAutoSpoke, email = "", dataKey = "" }) {
  const [resolved, setResolved] = useState(() => portalApi.loadState(`${V.label}:alerts`, []));
  const [alertsOpen, setAlertsOpen] = useState(false);
  useEffect(() => { setResolved(portalApi.loadState(`${V.label}:alerts`, [])); }, [V.label]);
  const resolveAlert = (i) => { portalApi.resolveAlert(i); setResolved((r) => { const n = [...r, i]; portalApi.saveState(`${V.label}:alerts`, n); return n; }); toast(tr("All set — I've marked it handled.")); };
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
  // Monthly revenue goal — editable + persisted. Default seeds off demo impact; in real mode the
  // PROGRESS (below, once monthMoney is known) tracks the live ledger, never a fabricated number.
  const defGoal = Math.max(500, Math.round((V.impact.total * 2.4) / 100) * 100);
  const [goal, setGoal] = useState(() => portalApi.loadState(`${V.label}:goal`, defGoal));
  const [editGoal, setEditGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(goal);
  useEffect(() => { const g = portalApi.loadState(`${V.label}:goal`, defGoal); setGoal(g); setGoalDraft(g); }, [V.label]); // eslint-disable-line
  const saveGoal = () => { const g = Math.max(100, parseInt(String(goalDraft).replace(/\D/g, ""), 10) || defGoal); setGoal(g); portalApi.saveState(`${V.label}:goal`, g); setEditGoal(false); toast(`Monthly goal set to $${g.toLocaleString()} ✓`); };
  // The seed data represents a 30-day window; 7d/90d scale the cumulative money.
  const periodFactor = { "7 days": 7 / 30, "30 days": 1, "90 days": 3 }[period] || 1;
  const periodLabel = period === "30 days" ? "this month" : `last ${period}`;
  const openAlerts = V.alerts ? V.alerts.items.map((a, i) => ({ a, i })).filter(({ i }) => !resolved.includes(i)) : [];
  const quick = (V.quick || [["📋", "See today's operations", "ops"], ["💬", "Message my team", "support"], ["📣", "Ask for a campaign", "wa"]]).map(([ic, label, kind]) =>
    kind === "ops" ? { ic, label, on: () => onNav("operations") }
      : kind === "support" ? { ic, label, on: () => onNav("support") }
        : { ic, label, href: waLink(`Guileo — ${label}`) }
  );
  // ── REAL MODE — everything computable comes from the live event ledger ──
  const realEvents = real ? eventsInPeriod(real?.events, period) : null;
  // Growth events = real events MINUS what the tenant pays Guileo (their bill isn't ROI they earned).
  const growthEvents = realEvents ? realEvents.filter((e) => !isGuileoPayment(e)) : null;
  // Floor at 0 — "profit impact" / "real revenue" is value Gui GENERATED; a refund/chargeback
  // event (negative amount) must never render the headline as "$-96". Net losses show $0, not red.
  const realMoney = Math.max(0, growthEvents ? sumAmounts(growthEvents) : 0);
  // 💰 AUTHORITATIVE month revenue — read the SAME spine as the weekly email (/api/revenue →
  // revenue_month sums the client_revenue ledger in cents). client_events (what `real` carries) is a
  // marketing feed → summing it ≈ 0, so the headline/goal must come from here in real mode.
  const [rev, setRev] = useState(null);
  const dk = dataKey || loadDataKey();
  useEffect(() => {
    let alive = true;
    if (!real || !email || !dk) { setRev(null); return; }
    fetch("/api/revenue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dk, email }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setRev(j && j.ok ? j : null); })
      .catch(() => { if (alive) setRev(null); });
    return () => { alive = false; };
  }, [real, email, dk]);
  const revMonthUsd = rev && rev.ready && Number.isFinite(rev.month_cents) ? rev.month_cents / 100 : null;
  const revWeekUsd = rev && rev.ready && Number.isFinite(rev.week_cents) ? rev.week_cents / 100 : null;
  // The real "this month" money figure that drives the headline (month view), goal, and plant.
  // Prefer the ledger truth; fall back to the growth-event sum until /api/revenue loads (or its SQL
  // isn't pasted). In demo it stays V.impact.total so nothing about the sample view changes.
  const realMonthUsd = real ? (revMonthUsd != null ? revMonthUsd : realMoney) : null;
  const monthMoney = real ? (realMonthUsd || 0) : V.impact.total;
  // Value Gui generated THIS CALENDAR MONTH — drives the living GuiPlant (floor at 0 so a
  // refund never shrinks the plant into the negative). Null in demo → GuiPlant uses demo stage.
  const monthValue = real
    ? Math.max(0, revMonthUsd != null
      ? revMonthUsd
      : (Array.isArray(real.events) ? (() => { const m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(); return real.events.filter((e) => !isGuileoPayment(e) && new Date(e.created_at).getTime() >= m0).reduce((s, e) => s + (Number(e.amount) || 0), 0); })() : 0))
    : null;
  // Goal progress — real mode tracks monthMoney (live ledger); demo tracks V.impact.total.
  const projected = Math.round(monthMoney * 1.6);
  const pctNow = Math.min(100, Math.round((monthMoney / Math.max(1, goal)) * 100));
  const pctProj = Math.round((projected / Math.max(1, goal)) * 100);
  // "Your week by Gui" — in real mode, derive the recap from the live ledger (no vnum, no demo
  // "$ to collect"): last-7-day conversation/booking counts + the week's real revenue from the
  // same spine as the email. Demo keeps weeklySummary(V) untouched.
  const wkView = real ? (() => {
    const since = Date.now() - 7 * 864e5;
    const evs = (real.events || []).filter((e) => new Date(e.created_at).getTime() >= since);
    const handled = evs.filter((e) => e.type === "call" || e.type === "message").length;
    return {
      handled,
      created: evs.filter((e) => e.type === "booking").length,
      driven: revWeekUsd != null ? Math.round(revWeekUsd) : Math.max(0, sumAmounts(evs.filter((e) => !isGuileoPayment(e)))),
      hours: Math.max(1, Math.round(handled * 0.1)), // ~6 min saved per handled conversation (labeled estimate)
      open: 0, // real open-invoice count isn't exposed to the cockpit → omit rather than fabricate
      peak: wk.peak,
    };
  })() : wk;
  const realSeries = realEvents ? realDaily(realEvents, period) : null;
  const realHasRevenue = !!realSeries && realSeries.some((n) => n > 0);
  const realKpis = realEvents ? [
    { ic: "💰", label: tr("Real revenue"), num: realMoney, pre: "$", color: "#3E9468" },
    { ic: "💬", label: tr("Conversations"), num: realEvents.filter((e) => e.type === "call" || e.type === "message").length, color: "#D6C29A" },
    { ic: "📅", label: tr("Bookings"), num: realEvents.filter((e) => e.type === "booking").length, color: "#5fa8d3" },
    { ic: "🎯", label: tr("Leads"), num: realEvents.filter((e) => e.type === "lead").length, color: "#e0855f" },
  ] : null;
  const est = real ? <EstChip /> : null; // honesty chip on sections still showing sample data
  // ── DAILY BRIEFING, spoken — Gui reads the same greeting + briefing + goal line aloud
  // via the browser's speechSynthesis (feature-detected; the ▶ tap is the user gesture).
  const hour = new Date().getHours();
  const greetLine = UI_LANG === "es" ? (hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches") : UI_LANG === "pt" ? (hour < 12 ? "Bom dia" : hour < 19 ? "Boa tarde" : "Boa noite") : (hour < 12 ? "Good morning" : hour < 19 ? "Good afternoon" : "Good evening");
  const goalLine = pctNow >= 100 ? tr("You beat your monthly goal!") : `${tr("You're at")} ${pctNow}% ${tr("of this month's goal.")}`;
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => () => stopSpeaking(), []); // never keep talking after the tab unmounts
  const hearBriefing = () => {
    setNudgeHear(false);
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    if (speakLine(`${greetLine}. ${dailyBriefing(V)}. ${goalLine}`, () => setSpeaking(false))) setSpeaking(true);
  };
  // 🎙️ Arrived via the weekly email's "Hear my week" link (?speak=weekly): try the spoken
  // briefing once. Browsers may block speech without a gesture — so we ALSO highlight the
  // existing ▶ pill (gui-breathe) as the honest 1-tap fallback. Feature-detected, never crashes.
  const [nudgeHear, setNudgeHear] = useState(false);
  const autoSpokeRef = useRef(false);
  useEffect(() => {
    if (!autoSpeak || autoSpokeRef.current) return;
    autoSpokeRef.current = true;
    if (canSpeak) setNudgeHear(true); // spotlight the ▶ pill in case autoplay is blocked
    const t = setTimeout(() => {
      onAutoSpoke?.();
      if (canSpeak && speakLine(`${greetLine}. ${dailyBriefing(V)}. ${goalLine}`, () => setSpeaking(false))) setSpeaking(true);
    }, 700);
    return () => clearTimeout(t);
  }, [autoSpeak]); // eslint-disable-line
  // ── 🎯 OWNER GOAL — monthly BOOKINGS target (separate from the revenue goal above):
  // local-first via saveState("owner_goal") (portalApi mirrors it to the cloud kv blob for
  // signed-in clients). Progress = this month's bookings from the same data Overview uses.
  const [bGoal, setBGoal] = useState(() => Math.max(0, parseInt(portalApi.loadState("owner_goal", 0), 10) || 0));
  const [bEdit, setBEdit] = useState(false);
  const [bDraft, setBDraft] = useState("");
  const bookedNow = monthBookings(V, real);
  const saveBGoal = () => {
    const g = Math.max(1, parseInt(String(bDraft).replace(/\D/g, ""), 10) || 0);
    if (!g) { setBEdit(false); return; }
    setBGoal(g); portalApi.saveState("owner_goal", g); setBEdit(false); toast(tr("Goal saved ✓"));
  };
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const bPace = Math.round((bookedNow / Math.max(1, today.getDate())) * daysInMonth);
  const bPct = bGoal ? Math.min(100, Math.round((bookedNow / bGoal) * 100)) : 0;
  // ── 📊 SECTOR BENCHMARK — static per-vertical baselines (clearly labeled estimates). ──
  const bench = sectorBaseline(V);
  return (
    <div className="space-y-5 stagger">
      {/* RECEBER — makes Stripe Connect discoverable: nags a real client to connect only when their
          Stripe truly isn't receiving yet. Silent for demo/connected. */}
      <ReceberBanner email={email} dataKey={dataKey} />
      {/* MORNING BRIEFING — yesterday's numbers + today's load, greeted by the hour, client-side */}
      <MorningBriefing V={V} real={real} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-g-word">{tr("Dashboard Overview")}</h2>
          <p className="text-xs text-g-muted">{tr("Welcome back 👋 Here's where your money is today — and the fastest way to grow it.")}</p>
        </div>
        {real && onRefresh && (
          <button onClick={onRefresh} disabled={refreshing} title={tr("Refresh data")} aria-label={tr("Refresh data")}
            className="grid place-items-center h-9 w-9 rounded-full border border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word hover:border-g-green/40 transition shrink-0 disabled:opacity-60">
            <span className={`inline-block text-sm ${refreshing ? "animate-spin" : ""}`}>↻</span>
          </button>
        )}
      </div>

      {/* TODAY'S TOP 3 — the clearest "what do I do next", pulled from the proactive radar.
          Each tile opens Gui and runs that exact action, so a non-technical owner goes from
          "what now?" to "done" in one tap. */}
      {(() => {
        const top = guiAlerts(V).slice(0, 3);
        if (!top.length) return null;
        const pt = UI_LANG === "pt", es = UI_LANG === "es";
        const txt = (a) => es && a.es ? a.es : pt && a.pt ? a.pt : a.en;
        const chip = (a) => es && a.chipEs ? a.chipEs : pt && a.chipPt ? a.chipPt : a.chipEn;
        return (
          <Card className="border-g-gold/30 bg-gradient-to-br from-g-gold/[0.08] to-transparent">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{es ? "⚡ Tus 3 movimientos de hoy" : pt ? "⚡ Seus 3 movimentos de hoje" : "⚡ Your top 3 moves today"}</span>
              <span className="text-[10px] text-g-muted hidden sm:inline">{es ? "Toca uno — Gui se encarga" : pt ? "Toque num — a Gui resolve" : "Tap one — Gui handles it"}</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-2.5">
              {top.map((a) => (
                <button key={a.key} onClick={() => window.dispatchEvent(new CustomEvent("gui:open", { detail: { cmd: a.cmd } }))}
                  className="text-left rounded-xl2 border border-white/10 bg-white/[0.03] hover:border-g-gold/40 hover:bg-white/[0.06] transition p-3.5 flex flex-col gap-2 clicky">
                  <div className="flex items-center gap-2">
                    {a.count > 0 && <span className="grid place-items-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black">{a.count}</span>}
                    <span className="text-[11px] font-black uppercase tracking-wide text-g-gold">{chip(a)}</span>
                  </div>
                  <p className="text-xs text-g-word leading-snug">{txt(a)}</p>
                </button>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* AI DAILY BRIEFING — a friendly, data-driven one-liner + where to start */}
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.05] border-g-green/25">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <GuiMark size={40} progress={pctNow / 100} celebrate={pctNow >= 100} />
            <div className="min-w-0"><div className="text-sm font-extrabold text-g-word flex items-center gap-2">{greetLine} — {tr("here's your briefing")} <span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" /></div><div className="text-xs text-g-muted mt-0.5">{dailyBriefing(V)}. {pctNow >= 100 ? `🎉 ${goalLine}` : goalLine}</div></div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canSpeak && <button onClick={hearBriefing} title={tr("Hear the briefing")} aria-label={tr("Hear the briefing")} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${speaking ? "border-[#FF8A33]/60 bg-[#FF8A33]/15 text-[#FF8A33]" : nudgeHear ? "gui-breathe border-[#FF8A33]/60 bg-[#FF8A33]/10 text-[#FF8A33]" : "border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word hover:border-[#FF8A33]/40"}`}>{speaking ? tr("⏹ Stop") : tr("▶ Hear it")}</button>}
            {ops[0] && <button onClick={() => onNav(ops[0].view)} className="btn-bright text-sm shrink-0" style={{ background: "#5f3415", color: "#F4D3B2", border: "1px solid rgba(255,138,51,.22)", boxShadow: "none" }}>{tr("I'll get you started →")}</button>}
          </div>
        </div>
      </Card>

      {/* PROFIT IMPACT — money first (the only thing the owner must see) */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-g-green/[0.12] to-g-gold/[0.06] border-g-green/30">
        <div className="absolute -top-16 -right-12 h-40 w-40 rounded-full bg-g-green/15 blur-3xl pointer-events-none animate-aurora" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{tr("Guileo profit impact")} · {tr(periodLabel)}{real && <span className="inline-flex items-center gap-1 text-[9px] font-black text-g-green normal-case"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>}</div>
            <div className="flex items-end gap-2.5 flex-wrap mt-1">
              <div className="text-4xl sm:text-5xl font-black text-g-green money-glow num tracking-tight"><Count key={period + (real ? "-live" : "") + (revMonthUsd != null ? "-m" : "")} to={real ? (period === "30 days" && realMonthUsd != null ? Math.round(realMonthUsd) : realMoney) : Math.round(V.impact.total * periodFactor)} prefix="$" /></div>
              {!real && (() => { const last = Math.round(V.impact.total / 1.18); const up = Math.round(((V.impact.total - last) / last) * 100); return <span className="inline-flex items-center gap-1 mb-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-g-green/15 text-g-green"><FaArrowTrendUp size={10} /> +{up}% {tr("vs last month")}</span>; })()}
            </div>
            {real ? (
              <div className="mt-1 text-[11px] font-bold text-g-muted">{realEvents.length} {tr("events in this period")}</div>
            ) : (
              period === "30 days" && <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-g-green"><FaArrowTrendUp size={10} /> {tr("On pace for")} ${Math.round(V.impact.total * 1.6).toLocaleString()} {tr("by month-end")}</div>
            )}
            {!real && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {V.impact.parts.map(([label, val]) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold">
                  <span className="text-g-green num">{scaleMoney(val, periodFactor)}</span><span className="text-g-muted">{tr(label)}</span>
                </span>
              ))}
            </div>
            )}
          </div>
          <a href={waLink("I'd like to review my Guileo results")} target="_blank" rel="noopener" className="btn-bright text-sm" style={{ background: "#5f3415", color: "#F4D3B2", border: "1px solid rgba(255,138,51,.22)", boxShadow: "none" }}>{tr("I'll connect you with my team →")}</a>
        </div>
      </Card>

      {/* GUI PLANT — the living identity: blooms with the real value Gui generated this month */}
      <GuiPlant monthValue={monthValue} demo={!real} />

      {/* NEEDS ATTENTION — one quiet line by default; expands only on click */}
      {V.alerts && (
        openAlerts.length ? (
          <div className="rounded-xl2 border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <button onClick={() => setAlertsOpen((o) => !o)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-white/[0.02] transition">
              <span className="h-1.5 w-1.5 rounded-full bg-g-gold shrink-0" />
              <span className="text-xs font-bold text-g-word">{openAlerts.length} {openAlerts.length === 1 ? tr("item needs your attention") : tr("items need your attention")}</span>
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
                            <button onClick={() => resolveAlert(i)} className="text-[11px] font-bold text-g-green border border-g-green/25 hover:bg-g-green/10 transition px-2.5 py-1 rounded-lg">{tr("Resolve")}</button>
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
            <span className="h-1.5 w-1.5 rounded-full bg-g-green shrink-0" /> {tr("All clear — your AI is on top of everything.")}
          </div>
        )
      )}

      {/* MONTHLY GOAL — editable target + progress + projection vs goal */}
      <Card tone="gold">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{tr("🎯 Monthly goal")}{est}</div>
          {editGoal ? (
            <div className="flex items-center gap-1.5"><span className="text-g-muted text-sm">$</span><input autoFocus value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveGoal()} aria-label={tr("Monthly revenue goal")} className="w-24 rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-sm text-g-word outline-none focus:border-g-green/70" /><button onClick={saveGoal} className="text-[11px] font-bold text-g-green hover:underline">{tr("Save")}</button></div>
          ) : (
            <button onClick={() => { setGoalDraft(goal); setEditGoal(true); }} className="text-sm font-extrabold text-g-word inline-flex items-center gap-1.5">${goal.toLocaleString()} <FaPen size={9} className="text-g-muted" /></button>
          )}
        </div>
        <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${pctNow}%`, background: "linear-gradient(90deg,#FF3D8B,#FF85B4)", boxShadow: "0 0 14px rgba(255,61,139,.55)" }} />
          {pctProj > pctNow && pctProj <= 100 && <div className="absolute inset-y-0 rounded-full bg-g-gold/30 transition-all" style={{ left: `${pctNow}%`, width: `${Math.min(100, pctProj) - pctNow}%` }} />}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-g-muted"><b className="text-g-word">${Math.round(monthMoney).toLocaleString()}</b> {tr("of")} ${goal.toLocaleString()} · <b className={pctProj >= 100 ? "text-g-green" : "text-g-gold"}>{tr("on pace for")} {pctProj}%</b></span>
          {pctProj < 100 && ops[0] && <button onClick={() => onNav(ops[0].view)} className="font-bold text-g-green hover:underline">{tr("Close the gap →")}</button>}
          {pctProj >= 100 && <span className="font-bold text-g-green">{tr("🎉 On track to beat it!")}</span>}
        </div>
      </Card>

      {/* 🎯 BOOKING GOAL + 📊 SECTOR BENCHMARK — compact retention pair */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Owner goal — a bookings target the owner sets; the sidebar plant blooms with it */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{tr("🎯 Booking goal")}{est}</div>
            {bGoal > 0 && !bEdit && (
              <button onClick={() => { setBDraft(String(bGoal)); setBEdit(true); }} className="text-sm font-extrabold text-g-word inline-flex items-center gap-1.5">{bGoal.toLocaleString()} <span className="text-[10px] font-bold text-g-muted normal-case">{tr("bookings")}</span> <FaPen size={9} className="text-g-muted" /></button>
            )}
          </div>
          {bGoal === 0 && !bEdit ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-xs text-g-muted flex-1 min-w-40">{tr("How many bookings do you want this month? Set it and watch your plant bloom toward it.")}</p>
              <button onClick={() => { setBDraft(""); setBEdit(true); }} className="rounded-full border border-g-green/35 bg-g-green/10 px-3.5 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition shrink-0">{tr("Set a goal")}</button>
            </div>
          ) : bEdit ? (
            <div className="flex items-center gap-2">
              <input autoFocus inputMode="numeric" value={bDraft} onChange={(e) => setBDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveBGoal()} placeholder="100" aria-label={tr("Monthly booking goal")} className="w-24 rounded-lg border border-white/15 bg-black/20 px-2.5 py-1.5 text-sm text-g-word outline-none focus:border-g-green/70" />
              <span className="text-[11px] text-g-muted">{tr("bookings")}</span>
              <button onClick={saveBGoal} className="text-[11px] font-bold text-g-green hover:underline">{tr("Save")}</button>
              <button onClick={() => setBEdit(false)} className="text-[11px] font-bold text-g-muted hover:text-g-word">{tr("Cancel")}</button>
            </div>
          ) : (
            <>
              <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${Math.max(2, bPct)}%`, background: bPct >= 100 ? "linear-gradient(90deg,#3E9468,#6fce9d)" : "linear-gradient(90deg,#FF8A33,#FFB06B)", boxShadow: bPct >= 100 ? "0 0 14px rgba(62,148,104,.55)" : "0 0 14px rgba(255,138,51,.45)" }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-g-muted"><b className="text-g-word num">{bookedNow.toLocaleString()}</b> {tr("of")} <b className="text-g-word num">{bGoal.toLocaleString()}</b> {tr("bookings")} · <b className={bPct >= 100 || bPace >= bGoal ? "text-g-green" : "text-g-gold"}>{tr("on pace for")} {bPace.toLocaleString()}</b></span>
                {bPct >= 100
                  ? <span className="font-bold text-g-green">{tr("🎉 Goal reached — incredible month!")}</span>
                  : <span className="text-g-muted">{tr("your goal is")} <b className="text-g-word num">{bGoal.toLocaleString()}</b></span>}
              </div>
            </>
          )}
        </Card>
        {/* Sector benchmark — you vs. CLEARLY-LABELED static sector estimates (never fake live data) */}
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{tr("📊 Your sector")}</div>
          <div className="text-[10px] text-g-muted mb-3">{tr("vs. estimated sector average — industry estimates, not live competitor data")}</div>
          <div className="space-y-2.5">
            {[
              [tr("Answer rate"), "100%", `${Math.round(bench.answerRate * 100)}%`],
              [tr("Response time"), tr("instant"), bench.respMins >= 60 ? `~${Math.round(bench.respMins / 60)} h` : `~${bench.respMins} min`],
              [tr("After-hours coverage"), "24/7", tr("voicemail")],
            ].map(([label, you, sector]) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-g-muted truncate">{label}</span>
                <span className="font-extrabold text-g-green num whitespace-nowrap">{you}</span>
                <span className="flex-1 border-t border-dashed border-white/10 mx-1" />
                <span className="text-g-muted whitespace-nowrap">{tr("sector")} {sector}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* GROWTH MOVES — "what to do today to grow", the revenue-share thesis on the home screen */}
      {ops.length > 0 && (
        <Card tone="green" className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("⚡ This week's growth moves")}</span>
            <span className="text-[10px] text-g-muted">{tr("· spotted by your AI")}</span>{est}
          </div>
          <div className="divide-y divide-white/[0.05]">
            {ops.map((o) => { const c = PLAY_COLOR[o.view] || "#2FE39A"; return (
              <button key={o.view} onClick={() => onNav(o.view)} className="group w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition">
                <span className="grid place-items-center h-9 w-9 rounded-full text-base shrink-0" style={{ background: c + "22", boxShadow: `inset 0 0 0 1px ${c}40` }}>{o.ic}</span>
                <div className="flex-1 min-w-0 text-sm text-g-word"><span className="font-extrabold">{o.n}</span> {o.text}</div>
                <span className="text-xs font-extrabold num whitespace-nowrap" style={{ color: c, textShadow: `0 0 10px ${c}66` }}>{o.value}</span>
                <span className="text-g-muted group-hover:text-g-word transition shrink-0">→</span>
              </button>
            ); })}
          </div>
        </Card>
      )}

      {/* RECENT ACTIVITY — real mode: the live event ledger straight from the backend */}
      {real && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent activity")}</span><span className="text-[10px] text-g-green font-bold inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span></div>
          {realEvents.length ? (
            <div className="divide-y divide-white/[0.05]">
              {realEvents.slice(0, 8).map((e, i) => (
                <div key={e.id || i} style={{ animationDelay: `${i * 60}ms` }} className="row-in flex items-center gap-3 px-5 py-2.5">
                  <span className="text-base shrink-0">{EVENT_ICON[e.type] || "⚡"}</span>
                  <div className="flex-1 min-w-0 text-xs text-g-word truncate">{e.summary}{e.channel ? <span className="text-g-muted"> · {e.channel}</span> : null}</div>
                  {Number(e.amount) > 0 && <span className="text-xs font-extrabold text-g-green money-glow num shrink-0">+${Number(e.amount).toLocaleString()}</span>}
                  <span className="text-[10px] text-g-muted shrink-0">{relTime(e.created_at)}</span>
                </div>
              ))}
            </div>
          ) : <p className="px-5 py-6 text-center text-xs text-g-muted">{tr("No activity in this period yet — it shows up here the moment your AI acts.")}</p>}
        </Card>
      )}

      {/* RECENT ACTIVITY — the latest things you + Gui did, across every tab (demo) */}
      {!real && (() => { const acts = recentActivity(V).filter((a) => validViews.has(a.view)); return acts.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent activity")}</span><span className="text-[10px] text-g-muted inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("live")}</span></div>
          <div className="divide-y divide-white/[0.05]">
            {acts.map((a, i) => (
              <button key={i} onClick={() => onNav(a.view)} style={{ animationDelay: `${i * 60}ms` }} className="row-in group w-full text-left flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.03] transition">
                <span className="text-base shrink-0">{a.ic}</span>
                <div className="flex-1 min-w-0 text-xs text-g-word truncate">{a.text}</div>
                <span className="text-[10px] text-g-muted shrink-0">{tr("just now")}</span>
                <span className="text-g-muted group-hover:text-g-word transition shrink-0">→</span>
              </button>
            ))}
          </div>
        </Card>
      ) : null; })()}

      {/* R4 — WEEKLY RECAP Gui writes itself */}
      <Card className="bg-gradient-to-br from-g-gold/[0.08] to-transparent border-g-gold/25">
        <div className="flex items-start gap-3">
          <GuiMark size={40} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-g-word flex items-center gap-2">{tr("Your week, by Gui")}{est}</div>
            <div className="text-xs text-g-muted mt-1 leading-relaxed">{tr("This week your AI handled")} <span className="text-g-word font-bold">{wkView.handled}</span> {tr("conversations, created")} <span className="text-g-word font-bold">{real ? wkView.created : (wk.created || vnum(V.label, "wkc", 6, 24))}</span> {tr("bookings & orders")}{wkView.driven ? <> {tr("and drove")} <span className="text-g-green font-bold">${wkView.driven.toLocaleString()}</span> {tr("in tracked revenue")}</> : ""} {tr("— saving you about")} <span className="text-g-word font-bold">{wkView.hours}h</span>. {wkView.open ? <>{tr("Next:")} <span className="text-g-word font-semibold">{wkView.open} {wkView.open !== 1 ? tr("invoices") : tr("invoice")}</span> {tr("still to collect, and")} <span className="text-g-word font-semibold">{tr(wkView.peak)}</span> {tr("looks busiest")}.</> : <>{tr("Next week")} <span className="text-g-word font-semibold">{tr(wkView.peak)}</span> {tr("looks busiest — want a promo to fill the quiet days?")}</>}</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button onClick={() => onNav("impact")} className="btn-ghost text-xs px-3 py-1.5">{tr("See the impact →")}</button>
              {wkView.open > 0 && <button onClick={() => onNav("payments")} className="btn-ghost text-xs px-3 py-1.5">{tr("Collect now →")}</button>}
            </div>
          </div>
        </div>
      </Card>

      {/* R3 — STANDING AUTOMATIONS Gui set up */}
      {automations.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("⚙️ Automations on autopilot")}</span><span className="text-[10px] text-g-muted">{automations.filter((a) => a.on).length} {tr("active")}</span></div>
          <div className="divide-y divide-white/[0.05]">
            {automations.map((a) => (
              <div key={a._id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-base shrink-0">{a.ic || "⚡"}</span>
                <div className="flex-1 min-w-0"><div className={`text-xs font-bold truncate ${a.on ? "text-g-word" : "text-g-muted line-through"}`}>{a.what}</div><div className="text-[10px] text-g-muted">{a.when}{a.lastRun ? ` ${tr("· last run")} ${new Date(a.lastRun).toLocaleDateString(UI_LANG === "pt" ? "pt-BR" : "en-US", { month: "short", day: "numeric" })}` : ` ${tr("· not run yet")}`}</div></div>
                {a.on && <button onClick={() => runAutoNow(a)} className="text-[10px] font-bold text-g-green hover:text-g-light shrink-0 whitespace-nowrap">{tr("▶ Run now")}</button>}
                <Toggle on={!!a.on} onClick={() => { toggleAutomation(V.label, a._id); setAutoTick((t) => t + 1); }} />
                <button onClick={() => { removeAutomation(V.label, a._id); setAutoTick((t) => t + 1); toast("Automation removed"); }} aria-label={tr("Remove")} className="text-g-muted hover:text-red-400 transition shrink-0"><FaTrash size={11} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className={`grid gap-4 grid-cols-2 ${!real && V.kpis.length >= 6 ? "md:grid-cols-3 xl:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {(realKpis || V.kpis).map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card>
              <div className="flex items-center justify-between">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-white/[0.06] text-xl">{k.ic}</span>
                {real
                  ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-g-green/15 text-g-green"><span className="h-1 w-1 rounded-full bg-g-green live-dot animate-pulse" />{tr("live")}</span>
                  : <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: (k.good ? "#3E9468" : k.color) + "22", color: k.good ? "#3E9468" : k.color }}>
                      {k.good ? <FaArrowTrendDown size={10} /> : <FaArrowTrendUp size={10} />} {k.note || (k.delta != null ? `+${k.delta}%` : tr("live"))}
                    </span>}
              </div>
              <div className={`mt-3 text-2xl font-extrabold num tracking-tight ${k.pre === "$" ? "text-g-green money-glow" : "text-g-word"}`}><Count to={k.num} prefix={k.pre || ""} suffix={k.suf || ""} /></div>
              <div className="text-[11px] text-g-muted">{k.label}</div>
              {(!real || realHasRevenue) && <div className="mt-2"><Spark data={real ? realSeries : V.revenue} color={k.color} h={32} /></div>}
            </Card>
          </motion.div>
        ))}
      </div>

      {/* TODAY + QUICK ACTIONS — surface ops on the home screen (fewer clicks) */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2">{tr(V.ops.scheduleTitle)} {tr("· next up")}{est}</span>
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
              <a key={q.label} href={q.href} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl2 border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-g-word hover:border-g-gold/40 hover:-translate-y-0.5 transition-all"><span>{q.ic}</span>{tr(q.label)}<span className="ml-auto text-g-gold">→</span></a>
            ) : (
              <button key={q.label} onClick={q.on} className="w-full text-left flex items-center gap-3 rounded-xl2 border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-g-word hover:border-g-gold/40 hover:-translate-y-0.5 transition-all"><span>{q.ic}</span>{tr(q.label)}<span className="ml-auto text-g-gold">→</span></button>
            ))}
          </div>
        </Card>
      </div>

      {/* Revenue + channel breakdown (or live activity) */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card tone="green" className="lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Revenue & order volume")}</div>
              {real && realHasRevenue
                ? <div className="mt-1 text-[10px] text-g-muted">{tr("Daily revenue from your real events")}</div>
                : <div className="mt-1 flex items-center gap-3 text-[10px] text-g-muted"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-g-gold" />{tr("Revenue")}</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-g-green" />{tr("Orders")}</span></div>}
            </div>
            {real && realHasRevenue
              ? <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
              : real
                ? <EstChip />
                : <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("Live sync")}</span>}
          </div>
          <Bars data={real && realHasRevenue ? realSeries : V.revenue} />
        </Card>
        {V.channelMix ? (
          <Card>
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{V.channelMix.title}{est}</div>
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
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3 flex items-center gap-2">{tr("Live activity")}{est}</div>
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
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3 flex items-center gap-2">{V.topItems.title}{est}</div>
            <div className="space-y-3">
              {V.topItems.items.map((it, i) => {
                const max = Math.max(...V.topItems.items.map((x) => x.sold));
                return (
                  <div key={i}>
                    <div className="flex justify-between items-baseline text-xs mb-1"><span className="font-bold text-g-word uppercase truncate pr-2">{it.name}</span><span className="text-g-muted whitespace-nowrap">{it.sold} sold · <span className="text-g-green font-bold num">${it.rev.toFixed(2)}</span></span></div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${(it.sold / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </Card>
          )}
          {V.channelMix && (
          <Card>
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3 flex items-center gap-2">{tr("Recent activity")}{est}</div>
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

      {/* Signature sector ops board (clinic recalls / e-com carts / realestate leads) */}
      {SECTOR_OPS[V.label] && (() => {
        const board = SECTOR_OPS[V.label];
        return (
          <Card>
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{tr(board.title)}{est}</div>
                <div className="text-[11px] text-g-muted truncate">{tr(board.sub)}</div>
              </div>
              <button onClick={() => onNav?.(board.view)} className="shrink-0 rounded-full border border-g-green/35 bg-g-green/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition">{board.chip}</button>
            </div>
            <div className="divide-y divide-white/5">
              {board.rows.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-g-word truncate">{r.a} <span className="text-g-muted font-normal">· {r.ch}</span></div>
                    <div className="text-[11px] text-g-muted truncate">{r.b}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap px-2 py-0.5 rounded-full" style={{ color: r.color, background: `${r.color}1a` }}>{r.pill}</span>
                  <span className="text-xs font-bold text-g-green num whitespace-nowrap w-20 text-right">{r.val}</span>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

export default Overview;
