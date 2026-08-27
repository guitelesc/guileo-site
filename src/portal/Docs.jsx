/* Split out of Portal.jsx (performance): Docs tab view — code moved verbatim. */
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
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Documents & billing")}</span><span className="text-[10px] font-black uppercase tracking-wide text-g-muted">{tr("Demo — sample data")}</span></div>
      <div className="divide-y divide-white/[0.06]">
        {DOCS.map(([ic, name, meta]) => (
          <div key={name} className="flex items-center gap-3 px-5 py-3.5">
            <span className="text-xl">{ic}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{name}</div><div className="text-[11px] text-g-muted">{meta}</div></div>
            {/* 🚨 View/Download só ABRIAM UM TOAST (2026-08-25): não há arquivo por trás destas linhas
                de amostra. Botão que não faz o que diz treina o dono a não confiar no que faz.
                Vira rótulo — a demonstração continua legível, e ninguém clica esperando um PDF. */}
            <span className="shrink-0 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-g-muted">{tr("Sample")}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default Docs;
