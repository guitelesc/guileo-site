import { createContext, useContext, useEffect, useState } from "react";

// ---- Translations (EN source · PT · ES · HI) ----
export const T = {
  en: {
    nav: { solutions:"Solutions", engine:"Engine", industries:"Industries", results:"Results", academy:"Academy", pricing:"Pricing", services:"Services", cta:"Get Started" },
    hero: { eyebrow:"🌿 Nature meets technology · AI for business", h1a:"Work Smart.", h1b:"Grow Faster.", h1c:"Sleep Better.",
      sub_a:"You miss ", sub_b:"35% of your calls", sub_c:" — and every one is money walking out the door. Guileo's AI answers, books and closes every call, 24/7, in any language. You wake up to revenue, not voicemails.",
      cta1:"See what you're losing →", cta2:"Talk to our AI live", b1:"📞 Answered in 1.2s", b2:"📅 Booked +1",
      trust:[["📞","24/7"],["🌍","Any language"],["⚡","Live in 7 days"],["🤝","Real humans"],["🎓","Free Academy"]] },
    why: { eyebrow:"Why you need us", h2:"Every missed call is money you'll never see", sub:"Move the sliders. See your leak. Then we plug it — guaranteed.",
      calls:"Calls / month", value:"Avg. value per customer ($)", losing:"You're losing about", leak:"35% of calls go unanswered — that's the leak.", recover:"With Guileo you'd recover about", peryear:"/year back in your pocket", email:"your@email.com", send:"Show me how to recover it →", sent:"✓ On its way — we plug the leak in under 7 days." },
    engine: { eyebrow:"The part nobody else does", h2:"Your conversations become your marketing engine",
      sub_a:"Most tools just answer the phone. Guileo turns ", sub_b:"every call and message", sub_c:" into your own customer data — then uses it to market back and bring people in again. Your data. Your growth. On autopilot.",
      loop:"And it loops — every new conversation makes your marketing smarter. 🔄",
      steps:[["📞","Every conversation","Calls, WhatsApp, SMS & web — your AI captures and understands each one."],["🧠","Becomes YOUR data","Unified customer profiles with consent: who they are, what they want, when they buy."],["📣","Powers your marketing","Campaigns & ads built from your own customers' real behavior — not guesses."],["💰","Drives repeat revenue","More repeat orders, fewer no-shows, smarter ad spend — running on autopilot."]] },
    numbers: { eyebrow:"The numbers that change your business", h2:"What happens when Guileo runs your front desk", cta:"Turn these into my numbers →",
      stats:[["$","15,000","+","Monthly revenue","avg. client increase"],["","0","","Missed calls","answered in seconds, 24/7"],["+","286","%","Average growth","across performance & sales"],["","3.2","x","ROI in 90 days","guaranteed, or money back"],["-","40","%","Ad waste cut","every dollar works harder"],["+","40","%","More bookings","from calls you used to miss"]] },
    pillars: { eyebrow:"More than automation — your whole operation", h2:"We don't just automate. We run your operation & performance.", sub:"AI agents that sell · websites & apps that convert · content, ads & growth across every channel. One partner for the whole engine.", getcta:"Get this for my business →",
      items:[
        { icon:"🧠", name:"Guileo Brain", tag:"AI agents that never sleep", desc:"Voice & text AI that answers calls, books appointments, qualifies leads and closes deals — 24/7, in any language.", feats:["🎙️ Voice agents","💬 Text & WhatsApp","📅 Bookings & scheduling","🎧 Customer service","⭐ Google reviews","📲 Missed-call text-back"] },
        { icon:"🛠️", name:"Guileo Build", tag:"Websites · Apps · Software", desc:"AI-crafted websites, intelligent apps and custom software — built to convert and scale from day one.", feats:["🌐 Websites that convert","📱 Intelligent apps","🛒 Shopify agent","⚙️ Custom automation","📊 CRM auto-updates","🚀 Live in <7 days"] },
        { icon:"📈", name:"Guileo.AD", tag:"Your whole operation · run & automated", desc:"We don't just automate tasks — we run your entire operation: content, paid ads, social and funnels across every channel.", feats:["📝 Content automated, all channels","📣 Ad campaigns (-40% waste)","🎯 Lead qualification","🔄 Sales funnels","📈 Growth analytics","♻️ Retargeting"] },
      ] },
    channels: { eyebrow:"Every channel, automated", h2:"From LinkedIn to Telegram — we run them all", sub:"Content created, scheduled and optimized across all your channels. One brain, every platform, always on." },
    industries: { eyebrow:"We know your business", h2:"Built for your industry", sub:"A patient calls at 9 PM. A client needs a quote on Sunday. A diner wants a table now. Your AI handles it — instantly." },
    steps: { eyebrow:"Our signature method · from seed to fruit", h2:"The Guileo Method", sub:"Led by real humans, not just bots. We get to know your business — we'll even visit you — then design and build the system that grows your profit. Live in under 7 days.",
      items:[["🌰","Plant the Seed","A human studies your business, finds your revenue leaks, and designs a system built around how you actually work."],["🌿","Nurture Growth","We build & implement it in under 7 days — your AI working 24/7, automating sales & marketing across every channel."],["🌳","Harvest Results","Watch profits climb. +286% performance and 3x faster sales cycles on average — with us optimizing it for you."]] },
    proof: { eyebrow:"Enterprise-grade, by design", h2:"Built on trusted tech — fully compliant", poweredby:"Powered by", compliant:"Compliant with",
      seals:[["🤝","Real Human Guarantee","a real person, always"],["📈","Profitable or it's Free","results or money back"],["🛡️","30-Day Money-Back","zero risk to start"],["⚡","Live in 7 Days","fast, no waiting"]],
      sec_t:"Security & consent built-in", sec_d:"Multi-tenant isolation, encryption everywhere, and a 3-tier consent model with full audit trails. Your customers stay yours.",
      ally_t:"Real humans behind your AI", ally_d:"A real person gets to know your business, designs your system and implements it — then supports you with a live dashboard and answers in hours, not days. The AI works for you; humans build it around you.",
      testimonials:[["Bookings increased 40% in the first month. The AI never misses a call — we wake up to a full calendar.","Dental Clinic · New York"],["We recovered thousands in missed orders. It pays for itself many times over.","Restaurant · multilingual · NY"],["Our ad waste dropped 40% and leads doubled. Guileo runs growth so we run the business.","Med Spa · Florida"]] },
    pricing: { eyebrow:"Tailored, not templated", h2:"No generic plans. A system built around your business.", sub:"We don't sell one-size-fits-all. A real human studies your business and quotes exactly what you need — fixed monthly, never a % of your revenue. 30-day money-back." },
    academy: { eyebrow:"Guileo Academy · free", h2:"Grow the business behind the business", sub:"Entrepreneurship, finance & investing for every owner we work with — clinics, restaurants, salons, shops & service businesses. Free guides that make you sharper.", cta:"Get the free owner's guide →" },
    faq: { eyebrow:"Questions, answered", h2:"FAQ", items:[
      ["What exactly does Guileo do?","We replace your front desk with an AI agent that answers calls, books appointments, qualifies leads and follows up — and turns every interaction into customer intelligence that drives repeat business. We also build your websites, apps and run your ads."],
      ["How fast can we go live?","Most clients are live in under 7 days. We map your workflow, train the agent in your brand voice, connect your calendar/CRM, and launch."],
      ["What if the AI makes a mistake?","The agent is trained on your business and escalates to a human whenever needed. Every call is recorded and reviewed. Voice quality is non-negotiable — if it ever sounds off, we fix it."],
      ["Is my data safe and compliant?","Yes. Multi-tenant isolation, encryption at rest and in transit, and a 3-tier consent model. We comply with HIPAA, GDPR, LGPD, CCPA and PCI. Your customers stay yours."],
      ["How much does it cost?","A fixed monthly subscription plus a one-time setup fee — never a percentage of your revenue. 30-day money-back guarantee. Book a demo for a plan tailored to your volume."],
      ["Do you only serve one industry?","No. Restaurants, clinics, salons, law firms, contractors, e-commerce and more — each gets a tailored agent on the same powerful platform."]] },
    final: { h2:"Stop losing customers. Start tonight.", sub:"Live in under 7 days · 30-day money-back · talk to our AI right now.", wa:"💬 Start on WhatsApp", demo:"📅 Book a demo" },
    footer: { tagline:"AI systems for business — voice agents, websites, apps and growth. We replace the chaos with automation that books, closes and grows. Work smart, grow faster, sleep better.", company:"Company", findus:"Find Us", solutions:"Solutions", svc:"Services & Pricing", academy:"Guileo Academy", faq:"FAQ" },
  },
};

