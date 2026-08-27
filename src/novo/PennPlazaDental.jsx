/* PENN PLAZA DENTAL CENTER — reconstrução (prospect real, pennplazadental.com)
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   O NEGÓCIO: Dr. Julien Zenker, 7 Pennsylvania Plaza Suite 302 — literalmente EM CIMA da Penn
   Station. (212) 736-0670. 4,5★ com apenas 8 avaliações.

   O QUE O SITE DELES FAZ DE ERRADO (tudo verificado no HTML servido, nada suposto):
     · **A hero é uma grade de BANCO DE IMAGEM.** Os nomes dos arquivos publicados provam:
       `isteam/stock/11787`, `pexels-cedric-fauntleroy-4270367.jpg`, `AdobeStock_259104935.jpeg`.
       A página que vende "Individualized Dental Care" e "we value the care in dental care" é
       ilustrada inteiramente por desconhecidos de estúdio. Em consultório, confiança É o produto.
     · **O maior ativo deles não está escrito em lugar nenhum:** estão sobre a estação mais
       movimentada do hemisfério ocidental. O endereço aparece só no rodapé.
     · 2.433 caracteres de texto · schema genérico `LocalBusiness` em vez de `Dentist` ·
       `<title>` terminando em "- Home" · "Copyright © 2024" (parado há dois anos).

   ⚠️ ESTE SITE NÃO TEM UMA FOTO. De propósito: eu não tenho foto real do consultório nem da
   equipe, e trocar o banco de imagem deles por outro banco de imagem seria repetir o defeito com
   fotos diferentes. Site sem foto vence site com estranho: pelo menos não afirma nada falso.
   O que entra é o que é DELES — a logo, o endereço, as promessas que eles escreveram.

   IDENTIDADE: azul cobalto #00319D e o verde da folha #1A9E4B, tirados da logo (um dente que
   também é uma maçã).
   CONCEITO: **O QUADRO DE PARTIDAS** — eles estão dentro de uma estação, e o nome já diz isso.
   Tipografia de sinalização, tabela de horários em mono, fundo porcelana (consultório é limpo) com
   o painel escuro do quadro. As promessas viram linhas de um quadro, não parágrafos.
   (Nonstop = despacho · Astoria = van · Queens = a rede · Sideris = o emblema · SR = a fiada ·
   Penn Plaza = o quadro de partidas.) */
import { useState, useEffect, useRef, useCallback } from "react";
import Mascote from "./Mascote.jsx";

const TEL = "+12127360670";
const TEL_FMT = "(212) 736-0670";
const ENDERECO = "7 Pennsylvania Plaza, Suite 302, New York, NY 10001";
const DENTISTA = "Dr. Julien Zenker";

/* As quatro promessas são DELES, encurtadas para caber num quadro. Nenhuma foi inventada:
   estão publicadas no site atual como parágrafos. */
const QUADRO = [
  { t: "The care in dental care", d: "When you're nervous or in pain, the little things matter. You're put at ease from the moment you walk in." },
  { t: "Experience, modern dentistry", d: `${DENTISTA} evaluates what you need and builds a plan that works for you.` },
  { t: "We don't overbook", d: "Your time is valuable. Appointments are timed so you are not left waiting." },
  { t: "Insurance handled for you", d: "We file the forms and find out exactly what you're covered for. No insurance? A flexible plan instead." },
];

const FAQ = [
  ["Where exactly are you?", "7 Pennsylvania Plaza, Suite 302 — inside the Penn Plaza building, straight up from Penn Station."],
  ["Do you take my insurance?", "We handle all the filing and tell you exactly what you're covered for before you commit."],
  ["What if I don't have insurance?", "We set up a flexible payment plan. Simple options, no surprises."],
  ["Will I be kept waiting?", "We don't overbook. Appointments are spaced so your visit starts when it should."],
];

/* PRESENÇA: o schema deles é `LocalBusiness` genérico. Um consultório é `Dentist` — e a diferença
   não é cosmética: é o que faz aparecer numa busca por dentista. */
