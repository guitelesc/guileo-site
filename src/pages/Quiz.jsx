import { useState } from "react";
import { waLink } from "../data/contact";
import logo from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";

// /quiz — "AI Growth Score" funnel. Industry → 5 readiness Qs → what you need →
// SCORE + monthly leak + RECOMMENDED GUILEO STACK (covers all products & services) →
// lead capture. Plus a partner path for agencies. Branded (guileoai.com aesthetic).
// Fully quadrilingual (EN·PT·ES·HI) via the site i18n hook — API payloads stay EN.

// ── AD MESSAGE-MATCH (CRO science: the landing headline must mirror the ad clicked;
// scent-break costs 20–50% of conversion). Ads link with utm_content=<vertical> →
// the hero personalizes to that vertical's pain + its industry card is highlighted.
// Numbers MATCH the ad creatives in ads-creatives/ (same loss figure end-to-end).
const AD_MATCH = {
  restaurant: { ind: 3, h1a: { en: "Your restaurant is leaking ", pt: "Seu restaurante está vazando " }, h1b: { en: "$3,500 every month.", pt: "$3.500 todo mês." } },
  clinic: { ind: 0, h1a: { en: "No-shows are costing you ", pt: "Faltas estão te custando " }, h1b: { en: "$5,400 every month.", pt: "$5.400 todo mês." } },
  dental: { ind: 0, h1a: { en: "An empty chair is ", pt: "Uma cadeira vazia é " }, h1b: { en: "$4,800/mo walking out.", pt: "$4.800/mês indo embora." } },
  hvac: { ind: 5, h1a: { en: "Missed emergency calls cost ", pt: "Chamados de emergência perdidos custam " }, h1b: { en: "$7,600 every month.", pt: "$7.600 todo mês." } },
  realestate: { ind: 2, h1a: { en: "Cold leads are costing you ", pt: "Leads frios estão te custando " }, h1b: { en: "$9,200 every month.", pt: "$9.200 todo mês." } },
  gym: { ind: 6, h1a: { en: "Uncalled trial leads = ", pt: "Leads de teste sem retorno = " }, h1b: { en: "$4,200/mo lost.", pt: "$4.200/mês perdidos." } },
  auto: { ind: 7, h1a: { en: "Waiting buyers are costing you ", pt: "Compradores esperando custam " }, h1b: { en: "$11,000 every month.", pt: "$11.000 todo mês." } },
  ecommerce: { ind: 4, h1a: { en: "Abandoned carts are costing you ", pt: "Carrinhos abandonados custam " }, h1b: { en: "$6,100 every month.", pt: "$6.100 todo mês." } },
};

const INDUSTRIES = [
  { name: { en: "Clinic / Dental", pt: "Clínica / Dentista", es: "Clínica / Dental", hi: "क्लिनिक / डेंटल" }, base: 5400 },
  { name: { en: "Law Firm", pt: "Advocacia", es: "Bufete de abogados", hi: "लॉ फ़र्म" }, base: 8200 },
  { name: { en: "Real Estate", pt: "Imobiliária", es: "Inmobiliaria", hi: "रियल एस्टेट" }, base: 9200 },
  { name: { en: "Restaurant", pt: "Restaurante", es: "Restaurante", hi: "रेस्टोरेंट" }, base: 3500 },
  { name: { en: "E-commerce / Retail", pt: "E-commerce / Varejo", es: "E-commerce / Retail", hi: "ई-कॉमर्स / रिटेल" }, base: 6100 },
  { name: { en: "Trades (Plumbing/HVAC)", pt: "Serviços (Encanador/HVAC)", es: "Oficios (Plomería/HVAC)", hi: "ट्रेड्स (प्लंबिंग/HVAC)" }, base: 7600 },
  { name: { en: "Gym / Fitness", pt: "Academia / Fitness", es: "Gimnasio / Fitness", hi: "जिम / फ़िटनेस" }, base: 4200 },
  { name: { en: "Auto Dealership", pt: "Concessionária", es: "Concesionaria", hi: "ऑटो डीलरशिप" }, base: 11000 },
  { name: { en: "Agency / Reseller", pt: "Agência / Revenda", es: "Agencia / Reseller", hi: "एजेंसी / रीसेलर" }, base: 0, partner: true },
  { name: { en: "Other / Services", pt: "Outro / Serviços", es: "Otro / Servicios", hi: "अन्य / सेवाएँ" }, base: 5000 },
];

