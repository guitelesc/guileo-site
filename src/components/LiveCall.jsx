import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { waLink } from "../data/contact.js";
import { normalizePhoneWithCc, phonePlaceholder } from "../lib/intl.js";
import ConsentText from "./ConsentText.jsx";

const DIAL = [["🇺🇸", "+1"], ["🇧🇷", "+55"], ["🇵🇹", "+351"], ["🇪🇸", "+34"], ["🇬🇧", "+44"], ["🇲🇽", "+52"], ["🇦🇷", "+54"], ["🇮🇳", "+91"], ["🇦🇺", "+61"]];
const INDUSTRIES = [
  { v: "Restaurant", en: "Restaurant", pt: "Restaurante", es: "Restaurante" },
  { v: "Clinic / Dental", en: "Clinic / Dental", pt: "Clínica / Odonto", es: "Clínica / Dental" },
  { v: "Salon & Spa", en: "Salon & Spa", pt: "Salão e Spa", es: "Salón & Spa" },
  { v: "Law Firm", en: "Law Firm", pt: "Advocacia", es: "Bufete de Abogados" },
  { v: "E-Commerce", en: "E-Commerce", pt: "E-Commerce", es: "E-Commerce" },
  { v: "Real Estate", en: "Real Estate", pt: "Imóveis", es: "Inmobiliaria" },
  { v: "Gym & Fitness", en: "Gym & Fitness", pt: "Academia e Fitness", es: "Gimnasio & Fitness" },
  { v: "Medical", en: "Medical", pt: "Médico", es: "Médico" },
  { v: "Home Services", en: "Home Services", pt: "Serviços Domésticos", es: "Servicios del Hogar" },
  { v: "Auto", en: "Auto", pt: "Automotivo", es: "Automotriz" },
  { v: "Education", en: "Education", pt: "Educação", es: "Educación" },
  { v: "Construction", en: "Construction", pt: "Construção", es: "Construcción" },
  { v: "Other", en: "Other", pt: "Outro", es: "Otro" },
];

// Optional email — unlocks the post-demo ROI report (/api/roi-report). Never required.
const EMAIL_PH = {
  en: "Email — get your free analysis (optional)",
  pt: "Email — receba sua análise grátis (opcional)",
  es: "Email — recibe tu análisis gratis (opcional)",
  hi: "ईमेल — मुफ़्त विश्लेषण पाएँ (वैकल्पिक)",
};

