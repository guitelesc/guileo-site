// BuildAllV2 — "Everything we build" — 60+ done-for-you services & products,
// ORGANIZED into 4 labeled category clusters (AI Agents · Websites & Apps ·
// Software & Automations · Growth & Marketing) so the breadth reads instantly.
// One team, one bill, zero handoffs. Guileo design system + smooth CSS motion.
import { useLang } from "../i18n.jsx";

const BV_COPY = {
  en: { eyebrow:"★ Everything we build", h1a:"From your first website ", h1b:"to your final sale.", subA:"60+ done-for-you", subB:" services & products — one team, one bill, ", subC:"zero handoffs", cta:"Browse all services",
    cats:["AI Agents","Websites & Apps","Software & Automations","Growth & Marketing"] },
  pt: { eyebrow:"★ Tudo o que construímos", h1a:"Do seu primeiro site ", h1b:"até a sua venda final.", subA:"60+ feitos pra você", subB:" — serviços & produtos · um time, uma conta, ", subC:"zero burocracia", cta:"Ver todos os serviços",
    cats:["Agentes de IA","Sites & Apps","Software & Automações","Crescimento & Marketing"] },
  es: { eyebrow:"★ Todo lo que construimos", h1a:"De tu primera web ", h1b:"a tu venta final.", subA:"60+ hechos para ti", subB:" — servicios & productos · un equipo, una factura, ", subC:"cero traspasos", cta:"Ver todos los servicios",
    cats:["Agentes de IA","Webs & Apps","Software & Automatizaciones","Crecimiento & Marketing"] },
  hi: { eyebrow:"★ हम जो कुछ बनाते हैं", h1a:"आपकी पहली वेबसाइट से ", h1b:"आपकी आख़िरी बिक्री तक।", subA:"60+ रेडी", subB:" सेवाएँ & प्रोडक्ट — एक टीम, एक बिल, ", subC:"ज़ीरो झंझट", cta:"सभी सेवाएँ देखें",
    cats:["AI एजेंट","वेबसाइट & ऐप्स","सॉफ़्टवेयर & ऑटोमेशन","ग्रोथ & मार्केटिंग"] },
};

const ITEMS = [
  { i: "🎙️", t: "Voice AI agents" },
  { i: "💬", t: "Text & WhatsApp AI" },
  { i: "🌐", t: "Websites" },
  { i: "📱", t: "Mobile apps" },
  { i: "⚙️", t: "Custom software" },
  { i: "📣", t: "Ads & marketing" },
  { i: "📅", t: "Booking systems" },
  { i: "🛒", t: "E-commerce / Shopify" },
  { i: "🔄", t: "Automations" },
  { i: "📊", t: "Dashboards & CRM" },
  { i: "⭐", t: "Reviews & reputation" },
  { i: "📈", t: "Growth & analytics" },
];

// Category clusters — indices into the (i18n) items list. Every item stays; we only group.
// AI Agents → Brain · Websites & Apps + Software & Automations → Build · Growth & Marketing → AD.
const CATS = [
  { emoji: "🤖", leg: "Guileo Brain", rgb: "62,148,104",  text: "text-g-green",      chip: "border-g-green/30 bg-g-green/[0.08] hover:border-g-green/55 hover:bg-g-green/[0.14]",          idx: [0, 1] },
  { emoji: "🌐", leg: "Guileo Build", rgb: "78,157,176",  text: "text-[#4E9DB0]",    chip: "border-[#4E9DB0]/30 bg-[#4E9DB0]/[0.08] hover:border-[#4E9DB0]/55 hover:bg-[#4E9DB0]/[0.14]", idx: [2, 3, 7] },
  { emoji: "⚙️", leg: "Guileo Build", rgb: "214,194,154", text: "text-g-gold",       chip: "border-g-gold/30 bg-g-gold/[0.08] hover:border-g-gold/55 hover:bg-g-gold/[0.14]",              idx: [4, 8, 6, 9] },
  { emoji: "📈", leg: "Guileo.AD",    rgb: "194,168,120", text: "text-g-copper",     chip: "border-g-copper/35 bg-g-copper/[0.08] hover:border-g-copper/60 hover:bg-g-copper/[0.14]",      idx: [5, 10, 11] },
];

