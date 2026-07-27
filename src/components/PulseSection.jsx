import { useState, useEffect } from "react";
import { useLang } from "../i18n.jsx";

// Live platform CX — real aggregate from the XM engine (/api/pulse-stat → cx_platform_pulse).
// Only surfaces once it's backed by enough real data; otherwise the section stays fully static.
// Two tiers of honesty: once there's enough data (ready) we show the AVG CX; below that floor,
// if any business is already measuring we show the real COUNTS (never a misleading average).
const LIVE_LABEL = {
  en: (cx, b) => `Live: avg CX ${cx} across ${b} Guileo businesses measuring right now`,
  pt: (cx, b) => `Ao vivo: CX médio ${cx} em ${b} negócios Guileo medindo agora`,
  es: (cx, b) => `En vivo: CX promedio ${cx} en ${b} negocios Guileo midiendo ahora`,
  hi: (cx, b) => `लाइव: ${b} Guileo व्यवसायों में औसत CX ${cx}, अभी माप रहे हैं`,
};
const LIVE_COUNT = {
  en: (s, b) => `Live: ${s} customer experiences measured across ${b} Guileo business${b > 1 ? "es" : ""}`,
  pt: (s, b) => `Ao vivo: ${s} experiências de clientes medidas em ${b} negócio${b > 1 ? "s" : ""} Guileo`,
  es: (s, b) => `En vivo: ${s} experiencias de clientes medidas en ${b} negocio${b > 1 ? "s" : ""} Guileo`,
  hi: (s, b) => `लाइव: ${b} Guileo व्यवसाय${b > 1 ? "ों" : ""} में ${s} ग्राहक अनुभव मापे गए`,
};

// PulseSection — landing wedge for GUILEO PULSE, a standalone product:
// "the Qualtrics of the small business, run by AI". It MEASURES the satisfaction of the
// customer-of-the-customer from signals Gui already captures (call sentiment + reviews,
// passive) plus NPS/CSAT/CES (active), computes a CX score + drivers + detractors, and
// CLOSES THE LOOP on unhappy customers. Wedge = a FLAT $49/mo (R$149 in BR) vs the
// per-location incumbents (Birdeye/Podium) and enterprise (Medallia/Qualtrics).
//
// Self-contained: local dict keyed by `lang` from useLang() (same pattern as GrowthV2 /
// LeadCaptureV2). Landing design system only (g-* tokens, rounded-xl3, shadow-lift).
// CTA reuses the site's phone-input "AI calls you" flow (/api/lead noCall + /api/call).