// ---- Portuguese ----
T.pt = {
  nav:{ solutions:"Soluções", engine:"Motor", industries:"Indústrias", results:"Resultados", academy:"Academy", pricing:"Preços", services:"Serviços", cta:"Começar" },
  hero:{ eyebrow:"🌿 Natureza encontra tecnologia · IA para negócios", h1a:"Trabalhe Smart.", h1b:"Cresça Mais Rápido.", h1c:"Durma Melhor.",
    sub_a:"Você perde ", sub_b:"35% das suas ligações", sub_c:" — e cada uma é dinheiro saindo pela porta. A IA da Guileo atende, agenda e fecha cada ligação, 24/7, em qualquer idioma. Você acorda com receita, não com recados.",
    cta1:"Veja o que está perdendo →", cta2:"Fale com nossa IA ao vivo", b1:"📞 Atendida em 1,2s", b2:"📅 Agendado +1",
    trust:[["📞","24/7"],["🌍","Qualquer idioma"],["⚡","No ar em 7 dias"],["🤝","Humanos reais"],["🎓","Academy grátis"]] },
  why:{ eyebrow:"Por que você precisa de nós", h2:"Cada ligação perdida é dinheiro que você nunca verá", sub:"Mexa os controles. Veja o vazamento. A gente tampa — garantido.",
    calls:"Ligações / mês", value:"Valor médio por cliente ($)", losing:"Você está perdendo cerca de", leak:"35% das ligações ficam sem resposta — esse é o vazamento.", recover:"Com a Guileo você recuperaria cerca de", peryear:"/ano de volta no seu bolso", email:"seu@email.com", send:"Mostre como recuperar isso →", sent:"✓ A caminho — tampamos o vazamento em menos de 7 dias." },
  engine:{ eyebrow:"A parte que mais ninguém faz", h2:"Suas conversas viram seu motor de marketing",
    sub_a:"A maioria só atende o telefone. A Guileo transforma ", sub_b:"cada ligação e mensagem", sub_c:" em dados dos seus clientes — e usa isso pra fazer marketing de volta e trazer gente de novo. Seus dados. Seu crescimento. No automático.",
    loop:"E faz um ciclo — cada nova conversa deixa seu marketing mais inteligente. 🔄",
    steps:[["📞","Cada conversa","Ligações, WhatsApp, SMS e web — sua IA captura e entende cada uma."],["🧠","Vira SEU dado","Perfis de clientes unificados com consentimento: quem são, o que querem, quando compram."],["📣","Alimenta seu marketing","Campanhas e ads feitos com o comportamento real dos SEUS clientes — não chute."],["💰","Gera recompra","Mais pedidos repetidos, menos faltas, verba de ads mais esperta — no automático."]] },
  numbers:{ eyebrow:"Os números que mudam seu negócio", h2:"O que acontece quando a Guileo cuida do seu atendimento", cta:"Quero esses números pra mim →",
    stats:[["$","15.000","+","Receita mensal","aumento médio do cliente"],["","0","","Ligações perdidas","atendidas em segundos, 24/7"],["+","286","%","Crescimento médio","em performance e vendas"],["","3,2","x","ROI em 90 dias","garantido ou dinheiro de volta"],["-","40","%","Menos desperdício em ads","cada real trabalha mais"],["+","40","%","Mais agendamentos","de ligações que você perdia"]] },
  pillars:{ eyebrow:"Mais que automação — sua operação inteira", h2:"Não só automatizamos. Cuidamos da sua operação e performance.", sub:"Agentes de IA que vendem · sites e apps que convertem · conteúdo, ads e crescimento em todos os canais. Um parceiro pro motor inteiro.", getcta:"Quero isso no meu negócio →",
    items:[
      { icon:"🧠", name:"Guileo Brain", tag:"Agentes de IA que nunca dormem", desc:"IA de voz e texto que atende ligações, agenda, qualifica leads e fecha vendas — 24/7, em qualquer idioma.", feats:["🎙️ Agentes de voz","💬 Texto e WhatsApp","📅 Agendamentos","🎧 Atendimento","⭐ Avaliações Google","📲 Retorno de ligação perdida"] },
      { icon:"🛠️", name:"Guileo Build", tag:"Sites · Apps · Software", desc:"Sites feitos com IA, apps inteligentes e software sob medida — feitos pra converter e escalar desde o dia um.", feats:["🌐 Sites que convertem","📱 Apps inteligentes","🛒 Agente Shopify","⚙️ Automação sob medida","📊 CRM automático","🚀 No ar em <7 dias"] },
      { icon:"📈", name:"Guileo.AD", tag:"Sua operação inteira · gerida e automatizada", desc:"Não só automatizamos tarefas — cuidamos da operação inteira: conteúdo, anúncios, social e funis em todos os canais.", feats:["📝 Conteúdo automatizado, todos os canais","📣 Campanhas (-40% desperdício)","🎯 Qualificação de leads","🔄 Funis de venda","📈 Analytics de crescimento","♻️ Remarketing"] },
    ] },
  channels:{ eyebrow:"Todo canal, automatizado", h2:"Do LinkedIn ao Telegram — cuidamos de todos", sub:"Conteúdo criado, agendado e otimizado em todos os seus canais. Um cérebro, todas as plataformas, sempre ligado." },
  industries:{ eyebrow:"Conhecemos seu negócio", h2:"Feito para a sua indústria", sub:"Um paciente liga às 21h. Um cliente quer orçamento no domingo. Alguém quer mesa agora. Sua IA resolve — na hora." },
  steps:{ eyebrow:"3 passos pra receita", h2:"No ar em menos de 7 dias",
    items:[["🌰","Plante a Semente","Conte seus objetivos. Achamos seus vazamentos de receita e desenhamos uma IA que vende desde o dia um."],["🌿","Nutra o Crescimento","Construímos e lançamos em menos de 7 dias. Sua IA trabalha 24/7 — fechando, cortando custos, escalando."],["🌳","Colha Resultados","Veja o lucro subir. +286% de performance e ciclos de venda 3x mais rápidos em média."]] },
  proof:{ eyebrow:"Resultados, não promessas", h2:"Confiável, comprovado, em conformidade", poweredby:"Tecnologia", compliant:"Conformidade",
    seals:[["🤝","Garantia de Humano Real","sempre uma pessoa de verdade"],["📈","Lucrativo ou é de graça","resultado ou dinheiro de volta"],["🛡️","Garantia de 30 dias","risco zero pra começar"],["⚡","No ar em 7 dias","rápido, sem espera"]],
    sec_t:"Segurança e consentimento embutidos", sec_d:"Isolamento multi-tenant, criptografia em tudo e consentimento de 3 níveis com auditoria. Seus clientes continuam seus.",
    ally_t:"Somos seu aliado, não um fornecedor", ally_d:"Suporte humano + IA, onboarding em menos de 7 dias, dashboard ao vivo e um time que responde em horas — não dias.",
    testimonials:[["Agendamentos subiram 40% no primeiro mês. A IA nunca perde uma ligação — acordamos com a agenda cheia.","Clínica Odontológica · Nova York"],["Recuperamos milhares em pedidos perdidos. Se paga muitas vezes.","Restaurante · multilíngue · NY"],["Nosso desperdício em ads caiu 40% e os leads dobraram. A Guileo cuida do crescimento, a gente do negócio.","Med Spa · Flórida"]] },
  pricing:{ eyebrow:"Preço honesto", h2:"Mensalidade fixa — nunca % do seu faturamento", sub:"Setup + assinatura. Garantia de 30 dias. Seu dinheiro continua seu." },
  academy:{ eyebrow:"Guileo Academy · grátis", h2:"Faça crescer o negócio por trás do negócio", sub:"Empreendedorismo, finanças e investimento para todo dono que atendemos — clínicas, restaurantes, salões, lojas e serviços. Guias grátis que te deixam mais afiado.", cta:"Pegar o guia grátis do dono →" },
  faq:{ eyebrow:"Perguntas, respondidas", h2:"FAQ", items:[
    ["O que exatamente a Guileo faz?","Substituímos sua recepção por uma IA que atende ligações, agenda, qualifica leads e faz follow-up — e transforma cada interação em inteligência de cliente que gera recompra. Também criamos seus sites, apps e cuidamos dos seus anúncios."],
    ["Em quanto tempo vai ao ar?","A maioria dos clientes está no ar em menos de 7 dias. Mapeamos seu fluxo, treinamos a IA na voz da sua marca, conectamos sua agenda/CRM e lançamos."],
    ["E se a IA errar?","A IA é treinada no seu negócio e passa pra um humano quando precisa. Toda ligação é gravada e revisada. Qualidade de voz é inegociável — se soar mal, a gente corrige."],
    ["Meus dados estão seguros e em conformidade?","Sim. Isolamento multi-tenant, criptografia em repouso e em trânsito, e consentimento de 3 níveis. Conformidade com HIPAA, GDPR, LGPD, CCPA e PCI. Seus clientes continuam seus."],
    ["Quanto custa?","Mensalidade fixa + uma taxa única de setup — nunca um percentual do seu faturamento. Garantia de 30 dias. Agende uma demo pra um plano sob medida pro seu volume."],
    ["Vocês só atendem uma indústria?","Não. Restaurantes, clínicas, salões, advocacia, prestadores, e-commerce e mais — cada um ganha uma IA sob medida na mesma plataforma."]] },
  final:{ h2:"Pare de perder clientes. Comece hoje à noite.", sub:"No ar em menos de 7 dias · garantia de 30 dias · fale com nossa IA agora.", wa:"💬 Começar no WhatsApp", demo:"📅 Agendar demo" },
  footer:{ tagline:"Sistemas de IA para negócios — agentes de voz, sites, apps e crescimento. Trocamos o caos por automação que agenda, fecha e cresce. Trabalhe smart, cresça mais rápido, durma melhor.", company:"Empresa", findus:"Onde Achar", solutions:"Soluções", svc:"Serviços & Preços", academy:"Guileo Academy", faq:"FAQ" },
};

