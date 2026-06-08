import { useState } from "react";
import { waLink } from "../data/contact";

// ProofV2 — TEST (/v2): trust + compliance, matched from guileoai.com. Compliance badges,
// "a real founder runs it with you", security, and a live "Gui calls you back" widget.
// Guileo design system + smooth CSS motion.

const BADGES = ["HIPAA", "GDPR", "LGPD", "CCPA", "PCI DSS"];

export default function ProofV2() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("idle"); // idle | calling | done

  async function callMe(e) {
    e.preventDefault();
    if (!phone.trim()) return;
    setStatus("calling");
    try { await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, source: "v2-callme" }) }); } catch { /* graceful */ }
    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Call-me request", phone, contact: phone, channel: "Phone", source: "v2-callme" }) }); } catch { /* graceful */ }
    setStatus("done");
  }

  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`@keyframes pvreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes pvpulse{0%,100%{opacity:.5}50%{opacity:1}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "pvreveal .7s ease both" }}>Built to be trusted</div>

        {/* compliance badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5" style={{ animation: "pvreveal .8s ease .1s both" }}>
          {BADGES.map((b) => (
            <div key={b} className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-4 py-2">
              <span className="text-base">🛡️</span>
              <span className="text-[13px] font-bold text-g-word">{b}</span>
              <span className="text-g-green">✓</span>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "pvreveal .8s ease .2s both" }}>
          We build to these standards <span className="font-semibold text-g-word">from day one</span> — your stack, your data, your customers, <span className="font-semibold text-g-green">fully governed</span>.
        </p>
      </div>

      {/* trust cards */}
      <div className="mx-auto mt-10 grid max-w-4xl gap-3 md:grid-cols-2" style={{ animation: "pvreveal .8s ease .3s both" }}>
        <div className="rounded-2xl border border-g-line bg-white/[0.04] p-6">
          <div className="text-2xl">🤝</div>
          <div className="mt-3 text-[16px] font-bold text-g-word">A real founder runs it with you</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-g-ink">Not a bot, not a ticket queue. A human who knows your business — building & optimizing alongside you.</p>
        </div>
        <div className="rounded-2xl border border-g-line bg-white/[0.04] p-6">
          <div className="text-2xl">🔒</div>
          <div className="mt-3 text-[16px] font-bold text-g-word">Your data stays yours</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-g-ink">Multi-tenant isolation, encryption in transit &amp; at rest, 3-tier consent — every Gui action logged &amp; reviewable.</p>
        </div>
      </div>

      {/* live: Gui calls you back */}
      <div className="mx-auto mt-10 max-w-xl rounded-[1.75rem] border border-g-green/30 bg-gradient-to-b from-g-green/[0.08] to-white/[0.03] p-7 text-center backdrop-blur-sm" style={{ animation: "pvreveal .8s ease .4s both" }}>
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-g-green">
          <span className="h-1.5 w-1.5 rounded-full bg-g-green" style={{ animation: "pvpulse 1.6s ease-in-out infinite" }} /> Live
        </div>
        <div className="mt-2 text-[18px] font-bold text-g-word">Hear it for yourself.</div>
        <p className="mt-1 text-[13.5px] text-g-ink">Leave your number and <span className="font-semibold text-g-green">Gui calls you back</span> — talk to the real AI right now.</p>
        {status === "done" ? (
          <div className="mt-5">
            <div className="text-2xl">📞</div>
            <div className="mt-1 text-[15px] font-bold text-g-word">You're in the queue — Gui will ring you shortly.</div>
            <a href={waLink("Hi Guileo! I asked Gui to call me.")} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px] font-bold text-g-green">Or message us on WhatsApp →</a>
          </div>
        ) : (
          <form onSubmit={callMe} className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="Your phone / WhatsApp" className="flex-1 rounded-xl border border-g-line bg-white/[0.06] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <button type="submit" disabled={status === "calling"} className="rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3 text-[14px] font-bold text-white shadow-[0_14px_40px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110 disabled:opacity-60">
              {status === "calling" ? "Connecting…" : "📞 Have Gui call me"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
