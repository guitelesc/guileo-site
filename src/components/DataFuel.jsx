import { useLang } from "../i18n.jsx";
import { Reveal } from "../lib/ui.jsx";

/* ── DataFuel — substitui o EngineV2 (Luis, 2026-09-09) ─────────────────────────────────────────
   O que ele pediu, palavra por palavra: «every conversation or interaction becomes your marketing,
   ad, or something cool like that — they need to understand that DATA IS THE FUEL»; «curto, mais
   informativo e mais direto, mostrando resultado — não animação sem sentido»; «tirar a planta
   lógica». Saíram: a planta com os fios, o contador que subia desde que a página abriu, o radar
   com bolinhas orbitando, o botão "Get this for my business". Ficou: uma frase, três fatos com o
   número que importa, zero animação além do reveal editorial. Os números são os que a casa já
   usava (fração do custo de trazer um cliente de volta vs. comprar um novo; anúncios falando com
   quem já ligou) — sem inventar métrica nova. */

const COPY = {
  en: { eyebrow: "The Guileo engine", h2a: "Every interaction becomes ", h2b: "your marketing.", sub: "Data is the fuel. Each call, message and visit Gui handles is saved, understood and reused — so your ads, your content and your follow-ups talk to people who already know you.",
    cards: [
      { k: "01", t: "A call becomes a record", d: "Name, need, budget, timing — captured on the spot and kept in your CRM. Nothing lives in someone's head anymore.", n: "100%", u: "of contacts saved" },
      { k: "02", t: "A record becomes an audience", d: "Your ads stop chasing strangers. They talk to people who already called, asked or booked — the cheapest audience there is.", n: "5–7×", u: "cheaper than a new lead" },
      { k: "03", t: "An audience comes back", d: "Reminders, win-backs and offers go out at the right moment, in the customer's language. Trust is the cheapest ad.", n: "60s", u: "to answer, any channel" },
    ], foot: "Illustrative averages — results depend on your business." },
  pt: { eyebrow: "O motor da Guileo", h2a: "Toda interação vira ", h2b: "o seu marketing.", sub: "Dado é o combustível. Cada ligação, mensagem e visita que a Gui atende é guardada, entendida e reaproveitada — seus anúncios, seu conteúdo e seus retornos falam com quem já te conhece.",
    cards: [
      { k: "01", t: "A ligação vira cadastro", d: "Nome, necessidade, orçamento, prazo — capturados na hora e guardados no seu CRM. Nada mora mais na cabeça de alguém.", n: "100%", u: "dos contatos guardados" },
      { k: "02", t: "O cadastro vira público", d: "Seus anúncios param de caçar estranhos. Falam com quem já ligou, perguntou ou agendou — o público mais barato que existe.", n: "5–7×", u: "mais barato que lead novo" },
      { k: "03", t: "O público volta", d: "Lembretes, reativação e ofertas saem na hora certa, no idioma do cliente. Confiança é o anúncio mais barato.", n: "60s", u: "pra responder, em qualquer canal" },
    ], foot: "Médias ilustrativas — resultados variam conforme o negócio." },
  es: { eyebrow: "El motor de Guileo", h2a: "Cada interacción se vuelve ", h2b: "tu marketing.", sub: "Los datos son el combustible. Cada llamada, mensaje y visita que Gui atiende se guarda, se entiende y se reutiliza — tus anuncios, tu contenido y tus seguimientos hablan con quien ya te conoce.",
    cards: [
      { k: "01", t: "La llamada se vuelve registro", d: "Nombre, necesidad, presupuesto, plazo — capturados al momento y guardados en tu CRM. Nada vive ya en la cabeza de alguien.", n: "100%", u: "de contactos guardados" },
      { k: "02", t: "El registro se vuelve audiencia", d: "Tus anuncios dejan de perseguir extraños. Hablan con quien ya llamó, preguntó o reservó — la audiencia más barata que existe.", n: "5–7×", u: "más barato que un lead nuevo" },
      { k: "03", t: "La audiencia vuelve", d: "Recordatorios, reactivaciones y ofertas salen en el momento justo, en el idioma del cliente. La confianza es el anuncio más barato.", n: "60s", u: "para responder, en cualquier canal" },
    ], foot: "Promedios ilustrativos — los resultados dependen de tu negocio." },
  hi: { eyebrow: "Guileo इंजन", h2a: "हर इंटरैक्शन बन जाता है ", h2b: "आपकी मार्केटिंग।", sub: "डेटा ही ईंधन है। Gui जो भी कॉल, मैसेज और विज़िट संभालती है, वह सहेजी, समझी और दोबारा इस्तेमाल की जाती है — आपके विज्ञापन, कॉन्टेंट और फ़ॉलो-अप उनसे बात करते हैं जो आपको पहले से जानते हैं।",
    cards: [
      { k: "01", t: "कॉल बनती है रिकॉर्ड", d: "नाम, ज़रूरत, बजट, समय — तुरंत दर्ज और आपके CRM में सुरक्षित। कुछ भी अब किसी के दिमाग़ में नहीं रहता।", n: "100%", u: "संपर्क सहेजे गए" },
      { k: "02", t: "रिकॉर्ड बनता है ऑडियंस", d: "आपके विज्ञापन अजनबियों के पीछे भागना बंद करते हैं। वे उनसे बात करते हैं जिन्होंने पहले कॉल, सवाल या बुकिंग की — सबसे सस्ती ऑडियंस।", n: "5–7×", u: "नए लीड से सस्ता" },
      { k: "03", t: "ऑडियंस लौटती है", d: "रिमाइंडर, वापसी ऑफ़र और प्रस्ताव सही समय पर, ग्राहक की भाषा में जाते हैं। भरोसा सबसे सस्ता विज्ञापन है।", n: "60s", u: "जवाब देने में, किसी भी चैनल पर" },
    ], foot: "उदाहरणात्मक औसत — परिणाम आपके व्यवसाय पर निर्भर करते हैं।" },
};

export default function DataFuel() {
  const { lang } = useLang();
  const C = COPY[lang] || COPY.en;
  return (
    <section className="relative overflow-hidden px-5 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_0%,rgba(62,148,104,0.08),transparent)]" />
      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="text-[12px] font-black uppercase tracking-[0.24em] text-g-gold">⚙️ {C.eyebrow}</div>
        <h2 className="mt-4 font-black leading-[1.02] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,4.6vw,3.2rem)" }}>
          {C.h2a}<span className="bg-gradient-to-r from-g-green via-g-light to-g-green bg-clip-text text-transparent">{C.h2b}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15.5px] leading-relaxed text-g-ink">{C.sub}</p>
      </Reveal>
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
        {C.cards.map((c, i) => (
          <Reveal key={c.k} delay={i * 90}>
            {/* vidro real: entra na lei 4K global (aro de luz, verniz, sombra de contato + ambiente) */}
            <div className="relative h-full overflow-hidden rounded-3xl border border-g-line bg-g-creamd/70 p-6 backdrop-blur">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-g-muted">{c.k}</span>
                <span className="text-right">
                  <span className="block font-black leading-none tracking-tight text-g-gold tabular-nums" style={{ fontSize: "clamp(1.6rem,3vw,2.1rem)" }}>{c.n}</span>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-g-muted">{c.u}</span>
                </span>
              </div>
              <h3 className="mt-4 text-[17px] font-black leading-tight text-g-word">{c.t}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-g-ink">{c.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-[11.5px] italic text-g-muted">{C.foot}</p>
    </section>
  );
}
