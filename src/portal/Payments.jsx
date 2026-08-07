/* Split out of Portal.jsx (performance): Payments tab view.
   TRUST FIX: a REAL (signed-in, connected) client now sees ONLY their real invoices/payments —
   the true A/R spine (crm_invoices via /api/crm action:"invoices"). Every figure (collected,
   outstanding, per-row amount) is computed from real rows in CENTS. No simulated transaction is
   ever shown to a real client: with no real rows we render an honest empty/connect state instead.
   The old simulated ledger (genPayments + client-side "mark paid") stays ONLY in demo/tour mode,
   clearly labelled as sample data. */
import { useEffect, useState } from "react";
import { FaCreditCard, FaPlus } from "react-icons/fa6";
import { toast, portalApi, loadDataKey, fetchCrmInvoices } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { loadCreated, genPayments, logImpact, genCustomers, pushCreated, vnum, Card, tr, MiniStats, Empty, Drawer, SectionSkeleton } from "../pages/Portal.jsx";

const money = (cents) => `$${(Math.max(0, Number(cents) || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const invStatus = (s) => {
  const k = (s || "").toString().toLowerCase();
  if (k === "paid") return { label: tr("Paid"), color: "#3E9468" };
  if (k === "overdue") return { label: tr("Overdue"), color: "#E2533F" };
  if (k === "void" || k === "cancelled" || k === "canceled") return { label: tr("Void"), color: "#9a958c" };
  return { label: tr("Pending"), color: "#D6C29A" };
};
const fmtDue = (iso) => { if (!iso) return "—"; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(); };

// ── REAL payments view — the client's true A/R (crm_invoices). Real cents only, honest empty state. ──
function RealPayments({ V, email, dataKey }) {
  const [rows, setRows] = useState(null);   // null = fetch in flight
  const [sel, setSel] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchCrmInvoices(dataKey, email).then((list) => { if (alive) setRows(Array.isArray(list) ? list : []); });
    return () => { alive = false; };
  }, [dataKey, email]);

  const isPaid = (r) => (r.status || "").toString().toLowerCase() === "paid";
  const isOpen = (r) => { const k = (r.status || "").toString().toLowerCase(); return k === "sent" || k === "pending" || k === "overdue"; };
  const collected = (rows || []).filter(isPaid).reduce((s, r) => s + (Number(r.amount_cents) || 0), 0);
  const outstanding = (rows || []).filter(isOpen).reduce((s, r) => s + (Number(r.amount_cents) || 0), 0);
  const paidCount = (rows || []).filter(isPaid).length;

  const hero = (
    <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaCreditCard className="text-g-green" /> {tr("Payments & invoicing")}</div>
          <div className="text-xs text-g-muted mt-0.5">{tr("Your AI sends invoices + payment links and chases unpaid ones automatically — you just watch the money land.")}</div>
        </div>
        <a href={waLink("I'd like to start sending invoices & payment links to my customers through Guileo.")} target="_blank" rel="noopener" className="btn-bright text-sm inline-flex items-center gap-2"><FaPlus size={11} /> {tr("New invoice")}</a>
      </div>
    </Card>
  );

  if (rows === null) return <div className="space-y-4 stagger">{hero}<SectionSkeleton rows={5} /></div>;

  return (
    <div className="space-y-4 stagger">
      {hero}
      <MiniStats items={[["Collected", money(collected), "good"], ["Outstanding", money(outstanding)], ["Paid invoices", `${paidCount}`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Invoices & payments")}</span></div>
        {rows.length === 0 ? (
          <Empty icon="💳" text={tr("No invoices yet — your AI logs each payment and invoice here the moment it collects. Connect payments in Settings to switch it on.")} />
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {rows.map((r, i) => {
              const st = invStatus(r.status);
              return (
                <button key={r.id || i} onClick={() => setSel(r)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                  <span className="text-xs font-bold text-g-light w-20 shrink-0 truncate">{r.number || (r.id || "").toString().slice(0, 8)}</span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.contact_name || tr("Customer")}</div><div className="text-[11px] text-g-muted">{tr("Due")} {fmtDue(r.due_at)}</div></div>
                  <span className={`text-sm font-extrabold num ${isPaid(r) ? "text-g-green" : st.label === tr("Overdue") ? "text-red-400" : "text-g-word"}`}>{money(r.amount_cents)}</span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: st.color + "22", color: st.color }}>{st.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
      {sel && (() => {
        const st = invStatus(sel.status);
        const paid = (sel.status || "").toString().toLowerCase() === "paid";
        const overdue = st.label === tr("Overdue");
        return (
          <Drawer
            title={`${sel.number || (sel.id || "").toString().slice(0, 8)} · ${sel.contact_name || tr("Customer")}`}
            subtitle={paid ? `${tr("Paid")} ${fmtDue(sel.paid_at)}` : `${tr("Due")} ${fmtDue(sel.due_at)}`}
            badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: st.color + "22", color: st.color }}>{st.label}</span>}
            fields={[["Amount", money(sel.amount_cents)], ["Status", st.label], ["Due", fmtDue(sel.due_at)], ["Paid", paid ? fmtDue(sel.paid_at) : "—"]]}
            note={paid ? tr("Paid & reconciled — logged to your growth.") : overdue ? tr("Overdue — your AI is chasing it with automatic reminders.") : tr("Awaiting payment — your AI follows up until it's settled.")}
            onClose={() => setSel(null)}
          />
        );
      })()}
    </div>
  );
}

// Payments & invoicing — the AI sends invoices/payment links and chases unpaid ones.
function Payments({ V, real = null, email: emailProp = "", dataKey: dataKeyProp = "" }) {
  // Real-mode credentials — prefer props; fall back to session + saved key so a connected client
  // never sees simulated transactions even if this tab isn't wired with props.
  const [sessEmail, setSessEmail] = useState("");
  const [sessDone, setSessDone] = useState(false);
  const key = dataKeyProp || loadDataKey();
  useEffect(() => {
    if (emailProp) return;
    let alive = true;
    portalApi.session().then((s) => { if (!alive) return; if (s?.email && s?.demo !== true) setSessEmail(s.email); setSessDone(true); });
    return () => { alive = false; };
  }, [emailProp]);
  const email = emailProp || sessEmail;
  const live = !!(key && email);
  const resolving = !!key && !email && !emailProp && !sessDone;

  if (live) return <RealPayments V={V} email={email} dataKey={key} />;
  if (resolving) return <div className="space-y-4 stagger"><SectionSkeleton rows={6} /></div>;
  return <DemoPayments V={V} />;
}

// ── DEMO / not-connected: the simulated tour, clearly labelled as sample data. ──
function DemoPayments({ V }) {
  const rows = [...loadCreated(V.label, "payments"), ...genPayments(V)];
  const [paid, setPaid] = useState([]); // ids marked paid this session
  const [sel, setSel] = useState(null);
  const statusOf = (r) => (paid.includes(r.id) ? "Paid" : r.status);
  const colorOf = (r) => (paid.includes(r.id) ? "#3E9468" : r.color);
  const collected = rows.filter((r) => statusOf(r) === "Paid").reduce((s, r) => s + r.amount, 0);
  const outstanding = rows.filter((r) => statusOf(r) !== "Paid").reduce((s, r) => s + r.amount, 0);
  const markPaid = (r) => { setPaid((p) => [...p, r.id]); logImpact(V.label, `${r.id} paid by ${r.customer}`, r.amount); setSel(null); toast(`Taken care of — ${r.id} is settled. $${r.amount} added to your Guileo Impact.`); };
  const newInvoice = () => { const c = (V.customers || genCustomers(V))[0]; pushCreated(V.label, "payments", { id: `INV-${3000 + (Date.now() % 900)}`, customer: c?.name || "New customer", amount: vnum(V.label, "newinv", 60, 320), status: "Pending", color: "#D6C29A", method: "Payment link", due: "in 3 days" }); toast("With pleasure — the payment link is sent and the invoice is on your list."); };
  return (
    <div className="space-y-4 stagger">
      <div className="rounded-xl border border-g-gold/25 bg-g-gold/[0.06] px-4 py-2.5 text-[11px] font-bold text-g-muted">{tr("Demo — sample data. Connect your account in Settings to see your real invoices & payments here.")}</div>
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaCreditCard className="text-g-green" /> {tr("Payments & invoicing")}</div><div className="text-xs text-g-muted mt-0.5">{tr("Your AI sends invoices + payment links and chases unpaid ones automatically — you just watch the money land.")}</div></div>
          <button onClick={newInvoice} className="btn-bright text-sm inline-flex items-center gap-2"><FaPlus size={11} /> New invoice</button>
        </div>
      </Card>
      <MiniStats items={[["Collected", `$${collected.toLocaleString()}`, "good"], ["Outstanding", `$${outstanding.toLocaleString()}`], ["Paid invoices", `${rows.filter((r) => statusOf(r) === "Paid").length}`, "good"], ["Avg. days to pay", `${vnum(V.label, "daystopay", 1, 6)}`]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Invoices & payments")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap to manage</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((r, i) => (
            <button key={i} onClick={() => setSel(r)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
              <span className="text-xs font-bold text-g-light w-20 shrink-0">{r.id}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{r.customer}{r.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("new")}</span>}</div><div className="text-[11px] text-g-muted">{r.method} · {r.due}</div></div>
              <span className={`text-sm font-extrabold num ${statusOf(r) === "Paid" ? "text-g-green money-glow" : statusOf(r) === "Overdue" ? "text-red-400" : "text-g-word"}`}>${r.amount.toLocaleString()}</span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: colorOf(r) + "22", color: colorOf(r) }}>{statusOf(r)}</span>
            </button>
          ))}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={`${sel.id} · ${sel.customer}`}
          subtitle={`${sel.method} · ${sel.due}`}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: colorOf(sel) + "22", color: colorOf(sel) }}>{statusOf(sel)}</span>}
          fields={[["Amount", `$${sel.amount.toLocaleString()}`], ["Method", sel.method], ["Due", sel.due], ["Status", statusOf(sel)]]}
          note={statusOf(sel) === "Paid" ? "Paid & reconciled — logged to your growth." : statusOf(sel) === "Overdue" ? "⚠ Overdue — the AI is sending payment reminders automatically." : "Awaiting payment — the AI follows up until it's settled."}
          actions={statusOf(sel) === "Paid"
            ? <a href={waLink(`Hi ${sel.customer}, thanks for your payment on ${sel.id}!`)} target="_blank" rel="noopener" className="btn-bright text-sm">💬 Thank</a>
            : <><button onClick={() => markPaid(sel)} className="btn-bright text-sm">✓ Mark paid</button><button onClick={() => { toast(`Done — I've sent ${sel.customer} a fresh payment link.`); setSel(null); }} className="btn-ghost text-sm">🔗 Send link</button><button onClick={() => { toast("Consider it handled — a gentle reminder is on its way."); setSel(null); }} className="btn-ghost text-sm">⏰ Remind</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

export default Payments;
