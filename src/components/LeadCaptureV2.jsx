import { useState } from "react";
import { waLink, bookLink, CONTACT } from "../data/contact";
import { useLang } from "../i18n.jsx";
import { trackLead } from "../lib/analytics.js";
import ConsentText from "./ConsentText.jsx";
import { PILLAR_COPY } from "./PillarsProducts.jsx";

/* ── O INTERESSE, PELAS TRÊS PERNAS (Luis, 2026-08-19) ─────────────────────────────────────────
   «lembrar do produto AD é importante… e o BUILD: construir ou MELHORAR o seu website. Isso no
   lead tem que ser "quer melhorar?". Deixar o SEU conteúdo, mas aí deixar a NOSSA marca.
   Lembra sempre nosso foco: DESIGN, COR, CONVERSÃO.»

   O fechamento pedia "fale com a Guileo" — interesse genérico numa empresa que vende três coisas
   distintas. Quem leu um plano com Build na Fase 1 e AD na Fase 2 chegava aqui e não encontrava a
   porta pro que acabou de ler. Agora encontra: as três opções são as MESMAS três pernas do resto
   da página, com a cor e o nome vindos de PILLAR_COPY (fonte única — nada de hex redigitado).

   ⚠️ E o interesse não é enfeite: ele vai no corpo do lead (`interest`) E no `source`, então o
   CRM recebe a intenção marcada, não só um nome e um telefone. Selo bonito que não viaja com o
   dado é a mesma promessa sem lastro de sempre.

   🚨 SÓ OFERECE O QUE EXISTE: Brain, AD e Build são produtos reais em productSystem.js. Nenhuma
   quarta opção foi inventada pra encher a linha. */
const INTEREST = {
  en: {
    title: "What do you want to fix first?",
    hint: "Pick one — it comes with your message, so the first reply is already about the right thing.",
    brain: ["The phone & messages", "The agent answering, quoting and booking 24/7 — what this report just measured."],
    ad: ["Marketing bringing customers in", "Ads on Google, Meta and YouTube, reviews and traffic — demand pumped in, measured by bookings."],
    build: ["Build or improve my site / app", "We keep YOUR content and put OUR design on it — you don't throw your site away, you make it convert."],
  },
  pt: {
    title: "O que você quer resolver primeiro?",
    hint: "Escolha uma — ela vai junto com a sua mensagem, então a primeira resposta já é sobre a coisa certa.",
    brain: ["O telefone e as mensagens", "A agente atendendo, cotando e agendando 24/7 — o que este relatório acabou de medir."],
    ad: ["Marketing trazendo cliente", "Anúncios no Google, Meta e YouTube, avaliações e tráfego — movimento pra dentro, medido por agendamento."],
    build: ["Construir ou melhorar meu site / app", "A gente mantém o SEU conteúdo e coloca a NOSSA marca de design — você não joga seu site fora, você faz ele converter."],
  },
  es: {
    title: "¿Qué quieres resolver primero?",
    hint: "Elige una — va junto con tu mensaje, así la primera respuesta ya es sobre lo correcto.",
    brain: ["El teléfono y los mensajes", "La agente atendiendo, cotizando y agendando 24/7 — lo que este informe acaba de medir."],
    ad: ["Marketing trayendo clientes", "Anuncios en Google, Meta y YouTube, reseñas y tráfico — demanda hacia adentro, medida por reservas."],
    build: ["Construir o mejorar mi sitio / app", "Mantenemos TU contenido y le ponemos NUESTRA marca de diseño — no tiras tu sitio, lo haces convertir."],
  },
  hi: {
    title: "पहले क्या ठीक करना है?",
    hint: "एक चुनें — यह आपके संदेश के साथ जाता है, इसलिए पहला जवाब सही चीज़ पर ही होगा।",
    brain: ["फ़ोन और मैसेज", "एजेंट 24/7 जवाब देती, दाम बताती और बुकिंग करती है — जो इस रिपोर्ट ने अभी मापा।"],
    ad: ["मार्केटिंग जो ग्राहक लाए", "Google, Meta और YouTube पर विज्ञापन, रिव्यू और ट्रैफ़िक — बुकिंग से मापी गई माँग।"],
    build: ["मेरी साइट / ऐप बनाएँ या बेहतर करें", "हम आपका कंटेंट रखते हैं और उस पर हमारा डिज़ाइन लगाते हैं — साइट फेंकिए मत, उसे कन्वर्ट कराइए।"],
  },
};

