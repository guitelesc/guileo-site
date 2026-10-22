// MethodV2 — TEST (/v2): "The Guileo Method" — led by real humans, seed → nurture →
// harvest, live in under 7 days. Builds trust before the close. Content from guileoai.com.
// Guileo design system + smooth CSS motion.
import { useLang } from "../i18n.jsx";
import { NOME_DO_PAINEL } from "../portal/nome.js";

const STEPS = [
  { plant: "🌱", size: 30, when: "Day 01", n: "1", phase: "Implementation", title: "Plant the seed", desc: "A human studies your business, finds your revenue leaks, and designs the system around how you actually work.", tag: "we study & design it", rgb: "214,194,154" },
  { plant: "🌿", size: 40, when: "Days 2–7", n: "2", phase: "Implementation", title: "Nurture growth", desc: "We build & implement in under 7 days — your AI live 24/7, automating sales & marketing across every channel.", tag: "built & live for you", rgb: "62,148,104" },
  { plant: "🌳", size: 52, when: "Week 2 →", n: "3", phase: "Harvest", title: "Harvest results", desc: "Profit climbs — +286% performance and 3× faster sales cycles on average — while we keep optimizing for you.", tag: "profit compounds", rgb: "194,168,120" },
];

const MV_COPY = {
  en: { voceLabel:"You do", voce:["a 20-min call — that's it","approve what we built","watch the numbers"], h1a:"Led by real humans — ", h1b:"not just bots.", subA:"We get to know your business — ", subB:"we'll even visit you", subM:" — then design and build the system that grows your profit. ", subC:"Live in under 7 days.", phases:["Plant","Nurture","Harvest"], when:["Day 01","Days 2–7","Week 2 →"], tags:["we study & design it","built & live for you","profit compounds"], disc:"Illustrative averages — results depend on your business.", veLabel:"You see", ve:["your leak, in dollars","your Gui answering, live",`your numbers in the ${NOME_DO_PAINEL}`], trilho:"From the first meeting to profit — in 7 days" },
  pt: { voceLabel:"Você faz", voce:["uma ligação de 20 min — só isso","aprova o que construímos","acompanha os números"], h1a:"Conduzido por humanos — ", h1b:"não só bots.", subA:"A gente conhece seu negócio — ", subB:"até visita você", subM:" — e então desenha e constrói o sistema que faz seu lucro crescer. ", subC:"No ar em menos de 7 dias.", phases:["Plantar","Nutrir","Colher"], when:["Dia 01","Dias 2–7","Semana 2 →"], tags:["a gente estuda e desenha","construído e no ar pra você","o lucro compõe"], disc:"Médias ilustrativas — resultados variam conforme seu negócio.", veLabel:"Você vê", ve:["seu vazamento, em dinheiro","sua Gui atendendo, ao vivo",`seus números na ${NOME_DO_PAINEL}`], trilho:"Da primeira reunião ao lucro — em 7 dias" },
  es: { voceLabel:"Tú haces", voce:["una llamada de 20 min — nada más","apruebas lo que construimos","sigues los números"], h1a:"Liderado por humanos — ", h1b:"no solo bots.", subA:"Conocemos tu negocio — ", subB:"incluso te visitamos", subM:" — y luego diseñamos y construimos el sistema que hace crecer tu ganancia. ", subC:"En vivo en menos de 7 días.", phases:["Plantar","Nutrir","Cosechar"], when:["Día 01","Días 2–7","Semana 2 →"], tags:["lo estudiamos y diseñamos","construido y en vivo para ti","la ganancia se acumula"], disc:"Promedios ilustrativos — los resultados dependen de tu negocio.", veLabel:"Tú ves", ve:["tu fuga, en dinero","tu Gui atendiendo, en vivo",`tus números en la ${NOME_DO_PAINEL}`], trilho:"De la primera reunión a la ganancia — en 7 días" },
  hi: { voceLabel:"आप करते हैं", voce:["20 मिनट की एक कॉल — बस","जो बना उसे मंज़ूरी","नंबर देखते रहें"], h1a:"असली इंसानों द्वारा संचालित — ", h1b:"सिर्फ़ बॉट नहीं।", subA:"हम आपका व्यवसाय जानते हैं — ", subB:"आपसे मिलने भी आते हैं", subM:" — फिर वह सिस्टम डिज़ाइन और बनाते हैं जो आपका मुनाफ़ा बढ़ाए। ", subC:"7 दिनों से कम में लाइव।", phases:["बोएँ","पोषें","काटें"], when:["दिन 01","दिन 2–7","हफ़्ता 2 →"], tags:["हम पढ़ते और डिज़ाइन करते हैं","आपके लिए बना और लाइव","मुनाफ़ा बढ़ता जाता है"], disc:"उदाहरणात्मक औसत — परिणाम आपके व्यवसाय पर निर्भर करते हैं।", veLabel:"आप देखते हैं", ve:["आपका रिसाव, पैसों में","आपकी Gui जवाब देती हुई, लाइव",`${NOME_DO_PAINEL} में आपके नंबर`], trilho:"पहली मीटिंग से मुनाफ़े तक — 7 दिनों में" },
};