const QUESTIONS = [
  {
    q: { en: "When a customer calls or messages, how fast do you respond?", pt: "Quando um cliente liga ou manda mensagem, em quanto tempo vocês respondem?", es: "Cuando un cliente llama o escribe, ¿qué tan rápido responden?", hi: "जब ग्राहक कॉल या मैसेज करता है, आप कितनी जल्दी जवाब देते हैं?" },
    a: [
      [{ en: "Instantly, 24/7", pt: "Na hora, 24/7", es: "Al instante, 24/7", hi: "तुरंत, 24/7" }, 3],
      [{ en: "Within an hour", pt: "Em até 1 hora", es: "En una hora", hi: "एक घंटे के भीतर" }, 2],
      [{ en: "Same day", pt: "No mesmo dia", es: "El mismo día", hi: "उसी दिन" }, 1],
      [{ en: "We often miss them", pt: "A gente perde muitos", es: "Se nos escapan muchos", hi: "अक्सर छूट जाते हैं" }, 0],
    ],
  },
  {
    q: { en: "Do you follow up with every lead?", pt: "Vocês fazem follow-up com todo lead?", es: "¿Hacen seguimiento a cada lead?", hi: "क्या आप हर लीड का फ़ॉलो-अप करते हैं?" },
    a: [
      [{ en: "Always — automatically", pt: "Sempre — automático", es: "Siempre — automático", hi: "हमेशा — अपने आप" }, 3],
      [{ en: "Usually", pt: "Quase sempre", es: "Casi siempre", hi: "अक्सर" }, 2],
      [{ en: "Sometimes", pt: "Às vezes", es: "A veces", hi: "कभी-कभी" }, 1],
      [{ en: "No real system", pt: "Sem sistema de verdade", es: "Sin sistema real", hi: "कोई असल सिस्टम नहीं" }, 0],
    ],
  },
  {
    q: { en: "How many channels do customers reach you on?", pt: "Em quantos canais os clientes falam com vocês?", es: "¿Por cuántos canales te contactan los clientes?", hi: "ग्राहक कितने चैनलों से आपसे संपर्क करते हैं?" },
    a: [
      [{ en: "All in one place", pt: "Tudo num lugar só", es: "Todo en un solo lugar", hi: "सब एक जगह" }, 3],
      [{ en: "2–3, handled manually", pt: "2–3, na mão", es: "2–3, a mano", hi: "2–3, हाथ से" }, 2],
      [{ en: "Several — it's chaos", pt: "Vários — é um caos", es: "Varios — es un caos", hi: "कई — अफ़रा-तफ़री है" }, 1],
      [{ en: "Can't keep up", pt: "Não dou conta", es: "No doy abasto", hi: "संभल नहीं पाता" }, 0],
    ],
  },
  {
    q: { en: "Hours/week spent on repetitive admin (booking, replies, follow-up)?", pt: "Horas/semana em tarefas repetitivas (agendar, responder, follow-up)?", es: "¿Horas/semana en tareas repetitivas (agendar, responder, seguimiento)?", hi: "दोहराए जाने वाले कामों (बुकिंग, जवाब, फ़ॉलो-अप) में घंटे/सप्ताह?" },
    a: [
      [{ en: "Under 5", pt: "Menos de 5", es: "Menos de 5", hi: "5 से कम" }, 3],
      [{ en: "5–15", pt: "5–15", es: "5–15", hi: "5–15" }, 2],
      [{ en: "15–30", pt: "15–30", es: "15–30", hi: "15–30" }, 1],
      [{ en: "30+", pt: "30+", es: "30+", hi: "30+" }, 0],
    ],
  },
  {
    q: { en: "Is your marketing bringing leads consistently?", pt: "Seu marketing traz leads com consistência?", es: "¿Tu marketing trae leads de forma constante?", hi: "क्या आपकी मार्केटिंग लगातार लीड लाती है?" },
    a: [
      [{ en: "Yes — systemized", pt: "Sim — sistematizado", es: "Sí — sistematizado", hi: "हाँ — सिस्टम से" }, 3],
      [{ en: "On and off", pt: "De vez em quando", es: "A ratos", hi: "कभी हाँ कभी ना" }, 2],
      [{ en: "Rarely", pt: "Raramente", es: "Rara vez", hi: "कभी-कभार" }, 1],
      [{ en: "Not really", pt: "Na real, não", es: "La verdad, no", hi: "सच में नहीं" }, 0],
    ],
  },
];

