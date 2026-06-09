// BuildAllV2 — TEST (/v2): "Everything we build" — 60+ done-for-you services & products
// as two opposite-scrolling marquees so people grasp the full breadth at a glance.
// One team, one bill, zero handoffs. Guileo design system + smooth CSS motion.
import { useLang } from "../i18n.jsx";

const BV_COPY = {
  en: { eyebrow:"★ Everything we build", h1a:"From your first website ", h1b:"to your final sale.", subA:"60+ done-for-you", subB:" services & products — one team, one bill, ", subC:"zero handoffs", cta:"Browse all services" },
  pt: { eyebrow:"★ Tudo o que construímos", h1a:"Do seu primeiro site ", h1b:"até a sua venda final.", subA:"60+ feitos pra você", subB:" — serviços & produtos · um time, uma conta, ", subC:"zero burocracia", cta:"Ver todos os serviços" },
  es: { eyebrow:"★ Todo lo que construimos", h1a:"De tu primera web ", h1b:"a tu venta final.", subA:"60+ hechos para ti", subB:" — servicios & productos · un equipo, una factura, ", subC:"cero traspasos", cta:"Ver todos los servicios" },
  hi: { eyebrow:"★ हम जो कुछ बनाते हैं", h1a:"आपकी पहली वेबसाइट से ", h1b:"आपकी आख़िरी बिक्री तक।", subA:"60+ रेडी", subB:" सेवाएँ & प्रोडक्ट — एक टीम, एक बिल, ", subC:"ज़ीरो झंझट", cta:"सभी सेवाएँ देखें" },
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

function Chip({ it }) {
  return (
    <div className="group flex shrink-0 items-center gap-2.5 rounded-xl border border-g-line bg-white/[0.035] px-4 py-2.5 transition-colors duration-300 hover:border-g-green/40 hover:bg-white/[0.06]">
      <span className="text-xl transition-transform duration-300 group-hover:scale-110">{it.i}</span>
      <span className="whitespace-nowrap text-[13.5px] font-semibold text-g-ink">{it.t}</span>
    </div>
  );
}

function Row({ dir = "l", speed = 38, items = ITEMS }) {
  const list = [...items, ...items];
  return (
    <div className="flex w-max gap-3" style={{ animation: `${dir === "l" ? "bscrollL" : "bscrollR"} ${speed}s linear infinite` }}>
      {list.map((it, i) => <Chip key={i} it={it} />)}
    </div>
  );
}

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
        @keyframes bscrollL{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes bscrollR{from{transform:translateX(-50%)}to{transform:translateX(0)}}
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

      {/* two opposite marquees */}
      <div className="relative mt-10 space-y-3 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]" style={{ animation: "breveal .8s ease .4s both" }}>
        <Row dir="l" speed={40} items={items} />
        <Row dir="r" speed={48} items={items} />
      </div>

      <div className="mt-10 text-center" style={{ animation: "breveal .8s ease .6s both" }}>
        <a href="/servicos" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-6 py-3 text-[14px] font-bold text-g-word transition hover:border-g-green/40 hover:bg-white/[0.07]">
          {B.cta} <span className="text-g-green">→</span>
        </a>
      </div>
    </section>
  );
}
