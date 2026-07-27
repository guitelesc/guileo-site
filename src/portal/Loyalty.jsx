/* Split out of Portal.jsx (performance): Loyalty tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { FaGift, FaUserPlus } from "react-icons/fa6";
import { portalApi, toast } from "../lib/portalApi.js";
import { loyaltyCfg, genLoyaltyMembers, genReferrals, logImpact, loadCreated, pushCreated, createdKey, Card, Toggle, MiniStats, vnum, tr } from "../pages/Portal.jsx";

// Loyalty & referrals — recurring engagement + word-of-mouth growth. Rewards and
// converted referrals feed the Guileo Impact ledger (real growth Guileo drove).
function Loyalty({ V }) {
  const cfg = loyaltyCfg(V);
  const members = genLoyaltyMembers(V);
  const refs = genReferrals(V);
  const [on, setOn] = useState(() => portalApi.loadState(`${V.label}:loyalty`, true));
  useEffect(() => { setOn(portalApi.loadState(`${V.label}:loyalty`, true)); }, [V.label]);
  const flip = () => setOn((o) => { const v = !o; portalApi.saveState(`${V.label}:loyalty`, v); toast(`Loyalty program ${v ? "on ✓" : "off"}`); return v; });
  const [joined, setJoined] = useState([]); // referrals marked joined this session
  const reward = (m) => { logImpact(V.label, `${m.name} redeemed ${cfg.reward}`, 14); toast(`Reward sent to ${m.name} ✓ — logged to Guileo Impact`); };
  const convert = (r, i) => { setJoined((j) => [...j, i]); logImpact(V.label, `Referral from ${r.name} joined`, r.reward * 6); toast(`Referral converted ✓ — $${r.reward * 6} new-customer value logged to Guileo Impact`); };
  const copyLink = () => { try { navigator.clipboard?.writeText(`https://refer.guileoai.com/${V.label.toLowerCase().replace(/\W+/g, "")}`); } catch { /* blocked */ } toast("Referral link copied ✓"); };
  const tierColor = (t) => (t === "Gold" ? "#C2A878" : t === "Silver" ? "#9ca3af" : "#B0764A");
  const [cards, setCards] = useState(() => loadCreated(V.label, "giftcards"));
  useEffect(() => { setCards(loadCreated(V.label, "giftcards")); }, [V.label]);
  const sellGift = (amt) => { pushCreated(V.label, "giftcards", { code: `GC-${1000 + (Date.now() % 9000)}`, balance: amt, original: amt }); setCards(loadCreated(V.label, "giftcards")); logImpact(V.label, `Gift card sold ($${amt})`, amt); toast(`$${amt} gift card sold ✓ — logged to Guileo Impact`); };
  const redeem = (code, amt) => { const next = cards.map((c) => (c.code === code ? { ...c, balance: Math.max(0, c.balance - amt) } : c)); portalApi.saveState(createdKey(V.label, "giftcards"), next); setCards(next); toast(`$${amt} redeemed from ${code} ✓`); };
  const liveBalance = cards.reduce((s, c) => s + (c.balance || 0), 0);

  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word flex items-center gap-2"><FaGift className="text-g-gold" /> Loyalty & referrals</div><div className="text-xs text-g-muted mt-0.5">Earn rule: {cfg.earn} · Reward: {cfg.reward}. Your AI enrolls, reminds and rewards automatically.</div></div>
          <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-g-muted">{on ? "Active" : "Off"}</span><Toggle on={on} onClick={flip} /></div>
        </div>
      </Card>

      <MiniStats items={[["Members", `${members.length * 86}`], [`${cfg.unit} outstanding`, vnum(V.label, "ptsout", 4000, 24000).toLocaleString()], ["Redemptions", `${vnum(V.label, "redeem", 12, 60)}`, "good"], ["Referral revenue", `$${vnum(V.label, "refrev", 600, 3400).toLocaleString()}`, "good"]]} />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Loyalty members */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Top members")}</div>
          <div className="divide-y divide-white/[0.06]">
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{m.name[0]}</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{m.name}<span className="text-[9px] font-black uppercase rounded px-1.5 py-0.5" style={{ background: tierColor(m.tier) + "22", color: tierColor(m.tier) }}>{m.tier}</span></div><div className="text-[11px] text-g-muted">{m.pts.toLocaleString()} {cfg.unit}</div></div>
                <button onClick={() => reward(m)} className="text-[11px] font-bold rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-3 py-1.5 text-g-gold hover:bg-g-gold/[0.16] transition">{tr("🎁 Reward")}</button>
              </div>
            ))}
          </div>
        </Card>

        {/* Referrals */}
        <Card className="p-0 overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2"><FaUserPlus size={11} /> Referrals</div>
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 rounded-xl2 border border-white/15 bg-black/20 px-3 py-2">
              <span className="flex-1 min-w-0 text-[11px] text-g-muted truncate">refer.guileoai.com/{V.label.toLowerCase().replace(/\W+/g, "")}</span>
              <button onClick={copyLink} className="text-[11px] font-bold text-g-gold hover:text-g-word transition shrink-0">{tr("Copy link")}</button>
            </div>
            <div className="mt-1.5 text-[10px] text-g-muted">Each friend who joins earns both sides {cfg.reward}.</div>
          </div>
          <div className="divide-y divide-white/[0.06] flex-1">
            {refs.map((r, i) => {
              const isJoined = r.status === "Joined" || joined.includes(i);
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-base">{isJoined ? "🎉" : "✉️"}</span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{r.name}</div><div className="text-[11px] text-g-muted truncate">{isJoined ? "referred a friend who joined" : r.note}</div></div>
                  {isJoined
                    ? <span className="text-[10px] font-black uppercase text-g-green">{tr("Joined")}</span>
                    : <button onClick={() => convert(r, i)} className="text-[11px] font-bold rounded-full border border-g-green/40 bg-g-green/[0.1] px-2.5 py-1 text-g-green hover:bg-g-green/20 transition">{tr("Mark joined")}</button>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Gift cards — instant prepaid revenue, sold by the AI on chat/checkout */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2"><FaGift size={11} /> Gift cards</div>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Active balance", `$${(vnum(V.label, "giftbal", 800, 5200) + liveBalance).toLocaleString()}`], ["Sold this month", `${vnum(V.label, "giftsold", 8, 40) + cards.length}`], ["Cards live", `${cards.length}`]].map(([l, v]) => (
              <div key={l} className="rounded-xl2 border border-white/10 bg-white/[0.03] px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-g-muted">{l}</div><div className="text-base font-extrabold text-g-word mt-0.5">{v}</div></div>
            ))}
          </div>
          <div className="flex-1 min-w-[180px]">
            <div className="text-[11px] text-g-muted mb-1.5">{tr("Sell a gift card — the AI delivers it instantly on WhatsApp or at checkout.")}</div>
            <div className="flex flex-wrap gap-2">{[25, 50, 100].map((amt) => (<button key={amt} onClick={() => sellGift(amt)} className="text-sm font-bold rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-4 py-1.5 text-g-gold hover:bg-g-gold/[0.16] transition">Sell ${amt}</button>))}</div>
          </div>
        </div>
        {cards.length > 0 && (
          <div className="border-t border-white/[0.06] divide-y divide-white/[0.05]">
            {cards.map((c) => (
              <div key={c.code} className="flex items-center gap-3 px-5 py-2.5">
                <span className="font-mono text-[11px] text-g-muted">{c.code}</span>
                <div className="flex-1 min-w-0"><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-gold to-g-green" style={{ width: `${(c.balance / c.original) * 100}%` }} /></div></div>
                <span className="text-xs font-bold text-g-word whitespace-nowrap">${c.balance} <span className="text-g-muted font-normal">/ ${c.original}</span></span>
                <button disabled={c.balance <= 0} onClick={() => redeem(c.code, Math.min(c.balance, 10))} className="text-[11px] font-bold rounded-full border border-white/15 px-2.5 py-1 text-g-word hover:border-g-gold/40 disabled:opacity-30 transition">Redeem $10</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default Loyalty;
