// ─────────────────────────────────────────────────────────────────────────────
// SALES KIT — the single source of truth for every Guileo sales asset.
// The "billionaire rule": ONE sentence everything hangs on. Deck (/deck),
// Pitch (/pitch), Roteiro (/roteiro), Cola (/cola) and the pitch cards all
// import from HERE — change the sentence once, it changes everywhere.
// (functions/lib/emailTemplates.js mirrors the sentence inline — functions
// can't import from src/ at build time; keep the two in sync by hand.)
// ─────────────────────────────────────────────────────────────────────────────

export const MASTER_SENTENCE = {
  pt: "A Guileo instala um funcionário que nunca dorme: atende, agenda, vende e COBRA por você — e custa menos que um dia de garçom.",
  en: "Guileo installs an employee that never sleeps: answers, books, sells and COLLECTS for you — for less than a day of one waiter's pay.",
  es: "Guileo instala un empleado que nunca duerme: contesta, agenda, vende y COBRA por ti — y cuesta menos que un día de sueldo de un mesero.",
};

// Pricing anchors used across assets (source of truth for plans: src/data/selfServePlans.js).
export const PRICING = {
  selfServe: [
    { name: "Essential", price: 149 },
    { name: "Personalized", price: 449 },
    { name: "Full Operation", price: 999 },
  ],
  doneForYou: { setup: 990, monthly: 1497 },
  guaranteeDays: 30,
};

