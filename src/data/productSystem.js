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
      en: "Gui quotes the exact price, closes the sale, and collects on the call — a pay-link by SMS or a deposit to book.",
      pt: "A Gui passa o preço exato, fecha a venda e cobra na ligação — link de pagamento por SMS ou depósito pra agendar.",
      es: "Gui cotiza el precio exacto, cierra la venta y cobra en la llamada — pay-link por SMS o depósito.",
      hi: "गुई सटीक कीमत देती है, बिक्री बंद करती है और कॉल पर कलेक्ट करती है।",
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
    name: { en: "Websites", pt: "Sites", es: "Sitios web", hi: "वेबसाइट्स" },
    result: {
      en: "Fast, beautiful websites built to convert — with Gui already living inside them.",
      pt: "Sites rápidos e bonitos feitos pra converter — com a Gui já morando dentro deles.",
      es: "Sitios rápidos y hermosos hechos para convertir — con Gui ya viviendo dentro.",
      hi: "तेज़, खूबसूरत वेबसाइट्स जो कन्वर्ट करने के लिए बनी हैं — जिनमें गुई पहले से बसती है।",
    },
    resultMetric: { value: "1×", unit: { en: "build, runs forever", pt: "build, roda pra sempre", es: "build, corre siempre", hi: "बिल्ड, हमेशा" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["scale"],
  },
  {
    id: "apps", pilar: "build", icon: "📱", accent: "#9AA0FF",
    category: { en: "Built once", pt: "Construído uma vez", es: "Construido una vez", hi: "एक बार निर्मित" },
    name: { en: "Apps", pt: "Apps", es: "Apps", hi: "ऐप्स" },
    result: {
      en: "Mobile apps for your customers or your team — designed and shipped end to end.",
      pt: "Apps móveis pros seus clientes ou pro seu time — desenhados e entregues de ponta a ponta.",
      es: "Apps móviles para tus clientes o tu equipo — diseñadas y entregadas de punta a punta.",
      hi: "आपके ग्राहकों या टीम के लिए मोबाइल ऐप्स — डिज़ाइन से डिलीवरी तक।",
    },
    resultMetric: { value: "iOS + Android", unit: { en: "shipped", pt: "publicados", es: "publicadas", hi: "लाइव" } },
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["scale"],
  },
  {
    id: "ecommerce", pilar: "build", icon: "🛒", accent: "#9AA0FF",
    category: { en: "Built once", pt: "Construído uma vez", es: "Construido una vez", hi: "एक बार निर्मित" },
    name: { en: "E-commerce", pt: "E-commerce", es: "E-commerce", hi: "ई-कॉमर्स" },
    result: {
      en: "Online stores with catalog, checkout and payments — ready to sell from day one.",
      pt: "Lojas online com catálogo, checkout e pagamentos — prontas pra vender desde o dia um.",
      es: "Tiendas online con catálogo, checkout y pagos — listas para vender desde el día uno.",
      hi: "कैटलॉग, चेकआउट और पेमेंट के साथ ऑनलाइन स्टोर — पहले दिन से बिक्री के लिए तैयार।",
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
    resultIsEstimate: false, credits: null, activationKey: null, plans: ["growth", "scale"],
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
