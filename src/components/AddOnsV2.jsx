import { useLang } from "../i18n.jsx";

// AddOnsV2 — "Power-ups": add-ons & offers section. Lives right after #pricing.
// Locked design language (GrowthV2/LegsV2): cement bg, glass cards, champagne eyebrow,
// one shimmer phrase, free-floating emojis with colored glow, CSS keyframes only.

const AO_COPY = {
  en: {
    eyebrow: "💎 Add-ons · stack your growth",
    h1a: "Your plan ",
    h1b: "grows with you.",
    sub: "Start lean, then stack power-ups when you're ready — each one pays its own way.",
    badge: "🔥 best first step",
    champBadge: "🔥 closes more",
    cta: "Add to my package",
    partnerCta: "Become a partner",
    items: [
      { e: "💳", n: "No-show Shield", p: "Gui collects a deposit on every booking — no-shows pay for themselves.", pr: "+$97/mo", tg: "salons · clinics · dental" },
      { e: "⚡", n: "Speed-to-Lead 60s", p: "Every ad & marketplace lead (Yelp, Angi, Thumbtack…) gets a call from Gui within 60 seconds — be the first, win the deal.", pr: "+$197/mo", tg: "kills slow follow-up" },
      { e: "♻️", n: "Reactivation Blitz", p: "Your dormant client list, reactivated in one week. You only serve who comes back.", pr: "from $497 · one-time", tg: "instant ROI" },
      { e: "⭐", n: "Reputation Machine", p: "Reviews requested, answered in your tone, low ratings flagged instantly.", pr: "+$147/mo", tg: "local SEO" },
      { e: "🎬", n: "Content Autopilot", p: "4 posts a week in your brand's voice — your Instagram never sleeps.", pr: "+$197/mo", tg: "Guileo.AD" },
      { e: "📲", n: "Official WhatsApp", p: "Verified green-badge WhatsApp Business with Gui inside.", pr: "setup $297", tg: "trust seal" },
      { e: "🛡️", n: "Compliance TCPA/A2P", p: "We register, capture consent and auto opt-out — your texts never blocked, you never fined.", pr: "setup $297", tg: "USA legal shield", href: "/compliance" },
      { e: "🌎", n: "Nossa Gente Package", p: "Gui in Portuguese/Spanish/English — built for immigrant-owned & immigrant-serving businesses.", pr: "included", tg: "bilingual edge", href: "/nossa-gente" },
    ],
    wl: { n: "White-label for agencies", p: "Resell Gui under your brand. We run the engine, you keep the relationship — and the margin." },
    an: { n: "Annual plan", p: "Pay yearly, get 2 months free." },
  },
  pt: {
    eyebrow: "💎 Add-ons · turbine seu plano",
    h1a: "Seu plano ",
    h1b: "cresce com você.",
    sub: "Comece enxuto e adicione power-ups quando estiver pronto — cada um se paga sozinho.",
    badge: "🔥 melhor primeiro passo",
    champBadge: "🔥 fecha mais",
    cta: "Adicionar ao meu pacote",
    partnerCta: "Seja parceiro",
    items: [
      { e: "💳", n: "Depósito anti-falta", p: "O Gui cobra um depósito em cada agendamento — a falta paga a si mesma.", pr: "+$97/mês", tg: "salões · clínicas · dentistas" },
      { e: "⚡", n: "Resposta em 60 segundos", p: "Todo lead de anúncio e de marketplace (Yelp, Angi, Thumbtack…) recebe uma ligação do Gui em 60 segundos — seja o primeiro, feche a venda.", pr: "+$197/mês", tg: "acaba com o follow-up lento" },
      { e: "♻️", n: "Blitz de Reativação", p: "Sua lista de clientes sumidos, reativada em uma semana. Você só atende quem voltar.", pr: "a partir de $497 · único", tg: "ROI imediato" },
      { e: "⭐", n: "Máquina de Reputação", p: "Avaliações pedidas e respondidas no seu tom; nota baixa alerta na hora.", pr: "+$147/mês", tg: "SEO local" },
      { e: "🎬", n: "Conteúdo no Automático", p: "4 posts por semana na voz da sua marca — seu Instagram nunca dorme.", pr: "+$197/mês", tg: "Guileo.AD" },
      { e: "📲", n: "WhatsApp Oficial", p: "WhatsApp Business verificado com selo + o Gui dentro.", pr: "setup $297", tg: "selo de confiança" },
      { e: "🛡️", n: "Compliance TCPA/A2P", p: "Registro A2P, consentimento e opt-out automático — mensagem nunca bloqueada, você nunca multado.", pr: "setup $297", tg: "escudo legal EUA", href: "/compliance" },
      { e: "🌎", n: "Nossa Gente", p: "Gui em português/espanhol/inglês — feito pra negócios da nossa comunidade.", pr: "incluso", tg: "vantagem bilíngue", href: "/nossa-gente" },
    ],
    wl: { n: "White-label para agências", p: "Revenda o Gui com a sua marca. A gente roda o motor, você fica com o relacionamento — e a margem." },
    an: { n: "Plano anual", p: "No anual, 2 meses grátis." },
  },
  es: {
    eyebrow: "💎 Add-ons · potencia tu plan",
    h1a: "Tu plan ",
    h1b: "crece contigo.",
    sub: "Empieza ligero y suma power-ups cuando estés listo — cada uno se paga solo.",
    badge: "🔥 mejor primer paso",
    champBadge: "🔥 cierra más",
    cta: "Añadir a mi paquete",
    partnerCta: "Sé socio",
    items: [
      { e: "💳", n: "Escudo anti-plantón", p: "Gui cobra un depósito en cada reserva — la ausencia se paga sola.", pr: "+$97/mes", tg: "salones · clínicas · dental" },
      { e: "⚡", n: "Respuesta en 60 segundos", p: "Cada lead de anuncio y de marketplace (Yelp, Angi, Thumbtack…) recibe una llamada de Gui en 60 segundos — sé el primero, cierra la venta.", pr: "+$197/mes", tg: "acaba con el follow-up lento" },
      { e: "♻️", n: "Blitz de Reactivación", p: "Tu lista de clientes dormidos, reactivada en una semana. Solo atiendes a quien vuelve.", pr: "desde $497 · único", tg: "ROI inmediato" },
      { e: "⭐", n: "Máquina de Reputación", p: "Reseñas pedidas y respondidas en tu tono; nota baja alerta al instante.", pr: "+$147/mes", tg: "SEO local" },
      { e: "🎬", n: "Contenido en Automático", p: "4 posts por semana con la voz de tu marca — tu Instagram nunca duerme.", pr: "+$197/mes", tg: "Guileo.AD" },
      { e: "📲", n: "WhatsApp Oficial", p: "WhatsApp Business verificado con sello + Gui dentro.", pr: "setup $297", tg: "sello de confianza" },
      { e: "🛡️", n: "Compliance TCPA/A2P", p: "Registro A2P, consentimiento y opt-out automático — mensaje nunca bloqueado, tú nunca multado.", pr: "setup $297", tg: "escudo legal EE.UU.", href: "/compliance" },
      { e: "🌎", n: "Nuestra Gente", p: "Gui en portugués/español/inglés — hecho para negocios de nuestra comunidad.", pr: "incluido", tg: "ventaja bilingüe", href: "/nossa-gente" },
    ],
    wl: { n: "White-label para agencias", p: "Revende a Gui con tu marca. Nosotros movemos el motor, tú te quedas con la relación — y el margen." },
    an: { n: "Plan anual", p: "Paga anual y llévate 2 meses gratis." },
  },
  hi: {
    eyebrow: "💎 ऐड-ऑन · अपना प्लान बढ़ाएँ",
    h1a: "आपका प्लान ",
    h1b: "आपके साथ बढ़ता है।",
    sub: "हल्के से शुरू करें, तैयार होने पर पावर-अप जोड़ें — हर एक अपनी कीमत खुद निकालता है।",
    badge: "🔥 सबसे अच्छा पहला कदम",
    champBadge: "🔥 ज़्यादा डील बंद",
    cta: "मेरे पैकेज में जोड़ें",
    partnerCta: "पार्टनर बनें",
    items: [
      { e: "💳", n: "नो-शो शील्ड", p: "Gui हर बुकिंग पर डिपॉज़िट लेता है — नो-शो की भरपाई खुद हो जाती है।", pr: "+$97/माह", tg: "सैलून · क्लिनिक · डेंटल" },
      { e: "⚡", n: "60 सेकंड में जवाब", p: "हर ऐड और मार्केटप्लेस लीड (Yelp, Angi, Thumbtack…) को 60 सेकंड में Gui कॉल करता है — पहले बनें, डील जीतें।", pr: "+$197/माह", tg: "धीमे फॉलो-अप का अंत" },
      { e: "♻️", n: "रीएक्टिवेशन ब्लिट्ज़", p: "आपकी सोई हुई क्लाइंट लिस्ट, एक हफ्ते में वापस। आप सिर्फ लौटने वालों को सेवा देते हैं।", pr: "$497 से · एक बार", tg: "तुरंत ROI" },
      { e: "⭐", n: "रेपुटेशन मशीन", p: "रिव्यू माँगे और आपके अंदाज़ में जवाब; कम रेटिंग पर तुरंत अलर्ट।", pr: "+$147/माह", tg: "लोकल SEO" },
      { e: "🎬", n: "कंटेंट ऑटोपायलट", p: "हफ्ते में 4 पोस्ट, आपके ब्रांड की आवाज़ में — आपका Instagram कभी नहीं सोता।", pr: "+$197/माह", tg: "Guileo.AD" },
      { e: "📲", n: "ऑफिशियल WhatsApp", p: "वेरिफ़ाइड ग्रीन-बैज WhatsApp Business + अंदर Gui।", pr: "सेटअप $297", tg: "भरोसे की मुहर" },
      { e: "🛡️", n: "Compliance TCPA/A2P", p: "A2P रजिस्ट्रेशन, सहमति और ऑटो ऑप्ट-आउट — मैसेज कभी ब्लॉक नहीं, आप पर कभी जुर्माना नहीं।", pr: "सेटअप $297", tg: "USA कानूनी कवच", href: "/compliance" },
      { e: "🌎", n: "हमारे लोग", p: "Gui पुर्तगाली/स्पैनिश/अंग्रेज़ी में — हमारे समुदाय के व्यवसायों के लिए बना।", pr: "शामिल", tg: "द्विभाषी बढ़त", href: "/nossa-gente" },
    ],
    wl: { n: "एजेंसियों के लिए व्हाइट-लेबल", p: "Gui को अपने ब्रांड के नाम से बेचें। इंजन हम चलाते हैं, रिश्ता — और मार्जिन — आपका।" },
    an: { n: "वार्षिक प्लान", p: "सालाना भुगतान करें, 2 महीने मुफ़्त पाएँ।" },
  },
};

