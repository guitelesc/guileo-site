/* Split out of Portal.jsx (performance): Ads tab view — code moved verbatim. */
import { FaArrowTrendUp, FaArrowTrendDown } from "react-icons/fa6";
import { Count } from "../lib/ui.jsx";
import { waLink } from "../data/contact.js";
import { CAMPAIGNS, Card, tr } from "../pages/Portal.jsx";

function Ads() {
  const totalSpend = CAMPAIGNS.reduce((s, c) => s + c.spend, 0);
  const totalLeads = CAMPAIGNS.reduce((s, c) => s + c.leads, 0);
  return (
    <div className="space-y-4 stagger">
      <div className="grid sm:grid-cols-3 gap-4">
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Ad spend")}</div><div className="text-2xl font-extrabold text-g-word num mt-1"><Count to={totalSpend} prefix="$" /></div></Card>
        <Card><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Leads generated")}</div><div className="text-2xl font-extrabold text-g-light num mt-1"><Count to={totalLeads} /></div></Card>
        <Card tone="green"><div className="text-[11px] uppercase tracking-wide text-g-muted">{tr("Avg. ROAS")}</div><div className="text-2xl font-extrabold text-g-green money-glow num mt-1">4.1×</div></Card>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Campaigns")}</div>
        <div className="divide-y divide-white/[0.06]">
          {CAMPAIGNS.map((c) => (
            <div key={c.name} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name}</div><div className="text-[11px] text-g-muted">${c.spend} spend · {c.leads} leads</div></div>
              <div className="text-right"><div className="text-xs text-g-muted">CPL</div><div className="text-sm font-bold text-g-word">${c.cpl}</div></div>
              <div className="text-right w-16"><div className="text-xs text-g-muted">ROAS</div><div className={`text-sm font-extrabold num inline-flex items-center gap-1 ${c.up ? "text-g-green money-glow" : "text-red-400"}`}>{c.up ? <FaArrowTrendUp size={11} /> : <FaArrowTrendDown size={11} />}{c.roas}×</div></div>
            </div>
          ))}
        </div>
      </Card>
      <p className="text-xs text-g-muted text-center">{tr("Connect Meta & Google Ads to see live campaign data here.")} <a href={waLink("I want to connect my ad accounts to Guileo")} target="_blank" rel="noopener" className="text-g-gold font-semibold hover:underline">{tr("Connect accounts →")}</a></p>
    </div>
  );
}

export default Ads;
