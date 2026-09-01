/* ══════════════════════════════════════════════════════════════════════════════════════════════
   PENN PLAZA DENTAL CENTER — 7 Pennsylvania Plaza, Suite 302, NYC · vitrine do COMBO MOTOR
   Referência de MÉTODO: HairArtDesigns.jsx / PADRAO-VITRINE.md. Esta versão é a REFORMA da v1,
   que o Luis reprovou por "cara de AI".

   O DESAFIO: eles NÃO TÊM UMA FOTO. O site real (pennplazadental.com, GoDaddy magro) tem só o
   logo — zero foto, zero vídeo. Trocar banco de imagem por banco de imagem, gradiente-no-lugar-de-
   foto ou arte de IA seria repetir o defeito e É o que dá "cara de AI". Então NÃO tem hero de
   vídeo nem foto de estúdio. O elegante vem de outro lugar:
   • A IDENTIDADE AZUL REAL deles (azul #00248F medido no logo) + o dourado champagne #C6A15B.
   • TIPOGRAFIA editorial didone (Bodoni Moda) — o masthead é a arte.
   • O CONCEITO da localização: o consultório é literalmente EM CIMA da Penn Station. "A dentist
     two minutes from your train." O hero é tipografia sobre azul-marinho rico, com um MOTIVO
     art-déco desenhado (as arcadas da Penn Station / NY) em traço fino dourado — desenho não
     afirma, foto mente. O logo AZUL real vive numa placa de papel pra ler sobre o marinho.
   • CONFORTÁVEL: as seções de baixo respiram em papel quente, tom calmo — não clínica fria.

   MEDIDO, NÃO INVENTADO (fonte: scout + arquivo): Dr. Julien Zenker; endereço 7 Penn Plaza Suite
   302 (confirmado → entra no schema); (212) 736-0670; "Open today 9am-5pm" (só isso — a semana
   NÃO é inventada); diferenciais reais (em cima da Penn Station, não fazem overbooking, insurance
   handled for you). SEM preço (odontologia é por seguro/plano). SEM foto de rosto (não temos o
   rosto do Dr. Zenker — a seção dele é tipográfica). SEM aggregateRating (sem contagem real).
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from "react";

const TEL = "+12127360670";
const TEL_FMT = "(212) 736-0670";
const ENDERECO = "7 Pennsylvania Plaza, Suite 302, New York, NY 10001";
const DENTISTA = "Dr. Julien Zenker";
const SITE_ATUAL = "https://pennplazadental.com/";
const B = "/novo/penn-plaza-dental";
const SITE_URL = "https://guileoai.com/novo/penn-plaza-dental";

/* As categorias de serviço são HONESTAS: o guarda-chuva "all phases of modern dentistry" traduzido
   em categorias de clínica geral. Sem preço, sem procedimento inventado com detalhe falso. */
const CUIDADO = [
  ["General & preventive", "Exams, cleanings and the check-ups that keep small problems small."],
  ["Cosmetic", "Veneers and the work that makes a smile look like itself again."],
  ["Restorative", "Fillings, crowns and everyday repair — the core of modern dentistry."],
  ["Periodontal", "Care for the gums beneath the teeth, where lasting health starts."],
  ["Emergency", "A chipped tooth or sudden pain — call and we tell you straight when to come in."],
];

/* O QUE A IVY FAZ — a seção que vende. Cada linha é função que ela JÁ executa, nunca roadmap. */
const IVY = [
  ["Answers around the clock", "The phone rings at 6am before your train, or 11pm after your shift. Ivy picks up as Penn Plaza Dental Center — and she knows the practice."],
  ["Books without overbooking", "She takes the appointment request the way the practice runs — timed, not stacked. Your slot starts when it says it does."],
  ["Checks what you're covered for", "Tell her your insurance and she checks what applies before you commit. No plan? She explains the flexible option."],
  ["Calls you back", "Leave a number on this page and the phone rings back. That is not a mock-up — the form below does it."],
  ["Four languages", "She answers in the language you speak. Under Penn Station, that is not a luxury."],
  ["Never gives dental advice", "She books, checks coverage and answers logistics. The dentistry itself is Dr. Zenker's chair — and she says so."],
];

const CANAIS = [
  { id: "phone", rot: "Call me back", ico: "☎" },
  { id: "email", rot: "Email me", ico: "✉" },
];

const FAQ = [
  ["Where exactly are you?", "7 Pennsylvania Plaza, Suite 302 — inside the Penn Plaza building, straight up from the Penn Station concourse."],
  ["Do you take my insurance?", "We handle the filing and tell you exactly what you're covered for before you commit. No insurance? A flexible plan instead."],
  ["Will I be kept waiting?", "We don't overbook. Appointments are timed so your visit starts when it should — that is the point of booking here."],
  ["Is it an emergency?", "Call " + TEL_FMT + " and tell us what happened. We tell you honestly whether to come straight in."],
];