// ---- Spanish ----
T.es = {
  nav:{ solutions:"Soluciones", engine:"Motor", industries:"Industrias", results:"Resultados", academy:"Academy", pricing:"Precios", services:"Servicios", cta:"Empezar" },
  hero:{ eyebrow:"🌿 Naturaleza y tecnología · IA para negocios", h1a:"Trabaja Inteligente.", h1b:"Crece Más Rápido.", h1c:"Duerme Mejor.",
    sub_a:"Pierdes el ", sub_b:"35% de tus llamadas", sub_c:" — y cada una es dinero que se va. La IA de Guileo contesta, agenda y cierra cada llamada, 24/7, en cualquier idioma. Despiertas con ingresos, no con buzones de voz.",
    cta1:"Mira lo que estás perdiendo →", cta2:"Habla con nuestra IA en vivo", b1:"📞 Contestada en 1,2s", b2:"📅 Agendado +1",
    trust:[["📞","24/7"],["🌍","Cualquier idioma"],["⚡","En vivo en 7 días"],["🤝","Humanos reales"],["🎓","Academy gratis"]] },
  why:{ eyebrow:"Por qué nos necesitas", h2:"Cada llamada perdida es dinero que nunca verás", sub:"Mueve los controles. Mira la fuga. La tapamos — garantizado.",
    calls:"Llamadas / mes", value:"Valor medio por cliente ($)", losing:"Estás perdiendo cerca de", leak:"El 35% de las llamadas no se contesta — esa es la fuga.", recover:"Con Guileo recuperarías cerca de", peryear:"/año de vuelta en tu bolsillo", email:"tu@email.com", send:"Muéstrame cómo recuperarlo →", sent:"✓ En camino — tapamos la fuga en menos de 7 días." },
  engine:{ eyebrow:"Lo que nadie más hace", h2:"Tus conversaciones se vuelven tu motor de marketing",
    sub_a:"La mayoría solo contesta el teléfono. Guileo convierte ", sub_b:"cada llamada y mensaje", sub_c:" en datos de tus clientes — y los usa para hacer marketing de vuelta y traer gente otra vez. Tus datos. Tu crecimiento. En automático.",
    loop:"Y se repite — cada nueva conversación hace tu marketing más inteligente. 🔄",
    steps:[["📞","Cada conversación","Llamadas, WhatsApp, SMS y web — tu IA captura y entiende cada una."],["🧠","Se vuelve TU dato","Perfiles de clientes unificados con consentimiento: quiénes son, qué quieren, cuándo compran."],["📣","Impulsa tu marketing","Campañas y anuncios basados en el comportamiento real de TUS clientes — no en suposiciones."],["💰","Genera recompra","Más pedidos repetidos, menos ausencias, gasto en ads más inteligente — en automático."]] },
  numbers:{ eyebrow:"Los números que cambian tu negocio", h2:"Qué pasa cuando Guileo maneja tu recepción", cta:"Quiero estos números →",
    stats:[["$","15.000","+","Ingreso mensual","aumento medio del cliente"],["","0","","Llamadas perdidas","contestadas en segundos, 24/7"],["+","286","%","Crecimiento medio","en performance y ventas"],["","3,2","x","ROI en 90 días","garantizado o te devolvemos"],["-","40","%","Menos gasto en ads","cada dólar rinde más"],["+","40","%","Más reservas","de llamadas que perdías"]] },
  pillars:{ eyebrow:"Más que automatización — toda tu operación", h2:"No solo automatizamos. Manejamos tu operación y performance.", sub:"Agentes de IA que venden · webs y apps que convierten · contenido, ads y crecimiento en cada canal. Un socio para todo el motor.", getcta:"Quiero esto en mi negocio →",
    items:[
      { icon:"🧠", name:"Guileo Brain", tag:"Agentes de IA que nunca duermen", desc:"IA de voz y texto que contesta llamadas, agenda, califica leads y cierra ventas — 24/7, en cualquier idioma.", feats:["🎙️ Agentes de voz","💬 Texto y WhatsApp","📅 Agendamiento","🎧 Atención al cliente","⭐ Reseñas Google","📲 Devolución de llamada perdida"] },
      { icon:"🛠️", name:"Guileo Build", tag:"Webs · Apps · Software", desc:"Webs hechas con IA, apps inteligentes y software a medida — para convertir y escalar desde el día uno.", feats:["🌐 Webs que convierten","📱 Apps inteligentes","🛒 Agente Shopify","⚙️ Automatización a medida","📊 CRM automático","🚀 En vivo en <7 días"] },
      { icon:"📈", name:"Guileo.AD", tag:"Toda tu operación · gestionada y automatizada", desc:"No solo automatizamos tareas — manejamos toda tu operación: contenido, anuncios, social y embudos en cada canal.", feats:["📝 Contenido automatizado, todos los canales","📣 Campañas (-40% desperdicio)","🎯 Calificación de leads","🔄 Embudos de venta","📈 Analítica de crecimiento","♻️ Remarketing"] },
    ] },
  channels:{ eyebrow:"Cada canal, automatizado", h2:"De LinkedIn a Telegram — los manejamos todos", sub:"Contenido creado, programado y optimizado en todos tus canales. Un cerebro, cada plataforma, siempre activo." },
  industries:{ eyebrow:"Conocemos tu negocio", h2:"Hecho para tu industria", sub:"Un paciente llama a las 21h. Un cliente quiere cotización el domingo. Alguien quiere mesa ahora. Tu IA lo resuelve — al instante." },
  steps:{ eyebrow:"3 pasos al ingreso", h2:"En vivo en menos de 7 días",
    items:[["🌰","Planta la Semilla","Cuéntanos tus metas. Encontramos tus fugas de ingreso y diseñamos una IA que vende desde el día uno."],["🌿","Nutre el Crecimiento","Construimos y lanzamos en menos de 7 días. Tu IA trabaja 24/7 — cerrando, recortando costos, escalando."],["🌳","Cosecha Resultados","Mira subir las ganancias. +286% de performance y ciclos de venta 3x más rápidos en promedio."]] },
  proof:{ eyebrow:"Resultados, no promesas", h2:"Confiable, probado, en cumplimiento", poweredby:"Tecnología", compliant:"Cumplimiento",
    seals:[["🤝","Garantía de Humano Real","siempre una persona real"],["📈","Rentable o es Gratis","resultados o te devolvemos"],["🛡️","Garantía de 30 días","cero riesgo para empezar"],["⚡","En vivo en 7 días","rápido, sin esperas"]],
    sec_t:"Seguridad y consentimiento integrados", sec_d:"Aislamiento multi-tenant, cifrado en todo y consentimiento de 3 niveles con auditoría. Tus clientes siguen siendo tuyos.",
    ally_t:"Somos tu aliado, no un proveedor", ally_d:"Soporte humano + IA, onboarding en menos de 7 días, dashboard en vivo y un equipo que responde en horas — no días.",
    testimonials:[["Las reservas subieron 40% el primer mes. La IA nunca pierde una llamada — despertamos con la agenda llena.","Clínica Dental · Nueva York"],["Recuperamos miles en pedidos perdidos. Se paga muchas veces.","Restaurante · multilingüe · NY"],["Nuestro gasto en ads bajó 40% y los leads se duplicaron. Guileo maneja el crecimiento, nosotros el negocio.","Med Spa · Florida"]] },
  pricing:{ eyebrow:"Precio honesto", h2:"Tarifa mensual fija — nunca un % de tus ingresos", sub:"Setup + suscripción. Garantía de 30 días. Tu dinero sigue siendo tuyo." },
  academy:{ eyebrow:"Guileo Academy · gratis", h2:"Haz crecer el negocio detrás del negocio", sub:"Emprendimiento, finanzas e inversión para cada dueño con quien trabajamos — clínicas, restaurantes, salones, tiendas y servicios. Guías gratis que te hacen más agudo.", cta:"Obtén la guía gratis del dueño →" },
  faq:{ eyebrow:"Preguntas, respondidas", h2:"FAQ", items:[
    ["¿Qué hace exactamente Guileo?","Reemplazamos tu recepción por una IA que contesta llamadas, agenda, califica leads y hace seguimiento — y convierte cada interacción en inteligencia de cliente que genera recompra. También creamos tus webs, apps y manejamos tus anuncios."],
    ["¿Qué tan rápido salimos en vivo?","La mayoría sale en menos de 7 días. Mapeamos tu flujo, entrenamos la IA en la voz de tu marca, conectamos tu agenda/CRM y lanzamos."],
    ["¿Y si la IA se equivoca?","La IA se entrena en tu negocio y escala a un humano cuando hace falta. Cada llamada se graba y revisa. La calidad de voz es innegociable — si suena mal, lo arreglamos."],
    ["¿Mis datos están seguros y en cumplimiento?","Sí. Aislamiento multi-tenant, cifrado en reposo y en tránsito, y consentimiento de 3 niveles. Cumplimos HIPAA, GDPR, LGPD, CCPA y PCI. Tus clientes siguen siendo tuyos."],
    ["¿Cuánto cuesta?","Una suscripción mensual fija más una tarifa única de setup — nunca un porcentaje de tus ingresos. Garantía de 30 días. Agenda una demo para un plan a tu medida."],
    ["¿Solo atienden una industria?","No. Restaurantes, clínicas, salones, despachos, contratistas, e-commerce y más — cada uno recibe una IA a medida en la misma plataforma."]] },
  final:{ h2:"Deja de perder clientes. Empieza esta noche.", sub:"En vivo en menos de 7 días · garantía de 30 días · habla con nuestra IA ahora.", wa:"💬 Empezar en WhatsApp", demo:"📅 Agendar demo" },
  footer:{ tagline:"Sistemas de IA para negocios — agentes de voz, webs, apps y crecimiento. Cambiamos el caos por automatización que agenda, cierra y crece. Trabaja inteligente, crece más rápido, duerme mejor.", company:"Empresa", findus:"Encuéntranos", solutions:"Soluciones", svc:"Servicios y Precios", academy:"Guileo Academy", faq:"FAQ" },
};

