// BuildAllV2 — TEST (/v2): "Everything we build" — 60+ done-for-you services & products
// as two opposite-scrolling marquees so people grasp the full breadth at a glance.
// One team, one bill, zero handoffs. Guileo design system + smooth CSS motion.

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

function Row({ dir = "l", speed = 38 }) {
  const list = [...ITEMS, ...ITEMS];
  return (
    <div className="flex w-max gap-3" style={{ animation: `${dir === "l" ? "bscrollL" : "bscrollR"} ${speed}s linear infinite` }}>
      {list.map((it, i) => <Chip key={i} it={it} />)}
    </div>
  );
}

export default function BuildAllV2() {
  return (
    <section className="relative overflow-hidden bg-g-cream px-5 py-20">
      <style>{`
        @keyframes breveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bshine{to{background-position:220% center}}
        @keyframes bscrollL{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes bscrollR{from{transform:translateX(-50%)}to{transform:translateX(0)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <div className="mx-auto max-w-4xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "breveal .7s ease both" }}>★ Everything we build</div>
        <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="text-g-word" style={{ animation: "breveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>From your first website </span>
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "breveal .8s cubic-bezier(.2,.7,.2,1) .2s both, bshine 7s linear infinite" }}>to your final sale.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "breveal .8s ease .3s both" }}>
          <span className="font-bold text-g-word">60+ done-for-you</span> services &amp; products — one team, one bill, <span className="font-semibold text-g-green">zero handoffs</span>.
        </p>
      </div>

      {/* two opposite marquees */}
      <div className="relative mt-10 space-y-3 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]" style={{ animation: "breveal .8s ease .4s both" }}>
        <Row dir="l" speed={40} />
        <Row dir="r" speed={48} />
      </div>

      <div className="mt-10 text-center" style={{ animation: "breveal .8s ease .6s both" }}>
        <a href="/servicos" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-6 py-3 text-[14px] font-bold text-g-word transition hover:border-g-green/40 hover:bg-white/[0.07]">
          Browse all services <span className="text-g-green">→</span>
        </a>
      </div>
    </section>
  );
}
