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
    id: "answering", pilar: "brain", icon: "📞", accent: "#FF8A33", category: { en: "Answering", pt: "Atendimento", es: "Atención", hi: "कॉल" },
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
    id: "speedlead", pilar: "brain", icon: "⚡", accent: "#4C9AFF", category: { en: "Sales", pt: "Vendas", es: "Ventas", hi: "सेल्स" },
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
    id: "noshow", pilar: "brain", icon: "🛡️", accent: "#3E9468", category: { en: "Bookings", pt: "Agenda", es: "Agenda", hi: "बुकिंग" },
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
    id: "reactivation", pilar: "brain", icon: "♻️", accent: "#FF4FA3", category: { en: "Growth", pt: "Crescimento", es: "Crecimiento", hi: "ग्रोथ" },
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
    id: "reputation", pilar: "ad", icon: "⭐", accent: "#FFC23D", category: { en: "Reputation", pt: "Reputação", es: "Reputación", hi: "प्रतिष्ठा" },
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
    id: "content", pilar: "ad", icon: "🎬", accent: "#B37DFF", category: { en: "Marketing", pt: "Marketing", es: "Marketing", hi: "मार्केटिंग" },
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
    id: "multilingual", pilar: "brain", icon: "🌎", accent: "#33C6D6", category: { en: "Reach", pt: "Alcance", es: "Alcance", hi: "पहुँच" },
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
    id: "pulse", pilar: "brain", icon: "💗", accent: "#FF6B9D", category: { en: "Experience", pt: "Experiência", es: "Experiencia", hi: "अनुभव" },
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
    id: "close_collect", pilar: "brain", icon: "💳", accent: "#5EC26A", category: { en: "Money", pt: "Dinheiro", es: "Dinero", hi: "पैसा" },
    name: { en: "Close & Collect", pt: "Fecha e Cobra", es: "Cierra & Cobra", hi: "क्लोज़ & कलेक्ट" },
    result: {
      en: "Gui quotes the exact price, closes the sale, and collects on the call — a pay-link by email today (by SMS when the carrier approves A2P; the code is ready) or a deposit to book.",
      pt: "A Gui passa o preço exato, fecha a venda e cobra na ligação — link de pagamento por e-mail hoje (por SMS quando a operadora aprovar o A2P; o código está pronto) ou depósito pra agendar.",
      es: "Gui cotiza el precio exacto, cierra la venta y cobra en la llamada — pay-link por email hoy (por SMS cuando la operadora apruebe el A2P; el código está listo) o depósito.",
      hi: "गुई सटीक कीमत देती है, बिक्री बंद करती है और कॉल पर कलेक्ट करती है — आज ई-मेल से पे-लिंक (ऑपरेटर की A2P मंज़ूरी पर SMS से; कोड तैयार है) या बुकिंग डिपॉज़िट।",
    },
    resultMetric: { value: "$0", unit: { en: "sale left on the table", pt: "venda perdida na mesa", es: "venta perdida", hi: "छूटी बिक्री" } },
    resultIsEstimate: false, credits: "call", activationKey: "stripe", plans: ["growth", "scale"],
  },
  // ── O PILAR MAIS CARO ERA O QUE PARECIA MAIS MAGRO (2026-08-17) ──────────────────────────────
  // O card do Build mostrava DOIS itens contra sete do Brain, enquanto o texto do próprio card
  // promete "sites, apps, loja e software". Não era defeito de layout: a entrada `foundation`
  // colapsava TRÊS entregas distintas ("Website · Apps · Store") numa linha só. Colapsado, o
  // catálogo mentia para menos — e quem lê três chips entende três entregas, quem lê uma entende
  // uma. Vender site, app e loja como um item só é cobrar por três e mostrar um.
  //
  // ⚠️ NADA AQUI FOI INVENTADO: nome e descrição vieram, palavra por palavra e nos quatro idiomas,
  // de `serviceCatalog.js` (grupo "Guarda-chuva Guileo"), onde os quatro já estavam escritos com
  // `pilar: "build"`. É o mesmo método da correção de 11/08 documentada acima — o atlas é a fonte,
  // este arquivo é onde o pilar mora.
  //
  // `credits: null` e `resultIsEstimate: false` são deliberados: são entregas do TIME humano,
  // orçadas por escopo. Fingir crédito ou número aqui seria a mentira que este arquivo previne.
  {
    id: "websites", pilar: "build", icon: "🖥️", accent: "#9AA0FF",
    category: { en: "Built once", pt: "Construído uma vez", es: "Construido una vez", hi: "एक बार निर्मित" },
    // Mesma separação do `apps`: o plano entrega o site QUE A PLATAFORMA GERA — `client_sites` +
    // SSR em `functions/site/[slug].js`, com a tela `MeuSite` no cockpit para o dono editar.
    // Isso é real, automático e de custo marginal zero. Site sob medida, desenhado do zero, é o
    // projeto de `services.js` e continua sendo cobrado à parte.
    name: { en: "Your site, generated", pt: "Seu site, gerado", es: "Tu sitio, generado", hi: "आपकी साइट, तैयार" },
    result: {
      en: "A fast site with your name, your services and your prices — generated from what you already told us, editable in the cockpit, with Gui answering inside it. (A bespoke site designed from scratch is a separate project.)",
      pt: "Um site rápido com seu nome, seus serviços e seus preços — gerado a partir do que você já nos contou, editável no cockpit, com a Gui atendendo dentro dele. (Site sob medida, desenhado do zero, é projeto à parte.)",
      es: "Un sitio rápido con tu nombre, tus servicios y tus precios — generado con lo que ya nos contaste, editable en el cockpit, con Gui atendiendo dentro. (Un sitio a medida, diseñado desde cero, es un proyecto aparte.)",
      hi: "आपके नाम, सेवाओं और कीमतों वाली तेज़ साइट — जो आपने बताया उसी से बनी, कॉकपिट में संपादन-योग्य, अंदर गुई जवाब देती है। (शून्य से डिज़ाइन की गई कस्टम साइट अलग प्रोजेक्ट है।)",
    },
    resultMetric: { value: "1×", unit: { en: "build, runs forever", pt: "build, roda pra sempre", es: "build, corre siempre", hi: "बिल्ड, हमेशा" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["scale"],
  },
  {
    id: "apps", pilar: "build", icon: "📱", accent: "#9AA0FF",
    category: { en: "Built once", pt: "Construído uma vez", es: "Construido una vez", hi: "एक बार निर्मित" },
    // 🚨 DOIS PRODUTOS COM O MESMO NOME (separado em 2026-08-20).
    // Isto dizia "Apps móveis · iOS + Android · entregues de ponta a ponta" e estava em
    // `plans:["scale"]` — ou seja, INCLUSO no plano de $999/mês. E `services.js:571-588` cobra
    // $6.000–$20.000 pelo mesmo entregável, à parte. Não existe nenhuma esteira mobile no repo
    // (sem Xcode, Gradle, React Native ou Expo). Prometer App Store por $999/mês é reembolso certo.
    // Mas NÃO é conflito de preço — são DUAS COISAS diferentes chamadas do mesmo jeito:
    //   • O que o plano entrega HOJE, automático: o PWA por tenant. `functions/site/[slug].js`
    //     reescreve o <head> com a identidade do negócio e pendura manifesto, service worker e
    //     ícone NA MARCA DELE. Instala na tela inicial, abre sem barra de navegador. Tem teste
    //     próprio (`functions/site/pwa.test.mjs`) e o comentário de lá diz exatamente isto:
    //     "o app que a Guileo vende é o site do cliente instalável na marca DELE".
    //   • O que custa $6–20k: app NATIVO, publicado na App Store e na Play Store. Não existe.
    // Separar os nomes transforma uma promessa quebrada num upsell honesto.
    name: { en: "Your installable app", pt: "Seu app instalável", es: "Tu app instalable", hi: "आपका इंस्टॉल-योग्य ऐप" },
    result: {
      en: "Your business as an app on your customer's home screen — your name, your icon, opening without a browser bar. Generated for you, no store review queue. (A NATIVE App Store / Play Store app is a separate project.)",
      pt: "Seu negócio como app na tela inicial do cliente — seu nome, seu ícone, abrindo sem barra de navegador. Gerado pra você, sem fila de aprovação de loja. (App NATIVO na App Store / Play Store é projeto à parte.)",
      es: "Tu negocio como app en la pantalla de inicio del cliente — tu nombre, tu ícono, abriendo sin barra de navegador. Generado para ti, sin cola de revisión de tienda. (La app NATIVA en App Store / Play Store es un proyecto aparte.)",
      hi: "आपका व्यवसाय ग्राहक की होम स्क्रीन पर एक ऐप के रूप में — आपका नाम, आपका आइकन, बिना ब्राउज़र बार के। स्टोर समीक्षा की कतार नहीं। (App Store / Play Store का NATIVE ऐप अलग प्रोजेक्ट है।)",
    },
    resultMetric: { value: "PWA", unit: { en: "on the home screen", pt: "na tela inicial", es: "en la pantalla de inicio", hi: "होम स्क्रीन पर" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["scale"],
  },
  {
    id: "ecommerce", pilar: "build", icon: "🛒", accent: "#9AA0FF",
    category: { en: "Built once", pt: "Construído uma vez", es: "Construido una vez", hi: "एक बार निर्मित" },
    // O plano entrega a VENDA DIRETA que a plataforma já opera: catálogo com preço, link de
    // pagamento, pacotes, assinaturas e gift card, tudo com checkout Stripe no dinheiro do próprio
    // cliente. Loja completa com estoque, frete e variação de produto é o projeto de `services.js`
    // ("Online store & e-commerce", linha 552) e continua à parte.
    name: { en: "Sell online, right away", pt: "Vender online, já", es: "Vender online, ya", hi: "अभी ऑनलाइन बेचें" },
    result: {
      en: "Your priced catalog with pay links, packages, memberships and gift cards — money landing in your own Stripe from day one. (A full store with inventory, shipping and product variants is a separate project.)",
      pt: "Seu catálogo com preço e link de pagamento, pacotes, assinaturas e gift card — dinheiro caindo no seu próprio Stripe desde o dia um. (Loja completa com estoque, frete e variação de produto é projeto à parte.)",
      es: "Tu catálogo con precio y enlace de pago, paquetes, membresías y gift cards — dinero llegando a tu propio Stripe desde el día uno. (Una tienda completa con inventario, envío y variantes es un proyecto aparte.)",
      hi: "कीमत और पेमेंट लिंक वाला आपका कैटलॉग, पैकेज, मेंबरशिप और गिफ़्ट कार्ड — पहले दिन से पैसा आपके अपने Stripe में। (इन्वेंटरी, शिपिंग और वेरिएंट वाली पूरी दुकान अलग प्रोजेक्ट है।)",
    },
    resultMetric: { value: "1×", unit: { en: "store, sells 24/7", pt: "loja, vende 24/7", es: "tienda, vende 24/7", hi: "स्टोर, 24/7" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["scale"],
  },
  // ── OS PRODUTOS QUE FALTAVAM (2026-08-11) — puxados do ATLAS, não inventados ──────────────────
  // A landing prometia "Marketing · Anúncios · Criação de conteúdo · Gestão de mídia · SEO ·
  // E-mail/CRM" no pilar AD, e o pilar Build colapsava site+apps+loja numa entrada só. Ao auditar,
  // descobri que esses serviços SÃO reais e JÁ estavam escritos, quadrilíngues, em
  // `serviceCatalog.js` (grupo "Guarda-chuva Guileo") — só não existiam aqui, onde o pilar mora.
  // Então nada aqui é invenção: o texto vem do atlas, palavra por palavra.
  //
  // O QUE NÃO ENTROU, DE PROPÓSITO: "Gestão de mídia", "SEO" e "E-mail/CRM" apareciam na landing
  // mas NÃO existem no atlas nem em lugar nenhum do sistema — eram só copy. Não criei entrada para
  // fechar a conta; eles simplesmente pararam de ser prometidos. ("SEO local" e "Guileo.AD", que
  // eu quase tratei como produtos, são TAGS de benefício em AddOnsV2 — etiqueta não é item.)
  //
  // `credits: null` e `resultIsEstimate: false` são deliberados: são entregas do TIME humano,
  // orçadas por escopo. Fingir crédito ou número aqui seria a mentira que este arquivo previne.
  {
    id: "marketing_ads", pilar: "ad", icon: "📣", accent: "#4C9AFF",
    category: { en: "Marketing", pt: "Marketing", es: "Marketing", hi: "मार्केटिंग" },
    name: { en: "Marketing & ads", pt: "Marketing e anúncios", es: "Marketing y anuncios", hi: "मार्केटिंग और विज्ञापन" },
    result: {
      en: "Campaigns, ads and lead generation managed for you — feeding leads straight to Gui, who calls them in ~60 seconds.",
      pt: "Campanhas, anúncios e geração de leads gerenciados pra você — alimentando a Gui, que liga pro lead em ~60 segundos.",
      es: "Campañas, anuncios y generación de leads gestionados por ti — alimentando a Gui, que llama al lead en ~60 segundos.",
      hi: "आपके लिए संचालित कैंपेन और विज्ञापन — लीड सीधे गुई को, जो ~60 सेकंड में कॉल करती है।",
    },
    resultMetric: { value: "→", unit: { en: "ads end in a conversation", pt: "anúncio vira conversa", es: "anuncio se vuelve conversación", hi: "विज्ञापन बातचीत बनता है" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["scale"],
  },
  {
    id: "video_design", pilar: "ad", icon: "🎬", accent: "#B37DFF",
    category: { en: "Creative", pt: "Criação", es: "Creación", hi: "क्रिएटिव" },
    name: { en: "Video & design", pt: "Vídeo & design", es: "Video y diseño", hi: "वीडियो और डिज़ाइन" },
    result: {
      en: "Video and visuals produced by our creative team — shot, edited and delivered.",
      pt: "Vídeo e peças visuais produzidos pelo nosso time de criação — gravados, editados e entregues.",
      es: "Video y piezas visuales producidos por nuestro equipo creativo — grabados, editados y entregados.",
      hi: "हमारी क्रिएटिव टीम द्वारा बनाया वीडियो और विज़ुअल — शूट, एडिट और डिलीवर।",
    },
    resultMetric: { value: "1×", unit: { en: "scoped project", pt: "projeto por escopo", es: "proyecto por alcance", hi: "स्कोप प्रोजेक्ट" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["scale"],
  },
  {
    id: "automation", pilar: "build", icon: "⚙️", accent: "#9AA0FF",
    category: { en: "Automation", pt: "Automação", es: "Automatización", hi: "ऑटोमेशन" },
    name: { en: "Custom automation", pt: "Automação sob medida", es: "Automatización a medida", hi: "कस्टम ऑटोमेशन" },
    result: {
      en: "Custom automations wiring your tools and routines together — the repetitive work stops being manual.",
      pt: "Automações sob medida conectando suas ferramentas e rotinas — o trabalho repetitivo deixa de ser manual.",
      es: "Automatizaciones a medida conectando tus herramientas y rutinas — el trabajo repetitivo deja de ser manual.",
      hi: "आपके टूल्स और रूटीन जोड़ने वाले कस्टम ऑटोमेशन — दोहराव वाला काम मैनुअल नहीं रहता।",
    },
    resultMetric: { value: "−h", unit: { en: "of manual work", pt: "de trabalho manual", es: "de trabajo manual", hi: "मैनुअल काम" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["scale"],
  },
  // ── OS TRÊS QUE EU TINHA APAGADO, E ERA ERRO MEU (2026-08-11) ─────────────────────────────────
  // Horas atrás removi "Gestão de mídia", "SEO" e "E-mail/CRM" da landing porque não existiam
  // NESTE arquivo. O critério estava errado: eu confundi "não está catalogado" com "não existe".
  // Luis cobrou — «como você tirou os serviços da landing? constrói tudo que estava prometido» —
  // e a auditoria do código deu razão a ele. Os três têm MOTOR VIVO em produção:
  //   • CRM + e-mail → functions/api/crm.js, crm-classify.js, emailTemplates.js (2.966 linhas, com
  //     13 pontos que usam a logo e a cor DO CLIENTE — o e-mail sai com a marca dele, não a nossa)
  //   • social      → functions/api/social-publish.js (agendar → reservar → publicar; a reserva
  //     atômica de porta única foi provada nesta mesma sessão)
  //   • SEO         → functions/lib/dadosEstruturados.js + SSR de /site/:slug (o site do Natura
  //     está no ar AGORA com 2 blocos JSON-LD: 20 serviços, 17 com preço, 3 unidades)
  //
  // A LIÇÃO: apagar uma promessa é tão perigoso quanto inventá-la. Inventar mente pro cliente;
  // apagar mente pro DONO — esconde dele o que a própria plataforma já sabe fazer, e some com o
  // argumento de venda. O certo nunca foi "tira da landing", era "põe na fonte".
  {
    id: "crm_email", pilar: "ad", icon: "✉️", accent: "#4C9AFF",
    category: { en: "CRM & email", pt: "CRM e e-mail", es: "CRM y email", hi: "CRM और ईमेल" },
    name: { en: "CRM + branded email", pt: "CRM + e-mail com sua marca", es: "CRM + email con tu marca", hi: "CRM + आपके ब्रांड का ईमेल" },
    result: {
      en: "Every call, message and lead becomes a contact with full history — and the emails that go out carry YOUR logo and colours, not ours.",
      pt: "Toda ligação, mensagem e lead vira um contato com histórico — e o e-mail que sai leva a SUA logo e as suas cores, não as nossas.",
      es: "Cada llamada, mensaje y lead se vuelve un contacto con historial — y el email que sale lleva TU logo y tus colores, no los nuestros.",
      hi: "हर कॉल, मैसेज और लीड पूरे इतिहास वाला कॉन्टैक्ट बनता है — और जो ईमेल जाता है उस पर आपका लोगो और रंग होते हैं, हमारे नहीं।",
    },
    resultMetric: { value: "1", unit: { en: "place for every customer", pt: "lugar só pra cada cliente", es: "lugar único por cliente", hi: "हर ग्राहक के लिए एक जगह" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["growth", "scale"],
  },
  {
    id: "social_manage", pilar: "ad", icon: "📲", accent: "#FF4FA3",
    category: { en: "Social", pt: "Redes sociais", es: "Redes sociales", hi: "सोशल" },
    name: { en: "Social media managed", pt: "Gestão de redes sociais", es: "Gestión de redes sociales", hi: "सोशल मीडिया प्रबंधन" },
    result: {
      en: "Posts written, scheduled and published on your accounts — you approve, the engine publishes on time, and never twice.",
      pt: "Posts escritos, agendados e publicados nas suas contas — você aprova, o motor publica na hora certa, e nunca duas vezes.",
      es: "Posts escritos, programados y publicados en tus cuentas — tú apruebas, el motor publica a tiempo, y nunca dos veces.",
      hi: "पोस्ट लिखे, शेड्यूल और आपके अकाउंट पर प्रकाशित — आप मंज़ूरी दें, इंजन समय पर पोस्ट करता है, कभी दो बार नहीं।",
    },
    resultMetric: { value: "0", unit: { en: "blank-page weeks", pt: "semanas de tela em branco", es: "semanas de página en blanco", hi: "खाली पन्ने वाले हफ़्ते" } },
    // activationKey:"meta" — igual ao gêmeo `content` (:96). Os dois rodam no MESMO motor
    // (functions/api/social-publish.js), que sem META_APP_ID/SECRET + conta conectada devolve
    // { ready:false } e "nothing goes out". Estava `null` (= sempre ligado) e vendia publicação
    // automática inclusa no plano de $449 sem nada poder sair. 2026-08-20.
    resultIsEstimate: false, credits: null, activationKey: "meta", plans: ["growth", "scale"],
  },
  {
    id: "seo_aeo", pilar: "ad", icon: "🔎", accent: "#33C6D6",
    category: { en: "Found online", pt: "Ser achado", es: "Ser encontrado", hi: "ऑनलाइन मिलना" },
    name: { en: "SEO — found by Google AND by AI", pt: "SEO — achado no Google E pela IA", es: "SEO — encontrado en Google Y por la IA", hi: "SEO — Google और AI दोनों पर" },
    result: {
      en: "Your hours, services, prices and locations published as structured data — so Google ranks you and ChatGPT-style assistants can actually quote you.",
      pt: "Seus horários, serviços, preços e unidades publicados como dado estruturado — o Google te posiciona e os assistentes tipo ChatGPT conseguem te citar.",
      es: "Tus horarios, servicios, precios y sucursales publicados como dato estructurado — Google te posiciona y los asistentes tipo ChatGPT pueden citarte.",
      hi: "आपके समय, सेवाएँ, क़ीमतें और शाखाएँ स्ट्रक्चर्ड डेटा में — Google रैंक करता है और ChatGPT जैसे असिस्टेंट आपको बता पाते हैं।",
    },
    resultMetric: { value: "24/7", unit: { en: "answerable by machines", pt: "legível pelas máquinas", es: "legible por las máquinas", hi: "मशीनों के लिए पठनीय" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["growth", "scale"],
  },
];


// ── OS TRÊS PILARES — e por que o `pilar` mora AQUI e não no componente ─────────────────────────
// 2026-08-11: a landing tinha PARADO de ler este arquivo. `PillarsProducts.jsx` trazia, escrito à
// mão e repetido nos 4 idiomas, listas como ["Marketing","Ads","Content creation","Media
// management","SEO","Email / CRM"] — seis nomes que não existem em lugar nenhum da plataforma.
// Enquanto isso `ProductResultsV2`, o componente que LÊ este arquivo e faz do RESULTADO o herói,
// nem era renderizado na Home. O sistema estava certo e o cliente via outra coisa.
//
// Uma lista escrita à mão não erra hoje: erra no dia em que o produto muda e ninguém lembra dos 12
// lugares (3 pilares × 4 idiomas). É a mesma classe do arquivo .sql que fica atrás do banco —
// cópia sem vínculo é um rollback esperando alguém. Com o `pilar` na fonte, mudar um produto muda
// a landing sozinho, nos quatro idiomas, sem tradutor.
//
// A ATRIBUIÇÃO é decisão de NEGÓCIO (por isso está explícita e revisável, não espalhada):
//   brain → tudo que A AGENTE faz: atender, responder lead em 60s, blindar a agenda, reativar
//           cliente sumido, cobrar na ligação, falar 16 idiomas, medir a experiência (Pulse)
//   ad    → o que o TIME DE MARKETING faz: conteúdo e reputação
//   build → a FUNDAÇÃO construída uma vez: site · apps · loja
//
// ⚠️ O CRITÉRIO É "QUEM EXECUTA", não "para que serve". Minha primeira tentativa pôs `speedlead` e
// `reactivation` no AD porque servem ao crescimento — e estava errada: quem liga é a AGENTE. Se o
// critério vira a finalidade, tudo é crescimento e o pilar deixa de significar coisa alguma. Foi a
// própria landing (que já os listava em Brain) que me corrigiu.
//
// ⚠️ E ISTO FICA VISÍVEL DE PROPÓSITO: o pilar AD tem só DOIS produtos aqui, mas a landing promete
// SEIS (Marketing · Anúncios · Conteúdo · Gestão de mídia · SEO · E-mail/CRM). Os quatro que
// faltam são serviços reais que o time entrega — só que não existem como PRODUTO no sistema, então
// não têm resultado, nem crédito, nem plano. Não inventei entradas para emparelhar a conta:
// decidir se eles viram produto é do Luis. Ver o relatório da onda de 2026-08-11.
export const PILARES = ["brain", "ad", "build"];
export const productsForPilar = (pilar) => PRODUCTS.filter((p) => p.pilar === pilar);

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


// ═══════════════════════════════════════════════════════════════════════════════════════════════
// FICHA DE ENTREGA DO PRODUTO — o que ele É, o que ele FAZ, e o resultado (2026-08-18)
//
// PEDIDO DO LUIS, LITERAL: "tem que ter mais informações, principalmente dos produtos que vamos
// entregar". No Growth Report (/apresentacao/:id) cada passo da estratégia mostrava só um selo com
// o NOME do produto ("✅ Gui — agente de voz 24/7"). Nome não vende: o dono do negócio não sabe o
// que chega na segunda-feira.
//
// ISTO ESTENDE `PRODUCTS`, NÃO DUPLICA. Onde o produto já existe no sistema (answering, speedlead,
// close_collect, pulse) a ficha só ACRESCENTA o detalhe de entrega — nome, ícone, resultado e
// crédito continuam vindo de PRODUCTS (`base`). Entradas sem `base` (agenda, widget_whatsapp,
// catalog) são capacidades da plataforma que o motor de avaliação recomenda mas que ainda não são
// produto vendável isolado — por isso vivem aqui e NÃO foram enfiadas em PRODUCTS: inventar linha
// no catálogo para emparelhar a conta é a mentira que este arquivo previne.
//
// A CHAVE é `produto_id`, emitida pelo motor (functions/lib/avaliacao.js → estrategia[].produto_id).
// Chave estável, nunca traduzida — a tradução é o conteúdo.
//
// REGRA DOS BULLETS: 3, concretos e verificáveis. Cada um descreve algo que a plataforma FAZ hoje
// (ver MOTORES.md). Nada de "aumenta suas vendas" — promessa vaga não é bullet.
// `resultado` recebe o GAP MEDIDO do próprio relatório: o resultado fica amarrado ao vazamento que
// a gente mediu, nunca a um número inventado.
// `prazo` só existe onde o repo já publica o prazo (recepção IA: ~7 dias — launchKit.js/blog).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
export const PRODUCT_DETAIL = {
  answering: {
    base: "answering", icon: "📞",
    name: { en: "24/7 Voice Agent", pt: "Agente de voz 24/7", es: "Agente de voz 24/7", hi: "24/7 वॉइस एजेंट" },
    whatIs: {
      en: "An AI receptionist that answers your existing number, in your business's name, day and night.",
      pt: "Uma recepcionista de IA que atende o seu número atual, no nome do seu negócio, dia e noite.",
      es: "Una recepcionista de IA que atiende tu número actual, en nombre de tu negocio, día y noche.",
      hi: "एक AI रिसेप्शनिस्ट जो आपके मौजूदा नंबर पर, आपके व्यवसाय के नाम से, दिन-रात जवाब देती है।",
    },
    bullets: {
      en: [
        "Answers every call — including several at once, so the line is never busy.",
        "Quotes prices straight from your catalog and books into the real calendar during the call.",
        "Logs caller, transcript and sentiment; emails you the summary after each call.",
      ],
      pt: [
        "Atende toda ligação — inclusive várias ao mesmo tempo, então a linha nunca dá ocupado.",
        "Passa preço direto do seu catálogo e marca na agenda real durante a própria ligação.",
        "Registra quem ligou, transcrição e sentimento; manda o resumo por e-mail depois de cada ligação.",
      ],
      es: [
        "Atiende cada llamada — incluso varias a la vez, así la línea nunca da ocupado.",
        "Cotiza precios directo de tu catálogo y reserva en la agenda real durante la llamada.",
        "Registra quién llamó, transcripción y sentimiento; te envía el resumen por correo tras cada llamada.",
      ],
      hi: [
        "हर कॉल का जवाब — एक साथ कई भी, इसलिए लाइन कभी व्यस्त नहीं।",
        "आपके कैटलॉग से सीधे कीमत बताती है और कॉल के दौरान असली कैलेंडर में बुक करती है।",
        "कॉलर, ट्रांसक्रिप्ट और सेंटिमेंट दर्ज करती है; हर कॉल के बाद सारांश ईमेल करती है।",
      ],
    },
    prazo: { en: "live in ~7 days", pt: "no ar em ~7 dias", es: "en el aire en ~7 días", hi: "~7 दिनों में लाइव" },
  },
  agenda: {
    base: null, icon: "📅", pilar: "brain",
    name: { en: "Booking Engine", pt: "Motor de Agenda", es: "Motor de Agenda", hi: "बुकिंग इंजन" },
    whatIs: {
      en: "Your real calendar — services, staff, locations and opening hours — wired into every channel.",
      pt: "A sua agenda real — serviços, profissionais, unidades e horário — ligada em todos os canais.",
      es: "Tu agenda real — servicios, personal, sedes y horarios — conectada a todos los canales.",
      hi: "आपका असली कैलेंडर — सेवाएँ, स्टाफ़, शाखाएँ और समय — हर चैनल से जुड़ा।",
    },
    bullets: {
      en: [
        "Offers only slots that actually exist — duration, staff and location are checked before it says yes.",
        "Holds the slot atomically, so two callers can never take the same time.",
        "Sends a branded confirmation email and reminders; reschedules and cancellations update the same calendar.",
      ],
      pt: [
        "Só oferece horário que existe de verdade — duração, profissional e unidade são conferidos antes do sim.",
        "Reserva o horário de forma atômica: dois clientes nunca pegam o mesmo horário.",
        "Manda confirmação por e-mail com a sua marca e lembretes; remarcação e cancelamento atualizam a mesma agenda.",
      ],
      es: [
        "Solo ofrece horarios que existen de verdad — duración, personal y sede se verifican antes del sí.",
        "Reserva el horario de forma atómica: dos clientes nunca toman el mismo turno.",
        "Envía confirmación por correo con tu marca y recordatorios; reprogramar y cancelar actualizan la misma agenda.",
      ],
      hi: [
        "सिर्फ़ वही समय देती है जो वाकई खाली है — अवधि, स्टाफ़ और शाखा जाँचने के बाद ही हाँ।",
        "स्लॉट को एटॉमिक रूप से रोकती है: दो ग्राहक कभी एक ही समय नहीं ले सकते।",
        "आपकी ब्रांडिंग वाला कन्फ़र्मेशन ईमेल और रिमाइंडर भेजती है; बदलाव व रद्दीकरण उसी कैलेंडर में अपडेट।",
      ],
    },
    prazo: { en: "live in ~7 days", pt: "no ar em ~7 dias", es: "en el aire en ~7 días", hi: "~7 दिनों में लाइव" },
  },
  widget_whatsapp: {
    base: null, icon: "💬", pilar: "brain",
    name: { en: "Chat Widget + WhatsApp", pt: "Widget de chat + WhatsApp", es: "Widget de chat + WhatsApp", hi: "चैट विजेट + WhatsApp" },
    whatIs: {
      en: "The same agent, in writing: a chat bubble on your site and your WhatsApp line, sharing one brain and one calendar.",
      pt: "A mesma agente, por escrito: um chat no seu site e o seu WhatsApp, com o mesmo cérebro e a mesma agenda.",
      es: "La misma agente, por escrito: un chat en tu sitio y tu WhatsApp, con el mismo cerebro y la misma agenda.",
      hi: "वही एजेंट, लिखित रूप में: आपकी साइट पर चैट और आपका WhatsApp — एक ही दिमाग़, एक ही कैलेंडर।",
    },
    bullets: {
      en: [
        "Answers on the site and on WhatsApp from the same knowledge base the phone agent uses.",
        "Books, quotes and captures name + phone inside the conversation — no hand-off, no form to fill twice.",
        "Every conversation lands in the CRM, so a chat that started at midnight is a lead you can call back.",
      ],
      pt: [
        "Responde no site e no WhatsApp com a mesma base de conhecimento que a agente do telefone usa.",
        "Marca, cota e captura nome + telefone dentro da conversa — sem transferir, sem preencher formulário duas vezes.",
        "Toda conversa cai no CRM: um chat que começou de madrugada é um lead pra você retornar.",
      ],
      es: [
        "Responde en el sitio y en WhatsApp con la misma base de conocimiento que usa la agente del teléfono.",
        "Reserva, cotiza y captura nombre + teléfono dentro de la conversación — sin transferencias ni formularios repetidos.",
        "Cada conversación entra al CRM: un chat que empezó de madrugada es un lead para devolver la llamada.",
      ],
      hi: [
        "साइट और WhatsApp पर वही नॉलेज बेस जो फ़ोन एजेंट इस्तेमाल करती है।",
        "बातचीत के भीतर ही बुकिंग, कीमत और नाम + फ़ोन दर्ज — कोई ट्रांसफ़र नहीं, दोबारा फ़ॉर्म नहीं।",
        "हर बातचीत CRM में जाती है: आधी रात शुरू हुआ चैट भी एक लीड है।",
      ],
    },
    prazo: { en: "needs Meta approval", pt: "precisa da aprovação da Meta", es: "requiere la aprobación de Meta", hi: "Meta की मंज़ूरी ज़रूरी" },
  },
  speedlead: {
    base: "speedlead", icon: "⚡",
    name: { en: "Speed-to-Lead", pt: "Speed-to-lead", es: "Speed-to-lead", hi: "स्पीड-टू-लीड" },
    whatIs: {
      en: "The moment someone fills a form, the agent calls them back — in about 60 seconds.",
      pt: "No instante em que alguém preenche um formulário, a agente liga de volta — em ~60 segundos.",
      es: "En el instante en que alguien llena un formulario, la agente devuelve la llamada — en ~60 segundos.",
      hi: "जैसे ही कोई फ़ॉर्म भरता है, एजेंट ~60 सेकंड में वापस कॉल करती है।",
    },
    bullets: {
      en: [
        "Works with the form on your own site, or with a Guileo-hosted form — the webhook is the same.",
        "Also picks up marketplace leads (Yelp, Angi, Thumbtack) and calls them the same way.",
        "If nobody picks up, it retries on a schedule and leaves the lead in the CRM with its origin attached.",
      ],
      pt: [
        "Funciona com o formulário do seu próprio site ou com um formulário hospedado pela Guileo — o webhook é o mesmo.",
        "Também pega lead de marketplace (Yelp, Angi, Thumbtack) e liga do mesmo jeito.",
        "Se ninguém atende, tenta de novo com intervalo e deixa o lead no CRM com a origem registrada.",
      ],
      es: [
        "Funciona con el formulario de tu propio sitio o con uno alojado por Guileo — el webhook es el mismo.",
        "También toma leads de marketplace (Yelp, Angi, Thumbtack) y llama igual.",
        "Si nadie contesta, reintenta con intervalos y deja el lead en el CRM con su origen registrado.",
      ],
      hi: [
        "आपकी साइट के फ़ॉर्म या Guileo-होस्टेड फ़ॉर्म — दोनों के लिए एक ही वेबहुक।",
        "मार्केटप्लेस लीड (Yelp, Angi, Thumbtack) भी उठाती है और वैसे ही कॉल करती है।",
        "कोई न उठाए तो निर्धारित अंतराल पर दोबारा कोशिश; लीड CRM में स्रोत सहित दर्ज रहता है।",
      ],
    },
    prazo: { en: "live in ~7 days", pt: "no ar em ~7 dias", es: "en el aire en ~7 días", hi: "~7 दिनों में लाइव" },
  },
  close_collect: {
    base: "close_collect", icon: "💳",
    name: { en: "Close & Collect + Packages", pt: "Fecha & Cobra + Pacotes", es: "Cierra & Cobra + Paquetes", hi: "क्लोज़ & कलेक्ट + पैकेज" },
    whatIs: {
      en: "Selling without a person present: the agent quotes, closes and takes the money on the call.",
      pt: "Vender sem ninguém presente: a agente cota, fecha e recebe na própria ligação.",
      es: "Vender sin nadie presente: la agente cotiza, cierra y cobra en la propia llamada.",
      hi: "बिना किसी के मौजूद हुए बिक्री: एजेंट कीमत बताती है, सौदा करती है और कॉल पर पैसा लेती है।",
    },
    bullets: {
      en: [
        "Sends a pay-link by email during the call (by SMS as soon as the carrier approves A2P — the code is ready), or takes a deposit to hold the booking.",
        "Sells packages, memberships and gift cards — each redemption is checked against the balance.",
        "Every payment reconciles into one place, so the same booking is never charged twice.",
      ],
      pt: [
        "Manda link de pagamento por e-mail durante a ligação (por SMS assim que a operadora aprovar o A2P — o código está pronto), ou cobra depósito pra segurar o horário.",
        "Vende pacotes, memberships e gift cards — cada uso é conferido contra o saldo.",
        "Todo pagamento é conciliado num lugar só: o mesmo agendamento nunca é cobrado duas vezes.",
      ],
      es: [
        "Envía pay-link por email durante la llamada (por SMS en cuanto la operadora apruebe el A2P — el código está listo), o cobra un depósito para retener el turno.",
        "Vende paquetes, membresías y gift cards — cada uso se verifica contra el saldo.",
        "Todo pago se concilia en un solo lugar: la misma reserva nunca se cobra dos veces.",
      ],
      hi: [
        "कॉल के दौरान ई-मेल से पे-लिंक भेजती है (ऑपरेटर की A2P मंज़ूरी मिलते ही SMS से — कोड तैयार है), या बुकिंग रोकने के लिए डिपॉज़िट लेती है।",
        "पैकेज, मेंबरशिप और गिफ़्ट कार्ड बेचती है — हर उपयोग बैलेंस से जाँचा जाता है।",
        "हर भुगतान एक ही जगह मिलान होता है: एक बुकिंग पर दो बार शुल्क कभी नहीं।",
      ],
    },
    prazo: { en: "needs Stripe connected", pt: "precisa do Stripe conectado", es: "requiere Stripe conectado", hi: "Stripe कनेक्ट होना ज़रूरी" },
  },
  catalog: {
    base: null, icon: "🏷️", pilar: "build",
    name: { en: "Priced Catalog", pt: "Catálogo precificado", es: "Catálogo con precios", hi: "मूल्य-सहित कैटलॉग" },
    whatIs: {
      en: "One list of services with real prices and durations — the only thing the agent is allowed to quote from.",
      pt: "Uma lista de serviços com preço e duração reais — a única fonte de onde a agente pode cotar.",
      es: "Una lista de servicios con precio y duración reales — la única fuente de la que la agente puede cotizar.",
      hi: "असली कीमत और अवधि वाली सेवाओं की एक सूची — एजेंट सिर्फ़ इसी से कीमत बता सकती है।",
    },
    bullets: {
      en: [
        "Price and duration per service, per location — quoted word for word, never improvised.",
        "A service with no price is flagged loudly instead of guessed, and becomes a captured quote request.",
        "The same catalog feeds the phone, the chat, the booking engine and the payment link — one edit, every channel.",
      ],
      pt: [
        "Preço e duração por serviço e por unidade — cotados palavra por palavra, nunca improvisados.",
        "Serviço sem preço é sinalizado em alto e bom som em vez de adivinhado, e vira pedido de orçamento capturado.",
        "O mesmo catálogo alimenta telefone, chat, agenda e link de pagamento — uma edição, todos os canais.",
      ],
      es: [
        "Precio y duración por servicio y por sede — cotizados palabra por palabra, nunca improvisados.",
        "Un servicio sin precio se señala con claridad en vez de adivinarse, y se vuelve un pedido de presupuesto capturado.",
        "El mismo catálogo alimenta teléfono, chat, agenda y pay-link — una edición, todos los canales.",
      ],
      hi: [
        "हर सेवा और शाखा की कीमत व अवधि — शब्दशः, कभी अनुमान से नहीं।",
        "बिना कीमत वाली सेवा अनुमान के बजाय स्पष्ट रूप से चिह्नित होती है और कोटेशन अनुरोध बन जाती है।",
        "वही कैटलॉग फ़ोन, चैट, बुकिंग और पेमेंट लिंक चलाता है — एक बदलाव, हर चैनल।",
      ],
    },
    prazo: { en: "needs the client price list", pt: "precisa dos preços do cliente", es: "requiere la lista de precios del cliente", hi: "क्लाइंट की मूल्य-सूची ज़रूरी" },
  },
  // ── FASE 2 do Growth Report (2026-08-18) ────────────────────────────────────────────────────
  // A estratégia do relatório passou a ter uma FASE 2 (crescer, não só parar a perda) e ela cita
  // estes três produtos. Sem ficha aqui a página mostrava só o selo com o nome — a Fase 2 ficava
  // mais fraca justamente onde precisa convencer. `base` aponta pra linha aprovada em PRODUCTS:
  // o claim de resultado continua vindo de lá, não é reescrito aqui.
  reactivation: {
    base: "reactivation", icon: "♻️",
    name: { en: "Reactivation & Churn-save", pt: "Reativação e Anti-churn", es: "Reactivación & Anti-churn", hi: "रीएक्टिवेशन और चर्न-सेव" },
    whatIs: {
      en: "The agent calls back the people who reached out and never booked — and the regulars who stopped coming.",
      pt: "A agente liga de volta para quem procurou e não marcou — e para o cliente fiel que parou de vir.",
      es: "La agente vuelve a llamar a quien buscó y no reservó — y al cliente fiel que dejó de venir.",
      hi: "एजेंट उन लोगों को वापस कॉल करती है जिन्होंने संपर्क किया पर बुक नहीं किया — और उन नियमित ग्राहकों को जो आना बंद कर चुके हैं।",
    },
    bullets: {
      en: [
        "Reads each customer's own rhythm and flags the ones about to vanish.",
        "Calls or messages with the offer and the calendar already in hand.",
        "Books straight into the real calendar — no one has to call back.",
      ],
      pt: [
        "Lê o ritmo de cada cliente e marca quem está prestes a sumir.",
        "Liga ou manda mensagem com a oferta e a agenda já na mão.",
        "Marca direto na agenda real — ninguém precisa retornar depois.",
      ],
      es: [
        "Lee el ritmo de cada cliente y marca a quien está por irse.",
        "Llama o escribe con la oferta y la agenda ya en la mano.",
        "Reserva directo en la agenda real — nadie tiene que devolver la llamada.",
      ],
      hi: [
        "हर ग्राहक की अपनी लय पढ़कर बताती है कौन छूटने वाला है।",
        "ऑफ़र और कैलेंडर हाथ में लेकर कॉल या मैसेज करती है।",
        "सीधे असली कैलेंडर में बुक करती है — किसी को वापस कॉल नहीं करना पड़ता।",
      ],
    },
    prazo: { en: "live in ~7 days", pt: "no ar em ~7 dias", es: "en el aire en ~7 días", hi: "~7 दिनों में लाइव" },
  },
  reputation: {
    base: "reputation", icon: "⭐",
    name: { en: "Reputation Machine", pt: "Máquina de Reputação", es: "Máquina de Reputación", hi: "रेपुटेशन मशीन" },
    whatIs: {
      en: "Every visit ends in a review request, and every review that lands gets answered in your tone.",
      pt: "Todo atendimento termina em pedido de avaliação, e toda avaliação que chega é respondida no seu tom.",
      es: "Cada visita termina en un pedido de reseña, y cada reseña que llega se responde en tu tono.",
      hi: "हर विज़िट के बाद रिव्यू का अनुरोध, और आने वाले हर रिव्यू का जवाब आपके अंदाज़ में।",
    },
    bullets: {
      en: [
        "Asks for the review right after the visit, when the customer is happiest.",
        "Drafts the answer to every review in your tone — you approve, it posts.",
        "Unhappy customers are routed to a callback before they write publicly.",
      ],
      pt: [
        "Pede a avaliação logo depois do atendimento, quando o cliente está mais satisfeito.",
        "Escreve a resposta de cada avaliação no seu tom — você aprova, ela publica.",
        "Cliente insatisfeito vira retorno de ligação antes de escrever em público.",
      ],
      es: [
        "Pide la reseña justo después de la visita, cuando el cliente está más satisfecho.",
        "Redacta la respuesta de cada reseña en tu tono — tú apruebas, se publica.",
        "El cliente insatisfecho pasa a una llamada de vuelta antes de escribir en público.",
      ],
      hi: [
        "विज़िट के तुरंत बाद रिव्यू माँगती है, जब ग्राहक सबसे खुश होता है।",
        "हर रिव्यू का जवाब आपके अंदाज़ में लिखती है — आप मंज़ूरी दें, वह पोस्ट हो जाता है।",
        "असंतुष्ट ग्राहक सार्वजनिक रूप से लिखने से पहले कॉलबैक के लिए भेजा जाता है।",
      ],
    },
    prazo: { en: "needs the Google connection", pt: "precisa da conexão com o Google", es: "requiere la conexión con Google", hi: "Google कनेक्शन ज़रूरी" },
  },
  marketing_ads: {
    base: "marketing_ads", icon: "📣",
    name: { en: "Marketing & ads", pt: "Marketing e anúncios", es: "Marketing y anuncios", hi: "मार्केटिंग और विज्ञापन" },
    whatIs: {
      en: "Paid campaigns run for you, with every lead landing straight on the agent instead of a form.",
      pt: "Campanhas pagas rodando por você, com cada lead caindo direto na agente em vez de num formulário.",
      es: "Campañas pagas gestionadas por ti, con cada lead cayendo directo en la agente en vez de un formulario.",
      hi: "आपके लिए चलाए गए पेड कैंपेन, जिनमें हर लीड फ़ॉर्म के बजाय सीधे एजेंट तक पहुँचती है।",
    },
    bullets: {
      en: [
        "Creative and campaigns built on your own catalog and prices.",
        "The lead is called back in about 60 seconds, day or night.",
        "Measured by bookings and revenue per campaign — not by clicks.",
      ],
      pt: [
        "Criativo e campanhas montados em cima do seu catálogo e dos seus preços.",
        "O lead recebe ligação em cerca de 60 segundos, de dia ou de madrugada.",
        "Medido por agendamento e receita por campanha — não por clique.",
      ],
      es: [
        "Creativo y campañas armados sobre tu propio catálogo y tus precios.",
        "El lead recibe llamada en unos 60 segundos, de día o de madrugada.",
        "Medido por reservas e ingresos por campaña — no por clics.",
      ],
      hi: [
        "आपके अपने कैटलॉग और दामों पर बने क्रिएटिव और कैंपेन।",
        "लीड को लगभग 60 सेकंड में कॉल आती है, दिन हो या रात।",
        "कैंपेन के हिसाब से बुकिंग और आय से मापा जाता है — क्लिक से नहीं।",
      ],
    },
    prazo: { en: "starts after the accounts are connected", pt: "começa depois de conectar as contas", es: "empieza tras conectar las cuentas", hi: "खाते जुड़ने के बाद शुरू" },
  },
  pulse: {
    base: "pulse", icon: "💗",
    name: { en: "Guileo Pulse", pt: "Guileo Pulse", es: "Guileo Pulse", hi: "Guileo Pulse" },
    whatIs: {
      en: "The experience meter: it measures how your customers actually felt, from the calls and reviews you already have.",
      pt: "O medidor de experiência: mede como o seu cliente realmente se sentiu, a partir das ligações e avaliações que você já tem.",
      es: "El medidor de experiencia: mide cómo se sintió tu cliente de verdad, a partir de llamadas y reseñas que ya tienes.",
      hi: "अनुभव मीटर: आपकी मौजूदा कॉल्स और रिव्यू से मापता है कि ग्राहक ने असल में कैसा महसूस किया।",
    },
    bullets: {
      en: [
        "Asks for a review after each visit, at the moment the customer is happiest.",
        "Scores sentiment on every analyzed call and turns it into one CX number you can track.",
        "Flags the unhappy customer for a callback before the bad review is written.",
      ],
      pt: [
        "Pede avaliação depois de cada atendimento, no momento em que o cliente está mais satisfeito.",
        "Pontua o sentimento de cada ligação analisada e transforma isso em uma nota de CX pra acompanhar.",
        "Sinaliza o cliente insatisfeito pra retorno antes de a avaliação ruim ser escrita.",
      ],
      es: [
        "Pide reseña después de cada visita, en el momento en que el cliente está más satisfecho.",
        "Puntúa el sentimiento de cada llamada analizada y lo convierte en una nota de CX para seguir.",
        "Señala al cliente insatisfecho para devolverle la llamada antes de que escriba la mala reseña.",
      ],
      hi: [
        "हर विज़िट के बाद, जब ग्राहक सबसे ख़ुश हो, तभी रिव्यू माँगता है।",
        "हर विश्लेषित कॉल का सेंटिमेंट स्कोर करता है और उसे एक CX नंबर में बदलता है।",
        "बुरा रिव्यू लिखे जाने से पहले असंतुष्ट ग्राहक को कॉलबैक के लिए चिह्नित करता है।",
      ],
    },
    prazo: { en: "live in ~7 days", pt: "no ar em ~7 dias", es: "en el aire en ~7 días", hi: "~7 दिनों में लाइव" },
  },
};

// ── A PERNA DE UM PASSO DO RELATÓRIO (2026-08-18) ──────────────────────────────────────────────
// O Growth Report agrupa o plano por 🧠 Brain · 📈 AD · 🏗️ Build. A perna sai do MOTOR
// (`functions/lib/avaliacao.js` → `perna` em cada passo). Esta função é a MESMA resposta pelo lado
// do catálogo, e serve a dois casos reais: payloads gravados ANTES de a perna existir, e qualquer
// superfície que só tenha o `produto_id` na mão.
// A ordem de resolução tem um motivo: `PRODUCT_DETAIL.pilar` primeiro porque é lá que vivem as
// três capacidades que não são produto vendável (agenda, widget_whatsapp, catalog); depois
// `PRODUCTS.pilar`, a atribuição de negócio que a landing inteira já usa.
// null quando não dá pra saber — nunca um chute. Pendurar um passo na perna errada num documento
// que se vende por não inventar nada seria caro justamente onde é barato só omitir o grupo.
export const pilarDoPasso = (id) => {
  if (!id) return null;
  const d = PRODUCT_DETAIL[id];
  if (d?.pilar) return d.pilar;
  if (d?.base) return productById(d.base)?.pilar || null;
  return productById(id)?.pilar || null;
};

// Ficha completa de um produto no idioma pedido — junta a linha de PRODUCTS (quando existe) com o
// detalhe de entrega. Devolve null quando a chave não existe (a página então mostra só o selo).
export const productDetail = (id, lang = "en") => {
  const d = PRODUCT_DETAIL[id];
  if (!d) return null;
  const p = d.base ? productById(d.base) : null;
  const pick = (o) => (o ? o[lang] || o.en : null);
  return {
    id,
    icon: d.icon || p?.icon || "🎯",
    name: pick(d.name) || pick(p?.name) || id,
    whatIs: pick(d.whatIs) || "",
    bullets: pick(d.bullets) || [],
    prazo: pick(d.prazo) || null,
    // claim aprovado do catálogo (quando o produto existe lá) — nunca reescrito aqui
    result: pick(p?.result) || null,
    resultIsEstimate: !!p?.resultIsEstimate,
  };
};
