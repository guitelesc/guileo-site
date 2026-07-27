import { useLang } from "../i18n.jsx";
import { Reveal, Stagger, Item, Magnetic } from "../lib/ui.jsx";

// "The whole picture" — the at-a-glance summary a visitor gets in one screen.
// REDESIGN (2026-06-15): "connected system" — ONE unit, not two floating cards.
//   The ENGINE ("we operate it · every month") runs LIVE on TOP of the
//   FOUNDATION ("we build it · once") that powers it 24/7. Energy flows UP from
//   the foundation into the engine — communicating "built once, runs forever".
// Green is a discreet detail; champagne/gold is the premium highlight. Smooth CSS motion.
const T = {
  en: {
    eyebrow: "THE WHOLE PICTURE",
    h1a: "One AI + marketing team that ", h1b: "answers, sells and grows", h1c: " your business — on its own, 24/7.",
    sub: "You pick the result. We deliver it. And you watch it all happen — live — in your dashboard.",
    steps: ["You pick", "We deliver", "You watch — live"],
    opTitle: "We operate it", opTag: "every month",
    opClusters: [
      { name: "Answers", icon: "🛎️", items: [["📞", "Every call & message, 24/7 — never busy"], ["⚡", "Missed or busy → text-back + auto-callback"]] },
      { name: "Sells & follows up", icon: "🎯", items: [["⏱️", "New leads called back in ~60s"], ["💳", "Quotes, closes & collects on the call"], ["📅", "Predictive no-show radar + reminders"], ["🎁", "Packages, memberships & gift cards"]] },
      { name: "Reputation & marketing", icon: "⭐", items: [["🌟", "Asks for & manages 5-star reviews"], ["📣", "Ads + content — posts, reels, videos"], ["📊", "A real revenue report every week"]] },
    ],
    runsOn: "Runs 24/7 on the foundation we build you",
    buildTitle: "We build it", buildTag: "once",
    build: [["🌐", "Website"], ["📱", "iOS & Android apps"], ["🧩", "Custom software"], ["🛒", "Online store"], ["📈", "Growth Cockpit"]],
    foot: "Gui speaks 20+ languages · dashboard in 4 · live in 7 days · 30-day money-back.",
    cta1: "See everything →",
  },
  pt: {
    eyebrow: "O QUADRO COMPLETO",
    h1a: "Um time de IA + marketing que ", h1b: "atende, vende e faz crescer", h1c: " o seu negócio — sozinho, 24/7.",
    sub: "Você escolhe o resultado. A gente entrega. E você vê tudo acontecendo — ao vivo — no seu painel.",
    steps: ["Você escolhe", "A gente entrega", "Você vê — ao vivo"],
    opTitle: "A gente opera", opTag: "todo mês",
    opClusters: [
      { name: "Atende", icon: "🛎️", items: [["📞", "Toda ligação e mensagem, 24/7 — nunca ocupado"], ["⚡", "Perdeu ou ocupado → texto + retorno automático"]] },
      { name: "Vende e faz follow-up", icon: "🎯", items: [["⏱️", "Liga pro lead novo em ~60s"], ["💳", "Orça, fecha e cobra na própria ligação"], ["📅", "Radar preditivo de no-show + lembretes"], ["🎁", "Pacotes, assinaturas & gift cards"]] },
      { name: "Reputação e marketing", icon: "⭐", items: [["🌟", "Pede e gerencia avaliações 5 estrelas"], ["📣", "Anúncios + conteúdo — posts, reels, vídeos"], ["📊", "Relatório real de receita toda semana"]] },
    ],
    runsOn: "Roda 24/7 sobre a fundação que a gente constrói",
    buildTitle: "A gente constrói", buildTag: "uma vez",
    build: [["🌐", "Site"], ["📱", "Apps iOS e Android"], ["🧩", "Software sob medida"], ["🛒", "Loja online"], ["📈", "Growth Cockpit"]],
    foot: "A Gui fala 20+ idiomas · painel em 4 · no ar em 7 dias · 30 dias de garantia.",
    cta1: "Ver tudo →",
  },
  es: {
    eyebrow: "EL CUADRO COMPLETO",
    h1a: "Un equipo de IA + marketing que ", h1b: "atiende, vende y hace crecer", h1c: " tu negocio — solo, 24/7.",
    sub: "Tú eliges el resultado. Nosotros lo entregamos. Y lo ves todo pasar — en vivo — en tu panel.",
    steps: ["Tú eliges", "Nosotros entregamos", "Tú lo ves — en vivo"],
    opTitle: "Lo operamos", opTag: "cada mes",
    opClusters: [
      { name: "Atiende", icon: "🛎️", items: [["📞", "Cada llamada y mensaje, 24/7 — nunca ocupado"], ["⚡", "Perdida u ocupada → texto + rellamada automática"]] },
      { name: "Vende y da seguimiento", icon: "🎯", items: [["⏱️", "Llama a un lead nuevo en ~60s"], ["💳", "Cotiza, cierra y cobra en la llamada"], ["📅", "Radar predictivo de ausencias + recordatorios"], ["🎁", "Paquetes, membresías & gift cards"]] },
      { name: "Reputación y marketing", icon: "⭐", items: [["🌟", "Pide y gestiona reseñas de 5 estrellas"], ["📣", "Anuncios + contenido — posts, reels, videos"], ["📊", "Un reporte real de ingresos cada semana"]] },
    ],
    runsOn: "Funciona 24/7 sobre la base que te construimos",
    buildTitle: "Lo construimos", buildTag: "una vez",
    build: [["🌐", "Web"], ["📱", "Apps iOS y Android"], ["🧩", "Software a medida"], ["🛒", "Tienda online"], ["📈", "Growth Cockpit"]],
    foot: "Gui habla 20+ idiomas · panel en 4 · en marcha en 7 días · 30 días de garantía.",
    cta1: "Ver todo →",
  },
  hi: {
    eyebrow: "पूरी तस्वीर",
    h1a: "एक AI + मार्केटिंग टीम जो ", h1b: "जवाब देती, बेचती और बढ़ाती है", h1c: " आपका व्यवसाय — अपने आप, 24/7।",
    sub: "आप परिणाम चुनते हैं। हम पहुँचाते हैं। और आप सब कुछ होते देखते हैं — लाइव — अपने डैशबोर्ड में।",
    steps: ["आप चुनें", "हम पहुँचाएँ", "आप देखें — लाइव"],
    opTitle: "हम इसे चलाते हैं", opTag: "हर महीने",
    opClusters: [
      { name: "जवाब देती है", icon: "🛎️", items: [["📞", "हर कॉल और मैसेज, 24/7 — कभी व्यस्त नहीं"], ["⚡", "मिस्ड या व्यस्त → टेक्स्ट + ऑटो कॉल-बैक"]] },
      { name: "बेचती और फ़ॉलो-अप करती है", icon: "🎯", items: [["⏱️", "नए लीड को ~60 सेकंड में कॉल-बैक"], ["💳", "कॉल पर ही कोट, डील बंद और वसूली"], ["📅", "प्रेडिक्टिव नो-शो रडार + रिमाइंडर"], ["🎁", "पैकेज, मेंबरशिप & गिफ़्ट कार्ड"]] },
      { name: "प्रतिष्ठा और मार्केटिंग", icon: "⭐", items: [["🌟", "5-स्टार समीक्षाएँ माँगती और सँभालती है"], ["📣", "विज्ञापन + कंटेंट — पोस्ट, रील, वीडियो"], ["📊", "हर हफ़्ते असली रेवेन्यू रिपोर्ट"]] },
    ],
    runsOn: "उस नींव पर 24/7 चलता है जो हम आपके लिए बनाते हैं",
    buildTitle: "हम इसे बनाते हैं", buildTag: "एक बार",
    build: [["🌐", "वेबसाइट"], ["📱", "iOS और Android ऐप"], ["🧩", "कस्टम सॉफ़्टवेयर"], ["🛒", "ऑनलाइन स्टोर"], ["📈", "Growth Cockpit"]],
    foot: "Gui 20+ भाषाएँ बोलती है · डैशबोर्ड 4 में · 7 दिनों में लाइव · 30-दिन मनी-बैक।",
    cta1: "सब कुछ देखें →",
  },
};

