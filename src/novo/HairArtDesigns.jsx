/* ══════════════════════════════════════════════════════════════════════════════════════════════
   HAIR ART DESIGNS — 302 E 19th Street, Gramercy NYC · vitrine do COMBO MOTOR
   Referência de MÉTODO: ThreeDegrees.jsx. Esta versão nasceu de um DIFF contra ele: a v1 tinha
   736 linhas contra 1071 e faltava VÍDEO, prova medida, a fita de fotos, a ponte do booking e —
   pior — a seção que mostra O QUE A IA FAZ, que é a que vende. Está tudo aqui.

   DIREÇÃO (Luis 27/08): «a hero sempre impactante com vídeo, isso converte» + «joga uma abertura»
   + «precisa de um toque VOGUE de salão». Então:
   • HERO = VÍDEO de verdade (hero.mp4, 20,2s em loop sem corte seco), montado a partir das FOTOS
     REAIS deles: 5 planos, cada um com movimento próprio. Eles não têm vídeo no site; banco de
     imagem é proibido; a saída honesta é transformar o material verdadeiro em filme.
   • ABERTURA = cortina que sobe uma vez. FAIL-OPEN: o estado inicial é "já abriu", então sem JS,
     em aba oculta ou com reduced-motion ela simplesmente não existe. Cortina presa = site perdido.
   • VOGUE = masthead em Bodoni Moda (a didone da Vogue), filete de cabelo, caixa-alta espaçada,
     numeração editorial 01…08, texto SOBRE a foto. A cor continua sendo DELES.

   MEDIDO, NÃO ESCOLHIDO: sálvia #A8C8C0 e pêssego #D4A078 tirados do pixel do logo; horário
   11am–8pm, 7 dias (achado em /contact-us); preços do Phorest, o sistema que agenda de verdade.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+12123004407";
const TEL_FMT = "(212) 300-4407";
/* 🚨 DOIS NÚMEROS. O de texto (332) 323-3125 está escondido em /contact-us. Mandar SMS para o
   número de voz é mensagem que não chega em ninguém. */
const TEXTO = "+13323233125";
const TEXTO_FMT = "(332) 323-3125";
const EMAIL = "hairartdesigns302@gmail.com";
const ENDERECO = "302 East 19th Street, New York, NY 10003";
const PHOREST = "https://phorest.com/book/salons/hairartdesigns";
const B = "/novo/hair-art-designs";
const SITE_URL = "https://guileoai.com/novo/hair-art-designs";

const ARTISTAS = [
  { nome: "Iryna", papel: "Founder · Senior Stylist", foto: "iryna",
    bio: "Founded the salon. 16+ years behind the chair, born and raised in Ukraine. Balayage is the heart of her work — she designs the colour that suits you, and tells you which technique she is using and why before she starts." },
  { nome: "Jenipher", papel: "Senior Stylist", foto: "jenipher", bio: "Cut and colour." },
  { nome: "Rafael", papel: "Senior Stylist", foto: "rafael", bio: "Cut and colour." },
  { nome: "Evgeniia", papel: "Senior Stylist", foto: "evgeniia", bio: "Cut and colour." },
  { nome: "Amelia", papel: "Assistant", foto: null, bio: "Assists on colour and treatments." },
];

/* 32 serviços lidos do Phorest. "from" é literal do sistema deles. DURAÇÃO não entra: eles não
   publicam, e minuto inventado é o defeito do preço-âncora aplicado à agenda. */
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

const TETO = {
  "Short Haircut": 125, "Medium Haircut": 145, "Thick / Long Haircut": 175, "Bang Trim": 45,
  "Balayage Full Head": 600, "Balayage Half Head": 350, "Highlights Full Head": 600,
  "Highlights Half Head": 350, "Foliage Full Head": 600, "Foliage Half Head": 350,
  "Custom Colour": 650, "Double Process": 650, "Platinum New Growth": 300, "Platinum Over Grown": 450,
  "All Over Single Colour": 250, "Root Touch Up": 165, "Toner": 150, "Blow Out and Style": 85,
  "Updos": 250, "Keratin": 450,
};

