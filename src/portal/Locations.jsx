/* Split out of Portal.jsx (performance): Locations tab view — code moved verbatim.
   2026-07 multi-location: REAL mode now manages the tenant's actual biz_locations
   (add / edit / deactivate) via /api/agent-schedule actions loc_list / loc_set —
   same per-tenant gate (email + connection key) as special dates. Demo keeps samples. */
import { useState, useEffect } from "react";
import { FaLocationDot, FaPlus } from "react-icons/fa6";
import { toast, chamarApi } from "../lib/portalApi.js";
import FalhaDeLeitura, { fraseDaFalha } from "./FalhaDeLeitura.jsx";
import { waLink } from "../data/contact.js";
import { loadCreated, genLocations, pushCreated, Card, tr, MiniStats, Drawer } from "../pages/Portal.jsx";

// Common business timezones for the picker (value = IANA name the motor speaks).
const TZ_OPTS = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Sao_Paulo", "America/Mexico_City", "Europe/Lisbon",
  "Europe/Madrid", "Asia/Kolkata",
];
const EMPTY_FORM = { id: "", name: "", address: "", city: "", phone: "", tz: "America/New_York" };

// ── REAL mode — the tenant's actual units (biz_locations), managed from the cockpit. ──
function RealLocations({ email, dataKey }) {
  const [locs, setLocs] = useState(null);     // null=loading; [] = none
  const [ready, setReady] = useState(true);   // false until db/multi_location.sql is pasted
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);     // null = form closed; {…} = add/edit form open
  const [falha, setFalha] = useState(null);   // motivo da falha de LEITURA
  // 🚨 (2026-09-28) `call` devolvia `null` em falha e o `load` lia null como "pronto, zero
  // unidades": a dona de um spa com duas unidades via "No locations yet — add your first branch"
  // e 0 agendamentos hoje. Pior, o convite era para CADASTRAR DE NOVO o que já existe.
  const call = (payload) => chamarApi("/api/agent-schedule", { email, token: dataKey, ...payload });
  const aplicar = (r) => {
    if (r.motivo) { setFalha(r.motivo); setLocs([]); return; }
    const d = r.data;
    setFalha(null);
    setReady(d.ready !== false);
    if (Array.isArray(d.locations)) setLocs(d.locations.filter(Boolean));
    else if (d.ready === false) setLocs([]);
    else { setFalha("resposta_estranha"); setLocs([]); }
  };
  const load = async () => { setLocs(null); aplicar(await call({ action: "loc_list" })); };
  useEffect(() => { let alive = true; setLocs(null); call({ action: "loc_list" }).then((r) => { if (alive) aplicar(r); }); return () => { alive = false; }; }, [email, dataKey]); // eslint-disable-line
  const save = async () => {
    if (!form.id && !form.name.trim()) { toast(tr("Give the location a name first")); return; }
    setBusy(true);
    const r = await call({ action: "loc_set", id: form.id || undefined, name: form.name, address: form.address, city: form.city, phone: form.phone, tz: form.tz });
    setBusy(false);
    if (r.motivo) { toast(`${tr("Couldn't save — try again.")} ${fraseDaFalha(r.motivo)}`); return; }
    const d = r.data;
    // a nota do servidor aqui é instrução de engenharia ("Paste db/…sql") — não vai pra tela
    if (d?.ready === false) { setReady(false); toast(tr("Almost there — one activation step is pending on our side. Your locations will be saved as soon as it's live.")); return; }
    if (d?.ok) { toast(tr("Saved ✓ — your AI covers this location too")); setForm(null); load(); }
    else toast(d?.reason === "bad_tz" ? tr("That timezone isn't valid") : tr("Couldn't save — try again."));
  };
  const setActive = async (l, active) => {
    setBusy(true);
    const r = await call({ action: "loc_set", id: l.id, active });
    setBusy(false);
    const d = r.data;
    if (r.motivo) toast(`${tr("Couldn't save — try again.")} ${fraseDaFalha(r.motivo)}`);
    else if (d?.ok) { toast(active ? tr("Location reactivated ✓") : tr("Location deactivated ✓")); load(); }
    else toast(d?.reason === "last_location" ? tr("You need at least one active location") : tr("Couldn't save — try again."));
  };
  const act = (locs || []).filter((l) => l.active);
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaLocationDot className="text-g-green" /> {tr("Locations")}</div><div className="text-xs text-g-muted mt-0.5">{tr("One AI, every branch — calls, bookings and orders routed to the right location automatically.")}</div></div>
          <button onClick={() => setForm({ ...EMPTY_FORM })} className="btn-bright text-sm inline-flex items-center gap-2"><FaPlus size={11} /> {tr("Add location")}</button>
        </div>
      </Card>
      {falha && <FalhaDeLeitura motivo={falha} onRetry={load} titulo={tr("I couldn't load your locations just now.")} />}
      {locs === null && <Card><div className="h-20 rounded-xl2 bg-white/[0.03] animate-pulse" /></Card>}
      {!ready && !falha && (
        <Card><div className="text-xs text-g-muted">{tr("Almost there — one activation step is pending on our side. Your locations will be saved as soon as it's live.")}</div></Card>
      )}
      {/* sem leitura os três números viram "—": zero unidades é uma afirmação, e eu não li */}
      <MiniStats items={(falha || locs === null)
        ? [[tr("Locations"), "—"], [tr("Booked today"), "—"], [tr("Upcoming"), "—"]]
        : [[tr("Locations"), `${act.length}`], [tr("Booked today"), `${act.reduce((s, l) => s + (l.today || 0), 0)}`, "good"], [tr("Upcoming"), `${act.reduce((s, l) => s + (l.upcoming || 0), 0)}`, "good"]]} />
      {form && (
        <Card className="border-g-gold/30">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{form.id ? tr("Edit location") : tr("New location")}</div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <input type="text" value={form.name} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={tr("Name (e.g. Downtown)")} className="bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none placeholder:text-g-muted" />
            <input type="text" value={form.address} maxLength={160} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder={tr("Address")} className="bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none placeholder:text-g-muted" />
            <input type="text" value={form.city} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder={tr("City")} className="bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none placeholder:text-g-muted" />
            <input type="text" value={form.phone} maxLength={40} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder={tr("Phone (optional)")} className="bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none placeholder:text-g-muted" />
            <select value={form.tz} onChange={(e) => setForm((f) => ({ ...f, tz: e.target.value }))} className="bg-white/[0.05] border border-white/15 rounded-lg px-3 py-2 text-xs text-g-word outline-none sm:col-span-2">
              {[...new Set([form.tz, ...TZ_OPTS])].filter(Boolean).map((z) => <option key={z} value={z} className="bg-[#161512]">{z}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={busy} className="btn-bright text-sm">{busy ? "…" : tr("Save location")}</button>
            <button onClick={() => setForm(null)} className="btn-ghost text-sm">{tr("Cancel")}</button>
          </div>
        </Card>
      )}
      {locs !== null && locs.length === 0 && ready && !falha && (
        <Card><div className="text-xs text-g-muted">{tr("No locations yet — add your first branch above and your AI starts covering it.")}</div></Card>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {(locs || []).map((l) => (
          <Card key={l.id} className={l.active ? "hover:border-g-gold/30 transition" : "opacity-60"}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="text-sm font-bold text-g-word truncate">{l.name}</div><div className="text-[11px] text-g-muted truncate">{[l.address, l.city].filter(Boolean).join(" · ") || tr("No address yet")}</div></div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: (l.active ? "#3E9468" : "#8A8578") + "22", color: l.active ? "#3E9468" : "#8A8578" }}>{l.active ? tr("Live") : tr("Inactive")}</span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <span className="font-extrabold text-g-word">{l.today || 0}<span className="text-g-muted font-normal"> {tr("today")}</span></span>
              <span className="text-g-muted">{l.upcoming || 0} {tr("upcoming")}</span>
              <span className="text-g-muted truncate">{l.tz}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setForm({ id: l.id, name: l.name || "", address: l.address || "", city: l.city || "", phone: l.phone || "", tz: l.tz || "America/New_York" })} className="btn-ghost text-xs">{tr("Edit")}</button>
              {l.active
                ? <button onClick={() => setActive(l, false)} disabled={busy} className="btn-ghost text-xs">{tr("Deactivate")}</button>
                : <button onClick={() => setActive(l, true)} disabled={busy} className="btn-bright text-xs">{tr("Reactivate")}</button>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Multi-location — run every branch from one dashboard.
function Locations({ V, real = null, email = "", dataKey = "" }) {
  const [sel, setSel] = useState(null); // hook BEFORE the real-mode return so the hook order never shifts when real data lands
  // REAL mode (connected account): manage the tenant's actual units. Demo below stays verbatim.
  if (real && email && dataKey) return <RealLocations email={email} dataKey={dataKey} />;
  const rows = [...loadCreated(V.label, "locations"), ...genLocations(V)];
  const totalRev = rows.reduce((s, r) => s + (r.revenue || 0), 0);
  const addLocation = () => { pushCreated(V.label, "locations", { name: `${V.business.name} · New branch`, addr: "New address", status: "Onboarding", revenue: 0, staff: 0, today: 0 }); toast("Location added ✓ — your AI is now covering it too"); };
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaLocationDot className="text-g-green" /> {tr("Locations")}</div><div className="text-xs text-g-muted mt-0.5">{tr("One AI, every branch — calls, bookings and orders routed to the right location automatically.")}</div></div>
          <button onClick={addLocation} className="btn-bright text-sm inline-flex items-center gap-2"><FaPlus size={11} /> {tr("Add location")}</button>
        </div>
      </Card>
      <MiniStats items={[["Locations", `${rows.length}`], ["Revenue (all)", `$${totalRev.toLocaleString()}`, "good"], ["Open now", `${rows.filter((r) => r.status !== "Onboarding").length}`, "good"], ["Today's volume", `${rows.reduce((s, r) => s + (r.today || 0), 0)}`]]} />
      <div className="grid sm:grid-cols-2 gap-4">
        {rows.map((r, i) => (
          <button key={i} onClick={() => setSel(r)} className="text-left">
            <Card className="hover:border-g-gold/30 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{r.name}{r.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("new")}</span>}</div><div className="text-[11px] text-g-muted">{r.addr}</div></div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: (r.status === "Open" ? "#3E9468" : r.status === "Busy" ? "#D6C29A" : "#38BDF8") + "22", color: r.status === "Open" ? "#3E9468" : r.status === "Busy" ? "#D6C29A" : "#38BDF8" }}>{r.status}</span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs"><span className="font-extrabold text-g-word">${(r.revenue || 0).toLocaleString()}<span className="text-g-muted font-normal"> /mo</span></span><span className="text-g-muted">{r.staff} staff</span><span className="text-g-muted">{r.today} today</span></div>
            </Card>
          </button>
        ))}
      </div>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={sel.addr}
          badge={<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: (sel.status === "Open" ? "#3E9468" : sel.status === "Busy" ? "#D6C29A" : "#38BDF8") + "22", color: sel.status === "Open" ? "#3E9468" : sel.status === "Busy" ? "#D6C29A" : "#38BDF8" }}>{sel.status}</span>}
          fields={[["Address", sel.addr], ["Revenue (mo.)", `$${(sel.revenue || 0).toLocaleString()}`], ["Staff", sel.staff], ["Volume today", sel.today], ["Status", sel.status]]}
          note={sel.status === "Onboarding" ? "New branch — your AI is being set up to cover its calls, bookings and chats." : `Fully live — the AI handles ${sel.name}'s customers 24/7 alongside every other branch.`}
          actions={<><button onClick={() => { toast(`${sel.name} set as default ✓`); setSel(null); }} className="btn-bright text-sm">⭐ Set default</button><a href={waLink(`Hi Guileo, about ${sel.name}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Manage</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

export default Locations;
