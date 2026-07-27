/* Split out of Portal.jsx (performance): Kitchen tab view — code moved verbatim. */
import { useState } from "react";
import { portalApi, toast } from "../lib/portalApi.js";
import { vnum, logImpact, Card } from "../pages/Portal.jsx";

function Kitchen({ V }) {
  const init = V.kitchen || { new: [], preparing: [], ready: [] };
  const [board, setBoard] = useState({ new: [...(init.new || [])], preparing: [...(init.preparing || [])], ready: [...(init.ready || [])] });
  const flow = ["new", "preparing", "ready", "done"];
  const advance = (col, i) => setBoard((b) => {
    const item = b[col][i]; const next = flow[flow.indexOf(col) + 1];
    portalApi.updateStatus("orders", item?.id, next);
    if (next === "done") { const amt = vnum(V.label, "kitchenval", 18, 42); logImpact(V.label, `${item?.id} fulfilled in kitchen`, amt); toast(`${item?.id} completed ✓ — $${amt} logged to Guileo Impact`); }
    else toast(`${item?.id} → ${next}`);
    const nb = { ...b, [col]: b[col].filter((_, j) => j !== i) };
    if (next !== "done") nb[next] = [...b[next], item];
    return nb;
  });
  const cols = [["New", "new", "#3E9468"], ["Preparing", "preparing", "#38BDF8"], ["Ready", "ready", "#D6C29A"]];
  return (
    <div className="space-y-3">
      <p className="text-xs text-g-muted">👆 Tap an order to move it forward · in <b className="text-g-light">Ready</b>, tap to complete.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        {cols.map(([label, key, c]) => (
          <Card key={key}>
            <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold uppercase tracking-wide" style={{ color: c }}>{label}</span><span className="text-[11px] text-g-muted">{board[key].length}</span></div>
            <div className="space-y-2 min-h-[3rem]">
              {board[key].map((o, i) => (
                <button key={o.id + i} onClick={() => advance(key, i)} className="w-full text-left rounded-xl2 border border-white/10 bg-white/[0.04] p-3 hover:border-g-gold/40 hover:-translate-y-0.5 transition-all">
                  <div className="flex justify-between text-xs"><span className="font-bold text-g-word">{o.id}</span><span className="text-g-muted">{o.t}</span></div>
                  <div className="text-[11px] text-g-muted mt-0.5">{o.items}</div>
                  <div className="text-[10px] font-bold mt-1.5" style={{ color: c }}>{key === "ready" ? "Tap to complete ✓" : "Tap to advance →"}</div>
                </button>
              ))}
              {board[key].length === 0 && <div className="text-[11px] text-g-muted text-center py-4">— empty —</div>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default Kitchen;
