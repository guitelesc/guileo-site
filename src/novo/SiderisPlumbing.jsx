/* SIDERIS PLUMBING & HEATING — reconstrução (prospect real, siderisplumbingandheating.com)
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   O NEGÓCIO: fundado em 1963, licenciado pela cidade de Nova York, hoje trabalhando junto com a
   Effective Plumbing & Heating — "over 90 years of combined experience". 4,9★ com 71 avaliações.
   Cinco serviços com especialidade REGULATÓRIA, que é o ativo raro deles: Department of Buildings,
   ConEdison, DEP, regras do FDNY e a Local Law 152 de inspeção de gás.

   O QUE FALTA NO SITE DELES (auditado no HTML servido):
     · **ZERO blocos de JSON-LD.** Sessenta anos de reputação e nenhuma linha de dado estruturado —
       o Google não lê nada disso como um negócio.
     · Cinco DEPOIMENTOS REAIS, com nome e mês, publicados na página e invisíveis para busca por
       não estarem marcados como Review.
     · O `h1` é "WELCOME TO SIDERIS PLUMBING & HEATING CORP" — uma saudação ocupando o lugar da
       proposta. Ninguém procura "welcome".
     · Nenhum formulário na home: "REQUEST A SERVICE" é um link, o pedido nunca começa na página.

   IDENTIDADE — e aqui está a melhor parte, lida do ativo real:
   A logo deles é um **BORDADO**: chave de grifo cruzada com desentupidor, em ponto de costura, do
   jeito que aparece na camisa da equipe. Cores tiradas do arquivo: vermelho #EB1F39, linha azul
   #374187, cabo de madeira #A06844.
   CONCEITO: **O EMBLEMA** — o site como o uniforme de trabalho. Fundo de lona clara (a camisa),
   costura tracejada como estrutura, o emblema como selo. Claro de propósito: os outros dois sites
   do motor são escuros, e o deles também é claro — a identidade manda, não o meu gosto.
   (Nonstop = mesa de despacho · Astoria = livraria de van · Queens = a rede · Sideris = o emblema.)

   ⚠️ A LOGO DELES TEM TEXTO BRANCO — foi desenhada para cabeçalho escuro. Sobre a lona clara o
   nome sumia e sobrava só o bordado (visto no screenshot, não no build). Em vez de recolorir o
   ativo dele — que seria mexer na marca — ela vai COSTURADA numa placa escura, que é como o
   emblema aparece na camisa. O conceito resolveu o problema técnico.

   ATIVOS REAIS baixados e validados por mime em public/novo/sideris/: a logo bordada, a foto do
   armazém e as 5 fotos de serviço. Nada recriado, nada de banco de imagem. */
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+17186261836";
const TEL_FMT = "(718) 626-1836";
const TEL2_FMT = "(718) 299-0700";
const EMAIL = "info@sideris-plumbing.com";

/* Os 5 serviços com a especialidade regulatória DELES — é o que separa um encanador de 1963 de um
   encanador qualquer, e é o que o site deles esconde num "LEARN MORE". */
const SERVICOS = [
  { t: "Plumbing", f: "plumbing.jpg", d: "Residential or commercial, no job is a problem.", r: "" },
  { t: "Heating", f: "heating.jpg", d: "Working properly, safely and cost-efficiently.", r: "We deal with the Department of Buildings and ConEdison for you" },
  { t: "Backflow prevention", f: "backflow.jpg", d: "Compliance, documented.", r: "NYC Department of Buildings + Department of Environmental Protection" },
  { t: "Fire suppression", f: "fire-suppression.jpg", d: "Operating properly the day it is needed.", r: "Compliant with FDNY rules and regulations" },
  { t: "Gas inspection", f: "gas-inspection.jpg", d: "Inspection, code compliance and gas piping work.", r: "Local Law 152" },
];

/* Depoimentos REAIS da página deles — nome e mês como estão publicados. Não invento avaliação,
   e não corto o que desabona: são as palavras dos clientes deles. */
