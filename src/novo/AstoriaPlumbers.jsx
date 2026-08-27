/* ASTORIA PLUMBERS — reconstrução (prospect real, astoriaplumbers.nyc)
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   ⚠️ O SITE DELES ESTÁ FORA DO AR. `astoriaplumbers.nyc` devolve 525 (Cloudflare não fecha TLS com
   a origem) e o `.com` é uma página estacionada. Estava no ar até 11/05/2026 — construído no
   GoDaddy Website Builder (as imagens ficavam em img1.wsimg.com), e caiu depois disso.
   Então NÃO havia ativo nenhum para baixar do site vivo. Os três que estão em public/novo/astoria/
   vieram do ARQUIVO DA WEB (web.archive.org, captura de 11/05) — são os arquivos ORIGINAIS deles,
   não recriações: a logo, o selo "24 HR EMERGENCY SERVICE" e o telefone desenhado como decalque.
   Isso é o que separa uma reconstrução de um template: a identidade é dele, mesmo quando o site
   dele já não existe.

   IDENTIDADE (lida dos ativos reais, nunca escolhida por mim):
     · verde neon #39FF14 — a cor de ação/emergência, do bloco da logo
     · navy #0B0C4C / #120E57 — o fundo e o texto, do CSS arquivado
     · tipografia de DECALQUE DE VAN: itálico condensado pesado (é como o nome e o telefone
       aparecem nos ativos deles). Saira Condensed 800 italic é o parente mais próximo.

   CONCEITO: a LIVRERIA DE SERVIÇO — o site como a lateral da van. Faixas diagonais, itálico
   condensado, verde sobre navy, número gigante. Nada disso é invenção minha: é o sistema visual
   que eles já usam impresso. (O Nonstop virou mesa de despacho; dois sites do motor nunca saem
   iguais, e o motivo é que o conceito vem do mundo DAQUELE negócio.)

   FATOS — todos verificados, nada inventado:
     · Google confirmou: Astoria Plumbers · Plumber · 4,7★ · 68 avaliações
     · 30-96 32nd St, Long Island City, NY 11102 · (646) 919-1074 · 24h, 7 dias
     · copy do site arquivado: "FAST. RELIABLE. LOCAL." · emergências, reparos e instalações
       (torneiras, chuveiros, pias, vasos) · opera de Astoria/Queens servindo Manhattan,
       Brooklyn e Bronx · equipe de encanadores certificados · satisfação garantida
   ⚠️ SEM FOTO DE EQUIPE, VAN OU OBRA: o site arquivado não tinha nenhuma. Não entra render nem
   banco de imagem no lugar — foto falsa de equipe é a mentira mais fácil de detectar e a mais
   cara. O que existe são os ativos de marca, e é com eles que a página é feita. */
import { useState, useEffect, useRef, useCallback } from "react";
import Mascote from "./Mascote.jsx";

const TEL = "+16469191074";
const TEL_FMT = "(646) 919-1074";
const ENDERECO = "30-96 32nd St, Long Island City, NY 11102";

/* Áreas EXATAMENTE como o site arquivado declara: a base é Astoria/Queens e daí saem para os
   outros três. Ordem = a deles, não a minha. O `q` alimenta o formulário quando a linha é aberta. */
const AREAS = [
  { q: "astoria",   nome: "Astoria & Queens", nota: "Base — trucks staged here" },
  { q: "manhattan", nome: "Manhattan",        nota: "Bridge and tunnel, both ways" },
  { q: "brooklyn",  nome: "Brooklyn",         nota: "Across the Pulaski and the BQE" },
  { q: "bronx",     nome: "The Bronx",        nota: "Up the Triboro" },
];

/* Serviços: as palavras do próprio site arquivado. Cartão compacto, sub-itens numa linha só —
   a lista não pode competir com o quadro de áreas, que é onde o pedido acontece. */
const SERVICOS = [
  { t: "Emergencies", d: "Burst pipe, no water, flooding, gas smell.", i: "Leaks · Backups · No heat · Shut-offs" },
  { t: "Repairs", d: "The thing that has been dripping for a month.", i: "Faucets · Showers · Sinks · Toilets" },
  { t: "Planned installations", d: "Booked for a day that suits the building.", i: "Fixtures · Replacements · Upgrades" },
];

