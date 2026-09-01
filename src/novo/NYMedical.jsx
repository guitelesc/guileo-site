/* ══════════════════════════════════════════════════════════════════════════════════════════════
   NY MEDICAL MIDTOWN — Dr. Igor Kletsman, MD · 23 W 45th St, Floor 2, New York, NY 10036
   ══════════════════════════════════════════════════════════════════════════════════════════════
   RECONSTRUÍDA em 28/08 depois da reprovação do Luis: «tira essa estrutura de salão, lembra que
   é CLÍNICA MÉDICA», «está faltando informações, localidade, endereço», «falta originalidade».
   Ele estava certo nas três. A v1 nasceu clonada de HairArtDesigns.jsx e herdou o OSSO do salão
   (cardápio de serviços primeiro, "os artistas", prova nenhuma) — e eu OMITI o endereço em vez
   de pesquisar, que é exatamente o defeito que ossos.md §🩺 proíbe.

   O QUE MUDOU NO OSSO (agora segue _sistema/ossos.md §🩺 CLÍNICA, nesta ordem):
     hero → CREDENCIAIS → ONDE FICA → o MÉDICO → o que trata → LOGÍSTICA → protocolos →
     a agente → agendar → o espaço → FAQ
   Contra a v1: a prova (4,5★/489) e a LOCALIZAÇÃO subiram para o alto da página; o cardápio de
   serviços desceu do 1º para o 4º lugar; nasceu a seção de logística (o que tira o medo de
   marcar); o rodapé passou a carregar o endereço COMPLETO.

   MEDIDO / PESQUISADO, NUNCA INVENTADO:
   • Nome no Google: "NY Medical Midtown, Igor Kletsman MD". A marca na página é NY Medical.
   • Endereço real: 23 W 45th St, Floor 2, New York, NY 10036 · lat 40.7560743 / lng -73.9804839
     · place_id ChIJOWXfTcdYwokR_62B-ktFqhg. Midtown, entre a 5ª e a 6ª Avenidas.
   • 4,5 ★ · 489 avaliações no Google → agora o aggregateRating do JSON-LD é LEGÍTIMO.
   • Telefone (212) 988-2924. Site deles igorkletsmanmd.com. Loja /supplement-protocols/.
   • HORÁRIO: continua DESCONHECIDO. A v1 inventava "9–5, seg–sex" e o selo dizia "Open now"
     num domingo. Agora useRelogio() roda SEM horário: mostra a hora de NY e a página diz
     "by appointment" — que é verdade. Inventar a porta é o mesmo defeito de inventar preço.
   • SEM PREÇO em lugar nenhum, inclusive nos suplementos. Clínica cota na consulta.
   • Nada de alegação médica: "support", nunca cure/treat/diagnose. A linguagem é a DELES.
   • SEGURO: não temos a lista. A página diz que a equipe confirma a cobertura — e não lista
     nenhuma seguradora, porque não sabemos nenhuma.

   O SISTEMA: material, selo, cartão, cortina, reveal, fita, chips, campos vêm de
   _sistema/vitrine.css.js. Os hooks vêm de _sistema/vitrine.js. O <style> literal abaixo só
   carrega o que é DESTA página (o localizador de protocolos, o mapa de Midtown, as ondas).
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useCallback } from "react";
import { sistemaCss } from "./_sistema/vitrine.css.js";
import { useReveal, useAbertura, useRelogio, useSeo, useCaptura, ruaCurta } from "./_sistema/vitrine.js";

const TEL = "+12129882924";
const TEL_FMT = "(212) 988-2924";
const SITE_DELES = "https://igorkletsmanmd.com";
const SUPP_URL = "https://igorkletsmanmd.com/supplement-protocols/";
const B = "/novo/ny-medical";
const SITE_URL = "https://guileoai.com/novo/ny-medical";

/* 🚩 O DADO QUE FALTAVA. Endereço real, pesquisado — não omitido. */
const ENDERECO = "23 W 45th St, Floor 2, New York, NY 10036";
const RUA = "23 W 45th St";
const ANDAR = "Floor 2";
const CIDADE = "New York, NY 10036";
const MAPA_URL = "https://maps.google.com/?q=23+W+45th+St+New+York+NY+10036";
const LAT = 40.7560743;
const LNG = -73.9804839;

/* Prova social real do Google — a v1 não mostrava nenhuma. */
const NOTA = "4.5";
const AVALIACOES = 489;

/* Os TOKENS desta marca, medidos no material deles. Teal petróleo + a família do dourado. */
const TOKENS = {
  marca: "#0E4F4F", marcaClara: "#1A7A7A", marcaEscura: "#052E2E",
  acento: "#C89660", acentoLuz: "#D9B27C", acentoClaro: "#E8D5B0", acentoSombra: "#8A5E2E",
  papel: "#F5F7F6", papel2: "#E9EEEC", tinta: "#10201E", prefixo: "nm",
};

/* O reveal precisa enxergar, além do padrão, o pulso do rodapé e as ruas do mapa.
   Constante de módulo: useReveal tem o seletor nas dependências. */
const ALVO_REVEAL = ".nm-rev, .nm-filete-liga, .nm-pulse-draw";

/* CREDENCIAIS — o que o paciente pesa antes de ligar (ossos.md §🩺 passo 2). */
const CREDENCIAIS = [
  ["Internal medicine", "Dr. Kletsman is an internist working with adult patients in New York City."],
  ["Same-day appointments", "Primary care that does not make you wait a fortnight for a first look."],
  ["Testing on site", "Bloodwork and testing happen in the practice, not across town."],
  ["Telehealth", "A visit can start from wherever you are, and continue in person when it should."],
  ["A multidisciplinary team", "One appointment can pull in the right people without you going looking."],
  ["A personalized care plan", "The plan is built around your own results, not a template."],
];

/* COMO CHEGAR — marcos reais de Midtown. Nada de linha de metrô inventada. */
const MARCOS = [
  "Between Fifth and Sixth Avenues",
  "One block from Bryant Park",
  "A short walk from Grand Central",
  "A short walk from Times Sq–42nd St",
];

/* AS 5 PERNAS. Sem preço — eles não publicam, e clínica cota na consulta. */
const SERVICOS = [
  { nome: "Primary Care", cauda: "The foundation",
    d: "Preventive primary care with a full assessment, diagnosis and treatment. Same-day appointments, testing on site, telehealth, a multidisciplinary care team and a personalized care plan.",
    tags: ["Same-day", "Testing on site", "Telehealth"] },
  { nome: "Hormones & Longevity", cauda: "Feeling well, measured",
    d: "Bioidentical Hormone Replacement Therapy (BHRT), Growth Hormone Therapy, and comprehensive hormone support for women and men — built around your own bloodwork.",
    tags: ["BHRT", "Growth Hormone", "Women's & Men's"] },
  { nome: "Body Treatments", cauda: "Non-invasive",
    d: "Emsculpt Neo, Emsella and Cellutone — device-based body treatments delivered under the care of the practice.",
    tags: ["Emsculpt Neo", "Emsella", "Cellutone"] },
  { nome: "Weight Loss Program", cauda: "Medically guided",
    d: "A weight loss program run and monitored by the care team, planned to your body and your goals.",
    tags: ["Personalized", "Monitored"] },
  { nome: "PrEP", cauda: "HIV prevention",
    d: "HIV prevention with a personalized PrEP consultation and ongoing monitoring, handled discreetly by the team.",
    tags: ["Consultation", "Monitoring"] },
];

/* LOGÍSTICA QUE TIRA O MEDO (ossos.md §🩺 passo 6). O item do seguro é HONESTO: não temos a
   lista de planos, então a página promete a checagem — e não nomeia nenhuma seguradora. */
