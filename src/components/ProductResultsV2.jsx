import { useLang } from "../i18n.jsx";
import { Reveal, Stagger, Item } from "../lib/ui.jsx";
import { PRODUCTS } from "../data/productSystem.js";

// ProductResultsV2 — result-forward product showcase for the LIVE landing.
// The whole point (Luis, 2026-07-23): show the RESULT of each product, not just its name.
// So every card LEADS with the big result metric (in the product's accent), THEN the
// product name (secondary subtitle), THEN a one-line result sentence.
// Locked design language: cement dark bg, glass cards (bg-white/[0.03], border-white/10,
// rounded-2xl, backdrop-blur), champagne/gold eyebrow, CSS keyframes only + Reveal/Stagger.

const COPY = {
  en: {
    eyebrow: "★ What you actually get",
    h1a: "You don't buy features. ",
    h1b: "You buy outcomes.",
    sub: "Every product below is here for one reason — the result it puts back in your pocket.",
    estimate: "* market estimate by sector — your numbers depend on your business.",
  },
  pt: {
    eyebrow: "★ O que você realmente ganha",
    h1a: "Você não compra recursos. ",
    h1b: "Você compra resultado.",
    sub: "Cada produto aqui existe por um motivo só — o resultado que ele devolve pro seu bolso.",
    estimate: "* estimativa de mercado por setor — seus números dependem do seu negócio.",
  },
  es: {
    eyebrow: "★ Lo que de verdad te llevas",
    h1a: "No compras funciones. ",
    h1b: "Compras resultados.",
    sub: "Cada producto está aquí por una sola razón — el resultado que devuelve a tu bolsillo.",
    estimate: "* estimación de mercado por sector — tus números dependen de tu negocio.",
  },
  hi: {
    eyebrow: "★ आपको असल में क्या मिलता है",
    h1a: "आप फ़ीचर नहीं खरीदते। ",
    h1b: "आप नतीजा खरीदते हैं।",
    sub: "यहाँ हर प्रोडक्ट एक ही वजह से है — वह नतीजा जो आपकी जेब में लौटाता है।",
    estimate: "* सेक्टर अनुसार बाज़ार अनुमान — आपके आँकड़े आपके व्यवसाय पर निर्भर हैं।",
  },
};

// pick a lang field with en fallback
const L = (obj, lang) => (obj && (obj[lang] || obj.en)) || "";

export default function ProductResultsV2() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.en;
  const anyEstimate = PRODUCTS.some((p) => p.resultIsEstimate);

  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`
        @keyframes prreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes prshine{to{background-position:220% center}}
        @keyframes prglow{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.9;transform:scale(1.15)}}
        @media (prefers-reduced-motion: reduce){
          [style*="prglow"]{animation:none !important}
        }
      `}</style>
      {/* soft champagne + green field, matches the page */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(760px_380px_at_18%_-5%,rgba(214,194,154,0.10),transparent),radial-gradient(760px_380px_at_88%_105%,rgba(62,148,104,0.10),transparent)]" />

      <div className="mx-auto max-w-6xl">
        {/* header — locked pattern: champagne eyebrow → font-black h2 w/ one shimmer phrase → greige sub */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.eyebrow}</div>
          <h2 className="mt-4 font-black leading-[1.02] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
            {t.h1a}
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "prshine 6s linear infinite" }}>{t.h1b}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink">{t.sub}</p>
        </Reveal>

        {/* result-forward grid: 1 col mobile → 2 → 3 desktop */}
        <Stagger className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" gap={0.07}>
          {PRODUCTS.filter((p) => p.resultMetric).map((p) => {
            const rgb = hexToRgb(p.accent);
            return (
              <Item key={p.id} variant="up">
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05]"
                  style={{ boxShadow: "0 18px 44px -30px rgba(0,0,0,0.85)" }}>
                  {/* accent top edge + hover-lit border tint */}
                  <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] opacity-70 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.9),transparent)` }} />
                  {/* accent glow blooming from the icon corner */}
                  <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl" style={{ background: `rgba(${rgb},0.16)`, animation: "prglow 6s ease-in-out infinite" }} />

                  {/* top row: category chip + product icon (accent detail) */}
                  <div className="relative flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ borderColor: `rgba(${rgb},0.35)`, color: p.accent, background: `rgba(${rgb},0.08)` }}>{L(p.category, lang)}</span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[17px] ring-1" style={{ background: `rgba(${rgb},0.12)`, boxShadow: `0 0 0 1px rgba(${rgb},0.30)`, filter: `drop-shadow(0 3px 10px rgba(${rgb},0.5))` }}>{p.icon}</span>
                  </div>

                  {/* THE HERO — the result metric, big, in the product's accent */}
                  <div className="relative mt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-black leading-none tracking-tight tabular-nums" style={{ color: p.accent, fontSize: "clamp(2.1rem,6vw,2.9rem)", textShadow: `0 4px 24px rgba(${rgb},0.35)` }}>
                        {p.resultMetric.value}
                        {p.resultIsEstimate && <span className="align-super text-[0.42em] font-bold text-g-muted">*</span>}
                      </span>
                    </div>
                    <div className="mt-1 text-[12.5px] font-bold uppercase tracking-wide text-g-light/80">{L(p.resultMetric.unit, lang)}</div>
                  </div>

                  {/* the name — SECONDARY, the subtitle to the result */}
                  <div className="relative mt-3 text-[14px] font-black tracking-tight text-g-word">{L(p.name, lang)}</div>

                  {/* one-line result sentence */}
                  <p className="relative mt-1.5 text-[12.5px] leading-snug text-g-ink">{L(p.result, lang)}</p>
                </article>
              </Item>
            );
          })}
        </Stagger>

        {/* ONE estimate caption at the section foot */}
        {anyEstimate && (
          <Reveal className="mt-6 text-center">
            <p className="text-[11px] italic text-g-muted">{t.estimate}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}

// hex "#RRGGBB" → "r,g,b" for rgba() glows/tints (accent stays a single source of truth)
function hexToRgb(hex) {
  const h = (hex || "#FF8A33").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