// ---- Hindi ----
T.hi = {
  nav:{ solutions:"समाधान", engine:"इंजन", industries:"उद्योग", results:"परिणाम", academy:"Academy", pricing:"मूल्य", services:"सेवाएँ", cta:"शुरू करें" },
  hero:{ eyebrow:"🌿 प्रकृति और तकनीक · व्यवसाय के लिए AI", h1a:"स्मार्ट काम करें.", h1b:"तेज़ी से बढ़ें.", h1c:"चैन की नींद लें.",
    sub_a:"आप अपनी ", sub_b:"35% कॉल मिस करते हैं", sub_c:" — और हर एक पैसा हाथ से निकल जाता है। Guileo की AI हर कॉल का जवाब देती है, बुकिंग करती है और डील बंद करती है, 24/7, किसी भी भाषा में। आप वॉइसमेल नहीं, कमाई के साथ जागते हैं।",
    cta1:"देखें आप क्या खो रहे हैं →", cta2:"हमारी AI से लाइव बात करें", b1:"📞 1.2s में उत्तर", b2:"📅 बुक +1",
    trust:[["📞","24/7"],["🌍","कोई भी भाषा"],["⚡","7 दिनों में लाइव"],["🤝","असली इंसान"],["🎓","मुफ़्त Academy"]] },
  why:{ eyebrow:"आपको हमारी ज़रूरत क्यों है", h2:"हर मिस्ड कॉल वह पैसा है जो आप कभी नहीं देखेंगे", sub:"स्लाइडर घुमाएँ। रिसाव देखें। फिर हम उसे बंद करते हैं — गारंटी के साथ।",
    calls:"कॉल / माह", value:"प्रति ग्राहक औसत मूल्य ($)", losing:"आप लगभग खो रहे हैं", leak:"35% कॉल अनुत्तरित रहती हैं — यही रिसाव है।", recover:"Guileo के साथ आप लगभग वापस पाएँगे", peryear:"/वर्ष आपकी जेब में वापस", email:"aapka@email.com", send:"दिखाएँ इसे कैसे वापस पाऊँ →", sent:"✓ भेज दिया — हम 7 दिनों में रिसाव बंद कर देते हैं।" },
  engine:{ eyebrow:"जो और कोई नहीं करता", h2:"आपकी बातचीत आपका मार्केटिंग इंजन बन जाती है",
    sub_a:"ज़्यादातर टूल बस फ़ोन उठाते हैं। Guileo ", sub_b:"हर कॉल और मैसेज", sub_c:" को आपके अपने ग्राहक डेटा में बदलती है — फिर उसी से दोबारा मार्केटिंग करके लोगों को वापस लाती है। आपका डेटा। आपकी ग्रोथ। ऑटोपायलट पर।",
    loop:"और यह दोहराता है — हर नई बातचीत आपकी मार्केटिंग को और स्मार्ट बनाती है। 🔄",
    steps:[["📞","हर बातचीत","कॉल, WhatsApp, SMS और वेब — आपकी AI हर एक को समझती और पकड़ती है।"],["🧠","आपका डेटा बनता है","सहमति के साथ एकीकृत ग्राहक प्रोफ़ाइल: वे कौन हैं, क्या चाहते हैं, कब खरीदते हैं।"],["📣","आपकी मार्केटिंग चलाता है","आपके अपने ग्राहकों के असली व्यवहार से बने कैम्पेन और विज्ञापन — अंदाज़े नहीं।"],["💰","दोबारा कमाई लाता है","ज़्यादा रिपीट ऑर्डर, कम नो-शो, स्मार्ट ऐड खर्च — ऑटोपायलट पर।"]] },
  numbers:{ eyebrow:"वे आँकड़े जो आपका व्यवसाय बदल दें", h2:"जब Guileo आपका फ्रंट डेस्क संभालती है तो क्या होता है", cta:"इन्हें मेरे आँकड़े बनाएँ →",
    stats:[["$","15,000","+","मासिक राजस्व","औसत ग्राहक वृद्धि"],["","0","","मिस्ड कॉल","सेकंडों में उत्तर, 24/7"],["+","286","%","औसत ग्रोथ","परफ़ॉर्मेंस और बिक्री में"],["","3.2","x","90 दिनों में ROI","गारंटी या पैसा वापस"],["-","40","%","ऐड खर्च में कमी","हर डॉलर ज़्यादा काम करे"],["+","40","%","ज़्यादा बुकिंग","उन कॉल से जो छूट जाती थीं"]] },
  pillars:{ eyebrow:"सिर्फ़ ऑटोमेशन नहीं — आपका पूरा ऑपरेशन", h2:"हम सिर्फ़ ऑटोमेट नहीं करते। हम आपका ऑपरेशन और परफ़ॉर्मेंस चलाते हैं।", sub:"AI एजेंट जो बेचते हैं · वेबसाइट और ऐप जो कन्वर्ट करते हैं · हर चैनल पर कंटेंट, ऐड और ग्रोथ। पूरे इंजन के लिए एक पार्टनर।", getcta:"मेरे व्यवसाय के लिए चाहिए →",
    items:[
      { icon:"🧠", name:"Guileo Brain", tag:"AI एजेंट जो कभी नहीं सोते", desc:"वॉइस और टेक्स्ट AI जो कॉल का उत्तर देती है, बुकिंग करती है, लीड क्वालिफाई करती है और डील बंद करती है — 24/7, किसी भी भाषा में।", feats:["🎙️ वॉइस एजेंट","💬 टेक्स्ट और WhatsApp","📅 बुकिंग","🎧 ग्राहक सेवा","⭐ Google समीक्षाएँ","📲 मिस्ड-कॉल टेक्स्ट-बैक"] },
      { icon:"🛠️", name:"Guileo Build", tag:"वेबसाइट · ऐप · सॉफ़्टवेयर", desc:"AI से बनी वेबसाइट, स्मार्ट ऐप और कस्टम सॉफ़्टवेयर — पहले दिन से कन्वर्ट और स्केल के लिए बने।", feats:["🌐 कन्वर्ट करने वाली वेबसाइट","📱 स्मार्ट ऐप","🛒 Shopify एजेंट","⚙️ कस्टम ऑटोमेशन","📊 CRM ऑटो-अपडेट","🚀 <7 दिनों में लाइव"] },
      { icon:"📈", name:"Guileo.AD", tag:"आपका पूरा ऑपरेशन · संचालित और ऑटोमेटेड", desc:"हम सिर्फ़ काम ऑटोमेट नहीं करते — हम आपका पूरा ऑपरेशन चलाते हैं: कंटेंट, विज्ञापन, सोशल और फ़नल हर चैनल पर।", feats:["📝 कंटेंट ऑटोमेटेड, सभी चैनल","📣 कैम्पेन (-40% बर्बादी)","🎯 लीड क्वालिफिकेशन","🔄 सेल्स फ़नल","📈 ग्रोथ एनालिटिक्स","♻️ रीटार्गेटिंग"] },
    ] },
  channels:{ eyebrow:"हर चैनल, ऑटोमेटेड", h2:"LinkedIn से Telegram तक — हम सब संभालते हैं", sub:"आपके सभी चैनलों पर कंटेंट बनाया, शेड्यूल और ऑप्टिमाइज़ किया जाता है। एक दिमाग, हर प्लेटफ़ॉर्म, हमेशा ऑन।" },
  industries:{ eyebrow:"हम आपका व्यवसाय जानते हैं", h2:"आपके उद्योग के लिए बना", sub:"रात 9 बजे मरीज़ कॉल करता है। रविवार को ग्राहक कोटेशन चाहता है। कोई अभी टेबल चाहता है। आपकी AI तुरंत संभालती है।" },
  steps:{ eyebrow:"राजस्व तक 3 कदम", h2:"7 दिनों से कम में लाइव",
    items:[["🌰","बीज बोएँ","अपने लक्ष्य बताएँ। हम आपके राजस्व रिसाव ढूँढते हैं और पहले दिन से बिक्री लाने वाली AI डिज़ाइन करते हैं।"],["🌿","ग्रोथ को पोषें","हम 7 दिनों से कम में बनाकर लॉन्च करते हैं। आपकी AI 24/7 काम करती है — डील बंद करना, लागत घटाना, स्केल करना।"],["🌳","परिणाम काटें","मुनाफ़ा बढ़ता देखें। औसतन +286% परफ़ॉर्मेंस और 3x तेज़ बिक्री चक्र।"]] },
  proof:{ eyebrow:"परिणाम, वादे नहीं", h2:"भरोसेमंद, प्रमाणित, अनुपालन-योग्य", poweredby:"तकनीक", compliant:"अनुपालन",
    seals:[["🤝","असली इंसान की गारंटी","हमेशा एक असली व्यक्ति"],["📈","लाभदायक या मुफ़्त","परिणाम या पैसा वापस"],["🛡️","30-दिन मनी-बैक","ज़ीरो जोखिम"],["⚡","7 दिनों में लाइव","तेज़, बिना इंतज़ार"]],
    sec_t:"सुरक्षा और सहमति अंतर्निहित", sec_d:"मल्टी-टेनेंट आइसोलेशन, हर जगह एन्क्रिप्शन, और पूर्ण ऑडिट के साथ 3-स्तरीय सहमति मॉडल। आपके ग्राहक आपके ही रहते हैं।",
    ally_t:"हम आपके सहयोगी हैं, विक्रेता नहीं", ally_d:"मानव + AI सपोर्ट, 7 दिनों से कम में ऑनबोर्डिंग, लाइव डैशबोर्ड, और एक टीम जो घंटों में जवाब देती है — दिनों में नहीं।",
    testimonials:[["पहले महीने में बुकिंग 40% बढ़ी। AI कभी कॉल नहीं चूकती — हम भरे कैलेंडर के साथ जागते हैं।","डेंटल क्लिनिक · न्यूयॉर्क"],["हमने हज़ारों के छूटे ऑर्डर वापस पाए। यह कई गुना वसूल हो जाता है।","रेस्टोरेंट · बहुभाषी · NY"],["हमारा ऐड खर्च 40% घटा और लीड दोगुने हुए। Guileo ग्रोथ संभालती है, हम व्यवसाय।","मेड स्पा · फ्लोरिडा"]] },
  pricing:{ eyebrow:"ईमानदार मूल्य", h2:"निश्चित मासिक शुल्क — कभी आपके राजस्व का % नहीं", sub:"सेटअप + सब्सक्रिप्शन। 30-दिन मनी-बैक। आपका पैसा आपका ही रहता है।" },
  academy:{ eyebrow:"Guileo Academy · मुफ़्त", h2:"व्यवसाय के पीछे के व्यवसाय को बढ़ाएँ", sub:"हर उस मालिक के लिए उद्यमिता, वित्त और निवेश जिनके साथ हम काम करते हैं — क्लिनिक, रेस्टोरेंट, सैलून, दुकानें और सेवाएँ। मुफ़्त गाइड जो आपको और तेज़ बनाएँ।", cta:"मालिक की मुफ़्त गाइड पाएँ →" },
  faq:{ eyebrow:"सवाल, जवाब", h2:"FAQ", items:[
    ["Guileo वास्तव में क्या करती है?","हम आपके फ्रंट डेस्क को एक AI एजेंट से बदलते हैं जो कॉल का उत्तर देता है, बुकिंग करता है, लीड क्वालिफाई करता है और फॉलो-अप करता है — और हर इंटरैक्शन को ग्राहक इंटेलिजेंस में बदलता है जो दोबारा बिक्री लाती है। हम आपकी वेबसाइट, ऐप भी बनाते हैं और आपके विज्ञापन चलाते हैं।"],
    ["कितनी जल्दी लाइव हो सकते हैं?","ज़्यादातर ग्राहक 7 दिनों से कम में लाइव होते हैं। हम आपका वर्कफ़्लो मैप करते हैं, AI को आपके ब्रांड की आवाज़ में ट्रेन करते हैं, आपका कैलेंडर/CRM जोड़ते हैं और लॉन्च करते हैं।"],
    ["अगर AI गलती करे तो?","AI आपके व्यवसाय पर ट्रेन होती है और ज़रूरत पड़ने पर इंसान को सौंप देती है। हर कॉल रिकॉर्ड और रिव्यू होती है। वॉइस क्वालिटी पर समझौता नहीं — अगर कभी खराब लगे, हम ठीक करते हैं।"],
    ["क्या मेरा डेटा सुरक्षित और अनुपालन में है?","हाँ। मल्टी-टेनेंट आइसोलेशन, रेस्ट और ट्रांज़िट में एन्क्रिप्शन, और 3-स्तरीय सहमति। हम HIPAA, GDPR, LGPD, CCPA और PCI का पालन करते हैं। आपके ग्राहक आपके ही रहते हैं।"],
    ["कीमत कितनी है?","एक निश्चित मासिक सब्सक्रिप्शन और एक बार का सेटअप शुल्क — कभी आपके राजस्व का प्रतिशत नहीं। 30-दिन मनी-बैक। अपने वॉल्यूम के हिसाब से प्लान के लिए डेमो बुक करें।"],
    ["क्या आप सिर्फ़ एक उद्योग की सेवा करते हैं?","नहीं। रेस्टोरेंट, क्लिनिक, सैलून, लॉ फ़र्म, ठेकेदार, ई-कॉमर्स और बहुत कुछ — हर एक को उसी शक्तिशाली प्लेटफ़ॉर्म पर अनुकूलित AI मिलती है।"]] },
  final:{ h2:"ग्राहक खोना बंद करें। आज रात ही शुरू करें।", sub:"7 दिनों से कम में लाइव · 30-दिन मनी-बैक · अभी हमारी AI से बात करें।", wa:"💬 WhatsApp पर शुरू करें", demo:"📅 डेमो बुक करें" },
  footer:{ tagline:"व्यवसाय के लिए AI सिस्टम — वॉइस एजेंट, वेबसाइट, ऐप और ग्रोथ। हम अराजकता को ऐसे ऑटोमेशन से बदलते हैं जो बुक करता, बंद करता और बढ़ाता है। स्मार्ट काम करें, तेज़ बढ़ें, चैन से सोएँ।", company:"कंपनी", findus:"हमें खोजें", solutions:"समाधान", svc:"सेवाएँ और मूल्य", academy:"Guileo Academy", faq:"FAQ" },
};

