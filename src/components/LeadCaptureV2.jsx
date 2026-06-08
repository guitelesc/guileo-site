import { useState } from "react";
import { waLink, bookLink } from "../data/contact";

// LeadCaptureV2 — TEST (/v2) close: "Stop losing customers. Start tonight."
// Multi-channel contact capture (the form Luis loves). Posts to /api/lead; a real human
// follows up. Guileo design system. id="contact" so CTAs across the page jump here.

const CH = [
  { k: "WhatsApp", icon: "💬", ph: "+1 (555) 000-0000" },
  { k: "Phone", icon: "📞", ph: "+1 (555) 000-0000" },
  { k: "Email", icon: "✉️", ph: "you@email.com" },
  { k: "Instagram", icon: "📸", ph: "@yourhandle" },
  { k: "Telegram", icon: "✈️", ph: "@yourhandle" },
  { k: "LinkedIn", icon: "💼", ph: "linkedin.com/in/you" },
  { k: "Messenger", icon: "📘", ph: "facebook.com/you" },
  { k: "X", icon: "✖️", ph: "@yourhandle" },
];

export default function LeadCaptureV2() {
  const [name, setName] = useState("");
  const [ch, setCh] = useState(0);
  const [val, setVal] = useState("");
  const [biz, setBiz] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !val.trim()) return;
    setStatus("sending");
    const c = CH[ch];
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, channel: c.k, contact: val, phone: /phone|whatsapp/i.test(c.k) ? val : "", email: c.k === "Email" ? val : "", business: biz, source: "v2-lead" }),
      });
    } catch { /* never block the user */ }
    setStatus("done");
  }

  return (
    <section id="contact" className="relative overflow-hidden bg-g-creamd px-5 py-24">
      <style>{`@keyframes lcreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes lcshine{to{background-position:220% center}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_400px_at_50%_0%,rgba(62,148,104,0.12),transparent)]" />

      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)" }}>
          <span className="text-g-word" style={{ animation: "lcreveal .8s cubic-bezier(.2,.7,.2,1) both" }}>Stop losing customers. </span>
          <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "lcreveal .8s cubic-bezier(.2,.7,.2,1) .15s both, lcshine 7s linear infinite" }}>Start tonight.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-g-ink" style={{ animation: "lcreveal .8s ease .25s both" }}>
          Tell us where to reach you. A <span className="font-semibold text-g-word">real human</span> gets back to you fast — usually within hours.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-xl rounded-[1.75rem] border border-g-line bg-white/[0.04] p-6 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-8" style={{ animation: "lcreveal .8s ease .35s both" }}>
        {status === "done" ? (
          <div className="py-8 text-center">
            <div className="text-4xl">🌱</div>
            <div className="mt-3 text-[20px] font-bold text-g-word">Got it, {name.split(" ")[0] || "friend"}!</div>
            <p className="mt-1 text-[14px] text-g-ink">A real human will reach out on <span className="font-semibold text-g-green">{CH[ch].k}</span> within hours.</p>
            <a href={waLink("Hi Guileo! I just left my details on your site.")} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-[14px] font-bold text-black">💬 Or message us now on WhatsApp</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />

            <div>
              <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-g-muted">Where should we reach you?</div>
              <div className="flex flex-wrap gap-1.5">
                {CH.map((c, i) => (
                  <button type="button" key={c.k} onClick={() => { setCh(i); setVal(""); }}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${i === ch ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line bg-white/[0.03] text-g-muted hover:text-g-word"}`}>
                    {c.icon} {c.k}
                  </button>
                ))}
              </div>
            </div>

            <input value={val} onChange={(e) => setVal(e.target.value)} required placeholder={CH[ch].ph} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <input value={biz} onChange={(e) => setBiz(e.target.value)} placeholder="Your business (optional)" className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />

            <button type="submit" disabled={status === "sending"} className="w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110 disabled:opacity-60">
              {status === "sending" ? "Sending…" : "Get my free quote →"}
            </button>
            <p className="text-center text-[11.5px] text-g-muted">No spam. Your info stays private and is only used to contact you.</p>
          </form>
        )}
      </div>

      <div className="mx-auto mt-6 max-w-xl text-center" style={{ animation: "lcreveal .8s ease .5s both" }}>
        <div className="text-[12.5px] font-semibold text-g-muted">⚡ Live in under 7 days · 🛡️ 30-day money-back · 🎙️ talk to our AI right now</div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a href={waLink("Hi Guileo! I'd like to know more.")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-5 py-2.5 text-[14px] font-bold text-g-word transition hover:border-g-green/40">💬 Start on WhatsApp</a>
          <a href={bookLink()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-5 py-2.5 text-[14px] font-bold text-g-word transition hover:border-g-green/40">📅 Book a demo</a>
        </div>
      </div>
    </section>
  );
}
