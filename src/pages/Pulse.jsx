import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { Reveal } from "../lib/ui.jsx";
import PulseSection, { PULSE_COPY } from "../components/PulseSection.jsx";

// /pulse — a casa do GUILEO PULSE ($49/mês fixo), criada em 2026-08-11.
//
// POR QUE ELA EXISTE: horas antes eu cortei da landing os 4 cartões de benefício e a faixa dos
// "40%" do Pulse. O corte estava certo — ali embaixo, DEPOIS do preço, quem sobrou já foi
// convencido pela página inteira e o que falta é o número bater; explicar de novo só alonga.
// Mas o texto cortado não era ruim, era MAL POSICIONADO: ele responde "por que medir experiência
// importa", que é a pergunta de quem está pesquisando o assunto — exatamente quem chega aqui.
// Cortar sem dar destino ao conteúdo é jogar fora; cortar e mudar de lugar é editar.
//
// ⚠️ ZERO TEXTO COPIADO: tudo vem de `PULSE_COPY`, o MESMO dicionário que a seção da landing usa
// (exportado de PulseSection.jsx). Duplicar as 4 traduções aqui teria criado a segunda fonte que
// passei a sessão inteira eliminando — e no dia em que um número mudasse, um dos dois mentiria.
// A seção `<PulseSection />` inteira é reaproveitada no fim: preço, comparação e o formulário
// "me liga" que o Luis chamou de "super hot lead" não têm segunda versão em lugar nenhum.

const SEO = {
  en: { t: "Guileo Pulse — know how your customers really feel, for $49/mo",
        d: "Customer satisfaction measured from the calls you already get. CX score, 1–5 star ratings and surveys — every location included, no per-location bill." },
  pt: { t: "Guileo Pulse — saiba como seus clientes realmente se sentem, por US$49/mês",
        d: "Satisfação medida a partir das ligações que você já recebe. Nota de satisfação, avaliação de 1 a 5 estrelas e pesquisas — todas as unidades incluídas." },
  es: { t: "Guileo Pulse — sabe cómo se sienten tus clientes, por US$49/mes",
        d: "Satisfacción medida desde las llamadas que ya recibes. Nota de satisfacción, calificación de 1 a 5 estrellas y encuestas — todas las sucursales incluidas." },
  hi: { t: "Guileo Pulse — जानिए आपके ग्राहक वाकई कैसा महसूस करते हैं, US$49/माह",
        d: "जो कॉल पहले से आती हैं उन्हीं से संतुष्टि मापी जाती है। CX स्कोर, 1–5 स्टार रेटिंग और सर्वे — हर लोकेशन शामिल।" },
};

export default function Pulse() {
  const { lang } = useLang();
  const G = PULSE_COPY[lang] || PULSE_COPY.en;
  const s = SEO[lang] || SEO.en;
  useSeo({ title: s.t, description: s.d, canonical: "https://guileoai.com/pulse" });

  return (
    <div className="min-h-screen bg-g-bg text-g-ink">
      <Navbar />

      {/* HERÓI — aqui ele CABE: quem chega nesta página está pesquisando o assunto, não rolando
          uma landing. É o mesmo título que saiu de lá, no lugar onde ele faz o trabalho dele. */}
      <section className="relative overflow-hidden px-5 pt-16 pb-10">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(720px_380px_at_50%_0%,rgba(62,148,104,0.14),transparent)]" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-g-gold/40 bg-g-gold/10 px-4 py-1.5 text-[12px] font-black uppercase tracking-[0.24em] text-g-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-g-gold" /> {G.eyebrow}
          </div>
          <h1 className="mx-auto mt-5 max-w-2xl font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2.1rem,5vw,3.4rem)" }}>
            <span className="text-g-word">{G.h1a}</span>
            <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent">{G.h1b}</span>
            <span className="text-g-word">{G.h1c}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-g-ink">{G.sub}</p>
        </div>
      </section>

      {/* OS 4 CARTÕES — o conteúdo que saiu da landing, na página onde ele responde a pergunta certa */}
      <section className="px-5 pb-4">
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {G.benefits.map((b, i) => {
            const rgb = ["62,148,104", "214,194,154", "231,138,51", "194,168,120"][i];
            return (
              <Reveal key={b.t}>
                <div className="group relative h-full overflow-hidden rounded-2xl border bg-white/[0.04] p-6 shadow-lift backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.06]"
                  style={{ borderColor: `rgba(${rgb},0.28)` }}>
                  <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.85),transparent)` }} />
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-2xl"
                      style={{ borderColor: `rgba(${rgb},0.35)`, background: `rgba(${rgb},0.1)` }}>{b.ic}</span>
                    <div className="min-w-0">
                      <div className="text-[16px] font-extrabold leading-snug text-g-word">{b.t}</div>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-g-ink">{b.d}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* A FAIXA DOS 40% — o argumento de POR QUE isto importa. Na landing ele convencia quem já
          estava convencido; aqui ele é a razão de a pessoa continuar lendo. */}
      <section className="px-5 py-8">
        <Reveal className="mx-auto max-w-4xl overflow-hidden rounded-xl3 border border-g-gold/35 bg-gradient-to-br from-g-gold/[0.1] via-white/[0.03] to-g-green/[0.08] p-7 shadow-lift backdrop-blur-xl sm:p-9">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="bg-gradient-to-br from-g-gold to-g-copper bg-clip-text text-[64px] font-black leading-none tracking-tight text-transparent tabular-nums sm:text-[84px]">{G.statBig}</div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-relaxed text-g-word sm:text-[16.5px]">{G.statText}</p>
              <p className="mt-2 inline-flex items-center gap-2 text-[13.5px] font-bold text-g-green">
                <span className="text-lg">🔁</span> {G.statPunch}
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* A SEÇÃO INTEIRA da landing, reaproveitada: painel (termômetro · estrelas · pesquisa),
          comparação de preço e o formulário "me liga". Nenhuma segunda versão em lugar nenhum. */}
      <PulseSection />

      <Footer />
      <VoiceAgent />
    </div>
  );
}
