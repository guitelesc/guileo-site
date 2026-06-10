import { useState } from "react";
import { motion } from "framer-motion";
import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";

const DIAL = [["🇺🇸", "+1"], ["🇧🇷", "+55"], ["🇵🇹", "+351"], ["🇪🇸", "+34"], ["🇬🇧", "+44"], ["🇲🇽", "+52"], ["🇦🇷", "+54"], ["🇮🇳", "+91"], ["🇦🇺", "+61"]];
const INDUSTRIES = ["Restaurant", "Clinic / Dental", "Salon & Spa", "Law Firm", "E-Commerce", "Real Estate", "Gym & Fitness", "Medical", "Home Services", "Auto", "Education", "Construction", "Other"];

const LC_COPY = {
  en: { live:"Live · try it on yourself", title:"Let Gui call you — and sell you, right now", sub:["Drop your number and a line about your business. Gui rings your phone in seconds — and shows you exactly how it'll answer, qualify and sell for ","you",". This is the product, working live."], chips:[["📞","Rings in seconds"],["🤝","Talks like your best rep"],["📅","Books & quotes live"]], doneT:"Calling you now — pick up!", doneD:["Gui is dialing "," about ",". That's what your customers will feel, 24/7."], webT:"Talk to it right here", webD:"The voice agent just opened (bottom-right). Say hi — it's the same AI that will answer your business.", name:"Your name", cc:"Country code", phone:"Your phone", bizName:"Business name", yourInd:"Your industry", need:"What should Gui handle? (e.g. book appointments, recover carts) — optional", connecting:"Connecting…", call:"📞 Call me with AI →", privacy:"No spam. One call to prove it works. Opt out anytime." },
  pt: { live:"Ao vivo · teste em você", title:"Deixe a Gui te ligar — e te vender, agora", sub:["Coloque seu número e uma linha sobre seu negócio. A Gui liga em segundos — e mostra exatamente como vai atender, qualificar e vender por ","você",". Este é o produto, ao vivo."], chips:[["📞","Liga em segundos"],["🤝","Fala como seu melhor vendedor"],["📅","Agenda & orça ao vivo"]], doneT:"Ligando pra você agora — atende!", doneD:["A Gui está ligando pra "," sobre ",". É o que seus clientes vão sentir, 24/7."], webT:"Fale com ela aqui mesmo", webD:"O agente de voz abriu (canto inferior direito). Diga oi — é a mesma IA que vai atender seu negócio.", name:"Seu nome", cc:"Código do país", phone:"Seu telefone", bizName:"Nome do negócio", yourInd:"Seu setor", need:"O que a Gui deve fazer? (ex: agendar, recuperar carrinhos) — opcional", connecting:"Conectando…", call:"📞 Me ligar com IA →", privacy:"Sem spam. Uma ligação pra provar. Saia quando quiser." },
  es: { live:"En vivo · pruébalo en ti", title:"Deja que Gui te llame — y te venda, ahora", sub:["Pon tu número y una línea sobre tu negocio. Gui suena en segundos — y te muestra exactamente cómo contestará, calificará y venderá por ","ti",". Este es el producto, en vivo."], chips:[["📞","Suena en segundos"],["🤝","Habla como tu mejor vendedor"],["📅","Agenda & cotiza en vivo"]], doneT:"Llamándote ahora — ¡contesta!", doneD:["Gui está llamando a "," sobre ",". Eso es lo que sentirán tus clientes, 24/7."], webT:"Habla con ella aquí mismo", webD:"El agente de voz se abrió (abajo a la derecha). Saluda — es la misma IA que atenderá tu negocio.", name:"Tu nombre", cc:"Código de país", phone:"Tu teléfono", bizName:"Nombre del negocio", yourInd:"Tu industria", need:"¿Qué debe hacer Gui? (ej: agendar, recuperar carritos) — opcional", connecting:"Conectando…", call:"📞 Llámame con IA →", privacy:"Sin spam. Una llamada para probarlo. Sal cuando quieras." },
  hi: { live:"लाइव · खुद पर आज़माएँ", title:"Gui को आपको कॉल करने दें — और अभी बेचने दें", sub:["अपना नंबर और अपने व्यवसाय की एक लाइन डालें। Gui सेकंडों में कॉल करती है — और दिखाती है कि वह कैसे जवाब देगी, क्वालिफाई करेगी और ","आपके"," लिए बेचेगी। यह उत्पाद है, लाइव।"], chips:[["📞","सेकंडों में कॉल"],["🤝","आपके बेहतरीन रेप जैसी बात"],["📅","लाइव बुकिंग & कोटेशन"]], doneT:"अभी आपको कॉल कर रहे हैं — उठाएँ!", doneD:["Gui कॉल कर रही है "," के बारे में ",". यही आपके ग्राहक महसूस करेंगे, 24/7।"], webT:"यहीं इससे बात करें", webD:"वॉइस एजेंट अभी खुला (नीचे दाएँ)। हाय कहें — यही वह AI है जो आपके व्यवसाय का जवाब देगी।", name:"आपका नाम", cc:"देश कोड", phone:"आपका फ़ोन", bizName:"व्यवसाय का नाम", yourInd:"आपका उद्योग", need:"Gui को क्या संभालना चाहिए? (जैसे: बुकिंग, कार्ट रिकवरी) — वैकल्पिक", connecting:"कनेक्ट हो रहा है…", call:"📞 मुझे AI से कॉल करें →", privacy:"कोई स्पैम नहीं। एक कॉल साबित करने के लिए। कभी भी ऑप्ट आउट करें।" },
};

