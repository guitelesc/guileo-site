import { NOME_DO_PAINEL } from "../portal/nome.js";
// Gui Support — Trilingual scenario library (PT-BR / EN / ES-LatAm)
// The brain that lets Gui Support resolve client issues instantly by keyword match.
// Categories: setup | billing | agent | technical | feature | account | data | finance | marketing
export const SUPPORT_KB = [
  // ─────────────────────────────  SETUP  ─────────────────────────────
  {
    id: "connection-code-not-working",
    category: "setup",
    keywords: ["código", "conexão", "code", "connection", "não conecta", "no data", "sample", "amostra", "código no funciona", "no conecta"],
    q: {
      pt: "Meu código de conexão não funciona / não vejo meus dados reais",
      en: "My connection code isn't working / I don't see my real data",
      es: "Mi código de conexión no funciona / no veo mis datos reales",
    },
    a: {
      pt: "Sem stress, eu cuido disso. Esse código liga sua conta aos dados reais — se ainda aparecem números de amostra, é porque o código não foi colado ou expirou. Vá em Configurações → Conexão, gere um código novo e cole o atual; em segundos seus dados reais aparecem. Posso já abrir e reenviar um código fresco pra você.",
      en: "No stress, I've got this. That code links your account to your real data — if you still see sample numbers, the code wasn't pasted or it expired. Go to Settings → Connection, generate a fresh code and paste the current one; your real data shows up in seconds. I can open it and resend a fresh code right now.",
      es: "Tranquilo, yo me encargo. Ese código conecta tu cuenta con tus datos reales — si todavía ves números de muestra, el código no se pegó o caducó. Ve a Configuración → Conexión, genera un código nuevo y pégalo; tus datos reales aparecen en segundos. Puedo abrirlo y reenviarte un código fresco ahora mismo.",
    },
    action: { kind: "resend_code", label: { pt: "Reenviar código", en: "Resend code", es: "Reenviar código" } },
    escalate: false,
  },
  {
    id: "connect-whatsapp",
    category: "setup",
    keywords: ["whatsapp", "conectar whatsapp", "connect whatsapp", "número", "number", "wpp", "zap", "vincular"],
    q: {
      pt: "Como conecto meu WhatsApp ao Gui?",
      en: "How do I connect my WhatsApp to Gui?",
      es: "¿Cómo conecto mi WhatsApp a Gui?",
    },
    a: {
      pt: "Adoro essa parte — é onde a mágica começa. Em Configurações → Canais → WhatsApp, escolha conectar seu número existente ou usar um número Guileo, e siga a verificação por código. Assim que aparecer o selo verde 'conectado', eu já começo a responder seus clientes 24/7. Quer que eu abra a tela de canais pra você agora?",
      en: "I love this part — it's where the magic starts. In Settings → Channels → WhatsApp, choose to connect your existing number or use a Guileo number, then follow the code verification. The moment you see the green 'connected' badge, I start replying to your customers 24/7. Want me to open the Channels screen for you?",
      es: "Me encanta esta parte — aquí empieza la magia. En Configuración → Canales → WhatsApp, elige conectar tu número actual o usar un número Guileo, y sigue la verificación por código. En cuanto veas el sello verde 'conectado', empiezo a responder a tus clientes 24/7. ¿Te abro la pantalla de Canales?",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Canais", en: "Open Channels", es: "Abrir Canales" } },
    escalate: false,
  },
  {
    id: "connect-phone",
    category: "setup",
    keywords: ["telefone", "ligações", "phone", "calls", "linha", "line", "número de telefone", "teléfono", "llamadas", "desvio"],
    q: {
      pt: "Como faço o Gui atender minhas ligações?",
      en: "How do I get Gui to answer my phone calls?",
      es: "¿Cómo hago que Gui conteste mis llamadas?",
    },
    a: {
      pt: "Simples e rápido. Em Configurações → Canais → Telefone você pode usar um número Guileo dedicado ou ativar o desvio de chamadas do seu número atual (eu mostro o passo a passo da sua operadora). Feito isso, toda ligação cai comigo: atendo, agendo e faço follow-up. Posso abrir as configurações de telefone pra você?",
      en: "Quick and simple. In Settings → Channels → Phone you can use a dedicated Guileo number or set up call forwarding from your current line (I'll show your carrier's exact steps). Once that's done, every call comes to me: I answer, book, and follow up. Want me to open the phone settings?",
      es: "Rápido y simple. En Configuración → Canales → Teléfono puedes usar un número Guileo dedicado o activar el desvío de llamadas de tu línea actual (te muestro los pasos de tu operador). Listo eso, cada llamada llega a mí: contesto, agendo y hago seguimiento. ¿Te abro la configuración de teléfono?",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Telefone", en: "Open Phone", es: "Abrir Teléfono" } },
    escalate: false,
  },
  {
    id: "go-live",
    category: "setup",
    keywords: ["go live", "ativar", "publicar", "ligar o gui", "turn on", "activar", "ao vivo", "live", "começar a atender", "launch"],
    q: {
      pt: "Como deixo o Gui ao vivo / ativo para clientes?",
      en: "How do I take Gui live for my customers?",
      es: "¿Cómo pongo a Gui en vivo para mis clientes?",
    },
    a: {
      pt: "Você está a um clique. Confira o checklist em Command Center: canal conectado, horário e endereço preenchidos e cardápio/preços carregados. Tudo verde? É só apertar 'Ativar Gui' e eu entro em serviço imediatamente. Posso revisar o checklist com você agora.",
      en: "You're one click away. Check the go-live checklist in the Command Center: channel connected, hours and address filled in, menu/prices loaded. All green? Just hit 'Activate Gui' and I go into service immediately. I can run the checklist with you now.",
      es: "Estás a un clic. Revisa el checklist en el Command Center: canal conectado, horario y dirección cargados, menú/precios listos. ¿Todo en verde? Solo presiona 'Activar a Gui' y entro en servicio de inmediato. Puedo revisar el checklist contigo ahora.",
    },
    action: { kind: "reactivate_agent", label: { pt: "Ativar Gui", en: "Activate Gui", es: "Activar a Gui" } },
    escalate: false,
  },
  {
    id: "onboarding-stuck",
    category: "setup",
    keywords: ["onboarding", "travado", "stuck", "preso", "não avança", "configuração inicial", "setup", "atascado", "no avanza", "começo"],
    q: {
      pt: "Estou travado na configuração inicial (onboarding)",
      en: "I'm stuck in the initial setup (onboarding)",
      es: "Estoy atascado en la configuración inicial (onboarding)",
    },
    a: {
      pt: "Vamos destravar juntos. Cada passo do onboarding fica salvo, então você não perde nada — me diga em qual etapa parou (negócio, canal, horário ou cardápio) que eu te levo direto pra lá. Se um campo não salva, atualize a página uma vez; quase sempre resolve. Posso reabrir o assistente no passo onde você parou.",
      en: "Let's unstick this together. Every onboarding step is saved, so you lose nothing — tell me where you stopped (business, channel, hours or menu) and I'll take you straight there. If a field won't save, refresh the page once; that fixes it nearly every time. I can reopen the wizard at your last step.",
      es: "Lo destrabamos juntos. Cada paso del onboarding queda guardado, así que no pierdes nada — dime en qué etapa quedaste (negocio, canal, horario o menú) y te llevo directo. Si un campo no guarda, actualiza la página una vez; casi siempre lo resuelve. Puedo reabrir el asistente en tu último paso.",
    },
    action: { kind: "open_settings", label: { pt: "Retomar onboarding", en: "Resume onboarding", es: "Retomar onboarding" } },
    escalate: false,
  },
  {
    id: "change-business-hours",
    category: "setup",
    keywords: ["horário", "horas", "hours", "funcionamento", "horario", "abrir", "fechar", "open", "close", "expediente", "feriado"],
    q: {
      pt: "Como mudo meu horário de funcionamento?",
      en: "How do I change my business hours?",
      es: "¿Cómo cambio mi horario de atención?",
    },
    a: {
      pt: "É instantâneo. Vá em Configurações → Horários, ajuste cada dia (e adicione feriados ou pausas, se quiser) e salve. Eu passo a respeitar os novos horários na mesma hora — informo clientes quando você está aberto e agendo só dentro da janela certa. Quero abrir os horários pra você?",
      en: "It's instant. Go to Settings → Hours, adjust each day (add holidays or breaks if you like) and save. I'll respect the new hours immediately — telling customers when you're open and only booking inside the right window. Want me to open Hours for you?",
      es: "Es instantáneo. Ve a Configuración → Horarios, ajusta cada día (agrega feriados o pausas si quieres) y guarda. Respeto los nuevos horarios de inmediato — aviso a los clientes cuándo abres y solo agendo dentro de la ventana correcta. ¿Te abro Horarios?",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Horários", en: "Open Hours", es: "Abrir Horarios" } },
    escalate: false,
  },

  // ─────────────────────────────  AGENT  ─────────────────────────────
  {
    id: "gui-stopped-answering",
    category: "agent",
    keywords: ["parou de atender", "stopped answering", "não responde", "not answering", "gui parou", "offline", "no responde", "dejó de contestar", "mudo"],
    q: {
      pt: "Meu Gui parou de atender",
      en: "My Gui stopped answering",
      es: "Mi Gui dejó de contestar",
    },
    a: {
      pt: "Vou resolver agora. Na maioria das vezes é o agente em pausa ou créditos zerados — confira o status no Command Center (precisa estar 'Ativo' e verde). Se estiver pausado, reativo num toque; se forem créditos, te levo pra recarga. Posso reativar o Gui agora mesmo.",
      en: "I'll fix this right now. Most often it's the agent paused or credits at zero — check the status in the Command Center (it should read 'Active' and green). If it's paused, I reactivate in one tap; if it's credits, I'll take you to top up. I can reactivate Gui right now.",
      es: "Lo soluciono ya. Casi siempre es el agente en pausa o créditos en cero — revisa el estado en el Command Center (debe decir 'Activo' y estar en verde). Si está pausado, lo reactivo en un toque; si son créditos, te llevo a recargar. Puedo reactivar a Gui ahora mismo.",
    },
    action: { kind: "reactivate_agent", label: { pt: "Reativar Gui", en: "Reactivate Gui", es: "Reactivar a Gui" } },
    escalate: false,
  },
  {
    id: "gui-said-something-wrong",
    category: "agent",
    keywords: ["falou errado", "said wrong", "resposta errada", "wrong answer", "informação errada", "erro", "dijo mal", "respuesta incorrecta", "mentiu", "inventou"],
    q: {
      pt: "O Gui falou algo errado para um cliente",
      en: "Gui said something wrong to a customer",
      es: "Gui le dijo algo incorrecto a un cliente",
    },
    a: {
      pt: "Obrigado por avisar — eu aprendo na hora. Geralmente é uma informação desatualizada no meu treino (preço, prazo, política). Vá em Treinar Gui, corrija o ponto exato e salve; eu passo a responder certo a partir do próximo contato. Me diga o que eu deveria ter dito e já abro o treino pra ajustar.",
      en: "Thanks for flagging it — I learn instantly. Usually it's outdated info in my training (a price, a lead time, a policy). Go to Train Gui, correct that exact point and save; I'll answer correctly from the next conversation on. Tell me what I should have said and I'll open training to fix it.",
      es: "Gracias por avisar — aprendo al instante. Suele ser información desactualizada en mi entrenamiento (un precio, un plazo, una política). Ve a Entrenar a Gui, corrige ese punto exacto y guarda; responderé bien desde la próxima conversación. Dime qué debí decir y abro el entrenamiento para ajustarlo.",
    },
    action: { kind: "train_ai", label: { pt: "Treinar Gui", en: "Train Gui", es: "Entrenar a Gui" } },
    escalate: false,
  },
  {
    id: "change-gui-voice-name-language",
    category: "agent",
    keywords: ["voz", "nome", "idioma", "voice", "name", "language", "mudar voz", "trocar nome", "cambiar voz", "nombre", "sotaque", "personalidade"],
    q: {
      pt: "Como mudo a voz, o nome ou o idioma do Gui?",
      en: "How do I change Gui's voice, name or language?",
      es: "¿Cómo cambio la voz, el nombre o el idioma de Gui?",
    },
    a: {
      pt: "Personalizar é uma delícia. Em Configurações → Personalidade do Agente você escolhe o nome, a voz (vários timbres e sotaques) e o idioma principal — eu até alterno automaticamente conforme o idioma do cliente. As mudanças valem na próxima conversa. Quer que eu abra essa tela?",
      en: "Personalizing is a treat. In Settings → Agent Personality you pick the name, the voice (several tones and accents) and the main language — I'll even switch automatically to match the customer's language. Changes apply on the next conversation. Want me to open that screen?",
      es: "Personalizar es un gusto. En Configuración → Personalidad del Agente eliges el nombre, la voz (varios tonos y acentos) y el idioma principal — incluso cambio automáticamente según el idioma del cliente. Los cambios aplican en la próxima conversación. ¿Te abro esa pantalla?",
    },
    action: { kind: "open_settings", label: { pt: "Personalizar Gui", en: "Customize Gui", es: "Personalizar a Gui" } },
    escalate: false,
  },
  {
    id: "gui-not-booking",
    category: "agent",
    keywords: ["não agenda", "not booking", "agendamento", "booking", "não marca", "no agenda", "no reserva", "calendar", "agenda vazia", "horários"],
    q: {
      pt: "O Gui não está agendando / marcando horários",
      en: "Gui isn't booking appointments",
      es: "Gui no está agendando citas",
    },
    a: {
      pt: "Vamos liberar isso. Quase sempre é a agenda sem disponibilidade definida — confira em Configurações → Agenda se há serviços, duração e janelas de horário cadastrados. Sem essas regras eu não consigo oferecer um horário. Posso abrir a agenda pra revisarmos a disponibilidade.",
      en: "Let's unblock it. Almost always it's no availability defined — check Settings → Scheduling for services, durations and time windows. Without those rules I can't offer a slot. I can open Scheduling so we review availability together.",
      es: "Vamos a desbloquearlo. Casi siempre es que no hay disponibilidad definida — revisa en Configuración → Agenda si hay servicios, duración y ventanas de horario cargadas. Sin esas reglas no puedo ofrecer un horario. Puedo abrir la Agenda para revisar la disponibilidad.",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Agenda", en: "Open Scheduling", es: "Abrir Agenda" } },
    escalate: false,
  },
  {
    id: "train-gui-menu-prices",
    category: "agent",
    keywords: ["treinar", "cardápio", "menu", "preços", "train", "prices", "entrenar", "menú", "precios", "produtos", "serviços", "tabela"],
    q: {
      pt: "Como treino o Gui no meu cardápio / preços / serviços?",
      en: "How do I train Gui on my menu / prices / services?",
      es: "¿Cómo entreno a Gui con mi menú / precios / servicios?",
    },
    a: {
      pt: "É aqui que eu fico afiado. Em Treinar Gui você cola seu cardápio, lista de preços ou serviços — pode digitar, colar texto ou subir um arquivo (PDF/foto). Eu leio, organizo e passo a cotar valores exatos e fechar na conversa. Quer abrir o Treino pra carregarmos agora?",
      en: "This is where I get sharp. In Train Gui you drop in your menu, price list or services — type it, paste text, or upload a file (PDF/photo). I read it, organize it, and start quoting exact prices and closing on the conversation. Want to open Training and load it now?",
      es: "Aquí es donde me afino. En Entrenar a Gui pegas tu menú, lista de precios o servicios — escríbelo, pega texto o sube un archivo (PDF/foto). Lo leo, lo organizo y empiezo a cotizar precios exactos y cerrar en la conversación. ¿Abrimos el Entrenamiento para cargarlo ahora?",
    },
    action: { kind: "train_ai", label: { pt: "Treinar Gui", en: "Train Gui", es: "Entrenar a Gui" } },
    escalate: false,
  },
  {
    id: "gui-transferred-unnecessarily",
    category: "agent",
    keywords: ["transferiu", "transferred", "passou pra mim", "transfer", "encaminhou", "transfirió", "me pasó", "handoff", "escalou", "desnecessário"],
    q: {
      pt: "O Gui transferiu a ligação pra mim sem necessidade",
      en: "Gui transferred the call to me unnecessarily",
      es: "Gui me transfirió la llamada sin necesidad",
    },
    a: {
      pt: "Entendo — eu só passo pra você quando não tenho a resposta. Geralmente o cliente perguntou algo fora do meu treino. Me diga o tema e, em Treinar Gui, eu adiciono essa resposta pra resolver sozinho da próxima. Também dá pra ajustar minhas regras de transferência em Configurações → Personalidade. Quer que eu abra o treino?",
      en: "I hear you — I only hand off when I don't have the answer. Usually the customer asked something outside my training. Tell me the topic and in Train Gui I'll add that answer so I handle it solo next time. You can also tune my transfer rules in Settings → Personality. Want me to open training?",
      es: "Te entiendo — solo te paso la llamada cuando no tengo la respuesta. Normalmente el cliente preguntó algo fuera de mi entrenamiento. Dime el tema y en Entrenar a Gui agrego esa respuesta para resolverlo solo la próxima. También puedes ajustar mis reglas de transferencia en Configuración → Personalidad. ¿Abro el entrenamiento?",
    },
    action: { kind: "train_ai", label: { pt: "Treinar Gui", en: "Train Gui", es: "Entrenar a Gui" } },
    escalate: false,
  },
  {
    id: "gui-auto-callback",
    category: "agent",
    keywords: ["retorno", "callback", "ligou de volta", "perdida", "missed call", "ocupado", "busy", "devolver llamada", "perdida", "auto retorno"],
    q: {
      pt: "O Gui liga de volta quando perco uma chamada?",
      en: "Does Gui call back when I miss a call?",
      es: "¿Gui devuelve la llamada cuando pierdo una?",
    },
    a: {
      pt: "Liga, sim — esse é um dos meus melhores truques. Quando sua linha está ocupada ou uma chamada é perdida, eu retorno automaticamente para o cliente, sem nenhum passo manual seu. Você pode ligar ou desligar isso em Configurações → Retorno Automático. Quer revisar essa regra comigo?",
      en: "I do — it's one of my best tricks. When your line is busy or a call is missed, I automatically call the customer back, with zero manual step from you. You can turn it on or off in Settings → Auto-Callback. Want to review that rule with me?",
      es: "Sí — es uno de mis mejores trucos. Cuando tu línea está ocupada o se pierde una llamada, devuelvo la llamada al cliente automáticamente, sin ningún paso manual tuyo. Puedes activarlo o desactivarlo en Configuración → Devolución Automática. ¿Revisamos esa regla juntos?",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Retorno Automático", en: "Open Auto-Callback", es: "Abrir Devolución Automática" } },
    escalate: false,
  },

  // ─────────────────────────────  BILLING  ─────────────────────────────
  {
    id: "how-credits-work",
    category: "billing",
    keywords: ["créditos", "como funcionam", "credits", "how credits", "consumo", "minutos", "créditos", "cómo funcionan", "saldo", "gasto"],
    q: {
      pt: "Como funcionam os créditos?",
      en: "How do credits work?",
      es: "¿Cómo funcionan los créditos?",
    },
    a: {
      pt: "É bem direto. Cada conversa que eu conduzo — ligação, WhatsApp ou SMS — consome créditos conforme o uso; seu plano já vem com uma cota mensal que renova todo mês. Você acompanha o saldo em tempo real em Cobrança e, se quiser, eu aviso quando estiver baixo. Quer abrir Cobrança pra ver seu saldo?",
      en: "It's straightforward. Every conversation I run — call, WhatsApp or SMS — uses credits based on usage; your plan includes a monthly allowance that renews each month. You track the balance live in Billing and, if you like, I'll alert you when it runs low. Want me to open Billing to see your balance?",
      es: "Es muy simple. Cada conversación que llevo — llamada, WhatsApp o SMS — consume créditos según el uso; tu plan incluye un cupo mensual que se renueva cada mes. Ves el saldo en tiempo real en Facturación y, si quieres, te aviso cuando esté bajo. ¿Te abro Facturación para ver tu saldo?",
    },
    action: { kind: "open_billing", label: { pt: "Abrir Cobrança", en: "Open Billing", es: "Abrir Facturación" } },
    escalate: false,
  },
  {
    id: "out-of-credits",
    category: "billing",
    keywords: ["acabaram créditos", "out of credits", "sem créditos", "zerou", "ran out", "sin créditos", "se acabaron", "recarregar", "top up", "saldo zero"],
    q: {
      pt: "Meus créditos acabaram",
      en: "I ran out of credits",
      es: "Se me acabaron los créditos",
    },
    a: {
      pt: "Vamos te recolocar no ar rapidinho. Sem créditos eu fico em pausa pra não deixar nada cair errado — em Cobrança você recarrega na hora ou ativa a recarga automática pra nunca mais parar. Assim que o saldo entra, eu volto a atender no mesmo segundo. Posso abrir a recarga pra você.",
      en: "Let's get you back on air fast. With no credits I pause so nothing slips through wrong — in Billing you can top up instantly or switch on auto-recharge so you never stop again. The moment the balance lands, I'm answering again. I can open the top-up for you.",
      es: "Te ponemos de vuelta al aire rápido. Sin créditos me pauso para que nada falle — en Facturación recargas al instante o activas la recarga automática para no parar nunca más. En cuanto entra el saldo, vuelvo a contestar al segundo. Puedo abrir la recarga.",
    },
    action: { kind: "open_billing", label: { pt: "Recarregar créditos", en: "Top up credits", es: "Recargar créditos" } },
    escalate: false,
  },
  {
    id: "change-plan",
    category: "billing",
    keywords: ["mudar plano", "change plan", "upgrade", "downgrade", "trocar plano", "cambiar plan", "plano", "plan", "assinatura", "mais créditos"],
    q: {
      pt: "Quero mudar de plano (upgrade ou downgrade)",
      en: "I want to change my plan (upgrade or downgrade)",
      es: "Quiero cambiar de plan (subir o bajar)",
    },
    a: {
      pt: "Claro — seu plano acompanha seu ritmo. Em Cobrança → Plano você vê todas as opções com os créditos e recursos de cada uma e troca na hora; o ajuste de valor é calculado proporcionalmente. Upgrade vale na hora; downgrade entra no próximo ciclo. Quer que eu abra os planos?",
      en: "Of course — your plan should keep pace with you. In Billing → Plan you'll see every option with its credits and features and switch instantly; the price is prorated. Upgrades apply immediately; downgrades take effect next cycle. Want me to open the plans?",
      es: "Claro — tu plan debe seguir tu ritmo. En Facturación → Plan ves todas las opciones con sus créditos y funciones y cambias al instante; el monto se prorratea. Las subidas aplican ya; las bajadas entran en el próximo ciclo. ¿Te abro los planes?",
    },
    action: { kind: "open_billing", label: { pt: "Ver planos", en: "View plans", es: "Ver planes" } },
    escalate: false,
  },
  {
    id: "cancel-subscription",
    category: "billing",
    keywords: ["cancelar", "cancel", "encerrar assinatura", "cancel subscription", "parar pagamento", "cancelar suscripción", "dar baixa", "quit", "encerrar"],
    q: {
      pt: "Quero cancelar minha assinatura",
      en: "I want to cancel my subscription",
      es: "Quiero cancelar mi suscripción",
    },
    a: {
      pt: "Entendo, e quero que isso seja tranquilo pra você. Antes de seguir: se for por créditos ou preço, talvez um plano menor resolva sem você perder seu Gui treinado. Vou registrar seu pedido e um humano da nossa equipe confirma o cancelamento e cuida do seu acesso e dados. Posso encaminhar agora.",
      en: "Understood, and I want this to be smooth for you. Before we proceed: if it's about credits or price, a smaller plan might solve it without losing your trained Gui. I'll log your request and a teammate will confirm the cancellation and handle your access and data. I can pass this along now.",
      es: "Entendido, y quiero que esto sea tranquilo para ti. Antes de seguir: si es por créditos o precio, quizá un plan menor lo resuelve sin perder tu Gui entrenado. Registro tu solicitud y una persona de nuestro equipo confirma la cancelación y gestiona tu acceso y datos. Puedo derivarlo ahora.",
    },
    action: { kind: "open_billing", label: { pt: "Falar sobre cancelamento", en: "Discuss cancellation", es: "Hablar de cancelación" } },
    escalate: true,
  },
  {
    id: "refund-request",
    category: "billing",
    keywords: ["reembolso", "refund", "estorno", "devolver dinheiro", "money back", "reembolso", "devolución", "cobrança indevida", "chargeback", "ressarcimento"],
    q: {
      pt: "Quero solicitar um reembolso",
      en: "I'd like to request a refund",
      es: "Quiero solicitar un reembolso",
    },
    a: {
      pt: "Sinto muito pelo transtorno — vou cuidar pra você ser bem atendido. Reembolsos passam por uma pessoa da nossa equipe pra revisar a cobrança e a política aplicável. Me diga o valor e o motivo que eu já registro e encaminho com prioridade; você recebe a confirmação por e-mail. Pode contar comigo no acompanhamento.",
      en: "I'm sorry for the trouble — I'll make sure you're well taken care of. Refunds go through a teammate to review the charge and the applicable policy. Tell me the amount and the reason and I'll log and escalate it with priority; you'll get confirmation by email. I'll stay on it with you.",
      es: "Lamento el inconveniente — me aseguraré de que te atiendan bien. Los reembolsos pasan por una persona del equipo para revisar el cargo y la política aplicable. Dime el monto y el motivo y lo registro y derivo con prioridad; recibirás confirmación por correo. Te acompaño en el seguimiento.",
    },
    action: { kind: "none", label: { pt: "Encaminhar pedido", en: "Submit request", es: "Enviar solicitud" } },
    escalate: true,
  },
  {
    id: "invoice-receipt",
    category: "billing",
    keywords: ["nota fiscal", "recibo", "invoice", "receipt", "fatura", "comprovante", "factura", "nf", "boleto", "histórico de pagamento"],
    q: {
      pt: "Preciso da minha nota fiscal / recibo / fatura",
      en: "I need my invoice / receipt",
      es: "Necesito mi factura / recibo",
    },
    a: {
      pt: "Já te entrego. Todas as suas faturas e recibos ficam em Cobrança → Histórico, prontos pra baixar em PDF a qualquer momento. Se precisar dos dados fiscais (CNPJ, razão social) numa fatura, é só preencher em Cobrança → Dados de Faturamento. Quer que eu abra o histórico pra você?",
      en: "I've got you. All your invoices and receipts live in Billing → History, ready to download as PDF anytime. If you need tax details (company name, tax ID) on an invoice, just fill them in Billing → Billing Details. Want me to open the history?",
      es: "Te lo entrego. Todas tus facturas y recibos están en Facturación → Historial, listos para descargar en PDF cuando quieras. Si necesitas datos fiscales (razón social, RFC/identificación) en una factura, complétalos en Facturación → Datos de Facturación. ¿Te abro el historial?",
    },
    action: { kind: "open_billing", label: { pt: "Abrir Histórico", en: "Open History", es: "Abrir Historial" } },
    escalate: false,
  },
  {
    id: "payment-failed",
    category: "billing",
    keywords: ["pagamento falhou", "payment failed", "cobrança recusada", "declined", "não pagou", "pago rechazado", "falha no pagamento", "erro pagamento", "recusado"],
    q: {
      pt: "Meu pagamento falhou / foi recusado",
      en: "My payment failed / was declined",
      es: "Mi pago falló / fue rechazado",
    },
    a: {
      pt: "Acontece e tem solução simples. Quase sempre é o cartão vencido, sem limite ou bloqueado pelo banco — em Cobrança → Forma de Pagamento você atualiza o cartão e eu tento a cobrança de novo na hora. Assim seu serviço não fica em risco. Posso abrir a forma de pagamento pra você.",
      en: "It happens and the fix is simple. It's almost always an expired card, insufficient limit, or a bank block — in Billing → Payment Method you update the card and I retry the charge instantly. That keeps your service safe. I can open the payment method for you.",
      es: "Pasa y tiene solución simple. Casi siempre es la tarjeta vencida, sin cupo o bloqueada por el banco — en Facturación → Método de Pago actualizas la tarjeta y reintento el cobro al instante. Así tu servicio no queda en riesgo. Puedo abrir el método de pago.",
    },
    action: { kind: "open_billing", label: { pt: "Atualizar pagamento", en: "Update payment", es: "Actualizar pago" } },
    escalate: false,
  },
  {
    id: "update-card",
    category: "billing",
    keywords: ["atualizar cartão", "update card", "trocar cartão", "novo cartão", "change card", "cambiar tarjeta", "nueva tarjeta", "cartão de crédito", "forma de pagamento"],
    q: {
      pt: "Como atualizo meu cartão de crédito?",
      en: "How do I update my credit card?",
      es: "¿Cómo actualizo mi tarjeta de crédito?",
    },
    a: {
      pt: "Rapidinho e seguro. Vá em Cobrança → Forma de Pagamento, adicione o novo cartão e defina como principal — o pagamento é processado de forma criptografada, eu nunca vejo os números completos. A próxima cobrança já usa o cartão novo. Quer que eu abra essa tela?",
      en: "Quick and secure. Go to Billing → Payment Method, add the new card and set it as primary — payment is processed encrypted, I never see the full numbers. Your next charge uses the new card. Want me to open that screen?",
      es: "Rápido y seguro. Ve a Facturación → Método de Pago, agrega la nueva tarjeta y márcala como principal — el pago se procesa cifrado, nunca veo los números completos. El próximo cobro ya usa la tarjeta nueva. ¿Te abro esa pantalla?",
    },
    action: { kind: "open_billing", label: { pt: "Abrir Pagamento", en: "Open Payment", es: "Abrir Pago" } },
    escalate: false,
  },

  // ─────────────────────────────  DATA / CRM  ─────────────────────────────
  {
    id: "where-are-my-customers",
    category: "data",
    keywords: ["clientes", "onde estão", "customers", "where", "contatos", "base", "clientes", "dónde están", "crm", "lista de clientes"],
    q: {
      pt: "Onde vejo meus clientes / contatos?",
      en: "Where do I see my customers / contacts?",
      es: "¿Dónde veo mis clientes / contactos?",
    },
    a: {
      pt: "Tudo num lugar só: o CRM. Lá ficam todos os clientes que falaram comigo, com histórico de conversas, agendamentos e gastos — eu cadastro cada novo contato automaticamente. Você pode buscar, filtrar e marcar com tags. Quer que eu abra o CRM pra você dar uma olhada?",
      en: "All in one place: the CRM. Every customer who's talked to me lives there, with conversation history, bookings and spend — I add each new contact automatically. You can search, filter and tag. Want me to open the CRM so you can take a look?",
      es: "Todo en un solo lugar: el CRM. Ahí están todos los clientes que hablaron conmigo, con historial de conversaciones, citas y gasto — registro cada contacto nuevo automáticamente. Puedes buscar, filtrar y etiquetar. ¿Te abro el CRM para echar un vistazo?",
    },
    action: { kind: "open_crm", label: { pt: "Abrir CRM", en: "Open CRM", es: "Abrir CRM" } },
    escalate: false,
  },
  {
    id: "export-data",
    category: "data",
    keywords: ["exportar", "export", "baixar dados", "csv", "planilha", "download", "exportar datos", "extraer", "backup", "excel"],
    q: {
      pt: "Como exporto meus dados / clientes?",
      en: "How do I export my data / customers?",
      es: "¿Cómo exporto mis datos / clientes?",
    },
    a: {
      pt: "Seus dados são seus, sempre. No CRM, use o botão Exportar pra baixar sua base completa em CSV (abre no Excel ou Google Sheets) — contatos, histórico e agendamentos. Dá pra exportar tudo ou só um filtro/segmento. Quer que eu abra o CRM pra iniciar a exportação?",
      en: "Your data is yours, always. In the CRM, use the Export button to download your full base as CSV (opens in Excel or Google Sheets) — contacts, history and bookings. You can export everything or just a filter/segment. Want me to open the CRM to start the export?",
      es: "Tus datos son tuyos, siempre. En el CRM, usa el botón Exportar para descargar tu base completa en CSV (se abre en Excel o Google Sheets) — contactos, historial y citas. Puedes exportar todo o solo un filtro/segmento. ¿Te abro el CRM para iniciar la exportación?",
    },
    action: { kind: "open_crm", label: { pt: "Abrir CRM", en: "Open CRM", es: "Abrir CRM" } },
    escalate: false,
  },
  {
    id: "customer-info-wrong",
    category: "data",
    keywords: ["dado errado", "wrong info", "corrigir cliente", "edit customer", "telefone errado", "nome errado", "dato incorrecto", "corregir", "editar contato", "atualizar cliente"],
    q: {
      pt: "A informação de um cliente está errada",
      en: "A customer's information is wrong",
      es: "La información de un cliente está incorrecta",
    },
    a: {
      pt: "Fácil de corrigir. Abra o cliente no CRM, clique em Editar e ajuste nome, telefone, e-mail ou notas — salva na hora e eu passo a usar o dado certo nas próximas conversas. Se foi eu que captei errado numa ligação, me avise o ponto pra eu melhorar. Quer abrir o CRM pra editar?",
      en: "Easy to fix. Open the customer in the CRM, click Edit and adjust name, phone, email or notes — it saves instantly and I'll use the correct data going forward. If I captured it wrong on a call, tell me the point so I can improve. Want to open the CRM to edit?",
      es: "Fácil de corregir. Abre el cliente en el CRM, haz clic en Editar y ajusta nombre, teléfono, correo o notas — se guarda al instante y usaré el dato correcto de ahí en adelante. Si lo capté mal en una llamada, dime el punto para mejorar. ¿Abrimos el CRM para editar?",
    },
    action: { kind: "open_crm", label: { pt: "Abrir CRM", en: "Open CRM", es: "Abrir CRM" } },
    escalate: false,
  },
  {
    id: "missing-call-logs",
    category: "data",
    keywords: ["ligações sumiram", "missing calls", "call logs", "registro de chamadas", "sem histórico", "llamadas faltan", "no aparecen", "transcrição", "histórico de ligações", "logs"],
    q: {
      pt: "Estão faltando registros de ligações / não aparecem",
      en: "Some call logs are missing / not showing",
      es: "Faltan registros de llamadas / no aparecen",
    },
    a: {
      pt: "Vamos conferir juntos. Os registros aparecem em Call Logs poucos minutos após a chamada — se algo não aparece, verifique o filtro de data no topo (às vezes está num período antigo) e atualize a página. Cada ligação traz transcrição e sentimento. Posso abrir os Call Logs pra revisarmos.",
      en: "Let's check together. Logs appear in Call Logs a few minutes after the call — if something's missing, check the date filter at the top (sometimes it's on an old range) and refresh. Each call carries a transcript and sentiment. I can open Call Logs so we review.",
      es: "Lo revisamos juntos. Los registros aparecen en Call Logs pocos minutos después de la llamada — si falta algo, revisa el filtro de fecha arriba (a veces quedó en un rango antiguo) y actualiza. Cada llamada trae transcripción y sentimiento. Puedo abrir Call Logs para revisar.",
    },
    action: { kind: "none", label: { pt: "Abrir Call Logs", en: "Open Call Logs", es: "Abrir Call Logs" } },
    escalate: false,
  },
  {
    id: "no-show-data",
    category: "data",
    keywords: ["no-show", "faltou", "não compareceu", "falta", "no asistió", "ausência", "cancelamento", "faltas", "comparecimento", "presença"],
    q: {
      pt: "Onde vejo os no-shows / quem não compareceu?",
      en: "Where do I see no-shows / who didn't show up?",
      es: "¿Dónde veo los no-shows / quién no asistió?",
    },
    a: {
      pt: "Eu acompanho isso pra você. No CRM e no Command Center cada cliente tem o histórico de comparecimento, e os no-shows ficam marcados — dá pra filtrar a lista só por quem faltou. Quer que eu já dispare lembretes automáticos pra reduzir faltas? Posso abrir o CRM pra você ver os no-shows.",
      en: "I track this for you. In the CRM and Command Center each customer has an attendance history, and no-shows are flagged — you can filter the list to just those who missed. Want me to fire automatic reminders to cut no-shows? I can open the CRM so you see them.",
      es: "Yo lo registro por ti. En el CRM y el Command Center cada cliente tiene su historial de asistencia, y los no-shows quedan marcados — puedes filtrar la lista solo por quien faltó. ¿Quieres que dispare recordatorios automáticos para reducir faltas? Puedo abrir el CRM para que los veas.",
    },
    action: { kind: "open_crm", label: { pt: "Ver no-shows", en: "View no-shows", es: "Ver no-shows" } },
    escalate: false,
  },

  // ─────────────────────────────  FINANCE  ─────────────────────────────
  {
    id: "send-invoice",
    category: "finance",
    keywords: ["enviar cobrança", "send invoice", "cobrar cliente", "emitir cobrança", "fatura cliente", "enviar factura", "cobro", "cobrança", "boleto cliente", "charge customer"],
    q: {
      pt: "Como envio uma cobrança para um cliente?",
      en: "How do I send an invoice to a customer?",
      es: "¿Cómo envío un cobro a un cliente?",
    },
    a: {
      pt: "Em segundos. Vá em Finanças → Nova Cobrança, escolha o cliente, lance o valor e a descrição e envie — ele recebe um link de pagamento por WhatsApp ou SMS na hora. Quando ele paga, a cobrança vira 'paga' sozinha e eu te aviso. Quer que eu abra Finanças pra criar uma?",
      en: "In seconds. Go to Finance → New Invoice, pick the customer, enter the amount and description and send — they get a payment link by WhatsApp or SMS instantly. When they pay, it flips to 'paid' on its own and I notify you. Want me to open Finance to create one?",
      es: "En segundos. Ve a Finanzas → Nuevo Cobro, elige el cliente, ingresa el monto y la descripción y envía — recibe un enlace de pago por WhatsApp o SMS al instante. Cuando paga, el cobro pasa a 'pagado' solo y te aviso. ¿Te abro Finanzas para crear uno?",
    },
    action: { kind: "open_finance", label: { pt: "Abrir Finanças", en: "Open Finance", es: "Abrir Finanzas" } },
    escalate: false,
  },
  {
    id: "mark-paid",
    category: "finance",
    keywords: ["marcar pago", "mark paid", "dar baixa", "recebido", "quitar", "marcar pagado", "pago manual", "baixar cobrança", "settle", "conciliar"],
    q: {
      pt: "Como marco uma cobrança como paga?",
      en: "How do I mark an invoice as paid?",
      es: "¿Cómo marco un cobro como pagado?",
    },
    a: {
      pt: "Pagamentos pelo link já entram como pagos automaticamente. Se o cliente pagou por fora (dinheiro, Pix, maquininha), abra a cobrança em Finanças e clique em 'Marcar como paga' — ela some dos pendentes e entra no seu faturamento. Quer que eu abra Finanças pra dar baixa?",
      en: "Payments through the link mark themselves as paid automatically. If the customer paid another way (cash, transfer, card terminal), open the invoice in Finance and click 'Mark as paid' — it leaves your pending list and counts in your revenue. Want me to open Finance to settle it?",
      es: "Los pagos por el enlace se marcan como pagados automáticamente. Si el cliente pagó por fuera (efectivo, transferencia, terminal), abre el cobro en Finanzas y haz clic en 'Marcar como pagado' — sale de tus pendientes y cuenta en tu facturación. ¿Te abro Finanzas para conciliarlo?",
    },
    action: { kind: "open_finance", label: { pt: "Abrir Finanças", en: "Open Finance", es: "Abrir Finanzas" } },
    escalate: false,
  },
  {
    id: "payment-link",
    category: "finance",
    keywords: ["link de pagamento", "payment link", "link de pago", "gerar link", "cobrar pelo link", "pix", "deposit", "sinal", "depósito", "link cobrança"],
    q: {
      pt: "Como gero um link de pagamento?",
      en: "How do I generate a payment link?",
      es: "¿Cómo genero un enlace de pago?",
    },
    a: {
      pt: "Eu faço isso até durante a ligação. Em Finanças você cria um link de pagamento com o valor que quiser e envia por WhatsApp/SMS — também uso isso pra cobrar um sinal e garantir a reserva na hora de agendar. O cliente paga em poucos toques. Quer que eu abra Finanças pra gerar um?",
      en: "I even do this mid-call. In Finance you create a payment link for any amount and send it by WhatsApp/SMS — I also use it to take a deposit and lock the booking right when scheduling. The customer pays in a few taps. Want me to open Finance to generate one?",
      es: "Lo hago incluso durante la llamada. En Finanzas creas un enlace de pago por el monto que quieras y lo envías por WhatsApp/SMS — también lo uso para cobrar un anticipo y asegurar la reserva al agendar. El cliente paga en pocos toques. ¿Te abro Finanzas para generar uno?",
    },
    action: { kind: "open_finance", label: { pt: "Abrir Finanças", en: "Open Finance", es: "Abrir Finanzas" } },
    escalate: false,
  },
  {
    id: "overdue-collection",
    category: "finance",
    keywords: ["inadimplência", "overdue", "atrasado", "cobrar atrasado", "vencido", "morosos", "cobranza", "vencida", "devedor", "lembrete de cobrança"],
    q: {
      pt: "Como cobro clientes em atraso / inadimplentes?",
      en: "How do I collect from overdue customers?",
      es: "¿Cómo cobro a clientes morosos / vencidos?",
    },
    a: {
      pt: "Deixa essa parte chata comigo. Em Finanças você vê todas as cobranças vencidas e pode ativar lembretes automáticos — eu mando mensagens educadas com o link de pagamento até o cliente quitar, no ritmo que você definir. Sem você precisar correr atrás. Quer que eu abra Finanças e ligue a cobrança automática?",
      en: "Leave the awkward part to me. In Finance you see every overdue invoice and can switch on automatic reminders — I send polite messages with the payment link until they settle, at the cadence you set. No chasing on your end. Want me to open Finance and turn on auto-collection?",
      es: "Déjame la parte incómoda. En Finanzas ves todos los cobros vencidos y puedes activar recordatorios automáticos — envío mensajes amables con el enlace de pago hasta que paguen, al ritmo que definas. Sin que tengas que perseguir a nadie. ¿Te abro Finanzas y activo la cobranza automática?",
    },
    action: { kind: "open_finance", label: { pt: "Abrir Finanças", en: "Open Finance", es: "Abrir Finanzas" } },
    escalate: false,
  },

  // ─────────────────────────────  MARKETING  ─────────────────────────────
  {
    id: "launch-campaign",
    category: "marketing",
    keywords: ["campanha", "campaign", "disparo", "promoção", "enviar mensagem em massa", "campaña", "promoción", "broadcast", "marketing", "blast"],
    q: {
      pt: "Como lanço uma campanha / promoção?",
      en: "How do I launch a campaign / promotion?",
      es: "¿Cómo lanzo una campaña / promoción?",
    },
    a: {
      pt: "Adoro trazer gente de volta. Em Marketing → Nova Campanha você escreve a mensagem (ou eu sugiro uma), escolhe o público e dispara por WhatsApp/SMS — e ainda respondo quem reagir, fechando agendamentos. Comece com um público pequeno pra testar. Quer que eu abra Marketing pra criarmos uma?",
      en: "I love bringing people back. In Marketing → New Campaign you write the message (or I suggest one), pick the audience and send by WhatsApp/SMS — and I'll even reply to whoever responds, closing bookings. Start with a small audience to test. Want me to open Marketing to build one?",
      es: "Me encanta traer gente de vuelta. En Marketing → Nueva Campaña escribes el mensaje (o te sugiero uno), eliges la audiencia y envías por WhatsApp/SMS — y hasta respondo a quien reaccione, cerrando citas. Empieza con una audiencia pequeña para probar. ¿Te abro Marketing para crear una?",
    },
    action: { kind: "open_marketing", label: { pt: "Abrir Marketing", en: "Open Marketing", es: "Abrir Marketing" } },
    escalate: false,
  },
  {
    id: "segment-audience",
    category: "marketing",
    keywords: ["segmentar", "segment", "público", "audience", "filtrar clientes", "grupo", "segmentar", "audiencia", "tags", "lista alvo"],
    q: {
      pt: "Como segmento o público de uma campanha?",
      en: "How do I segment the audience for a campaign?",
      es: "¿Cómo segmento la audiencia de una campaña?",
    },
    a: {
      pt: "Aqui mora o resultado. No CRM e em Marketing você filtra por tags, último atendimento, quanto gastou ou quem sumiu — por exemplo, 'clientes que não voltam há 60 dias'. Aí a mensagem certa vai pra pessoa certa e a conversão sobe. Quer que eu abra o CRM pra montarmos um segmento?",
      en: "This is where the results live. In the CRM and Marketing you filter by tags, last visit, how much they spent, or who's gone quiet — for example, 'customers who haven't returned in 60 days'. Then the right message reaches the right person and conversion climbs. Want me to open the CRM to build a segment?",
      es: "Aquí está el resultado. En el CRM y en Marketing filtras por etiquetas, última visita, cuánto gastaron o quién desapareció — por ejemplo, 'clientes que no vuelven hace 60 días'. Así el mensaje correcto llega a la persona correcta y sube la conversión. ¿Te abro el CRM para armar un segmento?",
    },
    action: { kind: "open_marketing", label: { pt: "Abrir Marketing", en: "Open Marketing", es: "Abrir Marketing" } },
    escalate: false,
  },
  {
    id: "reviews",
    category: "marketing",
    keywords: ["avaliações", "reviews", "google reviews", "reputação", "estrelas", "reseñas", "opiniones", "pedir avaliação", "nota", "feedback cliente"],
    q: {
      pt: "Como peço avaliações / reviews aos meus clientes?",
      en: "How do I ask my customers for reviews?",
      es: "¿Cómo pido reseñas a mis clientes?",
    },
    a: {
      pt: "Sua reputação cresce no automático. Em Marketing você ativa o pedido de avaliação — depois de um atendimento bom eu mando o link do Google na hora certa, com uma mensagem simpática. Mais estrelas, mais clientes novos. Quer que eu abra Marketing pra ligar os pedidos de review?",
      en: "Your reputation grows on autopilot. In Marketing you switch on review requests — after a good visit I send the Google link at the right moment with a friendly note. More stars, more new customers. Want me to open Marketing to turn on review requests?",
      es: "Tu reputación crece en automático. En Marketing activas la solicitud de reseñas — después de una buena atención envío el enlace de Google en el momento justo con un mensaje amable. Más estrellas, más clientes nuevos. ¿Te abro Marketing para activar las solicitudes de reseña?",
    },
    action: { kind: "open_marketing", label: { pt: "Abrir Marketing", en: "Open Marketing", es: "Abrir Marketing" } },
    escalate: false,
  },
  {
    id: "reactivate-lost-customers",
    category: "marketing",
    keywords: ["reativar", "reactivate", "clientes sumidos", "trazer de volta", "win back", "reactivar", "recuperar clientes", "inativos", "reengajar", "voltar"],
    q: {
      pt: "Como reativo clientes que sumiram?",
      en: "How do I reactivate customers who disappeared?",
      es: "¿Cómo reactivo clientes que desaparecieron?",
    },
    a: {
      pt: "Essa é uma das minhas superpotências. Em Marketing → Reativação eu monto uma lista de quem não volta há um tempo e disparo uma mensagem calorosa com um incentivo — e respondo quem voltar pra já agendar. É faturamento parado virando agenda cheia. Quer que eu abra a Reativação?",
      en: "This is one of my superpowers. In Marketing → Reactivation I build a list of who hasn't returned in a while and send a warm message with an incentive — and I reply to whoever comes back to book on the spot. It's idle revenue turning into a full calendar. Want me to open Reactivation?",
      es: "Esta es una de mis superpotencias. En Marketing → Reactivación armo una lista de quién no vuelve hace tiempo y envío un mensaje cálido con un incentivo — y respondo a quien regrese para agendar al instante. Es ingreso dormido convirtiéndose en agenda llena. ¿Te abro Reactivación?",
    },
    action: { kind: "open_marketing", label: { pt: "Abrir Reativação", en: "Open Reactivation", es: "Abrir Reactivación" } },
    escalate: false,
  },

  // ─────────────────────────────  TECHNICAL  ─────────────────────────────
  {
    id: "dashboard-not-loading",
    category: "technical",
    keywords: ["não carrega", "not loading", "tela branca", "dashboard", "painel", "travou", "no carga", "pantalla en blanco", "erro de carregamento", "não abre"],
    q: {
      pt: "Meu painel / dashboard não carrega",
      en: "My dashboard won't load",
      es: "Mi panel / dashboard no carga",
    },
    a: {
      pt: "Vamos resolver em segundos. Tente o trio que conserta 9 em 10 casos: atualize a página (Ctrl/Cmd+Shift+R), teste em aba anônima e confira sua conexão. Se persistir, troque de navegador ou rede uma vez. Continua travando? Me diga o que aparece na tela que eu chamo nosso time técnico.",
      en: "Let's fix this in seconds. Try the trio that solves 9 in 10 cases: hard refresh (Ctrl/Cmd+Shift+R), test in an incognito tab, and check your connection. If it persists, switch browser or network once. Still stuck? Tell me what's on the screen and I'll bring in our tech team.",
      es: "Lo resolvemos en segundos. Prueba el trío que arregla 9 de 10 casos: recarga forzada (Ctrl/Cmd+Shift+R), prueba en pestaña de incógnito y revisa tu conexión. Si sigue, cambia de navegador o red una vez. ¿Aún atascado? Dime qué aparece en pantalla y llamo a nuestro equipo técnico.",
    },
    action: { kind: "none", label: { pt: "Recarregar painel", en: "Reload dashboard", es: "Recargar panel" } },
    escalate: false,
  },
  {
    id: "numbers-look-wrong",
    category: "technical",
    keywords: ["números errados", "numbers wrong", "métricas", "dados estranhos", "valores errados", "números mal", "datos extraños", "relatório errado", "estatísticas", "dashboard incorreto"],
    q: {
      pt: "Os números do meu painel parecem errados",
      en: "The numbers on my dashboard look wrong",
      es: "Los números de mi panel parecen incorrectos",
    },
    a: {
      pt: "Vamos conferir com calma. Na maioria das vezes é o período selecionado — verifique o filtro de data no topo (hoje, semana, mês) e o fuso horário em Configurações. Cobranças pagas por fora também precisam ser marcadas pra entrar no total. Se ainda parecer estranho, me diga qual número e eu investigo a fundo com nosso time.",
      en: "Let's check calmly. Most of the time it's the selected period — verify the date filter at the top (today, week, month) and the time zone in Settings. Invoices paid outside the link also need to be marked to count in the total. If it still looks off, tell me which number and I'll dig in with our team.",
      es: "Revisémoslo con calma. La mayoría de las veces es el período seleccionado — verifica el filtro de fecha arriba (hoy, semana, mes) y la zona horaria en Configuración. Los cobros pagados por fuera también deben marcarse para contar en el total. Si sigue raro, dime qué número y lo investigo a fondo con nuestro equipo.",
    },
    action: { kind: "none", label: { pt: "Revisar filtros", en: "Review filters", es: "Revisar filtros" } },
    escalate: false,
  },
  {
    id: "app-slow",
    category: "technical",
    keywords: ["lento", "slow", "travando", "demora", "lag", "lento", "lentitud", "pesado", "performance", "demorando"],
    q: {
      pt: "O app está lento / travando",
      en: "The app is slow / laggy",
      es: "La app está lenta / se traba",
    },
    a: {
      pt: "Vamos deixar leve de novo. Feche abas pesadas, limpe o cache do navegador e atualize a página — e, se estiver no celular numa rede fraca, tente o Wi-Fi. Costuma resolver na hora. Se continuar pesado num horário específico, me avise que eu reporto ao nosso time de infraestrutura.",
      en: "Let's make it light again. Close heavy tabs, clear the browser cache and refresh — and if you're on mobile on a weak network, try Wi-Fi. That usually fixes it immediately. If it stays heavy at a specific time, tell me and I'll report it to our infrastructure team.",
      es: "Lo dejamos ligero otra vez. Cierra pestañas pesadas, limpia la caché del navegador y actualiza — y si estás en el móvil con red débil, prueba el Wi-Fi. Suele resolverse al instante. Si sigue pesado a una hora específica, avísame y lo reporto a nuestro equipo de infraestructura.",
    },
    action: { kind: "none", label: { pt: "Recarregar app", en: "Reload app", es: "Recargar app" } },
    escalate: false,
  },
  {
    id: "language-stuck",
    category: "technical",
    keywords: ["idioma travado", "language stuck", "trocar idioma do painel", "interface em inglês", "mudar idioma", "idioma fijo", "cambiar idioma", "tradução", "português", "español"],
    q: {
      pt: "O idioma do painel está travado / quero trocar",
      en: "The dashboard language is stuck / I want to change it",
      es: "El idioma del panel está fijo / quiero cambiarlo",
    },
    a: {
      pt: "Fácil de ajustar. Vá em Configurações → Idioma e escolha português, inglês ou espanhol — o painel inteiro muda na hora. Esse ajuste é só da sua interface; o idioma com que eu falo com seus clientes é configurado separado, na Personalidade do Agente. Quer que eu abra as configurações de idioma?",
      en: "Easy to adjust. Go to Settings → Language and pick Portuguese, English or Spanish — the whole dashboard switches instantly. This is just your interface; the language I speak to your customers in is set separately, in Agent Personality. Want me to open the language settings?",
      es: "Fácil de ajustar. Ve a Configuración → Idioma y elige portugués, inglés o español — todo el panel cambia al instante. Esto es solo tu interfaz; el idioma con que hablo a tus clientes se configura aparte, en Personalidad del Agente. ¿Te abro la configuración de idioma?",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Idioma", en: "Open Language", es: "Abrir Idioma" } },
    escalate: false,
  },
  {
    id: "mobile-issue",
    category: "technical",
    keywords: ["celular", "mobile", "no telefone", "app mobile", "tela cortada", "móvil", "en el celular", "responsivo", "botão sumido", "smartphone"],
    q: {
      pt: "Algo não funciona no celular",
      en: "Something isn't working on mobile",
      es: "Algo no funciona en el celular",
    },
    a: {
      pt: "Vamos ajeitar. No celular, use o navegador atualizado (Chrome ou Safari) e, se um botão ou tela parecer cortado, gire pra horizontal ou recarregue a página uma vez. Pra acesso rápido, dá pra 'Adicionar à tela inicial' e usar como app. Me diga exatamente o que não funciona que eu te guio passo a passo.",
      en: "Let's sort it. On mobile, use an updated browser (Chrome or Safari) and, if a button or screen looks cut off, rotate to landscape or reload the page once. For quick access, you can 'Add to Home Screen' and use it like an app. Tell me exactly what's not working and I'll walk you through it.",
      es: "Lo arreglamos. En el celular, usa un navegador actualizado (Chrome o Safari) y, si un botón o pantalla se ve cortado, gira a horizontal o recarga la página una vez. Para acceso rápido, puedes 'Agregar a la pantalla de inicio' y usarlo como app. Dime exactamente qué no funciona y te guío paso a paso.",
    },
    action: { kind: "none", label: { pt: "Recarregar", en: "Reload", es: "Recargar" } },
    escalate: false,
  },

  // ─────────────────────────────  ACCOUNT  ─────────────────────────────
  {
    id: "change-email-password",
    category: "account",
    keywords: ["mudar email", "change email", "trocar senha", "password", "senha", "esqueci senha", "cambiar correo", "contraseña", "recuperar senha", "redefinir"],
    q: {
      pt: "Como mudo meu e-mail ou senha?",
      en: "How do I change my email or password?",
      es: "¿Cómo cambio mi correo o contraseña?",
    },
    a: {
      pt: "Rapidinho e seguro. Vá em Configurações → Conta pra atualizar seu e-mail ou senha; por segurança você confirma a alteração por um link enviado ao seu e-mail. Esqueceu a senha? Use 'Esqueci minha senha' na tela de login e redefina em um minuto. Quer que eu abra as configurações da conta?",
      en: "Quick and secure. Go to Settings → Account to update your email or password; for security you confirm the change via a link sent to your email. Forgot your password? Use 'Forgot password' on the login screen and reset it in a minute. Want me to open account settings?",
      es: "Rápido y seguro. Ve a Configuración → Cuenta para actualizar tu correo o contraseña; por seguridad confirmas el cambio con un enlace enviado a tu correo. ¿Olvidaste la contraseña? Usa 'Olvidé mi contraseña' en la pantalla de inicio y restablécela en un minuto. ¿Te abro la configuración de la cuenta?",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Conta", en: "Open Account", es: "Abrir Cuenta" } },
    escalate: false,
  },
  {
    id: "add-team-member",
    category: "account",
    keywords: ["adicionar usuário", "add team", "convidar", "equipe", "team member", "agregar usuario", "invitar", "colaborador", "novo usuário", "acesso equipe"],
    q: {
      pt: "Como adiciono um membro da equipe?",
      en: "How do I add a team member?",
      es: "¿Cómo agrego un miembro del equipo?",
    },
    a: {
      pt: "Traz a equipe junto. Em Configurações → Equipe, clique em Convidar, digite o e-mail da pessoa e escolha o nível de acesso — ela recebe um convite e cria a própria senha. Você pode remover ou trocar permissões quando quiser. Quer que eu abra a tela de Equipe?",
      en: "Bring the team in. In Settings → Team, click Invite, enter the person's email and choose their access level — they get an invite and set their own password. You can remove or change permissions anytime. Want me to open the Team screen?",
      es: "Suma a tu equipo. En Configuración → Equipo, haz clic en Invitar, ingresa el correo de la persona y elige su nivel de acceso — recibe una invitación y crea su propia contraseña. Puedes quitar o cambiar permisos cuando quieras. ¿Te abro la pantalla de Equipo?",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Equipe", en: "Open Team", es: "Abrir Equipo" } },
    escalate: false,
  },
  {
    id: "permissions",
    category: "account",
    keywords: ["permissões", "permissions", "acesso", "nível de acesso", "roles", "permisos", "acceso", "limitar acesso", "admin", "função usuário"],
    q: {
      pt: "Como gerencio permissões / acessos da equipe?",
      en: "How do I manage team permissions / access?",
      es: "¿Cómo gestiono los permisos / accesos del equipo?",
    },
    a: {
      pt: "Você manda no que cada um vê. Em Configurações → Equipe, abra um membro e ajuste o papel — por exemplo, quem pode mexer em Cobrança, quem só vê os Call Logs ou o CRM. Assim você protege o financeiro e dá autonomia ao operacional. Quer que eu abra a Equipe pra ajustarmos?",
      en: "You control what each person sees. In Settings → Team, open a member and adjust their role — for example, who can touch Billing, who only sees Call Logs or the CRM. That protects your finances while giving the floor team autonomy. Want me to open Team to adjust it?",
      es: "Tú controlas lo que ve cada persona. En Configuración → Equipo, abre un miembro y ajusta su rol — por ejemplo, quién puede tocar Facturación, quién solo ve los Call Logs o el CRM. Así proteges lo financiero y das autonomía a lo operativo. ¿Te abro Equipo para ajustarlo?",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Equipe", en: "Open Team", es: "Abrir Equipo" } },
    escalate: false,
  },
  {
    id: "delete-account",
    category: "account",
    keywords: ["excluir conta", "delete account", "apagar conta", "encerrar conta", "remover conta", "eliminar cuenta", "borrar cuenta", "deletar", "fechar conta", "cancelar tudo"],
    q: {
      pt: "Quero excluir minha conta",
      en: "I want to delete my account",
      es: "Quiero eliminar mi cuenta",
    },
    a: {
      pt: "Entendo, e quero garantir que seja feito com todo o cuidado. Excluir a conta é permanente e apaga seu Gui treinado, seus clientes e seu histórico — por isso uma pessoa da nossa equipe confirma com você e oferece exportar seus dados antes. Vou registrar seu pedido agora e te acompanhar até o fim.",
      en: "Understood, and I want to make sure it's done with full care. Deleting the account is permanent and erases your trained Gui, your customers and your history — so a teammate will confirm with you and offer to export your data first. I'll log your request now and stay with you through it.",
      es: "Entendido, y quiero asegurarme de que se haga con todo el cuidado. Eliminar la cuenta es permanente y borra tu Gui entrenado, tus clientes y tu historial — por eso una persona del equipo lo confirma contigo y te ofrece exportar tus datos antes. Registro tu solicitud ahora y te acompaño hasta el final.",
    },
    action: { kind: "none", label: { pt: "Encaminhar pedido", en: "Submit request", es: "Enviar solicitud" } },
    escalate: true,
  },
  {
    id: "data-privacy-lgpd",
    category: "account",
    keywords: ["lgpd", "privacidade", "privacy", "gdpr", "meus dados", "proteção de dados", "privacidad", "datos personales", "direito de acesso", "remover dados"],
    q: {
      pt: "Tenho uma solicitação de privacidade / LGPD sobre meus dados",
      en: "I have a privacy / data protection (LGPD) request",
      es: "Tengo una solicitud de privacidad / protección de datos",
    },
    a: {
      pt: "Levamos seus dados muito a sério. Você tem direito a acessar, corrigir, exportar ou pedir a exclusão dos dados pessoais que tratamos — uma pessoa do nosso time de privacidade cuida disso pessoalmente, dentro dos prazos da LGPD. Me diga o que precisa que eu registro e encaminho com prioridade; você recebe confirmação por e-mail.",
      en: "We take your data very seriously. You have the right to access, correct, export or request deletion of the personal data we process — someone on our privacy team handles this personally, within the law's deadlines. Tell me what you need and I'll log and escalate it with priority; you'll get confirmation by email.",
      es: "Tomamos tus datos muy en serio. Tienes derecho a acceder, corregir, exportar o solicitar la eliminación de los datos personales que tratamos — una persona de nuestro equipo de privacidad lo gestiona personalmente, dentro de los plazos legales. Dime qué necesitas y lo registro y derivo con prioridad; recibirás confirmación por correo.",
    },
    action: { kind: "none", label: { pt: "Encaminhar pedido", en: "Submit request", es: "Enviar solicitud" } },
    escalate: true,
  },

  // ─────────────────────────────  FEATURE  ─────────────────────────────
  {
    id: "request-feature",
    category: "feature",
    keywords: ["sugestão", "feature", "ideia", "pedir recurso", "request", "sugerir", "sugerencia", "idea", "funcionalidade", "melhoria"],
    q: {
      pt: "Quero sugerir um recurso novo",
      en: "I'd like to request a new feature",
      es: "Quiero sugerir una nueva función",
    },
    a: {
      pt: "Amo essas ideias — várias das minhas melhores funções nasceram de clientes como você. Me conta em detalhes o que você gostaria de fazer e por quê, que eu registro direto pro nosso time de produto. Não prometo prazo, mas leio tudo e priorizamos o que mais ajuda os negócios. Pode mandar!",
      en: "I love these ideas — many of my best features were born from clients like you. Tell me in detail what you'd like to do and why, and I'll log it straight to our product team. I can't promise a date, but we read everything and prioritize what helps businesses most. Fire away!",
      es: "Amo estas ideas — varias de mis mejores funciones nacieron de clientes como tú. Cuéntame en detalle qué te gustaría hacer y por qué, y lo registro directo a nuestro equipo de producto. No prometo fecha, pero leemos todo y priorizamos lo que más ayuda a los negocios. ¡Cuéntame!",
    },
    action: { kind: "none", label: { pt: "Enviar ideia", en: "Send idea", es: "Enviar idea" } },
    escalate: false,
  },
  {
    id: "integration-request",
    category: "feature",
    keywords: ["integração", "integration", "conectar sistema", "api", "zapier", "google calendar", "integración", "conectar", "pdv", "erp"],
    q: {
      pt: "Quero integrar o Gui com outro sistema",
      en: "I want to integrate Gui with another system",
      es: "Quiero integrar a Gui con otro sistema",
    },
    a: {
      pt: "Adoro conectar tudo. Já temos integrações nativas (como agenda e pagamentos) e o time avalia novas conexões — agenda, PDV, ERP, plataformas de delivery. Me diga qual sistema e o que você quer sincronizar, que eu registro e encaminho pro nosso time técnico avaliar a viabilidade. Você recebe um retorno por e-mail.",
      en: "I love connecting everything. We already have native integrations (like calendar and payments) and the team evaluates new ones — calendar, POS, ERP, delivery platforms. Tell me which system and what you want to sync, and I'll log and pass it to our tech team to assess feasibility. You'll hear back by email.",
      es: "Me encanta conectar todo. Ya tenemos integraciones nativas (como agenda y pagos) y el equipo evalúa nuevas — agenda, punto de venta, ERP, plataformas de delivery. Dime qué sistema y qué quieres sincronizar, y lo registro y derivo a nuestro equipo técnico para evaluar la viabilidad. Recibirás respuesta por correo.",
    },
    action: { kind: "none", label: { pt: "Solicitar integração", en: "Request integration", es: "Solicitar integración" } },
    escalate: true,
  },

  // ─────────────────────────  HOW-DO-I (per department)  ─────────────────────────
  {
    id: "how-command-center",
    category: "feature",
    keywords: ["command center", "central de comando", "visão geral", "overview", "painel principal", "centro de mando", "home", "resumo", "tela inicial", "dashboard principal"],
    q: {
      pt: "Para que serve o Command Center?",
      en: "What is the Command Center for?",
      es: "¿Para qué sirve el Command Center?",
    },
    a: {
      pt: "É a sua cabine de comando — onde você vê tudo de relance. Lá ficam o status do Gui (ativo/pausado), as conversas de hoje, os agendamentos, o saldo de créditos e os alertas importantes. É o melhor lugar pra começar o dia. Quer que eu abra o Command Center pra você?",
      en: `It's your ${NOME_DO_PAINEL} — where you see everything at a glance. It shows Gui's status (active/paused), today's conversations, bookings, credit balance and the alerts that matter. It's the best place to start your day. Want me to open the Command Center?`,
      es: "Es tu cabina de mando — donde ves todo de un vistazo. Muestra el estado de Gui (activo/pausado), las conversaciones de hoy, las citas, el saldo de créditos y las alertas importantes. Es el mejor lugar para empezar el día. ¿Te abro el Command Center?",
    },
    action: { kind: "none", label: { pt: "Abrir Command Center", en: "Open Command Center", es: "Abrir Command Center" } },
    escalate: false,
  },
  {
    id: "how-growth",
    category: "feature",
    keywords: ["growth", "crescimento", "insights", "oportunidades", "recomendações", "crecimiento", "sugestões de venda", "upsell", "previsões", "analytics"],
    q: {
      pt: "O que é o departamento de Growth?",
      en: "What is the Growth department?",
      es: "¿Qué es el departamento de Growth?",
    },
    a: {
      pt: "É o seu radar de oportunidades. Em Growth eu cruzo seus dados e mostro onde dá pra ganhar mais — clientes prestes a sumir, horários ociosos, quem está pronto pra um upsell e previsões de no-show. São recomendações práticas, prontas pra virar campanha. Quer que eu abra o Growth pra ver as oportunidades?",
      en: "It's your opportunity radar. In Growth I cross your data and show where there's more to earn — customers about to lapse, idle time slots, who's ready for an upsell, and no-show predictions. Practical recommendations, ready to turn into a campaign. Want me to open Growth to see the opportunities?",
      es: "Es tu radar de oportunidades. En Growth cruzo tus datos y muestro dónde ganar más — clientes a punto de irse, horarios ociosos, quién está listo para un upsell y predicciones de no-show. Recomendaciones prácticas, listas para volverse campaña. ¿Te abro Growth para ver las oportunidades?",
    },
    action: { kind: "none", label: { pt: "Abrir Growth", en: "Open Growth", es: "Abrir Growth" } },
    escalate: false,
  },
  {
    id: "how-documents",
    category: "feature",
    keywords: ["documentos", "documents", "arquivos", "contratos", "uploads", "documentos", "archivos", "armazenar arquivos", "pdf", "anexos"],
    q: {
      pt: "Para que serve a área de Documentos?",
      en: "What is the Documents area for?",
      es: "¿Para qué sirve el área de Documentos?",
    },
    a: {
      pt: "É o cofre de arquivos do seu negócio. Em Documentos você guarda cardápios, tabelas de preço, contratos e materiais — e muitos deles eu uso pra me treinar e responder com precisão. Tudo organizado e fácil de achar. Quer que eu abra os Documentos pra você?",
      en: "It's your business's file vault. In Documents you store menus, price lists, contracts and materials — and many of them I use to train myself and answer accurately. All organized and easy to find. Want me to open Documents for you?",
      es: "Es la bóveda de archivos de tu negocio. En Documentos guardas menús, listas de precios, contratos y materiales — y muchos los uso para entrenarme y responder con precisión. Todo organizado y fácil de encontrar. ¿Te abro Documentos?",
    },
    action: { kind: "none", label: { pt: "Abrir Documentos", en: "Open Documents", es: "Abrir Documentos" } },
    escalate: false,
  },
  {
    id: "how-inbox",
    category: "feature",
    keywords: ["inbox", "caixa de entrada", "mensagens", "conversas", "messages", "bandeja", "buzón", "responder cliente", "assumir conversa", "intervir"],
    q: {
      pt: "Como uso a Inbox / caixa de mensagens?",
      en: "How do I use the Inbox / messages?",
      es: "¿Cómo uso la Inbox / bandeja de mensajes?",
    },
    a: {
      pt: "É onde toda conversa vive. Na Inbox você lê tudo o que eu troco com seus clientes em WhatsApp e SMS em tempo real — e pode assumir uma conversa a qualquer momento pra responder pessoalmente; eu retomo quando você quiser. Nada se perde. Quer que eu abra a Inbox?",
      en: "It's where every conversation lives. In the Inbox you read everything I exchange with your customers on WhatsApp and SMS in real time — and you can take over a conversation anytime to reply personally; I pick it back up whenever you want. Nothing is lost. Want me to open the Inbox?",
      es: "Es donde vive cada conversación. En la Inbox lees todo lo que intercambio con tus clientes en WhatsApp y SMS en tiempo real — y puedes tomar una conversación cuando quieras para responder en persona; la retomo cuando lo desees. Nada se pierde. ¿Te abro la Inbox?",
    },
    action: { kind: "none", label: { pt: "Abrir Inbox", en: "Open Inbox", es: "Abrir Inbox" } },
    escalate: false,
  },
  {
    id: "how-call-logs",
    category: "feature",
    keywords: ["call logs", "registro de chamadas", "transcrição", "gravação", "sentimento", "registro de llamadas", "transcripción", "histórico ligações", "escutar ligação", "resumo da chamada"],
    q: {
      pt: "O que encontro em Call Logs?",
      en: "What do I find in Call Logs?",
      es: "¿Qué encuentro en Call Logs?",
    },
    a: {
      pt: "Cada ligação que eu atendo, contada em detalhes. Em Call Logs você vê a transcrição completa, o resumo, o sentimento do cliente e o resultado (agendou, comprou, pediu retorno). É ouro pra entender o que seus clientes querem. Quer que eu abra os Call Logs pra você?",
      en: "Every call I answer, told in detail. In Call Logs you see the full transcript, the summary, the customer's sentiment and the outcome (booked, bought, asked for a callback). It's gold for understanding what your customers want. Want me to open Call Logs?",
      es: "Cada llamada que contesto, contada en detalle. En Call Logs ves la transcripción completa, el resumen, el sentimiento del cliente y el resultado (agendó, compró, pidió que le devolvieran la llamada). Es oro para entender qué quieren tus clientes. ¿Te abro Call Logs?",
    },
    action: { kind: "none", label: { pt: "Abrir Call Logs", en: "Open Call Logs", es: "Abrir Call Logs" } },
    escalate: false,
  },
  {
    id: "how-settings",
    category: "feature",
    keywords: ["configurações", "settings", "ajustes", "preferências", "opções", "configuración", "ajustes", "onde configuro", "painel de ajustes", "preferencias"],
    q: {
      pt: "Onde ficam as Configurações e o que posso ajustar?",
      en: "Where are Settings and what can I adjust?",
      es: "¿Dónde está Configuración y qué puedo ajustar?",
    },
    a: {
      pt: "É o seu painel de controle. Em Configurações você ajusta tudo: dados do negócio, horários, canais (WhatsApp/telefone), personalidade do Gui (nome, voz, idioma), agenda, equipe e conta. Mudou algo, salvou, valeu na hora. Quer que eu abra as Configurações pra você?",
      en: "It's your control panel. In Settings you adjust everything: business details, hours, channels (WhatsApp/phone), Gui's personality (name, voice, language), scheduling, team and account. Change something, save it, it applies instantly. Want me to open Settings for you?",
      es: "Es tu panel de control. En Configuración ajustas todo: datos del negocio, horarios, canales (WhatsApp/teléfono), personalidad de Gui (nombre, voz, idioma), agenda, equipo y cuenta. Cambias algo, guardas, aplica al instante. ¿Te abro Configuración?",
    },
    action: { kind: "open_settings", label: { pt: "Abrir Configurações", en: "Open Settings", es: "Abrir Configuración" } },
    escalate: false,
  },
  {
    id: "how-gui-handles-multiple-channels",
    category: "agent",
    keywords: ["vários canais", "multiple channels", "ao mesmo tempo", "whatsapp e telefone", "sms", "varios canales", "al mismo tiempo", "simultâneo", "atende tudo", "omnichannel"],
    q: {
      pt: "O Gui atende telefone, WhatsApp e SMS ao mesmo tempo?",
      en: "Does Gui handle phone, WhatsApp and SMS at the same time?",
      es: "¿Gui atiende teléfono, WhatsApp y SMS al mismo tiempo?",
    },
    a: {
      pt: "Atendo, sim — e sem nunca me cansar. Eu respondo telefone, WhatsApp e SMS simultaneamente, quantas conversas vierem, 24 horas por dia. E reconheço o mesmo cliente entre canais, então o histórico fica unificado no CRM. Você nunca mais perde um contato por estar ocupado.",
      en: "I do — and I never tire. I answer phone, WhatsApp and SMS simultaneously, however many conversations come in, 24 hours a day. And I recognize the same customer across channels, so the history stays unified in the CRM. You'll never lose a contact to being busy again.",
      es: "Sí — y nunca me canso. Respondo teléfono, WhatsApp y SMS simultáneamente, cuantas conversaciones lleguen, las 24 horas. Y reconozco al mismo cliente entre canales, así que el historial queda unificado en el CRM. Nunca más pierdes un contacto por estar ocupado.",
    },
    action: { kind: "none", label: { pt: "Ver canais", en: "View channels", es: "Ver canales" } },
    escalate: false,
  },
  {
    id: "gui-close-and-collect",
    category: "agent",
    keywords: ["fechar venda", "cobrar na ligação", "close", "collect", "fechar e cobrar", "cerrar venta", "cobrar en llamada", "cotação", "preço exato", "vender"],
    q: {
      pt: "O Gui fecha venda e cobra durante a conversa?",
      en: "Does Gui close the sale and collect during the conversation?",
      es: "¿Gui cierra la venta y cobra durante la conversación?",
    },
    a: {
      pt: "Essa é minha especialidade: eu fecho e cobro. Cito o preço exato do seu treino, fecho o pedido ou agendamento e envio o link de pagamento por SMS na mesma conversa — ou peço um sinal pra garantir a reserva. Dinheiro entra antes da pessoa desligar. Quer revisar suas regras de preço em Treinar Gui?",
      en: "This is my specialty: I close and collect. I quote the exact price from your training, close the order or booking, and send the payment link by SMS in the same conversation — or take a deposit to lock the reservation. Money lands before they hang up. Want to review your pricing in Train Gui?",
      es: "Esta es mi especialidad: cierro y cobro. Cito el precio exacto de tu entrenamiento, cierro el pedido o la cita y envío el enlace de pago por SMS en la misma conversación — o pido un anticipo para asegurar la reserva. El dinero entra antes de que cuelguen. ¿Revisamos tus precios en Entrenar a Gui?",
    },
    action: { kind: "train_ai", label: { pt: "Treinar Gui", en: "Train Gui", es: "Entrenar a Gui" } },
    escalate: false,
  },
];

// ── Instant matcher ─────────────────────────────────────────────────────────
// Accent-insensitive keyword + question scoring. Returns the best scenario with
// its _score, or null when confidence is below the floor (→ caller uses the AI
// fallback). This is what makes Gui Support resolve in milliseconds, offline.
const _norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ऀ-ॿ\s]/g, " ").replace(/\s+/g, " ").trim();

export function matchSupport(query, lang = "en") {
  const q = _norm(query);
  if (!q) return null;
  const qWords = new Set(q.split(" ").filter((w) => w.length > 2));
  let best = null, bestScore = 0;
  for (const sc of SUPPORT_KB) {
    let score = 0;
    for (const kw of (sc.keywords || [])) {
      const k = _norm(kw);
      if (!k) continue;
      if (q.includes(k)) score += k.includes(" ") ? 3 : 2;
      else if (k.split(" ").some((w) => w.length > 2 && qWords.has(w))) score += 1;
    }
    const qa = _norm((sc.q && (sc.q[lang] || sc.q.en)) || "");
    if (qa) { const ov = [...qWords].filter((w) => qa.includes(w)).length; score += Math.min(ov, 4) * 0.5; }
    if (score > bestScore) { bestScore = score; best = sc; }
  }
  if (bestScore < 2 || !best) return null;
  return { ...best, _score: bestScore };
}

// Common quick-help scenarios to surface as one-tap chips (by id).
export const SUPPORT_QUICK = [
  "connection-code-not-working", "connect-whatsapp", "how-credits-work",
  "out-of-credits", "gui-said-something-wrong", "export-data", "change-plan",
];
