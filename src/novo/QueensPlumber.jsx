/* QUEENS PLUMBER — reconstrução (prospect real, queensnyplumber.com)
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   O QUE O SITE DELES É HOJE: um app feito no Lovable que **nunca foi terminado**. O HTML servido
   tem 1.613 bytes e 14 caracteres de texto — todo o conteúdo (18.770 caracteres, e é bom) só
   existe depois que o JavaScript roda. O Google lê a casca. E nela ainda estão, publicados, os
   comentários do template:
       <!-- TODO: Set the document title to the name of your application -->
       <!-- TODO: Update og:title to match your application name -->
       <meta name="author" content="Lovable" />
   og:title e og:description são, os dois, a string "Queens Plumber".
   Mais: o segundo botão da hero está VAZIO (um retângulo branco sem rótulo), e o site inteiro não
   tem UMA imagem. 15 bairros listados e nenhuma página para nenhum deles.

   IDENTIDADE (lida do site renderizado, não escolhida por mim):
     · laranja #F97415 — a cor de ação deles, 30 ocorrências, é a mais usada da página
     · navy #11325F / #2D5286 — o fundo da hero e a tipografia
     · não existe arquivo de logo: a marca deles é a PALAVRA "Queens Plumber". Então a marca aqui
       é tipográfica — não invento um símbolo que eles não têm.

   CONCEITO: A REDE — o site como o encanamento de Queens. Eles escrevem, com essas palavras,
   "we know the housing stock, we know the infrastructure, and we know what it takes to keep water
   moving". Então os 15 bairros viram NÓS de uma linha viva, e os 21 serviços as ramificações.
   (Nonstop = mesa de despacho · Astoria = livraria de van · Queens = a rede. O conceito sai do
   mundo daquele negócio, nunca do meu gosto.)

   FATOS — todos do site deles ou do Google, nada inventado:
     · Google: 4,9★ · 65 avaliações  ·  (929) 481-3200  ·  aberto 24/7
     · 53-05 108th St, Corona, NY 11368
     · "family business, rooted in Corona" · "every plumber we send is on our payroll — no random
       subs showing up at your front door" · licensed, insured and bonded · free estimates
     · 21 serviços em 4 grupos e 15 bairros — as listas abaixo são as DELES, na ordem deles */
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+19294813200";
const TEL_FMT = "(929) 481-3200";
const ENDERECO = "53-05 108th St, Corona, NY 11368";

/* Os 15 bairros que eles atendem — hoje são texto solto no rodapé deles; aqui cada um vira um
   pedido com o campo já preenchido. É o maior ganho de conversão e de SEO local da página. */
const BAIRROS = ["Astoria", "Flushing", "Jamaica", "Bayside", "Forest Hills", "Long Island City",
  "Jackson Heights", "Ridgewood", "Elmhurst", "Rego Park", "Woodside", "Sunnyside", "Corona",
  "Whitestone", "Ozone Park"];

/* Os 21 serviços, nos 4 grupos DELES. Cartão compacto: a lista não pode competir com o quadro
   de bairros, que é onde o pedido acontece. */
const GRUPOS = [
  { g: "Residential", itens: ["Drain cleaning", "Leak detection", "Pipe repair", "Pipe replacement",
      "Toilet repair & installation", "Faucet repair & installation", "Garbage disposal repair",
      "Bathroom plumbing", "Kitchen plumbing", "Sump pump installation"] },
  { g: "Sewer & drains", itens: ["Sewer line repair", "Sewer line replacement", "Hydro jetting", "Backflow prevention"] },
  { g: "Water heaters", itens: ["Water heater repair", "Water heater installation", "Tankless water heater services"] },
  { g: "Other", itens: ["Water line repair", "Emergency plumbing", "Gas line services", "Commercial plumbing"] },
];

const FAQ = [
  ["Do you really answer at night?", "Yes — open 24/7. Emergency plumbing is one of our services, not an exception to them."],
  ["Who actually shows up?", "Our own plumbers. Every plumber we send is on our payroll — no random subs at your front door."],
  ["Is the estimate free?", "Free estimates on every job, and satisfaction guaranteed on every one."],
  ["Which parts of Queens do you cover?", "Fifteen neighborhoods, from Astoria and Long Island City out to Bayside, Whitestone and Ozone Park. We are a family business rooted in Corona."],
];

/* PRESENÇA ONLINE — é aqui que a reconstrução ganha do original de verdade.
   O deles serve uma casca vazia com os TODO do template; nenhum buscador vê os 18.770 caracteres.
   Aqui o conteúdo é HTML de verdade + JSON-LD Plumber com os 15 bairros e FAQPage. */
