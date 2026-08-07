import { useState, useEffect, useRef } from "react";
import { waLink } from "../data/contact.js";
import logo from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";

// ─────────────────────────────────────────────────────────────────────────────
// /partners — the Growth Partner RECRUITING page. Method: dor → solução → ganho.
// The opportunity: sell AI that answers/books/sells 24/7 in 16 languages to local
// businesses. THE differentiator: a PERMANENT PORTFOLIO — every client you sign is
// yours, and you earn recurring commission every month for as long as they pay.
// HONESTY: we never state a fixed % here — the rate is agreed at entry. CTA = enter
// the seller hub /vendedor with the public code GUILEO-TIME-2026 + Luis on WhatsApp.
// Landing-scoped Faena aesthetic, sober motion. PT/EN/ES, HI → EN fallback.
// ─────────────────────────────────────────────────────────────────────────────

const CODE = "GUILEO-TIME-2026";
const LANGS = [["en", "🇺🇸"], ["pt", "🇧🇷"], ["es", "🇪🇸"], ["hi", "🇮🇳"]];
const LANG_NAMES = { en: "English", pt: "Português", es: "Español", hi: "हिन्दी" };

const C = {
  pt: {
    docTitle: "Guileo · Programa Growth Partner — carteira permanente",
    seoTitle: "Programa Growth Partner Guileo — carteira permanente de comissão recorrente",
    seoDesc: "Venda IA que atende, agenda e vende 24/7 em 16 idiomas para negócios locais. Cada cliente vira sua carteira permanente: comissão recorrente todo mês enquanto ele pagar. Ferramentas prontas e hub do vendedor.",
    kicker: "Programa Growth Partner",
    h1a: "A venda acaba. ",
    h1b: "A carteira fica.",
    sub: "Venda uma IA que atende, agenda e vende 24/7 em mais de 20 idiomas para negócios locais. Cada cliente que você assina vira ",
    subStrong: "sua carteira permanente — comissão recorrente todo mês enquanto ele pagar.",
    // DOR
    painEyebrow: "A dor de quem vende",
    painH: "Você já sentiu isso.",
    pains: [
      ["💸", "A comissão morre na assinatura", "Você fecha, recebe uma vez… e no mês seguinte começa do zero. O cliente continua pagando — pra outra pessoa."],
      ["🧰", "Você vende o que não consegue entregar", "Prometeu, fechou, e agora virou suporte técnico. O produto trava, o cliente reclama com você."],
      ["📉", "Sem carteira, sem renda que se repete", "Todo mês recomeça na estaca zero. Nunca sobra uma base sua — só a próxima corrida atrás de lead."],
    ],
    // SOLUÇÃO
    solEyebrow: "A solução",
    solH: "Um produto que o mercado inteiro precisa — e que a gente entrega por você.",
    solP: "Todo negócio local perde ligação, lead e venda por não responder a tempo. Você oferece a Guileo: uma IA que atende, agenda e vende 24/7 em 16 idiomas. ",
    solStrong: "Você traz o cliente — nosso time entrega em 7 dias.",
    solChips: ["🎙️ Atende ligações", "💬 WhatsApp & SMS", "📅 Agenda & confirma", "💰 Fecha vendas", "🌐 16 idiomas", "🛠️ No ar em 7 dias"],
    demoH: "A demo vende sozinha",
    demoP: "Você não precisa convencer ninguém: a própria Gui liga pro celular do dono na hora, atende como se fosse o negócio dele e agenda. Quem ouve, entende.",
    // GANHO — o diferencial
    gainEyebrow: "O diferencial",
    gainH: "Carteira permanente.",
    gainP: "Cliente que você assina é ",
    gainStrong: "SEU — pra sempre.",
    gainP2: " Enquanto ele pagar a Guileo, você ganha comissão recorrente todo mês. A carteira não zera: ela empilha.",
    stackTitle: "Sua carteira empilha, mês a mês",
    stackNote: "Cada bloco é um cliente ativo pagando. Um novo cliente não substitui o anterior — soma. Ilustração do conceito.",
    stackMonths: ["Mês 1", "Mês 2", "Mês 3", "Mês 6"],
    honestH: "Comissão — o que prometemos (e o que não)",
    honestClaim: "Comissão recorrente sobre TODA a sua carteira, todo mês, enquanto o cliente estiver pagando. Comissão de 10% a 20% — seu nível sobe com seus resultados, do Agendador ao Closer.",
    honestNet: "Extrato transparente no hub: valores líquidos de reembolso (refund-net) e cada repasse visível, item por item.",
    // FERRAMENTAS
    toolsEyebrow: "Suas ferramentas",
    toolsH: "Você não entra sozinho.",
    tools: [
      ["🤖", "Pitch com IA", "Argumento pronto pra cada tipo de negócio, gerado na hora."],
      ["🎭", "Treino de roleplay", "Pratique a venda contra a própria Gui até passar."],
      ["🧾", "Gerador de orçamento", "Proposta personalizada em segundos, com seu link."],
      ["📄", "Contrato EN/ES/PT", "Documento pronto nos três idiomas."],
      ["📊", "CRM pessoal", "Sua carteira, seus leads e seus repasses num painel só."],
      ["🏆", "Ranking", "Acompanhe sua posição e suba de nível."],
    ],
    // CTA
    joinEyebrow: "Entrar",
    joinH: "Pronto pra construir sua carteira?",
    joinP: "Entre no hub do vendedor com o código abaixo, faça o Academy e comece a fechar. Sem taxa pra entrar.",
    codeLabel: "Código de entrada",
    copy: "Copiar",
    copied: "Copiado ✓",
    ctaHub: "🚀 Entrar no hub do vendedor",
    ctaWa: "💬 Falar com o Luis",
    wa: "Oi Luis! Quero entrar no Programa Growth Partner e construir minha carteira.",
    footNote: "Sem taxa, sem mensalidade. Você investe seu tempo; a Guileo investe o produto, a entrega e o treino.",
  },
  en: {
    docTitle: "Guileo · Growth Partner Program — permanent portfolio",
    seoTitle: "Guileo Growth Partner Program — a permanent portfolio of recurring commission",
    seoDesc: "Sell AI that answers, books and sells 24/7 in 16 languages to local businesses. Every client you sign becomes your permanent portfolio: recurring commission every month for as long as they pay. Ready-made tools and a seller hub.",
    kicker: "Growth Partner Program",
    h1a: "The sale ends. ",
    h1b: "The portfolio stays.",
    sub: "Sell an AI that answers, books and sells 24/7 in 16 languages for local businesses. Every client you sign becomes ",
    subStrong: "your permanent portfolio — recurring commission every month for as long as they pay.",
    painEyebrow: "The seller's pain",
    painH: "You've felt this.",
    pains: [
      ["💸", "The commission dies at signup", "You close, get paid once… and next month you're back at zero. The client keeps paying — someone else."],
      ["🧰", "You sell what you can't deliver", "You promised, you closed, and now you're tech support. The product breaks, the client complains to you."],
      ["📉", "No portfolio, no repeat income", "Every month restarts from scratch. You never build a base of your own — just the next chase for a lead."],
    ],
    solEyebrow: "The solution",
    solH: "A product the whole market needs — and that we deliver for you.",
    solP: "Every local business loses calls, leads and sales by failing to respond in time. You offer Guileo: an AI that answers, books and sells 24/7 in 16 languages. ",
    solStrong: "You bring the client — our team delivers in 7 days.",
    solChips: ["🎙️ Answers calls", "💬 WhatsApp & SMS", "📅 Books & confirms", "💰 Closes sales", "🌐 16 languages", "🛠️ Live in 7 days"],
    demoH: "The demo sells itself",
    demoP: "You don't have to convince anyone: Gui herself calls the owner's phone live, answers as if she were their business, and books. Whoever hears it, gets it.",
    gainEyebrow: "The differentiator",
    gainH: "A permanent portfolio.",
    gainP: "A client you sign is ",
    gainStrong: "YOURS — forever.",
    gainP2: " For as long as they pay Guileo, you earn recurring commission every month. The portfolio never resets: it stacks.",
    stackTitle: "Your portfolio stacks, month after month",
    stackNote: "Each block is an active paying client. A new client doesn't replace the last one — it adds. Concept illustration.",
    stackMonths: ["Month 1", "Month 2", "Month 3", "Month 6"],
    honestH: "Commission — what we promise (and what we don't)",
    honestClaim: "Recurring commission on your ENTIRE portfolio, every month, for as long as the client keeps paying. 10% to 20% commission — your tier climbs with your results, from Setter to Closer.",
    honestNet: "Transparent statement in the hub: refund-net amounts and every payout visible, line by line.",
    toolsEyebrow: "Your tools",
    toolsH: "You're not going in alone.",
    tools: [
      ["🤖", "AI pitch", "Ready arguments for every business type, generated on the spot."],
      ["🎭", "Roleplay training", "Practice the sale against Gui herself until you pass."],
      ["🧾", "Quote generator", "Personalized proposal in seconds, with your link."],
      ["📄", "Contract EN/ES/PT", "Ready document in all three languages."],
      ["📊", "Personal CRM", "Your portfolio, your leads and your payouts in one panel."],
      ["🏆", "Leaderboard", "Track your rank and level up."],
    ],
    joinEyebrow: "Join",
    joinH: "Ready to build your portfolio?",
    joinP: "Enter the seller hub with the code below, take the Academy and start closing. No fee to join.",
    codeLabel: "Entry code",
    copy: "Copy",
    copied: "Copied ✓",
    ctaHub: "🚀 Enter the seller hub",
    ctaWa: "💬 Talk to Luis",
    wa: "Hi Luis! I want to join the Growth Partner Program and build my portfolio.",
    footNote: "No fee, no monthly. You invest your time; Guileo invests the product, delivery and training.",
  },
  es: {
    docTitle: "Guileo · Programa Growth Partner — cartera permanente",
    seoTitle: "Programa Growth Partner Guileo — una cartera permanente de comisión recurrente",
    seoDesc: "Vende IA que atiende, agenda y vende 24/7 en más de 20 idiomas para negocios locales. Cada cliente que firmas se convierte en tu cartera permanente: comisión recurrente cada mes mientras pague. Herramientas listas y hub del vendedor.",
    kicker: "Programa Growth Partner",
    h1a: "La venta termina. ",
    h1b: "La cartera queda.",
    sub: "Vende una IA que atiende, agenda y vende 24/7 en más de 20 idiomas para negocios locales. Cada cliente que firmas se convierte en ",
    subStrong: "tu cartera permanente — comisión recurrente cada mes mientras pague.",
    painEyebrow: "El dolor de quien vende",
    painH: "Ya lo sentiste.",
    pains: [
      ["💸", "La comisión muere al firmar", "Cierras, cobras una vez… y al mes siguiente vuelves a cero. El cliente sigue pagando — a otra persona."],
      ["🧰", "Vendes lo que no puedes entregar", "Prometiste, cerraste, y ahora eres soporte técnico. El producto falla, el cliente se queja contigo."],
      ["📉", "Sin cartera, sin ingreso que se repite", "Cada mes reinicia de cero. Nunca construyes una base tuya — solo la próxima corrida por un lead."],
    ],
    solEyebrow: "La solución",
    solH: "Un producto que todo el mercado necesita — y que entregamos por ti.",
    solP: "Todo negocio local pierde llamadas, leads y ventas por no responder a tiempo. Tú ofreces Guileo: una IA que atiende, agenda y vende 24/7 en 16 idiomas. ",
    solStrong: "Tú traes al cliente — nuestro equipo entrega en 7 días.",
    solChips: ["🎙️ Atiende llamadas", "💬 WhatsApp & SMS", "📅 Agenda & confirma", "💰 Cierra ventas", "🌐 16 idiomas", "🛠️ En vivo en 7 días"],
    demoH: "La demo se vende sola",
    demoP: "No tienes que convencer a nadie: la propia Gui llama al celular del dueño en vivo, atiende como si fuera su negocio y agenda. Quien la oye, lo entiende.",
    gainEyebrow: "El diferencial",
    gainH: "Cartera permanente.",
    gainP: "Un cliente que firmas es ",
    gainStrong: "TUYO — para siempre.",
    gainP2: " Mientras pague a Guileo, ganas comisión recurrente cada mes. La cartera no se reinicia: se acumula.",
    stackTitle: "Tu cartera se acumula, mes a mes",
    stackNote: "Cada bloque es un cliente activo pagando. Un cliente nuevo no reemplaza al anterior — suma. Ilustración del concepto.",
    stackMonths: ["Mes 1", "Mes 2", "Mes 3", "Mes 6"],
    honestH: "Comisión — lo que prometemos (y lo que no)",
    honestClaim: "Comisión recurrente sobre TODA tu cartera, cada mes, mientras el cliente siga pagando. Comisión del 10% al 20% — tu nivel sube con tus resultados, de Agendador a Closer.",
    honestNet: "Extracto transparente en el hub: montos netos de reembolso (refund-net) y cada pago visible, línea por línea.",
    toolsEyebrow: "Tus herramientas",
    toolsH: "No entras solo.",
    tools: [
      ["🤖", "Pitch con IA", "Argumentos listos para cada tipo de negocio, generados al instante."],
      ["🎭", "Entrenamiento de roleplay", "Practica la venta contra la propia Gui hasta aprobar."],
      ["🧾", "Generador de presupuesto", "Propuesta personalizada en segundos, con tu link."],
      ["📄", "Contrato EN/ES/PT", "Documento listo en los tres idiomas."],
      ["📊", "CRM personal", "Tu cartera, tus leads y tus pagos en un solo panel."],
      ["🏆", "Ranking", "Sigue tu posición y sube de nivel."],
    ],
    joinEyebrow: "Entrar",
    joinH: "¿Listo para construir tu cartera?",
    joinP: "Entra al hub del vendedor con el código de abajo, haz el Academy y empieza a cerrar. Sin cuota de entrada.",
    codeLabel: "Código de entrada",
    copy: "Copiar",
    copied: "Copiado ✓",
    ctaHub: "🚀 Entrar al hub del vendedor",
    ctaWa: "💬 Hablar con Luis",
    wa: "¡Hola Luis! Quiero entrar al Programa Growth Partner y construir mi cartera.",
    footNote: "Sin cuota, sin mensualidad. Tú inviertes tu tiempo; Guileo invierte el producto, la entrega y el entrenamiento.",
  },
};

