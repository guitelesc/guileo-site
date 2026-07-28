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
      { badge: "Guileo Brain", owns: "Owns your performance", title: "Does the work of employees", desc: "Answers every call & message, books, quotes, closes & collects — 24/7, in 20+ languages. Output goes up, payroll doesn't.", tag: "performance, elevated" },
      { badge: "Guileo.AD", owns: "Owns your sales", title: "Sells while you work", desc: "Your ads, content & funnels run every day — you reach more people, close more deals, waste less ad money.", tag: "you sell more" },
      { badge: "Guileo Grow", owns: "The result — your growth", title: "Growth that compounds", desc: "Every lead followed up every single day — monitored 24/7, nothing slips. Your business grows on autopilot.", tag: "monitored 24/7" },
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
      { badge: "Guileo Brain", owns: "Dono da sua performance", title: "Faz o trabalho de funcionários", desc: "Atende toda ligação e mensagem, agenda, orça, fecha e cobra — 24/7, em 20+ idiomas. O rendimento sobe, a folha não.", tag: "performance elevada" },
      { badge: "Guileo.AD", owns: "Dono das suas vendas", title: "Vende enquanto você trabalha", desc: "Seus anúncios, conteúdo e funis rodando todo dia — você alcança mais gente, fecha mais e desperdiça menos.", tag: "você vende mais" },
      { badge: "Guileo Grow", owns: "O resultado — seu crescimento", title: "Crescimento que compõe", desc: "Cada lead acompanhado todos os dias — monitorado 24h, nada escapa. Seu negócio cresce no automático.", tag: "monitorado 24/7" },
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
      { badge: "Guileo Brain", owns: "Dueño de tu performance", title: "Hace el trabajo de empleados", desc: "Atiende cada llamada y mensaje, agenda, cotiza, cierra y cobra — 24/7, en 20+ idiomas. El rendimiento sube, la nómina no.", tag: "performance elevada" },
      { badge: "Guileo.AD", owns: "Dueño de tus ventas", title: "Vende mientras trabajas", desc: "Tus anuncios, contenido y embudos corren cada día — llegas a más gente, cierras más y desperdicias menos.", tag: "vendes más" },
      { badge: "Guileo Grow", owns: "El resultado — tu crecimiento", title: "Crecimiento que se acumula", desc: "Cada lead con seguimiento todos los días — monitoreado 24/7, nada se escapa. Tu negocio crece en automático.", tag: "monitoreado 24/7" },
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
      { badge: "Guileo Brain", owns: "आपकी परफ़ॉर्मेंस का मालिक", title: "कर्मचारियों का काम करता है", desc: "हर कॉल और मैसेज का जवाब, बुकिंग, कोटेशन, डील बंद और वसूली — 24/7, 20+ भाषाओं में। आउटपुट बढ़ता है, पेरोल नहीं।", tag: "परफ़ॉर्मेंस ऊँची" },
      { badge: "Guileo.AD", owns: "आपकी बिक्री का मालिक", title: "आप काम करें, यह बेचता है", desc: "आपके विज्ञापन, कंटेंट और फ़नल हर दिन चलते हैं — ज़्यादा लोग, ज़्यादा डील, कम बर्बादी।", tag: "आप ज़्यादा बेचते हैं" },
      { badge: "Guileo Grow", owns: "नतीजा — आपकी ग्रोथ", title: "ग्रोथ जो बढ़ती जाती है", desc: "हर लीड का हर दिन फ़ॉलो-अप — 24/7 निगरानी, कुछ नहीं छूटता। आपका व्यवसाय ऑटोपायलट पर बढ़ता है।", tag: "24/7 निगरानी" },
    ],
    buildA: "और ", buildB: "Guileo Build", buildC: " वे वेबसाइट, ऐप और सॉफ़्टवेयर बनाता है जिन पर सब चलता है।",
    biz: "आपका व्यवसाय", st: ["● कनेक्टेड", "ऑटोमेटेड", "24/7 बढ़ता"], cta: "मेरे व्यवसाय के लिए चाहिए",
  },
};