// what you want Guileo to handle → recommended products/services (covers the full catalog)
// recs stay canonical EN strings (deduped via Set + sent to the API); REC_LABELS localizes the chips.
const NEEDS = [
  { label: { en: "📞 Answer every call & message", pt: "📞 Atender toda ligação & mensagem", es: "📞 Contestar cada llamada y mensaje", hi: "📞 हर कॉल और मैसेज का जवाब" }, recs: ["🎙️ Voice AI", "💬 Text & WhatsApp AI"] },
  { label: { en: "📅 Booking & scheduling", pt: "📅 Agendamentos", es: "📅 Reservas y citas", hi: "📅 बुकिंग और शेड्यूलिंग" }, recs: ["📅 Booking system"] },
  { label: { en: "🔄 Never lose a lead (follow-up)", pt: "🔄 Nunca perder um lead (follow-up)", es: "🔄 No perder ningún lead (seguimiento)", hi: "🔄 कोई लीड न छूटे (फ़ॉलो-अप)" }, recs: ["🔄 Automations", "📊 Dashboards & CRM"] },
  { label: { en: "🌐 Website / app / software", pt: "🌐 Site / app / software", es: "🌐 Web / app / software", hi: "🌐 वेबसाइट / ऐप / सॉफ़्टवेयर" }, recs: ["🌐 Website", "📱 App", "⚙️ Custom software"] },
  { label: { en: "🛒 Sell online", pt: "🛒 Vender online", es: "🛒 Vender en línea", hi: "🛒 ऑनलाइन बेचना" }, recs: ["🛒 E-commerce / Shopify"] },
  { label: { en: "📣 More leads & marketing", pt: "📣 Mais leads & marketing", es: "📣 Más leads y marketing", hi: "📣 ज़्यादा लीड और मार्केटिंग" }, recs: ["📣 Ads & marketing", "📈 Growth & analytics"] },
  { label: { en: "⭐ Reviews & reputation", pt: "⭐ Avaliações & reputação", es: "⭐ Reseñas y reputación", hi: "⭐ रिव्यू और साख" }, recs: ["⭐ Reviews & reputation"] },
  { label: { en: "🚀 Everything — run my whole operation", pt: "🚀 Tudo — cuidar da operação inteira", es: "🚀 Todo — manejar toda mi operación", hi: "🚀 सब कुछ — पूरा ऑपरेशन संभालो" }, recs: ["🎙️ Voice AI", "🌐 Website", "📣 Ads & marketing", "🔄 Automations", "📊 Dashboards & CRM", "⭐ Reviews & reputation"] },
];

const REC_LABELS = {
  "🎙️ Voice AI": { pt: "🎙️ IA de voz", es: "🎙️ IA de voz", hi: "🎙️ वॉइस AI" },
  "💬 Text & WhatsApp AI": { pt: "💬 IA de texto & WhatsApp", es: "💬 IA de texto y WhatsApp", hi: "💬 टेक्स्ट & WhatsApp AI" },
  "📅 Booking system": { pt: "📅 Sistema de agendamento", es: "📅 Sistema de reservas", hi: "📅 बुकिंग सिस्टम" },
  "🔄 Automations": { pt: "🔄 Automações", es: "🔄 Automatizaciones", hi: "🔄 ऑटोमेशन" },
  "📊 Dashboards & CRM": { pt: "📊 Dashboards & CRM", es: "📊 Dashboards y CRM", hi: "📊 डैशबोर्ड & CRM" },
  "🌐 Website": { pt: "🌐 Site", es: "🌐 Web", hi: "🌐 वेबसाइट" },
  "📱 App": { pt: "📱 App", es: "📱 App", hi: "📱 ऐप" },
  "⚙️ Custom software": { pt: "⚙️ Software sob medida", es: "⚙️ Software a medida", hi: "⚙️ कस्टम सॉफ़्टवेयर" },
  "🛒 E-commerce / Shopify": { pt: "🛒 E-commerce / Shopify", es: "🛒 E-commerce / Shopify", hi: "🛒 ई-कॉमर्स / Shopify" },
  "📣 Ads & marketing": { pt: "📣 Anúncios & marketing", es: "📣 Anuncios y marketing", hi: "📣 विज्ञापन & मार्केटिंग" },
  "📈 Growth & analytics": { pt: "📈 Crescimento & analytics", es: "📈 Crecimiento y analítica", hi: "📈 ग्रोथ & एनालिटिक्स" },
  "⭐ Reviews & reputation": { pt: "⭐ Avaliações & reputação", es: "⭐ Reseñas y reputación", hi: "⭐ रिव्यू & साख" },
};

