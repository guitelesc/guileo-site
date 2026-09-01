/* ══════════════════════════════════════════════════════════════════════════════════════════════
   23RD STREET HAIR SALON — 248 East 23rd Street, Kips Bay / Gramercy NYC · vitrine do COMBO MOTOR
   Também conhecido como "Gramercy Park Hair Salon", operado por A.M Hair Design Inc.
   Referência de MÉTODO e SISTEMA: HairArtDesigns.jsx (o padrão Vogue aprovado). Esta página herda
   o MESMO sistema — didone Bodoni, filete, numeração 01…, selo, material 4K, grão, abertura,
   hero-vídeo, reveal fail-open — e troca a marca inteira: dados do salão + paleta ROXA medida no pixel.

   ÂNGULO HERÓI = EXTENSÕES DE CABELO. É o carro-chefe: todo review do Google é sobre isso, e
   Duneisy ("Dee") é a artista citada em quase todos. Preços de extensão $875–$1.550.

   MEDIDO, NÃO ESCOLHIDO: roxo #6C00A8 tirado do pixel do logo. HORÁRIO por semana NÃO é conhecido
   (só sinais soltos) — a página não afirma "aberto 7 dias" nem inventa relógio de abrir/fechar:
   o selo vivo mostra só a hora de NY + same-day + o número de texto.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+16468629323";
const TEL_FMT = "(646) 862-9323";
/* 🚨 DOIS NÚMEROS. O de voz é o salão; o de TEXTO/WhatsApp é OUTRO. Mandar SMS para o número de
   voz é mensagem que não chega em ninguém. */
const TEXTO = "+19173090101";
const TEXTO_FMT = "(917) 309-0101";
const ENDERECO = "248 East 23rd Street, New York, NY 10010";
const SITE_DELES = "https://23rdstreethairsalon.com/";
const B = "/novo/23rd-street";
const SITE_URL = "https://guileoai.com/novo/23rd-street";

/* Os 7 especialistas vêm do site deles. Foto NÃO: eles não publicam headshot por pessoa (as fotos
   do salão são transformações de cliente), e parear um rosto a um nome sem fonte é dizer quem faz sem
   saber. Duneisy ("Dee") é a estrela das extensões — quase todo depoimento do Google é sobre ela. */
const ARTISTAS = [
  { nome: "Duneisy", papel: "Hairstylist · Extension Specialist", foto: null,
    bio: "\"Dee\" — the name in almost every review. An extension artist who takes her time until every strand sits right, and teaches you how to care for them between visits." },
  { nome: "Tina", papel: "Hair Colorist · Makeup Artist", foto: null, bio: "Colour and gloss, highlights, and makeup." },
  { nome: "Dilya", papel: "Hairstylist · Makeup Artist", foto: null, bio: "Cuts, pixie and butterfly, and makeup." },
  { nome: "Lydia", papel: "Hairstylist", foto: null, bio: "Blowouts and highlights." },
  { nome: "Yana", papel: "Hairstylist · Extensions Specialist", foto: null, bio: "Extensions and styling." },
  { nome: "Nancy", papel: "Hairstylist · Extensions Specialist", foto: null, bio: "Extensions and styling." },
  { nome: "Julia", papel: "Junior Hairstylist · Makeup Artist", foto: null, bio: "Styling and evening makeup." },
];

/* 30 serviços — extensões PRIMEIRO, porque são o carro-chefe. "from" é literal. DURAÇÃO não entra:
   eles não publicam, e minuto inventado é o defeito do preço-âncora aplicado à agenda. */
