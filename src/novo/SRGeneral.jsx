/* SR GENERAL CONSTRUCTION NYC — reconstrução (prospect real, srgeneralconstructionnyc.com)
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   O NEGÓCIO: desde 2002, Brooklyn, licenciado e segurado, **NYC DOB Certified**. 4,8★ com 57
   avaliações. O diferencial que eles mesmos escrevem — e escondem no meio da página — é
   BROWNSTONE: "Historic Home Specialists", restauração de fachada, escada de entrada, alvenaria.
   A foto antes/depois deles é a prova: uma escadaria de brownstone caindo aos pedaços virando
   escadaria restaurada, com o arco e a cornija de volta.

   O QUE FALTA NO SITE DELES (auditado no HTML servido):
     · O ÚNICO bloco de JSON-LD que eles têm está SEM `@type` — não descreve nada. Na prática é o
       mesmo que não ter: um contratante DOB-certificado invisível como negócio.
     · Nenhum formulário: "Free Estimate" é um link, o pedido nunca começa na página.
     · Emoji dentro da interface (🏗️ 🎉 ☎️) — em site de obra isso custa autoridade justamente
       onde ela é o produto.
     · A oferta "30% OFF Limited Time" está publicada com imagens de maio de 2025. Urgência que
       nunca vence ensina o visitante a não acreditar na próxima. Aqui a promoção continua, dita
       sem cronômetro falso.

   IDENTIDADE (lida dos ativos reais):
     · a logo é um "S" feito de TELHADO + FIADA DE TIJOLOS, com capacete e ferramentas, em âmbar
       dourado. A alvenaria já está na marca deles.
     · âmbar #F5A623 (a cor da logo) sobre pedra quente escura — o próprio material do brownstone.
   CONCEITO: **A FIADA** — o site construído como alvenaria: faixas assentadas uma sobre a outra,
   juntas visíveis como estrutura, a pedra como fundo. Sai do que eles fazem e do que a marca deles
   já desenha. (Nonstop = despacho · Astoria = van · Queens = a rede · Sideris = o emblema ·
   SR = a fiada.)

   6 ativos reais baixados e validados por mime em public/novo/srgeneral/. */
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+17184507233";
const TEL_FMT = "(718) 450-7233";
const EMAIL = "info@srgeneralconstructionnyc.com";

/* Os serviços deles, agrupados pelo que a obra realmente é. A lista original tem 13 itens soltos
   no menu; agrupada, o dono de brownstone acha o dele em um olhar. */
const GRUPOS = [
  { g: "Brownstone & facade", d: "The work Brooklyn buildings actually need.",
    itens: ["Brownstone restoration", "Facade restoration", "Stoop repair & replacement", "Historic detail preservation", "Lintel replacement"] },
  { g: "Masonry & concrete", d: "Solid foundations, beautiful finishes.",
    itens: ["Brick & block", "Brick pointing", "Cement stucco", "Concrete sidewalks & driveways", "Foundation repair & sealing", "Foundation leak repair"] },
  { g: "Interiors", d: "The rooms you live in.",
    itens: ["Bathroom renovation", "Kitchen remodeling", "Tile installation", "Painting", "Renovation services"] },
  { g: "Roof & water", d: "Protection from the top down.",
    itens: ["Roof repairs & installation", "Emergency roof services", "Gutter installation & cleaning", "Waterproofing"] },
];

const PROVAS = [
  ["Licensed & insured", "NYC DOB certified"],
  ["Since 2002", "20+ years in Brooklyn"],
  ["Free estimates", "Transparent pricing"],
  ["Brownstone experts", "Historic home specialists"],
];

const FAQ = [
  ["Do you work on landmarked brownstones?", "Yes — facade restoration, stoop repair and historic detail preservation are what we are known for."],
  ["Are you certified for city work?", "Licensed, insured and NYC DOB certified."],
  ["What does an estimate cost?", "Nothing. Free estimates and transparent pricing on every job."],
  ["How long have you been doing this?", "Since 2002, in Brooklyn."],
];