const LOGISTICA = [
  ["Can I be seen today?", "Same-day appointments are part of how the practice runs primary care. Call and the front desk tells you what is open today."],
  ["Do I have to come in?", "Not always. Telehealth visits are part of the practice, so a lot can start from home and continue in person when it should."],
  ["Where do the tests happen?", "On site. Testing is done in the practice at 23 W 45th St, which keeps a first visit to one address."],
  ["Who else will I see?", "A multidisciplinary care team stands behind the plan, so one appointment can bring in the right people."],
  ["Will the plan be mine?", "The care plan is personalized — built on your own assessment and results as your needs evolve with age."],
  ["What about my insurance?", "The team confirms your coverage before the visit. Ask when you call and they check it against your plan rather than guess on a web page."],
];

/* ⭐ OS 17 PROTOCOLOS DE SUPLEMENTO — verbatim do Dr. Kletsman. Ícone de SISTEMA/ÓRGÃO em SVG
   (nunca emoji, nunca robô). "support" em tudo, jamais cure/treat/diagnose. */
const PROTOCOLOS = [
  ["ADHD & Anxiety Support", "brain",
    "A curated protocol Dr. Kletsman uses to support focus and a calmer baseline."],
  ["Blood Pressure Support", "heart",
    "Vetted supplements the practice reaches for to support healthy blood pressure."],
  ["Cortisol Support", "adrenal",
    "Chosen to support a balanced cortisol rhythm across the day."],
  ["Digestive Support", "stomach",
    "A protocol to support digestion and a settled gut."],
  ["Headache Support", "headbolt",
    "Supplements the practice curates to support fewer, easier days."],
  ["Stress & Adrenal Support", "wave",
    "Selected to support the body under sustained stress."],
  ["Detox Support", "droplet",
    "A gentle protocol to support the body's own clearance pathways."],
  ["Eye & Vision Support", "eye",
    "Vetted to support long-term eye and vision health."],
  ["Men's Libido Support", "mars",
    "A men's protocol to support drive and vitality."],
  ["Women's Comprehensive Hormone Support", "venus",
    "The women's hormone protocol, matched to where you are."],
  ["Natural Skincare", "leaf",
    "Supplements the practice uses to support skin from the inside."],
  ["Inflammation Support", "flame",
    "Curated to support a calmer inflammatory response."],
  ["Neurological Support", "nerve",
    "A protocol to support nerve and cognitive health."],
  ["Prostate Support", "shield",
    "Vetted to support prostate health over time."],
  ["Thyroid Support", "thyroid",
    "Selected to support healthy thyroid function."],
  ["Sleep Support", "moon",
    "A protocol to support deeper, steadier sleep."],
  ["Joint Support", "joint",
    "Curated to support joint comfort and mobility."],
];

const Icone = ({ tipo }) => {
  const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  const svg = (kids) => <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...P}>{kids}</svg>;
  switch (tipo) {
    case "brain": return svg(<><path d="M12 5.5c-1.6-1.4-4.6-.8-4.6 1.6-1.7.3-1.9 2.6-.6 3.4-1 1.2-.2 3.2 1.5 3.1.1 1.7 2.1 2.3 3.7 1.4" /><path d="M12 5.5c1.6-1.4 4.6-.8 4.6 1.6 1.7.3 1.9 2.6.6 3.4 1 1.2.2 3.2-1.5 3.1-.1 1.7-2.1 2.3-3.7 1.4" /><path d="M12 5.5v11.4" /></>);
    case "heart": return svg(<><path d="M12 19.5C7 16 4 13.4 4 9.9A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 8 1.9c0 3.5-3 6.1-8 9.6Z" /><path d="M7 11.5h2l1.3-2 1.6 3.4 1.1-1.4H17" /></>);
    case "adrenal": return svg(<><path d="M7.5 6c2.6 0 3.4 1.8 3.4 4 0 2.6-1.5 4-3.6 4S4 12.4 4 10.4 5 6 7.5 6Z" /><path d="M16.5 6c-2.6 0-3.4 1.8-3.4 4 0 2.6 1.5 4 3.6 4S20 12.4 20 10.4 19 6 16.5 6Z" /></>);
    case "stomach": return svg(<><path d="M9 4v3.2c0 1 .7 1.4 1.7 1.6 3 .5 5 2.2 5 5.1 0 3.2-2.4 5.1-5.3 5.1-2.4 0-4.4-1.3-5-3.4" /><path d="M9 4H7" /></>);
    case "headbolt": return svg(<><path d="M15.5 20v-3.2c2-1 3.3-3 3.3-5.4A6.8 6.8 0 0 0 5.5 11c0 1.4.6 2.6 1.4 3.4.7.7 1 1.1 1 2.2V20" /><path d="M12 8.5 10 12h2.4l-1.4 3" /></>);
    case "wave": return svg(<><path d="M3 12c1.5-3 3-3 4.5 0S10.5 15 12 12s3-3 4.5 0S19.5 9 21 12" /><path d="M3 16c1.5-2.4 3-2.4 4.5 0" opacity=".5" /></>);
    case "droplet": return svg(<><path d="M12 3.5c3.3 4 5.2 6.4 5.2 8.9a5.2 5.2 0 0 1-10.4 0c0-2.5 1.9-4.9 5.2-8.9Z" /><path d="M9 13.5c.3 1.4 1.3 2.3 2.7 2.6" opacity=".6" /></>);
    case "eye": return svg(<><path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" /></>);
    case "mars": return svg(<><circle cx="10" cy="14" r="5" /><path d="M14 10l5-5m-4 0h4v4" /></>);
    case "venus": return svg(<><circle cx="12" cy="9" r="5" /><path d="M12 14v6m-3-3h6" /></>);
    case "leaf": return svg(<><path d="M5 19c0-8 5-13 14-13 0 9-5 14-14 13Z" /><path d="M5 19c3-5 6-7 10-8.5" opacity=".6" /></>);
    case "flame": return svg(<><path d="M12 3.5c1 3-1.5 4-1.5 6.5 0 1 .6 1.7 1.5 1.7s1.5-.7 1.5-1.7c1.4 1.2 2.5 3 2.5 5a4 4 0 0 1-8 0c0-3.6 2.5-4.9 3.5-11.5Z" /></>);
    case "nerve": return svg(<><path d="M8 3c-2 0-3 1.5-3 3.5S7 10 7 12s-2 2.5-2 4.5S6 20 8 20" /><circle cx="16" cy="6" r="1.4" /><circle cx="18" cy="12" r="1.4" /><circle cx="15" cy="18" r="1.4" /><path d="M9 6.5h5.6M9 12h7.6M9 17.3h4.6" opacity=".6" /></>);
    case "shield": return svg(<><path d="M12 3.5 19 6v5c0 4.5-3 7.5-7 9.5-4-2-7-5-7-9.5V6l7-2.5Z" /><path d="M9.2 12l1.9 1.9 3.7-3.9" opacity=".7" /></>);
    case "thyroid": return svg(<><path d="M12 8c-1 2.5-2.4 4-4.4 4-1.8 0-3-1.3-3-3.2 0-1.8 1.1-3 2.8-3C10 5.6 11 6.5 12 8Z" /><path d="M12 8c1 2.5 2.4 4 4.4 4 1.8 0 3-1.3 3-3.2 0-1.8-1.1-3-2.8-3C14 5.6 13 6.5 12 8Z" /><path d="M12 8v7" /></>);
    case "moon": return svg(<><path d="M18 14.5A7 7 0 0 1 9.5 6a5.6 5.6 0 0 0-2 4.3A6.2 6.2 0 0 0 18 14.5Z" /></>);
    case "joint": return svg(<><path d="M6 6c2.4-.4 3.6.8 3.2 3.2M6 6c-.4-2.4.8-3.6 3.2-3.2" /><path d="M18 18c-2.4.4-3.6-.8-3.2-3.2M18 18c.4 2.4-.8 3.6-3.2 3.2" /><path d="M9.2 9.2l5.6 5.6" /></>);
    default: return svg(<circle cx="12" cy="12" r="8" />);
  }
};

