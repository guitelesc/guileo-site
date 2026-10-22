/* "Leads do dia" tab — today's NEW leads Gui captured across every channel, grouped by source
   (call · widget · sms · whatsapp · form), each with a 1-tap "Gui liga de volta" callback.
   Real mode: /api/crm action leads_today (crm_leads_today RPC, per-tenant gated by email+dataKey).
   Demo mode: a representative day built from the sector's sample leads (actions disabled). */
import { useState, useEffect } from "react";
import { fetchLeadsTodayDetalhado, requestGuiCallback, toast, chamarApi } from "../lib/portalApi.js";
import FalhaDeLeitura from "./FalhaDeLeitura.jsx";
import { tr, Card, Empty, SectionSkeleton, genLeads, relTime, UI_LANG } from "../pages/Portal.jsx";

// Source/channel meta — signal color by meaning (call = info blue, whatsapp = done green,
// sms = attention amber, widget/web/form = Gui orange). Normalizes the many spellings a
// backend might send (e.g. "web form", "site", "phone") onto one canonical bucket.
const SOURCES = {
  call:     { label: "Ligação",   en: "Call",     es: "Llamada",  emoji: "📞", color: "#3FB4FF" },
  whatsapp: { label: "WhatsApp",  en: "WhatsApp", es: "WhatsApp", emoji: "💬", color: "#25D366" },
  sms:      { label: "SMS",       en: "SMS",      es: "SMS",      emoji: "✉️", color: "#FFC23D" },
  widget:   { label: "Site",      en: "Widget",   es: "Widget",   emoji: "🖥️", color: "#FF8A33" },
  form:     { label: "Formulário", en: "Form",    es: "Formulario", emoji: "📝", color: "#C08A3E" },
  other:    { label: "Outro",     en: "Other",    es: "Otro",     emoji: "🎯", color: "#9AA0A6" },
};
const SRC_ORDER = ["call", "whatsapp", "sms", "widget", "form", "other"];
function normSrc(s = "") {
  const t = String(s).toLowerCase();
  if (/call|phone|voz|voice|liga|ligaç/.test(t)) return "call";
  if (/whats|wa\b/.test(t)) return "whatsapp";
  if (/sms|text|mensagem de texto/.test(t)) return "sms";
  if (/widget|site|web|chat/.test(t)) return "widget";
  if (/form|formul/.test(t)) return "form";
  return t && SOURCES[t] ? t : "other";
}
const srcName = (k) => { const s = SOURCES[k] || SOURCES.other; return UI_LANG === "es" ? s.es : UI_LANG === "pt" ? s.label : s.en; };

// The client's own working status per lead (persisted). Tap the pill to advance the stage.
const CLS = {
  novo:      { pt: "Novo",      en: "New",       es: "Nuevo",     c: "#FF8A33" },
  contatado: { pt: "Contatado", en: "Contacted", es: "Contactado", c: "#3FB4FF" },
  fechado:   { pt: "Fechado",   en: "Won",       es: "Cerrado",   c: "#3E9468" },
};
const CLS_CYCLE = ["novo", "contatado", "fechado"];
const clsLabel = (k) => { const s = CLS[k] || CLS.novo; return UI_LANG === "es" ? s.es : UI_LANG === "pt" ? s.pt : s.en; };

// Digits for tel:/wa.me from any phone spelling. "" when there's no usable number.
const digitsOf = (p) => String(p || "").replace(/[^0-9]/g, "");
// First email found on a lead row (backend spellings vary).
const emailOf = (r) => String((r && (r.email || r.contact_email || r.contact)) || "").trim();
const isEmailStr = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Status pill color by meaning — new = Gui orange, contacted/called = info, booked/won = done green.
const statusColor = (st = "") => {
  const t = String(st).toLowerCase();
  if (/book|won|clos|fech|ganho|agend/.test(t)) return "#3E9468";
  if (/call|contact|reach|liga|nudge/.test(t)) return "#3FB4FF";
  return "#FF8A33";
};

