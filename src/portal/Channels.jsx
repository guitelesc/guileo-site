/* Split out of Portal.jsx (performance): Channels tab view — code moved verbatim. */
import { Count } from "../lib/ui.jsx";
import { CHANNELS, Card, tr } from "../pages/Portal.jsx";

function Channels() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
      {CHANNELS.map((c) => (
        <Card key={c.name} tone="green">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-white/[0.07]" style={{ color: c.color }}><c.Icon size={20} /></span>
            <div><div className="text-sm font-extrabold text-g-word">{c.name}</div><div className="text-[11px] text-g-muted">{c.note}</div></div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div><div className="text-xl font-extrabold text-g-word num"><Count to={c.convos} /></div><div className="text-[10px] uppercase tracking-wide text-g-muted">{tr("Conversations")}</div></div>
            <div><div className="text-xl font-extrabold text-g-green money-glow num"><Count to={c.won} /></div><div className="text-[10px] uppercase tracking-wide text-g-muted">{tr("Won / booked")}</div></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default Channels;
