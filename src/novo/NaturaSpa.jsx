/* ══════════════════════════════════════════════════════════════════════════════════════════════
   NATURA SPA + SALON — Astoria · Upper East Side · Med Spa UES            CLIENTE REAL da Guileo
   v3 · "O SITE DELES, VIVO"

   🚨 POR QUE EXISTE A v3 (Luis, 2026-09-28: «nada a ver com o que você fez, olha a diferença»)
   A v1/v2 (guardada em NaturaSpaPorta.jsx, slug natura-spa-porta) foi construída em cima do
   arquivo de 2024, porque o site ao vivo recusava leitura. O site foi REFEITO em 2025 com outra
   identidade, e eu entreguei uma marca que não era mais a deles. Esta versão parte do site de HOJE.

   MEDIDO NO SITE ATUAL (getComputedStyle, 2026-09-28), não escolhido:
   • fundo #FFFFFF, faixas #F7F7F7 e #F6F0E8 · texto #1C1C1C / #5A5A5A
   • rosa-malva #C37B89 (ação) · ouro #D4AF37 (secundário) · coral #EF7869
   • título IvyOra Display 300 (Adobe, paga) → Fraunces 300, opsz 144, SOFT 0 — a mais próxima
     entre 8 candidatas renderizadas lado a lado
   • texto Sofia Pro 300 (Adobe, paga) → Poppins 300
   • botão DELES: retângulo, raio 2px, 49px, contorno de 1px, Poppins 600 14px.
     Aqui (pedido do Luis, 2026-09-29): mesmas cores e contorno, mas em PÍLULA e cantos
     arredondados no site todo — «um toque redondo, só um toque»
   • hero: foto com margem, título centrado em cima, cartão branco "Welcome" embaixo à direita

   O QUE É UPGRADE (o pedido: vida, movimento, realismo, botão inteligente) — em cima da marca deles:
   • a hero é FILME, montado com as fotos atuais deles, e abre com a foto de hero deles
   • imagens com CANTO DE PÉTALA (dois cantos opostos grandes, dois suaves) e a flor do logo
     como selo no canto — escolha do Luis em 2026-09-29, «um toque massa, exclusivo»
   • botões TÁTEIS como os do Guileo, sem brilho espelhado: aro de luz fixo, espessura,
     sombra de contato + ambiente; sobem no hover e afundam no clique
   • Book Now sabe a hora de NY e qual unidade está aberta · cardápio troca de preço por unidade
   • ritual que soma ao vivo · promoção que some sozinha quando o mês acaba

   DADOS: preços, horários e textos lidos de naturaspanyc.com em 2026-09-28 (as 4 páginas de
   serviço). Agenda: Mindbody, confirmada viva nos dois estúdios no mesmo dia.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FLOR } from "./naturaArco.js";
import NaturaStore from "./NaturaStore.jsx";
import NaturaPoliticas from "./NaturaPoliticas.jsx";
import NaturaMembership from "./NaturaMembership.jsx";
import { OBJETIVOS, servicosDoObjetivo, unidadeDoObjetivo } from "./naturaObjetivos.js";
import { LOJA } from "./naturaStoreCatalogo.js";
import { MAPA_W, MAPA_H, MAPA_TERRA, MAPA_PARQUE, MAPA_PONTE, MAPA_PINOS } from "./naturaMapa.js";
import { lerTenant } from "../lib/tenantTracking.js";
import { ldVitrine, cabecaDoCliente, unidadeDoCaminho, ehNosso } from "../../functions/lib/dominio.js";

const B = "/novo/natura-spa/v3";
const SLUG = "natura-spa";
/* DOMÍNIO DELES x PRÉVIA. No domínio do cliente o servidor entrega {host, indexable} (lerTenant);
   em guileoai.com/novo/natura-spa isso é null e a página é só uma PRÉVIA (sempre noindex).
   Título, canonical e JSON-LD saem das MESMAS funções que o servidor usa (functions/lib/dominio.js),
   então o que o React escreve aqui é igual ao que já veio no HTML cru. */
const TENANT = (() => { const t = lerTenant(); return t && t.slug === SLUG ? t : null; })();
/* A unidade da URL no domínio deles: /astoria, /upper-east-side, /med-spa-ues. Na prévia, nenhuma. */
const UNIDADE_DA_URL = TENANT && typeof window !== "undefined" ? unidadeDoCaminho(SLUG, window.location.pathname) : null;
const TITULO = "Brazilian Hair Salon & Spa Astoria and UES, NY | Natura Spa";
const DESCRICAO = "Brazilian Hair Salon & Spa in Astoria and UES, NY offering balayage, hair styling, facials, & massages. Book your Massage and Hair appointment now!";
const EMAIL = "naturaspanyc@gmail.com";
const REDES = {
  instagram: "https://www.instagram.com/naturaspanyc/",
  facebook: "https://www.facebook.com/naturaspanyc",
  yelp: "https://www.yelp.com/biz/natura-spa-astoria-4",
  laser: "https://naturalaserny.com/",
};

const UNIDADES = {
  astoria: {
    id: "astoria", curto: "Astoria", nome: "Steinway, Astoria", marca: "Natura Spa + Salon · Astoria", rodape: "Spa + Salon Astoria",
    texto: "Nestled in the heart of Astoria, our salon and med spa offers a full body-mind-soul escape tailored just for you. Passionate hands, pure products, and a warm space will have you stepping back into the city feeling naturally radiant.",
    rua: "30-79 Steinway Street", cidade: "Astoria, NY 11103",
    tel: "+17189565530", telFmt: "(718) 956-5530", outros: ["(718) 956-5529", "(718) 956-1199"],
    semana: [10, 20], dom: [11, 19],
    reservar: "https://clients.mindbodyonline.com/consumerbooking?studioid=767008",
    presente: "https://clients.mindbodyonline.com/classic/ws?studioid=767008&stype=42&sLoc=0",
    mapa: "https://www.google.com/maps/search/?api=1&query=Natura+Spa+30-79+Steinway+St+Astoria+NY+11103",
    geo: [40.76184, -73.91673],
    fotos: [["astoria-1", "The salon floor in Astoria."], ["astoria-4", "The Astoria salon, looking toward the street."], ["medast-1", "A treatment room at the Astoria med spa."], ["astoria-2", "The Steinway Street storefront."], ["astoria-3", "The entrance and the green wall, Astoria."]],
  },
  ues: {
    id: "ues", curto: "Upper East Side", nome: "Upper East Side", marca: "Natura Spa + Salon · Upper East Side", rodape: "Salon Upper East Side",
    texto: "Perched on Lexington Avenue, this sanctuary invites you to unwind and recharge. Our dedicated experts deliver therapies infused with positive energy—and you’ll leave carrying that calm, natural beauty wherever you go.",
    rua: "842 Lexington Ave", cidade: "New York, NY 10065",
    tel: "+12122580661", telFmt: "(212) 258-0661", outros: ["(212) 258-0662"],
    semana: [9, 19], dom: [10, 18],
    reservar: "https://clients.mindbodyonline.com/consumerbooking?studioid=5734109",
    presente: "https://clients.mindbodyonline.com/classic/ws?studioid=5734109&stype=42&sLoc=0",
    mapa: "https://www.google.com/maps/search/?api=1&query=Natura+Spa+842+Lexington+Ave+New+York+NY+10065",
    geo: [40.76534, -73.96611],
    fotos: [["ues-1", "The Upper East Side salon on Lexington Avenue."], ["ues-3", "The lounge by the window, Upper East Side."], ["ues-2", "Styling stations, Upper East Side."], ["ues-4", "The wash stations, Upper East Side."]],
  },
  med: {
    id: "med", curto: "Med Spa UES", nome: "Med Spa UES", marca: "Natura Med Spa · Upper East Side", rodape: "Med Spa UES",
    texto: "Tucked away on 63rd St and 3rd Ave, our UES retreat blends urban luxury with holistic care. From soothing facials to revitalizing massages, each personalized treatment uses clean, potent ingredients to refresh your glow inside and out.",
    rua: "166 East 63rd Street", cidade: "New York, NY 10065",
    tel: "+12122580661", telFmt: "(212) 258-0661", outros: ["(212) 258-0662"],
    semana: [10, 19], dom: [10, 17],
    reservar: "https://clients.mindbodyonline.com/consumerbooking?studioid=5734109",
    mapa: "https://www.google.com/maps/search/?api=1&query=Natura+Med+Spa+166+E+63rd+St+New+York+NY+10065",
    geo: [40.76411, -73.96557],
    fotos: [["med-1", "The lounge at Med Spa UES."], ["med-2", "A couples treatment room, Med Spa UES."], ["med-3", "A treatment room, Med Spa UES."], ["med-4", "A facial room, Med Spa UES."]],
  },
};
const ORDEM = ["astoria", "ues", "med"];

/* ─── AGENDAR PELA GUILEO (2026-10-05) ─────────────────────────────────────────────────────────
   Os botões "Book" iam todos para o MindBody. A página de agendamento da Guileo
   (/agendar/natura-spa) já marca de verdade, no mesmo motor da Lilian e do Balcão.
   ⚠️ INTERRUPTOR DESLIGADO DE PROPÓSITO: enquanto a recepção marcar no MindBody, o motor da Guileo
   NÃO enxerga essa agenda (a API do MindBody ainda está bloqueada) — o site marcaria por cima de
   horário já vendido no balcão. Liga no dia em que o Natura passar a usar o Guileo Desk no balcão:
   AGENDA_GUILEO = true e deploy. Prévia sem ligar: ?agenda=guileo na URL. */
const AGENDA_GUILEO = false;
const agendaGuileo = () => { try { return AGENDA_GUILEO || new URLSearchParams(window.location.search).get("agenda") === "guileo"; } catch { return AGENDA_GUILEO; } };
const reservarDe = (u) => (agendaGuileo() ? `/agendar/natura-spa?local=${u.id}&lang=en` : u.reservar);

/* ─── O RELÓGIO ── um tick só alimenta tudo que fala de horário ─────────────────────────────── */
const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function agoraNY(d = new Date()) {
  try {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
    const g = (t) => p.find((x) => x.type === t)?.value;
    const h = Number(g("hour")) % 24;
    return { dia: DIAS.indexOf(g("weekday")), min: h * 60 + Number(g("minute")), ano: Number(g("year")), mes: Number(g("month")), data: Number(g("day")) };
  } catch { return null; }
}
const hora12 = (h) => `${((h + 11) % 12) + 1} ${h % 24 < 12 ? "AM" : "PM"}`;
const horaCurta = (h) => `${((h + 11) % 12) + 1}${h % 24 < 12 ? "am" : "pm"}`;
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

/* ─── A VOZ DO BOTÃO ── política do Luis (2026-09-28): fechado = opção B, "Reserve for tomorrow".
   Entrada: u, st.  Saída: [linha forte, linha fina]. */
function vozDoBotao(u, st) {
  if (st.aberto === null) return [`Book at ${u.curto}`, "Online, any time"];
  if (st.aberto && st.fechando) return [`Book at ${u.curto}`, `Closes at ${st.hora} · book ahead`];
  if (st.aberto) return [`Book at ${u.curto}`, `Open now · until ${st.hora}`];
  return [`Reserve for ${st.quando}`, `${u.curto} · opens at ${st.hora}`];
}

/* ─── A PROMOÇÃO DO MÊS ── transcrita do cartaz que ELES publicaram em /specials.
   "September only": depois de 30/09/2026 (hora de NY) ela some sozinha. Promoção vencida no ar
   é a forma mais rápida de um site parecer abandonado. */
const PROMO = {
  ano: 2026, mes: 9, titulo: "September Special", lema: "Refresh. Renew. Recharge.", onde: "Exclusively in Astoria",
  imagem: "promo-setembro-2026", alt: "Natura Spa September Special flyer: four packages, exclusively in Astoria.",
  pacotes: [
    ["The Glow & Go", "Fusio-Dose treatment · Signature facial · Underarm wax", "$139"],
    ["The Full Reset", "Fusio-Dose treatment · Deep pore cleansing facial · Underarm wax", "$159"],
    ["Silky September", "Hair Botox treatment, shoulder length", "from $200"],
    ["The September Escape", "60-min Swedish massage · Signature facial + microdermabrasion", "$255"],
  ],
  nota: "Plus taxes. Limited appointments.",
};
const promoVale = (t) => !!t && t.ano === PROMO.ano && t.mes === PROMO.mes;

/* ─── O CARDÁPIO ── [nome, Astoria, UES, nota]. Preço: número · [de, até] · { "60 min": 118 } · null.
   Lido das páginas /hair-salon-astoria, /hair-salon-east-side, /med-spa-astoria, /med-spa-east-side
   em 2026-09-28. Nada arredondado, nada inferido: onde eles não dão duração, não há duração. */
const MENU = [
  { id: "hair", nome: "Hair", fotos: [["svc-balayage", "Balayage"], ["svc-hair-coloring", "Color"], ["svc-brazilian-keratin", "Brazilian Keratin"], ["svc-house-call-blowout", "Blowout"]],
    intro: "Professional-grade Kérastase and nourishing products, tailored to your texture, condition and goals.", grupos: [
    { nome: "Styling", itens: [
      ["Haircut", [60, 70], null],
      ["Wash / Cut / Blow Dry", [90, 130], null],
      ["Wash + Blow Dry", [45, 70], [50, 70]],
      ["Women’s Cut", null, 90, "Styling not included"],
      ["Women’s Cut & Styling", null, [90, 140]],
      ["European Style Men’s Cut + Style", null, [60, 80]],
      ["Wash / Extensions Blow Dry", [65, 90], [70, 90]],
      ["Hair Extensions", [200, 600], [300, 850]],
    ] },
    { nome: "Balayage + Highlights", itens: [
      ["Balayage (Full)", [250, 320], [225, 355]],
      ["Balayage (Partial)", [180, 280], [180, 250]],
      ["Balayage Package", [480, 550], null, "Balayage + Haircut + Olaplex + Kérastase Treatment + Blow Dry"],
      ["Highlights (Full)", [200, 280], [225, 355]],
      ["Highlights (Partial)", [160, 200], [180, 250]],
    ] },
    { nome: "Color", itens: [
      ["Single Process", [80, 120], [90, 140], { ues: "Full hair" }],
      ["Single Process · touch up", null, [85, 95]],
      ["Full Hair Color", [80, 120], null],
      ["Roots", [80, 90], null],
      ["Double Process", [120, 300], [140, 210]],
      ["Toner / Gloss", [70, 80], 90],
    ] },
    { nome: "Treatments", itens: [
      ["Brazilian Keratin", [220, 300], 350, { astoria: "No formaldehyde. Can be washed the same day.", ues: "Smooth and Shine" }],
      ["Hair Botox", null, [180, 250]],
      ["Kérastase Fusio Dose", 35, 35],
      ["Kérastase Masque", 45, 45],
      ["Kérastase Chronologiste Masque", 85, 90],
      ["Kérastase Premiere", null, 80],
      ["Olaplex Treatment", [50, 75], 70],
      ["Olaplex within Color", 30, 30],
      ["Deep Conditioner", [30, 65], 40, { ues: "Customized" }],
      ["Relaxer", [70, 90], 90],
      ["Exfoliating Scalp Scrub + Kérastase Fusio", null, 80],
    ] },
    { nome: "Natura rituals", itens: [
      ["Natura Shine Ritual by Kérastase", null, 95, "Fusio Dose + Blow out"],
      ["Natura Repair Therapy by Olaplex", null, 160, "Olaplex + Scalp Massage + Blowout"],
      ["Natura Restorative Boost by Kérastase", null, 180, "Chronologiste + Scalp Massage + Blowout"],
      ["Natura Glam by Kérastase", null, 180, "Fusio Dose + Blow out + Make Up"],
    ] },
    { nome: "Special occasions", itens: [
      ["Up Do", [80, 150], [130, 160]],
      ["Make Up", [100, 150], 180],
      ["Braids", [25, 120], [55, 80]],
      ["Hair Waves", 70, null],
      ["Bridal Up Do", [120, 250], 380],
      ["Bridal Make Up", [150, 200], 380],
      ["Bride Make Up + Up Do", null, 750],
    ] },
    { nome: "House call", itens: [
      ["Blowout", null, 200], ["Haircut & Blowout", null, 320], ["Up Do", null, 390],
      ["Make Up", null, 390], ["Brazilian Mani & Pedi", null, 150],
    ] },
  ] },
  { id: "face", nome: "Facials", fotos: [["svc-facial", "Facial"], ["med-4", "Facial room, Med Spa UES"], ["medast-1", "Treatment room, Astoria"], ["med-3", "Treatment room, Med Spa UES"]],
    intro: "From a 30-minute reset to resurfacing. Organic facials use Eminence.", grupos: [
    { nome: "Facials", itens: [
      ["Natura Spa Signature Facial", 118, 135, { astoria: "60 min · exfoliation and extraction in a single area" }],
      ["Couples Natura Spa Signature Facial", 240, null, "60 min"],
      ["Mini Facial", 75, 100, { astoria: "30 min" }],
      ["Organic Facial by Eminence", 138, 170, { astoria: "60 min" }],
      ["Hydraglowing", 160, 220, { astoria: "60 min" }],
      ["Deep Pore Cleansing", 138, null, "80 min · full extraction, hydration and a mask"],
      ["Deep Pore Cleansing + Oxygen", null, 145],
      ["Acne Relief + LED Blue Therapy", 148, 160, { astoria: "80 min · 4-session package $450" }],
      ["Ultimate Skin Age Treatment", 118, null, "80 min"],
      ["Ultimate Age Treatment and Collagen Mask", null, 189],
      ["Signature Facial + Microdermabrasion", 160, 169, { astoria: "80 min" }],
      ["Facial + Microdermabrasion + Collagen Mask", 178, null],
      ["Lifting Facial", null, 190],
      ["Back Acne Treatment", 148, null, "80 min"],
      ["Back Treatment with Bamboo Mask", null, 180],
      ["Facial Lymphatic Drainage", 60, 70],
    ] },
    { nome: "Resurfacing", itens: [
      ["Dermaplane", 160, 180, { astoria: "60 min" }],
      ["Microdermabrasion", 85, null, "40 min"],
      ["Chemical Peel", 160, null, "60 min · 4-session package $500"],
      ["LuminFusion by Dermalogica", 180, 200],
      ["Power Peel", null, 250],
      ["Jet Plasma + Full Facial", null, { "1 session": 300, "3 sessions": 800, "5 sessions": 1300 }],
      ["Skin Tags Removal", 90, null, "Each area: neck, underarm, back, chest"],
    ] },
    { nome: "Add-ons", itens: [
      ["LED Therapy", 30, null, "Can be added to any facial"],
      ["Collagen Ritual", 30, null, "30 min"],
      ["Eye Peel", 50, null],
    ] },
  ] },
  { id: "body", nome: "Massage + Body", fotos: [["med-2", "Couples room, Med Spa UES"], ["medast-2", "Treatment room, Astoria"], ["med-1", "The lounge, Med Spa UES"], ["ues-3", "The lounge, Upper East Side"]],
    intro: "In Astoria, 10% off any massage package of 5 or 10 sessions.", grupos: [
    { nome: "Massage", itens: [
      ["Natura Spa Signature", { "30 min": 80, "60 min": 118, "90 min": 130 }, null],
      ["Swedish", { "30 min": 80, "60 min": 118, "90 min": 135 }, { "60 min": 132, "90 min": 168 }],
      ["Hot Stone", { "30 min": 80, "60 min": 118, "90 min": 135 }, { "60 min": 132, "90 min": 168 }],
      ["Sports", { "30 min": 80, "60 min": 118, "90 min": 135 }, { "60 min": 132, "90 min": 168 }],
      ["Deep Tissue", { "30 min": 80, "60 min": 125, "90 min": 148 }, { "60 min": 132, "90 min": 168 }],
      ["Therapeutic Ritual", { "30 min": 80, "60 min": 125, "90 min": 148 }, null],
      ["Prenatal Massage", 138, { "60 min": 160, "90 min": 190 }, { astoria: "60 min" }],
      ["Couples Massage · Side by Side", 240, { "60 min": 280, "90 min": 410 }, { astoria: "60 min, any massage, private room" }],
      ["Reflexology", { "30 min": 30, "60 min": 60 }, 55],
    ] },
    { nome: "Drainage + sculpting", itens: [
      ["Brazilian Lymphatic Drainage", null, { "60 min": 168, "90 min": 210 }],
      ["Lymphatic Drainage Detox + Body Sculpting", [128, 148], { "60 min": 168, "90 min": 190 }, { astoria: "Reductor massage" }],
      ["Manual Lymphatic Drainage + Contouring + Cellulite Reduction", null, { "60 min": 180, "90 min": 220 }],
      ["Manual Lymphatic Drainage + Wood Therapy", null, { "60 min": 200, "90 min": 240 }],
      ["Lymphatic Post Surgical Drainage", 148, { "60 min": 168, "90 min": 210 }, { astoria: "Only after the scars close" }],
      ["Liposuction Drainage", 130, null, "90 min"],
    ] },
    { nome: "Deluxe rituals", itens: [
      ["Natura Spa Aromatherapy", null, { "60 min": 150, "90 min": 210 }],
      ["Sports Therapy Muscles Relief with Theragun", null, { "60 min": 160, "90 min": 210 }],
      ["Full Detox", null, { "60 min": 185, "90 min": 235 }, "Green tea, lymphatic drainage and ion foot detox"],
    ] },
    { nome: "Detox + add-ons", itens: [
      ["Ionic Foot Detox", 70, 90],
      ["Biboting · Body Cupping Detox", 150, null, "5 sessions $675 · 10 sessions $1,300"],
      ["Back, Neck and Shoulders", null, 70],
      ["Cavitation", null, 60],
    ] },
  ] },
  { id: "beauty", nome: "Brows, Lashes + Wax", fotos: [["svc-eyelash", "Lashes"], ["svc-eyebrow", "Brows"], ["svc-bridal-makeup", "Make up"], ["parceiro-masterpiece", "Masterpiece, lashes by Chito"]],
    intro: "Waxing by area, priced in the open. Brows and lashes are on the Astoria menu.", grupos: [
    { nome: "Eyebrows", itens: [
      ["Threading", 20, null], ["Eyebrow Shaping + Tweezing", 30, null], ["Eyebrow Tinting", 25, null],
      ["Eyebrow Tweezing + Tinting", 50, null], ["Microblading / Micropigmentation", 650, null],
    ] },
    { nome: "Eyelashes", itens: [
      ["Classic Full Set", 100, null], ["Volume Full Set", 150, null], ["2-3 Week Touch-Up", [50, 70], null],
      ["Eyelashes Lift", 60, null], ["Removal", 20, null],
    ] },
    { nome: "Wax · face", itens: [
      ["Eyebrows", 30, 45], ["Lip", 10, 15], ["Chin", 12, 16], ["Nose", 15, 20],
      ["Sideburns", [17, 30], [20, 25]], ["Beard", 30, 38], ["Full Face", 60, 60],
    ] },
    { nome: "Wax · body", itens: [
      ["Brazilian Bikini", 55, 60], ["Simple Bikini", 40, 45],
      ["Full Legs", 75, 79], ["Upper Legs", 50, 49], ["Lower Legs", 45, 45],
      ["Full Arm", 45, 55], ["Half Arm", 40, 40], ["Underarm", 20, 25],
      ["Chest", 50, 69], ["Stomach", 35, 49], ["Stomach Strip", 14, 18], ["Shoulders", 25, 38],
      ["Buttocks", 35, 40], ["Buttocks Strip", 25, 30],
    ] },
  ] },
];

