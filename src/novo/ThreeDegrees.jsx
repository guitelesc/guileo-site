/* THREE DEGREES SALON — threedegreesnyc.com reconstruído · v4 "clone estrutural"
   v4 (Luis, /clone-website): a ESTRUTURA é a DELES — mesma ordem de seções, mesmo acento
   AMARELO #FFC107 (medido no pixel do botão Book da hero real), hero com a foto das cadeiras
   e o headline literal deles ("Where Your Hair Finds Its Style") — com o acabamento padrão
   Guileo aplicado seção a seção (material claro, reveals, quote vivo, Hana).
   Topologia real registrada em docs/research/threedegreesnyc/PAGE_TOPOLOGY.md.
   Fatos novos medidos: Kei Hirata é o FUNDADOR (Tóquio → Vancouver → NY, guia hairdressr);
   imprensa: "Top 31 Best Hair Salons in NYC (2025)"; 2 vídeos da REFINERY29 no salão.
   (v2 abaixo permanece válido como histórico.)
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   MEDIDO NO SITE DELES (25/08, DOM renderizado — Cloudflare barra curl):
     0 tel: · 0 formulário · JSON-LD quebrado · os dois rodapés se CONTRADIZEM sobre segunda
     (/services: "We open on Mondays now! Mon–Sun 9–7" · /appointment: "Mon: Closed")
   5,0★ com 214 reviews; o destino de quem pesquisa "digital perm NYC".

   v2 (Luis: "tire essa cara de AI, foto DO salão, premium, funções de AI à mostra"):
   • HERO agora é a FOTO REAL das mãos trançando — o shokunin literal — com véu direcional washi
     e o headline por cima. Foto de gente trabalhando > retrato posado.
   • Fita de fotos reais do salão (cabides de latão no tijolo, os bloquinhos 3°).
   • Cada grupo do cardápio abre com a foto REAL da categoria (Haircut/Color/Perm/…, deles).
   • Seção "The house answers at 3am": as funções de IA apresentadas como capacidade do SALÃO
     (a Hana), não como produto de tecnologia — e o convite pra FALAR com ela agora
     (o painel de voz do GuiLayer monta automático nesta página).
   • Cara-de-AI removida: grid quebrado com assimetria, rótulo vertical tategaki, grão de papel,
     números de folha — nada de cartão idêntico 4×.
   IDENTIDADE deles: logo "3°" tinta sobre branco → washi/sumi/hanko. Conceito: graus (calor+curva).
*/
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+12122548174";
const TEL_FMT = "(212) 254-8174";
const EMAIL = "info@threedegreesnyc.com";
const ENDERECO = "204 E 6th Street, New York, NY 10003";
const BOOKER = "https://go.booker.com/location/threedegreesnyc/service-menu";
const B = "/novo/three-degrees";

const ESTILISTAS = [
  { n: "Kei", foto: "kei", corte: "$120–160", cita: "I received a cut and digital perm from Kei last week and I had an amazing experience!", quem: "Catherine Shi · Google" },
  { n: "Shawn", foto: "shawn", corte: "$100–150", cita: "Shawn was able to understand my vision and contribute his own expertise and really get something personal to me.", quem: "Google review" },
  { n: "Saeko", foto: "saeko", corte: "$100–150", cita: "My hair was literally 2 different colors but Saeko did an amazing job.", quem: "Erica Pena · Google" },
  { n: "Yuki", foto: "yuki", corte: "$100–130", cita: "I got a digital perm and olaplex treatment today with Yuki and am super happy with the results!", quem: "Google review" },
  { n: "Miho", foto: "miho", corte: "$90–120", cita: null, quem: null },
  { n: "Ab", foto: "ab", corte: "$90–120", cita: null, quem: null },
  { n: "Savannah", foto: "savannah", corte: "$80–110", cita: null, quem: null },
];

const MENU = [
  { g: "Cut", foto: "svc-haircut", itens: [
    ["Haircut", "$90+", "shampoo & blow-dry included · price by stylist"],
    ["Bang / Neck Trim", "$30+", "no shampoo"],
    ["Blow-dry w/ Shampoo", "$40+", ""],
  ]},
  { g: "Color", foto: "svc-color", itens: [
    ["Single Color Process", "$160+", ""],
    ["Bleach Process", "$330+", ""],
    ["Highlights / Balayage", "$330+", ""],
    ["Peekaboo / Point Color", "$290+", ""],
    ["Color Correction / Creative", "$700+", "consultation required"],
  ]},
  { g: "Perm", foto: "svc-perm", destaque: true, itens: [
    ["Perm with Haircut", "$280+", ""],
    ["Digital Perm with Haircut", "$280+", "the one people research"],
    ["Japanese Straightening", "$330+", ""],
    ["Keratin Treatment", "$350+", "zero downtime"],
  ]},
  { g: "Styling & Treatment", foto: "svc-treatment", itens: [
    ["Blow-dry with Shampoo", "$60+", ""],
    ["Updo", "$130+", "weddings & events — email consultation first"],
    ["Deep Conditioner", "$110+", "lasts up to 5 weeks"],
    ["Olaplex w/ any service", "$60+", ""],
  ]},
];

/* Os canais que ESTE negócio realmente usa. Instagram é onde o salão vive (o próprio site deles
   diz "email us for inquiries, not by DM" — ou seja, o DM chega e eles não dão conta: é
   exatamente o buraco que a Hana tapa). Nada de LinkedIn/X aqui: canal que o salão não atende
   é promessa que ninguém cumpre. */
const CANAIS = [
  ["phone", "Phone", "+1 (212) 555-0000"],
  ["whatsapp", "WhatsApp", "+1 (212) 555-0000"],
  ["instagram", "Instagram", "@yourhandle"],
  ["telegram", "Telegram", "@yourhandle"],
  ["email", "Email", "you@email.com"],
];

const FAQ = [
  ["Do I need a consultation before a perm?", "For standard perms, book directly — the stylist assesses your hair first. Color correction and creative colors do require a consultation, and bridal updos start with an email consultation."],
  ["Can I get a perm on bleached hair?", "No — the salon does not perm hair that has been through bleaching. It is a hair-health rule, not a preference."],
  ["Why does the haircut price depend on the stylist?", "Each stylist has their own level and their own book — from $80–110 with Savannah to $120–160 with Kei. You choose the hands."],
  ["How does booking work?", "Online through Booker. A card holds the appointment; nothing is charged until after your visit — card or cash at the end."],
];

const SITE_URL = "https://guileoai.com/novo/three-degrees";
const TITULO = "Three Degrees Salon — Japanese Hair Salon, East Village NYC";
const DESC = "Japanese concept hair salon at 204 E 6th Street, East Village. Digital perm, Japanese straightening, color and precision cuts — 5.0 stars across 214 Google reviews. Prices published per stylist. Call (212) 254-8174.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["property", "og:image", `https://guileoai.com${B}/salao-hero.jpg`],
  ["name", "twitter:card", "summary_large_image"],
];
const LD = () => ([
  { "@context": "https://schema.org", "@type": "HairSalon",
    name: "Three Degrees Salon", url: SITE_URL, telephone: TEL, email: EMAIL,
    priceRange: "$30–$700", image: `https://guileoai.com${B}/salao-hero.jpg`,
    address: { "@type": "PostalAddress", streetAddress: "204 E 6th Street",
      addressLocality: "New York", addressRegion: "NY", postalCode: "10003", addressCountry: "US" },
    areaServed: { "@type": "Place", name: "East Village, NoHo and Lower Manhattan" },
    aggregateRating: { "@type": "AggregateRating", ratingValue: "5.0", reviewCount: "214" },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "09:00", closes: "19:00" },
    ],
    employee: ESTILISTAS.map((e) => ({ "@type": "Person", name: e.n, jobTitle: "Hair Stylist" })),
    sameAs: [BOOKER, "https://threedegreesnyc.com"],
    potentialAction: { "@type": "ReserveAction",
      target: { "@type": "EntryPoint", urlTemplate: BOOKER,
        actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/IOSPlatform", "http://schema.org/AndroidPlatform"] },
      result: { "@type": "Reservation", name: "Salon appointment" } },
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Services",
      itemListElement: MENU.flatMap((g) => g.itens.map(([n]) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: n } }))) },
  },
  { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
]);