// LeadCaptureV2 — TEST (/v2) close: "Stop losing customers. Start tonight."
// Multi-channel contact capture (the form Luis loves). Posts to /api/lead; a real human
// follows up. Guileo design system. id="contact" so CTAs across the page jump here.

/* ⚠️ O RÓTULO DO CANAL TAMBÉM É TEXTO DA PÁGINA (2026-08-19).
   "Phone" e "Email" apareciam crus, em inglês, no fechamento de um relatório em português —
   exatamente a moldura EN em conteúdo PT que a lei de idioma proíbe. `k` continua sendo a CHAVE
   que viaja no lead (o CRM não pode receber "Telefone" num dia e "Phone" no outro); o que passou
   a existir é `CH_LABEL`, o rótulo que a PESSOA lê. Nome de marca (WhatsApp, Instagram, Telegram,
   LinkedIn, Messenger, X) não se traduz — só os dois canais que são substantivo comum. */
const CH = [
  { k: "WhatsApp", icon: "\ud83d\udcac", ph: "+1 (555) 000-0000" },
  { k: "Phone", icon: "\ud83d\udcde", ph: "+1 (555) 000-0000" },
  { k: "Email", icon: "\u2709\ufe0f", ph: "you@email.com" },
  { k: "Instagram", icon: "\ud83d\udcf8", ph: "@yourhandle" },
  { k: "Telegram", icon: "\u2708\ufe0f", ph: "@yourhandle" },
  { k: "LinkedIn", icon: "\ud83d\udcbc", ph: "linkedin.com/in/you" },
  { k: "Messenger", icon: "\ud83d\udcd8", ph: "facebook.com/you" },
  { k: "X", icon: "\u2716\ufe0f", ph: "@yourhandle" },
];
const CH_LABEL = {
  Phone: { en: "Phone", pt: "Telefone", es: "Tel\u00e9fono", hi: "\u092b\u093c\u094b\u0928" },
  Email: { en: "Email", pt: "E-mail", es: "Correo", hi: "\u0908\u092e\u0947\u0932" },
};
/* rótulo do canal no idioma da página; marca sem tradução volta como está */
const chLabel = (k, lang) => CH_LABEL[k]?.[lang] || CH_LABEL[k]?.en || k;
/* aria-label do campo de contato — "Phone contact" em página PT era o mesmo defeito, só invisível */
const CH_ARIA = {
  en: (n) => `${n} contact`, pt: (n) => `Contato por ${n}`,
  es: (n) => `Contacto por ${n}`, hi: (n) => `${n} \u0938\u0902\u092a\u0930\u094d\u0915`,
};

