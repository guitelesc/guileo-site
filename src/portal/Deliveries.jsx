/* Split out of Portal.jsx (performance): Deliveries tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { FaTruck, FaCircleCheck, FaLocationDot } from "react-icons/fa6";
import { portalApi, toast } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { deliveryCfg, loadCreated, genDeliveries, vnum, Card, tr, MiniStats, Toggle, Empty, Drawer, logImpact, FaixaAmostra } from "../pages/Portal.jsx";

// Delivery & dispatch — third-party platforms (Uber Eats/DoorDash/Grubhub, carriers)
// + Guileo's own delivery, unified. Connections persist; every drop is trackable.
// `real`: esta tela é 100% gerada (genDeliveries) e era a ÚNICA sem FaixaAmostra e sem portão
// de modo real — um restaurante pagante via entregas com nome e horário que nunca existiram.
// Ela some do menu em modo real (ocultaAmostra no Portal.jsx) e, se alguém chegar por ⌘K/link,
// a faixa diz a verdade em cima.
function Deliveries({ V, real = null }) {
  const cfg = deliveryCfg(V);
  const rows = [...loadCreated(V.label, "deliveries"), ...genDeliveries(V)];
  const active = rows.filter((r) => r.status !== "Delivered");
  // Connection state persists (feels like a real integration toggle). Seed: first
  // two partners connected, rest off — so both states are visible.
  const [conn, setConn] = useState(() => portalApi.loadState(`${V.label}:integrations`, Object.fromEntries(cfg.partners.map(([n], i) => [n, i < 2]))));
  useEffect(() => { setConn(portalApi.loadState(`${V.label}:integrations`, Object.fromEntries(cfg.partners.map(([n], i) => [n, i < 2])))); }, [V.label]);
  const toggle = (name) => setConn((c) => { const n = { ...c, [name]: !c[name] }; portalApi.saveState(`${V.label}:integrations`, n); toast(`${name} ${n[name] ? "connected ✓" : "disconnected"}`); return n; });
  const [ownOn, setOwnOn] = useState(() => portalApi.loadState(`${V.label}:owndelivery`, true));
  const flipOwn = () => setOwnOn((o) => { const v = !o; portalApi.saveState(`${V.label}:owndelivery`, v); toast(`${cfg.own[0]} ${v ? "on ✓" : "off"}`); return v; });
  const [sel, setSel] = useState(null);
  const onTime = vnum(V.label, "ontime", 92, 99);

  return (
    <div className="space-y-4 stagger">
      <FaixaAmostra real={real} />
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaTruck className="text-g-green" /> {cfg.title}</div><div className="text-xs text-g-muted mt-0.5">{cfg.partners.length ? "Every order — third-party apps and your own delivery — in one place. " : "Dispatch and track every job in one place. "}Your AI texts customers live ETAs automatically.</div></div>
          <a href={waLink(`Hi Guileo! Help me set up ${cfg.title.toLowerCase()}`)} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("Set up with my team →")}</a>
        </div>
      </Card>

      <MiniStats items={[["Active now", `${active.length}`], ["On-time", `${onTime}%`, "good"], ["Avg. time", `${vnum(V.label, "deltime", 18, 42)} min`], [cfg.partners.length ? "Commission saved" : "Auto-dispatched", cfg.partners.length ? `$${vnum(V.label, "commsave", 400, 1800).toLocaleString()}` : `${vnum(V.label, "autodisp", 20, 70)}`, "good"]]} />

      {/* Integrations — connect the platforms */}
      {cfg.partners.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Connect your delivery platforms")}</div>
          <div className="divide-y divide-white/[0.06]">
            {cfg.partners.map(([name, ic, color]) => (
              <div key={name} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid place-items-center h-10 w-10 rounded-xl text-lg" style={{ background: color + "22" }}>{ic}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word">{name}</div>
                  <div className="text-[11px] text-g-muted">{conn[name] ? `Connected · ${vnum(V.label, name, 6, 28)} ${cfg.noun} today` : "Not connected"}</div>
                </div>
                {conn[name] && <span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1"><FaCircleCheck size={10} /> Live</span>}
                <Toggle on={!!conn[name]} onClick={() => toggle(name)} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Guileo's own delivery — the differentiator: 0% commission, owns the customer */}
      <Card className="border-g-gold/30 bg-g-gold/[0.05]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-g-gold/15 text-g-gold"><FaLocationDot /></span>
            <div><div className="text-sm font-extrabold text-g-word">{cfg.own[0]} <span className="text-[10px] font-black uppercase text-g-gold ml-1">{cfg.partners.length ? "0% commission" : "in-house"}</span></div><div className="text-xs text-g-muted">{cfg.own[1]}</div></div>
          </div>
          <Toggle on={ownOn} onClick={flipOwn} />
        </div>
      </Card>

      {/* Live deliveries / dispatch board */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">Live {cfg.noun} · tap to track</span><span className="text-[11px] text-g-muted">{active.length} in progress</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((r, i) => (
            <button key={i} onClick={() => setSel(r)} className="w-full text-left flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color: r.color }}><FaTruck size={13} /></span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{r.customer}{r.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("from chat")}</span>} <span className="text-g-muted font-normal">· {r.via}</span></div><div className="text-[11px] text-g-muted truncate">{r.who} · {r.addr}</div></div>
              <div className="text-right shrink-0"><div className="text-[11px] font-bold" style={{ color: r.color }}>{r.eta}</div><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: r.color + "22", color: r.color }}>{r.status}</span></div>
            </button>
          ))}
          {rows.length === 0 && <Empty icon="🛵" text={`${tr("Nothing on the move right now — I'm watching, and the moment one comes in it lands right here.")}`} />}
        </div>
      </Card>

      {sel && (
        <Drawer
          title={sel.customer}
          subtitle={`${sel.via} · ${sel.status}`}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: sel.color + "22", color: sel.color }}>{sel.eta}</span>}
          fields={[[cfg.who, sel.who], ["Channel", sel.via], ["Destination", sel.addr], ["ETA", sel.eta], ["Status", sel.status]]}
          note={`Your AI is texting ${sel.customer} live ${sel.status.toLowerCase()} updates — no “where's my order?” calls for you to answer.`}
          actions={<>
            <button onClick={() => { toast(`Live tracking link sent to ${sel.customer} ✓`); setSel(null); }} className="btn-bright text-sm">📍 Share tracking</button>
            <button onClick={() => { toast(`${sel.via}: ${cfg.who.toLowerCase()} reassigned`); setSel(null); }} className="btn-ghost text-sm">↻ Reassign</button>
            <button onClick={() => { logImpact(V.label, `Delivery to ${sel.customer} completed`, 16); toast(`${sel.customer} marked delivered ✓ — logged to Guileo Impact`); setSel(null); }} className="btn-ghost text-sm">✓ Mark delivered</button>
            {sel.status !== "Delivered" && <button onClick={() => { logImpact(V.label, `Saved ${sel.customer} with an apology coupon (late ${cfg.noun.replace(/s$/, "")})`, 12); toast(`Apology coupon sent to ${sel.customer} ✓ — retention logged to Guileo Impact`); setSel(null); }} className="btn-ghost text-sm">🎟️ Apology coupon</button>}
          </>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

export default Deliveries;