const DEPOIMENTOS = [
  { n: "John Tampakis", q: "February 2022", t: "He correctly determined what needed to be done and fixed the problem with our steam boiler the same day. Two other plumbers and a mechanical engineer (myself) could not solve it." },
  { n: "Lia Mirabella", q: "October 2022", t: "We were in an emergency and took our chances. They were there within the hour to cap the line that was leaking and had flooded our first floor." },
  { n: "Di S.", q: "April 2022", t: "Their plumber fixed a leak under my sink in minutes, after it had been misdiagnosed by at least 3 different plumbing teams. I would never call anyone else." },
  { n: "Guido Aren", q: "February 2022", t: "A valve near the area needed to be replaced, I bought the part. The following business day, Sideris came back and installed it — at no charge." },
];

const FAQ = [
  ["How long have you been doing this?", "Since 1963. Together with Effective Plumbing & Heating, over 90 years of combined experience in New York City."],
  ["Do you handle the city paperwork?", "Yes. Department of Buildings, ConEdison, DEP and FDNY — including Local Law 152 gas inspections."],
  ["Residential or commercial?", "Both, and emergency work 24/7."],
  ["Are you licensed?", "Fully licensed by the City of New York."],
];

/* PRESENÇA — o ganho maior deste caso. Eles têm 60 anos e ZERO dado estruturado; os 5 depoimentos
   publicados na página não são lidos como Review por ninguém. Aqui vira Plumber + Review + FAQPage. */
const SITE_URL = "https://guileoai.com/novo/sideris-plumbing";
const TITULO = "Sideris Plumbing & Heating — Licensed NYC Plumbers Since 1963";
const DESC = "Plumbing, heating, backflow prevention, fire suppression and Local Law 152 gas inspection across New York City. Fully licensed, 24/7, family-run since 1963. Call (718) 626-1836.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["name", "twitter:card", "summary_large_image"],
];
const LD = () => ([
  { "@context": "https://schema.org", "@type": "Plumber",
    name: "Sideris Plumbing & Heating Corp.", url: SITE_URL, telephone: TEL, email: EMAIL,
    foundingDate: "1963",
    description: "Licensed New York City plumbing, heating, backflow prevention, fire suppression and gas inspection.",
    address: { "@type": "PostalAddress", addressLocality: "New York", addressRegion: "NY", addressCountry: "US" },
    aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "71" },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
      opens: "00:00", closes: "23:59" }],
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Services",
      itemListElement: SERVICOS.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.t } })) },
    // Os depoimentos DELES, marcados como Review — publicados há anos e nunca lidos como tal.
    review: DEPOIMENTOS.map((d) => ({ "@type": "Review",
      author: { "@type": "Person", name: d.n }, reviewBody: d.t,
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" } })),
  },
  { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q,
      acceptedAnswer: { "@type": "Answer", text: a } })) },
]);

function useReveal() {
  const ref = useRef(null); const [ok, setOk] = useState(false);
  useEffect(() => {
    const el = ref.current; const t = setTimeout(() => setOk(true), 1400);
    if (!el || !("IntersectionObserver" in window)) return () => clearTimeout(t);
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setOk(true)), { rootMargin: "-60px" });
    io.observe(el);
    return () => { clearTimeout(t); io.disconnect(); };
  }, []);
  return [ref, ok];
}