// accent rgb + price-pill flavor per card (green = monthly revenue, gold = one-time/premium)
// `champion` = the #1 sales weapon: champagne ring + its own "fecha mais" badge.
// Order optimized for conversion + retention: recurring/instant-ROI lead, one-time/setup trail.
const META = [
  // 1 · No-show Shield (+$97/mo) — the opener: easiest "yes", self-paying, recurring
  { rgb: "62,148,104", flavor: "green", featured: true },
  // 2 · Speed-to-Lead 60s (+$197/mo) — SALES CHAMPION: 78% stat, recurring
  { rgb: "62,148,104", flavor: "green", featured: true, champion: true },
  // 3 · Reactivation Blitz ($497 one-time) — instant-cash conversion hook
  { rgb: "214,194,154", flavor: "gold", featured: false },
  // 4 · Reputation Machine (+$147/mo) — recurring, sticky
  { rgb: "62,148,104", flavor: "green", featured: false },
  // 5 · Content Autopilot (+$197/mo) — recurring
  { rgb: "62,148,104", flavor: "green", featured: false },
  // 6 · Official WhatsApp (setup) — one-time infrastructure
  { rgb: "194,168,120", flavor: "gold", featured: false },
  // 7 · Compliance (setup) — one-time legal shield
  { rgb: "194,168,120", flavor: "gold", featured: false },
  // 8 · Nossa Gente (included) — differentiator
  { rgb: "62,148,104", flavor: "green", featured: false },
];