const SITE_URL = "https://guileoai.com/novo/penn-plaza-dental";
const TITULO = "Penn Plaza Dental Center — Dentist Above Penn Station, NYC";
const DESC = "Dr. Julien Zenker at 7 Penn Plaza, Suite 302 — two minutes from your train. Appointments that are not overbooked, insurance filed for you. Call (212) 736-0670.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["name", "twitter:card", "summary_large_image"],
];
const LD = () => ([
  { "@context": "https://schema.org", "@type": "Dentist",
    name: "Penn Plaza Dental Center", url: SITE_URL, telephone: TEL,
    image: "https://guileoai.com/novo/pennplaza/logo.png",
    address: { "@type": "PostalAddress", streetAddress: "7 Pennsylvania Plaza, Suite 302",
      addressLocality: "New York", addressRegion: "NY", postalCode: "10001", addressCountry: "US" },
    aggregateRating: { "@type": "AggregateRating", ratingValue: "4.5", reviewCount: "8" },
    employee: { "@type": "Person", name: DENTISTA, jobTitle: "Dentist" },
    // O que ninguém escreveu ainda e é o ativo maior: onde eles estão.
    areaServed: { "@type": "Place", name: "Midtown Manhattan, Penn Station, Herald Square, Chelsea" },
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

export default function PennPlazaDental() {
  const [form, setForm] = useState({ nome: "", tel: "", quando: "", oque: "" });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [heroRef, heroOk] = useReveal();
  const [hora, setHora] = useState("");

  /* O DADO VIVO: a hora em Nova York. Num consultório dentro de uma estação, a hora é o que o
     passageiro está olhando de qualquer jeito — e é ela que prova que a página está viva. */
  useEffect(() => {
    const tick = () => setHora(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date()));
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

  const enviar = useCallback(async (e) => {
    e.preventDefault();
    setErroEnvio("");
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "penn-plaza-dental", negocio: "Penn Plaza Dental Center",
          nome: form.nome, telefone: form.tel, mensagem: `[${form.quando || "—"}] ${form.oque}` }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErroEnvio("Couldn't send that — please call us, the phone always works.");
  }, [form]);

  return (
    <div className="pp-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;800&family=DM+Mono:wght@400;500&display=swap');
        .pp-raiz{
          --porcelana:#F6F8FB; --branco:#FFFFFF; --tinta:#0E1A2B; --tinta2:#3C4B60;
          --cobalto:#00319D; --cobalto-c:#0B47C8; --folha:#1A9E4B; --borda:#DCE3EC;
          --quadro:#0B1626; --quadro2:#132339;
          background:var(--porcelana); color:var(--tinta);
          font-family:'Public Sans',system-ui,-apple-system,sans-serif; min-height:100vh;
          overflow-x:hidden; position:relative;
        }
        .pp-disp{font-weight:800; letter-spacing:-.03em; text-wrap:balance;}
        .pp-mono{font-family:'DM Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}

        .pp-card{background:var(--branco); border:1px solid var(--borda); border-radius:18px;
          box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 18px 40px -34px rgba(14,26,43,.45);}

        /* O QUADRO DE PARTIDAS — o único bloco escuro da página. É a estação dentro do
           consultório: linhas assentadas, mono nos rótulos, um filete âmbar de sinalização. */
        .pp-quadro{background:linear-gradient(180deg,var(--quadro2),var(--quadro)); border-radius:20px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.09), 0 26px 60px -38px rgba(11,22,38,.9);}
        .pp-linha{border-top:1px solid rgba(255,255,255,.09);}

        .pp-b{display:inline-flex; align-items:center; justify-content:center; gap:.5rem; border-radius:999px;
          font-weight:700; text-decoration:none; transition:transform .16s ease, box-shadow .22s ease, background .22s ease;}
        .pp-b:active{transform:scale(.98)}
        .pp-b-1{background:linear-gradient(180deg,var(--cobalto-c),var(--cobalto) 55%,#00246F); color:#fff;
          padding:1rem 1.9rem; font-size:1.06rem;
          box-shadow:0 18px 40px -14px rgba(0,49,157,.5), inset 0 1px 0 rgba(255,255,255,.35), inset 0 -2px 0 rgba(0,20,70,.35);}
        .pp-b-1:hover{box-shadow:0 24px 52px -14px rgba(0,49,157,.68), inset 0 1px 0 rgba(255,255,255,.48), inset 0 -2px 0 rgba(0,20,70,.35);}
        .pp-b-2{background:var(--branco); color:var(--tinta); padding:.85rem 1.5rem; font-size:1rem; border:1px solid var(--borda);}
        .pp-b-2:hover{border-color:var(--cobalto); background:#FAFCFF;}

        .pp-rev{opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1);}
        .pp-rev.on{opacity:1; transform:none;}
        @media (prefers-reduced-motion:reduce){ .pp-rev{opacity:1;transform:none;transition:none} }
        @media (max-width:639px){ .pp-raiz{padding-bottom:92px} }
        .pp-bar{position:fixed; left:0; right:0; bottom:0; z-index:40; background:var(--branco);
          border-top:1px solid var(--borda); padding:.65rem .9rem; box-shadow:0 -8px 24px -18px rgba(14,26,43,.4);}
      `}</style>

      <header ref={heroRef} className="mx-auto max-w-6xl px-5 pt-7 pb-9">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <img src="/novo/pennplaza/logo.png" alt="Penn Plaza Dental Center" className="h-12 w-auto sm:h-14" />
          <a href={`tel:${TEL}`} className="pp-mono text-[15px] font-semibold" style={{ color: "var(--cobalto)" }}>{TEL_FMT}</a>
        </nav>

        <div className={`pp-rev ${heroOk ? "on" : ""} mt-10 grid items-start gap-8 lg:grid-cols-[1.05fr_.95fr]`}>
          <div>
            <span className="pp-mono inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium"
              style={{ background: "rgba(0,49,157,.07)", boxShadow: "inset 0 0 0 1px rgba(0,49,157,.25)", color: "var(--cobalto)" }}>
              7 Penn Plaza · Suite 302 · <span>{hora} NYC</span>
            </span>
            <h1 className="pp-disp mt-5 text-[clamp(2rem,4.6vw,3.1rem)] leading-[1.05]">
              A dentist two minutes<br /><span style={{ color: "var(--cobalto)" }}>from your train.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
              {DENTISTA} at Penn Plaza Dental Center — straight up from Penn Station, above the
              concourse you already walk through.
            </p>
            <p className="mt-5 flex items-start gap-3 text-[15.5px] font-semibold">
              <span className="mt-1 h-[18px] w-[3px] shrink-0 rounded-full" style={{ background: "var(--folha)" }} />
              We don't overbook — your appointment starts when it says it does.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a className="pp-b pp-b-1" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
              <a className="pp-b pp-b-2" href="#marcar">Schedule an appointment</a>
            </div>
          </div>

          {/* O QUADRO — as quatro promessas DELES lidas como linhas de partida, não parágrafos. */}
          <div className="pp-quadro p-5 sm:p-6" style={{ color: "#E8EEF7" }}>
            <div className="pp-mono flex items-center justify-between text-[11px] uppercase tracking-[.16em]" style={{ color: "#8FA6C4" }}>
              <span>What you can count on</span><span>{hora}</span>
            </div>
            <div className="mt-4">
              {QUADRO.map((q, i) => (
                <div key={q.t} className={i ? "pp-linha pt-3.5 mt-3.5" : ""}>
                  <div className="text-[15.5px] font-bold">{q.t}</div>
                  <div className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "#A9BCD4" }}>{q.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── ONDE FICA: o ativo que o site atual só cita no rodapé. */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="pp-card p-6 sm:p-8">
          {/* O consultório não tem UMA foto própria — nem da equipe, nem da sala. O site atual
              enche o vazio com banco de imagem; a regra da casa proíbe isso, porque uma foto de
              estúdio ali AFIRMA "esta é a nossa sala" e é mentira. O desenho não afirma nada:
              é visivelmente um desenho, na cor da logo deles, e resolve o vazio sem inventar prova. */}
          <div className="float-right ml-5 hidden sm:block" aria-hidden="true">
            <Mascote variante="dente" cor="var(--cobalto)" tamanho={168} />
          </div>
          <h2 className="pp-disp text-[clamp(1.7rem,4.2vw,2.4rem)] leading-tight">
            You already walk past the door.
          </h2>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
            Penn Plaza Dental Center is at <b style={{ color: "var(--tinta)" }}>{ENDERECO}</b> — inside
            the Penn Plaza building, directly above the station. If you commute through Penn, the
            appointment costs you the walk upstairs and nothing else: no train, no crosstown, no
            afternoon gone.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[["Penn Station", "Straight up from the concourse"],
              ["Herald Square", "Six blocks"],
              ["Chelsea & Midtown", "A short walk either way"]].map(([a, b]) => (
              <div key={a} className="rounded-2xl px-4 py-3" style={{ background: "rgba(0,49,157,.05)", border: "1px solid var(--borda)" }}>
                <div className="text-[14.5px] font-bold">{a}</div>
                <div className="text-[13px]" style={{ color: "var(--tinta2)" }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARCAR — o pedido começa na página. */}
      <section id="marcar" className="mx-auto max-w-6xl px-5 py-8">
        <div className="pp-card p-6 sm:p-8">
          <h2 className="pp-disp text-[clamp(1.7rem,4.2vw,2.4rem)] leading-tight">Schedule an appointment</h2>
          <p className="mt-1.5 text-[15px]" style={{ color: "var(--tinta2)" }}>
            Tell us when works and what is going on. Or call {TEL_FMT} — someone picks up.
          </p>
          {enviado ? (
            <p className="mt-5 rounded-2xl px-4 py-3 text-[15px] font-semibold"
              style={{ background: "rgba(26,158,75,.1)", color: "var(--folha)" }}>
              Request received. If you are in pain right now, call {TEL_FMT} — that is always faster.
            </p>
          ) : (
            <form onSubmit={enviar} className="mt-5 grid gap-3 sm:grid-cols-2">
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Your name" className="rounded-2xl border px-4 py-3 text-[15px] outline-none"
                style={{ borderColor: "var(--borda)" }} />
              <input required type="tel" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })}
                placeholder="Phone we can call back" className="rounded-2xl border px-4 py-3 text-[15px] outline-none"
                style={{ borderColor: "var(--borda)" }} />
              <select value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })}
                className="rounded-2xl border bg-white px-4 py-3 text-[15px] outline-none sm:col-span-2"
                style={{ borderColor: "var(--borda)", color: form.quando ? "var(--tinta)" : "var(--tinta2)" }}>
                <option value="">When suits you?</option>
                <option>Before work</option><option>Lunch hour</option>
                <option>After work</option><option>Any time — I'm flexible</option>
              </select>
              <textarea required rows={2} value={form.oque} onChange={(e) => setForm({ ...form, oque: e.target.value })}
                placeholder="What is going on? (cleaning, pain, chipped tooth, check-up…)"
                className="rounded-2xl border px-4 py-3 text-[15px] outline-none sm:col-span-2"
                style={{ borderColor: "var(--borda)" }} />
              {erroEnvio && (
                <p className="sm:col-span-2 text-[13.5px] font-semibold" style={{ color: "#C0392B" }}>{erroEnvio}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <button type="submit" className="pp-b pp-b-1">Request the appointment</button>
                <a href={`tel:${TEL}`} className="text-[13.5px] font-semibold" style={{ color: "var(--cobalto)" }}>
                  or call {TEL_FMT} →
                </a>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <h2 className="pp-disp text-[clamp(1.7rem,4.2vw,2.4rem)] leading-none">Straight answers</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q} className="pp-card p-5">
              <h3 className="text-[15.5px] font-bold">{q}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="contact" className="mx-auto max-w-6xl px-5 pb-16 pt-4">
        <div className="pp-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <img src="/novo/pennplaza/logo.png" alt="Penn Plaza Dental Center" className="h-12 w-auto" />
              <p className="mt-3 text-[14.5px]" style={{ color: "var(--tinta2)" }}>{ENDERECO}</p>
              <p className="pp-mono mt-1 text-[15px] font-semibold" style={{ color: "var(--cobalto)" }}>{TEL_FMT}</p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--tinta2)" }}>{DENTISTA}</p>
            </div>
            <a className="pp-b pp-b-1" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
          </div>
          <p className="mt-6 border-t pt-4 text-[11.5px]" style={{ borderColor: "var(--borda)", color: "var(--tinta2)" }}>
            ⚡ site + AI by <a href="https://guileoai.com" className="underline" style={{ color: "var(--tinta2)" }}>Guileo</a>
          </p>
        </div>
      </footer>

      <div className="pp-bar sm:hidden">
        <a className="pp-b pp-b-1 w-full" href={`tel:${TEL}`}>Call {TEL_FMT}</a>
      </div>
    </div>
  );
}