const SITE_URL = "https://guileoai.com/novo/queens-plumber";
const TITULO = "Queens Plumber — 24/7 Licensed Plumbers in Astoria, Flushing, Jamaica & All Queens";
const DESC = "Licensed, insured and bonded plumbers, open 24/7. Drains, sewer lines, water heaters, leaks and emergencies across 15 Queens neighborhoods. Family business rooted in Corona. Free estimates — call (929) 481-3200.";
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
    name: "Queens Plumber", url: SITE_URL, telephone: TEL,
    description: "Licensed, insured and bonded plumbing contractors serving Queens, NY. Open 24/7.",
    address: { "@type": "PostalAddress", streetAddress: "53-05 108th St",
      addressLocality: "Corona", addressRegion: "NY", postalCode: "11368", addressCountry: "US" },
    // 4,9 com 65 avaliações veio do Google e é verificável.
    aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "65" },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
      opens: "00:00", closes: "23:59" }],
    areaServed: BAIRROS.map((b) => ({ "@type": "Place", name: `${b}, Queens, NY` })),
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Plumbing services",
      itemListElement: GRUPOS.flatMap((g) => g.itens).map((s) => ({ "@type": "Offer",
        itemOffered: { "@type": "Service", name: s } })) },
  },
  { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q,
      acceptedAnswer: { "@type": "Answer", text: a } })) },
]);

function useRelogioNY() {
  const [h, setH] = useState("");
  useEffect(() => {
    const tick = () => setH(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date()));
    tick(); const id = setInterval(tick, 20000); return () => clearInterval(id);
  }, []);
  return h;
}

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