const P = {
  en: {
    eyebrow: "GUILEO PULSE",
    category: "Experience Management · small-business price",
    h1a: "Measure how your customers ",
    h1b: "really feel",
    h1c: " — automatically.",
    sub: "Enterprise-grade experience management, already running — because Gui is already on the calls. No surveys to build, no per-location bill.",
    benefits: [
      { ic: "🎯", t: "A CX score from what you already get", d: "Call sentiment + reviews become one live score. Zero surveys to design — it's measured the moment Gui hangs up." },
      { ic: "🔎", t: "Your top detractor-drivers, this week", d: "See exactly what's dragging you down — wait times, a rude tone, a broken promise — ranked by how much it costs you." },
      { ic: "🔁", t: "Auto close-the-loop before they churn", d: "An unhappy customer? Gui follows up automatically — apologizes, fixes it, wins them back — before they're gone." },
      { ic: "📊", t: "NPS, CSAT & CES without the busywork", d: "Add active surveys when you want them. Passive + active feed the same score — one number that finally means something." },
    ],
    statBig: "40%",
    statText: "of customers who stopped responding said it's because nothing happened the last time they gave feedback.",
    statPunch: "Closing the loop is the whole game. Pulse does it for you.",
    compare: "Enterprise experience management. Small-business price.",
    us: "Pulse — $49/mo, flat",
    usSub: "every location included",
    rivals: [
      { n: "Birdeye · Podium", p: "$300–600 / location / mo" },
      { n: "Medallia · Qualtrics", p: "$20K+ / year" },
    ],
    price: "$49",
    per: "/mo · flat, all locations",
    ctaLine: "See your Pulse score — Gui calls you now.",
    placeholder: "Your phone number",
    cta: "Call me",
    calling: "Calling…",
    done: "📞 Calling you now — pick up!",
    consent: "I agree to get one call from Gui (Guileo). Rates may apply; reply STOP to opt out.",
    consentErr: "Please check the box so Gui can call you.",
    foot: "No surveys to build · live in minutes · cancel anytime",
  },
  pt: {
    eyebrow: "GUILEO PULSE",
    category: "Gestão de Experiência · preço de pequeno negócio",
    h1a: "Meça como seus clientes ",
    h1b: "realmente se sentem",
    h1c: " — no automático.",
    sub: "Gestão de experiência nível enterprise, já rodando — porque a Gui já está nas ligações. Sem pesquisa pra montar, sem conta por unidade.",
    benefits: [
      { ic: "🎯", t: "Um score de CX do que você já recebe", d: "Sentimento das ligações + avaliações viram um score ao vivo. Zero pesquisa pra criar — é medido no instante em que a Gui desliga." },
      { ic: "🔎", t: "Seus maiores motivos de insatisfação, desta semana", d: "Veja exatamente o que te derruba — tempo de espera, tom ríspido, promessa quebrada — ranqueado pelo quanto custa a você." },
      { ic: "🔁", t: "Fecha o ciclo antes do cliente sumir", d: "Cliente insatisfeito? A Gui faz o follow-up sozinha — pede desculpa, resolve, reconquista — antes de ele ir embora." },
      { ic: "📊", t: "NPS, CSAT e CES sem trabalho manual", d: "Adicione pesquisas ativas quando quiser. Passivo + ativo alimentam o mesmo score — um número que finalmente significa algo." },
    ],
    statBig: "40%",
    statText: "dos clientes que pararam de responder disseram que foi porque nada aconteceu da última vez que deram um feedback.",
    statPunch: "Fechar o ciclo é o jogo inteiro. O Pulse faz isso por você.",
    compare: "Gestão de experiência enterprise. Preço de pequeno negócio.",
    us: "Pulse — R$149/mês, fixo",
    usSub: "todas as unidades incluídas",
    rivals: [
      { n: "Birdeye · Podium", p: "US$300–600 / unidade / mês" },
      { n: "Medallia · Qualtrics", p: "US$20K+ / ano" },
    ],
    price: "R$149",
    per: "/mês · fixo, todas as unidades",
    ctaLine: "Veja seu score Pulse — a Gui te liga agora.",
    placeholder: "Seu número de telefone",
    cta: "Me ligar",
    calling: "Ligando…",
    done: "📞 Ligando pra você agora — atende!",
    consent: "Concordo em receber uma ligação da Gui (Guileo). Podem incidir tarifas; responda STOP pra sair.",
    consentErr: "Marque a caixa pra Gui poder te ligar.",
    foot: "Sem pesquisa pra montar · no ar em minutos · cancele quando quiser",
  },
  es: {
    eyebrow: "GUILEO PULSE",
    category: "Gestión de Experiencia · precio de pequeño negocio",
    h1a: "Mide cómo se sienten tus clientes ",
    h1b: "de verdad",
    h1c: " — en automático.",
    sub: "Gestión de experiencia nivel enterprise, ya funcionando — porque Gui ya está en las llamadas. Sin encuestas que armar, sin cobro por local.",
    benefits: [
      { ic: "🎯", t: "Un score de CX de lo que ya recibes", d: "El sentimiento de las llamadas + reseñas se vuelven un score en vivo. Cero encuestas que diseñar — se mide en cuanto Gui cuelga." },
      { ic: "🔎", t: "Tus mayores motivos de insatisfacción, esta semana", d: "Ve exactamente qué te hunde — tiempos de espera, un tono grosero, una promesa rota — ordenado por cuánto te cuesta." },
      { ic: "🔁", t: "Cierra el ciclo antes de que se vayan", d: "¿Un cliente molesto? Gui hace el seguimiento sola — se disculpa, lo resuelve, lo recupera — antes de perderlo." },
      { ic: "📊", t: "NPS, CSAT y CES sin trabajo manual", d: "Agrega encuestas activas cuando quieras. Pasivo + activo alimentan el mismo score — un número que por fin significa algo." },
    ],
    statBig: "40%",
    statText: "de los clientes que dejaron de responder dijeron que fue porque nada pasó la última vez que dieron feedback.",
    statPunch: "Cerrar el ciclo es todo el juego. Pulse lo hace por ti.",
    compare: "Gestión de experiencia enterprise. Precio de pequeño negocio.",
    us: "Pulse — $49/mes, fijo",
    usSub: "todos los locales incluidos",
    rivals: [
      { n: "Birdeye · Podium", p: "$300–600 / local / mes" },
      { n: "Medallia · Qualtrics", p: "$20K+ / año" },
    ],
    price: "$49",
    per: "/mes · fijo, todos los locales",
    ctaLine: "Ve tu score Pulse — Gui te llama ahora.",
    placeholder: "Tu número de teléfono",
    cta: "Llamarme",
    calling: "Llamando…",
    done: "📞 Llamándote ahora — ¡contesta!",
    consent: "Acepto recibir una llamada de Gui (Guileo). Pueden aplicar tarifas; responde STOP para salir.",
    consentErr: "Marca la casilla para que Gui pueda llamarte.",
    foot: "Sin encuestas que armar · en marcha en minutos · cancela cuando quieras",
  },
  hi: {
    eyebrow: "GUILEO PULSE",
    category: "Experience Management · छोटे व्यवसाय की कीमत",
    h1a: "जानें आपके ग्राहक ",
    h1b: "सच में कैसा महसूस करते हैं",
    h1c: " — अपने-आप।",
    sub: "एंटरप्राइज़-स्तर का एक्सपीरियंस मैनेजमेंट, पहले से चालू — क्योंकि Gui पहले से कॉल पर है। कोई सर्वे नहीं बनाना, कोई प्रति-लोकेशन बिल नहीं।",
    benefits: [
      { ic: "🎯", t: "जो पहले से मिल रहा है उसी से CX स्कोर", d: "कॉल सेंटिमेंट + रिव्यू मिलकर एक लाइव स्कोर बनते हैं। कोई सर्वे डिज़ाइन नहीं — Gui के फ़ोन रखते ही माप लिया जाता है।" },
      { ic: "🔎", t: "इस हफ़्ते आपके सबसे बड़े असंतोष के कारण", d: "देखें आपको क्या गिरा रहा है — इंतज़ार, रूखा लहजा, टूटा वादा — इस क्रम में कि आपको कितना महँगा पड़ रहा है।" },
      { ic: "🔁", t: "ग्राहक जाने से पहले लूप बंद करें", d: "नाख़ुश ग्राहक? Gui खुद फ़ॉलो-अप करती है — माफ़ी माँगती है, ठीक करती है, वापस जीतती है — इससे पहले कि वे चले जाएँ।" },
      { ic: "📊", t: "NPS, CSAT और CES बिना मेहनत के", d: "जब चाहें एक्टिव सर्वे जोड़ें। पैसिव + एक्टिव एक ही स्कोर को भरते हैं — एक नंबर जो आख़िरकार मायने रखता है।" },
    ],
    statBig: "40%",
    statText: "ग्राहक जिन्होंने जवाब देना बंद किया, बोले कि पिछली बार फ़ीडबैक देने पर कुछ हुआ ही नहीं, इसीलिए।",
    statPunch: "लूप बंद करना ही पूरा खेल है। Pulse यह आपके लिए करता है।",
    compare: "एंटरप्राइज़ एक्सपीरियंस मैनेजमेंट। छोटे व्यवसाय की कीमत।",
    us: "Pulse — $49/माह, फ़्लैट",
    usSub: "हर लोकेशन शामिल",
    rivals: [
      { n: "Birdeye · Podium", p: "$300–600 / लोकेशन / माह" },
      { n: "Medallia · Qualtrics", p: "$20K+ / वर्ष" },
    ],
    price: "$49",
    per: "/माह · फ़्लैट, सभी लोकेशन",
    ctaLine: "अपना Pulse स्कोर देखें — Gui अभी आपको कॉल करती है।",
    placeholder: "आपका फ़ोन नंबर",
    cta: "मुझे कॉल करें",
    calling: "कॉल हो रही है…",
    done: "📞 अभी आपको कॉल कर रहे हैं — उठाइए!",
    consent: "मैं Gui (Guileo) से एक कॉल पाने के लिए सहमत हूँ। शुल्क लागू हो सकते हैं; ऑप्ट-आउट के लिए STOP भेजें।",
    consentErr: "बॉक्स चेक करें ताकि Gui आपको कॉल कर सके।",
    foot: "कोई सर्वे नहीं बनाना · मिनटों में लाइव · कभी भी रद्द करें",
  },
};

