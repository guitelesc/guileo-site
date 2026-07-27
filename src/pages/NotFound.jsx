// Branded 404 — a lost visitor is still a lead. Warm, on-brand, two ways back in.
import { useLang } from "../i18n.jsx";
import mark from "../assets/guileo-mark.png";

const COPY = {
  en: { t: "This page stepped out for lunch.", s: "Gui, on the other hand, never does — she keeps answering 24/7 😉 Let's get you back.", home: "← Back to Guileo", talk: "🎙️ Talk to Gui instead" },
  pt: { t: "Essa página saiu pra almoçar.", s: "Já a Gui, não — ela continua atendendo 24/7 😉 Bora voltar pro caminho.", home: "← Voltar pro Guileo", talk: "🎙️ Falar com a Gui" },
  es: { t: "Esta página salió a almorzar.", s: "Gui, en cambio, nunca sale — sigue contestando 24/7 😉 Volvamos al camino.", home: "← Volver a Guileo", talk: "🎙️ Hablar con Gui" },
  hi: { t: "यह पेज लंच पर निकल गया।", s: "लेकिन Gui कभी नहीं जाती — वह 24/7 जवाब देती रहती है 😉 चलिए वापस चलें।", home: "← Guileo पर वापस", talk: "🎙️ Gui से बात करें" },
};

export default function NotFound() {
  const { lang } = useLang();
  const C = COPY[lang] || COPY.en;
  return (
    <div className="grid min-h-screen place-items-center bg-g-cream px-5 text-center text-g-word">
      <div>
        <img src={mark} alt="Guileo" className="mx-auto w-[120px] opacity-90" style={{ animation: "nf-breathe 5s ease-in-out infinite" }} />
        <style>{`@keyframes nf-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
        <div className="mt-4 text-[64px] font-black leading-none text-g-gold">404</div>
        <h1 className="mt-2 text-2xl font-black">{C.t}</h1>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-g-ink">{C.s}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="/" className="rounded-full bg-gradient-to-r from-g-green to-g-dark px-6 py-3 text-[14px] font-bold text-white">{C.home}</a>
          <a href="/#try" className="rounded-full border border-g-line bg-white/[0.04] px-6 py-3 text-[14px] font-bold text-g-word hover:border-g-green/40">{C.talk}</a>
        </div>
      </div>
    </div>
  );
}
