// ============================================================================
// productSystem.js — THE single source of truth that turns Guileo's products &
// services into ONE integrated SYSTEM. Every surface reads from here, so a product
// is defined ONCE and shows up consistently in: the landing (result-forward cards),
// the pricing calculator (credits math + plan inclusion), and the activations map
// (which external key each product needs to light up).
//
// WHY THIS EXISTS (Luis, 2026-07-23): "produtos e serviços totalmente integrados como
// sistema — cálculos, números, ativações, tudo. E mostrar o RESULTADO do produto, não
// só o nome." One product, one record, every surface in sync.
//
// HONESTY RULE (repo law): result copy mirrors the APPROVED numbers in serviceCatalog.js.
//   resultIsEstimate:true  → the surface must render the "market estimate by sector" caption.
//   credits = the platform's own cost model (~5 cr / spoken task) — a product spec, not a
//   market claim. activationKey = the external key from Broto ACTIV_KEYS (null = always-on).
//   plans = which GUILEO_PLANS keys (starter/growth/scale) include this product.
// ============================================================================

// Credit cost model — what one unit of each product action spends. Modest + honest;
// the meter is the finance engine's source (see MOTORES.md). Spoken minute ≈ 5 cr.
export const CREDIT_COST = { call: 5, sms: 1, email: 1, chat: 2, post: 3, review_reply: 1, booking: 2 };

