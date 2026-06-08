import { useState } from "react";
import { waLink } from "../data/contact";
import logo from "../assets/guileo-mark.png";

// /calculator — "Missed-Revenue Calculator" ad lead-magnet. Move 2 sliders → see $/month
// you're losing to missed calls/leads → capture lead. Posts to /api/lead (→ /admin + /live).

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

export default function Calculator() {
  const [missed, setMissed] = useState(10);   // calls/messages missed per week
  const [value, setValue] = useState(300);     // avg value of a customer/job
  const [lead, setLead] = useState({ name: "", contact: "" });
  const [sent, setSent] = useState(false);

  const CONVERT = 0.35; // a third of missed contacts would've converted
  const monthly = missed * 4.3 * CONVERT * value;
  const yearly = monthly * 12;

  async function submit(e) {
    e.preventDefault();
    if (!lead.name || !lead.contact) return;
    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lead, leak: money(monthly), message: `Missed-revenue calc: ${missed}/wk × ${money(value)} → ${money(monthly)}/mo`, source: "calc-missed-revenue" }) }); } catch { /* graceful */ }
    setSent(true);
  }

  return (
    <div className="min-h-screen text-g-word">
      <style>{`@keyframes cfade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes cshine{to{background-position:220% center}}
        input[type=range]{-webkit-appearance:none;height:6px;border-radius:99px;background:#2B2720;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;height:22px;width:22px;border-radius:99px;background:#3E9468;cursor:pointer;box-shadow:0 0 0 4px rgba(62,148,104,.2)}`}</style>
      <div className="flex items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="font-black">Guileo</span></a>
        <span className="text-[11px] font-bold uppercase tracking-wider text-g-muted">Missed-Revenue Calculator</span>
      </div>

      <div className="mx-auto max-w-xl px-5 py-12" style={{ animation: "cfade .5s ease both" }}>
        <div className="text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">Free · 20 seconds</div>
          <h1 className="mt-3 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,5.5vw,3rem)" }}>
            <span className="text-g-word">How much are missed calls </span>
            <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "cshine 7s linear infinite" }}>costing you?</span>
          </h1>
        </div>

        <div className="mt-8 space-y-7 rounded-2xl border border-g-line bg-white/[0.04] p-6 sm:p-8">
          <div>
            <div className="flex items-baseline justify-between"><label className="text-[14px] font-semibold text-g-ink">Calls & messages missed / week</label><span className="text-[20px] font-black text-g-word">{missed}</span></div>
            <input type="range" min="1" max="80" value={missed} onChange={(e) => setMissed(+e.target.value)} className="mt-3 w-full" />
          </div>
          <div>
            <div className="flex items-baseline justify-between"><label className="text-[14px] font-semibold text-g-ink">Avg. value of a customer / job</label><span className="text-[20px] font-black text-g-word">{money(value)}</span></div>
            <input type="range" min="50" max="5000" step="50" value={value} onChange={(e) => setValue(+e.target.value)} className="mt-3 w-full" />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#d8916e]/30 bg-[#d8916e]/[0.06] p-6 text-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8916e]">You're losing about</div>
          <div className="mt-1 text-[46px] font-black leading-none text-[#e0855f] sm:text-[56px]">{money(monthly)}<span className="text-[20px]">/mo</span></div>
          <div className="mt-1 text-[13px] text-g-muted">that's <span className="font-semibold text-g-word">{money(yearly)}/year</span> walking out the door.</div>
        </div>

        {sent ? (
          <div className="mt-6 rounded-2xl border border-g-green/30 bg-g-green/[0.07] p-6 text-center">
            <div className="text-3xl">🌱</div>
            <div className="mt-2 text-[17px] font-bold text-g-word">On it, {lead.name.split(" ")[0]}!</div>
            <p className="mt-1 text-[13.5px] text-g-ink">A real human will show you exactly how Gui recovers this — usually within hours.</p>
            <a href={waLink("Hi Guileo! I used the missed-revenue calculator.")} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px] font-bold text-g-green">Message us now on WhatsApp →</a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-g-line bg-white/[0.04] p-6">
            <div className="text-center text-[15px] font-bold text-g-word">Recover this with Gui — get your free plan</div>
            <input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} required placeholder="Your name" className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <input value={lead.contact} onChange={(e) => setLead({ ...lead, contact: e.target.value })} required placeholder="WhatsApp, phone or email" className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110">Stop the leak →</button>
            <p className="text-center text-[11px] text-g-muted">No spam · Live in under 7 days · 30-day money-back.</p>
          </form>
        )}
      </div>
    </div>
  );
}
