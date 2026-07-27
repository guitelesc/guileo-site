/* Split out of Portal.jsx (performance): MenuView tab view — code moved verbatim. */
import { useState } from "react";
import { toast } from "../lib/portalApi.js";
import { Card, Drawer, tr } from "../pages/Portal.jsx";

function MenuView({ V }) {
  const sc = (s) => s === "Out" ? "#EF4444" : s === "Low" ? "#D6C29A" : "#3E9468";
  const [ov, setOv] = useState({});           // local stock overrides (restock actions)
  const [sel, setSel] = useState(null);
  const stockOf = (i, m) => ov[i] || m.stock;
  const setStock = (i, s, name) => { setOv((o) => ({ ...o, [i]: s })); setSel(null); toast(`${name} → ${s === "In stock" ? "restocked ✓" : s.toLowerCase()}`); };
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {(V.menu || []).map((m, i) => {
        const stock = stockOf(i, m);
        return (
          <button key={i} onClick={() => setSel({ m, i })} className="text-left">
            <Card className="hover:border-g-gold/30 transition">
              <div className="flex items-start justify-between gap-2">
                <div><div className="text-sm font-bold text-g-word">{m.name}</div><div className="text-[11px] text-g-muted">{m.cat}</div></div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc(stock) + "22", color: sc(stock) }}>{stock}</span>
              </div>
              <div className="mt-3 text-xl font-extrabold text-g-word">${m.price.toFixed(2)}</div>
            </Card>
          </button>
        );
      })}
      {sel && (
        <Drawer
          title={sel.m.name}
          subtitle={sel.m.cat}
          badge={<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sc(stockOf(sel.i, sel.m)) + "22", color: sc(stockOf(sel.i, sel.m)) }}>{stockOf(sel.i, sel.m)}</span>}
          fields={[["Price", `$${sel.m.price.toFixed(2)}`], ["Category", sel.m.cat], ["Stock", stockOf(sel.i, sel.m)]]}
          note="Your AI auto-pauses an item from suggestions when it's out of stock, and flags low stock here so you never sell what you can't deliver."
          actions={<>
            <button onClick={() => setStock(sel.i, "In stock", sel.m.name)} className="btn-bright text-sm">✓ Mark restocked</button>
            <button onClick={() => setStock(sel.i, "Out", sel.m.name)} className="btn-ghost text-sm">{tr("Mark out of stock")}</button>
          </>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

export default MenuView;