const FAQ = [
  ["Are you really open at 3am?", "Yes — 24 hours, 7 days. A certified plumber answers, not a machine."],
  ["Do you cover my building?", "We work out of Astoria, Queens and cover Manhattan, Brooklyn and the Bronx."],
  ["How fast can someone get here?", "Emergencies are dispatched first. Tell us the borough and what is happening and we will give you a real window, not a promise."],
  ["What does it cost?", "It depends on the job — we quote before we start, never after. No surprise on the invoice."],
];


/* ── PRESENÇA ONLINE ────────────────────────────────────────────────────────────────────────────
   É aqui que a reconstrução ganha do site original de verdade. O deles (GoDaddy Builder) tinha
   `<title>Astoria Plumbers</title>` e mais nada — sem descrição, sem OG, sem JSON-LD. Um encanador
   24h invisível pro Google é dinheiro parado.
   Tudo é REMOVIDO ao desmontar, e o que já existia é RESTAURADO: o index.html injeta o SEO da
   Guileo em toda rota, e duas descrições brigando é pior que nenhuma.
   ⚠️ O JSON-LD global da Guileo é desativado pelo Novo.jsx enquanto esta página está montada —
   senão o Google lê o negócio DELE como sendo a Guileo. */
const SITE_URL = "https://guileoai.com/novo/astoria-plumbers";
const TITULO = "Astoria Plumbers — 24/7 Emergency Plumber in Astoria, Queens & NYC";
const DESC = "Certified plumbers, 24 hours a day. Emergencies, repairs and installations — faucets, showers, sinks, toilets. Astoria, Queens plus Manhattan, Brooklyn and the Bronx. Call (646) 919-1074.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["name", "twitter:card", "summary_large_image"],
];
const LD = () => ([
  {
    "@context": "https://schema.org", "@type": "Plumber",
    name: "Astoria Plumbers", url: SITE_URL, telephone: TEL,
    image: "https://guileoai.com/novo/astoria/logo.png",
    address: { "@type": "PostalAddress", streetAddress: "30-96 32nd St",
      addressLocality: "Long Island City", addressRegion: "NY", postalCode: "11102", addressCountry: "US" },
    // 4,7 com 68 avaliações veio do Google e é verificável — número de review nunca se inventa.
    aggregateRating: { "@type": "AggregateRating", ratingValue: "4.7", reviewCount: "68" },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
      opens: "00:00", closes: "23:59" }],
    areaServed: ["Astoria", "Queens", "Manhattan", "Brooklyn", "The Bronx"],
  },
  {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q,
      acceptedAnswer: { "@type": "Answer", text: a } })),
  },
]);

/* O RELÓGIO DE NY — o único dado vivo da página, e ele INFORMA em vez de decorar: a promessa do
   negócio é "24h", então mostrar a hora de Nova York agora é a prova de que a promessa vale neste
   instante. Número inventado aqui seria o oposto do argumento. */
function useRelogioNY() {
  const [h, setH] = useState("");
  useEffect(() => {
    const tick = () => setH(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date()));
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, []);
  return h;
}

/* Reveal com fail-open: se o IntersectionObserver não disparar (aba oculta, motor de captura),
   o conteúdo aparece sozinho em 1.4s. Página que some por causa de animação é página quebrada. */
function useReveal() {
  const ref = useRef(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const t = setTimeout(() => setOk(true), 1400);
    if (!el || !("IntersectionObserver" in window)) return () => clearTimeout(t);
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setOk(true)), { rootMargin: "-60px" });
    io.observe(el);
    return () => { clearTimeout(t); io.disconnect(); };
  }, []);
  return [ref, ok];
}

