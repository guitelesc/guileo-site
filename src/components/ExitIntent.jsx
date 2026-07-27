import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n.jsx";

// Exit-intent capture — catches a visitor about to leave (desktop: cursor flies to the top;
// mobile: hard scroll-up after engagement) and offers a last touch with founding-client urgency.
// Submits to /api/lead (same pipeline as every form). Shows once per browser, then never again.
export default function ExitIntent() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [callNow, setCallNow] = useState(false);
  const [state, setState] = useState("idle"); // idle | sending | done
  const armed = useRef(false);

  const T = {
    en: { eyebrow: "Wait — before you go", h: "Founding clients lock their price forever.", p: "Leave your number and Gui shows you exactly what it does for your business — live, in 60 seconds. Plans from $149/mo, 30-day money-back. No pressure.", name: "Your name", contact: "WhatsApp / phone / email", call: "📞 Have Gui call me now", cta: "Show me Gui →", sending: "Sending…", done: "Got it! 🌱", doneCall: "📞 Gui is calling you — pick up!", doneSub: "We'll be in touch shortly.", tryIt: "Or try the live demo yourself →", no: "No thanks" },
    pt: { eyebrow: "Espera — antes de sair", h: "Clientes fundadores travam o preço pra sempre.", p: "Deixa seu número e a Gui te mostra exatamente o que faz pelo seu negócio — ao vivo, em 60 segundos. Planos a partir de $149/mês, 30 dias de garantia. Sem pressão.", name: "Seu nome", contact: "WhatsApp / telefone / e-mail", call: "📞 Quero que a Gui me ligue agora", cta: "Me mostra a Gui →", sending: "Enviando…", done: "Recebido! 🌱", doneCall: "📞 A Gui está te ligando — atende!", doneSub: "A gente fala com você já já.", tryIt: "Ou testa a demo ao vivo você mesmo →", no: "Agora não" },
    es: { eyebrow: "Espera — antes de irte", h: "Los clientes fundadores fijan su precio para siempre.", p: "Deja tu número y Gui te muestra exactamente lo que hace por tu negocio — en vivo, en 60 segundos. Planes desde $149/mes, 30 días de garantía. Sin presión.", name: "Tu nombre", contact: "WhatsApp / teléfono / correo", call: "📞 Quiero que Gui me llame ahora", cta: "Muéstrame a Gui →", sending: "Enviando…", done: "¡Recibido! 🌱", doneCall: "📞 Gui te está llamando — ¡contesta!", doneSub: "Hablamos contigo enseguida.", tryIt: "O prueba la demo en vivo tú mismo →", no: "Ahora no" },
    hi: { eyebrow: "रुकिए — जाने से पहले", h: "फ़ाउंडिंग क्लाइंट अपनी कीमत हमेशा के लिए लॉक करते हैं।", p: "अपना नंबर छोड़ें और Gui आपको दिखाती है कि वह आपके व्यवसाय के लिए क्या करती है — लाइव, 60 सेकंड में। प्लान $149/माह से, 30 दिन की मनी-बैक गारंटी। कोई दबाव नहीं।", name: "आपका नाम", contact: "WhatsApp / फ़ोन / ईमेल", call: "📞 Gui से अभी कॉल करवाएँ", cta: "मुझे Gui दिखाओ →", sending: "भेज रहे हैं…", done: "मिल गया! 🌱", doneCall: "📞 Gui आपको कॉल कर रही है — उठाइए!", doneSub: "हम जल्द ही आपसे संपर्क करेंगे।", tryIt: "या खुद लाइव डेमो आज़माएँ →", no: "अभी नहीं" },
  };
  const t = T[lang] || T.en;

  useEffect(() => {
    try { if (sessionStorage.getItem("g_exit_seen")) return; } catch { /* ignore */ }
    const trigger = () => {
      if (armed.current) return;
      armed.current = true;
      try { sessionStorage.setItem("g_exit_seen", "1"); } catch { /* ignore */ }
      setOpen(true);
    };
    const onLeave = (e) => { if (e.clientY <= 0) trigger(); }; // cursor left through the top
    // mobile fallback: arm after 25s of engagement, fire on a fast scroll toward the top
    let lastY = window.scrollY, mobileArmed = false;
    const armMobile = setTimeout(() => { mobileArmed = true; }, 25000);
    const onScroll = () => { const y = window.scrollY; if (mobileArmed && lastY - y > 80 && y < 600) trigger(); lastY = y; };
    document.addEventListener("mouseout", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { document.removeEventListener("mouseout", onLeave); window.removeEventListener("scroll", onScroll); clearTimeout(armMobile); };
  }, []);

  // a11y: Escape closes the dialog (keyboard parity with the overlay click)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!contact.trim()) return;
    setState("sending");
    try {
      await fetch("/api/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // TCPA: only an affirmative "call me now" tick is consent to be dialed. Without it we still
        // capture the lead but pass consent:false + noCall:true so /api/lead never auto-dials.
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), phone: contact.trim(), source: "exit-intent", channel: "Exit intent", lang, callNow, consent: callNow, noCall: !callNow, message: "Exit-intent capture (founding offer)" }),
      });
    } catch { /* best effort */ }
    setState("done");
  };

  if (!open) return null;
  const field = "w-full rounded-full border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60 transition";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="exit-intent-title" className="relative w-full max-w-md overflow-hidden rounded-3xl border border-g-gold/30 bg-gradient-to-b from-[#1a1813] to-[#141310] p-6 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)] sm:p-7" style={{ animation: "exitpop .35s cubic-bezier(.2,.8,.2,1)" }}>
        <style>{`@keyframes exitpop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){[style*="exitpop"]{animation:none !important}}`}</style>
        <button onClick={() => setOpen(false)} aria-label="Fechar" className="absolute right-4 top-4 text-g-muted hover:text-g-word">✕</button>

        {state === "done" ? (
          <div role="status" className="py-6 text-center">
            <div className="text-4xl">{callNow ? "📞" : "🎉"}</div>
            <div className="mt-3 text-xl font-black text-g-word">{callNow ? t.doneCall : t.done}</div>
            <p className="mt-2 text-sm text-g-muted">{t.doneSub}</p>
          </div>
        ) : (
          <>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-g-gold">{t.eyebrow}</div>
            <h3 id="exit-intent-title" className="mt-2 text-[22px] font-black leading-tight text-g-word">{t.h}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-g-light/85">{t.p}</p>
            <form onSubmit={submit} className="mt-4 space-y-2.5">
              <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t.name} placeholder={t.name} className={field} />
              <input required value={contact} onChange={(e) => setContact(e.target.value)} aria-label={t.contact} placeholder={t.contact} className={field} />
              <label className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition ${callNow ? "border-fuchsia-400/50 bg-fuchsia-500/[0.08]" : "border-white/10 bg-white/[0.02]"}`}>
                <input type="checkbox" checked={callNow} onChange={(e) => setCallNow(e.target.checked)} className="h-4 w-4 accent-fuchsia-500" />
                <span className="text-[12.5px] font-semibold text-g-word">{t.call}</span>
              </label>
              <button disabled={state === "sending" || !contact.trim()} className="btn-bright w-full justify-center text-sm disabled:opacity-60">{state === "sending" ? t.sending : t.cta}</button>
            </form>
            <a href="/#try" onClick={() => setOpen(false)} className="mt-3 block w-full text-center text-[12px] font-semibold text-g-gold/90 hover:text-g-gold">{t.tryIt}</a>
            <button onClick={() => setOpen(false)} className="mt-2 w-full text-center text-[12px] text-g-muted hover:text-g-word">{t.no}</button>
          </>
        )}
      </div>
    </div>
  );
}