const MENU = [
  { cat: "Hair extensions", itens: [
    ["K-Tips", 1250, true], ["Tape-Ins", 1250, true], ["Weft", 1150, true],
    ["Beaded I-Tip / Microlinks", 1150, true], ["Brazilian Knots", 1450, true],
    ["Nano / Ice", 1550, true], ["Clip-Ins", 875, true], ["Extension Removal", 100, true],
  ]},
  { cat: "Color", itens: [
    ["Balayage / Full Head Highlights (with toner)", 335, true], ["Highlights", 220, true],
    ["Partial Highlights", 150, true], ["Single Colour", 140, true], ["Money Piece", 145, false],
    ["Clear Gloss / Toner", 95, false], ["Colour Correction", 540, true],
  ]},
  { cat: "Haircuts", itens: [
    ["Women's Haircut", 95, true], ["Men's Haircut", 65, false],
    ["Girls Haircut (under 10)", 55, false], ["Just A Wash", 20, false], ["Bang Trim", 20, false],
  ]},
  { cat: "Treatments", itens: [
    ["Keratin Treatment", 250, true], ["Japanese Straightening", 300, true],
    ["Moroccan Oil Treatment", 45, true], ["Olaplex Add-On", 35, false],
  ]},
  { cat: "Style & makeup", itens: [
    ["Blowout", 65, true], ["Hollywood Waves Blowout", 55, false], ["Up-Do", 85, true],
    ["Evening Makeup", 130, false], ["Bridal Trial Makeup", 130, true], ["Bridal Makeup (day of)", 180, true],
  ]},
];

const TETO = {
  "K-Tips": 1550, "Tape-Ins": 1550, "Weft": 1450, "Beaded I-Tip / Microlinks": 1450,
  "Brazilian Knots": 1650, "Nano / Ice": 1850, "Clip-Ins": 1100, "Extension Removal": 250,
  "Balayage / Full Head Highlights (with toner)": 385, "Highlights": 265,
  "Partial Highlights": 200, "Single Colour": 180, "Colour Correction": 750,
  "Women's Haircut": 130, "Keratin Treatment": 350, "Japanese Straightening": 450,
  "Moroccan Oil Treatment": 65, "Blowout": 85, "Up-Do": 150, "Bridal Trial Makeup": 185,
  "Bridal Makeup (day of)": 270,
};

/* A FITA DA CASA — as fotos reais de transformação que eles publicam, com legenda HONESTA do que a
   foto mostra. Foto real de cliente é a prova social que render nenhum substitui. Sem nome de cliente. */
const CASA = [
  ["gallery-1.jpg", "Long extensions, blended so the join disappears"],
  ["gallery-2.jpg", "Balayage grown out, then refreshed"],
  ["gallery-3.jpg", "A blowout finished in the salon"],
  ["gallery-4.jpg", "K-tip extensions, styled out"],
  ["gallery-5.jpg", "Colour and gloss, done at the chair"],
  ["gallery-6.jpg", "A fresh cut, blended and dried"],
];

/* O QUE A REMI FAZ — a seção que faltava, e é a que vende. Cada linha é função que ela JÁ
   executa, focada em extensões, nunca promessa de roadmap. */
const FUNCOES = [
  ["Answers at 3am", "The phone rings at 2:40 on a Sunday. Remi picks up in the salon's name and knows the whole extensions menu — K-tips, tape-ins, wefts, I-tips, the lot."],
  ["Quotes the real prices", "The same $875–$1,550 range the salon charges for extensions — a range, never one invented figure."],
  ["Books the extension consult", "Method, length, colour, when. It reaches the front desk with everything already asked, so the consultation starts warm."],
  ["Calls the lead back", "Leave a number on this page and the phone rings back. That is not a mock-up — the form below does it."],
  ["Four languages", "English, Spanish, Portuguese, Hindi. In Kips Bay that is not a luxury."],
  ["Never invents", "No price, no method, no artist, no time slot. When she does not know: \"I'd rather have the front desk confirm that than guess.\""],
];

const CANAIS = [
  { id: "phone", rot: "Call me", ico: "☎" },
  { id: "text", rot: "Text / WhatsApp", ico: "✉" },
];

/* Depoimentos REAIS do Google, verbatim, atribuídos só à inicial. Não editar o texto. */
const DEPOIMENTOS = [
  ["Caroline C.", "I had 22\" extensions beautifully installed, blended, and styled by Duneisy. She was so accommodating and skilled at achieving the look I needed for my wedding."],
  ["Sophia A.", "Duneisy is an absolute artist with hair extensions. When she does mine, they last me 10 weeks. The salon itself is super warm and relaxing — rare in NYC."],
  ["Juliette F.", "I was looking specifically for a salon specializing in hair extensions. I did individual I-tips. I've been wearing them for 2 months and no extensions fell. Non-stop compliments."],
  ["Dorothy A.", "I get my hair dyed here once a month, they do a fantastic job and the color is always perfect. A hidden gem on 23rd!"],
];

