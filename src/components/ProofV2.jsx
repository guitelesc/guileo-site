// ProofV2 — TEST (/v2): trust + compliance, matched from guileoai.com. Compliance badges,
// "a real founder runs it with you" and security. The live "Gui calls you back" form lives
// in the dedicated LiveCall section right below (no duplicate call form here).

import { FaShieldHalved } from "react-icons/fa6";
import { useLang } from "../i18n.jsx";

const BADGES = ["HIPAA", "GDPR", "LGPD", "CCPA", "PCI DSS"];

const PV_COPY = {
  en: { eyebrow:"Built to be trusted", header:"Built to standards like", subA:"We align our practices with these standards ", subB:"from day one", subM:" — your stack, your data, your customers, ", subC:"carefully governed", subD:". A BAA is available on request." },
  pt: { eyebrow:"Feito para ser confiável", header:"Construído com padrões como", subA:"Alinhamos nossas práticas a esses padrões ", subB:"desde o dia um", subM:" — seu sistema, seus dados, seus clientes, ", subC:"cuidadosamente governados", subD:". Um BAA disponível mediante solicitação." },
  es: { eyebrow:"Hecho para confiar", header:"Construido con estándares como", subA:"Alineamos nuestras prácticas con estos estándares ", subB:"desde el día uno", subM:" — tu stack, tus datos, tus clientes, ", subC:"cuidadosamente gobernados", subD:". Un BAA disponible a pedido." },
  hi: { eyebrow:"भरोसे के लिए बना", header:"इन जैसे मानकों के अनुरूप बना", subA:"हम अपनी प्रथाओं को इन मानकों के अनुरूप ", subB:"पहले दिन से", subM:" रखते हैं — आपका सिस्टम, आपका डेटा, आपके ग्राहक, ", subC:"सावधानी से नियंत्रित", subD:"। अनुरोध पर BAA उपलब्ध।" },
};

export default function ProofV2() {
  const { lang } = useLang();
  const P = PV_COPY[lang] || PV_COPY.en;
  return (
    <section className="relative overflow-hidden px-5 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(640px_300px_at_50%_20%,rgba(62,148,104,0.09),transparent)]" />
      <style>{`@keyframes pvreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes pvfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>

      <div className="mx-auto max-w-5xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "pvreveal .7s ease both" }}>{P.eyebrow}</div>

        {/* compliance badges — "aligned with", not certified */}
        <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-g-ink" style={{ animation: "pvreveal .7s ease .05s both" }}>{P.header}</div>
        {/* ═══ IGUAL À FAIXA DO TOPO (Luis, 2026-08-25: «como tava no começo do site») ═══════
            Mesma gramática do <TrustStrip />: círculo de 36px com aro branco 10% sobre branco 4%,
            rótulo em preto forte ao lado, itens soltos numa linha — SEM cartão em volta.
            Por que isso é melhor aqui: caixa em volta transforma cada norma num "produto"; solto,
            vira o que é — uma lista de padrões que a casa segue. E repetir a gramática do topo faz
            a página inteira parecer o mesmo sistema, que é o que estava faltando. */}
        <div className="mx-auto mt-5 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {BADGES.map((b, i) => (
            <div key={b} className="flex items-center gap-2.5" style={{ animation: `pvreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.09}s both` }}>
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.04] text-[15px] ring-1 ring-white/10"
                style={{ color: "rgba(237,231,220,0.85)" }}><FaShieldHalved /></span>
              <div className="text-[12.5px] font-black tracking-tight text-g-word">{b}</div>
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
