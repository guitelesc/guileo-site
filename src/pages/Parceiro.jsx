import { useState, useEffect, useMemo, useRef } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink } from "../data/contact.js";

// ─────────────────────────────────────────────────────────────────────────────
// /parceiro — the COLLABORATOR / GROWTH PARTNER recruiting deck. Same standalone
// scroll-snap engine as /pitch, but the audience is a person we want to recruit.
// Core decision (locked): the collaborator is 3-in-1 (sells + implements + owns the
// account) and earns a % PER CLOSED SALE. The comp slide is illustrative and
// adjustable via ?pct=20&ticket=1497&setup=990&months=3&deals=8 — Luis locks the % later.
// ─────────────────────────────────────────────────────────────────────────────

const SLIDES = [
  { id: "cover", label: "Abertura" },
  { id: "what", label: "O que é a Guileo" },
  { id: "deliver", label: "O que entregamos" },
  { id: "role", label: "Seu papel" },
  { id: "flow", label: "Como funciona" },
  { id: "earn", label: "Quanto você ganha" },
  { id: "why", label: "Por que agora" },
  { id: "join", label: "Entrar" },
];

const money = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("en-US");

// Entrance animations replay each time the slide becomes active (site-style scroll-reveal).
function Slide({ id, children }) {
  const [on, setOn] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.55 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={ref} id={id} className="relative flex h-screen w-full shrink-0 snap-start flex-col items-center justify-center overflow-hidden px-6 py-20 sm:px-12">
      <div key={on ? 1 : 0} className="contents">{children}</div>
    </section>
  );
}

// Site-style count-up: the number climbs to its value when it appears (like the landing's stats).
function CountMoney({ value, suffix = "" }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) { clearInterval(t); setN(0); return; }
      const steps = 36; let s = 0;
      clearInterval(t);
      t = setInterval(() => { s += 1; setN(Math.min(value, Math.round((value / steps) * s))); if (s >= steps) clearInterval(t); }, 28);
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => { obs.disconnect(); clearInterval(t); };
  }, [value]);
  return <span ref={ref}>{money(n)}{suffix}</span>;
}
const Eyebrow = ({ children }) => (
  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-g-gold">{children}</div>
);

