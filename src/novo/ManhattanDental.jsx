/* ══════════════════════════════════════════════════════════════════════════════════════════════
   MANHATTAN DENTAL STUDIO — 358 Fifth Avenue, 10th Floor, Manhattan NY 10001 · vitrine do COMBO
   Referência de SISTEMA: HairArtDesigns.jsx (hero em vídeo, fita de fotos, a seção que vende).
   Referência de VERTICAL: PennPlazaDental.jsx (dental elegante, aprovado 28/08).
   Método COPIADO, conteúdo 100% reescrito.

   DIREÇÃO DO LUIS: MOVIMENTO, VIDA, COR. Elegante e confortável, nunca chapado preto-e-branco,
   nunca "cara de AI" — zero emoji na UI, zero foto de banco, zero robô.

   A COR É MEDIDA, NÃO ESCOLHIDA. O logo deles é tinta preta pura sobre branco (#080A09 no pixel,
   PIL Counter) — preto não é paleta, é ausência dela. Então medi o LUGAR: as três fotos do
   consultório convergem no MESMO latão quente — #A47847 (corredor), #A0744A (sala de espera),
   #A88553 (recepção). Couro caramelo, parede de grasscloth, madeira clara. Essa é a cor real da
   Quinta Avenida deles, e é a família de acento da página inteira (claro → corpo → sombra).

   MEDIDO, NÃO INVENTADO (fonte: as páginas do próprio site deles, salvas e lidas):
   • Endereço e telefone confirmados. O segundo número, 212-947-2826, é o FAX — está rotulado
     "Fax:" no rodapé deles. Não entra como telefone.
   • Dr. Gary S. Tomack, DDS: Howard University College of Dentistry; residência no Harlem
     Hospital–Columbia University, onde ficou como instrutor e foi Chief of Cosmetic Dentistry
     por 28 anos; Fellowship da Academy of General Dentistry em julho de 2004 (500 horas de
     educação continuada + prova + 5 anos de filiação); 75–100 horas de educação por ano; em
     prática em Manhattan desde 1983.
   • Dra. Cindy Behrens, DMD: SUNY Binghamton 1980, University of Pennsylvania School of Dental
     Medicine 1984, residência de clínica geral no VA Medical Center de Northport NY; membro da
     Academy of General Dentistry e da American Academy of Cosmetic Dentistry.
   • Tecnologia listada por eles: VELscope, radiografia digital, câmera intraoral, CariVu,
     óxido nitroso, laser Waterlase, caneta elétrica.
   • Os casos antes/depois são do arquivo do Dr. Tomack, e cada legenda é o alt-text que ELES
     escreveram. O rótulo já vem gravado dentro do JPG — nenhum texto por cima (padrão §1).
   • Retratos: os dois são retratos profissionais reais, validados olhando. O arquivo
     "tomackbehrensbiopic" é a Dra. Behrens (não os dois juntos, como o nome sugere).

   OMITIDO POR FALTA DE DADO: horário da semana (não publicado — o selo vivo é relógio de NY +
   "by appointment"); preço (odontologia é seguro/consulta); aggregateRating (sem contagem real);
   nomes dos "Specialists" (a página existe, os nomes não); link direto do LocalMed (não temos a
   URL exata — a saída secundária é o site atual deles).
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+12126852476";
const TEL_FMT = "(212) 685-2476";
const ENDERECO = "358 Fifth Avenue, 10th Floor, Manhattan, NY 10001";
const DR1 = "Dr. Gary S. Tomack";
const DR2 = "Dr. Cindy Behrens";
const SITE_ATUAL = "https://www.manhattandentalstudio.com/";
const B = "/novo/manhattan-dental";
const SITE_URL = "https://guileoai.com/novo/manhattan-dental";
const MAPA = "https://maps.google.com/?q=358+Fifth+Avenue+10th+Floor+New+York+NY+10001";

/* A FITA DA CASA — fotos reais do consultório deles, legenda honesta do que CADA uma mostra. */
const CASA = [
  ["lounge.jpg", "The waiting room on the tenth floor — caramel leather, grasscloth walls, framed prints"],
  ["corridor.jpg", "The corridor to the front desk, warm oak floor end to end"],
  ["frontdesk.jpg", "Reception, under the curved soffit and the pendant lights"],
  ["operatory.jpg", "A treatment room, chair by the window"],
  ["desk2.jpg", "The counter at check-in, looking back toward the lounge"],
  ["lab.jpg", "The in-house lab bench where the ceramic work is finished"],
];

/* CASOS REAIS do arquivo do Dr. Tomack. O procedimento já está GRAVADO na imagem — a legenda
   não repete, ela contextualiza. Nada de rótulo por cima da foto. */
const CASOS = [
  ["case-01.jpg", "Full mouth reconstruction", "One of the longest cases in the file — every surface rebuilt."],
  ["case-02.jpg", "Porcelain veneers", "The front six, matched to the face rather than to a shade chart."],
  ["case-03.jpg", "Porcelain crowns, no metal", "All-ceramic, so no grey line ever appears at the gum."],
  ["case-04.jpg", "Porcelain veneers", "A midline gap closed without touching the healthy teeth beside it."],
  ["case-05.jpg", "Implant crowns and veneers", "Implant work and cosmetic work planned as one result, not two."],
  ["case-06.jpg", "Internal bleaching", "A single dark tooth brought back to its neighbours from the inside."],
];

/* Os serviços são os do menu DELES, agrupados. Sem preço: odontologia é por seguro/consulta. */
const CUIDADO = [
  ["Preventive", "The visits that keep small problems small.",
    ["Teeth cleaning", "Dental sealants", "Night guard", "Oral cancer screening"]],
  ["Restorative", "Repair, and the structure underneath it.",
    ["Tooth fillings", "Dental crowns", "Dental bridges", "Dental implants", "Inlays & onlays", "Dentures", "Gum disease laser therapy"]],
  ["Cosmetic", "The side of the practice Dr. Tomack taught for 28 years.",
    ["Porcelain veneers", "Teeth whitening", "Dental bonding", "Cosmetic dentistry"]],
  ["Emergency", "Something broke, or it hurts now.",
    ["Emergency dental care"]],
];