export default function BuildAllV2() {
  const { t, lang } = useLang();
  const B = BV_COPY[lang] || BV_COPY.en;
  const dictItems = (t.more && t.more.products && t.more.products.items) || null;
  const items = dictItems ? dictItems.map(([i, tx]) => ({ i, t: tx })) : ITEMS;
  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`
        @keyframes breveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bshine{to{background-position:220% center}}
        @keyframes bfloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}
        @keyframes bsonar{0%{transform:scale(.5);opacity:.45}100%{transform:scale(1.9);opacity:0}}
        @keyframes bsheen{0%{transform:translateX(-130%) skewX(-12deg)}60%,100%{transform:translateX(130%) skewX(-12deg)}}
        @keyframes bchip{from{opacity:0;transform:translateY(8px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes bdot{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.4)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto max-w-4xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "breveal .7s ease both" }}>{B.eyebrow}</div>
        <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "breveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{B.h1a}</span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "breveal .8s cubic-bezier(.2,.7,.2,1) .2s both, bshine 7s linear infinite" }}>{B.h1b}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "breveal .8s ease .3s both" }}>
          <span className="font-bold text-g-word">{B.subA}</span>{B.subB}<span className="font-semibold text-g-green">{B.subC}</span>.
        </p>
      </div>

      {/* 4 labeled category clusters — what we build, organized */}
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2">
        {CATS.map((c, ci) => (
          <div key={c.emoji}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-g-line bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05] shadow-[0_18px_46px_-30px_rgba(0,0,0,0.85)]"
            style={{ animation: `breveal .7s cubic-bezier(.2,.7,.2,1) ${0.35 + ci * 0.12}s both` }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${c.rgb},0.45)`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; }}>
            {/* soft accent halo */}
            <span className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full blur-3xl" style={{ background: `rgba(${c.rgb},0.10)` }} />
            {/* sheen sweeping across the card on a slow loop */}
            <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3" style={{ background: "linear-gradient(105deg,transparent,rgba(255,255,255,0.05),transparent)", animation: `bsheen ${7 + ci * 1.3}s ease-in-out ${ci * 1.1}s infinite` }} />
            <div className="relative flex items-start gap-4">
              {/* free-floating emoji — sonar ring radiating in the category color */}
              <span className="relative shrink-0">
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ borderColor: `rgba(${c.rgb},0.4)`, animation: `bsonar 3s ease-out ${ci * 0.5}s infinite` }} />
                <span className="relative inline-block select-none text-[42px] leading-none transition-transform duration-300 group-hover:scale-110"
                  style={{ animation: `bfloat ${3.2 + ci * 0.6}s ease-in-out ${ci * 0.45}s infinite`, filter: `drop-shadow(0 6px 14px rgba(${c.rgb},0.45))` }}>{c.emoji}</span>
              </span>
              <div className="min-w-0">
                {/* small colored tag eyebrow ABOVE the big free title */}
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${c.text}`}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(${c.rgb})`, boxShadow: `0 0 8px rgba(${c.rgb},0.8)`, animation: `bdot 2.4s ease-in-out ${ci * 0.3}s infinite` }} />{c.leg}
                </span>
                <h3 className="mt-1.5 font-black leading-[1.08] tracking-tight text-g-word" style={{ fontSize: "clamp(1.15rem,2vw,1.45rem)" }}>{B.cats[ci]}</h3>
              </div>
            </div>
            {/* consistent chips — cascade in, then drift gently out of sync */}
            <div className="relative mt-4 flex flex-wrap gap-2">
              {c.idx.map((k, j) => items[k] && (
                <span key={k} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold text-g-word transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.04] ${c.chip}`}
                  style={{ animation: `bchip .5s cubic-bezier(.2,.7,.2,1) ${0.55 + ci * 0.12 + j * 0.09}s both` }}>
                  <span className="text-base" style={{ animation: `bfloat ${2.6 + (j % 3) * 0.7}s ease-in-out ${j * 0.35}s infinite` }}>{items[k].i}</span>{items[k].t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center" style={{ animation: "breveal .8s ease .8s both" }}>
        <a href="/servicos" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-6 py-3 text-[14px] font-bold text-g-word transition hover:border-g-green/40 hover:bg-white/[0.07]">
          {B.cta} <span className="text-g-green">→</span>
        </a>
      </div>
    </section>
  );
}