/* ══ O MAPA-MOTIVO DE MIDTOWN ═══════════════════════════════════════════════════════════════
   A ORIGINALIDADE desta vitrine (Luis: «falta originalidade»). Uma clínica de Midtown tem o
   ENDEREÇO como argumento, então a malha de ruas vira o sistema visual da página — e não uma
   decoração genérica de salão.
   HONESTO POR CONSTRUÇÃO: é um desenho esquemático, feito de linhas, com o aviso na própria
   arte. Não é foto de mapa, não é imagem de banco, não finge escala. Os únicos pontos marcados
   são os que a pesquisa confirmou: a 45 entre a 5ª e a 6ª, Bryant Park, Grand Central e
   Times Sq–42nd. ═══════════════════════════════════════════════════════════════════════════ */
const AVENIDAS = [["Sixth Ave", 170], ["Fifth Ave", 330], ["Madison", 480], ["Park Ave", 620]];
const RUAS = [["W 47th", 70], ["W 46th", 125], ["W 45th", 180], ["W 44th", 235], ["W 43rd", 290], ["W 42nd", 345]];

const MapaMidtown = () => (
  <svg className="nm-mapa" viewBox="0 0 780 462" role="img"
    aria-label="Schematic of the Midtown street grid: the practice sits on West 45th Street between Fifth and Sixth Avenues, one block from Bryant Park, a short walk from Grand Central and Times Square–42nd Street.">
    {/* as avenidas */}
    {AVENIDAS.map(([nome, x]) => (
      <g key={nome}>
        <line x1={x} y1="36" x2={x} y2="412" className="nm-via" />
        <text x={x} y="26" textAnchor="middle" className="nm-mapa-rot">{nome}</text>
      </g>
    ))}
    {/* as ruas */}
    {RUAS.map(([nome, y]) => (
      <g key={nome}>
        <line x1="110" y1={y} x2="752" y2={y} className={"nm-via" + (nome === "W 45th" ? " nm-via-nossa" : "")} />
        <text x="98" y={y + 4} textAnchor="end" className={"nm-mapa-rot" + (nome === "W 45th" ? " nm-mapa-rot-forte" : "")}>{nome}</text>
      </g>
    ))}
    {/* Bryant Park — um quarteirão abaixo da 42, entre a 5ª e a 6ª */}
    <rect x="170" y="345" width="160" height="62" rx="6" className="nm-parque" />
    <text x="250" y="381" textAnchor="middle" className="nm-mapa-rot">Bryant Park</text>
    {/* Grand Central, na Park com a 42 */}
    <circle cx="620" cy="345" r="5" className="nm-marco" />
    <text x="608" y="332" textAnchor="end" className="nm-mapa-rot">Grand Central</text>
    {/* Times Sq–42nd, a oeste */}
    <circle cx="120" cy="345" r="5" className="nm-marco" />
    <text x="114" y="332" textAnchor="start" className="nm-mapa-rot">Times Sq–42nd</text>
    {/* AQUI. O ponto de acento na 45, entre a 6ª (170) e a 5ª (330). */}
    <circle cx="250" cy="180" r="13" className="nm-halo" />
    <circle cx="250" cy="180" r="6" className="nm-aqui" />
    <text x="250" y="158" textAnchor="middle" className="nm-mapa-aqui">{RUA} · 2nd Fl</text>
    {/* norte — na faixa vazia abaixo da grade, longe dos rótulos das avenidas */}
    <g className="nm-mapa-rot">
      <line x1="730" y1="456" x2="730" y2="428" className="nm-via" />
      <path d="M730 424 l-5 9 h10 Z" fill="currentColor" stroke="none" />
      <text x="730" y="416" textAnchor="middle">N</text>
    </g>
    <text x="110" y="452" textAnchor="start" className="nm-mapa-nota">Schematic — not to scale</text>
  </svg>
);

/* O QUE A REMY FAZ — cada linha é função que ela JÁ executa. */
const FUNCOES = [
  ["Answers day and night", "The line rings at 11pm on a Sunday. Remy picks up in the practice's name and knows every service."],
  ["Gives the address and the floor", "Callers ask where you are before they ask anything else. She says 23 W 45th St, second floor, between Fifth and Sixth."],
  ["Points to the right protocol", "Tell her what you're dealing with and she names the supplement protocol Dr. Kletsman vetted for it — then hands you the link."],
  ["Books the consultation", "Same-day, telehealth or in person. Name, reason, when — it reaches the front desk with everything asked."],
  ["Calls the lead back", "Leave a number on this page and the phone rings back. That is not a mock-up — the form below does it."],
  ["Never gives medical advice", "No diagnosis, no dose, no cost. When it's clinical: \"Dr. Kletsman's team confirms that — let me get you in.\""],
];

const CANAIS = [
  { id: "phone", rot: "Call me", ico: "☎" },
  { id: "text", rot: "Text me", ico: "✉" },
  { id: "email", rot: "Email me", ico: "✱" },
];

const ESPACO = [
  ["gallery-1.jpg", "The team under the NY Medical letters"],
  ["gallery-2.jpg", "Three of the physicians at reception"],
  ["gallery-3.jpg", "Reception — brick, brass and light"],
  ["gallery-4.jpg", "An exam room in use"],
  ["gallery-5.jpg", "The front desk"],
  ["gallery-6.jpg", "The waiting room"],
  ["gallery-7.jpg", "A consultation room"],
];

/* TROCA DE CENA — onda rasa na cor da seção SEGUINTE. Sem biblioteca: path inline. */
const Onda = ({ cor, flip }) => (
  <div className="nm-onda" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
    <svg viewBox="0 0 1440 60" preserveAspectRatio="none" focusable="false">
      <path d="M0,60 L0,30 C220,4 430,50 720,36 C1000,22 1230,-8 1440,10 L1440,60 Z" fill={cor} />
    </svg>
  </div>
);

const FAQ = [
  ["Where exactly is the practice?", "23 W 45th St, Floor 2, New York, NY 10036 — Midtown, between Fifth and Sixth Avenues, one block from Bryant Park and a short walk from both Grand Central and Times Sq–42nd St."],
  ["Do you offer same-day appointments?", "Yes — same-day primary care is part of the practice, alongside on-site testing and telehealth. Call " + TEL_FMT + " and the front desk will tell you what's open today."],
  ["Can I be seen by telehealth?", "Yes. The practice runs telehealth visits as well as in-person care, so a lot can start from wherever you are."],
  ["Do you take my insurance?", "The team confirms your coverage before your visit — ask when you call and they'll check it against your plan rather than guess here."],
  ["Are the supplements a treatment?", "No. They are protocols Dr. Kletsman curates to support specific areas of health. Anything clinical — a diagnosis, a medication, a dose — is confirmed by the doctor's team, not by a page or an assistant."],
];

const TITULO = "NY Medical Midtown — Dr. Igor Kletsman MD · 23 W 45th St, New York NY 10036";
const DESC = "Dr. Igor Kletsman, MD — internal medicine at 23 W 45th St, Floor 2, Midtown Manhattan, between Fifth and Sixth Avenues. Rated 4.5 from 489 Google reviews. Same-day primary care, testing on site, telehealth, hormones & longevity, body treatments, weight loss, PrEP and vetted supplement protocols. Call (212) 988-2924.";
const META = [
  ["name", "description", DESC],
  ["property", "og:title", TITULO],
  ["property", "og:description", DESC],
  ["property", "og:type", "website"],
  ["property", "og:url", SITE_URL],
  ["property", "og:image", "https://guileoai.com" + B + "/hero-poster.jpg"],
  ["name", "twitter:card", "summary_large_image"],
];

/* JSON-LD. Agora COM PostalAddress (endereço pesquisado) e COM aggregateRating (4,5 de 489 no
   Google — contagem real). A v1 omitia os dois: um por preguiça, o outro por falta de dado. */