// Live showcase + lead activation: visitor enters name + number (+ business context) →
// Guileo's AI calls them. We capture a RICH lead (name, phone, business, industry, need) so
// the call is contextual and the lead is sales-ready. Backend first (outbound), web agent fallback.
export default function LiveCall() {
  const { lang } = useLang();
  const L = LC_COPY[lang] || LC_COPY.en;
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
    <div className="relative overflow-hidden rounded-xl3 bg-gradient-to-br from-white/[0.16] via-white/[0.08] to-g-green/[0.08] backdrop-blur-xl border border-white/25 ring-1 ring-white/10 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.18)] p-6 sm:p-8 max-w-xl mx-auto">
      <style>{`@keyframes lcwave{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}`}</style>
      {/* screen sheen — premium device feel */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.10] to-transparent" />
      <div className="relative flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="grid place-items-center h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-g-green/30 to-g-gold/20 border border-white/20 shadow-soft"><img src={mark} alt="Gui" className="h-10 w-10 object-contain drop-shadow" /></div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full rounded-full bg-g-green/60 animate-ping" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-g-green border-2 border-g-cream" />
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wide text-g-green">{L.live}</span>
            {/* live waveform — reads as a real AI on the line */}
            <span className="flex items-end gap-[2px] h-3" aria-hidden>
              {[0.5, 0.9, 0.4, 1, 0.6, 0.85, 0.45].map((h, i) => (
                <span key={i} className="w-[2px] rounded-full bg-g-green/80" style={{ height: `${h * 100}%`, animation: `lcwave ${0.7 + (i % 3) * 0.18}s ease-in-out ${i * 0.07}s infinite`, transformOrigin: "bottom" }} />
              ))}
            </span>
          </div>
          <h3 className="text-2xl font-extrabold text-g-word leading-tight">{L.title}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm text-g-muted">{L.sub[0]}<span className="text-g-word font-semibold">{L.sub[1]}</span>{L.sub[2]}</p>

      {/* value strip — what happens on the call (boosts activation) */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {L.chips.map(([ic, tx]) => (
          <div key={tx} className="rounded-xl2 border border-white/10 bg-white/[0.04] px-2 py-2.5 text-center">
            <div className="text-lg leading-none">{ic}</div>
            <div className="mt-1 text-[11px] font-semibold text-g-word leading-tight">{tx}</div>
          </div>
        ))}
      </div>

      {state === "done" ? (
        <div className="mt-5 rounded-xl2 bg-g-green/10 p-4 text-center">
          <div className="text-2xl">📞</div>
          <div className="font-bold text-g-word mt-1">{L.doneT}</div>
          <div className="text-sm text-g-muted">{L.doneD[0]}{cc} {phone}{biz ? `${L.doneD[1]}${biz}` : ""}{L.doneD[2]}</div>
        </div>
      ) : state === "web" ? (
        <div className="mt-5 rounded-xl2 bg-g-gold/10 p-4 text-center">
          <div className="text-2xl">🎙️</div>
          <div className="font-bold text-g-word mt-1">{L.webT}</div>
          <div className="text-sm text-g-muted">{L.webD}</div>
        </div>
      ) : (
        <form onSubmit={submit} onFocusCapture={() => setOpen(true)} className="mt-5 grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input required value={name} onChange={(e) => setName(e.target.value)} aria-label={L.name} placeholder={L.name} className={field} />
            <div className="flex gap-2">
              <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label={L.cc} className={`${field} w-auto pr-2`}>
                {DIAL.map(([f, c], i) => <option key={c + i} value={c} className="bg-g-deep">{f} {c}</option>)}
              </select>
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={L.phone} placeholder={L.phone} className={field} />
            </div>
          </div>

          {/* business context — reveals on engage; makes the call contextual + the lead sales-ready */}
          <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <div className="grid gap-3 pt-0.5">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={biz} onChange={(e) => setBiz(e.target.value)} aria-label={L.bizName} placeholder={L.bizName} className={field} />
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label={L.yourInd} className={`${field} ${industry ? "text-g-word" : "text-g-muted"}`}>
                    <option value="" className="bg-g-deep">{L.yourInd}</option>
                    {INDUSTRIES.map((x) => <option key={x} value={x} className="bg-g-deep text-g-word">{x}</option>)}
                  </select>
                </div>
                <input value={need} onChange={(e) => setNeed(e.target.value)} aria-label={L.need} placeholder={L.need} className={field} />
              </div>
            </div>
          </div>

          <motion.button whileTap={{ scale: 0.98 }} disabled={state === "calling"} className="btn-bright text-base disabled:opacity-70">
            {state === "calling" ? L.connecting : L.call}
          </motion.button>
          <p className="text-[11px] text-g-muted text-center">{L.privacy}</p>
        </form>
      )}
    </div>
  );
}
