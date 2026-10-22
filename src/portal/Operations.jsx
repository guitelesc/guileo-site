/* Operations tab — Company-OS "run-the-day" board.
   REAL mode (real + email + dataKey): live jobs from /api/operations (biz_appointments spine),
   with status + on-time signal + one-tap advance. Falls back to the demo view otherwise. */
import { useEffect, useState } from "react";
import { loadDataKey, toast, chamarApi } from "../lib/portalApi.js";
import { Card, Bars, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";
import FalhaDeLeitura, { fraseDaFalha } from "./FalhaDeLeitura.jsx";

// signal palette (cimento locked): done green / late-overdue pink-alert / in-progress orange / upcoming muted
const OK = "#3E9468", ALERT = "#e0855f", GUI = "#FF8A33", INFO = "#5B9BD5", MUTE = "#948C7B";
const STR = {
  en: { naoLigado: "The operations board isn't switched on for your account yet. Message our team and we'll turn it on.", falhou: "I couldn't load today's board just now.", naoSalvou: "Couldn't save — try again.", cliente: "Customer", estoque: "Inventory", repor: "to restock", emFalta: "out of stock (86)", reservado: "reserved", reporEm: "restock at", semEstoque: "OUT OF STOCK", reporBtn: "RESTOCK", un: "units", st_booked: "booked", st_in_progress: "in progress", st_completed: "done", st_done: "done", st_fulfilled: "done", st_no_show: "no-show", st_cancelled: "cancelled", st_canceled: "cancelled",
    title: "Operations — today's board", live: "LIVE", est: "sample", total: "Jobs", upcoming: "Upcoming", inprog: "In progress", done: "Done", overdue: "Overdue", noshow: "No-shows",
    empty: "No jobs in the window — enjoy the calm. New bookings appear here live.", start: "Start", finish: "Done", noshowBtn: "No-show", late: "late", now: "now", coming: "upcoming", window: "Today → +2 days" },
  pt: { naoLigado: "O painel de operações ainda não está ligado para a sua conta. Fale com a nossa equipe e a gente liga.", falhou: "Não consegui carregar o painel de hoje agora.", naoSalvou: "Não consegui salvar — tente de novo.", cliente: "Cliente", estoque: "Estoque", repor: "p/ repor", emFalta: "em falta (86)", reservado: "reservado", reporEm: "repor em", semEstoque: "EM FALTA", reporBtn: "REPOR", un: "un", st_booked: "agendado", st_in_progress: "em andamento", st_completed: "feito", st_done: "feito", st_fulfilled: "feito", st_no_show: "faltou", st_cancelled: "cancelado", st_canceled: "cancelado",
    title: "Operações — o painel do dia", live: "AO VIVO", est: "exemplo", total: "Serviços", upcoming: "A chegar", inprog: "Em andamento", done: "Feitos", overdue: "Atrasados", noshow: "Faltas",
    empty: "Sem serviços na janela — aproveite a calma. Novas reservas aparecem aqui ao vivo.", start: "Iniciar", finish: "Concluir", noshowBtn: "Faltou", late: "atrasado", now: "agora", coming: "a chegar", window: "Hoje → +2 dias" },
  es: { naoLigado: "El tablero de operaciones aún no está activado para tu cuenta. Escríbele a nuestro equipo y lo activamos.", falhou: "No pude cargar el tablero de hoy ahora.", naoSalvou: "No pude guardar — inténtalo de nuevo.", cliente: "Cliente", estoque: "Inventario", repor: "por reponer", emFalta: "agotados (86)", reservado: "reservado", reporEm: "reponer en", semEstoque: "AGOTADO", reporBtn: "REPONER", un: "uds", st_booked: "reservado", st_in_progress: "en curso", st_completed: "hecho", st_done: "hecho", st_fulfilled: "hecho", st_no_show: "ausente", st_cancelled: "cancelado", st_canceled: "cancelado",
    title: "Operaciones — el tablero del día", live: "EN VIVO", est: "ejemplo", total: "Servicios", upcoming: "Próximos", inprog: "En curso", done: "Hechos", overdue: "Atrasados", noshow: "Ausencias",
    empty: "Sin servicios en la ventana — disfruta la calma. Las nuevas reservas aparecen aquí en vivo.", start: "Iniciar", finish: "Completar", noshowBtn: "Ausente", late: "atrasado", now: "ahora", coming: "próximo", window: "Hoy → +2 días" },
  // hi faltava: o 4º idioma da UI caía em inglês nesta tela enquanto o resto do painel falava hindi.
  hi: { naoLigado: "संचालन बोर्ड अभी आपके खाते के लिए चालू नहीं है। हमारी टीम को संदेश भेजें, हम चालू कर देंगे।", falhou: "मैं अभी आज का बोर्ड लोड नहीं कर सका।", naoSalvou: "सेव नहीं हो सका — फिर कोशिश करें।", cliente: "ग्राहक", estoque: "स्टॉक", repor: "फिर भरने हैं", emFalta: "स्टॉक खत्म (86)", reservado: "आरक्षित", reporEm: "इस पर फिर भरें", semEstoque: "स्टॉक खत्म", reporBtn: "फिर भरें", un: "इकाई", st_booked: "बुक", st_in_progress: "चल रहा", st_completed: "पूरा", st_done: "पूरा", st_fulfilled: "पूरा", st_no_show: "नो-शो", st_cancelled: "रद्द", st_canceled: "रद्द",
    title: "संचालन — आज का बोर्ड", live: "लाइव", est: "नमूना", total: "काम", upcoming: "आने वाले", inprog: "चल रहे", done: "पूरे", overdue: "देरी से", noshow: "नो-शो",
    empty: "इस अवधि में कोई काम नहीं — शांति का आनंद लें। नई बुकिंग यहाँ लाइव दिखती हैं।", start: "शुरू करें", finish: "पूरा", noshowBtn: "नो-शो", late: "देरी", now: "अभी", coming: "आने वाला", window: "आज → +2 दिन" },
};
const T = (k) => (STR[UI_LANG] || STR.en)[k] || STR.en[k] || k;
// status cru do banco ("in_progress", "no_show") nunca vai pra tela: vira a palavra do idioma.
const statusLabel = (st) => { const k = `st_${String(st || "").toLowerCase()}`; return (STR[UI_LANG] || STR.en)[k] || STR.en[k] || String(st || "").replace(/_/g, " "); };

const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es" : UI_LANG === "hi" ? "hi-IN" : "en", { weekday: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
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

  const [falha, setFalha] = useState(null);   // motivo da falha de LEITURA do painel
  // 🚨 (2026-09-28) Falha virava `{ready:false}` e a tela mostrava cinco ZEROS (Jobs 0 · Upcoming 0
  // · In progress 0 · Done 0 · Overdue 0) e "Ops board not ready." — em inglês fixo, para qualquer
  // idioma. E sem chave de conexão o `useEffect` nem chamava nada: esqueleto para sempre.
  const load = async () => {
    if (!email || !dk) { setFalha("sem_credencial"); setData({ ready: false }); return; }
    const r = await chamarApi("/api/operations", { email, dataKey: dk, lang: UI_LANG });
    if (r.motivo) { setFalha(r.motivo); setData({ ready: false }); return; }
    setFalha(null); setData(r.data);
  };
  // Inventory/86 feed — separate SCHED-gated read; silent no-op for tenants who don't track stock.
  const loadInv = async () => {
    if (!email || !dk) return;
    const r = await chamarApi("/api/operations", { action: "inventory", email, dataKey: dk, lang: UI_LANG });
    setInv(r.motivo ? { ready: false } : r.data);
  };
  const tentarDeNovo = () => { setData(null); setFalha(null); load(); loadInv(); };
  useEffect(() => { load(); loadInv(); /* eslint-disable-next-line */ }, [email, dk]);

  if (data === null) return <SectionSkeleton rows={5} />;
  if (falha) return <FalhaDeLeitura motivo={falha} onRetry={tentarDeNovo} titulo={T("falhou")} />;
  const ready = !!data.ready;
  const s = data.stats || {};
  const jobs = (Array.isArray(data.jobs) ? data.jobs : []).filter(Boolean);
  // motor não ligado = não há contagem: "—", nunca cinco zeros
  const n = (v) => (ready ? (v || 0) : "—");

  const setStatus = async (job, status) => {
    setBusy((x) => ({ ...x, [job.id]: true }));
    // optimistic: update the row's status locally
    setData((d) => ({ ...d, jobs: (Array.isArray(d.jobs) ? d.jobs : []).map((j) => (j && j.id === job.id ? { ...j, status } : j)) }));
    const r = await chamarApi("/api/operations", { action: "set_status", id: job.id, status, email, dataKey: dk });
    // o aviso era português fixo ("Não consegui salvar") para cliente em qualquer idioma
    if (r.motivo || !r.data?.ok) { toast(`${T("naoSalvou")}${r.motivo ? ` ${fraseDaFalha(r.motivo)}` : ""}`); load(); }
    else toast("✓");
    setBusy((x) => ({ ...x, [job.id]: false }));
  };

  return (
    <div className="space-y-4 stagger">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: GUI }}>
        {T("title")}
        <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{T("live")}</span>
        <span className="text-g-muted normal-case font-normal text-[10px]">· {T("window")}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label={T("total")} value={n(s.total)} />
        <Stat label={T("upcoming")} value={n(s.upcoming)} tone={INFO} />
        <Stat label={T("inprog")} value={n(s.in_progress)} tone={GUI} />
        <Stat label={T("done")} value={n(s.done)} tone={OK} />
        <Stat label={T("overdue")} value={n(s.overdue)} tone={(s.overdue || 0) > 0 ? ALERT : MUTE} />
      </div>

      <Card className="p-0 overflow-hidden">
        {!ready ? (
          /* a nota do servidor é instrução de engenharia ("Paste db/operations.sql…") — fica fora da tela */
          <div className="px-5 py-6 text-sm text-g-muted">{T("naoLigado")}</div>
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
                    <div className="text-sm font-bold text-g-word truncate">{j.customer || T("cliente")}</div>
                    <div className="text-[11px] text-g-muted truncate">{j.service}{j.source ? ` · ${j.source}` : ""}{late ? ` · ⚠ ${T("late")}` : j.on_time === null ? ` · ${T("coming")}` : ""}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: col + "22", color: col }}>{statusLabel(j.status)}</span>
                  {!done && (
                    <div className="flex gap-1 shrink-0">
                      {j.status !== "in_progress" && <button disabled={busy[j.id]} onClick={() => setStatus(j, "in_progress")} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 min-h-[44px] inline-flex items-center" style={{ color: GUI }}>▶ {T("start")}</button>}
                      <button disabled={busy[j.id]} onClick={() => setStatus(j, "completed")} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 min-h-[44px] inline-flex items-center" style={{ color: OK }}>✓ {T("finish")}</button>
                      <button disabled={busy[j.id]} onClick={() => setStatus(j, "no_show")} className="text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 min-h-[44px] inline-flex items-center" style={{ color: ALERT }}>{T("noshowBtn")}</button>
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
            <span className="text-[11px] font-black uppercase tracking-wider text-g-word">{T("estoque")}</span>
            {inv.low_count > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "#FFC23D22", color: "#FFC23D" }}>{inv.low_count} {T("repor")}</span>}
            {Array.isArray(inv.eighty_six) && inv.eighty_six.length > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "#e0855f22", color: "#e0855f" }}>{inv.eighty_six.length} {T("emFalta")}</span>}
          </div>
          <div className="divide-y divide-white/[0.06]">
            {inv.items.filter(Boolean).map((it) => {
              const tone = it.is_86 ? "#e0855f" : it.low_stock ? "#FFC23D" : "#8a8578";
              return (
                <div key={it.id || it.sku} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: tone }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{it.name || it.sku}</div>
                    <div className="text-[11px] text-g-muted truncate">{it.on_hand} {it.unit || T("un")}{it.reserved > 0 ? ` · ${it.reserved} ${T("reservado")}` : ""} · {T("reporEm")} {it.reorder_point}</div>
                  </div>
                  {it.is_86 ? <span className="text-[10px] font-black px-2 py-1 rounded-full whitespace-nowrap" style={{ background: "#e0855f22", color: "#e0855f" }}>{T("semEstoque")}</span>
                    : it.low_stock ? <span className="text-[10px] font-black px-2 py-1 rounded-full whitespace-nowrap" style={{ background: "#FFC23D22", color: "#FFC23D" }}>{T("reporBtn")} {it.reorder_qty || ""}</span>
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
  if (real && email) return <RealOps key={`${email}|${dataKey}`} email={email} dataKey={dataKey} />;
  return <DemoOps V={V} />;
}

export default Operations;