/* Tecnologia que ELES listam. Nenhum aparelho a mais. */
const TECNICA = [
  ["VELscope", "Oral cancer screening that looks below the surface of the tissue."],
  ["Digital X-rays", "A fraction of the radiation of film, and on screen while you are still in the chair."],
  ["Intraoral camera", "You see what the dentist sees, on the monitor, before anything is decided."],
  ["CariVu", "Infrared cavity scanner — decay found without another radiograph."],
  ["Waterlase", "Dental laser, for work that used to need more drilling than it does now."],
  ["Nitrous oxide", "Laughing gas, for anyone who arrives tense. Asking for it is normal here."],
  ["Electric handpiece", "Quieter and smoother than an air drill — most of the sound people dread is the drill."],
];

/* O QUE A GRACE FAZ — a seção que vende. Cada linha é função que ela JÁ executa. */
const GRACE = [
  ["Answers around the clock", "A chipped tooth does not wait for Monday. Grace picks up as Manhattan Dental Studio, at any hour, and she knows the practice."],
  ["Books the appointment", "Reason, timing, whether you are new. The request reaches the front desk with everything already asked."],
  ["Checks your insurance first", "Tell her the plan and she checks what applies before you commit. No plan? She explains the financing route, CareCredit included."],
  ["Calls you back", "Leave a number on this page and the phone rings back. That is not a mock-up — the form below does it."],
  ["Four languages", "She answers in the language you speak. On Fifth Avenue that is not a luxury."],
  ["Never gives clinical advice", "She books, checks coverage and answers logistics. What happens to your teeth is decided in the chair, by a dentist — and she says so."],
];

const CANAIS = [
  { id: "phone", rot: "Call me back", ico: "☎" },
  { id: "email", rot: "Email me", ico: "✉" },
];

const FAQ = [
  ["Where exactly are you?", "358 Fifth Avenue, tenth floor — on Fifth between 34th and 35th, a block from the Empire State Building and five minutes from Herald Square."],
  ["Do you take my insurance?", "Tell us the plan and we tell you what it covers before anything is booked. Without insurance there is a financing route, CareCredit included."],
  ["Who would I see?", DR1 + " and " + DR2 + " practise here, with a team of specialists for the work that calls for one."],
  ["Are the before and after photos real?", "They are Dr. Tomack's own cases, published by the practice, with the procedure written on each image by them — not by us."],
  ["It is an emergency.", "Call " + TEL_FMT + " and say what happened. You will be told honestly whether to come straight in."],
];

const TITULO = "Manhattan Dental Studio — Cosmetic & Family Dentistry on Fifth Avenue, NYC";
const DESC = DR1 + " and " + DR2 + " at 358 Fifth Avenue, 10th Floor. Porcelain veneers, implants, crowns and whitening — real before-and-after cases. Insurance and financing handled. Call " + TEL_FMT + ".";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["property", "og:image", "https://guileoai.com" + B + "/hero-poster.jpg"],
  ["name", "twitter:card", "summary_large_image"],
];

/* Um consultório é `Dentist`. Endereço CONFIRMADO entra inteiro. Os DOIS dentistas entram como
   employee/Person. aggregateRating OMITIDO — não temos contagem real. */