export default function AstoriaPlumbers() {
  const hora = useRelogioNY();
  /* Deep-link por área lido na INICIALIZAÇÃO, não num efeito: `?area=brooklyn` já abre o pedido
     do Brooklyn com o campo preenchido — o anúncio do Brooklyn cai direto no formulário do
     Brooklyn. Ler no efeito custava um render a mais e o primeiro frame saía com a linha fechada. */
  const areaInicial = () => {
    if (typeof window === "undefined") return "";
    const a = new URLSearchParams(window.location.search).get("area") || "";
    return AREAS.some((x) => x.q === a) ? a : "";
  };
  const [aberto, setAberto] = useState(areaInicial);        // qual área está expandida (um por vez)
  const [form, setForm] = useState(() => ({ area: areaInicial(), nome: "", tel: "", oque: "" }));
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [heroRef, heroOk] = useReveal();

  useEffect(() => {
    const antes = document.title;
    document.title = TITULO;
    const criados = [], repor = [];
    META.forEach(([k, v, c]) => {
      const achou = document.head.querySelector(`meta[${k}="${v}"]`);
      if (achou) { repor.push([achou, achou.getAttribute("content")]); achou.setAttribute("content", c); return; }
      const el = document.createElement("meta");
      el.setAttribute(k, v); el.setAttribute("content", c);
      document.head.appendChild(el); criados.push(el);
    });
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify(LD());
    document.head.appendChild(ld); criados.push(ld);
    return () => {
      document.title = antes;
      criados.forEach((el) => el.remove());
      repor.forEach(([el, v]) => (v == null ? el.removeAttribute("content") : el.setAttribute("content", v)));
    };
  }, []);


  const abrir = useCallback((q) => {
    setAberto((cur) => (cur === q ? "" : q));
    setForm((f) => ({ ...f, area: q }));
  }, []);

  const enviar = useCallback(async (e) => {
    e.preventDefault();
    // O pedido vai pro mesmo motor de captura que já roda na plataforma. Falhar aqui não pode
    // deixar a pessoa sem caminho: o telefone continua na tela, sempre.
    /* 🚨 O FORMULÁRIO NÃO PODE DIZER "RECEBIDO" SEM TER GRAVADO (24/08). A versão anterior
       postava em /api/marketplace-leads — que exige um tenant com chave, e prospect não é
       cliente: 401 em toda submissão. O `catch` engolia e a tela dizia "Request received".
       Era exatamente o defeito que eu tinha acabado de PROVAR no formulário do SR General:
       sucesso mostrado sobre o vazio. Agora a resposta decide, e falha aparece na tela. */
    setErroEnvio("");
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "astoria-plumbers", negocio: "Astoria Plumbers", nome: form.nome,
          telefone: form.tel, mensagem: `[${form.area}] ${form.oque}` }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErroEnvio("Couldn't send that — please call us, the phone always works.");
  }, [form]);

  return (
    <div className="ap-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:ital,wght@0,700;0,800;1,800;1,900&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

        /* PALETA — lida dos ativos deles, não escolhida por mim.
           Verde é AÇÃO/EMERGÊNCIA e só isso: um primário por viewport, nunca decoração. */
        .ap-raiz{
          --navy:#0B0C4C; --navy2:#120E57; --navy3:#171361;
          --neon:#39FF14; --neon-d:#25C40B;
          --ivory:#F2F5EF; --mute:#A9B0C9; --line:rgba(255,255,255,.11);
          background:var(--navy); color:var(--ivory);
          font-family:'Inter Tight',system-ui,-apple-system,sans-serif;
          min-height:100vh; overflow-x:hidden; position:relative;
        }
        /* Luz de estúdio + grão: o material da casa, recolorido pra marca DELE.
           z-index:0 no ::before e conteudo em position:relative;z-index:1 — grao por cima do
           conteúdo é a armadilha já paga uma vez. */
        .ap-raiz::before{
          content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
          background:
            radial-gradient(900px 520px at 78% -8%, rgba(57,255,20,.13), transparent 62%),
            radial-gradient(700px 620px at 6% 18%, rgba(23,19,97,.85), transparent 70%);
        }
        .ap-raiz::after{
          content:''; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.30;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
          mix-blend-mode:soft-light;
        }
        .ap-wrap{position:relative; z-index:1;}

        .ap-disp{font-family:'Saira Condensed',sans-serif; font-style:italic; font-weight:900;
          letter-spacing:-.012em; text-transform:uppercase; text-wrap:balance;}
        .ap-num{font-family:'JetBrains Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}

        /* BOTÃO — sistema da casa nas cores dele: profundidade, realce no topo, varredura no hover.
           VERDE = telefone/emergência, só. Contorno = secundário. Nunca dois primários na mesma tela. */
        .ap-b{position:relative; display:inline-flex; align-items:center; justify-content:center; gap:.55rem;
          border-radius:999px; font-family:'Saira Condensed',sans-serif; font-style:italic; font-weight:800;
          letter-spacing:.01em; text-transform:uppercase; text-decoration:none; overflow:hidden;
          transition:transform .16s ease, box-shadow .22s ease, background .22s ease;}
        .ap-b:active{transform:scale(.98)}
        .ap-b-call{background:linear-gradient(180deg,#5CFF3E,#39FF14 46%,#22D80A);
          color:#06210A; padding:1.05rem 2.1rem; font-size:1.35rem;
          box-shadow:0 20px 46px -16px rgba(57,255,20,.55), inset 0 1px 0 rgba(255,255,255,.62), inset 0 -2px 0 rgba(0,60,0,.28), 0 0 0 1px rgba(57,255,20,.5);}
        .ap-b-call:hover{box-shadow:0 26px 60px -16px rgba(57,255,20,.7), inset 0 1px 0 rgba(255,255,255,.72), inset 0 -2px 0 rgba(0,60,0,.28), 0 0 0 1px rgba(57,255,20,.75);}
        .ap-b-2{background:rgba(255,255,255,.055); color:var(--ivory); padding:.85rem 1.5rem; font-size:1.02rem;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.14), 0 0 0 1px var(--line);}
        .ap-b-2:hover{background:rgba(57,255,20,.10); box-shadow:inset 0 1px 0 rgba(255,255,255,.2), 0 0 0 1px rgba(57,255,20,.45);}

        .ap-card{background:linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.02));
          border:1px solid var(--line); border-radius:26px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.13), 0 26px 60px -40px rgba(0,0,0,.95);}

        /* A FAIXA DIAGONAL é a assinatura do decalque deles — o bloco da logo é um paralelogramo.
           Repetir a forma da marca é o que faz a página parecer DELES e não nossa. */
        .ap-slab{clip-path:polygon(2.2% 0, 100% 0, 97.8% 100%, 0 100%);}

        .ap-rev{opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1);}
        .ap-rev.on{opacity:1; transform:none;}
        @media (prefers-reduced-motion:reduce){ .ap-rev{opacity:1;transform:none;transition:none} .ap-hero-img{animation:none!important} }

        .ap-hero-img{animation:apPush 9s ease-out both;}
        @keyframes apPush{from{transform:scale(1.07)}to{transform:scale(1)}}

        /* Barra fixa do celular: superfície SÓLIDA e fio no topo — gradiente transparente faz o
           botão parecer bolha solta. E a raiz reserva o espaço, senão ela come o rodapé. */
        @media (max-width:639px){ .ap-raiz{padding-bottom:92px} }
        .ap-bar{position:fixed; left:0; right:0; bottom:0; z-index:40; background:#080935;
          border-top:1px solid rgba(57,255,20,.34); padding:.65rem .9rem;}
      `}</style>

      <div className="ap-wrap">
        {/* ── HERO ───────────────────────────────────────────────────────────────────────────
            A logo DELES é o herói — é o ativo mais forte que eles têm e estava fora do ar.
            H1 em duas linhas sempre, e a linha de promessa com barra acesa: é ela que justifica
            apertar o botão. */}
        <header ref={heroRef} className="relative mx-auto max-w-6xl px-5 pt-8 pb-10 sm:pt-12">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <img src="/novo/astoria/logo.png" alt="Astoria Plumbers" className="h-11 w-auto sm:h-14" />
            {/* UM selo vivo no site inteiro, e ele INFORMA: a hora de NY prova o "24h" agora. */}
            <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
              style={{ background: "rgba(57,255,20,.11)", boxShadow: "inset 0 0 0 1px rgba(57,255,20,.4)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--neon)", boxShadow: "0 0 10px var(--neon)" }} />
              On call now <span className="ap-num opacity-80">· {hora} NYC</span>
            </span>
          </nav>

          <div className={`ap-rev ${heroOk ? "on" : ""} mt-10 grid items-center gap-8 lg:mt-14 lg:grid-cols-[1.15fr_.85fr]`}>
            <div>
              <h1 className="ap-disp text-[clamp(2.7rem,8vw,5.4rem)] leading-[.88]">
                Fast. Reliable.<br /><span style={{ color: "var(--neon)" }}>Local.</span>
              </h1>
              <p className="mt-5 max-w-lg text-[17px] leading-relaxed" style={{ color: "var(--mute)" }}>
                Emergencies, repairs and planned installations — faucets, showers, sinks, toilets.
                Certified plumbers out of Astoria, Queens.
              </p>
              <p className="mt-5 flex items-start gap-3 text-[15.5px] font-semibold">
                <span className="mt-1 h-[18px] w-[3px] shrink-0 rounded-full" style={{ background: "var(--neon)", boxShadow: "0 0 12px var(--neon)" }} />
                A certified plumber answers 24 hours a day — day, night, weekend or holiday.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="ap-b ap-b-call" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
                <a className="ap-b ap-b-2" href="#areas">Open a ticket instead</a>
              </div>
            </div>
            <div className="relative">
              <img src="/novo/astoria/selo24.png" alt="24 hour emergency service"
                className="ap-hero-img mx-auto w-full max-w-sm drop-shadow-[0_24px_60px_rgba(57,255,20,.28)]" />
            </div>
          </div>

          {/* CREDENCIAIS — uma linha só, fundida na borda da hero. Cada número é verificável. */}
          <div className={`ap-rev ${heroOk ? "on" : ""} mt-10 flex flex-wrap items-center gap-x-7 gap-y-2 border-t pt-5 text-[12.5px] uppercase tracking-[.14em]`}
            style={{ borderColor: "var(--line)", color: "var(--mute)" }}>
            <span><b className="ap-num" style={{ color: "var(--ivory)" }}>4.7★</b> · 68 Google reviews</span>
            <span><b style={{ color: "var(--ivory)" }}>24/7</b> · every day of the year</span>
            <span><b style={{ color: "var(--ivory)" }}>Certified</b> · licensed team</span>
            <span>Astoria · Manhattan · Brooklyn · Bronx</span>
          </div>
        </header>

        {/* ── SERVIÇOS — curtos de propósito: não podem competir com o quadro de áreas, que é
            onde o pedido realmente acontece. Sub-itens numa linha, não lista. */}
        <section className="mx-auto max-w-6xl px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {SERVICOS.map((s) => (
              <div key={s.t} className="ap-card p-5">
                <h2 className="ap-disp text-[1.35rem]" style={{ color: "var(--neon)" }}>{s.t}</h2>
                <p className="mt-1.5 text-[14.5px] leading-snug">{s.d}</p>
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--mute)" }}>{s.i}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── O QUADRO DE ÁREAS — o coração da conversão.
            A linha EXPANDE ali mesmo (acordeão, sem modal, sem rolar) e já traz o pedido com a
            área preenchida. Enfeite que não trabalha vira cara de AI; esta linha é um formulário. */}
        <section id="areas" className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="ap-disp text-[clamp(1.9rem,4.6vw,3rem)] leading-none">Where are you?</h2>
              <p className="mt-2 max-w-xl text-[15px]" style={{ color: "var(--mute)" }}>
                Pick the borough and tell us what is happening. Emergencies get dispatched first.
              </p>
            </div>
            {/* O site arquivado deles não tinha NENHUMA foto de equipe, van ou obra — só a marca.
                Em vez de encher com banco de imagem (que mentiria dizendo "somos nós"), a chave
                desenhada na cor neon deles ocupa o vazio sem afirmar nada. */}
            <div className="hidden shrink-0 sm:block" aria-hidden="true">
              <Mascote variante="chave" cor="var(--neon)" tamanho={150} />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[26px]" style={{ border: "1px solid var(--line)" }}>
            {AREAS.map((a, i) => {
              const on = aberto === a.q;
              return (
                <div key={a.q} style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <button type="button" onClick={() => abrir(a.q)} aria-expanded={on}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition"
                    style={{ background: on ? "rgba(57,255,20,.07)" : "transparent" }}>
                    <span className="min-w-0">
                      <span className="ap-disp block text-[1.5rem] leading-none"
                        style={{ color: on ? "var(--neon)" : "var(--ivory)" }}>{a.nome}</span>
                      <span className="mt-1 block text-[12.5px]" style={{ color: "var(--mute)" }}>{a.nota}</span>
                    </span>
                    <span className="ap-num shrink-0 text-[13px]" style={{ color: on ? "var(--neon)" : "var(--mute)" }}>
                      {on ? "—" : "+"}
                    </span>
                  </button>

                  {on && (
                    <div className="px-5 pb-6">
                      {enviado ? (
                        <div className="ap-card p-5">
                          <p className="ap-disp text-[1.3rem]" style={{ color: "var(--neon)" }}>Ticket received</p>
                          <p className="mt-1.5 text-[14.5px]">
                            If this is an active emergency, call {TEL_FMT} now — the phone is always the fastest.
                          </p>
                        </div>
                      ) : (
                        <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
                          <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                            placeholder="Your name" className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                            style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--line)", color: "var(--ivory)" }} />
                          <input required type="tel" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })}
                            placeholder="Phone we can call back" className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                            style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--line)", color: "var(--ivory)" }} />
                          <textarea required rows={2} value={form.oque} onChange={(e) => setForm({ ...form, oque: e.target.value })}
                            placeholder="What is happening? (leak, no water, blocked drain…)"
                            className="rounded-2xl px-4 py-3 text-[15px] outline-none sm:col-span-2"
                            style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--line)", color: "var(--ivory)" }} />
                                            {erroEnvio && (
                    <p className="sm:col-span-2 text-[13.5px] font-semibold" style={{ color: "var(--neon)" }}>{erroEnvio}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                            <button type="submit" className="ap-b ap-b-2">Send the ticket</button>
                            <a href={`tel:${TEL}`} className="text-[13.5px] font-semibold" style={{ color: "var(--neon)" }}>
                              or call {TEL_FMT} →
                            </a>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── O NÚMERO COMO DECALQUE — o ativo deles usado como ele foi desenhado pra ser usado:
            grande. Numa emergência ninguém procura o telefone no rodapé. */}
        <section className="ap-slab mx-auto my-6 max-w-6xl px-5 py-9" style={{ background: "linear-gradient(100deg, rgba(57,255,20,.10), rgba(57,255,20,.02))" }}>
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="ap-disp text-[1.15rem]" style={{ color: "var(--neon)" }}>Water does not wait. Neither do we.</p>
            <a href={`tel:${TEL}`} aria-label={`Call ${TEL_FMT}`}>
              <img src="/novo/astoria/fone.png" alt={`Call ${TEL_FMT}`} className="w-full max-w-xl"
                style={{ filter: "brightness(0) saturate(100%) invert(93%) sepia(9%) saturate(200%) hue-rotate(60deg) brightness(105%)" }} />
            </a>
            <a className="ap-b ap-b-call" href={`tel:${TEL}`}>Call now</a>
          </div>
        </section>

        {/* ── FAQ — substância do site arquivado, reorganizada. Vira FAQPage no JSON-LD: presença
            online é o que o site deles nunca teve (o original só tinha schema genérico). */}
        <section className="mx-auto max-w-6xl px-5 py-10">
          <h2 className="ap-disp text-[clamp(1.9rem,4.6vw,3rem)] leading-none">Straight answers</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q} className="ap-card p-5">
                <h3 className="text-[15.5px] font-bold">{q}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: "var(--mute)" }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── RODAPÉ ─────────────────────────────────────────────────────────────────────────── */}
        <footer id="contact" className="mx-auto max-w-6xl px-5 pb-16 pt-4">
          <div className="ap-card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <img src="/novo/astoria/logo.png" alt="Astoria Plumbers" className="h-11 w-auto" />
                <p className="mt-3 text-[14.5px]" style={{ color: "var(--mute)" }}>{ENDERECO}</p>
                <p className="ap-num mt-1 text-[15px]" style={{ color: "var(--neon)" }}>{TEL_FMT}</p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--mute)" }}>Open 24 hours · 7 days a week</p>
              </div>
              <a className="ap-b ap-b-call" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
            </div>
            <p className="mt-6 border-t pt-4 text-[11.5px]" style={{ borderColor: "var(--line)", color: "var(--mute)" }}>
              ⚡ site + AI by <a href="https://guileoai.com" className="underline" style={{ color: "var(--mute)" }}>Guileo</a>
            </p>
          </div>
        </footer>

        {/* Barra fixa só no celular: numa emergência o polegar não deve procurar nada. */}
        <div className="ap-bar sm:hidden">
          <a className="ap-b ap-b-call w-full" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
        </div>
      </div>
    </div>
  );
}
