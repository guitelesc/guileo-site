import { useState, useEffect, useRef } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink, bookLink } from "../data/contact.js";
import { MASTER_SENTENCE, OBJECTION_KILLERS, PRICING } from "../data/salesKit.js";
import { useLang } from "../i18n.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// /pitch — the ≤20-min CLIENT PRESENTATION the Growth Partner walks a prospect
// through. Arc: dor → solução → ganho → concorrência. A standalone, full-screen
// scroll-snap deck (no marketing navbar) that opens with THE one master sentence
// (src/data/salesKit.js) and ends on the LIVE DEMO close ("deixa a Gui te ligar
// AGORA"). Each section carries a visible timer badge so the seller keeps the
// 20-minute budget. Keyboard ↑/↓/Space/→ + dot nav. Locked Guileo design system
// (cement + green-detail + champagne). Quadrilingual EN·PT·ES·HI via useLang().
// ─────────────────────────────────────────────────────────────────────────────

const LANGS = [["en", "🇺🇸"], ["pt", "🇧🇷"], ["es", "🇪🇸"], ["hi", "🇮🇳"]];
const LANG_NAMES = { en: "English", pt: "Português", es: "Español", hi: "हिन्दी" };

// ≤20 min: each slide carries its minute budget (shown in the header + a badge).
const SLIDE_IDS = ["cover", "problem", "gui", "pratica", "deliver", "proof", "method", "pricing", "trust", "objecoes", "teste", "close"];
const SLIDE_TIMES = ["0–1 min", "1–4 min", "4–6 min", "6–9 min", "9–10 min", "10–12 min", "12–13 min", "13–15 min", "15–16 min", "16–18 min", "18–19 min", "19–20 min"];

// The master sentence lives in salesKit (pt/en/es). Hindi variant is page-level
// (shared data is untouched); HIGHLIGHT = the phrase inside it that carries the shine.
const HI_SENTENCE = "Guileo इंस्टॉल करती है एक ऐसा कर्मचारी जो कभी नहीं सोता: जवाब देता, बुकिंग, बिक्री और आपके लिए वसूली करता है — और कीमत एक वेटर की एक दिन की तनख्वाह से भी कम।";
const HIGHLIGHT = {
  pt: "funcionário que nunca dorme",
  en: "employee that never sleeps",
  es: "empleado que nunca duerme",
  hi: "कर्मचारी जो कभी नहीं सोता",
};