const FAQ = [
  ["Do you do same-day appointments?", "Often, yes. Call " + TEL_FMT + " or text " + TEXTO_FMT + " and ask — the chair is either free or it isn't, and the front desk will tell you straight."],
  ["How much are extensions?", "Between $875 for custom clip-ins and around $1,550 for nano / ice bonds, depending on method, length and how much hair. The exact figure is agreed at the consultation, before anything is ordered."],
  ["Which number do I text?", "Text and WhatsApp go to " + TEXTO_FMT + ". " + TEL_FMT + " is the salon's voice line. Texting the voice number reaches no one."],
  ["Why is every price a range?", "Because hair is. Length, density and colour history change the work. The number you see is where it starts; the exact figure is agreed at the consultation, before anything is mixed."],
];

const TITULO = "23rd Street Hair Salon — Hair Extensions, Gramercy / Kips Bay NYC";
const DESC = "Hair extension specialists at 248 East 23rd Street, Kips Bay / Gramercy. K-tips, tape-ins, wefts, I-tips and colour — every price published. Duneisy and the team install and blend extensions that last. Call (646) 862-9323 or text (917) 309-0101.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["property", "og:image", "https://guileoai.com" + B + "/hero-poster.jpg"],
  ["name", "twitter:card", "summary_large_image"],
];

/* O site deles não tem NENHUM dado estruturado. Sem isto o Google e os assistentes não sabem que
   ali é um salão de extensões em Gramercy. SEM aggregateRating: o scout não confirmou a contagem de
   reviews, e número inventado é o defeito do preço-âncora aplicado à reputação. SEM horário: também
   não é sabido por semana — inventar openingHours seria afirmar o que ninguém disse. */
