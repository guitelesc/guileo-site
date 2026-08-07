/* Risk Radar tab — SUPERPOWER #3 in the cockpit. Ranks upcoming appointments by no-show
   probability (backend: /api/noshow-radar → noshow_risk RPC) and gives the owner two 1-tap
   plays per row: ✅ ask Gui for an extra confirmation, or 👻 mark the ghost (feeds the model). */
import { useState, useEffect } from "react";
import { FaTriangleExclamation, FaGhost, FaCheck } from "react-icons/fa6";
import { fetchNoshowRadar, markNoshow, toast } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton, UI_LANG, vnum } from "../pages/Portal.jsx";

// Risk badge — signal colors by meaning: ≥80 red (danger), ≥60 amber (attention), else green (safe).
function RiskBadge({ risk }) {
  const hot = risk >= 80, warm = risk >= 60;
  const color = hot ? "#EF4444" : warm ? "#FFC23D" : "#3E9468";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black num whitespace-nowrap"
      style={{ color, background: `${color}1e`, boxShadow: warm ? `0 0 12px ${color}55, inset 0 0 0 1px ${color}55` : `inset 0 0 0 1px ${color}40` }}>
      {warm && <FaTriangleExclamation size={9} />} {risk}% {tr("risk")}
    </span>
  );
}

// Demo rows — same deterministic per-sector flavor as the other tabs' sample data.
function genRiskDemo(V) {
  // Only schedule rows that read like a PERSON (some verticals' schedules are utilization
  // rows like "92% booked") — otherwise fall back to believable sample customers.
  const sch = (V.ops?.schedule || []).filter((r) => r.name && !/\d|%|booked/i.test(r.name)).slice(0, 5);
  const base = sch.length >= 3 ? sch : [{ name: "Ana R.", meta: tr("Booking"), time: "6:30 PM" }, { name: "Bruno T.", meta: tr("Booking"), time: "9:00 AM" }, { name: "Carla M.", meta: tr("Booking"), time: "11:15 AM" }, { name: "Diego P.", meta: tr("Booking"), time: "2:00 PM" }, { name: "Sofia L.", meta: tr("Booking"), time: "4:45 PM" }];
  const days = [tr("Today"), tr("Tomorrow"), tr("Tomorrow"), tr("This week"), tr("This week")];
  return base.map((r, i) => {
    const risk = [86, 71, 58, 41, 27][i] ?? vnum(V.label, `rr${i}`, 20, 90);
    const priors = risk >= 80 ? 2 : risk >= 60 ? 1 : 0;
    const lead = vnum(V.label, `rrl${i}`, 2, 16);
    return {
      appointment_id: `demo-${i}`, customer_name: r.name, service: r.meta || "", when: `${days[i % days.length]} · ${r.time}`,
      risk, prior_noshows: priors, lead_days: lead,
      reason: `${priors ? `${priors} ${tr("prior no-show(s)")} · ` : ""}${tr("booked")} ${lead}d ${tr("ahead")}`,
    };
  }).sort((a, b) => b.risk - a.risk);
}