const SITE_URL = "https://guileoai.com/novo/sr-general";
const TITULO = "SR General Construction — Brooklyn Brownstone, Masonry & Renovation Since 2002";
const DESC = "NYC DOB certified general contractor in Brooklyn. Brownstone and facade restoration, stoop repair, brick pointing, roofing, bathrooms and kitchens. Licensed, insured, free estimates. Call (718) 450-7233.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["name", "twitter:card", "summary_large_image"],
];
/* O JSON-LD que eles NÃO têm. O único bloco do site atual está sem `@type` — descreve nada. */
const LD = () => ([
  { "@context": "https://schema.org", "@type": "GeneralContractor",
    name: "SR General Construction NYC", url: SITE_URL, telephone: TEL, email: EMAIL,
    foundingDate: "2002",
    description: "Licensed and insured, NYC DOB certified general contractor in Brooklyn, specialising in brownstone and facade restoration, masonry, roofing and renovation.",
    address: { "@type": "PostalAddress", addressLocality: "Brooklyn", addressRegion: "NY", addressCountry: "US" },
    areaServed: { "@type": "Place", name: "Brooklyn, New York" },
    aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", reviewCount: "57" },
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Construction services",
      itemListElement: GRUPOS.flatMap((g) => g.itens).map((s) => ({ "@type": "Offer",
        itemOffered: { "@type": "Service", name: s } })) },
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

export default function SRGeneral() {
  const [form, setForm] = useState({ nome: "", tel: "", tipo: "", oque: "" });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [heroRef, heroOk] = useReveal();
  const anos = new Date().getFullYear() - 2002;   // dado vivo: cresce sozinho, ninguém redigita

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
        body: JSON.stringify({ slug: "sr-general", negocio: "SR General Construction NYC", nome: form.nome,
          telefone: form.tel, mensagem: `[${form.tipo || "—"}] ${form.oque}` }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErroEnvio("Couldn't send that — please call us, the phone always works.");
  }, [form]);

  return (
    <div className="sr-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .sr-raiz{
          --pedra:#241C15; --pedra2:#2F2419; --pedra3:#3A2D1F; --junta:rgba(245,166,35,.16);
          --ambar:#F5A623; --ambar-c:#FFBE4D; --creme:#F3EBDF; --mute:#B8A992; --linha:rgba(243,235,223,.12);
          background:var(--pedra); color:var(--creme);
          font-family:'Inter Tight',system-ui,-apple-system,sans-serif; min-height:100vh;
          overflow-x:hidden; position:relative;
        }
        .sr-raiz::before{content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
          background:radial-gradient(900px 520px at 80% -8%, rgba(245,166,35,.13), transparent 62%),
                     radial-gradient(700px 620px at 4% 20%, rgba(58,45,31,.9), transparent 72%);}
        .sr-raiz::after{content:''; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.32;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='170'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='170' height='170' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
          mix-blend-mode:soft-light;}
        .sr-wrap{position:relative; z-index:1;}
        .sr-disp{font-family:'Fraunces',Georgia,serif; font-weight:800; letter-spacing:-.02em; text-wrap:balance;}
        .sr-num{font-family:'JetBrains Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}

        /* A JUNTA — a linha entre as fiadas. É a estrutura da página, não enfeite: o negócio deles
           é assentar pedra, e a página é assentada do mesmo jeito. */
        .sr-fiada{border-top:1px solid var(--junta);}
        .sr-card{background:linear-gradient(180deg, rgba(243,235,223,.055), rgba(243,235,223,.02));
          border:1px solid var(--linha); border-radius:20px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.1), 0 24px 56px -40px rgba(0,0,0,.95);}

        .sr-b{display:inline-flex; align-items:center; justify-content:center; gap:.5rem; border-radius:999px;
          font-weight:700; text-decoration:none; transition:transform .16s ease, box-shadow .22s ease, background .22s ease;}
        .sr-b:active{transform:scale(.98)}
        .sr-b-call{background:linear-gradient(180deg,var(--ambar-c),var(--ambar) 52%,#D98A0C); color:#241206;
          padding:1rem 1.9rem; font-size:1.08rem;
          box-shadow:0 18px 42px -14px rgba(245,166,35,.55), inset 0 1px 0 rgba(255,255,255,.5), inset 0 -2px 0 rgba(110,60,0,.26);}
        .sr-b-call:hover{box-shadow:0 24px 54px -14px rgba(245,166,35,.75), inset 0 1px 0 rgba(255,255,255,.62), inset 0 -2px 0 rgba(110,60,0,.26);}
        .sr-b-2{background:rgba(243,235,223,.055); color:var(--creme); padding:.85rem 1.5rem; font-size:1rem;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.13), 0 0 0 1px var(--linha);}
        .sr-b-2:hover{background:rgba(245,166,35,.12); box-shadow:inset 0 1px 0 rgba(255,255,255,.2), 0 0 0 1px rgba(245,166,35,.45);}

        .sr-rev{opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1);}
        .sr-rev.on{opacity:1; transform:none;}
        @media (prefers-reduced-motion:reduce){ .sr-rev{opacity:1;transform:none;transition:none} }
        @media (max-width:639px){ .sr-raiz{padding-bottom:92px} }
        .sr-bar{position:fixed; left:0; right:0; bottom:0; z-index:40; background:#1B140E;
          border-top:1px solid rgba(245,166,35,.34); padding:.65rem .9rem;}
      `}</style>

      <div className="sr-wrap">
        <header ref={heroRef} className="mx-auto max-w-6xl px-5 pt-7 pb-10">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <img src="/novo/srgeneral/logo.png" alt="SR General Construction NYC" className="h-14 w-auto sm:h-16" />
            <div className="flex flex-wrap items-center gap-3 text-[13.5px]">
              <a href={`tel:${TEL}`} className="sr-num font-bold" style={{ color: "var(--ambar)" }}>{TEL_FMT}</a>
              <span style={{ color: "var(--mute)" }}>·</span>
              <span style={{ color: "var(--mute)" }}>Brooklyn, NY</span>
            </div>
          </nav>

          <div className={`sr-rev ${heroOk ? "on" : ""} mt-10 grid items-center gap-9 lg:grid-cols-[1.05fr_.95fr]`}>
            <div>
              {/* UM selo, e ele informa: os anos contados do relógio, não digitados. */}
              <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[.14em]"
                style={{ background: "rgba(245,166,35,.11)", boxShadow: "inset 0 0 0 1px rgba(245,166,35,.4)", color: "var(--ambar)" }}>
                NYC DOB certified · <span className="sr-num">{anos}</span> years in Brooklyn
              </span>
              {/* DUAS LINHAS, sempre. Em 1280 o "Brooklyn brownstone," quebrava e virava três —
                  título em três linhas numa coluna estreita perde a batida e empurra o botão pra
                  fora da dobra. Reduzi o teto do clamp em vez de encurtar a frase: a frase é boa. */}
              <h1 className="sr-disp mt-5 text-[clamp(2.1rem,5vw,3.3rem)] leading-[1.04]">
                Brooklyn brownstone,<br /><span style={{ color: "var(--ambar)" }}>put back together.</span>
              </h1>
              <p className="mt-5 max-w-lg text-[17px] leading-relaxed" style={{ color: "var(--mute)" }}>
                Facade and stoop restoration, brick pointing, masonry, roofing and full renovations —
                licensed, insured and working these buildings since 2002.
              </p>
              <p className="mt-5 flex items-start gap-3 text-[15.5px] font-semibold">
                <span className="mt-1 h-[18px] w-[3px] shrink-0 rounded-full" style={{ background: "var(--ambar)" }} />
                We know Brooklyn buildings, codes and styles — because we have only ever worked on them.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="sr-b sr-b-call" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
                <a className="sr-b sr-b-2" href="#estimativa">Get a free estimate</a>
              </div>
              {/* A promoção DELES, sem cronômetro falso: dita como oferta, não como urgência. */}
              <p className="mt-3 text-[13px]" style={{ color: "var(--mute)" }}>
                Ask about the current 30% promotion when you call.
              </p>
            </div>

            {/* A PROVA: o antes/depois REAL deles. Nenhum render substitui uma escadaria de
                brownstone que estava caindo e voltou. */}
            <figure className="sr-card overflow-hidden p-2">
              <img src="/novo/srgeneral/antes-depois.jpg" alt="Brownstone stoop before and after restoration by SR General Construction"
                className="w-full rounded-[14px] object-cover" />
              <figcaption className="px-2 pb-1 pt-2.5 text-[12px]" style={{ color: "var(--mute)" }}>
                Their own before/after: a crumbling brownstone stoop, rebuilt with the arch and cornice intact.
              </figcaption>
            </figure>
          </div>

          {/* A FIADA de credenciais — assentada, uma linha só. */}
          <div className={`sr-rev ${heroOk ? "on" : ""} sr-fiada mt-10 grid gap-x-8 gap-y-3 pt-5 sm:grid-cols-2 lg:grid-cols-4`}>
            {PROVAS.map(([a, b]) => (
              <div key={a}>
                <div className="text-[14px] font-bold">{a}</div>
                <div className="text-[12.5px]" style={{ color: "var(--mute)" }}>{b}</div>
              </div>
            ))}
          </div>
        </header>

        {/* ── OS SERVIÇOS, agrupados pelo que a obra é. No menu deles são 13 itens soltos. */}
        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="sr-disp text-[clamp(1.8rem,4.4vw,2.7rem)] leading-none">What we build and restore</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {GRUPOS.map((g) => (
              <div key={g.g} className="sr-card p-5">
                <h3 className="sr-disp text-[1.25rem]" style={{ color: "var(--ambar)" }}>{g.g}</h3>
                <p className="mt-1 text-[14px]" style={{ color: "var(--mute)" }}>{g.d}</p>
                <p className="mt-2.5 text-[13.5px] leading-relaxed">{g.itens.join(" · ")}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── AS OBRAS: as fotos reais deles, sem legenda inventada. */}
        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="sr-disp text-[clamp(1.8rem,4.4vw,2.7rem)] leading-none">On the job</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {["capa.jpg", "obra5.jpg", "obra6.jpg"].map((f) => (
              <figure key={f} className="sr-card overflow-hidden">
                <img src={`/novo/srgeneral/${f}`} alt="SR General Construction work in Brooklyn"
                  className="w-full object-cover" style={{ aspectRatio: "4/3" }} />
              </figure>
            ))}
          </div>
        </section>

        {/* ── A ESTIMATIVA — no site atual "Free Estimate" é um link; aqui começa na página. */}
        <section id="estimativa" className="mx-auto max-w-6xl px-5 py-8">
          <div className="sr-card p-6 sm:p-8">
            <h2 className="sr-disp text-[clamp(1.7rem,4.2vw,2.4rem)] leading-tight">Get a free estimate</h2>
            <p className="mt-1.5 text-[15px]" style={{ color: "var(--mute)" }}>
              Tell us the building and the job. Or call {TEL_FMT} — someone picks up.
            </p>
            {enviado ? (
              <p className="mt-5 rounded-2xl px-4 py-3 text-[15px] font-semibold"
                style={{ background: "rgba(245,166,35,.1)", color: "var(--ambar)" }}>
                Request received. We will come back with a real number, not a range.
              </p>
            ) : (
              <form onSubmit={enviar} className="mt-5 grid gap-3 sm:grid-cols-2">
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Your name" className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                  style={{ background: "rgba(243,235,223,.05)", border: "1px solid var(--linha)", color: "var(--creme)" }} />
                <input required type="tel" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })}
                  placeholder="Phone we can call back" className="rounded-2xl px-4 py-3 text-[15px] outline-none"
                  style={{ background: "rgba(243,235,223,.05)", border: "1px solid var(--linha)", color: "var(--creme)" }} />
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="rounded-2xl px-4 py-3 text-[15px] outline-none sm:col-span-2"
                  style={{ background: "#2F2419", border: "1px solid var(--linha)", color: form.tipo ? "var(--creme)" : "var(--mute)" }}>
                  <option value="">What kind of work?</option>
                  {GRUPOS.map((g) => <option key={g.g} value={g.g}>{g.g}</option>)}
                </select>
                <textarea required rows={2} value={form.oque} onChange={(e) => setForm({ ...form, oque: e.target.value })}
                  placeholder="What needs doing? (stoop, facade, bathroom, roof…)"
                  className="rounded-2xl px-4 py-3 text-[15px] outline-none sm:col-span-2"
                  style={{ background: "rgba(243,235,223,.05)", border: "1px solid var(--linha)", color: "var(--creme)" }} />
                                  {erroEnvio && (
                    <p className="sm:col-span-2 text-[13.5px] font-semibold" style={{ color: "var(--ambar)" }}>{erroEnvio}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button type="submit" className="sr-b sr-b-call">Send the request</button>
                  <a href={`tel:${TEL}`} className="text-[13.5px] font-semibold" style={{ color: "var(--ambar)" }}>
                    or call {TEL_FMT} →
                  </a>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8">
          <h2 className="sr-disp text-[clamp(1.8rem,4.4vw,2.7rem)] leading-none">Straight answers</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q} className="sr-card p-5">
                <h3 className="text-[15.5px] font-bold">{q}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: "var(--mute)" }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        <footer id="contact" className="mx-auto max-w-6xl px-5 pb-16 pt-4">
          <div className="sr-card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <img src="/novo/srgeneral/logo.png" alt="SR General Construction NYC" className="h-14 w-auto" />
                <p className="sr-num mt-3 text-[15px] font-bold" style={{ color: "var(--ambar)" }}>{TEL_FMT}</p>
                <p className="mt-1 text-[14px]" style={{ color: "var(--mute)" }}>{EMAIL}</p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--mute)" }}>
                  Brooklyn, NY · licensed & insured · NYC DOB certified · since 2002
                </p>
              </div>
              <a className="sr-b sr-b-call" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
            </div>
            <p className="mt-6 border-t pt-4 text-[11.5px]" style={{ borderColor: "var(--linha)", color: "var(--mute)" }}>
              ⚡ site + AI by <a href="https://guileoai.com" className="underline" style={{ color: "var(--mute)" }}>Guileo</a>
            </p>
          </div>
        </footer>

        <div className="sr-bar sm:hidden">
          <a className="sr-b sr-b-call w-full" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
        </div>
      </div>
    </div>
  );
}