// ── REUSADO PELO RELATÓRIO DE CRESCIMENTO (2026-08-19) ─────────────────────────────────────────
// Luis viu o fechamento da /apresentacao (dois botões azuis no accent da cliente) e pediu: «esse
// final precisa ter CAPTURA DE LEADS, e ser inteligente e dinâmico. Tira esse AZUL e padroniza
// Guileo. Tipo o lead final da landing que ele gostou. E já deixa WhatsApp, Instagram, telefone,
// tudo em um lugar só, porém EFICIENTE.»
// Então este componente virou reutilizável em vez de ganhar um clone: `embedded` tira o id
// âncora e o respiro de página inteira, e título/sub/origem chegam por prop. Clonar teria criado
// a segunda fonte de sempre — no dia em que o formulário mudar, mudaria só num dos dois.
//
// ⚠️ E DE QUEBRA CONSERTOU UM DEFEITO REAL DA LANDING: os campos, os botões e o estado de sucesso
// eram TEXTO FIXO EM INGLÊS dentro de uma página que já era traduzida — exatamente o "moldura EN
// em conteúdo PT" que a lei de idioma proíbe. Agora os quatro idiomas existem de verdade.
export default function LeadCaptureV2({ lang: langProp, embedded = false, title, sub, source = "v2-lead", interest: showInterest = false } = {}) {
  const ctx = useLang();
  const lang = langProp || ctx.lang;
  const [name, setName] = useState("");
  const [ch, setCh] = useState(0);
  const [val, setVal] = useState("");
  const [biz, setBiz] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done
  const [website, setWebsite] = useState(""); // honeypot — hidden from humans
  const [consent, setConsent] = useState(false); // TCPA — UNCHECKED by default; required affirmative opt-in
  const [err, setErr] = useState(false); // a11y: true when submit fails validation
  const [leg, setLeg] = useState(null);   // a perna escolhida — viaja no lead, não fica só no visual


  const errText = lang === "es" ? "Completa tu nombre y contacto, y acepta el consentimiento." : lang === "pt" ? "Preencha seu nome e contato, e aceite o consentimento." : lang === "hi" ? "अपना नाम और संपर्क भरें, और सहमति बॉक्स चेक करें।" : "Please fill in your name and contact, and check the consent box.";
  const LC = {
    h2a: { en: "Stop losing customers. ", pt: "Pare de perder clientes. ", es: "Deja de perder clientes. ", hi: "ग्राहक खोना बंद करें। " },
    h2b: { en: "Start tonight.", pt: "Comece hoje à noite.", es: "Empieza esta noche.", hi: "आज रात ही शुरू करें।" },
    suba: { en: "Tell us where to reach you. A ", pt: "Diga onde te encontrar. Uma ", es: "Dinos dónde contactarte. Una ", hi: "बताएँ कहाँ संपर्क करें। एक " },
    subHuman: { en: "real human", pt: "pessoa de verdade", es: "persona real", hi: "असली इंसान" },
    subb: { en: " gets back to you fast — usually within hours.", pt: " responde rápido — normalmente em horas.", es: " responde rápido — normalmente en horas.", hi: " जल्दी जवाब देता है — आमतौर पर घंटों में।" },
    fName: { en: "Your name", pt: "Seu nome", es: "Tu nombre", hi: "आपका नाम" },
    fWhere: { en: "Where should we reach you?", pt: "Onde a gente te encontra?", es: "¿Dónde te contactamos?", hi: "आपसे कहाँ संपर्क करें?" },
    fBiz: { en: "Your business (optional)", pt: "Seu negócio (opcional)", es: "Tu negocio (opcional)", hi: "आपका व्यवसाय (वैकल्पिक)" },
    fSend: { en: "Get my free quote →", pt: "Quero minha proposta →", es: "Quiero mi propuesta →", hi: "मेरा मुफ़्त कोटेशन →" },
    fSending: { en: "Sending…", pt: "Enviando…", es: "Enviando…", hi: "भेजा जा रहा है…" },
    fPriv: { en: "No spam. Your info stays private and is only used to contact you.", pt: "Sem spam. Seus dados ficam privados e só são usados para te contatar.", es: "Sin spam. Tus datos quedan privados y solo se usan para contactarte.", hi: "कोई स्पैम नहीं। आपकी जानकारी निजी रहती है और सिर्फ़ संपर्क के लिए इस्तेमाल होती है।" },
    okTitle: { en: "Got it", pt: "Recebido", es: "Recibido", hi: "मिल गया" },
    okBody: { en: "A real human will reach out on", pt: "Uma pessoa de verdade te procura no", es: "Una persona real te contacta por", hi: "एक असली इंसान आपसे संपर्क करेगा:" },
    okSoon: { en: "within hours.", pt: "em algumas horas.", es: "en pocas horas.", hi: "कुछ ही घंटों में।" },
    okWa: { en: "💬 Or message us now on WhatsApp", pt: "💬 Ou fale agora no WhatsApp", es: "💬 O escríbenos ahora por WhatsApp", hi: "💬 या अभी WhatsApp पर लिखें" },
    waNow: { en: "💬 Start on WhatsApp", pt: "💬 Começar no WhatsApp", es: "💬 Empezar por WhatsApp", hi: "💬 WhatsApp पर शुरू करें" },
    book: { en: "📅 Book a demo", pt: "📅 Agendar uma demo", es: "📅 Agendar una demo", hi: "📅 डेमो बुक करें" },
    ig: { en: "📸 Instagram", pt: "📸 Instagram", es: "📸 Instagram", hi: "📸 Instagram" },
    waMsgNow: { en: "Hi Guileo! I'd like to know more.", pt: "Olá, Guileo! Quero saber mais.", es: "¡Hola, Guileo! Quiero saber más.", hi: "नमस्ते Guileo! मैं और जानना चाहता/चाहती हूँ।" },
    waMsgDone: { en: "Hi Guileo! I just left my details on your site.", pt: "Olá, Guileo! Acabei de deixar meus dados no site.", es: "¡Hola, Guileo! Acabo de dejar mis datos en el sitio.", hi: "नमस्ते Guileo! मैंने अभी साइट पर अपनी जानकारी छोड़ी है।" },
    trust: { en: "⚡ Live in under 7 days · 🛡️ 30-day money-back · 🎙️ talk to our AI right now", pt: "⚡ No ar em 7 dias · 🛡️ 30 dias de garantia · 🎙️ fale com nossa IA agora", es: "⚡ En marcha en 7 días · 🛡️ 30 días de garantía · 🎙️ habla con nuestra IA ahora", hi: "⚡ 7 दिनों से कम में लाइव · 🛡️ 30-दिन मनी-बैक · 🎙️ अभी हमारी AI से बात करें" },
  };
  const lc = (k) => LC[k][lang] || LC[k].en;
  const it = INTEREST[lang] || INTEREST.en;
  /* ícone/cor/nome saem de PILLAR_COPY — nenhum hex nem emoji redigitado aqui. O ícone do AD é
     ❤️ para casar com a anatomia que o relatório usa a página inteira (a landing usa 📈). */
  const pil = (k) => (PILLAR_COPY[lang] || PILLAR_COPY.en).pillars.find((x) => x.pilar === k) || {};
  const LEGS = [
    { key: "brain", meta: { ...pil("brain"), icon: "🧠" }, copy: it.brain },
    { key: "ad", meta: { ...pil("ad"), icon: "❤️" }, copy: it.ad },
    { key: "build", meta: { ...pil("build"), icon: "🏗️" }, copy: it.build },
  ];
  const nameBad = err && !name.trim();
  const valBad = err && !val.trim();
  const consentBad = err && !consent;

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !val.trim() || !consent) { setErr(true); return; }
    setErr(false);
    setStatus("sending");
    const c = CH[ch];
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, channel: c.k, contact: val, phone: /phone|whatsapp/i.test(c.k) ? val : "", email: c.k === "Email" ? val : "", business: biz, website, consent, interest: leg || "", source: leg ? `${source}:${leg}` : source, lang }),
      });
    } catch { /* never block the user */ }
    trackLead(); // fire-and-forget; no-ops until pixel IDs are set
    setStatus("done");
  }

  return (
    <section {...(embedded ? {} : { id: "contact" })} className={`relative overflow-hidden ${embedded ? "mt-16" : "px-5 py-24"}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_400px_at_50%_0%,rgba(62,148,104,0.12),transparent)]" />
      <style>{`@keyframes lcreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes lcshine{to{background-position:220% center}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      {/* ⛔ brilho ancorado na borda REMOVIDO — nascia na força máxima na 1ª linha da seção e
          desenhava a costura horizontal. A luz agora vem da camada contínua em Home.jsx. */}

      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)" }}>
          <span className="text-g-word" style={{ animation: "lcreveal .8s cubic-bezier(.2,.7,.2,1) both" }}>{title ? title : lc("h2a")}</span>
          <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "lcreveal .8s cubic-bezier(.2,.7,.2,1) .15s both, lcshine 7s linear infinite" }}>{title ? "" : lc("h2b")}</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-g-ink" style={{ animation: "lcreveal .8s ease .25s both" }}>
          {sub ? sub : <>{lc("suba")}<span className="font-semibold text-g-word">{lc("subHuman")}</span>{lc("subb")}</>}
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-xl rounded-xl3 border border-g-line bg-white/[0.04] p-6 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-8" style={{ animation: "lcreveal .8s ease .35s both" }}>
        {status === "done" ? (
          <div className="py-8 text-center">
            <div className="text-4xl">🌱</div>
            <div className="mt-3 text-[20px] font-bold text-g-word">{lc("okTitle")}, {name.split(" ")[0] || "\u2728"}!</div>
            <p className="mt-1 text-[14px] text-g-ink">{lc("okBody")} <span className="font-semibold text-g-green">{chLabel(CH[ch].k, lang)}</span> {lc("okSoon")}</p>
            <a href={waLink(lc("waMsgDone"))} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-[14px] font-bold text-black">{lc("okWa")}</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {/* honeypot: invisible to humans, bots auto-fill it → server silently drops */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
              value={website} onChange={(e) => setWebsite(e.target.value)}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={lc("fName")} aria-label={lc("fName")} aria-invalid={nameBad} aria-describedby={nameBad ? "lcv2-err" : undefined} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />

            {/* ── O INTERESSE, PELAS TRÊS PERNAS (ver INTEREST no topo) ────────────────────
                   Primeiro campo do formulário de propósito: escolher a perna é a decisão que dá
                   sentido a todo o resto, e é ela que faz o CTA fechar o mesmo eixo que a página
                   inteira usa. Cor e nome vêm de PILLAR_COPY. */}
            {showInterest && (
              <div>
                <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-g-muted">{it.title}</div>
                <div className="grid gap-2">
                  {LEGS.map(({ key, meta, copy }) => {
                    const on = leg === key;
                    return (
                      <button type="button" key={key} onClick={() => setLeg(on ? null : key)}
                        aria-pressed={on}
                        className="flex items-start gap-3 rounded-xl border p-3 text-left transition"
                        style={{
                          borderColor: on ? meta.accent : "rgba(255,255,255,0.10)",
                          background: on ? `${meta.accent}1A` : "rgba(255,255,255,0.03)",
                        }}>
                        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[17px]"
                          style={{ background: `${meta.accent}22`, boxShadow: `inset 0 0 0 1px ${meta.accent}66` }}>{meta.icon}</span>
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-bold leading-tight" style={{ color: on ? meta.accent : "#EFEAE0" }}>{copy[0]}</span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-g-ink">{copy[1]}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11.5px] leading-snug text-g-muted">{it.hint}</p>
              </div>
            )}

            <div>
              <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-g-muted">{lc("fWhere")}</div>
              <div className="flex flex-wrap gap-1.5">
                {CH.map((c, i) => (
                  /* Mesmo alvo de 44px do LeadForm: este bloco também é um seletor de contato. */
                  <button type="button" key={c.k} onClick={() => { setCh(i); setVal(""); }}
                    className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition sm:min-h-0 ${i === ch ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line bg-white/[0.03] text-g-muted hover:text-g-word"}`}>
                    {c.icon} {chLabel(c.k, lang)}
                  </button>
                ))}
              </div>
            </div>

            <input value={val} onChange={(e) => setVal(e.target.value)} required placeholder={CH[ch].ph} aria-label={(CH_ARIA[lang] || CH_ARIA.en)(chLabel(CH[ch].k, lang))} aria-invalid={valBad} aria-describedby={valBad ? "lcv2-err" : undefined} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <input value={biz} onChange={(e) => setBiz(e.target.value)} placeholder={lc("fBiz")} aria-label={lc("fBiz")} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />

            {/* TCPA consent — REQUIRED, unchecked by default (affirmative opt-in) */}
            <label className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-snug transition ${consentBad ? "border-g-gold/70 bg-g-gold/10 text-g-word" : "border-g-line bg-white/[0.03] text-g-muted"}`}>
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={consentBad} aria-describedby={consentBad ? "lcv2-err" : undefined}
                className="mt-0.5 h-4 w-4 shrink-0 accent-g-green" />
              <span><ConsentText lang={lang} /></span>
            </label>

            {err && <p id="lcv2-err" role="alert" className="text-center text-[12.5px] font-semibold text-g-gold">{errText}</p>}
            <button type="submit" disabled={status === "sending"} className="w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110 disabled:opacity-60">
              {status === "sending" ? lc("fSending") : lc("fSend")}
            </button>
            <p className="text-center text-[11.5px] text-g-muted">{lc("fPriv")}</p>
          </form>
        )}
      </div>

      <div className="mx-auto mt-6 max-w-xl text-center" style={{ animation: "lcreveal .8s ease .5s both" }}>
        <div className="text-[12.5px] font-semibold text-g-muted">{lc("trust")}</div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a href={waLink(lc("waMsgNow"))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-5 py-2.5 text-[14px] font-bold text-g-word transition hover:border-g-green/40">{lc("waNow")}</a>
          <a href={bookLink()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-5 py-2.5 text-[14px] font-bold text-g-word transition hover:border-g-green/40">{lc("book")}</a>
          {CONTACT.socials.instagram && (
            <a href={CONTACT.socials.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-5 py-2.5 text-[14px] font-bold text-g-word transition hover:border-g-green/40">{lc("ig")}</a>
          )}
        </div>
      </div>
    </section>
  );
}