const LD = () => ([
  {
    "@context": "https://schema.org", "@type": "Physician",
    name: "NY Medical Midtown — Dr. Igor Kletsman MD",
    url: SITE_URL, telephone: TEL,
    image: "https://guileoai.com" + B + "/hero-poster.jpg",
    medicalSpecialty: "InternalMedicine",
    address: {
      "@type": "PostalAddress",
      streetAddress: RUA + ", " + ANDAR,
      addressLocality: "New York", addressRegion: "NY",
      postalCode: "10036", addressCountry: "US",
    },
    geo: { "@type": "GeoCoordinates", latitude: LAT, longitude: LNG },
    hasMap: MAPA_URL,
    areaServed: "New York, NY",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: NOTA, reviewCount: AVALIACOES, bestRating: "5",
    },
    availableService: SERVICOS.map((s) => ({ "@type": "MedicalProcedure", name: s.nome })),
  },
  {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q,
      acceptedAnswer: { "@type": "Answer", text: a } })),
  },
]);

const Titulo = ({ n, children, sub, claro }) => (
  <div className="nm-rev nm-cap">
    <span className={claro ? "nm-num-liga" : "nm-num"}>{n}</span>
    <h2 className="nm-vogue mt-1 font-medium" style={{ fontSize: "clamp(28px,5vw,46px)", lineHeight: 1.04, letterSpacing: "-.015em", color: claro ? "#fff" : "var(--tinta)" }}>
      {children}
    </h2>
    {sub && <p className="mt-2.5 max-w-[42rem] text-[15px] leading-relaxed" style={{ color: claro ? "rgba(255,255,255,.72)" : "var(--tinta2)" }}>{sub}</p>}
    <hr className="nm-filete mt-5" style={claro ? { background: "rgba(255,255,255,.2)" } : undefined} />
  </div>
);

/* As estrelas da nota — desenhadas, com a meia estrela recortada por clipPath. */
const Estrelas = ({ nota }) => {
  const cheio = Math.floor(nota);
  const meia = nota - cheio >= 0.25;
  const d = "M12 2.6l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.6 6.4 19.8l1.3-6.3L2.9 9.2l6.4-.7z";
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width="20" height="20" className="nm-estrela">
          <path d={d} className="nm-estrela-vazia" />
          {i < cheio && <path d={d} className="nm-estrela-cheia" />}
          {i === cheio && meia && (
            <g><clipPath id={"nm-meia-" + i}><rect x="0" y="0" width="12" height="24" /></clipPath>
              <path d={d} className="nm-estrela-cheia" clipPath={"url(#nm-meia-" + i + ")"} /></g>
          )}
        </svg>
      ))}
    </span>
  );
};