export default function QueensPlumber() {
  const hora = useRelogioNY();
  const bairroInicial = () => {
    if (typeof window === "undefined") return "";
    const b = (new URLSearchParams(window.location.search).get("bairro") || "").toLowerCase();
    return BAIRROS.find((x) => x.toLowerCase().replace(/\s+/g, "-") === b) || "";
  };
  const [aberto, setAberto] = useState(bairroInicial);
  const [form, setForm] = useState(() => ({ nome: "", tel: "", oque: "" }));
  const [enviado, setEnviado] = useState(false);
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
    try {
      await fetch("/api/marketplace-leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fonte: "novo/queens-plumber", nome: form.nome, telefone: form.tel,
          mensagem: `[${aberto}] ${form.oque}`, negocio: "Queens Plumber" }),
      });
    } catch { /* sem rede: o telefone na tela é o plano B honesto */ }
    setEnviado(true);
  }, [form, aberto]);

  return (
    <div className="qp-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .qp-raiz{
          --navy:#0A1F3D; --navy2:#11325F; --navy3:#183F76; --laranja:#F97415; --laranja-c:#FF8C33;
          --ivory:#F2F5FA; --mute:#9FB0C9; --line:rgba(255,255,255,.12);
          background:var(--navy); color:var(--ivory);
          font-family:'Inter Tight',system-ui,-apple-system,sans-serif; min-height:100vh;
          overflow-x:hidden; position:relative;
        }
        .qp-raiz::before{content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
          background:radial-gradient(880px 500px at 82% -6%, rgba(249,116,21,.14), transparent 62%),
                     radial-gradient(720px 640px at 4% 22%, rgba(24,63,118,.9), transparent 72%);}
        .qp-raiz::after{content:''; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.28;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
          mix-blend-mode:soft-light;}
        .qp-wrap{position:relative; z-index:1;}
        .qp-disp{font-family:'Bricolage Grotesque',sans-serif; font-weight:800; letter-spacing:-.022em; text-wrap:balance;}
        .qp-num{font-family:'JetBrains Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}

        .qp-b{position:relative; display:inline-flex; align-items:center; justify-content:center; gap:.5rem;
          border-radius:999px; font-weight:700; text-decoration:none; overflow:hidden;
          transition:transform .16s ease, box-shadow .22s ease, background .22s ease;}
        .qp-b:active{transform:scale(.98)}
        .qp-b-call{background:linear-gradient(180deg,var(--laranja-c),var(--laranja) 52%,#DC5F08);
          color:#fff; padding:1rem 1.9rem; font-size:1.1rem;
          box-shadow:0 20px 46px -16px rgba(249,116,21,.6), inset 0 1px 0 rgba(255,255,255,.42), inset 0 -2px 0 rgba(120,45,0,.3), 0 0 0 1px rgba(249,116,21,.5);}
        .qp-b-call:hover{box-shadow:0 26px 58px -16px rgba(249,116,21,.78), inset 0 1px 0 rgba(255,255,255,.55), inset 0 -2px 0 rgba(120,45,0,.3), 0 0 0 1px rgba(249,116,21,.8);}
        .qp-b-2{background:rgba(255,255,255,.055); color:var(--ivory); padding:.85rem 1.5rem; font-size:1rem;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.14), 0 0 0 1px var(--line);}
        .qp-b-2:hover{background:rgba(249,116,21,.12); box-shadow:inset 0 1px 0 rgba(255,255,255,.2), 0 0 0 1px rgba(249,116,21,.5);}

        .qp-card{background:linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.02));
          border:1px solid var(--line); border-radius:26px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.13), 0 26px 60px -40px rgba(0,0,0,.95);}
        .qp-rev{opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1);}
        .qp-rev.on{opacity:1; transform:none;}
        @media (prefers-reduced-motion:reduce){ .qp-rev{opacity:1;transform:none;transition:none} }
        @media (max-width:639px){ .qp-raiz{padding-bottom:92px} }
        .qp-bar{position:fixed; left:0; right:0; bottom:0; z-index:40; background:#07172E;
          border-top:1px solid rgba(249,116,21,.36); padding:.65rem .9rem;}
      `}</style>

      <div className="qp-wrap">
        <header ref={heroRef} className="mx-auto max-w-6xl px-5 pt-8 pb-10 sm:pt-11">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            {/* A marca deles é a PALAVRA — não existe arquivo de logo no site. Então ela é
                tipográfica, com a barra laranja da cor de ação. Não invento símbolo. */}
            <span className="qp-disp flex items-center gap-2.5 text-[1.45rem] leading-none">
              <span className="h-6 w-[5px] rounded-full" style={{ background: "var(--laranja)" }} />
              Queens Plumber
            </span>
            {/* UM selo vivo, e ele informa: a hora de NY prova o "24/7" agora. */}
            <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
              style={{ background: "rgba(249,116,21,.12)", boxShadow: "inset 0 0 0 1px rgba(249,116,21,.42)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--laranja)", boxShadow: "0 0 10px var(--laranja)" }} />
              Open now <span className="qp-num opacity-80">· {hora} NYC</span>
            </span>
          </nav>

          <div className={`qp-rev ${heroOk ? "on" : ""} mt-11 max-w-3xl`}>
            <h1 className="qp-disp text-[clamp(2.5rem,7vw,4.6rem)] leading-[.95]">
              Queens plumbing,<br /><span style={{ color: "var(--laranja)" }}>answered at any hour.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed" style={{ color: "var(--mute)" }}>
              Licensed, insured and bonded. Drains, sewer lines, water heaters, leaks — residential,
              commercial and emergency, across fifteen neighborhoods.
            </p>
            <p className="mt-5 flex items-start gap-3 text-[15.5px] font-semibold">
              <span className="mt-1 h-[18px] w-[3px] shrink-0 rounded-full" style={{ background: "var(--laranja)", boxShadow: "0 0 12px var(--laranja)" }} />
              Every plumber we send is on our payroll — no random subs at your front door.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {/* Dois botões, os dois COM RÓTULO. O site atual deles tem um retângulo branco vazio
                  ao lado do "Call Now" — botão sem texto é um beco. */}
              <a className="qp-b qp-b-call" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
              <a className="qp-b qp-b-2" href="#bairros">Get a free estimate</a>
            </div>
          </div>

          <div className={`qp-rev ${heroOk ? "on" : ""} mt-10 flex flex-wrap items-center gap-x-7 gap-y-2 border-t pt-5 text-[12.5px] uppercase tracking-[.14em]`}
            style={{ borderColor: "var(--line)", color: "var(--mute)" }}>
            <span><b className="qp-num" style={{ color: "var(--ivory)" }}>4.9★</b> · 65 Google reviews</span>
            <span><b style={{ color: "var(--ivory)" }}>24/7</b> · day or night, Monday or Sunday</span>
            <span><b style={{ color: "var(--ivory)" }}>Licensed</b> · insured · bonded</span>
            <span>Family business · rooted in Corona</span>
          </div>
        </header>

        {/* ── OS 15 BAIRROS — o coração da conversão E do SEO local.
            Hoje eles são texto solto no rodapé do site atual. Aqui cada um abre o pedido com o
            bairro já preenchido, e cada um é linkável por ?bairro=flushing. */}
        <section id="bairros" className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="qp-disp text-[clamp(1.9rem,4.6vw,2.9rem)] leading-none">Which part of Queens?</h2>
          <p className="mt-2 max-w-xl text-[15px]" style={{ color: "var(--mute)" }}>
            Pick your neighborhood and tell us what is happening. Free estimate, any hour.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {BAIRROS.map((b) => {
              const on = aberto === b;
              return (
                <button key={b} type="button" onClick={() => setAberto(on ? "" : b)} aria-pressed={on}
                  className="rounded-full px-4 py-2.5 text-[14px] font-semibold transition"
                  style={on
                    ? { background: "var(--laranja)", color: "#fff", boxShadow: "0 12px 30px -12px rgba(249,116,21,.7), inset 0 1px 0 rgba(255,255,255,.4)" }
                    : { background: "rgba(255,255,255,.05)", color: "var(--ivory)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                  {b}
                </button>
              );
            })}
          </div>

          <div className="qp-card mt-5 p-5 sm:p-6">
            {enviado ? (
              <>
                <p className="qp-disp text-[1.4rem]" style={{ color: "var(--laranja)" }}>Request received</p>
                <p className="mt-1.5 text-[14.5px]">
                  If water is moving right now, call {TEL_FMT} — the phone is always faster.
                </p>
              </>
            ) : (
              <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
                <p className="text-[13px] sm:col-span-2" style={{ color: "var(--mute)" }}>
                  {aberto ? <>Free estimate in <b style={{ color: "var(--laranja)" }}>{aberto}</b></> : "Pick a neighborhood above, or just tell us what is happening."}
                </p>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Your name" className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                  style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--line)", color: "var(--ivory)" }} />
                <input required type="tel" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })}
                  placeholder="Phone we can call back" className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                  style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--line)", color: "var(--ivory)" }} />
                <textarea required rows={2} value={form.oque} onChange={(e) => setForm({ ...form, oque: e.target.value })}
                  placeholder="What is happening? (leak, blocked drain, no hot water…)"
                  className="rounded-2xl px-4 py-3 text-[15px] outline-none sm:col-span-2"
                  style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--line)", color: "var(--ivory)" }} />
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button type="submit" className="qp-b qp-b-2">Send the request</button>
                  <a href={`tel:${TEL}`} className="text-[13.5px] font-semibold" style={{ color: "var(--laranja)" }}>
                    or call {TEL_FMT} →
                  </a>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* ── OS 21 SERVIÇOS nos 4 grupos deles. Compacto: sub-itens numa linha separada por ponto,
            não lista vertical — a seção não pode empurrar o quadro de bairros pra fora da tela. */}
        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="qp-disp text-[clamp(1.9rem,4.6vw,2.9rem)] leading-none">What we do</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {GRUPOS.map((g) => (
              <div key={g.g} className="qp-card p-5">
                <h3 className="qp-disp text-[1.2rem]" style={{ color: "var(--laranja)" }}>{g.g}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--mute)" }}>
                  {g.itens.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── A HISTÓRIA, nas palavras deles. É o que o site atual esconde atrás do JavaScript. */}
        <section className="mx-auto max-w-6xl px-5 py-8">
          <div className="qp-card p-6 sm:p-8">
            <h2 className="qp-disp text-[clamp(1.6rem,4vw,2.3rem)] leading-tight">
              Queens is home to us.
            </h2>
            <p className="mt-3 max-w-2xl text-[16px] leading-relaxed" style={{ color: "var(--mute)" }}>
              From a dripping faucet in an Astoria walk-up to a full sewer line replacement under a
              Jamaica sidewalk, our certified plumbers take on residential, commercial and emergency
              work at any hour. We know the housing stock, we know the infrastructure, and we know
              what it takes to keep water moving the way it should.
            </p>
            <p className="mt-3 text-[16px] font-semibold">
              Free estimates on every job. Satisfaction guaranteed on every one.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="qp-disp text-[clamp(1.9rem,4.6vw,2.9rem)] leading-none">Straight answers</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q} className="qp-card p-5">
                <h3 className="text-[15.5px] font-bold">{q}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: "var(--mute)" }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        <footer id="contact" className="mx-auto max-w-6xl px-5 pb-16 pt-4">
          <div className="qp-card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <span className="qp-disp flex items-center gap-2.5 text-[1.35rem] leading-none">
                  <span className="h-6 w-[5px] rounded-full" style={{ background: "var(--laranja)" }} />
                  Queens Plumber
                </span>
                <p className="mt-3 text-[14.5px]" style={{ color: "var(--mute)" }}>{ENDERECO}</p>
                <p className="qp-num mt-1 text-[15px]" style={{ color: "var(--laranja)" }}>{TEL_FMT}</p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--mute)" }}>Open 24/7 · licensed, insured and bonded</p>
              </div>
              <a className="qp-b qp-b-call" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
            </div>
            <p className="mt-6 border-t pt-4 text-[11.5px]" style={{ borderColor: "var(--line)", color: "var(--mute)" }}>
              ⚡ site + AI by <a href="https://guileoai.com" className="underline" style={{ color: "var(--mute)" }}>Guileo</a>
            </p>
          </div>
        </footer>

        <div className="qp-bar sm:hidden">
          <a className="qp-b qp-b-call w-full" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
        </div>
      </div>
    </div>
  );
}