export default function Parceiro() {
  const [active, setActive] = useState(0);
  const scroller = useRef(null);
  const p = useMemo(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""), []);

  // comp inputs (illustrative — Luis locks the real %)
  const pct = Number(p.get("pct") || 20);
  const ticket = Number(p.get("ticket") || 1497);   // monthly fee
  const setup = Number(p.get("setup") || 990);       // one-time setup
  const months = Number(p.get("months") || 3);       // contract value counted = setup + N months
  const deals = Number(p.get("deals") || 8);         // deals/month in the example
  const contractValue = setup + ticket * months;
  const perSale = contractValue * (pct / 100);
  const monthly = perSale * deals;

  useEffect(() => {
    const go = (dir) => { const n = Math.max(0, Math.min(SLIDES.length - 1, active + dir)); document.getElementById(SLIDES[n].id)?.scrollIntoView({ behavior: "smooth" }); };
    const onKey = (e) => {
      if (["ArrowDown", "ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    const obs = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) setActive(SLIDES.findIndex((s) => s.id === en.target.id)); }), { threshold: 0.6 });
    SLIDES.forEach((s) => { const n = document.getElementById(s.id); if (n) obs.observe(n); });
    return () => obs.disconnect();
  }, []);
  useEffect(() => { document.title = "Guileo · Seja um Growth Partner"; }, []);

  const goTo = (i) => document.getElementById(SLIDES[i].id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="surface-real relative h-screen overflow-hidden text-g-ink">
      <style>{`
        @keyframes cfade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cshine{to{background-position:220% center}}
        .cdeck::-webkit-scrollbar{display:none}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 sm:px-8">
        <a href="/" className="pointer-events-auto flex items-center gap-2 opacity-80 transition hover:opacity-100"><img src={logo} alt="Guileo" className="h-7 w-7 object-contain" /><span className="text-sm font-extrabold text-g-word">Guileo</span></a>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-g-muted backdrop-blur-md">{String(active + 1).padStart(2, "0")} · {SLIDES[active].label}</div>
      </header>
      <nav className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 sm:flex">
        {SLIDES.map((s, i) => <button key={s.id} onClick={() => goTo(i)} aria-label={s.label} className={`h-2.5 w-2.5 rounded-full transition-all ${i === active ? "scale-125 bg-g-gold" : "bg-white/20 hover:bg-white/40"}`} />)}
      </nav>
      <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-white/5"><div className="h-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-500" style={{ width: `${((active + 1) / SLIDES.length) * 100}%` }} /></div>

      <div ref={scroller} className="cdeck relative z-10 h-screen snap-y snap-mandatory overflow-y-scroll scroll-smooth" style={{ scrollbarWidth: "none" }}>

        {/* 1 — COVER */}
        <Slide id="cover">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_500px_at_50%_30%,rgba(214,194,154,0.12),transparent)]" />
          <img src={logo} alt="" className="mb-7 h-16 w-16 object-contain drop-shadow-[0_0_40px_rgba(214,194,154,0.4)]" style={{ animation: "cfade .8s ease both" }} />
          <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.24em] text-g-gold" style={{ animation: "cfade .8s ease .1s both" }}>Programa Growth Partner</div>
          <h1 className="mx-auto max-w-4xl text-center font-black leading-[1.05] tracking-tight text-g-word" style={{ fontSize: "clamp(1.9rem,4.4vw,3.4rem)", animation: "cfade .9s ease .2s both" }}>
            Venda o que <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "cshine 7s linear infinite" }}>vende sozinho.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-center text-lg text-g-ink" style={{ animation: "cfade .9s ease .35s both" }}>
            A Guileo instala um time de IA + marketing que atende, vende e faz crescer o negócio do cliente 24/7. Você traz o cliente — <span className="font-bold text-g-word">a gente entrega, e você ganha.</span>
          </p>
          <button onClick={() => goTo(1)} className="absolute bottom-10 animate-bounce text-g-muted" aria-label="Próximo">↓</button>
        </Slide>

        {/* 2 — WHAT IS GUILEO */}
        <Slide id="what">
          <Eyebrow>O que é a Guileo</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>Um produto que o mercado inteiro precisa.</h2>
          <p className="mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-g-ink">
            Todo negócio perde ligação, lead e venda por não conseguir responder a tempo. A Guileo resolve isso com IA que atende e vende 24/7 — e ainda cuida do marketing. <span className="font-semibold text-g-word">Resultado, não tecnologia.</span>
          </p>
          <div className="mt-9 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[["∞", "mercado: todo negócio"], ["7 dias", "do zero ao ar"], ["24/7", "trabalhando"], ["30 dias", "garantia"]].map(([n, l]) => (
              <div key={l} className="text-center"><div className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-3xl font-black text-transparent sm:text-4xl">{n}</div><div className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-g-muted">{l}</div></div>
            ))}
          </div>
        </Slide>

        {/* 3 — WHAT WE DELIVER (so the partner never delivers alone) */}
        <Slide id="deliver">
          <Eyebrow>O que entregamos</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>Você vende. <span className="text-g-green">A gente faz acontecer.</span></h2>
          <p className="mt-4 max-w-2xl text-center text-[15px] text-g-ink">Um time de verdade entrega tudo — você nunca fica sozinho com o cliente.</p>
          <div className="mt-8 flex max-w-3xl flex-wrap justify-center gap-1.5">
            {["🎙️ Voice AI", "💬 WhatsApp & SMS", "🌐 Sites", "📱 Apps", "⚙️ Software", "📣 Anúncios", "🎬 Vídeo", "📅 Agenda", "🛒 E-commerce", "🔄 Automações", "📊 CRM", "⭐ Reviews"].map((d) => (
              <span key={d} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-semibold text-g-ink">{d}</span>
            ))}
          </div>
        </Slide>

        {/* 4 — YOUR ROLE: 3-in-1 Growth Partner */}
        <Slide id="role">
          <Eyebrow>Seu papel</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>Você não é "vendedor". É dono do resultado.</h2>
          <p className="mt-3 max-w-2xl text-center text-[15px] text-g-ink">Um Growth Partner é 3 em 1 — uma mini-franquia pessoal:</p>
          <div className="mt-8 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {[
              ["🎯", "Você vende", "Prospecta, mostra a demo ao vivo e fecha. A Gui faz metade do trabalho de convencimento sozinha."],
              ["🤝", "Você dona a conta", "Acompanha a implantação e a relação — com nosso time fazendo o trabalho pesado por trás."],
              ["💰", "Você ganha", "Comissão por cada venda fechada. Quanto mais resultado pro cliente, mais você ganha."],
            ].map(([ic, t, d], i) => (
              <div key={t} className="rounded-2xl border border-g-line bg-white/[0.03] p-6 text-center" style={{ animation: `cfade .7s ease ${0.1 + i * 0.12}s both` }}>
                <div className="text-3xl">{ic}</div><div className="mt-3 text-base font-black text-g-word">{t}</div><p className="mt-2 text-[13px] leading-relaxed text-g-muted">{d}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* 5 — FLOW */}
        <Slide id="flow">
          <Eyebrow>Como funciona</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>5 passos do contato ao cheque.</h2>
          <div className="mt-9 grid w-full max-w-4xl gap-3 sm:grid-cols-5">
            {[["1", "🔎", "Prospecta", "Acha o negócio"], ["2", "📞", "Demo ao vivo", "Gui liga e impressiona"], ["3", "📄", "Proposta", "Link personalizado"], ["4", "🛠️", "A gente entrega", "No ar em 7 dias"], ["5", "💸", "Você ganha", "Comissão na conta"]].map(([n, ic, t, d], i) => (
              <div key={n} className="relative rounded-2xl border border-g-line bg-white/[0.03] p-4 text-center" style={{ animation: `cfade .6s ease ${0.08 * i}s both` }}>
                <div className="text-2xl">{ic}</div><div className="mt-1 text-[11px] font-black text-g-gold">PASSO {n}</div><div className="text-[13.5px] font-black text-g-word">{t}</div><p className="mt-0.5 text-[11px] text-g-muted">{d}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* 6 — HOW MUCH YOU EARN (illustrative) */}
        <Slide id="earn">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_40%,rgba(62,148,104,0.12),transparent)]" />
          <Eyebrow>Quanto você ganha</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{pct}%</span> por venda fechada.
          </h2>
          <div className="mt-8 w-full max-w-2xl rounded-xl3 border border-g-green/30 bg-white/[0.04] p-6 shadow-lift" style={{ animation: "cfade .8s ease .2s both" }}>
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between border-b border-white/10 pb-2"><span className="text-g-muted">Pacote típico</span><span className="font-bold text-g-word">{money(ticket)}/mês + {money(setup)} setup</span></div>
              <div className="flex justify-between border-b border-white/10 py-2"><span className="text-g-muted">Valor da venda (setup + {months} meses)</span><span className="font-bold text-g-word">{money(contractValue)}</span></div>
              <div className="flex justify-between border-b border-white/10 py-2"><span className="text-g-muted">Sua comissão ({pct}%)</span><span className="font-black text-g-green">{money(perSale)} / venda</span></div>
            </div>
            <div className="mt-5 rounded-2xl bg-g-green/10 p-5 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-g-green">Fechando {deals} por mês</div>
              <div className="text-[40px] font-black leading-none text-g-word"><CountMoney value={monthly} /><span className="text-base font-bold text-g-muted">/mês</span></div>
            </div>
          </div>
          <p className="mt-4 text-[11.5px] text-g-muted">Exemplo ilustrativo · o % final é definido no seu contrato de parceria.</p>
        </Slide>

        {/* 7 — WHY NOW */}
        <Slide id="why">
          <Eyebrow>Por que agora</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>A onda da IA está começando. Você entra na frente.</h2>
          <div className="mt-8 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
            {[["🌊", "Mercado quente", "Todo negócio quer IA, poucos sabem entregar."], ["🛠️", "Produto pronto", "Você vende algo que já funciona e entrega em 7 dias."], ["📈", "Renda escalável", "Sem teto: quanto mais fecha, mais ganha."]].map(([ic, t, d], i) => (
              <div key={t} className="rounded-2xl border border-g-line bg-white/[0.03] p-6 text-center" style={{ animation: `cfade .7s ease ${0.1 + i * 0.12}s both` }}>
                <div className="text-3xl">{ic}</div><div className="mt-3 text-base font-black text-g-word">{t}</div><p className="mt-2 text-[13px] leading-relaxed text-g-muted">{d}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* 8 — JOIN */}
        <Slide id="join">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_50%,rgba(214,194,154,0.12),transparent)]" />
          <img src={logo} alt="" className="mb-6 h-16 w-16 object-contain" style={{ animation: "cfade .8s ease both" }} />
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)", animation: "cfade .8s ease .1s both" }}>
            Pronto pra <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">crescer com a gente?</span>
          </h2>
          <p className="mt-5 max-w-xl text-center text-[15px] text-g-ink" style={{ animation: "cfade .8s ease .25s both" }}>Treinamento, materiais e a demo ao vivo da Gui — tudo pronto pra você começar a fechar.</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animation: "cfade .8s ease .4s both" }}>
            <a href={waLink("Oi Guileo! Quero ser um Growth Partner.")} target="_blank" rel="noopener" className="btn-gold text-base">🤝 Quero entrar</a>
            <a href="/pitch" className="btn text-base">▶️ Ver o pitch do cliente</a>
          </div>
        </Slide>

      </div>
    </div>
  );
}
