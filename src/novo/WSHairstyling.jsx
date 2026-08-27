/* WS HAIRSTYLING NYC — wshairstyling.com reconstruído
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   MEDIDO NO SITE DELES (25/08, no DOM renderizado — não no fonte):
     tel: ............... 0    o (212) 533-3344 não disca em lugar nenhum
     mailto: ............ 0
     formulários ........ 0
     botão de agendar ... aparece como `{{ bookingButtonText }}` — a variável do tema nunca
                          renderizou. O botão principal do salão mostra código na tela.
   Um salão 5,0★ com 111 avaliações, colado na NYU, com o cardápio inteiro publicado — e nenhuma
   porta que abre no celular.

   IDENTIDADE (DELES, extraída da logo real): champanhe #DACB96 sobre carvão #262728. O arquivo
   chama-se "site-logo-yellow" mas de amarelo não tem nada: é champanhe sobre grafite, e é uma
   combinação boa demais para trocar.

   O CONCEITO: A CADEIRA ABERTA. O que separa este salão dos outros da Broadway não é a técnica —
   é que ele ACEITA QUEM CHEGA (walk-ins: yes) e dá 20% para estudante da NYU com carteirinha,
   estando a 3 minutos do campus. Então a página inteira gira em torno de uma pergunta que o
   cliente real faz: "dá pra ir agora?". O relógio de Nova York responde ao vivo, o preço está na
   cara (eles publicam tudo, o que quase nenhum salão faz), e o desconto da NYU é o primeiro
   cartaz, não uma nota de rodapé.
*/
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+12125333344";
const TEL_FMT = "(212) 533-3344";
const ENDERECO = "780 Broadway, Manhattan, New York, NY 10003";
const VAGARO = "https://www.vagaro.com/wshairstyling";
const B = "/novo/ws-hairstyling";

/* Seg–Sáb 10h–19h, Domingo fechado — publicado por eles no Vagaro. */
const ABRE = 10, FECHA = 19;

/* ⚠️ O CARDÁPIO É DELES, LIDO NO DOM RENDERIZADO — não no texto achatado da página.
   A primeira tentativa leu o texto corrido e casou "Up to 8 y.o." e "toner not included" como se
   fossem NOMES de serviço, porque num texto achatado a linha anterior ao preço nem sempre é o
   nome. Lendo pelo nó do DOM, nome/preço/condição vêm do MESMO cartão. Preço errado na página de
   um salão não é detalhe: é o cliente chegando com a expectativa errada e a recepção pagando. */
const MENU = [
  { g: "Haircuts", itens: [
    ["Women's Haircut & Style", "$90–$140", "medium to long length"],
    ["Master Stylist Men's Haircut", "$60–$75", ""],
    ["Pixie Cut", "$75–$100", ""],
    ["Kid's Haircut", "Starting at $40", "up to 8 y.o."],
    ["Bang Trim", "$20–$35", ""],
  ]},
  { g: "Blowout & Styling", itens: [
    ["Wash / Blowout", "$60 · $70 · $80 · $100", "by length and thickness"],
    ["Hot Tools (flat or curling iron)", "$20–$35", "wash and blowout not included"],
    ["Updo", "$70–$120", ""],
  ]},
  { g: "Color — L'Oréal Professionnel", itens: [
    ["Roots Touch Up", "$90–$130", ""],
    ["INOA (no ammonia)", "$100–$140", ""],
    ["Single Process", "$100–$200", ""],
    ["Double Process Roots w/ Lightener", "$180–$250", "toner included"],
    ["Double Process / Color Correction", "Price upon request", ""],
    ["Toner", "$60–$100", ""],
    ["Gloss", "$50–$100", "blowout not included"],
  ]},
  { g: "Highlights & Blonding", itens: [
    ["Partial Highlights", "$120–$180", "toner not included"],
    ["Half Head of Highlights", "$150–$250", "toner not included"],
    ["Full Head of Highlights", "$250–$450", "toner not included"],
    ["Balayage", "$250–$450", "toner not included"],
  ]},
  { g: "Treatments", itens: [
    ["Organic Keratin / Cezanne", "$320–$400", ""],
    ["Brazilian Blowout", "$350–$450", ""],
    ["Deep Conditioning", "$30", "blowout not included"],
    ["Kérastase Fusio-Dose", "$50", "blowout not included"],
  ]},
];

