// ProofV2 — TEST (/v2): trust + compliance, matched from guileoai.com. Compliance badges,
// "a real founder runs it with you" and security. The live "Gui calls you back" form lives
// in the dedicated LiveCall section right below (no duplicate call form here).

import { useLang } from "../i18n.jsx";

const BADGES = ["HIPAA", "GDPR", "LGPD", "CCPA", "PCI DSS"];

const PV_COPY = {
  en: { eyebrow:"Built to be trusted", subA:"We build to these standards ", subB:"from day one", subM:" — your stack, your data, your customers, ", subC:"fully governed", subD:"." },
  pt: { eyebrow:"Feito para ser confiável", subA:"Construímos nesses padrões ", subB:"desde o dia um", subM:" — seu sistema, seus dados, seus clientes, ", subC:"totalmente governados", subD:"." },
  es: { eyebrow:"Hecho para confiar", subA:"Construimos con estos estándares ", subB:"desde el día uno", subM:" — tu stack, tus datos, tus clientes, ", subC:"totalmente gobernados", subD:"." },
  hi: { eyebrow:"भरोसे के लिए बना", subA:"हम इन मानकों पर ", subB:"पहले दिन से", subM:" बनाते हैं — आपका सिस्टम, आपका डेटा, आपके ग्राहक, ", subC:"पूरी तरह नियंत्रित", subD:"।" },
};

export default function ProofV2() {
  const { lang } = useLang();
  const P = PV_COPY[lang] || PV_COPY.en;
  return (
    <section className="relative overflow-hidden px-5 py-20">
      <style>{`@keyframes pvreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes pvpulse{0%,100%{opacity:.5}50%{opacity:1}}@keyframes pvfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(640px_300px_at_50%_20%,rgba(62,148,104,0.09),transparent)]" />

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "pvreveal .7s ease both" }}>{P.eyebrow}</div>

        {/* compliance badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {BADGES.map((b, i) => (
            <div key={b} className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-4 py-2 transition-all duration-300 hover:-translate-y-1 hover:border-g-green/45 hover:bg-g-green/[0.07] hover:shadow-[0_16px_36px_-20px_rgba(62,148,104,0.7)]"
              style={{ animation: `pvreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.09}s both` }}>
              <span className="text-base" style={{ animation: `pvfloat ${2.8 + (i % 3) * 0.5}s ease-in-out ${i * 0.35}s infinite`, filter: "drop-shadow(0 3px 8px rgba(62,148,104,0.5))" }}>🛡️</span>
              <span className="text-[13px] font-bold text-g-word">{b}</span>
              <span className="text-g-green" style={{ animation: "pvpulse 2.4s ease-in-out infinite", animationDelay: `${i * 0.3}s` }}>✓</span>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "pvreveal .8s ease .2s both" }}>
          {P.subA}<span className="font-semibold text-g-word">{P.subB}</span>{P.subM}<span className="font-semibold text-g-green">{P.subC}</span>{P.subD}
        </p>
      </div>
    </section>
  );
}
