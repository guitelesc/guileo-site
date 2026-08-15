/* "Datas & Aniversários" tab — the client configures Gui's proactive greetings:
   • Birthday messages (toggle on/off + edit the message Gui sends on a customer's birthday).
   • Annual commemorative dates (Dia das Mães, Namorados, Natal, Black Friday…) — add / edit /
     remove: label, month/day, message, optional offer, active.
   Real mode: /api/crm actions marketing_dates / marketing_date_set / marketing_date_delete
   (marketing_dates_list/set/delete RPCs, per-tenant gated by email+dataKey). The birthday config
   is the single row with kind:'birthday'. Demo mode: representative presets, actions disabled. */
import { useState, useEffect } from "react";
import { fetchMarketingDates, saveMarketingDate, deleteMarketingDate, toast } from "../lib/portalApi.js";
import { tr, Card, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  pt: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
};
const monthName = (m) => (MONTHS[UI_LANG] || MONTHS.en)[Math.max(0, Math.min(11, (parseInt(m, 10) || 1) - 1))];
const fmtMD = (m, d) => `${monthName(m)} ${parseInt(d, 10) || 1}`;

const DEFAULT_BDAY = {
  en: "Happy birthday, {name}! 🎉 From all of us — enjoy a little treat on your next visit.",
  pt: "Feliz aniversário, {name}! 🎉 De todos nós — aproveite um mimo na sua próxima visita.",
  es: "¡Feliz cumpleaños, {name}! 🎉 De parte de todos — disfruta un detalle en tu próxima visita.",
};

// Demo presets — a representative set of commemorative dates + a sample birthday config.
function demoDates() {
  const L = UI_LANG;
  const bd = DEFAULT_BDAY[L] || DEFAULT_BDAY.en;
  return [
    { id: "bday", kind: "birthday", label: "Birthday", month: null, day: null, message: bd, offer: "", active: true },
    { id: "d1", kind: "date", label: L === "pt" ? "Dia das Mães" : L === "es" ? "Día de la Madre" : "Mother's Day", month: 5, day: 11, message: L === "pt" ? "Feliz Dia das Mães! 💐 Reserve já a sua mesa." : "Happy Mother's Day! 💐 Book your table today.", offer: "-10%", active: true },
    { id: "d2", kind: "date", label: L === "pt" ? "Dia dos Namorados" : L === "es" ? "San Valentín" : "Valentine's Day", month: 2, day: 14, message: L === "pt" ? "Feliz Dia dos Namorados! ❤️ Faça uma surpresa." : "Happy Valentine's! ❤️ Make it special.", offer: "", active: true },
    { id: "d3", kind: "date", label: "Black Friday", month: 11, day: 28, message: L === "pt" ? "Black Friday chegou! 🖤 Ofertas só hoje." : "Black Friday is here! 🖤 Deals today only.", offer: "-25%", active: false },
    { id: "d4", kind: "date", label: "Natal", month: 12, day: 25, message: L === "pt" ? "Feliz Natal! 🎄 Obrigado por estar com a gente." : "Merry Christmas! 🎄 Thank you for being with us.", offer: "", active: true },
  ];
}

const emptyForm = { id: null, label: "", month: 1, day: 1, message: "", offer: "", active: true };

