/* Split out of Portal.jsx (performance): MenuView tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { toast, fetchCatalogo } from "../lib/portalApi.js";
import { Card, Drawer, tr , FaixaAmostra} from "../pages/Portal.jsx";

function MenuView({ V, real, email, dataKey }) {
  // ── O CARDÁPIO DE VERDADE (2026-08-20) ────────────────────────────────────────────────────
  // Mesma fonte do Catálogo (`biz_services`) — é o cardápio que a Gui lê para cotar ao telefone.
  // 🚨 ESTOQUE NÃO É INVENTADO. O banco guarda serviço e preço, não estoque; então em modo real a
  // coluna de estoque não desenha. Mostrar "Em estoque" sobre um dado que ninguém mediu é a mesma
  // mentira que a tela inteira estava cometendo, só que menor e mais difícil de achar.
  const [menu, setMenu] = useState({ estado: "carregando", dados: null, motivo: null });
  useEffect(() => {
    let vivo = true;
    if (!real || !email || !dataKey) { setMenu({ estado: "amostra", dados: null, motivo: null }); return () => { vivo = false; }; }
    fetchCatalogo(email, dataKey).then((r) => { if (vivo) setMenu({ estado: r.dados ? "ok" : "err", dados: r.dados, motivo: r.motivo }); });
    return () => { vivo = false; };
  }, [real, email, dataKey]);
  const reais = menu.estado === "ok" && Array.isArray(menu.dados) ? menu.dados : null;

  const sc = (s) => s === "Out" ? "#EF4444" : s === "Low" ? "#D6C29A" : "#3E9468";
  const [ov, setOv] = useState({});           // local stock overrides (restock actions)
  const [sel, setSel] = useState(null);
  const stockOf = (i, m) => ov[i] || m.stock;
  const setStock = (i, s, name) => { setOv((o) => ({ ...o, [i]: s })); setSel(null); toast(`${name} → ${s === "In stock" ? "restocked ✓" : s.toLowerCase()}`); };
  return (
    <>
      <FaixaAmostra real={real && !reais} />
      {menu.estado === "err" && (
        <div className="mb-3 rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 text-[12px] text-[#e0855f]">
          {tr("Couldn't read your catalog")} — {menu.motivo}
        </div>
      )}
      {reais && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-g-gold">{tr("Your catalog")}</span>
            <span className="text-[11px] tabular-nums text-g-muted">{reais.length}</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {reais.map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-g-word">{it.nome}</div>
                  <div className="text-[11px] text-g-muted">{it.minutos ? `${it.minutos} min` : ""}{!it.ativo ? ` · ${tr("inactive")}` : ""}</div>
                </div>
                <span className="text-[13px] font-extrabold tabular-nums" style={it.preco == null ? { color: "#8A8578" } : undefined}>
                  {it.preco == null ? tr("no price") : `$${Number(it.preco).toFixed(2)}`}
                </span>
              </div>
            ))}
            {reais.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-g-muted">{tr("Nothing in your catalog yet.")}</div>}
          </div>
        </div>
      )}
      {/* 🚨 A AMOSTRA NÃO CONVIVE COM O REAL (2026-08-25). Esta grade de cartões inventados
          desenhava LOGO ABAIXO do catálogo verdadeiro: o dono via os seus 23 serviços e, na
          sequência, itens que ele nunca cadastrou com estoque que ninguém mediu — sem nenhuma
          marca separando os dois. Meia-verdade na mesma tela é pior que amostra declarada.
          Em modo real a grade não existe; em demo, nada muda. */}
      <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 ${reais ? "hidden" : ""}`}>
      {(reais ? [] : (V.menu || [])).map((m, i) => {
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
    </>
  );
}

export default MenuView;
