import { useState, useEffect, useRef } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink, bookLink } from "../data/contact.js";

// ─────────────────────────────────────────────────────────────────────────────
// /pitch — the ≤20-min CLIENT PRESENTATION the Growth Partner walks a prospect
// through. A standalone, full-screen scroll-snap deck (no marketing navbar) that
// opens with THE one sentence and ends on the close. Keyboard ↑/↓/Space/→ + dot
// nav. Built on the locked Guileo design system (cement + green-detail + champagne).
//
// Billionaire rule: one sentence says what we do. Every slide earns its ~2 minutes.
// ─────────────────────────────────────────────────────────────────────────────

const SENTENCE = "A Guileo instala um time de IA + marketing que atende, vende e faz crescer o seu negócio sozinho, 24/7 — você escolhe o resultado, a gente entrega.";

// 9 slides ≈ 2 min each = ~18 min, leaving room for the live demo + questions.
const SLIDES = [
  { id: "cover", label: "Abertura" },
  { id: "problem", label: "O problema" },
  { id: "gui", label: "Conheça a Gui" },
  { id: "pratica", label: "Na prática" },
  { id: "deliver", label: "O que entregamos" },
  { id: "proof", label: "Resultados" },
  { id: "method", label: "Como funciona" },
  { id: "pricing", label: "Investimento" },
  { id: "trust", label: "Confiança" },
  { id: "teste", label: "Teste sem risco" },
  { id: "close", label: "Começar" },
];

// "Na prática" — a real working day. Concrete, varied jobs (the site's live-feed DNA):
// inbound & outbound, every type — order, booking, quote, review, win-back, follow-up.
const DAY = [
  { h: "07:40", icon: "🔔", what: "Manda os lembretes do dia", result: "3 no-shows evitados" },
  { h: "09:12", icon: "🛒", what: "Atende e anota pedido por telefone", result: "+ $85 · upsell de bebida" },
  { h: "12:30", icon: "📅", what: "Agenda cliente novo pelo WhatsApp", result: "consulta marcada em 40s" },
  { h: "15:05", icon: "🧾", what: "Envia orçamento e cobra resposta", result: "proposta de $4.200 na mesa" },
  { h: "18:50", icon: "⭐", what: "Pede avaliação pós-atendimento", result: "mais um 5 estrelas" },
  { h: "21:38", icon: "📞", what: "Atende ligação fora do horário", result: "venda que ia pro concorrente" },
  { h: "02:10", icon: "🔁", what: "Reativa clientes sumidos", result: "2 voltaram a comprar" },
];

const LEGS = [
  { ic: "🧠", name: "Guileo Brain", role: "Performance", desc: "Agentes de IA que atendem, agendam, qualificam e fecham — 24/7, em qualquer idioma.", color: "#3E9468" },
  { ic: "📈", name: "Guileo AD", role: "Sales", desc: "Cada conversa vira dado, dado vira marketing, marketing vira receita recorrente.", color: "#D6C29A" },
  { ic: "🛠️", name: "Guileo Build", role: "Growth", desc: "Sites, apps e software sob medida — construídos pra converter e escalar.", color: "#C2A878" },
];

const RESULTS = [["+286%", "performance média"], ["3×", "ciclo de venda mais rápido"], ["< 7 dias", "no ar"], ["24/7", "no automático"]];

const DELIVER = ["🎙️ Voice AI", "💬 WhatsApp & SMS", "🌐 Sites", "📱 Apps", "⚙️ Software", "📣 Anúncios", "📅 Agendamentos", "🛒 E-commerce", "🔄 Automações", "📊 Dashboards & CRM", "⭐ Reviews", "📈 Growth"];

const METHOD = [
  { ic: "🌱", when: "Dia 01", title: "Plantamos", desc: "Um humano estuda seu negócio e acha onde o dinheiro vaza." },
  { ic: "🌿", when: "Dias 2–7", title: "Construímos", desc: "Montamos e colocamos sua IA no ar em menos de 7 dias." },
  { ic: "🌳", when: "Semana 2 →", title: "Colhemos", desc: "O lucro sobe — e a gente continua otimizando pra você." },
];