/* depoimentos que ELES publicam na home deles */
const VOZES = [
  ["Sarah S.", "Was gifted a massage here for my birthday, my masseuse Sarita was amazing 100/10 definitely coming back soon!"],
  ["Viviana Botero", "Amazing Vibe, Excellent service, Thank you Kany for taking care of my hair"],
  ["Pamela W.", "Was gifted an hour facial as a gift. Has a wonderful experience with Jordan. My skin was glowing!"],
  ["W. Rivera", "I highly recommend Natura Spa. The hair stylist, Rouse is excellent. The location is great and the prices are reasonable."],
  ["Antonietta D.", "I have been coming to Natura to see Dyvia for over 10 years and I love her. She knows exactly how I like my hair and what to do."],
  ["Hana G.", "I came in as a walk-in appointment and had my haircut by the fabulous Marco! So pleased with the results as this is my first time. The salon was super clean and everyone was very friendly."],
  ["Manuela A.", "Claudia is fantastic! She is very professional and easy to make bookings. I’ve been coming to her for years."],
];
const SELOS = [
  ["best-spas-in-nyc-timeout-new-york.png", "Time Out New York: The Best Spas in NYC", 768, 540],
  ["yelp100.png", "Yelp", 447, 410],
  ["google-reviews-logo.png", "Google Reviews", 1300, 717],
  ["sundays-logo.webp", "Dear Sundays", 300, 120],
  ["best-pros-recommended.png", "Best Pros In Town, recommended", 752, 752],
];
const VALORES = [
  ["icon-licensed-staff.png", "Licensed Staff", "Our certified, seasoned professionals stay current with leading aesthetic techniques to ensure you receive outstanding results."],
  ["icon-best-tech.png", "Best Technology", "At Natura Spa, we use only FDA‑approved, licensed treatments—safe, reliable, and designed for maximum impact."],
  ["personal-touch.png", "Personal Touch", "Because every client is unique, we craft a personalized treatment plan tailored to your needs for exceptional care and results."],
  ["icon-customer-integrity.png", "Customer Integrity", "We respect the trust you place in us and maintain strict confidentiality and privacy for every guest."],
];
/* Retratos: biblioteca de mídia do site DELES (uploads 2025/06 e 2026/07), nome do arquivo = nome da pessoa.
   Bruna fica sem retrato: o único arquivo parecido se chama "brunilda" e nome parecido não é prova. */
const EQUIPE = [
  ["Lilian", "Owner", "lilian"], ["Lucia", "Master Stylist", "lucia"], ["David", "Master Hairstylist", "david"], ["Junior", "Master Colorist", "junior"],
  ["Bruna", "Hairstylist & Color Specialist", ""], ["Heitor", "Hair Color Specialist", "heitor"], ["Anthony", "Hairstylist & Transformation Specialist", "anthony"],
  ["Miriam", "Hairstylist & Artist", "miriam"], ["Franck", "Hairdresser", "franck"], ["Sohaila", "Hairdresser", "sohaila"],
  ["Clara", "Medical Esthetician • Laser Specialist • Body Contouring Expert", "clara"], ["Ester", "Esthetician and Massage Therapist", "ester"], ["Maria", "Wax Specialist", "maria"],
];
/* A história da Lilian: fatos da página About deles (versão arquivada), sem as contagens de anos,
   que envelheceram. A frase entre aspas é como uma amiga a descreve, no texto deles. */
const HISTORIA = [
  "Lilian’s entrepreneurial journey started in Brazil, where she owned and operated a high-end fashion boutique. She brought that sense of beauty to New York more than two decades ago, opening a clothing store in Astoria with Brazilian brands of clothing, shoes and accessories, and later a second one in SoHo.",
  "Years later she saw the opportunity to buy a salon from a friend, and that is how Natura Spa came to life. After many years in the heart of Astoria, she brought Natura Spa to the heart of Manhattan, at 842 Lexington Avenue.",
  "Her mission has stayed the same: every guest leaves with a new sense of beauty and elevated confidence.",
];
/* O PLANO PARA A LILIAN (só aparece com ?plano=1 na URL). Em português: é conversa do Luis com ela. */
const PLANO = {
  feito: [
    ["Retratos da equipe", "12 retratos do seu próprio acervo, um por profissional. No site de hoje a equipe aparece como código quebrado."],
    ["A sua história", "Com o seu retrato, na seção About. Hoje ela não está na página About do site."],
    ["Mapa das três unidades", "Mapa real de Manhattan e Astoria, com aberto ou fechado ao vivo e rota em um toque."],
    ["Promoção que vence sozinha", "A de setembro saiu do ar no dia 1º. No site de hoje ela continua aparecendo."],
    ["Loja online pronta", "Sacola, retirada grátis no salão ou envio, pagamento direto na sua conta e aviso de cada pedido por e-mail e WhatsApp. Só falta ligar."],
    ["Nenhum endereço antigo se perde", "Os 15 endereços do site de hoje já levam para a página certa do novo, e as suas políticas de privacidade e de cancelamento vieram junto."],
  ],
  falta: [
    ["Agendar sem sair do site", "a chave de API do seu Mindbody.", "Hoje nenhum link do Mindbody abre com o serviço já escolhido. Com a chave, a cliente escolhe serviço, profissional e horário aqui dentro."],
    ["Filme de verdade", "4 a 6 clipes de 10 segundos de cada unidade, com o celular deitado.", "O filme da abertura hoje é montado com as suas fotos. Com clipes reais ele ganha gente, mãos e movimento."],
    ["Promoção de outubro", "o texto ou o flyer do mês.", "Entra no topo do site e some sozinha no último dia."],
    ["Retrato da Bruna", "confirmar se o arquivo “Brunilda” do seu acervo é ela.", "Por enquanto ela aparece com a flor da marca no lugar da foto."],
    ["Colocar o site no seu domínio", "acesso ao lugar onde naturaspanyc.com está registrado (só para apontar o domínio; o seu e-mail não muda).", "O site novo passa a abrir em naturaspanyc.com, e o Google continua achando todas as suas páginas."],
    ["Abrir a loja", "cadastrar os produtos no seu painel (tela Produtos), conectar o Stripe em guileoai.com/receber, e dizer o valor do frete e se cobra imposto de venda.", "Os produtos aparecem sozinhos na loja. O dinheiro de cada venda cai direto na sua conta."],
    ["Aprovar as políticas", "ler os rascunhos de envio, retirada e devolução, e as duas linhas novas da privacidade (pagamento da loja e assistente de voz).", "Prazos sugeridos: retirada guardada por 14 dias, envio em até 2 dias úteis, devolução em 30 dias. Você muda o que quiser."],
    ["Uma conferida final", "ler a sua história, os cargos e os preços.", "Tudo foi lido do seu site em 28/09/2026. Você confirma antes de publicar."],
  ],
  plus: [
    ["Bio ao tocar no retrato", "As bios existem no seu site, mas não abrem. Com os textos, cada retrato vira uma apresentação."],
    ["Português e espanhol", "O mesmo site, na língua de quem chega."],
    ["Avaliações do Google ao vivo", "As mais recentes entram sozinhas, sem ninguém copiar e colar."],
  ],
};
const PARCEIROS = [
  { foto: "parceiro-masterpiece", nome: "Masterpiece", sub: "Lashes by Chito", link: "https://www.lashesbychito.com/",   // o masterpiecebeautystudio.com antigo redireciona para cá
    texto: "Originally from Japan, Chito graduated from a leading cosmetology school in Tokyo in 2005. Her method focuses on proper pre-care, customized products, and precise techniques, for healthier natural lashes and longer-lasting results." },
  { foto: "parceiro-cheng", nome: "Dr. Jocelynn Cheng", sub: "Acupuncture", link: "http://www.drjocelynncheng.com/",
    texto: "An NCCAOM Board-certified acupuncturist with a Doctorate and Master of Science in Acupuncture. Her practice blends the principles of Eastern Medicine with a modern, integrative approach to wellness." },
];
const FAQ = [
  ["What is the cancellation policy?", "When you book an appointment at Natura Spa, we reserve the time and space especially for you. Please notify us at least 24 hours in advance to cancel or reschedule. With less than 24 hours’ notice the fee is 50% of the booked services. No shows and same day cancellations are charged 100% of the booked services."],
  ["How do gift cards work?", "Gift cards are non-refundable and cannot be exchanged for cash or laser and nail services. They are valid only at the location selected at the time of purchase and cannot be transferred between the Manhattan and Astoria locations. They are valid for one year from the date of purchase."],
  ["Are prices the same at every location?", "No. Astoria and the Upper East Side have their own menus and prices. Pick your location at the top of the menu and every price on this page follows."],
  ["Is the price on the menu final?", "Services may vary based on length of hair and amount of time. Prices are subject to change for exceptional cases, and a consultation is required for the final price. No refunds."],
  ["How much does CoolSculpting® Elite cost?", "Pricing varies based on several factors. You receive a customized quote after your initial consultation, which is free."],
];

const usd = (n) => `$${Number(n).toLocaleString("en-US")}`;
const ehOpcoes = (p) => p && typeof p === "object" && !Array.isArray(p);
const faixa = (p) => (Array.isArray(p) ? `${usd(p[0])}–${p[1].toLocaleString("en-US")}` : usd(p));
const limites = (p) => (Array.isArray(p) ? p : [p, p]);
const chave = (g, s) => `${g}|${s}`.toLowerCase().replace(/[^a-z0-9|]+/g, "-");
const notaDe = (n, loc) => (n && typeof n === "object" ? n[loc] || "" : n || "");

function inicio() {
  const r = { loc: "astoria", cat: "hair", rolar: false, detalhe: "" };
  try {
    const q = new URLSearchParams(window.location.search);
    const l = q.get("loc"); const m = q.get("menu");
    const salvo = window.localStorage.getItem("nt-loc");
    if (l === "astoria" || l === "ues") r.loc = l; else if (salvo === "astoria" || salvo === "ues") r.loc = salvo;
    if (m && MENU.some((c) => c.id === m)) { r.cat = m; r.rolar = true; }
  } catch { /* storage bloqueado */ }
  /* Página de unidade (domínio deles): a URL vence a preferência salva. O cardápio só tem dois
     preços (Astoria e UES); o Med Spa fica no UES, então a página dele usa os preços do UES. */
  if (UNIDADE_DA_URL) { r.loc = UNIDADE_DA_URL.id === "astoria" ? "astoria" : "ues"; r.detalhe = UNIDADE_DA_URL.id; }
  /* MED SPA COMO FRENTE PRÓPRIA (2026-10-13, Anexo A Parte 4): no domínio deles é /med-spa-ues (detalhe "med");
     na prévia, ?frente=med. A página abre pela porta do Med Spa — hero, texto, telefone e objetivo (a consulta
     grátis) — sem tirar nada do site. */
  try { if (new URLSearchParams(window.location.search).get("frente") === "med") { r.loc = "ues"; r.detalhe = "med"; } } catch { /* sem URL */ }
  return r;
}

/* ─── peças ────────────────────────────────────────────────────────────────────────────────── */
function Flor({ className = "" }) {
  return <svg className={className} viewBox="0 0 32 31" aria-hidden="true"><path fillRule="evenodd" fill="currentColor" d={FLOR} /></svg>;
}
function Selo() {
  return <span className="nt-selo" aria-hidden="true"><Flor /></span>;
}
function Seta({ baixo }) {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={baixo ? { transform: "rotate(90deg)" } : undefined}><path d="M3 8h10M9 4l4 4-4 4" /></svg>;
}

/* VISTAS. O site deles é enxuto porque preços e About moram em páginas próprias. Aqui é o mesmo:
   a home tem a sequência da home DELES; "services" e "about" são vistas da mesma página, trocadas
   sem recarregar. Cada âncora sabe em que vista mora. */
const VISTA = { menu: "services", faq: "services", about: "about", lilian: "about", store: "store", policies: "policies", privacy: "policies", cancellation: "policies", "store-policies": "policies" };
const EM_TODAS = new Set(["contact", "plano"]);
const vistaDoHash = () => (typeof window === "undefined" ? "home" : VISTA[window.location.hash.slice(1)] || "home");

/* A agente de voz DELES na ElevenLabs ("Lilian · Natura Spa + Salon"), no widget oficial da
   ElevenLabs. É pública (sem login) e a política de segurança do site já libera unpkg e elevenlabs. */
const AGENTE_VOZ = "agent_8701kxnfhgmgefzbbwda8d86mqwj";
const WIDGET_VOZ = "https://unpkg.com/@elevenlabs/convai-widget-embed";

/* "Talk to us now" começa a ligação no widget da ElevenLabs (o botão "Start a call" dele).
   Se o widget ainda não carregou, cai no telefone da unidade: nunca um botão que não faz nada. */
const falar = (tel) => {
  const raiz = document.querySelector("elevenlabs-convai")?.shadowRoot;
  const bt = raiz && Array.from(raiz.querySelectorAll("button")).find((b) => /call/i.test(`${b.textContent} ${b.getAttribute("aria-label") || ""}`));
  if (bt) bt.click(); else if (tel) window.location.href = `tel:${tel}`;
};

/* Botão nas cores e no contorno DELES, em pílula tátil. */
/* A fonte do título (ivyora-display, kit Adobe) já está carregada? Quem volta ao site com ela em cache
   não espera nada. Sem a API de fontes, responde "sim" e nada fica escondido. */
const fonteDoTituloPronta = () => {
  try { return !document.fonts || [...document.fonts].some((f) => /ivyora/i.test(f.family) && f.status === "loaded"); } catch { return true; }
};

function Botao({ as: Tag = "a", tom = "rosa", cheio, forte, fino, children, className = "", ...resto }) {
  return (
    <Tag className={`nt-b nt-b-${tom} ${cheio ? "nt-b-cheio" : ""} ${fino ? "nt-b-2l" : ""} ${className}`} {...resto}>
      <span className="nt-b-t">{children || (<><b>{forte}</b>{fino ? <i>{fino}</i> : null}</>)}</span>
    </Tag>
  );
}