export default function NYMedical() {
  const [form, setForm] = useState({ nome: "", tel: "", motivo: "", quando: "" });
  const [canal, setCanal] = useState("phone");
  const [passo, setPasso] = useState(0);
  const [outro, setOutro] = useState({ motivo: false, quando: false });
  const [livre, setLivre] = useState({ motivo: "", quando: "", recado: "" });
  const [aberto, setAberto] = useState(null);
  const [prot, setProt] = useState(0);

  const raizRef = useReveal("nm", ALVO_REVEAL);
  const { cortina, abriu } = useAbertura();
  /* SEM horário: a fonte não confirma nenhum. O relógio informa a hora de NY e a página diz
     "by appointment", que é verdade. A v1 inventava 9–5 seg–sex e mentia aos domingos. */
  const rel = useRelogio(null);
  useSeo({ titulo: TITULO, meta: META, ld: LD });
  const { enviado, erro, enviar: enviarLead } = useCaptura("ny-medical", "NY Medical Midtown");

  const escolher = useCallback((campo, valor) => setForm((f) => ({ ...f, [campo]: valor })), []);

  const enviar = useCallback(async (e) => {
    e.preventDefault();
    const motivo = outro.motivo ? livre.motivo : form.motivo;
    const quando = outro.quando ? livre.quando : form.quando;
    await enviarLead({
      nome: form.nome, telefone: form.tel, fallbackTel: TEL_FMT,
      mensagem: "[" + (motivo || "reason?") + "] " + (quando || "any time")
        + " · reply on " + canal + (livre.recado ? " · note: " + livre.recado : ""),
    });
  }, [form, canal, outro, livre, enviarLead]);

  const podeAvancar = passo === 0 ? !!(form.motivo || livre.motivo)
    : passo === 1 ? !!(form.quando || livre.quando)
    : !!(form.nome.trim() && form.tel.trim());

  const protAtivo = PROTOCOLOS[prot];

  return (
    <div className="nm-raiz" ref={raizRef}>
      <style>{sistemaCss(TOKENS)}</style>
      <style>{`
        /* ══ SÓ O QUE É DESTA PÁGINA ═══════════════════════════════════════════════════════
           Material, selo, cartão, cortina, reveal, fita, chips e campos vêm do sistema.
           Aqui mora o que só existe numa clínica de Midtown: o mapa, o localizador de
           protocolos, as ondas de cena e a nota do Google em corpo editorial. */

        /* ── (1) O MAPA DE MIDTOWN — o conceito da página ────────────────────────────────── */
        .nm-mapa{width:100%; height:auto; display:block; color:var(--marca-clara);}
        .nm-via{stroke:currentColor; stroke-width:1.1; opacity:.42; stroke-linecap:round;}
        .nm-via-nossa{stroke:var(--acento-sombra); stroke-width:2.2; opacity:1;}
        .nm-mapa-rot{font-family:'IBM Plex Mono',monospace; font-size:13px; letter-spacing:.1em;
          text-transform:uppercase; fill:var(--tinta3); color:var(--tinta3);}
        .nm-mapa-rot-forte{fill:var(--acento-sombra); font-weight:500;}
        .nm-mapa-nota{font-family:'IBM Plex Mono',monospace; font-size:11px; fill:var(--tinta3); opacity:.8;}
        .nm-mapa-aqui{font-family:'Bodoni Moda',Didot,serif; font-size:19px; fill:var(--tinta); font-weight:500;}
        .nm-parque{fill:color-mix(in srgb, var(--marca-clara) 15%, transparent);
          stroke:color-mix(in srgb, var(--marca-clara) 40%, transparent); stroke-width:1;}
        .nm-marco{fill:var(--branco); stroke:var(--marca-clara); stroke-width:2;}
        .nm-aqui{fill:var(--acento); stroke:var(--acento-sombra); stroke-width:1.5;}
        .nm-halo{fill:color-mix(in srgb, var(--acento) 26%, transparent);}
        .nm-anima .nm-halo{transform-box:fill-box; transform-origin:center;
          animation:nm-halo 2.8s cubic-bezier(0,0,.2,1) infinite;}
        @keyframes nm-halo{0%{transform:scale(.7);opacity:.85}80%,100%{transform:scale(1.9);opacity:0}}

        /* ── (2) A NOTA DO GOOGLE em corpo editorial ─────────────────────────────────────── */
        .nm-estrela{display:block;}
        .nm-estrela-vazia{fill:color-mix(in srgb, var(--acento) 22%, transparent);}
        .nm-estrela-cheia{fill:var(--acento);}
        .nm-nota{font-family:'Bodoni Moda',Didot,serif; font-weight:500; line-height:.86;
          font-size:clamp(72px,13vw,132px); letter-spacing:-.03em; color:var(--marca);}

        /* ── (3) O LOCALIZADOR DE PROTOCOLO (vive sobre o painel escuro) ─────────────────── */
        .nm-cond{position:relative; overflow:hidden; display:flex; flex-direction:column;
          align-items:flex-start; gap:9px; min-height:104px; padding:14px; border-radius:14px;
          text-align:left; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12);
          color:rgba(255,255,255,.82); transition:border-color .2s, background .2s, transform .12s;}
        .nm-cond::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
          background:linear-gradient(140deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 46%);}
        .nm-cond:hover{border-color:color-mix(in srgb, var(--acento) 60%, transparent);
          background:rgba(255,255,255,.07); transform:translateY(-2px);
          box-shadow:0 14px 28px -18px rgba(0,0,0,.7);}
        .nm-cond[data-on="1"]{border-color:var(--acento); color:#fff;
          background:linear-gradient(160deg,color-mix(in srgb, var(--acento) 20%, transparent),color-mix(in srgb, var(--acento) 7%, transparent));
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--acento-claro) 30%, transparent),
                     0 16px 32px -20px color-mix(in srgb, var(--acento) 60%, transparent);}
        .nm-cond[data-on="1"]::before{content:""; position:absolute; left:0; top:14px; bottom:14px;
          width:2px; border-radius:2px; background:var(--liga);}
        /* A PLACA DO ÍCONE: o traço de 1,5px sozinho no painel escuro sumia. */
        .nm-cond .nm-ico{display:grid; place-items:center; width:44px; height:44px; border-radius:999px;
          color:var(--acento-claro);
          background:radial-gradient(120% 120% at 30% 20%,color-mix(in srgb, var(--acento-claro) 22%, transparent),color-mix(in srgb, var(--acento) 7%, transparent) 60%,transparent 100%);
          border:1px solid color-mix(in srgb, var(--acento) 38%, transparent);
          box-shadow:inset 0 1px 0 color-mix(in srgb, var(--acento-claro) 45%, transparent),
                     inset 0 -2px 6px rgba(0,0,0,.35), 0 2px 10px -4px rgba(0,0,0,.5);
          transition:border-color .25s, box-shadow .25s, transform .25s, color .25s;}
        .nm-cond:hover .nm-ico{transform:translateY(-1px) scale(1.04);}
        .nm-cond[data-on="1"] .nm-ico{color:#1A1206; border-color:var(--acento-claro); background:var(--liga);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.5), inset 0 -2px 6px rgba(90,60,20,.4),
                     0 0 0 4px color-mix(in srgb, var(--acento) 16%, transparent),
                     0 6px 18px -6px color-mix(in srgb, var(--acento) 55%, transparent);}
        .nm-ico-vitrine{display:grid; place-items:center; width:46px; height:46px; border-radius:999px;
          color:#1A1206; background:var(--liga); border:1px solid var(--acento-claro);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.5), inset 0 -2px 6px rgba(90,60,20,.4),
                     0 0 0 4px color-mix(in srgb, var(--acento) 14%, transparent),
                     0 8px 20px -8px color-mix(in srgb, var(--acento) 60%, transparent);}

        /* ── (4) SOBRE O FILME: chip de vidro e anel da liga ─────────────────────────────── */
        .nm-vidro{display:inline-flex; align-items:center; gap:9px; min-height:38px; padding:0 15px;
          border-radius:999px; background:rgba(4,18,17,.42); backdrop-filter:blur(8px);
          border:1px solid color-mix(in srgb, var(--acento-claro) 34%, transparent);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.14), 0 12px 26px -18px rgba(0,0,0,.85);}
        .nm-selo-liga::before{content:""; position:absolute; inset:0; border-radius:inherit; padding:1.5px;
          background:var(--liga); pointer-events:none; z-index:2;
          -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite:xor; mask-composite:exclude;}
        .nm-liga-filme{filter:drop-shadow(0 3px 20px rgba(0,0,0,.72));}
        .nm-creds{display:flex; flex-wrap:wrap; align-items:center;}
        .nm-creds > span{position:relative; padding:4px 15px;}
        .nm-creds > span:first-child{padding-left:0;}
        .nm-creds > span + span::before{content:""; position:absolute; left:0; top:50%; width:1px;
          height:13px; transform:translateY(-50%); opacity:.75;
          background:linear-gradient(180deg,transparent,var(--acento-luz),transparent);}
        @media (max-width:639px){
          .nm-creds > span{padding:3px 0; margin-right:16px;}
          .nm-creds > span + span::before{display:none;}
          .nm-so-larga{display:none !important;}
        }

        /* ── (5) CAPA DE SEÇÃO com stagger próprio: número → título → sub → filete ───────── */
        .nm-anima .nm-cap > *{opacity:0; transform:translateY(10px);
          transition:opacity .6s ease, transform .6s ease;}
        .nm-anima .nm-cap.is-in > *{opacity:1; transform:none;}
        .nm-anima .nm-cap.is-in > *:nth-child(2){transition-delay:.09s}
        .nm-anima .nm-cap.is-in > *:nth-child(3){transition-delay:.18s}
        .nm-anima .nm-cap > hr{transform:scaleX(0); transform-origin:left center;
          transition:opacity .5s ease, transform .9s cubic-bezier(.2,.7,.2,1);}
        .nm-anima .nm-cap.is-in > hr{transform:scaleX(1); transition-delay:.26s;}

        /* ── (6) O ITEM DA AGENTE: fio da liga que acende de cima pra baixo ──────────────── */
        .nm-remy-item{position:relative; padding-left:16px;
          transition:transform .3s cubic-bezier(.2,.7,.2,1);}
        .nm-remy-item::before{content:""; position:absolute; left:0; top:2px; bottom:2px; width:2px;
          border-radius:2px; background:var(--liga); transform-origin:top center;}
        .nm-anima .nm-remy-item::before{transform:scaleY(0);
          transition:transform .8s cubic-bezier(.2,.7,.2,1) .18s;}
        .nm-anima .nm-remy-item.is-in::before{transform:scaleY(1);}
        .nm-remy-item:hover{transform:translateY(-3px);}

        /* ── (7) FOTO FIXA: o sistema dá push-in a toda .nm-foto img (certo na fita, errado
               num retrato). Aqui eu desligo e devolvo a proporção ao style de cada uso. ─── */
        .nm-foto-fixa img{animation:none !important; aspect-ratio:auto; height:100%;}

        /* ── (8) O BATIMENTO do rodapé, desenhado no reveal ──────────────────────────────── */
        .nm-pulse-draw path{stroke-dasharray:260; stroke-dashoffset:260;}
        .nm-anima .nm-pulse-draw path{transition:stroke-dashoffset 1.6s ease;}
        .nm-pulse-draw.is-in path{stroke-dashoffset:0;}

        /* ── (9) AS ONDAS (troca de cena claro↔escuro) ───────────────────────────────────── */
        .nm-onda{display:block; line-height:0;}
        .nm-onda svg{display:block; width:100%; height:clamp(38px,4.4vw,58px);}

        @media (prefers-reduced-motion: reduce){
          .nm-pulse-draw path{stroke-dashoffset:0 !important;}
          .nm-halo{animation:none !important;}
          .nm-remy-item:hover{transform:none;}
        }
      `}</style>

      {/* ── A ABERTURA ────────────────────────────────────────────────────────────────────── */}
      {cortina !== "nunca" && (
        <div className={"nm-cortina" + (cortina === "subindo" ? " sobe" : "")} aria-hidden="true"
          style={{ background: "var(--marca-escura)" }}>
          <img src={B + "/logo.png"} alt="" />
        </div>
      )}

      {/* ── CABEÇALHO ────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b" style={{ borderColor: "var(--linha)", background: "rgba(245,247,246,.88)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center gap-3 px-4 py-3">
          <a href="#topo" className="flex min-w-0 flex-nowrap items-center gap-2.5">
            <span className="grid h-12 shrink-0 place-items-center overflow-hidden rounded-xl px-2.5"
              style={{ background: "var(--branco)", border: "1px solid var(--linha)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(16,32,30,.05), 0 1px 2px rgba(16,32,30,.14)" }}>
              <img src={B + "/logo.png"} alt="NY Medical" width="40" height="40" className="h-[34px] w-auto" />
            </span>
            <span className="min-w-0">
              <span className="nm-vogue block truncate font-medium" style={{ fontSize: "clamp(15px,3.6vw,22px)", lineHeight: 1.05 }}>NY Medical</span>
              <span className="nm-mono nm-so-larga block truncate text-[11px]" style={{ color: "var(--tinta3)" }}>{RUA} · Midtown</span>
            </span>
          </a>
          <span className="flex-1" />
          <a href="#where" className="nm-selo nm-so-larga shrink-0" style={{ padding: "0 18px" }}>Where we are</a>
          <a href={"tel:" + TEL} className="nm-selo nm-selo-forte shrink-0" style={{ padding: "0 18px" }}>
            <span aria-hidden>☎</span>
            <span className="hidden sm:inline">{TEL_FMT}</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </header>

      {/* ── HERO EM FILME ────────────────────────────────────────────────────────────────── */}
      <section id="topo" className="relative overflow-hidden" style={{ minHeight: "min(92vh,820px)", background: "#04110F" }}>
        <video className="nm-filme" autoPlay muted loop playsInline preload="metadata"
          poster={B + "/hero-poster.jpg"} aria-label="Inside NY Medical Midtown, Dr. Igor Kletsman's practice">
          <source src={B + "/hero.mp4"} type="video/mp4" />
        </video>
        <div className="nm-veu" />
        <div className="nm-vinheta" />

        <div className="relative mx-auto flex max-w-6xl flex-col justify-end px-4 pb-12" style={{ minHeight: "min(92vh,820px)" }}>
          <div className={"max-w-[48rem]" + (abriu ? " nm-abriu" : "")}>
            <div className="nm-kicker nm-ent nm-ent-1" style={{ color: "rgba(255,255,255,.8)" }}>
              Dr. Igor Kletsman, MD · Internal Medicine · Midtown Manhattan
            </div>
            <h1 className="nm-vogue mt-3 font-medium" style={{ color: "#fff", fontSize: "clamp(38px,7.2vw,92px)", lineHeight: .94, letterSpacing: "-.024em", textWrap: "balance" }}>
              <span className="nm-ent nm-ent-2 block" style={{ textShadow: "0 2px 30px rgba(0,0,0,.45)" }}>Primary care on</span>
              <em className="nm-liga nm-liga-filme nm-ent nm-ent-3 block">the second floor</em>
              <em className="nm-liga nm-liga-filme nm-ent nm-ent-4 block">of West 45th.</em>
            </h1>
            <hr className="nm-filete-liga nm-ent nm-ent-5 my-6" style={{ maxWidth: "22rem" }} />
            <p className="nm-ent nm-ent-5 max-w-[35rem] text-[16px] leading-relaxed" style={{ color: "rgba(255,255,255,.9)" }}>
              An internist working with adult patients so care stays individualized as their needs evolve with age — same-day, tested on site, or by telehealth. {ruaCurta(ENDERECO)}, between Fifth and Sixth.
            </p>

            <div className="nm-ent nm-ent-6 mt-7 flex flex-wrap items-center gap-2.5">
              <a href={"tel:" + TEL} className="nm-selo nm-selo-forte nm-selo-liga"><span aria-hidden>☎</span> Call {TEL_FMT}</a>
              <a href="#where" className="nm-selo nm-selo-claro"><span aria-hidden>◈</span> Where we are</a>
            </div>

            <div className="nm-ent nm-ent-7 mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="nm-vidro text-[13px] font-medium" style={{ color: "#fff" }}>
                <span className="nm-pulso" style={{ background: "var(--acento-luz)" }} />
                <span className="nm-mono">{rel.hora} in NYC · by appointment</span>
              </span>
              <div className="nm-creds">
                {[NOTA + " ★ · " + AVALIACOES + " reviews", "Same-day", "Testing on site", "Telehealth"].map((c) => (
                  <span key={c} className="nm-kicker" style={{ color: "rgba(255,255,255,.8)" }}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 01 · CREDENCIAIS E PROVA ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14" id="credentials">
        <Titulo n="01" sub="Nobody chooses a doctor from a brochure. This is what the practice is, before anything is asked of you.">
          Why patients stay
        </Titulo>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[18rem_1fr]">
          {/* a nota do Google, em corpo editorial — o número grande que a v1 não tinha */}
          <div className="nm-rev nm-card p-7">
            <div className="nm-kicker" style={{ color: "var(--marca-clara)" }}>Rated on Google</div>
            <div className="nm-nota mt-3">{NOTA}</div>
            <div className="mt-3"><Estrelas nota={Number(NOTA)} /></div>
            <div className="mt-3 text-[15px]" style={{ color: "var(--tinta2)" }}>
              from <strong style={{ color: "var(--tinta)" }}>{AVALIACOES} reviews</strong> of the Midtown practice
            </div>
            <hr className="nm-filete-liga mt-5" />
            <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
              Listed as NY Medical Midtown, Igor Kletsman MD.
            </p>
          </div>

          <div className="nm-esc grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {CREDENCIAIS.map(([t, d]) => (
              <div key={t} className="nm-rev">
                <div className="nm-vogue text-[21px] font-medium leading-tight">{t}</div>
                <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · 🚩 ONDE FICA E COMO CHEGAR — a seção que faltava ─────────────────────────── */}
      <section id="where" className="py-14" style={{ background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="02" sub="In New York the address decides the appointment. So here it is, with the floor, the corner and the landmarks you already know.">
            Where we are, and how to get here
          </Titulo>

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[24rem_1fr]">
            <div className="nm-rev">
              <div className="nm-card p-7">
                <div className="nm-kicker" style={{ color: "var(--marca-clara)" }}>The practice</div>
                <address className="not-italic">
                  <div className="nm-vogue mt-2 font-medium leading-[1.06]" style={{ fontSize: "clamp(30px,4.6vw,42px)" }}>
                    {RUA}
                  </div>
                  <div className="nm-vogue mt-1 text-[24px] font-medium" style={{ color: "var(--marca)" }}>{ANDAR}</div>
                  <div className="nm-mono mt-2 text-[14px]" style={{ color: "var(--tinta2)" }}>{CIDADE}</div>
                </address>
                <hr className="nm-filete-liga mt-5" />
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {MARCOS.map((m) => <span key={m} className="nm-chip">{m}</span>)}
                </div>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <a href={MAPA_URL} target="_blank" rel="noreferrer" className="nm-selo nm-selo-forte">
                    <span aria-hidden>◈</span> Open in Maps
                  </a>
                  <a href={"tel:" + TEL} className="nm-selo"><span aria-hidden>☎</span> Call the desk</a>
                </div>
                <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                  Second floor. If you are not sure which door, call {TEL_FMT} from the sidewalk — someone picks up.
                </p>
              </div>
            </div>

            {/* O MAPA-MOTIVO. Desenho, nunca foto de mapa. */}
            <div className="nm-rev nm-card p-5 sm:p-7">
              <div className="nm-kicker" style={{ color: "var(--marca-clara)" }}>The block, drawn</div>
              <div className="mt-4 overflow-x-auto"><div style={{ minWidth: 460 }}><MapaMidtown /></div></div>
              <p className="mt-4 text-[13.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                West 45th Street runs between Fifth and Sixth Avenues — one block up from Bryant Park, with Grand Central east along 42nd and Times Sq–42nd St to the west.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 · O MÉDICO E A EQUIPE ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14" id="doctor">
        <Titulo n="03">The doctor, and the team behind him</Titulo>
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[22rem_1fr]">
          <div className="nm-rev">
            <div className="nm-foto nm-foto-fixa" style={{ aspectRatio: "3/4", borderRadius: "18px" }}>
              <img src={B + "/dr-kletsman.jpg"} alt="Dr. Igor Kletsman, MD" loading="lazy" />
            </div>
            <div className="nm-vogue mt-4 text-[28px] font-medium leading-tight">Dr. Igor Kletsman, MD</div>
            <div className="nm-kicker mt-1">Internal Medicine · Midtown Manhattan</div>
          </div>
          <div className="nm-rev">
            <p className="text-[17px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
              Dr. Igor Kletsman is an internist serving patients in New York City. He works with adult patients to help them receive individualized care as their needs evolve with age — from preventive primary care to hormones, longevity and the everyday questions in between.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
              He does not work alone. A multidisciplinary care team supports every plan, so what starts as one appointment on the second floor of {RUA} can pull in the right people without you having to go looking.
            </p>
            <div className="mt-6">
              <div className="nm-foto nm-foto-fixa" style={{ aspectRatio: "16/9" }}>
                <img src={B + "/team.jpg"} alt="The care team at NY Medical Midtown" loading="lazy" />
              </div>
              <p className="mt-2.5 text-[12.5px]" style={{ color: "var(--tinta3)" }}>The multidisciplinary care team at the practice</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <figure className="m-0">
                <div className="nm-foto nm-foto-fixa" style={{ aspectRatio: "4/3" }}>
                  <img src={B + "/gallery-2.jpg"} alt="Three of the physicians at reception" loading="lazy" />
                </div>
                <figcaption className="mt-2 text-[12px] leading-snug" style={{ color: "var(--tinta3)" }}>Three of the physicians at reception</figcaption>
              </figure>
              <figure className="m-0">
                <div className="nm-foto nm-foto-fixa" style={{ aspectRatio: "4/3" }}>
                  <img src={B + "/gallery-7.jpg"} alt="A consultation room at the practice" loading="lazy" />
                </div>
                <figcaption className="mt-2 text-[12px] leading-snug" style={{ color: "var(--tinta3)" }}>A consultation room</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ── 04 · O QUE TRATA ─────────────────────────────────────────────────────────────── */}
      <section className="py-14" id="services" style={{ background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4">
          <Titulo n="04" sub="Five ways the practice cares for you. Every one starts with a consultation — the plan, and what it involves, are set with the team, never quoted from a page.">
            What the practice treats
          </Titulo>
          <div className="nm-esc mt-7 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICOS.map((s) => (
              <div key={s.nome} className="nm-card nm-card-hov nm-rev flex flex-col p-6">
                <span className="nm-kicker">{s.cauda}</span>
                <div className="nm-vogue mt-1.5 text-[26px] font-medium leading-tight">{s.nome}</div>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{s.d}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {s.tags.map((t) => <span key={t} className="nm-chip">{t}</span>)}
                </div>
                <a href="#book" className="nm-selo mt-5 justify-center"><span aria-hidden>✦</span> Book a consultation</a>
              </div>
            ))}
            <a href="#supplements" className="nm-card nm-card-hov nm-rev flex flex-col justify-between p-6"
              style={{ background: "linear-gradient(160deg,var(--marca-escura),var(--marca))", color: "#fff", borderColor: "var(--marca-escura)" }}>
              <div>
                <span className="nm-kicker" style={{ color: "var(--acento-luz)" }}>Recurring care</span>
                <div className="nm-vogue mt-1.5 text-[26px] font-medium leading-tight">Supplement protocols</div>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,.75)" }}>
                  17 protocols Dr. Kletsman curates by condition. Find yours below.
                </p>
              </div>
              <span className="nm-selo nm-selo-claro mt-5 justify-center"><span aria-hidden>↓</span> Open the finder</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── 05 · LOGÍSTICA QUE TIRA O MEDO ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14" id="logistics">
        <Titulo n="05" sub="The practical questions people ask before they call — answered here so the call is only about your health.">
          Before your first visit
        </Titulo>
        <div className="nm-esc mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LOGISTICA.map(([q, a]) => (
            <div key={q} className="nm-card nm-card-hov nm-rev p-6">
              <div className="nm-vogue text-[21px] font-medium leading-tight">{q}</div>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      <Onda cor="var(--marca-escura)" />

      {/* ── 06 · ⭐ O LOCALIZADOR DE PROTOCOLO ────────────────────────────────────────────── */}
      <section id="supplements" className="relative overflow-hidden pb-16 pt-6" style={{ background: "var(--marca-escura)" }}>
        <img src={B + "/supplements.jpg"} alt="" aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.14 }} loading="lazy" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(5,46,46,.82),rgba(5,46,46,.94))" }} />
        <div className="relative mx-auto max-w-6xl px-4">
          <Titulo n="06" claro sub="These are protocols Dr. Kletsman curates and dispenses — vetted supplements by condition, not a store shelf. Tell the AI what you're dealing with and it points you to the right one, 24/7.">
            Find your protocol
          </Titulo>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {PROTOCOLOS.map(([nome, ico], i) => (
                <button key={nome} type="button" data-on={prot === i ? "1" : "0"} className="nm-cond nm-rev"
                  onClick={() => setProt(i)}>
                  <span className="nm-ico"><Icone tipo={ico} /></span>
                  <span className="text-[13px] font-medium leading-snug">{nome}</span>
                </button>
              ))}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="nm-card-esc p-6">
                <div key={prot} className="nm-troca">
                  <div className="flex items-center gap-3">
                    <span className="nm-ico-vitrine"><Icone tipo={protAtivo[1]} /></span>
                    <span className="nm-kicker" style={{ color: "var(--acento-luz)" }}>Vetted protocol</span>
                  </div>
                  <div className="nm-vogue mt-3 text-[24px] font-medium leading-tight" style={{ color: "#fff" }}>
                    {protAtivo[0]}
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,.7)" }}>
                    {protAtivo[2]}
                  </p>
                  <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.5)" }}>
                    Dr. Kletsman's vetted protocol for {protAtivo[0].replace(/ Support$/, "").toLowerCase()}. Supports — never a diagnosis, dose or cure; the team confirms anything clinical.
                  </p>
                  <a href={SUPP_URL} target="_blank" rel="noreferrer"
                    className="nm-selo nm-selo-forte mt-5 w-full justify-center">
                    <span aria-hidden>▤</span> Buy Now
                  </a>
                  <p className="mt-2.5 text-center text-[11.5px]" style={{ color: "rgba(255,255,255,.4)" }}>
                    Opens the practice's supplement shop
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── 07 · O QUE A REMY FAZ ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16" id="remy" style={{ background: "var(--marca-escura)" }}>
        <img src={B + "/gallery-3.jpg"} alt="" aria-hidden="true" loading="lazy"
          className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "rgba(5,46,46,.88)" }} />
        <div className="relative mx-auto max-w-6xl px-4">
          <Titulo n="07" claro sub="Remy is the practice's front desk — on this page and on the phone. She knows every service, the address and all 17 supplement protocols, and she never guesses at anything clinical.">
            The practice answers 24/7
          </Titulo>
          <div className="nm-esc mt-8 grid items-start gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCOES.map(([t, d], i) => (
              <div key={t} className="nm-rev nm-remy-item">
                <span className="nm-num-liga">{String(i + 1).padStart(2, "0")}</span>
                <div className="nm-vogue mt-1 text-[22px] font-medium leading-tight" style={{ color: "#fff" }}>{t}</div>
                <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,.74)" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ background: "var(--marca-escura)" }}><Onda cor="var(--papel)" flip /></div>

      {/* ── 08 · AGENDAR ─────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-14" id="book">
        <div className="nm-card nm-rev p-6 sm:p-8">
          {enviado ? (
            <div className="py-6 text-center">
              <div className="nm-vogue text-[36px] font-medium" style={{ color: "var(--marca)" }}>Got it.</div>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Your request is with the practice at {RUA}. The team comes back on the channel you picked — and if you would rather not wait, {TEL_FMT} rings the front desk.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <span className="nm-num">08</span>
              <h2 className="nm-vogue mt-1 font-medium" style={{ fontSize: "clamp(26px,4.4vw,40px)", lineHeight: 1.04 }}>
                {passo === 0 ? "What brings you in?" : passo === 1 ? "When suits you?" : "Where do we answer?"}
              </h2>

              <div className="mt-4 flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((p) => (
                  <span key={p} className="h-1 flex-1 rounded-full transition-colors"
                    style={{ background: p <= passo ? "var(--marca)" : "var(--linha)" }} />
                ))}
              </div>

              {passo === 0 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {["Primary care visit", "Hormones & longevity", "Body treatment", "Weight loss", "PrEP", "A supplement protocol"].map((s) => (
                      <button key={s} type="button" onClick={() => { escolher("motivo", s); setOutro((o) => ({ ...o, motivo: false })); }}
                        className="nm-pilula" data-on={form.motivo === s && !outro.motivo ? "1" : "0"}>{s}</button>
                    ))}
                    <button type="button" onClick={() => setOutro((o) => ({ ...o, motivo: true }))}
                      className="nm-pilula" data-on={outro.motivo ? "1" : "0"}>Something else…</button>
                  </div>
                  {outro.motivo && (
                    <input className="nm-campo mt-3" placeholder="Tell us in your own words" value={livre.motivo}
                      onChange={(e) => setLivre((l) => ({ ...l, motivo: e.target.value }))} />
                  )}
                  <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                    Nothing here is a diagnosis — it just helps the front desk get you to the right person.
                  </p>
                </div>
              )}

              {passo === 1 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {["Today if possible", "This week", "Next week", "Telehealth is fine", "Evenings"].map((q) => (
                      <button key={q} type="button" onClick={() => { escolher("quando", q); setOutro((o) => ({ ...o, quando: false })); }}
                        className="nm-pilula" data-on={form.quando === q && !outro.quando ? "1" : "0"}>{q}</button>
                    ))}
                    <button type="button" onClick={() => setOutro((o) => ({ ...o, quando: true }))}
                      className="nm-pilula" data-on={outro.quando ? "1" : "0"}>A specific date…</button>
                  </div>
                  {outro.quando && (
                    <input className="nm-campo mt-3" placeholder="Which day and roughly what time?" value={livre.quando}
                      onChange={(e) => setLivre((l) => ({ ...l, quando: e.target.value }))} />
                  )}
                </div>
              )}

              {passo === 2 && (
                <div className="mt-6 space-y-3">
                  <input className="nm-campo" placeholder="Your name" value={form.nome} onChange={(e) => escolher("nome", e.target.value)} />
                  <input className="nm-campo" type="tel" placeholder="Phone" value={form.tel} onChange={(e) => escolher("tel", e.target.value)} />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CANAIS.map((c) => (
                      <button key={c.id} type="button" onClick={() => setCanal(c.id)} className="nm-pilula" data-on={canal === c.id ? "1" : "0"}>
                        <span aria-hidden className="mr-1.5">{c.ico}</span>{c.rot}
                      </button>
                    ))}
                  </div>
                  <textarea className="nm-campo py-3" rows={2} placeholder="Anything the team should know? (optional)" value={livre.recado}
                    onChange={(e) => setLivre((l) => ({ ...l, recado: e.target.value }))} style={{ minHeight: 72, resize: "vertical" }} />
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tinta3)" }}>
                    Leave a number and the practice's AI calls you straight back — that is the fastest way to a time.
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {passo > 0 && <button type="button" onClick={() => setPasso((p) => p - 1)} className="nm-pilula">← Back</button>}
                {passo < 2 ? (
                  <button type="button" disabled={!podeAvancar} onClick={() => setPasso((p) => p + 1)}
                    className={"nm-selo" + (podeAvancar ? "" : " off")}>Next</button>
                ) : (
                  <button type="submit" disabled={!podeAvancar} className={"nm-selo nm-selo-forte" + (podeAvancar ? "" : " off")}>
                    <span aria-hidden>✦</span> Request my consultation
                  </button>
                )}
                <a href={"tel:" + TEL} className="nm-link nm-alvo text-[13.5px]">or just call {TEL_FMT}</a>
              </div>
              {erro && <p className="mt-3 text-[13.5px]" style={{ color: "var(--acento-sombra)" }}>{erro}</p>}
            </form>
          )}
        </div>
      </section>

      {/* ── 09 · O ESPAÇO ────────────────────────────────────────────────────────────────── */}
      <section className="py-12" id="space">
        <div className="mx-auto max-w-6xl px-4"><Titulo n="09">Inside the practice</Titulo></div>
        <div className="mx-auto mt-6 max-w-6xl px-4">
          <div className="nm-fita nm-rev">
            {ESPACO.map(([arq, legenda]) => (
              <figure key={arq}>
                <div className="nm-foto"><img src={B + "/" + arq} alt={legenda} loading="lazy" /></div>
                <figcaption className="mt-2.5 text-[12.5px] leading-snug" style={{ color: "var(--tinta3)" }}>{legenda}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10 · FAQ ─────────────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 pb-14">
        <Titulo n="10">Questions</Titulo>
        <div className="mt-5 space-y-2.5">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="nm-card nm-card-hov nm-rev">
              <button type="button" onClick={() => setAberto(aberto === i ? null : i)} aria-expanded={aberto === i}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 px-5 text-left">
                <span className="text-[15px] font-medium">{q}</span>
                <span aria-hidden style={{ color: "var(--marca)" }}>{aberto === i ? "−" : "+"}</span>
              </button>
              {aberto === i && <p className="px-5 pb-4 text-[14px] leading-relaxed" style={{ color: "var(--tinta2)" }}>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTATO — com o endereço COMPLETO, que a v1 não tinha ─────────────────────────── */}
      <footer id="contact" className="border-t" style={{ borderColor: "var(--linha)", background: "var(--papel2)" }}>
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <img src={B + "/logo.png"} alt="NY Medical Midtown" width="56" height="56" className="w-[56px]" />
              <div className="nm-vogue mt-3 text-[24px] font-medium">NY Medical Midtown</div>
              <address className="not-italic">
                <div className="nm-mono mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--tinta)" }}>
                  {RUA}, {ANDAR}<br />{CIDADE}
                </div>
                <a href={"tel:" + TEL} className="nm-link nm-alvo mt-1 text-[14.5px]">{TEL_FMT}</a>
              </address>
              <p className="mt-3 max-w-[26rem] text-[14.5px] leading-relaxed" style={{ color: "var(--tinta2)" }}>
                Dr. Igor Kletsman, MD — internal medicine in Midtown Manhattan, between Fifth and Sixth Avenues. Preventive primary care, hormones and longevity, body treatments, weight loss, PrEP and vetted supplement protocols, with same-day appointments, on-site testing and telehealth.
              </p>
              <svg className="nm-pulse-draw mt-5" viewBox="0 0 320 32" width="320" height="32" fill="none" aria-hidden="true">
                <path d="M4 16h60l10-9 12 18 12-24 12 30 10-15h180" stroke="var(--acento-sombra)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="space-y-2.5">
              <a href={"tel:" + TEL} className="nm-card nm-card-hov flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--acento-sombra)" }}>☎</span> Call {TEL_FMT}
              </a>
              <a href={MAPA_URL} target="_blank" rel="noreferrer"
                className="nm-card nm-card-hov flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--acento-sombra)" }}>◈</span> {ENDERECO}
              </a>
              <a href={SUPP_URL} target="_blank" rel="noreferrer" className="nm-card nm-card-hov flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--acento-sombra)" }}>▤</span> Supplement protocol shop
              </a>
              <a href={SITE_DELES} target="_blank" rel="noreferrer" className="nm-card nm-card-hov flex min-h-[56px] items-center gap-3 px-4 text-[15px]">
                <span aria-hidden style={{ color: "var(--acento-sombra)" }}>↗</span> Their current site
              </a>
              <div className="nm-kicker pt-2">{NOTA} ★ · {AVALIACOES} Google reviews · Same-day · Telehealth</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
