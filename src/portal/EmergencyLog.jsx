/* Emergency Log tab — the owner FINALLY sees the after-hours urgencies that were blind before.
   When a caller has a real emergency ("no AC", "burst pipe", "flood"), agent-action.js claims it and
   RINGS the owner's phone; this tab is the history of every one, with a 1-tap "✅ I called back".
   Backend: /api/emergency → emergency_list / emergency_mark_called (db/emergency_dispatch.sql).
   Attention color = amber #FFC23D (the system's "attention" signal), with a live pulse on pending rows. */
import { useState, useEffect } from "react";
import { FaTriangleExclamation, FaPhoneVolume, FaCheck } from "react-icons/fa6";
import { tr, Card, Empty, SectionSkeleton, UI_LANG, vnum } from "../pages/Portal.jsx";

const AMBER = "#FFC23D";

// Direct fetch — no portalApi import (self-contained, same gate contract as noshow-radar).
async function fetchEmergencies(key, email) {
  if (!key) return { ready: false, pending: 0, emergencies: [] };
  try {
    const r = await fetch("/api/emergency", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: key, email: email || "" }),
    });
    if (!r.ok) return { ready: false, pending: 0, emergencies: [] };
    const d = await r.json();
    return { ready: !!d?.ready, pending: Number(d?.pending) || 0, emergencies: Array.isArray(d?.emergencies) ? d.emergencies : [] };
  } catch { return { ready: false, pending: 0, emergencies: [] }; }
}
async function markCalled(key, email, id) {
  if (!key || !id) return { ok: false, called: false };
  try {
    const r = await fetch("/api/emergency", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: key, email: email || "", action: "mark_called", id }),
    });
    if (!r.ok) return { ok: false, called: false };
    const d = await r.json();
    return { ok: !!d?.ok, called: !!d?.called };
  } catch { return { ok: false, called: false }; }
}

const fmtWhen = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US";
  return d.toLocaleString(loc, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

// Demo rows — believable after-hours emergencies so the tab is never a blank in sample mode.
function genEmergencyDemo(V) {
  const seed = V?.label || "demo";
  const notes = [tr("No AC — it's 92° inside with a newborn"), tr("Burst pipe flooding the kitchen"), tr("Water heater died, no hot water")];
  const names = ["Ana R.", "Marcus D.", "Priya S."];
  const now = Date.now();
  return notes.map((note, i) => ({
    id: `demo-${i}`, name: names[i], contact: `+1 (305) 555-0${vnum(seed, `em${i}`, 100, 199)}`,
    note, called_owner: i === 2,
    created_at: new Date(now - vnum(seed, `emt${i}`, 1, 40) * 3600 * 1000).toISOString(),
  }));
}

function EmergencyLog({ V, real = null, email = "", dataKey = "" }) {
  const [state, setState] = useState(null);   // null = fetch in flight (real mode)
  const [called, setCalled] = useState({});   // id → true (optimistic)
  const [busy, setBusy] = useState({});        // id → true while the call-back mark is in flight

  useEffect(() => {
    let alive = true;
    if (real && email && dataKey) fetchEmergencies(dataKey, email).then((d) => { if (alive) setState(d); });
    else if (real) setState({ ready: false, emergencies: [] });   // no key yet → honest "warming up", never an eternal skeleton
    return () => { alive = false; };
  }, [real, email, dataKey]);

  const demo = !real;
  const rows = demo ? genEmergencyDemo(V) : (state?.emergencies || []);
  const pending = rows.filter((r) => !r.called_owner && !called[r.id]).length;

  const doCalled = async (r) => {
    if (demo || busy[r.id]) return;
    setBusy((b) => ({ ...b, [r.id]: true }));
    setCalled((c) => ({ ...c, [r.id]: true }));   // optimistic
    const res = await markCalled(dataKey, email, r.id);
    setBusy((b) => { const n = { ...b }; delete n[r.id]; return n; });
    if (!(res.ok && res.called)) setCalled((c) => { const n = { ...c }; delete n[r.id]; return n; });   // revert on failure
  };

  // Real mode, fetch still in flight → skeleton (never a false "no emergencies").
  if (real && state === null) return <SectionSkeleton rows={4} />;

  return (
    <div className="space-y-4 stagger">
      {/* Header — what this log is + the number that matters (still-open callbacks) */}
      <div className="rounded-2xl border p-5" style={{ borderColor: `${AMBER}40`, background: `linear-gradient(to bottom right, ${AMBER}12, rgba(255,255,255,0.02))` }}>
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: AMBER }}>
          <FaTriangleExclamation size={11} /> {tr("Emergency Dispatch")}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">
          {rows.length} {tr("emergencies")} · <span style={{ color: pending ? AMBER : "#3E9468" }}>{pending} {tr("awaiting callback")}</span>
        </div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("When a caller has a real emergency, Gui rings your phone on the spot. Every one lands here so nothing slips through the night.")}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border px-4 py-2.5 text-[11px] font-bold" style={{ borderColor: `${AMBER}4d`, background: `${AMBER}12`, color: AMBER }}>
          {tr("Sample data — connect your account to see your real emergencies.")}
        </div>
      )}

      {/* Real mode but the log RPC isn't live yet → honest warming-up state, never a fake list */}
      {real && state && !state.ready ? (
        <Card><Empty icon="📡" text={tr("The emergency log is warming up — it turns on the moment Gui is answering your calls.")} /></Card>
      ) : rows.length === 0 ? (
        <Card><Empty icon="🛟" text={tr("No emergencies — Gui rings your phone on the spot if one comes in.")} /></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: AMBER }}>{tr("Last 50 · newest first")}</span>
            <span className="text-[11px] text-g-muted hidden sm:inline">{tr("Amber pulse = still needs your callback")}</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {rows.map((r, i) => {
              const done = r.called_owner || called[r.id];
              return (
                <div key={r.id || i} style={{ animationDelay: `${i * 50}ms` }} className="row-in px-5 py-3">
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    {/* Icon — amber pulse while still pending, calm green check once handled */}
                    <span className="grid place-items-center h-9 w-9 rounded-full shrink-0"
                      style={done
                        ? { background: "rgba(62,148,104,0.14)" }
                        : { background: `${AMBER}22`, boxShadow: `0 0 0 1px ${AMBER}55`, animation: "pulse 1.6s ease-in-out infinite" }}>
                      {done ? <FaCheck size={13} color="#3E9468" /> : <FaPhoneVolume size={13} color={AMBER} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-g-word truncate">
                        {r.name || tr("Caller")}
                        {r.contact ? <span className="text-g-muted font-normal"> · {r.contact}</span> : null}
                      </div>
                      <div className="text-[12px] text-g-word/85 truncate">{r.note || tr("Emergency call")}</div>
                      <div className="text-[11px] text-g-muted truncate">{fmtWhen(r.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-g-green px-2.5 py-1.5"><FaCheck size={10} /> {tr("Called back ✓")}</span>
                      ) : (
                        <button onClick={() => doCalled(r)} disabled={demo || busy[r.id]}
                          title={demo ? tr("Available when connected — sample data") : undefined}
                          className="rounded-full px-3 py-1.5 text-[11px] font-bold text-g-word transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                          style={{ border: `1px solid ${AMBER}59`, background: `${AMBER}1a` }}>
                          ✅ {tr("I called back")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export default EmergencyLog;