/* A FITA DA CASA — as fotos reais que eles publicam, com legenda HONESTA do que a foto mostra.
   Foto real é a prova social que render nenhum substitui. */
const CASA = [
  ["salao-1.jpg", "The floor at 302 East 19th — chinoiserie wall, leather chairs, afternoon light"],
  ["casa-2.jpg", "Two artists at the basins, mid-service"],
  ["casa-3.jpg", "A blow-dry in progress, seen from the street"],
  ["casa-4.jpg", "The round mirror, and Gramercy going past outside"],
  ["casa-5.jpg", "The IGK shelf — vegan and cruelty-free, what they actually use on you"],
  ["salao-3.jpg", "A client on her way out after colour"],
];

/* O QUE A SAGE FAZ — a seção que faltava, e é a que vende. Cada linha é função que ela JÁ
   executa, nunca promessa de roadmap. */
const FUNCOES = [
  ["Answers at 3am", "The phone rings at 2:40 on a Sunday morning. Sage picks up in the salon's name, and she knows the whole menu."],
  ["Quotes the real prices", "The same numbers the booking system charges — and she gives the range, never one invented figure."],
  ["Takes the booking request", "Name, service, artist, when. It reaches the front desk with everything already asked."],
  ["Calls the lead back", "Someone leaves a number on this page and the phone rings back. That is not a mock-up — the form below does it."],
  ["Four languages", "English, Spanish, Portuguese, Hindi. In Gramercy that is not a luxury."],
  ["Never invents", "No price, no service, no artist, no time slot. When she does not know: \"I'd rather have the front desk confirm that than guess.\""],
];

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
  ["property", "og:image", "https://guileoai.com" + B + "/hero-poster.jpg"],
  ["name", "twitter:card", "summary_large_image"],
];

/* O site deles não tem NENHUM dado estruturado. Sem isto o Google e os assistentes não sabem
   que ali é um salão de cabelo em Gramercy, com estes serviços e este horário. */
