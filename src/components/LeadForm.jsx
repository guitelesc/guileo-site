import { useState } from "react";
import { motion } from "framer-motion";
import { useLang } from "../i18n.jsx";
import { waLink } from "../data/contact.js";

export default function LeadForm({ source = "website" }) {
  const { t, lang } = useLang();
  const L = t.more.lead;
  const [f, setF] = useState({ name: "", email: "", phone: "", business: "" });
  const [state, setState] = useState("idle"); // idle | sending | done
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const toWhatsApp = () => {
    const msg = `${L.wamsg}\n\n👤 ${f.name}\n📧 ${f.email}\n📞 ${f.phone}\n🏢 ${f.business}`;
    window.open(waLink(msg), "_blank");
  };

  const submit = async (e) => {
    e.preventDefault();
    setState("sending");
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, source, lang }),
      });
      const data = await r.json().catch(() => ({}));
      setState("done");
      if (!data.stored) toWhatsApp(); // no destination configured yet → guarantee the lead reaches you
    } catch {
      setState("done");
      toWhatsApp();
    }
  };

  if (state === "done") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl3 border border-g-green/30 bg-g-green/[0.07] p-8 text-center">
        <div className="text-4xl mb-2">✅</div>
        <div className="text-xl font-extrabold text-g-word">{L.successT}</div>
        <p className="mt-1 text-g-muted">{L.successD}</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
      <input required value={f.name} onChange={set("name")} placeholder={L.name}
        className="rounded-full border border-g-line bg-white/[0.04] px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60 transition" />
      <input required type="tel" value={f.phone} onChange={set("phone")} placeholder={L.phone}
        className="rounded-full border border-g-line bg-white/[0.04] px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60 transition" />
      <input required type="email" value={f.email} onChange={set("email")} placeholder={L.email}
        className="rounded-full border border-g-line bg-white/[0.04] px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60 transition" />
      <input value={f.business} onChange={set("business")} placeholder={L.business}
        className="rounded-full border border-g-line bg-white/[0.04] px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60 transition" />
      <motion.button whileTap={{ scale: 0.98 }} disabled={state === "sending"}
        className="btn-gold sm:col-span-2 text-base disabled:opacity-70">
        {state === "sending" ? L.sending : L.submit}
      </motion.button>
      <p className="sm:col-span-2 text-center text-[11px] text-g-muted">{L.privacy}</p>
    </form>
  );
}
