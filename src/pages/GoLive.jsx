import { useState } from "react";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { ACTIVATION_STEPS, pickL } from "../data/activation.js";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";

// "Go-Live" onboarding wizard — a polished multi-step flow a new client lands on to
// activate their Gui. Fully self-contained (local step state, no router). On final
// submit it POSTs a high-intent signup to /api/lead so it lands in /admin for setup.

const INDUSTRIES = [
  { v: "restaurant", en: "Restaurant", pt: "Restaurante", es: "Restaurante", hi: "रेस्टोरेंट" },
  { v: "dental", en: "Dental", pt: "Odontologia", es: "Dental", hi: "डेंटल" },
  { v: "medical", en: "Medical clinic", pt: "Clínica médica", es: "Clínica médica", hi: "मेडिकल क्लिनिक" },
  { v: "salon", en: "Salon", pt: "Salão de beleza", es: "Salón", hi: "सैलून" },
  { v: "home-services", en: "Home services", pt: "Serviços para casa", es: "Servicios a domicilio", hi: "होम सर्विस" },
  { v: "real-estate", en: "Real estate", pt: "Imobiliária", es: "Inmobiliaria", hi: "रियल एस्टेट" },
  { v: "law", en: "Law firm", pt: "Escritório de advocacia", es: "Bufete de abogados", hi: "लॉ फ़र्म" },
  { v: "gym", en: "Gym", pt: "Academia", es: "Gimnasio", hi: "जिम" },
  { v: "auto", en: "Auto", pt: "Automotivo", es: "Automotriz", hi: "ऑटो" },
  { v: "ecommerce", en: "E-commerce", pt: "E-commerce", es: "E-commerce", hi: "ई-कॉमर्स" },
  { v: "other", en: "Other", pt: "Outro", es: "Otro", hi: "अन्य" },
];

const LANGS = [
  { v: "EN", en: "English", pt: "Inglês", es: "Inglés", hi: "अंग्रेज़ी" },
  { v: "PT", en: "Portuguese", pt: "Português", es: "Portugués", hi: "पुर्तगाली" },
  { v: "ES", en: "Spanish", pt: "Espanhol", es: "Español", hi: "स्पेनिश" },
];

const CAPABILITIES = [
  { v: "answer-calls", ic: "📞", en: "Answer calls", pt: "Atender ligações", es: "Contestar llamadas", hi: "कॉल का जवाब" },
  { v: "book-appointments", ic: "📅", en: "Book appointments", pt: "Agendar horários", es: "Agendar citas", hi: "अपॉइंटमेंट बुकिंग" },
  { v: "take-orders", ic: "🛒", en: "Take orders", pt: "Receber pedidos", es: "Tomar pedidos", hi: "ऑर्डर लेना" },
  { v: "qualify-leads", ic: "🎯", en: "Qualify leads", pt: "Qualificar leads", es: "Calificar leads", hi: "लीड क्वालिफ़ाई करना" },
  { v: "missed-call-textback", ic: "💬", en: "Missed-call text-back", pt: "SMS para chamada perdida", es: "SMS por llamada perdida", hi: "मिस्ड-कॉल टेक्स्ट-बैक" },
  { v: "reviews", ic: "⭐", en: "Reviews", pt: "Avaliações", es: "Reseñas", hi: "रिव्यू" },
  { v: "win-back", ic: "🔄", en: "Win-back", pt: "Recuperar clientes", es: "Recuperar clientes", hi: "विन-बैक" },
];

