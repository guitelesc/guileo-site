/* URBAN STANDARD — urbanstandard.nyc reconstruído
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   O QUE ESTÁ QUEBRADO NO SITE DELES (medido, não suposto — 2026-08-24):
     tel: links .......... 0   o (718) 669-0526 é TEXTO PURO. No celular não disca.
     mailto: ............. 0   a página "HIRE US" diz «o time vai revisar seu e-mail» — e não
                              oferece nenhum jeito de mandar um.
     formulários ......... 0
     altura da home ...... 7.283px de portfólio antes de qualquer pedido
   Um contratante de alto padrão com 5,0★ e 16 avaliações, dois escritórios e um portfólio
   fotografado em nível MLS — e nenhuma porta que abra.

   IDENTIDADE (é DELES, extraída dos ativos reais):
     • a logo é um VOLUME construído partido em duas faces: âmbar #FBB856 e azul #2983C7,
       assentado sobre uma curva preta. Essas duas cores são a espinha da página inteira.
     • a tipografia deles é Montserrat (o CSS do site declara 20×). Fica.
     • 12 fotos reais do portfólio, baixadas e validadas por mime — gesso branco, carvalho,
       mosaico de mármore, moldura de brownstone. Nenhuma imagem de banco. Nenhuma inventada.

   O CONCEITO (do mundo DELES, não um tema pronto): a PRANCHA DE PROJETO.
   Eles dizem no próprio site que trabalham «diretamente com equipes de design e arquitetura» —
   então a página fala a língua que o cliente deles já lê: folha numerada, carimbo, linha de cota,
   marcador de corte. As cotas dizem fatos REAIS (2 escritórios, 5,0★, desde 2019). O marcador de
   corte não é enfeite: é o seletor de escopo, e ele filtra a folha de fotos E já preenche o
   pedido. As duas faces da logo viram os dois lados do trabalho: âmbar = o ANTES que chega,
   azul = o DEPOIS que sai.
*/
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+17186690526";
const TEL_FMT = "(718) 669-0526";
const EMAIL = "info@urbanstandard.nyc";
const BROOKLYN = "55 Prospect Street #406, Brooklyn, NY 11201";
const MANHATTAN = "245 W 29th Street #601, New York, NY 10001";
const IG = "https://www.instagram.com/urbanstandardnyc/";
const B = "/novo/urban-standard";

/* Os 4 escopos são os DELES, na ordem em que a home deles apresenta. Cada um aponta para as fotos
   reais daquele tipo de obra — nenhuma foto aparece num escopo que ela não é. */
const ESCOPOS = [
  { id: "kitchens", n: "A-101", rot: "Kitchens", fotos: ["kitchen", "kitchen-steel"],
    d: "Open plans, stone counters, appliance walls that disappear into the millwork." },
  { id: "baths", n: "A-102", rot: "Bathrooms", fotos: ["bath-mosaic", "bath-vanity"],
    d: "Marble mosaic, radius walls, fixtures set to the millimetre." },
  { id: "living", n: "A-103", rot: "Living spaces", fotos: ["ceiling", "moulding", "nook", "bedroom", "blue-room", "office"],
    d: "Coffered ceilings, restored plaster moulding, rooms that read as one." },
  { id: "retail", n: "A-104", rot: "Retail spaces", fotos: ["retail", "retail2"],
    d: "Storefronts and fit-outs built around how the floor actually sells." },
];

/* Legenda honesta de cada foto: o que ela mostra, não adjetivo de catálogo.
   ⚠️ Estas legendas foram escritas ABRINDO cada arquivo entregue, uma por uma. A primeira versão
   nomeou as fotos pela posição numa folha de contato e 5 das 12 saíram trocadas — legenda de
   cozinha embaixo de um banheiro. Numa página de portfólio isso não é um detalhe: é o dono
   perdendo a confiança de quem estava prestes a ligar. */