// ─────────────────────────────────────────────────────────────────────────────
// OBJECTION KILLERS — the 8 objections every seller WILL hear, in the order
// they usually appear. Each has:
//   tag   → 2-4 word label (pocket card / flip-card front)
//   q     → the objection as the owner actually says it
//   a     → 2-3 sentences a seller can READ ALOUD naturally (concierge tone,
//           agree-first, always lands back on the live demo or the guarantee)
//   short → one-line version for the pocket card
// ─────────────────────────────────────────────────────────────────────────────
export const OBJECTION_KILLERS = [
  {
    id: "ai_annoy",
    tag: { pt: "IA vai irritar meu cliente", en: "AI will annoy my customers", es: "La IA va a molestar a mi cliente" },
    q: {
      pt: "“IA vai irritar meu cliente.”",
      en: "“AI is going to annoy my customers.”",
      es: "“La IA va a molestar a mi cliente.”",
    },
    a: {
      pt: "Entendo — todo mundo já sofreu com robô ruim. Por isso, em vez de te convencer, deixa a Gui te ligar agora e você julga a voz você mesmo. O que irrita cliente de verdade é ligar às 21h e cair na caixa postal — é isso que a Gui acaba.",
      en: "I get it — we've all suffered through a bad robot. So instead of convincing you, let Gui call you right now and you judge the voice yourself. What actually annoys customers is calling at 9pm and hitting voicemail — that's what Gui ends.",
      es: "Te entiendo — todos hemos sufrido con un robot malo. Por eso, en vez de convencerte, deja que Gui te llame ahora y tú mismo juzgas la voz. Lo que de verdad molesta al cliente es llamar a las 9 de la noche y caer al buzón — eso es lo que Gui elimina.",
    },
    short: {
      pt: "“Ouve ela te ligar agora e julga você mesmo. O que irrita é a caixa postal.”",
      en: "“Hear her call you now and judge yourself. Voicemail is what annoys people.”",
      es: "“Óyela llamarte ahora y juzga tú. Lo que molesta es el buzón.”",
    },
  },
  {
    id: "have_staff",
    tag: { pt: "Já tenho quem atende", en: "I already have someone", es: "Ya tengo quien atiende" },
    q: {
      pt: "“Já tenho quem atende o telefone.”",
      en: "“I already have someone answering the phone.”",
      es: "“Ya tengo quien contesta el teléfono.”",
    },
    a: {
      pt: "Ótimo — a Gui não veio substituir, veio cobrir o que ninguém alcança: a hora do almoço, a noite, o domingo e as três ligações que tocam ao mesmo tempo. Sua equipe cuida de quem está na frente dela; a Gui pega todo o resto. Ela multiplica seu time, não troca ele.",
      en: "Great — Gui isn't here to replace anyone, it covers what no one can reach: lunch hour, nights, Sundays, and the three calls ringing at once. Your team takes care of whoever's in front of them; Gui catches everything else. It multiplies your team, it doesn't swap it.",
      es: "Perfecto — Gui no viene a reemplazar, viene a cubrir lo que nadie alcanza: la hora del almuerzo, la noche, el domingo y las tres llamadas que suenan a la vez. Tu equipo atiende a quien tiene enfrente; Gui toma todo lo demás. Multiplica tu equipo, no lo cambia.",
    },
    short: {
      pt: "“Ela cobre o que ninguém alcança: noite, domingo, 3 ligações juntas.”",
      en: "“It covers what no one reaches: nights, Sundays, 3 calls at once.”",
      es: "“Cubre lo que nadie alcanza: noche, domingo, 3 llamadas a la vez.”",
    },
  },
  {
    id: "wrong_order",
    tag: { pt: "E se errar o pedido?", en: "What if it gets an order wrong?", es: "¿Y si se equivoca en el pedido?" },
    q: {
      pt: "“E se ela errar o pedido?”",
      en: "“What if it gets the order wrong?”",
      es: "“¿Y si se equivoca en el pedido?”",
    },
    a: {
      pt: "A Gui é treinada no SEU cardápio e nos SEUS preços, repete o pedido pra confirmar antes de fechar, e toda ligação fica gravada e transcrita no seu painel. E quando ela não sabe, ela passa pra um humano em vez de inventar. Seu funcionário de hoje também erra — a diferença é que a Gui deixa tudo registrado pra você conferir.",
      en: "Gui is trained on YOUR menu and YOUR prices, repeats the order back to confirm before closing, and every call is recorded and transcribed in your dashboard. And when it doesn't know, it hands off to a human instead of guessing. Your staff today makes mistakes too — the difference is Gui leaves everything on record for you to check.",
      es: "Gui está entrenada en TU menú y TUS precios, repite el pedido para confirmar antes de cerrar, y cada llamada queda grabada y transcrita en tu panel. Y cuando no sabe, pasa a un humano en vez de inventar. Tu empleado de hoy también se equivoca — la diferencia es que Gui deja todo registrado para que lo revises.",
    },
    short: {
      pt: "“Treinada no seu cardápio, confirma antes de fechar, tudo gravado. Não sabe? Passa pra humano.”",
      en: "“Trained on your menu, confirms before closing, all recorded. Unsure? Hands to a human.”",
      es: "“Entrenada en tu menú, confirma antes de cerrar, todo grabado. ¿No sabe? Pasa a un humano.”",
    },
  },
  {
    id: "too_expensive",
    tag: { pt: "Muito caro", en: "Too expensive", es: "Muy caro" },
    q: {
      pt: "“Tá muito caro.”",
      en: "“It's too expensive.”",
      es: "“Está muy caro.”",
    },
    a: {
      pt: "Vamos fazer a conta juntos: você perde umas 20 a 30 ligações por mês, e cada uma vale uns $50 a $100 — isso é mais de $2.000 saindo pela porta todo mês. O plano começa em $149, menos que um dia de garçom, e ela trabalha os 30 dias sem folga. E se em 30 dias não valer a pena, a gente devolve seu dinheiro.",
      en: "Let's do the math together: you miss 20 to 30 calls a month, and each one is worth $50 to $100 — that's over $2,000 walking out the door every month. The plan starts at $149, less than one day of a waiter's pay, and she works all 30 days without a break. And if in 30 days it isn't worth it, we refund your money.",
      es: "Hagamos la cuenta juntos: pierdes unas 20 a 30 llamadas al mes, y cada una vale unos $50 a $100 — eso es más de $2.000 saliendo por la puerta cada mes. El plan empieza en $149, menos que un día de sueldo de un mesero, y ella trabaja los 30 días sin descanso. Y si en 30 días no vale la pena, te devolvemos tu dinero.",
    },
    short: {
      pt: "“Caro é perder $2.000/mês em ligação. $149 é menos que um dia de garçom — e tem 30 dias de garantia.”",
      en: "“Expensive is losing $2,000/mo in calls. $149 is less than a day of a waiter — with a 30-day guarantee.”",
      es: "“Caro es perder $2.000/mes en llamadas. $149 es menos que un día de mesero — con 30 días de garantía.”",
    },
  },
  {
    id: "language",
    tag: { pt: "Meu inglês / espanhol", en: "My English / Spanish", es: "Mi inglés / portugués" },
    q: {
      pt: "“Meu inglês (ou espanhol) não é bom — e meus clientes falam de tudo.”",
      en: "“My customers call in Spanish and Portuguese and we can't keep up.”",
      es: "“Mis clientes llaman en inglés y no siempre podemos atenderlos bien.”",
    },
    a: {
      pt: "Essa é a melhor parte: a Gui atende em inglês, português e espanhol — e troca de idioma na hora, conforme o cliente fala. Aquela ligação em inglês que hoje dá nervoso vira uma venda tranquila. Você para de perder cliente por causa de idioma pra sempre.",
      en: "That's the best part: Gui answers in English, Portuguese and Spanish — and switches language on the spot, following the caller. The call that today gets fumbled becomes a smooth sale. You stop losing customers over language, for good.",
      es: "Esa es la mejor parte: Gui contesta en inglés, portugués y español — y cambia de idioma al instante, según hable el cliente. Esa llamada que hoy pone nervioso a cualquiera se vuelve una venta tranquila. Dejas de perder clientes por el idioma, para siempre.",
    },
    short: {
      pt: "“Ela atende em EN, PT e ES e troca de idioma na hora. Nunca mais perde cliente por idioma.”",
      en: "“She answers in EN, PT and ES and switches on the spot. Never lose a customer over language again.”",
      es: "“Contesta en EN, PT y ES y cambia al instante. Nunca más pierdes cliente por idioma.”",
    },
  },
  {
    id: "privacy",
    tag: { pt: "E a privacidade?", en: "What about privacy?", es: "¿Y la privacidad?" },
    q: {
      pt: "“E a privacidade dos meus clientes?”",
      en: "“What about my customers' privacy?”",
      es: "“¿Y la privacidad de mis clientes?”",
    },
    a: {
      pt: "Pergunta certa. Os dados dos seus clientes são SEUS: ficam no seu painel, não são vendidos nem compartilhados, e você vê cada ligação e transcrição quando quiser. É mais controle do que você tem hoje com recado em papel e WhatsApp espalhado no celular de todo mundo.",
      en: "Right question to ask. Your customers' data is YOURS: it lives in your dashboard, it's never sold or shared, and you can see every call and transcript whenever you want. That's more control than you have today with paper notes and WhatsApp scattered across everyone's phones.",
      es: "Buena pregunta. Los datos de tus clientes son TUYOS: viven en tu panel, no se venden ni se comparten, y ves cada llamada y transcripción cuando quieras. Es más control del que tienes hoy con recados en papel y WhatsApp regado en el teléfono de todos.",
    },
    short: {
      pt: "“Os dados são SEUS: ficam no seu painel, nada é vendido, tudo auditável.”",
      en: "“The data is YOURS: lives in your dashboard, nothing sold, all auditable.”",
      es: "“Los datos son TUYOS: viven en tu panel, nada se vende, todo auditable.”",
    },
  },
  {
    id: "show_me",
    tag: { pt: "Quero ver funcionando", en: "I want to see it working", es: "Quiero verlo funcionando" },
    q: {
      pt: "“Quero ver funcionando primeiro.”",
      en: "“I want to see it working first.”",
      es: "“Quiero verlo funcionando primero.”",
    },
    a: {
      pt: "Perfeito — é exatamente o que eu ia propor. Coloca seu número aqui em guileoai.com e a Gui te liga em segundos, ao vivo, agora. Você não precisa acreditar em mim: precisa atender o telefone.",
      en: "Perfect — that's exactly what I was going to suggest. Put your number in at guileoai.com and Gui calls you in seconds, live, right now. You don't have to believe me: you just have to answer the phone.",
      es: "Perfecto — es justo lo que te iba a proponer. Pon tu número en guileoai.com y Gui te llama en segundos, en vivo, ahora. No tienes que creerme: solo tienes que contestar el teléfono.",
    },
    short: {
      pt: "“Perfeito. Põe seu número em guileoai.com — ela te liga em segundos, ao vivo.”",
      en: "“Perfect. Drop your number at guileoai.com — she calls you in seconds, live.”",
      es: "“Perfecto. Pon tu número en guileoai.com — te llama en segundos, en vivo.”",
    },
  },
  {
    id: "later",
    tag: { pt: "Depois eu vejo", en: "I'll look at it later", es: "Después lo veo" },
    q: {
      pt: "“Depois eu vejo isso.”",
      en: "“I'll look at it later.”",
      es: "“Después lo veo.”",
    },
    a: {
      pt: "Claro, sem pressa — só lembra que o telefone continua tocando enquanto você pensa, e cada semana são mais umas $500 que vão pro concorrente. A demo leva 2 minutos e a garantia é de 30 dias, então o risco de testar é zero. Que tal a Gui te ligar agora, e o “depois” fica só pra decisão?",
      en: "Of course, no rush — just remember the phone keeps ringing while you think, and every week is another $500 or so going to your competitor. The demo takes 2 minutes and the guarantee is 30 days, so trying it costs you nothing. How about Gui calls you now, and “later” is just for the decision?",
      es: "Claro, sin prisa — solo recuerda que el teléfono sigue sonando mientras lo piensas, y cada semana son otros $500 que se van al competidor. La demo toma 2 minutos y la garantía es de 30 días, así que probar no te cuesta nada. ¿Qué tal si Gui te llama ahora, y el “después” queda solo para la decisión?",
    },
    short: {
      pt: "“Cada semana pensando = ~$500 pro concorrente. Demo de 2 min agora, decisão depois.”",
      en: "“Every week thinking = ~$500 to a competitor. 2-min demo now, decision later.”",
      es: "“Cada semana pensando = ~$500 al competidor. Demo de 2 min ahora, decisión después.”",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROOF POINTS — only TRUE, verifiable claims. These are the things a seller
// can say with a straight face and prove on the spot.
// ─────────────────────────────────────────────────────────────────────────────
export const PROOF_POINTS = [
  {
    id: "live_demo",
    icon: "📞",
    title: { pt: "Demo ao vivo, agora", en: "Live demo, right now", es: "Demo en vivo, ahora" },
    desc: {
      pt: "Em guileoai.com o visitante coloca o telefone e a Gui liga em segundos. A prova não é slide — é a sua orelha.",
      en: "At guileoai.com the visitor drops their phone number and Gui calls in seconds. The proof isn't a slide — it's your own ear.",
      es: "En guileoai.com el visitante pone su teléfono y Gui llama en segundos. La prueba no es una diapositiva — es tu propio oído.",
    },
  },
  {
    id: "guarantee",
    icon: "🛡️",
    title: { pt: "Garantia de 30 dias", en: "30-day money-back", es: "Garantía de 30 días" },
    desc: {
      pt: "Não valeu a pena em 30 dias? Devolvemos o dinheiro. O risco é nosso, não do cliente.",
      en: "Not worth it within 30 days? We refund. The risk is ours, not the client's.",
      es: "¿No valió la pena en 30 días? Devolvemos el dinero. El riesgo es nuestro, no del cliente.",
    },
  },
  {
    id: "autoprovision",
    icon: "⚡",
    title: { pt: "No ar em minutos", en: "Live in minutes", es: "En vivo en minutos" },
    desc: {
      pt: "Pagou no Stripe, a Gui nasce sozinha — treinada e atendendo, sem onboarding manual.",
      en: "Pay on Stripe and Gui is born automatically — trained and answering, no manual onboarding.",
      es: "Pagas en Stripe y Gui nace sola — entrenada y contestando, sin onboarding manual.",
    },
  },
  {
    id: "multilingual (20+ languages)",
    icon: "🌎",
    title: { pt: "Trilíngue de verdade", en: "Truly multilingual (20+ languages)", es: "Trilingüe de verdad" },
    desc: {
      pt: "Inglês, português e espanhol — e ela troca de idioma no meio da ligação, conforme o cliente.",
      en: "English, Portuguese and Spanish — switching language mid-call to follow the customer.",
      es: "Inglés, portugués y español — y cambia de idioma en plena llamada, según el cliente.",
    },
  },
  {
    id: "collects",
    icon: "💳",
    title: { pt: "COBRA na ligação", en: "COLLECTS on the call", es: "COBRA en la llamada" },
    desc: {
      pt: "Fechou o pedido? A Gui manda o link de pagamento por SMS ali mesmo, na chamada. Venda fechada é venda paga.",
      en: "Deal closed? Gui sends the pay-link by SMS right there on the call. A closed sale is a paid sale.",
      es: "¿Cerró el pedido? Gui envía el link de pago por SMS ahí mismo, en la llamada. Venta cerrada es venta pagada.",
    },
  },
  {
    id: "deposit",
    icon: "📅",
    title: { pt: "Sinal pra reservar", en: "Deposit-to-book", es: "Depósito para reservar" },
    desc: {
      pt: "Agendamento com sinal pago na hora — o no-show despenca quando o cliente já deixou dinheiro na mesa.",
      en: "Bookings with a deposit paid on the spot — no-shows collapse once the customer has money on the table.",
      es: "Reservas con depósito pagado al momento — el no-show se desploma cuando el cliente ya dejó dinero en la mesa.",
    },
  },
];
