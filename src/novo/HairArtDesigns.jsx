/* ══════════════════════════════════════════════════════════════════════════════════════════════
   HAIR ART DESIGNS — 302 E 19th Street, Gramercy NYC
   Vitrine do COMBO MOTOR. Segue PADRAO-VITRINE.md (clona → ESTUDA → muda), referência viva
   ThreeDegrees.jsx. Tudo aqui é medido, nada é escolhido:

   • ACENTO tirado do PIXEL do logo deles: sálvia #A8C8C0 (24.265 px, a cor dominante das letras)
     e pêssego #D4A078 (a tesoura e o "air"). E o salão REAL confirma a paleta — papel de parede
     chinoiserie sálvia com pássaro e cerejeira, cadeiras de couro caramelo.
   • CONCEITO PRÓPRIO (não o tema de ninguém): HERBÁRIO. O logo deles já é um coração feito de
     folhas, o papel de parede é um ramo florido, a política diz «organic beauty is our guiding
     light», e são Green Circle certified. Então o sistema inteiro é ateliê botânico: papel quente,
     ramo que se desenha, etiquetas de herbário. Vem do mundo DELES.
   • PREÇOS do Phorest (o sistema de agendamento real), não do site — os dois DIVERGEM: o site
     diz Eye Brow Tint $15, o Phorest cobra $10. Quem manda é o sistema que agenda.
   • HORÁRIO real 11am–8pm, 7 dias, achado em /contact-us. O selo vivo usa ISSO.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+12123004407";
const TEL_FMT = "(212) 300-4407";
/* 🚨 DOIS NÚMEROS, E ELES SÃO DIFERENTES. O de texto (332) 323-3125 está escondido em
   /contact-us. Mandar SMS para o número de voz é mensagem que não chega em ninguém. */
const TEXTO = "+13323233125";
const TEXTO_FMT = "(332) 323-3125";
const EMAIL = "hairartdesigns302@gmail.com";
const ENDERECO = "302 East 19th Street, New York, NY 10003";
const PHOREST = "https://phorest.com/book/salons/hairartdesigns";
const B = "/novo/hair-art-designs";
const SITE_URL = "https://guileoai.com/novo/hair-art-designs";

/* ── OS ARTISTAS ────────────────────────────────────────────────────────────────────────────
   5 no sistema de agendamento; o site deles mostra 2. Rafael, Evgeniia e Amelia são invisíveis
   na própria casa. Foto pareada NO MESMO NÓ do DOM (nome e rosto da mesma linha — juntar duas
   fontes já colou o nome de um salão nos números de outro). Amelia não tem foto no Phorest:
   fica sem foto. Inventar rosto é dizer quem atende sem saber. */
const ARTISTAS = [
  { nome: "Iryna", papel: "Founder · Senior Stylist", foto: "iryna",
    bio: "Founded the salon. 16+ years behind the chair, born and raised in Ukraine, and balayage is the heart of her work — she designs the colour that suits you, and tells you why." },
  { nome: "Jenipher", papel: "Senior Stylist", foto: "jenipher", bio: "Senior stylist. Cut and colour." },
  { nome: "Rafael", papel: "Senior Stylist", foto: "rafael", bio: "Senior stylist. Cut and colour." },
  { nome: "Evgeniia", papel: "Senior Stylist", foto: "evgeniia", bio: "Senior stylist. Cut and colour." },
  { nome: "Amelia", papel: "Assistant", foto: null, bio: "Assists on colour and treatments." },
];

/* ── O CARDÁPIO ────────────────────────────────────────────────────────────────────────────
   32 serviços lidos do Phorest, categoria por categoria. `from` é literal do sistema deles:
   quase tudo é a partir de, porque o preço final sai da consulta. "Bob" é o único FECHADO.
   DURAÇÃO: o Phorest não publica. Então não aparece — sem fonte, não se escreve. */
const MENU = [
  { cat: "Haircut", itens: [
    ["Short Haircut", 95, true], ["Medium Haircut", 125, true], ["Thick / Long Haircut", 145, true],
    ["Bob", 115, false], ["Kids Hair Cut", 90, true], ["Bang Trim", 15, true],
  ]},
  { cat: "Hair colour", itens: [
    ["Balayage Full Head", 350, true], ["Balayage Half Head", 275, true],
    ["Highlights Full Head", 350, true], ["Highlights Half Head", 275, true],
    ["Foliage Full Head", 350, true], ["Foliage Half Head", 265, true],
    ["Custom Colour", 380, true], ["Double Process", 400, true],
    ["Platinum All Over", 400, true], ["Platinum New Growth", 220, true], ["Platinum Over Grown", 300, true],
    ["All Over Single Colour", 185, true], ["Root Touch Up", 145, true], ["Root Shadow", 50, true],
    ["Base Break", 50, true], ["Low Lights", 85, true], ["Face Frame", 195, true],
    ["Toner", 85, true], ["Colour Correction", 150, true], ["Eyebrow Tint", 10, true],
  ]},
  { cat: "Hair treatments", itens: [
    ["Keratin", 350, true], ["Deep Treatment", 50, true], ["K18", 50, true], ["Wella Ultra Repair", 50, true],
  ]},
  { cat: "Styling", itens: [["Blow Out and Style", 65, true], ["Updos", 120, true]] },
];

