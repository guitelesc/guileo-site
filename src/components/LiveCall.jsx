import { useState } from "react";
import { motion } from "framer-motion";

// Live showcase: visitor enters their number → Guileo's AI calls them.
// Tries the backend (Vapi outbound) first; falls back to the on-site web voice agent.
export default function LiveCall() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("idle"); // idle · calling · done · web

  const openWebAgent = () => {
    // open the embedded ElevenLabs convai widget if present
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
    // always capture the lead (name + phone), regardless of the call provider status
    fetch("/api/lead", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, source: "live-call" }),
    }).catch(() => {});
    try {
      const r = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (r.ok) { setState("done"); return; }
      throw new Error("no backend");
    } catch {
      // backend not wired yet → immediate web demo
      setState("web");
      openWebAgent();
    }
  };

  return (
    <div className="rounded-xl3 bg-gradient-to-br from-white/[0.16] via-white/[0.08] to-g-green/[0.08] backdrop-blur-xl border border-white/25 shadow-lift p-6 sm:p-8 max-w-xl mx-auto">
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
          <h3 className="text-2xl font-extrabold text-g-word leading-tight">Let our AI call you — right now</h3>
        </div>
      </div>
      <p className="mt-3 text-sm text-g-muted">Enter your number. Guileo's AI rings your phone in seconds and shows you exactly how it sells for you. This is the product — working, live.</p>

      {state === "done" ? (
        <div className="mt-5 rounded-xl2 bg-g-green/10 p-4 text-center">
          <div className="text-2xl">📞</div>
          <div className="font-bold text-g-word mt-1">Calling you now — pick up!</div>
          <div className="text-sm text-g-muted">Our AI is dialing {phone}. That's what your customers will feel, 24/7.</div>
        </div>
      ) : state === "web" ? (
        <div className="mt-5 rounded-xl2 bg-g-gold/10 p-4 text-center">
          <div className="text-2xl">🎙️</div>
          <div className="font-bold text-g-word mt-1">Talk to it right here</div>
          <div className="text-sm text-g-muted">The voice agent just opened (bottom-right). Say hi — it's the same AI that will answer your business.</div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 grid gap-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <motion.button whileTap={{ scale: 0.98 }} disabled={state === "calling"} className="btn-bright text-base">
            {state === "calling" ? "Connecting…" : "📞 Call me with AI →"}
          </motion.button>
          <p className="text-[11px] text-g-muted text-center">No spam. One call to show you it works. You can opt out anytime.</p>
        </form>
      )}
    </div>
  );
}
