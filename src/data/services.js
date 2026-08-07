// Guileo — service/product catalog. TRILINGUAL (en/pt/es). Rebuilt by a 9-agent fan-out 2026-06-21.
// Each field is {en,pt,es}; render with cat[lang]||cat.en. type: call|once|ongoing.
export const CATS = [
  {
    "slug": "ai-employees",
    "icon": "🤖",
    "color": "#3E9468",
    "cat": {
      "en": "AI employees (the Gui platform)",
      "pt": "Funcionários de IA (a plataforma Gui)",
      "es": "Empleados de IA (la plataforma Gui)"
    },
    "items": [
      {
        "name": {
          "en": "Free Gui demo call",
          "pt": "Ligação demo gratuita da Gui",
          "es": "Llamada demo gratis de Gui"
        },
        "desc": {
          "en": "Drop your number and Gui calls you in seconds. Hear your future 24/7 receptionist answer, book and quote, live.",
          "pt": "Põe seu número e a Gui te liga em segundos. Ouça ao vivo sua futura recepcionista 24/7 atender, agendar e orçar.",
          "es": "Deja tu número y Gui te llama en segundos. Escucha en vivo a tu futura recepcionista 24/7 atender, agendar y cotizar."
        },
        "deliver": {
          "en": "Your phone number and the type of business you run.",
          "pt": "Seu telefone e o tipo de negócio que você toca.",
          "es": "Tu teléfono y el tipo de negocio que manejas."
        },
        "br": "Grátis",
        "us": "Free",
        "type": "call"
      },
      {
        "name": {
          "en": "Gui Essential — your AI front desk",
          "pt": "Gui Essential — sua recepção com IA",
          "es": "Gui Essential — tu recepción con IA"
        },
        "desc": {
          "en": "An AI agent that answers every call and message 24/7 and books appointments, so no lead ever hits voicemail again.",
          "pt": "Um agente de IA que atende toda ligação e mensagem 24/7 e agenda horários, pra nenhum cliente cair na caixa postal de novo.",
          "es": "Un agente de IA que responde cada llamada y mensaje 24/7 y agenda citas, para que ningún cliente caiga al buzón de voz otra vez."
        },
        "deliver": {
          "en": "Your business name, hours, services and a number to forward — live the same day.",
          "pt": "Nome do negócio, horários, serviços e um número pra encaminhar — no ar no mesmo dia.",
          "es": "Nombre del negocio, horarios, servicios y un número para desviar — en vivo el mismo día."
        },
        "br": "R$799/mês",
        "us": "$149/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Gui Personalized — books, quotes and gets paid",
          "pt": "Gui Personalized — agenda, orça e recebe",
          "es": "Gui Personalized — agenda, cotiza y cobra"
        },
        "desc": {
          "en": "Everything in Essential, plus voice quoting, payment by Stripe link or card on the call, and auto follow-up so no sale slips.",
          "pt": "Tudo do Essential, mais orçamento por voz, cobrança por link Stripe ou cartão na ligação e follow-up automático pra não perder venda.",
          "es": "Todo lo del Essential, más cotización por voz, cobro con link de Stripe o tarjeta en la llamada y seguimiento automático para no perder ventas."
        },
        "deliver": {
          "en": "Your price list and a Stripe or Mercado Pago account to take payments.",
          "pt": "Sua tabela de preços e uma conta Stripe ou Mercado Pago pra receber.",
          "es": "Tu lista de precios y una cuenta de Stripe o Mercado Pago para cobrar."
        },
        "br": "R$2.499/mês",
        "us": "$449/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Gui Full Operation — the full company OS",
          "pt": "Gui Full Operation — o sistema operacional completo da empresa",
          "es": "Gui Full Operation — el sistema operativo completo de la empresa"
        },
        "desc": {
          "en": "Everything in Personalized, plus a unified CRM that turns every call, booking and payment into one customer record your team runs on.",
          "pt": "Tudo do Personalized, mais um CRM unificado que vira cada ligação, agendamento e pagamento num só cadastro de cliente pra sua equipe operar.",
          "es": "Todo lo del Personalized, más un CRM unificado que convierte cada llamada, reserva y pago en un solo registro de cliente para tu equipo."
        },
        "deliver": {
          "en": "Your current customer list (any spreadsheet works) and the tools you use today.",
          "pt": "Sua lista de clientes atual (qualquer planilha serve) e as ferramentas que você usa hoje.",
          "es": "Tu lista de clientes actual (cualquier hoja de cálculo sirve) y las herramientas que usas hoy."
        },
        "br": "R$5.499/mês",
        "us": "$999/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Done-for-you Gui onboarding",
          "pt": "Implantação da Gui feita por nós",
          "es": "Implementación de Gui hecha por nosotros"
        },
        "desc": {
          "en": "We build, train and launch your Gui end to end — voice, scripts, bookings, payments and integrations — so you go live without lifting a finger.",
          "pt": "A gente constrói, treina e coloca sua Gui no ar de ponta a ponta — voz, roteiros, agendamentos, pagamentos e integrações — sem você mexer em nada.",
          "es": "Construimos, entrenamos y lanzamos tu Gui de punta a punta — voz, guiones, reservas, cobros e integraciones — sin que muevas un dedo."
        },
        "deliver": {
          "en": "A 30-minute kickoff call and access to your number and the tools you want connected.",
          "pt": "Uma call de kickoff de 30 minutos e acesso ao seu número e às ferramentas que quer conectar.",
          "es": "Una llamada inicial de 30 minutos y acceso a tu número y a las herramientas que quieras conectar."
        },
        "br": "R$2.900 (única vez)",
        "us": "$590 one-time",
        "type": "once"
      },
      {
        "name": {
          "en": "Reactivation Blitz add-on",
          "pt": "Add-on Blitz de Reativação",
          "es": "Complemento Blitz de Reactivación"
        },
        "desc": {
          "en": "Gui works your list of lapsed customers by voice and message to win them back and refill your calendar with sales you already earned.",
          "pt": "A Gui percorre seus clientes inativos por voz e mensagem pra trazê-los de volta e encher sua agenda com vendas que já eram suas.",
          "es": "Gui recorre tus clientes inactivos por voz y mensaje para recuperarlos y llenar tu agenda con ventas que ya eran tuyas."
        },
        "deliver": {
          "en": "An export of past customers with phone numbers and the offer to win them back.",
          "pt": "Uma exportação de clientes antigos com telefones e a oferta pra trazê-los de volta.",
          "es": "Una exportación de clientes pasados con teléfonos y la oferta para recuperarlos."
        },
        "br": "R$390/mês",
        "us": "$79/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "No-show shield add-on",
          "pt": "Add-on Escudo Anti-Faltas",
          "es": "Complemento Escudo Anti-Inasistencias"
        },
        "desc": {
          "en": "Gui spots which bookings are likely to no-show and confirms or rebooks them ahead of time, so your slots stay full.",
          "pt": "A Gui detecta quais agendamentos têm risco de falta e confirma ou remarca antes, pra sua agenda ficar sempre cheia.",
          "es": "Gui detecta qué reservas tienen riesgo de inasistencia y las confirma o reagenda antes, para que tu agenda quede siempre llena."
        },
        "deliver": {
          "en": "Your calendar or booking tool connected and the reminder timing you prefer.",
          "pt": "Sua agenda ou ferramenta de reservas conectada e o tempo de antecedência que prefere.",
          "es": "Tu calendario o herramienta de reservas conectada y la antelación que prefieras."
        },
        "br": "R$290/mês",
        "us": "$59/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Bilingual Gui add-on (EN/PT/ES)",
          "pt": "Add-on Gui Bilíngue (EN/PT/ES)",
          "es": "Complemento Gui Bilingüe (EN/PT/ES)"
        },
        "desc": {
          "en": "Gui greets and serves each customer in English, Portuguese or Spanish automatically, so you never lose a sale to a language gap.",
          "pt": "A Gui recebe e atende cada cliente em inglês, português ou espanhol automaticamente, pra você nunca perder venda por idioma.",
          "es": "Gui recibe y atiende a cada cliente en inglés, portugués o español automáticamente, para que nunca pierdas una venta por el idioma."
        },
        "deliver": {
          "en": "The languages your customers speak and any greetings you want kept word for word.",
          "pt": "Os idiomas dos seus clientes e as saudações que quer manter palavra por palavra.",
          "es": "Los idiomas de tus clientes y los saludos que quieras mantener palabra por palabra."
        },
        "br": "R$190/mês",
        "us": "$39/mo",
        "type": "ongoing"
      }
    ]
  },
  {
    "slug": "growth-performance",
    "icon": "📈",
    "color": "#C2A878",
    "cat": {
      "en": "Growth & performance",
      "pt": "Crescimento e performance",
      "es": "Crecimiento y rendimiento"
    },
    "items": [
      {
        "name": {
          "en": "Growth audit & game plan (free)",
          "pt": "Auditoria de crescimento e plano de ação (grátis)",
          "es": "Auditoría de crecimiento y plan de acción (gratis)"
        },
        "desc": {
          "en": "We find where your leads leak and where ads, SEO and funnels pay back fastest — then show how Gui answers every lead in seconds so none slip away.",
          "pt": "Achamos onde seus leads vazam e onde anúncios, SEO e funis dão retorno mais rápido — e mostramos como o Gui atende cada lead em segundos pra nenhum escapar.",
          "es": "Encontramos dónde se fugan tus leads y dónde anuncios, SEO y embudos rinden más rápido — y te mostramos cómo Gui atiende cada lead en segundos para que ninguno se escape."
        },
        "deliver": {
          "en": "Your business, current ad/lead numbers, and your goal for the next 90 days.",
          "pt": "Seu negócio, números atuais de anúncios/leads e a meta dos próximos 90 dias.",
          "es": "Tu negocio, números actuales de anuncios/leads y tu meta para los próximos 90 días."
        },
        "br": "Grátis",
        "us": "Free",
        "type": "call"
      },
      {
        "name": {
          "en": "High-converting landing page",
          "pt": "Landing page de alta conversão",
          "es": "Landing page de alta conversión"
        },
        "desc": {
          "en": "One sharp page built to sell a single offer, wired straight into Gui and your CRM — so every lead gets called, texted and logged within seconds.",
          "pt": "Uma página afiada feita pra vender uma única oferta, ligada direto ao Gui e ao seu CRM — cada lead recebe ligação, mensagem e registro em segundos.",
          "es": "Una página afilada hecha para vender una sola oferta, conectada directo a Gui y a tu CRM — cada lead recibe llamada, mensaje y registro en segundos."
        },
        "deliver": {
          "en": "Your offer, target audience, key benefits, proof (reviews/results), and brand assets.",
          "pt": "Sua oferta, público-alvo, principais benefícios, provas (avaliações/resultados) e arquivos da marca.",
          "es": "Tu oferta, público objetivo, beneficios clave, pruebas (reseñas/resultados) y archivos de marca."
        },
        "br": "R$1.800–R$4.500",
        "us": "$900–$2,800",
        "type": "once"
      },
      {
        "name": {
          "en": "Conversion funnel build",
          "pt": "Construção de funil de conversão",
          "es": "Construcción de embudo de conversión"
        },
        "desc": {
          "en": "We build the full path from click to booked-and-paid — pages, lead capture, and Gui handling follow-up, quoting and checkout on autopilot.",
          "pt": "Construímos o caminho completo do clique ao agendado-e-pago — páginas, captura de leads e o Gui cuidando do follow-up, do orçamento e do pagamento no automático.",
          "es": "Construimos el camino completo del clic a reservado-y-pagado — páginas, captura de leads y Gui gestionando seguimiento, cotización y cobro en automático."
        },
        "deliver": {
          "en": "Your offer and pricing, current funnel (if any), lead volume, and CRM/booking access.",
          "pt": "Sua oferta e preços, funil atual (se houver), volume de leads e acesso ao CRM/agenda.",
          "es": "Tu oferta y precios, embudo actual (si lo hay), volumen de leads y acceso al CRM/agenda."
        },
        "br": "R$4.500–R$12.000",
        "us": "$2,500–$8,000",
        "type": "once"
      },
      {
        "name": {
          "en": "Paid ads management (Google, Meta, TikTok)",
          "pt": "Gestão de tráfego pago (Google, Meta, TikTok)",
          "es": "Gestión de pauta paga (Google, Meta, TikTok)"
        },
        "desc": {
          "en": "We run and optimize your ads to fill the pipeline, and Gui answers every lead the instant it lands — qualified and booked before competitors call back.",
          "pt": "Rodamos e otimizamos seus anúncios pra encher o pipeline, e o Gui atende cada lead no instante que ele chega — qualificado e agendado antes do concorrente retornar.",
          "es": "Gestionamos y optimizamos tus anuncios para llenar el pipeline, y Gui atiende cada lead en el instante que llega — calificado y reservado antes de que el competidor responda."
        },
        "deliver": {
          "en": "Ad account access, your offer, target audience, monthly budget, and a landing page or destination.",
          "pt": "Acesso à conta de anúncios, sua oferta, público-alvo, verba mensal e uma landing page ou destino.",
          "es": "Acceso a la cuenta de anuncios, tu oferta, público objetivo, presupuesto mensual y una landing page o destino."
        },
        "br": "R$1.800–R$4.500/mês + verba",
        "us": "$900–$3,000/mo + ad spend",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Local SEO & Google Business",
          "pt": "SEO local e Google Meu Negócio",
          "es": "SEO local y Google Business"
        },
        "desc": {
          "en": "We get you found on Google and Maps when nearby customers search, with every resulting call and message routed to Gui so none go unanswered.",
          "pt": "Fazemos você aparecer no Google e no Maps quando o cliente da região busca, com cada ligação e mensagem indo pro Gui pra nenhuma ficar sem resposta.",
          "es": "Hacemos que aparezcas en Google y Maps cuando el cliente cercano busca, con cada llamada y mensaje yendo a Gui para que ninguna quede sin responder."
        },
        "deliver": {
          "en": "Website and Google Business access, priority keywords, service areas, and competitors.",
          "pt": "Acesso ao site e ao Google Meu Negócio, palavras-chave prioritárias, áreas de atendimento e concorrentes.",
          "es": "Acceso al sitio y a Google Business, palabras clave prioritarias, zonas de servicio y competidores."
        },
        "br": "R$1.500–R$4.500/mês",
        "us": "$800–$3,000/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "CRO & A/B testing",
          "pt": "CRO e testes A/B",
          "es": "CRO y pruebas A/B"
        },
        "desc": {
          "en": "We test and tune your pages month over month so the same traffic books more — squeezing extra revenue out of clicks you already pay for.",
          "pt": "Testamos e ajustamos suas páginas mês a mês pra que o mesmo tráfego agende mais — extraindo mais receita dos cliques que você já paga.",
          "es": "Probamos y ajustamos tus páginas mes a mes para que el mismo tráfico reserve más — sacando más ingresos de los clics que ya pagas."
        },
        "deliver": {
          "en": "Site and analytics access, current traffic and conversion data, and improvement hypotheses.",
          "pt": "Acesso ao site e ao analytics, dados atuais de tráfego e conversão, e hipóteses de melhoria.",
          "es": "Acceso al sitio y a la analítica, datos actuales de tráfico y conversión, e hipótesis de mejora."
        },
        "br": "R$2.000–R$6.000/mês",
        "us": "$1,200–$4,000/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Speed-to-lead engine (instant response)",
          "pt": "Motor de resposta instantânea (speed-to-lead)",
          "es": "Motor de respuesta instantánea (speed-to-lead)"
        },
        "desc": {
          "en": "We connect every lead source to Gui so new leads get a call and text within seconds — the single biggest lever on whether they buy from you or the next guy.",
          "pt": "Conectamos toda fonte de leads ao Gui pra que cada novo lead receba ligação e mensagem em segundos — a maior alavanca pra ele comprar de você e não do concorrente.",
          "es": "Conectamos cada fuente de leads a Gui para que cada nuevo lead reciba llamada y mensaje en segundos — la mayor palanca para que te compre a ti y no al siguiente."
        },
        "deliver": {
          "en": "Your lead sources (forms, ads, calls), CRM access, and your qualifying questions and offer.",
          "pt": "Suas fontes de leads (formulários, anúncios, ligações), acesso ao CRM e suas perguntas de qualificação e oferta.",
          "es": "Tus fuentes de leads (formularios, anuncios, llamadas), acceso al CRM y tus preguntas de calificación y oferta."
        },
        "br": "R$2.500–R$7.000 + R$400/mês",
        "us": "$1,500–$4,500 + $300/mo",
        "type": "once"
      },
      {
        "name": {
          "en": "Lead reactivation campaign",
          "pt": "Campanha de reativação de leads",
          "es": "Campaña de reactivación de leads"
        },
        "desc": {
          "en": "Gui calls and messages your old leads and past customers to rebook and resell — turning a dead list into booked revenue, fast.",
          "pt": "O Gui liga e manda mensagem pros seus leads antigos e clientes do passado pra reagendar e revender — transformando uma lista parada em receita agendada, rápido.",
          "es": "Gui llama y envía mensajes a tus leads viejos y clientes pasados para reagendar y revender — convirtiendo una lista muerta en ingresos reservados, rápido."
        },
        "deliver": {
          "en": "Your contact list (old leads/customers), your offer, and CRM/booking access.",
          "pt": "Sua lista de contatos (leads/clientes antigos), sua oferta e acesso ao CRM/agenda.",
          "es": "Tu lista de contactos (leads/clientes antiguos), tu oferta y acceso al CRM/agenda."
        },
        "br": "R$2.000–R$6.000",
        "us": "$1,200–$4,000",
        "type": "once"
      }
    ]
  },
  {
    "slug": "content-social",
    "icon": "🎬",
    "color": "#7A1F4B",
    "cat": {
      "en": "Content & social",
      "pt": "Conteúdo e social",
      "es": "Contenido y redes"
    },
    "items": [
      {
        "name": {
          "en": "Content strategy & calendar",
          "pt": "Estratégia e calendário de conteúdo",
          "es": "Estrategia y calendario de contenido"
        },
        "desc": {
          "en": "Stop guessing what to post. We build a 30-day plan around how local customers actually search and buy.",
          "pt": "Pare de adivinhar o que postar. Montamos um plano de 30 dias baseado em como o cliente local realmente busca e compra.",
          "es": "Deja de adivinar qué publicar. Armamos un plan de 30 días basado en cómo busca y compra el cliente local."
        },
        "deliver": {
          "en": "A quick call about your business and goals, plus access to your current social accounts.",
          "pt": "Uma call rápida sobre seu negócio e suas metas, mais acesso às suas redes atuais.",
          "es": "Una llamada corta sobre tu negocio y tus metas, más acceso a tus redes actuales."
        },
        "br": "R$1.500–R$3.500",
        "us": "$400–$900",
        "type": "once"
      },
      {
        "name": {
          "en": "On-site filming day",
          "pt": "Dia de gravação no local",
          "es": "Día de grabación en el local"
        },
        "desc": {
          "en": "One visit, weeks of content. We film your space, team, and products so you never run dry.",
          "pt": "Uma visita, semanas de conteúdo. Filmamos seu espaço, sua equipe e seus produtos pra você nunca ficar sem post.",
          "es": "Una visita, semanas de contenido. Filmamos tu local, tu equipo y tus productos para que nunca te quedes sin material."
        },
        "deliver": {
          "en": "Your address, the best time to film, and a heads-up to your team to be camera-ready.",
          "pt": "Seu endereço, o melhor horário pra gravar e um aviso pra equipe estar pronta pra câmera.",
          "es": "Tu dirección, el mejor horario para grabar y un aviso a tu equipo para estar listo ante la cámara."
        },
        "br": "R$1.800–R$4.500",
        "us": "$500–$1,200",
        "type": "once"
      },
      {
        "name": {
          "en": "Short-form reels & TikTok",
          "pt": "Reels e TikTok",
          "es": "Reels y TikTok"
        },
        "desc": {
          "en": "Scroll-stopping vertical videos, edited and captioned, ready to post every week. No editing skills needed.",
          "pt": "Vídeos verticais que prendem o olhar, editados e legendados, prontos pra postar toda semana. Você não edita nada.",
          "es": "Videos verticales que frenan el scroll, editados y subtitulados, listos para publicar cada semana. Tú no editas nada."
        },
        "deliver": {
          "en": "Your raw clips (or a filming day booked) plus your logo and brand colors.",
          "pt": "Seus clipes brutos (ou um dia de gravação marcado) mais seu logo e cores de marca.",
          "es": "Tus clips en bruto (o un día de grabación agendado) más tu logo y colores de marca."
        },
        "br": "R$1.200–R$3.000/mês",
        "us": "$350–$900/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Social media management",
          "pt": "Gestão de redes sociais",
          "es": "Gestión de redes sociales"
        },
        "desc": {
          "en": "We run your Instagram and Facebook end to end. Gui replies to every comment and DM and turns them into bookings.",
          "pt": "Cuidamos do seu Instagram e Facebook de ponta a ponta. O Gui responde todo comentário e DM e transforma em agendamento.",
          "es": "Manejamos tu Instagram y Facebook de punta a punta. Gui responde cada comentario y DM y los convierte en reservas."
        },
        "deliver": {
          "en": "Admin access to your social accounts and your Gui agent connected for replies.",
          "pt": "Acesso de admin às suas redes e seu agente Gui conectado pra responder.",
          "es": "Acceso de administrador a tus redes y tu agente Gui conectado para responder."
        },
        "br": "R$2.000–R$5.000/mês",
        "us": "$600–$1,500/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "UGC creator content",
          "pt": "Conteúdo UGC de criadores",
          "es": "Contenido UGC de creadores"
        },
        "desc": {
          "en": "Real creators film authentic videos about your business that land like a friend's recommendation, not an ad.",
          "pt": "Criadores reais gravam vídeos autênticos do seu negócio com cara de indicação de amigo, não de anúncio.",
          "es": "Creadores reales graban videos auténticos de tu negocio que se sienten como la recomendación de un amigo, no un anuncio."
        },
        "deliver": {
          "en": "What you want to highlight, any product to send the creator, and your key talking points.",
          "pt": "O que você quer destacar, qualquer produto pra enviar ao criador e seus pontos-chave.",
          "es": "Lo que quieres destacar, cualquier producto para enviar al creador y tus puntos clave."
        },
        "br": "R$1.500–R$4.000",
        "us": "$450–$1,200",
        "type": "once"
      },
      {
        "name": {
          "en": "Content-to-booking funnel",
          "pt": "Funil de conteúdo para agendamento",
          "es": "Embudo de contenido a reserva"
        },
        "desc": {
          "en": "A like or comment becomes an automatic Gui message that books and charges the customer while the post is hot.",
          "pt": "Uma curtida ou comentário vira mensagem automática do Gui que agenda e cobra o cliente enquanto o post está bombando.",
          "es": "Un like o comentario se vuelve un mensaje automático de Gui que reserva y cobra al cliente mientras el post está caliente."
        },
        "deliver": {
          "en": "Your social accounts, your services and prices, and your Gui agent active.",
          "pt": "Suas redes sociais, seus serviços e preços, e seu agente Gui ativo.",
          "es": "Tus redes sociales, tus servicios y precios, y tu agente Gui activo."
        },
        "br": "R$1.000–R$2.500",
        "us": "$300–$700",
        "type": "once"
      },
      {
        "name": {
          "en": "Free content audit call",
          "pt": "Diagnóstico de conteúdo grátis",
          "es": "Diagnóstico de contenido gratis"
        },
        "desc": {
          "en": "We review your social presence live and show you the three fastest wins. No commitment.",
          "pt": "Revisamos sua presença social ao vivo e mostramos as três vitórias mais rápidas. Sem compromisso.",
          "es": "Revisamos tu presencia social en vivo y te mostramos las tres victorias más rápidas. Sin compromiso."
        },
        "deliver": {
          "en": "Just the links to your social profiles and 20 minutes on a call.",
          "pt": "Só os links dos seus perfis sociais e 20 minutos numa call.",
          "es": "Solo los enlaces de tus perfiles sociales y 20 minutos en una llamada."
        },
        "br": "Grátis",
        "us": "Free",
        "type": "call"
      }
    ]
  },
  {
    "slug": "web-apps",
    "icon": "🌐",
    "color": "#1A3A5C",
    "cat": {
      "en": "Web & apps",
      "pt": "Web e apps",
      "es": "Web y apps"
    },
    "items": [
      {
        "name": {
          "en": "Conversion website",
          "pt": "Site que converte",
          "es": "Web que convierte"
        },
        "desc": {
          "en": "A fast, beautiful site engineered to turn visitors into booked, paying customers — with Gui answering, qualifying and dropping every lead straight into your CRM.",
          "pt": "Um site rápido e lindo, feito pra transformar visitante em cliente agendado e pagante — com a Gui atendendo, qualificando e jogando cada lead direto no seu CRM.",
          "es": "Una web rápida y bella, hecha para convertir visitantes en clientes agendados y que pagan — con Gui atendiendo, calificando y enviando cada lead directo a tu CRM."
        },
        "deliver": {
          "en": "Send your logo, a few photos and one line on what you sell. We write, design and launch the rest.",
          "pt": "Manda seu logo, algumas fotos e uma frase sobre o que você vende. A gente escreve, desenha e publica o resto.",
          "es": "Envíanos tu logo, algunas fotos y una frase sobre lo que vendes. Nosotros redactamos, diseñamos y publicamos lo demás."
        },
        "br": "R$4.900–R$12.000",
        "us": "$1,500–$4,000",
        "type": "once"
      },
      {
        "name": {
          "en": "High-converting landing page",
          "pt": "Landing page de alta conversão",
          "es": "Landing page de alta conversión"
        },
        "desc": {
          "en": "One focused page built around a single offer, wired to Gui and your CRM so every click becomes a captured lead that gets followed up automatically.",
          "pt": "Uma página única focada em uma só oferta, ligada à Gui e ao seu CRM pra cada clique virar um lead capturado e com follow-up automático.",
          "es": "Una página única enfocada en una sola oferta, conectada a Gui y a tu CRM para que cada clic se vuelva un lead capturado y con seguimiento automático."
        },
        "deliver": {
          "en": "Tell us the offer you want to push and who it's for. We handle copy, design, build and launch in days.",
          "pt": "Diz qual oferta você quer empurrar e pra quem é. A gente cuida do texto, design, construção e lançamento em poucos dias.",
          "es": "Dinos qué oferta quieres impulsar y para quién es. Nosotros hacemos texto, diseño, construcción y lanzamiento en pocos días."
        },
        "br": "R$1.900–R$4.500",
        "us": "$600–$1,500",
        "type": "once"
      },
      {
        "name": {
          "en": "Online store & e-commerce",
          "pt": "Loja online e e-commerce",
          "es": "Tienda online y e-commerce"
        },
        "desc": {
          "en": "A complete store that takes orders and payments 24/7, with Gui upselling, recovering abandoned carts and answering buyers in any language.",
          "pt": "Uma loja completa que recebe pedidos e pagamentos 24/7, com a Gui fazendo upsell, recuperando carrinho abandonado e atendendo em qualquer idioma.",
          "es": "Una tienda completa que recibe pedidos y pagos 24/7, con Gui haciendo upsell, recuperando carritos abandonados y atendiendo en cualquier idioma."
        },
        "deliver": {
          "en": "Send your product list with prices and photos plus your payment account. We build, connect and go live.",
          "pt": "Manda sua lista de produtos com preços e fotos e a conta de pagamento. A gente constrói, conecta e coloca no ar.",
          "es": "Envíanos tu lista de productos con precios y fotos más tu cuenta de pagos. Nosotros construimos, conectamos y lanzamos."
        },
        "br": "R$6.900–R$18.000",
        "us": "$2,200–$6,000",
        "type": "once"
      },
      {
        "name": {
          "en": "Mobile app (iOS & Android)",
          "pt": "App mobile (iOS e Android)",
          "es": "App móvil (iOS y Android)"
        },
        "desc": {
          "en": "Your own branded app for bookings, orders or loyalty — Gui built in, every tap flowing straight into your CRM.",
          "pt": "Seu próprio app com a sua marca pra agendamento, pedido ou fidelidade — a Gui por dentro e cada toque indo direto pro seu CRM.",
          "es": "Tu propia app de marca para reservas, pedidos o fidelidad — Gui integrada y cada toque fluyendo directo a tu CRM."
        },
        "deliver": {
          "en": "Tell us what the app should do for customers and send your brand assets. We design, build and ship to both stores.",
          "pt": "Diz o que o app deve fazer pros clientes e manda os ativos da sua marca. A gente desenha, constrói e publica nas duas lojas.",
          "es": "Dinos qué debe hacer la app para tus clientes y envía los recursos de tu marca. Nosotros diseñamos, construimos y publicamos en ambas tiendas."
        },
        "br": "R$18.000–R$60.000",
        "us": "$6,000–$20,000",
        "type": "once"
      },
      {
        "name": {
          "en": "Client portal & SaaS dashboard",
          "pt": "Portal do cliente e painel SaaS",
          "es": "Portal de clientes y panel SaaS"
        },
        "desc": {
          "en": "A secure login area where your customers book, pay, track and self-serve — running on the same CRM brain that powers Gui.",
          "pt": "Uma área logada e segura onde seus clientes agendam, pagam, acompanham e se autoatendem — rodando no mesmo cérebro CRM que move a Gui.",
          "es": "Un área segura con login donde tus clientes reservan, pagan, dan seguimiento y se autoatienden — sobre el mismo cerebro CRM que mueve a Gui."
        },
        "deliver": {
          "en": "Tell us what your customers need to see and do once logged in. We architect, build and secure it.",
          "pt": "Diz o que seus clientes precisam ver e fazer depois de logar. A gente arquiteta, constrói e protege.",
          "es": "Dinos qué necesitan ver y hacer tus clientes al iniciar sesión. Nosotros lo arquitectamos, construimos y aseguramos."
        },
        "br": "R$12.000–R$45.000",
        "us": "$4,000–$15,000",
        "type": "once"
      },
      {
        "name": {
          "en": "Custom software & internal tools",
          "pt": "Software sob medida e ferramentas internas",
          "es": "Software a medida y herramientas internas"
        },
        "desc": {
          "en": "Tailor-made software that automates the exact workflow eating your time — connected to your CRM, payments and Gui from day one.",
          "pt": "Software sob medida que automatiza exatamente o fluxo que come seu tempo — conectado ao seu CRM, aos pagamentos e à Gui desde o dia um.",
          "es": "Software a medida que automatiza justo el flujo que te consume el tiempo — conectado a tu CRM, pagos y a Gui desde el primer día."
        },
        "deliver": {
          "en": "Walk us through the process you want automated and who uses it. We scope, build and deliver.",
          "pt": "Mostra o passo a passo do processo que você quer automatizar e quem usa. A gente escopa, constrói e entrega.",
          "es": "Muéstranos el proceso que quieres automatizar y quién lo usa. Nosotros lo definimos, construimos y entregamos."
        },
        "br": "R$15.000–R$80.000",
        "us": "$5,000–$25,000",
        "type": "once"
      },
      {
        "name": {
          "en": "Care, hosting & updates",
          "pt": "Manutenção, hospedagem e atualizações",
          "es": "Mantenimiento, hosting y actualizaciones"
        },
        "desc": {
          "en": "We host, monitor and improve your site or app every month — fast, secure and never broken while it's making you money.",
          "pt": "A gente hospeda, monitora e melhora seu site ou app todo mês — rápido, seguro e nunca fora do ar enquanto gera dinheiro.",
          "es": "Nosotros alojamos, monitoreamos y mejoramos tu sitio o app cada mes — rápido, seguro y sin caídas mientras te genera dinero."
        },
        "deliver": {
          "en": "Just give us access to your live site or app. We take over hosting, monitoring and monthly improvements.",
          "pt": "Só nos dá acesso ao seu site ou app no ar. A gente assume hospedagem, monitoramento e melhorias mensais.",
          "es": "Solo danos acceso a tu sitio o app en vivo. Nosotros asumimos hosting, monitoreo y mejoras mensuales."
        },
        "br": "R$297–R$997/mês",
        "us": "$99–$349/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Free build consultation",
          "pt": "Consultoria de projeto grátis",
          "es": "Consultoría de proyecto gratis"
        },
        "desc": {
          "en": "A quick, no-pressure call where we map exactly what to build, how Gui plugs in, and what it costs to grow.",
          "pt": "Uma conversa rápida e sem pressão onde a gente mapeia exatamente o que construir, como a Gui se encaixa e quanto custa pra crescer.",
          "es": "Una llamada rápida y sin presión donde mapeamos exactamente qué construir, cómo se integra Gui y cuánto cuesta crecer."
        },
        "deliver": {
          "en": "Just bring your idea or your current site link and a few minutes. We bring the plan and the quote.",
          "pt": "Só traz a sua ideia ou o link do seu site atual e alguns minutos. A gente traz o plano e o orçamento.",
          "es": "Solo trae tu idea o el enlace de tu web actual y unos minutos. Nosotros traemos el plan y el presupuesto."
        },
        "br": "Grátis",
        "us": "Free",
        "type": "call"
      }
    ]
  },
  {
    "slug": "brand-identity",
    "icon": "🎨",
    "color": "#9A4DB8",
    "cat": {
      "en": "Brand & identity",
      "pt": "Marca e identidade",
      "es": "Marca e identidad"
    },
    "items": [
      {
        "name": {
          "en": "Logo & brand mark",
          "pt": "Logo e símbolo",
          "es": "Logo y símbolo"
        },
        "desc": {
          "en": "A logo customers recognize instantly — on a sign, a screen, or a tiny app icon.",
          "pt": "Um logo que o cliente reconhece na hora — na fachada, na tela ou num ícone minúsculo.",
          "es": "Un logo que tus clientes reconocen al instante — en un letrero, una pantalla o un ícono diminuto."
        },
        "deliver": {
          "en": "Your business name, who you serve, and any colors or references you already love.",
          "pt": "O nome do negócio, quem você atende e cores ou referências que você já curte.",
          "es": "El nombre de tu negocio, a quién atiendes y los colores o referencias que ya te gustan."
        },
        "br": "R$1.200–R$3.500",
        "us": "$350–$1,200",
        "type": "once"
      },
      {
        "name": {
          "en": "Full visual identity",
          "pt": "Identidade visual completa",
          "es": "Identidad visual completa"
        },
        "desc": {
          "en": "Colors, fonts, logo system, and patterns that make everything you publish look like one brand.",
          "pt": "Cores, fontes, sistema de logo e padrões que fazem tudo que você publica parecer uma só marca.",
          "es": "Colores, tipografías, sistema de logo y patrones que hacen que todo lo que publicas se vea como una sola marca."
        },
        "deliver": {
          "en": "Your approved logo (or our logo project) plus photos of your space, products, and team.",
          "pt": "Seu logo aprovado (ou nosso projeto de logo) e fotos do espaço, dos produtos e da equipe.",
          "es": "Tu logo aprobado (o nuestro proyecto de logo) y fotos de tu local, productos y equipo."
        },
        "br": "R$4.500–R$12.000",
        "us": "$1,500–$4,000",
        "type": "once"
      },
      {
        "name": {
          "en": "Brand guidelines",
          "pt": "Manual da marca",
          "es": "Manual de marca"
        },
        "desc": {
          "en": "One clear rulebook so you, your team, and Gui look and sound the same everywhere.",
          "pt": "Um guia claro pra você, sua equipe e o Gui aparecerem e falarem igual em todo lugar.",
          "es": "Una guía clara para que tú, tu equipo y Gui luzcan y suenen igual en todas partes."
        },
        "deliver": {
          "en": "Your visual identity and a few notes on how you want to sound to customers.",
          "pt": "Sua identidade visual e algumas notas de como você quer soar pro cliente.",
          "es": "Tu identidad visual y unas notas de cómo quieres sonar ante los clientes."
        },
        "br": "R$2.500–R$6.000",
        "us": "$800–$2,000",
        "type": "once"
      },
      {
        "name": {
          "en": "Voice & tone for your AI agent",
          "pt": "Voz e tom do seu agente de IA",
          "es": "Voz y tono de tu agente de IA"
        },
        "desc": {
          "en": "We tune how Gui greets, answers, and follows up so every call and message sounds like your brand — in EN, PT, or ES.",
          "pt": "Ajustamos como o Gui atende, responde e faz follow-up pra cada ligação e mensagem soar como a sua marca — em EN, PT ou ES.",
          "es": "Ajustamos cómo Gui saluda, responde y da seguimiento para que cada llamada y mensaje suene como tu marca — en EN, PT o ES."
        },
        "deliver": {
          "en": "How you greet customers today, the questions you get most, and the languages you serve.",
          "pt": "Como você atende hoje, as perguntas mais comuns e os idiomas que você atende.",
          "es": "Cómo atiendes hoy, las preguntas más frecuentes y los idiomas que atiendes."
        },
        "br": "R$1.500–R$4.000",
        "us": "$500–$1,400",
        "type": "once"
      },
      {
        "name": {
          "en": "Packaging & print design",
          "pt": "Embalagem e material impresso",
          "es": "Empaque y diseño impreso"
        },
        "desc": {
          "en": "Menus, labels, bags, cards, and signage in your brand — designed and print-ready.",
          "pt": "Cardápios, rótulos, sacolas, cartões e placas com a sua cara — prontos pra gráfica.",
          "es": "Menús, etiquetas, bolsas, tarjetas y letreros con tu marca — listos para imprenta."
        },
        "deliver": {
          "en": "The items you need, their sizes, and any text or prices to print.",
          "pt": "Os itens que você precisa, os tamanhos e os textos ou preços pra imprimir.",
          "es": "Las piezas que necesitas, sus tamaños y los textos o precios a imprimir."
        },
        "br": "R$900–R$5.000",
        "us": "$300–$1,800",
        "type": "once"
      },
      {
        "name": {
          "en": "Pitch & sales deck",
          "pt": "Apresentação de vendas",
          "es": "Presentación de ventas"
        },
        "desc": {
          "en": "A polished deck that tells your story and closes investors, partners, and big clients.",
          "pt": "Uma apresentação caprichada que conta sua história e fecha investidores, parceiros e grandes clientes.",
          "es": "Una presentación pulida que cuenta tu historia y cierra inversionistas, socios y grandes clientes."
        },
        "deliver": {
          "en": "Who you're pitching, your offer, and any numbers or wins you want to show.",
          "pt": "Pra quem é o pitch, sua oferta e os números ou conquistas que quer mostrar.",
          "es": "A quién le presentas, tu oferta y los números o logros que quieres mostrar."
        },
        "br": "R$2.000–R$7.000",
        "us": "$700–$2,500",
        "type": "once"
      },
      {
        "name": {
          "en": "Design system for your platform",
          "pt": "Design system da sua plataforma",
          "es": "Sistema de diseño para tu plataforma"
        },
        "desc": {
          "en": "A reusable component kit so your app, booking page, and CRM look consistent and pro.",
          "pt": "Um kit reutilizável de componentes pra seu app, página de agendamento e CRM ficarem consistentes e profissionais.",
          "es": "Un kit reutilizable de componentes para que tu app, página de reservas y CRM se vean consistentes y profesionales."
        },
        "deliver": {
          "en": "Your brand guidelines and the screens or pages you want covered first.",
          "pt": "Seu manual da marca e as telas ou páginas que quer cobrir primeiro.",
          "es": "Tu manual de marca y las pantallas o páginas que quieres cubrir primero."
        },
        "br": "R$5.000–R$15.000",
        "us": "$1,800–$5,000",
        "type": "once"
      },
      {
        "name": {
          "en": "Brand strategy session",
          "pt": "Sessão de estratégia de marca",
          "es": "Sesión de estrategia de marca"
        },
        "desc": {
          "en": "A free call to map where your brand stands and the fastest wins to stand out and sell more.",
          "pt": "Uma conversa gratuita pra mapear onde sua marca está e os ganhos mais rápidos pra se destacar e vender mais.",
          "es": "Una llamada gratuita para mapear dónde está tu marca y las victorias más rápidas para destacar y vender más."
        },
        "deliver": {
          "en": "Just your time and a quick look at your current logo, site, or social pages.",
          "pt": "Só o seu tempo e um olhar rápido no seu logo, site ou redes atuais.",
          "es": "Solo tu tiempo y un vistazo rápido a tu logo, sitio o redes actuales."
        },
        "br": "Grátis",
        "us": "Free",
        "type": "call"
      }
    ]
  },
  {
    "slug": "strategy-advisory",
    "icon": "🧭",
    "color": "#0E6B5E",
    "cat": {
      "en": "Strategy & advisory",
      "pt": "Estratégia e consultoria",
      "es": "Estrategia y asesoría"
    },
    "items": [
      {
        "name": {
          "en": "Free strategy session",
          "pt": "Sessão de estratégia gratuita",
          "es": "Sesión de estrategia gratuita"
        },
        "desc": {
          "en": "A free 30-minute call where we pinpoint your single biggest bottleneck and show exactly where Gui and automation would win back your time and revenue.",
          "pt": "Uma ligação gratuita de 30 minutos para achar seu maior gargalo e mostrar onde a Gui e a automação devolvem seu tempo e seu faturamento.",
          "es": "Una llamada gratuita de 30 minutos para detectar tu mayor cuello de botella y mostrarte dónde la Gui y la automatización recuperan tu tiempo y tus ventas."
        },
        "deliver": {
          "en": "Just your business type and the one problem costing you the most right now.",
          "pt": "Só o tipo do seu negócio e o problema que mais te custa hoje.",
          "es": "Solo el tipo de tu negocio y el problema que más te cuesta ahora mismo."
        },
        "br": "Grátis",
        "us": "Free",
        "type": "call"
      },
      {
        "name": {
          "en": "AI & automation diagnosis",
          "pt": "Diagnóstico de IA e automação",
          "es": "Diagnóstico de IA y automatización"
        },
        "desc": {
          "en": "We audit every call, message and booking you still handle by hand, then hand you a clear plan for what Gui, your CRM and payments should automate first.",
          "pt": "Auditamos cada ligação, mensagem e agendamento que você ainda faz na mão e entregamos um plano claro do que a Gui, seu CRM e os pagamentos devem automatizar primeiro.",
          "es": "Auditamos cada llamada, mensaje y reserva que aún haces a mano y te entregamos un plan claro de lo que la Gui, tu CRM y los pagos deben automatizar primero."
        },
        "deliver": {
          "en": "Access to your phone line, your booking flow, and a list of your most common customer requests.",
          "pt": "Acesso à sua linha telefônica, ao seu fluxo de agendamento e uma lista dos pedidos mais comuns dos clientes.",
          "es": "Acceso a tu línea telefónica, tu flujo de reservas y una lista de las solicitudes más comunes de tus clientes."
        },
        "br": "R$1.200–R$3.500",
        "us": "$300–$900",
        "type": "once"
      },
      {
        "name": {
          "en": "Growth strategy sprint",
          "pt": "Sprint de estratégia de crescimento",
          "es": "Sprint de estrategia de crecimiento"
        },
        "desc": {
          "en": "A focused two-week sprint that turns your goals into a concrete plan to capture more leads, close more bookings and win back lost customers.",
          "pt": "Um sprint focado de duas semanas que vira suas metas em um plano concreto para captar mais leads, fechar mais agendamentos e recuperar clientes perdidos.",
          "es": "Un sprint enfocado de dos semanas que convierte tus metas en un plan concreto para captar más leads, cerrar más reservas y recuperar clientes perdidos."
        },
        "deliver": {
          "en": "Your revenue goal, the top two services you want to grow, and read access to your customer list or CRM.",
          "pt": "Sua meta de faturamento, os dois serviços que mais quer crescer e acesso de leitura à sua lista de clientes ou CRM.",
          "es": "Tu meta de ingresos, los dos servicios que más quieres crecer y acceso de lectura a tu lista de clientes o CRM."
        },
        "br": "R$4.500–R$9.000",
        "us": "$1,200–$2,500",
        "type": "once"
      },
      {
        "name": {
          "en": "Business & operations consulting",
          "pt": "Consultoria de negócios e operações",
          "es": "Consultoría de negocio y operaciones"
        },
        "desc": {
          "en": "We redesign how your business runs day to day so your team, your tools and Gui work as one lean, profitable system.",
          "pt": "Redesenhamos como seu negócio roda no dia a dia para que sua equipe, suas ferramentas e a Gui funcionem como um só sistema enxuto e lucrativo.",
          "es": "Rediseñamos cómo funciona tu negocio en el día a día para que tu equipo, tus herramientas y la Gui trabajen como un solo sistema ágil y rentable."
        },
        "deliver": {
          "en": "A walkthrough of your current workflow, your team size, and the tools you use today.",
          "pt": "Uma visão do seu fluxo de trabalho atual, o tamanho da sua equipe e as ferramentas que você usa hoje.",
          "es": "Un recorrido por tu flujo de trabajo actual, el tamaño de tu equipo y las herramientas que usas hoy."
        },
        "br": "R$3.500–R$8.000",
        "us": "$900–$2,200",
        "type": "once"
      },
      {
        "name": {
          "en": "Continuous 360° advisory",
          "pt": "Consultoria 360° contínua",
          "es": "Asesoría 360° continua"
        },
        "desc": {
          "en": "A dedicated strategist on call every month who watches your numbers, tunes Gui and keeps your growth plan moving without you having to chase it.",
          "pt": "Um estrategista dedicado todo mês que acompanha seus números, ajusta a Gui e mantém seu plano de crescimento andando sem você precisar correr atrás.",
          "es": "Un estratega dedicado cada mes que vigila tus números, ajusta la Gui y mantiene tu plan de crecimiento en marcha sin que tengas que perseguirlo."
        },
        "deliver": {
          "en": "Ongoing access to your Guileo dashboard and a 30-minute kickoff to set your monthly priorities.",
          "pt": "Acesso contínuo ao seu painel Guileo e uma reunião de 30 minutos para definir as prioridades do mês.",
          "es": "Acceso continuo a tu panel de Guileo y una reunión inicial de 30 minutos para definir tus prioridades del mes."
        },
        "br": "R$1.500/mês",
        "us": "$400/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Transformation roadmap",
          "pt": "Roteiro de transformação",
          "es": "Hoja de ruta de transformación"
        },
        "desc": {
          "en": "A complete 90-day blueprint that lays out, step by step, how to move your whole business onto AI-first operations with clear milestones and ROI.",
          "pt": "Um blueprint completo de 90 dias que mostra, passo a passo, como levar todo o seu negócio para uma operação AI-first com marcos claros e ROI.",
          "es": "Un plan completo de 90 días que muestra, paso a paso, cómo llevar todo tu negocio a una operación AI-first con hitos claros y ROI."
        },
        "deliver": {
          "en": "A clear picture of where you want the business in a year and access to your last three months of numbers.",
          "pt": "Uma visão clara de onde você quer o negócio em um ano e acesso aos seus números dos últimos três meses.",
          "es": "Una imagen clara de dónde quieres el negocio en un año y acceso a tus números de los últimos tres meses."
        },
        "br": "R$6.000–R$15.000",
        "us": "$1,500–$4,000",
        "type": "once"
      }
    ]
  },
  {
    "slug": "reputation-presence",
    "icon": "⭐",
    "color": "#BA7517",
    "cat": {
      "en": "Reputation & presence",
      "pt": "Reputação e presença",
      "es": "Reputación y presencia"
    },
    "items": [
      {
        "name": {
          "en": "Reputation audit & game plan",
          "pt": "Auditoria de reputação e plano de ação",
          "es": "Auditoría de reputación y plan de acción"
        },
        "desc": {
          "en": "In a free 20-minute call we map your reviews, Google ranking and online presence, then hand you a clear plan to outrank rivals in local search.",
          "pt": "Numa ligação gratuita de 20 minutos mapeamos suas avaliações, posição no Google e presença online e te entregamos um plano claro para passar a concorrência na busca local.",
          "es": "En una llamada gratis de 20 minutos mapeamos tus reseñas, posición en Google y presencia online y te entregamos un plan claro para superar a tu competencia en la búsqueda local."
        },
        "deliver": {
          "en": "Your business name and city, so we can pull your current listings and ratings before the call.",
          "pt": "O nome do seu negócio e a cidade, para puxarmos suas fichas e notas atuais antes da ligação.",
          "es": "El nombre de tu negocio y la ciudad, para revisar tus fichas y calificaciones actuales antes de la llamada."
        },
        "br": "Grátis",
        "us": "Free",
        "type": "call"
      },
      {
        "name": {
          "en": "Review engine: 5 stars on autopilot",
          "pt": "Motor de avaliações: 5 estrelas no automático",
          "es": "Motor de reseñas: 5 estrellas en automático"
        },
        "desc": {
          "en": "Right after each visit, Gui texts or calls your happy customers and walks them straight to your Google review, so 5-star ratings keep stacking up without you lifting a finger.",
          "pt": "Logo após cada visita, a Gui chama seus clientes satisfeitos no WhatsApp ou por ligação e os leva direto à avaliação no Google, fazendo as 5 estrelas crescerem sem você fazer nada.",
          "es": "Justo después de cada visita, Gui escribe o llama a tus clientes satisfechos y los lleva directo a tu reseña de Google, para que las 5 estrellas crezcan sin que muevas un dedo."
        },
        "deliver": {
          "en": "Access to your Google Business Profile, plus how customer contacts reach us (CRM, POS or booking tool).",
          "pt": "Acesso ao seu Perfil da Empresa no Google e como os contatos dos clientes chegam até nós (CRM, PDV ou agenda).",
          "es": "Acceso a tu Perfil de Empresa de Google y cómo nos llegan los contactos de clientes (CRM, punto de venta o agenda)."
        },
        "br": "R$497/mês",
        "us": "$149/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Google profile makeover",
          "pt": "Reformulação do perfil no Google",
          "es": "Renovación del perfil de Google"
        },
        "desc": {
          "en": "We rebuild your Google profile end to end (categories, services, photos, hours, description) so you rank higher and earn trust in the first three seconds.",
          "pt": "Reconstruímos seu perfil do Google de ponta a ponta (categorias, serviços, fotos, horários, descrição) para você aparecer mais acima e passar confiança nos primeiros três segundos.",
          "es": "Reconstruimos tu perfil de Google de punta a punta (categorías, servicios, fotos, horarios, descripción) para que aparezcas más arriba y generes confianza en los primeros tres segundos."
        },
        "deliver": {
          "en": "Manager access to your Google Business Profile, plus your logo, photos and a short description of what you do.",
          "pt": "Acesso de gerente ao seu Perfil da Empresa no Google, seu logo, fotos e uma breve descrição do que você faz.",
          "es": "Acceso de administrador a tu Perfil de Empresa de Google, tu logo, fotos y una breve descripción de lo que haces."
        },
        "br": "R$1.200–R$2.500",
        "us": "$400–$800",
        "type": "once"
      },
      {
        "name": {
          "en": "Listings sync across 50+ directories",
          "pt": "Sincronização em 50+ diretórios",
          "es": "Sincronización en 50+ directorios"
        },
        "desc": {
          "en": "We lock your name, address, phone and hours into Google, Apple Maps, Yelp, Bing and 50+ directories, so customers and search engines never hit the wrong info.",
          "pt": "Travamos seu nome, endereço, telefone e horários no Google, Apple Maps, Yelp, Bing e mais de 50 diretórios, para clientes e buscadores nunca caírem em informação errada.",
          "es": "Fijamos tu nombre, dirección, teléfono y horarios en Google, Apple Maps, Yelp, Bing y más de 50 directorios, para que clientes y buscadores nunca den con información equivocada."
        },
        "deliver": {
          "en": "Your exact name, address, phone, hours and website, plus any logins to listings you already control.",
          "pt": "Seu nome, endereço, telefone, horários e site exatos, além de logins de fichas que você já controla.",
          "es": "Tu nombre, dirección, teléfono, horarios y sitio web exactos, además de accesos a fichas que ya controlas."
        },
        "br": "R$390/mês",
        "us": "$99/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Review replies & at-risk alerts",
          "pt": "Respostas de avaliações e alertas de risco",
          "es": "Respuestas de reseñas y alertas de riesgo"
        },
        "desc": {
          "en": "Gui replies to every review in your brand voice within hours and quietly flags unhappy customers, so you win them back before a bad rating sticks.",
          "pt": "A Gui responde cada avaliação no tom da sua marca em poucas horas e te avisa em silêncio sobre clientes insatisfeitos, para você reconquistá-los antes de a nota ruim pegar.",
          "es": "Gui responde cada reseña con el tono de tu marca en pocas horas y te avisa en privado de clientes molestos, para que los recuperes antes de que la mala calificación se quede."
        },
        "deliver": {
          "en": "Manager access to your review platforms, plus a quick note on your brand voice and who to alert for serious complaints.",
          "pt": "Acesso de gerente às suas plataformas de avaliação e uma nota rápida sobre o tom da sua marca e quem avisar em reclamações sérias.",
          "es": "Acceso de administrador a tus plataformas de reseñas y una nota rápida sobre el tono de tu marca y a quién avisar ante quejas serias."
        },
        "br": "R$590/mês",
        "us": "$179/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Local SEO growth: own your neighborhood",
          "pt": "Crescimento de SEO local: domine seu bairro",
          "es": "Crecimiento de SEO local: domina tu zona"
        },
        "desc": {
          "en": "Every month we tune your profile, posts, photos and keywords so you climb the Google Map Pack and capture the calls now going to competitors.",
          "pt": "Todo mês ajustamos seu perfil, posts, fotos e palavras-chave para você subir no mapa do Google e capturar as ligações que hoje vão para a concorrência.",
          "es": "Cada mes ajustamos tu perfil, publicaciones, fotos y palabras clave para que subas en el mapa de Google y captures las llamadas que hoy reciben tus competidores."
        },
        "deliver": {
          "en": "Manager access to your Google Business Profile and website, plus your top services and the towns or neighborhoods you want to win.",
          "pt": "Acesso de gerente ao seu Perfil da Empresa no Google e ao site, seus principais serviços e os bairros ou cidades que você quer conquistar.",
          "es": "Acceso de administrador a tu Perfil de Empresa de Google y sitio web, tus servicios principales y las zonas o ciudades que quieres ganar."
        },
        "br": "R$1.490/mês",
        "us": "$449/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Reputation rescue sprint",
          "pt": "Sprint de resgate de reputação",
          "es": "Sprint de rescate de reputación"
        },
        "desc": {
          "en": "A focused one-time push that buries old bad reviews under a wave of fresh 5-star ratings and fixes wrong info everywhere your name shows up.",
          "pt": "Um esforço único e focado que enterra avaliações ruins antigas sob uma onda de novas 5 estrelas e corrige informações erradas em todo lugar onde seu nome aparece.",
          "es": "Un empujón único y enfocado que entierra las viejas malas reseñas bajo una ola de nuevas 5 estrellas y corrige la información errónea en todo lugar donde aparece tu nombre."
        },
        "deliver": {
          "en": "Manager access to your profiles, plus a customer list (with consent) we can invite to leave fresh reviews.",
          "pt": "Acesso de gerente aos seus perfis e uma lista de clientes (com consentimento) que possamos convidar a deixar novas avaliações.",
          "es": "Acceso de administrador a tus perfiles y una lista de clientes (con consentimiento) a la que podamos invitar a dejar nuevas reseñas."
        },
        "br": "R$2.000–R$4.500",
        "us": "$650–$1,500",
        "type": "once"
      }
    ]
  },
  {
    "slug": "automation-crm",
    "icon": "🛠️",
    "color": "#185FA5",
    "cat": {
      "en": "Automation & CRM",
      "pt": "Automação e CRM",
      "es": "Automatización y CRM"
    },
    "items": [
      {
        "name": {
          "en": "Unified CRM setup",
          "pt": "Montagem do CRM unificado",
          "es": "Montaje del CRM unificado"
        },
        "desc": {
          "en": "One place for every contact, chat, booking and payment — so you stop digging through five apps to know your own customer.",
          "pt": "Tudo num lugar só: contato, conversa, agendamento e pagamento — você para de caçar em cinco apps pra saber quem é seu cliente.",
          "es": "Todo en un solo lugar: contacto, chat, reserva y pago — dejas de buscar en cinco apps para saber quién es tu cliente."
        },
        "deliver": {
          "en": "Your current customer list (any spreadsheet or export) and access to the tools you use today.",
          "pt": "Sua lista de clientes atual (qualquer planilha ou exportação) e acesso às ferramentas que você já usa.",
          "es": "Tu lista de clientes actual (cualquier planilla o exportación) y acceso a las herramientas que ya usas."
        },
        "br": "R$1.500–R$3.500",
        "us": "$600–$1,500",
        "type": "once"
      },
      {
        "name": {
          "en": "Contact import & cleanup",
          "pt": "Importação e limpeza de contatos",
          "es": "Importación y limpieza de contactos"
        },
        "desc": {
          "en": "We pull in your scattered contacts, kill duplicates and fix the gaps — so Gui starts day one with a clean base it can actually reach.",
          "pt": "Juntamos seus contatos espalhados, matamos duplicados e corrigimos as falhas — o Gui já começa com uma base limpa e que ele consegue acionar.",
          "es": "Juntamos tus contactos dispersos, eliminamos duplicados y corregimos los huecos — Gui arranca con una base limpia y lista para contactar."
        },
        "deliver": {
          "en": "Exports from wherever your contacts live — phone, POS, old CRM, even photos of a notebook work.",
          "pt": "Exportações de onde seus contatos estiverem — celular, PDV, CRM antigo, até foto de caderno serve.",
          "es": "Exportaciones de donde estén tus contactos — celular, TPV, CRM viejo, hasta foto de un cuaderno sirve."
        },
        "br": "R$800–R$2.000",
        "us": "$300–$800",
        "type": "once"
      },
      {
        "name": {
          "en": "Pipeline & follow-up automation",
          "pt": "Automação de funil e follow-up",
          "es": "Automatización de embudo y seguimiento"
        },
        "desc": {
          "en": "Leads move forward on their own and Gui follows up at the perfect moment — so no deal goes cold because someone forgot to reply.",
          "pt": "Os leads andam sozinhos e o Gui faz o follow-up na hora certa — nenhum negócio esfria porque alguém esqueceu de responder.",
          "es": "Los leads avanzan solos y Gui hace el seguimiento en el momento justo — ningún negocio se enfría porque alguien olvidó responder."
        },
        "deliver": {
          "en": "A quick walkthrough of how you sell today — your steps from first contact to closed deal.",
          "pt": "Uma conversa rápida sobre como você vende hoje — do primeiro contato ao fechamento.",
          "es": "Una charla rápida sobre cómo vendes hoy — del primer contacto al cierre."
        },
        "br": "R$497/mês",
        "us": "$149/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Integrations connection",
          "pt": "Conexão de integrações",
          "es": "Conexión de integraciones"
        },
        "desc": {
          "en": "We wire your POS, calendar, WhatsApp and delivery apps into one system — so nothing gets re-typed and nothing slips through the cracks.",
          "pt": "Conectamos seu PDV, agenda, WhatsApp e apps de delivery num sistema só — nada é redigitado e nada se perde no caminho.",
          "es": "Conectamos tu TPV, agenda, WhatsApp y apps de delivery en un solo sistema — nada se reescribe a mano y nada se pierde."
        },
        "deliver": {
          "en": "Logins (or admin access) for the tools you want connected, plus the names of your delivery apps.",
          "pt": "Logins (ou acesso admin) das ferramentas que quer conectar e os nomes dos seus apps de delivery.",
          "es": "Accesos (o permiso admin) de las herramientas a conectar y los nombres de tus apps de delivery."
        },
        "br": "R$1.200–R$4.000",
        "us": "$500–$1,800",
        "type": "once"
      },
      {
        "name": {
          "en": "WhatsApp & messaging hub",
          "pt": "Central de WhatsApp e mensagens",
          "es": "Central de WhatsApp y mensajería"
        },
        "desc": {
          "en": "WhatsApp, SMS and DMs in one inbox where Gui answers in seconds and saves every chat to the right customer — no message ignored again.",
          "pt": "WhatsApp, SMS e DMs numa caixa só, com o Gui respondendo em segundos e salvando cada conversa no cliente certo — nenhuma mensagem ignorada.",
          "es": "WhatsApp, SMS y DMs en una sola bandeja, con Gui respondiendo en segundos y guardando cada chat en el cliente correcto — ningún mensaje ignorado."
        },
        "deliver": {
          "en": "The number and channels you use with customers, plus access to approve the WhatsApp connection.",
          "pt": "O número e os canais que você usa com clientes e acesso para aprovar a conexão do WhatsApp.",
          "es": "El número y los canales que usas con clientes y acceso para aprobar la conexión de WhatsApp."
        },
        "br": "R$397/mês",
        "us": "$119/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "360° customer profiles",
          "pt": "Perfis de cliente 360°",
          "es": "Perfiles de cliente 360°"
        },
        "desc": {
          "en": "Every tool's data merged into one rich profile per customer — so you see the whole history at a glance and Gui sells like it remembers them.",
          "pt": "Os dados de todas as ferramentas num perfil rico por cliente — você vê o histórico inteiro de relance e o Gui atende como quem lembra de cada um.",
          "es": "Los datos de todas tus herramientas en un perfil rico por cliente — ves el historial completo de un vistazo y Gui atiende como quien recuerda a cada uno."
        },
        "deliver": {
          "en": "The list of systems that hold your customer data and one example customer to unify first.",
          "pt": "A lista de sistemas que guardam dados de clientes e um cliente de exemplo pra unificar primeiro.",
          "es": "La lista de sistemas que guardan datos de clientes y un cliente de ejemplo para unificar primero."
        },
        "br": "R$2.000–R$5.000",
        "us": "$800–$2,200",
        "type": "once"
      },
      {
        "name": {
          "en": "Custom workflow build",
          "pt": "Fluxo personalizado",
          "es": "Flujo personalizado"
        },
        "desc": {
          "en": "We automate the repetitive task eating your day — quotes, reminders, win-backs, hand-offs — built exactly around how you already work.",
          "pt": "Automatizamos a tarefa repetitiva que come seu dia — orçamentos, lembretes, reativação, repasses — feita do jeito que você já trabalha.",
          "es": "Automatizamos la tarea repetitiva que se come tu día — cotizaciones, recordatorios, reactivación, traspasos — a la medida de cómo ya trabajas."
        },
        "deliver": {
          "en": "A short description of the manual task you want gone and roughly how often it happens.",
          "pt": "Uma breve descrição da tarefa manual que você quer eliminar e mais ou menos com que frequência ela acontece.",
          "es": "Una breve descripción de la tarea manual que quieres eliminar y más o menos cada cuánto ocurre."
        },
        "br": "R$1.000–R$3.000",
        "us": "$400–$1,200",
        "type": "once"
      },
      {
        "name": {
          "en": "Automation strategy call",
          "pt": "Call de estratégia",
          "es": "Llamada de estrategia"
        },
        "desc": {
          "en": "A free 20-minute call where we map your busywork and show exactly where Gui and the CRM win you back the most hours.",
          "pt": "Uma call gratuita de 20 minutos onde mapeamos seu trabalho braçal e mostramos onde o Gui e o CRM te devolvem mais horas.",
          "es": "Una llamada gratis de 20 minutos donde mapeamos tu trabajo manual y te mostramos dónde Gui y el CRM te devuelven más horas."
        },
        "deliver": {
          "en": "Just 20 minutes and an honest look at what slows your team down most.",
          "pt": "Só 20 minutos e um olhar honesto sobre o que mais trava sua equipe.",
          "es": "Solo 20 minutos y una mirada honesta a lo que más frena a tu equipo."
        },
        "br": "Grátis",
        "us": "Free",
        "type": "call"
      }
    ]
  },
  {
    "slug": "emerging",
    "icon": "🚀",
    "color": "#D85A30",
    "cat": {
      "en": "Emerging — what more we can offer",
      "pt": "Emergentes — o que mais podemos oferecer",
      "es": "Emergentes — qué más podemos ofrecer"
    },
    "items": [
      {
        "name": {
          "en": "AI front desk for a whole department",
          "pt": "Recepção de IA para um setor inteiro",
          "es": "Recepción con IA para un área entera"
        },
        "desc": {
          "en": "Gui runs an entire function — reception, collections, or after-hours support — 24/7 across calls, texts, and WhatsApp. Skip the salaried hire and never miss a customer again.",
          "pt": "A Gui toca um setor inteiro — recepção, cobrança ou suporte fora do horário — 24/7 por ligação, mensagem e WhatsApp. Economize uma contratação fixa e nunca mais perca um cliente.",
          "es": "Gui maneja un área entera — recepción, cobranzas o soporte fuera de horario — 24/7 por llamada, mensaje y WhatsApp. Ahórrate una contratación fija y no pierdas más clientes."
        },
        "deliver": {
          "en": "A 30-min walkthrough of how the department works today, your scripts or FAQs, and access to your phone number and calendar.",
          "pt": "Uma conversa de 30 min sobre como o setor funciona hoje, seus roteiros ou perguntas frequentes, e acesso ao seu número e à sua agenda.",
          "es": "Una charla de 30 min sobre cómo funciona el área hoy, tus guiones o preguntas frecuentes, y acceso a tu número y tu agenda."
        },
        "br": "R$1.490–R$3.900/mês",
        "us": "$390–$990/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Outbound sales as a service",
          "pt": "Vendas ativas como serviço",
          "es": "Ventas salientes como servicio"
        },
        "desc": {
          "en": "Gui works your leads and CRM — calling and messaging to qualify, book, and even collect a deposit. Cold and dormant contacts become booked revenue, no sales rep required.",
          "pt": "A Gui trabalha seus leads e o CRM — ligando e mensageando para qualificar, agendar e até receber o sinal. Contatos frios e parados viram receita agendada, sem precisar de vendedor.",
          "es": "Gui trabaja tus leads y tu CRM — llamando y escribiendo para calificar, agendar e incluso cobrar una seña. Los contactos fríos y dormidos se vuelven ingresos agendados, sin vendedor."
        },
        "deliver": {
          "en": "Your contact list or CRM export, your offer and pricing, and the outcome you want (booked call, quote, or deposit).",
          "pt": "Sua lista de contatos ou exportação do CRM, sua oferta e seus preços, e o resultado que você quer (ligação agendada, orçamento ou sinal).",
          "es": "Tu lista de contactos o exportación del CRM, tu oferta y precios, y el resultado que buscas (llamada agendada, cotización o seña)."
        },
        "br": "R$1.990–R$5.900/mês",
        "us": "$490–$1,490/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Multi-location command center",
          "pt": "Central de comando multiunidades",
          "es": "Central de mando multisede"
        },
        "desc": {
          "en": "One Gui and one CRM run every location — per-branch routing, shared customer history, and a single dashboard comparing bookings, revenue, and no-shows across all your units.",
          "pt": "Uma Gui e um CRM tocam todas as unidades — roteamento por filial, histórico de cliente compartilhado e um painel único comparando agendamentos, receita e faltas entre elas.",
          "es": "Un Gui y un CRM manejan todas tus sedes — enrutamiento por sucursal, historial de cliente compartido y un tablero único que compara reservas, ingresos y ausencias entre todas."
        },
        "deliver": {
          "en": "A list of your locations with their phone numbers, hours, and services, plus who manages each one.",
          "pt": "Uma lista das suas unidades com telefones, horários e serviços, além de quem gerencia cada uma.",
          "es": "Una lista de tus sedes con sus teléfonos, horarios y servicios, además de quién gestiona cada una."
        },
        "br": "R$2.900–R$9.900/mês",
        "us": "$790–$2,490/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "White-label Gui for agencies and franchises",
          "pt": "Gui white-label para agências e franquias",
          "es": "Gui white-label para agencias y franquicias"
        },
        "desc": {
          "en": "Resell Gui and the CRM under your own brand to clients or franchisees. Your pricing, your dashboard, and a revenue share on every account you bring in.",
          "pt": "Revenda a Gui e o CRM com a sua marca para clientes ou franqueados. Seus preços, seu painel e uma divisão de receita em cada conta que você trouxer.",
          "es": "Revende Gui y el CRM con tu propia marca a clientes o franquiciados. Tus precios, tu tablero y un reparto de ingresos por cada cuenta que traigas."
        },
        "deliver": {
          "en": "Your brand assets, the type of clients you serve, and roughly how many accounts you expect in the first 90 days.",
          "pt": "Seus materiais de marca, o tipo de cliente que você atende e uma estimativa de quantas contas espera nos primeiros 90 dias.",
          "es": "Tus materiales de marca, el tipo de clientes que atiendes y una estimación de cuántas cuentas esperas en los primeros 90 días."
        },
        "br": "R$4.900–R$19.900/mês + revenue share",
        "us": "$1,490–$4,990/mo + revenue share",
        "type": "call"
      },
      {
        "name": {
          "en": "Staff AI training and adoption",
          "pt": "Treinamento e adoção de IA para a equipe",
          "es": "Capacitación y adopción de IA del equipo"
        },
        "desc": {
          "en": "We train your team to work with Gui and the CRM — handing off conversations, reading insights, closing the loop — so the platform actually gets used instead of ignored.",
          "pt": "Treinamos sua equipe para trabalhar com a Gui e o CRM — passando conversas, lendo insights e fechando o ciclo — para a plataforma ser realmente usada, e não ignorada.",
          "es": "Capacitamos a tu equipo para trabajar con Gui y el CRM — derivando conversaciones, leyendo insights y cerrando el ciclo — para que la plataforma se use de verdad y no se ignore."
        },
        "deliver": {
          "en": "Your team size and roles, their comfort with technology, and a preferred language and time for the live sessions.",
          "pt": "O tamanho e os cargos da sua equipe, o nível de familiaridade com tecnologia, e o idioma e horário preferidos para as sessões ao vivo.",
          "es": "El tamaño y los roles de tu equipo, su familiaridad con la tecnología, y el idioma y horario preferidos para las sesiones en vivo."
        },
        "br": "R$1.900–R$6.900",
        "us": "$490–$1,790",
        "type": "once"
      },
      {
        "name": {
          "en": "Working capital on your own numbers",
          "pt": "Capital de giro com base nos seus números",
          "es": "Capital de trabajo sobre tus propios números"
        },
        "desc": {
          "en": "Gui already tracks your bookings, payments, and recurring revenue — so we can pre-qualify you for advances or financing partners on real cash flow. No spreadsheets, no waiting.",
          "pt": "A Gui já acompanha seus agendamentos, pagamentos e receita recorrente — então podemos pré-qualificar você para adiantamentos ou parceiros de crédito com base no fluxo de caixa real. Sem planilhas, sem espera.",
          "es": "Gui ya registra tus reservas, pagos e ingresos recurrentes — así podemos precalificarte para adelantos o socios de financiamiento sobre tu flujo de caja real. Sin planillas, sin esperas."
        },
        "deliver": {
          "en": "An active Gui plan with payments turned on, plus consent for us to read your booking and revenue data.",
          "pt": "Um plano Gui ativo com pagamentos ligados, mais o consentimento para lermos seus dados de agendamento e receita.",
          "es": "Un plan Gui activo con pagos habilitados, más tu consentimiento para leer tus datos de reservas e ingresos."
        },
        "br": "Grátis (pré-qualificação)",
        "us": "Free (pre-qualification)",
        "type": "call"
      },
      {
        "name": {
          "en": "Industry benchmark and insights reports",
          "pt": "Relatórios de benchmark e insights do setor",
          "es": "Informes de referencia e insights del sector"
        },
        "desc": {
          "en": "A monthly report showing how your bookings, pricing, no-show rate, and peak hours stack up against similar businesses in your sector and region — with concrete moves to grow.",
          "pt": "Um relatório mensal mostrando como seus agendamentos, preços, taxa de faltas e horários de pico se comparam a negócios parecidos do seu setor e região — com ações concretas para crescer.",
          "es": "Un informe mensual que muestra cómo tus reservas, precios, tasa de ausencias y horas pico se comparan con negocios similares de tu sector y región — con acciones concretas para crecer."
        },
        "deliver": {
          "en": "Your business sector, city or region, and consent to include your anonymized data in the benchmark.",
          "pt": "Seu setor, sua cidade ou região, e o consentimento para incluir seus dados anonimizados no benchmark.",
          "es": "Tu sector, tu ciudad o región, y tu consentimiento para incluir tus datos anonimizados en el benchmark."
        },
        "br": "R$290–R$890/mês",
        "us": "$79–$229/mo",
        "type": "ongoing"
      },
      {
        "name": {
          "en": "Vertical all-in-one bundles",
          "pt": "Pacotes tudo-em-um por segmento",
          "es": "Paquetes todo-en-uno por rubro"
        },
        "desc": {
          "en": "A ready-to-run package for your exact business — clinic, restaurant, salon, or auto shop. Gui comes pre-trained for your sector, with the CRM, payments, and growth engines already wired in.",
          "pt": "Um pacote pronto para o seu negócio — clínica, restaurante, salão ou oficina. A Gui já vem pré-treinada para o seu setor, com CRM, pagamentos e motores de crescimento integrados.",
          "es": "Un paquete listo para tu negocio — clínica, restaurante, salón o taller. Gui viene preentrenada para tu rubro, con el CRM, los pagos y los motores de crecimiento ya integrados."
        },
        "deliver": {
          "en": "Just your business type, your service menu or price list, and your phone number — we handle the rest.",
          "pt": "Apenas o tipo do seu negócio, seu cardápio ou tabela de preços e seu telefone — cuidamos do resto.",
          "es": "Solo tu tipo de negocio, tu menú o lista de precios y tu teléfono — del resto nos encargamos nosotros."
        },
        "br": "R$990–R$2.900/mês",
        "us": "$249–$790/mo",
        "type": "ongoing"
      }
    ]
  }
];
