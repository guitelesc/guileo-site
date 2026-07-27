/* Split out of Portal.jsx (performance): Customers tab view — code moved verbatim. */
import { useState } from "react";
import { toast } from "../lib/portalApi.js";
import { waTo } from "../data/contact.js";
import { loadCreated, SECTOR_IQ, genCustomers, convoAction, recordFor, pushCreated, MiniStats, vnum, Card, tr, Empty, Drawer } from "../pages/Portal.jsx";

// Vertical-aware "rebook" verb — Re-order for restaurants/retail, Book again for
// appointment businesses, Schedule visit for field services.
const REBOOK = { "Restaurant": "Re-order for them", "E-Commerce": "Send re-order link", "Clinic": "Book next visit", "Medical": "Book next visit", "Salon & Spa": "Book next visit", "Gym & Fitness": "Book a session", "Law Firm": "Schedule a call", "Real Estate": "Schedule a viewing", "Plumbing & HVAC": "Schedule service", "Auto Dealership": "Schedule service", "Education": "Book a class", "Construction": "Schedule a site visit" };
// A synthetic recent-activity timeline so each profile reads like a real CRM record.
function custTimeline(c, V) {
  const noun = (c.noun || "order").replace(/s$/, "");
  const L = V.label, name = c.name;
  // REAL events first — anything the operator actually did for this customer (created:* records).
  const real = [];
  loadCreated(L, "liveorders").filter((o) => o.customer === name).forEach((o) => real.push({ t: "just now", ev: `Order ${o.id} created · ${o.channel}`, ic: "🧾", real: true }));
  loadCreated(L, "schedule").filter((o) => o.name === name).forEach((o) => real.push({ t: "just now", ev: `Booked · ${o.meta || "appointment"}`, ic: "📅", real: true }));
  loadCreated(L, "deliveries").filter((o) => o.customer === name).forEach((o) => real.push({ t: "just now", ev: `Delivery · ${o.status}`, ic: "🛵", real: true }));
  loadCreated(L, "payments").filter((o) => o.customer === name).forEach((o) => real.push({ t: "just now", ev: `${o.id} · ${o.status} · $${o.amount}`, ic: "💳", real: true }));
  loadCreated(L, "reviewreq").filter((o) => o.name === name).forEach(() => real.push({ t: "just now", ev: "Review requested by your AI", ic: "⭐", real: true }));
  const base = [
    { t: c.last, ev: `Last ${noun} · via ${c.channel}`, ic: "🟢" },
    { t: "2 days ago", ev: `AI answered a question on ${c.channel}`, ic: "💬" },
    { t: "1 week ago", ev: `Left a 5★ review (AI-requested)`, ic: "⭐" },
    { t: "3 weeks ago", ev: `First ${noun} with ${V.business.name}`, ic: "✨" },
  ];
  return [...real, ...base];
}
// The revenue-share thesis, made concrete: tell the owner the single best move.
function nextBestAction(c, i, V) {
  const nb = V && SECTOR_IQ[V.label]?.nb;
  if (nb) {
    if (i === 0) return `Your top customer — ${nb.top} The AI can do it now.`;
    if ((c.orders || 0) < 3) return `Going quiet — ${nb.risk} The AI can handle it.`;
    return `${c.name?.split(" ")[0] || "They"} ${nb.base} The AI can send it.`;
  }
  if (i === 0) return "Your top spender. A personal thank-you + a small perk usually unlocks a referral. The AI can send it now.";
  if ((c.orders || 0) >= 15) return "Loyal & frequent — a perfect fit for a membership/subscription. Offer it to lock in recurring revenue.";
  return "Active but not yet loyal. One well-timed nudge with a returning-customer offer tends to convert them. The AI can handle it.";
}
function Customers({ V, onNav }) {
  const rows = V.customers || genCustomers(V);
  const totalSpent = rows.reduce((s, c) => s + (c.spent || 0), 0);
  const [sel, setSel] = useState(null);
  const rebook = (c) => { const act = convoAction(V); const rec = recordFor(act.view, c.name, c.channel, V); if (rec) pushCreated(V.label, act.view, rec); setSel(null); toast(`${REBOOK[V.label] || "Rebook"} created for ${c.name} ✓ — see it in the tab`); onNav?.(act.view); };
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Total customers", `${rows.length * 104}`], ["New this week", `+${rows.length * 6}`, "good"], ["Avg. value", `$${rows.length ? Math.round(totalSpent / rows.length) : 0}`], ["Repeat rate", `${vnum(V.label, "repeat", 31, 47)}%`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Customers")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap for profile</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <button key={i} onClick={() => setSel({ c, i })} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{c.name[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{c.name}{i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-g-gold/15 text-g-gold">{tr("TOP")}</span>}</div><div className="text-[11px] text-g-muted truncate">{c.orders} {c.noun || "orders"} · {c.channel} · {c.last}</div></div>
              <span className="text-sm font-extrabold text-g-green">${c.spent.toFixed(2)}</span>
            </button>
          ))}
          {rows.length === 0 && <Empty icon="🧑" text={tr("No customers yet — I'll add each one here the moment I book or serve them.")} />}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.c.name}
          subtitle={`${sel.c.orders} ${sel.c.noun || "orders"} · via ${sel.c.channel}`}
          badge={sel.i === 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-g-gold/15 text-g-gold">{tr("VIP")}</span> : null}
          fields={[["Lifetime value", `$${sel.c.spent.toFixed(2)}`], [(sel.c.noun || "orders"), sel.c.orders], ["Preferred channel", sel.c.channel], ["Last seen", sel.c.last], ["Status", sel.i === 0 ? "Top spender" : "Active"]]}
          note={<><div className="text-[10px] font-black uppercase text-g-gold mb-1">{tr("⚡ Next best action")}</div>{nextBestAction(sel.c, sel.i, V)}</>}
          actions={<>
            <a href={waTo(sel.c.phone, `Hi ${sel.c.name}! `)} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("💬 Message")}</a>
            <button onClick={() => rebook(sel.c)} className="btn-ghost text-sm">🔁 {REBOOK[V.label] || "Rebook"}</button>
            <button onClick={() => { pushCreated(V.label, "reviewreq", { name: sel.c.name, ch: sel.c.channel }); toast(`With pleasure — I've asked ${sel.c.name} for a review. You'll find it tracked in Reputation.`); setSel(null); onNav?.("reputation"); }} className="btn-ghost text-sm">⭐ Request review</button>
          </>}
          onClose={() => setSel(null)}
        >
          <div className="mt-1">
            <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">{tr("Recent activity")}</div>
            <div className="space-y-2.5">
              {custTimeline(sel.c, V).map((e, k) => (
                <div key={k} className="flex items-start gap-2.5 text-xs">
                  <span className="text-sm leading-none mt-0.5">{e.ic}</span>
                  <div className="flex-1 min-w-0"><div className="text-g-word font-semibold flex items-center gap-1.5">{e.ev}{e.real && <span className="text-[8px] font-black uppercase tracking-wide text-g-green bg-g-green/15 rounded px-1 py-0.5">live</span>}</div><div className="text-[10px] text-g-muted">{e.t}</div></div>
                </div>
              ))}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

export default Customers;
