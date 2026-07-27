/* Split out of Portal.jsx (performance): Docs tab view — code moved verbatim. */
import { toast } from "../lib/portalApi.js";
import { Card, tr, DOCS } from "../pages/Portal.jsx";

function Docs({ real = null } = {}) {
  // real mode: these rows are sample documents — a real client must never see a fabricated
  // "Signed Service Agreement". Their real contracts/quotes live in the Documents area.
  if (real) return (
    <Card className="p-6 text-center">
      <div className="text-3xl">🗂️</div>
      <div className="mt-2 text-sm font-bold text-g-word">{tr("Your real documents live in Documents")}</div>
      <div className="mt-1 text-[12px] text-g-muted">{tr("Contracts and quotes appear there as they're issued — nothing sampled here.")}</div>
    </Card>
  );
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Documents & billing")}</div>
      <div className="divide-y divide-white/[0.06]">
        {DOCS.map(([ic, name, meta, action]) => (
          <div key={name} className="flex items-center gap-3 px-5 py-3.5">
            <span className="text-xl">{ic}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{name}</div><div className="text-[11px] text-g-muted">{meta}</div></div>
            <button onClick={() => toast(action === "View" ? `Opening ${name}…` : `${name} · ${action}`)} aria-label={`${action} — ${name}`} className="text-xs font-bold text-g-gold hover:underline">{action}</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default Docs;
