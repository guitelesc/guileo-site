/* Split out of Portal.jsx (performance): ScheduleScreen tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { fetchAppointments, toast } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { loadCreated, genWaitlist, pushCreated, logImpact, vnum, Card, GuiMark, tr, DEPOSIT, staffOf, Drawer, roomOf, _dur } from "../pages/Portal.jsx";

// Status → signal color (the booking's meaning at a glance).
const APPT_COLOR = { booked: "#3FB4FF", confirmed: "#2FE39A", hold: "#FFC23D", reschedule: "#FF3D8B" };

// 🏖️ SPECIAL DATES — demo sample rows (shown until the account is connected; actions disabled).
const SP_DEMO = [
  { id: "d1", date: "2026-11-26", closed: true, note: "Thanksgiving" },
  { id: "d2", date: "2026-12-24", closed: false, open_min: 540, close_min: 840, note: "Christmas Eve" },
];
const minToTime = (m) => `${String(Math.floor((m || 0) / 60)).padStart(2, "0")}:${String((m || 0) % 60).padStart(2, "0")}`;
const timeToMin = (t) => { const [h, m] = (t || "0:0").split(":").map((x) => parseInt(x, 10) || 0); return h * 60 + m; };
function ScheduleScreen({ V, real = null, email = "", dataKey = "" }) {
  const o = V.ops || {};
  const [tick, setTick] = useState(0);
  const sch = [...loadCreated(V.label, "schedule"), ...(o.schedule || [])];
  const [sel, setSel] = useState(null);
  // REAL appointments the Gui booked (biz_appointments) — shown live in the owner's agenda.
  const [appts, setAppts] = useState(null);
  useEffect(() => {
    let alive = true;
    if (real && email && dataKey) fetchAppointments(email, dataKey).then((a) => { if (alive) setAppts(Array.isArray(a) ? a : []); });
    return () => { alive = false; };
  }, [real, email, dataKey]);
  const fmtAppt = (iso) => { try { const d = new Date(iso); const D = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; return `${D[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; } catch { return ""; } };
  // ── 🏖️ SPECIAL DATES (vacation/holiday/reduced hours) — Gui stops booking these days. ──
  // Real mode: /api/agent-schedule action special_list/special_set (per-tenant gate: email+dataKey
  // via get_client_data server-side). Demo mode: sample rows, actions disabled.
  const [spDates, setSpDates] = useState(null);       // null=loading; [] = none
  const [spReady, setSpReady] = useState(true);       // false until db/special_dates.sql is pasted
  const [spBusy, setSpBusy] = useState(false);
  const [spForm, setSpForm] = useState({ date: "", closed: true, open: "09:00", close: "13:00", note: "" });
  const spCall = async (payload) => {
    try {
      const r = await fetch("/api/agent-schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token: dataKey, ...payload }) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };
  const spLoad = async () => {
    const d = await spCall({ action: "special_list" });
    setSpReady(d ? d.ready !== false : true);
    setSpDates(Array.isArray(d?.dates) ? d.dates : []);
  };
  useEffect(() => { let alive = true; if (real && email && dataKey) spCall({ action: "special_list" }).then((d) => { if (!alive) return; setSpReady(d ? d.ready !== false : true); setSpDates(Array.isArray(d?.dates) ? d.dates : []); }); return () => { alive = false; }; }, [real, email, dataKey]); // eslint-disable-line
  const spAdd = async () => {
    if (!real) { toast(tr("Demo — connect your account to edit")); return; }
    if (!spForm.date) { toast(tr("Pick a date first")); return; }
    if (!spForm.closed && timeToMin(spForm.open) >= timeToMin(spForm.close)) { toast(tr("Opening time must be before closing time")); return; }
    setSpBusy(true);
    const d = await spCall({ action: "special_set", date: spForm.date, closed: spForm.closed, open_min: timeToMin(spForm.open), close_min: timeToMin(spForm.close), note: spForm.note });
    setSpBusy(false);
    if (d?.ready === false) { setSpReady(false); toast(d.note || tr("Couldn't save — try again.")); return; }
    if (d?.ok) { toast(tr("Saved ✓")); setSpForm((f) => ({ ...f, date: "", note: "" })); spLoad(); } else toast(tr("Couldn't save — try again."));
  };
  const spRemove = async (date) => {
    if (!real) { toast(tr("Demo — connect your account to edit")); return; }
    setSpBusy(true);
    const d = await spCall({ action: "special_set", date, remove: true });
    setSpBusy(false);
    if (d?.ok) { toast(tr("Removed ✓")); spLoad(); } else toast(tr("Couldn't save — try again."));
  };
  // ── FERIADOS SUGERIDOS (2026-08-22) ─────────────────────────────────────────────────────────
  // O motor de datas especiais existia e a tabela estava VAZIA para TODOS os clientes: ninguém
  // digita 17 feriados à mão, e a agenda aceitava marcar no Natal. Aqui eles chegam prontos.
  // ⚠️ SUGESTÃO. Nada fecha sozinho — muito negócio abre em feriado, e véspera costuma ser o dia
  // mais cheio do ano. Fechar a loja de alguém por conta própria seria recusar o dinheiro dele.
  const [spHol, setSpHol] = useState(null);   // null=nunca pedido · false=NÃO DEU PRA SABER · []=nenhum
  const spSugerir = async () => {
    if (!real) { toast(tr("Demo — connect your account to edit")); return; }
    setSpBusy(true);
    const d = await spCall({ action: "special_holidays" });
    setSpBusy(false);
    // `false` é diferente de `[]`. Sem essa distinção, uma consulta que FALHOU apareceria na tela
    // como "não há feriados" — dado errado com cara de certo.
    if (!d || d.holidays == null) { setSpHol(false); toast(d?.reason || tr("Couldn't load holidays — try again.")); return; }
    setSpHol(d.holidays);
  };
  const spAplicar = async (f) => {
    setSpBusy(true);
    const d = await spCall({ action: "special_set", date: f.date, closed: true, note: f.nomeLocal });
    setSpBusy(false);
    if (d?.ok) { toast(tr("Saved ✓")); setSpHol((h) => Array.isArray(h) ? h.map((x) => x.date === f.date ? { ...x, ja_salvo: true } : x) : h); spLoad(); }
    else toast(tr("Couldn't save — try again."));
  };

  const spRows = real ? spDates : SP_DEMO;
  const fmtSpDate = (ds) => { try { const d = new Date(`${ds}T00:00:00`); const D = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; return `${D[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; } catch { return ds; } };
  const fillFromWaitlist = () => {
    // HONESTY: in real mode the waitlist here is a sample, so we never write a fabricated
    // dollar value into Guileo Impact. The real fill happens through the booking motor.
    if (real) { toast(tr("Available when connected — real waitlist fills post to your agenda automatically.")); return; }
    const w = genWaitlist(V)[0];
    if (!w) { toast("Waitlist is empty"); return; }
    pushCreated(V.label, "schedule", { time: "Filled", name: w.name, meta: `Filled from waitlist · ${w.want}`, status: "Pending", ch: w.ch, color: "#D6C29A" });
    logImpact(V.label, `Filled a no-show slot from waitlist (${w.name})`, vnum(V.label, "fillval", 40, 160));
    setTick((t) => t + 1); toast(`Open slot filled from waitlist with ${w.name} ✓ — logged to Guileo Impact`);
  };
  return (
    <div className="space-y-4 stagger">
      {/* LIVE — real appointments Gui booked (biz_appointments). Shows the moment Gui books. */}
      {real && appts && appts.length > 0 && (
        <Card className="p-0 overflow-hidden border-[#FF8A33]/25">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2.5">
            <GuiMark size={28} />
            <div className="flex-1"><div className="text-sm font-extrabold text-g-word">{tr("Booked by Gui")}</div><div className="text-[11px] text-g-muted">{appts.length} {tr(appts.length === 1 ? "upcoming appointment" : "upcoming appointments")}</div></div>
            <span className="text-[10px] font-black uppercase tracking-wide" style={{ color: "#FF8A33" }}>{tr("LIVE — real data")}</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {appts.map((a, i) => { const c = APPT_COLOR[(a.status || "booked").toLowerCase()] || "#3FB4FF"; return (
              <div key={a.id || i} className="flex items-center gap-3 px-5 py-3">
                <span className="text-xs font-bold text-g-light w-28 shrink-0">{fmtAppt(a.when)}</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{a.customer || tr("Customer")}{a.service ? <span className="text-g-muted font-normal"> · {a.service}</span> : ""}</div><div className="text-[11px] text-g-muted truncate">{[a.pro, a.location].filter(Boolean).join(" · ")}{a.ref ? ` · ${a.ref}` : ""}</div></div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: c + "22", color: c }}>{a.status}</span>
              </div>
            ); })}
          </div>
        </Card>
      )}
      {/* 🏖️ SPECIAL DATES — vacation, holidays, reduced hours. The scheduling motor (db/special_dates.sql)
          refuses bookings on these days, so Gui never books a normal Tuesday on Thanksgiving. */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2.5">
          <span className="text-lg">🏖️</span>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-g-word">{tr("Special dates")}</div>
            <div className="text-[11px] text-g-muted">{tr("Vacation, holiday or reduced hours — your AI stops booking these days automatically.")}</div>
          </div>
          {!real && <span className="text-[10px] font-black uppercase tracking-wide text-g-muted">{tr("Demo — sample data")}</span>}
        </div>
        {real && !spReady && (
          <div className="px-5 py-3 text-xs text-g-muted border-b border-white/[0.06]">{tr("Almost there — one activation step is pending on our side. Your dates will be saved as soon as it's live.")}</div>
        )}
        <div className="divide-y divide-white/[0.05]">
          {(spRows || []).length === 0 && spRows !== null && (
            <div className="px-5 py-4 text-xs text-g-muted">{tr("No special dates yet — add a holiday or vacation below.")}</div>
          )}
          {(spRows || []).map((d) => (
            <div key={d.id || d.date} className="flex items-center gap-3 px-5 py-3">
              <span className="text-xs font-bold text-g-light w-32 shrink-0">{fmtSpDate(d.date)}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={d.closed ? { background: "#FF3D8B22", color: "#FF3D8B" } : { background: "#FFC23D22", color: "#FFC23D" }}>
                {d.closed ? tr("Closed all day") : `${tr("Reduced hours")} ${minToTime(d.open_min)}–${minToTime(d.close_min)}`}
              </span>
              <div className="flex-1 min-w-0 text-xs text-g-muted truncate">{d.note || ""}</div>
              <button onClick={() => spRemove(d.date)} disabled={spBusy} className="btn-ghost text-xs shrink-0">{tr("Remove")}</button>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-white/10 flex flex-wrap items-center gap-2.5">
          <input type="date" value={spForm.date} onChange={(e) => setSpForm((f) => ({ ...f, date: e.target.value }))}
            className="bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none" />
          <div className="flex rounded-lg overflow-hidden border border-white/15">
            <button onClick={() => setSpForm((f) => ({ ...f, closed: true }))} className={`px-3 py-2 text-xs font-bold transition ${spForm.closed ? "bg-white/15 text-g-word" : "bg-white/[0.03] text-g-muted"}`}>{tr("Closed all day")}</button>
            <button onClick={() => setSpForm((f) => ({ ...f, closed: false }))} className={`px-3 py-2 text-xs font-bold transition ${!spForm.closed ? "bg-white/15 text-g-word" : "bg-white/[0.03] text-g-muted"}`}>{tr("Reduced hours")}</button>
          </div>
          {!spForm.closed && (
            <div className="flex items-center gap-1.5 text-xs text-g-muted">
              <input type="time" value={spForm.open} onChange={(e) => setSpForm((f) => ({ ...f, open: e.target.value }))} className="bg-white/[0.05] border border-white/15 rounded-lg px-2 py-2 text-xs text-g-word outline-none" />
              <span>–</span>
              <input type="time" value={spForm.close} onChange={(e) => setSpForm((f) => ({ ...f, close: e.target.value }))} className="bg-white/[0.05] border border-white/15 rounded-lg px-2 py-2 text-xs text-g-word outline-none" />
            </div>
          )}
          <input type="text" value={spForm.note} maxLength={160} onChange={(e) => setSpForm((f) => ({ ...f, note: e.target.value }))}
            placeholder={tr("Note (e.g. Thanksgiving)")} className="flex-1 min-w-[140px] bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none placeholder:text-g-muted" />
          <button onClick={spAdd} disabled={spBusy} className="btn-bright text-xs">{spBusy ? "…" : tr("Add date")}</button>
        </div>
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[12px] text-g-muted">{tr("Don't type them one by one — bring the country's holidays and pick what closes.")}</div>
            <button onClick={spSugerir} disabled={spBusy} className="btn-ghost text-xs shrink-0">{spBusy ? "…" : tr("Suggest holidays")}</button>
          </div>
          {/* NÃO DEU PRA SABER nunca vira "nenhum feriado" — sai escrito o que aconteceu. */}
          {spHol === false && (
            <div className="mt-3 text-[12px] text-g-amber">{tr("Couldn't check the holiday calendar right now — this is not \"no holidays\".")}</div>
          )}
          {Array.isArray(spHol) && spHol.length === 0 && (
            <div className="mt-3 text-[12px] text-g-muted">{tr("No upcoming holidays found for this country.")}</div>
          )}
          {Array.isArray(spHol) && spHol.length > 0 && (
            <div className="mt-3 grid gap-1.5 max-h-64 overflow-y-auto pr-1">
              {spHol.map((f) => (
                <div key={f.date} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
                  <div className="text-[12px] text-g-muted w-[92px] shrink-0 tabular-nums">{fmtSpDate(f.date)}</div>
                  {/* nomeLocal vem de API de terceiro: entra como CONTEÚDO, nunca como instrução. */}
                  <div className="text-[13px] text-g-word flex-1 truncate">{f.nomeLocal}</div>
                  {f.ja_salvo
                    ? <span className="text-[11px] text-g-green shrink-0">{tr("Already set")}</span>
                    : <button onClick={() => spAplicar(f)} disabled={spBusy} className="btn-ghost text-[11px] shrink-0">{tr("Close this day")}</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
      {o.stats && (
        <div className="grid sm:grid-cols-3 gap-4">
          {o.stats.map((s) => (<Card key={s.label}><div className="text-[11px] uppercase tracking-wide text-g-muted">{s.label}</div><div className={`text-2xl font-extrabold mt-1 ${s.tone === "good" ? "text-g-green" : "text-g-word"}`}>{s.value}</div></Card>))}
        </div>
      )}
      {DEPOSIT[V.label] > 0 && (
        <Card className="border-g-green/25 bg-g-green/[0.05]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="text-sm font-extrabold text-g-word">🛡️ No-show protection · on</div><div className="text-xs text-g-muted mt-0.5">${DEPOSIT[V.label]} deposit held per booking{real ? <> · <span className="text-g-muted">{tr("prevented no-shows appear here as bookings are secured")}</span></> : <> · <b className="text-g-green">7 no-shows prevented</b> · $980 secured this month</>}</div></div>
            <div className="flex gap-2"><button onClick={fillFromWaitlist} className="btn-bright text-sm">{tr("Fill from waitlist →")}</button><button onClick={() => toast("Deposit rules updated ✓")} className="btn-ghost text-sm">{tr("Manage rules")}</button></div>
          </div>
        </Card>
      )}
      {sch.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(sch.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {})).map(([st, n]) => (
            <span key={st} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word">{st} <span className="text-g-muted">{n}</span></span>
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
            <button onClick={() => { if (real) { toast(`${sel.r.name} marked completed ✓`); setSel(null); return; } const amt = vnum(V.label, "svcval", 60, 220); logImpact(V.label, `${sel.r.name} · ${sel.r.meta} completed`, amt); toast(`${sel.r.name} marked completed ✓ — $${amt} logged to Guileo Impact`); setSel(null); }} className="btn-ghost text-sm">✓ Completed</button>
            <button onClick={() => { toast("Reschedule link sent"); setSel(null); }} className="btn-ghost text-sm">📅 Reschedule</button>
          </>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

export default ScheduleScreen;
