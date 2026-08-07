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

export default function TrustStrip() {
  const { lang } = useLang();
  const items = COPY[lang] || COPY.en;
  return (
    <section className="relative border-y border-white/[0.06] px-5 py-6">
      <Reveal className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-4">
        {items.map(([ic, a, b]) => (
          <div key={a} className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.04] text-[16px] ring-1 ring-white/10">{ic}</span>
            <div className="leading-tight">
              <div className="text-[12.5px] font-black text-g-word">{a}</div>
              <div className="text-[10.5px] text-g-muted">{b}</div>
            </div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
