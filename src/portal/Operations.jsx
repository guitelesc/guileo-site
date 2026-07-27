/* Operations tab — Company-OS "run-the-day" board.
   REAL mode (real + email + dataKey): live jobs from /api/operations (biz_appointments spine),
   with status + on-time signal + one-tap advance. Falls back to the demo view otherwise. */
import { useEffect, useState } from "react";
import { loadDataKey, toast } from "../lib/portalApi.js";
import { Card, Bars, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";

// signal palette (cimento locked): done green / late-overdue pink-alert / in-progress orange / upcoming muted
const OK = "#3E9468", ALERT = "#e0855f", GUI = "#FF8A33", INFO = "#5B9BD5", MUTE = "#948C7B";
const STR = {
  en: { title: "Operations — today's board", live: "LIVE", est: "sample", total: "Jobs", upcoming: "Upcoming", inprog: "In progress", done: "Done", overdue: "Overdue", noshow: "No-shows",
    empty: "No jobs in the window — enjoy the calm. New bookings appear here live.", start: "Start", finish: "Done", noshowBtn: "No-show", late: "late", now: "now", coming: "upcoming", window: "Today → +2 days" },
  pt: { title: "Operações — o painel do dia", live: "AO VIVO", est: "exemplo", total: "Serviços", upcoming: "A chegar", inprog: "Em andamento", done: "Feitos", overdue: "Atrasados", noshow: "Faltas",
    empty: "Sem serviços na janela — aproveite a calma. Novas reservas aparecem aqui ao vivo.", start: "Iniciar", finish: "Concluir", noshowBtn: "Faltou", late: "atrasado", now: "agora", coming: "a chegar", window: "Hoje → +2 dias" },
  es: { title: "Operaciones — el tablero del día", live: "EN VIVO", est: "ejemplo", total: "Servicios", upcoming: "Próximos", inprog: "En curso", done: "Hechos", overdue: "Atrasados", noshow: "Ausencias",
    empty: "Sin servicios en la ventana — disfruta la calma. Las nuevas reservas aparecen aquí en vivo.", start: "Iniciar", finish: "Completar", noshowBtn: "Ausente", late: "atrasado", now: "ahora", coming: "próximo", window: "Hoy → +2 días" },
};
const T = (k) => (STR[UI_LANG] || STR.en)[k] || STR.en[k] || k;

const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es" : "en", { weekday: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const STATUS_COLOR = { completed: OK, done: OK, fulfilled: OK, in_progress: GUI, no_show: ALERT, booked: INFO };

function Stat({ label, value, tone }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wide text-g-muted">{label}</div>
      <div className="text-2xl font-extrabold mt-1" style={{ color: tone || "var(--g-word, #EAE6DE)" }}>{value}</div>
    </Card>
  );
}