// Industries (translated) + pricing plans (translated) merged onto each language
const IND = {
  en:[["⚖️","Law Firms"],["🏥","Medical Clinics"],["🦷","Dental Clinics"],["🔧","Plumbing & HVAC"],["🛒","E-Commerce"],["🍽️","Restaurants"],["🏠","Real Estate"],["💪","Gyms & Fitness"],["🚗","Auto Dealerships"],["💈","Salons & Spas"],["📚","Education & Coaching"],["🏗️","Construction"]],
  pt:[["⚖️","Advocacia"],["🏥","Clínicas Médicas"],["🦷","Odontologia"],["🔧","Encanador & HVAC"],["🛒","E-Commerce"],["🍽️","Restaurantes"],["🏠","Imobiliárias"],["💪","Academias"],["🚗","Concessionárias"],["💈","Salões & Spas"],["📚","Educação"],["🏗️","Construção"]],
  es:[["⚖️","Despachos"],["🏥","Clínicas Médicas"],["🦷","Dentistas"],["🔧","Fontanería & HVAC"],["🛒","E-Commerce"],["🍽️","Restaurantes"],["🏠","Inmobiliarias"],["💪","Gimnasios"],["🚗","Concesionarias"],["💈","Salones & Spas"],["📚","Educación"],["🏗️","Construcción"]],
  hi:[["⚖️","लॉ फ़र्म"],["🏥","मेडिकल क्लिनिक"],["🦷","डेंटल क्लिनिक"],["🔧","प्लंबिंग & HVAC"],["🛒","ई-कॉमर्स"],["🍽️","रेस्टोरेंट"],["🏠","रियल एस्टेट"],["💪","जिम & फ़िटनेस"],["🚗","ऑटो डीलरशिप"],["💈","सैलून & स्पा"],["📚","शिक्षा & कोचिंग"],["🏗️","निर्माण"]],
};
const PRICE = {
  en:[
    { name:"Essential", tag:"Start simple", price:"Tailored", per:"", feats:["1 AI agent (voice or text)","Bookings & follow-ups","A human sets it up with you","30-day money-back"], cta:"Get my quote" },
    { name:"Personalized", tag:"Most popular", price:"Built for you", per:"", feats:["Voice + text + WhatsApp + social","Sales & marketing automation","A human designs it around your business","Live dashboard & priority support"], cta:"Book a discovery call", featured:true },
    { name:"Full Operation", tag:"We run it all", price:"Let's talk", per:"", feats:["Every channel + ads + your data","Custom systems built for you","Deep, hands-on implementation","Dedicated team & strategy"], cta:"Talk to us" } ],
  pt:[
    { name:"Starter", tag:"Um canal", price:"a partir de $299", per:"/mês", feats:["1 agente de IA (voz ou texto)","Agendamentos & follow-ups","Setup + treinamento incluídos","Garantia de 30 dias"], cta:"Agendar demo" },
    { name:"Growth", tag:"Mais popular", price:"a partir de $699", per:"/mês", feats:["Voz + texto + WhatsApp","Campanhas & Avaliações Google","Dashboard de analytics","Suporte prioritário"], cta:"Agendar demo", featured:true },
    { name:"Scale", tag:"Plataforma completa", price:"Sob consulta", per:"", feats:["Todos os canais + CDP","Anúncios (Guileo.AD)","ML preditivo & audiências","Onboarding white-glove"], cta:"Falar conosco" } ],
  es:[
    { name:"Starter", tag:"Un canal", price:"desde $299", per:"/mes", feats:["1 agente de IA (voz o texto)","Reservas & seguimientos","Setup + entrenamiento incluidos","Garantía de 30 días"], cta:"Agendar demo" },
    { name:"Growth", tag:"Más popular", price:"desde $699", per:"/mes", feats:["Voz + texto + WhatsApp","Campañas & Reseñas Google","Dashboard de analítica","Soporte prioritario"], cta:"Agendar demo", featured:true },
    { name:"Scale", tag:"Plataforma completa", price:"A medida", per:"", feats:["Todos los canales + CDP","Anuncios (Guileo.AD)","ML predictivo & audiencias","Onboarding white-glove"], cta:"Hablar con nosotros" } ],
  hi:[
    { name:"Starter", tag:"एक चैनल", price:"$299 से", per:"/माह", feats:["1 AI एजेंट (वॉइस या टेक्स्ट)","बुकिंग & फॉलो-अप","सेटअप + ट्रेनिंग शामिल","30-दिन मनी-बैक"], cta:"डेमो बुक करें" },
    { name:"Growth", tag:"सबसे लोकप्रिय", price:"$699 से", per:"/माह", feats:["वॉइस + टेक्स्ट + WhatsApp","कैम्पेन & Google समीक्षाएँ","एनालिटिक्स डैशबोर्ड","प्राथमिकता सपोर्ट"], cta:"डेमो बुक करें", featured:true },
    { name:"Scale", tag:"पूर्ण प्लेटफ़ॉर्म", price:"कस्टम", per:"", feats:["सभी चैनल + CDP","विज्ञापन (Guileo.AD)","प्रेडिक्टिव ML & ऑडियंस","व्हाइट-ग्लव ऑनबोर्डिंग"], cta:"हमसे बात करें" } ],
};
// ---- New sections (CORE_OFFER · integrations · comparison) translated ----
const MORE = {
  en: {
    whatwedo:"What we do",
    products:{ line:"From your first website to your final sale — we build all of it.",
      items:[["🎙️","Voice AI agents"],["💬","Text & WhatsApp AI"],["🌐","Websites"],["📱","Mobile apps"],["⚙️","Custom software"],["📣","Ads & marketing"],["📅","Booking systems"],["🛒","E-commerce / Shopify"],["🔄","Automations"],["📊","Dashboards & CRM"],["⭐","Reviews & reputation"],["📈","Growth & analytics"]] },
    coreLine:"Two engines grow your business — your marketing and your daily operation. Run by AI, managed by real humans.",
    doesLabel:"What it does", changesLabel:"What it changes",
    coreSupport:"And we build the websites, apps & voice agents that make it all run.",
    charts:{ eyebrow:"Real results", title:"Growth you can see", rows:[["💰","Revenue growth",92,"+286%"],["📞","Calls answered",100,"24/7"],["🎯","Ad efficiency",85,"−40% waste"],["📅","Repeat bookings",78,"+40%"]] },
    adv:{ eyebrow:"Why Guileo", line:"Everything you gain by having us on your side.",
      items:[
        ["🌙","Never miss a customer","+",35,"%","more leads — answered 24/7"],
        ["📣","Marketing on autopilot","+",286,"%","growth, fully hands-off"],
        ["⚙️","No more busywork","",20,"h","saved every week"],
        ["🤝","Real humans behind it","",98,"%","clients stay & refer"],
        ["🚀","Live in days","",7,"","days to go live"],
        ["💰","Keep your margin","−",40,"%","vs hiring an agency"],
      ] },
    core:[
      ["📈","Marketing — your bridge to the ads","We become the bridge between your business and your ad accounts. Like a mega-AI marketing department, we connect Meta & Google Ads and run them daily — campaigns, creatives, audiences and budget, optimized non-stop.","More of the right customers, less wasted ad spend, and growth you can predict — without you ever opening an ad manager."],
      ["⚙️","AI Automations — your daily operation","Your AI answers calls, texts & WhatsApp, qualifies leads, quotes, books, follows up and even handles payments — 24/7, across every channel.","Nothing falls through the cracks, the busywork disappears, and you wake up to booked appointments and revenue."],
    ],
    numbersMission:"Our mission: give every business the AI edge that big companies have — so you grow without limits. These are the average results.",
    lead:{ title:"Leave your contact — we'll reach out", sub:"Tell us where to reach you. A real human gets back to you fast — usually within hours.", name:"Your name", email:"Email", phone:"Phone / WhatsApp", business:"Your business (optional)", submit:"Get my free quote →", sending:"Sending…", successT:"Got it! 🎉", successD:"We'll reach out shortly — usually within a few hours.", privacy:"No spam. Your info stays private and is only used to contact you.", wamsg:"Hi Guileo! I'd like a quote:" },
    callbar:{ line:"Hear it for yourself — our AI calls you in seconds.", placeholder:"Your phone / WhatsApp", cta:"Call me now", calling:"Calling…", done:"📞 Calling you now — pick up!" },
    integ:{ eyebrow:"Works with what you already use", h2:"Plugs into your whole stack", sub:"Shopify, Etsy, WhatsApp, your calendar, your CRM — your AI works inside the tools you already have. No switching, no migration.", ask:"Use something else? We integrate with almost anything.", asklink:"Ask us →" },
    integGroups:["Ads & Growth","E-commerce","Messaging & Social","Calendar & CRM","Payments & Ops"],
    comp:{ eyebrow:"The obvious choice", h2:"Guileo vs. the alternatives", sub:"Same problem, very different outcomes. See why businesses pick Guileo.", cta:"Make Guileo my choice →",
      cols:["","Guileo","Human receptionist","Other AI tools","Doing nothing"],
      rows:[
        ["Answers 24/7 / multilingual","✅","❌ (shifts, 1 language)","⚠️ partial","❌"],
        ["Books, sells & follows up","✅","⚠️ limited","⚠️ FAQ only","❌"],
        ["Turns calls into marketing data","✅","❌","❌","❌"],
        ["Runs your ads & content too","✅","❌","❌","❌"],
        ["Monthly cost","Fixed, low","$3–6k/mo","Varies","Lost revenue"],
        ["Live in","< 7 days","Weeks to hire","DIY setup","—"],
        ["Gets smarter every day","✅","❌","❌","❌"],
        ["One partner for everything","✅","❌","❌","❌"],
      ] },
  },
  pt: {
    whatwedo:"O que fazemos",
    products:{ line:"Do seu primeiro site até a sua venda final — a gente constrói tudo.",
      items:[["🎙️","Agentes de voz IA"],["💬","Texto & WhatsApp IA"],["🌐","Sites"],["📱","Apps"],["⚙️","Software sob medida"],["📣","Anúncios & marketing"],["📅","Sistemas de agendamento"],["🛒","E-commerce / Shopify"],["🔄","Automações"],["📊","Dashboards & CRM"],["⭐","Avaliações & reputação"],["📈","Crescimento & analytics"]] },
    coreLine:"Dois motores fazem seu negócio crescer — seu marketing e sua operação do dia a dia. Movidos por IA, geridos por humanos de verdade.",
    doesLabel:"O que faz", changesLabel:"O que muda",
    coreSupport:"E construímos os sites, apps e agentes de voz que fazem tudo rodar.",
    charts:{ eyebrow:"Resultados reais", title:"Crescimento que dá pra ver", rows:[["💰","Crescimento de receita",92,"+286%"],["📞","Ligações atendidas",100,"24/7"],["🎯","Eficiência de ads",85,"−40% desperdício"],["📅","Recompra",78,"+40%"]] },
    adv:{ eyebrow:"Por que a Guileo", line:"Tudo o que você ganha tendo a gente do seu lado.",
      items:[
        ["🌙","Nunca perca um cliente","+",35,"%","mais leads — atende 24/7"],
        ["📣","Marketing no automático","+",286,"%","de crescimento, sem esforço"],
        ["⚙️","Chega de trabalho manual","",20,"h","economizadas por semana"],
        ["🤝","Humanos de verdade por trás","",98,"%","clientes ficam e indicam"],
        ["🚀","No ar em dias","",7,"","dias pra ir ao ar"],
        ["💰","Mantenha sua margem","−",40,"%","vs contratar agência"],
      ] },
    core:[
      ["📈","Marketing — sua ponte para os anúncios","Viramos a ponte entre o seu negócio e suas contas de anúncios. Como um departamento de marketing mega-IA, conectamos Meta & Google Ads e cuidamos deles todo dia — campanhas, criativos, públicos e verba, otimizados sem parar.","Mais clientes certos, menos verba desperdiçada e um crescimento que dá pra prever — sem você abrir um gerenciador de anúncios."],
      ["⚙️","Automações de IA — sua operação diária","Sua IA atende ligações, textos & WhatsApp, qualifica leads, orça, agenda, faz follow-up e até cuida de pagamentos — 24/7, em todos os canais.","Nada escapa, o trabalho manual some, e você acorda com a agenda cheia e receita entrando."],
    ],
    numbersMission:"Nossa missão: dar a todo negócio a vantagem de IA que as grandes empresas têm — pra você crescer sem limites. Estes são os resultados médios.",
    lead:{ title:"Deixe seu contato — a gente te chama", sub:"Diga onde te encontrar. Um humano de verdade retorna rápido — normalmente em horas.", name:"Seu nome", email:"Email", phone:"Telefone / WhatsApp", business:"Seu negócio (opcional)", submit:"Quero meu orçamento grátis →", sending:"Enviando…", successT:"Recebido! 🎉", successD:"A gente te chama em breve — normalmente em algumas horas.", privacy:"Sem spam. Seus dados ficam privados e só são usados pra te contatar.", wamsg:"Oi Guileo! Quero um orçamento:" },
    callbar:{ line:"Ouça você mesmo — nossa IA te liga em segundos.", placeholder:"Seu telefone / WhatsApp", cta:"Me liga agora", calling:"Ligando…", done:"📞 Te ligando agora — atende!" },
    integ:{ eyebrow:"Funciona com o que você já usa", h2:"Encaixa em toda a sua stack", sub:"Shopify, Etsy, WhatsApp, sua agenda, seu CRM — sua IA trabalha dentro das ferramentas que você já tem. Sem trocar nada, sem migração.", ask:"Usa outra coisa? Integramos com quase tudo.", asklink:"Fale com a gente →" },
    integGroups:["Anúncios & Growth","E-commerce","Mensagens & Social","Agenda & CRM","Pagamentos & Ops"],
    comp:{ eyebrow:"A escolha óbvia", h2:"Guileo vs. as alternativas", sub:"Mesmo problema, resultados bem diferentes. Veja por que os negócios escolhem a Guileo.", cta:"Quero a Guileo →",
      cols:["","Guileo","Recepcionista humano","Outras IAs","Não fazer nada"],
      rows:[
        ["Atende 24/7 / multilíngue","✅","❌ (turnos, 1 idioma)","⚠️ parcial","❌"],
        ["Agenda, vende & faz follow-up","✅","⚠️ limitado","⚠️ só FAQ","❌"],
        ["Transforma ligações em dados de marketing","✅","❌","❌","❌"],
        ["Também cuida dos seus anúncios & conteúdo","✅","❌","❌","❌"],
        ["Custo mensal","Fixo, baixo","$3–6k/mês","Varia","Receita perdida"],
        ["No ar em","< 7 dias","Semanas pra contratar","Você que monta","—"],
        ["Fica mais inteligente todo dia","✅","❌","❌","❌"],
        ["Um parceiro pra tudo","✅","❌","❌","❌"],
      ] },
  },
  es: {
    whatwedo:"Qué hacemos",
    products:{ line:"De tu primera web a tu venta final — lo construimos todo.",
      items:[["🎙️","Agentes de voz IA"],["💬","Texto & WhatsApp IA"],["🌐","Webs"],["📱","Apps"],["⚙️","Software a medida"],["📣","Anuncios & marketing"],["📅","Sistemas de agenda"],["🛒","E-commerce / Shopify"],["🔄","Automatizaciones"],["📊","Dashboards & CRM"],["⭐","Reseñas & reputación"],["📈","Crecimiento & analítica"]] },
    coreLine:"Dos motores hacen crecer tu negocio — tu marketing y tu operación diaria. Movidos por IA, gestionados por humanos de verdad.",
    doesLabel:"Qué hace", changesLabel:"Qué cambia",
    coreSupport:"Y construimos las webs, apps y agentes de voz que hacen que todo funcione.",
    charts:{ eyebrow:"Resultados reales", title:"Crecimiento que se ve", rows:[["💰","Crecimiento de ingresos",92,"+286%"],["📞","Llamadas contestadas",100,"24/7"],["🎯","Eficiencia de ads",85,"−40% desperdicio"],["📅","Recompra",78,"+40%"]] },
    adv:{ eyebrow:"Por qué Guileo", line:"Todo lo que ganas al tenernos de tu lado.",
      items:[
        ["🌙","Nunca pierdas un cliente","+",35,"%","más leads — 24/7"],
        ["📣","Marketing en automático","+",286,"%","de crecimiento, sin esfuerzo"],
        ["⚙️","Se acabó el trabajo manual","",20,"h","ahorradas por semana"],
        ["🤝","Humanos de verdad detrás","",98,"%","clientes se quedan y refieren"],
        ["🚀","En vivo en días","",7,"","días para lanzar"],
        ["💰","Cuida tu margen","−",40,"%","vs contratar agencia"],
      ] },
    core:[
      ["📈","Marketing — tu puente hacia los anuncios","Nos volvemos el puente entre tu negocio y tus cuentas de anuncios. Como un departamento de marketing mega-IA, conectamos Meta & Google Ads y los gestionamos a diario — campañas, creativos, audiencias y presupuesto, optimizados sin parar.","Más clientes correctos, menos gasto desperdiciado y un crecimiento predecible — sin que abras un administrador de anuncios."],
      ["⚙️","Automatizaciones de IA — tu operación diaria","Tu IA contesta llamadas, textos & WhatsApp, califica leads, cotiza, agenda, hace seguimiento e incluso gestiona pagos — 24/7, en cada canal.","Nada se escapa, el trabajo manual desaparece, y despiertas con la agenda llena e ingresos."],
    ],
    numbersMission:"Nuestra misión: dar a cada negocio la ventaja de IA que tienen las grandes empresas — para que crezcas sin límites. Estos son los resultados promedio.",
    lead:{ title:"Deja tu contacto — te llamamos", sub:"Dinos dónde encontrarte. Un humano de verdad te responde rápido — normalmente en horas.", name:"Tu nombre", email:"Email", phone:"Teléfono / WhatsApp", business:"Tu negocio (opcional)", submit:"Quiero mi cotización gratis →", sending:"Enviando…", successT:"¡Recibido! 🎉", successD:"Te contactamos pronto — normalmente en pocas horas.", privacy:"Sin spam. Tus datos quedan privados y solo se usan para contactarte.", wamsg:"¡Hola Guileo! Quiero una cotización:" },
    callbar:{ line:"Escúchalo tú mismo — nuestra IA te llama en segundos.", placeholder:"Tu teléfono / WhatsApp", cta:"Llámame ahora", calling:"Llamando…", done:"📞 Te llamamos ahora — ¡contesta!" },
    integ:{ eyebrow:"Funciona con lo que ya usas", h2:"Se integra con todo tu stack", sub:"Shopify, Etsy, WhatsApp, tu calendario, tu CRM — tu IA trabaja dentro de las herramientas que ya tienes. Sin cambiar nada, sin migración.", ask:"¿Usas otra cosa? Integramos casi con todo.", asklink:"Habla con nosotros →" },
    integGroups:["Anuncios & Growth","E-commerce","Mensajería & Social","Calendario & CRM","Pagos & Ops"],
    comp:{ eyebrow:"La elección obvia", h2:"Guileo vs. las alternativas", sub:"Mismo problema, resultados muy distintos. Mira por qué los negocios eligen Guileo.", cta:"Quiero Guileo →",
      cols:["","Guileo","Recepcionista humano","Otras IAs","No hacer nada"],
      rows:[
        ["Contesta 24/7 / multilingüe","✅","❌ (turnos, 1 idioma)","⚠️ parcial","❌"],
        ["Agenda, vende & da seguimiento","✅","⚠️ limitado","⚠️ solo FAQ","❌"],
        ["Convierte llamadas en datos de marketing","✅","❌","❌","❌"],
        ["También maneja tus anuncios & contenido","✅","❌","❌","❌"],
        ["Costo mensual","Fijo, bajo","$3–6k/mes","Varía","Ingreso perdido"],
        ["En vivo en","< 7 días","Semanas para contratar","Lo montas tú","—"],
        ["Mejora cada día","✅","❌","❌","❌"],
        ["Un socio para todo","✅","❌","❌","❌"],
      ] },
  },
  hi: {
    whatwedo:"हम क्या करते हैं",
    products:{ line:"आपकी पहली वेबसाइट से आपकी आख़िरी बिक्री तक — हम सब बनाते हैं।",
      items:[["🎙️","वॉइस AI एजेंट"],["💬","टेक्स्ट & WhatsApp AI"],["🌐","वेबसाइट"],["📱","ऐप्स"],["⚙️","कस्टम सॉफ़्टवेयर"],["📣","विज्ञापन & मार्केटिंग"],["📅","बुकिंग सिस्टम"],["🛒","ई-कॉमर्स / Shopify"],["🔄","ऑटोमेशन"],["📊","डैशबोर्ड & CRM"],["⭐","समीक्षाएँ & प्रतिष्ठा"],["📈","ग्रोथ & एनालिटिक्स"]] },
    coreLine:"दो इंजन आपके व्यवसाय को बढ़ाते हैं — आपकी मार्केटिंग और आपका रोज़ का ऑपरेशन। AI से संचालित, असली इंसानों द्वारा प्रबंधित।",
    doesLabel:"यह क्या करता है", changesLabel:"यह क्या बदलता है",
    coreSupport:"और हम वे वेबसाइट, ऐप और वॉइस एजेंट बनाते हैं जो सब कुछ चलाते हैं।",
    charts:{ eyebrow:"असली परिणाम", title:"ग्रोथ जो दिखती है", rows:[["💰","राजस्व ग्रोथ",92,"+286%"],["📞","कॉल उत्तरित",100,"24/7"],["🎯","ऐड दक्षता",85,"−40% बर्बादी"],["📅","रिपीट बुकिंग",78,"+40%"]] },
    adv:{ eyebrow:"Guileo क्यों", line:"हमारे साथ होने से आपको जो कुछ मिलता है।",
      items:[
        ["🌙","कोई ग्राहक न छूटे","+",35,"%","ज़्यादा लीड — 24/7"],
        ["📣","मार्केटिंग ऑटोपायलट","+",286,"%","ग्रोथ, बिना मेहनत"],
        ["⚙️","मैनुअल काम खत्म","",20,"h","हर हफ़्ते बचत"],
        ["🤝","पीछे असली इंसान","",98,"%","ग्राहक टिकते और रेफर करते हैं"],
        ["🚀","दिनों में लाइव","",7,"","दिनों में लॉन्च"],
        ["💰","अपना मार्जिन रखें","−",40,"%","एजेंसी की तुलना में"],
      ] },
    core:[
      ["📈","मार्केटिंग — विज्ञापनों तक आपका पुल","हम आपके व्यवसाय और आपके विज्ञापन खातों के बीच पुल बन जाते हैं। एक मेगा-AI मार्केटिंग विभाग की तरह, हम Meta & Google Ads जोड़ते हैं और उन्हें रोज़ चलाते हैं — कैम्पेन, क्रिएटिव, ऑडियंस और बजट, लगातार ऑप्टिमाइज़।","ज़्यादा सही ग्राहक, कम बर्बाद ऐड खर्च, और ऐसी ग्रोथ जिसका अनुमान लगाया जा सके — बिना कभी ऐड मैनेजर खोले।"],
      ["⚙️","AI ऑटोमेशन — आपका रोज़ का ऑपरेशन","आपकी AI कॉल, टेक्स्ट & WhatsApp का जवाब देती है, लीड क्वालिफाई करती है, कोट देती है, बुकिंग करती है, फॉलो-अप करती है और भुगतान तक संभालती है — 24/7, हर चैनल पर।","कुछ भी नहीं छूटता, मैनुअल काम गायब हो जाता है, और आप भरी बुकिंग और कमाई के साथ जागते हैं।"],
    ],
    numbersMission:"हमारा मिशन: हर व्यवसाय को वह AI बढ़त देना जो बड़ी कंपनियों के पास है — ताकि आप बिना सीमा बढ़ें। ये औसत परिणाम हैं।",
    lead:{ title:"अपना संपर्क छोड़ें — हम आपसे संपर्क करेंगे", sub:"बताएँ कहाँ संपर्क करें। एक असली इंसान जल्दी जवाब देता है — आमतौर पर घंटों में।", name:"आपका नाम", email:"ईमेल", phone:"फ़ोन / WhatsApp", business:"आपका व्यवसाय (वैकल्पिक)", submit:"मेरा मुफ़्त कोट पाएँ →", sending:"भेज रहे हैं…", successT:"मिल गया! 🎉", successD:"हम जल्द संपर्क करेंगे — आमतौर पर कुछ घंटों में।", privacy:"कोई स्पैम नहीं। आपकी जानकारी निजी रहती है और केवल संपर्क के लिए उपयोग होती है।", wamsg:"नमस्ते Guileo! मुझे एक कोट चाहिए:" },
    callbar:{ line:"खुद सुनिए — हमारी AI सेकंडों में आपको कॉल करती है।", placeholder:"आपका फ़ोन / WhatsApp", cta:"मुझे अभी कॉल करें", calling:"कॉल हो रही है…", done:"📞 अभी कॉल कर रहे हैं — उठाइए!" },
    integ:{ eyebrow:"जो आप पहले से उपयोग करते हैं उसके साथ काम करता है", h2:"आपके पूरे स्टैक में जुड़ जाता है", sub:"Shopify, Etsy, WhatsApp, आपका कैलेंडर, आपका CRM — आपकी AI उन्हीं टूल्स के अंदर काम करती है जो आपके पास पहले से हैं। कोई बदलाव नहीं, कोई माइग्रेशन नहीं।", ask:"कुछ और उपयोग करते हैं? हम लगभग किसी भी चीज़ से जुड़ते हैं।", asklink:"हमसे पूछें →" },
    integGroups:["विज्ञापन & ग्रोथ","ई-कॉमर्स","मैसेजिंग & सोशल","कैलेंडर & CRM","पेमेंट्स & ऑप्स"],
    comp:{ eyebrow:"स्पष्ट विकल्प", h2:"Guileo बनाम विकल्प", sub:"वही समस्या, बहुत अलग परिणाम। देखें क्यों व्यवसाय Guileo चुनते हैं।", cta:"मैं Guileo चुनता हूँ →",
      cols:["","Guileo","मानव रिसेप्शनिस्ट","अन्य AI टूल","कुछ न करना"],
      rows:[
        ["24/7 / बहुभाषी उत्तर","✅","❌ (शिफ़्ट, 1 भाषा)","⚠️ आंशिक","❌"],
        ["बुकिंग, बिक्री & फॉलो-अप","✅","⚠️ सीमित","⚠️ केवल FAQ","❌"],
        ["कॉल को मार्केटिंग डेटा में बदलना","✅","❌","❌","❌"],
        ["आपके विज्ञापन & कंटेंट भी चलाना","✅","❌","❌","❌"],
        ["मासिक लागत","निश्चित, कम","$3–6k/माह","अलग-अलग","खोया राजस्व"],
        ["लाइव","< 7 दिन","भर्ती में हफ़्ते","खुद सेटअप","—"],
        ["हर दिन और स्मार्ट","✅","❌","❌","❌"],
        ["सब कुछ के लिए एक पार्टनर","✅","❌","❌","❌"],
      ] },
  },
};
// bring pt/es/hi pricing (no-price tiers) and method steps in sync with the updated EN
const PRICE_SYNC = {
  pt:[
    { name:"Essential", tag:"Comece simples", price:"Sob medida", per:"", feats:["1 agente de IA (voz ou texto)","Agendamentos & follow-ups","Um humano configura com você","Garantia de 30 dias"], cta:"Quero meu orçamento" },
    { name:"Personalized", tag:"Mais popular", price:"Feito pra você", per:"", feats:["Voz + texto + WhatsApp + social","Automação de vendas & marketing","Um humano desenha pro seu negócio","Dashboard ao vivo & suporte prioritário"], cta:"Agendar conversa", featured:true },
    { name:"Operação Completa", tag:"A gente cuida de tudo", price:"Vamos conversar", per:"", feats:["Todos os canais + ads + seus dados","Sistemas sob medida","Implementação profunda e prática","Time dedicado & estratégia"], cta:"Falar conosco" } ],
  es:[
    { name:"Essential", tag:"Empieza simple", price:"A medida", per:"", feats:["1 agente de IA (voz o texto)","Reservas & seguimientos","Un humano lo configura contigo","Garantía de 30 días"], cta:"Quiero mi cotización" },
    { name:"Personalized", tag:"Más popular", price:"Hecho para ti", per:"", feats:["Voz + texto + WhatsApp + social","Automatización de ventas & marketing","Un humano lo diseña para tu negocio","Dashboard en vivo & soporte prioritario"], cta:"Agendar llamada", featured:true },
    { name:"Operación Completa", tag:"Lo manejamos todo", price:"Hablemos", per:"", feats:["Todos los canales + ads + tus datos","Sistemas a medida","Implementación profunda y práctica","Equipo dedicado & estrategia"], cta:"Hablar con nosotros" } ],
  hi:[
    { name:"Essential", tag:"सरल शुरुआत", price:"अनुकूलित", per:"", feats:["1 AI एजेंट (वॉइस या टेक्स्ट)","बुकिंग & फॉलो-अप","एक इंसान आपके साथ सेटअप करता है","30-दिन मनी-बैक"], cta:"मेरा कोट पाएँ" },
    { name:"Personalized", tag:"सबसे लोकप्रिय", price:"आपके लिए बना", per:"", feats:["वॉइस + टेक्स्ट + WhatsApp + सोशल","बिक्री & मार्केटिंग ऑटोमेशन","एक इंसान आपके व्यवसाय के लिए डिज़ाइन करता है","लाइव डैशबोर्ड & प्राथमिकता सपोर्ट"], cta:"कॉल बुक करें", featured:true },
    { name:"पूर्ण ऑपरेशन", tag:"हम सब संभालते हैं", price:"बात करते हैं", per:"", feats:["सभी चैनल + ऐड + आपका डेटा","कस्टम सिस्टम","गहरा, व्यावहारिक कार्यान्वयन","समर्पित टीम & रणनीति"], cta:"हमसे बात करें" } ],
};
const STEPS_SYNC = {
  pt:{ eyebrow:"Nosso método · da semente ao fruto", h2:"O Método Guileo", sub:"Conduzido por humanos de verdade, não só bots. A gente conhece seu negócio — até visita você — e então desenha e constrói o sistema que faz seu lucro crescer. No ar em menos de 7 dias.",
    items:[["🌰","Plante a Semente","Um humano estuda seu negócio, acha seus vazamentos de receita e desenha um sistema feito em torno de como você realmente trabalha."],["🌿","Nutra o Crescimento","Construímos e implementamos em menos de 7 dias — sua IA trabalhando 24/7, automatizando vendas & marketing em todos os canais."],["🌳","Colha Resultados","Veja o lucro subir. +286% de performance e ciclos de venda 3x mais rápidos em média — com a gente otimizando pra você."]] },
  es:{ eyebrow:"Nuestro método · de la semilla al fruto", h2:"El Método Guileo", sub:"Liderado por humanos de verdad, no solo bots. Conocemos tu negocio — incluso te visitamos — y luego diseñamos y construimos el sistema que hace crecer tu ganancia. En vivo en menos de 7 días.",
    items:[["🌰","Planta la Semilla","Un humano estudia tu negocio, encuentra tus fugas de ingreso y diseña un sistema hecho en torno a cómo trabajas de verdad."],["🌿","Nutre el Crecimiento","Construimos e implementamos en menos de 7 días — tu IA trabajando 24/7, automatizando ventas & marketing en cada canal."],["🌳","Cosecha Resultados","Mira subir las ganancias. +286% de performance y ciclos de venta 3x más rápidos en promedio — con nosotros optimizándolo para ti."]] },
  hi:{ eyebrow:"हमारी विशिष्ट विधि · बीज से फल तक", h2:"Guileo विधि", sub:"असली इंसानों द्वारा संचालित, सिर्फ़ बॉट नहीं। हम आपका व्यवसाय जानते हैं — आपसे मिलने भी आते हैं — फिर वह सिस्टम डिज़ाइन और बनाते हैं जो आपका मुनाफ़ा बढ़ाए। 7 दिनों से कम में लाइव।",
    items:[["🌰","बीज बोएँ","एक इंसान आपका व्यवसाय पढ़ता है, आपके राजस्व रिसाव ढूँढता है, और ऐसा सिस्टम डिज़ाइन करता है जो आपके असली काम के तरीके के इर्द-गिर्द बना हो।"],["🌿","ग्रोथ को पोषें","हम 7 दिनों से कम में बनाकर लागू करते हैं — आपकी AI 24/7 काम करती है, हर चैनल पर बिक्री & मार्केटिंग ऑटोमेट करती है।"],["🌳","परिणाम काटें","मुनाफ़ा बढ़ता देखें। औसतन +286% परफ़ॉर्मेंस और 3x तेज़ बिक्री चक्र — हमारे ऑप्टिमाइज़ेशन के साथ।"]] },
};
["en","pt","es","hi"].forEach((l)=>{ T[l].indList = IND[l]; T[l].priceList = PRICE[l]; T[l].more = MORE[l]; });
["pt","es","hi"].forEach((l)=>{ T[l].priceList = PRICE_SYNC[l]; T[l].steps = STEPS_SYNC[l]; });

const LangContext = createContext(null);
export function LangProvider({ children }) {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    const saved = typeof localStorage !== "undefined" && localStorage.getItem("guileo_lang");
    if (saved && T[saved]) setLang(saved);
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
    if (typeof localStorage !== "undefined") localStorage.setItem("guileo_lang", lang);
  }, [lang]);
  return <LangContext.Provider value={{ lang, setLang, t: T[lang] || T.en }}>{children}</LangContext.Provider>;
}
export function useLang() {
  const ctx = useContext(LangContext);
  return ctx || { lang: "en", setLang: () => {}, t: T.en };
}