// Sober scroll-reveal: fade-up once, respects reduced-motion via the CSS guard.
function Reveal({ children, delay = 0, className = "" }) {
  const [on, setOn] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect(); } }, { threshold: 0.18 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(16px)", transition: `opacity .7s ease ${delay}s, transform .7s ease ${delay}s` }}>
      {children}
    </div>
  );
}

const Eyebrow = ({ children }) => (
  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-g-gold">{children}</div>
);

export default function Partners() {
  const { lang, setLang } = useLang();
  const c = C[lang] || C.en;
  const [copied, setCopied] = useState(false);

  useSeo({ title: c.seoTitle, description: c.seoDesc, path: "/partners" });
  useEffect(() => { document.title = c.docTitle; }, [c]);

  const copyCode = () => {
    try { navigator.clipboard?.writeText(CODE); } catch { /* clipboard optional */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="surface-real min-h-screen text-g-ink">
      <style>{`@keyframes pshine{to{background-position:220% center}}
        @media (prefers-reduced-motion: reduce){*{transition-duration:.001ms !important;animation-duration:.001ms !important}}`}</style>

      {/* header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-g-deep/60 px-5 py-3.5 backdrop-blur-md sm:px-8">
        <a href="/" className="flex items-center gap-2 opacity-85 transition hover:opacity-100"><img src={logo} alt="Guileo" className="h-7 w-7 object-contain" /><span className="text-sm font-extrabold text-g-word">Guileo</span></a>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.05] px-1 py-0.5">
            {LANGS.map(([code, flag]) => (
              <button key={code} onClick={() => setLang(code)} title={LANG_NAMES[code]} aria-label={LANG_NAMES[code]} aria-pressed={lang === code}
                className={`grid h-7 w-7 place-items-center rounded-full text-[13px] transition ${lang === code ? "scale-110 bg-g-green/15 ring-1 ring-g-green/30" : "opacity-60 hover:opacity-100"}`}>{flag}</button>
            ))}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden px-5 pb-16 pt-16 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_500px_at_50%_0%,rgba(214,194,154,0.12),transparent)]" />
        <div className="mx-auto max-w-2xl text-center">
          <Reveal><div className="mb-3 text-[12px] font-bold uppercase tracking-[0.24em] text-g-gold">{c.kicker}</div></Reveal>
          <Reveal delay={0.06}>
            <h1 className="font-black leading-[1.02] tracking-tight text-g-word" style={{ fontSize: "clamp(2.1rem,6vw,3.6rem)" }}>
              {c.h1a}<span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "pshine 7s linear infinite" }}>{c.h1b}</span>
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-g-ink sm:text-[16px]">
              {c.sub}<span className="font-bold text-g-word">{c.subStrong}</span>
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="/vendedor" className="btn-gold text-base">{c.ctaHub}</a>
              <a href={waLink(c.wa)} target="_blank" rel="noopener" className="btn text-base">{c.ctaWa}</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* DOR */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal><Eyebrow>{c.painEyebrow}</Eyebrow></Reveal>
          <Reveal delay={0.05}><h2 className="font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.6rem,3.6vw,2.6rem)" }}>{c.painH}</h2></Reveal>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {c.pains.map(([ic, t, d], i) => (
              <Reveal key={t} delay={0.08 + i * 0.08}>
                <div className="h-full rounded-2xl border border-g-line bg-white/[0.03] p-6 text-left">
                  <div className="text-2xl">{ic}</div>
                  <div className="mt-3 text-[15px] font-black text-g-word">{t}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-g-muted">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal><Eyebrow>{c.solEyebrow}</Eyebrow></Reveal>
          <Reveal delay={0.05}><h2 className="font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.6rem,3.6vw,2.6rem)" }}>{c.solH}</h2></Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink">{c.solP}<span className="font-semibold text-g-word">{c.solStrong}</span></p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="mt-7 flex flex-wrap justify-center gap-1.5">
              {c.solChips.map((chip) => (
                <span key={chip} className="rounded-full border border-g-line bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-g-ink">{chip}</span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.18}>
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-g-green/25 bg-g-green/[0.06] p-6">
              <div className="text-[15px] font-black text-g-word">{c.demoH}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-g-ink">{c.demoP}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* GANHO — o diferencial: carteira permanente */}
      <section className="relative overflow-hidden px-5 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_40%,rgba(62,148,104,0.12),transparent)]" />
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <Reveal><Eyebrow>{c.gainEyebrow}</Eyebrow></Reveal>
            <Reveal delay={0.05}>
              <h2 className="font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.9rem,4.2vw,3rem)" }}>
                <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{c.gainH}</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink">
                {c.gainP}<span className="font-black text-g-word">{c.gainStrong}</span>{c.gainP2}
              </p>
            </Reveal>
          </div>

          {/* stacking portfolio visual — concept only, no invented numbers */}
          <Reveal delay={0.14}>
            <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-g-line bg-white/[0.03] p-6">
              <div className="text-center text-[13px] font-black text-g-word">{c.stackTitle}</div>
              <div className="mt-6 grid grid-cols-4 items-end gap-3" style={{ height: 168 }}>
                {[2, 4, 6, 11].map((blocks, col) => (
                  <div key={col} className="flex h-full flex-col items-center justify-end gap-1.5">
                    <div className="flex w-full flex-col-reverse gap-1.5">
                      {Array.from({ length: blocks }).map((_, b) => (
                        <div key={b} className="w-full rounded-[4px] bg-gradient-to-r from-g-green/70 to-g-gold/60" style={{ height: 10 }} />
                      ))}
                    </div>
                    <div className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{c.stackMonths[col]}</div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-center text-[11.5px] leading-relaxed text-g-muted">{c.stackNote}</p>
            </div>
          </Reveal>

          {/* honest commission claim */}
          <Reveal delay={0.18}>
            <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-g-gold/30 bg-g-gold/[0.07] p-6">
              <div className="text-[13px] font-black uppercase tracking-wide text-g-gold">{c.honestH}</div>
              <p className="mt-3 text-[14px] font-semibold leading-relaxed text-g-word">{c.honestClaim}</p>
              <p className="mt-3 text-[12.5px] leading-relaxed text-g-muted">{c.honestNet}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FERRAMENTAS */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal><Eyebrow>{c.toolsEyebrow}</Eyebrow></Reveal>
          <Reveal delay={0.05}><h2 className="font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.6rem,3.6vw,2.6rem)" }}>{c.toolsH}</h2></Reveal>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {c.tools.map(([ic, t, d], i) => (
              <Reveal key={t} delay={0.06 + i * 0.06}>
                <div className="h-full rounded-2xl border border-g-line bg-white/[0.03] p-5 text-left">
                  <div className="text-xl">{ic}</div>
                  <div className="mt-2.5 text-[14px] font-black text-g-word">{t}</div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-muted">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / JOIN */}
      <section className="relative overflow-hidden px-5 py-20">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_50%,rgba(214,194,154,0.12),transparent)]" />
        <div className="mx-auto max-w-xl text-center">
          <Reveal><img src={logo} alt="" className="mx-auto mb-6 h-14 w-14 object-contain" /></Reveal>
          <Reveal delay={0.05}><Eyebrow>{c.joinEyebrow}</Eyebrow></Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.8rem,4.2vw,2.8rem)" }}>{c.joinH}</h2>
          </Reveal>
          <Reveal delay={0.12}><p className="mx-auto mt-4 max-w-md text-[14.5px] leading-relaxed text-g-ink">{c.joinP}</p></Reveal>

          <Reveal delay={0.16}>
            <div className="mx-auto mt-7 max-w-sm rounded-2xl border border-g-line bg-white/[0.04] p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-g-muted">{c.codeLabel}</div>
              <button onClick={copyCode} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-g-gold/30 bg-g-gold/[0.08] px-4 py-3 text-[16px] font-black tracking-wide text-g-gold transition hover:bg-g-gold/[0.14]">
                {CODE} <span className="text-[12px]">{copied ? c.copied : "📋"}</span>
              </button>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="/vendedor" className="btn-gold text-base">{c.ctaHub}</a>
              <a href={waLink(c.wa)} target="_blank" rel="noopener" className="btn text-base">{c.ctaWa}</a>
            </div>
          </Reveal>
          <Reveal delay={0.24}><p className="mx-auto mt-6 max-w-md text-[11.5px] leading-relaxed text-g-muted">{c.footNote}</p></Reveal>
        </div>
      </section>
    </div>
  );
}
