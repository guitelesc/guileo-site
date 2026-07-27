/* 🌀 Hurricane Mode tab — 1-click storm management for the Miami thesis. One big button:
   close the calendar for the storm window (Gui tells callers you're closed + will rebook),
   notify every booked customer, then "Reabrir agora ✅" fires ONE "we're back — rebook" blast.
   Real mode: /api/storm-mode (storm_* RPCs in db/storm_mode.sql, per-tenant gated by email+dataKey).
   Demo mode: a representative storm state built from the sector's schedule (actions disabled). */
import { useState, useEffect } from "react";
import { toast } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";

const iso = (d) => d.toISOString().slice(0, 10);
const todayIso = () => iso(new Date());
const plusDaysIso = (n) => iso(new Date(Date.now() + n * 864e5));

const fmtDay = (s) => {
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s || "";
  const loc = UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US";
  return d.toLocaleDateString(loc, { weekday: "short", month: "short", day: "numeric" });
};
const fmtWhen = (isoTs) => {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return "";
  const loc = UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US";
  return d.toLocaleString(loc, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

// Sensible default closure message — bilingual (EN for Miami + PT for the Latin WhatsApp culture).
const DEFAULT_MSG = "We will be temporarily closed for the storm — your safety comes first. We'll rebook every appointment as soon as we reopen. / Estaremos temporariamente fechados pela tempestade — sua segurança vem primeiro. Reagendamos todos os horários assim que reabrirmos.";

// Status pill color by meaning — active = live pink (something is ON), reopened = done green,
// canceled = muted.
const STATUS_META = {
  active:   { pt: "Ativa",     en: "Active",   es: "Activa",    color: "#FF4FA3" },
  reopened: { pt: "Reaberto",  en: "Reopened", es: "Reabierto", color: "#3E9468" },
  canceled: { pt: "Cancelada", en: "Canceled", es: "Cancelada", color: "#9AA0A6" },
};
const statusLabel = (st) => { const m = STATUS_META[st] || STATUS_META.canceled; return UI_LANG === "es" ? m.es : UI_LANG === "pt" ? m.pt : m.en; };

// Demo — a believable "storm passed last month" history + a quiet present (button disabled).
function genStormDemo(V) {
  const sch = (V.ops?.schedule || []).filter((r) => r.name && !/\d|%|booked/i.test(r.name)).slice(0, 3);
  const names = sch.length ? sch.map((r) => r.name) : ["Ana R.", "Bruno T.", "Carla M."];
  return {
    ready: true, active: null, affected: 0, appointments: [],
    history: [{ id: "demo-1", starts_on: plusDaysIso(-32), reopen_on: plusDaysIso(-29), status: "reopened", notified: names.length, reopen_blast_sent: true }],
    _demoNames: names,
  };
}

async function stormApi(dataKey, email, body = {}) {
  try {
    const r = await fetch("/api/storm-mode", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: dataKey, email: email || "", ...body }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function StormMode({ V, real = null, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [data, setData] = useState(demo ? genStormDemo(V) : null);   // null = fetch in flight
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ starts_on: todayIso(), reopen_on: plusDaysIso(3), message: DEFAULT_MSG });

  const load = () => {
    if (demo) { setData(genStormDemo(V)); return; }
    setErr(false);
    stormApi(dataKey, email, { action: "status" }).then((d) => {
      if (!d) { setErr(true); setData({ ready: false, active: null, affected: 0, history: [], appointments: [] }); return; }
      setData(d);
    });
  };
  useEffect(() => { setData(demo ? genStormDemo(V) : null); load(); }, [demo, dataKey, email]); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = async () => {
    if (demo) { toast(tr("Sample data — connect your account to activate storm mode for real.")); return; }
    if (!form.starts_on || !form.reopen_on || form.reopen_on <= form.starts_on) { toast(tr("Reopen date must be after the closing date.")); return; }
    setBusy(true);
    const res = await stormApi(dataKey, email, { action: "activate", starts_on: form.starts_on, reopen_on: form.reopen_on, message: form.message });
    setBusy(false);
    if (res?.ok) { toast(tr("Storm mode ON 🌀 — Gui is telling callers and notifying every booking.")); load(); }
    else if (res?.reason === "already_active") { toast(tr("Storm mode is already active — reopen it first to change the window.")); load(); }
    else toast(tr("I couldn't activate storm mode — check your connection and try again."));
  };

  const reopen = async (cancel = false) => {
    if (demo) { toast(tr("Sample data — connect your account to activate storm mode for real.")); return; }
    setBusy(true);
    const res = await stormApi(dataKey, email, { action: cancel ? "cancel" : "reopen" });
    setBusy(false);
    if (res?.ok) {
      toast(cancel ? tr("Storm mode canceled — your calendar is open again ✓") : (res.sent ? `${tr("Reopened ✅ — 'we're back' sent to")} ${res.sent}` : tr("Reopened ✅ — your calendar is open again")));
      load();
    } else toast(tr("I couldn't reopen — check your connection and try again."));
  };

  // Real mode, fetch still in flight → skeleton (never a false "no storm").
  if (!demo && data === null) return <SectionSkeleton rows={5} />;

  const active = data?.active || null;
  const appts = data?.appointments || [];
  const history = data?.history || [];

  return (
    <div className="space-y-4 stagger">
      {/* Header — what this is + the current state */}
      <div className="rounded-2xl border border-[#FF4FA3]/25 bg-gradient-to-br from-[#FF4FA3]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF4FA3" }}>
          🌀 {tr("Hurricane mode")}
          {!demo
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">
          {active ? `${tr("Closed")} ${fmtDay(active.starts_on)} → ${fmtDay(active.reopen_on)}` : tr("One tap and Gui manages the whole storm")}
        </div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Close your calendar for the storm window — Gui tells every caller you're closed, notifies every booked customer, and blasts 'we're back — rebook' the moment you reopen.")}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to arm storm mode for real.")}
        </div>
      )}

      {/* Error state — the fetch failed outright (network / server). */}
      {!demo && err ? (
        <Card><Empty icon="📡" text={tr("I couldn't load storm mode — check your connection and refresh.")} /></Card>
      ) : /* Connected but the SQL isn't pasted yet → honest warming-up state. */
      !demo && data && !data.ready ? (
        <Card><Empty icon="📡" text={tr("Storm mode is warming up — it turns on as soon as your account is fully live.")} /></Card>
      ) : active ? (
        /* ── ACTIVE STORM — window + affected appointments + the reopen button ── */
        <>
          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-black uppercase tracking-wide" style={{ color: "#FF4FA3" }}>🌀 {tr("Storm mode is ON")}</div>
                <div className="mt-1 text-sm font-bold text-g-word">{fmtDay(active.starts_on)} → {fmtDay(active.reopen_on)} <span className="text-g-muted font-normal">· {data.affected} {tr(data.affected === 1 ? "booking in the window" : "bookings in the window")} · {active.notified || 0} {tr("notified")}</span></div>
                {active.message ? <p className="mt-1 text-[11px] text-g-muted max-w-lg">{active.message}</p> : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => reopen(false)} disabled={busy}
                  className="rounded-full border border-g-green/40 bg-g-green/10 px-4 py-2 text-[12px] font-bold text-g-word hover:bg-g-green/20 transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap">
                  {busy ? "…" : `${tr("Reopen now")} ✅`}
                </button>
                <button onClick={() => reopen(true)} disabled={busy}
                  className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-g-muted hover:bg-white/[0.08] transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap">
                  {tr("False alarm")}
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-g-muted">{tr("Reopening clears the closed days and sends ONE branded 'we're back — rebook' blast to affected customers first, then your recent customers.")}</p>
          </Card>

          {/* Affected appointments inside the window */}
          {appts.length ? (
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Bookings inside the storm window")}</span>
                <span className="text-[11px] text-g-muted hidden sm:inline">{tr("Everyone here was notified — Gui rebooks them after reopening")}</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {appts.map((a, i) => (
                  <div key={a.id || i} style={{ animationDelay: `${i * 45}ms` }} className="row-in flex items-center gap-3 px-5 py-3 flex-wrap sm:flex-nowrap">
                    <span className="grid place-items-center h-9 w-9 rounded-full shrink-0 text-base bg-[#FF4FA3]/[0.12]">📅</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-g-word truncate">{a.name || tr("Customer")}{a.service ? <span className="text-g-muted font-normal"> · {a.service}</span> : null}</div>
                      <div className="text-[11px] text-g-muted truncate">{a.contact || "—"}{a.starts_at ? ` · ${fmtWhen(a.starts_at)}` : ""}</div>
                    </div>
                    {a.ref ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-white/[0.06] text-g-muted num">{a.ref}</span> : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card><Empty icon="🌿" text={tr("No bookings fall inside the storm window — the calendar is closed and Gui is telling callers.")} /></Card>
          )}
        </>
      ) : (
        /* ── NO ACTIVE STORM — the 1-button arm card (dates + message, sensible defaults) ── */
        <Card>
          <div className="text-xs font-black uppercase tracking-wide text-g-gold">{tr("Arm storm mode")}</div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold text-g-muted">{tr("Closed from")}</span>
              <input type="date" value={form.starts_on} onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-g-word outline-none focus:border-[#FF4FA3]/50" />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-g-muted">{tr("Reopen on")}</span>
              <input type="date" value={form.reopen_on} onChange={(e) => setForm((f) => ({ ...f, reopen_on: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-g-word outline-none focus:border-[#FF4FA3]/50" />
            </label>
          </div>
          <label className="block mt-3">
            <span className="text-[11px] font-bold text-g-muted">{tr("What Gui tells your customers")}</span>
            <textarea rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-g-word outline-none focus:border-[#FF4FA3]/50 resize-y" />
          </label>
          <button onClick={activate} disabled={busy || demo} title={demo ? tr("Available when connected — sample data") : undefined}
            className="mt-4 w-full rounded-2xl border border-[#FF4FA3]/40 bg-[#FF4FA3]/10 px-4 py-3.5 text-sm font-black text-g-word hover:bg-[#FF4FA3]/20 transition disabled:opacity-45 disabled:cursor-not-allowed">
            {busy ? "…" : `🌀 ${tr("Activate storm mode")}`}
          </button>
          <p className="mt-2 text-[11px] text-g-muted text-center">{tr("Closes the calendar, tells callers, and emails every booked customer — WhatsApp/SMS goes out too once your number is approved.")}</p>
        </Card>
      )}

      {/* History — past storms this business rode out */}
      {history.length ? (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-2.5 border-b border-white/10">
            <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Storm history")}</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {history.map((h, i) => {
              const m = STATUS_META[h.status] || STATUS_META.canceled;
              return (
                <div key={h.id || i} style={{ animationDelay: `${i * 45}ms` }} className="row-in flex items-center gap-3 px-5 py-3">
                  <span className="grid place-items-center h-9 w-9 rounded-full shrink-0 text-base bg-white/[0.06]">🌀</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{fmtDay(h.starts_on)} → {fmtDay(h.reopen_on)}</div>
                    <div className="text-[11px] text-g-muted truncate">{h.notified || 0} {tr("notified")}{h.reopen_blast_sent ? ` · ${tr("'we're back' blast sent")}` : ""}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: m.color + "22", color: m.color }}>{statusLabel(h.status)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export default StormMode;
