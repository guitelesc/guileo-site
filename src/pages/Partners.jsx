import { useState } from "react";
import { waLink } from "../data/contact";
import logo from "../assets/guileo-mark.png";

// /partners — "Partner Earnings" lead-magnet for agencies/resellers. Move 2 sliders →
// projected monthly recurring revenue reselling Guileo white-label → capture partner lead.

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

export default function Partners() {
  const [clients, setClients] = useState(5);   // clients you sign / month
  const [price, setPrice] = useState(800);      // avg monthly price you charge
  const [lead, setLead] = useState({ name: "", contact: "" });
  const [sent, setSent] = useState(false);

  const MARGIN = 0.6; // you keep ~60% after Guileo build/run
  const mrr = clients * price * MARGIN;          // added each month
  const year1 = mrr * 12 * 0.5 + mrr;            // rough compounding feel over a year

  async function submit(e) {
    e.preventDefault();
    if (!lead.name || !lead.contact) return;
    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lead, industry: "Agency / Reseller", message: `PARTNER · ${clients} clients/mo × ${money(price)} → ~${money(mrr)} MRR added/mo`, source: "partner-earnings" }) }); } catch { /* graceful */ }
    setSent(true);
  }

  return (
    <div className="min-h-screen text-g-word">
      <style>{`@keyframes pfade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes pshine{to{background-position:220% center}}
        input[type=range]{-webkit-appearance:none;height:6px;border-radius:99px;background:#2B2720;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;height:22px;width:22px;border-radius:99px;background:#D6C29A;cursor:pointer;box-shadow:0 0 0 4px rgba(214,194,154,.2)}`}</style>
      <div className="flex items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="font-black">Guileo</span></a>
        <span className="text-[11px] font-bold uppercase tracking-wider text-g-muted">Partner Program 🤝</span>
      </div>

      <div className="mx-auto max-w-xl px-5 py-12" style={{ animation: "pfade .5s ease both" }}>
        <div className="text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">For agencies & resellers</div>
          <h1 className="mt-3 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,5.5vw,3rem)" }}>
            <span className="text-g-word">How much could you earn </span>
            <span className="bg-gradient-to-r from-g-gold via-g-copper to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "pshine 7s linear infinite" }}>reselling AI?</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] text-g-ink">We build &amp; run it white-label. You own the client and the revenue.</p>
        </div>

        <div className="mt-8 space-y-7 rounded-2xl border border-g-line bg-white/[0.04] p-6 sm:p-8">
          <div>
            <div className="flex items-baseline justify-between"><label className="text-[14px] font-semibold text-g-ink">Clients you sign / month</label><span className="text-[20px] font-black text-g-word">{clients}</span></div>
            <input type="range" min="1" max="40" value={clients} onChange={(e) => setClients(+e.target.value)} className="mt-3 w-full" />
          </div>
          <div>
            <div className="flex items-baseline justify-between"><label className="text-[14px] font-semibold text-g-ink">Avg. monthly price you charge</label><span className="text-[20px] font-black text-g-word">{money(price)}</span></div>
            <input type="range" min="200" max="5000" step="100" value={price} onChange={(e) => setPrice(+e.target.value)} className="mt-3 w-full" />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-g-gold/30 bg-g-gold/[0.07] p-6 text-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">Recurring revenue you add — every month</div>
          <div className="mt-1 text-[46px] font-black leading-none sm:text-[56px]"><span className="bg-gradient-to-r from-g-gold to-g-copper bg-clip-text text-transparent">{money(mrr)}<span className="text-[20px]">/mo</span></span></div>
          <div className="mt-1 text-[13px] text-g-muted">and it stacks — no team, no code, no overhead.</div>
        </div>

        {sent ? (
          <div className="mt-6 rounded-2xl border border-g-gold/40 bg-g-gold/[0.08] p-6 text-center">
            <div className="text-3xl">🤝</div>
            <div className="mt-2 text-[17px] font-bold text-g-word">Welcome aboard, {lead.name.split(" ")[0]}!</div>
            <p className="mt-1 text-[13.5px] text-g-ink">We'll send your partner terms shortly — white-label deck, pricing & onboarding.</p>
            <a href={waLink("Hi Guileo! I'm interested in the Partner Program.")} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px] font-bold text-g-gold">Message us on WhatsApp →</a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-g-line bg-white/[0.04] p-6">
            <div className="text-center text-[15px] font-bold text-g-word">Get partner terms</div>
            <input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} required placeholder="Your name / agency" className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-gold/50 focus:outline-none" />
            <input value={lead.contact} onChange={(e) => setLead({ ...lead, contact: e.target.value })} required placeholder="WhatsApp, phone or email" className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-gold/50 focus:outline-none" />
            <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-g-gold to-g-copper px-5 py-3.5 text-[15px] font-bold text-g-deep shadow-[0_18px_50px_-14px_rgba(214,194,154,0.5)] transition hover:brightness-110">Become a partner →</button>
            <p className="text-center text-[11px] text-g-muted">White-label · we build & run · you own the client.</p>
          </form>
        )}
      </div>
    </div>
  );
}
