// MethodV2 — TEST (/v2): "The Guileo Method" — led by real humans, seed → nurture →
// harvest, live in under 7 days. Builds trust before the close. Content from guileoai.com.
// Guileo design system + smooth CSS motion.
import { useLang } from "../i18n.jsx";

const STEPS = [
  { plant: "🌱", size: 38, when: "Day 01", n: "1", phase: "Implementation", title: "Plant the seed", desc: "A human studies your business, finds your revenue leaks, and designs the system around how you actually work.", tag: "we study & design it", rgb: "214,194,154" },
  { plant: "🌿", size: 60, when: "Days 2–7", n: "2", phase: "Implementation", title: "Nurture growth", desc: "We build & implement in under 7 days — your AI live 24/7, automating sales & marketing across every channel.", tag: "built & live for you", rgb: "62,148,104" },
  { plant: "🌳", size: 88, when: "Week 2 →", n: "3", phase: "Harvest", title: "Harvest results", desc: "Profit climbs — +286% performance and 3× faster sales cycles on average — while we keep optimizing for you.", tag: "profit compounds", rgb: "194,168,120" },
];

const MV_COPY = {
  en: { h1a:"Led by real humans — ", h1b:"not just bots.", subA:"We get to know your business — ", subB:"we'll even visit you", subM:" — then design and build the system that grows your profit. ", subC:"Live in under 7 days.", phases:["Plant","Nurture","Harvest"] },
  pt: { h1a:"Conduzido por humanos — ", h1b:"não só bots.", subA:"A gente conhece seu negócio — ", subB:"até visita você", subM:" — e então desenha e constrói o sistema que faz seu lucro crescer. ", subC:"No ar em menos de 7 dias.", phases:["Plantar","Nutrir","Colher"] },
  es: { h1a:"Liderado por humanos — ", h1b:"no solo bots.", subA:"Conocemos tu negocio — ", subB:"incluso te visitamos", subM:" — y luego diseñamos y construimos el sistema que hace crecer tu ganancia. ", subC:"En vivo en menos de 7 días.", phases:["Plantar","Nutrir","Cosechar"] },
  hi: { h1a:"असली इंसानों द्वारा संचालित — ", h1b:"सिर्फ़ बॉट नहीं।", subA:"हम आपका व्यवसाय जानते हैं — ", subB:"आपसे मिलने भी आते हैं", subM:" — फिर वह सिस्टम डिज़ाइन और बनाते हैं जो आपका मुनाफ़ा बढ़ाए। ", subC:"7 दिनों से कम में लाइव।", phases:["बोएँ","पोषें","काटें"] },
};

export default function MethodV2() {
  const { t, lang } = useLang();
  const M = MV_COPY[lang] || MV_COPY.en;
  const dictSteps = (t.steps && t.steps.items) || [];
  const eyebrow = (t.steps && t.steps.h2) || "The Guileo Method";
  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`
        @keyframes mvreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mvshine{to{background-position:220% center}}
        @keyframes mvgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @keyframes mvsway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes mvfloat{0%{transform:translateY(8px) scale(.8);opacity:0}25%{opacity:1}100%{transform:translateY(-46px) scale(1.1);opacity:0}}
        @keyframes mvsprout{from{transform:scale(0) translateY(20px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "mvreveal .7s ease both" }}>{eyebrow}</div>
        <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "mvreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{M.h1a}</span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "mvreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, mvshine 7s linear infinite" }}>{M.h1b}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "mvreveal .8s ease .3s both" }}>
          {M.subA}<span className="font-semibold text-g-word">{M.subB}</span>{M.subM}<span className="font-semibold text-g-green">{M.subC}</span>
        </p>
      </div>

      {/* the metaphor framing — plant → nurture → harvest (implementation → harvest) */}
      <div className="mx-auto mt-7 flex max-w-md flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-wider" style={{ animation: "mvreveal .8s ease .3s both" }}>
        <span className="text-g-green">🌱 {M.phases[0]}</span><span className="text-g-muted">→</span>
        <span className="text-g-green">💧 {M.phases[1]}</span><span className="text-g-muted">→</span>
        <span className="text-g-gold">🌾 {M.phases[2]}</span>
      </div>

      {/* GARDEN SCENE — the system is planted, nurtured & harvested; the plant literally grows */}
      <div className="relative mx-auto mt-10 max-w-5xl">
        <div className="relative grid grid-cols-3 gap-2 sm:gap-6">
          {/* soil line behind all three — the growing ground */}
          <div className="pointer-events-none absolute inset-x-2 top-[160px] h-[3px] rounded-full bg-white/10" />
          <div className="pointer-events-none absolute left-2 right-2 top-[160px] h-[3px] origin-left rounded-full bg-gradient-to-r from-g-gold via-g-green to-g-copper" style={{ animation: "mvgrow 1.8s ease .4s both" }} />

          {STEPS.map((s, i) => {
            const harvest = s.phase === "Harvest";
            return (
              <div key={s.n} className="relative flex flex-col items-center text-center">
                {/* the plant — grows bigger each stage; fruit floats up at harvest */}
                <div className="relative flex h-[160px] w-full items-end justify-center">
                  {harvest && ["💰", "📈", "⭐"].map((f, k) => (
                    <span key={k} className="pointer-events-none absolute text-lg" style={{ bottom: `${72 + k * 8}px`, left: `${28 + k * 16}%`, animation: `mvfloat ${3 + k}s ease-in ${k * 0.6}s infinite` }}>{f}</span>
                  ))}
                  <span className="inline-block" style={{ fontSize: s.size, lineHeight: 1, filter: `drop-shadow(0 10px 22px rgba(${s.rgb},0.5))`, transformOrigin: "bottom center", animation: `mvsprout .8s cubic-bezier(.2,.7,.2,1) ${0.5 + i * 0.25}s both, mvsway ${4 + i}s ease-in-out ${1 + i}s infinite` }}>{s.plant}</span>
                </div>
                {/* soil mound the plant is planted in */}
                <div className="z-10 h-2.5 w-24 rounded-full sm:w-28" style={{ background: `rgba(${s.rgb},0.55)`, boxShadow: `0 0 26px rgba(${s.rgb},0.45)` }} />

                {/* the message below the soil */}
                <div className="mt-6 px-0.5" style={{ animation: `mvreveal .7s ease ${0.6 + i * 0.2}s both` }}>
                  <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ borderColor: `rgba(${s.rgb},0.4)`, color: `rgb(${s.rgb})` }}>{harvest ? "🌾" : "🛠️"} {harvest ? M.phases[2] : M.phases[i === 0 ? 0 : 1]}</div>
                  <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-g-ink">{s.when}</div>
                  <h3 className="mt-1 font-black leading-[1.08] tracking-tight text-g-word" style={{ fontSize: "clamp(1.15rem,2vw,1.45rem)" }}>{dictSteps[i]?.[1] || s.title}</h3>
                  <p className="mx-auto mt-2 max-w-[15rem] text-[12.5px] leading-relaxed text-g-ink sm:text-[13px]">{dictSteps[i]?.[2] || s.desc}</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-g-line bg-white/[0.04] px-3 py-1 text-[11.5px] font-semibold" style={{ color: `rgb(${s.rgb})` }}>✓ {s.tag}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
