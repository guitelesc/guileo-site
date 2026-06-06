import { useState } from "react";
import { motion } from "framer-motion";

const DIAL = [["🇺🇸", "+1"], ["🇧🇷", "+55"], ["🇵🇹", "+351"], ["🇪🇸", "+34"], ["🇬🇧", "+44"], ["🇲🇽", "+52"], ["🇦🇷", "+54"], ["🇮🇳", "+91"], ["🇦🇺", "+61"]];
const INDUSTRIES = ["Restaurant", "Clinic / Dental", "Salon & Spa", "Law Firm", "E-Commerce", "Real Estate", "Gym & Fitness", "Medical", "Home Services", "Auto", "Education", "Construction", "Other"];

// Live showcase + lead activation: visitor enters name + number (+ business context) →
// Guileo's AI calls them. We capture a RICH lead (name, phone, business, industry, need) so
// the call is contextual and the lead is sales-ready. Backend first (outbound), web agent fallback.
export default function LiveCall() {
  const [name, setName] = useState("");
  const [cc, setCc] = useState("+1");
  const [phone, setPhone] = useState("");
  const [biz, setBiz] = useState("");
  const [industry, setIndustry] = useState("");
  const [need, setNeed] = useState("");
  const [open, setOpen] = useState(false); // progressive: business context reveals on engage
  const [state, setState] = useState("idle"); // idle · calling · done · web

  const openWebAgent = () => {
    const el = document.querySelector("elevenlabs-convai");
    if (el) {
      const btn = el.shadowRoot?.querySelector("button");
      if (btn) btn.click();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setState("calling");
    const full = `${cc} ${phone}`.trim();
    const lead = { name, phone: full, business: biz, industry, need, source: "live-call" };
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) }).catch(() => {});
    try {
      const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone: full, business: biz, industry, need }) });
      if (r.ok) { setState("done"); return; }
      throw new Error("no backend");
    } catch {
      setState("web");
      openWebAgent();
    }
  };

  const field = "rounded-full border border-white/20 bg-black/25 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition w-full";

  return (
    <div className="rounded-xl3 bg-gradient-to-br from-white/[0.16] via-white/[0.08] to-g-green/[0.08] backdrop-blur-xl border border-white/25 shadow-lift p-6 sm:p-8 max-w-3xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-6 lg:gap-9 lg:items-center">
        {/* LEFT — the pitch + why */}
        <div>
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="grid place-items-center h-14 w-14 rounded-full bg-gradient-to-br from-g-green/25 to-g-gold/20 border border-white/15 text-3xl shadow-soft">🧑‍💼</div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full rounded-full bg-g-green/60 animate-ping" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-g-green border-2 border-g-cream" />
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wide text-g-green">Live · try it on yourself</span>
          </div>
          <h3 className="text-2xl font-extrabold text-g-word leading-tight">Let Gui call you — and sell you, right now</h3>
        </div>
      </div>
      <p className="mt-3 text-sm text-g-muted">Drop your number and a line about your business. Gui rings your phone in seconds — and shows you exactly how it'll answer, qualify and sell for <span className="text-g-word font-semibold">you</span>. This is the product, working live.</p>

      {/* value strip — what happens on the call (boosts activation) */}
      <div className="mt-5 grid gap-2">
        {[["📞", "Rings your phone in seconds"], ["🤝", "Talks like your best sales rep"], ["📅", "Books & quotes you live"]].map(([ic, tx]) => (
          <div key={tx} className="flex items-center gap-2.5 rounded-xl2 border border-white/10 bg-white/[0.04] px-3 py-2">
            <span className="text-base leading-none">{ic}</span>
            <span className="text-xs font-semibold text-g-word leading-tight">{tx}</span>
          </div>
        ))}
      </div>
        </div>

        {/* RIGHT — the action (form / states) */}
        <div>
      {state === "done" ? (
        <div className="mt-5 rounded-xl2 bg-g-green/10 p-4 text-center">
          <div className="text-2xl">📞</div>
          <div className="font-bold text-g-word mt-1">Calling you now — pick up!</div>
          <div className="text-sm text-g-muted">Gui is dialing {cc} {phone}{biz ? ` about ${biz}` : ""}. That's what your customers will feel, 24/7.</div>
        </div>
      ) : state === "web" ? (
        <div className="mt-5 rounded-xl2 bg-g-gold/10 p-4 text-center">
          <div className="text-2xl">🎙️</div>
          <div className="font-bold text-g-word mt-1">Talk to it right here</div>
          <div className="text-sm text-g-muted">The voice agent just opened (bottom-right). Say hi — it's the same AI that will answer your business.</div>
        </div>
      ) : (
        <form onSubmit={submit} onFocusCapture={() => setOpen(true)} className="mt-5 grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input required value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" placeholder="Your name" className={field} />
            <div className="flex gap-2">
              <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label="Country code" className={`${field} w-auto pr-2`}>
                {DIAL.map(([f, c], i) => <option key={c + i} value={c} className="bg-g-deep">{f} {c}</option>)}
              </select>
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone number" placeholder="Your phone" className={field} />
            </div>
          </div>

          {/* business context — reveals on engage; makes the call contextual + the lead sales-ready */}
          <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <div className="grid gap-3 pt-0.5">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={biz} onChange={(e) => setBiz(e.target.value)} aria-label="Business name" placeholder="Business name" className={field} />
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry" className={`${field} ${industry ? "text-g-word" : "text-g-muted"}`}>
                    <option value="" className="bg-g-deep">Your industry</option>
                    {INDUSTRIES.map((x) => <option key={x} value={x} className="bg-g-deep text-g-word">{x}</option>)}
                  </select>
                </div>
                <input value={need} onChange={(e) => setNeed(e.target.value)} aria-label="What should Gui handle" placeholder="What should Gui handle? (e.g. book appointments, recover carts) — optional" className={field} />
              </div>
            </div>
          </div>

          <motion.button whileTap={{ scale: 0.98 }} disabled={state === "calling"} className="btn-bright text-base disabled:opacity-70">
            {state === "calling" ? "Connecting…" : "📞 Call me with AI →"}
          </motion.button>
          <p className="text-[11px] text-g-muted text-center">No spam. One call to prove it works. Opt out anytime.</p>
        </form>
      )}
        </div>
      </div>
    </div>
  );
}
