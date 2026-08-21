/* Split out of Portal.jsx (performance): LiveOrders tab view — code moved verbatim. */
import { useState } from "react";
import { toast } from "../lib/portalApi.js";
import { waTo } from "../data/contact.js";
import { loadCreated, Card, tr, Drawer, logImpact , FaixaAmostra} from "../pages/Portal.jsx";

function LiveOrders({ V, real }) {
  // ── OS PEDIDOS DE VERDADE (2026-08-20) ────────────────────────────────────────────────────
  // O webhook de entregas (`functions/api/delivery-webhook.js`) grava cada pedido do Uber Eats /
  // DoorDash / iFood como um evento `type:"order"` — e o cockpit JÁ carrega os eventos no `real`.
  // O dado estava a um filtro de distância e a tela desenhava pedidos inventados por cima dele.
  // Não precisou de RPC nova: precisou parar de ignorar o que já chegava.
  // 🚨 O VALOR VEM DO CAMPO `amount`, NÃO DO TEXTO. O resumo tem "($42.5)" escrito dentro, e
  // raspar número de frase é como o "$118 de outro serviço" nasceu neste repositório. `amount` é
  // o campo que o webhook preencheu; a frase é para o humano ler.
  const pedidosReais = real && Array.isArray(real.events)
    ? real.events.filter((e) => e && e.type === "order").map((e, i) => ({
        id: (e.payload?.ref || `#${i + 1}`).toString().slice(0, 12),
        customer: e.payload?.customer || tr("Customer"),
        // o resumo traz "🛵 DoorDash order ($42.5): 1× Family Combo" — o que interessa aqui é o
        // que vem DEPOIS dos dois pontos; sem isso, repetiríamos plataforma e preço na linha.
        items: (String(e.summary || "").split(":").slice(1).join(":").trim()) || String(e.summary || ""),
        channel: e.channel || e.payload?.platform || "",
        total: Number(e.amount) || 0,
        status: tr("Received"), color: "#3E9468",
        real: true,
      }))
    : null;
  const rows = pedidosReais || [...loadCreated(V.label, "liveorders"), ...(V.liveOrders || [])];
  const [sel, setSel] = useState(null);
  return (
    <>
      <FaixaAmostra real={real && !pedidosReais} />
      {pedidosReais && pedidosReais.length === 0 && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-g-muted">
          {tr("No delivery orders yet. As soon as a platform sends one, it lands here.")}
        </div>
      )}
      <>
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Live orders")}</span><span className="text-[11px] text-g-muted inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{rows.length} active</span></div>
      <div className="divide-y divide-white/[0.06]">
        {rows.map((o, i) => (
          <button key={i} onClick={() => setSel(o)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
            <span className="text-xs font-bold text-g-light w-16 shrink-0">{o.id}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{o.customer}{o.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("from chat")}</span>}</div><div className="text-[11px] text-g-muted truncate">{o.items} · {o.channel}</div></div>
            <span className="text-sm font-extrabold text-g-word">${o.total.toFixed(2)}</span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: o.color + "22", color: o.color }}>{o.status}</span>
          </button>
        ))}
      </div>
    </Card>
    {sel && (
      <Drawer
        title={`${sel.id} · ${sel.customer}`}
        subtitle={sel.items}
        badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: sel.color + "22", color: sel.color }}>{sel.status}</span>}
        fields={[["Items", sel.items], ["Total", `$${sel.total.toFixed(2)}`], ["Channel", sel.channel], ["Status", sel.status]]}
        note={`Taken by your AI via ${sel.channel}. Customer notified automatically with ETA + confirmation.`}
        actions={<><button onClick={() => { logImpact(V.label, `${sel.id} fulfilled — taken by your AI`, Math.max(18, Math.round(sel.total) || 22)); toast(`${sel.id} marked ready ✓ — logged to Guileo Impact`); setSel(null); }} className="btn-bright text-sm">✓ Mark ready</button><a href={waTo(sel.phone, `Hi ${sel.customer}, about order ${sel.id}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">{tr("💬 Message")}</a></>}
        onClose={() => setSel(null)}
      />
    )}
    </>
    </>
  );
}

export default LiveOrders;