/* ── O QUOTE VIVO ──────────────────────────────────────────────────────────────────────────────
   A "IA" do formulário é a matriz REAL deles cruzada na hora — zero modelo, zero rede. Corte é
   por estilista; os demais serviços têm o "a partir de" publicado. O quote NUNCA inventa: quando
   não sabe, diz que a Hana confirma com o front desk. */
const CORTE = { Kei: [120, 160], Shawn: [100, 150], Saeko: [100, 150], Yuki: [100, 130], Miho: [90, 120], Ab: [90, 120], Savannah: [80, 110] };
/* Duração REAL do Booker deles (service-menu, lido 25/08) — é o que faz o cliente planejar o dia,
   e é o dado que nenhum concorrente publica. Corte por estilista; serviço tem a sua. */
const DUR_CORTE = { Kei: "1h 10m", Shawn: "1h", Saeko: "1h", Yuki: "1h", Miho: "1h 15m", Ab: "1h 15m", Savannah: "1h 15m" };
const DUR = {
  "Haircut": "1h–1h 15m", "Bang / Neck Trim": "30m", "Blow-dry w/ Shampoo": "1h",
  "Single Color Process": "2h", "Bleach Process": "3h 30m", "Highlights / Balayage": "3h 30m",
  "Peekaboo / Point Color": "3h 30m", "Color Correction / Creative": "7h",
  "Perm with Haircut": "3h–4h", "Digital Perm with Haircut": "4h",
  "Japanese Straightening": "3h 30m", "Keratin Treatment": "3h",
  "Blow-dry with Shampoo": "1h", "Updo": "1h 30m", "Deep Conditioner": "1h 30m", "Olaplex w/ any service": "1h 30m",
};
const BASE = {
  "Haircut": null, "Bang / Neck Trim": [30, null], "Blow-dry w/ Shampoo": [40, null],
  "Single Color Process": [160, null], "Bleach Process": [330, null], "Highlights / Balayage": [330, null],
  "Peekaboo / Point Color": [290, null], "Color Correction / Creative": [700, "consult"],
  "Perm with Haircut": [280, null], "Digital Perm with Haircut": [280, null],
  "Japanese Straightening": [330, null], "Keratin Treatment": [350, null],
  "Blow-dry with Shampoo": [60, null], "Updo": [130, null], "Deep Conditioner": [110, null], "Olaplex w/ any service": [60, null],
};
const cotar = (servico, estilista) => {
  const ehPerm = /perm|straighten/i.test(servico || "");
  /* Só o estilista escolhido → cota o CORTE daquela mão (o serviço mais comum, e o único que a
     matriz por estilista cobre). O recibo diz "Haircut with X" — nunca finge saber mais. */
  if (!servico && estilista && CORTE[estilista]) servico = "Haircut";
  if (servico === "Haircut") {
    const f = estilista && CORTE[estilista] ? CORTE[estilista]
      : [Math.min(...Object.values(CORTE).map((x) => x[0])), Math.max(...Object.values(CORTE).map((x) => x[1]))];
    return { faixa: `$${f[0]} – $${f[1]}`, quem: estilista || null, ehPerm: false,
      dur: (estilista && DUR_CORTE[estilista]) || DUR.Haircut,
      nota: estilista ? `${estilista}'s chair — shampoo & blow-dry included` : "pick a stylist and the range narrows" };
  }
  const b = BASE[servico];
  if (!b) return null;
  if (b[1] === "consult") return { faixa: `from $${b[0]}`, quem: estilista || null, ehPerm,
    dur: DUR[servico] || null, nota: "starts with a consultation — always" };
  return { faixa: `from $${b[0]}`, quem: estilista || null, ehPerm,
    dur: DUR[servico] || null, nota: "final number depends on length and thickness" };
};

/* Depoimentos REAIS da home deles, palavra por palavra (cortados no que a página mostra). */
const DEPOIMENTOS = [
  { t: "I actually found this salon when researching digital perms and I saw their informational articles. All the employees seemed well trained and very knowledgeable. She gave me exactly what I wanted and was very kind.", q: "Kristin", de: "Google Review" },
  { t: "I received a cut and digital perm from Kei last week and I had an amazing experience! He patiently answered all of my questions and explained each step. My hair looks (and feels) amazing.", q: "Catherine Shi", de: "Google Review" },
  { t: "My hair was literally 2 different colors but Saeko did an amazing job. Every decision was made by me with her suggestions for the best look. My hair looks amazing.", q: "Erica Pena", de: "Google Review" },
  { t: "I grabbed a variety of pics I use for my own inspiration and Shawn was able to understand my vision and contribute his own expertise and really get something personal to me.", q: "Kenny House", de: "Google Review" },
  { t: "Kei really listened and asked a lot of good questions. I trusted his guidance completely and it paid off — I'm thrilled with the results of my digital perm. I've been getting them for about 15 years.", q: "Sarah Moon", de: "Google Review" },
];

/* O carrossel DELES: troca sozinho, dots embaixo, pausa no hover. Reduced-motion: fica parado
   no primeiro e os dots viram navegação manual — movimento é bônus, nunca requisito. */
function Depoimentos() {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (pausa || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % DEPOIMENTOS.length), 5200);
    return () => clearInterval(id);
  }, [pausa]);
  const d = DEPOIMENTOS[i];
  return (
    <div className="mt-6 text-center" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      <blockquote key={i} className="td-tick mx-auto max-w-2xl text-[15.5px] leading-relaxed" style={{ color: "var(--sumi2)", animationDuration: ".8s" }}>
        “{d.t}”
      </blockquote>
      <div className="td-disp mt-4 text-[16px]">{d.q}</div>
      <div className="td-rot mt-1" style={{ color: "var(--ouro-e)", letterSpacing: ".14em" }}>{d.de}</div>
      <div className="mt-4 flex justify-center gap-2">
        {DEPOIMENTOS.map((_, k) => (
          <button key={k} type="button" aria-label={`Review ${k + 1}`} onClick={() => setI(k)}
            style={{ width: 7, height: 7, borderRadius: 99, border: 0, cursor: "pointer",
              background: k === i ? "var(--ouro)" : "var(--linha)" }} />
        ))}
      </div>
    </div>
  );
}

const Curva = ({ cor = "var(--ouro)", grossa = false }) => (
  <svg viewBox="0 0 720 48" preserveAspectRatio="none" aria-hidden="true" className="td-curva td-rev"
    style={{ display: "block", width: "100%", height: grossa ? 34 : 22 }}>
    <path d="M0 24 C 60 4, 120 44, 180 24 S 300 4, 360 24 S 480 44, 540 24 S 660 4, 720 24"
      pathLength="1" fill="none" stroke={cor} strokeWidth={grossa ? 3 : 2} strokeLinecap="round" />
  </svg>
);