const LD = () => ([
  {
    "@context": "https://schema.org", "@type": "HairSalon",
    name: "23rd Street Hair Salon", alternateName: "Gramercy Park Hair Salon",
    legalName: "A.M Hair Design Inc.", url: SITE_URL, telephone: TEL,
    image: "https://guileoai.com" + B + "/hero-poster.jpg",
    address: { "@type": "PostalAddress", streetAddress: "248 East 23rd Street",
      addressLocality: "New York", addressRegion: "NY", postalCode: "10010", addressCountry: "US" },
    geo: { "@type": "GeoCoordinates", latitude: 40.7389, longitude: -73.98 },
    areaServed: ["Kips Bay", "Gramercy", "Manhattan"],
    priceRange: "$$$",
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
  if (teto) return { faixa: "$" + base + "–$" + teto, nota: "Where it lands depends on method, length and history — agreed before anything starts." };
  return { faixa: "from $" + base, nota: "The exact figure is agreed at the consultation." };
};

/* A MECHA — a assinatura da página, uma trança/mecha desenhando-se na cor deles. */
const Ramo = ({ cor = "var(--roxo)" }) => (
  <svg className="ha-ramo" viewBox="0 0 320 40" fill="none" aria-hidden="true">
    <path d="M4 20 C 70 6, 92 34, 150 20 C 208 6, 236 34, 316 20" stroke={cor} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M4 26 C 70 12, 92 40, 150 26 C 208 12, 236 40, 316 26" stroke={cor} strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
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

export default function TwentyThirdStreet() {
  const [form, setForm] = useState({ nome: "", tel: "", servico: "", artista: "", quando: "" });
  const [canal, setCanal] = useState("phone");
  const [passo, setPasso] = useState(0);
  const [outro, setOutro] = useState({ servico: false, quando: false });
  const [livre, setLivre] = useState({ servico: "", quando: "", recado: "" });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [hora, setHora] = useState("");
  const [aberto, setAberto] = useState(null);
  const [catAtiva, setCatAtiva] = useState("Hair extensions");
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

  /* UM selo vivo só. HORÁRIO por semana NÃO é sabido — então ele NÃO diz aberto/fechado. Mostra a
     hora de NY e o convite honesto: same-day + o número de texto. */
  useEffect(() => {
    const tick = () => setHora(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date()));
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
          slug: "23rd-street", negocio: "23rd Street Hair Salon",
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
          --papel:#F7F4F9; --papel2:#EEE8F2; --branco:#FFFFFF;
          --tinta:#1A1420; --tinta2:#5C5266; --tinta3:#948A9E;
          --roxo:#6C00A8; --roxo-e:#8B2FC9; --roxo-f:#4A0072;
          --linha:#E0D6E6;
          background:var(--papel); color:var(--tinta); min-height:100vh;
          font-family:'Jost',system-ui,-apple-system,sans-serif;
          position:relative; overflow-x:hidden;
        }
        /* GRAO na raiz — o realismo 4K comeca aqui. z-index nos filhos, senao pinta por cima. */
        .ha-raiz::before{
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.30;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E");
        }
        .ha-raiz > *{position:relative; z-index:1;}

        /* VOGUE: a didone e a voz da pagina */
        .ha-vogue{font-family:'Bodoni Moda',Didot,'Playfair Display',Georgia,serif;}
        .ha-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
        .ha-kicker{font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.26em;
          text-transform:uppercase; color:var(--roxo-f);}
        .ha-num{font-family:'Bodoni Moda',Didot,serif; font-size:12.5px; letter-spacing:.12em; color:var(--roxo);}
        .ha-filete{height:1px; background:var(--linha); border:0;}

        /* A ABERTURA */
        .ha-cortina{position:fixed; inset:0; z-index:60; background:var(--papel);
          display:grid; place-items:center;
          transition:transform 1.05s cubic-bezier(.72,0,.18,1), opacity 1.05s ease;}
        .ha-cortina.sobe{transform:translateY(-100%); opacity:0;}
        .ha-cortina img{width:min(46vw,190px); animation:ha-respira 1.4s ease both;}
        @keyframes ha-respira{0%{opacity:0; transform:scale(.93)}100%{opacity:1; transform:none}}

        /* O SELO (massa lapidada, borda na cor deles, canto 10px, nunca capsula) */
        .ha-selo{
          position:relative; display:inline-flex; align-items:center; gap:9px; overflow:hidden;
          min-height:52px; padding:0 24px; border-radius:10px;
          font-weight:600; font-size:15px; letter-spacing:.01em; text-decoration:none;
          color:var(--tinta); background:var(--branco);
          background-image:linear-gradient(180deg,rgba(255,255,255,.94),rgba(238,232,242,.94));
          border:1.5px solid var(--roxo-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(74,0,114,.12),
                     0 1px 2px rgba(26,20,32,.14), 0 14px 26px -18px rgba(26,20,32,.5);
          transition:border-color .25s, box-shadow .25s, transform .12s;
        }
        .ha-selo::after{content:""; position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(115deg,transparent 30%,rgba(139,47,201,.5) 48%,transparent 66%);
          transform:translateX(-120%); transition:transform .75s ease;}
        .ha-selo:hover::after{transform:translateX(120%);}
        .ha-selo:hover{border-color:var(--roxo-f);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(26,20,32,.16),
                     0 20px 34px -18px rgba(74,0,114,.55), 0 0 0 4px rgba(108,0,168,.22);}
        .ha-selo:active{transform:scale(.985);}
        .ha-selo[disabled],.ha-selo.off{opacity:.55; filter:saturate(.5); pointer-events:none;}
        .ha-selo-forte{border-color:var(--roxo-f); background-image:linear-gradient(180deg,#FFF,#F0E4F7);}
        .ha-selo-forte:hover{border-color:var(--roxo-f);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(26,20,32,.16),
                     0 20px 34px -18px rgba(74,0,114,.55), 0 0 0 4px rgba(108,0,168,.26);}
        .ha-selo-forte::after{background:linear-gradient(115deg,transparent 30%,rgba(108,0,168,.55) 48%,transparent 66%);}
        /* variante para viver SOBRE o filme, onde o fundo e escuro */
        .ha-selo-claro{color:#fff; background:rgba(26,20,32,.32); background-image:none;
          border-color:rgba(255,255,255,.62); backdrop-filter:blur(6px);
          box-shadow:0 1px 2px rgba(0,0,0,.3), 0 18px 34px -20px rgba(0,0,0,.7);}
        .ha-selo-claro:hover{border-color:#fff;}
        /* esconder de verdade: minha folha vence o utilitario do Tailwind, entao o sumico e meu */
        @media (max-width:639px){ .ha-so-larga{display:none !important;} }

        /* CARTAO: material, nunca retangulo chapado */
        .ha-card{position:relative; border-radius:20px; background:var(--branco); border:1px solid var(--linha);
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(26,20,32,.06),
                     0 1px 2px rgba(26,20,32,.06), 0 26px 48px -34px rgba(26,20,32,.42); overflow:hidden;}
        /* VERNIZ diagonal — a cor NUNCA entra na superficie do vidro (tingir vira plastico neon) */
        .ha-card::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,.14) 100%);}
        .ha-card > *{position:relative; z-index:2;}

        /* HERO EM VIDEO */
        .ha-filme{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
        /* veu editorial: Vogue poe o texto SOBRE a foto, entao o peso vem de baixo */
        .ha-veu-h{position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(180deg,rgba(14,8,20,.44) 0%,rgba(14,8,20,.14) 30%,rgba(14,8,20,.58) 70%,rgba(14,8,20,.9) 100%);}
        /* vinheta de lente — foto real tem queda de luz nas quinas */
        .ha-vinheta{position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(120% 92% at 50% 42%,transparent 58%,rgba(14,8,20,.42) 100%);}

        /* MOVIMENTO */
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
        .ha-pilula:hover{border-color:var(--roxo-e); color:var(--tinta);}
        .ha-pilula[data-on="1"]{border-color:var(--roxo-f); background:rgba(108,0,168,.14); color:var(--tinta);}

        .ha-campo{width:100%; min-height:52px; padding:0 16px; border-radius:12px;
          border:1px solid var(--linha); background:var(--branco); color:var(--tinta); font-size:15px;}
        .ha-campo::placeholder{color:var(--tinta3);}
        .ha-campo:focus{outline:none; border-color:var(--roxo-f); box-shadow:0 0 0 3px rgba(108,0,168,.28);}

        /* a fita de fotos — formato de revista, rolando na horizontal */
        .ha-fita{display:flex; gap:14px; overflow-x:auto; scroll-snap-type:x mandatory;
          padding-bottom:12px; -webkit-overflow-scrolling:touch;}
        .ha-fita > figure{flex:0 0 auto; width:min(76vw,400px); scroll-snap-align:start; margin:0;}
        .ha-fita img{width:100%; aspect-ratio:4/5; object-fit:cover; border-radius:16px; display:block;
          box-shadow:0 22px 44px -30px rgba(26,20,32,.6);}
      `}</style>

      {/* A ABERTURA */}
      {cortina !== "nunca" && (
        <div className={"ha-cortina" + (cortina === "subindo" ? " sobe" : "")} aria-hidden="true">
          <img src={B + "/logo.png"} alt="" />
        </div>
      )}

      {/* CABEÇALHO: marca + ação na MESMA linha, nunca quebra */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "var(--linha)", background: "rgba(247,244,249,.88)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-3 px-4 py-3">
          <a href="#topo" className="flex min-w-0 flex-nowrap items-center gap-2.5">
            {/* A PLACA (§7). Logo 192×192 (quadrado). Placa proporcional, aro de luz no topo, sombra
                de contato curta, mesmo raio dos cartões. Arquivo TRANSPARENTE. */}
            <span className="grid h-12 shrink-0 place-items-center overflow-hidden rounded-xl px-2.5"
              style={{ background: "var(--branco)", border: "1px solid var(--linha)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(26,20,32,.05), 0 1px 2px rgba(26,20,32,.14)" }}>
              <img src={B + "/logo.png"} alt="23rd Street Hair Salon" width="192" height="192" className="h-[36px] w-auto" />
            </span>
            <span className="ha-vogue min-w-0 truncate font-medium" style={{ fontSize: "clamp(15px,3.6vw,22px)" }}>
              23rd Street Hair Salon
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

      {/* HERO EM VÍDEO */}
      <section id="topo" className="relative overflow-hidden" style={{ minHeight: "min(92vh,820px)", background: "#170A1E" }}>
        <video className="ha-filme" autoPlay muted loop playsInline preload="metadata"
          poster={B + "/hero-poster.jpg"} aria-label="Inside 23rd Street Hair Salon">
          <source src={B + "/hero.mp4"} type="video/mp4" />
        </video>
        <div className="ha-veu-h" />
        <div className="ha-vinheta" />

        <div className="relative mx-auto flex max-w-6xl flex-col justify-end px-4 pb-12" style={{ minHeight: "min(92vh,820px)" }}>
          <div className="max-w-[46rem]">
            <div className="ha-kicker" style={{ color: "rgba(255,255,255,.8)" }}>248 East 23rd Street · Kips Bay / Gramercy · New York</div>
            {/* MASTHEAD: didone grande, tracking negativo, SEMPRE duas linhas, itálico na cor deles */}
            <h1 className="ha-vogue mt-3 font-medium" style={{ color: "#fff", fontSize: "clamp(40px,8.2vw,94px)", lineHeight: .97, letterSpacing: "-.022em", textWrap: "balance", textShadow: "0 2px 30px rgba(0,0,0,.4)" }}>
              The hair extensions New York<br />
              <em style={{ color: "#C77DFF" }}>quietly books here.</em>
            </h1>
            <hr className="ha-filete my-6" style={{ background: "rgba(255,255,255,.3)", maxWidth: "22rem" }} />
            <p className="max-w-[33rem] text-[16px] leading-relaxed" style={{ color: "rgba(255,255,255,.9)" }}>
              Extensions are what this salon is known for — and Duneisy, &ldquo;Dee&rdquo; in almost every review, takes her time until every strand sits right.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <a href={"tel:" + TEL} className="ha-selo ha-selo-forte"><span aria-hidden>☎</span> Call {TEL_FMT}</a>
              <a href="#pedido" className="ha-selo ha-selo-claro"><span aria-hidden>✦</span> Book my extensions</a>
            </div>

            {/* selo vivo: hora de NY + convite honesto. SEM aberto/fechado (horário não é sabido). */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: "#fff" }}>
                <span className="ha-pulso" style={{ background: "#C77DFF" }} />
                <span className="ha-mono">{hora} NYC · same-day appointments</span>
              </span>
              <a href={"sms:" + TEXTO} className="ha-kicker" style={{ color: "rgba(255,255,255,.78)", textDecoration: "underline" }}>Text {TEXTO_FMT} anytime</a>
              <span className="ha-kicker" style={{ color: "rgba(255,255,255,.72)" }}>Extension specialists</span>
            </div>
          </div>
        </div>
      </section>

      {/* PROVA — números honestos das extensões, nenhum inventado (sem contagem de reviews) */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="ha-rev grid grid-cols-2 gap-y-8 sm:grid-cols-4">
          {[["7", "extension methods"], ["$875", "where extensions start"], ["4", "languages Remi speaks"], ["24/7", "Remi answers"]].map(([n, r]) => (
            <div key={r}>
              <div className="ha-vogue font-medium" style={{ fontSize: "clamp(34px,5vw,54px)", lineHeight: 1 }}>{n}</div>
              <div className="ha-kicker mt-1.5">{r}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 01 · A CASA */}
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

      {/* 02 · O CARDÁPIO */}
      <section className="mx-auto max-w-6xl px-4 py-12" id="menu">
        <Titulo n="02" sub="Extensions first, because that is what people come here for. These are the salon's prices — not a brochure. Most are a starting point, because method, length and history change the work; the exact figure is agreed before anything is ordered.">
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
              <span className="ha-mono shrink-0 text-[13.5px]" style={{ color: "var(--roxo-f)" }}>{ab ? "from " : ""}${preco}</span>
            </button>
          ))}
        </div>
        <p className="ha-rev mt-3 text-[13px]" style={{ color: "var(--tinta3)" }}>
          Tap any service and it lands in the request below, priced. Or{" "}
          <a href={B + "/book"} className="underline" style={{ color: "var(--tinta2)" }}>open the full booking page →</a>
        </p>
      </section>

      {/* 03 · O QUE A REMI FAZ — a seção que vende */}
      <section className="py-12" id="remi" style={{ background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="03" sub="Remi is the salon's receptionist — the one on this page and on the phone. She knows the extensions menu, the colour list and the two numbers. She is not a chatbot with a script.">
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

      {/* 04 · OS ARTISTAS */}
      <section className="mx-auto max-w-6xl px-4 py-12" id="artists">
        <Titulo n="04">Seven specialists, not a rota</Titulo>
        <div className="mt-7 grid items-start gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {ARTISTAS.map((a) => (
            <div key={a.nome} className="ha-rev">
              {a.foto ? (
                <img src={B + "/staff/" + a.foto + ".jpg"} alt={a.nome + ", " + a.papel + " at 23rd Street Hair Salon"} loading="lazy"
                  className="w-full object-cover"
                  style={{ aspectRatio: "4/5", borderRadius: "16px", boxShadow: "0 22px 44px -32px rgba(26,20,32,.65)" }} />
              ) : (
                /* Sem foto no site deles → inicial. Inventar rosto é dizer quem atende sem saber. */
                <div className="ha-vogue grid w-full place-items-center"
                  style={{ aspectRatio: "4/5", borderRadius: "16px", background: "rgba(108,0,168,.12)", color: "var(--roxo-f)", fontSize: "70px" }}>
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

      {/* 05 · O PEDIDO: quiz de 2 perguntas por vez, com escape em todo passo */}
      <section className="mx-auto max-w-3xl px-4 py-12" id="pedido" ref={pedido}>
        <div className="ha-card ha-rev p-6 sm:p-8">
          {enviado ? (
            <div className="py-6 text-center">
              <div className="ha-vogue text-[36px] font-medium" style={{ color: "var(--roxo-f)" }}>Got it.</div>
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
                    style={{ background: p <= passo ? "var(--roxo-f)" : "var(--linha)" }} />
                ))}
              </div>

              {passo === 0 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {["K-Tips", "Tape-Ins", "Weft", "Beaded I-Tip / Microlinks", "Balayage / Full Head Highlights (with toner)", "Highlights", "Women's Haircut", "Blowout"].map((s) => (
                      <button key={s} type="button" onClick={() => { escolher("servico", s); setOutro((o) => ({ ...o, servico: false })); }}
                        className="ha-pilula" data-on={form.servico === s && !outro.servico ? "1" : "0"}>{s}</button>
                    ))}
                    {/* ESCAPE — quem quer "arrumar extensões que outro salão fez" não se vê em pílula nenhuma */}
                    <button type="button" onClick={() => setOutro((o) => ({ ...o, servico: true }))}
                      className="ha-pilula" data-on={outro.servico ? "1" : "0"}>Something else…</button>
                  </div>
                  {outro.servico && (
                    <input className="ha-campo mt-3" placeholder="Tell us in your own words" value={livre.servico}
                      onChange={(e) => setLivre((l) => ({ ...l, servico: e.target.value }))} />
                  )}
                  {!outro.servico && form.servico && cotar(form.servico) && (
                    <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(108,0,168,.1)", border: "1px solid var(--roxo-e)" }}>
                      <div className="ha-mono text-[19px] font-medium" style={{ color: "var(--roxo-f)" }}>{cotar(form.servico).faixa}</div>
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
                  {/* MULTICANAL: só canais que este salão realmente atende (voz + texto/WhatsApp) */}
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
              {erroEnvio && <p className="mt-3 text-[13.5px]" style={{ color: "var(--roxo)" }}>{erroEnvio}</p>}
            </form>
          )}
        </div>
      </section>

      {/* 06 · A PONTE PRO BOOKING */}
      <section className="mx-auto max-w-6xl px-4 pb-12" id="booking">
        <div className="ha-card ha-rev flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
          <div className="min-w-0">
            <span className="ha-num">06</span>
            <div className="ha-vogue mt-1 font-medium" style={{ fontSize: "clamp(24px,4vw,34px)", lineHeight: 1.06 }}>
              Rather see the whole menu?
            </div>
            <p className="mt-1.5 max-w-[30rem] text-[14.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
              All 30 services, priced, extensions first, with the house note on the line you are choosing.
            </p>
          </div>
          <a href={B + "/book"} className="ha-selo ha-selo-forte"><span aria-hidden>▤</span> Open the booking page</a>
        </div>
      </section>

      {/* 07 · O QUE ESCREVEM NO GOOGLE — depoimentos reais, verbatim */}
      <section className="py-12" style={{ background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="07" sub="Verbatim from Google, attributed by first initial. Almost every one is about the extensions.">
            What people write on Google
          </Titulo>
          <div className="mt-7 grid items-start gap-4 sm:grid-cols-2">
            {DEPOIMENTOS.map(([quem, texto]) => (
              <figure key={quem} className="ha-card ha-rev p-6">
                <div className="ha-vogue text-[30px] leading-none" style={{ color: "var(--roxo)" }} aria-hidden>&ldquo;</div>
                <blockquote className="mt-1 text-[15px] leading-relaxed" style={{ color: "var(--tinta)" }}>{texto}</blockquote>
                <figcaption className="ha-kicker mt-3">{quem} · Google review</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 08 · O QUE SE SABE — só fatos honestos, nenhuma política inventada */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <Titulo n="08" sub="Only what we can actually confirm about how they run — no invented policy.">Good to know</Titulo>
        <div className="mt-6 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Same-day chairs", "Same-day appointments open up. Call or text and ask — they will tell you straight."],
            ["Two numbers", TEL_FMT + " rings the salon. " + TEXTO_FMT + " is for text and WhatsApp. Texting the voice line reaches no one."],
            ["You get a text", "Bookings are confirmed by SMS on the " + TEXTO_FMT + " line, so keep it handy."],
            ["Free Mask Treatment", "A free Mask Treatment comes with the Haircut Package — their standing offer, not our promise."],
          ].map(([t, d]) => (
            <div key={t} className="ha-card ha-rev p-5">
              <div className="ha-vogue text-[21px] font-medium leading-tight">{t}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 09 · FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <Titulo n="09">Questions</Titulo>
        <div className="mt-5 space-y-2.5">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="ha-card ha-rev">
              <button type="button" onClick={() => setAberto(aberto === i ? null : i)} aria-expanded={aberto === i}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 px-5 text-left">
                <span className="text-[15px] font-medium">{q}</span>
                <span aria-hidden style={{ color: "var(--roxo-f)" }}>{aberto === i ? "−" : "+"}</span>
              </button>
              {aberto === i && <p className="px-5 pb-4 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CONTATO: tudo à vista e VIVO */}
      <footer id="contact" className="border-t" style={{ borderColor: "var(--linha)", background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <img src={B + "/logo.png"} alt="23rd Street Hair Salon" width="140" height="140" className="w-[120px]" />
              <p className="mt-4 max-w-[26rem] text-[14.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Hair extension specialists in Kips Bay / Gramercy — also known as Gramercy Park Hair Salon, operated by A.M Hair Design Inc. Two lines, on purpose: one rings the salon, one takes your text.
              </p>
              <div className="mt-5"><Ramo cor="var(--roxo)" /></div>
            </div>
            <div className="space-y-2.5">
              <a href={"tel:" + TEL} className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--roxo)" }}>☎</span> Call {TEL_FMT}
              </a>
              {/* o de TEXTO/WhatsApp é o OUTRO número, de propósito */}
              <a href={"sms:" + TEXTO} className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--roxo)" }}>✉</span> Text / WhatsApp {TEXTO_FMT}
              </a>
              <a href="https://maps.google.com/?q=248+East+23rd+Street+New+York+NY+10010" target="_blank" rel="noreferrer"
                className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--roxo)" }}>◈</span> {ENDERECO}
              </a>
              <a href={SITE_DELES} target="_blank" rel="noreferrer" className="ha-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--roxo)" }}>▤</span> Their current site
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
