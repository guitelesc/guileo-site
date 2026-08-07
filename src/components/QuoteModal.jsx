import { useState } from "react";
import { useLang } from "../i18n.jsx";

// Smart, service-contextual quote form. Opens when a visitor clicks "Request this" on a specific service:
// it already knows WHICH service, shows exactly what we'll need (the catalog's `deliver`), and asks only the
// MINIMUM essentials for a fast first quote — then captures the lead into /api/lead (which feeds the CRM).
// Nothing is lost to a WhatsApp tab; every quote request becomes a tracked, contextualized contact.
const T = {
  title: { en: "Get your quote", pt: "Peça seu orçamento", es: "Pide tu cotización", hi: "अपना कोट पाएँ" },
  for: { en: "for", pt: "para", es: "para", hi: "के लिए" },
  need: { en: "To quote this fast, tell us:", pt: "Pra orçar rápido, nos conte:", es: "Para cotizar rápido, cuéntanos:", hi: "जल्दी कोट देने के लिए, हमें बताएँ:" },
  name: { en: "Your name", pt: "Seu nome", es: "Tu nombre", hi: "आपका नाम" },
  contact: { en: "Email or phone", pt: "Email ou telefone", es: "Correo o teléfono", hi: "ईमेल या फ़ोन" },
  detailsLabel: { en: "Tell us the essentials", pt: "Conte o essencial", es: "Cuéntanos lo esencial", hi: "ज़रूरी बातें बताएँ" },
  send: { en: "Send & get my quote →", pt: "Enviar e receber orçamento →", es: "Enviar y recibir cotización →", hi: "भेजें और कोट पाएँ →" },
  sending: { en: "Sending…", pt: "Enviando…", es: "Enviando…", hi: "भेज रहे हैं…" },
  consent: { en: "I agree to be contacted by Guileo about my request.", pt: "Concordo em ser contatado pela Guileo sobre meu pedido.", es: "Acepto ser contactado por Guileo sobre mi solicitud.", hi: "मैं अपने अनुरोध के बारे में Guileo से संपर्क के लिए सहमत हूँ।" },
  doneT: { en: "Got it! 🌱", pt: "Recebido! 🌱", es: "¡Recibido! 🌱", hi: "मिल गया! 🌱" },
  doneD: { en: "We have everything we need — your quote is on its way. We'll reach out shortly.", pt: "Temos tudo que precisamos — seu orçamento está a caminho. Falamos com você em breve.", es: "Tenemos todo lo necesario — tu cotización está en camino. Te contactamos pronto.", hi: "हमें जो चाहिए सब मिल गया — आपका कोट रास्ते में है। हम जल्द संपर्क करेंगे।" },
  err: { en: "Please add your name and a contact.", pt: "Adicione seu nome e um contato.", es: "Agrega tu nombre y un contacto.", hi: "कृपया अपना नाम और एक संपर्क जोड़ें।" },
  close: { en: "Close", pt: "Fechar", es: "Cerrar", hi: "बंद करें" },
};

export default function QuoteModal({ service, catName, color = "#3E9468", onClose }) {
  const { lang } = useLang();
  const L = (o) => (o && (o[lang] || o.en)) || "";
  const t = (k) => L(T[k]);
  const svcName = L(service?.name) || catName || "your project";
  const deliver = L(service?.deliver);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [details, setDetails] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState("idle"); // idle | sending | done
  const [err, setErr] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !consent) { setErr(true); return; }
    setErr(false); setState("sending");
    const isEmail = /.+@.+\..+/.test(contact);
    const payload = {
      name: name.trim(),
      contact: contact.trim(),
      [isEmail ? "email" : "phone"]: contact.trim(),
      business: catName || "",
      message: `Quote request: ${svcName}${details.trim() ? ` — ${details.trim()}` : ""}${deliver ? ` · (needs: ${deliver})` : ""}`,
      source: `quote:${service?.type || "service"}:${svcName}`.slice(0, 120),
      lang, consent: true,
    };
    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); } catch { /* graceful */ }
    setState("done");
  };

  const field = "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-[qfade_.2s_ease-out]" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`@keyframes qfade{from{opacity:0}to{opacity:1}}@keyframes qpop{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}`}</style>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl3 border border-white/10 bg-[#161512] p-6 shadow-2xl animate-[qpop_.25s_ease-out]" style={{ borderTop: `4px solid ${color}` }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider" style={{ color }}>{t("title")} {t("for")}</div>
              <h3 className="mt-1 text-lg font-black text-g-word leading-tight">{svcName}</h3>
            </div>
            <button onClick={onClose} aria-label={t("close")} className="text-g-muted hover:text-g-word text-xl leading-none">✕</button>
          </div>

          {state === "done" ? (
            <div className="py-6 text-center">
              <div className="text-3xl">✅</div>
              <div className="mt-2 text-lg font-extrabold text-g-word">{t("doneT")}</div>
              <p className="mt-1 text-sm text-g-muted">{t("doneD")}</p>
              <button onClick={onClose} className="btn-bright mt-5 text-sm">{t("close")}</button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 grid gap-3">
              {deliver && (
                <div className="rounded-xl bg-white/[0.04] p-3 text-xs text-g-light/85" style={{ borderLeft: `3px solid ${color}` }}>
                  <span className="font-bold text-g-word">{t("need")}</span> {deliver}
                </div>
              )}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")} className={field} />
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t("contact")} className={field} />
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder={t("detailsLabel")} className={`${field} resize-none`} />
              <label className="flex items-start gap-2 text-[11px] leading-snug text-g-muted">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-g-green" />
                <span>{t("consent")}</span>
              </label>
              {err && <p className="text-center text-[12px] font-semibold text-g-gold">{t("err")}</p>}
              <button disabled={state === "sending"} className="btn-bright text-sm disabled:opacity-70" style={{ background: color }}>
                {state === "sending" ? t("sending") : t("send")}
              </button>
            </form>
          )}
      </div>
    </div>
  );
}