// Demo — a representative "today" built from the sector's sample leads, tagged by channel.
function genLeadsTodayDemo(V) {
  return genLeads(V).slice(0, 6).map((l, i) => ({
    id: l._id || `demo-${i}`, name: l.name, phone: ["+1 (917) 555-0142", "+1 (646) 555-0199", "+55 11 95555-0177", "+1 (305) 555-0188"][i % 4],
    channel: l.channel, source: normSrc(l.channel), status: i === 0 ? "New" : i === 1 ? "Called" : "New",
    created_at: null, ago: l.ago, service: l.service,
  }));
}

function LeadsToday({ V, onNav, real = null, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [data, setData] = useState(demo ? { ready: true } : null); // null = fetch in flight
  const [err, setErr] = useState(null);   // motivo da falha de leitura, ou null
  const [tentativa, setTentativa] = useState(0);
  const [busy, setBusy] = useState({});   // lead id → true while the callback request is inflight
  const [done, setDone] = useState({});   // lead id → true once Gui is calling back (optimistic)
  const [statusMap, setStatusMap] = useState({}); // lead id → { s: status, n: notes } (persisted)
  const [openNote, setOpenNote] = useState(null); // lead id whose note editor is open

  // Load the client's saved per-lead status (novo→contatado→fechado) so the board survives a refresh
  // / another device. Real mode only; best-effort (feature degrades to no manual status if unavailable).
  useEffect(() => {
    if (demo || !dataKey || !email) return;
    let alive = true;
    fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lead_status_map", token: dataKey, email }) })
      .then((r) => r.json()).then((d) => { if (alive && d && d.ok && d.map && typeof d.map === "object") setStatusMap(d.map); }).catch(() => {});
    return () => { alive = false; };
  }, [demo, dataKey, email]);

  // The map is { lead_id: { s: status, n: notes } }. Advance one stage (novo→contatado→fechado),
  // optimistic then CONFIRM + REVERT on failure (a 401/{ok:false} must not masquerade as saved).
  const advanceStatus = async (lead) => {
    if (demo || !lead?.id) return;
    const cur = (statusMap[lead.id] || {}).s || "novo";
    if (cur === "fechado") return; // already at the last stage
    const next = CLS_CYCLE[Math.min(CLS_CYCLE.indexOf(cur) + 1, CLS_CYCLE.length - 1)];
    setStatusMap((m) => ({ ...m, [lead.id]: { ...(m[lead.id] || {}), s: next } }));
    const revert = () => { setStatusMap((m) => ({ ...m, [lead.id]: { ...(m[lead.id] || {}), s: cur } })); toast(tr("I couldn't save that — try again.")); };
    try {
      const r = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lead_status_set", token: dataKey, email, lead_id: lead.id, status: next }) });
      const d = await r.json().catch(() => ({}));
      if (!d || !d.ok) revert();
    } catch { revert(); }
  };
  // Free-text note per lead — typed locally, flushed to the DB on blur (independent of status).
  const setNoteLocal = (id, text) => setStatusMap((m) => ({ ...m, [id]: { ...(m[id] || {}), n: text } }));
  const saveNote = (lead) => {
    if (demo || !lead?.id) return;
    const text = (statusMap[lead.id] || {}).n || "";
    // A anotação sumia calada quando a gravação falhava: a pessoa escrevia "ligar amanhã cedo",
    // saía do campo, e no dia seguinte a nota não existia. Agora a falha é dita.
    chamarApi("/api/crm", { action: "lead_note_set", token: dataKey, email, lead_id: lead.id, notes: text })
      .then((r) => { if (r.motivo || r.data?.ok === false) toast(tr("I couldn't save that — try again.")); });
  };

  useEffect(() => {
    let alive = true;
    if (demo) { setData({ ready: true }); return () => { alive = false; }; }
    setData(null); setErr(null);
    // 🚨 (2026-09-28) O ramo de erro desta tela era INALCANÇÁVEL: o leitor antigo nunca devolve
    // null nem rejeita — em qualquer falha ele devolve `{ready:false, leads:[]}`. Resultado: rede
    // caída aparecia como "Your leads feed is warming up" e o cabeçalho dizia "0 new leads today".
    // Lead perdido por achar que não veio nenhum é dinheiro que ninguém vai buscar.
    fetchLeadsTodayDetalhado(dataKey, email).then((r) => {
      if (!alive) return;
      if (r.motivo) { setErr(r.motivo); setData({ ready: false }); return; }
      setData({ ...r.data, leads: (r.data.leads || []).filter(Boolean) });
    });
    return () => { alive = false; };
  }, [demo, dataKey, email, tentativa]);

  const callback = async (lead) => {
    if (demo) { toast(tr("Sample data — connect your account to let Gui call back for real.")); return; }
    setBusy((b) => ({ ...b, [lead.id]: true }));
    setDone((d) => ({ ...d, [lead.id]: true }));                    // optimistic (só o botão)
    const res = await requestGuiCallback(dataKey, email, lead);
    setBusy((b) => { const n = { ...b }; delete n[lead.id]; return n; });
    if (!res.ok) { setDone((d) => { const n = { ...d }; delete n[lead.id]; return n; }); toast(tr("I couldn't start that call — check your connection and try again.")); return; }
    // "está ligando agora" só depois do ok do servidor — antes saía no clique, e uma falha
    // deixava a dona certa de que a ligação tinha sido feita
    toast(tr("Gui is calling them back now 📞"));
  };

  const rows = demo ? genLeadsTodayDemo(V) : (data?.leads || []);
  // Group by normalized source, preserving SRC_ORDER.
  const groups = SRC_ORDER
    .map((k) => [k, rows.filter((r) => normSrc(r.source || r.channel) === k)])
    .filter(([, list]) => list.length);

  // Real mode, fetch still in flight → skeleton (never a false "no leads today").
  if (!demo && data === null) return <SectionSkeleton rows={5} />;

  const when = (r) => (demo ? (r.ago ? `${r.ago}${UI_LANG === "pt" || UI_LANG === "es" ? " atrás" : " ago"}` : "") : (r.created_at ? relTime(r.created_at) : ""));

  return (
    <div className="space-y-4 stagger">
      {/* Header — what this is + today's count */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          📅 {tr("Leads today")}
          {!demo
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        {/* sem leitura não há contagem: "—", nunca "0 new leads today" */}
        <div className="mt-1 text-xl font-black text-g-word">{!demo && (err || (data && !data.ready)) ? "—" : rows.length} {tr(rows.length === 1 && !err ? "new lead today" : "new leads today")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Every lead Gui captured today, grouped by where it came from — tap to have Gui call them back in seconds.")}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to see your real leads of the day.")}
        </div>
      )}

      {/* Error state — the fetch failed outright (network / server). */}
      {!demo && err ? (
        <FalhaDeLeitura motivo={err} onRetry={() => setTentativa((n) => n + 1)} titulo={tr("I couldn't load today's leads just now.")} />
      ) : /* Connected but the RPC isn't live yet → honest warming-up state. */
      !demo && data && !data.ready ? (
        <Card><Empty icon="📡" text={tr("Your leads feed is warming up — it turns on as soon as your account is fully live.")} /></Card>
      ) : rows.length === 0 ? (
        <Card><Empty icon="🌿" text={tr("No new leads yet today — they'll appear here the moment Gui captures one.")} /></Card>
      ) : (
        groups.map(([k, list]) => {
          const s = SOURCES[k] || SOURCES.other;
          return (
            <div key={k}>
              <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide" style={{ color: s.color }}>
                {s.emoji} {srcName(k)} <span className="text-g-muted font-bold">· {list.length}</span>
              </div>
              <Card className="p-0 overflow-hidden">
                <div className="divide-y divide-white/[0.05]">
                  {list.map((r, i) => {
                    const isDone = done[r.id];
                    return (
                      <div key={r.id || i} style={{ animationDelay: `${i * 45}ms` }} className="row-in px-5 py-3">
                        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        <span className="grid place-items-center h-9 w-9 rounded-full shrink-0 text-base" style={{ background: s.color + "1e" }}>{s.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-g-word truncate">{r.name || tr("Lead")}{r.service ? <span className="text-g-muted font-normal"> · {r.service}</span> : null}</div>
                          <div className="text-[11px] text-g-muted truncate">{r.phone || "—"}{when(r) ? ` · ${when(r)}` : ""}</div>
                        </div>
                        {!demo ? (() => {
                          const cs = (statusMap[r.id] || {}).s || "novo"; const col = (CLS[cs] || CLS.novo).c;
                          return (
                            <button onClick={() => advanceStatus(r)} title={tr("Tap to advance: New → Contacted → Won")}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ring-1 transition hover:brightness-125 min-h-[44px] inline-flex items-center" style={{ background: col + "22", color: col, borderColor: col + "55" }}>
                              {clsLabel(cs)}
                            </button>
                          );
                        })() : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: statusColor(r.status) + "22", color: statusColor(r.status) }}>{r.status || tr("New")}</span>
                        )}
                        {/* ACT NOW — the owner works the lead themselves (call / WhatsApp / email), OR lets Gui do it.
                            Direct-contact links only in real mode (demo numbers are fake). */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {!demo && digitsOf(r.phone) && (
                            <a href={`tel:+${digitsOf(r.phone)}`} title={tr("Call now")}
                              className="rounded-full border border-g-info/35 bg-g-info/10 px-2.5 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-info/20 transition">📞</a>
                          )}
                          {!demo && digitsOf(r.phone) && (
                            <a href={`https://wa.me/${digitsOf(r.phone)}`} target="_blank" rel="noopener" title="WhatsApp"
                              className="rounded-full border border-g-green/35 bg-g-green/10 px-2.5 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition">💬</a>
                          )}
                          {!demo && isEmailStr(emailOf(r)) && (
                            <a href={`mailto:${emailOf(r)}`} title={tr("Email")}
                              className="rounded-full border border-g-gold/35 bg-g-gold/10 px-2.5 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-gold/20 transition">✉️</a>
                          )}
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-g-green px-2.5 py-1.5 whitespace-nowrap">🤖 {tr("Gui is calling back")}</span>
                          ) : (
                            <button onClick={() => callback(r)} disabled={demo || busy[r.id]} title={demo ? tr("Available when connected — sample data") : tr("Let Gui call this lead back for you")}
                              className="rounded-full border border-[#FF8A33]/40 bg-[#FF8A33]/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-[#FF8A33]/20 transition disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap">
                              {busy[r.id] ? "…" : `🤖 ${tr("Gui calls back")}`}
                            </button>
                          )}
                          {!demo && (
                            <button onClick={() => setOpenNote(openNote === r.id ? null : r.id)} title={tr("Add a note")}
                              className={`rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition ${((statusMap[r.id] || {}).n) ? "border-g-gold/40 bg-g-gold/10 text-g-word" : "border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>📝</button>
                          )}
                        </div>
                        </div>
                        {!demo && openNote === r.id && (
                          <div className="mt-2.5">
                            <textarea value={(statusMap[r.id] || {}).n || ""} onChange={(e) => setNoteLocal(r.id, e.target.value)} onBlur={() => saveNote(r)}
                              placeholder={tr("Your note on this lead…")} rows={2}
                              className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[12.5px] text-g-word placeholder:text-g-muted/50 focus:outline-none focus:border-g-green/40" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          );
        })
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-g-muted">{tr("Want every lead qualified and triaged for you?")}</div>
        <button onClick={() => onNav && onNav("leads")} className="btn-bright text-[12px] shrink-0">{tr("Open the daily digest →")}</button>
      </div>
    </div>
  );
}

export default LeadsToday;