export default function AddOnsV2() {
  const { lang } = useLang();
  const A = AO_COPY[lang] || AO_COPY.en;

  const pill = (flavor) =>
    flavor === "green"
      ? "border-g-green/35 bg-g-green/[0.10] text-g-green"
      : "border-g-gold/35 bg-g-gold/[0.10] text-g-gold";

  return (
    <section className="relative overflow-hidden px-5 py-14">
      <style>{`@keyframes aoreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes aoshine{to{background-position:220% center}}@keyframes aofloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-6px) rotate(3deg)}}@keyframes aospark{0%,100%{opacity:0}5%{opacity:1}13%{opacity:1}22%{opacity:0}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_20%_0%,rgba(214,194,154,0.10),transparent),radial-gradient(700px_360px_at_85%_100%,rgba(62,148,104,0.12),transparent)]" />

      <div className="mx-auto max-w-5xl">
        {/* header — locked pattern: champagne eyebrow → font-black h2 with one shimmer phrase → greige sub */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "aoreveal .7s ease both" }}>{A.eyebrow}</div>
          <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
            <span className="text-g-word" style={{ animation: "aoreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{A.h1a}</span>
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "aoreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, aoshine 6s linear infinite" }}>{A.h1b}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "aoreveal .8s ease .3s both" }}>{A.sub}</p>
        </div>

        {/* 8 add-ons — compact glanceable grid, the whole menu in one screen (4×2 on desktop) */}
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {A.items.map((it, i) => {
            const m = META[i] || { rgb: "62,148,104", flavor: "green", featured: false };
            const Card = it.href ? "a" : "div";
            const linkProps = it.href ? { href: it.href } : {};
            return (
              <Card key={it.n} {...linkProps}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white/[0.03] p-3.5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05] ${m.featured ? `ring-1 ${m.champion ? "ring-g-gold/60" : "ring-g-gold/50"}` : ""}`}
                style={{ borderColor: m.featured ? "rgba(214,194,154,0.45)" : `rgba(${m.rgb},0.22)`, boxShadow: "0 14px 34px -28px rgba(0,0,0,0.85)", animation: `aoreveal .6s cubic-bezier(.2,.7,.2,1) ${0.2 + i * 0.07}s both` }}>
                <span className="absolute inset-x-0 top-0 h-[3px] opacity-70 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `linear-gradient(90deg,transparent,rgba(${m.rgb},0.85),transparent)` }} />
                {/* christmas-lights chase: each card lights its border + glow in sequence */}
                <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(130% 100% at 50% 0%, rgba(${m.rgb},0.20), transparent 72%)`, boxShadow: `inset 0 0 0 1.5px rgba(${m.rgb},0.95), 0 0 28px rgba(${m.rgb},0.6), 0 20px 54px -6px rgba(${m.rgb},0.7)`, opacity: 0, animation: `aospark 5.6s ease-in-out ${(i * 0.7).toFixed(2)}s infinite` }} />
                <div className="relative flex items-start justify-between gap-1.5">
                  <span className="select-none text-[26px]" style={{ filter: `drop-shadow(0 4px 12px rgba(${m.rgb},0.55))` }}>{it.e}</span>
                  {m.featured && <span className="rounded-full border border-g-gold/40 bg-g-gold/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-g-gold">{m.champion ? (A.champBadge || A.badge) : A.badge}</span>}
                </div>
                <div className="mt-2 text-[14px] font-black leading-tight tracking-tight text-g-word">{it.n}</div>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-g-ink">{it.p}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-extrabold tabular-nums ${pill(m.flavor)}`}>{it.pr}</span>
                  <span className="inline-flex items-center rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-g-muted">{it.tg}</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* 2 strategic — compact strip */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {/* white-label for agencies */}
          <a href="/parceiro" className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-g-line bg-white/[0.03] p-3.5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-g-green/40 hover:bg-white/[0.05]"
            style={{ boxShadow: "0 14px 34px -28px rgba(0,0,0,0.85)", animation: "aoreveal .6s cubic-bezier(.2,.7,.2,1) .78s both" }}>
            <span className="select-none text-[26px]" style={{ filter: "drop-shadow(0 4px 12px rgba(62,148,104,0.55))" }}>🤝</span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-black tracking-tight text-g-word">{A.wl.n}</div>
              <p className="line-clamp-2 text-[11.5px] leading-snug text-g-ink">{A.wl.p}</p>
            </div>
            <span aria-hidden className="ml-auto shrink-0 text-[14px] font-extrabold text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </a>
          {/* annual plan — champagne accent */}
          <div className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-g-gold/30 bg-g-gold/[0.07] p-3.5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-g-gold/50"
            style={{ boxShadow: "0 14px 34px -28px rgba(0,0,0,0.85)", animation: "aoreveal .6s cubic-bezier(.2,.7,.2,1) .85s both" }}>
            <span className="select-none text-[26px]" style={{ filter: "drop-shadow(0 4px 12px rgba(214,194,154,0.55))" }}>📦</span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-black tracking-tight text-g-word">{A.an.n}</div>
              <p className="text-[11.5px] leading-snug text-g-gold/90">{A.an.p}</p>
            </div>
          </div>
        </div>

        {/* bottom CTA — exact silver/platinum pill from LegsV2 */}
        <div className="mt-7 text-center" style={{ animation: "aoreveal .8s ease .95s both" }}>
          <a href="#pricing" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3 text-[14px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
            style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
            <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
            <span className="relative">💎 {A.cta}</span>
            <span className="relative text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