export default function PulseSection() {
  const { lang } = useLang();
  const G = P[lang] || P.en;

  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false); // TCPA — affirmative opt-in before any automated call
  const [err, setErr] = useState(false);
  const [st, setSt] = useState("idle"); // idle · calling · done
  const [live, setLive] = useState(null); // real platform CX pulse (null until fetched; {ready,avg_cx,businesses})

  useEffect(() => {
    let ok = true;
    fetch("/api/pulse-stat").then((r) => (r.ok ? r.json() : null)).then((d) => { if (ok) setLive(d || null); }).catch(() => {});
    return () => { ok = false; };
  }, []);
  const liveText = !live ? null
    : (live.ready && live.avg_cx > 0 && live.businesses > 0)
      ? (LIVE_LABEL[lang] || LIVE_LABEL.en)(live.avg_cx, live.businesses)     // enough data → show avg CX
      : (live.businesses > 0 && live.signals > 0)
        ? (LIVE_COUNT[lang] || LIVE_COUNT.en)(live.signals, live.businesses)  // any data → real counts, no avg
        : null;                                                              // nothing real yet → stay static

  const submit = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !consent) { setErr(true); return; }
    setErr(false);
    setSt("calling");
    // noCall:true → record the lead but don't double-dial; /api/call does the hardened dial (DNC + caps).
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, source: "pulse-landing", consent, lang, noCall: true }) }).catch(() => {});
    try {
      await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }) });
    } catch { /* never block the user */ }
    setSt("done");
  };

  return (
    <section id="pulse" className="relative overflow-hidden px-5 py-20">
      <style>{`@keyframes pureveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes pushine{to{background-position:220% center}}@keyframes puring{to{stroke-dashoffset:47}}@keyframes pudot{0%,100%{opacity:.55}50%{opacity:1}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(720px_380px_at_50%_0%,rgba(62,148,104,0.15),transparent),radial-gradient(680px_360px_at_82%_100%,rgba(214,194,154,0.12),transparent)]" />

      {/* header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-g-gold/40 bg-g-gold/10 px-4 py-1.5 text-[12px] font-black uppercase tracking-[0.24em] text-g-gold" style={{ animation: "pureveal .7s ease both" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-g-gold shadow-[0_0_8px_rgba(214,194,154,0.9)]" style={{ animation: "pudot 2.2s ease-in-out infinite" }} />
          {G.eyebrow}
        </div>
        <div className="mt-3 text-[12.5px] font-bold uppercase tracking-[0.18em] text-g-ink" style={{ animation: "pureveal .8s ease .06s both" }}>{G.category}</div>
        {liveText && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-g-green/40 bg-g-green/[0.1] px-4 py-1.5 text-[12.5px] font-bold text-g-light" style={{ animation: "pureveal .8s ease .14s both" }}>
            <span className="h-2 w-2 rounded-full bg-g-green" style={{ animation: "pudot 1.6s ease-in-out infinite", boxShadow: "0 0 10px rgba(62,148,104,0.9)" }} />
            {liveText}
          </div>
        )}
        <h2 className="mx-auto mt-4 max-w-2xl font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "pureveal .8s cubic-bezier(.2,.7,.2,1) .1s both" }}>{G.h1a}</span>
          <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "pureveal .8s cubic-bezier(.2,.7,.2,1) .22s both, pushine 6s linear infinite" }}>{G.h1b}</span>
          <span className="text-g-word" style={{ animation: "pureveal .8s cubic-bezier(.2,.7,.2,1) .1s both" }}>{G.h1c}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "pureveal .8s ease .3s both" }}>{G.sub}</p>
      </div>

      {/* benefits grid */}
      <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
        {G.benefits.map((b, i) => {
          const rgb = ["62,148,104", "214,194,154", "231,138,51", "194,168,120"][i];
          return (
            <div key={b.t} className="group relative overflow-hidden rounded-xl3 border bg-white/[0.04] p-6 shadow-lift backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06]"
              style={{ borderColor: `rgba(${rgb},0.28)`, animation: `pureveal .7s cubic-bezier(.2,.7,.2,1) ${0.35 + i * 0.1}s both` }}>
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.85),transparent)` }} />
              <span className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl" style={{ background: `rgba(${rgb},0.12)` }} />
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-2xl" style={{ borderColor: `rgba(${rgb},0.35)`, background: `rgba(${rgb},0.1)` }}>{b.ic}</span>
                <div className="min-w-0">
                  <div className="text-[16px] font-extrabold leading-snug text-g-word">{b.t}</div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-g-ink">{b.d}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 40% proof band */}
      <div className="mx-auto mt-6 max-w-4xl overflow-hidden rounded-xl3 border border-g-gold/35 bg-gradient-to-br from-g-gold/[0.1] via-white/[0.03] to-g-green/[0.08] p-7 shadow-lift backdrop-blur-xl sm:p-9" style={{ animation: "pureveal .8s ease .55s both" }}>
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          <div className="shrink-0">
            <div className="bg-gradient-to-br from-g-gold to-g-copper bg-clip-text text-[64px] font-black leading-none tracking-tight text-transparent tabular-nums sm:text-[84px]" style={{ textShadow: "0 0 30px rgba(214,194,154,0.35)" }}>{G.statBig}</div>
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-relaxed text-g-word sm:text-[16.5px]">{G.statText}</p>
            <p className="mt-2 inline-flex items-center gap-2 text-[13.5px] font-bold text-g-green">
              <span className="text-lg">🔁</span> {G.statPunch}
            </p>
          </div>
        </div>
      </div>

      {/* comparison */}
      <div className="mx-auto mt-10 max-w-3xl text-center">
        <div className="text-[12px] font-black uppercase tracking-[0.2em] text-g-gold" style={{ animation: "pureveal .7s ease both" }}>{G.compare}</div>
        <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {/* us */}
          <div className="relative overflow-hidden rounded-2xl border border-g-green/50 bg-g-green/[0.12] px-6 py-4 shadow-gold" style={{ animation: "pureveal .7s ease .1s both" }}>
            <span className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-g-green/20 blur-2xl" />
            <div className="text-[17px] font-black text-g-word">✅ {G.us}</div>
            <div className="mt-0.5 text-[12px] font-semibold text-g-light">{G.usSub}</div>
          </div>
          <span className="hidden text-lg font-black text-g-gold/60 sm:inline">vs</span>
          {/* rivals */}
          {G.rivals.map((r, i) => (
            <div key={r.n} className="rounded-2xl border border-g-line bg-white/[0.03] px-6 py-4 opacity-80" style={{ animation: `pureveal .7s ease ${0.2 + i * 0.08}s both` }}>
              <div className="text-[14.5px] font-bold text-g-ink line-through decoration-g-copper/50">{r.n}</div>
              <div className="mt-0.5 text-[12.5px] font-semibold text-g-muted">{r.p}</div>
            </div>
          ))}
        </div>
      </div>

      {/* price + CTA (AI calls you) */}
      <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-xl3 border border-g-gold/35 bg-white/[0.04] p-7 shadow-lift backdrop-blur-xl sm:p-9" style={{ animation: "pureveal .8s ease .3s both" }}>
        <div className="pointer-events-none absolute -z-10 h-40 w-40 rounded-full bg-g-gold/10 blur-3xl" />
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-center sm:text-left">
            <div className="flex items-end justify-center gap-1.5 sm:justify-start">
              <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-[46px] font-black leading-none tracking-tight text-transparent tabular-nums" style={{ backgroundSize: "220% auto", animation: "pushine 6s linear infinite" }}>{G.price}</span>
              <span className="pb-1 text-[13px] font-bold text-g-ink">{G.per}</span>
            </div>
            <p className="mt-3 text-[14.5px] font-semibold text-g-word">{G.ctaLine}</p>
          </div>
        </div>

        {st === "done" ? (
          <div className="mt-6 rounded-2xl border border-g-green/40 bg-g-green/15 px-5 py-4 text-center text-[15px] font-bold text-g-light">{G.done}</div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={G.placeholder} aria-label={G.placeholder}
                className="flex-1 rounded-full border border-white/20 bg-black/20 px-5 py-3.5 text-[15px] text-g-word placeholder:text-g-muted outline-none transition focus:border-g-green/70" />
              <button type="submit" disabled={st === "calling"} aria-label={G.cta}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-[15px] font-extrabold text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
                <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
                <span className="relative">📞 {st === "calling" ? G.calling : G.cta}</span>
              </button>
            </div>
            <label className={`flex items-start gap-2 text-[11px] leading-snug ${err && !consent ? "text-g-gold" : "text-g-muted"}`}>
              <input type="checkbox" required checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setErr(false); }} className="mt-0.5 h-4 w-4 shrink-0 accent-g-green" />
              <span>{G.consent}</span>
            </label>
            {err && (!phone.trim() || !consent) && <p role="alert" className="text-center text-[12px] font-semibold text-g-gold">{G.consentErr}</p>}
          </form>
        )}
        <p className="mt-4 text-center text-[11.5px] font-semibold text-g-muted">{G.foot}</p>
      </div>
    </section>
  );
}
