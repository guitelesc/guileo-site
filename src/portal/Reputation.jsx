/* Split out of Portal.jsx (performance): Reputation tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { toast } from "../lib/portalApi.js";
import { genReviews, loadCreated, genCustomers, pushCreated, MiniStats, vnum, Card, tr, Drawer } from "../pages/Portal.jsx";

function Reputation({ V, onNav }) {
  const reviews = genReviews(V);
  const dist = [["5★", 78], ["4★", 15], ["3★", 4], ["2★", 2], ["1★", 1]];
  const [sel, setSel] = useState(null);
  const [reqs, setReqs] = useState(() => loadCreated(V.label, "reviewreq")); // pending review requests
  useEffect(() => { setReqs(loadCreated(V.label, "reviewreq")); }, [V.label]);
  const blast = () => { (V.customers || genCustomers(V)).slice(0, 3).forEach((c) => pushCreated(V.label, "reviewreq", { name: c.name, ch: c.channel })); setReqs(loadCreated(V.label, "reviewreq")); toast("Leave it with me — review requests are on their way to your recent guests."); };
  const boost = (r) => { pushCreated(V.label, "campaigns", { name: `⭐ ${r.name}'s ${r.stars}★ review → ad`, channel: r.ch || "Meta", sent: 0, opened: 0, revenue: 0, status: "Active" }); setSel(null); toast(`Done — that review is now a live ad. You'll see it in Campaigns.`); onNav?.("campaigns"); };
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Avg rating", `${((46 + vnum(V.label, "rate", 0, 3)) / 10).toFixed(1)} ★`, "good"], ["Reviews this month", `${vnum(V.label, "revc", 40, 140)}`, "good"], ["Requests sent", `${vnum(V.label, "reqs", 200, 420) + reqs.length}`], ["Request → review", `${vnum(V.label, "conv", 24, 38)}%`, "good"]]} />
      {reqs.length > 0 && (
        <Card className="border-g-gold/25 bg-g-gold/[0.05]">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">{tr("⭐ Review requests in flight")}</div>
          <div className="flex flex-wrap gap-2">{reqs.map((r, i) => (<span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3FB4FF", boxShadow: "0 0 7px rgba(63,180,255,.55)" }} />{r.name} <span className="text-g-muted">· {r.ch || "WhatsApp"} · awaiting</span></span>))}</div>
        </Card>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("Rating breakdown")}</div>
          {dist.map(([l, v]) => (<div key={l} className="mb-2 last:mb-0 flex items-center gap-2"><span className="text-xs text-g-muted w-8">{l}</span><div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green" style={{ width: `${v}%` }} /></div><span className="text-[11px] text-g-muted w-8 text-right">{v}%</span></div>))}
          <button onClick={blast} className="btn-bright text-sm w-full mt-4 justify-center">{tr("Request reviews now")}</button>
        </Card>
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Recent reviews · collected by AI")}</div>
          <div className="divide-y divide-white/[0.06]">{reviews.map((r, i) => (<button key={i} onClick={() => setSel(r)} className="w-full text-left px-5 py-3 hover:bg-white/[0.04] transition"><div className="flex items-center justify-between"><span className="text-sm font-bold text-g-word">{r.name}</span><span className="text-xs text-g-gold">{"★".repeat(r.stars)}<span className="text-g-muted">{"★".repeat(5 - r.stars)}</span></span></div><div className="text-[12px] text-g-muted mt-0.5">"{r.text}" <span className="text-g-light">· {r.ch}</span></div></button>))}</div>
        </Card>
      </div>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.ch} review`}
          badge={<span className="text-xs text-g-gold">{"★".repeat(sel.stars)}</span>}
          fields={[["Rating", `${sel.stars} / 5`], ["Channel", sel.ch], ["Status", "Published"]]}
          note={<>"{sel.text}"<div className="mt-2 text-g-muted">{tr("The AI requested this review automatically after a great experience.")}</div></>}
          actions={<><button onClick={() => { toast("With pleasure — a warm thank-you reply is posted."); setSel(null); }} className="btn-bright text-sm">💬 Reply / thank</button>{sel.stars >= 4 && <button onClick={() => boost(sel)} className="btn-ghost text-sm">🚀 Boost as ad</button>}<button onClick={() => { toast("Done — I've shared it to your social channels."); setSel(null); }} className="btn-ghost text-sm">📣 Share</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

export default Reputation;
