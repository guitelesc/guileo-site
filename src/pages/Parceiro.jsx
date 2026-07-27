import { useState, useEffect, useMemo, useRef } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// /parceiro — the Growth Partner RECRUITING deck. Scroll-snap engine (same as
// /pitch). Method: dor → solução → ganho. THE differentiator: a PERMANENT
// PORTFOLIO — every client you sign is yours, recurring commission every month
// for as long as they pay. HONESTY: we never state a fixed % here — the rate is
// agreed at entry. CTA = enter the seller hub /vendedor with the public code
// GUILEO-TIME-2026 + Luis on WhatsApp. PT/EN/ES, HI → EN fallback.
// ─────────────────────────────────────────────────────────────────────────────

const CODE = "GUILEO-TIME-2026";
const LANGS = [["en", "🇺🇸"], ["pt", "🇧🇷"], ["es", "🇪🇸"], ["hi", "🇮🇳"]];
const LANG_NAMES = { en: "English", pt: "Português", es: "Español", hi: "हिन्दी" };

const C = {
  pt: {
    docTitle: "Guileo · Seja um Growth Partner — carteira permanente",
    labels: ["Abertura", "A dor", "O que você vende", "Carteira permanente", "Suas ferramentas", "Por que agora", "Entrar"],
    next: "Próximo",
    coverKicker: "Programa Growth Partner",
    coverH1a: "A venda acaba. ", coverH1b: "A carteira fica.",
    coverSubA: "Venda uma IA que atende, agenda e vende 24/7 em 20+ idiomas para negócios locais. Cada cliente que você assina vira ",
    coverSubB: "sua carteira permanente — comissão todo mês enquanto ele pagar.",
    painEyebrow: "A dor de quem vende",
    painH2: "Você já sentiu isso.",
    pains: [
      ["💸", "A comissão morre na assinatura", "Você fecha, recebe uma vez e recomeça do zero. O cliente segue pagando — pra outra pessoa."],
      ["🧰", "Você vende o que não entrega", "Prometeu, fechou, e virou suporte técnico. O produto trava, o cliente reclama com você."],
      ["📉", "Sem carteira, sem renda que repete", "Todo mês na estaca zero. Nunca sobra uma base sua — só a próxima corrida atrás de lead."],
    ],
    solEyebrow: "O que você vende",
    solH2a: "Um produto que o mercado inteiro precisa. ", solH2b: "A gente entrega por você.",
    solP: "Todo negócio local perde ligação, lead e venda por não responder a tempo. Você oferece a Guileo — e nosso time entrega em 7 dias. ",
    solPb: "Você traz o cliente, a gente faz acontecer.",
    solChips: ["🎙️ Atende ligações", "💬 WhatsApp & SMS", "📅 Agenda & confirma", "💰 Fecha vendas", "🌐 20+ idiomas", "🛠️ No ar em 7 dias", "🔄 Automações", "📊 CRM"],
    demoNote: "E a demo vende sozinha: a própria Gui liga pro celular do dono e atende como se fosse o negócio dele.",
    gainEyebrow: "O diferencial",
    gainH2: "Carteira permanente.",
    gainP: "Cliente que você assina é SEU — pra sempre. Enquanto ele pagar a Guileo, você ganha comissão recorrente todo mês. A carteira não zera: ela empilha.",
    stackTitle: "Sua carteira empilha, mês a mês",
    stackMonths: ["Mês 1", "Mês 2", "Mês 3", "Mês 6"],
    honestClaim: "Comissão recorrente sobre TODA a sua carteira, todo mês, enquanto o cliente pagar. Comissão de 10% a 20% — seu nível sobe com seus resultados, do Agendador ao Closer.",
    honestNet: "Extrato transparente no hub: líquido de reembolso (refund-net) e cada repasse visível, item por item.",
    toolsEyebrow: "Suas ferramentas",
    toolsH2: "Você não entra sozinho.",
    tools: [
      ["🤖", "Pitch com IA", "Argumento pronto pra cada negócio"],
      ["🎭", "Treino de roleplay", "Pratique contra a própria Gui"],
      ["🧾", "Gerador de orçamento", "Proposta em segundos, com seu link"],
      ["📄", "Contrato EN/ES/PT", "Documento pronto nos 3 idiomas"],
      ["📊", "CRM pessoal", "Sua carteira, leads e repasses num painel"],
      ["🏆", "Ranking", "Acompanhe sua posição e suba de nível"],
    ],
    whyEyebrow: "Por que agora",
    whyH2: "A onda da IA está começando. Você entra na frente.",
    whyCards: [
      ["🌊", "Mercado quente", "Todo negócio quer IA, poucos sabem entregar."],
      ["🛠️", "Produto pronto", "Você vende algo que já funciona e entrega em 7 dias."],
      ["📈", "Renda que fica", "Cada venda vira carteira — receita que se repete todo mês."],
    ],
    joinH2a: "Pronto pra ", joinH2b: "construir sua carteira?",
    joinP: "Entre no hub do vendedor com o código, faça o Academy e comece a fechar. Sem taxa pra entrar.",
    codeLabel: "Código de entrada",
    copy: "📋", copied: "✓",
    joinCta1: "🚀 Entrar no hub do vendedor", joinCta2: "💬 Falar com o Luis", joinCta3: "🎓 Fazer o Academy",
    joinWa: "Oi Luis! Quero entrar no Programa Growth Partner e construir minha carteira.",
  },
  en: {
    docTitle: "Guileo · Become a Growth Partner — permanent portfolio",
    labels: ["Opening", "The pain", "What you sell", "Permanent portfolio", "Your tools", "Why now", "Join"],
    next: "Next",
    coverKicker: "Growth Partner Program",
    coverH1a: "The sale ends. ", coverH1b: "The portfolio stays.",
    coverSubA: "Sell an AI that answers, books and sells 24/7 in 20+ languages for local businesses. Every client you sign becomes ",
    coverSubB: "your permanent portfolio — commission every month for as long as they pay.",
    painEyebrow: "The seller's pain",
    painH2: "You've felt this.",
    pains: [
      ["💸", "The commission dies at signup", "You close, get paid once, and restart from zero. The client keeps paying — someone else."],
      ["🧰", "You sell what you can't deliver", "You promised, you closed, and became tech support. The product breaks, the client complains to you."],
      ["📉", "No portfolio, no repeat income", "Every month back to zero. You never build a base of your own — just the next chase for a lead."],
    ],
    solEyebrow: "What you sell",
    solH2a: "A product the whole market needs. ", solH2b: "We deliver it for you.",
    solP: "Every local business loses calls, leads and sales by failing to respond in time. You offer Guileo — and our team delivers in 7 days. ",
    solPb: "You bring the client, we make it happen.",
    solChips: ["🎙️ Answers calls", "💬 WhatsApp & SMS", "📅 Books & confirms", "💰 Closes sales", "🌐 20+ languages", "🛠️ Live in 7 days", "🔄 Automations", "📊 CRM"],
    demoNote: "And the demo sells itself: Gui herself calls the owner's phone and answers as if she were their business.",
    gainEyebrow: "The differentiator",
    gainH2: "A permanent portfolio.",
    gainP: "A client you sign is YOURS — forever. For as long as they pay Guileo, you earn recurring commission every month. The portfolio never resets: it stacks.",
    stackTitle: "Your portfolio stacks, month after month",
    stackMonths: ["Month 1", "Month 2", "Month 3", "Month 6"],
    honestClaim: "Recurring commission on your ENTIRE portfolio, every month, for as long as the client keeps paying. 10% to 20% commission — your tier climbs with your results, from Setter to Closer.",
    honestNet: "Transparent statement in the hub: refund-net amounts and every payout visible, line by line.",
    toolsEyebrow: "Your tools",
    toolsH2: "You're not going in alone.",
    tools: [
      ["🤖", "AI pitch", "Ready arguments for every business"],
      ["🎭", "Roleplay training", "Practice against Gui herself"],
      ["🧾", "Quote generator", "Proposal in seconds, with your link"],
      ["📄", "Contract EN/ES/PT", "Ready document in all 3 languages"],
      ["📊", "Personal CRM", "Your portfolio, leads and payouts in one panel"],
      ["🏆", "Leaderboard", "Track your rank and level up"],
    ],
    whyEyebrow: "Why now",
    whyH2: "The AI wave is just starting. You get in early.",
    whyCards: [
      ["🌊", "Hot market", "Every business wants AI, few know how to deliver."],
      ["🛠️", "Ready product", "You sell something that already works and ships in 7 days."],
      ["📈", "Income that stays", "Every sale becomes portfolio — revenue that repeats every month."],
    ],
    joinH2a: "Ready to ", joinH2b: "build your portfolio?",
    joinP: "Enter the seller hub with the code, take the Academy and start closing. No fee to join.",
    codeLabel: "Entry code",
    copy: "📋", copied: "✓",
    joinCta1: "🚀 Enter the seller hub", joinCta2: "💬 Talk to Luis", joinCta3: "🎓 Take the Academy",
    joinWa: "Hi Luis! I want to join the Growth Partner Program and build my portfolio.",
  },
  es: {
    docTitle: "Guileo · Sé un Growth Partner — cartera permanente",
    labels: ["Apertura", "El dolor", "Qué vendes", "Cartera permanente", "Tus herramientas", "Por qué ahora", "Entrar"],
    next: "Siguiente",
    coverKicker: "Programa Growth Partner",
    coverH1a: "La venta termina. ", coverH1b: "La cartera queda.",
    coverSubA: "Vende una IA que atiende, agenda y vende 24/7 en 20+ idiomas para negocios locales. Cada cliente que firmas se convierte en ",
    coverSubB: "tu cartera permanente — comisión cada mes mientras pague.",
    painEyebrow: "El dolor de quien vende",
    painH2: "Ya lo sentiste.",
    pains: [
      ["💸", "La comisión muere al firmar", "Cierras, cobras una vez y reinicias de cero. El cliente sigue pagando — a otra persona."],
      ["🧰", "Vendes lo que no entregas", "Prometiste, cerraste, y te volviste soporte técnico. El producto falla, el cliente se queja contigo."],
      ["📉", "Sin cartera, sin ingreso que repite", "Cada mes a cero. Nunca construyes una base tuya — solo la próxima corrida por un lead."],
    ],
    solEyebrow: "Qué vendes",
    solH2a: "Un producto que todo el mercado necesita. ", solH2b: "Lo entregamos por ti.",
    solP: "Todo negocio local pierde llamadas, leads y ventas por no responder a tiempo. Tú ofreces Guileo — y nuestro equipo entrega en 7 días. ",
    solPb: "Tú traes al cliente, nosotros lo hacemos realidad.",
    solChips: ["🎙️ Atiende llamadas", "💬 WhatsApp & SMS", "📅 Agenda & confirma", "💰 Cierra ventas", "🌐 20+ idiomas", "🛠️ En vivo en 7 días", "🔄 Automatizaciones", "📊 CRM"],
    demoNote: "Y la demo se vende sola: la propia Gui llama al celular del dueño y atiende como si fuera su negocio.",
    gainEyebrow: "El diferencial",
    gainH2: "Cartera permanente.",
    gainP: "Un cliente que firmas es TUYO — para siempre. Mientras pague a Guileo, ganas comisión recurrente cada mes. La cartera no se reinicia: se acumula.",
    stackTitle: "Tu cartera se acumula, mes a mes",
    stackMonths: ["Mes 1", "Mes 2", "Mes 3", "Mes 6"],
    honestClaim: "Comisión recurrente sobre TODA tu cartera, cada mes, mientras el cliente pague. Comisión del 10% al 20% — tu nivel sube con tus resultados, de Agendador a Closer.",
    honestNet: "Extracto transparente en el hub: neto de reembolso (refund-net) y cada pago visible, línea por línea.",
    toolsEyebrow: "Tus herramientas",
    toolsH2: "No entras solo.",
    tools: [
      ["🤖", "Pitch con IA", "Argumentos listos para cada negocio"],
      ["🎭", "Entrenamiento de roleplay", "Practica contra la propia Gui"],
      ["🧾", "Generador de presupuesto", "Propuesta en segundos, con tu link"],
      ["📄", "Contrato EN/ES/PT", "Documento listo en los 3 idiomas"],
      ["📊", "CRM personal", "Tu cartera, leads y pagos en un panel"],
      ["🏆", "Ranking", "Sigue tu posición y sube de nivel"],
    ],
    whyEyebrow: "Por qué ahora",
    whyH2: "La ola de la IA está empezando. Tú entras primero.",
    whyCards: [
      ["🌊", "Mercado caliente", "Todo negocio quiere IA, pocos saben entregarla."],
      ["🛠️", "Producto listo", "Vendes algo que ya funciona y se entrega en 7 días."],
      ["📈", "Ingreso que queda", "Cada venta se vuelve cartera — ingreso que se repite cada mes."],
    ],
    joinH2a: "¿Listo para ", joinH2b: "construir tu cartera?",
    joinP: "Entra al hub del vendedor con el código, haz el Academy y empieza a cerrar. Sin cuota de entrada.",
    codeLabel: "Código de entrada",
    copy: "📋", copied: "✓",
    joinCta1: "🚀 Entrar al hub del vendedor", joinCta2: "💬 Hablar con Luis", joinCta3: "🎓 Hacer el Academy",
    joinWa: "¡Hola Luis! Quiero entrar al Programa Growth Partner y construir mi cartera.",
  },
};

