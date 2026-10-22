/* ══════════════════════════════════════════════════════════════════════════════════════════════
   NATURA SPA NYC — Astoria · Upper East Side · Natura Med Spa            CLIENTE REAL da Guileo
   Conceito: A PORTA FLORIDA.

   De onde vem (nada inventado, tudo já é deles):
   • o LOGO é um arco ogival — aqui ele é traçado no pixel e vira a PORTA da hero, o recorte das
     fotos e as pontas de todo botão;
   • a FACHADA de Astoria é um arco de flores vermelhas — é o primeiro plano do filme;
   • o RAMO com flores do logo vira o trilho de navegação que cresce com a rolagem.

   Rolar a página = atravessar a porta. O vídeo fica parado atrás; o que anima é o furo na parede.

   MEDIDO, NÃO ESCOLHIDO: petróleo #015577 e ouro #E7C673→#BC8E40 (SVG do logo); vermelho-flor
   #A3001C e verde #56741F (pixel das fotos); Manrope é a fonte que o site deles já usa.

   🚨 FONTE DOS DADOS: naturaspanyc.com via Wayback Machine (capturas 2024-05 a 2025-04). O site ao
   vivo recusa leitura automática e foi refeito depois. PREÇOS PENDENTES DE CONFIRMAÇÃO com a
   Lilian antes de publicar — o rodapé declara isso. Nenhum preço aqui foi inventado.
   🚨 FOTOS: as 18 são de ASTORIA (upload 2020-03, antes de Manhattan abrir). UES e Med Spa ficam
   sem foto de propósito.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ARCO_H as ARCO_FORA_H, ARCO_IN, ARCO_OUT, ARCO_IN_BOX, FLOR } from "./naturaArco.js";

const B = "/novo/natura-spa";
const SITE_URL = "https://guileoai.com/novo/natura-spa-porta";
const TITULO = "Natura Spa NYC · Brazilian Hair Salon, Spa & Med Spa · Astoria and Upper East Side";
const DESCRICAO = "Natura Spa: Brazilian hair salon, spa and med spa in Astoria and on the Upper East Side. Balayage, Brazilian keratin, facials, massage, waxing, injectables. Book online.";
const EMAIL = "naturaspanyc@gmail.com";
const REDES = {
  instagram: "https://www.instagram.com/naturaspanyc/",
  facebook: "https://www.facebook.com/naturaspanyc",
  yelp: "https://www.yelp.com/biz/natura-spa-astoria-4",
  laser: "https://naturalaserny.com/",
};

/* horas em relógio de 24h, America/New_York. semana = seg a sáb. */
const UNIDADES = {
  astoria: {
    id: "astoria", curto: "Astoria", nome: "Natura Spa · Astoria", tipo: "Hair salon & spa",
    rua: "30-79 Steinway Street", cidade: "Astoria, NY 11103",
    tel: "+17189565530", telFmt: "(718) 956-5530", outros: ["(718) 956-5529", "(718) 956-1199"],
    semana: [10, 20], dom: [11, 19],
    reservar: "https://clients.mindbodyonline.com/consumerbooking?studioid=767008",
    mapa: "https://www.google.com/maps/search/?api=1&query=Natura+Spa+30-79+Steinway+St+Astoria+NY+11103",
    geo: [40.76184, -73.91673], foto: "foto-08",
    legenda: "The Steinway Street storefront, under its arch of red flowers.",
  },
  ues: {
    id: "ues", curto: "Upper East Side", nome: "Natura Spa · Upper East Side", tipo: "Hair salon & spa",
    rua: "842 Lexington Avenue", cidade: "New York, NY 10065",
    tel: "+12122580661", telFmt: "(212) 258-0661", outros: ["(212) 258-0662"],
    semana: [9, 19], dom: [10, 18],
    reservar: "https://clients.mindbodyonline.com/consumerbooking?studioid=5734109",
    mapa: "https://www.google.com/maps/search/?api=1&query=Natura+Spa+842+Lexington+Ave+New+York+NY+10065",
    geo: [40.76534, -73.96611], foto: null,
  },
  med: {
    id: "med", curto: "Med Spa", nome: "Natura Med Spa", tipo: "Medical aesthetics",
    rua: "166 East 63rd Street", cidade: "New York, NY 10065",
    tel: "+12122580661", telFmt: "(212) 258-0661", outros: ["(212) 258-0662"],
    semana: [10, 19], dom: [10, 17],
    reservar: "https://clients.mindbodyonline.com/consumerbooking?studioid=5734109",
    mapa: "https://www.google.com/maps/search/?api=1&query=Natura+Med+Spa+166+E+63rd+St+New+York+NY+10065",
    geo: [40.76411, -73.96557], foto: null,
  },
};
const ORDEM = ["astoria", "ues", "med"];

/* ─── O RELÓGIO ─────────────────────────────────────────────────────────────────────────────
   Um tick só alimenta TUDO que fala de horário (selo da hero, botão de reservar, as três portas).
   Dois relógios divergem: o selo diria "aberto" e o botão "fechado" no mesmo minuto. */
const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function agoraNY(d = new Date()) {
  try {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(d);
    const g = (t) => p.find((x) => x.type === t)?.value;
    const h = Number(g("hour")) % 24;
    return { dia: DIAS.indexOf(g("weekday")), min: h * 60 + Number(g("minute")) };
  } catch { return null; }
}
const hora12 = (h) => `${((h + 11) % 12) + 1} ${h % 24 < 12 ? "AM" : "PM"}`;
const relogio = (min) => `${((Math.floor(min / 60) + 11) % 12) + 1}:${String(min % 60).padStart(2, "0")} ${min < 720 ? "AM" : "PM"}`;
function statusDe(u, t) {
  if (!t || t.dia < 0) return { aberto: null, texto: `Mon–Sat ${hora12(u.semana[0])}–${hora12(u.semana[1])}` };
  const [abre, fecha] = t.dia === 0 ? u.dom : u.semana;
  if (t.min >= abre * 60 && t.min < fecha * 60) {
    return { aberto: true, fechando: fecha * 60 - t.min <= 60, texto: `open until ${hora12(fecha)}`, hora: hora12(fecha) };
  }
  if (t.min < abre * 60) return { aberto: false, quando: "today", texto: `opens today at ${hora12(abre)}`, hora: hora12(abre) };
  const [amanha] = (t.dia + 1) % 7 === 0 ? u.dom : u.semana;
  return { aberto: false, quando: "tomorrow", texto: `opens tomorrow at ${hora12(amanha)}`, hora: hora12(amanha) };
}

/* ─── A VOZ DO BOTÃO ────────────────────────────────────────────────────────────────────────
   O botão principal muda de frase conforme a hora real de NY. Esta função é a POLÍTICA dessa
   fala — decisão de negócio do Luis (2026-09-28), não de código:
     • FECHADO → opção B: "Reserve for tomorrow". Quem entra às 23h quer saber quando pode ir;
       "amanhã às 10h" responde na hora. A reserva continua online (o Mindbody aceita de madrugada).
     • antes de abrir, no mesmo dia → "Reserve for today".
   Entrada: u = unidade · st = { aberto, fechando, quando, hora }.  Saída: [linha forte, linha fina]. */
function vozDoBotao(u, st) {
  if (st.aberto === null) return [`Book at ${u.curto}`, "Online, any time"];
  if (st.aberto && st.fechando) return [`Book at ${u.curto}`, `Closes at ${st.hora} · book ahead`];
  if (st.aberto) return [`Book at ${u.curto}`, `Open now · until ${st.hora}`];
  return [`Reserve for ${st.quando}`, `${u.curto} · opens at ${st.hora}`];
}

/* ─── O CARDÁPIO ────────────────────────────────────────────────────────────────────────────
   [nome, Astoria, UES, nota]. Preço: número · [de, até] · { "60 min": 98 } (opções) · null (não tem).
   Transcrito das páginas deles. Onde o próprio site se contradiz, vale a TABELA e a divergência
   está listada em natura-spa/PESQUISA.md — não escolhi o número mais bonito. */