/* Os quatro itens de estudante estão publicados no site deles com "20% off of regular price,
   with valid ID". Não invento preço: mostro a REGRA, que é o que o estudante precisa saber. */
const NYU = ["Women's Haircut (air dry)", "Women's Haircut & Style", "Men's Haircut", "Wash / Blowout"];

const FAQ = [
  ["Do you take walk-ins?", "Yes. Walk-ins are welcome — call (212) 533-3344 first and we'll tell you what's open right now."],
  ["I'm an NYU student. What do I get?", "20% off the regular price on haircuts, styling and wash/blowout, with a valid ID. We're three minutes from campus."],
  ["Why is there a price range?", "Length and thickness change the time in the chair. The range is honest: we tell you where you land before we start."],
  ["Can I book online?", "Yes — booking runs through Vagaro, and the phone always works too."],
];

const SITE_URL = "https://guileoai.com/novo/ws-hairstyling";
const TITULO = "WS Hairstyling NYC — Hair Salon at 780 Broadway, Manhattan";
const DESC = "Hair salon at 780 Broadway, three minutes from NYU. Cuts, color, balayage, keratin and blowouts — prices published, walk-ins welcome, 20% off for NYU students with valid ID. Call (212) 533-3344.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["name", "twitter:card", "summary_large_image"],
];
const LD = () => ([
  { "@context": "https://schema.org", "@type": "HairSalon",
    name: "WS Hairstyling NYC", url: SITE_URL, telephone: TEL,
    priceRange: "$20–$450", image: `https://guileoai.com${B}/logo.svg`,
    address: { "@type": "PostalAddress", streetAddress: "780 Broadway",
      addressLocality: "New York", addressRegion: "NY", postalCode: "10003", addressCountry: "US" },
    areaServed: { "@type": "Place", name: "Greenwich Village, NoHo, East Village and NYU, Manhattan" },
    aggregateRating: { "@type": "AggregateRating", ratingValue: "5.0", reviewCount: "111" },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "10:00", closes: "19:00" },
    ],
    sameAs: [VAGARO, "https://wshairstyling.com"],
    potentialAction: { "@type": "ReserveAction",
      target: { "@type": "EntryPoint", urlTemplate: VAGARO,
        actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/IOSPlatform", "http://schema.org/AndroidPlatform"] },
      result: { "@type": "Reservation", name: "Salon appointment" } },
    hasOfferCatalog: { "@context": "https://schema.org", "@type": "OfferCatalog", name: "Services",
      itemListElement: MENU.flatMap((g) => g.itens.map(([n]) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: n } }))) },
  },
  { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
]);