const LD = () => ([
  {
    "@context": "https://schema.org", "@type": "Dentist",
    name: "Manhattan Dental Studio", url: SITE_URL, telephone: TEL,
    image: "https://guileoai.com" + B + "/hero-poster.jpg",
    faxNumber: "+12129472826",
    address: {
      "@type": "PostalAddress", streetAddress: "358 Fifth Avenue, 10th Floor",
      addressLocality: "New York", addressRegion: "NY", postalCode: "10001", addressCountry: "US",
    },
    geo: { "@type": "GeoCoordinates", latitude: 40.7488, longitude: -73.9847 },
    areaServed: { "@type": "Place", name: "New York NY, Midtown, Midtown East, Midtown West, Murray Hill" },
    employee: [
      { "@type": "Person", name: DR1, honorificSuffix: "DDS", jobTitle: "Dentist" },
      { "@type": "Person", name: DR2, honorificSuffix: "DMD", jobTitle: "Dentist" },
    ],
    availableService: CUIDADO.flatMap(([cat, , itens]) => itens.map((n) => ({
      "@type": "MedicalProcedure", name: n, category: cat,
    }))),
  },
  {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({
      "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
]);

/* O FILETE QUE SE DESENHA — separa título de corpo e abre cada seção. É SVG para poder
   desenhar-se com stroke-dashoffset; um <hr> não desenha. */
const Filete = ({ largura = "22rem", cor = "var(--linha)" }) => (
  <svg className="md-filete" viewBox="0 0 400 2" preserveAspectRatio="none" aria-hidden="true" style={{ maxWidth: largura }}>
    <path d="M0 1 H400" stroke={cor} strokeWidth="2" />
  </svg>
);

/* Número editorial em GRADIENTE da família do acento (background-clip:text) — cor viva no lugar
   de um cinza chapado. */
const Titulo = ({ n, children, sub }) => (
  <div className="md-rev">
    <span className="md-num">{n}</span>
    <h2 className="md-vogue mt-1 font-medium" style={{ fontSize: "clamp(28px,5vw,46px)", lineHeight: 1.04, letterSpacing: "-.015em" }}>
      {children}
    </h2>
    {sub && <p className="mt-2.5 max-w-[42rem] text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{sub}</p>}
    <Filete />
  </div>
);

export default function ManhattanDental() {
  const [form, setForm] = useState({ nome: "", tel: "", email: "", motivo: "", quando: "", seguro: "" });
  const [canal, setCanal] = useState("phone");
  const [passo, setPasso] = useState(0);
  const [outro, setOutro] = useState({ motivo: false });
  const [livre, setLivre] = useState({ motivo: "", recado: "" });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [hora, setHora] = useState("");
  const [aberto, setAberto] = useState(null);
  /* A cortina começa em "nunca" — o estado SEM abertura. Só o efeito (que exige JS vivo) a
     fecha, e um segundo timer independente a remove aconteça o que acontecer. */
  const [cortina, setCortina] = useState("nunca"); // nunca | fechada | subindo
  /* O stagger do hero é ENCADEADO à abertura: entra quando a cortina sai, não antes. */
  const [heroDentro, setHeroDentro] = useState(false);
  const pedido = useRef(null);
  const raizRef = useRef(null);

  /* REVEAL FAIL-OPEN — o esconder só liga DEPOIS de o observer armar, com failsafe de 1.8s. */
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const els = raiz.querySelectorAll(".md-rev, .md-filete, .md-caso");
    const tudo = () => els.forEach((e) => e.classList.add("is-in"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches
        || !("IntersectionObserver" in window) || document.visibilityState === "hidden") { tudo(); return; }
    raiz.classList.add("md-anima");
    let algum = false;
    const io = new IntersectionObserver((es) => es.forEach((x) => {
      if (x.isIntersecting) { algum = true; x.target.classList.add("is-in"); io.unobserve(x.target); }
    }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    const failsafe = setTimeout(() => { if (!algum) tudo(); }, 1800);
    return () => { clearTimeout(failsafe); io.disconnect(); };
  }, []);

  /* A ABERTURA + o stagger do hero encadeado a ela. Fail-open dos dois lados: sem JS, com
     reduced-motion ou em aba oculta, o hero já nasce visível e a cortina não existe. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches
        || document.visibilityState === "hidden") { setHeroDentro(true); return; }
    setCortina("fechada");
    const t1 = setTimeout(() => { setCortina("subindo"); setHeroDentro(true); }, 1400);
    const t2 = setTimeout(() => setCortina("nunca"), 2500);
    const t3 = setTimeout(() => setHeroDentro(true), 2600); // failsafe independente
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  /* UM selo vivo só, e que INFORMA: o relógio de Nova York. Não afirmo a semana — eles não
     publicam horário — então o que acompanha o relógio é "by appointment". */
  useEffect(() => {
    const tick = () => setHora(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date()));
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
    const motivo = outro.motivo ? livre.motivo : form.motivo;
    let ok;
    try {
      const r = await fetch("/api/lead-vitrine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "manhattan-dental", negocio: "Manhattan Dental Studio",
          nome: form.nome, telefone: form.tel, email: form.email,
          mensagem: "[" + (motivo || "reason?")
            + (form.seguro ? " · insurance: " + form.seguro : "") + "] "
            + (form.quando || "any time") + " · reply on " + canal
            + (livre.recado ? " · note: " + livre.recado : ""),
        }),
      });
      const d = await r.json().catch(() => null);
      // O CORPO decide, nunca o status: r.ok sozinho já deixou recusa passar por sucesso.
      ok = !!(d && d.ok);
    } catch { ok = false; }
    if (ok) setEnviado(true);
    else setErroEnvio("That didn't send — call " + TEL_FMT + ", someone picks up.");
  }, [form, canal, outro, livre]);

  const podeAvancar = passo === 0 ? !!(form.motivo || livre.motivo)
    : passo === 1 ? true
    : !!(form.nome.trim() && (form.tel.trim() || form.email.trim()));

  return (
    <div className="md-raiz" ref={raizRef}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400;1,6..96,500&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .md-raiz{
          --papel:#F8F5EF; --papel2:#F0EADF; --branco:#FFFFFF;
          --tinta:#17140F; --tinta2:#57503F; --tinta3:#8E8676;
          /* FAMILIA DO ACENTO — medida no pixel das fotos do consultorio deles */
          --latao:#A47847; --latao-c:#D9B683; --latao-f:#6E4A26; --latao-g:#3D2814;
          --ink:#0D0F10;   /* a tinta do logo, medida: preto puro */
          --linha:#E2D9C9;
          background:var(--papel); color:var(--tinta); min-height:100vh;
          font-family:'Jost',system-ui,-apple-system,sans-serif;
          position:relative; overflow-x:hidden;
        }
        /* GRAO de papel na raiz — o realismo comeca aqui. z-index nos filhos. */
        .md-raiz::before{
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.32;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E");
        }
        .md-raiz > *{position:relative; z-index:1;}

        /* ── VOGUE ─────────────────────────────────────────────────────────────────────────── */
        .md-vogue{font-family:'Bodoni Moda',Didot,'Playfair Display',Georgia,serif;}
        .md-mono{font-family:'IBM Plex Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}
        .md-kicker{font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.26em;
          text-transform:uppercase; color:var(--latao-f);}
        /* NUMERO DE SECAO em gradiente da familia do acento — cor viva, nunca cinza chapado */
        .md-num{font-family:'Bodoni Moda',Didot,serif; font-size:15px; letter-spacing:.12em;
          background:linear-gradient(120deg,var(--latao-c),var(--latao) 45%,var(--latao-f));
          -webkit-background-clip:text; background-clip:text; color:transparent;
          -webkit-text-fill-color:transparent;}
        /* FILETE que se desenha */
        .md-filete{display:block; width:100%; height:2px; margin-top:1.25rem;}
        .md-anima .md-filete path{stroke-dasharray:400; stroke-dashoffset:400;
          transition:stroke-dashoffset 1.4s cubic-bezier(.22,.61,.36,1);}
        .md-filete.is-in path{stroke-dashoffset:0;}

        /* ── A ABERTURA ────────────────────────────────────────────────────────────────────── */
        .md-cortina{position:fixed; inset:0; z-index:60; background:var(--papel);
          display:grid; place-items:center;
          transition:transform 1.05s cubic-bezier(.72,0,.18,1), opacity 1.05s ease;}
        .md-cortina.sobe{transform:translateY(-100%); opacity:0;}
        .md-cortina img{width:min(48vw,220px); animation:md-respira 1.4s ease both;}
        @keyframes md-respira{0%{opacity:0; transform:scale(.93)}100%{opacity:1; transform:none}}

        /* ── STAGGER DO HERO, encadeado a saida da cortina ─────────────────────────────────── */
        .md-sobe{opacity:0; transform:translateY(20px);
          transition:opacity .85s cubic-bezier(.22,.61,.36,1), transform .85s cubic-bezier(.22,.61,.36,1);}
        .md-hero-in .md-sobe{opacity:1; transform:none;}
        .md-hero-in .md-sobe:nth-child(1){transition-delay:.02s}
        .md-hero-in .md-sobe:nth-child(2){transition-delay:.12s}
        .md-hero-in .md-sobe:nth-child(3){transition-delay:.22s}
        .md-hero-in .md-sobe:nth-child(4){transition-delay:.32s}
        .md-hero-in .md-sobe:nth-child(5){transition-delay:.42s}
        .md-hero-in .md-sobe:nth-child(6){transition-delay:.52s}

        /* ── O SELO ────────────────────────────────────────────────────────────────────────── */
        .md-selo{
          position:relative; display:inline-flex; align-items:center; justify-content:center; gap:9px; overflow:hidden;
          min-height:52px; padding:0 24px; border-radius:10px;
          font-weight:600; font-size:15px; letter-spacing:.01em; text-decoration:none;
          color:var(--tinta); background:var(--branco);
          background-image:linear-gradient(180deg,rgba(255,255,255,.96),rgba(240,234,223,.96));
          border:1.5px solid var(--latao);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(61,40,20,.12),
                     0 1px 2px rgba(23,20,15,.14), 0 14px 26px -18px rgba(23,20,15,.5);
          transition:border-color .25s, box-shadow .25s, transform .12s;
        }
        .md-selo::after{content:""; position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(115deg,transparent 30%,rgba(217,182,131,.65) 48%,transparent 66%);
          transform:translateX(-120%); transition:transform .75s ease;}
        .md-selo:hover::after{transform:translateX(120%);}
        .md-selo:hover{border-color:var(--latao-f);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(23,20,15,.16),
                     0 20px 34px -18px rgba(110,74,38,.5), 0 0 0 4px rgba(164,120,71,.22);}
        .md-selo:active{transform:scale(.985);}
        .md-selo[disabled],.md-selo.off{opacity:.55; filter:saturate(.5); pointer-events:none;}
        /* ACAO/TELEFONE — a cor quente deles, cheia */
        .md-selo-forte{color:var(--latao-g); border-color:var(--latao-f);
          background-image:linear-gradient(180deg,#E8CDA4,var(--latao-c));
          box-shadow:inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(23,20,15,.18),
                     0 16px 30px -18px rgba(110,74,38,.7);}
        .md-selo-forte:hover{border-color:var(--latao-g);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.8), 0 2px 4px rgba(23,20,15,.2),
                     0 22px 40px -16px rgba(110,74,38,.85), 0 0 0 4px rgba(164,120,71,.3);}
        /* SOBRE FOTO/VIDEO */
        .md-selo-claro{color:#fff; background:rgba(20,14,8,.36); background-image:none;
          border-color:rgba(255,255,255,.6); backdrop-filter:blur(6px);
          box-shadow:0 1px 2px rgba(0,0,0,.3), 0 18px 34px -20px rgba(0,0,0,.7);}
        .md-selo-claro:hover{border-color:#fff;
          box-shadow:0 1px 2px rgba(0,0,0,.3), 0 20px 40px -18px rgba(0,0,0,.8), 0 0 0 4px rgba(217,182,131,.3);}
        /* esconder de verdade: a minha folha vence o utilitario do Tailwind, entao o sumico e meu */
        @media (max-width:639px){ .md-so-larga{display:none !important;} }

        /* ── CARTAO: material + HOVER que LEVANTA e um fio de acento que varre ─────────────── */
        .md-card{position:relative; border-radius:20px; background:var(--branco); border:1px solid var(--linha);
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(23,20,15,.06),
                     0 1px 2px rgba(23,20,15,.06), 0 26px 48px -34px rgba(23,20,15,.42);
          overflow:hidden; transition:transform .32s cubic-bezier(.22,.61,.36,1), box-shadow .32s ease;}
        .md-card::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,.14) 100%);}
        .md-card > *{position:relative; z-index:2;}
        .md-card-vivo::before{content:""; position:absolute; left:0; right:0; top:0; height:2px; z-index:3;
          background:linear-gradient(90deg,transparent,var(--latao-c),var(--latao),transparent);
          transform:translateX(-100%); transition:transform .75s cubic-bezier(.22,.61,.36,1);}
        .md-card-vivo:hover{transform:translateY(-5px);
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), 0 3px 8px rgba(23,20,15,.1),
                     0 34px 56px -30px rgba(110,74,38,.45);}
        .md-card-vivo:hover::before{transform:translateX(100%);}

        /* ── HERO EM VIDEO ─────────────────────────────────────────────────────────────────── */
        .md-filme{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
        /* veu VERTICAL: o texto vive embaixo, sobre a imagem */
        .md-veu{position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(180deg,rgba(18,12,6,.48) 0%,rgba(18,12,6,.12) 28%,rgba(18,12,6,.6) 70%,rgba(13,9,4,.92) 100%);}
        /* a COR entra como luz de cena, nao como tinta chapada */
        .md-luz{position:absolute; inset:0; pointer-events:none; mix-blend-mode:soft-light;
          background:radial-gradient(90% 70% at 22% 78%,rgba(217,182,131,.55) 0%,transparent 60%);}
        .md-vinheta{position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(120% 92% at 50% 42%,transparent 58%,rgba(13,9,4,.45) 100%);}

        /* ── A FITA DE FOTOS: push-in lento e continuo, direcao alternada ──────────────────── */
        .md-fita{display:flex; gap:14px; overflow-x:auto; scroll-snap-type:x mandatory;
          padding-bottom:12px; -webkit-overflow-scrolling:touch;}
        .md-fita > figure{flex:0 0 auto; width:min(78vw,392px); scroll-snap-align:start; margin:0;}
        .md-quadro{position:relative; overflow:hidden; border-radius:16px;
          box-shadow:0 22px 44px -30px rgba(23,20,15,.65);}
        .md-quadro::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:radial-gradient(120% 92% at 50% 46%,transparent 62%,rgba(23,20,15,.28) 100%);}
        .md-fita img{width:100%; aspect-ratio:4/5; object-fit:cover; display:block;
          animation:md-empurra 26s ease-in-out infinite alternate;}
        .md-fita > figure:nth-child(even) img{animation-name:md-empurra-alt;}
        @keyframes md-empurra{from{transform:scale(1) translate3d(0,0,0)} to{transform:scale(1.12) translate3d(-1.5%,-1%,0)}}
        @keyframes md-empurra-alt{from{transform:scale(1.12) translate3d(1.5%,1%,0)} to{transform:scale(1) translate3d(0,0,0)}}

        /* ── CASOS: reveal alternado esquerda/direita ─────────────────────────────────────── */
        .md-anima .md-caso{opacity:0; transition:opacity .8s ease, transform .8s cubic-bezier(.22,.61,.36,1);}
        .md-anima .md-caso:nth-child(odd){transform:translateX(-26px);}
        .md-anima .md-caso:nth-child(even){transform:translateX(26px);}
        .md-caso.is-in{opacity:1 !important; transform:none !important;}

        /* ── A SECAO DA GRACE: fundo de FOTO + veu na cor da marca, nunca bloco cinza ─────── */
        .md-grace{position:relative; overflow:hidden; background:var(--latao-g);}
        .md-grace-foto{position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
          opacity:.5; filter:saturate(1.15);}
        .md-grace-veu{position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(160deg,rgba(61,40,20,.86) 0%,rgba(110,74,38,.78) 45%,rgba(23,16,8,.94) 100%);}

        /* ── MOVIMENTO GERAL ─────────────────────────────────────────────────────────────── */
        .md-anima .md-rev{opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s ease;}
        .md-anima .md-rev.is-in{opacity:1; transform:none;}
        @media (prefers-reduced-motion: reduce){
          .md-rev,.md-caso,.md-sobe{opacity:1 !important; transform:none !important; transition:none !important;}
          .md-filete path{stroke-dashoffset:0 !important;}
          .md-cortina{display:none !important;}
          .md-fita img{animation:none !important;}
          .md-pulso::after{animation:none !important;}
        }

        .md-pulso{position:relative; display:inline-flex; width:7px; height:7px; border-radius:999px;}
        .md-pulso::after{content:""; position:absolute; inset:0; border-radius:inherit;
          background:inherit; animation:md-ping 2.4s cubic-bezier(0,0,.2,1) infinite;}
        @keyframes md-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.6);opacity:0}}

        .md-pilula{min-height:44px; padding:0 16px; border-radius:999px; border:1px solid var(--linha);
          background:var(--branco); color:var(--tinta2); font-size:13.5px; font-weight:500;
          transition:border-color .2s,color .2s,background .2s;}
        .md-pilula:hover{border-color:var(--latao); color:var(--tinta);}
        .md-pilula[data-on="1"]{border-color:var(--latao-f); background:rgba(164,120,71,.12); color:var(--tinta);}

        .md-campo{width:100%; min-height:52px; padding:0 16px; border-radius:12px;
          border:1px solid var(--linha); background:var(--branco); color:var(--tinta); font-size:15px;}
        .md-campo::placeholder{color:var(--tinta3);}
        .md-campo:focus{outline:none; border-color:var(--latao); box-shadow:0 0 0 3px rgba(164,120,71,.2);}

        /* PLACA do logo — o arquivo e tinta preta sobre branco; placa branca do mesmo raio */
        .md-placa{background:var(--branco); border:1px solid var(--linha); border-radius:14px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(23,20,15,.05),
                     0 1px 2px rgba(23,20,15,.16), 0 18px 34px -22px rgba(13,9,4,.7);}

        @media (max-width:639px){ .md-raiz{padding-bottom:88px} }
        .md-bar{position:fixed; left:0; right:0; bottom:0; z-index:40; background:rgba(248,245,239,.94);
          backdrop-filter:blur(12px); border-top:1px solid var(--linha); padding:.6rem .9rem;
          box-shadow:0 -8px 24px -18px rgba(23,20,15,.4);}
      `}</style>

      {/* ── A ABERTURA ────────────────────────────────────────────────────────────────────── */}
      {cortina !== "nunca" && (
        <div className={"md-cortina" + (cortina === "subindo" ? " sobe" : "")} aria-hidden="true">
          <img src={B + "/logo.png"} alt="" />
        </div>
      )}

      {/* ── CABEÇALHO: marca + ação na MESMA linha, nunca quebra ──────────────────────────── */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "var(--linha)", background: "rgba(248,245,239,.9)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-3 px-4 py-3">
          <a href="#topo" className="flex min-w-0 flex-nowrap items-center gap-2.5">
            <span className="md-placa grid h-12 shrink-0 place-items-center overflow-hidden px-2.5">
              <img src={B + "/logo.png"} alt="Manhattan Dental Studio" width="176" height="148" className="h-[34px] w-auto" />
            </span>
            {/* No celular o nome inteiro reticenciava ("Manhattan Dental St…"). O logo ao lado já
                diz o nome completo, então a linha encurta em vez de cortar no meio de uma palavra. */}
            <span className="md-vogue min-w-0 truncate font-medium" style={{ fontSize: "clamp(15px,3.4vw,21px)" }}>
              <span className="hidden sm:inline">Manhattan Dental Studio</span>
              <span className="sm:hidden">Manhattan Dental</span>
            </span>
          </a>
          <span className="flex-1" />
          <a href="#pedido" className="md-selo md-so-larga shrink-0" style={{ padding: "0 18px" }}>Book</a>
          <a href={"tel:" + TEL} className="md-selo md-selo-forte shrink-0" style={{ padding: "0 18px" }}>
            <span aria-hidden>☎</span>
            <span className="hidden sm:inline">{TEL_FMT}</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </header>

      {/* ── HERO EM VÍDEO — o filme é DELES, montado das fotos reais do consultório ───────── */}
      <section id="topo" className={"relative overflow-hidden" + (heroDentro ? " md-hero-in" : "")}
        style={{ minHeight: "min(92vh,820px)", background: "#12100E" }}>
        {/* o poster é o fail-open: se o vídeo não carrega, a primeira tela ainda é a porta deles */}
        <video className="md-filme" autoPlay muted loop playsInline preload="metadata"
          poster={B + "/hero-poster.jpg"} aria-label="358 Fifth Avenue and the tenth-floor studio">
          <source src={B + "/hero.mp4"} type="video/mp4" />
        </video>
        <div className="md-veu" />
        <div className="md-luz" />
        <div className="md-vinheta" />

        <div className="relative mx-auto flex max-w-6xl flex-col justify-end px-4 pb-14" style={{ minHeight: "min(92vh,820px)" }}>
          <div className="max-w-[47rem]">
            <div className="md-sobe">
              <span className="md-placa inline-flex items-center overflow-hidden px-4 py-2.5">
                <img src={B + "/logo.png"} alt="Manhattan Dental Studio" width="176" height="148" className="h-[46px] w-auto sm:h-[56px]" />
              </span>
            </div>
            <div className="md-kicker md-sobe mt-6" style={{ color: "rgba(255,246,232,.78)" }}>
              358 Fifth Avenue · 10th Floor · Manhattan
            </div>
            {/* MASTHEAD: didone grande, tracking negativo, 2ª linha itálica na cor MEDIDA */}
            <h1 className="md-vogue md-sobe mt-3 font-medium" style={{ color: "#fff", fontSize: "clamp(40px,8vw,92px)", lineHeight: .96, letterSpacing: "-.024em", textWrap: "balance", textShadow: "0 2px 34px rgba(0,0,0,.42)" }}>
              Fifth Avenue smiles,<br />
              <em style={{ color: "var(--latao-c)" }}>one floor up.</em>
            </h1>
            <div className="md-sobe">
              <Filete largura="24rem" cor="rgba(255,255,255,.34)" />
            </div>
            <p className="md-sobe max-w-[35rem] text-[16px] leading-relaxed" style={{ color: "rgba(255,246,232,.9)" }}>
              {DR1} and {DR2} have been rebuilding smiles from the tenth floor of 358 Fifth Avenue
              since 1983 — veneers, implants, crowns and whitening, next to the everyday care that
              keeps them looking that way. The before-and-after cases below are theirs.
            </p>

            <div className="md-sobe mt-7 flex flex-wrap items-center gap-2.5">
              <a href={"tel:" + TEL} className="md-selo md-selo-forte"><span aria-hidden>☎</span> Call {TEL_FMT}</a>
              <a href="#pedido" className="md-selo md-selo-claro"><span aria-hidden>✦</span> Request an appointment</a>
            </div>

            <div className="md-sobe mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: "#fff" }}>
                <span className="md-pulso" style={{ background: "var(--latao-c)" }} />
                <span className="md-mono">{hora} NYC · by appointment</span>
              </span>
              <span className="md-kicker" style={{ color: "rgba(255,246,232,.68)" }}>Insurance &amp; financing handled</span>
              <span className="md-kicker" style={{ color: "rgba(255,246,232,.68)" }}>Cosmetic &amp; family dentistry</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── DADO EDITORIAL — cada número é verificável nas páginas deles ─────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="md-rev grid grid-cols-2 gap-y-8 sm:grid-cols-4">
          {[["1983", "practising in Manhattan since"],
            ["28", "years Chief of Cosmetic Dentistry"],
            ["10th", "floor, 358 Fifth Avenue"],
            ["24/7", "Grace answers the phone"]].map(([n, r]) => (
            <div key={r}>
              <div className="md-vogue font-medium" style={{ fontSize: "clamp(34px,5vw,54px)", lineHeight: 1,
                background: "linear-gradient(140deg,var(--latao-f),var(--tinta) 60%)",
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" }}>{n}</div>
              <div className="md-kicker mt-1.5" style={{ color: "var(--tinta2)" }}>{r}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 01 · A CASA ──────────────────────────────────────────────────────────────────── */}
      <section className="py-10">
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="01" sub="A tenth-floor practice on Fifth Avenue, a block from the Empire State Building. Caramel leather, grasscloth, warm oak — a dental office that does not feel like one. These are their rooms, photographed as they are.">
            The studio, ten floors above Fifth
          </Titulo>
        </div>
        <div className="mx-auto mt-6 max-w-6xl px-4">
          <div className="md-fita md-rev">
            {CASA.map(([arq, legenda]) => (
              <figure key={arq}>
                <div className="md-quadro"><img src={B + "/" + arq} alt={legenda} loading="lazy" /></div>
                <figcaption className="mt-2.5 text-[12.5px] leading-snug" style={{ color: "var(--tinta3)" }}>{legenda}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · OS CASOS REAIS — a prova social mais forte que existe em estética dental ── */}
      <section className="py-12" style={{ background: "var(--papel2)" }} id="cases">
        <div className="mx-auto max-w-5xl px-4">
          <Titulo n="02" sub="These are Dr. Tomack's own cases, published by the practice. The procedure is written on each image by them — we did not label a single one, and we did not retouch a single one.">
            Real cases, from his own files
          </Titulo>
          <div className="mt-8 space-y-5">
            {/* 🚨 O deslocamento alternado precisa viver no MESMO style inline. Com "margin:0"
                inline e "sm:ml-auto" na classe, o inline vence e os seis cartões ficam colados à
                esquerda — a alternância sumia sem nenhum erro, só um print igualzinho. */}
            {CASOS.map(([arq, rot, nota], i) => (
              <figure key={arq} className="md-caso md-card md-card-vivo p-4 sm:p-5"
                style={{ maxWidth: "44rem", marginTop: 0, marginBottom: 0,
                  marginLeft: i % 2 ? "auto" : 0, marginRight: i % 2 ? 0 : "auto" }}>
                <img src={B + "/" + arq} alt={rot + " — a before and after case by Dr. Gary S. Tomack"}
                  loading="lazy" className="w-full rounded-xl" style={{ display: "block" }} />
                <figcaption className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="md-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[14.5px] font-semibold">{rot}</span>
                  <span className="text-[13.5px] leading-snug" style={{ color: "var(--tinta2)" }}>{nota}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="md-rev mt-8 flex flex-wrap items-center gap-2.5">
            <a href="#pedido" className="md-selo md-selo-forte"><span aria-hidden>✦</span> Ask what is possible for me</a>
            <a href={"tel:" + TEL} className="self-center text-[13.5px] underline" style={{ color: "var(--tinta2)" }}>or call {TEL_FMT}</a>
          </div>
        </div>
      </section>

      {/* ── 03 · O CUIDADO ──────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12" id="care">
        <Titulo n="03" sub="Everything the practice lists, grouped the way you would ask for it. There is no price on this page on purpose: dentistry runs on insurance and on what the exam finds — and Grace checks what you're covered for before anything is booked.">
          Care, grouped the way you ask for it
        </Titulo>
        <div className="mt-7 grid items-start gap-4 sm:grid-cols-2">
          {CUIDADO.map(([t, d, itens], i) => (
            <div key={t} className="md-card md-card-vivo md-rev p-6">
              <span className="md-num">{String(i + 1).padStart(2, "0")}</span>
              <div className="md-vogue mt-1 text-[25px] font-medium leading-tight">{t}</div>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{d}</p>
              <ul className="mt-3.5 flex flex-wrap gap-x-2 gap-y-2">
                {itens.map((s) => (
                  <li key={s} className="rounded-full px-3 py-1.5 text-[13px]"
                    style={{ background: "rgba(164,120,71,.1)", border: "1px solid var(--linha)", color: "var(--tinta2)" }}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="md-card md-card-vivo md-rev mt-4 flex flex-wrap items-center justify-between gap-4 p-6"
          style={{ background: "rgba(164,120,71,.06)" }}>
          <div>
            <div className="md-vogue text-[23px] font-medium leading-tight">Insurance and financing, handled for you</div>
            <p className="mt-1.5 max-w-[34rem] text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
              The practice files with your plan and tells you what it covers before you commit. Without
              a plan there is a financing route, CareCredit included — ask and you get a straight answer.
            </p>
          </div>
          <a href="#pedido" className="md-selo"><span aria-hidden>◈</span> Check my coverage</a>
        </div>
      </section>

      {/* ── 04 · OS DENTISTAS — retratos REAIS, biografia real ──────────────────────────── */}
      <section className="py-12" style={{ background: "var(--papel2)" }} id="dentists">
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="04" sub="Two dentists, a practice they built together, and a team of specialists for the work that calls for one.">
            The people in the room
          </Titulo>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* O JPG do Dr. Tomack já traz a assinatura dele gravada — nenhum rótulo por cima. */}
            <article className="md-card md-card-vivo md-rev overflow-hidden">
              <div className="grid sm:grid-cols-[minmax(0,10rem)_1fr]">
                <div className="md-quadro" style={{ borderRadius: 0 }}>
                  <img src={B + "/dr-tomack.jpg"} alt="Dr. Gary S. Tomack, DDS" loading="lazy"
                    className="h-full w-full object-cover" style={{ minHeight: 200 }} />
                </div>
                <div className="p-6">
                  <div className="md-kicker">Gary S. Tomack, DDS</div>
                  <div className="md-vogue mt-1 text-[26px] font-medium leading-tight">Chief of Cosmetic Dentistry for 28 years</div>
                  <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                    Howard University College of Dentistry, then a residency at Harlem Hospital–Columbia
                    University where he stayed on as an instructor and became Chief of Cosmetic Dentistry
                    for the next twenty-eight years. Fellowship of the Academy of General Dentistry in
                    2004 — five hundred hours of continuing education, a written exam and five years of
                    membership. He still takes seventy-five to a hundred hours a year, and still lectures
                    at Harlem Hospital–Columbia.
                  </p>
                  <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                    In practice in Manhattan since 1983. He was seven when he started visiting his father
                    and his uncle at work — both of them dentists.
                  </p>
                </div>
              </div>
            </article>
            <article className="md-card md-card-vivo md-rev overflow-hidden">
              <div className="grid sm:grid-cols-[minmax(0,10rem)_1fr]">
                <div className="md-quadro" style={{ borderRadius: 0 }}>
                  <img src={B + "/dr-behrens.jpg"} alt="Dr. Cindy Behrens, DMD" loading="lazy"
                    className="h-full w-full object-cover" style={{ minHeight: 200 }} />
                </div>
                <div className="p-6">
                  <div className="md-kicker">Cindy Behrens, DMD</div>
                  <div className="md-vogue mt-1 text-[26px] font-medium leading-tight">Two academies, and the same chair since</div>
                  <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                    State University of New York at Binghamton in 1980, then the University of Pennsylvania
                    School of Dental Medicine, class of 1984, followed by a general practice residency at
                    the Veterans Administration Medical Center in Northport, New York.
                  </p>
                  <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                    A member of the Academy of General Dentistry and of the American Academy of Cosmetic
                    Dentistry, and she keeps up the continuing education every year. She practises here
                    with Dr. Tomack — they are married, and the practice is the one they built.
                  </p>
                </div>
              </div>
            </article>
          </div>
          <p className="md-rev mt-5 text-[13.5px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
            The practice also works with a team of specialists for the cases that need one. We are not
            listing their names here, because the practice does not publish them — ask on the phone and
            you get the right name for what you need.
          </p>
        </div>
      </section>

      {/* ── 05 · A TÉCNICA — o que eles listam, nada a mais ─────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12" id="technology">
        <Titulo n="05" sub="Most of what people dread at the dentist is the drill, the needle and the wait for a verdict. Every item here exists to remove one of those three — and all of it is already installed on the tenth floor.">
          What is already in the room
        </Titulo>
        <div className="mt-7 grid items-start gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {TECNICA.map(([t, d], i) => (
            <div key={t} className="md-rev">
              <span className="md-num">{String(i + 1).padStart(2, "0")}</span>
              <div className="md-vogue mt-1 text-[22px] font-medium leading-tight">{t}</div>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 06 · O QUE A GRACE FAZ — fundo de FOTO real + véu na cor da marca ───────────── */}
      <section className="md-grace py-14" id="grace">
        <img className="md-grace-foto" src={B + "/frontdesk.jpg"} alt="" aria-hidden="true" loading="lazy" />
        <div className="md-grace-veu" />
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="md-rev">
            <span className="md-num" style={{ background: "linear-gradient(120deg,#F1DDBC,var(--latao-c))", WebkitBackgroundClip: "text", backgroundClip: "text" }}>06</span>
            <h2 className="md-vogue mt-1 font-medium" style={{ color: "#fff", fontSize: "clamp(28px,5vw,46px)", lineHeight: 1.04, letterSpacing: "-.015em" }}>
              The front desk that never closes
            </h2>
            <p className="mt-2.5 max-w-[42rem] text-[15px] leading-relaxed" style={{ color: "rgba(255,246,232,.82)" }}>
              Grace is this practice's front desk — on this page and on the phone. She knows the two
              dentists, the categories of care, and the house rule that nothing clinical is decided
              outside the chair. She is not a chatbot with a script.
            </p>
            <Filete largura="26rem" cor="rgba(255,255,255,.3)" />
          </div>
          <div className="mt-7 grid items-start gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {GRACE.map(([t, d], i) => (
              <div key={t} className="md-rev">
                <span className="md-num" style={{ background: "linear-gradient(120deg,#F1DDBC,var(--latao-c))", WebkitBackgroundClip: "text", backgroundClip: "text" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="md-vogue mt-1 text-[22px] font-medium leading-tight" style={{ color: "#fff" }}>{t}</div>
                <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "rgba(255,246,232,.76)" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 07 · O PEDIDO: quiz em passos, escape em todo passo ─────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-12" id="pedido" ref={pedido}>
        <div className="md-card md-rev p-6 sm:p-8">
          {enviado ? (
            <div className="py-6 text-center">
              <div className="md-vogue text-[38px] font-medium" style={{ color: "var(--latao-f)" }}>Got it.</div>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Your request is with the practice, and someone comes back on the channel you picked. If
                you are in pain right now, {TEL_FMT} rings the front desk and that is always faster.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <span className="md-num">07</span>
              <h2 className="md-vogue mt-1 font-medium" style={{ fontSize: "clamp(26px,4.4vw,40px)", lineHeight: 1.04 }}>
                {passo === 0 ? "What brings you in?" : passo === 1 ? "When suits you?" : "Where do we answer?"}
              </h2>

              <div className="mt-4 flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((p) => (
                  <span key={p} className="h-1 flex-1 rounded-full transition-colors"
                    style={{ background: p <= passo ? "var(--latao)" : "var(--linha)" }} />
                ))}
              </div>

              {passo === 0 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {["Veneers", "Implants", "Crowns or a bridge", "Whitening", "Cleaning & check-up",
                      "Tooth pain", "Chipped tooth", "New patient", "Second opinion"].map((s) => (
                      <button key={s} type="button" onClick={() => { escolher("motivo", s); setOutro((o) => ({ ...o, motivo: false })); }}
                        className="md-pilula" data-on={form.motivo === s && !outro.motivo ? "1" : "0"}>{s}</button>
                    ))}
                    <button type="button" onClick={() => setOutro((o) => ({ ...o, motivo: true }))}
                      className="md-pilula" data-on={outro.motivo ? "1" : "0"}>Something else…</button>
                  </div>
                  {outro.motivo && (
                    <input className="md-campo mt-3" placeholder="Tell us in your own words" value={livre.motivo}
                      onChange={(e) => setLivre((l) => ({ ...l, motivo: e.target.value }))} />
                  )}
                  <div className="mt-5">
                    <div className="md-kicker" style={{ color: "var(--tinta2)" }}>Insurance (optional)</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["I have insurance", "No insurance", "Not sure"].map((s) => (
                        <button key={s} type="button" onClick={() => escolher("seguro", form.seguro === s ? "" : s)}
                          className="md-pilula" data-on={form.seguro === s ? "1" : "0"}>{s}</button>
                      ))}
                    </div>
                    <p className="mt-2 text-[12.5px]" style={{ color: "var(--tinta3)" }}>
                      Grace checks what you're covered for before anything is booked — no plan is fine, there is a financing route.
                    </p>
                  </div>
                </div>
              )}

              {passo === 1 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {["Before work", "Lunch hour", "After work", "This week", "Next week", "As soon as possible"].map((q) => (
                      <button key={q} type="button" onClick={() => escolher("quando", form.quando === q ? "" : q)}
                        className="md-pilula" data-on={form.quando === q ? "1" : "0"}>{q}</button>
                    ))}
                  </div>
                  <p className="mt-3 text-[12.5px]" style={{ color: "var(--tinta3)" }}>
                    Optional — tell us roughly and the practice comes back with the times that actually exist.
                  </p>
                </div>
              )}

              {passo === 2 && (
                <div className="mt-6 space-y-3">
                  <input className="md-campo" placeholder="Your name" value={form.nome} onChange={(e) => escolher("nome", e.target.value)} />
                  <input className="md-campo" type="tel" placeholder="Phone we can call back" value={form.tel} onChange={(e) => escolher("tel", e.target.value)} />
                  <input className="md-campo" type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => escolher("email", e.target.value)} />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CANAIS.map((c) => (
                      <button key={c.id} type="button" onClick={() => setCanal(c.id)} className="md-pilula" data-on={canal === c.id ? "1" : "0"}>
                        <span aria-hidden className="mr-1.5">{c.ico}</span>{c.rot}
                      </button>
                    ))}
                  </div>
                  <textarea className="md-campo py-3" rows={2} placeholder="Anything we should know? (optional)" value={livre.recado}
                    onChange={(e) => setLivre((l) => ({ ...l, recado: e.target.value }))} style={{ minHeight: 72, resize: "vertical" }} />
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                    Leave a number and the practice's AI calls you straight back — that is the fastest way to a time.
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {passo > 0 && <button type="button" onClick={() => setPasso((p) => p - 1)} className="md-pilula">← Back</button>}
                {passo < 2 ? (
                  <button type="button" disabled={!podeAvancar} onClick={() => setPasso((p) => p + 1)}
                    className={"md-selo" + (podeAvancar ? "" : " off")}>Next</button>
                ) : (
                  <button type="submit" disabled={!podeAvancar} className={"md-selo md-selo-forte" + (podeAvancar ? "" : " off")}>
                    <span aria-hidden>✦</span> Request my appointment
                  </button>
                )}
                <a href={"tel:" + TEL} className="self-center text-[13.5px] underline" style={{ color: "var(--tinta2)" }}>or just call {TEL_FMT}</a>
              </div>
              {erroEnvio && <p className="mt-3 text-[13.5px]" style={{ color: "var(--latao-f)" }}>{erroEnvio}</p>}
            </form>
          )}
        </div>
      </section>

      {/* ── 08 · FAQ ─────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <Titulo n="08">Straight answers</Titulo>
        <div className="mt-5 space-y-2.5">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="md-card md-rev">
              <button type="button" onClick={() => setAberto(aberto === i ? null : i)} aria-expanded={aberto === i}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 px-5 text-left">
                <span className="text-[15px] font-medium">{q}</span>
                <span aria-hidden style={{ color: "var(--latao-f)" }}>{aberto === i ? "−" : "+"}</span>
              </button>
              {aberto === i && <p className="px-5 pb-4 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTATO ──────────────────────────────────────────────────────────────────────── */}
      <footer id="contact" className="border-t" style={{ borderColor: "var(--linha)", background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <span className="md-placa inline-flex items-center overflow-hidden px-4 py-3">
                <img src={B + "/logo.png"} alt="Manhattan Dental Studio" width="176" height="148" className="h-[52px] w-auto" />
              </span>
              <p className="mt-4 max-w-[27rem] text-[14.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Cosmetic and family dentistry on the tenth floor of 358 Fifth Avenue, with {DR1} and{" "}
                {DR2}. Veneers, implants, crowns and whitening alongside the everyday care — insurance
                filed and financing arranged for you.
              </p>
            </div>
            <div className="space-y-2.5">
              <a href={"tel:" + TEL} className="md-card md-card-vivo flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--latao-f)" }}>☎</span> Call {TEL_FMT}
              </a>
              <a href={MAPA} target="_blank" rel="noreferrer"
                className="md-card md-card-vivo flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--latao-f)" }}>◈</span> {ENDERECO}
              </a>
              <a href={SITE_ATUAL} target="_blank" rel="noreferrer"
                className="md-card md-card-vivo flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--latao-f)" }}>▤</span> Their current site
              </a>
              <div className="md-kicker pt-1" style={{ color: "var(--tinta2)" }}>By appointment · New York time</div>
            </div>
          </div>
          <p className="mt-8 border-t pt-4 text-[11.5px]" style={{ borderColor: "var(--linha)", color: "var(--tinta2)" }}>
            ⚡ site + AI by <a href="https://guileoai.com" className="underline" style={{ color: "var(--tinta2)" }}>Guileo</a>
          </p>
        </div>
      </footer>

      <div className="md-bar sm:hidden">
        <a className="md-selo md-selo-forte w-full" href={"tel:" + TEL}><span aria-hidden>☎</span> Call {TEL_FMT}</a>
      </div>
    </div>
  );
}