// station art — emoji grows in presence left→right (cause → cause → result)
const STATIONS = [
  { emoji: "🧠", size: 60, sIcon: "⚡", rgb: "62,148,104" },
  { emoji: "📈", size: 68, sIcon: "💰", rgb: "214,194,154" },
  { emoji: "🚀", size: 80, sIcon: "🚀", rgb: "194,168,120" },
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
        @keyframes lsonar{0%{transform:scale(.5);opacity:.5}100%{transform:scale(1.9);opacity:0}}
        @keyframes lplat{0%,100%{transform:scaleX(1);opacity:.9}50%{transform:scaleX(1.18);opacity:1}}
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

      {/* STATION SCENE — Guileo's own identity: sonar energy, breathing platforms, light ticks */}
      <div className="relative mx-auto mt-10 max-w-5xl">
        {/* calm aurora wash behind the scene — presence without stealing the text */}
        <div className="pointer-events-none absolute inset-x-0 -top-8 h-64 bg-[radial-gradient(720px_280px_at_50%_30%,rgba(62,148,104,0.08),transparent)]" />
        <div className="relative grid grid-cols-3 gap-2 sm:gap-6">
          {/* (traço horizontal removido a pedido do Luis — ficava solto/feio; a conexão fica pelas setas Performance → Sales → Growth) */}

          {L.steps.map((s, i) => {
            const st = STATIONS[i];
            const result = i === 2;
            return (
              <div key={i} className="group relative flex flex-col items-center text-center">
                {/* the station emoji — floats free, sonar rings radiating in its color */}
                <div className="relative flex h-[120px] w-full items-end justify-center">
                  <span className="pointer-events-none absolute bottom-2 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border" style={{ borderColor: `rgba(${st.rgb},0.4)`, animation: `lsonar 2.8s ease-out ${i * 0.4}s infinite` }} />
                  <span className="pointer-events-none absolute bottom-2 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border" style={{ borderColor: `rgba(${st.rgb},0.4)`, animation: `lsonar 2.8s ease-out ${1.4 + i * 0.4}s infinite` }} />
                  {result && FRUITS.map((f, k) => (
                    <span key={k} className="pointer-events-none absolute text-lg" style={{ bottom: `${56 + k * 8}px`, left: `${28 + k * 16}%`, animation: `lrise ${3 + k}s ease-in ${k * 0.6}s infinite` }}>{f}</span>
                  ))}
                  <span className="relative inline-block select-none transition-transform duration-300 group-hover:scale-110" style={{ fontSize: st.size, lineHeight: 1, filter: `drop-shadow(0 10px 24px rgba(${st.rgb},0.55))`, transformOrigin: "bottom center", animation: `lpop .8s cubic-bezier(.2,.7,.2,1) ${0.5 + i * 0.25}s both, lsway ${4 + i}s ease-in-out ${1 + i}s infinite` }}>{st.emoji}</span>
                </div>
                {/* breathing platform the station stands on */}
                <div className="z-10 h-2.5 w-24 rounded-full sm:w-28" style={{ background: `rgba(${st.rgb},0.55)`, boxShadow: `0 0 30px rgba(${st.rgb},0.5)`, animation: `lplat ${3.4 + i * 0.5}s ease-in-out infinite` }} />
                {/* light tick binding platform → message (the info belongs to the station) */}
                <span className="pointer-events-none h-5 w-px" style={{ background: `linear-gradient(180deg,rgba(${st.rgb},0.7),transparent)` }} />

                {/* the message — bigger, brighter, made to be READ */}
                <div className="mt-2 px-0.5" style={{ animation: `lreveal .7s ease ${0.6 + i * 0.2}s both` }}>
                  <div className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider" style={{ borderColor: `rgba(${st.rgb},0.45)`, color: `rgb(${st.rgb})`, background: `rgba(${st.rgb},0.08)`, boxShadow: `0 0 18px rgba(${st.rgb},0.18)` }}>{st.sIcon} {s.badge}</div>
                  <div className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-g-word/85">{s.owns}</div>
                  <h3 className="mt-1.5 font-black leading-[1.06] tracking-tight text-g-word" style={{ fontSize: "clamp(1.3rem,2.3vw,1.7rem)", textShadow: `0 0 30px rgba(${st.rgb},0.3)` }}>{s.title}</h3>
                  <p className="mx-auto mt-2.5 max-w-[16.5rem] text-[13px] leading-relaxed text-g-ink sm:text-[14px]">{s.desc}</p>
                  <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold" style={{ borderColor: `rgba(${st.rgb},0.35)`, background: `rgba(${st.rgb},0.07)`, color: `rgb(${st.rgb})` }}>✓ {s.tag}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* foundation line — Guileo Build carries it all */}
        <p className="mx-auto mt-10 max-w-xl text-center text-[13.5px] leading-relaxed text-g-ink" style={{ animation: "lreveal .8s ease 1.1s both" }}>
          🛠️ {L.buildA}<span className="font-bold text-[#4E9DB0]">{L.buildB}</span>{L.buildC}
        </p>

        {/* CONNECTION — three smooth light threads carry leads, implementations & results
            from the stations down into the plant's roots (proportional viewBox keeps the
            thread tops aligned with the 3 grid columns at every screen size) */}
        <svg viewBox="0 0 1000 150" className="pointer-events-none mx-auto -mb-3 mt-1 block w-full" fill="none" aria-hidden="true">
          {[
            { d: "M167,0 C167,105 500,85 500,150", rgb: "62,148,104", emoji: "🎯", dur: "3.6s", begin: "0s" },
            { d: "M500,0 C500,60 500,90 500,150", rgb: "214,194,154", emoji: "⚙️", dur: "4.2s", begin: "1.4s" },
            { d: "M833,0 C833,105 500,85 500,150", rgb: "194,168,120", emoji: "📈", dur: "3.9s", begin: "2.5s" },
          ].map((p, i) => (
            <g key={i}>
              <path d={p.d} stroke={`rgba(${p.rgb},0.22)`} strokeWidth="2" strokeLinecap="round" />
              {/* glowing comet sliding down the thread */}
              <circle r="4.5" fill={`rgb(${p.rgb})`} opacity="0.95" style={{ filter: `drop-shadow(0 0 8px rgba(${p.rgb},0.9))` }}>
                <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite" path={p.d} />
              </circle>
              {/* the payload it carries — lead / implementation / result */}
              <text fontSize="17" textAnchor="middle" dy="-9">
                <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite" path={p.d} />
                {p.emoji}
              </text>
            </g>
          ))}
        </svg>

        {/* convergence — it all feeds YOUR BUSINESS; the plant pulses & gives results back */}
        <div className="relative grid place-items-center">
          <div className="pointer-events-none absolute inset-0 blur-2xl" style={{ background: "radial-gradient(closest-side,rgba(62,148,104,0.16),transparent)" }} />
          {/* soft sonar — the business receiving the energy */}
          <span className="pointer-events-none absolute top-[44%] h-44 w-44 -translate-y-1/2 rounded-full border border-g-green/35" style={{ animation: "lsonar 3.2s ease-out infinite" }} />
          <span className="pointer-events-none absolute top-[44%] h-44 w-44 -translate-y-1/2 rounded-full border border-g-gold/30" style={{ animation: "lsonar 3.2s ease-out 1.6s infinite" }} />
          {/* results rising OUT of the business */}
          {["💰", "📈", "⭐", "💚"].map((f, k) => (
            <span key={k} className="pointer-events-none absolute text-lg" style={{ top: "30%", left: `${36 + k * 8}%`, animation: `lrise ${3.2 + (k % 3)}s ease-in ${k * 0.8}s infinite` }}>{f}</span>
          ))}
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