// The product system. `resultMetric` is the punchy, VISUAL headline number/label the
// landing shows big; `result`/`resultIsEstimate` carry the full approved claim + caption.
export const PRODUCTS = [
  {
    id: "answering", icon: "📞", accent: "#FF8A33", category: { en: "Answering", pt: "Atendimento", es: "Atención", hi: "कॉल" },
    name: { en: "24/7 AI Reception", pt: "Recepção IA 24/7", es: "Recepción IA 24/7", hi: "24/7 AI रिसेप्शन" },
    result: {
      en: "~30% of calls to local businesses go unanswered — recover $2,000–11,000/mo depending on your sector.",
      pt: "~30% das ligações pra negócios locais ficam sem resposta — recupere US$ 2.000–11.000/mês conforme o setor.",
      es: "~30% de las llamadas a negocios locales quedan sin respuesta — recupera $2,000–11,000/mes según tu sector.",
      hi: "लोकल बिज़नेस की ~30% कॉल्स अनुत्तरित रहती हैं — सेक्टर अनुसार $2,000–11,000/माह वापस पाएँ।",
    },
    resultMetric: { value: "+$2k–11k", unit: { en: "/mo recovered", pt: "/mês recuperado", es: "/mes recuperado", hi: "/माह वापस" } },
    resultIsEstimate: true, credits: "call", activationKey: null, plans: ["starter", "growth", "scale"],
  },
  {
    id: "speedlead", icon: "⚡", accent: "#4C9AFF", category: { en: "Sales", pt: "Vendas", es: "Ventas", hi: "सेल्स" },
    name: { en: "Speed-to-Lead 60s", pt: "Resposta ao Lead em 60s", es: "Respuesta al Lead en 60s", hi: "60s में लीड जवाब" },
    result: {
      en: "Leads contacted within 5 min are up to 21× more likely to convert — Gui calls in ~60 seconds.",
      pt: "Leads contatados em até 5 min convertem até 21× mais — a Gui liga em ~60 segundos.",
      es: "Leads contactados en 5 min convierten hasta 21× más — Gui llama en ~60 segundos.",
      hi: "5 मिनट में संपर्क किए लीड 21× ज़्यादा कन्वर्ट होते हैं — गुई ~60 सेकंड में कॉल करती है।",
    },
    resultMetric: { value: "21×", unit: { en: "more conversions", pt: "mais conversões", es: "más conversiones", hi: "ज़्यादा कन्वर्ज़न" } },
    resultIsEstimate: true, credits: "call", activationKey: null, plans: ["growth", "scale"],
  },
  {
    id: "noshow", icon: "🛡️", accent: "#3E9468", category: { en: "Bookings", pt: "Agenda", es: "Agenda", hi: "बुकिंग" },
    name: { en: "No-show Shield", pt: "Escudo Anti-falta", es: "Escudo Anti-ausencia", hi: "नो-शो शील्ड" },
    result: {
      en: "Deposit-to-book + predictive reminders cut no-shows that cost service businesses 10–20% of revenue.",
      pt: "Depósito pra agendar + lembretes preditivos cortam as faltas que custam 10–20% da receita.",
      es: "Depósito para reservar + recordatorios predictivos cortan las ausencias que cuestan 10–20% de ingresos.",
      hi: "बुकिंग पर डिपॉज़िट + प्रेडिक्टिव रिमाइंडर नो-शो घटाते हैं जो 10–20% रेवेन्यू खाते हैं।",
    },
    resultMetric: { value: "−10–20%", unit: { en: "no-shows", pt: "faltas", es: "ausencias", hi: "नो-शो" } },
    resultIsEstimate: true, credits: "sms", activationKey: "stripe", plans: ["starter", "growth", "scale"],
  },
  {
    id: "reactivation", icon: "♻️", accent: "#FF4FA3", category: { en: "Growth", pt: "Crescimento", es: "Crecimiento", hi: "ग्रोथ" },
    name: { en: "Reactivation & Churn-save", pt: "Reativação e Anti-churn", es: "Reactivación & Anti-churn", hi: "रीएक्टिवेशन" },
    result: {
      en: "Gui spots loyal customers about to vanish — by their own rhythm — and brings them back before you lose them.",
      pt: "A Gui vê o cliente fiel prestes a sumir — pelo ritmo dele — e traz de volta antes de você perder.",
      es: "Gui detecta al cliente fiel a punto de irse — por su propio ritmo — y lo trae de vuelta.",
      hi: "गुई वफ़ादार ग्राहक को खोने से पहले पहचानती है और वापस लाती है।",
    },
    resultMetric: { value: "5×", unit: { en: "cheaper than new", pt: "mais barato que novo", es: "más barato que nuevo", hi: "नए से सस्ता" } },
    resultIsEstimate: true, credits: "email", activationKey: null, plans: ["growth", "scale"],
  },
  {
    id: "reputation", icon: "⭐", accent: "#FFC23D", category: { en: "Reputation", pt: "Reputação", es: "Reputación", hi: "प्रतिष्ठा" },
    name: { en: "Reputation Machine", pt: "Máquina de Reputação", es: "Máquina de Reputación", hi: "रेपुटेशन मशीन" },
    result: {
      en: "Reviews requested & answered in your tone — every extra half-star can lift revenue meaningfully in local search.",
      pt: "Avaliações pedidas e respondidas no seu tom — cada meia-estrela a mais pesa na busca local.",
      es: "Reseñas pedidas y respondidas en tu tono — cada media estrella extra pesa en la búsqueda local.",
      hi: "आपके टोन में रिव्यू माँगे व जवाब दिए — हर आधा स्टार लोकल सर्च में मायने रखता है।",
    },
    resultMetric: { value: "+★", unit: { en: "higher local rank", pt: "rank local maior", es: "ranking local", hi: "लोकल रैंक" } },
    resultIsEstimate: false, credits: "review_reply", activationKey: "google", plans: ["growth", "scale"],
  },
  {
    id: "content", icon: "🎬", accent: "#B37DFF", category: { en: "Marketing", pt: "Marketing", es: "Marketing", hi: "मार्केटिंग" },
    name: { en: "Content Autopilot", pt: "Conteúdo no Piloto", es: "Contenido en Piloto", hi: "कंटेंट ऑटोपायलट" },
    result: {
      en: "4 on-brand posts a week — your social never sleeps, so new customers keep finding you.",
      pt: "4 posts na sua marca por semana — sua rede nunca dorme e novos clientes te acham.",
      es: "4 posts de tu marca por semana — tu red nunca duerme y llegan nuevos clientes.",
      hi: "हफ़्ते में 4 ब्रांड पोस्ट — आपका सोशल कभी नहीं सोता।",
    },
    resultMetric: { value: "16", unit: { en: "posts/mo, hands-off", pt: "posts/mês, sem esforço", es: "posts/mes, sin esfuerzo", hi: "पोस्ट/माह" } },
    resultIsEstimate: false, credits: "post", activationKey: "meta", plans: ["scale"],
  },
  {
    id: "multilingual", icon: "🌎", accent: "#33C6D6", category: { en: "Reach", pt: "Alcance", es: "Alcance", hi: "पहुँच" },
    name: { en: "Multilingual Voice", pt: "Voz Multilíngue", es: "Voz Multilingüe", hi: "बहुभाषी वॉइस" },
    result: {
      en: "Gui answers each caller in their own language (16) — your whole neighborhood becomes your market.",
      pt: "A Gui atende cada cliente no idioma dele (16) — o bairro inteiro vira seu mercado.",
      es: "Gui atiende a cada cliente en su idioma (16) — todo tu vecindario es tu mercado.",
      hi: "गुई हर कॉलर को उसकी भाषा (16) में जवाब देती है — पूरा मोहल्ला आपका बाज़ार।",
    },
    resultMetric: { value: "16", unit: { en: "languages, one warmth", pt: "idiomas, um só carinho", es: "idiomas, una calidez", hi: "भाषाएँ" } },
    resultIsEstimate: false, credits: "call", activationKey: null, plans: ["starter", "growth", "scale"],
  },
  {
    id: "pulse", icon: "💗", accent: "#FF6B9D", category: { en: "Experience", pt: "Experiência", es: "Experiencia", hi: "अनुभव" },
    name: { en: "Guileo Pulse", pt: "Guileo Pulse", es: "Guileo Pulse", hi: "Guileo Pulse" },
    result: {
      en: "Measures how your customers really feel — from calls & reviews you already have — and closes the loop on unhappy ones.",
      pt: "Mede como seu cliente realmente se sente — das ligações e avaliações que você já tem — e recupera os insatisfeitos.",
      es: "Mide cómo se siente tu cliente de verdad — de llamadas y reseñas que ya tienes — y recupera a los insatisfechos.",
      hi: "आपका ग्राहक असल में कैसा महसूस करता है — मौजूदा कॉल्स व रिव्यू से — और असंतुष्ट को वापस लाता है।",
    },
    resultMetric: { value: "$49", unit: { en: "/mo flat — CX score", pt: "/mês fixo — nota CX", es: "/mes fijo — nota CX", hi: "/माह — CX स्कोर" } },
    resultIsEstimate: false, credits: "chat", activationKey: null, plans: ["starter", "growth", "scale"], standalone: true,
  },
  {
    id: "close_collect", icon: "💳", accent: "#5EC26A", category: { en: "Money", pt: "Dinheiro", es: "Dinero", hi: "पैसा" },
    name: { en: "Close & Collect", pt: "Fecha e Cobra", es: "Cierra & Cobra", hi: "क्लोज़ & कलेक्ट" },
    result: {
      en: "Gui quotes the exact price, closes the sale, and collects on the call — a pay-link by SMS or a deposit to book.",
      pt: "A Gui passa o preço exato, fecha a venda e cobra na ligação — link de pagamento por SMS ou depósito pra agendar.",
      es: "Gui cotiza el precio exacto, cierra la venta y cobra en la llamada — pay-link por SMS o depósito.",
      hi: "गुई सटीक कीमत देती है, बिक्री बंद करती है और कॉल पर कलेक्ट करती है।",
    },
    resultMetric: { value: "$0", unit: { en: "sale left on the table", pt: "venda perdida na mesa", es: "venta perdida", hi: "छूटी बिक्री" } },
    resultIsEstimate: false, credits: "call", activationKey: "stripe", plans: ["growth", "scale"],
  },
  {
    id: "foundation", icon: "🌐", accent: "#9AA0FF", category: { en: "Built once", pt: "Construído uma vez", es: "Construido una vez", hi: "एक बार निर्मित" },
    name: { en: "Website · Apps · Store", pt: "Site · Apps · Loja", es: "Web · Apps · Tienda", hi: "वेबसाइट · ऐप्स · स्टोर" },
    result: {
      en: "The digital foundation Gui runs on — website, iOS/Android apps, online store — built once, working 24/7.",
      pt: "A base digital onde a Gui roda — site, apps iOS/Android, loja online — construída uma vez, rodando 24/7.",
      es: "La base digital donde corre Gui — web, apps iOS/Android, tienda — construida una vez, 24/7.",
      hi: "वह डिजिटल नींव जिस पर गुई चलती है — वेबसाइट, ऐप्स, स्टोर — एक बार बनी, 24/7 चालू।",
    },
    resultMetric: { value: "1×", unit: { en: "build, runs forever", pt: "build, roda pra sempre", es: "build, corre siempre", hi: "बिल्ड, हमेशा" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["scale"],
  },
];

// ── System helpers (the "integrated calculations") — every surface uses these ──
export const productById = (id) => PRODUCTS.find((p) => p.id === id) || null;
export const productsForPlan = (planKey) => PRODUCTS.filter((p) => (p.plans || []).includes(planKey));
export const alwaysOnProducts = () => PRODUCTS.filter((p) => !p.activationKey);
export const productsNeedingKey = () => PRODUCTS.filter((p) => p.activationKey);
// credits a product action spends (0 if it has no metered action, e.g. the foundation build)
export const productCredits = (id) => { const p = productById(id); return p && p.credits ? (CREDIT_COST[p.credits] || 0) : 0; };
// how many of plan's included products are live given a set of active activation keys
export const productsLiveCount = (planKey, activeKeys = []) =>
  productsForPlan(planKey).filter((p) => !p.activationKey || activeKeys.includes(p.activationKey)).length;