const TITULO = "Penn Plaza Dental Center — Dentist Above Penn Station, NYC";
const DESC = "Dr. Julien Zenker at 7 Penn Plaza, Suite 302 — two minutes from your train. Appointments that are not overbooked, insurance filed for you. Call (212) 736-0670.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["property", "og:image", "https://guileoai.com" + B + "/logo-papel.png"],
  ["name", "twitter:card", "summary_large_image"],
];

/* O site deles tem schema genérico. Um consultório é `Dentist` — e a diferença é o que faz
   aparecer numa busca por dentista. Endereço CONFIRMADO entra. aggregateRating OMITIDO. */
const LD = () => ([
  {
    "@context": "https://schema.org", "@type": "Dentist",
    name: "Penn Plaza Dental Center", url: SITE_URL, telephone: TEL,
    image: "https://guileoai.com" + B + "/logo-papel.png",
    address: {
      "@type": "PostalAddress", streetAddress: "7 Pennsylvania Plaza, Suite 302",
      addressLocality: "New York", addressRegion: "NY", postalCode: "10001", addressCountry: "US",
    },
    geo: { "@type": "GeoCoordinates", latitude: 40.7506, longitude: -73.9935 },
    areaServed: { "@type": "Place", name: "Midtown Manhattan, Penn Station, Herald Square, Chelsea" },
    founder: { "@type": "Person", name: DENTISTA, jobTitle: "Dentist" },
    employee: { "@type": "Person", name: DENTISTA, jobTitle: "Dentist" },
  },
  {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({
      "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
]);

/* O MOTIVO — arcadas art-déco que evocam a Penn Station / NY. Traço fino na cor deles: um desenho
   é visivelmente um desenho, então não AFIRMA "esta é a sala" como uma foto de estúdio faria. */
const Arcadas = ({ cor = "var(--ouro)", op = 1 }) => (
  <svg className="pp-arcadas" viewBox="0 0 360 120" fill="none" aria-hidden="true" style={{ opacity: op }}>
    <g stroke={cor} strokeWidth="1.3" strokeLinecap="round">
      {[0, 72, 144, 216, 288].map((x) => (
        <g key={x}>
          <path d={"M" + (x + 6) + " 116 V 60 A 30 30 0 0 1 " + (x + 66) + " 60 V 116"} />
          <path d={"M" + (x + 18) + " 116 V 66 A 18 18 0 0 1 " + (x + 54) + " 66 V 116"} opacity=".6" />
          <path d={"M" + (x + 36) + " 30 v 8"} />
          <circle cx={x + 36} cy="24" r="3.2" />
        </g>
      ))}
      <path d="M0 116 H360" />
      <path d="M0 100 H360" opacity=".35" />
    </g>
  </svg>
);

const Titulo = ({ n, children, sub }) => (
  <div className="pp-rev">
    <span className="pp-num">{n}</span>
    <h2 className="pp-vogue mt-1 font-medium" style={{ fontSize: "clamp(28px,5vw,46px)", lineHeight: 1.04, letterSpacing: "-.015em" }}>
      {children}
    </h2>
    {sub && <p className="mt-2.5 max-w-[40rem] text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{sub}</p>}
    <hr className="pp-filete mt-5" />
  </div>
);

export default function PennPlazaDental() {
  const [form, setForm] = useState({ nome: "", tel: "", email: "", motivo: "", quando: "", seguro: "" });
  const [canal, setCanal] = useState("phone");
  const [passo, setPasso] = useState(0);
  const [outro, setOutro] = useState({ motivo: false });
  const [livre, setLivre] = useState({ motivo: "", recado: "" });
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [hora, setHora] = useState("");
  const [aberto, setAberto] = useState(null);
  /* A cortina começa em "nunca" — o estado SEM abertura. Só o efeito (que só roda com JS vivo)
     a fecha. Assim nenhum caminho de falha deixa uma cortina presa na frente da página. */
  const [cortina, setCortina] = useState("nunca"); // nunca | fechada | subindo
  const pedido = useRef(null);
  const raizRef = useRef(null);

  /* REVEAL FAIL-OPEN — o esconder só liga DEPOIS de o observer armar, com failsafe de 1.8s. */
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const els = raiz.querySelectorAll(".pp-rev, .pp-arcadas");
    const tudo = () => els.forEach((e) => e.classList.add("is-in"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches
        || !("IntersectionObserver" in window) || document.visibilityState === "hidden") { tudo(); return; }
    raiz.classList.add("pp-anima");
    let algum = false;
    const io = new IntersectionObserver((es) => es.forEach((x) => {
      if (x.isIntersecting) { algum = true; x.target.classList.add("is-in"); io.unobserve(x.target); }
    }), { threshold: 0.14 });
    els.forEach((e) => io.observe(e));
    const failsafe = setTimeout(() => { if (!algum) tudo(); }, 1800);
    return () => { clearTimeout(failsafe); io.disconnect(); };
  }, []);

  /* A ABERTURA. Vive 1,4s e sobe. O segundo timer é INDEPENDENTE: se algo travar, aos 2,5s a
     cortina deixa de existir de qualquer jeito. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.visibilityState === "hidden") return;
    setCortina("fechada");
    const t1 = setTimeout(() => setCortina("subindo"), 1400);
    const t2 = setTimeout(() => setCortina("nunca"), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  /* UM selo vivo só: o relógio de NY. Num consultório dentro de uma estação, a hora é o que o
     passageiro está olhando de qualquer jeito — e prova que a página está viva. Sem afirmar dias:
     só sei "open today 9-5", então o selo é "by appointment · we don't overbook", nunca a semana. */
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
          slug: "penn-plaza-dental", negocio: "Penn Plaza Dental Center",
          nome: form.nome, telefone: form.tel, email: form.email,
          mensagem: "[" + (motivo || "reason?")
            + (form.seguro ? " · insurance: " + form.seguro : "") + "] "
            + (form.quando || "any time") + " · reply on " + canal
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

  const podeAvancar = passo === 0 ? !!(form.motivo || livre.motivo)
    : passo === 1 ? true
    : !!(form.nome.trim() && (form.tel.trim() || form.email.trim()));

  return (
    <div className="pp-raiz" ref={raizRef}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400;1,6..96,500&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .pp-raiz{
          --papel:#F7F5F0; --papel2:#EEEAE0; --branco:#FFFFFF;
          --tinta:#14181F; --tinta2:#4A5464; --tinta3:#8A93A3;
          --azul:#00248F; --azul-e:#2B4FA8; --azul-f:#001A5C; --azul-g:#00103C;
          --ouro:#C6A15B; --ouro-e:#A07C3A;
          --linha:#DED8CB;
          background:var(--papel); color:var(--tinta); min-height:100vh;
          font-family:'Jost',system-ui,-apple-system,sans-serif;
          position:relative; overflow-x:hidden;
        }
        /* GRÃO na raiz — o realismo 4K começa aqui. z-index nos filhos, senão pinta por cima. */
        .pp-raiz::before{
          content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.30;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E");
        }
        .pp-raiz > *{position:relative; z-index:1;}

        /* ── VOGUE: a didone é a voz da página ─────────────────────────────────────────────── */
        .pp-vogue{font-family:'Bodoni Moda',Didot,'Playfair Display',Georgia,serif;}
        .pp-mono{font-family:'IBM Plex Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;}
        .pp-kicker{font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.26em;
          text-transform:uppercase; color:var(--azul);}
        .pp-num{font-family:'Bodoni Moda',Didot,serif; font-size:12.5px; letter-spacing:.12em; color:var(--ouro-e);}
        .pp-filete{height:1px; background:var(--linha); border:0;}

        /* ── A ABERTURA ────────────────────────────────────────────────────────────────────── */
        .pp-cortina{position:fixed; inset:0; z-index:60; background:var(--papel);
          display:grid; place-items:center;
          transition:transform 1.05s cubic-bezier(.72,0,.18,1), opacity 1.05s ease;}
        .pp-cortina.sobe{transform:translateY(-100%); opacity:0;}
        .pp-cortina img{width:min(58vw,280px); animation:pp-respira 1.4s ease both;}
        @keyframes pp-respira{0%{opacity:0; transform:scale(.93)}100%{opacity:1; transform:none}}

        /* ── O SELO (massa lapidada, borda na cor deles, canto 10px, nunca cápsula) ─────────── */
        .pp-selo{
          position:relative; display:inline-flex; align-items:center; justify-content:center; gap:9px; overflow:hidden;
          min-height:52px; padding:0 24px; border-radius:10px;
          font-weight:600; font-size:15px; letter-spacing:.01em; text-decoration:none;
          color:var(--tinta); background:var(--branco);
          background-image:linear-gradient(180deg,rgba(255,255,255,.95),rgba(238,234,224,.95));
          border:1.5px solid var(--azul-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(0,26,92,.12),
                     0 1px 2px rgba(20,24,31,.14), 0 14px 26px -18px rgba(20,24,31,.5);
          transition:border-color .25s, box-shadow .25s, transform .12s;
        }
        .pp-selo::after{content:""; position:absolute; inset:0; pointer-events:none;
          background:linear-gradient(115deg,transparent 30%,rgba(43,79,168,.5) 48%,transparent 66%);
          transform:translateX(-120%); transition:transform .75s ease;}
        .pp-selo:hover::after{transform:translateX(120%);}
        .pp-selo:hover{border-color:var(--azul);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(20,24,31,.16),
                     0 20px 34px -18px rgba(0,36,143,.5), 0 0 0 4px rgba(0,36,143,.2);}
        .pp-selo:active{transform:scale(.985);}
        .pp-selo[disabled],.pp-selo.off{opacity:.55; filter:saturate(.5); pointer-events:none;}
        /* AÇÃO/TELEFONE na cor quente deles = o dourado champagne */
        .pp-selo-forte{border-color:var(--ouro-e); background-image:linear-gradient(180deg,#FFF,#F5ECDB);}
        .pp-selo-forte::after{background:linear-gradient(115deg,transparent 30%,rgba(198,161,91,.6) 48%,transparent 66%);}
        .pp-selo-forte:hover{border-color:var(--ouro-e);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(20,24,31,.16),
                     0 20px 34px -18px rgba(160,124,58,.5), 0 0 0 4px rgba(198,161,91,.26);}
        /* variante para viver SOBRE o marinho do hero */
        .pp-selo-claro{color:#fff; background:rgba(0,16,60,.34); background-image:none;
          border-color:rgba(255,255,255,.6); backdrop-filter:blur(6px);
          box-shadow:0 1px 2px rgba(0,0,0,.3), 0 18px 34px -20px rgba(0,0,0,.7);}
        .pp-selo-claro:hover{border-color:#fff; box-shadow:0 1px 2px rgba(0,0,0,.3), 0 20px 40px -18px rgba(0,0,0,.8), 0 0 0 4px rgba(198,161,91,.28);}
        .pp-selo-ouro{color:var(--azul-g); background-image:linear-gradient(180deg,#E8CE93,#C6A15B); border-color:#8A6A2E;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.6), 0 18px 34px -18px rgba(160,124,58,.7);}
        .pp-selo-ouro:hover{border-color:#8A6A2E; box-shadow:inset 0 1px 0 rgba(255,255,255,.7), 0 22px 40px -16px rgba(160,124,58,.85), 0 0 0 4px rgba(198,161,91,.3);}
        /* esconder de verdade: minha folha vence o utilitario do Tailwind, entao o sumico e meu */
        @media (max-width:639px){ .pp-so-larga{display:none !important;} }

        /* ── CARTÃO: material, nunca retângulo chapado ─────────────────────────────────────── */
        .pp-card{position:relative; border-radius:20px; background:var(--branco); border:1px solid var(--linha);
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(20,24,31,.06),
                     0 1px 2px rgba(20,24,31,.06), 0 26px 48px -34px rgba(20,24,31,.42); overflow:hidden;}
        .pp-card::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,.14) 100%);}
        .pp-card > *{position:relative; z-index:2;}

        /* ── HERO EDITORIAL (marinho, SEM foto/vídeo) ──────────────────────────────────────── */
        .pp-hero{position:relative; overflow:hidden;
          background:radial-gradient(120% 90% at 78% 8%,rgba(198,161,91,.18) 0%,transparent 46%),
                     linear-gradient(165deg,var(--azul-f) 0%,var(--azul-g) 62%,#000A26 100%);}
        .pp-hero-veu{position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(130% 100% at 50% 0%,transparent 52%,rgba(0,10,38,.6) 100%);}
        .pp-arcadas{width:100%; height:auto; display:block;}
        .pp-anima .pp-arcadas path,.pp-anima .pp-arcadas circle{stroke-dasharray:600; stroke-dashoffset:600; transition:stroke-dashoffset 1.8s ease;}
        .pp-arcadas.is-in path,.pp-arcadas.is-in circle{stroke-dashoffset:0;}

        /* placa do logo — arquivo azul precisa de fundo claro pra ler sobre o marinho */
        .pp-placa{background:var(--branco); border:1px solid var(--linha); border-radius:14px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(20,24,31,.05),
                     0 1px 2px rgba(20,24,31,.16), 0 18px 34px -22px rgba(0,10,38,.7);}

        /* ── MOVIMENTO ───────────────────────────────────────────────────────────────────── */
        .pp-anima .pp-rev{opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s ease;}
        .pp-anima .pp-rev.is-in{opacity:1; transform:none;}
        @media (prefers-reduced-motion: reduce){
          .pp-rev{opacity:1 !important; transform:none !important;}
          .pp-arcadas path,.pp-arcadas circle{stroke-dashoffset:0 !important;}
          .pp-cortina{display:none !important;}
        }

        .pp-pulso{position:relative; display:inline-flex; width:7px; height:7px; border-radius:999px;}
        .pp-pulso::after{content:""; position:absolute; inset:0; border-radius:inherit;
          background:inherit; animation:pp-ping 2.4s cubic-bezier(0,0,.2,1) infinite;}
        @keyframes pp-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.6);opacity:0}}
        @media (prefers-reduced-motion: reduce){ .pp-pulso::after{animation:none;} }

        .pp-pilula{min-height:44px; padding:0 16px; border-radius:999px; border:1px solid var(--linha);
          background:var(--branco); color:var(--tinta2); font-size:13.5px; font-weight:500;
          transition:border-color .2s,color .2s,background .2s;}
        .pp-pilula:hover{border-color:var(--azul-e); color:var(--tinta);}
        .pp-pilula[data-on="1"]{border-color:var(--azul); background:rgba(0,36,143,.08); color:var(--tinta);}

        .pp-campo{width:100%; min-height:52px; padding:0 16px; border-radius:12px;
          border:1px solid var(--linha); background:var(--branco); color:var(--tinta); font-size:15px;}
        .pp-campo::placeholder{color:var(--tinta3);}
        .pp-campo:focus{outline:none; border-color:var(--azul); box-shadow:0 0 0 3px rgba(0,36,143,.18);}

        @media (max-width:639px){ .pp-raiz{padding-bottom:88px} }
        .pp-bar{position:fixed; left:0; right:0; bottom:0; z-index:40; background:rgba(247,245,240,.94);
          backdrop-filter:blur(12px); border-top:1px solid var(--linha); padding:.6rem .9rem;
          box-shadow:0 -8px 24px -18px rgba(20,24,31,.4);}
      `}</style>

      {/* ── A ABERTURA ────────────────────────────────────────────────────────────────────── */}
      {cortina !== "nunca" && (
        <div className={"pp-cortina" + (cortina === "subindo" ? " sobe" : "")} aria-hidden="true">
          <img src={B + "/logo.png"} alt="" />
        </div>
      )}

      {/* ── CABEÇALHO: marca + ação na MESMA linha, nunca quebra ──────────────────────────── */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "var(--linha)", background: "rgba(247,245,240,.9)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-3 px-4 py-3">
          <a href="#topo" className="flex min-w-0 flex-nowrap items-center gap-2.5">
            {/* A PLACA (padrão §7): logo AZUL em fundo branco pra não sumir; placa proporcional. */}
            <span className="pp-placa grid h-12 shrink-0 place-items-center overflow-hidden px-3">
              <img src={B + "/logo.png"} alt="Penn Plaza Dental Center" className="h-[30px] w-auto" />
            </span>
            <span className="pp-vogue min-w-0 truncate font-medium" style={{ fontSize: "clamp(15px,3.4vw,21px)" }}>
              Penn Plaza Dental
            </span>
          </a>
          <span className="flex-1" />
          <a href="#pedido" className="pp-selo pp-so-larga shrink-0" style={{ padding: "0 18px" }}>Book</a>
          <a href={"tel:" + TEL} className="pp-selo pp-selo-forte shrink-0" style={{ padding: "0 18px" }}>
            <span aria-hidden>☎</span>
            <span className="hidden sm:inline">{TEL_FMT}</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </header>

      {/* ── HERO EDITORIAL ───────────────────────────────────────────────────────────────── */}
      <section id="topo" className="pp-hero">
        <div className="pp-hero-veu" />
        {/* o motivo art-déco vive no rodapé do hero, como a arcada de uma estação */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-[.5]">
          <Arcadas cor="var(--ouro)" op={0.9} />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col justify-center px-4" style={{ minHeight: "min(90vh,780px)" }}>
          <div className="max-w-[48rem] py-16">
            <span className="pp-placa mb-7 inline-flex items-center overflow-hidden px-4 py-2.5">
              <img src={B + "/logo.png"} alt="Penn Plaza Dental Center" className="h-[34px] w-auto sm:h-[40px]" />
            </span>
            <div className="pp-kicker" style={{ color: "rgba(230,238,255,.72)" }}>7 Pennsylvania Plaza · Suite 302 · New York</div>
            {/* MASTHEAD: didone grande, tracking negativo, 2ª linha dourada em itálico */}
            <h1 className="pp-vogue mt-3 font-medium" style={{ color: "#fff", fontSize: "clamp(38px,7.6vw,86px)", lineHeight: .98, letterSpacing: "-.022em", textWrap: "balance", textShadow: "0 2px 30px rgba(0,0,0,.35)" }}>
              A dentist two minutes<br />
              <em style={{ color: "var(--ouro)" }}>from your train.</em>
            </h1>
            <hr className="pp-filete my-6" style={{ background: "rgba(255,255,255,.28)", maxWidth: "22rem" }} />
            <p className="max-w-[34rem] text-[16px] leading-relaxed" style={{ color: "rgba(230,238,255,.9)" }}>
              {DENTISTA} at Penn Plaza Dental Center — straight up from the concourse you already
              walk through. We value your time, so we don't overbook: your appointment starts when
              it says it does.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <a href={"tel:" + TEL} className="pp-selo pp-selo-ouro"><span aria-hidden>☎</span> Call {TEL_FMT}</a>
              <a href="#pedido" className="pp-selo pp-selo-claro"><span aria-hidden>✦</span> Request an appointment</a>
            </div>

            {/* faixa de credenciais — o selo VIVO informa (relógio de NY), sem afirmar a semana */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium" style={{ color: "#fff" }}>
                <span className="pp-pulso" style={{ background: "var(--ouro)" }} />
                <span className="pp-mono">{hora} NYC · by appointment</span>
              </span>
              <span className="pp-kicker" style={{ color: "rgba(230,238,255,.66)" }}>Insurance handled for you</span>
              <span className="pp-kicker" style={{ color: "rgba(230,238,255,.66)" }}>We don't overbook</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── DADO EDITORIAL — honesto, nada inventado ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="pp-rev grid grid-cols-2 gap-y-8 sm:grid-cols-4">
          {[["302", "the suite, 7 Penn Plaza"], ["2 min", "from your train"], ["24/7", "Ivy answers the phone"], ["4", "languages spoken"]].map(([n, r]) => (
            <div key={r}>
              <div className="pp-vogue font-medium" style={{ fontSize: "clamp(34px,5vw,52px)", lineHeight: 1 }}>{n}</div>
              <div className="pp-kicker mt-1.5" style={{ color: "var(--tinta2)" }}>{r}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 01 · A LOCALIZAÇÃO ───────────────────────────────────────────────────────────── */}
      <section className="py-10">
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="01" sub="The biggest thing about this practice is where it is. You already walk past the door.">
            You already walk past the door
          </Titulo>
          <div className="mt-7 grid items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <p className="text-[16px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Penn Plaza Dental Center is at <b style={{ color: "var(--tinta)" }}>{ENDERECO}</b> — inside
                the Penn Plaza building, directly above the station. If you commute through Penn, the
                appointment costs you the walk upstairs and nothing else: no train, no crosstown, no
                afternoon gone.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[["Penn Station", "Straight up from the concourse"],
                  ["Herald Square", "Six blocks north"],
                  ["Chelsea & Midtown", "A short walk either way"]].map(([a, b]) => (
                  <div key={a} className="rounded-2xl px-4 py-3" style={{ background: "rgba(0,36,143,.05)", border: "1px solid var(--linha)" }}>
                    <div className="text-[14.5px] font-bold">{a}</div>
                    <div className="text-[13px]" style={{ color: "var(--tinta2)" }}>{b}</div>
                  </div>
                ))}
              </div>
              <a href="https://maps.google.com/?q=7+Pennsylvania+Plaza+Suite+302+New+York+NY+10001" target="_blank" rel="noreferrer"
                className="pp-selo mt-6"><span aria-hidden>◈</span> Open in Maps</a>
            </div>
            {/* o motivo art-déco no lugar de um mapa-foto: é visivelmente um desenho, não afirma. */}
            <div className="pp-card p-6 sm:p-8" style={{ background: "linear-gradient(165deg,var(--azul-f),var(--azul-g))" }}>
              <div className="pp-kicker" style={{ color: "rgba(230,238,255,.6)" }}>The concourse, straight up</div>
              <div className="mt-4"><Arcadas cor="var(--ouro)" op={0.95} /></div>
              <p className="pp-mono mt-4 text-[12.5px]" style={{ color: "rgba(230,238,255,.7)" }}>40.7506°N · 73.9935°W</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 · O CUIDADO ───────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12" id="care">
        <Titulo n="02" sub={DENTISTA + " is experienced in all phases of modern dentistry. These are the categories of care — the exact plan is his, agreed with you. There is no price here on purpose: dentistry is by insurance or plan, and Ivy checks what you're covered for before anything is booked."}>
          Care, across every phase
        </Titulo>
        <div className="mt-7 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CUIDADO.map(([t, d], i) => (
            <div key={t} className="pp-card pp-rev p-6">
              <span className="pp-num">{String(i + 1).padStart(2, "0")}</span>
              <div className="pp-vogue mt-1 text-[23px] font-medium leading-tight">{t}</div>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{d}</p>
            </div>
          ))}
          <div className="pp-card pp-rev flex flex-col justify-center p-6" style={{ background: "rgba(0,36,143,.04)" }}>
            <div className="pp-vogue text-[22px] font-medium leading-tight">Not sure which?</div>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
              Tell us what's going on and we point you the right way — no charge to ask.
            </p>
            <a href="#pedido" className="pp-selo pp-selo-forte mt-4"><span aria-hidden>✦</span> Request a visit</a>
          </div>
        </div>
      </section>

      {/* ── 03 · O DENTISTA — tipográfico, SEM foto de rosto ─────────────────────────────── */}
      <section className="py-12" style={{ background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="03">Dr. Julien Zenker</Titulo>
          <div className="mt-7 grid items-center gap-8 lg:grid-cols-[.85fr_1.15fr]">
            {/* Não temos o rosto dele. Inventar um retrato stock é dizer quem atende sem saber —
                então o "retrato" é o logo numa placa, honesto. */}
            <div className="pp-card grid place-items-center p-10" style={{ background: "linear-gradient(165deg,var(--azul-f),var(--azul-g))" }}>
              <span className="pp-placa inline-flex items-center overflow-hidden px-6 py-5">
                <img src={B + "/logo.png"} alt="Penn Plaza Dental Center" className="h-[64px] w-auto" />
              </span>
            </div>
            <div>
              <p className="pp-vogue text-[clamp(20px,2.6vw,27px)] font-medium leading-snug" style={{ letterSpacing: "-.01em" }}>
                “He evaluates what you need and creates a dental care plan that works for you —
                the latest techniques with practical know-how, so your smile is both beautiful and
                healthy.”
              </p>
              <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                {DENTISTA} is experienced in all phases of modern dentistry. The practice is built
                on one plain idea — <b style={{ color: "var(--tinta)" }}>we value your time</b> — so
                appointments are timed, not overbooked, and the insurance paperwork is handled for you.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <a href={"tel:" + TEL} className="pp-selo pp-selo-forte"><span aria-hidden>☎</span> Call {TEL_FMT}</a>
                <a href="#pedido" className="pp-selo">Request an appointment</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 04 · O QUE A IVY FAZ — a seção que vende ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-12" id="ivy">
        <Titulo n="04" sub="Ivy is the practice's front desk — the one on this page and on the phone. She knows the categories of care, the hours idea and the house rules. She is not a chatbot with a script.">
          The front desk that never closes
        </Titulo>
        <div className="mt-7 grid items-start gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {IVY.map(([t, d], i) => (
            <div key={t} className="pp-rev">
              <span className="pp-num">{String(i + 1).padStart(2, "0")}</span>
              <div className="pp-vogue mt-1 text-[22px] font-medium leading-tight">{t}</div>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 05 · O PEDIDO: quiz de passos, escape em todo passo ──────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-12" id="pedido" ref={pedido}>
        <div className="pp-card pp-rev p-6 sm:p-8">
          {enviado ? (
            <div className="py-6 text-center">
              <div className="pp-vogue text-[36px] font-medium" style={{ color: "var(--azul)" }}>Got it.</div>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Your request is with the practice. Someone comes back on the channel you picked — and
                if you are in pain right now, {TEL_FMT} rings the front desk and that is always faster.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <span className="pp-num">05</span>
              <h2 className="pp-vogue mt-1 font-medium" style={{ fontSize: "clamp(26px,4.4vw,40px)", lineHeight: 1.04 }}>
                {passo === 0 ? "What brings you in?" : passo === 1 ? "When suits you?" : "Where do we answer?"}
              </h2>

              {/* barra de progresso que só anda com resposta */}
              <div className="mt-4 flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((p) => (
                  <span key={p} className="h-1 flex-1 rounded-full transition-colors"
                    style={{ background: p <= passo ? "var(--azul)" : "var(--linha)" }} />
                ))}
              </div>

              {passo === 0 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {["Check-up & cleaning", "Tooth pain", "Chipped / broken tooth", "Cosmetic / veneers", "New patient", "Second opinion"].map((s) => (
                      <button key={s} type="button" onClick={() => { escolher("motivo", s); setOutro((o) => ({ ...o, motivo: false })); }}
                        className="pp-pilula" data-on={form.motivo === s && !outro.motivo ? "1" : "0"}>{s}</button>
                    ))}
                    <button type="button" onClick={() => setOutro((o) => ({ ...o, motivo: true }))}
                      className="pp-pilula" data-on={outro.motivo ? "1" : "0"}>Something else…</button>
                  </div>
                  {outro.motivo && (
                    <input className="pp-campo mt-3" placeholder="Tell us in your own words" value={livre.motivo}
                      onChange={(e) => setLivre((l) => ({ ...l, motivo: e.target.value }))} />
                  )}
                  <div className="mt-5">
                    <div className="pp-kicker" style={{ color: "var(--tinta2)" }}>Insurance (optional)</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["I have insurance", "No insurance", "Not sure"].map((s) => (
                        <button key={s} type="button" onClick={() => escolher("seguro", form.seguro === s ? "" : s)}
                          className="pp-pilula" data-on={form.seguro === s ? "1" : "0"}>{s}</button>
                      ))}
                    </div>
                    <p className="mt-2 text-[12.5px]" style={{ color: "var(--tinta3)" }}>
                      Ivy checks what you're covered for before anything is booked — no plan is fine, there's a flexible option.
                    </p>
                  </div>
                </div>
              )}

              {passo === 1 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {["Before work", "Lunch hour", "After work", "This week", "Weekend", "As soon as possible"].map((q) => (
                      <button key={q} type="button" onClick={() => escolher("quando", form.quando === q ? "" : q)}
                        className="pp-pilula" data-on={form.quando === q ? "1" : "0"}>{q}</button>
                    ))}
                  </div>
                  <p className="mt-3 text-[12.5px]" style={{ color: "var(--tinta3)" }}>Optional — we'll find a slot that starts on time either way.</p>
                </div>
              )}

              {passo === 2 && (
                <div className="mt-6 space-y-3">
                  <input className="pp-campo" placeholder="Your name" value={form.nome} onChange={(e) => escolher("nome", e.target.value)} />
                  <input className="pp-campo" type="tel" placeholder="Phone we can call back" value={form.tel} onChange={(e) => escolher("tel", e.target.value)} />
                  <input className="pp-campo" type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => escolher("email", e.target.value)} />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CANAIS.map((c) => (
                      <button key={c.id} type="button" onClick={() => setCanal(c.id)} className="pp-pilula" data-on={canal === c.id ? "1" : "0"}>
                        <span aria-hidden className="mr-1.5">{c.ico}</span>{c.rot}
                      </button>
                    ))}
                  </div>
                  <textarea className="pp-campo py-3" rows={2} placeholder="Anything we should know? (optional)" value={livre.recado}
                    onChange={(e) => setLivre((l) => ({ ...l, recado: e.target.value }))} style={{ minHeight: 72, resize: "vertical" }} />
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                    Leave a number and the practice's AI calls you straight back — that is the fastest way to a time.
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {passo > 0 && <button type="button" onClick={() => setPasso((p) => p - 1)} className="pp-pilula">← Back</button>}
                {passo < 2 ? (
                  <button type="button" disabled={!podeAvancar} onClick={() => setPasso((p) => p + 1)}
                    className={"pp-selo" + (podeAvancar ? "" : " off")}>Next</button>
                ) : (
                  <button type="submit" disabled={!podeAvancar} className={"pp-selo pp-selo-forte" + (podeAvancar ? "" : " off")}>
                    <span aria-hidden>✦</span> Request my appointment
                  </button>
                )}
                <a href={"tel:" + TEL} className="self-center text-[13.5px] underline" style={{ color: "var(--tinta2)" }}>or just call {TEL_FMT}</a>
              </div>
              {erroEnvio && <p className="mt-3 text-[13.5px]" style={{ color: "var(--ouro-e)" }}>{erroEnvio}</p>}
            </form>
          )}
        </div>
      </section>

      {/* ── 06 · FAQ ─────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-12">
        <Titulo n="06">Straight answers</Titulo>
        <div className="mt-5 space-y-2.5">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="pp-card pp-rev">
              <button type="button" onClick={() => setAberto(aberto === i ? null : i)} aria-expanded={aberto === i}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 px-5 text-left">
                <span className="text-[15px] font-medium">{q}</span>
                <span aria-hidden style={{ color: "var(--azul)" }}>{aberto === i ? "−" : "+"}</span>
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
              <span className="pp-placa inline-flex items-center overflow-hidden px-4 py-3">
                <img src={B + "/logo.png"} alt="Penn Plaza Dental Center" className="h-[40px] w-auto" />
              </span>
              <p className="mt-4 max-w-[26rem] text-[14.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                A dental practice inside the Penn Plaza building, above Penn Station. {DENTISTA},
                all phases of modern dentistry. We value your time — appointments are timed, not
                overbooked, and insurance is handled for you.
              </p>
            </div>
            <div className="space-y-2.5">
              <a href={"tel:" + TEL} className="pp-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--ouro-e)" }}>☎</span> Call {TEL_FMT}
              </a>
              <a href="https://maps.google.com/?q=7+Pennsylvania+Plaza+Suite+302+New+York+NY+10001" target="_blank" rel="noreferrer"
                className="pp-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--ouro-e)" }}>◈</span> {ENDERECO}
              </a>
              <a href={SITE_ATUAL} target="_blank" rel="noreferrer" className="pp-card flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--ouro-e)" }}>▤</span> Their current site
              </a>
              <div className="pp-kicker pt-1" style={{ color: "var(--tinta2)" }}>By appointment · we don't overbook</div>
            </div>
          </div>
          <p className="mt-8 border-t pt-4 text-[11.5px]" style={{ borderColor: "var(--linha)", color: "var(--tinta2)" }}>
            ⚡ site + AI by <a href="https://guileoai.com" className="underline" style={{ color: "var(--tinta2)" }}>Guileo</a>
          </p>
        </div>
      </footer>

      <div className="pp-bar sm:hidden">
        <a className="pp-selo pp-selo-forte w-full" href={"tel:" + TEL}><span aria-hidden>☎</span> Call {TEL_FMT}</a>
      </div>
    </div>
  );
}