const LEGENDA = {
  kitchen: "Kitchen opened to the living room — island seating, window wall kept",
  "kitchen-steel": "Stainless island and full-height cabinetry, Manhattan apartment",
  "bath-mosaic": "Marble mosaic floor running under a radius tub surround",
  "bath-vanity": "Floating oak vanity, freestanding tub, mirrored cabinet wall",
  "blue-room": "Textured wall panel framing the room beyond",
  ceiling: "Coffered ceiling and cabinetry restored around the original fixture",
  moulding: "Plaster cornice and crown — restored, not replaced",
  nook: "Banquette nook built into the corner, marble underfoot",
  bedroom: "Bedroom with fitted wardrobes and patterned closet fronts",
  office: "Steel-and-glass partition dividing office from living space",
  retail: "Retail fit-out — oak floor, open rail plan, street-facing display",
  retail2: "Storefront interior, lighting set to the merchandising line",
};

/* Depoimentos REAIS publicados na home deles. Nada reescrito, nada inventado. */
const DIZEM = [
  ["The end result is a home we LOVE.", "Kelly C."],
  ["They are reliable, communicative and so clean! My neighbors loved them. True pros.", "Lisa S."],
  ["Urban Standard is unparalleled when it comes to communication.", "Tobi W."],
  ["Up front, on time, and careful. Loved the finished product.", "Ted G."],
  ["Completed with care and attention to detail, and on budget.", "Ted S."],
  ["I don't hesitate to have Urban Standard build anything I design.", "Andrew H."],
  ["I highly recommend David and his team.", "Joaquin R."],
  ["To this day I still tell people how fantastic you were.", "Katie C."],
  ["We have had nothing but first rate experiences with you and your team.", "Lauren G."],
  ["We couldn't have been happier. They're competent, highly professional and do excellent work.", "Noah K."],
  ["It's not only about the amazing results, it's also about the easy journey getting there.", "Brian L."],
];

const FAQ = [
  ["Do you work with my architect or designer?",
    "Yes — that is the normal way we work. Urban Standard executes your design team's plan, and brings in a design team of its own when a project needs full design & build."],
  ["Residential or commercial?",
    "Both. Custom residential renovations and commercial fit-outs across New York City — brownstones, high-rise apartments, retail."],
  ["Are you licensed and insured?",
    "Licensed and insured general contracting, with offices in Brooklyn and Manhattan."],
  ["How does a project start?",
    "Send the scope through this page or call (718) 669-0526. We review it, assess the scope of work, and walk through the project with you."],
];

const SITE_URL = "https://guileoai.com/novo/urban-standard";
const TITULO = "Urban Standard — General Contractor, Brooklyn & Manhattan";
const DESC = "Licensed and insured general contracting for New York City — custom residential renovations, brownstones, high-rise apartments and retail fit-outs. Works directly with your architect. Call (718) 669-0526.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["property", "og:image", `https://guileoai.com${B}/kitchen.jpg`],
  ["name", "twitter:card", "summary_large_image"],
];
/* PRESENÇA: o site atual tem schema de Squarespace genérico. `GeneralContractor` é o tipo que
   existe no schema.org e é o que faz aparecer numa busca por empreiteiro em NY — com os DOIS
   endereços, que hoje só existem como texto no rodapé. */
