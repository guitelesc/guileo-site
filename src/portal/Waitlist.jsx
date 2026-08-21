/* Split out of Portal.jsx (performance): Waitlist tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { portalApi, toast, fetchFilaEspera } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { genWaitlist, convoAction, pushCreated, MiniStats, vnum, Card, tr, Drawer , FaixaAmostra} from "../pages/Portal.jsx";

function Waitlist({ V, real, email, dataKey }) {
  // ── A FILA DE ESPERA DE VERDADE (2026-08-20) ──────────────────────────────────────────────
  // `biz_waitlist` já tinha motor de ENTRADA (`biz_waitlist_add`, que a Gui chama quando o
  // horário pedido está cheio) e nenhuma leitura — então a tela desenhava uma fila inventada
  // enquanto a real ficava invisível. Fila de espera com nome falso é pior que fila vazia: o dono
  // liga para alguém que nunca pediu nada.
  // 🚨 Fila real VAZIA é resultado legítimo, e a tela diz isso — não cai na amostra por estar sem
  // ninguém. Só a FALHA de leitura mantém a amostra, e ela vem declarada.
  const [fila, setFila] = useState({ estado: "carregando", dados: null, motivo: null });
  useEffect(() => {
    let vivo = true;
    if (!real || !email || !dataKey) { setFila({ estado: "amostra", dados: null, motivo: null }); return () => { vivo = false; }; }
    fetchFilaEspera(email, dataKey).then((r) => { if (vivo) setFila({ estado: r.dados ? "ok" : "err", dados: r.dados, motivo: r.motivo }); });
    return () => { vivo = false; };
  }, [real, email, dataKey]);

  const reais = fila.estado === "ok" && Array.isArray(fila.dados)
    ? fila.dados.map((w) => ({ name: w.nome || w.contato || tr("Customer"), want: w.servico || "", ch: "WhatsApp", when: w.quando, contact: w.contato || "", real: true }))
    : null;
  const rows = reais || genWaitlist(V);
  const [filled, setFilled] = useState(() => portalApi.loadState(`${V.label}:wait`, []));
  const [sel, setSel] = useState(null);
  useEffect(() => { setFilled(portalApi.loadState(`${V.label}:wait`, [])); }, [V.label]);
  const open = rows.map((r, i) => ({ r, i })).filter(({ i }) => !filled.includes(i));
  // Restaurants book into Live Orders flow; appointment/field sectors have a Schedule.
  const bookView = convoAction(V).view; // "schedule" for most, "liveorders" for restaurant
  const offer = (i, name, want) => {
    setFilled((f) => { const n = [...f, i]; portalApi.saveState(`${V.label}:wait`, n); return n; });
    // Stitch: an accepted waitlist offer becomes a pending booking/reservation in its tab.
    if (bookView === "schedule") {
      pushCreated(V.label, "schedule", { time: "Offered", name, meta: `Waitlist · ${want || "open slot"}`, status: "Pending", ch: "WhatsApp", color: "#D6C29A" });
      setSel(null); toast(`Done — I've offered ${name} the slot. It's holding on your schedule until they confirm.`);
    } else {
      pushCreated(V.label, "liveorders", { id: `#${1000 + (Date.now() % 9000)}`, customer: name, items: `Reservation · ${want || "table"}`, total: 0, channel: "WhatsApp", status: "New", color: "#3E9468" });
      setSel(null); toast(`Done — I've offered ${name} the slot and added the reservation.`);
    }
  };
  return (
    <>
      <FaixaAmostra real={real && !reais} />
      {fila.estado === "err" && (
        <div className="mb-3 rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 text-[12px] text-[#e0855f]">
          {tr("Couldn't read your waitlist")} — {fila.motivo}
        </div>
      )}
      {reais && reais.length === 0 && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-g-muted">
          {tr("Nobody waiting right now. When Gui hits a full slot, whoever asks goes on this list automatically.")}
        </div>
      )}
      <div className="space-y-4 stagger">
      <MiniStats items={[["Waiting now", `${open.length}`], ["Filled today", `${vnum(V.label, "filled", 5, 16)}`, "good"], ["No-shows saved", `${vnum(V.label, "noshow", 3, 11)}`, "good"], ["Revenue recovered", `$${vnum(V.label, "wrev", 800, 2600).toLocaleString()}`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Waitlist · turn empty slots into revenue")}</div>
        <div className="divide-y divide-white/[0.06]">
          {open.map(({ r, i }) => (
            <button key={i} onClick={() => setSel({ r, i })} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <span className="relative grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{r.name[0]}<span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full" style={{ background: "#FFC23D", boxShadow: "0 0 7px rgba(255,194,61,.6)" }} /></span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted">{r.want} · via {r.ch} · {r.since}</div></div>
              <span onClick={(e) => { e.stopPropagation(); offer(i, r.name, r.want); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); offer(i, r.name, r.want); } }} role="button" tabIndex={0} className="btn-bright text-xs px-3 shrink-0">{tr("Offer slot")}</span>
            </button>
          ))}
          {open.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">{tr("No one waiting — every seat is full. I'll text the moment a slot opens. 🎉")}</div>}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.r.name}
          subtitle={`Wants: ${sel.r.want}`}
          fields={[["Looking for", sel.r.want], ["Channel", sel.r.ch], ["Waiting", sel.r.since]]}
          note={`The AI will text ${sel.r.name} the instant a matching slot frees up — first to reply keeps it. No empty chairs, no manual calls.`}
          actions={<><button onClick={() => offer(sel.i, sel.r.name, sel.r.want)} className="btn-bright text-sm">{tr("Offer next open slot")}</button><a href={waLink(`Hi ${sel.r.name}, a slot just opened for ${sel.r.want}…`)} target="_blank" rel="noopener" className="btn-ghost text-sm">{tr("💬 Message")}</a></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
    </>
  );
}

export default Waitlist;
