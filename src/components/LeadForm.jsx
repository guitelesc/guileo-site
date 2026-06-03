import { useState } from "react";
import { motion } from "framer-motion";
import { useLang } from "../i18n.jsx";
import { waLink } from "../data/contact.js";

const CHANNELS = [
  ["💬", "WhatsApp", "whatsapp"],
  ["📞", "Phone", "phone"],
  ["📧", "Email", "email"],
  ["📸", "Instagram", "instagram"],
  ["✈️", "Telegram", "telegram"],
  ["💼", "LinkedIn", "linkedin"],
];
const PLACEHOLDER = {
  whatsapp: "+1 (555) 000-0000", phone: "+1 (555) 000-0000", email: "you@email.com",
  instagram: "@yourhandle", telegram: "@yourhandle", linkedin: "linkedin.com/in/you",
};

export default function LeadForm({ source = "website" }) {
  const { t, lang } = useLang();
  const L = t.more.lead;
  const [name, setName] = useState("");
  const [ch, setCh] = useState("whatsapp");
  const [contact, setContact] = useState("");
  const [biz, setBiz] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done

  const toWhatsApp = () => {
    const msg = `${L.wamsg}\n\n👤 ${name}\n📨 ${ch}: ${contact}\n🏢 ${biz}`;
    window.open(waLink(msg), "_blank");
  };

  const submit = async (e) => {
    e.preventDefault();
    setState("sending");
    const payload = { name, business: biz, source, lang, channel: ch, message: `Preferred channel: ${ch} → ${contact}` };
    if (ch === "email") payload.email = contact; else payload.phone = contact;
    try {
      const r = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await r.json().catch(() => ({}));
      setState("done");
      if (!data.stored) toWhatsApp();
    } catch { setState("done"); toWhatsApp(); }
  };

  if (state === "done") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl3 border border-g-green/40 bg-g-green/[0.1] p-8 text-center">
        <div className="text-4xl mb-2">✅</div>
        <div className="text-xl font-extrabold text-g-word">{L.successT}</div>
        <p className="mt-1 text-g-muted">{L.successD}</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={L.name}
        className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition" />

      {/* channel picker — leave us anything, we reach out */}
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map(([ic, label, key]) => (
          <button type="button" key={key} onClick={() => setCh(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${ch === key ? "bg-g-green/20 border border-g-green/60 text-g-light scale-105 shadow-glow" : "border border-white/15 bg-white/[0.04] text-g-muted hover:text-g-word"}`}>
            {ic} {label}
          </button>
        ))}
      </div>

      <input required value={contact} onChange={(e) => setContact(e.target.value)} placeholder={PLACEHOLDER[ch]}
        className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition" />
      <input value={biz} onChange={(e) => setBiz(e.target.value)} placeholder={L.business}
        className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition" />

      <motion.button whileTap={{ scale: 0.98 }} disabled={state === "sending"} className="btn-bright text-base disabled:opacity-70">
        {state === "sending" ? L.sending : L.submit}
      </motion.button>
      <p className="text-center text-[11px] text-g-muted">{L.privacy}</p>
    </form>
  );
}