export default function ThreeDegrees() {
  const [form, setForm] = useState({ nome: "", tel: "", servico: "", estilista: "", quando: "" });
  /* CANAL DE RETORNO (Luis, 26/08): «na land falta retenção de leads, como o guileoai.com que
     recolhe tudo — IG, Telegram, WhatsApp, e-mail, telefone: a pessoa ESCOLHE».
     Aqui adaptado ao salão: quem marca cabelo responde onde vive, e forçar telefone perde quem
     só fala por DM. O canal escolhido viaja no pedido, então o balcão responde no lugar certo. */
  const [canal, setCanal] = useState("phone");
  /* QUIZ EM PASSOS (Luis, 26/08): «tipo quiz, 2 perguntas por vez, fica leve de preencher».
     Um formulário de 6 campos assusta; três telas de duas perguntas convertem — e cada resposta
     é informação real que o balcão usa (o que quer, com quem, quando, por onde falar).
     `passo` só avança com o mínimo respondido: barra de progresso que mente é pior que nenhuma. */
  const [passo, setPasso] = useState(0);
  /* O ESCAPE (Luis, 26/08): «tem que ter pra pessoa escrever caso não tenha o que ela precisa».
     Pílula fechada é armadilha: quem quer "cabelo de noiva" ou "consertar o que fizeram em outro
     salão" não se vê em nenhuma opção e desiste calado. `outro` abre um campo livre — e o texto
     dela vai INTEIRO pro balcão, sem eu tentar encaixar num rótulo meu. */
  const [outro, setOutro] = useState({ servico: false, quando: false });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [rel, setRel] = useState({ hora: "", aberto: false });
  const [aberto, setAberto] = useState(null);
  const pedido = useRef(null);

  /* REVEAL: o esconder só liga (.td-anima) DEPOIS de o observer armar — sem JS ou com IO
     quebrado a página nasce inteira. Guardas na ordem em que já falharam de verdade:
     reduced-motion, IO ausente, aba oculta (IO não dispara em document.hidden — pego na prova),
     e o failsafe: se em 1.8s NENHUM elemento revelou, o IO está morto neste ambiente — mostra
     tudo. Se um revelou, o IO funciona e o scroll cuida do resto. */
  const raizRef = useRef(null);
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const els = raiz.querySelectorAll(".td-rev, .td-curva");
    const tudo = () => els.forEach((e) => e.classList.add("is-in"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches
        || !("IntersectionObserver" in window) || document.visibilityState === "hidden") {
      return; // nem liga .td-anima — página estática, inteira
    }
    raiz.classList.add("td-anima");
    let algum = false;
    const io = new IntersectionObserver((es) => es.forEach((x) => {
      if (x.isIntersecting) { algum = true; x.target.classList.add("is-in"); io.unobserve(x.target); }
    }), { threshold: 0.15 });
    els.forEach((e) => io.observe(e));
    const failsafe = setTimeout(() => { if (!algum) tudo(); }, 1800);
    return () => { clearTimeout(failsafe); io.disconnect(); };
  }, []);

  useEffect(() => {
    const tick = () => {
      const f = (o) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...o }).format(new Date());
      const h = Number(f({ hour: "numeric", hour12: false }));
      setRel({ hora: f({ hour: "numeric", minute: "2-digit", hour12: true }), aberto: h >= 9 && h < 19 });
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

  const escolher = useCallback((campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    pedido.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const enviar = useCallback(async (e) => {
    e.preventDefault();
    setErroEnvio("");
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "three-degrees", negocio: "Three Degrees Salon",
          nome: form.nome, telefone: form.tel,
          mensagem: `[${form.servico || "service?"}${form.estilista ? ` · with ${form.estilista}` : ""}${(() => { const q = cotar(form.servico, form.estilista); return q ? ` · quoted ${q.faixa}` : ""; })()}] ${form.quando || "any time"} · reply on ${canal}` }),
      });
      const d = await r.json().catch(() => null);
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErroEnvio("That didn't send — call (212) 254-8174, someone picks up.");
  }, [form, canal]);

  return (
    <div className="td-raiz" ref={raizRef}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600;700&family=Karla:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .td-raiz{
          --washi:#F7F4EC; --washi2:#EFEBE0; --sumi:#1B1A17; --sumi2:#57544C;
          --ouro:#F5B907; --ouro-e:#C79007; --hanko:#C73E3A; --linha:#DDD7C8; --papel:#FFFFFF;
          background:var(--washi); color:var(--sumi); min-height:100vh;
          font-family:'Karla',system-ui,-apple-system,sans-serif;
          -webkit-font-smoothing:antialiased; position:relative;
        }
        /* grão de papel — o washi tem fibra, não é #fff chapado */
        .td-raiz::before{content:''; position:fixed; inset:0; pointer-events:none; opacity:.35; z-index:0;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.55 0 0 0 0 0.53 0 0 0 0 0.47 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");}
        .td-raiz > *{position:relative; z-index:1;}
        .td-disp{font-family:'Shippori Mincho',Georgia,serif; font-weight:600; letter-spacing:.005em;}
        .td-mono{font-family:'IBM Plex Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}
        .td-rot{font-family:'IBM Plex Mono',monospace; font-size:10.5px; font-weight:500;
          letter-spacing:.26em; text-transform:uppercase; color:var(--sumi2);}
        /* o sublinhado curto amarelo sob títulos — a assinatura do site real deles */
        .td-sub{display:block; width:64px; height:3px; background:var(--ouro); margin:14px auto 0;}
        /* rótulo vertical — o detalhe tategaki que nenhum template tem */
        .td-vert{writing-mode:vertical-rl; text-orientation:mixed; font-family:'IBM Plex Mono',monospace;
          font-size:10px; letter-spacing:.4em; text-transform:uppercase; color:var(--sumi2); opacity:.8;}

        .td-b{display:inline-flex; align-items:center; gap:.5rem; border-radius:999px;
          font-weight:700; font-size:15px; padding:13px 26px; text-decoration:none; cursor:pointer;
          border:1px solid transparent; transition:transform .12s ease, box-shadow .2s ease, background .2s ease;}
        .td-b:active{transform:scale(.985);}
        .td-b-1{background:var(--sumi); color:var(--washi);
          box-shadow:0 1px 0 rgba(255,255,255,.14) inset, 0 12px 26px -16px rgba(27,26,23,.7);}
        .td-b-1:hover{background:#000;}
        .td-b-2{background:transparent; color:var(--sumi); border-color:var(--linha);}
        .td-b-2:hover{border-color:var(--sumi);}
        .td-b-2.claro{color:#fff; border-color:rgba(255,255,255,.4);}
        .td-b-2.claro:hover{border-color:#fff;}
        .td-hanko{background:linear-gradient(180deg,#FFD23F,var(--ouro) 55%,var(--ouro-e)); color:#241C03;
          box-shadow:0 1px 0 rgba(255,255,255,.45) inset, 0 12px 26px -16px rgba(197,144,7,.85);}
        .td-hanko:hover{filter:brightness(1.06);}

        /* ── PADRÃO NVIDIA, TRADUZIDO PARA WASHI ───────────────────────────────────────────
           Em superfície clara a separação vem das sombras, não do brilho. A receita da casa
           (luz de cima · verniz diagonal BRANCO · aro claro topo/escuro base · contato+ambiente)
           entra com números de papel: verniz nunca tingido — cor só em tinta. */
        /* ── O BOTÃO DE RESERVA — o SELO. Luis aprovou este ("esse estilo tava perfeito").
           Massa sumi lapidada + borda em ouro + o grau ° do logo como marcador + a laca dourada
           varrendo por dentro no hover. Canto suave, NÃO cápsula: cápsula dourada chapada virou
           "pílula de remédio". A cor da marca fica na BORDA e na varredura, nunca em
           preenchimento chapado — é isso que separa acabamento de tinta. */
        .td-selo{position:relative; overflow:hidden; border-radius:10px;
          background:linear-gradient(180deg,#232220,var(--sumi)); color:var(--washi);
          border:1.5px solid var(--ouro);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.14), 0 1px 2px rgba(27,26,23,.22),
            0 14px 30px -16px rgba(27,26,23,.55);
          transition:transform .14s ease, box-shadow .25s ease, border-color .25s ease;}
        .td-selo::after{content:''; position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(105deg, transparent 34%, rgba(245,185,7,.30) 47%, transparent 60%);
          transform:translateX(-120%); transition:transform .75s cubic-bezier(.22,1,.36,1);}
        .td-selo:hover::after{transform:translateX(120%);}
        .td-selo:hover{border-color:#FFD23F; box-shadow:inset 0 1px 0 rgba(255,255,255,.18),
          0 1px 2px rgba(27,26,23,.22), 0 18px 34px -14px rgba(197,144,7,.55);}
        .td-selo:active{transform:translateY(1px);}
        .td-selo .td-gr{color:var(--ouro); font-family:'Shippori Mincho',serif; margin-left:.35em;}

        /* A LOGO — «bem trabalhada, principalmente» (Luis). O arquivo deles é um quadrado com
           fundo branco; colado no washi ele lê como adesivo. Aqui vira uma PLACA: papel com aro
           de luz no topo, sombra de contato e canto do mesmo raio dos cartões — a marca deles
           ganha material sem eu tocar num pixel do desenho. */
        .td-selo-logo{display:grid; place-items:center; flex:0 0 auto; width:46px; height:46px;
          border-radius:12px; overflow:hidden; background:var(--papel);
          border:1px solid var(--linha); border-top-color:#EFEADC;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 1px 2px rgba(27,26,23,.14),
            0 8px 18px -10px rgba(27,26,23,.30);
          transition:transform .2s ease, box-shadow .25s ease;}
        .td-selo-logo img{width:100%; height:100%; object-fit:contain; padding:3px;}
        .td-marca:hover .td-selo-logo{transform:translateY(-1px);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 1px 2px rgba(27,26,23,.14),
            0 12px 22px -10px rgba(197,144,7,.4);}
        /* o telefone encolhe antes de quebrar a linha */
        .td-fone-mini{display:none;}
        @media (max-width:379px){ .td-fone-full{display:none;} .td-fone-mini{display:inline;} }

        /* ── ALVO DE TOQUE (varredura mobile 26/08: 11 elementos abaixo de 32px) ──────────
           Pílula bonita que o dedo erra é conversão perdida. Piso de 38px em tudo que é
           clicável; o desenho não muda, só a área. */
        .td-raiz a, .td-raiz button{min-height:38px;}
        .td-raiz .td-linha{min-height:44px;}

        /* ── REALISMO 4K NO SITE INTEIRO ──────────────────────────────────────────────────
           A referência que o Luis pede (nível mundial, 4K, textura de tela) não é um efeito
           solto: é a MESMA luz em tudo. Aqui: toda foto ganha aro interno (a borda devolvendo
           luz, como vidro tem espessura) e sombra de contato — e as fotos escuras ganham um
           levíssimo lift de sombra para não virarem borrão preto em tela boa. */
        .td-cartao img, .td-rev img{ image-rendering:auto; }
        .td-foto{ box-shadow:inset 0 0 0 1px rgba(255,255,255,.05); }
        .td-cartao{background:var(--papel); border:1px solid var(--linha); border-top-color:#E8E3D6;
          border-radius:20px; position:relative;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.85), inset 0 -1px 0 rgba(27,26,23,.07),
            0 1px 2px rgba(27,26,23,.10), 0 18px 40px -18px rgba(27,26,23,.18);
          transition: transform .2s ease, box-shadow .2s ease;}
        .td-cartao::after{content:''; position:absolute; inset:0; border-radius:inherit;
          pointer-events:none; z-index:1;
          background:linear-gradient(115deg, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 38%);
          opacity:.6;}
        .td-cartao[data-escuro]::after{background:linear-gradient(115deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,0) 40%); opacity:1;}
        .td-cartao > *{position:relative; z-index:2;}
        button.td-cartao:hover, a.td-cartao:hover{transform:translateY(-3px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.85), inset 0 -1px 0 rgba(27,26,23,.07),
            0 1px 2px rgba(27,26,23,.10), 0 22px 44px -14px rgba(27,26,23,.26);}
        button.td-cartao:hover img{transform:scale(1.03);}
        .td-cartao img{transition:transform .6s ease-out;}

        /* REVEAL — o estado escondido SÓ existe sob .td-anima, que o JS liga depois de armar o
           observer. Sem JS, com IO quebrado, ou em aba oculta: a página nasce INTEIRA visível.
           Animação é bônus; conteúdo é o produto. (A 1ª versão escondia incondicionalmente e a
           prova pegou: numa aba document.hidden o IO nunca dispara — página em branco.) */
        .td-anima .td-rev{opacity:0; transform:translateY(14px);
          transition:opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1);}
        .td-anima .td-rev.is-in{opacity:1; transform:none;}
        .td-anima .td-curva path{stroke-dasharray:1; stroke-dashoffset:1;
          transition:stroke-dashoffset 1.2s ease-out .15s;}
        .td-anima .td-curva.is-in path{stroke-dashoffset:0; animation:td-recurva 11s ease-in-out 1.6s infinite;}
        /* a assinatura se refaz devagar — vida sem ruído, e ela É a marca (graus/curva) */
        @keyframes td-recurva{0%,72%{stroke-dashoffset:0} 86%{stroke-dashoffset:1} 100%{stroke-dashoffset:0}}
        @media (prefers-reduced-motion:reduce){.td-anima .td-curva.is-in path{animation:none}}
        /* o pontilhado do menu ganha tinta hanko crescendo no hover */
        .td-linha{position:relative;}
        .td-linha::after{content:''; position:absolute; left:0; bottom:-1px; height:1px; width:0;
          background:var(--ouro); transition:width .3s ease;}
        .td-linha:hover::after{width:100%;}
        /* o tick do quote: tinta assentando */
        @keyframes td-ink{from{color:var(--ouro); opacity:.35;}}
        .td-tick{animation:td-ink .45s ease-out;}
        /* pulso do único selo vivo */
        @keyframes td-pulso{0%,100%{box-shadow:0 0 0 0 rgba(76,143,93,.5);} 60%{box-shadow:0 0 0 6px rgba(76,143,93,0);}}
        .td-dot-vivo{animation:td-pulso 3s ease-out infinite;}
        /* o ° do headline — eco do logo, caindo no lugar */
        @keyframes td-grau{from{opacity:0; transform:translateY(-6px);}}
        .td-grau{display:inline-block; color:var(--ouro); animation:td-grau .6s ease-out .5s both;}
        .td-linha{display:flex; align-items:baseline; gap:.6rem; width:100%; text-align:left;
          background:transparent; border:0; cursor:pointer; padding:9px 0; color:inherit;
          border-bottom:1px solid var(--washi2);}
        .td-linha:hover .td-nome{color:var(--ouro);}
        .td-pontos{flex:1 1 auto; border-bottom:1px dotted #C9C2B2; transform:translateY(-3px);}
        .td-nome{font-size:15.5px; transition:color .16s ease;}
        .td-preco{font-family:'IBM Plex Mono',monospace; font-size:14px; white-space:nowrap;}
        .td-cond{display:block; font-size:12px; color:var(--sumi2); margin-top:1px;}
        .td-inp{width:100%; border-radius:4px; border:1px solid var(--linha); background:var(--papel);
          padding:12px 15px; font-size:15px; outline:none; color:var(--sumi);
          transition:border-color .18s ease, box-shadow .18s ease;}
        .td-inp:focus{border-color:var(--sumi); box-shadow:0 0 0 3px rgba(27,26,23,.08);}
        .td-inp::placeholder{color:#9B968A;}
        .td-foto{width:100%; height:100%; object-fit:cover; display:block;}
        /* VINHETA DE LENTE — 4% nas bordas. Foto real tem queda de luz nas quinas; sem isso a
           imagem lê como render chapado. É o detalhe que separa "foto num site" de "foto". */
        .td-lente{position:relative;}
        .td-lente::after{content:''; position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(120% 90% at 50% 45%, transparent 58%, rgba(27,26,23,.16) 100%);}
        /* O FILME: 21s de ciclo, 3 takes de 7s. Opacidade faz o corte (cross-fade de ~1.5s);
           cada take tem o SEU movimento — push-in, drift lateral, drift vertical — porque corte
           sem mudança de movimento parece slideshow, e slideshow é o que queremos NÃO parecer. */
        @keyframes td-fade-a{0%,40%{opacity:1} 46%,94%{opacity:0} 100%{opacity:1}}
        @keyframes td-fade-b{0%,40%{opacity:0} 46%,66%{opacity:1} 72%,100%{opacity:0}}
        @keyframes td-fade-c{0%,66%{opacity:0} 72%,94%{opacity:1} 100%{opacity:0}}
        @keyframes td-mov-a{from{transform:scale(1.08)} to{transform:scale(1)}}
        @keyframes td-mov-b{from{transform:scale(1.1) translateX(-2.5%)} to{transform:scale(1.1) translateX(2.5%)}}
        @keyframes td-mov-c{from{transform:scale(1.1) translateY(1.2%)} to{transform:scale(1.04) translateY(-0.8%)}}
        .td-take-a{animation:td-fade-a 24s ease-in-out infinite, td-mov-a 24s ease-out infinite; filter:saturate(.9) contrast(1.02);}
        .td-take-b{animation:td-fade-b 24s ease-in-out infinite, td-mov-b 24s ease-in-out infinite; filter:saturate(.9) contrast(1.02);}
        .td-take-c{animation:td-fade-c 24s ease-in-out infinite, td-mov-c 24s ease-in-out infinite; filter:saturate(.9) contrast(1.02);}
        @media (prefers-reduced-motion:reduce){
          .td-take-b,.td-take-c{opacity:0!important}
          .td-take-a{opacity:1!important; transform:none!important}
        }
        @media (prefers-reduced-motion:reduce){*{transition:none!important; animation:none!important;}}
      `}</style>

      {/* ── CABEÇALHO */}
      {/* ⚠️ CABEÇALHO EM UMA LINHA SÓ. No celular ele quebrava em três (logo / nome / botão largo
          sozinho) — o Luis viu. `flex-nowrap` + o nome encolhendo com clamp mantêm marca e ação
          lado a lado em qualquer largura; abaixo de 380px o telefone vira só o ícone, que é
          melhor que um botão gigante empurrando a hero pra baixo. */}
      <header className="td-topo mx-auto flex max-w-6xl flex-nowrap items-center justify-between gap-3 px-4 pb-3 pt-5 sm:px-5 sm:pt-6">
        <a href="#" className="td-marca flex min-w-0 items-center gap-2.5 no-underline" style={{ color: "inherit" }}>
          <span className="td-selo-logo"><img src={`${B}/logo.jpg`} alt="Three Degrees Salon" width="44" height="44" /></span>
          <span className="min-w-0">
            <span className="td-disp block truncate text-[clamp(14px,3.6vw,17px)] leading-none tracking-[.04em]">THREE DEGREES</span>
            <span className="td-rot mt-1 block truncate" style={{ fontSize: "clamp(8.5px,2.2vw,10.5px)" }}>Japanese concept salon</span>
          </span>
        </a>
        <a href={`tel:${TEL}`} className="td-b td-selo shrink-0" style={{ padding: "11px 18px", fontSize: 14 }}>
          <span className="td-fone-full">Call {TEL_FMT}</span>
          <span className="td-fone-mini">Call</span>
        </a>
      </header>

      {/* ── HERO-FILME — o site deles não tem vídeo nenhum (medido: 0 <video>, 0 .mp4).
          Em vez de fingir um, o motor faz CINEMA com as fotos reais: três takes do salão em
          cross-fade lento, cada um com seu próprio movimento (push-in / drift) — efeito de
          filme, zero mp4, zero mentira. Reduced-motion: primeiro take parado. */}
      <section className="td-lente relative overflow-hidden" style={{ minHeight: "min(80vh, 680px)" }}>
        {[["cadeiras", "The chairs at Three Degrees Salon", "td-take-a"],
          ["salao-interior", "A Three Degrees stylist braiding a client's hair", "td-take-b"],
          ["salao-2", "The 3° wooden blocks by the window", "td-take-c"]].map(([f, alt, anim], i) => (
          /* ⚠️ opacity:0 INLINE nos takes 2 e 3. Sem isso, se a animação atrasa (CSS ainda não
             aplicado, aba que volta do background, reduced-motion), os três nascem visíveis e a
             abertura vira qualquer um deles — o Luis printou os bloquinhos achando que era a
             abertura. O keyframe é quem ACENDE; o padrão é apagado. */
          <img key={f} src={`${B}/${f}.jpg`} alt={i === 0 ? alt : ""} aria-hidden={i !== 0}
            className={`td-foto absolute inset-0 ${anim}`} loading={i === 0 ? "eager" : "lazy"}
            style={i === 0 ? undefined : { opacity: 0 }} />
        ))}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(27,26,23,.32), rgba(27,26,23,.48))" }} />
        <div className="relative mx-auto flex h-full min-h-[inherit] max-w-6xl flex-col items-center justify-center px-5 py-20 text-center">
          <div className="td-rot td-rev" style={{ color: "rgba(247,244,236,.85)", letterSpacing: ".3em" }}>
            Japanese concept salon · East Village
          </div>
          <h1 className="td-disp td-rev mt-3 text-[clamp(2.1rem,5.6vw,3.6rem)] leading-[1.1] text-white"
            style={{ textShadow: "0 2px 24px rgba(0,0,0,.45)", transitionDelay: "100ms" }}>
            Where Your Hair<br />Finds Its Style
          </h1>
          <div className="td-rev mt-7 flex flex-col items-center gap-3 sm:flex-row" style={{ transitionDelay: "220ms" }}>
            <a href="/novo/three-degrees/book" className="td-b td-selo">Book<span className="td-gr">°</span></a>
            <a href={`mailto:${EMAIL}?subject=Consultation`} className="td-b"
              style={{ background: "rgba(247,244,236,.16)", color: "#fff", border: "1px solid rgba(247,244,236,.35)", backdropFilter: "blur(6px)" }}>Consultation</a>
          </div>
          <div className="td-rev mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2" style={{ transitionDelay: "320ms" }}>
            {[["5.0 ★", "214 Google reviews"], ["Founded by Kei Hirata", "Tokyo → Vancouver → NYC"], ["Open daily", "9am – 7pm"]].map(([a, b]) => (
              <div key={a} className="text-center">
                <div className="td-mono text-[14px] text-white">{a}</div>
                <div className="td-rot mt-0.5" style={{ color: "rgba(247,244,236,.75)" }}>{b}</div>
              </div>
            ))}
            <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
              style={{ background: "rgba(27,26,23,.55)", border: "1px solid rgba(247,244,236,.25)" }}>
              <span className={rel.aberto ? "td-dot-vivo" : ""} style={{ width: 7, height: 7, borderRadius: 99, background: rel.aberto ? "#5BD98A" : "var(--ouro)" }} />
              <span className="td-mono text-[12px] text-white">{rel.aberto ? "Open now" : "Closed"} · {rel.hora} NYC</span>
            </span>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-6 pb-2"><Curva grossa cor="#F5B907" /></div>
      </section>

      {/* ── WHAT CUSTOMERS SAY — o carrossel deles (autoplay + dots), com os depoimentos REAIS. */}
      <section className="mx-auto max-w-4xl px-5 py-12">
        <h2 className="td-disp text-center text-[clamp(1.6rem,4vw,2.3rem)]">What Customers Say</h2>
        <span className="td-sub" />
        <Depoimentos />
      </section>

      {/* ── SERVICES — os 4 tiles fotográficos DELES, serifada branca sobre a foto. */}
      <section className="mx-auto max-w-6xl px-5 pb-12">
        <h2 className="td-disp text-center text-[clamp(1.6rem,4vw,2.3rem)]">Services</h2>
        <span className="td-sub" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[["HAIRCUT", "svc-haircut", "Haircut"], ["COLOR", "svc-color", "Single Color Process"],
            ["PERM", "svc-perm", "Digital Perm with Haircut"], ["STYLING", "svc-styling", "Blow-dry with Shampoo"]].map(([rot, foto, svc], i) => (
            <button key={rot} type="button" onClick={() => escolher("servico", svc)}
              className="td-rev group relative h-48 overflow-hidden rounded-[20px] text-left sm:h-56"
              style={{ transitionDelay: `${i * 70}ms` }}>
              <img src={`${B}/${foto}.jpg`} alt={`${rot} at Three Degrees`} className="td-foto absolute inset-0 transition duration-700 group-hover:scale-105" loading="lazy" />
              {/* ⚠️ NADA de rótulo por cima: os JPGs deles JÁ trazem a palavra gravada na foto
                  (HAIRCUT/COLOR/PERM/STYLING). Meu span duplicava o texto — fantasma na tela. */}
              <div className="absolute inset-0" style={{ background: "rgba(27,26,23,.18)" }} />
              <span className="sr-only">{rot}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── OS ESTILISTAS, reorganizados pelo motor: o FUNDADOR primeiro — a imprensa diz que o
          salão É a trajetória dele — e os 6 em grade uniforme, cada um com a mão precificada e,
          quando existe, a citação real do Google que o nomeia. */}
      <section id="stylists" className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="td-disp text-center text-[clamp(1.6rem,4vw,2.3rem)]">Stylists</h2>
        <span className="td-sub" />

        {/* O fundador */}
        <div className="td-cartao td-rev mt-8 overflow-hidden" style={{ borderRadius: 20 }}>
          <div className="grid sm:grid-cols-[.9fr_1.4fr]">
            <div className="relative min-h-[300px]">
              <img src={`${B}/kei.jpg`} alt="Kei Hirata, founder of Three Degrees Salon" className="td-foto absolute inset-0" loading="lazy" />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <div className="td-rot" style={{ color: "var(--ouro-e)", letterSpacing: ".2em" }}>Founder · Master stylist</div>
              <div className="td-disp mt-2 text-[clamp(1.5rem,3.4vw,2.1rem)]">Kei Hirata</div>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed" style={{ color: "var(--sumi2)" }}>
                “The salon is a blend of his experiences from Tokyo to Vancouver to New York” — the
                hairdressr guide, naming Three Degrees among the Top 31 salons in NYC. Clients agree:
              </p>
              <blockquote className="mt-3 border-l-2 pl-3 text-[13.5px] leading-relaxed" style={{ borderColor: "var(--ouro)", color: "var(--sumi2)" }}>
                “Kei really listened. I've been getting digital perms for about 15 years — I'm thrilled
                with the results.” <span className="td-rot" style={{ letterSpacing: ".12em" }}>Sarah Moon · Google</span>
              </blockquote>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="td-mono text-[14px]">haircut $120–160</span>
                <button type="button" onClick={() => escolher("estilista", "Kei")} className="td-b td-hanko" style={{ padding: "9px 20px", fontSize: 13.5 }}>
                  Ask for Kei's chair
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Os seis */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {ESTILISTAS.filter((e) => e.n !== "Kei").map((e, i) => (
            <button key={e.n} type="button" onClick={() => escolher("estilista", e.n)}
              className="td-cartao td-rev overflow-hidden text-left" style={{ borderRadius: 20, transitionDelay: `${i * 60}ms` }}>
              <div className="aspect-[4/3]"><img src={`${B}/${e.foto}.jpg`} alt={`${e.n} — stylist at Three Degrees`} className="td-foto" loading="lazy" /></div>
              <div className="p-4">
                <div className="flex items-baseline justify-between">
                  <div className="td-disp text-[18px]">{e.n}</div>
                  <div className="td-mono text-[12.5px]">{e.corte}</div>
                </div>
                {e.cita && (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--sumi2)" }}>
                    “{e.cita.length > 96 ? e.cita.slice(0, 93) + "…" : e.cita}”
                    <span className="td-rot mt-1 block" style={{ letterSpacing: ".12em" }}>{e.quem}</span>
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[13px]" style={{ color: "var(--sumi2)" }}>
          Tap a stylist and the request below fills in — the chart is priced by hand.
        </p>
      </section>

      {/* ── A PONTE PRO BOOKING REAL ────────────────────────────────────────────────────────
          ⚠️ A v5 tinha um "Book a chair" com 7 cartões repetindo estilista+preço+duração — e o
          Luis viu na hora: ficou BONITO e ficou REPETIDO. O booking de verdade mora no Booker
          deles (go.booker.com/…/service-menu), que já lista os 34 serviços, tem disponibilidade
          real e cobra. Duplicar isso na vitrine é fazer a pessoa escolher duas vezes e escolher
          pior. Aqui fica só a PONTE: uma faixa curta que diz o que ela vai encontrar lá e manda.
          A escolha por estilista continua viva onde ela pertence — na seção Stylists, que
          preenche o pedido local. */}
      <section id="booking" className="mx-auto max-w-6xl px-5 pb-12">
        <div className="td-cartao td-rev overflow-hidden">
          <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_.9fr]">
            <div>
              <div className="td-rot" style={{ color: "var(--ouro-e)" }}>Real availability</div>
              <h2 className="td-disp mt-2 text-[clamp(1.5rem,3.6vw,2.2rem)] leading-tight">
                Book on the salon's own calendar.
              </h2>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed" style={{ color: "var(--sumi2)" }}>
                All 34 services with live times — every haircut, color, perm and treatment, priced
                by stylist. A card holds the appointment; nothing is charged until after your visit.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a href="/novo/three-degrees/book" className="td-b td-selo">Open the calendar<span className="td-gr">°</span></a>
                <a href="https://go.booker.com/location/threedegreesnyc/account" target="_blank" rel="noreferrer"
                  className="text-[13.5px] font-bold underline-offset-2 hover:underline" style={{ color: "var(--ouro-e)" }}>
                  already booked? modify or cancel
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[["Haircut", "1h–1h15 · from $90"], ["Digital perm", "4h · from $320"],
                ["Color", "2h · from $160"], ["Keratin", "3h · from $350"]].map(([a, b]) => (
                <div key={a} className="rounded-[14px] p-3" style={{ background: "var(--washi)", border: "1px solid var(--linha)" }}>
                  <div className="text-[13.5px] font-bold">{a}</div>
                  <div className="td-mono mt-0.5 text-[11.5px]" style={{ color: "var(--sumi2)" }}>{b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── A CASA — as fotos reais do salão, em fita. */}
      <section className="mx-auto max-w-6xl px-5 pb-10">
        <div className="grid gap-3 sm:grid-cols-[1.2fr_.9fr_.9fr]">
          <div className="td-cartao td-rev overflow-hidden"><div className="aspect-[16/10]">
            <img src={`${B}/salao-2.jpg`} alt="The 3° wooden blocks by the window at the salon" className="td-foto" loading="lazy" /></div></div>
          <div className="td-cartao td-rev overflow-hidden" style={{ transitionDelay: "80ms" }}><div className="aspect-[16/10] sm:aspect-auto sm:h-full">
            <img src={`${B}/salao-interior.jpg`} alt="A Three Degrees stylist braiding a client's hair" className="td-foto" loading="lazy" /></div></div>
          <div className="td-cartao flex flex-col justify-between p-5" data-escuro="1" style={{ background: "var(--sumi)", borderColor: "var(--sumi)" }}>
            <div className="td-rot" style={{ color: "#B9B4A6" }}>02 / the room</div>
            <p className="td-disp text-[19px] leading-snug" style={{ color: "var(--washi)" }}>
              White brick, brass<br />and quiet hands.
            </p>
            <div><Curva cor="#F5B907" /></div>
          </div>
        </div>
      </section>

      {/* ── WATCH THE HAIR TRANSFORMATION — os 2 vídeos REAIS da Refinery29 gravados no salão.
          Thumbnail oficial do YouTube linkando pra fora: zero iframe (o CSP da casa bloqueia
          frame de terceiro, e thumb + link é mais rápido que embed de qualquer jeito). */}
      <section className="mx-auto max-w-6xl px-5 pb-12">
        <h2 className="td-disp text-center text-[clamp(1.6rem,4vw,2.3rem)]">Watch the Hair Transformation</h2>
        <span className="td-sub" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[["6mBu4WJ92LE", "yt1", "I Bleached My Black Hair & Got Highlights — Refinery29, filmed at Three Degrees"],
            ["B5eBPRRNDH4", "yt2", "I Bleached My Brunette Hair Pastel Blonde — Refinery29, filmed at Three Degrees"]].map(([id, th, alt], i) => (
            <a key={id} href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer"
              className="td-cartao td-rev group relative block overflow-hidden" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="aspect-video">
                <img src={`${B}/${th}.jpg`} alt={alt} className="td-foto transition duration-700 group-hover:scale-104" loading="lazy" />
              </div>
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-14 w-14 place-items-center rounded-full text-[20px]"
                  style={{ background: "rgba(27,26,23,.72)", color: "#fff", paddingLeft: 3 }}>▶</span>
              </span>
              <div className="px-4 py-3 text-[13px] font-bold">{alt.split(" — ")[0]}
                <span className="td-rot block" style={{ letterSpacing: ".14em", color: "var(--ouro-e)" }}>Refinery29 · filmed here</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── PROUDLY NAMED BEST SALON IN NYC — a imprensa deles, citada com fonte. */}
      <section className="mx-auto max-w-4xl px-5 pb-12 text-center">
        <h2 className="td-disp text-[clamp(1.6rem,4vw,2.3rem)]">Proudly Named Best Salon in NYC</h2>
        <span className="td-sub" />
        <blockquote className="td-rev mx-auto mt-6 max-w-2xl text-[15.5px] leading-relaxed" style={{ color: "var(--sumi2)" }}>
          “Situated a minute away from New York University, THREE DEGREES SALON applies a Japanese
          concept in its approach to hair care. Founded by <b style={{ color: "var(--sumi)" }}>Kei Hirata</b>,
          the salon is a blend of his experiences from Tokyo to Vancouver to New York.”
        </blockquote>
        <div className="td-rot mt-3" style={{ letterSpacing: ".16em", color: "var(--ouro-e)" }}>
          hairdressr · Top 31 Best Hair Salons in NYC (2025)
        </div>
      </section>

      {/* ── O CARDÁPIO — cada grupo com a foto REAL da categoria. */}
      <section id="menu" className="mx-auto max-w-6xl px-5 pb-10">
        <div className="td-rot">03 / the menu</div>
        <h2 className="td-disp mt-2 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight">Every price, published.</h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {MENU.map((g) => (
            <div key={g.g} className="td-cartao td-rev overflow-hidden"
              style={g.destaque ? { borderColor: "var(--ouro)", borderWidth: 1.5 } : undefined}>
              <div className="relative h-28">
                <img src={`${B}/${g.foto}.jpg`} alt={`${g.g} at Three Degrees`} className="td-foto absolute inset-0" loading="lazy" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(27,26,23,.12), rgba(27,26,23,.55))" }} />
                <div className="absolute bottom-3 left-4 flex items-center gap-3">
                  <span className="td-disp text-[20px] text-white">{g.g}</span>
                  {g.destaque && <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-widest text-white" style={{ background: "var(--ouro)" }}>the specialty</span>}
                </div>
              </div>
              <div className="p-5">
                {g.itens.map(([n, p, cond]) => (
                  <button key={n} type="button" onClick={() => escolher("servico", n)} className="td-linha">
                    <span className="min-w-0">
                      <span className="td-nome block">{n}</span>
                      {cond && <span className="td-cond">{cond}</span>}
                    </span>
                    <span className="td-pontos" />
                    <span className="td-preco">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="td-cartao mt-5 flex flex-wrap items-center justify-between gap-3 border-l-4 p-4"
          style={{ borderLeftColor: "var(--ouro)" }}>
          <p className="max-w-2xl text-[14px] leading-relaxed" style={{ color: "var(--sumi2)" }}>
            <b style={{ color: "var(--sumi)" }}>House rule:</b> no perm on hair that has been
            bleached — a hair-health line the salon does not cross. Color correction and creative
            colors start with a consultation.
          </p>
          <a href={`mailto:${EMAIL}?subject=Consultation`} className="td-b td-b-2">Email a consultation</a>
        </div>
      </section>

      {/* ── A CASA ATENDE ÀS 3 DA MANHÃ — as funções de IA como capacidade do salão. */}
      <section id="hana" className="mx-auto max-w-6xl px-5 pb-10">
        <div className="td-cartao td-rev overflow-hidden" data-escuro="1" style={{ background: "var(--sumi)", borderColor: "var(--sumi)" }}>
          <div className="grid lg:grid-cols-[1fr_.9fr]">
            <div className="p-6 sm:p-9">
              <div className="td-rot" style={{ color: "var(--ouro)" }}>04 / the desk that never closes</div>
              <h2 className="td-disp mt-3 text-[clamp(1.7rem,4.2vw,2.6rem)] leading-tight" style={{ color: "var(--washi)" }}>
                Call at 3am.<br />The house still answers.
              </h2>
              <p className="mt-3 max-w-lg text-[15.5px] leading-relaxed" style={{ color: "#B9B4A6" }}>
                Hana is Three Degrees' own receptionist — she answers every call in the salon's
                name, quotes the right stylist's range, knows the no-perm-on-bleached-hair rule,
                and passes your request to the front desk to confirm. She never books what she
                can't promise.
              </p>
              <div className="mt-5 grid gap-2.5">
                {[
                  ["Quotes by stylist", "ask for Kei and she quotes Kei's range — $120–160, not a guess"],
                  ["Knows the house rules", "bleached hair? She offers a treatment or consultation instead of a perm"],
                  ["Captures, never invents", "your name, number and request go straight to the front desk"],
                ].map(([t, d]) => (
                  <div key={t} className="flex gap-3 rounded p-3" style={{ background: "rgba(247,244,236,.06)" }}>
                    <span className="td-mono text-[13px]" style={{ color: "var(--ouro)" }}>—</span>
                    <div>
                      <div className="text-[14.5px] font-bold" style={{ color: "var(--washi)" }}>{t}</div>
                      <div className="text-[13px]" style={{ color: "#B9B4A6" }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {/* O painel de voz (GuiLayer) monta nesta página — o botão do canto conversa. */}
                <span className="td-b td-hanko" style={{ cursor: "default" }}>▶ Try her — the mic button, corner of this page</span>
                <a href={`tel:${TEL}`} className="td-b td-b-2 claro">or call {TEL_FMT}</a>
              </div>
            </div>
            <div className="relative hidden min-h-[320px] lg:block">
              <img src={`${B}/salao-interior.jpg`} alt="A Three Degrees stylist at work" className="td-foto absolute inset-0" loading="lazy"
                style={{ filter: "saturate(.85) brightness(.9)" }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #1B1A17 0%, rgba(27,26,23,.25) 45%, rgba(27,26,23,0) 100%)" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── O PEDIDO */}
      <section ref={pedido} id="book" className="mx-auto max-w-6xl px-5 pb-9">
        <div className="td-cartao p-6 sm:p-8">
          <h2 className="td-disp text-[clamp(1.6rem,4vw,2.4rem)] leading-tight">Let&apos;s find your chair.</h2>
          <p className="mt-2 max-w-xl text-[15.5px]" style={{ color: "var(--sumi2)" }}>
            Six taps, thirty seconds. The price updates as you choose, and the front desk confirms
            your exact time.
          </p>
          {/* O RECIBO VIVO — a matriz deles respondendo na hora, estilo recibo de balcão.
              Não é chatbot: é a recepcionista citada pelo nome, com o número que ela vai
              confirmar. `key` no valor re-dispara o tick de tinta a cada mudança. */}
          {(() => { const q = cotar(form.servico, form.estilista); return q ? (
            <div className="td-cartao mt-6 p-5" style={{ background: "var(--washi)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="td-rot">Estimate · not a commitment</div>
                  <div className="td-disp mt-1 text-[17px]">
                    {form.servico}{q.quem ? ` with ${q.quem}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div key={q.faixa + (q.quem || "")} className="td-mono td-tick text-[26px]" style={{ color: "var(--sumi)" }}>{q.faixa}</div>
                  {q.dur && <div className="td-rot mt-0.5" style={{ letterSpacing: ".14em" }}>{q.dur} in the chair</div>}
                </div>
              </div>
              <div className="mt-2 border-t pt-2 text-[13px]" style={{ borderColor: "var(--linha)", color: "var(--sumi2)" }}>
                {q.nota} — <b style={{ color: "var(--sumi)" }}>Hana confirms the exact number{q.quem ? ` when she checks ${q.quem}'s book` : " with the front desk"}.</b>
                {q.ehPerm && <span className="block mt-1" style={{ color: "var(--ouro)" }}>Bleached hair? She'll offer a treatment instead — house rule.</span>}
              </div>
              <button type="button" className="mt-3 text-[13px] font-bold underline-offset-2 hover:underline"
                style={{ color: "var(--ouro)" }}
                onClick={() => window.dispatchEvent(new CustomEvent("gui-abrir"))}>
                ▶ Talk it through with Hana instead
              </button>
            </div>
          ) : null; })()}

          {enviado ? (
            <div className="mt-6 rounded p-5" style={{ background: "var(--washi)", border: "1px solid var(--linha)" }}>
              <div className="td-disp text-[18px]" style={{ color: "var(--ouro)" }}>Received.</div>
              <p className="mt-1 text-[15px]" style={{ color: "var(--sumi2)" }}>
                The front desk will call you back to confirm. In a hurry? {TEL_FMT} is faster.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} className="mt-6">
              {/* trilha de progresso — três marcas, a atual acesa */}
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1 flex-1 rounded-full transition-all duration-500"
                    style={{ background: i <= passo ? "var(--ouro)" : "var(--linha)" }} />
                ))}
                <span className="td-mono ml-2 text-[11px]" style={{ color: "var(--sumi2)" }}>{passo + 1}/3</span>
              </div>

              {passo === 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div className="td-rot mb-2">What are you after?</div>
                    <div className="flex flex-wrap gap-1.5">
                      {["Haircut", "Digital Perm with Haircut", "Single Color Process", "Highlights / Balayage", "Keratin Treatment"].map((sv) => (
                        <button key={sv} type="button" onClick={() => setForm({ ...form, servico: sv })}
                          className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition"
                          style={form.servico === sv
                            ? { background: "var(--sumi)", color: "var(--washi)" }
                            : { background: "var(--washi)", color: "var(--sumi2)", border: "1px solid var(--linha)" }}>
                          {sv.replace(" with Haircut", "").replace("Single Color Process", "Color")}
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => { setOutro((o) => ({ ...o, servico: true })); setForm({ ...form, servico: "" }); }}
                        className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition"
                        style={outro.servico
                          ? { background: "var(--sumi)", color: "var(--washi)" }
                          : { background: "var(--washi)", color: "var(--sumi2)", border: "1px dashed var(--linha)" }}>
                        Something else…
                      </button>
                    </div>
                    {outro.servico && (
                      <input autoFocus value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })}
                        placeholder="Tell us in your words — bridal hair, fixing another salon's job, anything"
                        className="td-inp mt-2.5" />
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <div className="td-rot mb-2">Whose hands?</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setForm({ ...form, estilista: "" })}
                        className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition"
                        style={!form.estilista ? { background: "var(--sumi)", color: "var(--washi)" } : { background: "var(--washi)", color: "var(--sumi2)", border: "1px solid var(--linha)" }}>
                        No preference
                      </button>
                      {ESTILISTAS.map((e) => (
                        <button key={e.n} type="button" onClick={() => setForm({ ...form, estilista: e.n })}
                          className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition"
                          style={form.estilista === e.n
                            ? { background: "var(--sumi)", color: "var(--washi)" }
                            : { background: "var(--washi)", color: "var(--sumi2)", border: "1px solid var(--linha)" }}>
                          {e.n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <button type="button" onClick={() => setPasso(1)} disabled={!form.servico}
                      className="td-b td-selo" style={!form.servico ? { opacity: .45, cursor: "not-allowed" } : undefined}>
                      Next<span className="td-gr">°</span>
                    </button>
                  </div>
                </div>
              )}

              {passo === 1 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div className="td-rot mb-2">When suits you?</div>
                    <div className="flex flex-wrap gap-1.5">
                      {["As soon as possible", "This week, mornings", "This week, afternoons", "Weekend", "I'm flexible"].map((w) => (
                        <button key={w} type="button" onClick={() => setForm({ ...form, quando: w })}
                          className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition"
                          style={form.quando === w
                            ? { background: "var(--sumi)", color: "var(--washi)" }
                            : { background: "var(--washi)", color: "var(--sumi2)", border: "1px solid var(--linha)" }}>
                          {w}
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => { setOutro((o) => ({ ...o, quando: true })); setForm({ ...form, quando: "" }); }}
                        className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition"
                        style={outro.quando
                          ? { background: "var(--sumi)", color: "var(--washi)" }
                          : { background: "var(--washi)", color: "var(--sumi2)", border: "1px dashed var(--linha)" }}>
                        A specific date…
                      </button>
                    </div>
                    {outro.quando && (
                      <input autoFocus value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })}
                        placeholder="e.g. Saturday the 14th, before 2pm — or the date of your event"
                        className="td-inp mt-2.5" />
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <div className="td-rot mb-2">Where should we reply?</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CANAIS.map(([k, rot]) => (
                        <button key={k} type="button" onClick={() => setCanal(k)}
                          className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition"
                          style={canal === k
                            ? { background: "var(--sumi)", color: "var(--washi)" }
                            : { background: "var(--washi)", color: "var(--sumi2)", border: "1px solid var(--linha)" }}>
                          {rot}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <button type="button" onClick={() => setPasso(2)} disabled={!form.quando}
                      className="td-b td-selo" style={!form.quando ? { opacity: .45, cursor: "not-allowed" } : undefined}>
                      Next<span className="td-gr">°</span>
                    </button>
                    <button type="button" onClick={() => setPasso(0)} className="text-[13px] font-bold" style={{ color: "var(--sumi2)" }}>back</button>
                  </div>
                </div>
              )}

              {passo === 2 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Your name" className="td-inp sm:col-span-2" />
                  <input required type={canal === "email" ? "email" : canal === "phone" || canal === "whatsapp" ? "tel" : "text"}
                    value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })}
                    placeholder={(CANAIS.find((c) => c[0] === canal) || [])[2]} className="td-inp sm:col-span-2" />
                  <textarea rows={2} value={form.recado || ""} onChange={(e) => setForm({ ...form, recado: e.target.value })}
                    placeholder="Anything the stylist should know? (optional)" className="td-inp sm:col-span-2" />
                  {erroEnvio && <p className="text-[13.5px] font-bold sm:col-span-2" style={{ color: "var(--ouro-e)" }}>{erroEnvio}</p>}
                  <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                    {/* Luis: «em vez de Send to the front desk, algo tipo Start my treatment».
                        O botão promete o que a pessoa quer, não a mecânica interna do salão. */}
                    <button type="submit" className="td-b td-selo">Start my transformation<span className="td-gr">°</span></button>
                    <button type="button" onClick={() => setPasso(1)} className="text-[13px] font-bold" style={{ color: "var(--sumi2)" }}>back</button>
                  </div>
                </div>
              )}
            </form>
          )}

          <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--linha)" }}>
            <div className="td-rot">Good to know</div>
            <div className="mt-3">
              {FAQ.map(([q, a], i) => (
                <div key={q} style={{ borderTop: i ? "1px solid var(--washi2)" : "none" }}>
                  <button type="button" onClick={() => setAberto(aberto === q ? null : q)}
                    aria-expanded={aberto === q}
                    className="flex w-full items-center justify-between gap-4 py-3.5 text-left">
                    <span className="text-[15.5px] font-bold">{q}</span>
                    <span className="td-mono text-[17px]" style={{ color: "var(--ouro)" }}>{aberto === q ? "−" : "+"}</span>
                  </button>
                  {aberto === q && <p className="pb-4 text-[15px] leading-relaxed" style={{ color: "var(--sumi2)" }}>{a}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="td-cartao p-7" data-escuro="1" style={{ background: "var(--sumi)", color: "var(--washi)", borderColor: "var(--sumi)" }}>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <div className="td-disp text-[22px]">3° SALON</div>
              <div className="td-rot mt-2" style={{ color: "#B9B4A6" }}>Japanese concept · East Village</div>
            </div>
            <div>
              <div className="mb-3 overflow-hidden rounded-[14px]" style={{ height: 92 }}>
                <img src={`${B}/esquina.jpg`} alt="The corner of Cooper Square and East 6th Street" className="td-foto" loading="lazy" style={{ objectPosition: "50% 62%" }} />
              </div>
              <div className="td-rot" style={{ color: "#B9B4A6" }}>Where</div>
              <div className="mt-1.5 text-[15px] leading-relaxed">{ENDERECO}</div>
              <div className="mt-1 text-[13.5px]" style={{ color: "#B9B4A6" }}>Open daily 9am–7pm</div>
            </div>
            <div>
              <div className="td-rot" style={{ color: "#B9B4A6" }}>Reach us</div>
              <a href={`tel:${TEL}`} className="td-disp mt-1.5 block text-[20px]" style={{ color: "var(--washi)" }}>{TEL_FMT}</a>
              <a href={`mailto:${EMAIL}`} className="mt-1 block text-[14px]" style={{ color: "#B9B4A6" }}>{EMAIL}</a>
              <a href={BOOKER} target="_blank" rel="noreferrer" className="mt-1 block text-[14px]" style={{ color: "#B9B4A6" }}>Book on Booker</a>
              <a href="https://www.instagram.com/threedegreessalon/" target="_blank" rel="noreferrer"
                className="mt-1 block text-[14px]" style={{ color: "var(--ouro)" }}>@threedegreessalon</a>
            </div>
          </div>
          <div className="mt-5"><Curva cor="#F5B907" /></div>
        </div>
      </footer>
    </div>
  );
}