const LD = () => ([
  { "@context": "https://schema.org", "@type": "GeneralContractor",
    name: "Urban Standard", url: SITE_URL, telephone: TEL, email: EMAIL,
    image: `https://guileoai.com${B}/logo.webp`,
    slogan: "For the built environment",
    description: DESC,
    address: [
      { "@type": "PostalAddress", streetAddress: "55 Prospect Street #406", addressLocality: "Brooklyn", addressRegion: "NY", postalCode: "11201", addressCountry: "US" },
      { "@type": "PostalAddress", streetAddress: "245 W 29th Street #601", addressLocality: "New York", addressRegion: "NY", postalCode: "10001", addressCountry: "US" },
    ],
    areaServed: { "@type": "City", name: "New York City" },
    aggregateRating: { "@type": "AggregateRating", ratingValue: "5.0", reviewCount: "16" },
    sameAs: [IG, "https://urbanstandard.nyc"],
    knowsAbout: ESCOPOS.map((e) => e.rot),
  },
  { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
]);

export default function UrbanStandard() {
  const [escopo, setEscopo] = useState("living");
  const [form, setForm] = useState({ nome: "", tel: "", email: "", escopo: "", oque: "" });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [hora, setHora] = useState({ rel: "", util: false, emitido: "" });
  const [aberto, setAberto] = useState(null);
  const pedido = useRef(null);

  /* O DADO VIVO: hora de NY + se o escritório está de portas abertas agora. Real, calculado —
     nunca um número escrito à mão. É a linha do carimbo que prova a folha viva.
     Tudo sai do MESMO tick: se a hora e o "aberto" viessem de relógios diferentes, o selo podia
     dizer "fechado" ao lado de um horário comercial — um desmentindo o outro na mesma linha. */
  useEffect(() => {
    const tick = () => {
      const f = (o) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...o }).format(new Date());
      const h = Number(f({ hour: "numeric", hour12: false }));
      setHora({
        rel: f({ hour: "numeric", minute: "2-digit", hour12: true }),
        util: !["Sat", "Sun"].includes(f({ weekday: "short" })) && h >= 8 && h < 17,
        emitido: f({ month: "short", day: "2-digit", year: "numeric" }).toUpperCase(),
      });
    };
    tick(); const id = setInterval(tick, 20000); return () => clearInterval(id);
  }, []);

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
    ld.type = "application/ld+json"; ld.textContent = JSON.stringify(LD());
    document.head.appendChild(ld); criados.push(ld);
    return () => {
      document.title = antes;
      criados.forEach((el) => el.remove());
      repor.forEach(([el, v]) => (v == null ? el.removeAttribute("content") : el.setAttribute("content", v)));
    };
  }, []);

  /* O marcador de corte é enfeite que TRABALHA: escolher o escopo troca a folha de fotos E já
     deixa o pedido preenchido. Detalhe com função vale mais que detalhe bonito. */
  const escolher = useCallback((id) => {
    setEscopo(id);
    const e = ESCOPOS.find((x) => x.id === id);
    if (e) setForm((f) => ({ ...f, escopo: e.rot }));
  }, []);

  const enviar = useCallback(async (e) => {
    e.preventDefault();
    setErroEnvio("");
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "urban-standard", negocio: "Urban Standard",
          nome: form.nome, telefone: form.tel, email: form.email,
          mensagem: `[${form.escopo || "scope not stated"}] ${form.oque}` }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErroEnvio("That didn't send. Call (718) 669-0526 or email info@urbanstandard.nyc — both reach the same desk.");
  }, [form]);

  const atual = ESCOPOS.find((e) => e.id === escopo) || ESCOPOS[2];

  return (
    <div className="us-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Inter+Tight:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .us-raiz{
          /* As duas faces do volume da logo deles. Nada foi "harmonizado" — são os hex reais. */
          --ambar:#FBB856; --ambar-e:#E09327;
          --azul:#2983C7; --azul-e:#1D76BD;
          --tinta:#131313; --tinta2:#4A4A48;
          --gesso:#F3F1EC; --papel:#FFFFFF; --linha:#D9D4C8;
          --prancha:#141517; --prancha2:#1D1F23; --prancha-t:#B9B5AA;
          background:var(--gesso); color:var(--tinta); min-height:100vh;
          font-family:'Inter Tight',system-ui,-apple-system,sans-serif;
          -webkit-font-smoothing:antialiased;
        }
        .us-disp{font-family:'Montserrat',system-ui,sans-serif; font-weight:800; letter-spacing:-.015em;}
        .us-mono{font-family:'IBM Plex Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}
        /* O CARIMBO: letra pequena, travada, espaçada — a etiqueta de prancha. */
        .us-car{font-family:'IBM Plex Mono',monospace; font-size:10.5px; font-weight:600;
          letter-spacing:.2em; text-transform:uppercase;}

        /* FOLHA: o papel com a marca d'água de canto do desenho técnico. */
        .us-folha{background:var(--papel); border:1px solid var(--linha); border-radius:22px;
          position:relative; overflow:hidden;
          box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 18px 44px -30px rgba(19,19,19,.5);}
        /* marca de canto (crop mark) — dois fios finos, um de cada cor da logo */
        .us-folha::before{content:''; position:absolute; left:0; top:0; width:64px; height:2px;
          background:var(--ambar); }
        .us-folha::after{content:''; position:absolute; left:0; top:0; width:2px; height:64px;
          background:var(--azul); }

        /* BOTÕES — 3 espécies, e o telefone é o de ação, porque é o que eles não tinham. */
        .us-b{display:inline-flex; align-items:center; gap:.55rem; border-radius:999px;
          font-family:'Montserrat',sans-serif; font-weight:700; font-size:15px; letter-spacing:.01em;
          padding:14px 26px; text-decoration:none; cursor:pointer; border:1px solid transparent;
          transition:transform .12s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;}
        .us-b:active{transform:scale(.985);}
        .us-b-1{background:linear-gradient(180deg,#FFC873,var(--ambar) 52%,var(--ambar-e));
          color:#241703; box-shadow:0 1px 0 rgba(255,255,255,.6) inset, 0 10px 26px -14px rgba(224,147,39,.9);}
        .us-b-1:hover{box-shadow:0 1px 0 rgba(255,255,255,.6) inset, 0 14px 30px -12px rgba(224,147,39,1);}
        .us-b-2{background:linear-gradient(180deg,#4098D6,var(--azul) 52%,var(--azul-e)); color:#fff;
          box-shadow:0 1px 0 rgba(255,255,255,.28) inset, 0 10px 26px -14px rgba(29,118,189,.85);}
        .us-b-3{background:var(--papel); color:var(--tinta); border-color:var(--linha);}
        .us-b-3:hover{border-color:var(--tinta); }

        /* MARCADOR DE CORTE — o símbolo de seção do desenho, virado botão de escopo. */
        .us-marc{display:flex; align-items:center; gap:.85rem; width:100%; text-align:left;
          padding:14px 16px; background:transparent; border:0; cursor:pointer;
          transition:background .18s ease;}
        .us-marc:hover{background:rgba(41,131,199,.05);}
        .us-marc[data-on="1"]{background:rgba(251,184,86,.12);}
        .us-bolha{width:42px; height:42px; flex:0 0 auto; border-radius:999px;
          border:1.5px solid var(--linha); display:grid; place-items:center;
          font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:600; color:var(--tinta2);
          transition:border-color .18s ease, color .18s ease, background .18s ease;}
        .us-marc[data-on="1"] .us-bolha{border-color:var(--ambar-e); background:var(--ambar); color:#241703;}

        /* A LINHA DE COTA — extensão + seta, exatamente como na prancha. Diz FATO, não enfeite. */
        .us-cota{display:flex; align-items:center; gap:.6rem; color:var(--prancha-t);}
        .us-cota i{flex:1 1 auto; height:1px; background:currentColor; opacity:.55; position:relative;}
        .us-cota i::before,.us-cota i::after{content:''; position:absolute; top:-4px; width:1px;
          height:9px; background:currentColor;}
        .us-cota i::before{left:0;} .us-cota i::after{right:0;}

        .us-foto{width:100%; height:100%; object-fit:cover; display:block;}
        .us-inp{width:100%; border-radius:16px; border:1px solid var(--linha); background:var(--papel);
          padding:13px 16px; font-size:15px; outline:none; color:var(--tinta);
          transition:border-color .18s ease, box-shadow .18s ease;}
        .us-inp:focus{border-color:var(--azul); box-shadow:0 0 0 3px rgba(41,131,199,.14);}
        .us-inp::placeholder{color:#9C9A93;}

        /* o desenho da hero é traçado uma vez, como quem passa a caneta. */
        @keyframes us-tracar{from{stroke-dashoffset:var(--l);} to{stroke-dashoffset:0;}}
        .us-tracado{stroke-dasharray:var(--l); animation:us-tracar 1.5s .25s ease-out both;}
        @media (prefers-reduced-motion:reduce){ .us-tracado{animation:none; stroke-dashoffset:0;} }
      `}</style>

      {/* ── CABEÇALHO: a logo REAL deles, e o telefone que hoje não é clicável em lugar nenhum. */}
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 pb-2 pt-6">
        <img src={`${B}/logo.webp`} alt="Urban Standard" width="349" height="69"
          className="h-[38px] w-auto sm:h-[44px]" />
        <div className="flex items-center gap-3">
          <a href={`tel:${TEL}`} className="us-b us-b-1">Call {TEL_FMT}</a>
        </div>
      </header>

      {/* ── FOLHA A-100: a capa. Foto real deles sob a prancha. */}
      <section className="mx-auto max-w-6xl px-5 pt-3">
        <div className="us-folha">
          <div className="grid lg:grid-cols-[1.02fr_.98fr]">
            <div className="order-2 p-6 sm:p-9 lg:order-1">
              <div className="us-car" style={{ color: "var(--azul-e)" }}>Sheet A-100 · Cover</div>
              <h1 className="us-disp mt-3 text-[clamp(2.1rem,5.4vw,3.5rem)] leading-[1.02]">
                The <span style={{ color: "var(--ambar-e)" }}>before</span> is a brownstone
                or a high-rise.<br />
                The <span style={{ color: "var(--azul-e)" }}>after</span> is built to suit.
              </h1>
              <p className="mt-4 max-w-lg text-[16.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Urban Standard is a licensed and insured general contractor working across New York
                City — custom residential renovations and commercial fit-outs, executed with your
                architect or with a design team of ours.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href={`tel:${TEL}`} className="us-b us-b-1">Call {TEL_FMT}</a>
                <button type="button" className="us-b us-b-2"
                  onClick={() => pedido.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  Send the scope
                </button>
              </div>
              {/* A cota diz um FATO. Nunca um número decorativo. */}
              <div className="us-cota us-mono mt-7 text-[11px] uppercase tracking-[.14em]"
                style={{ color: "var(--tinta2)" }}>
                <span>Brooklyn</span><i /><span>Manhattan</span>
              </div>
            </div>

            <div className="relative order-1 min-h-[280px] lg:order-2">
              <img src={`${B}/kitchen.jpg`} alt="Kitchen opened to the living room, built by Urban Standard"
                className="us-foto absolute inset-0" loading="eager" />
              {/* O DESENHO POR CIMA DA FOTO — cotas e marcador de corte, nas duas cores da logo.
                  É o que faz a hero parecer uma prancha e não um banner de banco de imagem. */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 600 460"
                preserveAspectRatio="none" aria-hidden="true">
                {/* Cota de verdade: linha de chamada, extensão com tique nas duas pontas, e o
                    marcador de corte (o círculo com o número da folha) — o símbolo que qualquer
                    arquiteto lê de imediato. Traçado uma vez, como quem passa a caneta. */}
                <g fill="none" strokeLinecap="round" opacity=".95">
                  <g stroke="#E09327" strokeWidth="2">
                    <path className="us-tracado" style={{ "--l": 300 }} d="M44 34v26M212 34v26" />
                    <path className="us-tracado" style={{ "--l": 300 }} d="M44 47h168" />
                  </g>
                  <g stroke="#1D76BD" strokeWidth="2">
                    <path className="us-tracado" style={{ "--l": 300 }} d="M556 426v-26M388 426v-26" />
                    <path className="us-tracado" style={{ "--l": 300 }} d="M556 413H388" />
                  </g>
                  <circle className="us-tracado" style={{ "--l": 120 }} cx="556" cy="47" r="17"
                    stroke="#E09327" strokeWidth="2" />
                  <path className="us-tracado" style={{ "--l": 60 }} d="M556 64v34" stroke="#E09327" strokeWidth="2" />
                </g>
                <text x="556" y="52" textAnchor="middle" fill="#E09327"
                  style={{ font: "600 15px 'IBM Plex Mono',monospace", letterSpacing: ".04em" }}>A1</text>
              </svg>
            </div>
          </div>

          {/* CARIMBO — fundido na base da folha, como o title block da prancha de verdade.
              Uma linha só, com o único selo VIVO do site inteiro. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t px-6 py-3.5"
            style={{ borderColor: "var(--linha)", background: "var(--prancha)" }}>
            {[["Licensed & insured", null], ["Residential & commercial", null],
              ["Works with your architect", null], ["5.0 ★ · 16 reviews", "var(--ambar)"]].map(([t, c]) => (
              <span key={t} className="us-car" style={{ color: c || "var(--prancha-t)" }}>{t}</span>
            ))}
            <span className="us-car ml-auto flex items-center gap-2" style={{ color: "#fff" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: hora.util ? "#5BD98A" : "var(--ambar)" }} />
              {hora.util ? "Office open" : "After hours"} · {hora.rel} NYC
            </span>
          </div>
        </div>
      </section>

      {/* ── FOLHA A-101…104: o escopo. O marcador de corte escolhe, a folha de fotos obedece,
          e o pedido já sai preenchido. */}
      <section id="scope" className="mx-auto max-w-6xl px-5 py-9">
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="us-folha p-2">
            <div className="us-car px-4 pb-1 pt-3" style={{ color: "var(--tinta2)" }}>Scope of work</div>
            {ESCOPOS.map((e) => (
              <button key={e.id} type="button" className="us-marc" data-on={e.id === escopo ? "1" : "0"}
                onClick={() => escolher(e.id)} aria-pressed={e.id === escopo}>
                <span className="us-bolha">{e.n.replace("A-", "")}</span>
                <span className="min-w-0">
                  <span className="us-disp block text-[17px] leading-tight">{e.rot}</span>
                  <span className="us-mono block text-[11px] uppercase tracking-[.13em]" style={{ color: "var(--tinta2)" }}>
                    {e.fotos.length} on file
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="us-folha overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 pb-1 pt-5">
              <h2 className="us-disp text-[clamp(1.5rem,3.4vw,2.1rem)] leading-tight">{atual.rot}</h2>
              <span className="us-car" style={{ color: "var(--azul-e)" }}>Sheet {atual.n}</span>
            </div>
            <p className="max-w-2xl px-6 text-[15.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{atual.d}</p>
            <div className="mt-5 grid gap-px sm:grid-cols-2" style={{ background: "var(--linha)" }}>
              {atual.fotos.map((f) => (
                <figure key={f} className="relative bg-white">
                  <div className="aspect-[4/3]">
                    <img src={`${B}/${f}.jpg`} alt={LEGENDA[f]} className="us-foto" loading="lazy" />
                  </div>
                  <figcaption className="px-4 py-3 text-[13px] leading-snug" style={{ color: "var(--tinta2)" }}>
                    {LEGENDA[f]}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 px-6 py-5">
              <button type="button" className="us-b us-b-2"
                onClick={() => { escolher(atual.id); pedido.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                Start a {atual.rot.toLowerCase().replace(/s$/, "")} project
              </button>
              <span className="text-[13.5px]" style={{ color: "var(--tinta2)" }}>
                Takes the scope with it — you only add the detail.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOLHA A-105: o que os clientes dizem. Publicado por eles, palavra por palavra. */}
      <section className="mx-auto max-w-6xl px-5 pb-9">
        <div className="us-folha p-6 sm:p-8">
          <div className="us-car" style={{ color: "var(--azul-e)" }}>Sheet A-105 · On record</div>
          <h2 className="us-disp mt-2 text-[clamp(1.6rem,3.8vw,2.3rem)] leading-tight">
            Eleven clients wrote this down.
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DIZEM.map(([t, q]) => (
              <blockquote key={q} className="rounded-2xl border p-4"
                style={{ borderColor: "var(--linha)", background: "var(--gesso)" }}>
                <div className="text-[15px] leading-relaxed">“{t}”</div>
                <cite className="us-mono mt-2 block text-[11.5px] not-italic uppercase tracking-[.14em]"
                  style={{ color: "var(--ambar-e)" }}>— {q}</cite>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOLHA A-106: o pedido. É a folha que o site deles não tem. */}
      <section ref={pedido} id="hire" className="mx-auto max-w-6xl px-5 pb-9">
        <div className="us-folha p-6 sm:p-8">
          <div className="us-car" style={{ color: "var(--azul-e)" }}>Sheet A-106 · Hire us</div>
          <h2 className="us-disp mt-2 text-[clamp(1.7rem,4vw,2.5rem)] leading-tight">
            Send the scope. We come back with the walk-through.
          </h2>
          <p className="mt-2 max-w-2xl text-[16px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
            The team reviews what you send, assesses the scope of work, and reaches out to walk
            through the project with you. Prefer the phone? {TEL_FMT} reaches the same desk.
          </p>

          {enviado ? (
            <div className="mt-6 rounded-2xl px-5 py-4"
              style={{ background: "rgba(41,131,199,.08)", border: "1px solid rgba(41,131,199,.3)" }}>
              <div className="us-disp text-[18px]" style={{ color: "var(--azul-e)" }}>Scope received.</div>
              <p className="mt-1 text-[15px]" style={{ color: "var(--tinta2)" }}>
                Someone will reach out to walk through it. If it is time-sensitive, call {TEL_FMT}.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} className="mt-6 grid gap-3 sm:grid-cols-2">
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Your name" className="us-inp" />
              <input required type="tel" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })}
                placeholder="Phone" className="us-inp" />
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email (optional)" className="us-inp" />
              <select value={form.escopo} onChange={(e) => setForm({ ...form, escopo: e.target.value })}
                className="us-inp" style={{ color: form.escopo ? "var(--tinta)" : "#9C9A93" }}>
                <option value="">Scope of work</option>
                {ESCOPOS.map((e) => <option key={e.id}>{e.rot}</option>)}
                <option>Full apartment or brownstone</option>
                <option>Something else</option>
              </select>
              <textarea required rows={3} value={form.oque} onChange={(e) => setForm({ ...form, oque: e.target.value })}
                placeholder="What are we building? Address, rough size, whether drawings exist, and your timeline."
                className="us-inp sm:col-span-2" />
              {erroEnvio && (
                <p className="sm:col-span-2 text-[13.5px] font-semibold" style={{ color: "#B3261E" }}>{erroEnvio}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <button type="submit" className="us-b us-b-2">Send the scope</button>
                <a href={`mailto:${EMAIL}`} className="text-[14px] font-semibold" style={{ color: "var(--azul-e)" }}>
                  or email {EMAIL}
                </a>
              </div>
            </form>
          )}

          <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--linha)" }}>
            <div className="us-car" style={{ color: "var(--tinta2)" }}>Common questions</div>
            <div className="mt-3">
              {FAQ.map(([q, a], i) => (
                <div key={q} style={{ borderTop: i ? "1px solid var(--linha)" : "none" }}>
                  <button type="button" onClick={() => setAberto(aberto === q ? null : q)}
                    aria-expanded={aberto === q}
                    className="flex w-full items-center justify-between gap-4 py-3.5 text-left">
                    <span className="text-[15.5px] font-semibold">{q}</span>
                    <span className="us-mono text-[17px]" style={{ color: "var(--ambar-e)" }}>{aberto === q ? "−" : "+"}</span>
                  </button>
                  {aberto === q && (
                    <p className="pb-4 text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CARIMBO FINAL: os dois escritórios, que hoje são texto solto no rodapé deles. */}
      <footer id="contact" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="us-folha overflow-hidden" style={{ background: "var(--prancha)", borderColor: "#2A2D32" }}>
          <div className="grid gap-6 p-7 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <img src={`${B}/logo.webp`} alt="Urban Standard" width="305" height="60"
                className="h-[34px] w-auto" style={{ filter: "brightness(0) invert(1)" }} />
              <div className="us-car mt-3" style={{ color: "var(--ambar)" }}>For the built environment</div>
            </div>
            {[["Brooklyn", BROOKLYN], ["Manhattan", MANHATTAN]].map(([c, e]) => (
              <div key={c}>
                <div className="us-car" style={{ color: "var(--prancha-t)" }}>{c}</div>
                <div className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: "#EDEAE3" }}>{e}</div>
              </div>
            ))}
            <div>
              <div className="us-car" style={{ color: "var(--prancha-t)" }}>Reach us</div>
              <a href={`tel:${TEL}`} className="us-disp mt-1.5 block text-[19px]" style={{ color: "var(--ambar)" }}>{TEL_FMT}</a>
              <a href={`mailto:${EMAIL}`} className="mt-1 block text-[14px]" style={{ color: "#EDEAE3" }}>{EMAIL}</a>
              <a href={IG} target="_blank" rel="noreferrer" className="mt-1 block text-[14px]" style={{ color: "var(--azul)" }}>Instagram</a>
            </div>
          </div>
          <div className="us-car flex flex-wrap items-center justify-between gap-3 border-t px-7 py-3.5"
            style={{ borderColor: "#2A2D32", color: "var(--prancha-t)" }}>
            <span>Urban Standard · Licensed &amp; insured · New York City</span>
            <span>Issued {hora.emitido}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
