/* Split out of Portal.jsx (performance): AIInsights tab view — code moved verbatim. */
import { FaArrowTrendUp } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { genRecommendations, genForecast, aiMissed, Card, GuiMark, tr, Empty, genBenchmarks } from "../pages/Portal.jsx";

// Consolidated AI Insights tab — recommendations (apply in 1 click) + demand/no-show
// forecast + industry benchmarks, all in one place.
function AIInsights({ V, onNav, sections = [], real = null }) {
  // HONESTY (real mode): demand/no-show/benchmarks are a sector SAMPLE (vnum-derived),
  // not this tenant's live data — so in real we label them "Sample" and disable the
  // actions that only toast (they don't place a real call/deposit yet).
  const Sample = () => real ? <span className="text-[9px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1.5 py-0.5">{tr("Sample")}</span> : null;
  const has = new Set(sections.map(([k]) => k));
  const recs = genRecommendations(V).filter((r) => has.has(r.view));
  const fc = genForecast(V);
  const fcMax = Math.max(...fc.load);
  const missed = aiMissed(V);
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-[#FF8A33]/[0.1] to-g-gold/[0.06] border-[#FF8A33]/30">
        <div className="text-sm font-extrabold text-g-word flex items-center gap-2"><GuiMark size={24} /> {tr("AI Insights")}</div>
        <div className="text-xs text-g-muted mt-0.5">{tr("What your AI sees in your numbers — and the exact moves to grow faster. Apply any of them in one click.")}</div>
      </Card>

      <Card className="border-g-gold/30 bg-g-gold/[0.05] p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("⚡ Recommended by your AI · apply in one click")}</div>
        <div className="divide-y divide-white/[0.06]">
          {recs.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="text-lg shrink-0">{r.ic}</span>
              <div className="flex-1 min-w-0 text-xs text-g-word leading-snug">{tr(r.text)}</div>
              <button onClick={() => r.apply(onNav)} className="text-[11px] font-bold rounded-full border border-g-green/40 bg-g-green/[0.1] px-3 py-1.5 text-g-green hover:bg-g-green/20 transition shrink-0">{r.cta} →</button>
            </div>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-white/[0.06] text-[11px] text-g-muted">{tr(missed[0])}</div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-1 flex items-center gap-2">{tr("🔮 Predicted demand · next 7 days")} <Sample /></div>
          <div className="text-[11px] text-g-muted mb-3"><b className="text-g-green">{fc.peak}</b> peaks at <b className="text-g-word">{fc.peakLoad}%</b> — open more capacity. <b className="text-g-muted">{fc.low}</b> is quietest — a promo fills it.</div>
          <div className="flex items-end gap-1.5 h-24">
            {fc.load.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t" style={{ height: `${(v / fcMax) * 100}%`, background: v >= 100 ? "#EF4444" : v >= 80 ? "#D6C29A" : "#3E9468", minHeight: "4px" }} title={`${v}%`} />
                <span className="text-[9px] text-g-muted">{tr(fc.days[i])}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[9px] text-g-muted"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-g-green" />{tr("Normal")}</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "#D6C29A" }} />{tr("Busy")}</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" />{tr("Over capacity")}</span></div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{tr("⚠ No-show risk · AI flagged")} <Sample /></div>
          <div className="divide-y divide-white/[0.06]">
            {fc.risk.length ? fc.risk.map((name, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#FFC23D", boxShadow: "0 0 8px rgba(255,194,61,.55)" }} />
                <div className="flex-1 min-w-0 text-sm font-bold text-g-word truncate">{name}</div>
                {real
                  ? <span className="text-[11px] font-bold rounded-full border border-white/10 px-2.5 py-1 text-g-muted cursor-default" title={tr("Available when connected")}>{tr("Available when connected")}</span>
                  : <button onClick={() => toast(`Taken care of — I've sent ${name} a deposit request and a gentle reminder.`)} className="text-[11px] font-bold rounded-full border border-white/15 px-2.5 py-1 text-g-word hover:border-g-gold/40 transition">{tr("Secure")}</button>}
              </div>
            )) : <Empty icon="✅" text={tr("No high-risk bookings — your AI's reminders are keeping no-shows low.")} />}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">📊 How you compare · vs {V.label.toLowerCase()} average <Sample /></div>
        <div className="divide-y divide-white/[0.06]">
          {genBenchmarks(V).map((b, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{b.label}</div><div className="text-[11px] text-g-muted">You: <b className="text-g-green">{b.you}</b> · Industry avg: {b.avg}</div></div>
              <span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1 shrink-0"><FaArrowTrendUp size={10} /> {b.delta}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-white/[0.06] text-[11px] text-g-muted">{real ? tr("Sample sector benchmark — your live comparison appears as your data builds up.") : tr("You're outperforming your sector on every metric your AI touches.")}</div>
      </Card>
    </div>
  );
}

export default AIInsights;
