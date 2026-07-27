// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGNS — data-driven paid-traffic landing pages (/lp/:slug), rendered by
// src/pages/CampaignLP.jsx. One ad = one lean page: pain-first headline → gain,
// proof (30-day money-back + a real human supervises), ONE dominant CTA (the live
// demo that CALLS the visitor), a 3-step how-it-works, and the $149 price anchor.
//
// HONESTY RULE: every bullet is a paraphrase of a fact in functions/lib/productFacts.js
// (FACTS.coreFeatures / plans / delivery / guarantees). Nothing here promises what the
// product doesn't do. Change the product → change productFacts.js, then mirror it here.
//
// Each campaign carries a DEFAULT language (the ad's language) — CampaignLP applies it
// on arrival unless the URL passes an explicit ?lang= override. All copy still ships in
// the 4 UI languages (EN·PT·ES·HI) so the flag switcher keeps working on the page.
// ─────────────────────────────────────────────────────────────────────────────

export const CAMPAIGNS = {
  // 1 ─ Restaurants losing orders (PT) ──────────────────────────────────────
  "restaurantes-perdendo-pedidos": {
    slug: "restaurantes-perdendo-pedidos",
    vertical: "restaurants",
    lang: "pt",
    icon: "🍕",
    headline: {
      pt: "Cada ligação que toca ocupado é um pedido que foi pro concorrente.",
      en: "Every call that hits a busy signal is an order that went to your competitor.",
      es: "Cada llamada que suena ocupada es un pedido que se fue a tu competencia.",
      hi: "हर व्यस्त कॉल एक ऑर्डर है जो आपके प्रतिस्पर्धी के पास चला गया।",
    },
    sub: {
      pt: "A Gui atende todas as ligações do seu restaurante ao mesmo tempo, anota o pedido e agenda — 24 horas, sem nunca dar ocupado.",
      en: "Gui answers every call to your restaurant at once, takes the order and books it — 24/7, and never a busy signal.",
      es: "Gui contesta todas las llamadas de tu restaurante a la vez, toma el pedido y lo agenda — 24/7, sin dar ocupado nunca.",
      hi: "Gui आपके रेस्तरां की हर कॉल एक साथ उठाती है, ऑर्डर लेती है और बुक करती है — 24/7, कभी व्यस्त नहीं।",
    },
    cta: {
      pt: "Deixe a Gui te ligar agora", en: "Let Gui call you now",
      es: "Deja que Gui te llame ahora", hi: "Gui को अभी कॉल करने दें",
    },
    bullets: ["answers-247", "missed-callback", "close-collect"],
  },

  // 2 ─ Missed calls, restaurants (EN) ──────────────────────────────────────
  "missed-calls-restaurants": {
    slug: "missed-calls-restaurants",
    vertical: "restaurants",
    lang: "en",
    icon: "📞",
    headline: {
      en: "The calls you miss at dinner rush are the money you never see.",
      pt: "As ligações que você perde na correria são o dinheiro que você nunca vê.",
      es: "Las llamadas que pierdes en la hora pico son el dinero que nunca ves.",
      hi: "व्यस्त समय में छूटी कॉलें वह पैसा हैं जो आपको कभी नहीं दिखता।",
    },
    sub: {
      en: "Gui picks up every call and message, texts back the ones you missed and calls the customer straight back — so nothing slips while your kitchen is slammed.",
      pt: "A Gui atende toda ligação e mensagem, responde por texto as que você perdeu e liga o cliente de volta — nada escapa enquanto a cozinha ferve.",
      es: "Gui contesta cada llamada y mensaje, responde por texto las que perdiste y devuelve la llamada al cliente — nada se escapa mientras la cocina hierve.",
      hi: "Gui हर कॉल और संदेश उठाती है, छूटी कॉलों को टेक्स्ट करती है और ग्राहक को वापस कॉल करती है — रसोई व्यस्त हो तो भी कुछ नहीं छूटता।",
    },
    cta: {
      en: "Let Gui call you now", pt: "Deixe a Gui te ligar agora",
      es: "Deja que Gui te llame ahora", hi: "Gui को अभी कॉल करने दें",
    },
    bullets: ["missed-callback", "answers-247", "speed-to-lead"],
  },

  // 3 ─ Clinics & no-shows (PT) ─────────────────────────────────────────────
  "clinicas-no-show": {
    slug: "clinicas-no-show",
    vertical: "medical-clinics",
    lang: "pt",
    icon: "🩺",
    headline: {
      pt: "Cada falta na agenda é uma cadeira vazia que você pagou pra ficar parada.",
      en: "Every no-show is an empty chair you paid to keep sitting idle.",
      es: "Cada ausencia es una silla vacía que pagaste para que quede parada.",
      hi: "हर गैर-हाज़िरी एक खाली कुर्सी है जिसके खाली रहने का दाम आप चुकाते हैं।",
    },
    sub: {
      pt: "A Gui marca com proteção contra choque de horário e manda lembretes automáticos — cortando as faltas em cerca de 40% e ainda avisando quais consultas correm risco antes de acontecer.",
      en: "Gui books with double-booking protection and sends automatic reminders — cutting no-shows by about 40% and flagging which appointments are at risk before they happen.",
      es: "Gui agenda con protección contra choques de horario y envía recordatorios automáticos — reduciendo las ausencias cerca de 40% y avisando qué citas están en riesgo antes de que pasen.",
      hi: "Gui डबल-बुकिंग सुरक्षा के साथ बुक करती है और स्वचालित रिमाइंडर भेजती है — गैर-हाज़िरी लगभग 40% घटाती है और पहले ही बताती है कौन-सी अपॉइंटमेंट जोखिम में हैं।",
    },
    cta: {
      pt: "Deixe a Gui te ligar agora", en: "Let Gui call you now",
      es: "Deja que Gui te llame ahora", hi: "Gui को अभी कॉल करने दें",
    },
    bullets: ["book-reminders", "noshow-radar", "answers-247"],
  },

  // 4 ─ Clinics & no-shows (EN) ─────────────────────────────────────────────
  "no-show-clinics": {
    slug: "no-show-clinics",
    vertical: "medical-clinics",
    lang: "en",
    icon: "🗓️",
    headline: {
      en: "A no-show costs you the slot, the reminder and the patient — all at once.",
      pt: "Uma falta te custa o horário, o lembrete e o paciente — tudo de uma vez.",
      es: "Una ausencia te cuesta el turno, el recordatorio y el paciente — todo a la vez.",
      hi: "एक गैर-हाज़िरी आपसे स्लॉट, रिमाइंडर और मरीज़ — तीनों एक साथ छीन लेती है।",
    },
    sub: {
      en: "Gui books with double-booking protection, sends automatic reminders and risk-scores every upcoming visit — so your calendar fills and stays full.",
      pt: "A Gui marca com proteção contra sobreposição, envia lembretes automáticos e pontua o risco de cada consulta — sua agenda enche e continua cheia.",
      es: "Gui agenda con protección contra solapamientos, envía recordatorios automáticos y puntúa el riesgo de cada visita — tu agenda se llena y se mantiene llena.",
      hi: "Gui डबल-बुकिंग सुरक्षा के साथ बुक करती है, स्वचालित रिमाइंडर भेजती है और हर आने वाली विज़िट का जोखिम आँकती है — आपका कैलेंडर भरता है और भरा रहता है।",
    },
    cta: {
      en: "Let Gui call you now", pt: "Deixe a Gui te ligar agora",
      es: "Deja que Gui te llame ahora", hi: "Gui को अभी कॉल करने दें",
    },
    bullets: ["book-reminders", "noshow-radar", "missed-callback"],
  },

  // 5 ─ Home services, speed-to-lead (EN) ───────────────────────────────────
  "home-services-speed": {
    slug: "home-services-speed",
    vertical: "plumbing-hvac",
    lang: "en",
    icon: "🔧",
    headline: {
      en: "The first contractor to call back wins the job. That's always Gui.",
      pt: "O primeiro que liga de volta ganha o serviço. Esse é sempre a Gui.",
      es: "El primero que devuelve la llamada gana el trabajo. Ese siempre es Gui.",
      hi: "जो पहले वापस कॉल करता है वही काम जीतता है। वह हमेशा Gui है।",
    },
    sub: {
      en: "Gui calls a brand-new lead back in about 60 seconds, answers every job that comes in 24/7 and even routes a real 2am emergency straight to your phone.",
      pt: "A Gui liga um lead novo de volta em cerca de 60 segundos, atende todo serviço que chega 24/7 e ainda manda uma emergência de verdade às 2h direto pro seu celular.",
      es: "Gui devuelve la llamada a un lead nuevo en unos 60 segundos, atiende cada trabajo que entra 24/7 y hasta enruta una emergencia real de las 2am directo a tu teléfono.",
      hi: "Gui नए लीड को लगभग 60 सेकंड में वापस कॉल करती है, आने वाले हर काम को 24/7 उठाती है और रात 2 बजे की असली इमरजेंसी सीधे आपके फ़ोन पर भेजती है।",
    },
    cta: {
      en: "Let Gui call you now", pt: "Deixe a Gui te ligar agora",
      es: "Deja que Gui te llame ahora", hi: "Gui को अभी कॉल करने दें",
    },
    bullets: ["speed-to-lead", "answers-247", "emergency-dispatch"],
  },

  // 6 ─ Salon, full calendar (PT) ───────────────────────────────────────────
  "salao-agenda-cheia": {
    slug: "salao-agenda-cheia",
    vertical: "salons-spas",
    lang: "pt",
    icon: "💇",
    headline: {
      pt: "Você não pode parar de atender pra atender o telefone. A Gui pode.",
      en: "You can't stop serving clients to answer the phone. Gui can.",
      es: "No puedes dejar de atender clientes para contestar el teléfono. Gui sí.",
      hi: "आप ग्राहक छोड़कर फ़ोन नहीं उठा सकते। Gui उठा सकती है।",
    },
    sub: {
      pt: "A Gui atende, marca com lembrete automático e fecha o horário cobrando o depósito na hora — sua cadeira lota enquanto suas mãos ficam no cliente.",
      en: "Gui answers, books with automatic reminders and closes the slot by collecting the deposit on the spot — your chair fills while your hands stay on the client.",
      es: "Gui contesta, agenda con recordatorio automático y cierra el turno cobrando el depósito al instante — tu silla se llena mientras tus manos siguen en el cliente.",
      hi: "Gui जवाब देती है, स्वचालित रिमाइंडर के साथ बुक करती है और मौके पर डिपॉज़िट लेकर स्लॉट पक्का करती है — आपकी कुर्सी भरती है जबकि आपके हाथ ग्राहक पर रहते हैं।",
    },
    cta: {
      pt: "Deixe a Gui te ligar agora", en: "Let Gui call you now",
      es: "Deja que Gui te llame ahora", hi: "Gui को अभी कॉल करने दें",
    },
    bullets: ["answers-247", "book-reminders", "close-collect"],
  },
};