// A single full-viewport slide. Like the site's scroll-reveal: entrance animations replay
// every time the slide becomes active (remount via key), instead of all firing at page load.
function Slide({ id, children, className = "" }) {
  const [on, setOn] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.55 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={ref} id={id} className={`relative flex h-screen w-full shrink-0 snap-start flex-col items-center justify-center overflow-hidden px-6 py-20 sm:px-12 ${className}`}>
      <div key={on ? 1 : 0} className="contents">{children}</div>
    </section>
  );
}

const Eyebrow = ({ children }) => (
  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-g-gold">{children}</div>
);

export default function Pitch() {
  const [active, setActive] = useState(0);
  const scroller = useRef(null);

  // Keyboard navigation: ↓/→/Space = next, ↑/← = prev. Presentation muscle memory.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const go = (dir) => {
      const next = Math.max(0, Math.min(SLIDES.length - 1, active + dir));
      document.getElementById(SLIDES[next].id)?.scrollIntoView({ behavior: "smooth" });
    };
    const onKey = (e) => {
      if (["ArrowDown", "ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  // Track the slide in view (drives the dot nav + counter).
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) setActive(SLIDES.findIndex((s) => s.id === en.target.id)); }),
      { threshold: 0.6 }
    );
    SLIDES.forEach((s) => { const n = document.getElementById(s.id); if (n) obs.observe(n); });
    return () => obs.disconnect();
  }, []);

  const goTo = (i) => document.getElementById(SLIDES[i].id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="surface-real relative h-screen overflow-hidden text-g-ink">
      <style>{`
        @keyframes pfade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pshine{to{background-position:220% center}}
        @keyframes pfall{0%{transform:translateY(-10px);opacity:0}20%{opacity:1}100%{transform:translateY(54px);opacity:0}}
        .pdeck::-webkit-scrollbar{display:none}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      {/* top chrome — logo + slide label + exit */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 sm:px-8">
        <a href="/" className="pointer-events-auto flex items-center gap-2 opacity-80 transition hover:opacity-100">
          <img src={logo} alt="Guileo" className="h-7 w-7 object-contain" /><span className="text-sm font-extrabold text-g-word">Guileo</span>
        </a>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-g-muted backdrop-blur-md">
          {String(active + 1).padStart(2, "0")} · {SLIDES[active].label}
        </div>
      </header>

      {/* dot nav */}
      <nav className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 sm:flex">
        {SLIDES.map((s, i) => (
          <button key={s.id} onClick={() => goTo(i)} aria-label={s.label}
            className={`h-2.5 w-2.5 rounded-full transition-all ${i === active ? "scale-125 bg-g-gold" : "bg-white/20 hover:bg-white/40"}`} />
        ))}
      </nav>

      {/* progress bar */}
      <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-white/5">
        <div className="h-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-500" style={{ width: `${((active + 1) / SLIDES.length) * 100}%` }} />
      </div>

      <div ref={scroller} className="pdeck relative z-10 h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth" style={{ scrollbarWidth: "none" }}>

        {/* 1 — COVER: the one sentence */}
        <Slide id="cover">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_500px_at_50%_30%,rgba(62,148,104,0.12),transparent)]" />
          <img src={logo} alt="" className="mb-8 h-20 w-20 object-contain drop-shadow-[0_0_40px_rgba(62,148,104,0.4)]" style={{ animation: "pfade .8s ease both" }} />
          <p className="mx-auto max-w-4xl text-center font-black leading-[1.05] tracking-tight text-g-word" style={{ fontSize: "clamp(1.8rem,4.4vw,3.4rem)", animation: "pfade .9s ease .15s both" }}>
            A Guileo instala um <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "pshine 7s linear infinite" }}>time de IA + marketing</span> que atende, vende e faz crescer o seu negócio sozinho, 24/7.
          </p>
          <p className="mt-6 max-w-2xl text-center text-lg text-g-ink sm:text-xl" style={{ animation: "pfade .9s ease .3s both" }}>
            Você escolhe o resultado. <span className="font-bold text-g-word">A gente entrega.</span>
          </p>
          <div className="mt-10 flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.2em] text-g-muted" style={{ animation: "pfade .9s ease .45s both" }}>
            <span className="text-g-green">⚡ Work Smart</span> · <span className="text-g-light">Grow Faster</span> · <span className="text-g-gold">Sleep Better</span>
          </div>
          <button onClick={() => goTo(1)} className="absolute bottom-10 animate-bounce text-g-muted" aria-label="Próximo">↓</button>
        </Slide>

        {/* 2 — THE PROBLEM */}
        <Slide id="problem">
          <Eyebrow>O problema</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            Todo dia, dinheiro sai pela porta — e ninguém vê.
          </h2>
          <div className="mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {[
              ["📞", "Ligação perdida", "Toca às 21h, ninguém atende. O cliente liga pro concorrente."],
              ["⏰", "Lead esfria", "Demorou 1h pra responder? A venda já era."],
              ["🔁", "Sem follow-up", "Quem não voltou, ninguém chamou de volta."],
            ].map(([ic, t, d], i) => (
              <div key={t} className="rounded-2xl border border-[#d8916e]/25 bg-[#d8916e]/[0.06] p-6 text-center" style={{ animation: `pfade .7s ease ${0.1 + i * 0.12}s both` }}>
                <div className="text-3xl">{ic}</div>
                <div className="mt-3 text-base font-black text-g-word">{t}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-g-muted">{d}</p>
              </div>
            ))}
          </div>
          <div className="relative mt-10 text-center" style={{ animation: "pfade .8s ease .5s both" }}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8916e]">Um negócio médio perde por mês</div>
            <div className="relative mt-1 inline-block text-[44px] font-black text-[#e0855f] sm:text-[56px]">
              $3.000–9.000
              <span className="pointer-events-none absolute -right-6 top-0 text-lg" style={{ animation: "pfall 1.8s ease-in-out infinite" }}>💸</span>
            </div>
            <div className="mt-1 text-[13px] text-g-muted">só em oportunidade que ninguém capturou.</div>
          </div>
        </Slide>

        {/* 3 — MEET GUI */}
        <Slide id="gui">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_40%,rgba(62,148,104,0.12),transparent)]" />
          <Eyebrow>Conheça a Gui</Eyebrow>
          <div className="relative mb-6 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-g-green/30 to-g-gold/15 text-4xl ring-1 ring-white/15" style={{ animation: "pfade .8s ease both" }}>
            🌱
            <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-g-deep text-g-green ring-2 ring-g-green/60">🎙️</span>
            <span className="absolute inset-0 rounded-full ring-2 ring-g-green/40 animate-pulsering" />
          </div>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            Uma IA que <span className="text-g-green">atende</span>, <span className="text-g-word">agenda</span>, <span className="text-g-gold">vende</span> e faz follow-up.
          </h2>
          <p className="mt-4 max-w-xl text-center text-[15px] text-g-ink">Voz, WhatsApp, SMS e web — qualquer idioma, 24 horas, sem nunca cansar.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2" style={{ animation: "pfade .8s ease .3s both" }}>
            {["📅 Agenda", "🛒 Toma pedidos", "💳 Registra vendas", "🧾 Manda orçamento", "↩️ Reagenda no-show", "🌐 Responde em qualquer língua"].map((c) => (
              <span key={c} className="rounded-full border border-g-green/25 bg-g-green/[0.07] px-3 py-1.5 text-[12.5px] font-semibold text-g-light">{c}</span>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-g-gold/30 bg-g-gold/[0.06] px-6 py-4 text-center" style={{ animation: "pfade .8s ease .45s both" }}>
            <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">👉 Momento da verdade</div>
            <p className="mt-1 text-[15px] font-semibold text-g-word">Deixa eu fazer a Gui te ligar agora — você ouve ela trabalhar.</p>
          </div>
        </Slide>

        {/* 3.5 — NA PRÁTICA: a real day of work (concrete, not abstract) */}
        <Slide id="pratica">
          <Eyebrow>Um dia com a Gui · de verdade</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.6rem,3.4vw,2.6rem)" }}>
            Enquanto você vive seu dia, <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">ela trabalha o dia inteiro.</span>
          </h2>
          <div className="mt-8 w-full max-w-2xl">
            {DAY.map((d, i) => (
              <div key={d.h} className="flex items-center gap-3 border-b border-white/[0.06] py-2.5" style={{ animation: `pfade .55s ease ${0.12 + i * 0.14}s both` }}>
                <span className="w-12 shrink-0 text-right font-mono text-[12px] font-bold text-g-muted">{d.h}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-base ring-1 ring-white/10">{d.icon}</span>
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-g-word">{d.what}</span>
                <span className="hidden shrink-0 rounded-full border border-g-green/25 bg-g-green/[0.07] px-2.5 py-0.5 text-[11.5px] font-bold text-g-green sm:block">✓ {d.result}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[13.5px] text-g-muted" style={{ animation: "pfade .7s ease 1.2s both" }}>
            Madrugada, domingo, feriado — <span className="font-bold text-g-word">nenhuma hora é perdida.</span>
          </p>
        </Slide>

        {/* 4 — WHAT WE DELIVER */}
        <Slide id="deliver">
          <Eyebrow>O que entregamos</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            Não automatizamos tarefas. Crescemos o negócio.
          </h2>
          <div className="mt-9 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {LEGS.map((l, i) => (
              <div key={l.name} className="rounded-2xl border bg-white/[0.03] p-6" style={{ borderColor: `${l.color}40`, animation: `pfade .7s ease ${0.1 + i * 0.12}s both` }}>
                <div className="h-1 w-10 rounded-full" style={{ background: l.color }} />
                <div className="mt-4 text-3xl">{l.ic}</div>
                <div className="mt-2 text-[11px] font-black uppercase tracking-wider" style={{ color: l.color }}>{l.role}</div>
                <div className="text-lg font-black text-g-word">{l.name}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-g-muted">{l.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 max-w-3xl" style={{ animation: "pfade .8s ease .5s both" }}>
            <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-g-muted">+60 serviços e produtos · um time · uma conta</div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {DELIVER.map((d) => <span key={d} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-semibold text-g-ink">{d}</span>)}
            </div>
          </div>
        </Slide>

        {/* 5 — PROOF / RESULTS */}
        <Slide id="proof">
          <Eyebrow>Resultados</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            Você não compra IA. <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">Você compra resultado.</span>
          </h2>
          <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-5 sm:grid-cols-4">
            {RESULTS.map(([n, l], i) => (
              <div key={l} className="text-center" style={{ animation: `pfade .7s ease ${0.1 + i * 0.1}s both` }}>
                <div className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-[34px] font-black text-transparent sm:text-[44px]">{n}</div>
                <div className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-g-muted">{l}</div>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-xl text-center text-[15px] text-g-ink" style={{ animation: "pfade .8s ease .5s both" }}>
            A gente precifica o <span className="font-bold text-g-word">problema que resolve</span> — nunca a tecnologia por baixo.
          </p>
        </Slide>

        {/* 6 — METHOD */}
        <Slide id="method">
          <Eyebrow>Como funciona</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            Conduzido por humanos de verdade. No ar em 7 dias.
          </h2>
          <div className="mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {METHOD.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-g-line bg-white/[0.03] p-6 text-center" style={{ animation: `pfade .7s ease ${0.1 + i * 0.14}s both` }}>
                <div className="text-4xl">{s.ic}</div>
                <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-g-gold">{s.when}</div>
                <div className="text-lg font-black text-g-word">{s.title}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-g-muted">{s.desc}</p>
                {i < 2 && <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-xl text-g-gold sm:block">→</span>}
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-[14px] text-g-ink" style={{ animation: "pfade .8s ease .5s both" }}>
            A gente até <span className="font-bold text-g-word">visita você</span> pra entender o negócio de perto.
          </p>
        </Slide>

        {/* 7 — PRICING */}
        <Slide id="pricing">
          <Eyebrow>Investimento</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            Sob medida — não vendemos pacote de prateleira.
          </h2>
          <p className="mt-4 max-w-2xl text-center text-[15px] text-g-ink">
            Um humano estuda seu negócio e monta o pacote certo: um plano mensal simples com créditos que medem o que a Gui faz por você.
          </p>
          <div className="mt-9 grid w-full max-w-3xl gap-4 sm:grid-cols-2" style={{ animation: "pfade .8s ease .3s both" }}>
            <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-6">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-green">Você recebe</div>
              <ul className="mt-3 space-y-2 text-[14px] text-g-word">
                <li>✓ Marketing + IA trabalhando juntos</li>
                <li>✓ Plugado no seu sistema atual</li>
                <li>✓ Atende 24/7, qualquer idioma</li>
                <li>✓ No ar em 7 dias</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-g-gold/30 bg-g-gold/[0.06] p-6">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">Sem risco</div>
              <ul className="mt-3 space-y-2 text-[14px] text-g-word">
                <li>🛡️ Garantia de 30 dias</li>
                <li>💳 Plano mensal, sem amarras longas</li>
                <li>📊 Você vê cada crédito no painel</li>
                <li>🤝 Um humano revisa com você</li>
              </ul>
            </div>
          </div>
        </Slide>

        {/* 8 — TRUST */}
        <Slide id="trust">
          <Eyebrow>Confiança</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            Construído pra ser confiável desde o dia um.
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3" style={{ animation: "pfade .8s ease .2s both" }}>
            {["HIPAA", "GDPR", "LGPD", "CCPA", "PCI DSS"].map((b) => (
              <span key={b} className="inline-flex items-center gap-2 rounded-xl border border-g-line bg-white/[0.04] px-4 py-2.5 text-[13px] font-bold text-g-word">🛡️ {b}</span>
            ))}
          </div>
          <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2" style={{ animation: "pfade .8s ease .4s both" }}>
            <div className="rounded-2xl border border-g-line bg-white/[0.03] p-6 text-center">
              <div className="text-2xl">🤝</div>
              <p className="mt-2 text-[14px] text-g-ink">Um fundador de verdade toca isso <span className="font-bold text-g-word">junto com você</span>.</p>
            </div>
            <div className="rounded-2xl border border-g-line bg-white/[0.03] p-6 text-center">
              <div className="text-2xl">🔒</div>
              <p className="mt-2 text-[14px] text-g-ink">Seus dados são <span className="font-bold text-g-word">seus</span> — governados do início ao fim.</p>
            </div>
          </div>
        </Slide>

        {/* 8.5 — TESTE SEM RISCO: how the client tests us, step by step */}
        <Slide id="teste">
          <Eyebrow>Como você testa · sem risco</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            Você não precisa acreditar. <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">Precisa testar.</span>
          </h2>
          <div className="mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {[
              ["1", "📞", "Agora, nesta reunião", "A Gui te liga na frente de todo mundo. Você ouve ela atender, qualificar e vender — ao vivo.", "g-green"],
              ["2", "🛠️", "Próximos 7 dias", "A gente constrói o SEU sistema — com seu cardápio, seus serviços, sua voz. Você acompanha tudo.", "g-gold"],
              ["3", "🛡️", "Primeiros 30 dias", "O sistema prova o resultado em números. Não provou? Devolvemos. Simples assim.", "g-copper"],
            ].map(([n, ic, t, d], i) => (
              <div key={n} className="relative rounded-2xl border border-g-line bg-white/[0.03] p-6" style={{ animation: `pfade .7s ease ${0.12 + i * 0.16}s both` }}>
                <span className="absolute right-4 top-3 text-[30px] font-black text-white/[0.07]">{n}</span>
                <div className="text-3xl">{ic}</div>
                <div className="mt-3 text-[15px] font-black text-g-word">{t}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-g-muted">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-g-green/30 bg-g-green/[0.06] px-6 py-4 text-center" style={{ animation: "pfade .8s ease .6s both" }}>
            <p className="text-[15px] font-semibold text-g-word">O risco é todo nosso. O resultado é todo seu.</p>
          </div>
        </Slide>

        {/* 9 — CLOSE */}
        <Slide id="close">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_50%,rgba(214,194,154,0.12),transparent)]" />
          <img src={logo} alt="" className="mb-6 h-16 w-16 object-contain" style={{ animation: "pfade .8s ease both" }} />
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)", animation: "pfade .8s ease .1s both" }}>
            Pare de perder cliente. <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">Comece hoje à noite.</span>
          </h2>
          <p className="mt-5 max-w-xl text-center text-[15px] text-g-ink" style={{ animation: "pfade .8s ease .25s both" }}>
            No ar em 7 dias · garantia de 30 dias · fale com a nossa IA agora mesmo.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animation: "pfade .8s ease .4s both" }}>
            <a href={bookLink("Quero agendar uma demo da Guileo")} target="_blank" rel="noopener" className="btn-gold text-base">📅 Agendar agora</a>
            <a href={waLink("Oi Guileo! Vi a apresentação e quero começar.")} target="_blank" rel="noopener" className="btn text-base">💬 Falar no WhatsApp</a>
          </div>
          <p className="mt-12 max-w-lg text-center text-[13px] italic text-g-muted" style={{ animation: "pfade .8s ease .55s both" }}>
            "Imagine seu negócio vendendo, agendando e crescendo — enquanto você dorme. A gente não imagina. A gente constrói."
          </p>
        </Slide>

      </div>
    </div>
  );
}