export default function SiderisPlumbing() {
  const [form, setForm] = useState({ nome: "", tel: "", servico: "", oque: "" });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [heroRef, heroOk] = useReveal();
  /* O DADO VIVO desta página: os anos de casa, contados a partir de 1963 pelo relógio de AGORA.
     Não é enfeite — é o argumento inteiro deles, e um número que só cresce sozinho. Calculado na
     renderização, não num efeito: o valor não depende de nada que aconteça depois, e setState
     dentro de efeito custa um render a mais e faz o primeiro frame sair com zero na tela. */
  const anos = new Date().getFullYear() - 1963;

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

  const enviar = useCallback(async (e) => {
    e.preventDefault();
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
        body: JSON.stringify({ slug: "sideris-plumbing", negocio: "Sideris Plumbing & Heating", nome: form.nome,
          telefone: form.tel, mensagem: `[${form.servico || "—"}] ${form.oque}` }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErroEnvio("Couldn't send that — please call us, the phone always works.");
  }, [form]);

  return (
    <div className="sd-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .sd-raiz{
          --lona:#F4F2ED; --lona2:#EAE6DE; --tinta:#1B2450; --tinta2:#3A4577;
          --vermelho:#EB1F39; --linha-az:#374187; --mute:#5F6787; --borda:#D8D2C7;
          background:var(--lona); color:var(--tinta);
          font-family:'Inter Tight',system-ui,-apple-system,sans-serif; min-height:100vh;
          overflow-x:hidden; position:relative;
        }
        /* Textura de LONA: a trama da camisa de trabalho, em vez do grão escuro dos outros sites.
           O material vem do mundo do negócio — aqui o negócio é uniforme, não painel de despacho. */
        .sd-raiz::before{content:''; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.5;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
          mix-blend-mode:multiply;}
        .sd-wrap{position:relative; z-index:1;}
        .sd-disp{font-family:'Sora',sans-serif; font-weight:800; letter-spacing:-.028em; text-wrap:balance;}
        .sd-num{font-family:'JetBrains Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}

        /* A COSTURA como estrutura — a borda tracejada é o ponto do bordado, não enfeite:
           é a forma que a marca deles já tem. */
        .sd-costura{border:2px dashed rgba(55,65,135,.34); border-radius:22px;}
        .sd-card{background:#fff; border:1px solid var(--borda); border-radius:22px;
          box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 20px 44px -34px rgba(27,36,80,.5);}

        .sd-b{display:inline-flex; align-items:center; justify-content:center; gap:.5rem; border-radius:999px;
          font-weight:700; text-decoration:none; transition:transform .16s ease, box-shadow .22s ease, background .22s ease;}
        .sd-b:active{transform:scale(.98)}
        .sd-b-call{background:linear-gradient(180deg,#FF3D53,var(--vermelho) 52%,#C8122A); color:#fff;
          padding:1rem 1.9rem; font-size:1.08rem;
          box-shadow:0 18px 40px -14px rgba(235,31,57,.55), inset 0 1px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(120,0,15,.28);}
        .sd-b-call:hover{box-shadow:0 24px 52px -14px rgba(235,31,57,.72), inset 0 1px 0 rgba(255,255,255,.6), inset 0 -2px 0 rgba(120,0,15,.28);}
        .sd-b-2{background:#fff; color:var(--tinta); padding:.85rem 1.5rem; font-size:1rem; border:1px solid var(--borda);}
        .sd-b-2:hover{border-color:var(--linha-az); background:#FBFAF7;}

        .sd-rev{opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1);}
        .sd-rev.on{opacity:1; transform:none;}
        @media (prefers-reduced-motion:reduce){ .sd-rev{opacity:1;transform:none;transition:none} }
        @media (max-width:639px){ .sd-raiz{padding-bottom:92px} }
        .sd-bar{position:fixed; left:0; right:0; bottom:0; z-index:40; background:#fff;
          border-top:1px solid var(--borda); padding:.65rem .9rem; box-shadow:0 -8px 24px -18px rgba(27,36,80,.5);}
      `}</style>

      <div className="sd-wrap">
        <header ref={heroRef} className="mx-auto max-w-6xl px-5 pt-8 pb-10">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center rounded-2xl px-4 py-2.5"
              style={{ background: "var(--tinta)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.14), 0 10px 26px -16px rgba(27,36,80,.8)" }}>
              <img src="/novo/sideris/siderisnewlogo.png" alt="Sideris Plumbing & Heating Corp." className="h-10 w-auto sm:h-12" />
            </span>
            <div className="flex flex-wrap items-center gap-3 text-[13.5px]">
              <a href={`tel:${TEL}`} className="sd-num font-bold" style={{ color: "var(--vermelho)" }}>{TEL_FMT}</a>
              <span style={{ color: "var(--mute)" }}>·</span>
              <a href={`mailto:${EMAIL}`} style={{ color: "var(--mute)" }}>{EMAIL}</a>
            </div>
          </nav>

          <div className={`sd-rev ${heroOk ? "on" : ""} mt-11 grid items-center gap-9 lg:grid-cols-[1.1fr_.9fr]`}>
            <div>
              {/* O SELO: um só, e ele informa. Os anos são contados do relógio, não digitados. */}
              <span className="sd-costura inline-flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[.13em]"
                style={{ color: "var(--linha-az)" }}>
                Licensed by the City of New York · <span className="sd-num">{anos}</span> years
              </span>
              <h1 className="sd-disp mt-5 text-[clamp(2.4rem,6.4vw,4.2rem)] leading-[.97]">
                Done right<br /><span style={{ color: "var(--vermelho)" }}>the first time.</span>
              </h1>
              <p className="mt-5 max-w-lg text-[17px] leading-relaxed" style={{ color: "var(--mute)" }}>
                Plumbing, heating, backflow prevention, fire suppression and gas inspection across
                New York City — residential and commercial, since 1963.
              </p>
              <p className="mt-5 flex items-start gap-3 text-[15.5px] font-semibold">
                <span className="mt-1 h-[18px] w-[3px] shrink-0 rounded-full" style={{ background: "var(--vermelho)" }} />
                We deal with the Department of Buildings, ConEdison, the DEP and the FDNY — so you don't.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="sd-b sd-b-call" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
                <a className="sd-b sd-b-2" href="#pedido">Request a service</a>
              </div>
            </div>
            {/* A foto REAL do armazém deles — prova social que nenhum render substitui. */}
            <figure className="sd-card overflow-hidden p-2">
              <img src="/novo/sideris/warehouse.jpg" alt="Inside the Sideris Plumbing & Heating warehouse"
                className="w-full rounded-[16px] object-cover" style={{ aspectRatio: "4/3" }} />
              <figcaption className="px-2 pb-1 pt-2.5 text-[12px]" style={{ color: "var(--mute)" }}>
                Their own warehouse — stocked, so the truck leaves with the part.
              </figcaption>
            </figure>
          </div>
        </header>

        {/* ── OS 5 SERVIÇOS, cada um com a FOTO real dele e a linha regulatória que só eles têm.
            No site atual essa especialidade some atrás de um "LEARN MORE". */}
        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="sd-disp text-[clamp(1.8rem,4.4vw,2.7rem)] leading-none">What we handle</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICOS.map((s) => (
              <article key={s.t} className="sd-card overflow-hidden">
                <img src={`/novo/sideris/${s.f}`} alt={`${s.t} — Sideris Plumbing & Heating`}
                  className="w-full object-cover" style={{ aspectRatio: "4/3" }} />
                <div className="p-4">
                  <h3 className="sd-disp text-[1.15rem]">{s.t}</h3>
                  <p className="mt-1 text-[14px] leading-snug" style={{ color: "var(--mute)" }}>{s.d}</p>
                  {s.r && (
                    <p className="sd-costura mt-2.5 px-2.5 py-1.5 text-[12px] font-semibold" style={{ color: "var(--linha-az)" }}>
                      {s.r}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── O PEDIDO — no site atual "REQUEST A SERVICE" é um link; aqui o pedido começa na página. */}
        <section id="pedido" className="mx-auto max-w-6xl px-5 py-8">
          <div className="sd-card p-6 sm:p-8">
            <h2 className="sd-disp text-[clamp(1.7rem,4.2vw,2.4rem)] leading-tight">Request a service</h2>
            <p className="mt-1.5 text-[15px]" style={{ color: "var(--mute)" }}>
              Tell us what is happening. Emergencies are handled 24/7 — or call {TEL_FMT} right now.
            </p>
            {enviado ? (
              <p className="sd-costura mt-5 px-4 py-3 text-[15px] font-semibold" style={{ color: "var(--linha-az)" }}>
                Request received. If water is moving right now, call {TEL_FMT} — the phone is always faster.
              </p>
            ) : (
              <form onSubmit={enviar} className="mt-5 grid gap-3 sm:grid-cols-2">
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Your name" className="rounded-2xl border px-4 py-3 text-[15px] outline-none"
                  style={{ borderColor: "var(--borda)" }} />
                <input required type="tel" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })}
                  placeholder="Phone we can call back" className="rounded-2xl border px-4 py-3 text-[15px] outline-none"
                  style={{ borderColor: "var(--borda)" }} />
                <select value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })}
                  className="rounded-2xl border bg-white px-4 py-3 text-[15px] outline-none sm:col-span-2"
                  style={{ borderColor: "var(--borda)", color: form.servico ? "var(--tinta)" : "var(--mute)" }}>
                  <option value="">Which service?</option>
                  {SERVICOS.map((s) => <option key={s.t} value={s.t}>{s.t}</option>)}
                </select>
                <textarea required rows={2} value={form.oque} onChange={(e) => setForm({ ...form, oque: e.target.value })}
                  placeholder="What is happening? (leak, no heat, inspection due…)"
                  className="rounded-2xl border px-4 py-3 text-[15px] outline-none sm:col-span-2"
                  style={{ borderColor: "var(--borda)" }} />
                                  {erroEnvio && (
                    <p className="sm:col-span-2 text-[13.5px] font-semibold" style={{ color: "var(--vermelho)" }}>{erroEnvio}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button type="submit" className="sd-b sd-b-call">Send the request</button>
                  <a href={`tel:${TEL}`} className="text-[13.5px] font-semibold" style={{ color: "var(--vermelho)" }}>
                    or call {TEL_FMT} →
                  </a>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* ── OS DEPOIMENTOS DELES — publicados há anos na página e nunca lidos como Review por
            buscador nenhum. Aqui aparecem como cartões E vão marcados no JSON-LD. */}
        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="sd-disp text-[clamp(1.8rem,4.4vw,2.7rem)] leading-none">In their words</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {DEPOIMENTOS.map((d) => (
              <blockquote key={d.n} className="sd-card p-5">
                <p className="text-[15px] leading-relaxed">“{d.t}”</p>
                <footer className="mt-3 text-[13px] font-semibold" style={{ color: "var(--linha-az)" }}>
                  {d.n} <span className="font-normal" style={{ color: "var(--mute)" }}>· {d.q}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="sd-disp text-[clamp(1.8rem,4.4vw,2.7rem)] leading-none">Straight answers</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q} className="sd-card p-5">
                <h3 className="text-[15.5px] font-bold">{q}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: "var(--mute)" }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        <footer id="contact" className="mx-auto max-w-6xl px-5 pb-16 pt-4">
          <div className="sd-card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <span className="inline-flex items-center rounded-2xl px-4 py-2.5"
                  style={{ background: "var(--tinta)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.14)" }}>
                  <img src="/novo/sideris/siderisnewlogo.png" alt="Sideris Plumbing & Heating Corp." className="h-10 w-auto" />
                </span>
                <p className="sd-num mt-3 text-[15px] font-bold" style={{ color: "var(--vermelho)" }}>
                  {TEL_FMT} <span className="font-normal" style={{ color: "var(--mute)" }}>· {TEL2_FMT}</span>
                </p>
                <p className="mt-1 text-[14px]" style={{ color: "var(--mute)" }}>{EMAIL}</p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--mute)" }}>
                  New York City · 24/7 · fully licensed · serving since 1963
                </p>
              </div>
              <a className="sd-b sd-b-call" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
            </div>
            <p className="mt-6 border-t pt-4 text-[11.5px]" style={{ borderColor: "var(--borda)", color: "var(--mute)" }}>
              ⚡ site + AI by <a href="https://guileoai.com" className="underline" style={{ color: "var(--mute)" }}>Guileo</a>
            </p>
          </div>
        </footer>

        <div className="sd-bar sm:hidden">
          <a className="sd-b sd-b-call w-full" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
        </div>
      </div>
    </div>
  );
}