/* Matriz do quote vivo — os mesmos números do Phorest, nunca outros. A faixa alta é o que o
   site DELES publica como topo, quando publica; onde não publica, o quote diz só "from". */
const TETO = {
  "Short Haircut": 125, "Medium Haircut": 145, "Thick / Long Haircut": 175, "Bang Trim": 45,
  "Balayage Full Head": 600, "Balayage Half Head": 350, "Highlights Full Head": 600,
  "Highlights Half Head": 350, "Foliage Full Head": 600, "Foliage Half Head": 350,
  "Custom Colour": 650, "Double Process": 650, "Platinum New Growth": 300, "Platinum Over Grown": 450,
  "All Over Single Colour": 250, "Root Touch Up": 165, "Toner": 150, "Blow Out and Style": 85,
  "Updos": 250, "Keratin": 450,
};

const CANAIS = [
  { id: "phone", rot: "Call me", ico: "☎" },
  { id: "text", rot: "Text me", ico: "✉" },
  { id: "email", rot: "Email me", ico: "✱" },
];

const FAQ = [
  ["Do you take walk-ins?", "Call " + TEL_FMT + " and ask — the chair is either free or it isn't, and the front desk will tell you straight."],
  ["Why is every price a range?", "Because hair is. Length, density and what was done to it before change the work. The number you see is where it starts; the exact figure is agreed at the consultation, before anything is mixed."],
  ["What if I don't like it?", "Come back within 7 days and your original artist adjusts it, free. That is their written policy, not our promise."],
  ["What happens if I cancel?", "More than 24 hours ahead, nothing. Inside 24 hours, 50% of the booked service is charged. A deposit may be asked for on the next booking, and it goes toward that service."],
];

const TITULO = "Hair Art Designs — Balayage & Colour Salon, Gramercy NYC";
const DESC = "Balayage and colour salon at 302 E 19th Street, Gramercy. 5.0 stars across 190 Google reviews, Green Circle certified sustainable, open 7 days 11am-8pm. Every price published. Call (212) 300-4407.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["property", "og:image", "https://guileoai.com" + B + "/salao-1.jpg"],
  ["name", "twitter:card", "summary_large_image"],
];

/* JSON-LD: o site deles não tem NENHUM. Sem isto o Google e os assistentes não sabem que ali
   é um salão de cabelo em Gramercy com estes serviços e este horário. */
const LD = () => ([
  {
    "@context": "https://schema.org", "@type": "HairSalon",
    name: "Hair Art Designs", url: SITE_URL, telephone: TEL, email: EMAIL,
    image: "https://guileoai.com" + B + "/salao-1.jpg",
    address: { "@type": "PostalAddress", streetAddress: "302 East 19th Street",
      addressLocality: "New York", addressRegion: "NY", postalCode: "10003", addressCountry: "US" },
    geo: { "@type": "GeoCoordinates", latitude: 40.7351, longitude: -73.9832 },
    aggregateRating: { "@type": "AggregateRating", ratingValue: "5.0", reviewCount: "190" },
    openingHoursSpecification: [{
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "11:00", closes: "20:00",
    }],
    priceRange: "$$",
    makesOffer: MENU.flatMap((g) => g.itens.map(([n, p]) => ({
      "@type": "Offer", itemOffered: { "@type": "Service", name: n, category: g.cat },
      price: String(p), priceCurrency: "USD",
    }))),
  },
  {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q,
      acceptedAnswer: { "@type": "Answer", text: a } })),
  },
]);

const cotar = (servico) => {
  if (!servico) return null;
  const item = MENU.flatMap((g) => g.itens).find(([n]) => n === servico);
  if (!item) return null;
  const [nome, base, aberto] = item;
  const teto = TETO[nome];
  if (!aberto) return { faixa: "$" + base, nota: "Flat price for this one." };
  if (teto) return { faixa: "$" + base + "–$" + teto, nota: "Where it lands depends on length, density and history — agreed before anything starts." };
  return { faixa: "from $" + base, nota: "The exact figure is agreed at the consultation." };
};