function MarketingDates({ V, onNav, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [rows, setRows] = useState(demo ? demoDates() : null); // null = loading (real mode)
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [bday, setBday] = useState({ active: true, message: DEFAULT_BDAY[UI_LANG] || DEFAULT_BDAY.en });

  const hydrate = (list) => {
    const b = list.find((r) => r.kind === "birthday");
    if (b) setBday({ active: b.active !== false, message: b.message || DEFAULT_BDAY[UI_LANG] || DEFAULT_BDAY.en });
    setRows(list);
  };

  const load = async () => {
    const d = await fetchMarketingDates(dataKey, email);
    setReady(d.ready !== false);
    hydrate(Array.isArray(d.dates) ? d.dates : []);
  };
  useEffect(() => {
    let alive = true;
    if (demo) { hydrate(demoDates()); return () => { alive = false; }; }
    setRows(null);
    fetchMarketingDates(dataKey, email).then((d) => { if (!alive) return; setReady(d.ready !== false); hydrate(Array.isArray(d.dates) ? d.dates : []); });
    return () => { alive = false; };
  }, [demo, dataKey, email]); // eslint-disable-line react-hooks/exhaustive-deps

  const dateRows = (rows || []).filter((r) => r.kind !== "birthday");

  // ── Birthday config (the kind:'birthday' row) ──
  const saveBirthday = async () => {
    if (demo) { toast(tr("Sample data — connect your account to save.")); return; }
    setBusy(true);
    const res = await saveMarketingDate(dataKey, email, { kind: "birthday", label: "Birthday", active: bday.active, message: bday.message });
    setBusy(false);
    if (res.ready === false) { setReady(false); toast(res.note || tr("Couldn't save — try again.")); return; }
    if (res.ok) { toast(tr("Saved ✓")); load(); } else toast(tr("Couldn't save — try again."));
  };
  // O interruptor decide se a Gui manda mensagem de aniversário para os clientes do cliente.
  // Antes, quando o servidor recusava, ele apenas mostrava um toast e FICAVA na posição nova:
  // a tela dizia "desligado" com o motor ainda ligado (ou o contrário). Um estado que o
  // servidor não aceitou tem que voltar ao que era — senão a tela vira a única fonte de uma
  // verdade que não existe. Corrigido 2026-08-11.
  const toggleBirthday = async (next) => {
    const prev = bday.active;
    setBday((b) => ({ ...b, active: next }));
    if (demo) { toast(tr("Sample data — connect your account to save.")); setBday((b) => ({ ...b, active: prev })); return; }
    const res = await saveMarketingDate(dataKey, email, { kind: "birthday", label: "Birthday", active: next, message: bday.message });
    if (res.ready === false || !res.ok) {
      setBday((b) => ({ ...b, active: prev }));          // volta: nada foi gravado
      if (res.ready === false) setReady(false);
      toast(res.note || tr("Couldn't save — try again."));
    }
  };

  // ── Commemorative dates (add / edit / remove) ──
  const editRow = (r) => setForm({ id: r.id, label: r.label || "", month: r.month || 1, day: r.day || 1, message: r.message || "", offer: r.offer || "", active: r.active !== false });
  const resetForm = () => setForm(emptyForm);
  const saveDate = async () => {
    if (demo) { toast(tr("Sample data — connect your account to save.")); return; }
    if (!form.label.trim()) { toast(tr("Give the date a name first")); return; }
    setBusy(true);
    const res = await saveMarketingDate(dataKey, email, { id: form.id || undefined, kind: "date", label: form.label.trim(), month: parseInt(form.month, 10) || 1, day: parseInt(form.day, 10) || 1, message: form.message.trim(), offer: form.offer.trim(), active: form.active });
    setBusy(false);
    if (res.ready === false) { setReady(false); toast(res.note || tr("Couldn't save — try again.")); return; }
    if (res.ok) { toast(tr("Saved ✓")); resetForm(); load(); } else toast(tr("Couldn't save — try again."));
  };
  const toggleDate = async (r, next) => {
    setRows((cur) => (cur || []).map((x) => (x.id === r.id ? { ...x, active: next } : x)));
    if (demo) { setRows((cur) => (cur || []).map((x) => (x.id === r.id ? { ...x, active: r.active } : x))); toast(tr("Sample data — connect your account to save.")); return; }
    const res = await saveMarketingDate(dataKey, email, { id: r.id, kind: "date", label: r.label, month: r.month, day: r.day, message: r.message, offer: r.offer, active: next });
    if (res.ready === false) { setReady(false); toast(res.note || tr("Couldn't save — try again.")); }
    else if (!res.ok) { toast(tr("Couldn't save — try again.")); load(); }
  };
  const removeDate = async (r) => {
    if (demo) { toast(tr("Sample data — connect your account to edit.")); return; }
    setBusy(true);
    const res = await deleteMarketingDate(dataKey, email, r.id);
    setBusy(false);
    if (res.ok) { toast(tr("Removed ✓")); if (form.id === r.id) resetForm(); load(); } else toast(tr("Couldn't save — try again."));
  };

  if (!demo && rows === null) return <SectionSkeleton rows={5} />;

  return (
    <div className="space-y-4 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          🎂 {tr("Dates & birthdays")}
          {!demo
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Gui greets your customers on the days that matter")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Turn on birthday messages and add your commemorative dates — Gui sends a warm, on-brand message (and any offer) automatically.")}</p>
      </div>

      {!demo && !ready && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Almost there — one activation step is pending on our side. Your dates will be saved as soon as it's live.")}
        </div>
      )}
      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to save your real dates.")}
        </div>
      )}

      {/* 🎂 Birthday config */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2.5">
          <span className="text-lg">🎂</span>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-g-word">{tr("Birthday messages")}</div>
            <div className="text-[11px] text-g-muted">{tr("Gui wishes each customer a happy birthday automatically. Use {name} to insert their name.")}</div>
          </div>
          <button onClick={() => toggleBirthday(!bday.active)}
            className={`relative h-6 w-11 rounded-full transition shrink-0 ${bday.active ? "bg-g-green/80" : "bg-white/15"}`} aria-pressed={bday.active} aria-label={tr("Birthday messages")}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${bday.active ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <textarea value={bday.message} onChange={(e) => setBday((b) => ({ ...b, message: e.target.value }))} rows={3} maxLength={320}
            disabled={!bday.active}
            placeholder={DEFAULT_BDAY[UI_LANG] || DEFAULT_BDAY.en}
            className="w-full bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none placeholder:text-g-muted focus:border-g-green/40 disabled:opacity-50" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-g-muted">{bday.message.length}/320</span>
            <button onClick={saveBirthday} disabled={busy} className="btn-bright text-xs">{busy ? "…" : tr("Save message")}</button>
          </div>
        </div>
      </Card>

      {/* 📅 Commemorative dates */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2.5">
          <span className="text-lg">📅</span>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-g-word">{tr("Commemorative dates")}</div>
            <div className="text-[11px] text-g-muted">{tr("Mother's Day, Valentine's, Christmas, Black Friday… Gui reaches out on each one.")}</div>
          </div>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {dateRows.length === 0 && (
            <div className="px-5 py-4 text-xs text-g-muted">{tr("No dates yet — add your first commemorative date below.")}</div>
          )}
          {dateRows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-xs font-bold text-g-light w-20 shrink-0 num">{fmtMD(r.month, r.day)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{r.label}
                  {r.offer ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-g-green/15 text-g-green shrink-0">{r.offer}</span> : null}</div>
                <div className="text-[11px] text-g-muted truncate">{r.message || "—"}</div>
              </div>
              <button onClick={() => toggleDate(r, !(r.active !== false))}
                className={`relative h-5 w-9 rounded-full transition shrink-0 ${r.active !== false ? "bg-g-green/80" : "bg-white/15"}`} aria-pressed={r.active !== false} aria-label={tr("Active")}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${r.active !== false ? "left-[18px]" : "left-0.5"}`} />
              </button>
              <button onClick={() => editRow(r)} className="btn-ghost text-xs shrink-0">{tr("Edit")}</button>
              <button onClick={() => removeDate(r)} disabled={busy} className="btn-ghost text-xs shrink-0">{tr("Remove")}</button>
            </div>
          ))}
        </div>
        {/* Add / edit form */}
        <div className="px-5 py-4 border-t border-white/10 space-y-2.5">
          <div className="text-[10px] font-black uppercase tracking-wide text-g-muted">{form.id ? tr("Edit date") : tr("Add a date")}</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <input type="text" value={form.label} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder={tr("Name (e.g. Mother's Day)")} className="flex-1 min-w-[150px] bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none placeholder:text-g-muted" />
            <select value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
              className="bg-white/[0.05] border border-white/15 rounded-lg px-2 py-2 text-xs text-g-word outline-none">
              {MONTHS.en.map((_, i) => <option key={i} value={i + 1}>{monthName(i + 1)}</option>)}
            </select>
            <input type="number" min={1} max={31} value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
              className="w-16 bg-white/[0.05] border border-white/15 rounded-lg px-2 py-2 text-xs text-g-word outline-none" />
            <input type="text" value={form.offer} maxLength={24} onChange={(e) => setForm((f) => ({ ...f, offer: e.target.value }))}
              placeholder={tr("Offer (optional)")} className="w-32 bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none placeholder:text-g-muted" />
          </div>
          <textarea value={form.message} rows={2} maxLength={320} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder={tr("Message Gui sends (use {name} for the customer's name)")}
            className="w-full bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none placeholder:text-g-muted" />
          <div className="flex items-center justify-end gap-2">
            {form.id && <button onClick={resetForm} className="btn-ghost text-xs">{tr("Cancel")}</button>}
            <button onClick={saveDate} disabled={busy} className="btn-bright text-xs">{busy ? "…" : form.id ? tr("Save date") : tr("Add date")}</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default MarketingDates;