// ── REAL board ───────────────────────────────────────────────────────────────
function RealOps({ email, dataKey }) {
  const dk = dataKey || loadDataKey();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState({});
  const [inv, setInv] = useState(null);

  const load = () => fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, dataKey: dk }) })
    .then((r) => (r.ok ? r.json() : null)).then((j) => setData(j || { ready: false })).catch(() => setData({ ready: false }));
  // Inventory/86 feed — separate SCHED-gated read; silent no-op for tenants who don't track stock.
  const loadInv = () => fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "inventory", email, dataKey: dk }) })
    .then((r) => (r.ok ? r.json() : null)).then((j) => setInv(j || { ready: false })).catch(() => setInv({ ready: false }));
  useEffect(() => { if (email && dk) { load(); loadInv(); } /* eslint-disable-next-line */ }, [email, dk]);

  if (data === null) return <SectionSkeleton rows={5} />;
  const ready = !!data.ready;
  const s = data.stats || {};
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];

  const setStatus = async (job, status) => {
    setBusy((x) => ({ ...x, [job.id]: true }));
    // optimistic: update the row's status locally
    setData((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === job.id ? { ...j, status } : j)) }));
    try {
      const r = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_status", id: job.id, status, email, dataKey: dk }) });
      const j = r.ok ? await r.json() : null;
      if (!j || !j.ok) { toast("Não consegui salvar — tente de novo."); load(); }
      else { toast("✓"); }
    } catch { toast("Não consegui salvar — tente de novo."); load(); }
    finally { setBusy((x) => ({ ...x, [job.id]: false })); }
  };

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: GUI }}>
        {T("title")}
        <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{T("live")}</span>
        <span className="text-g-muted normal-case font-normal text-[10px]">· {T("window")}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label={T("total")} value={s.total || 0} />
        <Stat label={T("upcoming")} value={s.upcoming || 0} tone={INFO} />
        <Stat label={T("inprog")} value={s.in_progress || 0} tone={GUI} />
        <Stat label={T("done")} value={s.done || 0} tone={OK} />
        <Stat label={T("overdue")} value={s.overdue || 0} tone={(s.overdue || 0) > 0 ? ALERT : MUTE} />
      </div>

      <Card className="p-0 overflow-hidden">
        {!ready ? (
          <div className="px-5 py-6 text-sm text-g-muted">{data.note || "Ops board not ready."}</div>
        ) : jobs.length === 0 ? (
          <div className="px-5 py-8 text-sm text-g-muted text-center">🌤️ {T("empty")}</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {jobs.map((j) => {
              const col = STATUS_COLOR[j.status] || INFO;
              const late = j.on_time === false;
              const done = ["completed", "done", "fulfilled"].includes(j.status);
              return (
                <div key={j.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[11px] font-bold w-24 shrink-0 truncate" style={{ color: late ? ALERT : "#C9C3B8" }} title={fmtTime(j.start_at)}>{fmtTime(j.start_at)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{j.customer || "Cliente"}</div>
                    <div className="text-[11px] text-g-muted truncate">{j.service}{j.source ? ` · ${j.source}` : ""}{late ? ` · ⚠ ${T("late")}` : j.on_time === null ? ` · ${T("coming")}` : ""}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: col + "22", color: col }}>{j.status}</span>
                  {!done && (
                    <div className="flex gap-1 shrink-0">
                      {j.status !== "in_progress" && <button disabled={busy[j.id]} onClick={() => setStatus(j, "in_progress")} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50" style={{ color: GUI }}>▶ {T("start")}</button>}
                      <button disabled={busy[j.id]} onClick={() => setStatus(j, "completed")} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50" style={{ color: OK }}>✓ {T("finish")}</button>
                      <button disabled={busy[j.id]} onClick={() => setStatus(j, "no_show")} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50" style={{ color: ALERT }}>{T("noshowBtn")}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── INVENTORY / 86 — only shown for tenants who actually track stock (ready + items) ── */}
      {inv && inv.ready && Array.isArray(inv.items) && inv.items.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
            <span className="text-[11px] font-black uppercase tracking-wider text-g-word">Estoque</span>
            {inv.low_count > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "#FFC23D22", color: "#FFC23D" }}>{inv.low_count} p/ repor</span>}
            {Array.isArray(inv.eighty_six) && inv.eighty_six.length > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "#e0855f22", color: "#e0855f" }}>{inv.eighty_six.length} em falta (86)</span>}
          </div>
          <div className="divide-y divide-white/[0.06]">
            {inv.items.map((it) => {
              const tone = it.is_86 ? "#e0855f" : it.low_stock ? "#FFC23D" : "#8a8578";
              return (
                <div key={it.id || it.sku} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: tone }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{it.name || it.sku}</div>
                    <div className="text-[11px] text-g-muted truncate">{it.on_hand} {it.unit || "un"}{it.reserved > 0 ? ` · ${it.reserved} reservado` : ""} · repor em {it.reorder_point}</div>
                  </div>
                  {it.is_86 ? <span className="text-[10px] font-black px-2 py-1 rounded-full whitespace-nowrap" style={{ background: "#e0855f22", color: "#e0855f" }}>EM FALTA</span>
                    : it.low_stock ? <span className="text-[10px] font-black px-2 py-1 rounded-full whitespace-nowrap" style={{ background: "#FFC23D22", color: "#FFC23D" }}>REPOR {it.reorder_qty || ""}</span>
                    : <span className="text-[10px] font-bold text-g-muted whitespace-nowrap">ok</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── DEMO board (unchanged sample view) ─────────────────────────────────────────
function DemoOps({ V }) {
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

function Operations({ V, real = null, email = "", dataKey = "" }) {
  if (real && email) return <RealOps email={email} dataKey={dataKey} />;
  return <DemoOps V={V} />;
}

export default Operations;