const LD = () => ([
  {
    "@context": "https://schema.org", "@type": "HairSalon",
    name: "Hair Art Designs", url: SITE_URL, telephone: TEL, email: EMAIL,
    image: "https://guileoai.com" + B + "/hero-poster.jpg",
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
  const [nome, base, ab] = item;
  const teto = TETO[nome];
  if (!ab) return { faixa: "$" + base, nota: "Flat price for this one." };
  if (teto) return { faixa: "$" + base + "–$" + teto, nota: "Where it lands depends on length, density and history — agreed before anything starts." };
  return { faixa: "from $" + base, nota: "The exact figure is agreed at the consultation." };
};

/* O RAMO — o galho do papel de parede que eles realmente têm na parede, desenhando-se. */
const Ramo = ({ cor = "var(--salvia)" }) => (
  <svg className="ha-ramo" viewBox="0 0 320 40" fill="none" aria-hidden="true">
    <path d="M4 30 C 70 30, 92 10, 150 12 C 208 14, 236 30, 316 22" stroke={cor} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M104 21 c 8 -12, 22 -12, 26 -2 c -12 6, -20 6, -26 2 Z" fill={cor} opacity=".5" />
    <path d="M196 19 c 9 -11, 23 -10, 26 0 c -12 6, -21 5, -26 0 Z" fill={cor} opacity=".5" />
  </svg>
);

const Titulo = ({ n, children, sub }) => (
  <div className="ha-rev">
    <span className="ha-num">{n}</span>
    <h2 className="ha-vogue mt-1 font-medium" style={{ fontSize: "clamp(28px,5vw,46px)", lineHeight: 1.04, letterSpacing: "-.015em" }}>
      {children}
    </h2>
    {sub && <p className="mt-2.5 max-w-[40rem] text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{sub}</p>}
    <hr className="ha-filete mt-5" />
  </div>
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
  const [catAtiva, setCatAtiva] = useState("Hair colour");
  /* A cortina começa em "nunca" — o estado SEM abertura. Só o efeito (que só roda com JS vivo)
     a fecha. Assim nenhum caminho de falha deixa uma cortina presa na frente da página. */
  const [cortina, setCortina] = useState("nunca"); // nunca | fechada | subindo
  const pedido = useRef(null);
  const raizRef = useRef(null);

  /* REVEAL FAIL-OPEN — o esconder só liga DEPOIS de o observer armar, com failsafe de 1.8s.
     (Esconder incondicionalmente já deixou uma página EM BRANCO em aba oculta.) */
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

  /* A ABERTURA. Vive 1,4s e sobe. O segundo timer é INDEPENDENTE do primeiro de propósito:
     se qualquer coisa travar no meio, aos 2,5s a cortina deixa de existir de qualquer jeito. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.visibilityState === "hidden") return;
    setCortina("fechada");
    const t1 = setTimeout(() => setCortina("subindo"), 1400);
    const t2 = setTimeout(() => setCortina("nunca"), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  /* UM selo vivo só, e ele INFORMA: relógio de NY + aberto/fechado do MESMO tick. */
  useEffect(() => {
    const tick = () => {
      const f = (o) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...o }).format(new Date());
      const h = Number(f({ hour: "numeric", hour12: false }));
      setRel({ hora: f({ hour: "numeric", minute: "2-digit", hour12: true }), aberto: h >= 11 && h < 20 });
    };
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
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

  const escolher = useCallback((campo, valor) => setForm((f) => ({ ...f, [campo]: valor })), []);

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

  const grupo = MENU.find((g) => g.cat === catAtiva) || MENU[0];

  return (
    <div className="ha-raiz" ref={raizRef}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400;1,6..96,500&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .ha-raiz{
          --papel:#F7F5F1; --papel2:#EDEAE3; --branco:#FFFFFF;
          --tinta:#16191A; --tinta2:#5A625F; --tinta3:#949C97;
          --salvia:#A8C8C0; --salvia-e:#6E9A8F; --salvia-f:#41615A;
          --pessego:#D4A078; --pessego-e:#A96C3E;
          --linha:#D9D3C9;
          background:var(--papel); color:var(--tinta); min-height:100vh;
          font-family:'Jost',system-ui,-apple-system,sans-serif;
          position:relative; overflow-x:hidden;
        }
        /* GRÃO na raiz — o realismo 4K começa aqui. z-index nos filhos, senão pinta por cima. */
        .ha-raiz::before{
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.32;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E");
        }
        .ha-raiz > *{position:relative; z-index:1;}

        /* ── VOGUE: a didone é a voz da página ─────────────────────────────────────────────── */
        .ha-vogue{font-family:'Bodoni Moda',Didot,'Playfair Display',Georgia,serif;}
        .ha-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
        .ha-kicker{font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.26em;
          text-transform:uppercase; color:var(--salvia-f);}
        .ha-num{font-family:'Bodoni Moda',Didot,serif; font-size:12.5px; letter-spacing:.12em; color:var(--pessego-e);}
        .ha-filete{height:1px; background:var(--linha); border:0;}

        /* ── A ABERTURA ────────────────────────────────────────────────────────────────────── */
        .ha-cortina{position:fixed; inset:0; z-index:60; background:var(--papel);
          display:grid; place-items:center;
          transition:transform 1.05s cubic-bezier(.72,0,.18,1), opacity 1.05s ease;}
        .ha-cortina.sobe{transform:translateY(-100%); opacity:0;}
        .ha-cortina img{width:min(58vw,300px); animation:ha-respira 1.4s ease both;}
        @keyframes ha-respira{0%{opacity:0; transform:scale(.93)}100%{opacity:1; transform:none}}

        /* ── O SELO (aprovado: massa lapidada, borda na cor deles, canto 10px, nunca cápsula) ─ */
        .ha-selo{
          position:relative; display:inline-flex; align-items:center; gap:9px; overflow:hidden;
          min-height:52px; padding:0 24px; border-radius:10px;
          font-weight:600; font-size:15px; letter-spacing:.01em; text-decoration:none;
          color:var(--tinta); background:var(--branco);
          background-image:linear-gradient(180deg,rgba(255,255,255,.94),rgba(237,234,227,.94));
          border:1.5px solid var(--salvia-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(65,97,90,.12),
                     0 1px 2px rgba(22,25,26,.14), 0 14px 26px -18px rgba(22,25,26,.5);
          transition:border-color .25s, box-shadow .25s, transform .12s;
        }
        .ha-selo::after{content:""; position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(115deg,transparent 30%,rgba(168,200,192,.55) 48%,transparent 66%);
          transform:translateX(-120%); transition:transform .75s ease;}
        .ha-selo:hover::after{transform:translateX(120%);}
        .ha-selo:hover{border-color:var(--salvia-f);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(22,25,26,.16),
                     0 20px 34px -18px rgba(65,97,90,.55), 0 0 0 4px rgba(168,200,192,.22);}
        .ha-selo:active{transform:scale(.985);}
        .ha-selo[disabled],.ha-selo.off{opacity:.55; filter:saturate(.5); pointer-events:none;}
        .ha-selo-forte{border-color:var(--pessego-e); background-image:linear-gradient(180deg,#FFF,#F4E5D7);}
        .ha-selo-forte:hover{border-color:var(--pessego-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(22,25,26,.16),
                     0 20px 34px -18px rgba(169,108,62,.5), 0 0 0 4px rgba(212,160,120,.26);}
        .ha-selo-forte::after{background:linear-gradient(115deg,transparent 30%,rgba(212,160,120,.6) 48%,transparent 66%);}
        /* variante para viver SOBRE o filme, onde o fundo é escuro */
        .ha-selo-claro{color:#fff; background:rgba(22,25,26,.3); background-image:none;
          border-color:rgba(255,255,255,.62); backdrop-filter:blur(6px);
          box-shadow:0 1px 2px rgba(0,0,0,.3), 0 18px 34px -20px rgba(0,0,0,.7);}
        .ha-selo-claro:hover{border-color:#fff;}
        /* esconder de verdade: minha folha vence o utilitario do Tailwind, entao o sumico e meu */
        @media (max-width:639px){ .ha-so-larga{display:none !important;} }

        /* ── CARTÃO: material, nunca retângulo chapado ─────────────────────────────────────── */
        .ha-card{position:relative; border-radius:20px; background:var(--branco); border:1px solid var(--linha);
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(22,25,26,.06),
                     0 1px 2px rgba(22,25,26,.06), 0 26px 48px -34px rgba(22,25,26,.42); overflow:hidden;}
        /* VERNIZ diagonal — a cor NUNCA entra na superfície do vidro (tingir vira plástico néon) */
        .ha-card::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,.14) 100%);}
        .ha-card > *{position:relative; z-index:2;}

        /* ── HERO EM VÍDEO ────────────────────────────────────────────────────────────────── */
        .ha-filme{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
        /* véu editorial: Vogue põe o texto SOBRE a foto, então o peso vem de baixo */
        .ha-veu-h{position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(180deg,rgba(10,12,12,.44) 0%,rgba(10,12,12,.14) 30%,rgba(10,12,12,.58) 70%,rgba(10,12,12,.88) 100%);}
        /* vinheta de lente — foto real tem queda de luz nas quinas */
        .ha-vinheta{position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(120% 92% at 50% 42%,transparent 58%,rgba(10,12,12,.42) 100%);}

        /* ── MOVIMENTO ───────────────────────────────────────────────────────────────────── */
        .ha-anima .ha-rev{opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s ease;}
        .ha-anima .ha-rev.is-in{opacity:1; transform:none;}
        .ha-ramo{width:100%; max-width:320px; height:40px;}
        .ha-anima .ha-ramo path{stroke-dasharray:400; stroke-dashoffset:400; transition:stroke-dashoffset 1.6s ease;}
        .ha-ramo.is-in path{stroke-dashoffset:0;}
        @media (prefers-reduced-motion: reduce){
          .ha-rev{opacity:1 !important; transform:none !important;}
          .ha-ramo path{stroke-dashoffset:0 !important;}
          .ha-cortina{display:none !important;}
        }

        .ha-pulso{position:relative; display:inline-flex; width:7px; height:7px; border-radius:999px;}
        .ha-pulso::after{content:""; position:absolute; inset:0; border-radius:inherit;
          background:inherit; animation:ha-ping 2.4s cubic-bezier(0,0,.2,1) infinite;}
        @keyframes ha-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.6);opacity:0}}
        @media (prefers-reduced-motion: reduce){ .ha-pulso::after{animation:none;} }

        .ha-pilula{min-height:44px; padding:0 16px; border-radius:999px; border:1px solid var(--linha);
          background:var(--branco); color:var(--tinta2); font-size:13.5px; font-weight:500;
          transition:border-color .2s,color .2s,background .2s;}
        .ha-pilula:hover{border-color:var(--salvia-e); color:var(--tinta);}
        .ha-pilula[data-on="1"]{border-color:var(--salvia-f); background:rgba(168,200,192,.2); color:var(--tinta);}

        .ha-campo{width:100%; min-height:52px; padding:0 16px; border-radius:12px;
          border:1px solid var(--linha); background:var(--branco); color:var(--tinta); font-size:15px;}
        .ha-campo::placeholder{color:var(--tinta3);}
        .ha-campo:focus{outline:none; border-color:var(--salvia-f); box-shadow:0 0 0 3px rgba(168,200,192,.3);}

        /* a fita de fotos — formato de revista, rolando na horizontal */
        .ha-fita{display:flex; gap:14px; overflow-x:auto; scroll-snap-type:x mandatory;
          padding-bottom:12px; -webkit-overflow-scrolling:touch;}
        .ha-fita > figure{flex:0 0 auto; width:min(76vw,400px); scroll-snap-align:start; margin:0;}
        .ha-fita img{width:100%; aspect-ratio:4/5; object-fit:cover; border-radius:16px; display:block;
          box-shadow:0 22px 44px -30px rgba(22,25,26,.6);}
      `}</style>

      {/* ── A ABERTURA ────────────────────────────────────────────────────────────────────── */}
      {cortina !== "nunca" && (
        <div className={"ha-cortina" + (cortina === "subindo" ? " sobe" : "")} aria-hidden="true">
          <img src={B + "/logo.png"} alt="" />
        </div>
      )}

      {/* ── CABEÇALHO: marca + ação na MESMA linha, nunca quebra ──────────────────────────── */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "var(--linha)", background: "rgba(247,245,241,.88)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-3 px-4 py-3">
          {/* PLACA do logo — arquivo com fundo claro colado na página lê como adesivo */}
          <a href="#topo" className="flex min-w-0 flex-nowrap items-center gap-2.5">
            {/* A PLACA (padrão §7). O logotipo é DEITADO (1,72:1) — placa quadrada o espremia a
                20px de altura e ninguém lia. Placa proporcional, aro de luz no topo, sombra de
                contato curta, mesmo raio dos cartões. E o arquivo agora é TRANSPARENTE: com fundo
                branco opaco ele lia como adesivo colado, que é o que a regra proíbe. */}
            <span className="grid h-12 shrink-0 place-items-center overflow-hidden rounded-xl px-3"
              style={{ background: "var(--branco)", border: "1px solid var(--linha)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(22,25,26,.05), 0 1px 2px rgba(22,25,26,.14)" }}>
              <img src={B + "/logo.png"} alt="Hair Art Designs" width="112" height="65" className="h-[32px] w-auto" />
            </span>
            <span className="ha-vogue min-w-0 truncate font-medium" style={{ fontSize: "clamp(15px,3.6vw,22px)" }}>
              Hair Art Designs
            </span>
          </a>
          <span className="flex-1" />
          <a href={B + "/book"} className="ha-selo ha-so-larga shrink-0" style={{ padding: "0 18px" }}>Book</a>
          <a href={"tel:" + TEL} className="ha-selo ha-selo-forte shrink-0" style={{ padding: "0 18px" }}>
            <span aria-hidden>☎</span>
            <span className="hidden sm:inline">{TEL_FMT}</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </header>

      {/* ── HERO EM VÍDEO ────────────────────────────────────────────────────────────────── */}
      <section id="topo" className="relative overflow-hidden" style={{ minHeight: "min(92vh,820px)", background: "#12100E" }}>
        {/* O filme é DELES, montado das fotos reais do salão. O `poster` cobre o primeiro quadro
            E fica no lugar se o vídeo não carregar — fail-open também aqui. */}
        <video className="ha-filme" autoPlay muted loop playsInline preload="metadata"
          poster={B + "/hero-poster.jpg"} aria-label="Inside Hair Art Designs on East 19th Street">
          <source src={B + "/hero.mp4"} type="video/mp4" />
        </video>
        <div className="ha-veu-h" />
        <div className="ha-vinheta" />

        <div className="relative mx-auto flex max-w-6xl flex-col justify-end px-4 pb-12" style={{ minHeight: "min(92vh,820px)" }}>
          <div className="max-w-[46rem]">
            <div className="ha-kicker" style={{ color: "rgba(255,255,255,.8)" }}>302 East 19th Street · Gramercy · New York</div>
            {/* MASTHEAD: didone grande, tracking negativo, SEMPRE duas linhas */}
            <h1 className="ha-vogue mt-3 font-medium" style={{ color: "#fff", fontSize: "clamp(40px,8.2vw,94px)", lineHeight: .97, letterSpacing: "-.022em", textWrap: "balance", textShadow: "0 2px 30px rgba(0,0,0,.4)" }}>
              The colour is designed<br />
              <em style={{ color: "var(--salvia)" }}>for your hair.</em>
            </h1>
            <hr className="ha-filete my-6" style={{ background: "rgba(255,255,255,.3)", maxWidth: "22rem" }} />
            <p className="max-w-[32rem] text-[16px] leading-relaxed" style={{ color: "rgba(255,255,255,.9)" }}>
              Balayage is the heart of this salon — and Iryna tells you which technique she is using, and why, before she starts.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <a href={"tel:" + TEL} className="ha-selo ha-selo-forte"><span aria-hidden>☎</span> Call {TEL_FMT}</a>
              <a href="#pedido" className="ha-selo ha-selo-claro"><span aria-hidden>✦</span> Design my appointment</a>
            </div>

            {/* faixa de credenciais fundida na borda inferior do filme */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: "#fff" }}>
                <span className="ha-pulso" style={{ background: rel.aberto ? "var(--salvia)" : "var(--pessego)" }} />
                <span className="ha-mono">{rel.aberto ? "Open now" : "Closed"} · {rel.hora} NYC</span>
              </span>
              <span className="ha-kicker" style={{ color: "rgba(255,255,255,.72)" }}>5.0 ★ · 190 reviews</span>
              <span className="ha-kicker" style={{ color: "rgba(255,255,255,.72)" }}>Green Circle certified</span>
              <span className="ha-kicker" style={{ color: "rgba(255,255,255,.72)" }}>Open 7 days · 11–8</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROVA MEDIDA — números reais, nenhum inventado ────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="ha-rev grid grid-cols-2 gap-y-8 sm:grid-cols-4">
          {[["5.0", "Google rating"], ["190", "reviews"], ["16+", "years behind the chair"], ["7", "days a week"]].map(([n, r]) => (
            <div key={r}>
              <div className="ha-vogue font-medium" style={{ fontSize: "clamp(36px,5.2vw,54px)", lineHeight: 1 }}>{n}</div>
              <div className="ha-kicker mt-1.5">{r}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 01 · A CASA ──────────────────────────────────────────────────────────────────── */}
      <section className="py-10">
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="01">The house</Titulo>
        </div>
        <div className="mx-auto mt-6 max-w-6xl px-4">
          <div className="ha-fita ha-rev">
            {CASA.map(([arq, legenda]) => (
              <figure key={arq}>
                <img src={B + "/" + arq} alt={legenda} loading="lazy" />
                <figcaption className="mt-2.5 text-[12.5px] leading-snug" style={{ color: "var(--tinta3)" }}>{legenda}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · O CARDÁPIO ──────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12" id="menu">
        <Titulo n="02" sub="These are the prices in their booking system — not a brochure. Most are a starting point, because length and history change the work; the exact figure is agreed before anything is mixed.">
          Every price, in the open
        </Titulo>

        <div className="ha-rev mt-5 flex flex-wrap gap-2">
          {MENU.map((g) => (
            <button key={g.cat} type="button" onClick={() => setCatAtiva(g.cat)} className="ha-pilula" data-on={catAtiva === g.cat ? "1" : "0"}>
              {g.cat} <span className="ha-mono ml-1 text-[11px] opacity-60">{g.itens.length}</span>
            </button>
          ))}
        </div>

        <div className="ha-card ha-rev mt-4 px-5 py-1">
          {grupo.itens.map(([nome, preco, ab]) => (
            <button key={nome} type="button"
              onClick={() => { escolher("servico", nome); setOutro((o) => ({ ...o, servico: false })); setPasso(0); pedido.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              className="flex min-h-[56px] w-full items-baseline justify-between gap-4 border-b py-3 text-left last:border-0"
              style={{ borderColor: "var(--linha)" }}>
              <span className="text-[15.5px] leading-snug">{nome}</span>
              <span className="ha-mono shrink-0 text-[13.5px]" style={{ color: "var(--salvia-f)" }}>{ab ? "from " : ""}${preco}</span>
            </button>
          ))}
        </div>
        <p className="ha-rev mt-3 text-[13px]" style={{ color: "var(--tinta3)" }}>
          Tap any service and it lands in the request below, priced. Or{" "}
          <a href={B + "/book"} className="underline" style={{ color: "var(--tinta2)" }}>open the full booking page →</a>
        </p>
      </section>

      {/* ── 03 · O QUE A SAGE FAZ — a seção que vende ─────────────────────────────────────── */}
      <section className="py-12" id="sage" style={{ background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="03" sub="Sage is the salon's receptionist — the one on this page and on the phone. She knows the whole Phorest menu, the house rules and the hours. She is not a chatbot with a script.">
            The salon answers at 3am
          </Titulo>
          <div className="mt-7 grid items-start gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCOES.map(([t, d], i) => (
              <div key={t} className="ha-rev">
                <span className="ha-num">{String(i + 1).padStart(2, "0")}</span>
                <div className="ha-vogue mt-1 text-[22px] font-medium leading-tight">{t}</div>
                <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 04 · OS ARTISTAS ─────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12" id="artists">
        <Titulo n="04">Five artists, not a rota</Titulo>
        <div className="mt-7 grid items-start gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {ARTISTAS.map((a) => (
            <div key={a.nome} className="ha-rev">
              {a.foto ? (
                <img src={B + "/staff/" + a.foto + ".jpg"} alt={a.nome + ", " + a.papel + " at Hair Art Designs"} loading="lazy"
                  className="w-full object-cover"
                  style={{ aspectRatio: "4/5", borderRadius: "16px", boxShadow: "0 22px 44px -32px rgba(22,25,26,.65)" }} />
              ) : (
                /* Sem foto no sistema deles → inicial. Inventar rosto é dizer quem atende sem saber. */
                <div className="ha-vogue grid w-full place-items-center"
                  style={{ aspectRatio: "4/5", borderRadius: "16px", background: "rgba(168,200,192,.22)", color: "var(--salvia-f)", fontSize: "70px" }}>
                  {a.nome[0]}
                </div>
              )}
              <div className="ha-vogue mt-3.5 text-[25px] font-medium leading-tight">{a.nome}</div>
              <div className="ha-kicker mt-1">{a.papel}</div>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a.bio}</p>
              <button type="button" onClick={() => { escolher("artista", a.nome); pedido.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="ha-pilula mt-3" data-on={form.artista === a.nome ? "1" : "0"}>
                Ask for {a.nome}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── 05 · O PEDIDO: quiz de 2 perguntas por vez, com escape em todo passo ──────────── */}
      <section className="mx-auto max-w-3xl px-4 py-12" id="pedido" ref={pedido}>
        <div className="ha-card ha-rev p-6 sm:p-8">
          {enviado ? (
            <div className="py-6 text-center">
              <div className="ha-vogue text-[36px] font-medium" style={{ color: "var(--salvia-f)" }}>Got it.</div>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Your request is with the salon. Someone comes back on the channel you picked — and if you would rather not wait, {TEL_FMT} rings the front desk.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <span className="ha-num">05</span>
              <h2 className="ha-vogue mt-1 font-medium" style={{ fontSize: "clamp(26px,4.4vw,40px)", lineHeight: 1.04 }}>
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
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                    Leave a number and the salon's AI calls you straight back — that is the fastest way to a time.
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {passo > 0 && <button type="button" onClick={() => setPasso((p) => p - 1)} className="ha-pilula">← Back</button>}
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

      {/* ── 06 · A PONTE PRO BOOKING ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-12" id="booking">
        <div className="ha-card ha-rev flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
          <div className="min-w-0">
            <span className="ha-num">06</span>
            <div className="ha-vogue mt-1 font-medium" style={{ fontSize: "clamp(24px,4vw,34px)", lineHeight: 1.06 }}>
              Rather see the whole menu?
            </div>
            <p className="mt-1.5 max-w-[30rem] text-[14.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
              All 32 services, priced, with the house rule shown on the line you are choosing.
            </p>
          </div>
          <a href={B + "/book"} className="ha-selo ha-selo-forte"><span aria-hidden>▤</span> Open the booking page</a>
        </div>
      </section>

      {/* ── 07 · POLÍTICAS: aparecem antes, não escondidas no rodapé ─────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <Titulo n="07">Said before you sit down</Titulo>
        <div className="mt-6 grid items-start gap-4 sm:grid-cols-3">
          {[
            ["Not happy?", "Come back within 7 days and your original artist adjusts the service free of charge. Services already rendered are not refunded in cash."],
            ["Cancelling", "More than 24 hours ahead costs nothing. Inside 24 hours is 50% of the booked service. A deposit may be asked for on the next booking, and it counts toward it."],
            ["Products", "Unopened, back within 7 days for exchange or store credit. Opened carries a 25% restocking fee. Gift cards are not refundable."],
          ].map(([t, d]) => (
            <div key={t} className="ha-card ha-rev p-5">
              <div className="ha-vogue text-[22px] font-medium">{t}</div>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 08 · FAQ ─────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <Titulo n="08">Questions</Titulo>
        <div className="mt-5 space-y-2.5">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="ha-card ha-rev">
              <button type="button" onClick={() => setAberto(aberto === i ? null : i)} aria-expanded={aberto === i}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 px-5 text-left">
                <span className="text-[15px] font-medium">{q}</span>
                <span aria-hidden style={{ color: "var(--salvia-f)" }}>{aberto === i ? "−" : "+"}</span>
              </button>
              {aberto === i && <p className="px-5 pb-4 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTATO: tudo à vista e VIVO ─────────────────────────────────────────────────── */}
      <footer id="contact" className="border-t" style={{ borderColor: "var(--linha)", background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <img src={B + "/logo.png"} alt="Hair Art Designs" width="160" height="93" className="w-[160px]" />
              <p className="mt-4 max-w-[26rem] text-[14.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                A Green Circle certified salon on East 19th Street: up to 95% of what a salon throws away can be recovered — hair, foil, colour, paper. They pay for that themselves. They also help Ukrainian and other refugees at their own expense.
              </p>
              <div className="mt-5"><Ramo cor="var(--pessego)" /></div>
            </div>
            <div className="space-y-2.5">
              <a href={"tel:" + TEL} className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--pessego-e)" }}>☎</span> Call {TEL_FMT}
              </a>
              {/* o de TEXTO é o OUTRO número, de propósito */}
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
              <div className="ha-kicker pt-1">Open 7 days · 11am – 8pm</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