// Per-language deck content — PT copy preserved exactly as before.
const C = {
  pt: {
    docTitle: "Guileo · Apresentação",
    next: "Próximo",
    labels: ["Abertura", "A dor", "A solução: a Gui", "O ganho: na prática", "O que entregamos", "Resultados", "Como funciona", "Investimento", "Confiança", "As objeções", "Teste sem risco", "A demo AGORA"],
    probEyebrow: "O problema",
    probH2: "Todo dia, dinheiro sai pela porta — e ninguém vê.",
    probCards: [
      ["📞", "Ligação perdida", "Toca às 21h, ninguém atende. O cliente liga pro concorrente."],
      ["⏰", "Lead esfria", "Demorou 1h pra responder? A venda já era."],
      ["🔁", "Sem follow-up", "Quem não voltou, ninguém chamou de volta."],
    ],
    probLoses: "Um negócio médio perde por mês",
    probRange: "$3.000–9.000",
    probOnly: "só em oportunidade que ninguém capturou.",
    guiEyebrow: "Conheça a Gui",
    guiH2a: "Uma IA que ", guiH2b: "atende", guiH2c: ", ", guiH2d: "agenda", guiH2e: ", ", guiH2f: "vende", guiH2g: " e faz follow-up.",
    guiP: "Voz, WhatsApp, SMS e web — qualquer idioma, 24 horas, sem nunca cansar.",
    guiChips: ["📅 Agenda", "🛒 Toma pedidos", "💳 Registra vendas", "🧾 Manda orçamento", "↩️ Reagenda no-show", "🌐 Responde em qualquer língua"],
    guiMoment: "👉 Momento da verdade",
    guiMomentP: "Deixa eu fazer a Gui te ligar agora — você ouve ela trabalhar.",
    dayEyebrow: "Um dia com a Gui · de verdade",
    dayH2a: "Enquanto você vive seu dia, ", dayH2b: "ela trabalha o dia inteiro.",
    day: [
      { h: "07:40", icon: "🔔", what: "Manda os lembretes do dia", result: "3 no-shows evitados" },
      { h: "09:12", icon: "🛒", what: "Atende e anota pedido por telefone", result: "+ $85 · upsell de bebida" },
      { h: "12:30", icon: "📅", what: "Agenda cliente novo pelo WhatsApp", result: "consulta marcada em 40s" },
      { h: "15:05", icon: "🧾", what: "Envia orçamento e cobra resposta", result: "proposta de $4.200 na mesa" },
      { h: "18:50", icon: "⭐", what: "Pede avaliação pós-atendimento", result: "mais um 5 estrelas" },
      { h: "21:38", icon: "📞", what: "Atende ligação fora do horário", result: "venda que ia pro concorrente" },
      { h: "02:10", icon: "🔁", what: "Reativa clientes sumidos", result: "2 voltaram a comprar" },
    ],
    dayFootA: "Madrugada, domingo, feriado — ", dayFootB: "nenhuma hora é perdida.",
    delEyebrow: "O que entregamos",
    delH2: "Não automatizamos tarefas. Crescemos o negócio.",
    legs: [
      { ic: "🧠", name: "Guileo Brain", role: "Performance", desc: "Agentes de IA que atendem, agendam, qualificam e fecham — 24/7, em qualquer idioma.", color: "#3E9468" },
      { ic: "📈", name: "Guileo AD", role: "Sales", desc: "Cada conversa vira dado, dado vira marketing, marketing vira receita recorrente.", color: "#D6C29A" },
      { ic: "🛠️", name: "Guileo Build", role: "Growth", desc: "Sites, apps e software sob medida — construídos pra converter e escalar.", color: "#C2A878" },
    ],
    delPlus: "+60 serviços e produtos · um time · uma conta",
    deliver: ["🎙️ Voice AI", "💬 WhatsApp & SMS", "🌐 Sites", "📱 Apps", "⚙️ Software", "📣 Anúncios", "📅 Agendamentos", "🛒 E-commerce", "🔄 Automações", "📊 Dashboards & CRM", "⭐ Reviews", "📈 Growth"],
    proofEyebrow: "Resultados",
    proofH2a: "Você não compra IA. ", proofH2b: "Você compra resultado.",
    results: [["+286%", "performance média"], ["3×", "ciclo de venda mais rápido"], ["< 7 dias", "no ar"], ["24/7", "no automático"]],
    proofPa: "A gente precifica o ", proofPb: "problema que resolve", proofPc: " — nunca a tecnologia por baixo.",
    methodEyebrow: "Como funciona",
    methodH2: "Conduzido por humanos de verdade. No ar em 7 dias.",
    method: [
      { ic: "🌱", when: "Dia 01", title: "Plantamos", desc: "Um humano estuda seu negócio e acha onde o dinheiro vaza." },
      { ic: "🌿", when: "Dias 2–7", title: "Construímos", desc: "Montamos e colocamos sua IA no ar em menos de 7 dias." },
      { ic: "🌳", when: "Semana 2 →", title: "Colhemos", desc: "O lucro sobe — e a gente continua otimizando pra você." },
    ],
    methodPa: "A gente até ", methodPb: "visita você", methodPc: " pra entender o negócio de perto.",
    priceEyebrow: "Investimento",
    priceH2: "Menos que um dia de garçom.",
    pricePa: "Dois caminhos: self-service a partir de ", pricePb: "/mês", pricePc: " (você ativa e a Gui nasce em minutos) ou tudo montado por nós — ",
    priceSetupWord: " de setup + ", pricePd: "/mês", pricePe: ", no ar em 7 dias.",
    priceGetTitle: "Você recebe",
    priceGet: ["✓ Marketing + IA trabalhando juntos", "✓ Plugado no seu sistema atual", "✓ Atende 24/7, qualquer idioma", "✓ No ar em 7 dias"],
    priceRiskTitle: "Sem risco",
    priceRisk: ["🛡️ Garantia de 30 dias", "💳 Plano mensal, sem amarras longas", "📊 Você vê cada crédito no painel", "🤝 Um humano revisa com você"],
    trustEyebrow: "Confiança",
    trustH2: "Construído pra ser confiável desde o dia um.",
    trust1a: "Um fundador de verdade toca isso ", trust1b: "junto com você", trust1c: ".",
    trust2a: "Seus dados são ", trust2b: "seus", trust2c: " — governados do início ao fim.",
    objEyebrow: "O que todo mundo pergunta",
    objH2a: "Suas dúvidas, ", objH2b: "respondidas na hora.",
    objTap: "Toque em qualquer carta pra virar.",
    objAnswer: "✓ Resposta", objFront: (n) => `Objeção ${n} · toque`,
    testEyebrow: "Como você testa · sem risco",
    testH2a: "Você não precisa acreditar. ", testH2b: "Precisa testar.",
    testCards: [
      ["1", "📞", "Agora, nesta reunião", "A Gui te liga na frente de todo mundo. Você ouve ela atender, qualificar e vender — ao vivo."],
      ["2", "🛠️", "Próximos 7 dias", "A gente constrói o SEU sistema — com seu cardápio, seus serviços, sua voz. Você acompanha tudo."],
      ["3", "🛡️", "Primeiros 30 dias", "O sistema prova o resultado em números. Não provou? Devolvemos. Simples assim."],
    ],
    testBox: "O risco é todo nosso. O resultado é todo seu.",
    closeH2a: "Deixa a Gui te ligar ", closeH2b: "AGORA.",
    closePa: "Você não precisa acreditar em ninguém — coloca seu número e ", closePb: "ela te liga em segundos, ao vivo, na sua frente.", closePc: " Depois: no ar em minutos · garantia de 30 dias.",
    closeCta1: "⚡ Deixa a Gui te ligar agora", closeCta2: "📅 Agendar", closeCta3: "💬 WhatsApp",
    closeBook: "Quero agendar uma demo da Guileo",
    closeWa: "Oi Guileo! Vi a apresentação e quero começar.",
    closeQuote: "\"Imagine seu negócio vendendo, agendando e crescendo — enquanto você dorme. A gente não imagina. A gente constrói.\"",
  },
  en: {
    docTitle: "Guileo · Presentation",
    next: "Next",
    labels: ["Opening", "The pain", "The solution: Gui", "The gain: in practice", "What we deliver", "Results", "How it works", "Investment", "Trust", "The objections", "Risk-free test", "The demo NOW"],
    probEyebrow: "The problem",
    probH2: "Every day, money walks out the door — and nobody sees it.",
    probCards: [
      ["📞", "Missed call", "Rings at 9pm, nobody answers. The customer calls your competitor."],
      ["⏰", "Lead goes cold", "Took an hour to reply? The sale is gone."],
      ["🔁", "No follow-up", "Whoever didn't come back, nobody called back."],
    ],
    probLoses: "An average business loses per month",
    probRange: "$3,000–9,000",
    probOnly: "just in opportunity nobody captured.",
    guiEyebrow: "Meet Gui",
    guiH2a: "An AI that ", guiH2b: "answers", guiH2c: ", ", guiH2d: "books", guiH2e: ", ", guiH2f: "sells", guiH2g: " and follows up.",
    guiP: "Voice, WhatsApp, SMS and web — any language, 24 hours, never getting tired.",
    guiChips: ["📅 Books", "🛒 Takes orders", "💳 Logs sales", "🧾 Sends quotes", "↩️ Rebooks no-shows", "🌐 Replies in any language"],
    guiMoment: "👉 Moment of truth",
    guiMomentP: "Let me have Gui call you right now — you hear her work.",
    dayEyebrow: "A day with Gui · for real",
    dayH2a: "While you live your day, ", dayH2b: "she works the whole day.",
    day: [
      { h: "07:40", icon: "🔔", what: "Sends the day's reminders", result: "3 no-shows avoided" },
      { h: "09:12", icon: "🛒", what: "Answers and takes a phone order", result: "+ $85 · drink upsell" },
      { h: "12:30", icon: "📅", what: "Books a new client via WhatsApp", result: "appointment set in 40s" },
      { h: "15:05", icon: "🧾", what: "Sends a quote and chases the reply", result: "$4,200 proposal on the table" },
      { h: "18:50", icon: "⭐", what: "Asks for a post-visit review", result: "one more 5 stars" },
      { h: "21:38", icon: "📞", what: "Answers an after-hours call", result: "a sale that was going to the competitor" },
      { h: "02:10", icon: "🔁", what: "Reactivates lapsed customers", result: "2 came back to buy" },
    ],
    dayFootA: "Middle of the night, Sunday, holiday — ", dayFootB: "no hour is wasted.",
    delEyebrow: "What we deliver",
    delH2: "We don't automate tasks. We grow the business.",
    legs: [
      { ic: "🧠", name: "Guileo Brain", role: "Performance", desc: "AI agents that answer, book, qualify and close — 24/7, in any language.", color: "#3E9468" },
      { ic: "📈", name: "Guileo AD", role: "Sales", desc: "Every conversation becomes data, data becomes marketing, marketing becomes recurring revenue.", color: "#D6C29A" },
      { ic: "🛠️", name: "Guileo Build", role: "Growth", desc: "Websites, apps and custom software — built to convert and scale.", color: "#C2A878" },
    ],
    delPlus: "+60 services and products · one team · one bill",
    deliver: ["🎙️ Voice AI", "💬 WhatsApp & SMS", "🌐 Websites", "📱 Apps", "⚙️ Software", "📣 Ads", "📅 Scheduling", "🛒 E-commerce", "🔄 Automations", "📊 Dashboards & CRM", "⭐ Reviews", "📈 Growth"],
    proofEyebrow: "Results",
    proofH2a: "You don't buy AI. ", proofH2b: "You buy results.",
    results: [["+286%", "average performance"], ["3×", "faster sales cycle"], ["< 7 days", "to go live"], ["24/7", "on autopilot"]],
    proofPa: "We price the ", proofPb: "problem we solve", proofPc: " — never the technology underneath.",
    methodEyebrow: "How it works",
    methodH2: "Run by real humans. Live in 7 days.",
    method: [
      { ic: "🌱", when: "Day 01", title: "We plant", desc: "A human studies your business and finds where the money leaks." },
      { ic: "🌿", when: "Days 2–7", title: "We build", desc: "We assemble and put your AI live in under 7 days." },
      { ic: "🌳", when: "Week 2 →", title: "We harvest", desc: "Profit climbs — and we keep optimizing for you." },
    ],
    methodPa: "We'll even ", methodPb: "visit you", methodPc: " to understand the business up close.",
    priceEyebrow: "Investment",
    priceH2: "Less than a day of one waiter's pay.",
    pricePa: "Two paths: self-service from ", pricePb: "/mo", pricePc: " (you activate and Gui is born in minutes) or everything built by us — ",
    priceSetupWord: " setup + ", pricePd: "/mo", pricePe: ", live in 7 days.",
    priceGetTitle: "You get",
    priceGet: ["✓ Marketing + AI working together", "✓ Plugged into your current system", "✓ Answers 24/7, any language", "✓ Live in 7 days"],
    priceRiskTitle: "No risk",
    priceRisk: ["🛡️ 30-day guarantee", "💳 Monthly plan, no long lock-in", "📊 You see every credit on the dashboard", "🤝 A human reviews it with you"],
    trustEyebrow: "Trust",
    trustH2: "Built to be trustworthy from day one.",
    trust1a: "A real founder runs this ", trust1b: "alongside you", trust1c: ".",
    trust2a: "Your data is ", trust2b: "yours", trust2c: " — governed end to end.",
    objEyebrow: "What everyone asks",
    objH2a: "Your doubts, ", objH2b: "answered on the spot.",
    objTap: "Tap any card to flip it.",
    objAnswer: "✓ Answer", objFront: (n) => `Objection ${n} · tap`,
    testEyebrow: "How you test us · risk-free",
    testH2a: "You don't need to believe. ", testH2b: "You need to test.",
    testCards: [
      ["1", "📞", "Now, in this meeting", "Gui calls you in front of everyone. You hear her answer, qualify and sell — live."],
      ["2", "🛠️", "Next 7 days", "We build YOUR system — with your menu, your services, your voice. You follow everything."],
      ["3", "🛡️", "First 30 days", "The system proves the result in numbers. Didn't prove it? We refund. That simple."],
    ],
    testBox: "The risk is all ours. The result is all yours.",
    closeH2a: "Let Gui call you ", closeH2b: "NOW.",
    closePa: "You don't have to believe anyone — enter your number and ", closePb: "she calls you in seconds, live, right in front of you.", closePc: " Then: live in minutes · 30-day guarantee.",
    closeCta1: "⚡ Let Gui call you now", closeCta2: "📅 Book", closeCta3: "💬 WhatsApp",
    closeBook: "I'd like to book a Guileo demo",
    closeWa: "Hi Guileo! I saw the presentation and I want to start.",
    closeQuote: "\"Imagine your business selling, booking and growing — while you sleep. We don't imagine it. We build it.\"",
  },
  es: {
    docTitle: "Guileo · Presentación",
    next: "Siguiente",
    labels: ["Apertura", "El dolor", "La solución: Gui", "La ganancia: en la práctica", "Qué entregamos", "Resultados", "Cómo funciona", "Inversión", "Confianza", "Las objeciones", "Prueba sin riesgo", "La demo AHORA"],
    probEyebrow: "El problema",
    probH2: "Cada día, el dinero sale por la puerta — y nadie lo ve.",
    probCards: [
      ["📞", "Llamada perdida", "Suena a las 9pm, nadie contesta. El cliente llama al competidor."],
      ["⏰", "El lead se enfría", "¿Tardaste 1h en responder? La venta ya se fue."],
      ["🔁", "Sin seguimiento", "A quien no volvió, nadie lo llamó de vuelta."],
    ],
    probLoses: "Un negocio promedio pierde al mes",
    probRange: "$3.000–9.000",
    probOnly: "solo en oportunidad que nadie capturó.",
    guiEyebrow: "Conoce a Gui",
    guiH2a: "Una IA que ", guiH2b: "contesta", guiH2c: ", ", guiH2d: "agenda", guiH2e: ", ", guiH2f: "vende", guiH2g: " y hace seguimiento.",
    guiP: "Voz, WhatsApp, SMS y web — cualquier idioma, 24 horas, sin cansarse nunca.",
    guiChips: ["📅 Agenda", "🛒 Toma pedidos", "💳 Registra ventas", "🧾 Envía presupuestos", "↩️ Reagenda no-shows", "🌐 Responde en cualquier idioma"],
    guiMoment: "👉 Momento de la verdad",
    guiMomentP: "Deja que haga que Gui te llame ahora — la escuchas trabajar.",
    dayEyebrow: "Un día con Gui · de verdad",
    dayH2a: "Mientras tú vives tu día, ", dayH2b: "ella trabaja el día entero.",
    day: [
      { h: "07:40", icon: "🔔", what: "Envía los recordatorios del día", result: "3 ausencias evitadas" },
      { h: "09:12", icon: "🛒", what: "Contesta y anota pedido por teléfono", result: "+ $85 · upsell de bebida" },
      { h: "12:30", icon: "📅", what: "Agenda cliente nuevo por WhatsApp", result: "cita agendada en 40s" },
      { h: "15:05", icon: "🧾", what: "Envía presupuesto y pide respuesta", result: "propuesta de $4.200 en la mesa" },
      { h: "18:50", icon: "⭐", what: "Pide reseña post-atención", result: "otro 5 estrellas" },
      { h: "21:38", icon: "📞", what: "Contesta llamada fuera de horario", result: "venta que iba al competidor" },
      { h: "02:10", icon: "🔁", what: "Reactiva clientes desaparecidos", result: "2 volvieron a comprar" },
    ],
    dayFootA: "Madrugada, domingo, feriado — ", dayFootB: "ninguna hora se pierde.",
    delEyebrow: "Qué entregamos",
    delH2: "No automatizamos tareas. Hacemos crecer el negocio.",
    legs: [
      { ic: "🧠", name: "Guileo Brain", role: "Performance", desc: "Agentes de IA que contestan, agendan, califican y cierran — 24/7, en cualquier idioma.", color: "#3E9468" },
      { ic: "📈", name: "Guileo AD", role: "Sales", desc: "Cada conversación se vuelve dato, el dato marketing, el marketing ingreso recurrente.", color: "#D6C29A" },
      { ic: "🛠️", name: "Guileo Build", role: "Growth", desc: "Webs, apps y software a medida — construidos para convertir y escalar.", color: "#C2A878" },
    ],
    delPlus: "+60 servicios y productos · un equipo · una cuenta",
    deliver: ["🎙️ Voice AI", "💬 WhatsApp & SMS", "🌐 Webs", "📱 Apps", "⚙️ Software", "📣 Anuncios", "📅 Agendamiento", "🛒 E-commerce", "🔄 Automatizaciones", "📊 Dashboards & CRM", "⭐ Reseñas", "📈 Growth"],
    proofEyebrow: "Resultados",
    proofH2a: "No compras IA. ", proofH2b: "Compras resultado.",
    results: [["+286%", "performance promedio"], ["3×", "ciclo de venta más rápido"], ["< 7 días", "en vivo"], ["24/7", "en automático"]],
    proofPa: "Ponemos precio al ", proofPb: "problema que resolvemos", proofPc: " — nunca a la tecnología de abajo.",
    methodEyebrow: "Cómo funciona",
    methodH2: "Liderado por humanos de verdad. En vivo en 7 días.",
    method: [
      { ic: "🌱", when: "Día 01", title: "Plantamos", desc: "Un humano estudia tu negocio y encuentra por dónde se fuga el dinero." },
      { ic: "🌿", when: "Días 2–7", title: "Construimos", desc: "Montamos y ponemos tu IA en vivo en menos de 7 días." },
      { ic: "🌳", when: "Semana 2 →", title: "Cosechamos", desc: "La ganancia sube — y seguimos optimizando para ti." },
    ],
    methodPa: "Incluso ", methodPb: "te visitamos", methodPc: " para entender el negocio de cerca.",
    priceEyebrow: "Inversión",
    priceH2: "Menos que un día de sueldo de un mesero.",
    pricePa: "Dos caminos: self-service desde ", pricePb: "/mes", pricePc: " (tú activas y Gui nace en minutos) o todo montado por nosotros — ",
    priceSetupWord: " de setup + ", pricePd: "/mes", pricePe: ", en vivo en 7 días.",
    priceGetTitle: "Tú recibes",
    priceGet: ["✓ Marketing + IA trabajando juntos", "✓ Conectado a tu sistema actual", "✓ Atiende 24/7, cualquier idioma", "✓ En vivo en 7 días"],
    priceRiskTitle: "Sin riesgo",
    priceRisk: ["🛡️ Garantía de 30 días", "💳 Plan mensual, sin ataduras largas", "📊 Ves cada crédito en el panel", "🤝 Un humano lo revisa contigo"],
    trustEyebrow: "Confianza",
    trustH2: "Construido para ser confiable desde el día uno.",
    trust1a: "Un fundador de verdad lo lleva ", trust1b: "junto contigo", trust1c: ".",
    trust2a: "Tus datos son ", trust2b: "tuyos", trust2c: " — gobernados de principio a fin.",
    objEyebrow: "Lo que todos preguntan",
    objH2a: "Tus dudas, ", objH2b: "respondidas al instante.",
    objTap: "Toca cualquier carta para voltearla.",
    objAnswer: "✓ Respuesta", objFront: (n) => `Objeción ${n} · toca`,
    testEyebrow: "Cómo nos pruebas · sin riesgo",
    testH2a: "No necesitas creer. ", testH2b: "Necesitas probar.",
    testCards: [
      ["1", "📞", "Ahora, en esta reunión", "Gui te llama frente a todos. La escuchas contestar, calificar y vender — en vivo."],
      ["2", "🛠️", "Próximos 7 días", "Construimos TU sistema — con tu menú, tus servicios, tu voz. Lo acompañas todo."],
      ["3", "🛡️", "Primeros 30 días", "El sistema prueba el resultado en números. ¿No lo probó? Devolvemos. Así de simple."],
    ],
    testBox: "El riesgo es todo nuestro. El resultado es todo tuyo.",
    closeH2a: "Deja que Gui te llame ", closeH2b: "AHORA.",
    closePa: "No tienes que creerle a nadie — pon tu número y ", closePb: "ella te llama en segundos, en vivo, frente a ti.", closePc: " Después: en vivo en minutos · garantía de 30 días.",
    closeCta1: "⚡ Deja que Gui te llame ahora", closeCta2: "📅 Agendar", closeCta3: "💬 WhatsApp",
    closeBook: "Quiero agendar una demo de Guileo",
    closeWa: "¡Hola Guileo! Vi la presentación y quiero empezar.",
    closeQuote: "\"Imagina tu negocio vendiendo, agendando y creciendo — mientras duermes. No lo imaginamos. Lo construimos.\"",
  },
  hi: {
    docTitle: "Guileo · प्रेज़ेंटेशन",
    next: "अगला",
    labels: ["शुरुआत", "दर्द", "समाधान: गुई", "फ़ायदा: व्यवहार में", "हम क्या देते हैं", "परिणाम", "कैसे काम करता है", "निवेश", "भरोसा", "आपत्तियाँ", "जोखिम-मुक्त परीक्षण", "डेमो अभी"],
    probEyebrow: "समस्या",
    probH2: "हर दिन पैसा दरवाज़े से बाहर जाता है — और किसी को दिखता नहीं।",
    probCards: [
      ["📞", "मिस्ड कॉल", "रात 9 बजे फ़ोन बजता है, कोई नहीं उठाता। ग्राहक प्रतिस्पर्धी को कॉल करता है।"],
      ["⏰", "लीड ठंडी हो जाती है", "जवाब देने में 1 घंटा लगा? बिक्री गई।"],
      ["🔁", "कोई फ़ॉलो-अप नहीं", "जो वापस नहीं आया, उसे किसी ने वापस कॉल नहीं किया।"],
    ],
    probLoses: "एक औसत बिज़नेस हर महीने खोता है",
    probRange: "$3,000–9,000",
    probOnly: "सिर्फ़ उस मौके में जिसे किसी ने पकड़ा नहीं।",
    guiEyebrow: "गुई से मिलिए",
    guiH2a: "एक AI जो ", guiH2b: "जवाब देती", guiH2c: ", ", guiH2d: "बुक करती", guiH2e: ", ", guiH2f: "बेचती", guiH2g: " और फ़ॉलो-अप करती है।",
    guiP: "वॉइस, WhatsApp, SMS और वेब — कोई भी भाषा, 24 घंटे, बिना थके।",
    guiChips: ["📅 बुकिंग", "🛒 ऑर्डर लेती है", "💳 बिक्री दर्ज करती है", "🧾 कोटेशन भेजती है", "↩️ नो-शो री-बुक करती है", "🌐 किसी भी भाषा में जवाब"],
    guiMoment: "👉 सच का पल",
    guiMomentP: "मुझे अभी गुई से आपको कॉल करवाने दीजिए — आप उसे काम करते सुनेंगे।",
    dayEyebrow: "गुई के साथ एक दिन · सच में",
    dayH2a: "जब आप अपना दिन जीते हैं, ", dayH2b: "वह पूरा दिन काम करती है।",
    day: [
      { h: "07:40", icon: "🔔", what: "दिन के रिमाइंडर भेजती है", result: "3 नो-शो टले" },
      { h: "09:12", icon: "🛒", what: "फ़ोन पर ऑर्डर लेती है", result: "+ $85 · ड्रिंक अपसेल" },
      { h: "12:30", icon: "📅", what: "WhatsApp से नया क्लाइंट बुक करती है", result: "40 सेकंड में अपॉइंटमेंट" },
      { h: "15:05", icon: "🧾", what: "कोटेशन भेजकर जवाब माँगती है", result: "$4,200 का प्रस्ताव टेबल पर" },
      { h: "18:50", icon: "⭐", what: "सेवा के बाद रिव्यू माँगती है", result: "एक और 5 स्टार" },
      { h: "21:38", icon: "📞", what: "समय के बाद की कॉल उठाती है", result: "वह बिक्री जो प्रतिस्पर्धी को जा रही थी" },
      { h: "02:10", icon: "🔁", what: "गायब ग्राहकों को दोबारा जोड़ती है", result: "2 वापस ख़रीदने आए" },
    ],
    dayFootA: "आधी रात, रविवार, छुट्टी — ", dayFootB: "कोई घंटा बेकार नहीं जाता।",
    delEyebrow: "हम क्या देते हैं",
    delH2: "हम काम ऑटोमेट नहीं करते। हम बिज़नेस बढ़ाते हैं।",
    legs: [
      { ic: "🧠", name: "Guileo Brain", role: "Performance", desc: "AI एजेंट जो जवाब देते, बुक करते, क्वालिफाई करते और डील बंद करते हैं — 24/7, किसी भी भाषा में।", color: "#3E9468" },
      { ic: "📈", name: "Guileo AD", role: "Sales", desc: "हर बातचीत डेटा बनती है, डेटा मार्केटिंग, मार्केटिंग नियमित आय।", color: "#D6C29A" },
      { ic: "🛠️", name: "Guileo Build", role: "Growth", desc: "वेबसाइट, ऐप और कस्टम सॉफ़्टवेयर — कन्वर्ट और स्केल के लिए बने।", color: "#C2A878" },
    ],
    delPlus: "+60 सेवाएँ और प्रोडक्ट · एक टीम · एक बिल",
    deliver: ["🎙️ Voice AI", "💬 WhatsApp & SMS", "🌐 वेबसाइट", "📱 ऐप", "⚙️ सॉफ़्टवेयर", "📣 विज्ञापन", "📅 शेड्यूलिंग", "🛒 ई-कॉमर्स", "🔄 ऑटोमेशन", "📊 डैशबोर्ड & CRM", "⭐ रिव्यू", "📈 ग्रोथ"],
    proofEyebrow: "परिणाम",
    proofH2a: "आप AI नहीं ख़रीदते। ", proofH2b: "आप नतीजा ख़रीदते हैं।",
    results: [["+286%", "औसत परफ़ॉर्मेंस"], ["3×", "तेज़ बिक्री चक्र"], ["< 7 दिन", "लाइव होने में"], ["24/7", "ऑटोपायलट पर"]],
    proofPa: "हम कीमत लगाते हैं ", proofPb: "उस समस्या की जो हम हल करते हैं", proofPc: " — नीचे की तकनीक की कभी नहीं।",
    methodEyebrow: "कैसे काम करता है",
    methodH2: "असली इंसानों द्वारा संचालित। 7 दिनों में लाइव।",
    method: [
      { ic: "🌱", when: "दिन 01", title: "हम बोते हैं", desc: "एक इंसान आपका बिज़नेस पढ़ता है और पता लगाता है कि पैसा कहाँ रिस रहा है।" },
      { ic: "🌿", when: "दिन 2–7", title: "हम बनाते हैं", desc: "हम 7 दिनों से कम में आपकी AI को तैयार कर लाइव करते हैं।" },
      { ic: "🌳", when: "सप्ताह 2 →", title: "हम काटते हैं", desc: "मुनाफ़ा बढ़ता है — और हम आपके लिए ऑप्टिमाइज़ करते रहते हैं।" },
    ],
    methodPa: "हम ", methodPb: "आपसे मिलने भी आते हैं", methodPc: " ताकि बिज़नेस को क़रीब से समझें।",
    priceEyebrow: "निवेश",
    priceH2: "एक वेटर की एक दिन की तनख्वाह से भी कम।",
    pricePa: "दो रास्ते: सेल्फ़-सर्विस ", pricePb: "/माह से", pricePc: " (आप एक्टिवेट करते हैं और गुई मिनटों में जन्म लेती है) या सब हमारा बनाया — ",
    priceSetupWord: " सेटअप + ", pricePd: "/माह", pricePe: ", 7 दिनों में लाइव।",
    priceGetTitle: "आपको मिलता है",
    priceGet: ["✓ मार्केटिंग + AI साथ काम करते हुए", "✓ आपके मौजूदा सिस्टम से जुड़ा", "✓ 24/7 जवाब, कोई भी भाषा", "✓ 7 दिनों में लाइव"],
    priceRiskTitle: "कोई जोखिम नहीं",
    priceRisk: ["🛡️ 30-दिन गारंटी", "💳 मासिक प्लान, कोई लंबा बंधन नहीं", "📊 हर क्रेडिट डैशबोर्ड पर दिखता है", "🤝 एक इंसान आपके साथ समीक्षा करता है"],
    trustEyebrow: "भरोसा",
    trustH2: "पहले दिन से भरोसेमंद बनने के लिए बना।",
    trust1a: "एक असली फ़ाउंडर इसे चलाता है ", trust1b: "आपके साथ", trust1c: "।",
    trust2a: "आपका डेटा ", trust2b: "आपका", trust2c: " है — शुरू से अंत तक गवर्न्ड।",
    objEyebrow: "जो हर कोई पूछता है",
    objH2a: "आपके सवाल, ", objH2b: "तुरंत जवाब।",
    objTap: "पलटने के लिए किसी भी कार्ड पर टैप करें।",
    objAnswer: "✓ जवाब", objFront: (n) => `आपत्ति ${n} · टैप करें`,
    testEyebrow: "आप हमें कैसे परखें · बिना जोखिम",
    testH2a: "आपको मानने की ज़रूरत नहीं। ", testH2b: "परखने की ज़रूरत है।",
    testCards: [
      ["1", "📞", "अभी, इसी मीटिंग में", "गुई सबके सामने आपको कॉल करती है। आप उसे जवाब देते, क्वालिफाई करते और बेचते सुनते हैं — लाइव।"],
      ["2", "🛠️", "अगले 7 दिन", "हम आपका सिस्टम बनाते हैं — आपके मेन्यू, आपकी सेवाओं, आपकी आवाज़ के साथ। आप सब देखते हैं।"],
      ["3", "🛡️", "पहले 30 दिन", "सिस्टम नतीजा आँकड़ों में साबित करता है। साबित नहीं हुआ? पैसा वापस। इतना आसान।"],
    ],
    testBox: "जोखिम पूरा हमारा। नतीजा पूरा आपका।",
    closeH2a: "गुई को कॉल करने दें — ", closeH2b: "अभी।",
    closePa: "आपको किसी पर भरोसा करने की ज़रूरत नहीं — अपना नंबर डालें और ", closePb: "वह सेकंडों में, लाइव, आपके सामने कॉल करती है।", closePc: " फिर: मिनटों में लाइव · 30-दिन गारंटी।",
    closeCta1: "⚡ गुई को अभी कॉल करने दें", closeCta2: "📅 बुक करें", closeCta3: "💬 WhatsApp",
    closeBook: "I'd like to book a Guileo demo",
    closeWa: "Hi Guileo! I saw the presentation and I want to start.",
    closeQuote: "\"कल्पना कीजिए आपका बिज़नेस बेच रहा है, बुक कर रहा है और बढ़ रहा है — जब आप सो रहे हैं। हम कल्पना नहीं करते। हम बनाते हैं।\"",
  },
};

