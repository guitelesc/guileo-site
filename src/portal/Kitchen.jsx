/* Split out of Portal.jsx (performance): Kitchen tab view — code moved verbatim. */
import { useState, useEffect, useCallback } from "react";
import { portalApi, toast, fetchPedidos, setPedidoStatus } from "../lib/portalApi.js";
import { vnum, logImpact, Card, tr, FaixaAmostra } from "../pages/Portal.jsx";

// a ordem das colunas, num lugar só — a tela e a gravação leem a MESMA sequência.
const flowSeguinte = (col) => ({ new: "preparing", preparing: "ready", ready: "done" })[col] || "done";

function Kitchen({ V, real, email, dataKey }) {
  // ── A COZINHA COM ESTADO DE VERDADE (2026-08-20) ──────────────────────────────────────────
  // Ontem eu me RECUSEI a ligar esta tela, porque as colunas eram estado que o banco não guardava:
  // o dono arrastava o cartão, fechava a aba, e o pedido voltava pro começo. Meia-verdade é pior
  // que amostra declarada. Agora `biz_orders` guarda o estado, e a coluna virou fato.
  // 🚨 O CARTÃO SÓ ANDA DEPOIS QUE O BANCO CONFIRMA. Mover na tela e gravar "em paralelo" faria a
  // cozinha marcar pronto, o servidor recusar, e o pedido existir em dois estados ao mesmo tempo —
  // um na tela do cozinheiro, outro para o cliente que ligar perguntando.
  const [pedidos, setPedidos] = useState({ estado: "carregando", dados: null, motivo: null });
  const [movendo, setMovendo] = useState(null);

  const carrega = useCallback(() => {
    if (!real || !email || !dataKey) { setPedidos({ estado: "amostra", dados: null, motivo: null }); return; }
    fetchPedidos(email, dataKey).then((r) => setPedidos({ estado: r.dados ? "ok" : "err", dados: r.dados, motivo: r.motivo }));
  }, [real, email, dataKey]);
  useEffect(() => { carrega(); }, [carrega]);

  const reais = pedidos.estado === "ok" && Array.isArray(pedidos.dados) ? pedidos.dados : null;
  const EN_PT = { novo: "new", preparando: "preparing", pronto: "ready" };
  const PT_EN = { new: "novo", preparing: "preparando", ready: "pronto", done: "entregue" };

  const mover = async (pedido, colunaAtual) => {
    const proximo = PT_EN[flowSeguinte(colunaAtual)];
    setMovendo(pedido.id);
    const r = await setPedidoStatus(email, dataKey, pedido.id, proximo);
    setMovendo(null);
    if (!r.ok) { toast(`${tr("Couldn't move the order")}: ${r.motivo}`); return; }
    if (proximo === "entregue") {
      const amt = Number(pedido.total) || 0;
      if (amt > 0) logImpact(V.label, `${pedido.ref || pedido.id} fulfilled`, amt);
    }
    carrega();  // relê do banco: a tela mostra o que está GRAVADO, não o que eu supus
  };

  const init = V.kitchen || { new: [], preparing: [], ready: [] };
  const [board, setBoard] = useState({ new: [...(init.new || [])], preparing: [...(init.preparing || [])], ready: [...(init.ready || [])] });
  // o quadro REAL é derivado dos pedidos gravados; o de amostra continua sendo estado local.
  const quadroReal = reais ? {
    new:        reais.filter((p) => p.status === "novo").map((p) => ({ ...p, id: p.ref || p.id.slice(0, 6), _id: p.id })),
    preparing:  reais.filter((p) => p.status === "preparando").map((p) => ({ ...p, id: p.ref || p.id.slice(0, 6), _id: p.id })),
    ready:      reais.filter((p) => p.status === "pronto").map((p) => ({ ...p, id: p.ref || p.id.slice(0, 6), _id: p.id })),
  } : null;
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
    <>
      <FaixaAmostra real={real && !reais} />
      {pedidos.estado === "err" && (
        <div className="mb-3 rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 text-[12px] text-[#e0855f]">
          {tr("Couldn't read your orders")} — {pedidos.motivo}
        </div>
      )}
      {reais && reais.length === 0 && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-g-muted">
          {tr("No orders in the last 48h. New ones land here the moment a platform sends them.")}
        </div>
      )}
      <div className="space-y-3">
      <p className="text-xs text-g-muted">👆 Tap an order to move it forward · in <b className="text-g-light">Ready</b>, tap to complete.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        {cols.map(([label, key, c]) => (
          <Card key={key}>
            {/* o quadro do banco vence o de amostra; quando não há real, nada muda no comportamento antigo */}
            {(() => { const lista = (quadroReal || board)[key]; return (<>
            <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold uppercase tracking-wide" style={{ color: c }}>{label}</span><span className="text-[11px] text-g-muted">{lista.length}</span></div>
            <div className="space-y-2 min-h-[3rem]">
              {lista.map((o, i) => (
                <button key={(o._id || o.id) + i} disabled={movendo === o._id}
                  onClick={() => (quadroReal ? mover({ ...o, id: o._id }, key) : advance(key, i))}
                  className="w-full text-left rounded-xl2 border border-white/10 bg-white/[0.04] p-3 hover:border-g-gold/40 hover:-translate-y-0.5 transition-all disabled:opacity-50">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-g-word">{o.id}</span>
                    <span className="text-g-muted">{o.plataforma || o.t}</span>
                  </div>
                  <div className="text-[11px] text-g-muted mt-0.5">{o.itens || o.items}</div>
                  {o.total > 0 && <div className="text-[11px] font-bold text-g-word mt-0.5">${Number(o.total).toFixed(2)}</div>}
                  <div className="text-[10px] font-bold mt-1.5" style={{ color: c }}>
                    {movendo === o._id ? "…" : key === "ready" ? tr("Tap to complete ✓") : tr("Tap to advance →")}
                  </div>
                </button>
              ))}
              {lista.length === 0 && <div className="text-[11px] text-g-muted text-center py-4">— {tr("empty")} —</div>}
            </div></>); })()}
          </Card>
        ))}
      </div>
    </div>
    </>
  );
}

export default Kitchen;