export default function WSHairstyling() {
  const [form, setForm] = useState({ nome: "", tel: "", servico: "", quando: "" });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [rel, setRel] = useState({ hora: "", aberto: false, ateFechar: "" });
  const [aberto, setAberto] = useState(null);
  const pedido = useRef(null);

  /* O DADO VIVO: a resposta à pergunta que o cliente realmente faz — "dá pra ir agora?".
     Hora, aberto/fechado e quanto falta pra fechar saem do MESMO tick: relógios separados
     poderiam mostrar "aberto" ao lado de um horário fora do expediente, um desmentindo o outro. */
  useEffect(() => {
    const tick = () => {
      const f = (o) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...o }).format(new Date());
      const h = Number(f({ hour: "numeric", hour12: false }));
      const m = Number(f({ minute: "numeric" }));
      const dom = f({ weekday: "short" }) === "Sun";
      const abertoAgora = !dom && h >= ABRE && h < FECHA;
      const faltam = abertoAgora ? (FECHA - h - 1) * 60 + (60 - m) : 0;
      setRel({
        hora: f({ hour: "numeric", minute: "2-digit", hour12: true }),
        aberto: abertoAgora,
        ateFechar: faltam > 60 ? `${Math.floor(faltam / 60)}h ${faltam % 60}m left today` : faltam > 0 ? `${faltam} min left today` : "",
      });
    };
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
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

  /* Enfeite que trabalha: clicar num serviço do cardápio leva ao pedido COM ele preenchido. */
  const escolher = useCallback((nome) => {
    setForm((f) => ({ ...f, servico: nome }));
    pedido.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const enviar = useCallback(async (e) => {
    e.preventDefault();
    setErroEnvio("");
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "ws-hairstyling", negocio: "WS Hairstyling NYC",
          nome: form.nome, telefone: form.tel,
          mensagem: `[${form.servico || "service not stated"}] ${form.quando || "any time"}` }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErroEnvio("That didn't send — please call (212) 533-3344, the phone always works.");
  }, [form]);

  return (
    <div className="ws-raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Jost:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .ws-raiz{
          /* Da logo REAL deles: champanhe sobre carvão. */
          --carvao:#262728; --carvao2:#1C1D1E; --carvao3:#313233;
          --champ:#DACB96; --champ-c:#EBDCA8; --champ-e:#B8A776;
          --creme:#F4F1E9; --creme2:#B9B4A6; --linha:#3B3C3D;
          background:var(--carvao); color:var(--creme); min-height:100vh;
          font-family:'Jost',system-ui,-apple-system,sans-serif;
          -webkit-font-smoothing:antialiased;
        }
        .ws-disp{font-family:'Fraunces',Georgia,serif; font-weight:700; letter-spacing:-.01em;}
        .ws-mono{font-family:'IBM Plex Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}
        .ws-rot{font-family:'IBM Plex Mono',monospace; font-size:10.5px; font-weight:500;
          letter-spacing:.22em; text-transform:uppercase;}

        .ws-b{display:inline-flex; align-items:center; gap:.5rem; border-radius:999px;
          font-family:'Jost',sans-serif; font-weight:600; font-size:15.5px; letter-spacing:.01em;
          padding:14px 28px; text-decoration:none; cursor:pointer; border:1px solid transparent;
          transition:transform .12s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;}
        .ws-b:active{transform:scale(.985);}
        .ws-b-1{background:linear-gradient(180deg,var(--champ-c),var(--champ) 55%,var(--champ-e));
          color:#241F12; box-shadow:0 1px 0 rgba(255,255,255,.5) inset, 0 12px 28px -16px rgba(218,203,150,.9);}
        .ws-b-2{background:transparent; color:var(--creme); border-color:var(--linha);}
        .ws-b-2:hover{border-color:var(--champ); color:var(--champ);}

        .ws-cartao{background:var(--carvao2); border:1px solid var(--linha); border-radius:20px;}

        /* A LINHA DO CARDÁPIO: nome à esquerda, preço à direita, pontilhado no meio — a régua de
           menu que qualquer pessoa lê sem instrução. Toda linha é botão: leva ao pedido preenchido. */
        .ws-linha{display:flex; align-items:baseline; gap:.6rem; width:100%; text-align:left;
          background:transparent; border:0; cursor:pointer; padding:9px 0; color:inherit;
          border-bottom:1px solid rgba(255,255,255,.05);}
        .ws-linha:hover .ws-nome{color:var(--champ);}
        .ws-pontos{flex:1 1 auto; border-bottom:1px dotted rgba(255,255,255,.22); transform:translateY(-3px);}
        .ws-nome{font-size:15.5px; transition:color .16s ease;}
        .ws-preco{font-family:'IBM Plex Mono',monospace; font-size:14px; color:var(--champ); white-space:nowrap;}
        .ws-cond{display:block; font-size:12px; color:var(--creme2); margin-top:1px;}

        .ws-inp{width:100%; border-radius:14px; border:1px solid var(--linha); background:var(--carvao3);
          padding:13px 16px; font-size:15px; outline:none; color:var(--creme);
          transition:border-color .18s ease, box-shadow .18s ease;}
        .ws-inp:focus{border-color:var(--champ); box-shadow:0 0 0 3px rgba(218,203,150,.16);}
        .ws-inp::placeholder{color:#8C877B;}
        @media (prefers-reduced-motion:reduce){*{transition:none!important; animation:none!important;}}
      `}</style>

      {/* ── CABEÇALHO: a logo real e o telefone que hoje não disca. */}
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 pb-2 pt-6">
        <img src={`${B}/logo.svg`} alt="WS Hairstyling NYC" width="56" height="56"
          className="h-[52px] w-[52px] rounded-xl" />
        <a href={`tel:${TEL}`} className="ws-b ws-b-1">Call {TEL_FMT}</a>
      </header>

      {/* ── A CADEIRA ABERTA — a pergunta que o cliente faz de verdade. */}
      <section className="mx-auto max-w-6xl px-5 pt-4">
        <div className="ws-cartao overflow-hidden p-6 sm:p-10">
          <div className="ws-rot" style={{ color: "var(--champ-e)" }}>780 Broadway · three minutes from NYU</div>
          <h1 className="ws-disp mt-3 text-[clamp(2.2rem,6vw,4rem)] leading-[1.02]">
            Yes, you can come<br />in <span style={{ color: "var(--champ)" }}>right now</span>.
          </h1>
          <p className="mt-4 max-w-xl text-[16.5px] leading-relaxed" style={{ color: "var(--creme2)" }}>
            WS Hairstyling takes walk-ins. Every price is on this page — no “call for pricing”, no
            surprise at the register. And if you have an NYU ID, 20% comes off before you sit down.
          </p>

          {/* O SELO VIVO — único do site, e ele INFORMA. */}
          <div className="mt-6 inline-flex flex-wrap items-center gap-2.5 rounded-full border px-4 py-2"
            style={{ borderColor: "var(--linha)", background: "var(--carvao3)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: rel.aberto ? "#7BD98F" : "var(--champ-e)" }} />
            <span className="ws-mono text-[12.5px]">
              {rel.aberto ? "Open now" : "Closed"} · {rel.hora} NYC
              {rel.ateFechar ? <span style={{ color: "var(--creme2)" }}> · {rel.ateFechar}</span> : null}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href={`tel:${TEL}`} className="ws-b ws-b-1">Call {TEL_FMT}</a>
            <a href="/novo/ws-hairstyling/book" className="ws-b ws-b-2">Book online</a>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2">
            {[["5.0 ★", "111 reviews"], ["Walk-ins", "welcome"], ["Mon–Sat", "10am – 7pm"], ["NYU ID", "20% off"]].map(([a, b]) => (
              <div key={a}>
                <div className="ws-mono text-[15px]" style={{ color: "var(--champ)" }}>{a}</div>
                <div className="ws-rot mt-0.5" style={{ color: "var(--creme2)" }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── O DESCONTO DA NYU COMO CARTAZ, não nota de rodapé. */}
      <section className="mx-auto max-w-6xl px-5 pt-5">
        <div className="ws-cartao p-6 sm:p-7" style={{ borderColor: "rgba(218,203,150,.4)" }}>
          <div className="ws-rot" style={{ color: "var(--champ)" }}>Student rate</div>
          <h2 className="ws-disp mt-2 text-[clamp(1.5rem,3.6vw,2.2rem)] leading-tight">
            20% off with a valid NYU ID.
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {NYU.map((n) => (
              <span key={n} className="rounded-full border px-3.5 py-1.5 text-[13.5px]"
                style={{ borderColor: "var(--linha)", background: "var(--carvao3)" }}>{n}</span>
            ))}
          </div>
          <p className="mt-3 text-[13.5px]" style={{ color: "var(--creme2)" }}>
            Bring the ID. Prices still vary with length and thickness — we tell you where you land
            before we start.
          </p>
        </div>
      </section>

      {/* ── O CARDÁPIO INTEIRO. É o ativo deles e quase nenhum salão publica. */}
      <section id="menu" className="mx-auto max-w-6xl px-5 py-8">
        <h2 className="ws-disp text-[clamp(1.7rem,4.2vw,2.6rem)] leading-tight">Every price, in the open.</h2>
        <p className="mt-1.5 max-w-xl text-[15px]" style={{ color: "var(--creme2)" }}>
          Tap any line and it comes with you to the request below.
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {MENU.map((g) => (
            <div key={g.g} className="ws-cartao p-5 sm:p-6">
              <div className="ws-rot" style={{ color: "var(--champ-e)" }}>{g.g}</div>
              <div className="mt-3">
                {g.itens.map(([n, p, cond]) => (
                  <button key={n} type="button" onClick={() => escolher(n)} className="ws-linha">
                    <span className="min-w-0">
                      <span className="ws-nome block">{n}</span>
                      {cond && <span className="ws-cond">{cond}</span>}
                    </span>
                    <span className="ws-pontos" />
                    <span className="ws-preco">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── O PEDIDO — a folha que o site deles não tem. */}
      <section ref={pedido} id="book" className="mx-auto max-w-6xl px-5 pb-8">
        <div className="ws-cartao p-6 sm:p-8">
          <h2 className="ws-disp text-[clamp(1.6rem,4vw,2.4rem)] leading-tight">Ask for a time.</h2>
          <p className="mt-2 max-w-xl text-[15.5px]" style={{ color: "var(--creme2)" }}>
            Tell us what you want and when. We call you back with the first chair that fits — or
            call {TEL_FMT} and someone picks up.
          </p>
          {enviado ? (
            <div className="mt-6 rounded-2xl px-5 py-4"
              style={{ background: "rgba(218,203,150,.1)", border: "1px solid rgba(218,203,150,.35)" }}>
              <div className="ws-disp text-[18px]" style={{ color: "var(--champ)" }}>Got it.</div>
              <p className="mt-1 text-[15px]" style={{ color: "var(--creme2)" }}>
                We'll call you back with a time. If you want to come in today, {TEL_FMT} is faster.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} className="mt-6 grid gap-3 sm:grid-cols-2">
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Your name" className="ws-inp" />
              <input required type="tel" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })}
                placeholder="Phone" className="ws-inp" />
              <input value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })}
                placeholder="What do you want? (tap a service above)" className="ws-inp sm:col-span-2" />
              <select value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })}
                className="ws-inp" style={{ color: form.quando ? "var(--creme)" : "#8C877B" }}>
                <option value="">When?</option>
                <option>Today, as soon as possible</option>
                <option>This week, mornings</option>
                <option>This week, afternoons</option>
                <option>Weekend</option>
                <option>I'm flexible</option>
              </select>
              {erroEnvio && <p className="text-[13.5px] font-semibold sm:col-span-2" style={{ color: "#E8836F" }}>{erroEnvio}</p>}
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <button type="submit" className="ws-b ws-b-1">Ask for a time</button>
                <a href={VAGARO} target="_blank" rel="noreferrer" className="text-[14px] font-semibold" style={{ color: "var(--champ)" }}>
                  or book online →
                </a>
              </div>
            </form>
          )}

          <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--linha)" }}>
            <div className="ws-rot" style={{ color: "var(--creme2)" }}>Good to know</div>
            <div className="mt-3">
              {FAQ.map(([q, a], i) => (
                <div key={q} style={{ borderTop: i ? "1px solid var(--linha)" : "none" }}>
                  <button type="button" onClick={() => setAberto(aberto === q ? null : q)}
                    aria-expanded={aberto === q}
                    className="flex w-full items-center justify-between gap-4 py-3.5 text-left">
                    <span className="text-[15.5px] font-medium">{q}</span>
                    <span className="ws-mono text-[17px]" style={{ color: "var(--champ)" }}>{aberto === q ? "−" : "+"}</span>
                  </button>
                  {aberto === q && <p className="pb-4 text-[15px] leading-relaxed" style={{ color: "var(--creme2)" }}>{a}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="ws-cartao p-7">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <img src={`${B}/logo.svg`} alt="WS Hairstyling NYC" width="44" height="44" className="h-11 w-11 rounded-lg" />
              <div className="ws-rot mt-3" style={{ color: "var(--champ)" }}>Hair salon · Manhattan</div>
            </div>
            <div>
              <div className="ws-rot" style={{ color: "var(--creme2)" }}>Where</div>
              <div className="mt-1.5 text-[15px] leading-relaxed">{ENDERECO}</div>
              <div className="mt-1 text-[13.5px]" style={{ color: "var(--creme2)" }}>Metered parking · walk-ins welcome</div>
            </div>
            <div>
              <div className="ws-rot" style={{ color: "var(--creme2)" }}>Reach us</div>
              <a href={`tel:${TEL}`} className="ws-disp mt-1.5 block text-[20px]" style={{ color: "var(--champ)" }}>{TEL_FMT}</a>
              <a href={VAGARO} target="_blank" rel="noreferrer" className="mt-1 block text-[14px]" style={{ color: "var(--creme2)" }}>Book on Vagaro</a>
              <div className="mt-2 text-[13.5px]" style={{ color: "var(--creme2)" }}>Mon–Sat 10am–7pm · Sunday closed</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
