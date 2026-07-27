/* Split out of Portal.jsx (performance): CatalogScreen tab view — code moved verbatim. */
import { Card } from "../pages/Portal.jsx";

function CatalogScreen({ V }) {
  const o = V.ops || {}; const list = o.list || [];
  const max = Math.max(1, ...list.map((x) => x.val));
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{o.listTitle || "Catalog"}</div>
      <div className="p-5 space-y-3.5">
        {list.map((it, i) => (
          <div key={i}><div className="flex justify-between text-xs mb-1"><span className="font-bold text-g-word">{it.name}</span><span className="text-g-muted">{it.val}</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${(it.val / max) * 100}%` }} /></div></div>
        ))}
      </div>
    </Card>
  );
}

export default CatalogScreen;
