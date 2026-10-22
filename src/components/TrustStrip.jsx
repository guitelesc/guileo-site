import { useLang } from "../i18n.jsx";
import { Reveal } from "../lib/ui.jsx";

// TrustStrip — a slim, HONEST trust bar high on the page (audit: the strongest proof sat 16 sections
// deep and the testimonial block is empty). No fabricated logos/counts — only claims that are true of
// the real platform: money-back, a real human supervises, fast launch, every language, every channel.
// Locked cement + signal system; one quiet row, no motion loop (Faena restraint).

const COPY = {
  en: [
    ["🛡️", "30-day money-back", "the risk is ours"],
    ["👤", "A real human supervises", "not just a bot"],
    ["⚡", "Live in under 7 days", "we wire it all"],
    ["🌎", "16 languages", "every channel, 24/7"],
  ],
  pt: [
    ["🛡️", "Garantia de 30 dias", "o risco é nosso"],
    ["👤", "Um humano supervisiona", "não é só um robô"],
    ["⚡", "No ar em até 7 dias", "a gente liga tudo"],
    ["🌎", "16 idiomas", "todo canal, 24/7"],
  ],
  es: [
    ["🛡️", "Garantía de 30 días", "el riesgo es nuestro"],
    ["👤", "Un humano supervisa", "no es solo un bot"],
    ["⚡", "En vivo en 7 días", "lo conectamos todo"],
    ["🌎", "16 idiomas", "cada canal, 24/7"],
  ],
  hi: [
    ["🛡️", "30-दिन मनी-बैक", "जोखिम हमारा"],
    ["👤", "एक इंसान निगरानी करता है", "सिर्फ़ बॉट नहीं"],
    ["⚡", "7 दिन में लाइव", "सब हम जोड़ते हैं"],
    ["🌎", "16 भाषाएँ", "हर चैनल, 24/7"],
  ],
};

/* CARTÕES, não itens soltos (Luis, 2026-09-09, print da apresentação de 19/08: "aquela textura").
   Cada item vira uma placa de vidro — entra na lei 4K global (aro de luz, verniz, sombra de
   contato + ambiente) — com o ícone num disco e o texto ao lado. É a gramática que ele reconhece. */
export default function TrustStrip() {
  const { lang } = useLang();
  const items = COPY[lang] || COPY.en;
  return (
    <section className="relative px-5 py-8">
      <style>{`@keyframes tsfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@media (prefers-reduced-motion: reduce){*{animation:none !important}}`}</style>
      <Reveal className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([ic, a, b], i) => (
          <div key={a} className="relative flex items-center gap-3 overflow-hidden rounded-3xl border border-g-line bg-g-creamd/70 px-4 py-3.5 backdrop-blur" style={{ animation: `tsfloat ${6 + i}s ease-in-out ${i * 0.7}s infinite` }}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.05] text-[18px] ring-1 ring-white/10" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)" }}>{ic}</span>
            <div className="leading-tight">
              <div className="text-[13.5px] font-black text-g-word">{a}</div>
              <div className="text-[11px] text-g-muted">{b}</div>
            </div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
