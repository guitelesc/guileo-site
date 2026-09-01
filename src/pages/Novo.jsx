import { Suspense, lazy, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import GuiLayer from "../novo/GuiLayer.jsx";
import DonoMode from "../novo/DonoMode.jsx"; // raio-X do dono (?dono=1) — invisível pro cliente final

// ─────────────────────────────────────────────────────────────────────────────
// /novo/:slug — o MOTOR WEBSITE-PORTA. Cada slug é um site reconstruído
// nível-2026 (modelo de referência ou reconstrução real de prospect), hospedado
// num link compartilhável da Guileo. Os modelos são negócios FICTÍCIOS de
// demonstração — cada um com linguagem visual própria (nada clonado).
// Para adicionar um site novo: criar src/novo/<Nome>.jsx e registrar abaixo.
// ─────────────────────────────────────────────────────────────────────────────

/* Páginas de BOOKING da vitrine — o clique mais importante fica no NOSSO domínio (Luis, 25/08).
   Slug sem entrada aqui simplesmente não tem /book: o botão da vitrine só aponta pra cá onde existe. */
const BOOK = {
  "three-degrees": lazy(() => import("../novo/ThreeDegreesBook.jsx")),
  "ws-hairstyling": lazy(() => import("../novo/WSHairstylingBook.jsx")),
  "hair-art-designs": lazy(() => import("../novo/HairArtDesignsBook.jsx")),
  "23rd-street": lazy(() => import("../novo/TwentyThirdStreetBook.jsx")),
  "ny-medical": lazy(() => import("../novo/NYMedicalBook.jsx")),
};

const REGISTRY = {
  "clareza-dental": lazy(() => import("../novo/ClarezaDental.jsx")), // clínica dental — modelo
  "nonstop-plumbers": lazy(() => import("../novo/NonstopPlumbers.jsx")), // PROSPECT REAL — reconstrução nonstopplumbers.com
  "astoria-plumbers": lazy(() => import("../novo/AstoriaPlumbers.jsx")), // PROSPECT REAL — astoriaplumbers.nyc está FORA DO AR (525); ativos vieram do arquivo da web
  "queens-plumber": lazy(() => import("../novo/QueensPlumber.jsx")), // PROSPECT REAL — queensnyplumber.com e um app Lovable inacabado (Google so ve a casca)
  "sideris-plumbing": lazy(() => import("../novo/SiderisPlumbing.jsx")), // PROSPECT REAL — desde 1963, 5 depoimentos publicados e ZERO dado estruturado
  "sr-general": lazy(() => import("../novo/SRGeneral.jsx")), // PROSPECT REAL — DOB certified, brownstone, e o unico JSON-LD deles esta SEM @type
  "three-degrees": lazy(() => import("../novo/ThreeDegrees.jsx")), // PROSPECT REAL — 5,0★/214, digital perm East Village; o site deles se contradiz sobre segunda-feira
  "ws-hairstyling": lazy(() => import("../novo/WSHairstyling.jsx")), // PROSPECT REAL — 5,0★/111, colado na NYU; o botao de agendar do site deles mostra {{ bookingButtonText }} na tela
  "hair-art-designs": lazy(() => import("../novo/HairArtDesigns.jsx")), // PROSPECT REAL — 5,0★/190, Green Circle certified; o link do Instagram deles é literalmente instagram.com/h e o site mostra filler@godaddy.com
  "23rd-street": lazy(() => import("../novo/TwentyThirdStreet.jsx")), // PROSPECT REAL — 23rd Street Hair Salon / Gramercy Park Hair Salon (A.M Hair Design Inc.), 248 E 23rd, Kips Bay; extensões são o carro-chefe, Duneisy a estrela dos reviews; roxo #6C00A8 medido no logo
  "ny-medical": lazy(() => import("../novo/NYMedical.jsx")), // PROSPECT REAL — Dr. Igor Kletsman MD, internal medicine + longevity + aesthetics + supplements; 23 W 45th St Fl 2, NYC 10036 (Midtown), 4,5★/489 no Google; sem preço publicado, horário não confirmado
  "urban-standard": lazy(() => import("../novo/UrbanStandard.jsx")), // PROSPECT REAL — 5,0★, portfolio MLS, e ZERO tel:/mailto:/formulario no site inteiro
  "manhattan-dental": lazy(() => import("../novo/ManhattanDental.jsx")), // PROSPECT REAL — Manhattan Dental Studio, 358 Fifth Ave 10º andar; Dr. Gary S. Tomack + Dra. Cindy Behrens; latão #A47847 MEDIDO nas fotos do consultório (o logo deles é preto puro, não serve de paleta); o 2º número do site é FAX
  "penn-plaza-dental": lazy(() => import("../novo/PennPlazaDental.jsx")), // PROSPECT REAL — hero de BANCO DE IMAGEM vendendo "individualized care"
};

export default function Novo({ book = false }) {
  const { slug } = useParams();

  // O index.html carrega o JSON-LD da GUILEO (Organization/WebSite/Service/FAQPage) em toda
  // rota do SPA. Num site reconstruído de cliente isso é defeito de SEO: o Google leria a
  // página do Nonstop como sendo da Guileo, e ficariam DOIS FAQPage brigando. Aqui os
  // estáticos são desativados enquanto o /novo está montado — e voltam ao sair.
  useEffect(() => {
    // Só os da GUILEO, marcados com data-guileo-global no index.html. Filtrar por tipo
    // derrubaria o schema do cliente (o efeito do filho roda antes do pai) e filtrar por
    // conteúdo também: as imagens DELE estão hospedadas no nosso domínio.
    const statics = Array.from(document.querySelectorAll('script[data-guileo-global]'));
    statics.forEach((el) => { el.type = "application/ld+json-disabled"; });
    return () => statics.forEach((el) => { el.type = "application/ld+json"; });
  }, []);
  const Page = book ? BOOK[slug] : REGISTRY[slug];
  if (!Page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#161512] text-center text-[#C5BEB0]">
        <p className="text-4xl">🏗️</p>
        <p className="text-lg font-black text-[#EDE7DC]">Este link ainda não existe.</p>
        <Link to="/" className="text-sm text-[#3E9468] underline">guileoai.com</Link>
      </div>
    );
  }
  // Cada site tem sua IA com a marca E o mascote DO NEGÓCIO (nunca robozinho genérico).
  const AI = {
    "clareza-dental": { business: "Clareza Dental", label: "Ask Clareza", accent: "#0e6e6a", surface: "#10201f", phone: "+19295550107",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0e6e6a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5.5c-2.2-1.6-5.5-1.3-6.4 1.4-.8 2.4.4 4.6.9 7.2.3 1.7.4 3.9 1.8 3.9 1.3 0 1.4-2.3 2-4 .4-1.2 1.9-1.2 2.3 0 .6 1.7.7 4 2 4 1.4 0 1.5-2.2 1.8-3.9.5-2.6 1.7-4.8.9-7.2-.9-2.7-4.2-3-6.3-1.4Z"/></svg> },
    "nonstop-plumbers": { business: "Nonstop Plumbers", label: "Ask Nonstop", accent: "#d92a28", surface: "#0c1a2e", phone: "+12125672000",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d92a28" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12.5" r="7.5"/><path d="M12 8.5v4.2l2.6 1.6M9 3.2h6"/></svg> },
    // Mascote = a CHAVE DE GRIFO da logo deles, não um robozinho genérico. A marca do painel de IA
    // é a marca do cliente; o crédito da Guileo fica discreto no rodapé.
    // Mascote = o desentupidor do BORDADO deles, o mesmo da camisa da equipe.
    // Mascote = a fiada de tijolos da logo deles.
    /* Mascote = o SKYLINE da logo deles com o dente no lugar de um arranha-céu — é literalmente a
       marca. Latão medido no pixel das fotos do consultório; o logo é preto puro, não vira paleta. */
    "manhattan-dental": { business: "Manhattan Dental Studio", label: "Ask Grace", accent: "#A47847", surface: "#3D2814", phone: "+12126852476",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A47847" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 21V12h3v9M7 21V7.5h3.4V21M12.2 21V10h2.6"/><path d="M18.6 6.6c-1.4-1-3.6-.8-4.1.9-.5 1.5.2 2.9.5 4.5.2 1.1.3 2.5 1.2 2.5.8 0 .9-1.5 1.3-2.6.2-.7 1.2-.7 1.4 0 .4 1.1.5 2.6 1.3 2.6.9 0 1-1.4 1.2-2.5.3-1.6 1-3 .5-4.5-.5-1.7-2.7-1.9-4.1-.9Z"/><path d="M1.5 21h21"/></svg> },
    // Mascote = as ARCADAS art-déco da Penn Station (o conceito: em cima da estação), no azul deles.
    "penn-plaza-dental": { business: "Penn Plaza Dental Center", label: "Ask Ivy", accent: "#00248F", surface: "#001A5C", phone: "+12127360670",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00248F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V11a5 5 0 0 1 10 0v10"/><path d="M8 21v-9a2.6 2.6 0 0 1 4.6-1.6"/><path d="M17 21V9a3 3 0 0 1 3-3"/><path d="M3 21h18"/></svg> },
    "sr-general": { business: "SR General Construction", label: "Ask SR", accent: "#F5A623", surface: "#241C15", phone: "+17184507233",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18M3 15h18M3 5h18M3 19h18M9 5v4M15 9v6M9 15v4"/></svg> },
    "sideris-plumbing": { business: "Sideris Plumbing & Heating", label: "Ask Sideris", accent: "#EB1F39", surface: "#1B2450", phone: "+17186261836",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EB1F39" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4.5h8l-1.2 4.2H9.2L8 4.5Z"/><path d="M12 8.7V20"/></svg> },
    "queens-plumber": { business: "Queens Plumber", label: "Ask Queens", accent: "#F97415", surface: "#0A1F3D", phone: "+19294813200",
      // Mascote = a gota, o elemento do mundo deles ("keep water moving"). Nunca robozinho.
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97415" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2c3.4 4 5.4 6.7 5.4 9.3a5.4 5.4 0 0 1-10.8 0c0-2.6 2-5.3 5.4-9.3Z"/></svg> },
    /* Mascote = o PRÓPRIO 3° da logo deles — o grau é a marca. */
    "three-degrees": { business: "Three Degrees Salon", label: "Ask Three Degrees", accent: "#F5B907", surface: "#1B1A17", phone: "+12122548174",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5B907" strokeWidth="1.9" strokeLinecap="round"><path d="M7 6.2c1.2-1.4 5.6-1.7 5.6 1.3 0 2-1.8 2.8-3.3 2.8 1.5 0 3.8.7 3.8 3 0 3.4-4.9 3.3-6.4 1.6"/><circle cx="17.5" cy="6" r="2.1"/></svg> },
    /* Mascote = a TESOURA, na cor champanhe da logo deles. */
    "ws-hairstyling": { business: "WS Hairstyling NYC", label: "Ask WS", accent: "#DACB96", surface: "#262728", phone: "+12125333344",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DACB96" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M7.6 16.2 18.5 4M16.4 16.2 5.5 4"/></svg> },
    /* Mascote = o CORAÇÃO DE FOLHAS da logo deles, com a tesoura dentro — o motivo botânico é
       a marca inteira: coração de folhagem no logo, ramo florido no papel de parede do salão,
       e "organic beauty is our guiding light" escrito na política. Sálvia medida no pixel. */
    "hair-art-designs": { business: "Hair Art Designs", label: "Ask Hair Art", accent: "#A8C8C0", surface: "#2C3330", phone: "+12123004407",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8C8C0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.5C6.8 16.8 3.5 13.9 3.5 10.2A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 8.5 2.2c0 3.7-3.3 6.6-8.5 10.3Z"/><path d="M12 20.5V9.4" stroke="#D4A078"/><path d="M12 12.4c-1.6-.2-2.6-1.1-2.9-2.6 1.6.2 2.6 1.1 2.9 2.6Zm0 0c1.6-.2 2.6-1.1 2.9-2.6-1.6.2-2.6 1.1-2.9 2.6Z" stroke="#D4A078"/></svg> },
    /* Mascote = uma MECHA de extensão (o carro-chefe deles), na cor roxa medida no logo. Nunca robozinho. */
    "23rd-street": { business: "23rd Street Hair Salon", label: "Ask Remi", accent: "#6C00A8", surface: "#1A1420", phone: "+16468629323",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6C00A8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3.5c0 4 8 5 8 9.5a4 4 0 0 1-8 0"/><path d="M16 3.5c0 4-8 5-8 9.5"/><path d="M9.5 20.5c1.6-1.2 3.4-1.2 5 0"/></svg> },
    /* Mascote = uma folha-batimento: caduceu simplificado (haste + folha + linha de pulso) na cor
       teal deles. Medicina que cuida da longevidade — nunca robozinho. */
    "ny-medical": { business: "NY Medical", label: "Ask Remy", accent: "#0E4F4F", surface: "#052E2E", phone: "+12129882924",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E4F4F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V8"/><path d="M12 8c-2.4-.2-3.8-1.6-4.2-4 2.4.2 3.8 1.6 4.2 4Zm0 0c2.4-.2 3.8-1.6 4.2-4-2.4.2-3.8 1.6-4.2 4Z"/><path d="M4 15h3l1.4-2.4L10.6 17l1.6-3 1.2 2h4.6" stroke="#C89660"/></svg> },
    /* Mascote = o VOLUME da logo deles, partido nas duas faces reais (âmbar e azul). */
    "urban-standard": { business: "Urban Standard", label: "Ask Urban Standard", accent: "#E09327", surface: "#141517", phone: "+17186690526",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 9.6 11.6 5v13.2L3.4 16.4V9.6Z" fill="#FBB856"/><path d="M12.4 5l8.2 4.6v6.8l-8.2 1.8V5Z" fill="#2983C7"/></svg> },
    "astoria-plumbers": { business: "Astoria Plumbers", label: "Ask Astoria", accent: "#39FF14", surface: "#0B0C4C", phone: "+16469191074",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3.5a3.2 3.2 0 0 0 .6 4.3L17 17.2M5.6 6.1 8.4 3.3M14.8 14.3l3.9 3.9a2 2 0 0 1-2.8 2.8l-3.9-3.9"/></svg> },
  };
  const cfg = AI[slug] || { business: "this business", label: "Ask us", accent: "#3E9468" };
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0e0d0b] text-[#948C7B]">…</div>}>
      <Page />
      <GuiLayer {...cfg} slug={slug} />
      <DonoMode business={cfg.business} accent={cfg.accent} surface={cfg.surface} mascot={cfg.mascot} upgradeUrl={typeof window !== "undefined" ? window.location.href.split("?")[0] : ""} />
    </Suspense>
  );
}