// Small consistent icon chip — scannable, not a wall of checks
function IconDot({ children, accent }) {
  return (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 text-[13px] ${accent}`}>
      {children}
    </span>
  );
}

export default function WholePictureV2() {
  const { lang } = useLang();
  const t = T[lang] || T.en;
  // global running index across all 3 clusters → drives the christmas-lights chase
  const opOffsets = []; { let a = 0; for (const c of t.opClusters) { opOffsets.push(a); a += c.items.length; } }
  const opTotal = t.opClusters.reduce((s, c) => s + c.items.length, 0);
  const opCycle = (opTotal * 0.7).toFixed(1); // full loop length; 0.7s per item
  return (
    <section className="relative max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
      <style>{`
        @keyframes wpspin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes wppulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
        @keyframes wpflow{0%{transform:translateY(10px);opacity:0}30%{opacity:1}100%{transform:translateY(-14px);opacity:0}}
        @keyframes wpsheen{0%{transform:translateX(-60%) skewX(-14deg);opacity:0}18%{opacity:1}55%,100%{transform:translateX(460%) skewX(-14deg);opacity:0}}
        @keyframes wpglow{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.85;transform:scale(1.14)}}
        /* christmas-lights chase: each row lights up in sequence so the eye reads them one by one */
        @keyframes wplight{0%{background-color:rgba(62,148,104,0)}3%{background-color:rgba(62,148,104,0.30)}11%{background-color:rgba(62,148,104,0.30)}20%,100%{background-color:rgba(62,148,104,0)}}
        @keyframes wpldot{0%,100%{box-shadow:none}3%,11%{box-shadow:0 0 12px rgba(62,148,104,0.9)}}
        /* foundation slabs: gentle glassy float (vertical movement) */
        @keyframes wpfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @media (prefers-reduced-motion: reduce){
          [style*="wpspin"],[style*="wppulse"],[style*="wpflow"],[style*="wpsheen"],[style*="wpglow"],[style*="wplight"],[style*="wpldot"],[style*="wpfloat"]{animation:none !important}
        }
      `}</style>

      <Reveal className="text-center max-w-3xl mx-auto">
        <span className="inline-block text-[11px] font-black uppercase tracking-[0.16em] text-g-gold border border-g-gold/25 bg-g-gold/[0.08] rounded-full px-3 py-1">{t.eyebrow}</span>
        <h2 className="mt-5 text-3xl sm:text-[2.7rem] font-black tracking-tight leading-[1.08] text-g-word">
          {t.h1a}<span className="bg-gradient-to-r from-g-green via-emerald-200 to-g-green bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{t.h1b}</span>{t.h1c}
        </h2>
        <p className="mt-4 text-base sm:text-lg text-g-light/85 leading-relaxed">{t.sub}</p>
      </Reveal>

      {/* THREE mini-steps: You pick → We deliver → You watch live */}
      <Stagger className="mt-9 flex flex-wrap items-center justify-center gap-x-2 gap-y-3" gap={0.1}>
        {t.steps.map((s, i) => (
          <Item key={i} variant="up" className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-md">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-g-gold/15 text-[12px] font-black text-g-gold ring-1 ring-g-gold/30">{i + 1}</span>
              <span className="text-[14px] font-bold text-g-word whitespace-nowrap">{s}</span>
            </span>
            {i < t.steps.length - 1 && <span className="text-g-muted text-lg">→</span>}
          </Item>
        ))}
      </Stagger>

      {/* ONE CONNECTED SYSTEM — the engine (operates monthly) runs on top of the foundation (built once) */}
      <Reveal variant="scale" className="mt-10">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-3 shadow-lift backdrop-blur-xl sm:p-4"
          style={{ boxShadow: "0 30px 80px -40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.12)" }}>
          {/* premium light-sweep across the whole system */}
          <span aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[2rem]">
            <span className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" style={{ animation: "wpsheen 8s ease-in-out 1.5s infinite" }} />
          </span>

          {/* ░░ ENGINE — operates every month, the live layer on top ░░ */}
          <div className="relative overflow-hidden rounded-[1.55rem] border border-g-green/45 bg-gradient-to-b from-g-green/[0.16] to-g-green/[0.04] p-5 sm:p-7"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 60px rgba(62,148,104,0.10)" }}>
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-g-green/[0.12] blur-3xl" style={{ animation: "wpglow 5s ease-in-out infinite" }} />
            <div className="relative flex items-center gap-3">
              {/* rotating cycle motif — the engine running */}
              <span className="relative grid h-12 w-12 shrink-0 place-items-center">
                <svg viewBox="0 0 48 48" className="absolute inset-0 h-12 w-12" style={{ animation: "wpspin 14s linear infinite" }} aria-hidden>
                  <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(62,148,104,0.30)" strokeWidth="2" strokeDasharray="6 7" strokeLinecap="round" />
                  <path d="M24 4 a20 20 0 0 1 14 6" fill="none" stroke="#3E9468" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M38 10 l-2 6 l6 -1" fill="none" stroke="#3E9468" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-lg">🔁</span>
              </span>
              <div className="flex-1">
                <div className="text-[15px] font-black uppercase tracking-wide text-g-word">{t.opTitle}</div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-g-green">
                  <span className="h-1.5 w-1.5 rounded-full bg-g-green" style={{ animation: "wppulse 2s ease-in-out infinite" }} />{t.opTag}
                </div>
              </div>
            </div>

            {/* the engine's 3 functions, side by side — reads as one machine, not a list */}
            <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
              {t.opClusters.map((c, ci) => (
                <div key={ci} className="overflow-hidden rounded-2xl border border-g-green/30 bg-g-deep/40">
                  {/* colored header bar — the cluster name pops */}
                  <div className="flex items-center gap-2 border-b border-g-green/25 bg-g-green/[0.18] px-3.5 py-2.5">
                    <span className="text-[15px]">{c.icon}</span>
                    <span className="text-[12.5px] font-black uppercase tracking-wider text-g-green">{c.name}</span>
                  </div>
                  <ul className="space-y-1.5 p-2.5">
                    {c.items.map(([ic, line], i) => {
                      const gi = opOffsets[ci] + i; // global position in the chase
                      const delay = (gi * 0.7).toFixed(2);
                      return (
                        <li key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold leading-snug text-white"
                          style={{ animation: `wplight ${opCycle}s ease-in-out ${delay}s infinite` }}>
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-g-green/15 ring-1 ring-g-green/35 text-[13px]" style={{ animation: `wpldot ${opCycle}s ease-in-out ${delay}s infinite` }}>{ic}</span>
                          <span>{line}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* ░░ CONNECTOR — energy flowing UP from the foundation into the engine ░░ */}
          <div className="relative flex items-center justify-center gap-6 py-3" aria-hidden>
            <span className="hidden h-px flex-1 bg-gradient-to-r from-transparent to-g-gold/30 sm:block" />
            <div className="flex items-center gap-2.5">
              {/* three supply lines, dots rising from base → engine */}
              <div className="flex items-end gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="relative grid h-5 w-1.5 place-items-end overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="h-1.5 w-1.5 rounded-full bg-g-green" style={{ animation: `wpflow 1.8s ease-in ${i * 0.45}s infinite`, boxShadow: "0 0 7px rgba(62,148,104,0.85)" }} />
                  </span>
                ))}
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-g-gold">{t.runsOn}</span>
            </div>
            <span className="hidden h-px flex-1 bg-gradient-to-l from-transparent to-g-gold/30 sm:block" />
          </div>

          {/* ░░ FOUNDATION — built once, the solid base the engine runs on ░░ */}
          <div className="relative overflow-hidden rounded-[1.55rem] border border-g-gold/45 bg-gradient-to-b from-g-gold/[0.16] to-g-gold/[0.04] p-5 sm:p-6"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 60px rgba(214,194,154,0.12)" }}>
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-g-gold/[0.12] blur-3xl" style={{ animation: "wpglow 6s ease-in-out 1s infinite" }} />
            <div className="relative mb-4 flex items-center gap-3">
              {/* solid stacked-blocks motif — a foundation, built once */}
              <span className="grid h-11 w-11 shrink-0 place-items-center">
                <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
                  <rect x="9" y="28" width="30" height="9" rx="2" fill="rgba(214,194,154,0.32)" stroke="#D6C29A" strokeWidth="1.6" />
                  <rect x="13" y="19" width="22" height="9" rx="2" fill="rgba(214,194,154,0.22)" stroke="#D6C29A" strokeWidth="1.6" />
                  <rect x="17" y="10" width="14" height="9" rx="2" fill="rgba(214,194,154,0.16)" stroke="#D6C29A" strokeWidth="1.6" />
                </svg>
              </span>
              <div>
                <div className="text-[15px] font-black uppercase tracking-wide text-g-word">{t.buildTitle}</div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-g-gold">
                  <span className="h-1.5 w-1.5 rounded-sm bg-g-gold" />{t.buildTag}
                </div>
              </div>
            </div>
            {/* the 5 assets as a row of solid base slabs — the foundation the engine sits on */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {t.build.map(([ic, line], i) => (
                <div key={i} className="group flex flex-col items-center gap-1.5 rounded-xl border border-g-gold/35 bg-g-gold/[0.10] px-2 py-3.5 text-center backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors duration-300 hover:border-g-gold/60 hover:bg-g-gold/[0.18]"
                  style={{ animation: `wpfloat ${(3 + i * 0.4).toFixed(1)}s ease-in-out ${(i * 0.25).toFixed(2)}s infinite` }}>
                  <span className="text-2xl">{ic}</span>
                  <span className="text-[12.5px] font-bold leading-tight text-g-word">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Footer guarantee bar + CTA */}
      <Reveal className="mt-8 text-center">
        <p className="text-[12.5px] text-g-muted">🛡️ {t.foot}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Magnetic><a href="/servicos" className="btn-bright text-sm">{t.cta1}</a></Magnetic>
        </div>
      </Reveal>
    </section>
  );
}
