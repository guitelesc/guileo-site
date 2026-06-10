import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";

// LegsV2 — "We grow your business": each Guileo part OWNS one sector of the client's
// company, in the same clean station-over-line language as MethodV2 (the approved look):
// 🧠 BRAIN owns PERFORMANCE (does the work of employees) → 📈 AD owns SALES (sells daily)
// → 🚀 the consequence: GROWTH (every lead followed up, monitored 24/7). Energy flows
// left→right along the line and converges on the plant = YOUR BUSINESS growing.

const LV_COPY = {
  en: {
    eyebrow: "More than automation — your whole operation",
    h1a: "We don't just automate. ", h1b: "We grow your business.",
    sub: "Each part of Guileo owns one part of your company — together, they grow it.",
    strip: ["Performance", "Sales", "Growth"],
    steps: [
      { badge: "Guileo Brain", owns: "Owns your performance", title: "Does the work of employees", desc: "Answers every call & message, books, quotes and supports — 24/7, any language. Output goes up, payroll doesn't.", tag: "performance, elevated" },
      { badge: "Guileo.AD", owns: "Owns your sales", title: "Sells while you work", desc: "Your ads, content & funnels run every day — you reach more people, close more deals, waste less ad money.", tag: "you sell more" },
      { badge: "The result", owns: "Your growth", title: "Growth that compounds", desc: "Every lead followed up every single day — monitored 24/7, nothing slips. Your business grows on autopilot.", tag: "monitored 24/7" },
    ],
    buildA: "And ", buildB: "Guileo Build", buildC: " crafts the websites, apps & software it all runs on.",
    biz: "YOUR BUSINESS", st: ["● connected", "automated", "growing 24/7"], cta: "Get this for my business",
  },
  pt: {
    eyebrow: "Mais que automação — sua operação inteira",
    h1a: "Não só automatizamos. ", h1b: "Fazemos você crescer.",
    sub: "Cada parte do Guileo cuida de uma parte da sua empresa — juntas, elas fazem você crescer.",
    strip: ["Performance", "Vendas", "Crescimento"],
    steps: [
      { badge: "Guileo Brain", owns: "Dono da sua performance", title: "Faz o trabalho de funcionários", desc: "Atende toda ligação e mensagem, agenda, orça e dá suporte — 24/7, em qualquer idioma. O rendimento sobe, a folha não.", tag: "performance elevada" },
      { badge: "Guileo.AD", owns: "Dono das suas vendas", title: "Vende enquanto você trabalha", desc: "Seus anúncios, conteúdo e funis rodando todo dia — você alcança mais gente, fecha mais e desperdiça menos.", tag: "você vende mais" },
      { badge: "O resultado", owns: "Seu crescimento", title: "Crescimento que compõe", desc: "Cada lead acompanhado todos os dias — monitorado 24h, nada escapa. Seu negócio cresce no automático.", tag: "monitorado 24/7" },
    ],
    buildA: "E o ", buildB: "Guileo Build", buildC: " constrói os sites, apps e softwares que fazem tudo rodar.",
    biz: "SEU NEGÓCIO", st: ["● conectado", "automatizado", "crescendo 24/7"], cta: "Quero isso no meu negócio",
  },
  es: {
    eyebrow: "Más que automatización — toda tu operación",
    h1a: "No solo automatizamos. ", h1b: "Hacemos crecer tu negocio.",
    sub: "Cada parte de Guileo es dueña de una parte de tu empresa — juntas, la hacen crecer.",
    strip: ["Performance", "Ventas", "Crecimiento"],
    steps: [
      { badge: "Guileo Brain", owns: "Dueño de tu performance", title: "Hace el trabajo de empleados", desc: "Atiende cada llamada y mensaje, agenda, cotiza y da soporte — 24/7, en cualquier idioma. El rendimiento sube, la nómina no.", tag: "performance elevada" },
      { badge: "Guileo.AD", owns: "Dueño de tus ventas", title: "Vende mientras trabajas", desc: "Tus anuncios, contenido y embudos corren cada día — llegas a más gente, cierras más y desperdicias menos.", tag: "vendes más" },
      { badge: "El resultado", owns: "Tu crecimiento", title: "Crecimiento que se acumula", desc: "Cada lead con seguimiento todos los días — monitoreado 24/7, nada se escapa. Tu negocio crece en automático.", tag: "monitoreado 24/7" },
    ],
    buildA: "Y ", buildB: "Guileo Build", buildC: " construye las webs, apps y software donde todo corre.",
    biz: "TU NEGOCIO", st: ["● conectado", "automatizado", "creciendo 24/7"], cta: "Quiero esto en mi negocio",
  },
  hi: {
    eyebrow: "सिर्फ़ ऑटोमेशन नहीं — आपका पूरा ऑपरेशन",
    h1a: "हम सिर्फ़ ऑटोमेट नहीं करते. ", h1b: "हम आपका व्यवसाय बढ़ाते हैं।",
    sub: "Guileo का हर हिस्सा आपकी कंपनी के एक हिस्से का मालिक है — मिलकर, वे उसे बढ़ाते हैं।",
    strip: ["परफ़ॉर्मेंस", "बिक्री", "ग्रोथ"],
    steps: [
      { badge: "Guileo Brain", owns: "आपकी परफ़ॉर्मेंस का मालिक", title: "कर्मचारियों का काम करता है", desc: "हर कॉल और मैसेज का जवाब, बुकिंग, कोटेशन और सपोर्ट — 24/7, किसी भी भाषा में। आउटपुट बढ़ता है, पेरोल नहीं।", tag: "परफ़ॉर्मेंस ऊँची" },
      { badge: "Guileo.AD", owns: "आपकी बिक्री का मालिक", title: "आप काम करें, यह बेचता है", desc: "आपके विज्ञापन, कंटेंट और फ़नल हर दिन चलते हैं — ज़्यादा लोग, ज़्यादा डील, कम बर्बादी।", tag: "आप ज़्यादा बेचते हैं" },
      { badge: "नतीजा", owns: "आपकी ग्रोथ", title: "ग्रोथ जो बढ़ती जाती है", desc: "हर लीड का हर दिन फ़ॉलो-अप — 24/7 निगरानी, कुछ नहीं छूटता। आपका व्यवसाय ऑटोपायलट पर बढ़ता है।", tag: "24/7 निगरानी" },
    ],
    buildA: "और ", buildB: "Guileo Build", buildC: " वे वेबसाइट, ऐप और सॉफ़्टवेयर बनाता है जिन पर सब चलता है।",
    biz: "आपका व्यवसाय", st: ["● कनेक्टेड", "ऑटोमेटेड", "24/7 बढ़ता"], cta: "मेरे व्यवसाय के लिए चाहिए",
  },
};

