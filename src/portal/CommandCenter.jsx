/* Split out of Portal.jsx (performance): CommandCenter tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { fetchCRM, fetchCrmDeals, fetchNoshowRadar, fetchCrmInvoices, toast } from "../lib/portalApi.js";
import { genCustomers, tr, Card, MiniStats, Empty } from "../pages/Portal.jsx";

// Command Center — the Company-OS "brain": unifies the live spine into one screen — money
// (revenue won + open pipeline), the funnel (contacts/leads/churn) and the predictive no-show radar.
// Reads only already-live RPCs (crm_list_contacts, crm_deals_list, noshow_risk); demo synthesizes.
function CommandCenter({ V, onNav, real = null, email = "", dataKey = "" }) {
  const demo = !dataKey;
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [radar, setRadar] = useState({ ready: false, highRisk: 0, appointments: [] });
  const [invoices, setInvoices] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    if (demo) {
      const sc = V.customers || genCustomers(V);
      const stages = ["inquiry", "quoted", "booked", "won"];
      setContacts(sc.map((c, i) => ({ ltv_cents: Math.round((c.spent || 0) * 100), lifecycle: i === 0 ? "vip" : (c.orders || 1) > 1 ? "customer" : "lead", churn_risk: i % 4 === 3 ? 64 : 11 })));
      setDeals(sc.map((c, i) => ({ value_cents: Math.round((c.spent || 0) * 100), stage: stages[i % 4], status: i % 4 === 3 ? "won" : "open" })));
      setRadar({ ready: true, highRisk: 1, appointments: sc.slice(0, 3).map((c, i) => ({ customer_name: c.name, starts_at: null, risk: [72, 38, 21][i] || 20, reason: i === 0 ? "2 prior no-show(s) · booked 9d ahead" : "booked 2d ahead" })) });
      setInvoices(sc.map((c, i) => ({ amount_cents: Math.round((c.spent || 50) * 100), status: ["paid", "sent", "overdue", "paid", "overdue"][i % 5] })));
      setLoaded(true);
      return () => { alive = false; };
    }
    if (dataKey) {
      fetchCRM(dataKey, email).then((d) => { if (alive) { setContacts(d.contacts || []); setLoaded(true); } });
      fetchCrmDeals(dataKey, email).then((d) => { if (alive) setDeals(d); });
      fetchNoshowRadar(dataKey, email).then((d) => { if (alive) setRadar(d); });
      fetchCrmInvoices(dataKey, email).then((d) => { if (alive) setInvoices(d); });
    } else { setLoaded(true); }
    return () => { alive = false; };
  }, [demo, dataKey, email]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtMoney = (c) => `$${Math.round((c || 0) / 100).toLocaleString()}`;
  const openVal = deals.filter((d) => d.status === "open").reduce((s, d) => s + (d.value_cents || 0), 0);
  const wonVal = deals.filter((d) => d.status === "won" || d.stage === "won").reduce((s, d) => s + (d.value_cents || 0), 0);
  const ltv = contacts.reduce((s, c) => s + (c.ltv_cents || 0), 0);
  const leads = contacts.filter((c) => (c.lifecycle || "lead") === "lead").length;
  const churn = contacts.filter((c) => (c.churn_risk || 0) >= 50).length;
  const riskCls = (r) => r >= 60 ? "bg-red-500/15 text-red-300" : r >= 35 ? "bg-g-gold/15 text-g-gold" : "bg-g-green/15 text-g-green";

  // ── NEXT BEST ACTIONS — the co-pilot strip: highest-value 1-tap actions across departments ──
  const overdue = invoices.filter((i) => i.status === "overdue");
  const overdueSum = overdue.reduce((s, i) => s + (i.amount_cents || 0), 0);
  const cold = contacts.filter((c) => (c.churn_risk || 0) >= 50 || ["lapsed", "churned"].includes(c.lifecycle)).length;
  const risky = (radar.appointments || []).filter((a) => (a.risk || 0) >= 60).length;
  const reactivate = async () => {
    if (!dataKey) { toast(tr("Connect your account to reactivate for real.")); return; }
    toast(`${tr("Gui is reactivating")} ${cold} ${tr("cold contacts")}…`);
    try {
      const r = await fetch("/api/reactivate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dataKey, email }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) toast(`${tr("Gui reached")} ${(d.sms || 0) + (d.calls || 0)} ${tr("customers")} ✓`);
      else toast(tr("Couldn't reach the reactivation engine — try again."));
    } catch { toast(tr("Couldn't reach the reactivation engine — try again.")); }
  };
  // Over-confirm — Gui actually reaches every high-risk booking (branded email now, phone queued for
  // the confirm engine). Only claims "reminded" on a true send count from the backend; else "queued".
  const overConfirm = async () => {
    if (!dataKey) { toast(tr("Connect your account to over-confirm for real.")); return; }
    toast(`${tr("Gui is over-confirming")} ${risky} ${tr("bookings")}…`);
    try {
      const r = await fetch("/api/noshow-radar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dataKey, email, action: "confirm" }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) toast((Number(d.sent) || 0) > 0 ? `${tr("Gui reminded")} ${d.sent} ${tr("customers")} ✓` : tr("Queued ✓ — Gui will remind them"));
      else toast(tr("Couldn't reach the confirmation engine — try again."));
    } catch { toast(tr("Couldn't reach the confirmation engine — try again.")); }
  };
  const nba = [];
  if (overdue.length) nba.push({ icon: "🏦", label: `${overdue.length} ${tr("overdue invoices")} (${fmtMoney(overdueSum)})`, cta: tr("Review & collect"), act: () => { toast(`${tr("Opening your overdue invoices")} →`); onNav?.("finance"); } });
  if (cold) nba.push({ icon: "🔄", label: `${cold} ${tr("contacts going cold")}`, cta: tr("Reactivate"), act: reactivate });
  if (risky) nba.push({ icon: "🔮", label: `${risky} ${tr("high-risk no-shows")}`, cta: tr("Over-confirm"), act: overConfirm });

  const wonCount = deals.filter((d) => d.status === "won" || d.stage === "won").length;
  const brief = `${tr("This week Gui kept")} ${contacts.length} ${tr("contacts moving, closed")} ${wonCount} ${tr("deals worth")} ${fmtMoney(wonVal)}, ${tr("and flagged")} ${churn} ${tr("at-risk +")} ${risky} ${tr("likely no-shows to act on.")}`;

  return (
    <div className="space-y-4 stagger">
      <Card className="bg-white/[0.03]">
        <div className="text-[11px] font-black uppercase tracking-wide text-g-gold mb-1.5">📋 {tr("This week, in a line")}</div>
        <p className="text-[14px] leading-relaxed text-g-ink">{brief}</p>
      </Card>
      {nba.length > 0 && (
        <Card className="border-g-gold/30 bg-g-gold/[0.06]">
          <div className="text-[11px] font-black uppercase tracking-wide text-g-gold mb-2">⚡ {tr("Next best actions")}</div>
          <div className="space-y-2">
            {nba.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                <span className="text-lg shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0 text-[13px] font-semibold text-g-word truncate">{a.label}</div>
                <button onClick={a.act} className="btn-bright text-[12px] shrink-0 whitespace-nowrap">{a.cta}</button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {!loaded ? (
        <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Card key={i}><div className="h-3 w-20 rounded bg-white/10 animate-pulse" /><div className="h-7 w-24 rounded bg-white/[0.07] animate-pulse mt-2" /></Card>)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card tone="green"><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Revenue won")}</div><div className="text-2xl font-extrabold text-g-green money-glow mt-1">{fmtMoney(wonVal)}</div></Card>
          <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Pipeline value")}</div><div className="text-2xl font-extrabold text-g-word mt-1">{fmtMoney(openVal)}</div></Card>
          <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Lifetime value")}</div><div className="text-2xl font-extrabold text-g-light mt-1">{fmtMoney(ltv)}</div></Card>
        </div>
      )}
      <MiniStats items={[[tr("Contacts"), `${contacts.length}`], [tr("Active leads"), `${leads}`, "good"], [tr("At churn risk"), `${churn}`, churn ? "bad" : undefined], [tr("No-show risk"), `${radar.highRisk}`, radar.highRisk ? "bad" : undefined]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">🔮 {tr("No-show risk radar")}</span><span className="text-[11px] text-g-muted hidden sm:inline">{tr("next 7 days")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {radar.appointments.length ? radar.appointments.slice(0, 6).map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className={`grid place-items-center h-9 w-9 rounded-full text-[12px] font-black shrink-0 ${riskCls(a.risk || 0)}`}>{a.risk || 0}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{a.customer_name || a.customer_contact || "—"}</div><div className="text-[11px] text-g-muted truncate">{a.reason || ""}{a.starts_at ? ` · ${new Date(a.starts_at).toLocaleString()}` : ""}</div></div>
            </div>
          )) : <Empty icon="🔮" text={demo ? tr("As bookings come in, Gui ranks the ones most likely to ghost — so you can over-confirm them first.") : tr("No upcoming bookings to score yet — Gui flags the risky ones here automatically.")} />}
        </div>
      </Card>
      <div className="text-center"><button onClick={() => onNav?.("crm")} className="btn-ghost text-sm">{tr("Open the CRM 360 →")}</button></div>
    </div>
  );
}

export default CommandCenter;