// Shared gain bullets — each is a faithful paraphrase of a fact in productFacts.js.
// Campaigns reference them by key so wording stays consistent and honest across pages.
export const CAMPAIGN_BULLETS = {
  "answers-247": {
    icon: "📞",
    en: "Answers every call & message 24/7 — unlimited at once, never a busy signal",
    pt: "Atende toda ligação e mensagem 24/7 — várias ao mesmo tempo, nunca ocupado",
    es: "Contesta cada llamada y mensaje 24/7 — muchas a la vez, nunca ocupado",
    hi: "हर कॉल और संदेश 24/7 उठाती है — एक साथ असीमित, कभी व्यस्त नहीं",
  },
  "book-reminders": {
    icon: "📅",
    en: "Books with double-booking protection + reminders — cuts no-shows ~40%",
    pt: "Marca com proteção contra sobreposição + lembretes — corta faltas ~40%",
    es: "Agenda con protección de solapamiento + recordatorios — reduce ausencias ~40%",
    hi: "डबल-बुकिंग सुरक्षा + रिमाइंडर के साथ बुक करती है — गैर-हाज़िरी ~40% घटाती है",
  },
  "noshow-radar": {
    icon: "🎯",
    en: "Predictive no-show radar — risk-scores upcoming bookings so you can act early",
    pt: "Radar preditivo de faltas — pontua o risco das próximas marcações pra agir cedo",
    es: "Radar predictivo de ausencias — puntúa el riesgo de las próximas citas para actuar antes",
    hi: "पूर्वानुमानित नो-शो रडार — आने वाली बुकिंग का जोखिम आँकता है ताकि आप जल्दी कदम उठाएँ",
  },
  "missed-callback": {
    icon: "↩️",
    en: "Missed-call instant text-back + busy→auto-callback — no lead left cold",
    pt: "Texto instantâneo em ligação perdida + ocupado→retorno automático — nenhum lead esfria",
    es: "Texto instantáneo en llamada perdida + ocupado→devolución automática — ningún lead se enfría",
    hi: "छूटी कॉल पर तुरंत टेक्स्ट + व्यस्त→स्वतः वापस कॉल — कोई लीड ठंडा नहीं पड़ता",
  },
  "speed-to-lead": {
    icon: "⚡",
    en: "Speed-to-lead: calls a brand-new lead back in about 60 seconds",
    pt: "Speed-to-lead: liga um lead novo de volta em cerca de 60 segundos",
    es: "Speed-to-lead: devuelve la llamada a un lead nuevo en unos 60 segundos",
    hi: "स्पीड-टू-लीड: नए लीड को लगभग 60 सेकंड में वापस कॉल करती है",
  },
  "close-collect": {
    icon: "💳",
    en: "Quotes exact prices and closes & collects on the call — money to your own Stripe",
    pt: "Cota preços exatos e fecha & cobra na ligação — dinheiro no seu próprio Stripe",
    es: "Cotiza precios exactos y cierra & cobra en la llamada — dinero a tu propio Stripe",
    hi: "सटीक दाम बताती है और कॉल पर सौदा तय कर भुगतान लेती है — पैसा आपके अपने Stripe में",
  },
  "emergency-dispatch": {
    icon: "🚨",
    en: "Emergency dispatch: a real 2am emergency rings your phone, with an in-portal log",
    pt: "Despacho de emergência: uma emergência real às 2h faz seu celular tocar, com registro no portal",
    es: "Despacho de emergencia: una emergencia real a las 2am hace sonar tu teléfono, con registro en el portal",
    hi: "इमरजेंसी डिस्पैच: रात 2 बजे की असली इमरजेंसी आपके फ़ोन को बजाती है, पोर्टल लॉग के साथ",
  },
};

export function getCampaign(slug) {
  return CAMPAIGNS[slug] || null;
}

export const CAMPAIGN_SLUGS = Object.keys(CAMPAIGNS);
