/* Split out of Portal.jsx (performance): Payments tab view — code moved verbatim. */
import { useState } from "react";
import { FaCreditCard, FaPlus } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { loadCreated, genPayments, logImpact, genCustomers, pushCreated, vnum, Card, tr, MiniStats, Drawer } from "../pages/Portal.jsx";

// Payments & invoicing — the AI sends invoices/payment links and chases unpaid ones.
// Collecting a payment feeds the Guileo Impact ledger.
function Payments({ V }) {
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