const LC_COPY = {
  en: { live:"Live · try it on yourself", title:"Let Gui call you — and sell you, right now", sub:["Drop your number and a line about your business. Gui rings your phone in seconds — and shows you exactly how it'll answer, qualify and sell for ","you",". This is the product, working live."], chips:[["📞","Rings in seconds"],["🤝","Talks like your best rep"],["📅","Books & quotes live"]], doneT:"Calling you now — pick up!", doneD:["Gui is dialing "," about ",". That's what your customers will feel, 24/7."], webT:"Got your number ✓", webD:"Gui will ring you back in a moment. Want to talk right now? Message us on WhatsApp.", waBtn:"Chat on WhatsApp", waMsg:"Hi Guileo! I just tried the live call — can we talk?", name:"Your name", cc:"Country code", phone:"Your phone", bizName:"Business name", yourInd:"Your industry", need:"What should Gui handle? (e.g. book appointments, recover carts) — optional", connecting:"Connecting…", call:"📞 Call me with AI →", privacy:"No spam. One call to prove it works. Opt out anytime.", consent:"I agree to receive an automated phone call from Guileo at this number. Consent isn't a condition of purchase; message/data rates may apply.", consentErr:"Please check the consent box so Gui can call you.", bridgeT:"So — did you like it? 🌱", bridgeD:"Gui can answer JUST like that for your business, starting today — plans from $149/mo, 30-day money-back.", bridgeBtn:"See plans →", bridgeAlt:"Prefer a human to call you?", doneFrom:"The call comes from +1 986-444-3334 — it may show as an unknown number, so pick up.", doneWa:"Didn't ring? Talk to me on WhatsApp", skipT:"Just called you moments ago", skipD:"I dialed your number a moment ago — check your recent calls, or reach me on WhatsApp." },
  pt: { live:"Ao vivo · teste em você", title:"Deixe a Gui te ligar — e te vender, agora", sub:["Coloque seu número e uma linha sobre seu negócio. A Gui liga em segundos — e mostra exatamente como vai atender, qualificar e vender por ","você",". Este é o produto, ao vivo."], chips:[["📞","Liga em segundos"],["🤝","Fala como seu melhor vendedor"],["📅","Agenda & orça ao vivo"]], doneT:"Ligando pra você agora — atende!", doneD:["A Gui está ligando pra "," sobre ",". É o que seus clientes vão sentir, 24/7."], webT:"Recebemos seu número ✓", webD:"A Gui te liga de volta já já. Quer falar agora? Chama no WhatsApp.", waBtn:"Falar no WhatsApp", waMsg:"Oi Guileo! Acabei de testar a ligação ao vivo — podemos falar?", name:"Seu nome", cc:"Código do país", phone:"Seu telefone", bizName:"Nome do negócio", yourInd:"Seu setor", need:"O que a Gui deve fazer? (ex: agendar, recuperar carrinhos) — opcional", connecting:"Conectando…", call:"📞 Me ligar com IA →", privacy:"Sem spam. Uma ligação pra provar. Saia quando quiser.", consent:"Concordo em receber uma ligação automática da Guileo neste número. O consentimento não é condição de compra; podem aplicar tarifas de mensagem/dados.", consentErr:"Marque a caixa de consentimento para a Gui poder te ligar.", bridgeT:"E aí, gostou? 🌱", bridgeD:"Ela pode atender ASSIM pro seu negócio ainda hoje — planos a partir de US$ 149/mês, 30 dias de garantia.", bridgeBtn:"Ver planos →", bridgeAlt:"Prefere que um humano te ligue?", doneFrom:"A ligação sai do +1 986-444-3334 — pode aparecer como número desconhecido, então atende.", doneWa:"Não tocou? Fala comigo no WhatsApp", skipT:"Acabei de te ligar há instantes", skipD:"Acabei de te ligar há instantes — confere as chamadas recentes, ou chama no WhatsApp." },
  es: { live:"En vivo · pruébalo en ti", title:"Deja que Gui te llame — y te venda, ahora", sub:["Pon tu número y una línea sobre tu negocio. Gui suena en segundos — y te muestra exactamente cómo contestará, calificará y venderá por ","ti",". Este es el producto, en vivo."], chips:[["📞","Suena en segundos"],["🤝","Habla como tu mejor vendedor"],["📅","Agenda & cotiza en vivo"]], doneT:"Llamándote ahora — ¡contesta!", doneD:["Gui está llamando a "," sobre ",". Eso es lo que sentirán tus clientes, 24/7."], webT:"Recibimos tu número ✓", webD:"Gui te llama de vuelta en un momento. ¿Quieres hablar ahora? Escríbenos por WhatsApp.", waBtn:"Hablar por WhatsApp", waMsg:"¡Hola Guileo! Acabo de probar la llamada en vivo — ¿podemos hablar?", name:"Tu nombre", cc:"Código de país", phone:"Tu teléfono", bizName:"Nombre del negocio", yourInd:"Tu industria", need:"¿Qué debe hacer Gui? (ej: agendar, recuperar carritos) — opcional", connecting:"Conectando…", call:"📞 Llámame con IA →", privacy:"Sin spam. Una llamada para probarlo. Sal cuando quieras.", consent:"Acepto recibir una llamada telefónica automática de Guileo a este número. El consentimiento no es condición de compra; pueden aplicar tarifas de mensaje/datos.", consentErr:"Marca la casilla de consentimiento para que Gui pueda llamarte.", bridgeT:"¿Y? ¿Te gustó? 🌱", bridgeD:"Gui puede contestar ASÍ por tu negocio desde hoy — planes desde $149/mes, 30 días de garantía.", bridgeBtn:"Ver planes →", bridgeAlt:"¿Prefieres que te llame un humano?", doneFrom:"La llamada sale del +1 986-444-3334 — puede aparecer como número desconocido, así que contesta.", doneWa:"¿No sonó? Habla conmigo por WhatsApp", skipT:"Acabo de llamarte hace un momento", skipD:"Acabo de llamarte hace un momento — revisa tus llamadas recientes, o escríbeme por WhatsApp." },
  hi: { live:"लाइव · खुद पर आज़माएँ", title:"Gui को आपको कॉल करने दें — और अभी बेचने दें", sub:["अपना नंबर और अपने व्यवसाय की एक लाइन डालें। Gui सेकंडों में कॉल करती है — और दिखाती है कि वह कैसे जवाब देगी, क्वालिफाई करेगी और ","आपके"," लिए बेचेगी। यह उत्पाद है, लाइव।"], chips:[["📞","सेकंडों में कॉल"],["🤝","आपके बेहतरीन रेप जैसी बात"],["📅","लाइव बुकिंग & कोटेशन"]], doneT:"अभी आपको कॉल कर रहे हैं — उठाएँ!", doneD:["Gui कॉल कर रही है "," के बारे में ",". यही आपके ग्राहक महसूस करेंगे, 24/7।"], webT:"आपका नंबर मिल गया ✓", webD:"Gui थोड़ी देर में आपको वापस कॉल करेगी। अभी बात करना चाहते हैं? हमें WhatsApp पर संदेश करें।", waBtn:"WhatsApp पर बात करें", waMsg:"नमस्ते Guileo! मैंने अभी लाइव कॉल आज़माया — क्या हम बात कर सकते हैं?", name:"आपका नाम", cc:"देश कोड", phone:"आपका फ़ोन", bizName:"व्यवसाय का नाम", yourInd:"आपका उद्योग", need:"Gui को क्या संभालना चाहिए? (जैसे: बुकिंग, कार्ट रिकवरी) — वैकल्पिक", connecting:"कनेक्ट हो रहा है…", call:"📞 मुझे AI से कॉल करें →", privacy:"कोई स्पैम नहीं। एक कॉल साबित करने के लिए। कभी भी ऑप्ट आउट करें।", consent:"मैं इस नंबर पर Guileo से एक स्वचालित फ़ोन कॉल प्राप्त करने के लिए सहमत हूँ। सहमति खरीद की शर्त नहीं है; संदेश/डेटा दरें लागू हो सकती हैं।", consentErr:"कृपया सहमति बॉक्स पर टिक करें ताकि Gui आपको कॉल कर सके।", bridgeT:"तो — कैसा लगा? 🌱", bridgeD:"Gui आज से ही आपके व्यवसाय के लिए ऐसे ही जवाब दे सकती है — प्लान $149/माह से, 30-दिन मनी-बैक।", bridgeBtn:"प्लान देखें →", bridgeAlt:"चाहते हैं कि कोई इंसान आपको कॉल करे?", doneFrom:"कॉल +1 986-444-3334 से आती है — यह अनजान नंबर के रूप में दिख सकती है, इसलिए उठाइए।", doneWa:"फ़ोन नहीं बजा? मुझसे WhatsApp पर बात करें", skipT:"मैंने अभी-अभी आपको कॉल किया", skipD:"मैंने अभी-अभी आपके नंबर पर कॉल किया — अपनी हाल की कॉल देखें, या मुझे WhatsApp पर संपर्क करें।" },
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
  const [email, setEmail] = useState(""); // optional — unlocks the free ROI-report email
  const [biz, setBiz] = useState("");
  const [industry, setIndustry] = useState("");
  const [need, setNeed] = useState("");
  const [open, setOpen] = useState(false); // progressive: business context reveals on engage
  const [state, setState] = useState("idle"); // idle · calling · done · web
  const [consent, setConsent] = useState(false); // TCPA — REQUIRED, unchecked affirmative opt-in before any call
  const [err, setErr] = useState(false); // a11y: true when submit blocked by missing consent
  const [bridge, setBridge] = useState(false); // demo→pricing bridge: warms in ~45s after the call fires

  // i18n phone normalization: E.164 for the APIs + a live "we assumed +55" hint when the
  // typed number contradicts the selected country code (BR visitors on the +1 default).
  const pn = useMemo(() => normalizePhoneWithCc(phone, cc, lang), [phone, cc, lang]);

  // The hottest moment on the site: ~45s after Gui dials (call is underway/finished),
  // surface the next step — plans. Timer cleared on unmount; never shows pre-call.
  useEffect(() => {
    if (state !== "done" && state !== "web" && state !== "skipped") return;
    const id = setTimeout(() => setBridge(true), 45000);
    return () => clearTimeout(id);
  }, [state]);

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) { setErr(true); return; } // TCPA gate: no automated call without prior express consent
    setErr(false);
    setState("calling");
    // Send normalized E.164 to the APIs (was raw "cc phone"); fall back to raw if normalization
    // produced nothing (shouldn't happen — the input is required).
    const full = pn.ok && pn.e164 ? pn.e164 : `${cc} ${phone}`.trim();
    // noCall:true → /api/lead records + emails the lead but does NOT also auto-dial; we trigger the
    // call ourselves below (one ring, not two). The actual dial still passes call.js's DNC + caps.
    // lang rides along so the auto-nurture drip (lifecycle.js) follows up in the LEAD's language
    const lead = { name, phone: full, email, business: biz, industry, need, consent, lang, source: "live-call", noCall: true };
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) }).catch(() => {});
    // best-effort ROI report ("receba sua análise grátis") — only when they left an email; zero
    // impact on the call flow (fire-and-forget, endpoint skips silently without an email).
    if (email.trim()) {
      fetch("/api/roi-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email: email.trim(), phone: full, business: biz, industry, lang }) }).catch(() => {});
    }
    try {
      const r = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone: full, business: biz, industry, need }) });
      if (r.ok) {
        // /api/call returns 200 { skipped } when this number was dialed moments ago (per-destination
        // cooldown). Don't claim "dialing now" — show the honest "just called you" state instead.
        const j = await r.json().catch(() => ({}));
        setState(j && j.skipped ? "skipped" : "done");
        return;
      }
      throw new Error("no backend");
    } catch {
      // The lead is already saved above (/api/lead) — Gui auto-calls back. Show an honest
      // fallback with a WhatsApp shortcut instead of pretending the call connected.
      setState("web");
    }
  };

  const field = "rounded-full border border-white/20 bg-black/25 px-5 py-3 text-base text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition w-full";

  return (
    <div className="relative overflow-hidden rounded-xl3 bg-gradient-to-br from-white/[0.16] via-white/[0.08] to-g-green/[0.08] backdrop-blur-xl border border-white/25 ring-1 ring-white/10 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.18)] p-6 sm:p-8 max-w-xl mx-auto">
      <style>{`@keyframes lcwave{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}@keyframes lcember{0%,100%{opacity:.5}50%{opacity:.9}}@media (prefers-reduced-motion: reduce){[style*="lcwave"],[style*="lcember"]{animation:none !important}}`}</style>
      {/* screen sheen — premium device feel */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.10] to-transparent" />
      {/* Gui signature ember — warm orange glow in the corner where the AI lives */}
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-12 h-44 w-44 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side,rgba(255,138,51,0.20),transparent)", animation: "lcember 6s ease-in-out infinite" }} />
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
        <div role="status" className="mt-5 rounded-xl2 bg-g-green/10 p-4 text-center">
          <div className="text-2xl">📞</div>
          <div className="font-bold text-g-word mt-1">{L.doneT}</div>
          <div className="text-sm text-g-muted">{L.doneD[0]}{pn.ok && pn.e164 ? pn.e164 : `${cc} ${phone}`}{biz ? `${L.doneD[1]}${biz}` : ""}{L.doneD[2]}</div>
          {/* honest caller-ID note — the call comes from the platform line and may show as unknown */}
          <div className="mt-2 text-[12px] text-g-muted">{L.doneFrom}</div>
          {/* immediate WhatsApp fallback — if it didn't ring, one tap reaches Gui right away */}
          <div className="mt-2 text-[12px] text-g-muted">{L.doneWa}</div>
          <a href={waLink(L.waMsg)} target="_blank" rel="noopener" className="btn-bright text-sm mt-2 inline-flex">💬 {L.waBtn}</a>
          {bridge && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl2 border border-white/15 bg-white/[0.05] p-4 text-center">
              <div className="font-bold text-g-word">{L.bridgeT}</div>
              <p className="mt-1 text-sm text-g-muted">{L.bridgeD}</p>
              <a href="/planos" className="btn-bright text-sm mt-3 inline-flex">{L.bridgeBtn}</a>
              <div><a href="/#contact" className="mt-2 inline-block text-[12px] font-semibold text-g-muted underline underline-offset-2 hover:text-g-word transition">{L.bridgeAlt}</a></div>
            </motion.div>
          )}
        </div>
      ) : state === "skipped" ? (
        // /api/call de-duped this number (dialed moments ago). Be honest: we just called —
        // don't say "dialing now" — and offer WhatsApp as the instant alternative.
        <div role="status" className="mt-5 rounded-xl2 bg-g-gold/10 p-4 text-center">
          <div className="text-2xl">📞</div>
          <div className="font-bold text-g-word mt-1">{L.skipT}</div>
          <div className="text-sm text-g-muted">{L.skipD}</div>
          <a href={waLink(L.waMsg)} target="_blank" rel="noopener" className="btn-bright text-sm mt-3 inline-flex">💬 {L.waBtn}</a>
          {bridge && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl2 border border-white/15 bg-white/[0.05] p-4 text-center">
              <div className="font-bold text-g-word">{L.bridgeT}</div>
              <p className="mt-1 text-sm text-g-muted">{L.bridgeD}</p>
              <a href="/planos" className="btn-bright text-sm mt-3 inline-flex">{L.bridgeBtn}</a>
              <div><a href="/#contact" className="mt-2 inline-block text-[12px] font-semibold text-g-muted underline underline-offset-2 hover:text-g-word transition">{L.bridgeAlt}</a></div>
            </motion.div>
          )}
        </div>
      ) : state === "web" ? (
        <div role="status" className="mt-5 rounded-xl2 bg-g-gold/10 p-4 text-center">
          <div className="text-2xl">✅</div>
          <div className="font-bold text-g-word mt-1">{L.webT}</div>
          <div className="text-sm text-g-muted">{L.webD}</div>
          <a href={waLink(L.waMsg)} target="_blank" rel="noopener" className="btn-bright text-sm mt-3 inline-flex">💬 {L.waBtn}</a>
          {bridge && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl2 border border-white/15 bg-white/[0.05] p-4 text-center">
              <div className="font-bold text-g-word">{L.bridgeT}</div>
              <p className="mt-1 text-sm text-g-muted">{L.bridgeD}</p>
              <a href="/planos" className="btn-bright text-sm mt-3 inline-flex">{L.bridgeBtn}</a>
              <div><a href="/#contact" className="mt-2 inline-block text-[12px] font-semibold text-g-muted underline underline-offset-2 hover:text-g-word transition">{L.bridgeAlt}</a></div>
            </motion.div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} onFocusCapture={() => setOpen(true)} className="mt-5 grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input required value={name} onChange={(e) => setName(e.target.value)} aria-label={L.name} placeholder={L.name} className={field} />
            <div className="flex gap-2">
              <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label={L.cc} className={`${field} w-auto pr-2`}>
                {DIAL.map(([f, c], i) => <option key={c + i} value={c} className="bg-g-deep">{f} {c}</option>)}
              </select>
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={L.phone} placeholder={phonePlaceholder(lang)} className={field} />
            </div>
          </div>

          {/* country-assumption hint — only when we normalized to something the cc select doesn't show */}
          {pn.hint && <p className="text-[11px] text-g-muted px-2 -mt-1" role="status">📞 {pn.e164} · {pn.hint}</p>}

          {/* optional email — small, non-required: unlocks the free post-demo ROI analysis */}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label={EMAIL_PH[lang] || EMAIL_PH.en} placeholder={EMAIL_PH[lang] || EMAIL_PH.en} className={`${field} py-2.5 text-sm`} />

          {/* business context — reveals on engage; makes the call contextual + the lead sales-ready */}
          <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <div className="grid gap-3 pt-0.5">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={biz} onChange={(e) => setBiz(e.target.value)} aria-label={L.bizName} placeholder={L.bizName} className={field} />
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label={L.yourInd} className={`${field} ${industry ? "text-g-word" : "text-g-muted"}`}>
                    <option value="" className="bg-g-deep">{L.yourInd}</option>
                    {INDUSTRIES.map((x) => <option key={x.v} value={x.v} className="bg-g-deep text-g-word">{x[lang] || x.en}</option>)}
                  </select>
                </div>
                <input value={need} onChange={(e) => setNeed(e.target.value)} aria-label={L.need} placeholder={L.need} className={field} />
              </div>
            </div>
          </div>

          {/* TCPA consent — REQUIRED, unchecked by default; gates the automated call */}
          <label className={`flex items-start gap-2 rounded-xl2 border px-3 py-2.5 text-[11px] leading-snug transition ${err && !consent ? "border-g-gold/70 bg-g-gold/10 text-g-word" : "border-white/15 bg-white/[0.04] text-g-muted"}`}>
            <input type="checkbox" required checked={consent}
              onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setErr(false); }}
              aria-invalid={err && !consent} aria-describedby={err && !consent ? "livecall-consent-err" : undefined}
              className="mt-0.5 h-4 w-4 shrink-0 accent-g-green" />
            <span><ConsentText lang={lang} /></span>
          </label>
          {err && !consent && <p id="livecall-consent-err" role="alert" className="text-center text-[12px] font-semibold text-g-gold">{L.consentErr}</p>}
          <motion.button whileTap={{ scale: 0.98 }} disabled={state === "calling" || !consent} className="btn-bright text-base disabled:opacity-70 disabled:cursor-not-allowed" style={{ boxShadow: "0 0 32px -4px rgba(255,138,51,0.45)" }}>
            {state === "calling" ? L.connecting : L.call}
          </motion.button>
          <p className="text-[11px] text-g-muted text-center">{L.privacy}</p>
        </form>
      )}
    </div>
  );
}