const MENU = [
  { id: "hair", nome: "Hair", intro: "Aveda, Kérastase and Moroccanoil on the shelf. Final price is set at consultation, by length and time.", grupos: [
    { nome: "Cut & style", itens: [
      ["Trim", [40, 50], null],
      ["Styling haircut", [60, 70], null],
      ["Wash, cut & blow-dry", [90, 110], null],
      ["Wash & blowout", null, [50, 70]],
      ["Women’s cut & styling", null, [90, 140]],
      ["European-style men’s cut + style", null, [60, 80]],
      ["Wash & blowout with extensions", [65, 85], [70, 90]],
      ["Hair extensions", [200, 600], [300, 850]],
    ] },
    { nome: "Balayage, highlights & color", itens: [
      ["Balayage · full head", [250, 280], [190, 325]],
      ["Balayage · partial", [140, 180], [140, 190]],
      ["Balayage package", [380, 450], null, "Balayage + haircut + Olaplex + Kérastase treatment + blow-dry"],
      ["Highlights · full head", [180, 250], [190, 325]],
      ["Highlights · partial", [140, 180], [180, 250]],
      ["Single process · full hair", [80, 120], [90, 120]],
      ["Roots / single-process touch-up", [75, 85], [85, 95]],
      ["Double process", [120, 300], [140, 210]],
      ["Toner / gloss", [60, 80], 90],
    ] },
    { nome: "Brazilian smoothing & treatments", itens: [
      ["Brazilian Keratin", [200, 300], 350, { astoria: "Formaldehyde-free. Can be washed the same day.", ues: "Smooth and Shine" }],
      ["Hair Botox", [160, 200], [180, 250]],
      ["Kérastase Fusio-Dose", 35, 35],
      ["Kérastase Masque", 40, 45],
      ["Kérastase Chronologiste Masque", 85, 95],
      ["Olaplex treatment", [50, 75], 70],
      ["Olaplex within a color service", 30, 30],
      ["Deep conditioning", [30, 65], 40],
      ["Relaxer", [70, 90], 90],
      ["Exfoliating scalp scrub + Fusio-Dose", null, 80],
    ] },
    { nome: "Natura hair rituals", itens: [
      ["Natura Shine Ritual by Kérastase", null, 95, "Fusio-Dose + blowout"],
      ["Natura Repair Therapy by Olaplex", null, 160, "Olaplex + scalp massage + blowout"],
      ["Natura Restorative Boost by Kérastase", null, 180, "Chronologiste + scalp massage + blowout"],
      ["Natura Glam by Kérastase", null, 180, "Fusio-Dose + blowout + makeup"],
    ] },
    { nome: "Occasions & bridal", itens: [
      ["Up-do", [80, 120], [130, 160]],
      ["Makeup", [80, 120], 130],
      ["Braids", [25, 80], [55, 80]],
      ["Hair waves", 70, null],
      ["Bridal up-do", [120, 150], null],
      ["Bridal makeup", [150, 200], null],
      ["Bridal makeup + up-do", null, [350, 450]],
    ] },
  ] },
  { id: "face", nome: "Face", intro: "From a 30-minute reset to resurfacing. Organic facials use Eminence.", grupos: [
    { nome: "Facials", itens: [
      ["Natura Spa Signature Facial", 98, 135, "60 min · exfoliation and extraction in a single area"],
      ["Mini facial", 75, null, "30 min"],
      ["Organic facial by Eminence", 130, 170],
      ["HydraFacial", 160, 220, "60 min"],
      ["Signature facial + microdermabrasion", 140, 169, { astoria: "80 min", ues: "60 min" }],
      ["Facial + microdermabrasion + collagen mask", 160, null],
      ["Deep pore cleansing", 115, null, "80 min · full extraction, hydration and mask"],
      ["Deep pore cleansing + oxygen", null, 145],
      ["Ultimate skin age treatment", 95, null, "80 min"],
      ["Ultimate age treatment + collagen mask", null, 189, "80 min"],
      ["Natura Advanced Facial", null, 169, "60 min"],
      ["Natura Moist Facial", null, 175, "60 min"],
      ["Lifting Facial", null, 190, "60 min"],
      ["Acne relief + LED blue therapy", { "60 min": 120, "90 min": 135 }, 160],
      ["Back facial treatment", { "60 min": 120, "90 min": 135 }, null],
      ["Back treatment with bamboo mask", null, 180],
      ["Facial lymphatic drainage", 60, null, "30 min"],
    ] },
    { nome: "Resurfacing & advanced", itens: [
      ["Dermaplane", 160, 180, "60 min"],
      ["Microdermabrasion", 85, null, "40 min"],
      ["Chemical peel", 160, null, "60 min · 4 sessions $500"],
      ["Microneedling", 160, null],
      ["Microchanneling", 280, null, "4 sessions $1,000"],
      ["Microneedling / microchanneling", null, 300],
      ["LuminFusion by Dermalogica", 180, 200],
      ["Photo facial", null, 250, "60 min"],
      ["Laser carbon peel", null, 260, "60 min"],
      ["Power Peel", null, { "1 session": 250, "3 sessions": 600, "6 sessions": 1100 }],
      ["Jet Plasma", null, { "1 session": 300, "3 sessions": 800 }],
      ["Hydrabooty", 150, 180, { astoria: "45 min" }],
      ["Skin tag removal", 90, null, "Per area: neck, underarm, back or chest"],
    ] },
    { nome: "Add to any facial", itens: [
      ["LED therapy", 30, null],
      ["Collagen ritual", 30, null, "30 min"],
      ["Eye peel", 50, null],
    ] },
  ] },
  { id: "body", nome: "Body", intro: "Massage by the minute in Astoria, by the ritual on the Upper East Side.", grupos: [
    { nome: "Massage", itens: [
      ["Swedish", { "30 min": 60, "60 min": 98, "90 min": 130 }, { "60 min": 132, "90 min": 168 }],
      ["Deep tissue", { "30 min": 70, "60 min": 110, "90 min": 135 }, { "60 min": 132, "90 min": 168 }],
      ["Hot stone", { "30 min": 70, "60 min": 98, "90 min": 130 }, { "60 min": 132, "90 min": 168 }],
      ["Sports", { "30 min": 70, "60 min": 110, "90 min": 135 }, { "60 min": 118, "90 min": 155 }],
      ["Therapeutic ritual", { "30 min": 70, "60 min": 98, "90 min": 130 }, null],
      ["Pre-natal", null, { "60 min": 160, "90 min": 190 }],
      ["Couples · side by side", 198, { "60 min": 280, "90 min": 410 }, { astoria: "60 min, any massage, private room" }],
    ] },
    { nome: "Brazilian drainage & sculpting", itens: [
      ["Brazilian lymphatic drainage", null, { "60 min": 168, "90 min": 210 }],
      ["Lymphatic drainage + body sculpting", [98, 130], { "60 min": 125, "90 min": 190 }],
      ["Post-surgical drainage", 110, { "60 min": 168, "90 min": 210 }],
      ["Liposuction drainage", 130, null, "90 min"],
    ] },
    { nome: "Deluxe rituals", itens: [
      ["Natura Spa Aromatherapy", null, { "60 min": 150, "90 min": 210 }],
      ["Sports therapy with Theragun", null, { "60 min": 160, "90 min": 210 }],
      ["Full Detox", null, { "60 min": 185, "90 min": 235 }, "Green tea, lymphatic drainage and ionic foot detox"],
    ] },
    { nome: "Detox & add-ons", itens: [
      ["Ionic foot detox", 70, 90],
      ["Biboting · body cupping detox", 150, null, "5 sessions $675 · 10 sessions $1,300"],
      ["Back, neck & shoulders", null, 70],
      ["Reflexology", null, 55],
      ["Cavitation", null, 60],
    ] },
  ] },
  { id: "beauty", nome: "Brows, lashes & wax", intro: "Waxing by Brazilian specialists. Every area, priced.", grupos: [
    { nome: "Brows", itens: [
      ["Shaping + tweezing", 30, 50],
      ["Shaping · waxing", null, 38],
      ["Threading", 20, null],
      ["Tinting", 25, 35],
      ["Tweezing + tinting", 50, null],
      ["Lamination", null, 50],
      ["Microblading / micropigmentation", 650, 750],
    ] },
    { nome: "Lashes", itens: [
      ["Classic full set", 100, 100],
      ["Volume full set", 150, 150],
      ["2–3 week touch-up", [50, 70], 60],
      ["Lash lift", 60, null],
      ["Removal", 20, 20],
    ] },
    { nome: "Wax · face", itens: [
      ["Eyebrows", 30, 45], ["Lip", 10, 15], ["Chin", 12, 16], ["Nose", 15, 20], ["Sideburns", [17, 30], [20, 25]],
      ["Beard", 30, 38], ["Full face", 60, 60],
    ] },
    { nome: "Wax · body", itens: [
      ["Brazilian bikini", 55, 60], ["Simple bikini", 40, 45],
      ["Full legs", 75, 79], ["Upper legs", 50, 49], ["Lower legs", 45, 45],
      ["Full arm", 45, 55], ["Half arm", 40, 40], ["Underarm", 20, 25],
      ["Chest", 50, 69], ["Stomach", 35, 49], ["Stomach strip", 14, 18], ["Shoulders", 25, 38],
      ["Buttocks", 35, 40], ["Buttocks strip", 25, 30],
    ] },
  ] },
];

const MED = [
  ["Neurotoxin", "Botox®, Xeomin®, Dysport®. Also for hyperhidrosis: underarm, palm, sole.", "$12–14", "per unit"],
  ["Volume filler", "Restylane®, Juvéderm®, Sculptra®, Radiesse®. Mid-face, lips, nasal contouring.", "$700–900", "per syringe"],
  ["Kybella®", "Submental fat.", "$1,800", "per treatment"],
  ["Platelet-rich plasma", "PRP, including the vampire facial.", "$800", "per session"],
  ["CoolSculpting®", "Non-surgical fat reduction by controlled cooling.", "$650", "from the Astoria menu"],
];
const EM_CASA = [["Blowout", 200], ["Haircut & blowout", 320], ["Up-do", 390], ["Makeup", 390], ["Brazilian mani & pedi", 150]];

const GALERIA = [
  ["foto-08", "The storefront at 30-79 Steinway Street."],
  ["foto-04", "Reception: white marble desk, gold slats behind it."],
  ["foto-01", "The living green wall by the entrance."],
  ["foto-09", "The salon floor."],
  ["foto-15", "The salon, looking back toward the street."],
  ["foto-13", "The wash stations."],
  ["foto-18", "A treatment room."],
  ["foto-17", "A facial room."],
  ["foto-02", "The front window, seen from inside."],
];

const HISTORIA = [
  ["Brazil", "A high-end fashion boutique", "Lilian Metzger’s first business: clothes chosen by eye, one client at a time."],
  ["New York", "Brazilian fashion on Steinway", "She arrives in New York and opens a store in Astoria, importing Brazilian clothing, shoes and accessories. A second store follows in SoHo."],
  ["2003", "Natura Spa", "She buys a salon from a friend. The boutique owner’s eye moves from the rack to the chair."],
  ["Upper East Side", "842 Lexington Avenue", "After more than 18 years in Astoria, the flagship opens in Manhattan."],
  ["East 63rd", "Natura Med Spa", "A medical aesthetics studio opens at 166 East 63rd Street."],
];

const FAQ = [
  ["What is the cancellation policy?", "Natura Spa asks for at least 24 hours’ notice to cancel or reschedule. With less than 24 hours’ notice the fee is 50% of the booked services. No-shows and same-day cancellations are charged 100%."],
  ["How do gift cards work?", "Gift cards can be bought online or at any location and used toward any service or product, except laser hair removal, manicure and pedicure. They expire one year after purchase, are not redeemable for cash, and tips cannot be put on them. Service tax applies."],
  ["Are prices the same at every location?", "No. Astoria and the Upper East Side have their own menus and prices. Pick your location at the top of the menu and every price on this page follows."],
  ["Is the price on the menu final?", "For hair, the final price depends on length and time and is confirmed at consultation. Natura Spa notes that prices can change in exceptional cases."],
  ["Do you offer packages?", "Yes. In Astoria any massage comes in packages of 5 sessions for $460 or 10 for $850, and there are 4-session packages for acne relief ($450), chemical peel ($500) and microchanneling ($1,000)."],
  ["Is a consultation at the Med Spa free?", "Yes. Call the Med Spa to book a free consultation before any injectable or body treatment."],
];

/* link direto + última escolha: ?loc=ues&menu=body — anúncio da Lexington cai no cardápio da Lexington */
function inicio() {
  const r = { loc: "astoria", cat: "hair", rolar: false };
  try {
    const q = new URLSearchParams(window.location.search);
    const l = q.get("loc"); const m = q.get("menu");
    const salvo = window.localStorage.getItem("ns-loc");
    if (l === "astoria" || l === "ues") r.loc = l; else if (salvo === "astoria" || salvo === "ues") r.loc = salvo;
    if (m && MENU.some((c) => c.id === m)) { r.cat = m; r.rolar = true; }
  } catch { /* storage bloqueado: segue no padrão */ }
  return r;
}

/* ─── preço ────────────────────────────────────────────────────────────────────────────────── */
const usd = (n) => `$${Number(n).toLocaleString("en-US")}`;
const ehOpcoes = (p) => p && typeof p === "object" && !Array.isArray(p);
const faixa = (p) => (Array.isArray(p) ? `${usd(p[0])}–${p[1].toLocaleString("en-US")}` : usd(p));
const limites = (p) => (Array.isArray(p) ? p : [p, p]);
const chave = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const notaDe = (n, loc) => (n && typeof n === "object" ? n[loc] || "" : n || "");