const fmtWhen = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US";
  return d.toLocaleString(loc, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

function RiskRadar({ V, real = null, email = "", dataKey = "" }) {
  const [radar, setRadar] = useState(null);         // null = fetch in flight (real mode)
  const [done, setDone] = useState({});             // appointment_id → "confirmed" | "noshow" (optimistic)
  const [asking, setAsking] = useState(null);       // appointment_id with the inline no-show confirm open
  useEffect(() => {
    let alive = true;
    if (real && email && dataKey) fetchNoshowRadar(dataKey, email, 7).then((d) => { if (alive) setRadar(d); });
    return () => { alive = false; };
  }, [real, email, dataKey]);

  const demo = !real;
  const rows = demo ? genRiskDemo(V) : (radar?.appointments || []);
  const visible = rows.filter((r) => done[r.appointment_id] !== "noshow");
  const high = visible.filter((r) => (r.risk || 0) >= 60).length;

  const doConfirm = async (r) => {
    setDone((d) => ({ ...d, [r.appointment_id]: "confirmed" }));          // optimistic
    // Real endpoint returns { ok, sent, via } — only claim "reminded" on a true send; else "queued".
    let res = {};
    try {
      const rr = await fetch("/api/noshow-radar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: dataKey, email: email || "", action: "confirm", appointment_id: r.appointment_id }),
      });
      res = rr.ok ? await rr.json().catch(() => ({})) : {};
    } catch { res = {}; }
    if (res && res.ok) {
      toast((Number(res.sent) || 0) > 0 ? tr("Confirmed ✓ — Gui reminded them") : tr("Queued ✓ — Gui will remind them"));
    } else {
      setDone((d) => { const n = { ...d }; delete n[r.appointment_id]; return n; });
      toast(tr("I couldn't save that — check your connection and try again."));
    }
  };
  const doNoshow = async (r) => {
    setAsking(null);
    setDone((d) => ({ ...d, [r.appointment_id]: "noshow" }));             // optimistic
    const res = await markNoshow(dataKey, email, r.appointment_id);
    if (res.ok && res.marked) toast(tr("Marked as no-show ✓ — Gui learns from every one"));
    else { setDone((d) => { const n = { ...d }; delete n[r.appointment_id]; return n; }); toast(tr("I couldn't save that — check your connection and try again.")); }
  };

  // Real mode, fetch still in flight → skeleton (never a false "all clear").
  if (real && radar === null) return <SectionSkeleton rows={5} />;

  return (
    <div className="space-y-4 stagger">
      {/* Header — what this radar is + the two numbers that matter */}
      <div className="rounded-2xl border border-[#FFC23D]/25 bg-gradient-to-br from-[#FFC23D]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FFC23D" }}>
          <FaTriangleExclamation size={11} /> {tr("No-show Risk Radar")}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{visible.length} {tr("upcoming")} · <span style={{ color: high ? "#FFC23D" : "#3E9468" }}>{high} {tr("high risk")}</span></div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Gui ranks your upcoming appointments by no-show risk — confirm the risky ones before they ghost.")}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to see your real risk radar.")}
        </div>
      )}

      {/* Real mode but the RPC isn't live yet → honest warming-up state, never a fake list */}
      {real && radar && !radar.ready ? (
        <Card><Empty icon="📡" text={tr("The risk radar is warming up — it turns on as soon as your booking engine is live.")} /></Card>
      ) : visible.length === 0 ? (
        <Card><Empty icon="🌿" text={tr("No upcoming appointments at risk in the next 7 days.")} /></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Next 7 days · ranked by risk")}</span>
            <span className="text-[11px] text-g-muted hidden sm:inline">{tr("2 taps: confirm or mark the ghost")}</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {visible.map((r, i) => {
              const state = done[r.appointment_id];
              const isAsking = asking === r.appointment_id;
              return (
                <div key={r.appointment_id || i} style={{ animationDelay: `${i * 50}ms` }} className="row-in px-5 py-3">
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-base shrink-0">{(r.risk || 0) >= 60 ? "👻" : "📅"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-g-word truncate">{r.customer_name || tr("Customer")}{r.service ? <span className="text-g-muted font-normal"> · {r.service}</span> : null}</div>
                      <div className="text-[11px] text-g-muted truncate">{demo ? r.when : fmtWhen(r.starts_at)}{r.reason ? ` · ${r.reason}` : ""}</div>
                    </div>
                    <RiskBadge risk={Number(r.risk) || 0} />
                    <div className="flex items-center gap-1.5 shrink-0">
                      {state === "confirmed" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-g-green px-2.5 py-1.5"><FaCheck size={10} /> {tr("Confirmed ✓")}</span>
                      ) : (
                        <>
                          <button onClick={() => !demo && doConfirm(r)} disabled={demo} title={demo ? tr("Available when connected — sample data") : undefined}
                            className="rounded-full border border-g-green/35 bg-g-green/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap">
                            ✅ {tr("Confirm extra")}
                          </button>
                          <button onClick={() => !demo && setAsking(isAsking ? null : r.appointment_id)} disabled={demo} title={demo ? tr("Available when connected — sample data") : undefined}
                            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word hover:border-red-400/40 transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center gap-1.5">
                            <FaGhost size={10} /> {tr("No-show")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Inline no-show confirm — never window.confirm */}
                  {isAsking && (
                    <div className="mt-2.5 ml-12 flex items-center gap-2 rounded-xl2 border border-red-400/25 bg-red-500/[0.06] px-3.5 py-2">
                      <span className="text-xs font-bold text-g-word">{tr("Mark as no-show?")}</span>
                      <span className="text-[10px] text-g-muted hidden sm:inline">{tr("This trains the radar — the next prediction gets smarter.")}</span>
                      <span className="flex-1" />
                      <button onClick={() => doNoshow(r)} className="rounded-full bg-red-500/85 px-3 py-1 text-[11px] font-black text-white hover:bg-red-500 transition">{tr("Yes, mark it")}</button>
                      <button onClick={() => setAsking(null)} className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-g-muted hover:text-g-word transition">{tr("Cancel")}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export default RiskRadar;