// UI chrome — quadrilingual, per-key { en, pt, es, hi }
const UI = {
  badge: { en: "AI Growth Score · 60 sec", pt: "Score de Crescimento com IA · 60 s", es: "Puntuación de Crecimiento con IA · 60 s", hi: "AI ग्रोथ स्कोर · 60 सेकंड" },
  free60: { en: "Free · 60 seconds", pt: "Grátis · 60 segundos", es: "Gratis · 60 segundos", hi: "मुफ़्त · 60 सेकंड" },
  h1a: { en: "What's your business ", pt: "O que seu negócio está ", es: "¿Qué está perdiendo ", hi: "आपका व्यवसाय क्या " },
  h1b: { en: "leaking?", pt: "vazando?", es: "tu negocio?", hi: "गँवा रहा है?" },
  intro1: { en: "Answer a few quick questions → get your ", pt: "Responda algumas perguntas rápidas → receba seu ", es: "Responde unas preguntas rápidas → recibe tu ", hi: "कुछ झटपट सवालों के जवाब दें → पाएँ अपना " },
  introScore: { en: "AI Growth Score", pt: "Score de Crescimento com IA", es: "Puntuación de Crecimiento con IA", hi: "AI ग्रोथ स्कोर" },
  intro2: { en: ", how much you could recover monthly, and the exact ", pt: ", quanto você pode recuperar por mês, e a ", es: ", cuánto podrías recuperar al mes, y el ", hi: ", हर महीने कितना वापस पा सकते हैं, और आपके लिए सटीक " },
  introStack: { en: "Guileo stack", pt: "stack Guileo", es: "stack Guileo", hi: "Guileo स्टैक" },
  intro3: { en: " for you.", pt: " exata pra você.", es: " exacto para ti.", hi: "।" },
  getScore: { en: "Get my score →", pt: "Quero meu score →", es: "Quiero mi puntuación →", hi: "मेरा स्कोर पाएँ →" },
  nologin: { en: "No login. Instant result.", pt: "Sem login. Resultado na hora.", es: "Sin registro. Resultado al instante.", hi: "कोई लॉगिन नहीं। तुरंत नतीजा।" },
  qIndustry: { en: "What kind of business do you run?", pt: "Que tipo de negócio você tem?", es: "¿Qué tipo de negocio tienes?", hi: "आप किस तरह का व्यवसाय चलाते हैं?" },
  qNeeds: { en: "What do you want Guileo to handle?", pt: "O que você quer que a Guileo cuide?", es: "¿De qué quieres que se encargue Guileo?", hi: "आप Guileo से क्या संभलवाना चाहते हैं?" },
  pickAll: { en: "(pick all)", pt: "(marque todos)", es: "(elige todos)", hi: "(सभी चुनें)" },
  seeResult: { en: "See my result →", pt: "Ver meu resultado →", es: "Ver mi resultado →", hi: "मेरा नतीजा देखें →" },
  yourScore: { en: "Your AI Growth Score", pt: "Seu Score de Crescimento com IA", es: "Tu Puntuación de Crecimiento con IA", hi: "आपका AI ग्रोथ स्कोर" },
  leakLbl: { en: "Estimated leak, every month", pt: "Vazamento estimado, todo mês", es: "Fuga estimada, cada mes", hi: "अनुमानित रिसाव, हर महीने" },
  leakSub: { en: "walking out the door — that Gui can recover.", pt: "saindo pela porta — e a Gui pode recuperar.", es: "saliendo por la puerta — y Gui puede recuperarlo.", hi: "दरवाज़े से बाहर जा रहा है — जिसे Gui वापस ला सकती है।" },
  stackLbl: { en: "Your recommended Guileo stack", pt: "Sua stack Guileo recomendada", es: "Tu stack Guileo recomendado", hi: "आपके लिए सुझाया Guileo स्टैक" },
  partnerName: { en: "Guileo Partner Program", pt: "Programa de Parceiros Guileo", es: "Programa de Socios Guileo", hi: "Guileo पार्टनर प्रोग्राम" },
  partnerBlurb: {
    en: "— resell our AI, websites & marketing white-label. We build & run, you own the client. Leave your contact for partner terms.",
    pt: "— revenda nossa IA, sites e marketing em white-label. A gente constrói e opera, o cliente é seu. Deixe seu contato pra receber as condições de parceria.",
    es: "— revende nuestra IA, webs y marketing en marca blanca. Nosotros construimos y operamos, el cliente es tuyo. Deja tu contacto para las condiciones de socio.",
    hi: "— हमारी AI, वेबसाइट और मार्केटिंग व्हाइट-लेबल में बेचें। हम बनाते और चलाते हैं, क्लाइंट आपका। पार्टनर शर्तों के लिए अपना संपर्क छोड़ें।",
  },
  sentPartner: { en: "Partner request received", pt: "Pedido de parceria recebido", es: "Solicitud de socio recibida", hi: "पार्टनर अनुरोध मिल गया" },
  sentPlan: { en: "Your free plan is on its way", pt: "Seu plano grátis está a caminho", es: "Tu plan gratis está en camino", hi: "आपका मुफ़्त प्लान रास्ते में है" },
  reachPartner: { en: "A real human will reach out shortly with partner terms.", pt: "Uma pessoa de verdade entra em contato em breve com as condições de parceria.", es: "Una persona real te contactará pronto con las condiciones de socio.", hi: "एक असली इंसान जल्द ही पार्टनर शर्तों के साथ संपर्क करेगा।" },
  reachPlan: { en: "A real human will reach out shortly with exactly how to plug these leaks.", pt: "Uma pessoa de verdade entra em contato em breve com exatamente como tampar esses vazamentos.", es: "Una persona real te contactará pronto con exactamente cómo tapar estas fugas.", hi: "एक असली इंसान जल्द ही बताएगा कि ये रिसाव कैसे बंद किए जाएँ।" },
  waNow: { en: "Message us now on WhatsApp →", pt: "Fale com a gente no WhatsApp →", es: "Escríbenos por WhatsApp →", hi: "अभी WhatsApp पर मैसेज करें →" },
  formPartner: { en: "Get partner terms", pt: "Receber condições de parceria", es: "Recibir condiciones de socio", hi: "पार्टनर शर्तें पाएँ" },
  formPlan: { en: "Get your free AI growth plan", pt: "Receba seu plano de crescimento grátis", es: "Recibe tu plan de crecimiento gratis", hi: "अपना मुफ़्त AI ग्रोथ प्लान पाएँ" },
  namePh: { en: "Your name", pt: "Seu nome", es: "Tu nombre", hi: "आपका नाम" },
  contactPh: { en: "WhatsApp, phone or email", pt: "WhatsApp, telefone ou email", es: "WhatsApp, teléfono o correo", hi: "WhatsApp, फ़ोन या ईमेल" },
  btnPartner: { en: "Become a partner →", pt: "Quero ser parceiro →", es: "Quiero ser socio →", hi: "पार्टनर बनें →" },
  btnPlan: { en: "Send me my plan →", pt: "Quero meu plano →", es: "Envíame mi plan →", hi: "मेरा प्लान भेजें →" },
  nospam: { en: "No spam. Live in under 7 days · 30-day money-back.", pt: "Sem spam. No ar em menos de 7 dias · 30 dias de garantia.", es: "Sin spam. En marcha en menos de 7 días · 30 días de garantía.", hi: "कोई स्पैम नहीं। 7 दिनों से कम में लाइव · 30-दिन मनी-बैक।" },
  err: { en: "Please fill in your name and contact.", pt: "Preencha seu nome e contato.", es: "Completa tu nombre y contacto.", hi: "अपना नाम और संपर्क भरें।" },
};