export default function MethodV2() {
  const { t, lang } = useLang();
  const M = MV_COPY[lang] || MV_COPY.en;
  const dictSteps = (t.steps && t.steps.items) || [];
  const eyebrow = (t.steps && t.steps.h2) || "The Guileo Method";
  return (
    <section id="method" className="relative overflow-hidden px-5 py-16">
      <style>{`
        @keyframes mvreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mvshine{to{background-position:220% center}}
        @keyframes mvgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @keyframes mvsway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes mvfloat{0%{transform:translateY(8px) scale(.8);opacity:0}25%{opacity:1}100%{transform:translateY(-46px) scale(1.1);opacity:0}}
        @keyframes mvtrilho{0%{left:0%}46%,54%{left:calc(100% - 7px)}100%{left:0%}}
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

      {/* (linha de fases e trilho dos 7 dias SAÍRAM — Luis, 2026-09-09: «encurtar, ser prático, mostrar a ativação em 3 passos») */}
      {/* GARDEN SCENE — the system is planted, nurtured & harvested; the plant literally grows */}
      <div className="relative mx-auto mt-10 max-w-5xl">
        <div className="relative grid grid-cols-3 gap-2 sm:gap-6">
          {/* (traço horizontal removido a pedido do Luis — ficava solto/feio) */}

          {STEPS.map((s, i) => {
            const harvest = s.phase === "Harvest";
            return (
              <div key={s.n} className="relative flex flex-col items-center text-center">
                {/* the plant — grows bigger each stage; fruit floats up at harvest */}
                <div className="relative flex h-[96px] w-full items-end justify-center">
                  {/* GLOW que cresce com a etapa — a luz que a planta emite aumenta junto com ela.
                      Halo fixo nas três faria as três parecerem do mesmo tamanho de importância;
                      crescendo, a própria luz conta a progressão sem precisar de legenda. */}
                  <span aria-hidden="true" className="pointer-events-none absolute bottom-0 rounded-full"
                    style={{ width: 80 + i * 30, height: 44 + i * 16,
                             background: `radial-gradient(closest-side, rgba(${s.rgb},${0.2 + i * 0.07}), transparent 74%)`,
                             filter: "blur(2px)" }} />
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
                  <div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-g-ink">{M.when[i] || s.when}</div>
                  <h3 className="mt-1 font-black leading-[1.08] tracking-tight text-g-word" style={{ fontSize: "clamp(1.15rem,2vw,1.45rem)" }}>{dictSteps[i]?.[1] || s.title}</h3>
                  <p className="mx-auto mt-2 max-w-[15rem] text-[12.5px] leading-relaxed text-g-ink sm:text-[13px]">{dictSteps[i]?.[2] || s.desc}</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-g-line bg-white/[0.04] px-3 py-1 text-[11.5px] font-semibold" style={{ color: `rgb(${s.rgb})` }}>✓ {M.tags[i] || s.tag}</div>
                  {/* ✨ «VOCÊ VÊ» (Luis, 2026-08-25): «da implementação até o resultado em 7 dias,
                      JÁ VENDO TUDO FUNCIONAR, e organização». As três linhas de cima dizem o que
                      NÓS fazemos; faltava o que ELE recebe em cada etapa. Sem isso, os 7 dias são
                      uma caixa-preta com uma fatura no fim. */}
                  {/* O QUE VOCÊ FAZ (Luis, 2026-09-10): a ativação é quase zero esforço pra ele e isso não estava dito. */}
                  {M.voce?.[i] && (
                    <div className="mt-3 border-t border-white/[0.07] pt-3">
                      <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-g-gold/80">{M.voceLabel}</div>
                      <div className="mt-1 text-[12.5px] font-semibold text-g-word">{M.voce[i]}</div>
                    </div>
                  )}
                  {M.ve?.[i] && (
                    <div className="mt-3 border-t border-white/[0.07] pt-3">
                      <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-g-muted">{M.veLabel}</div>
                      <div className="mt-1 text-[12.5px] font-semibold text-g-word">{M.ve[i]}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      
    </section>
  );
}