/* O RAMO — a curva-assinatura. Não é enfeite genérico: é o galho do papel de parede que eles
   realmente têm na parede do salão, desenhando-se. */
const Ramo = ({ cor = "var(--salvia)" }) => (
  <svg className="ha-ramo" viewBox="0 0 320 40" fill="none" aria-hidden="true">
    <path d="M4 30 C 70 30, 92 10, 150 12 C 208 14, 236 30, 316 22" stroke={cor} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M104 21 c 8 -12, 22 -12, 26 -2 c -12 6, -20 6, -26 2 Z" fill={cor} opacity=".5" />
    <path d="M196 19 c 9 -11, 23 -10, 26 0 c -12 6, -21 5, -26 0 Z" fill={cor} opacity=".5" />
  </svg>
);

export default function HairArtDesigns() {
  const [form, setForm] = useState({ nome: "", tel: "", servico: "", artista: "", quando: "" });
  const [canal, setCanal] = useState("phone");
  const [passo, setPasso] = useState(0);
  const [outro, setOutro] = useState({ servico: false, quando: false });
  const [livre, setLivre] = useState({ servico: "", quando: "", recado: "" });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [rel, setRel] = useState({ hora: "", aberto: false });
  const [aberto, setAberto] = useState(null);
  const [tomo, setTomo] = useState(0);
  const pedido = useRef(null);
  const raizRef = useRef(null);

  /* REVEAL FAIL-OPEN: o esconder só liga DEPOIS de o observer armar, com failsafe de 1.8s.
     Esconder incondicionalmente já deixou uma página EM BRANCO em aba oculta, onde o
     IntersectionObserver nunca dispara. */
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const els = raiz.querySelectorAll(".ha-rev, .ha-ramo");
    const tudo = () => els.forEach((e) => e.classList.add("is-in"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches
        || !("IntersectionObserver" in window) || document.visibilityState === "hidden") return;
    raiz.classList.add("ha-anima");
    let algum = false;
    const io = new IntersectionObserver((es) => es.forEach((x) => {
      if (x.isIntersecting) { algum = true; x.target.classList.add("is-in"); io.unobserve(x.target); }
    }), { threshold: 0.15 });
    els.forEach((e) => io.observe(e));
    const failsafe = setTimeout(() => { if (!algum) tudo(); }, 1800);
    return () => { clearTimeout(failsafe); io.disconnect(); };
  }, []);

  /* SELO VIVO — um só, e informa. Horário REAL: 7 dias, 11am–8pm (achado em /contact-us). */
  useEffect(() => {
    const tick = () => {
      const f = (o) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...o }).format(new Date());
      const h = Number(f({ hour: "numeric", hour12: false }));
      setRel({ hora: f({ hour: "numeric", minute: "2-digit", hour12: true }), aberto: h >= 11 && h < 20 });
    };
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
  }, []);

  /* HERO-FILME: eles não têm vídeo, então 3 fotos reais do salão em cross-fade, cada uma com o
     seu movimento. Nunca banco de imagem. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTomo((t) => (t + 1) % 3), 7000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const antes = document.title;
    document.title = TITULO;
    const criados = [], repor = [];
    META.forEach(([k, v, c]) => {
      const achou = document.head.querySelector("meta[" + k + '="' + v + '"]');
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
  }, []);

  const enviar = useCallback(async (e) => {
    e.preventDefault();
    setErroEnvio("");
    const q = cotar(form.servico);
    const servico = outro.servico ? livre.servico : form.servico;
    const quando = outro.quando ? livre.quando : form.quando;
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "hair-art-designs", negocio: "Hair Art Designs",
          nome: form.nome, telefone: form.tel,
          mensagem: "[" + (servico || "service?")
            + (form.artista ? " · with " + form.artista : "")
            + (q ? " · quoted " + q.faixa : "") + "] "
            + (quando || "any time") + " · reply on " + canal
            + (livre.recado ? " · note: " + livre.recado : ""),
        }),
      });
      const d = await r.json().catch(() => null);
      // O CORPO decide, não o status: `r.ok` sozinho já deixou recusa passar por sucesso.
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErroEnvio("That didn't send — call " + TEL_FMT + ", someone picks up.");
  }, [form, canal, outro, livre]);

  const podeAvancar = passo === 0 ? !!(form.servico || livre.servico)
    : passo === 1 ? !!(form.quando || livre.quando)
    : !!(form.nome.trim() && form.tel.trim());

  return (
    <div className="ha-raiz" ref={raizRef}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .ha-raiz{
          --papel:#F6F3EE; --papel2:#EDE8E0; --branco:#FFFFFF;
          --tinta:#2C3330; --tinta2:#5E6B65; --tinta3:#8C978F;
          --salvia:#A8C8C0; --salvia-e:#6E9A8F; --salvia-f:#4A6B62;
          --pessego:#D4A078; --pessego-e:#B87B4E;
          --linha:#DCD5CA;
          background:var(--papel); color:var(--tinta); min-height:100vh;
          font-family:'Jost',system-ui,-apple-system,sans-serif;
          position:relative; overflow-x:hidden;
        }
        /* GRÃO na raiz — o realismo 4K começa aqui. z-index nos filhos, senão o grão pinta por cima. */
        .ha-raiz::before{
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.35;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E");
        }
        .ha-raiz > *{position:relative; z-index:1;}

        .ha-serif{font-family:'Cormorant Garamond',Georgia,serif;}
        .ha-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
        .ha-eyebrow{font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.2em;
          text-transform:uppercase; color:var(--salvia-f);}

        /* ── O SELO (aprovado: massa lapidada, borda na cor deles, canto suave 10px) ────────── */
        .ha-selo{
          position:relative; display:inline-flex; align-items:center; gap:9px; overflow:hidden;
          min-height:52px; padding:0 24px; border-radius:10px;
          font-weight:600; font-size:15px; letter-spacing:.01em; text-decoration:none;
          color:var(--tinta); background:var(--branco);
          background-image:linear-gradient(180deg,rgba(255,255,255,.9),rgba(237,232,224,.9));
          border:1.5px solid var(--salvia-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(74,107,98,.12),
                     0 1px 2px rgba(44,51,48,.14), 0 14px 26px -18px rgba(44,51,48,.5);
          transition:border-color .25s, box-shadow .25s, transform .12s;
        }
        .ha-selo::after{
          content:""; position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(115deg,transparent 30%,rgba(168,200,192,.55) 48%,transparent 66%);
          transform:translateX(-120%); transition:transform .75s ease;
        }
        .ha-selo:hover::after{transform:translateX(120%);}
        .ha-selo:hover{border-color:var(--salvia-f); box-shadow:inset 0 1px 0 rgba(255,255,255,.95),
          0 2px 4px rgba(44,51,48,.16), 0 20px 34px -18px rgba(74,107,98,.55);}
        .ha-selo:active{transform:scale(.985);}
        .ha-selo[disabled],.ha-selo.off{opacity:.55; filter:saturate(.5); pointer-events:none;}
        .ha-selo-forte{border-color:var(--pessego-e); background-image:linear-gradient(180deg,#FFF,#F3E4D6);}
        .ha-selo-forte::after{background:linear-gradient(115deg,transparent 30%,rgba(212,160,120,.6) 48%,transparent 66%);}

        /* ── CARTÃO — material, não retângulo chapado ─────────────────────────────────────── */
        .ha-card{
          position:relative; border-radius:20px; background:var(--branco);
          border:1px solid var(--linha);
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(44,51,48,.06),
                     0 1px 2px rgba(44,51,48,.06), 0 26px 48px -34px rgba(44,51,48,.42);
          overflow:hidden;
        }
        /* VERNIZ diagonal — a cor NUNCA entra na superfície do vidro (tingir vira plástico néon) */
        .ha-card::after{
          content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,.14) 100%);
        }
        .ha-card > *{position:relative; z-index:2;}

        /* ── HERO-FILME: 3 fotos reais, cada uma com o seu movimento ───────────────────────── */
        .ha-tomo{position:absolute; inset:0; opacity:0; transition:opacity 1.6s ease; will-change:opacity;}
        .ha-tomo.on{opacity:1;}
        .ha-tomo img{width:100%; height:100%; object-fit:cover; display:block;}
        .ha-tomo:nth-child(1) img{animation:ha-push 21s ease-in-out infinite;}
        .ha-tomo:nth-child(2) img{animation:ha-pan 21s ease-in-out infinite;}
        .ha-tomo:nth-child(3) img{animation:ha-sobe 21s ease-in-out infinite;}
        @keyframes ha-push{0%{transform:scale(1.02)}100%{transform:scale(1.13)}}
        @keyframes ha-pan{0%{transform:scale(1.1) translateX(2%)}100%{transform:scale(1.1) translateX(-2.5%)}}
        @keyframes ha-sobe{0%{transform:scale(1.09) translateY(1.5%)}100%{transform:scale(1.09) translateY(-1.5%)}}
        /* VÉU DIRECIONAL: pesado do lado do texto, abre ~4% do outro pra foto deles aparecer */
        .ha-veu{position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(100deg,rgba(246,243,238,.97) 0%,rgba(246,243,238,.93) 32%,rgba(246,243,238,.6) 52%,rgba(246,243,238,.14) 78%,rgba(246,243,238,0) 100%),
                      linear-gradient(0deg,rgba(246,243,238,.92) 0%,rgba(246,243,238,.5) 16%,rgba(246,243,238,0) 34%);}
        /* VINHETA de lente — foto real tem queda de luz nas quinas */
        .ha-vinheta{position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(120% 90% at 50% 45%,transparent 62%,rgba(44,51,48,.14) 100%);}

        /* ── MOVIMENTO ────────────────────────────────────────────────────────────────────── */
        .ha-anima .ha-rev{opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s ease;}
        .ha-anima .ha-rev.is-in{opacity:1; transform:none;}
        .ha-ramo{width:100%; max-width:320px; height:40px;}
        .ha-anima .ha-ramo path{stroke-dasharray:400; stroke-dashoffset:400; transition:stroke-dashoffset 1.6s ease;}
        .ha-ramo.is-in path{stroke-dashoffset:0;}
        @media (prefers-reduced-motion: reduce){
          .ha-tomo img{animation:none !important;}
          .ha-rev{opacity:1 !important; transform:none !important;}
          .ha-ramo path{stroke-dashoffset:0 !important;}
        }

        .ha-pulso{position:relative; display:inline-flex; width:7px; height:7px; border-radius:999px;}
        .ha-pulso::after{content:""; position:absolute; inset:0; border-radius:inherit;
          background:inherit; animation:ha-ping 2.4s cubic-bezier(0,0,.2,1) infinite;}
        @keyframes ha-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.6);opacity:0}}

        .ha-pilula{min-height:44px; padding:0 16px; border-radius:999px; border:1px solid var(--linha);
          background:var(--branco); color:var(--tinta2); font-size:13.5px; font-weight:500;
          transition:border-color .2s,color .2s,background .2s;}
        .ha-pilula:hover{border-color:var(--salvia-e); color:var(--tinta);}
        .ha-pilula[data-on="1"]{border-color:var(--salvia-f); background:rgba(168,200,192,.2); color:var(--tinta);}

        .ha-campo{width:100%; min-height:52px; padding:0 16px; border-radius:12px;
          border:1px solid var(--linha); background:var(--branco); color:var(--tinta); font-size:15px;}
        .ha-campo::placeholder{color:var(--tinta3);}
        .ha-campo:focus{outline:none; border-color:var(--salvia-f); box-shadow:0 0 0 3px rgba(168,200,192,.3);}

        @media (max-width:639px){ .ha-raiz{padding-bottom:8px;} }
      `}</style>

      {/* ── CABEÇALHO: marca + ação na MESMA linha, nunca quebra ───────────────────────────── */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "var(--linha)", background: "rgba(246,243,238,.86)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-3 px-4 py-3">
          {/* PLACA do logo — arquivo com fundo claro colado na página lê como adesivo */}
          <a href="#topo" className="flex min-w-0 flex-nowrap items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl"
              style={{ background: "var(--branco)", border: "1px solid var(--linha)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,1), 0 1px 2px rgba(44,51,48,.12)" }}>
              <img src={B + "/logo.png"} alt="Hair Art Designs" width="34" height="20" className="w-[34px]" />
            </span>
            <span className="ha-serif min-w-0 truncate font-semibold" style={{ fontSize: "clamp(15px,3.6vw,21px)" }}>
              Hair Art Designs
            </span>
          </a>
          <span className="flex-1" />
          <a href={"tel:" + TEL} className="ha-selo ha-selo-forte shrink-0" style={{ padding: "0 18px" }}>
            <span aria-hidden>☎</span>
            <span className="hidden sm:inline">{TEL_FMT}</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────────────────────── */}
      <section id="topo" className="relative overflow-hidden" style={{ minHeight: "min(86vh,760px)" }}>
        <div className="absolute inset-0">
          {[1, 2, 3].map((n, i) => (
            <div key={n} className={"ha-tomo" + (tomo === i ? " on" : "")}>
              <img src={B + "/salao-" + n + ".jpg"} alt="Inside Hair Art Designs on East 19th Street" loading={i === 0 ? "eager" : "lazy"} />
            </div>
          ))}
          <div className="ha-veu" />
          <div className="ha-vinheta" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col justify-center px-4" style={{ minHeight: "min(86vh,760px)" }}>
          <div className="max-w-[42rem] py-16">
            <Ramo />
            <div className="ha-eyebrow mt-4">302 East 19th Street · Gramercy</div>
            <h1 className="ha-serif mt-3 font-semibold" style={{ fontSize: "clamp(38px,7.2vw,74px)", lineHeight: 1.03, letterSpacing: "-.02em", textWrap: "balance" }}>
              The colour is designed<br />
              <span style={{ color: "var(--salvia-f)" }}>for your hair.</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-[16.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
              Balayage is the heart of this salon — and Iryna will tell you which technique she is using and why before she starts.
            </p>

            {/* A LINHA DE PROMESSA — é o que justifica apertar o botão */}
            <div className="mt-6 flex items-start gap-3 border-l-2 pl-3.5" style={{ borderColor: "var(--pessego-e)" }}>
              <p className="text-[15px] font-medium leading-snug">
                Open seven days, 11am–8pm. Every price is published below — and if you are not happy, your artist adjusts it free within 7 days.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <a href={"tel:" + TEL} className="ha-selo ha-selo-forte"><span aria-hidden>☎</span> Call {TEL_FMT}</a>
              <a href="#pedido" className="ha-selo"><span aria-hidden>✦</span> Design my appointment</a>
            </div>

            {/* FAIXA DE CREDENCIAIS, fundida na borda inferior da hero. UM selo vivo só, e informa. */}
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-5" style={{ borderColor: "var(--linha)" }}>
              <span className="inline-flex items-center gap-2 text-[13px] font-medium">
                <span className="ha-pulso" style={{ background: rel.aberto ? "var(--salvia-f)" : "var(--pessego-e)" }} />
                <span className="ha-mono">{rel.aberto ? "Open now" : "Closed"} · {rel.hora} NYC</span>
              </span>
              <span className="ha-eyebrow">5.0 ★ · 190 Google reviews</span>
              <span className="ha-eyebrow">Green Circle certified</span>
              <span className="ha-eyebrow">IGK · vegan &amp; cruelty-free</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS — compactos de propósito: não podem competir com o pedido ─────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16" id="menu">
        <div className="ha-rev">
          <div className="ha-eyebrow">The menu</div>
          <h2 className="ha-serif mt-2 font-semibold" style={{ fontSize: "clamp(28px,4.6vw,42px)", lineHeight: 1.1 }}>
            Every price, in the open
          </h2>
          <p className="mt-2 max-w-[38rem] text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
            These are the prices in their booking system — not a brochure. Most are a starting point, because length and history change the work; the exact figure is agreed before anything is mixed.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-4 sm:grid-cols-2">
          {MENU.map((g) => (
            <div key={g.cat} className="ha-card ha-rev p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="ha-serif text-[22px] font-semibold">{g.cat}</h3>
                <span className="ha-mono text-[11px]" style={{ color: "var(--tinta3)" }}>{g.itens.length}</span>
              </div>
              <ul className="mt-3 space-y-0">
                {g.itens.map(([nome, preco, aberto]) => (
                  <li key={nome} className="flex items-baseline justify-between gap-3 border-b py-2 last:border-0" style={{ borderColor: "var(--linha)" }}>
                    <button type="button" onClick={() => { escolher("servico", nome); setOutro((o) => ({ ...o, servico: false })); setPasso(0); pedido.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                      className="min-h-[38px] text-left text-[14.5px] leading-snug hover:underline" style={{ color: "var(--tinta)" }}>
                      {nome}
                    </button>
                    <span className="ha-mono shrink-0 text-[13px]" style={{ color: "var(--salvia-f)" }}>
                      {aberto ? "from " : ""}${preco}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="ha-rev mt-4 text-[13px]" style={{ color: "var(--tinta3)" }}>
          Tap any service and it lands in the request below, priced.
        </p>
      </section>

      {/* ── OS ARTISTAS ────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-16" id="artists">
        <div className="ha-rev">
          <div className="ha-eyebrow">Who is behind the chair</div>
          <h2 className="ha-serif mt-2 font-semibold" style={{ fontSize: "clamp(28px,4.6vw,42px)", lineHeight: 1.1 }}>
            Five artists, not a rota
          </h2>
        </div>
        <div className="mt-7 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ARTISTAS.map((a) => (
            <div key={a.nome} className="ha-card ha-rev p-5">
              <div className="flex items-center gap-3.5">
                {a.foto ? (
                  <img src={B + "/staff/" + a.foto + ".jpg"} alt={a.nome + ", " + a.papel + " at Hair Art Designs"} width="64" height="64" loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-full object-cover"
                    style={{ border: "2px solid var(--salvia)", boxShadow: "0 2px 8px rgba(44,51,48,.16)" }} />
                ) : (
                  /* Sem foto no sistema deles → inicial. Inventar rosto é dizer quem atende sem saber. */
                  <span className="ha-serif grid h-16 w-16 shrink-0 place-items-center rounded-full text-[24px] font-semibold"
                    style={{ background: "rgba(168,200,192,.28)", border: "2px solid var(--salvia)", color: "var(--salvia-f)" }}>
                    {a.nome[0]}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="ha-serif text-[21px] font-semibold leading-tight">{a.nome}</div>
                  <div className="ha-eyebrow mt-0.5">{a.papel}</div>
                </div>
              </div>
              <p className="mt-3.5 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a.bio}</p>
              <button type="button" onClick={() => { escolher("artista", a.nome); pedido.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="ha-pilula mt-3.5" data-on={form.artista === a.nome ? "1" : "0"}>
                Ask for {a.nome}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── O PEDIDO: quiz de 2 perguntas por vez, com escape em todo passo ────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-16" id="pedido" ref={pedido}>
        <div className="ha-card ha-rev p-6 sm:p-8">
          {enviado ? (
            <div className="py-6 text-center">
              <div className="ha-serif text-[30px] font-semibold" style={{ color: "var(--salvia-f)" }}>Got it.</div>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Your request is with the salon. Someone comes back on the channel you picked — and if you would rather not wait, {TEL_FMT} rings the front desk.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <div className="ha-eyebrow">Design my appointment</div>
              <h2 className="ha-serif mt-2 font-semibold" style={{ fontSize: "clamp(26px,4.2vw,38px)", lineHeight: 1.1 }}>
                {passo === 0 ? "What are we doing?" : passo === 1 ? "When suits you?" : "Where do we answer?"}
              </h2>

              {/* barra de progresso que só anda com resposta */}
              <div className="mt-4 flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((p) => (
                  <span key={p} className="h-1 flex-1 rounded-full transition-colors"
                    style={{ background: p <= passo ? "var(--salvia-f)" : "var(--linha)" }} />
                ))}
              </div>

              {passo === 0 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {["Short Haircut", "Medium Haircut", "Balayage Full Head", "Highlights Half Head", "All Over Single Colour", "Keratin", "Blow Out and Style"].map((s) => (
                      <button key={s} type="button" onClick={() => { escolher("servico", s); setOutro((o) => ({ ...o, servico: false })); }}
                        className="ha-pilula" data-on={form.servico === s && !outro.servico ? "1" : "0"}>{s}</button>
                    ))}
                    {/* ESCAPE — quem quer "consertar o que fizeram em outro salão" não se vê em pílula nenhuma */}
                    <button type="button" onClick={() => setOutro((o) => ({ ...o, servico: true }))}
                      className="ha-pilula" data-on={outro.servico ? "1" : "0"}>Something else…</button>
                  </div>
                  {outro.servico && (
                    <input className="ha-campo mt-3" placeholder="Tell us in your own words" value={livre.servico}
                      onChange={(e) => setLivre((l) => ({ ...l, servico: e.target.value }))} />
                  )}
                  {!outro.servico && form.servico && cotar(form.servico) && (
                    <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(168,200,192,.16)", border: "1px solid var(--salvia)" }}>
                      <div className="ha-mono text-[19px] font-medium" style={{ color: "var(--salvia-f)" }}>{cotar(form.servico).faixa}</div>
                      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{cotar(form.servico).nota}</p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ARTISTAS.map((a) => (
                      <button key={a.nome} type="button" onClick={() => escolher("artista", form.artista === a.nome ? "" : a.nome)}
                        className="ha-pilula" data-on={form.artista === a.nome ? "1" : "0"}>{a.nome}</button>
                    ))}
                    <span className="self-center text-[12.5px]" style={{ color: "var(--tinta3)" }}>optional</span>
                  </div>
                </div>
              )}

              {passo === 1 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {["Today if possible", "This week", "Next week", "Weekend", "Evenings only"].map((q) => (
                      <button key={q} type="button" onClick={() => { escolher("quando", q); setOutro((o) => ({ ...o, quando: false })); }}
                        className="ha-pilula" data-on={form.quando === q && !outro.quando ? "1" : "0"}>{q}</button>
                    ))}
                    <button type="button" onClick={() => setOutro((o) => ({ ...o, quando: true }))}
                      className="ha-pilula" data-on={outro.quando ? "1" : "0"}>A specific date…</button>
                  </div>
                  {outro.quando && (
                    <input className="ha-campo mt-3" placeholder="Which day and roughly what time?" value={livre.quando}
                      onChange={(e) => setLivre((l) => ({ ...l, quando: e.target.value }))} />
                  )}
                </div>
              )}

              {passo === 2 && (
                <div className="mt-6 space-y-3">
                  <input className="ha-campo" placeholder="Your name" value={form.nome} onChange={(e) => escolher("nome", e.target.value)} />
                  <input className="ha-campo" type="tel" placeholder="Phone" value={form.tel} onChange={(e) => escolher("tel", e.target.value)} />
                  {/* MULTICANAL: só canais que este salão realmente atende */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CANAIS.map((c) => (
                      <button key={c.id} type="button" onClick={() => setCanal(c.id)} className="ha-pilula" data-on={canal === c.id ? "1" : "0"}>
                        <span aria-hidden className="mr-1.5">{c.ico}</span>{c.rot}
                      </button>
                    ))}
                  </div>
                  <textarea className="ha-campo py-3" rows={2} placeholder="Anything they should know? (optional)" value={livre.recado}
                    onChange={(e) => setLivre((l) => ({ ...l, recado: e.target.value }))} style={{ minHeight: 72, resize: "vertical" }} />
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {passo > 0 && (
                  <button type="button" onClick={() => setPasso((p) => p - 1)} className="ha-pilula">← Back</button>
                )}
                {passo < 2 ? (
                  <button type="button" disabled={!podeAvancar} onClick={() => setPasso((p) => p + 1)}
                    className={"ha-selo" + (podeAvancar ? "" : " off")}>Next</button>
                ) : (
                  /* O botão promete o RESULTADO, não a mecânica */
                  <button type="submit" disabled={!podeAvancar} className={"ha-selo ha-selo-forte" + (podeAvancar ? "" : " off")}>
                    <span aria-hidden>✦</span> Start my appointment
                  </button>
                )}
                <a href={"tel:" + TEL} className="self-center text-[13.5px] underline" style={{ color: "var(--tinta2)" }}>or just call {TEL_FMT}</a>
              </div>
              {erroEnvio && <p className="mt-3 text-[13.5px]" style={{ color: "var(--pessego-e)" }}>{erroEnvio}</p>}
            </form>
          )}
        </div>
      </section>

      {/* ── POLÍTICAS: aparecem na ESCOLHA, não escondidas no rodapé ──────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="ha-rev">
          <div className="ha-eyebrow">House rules</div>
          <h2 className="ha-serif mt-2 font-semibold" style={{ fontSize: "clamp(26px,4.2vw,38px)", lineHeight: 1.1 }}>
            Said before you sit down
          </h2>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Not happy?", "Come back within 7 days and your original artist adjusts the service free of charge. Services already rendered are not refunded in cash."],
            ["Cancelling", "More than 24 hours ahead costs nothing. Inside 24 hours is 50% of the booked service. A deposit may be asked for on the next booking, and it counts toward it."],
            ["Products", "Unopened, back within 7 days for exchange or store credit. Opened carries a 25% restocking fee. Gift cards are not refundable."],
          ].map(([t, d]) => (
            <div key={t} className="ha-card ha-rev p-5">
              <div className="ha-serif text-[20px] font-semibold">{t}</div>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="ha-rev ha-eyebrow">Questions</div>
        <div className="mt-4 space-y-2.5">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="ha-card ha-rev">
              <button type="button" onClick={() => setAberto(aberto === i ? null : i)}
                aria-expanded={aberto === i}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 px-5 text-left">
                <span className="text-[15px] font-medium">{q}</span>
                <span aria-hidden style={{ color: "var(--salvia-f)" }}>{aberto === i ? "−" : "+"}</span>
              </button>
              {aberto === i && (
                <p className="px-5 pb-4 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTATO: tudo à vista e VIVO ──────────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: "var(--linha)", background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <img src={B + "/logo.png"} alt="Hair Art Designs" width="150" height="87" className="w-[150px]" />
              <p className="mt-4 text-[14.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                A Green Circle certified salon on East 19th Street. Up to 95% of what a salon throws away can be recovered — hair, foil, colour, paper. They pay for that themselves, and they help Ukrainian and other refugees at their own expense too.
              </p>
            </div>
            <div className="space-y-2.5">
              {/* Cada canal é clicável e vivo. O de TEXTO é o outro número, de propósito. */}
              <a href={"tel:" + TEL} className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--pessego-e)" }}>☎</span> Call {TEL_FMT}
              </a>
              <a href={"sms:" + TEXTO} className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--pessego-e)" }}>✉</span> Text {TEXTO_FMT}
              </a>
              <a href={"mailto:" + EMAIL} className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px] break-all">
                <span aria-hidden style={{ color: "var(--pessego-e)" }}>✱</span> {EMAIL}
              </a>
              <a href="https://maps.google.com/?q=302+East+19th+Street+New+York+NY+10003" target="_blank" rel="noreferrer"
                className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--pessego-e)" }}>◈</span> {ENDERECO}
              </a>
              <a href={PHOREST} target="_blank" rel="noreferrer" className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--pessego-e)" }}>▤</span> Book on their own system
              </a>
              <div className="ha-mono pt-1 text-[12px]" style={{ color: "var(--tinta3)" }}>
                Open 7 days · 11am – 8pm
              </div>
            </div>
          </div>
          <div className="mt-9 flex justify-center"><Ramo cor="var(--pessego)" /></div>
        </div>
      </footer>
    </div>
  );
}