// score tiers, quadrilingual
const TIERS = [
  {
    max: 40, c: "text-[#e0855f]",
    t: { en: "Major leaks", pt: "Vazamentos graves", es: "Fugas graves", hi: "बड़े रिसाव" },
    m: { en: "You're leaving serious money on the table — and it's fixable fast.", pt: "Você está deixando dinheiro de verdade na mesa — e dá pra consertar rápido.", es: "Estás dejando dinero de verdad sobre la mesa — y se arregla rápido.", hi: "आप सच में पैसा मेज़ पर छोड़ रहे हैं — और यह जल्दी ठीक हो सकता है।" },
  },
  {
    max: 70, c: "text-g-gold",
    t: { en: "Solid — with gaps", pt: "Sólido — com brechas", es: "Sólido — con huecos", hi: "ठोस — पर कमियाँ हैं" },
    m: { en: "You're doing well; Gui can plug the leaks and compound it.", pt: "Você vai bem; a Gui tampa os vazamentos e multiplica.", es: "Vas bien; Gui tapa las fugas y lo multiplica.", hi: "आप अच्छा कर रहे हैं; Gui रिसाव बंद कर इसे कई गुना करेगी।" },
  },
  {
    max: 100, c: "text-g-green",
    t: { en: "Strong", pt: "Forte", es: "Fuerte", hi: "मज़बूत" },
    m: { en: "You're ahead — Gui can take you even further, on autopilot.", pt: "Você está na frente — a Gui te leva ainda mais longe, no automático.", es: "Vas adelante — Gui te lleva aún más lejos, en automático.", hi: "आप आगे हैं — Gui आपको ऑटोपायलट पर और आगे ले जाएगी।" },
  },
];

