/* Split out of Portal.jsx (performance): Followups tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { portalApi, toast } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { genFollowups, logImpact, MiniStats, vnum, Card, tr, Drawer } from "../pages/Portal.jsx";

function Followups({ V }) {
  const rows = genFollowups(V);
  const [done, setDone] = useState(() => portalApi.loadState(`${V.label}:fups`, []));
  const [sel, setSel] = useState(null);
  useEffect(() => { setDone(portalApi.loadState(`${V.label}:fups`, [])); }, [V.label]);
  const open = rows.map((r, i) => ({ r, i })).filter(({ i }) => !done.includes(i));
  const pipeline = open.reduce((s, { r }) => s + r.value, 0);
  const markWon = (i, name, value) => { setDone((d) => { const n = [...d, i]; portalApi.saveState(`${V.label}:fups`, n); return n; }); logImpact(V.label, `Won back ${name}`, value || 120); setSel(null); toast(`Wonderful — ${name} is won. 🎉 $${value || 120} added to your Guileo Impact.`); };
  return (
    <div className="space-y-4 stagger">
      <MiniStats items={[["Active sequences", `${open.length}`], ["Pipeline value", `$${pipeline.toLocaleString()}`], ["Won this week", `${vnum(V.label, "won", 4, 14)}`, "good"], ["Auto-nudged", `${vnum(V.label, "nudge", 18, 44)}`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("The AI is chasing these — so you never lose them")}</div>
        <div className="divide-y divide-white/[0.06]">
          {open.map(({ r, i }) => (
            <button key={i} onClick={() => setSel({ r, i })} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name} <span className="text-g-muted font-normal">· {r.type}</span></div><div className="text-[11px] text-g-muted">via {r.ch} · next: {r.next} · step {r.stage}/3</div></div>
              <span className="text-sm font-extrabold text-g-green">${r.value}</span>
              <div className="flex gap-1.5 shrink-0">
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); toast(`Done — I've nudged ${r.name} for you.`); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toast(`Done — I've nudged ${r.name} for you.`); } }} className="text-[10px] font-bold rounded-full border border-white/15 px-2.5 py-1 text-g-word hover:border-g-gold/40 transition cursor-pointer">Nudge</span>
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); markWon(i, r.name, r.value); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); markWon(i, r.name, r.value); } }} className="text-[10px] font-bold rounded-full bg-g-green/15 border border-g-green/40 px-2.5 py-1 text-g-green cursor-pointer">{tr("Won")}</span>
              </div>
            </button>
          ))}
          {open.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">{tr("✅ All caught up — every lead followed up.")}</div>}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.r.name}
          subtitle={sel.r.type}
          badge={<span className="text-sm font-extrabold text-g-green">${sel.r.value}</span>}
          fields={[["Type", sel.r.type], ["Channel", sel.r.ch], ["Next touch", sel.r.next], ["Sequence stage", `${sel.r.stage} of 3`], ["Pipeline value", `$${sel.r.value}`]]}
          note={`The AI is running a ${sel.r.stage}-of-3 follow-up sequence via ${sel.r.ch}. It stops automatically the moment they convert or reply.`}
          actions={<><button onClick={() => { toast(`Done — I've nudged ${sel.r.name} for you.`); setSel(null); }} className="btn-bright text-sm">{tr("Send nudge now")}</button><button onClick={() => markWon(sel.i, sel.r.name, sel.r.value)} className="btn-ghost text-sm">{tr("🎉 Mark won")}</button><a href={waLink(`Hi ${sel.r.name}, following up…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">{tr("💬 Message")}</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

export default Followups;