export default function GoLive() {
  const { lang } = useLang();
  const pt = lang === "pt";
  const es = lang === "es";
  const hi = lang === "hi";
  // 4th arg = Hindi; long-tail strings without it fall back to English.
  const t = (en, ptStr, esStr, hiStr) => (hi ? (hiStr ?? en) : es ? (esStr ?? en) : pt ? ptStr : en);
  const lbl = (o) => (hi ? (o.hi ?? o.en) : es ? (o.es ?? o.en) : pt ? o.pt : o.en);

  const [step, setStep] = useState(0); // 0..3
  const [state, setState] = useState("idle"); // idle | sending | done

  // Step 1 — business
  const [bizName, setBizName] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");

  // Step 2 — customers
  const [langs, setLangs] = useState(() => new Set(["EN"]));
  const [phone, setPhone] = useState("");
  const [caps, setCaps] = useState(() => new Set(["answer-calls", "book-appointments"]));

  // Step 3 — teach Gui
  const [brain, setBrain] = useState("");
  const [prices, setPrices] = useState(""); // menu/services + prices → lets Gui QUOTE exact amounts and charge
  const [agentName, setAgentName] = useState(""); // optional white-label name; empty → "Gui"
  const [contactName, setContactName] = useState("");
  const [contact, setContact] = useState("");

  const toggleSet = (setter, key) =>
    setter((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const STEPS = [
    { en: "Your business", pt: "Seu negócio", es: "Tu negocio", hi: "आपका व्यवसाय" },
    { en: "Your customers", pt: "Seus clientes", es: "Tus clientes", hi: "आपके ग्राहक" },
    { en: "Teach Gui", pt: "Ensine a Gui", es: "Enseña a Gui", hi: "Gui को सिखाएँ" },
    { en: "Review & activate", pt: "Revisar e ativar", es: "Revisar y activar", hi: "जाँचें और चालू करें" },
  ];

  // a contact must be a real email OR a real phone — block garbage ("asdf") so the Stripe webhook can
  // actually match the customer and deliver their connection code (T1.2).
  const isValidContact = (v) => /(^[^\s@]+@[^\s@]+\.[^\s@]+$)|(^[\d+\-\s()]{7,}$)/.test((v || "").trim());
  // required fields per step → gate the Next button
  const canNext = [
    bizName.trim() && industry,
    langs.size > 0 && phone.trim() && caps.size > 0,
    brain.trim() && contactName.trim() && isValidContact(contact),
    true,
  ][step];

  const industryLabel = () => { const f = INDUSTRIES.find((i) => i.v === industry); return f ? lbl(f) : ""; };
  const capLabels = () => CAPABILITIES.filter((c) => caps.has(c.v)).map((c) => lbl(c));
  const langLabels = () => LANGS.filter((l) => langs.has(l.v)).map((l) => l.v);

  const activate = async () => {
    if (!canNext || state === "sending") return;
    setState("sending");
    const capsEn = CAPABILITIES.filter((c) => caps.has(c.v)).map((c) => c.en).join(", ");
    const industryEn = INDUSTRIES.find((i) => i.v === industry)?.en || industry;
    // message concatenates brain/notes + capabilities + industry → lands as a rich,
    // high-intent signup in /admin that a human can act on immediately
    const message =
      `GO-LIVE SIGNUP — ${industryEn}. Wants Gui to: ${capsEn || "—"}. ` +
      `Languages: ${langLabels().join(", ") || "EN"}. ` +
      `Business: ${bizName.trim()}${city.trim() ? `, ${city.trim()}` : ""}.` +
      (brain.trim() ? ` Notes: ${brain.trim()}` : "") +
      (prices.trim() ? ` PRICES/MENU (quote exactly from this): ${prices.trim()}` : "");
    const lead = {
      name: contactName.trim(),
      contact: contact.trim(),
      phone: phone.trim() || contact.trim(),
      business: bizName.trim().slice(0, 160),
      industry: industryEn,
      city: city.trim(),
      website: website.trim(),
      languages: langLabels(),
      capabilities: CAPABILITIES.filter((c) => caps.has(c.v)).map((c) => c.v),
      message,
      source: "go-live-wizard",
      channel: "Go-Live wizard",
      lang,
      consent: true,
    };
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch { /* best-effort — never crash the activation */ }
    // AUTO-PROVISION HOOK — store the brain keyed by email so that when they pay (/planos),
    // the Stripe webhook builds their trained Gui automatically. Only when contact is an email
    // (the webhook matches by the Stripe payer email). Best-effort; never blocks activation.
    const emailContact = contact.trim();
    if (emailContact.includes("@")) {
      try {
        await fetch("/api/selfserve-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailContact,
            business: bizName.trim(),
            industry: industryEn,
            lang,
            brain: message,           // the full rich brain (notes + capabilities + industry + business)
            phone: phone.trim(),
            agent_name: agentName.trim(),  // white-label name; empty → defaults to "Gui"
          }),
        });
      } catch { /* best-effort — paying still works, falls back to a basic Gui */ }
    }
    setState("done");
  };

  useSeo({
    title: t("Activate your Gui | Guileo", "Ative sua Gui | Guileo", "Activa tu Gui | Guileo", "अपनी Gui चालू करें | Guileo"),
    description: t(
      "Go live in minutes — a guided wizard to activate your AI agent. Tell Gui about your business and a human sets it up, usually within hours.",
      "No ar em minutos — um assistente guiado pra ativar sua IA. Conte à Gui sobre seu negócio e um humano configura, normalmente em horas.",
      "En marcha en minutos — un asistente guiado para activar tu IA. Cuéntale a Gui sobre tu negocio y una persona lo configura, normalmente en horas.",
      "मिनटों में लाइव — आपकी AI चालू करने का गाइडेड विज़ार्ड। Gui को अपने व्यवसाय के बारे में बताएँ और एक इंसान इसे सेट करता है, आम तौर पर कुछ घंटों में।"
    ),
    path: "/go-live",
  });

  const field = "w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-base text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60 transition";

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />
      <main className="relative overflow-hidden px-5 pb-24 pt-28">
        <style>{`
          @keyframes glpop{0%{transform:scale(.92)}60%{transform:scale(1.05)}100%{transform:scale(1)}}
          @keyframes glfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
        `}</style>

        <div className="mx-auto max-w-3xl">
          {/* header */}
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-g-green/80">{t("Go-Live", "Ativação", "Activación", "एक्टिवेशन")}</div>
            <h1 className="mt-2 text-[30px] font-black leading-tight text-g-word sm:text-[38px]">{t("Activate your Gui 🚀", "Ative sua Gui 🚀", "Activa tu Gui 🚀", "अपनी Gui चालू करें 🚀")}</h1>
            <p className="mx-auto mt-2 max-w-xl text-[14px] text-g-ink">{t("Four quick steps, then pick your plan — your trained Gui goes live automatically.", "Quatro passos rápidos, depois escolha seu plano — sua Gui treinada entra no ar automaticamente.", "Cuatro pasos rápidos, luego elige tu plan — tu Gui entrenada se activa automáticamente.", "चार तेज़ कदम, फिर अपना प्लान चुनें — आपकी ट्रेन्ड Gui अपने आप लाइव हो जाती है।")}</p>
          </div>

          {/* progress — numbered badges */}
          {state !== "done" && (
            <div className="mt-8 flex items-center justify-center gap-2 sm:gap-3">
              {STEPS.map((s, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <div key={i} className="flex items-center gap-2 sm:gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[14px] font-black transition-all duration-300 ${
                        active ? "border-g-green/60 bg-g-green/15 text-g-green shadow-[0_0_16px_rgba(62,148,104,0.35)]"
                        : done ? "border-g-gold/50 bg-g-gold/15 text-g-gold"
                        : "border-white/15 bg-white/[0.03] text-g-muted"}`}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={`mt-1.5 hidden text-[10px] font-bold uppercase tracking-wide sm:block ${active ? "text-g-green" : done ? "text-g-gold/80" : "text-g-muted"}`}>{lbl(s)}</span>
                    </div>
                    {i < STEPS.length - 1 && <span className={`h-px w-6 sm:w-10 ${i < step ? "bg-g-gold/50" : "bg-white/15"}`} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* card */}
          <div className="mt-8 rounded-[1.75rem] border border-g-green/20 bg-g-green/[0.04] p-6 shadow-lift backdrop-blur-xl sm:p-8"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 34px 90px -44px rgba(0,0,0,0.85)" }}>

            {state === "done" ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center text-center" style={{ animation: "glfade .4s ease" }}>
                <div className="text-6xl">🎉</div>
                <div className="mt-4 text-2xl font-black text-g-word">{t("Gui knows your business!", "A Gui já conhece seu negócio!", "¡Gui ya conoce tu negocio!", "Gui आपका व्यवसाय जान गई!")}</div>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-g-light">{t("One step left: choose your plan. The moment you pay, your trained Gui is created automatically — no waiting. Right after payment we email you a connection code; log into your dashboard with this same email and paste it to unlock your real data.", "Falta um passo: escolha seu plano. No momento em que você paga, sua Gui treinada é criada automaticamente — sem espera. Logo após o pagamento enviamos um código de conexão por e-mail; entre no painel com este mesmo e-mail e cole o código para ver seus dados reais.", "Falta un paso: elige tu plan. En el momento en que pagas, tu Gui entrenada se crea automáticamente — sin esperas. Justo después del pago te enviamos un código de conexión por correo; entra al panel con este mismo correo y pega el código para ver tus datos reales.")}</p>
                <a href="/planos" className="btn-bright mt-7 text-[15px]">{t("Choose my plan & activate Gui →", "Escolher meu plano & ativar a Gui →", "Elegir mi plan y activar a Gui →", "प्लान चुनें और Gui चालू करें →")}</a>
                <a href="/portal" className="mt-4 text-[13px] font-bold text-g-muted hover:text-g-word">{t("or preview the dashboard first", "ou ver o painel antes", "o ver el panel primero", "या पहले डैशबोर्ड देखें")}</a>

                {/* Activation step-by-step — so the client knows exactly how to go live (one source: data/activation.js) */}
                <div className="mt-10 w-full max-w-md text-left">
                  <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-g-gold">{t("How activation works", "Como funciona a ativação", "Cómo funciona la activación", "एक्टिवेशन कैसे काम करता है")}</div>
                  <ol className="space-y-2.5">
                    {ACTIVATION_STEPS.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-g-light">
                        <span className="font-black text-g-green">{i + 1}.</span>
                        <span><b className="text-g-word">{s.icon} {pickL(s.title, lang)}</b> — {pickL(s.body, lang)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              <div style={{ animation: "glfade .35s ease" }} key={step}>
                {/* ---------- STEP 1 — Your business ---------- */}
                {step === 0 && (
                  <div className="space-y-4">
                    <StepHead n={1} title={t("Your business", "Seu negócio", "Tu negocio", "आपका व्यवसाय")} sub={t("The basics so Gui knows who it represents.", "O básico pra Gui saber quem representa.", "Lo básico para que Gui sepa a quién representa.", "बुनियादी बातें, ताकि Gui जाने वह किसका प्रतिनिधित्व करती है।")} />
                    <Label text={t("Business name", "Nome do negócio", "Nombre del negocio", "व्यवसाय का नाम")} req>
                      <input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder={t("e.g. Bella Vista Clinic", "ex: Clínica Bella Vista", "ej: Clínica Bella Vista")} className={field} />
                    </Label>
                    <Label text={t("Industry", "Setor", "Industria", "उद्योग")} req>
                      <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={`${field} ${industry ? "" : "text-g-muted"}`}>
                        <option value="" disabled>{t("Select your industry…", "Selecione seu setor…", "Selecciona tu industria…", "अपना उद्योग चुनें…")}</option>
                        {INDUSTRIES.map((i) => <option key={i.v} value={i.v} style={{ background: "#0e1512", color: "#fff" }}>{lbl(i)}</option>)}
                      </select>
                    </Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Label text={t("City", "Cidade", "Ciudad", "शहर")}>
                        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("e.g. Miami, FL", "ex: Lisboa", "ej: Madrid")} className={field} />
                      </Label>
                      <Label text={t("Website", "Site", "Sitio web", "वेबसाइट")} optional>
                        <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={field} />
                      </Label>
                    </div>
                  </div>
                )}

                {/* ---------- STEP 2 — Your customers ---------- */}
                {step === 1 && (
                  <div className="space-y-5">
                    <StepHead n={2} title={t("Your customers", "Seus clientes", "Tus clientes", "आपके ग्राहक")} sub={t("How Gui talks to them, and what it handles.", "Como a Gui fala com eles, e o que ela cuida.", "Cómo Gui les habla, y de qué se encarga.", "Gui उनसे कैसे बात करे, और क्या-क्या संभाले।")} />
                    <div>
                      <div className="text-[13px] font-bold text-g-light">{t("Languages Gui should speak", "Idiomas que a Gui deve falar", "Idiomas que Gui debe hablar", "Gui को कौन-सी भाषाएँ बोलनी चाहिए")} <span className="text-g-green">*</span></div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {LANGS.map((l) => {
                          const on = langs.has(l.v);
                          return (
                            <button type="button" key={l.v} onClick={() => toggleSet(setLangs, l.v)}
                              className={`min-h-[44px] rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all active:scale-[0.97] ${on ? "border-g-green/55 bg-g-green/[0.12] text-g-word shadow-[0_10px_30px_-16px_rgba(62,148,104,0.85)]" : "border-white/10 bg-white/[0.03] text-g-ink hover:border-g-green/35 hover:text-g-word"}`}
                              style={on ? { animation: "glpop .3s ease" } : undefined}>
                              {on ? "✓ " : ""}{lbl(l)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Label text={t("Main phone number", "Telefone principal", "Teléfono principal", "मुख्य फ़ोन नंबर")} req>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("Where customers call you", "Onde os clientes ligam", "Donde te llaman los clientes", "जहाँ ग्राहक आपको कॉल करते हैं")} className={field} />
                    </Label>
                    <div>
                      <div className="text-[13px] font-bold text-g-light">{t("What should Gui handle?", "O que a Gui deve cuidar?", "¿De qué se debe encargar Gui?", "Gui को क्या संभालना चाहिए?")} <span className="text-g-green">*</span></div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {CAPABILITIES.map((c) => {
                          const on = caps.has(c.v);
                          return (
                            <button type="button" key={c.v} onClick={() => toggleSet(setCaps, c.v)}
                              className={`group flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition-all duration-200 active:scale-[0.97] ${on ? "border-g-green/55 bg-g-green/[0.12] text-g-word shadow-[0_10px_30px_-16px_rgba(62,148,104,0.85)]" : "border-white/10 bg-white/[0.03] text-g-ink hover:-translate-y-0.5 hover:border-g-green/35 hover:text-g-word"}`}>
                              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base ring-1 transition ${on ? "bg-g-green/25 ring-g-green/50" : "bg-g-green/[0.07] ring-g-green/15"}`} style={on ? { animation: "glpop .3s ease" } : undefined}>{c.ic}</span>
                              <span className="flex-1 leading-tight">{lbl(c)}</span>
                              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black transition ${on ? "bg-g-green text-black" : "bg-white/[0.06] text-g-muted"}`}>{on ? "✓" : "+"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------- STEP 3 — Teach Gui ---------- */}
                {step === 2 && (
                  <div className="space-y-4">
                    <StepHead n={3} title={t("Teach Gui", "Ensine a Gui", "Enseña a Gui", "Gui को सिखाएँ")} sub={t("The more you share, the sharper Gui sounds on day one.", "Quanto mais você conta, melhor a Gui soa no primeiro dia.", "Cuanto más compartas, mejor sonará Gui desde el primer día.", "आप जितना बताएँगे, पहले दिन से Gui उतनी ही सटीक लगेगी।")} />
                    <Label text={t("Tell Gui about your business", "Conte à Gui sobre seu negócio", "Cuéntale a Gui sobre tu negocio", "Gui को अपने व्यवसाय के बारे में बताएँ")} req>
                      <textarea value={brain} onChange={(e) => setBrain(e.target.value)} rows={6}
                        placeholder={t("Hours, services, prices, location, anything Gui should know…", "Horários, serviços, preços, localização, tudo que a Gui deve saber…", "Horarios, servicios, precios, ubicación, cualquier cosa que Gui deba saber…", "समय, सेवाएँ, कीमतें, पता — जो कुछ Gui को पता होना चाहिए…")}
                        className={`${field} resize-none`} />
                    </Label>
                    <Label text={t("Menu / services & prices", "Cardápio / serviços & preços", "Menú / servicios y precios", "मेनू / सेवाएँ और कीमतें")} optional>
                      <textarea value={prices} onChange={(e) => setPrices(e.target.value)} rows={4}
                        placeholder={/restaur|food|pizza|caf|bar|bakery|deli|grill|kitchen|burger/i.test(industry)
                          ? t("List items + prices so Gui can quote & charge — e.g. Large pizza $18, Soda $3. (And which delivery apps you use: Uber Eats, DoorDash, Grubhub…)", "Liste itens + preços pra Gui orçar e cobrar — ex: Pizza grande $18, Refri $3. (E quais apps de delivery você usa: Uber Eats, DoorDash, Grubhub…)", "Lista ítems + precios para que Gui cotice y cobre — ej: Pizza grande $18, Refresco $3. (Y qué apps de delivery usas: Uber Eats, DoorDash, Grubhub…)")
                          : t("List your services + prices (and any deposit) so Gui can quote & charge — e.g. Cleaning $120, Deposit $20.", "Liste serviços + preços (e depósito) pra Gui orçar e cobrar — ex: Limpeza $120, Depósito $20.", "Lista servicios + precios (y depósito) para que Gui cotice y cobre — ej: Limpieza $120, Depósito $20.")}
                        className={`${field} resize-none`} />
                    </Label>
                    <Label text={t("Name your assistant", "Nome do seu atendente", "Nombra a tu asistente", "अपने असिस्टेंट का नाम रखें")} optional>
                      <input value={agentName} onChange={(e) => setAgentName(e.target.value)}
                        placeholder={t("e.g. Sofia — leave empty to use \"Gui\"", "ex: Sofia — vazio = usa \"Gui\"", "ej: Sofía — vacío = usa \"Gui\"")} className={field} />
                    </Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Label text={t("Your name", "Seu nome", "Tu nombre", "आपका नाम")} req>
                        <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t("Your name", "Seu nome", "Tu nombre", "आपका नाम")} className={field} />
                      </Label>
                      <Label text={t("Email or phone", "Email ou telefone", "Correo o teléfono", "ईमेल या फ़ोन")} req>
                        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t("How we reach you", "Como te contatamos", "Cómo te contactamos", "हम आपसे कैसे संपर्क करें")} className={field} />
                      </Label>
                    </div>
                  </div>
                )}

                {/* ---------- STEP 4 — Review & activate ---------- */}
                {step === 3 && (
                  <div className="space-y-5">
                    <StepHead n={4} title={t("Review & activate", "Revisar & ativar", "Revisar y activar", "जाँचें और चालू करें")} sub={t("One last look, then we bring Gui to life.", "Uma última olhada, e damos vida à Gui.", "Un último vistazo, y le damos vida a Gui.", "एक आख़िरी नज़र, फिर हम Gui को ज़िंदा करते हैं।")} />
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-5">
                      <Row label={t("Business", "Negócio", "Negocio", "व्यवसाय")} value={bizName.trim() || "—"} />
                      <Row label={t("Industry", "Setor", "Industria", "उद्योग")} value={industryLabel() || "—"} />
                      {city.trim() && <Row label={t("City", "Cidade", "Ciudad", "शहर")} value={city.trim()} />}
                      {website.trim() && <Row label={t("Website", "Site", "Sitio web", "वेबसाइट")} value={website.trim()} />}
                      <Row label={t("Languages", "Idiomas", "Idiomas", "भाषाएँ")} value={langLabels().join(", ") || "—"} />
                      <Row label={t("Main phone", "Telefone", "Teléfono", "मुख्य फ़ोन")} value={phone.trim() || "—"} />
                      <Row label={t("Gui handles", "A Gui cuida de", "Gui maneja", "Gui संभालती है")} value={capLabels().join(", ") || "—"} />
                      <Row label={t("Contact", "Contato", "Contacto", "संपर्क")} value={`${contactName.trim()} · ${contact.trim()}`} />
                      {brain.trim() && (
                        <div className="pt-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-g-muted">{t("Notes for Gui", "Notas pra Gui", "Notas para Gui", "Gui के लिए नोट्स")}</div>
                          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-g-light">{brain.trim()}</p>
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={activate} disabled={state === "sending"} className="btn-bright w-full py-4 text-[16px] disabled:opacity-60">
                      {state === "sending" ? t("Activating…", "Ativando…", "Activando…", "चालू हो रही है…") : t("Activate my Gui 🚀", "Ativar minha Gui 🚀", "Activar mi Gui 🚀", "मेरी Gui चालू करें 🚀")}
                    </button>
                    <p className="text-center text-[11px] text-g-muted">{t("No spam · a human reviews it with you · 30-day money-back", "Sem spam · um humano revisa com você · garantia de 30 dias", "Sin spam · una persona lo revisa contigo · garantía de 30 días", "कोई स्पैम नहीं · एक इंसान आपके साथ इसकी समीक्षा करता है · 30-दिन मनी-बैक")}</p>
                  </div>
                )}

                {/* nav buttons */}
                {step < 3 && (
                  <div className="mt-7 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
                      className="btn-ghost text-[14px] disabled:opacity-30">
                      ← {t("Back", "Voltar", "Atrás", "पीछे")}
                    </button>
                    <button type="button" onClick={() => canNext && setStep((s) => Math.min(3, s + 1))} disabled={!canNext}
                      className="btn-bright text-[14px] disabled:opacity-40 disabled:hover:scale-100">
                      {t("Next", "Próximo", "Siguiente", "आगे")} →
                    </button>
                  </div>
                )}
                {step === 3 && (
                  <div className="mt-5">
                    <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="btn-ghost text-[14px]">
                      ← {t("Back", "Voltar", "Atrás", "पीछे")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <VoiceAgent />
      <Footer />
    </div>
  );
}

function StepHead({ n, title, sub }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-g-green/50 bg-g-green/15 text-[17px] font-black text-g-green shadow-[0_0_16px_rgba(62,148,104,0.35)]">{n}</span>
      <div>
        <div className="text-[16px] font-black text-g-word">{title}</div>
        {sub && <div className="text-[12.5px] text-g-muted">{sub}</div>}
      </div>
    </div>
  );
}

function Label({ text, req, optional, children }) {
  const { lang } = useLang();
  const optWord = { en: "(optional)", pt: "(opcional)", es: "(opcional)", hi: "(वैकल्पिक)" }[lang] || "(optional)";
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-g-light">
        {text}
        {req && <span className="text-g-green"> *</span>}
        {optional && <span className="font-normal text-g-muted"> {optWord}</span>}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[13px]">
      <span className="shrink-0 font-bold uppercase tracking-wider text-g-muted">{label}</span>
      <span className="text-right font-semibold text-g-word">{value}</span>
    </div>
  );
}