const fmt = (n) => "$" + Math.round(n / 50) * 50;
const NEEDS_STEP = QUESTIONS.length + 1; // 6

export default function Quiz() {
  const { lang } = useLang();
  const L = (o) => (o && (o[lang] ?? o.en)) ?? "";
  const u = (k) => L(UI[k]);
  const stepLbl = (n, tot) =>
    lang === "pt" ? `Passo ${n} de ${tot}` : lang === "es" ? `Paso ${n} de ${tot}` : lang === "hi" ? `चरण ${n} / ${tot}` : `Step ${n} of ${tot}`;
  const recLabel = (s) => (REC_LABELS[s] && REC_LABELS[s][lang]) || s;
  useSeo({
    title: lang === "pt" ? "Score de Crescimento com IA — quiz grátis em 2 minutos" : lang === "es" ? "Puntuación de Crecimiento con IA — quiz gratis de 2 minutos" : lang === "hi" ? "AI ग्रोथ स्कोर — 2 मिनट का मुफ़्त क्विज़" : "AI Growth Score — Free 2-Minute Business Quiz",
    description: lang === "pt" ? "Responda 5 perguntas e descubra seu Score de Crescimento com IA: quanto você perde por mês em leads e a stack Guileo recomendada pro seu negócio. Grátis, 2 minutos." : lang === "es" ? "Responde 5 preguntas y descubre tu Puntuación de Crecimiento con IA: cuánto pierdes al mes en leads y el stack Guileo recomendado para tu negocio. Gratis, 2 minutos." : lang === "hi" ? "5 सवालों के जवाब दें और पाएँ अपना AI ग्रोथ स्कोर: हर महीने कितने लीड्स में कितना खोते हैं और आपके व्यवसाय के लिए सुझाया Guileo स्टैक। मुफ़्त, 2 मिनट।" : "Answer 5 questions to get your AI Growth Score: how much revenue you leak each month and the Guileo stack recommended for your business. Free, takes 2 minutes.",
    path: "/quiz",
  });
  const [step, setStep] = useState(-1); // -1 intro · 0 industry · 1..5 Qs · 6 needs · 99 result
  // Ad message-match: personalize the hero to the vertical of the ad that was clicked.
  const [adm] = useState(() => {
    try { return AD_MATCH[new URLSearchParams(window.location.search).get("utm_content")] || null; } catch { return null; }
  });
  const admL = lang === "pt" ? "pt" : "en"; // es/hi fall back to EN (ads are EN)
  const [ind, setInd] = useState(null);
  const [ans, setAns] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [lead, setLead] = useState({ name: "", contact: "" });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(false); // a11y: true when submit fails validation
  const errText = u("err");

  const total = QUESTIONS.length;
  const partner = INDUSTRIES[ind]?.partner;
  const score = ans.reduce((s, v) => s + (v ?? 0), 0);
  const readiness = Math.round((score / (total * 3)) * 100);
  const base = INDUSTRIES[ind]?.base || 5000;
  const leak = Math.max(300, Math.round(base * (1 - readiness / 100)));
  const stack = [...new Set(needs.flatMap((i) => NEEDS[i].recs))];
  const tier = TIERS.find((x) => readiness <= x.max) || TIERS[TIERS.length - 1];

  function pick(points) {
    const next = [...ans]; next[step - 1] = points; setAns(next);
    setStep(step < total ? step + 1 : NEEDS_STEP);
  }
  function toggleNeed(i) { setNeeds((n) => (n.includes(i) ? n.filter((x) => x !== i) : [...n, i])); }
  async function submit(e) {
    e.preventDefault();
    if (!lead.name || !lead.contact) { setErr(true); return; }
    setErr(false);
    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lead, lang, industry: INDUSTRIES[ind]?.name.en, score: readiness, leak, message: (partner ? "PARTNER · " : "") + "wants: " + stack.join(", "), source: partner ? "quiz-partner" : "ai-growth-quiz" }) }); } catch { /* graceful */ }
    setSent(true);
  }
  const progress = step < 0 ? 0 : step === 99 ? 100 : Math.round((step / (total + 2)) * 100);

  return (
    <div className="min-h-screen text-g-word">
      <style>{`@keyframes qfade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes qshine{to{background-position:220% center}}`}</style>
      <div className="flex items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="font-black">Guileo</span></a>
        <span className="text-[11px] font-bold uppercase tracking-wider text-g-muted">{u("badge")}</span>
      </div>
      <div className="h-1 w-full bg-white/5"><div className="h-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-500" style={{ width: `${progress}%` }} /></div>

      <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center px-5 py-12">
        {step === -1 && (
          <div key="intro" style={{ animation: "qfade .5s ease both" }} className="text-center">
            <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{u("free60")}</div>
            <h1 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2.2rem,6vw,3.4rem)" }}>
              <span className="text-g-word">{adm ? adm.h1a[admL] : u("h1a")}</span>
              <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "qshine 7s linear infinite" }}>{adm ? adm.h1b[admL] : u("h1b")}</span>
            </h1>
            {adm && <p className="mt-2 text-[13.5px] font-semibold text-g-green">{lang === "pt" ? "Veja em 2 minutos como parar o vazamento ↓" : "See how to stop the leak — 2 minutes ↓"}</p>}
            <p className="mx-auto mt-4 max-w-md text-[15px] text-g-ink">{u("intro1")}<span className="font-semibold text-g-word">{u("introScore")}</span>{u("intro2")}<span className="font-semibold text-g-green">{u("introStack")}</span>{u("intro3")}</p>
            <button onClick={() => setStep(0)} className="mt-8 rounded-full bg-gradient-to-r from-g-green to-g-dark px-8 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110">{u("getScore")}</button>
            <div className="mt-4 text-[12px] text-g-muted">{u("nologin")}</div>
          </div>
        )}

        {step === 0 && (
          <div key="ind" style={{ animation: "qfade .4s ease both" }}>
            <div className="text-[12px] font-bold text-g-muted">{stepLbl(1, total + 2)}</div>
            <h2 className="mt-2 text-[24px] font-bold text-g-word">{u("qIndustry")}</h2>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {INDUSTRIES.map((x, i) => (
                <button key={x.name.en} onClick={() => { setInd(i); setStep(1); }} className={`rounded-xl border px-4 py-3 text-left text-[14px] font-semibold transition hover:-translate-y-0.5 hover:border-g-green/40 hover:bg-white/[0.06] ${adm && adm.ind === i ? "border-g-green/60 bg-g-green/[0.10] text-g-word ring-1 ring-g-green/40" : x.partner ? "border-g-gold/40 bg-g-gold/[0.06] text-g-gold" : "border-g-line bg-white/[0.03] text-g-ink"}`}>{L(x.name)}{adm && adm.ind === i ? " ✓" : ""}</button>
              ))}
            </div>
          </div>
        )}

        {step >= 1 && step <= total && (
          <div key={`q${step}`} style={{ animation: "qfade .4s ease both" }}>
            <div className="text-[12px] font-bold text-g-muted">{stepLbl(step + 1, total + 2)}</div>
            <h2 className="mt-2 text-[24px] font-bold leading-snug text-g-word">{L(QUESTIONS[step - 1].q)}</h2>
            <div className="mt-5 space-y-2.5">
              {QUESTIONS[step - 1].a.map(([label, pts]) => (
                <button key={label.en} onClick={() => pick(pts)} className="flex w-full items-center justify-between rounded-xl border border-g-line bg-white/[0.03] px-4 py-3.5 text-left text-[15px] font-semibold text-g-ink transition hover:-translate-y-0.5 hover:border-g-green/40 hover:bg-white/[0.06]">
                  {L(label)} <span className="text-g-green">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NEEDS — drives the recommended stack (all products/services) */}
        {step === NEEDS_STEP && (
          <div key="needs" style={{ animation: "qfade .4s ease both" }}>
            <div className="text-[12px] font-bold text-g-muted">{stepLbl(total + 2, total + 2)}</div>
            <h2 className="mt-2 text-[24px] font-bold leading-snug text-g-word">{u("qNeeds")} <span className="text-g-muted">{u("pickAll")}</span></h2>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {NEEDS.map((n, i) => {
                const on = needs.includes(i);
                return (
                  <button key={n.label.en} onClick={() => toggleNeed(i)} className={`rounded-xl border px-4 py-3.5 text-left text-[14px] font-semibold transition ${on ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line bg-white/[0.03] text-g-ink hover:bg-white/[0.06]"}`}>
                    <span className="mr-1">{on ? "✓" : ""}</span>{L(n.label)}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(99)} disabled={!needs.length} className="mt-6 w-full rounded-full bg-gradient-to-r from-g-green to-g-dark px-8 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110 disabled:opacity-50">{u("seeResult")}</button>
          </div>
        )}

        {step === 99 && (
          <div key="res" style={{ animation: "qfade .5s ease both" }} className="text-center">
            <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{u("yourScore")}</div>
            <div className="mt-3 text-[64px] font-black leading-none">
              <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{readiness}<span className="text-[28px]">/100</span></span>
            </div>
            <div className={`mt-2 text-[18px] font-bold ${tier.c}`}>{L(tier.t)}</div>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-g-ink">{L(tier.m)}</p>

            {!partner && (
              <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#d8916e]/30 bg-[#d8916e]/[0.06] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8916e]">{u("leakLbl")}</div>
                <div className="mt-1 text-[40px] font-black text-[#e0855f]">{fmt(leak)}</div>
                <div className="text-[13px] text-g-muted">{u("leakSub")}</div>
              </div>
            )}

            {/* recommended stack */}
            {stack.length > 0 && (
              <div className="mx-auto mt-5 max-w-md rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-g-green">{u("stackLbl")}</div>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {stack.map((c) => <span key={c} className="rounded-full border border-g-green/30 bg-white/[0.04] px-3 py-1 text-[12.5px] font-semibold text-g-word">{recLabel(c)}</span>)}
                </div>
              </div>
            )}

            {partner && (
              <div className="mx-auto mt-5 max-w-md rounded-2xl border border-g-gold/40 bg-g-gold/[0.07] p-5 text-[14px] text-g-ink">
                🤝 <span className="font-bold text-g-word">{u("partnerName")}</span> {u("partnerBlurb")}
              </div>
            )}

            {sent ? (
              <div className="mx-auto mt-6 max-w-md rounded-2xl border border-g-green/30 bg-g-green/[0.07] p-6">
                <div className="text-3xl">🌱</div>
                <div className="mt-2 text-[17px] font-bold text-g-word">{partner ? u("sentPartner") : u("sentPlan")}, {lead.name.split(" ")[0]}!</div>
                <p className="mt-1 text-[13.5px] text-g-ink">{partner ? u("reachPartner") : u("reachPlan")}</p>
                <a href={waLink("Hi Guileo! I just took the AI Growth Score quiz.")} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[13px] font-bold text-g-green">{u("waNow")}</a>
              </div>
            ) : (
              <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-3 rounded-2xl border border-g-line bg-white/[0.04] p-6 text-left">
                <div className="text-center text-[15px] font-bold text-g-word">{partner ? u("formPartner") : u("formPlan")}</div>
                <input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} required placeholder={u("namePh")} aria-label={u("namePh")} aria-invalid={err && !lead.name} aria-describedby={err && !lead.name ? "quiz-err" : undefined} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
                <input value={lead.contact} onChange={(e) => setLead({ ...lead, contact: e.target.value })} required placeholder={u("contactPh")} aria-label={u("contactPh")} aria-invalid={err && !lead.contact} aria-describedby={err && !lead.contact ? "quiz-err" : undefined} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
                {err && <p id="quiz-err" role="alert" className="text-center text-[12.5px] font-semibold text-g-gold">{errText}</p>}
                <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110">{partner ? u("btnPartner") : u("btnPlan")}</button>
                <p className="text-center text-[11px] text-g-muted">{u("nospam")}</p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