// Entrance animations replay each time the slide becomes active.
function Slide({ id, children }) {
  const [on, setOn] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.55 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={ref} id={id} className="relative flex h-[100dvh] w-full shrink-0 snap-start flex-col items-center justify-center overflow-hidden px-6 py-20 sm:px-12">
      <div key={on ? 1 : 0} className="contents">{children}</div>
    </section>
  );
}

const Eyebrow = ({ children }) => (
  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-g-gold">{children}</div>
);

// Concept-only stacking bars — every block is one active paying client. No $ figures.
function PortfolioStack({ months }) {
  return (
    <div className="mt-8 w-full max-w-lg rounded-xl3 border border-g-line bg-white/[0.03] p-6 shadow-lift">
      <div className="grid grid-cols-4 items-end gap-3" style={{ height: 150 }}>
        {[2, 4, 6, 11].map((blocks, col) => (
          <div key={col} className="flex h-full flex-col items-center justify-end">
            <div className="flex w-full flex-col-reverse gap-1.5" style={{ animation: `cfade .6s ease ${0.12 * col}s both` }}>
              {Array.from({ length: blocks }).map((_, b) => (
                <div key={b} className="w-full rounded-[4px] bg-gradient-to-r from-g-green/70 to-g-gold/60" style={{ height: 9 }} />
              ))}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-g-muted">{months[col]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SLIDE_IDS = ["cover", "pain", "sell", "gain", "tools", "why", "join"];

export default function Parceiro() {
  const { lang, setLang } = useLang();
  const c = C[lang] || C.en;
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const scroller = useRef(null);
  useMemo(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""), []);

  useEffect(() => {
    const go = (dir) => { const n = Math.max(0, Math.min(SLIDE_IDS.length - 1, active + dir)); document.getElementById(SLIDE_IDS[n])?.scrollIntoView({ behavior: "smooth" }); };
    const onKey = (e) => {
      if (["ArrowDown", "ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    const obs = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) setActive(SLIDE_IDS.indexOf(en.target.id)); }), { threshold: 0.6 });
    SLIDE_IDS.forEach((id) => { const n = document.getElementById(id); if (n) obs.observe(n); });
    return () => obs.disconnect();
  }, []);
  useEffect(() => { document.title = c.docTitle; }, [c]);

  const goTo = (i) => document.getElementById(SLIDE_IDS[i])?.scrollIntoView({ behavior: "smooth" });
  const copyCode = () => {
    try { navigator.clipboard?.writeText(CODE); } catch { /* clipboard optional */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="surface-real relative h-[100dvh] overflow-hidden text-g-ink">
      <style>{`
        @keyframes cfade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cshine{to{background-position:220% center}}
        .cdeck::-webkit-scrollbar{display:none}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 sm:px-8">
        <a href="/" className="pointer-events-auto flex items-center gap-2 opacity-80 transition hover:opacity-100"><img src={logo} alt="Guileo" className="h-7 w-7 object-contain" /><span className="text-sm font-extrabold text-g-word">Guileo</span></a>
        <div className="flex items-center gap-2">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.05] px-1 py-0.5 backdrop-blur-md">
            {LANGS.map(([code, flag]) => (
              <button key={code} onClick={() => setLang(code)} title={LANG_NAMES[code]} aria-label={LANG_NAMES[code]} aria-pressed={lang === code}
                className={`grid h-7 w-7 place-items-center rounded-full text-[13px] transition ${lang === code ? "scale-110 bg-g-green/15 ring-1 ring-g-green/30" : "opacity-60 hover:opacity-100"}`}>{flag}</button>
            ))}
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-g-muted backdrop-blur-md">{String(active + 1).padStart(2, "0")} · {c.labels[active]}</div>
        </div>
      </header>
      <nav className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 sm:flex">
        {SLIDE_IDS.map((id, i) => <button key={id} onClick={() => goTo(i)} aria-label={c.labels[i]} className={`h-2.5 w-2.5 rounded-full transition-all ${i === active ? "scale-125 bg-g-gold" : "bg-white/20 hover:bg-white/40"}`} />)}
      </nav>
      <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-white/5"><div className="h-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-500" style={{ width: `${((active + 1) / SLIDE_IDS.length) * 100}%` }} /></div>

      <div ref={scroller} className="cdeck relative z-10 h-[100dvh] snap-y snap-mandatory overflow-y-scroll scroll-smooth" style={{ scrollbarWidth: "none" }}>

        {/* 1 — COVER */}
        <Slide id="cover">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_500px_at_50%_30%,rgba(214,194,154,0.12),transparent)]" />
          <img src={logo} alt="" className="mb-7 h-16 w-16 object-contain drop-shadow-[0_0_40px_rgba(214,194,154,0.4)]" style={{ animation: "cfade .8s ease both" }} />
          <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.24em] text-g-gold" style={{ animation: "cfade .8s ease .1s both" }}>{c.coverKicker}</div>
          <h1 className="mx-auto max-w-4xl text-center font-black leading-[1.05] tracking-tight text-g-word" style={{ fontSize: "clamp(1.9rem,4.4vw,3.4rem)", animation: "cfade .9s ease .2s both" }}>
            {c.coverH1a}<span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "cshine 7s linear infinite" }}>{c.coverH1b}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-center text-lg text-g-ink" style={{ animation: "cfade .9s ease .35s both" }}>
            {c.coverSubA}<span className="font-bold text-g-word">{c.coverSubB}</span>
          </p>
          <button onClick={() => goTo(1)} className="absolute bottom-10 animate-bounce text-g-muted" aria-label={c.next}>↓</button>
        </Slide>

        {/* 2 — THE PAIN */}
        <Slide id="pain">
          <Eyebrow>{c.painEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>{c.painH2}</h2>
          <div className="mt-9 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {c.pains.map(([ic, t, d], i) => (
              <div key={t} className="rounded-2xl border border-g-line bg-white/[0.03] p-6 text-left" style={{ animation: `cfade .7s ease ${0.1 + i * 0.12}s both` }}>
                <div className="text-3xl">{ic}</div><div className="mt-3 text-base font-black text-g-word">{t}</div><p className="mt-2 text-[13px] leading-relaxed text-g-muted">{d}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* 3 — WHAT YOU SELL */}
        <Slide id="sell">
          <Eyebrow>{c.solEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>{c.solH2a}<span className="text-g-green">{c.solH2b}</span></h2>
          <p className="mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-g-ink">{c.solP}<span className="font-semibold text-g-word">{c.solPb}</span></p>
          <div className="mt-7 flex max-w-3xl flex-wrap justify-center gap-1.5">
            {c.solChips.map((d) => (
              <span key={d} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-semibold text-g-ink">{d}</span>
            ))}
          </div>
          <p className="mt-6 max-w-xl text-center text-[13px] italic text-g-muted">{c.demoNote}</p>
        </Slide>

        {/* 4 — PERMANENT PORTFOLIO (the differentiator) */}
        <Slide id="gain">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_40%,rgba(62,148,104,0.12),transparent)]" />
          <Eyebrow>{c.gainEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight" style={{ fontSize: "clamp(1.8rem,4vw,3rem)" }}>
            <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{c.gainH2}</span>
          </h2>
          <p className="mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-g-ink">{c.gainP}</p>
          <div className="mt-3 text-center text-[11px] font-bold uppercase tracking-wider text-g-muted">{c.stackTitle}</div>
          <PortfolioStack months={c.stackMonths} />
          <div className="mt-6 w-full max-w-2xl rounded-2xl border border-g-gold/30 bg-g-gold/[0.07] p-5" style={{ animation: "cfade .8s ease .2s both" }}>
            <p className="text-[13.5px] font-semibold leading-relaxed text-g-word">{c.honestClaim}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-g-muted">{c.honestNet}</p>
          </div>
        </Slide>

        {/* 5 — YOUR TOOLS */}
        <Slide id="tools">
          <Eyebrow>{c.toolsEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>{c.toolsH2}</h2>
          <div className="mt-8 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
            {c.tools.map(([ic, t, d], i) => (
              <div key={t} className="rounded-2xl border border-g-line bg-white/[0.03] p-5 text-left" style={{ animation: `cfade .6s ease ${0.07 * i}s both` }}>
                <div className="text-2xl">{ic}</div><div className="mt-2 text-[14px] font-black text-g-word">{t}</div><p className="mt-1 text-[12px] text-g-muted">{d}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* 6 — WHY NOW */}
        <Slide id="why">
          <Eyebrow>{c.whyEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>{c.whyH2}</h2>
          <div className="mt-8 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
            {c.whyCards.map(([ic, t, d], i) => (
              <div key={t} className="rounded-2xl border border-g-line bg-white/[0.03] p-6 text-center" style={{ animation: `cfade .7s ease ${0.1 + i * 0.12}s both` }}>
                <div className="text-3xl">{ic}</div><div className="mt-3 text-base font-black text-g-word">{t}</div><p className="mt-2 text-[13px] leading-relaxed text-g-muted">{d}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* 7 — JOIN */}
        <Slide id="join">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_50%,rgba(214,194,154,0.12),transparent)]" />
          <img src={logo} alt="" className="mb-6 h-16 w-16 object-contain" style={{ animation: "cfade .8s ease both" }} />
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)", animation: "cfade .8s ease .1s both" }}>
            {c.joinH2a}<span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{c.joinH2b}</span>
          </h2>
          <p className="mt-5 max-w-xl text-center text-[15px] text-g-ink" style={{ animation: "cfade .8s ease .25s both" }}>{c.joinP}</p>

          <div className="mt-7 w-full max-w-xs rounded-2xl border border-g-line bg-white/[0.04] p-4 text-center" style={{ animation: "cfade .8s ease .32s both" }}>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-g-muted">{c.codeLabel}</div>
            <button onClick={copyCode} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-g-gold/30 bg-g-gold/[0.08] px-4 py-2.5 text-[15px] font-black tracking-wide text-g-gold transition hover:bg-g-gold/[0.14]">
              {CODE} <span className="text-[12px]">{copied ? c.copied : c.copy}</span>
            </button>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3" style={{ animation: "cfade .8s ease .4s both" }}>
            <a href="/vendedor" className="btn-gold text-base">{c.joinCta1}</a>
            <a href={waLink(c.joinWa)} target="_blank" rel="noopener" className="btn text-base">{c.joinCta2}</a>
            <a href="/academia" className="btn-ghost text-base">{c.joinCta3}</a>
          </div>
        </Slide>

      </div>
    </div>
  );
}