function LD() {
  const horario = (u) => [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: `${String(u.semana[0]).padStart(2, "0")}:00`, closes: `${u.semana[1]}:00` },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: `${String(u.dom[0]).padStart(2, "0")}:00`, closes: `${u.dom[1]}:00` },
  ];
  const casa = (u, tipo) => ({
    "@type": tipo, "@id": `${SITE_URL}#${u.id}`, name: u.nome, url: SITE_URL, telephone: u.tel, email: EMAIL,
    image: `https://guileoai.com${B}/hero-poster.jpg`, priceRange: "$$",
    address: { "@type": "PostalAddress", streetAddress: u.rua, addressLocality: u.cidade.split(",")[0], addressRegion: "NY", postalCode: u.cidade.slice(-5), addressCountry: "US" },
    geo: { "@type": "GeoCoordinates", latitude: u.geo[0], longitude: u.geo[1] },
    openingHoursSpecification: horario(u), sameAs: [REDES.instagram, REDES.facebook, REDES.yelp],
    founder: { "@type": "Person", name: "Lilian Metzger" },
    potentialAction: { "@type": "ReserveAction", target: u.reservar },
  });
  return { "@context": "https://schema.org", "@graph": [
    casa(UNIDADES.astoria, ["DaySpa", "HairSalon"]),
    casa(UNIDADES.ues, ["DaySpa", "HairSalon"]),
    casa(UNIDADES.med, "HealthAndBeautyBusiness"),
    { "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ] };
}

/* ─── peças ────────────────────────────────────────────────────────────────────────────────── */
function Flor({ className = "", style }) {
  return <svg className={className} style={style} viewBox="0 0 32 31" aria-hidden="true"><path fillRule="evenodd" fill="currentColor" d={FLOR} /></svg>;
}

/* A ponta do botão: meia ogiva, a mesma curva do arco do logo deitada. */
const PONTA = "M24,0 C17.5,0 15.6,5.2 13.2,11.4 C10.6,18.2 6.4,23.4 0,27 C6.4,30.6 10.6,35.8 13.2,42.6 C15.6,48.8 17.5,54 24,54";
function Botao({ as: Tag = "a", tom = "ouro", forte, fino, children, className = "", ...resto }) {
  return (
    <Tag className={`ns-btn ns-btn-${tom} ${className}`} {...resto}>
      <span className="ns-somb ns-somb-a" aria-hidden="true"><i /></span>
      <span className="ns-somb ns-somb-c" aria-hidden="true"><i /></span>
      <span className="ns-corpo" aria-hidden="true" />
      <svg className="ns-cap ns-cap-l" viewBox="0 0 24 54" preserveAspectRatio="none" aria-hidden="true"><path d={PONTA} /></svg>
      <svg className="ns-cap ns-cap-r" viewBox="0 0 24 54" preserveAspectRatio="none" aria-hidden="true"><path d={PONTA} /></svg>
      <span className="ns-btn-t">
        {children || (<><b>{forte}</b>{fino ? <i>{fino}</i> : null}</>)}
      </span>
    </Tag>
  );
}

function Cabeca({ sobre, children, claro }) {
  return (
    <header className={`ns-cab ns-rv ${claro ? "ns-cab-claro" : ""}`}>
      <div className="ns-ramo" aria-hidden="true">
        <svg viewBox="0 0 120 40" className="ns-ramo-l"><path pathLength="1" d="M2,30 C24,30 34,8 54,10 C70,12 70,30 56,30 C46,30 46,18 56,18 C62,18 66,22 78,24 C92,26 104,20 118,12" /></svg>
        <Flor className="ns-ramo-f" />
      </div>
      <p className="ns-sobre">{sobre}</p>
      <h2>{children}</h2>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */
export default function NaturaSpa() {
  const raiz = useRef(null);
  const hero = useRef(null);
  const furo = useRef(null);
  const moldura = useRef(null);
  const fala = useRef(null);
  const dentro = useRef(null);
  const role = useRef(null);
  const midia = useRef(null);
  const topoTexto = useRef(0);
  const video = useRef(null);
  const trilho = useRef(null);

  const [ini] = useState(inicio);
  const [tela, setTela] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [t, setT] = useState(() => agoraNY());
  const [loc, setLoc] = useState(ini.loc);
  const [cat, setCat] = useState(ini.cat);
  const [busca, setBusca] = useState("");
  const [ritual, setRitual] = useState([]);           // [{ k, nome, opc }]
  const [copiado, setCopiado] = useState(false);
  const [aberta, setAberta] = useState(0);            // pergunta aberta
  const [secao, setSecao] = useState("");
  const [passou, setPassou] = useState(false);
  const [rolou, setRolou] = useState(false);

  const u = UNIDADES[loc];
  const st = useMemo(() => statusDe(u, t), [u, t]);
  const [forte, fino] = vozDoBotao(u, st);

  /* relógio: um tick, 30s */
  useEffect(() => {
    const id = setInterval(() => setT(agoraNY()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ini.rolar) return undefined;
    const id = setTimeout(() => document.getElementById("menu")?.scrollIntoView(), 60);
    return () => clearTimeout(id);
  }, [ini]);
  const trocar = useCallback((l) => {
    setLoc(l);
    try { window.localStorage.setItem("ns-loc", l); } catch { /* sem storage */ }
  }, []);

  /* título, descrição e schema DO CLIENTE */
  useEffect(() => {
    const antes = document.title;
    document.title = TITULO;
    const md = document.querySelector('meta[name="description"]');
    const mdAntes = md?.getAttribute("content");
    md?.setAttribute("content", DESCRICAO);
    const ld = document.createElement("script");
    ld.type = "application/ld+json"; ld.id = "ns-ld"; ld.textContent = JSON.stringify(LD());
    document.head.appendChild(ld);
    /* 🚨 noindex ENQUANTO os preços não forem confirmados pela Lilian. Tirar esta linha é o ato de publicar. */
    const rb = document.createElement("meta");
    rb.name = "robots"; rb.content = "noindex, nofollow"; rb.id = "ns-robots";
    document.head.appendChild(rb);
    return () => { document.title = antes; if (md && mdAntes != null) md.setAttribute("content", mdAntes); ld.remove(); rb.remove(); };
  }, []);

  /* A PORTA: o furo cresce com a rolagem. Só mexe em transform/opacity. */
  useEffect(() => {
    const el = hero.current; if (!el) return undefined;
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const desenhar = () => {
      raf = 0;
      const W = window.innerWidth; const H = window.innerHeight;
      const curso = Math.max(1, el.offsetHeight - H);
      const p = calmo ? 0 : Math.min(1, Math.max(0, -el.getBoundingClientRect().top / curso));
      const largo = W >= 900;
      /* repouso: a porta do tamanho de uma porta */
      const prop = ARCO_IN_BOX.h / ARCO_IN_BOX.w;
      const margem = Math.max(40, (W - 1240) / 2);
      let k0; let cx0; let cy0;
      if (largo) {
        k0 = Math.min((H * 0.76) / prop, W * 0.36) / ARCO_IN_BOX.w;
        cx0 = W - margem - (k0 * 100) / 2;                 // 100 = largura da moldura de fora
        cy0 = H * 0.54;
      } else {
        const teto = 70; const chao = Math.max(teto + 170, (topoTexto.current || H * 0.5) - 14);
        k0 = Math.min((chao - teto) / ARCO_FORA_H, (W * 0.8) / 100);
        cx0 = W * 0.5;
        cy0 = teto + (k0 * ARCO_FORA_H) / 2;
      }
      /* fim: o retângulo inscrito do arco cobre a tela inteira */
      const k1 = Math.max(W / 43, H / 58) * 1.04;
      const e = Math.min(1, p / 0.82);
      const s = e * e * (3 - 2 * e);
      const k = k0 * Math.pow(k1 / k0, s);              // escala geométrica: a porta não "arranca"
      const cx = cx0 + (W / 2 - cx0) * s; const cy = cy0 + (H / 2 - cy0) * s;
      const ox = ARCO_IN_BOX.x + ARCO_IN_BOX.w / 2; const oy = ARCO_IN_BOX.y + ARCO_IN_BOX.h / 2;
      const tr = `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${k.toFixed(4)}) translate(${-ox} ${-oy})`;
      furo.current?.setAttribute("transform", tr);
      moldura.current?.setAttribute("transform", tr);
      /* ENQUADRAMENTO. No repouso o arco mostra ~30% da largura do quadro, centrado entre o emblema
         da porta e a coluna de flores (ponto 65,5% ; 56% do quadro 16:9). Conforme a porta abre, a
         mídia volta ao centro e à escala 1. "precisa" é a escala mínima que ainda cobre o furo:
         sem ela apareceria o fundo por trás do vídeo no meio do caminho. */
      if (midia.current) {
        const Wv = Math.max(W, (H * 16) / 9); const Hv = Math.max(H, (W * 9) / 16);
        const m0 = Math.min(1, (k0 * ARCO_IN_BOX.w) / 0.3 / Wv);
        const c0x = cx0 - m0 * (0.655 - 0.5) * Wv; const c0y = cy0 - m0 * (0.56 - 0.5) * Hv;
        const mx = c0x + (W / 2 - c0x) * s; const my = c0y + (H / 2 - c0y) * s;
        const hw = (k * ARCO_IN_BOX.w) / 2; const hh = (k * ARCO_IN_BOX.h) / 2;
        const esq = Math.max(0, cx - hw); const dir = Math.min(W, cx + hw);
        const cima = Math.max(0, cy - hh); const baixo = Math.min(H, cy + hh);
        const precisa = Math.max((Math.max(mx - esq, dir - mx) * 2) / Wv, (Math.max(my - cima, baixo - my) * 2) / Hv) * 1.02;
        const m = Math.max(m0 + (1 - m0) * s, precisa);
        const e = midia.current.style;
        if (e.width !== `${Wv}px`) { e.width = `${Wv}px`; e.height = `${Hv}px`; e.left = `${(W - Wv) / 2}px`; e.top = `${(H - Hv) / 2}px`; }
        e.transform = `translate3d(${(mx - W / 2).toFixed(1)}px,${(my - H / 2).toFixed(1)}px,0) scale(${m.toFixed(4)})`;
      }
      if (fala.current) { const o = Math.max(0, 1 - p * 3.2); fala.current.style.opacity = o; fala.current.style.transform = `translate3d(0,${(-p * 60).toFixed(1)}px,0)`; fala.current.style.pointerEvents = o < 0.3 ? "none" : ""; }
      if (dentro.current) { const o = Math.min(1, Math.max(0, (p - 0.62) / 0.24)); dentro.current.style.opacity = o; dentro.current.style.transform = `translate3d(0,${((1 - o) * 24).toFixed(1)}px,0)`; }
      if (moldura.current) moldura.current.style.opacity = Math.max(0, 1 - p * 2.2);
      if (role.current) role.current.style.opacity = Math.max(0, 1 - p * 8);
    };
    const pedir = () => { if (!raf) raf = requestAnimationFrame(desenhar); };
    const ler = () => { topoTexto.current = fala.current?.firstElementChild?.offsetTop || 0; };
    const medir = () => { setTela({ w: window.innerWidth, h: window.innerHeight }); ler(); pedir(); };
    ler(); desenhar();
    /* a fonte display chega depois e muda a altura do titulo: mede de novo */
    document.fonts?.ready?.then(() => { ler(); pedir(); }).catch(() => {});
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", medir);
    return () => { window.removeEventListener("scroll", pedir); window.removeEventListener("resize", medir); if (raf) cancelAnimationFrame(raf); };
  }, []);

  /* vídeo: 720p no celular; movimento reduzido fica no pôster */
  useEffect(() => {
    const v = video.current; if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /* ?filme=ia troca pelo TESTE com travelling gerado por IA a partir da foto real. Não é o
       padrão: o modelo inventou detalhes da fachada (ver PESQUISA.md), e isso é o salão de alguém. */
    const ia = new URLSearchParams(window.location.search).get("filme") === "ia";
    v.src = `${B}/${ia ? "hero-ia" : "hero"}${window.innerWidth < 900 ? "-720" : ""}.mp4`;
    v.play?.().catch(() => { /* autoplay negado: o pôster É a fachada deles */ });
  }, []);

  /* A LUZ. Folha de ouro e verniz mudam com o ângulo: aqui o ângulo é o ponteiro (ou a rolagem,
     onde não há ponteiro). Uma variável só, --luz de 0 a 1, lida por títulos, botões e placas. */
  useEffect(() => {
    const r = raiz.current; if (!r) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let raf = 0; let alvo = 0.3;
    const por = () => { raf = 0; r.style.setProperty("--luz", alvo.toFixed(3)); };
    const pedir = () => { if (!raf) raf = requestAnimationFrame(por); };
    const mouse = (e) => { if (e.pointerType === "touch") return; alvo = Math.min(1, Math.max(0, e.clientX / window.innerWidth)); pedir(); };
    const rolar = () => { if (window.matchMedia("(hover: hover)").matches) return; alvo = 0.5 + 0.5 * Math.sin(window.scrollY / 260); pedir(); };
    window.addEventListener("pointermove", mouse, { passive: true });
    window.addEventListener("scroll", rolar, { passive: true });
    return () => { window.removeEventListener("pointermove", mouse); window.removeEventListener("scroll", rolar); if (raf) cancelAnimationFrame(raf); };
  }, []);

  /* reveal FAIL-OPEN: só esconde depois do observer armar, e um timer solta tudo de qualquer jeito */
  useEffect(() => {
    const r = raiz.current; if (!r || !("IntersectionObserver" in window)) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden) return undefined;
    const alvos = Array.from(r.querySelectorAll(".ns-rv"));
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("ns-rv-on"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    alvos.forEach((a) => io.observe(a));
    r.classList.add("ns-js");
    const solta = setTimeout(() => alvos.forEach((a) => a.classList.add("ns-rv-on")), 1800);
    return () => { clearTimeout(solta); io.disconnect(); r.classList.remove("ns-js"); };
  }, []);

  /* o RAMO: progresso da página + seção atual */
  const SECOES = useMemo(() => [["locations", "Locations"], ["menu", "Menu"], ["inside", "Inside"], ["medspa", "Med Spa"], ["story", "Our story"], ["reviews", "Reviews"], ["gift", "Gift cards"]], []);
  useEffect(() => {
    let raf = 0;
    const ler = () => {
      raf = 0;
      const doc = document.documentElement;
      const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, doc.scrollHeight - window.innerHeight)));
      trilho.current?.style.setProperty("--p", p.toFixed(4));
      setPassou(window.scrollY > (hero.current?.offsetHeight || 0) - window.innerHeight * 0.5);
      setRolou(window.scrollY > 24);
      let atual = "";
      for (const [id] of SECOES) { const s = document.getElementById(id); if (s && s.getBoundingClientRect().top < window.innerHeight * 0.45) atual = id; }
      setSecao(atual);
    };
    const pedir = () => { if (!raf) raf = requestAnimationFrame(ler); };
    ler();
    window.addEventListener("scroll", pedir, { passive: true });
    return () => { window.removeEventListener("scroll", pedir); if (raf) cancelAnimationFrame(raf); };
  }, [SECOES]);

  /* ─── cardápio + ritual ─── */
  const col = loc === "ues" ? 2 : 1;
  const categoria = MENU.find((c) => c.id === cat) || MENU[0];
  const termo = busca.trim().toLowerCase();
  const grupos = useMemo(() => {
    const fonte = termo ? MENU.flatMap((c) => c.grupos.map((g) => ({ ...g, nome: `${c.nome} · ${g.nome}` }))) : categoria.grupos;
    return fonte
      .map((g) => ({ ...g, itens: g.itens.filter((i) => i[col] != null && (!termo || `${i[0]} ${notaDe(i[3], loc)}`.toLowerCase().includes(termo))) }))
      .filter((g) => g.itens.length);
  }, [categoria, termo, col, loc]);
  const indice = useMemo(() => {
    const m = new Map();
    MENU.forEach((c) => c.grupos.forEach((g) => g.itens.forEach((i) => m.set(chave(i[0]), i))));
    return m;
  }, []);
  const noRitual = (k, opc) => ritual.some((r) => r.k === k && r.opc === opc);
  const alternar = (nome, opc = "") => {
    const k = chave(nome);
    setRitual((rs) => (rs.some((r) => r.k === k && r.opc === opc)
      ? rs.filter((r) => !(r.k === k && r.opc === opc))
      : [...rs.filter((r) => r.k !== k), { k, nome, opc }]));   // um serviço, uma duração
    setCopiado(false);
  };
  const conta = useMemo(() => {
    let de = 0; let ate = 0; const linhas = []; const fora = [];
    ritual.forEach((r) => {
      const p = indice.get(r.k)?.[col];
      if (p == null) { fora.push(r.nome); return; }
      let v = p;
      if (ehOpcoes(p)) { v = p[r.opc] ?? Object.values(p)[0]; }
      const [a, b] = limites(v); de += a; ate += b;
      linhas.push(`${r.nome}${r.opc && ehOpcoes(p) && p[r.opc] != null ? ` (${r.opc})` : ""} — ${faixa(v)}`);
    });
    return { de, ate, linhas, fora, n: linhas.length };
  }, [ritual, indice, col]);
  const total = conta.de === conta.ate ? usd(conta.de) : `${usd(conta.de)}–${conta.ate.toLocaleString("en-US")}`;
  const copiar = async () => {
    const txt = `My Natura Spa ritual · ${u.curto}\n${conta.linhas.map((l) => `• ${l}`).join("\n")}\nEstimated total: ${total}`;
    try { await navigator.clipboard.writeText(txt); setCopiado(true); } catch { setCopiado(false); }
  };

  const clipFoto = `scale(${(1 / ARCO_IN_BOX.w).toFixed(6)} ${(1 / ARCO_IN_BOX.h).toFixed(6)}) translate(${-ARCO_IN_BOX.x} ${-ARCO_IN_BOX.y})`;

  return (
    <div className="ns" ref={raiz}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Manrope:wght@400;500;600;700;800&display=swap');
        .ns{--petrol:#015577;--fundo:#013B52;--tinta:#0A2A38;--ouro-a:#E7C673;--ouro-b:#BC8E40;--ouro-t:#8A6424;--marmore:#F7F4EE;--papel:#FCFBF8;--flor:#A3001C;--verde:#56741F;--fio:rgba(1,85,119,.16);
          position:relative;background:var(--marmore);color:var(--tinta);font-family:'Manrope',system-ui,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:clip}
        .ns *{box-sizing:border-box}
        .ns a{color:inherit;text-decoration:none}
        .ns button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
        .ns h1,.ns h2,.ns h3{font-family:'Jost','Manrope',sans-serif;font-weight:300;letter-spacing:-.028em;line-height:1.04;margin:0;color:var(--fundo)}
        /* ESMALTE: a letra e incrustada no marmore. A luz de baixo (1px branco) e o que da a espessura. */
        .ns h1,.ns h2{background:linear-gradient(180deg,#0A6E94 0%,#015577 38%,#013B52 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 0 rgba(255,255,255,.75)) drop-shadow(0 8px 14px rgba(1,59,82,.10))}
        /* FOLHA DE OURO: faixas claras e escuras como folha de verdade, e a luz anda com o ponteiro (--luz) */
        .ns h1 em,.ns h2 em{font-style:normal;font-weight:500;
          background:linear-gradient(100deg,#7A5518 0%,#B8873A 14%,#F3DC98 27%,#C99B45 38%,#8A6424 50%,#C99B45 62%,#F6E7B0 74%,#B8873A 86%,#7A5518 100%);
          background-size:240% 100%;background-position:calc(var(--luz,.3)*100%) 0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;transition:background-position .5s cubic-bezier(.2,.7,.2,1)}
        .ns-sec-noite h2,.ns-fim h2{background:linear-gradient(180deg,#FFFFFF 0%,#E8F1F5 60%,#B9D2DC 100%);-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 -1px 0 rgba(255,255,255,.25)) drop-shadow(0 10px 18px rgba(0,0,0,.35))}
        .ns-sec-noite h2 em,.ns-fim h2 em{background:linear-gradient(100deg,#B8873A 0%,#E7C673 14%,#FFF4CC 27%,#E7C673 38%,#B8873A 50%,#E7C673 62%,#FFF4CC 74%,#E7C673 86%,#B8873A 100%);background-size:240% 100%;background-position:calc(var(--luz,.3)*100%) 0;-webkit-background-clip:text;background-clip:text}
        .ns p{margin:0}
        .ns :focus-visible{outline:2px solid var(--petrol);outline-offset:3px;border-radius:4px}
        .ns-in{width:min(1240px,100% - 40px);margin-inline:auto}
        .ns-num{font-variant-numeric:tabular-nums}

        /* grao de papel: o marmore nao e branco chapado */
        .ns::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.32;mix-blend-mode:multiply;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .32 0 0 0 0 .26 0 0 0 .16 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E")}
        .ns>*{position:relative;z-index:1}

        /* ── BOTAO: peca de vidro com espessura, pontas em ogiva ──
           camadas, de baixo pra cima: sombra de ambiente + sombra de contato · corpo (metal ou
           esmalte) · brilho especular que anda com a luz · verniz de cima · aro de luz · texto.
           O corpo e UM elemento recortado por mascara de 3 partes (ponta, meio, ponta): assim o
           vidro fosco (backdrop-filter) tambem respeita a ogiva. */
        .ns-btn{--capL:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 54' preserveAspectRatio='none'%3E%3Cpath d='M24,0 C17.5,0 15.6,5.2 13.2,11.4 C10.6,18.2 6.4,23.4 0,27 C6.4,30.6 10.6,35.8 13.2,42.6 C15.6,48.8 17.5,54 24,54 Z'/%3E%3C/svg%3E");
          --capR:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 54' preserveAspectRatio='none'%3E%3Cpath d='M0,0 C6.5,0 8.4,5.2 10.8,11.4 C13.4,18.2 17.6,23.4 24,27 C17.6,30.6 13.4,35.8 10.8,42.6 C8.4,48.8 6.5,54 0,54 Z'/%3E%3C/svg%3E");
          --cw:26px;--forma:var(--capL) left center/var(--cw) 100% no-repeat,var(--capR) right center/var(--cw) 100% no-repeat,linear-gradient(#000,#000) center/calc(100% - var(--cw)*2 + 2px) 100% no-repeat;
          position:relative;display:inline-flex;align-items:center;justify-content:center;min-height:58px;padding:0 40px;isolation:isolate;cursor:pointer;
          transition:transform .4s cubic-bezier(.2,.7,.2,1)}
        .ns-btn:hover{transform:translateY(-2px)}
        .ns-btn:active{transform:translateY(1px) scale(.985);transition-duration:.08s}
        .ns-somb{position:absolute;inset:0;z-index:-3;pointer-events:none;transition:opacity .4s ease,transform .4s cubic-bezier(.2,.7,.2,1)}
        .ns-somb i{position:absolute;inset:0;-webkit-mask:var(--forma);mask:var(--forma);background:var(--sc,#013B52)}
        .ns-somb-a{filter:blur(13px);transform:translateY(12px) scale(.93,.78);opacity:.42}
        .ns-somb-c{filter:blur(2.5px);transform:translateY(2.5px) scale(.985,.96);opacity:.5}
        .ns-btn:hover .ns-somb-a{transform:translateY(17px) scale(.95,.82);opacity:.5}
        .ns-btn:active .ns-somb-a{transform:translateY(5px) scale(.93,.7);opacity:.3}
        .ns-corpo{position:absolute;inset:0;z-index:-2;overflow:hidden;-webkit-mask:var(--forma);mask:var(--forma)}
        /* verniz: metade de cima mais clara, com a borda curva de uma gota de resina */
        .ns-corpo::before{content:"";position:absolute;left:-6%;right:-6%;top:-60%;height:112%;border-radius:0 0 50% 50%/0 0 100% 100%;
          background:linear-gradient(180deg,rgba(255,255,255,.0) 40%,rgba(255,255,255,var(--verniz,.5)) 100%);mix-blend-mode:screen;pointer-events:none}
        /* varredura de luz no hover */
        .ns-corpo::after{content:"";position:absolute;top:0;bottom:0;left:0;width:46%;background:linear-gradient(105deg,transparent 0%,rgba(255,255,255,.0) 20%,rgba(255,255,255,.7) 50%,rgba(255,255,255,0) 80%,transparent 100%);transform:translateX(-160%) skewX(-16deg);pointer-events:none}
        .ns-btn:hover .ns-corpo::after{transform:translateX(330%) skewX(-16deg);transition:transform 1s cubic-bezier(.2,.7,.2,1)}
        .ns-cap{position:absolute;top:0;height:100%;width:var(--cw);z-index:-1;overflow:visible;pointer-events:none}
        .ns-cap-l{left:0}.ns-cap-r{right:0;transform:scaleX(-1)}
        .ns-cap path{fill:none;stroke-width:1.1;vector-effect:non-scaling-stroke}
        .ns-btn-t{display:flex;flex-direction:column;align-items:center;line-height:1.15;text-align:center;white-space:nowrap}
        .ns-btn-t b{font-family:'Jost','Manrope',sans-serif;font-weight:500;font-size:17px;letter-spacing:.005em}
        .ns-btn-t i{font-style:normal;font-size:11.5px;font-weight:600;letter-spacing:.02em;opacity:.8;margin-top:2px}

        /* OURO escovado sob verniz */
        .ns .ns-btn-ouro{color:#2A1D05;--sc:#7A5518;--verniz:.55}
        .ns-btn-ouro .ns-btn-t{text-shadow:0 1px 0 rgba(255,244,204,.75)}
        .ns-btn-ouro .ns-corpo{background:
            radial-gradient(70% 160% at calc(var(--luz,.3)*100%) -10%,rgba(255,255,255,.62),rgba(255,255,255,0) 58%),
            repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,rgba(0,0,0,0) 1px 3px),
            linear-gradient(180deg,#F8E6AE 0%,#EBCB7A 30%,#D4A851 48%,#A9782E 54%,#C3943F 74%,#DDB866 100%);
          box-shadow:inset 0 1px 0 rgba(255,250,225,.95),inset 0 -1px 0 rgba(84,56,8,.7),inset 0 -12px 14px -10px rgba(84,56,8,.45)}
        .ns-btn-ouro .ns-cap path{stroke:url(#ns-rim-ouro)}
        /* ESMALTE petroleo sob verniz, aro de ouro */
        .ns .ns-btn-petrol{color:#FFFFFF;--sc:#011E2B;--verniz:.2}
        .ns-btn-petrol .ns-btn-t{text-shadow:0 1px 2px rgba(0,20,30,.75)}
        .ns-btn-petrol .ns-corpo{background:
            radial-gradient(60% 120% at calc(var(--luz,.3)*100%) -20%,rgba(160,220,245,.34),rgba(255,255,255,0) 58%),
            linear-gradient(180deg,#127FA8 0%,#0A6488 28%,#015577 48%,#012E41 54%,#013B52 76%,#02506F 100%);
          box-shadow:inset 0 1px 0 rgba(231,198,115,.95),inset 0 2px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(188,142,64,.9),inset 0 -12px 14px -10px rgba(0,12,20,.6)}
        .ns-btn-petrol .ns-cap path{stroke:url(#ns-rim-ouro)}
        /* VIDRO fosco: nao tem cor propria, deixa passar o que esta atras */
        .ns .ns-btn-linha{color:var(--fundo);--sc:#013B52;--verniz:.7}
        .ns-btn-linha .ns-somb-a{opacity:.22}.ns-btn-linha .ns-somb-c{opacity:.28}
        .ns-btn-linha .ns-corpo{background:
            radial-gradient(70% 160% at calc(var(--luz,.3)*100%) -10%,rgba(255,255,255,.9),rgba(255,255,255,0) 58%),
            linear-gradient(104deg,transparent 22%,rgba(255,255,255,.55) 36%,transparent 50%),
            linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.26));
          -webkit-backdrop-filter:blur(14px) saturate(1.5);backdrop-filter:blur(14px) saturate(1.5);
          box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(1,59,82,.35),inset 0 -10px 14px -10px rgba(1,59,82,.18)}
        .ns-btn-linha .ns-cap path{stroke:url(#ns-rim-vidro)}
        .ns-btn-p{min-height:46px;padding:0 32px;--cw:21px}
        .ns-btn-p .ns-btn-t b{font-size:15px}
        .ns-btn-p .ns-somb-a{filter:blur(10px);transform:translateY(9px) scale(.93,.76)}

        /* ── TOPO ── */
        .ns-topo{position:fixed;top:0;left:0;right:0;z-index:40;padding:10px 0;transition:background .4s ease,box-shadow .4s ease}
        .ns-topo-on{background:rgba(247,244,238,.86);backdrop-filter:saturate(1.3) blur(14px);-webkit-backdrop-filter:saturate(1.3) blur(14px);box-shadow:0 1px 0 var(--fio)}
        .ns-topo .ns-in{display:flex;align-items:center;gap:18px;flex-wrap:nowrap}
        .ns-logo{display:block;flex:none}
        .ns-logo img{height:34px;width:auto;display:block}
        .ns-nav{display:none;gap:4px;margin-left:auto}
        .ns-nav a{padding:9px 13px;font-size:13.5px;font-weight:600;color:var(--fundo);border-radius:4px;transition:color .25s ease}
        .ns-nav a:hover,.ns-nav a[aria-current="true"]{color:var(--ouro-t)}
        .ns-topo .ns-btn{margin-left:auto}
        @media(min-width:1080px){.ns-nav{display:flex}.ns-topo .ns-btn{margin-left:8px}}
        .ns-so-p{display:none}
        @media(max-width:520px){.ns-topo .ns-btn-t i,.ns-so-g{display:none}.ns-so-p{display:inline}.ns-logo img{height:26px}.ns-topo .ns-btn{padding:0 26px}.ns-topo .ns-in{gap:10px}}

        /* ── HERO: a porta ── */
        .ns-hero{height:230vh;position:relative}
        .ns-palco{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;background:var(--fundo)}
        .ns-midia{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:50% 50%;will-change:transform}
        .ns-filme{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%}
        .ns-lente{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(1,30,43,.34) 100%)}
        .ns-parede{position:absolute;inset:0;width:100%;height:100%;display:block}
        .ns-fala{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:0 20px 34px;will-change:transform,opacity}
        .ns-fala h1{font-size:clamp(38px,11.4vw,54px)}
        .ns-vivo{margin-bottom:12px}
        @media(max-width:899px){.ns-lead{font-size:15.5px;line-height:1.5;margin-top:14px}.ns-acoes{margin-top:18px}.ns-fala .ns-btn-linha{min-height:48px}.ns-fala .ns-btn-linha .ns-btn-t i{display:none}}
        .ns-vivo i{font-style:normal}
        @media(max-width:520px){.ns-vivo i{display:none}}
        .ns-vivo{display:inline-flex;align-self:flex-start;align-items:center;gap:9px;padding:8px 16px 8px 12px;border-radius:999px;
          background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,.45));box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(1,59,82,.14),0 1px 2px rgba(1,59,82,.14),0 12px 22px -14px rgba(1,59,82,.5);font-size:13px;font-weight:600;letter-spacing:0;color:var(--fundo)}
        .ns-vivo span::first-letter{text-transform:uppercase}
        @media(min-width:900px){.ns-vivo{margin-bottom:22px}}
        .ns-vivo u{flex:none;text-decoration:none;width:8px;height:8px;border-radius:50%;background:var(--verde);box-shadow:0 0 0 4px rgba(86,116,31,.18)}
        .ns-vivo u.ns-fechado{background:var(--ouro-b);box-shadow:0 0 0 4px rgba(188,142,64,.2)}
        .ns-lead{font-size:16.5px;color:#23485A;max-width:30em;margin-top:22px}
        .ns-acoes{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
        .ns-role{display:none}
        @media(min-width:900px){
          .ns-fala{justify-content:center;padding:0 0 0 max(40px,calc((100vw - 1240px)/2));width:52%}
          .ns-fala h1{font-size:clamp(56px,6vw,96px)}
          .ns-lead{font-size:18.5px;margin-top:34px}
          .ns-acoes{margin-top:32px}
          .ns-role{display:flex;position:absolute;left:max(40px,calc((100vw - 1240px)/2));bottom:34px;align-items:center;gap:12px;font-family:'Jost','Manrope',sans-serif;font-size:16px;font-weight:400;color:var(--petrol)}
          .ns-role::before{content:"";width:46px;height:1px;background:var(--petrol)}
        }
        .ns-dentro{position:absolute;left:0;right:0;bottom:0;padding:0 20px 8vh;opacity:0;color:#fff;background:linear-gradient(180deg,transparent 0%,rgba(1,30,43,.72) 70%);padding-top:22vh;will-change:transform,opacity;pointer-events:none}
        .ns-dentro p.ns-g{font-family:'Jost','Manrope',sans-serif;font-weight:300;font-size:clamp(44px,8vw,112px);line-height:1;letter-spacing:-.025em;color:#fff}
        .ns-dentro p.ns-s{margin-top:10px;font-family:'Jost','Manrope',sans-serif;font-size:19px;font-weight:400;color:var(--ouro-a)}

        /* ── IMPRENSA ── */
        .ns-prensa{background:var(--fundo);color:#DCE9EE;padding:22px 0}
        .ns-prensa .ns-in{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 28px}
        .ns-prensa b{font-family:'Jost','Manrope',sans-serif;font-weight:500;font-size:19px;color:#fff}
        .ns-prensa span{font-family:'Jost','Manrope',sans-serif;font-size:16px;color:var(--ouro-a)}
        .ns-prensa i{font-style:normal;font-size:13.5px;opacity:.78}

        /* ── SECOES ── */
        .ns-sec{padding:clamp(72px,10vw,132px) 0}
        .ns-sec-papel{background:var(--papel);box-shadow:inset 0 1px 0 var(--fio),inset 0 -1px 0 var(--fio)}
        .ns-sec-noite{background:radial-gradient(110% 80% at 80% 0%,#0A6E94 0%,#015577 34%,#013B52 100%);color:#DCE9EE}
        .ns-sec-noite h3{color:#fff}
        .ns-cab{max-width:760px;margin-bottom:clamp(34px,5vw,60px)}
        .ns-cab h2{font-size:clamp(36px,5.4vw,70px)}
        .ns-sobre{font-family:'Jost','Manrope',sans-serif;font-size:17px;font-weight:400;letter-spacing:0;color:var(--ouro-t);margin-bottom:10px}
        .ns-cab-claro .ns-sobre{color:var(--ouro-a)}
        .ns-ramo{position:relative;width:120px;height:40px;margin-bottom:10px;color:var(--ouro-b)}
        .ns-ramo-l{width:120px;height:40px;overflow:visible}
        .ns-ramo-l path{fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0}
        .ns-ramo-f{position:absolute;right:-16px;top:-6px;width:22px;height:22px;transform-origin:50% 60%}
        .ns-js .ns-cab .ns-ramo-l path{stroke-dashoffset:1;transition:stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1) .15s}
        .ns-js .ns-cab .ns-ramo-f{transform:scale(0) rotate(-70deg);transition:transform .8s cubic-bezier(.2,1.3,.4,1) 1.2s}
        .ns-js .ns-cab.ns-rv-on .ns-ramo-l path{stroke-dashoffset:0}
        .ns-js .ns-cab.ns-rv-on .ns-ramo-f{transform:none}
        .ns-js .ns-rv{opacity:0;transform:translate3d(0,22px,0);transition:opacity .9s ease,transform .9s cubic-bezier(.2,.7,.2,1)}
        .ns-js .ns-rv.ns-rv-on{opacity:1;transform:none}

        /* ── AS TRES PORTAS ── */
        .ns-portas{display:grid;gap:22px}
        @media(min-width:860px){.ns-portas{grid-template-columns:repeat(3,1fr);gap:26px}}
        .ns-porta{position:relative;display:flex;flex-direction:column;background:linear-gradient(180deg,#fff 0%,var(--papel) 100%);border-radius:6px;padding:26px 24px 24px;
          box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(1,59,82,.1),0 1px 2px rgba(1,59,82,.1),0 24px 48px -24px rgba(1,59,82,.34);transition:transform .5s cubic-bezier(.2,.7,.2,1),box-shadow .5s ease}
        .ns-porta::after,.ns-numero::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
          background:linear-gradient(104deg,transparent calc(var(--luz,.3)*60% - 4%),rgba(255,255,255,.75) calc(var(--luz,.3)*60% + 10%),transparent calc(var(--luz,.3)*60% + 24%));mix-blend-mode:soft-light;transition:background .5s ease}
        .ns-numero{position:relative}
        .ns-porta:hover{transform:translateY(-4px);box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(1,59,82,.1),0 1px 2px rgba(1,59,82,.1),0 34px 60px -24px rgba(1,59,82,.42)}
        .ns-porta-on{box-shadow:inset 0 0 0 1.5px var(--ouro-b),0 1px 2px rgba(1,59,82,.1),0 24px 48px -24px rgba(1,59,82,.34)}
        .ns-vao{position:relative;width:min(78%,250px);margin:0 auto 20px;aspect-ratio:${ARCO_IN_BOX.w}/${ARCO_IN_BOX.h}}
        .ns-vao img,.ns-vao .ns-vao-c{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;clip-path:url(#ns-clip)}
        .ns-vao img{transition:transform 1.4s cubic-bezier(.2,.7,.2,1)}
        .ns-porta:hover .ns-vao img{transform:scale(1.06)}
        .ns-vao-c{background:radial-gradient(90% 70% at 50% 25%,#0A6E94 0%,#015577 45%,#013B52 100%);display:grid;place-items:center;color:var(--ouro-a)}
        .ns-vao-c svg{width:34%;height:auto}
        .ns-vao>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
        .ns-porta h3{font-size:30px}
        .ns-porta .ns-tipo{font-family:'Jost','Manrope',sans-serif;font-size:15px;color:var(--ouro-t);margin-bottom:2px}
        .ns-porta address{font-style:normal;color:#23485A;margin-top:8px}
        .ns-linha{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--fio);font-size:14px}
        .ns-linha:first-of-type{margin-top:16px}
        .ns-linha b{font-weight:600;color:var(--fundo)}
        .ns-estado{display:inline-flex;align-items:center;gap:8px;font-weight:700;color:var(--fundo)}
        .ns-estado u{text-decoration:none;width:7px;height:7px;border-radius:50%;background:var(--verde)}
        .ns-estado u.ns-fechado{background:var(--ouro-b)}
        .ns-porta-pe{display:flex;flex-wrap:wrap;gap:10px;margin-top:auto;padding-top:20px}
        .ns-lnk{font-size:13.5px;font-weight:700;color:var(--petrol);border-bottom:1px solid currentColor;padding-bottom:1px;align-self:center;min-height:0}
        .ns-lnk:hover{color:var(--ouro-t)}

        /* ── CARDAPIO ── */
        .ns-chave{display:inline-flex;padding:4px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1px var(--fio),0 8px 20px -12px rgba(1,59,82,.4)}
        .ns-chave button{padding:10px 20px;min-height:42px;border-radius:999px;font-size:14px;font-weight:700;color:var(--petrol);transition:background .3s ease,color .3s ease}
        .ns-chave button[aria-pressed="true"]{background:linear-gradient(180deg,#0A6E94,#013B52);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
        .ns-barra{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;margin-bottom:26px}
        .ns-barra small{font-size:13px;color:#3B6172}
        .ns-busca{flex:1 1 220px;max-width:340px;min-height:44px;padding:0 16px;border-radius:999px;border:0;background:#fff;box-shadow:inset 0 0 0 1px var(--fio);font:inherit;font-size:14.5px;color:var(--tinta)}
        .ns-busca::placeholder{color:#6A8A97}
        .ns-abas{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--fio);margin-bottom:8px}
        .ns-abas::-webkit-scrollbar{display:none}
        .ns-abas button{flex:none;padding:14px 16px;min-height:48px;font-family:'Jost','Manrope',sans-serif;font-size:21px;color:#3B6172;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .3s ease,border-color .3s ease}
        .ns-abas button[aria-selected="true"]{color:var(--fundo);border-color:var(--ouro-b)}
        .ns-intro{font-size:15px;color:#3B6172;padding:14px 0 6px;max-width:46em}
        .ns-grade{display:grid;gap:0 56px}
        @media(min-width:980px){.ns-grade{grid-template-columns:1fr 1fr}}
        .ns-grupo{padding-top:26px;break-inside:avoid}
        .ns-grupo h3{font-size:22px;font-weight:500;letter-spacing:-.01em;color:var(--ouro-t);padding-bottom:8px;border-bottom:1px solid var(--ouro-b)}
        .ns-item{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--fio);min-height:56px}
        .ns-item-n{flex:1;min-width:0}
        .ns-item-n b{display:block;font-weight:600;font-size:15.5px;color:var(--fundo);line-height:1.3}
        .ns-item-n i{display:block;font-style:normal;font-size:12.5px;color:#4D7282;line-height:1.35;margin-top:2px}
        .ns-preco{font-weight:700;font-size:15.5px;color:var(--fundo);white-space:nowrap}
        .ns-mais{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:var(--petrol);
          background:radial-gradient(90% 70% at 35% 18%,#fff 0%,rgba(255,255,255,.5) 40%,rgba(220,233,238,.7) 100%);
          box-shadow:inset 0 1px 0 #fff,inset 0 -2px 3px rgba(1,59,82,.18),inset 0 0 0 1px rgba(1,85,119,.35),0 1px 2px rgba(1,59,82,.25),0 8px 14px -8px rgba(1,59,82,.4);transition:background .25s ease,color .25s ease,transform .25s ease,box-shadow .25s ease}
        .ns-mais:hover{transform:scale(1.07)}
        .ns-mais[aria-pressed="true"]{background:radial-gradient(90% 70% at 35% 18%,#FFF4CC 0%,#E7C673 45%,#A9782E 100%);color:#2A1D05;box-shadow:inset 0 1px 0 #FFF6D6,inset 0 -2px 3px rgba(84,56,8,.4),0 1px 2px rgba(84,56,8,.4),0 8px 14px -8px rgba(122,85,24,.7)}
        .ns-mais svg{width:15px;height:15px;transition:transform .3s cubic-bezier(.2,1.3,.4,1)}
        .ns-mais[aria-pressed="true"] svg{transform:rotate(45deg)}
        .ns-opcs{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
        .ns-opc{display:flex;flex-direction:column;align-items:center;min-width:64px;min-height:44px;padding:5px 10px;border-radius:6px;box-shadow:inset 0 0 0 1px var(--fio);background:#fff;line-height:1.15;transition:box-shadow .25s ease,background .25s ease}
        .ns-opc span{font-size:11.5px;font-weight:600;color:#4D7282}
        .ns-opc b{font-size:14.5px;font-weight:700;color:var(--fundo)}
        .ns-opc:hover{box-shadow:inset 0 0 0 1px var(--petrol)}
        .ns-opc{box-shadow:inset 0 1px 0 #fff,inset 0 0 0 1px var(--fio),0 1px 2px rgba(1,59,82,.12)}
        .ns-opc[aria-pressed="true"]{background:linear-gradient(180deg,#F8E6AE 0%,#E7C673 46%,#A9782E 54%,#D4A851 100%);box-shadow:inset 0 1px 0 #FFF6D6,inset 0 -1px 0 rgba(84,56,8,.6),0 6px 12px -6px rgba(122,85,24,.6)}
        .ns-opc[aria-pressed="true"] span,.ns-opc[aria-pressed="true"] b{color:#2A1D05}
        .ns-vazio{padding:40px 0;color:#3B6172}
        .ns-doca{position:sticky;bottom:12px;z-index:20;margin-top:34px;display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;padding:16px 20px;border-radius:8px;color:#DCE9EE;
          background:linear-gradient(180deg,#0A6E94 0%,#015577 30%,#013B52 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 0 0 1px rgba(231,198,115,.4),0 22px 44px -18px rgba(1,30,43,.7)}
        .ns-doca-t{flex:1 1 240px;min-width:0}
        .ns-doca-t b{display:block;font-family:'Jost','Manrope',sans-serif;font-weight:400;font-size:24px;color:#fff;line-height:1.1}
        .ns-doca-t>span{display:block;font-size:13px;opacity:.85;margin-top:3px}
        @media(max-width:1419px){.ns-doca{padding-right:92px}}
        .ns-doca button.ns-txt{font-size:13px;font-weight:700;color:var(--ouro-a);border-bottom:1px solid currentColor;min-height:0}
        .ns-rodape-menu{margin-top:22px;font-size:13px;color:#4D7282;max-width:60em}

        /* ── FITA ── */
        .ns-fita{display:flex;gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;padding:6px max(20px,calc((100vw - 1240px)/2)) 26px;scrollbar-width:thin;scrollbar-color:var(--ouro-b) transparent}
        .ns-quadro{flex:none;width:min(80vw,620px);scroll-snap-align:center;margin:0}
        .ns-quadro div{position:relative;overflow:hidden;border-radius:6px;aspect-ratio:3/2;background:#DCE9EE;box-shadow:0 1px 2px rgba(1,59,82,.14),0 30px 54px -28px rgba(1,59,82,.5)}
        .ns-quadro div::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 100% at 50% 45%,transparent 62%,rgba(1,30,43,.22) 100%);pointer-events:none}
        .ns-quadro img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 1.6s cubic-bezier(.2,.7,.2,1)}
        .ns-quadro:hover img{transform:scale(1.045)}
        .ns-quadro figcaption{font-size:13.5px;color:#3B6172;padding-top:12px}

        /* ── MED SPA ── */
        .ns-med{display:grid;gap:40px}
        @media(min-width:980px){.ns-med{grid-template-columns:1.25fr .75fr;gap:72px;align-items:start}}
        .ns-med-l{display:grid;grid-template-columns:1fr auto;gap:4px 20px;padding:18px 0;border-top:1px solid rgba(231,198,115,.3)}
        .ns-med-l:last-child{border-bottom:1px solid rgba(231,198,115,.3)}
        .ns-med-l h3{font-size:25px}
        .ns-med-l p{font-size:14px;opacity:.82;grid-column:1}
        .ns-med-l strong{grid-row:1/3;grid-column:2;text-align:right;font-family:'Jost','Manrope',sans-serif;font-weight:400;font-size:25px;color:var(--ouro-a);white-space:nowrap}
        .ns-med-l strong small{display:block;font-family:'Manrope',sans-serif;font-size:12.5px;font-weight:500;letter-spacing:0;color:#9CC7D8}
        .ns-cartao-v{padding:28px 26px;border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.03));box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 0 0 1px rgba(255,255,255,.1),0 30px 60px -30px rgba(0,0,0,.6)}
        .ns-cartao-v h3{font-size:30px;margin-bottom:10px}
        .ns-cartao-v p{font-size:14.5px;opacity:.86}
        .ns-cartao-v .ns-btn{margin-top:22px}
        .ns-casa{margin-top:26px;padding-top:22px;border-top:1px solid rgba(231,198,115,.3)}
        .ns-casa li{display:flex;justify-content:space-between;gap:12px;font-size:14.5px;padding:5px 0}
        .ns-casa ul{list-style:none;margin:10px 0 0;padding:0}

        /* ── HISTORIA ── */
        .ns-hist{display:grid;gap:44px}
        @media(min-width:980px){.ns-hist{grid-template-columns:.9fr 1.1fr;gap:80px;align-items:start}.ns-hist-e{position:sticky;top:110px}}
        .ns-hist-e>p{font-size:17px;color:#23485A;margin-top:20px;max-width:32em}
        .ns-tempo{list-style:none;margin:0;padding:0;border-left:1px solid var(--ouro-b)}
        .ns-tempo li{position:relative;padding:0 0 34px 30px}
        .ns-tempo li:last-child{padding-bottom:0}
        .ns-tempo li svg{position:absolute;left:-11px;top:2px;width:21px;height:21px;color:var(--ouro-b);background:var(--marmore);border-radius:50%}
        .ns-tempo span{font-family:'Jost','Manrope',sans-serif;font-size:16px;color:var(--ouro-t)}
        .ns-tempo h3{font-size:28px;margin:4px 0 6px}
        .ns-tempo p{color:#23485A;font-size:15.5px;max-width:34em}

        /* ── NUMEROS ── */
        .ns-nums{display:grid;gap:22px}
        @media(min-width:760px){.ns-nums{grid-template-columns:repeat(3,1fr)}}
        .ns-numero{padding:26px 24px;border-radius:6px;background:linear-gradient(180deg,#fff,var(--papel));box-shadow:inset 0 1px 0 #fff,0 1px 2px rgba(1,59,82,.1),0 24px 48px -28px rgba(1,59,82,.34)}
        .ns-numero b{display:block;font-family:'Jost','Manrope',sans-serif;font-weight:300;font-size:clamp(56px,6vw,84px);line-height:1;color:var(--fundo);letter-spacing:-.03em}
        .ns-numero b sup{font-size:.34em;color:var(--ouro-t);margin-left:4px;vertical-align:top;position:relative;top:.5em}
        .ns-numero p{font-size:14.5px;color:#23485A;margin-top:10px}
        .ns-numero a{display:inline-block;margin-top:12px}
        .ns-nota{margin-top:22px;font-size:13px;color:#4D7282}

        /* ── PERGUNTAS ── */
        .ns-duas{display:grid;gap:44px}
        @media(min-width:980px){.ns-duas{grid-template-columns:.8fr 1.2fr;gap:80px}}
        .ns-duas .ns-acoes{margin-top:28px}
        .ns-perg{border-top:1px solid var(--fio)}
        .ns-perg:last-child{border-bottom:1px solid var(--fio)}
        .ns-perg button{display:flex;justify-content:space-between;align-items:center;gap:16px;width:100%;text-align:left;padding:20px 0;min-height:64px;font-family:'Jost','Manrope',sans-serif;font-size:22px;color:var(--fundo);line-height:1.2}
        .ns-perg button svg{flex:none;width:16px;height:16px;color:var(--ouro-t);transition:transform .4s cubic-bezier(.2,.7,.2,1)}
        .ns-perg button[aria-expanded="true"] svg{transform:rotate(45deg)}
        .ns-resp{display:grid;grid-template-rows:0fr;transition:grid-template-rows .5s cubic-bezier(.2,.7,.2,1)}
        .ns-resp[data-on="1"]{grid-template-rows:1fr}
        .ns-resp>div{overflow:hidden}
        .ns-resp p{padding:0 0 22px;color:#23485A;max-width:44em}

        /* ── RODAPE ── */
        .ns-fim{background:#012A3B;color:#B9D2DC;padding:clamp(64px,8vw,100px) 0 34px}
        .ns-fim h2{font-size:clamp(36px,5vw,64px)}
        .ns-fim-g{display:grid;gap:34px;margin-top:48px}
        @media(min-width:860px){.ns-fim-g{grid-template-columns:repeat(3,1fr) .8fr}}
        .ns-fim h3{font-size:22px;font-weight:500;letter-spacing:-.01em;color:var(--ouro-a);margin-bottom:10px}
        .ns-fim address,.ns-fim li{font-style:normal;font-size:14.5px;line-height:1.75}
        .ns-fim ul{list-style:none;margin:0;padding:0}
        .ns-fim a:not(.ns-btn):hover{color:var(--ouro-a)}
        .ns-fim-tel{font-family:'Jost','Manrope',sans-serif;font-size:24px;color:#fff;display:inline-block;margin-top:6px}
        .ns-base{margin-top:30px;padding:22px 92px 0 0;border-top:1px solid rgba(231,198,115,.24);display:flex;flex-wrap:wrap;gap:10px 28px;justify-content:space-between;font-size:12.5px;opacity:.8}
        .ns-aviso{margin-top:40px;font-size:12.5px;color:#8FB3C1;max-width:70em}

        /* ── O RAMO: trilho de navegacao ── */
        .ns-trilho{display:none}
        @media(min-width:1400px){
          .ns-trilho{--p:0;display:block;position:fixed;left:18px;top:50%;z-index:30;width:44px;height:min(60vh,520px);transform:translateY(-50%);opacity:0;pointer-events:none;transition:opacity .6s ease}
          .ns-trilho-on{opacity:1;pointer-events:auto}
          .ns-trilho svg.ns-haste{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
          .ns-haste path{fill:none;stroke-width:1.3;stroke-linecap:round;vector-effect:non-scaling-stroke}
          .ns-haste .ns-h0{stroke:rgba(1,85,119,.2)}
          .ns-haste .ns-h1{stroke:var(--ouro-b);stroke-dasharray:1;stroke-dashoffset:calc(1 - var(--p))}
          .ns-botao-flor{position:absolute;left:50%;width:30px;height:30px;margin:-15px 0 0 -15px;display:grid;place-items:center;color:rgba(1,85,119,.34);transition:color .4s ease,transform .5s cubic-bezier(.2,1.3,.4,1)}
          .ns-botao-flor svg{width:17px;height:17px}
          .ns-botao-flor[aria-current="true"]{color:var(--flor);transform:scale(1.35) rotate(18deg)}
          .ns-botao-flor.ns-ja{color:var(--ouro-b)}
          .ns-botao-flor span{position:absolute;left:34px;white-space:nowrap;font-size:13px;font-weight:600;color:var(--fundo);background:rgba(247,244,238,.92);padding:4px 9px;border-radius:4px;opacity:0;transform:translateX(-6px);transition:opacity .3s ease,transform .3s ease;pointer-events:none}
          .ns-botao-flor:hover span,.ns-botao-flor:focus-visible span{opacity:1;transform:none}
        }

        @media(prefers-reduced-motion:reduce){
          .ns-hero{height:100vh;height:100svh}
          .ns *{transition-duration:.01ms !important;animation-duration:.01ms !important}
        }
      `}</style>

      {/* definições compartilhadas: gradientes das pontas e o recorte em arco */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="ns-rim-ouro" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="54"><stop offset="0" stopColor="#FFF6D6" /><stop offset=".5" stopColor="#D9B45F" /><stop offset="1" stopColor="#6E4A10" /></linearGradient>
          <linearGradient id="ns-rim-vidro" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="54"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".5" stopColor="#7FB0C4" /><stop offset="1" stopColor="#015577" /></linearGradient>
          <clipPath id="ns-clip" clipPathUnits="objectBoundingBox"><path d={ARCO_IN} transform={clipFoto} /></clipPath>
        </defs>
      </svg>

      <a href="#menu" className="ns-pular" style={{ position: "absolute", left: -9999 }}>Skip to the menu</a>

      {/* ── TOPO ── */}
      <div className={`ns-topo ${rolou ? "ns-topo-on" : ""}`}>
        <div className="ns-in">
          <a className="ns-logo" href="#top" aria-label="Natura Spa, back to top"><img src={`${B}/logo-petrol.svg`} alt="Natura Spa" width="147" height="34" /></a>
          <nav className="ns-nav" aria-label="Sections">
            {SECOES.filter(([id]) => id !== "inside").map(([id, nome]) => <a key={id} href={`#${id}`} aria-current={secao === id ? "true" : undefined}>{nome}</a>)}
          </nav>
          <Botao tom="petrol" className="ns-btn-p" href={u.reservar} target="_blank" rel="noopener" aria-label={`${forte}. ${fino}`}>
            <b><span className="ns-so-g">{forte}</span><span className="ns-so-p">Book · {u.curto}</span></b><i>{fino}</i>
          </Botao>
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="ns-hero" ref={hero} id="top" aria-label="Natura Spa">
        <div className="ns-palco">
          <div className="ns-midia" ref={midia}>
          <img className="ns-filme" src={`${B}/hero-poster.jpg`} alt="" aria-hidden="true" width="1920" height="1080" fetchPriority="high" />
          <video ref={video} className="ns-filme" muted loop playsInline preload="metadata" aria-label="The Natura Spa storefront in Astoria under its arch of red flowers, then the salon inside" />
          </div>
          <div className="ns-lente" />
          <svg className="ns-parede" viewBox={`0 0 ${tela.w} ${tela.h}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="ns-g-parede" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FCFBF8" /><stop offset=".55" stopColor="#F7F4EE" /><stop offset="1" stopColor="#EDE7DB" /></linearGradient>
              <mask id="ns-m-porta" maskUnits="userSpaceOnUse" x="0" y="0" width={tela.w} height={tela.h}>
                <rect width={tela.w} height={tela.h} fill="#fff" />
                <path ref={furo} d={ARCO_IN} fill="#000" />
              </mask>
            </defs>
            <rect width={tela.w} height={tela.h} fill="url(#ns-g-parede)" mask="url(#ns-m-porta)" />
            <g ref={moldura}>
              <path d={ARCO_OUT} fill="none" stroke="#BC8E40" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              <path d={ARCO_IN} fill="none" stroke="#013B52" strokeOpacity=".3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>

          <div className="ns-fala" ref={fala}>
            <p className="ns-vivo"><u className={st.aberto === false ? "ns-fechado" : ""} /><span className="ns-num">{u.curto} · {st.texto}{t ? <i> · {relogio(t.min)} NYC</i> : null}</span></p>
            <h1>Beauty that is<br /><em>naturally you.</em></h1>
            <p className="ns-lead">A Brazilian hair salon, spa and med spa. In Astoria since 2003, now also on the Upper East Side.</p>
            <div className="ns-acoes">
              <Botao tom="ouro" href={u.reservar} target="_blank" rel="noopener" forte={forte} fino={fino} />
              <Botao tom="linha" href="#menu" forte="See the menu" fino="Every price, by location" />
            </div>
          </div>
          <p className="ns-role" ref={role} aria-hidden="true">Scroll to walk in</p>

          <div className="ns-dentro" ref={dentro}>
            <div className="ns-in">
              <p className="ns-g">Come in.</p>
              <p className="ns-s">30-79 Steinway Street · the door under the red flowers</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── IMPRENSA ── */}
      <div className="ns-prensa">
        <div className="ns-in">
          <span>Featured in</span>
          <b>Time Out New York</b><i>“The Best Spas in NYC”</i>
          <b>New York Post</b>
          <b>We Heart Astoria</b>
          <b>Dear Sundays</b>
        </div>
      </div>

      {/* ── AS TRÊS PORTAS ── */}
      <section className="ns-sec" id="locations">
        <div className="ns-in">
          <Cabeca sobre="Three doors">Pick the door <em>closest to you.</em></Cabeca>
          <div className="ns-portas">
            {ORDEM.map((id) => {
              const x = UNIDADES[id]; const s = statusDe(x, t); const menu = id !== "med";
              return (
                <article key={id} className={`ns-porta ns-rv ${menu && loc === id ? "ns-porta-on" : ""}`}>
                  <div className="ns-vao">
                    {x.foto
                      ? <img src={`${B}/${x.foto}-960.webp`} alt={x.legenda} loading="lazy" width="960" height="640" />
                      : <div className="ns-vao-c"><Flor /></div>}
                    <svg viewBox={`${ARCO_IN_BOX.x} ${ARCO_IN_BOX.y} ${ARCO_IN_BOX.w} ${ARCO_IN_BOX.h}`} preserveAspectRatio="none" aria-hidden="true"><path d={ARCO_OUT} fill="none" stroke="#BC8E40" strokeWidth="1.2" vectorEffect="non-scaling-stroke" /></svg>
                  </div>
                  <p className="ns-tipo">{x.tipo}</p>
                  <h3>{x.curto}</h3>
                  <address>{x.rua}<br />{x.cidade}</address>
                  <p className="ns-linha"><span className="ns-estado"><u className={s.aberto === false ? "ns-fechado" : ""} />{s.aberto ? "Open now" : s.aberto === false ? "Closed now" : "Hours"}</span><b>{s.texto}</b></p>
                  <p className="ns-linha"><span>Mon – Sat</span><b className="ns-num">{hora12(x.semana[0])} – {hora12(x.semana[1])}</b></p>
                  <p className="ns-linha"><span>Sunday</span><b className="ns-num">{hora12(x.dom[0])} – {hora12(x.dom[1])}</b></p>
                  <p className="ns-linha"><span>Call</span><b><a href={`tel:${x.tel}`} className="ns-num">{x.telFmt}</a></b></p>
                  <div className="ns-porta-pe">
                    <Botao tom="petrol" className="ns-btn-p" href={x.reservar} target="_blank" rel="noopener" forte={`Book ${x.curto}`} />
                    {menu
                      ? <a className="ns-lnk" href="#menu" onClick={() => trocar(id)}>See {x.curto} prices</a>
                      : <a className="ns-lnk" href="#medspa">See treatments</a>}
                    <a className="ns-lnk" href={x.mapa} target="_blank" rel="noopener">Directions</a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CARDÁPIO ── */}
      <section className="ns-sec ns-sec-papel" id="menu">
        <div className="ns-in">
          <Cabeca sobre="The menu">Build your <em>ritual.</em></Cabeca>
          <div className="ns-barra ns-rv">
            <div className="ns-chave" role="group" aria-label="Location for prices">
              <button type="button" aria-pressed={loc === "astoria"} onClick={() => trocar("astoria")}>Astoria</button>
              <button type="button" aria-pressed={loc === "ues"} onClick={() => trocar("ues")}>Upper East Side</button>
            </div>
            <input className="ns-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Search: balayage, keratin, facial…" aria-label="Search the menu" />
            <small>Prices for <b>{u.curto}</b>. Tap + to add a treatment.</small>
          </div>

          {!termo && (
            <div className="ns-abas" role="tablist" aria-label="Menu categories">
              {MENU.map((c) => <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}>{c.nome}</button>)}
            </div>
          )}
          {!termo && <p className="ns-intro">{categoria.intro}</p>}

          {grupos.length === 0
            ? <p className="ns-vazio">Nothing on the {u.curto} menu matches “{busca}”. Try the other location, or call {u.telFmt}.</p>
            : (
              <div className="ns-grade">
                {grupos.map((g) => (
                  <div className="ns-grupo" key={g.nome}>
                    <h3>{g.nome}</h3>
                    {g.itens.map((i) => {
                      const p = i[col]; const k = chave(i[0]); const nota = notaDe(i[3], loc);
                      return (
                        <div className="ns-item" key={i[0]}>
                          <div className="ns-item-n"><b>{i[0]}</b>{nota ? <i>{nota}</i> : null}</div>
                          {ehOpcoes(p)
                            ? (
                              <div className="ns-opcs">
                                {Object.entries(p).map(([rot, v]) => (
                                  <button key={rot} type="button" className="ns-opc" aria-pressed={noRitual(k, rot)} onClick={() => alternar(i[0], rot)} aria-label={`${i[0]}, ${rot}, ${usd(v)}`}>
                                    <span>{rot}</span><b className="ns-num">{usd(v)}</b>
                                  </button>
                                ))}
                              </div>
                            )
                            : (
                              <>
                                <span className="ns-preco ns-num">{faixa(p)}</span>
                                <button type="button" className="ns-mais" aria-pressed={noRitual(k, "")} onClick={() => alternar(i[0])} aria-label={`${noRitual(k, "") ? "Remove" : "Add"} ${i[0]}`}>
                                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" /></svg>
                                </button>
                              </>
                            )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

          {ritual.length > 0 && (
            <div className="ns-doca" role="status" aria-live="polite">
              <div className="ns-doca-t">
                <b><span className="ns-num">{total}</span> · {conta.n} {conta.n === 1 ? "treatment" : "treatments"}</b>
                <span>Your ritual at {u.curto}.{conta.fora.length ? ` Not on this location’s menu: ${conta.fora.join(", ")}.` : ""} Final price confirmed at the salon.</span>
              </div>
              <button type="button" className="ns-txt" onClick={copiar}>{copiado ? "Copied" : "Copy my ritual"}</button>
              <button type="button" className="ns-txt" onClick={() => setRitual([])}>Clear</button>
              <Botao tom="ouro" className="ns-btn-p" href={u.reservar} target="_blank" rel="noopener" forte={`Book it at ${u.curto}`} />
            </div>
          )}
          <p className="ns-rodape-menu">Services may vary with hair length and time. A consultation is required for the final price on hair services. Natura Spa notes that prices are subject to change in exceptional cases.</p>
        </div>
      </section>

      {/* ── POR DENTRO ── */}
      <section className="ns-sec" id="inside" style={{ paddingBottom: 0 }}>
        <div className="ns-in">
          <Cabeca sobre="Inside Astoria">Marble, gold, <em>and a wall that grows.</em></Cabeca>
        </div>
        <div className="ns-fita" tabIndex={0} role="region" aria-label="Photos of the Astoria salon">
          {GALERIA.map(([f, leg]) => (
            <figure className="ns-quadro" key={f}>
              <div><img src={`${B}/${f}-960.webp`} srcSet={`${B}/${f}-960.webp 960w, ${B}/${f}.webp 1920w`} sizes="(min-width:700px) 620px, 80vw" alt={leg} loading="lazy" width="960" height="640" /></div>
              <figcaption>{leg}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── MED SPA ── */}
      <section className="ns-sec ns-sec-noite" id="medspa" style={{ marginTop: "clamp(72px,10vw,132px)" }}>
        <div className="ns-in">
          <Cabeca sobre="Natura Med Spa · 166 East 63rd Street" claro>Medical aesthetics, <em>priced in the open.</em></Cabeca>
          <div className="ns-med">
            <div className="ns-rv">
              {MED.map(([n, d, p, un]) => (
                <div className="ns-med-l" key={n}>
                  <h3>{n}</h3>
                  <strong className="ns-num">{p}<small>{un}</small></strong>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <aside className="ns-cartao-v ns-rv">
              <h3>Start with a free consultation.</h3>
              <p>Every injectable and body treatment begins with a conversation. The Med Spa states that all its treatments are FDA-approved.</p>
              <Botao tom="ouro" href={`tel:${UNIDADES.med.tel}`} forte={`Call ${UNIDADES.med.telFmt}`} fino={statusDe(UNIDADES.med, t).texto} />
              <div className="ns-casa">
                <h3 style={{ fontSize: 24 }}>Natura comes to you</h3>
                <p>House calls from the Upper East Side team.</p>
                <ul>{EM_CASA.map(([n, v]) => <li key={n}><span>{n}</span><b className="ns-num">{usd(v)}</b></li>)}</ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── HISTÓRIA ── */}
      <section className="ns-sec" id="story">
        <div className="ns-in ns-hist">
          <div className="ns-hist-e">
            <Cabeca sobre="Lilian Metzger, founder">From a boutique in Brazil <em>to Lexington Avenue.</em></Cabeca>
            <p className="ns-rv">Lilian has worked in beauty and fashion her whole life. Her mission at Natura Spa is simple to say and hard to do: every guest leaves with more confidence than they walked in with.</p>
          </div>
          <ol className="ns-tempo">
            {HISTORIA.map(([q, tit, txt]) => (
              <li key={tit} className="ns-rv"><Flor /><span>{q}</span><h3>{tit}</h3><p>{txt}</p></li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── AVALIAÇÕES ── */}
      <section className="ns-sec ns-sec-papel" id="reviews">
        <div className="ns-in">
          <Cabeca sobre="What guests say">More than a thousand <em>reviews.</em></Cabeca>
          <div className="ns-nums">
            <div className="ns-numero ns-rv"><b className="ns-num">4.6<sup>★</sup></b><p>Across 1,081 reviews collected on Birdeye.</p><a className="ns-lnk" href="https://reviews.birdeye.com/natura-spa-495138848" target="_blank" rel="noopener">Read on Birdeye</a></div>
            <div className="ns-numero ns-rv"><b className="ns-num">4.3<sup>★</sup></b><p>Across 606 reviews of the Astoria salon on Yelp.</p><a className="ns-lnk" href={REDES.yelp} target="_blank" rel="noopener">Read on Yelp</a></div>
            <div className="ns-numero ns-rv"><b className="ns-num">16K</b><p>Followers on Instagram, and more than 4,000 posts from the chair.</p><a className="ns-lnk" href={REDES.instagram} target="_blank" rel="noopener">@naturaspanyc</a></div>
          </div>
          <p className="ns-nota">Figures as published by each platform on September 28, 2026.</p>
        </div>
      </section>

      {/* ── GIFT CARDS + PERGUNTAS ── */}
      <section className="ns-sec" id="gift">
        <div className="ns-in ns-duas">
          <div>
            <Cabeca sobre="Gift cards">Give someone <em>an afternoon.</em></Cabeca>
            <p className="ns-rv" style={{ color: "#23485A", maxWidth: "30em" }}>Gift cards from $50, or any amount you choose. Good toward any service or product for one year.</p>
            <div className="ns-acoes ns-rv">
              <Botao tom="ouro" href="https://clients.mindbodyonline.com/classic/ws?studioid=767008&stype=42&sLoc=0" target="_blank" rel="noopener" forte="Gift card · Astoria" />
              <Botao tom="petrol" href="https://clients.mindbodyonline.com/classic/ws?studioid=5734109&stype=42&sLoc=0" target="_blank" rel="noopener" forte="Gift card · East Side" />
            </div>
          </div>
          <div className="ns-rv">
            {FAQ.map(([q, a], i) => (
              <div className="ns-perg" key={q}>
                <button type="button" aria-expanded={aberta === i} aria-controls={`ns-r-${i}`} onClick={() => setAberta(aberta === i ? -1 : i)}>
                  {q}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" /></svg>
                </button>
                <div className="ns-resp" id={`ns-r-${i}`} data-on={aberta === i ? "1" : "0"}><div><p>{a}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTATO / RODAPÉ ── */}
      <footer className="ns-fim" id="contact">
        <div className="ns-in">
          <h2>The door is <em>{st.aberto ? "open." : "always here."}</em></h2>
          <div className="ns-acoes" style={{ marginTop: 28 }}>
            <Botao tom="ouro" href={u.reservar} target="_blank" rel="noopener" forte={forte} fino={fino} />
            <Botao tom="petrol" href={`tel:${u.tel}`} forte={`Call ${u.telFmt}`} fino={u.curto} />
          </div>
          <div className="ns-fim-g">
            {ORDEM.map((id) => { const x = UNIDADES[id]; return (
              <div key={id}>
                <h3>{x.curto}</h3>
                <address>{x.rua}<br />{x.cidade}<br />Mon–Sat {hora12(x.semana[0])}–{hora12(x.semana[1])} · Sun {hora12(x.dom[0])}–{hora12(x.dom[1])}</address>
                <a className="ns-fim-tel ns-num" href={`tel:${x.tel}`}>{x.telFmt}</a>
                <p style={{ fontSize: 13 }} className="ns-num">also {x.outros.join(" · ")}</p>
              </div>
            ); })}
            <div>
              <h3>Elsewhere</h3>
              <ul>
                <li><a href={REDES.instagram} target="_blank" rel="noopener">Instagram</a></li>
                <li><a href={REDES.facebook} target="_blank" rel="noopener">Facebook</a></li>
                <li><a href={REDES.yelp} target="_blank" rel="noopener">Yelp</a></li>
                <li><a href={REDES.laser} target="_blank" rel="noopener">Natura Laser · Astoria</a></li>
                <li><a href={`mailto:${EMAIL}`}>{EMAIL}</a></li>
              </ul>
            </div>
          </div>
          <p className="ns-aviso">Preview prepared for Natura Spa. Prices, hours and services are transcribed from the menus Natura Spa published on naturaspanyc.com and are to be confirmed by Natura Spa before launch. Photographs show the Astoria location.</p>
          <div className="ns-base">
            <span>© {new Date().getFullYear()} Natura Spa</span>
            <a href="https://guileoai.com" target="_blank" rel="noopener">Site + AI by Guileo</a>
          </div>
        </div>
      </footer>

      {/* ── O RAMO ── */}
      <nav className={`ns-trilho ${passou ? "ns-trilho-on" : ""}`} ref={trilho} aria-label="Page progress">
        <svg className="ns-haste" viewBox="0 0 44 520" preserveAspectRatio="none" aria-hidden="true">
          <path className="ns-h0" d="M22,0 C34,40 10,80 22,130 C34,180 10,220 22,260 C34,300 10,340 22,390 C34,440 10,480 22,520" />
          <path className="ns-h1" pathLength="1" d="M22,0 C34,40 10,80 22,130 C34,180 10,220 22,260 C34,300 10,340 22,390 C34,440 10,480 22,520" />
        </svg>
        {SECOES.map(([id, nome], i) => {
          const ja = SECOES.findIndex(([s]) => s === secao) >= i;
          return (
            <a key={id} href={`#${id}`} className={`ns-botao-flor ${ja ? "ns-ja" : ""}`} style={{ top: `${((i + 0.5) / SECOES.length) * 100}%` }} aria-current={secao === id ? "true" : undefined} aria-label={nome}>
              <Flor /><span>{nome}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
