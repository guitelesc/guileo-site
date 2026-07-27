/* Split out of Portal.jsx (performance): Audiences tab view — code moved verbatim. */
import { toast } from "../lib/portalApi.js";
import { Count } from "../lib/ui.jsx";
import { loadCreated, genAudiences, pushCreated, Card, tr, Empty } from "../pages/Portal.jsx";

function Audiences({ V, onNav }) {
  const rows = [...loadCreated(V.label, "audiences"), ...(V.audiences || genAudiences(V))];
  const launch = (a) => { pushCreated(V.label, "campaigns", { name: `Campaign · ${a.name}`, channel: a.source === "Meta" ? "Meta" : a.source === "Google" ? "Google" : "Email", sent: 0, opened: 0, revenue: 0, status: "Active" }); toast(`Campaign launched to "${a.name}" ✓ — see it in Campaigns`); onNav?.("campaigns"); };
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {rows.map((a, i) => (
        <Card key={i} className="flex flex-col">
          <div className="flex items-center justify-between"><div className="text-sm font-bold text-g-word flex items-center gap-1.5">{a.name}{a.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("new")}</span>}</div><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-g-muted">{a.source}</span></div>
          <div className="mt-2 text-2xl font-extrabold text-g-word"><Count to={a.size} /></div>
          <div className="text-[11px] text-g-muted">people reachable</div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => toast(`"${a.name}" synced to ${a.source === "Meta" ? "Meta Ads" : a.source === "Google" ? "Google Ads" : "your ad platforms"} ✓`)} className="text-[11px] font-bold rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-3 py-1.5 text-g-gold hover:bg-g-gold/[0.16] transition">{tr("Sync to ads")}</button>
            <button onClick={() => launch(a)} className="text-[11px] font-bold rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-g-word hover:border-g-gold/40 transition">Use in a campaign →</button>
          </div>
        </Card>
      ))}
      {rows.length === 0 && <div className="sm:col-span-2"><Card><Empty icon="🎯" text={tr("No audiences built yet — your AI segments customers automatically as data grows.")} /></Card></div>}
    </div>
  );
}

export default Audiences;
