import { useState } from "react";
import { motion } from "framer-motion";
import { FaWhatsapp, FaPhone, FaEnvelope, FaInstagram, FaTelegram, FaLinkedin, FaFacebookMessenger, FaXTwitter } from "react-icons/fa6";
import { useLang } from "../i18n.jsx";
import { waLink } from "../data/contact.js";
import { trackLead } from "../lib/analytics.js";
import { normalizePhone, phonePlaceholder } from "../lib/intl.js";
import ConsentText from "./ConsentText.jsx";

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
  const [website, setWebsite] = useState(""); // honeypot — real users never see/fill this
  const [consent, setConsent] = useState(false); // TCPA — UNCHECKED by default; required affirmative opt-in
  const [err, setErr] = useState(false); // a11y: true when submit fails validation

  // Phone-number channels get i18n normalization (E.164 to the API + "assumed +55" hint);
  // handle-based channels (instagram, telegram…) are passed through untouched.
  const isPhoneCh = ch === "whatsapp" || ch === "phone";
  const pn = isPhoneCh && contact.trim() ? normalizePhone(contact, lang) : null;

  const errText = lang === "es"
    ? "Casi — solo falta tu nombre, tu contacto y el checkbox de consentimiento 💚"
    : lang === "pt"
    ? "Quase lá — só falta seu nome, seu contato e o ok no consentimento 💚"
    : lang === "hi"
    ? "बस थोड़ा और — अपना नाम, संपर्क और सहमति बॉक्स भर दें 💚"
    : "Almost there — we just need your name, your contact, and the consent box 💚";
  const nameBad = err && !name.trim();
  const contactBad = err && !contact.trim();
  const consentBad = err && !consent;

  const trustText = lang === "es"
    ? "Garantía de 30 días · un humano real supervisa · en marcha en ~7 días"
    : lang === "pt"
    ? "Garantia de 30 dias · um humano real supervisiona · no ar em ~7 dias"
    : lang === "hi"
    ? "30-दिन मनी-बैक · एक असली इंसान निगरानी करता है · ~7 दिनों में लाइव"
    : "30-day money-back · a real human supervises · live in ~7 days";


  // reassurance microline — right under the submit button (honest: humans reply in business hours)
  const replyText = lang === "es"
    ? "Respuesta en minutos en horario comercial — sin spam, nunca."
    : lang === "pt"
    ? "Resposta em minutos no horário comercial — sem spam, nunca."
    : lang === "hi"
    ? "व्यावसायिक घंटों में मिनटों में जवाब — कोई स्पैम नहीं, कभी नहीं।"
    : "Reply within minutes during business hours — no spam, ever.";

  const toWhatsApp = () => {
    const msg = `${L.wamsg}\n\n👤 ${name}\n📨 ${ch}: ${contact}\n🏢 ${biz}`;
    window.open(waLink(msg), "_blank");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !consent) { setErr(true); return; }
    setErr(false);
    setState("sending");
    const payload = { name, business: biz, source, lang, channel: ch, website, consent, message: `Preferred channel: ${ch} → ${contact}` };
    if (ch === "email") payload.email = contact;
    else payload.phone = isPhoneCh && pn?.ok && pn.e164 ? pn.e164 : contact; // E.164 for phone channels; raw handle otherwise
    try {
      const r = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await r.json().catch(() => ({}));
      trackLead(); // fire-and-forget; no-ops until pixel IDs are set
      setState("done");
      if (!data.stored) toWhatsApp();
    } catch { trackLead(); setState("done"); toWhatsApp(); }
  };

  if (state === "done") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} role="status"
        className="rounded-xl3 border border-g-green/40 bg-g-green/[0.1] p-8 text-center">
        <div className="text-4xl mb-2">✅</div>
        <div className="text-xl font-extrabold text-g-word">{L.successT}</div>
        <p className="mt-1 text-g-muted">{L.successD}</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      {/* honeypot: hidden from humans, bots auto-fill it → server silently drops the submission */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={website} onChange={(e) => setWebsite(e.target.value)}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
      <input required value={name} onChange={(e) => setName(e.target.value)} aria-label={L.name}
        aria-invalid={nameBad} aria-describedby={nameBad ? "leadform-err" : undefined}
        placeholder={L.name}
        className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-base text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition" />

      {/* channel picker — leave us anything, we reach out (real brand icons) */}
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map(([Icon, label, key, color]) => {
          const on = ch === key;
          return (
            <button type="button" key={key} onClick={() => setCh(key)} aria-pressed={on}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all sm:min-h-0 ${on ? "scale-105 shadow-glow" : "hover:text-g-word"}`}
              style={on
                ? { background: color + "22", border: `1px solid ${color}`, color }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "#9a958c" }}>
              <Icon size={15} style={{ color }} /> {label}
            </button>
          );
        })}
      </div>

      <input required value={contact} onChange={(e) => setContact(e.target.value)} aria-label={L.contact || PLACEHOLDER[ch]}
        type={ch === "email" ? "email" : "tel"} inputMode={ch === "email" ? "email" : "tel"} autoComplete={ch === "email" ? "email" : "tel"}
        aria-invalid={contactBad} aria-describedby={contactBad ? "leadform-err" : undefined}
        placeholder={isPhoneCh ? phonePlaceholder(lang) : PLACEHOLDER[ch]}
        className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-base text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition" />
      {/* country-assumption hint — small + muted, only when we had to guess */}
      {pn?.hint && <p className="text-[11px] text-g-muted px-2 -mt-1" role="status">📞 {pn.e164} · {pn.hint}</p>}
      <input value={biz} onChange={(e) => setBiz(e.target.value)} aria-label={L.business}
        placeholder={L.business}
        className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-base text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition" />

      {/* TCPA consent — REQUIRED, unchecked by default (affirmative opt-in) */}
      <label className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-snug transition ${consentBad ? "border-g-gold/70 bg-g-gold/10 text-g-word" : "border-white/15 bg-white/[0.03] text-g-muted"}`}>
        <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)}
          aria-invalid={consentBad} aria-describedby={consentBad ? "leadform-err" : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-g-green" />
        <span><ConsentText lang={lang} /></span>
      </label>

      {err && <p id="leadform-err" role="alert" className="text-center text-[12px] font-semibold text-g-gold">{errText}</p>}
      <motion.button whileTap={{ scale: 0.98 }} disabled={state === "sending"} className="btn-bright text-base disabled:opacity-70 min-h-[44px]">
        {state === "sending" ? L.sending : L.submit}
      </motion.button>
      <p className="text-center text-[11px] font-semibold text-g-muted">{replyText}</p>
      <p className="text-center text-[11px] font-semibold text-g-muted">{trustText}</p>
    </form>
  );
}
