// ProofV2 — TEST (/v2): trust + compliance, matched from guileoai.com. Compliance badges,
// "a real founder runs it with you" and security. The live "Gui calls you back" form lives
// in the dedicated LiveCall section right below (no duplicate call form here).

const BADGES = ["HIPAA", "GDPR", "LGPD", "CCPA", "PCI DSS"];

export default function ProofV2() {
  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`@keyframes pvreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes pvpulse{0%,100%{opacity:.5}50%{opacity:1}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "pvreveal .7s ease both" }}>Built to be trusted</div>

        {/* compliance badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5" style={{ animation: "pvreveal .8s ease .1s both" }}>
          {BADGES.map((b) => (
            <div key={b} className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-4 py-2">
              <span className="text-base">🛡️</span>
              <span className="text-[13px] font-bold text-g-word">{b}</span>
              <span className="text-g-green">✓</span>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "pvreveal .8s ease .2s both" }}>
          We build to these standards <span className="font-semibold text-g-word">from day one</span> — your stack, your data, your customers, <span className="font-semibold text-g-green">fully governed</span>.
        </p>
      </div>
    </section>
  );
}