// A single full-viewport slide. Like the site's scroll-reveal: entrance animations replay
// every time the slide becomes active (remount via key), instead of all firing at page load.
function Slide({ id, children, className = "" }) {
  const [on, setOn] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.55 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={ref} id={id} className={`relative flex h-[100dvh] w-full shrink-0 snap-start flex-col items-center justify-center overflow-hidden px-6 py-20 sm:px-12 ${className}`}>
      <div key={on ? 1 : 0} className="contents">{children}</div>
    </section>
  );
}

const Eyebrow = ({ children }) => (
  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-g-gold">{children}</div>
);

// Objection flip-cards: front = the objection as the owner says it; tap/click flips
// to the read-aloud answer (from salesKit — the same words on every asset).
// salesKit carries pt/en/es; hi falls back to en at the page level.
function ObjectionCards({ lang, c }) {
  const [flipped, setFlipped] = useState({});
  const pick = (o) => o[lang] || o.en || o.pt;
  return (
    <div className="mt-8 grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {OBJECTION_KILLERS.map((o, i) => {
        const open = !!flipped[o.id];
        return (
          <button key={o.id} onClick={() => setFlipped((f) => ({ ...f, [o.id]: !f[o.id] }))}
            className={`rounded-2xl border p-4 text-left transition-all duration-300 ${open ? "border-g-green/40 bg-g-green/[0.07]" : "border-g-gold/25 bg-white/[0.03] hover:border-g-gold/50"}`}
            style={{ animation: `pfade .6s ease ${0.08 + i * 0.07}s both`, minHeight: "132px" }}>
            {open ? (
              <>
                <div className="text-[10px] font-black uppercase tracking-wider text-g-green">{c.objAnswer}</div>
                <p className="mt-1.5 text-[11.5px] leading-snug text-g-word">{pick(o.a)}</p>
              </>
            ) : (
              <>
                <div className="text-[10px] font-black uppercase tracking-wider text-g-gold">{c.objFront(i + 1)}</div>
                <p className="mt-1.5 text-[13px] font-black leading-snug text-g-word">{pick(o.q)}</p>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function Pitch() {
  const { lang, setLang } = useLang();
  const c = C[lang] || C.en;
  const [active, setActive] = useState(0);
  const scroller = useRef(null);

  // Cover typography: split the master sentence so the front half carries the big
  // type and the price-anchor tail becomes the sub line. Single source, zero drift.
  const sentence = lang === "hi" ? HI_SENTENCE : (MASTER_SENTENCE[lang] || MASTER_SENTENCE.en);
  const [SENTENCE_MAIN, SENTENCE_TAIL] = sentence.split(" — ");
  const hl = HIGHLIGHT[lang] || HIGHLIGHT.en;

  useEffect(() => { document.title = c.docTitle; }, [c]);

  // Keyboard navigation: ↓/→/Space = next, ↑/← = prev. Presentation muscle memory.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const go = (dir) => {
      const next = Math.max(0, Math.min(SLIDE_IDS.length - 1, active + dir));
      document.getElementById(SLIDE_IDS[next])?.scrollIntoView({ behavior: "smooth" });
    };
    const onKey = (e) => {
      if (["ArrowDown", "ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  // Track the slide in view (drives the dot nav + counter).
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) setActive(SLIDE_IDS.indexOf(en.target.id)); }),
      { threshold: 0.6 }
    );
    SLIDE_IDS.forEach((id) => { const n = document.getElementById(id); if (n) obs.observe(n); });
    return () => obs.disconnect();
  }, []);

  const goTo = (i) => document.getElementById(SLIDE_IDS[i])?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="surface-real relative h-[100dvh] overflow-hidden text-g-ink">
      <style>{`
        @keyframes pfade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pshine{to{background-position:220% center}}
        @keyframes pfall{0%{transform:translateY(-10px);opacity:0}20%{opacity:1}100%{transform:translateY(54px);opacity:0}}
        .pdeck::-webkit-scrollbar{display:none}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      {/* top chrome — logo + language + slide label */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 sm:px-8">
        <a href="/" className="pointer-events-auto flex items-center gap-2 opacity-80 transition hover:opacity-100">
          <img src={logo} alt="Guileo" className="h-7 w-7 object-contain" /><span className="text-sm font-extrabold text-g-word">Guileo</span>
        </a>
        <div className="flex items-center gap-2">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.05] px-1 py-0.5 backdrop-blur-md">
            {LANGS.map(([code, flag]) => (
              <button key={code} onClick={() => setLang(code)} title={LANG_NAMES[code]} aria-label={LANG_NAMES[code]} aria-pressed={lang === code}
                className={`grid h-7 w-7 place-items-center rounded-full text-[13px] transition ${lang === code ? "scale-110 bg-g-green/15 ring-1 ring-g-green/30" : "opacity-60 hover:opacity-100"}`}>{flag}</button>
            ))}
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-g-muted backdrop-blur-md">
            {String(active + 1).padStart(2, "0")} · {c.labels[active]} · <span className="text-g-gold">⏱ {SLIDE_TIMES[active]}</span>
          </div>
        </div>
      </header>

      {/* dot nav */}
      <nav className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 sm:flex">
        {SLIDE_IDS.map((id, i) => (
          <button key={id} onClick={() => goTo(i)} aria-label={c.labels[i]}
            className={`h-2.5 w-2.5 rounded-full transition-all ${i === active ? "scale-125 bg-g-gold" : "bg-white/20 hover:bg-white/40"}`} />
        ))}
      </nav>

      {/* progress bar */}
      <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-white/5">
        <div className="h-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-500" style={{ width: `${((active + 1) / SLIDE_IDS.length) * 100}%` }} />
      </div>

      <div ref={scroller} className="pdeck relative z-10 h-[100dvh] snap-y snap-mandatory overflow-y-scroll scroll-smooth" style={{ scrollbarWidth: "none" }}>

        {/* 1 — COVER: the one sentence */}
        <Slide id="cover">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_500px_at_50%_30%,rgba(62,148,104,0.12),transparent)]" />
          <img src={logo} alt="" className="mb-8 h-20 w-20 object-contain drop-shadow-[0_0_40px_rgba(62,148,104,0.4)]" style={{ animation: "pfade .8s ease both" }} />
          <p className="mx-auto max-w-4xl text-center font-black leading-[1.05] tracking-tight text-g-word" style={{ fontSize: "clamp(1.8rem,4.4vw,3.4rem)", animation: "pfade .9s ease .15s both" }}>
            {SENTENCE_MAIN.includes(hl)
              ? <>{SENTENCE_MAIN.split(hl)[0]}<span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "pshine 7s linear infinite" }}>{hl}</span>{SENTENCE_MAIN.split(hl)[1]}</>
              : SENTENCE_MAIN}
          </p>
          <p className="mt-6 max-w-2xl text-center text-lg text-g-ink sm:text-xl" style={{ animation: "pfade .9s ease .3s both" }}>
            — <span className="font-bold text-g-word">{SENTENCE_TAIL}</span>
          </p>
          <div className="mt-10 flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.2em] text-g-muted" style={{ animation: "pfade .9s ease .45s both" }}>
            <span className="text-g-green">⚡ Work Smart</span> · <span className="text-g-light">Grow Faster</span> · <span className="text-g-gold">Sleep Better</span>
          </div>
          <button onClick={() => goTo(1)} className="absolute bottom-10 animate-bounce text-g-muted" aria-label={c.next}>↓</button>
        </Slide>

        {/* 2 — THE PROBLEM */}
        <Slide id="problem">
          <Eyebrow>{c.probEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            {c.probH2}
          </h2>
          <div className="mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {c.probCards.map(([ic, t, d], i) => (
              <div key={t} className="rounded-2xl border border-[#d8916e]/25 bg-[#d8916e]/[0.06] p-6 text-center" style={{ animation: `pfade .7s ease ${0.1 + i * 0.12}s both` }}>
                <div className="text-3xl">{ic}</div>
                <div className="mt-3 text-base font-black text-g-word">{t}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-g-muted">{d}</p>
              </div>
            ))}
          </div>
          <div className="relative mt-10 text-center" style={{ animation: "pfade .8s ease .5s both" }}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8916e]">{c.probLoses}</div>
            <div className="relative mt-1 inline-block text-[44px] font-black text-[#e0855f] sm:text-[56px]">
              {c.probRange}
              <span className="pointer-events-none absolute -right-6 top-0 text-lg" style={{ animation: "pfall 1.8s ease-in-out infinite" }}>💸</span>
            </div>
            <div className="mt-1 text-[13px] text-g-muted">{c.probOnly}</div>
          </div>
        </Slide>

        {/* 3 — MEET GUI */}
        <Slide id="gui">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_40%,rgba(62,148,104,0.12),transparent)]" />
          <Eyebrow>{c.guiEyebrow}</Eyebrow>
          <div className="relative mb-6 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-g-green/30 to-g-gold/15 text-4xl ring-1 ring-white/15" style={{ animation: "pfade .8s ease both" }}>
            🌱
            <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-g-deep text-g-green ring-2 ring-g-green/60">🎙️</span>
            <span className="absolute inset-0 rounded-full ring-2 ring-g-green/40 animate-pulsering" />
          </div>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            {c.guiH2a}<span className="text-g-green">{c.guiH2b}</span>{c.guiH2c}<span className="text-g-word">{c.guiH2d}</span>{c.guiH2e}<span className="text-g-gold">{c.guiH2f}</span>{c.guiH2g}
          </h2>
          <p className="mt-4 max-w-xl text-center text-[15px] text-g-ink">{c.guiP}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2" style={{ animation: "pfade .8s ease .3s both" }}>
            {c.guiChips.map((ch) => (
              <span key={ch} className="rounded-full border border-g-green/25 bg-g-green/[0.07] px-3 py-1.5 text-[12.5px] font-semibold text-g-light">{ch}</span>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-g-gold/30 bg-g-gold/[0.06] px-6 py-4 text-center" style={{ animation: "pfade .8s ease .45s both" }}>
            <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">{c.guiMoment}</div>
            <p className="mt-1 text-[15px] font-semibold text-g-word">{c.guiMomentP}</p>
          </div>
        </Slide>

        {/* 3.5 — NA PRÁTICA: a real day of work (concrete, not abstract) */}
        <Slide id="pratica">
          <Eyebrow>{c.dayEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.6rem,3.4vw,2.6rem)" }}>
            {c.dayH2a}<span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{c.dayH2b}</span>
          </h2>
          <div className="mt-8 w-full max-w-2xl">
            {c.day.map((d, i) => (
              <div key={d.h} className="flex items-center gap-3 border-b border-white/[0.06] py-2.5" style={{ animation: `pfade .55s ease ${0.12 + i * 0.14}s both` }}>
                <span className="w-12 shrink-0 text-right font-mono text-[12px] font-bold text-g-muted">{d.h}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-base ring-1 ring-white/10">{d.icon}</span>
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-g-word">{d.what}</span>
                <span className="hidden shrink-0 rounded-full border border-g-green/25 bg-g-green/[0.07] px-2.5 py-0.5 text-[11.5px] font-bold text-g-green sm:block">✓ {d.result}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[13.5px] text-g-muted" style={{ animation: "pfade .7s ease 1.2s both" }}>
            {c.dayFootA}<span className="font-bold text-g-word">{c.dayFootB}</span>
          </p>
        </Slide>

        {/* 4 — WHAT WE DELIVER */}
        <Slide id="deliver">
          <Eyebrow>{c.delEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            {c.delH2}
          </h2>
          <div className="mt-9 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {c.legs.map((l, i) => (
              <div key={l.name} className="rounded-2xl border bg-white/[0.03] p-6" style={{ borderColor: `${l.color}40`, animation: `pfade .7s ease ${0.1 + i * 0.12}s both` }}>
                <div className="h-1 w-10 rounded-full" style={{ background: l.color }} />
                <div className="mt-4 text-3xl">{l.ic}</div>
                <div className="mt-2 text-[11px] font-black uppercase tracking-wider" style={{ color: l.color }}>{l.role}</div>
                <div className="text-lg font-black text-g-word">{l.name}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-g-muted">{l.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 max-w-3xl" style={{ animation: "pfade .8s ease .5s both" }}>
            <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-g-muted">{c.delPlus}</div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {c.deliver.map((d) => <span key={d} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-semibold text-g-ink">{d}</span>)}
            </div>
          </div>
        </Slide>

        {/* 5 — PROOF / RESULTS */}
        <Slide id="proof">
          <Eyebrow>{c.proofEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            {c.proofH2a}<span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{c.proofH2b}</span>
          </h2>
          <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-5 sm:grid-cols-4">
            {c.results.map(([n, l], i) => (
              <div key={l} className="text-center" style={{ animation: `pfade .7s ease ${0.1 + i * 0.1}s both` }}>
                <div className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-[34px] font-black text-transparent sm:text-[44px]">{n}</div>
                <div className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-g-muted">{l}</div>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-xl text-center text-[15px] text-g-ink" style={{ animation: "pfade .8s ease .5s both" }}>
            {c.proofPa}<span className="font-bold text-g-word">{c.proofPb}</span>{c.proofPc}
          </p>
        </Slide>

        {/* 6 — METHOD */}
        <Slide id="method">
          <Eyebrow>{c.methodEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            {c.methodH2}
          </h2>
          <div className="mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {c.method.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-g-line bg-white/[0.03] p-6 text-center" style={{ animation: `pfade .7s ease ${0.1 + i * 0.14}s both` }}>
                <div className="text-4xl">{s.ic}</div>
                <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-g-gold">{s.when}</div>
                <div className="text-lg font-black text-g-word">{s.title}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-g-muted">{s.desc}</p>
                {i < 2 && <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-xl text-g-gold sm:block">→</span>}
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-[14px] text-g-ink" style={{ animation: "pfade .8s ease .5s both" }}>
            {c.methodPa}<span className="font-bold text-g-word">{c.methodPb}</span>{c.methodPc}
          </p>
        </Slide>

        {/* 7 — PRICING */}
        <Slide id="pricing">
          <Eyebrow>{c.priceEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            {c.priceH2}
          </h2>
          <p className="mt-4 max-w-2xl text-center text-[15px] text-g-ink">
            {c.pricePa}<span className="font-bold text-g-word">${PRICING.selfServe[0].price}{c.pricePb}</span>{c.pricePc}<span className="font-bold text-g-word">${PRICING.doneForYou.setup}{c.priceSetupWord}${PRICING.doneForYou.monthly.toLocaleString("en-US")}{c.pricePd}</span>{c.pricePe}
          </p>
          <div className="mt-9 grid w-full max-w-3xl gap-4 sm:grid-cols-2" style={{ animation: "pfade .8s ease .3s both" }}>
            <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-6">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-green">{c.priceGetTitle}</div>
              <ul className="mt-3 space-y-2 text-[14px] text-g-word">
                {c.priceGet.map((li) => <li key={li}>{li}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-g-gold/30 bg-g-gold/[0.06] p-6">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">{c.priceRiskTitle}</div>
              <ul className="mt-3 space-y-2 text-[14px] text-g-word">
                {c.priceRisk.map((li) => <li key={li}>{li}</li>)}
              </ul>
            </div>
          </div>
        </Slide>

        {/* 8 — TRUST */}
        <Slide id="trust">
          <Eyebrow>{c.trustEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            {c.trustH2}
          </h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3" style={{ animation: "pfade .8s ease .2s both" }}>
            {["HIPAA", "GDPR", "LGPD", "CCPA", "PCI DSS"].map((b) => (
              <span key={b} className="inline-flex items-center gap-2 rounded-xl border border-g-line bg-white/[0.04] px-4 py-2.5 text-[13px] font-bold text-g-word">🛡️ {b}</span>
            ))}
          </div>
          <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2" style={{ animation: "pfade .8s ease .4s both" }}>
            <div className="rounded-2xl border border-g-line bg-white/[0.03] p-6 text-center">
              <div className="text-2xl">🤝</div>
              <p className="mt-2 text-[14px] text-g-ink">{c.trust1a}<span className="font-bold text-g-word">{c.trust1b}</span>{c.trust1c}</p>
            </div>
            <div className="rounded-2xl border border-g-line bg-white/[0.03] p-6 text-center">
              <div className="text-2xl">🔒</div>
              <p className="mt-2 text-[14px] text-g-ink">{c.trust2a}<span className="font-bold text-g-word">{c.trust2b}</span>{c.trust2c}</p>
            </div>
          </div>
        </Slide>

        {/* 8.6 — OBJECTIONS as flip-cards: the seller taps through whichever the client raises */}
        <Slide id="objecoes">
          <Eyebrow>{c.objEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.6rem,3.4vw,2.6rem)" }}>
            {c.objH2a}<span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{c.objH2b}</span>
          </h2>
          <p className="mt-3 text-center text-[13px] text-g-muted">{c.objTap}</p>
          <ObjectionCards lang={lang} c={c} />
        </Slide>

        {/* 8.5 — TESTE SEM RISCO: how the client tests us, step by step */}
        <Slide id="teste">
          <Eyebrow>{c.testEyebrow}</Eyebrow>
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,3.6vw,2.8rem)" }}>
            {c.testH2a}<span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{c.testH2b}</span>
          </h2>
          <div className="mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {c.testCards.map(([n, ic, t, d], i) => (
              <div key={n} className="relative rounded-2xl border border-g-line bg-white/[0.03] p-6" style={{ animation: `pfade .7s ease ${0.12 + i * 0.16}s both` }}>
                <span className="absolute right-4 top-3 text-[30px] font-black text-white/[0.07]">{n}</span>
                <div className="text-3xl">{ic}</div>
                <div className="mt-3 text-[15px] font-black text-g-word">{t}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-g-muted">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-g-green/30 bg-g-green/[0.06] px-6 py-4 text-center" style={{ animation: "pfade .8s ease .6s both" }}>
            <p className="text-[15px] font-semibold text-g-word">{c.testBox}</p>
          </div>
        </Slide>

        {/* 9 — CLOSE */}
        <Slide id="close">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_460px_at_50%_50%,rgba(214,194,154,0.12),transparent)]" />
          <img src={logo} alt="" className="mb-6 h-16 w-16 object-contain" style={{ animation: "pfade .8s ease both" }} />
          <h2 className="max-w-3xl text-center font-black leading-tight text-g-word" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)", animation: "pfade .8s ease .1s both" }}>
            {c.closeH2a}<span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{c.closeH2b}</span>
          </h2>
          <p className="mt-5 max-w-xl text-center text-[15px] text-g-ink" style={{ animation: "pfade .8s ease .25s both" }}>
            {c.closePa}<span className="font-bold text-g-word">{c.closePb}</span>{c.closePc}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animation: "pfade .8s ease .4s both" }}>
            <a href="https://guileoai.com" target="_blank" rel="noopener" className="btn-gold text-base">{c.closeCta1}</a>
            <a href={bookLink(c.closeBook)} target="_blank" rel="noopener" className="btn text-base">{c.closeCta2}</a>
            <a href={waLink(c.closeWa)} target="_blank" rel="noopener" className="btn text-base">{c.closeCta3}</a>
          </div>
          <p className="mt-12 max-w-lg text-center text-[13px] italic text-g-muted" style={{ animation: "pfade .8s ease .55s both" }}>
            {c.closeQuote}
          </p>
        </Slide>

      </div>
    </div>
  );
}
