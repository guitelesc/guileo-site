import { useState } from "react";
import { motion } from "framer-motion";
import { FaWhatsapp, FaPhone, FaEnvelope, FaInstagram, FaTelegram, FaLinkedin, FaFacebookMessenger, FaXTwitter } from "react-icons/fa6";
import { useLang } from "../i18n.jsx";
import { waLink } from "../data/contact.js";

const CHANNELS = [
  [FaWhatsapp, "WhatsApp", "whatsapp", "#25D366"],
  [FaPhone, "Phone", "phone", "#7BD828"],
  [FaEnvelope, "Email", "email", "#E0AE2E"],
  [FaInstagram, "Instagram", "instagram", "#E4405F"],
  [FaTelegram, "Telegram", "telegram", "#26A5E4"],
  [FaLinkedin, "LinkedIn", "linkedin", "#0A66C2"],
  [FaFacebookMessenger, "Messenger", "messenger", "#0084FF"],
  [FaXTwitter, "X", "x", "#e7e7e7"],
];
const PLACEHOLDER = {
  whatsapp: "+1 (555) 000-0000", phone: "+1 (555) 000-0000", email: "you@email.com",
  instagram: "@yourhandle", telegram: "@yourhandle", linkedin: "linkedin.com/in/you",
  messenger: "@yourhandle", x: "@yourhandle",
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

      {/* channel picker — leave us anything, we reach out (real brand icons) */}
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map(([Icon, label, key, color]) => {
          const on = ch === key;
          return (
            <button type="button" key={key} onClick={() => setCh(key)} aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${on ? "scale-105 shadow-glow" : "hover:text-g-word"}`}
              style={on
                ? { background: color + "22", border: `1px solid ${color}`, color }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "#9a958c" }}>
              <Icon size={15} style={{ color }} /> {label}
            </button>
          );
        })}
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