/* Fotos de uma unidade, em troca lenta. Pausa no hover; parada sob movimento reduzido. */
function Fotos({ fotos, atraso = 0 }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (pausa || fotos.length < 2) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let id = 0;
    const t0 = setTimeout(() => { id = setInterval(() => { if (!document.hidden) setI((x) => (x + 1) % fotos.length); }, 5200); }, atraso);
    return () => { clearTimeout(t0); clearInterval(id); };
  }, [pausa, fotos.length, atraso]);
  return (
    <div className="nt-fotos" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      {fotos.map(([f, alt], k) => (
        <img key={f} src={`${B}/${f}.webp`} alt={alt} loading="lazy" width="1600" height="1200" className={k === i ? "nt-on" : ""} aria-hidden={k === i ? undefined : "true"} />
      ))}
      <Selo />
      <div className="nt-pontos" role="group" aria-label="Photos">
        {fotos.map(([f, alt], k) => <button key={f} type="button" aria-label={alt} aria-pressed={k === i} onClick={() => { setI(k); setPausa(true); }} />)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */
export default function NaturaSpa() {
  const raiz = useRef(null);
  /* CLS (2026-10-05): o título da abertura nascia na fonte reserva (Fraunces) e trocava para a ivyora
     ~1,5 s depois — outra largura, outra quebra de linha, as palavras pulavam (CLS 0,03–0,04 no Lighthouse).
     Agora a entrada das palavras espera a fonte verdadeira; o título fica invisível (visibility, que não
     conta como deslocamento) e entra já certo. Teto de 1,5 s: fonte lenta ou kit fora do ar não prende nada. */
  const [fonteOk, setFonteOk] = useState(fonteDoTituloPronta);
  useEffect(() => {
    if (fonteOk || !document.fonts) return undefined;
    const ver = () => { if (fonteDoTituloPronta()) setFonteOk(true); };
    document.fonts.addEventListener("loadingdone", ver);
    const teto = setTimeout(() => setFonteOk(true), 1500);
    return () => { document.fonts.removeEventListener("loadingdone", ver); clearTimeout(teto); };
  }, [fonteOk]);
  const hero = useRef(null);
  const midia = useRef(null);
  const video = useRef(null);
  const menuBook = useRef(null);

  const [ini] = useState(inicio);
  const [t, setT] = useState(() => agoraNY());
  const [loc, setLoc] = useState(ini.loc);
  const [cat, setCat] = useState(ini.cat);
  const [obj, setObj] = useState(ini.detalhe === "med" ? "confidence" : "unwind");   // entrada por objetivo (seção #goals); frente do Med Spa abre na consulta
  const [busca, setBusca] = useState("");
  const [ritual, setRitual] = useState([]);
  const [copiado, setCopiado] = useState(false);
  const [aberta, setAberta] = useState(0);
  const [detalhe, setDetalhe] = useState(ini.detalhe);
  const [book, setBook] = useState(false);
  const [rolou, setRolou] = useState(false);
  const [menu, setMenu] = useState(false);            // menu do celular
  const [filme, setFilme] = useState(true);           // filme da hero tocando
  const [mira, setMira] = useState("");               // unidade em destaque no mapa
  const [subOff, setSubOff] = useState(false);        // menu de fotos recolhido depois do clique
  const [pg, setPg] = useState(() => (ini.rolar ? "services" : vistaDoHash()));   // home | services | about
  const [plano] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("plano"));
  const [naPrevia] = useState(() => typeof window !== "undefined" && (ehNosso(window.location.host) || /(\.pages\.dev|^localhost|^127\.0\.0\.1)$/.test(window.location.hostname) || window.location.hostname === "localhost"));
  /* No celular o widget de voz fica no formato mínimo (só a flor): no compacto, a caixa dele (234 px de largura)
     cobria o "Our specials" do cartão da abertura — Lighthouse, área de toque. Lido uma vez: o widget só lê
     a variante quando carrega. O "Talk to us now" segue abrindo a chamada (o botão "Start a call" existe nos dois). */
  const [vozMini] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 699px)").matches);
  const vozes = useRef(null);

  const u = UNIDADES[loc];
  const frenteMed = detalhe === "med";   // a frente própria do Med Spa (ver inicio())
  const st = useMemo(() => statusDe(u, t), [u, t]);
  const [forte, fino] = vozDoBotao(u, st);
  const promo = promoVale(t);

  useEffect(() => { const id = setInterval(() => setT(agoraNY()), 30000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (!ini.rolar) return undefined;
    const id = setTimeout(() => document.getElementById("menu")?.scrollIntoView(), 60);
    return () => clearTimeout(id);
  }, [ini]);
  const trocar = useCallback((l) => { setLoc(l); try { window.localStorage.setItem("nt-loc", l); } catch { /* sem storage */ } }, []);
  /* Vai para uma âncora: troca a vista se precisar e só então rola (a seção pode estar escondida). */
  const abrir = useCallback((id, empurra = true) => {
    if (!EM_TODAS.has(id)) setPg(VISTA[id] || "home");
    if (empurra) { try { window.history.pushState(null, "", id && id !== "top" ? `#${id}` : window.location.pathname + window.location.search); } catch { /* sem history */ } }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = id && id !== "top" ? document.getElementById(id) : null;
      if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
    }));
  }, []);

  /* título, descrição (os DELES), schema, canonical e robots */
  useEffect(() => {
    const antes = document.title;
    const md = document.querySelector('meta[name="description"]'); const mdAntes = md?.getAttribute("content");
    const ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "nt-ld";

    if (TENANT) {
      /* NO DOMÍNIO DELES. O servidor já mandou tudo isto no HTML cru; aqui o React só confirma os
         mesmos valores (mesma função) — e troca o JSON-LD do servidor pelo dele, para nunca haver
         dois grafos na página. Indexar ou não é a coluna `indexable` da linha do domínio. */
      const cab = cabecaDoCliente({ slug: SLUG, host: TENANT.host, indexable: TENANT.indexable, unidade: UNIDADE_DA_URL ? UNIDADE_DA_URL.id : null });
      if (!cab) return undefined;
      document.title = cab.titulo;
      md?.setAttribute("content", cab.descricao);
      let cn = document.querySelector('link[rel="canonical"]');
      if (!cn) { cn = document.createElement("link"); cn.rel = "canonical"; document.head.appendChild(cn); }
      cn.href = cab.canonical;
      let rb = document.querySelector('meta[name="robots"]');
      if (!rb) { rb = document.createElement("meta"); rb.name = "robots"; document.head.appendChild(rb); }
      rb.content = cab.robots;
      document.getElementById("tenant-ld")?.remove();
      ld.textContent = JSON.stringify(cab.ld);
      document.head.appendChild(ld);
      return () => { ld.remove(); };
    }

    document.title = TITULO;
    md?.setAttribute("content", DESCRICAO);
    ld.textContent = JSON.stringify(ldVitrine(SLUG, { previa: true }));
    document.head.appendChild(ld);
    /* 🚨 noindex: em guileoai.com esta página é uma PRÉVIA do site deles no nosso domínio. Indexar
       criaria conteúdo duplicado competindo com o domínio deles. Aqui é SEMPRE noindex — quem
       indexa é o domínio do cliente, quando a linha dele tem indexable = true. */
    const rb = document.createElement("meta"); rb.name = "robots"; rb.content = "noindex, nofollow"; rb.id = "nt-robots";
    document.head.appendChild(rb);
    /* a casca traz o canonical da HOME da Guileo; aqui a prévia aponta para ela mesma (o Lighthouse
       acusava "canonical inválido": esta página dizia ser cópia de guileoai.com/). */
    const cn = document.querySelector('link[rel="canonical"]'); const cnAntes = cn?.getAttribute("href");
    cn?.setAttribute("href", `https://guileoai.com/novo/${SLUG}`);
    return () => { document.title = antes; if (md && mdAntes != null) md.setAttribute("content", mdAntes); ld.remove(); rb.remove(); if (cn && cnAntes != null) cn.setAttribute("href", cnAntes); };
  }, []);

  /* filme: 720p no celular; movimento reduzido fica na foto */
  useEffect(() => {
    const v = video.current; if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    v.src = `${B}/${window.innerWidth < 900 ? "hero-720.mp4" : "hero.mp4"}`;
    v.play?.().catch(() => { /* autoplay negado: fica a foto de hero deles */ });
  }, []);

  /* rolagem: paralaxe leve da hero + topo com sombra. Só transform. */
  useEffect(() => {
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const ler = () => {
      raf = 0;
      const y = window.scrollY;
      setRolou(y > 12);
      if (!calmo && midia.current && hero.current) {
        const h = hero.current.offsetHeight || 1;
        const p = Math.min(1, Math.max(0, y / h));
        midia.current.style.transform = `translate3d(0,${(p * 70).toFixed(1)}px,0) scale(${(1 + p * 0.06).toFixed(4)})`;
      }
    };
    const pedir = () => { if (!raf) raf = requestAnimationFrame(ler); };
    ler();
    window.addEventListener("scroll", pedir, { passive: true });
    return () => { window.removeEventListener("scroll", pedir); if (raf) cancelAnimationFrame(raf); };
  }, []);

  /* reveal FAIL-OPEN */
  useEffect(() => {
    const r = raiz.current; if (!r || !("IntersectionObserver" in window)) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden) return undefined;
    const alvos = Array.from(r.querySelectorAll(".nt-rv"));
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("nt-rv-on"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    alvos.forEach((a) => io.observe(a));
    r.classList.add("nt-js");
    const solta = setTimeout(() => alvos.forEach((a) => a.classList.add("nt-rv-on")), 1800);
    return () => { clearTimeout(solta); io.disconnect(); r.classList.remove("nt-js"); };
  }, []);

  /* voltar e avançar do navegador trocam de vista; um link que já chega com #âncora rola até ela */
  useEffect(() => {
    const volta = () => abrir(window.location.hash.slice(1) || "top", false);
    window.addEventListener("popstate", volta);
    const h = window.location.hash.slice(1);
    /* Quem chega por um endereço antigo (/cancellation-policy → /#cancellation) cai aqui. Fonte e fotos
       chegam depois e empurram a seção para baixo: rola de novo quando assentam — a não ser que a
       pessoa já tenha começado a rolar por conta própria. */
    let mexeu = false;
    const parou = () => { mexeu = true; };
    const rola = () => { if (!mexeu && window.location.hash.slice(1) === h) document.getElementById(h)?.scrollIntoView(); };
    const GESTOS = ["wheel", "touchstart", "keydown"];
    const id = h ? setTimeout(rola, 80) : 0;
    if (h) {
      GESTOS.forEach((g) => window.addEventListener(g, parou, { passive: true }));
      document.fonts?.ready?.then(rola).catch(() => {});
      window.addEventListener("load", rola);
    }
    return () => {
      window.removeEventListener("popstate", volta); clearTimeout(id);
      GESTOS.forEach((g) => window.removeEventListener(g, parou));
      window.removeEventListener("load", rola);
    };
  }, [abrir]);

  /* widget oficial da ElevenLabs: o script entra uma vez só */
  useEffect(() => {
    if (document.querySelector(`script[src="${WIDGET_VOZ}"]`)) return;
    const sc = document.createElement("script"); sc.src = WIDGET_VOZ; sc.async = true; sc.type = "text/javascript";
    document.body.appendChild(sc);
  }, []);
  /* o widget na cor da marca: as variaveis de cor dele moram dentro do shadow root, entao o estilo entra la */
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      const raiz = document.querySelector("elevenlabs-convai")?.shadowRoot;
      if (raiz && !raiz.getElementById("nt-voz")) {
        const st = document.createElement("style"); st.id = "nt-voz";
        st.textContent = ":host{--el-accent:#015577;--el-accent-hover:#01668f;--el-accent-active:#014a66;--el-accent-border:#015577;--el-base-border:rgba(28,28,28,.1);--el-button-radius:20px;font-family:'sofia-pro','Poppins',system-ui,sans-serif}p:has(a[href*=\"elevenlabs.io\"]),a[href*=\"elevenlabs.io\"]{visibility:hidden}";   // Luis (2026-10-05) mandou tirar o "Powered by ElevenAgents"; o disable_banner oficial foi IGNORADO pela conta (plano). Ciente de que os termos da ElevenLabs podem exigir a marca. visibility (e NÃO display:none): a linha reserva 32 px embaixo do botão; sem ela o widget descia e cobria o "Our specials" no celular (Lighthouse: área de toque).
        raiz.appendChild(st);
      }
      n += 1;
      if ((raiz && raiz.getElementById("nt-voz")) || n > 40) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, []);

  /* seletor do Book Now: fecha com Esc e com clique fora */
  useEffect(() => {
    if (!book) return undefined;
    const tecla = (e) => { if (e.key === "Escape") setBook(false); };
    const fora = (e) => { if (menuBook.current && !menuBook.current.contains(e.target)) setBook(false); };
    document.addEventListener("keydown", tecla); document.addEventListener("pointerdown", fora);
    return () => { document.removeEventListener("keydown", tecla); document.removeEventListener("pointerdown", fora); };
  }, [book]);

  /* ─── cardápio + ritual ─── */
  const col = loc === "ues" ? 2 : 1;
  const categoria = MENU.find((c) => c.id === cat) || MENU[0];
  const termo = busca.trim().toLowerCase();
  const grupos = useMemo(() => {
    const fonte = termo ? MENU.flatMap((c) => c.grupos.map((g) => ({ ...g, rotulo: `${c.nome} · ${g.nome}` }))) : categoria.grupos;
    return fonte
      .map((g) => ({ ...g, itens: g.itens.filter((i) => i[col] != null && (!termo || `${i[0]} ${notaDe(i[3], loc)}`.toLowerCase().includes(termo))) }))
      .filter((g) => g.itens.length);
  }, [categoria, termo, col, loc]);
  const indice = useMemo(() => {
    const m = new Map();
    MENU.forEach((c) => c.grupos.forEach((g) => g.itens.forEach((i) => m.set(chave(g.nome, i[0]), i))));
    return m;
  }, []);
  const noRitual = (k, opc) => ritual.some((r) => r.k === k && r.opc === opc);
  const alternar = (grupo, nome, opc = "") => {
    const k = chave(grupo, nome);
    setRitual((rs) => (rs.some((r) => r.k === k && r.opc === opc)
      ? rs.filter((r) => !(r.k === k && r.opc === opc))
      : [...rs.filter((r) => r.k !== k), { k, nome, opc }]));
    setCopiado(false);
  };
  const conta = useMemo(() => {
    let de = 0; let ate = 0; const linhas = []; const fora = [];
    ritual.forEach((r) => {
      const p = indice.get(r.k)?.[col];
      if (p == null) { fora.push(r.nome); return; }
      let v = p;
      if (ehOpcoes(p)) v = p[r.opc] ?? Object.values(p)[0];
      const [a, b] = limites(v); de += a; ate += b;
      linhas.push(`${r.nome}${r.opc && ehOpcoes(p) && p[r.opc] != null ? ` (${r.opc})` : ""} — ${faixa(v)}`);
    });
    return { de, ate, linhas, fora, n: linhas.length };
  }, [ritual, indice, col]);
  const total = conta.de === conta.ate ? usd(conta.de) : `${usd(conta.de)}–${conta.ate.toLocaleString("en-US")}`;
  const copiar = async () => {
    const txt = `My Natura Spa visit · ${u.curto}\n${conta.linhas.map((l) => `• ${l}`).join("\n")}\nEstimated total: ${total}`;
    try { await navigator.clipboard.writeText(txt); setCopiado(true); } catch { setCopiado(false); }
  };

  /* Mesma árvore do menu DELES: Hair Salon e Med Spa abrem por unidade. Aqui cada item já troca
     a unidade E a aba do cardápio antes de rolar — o clique chega no preço certo. */
  const NAV = [
    { id: "specials", nome: "Specials" },
    { nome: "Hair Salon", sub: [["Spa + Salon Astoria", "astoria", "hair", "hair-astoria"], ["Hair Salon UES", "ues", "hair", "hair-ues"],
      ["Masterpiece Lashes", "", "", "lashes", PARCEIROS[0].link], ["Dr Jocelynn Cheng Acupuncture", "", "", "acupuncture", PARCEIROS[1].link]] },
    { nome: "Med Spa", sub: [["CoolSculpting Elite", "", "medspa", "coolsculpting"], ["Natura Laser Skincare", "", "", "laser", REDES.laser],   // era "Brazilian Laser NYC" → brazilian-laser-nyc.chrone.work, em manutenção (500) desde pelo menos 2026-10-04
      ["Med Spa Astoria", "astoria", "face", "med-astoria"], ["Med Spa UES", "ues", "face", "med-ues"]] },
    { id: "reviews", nome: "Reviews" }, { id: "about", nome: "About Us" }, { id: "locations", nome: "Locations" }, { id: "gift", nome: "Gift Cards" },
    // Na PRÉVIA (guileoai.com, pages.dev, localhost) a loja entra no menu para a Lilian ver (Luis, 2026-10-05:
    // «cadê a store?»). No domínio DELES só quando abrir de verdade: maquete com preço de exemplo não vai ao público.
    ...(LOJA.aoVivo || plano || pg === "store" || naPrevia ? [{ id: "store", nome: "Store" }] : []),
  ];
  const irPara = (l, alvo) => {
    setMenu(false);
    if (l) { trocar(l); setCat(alvo); setBusca(""); }
    abrir(l ? "menu" : alvo);
  };
  /* Todo link interno (#algo) passa por aqui: assim nenhum link cai numa seção escondida. */
  const aoClicar = (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = a.getAttribute("href").slice(1);
    if (id && id !== "top" && !document.getElementById(id)) return;
    e.preventDefault();
    abrir(id || "top");
  };

  return (
    <div className="nt" ref={raiz} onClick={aoClicar} data-fonte={fonteOk ? "ok" : "espera"}>
      <style>{`
        @import url('https://use.typekit.net/ajy3bhf.css');
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..400,0&family=Poppins:wght@300;400;500;600;700&display=swap');
        .nt{--branco:#fff;--nevoa:#F7F7F7;--creme:#F6F0E8;--tinta:#1C1C1C;--texto:#5A5A5A;--rosa:#C37B89;--rosa-e:#98505F;--rosa-p:#7C3D4B;--ouro:#D4AF37;--ouro-e:#7D6411;--coral:#EF7869;--petrol:#015577;--cool:#0063A8;--fio:rgba(28,28,28,.12);
          position:relative;background:var(--branco);color:var(--tinta);font-family:'sofia-pro','Poppins',system-ui,sans-serif;font-weight:300;font-size:15px;line-height:1.75;-webkit-font-smoothing:antialiased;overflow-x:clip}
        .nt *{box-sizing:border-box}
        .nt a{color:inherit;text-decoration:none}
        .nt button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
        .nt h1,.nt h2,.nt .nt-serifa{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-variation-settings:'SOFT' 0,'opsz' 144;letter-spacing:-.012em;line-height:1.12;margin:0;color:var(--tinta)}
        .nt h3{font-family:'sofia-pro','Poppins',sans-serif;font-weight:700;font-size:24px;line-height:1.25;letter-spacing:-.01em;margin:0;color:var(--tinta)}
        .nt p{margin:0}
        .nt :focus-visible{outline:2px solid var(--rosa-e);outline-offset:3px}
        .nt-in{width:min(1320px,100% - 44px);margin-inline:auto}
        .nt-num{font-variant-numeric:tabular-nums}
        .nt-h2{font-size:clamp(40px,5vw,64px)}
        .nt-sec{padding:clamp(64px,8vw,108px) 0}
        .nt [id]{scroll-margin-top:96px}
        @media(max-width:520px){.nt [id]{scroll-margin-top:78px}}
        .nt-nevoa{background:var(--nevoa)}
        .nt-creme{background:var(--creme)}
        .nt-lead{max-width:46em;color:var(--tinta);margin-top:16px}
        .nt-cab{margin-bottom:clamp(30px,4vw,52px)}
        .nt-flor{width:20px;height:20px;color:var(--rosa);display:block;margin-bottom:14px}
        /* entrada por objetivo (#goals) */
        .nt-obj-l{margin-top:14px;max-width:34em;color:var(--texto)}
        .nt-obj-c{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:clamp(24px,3vw,34px)}
        .nt .nt-obj-c button{min-height:46px;padding:0 20px;border-radius:999px;font-size:14.5px;font-weight:500;color:var(--tinta);box-shadow:inset 0 0 0 1px var(--fio);background:#fff;transition:color .25s,box-shadow .25s,background .25s}
        .nt .nt-obj-c button:hover{box-shadow:inset 0 0 0 1px var(--rosa)}
        .nt .nt-obj-c button[aria-pressed="true"]{background:var(--rosa-e);color:#fff;box-shadow:inset 0 0 0 1px var(--rosa-e)}
        .nt-obj-p{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:clamp(24px,4vw,56px);align-items:center}
        .nt-obj-p figure{margin:0;border-radius:64px 16px 64px 16px;overflow:hidden;aspect-ratio:4/3;background:var(--creme);box-shadow:0 1px 2px rgba(28,28,28,.08),0 30px 50px -36px rgba(28,28,28,.5)}
        .nt-obj-p img{display:block;width:100%;height:100%;object-fit:cover;animation:nt-obj-in .6s ease both}
        @keyframes nt-obj-in{from{opacity:0;transform:scale(1.02)}}
        .nt .nt-obj-t h3{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-size:clamp(30px,3.2vw,42px);line-height:1.1}
        .nt-obj-t>p{margin-top:12px;color:var(--texto);max-width:30em}
        .nt-obj-s{list-style:none;margin:22px 0 0;padding:0}
        .nt-obj-s li{display:flex;align-items:baseline;gap:10px;padding:10px 0;border-bottom:1px solid var(--fio);font-size:15.5px}
        .nt-obj-s li span{color:var(--tinta)}.nt-obj-s li em{font-style:normal;font-size:13px;color:var(--texto)}
        .nt-obj-s li i{flex:1;border-bottom:1px dotted rgba(28,28,28,.25);transform:translateY(-4px)}
        .nt-obj-s li b{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:400;font-size:19px;white-space:nowrap}
        .nt-obj-m li span::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--rosa);margin:0 12px 2px 0}
        .nt-obj-u{margin-top:12px;font-size:13px;color:var(--texto)}
        .nt .nt-obj-u button{font:inherit;color:var(--rosa-e);text-decoration:underline;text-underline-offset:3px}
        .nt-obj-a{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;margin-top:24px}
        .nt-obj-x{margin-top:18px;font-size:14px;color:var(--texto)}
        .nt-obj-x a{color:var(--rosa-e);font-weight:500}
        @media(max-width:860px){.nt-obj-p{grid-template-columns:1fr}.nt-obj-p figure{border-radius:48px 14px 48px 14px}}
        @media(prefers-reduced-motion:reduce){.nt-obj-p img{animation:none}}
        .nt-js .nt-rv{opacity:0;transform:translate3d(0,20px,0);transition:opacity .9s ease,transform .9s cubic-bezier(.2,.7,.2,1)}
        .nt-js .nt-rv.nt-rv-on{opacity:1;transform:none}
        .nt-js .nt-rv .nt-flor{transform:scale(0) rotate(-80deg);transition:transform .8s cubic-bezier(.2,1.3,.4,1) .25s}
        .nt-js .nt-rv.nt-rv-on .nt-flor{transform:none}

        /* ── BOTAO: pilula TATIL (Luis, 2026-09-29: «tira esse espelhado, deixa como os do Guileo,
           realismo 4K tipo que de pra pegar, so um toque»). Nada se mexe por dentro: sem varredura,
           sem reflexo que anda. O realismo vem de um objeto parado sob luz fixa de cima:
           aro de luz no topo · sombra interna embaixo (espessura) · sombra de contato curta
           (pousa) · sombra de ambiente longa (espaco). No hover ele sobe; no clique ele afunda. */
        .nt .nt-b{--c:var(--rosa);--ce:var(--rosa-e);position:relative;display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 26px;border-radius:999px;
          font-family:'sofia-pro','Poppins',sans-serif;font-weight:600;font-size:14px;letter-spacing:-.02em;cursor:pointer;
          background:linear-gradient(180deg,#fff 0%,#FBF8F6 100%);
          box-shadow:inset 0 0 0 1px var(--c),inset 0 1.5px 0 #fff,inset 0 -3px 5px -2px color-mix(in srgb,var(--c) 26%,transparent),0 1px 1.5px color-mix(in srgb,var(--ce) 34%,transparent),0 10px 20px -12px color-mix(in srgb,var(--ce) 55%,transparent);
          transition:transform .3s cubic-bezier(.2,.7,.2,1),box-shadow .3s ease,background .3s ease}
        .nt .nt-b{color:var(--ce)}
        .nt .nt-b-ouro{--c:var(--ouro);--ce:var(--ouro-e)}
        .nt .nt-b-tinta{--c:#1C1C1C;--ce:#1C1C1C}
        .nt .nt-b-cool{--c:var(--cool);--ce:#004A80}
        .nt .nt-b-petrol{--c:var(--petrol);--ce:#013B52}
        .nt-b-f{display:none}
        .nt .nt-b:hover{transform:translateY(-1.5px);background:linear-gradient(180deg,#fff 0%,color-mix(in srgb,var(--c) 9%,#fff) 100%);
          box-shadow:inset 0 0 0 1px var(--ce),inset 0 1.5px 0 #fff,inset 0 -3px 5px -2px color-mix(in srgb,var(--c) 30%,transparent),0 2px 3px color-mix(in srgb,var(--ce) 30%,transparent),0 18px 28px -14px color-mix(in srgb,var(--ce) 62%,transparent)}
        .nt .nt-b:active{transform:translateY(.5px) scale(.985);transition-duration:.08s;
          box-shadow:inset 0 0 0 1px var(--ce),inset 0 2px 4px color-mix(in srgb,var(--ce) 26%,transparent),0 1px 1px color-mix(in srgb,var(--ce) 30%,transparent)}
        .nt-b-t{display:flex;flex-direction:column;align-items:center;line-height:1.2;text-align:center;white-space:nowrap}
        .nt-b-t b{font-weight:600}
        .nt-b-t i{font-style:normal;font-weight:400;font-size:11.5px;letter-spacing:0;opacity:.9;margin-top:2px}
        .nt .nt-b-2l{min-height:58px;padding:0 30px}
        /* cheio: o corpo e a propria cor, fosca, com a mesma luz fixa */
        .nt .nt-b-cheio,.nt .nt-b-cheio:hover{color:#fff}
        .nt .nt-b-cheio,.nt .nt-b-cheio:hover{background:linear-gradient(180deg,color-mix(in srgb,var(--c) 90%,#fff) 0%,var(--c) 55%,color-mix(in srgb,var(--c) 70%,var(--ce)) 100%)}
        .nt .nt-b-cheio{box-shadow:inset 0 1px 0 rgba(255,255,255,.42),inset 0 -3px 5px -2px rgba(0,0,0,.22),0 1px 1.5px color-mix(in srgb,var(--ce) 60%,transparent),0 12px 22px -12px color-mix(in srgb,var(--ce) 80%,transparent)}
        .nt .nt-b-cheio:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.46),inset 0 -3px 5px -2px rgba(0,0,0,.22),0 2px 3px color-mix(in srgb,var(--ce) 50%,transparent),0 20px 30px -14px color-mix(in srgb,var(--ce) 85%,transparent)}
        .nt .nt-b-cheio:active{box-shadow:inset 0 2px 5px rgba(0,0,0,.3),0 1px 1px color-mix(in srgb,var(--ce) 50%,transparent)}
        .nt .nt-b-rosa.nt-b-cheio{--c:var(--rosa-e);--ce:var(--rosa-p)}
        .nt .nt-b-ouro.nt-b-cheio,.nt .nt-b-ouro.nt-b-cheio:hover{color:#2A2105}
        .nt .nt-b-rosa.nt-b-cheio{text-shadow:0 1px 1px rgba(90,30,45,.4)}
        /* branco sobre foto */
        .nt .nt-b-branco,.nt .nt-b-branco:hover{color:var(--tinta)}
        .nt .nt-b-branco,.nt .nt-b-branco:hover{--c:#fff;--ce:#1C1C1C;background:linear-gradient(180deg,#fff 0%,#F4F1EE 100%)}
        .nt .nt-b-branco{box-shadow:inset 0 1.5px 0 #fff,inset 0 -3px 5px -2px rgba(28,28,28,.16),0 1px 2px rgba(0,0,0,.28),0 14px 26px -14px rgba(0,0,0,.6)}
        .nt-lk{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:14px;letter-spacing:-.02em;min-height:0;transition:gap .3s ease,color .3s ease}
        .nt .nt-lk:hover{gap:13px;color:var(--rosa-e)}
        .nt .nt-lk-rosa{color:var(--rosa-e)}

        .nt .nt-pular{position:absolute;left:12px;top:-60px;z-index:60;padding:12px 18px;border-radius:999px;background:var(--tinta);color:#fff;font-weight:600;font-size:14px;transition:top .2s ease}
        .nt .nt-pular:focus{top:12px}

        /* ── FAIXA DA PROMOCAO ── */
        .nt-faixa{background:var(--creme);font-size:13.5px;font-weight:400;text-align:center;padding:9px 12px;color:var(--tinta)}
        .nt-faixa a{display:inline-flex;gap:4px 10px;align-items:center;flex-wrap:wrap;justify-content:center}
        .nt-faixa b{font-weight:600}
        .nt-faixa u{text-decoration:none;color:var(--rosa-e);font-weight:600;display:inline-flex;align-items:center;gap:6px}

        /* ── TOPO ── */
        .nt-topo{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.9);-webkit-backdrop-filter:saturate(1.3) blur(14px);backdrop-filter:saturate(1.3) blur(14px);transition:box-shadow .4s ease}
        .nt-topo-on{box-shadow:0 1px 0 var(--fio),0 18px 30px -26px rgba(28,28,28,.5)}
        .nt-topo .nt-in{display:flex;align-items:center;gap:20px;min-height:84px}
        .nt-logo img{height:30px;width:auto;display:block}
        .nt-nav{display:none;gap:2px;margin-left:auto}
        .nt .nt-nav a{position:relative;padding:10px 13px;font-size:16px;font-weight:400;color:var(--texto);transition:color .25s ease}
        .nt-nav a::after{content:"";position:absolute;left:13px;right:13px;bottom:4px;height:1px;background:var(--rosa);transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.2,.7,.2,1)}
        .nt .nt-nav a:hover{color:var(--tinta)}.nt-nav a:hover::after{transform:scaleX(1)}
        .nt-bk{position:relative;margin-left:auto}
        .nt .nt-bk>.nt-b{min-width:126px;color:var(--texto);font-weight:400;font-size:16px;letter-spacing:0;box-shadow:inset 0 0 0 2px var(--c),inset 0 3px 0 #fff,inset 0 -4px 5px -2px color-mix(in srgb,var(--c) 26%,transparent),0 1px 1.5px color-mix(in srgb,var(--ce) 34%,transparent),0 10px 20px -12px color-mix(in srgb,var(--ce) 55%,transparent)}
        .nt .nt-bk>.nt-b:hover{color:var(--tinta)}
        .nt-pop{position:absolute;right:0;top:calc(100% + 10px);width:min(350px,calc(100vw - 44px));background:rgba(255,255,255,.97);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-radius:20px;padding:8px;
          box-shadow:inset 0 0 0 1px var(--fio),inset 0 1px 0 #fff,0 2px 4px rgba(28,28,28,.1),0 34px 60px -24px rgba(28,28,28,.45);transform-origin:100% 0;animation:nt-abre .28s cubic-bezier(.2,.7,.2,1)}
        @keyframes nt-abre{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
        .nt-pop a{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 14px;border-radius:14px;transition:background .25s ease}
        .nt-pop a:hover{background:var(--creme)}
        .nt-pop a+a{margin-top:2px}
        .nt-pop b{display:block;font-weight:600;font-size:14.5px;line-height:1.3}
        .nt-pop small{display:block;font-size:12.5px;color:var(--texto);line-height:1.4}
        .nt-est{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:500;white-space:nowrap}
        .nt-est u{flex:none;text-decoration:none;width:7px;height:7px;border-radius:50%;background:#4E8B3A;box-shadow:0 0 0 3px rgba(78,139,58,.18)}
        .nt-est u.nt-fech{background:var(--ouro-e);box-shadow:0 0 0 3px rgba(154,123,23,.18)}
        .nt .nt-nav-i>button{display:inline-flex;align-items:center;gap:7px;padding:10px 13px;font-size:16px;font-weight:400;color:var(--texto);transition:color .25s ease}
        .nt .nt-nav-i:hover>button,.nt .nt-nav-i:focus-within>button{color:var(--tinta)}
        .nt-nav-i>button svg{transition:transform .3s ease}
        .nt-nav-i:hover>button svg,.nt-nav-i:focus-within>button svg{transform:rotate(180deg)}
        /* menu com FOTOS, largura inteira, como o deles */
        .nt-sub{position:absolute;left:0;right:0;top:100%;padding:26px 0 34px;background:#fff;opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .25s ease,transform .25s cubic-bezier(.2,.7,.2,1),visibility .25s;
          box-shadow:0 1px 0 var(--fio),0 40px 60px -40px rgba(28,28,28,.45)}
        .nt-nav-i:hover .nt-sub,.nt-nav-i:focus-within .nt-sub{opacity:1;visibility:visible;transform:none}
        .nt-topo .nt-sub .nt-in{display:grid;grid-template-columns:repeat(4,1fr);gap:26px;align-items:start;min-height:0}
        .nt .nt-nav .nt-sub a,.nt .nt-nav .nt-sub button{display:block;width:100%;padding:0;text-align:center;font-size:16px;font-weight:400;color:var(--tinta)}
        .nt .nt-nav-off .nt-sub{opacity:0;visibility:hidden;transform:translateY(-6px)}
        .nt .nt-sub a::after{content:none}
        .nt-sub-f{display:block;aspect-ratio:3/2;overflow:hidden;border-radius:40px 12px 40px 12px;background:var(--nevoa);box-shadow:0 1px 2px rgba(28,28,28,.12),0 22px 34px -26px rgba(28,28,28,.55);transition:transform .45s cubic-bezier(.2,.7,.2,1),box-shadow .45s ease}
        .nt-sub-f img{width:100%;height:100%;object-fit:cover;object-position:50% 22%;display:block;transition:transform 1.2s cubic-bezier(.2,.6,.2,1)}
        .nt-sub-n{display:block;margin-top:14px;transition:color .25s ease}
        .nt-sub a:hover .nt-sub-f,.nt-sub button:hover .nt-sub-f{transform:translateY(-4px);box-shadow:0 2px 3px rgba(28,28,28,.12),0 30px 40px -26px rgba(28,28,28,.6)}
        .nt-sub a:hover img,.nt-sub button:hover img{transform:scale(1.05)}
        .nt .nt-sub a:hover .nt-sub-n,.nt .nt-sub button:hover .nt-sub-n{color:var(--rosa-e)}
        /* celular: gaveta com a arvore inteira + ligar para cada unidade */
        .nt .nt-ham{flex:none;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:var(--tinta);background:linear-gradient(180deg,#fff,#FBF8F6);
          box-shadow:inset 0 0 0 1px var(--fio),inset 0 1.5px 0 #fff,inset 0 -3px 5px -2px rgba(28,28,28,.12),0 1px 1.5px rgba(28,28,28,.14),0 10px 18px -12px rgba(28,28,28,.4)}
        .nt-gaveta{position:absolute;left:0;right:0;top:100%;max-height:calc(100vh - 68px);max-height:calc(100dvh - 68px);overflow:auto;background:#fff;padding:8px 0 28px;box-shadow:0 1px 0 var(--fio),0 30px 50px -30px rgba(28,28,28,.5);animation:nt-abre .28s cubic-bezier(.2,.7,.2,1)}
        .nt-gav-in{width:min(560px,100% - 44px);margin-inline:auto}
        .nt .nt-gaveta a,.nt .nt-gaveta button{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;text-align:left;min-height:54px;padding:0 4px;border-bottom:1px solid var(--fio);font-size:17px;font-weight:400;color:var(--tinta)}
        .nt-gaveta a svg,.nt-gaveta button svg{color:var(--rosa-e);flex:none}
        .nt-gav-g>p{padding:18px 4px 4px;font-size:13px;font-weight:600;color:var(--texto)}
        .nt .nt-gav-g button,.nt .nt-gav-g a{padding-left:16px}
        .nt-gav-t{margin-top:22px;padding:6px 16px;border-radius:22px;background:var(--nevoa)}
        .nt .nt-gav-t a{min-height:62px;padding:0}
        .nt .nt-gav-t a:last-child{border-bottom:0}
        .nt-gav-t b{display:block;font-weight:600;font-size:15px;line-height:1.3}
        .nt-gav-t small{display:block;font-size:13.5px;color:var(--texto)}
        @media(min-width:1180px){.nt-nav{display:flex}.nt-bk{margin-left:10px}.nt .nt-ham,.nt-gaveta{display:none}}
        @media(min-width:1180px) and (max-width:1339px){.nt .nt-nav a,.nt .nt-nav-i>button{font-size:15px;padding:10px 9px}.nt-topo .nt-in{gap:12px}}
        @media(max-width:520px){.nt-topo .nt-in{min-height:68px}.nt-logo img{height:25px}}

        /* ── HERO: como a deles (foto com margem, titulo centrado, cartao branco), mas filme ── */
        .nt-hero{padding:0 22px}
        .nt-palco{position:relative;height:min(82vh,780px);min-height:560px;border-radius:84px 22px 84px 22px}
        .nt-palco-f{position:absolute;inset:0;overflow:hidden;border-radius:84px 22px 84px 22px;background:#d9d3cc}
        .nt-midia{position:absolute;inset:-4% 0;will-change:transform}
        .nt-midia img,.nt-midia video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 40%}
        .nt-veu{position:absolute;inset:0;background:radial-gradient(ellipse 50% 22% at 50% 32%,rgba(40,30,28,.45) 0%,rgba(40,30,28,0) 100%),linear-gradient(180deg,rgba(40,30,28,.36) 0%,rgba(40,30,28,.14) 38%,rgba(40,30,28,0) 62%),radial-gradient(120% 90% at 50% 40%,transparent 60%,rgba(40,30,28,.22) 100%);pointer-events:none}
        .nt .nt-pausa{position:absolute;left:22px;bottom:22px;z-index:3;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:var(--tinta);background:linear-gradient(180deg,#fff,#F4F1EE);opacity:.86;
          box-shadow:inset 0 1.5px 0 #fff,inset 0 -3px 5px -2px rgba(28,28,28,.16),0 1px 2px rgba(0,0,0,.28),0 12px 22px -12px rgba(0,0,0,.6);transition:opacity .3s ease,transform .3s cubic-bezier(.2,.7,.2,1)}
        .nt .nt-pausa:hover,.nt .nt-pausa:focus-visible{opacity:1;transform:translateY(-1.5px)}
        @media(max-width:860px){.nt .nt-pausa{left:16px;bottom:62px}}
        @media(prefers-reduced-motion:reduce){.nt .nt-pausa{display:none}}
        .nt-tit{position:absolute;left:0;right:0;top:clamp(74px,15vh,150px);text-align:center;padding:0 20px}
        .nt .nt-tit p{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-variation-settings:'SOFT' 0,'opsz' 144;font-size:clamp(22px,2.7vw,35px);line-height:1.2;color:#fff;text-shadow:0 1px 18px rgba(40,30,28,.35)}
        .nt .nt-tit h1{font-size:clamp(40px,5vw,64px);color:#fff;margin-top:10px;text-shadow:0 2px 26px rgba(40,30,28,.4)}
        .nt-tit h1 span{display:inline-block}
        .nt[data-fonte="espera"] .nt-tit{visibility:hidden}
        .nt-js[data-fonte="ok"] .nt-tit p,.nt-js[data-fonte="ok"] .nt-tit h1 span{animation:nt-sobe 1.1s cubic-bezier(.2,.7,.2,1) both}
        .nt-js .nt-tit h1 span:nth-child(1){animation-delay:.18s}.nt-js .nt-tit h1 span:nth-child(2){animation-delay:.34s}.nt-js .nt-tit h1 span:nth-child(3){animation-delay:.5s}
        @keyframes nt-sobe{from{opacity:0;transform:translate3d(0,18px,0)}to{opacity:1;transform:none}}
        .nt-bem{position:absolute;right:0;bottom:0;width:min(379px,100%);padding:54px 36px;background:#fff;border-radius:48px 0 84px 0;
          box-shadow:inset 0 1.5px 0 #fff,0 -1px 2px rgba(40,30,28,.08),-18px -18px 44px -26px rgba(40,30,28,.4)}
        .nt-bem h2{font-size:29px;line-height:1.18}
        .nt-bem>p{margin-top:16px}
        .nt .nt-bem .nt-falar{margin-top:22px;width:100%}
        .nt .nt-falar .nt-b-t{display:inline-flex;flex-direction:row;align-items:center;gap:10px}
        /* "Talk to us now" (Luis, 2026-10-04: azul do logo + flor girando + ponto verde): a mesma cor do
           botão do widget de voz, que é o que este botão abre. A flor gira no MIOLO dela (15,4 / 14,5 no
           desenho), não no centro da caixa — senão bambolearia. O ponto verde é o "ao vivo", no canto da flor
           como o status de um avatar. Toque: a caixinha da flor cresce e torce; o giro segue no traçado. */
        .nt-falar-ic{position:relative;flex:none;width:22px;height:22px;display:grid;place-items:center;transition:transform .4s cubic-bezier(.2,.7,.2,1)}
        .nt-falar-ic svg{width:20px;height:20px;color:#fff;overflow:visible}
        .nt-falar-ic svg path{transform-box:view-box;transform-origin:15.36px 14.5px;animation:nt-gira 14s linear infinite}
        .nt-falar-ic u{position:absolute;right:-4px;bottom:-2px;width:8px;height:8px;border-radius:50%;background:#7FD06A;text-decoration:none;
          box-shadow:0 0 0 2px var(--petrol),0 0 0 4px rgba(127,208,106,.32);animation:nt-pulso 2.2s ease-in-out infinite}
        @keyframes nt-gira{to{transform:rotate(360deg)}}
        @keyframes nt-pulso{50%{box-shadow:0 0 0 2px var(--petrol),0 0 0 8px rgba(127,208,106,0)}}
        .nt .nt-falar:hover .nt-falar-ic{transform:scale(1.16) rotate(-14deg)}
        .nt .nt-falar:active .nt-falar-ic{transform:scale(.92);transition-duration:.08s}
        @media(prefers-reduced-motion:reduce){.nt-falar-ic svg path,.nt-falar-ic u{animation:none}.nt .nt-falar:hover .nt-falar-ic{transform:none}}
        .nt-bem-l{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:20px}
        .nt-bem>p.nt-est{display:flex;margin-top:18px;padding-top:16px;border-top:1px solid var(--fio);font-size:13px}
        .nt-js .nt-bem{animation:nt-sobe 1.2s cubic-bezier(.2,.7,.2,1) .55s both}
        @media(max-width:860px){.nt-hero{padding:0 12px}.nt-palco{height:auto;min-height:0}.nt-palco-f{position:relative;inset:auto;height:62vh;min-height:400px}.nt-palco-f{border-radius:52px 16px 52px 16px}.nt-bem{position:relative;width:auto;margin:-46px 14px 0;padding:34px 24px;border-radius:40px 14px 40px 14px;box-shadow:inset 0 1.5px 0 #fff,0 1px 2px rgba(40,30,28,.1),0 22px 40px -24px rgba(40,30,28,.45)}.nt-tit{top:64px}}

        /* ── LOCATIONS ── */
        .nt-locs{display:grid;gap:44px 22px}
        @media(min-width:900px){.nt-locs{grid-template-columns:repeat(3,1fr)}}
        .nt-loc{display:flex;flex-direction:column}
        .nt-fotos{position:relative;aspect-ratio:1/1;overflow:hidden;border-radius:64px 16px 64px 16px;background:var(--nevoa);box-shadow:0 1px 2px rgba(28,28,28,.12),0 30px 50px -34px rgba(28,28,28,.55)}
        .nt-fotos img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.06);transition:opacity 1.4s ease,transform 7s cubic-bezier(.2,.5,.3,1)}
        .nt-fotos img.nt-on{opacity:1;transform:scale(1)}
        .nt-fotos::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 100% at 50% 45%,transparent 62%,rgba(28,28,28,.2) 100%);pointer-events:none}
        .nt-pontos{position:absolute;left:0;right:0;bottom:12px;z-index:2;display:flex;justify-content:center;gap:4px}
        .nt-pontos button{width:26px;height:26px;display:grid;place-items:center}
        .nt-pontos button::before{content:"";width:18px;height:2px;background:rgba(255,255,255,.55);transition:background .3s ease,width .3s ease}
        .nt-pontos button[aria-pressed="true"]::before{background:#fff;width:24px}
        .nt-loc h3{margin-top:32px}
        .nt-loc .nt-est{margin-top:8px}
        .nt-loc>p{margin-top:12px}
        .nt-loc-b{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px}
        .nt .nt-loc-b .nt-b{padding:0 10px}
        .nt-det{display:grid;grid-template-rows:0fr;transition:grid-template-rows .55s cubic-bezier(.2,.7,.2,1)}
        .nt-det[data-on="1"]{grid-template-rows:1fr}
        .nt-det>div{overflow:hidden}
        .nt-det dl{margin:18px 0 12px;padding:16px 18px;background:var(--nevoa);border-radius:16px;display:grid;grid-template-columns:auto 1fr;gap:6px 18px;font-size:14px}
        .nt-det dt{font-weight:600}
        .nt-det dd{margin:0;text-align:right}
        .nt-det-l{display:flex;flex-wrap:wrap;gap:8px 22px}

        /* ── O SELO: a flor do logo DELES (path original do SVG) assinando as imagens.
           Fica no canto pequeno de cima, num disco tatil. No hover da imagem a flor gira UMA
           petala (72 graus = 360/5): e o unico movimento, e e de posicao, nao de brilho. */
        .nt-selo{position:absolute;top:14px;right:14px;z-index:3;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:var(--rosa);pointer-events:none;
          background:linear-gradient(180deg,#fff 0%,#FBF8F6 100%);
          box-shadow:inset 0 1.5px 0 #fff,inset 0 -3px 5px -2px color-mix(in srgb,var(--rosa) 30%,transparent),0 1px 2px rgba(28,28,28,.3),0 10px 18px -10px rgba(28,28,28,.65)}
        .nt-selo svg{width:18px;height:18px;display:block;transition:transform .9s cubic-bezier(.2,1.3,.4,1)}
        .nt-fotos:hover .nt-selo svg,.nt-tira:hover .nt-selo svg,.nt-gift:hover .nt-selo svg{transform:rotate(72deg)}
        .nt-gift .nt-selo{top:22px;right:22px;width:46px;height:46px}
        .nt-gift .nt-selo svg{width:21px;height:21px}
        @media(max-width:700px){.nt-selo{width:34px;height:34px;top:10px;right:10px}.nt-selo svg{width:15px;height:15px}}

        /* ── MISSAO ── */
        .nt [hidden]{display:none !important}
        /* missao: o degrade vivo e DELES (magenta #e9168c e amarelo #ffea01 a 50% sobre o cinza) */
        .nt-missao{position:relative;overflow:hidden}
        .nt-missao .nt-in{position:relative;z-index:1}
        .nt-aura{position:absolute;inset:0;opacity:.5;pointer-events:none;filter:blur(40px)}
        .nt-aura i{position:absolute;border-radius:50%;will-change:transform}
        .nt-aura i:nth-child(1){left:-18%;top:-10%;width:46%;height:120%;background:radial-gradient(closest-side,#e9168c,rgba(233,22,140,0));animation:nt-aura1 26s ease-in-out infinite alternate}
        .nt-aura i:nth-child(2){left:38%;top:8%;width:52%;height:120%;background:radial-gradient(closest-side,#ffea01,rgba(255,234,1,0));animation:nt-aura2 32s ease-in-out infinite alternate}
        .nt-aura i:nth-child(3){right:-14%;top:-46%;width:44%;height:110%;background:radial-gradient(closest-side,#e9168c,rgba(233,22,140,0));animation:nt-aura1 30s ease-in-out infinite alternate-reverse}
        @keyframes nt-aura1{to{transform:translate3d(9%,10%,0) scale(1.12)}}
        @keyframes nt-aura2{to{transform:translate3d(-12%,-8%,0) scale(.92)}}
        @media(prefers-reduced-motion:reduce){.nt-aura i{animation:none}}
        .nt-mis{display:grid;gap:54px;align-items:start}
        @media(min-width:940px){.nt-mis{grid-template-columns:1fr 1fr;gap:70px}}
        .nt .nt-mis-r{font-size:24px;line-height:1.2;margin-bottom:36px}
        .nt-mis h2{font-size:clamp(32px,3.9vw,50px);line-height:1.2}
        .nt-mis .nt-b{margin-top:36px}
        .nt-mis-l{display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:start;justify-items:center}
        .nt-mis-c{display:flex;flex-direction:column;align-items:center;gap:44px;text-align:center}
        .nt .nt-mis-p{font-size:20px;line-height:1.2;margin-bottom:26px}
        .nt-mis-c a{display:flex;flex-direction:column;align-items:center}
        .nt-mis-c img{display:block;max-width:100%;height:auto;transition:transform .7s cubic-bezier(.2,.7,.2,1)}
        .nt-mis-c a:hover img{transform:translateY(-5px) scale(1.03)}
        .nt-mis-c small{margin-top:14px;font-size:15px;color:var(--tinta)}
        @media(max-width:560px){.nt-mis-l{gap:20px}.nt-mis-c{gap:30px}.nt-mis-c img{max-width:86%}}

        /* ── CARDAPIO ── */
        .nt-tiras{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0 8px}
        .nt-tira{position:relative;aspect-ratio:4/5;overflow:hidden;border-radius:48px 14px 48px 14px;background:var(--nevoa);margin:0}
        .nt-tira img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 1.5s cubic-bezier(.2,.7,.2,1)}
        .nt-tira:hover img{transform:scale(1.06)}
        .nt-tira figcaption{position:absolute;left:0;right:0;bottom:0;padding:30px 40px 14px 16px;color:#fff;font-weight:500;font-size:13.5px;line-height:1.3;background:linear-gradient(180deg,transparent,rgba(28,28,28,.62))}
        @media(max-width:700px){.nt-tiras{grid-template-columns:repeat(2,1fr)}}
        .nt-barra{display:flex;flex-wrap:wrap;align-items:center;gap:14px 20px;margin-bottom:22px}
        .nt-barra small{font-size:13.5px;color:var(--texto)}
        .nt-barra small b{font-weight:600;color:var(--tinta)}
        .nt-chave{display:inline-flex;padding:4px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1px var(--fio),0 10px 20px -14px rgba(28,28,28,.4)}
        .nt .nt-chave button{padding:0 20px;min-height:42px;border-radius:999px;font-size:14px;font-weight:600;letter-spacing:-.02em;color:var(--texto);transition:background .3s ease,color .3s ease,box-shadow .3s ease}
        .nt .nt-chave button[aria-pressed="true"]{color:#fff;background:linear-gradient(180deg,color-mix(in srgb,var(--rosa-e) 88%,#fff) 0%,var(--rosa-e) 55%,var(--rosa-p) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.42),inset 0 -3px 5px -2px rgba(0,0,0,.2),0 1px 1.5px color-mix(in srgb,var(--rosa-e) 60%,transparent),0 6px 12px -6px var(--rosa-e);text-shadow:0 1px 1px rgba(90,30,45,.45)}
        .nt-busca{flex:1 1 220px;max-width:340px;min-height:50px;padding:0 20px;border-radius:999px;border:0;background:#fff;box-shadow:inset 0 0 0 1px var(--fio);font:inherit;font-weight:400;font-size:14.5px;color:var(--tinta)}
        .nt-busca::placeholder{color:#767676}
        .nt-abas{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--fio)}
        .nt-abas::-webkit-scrollbar{display:none}
        .nt .nt-abas button{flex:none;padding:14px 22px;min-height:50px;font-weight:600;font-size:13.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--texto);border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .3s ease,border-color .3s ease}
        .nt .nt-abas button[aria-selected="true"]{color:var(--rosa-e);border-color:var(--rosa)}
        .nt-intro{color:var(--texto);padding:18px 0 0;max-width:50em}
        .nt .nt-cool h2{margin-bottom:18px}
        .nt-cardapio{display:grid;gap:40px;align-items:start}
        @media(min-width:1040px){.nt-cardapio{grid-template-columns:minmax(0,1fr) 300px;gap:70px}}
        .nt-lado{display:grid;gap:18px}
        @media(min-width:1040px){.nt-lado{position:sticky;top:112px;margin-top:30px}}
        .nt .nt-lado .nt-b{width:100%}
        .nt .nt-lado-c{display:block;width:100%;text-align:left}
        .nt-lado-c img{display:block;width:100%;height:auto;border-radius:48px 14px 48px 14px;box-shadow:0 1px 2px rgba(28,28,28,.12),0 26px 40px -30px rgba(28,28,28,.6);transition:transform .5s cubic-bezier(.2,.7,.2,1)}
        .nt-lado-c:hover img{transform:translateY(-4px)}
        .nt-lado-c span{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-weight:600;font-size:14px;color:var(--cool)}
        .nt-grade{display:grid;gap:0}
        .nt-grupo{padding-top:34px}
        .nt .nt-grupo h3{font-size:14px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--rosa-e);padding-bottom:12px;border-bottom:1px solid var(--fio)}
        /* item: nome e preco na serifa, fio pontilhado no meio, descricao pequena embaixo (o desenho deles) */
        .nt-item{padding:15px 0 13px}
        .nt-item-l{display:flex;align-items:baseline;gap:12px}
        .nt-item-l>b{font-family:'ivyora-display','Fraunces',Georgia,serif;font-variation-settings:'SOFT' 0,'opsz' 144;font-weight:400;font-size:clamp(19px,2.05vw,25.6px);line-height:1.2;color:var(--tinta);min-width:0}
        .nt-fio{flex:1;min-width:18px;border-bottom:1px dotted #C9C9C9;transform:translateY(-5px)}
        .nt-item>i{display:block;font-style:normal;font-size:13px;line-height:1.75;color:var(--tinta);margin-top:6px;max-width:62em}
        .nt-preco{font-family:'ivyora-display','Fraunces',Georgia,serif;font-variation-settings:'SOFT' 0,'opsz' 144;font-weight:400;font-size:clamp(19px,2.05vw,25.6px);line-height:1.2;white-space:nowrap}
        .nt-item-l .nt-mais,.nt-item-l .nt-opcs{align-self:center}
        @media(max-width:560px){.nt-item-l{flex-wrap:wrap}.nt-item-l .nt-opcs{width:100%;justify-content:flex-start}}
        .nt .nt-mais{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--rosa-e);background:linear-gradient(180deg,#fff,#FBF8F6);
          box-shadow:inset 0 0 0 1px var(--rosa),inset 0 1.5px 0 #fff,inset 0 -3px 5px -2px color-mix(in srgb,var(--rosa) 26%,transparent),0 1px 1.5px color-mix(in srgb,var(--rosa-e) 34%,transparent),0 8px 14px -10px var(--rosa-e);transition:background .3s ease,color .3s ease,transform .3s ease,box-shadow .3s ease}
        .nt-mais:hover{transform:translateY(-1px)}
        .nt .nt-mais[aria-pressed="true"]{color:#fff;background:linear-gradient(180deg,color-mix(in srgb,var(--rosa-e) 88%,#fff) 0%,var(--rosa-e) 55%,var(--rosa-p) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.42),inset 0 -3px 5px -2px rgba(0,0,0,.2),0 1px 1.5px color-mix(in srgb,var(--rosa-e) 60%,transparent),0 8px 14px -8px var(--rosa-e)}
        .nt-mais svg{width:14px;height:14px;transition:transform .35s cubic-bezier(.2,1.3,.4,1)}
        .nt-mais[aria-pressed="true"] svg{transform:rotate(45deg)}
        .nt-opcs{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
        .nt-opc{display:flex;flex-direction:column;align-items:center;min-width:68px;min-height:44px;padding:5px 12px;border-radius:14px;background:#fff;line-height:1.2;box-shadow:inset 0 0 0 1px var(--fio),inset 0 2px 0 #fff;transition:box-shadow .25s ease,background .25s ease}
        .nt-opc span{font-size:11.5px;font-weight:400;color:var(--texto)}
        .nt-opc b{font-size:14.5px;font-weight:600}
        .nt-opc:hover{box-shadow:inset 0 0 0 1px var(--rosa)}
        .nt-opc[aria-pressed="true"]{background:linear-gradient(180deg,color-mix(in srgb,var(--rosa-e) 88%,#fff) 0%,var(--rosa-e) 55%,var(--rosa-p) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.42),inset 0 -3px 5px -2px rgba(0,0,0,.2),0 1px 1.5px color-mix(in srgb,var(--rosa-e) 60%,transparent),0 6px 12px -6px var(--rosa-e)}
        .nt-opc[aria-pressed="true"] span,.nt-opc[aria-pressed="true"] b{color:#fff;text-shadow:0 1px 1px rgba(90,30,45,.45)}
        .nt-vazio{padding:40px 0;color:var(--texto)}
        .nt-doca{position:sticky;bottom:12px;z-index:20;margin-top:34px;display:flex;flex-wrap:wrap;align-items:center;gap:12px 22px;padding:16px 22px;border-radius:22px;color:#EDEDED;
          background:linear-gradient(180deg,#3A3436 0%,#1C1C1C 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 0 0 1px rgba(195,123,137,.5),0 24px 44px -18px rgba(28,28,28,.8)}
        /* o assistente flutuante mora no canto de baixo: a doca fica ACIMA dele, nunca atras */
        @media(max-width:1599px){.nt-doca{bottom:84px}}
        .nt-doca-t{flex:1 1 240px;min-width:0}
        .nt-doca-t b{display:block;font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-variation-settings:'SOFT' 0,'opsz' 144;font-size:26px;color:#fff;line-height:1.1}
        .nt-doca-t>span{display:block;font-size:13px;opacity:.85;margin-top:4px;line-height:1.45}
        .nt .nt-doca button.nt-txt{font-size:13px;font-weight:600;color:#E9B7C1;border-bottom:1px solid currentColor;min-height:0;line-height:1.5}
        .nt-pe{margin-top:22px;font-size:13px;color:var(--texto);max-width:64em}

        /* ── COOLSCULPTING ── */
        .nt-cool{display:grid;gap:40px;align-items:center}
        @media(min-width:940px){.nt-cool{grid-template-columns:.9fr 1.1fr;gap:70px}}
        .nt-cool figure{margin:0;overflow:hidden;border-radius:64px 16px 64px 16px;box-shadow:0 1px 2px rgba(28,28,28,.12),0 34px 56px -34px rgba(0,60,110,.6)}
        .nt-cool img{display:block;width:100%;height:auto;transition:transform 1.5s cubic-bezier(.2,.7,.2,1)}
        .nt-cool figure:hover img{transform:scale(1.04)}
        .nt-cool .nt-rot{font-weight:600;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--texto)}
        .nt-cool h2{font-size:clamp(36px,4.4vw,56px);margin-top:8px}
        .nt-cool ul{list-style:none;margin:22px 0 0;padding:0;display:grid;gap:12px}
        .nt-cool li b{font-weight:600}
        .nt-acoes{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}

        /* ── REVIEWS ── */
        .nt-selos{display:flex;flex-wrap:wrap;align-items:center;gap:22px 40px;margin:0 0 38px}
        .nt-selos img{height:58px;width:auto;display:block;filter:grayscale(.15);opacity:.92;transition:transform .5s ease,opacity .3s ease}
        .nt-selos img:hover{transform:translateY(-3px);opacity:1}
        .nt-setas{display:none;gap:10px;margin-left:auto}
        @media(hover:hover) and (min-width:760px){.nt-setas{display:flex}}
        .nt .nt-setas button{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;color:var(--rosa-e);background:linear-gradient(180deg,#fff,#FBF8F6);
          box-shadow:inset 0 0 0 1px var(--rosa),inset 0 1.5px 0 #fff,inset 0 -3px 5px -2px color-mix(in srgb,var(--rosa) 26%,transparent),0 1px 1.5px color-mix(in srgb,var(--rosa-e) 34%,transparent),0 10px 18px -12px var(--rosa-e);transition:transform .3s cubic-bezier(.2,.7,.2,1)}
        .nt .nt-setas button:hover{transform:translateY(-1.5px)}
        .nt .nt-setas button:active{transform:translateY(.5px) scale(.97)}
        .nt-setas button:first-child svg{transform:rotate(180deg)}
        .nt-vozes{display:flex;gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;padding:6px max(22px,calc((100vw - 1320px)/2)) 26px;scrollbar-width:thin;scrollbar-color:var(--rosa) transparent}
        .nt-voz{position:relative;flex:none;width:min(84vw,400px);scroll-snap-align:center;margin:0;padding:30px 28px;border-radius:20px;background:linear-gradient(180deg,#fff,rgba(255,255,255,.82));
          box-shadow:inset 0 1px 0 #fff,inset 0 0 0 1px rgba(28,28,28,.06),0 1px 2px rgba(28,28,28,.08),0 26px 44px -30px rgba(28,28,28,.45);transition:transform .5s cubic-bezier(.2,.7,.2,1)}
        .nt-voz:hover{transform:translateY(-4px)}
        .nt-voz svg{width:18px;height:18px;color:var(--rosa);display:block;margin-bottom:14px}
        .nt-voz blockquote{margin:0;font-size:15px;line-height:1.7}
        .nt-voz figcaption{margin-top:16px;font-weight:600;font-size:14px}
        .nt-nums{display:flex;flex-wrap:wrap;gap:12px 44px;margin-top:8px}
        .nt-nums a{display:flex;align-items:baseline;gap:10px}
        .nt-nums b{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-variation-settings:'SOFT' 0,'opsz' 144;font-size:44px;line-height:1}
        .nt-nums span{font-size:13.5px;color:var(--texto)}
        .nt-nota{margin-top:10px;font-size:12.5px;color:var(--texto)}

        /* ── SPECIALS + GIFT ── */
        .nt-esp{display:grid;gap:40px;align-items:start}
        @media(min-width:940px){.nt-esp{grid-template-columns:.8fr 1.2fr;gap:70px}}
        .nt-cartaz{margin:0;border-radius:64px 16px 64px 16px;overflow:hidden;box-shadow:0 1px 2px rgba(28,28,28,.12),0 40px 60px -36px rgba(120,90,40,.6);transition:transform .7s cubic-bezier(.2,.7,.2,1)}
        .nt-cartaz:hover{transform:translateY(-6px) rotate(-.4deg)}
        .nt-cartaz img{display:block;width:100%;height:auto}
        .nt-pac{display:flex;gap:16px;justify-content:space-between;align-items:baseline;padding:16px 0;border-top:1px solid var(--fio)}
        .nt-pac-u{border-bottom:1px solid var(--fio)}
        .nt-pac b{display:block;font-weight:600;font-size:16px}
        .nt-pac span{display:block;font-size:13.5px;color:var(--texto);line-height:1.5}
        .nt-pac strong{font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-variation-settings:'SOFT' 0,'opsz' 144;font-size:30px;white-space:nowrap;color:var(--ouro-e)}
        .nt-gift{position:relative;overflow:hidden;border-radius:84px 22px 84px 22px;min-height:440px;display:flex;align-items:flex-end}
        .nt-gift>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 2s cubic-bezier(.2,.7,.2,1)}
        .nt-gift:hover>img{transform:scale(1.04)}
        .nt-gift::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(28,28,28,.66) 0%,rgba(28,28,28,.34) 50%,rgba(28,28,28,0) 80%)}
        .nt-gift-t{position:relative;z-index:2;padding:clamp(28px,5vw,64px);max-width:620px}
        .nt .nt-gift h2{color:#fff}
        .nt .nt-gift p{margin-top:14px;color:#fff;font-weight:400}

        /* ── ABOUT ── */
        .nt-dois{display:grid;gap:40px}
        @media(min-width:940px){.nt-dois{grid-template-columns:1fr 1fr;gap:70px}}
        .nt-vals{display:grid;gap:30px 40px;margin-top:54px}
        @media(min-width:700px){.nt-vals{grid-template-columns:repeat(2,1fr)}}
        @media(min-width:1100px){.nt-vals{grid-template-columns:repeat(4,1fr)}}
        .nt-val img{height:54px;width:auto;display:block;margin-bottom:16px;transition:transform .6s cubic-bezier(.2,1.3,.4,1)}
        .nt-val:hover img{transform:translateY(-4px) scale(1.06)}
        .nt .nt-val h3{font-size:18px}
        .nt-val p{margin-top:8px;font-size:14px;color:var(--texto)}
        .nt-pars{display:grid;gap:22px;margin-top:30px}
        @media(min-width:940px){.nt-pars-2{grid-template-columns:1fr 1fr;gap:22px 70px}}
        .nt-hist{display:grid;gap:34px;align-items:center;margin-top:clamp(54px,7vw,90px)}
        @media(min-width:860px){.nt-hist{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:70px}}
        .nt .nt-hist-f{position:relative;margin:0;max-width:460px;aspect-ratio:1/1;overflow:hidden;border-radius:84px 22px 84px 22px;background:var(--creme);box-shadow:0 1px 2px rgba(28,28,28,.12),0 34px 56px -34px rgba(28,28,28,.6)}
        .nt-hist-f img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 1.4s cubic-bezier(.2,.6,.2,1)}
        .nt-hist-f:hover img{transform:scale(1.04)}
        .nt-hist-f:hover .nt-selo svg{transform:rotate(72deg)}
        .nt-hist-s{font-weight:600;font-size:14px;color:var(--rosa-e)}
        .nt .nt-hist-t{font-size:clamp(34px,4vw,52px);margin-top:6px}
        .nt .nt-hist blockquote{margin:22px 0;padding-left:20px;border-left:2px solid var(--rosa);font-size:clamp(24px,2.6vw,32px);font-style:italic}
        .nt-hist cite{display:block;margin-top:8px;font-family:'sofia-pro','Poppins',sans-serif;font-style:normal;font-weight:400;font-size:13px;letter-spacing:0;color:var(--texto)}
        .nt-hist p+p{margin-top:14px}
        .nt-time{list-style:none;margin:30px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:32px 22px}
        .nt-time li{font-size:14px;line-height:1.45}
        .nt-time-f{aspect-ratio:1/1;overflow:hidden;border-radius:40px 12px 40px 12px;background:var(--creme);display:grid;place-items:center;color:var(--rosa);margin-bottom:14px;box-shadow:0 1px 2px rgba(28,28,28,.12),0 22px 34px -26px rgba(28,28,28,.6);transition:transform .5s cubic-bezier(.2,.7,.2,1),box-shadow .5s ease}
        .nt-time-f img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 1.2s cubic-bezier(.2,.6,.2,1)}
        .nt-time-f svg{width:34%;height:auto;opacity:.75}
        .nt-time li:hover .nt-time-f{transform:translateY(-4px);box-shadow:0 2px 3px rgba(28,28,28,.12),0 30px 40px -26px rgba(28,28,28,.6)}
        .nt-time li:hover .nt-time-f img{transform:scale(1.05)}
        .nt-time b{display:block;font-weight:600;font-size:16px;color:var(--tinta)}
        .nt-time span{color:var(--texto);font-size:13px}

        /* ── mapa das unidades ── */
        .nt-mapa{display:grid;gap:26px;margin-top:clamp(44px,6vw,72px)}
        @media(min-width:980px){.nt-mapa{grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:44px;align-items:center}}
        .nt-mapa-q{position:relative;overflow:hidden;border-radius:64px 16px 64px 16px;background:#ECEEEF;box-shadow:inset 0 0 0 1px var(--fio),0 1px 2px rgba(28,28,28,.1),0 30px 50px -36px rgba(28,28,28,.55)}
        .nt-mapa-p{position:relative;aspect-ratio:950/520}
        .nt-mapa-p svg{position:absolute;inset:0;width:100%;height:100%;display:block}
        .nt-mapa-t{fill:#fff;stroke:rgba(28,28,28,.16);stroke-width:1;vector-effect:non-scaling-stroke}
        .nt-mapa-v{fill:var(--creme)}
        .nt-mapa-l{fill:none;stroke:rgba(28,28,28,.38);stroke-width:1.5;stroke-dasharray:5 4;vector-effect:non-scaling-stroke}
        .nt-mapa-n{position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#6B6B6B;white-space:nowrap;pointer-events:none}
        .nt-mapa-m{font-size:10px;letter-spacing:.1em}
        .nt .nt-pino{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;display:grid;place-items:center;z-index:2}
        .nt-pino i{width:14px;height:14px;border-radius:50%;background:var(--rosa-e);box-shadow:0 0 0 3px #fff,0 0 0 4px rgba(28,28,28,.14),0 6px 10px -3px rgba(28,28,28,.55);transition:transform .35s cubic-bezier(.2,1.3,.4,1),background .3s ease}
        .nt-pino span{position:absolute;left:50%;bottom:calc(50% + 15px);transform:translateX(-50%);padding:5px 12px;border-radius:999px;background:#fff;font-size:12px;font-weight:600;line-height:1.3;color:var(--tinta);white-space:nowrap;box-shadow:inset 0 0 0 1px var(--fio),0 1px 1.5px rgba(28,28,28,.14),0 10px 16px -10px rgba(28,28,28,.5);transition:background .3s ease,color .3s ease}
        .nt-pino-b span{bottom:auto;top:calc(50% + 15px)}
        .nt-pino[aria-pressed="true"]{z-index:3}
        .nt-pino[aria-pressed="true"] i{transform:scale(1.3);background:var(--rosa-p)}
        .nt-pino[aria-pressed="true"] span{background:var(--rosa-p);color:#fff}
        .nt-mapa-u{list-style:none;margin:0;padding:0}
        .nt-mapa-u li{padding:16px 0 16px 16px;border-top:1px solid var(--fio);border-left:2px solid transparent;font-size:14px;line-height:1.5;transition:border-color .3s ease,background .3s ease}
        .nt-mapa-u li:last-child{border-bottom:1px solid var(--fio)}
        .nt-mapa-u li[data-on="1"]{border-left-color:var(--rosa);background:var(--nevoa)}
        .nt-mapa-u b{display:block;font-weight:600;font-size:16px}
        .nt-mapa-u .nt-est{display:flex;margin:4px 0 2px;white-space:normal}
        .nt-mapa-u li>span{display:block;color:var(--texto)}
        .nt-mapa-u .nt-lk{margin-top:8px;min-height:32px}
        @media(max-width:700px){.nt-mapa-q{border-radius:48px 14px 48px 14px}.nt-mapa-g{display:none}.nt-mapa-n{font-size:9px;letter-spacing:.1em}.nt-mapa-m{font-size:8px}
          .nt-pino i{width:10px;height:10px;box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(28,28,28,.14),0 4px 8px -3px rgba(28,28,28,.55)}
          .nt-pino span{font-size:11px;padding:3px 9px;bottom:calc(50% + 10px)}.nt-pino-b span{bottom:auto;top:calc(50% + 10px)}}

        /* ── o plano para a dona (?plano=1) ── */
        .nt-plano{background:var(--creme)}
        .nt-plano-g{display:grid;gap:44px}
        @media(min-width:940px){.nt-plano-g{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:70px}}
        .nt-plano h3{display:flex;align-items:center;gap:12px}
        .nt-plano h3 i{font-style:normal;font-weight:600;font-size:13px;min-width:26px;height:26px;padding:0 8px;border-radius:999px;display:inline-grid;place-items:center;background:var(--rosa-p);color:#fff}
        .nt-plano-f,.nt-plano-l{list-style:none;margin:22px 0 0;padding:0;display:grid;gap:12px}
        .nt-plano-f li{display:grid;grid-template-columns:38px 1fr;gap:16px;padding:20px 22px;border-radius:28px 10px 28px 10px;background:#fff;box-shadow:inset 0 0 0 1px var(--fio),inset 0 1.5px 0 #fff,0 1px 2px rgba(28,28,28,.1),0 22px 34px -28px rgba(28,28,28,.5)}
        .nt-plano-f em{font-style:normal;font-family:'ivyora-display','Fraunces',Georgia,serif;font-weight:300;font-size:34px;line-height:1;color:var(--rosa-e)}
        .nt-plano b{display:block;font-weight:600;font-size:16px;color:var(--tinta)}
        .nt-plano li p{font-size:14px;line-height:1.6;color:var(--texto);margin-top:4px}
        .nt-plano li p.nt-plano-p{color:var(--tinta);margin-top:10px;padding-top:10px;border-top:1px solid var(--fio)}
        .nt-plano-p strong{font-weight:600;color:var(--rosa-p)}
        .nt-plano-l li{display:grid;grid-template-columns:20px 1fr;gap:14px;padding:14px 0;border-top:1px solid rgba(28,28,28,.16)}
        .nt-plano-l svg{width:18px;height:18px;margin-top:4px;color:var(--rosa-e)}
        .nt-plano-x svg{color:var(--ouro-e)}
        .nt .nt-plano-c{position:fixed;left:16px;bottom:112px;z-index:60;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-radius:999px;background:var(--tinta);color:#fff;font-size:13px;font-weight:600;
          box-shadow:inset 0 1.5px 0 rgba(255,255,255,.22),inset 0 -3px 5px -2px rgba(0,0,0,.5),0 1px 2px rgba(28,28,28,.3),0 16px 26px -14px rgba(28,28,28,.7);transition:transform .3s cubic-bezier(.2,.7,.2,1)}
        .nt .nt-plano-c:hover{transform:translateY(-2px)}
        .nt-par{display:grid;grid-template-columns:120px 1fr;gap:20px;align-items:start}
        .nt-par img{width:120px;height:150px;object-fit:cover;border-radius:36px 10px 36px 10px;display:block;box-shadow:0 20px 30px -22px rgba(28,28,28,.6)}
        .nt-par small{display:block;color:var(--texto);font-size:13px}
        .nt-par p{font-size:14px;margin-top:6px;color:var(--texto)}
        .nt-par .nt-lk{margin-top:8px}

        /* ── PERGUNTAS ── */
        .nt-perg{border-top:1px solid var(--fio)}
        .nt-perg:last-child{border-bottom:1px solid var(--fio)}
        .nt-perg button{display:flex;justify-content:space-between;align-items:center;gap:16px;width:100%;text-align:left;padding:20px 0;min-height:64px;font-weight:600;font-size:16px;line-height:1.35}
        .nt-perg button svg{flex:none;width:14px;height:14px;color:var(--rosa-e);transition:transform .4s cubic-bezier(.2,.7,.2,1)}
        .nt-perg button[aria-expanded="true"] svg{transform:rotate(45deg)}
        .nt-resp{display:grid;grid-template-rows:0fr;transition:grid-template-rows .5s cubic-bezier(.2,.7,.2,1)}
        .nt-resp[data-on="1"]{grid-template-rows:1fr}
        .nt-resp>div{overflow:hidden}
        .nt-resp p{padding:0 0 22px;color:var(--texto);max-width:46em}

        /* ── CONTATO + RODAPE ── */
        .nt-fala .nt-h2{margin-bottom:clamp(34px,5vw,60px)}
        .nt .nt-fala .nt-h2 a{transition:color .3s ease}
        .nt .nt-fala .nt-h2 a:hover{color:var(--rosa-e)}
        .nt-caixa{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:30px 50px;padding:clamp(40px,6vw,76px) clamp(26px,5vw,72px);background:var(--nevoa);border-radius:64px 16px 64px 16px}
        .nt .nt-caixa h3{font-weight:300;font-size:clamp(30px,3.9vw,50px);line-height:1.15;letter-spacing:-.012em;max-width:11.5em}
        .nt-caixa .nt-acoes{margin-top:0}
        /* rodape BRANCO, como o deles */
        .nt-fim{background:#fff;color:var(--texto);padding:clamp(54px,7vw,84px) 0 30px;font-size:14px}
        .nt-fim-g{display:grid;gap:34px}
        @media(min-width:860px){.nt-fim-g{grid-template-columns:1.1fr repeat(3,1fr)}}
        .nt .nt-fim h2{font-family:'sofia-pro','Poppins',sans-serif;font-weight:700;font-size:18px;letter-spacing:0;text-transform:uppercase;color:var(--tinta);margin-bottom:18px;font-variation-settings:normal}
        .nt-fim dl{margin:0;display:grid;gap:12px}
        .nt-fim dt{font-weight:600;color:var(--tinta);line-height:1.4}
        .nt-fim dd{margin:0;line-height:1.6}
        .nt .nt-fim a:hover{color:var(--rosa-e)}
        .nt-fim-m img{height:38px;width:auto}
        .nt-fim-m p{margin-top:16px;max-width:26em}
        .nt-fim-m ul{list-style:none;display:flex;gap:18px;margin:18px 0 0;padding:0;font-weight:500;color:var(--tinta)}
        .nt-base{margin-top:46px;padding:22px 92px 0 0;border-top:1px solid var(--fio);display:flex;flex-wrap:wrap;gap:8px 28px;justify-content:space-between;font-size:12.5px}
        .nt-aviso{margin-top:14px;font-size:12px;color:#6B6B6B;max-width:74em}

        @media(prefers-reduced-motion:reduce){.nt *{transition-duration:.01ms !important;animation-duration:.01ms !important}}
      `}</style>

      <a href="#menu" className="nt-pular">Skip to services + prices</a>

      {/* ── PROMOÇÃO DO MÊS (some sozinha quando o mês vira) ── */}
      {promo && (
        <div className="nt-faixa">
          <a href="#specials"><b>{PROMO.titulo}</b><span>{PROMO.onde} · four packages from {PROMO.pacotes[0][2]}</span><u>See the specials <Seta /></u></a>
        </div>
      )}

      {/* ── TOPO ── */}
      <div className={`nt-topo ${rolou ? "nt-topo-on" : ""}`}>
        <div className="nt-in">
          <a className="nt-logo" href="#top" aria-label="Natura Spa, back to top"><img src={`${B}/logo.svg`} alt="Natura Spa" width="130" height="30" /></a>
          <nav className="nt-nav" aria-label="Sections">
            {NAV.map((n) => (n.sub ? (
              <div className={`nt-nav-i ${subOff ? "nt-nav-off" : ""}`} key={n.nome} onMouseLeave={() => setSubOff(false)}>
                <button type="button" aria-haspopup="true">{n.nome}<svg viewBox="0 0 10 6" width="9" height="6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg></button>
                <div className="nt-sub">
                  <div className="nt-in">
                    {n.sub.map(([rot, l, alvo, foto, link]) => {
                      const dentro = <><span className="nt-sub-f"><img src={`${B}/nav/${foto}.webp`} alt="" width="720" height="480" loading="lazy" /></span><span className="nt-sub-n">{rot}</span></>;
                      return link
                        ? <a key={rot} href={link} target="_blank" rel="noopener" onClick={() => setSubOff(true)}>{dentro}</a>
                        : <button key={rot} type="button" onClick={(e) => { e.currentTarget.blur(); setSubOff(true); irPara(l, alvo); }}>{dentro}</button>;
                    })}
                  </div>
                </div>
              </div>
            ) : <a key={n.id} href={`#${n.id}`}>{n.nome}</a>))}
          </nav>
          <div className="nt-bk" ref={menuBook}>
            <Botao as="button" type="button" aria-expanded={book} aria-haspopup="true" onClick={() => setBook((b) => !b)}>Book Now</Botao>
            {book && (
              <div className="nt-pop" role="menu" aria-label="Choose a location to book">
                {ORDEM.map((id) => { const x = UNIDADES[id]; const s = statusDe(x, t); return (
                  <a key={id} role="menuitem" href={reservarDe(x)} target="_blank" rel="noopener" onClick={() => setBook(false)}>
                    <span><b>Book at {x.curto}</b><small>{x.rua}</small></span>
                    <span className="nt-est nt-num"><u className={s.aberto === false ? "nt-fech" : ""} />{s.aberto ? `Open · until ${s.hora}` : s.aberto === false ? `Opens ${s.quando === "today" ? "" : "tomorrow "}${s.hora}` : "Book online"}</span>
                  </a>
                ); })}
              </div>
            )}
          </div>
          <button type="button" className="nt-ham" aria-expanded={menu} aria-controls="nt-gaveta" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => { setMenu((m) => !m); setBook(false); }}>
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">{menu ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}</svg>
          </button>
        </div>
        {menu && (
          <nav className="nt-gaveta" id="nt-gaveta" aria-label="Menu">
            <div className="nt-gav-in">
              {NAV.map((n) => (n.sub ? (
                <div className="nt-gav-g" key={n.nome}>
                  <p>{n.nome}</p>
                  {n.sub.map(([rot, l, alvo, , link]) => (link
                    ? <a key={rot} href={link} target="_blank" rel="noopener" onClick={() => setMenu(false)}>{rot}<Seta /></a>
                    : <button key={rot} type="button" onClick={() => irPara(l, alvo)}>{rot}<Seta /></button>))}
                </div>
              ) : <a key={n.id} href={`#${n.id}`} onClick={() => setMenu(false)}>{n.nome}<Seta /></a>))}
              <div className="nt-gav-t">
                {ORDEM.map((id) => { const x = UNIDADES[id]; const sx = statusDe(x, t); return (
                  <a key={id} href={`tel:${x.tel}`} onClick={() => setMenu(false)}>
                    <span><b>{x.curto}</b><small className="nt-num">{x.telFmt}</small></span>
                    <span className="nt-est nt-num"><u className={sx.aberto === false ? "nt-fech" : ""} />{sx.aberto ? `Open · until ${sx.hora}` : sx.aberto === false ? `Opens ${sx.quando === "today" ? "" : "tomorrow "}${sx.hora}` : "Call"}</span>
                  </a>
                ); })}
              </div>
            </div>
          </nav>
        )}
      </div>

      {/* ── HERO ── */}
      <section className="nt-hero" ref={hero} id="top" aria-label="Natura Spa + Salon" hidden={pg !== "home"}>
        <div className="nt-palco">
          <div className="nt-palco-f">
            <div className="nt-midia" ref={midia}>
              <img src={frenteMed ? `${B}/med-1.webp` : `${B}/hero.webp`} alt={frenteMed ? "The lounge at Natura Med Spa on the Upper East Side." : "A guest receiving a facial massage at Natura Spa."} width="1920" height="1281" fetchPriority="high" />
              <video ref={video} muted loop playsInline preload="metadata" aria-hidden="true" />
            </div>
            <div className="nt-veu" />
            <button type="button" className="nt-pausa" aria-pressed={!filme} aria-label={filme ? "Pause the background film" : "Play the background film"} onClick={() => { const v = video.current; if (!v) return; if (filme) v.pause(); else v.play?.().catch(() => {}); setFilme(!filme); }}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">{filme ? <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /> : <path d="M4.5 2.5l8.5 5.5-8.5 5.5z" />}</svg>
            </button>
            <div className="nt-tit">
              {frenteMed
                ? <><p>Natura Med Spa · Upper East Side</p><h1><span>Botox.</span> <span>Fillers.</span> <span>Confidence.</span></h1></>
                : <><p>Brazilian Hair Salon + Med Spa</p><h1><span>Cut.</span> <span>Color.</span> <span>Confidence.</span></h1></>}
            </div>
          </div>
          <div className="nt-bem">
            {frenteMed ? (() => { const m = UNIDADES.med; const sm = statusDe(m, t); return (<>
              <h2>Welcome to Natura Med Spa</h2>
              <p>Botox, fillers, Kybella, PRP and CoolSculpting on the Upper East Side — every treatment starts with a free consultation, and every price is in the open.</p>
              <div className="nt-bem-l">
                <a className="nt-lk" href="#medspa"><Seta baixo /> Treatments and prices</a>
                <a className="nt-lk nt-lk-rosa" href={reservarDe(m)} target={agendaGuileo() ? undefined : "_blank"} rel="noopener">Book a free consultation <Seta /></a>
              </div>
              <Botao as="button" type="button" tom="petrol" cheio className="nt-falar" onClick={() => falar(m.tel)}><span className="nt-falar-ic" aria-hidden="true"><Flor /><u /></span>Talk to us now</Botao>
              <p className="nt-est"><u className={sm.aberto === false ? "nt-fech" : ""} /><span className="nt-num">{m.curto} · {sm.texto}</span></p>
            </>); })() : (<>
              <h2>Welcome to Natura Spa + Salon</h2>
              <p>Looking for the best hair salon or med spa in New York? Natura Spa delivers luxurious treatments in Astoria and the Upper East Side—come in and leave glowing.</p>
              <div className="nt-bem-l">
                <a className="nt-lk" href="#locations"><Seta baixo /> Our locations</a>
                <a className="nt-lk nt-lk-rosa" href="#specials">Our specials <Seta /></a>
              </div>
              <Botao as="button" type="button" tom="petrol" cheio className="nt-falar" onClick={() => falar(u.tel)}><span className="nt-falar-ic" aria-hidden="true"><Flor /><u /></span>Talk to us now</Botao>
              <p className="nt-est"><u className={st.aberto === false ? "nt-fech" : ""} /><span className="nt-num">{u.curto} · {st.texto}</span></p>
            </>)}
          </div>
        </div>
      </section>

      {/* ── "HOW CAN WE MAKE YOUR DAY EVEN BETTER?" (título do Luis) — entrada por objetivo (2026-10-05). Acréscimo: nada do original sai.
           Serviços e preços vêm do MENU (naturaObjetivos.js + teste); o Med Spa leva à consulta gratuita. ── */}
      {(() => {
        const ob = OBJETIVOS.find((o) => o.id === obj) || OBJETIVOS[0];
        const lugar = unidadeDoObjetivo(ob, MENU, loc);
        const lista = servicosDoObjetivo(ob, MENU, lugar);
        const outro = lugar === "ues" ? "astoria" : "ues";
        return (
          <section className="nt-sec nt-obj" id="goals" hidden={pg !== "home"}>
            <div className="nt-in">
              <header className="nt-cab nt-rv"><Flor className="nt-flor" /><h2 className="nt-h2">How can we make your day even better?</h2>
                <p className="nt-obj-l">Choose how you want to feel — we’ll show you where to start.</p></header>
              <div className="nt-obj-c nt-rv" role="group" aria-label="Choose what you need">
                {OBJETIVOS.map((o) => <button key={o.id} type="button" aria-pressed={obj === o.id} onClick={() => setObj(o.id)}>{o.nome}</button>)}
              </div>
              <div className="nt-obj-p nt-rv">
                <figure><img key={ob.foto} src={`${B}/${ob.foto}.webp`} alt={ob.alt} width="1200" height="900" loading="lazy" /></figure>
                <div className="nt-obj-t" aria-live="polite">
                  <h3>{ob.nome}</h3>
                  <p>{ob.sente}</p>
                  {ob.medspa ? (
                    <>
                      <ul className="nt-obj-s nt-obj-m">
                        <li><span>Free consultation with the provider</span></li>
                        <li><span>CoolSculpting Elite · neurotoxins · fillers</span></li>
                        <li><span>{UNIDADES.med.rua}, Upper East Side</span></li>
                      </ul>
                      <div className="nt-obj-a">
                        <Botao tom="cool" cheio href={`tel:${UNIDADES.med.tel}`} forte="Book a free consultation" fino={`Call ${UNIDADES.med.telFmt}`} />
                        <a className="nt-lk" href="#medspa">About CoolSculpting <Seta /></a>
                      </div>
                    </>
                  ) : (
                    <>
                      <ul className="nt-obj-s">
                        {lista.map((x) => <li key={x.nome}><span>{x.nome}{x.so ? <em> · {x.so} only</em> : null}</span><i aria-hidden="true" /><b className="nt-num">from {usd(x.desde)}</b></li>)}
                      </ul>
                      <p className="nt-obj-u">Prices at {UNIDADES[lugar].curto} · <button type="button" onClick={() => trocar(outro)}>see {UNIDADES[outro].curto}</button></p>
                      <div className="nt-obj-a">
                        <Botao as="button" type="button" cheio forte="See all prices + book" onClick={() => irPara(lugar, ob.cat)} />
                        <button type="button" className="nt-lk" onClick={() => falar(UNIDADES[lugar].tel)}>Not sure? Ask us <Seta /></button>
                      </div>
                      {ob.parceiro != null && PARCEIROS[ob.parceiro] ? <p className="nt-obj-x">Also good for tension: <a href={PARCEIROS[ob.parceiro].link} target="_blank" rel="noopener">acupuncture with {PARCEIROS[ob.parceiro].nome} <Seta /></a></p> : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── LOCATIONS ── */}
      <section className="nt-sec" id="locations" hidden={pg !== "home"}>
        <div className="nt-in">
          <header className="nt-cab nt-rv"><Flor className="nt-flor" /><h2 className="nt-h2">Locations</h2></header>
          <div className="nt-locs">
            {ORDEM.map((id, k) => {
              const x = UNIDADES[id]; const s = statusDe(x, t); const on = detalhe === id;
              return (
                <article key={id} className="nt-loc nt-rv">
                  <Fotos fotos={x.fotos} atraso={k * 1700} />
                  <h3>{x.nome}</h3>
                  <p className="nt-est"><u className={s.aberto === false ? "nt-fech" : ""} /><span className="nt-num">{s.aberto ? `Open now · until ${s.hora}` : s.aberto === false ? `Closed now · ${s.texto}` : s.texto}</span></p>
                  <p>{x.texto}</p>
                  <div className="nt-loc-b">
                    <Botao href={reservarDe(x)} target="_blank" rel="noopener">Book Appointment</Botao>
                    <Botao as="button" type="button" tom="ouro" aria-expanded={on} aria-controls={`nt-det-${id}`} onClick={() => setDetalhe(on ? "" : id)}>{on ? "Close" : "Hours + Directions"}</Botao>
                  </div>
                  <div className="nt-det" id={`nt-det-${id}`} data-on={on ? "1" : "0"}>
                    <div>
                      <dl>
                        <dt>Monday – Saturday</dt><dd className="nt-num">{horaCurta(x.semana[0])} to {horaCurta(x.semana[1])}</dd>
                        <dt>Sunday</dt><dd className="nt-num">{horaCurta(x.dom[0])} to {horaCurta(x.dom[1])}</dd>
                        <dt>Contact</dt><dd className="nt-num"><a href={`tel:${x.tel}`}>{x.telFmt}</a>{x.outros.map((o) => <span key={o}><br />{o}</span>)}</dd>
                        <dt>Address</dt><dd>{x.rua}<br />{x.cidade}</dd>
                      </dl>
                      <div className="nt-det-l">
                        <a className="nt-lk nt-lk-rosa" href={x.mapa} target="_blank" rel="noopener" tabIndex={on ? undefined : -1}>Get Directions <Seta /></a>
                        {id !== "med" && <a className="nt-lk" href="#menu" onClick={() => trocar(id)} tabIndex={on ? undefined : -1}>See {x.curto} prices <Seta /></a>}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="nt-mapa nt-rv">
            <div className="nt-mapa-q" role="group" aria-label="Map of the three Natura Spa locations">
              <div className="nt-mapa-p">
                <svg viewBox={`0 0 ${MAPA_W} ${MAPA_H}`} aria-hidden="true" focusable="false">
                  {MAPA_TERRA.map((d) => <path key={d.length} className="nt-mapa-t" d={d} />)}
                  <polygon className="nt-mapa-v" points={MAPA_PARQUE} />
                  <polyline className="nt-mapa-l" points={MAPA_PONTE} />
                </svg>
                <span className="nt-mapa-n" style={{ left: "9%", top: "80%" }}>Manhattan</span>
                <span className="nt-mapa-n" style={{ left: "70%", top: "84%" }}>Queens</span>
                <span className="nt-mapa-n nt-mapa-m" style={{ left: "17.5%", top: "20%", transform: "translate(-50%,-50%) rotate(-61deg)" }}>Central Park</span>
                <span className="nt-mapa-n nt-mapa-m" style={{ left: "45.5%", top: "33%", transform: "translate(-50%,-50%) rotate(-56deg)" }}>East River</span>
                <span className="nt-mapa-n nt-mapa-m nt-mapa-g" style={{ left: "42%", top: "77%", transform: "translate(-50%,-50%) rotate(28.6deg)" }}>Queensboro Bridge</span>
                {ORDEM.map((id) => {
                  const x = UNIDADES[id]; const [px, py] = MAPA_PINOS[id];
                  return (
                    <button key={id} type="button" className={`nt-pino ${id === "med" ? "nt-pino-b" : ""}`} style={{ left: `${px}%`, top: `${py}%` }}
                      aria-pressed={mira === id} onClick={() => setMira(mira === id ? "" : id)} onMouseEnter={() => setMira(id)}>
                      <i aria-hidden="true" /><span>{id === "med" ? "Med Spa UES" : id === "ues" ? "Salon UES" : x.curto}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <ul className="nt-mapa-u">
              {ORDEM.map((id) => {
                const x = UNIDADES[id]; const s = statusDe(x, t);
                return (
                  <li key={id} data-on={mira === id ? "1" : "0"} onMouseEnter={() => setMira(id)}>
                    <b>{x.rodape}</b>
                    <p className="nt-est"><u className={s.aberto === false ? "nt-fech" : ""} /><span className="nt-num">{s.aberto ? `Open now · until ${s.hora}` : s.aberto === false ? `Closed now · ${s.texto}` : s.texto}</span></p>
                    <span>{x.rua}, {x.cidade}</span>
                    <a className="nt-lk nt-lk-rosa" href={x.mapa} target="_blank" rel="noopener" aria-label={`Get directions to ${x.rodape}`}>Get Directions <Seta /></a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ── MISSÃO + PARCEIROS ── */}
      <section className="nt-sec nt-nevoa nt-missao" hidden={pg !== "home"}>
        <div className="nt-aura" aria-hidden="true"><i /><i /><i /></div>
        <div className="nt-in nt-mis">
          <div className="nt-rv">
            <p className="nt-serifa nt-mis-r">Our Mission</p>
            <h2>Our goal is to bring top-quality wellness within everyone’s reach, making self-care simple, affordable, and enjoyable.</h2>
            <Botao tom="ouro" cheio href="#about">About us</Botao>
          </div>
          <div className="nt-mis-l nt-rv">
            <div className="nt-mis-c">
              <a href="#top" aria-label="Natura Spa"><img src={`${B}/logo-home-hero.png`} alt="The Natura Spa emblem." width="180" height="203" loading="lazy" style={{ width: 180 }} /></a>
              <a href={REDES.laser} target="_blank" rel="noopener"><img src={`${B}/natura-laser-astoria.png`} alt="Natura Laser Skincare, Astoria." width="180" height="164" loading="lazy" style={{ width: 180 }} /></a>
            </div>
            <div className="nt-mis-c">
              <p className="nt-serifa nt-mis-p">Our Trusted Partners</p>
              <a href={PARCEIROS[0].link} target="_blank" rel="noopener"><img src={`${B}/masterpiece-black.png`} alt="Masterpiece." width="200" height="50" loading="lazy" style={{ width: 200 }} /><small>Lashes</small></a>
              <a href={PARCEIROS[1].link} target="_blank" rel="noopener"><img src={`${B}/logo-circle-from-enginberi.png`} alt="Dr. Jocelynn Cheng." width="150" height="150" loading="lazy" style={{ width: 150 }} /><small>Acupuncture</small></a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CARDÁPIO ── */}
      <section className="nt-sec" id="menu" hidden={pg !== "services"}>
        <div className="nt-in">
          <header className="nt-cab nt-rv">
            <Flor className="nt-flor" />
            <h2 className="nt-h2">Services + Prices</h2>
            <p className="nt-lead">Every service, priced by location. Add what you want and see your total before you book.</p>
          </header>
          <div className="nt-barra nt-rv">
            <div className="nt-chave" role="group" aria-label="Location for prices">
              <button type="button" aria-pressed={loc === "astoria"} onClick={() => trocar("astoria")}>Astoria</button>
              <button type="button" aria-pressed={loc === "ues"} onClick={() => trocar("ues")}>Upper East Side</button>
            </div>
            <input className="nt-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Search: balayage, keratin, facial…" aria-label="Search the menu" />
            <small>Prices for <b>{u.curto}</b></small>
          </div>

          {!termo && (
            <>
              <div className="nt-abas" role="tablist" aria-label="Menu categories">
                {MENU.map((c) => <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}>{c.nome}</button>)}
              </div>
              <p className="nt-intro">{categoria.intro}</p>
              <div className="nt-tiras">
                {categoria.fotos.map(([f, leg]) => (
                  <figure className="nt-tira" key={f}><img src={`${B}/${f}.webp`} alt={leg} loading="lazy" width="1100" height="1375" /><Selo /><figcaption>{leg}</figcaption></figure>
                ))}
              </div>
            </>
          )}

          {grupos.length === 0
            ? <p className="nt-vazio">Nothing on the {u.curto} menu matches “{busca}”. Try the other location, or call {u.telFmt}.</p>
            : (
              <div className="nt-cardapio">
              <div className="nt-grade">
                {grupos.map((g) => (
                  <div className="nt-grupo" key={g.rotulo || g.nome}>
                    <h3>{g.rotulo || g.nome}</h3>
                    {g.itens.map((i) => {
                      const p = i[col]; const k = chave(g.nome, i[0]); const nota = notaDe(i[3], loc);
                      return (
                        <div className="nt-item" key={i[0]}>
                          <div className="nt-item-l">
                          <b>{i[0]}</b><span className="nt-fio" aria-hidden="true" />
                          {ehOpcoes(p)
                            ? (
                              <div className="nt-opcs">
                                {Object.entries(p).map(([rot, v]) => (
                                  <button key={rot} type="button" className="nt-opc" aria-pressed={noRitual(k, rot)} onClick={() => alternar(g.nome, i[0], rot)} aria-label={`${i[0]}, ${rot}, ${usd(v)}`}>
                                    <span>{rot}</span><b className="nt-num">{usd(v)}</b>
                                  </button>
                                ))}
                              </div>
                            )
                            : (
                              <>
                                <span className="nt-preco nt-num">{faixa(p)}</span>
                                <button type="button" className="nt-mais" aria-pressed={noRitual(k, "")} onClick={() => alternar(g.nome, i[0])} aria-label={`${noRitual(k, "") ? "Remove" : "Add"} ${i[0]}`}>
                                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" /></svg>
                                </button>
                              </>
                            )}
                          </div>
                          {nota ? <i>{nota}</i> : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <aside className="nt-lado">
                <Botao cheio href={reservarDe(u)} target="_blank" rel="noopener" forte={forte} fino={fino} />
                <button type="button" className="nt-lado-c" onClick={() => abrir("medspa")}>
                  <img src={`${B}/nav/coolsculpting.webp`} alt="CoolSculpting Elite at Natura Spa." width="720" height="480" loading="lazy" />
                  <span>CoolSculpt free consultation <Seta /></span>
                </button>
              </aside>
              </div>
            )}

          {ritual.length > 0 && (
            <div className="nt-doca" role="status" aria-live="polite">
              <div className="nt-doca-t">
                <b><span className="nt-num">{total}</span> · {conta.n} {conta.n === 1 ? "service" : "services"}</b>
                <span>Your visit at {u.curto}.{conta.fora.length ? ` Not on this location’s menu: ${conta.fora.join(", ")}.` : ""} Final price confirmed at the salon.</span>
              </div>
              <button type="button" className="nt-txt" onClick={copiar}>{copiado ? "Copied" : "Copy my list"}</button>
              <button type="button" className="nt-txt" onClick={() => setRitual([])}>Clear</button>
              <Botao cheio href={reservarDe(u)} target="_blank" rel="noopener" forte={forte} fino={fino} />
            </div>
          )}
          <p className="nt-pe">Services may vary based on length of hair & amount of time • Prices subject to change for exceptional cases • Consultation is required for final price • No refunds. *Add lowlights to highlights: additional cost applies.</p>
        </div>
      </section>

      {/* ── MED SPA · COOLSCULPTING ELITE ── */}
      <section className="nt-sec" id="medspa" hidden={pg !== "home"}>
        <div className="nt-in nt-cool">
          <figure className="nt-rv"><img src={`${B}/coolsculpting.webp`} alt="CoolSculpting Elite applicators." width="738" height="492" loading="lazy" /></figure>
          <div className="nt-rv">
            <p className="nt-rot">Achieve your body contouring goals.</p>
            <h2>Sculpt. Shape. Tone.</h2>
            <p className="nt-lead">Losing stubborn body fat isn’t easy. CoolSculpting® is a nonsurgical way to contour your body by freezing and eliminating treated fat.</p>
            <ul>
              <li><b>It’s permanent.</b> CoolSculpting uses cryolipolysis, otherwise known as fat freezing, to target and eliminate fat cells.</li>
              <li><b>It’s proven.</b> CoolSculpting has been FDA cleared for more than 13 years and its safety and effectiveness have been evaluated in clinical studies worldwide.</li>
              <li><b>Little to no downtime.</b> Since CoolSculpting is noninvasive, patients are usually able to return to normal activities right after treatment.</li>
              <li><b>Results in 2 visits.</b> Many patients may need 2+ treatment visits to reach their desired results.</li>
            </ul>
            <div className="nt-acoes">
              <Botao tom="cool" cheio href={`tel:${UNIDADES.med.tel}`} forte="Book a free consultation" fino={`Call ${UNIDADES.med.telFmt}`} />
              <Botao tom="tinta" href="#menu" onClick={() => setCat("face")}>See facials + massage</Botao>
            </div>
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className="nt-sec nt-creme" id="reviews" hidden={pg !== "home"}>
        <div className="nt-in">
          <header className="nt-cab nt-rv">
            <Flor className="nt-flor" />
            <h2 className="nt-h2">Brazilian Hair Salon + Med Spa Reviews</h2>
            <p className="nt-lead">Your experience means everything to us. We’re proud to offer a space where you feel comfortable, cared for, and at home.</p>
          </header>
          <div className="nt-selos nt-rv">
            {SELOS.map(([f, alt, w, h]) => <img key={f} src={`${B}/${f}`} alt={alt} width={w} height={h} loading="lazy" />)}
            <div className="nt-setas">
              <button type="button" aria-label="Previous reviews" onClick={() => vozes.current?.scrollBy({ left: -420, behavior: "smooth" })}><Seta /></button>
              <button type="button" aria-label="Next reviews" onClick={() => vozes.current?.scrollBy({ left: 420, behavior: "smooth" })}><Seta /></button>
            </div>
          </div>
        </div>
        <div className="nt-vozes" ref={vozes} tabIndex={0} role="region" aria-label="Guest reviews">
          {VOZES.map(([quem, fala]) => (
            <figure className="nt-voz" key={quem}><Flor /><blockquote>{fala}</blockquote><figcaption>{quem}</figcaption></figure>
          ))}
        </div>
        <div className="nt-in">
          <div className="nt-nums nt-rv">
            <a href="https://reviews.birdeye.com/natura-spa-495138848" target="_blank" rel="noopener"><b className="nt-num">4.6</b><span>1,081 reviews on Birdeye</span></a>
            <a href={REDES.yelp} target="_blank" rel="noopener"><b className="nt-num">4.3</b><span>606 reviews on Yelp, Astoria</span></a>
          </div>
          <p className="nt-nota">Figures as published by each platform on September 28, 2026.</p>
        </div>
      </section>

      {/* ── SPECIALS ── */}
      <section className="nt-sec" id="specials" hidden={pg !== "home"}>
        <div className="nt-in">
          <header className="nt-cab nt-rv">
            <Flor className="nt-flor" />
            <h2 className="nt-h2">Specials</h2>
            <p className="nt-lead">Explore special offers for a truly rejuvenating experience.</p>
          </header>
          {promo ? (
            <div className="nt-esp">
              <figure className="nt-cartaz nt-rv"><img src={`${B}/${PROMO.imagem}.webp`} alt={PROMO.alt} width="1024" height="1536" loading="lazy" /></figure>
              <div className="nt-rv">
                <p style={{ fontWeight: 600, color: "var(--ouro-e)" }}>{PROMO.onde}</p>
                <h2 style={{ fontSize: "clamp(32px,3.8vw,48px)", marginTop: 4 }}>{PROMO.titulo}</h2>
                <p className="nt-lead" style={{ marginBottom: 24 }}>{PROMO.lema}</p>
                {PROMO.pacotes.map(([n, d, p], k) => (
                  <div className={`nt-pac ${k === PROMO.pacotes.length - 1 ? "nt-pac-u" : ""}`} key={n}><div><b>{n}</b><span>{d}</span></div><strong className="nt-num">{p}</strong></div>
                ))}
                <p className="nt-nota">{PROMO.nota} September only.</p>
                <div className="nt-acoes">
                  <Botao cheio href={reservarDe(UNIDADES.astoria)} target="_blank" rel="noopener" forte="Book at Astoria" fino={statusDe(UNIDADES.astoria, t).texto} />
                  <Botao tom="tinta" href={`tel:${UNIDADES.astoria.tel}`}>Call {UNIDADES.astoria.telFmt}</Botao>
                </div>
              </div>
            </div>
          ) : (
            <div className="nt-rv">
              <p className="nt-lead">This month’s specials are announced at each location. Call and ask what is on.</p>
              <div className="nt-acoes">
                <Botao href={`tel:${UNIDADES.astoria.tel}`}>Astoria · {UNIDADES.astoria.telFmt}</Botao>
                <Botao href={`tel:${UNIDADES.ues.tel}`}>Upper East Side · {UNIDADES.ues.telFmt}</Botao>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── MEMBERSHIP (assinatura mensal · NaturaMembership.jsx) ── */}
      <NaturaMembership hidden={pg !== "home"} Botao={Botao} Flor={Flor} unidades={[UNIDADES.astoria, UNIDADES.ues]} />

      {/* ── GIFT CARDS ── */}
      <section className="nt-hero" id="gift" style={{ paddingBottom: "clamp(64px,8vw,108px)" }} hidden={pg !== "home"}>
        <div className="nt-gift nt-rv">
          <img src={`${B}/gift.webp`} alt="A Natura Spa gift card held by a guest in a white robe." width="1600" height="914" loading="lazy" />
          <Selo />
          <div className="nt-gift-t">
            <h2 className="nt-h2">Best. Gift. Ever.</h2>
            <p>Give the gift of relaxation with our spa gift cards and enjoy exclusive deals for a genuinely refreshing treat. Ideal for any celebration—or simply because.</p>
            <div className="nt-acoes">
              <Botao tom="branco" href={UNIDADES.astoria.presente} target="_blank" rel="noopener">Buy for Astoria Location</Botao>
              <Botao tom="branco" href={UNIDADES.ues.presente} target="_blank" rel="noopener">Buy for East Side Location</Botao>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section className="nt-sec nt-nevoa" id="about" hidden={pg !== "about"}>
        <div className="nt-in">
          <div className="nt-dois">
            <header className="nt-rv"><Flor className="nt-flor" /><h2 className="nt-h2">Why Natura Spa in NYC</h2></header>
            <div className="nt-rv">
              <p>At Natura Spa, your professional med spa and skin care clinic in the heart of New York City, we are constantly refining the newest, most effective beauty and aesthetic techniques so you can feel confident in our expertise. Our team is committed to delivering exceptional results that earn and honor your trust.</p>
              <p style={{ marginTop: 16 }}>Every service we perform is FDA-approved and backed by thousands of successful treatments, and our manager will follow up after your visit to ensure you are completely satisfied.</p>
            </div>
          </div>
          <div className="nt-vals">
            {VALORES.map(([f, n, d]) => (
              <div className="nt-val nt-rv" key={n}><img src={`${B}/${f}`} alt="" width="54" height="54" loading="lazy" /><h3>{n}</h3><p>{d}</p></div>
            ))}
          </div>
          <div className="nt-hist" id="lilian">
            <figure className="nt-hist-f nt-rv">
              <img src={`${B}/equipe/lilian.webp`} alt="Lilian Metzger, owner and founder of Natura Spa." width="600" height="600" loading="lazy" />
              <Selo />
            </figure>
            <div className="nt-rv">
              <p className="nt-hist-s">Owner + Founder</p>
              <h2 className="nt-hist-t">Lilian Metzger</h2>
              <blockquote className="nt-serifa">“A force of nature.”<cite>How one of her friends describes her</cite></blockquote>
              {HISTORIA.map((x) => <p key={x.slice(0, 24)}>{x}</p>)}
            </div>
          </div>
          <div className="nt-rv" style={{ marginTop: "clamp(54px,7vw,90px)" }}>
            <h3>Our Team</h3>
            <ul className="nt-time">
              {EQUIPE.map(([n, c, f]) => (
                <li key={n}>
                  <div className="nt-time-f">{f ? <img src={`${B}/equipe/${f}.webp`} alt={`${n}, ${c}.`} width="440" height="440" loading="lazy" /> : <Flor />}</div>
                  <b>{n}</b><span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="nt-rv" style={{ marginTop: "clamp(54px,7vw,90px)" }}>
            <h3>Meet Our Partners</h3>
            <div className="nt-pars nt-pars-2">
              {PARCEIROS.map((p) => (
                <div className="nt-par" key={p.nome}>
                  <img src={`${B}/${p.foto}.webp`} alt={`${p.nome}, ${p.sub}.`} width="900" height="1229" loading="lazy" />
                  <div><b style={{ fontWeight: 600, fontSize: 17 }}>{p.nome}</b><small>{p.sub}</small><p>{p.texto}</p><a className="nt-lk nt-lk-rosa" href={p.link} target="_blank" rel="noopener">Visit the website <Seta /></a></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── LOJA (conceito; fora do menu público, abre por #store) ── */}
      <NaturaStore hidden={pg !== "store"} />
      <NaturaPoliticas hidden={pg !== "policies"} />

      {/* ── PERGUNTAS ── */}
      <section className="nt-sec" id="faq" hidden={pg !== "services"}>
        <div className="nt-in nt-dois">
          <header className="nt-rv"><Flor className="nt-flor" /><h2 className="nt-h2">Good to know</h2><p className="nt-lead">Cancellation, gift cards and prices, in plain words.</p></header>
          <div className="nt-rv">
            {FAQ.map(([q, a], i) => (
              <div className="nt-perg" key={q}>
                <button type="button" aria-expanded={aberta === i} aria-controls={`nt-r-${i}`} onClick={() => setAberta(aberta === i ? -1 : i)}>
                  {q}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" /></svg>
                </button>
                <div className="nt-resp" id={`nt-r-${i}`} data-on={aberta === i ? "1" : "0"}><div><p>{a}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTATO ── */}
      <section className="nt-sec nt-fala" id="contact">
        <div className="nt-in">
          <h2 className="nt-h2 nt-rv"><a href={REDES.instagram} target="_blank" rel="noopener">@naturaspanyc</a></h2>
          <div className="nt-caixa nt-rv">
            <h3 className="nt-serifa">Have any questions? Drop us a line.</h3>
            <div className="nt-acoes">
              <Botao as="button" type="button" tom="petrol" cheio className="nt-falar" onClick={() => falar(u.tel)}><span className="nt-falar-ic" aria-hidden="true"><Flor /><u /></span>Talk to us now</Botao>
              <Botao tom="tinta" href={`mailto:${EMAIL}`}>Get in touch</Botao>
            </div>
          </div>
        </div>
      </section>

      {/* ── O PLANO PARA A DONA (só com ?plano=1) ── */}
      {plano && (
        <section className="nt-sec nt-plano" id="plano" lang="pt-BR">
          <div className="nt-in">
            <header className="nt-cab">
              <Flor className="nt-flor" />
              <h2 className="nt-h2">Lilian, o que falta é com você</h2>
              <p className="nt-lead">O site já está no ar com tudo o que dava para fazer com o que é público. Estes itens dependem de algo que só você tem.</p>
            </header>
            <div className="nt-plano-g">
              <div>
                <h3>Falta só você <i className="nt-num">{PLANO.falta.length}</i></h3>
                <ol className="nt-plano-f">
                  {PLANO.falta.map(([n, pede, ganho], i) => (
                    <li key={n}><em className="nt-num">{i + 1}</em><div><b>{n}</b><p>{ganho}</p><p className="nt-plano-p"><strong>Preciso de:</strong> {pede}</p></div></li>
                  ))}
                </ol>
              </div>
              <div>
                <h3>Já está no ar <i className="nt-num">{PLANO.feito.length}</i></h3>
                <ul className="nt-plano-l">{PLANO.feito.map(([n, d]) => <li key={n}><Flor /><div><b>{n}</b><p>{d}</p></div></li>)}</ul>
                <h3 style={{ marginTop: 40 }}>Um plus, quando quiser <i className="nt-num">{PLANO.plus.length}</i></h3>
                <ul className="nt-plano-l nt-plano-x">{PLANO.plus.map(([n, d]) => <li key={n}><Flor /><div><b>{n}</b><p>{d}</p></div></li>)}</ul>
              </div>
            </div>
          </div>
        </section>
      )}
      {plano && <a className="nt-plano-c" href="#plano" lang="pt-BR">Plano da Lilian · <span className="nt-num">{PLANO.falta.length}</span> pendências <Seta baixo /></a>}

      <elevenlabs-convai agent-id={AGENTE_VOZ} placement="bottom-left" variant={vozMini ? "tiny" : "compact"} avatar-image-url={`${B}/voz-avatar.svg`} avatar-orb-color-1="#C37B89" avatar-orb-color-2="#F6F0E8" />

      <footer className="nt-fim">
        <div className="nt-in">
          <div className="nt-fim-g">
            <div className="nt-fim-m">
              <img src={`${B}/logo.svg`} alt="Natura Spa" width="130" height="30" loading="lazy" />
              <p>If you are using a screen reader and are having problems using this website, please call <a href="tel:+17189565530">718-956-5530</a> for assistance.</p>
              <ul>
                <li><a href={REDES.instagram} target="_blank" rel="noopener">Instagram</a></li>
                <li><a href={REDES.facebook} target="_blank" rel="noopener">Facebook</a></li>
                <li><a href={REDES.yelp} target="_blank" rel="noopener">Yelp</a></li>
              </ul>
            </div>
            <div><h2>Hours</h2><dl>{ORDEM.map((id) => { const x = UNIDADES[id]; return (<div key={id}><dt>{x.rodape}</dt><dd className="nt-num">Monday – Saturday: {horaCurta(x.semana[0])} to {horaCurta(x.semana[1])}<br />Sunday: {horaCurta(x.dom[0])} to {horaCurta(x.dom[1])}</dd></div>); })}</dl></div>
            <div><h2>Visit us</h2><dl>{ORDEM.map((id) => { const x = UNIDADES[id]; return (<div key={id}><dt>{x.rodape}</dt><dd><a href={x.mapa} target="_blank" rel="noopener">{x.rua}, {x.cidade}</a></dd></div>); })}</dl></div>
            <div><h2>Call us</h2><dl>{ORDEM.map((id) => { const x = UNIDADES[id]; return (<div key={id}><dt>{x.rodape}</dt><dd className="nt-num"><a href={`tel:${x.tel}`}>{x.telFmt}</a>{x.outros.map((o) => ` · ${o}`)}</dd></div>); })}</dl></div>
          </div>
          {!TENANT && <p className="nt-aviso">Preview prepared for Natura Spa + Salon. Prices, hours and services were read from naturaspanyc.com on September 28, 2026, and booking links go to Natura Spa’s own Mindbody pages.</p>}
          <div className="nt-base">
            <span>© Copyright {new Date().getFullYear()} Natura Spa + Salon · <a href="#cancellation">Cancellation Policy</a> · <a href="#privacy">Privacy Policy</a></span>
            <a href="https://guileoai.com" target="_blank" rel="noopener">Site + AI by Guileo</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