// station art — emoji grows in presence left→right (cause → cause → result)
const STATIONS = [
  { emoji: "🧠", size: 54, sIcon: "⚡", rgb: "62,148,104" },
  { emoji: "📈", size: 62, sIcon: "💰", rgb: "214,194,154" },
  { emoji: "🚀", size: 74, sIcon: "🚀", rgb: "194,168,120" },
];
// money & good things floating out of the result station + the business plant
const FRUITS = ["💰", "📈", "⭐"];

export default function LegsV2() {
  const { lang } = useLang();
  const L = LV_COPY[lang] || LV_COPY.en;

  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`
        @keyframes lreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lshine{to{background-position:220% center}}
        @keyframes lgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @keyframes lsway{0%,100%{transform:rotate(-3deg) translateY(0)}50%{transform:rotate(3deg) translateY(-7px)}}
        @keyframes lrise{0%{transform:translateY(8px) scale(.8);opacity:0}25%{opacity:1}100%{transform:translateY(-46px) scale(1.1);opacity:0}}
        @keyframes lpop{from{transform:scale(0) translateY(16px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
        @keyframes lflow{0%{left:0%;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:100%;opacity:0}}
        @keyframes lbreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes lpulse{0%,100%{opacity:.5}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "lreveal .7s ease both" }}>{L.eyebrow}</div>
        <h2 className="mt-4 font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "lreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{L.h1a}</span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "lreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, lshine 7s linear infinite" }}>{L.h1b}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "lreveal .8s ease .3s both" }}>{L.sub}</p>
      </div>

      {/* sector framing — each part owns one sector, growth is the consequence */}
      <div className="mx-auto mt-7 flex max-w-md flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-wider" style={{ animation: "lreveal .8s ease .3s both" }}>
        <span className="text-g-green">⚡ {L.strip[0]}</span><span className="text-g-muted" style={{ animation: "lpulse 2s ease-in-out infinite" }}>→</span>
        <span className="text-g-gold">💰 {L.strip[1]}</span><span className="text-g-muted" style={{ animation: "lpulse 2s ease-in-out .5s infinite" }}>→</span>
        <span className="text-g-copper">🚀 {L.strip[2]}</span>
      </div>

      {/* STATION SCENE — same visual language as the Method section (approved look) */}
      <div className="relative mx-auto mt-10 max-w-5xl">
        <div className="relative grid grid-cols-3 gap-2 sm:gap-6">
          {/* energy line behind all three stations */}
          <div className="pointer-events-none absolute inset-x-2 top-[120px] h-[3px] rounded-full bg-white/10" />
          <div className="pointer-events-none absolute left-2 right-2 top-[120px] h-[3px] origin-left rounded-full bg-gradient-to-r from-g-green via-g-gold to-g-copper" style={{ animation: "lgrow 1.8s ease .4s both" }} />
          {/* energy pulse traveling along the line into the result */}
          <span className="pointer-events-none absolute top-[117px] h-[9px] w-[9px] rounded-full bg-g-gold shadow-[0_0_14px_rgba(214,194,154,0.9)]" style={{ animation: "lflow 3.2s linear 1.6s infinite" }} />

          {L.steps.map((s, i) => {
            const st = STATIONS[i];
            const result = i === 2;
            return (
              <div key={i} className="relative flex flex-col items-center text-center">
                {/* the station emoji — floats free above its glowing platform */}
                <div className="relative flex h-[120px] w-full items-end justify-center">
                  {result && FRUITS.map((f, k) => (
                    <span key={k} className="pointer-events-none absolute text-lg" style={{ bottom: `${56 + k * 8}px`, left: `${28 + k * 16}%`, animation: `lrise ${3 + k}s ease-in ${k * 0.6}s infinite` }}>{f}</span>
                  ))}
                  <span className="inline-block select-none" style={{ fontSize: st.size, lineHeight: 1, filter: `drop-shadow(0 10px 22px rgba(${st.rgb},0.5))`, transformOrigin: "bottom center", animation: `lpop .8s cubic-bezier(.2,.7,.2,1) ${0.5 + i * 0.25}s both, lsway ${4 + i}s ease-in-out ${1 + i}s infinite` }}>{st.emoji}</span>
                </div>
                {/* glowing platform the station stands on */}
                <div className="z-10 h-2.5 w-24 rounded-full sm:w-28" style={{ background: `rgba(${st.rgb},0.55)`, boxShadow: `0 0 26px rgba(${st.rgb},0.45)` }} />

                {/* the message below the platform */}
                <div className="mt-6 px-0.5" style={{ animation: `lreveal .7s ease ${0.6 + i * 0.2}s both` }}>
                  <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ borderColor: `rgba(${st.rgb},0.4)`, color: `rgb(${st.rgb})` }}>{st.sIcon} {s.badge}</div>
                  <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-g-ink">{s.owns}</div>
                  <h3 className="mt-1 font-black leading-[1.08] tracking-tight text-g-word" style={{ fontSize: "clamp(1.15rem,2vw,1.45rem)" }}>{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-[15rem] text-[12.5px] leading-relaxed text-g-ink sm:text-[13px]">{s.desc}</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-g-line bg-white/[0.04] px-3 py-1 text-[11.5px] font-semibold" style={{ color: `rgb(${st.rgb})` }}>✓ {s.tag}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* foundation line — Guileo Build carries it all */}
        <p className="mx-auto mt-10 max-w-xl text-center text-[13.5px] leading-relaxed text-g-ink" style={{ animation: "lreveal .8s ease 1.1s both" }}>
          🛠️ {L.buildA}<span className="font-bold text-[#4E9DB0]">{L.buildB}</span>{L.buildC}
        </p>

        {/* convergence — it all feeds YOUR BUSINESS, growing */}
        <div className="relative mt-10 grid place-items-center">
          <div className="pointer-events-none absolute inset-0 blur-2xl" style={{ background: "radial-gradient(closest-side,rgba(62,148,104,0.16),transparent)" }} />
          <img src={mark} alt="Guileo" className="relative z-10 w-[170px] max-w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]" style={{ animation: "lbreathe 6s ease-in-out infinite" }} />
          <div className="relative z-10 mt-2 text-center">
            <div className="text-[18px] font-black tracking-tight text-g-word">{L.biz}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-wider">
              <span className="text-g-green">{L.st[0]}</span> <span className="text-g-muted">·</span> <span className="text-g-gold">{L.st[1]}</span> <span className="text-g-muted">·</span> <span className="text-g-copper">{L.st[2]}</span>
            </div>
            <a href="#contact" className="group relative mt-5 inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3 text-[14px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
              style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
              <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
              <span className="relative">{L.cta}</span>
              <span className="relative text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
