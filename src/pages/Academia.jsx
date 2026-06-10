import { useState, useEffect, useRef } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink } from "../data/contact.js";

// ─────────────────────────────────────────────────────────────────────────────
// /academia — GUILEO PARTNER ACADEMY. The collaborator's operating manual as an
// interactive experience: UNDERSTAND (what Guileo is, honestly) → THE OFFER (two
// official tracks, resolving self-service vs tailored) → LEARN TO SELL (ICP,
// scripts, objections) → PRACTICE (roleplay vs Gui playing a skeptical owner,
// scored) → LEVELS (Agendador 10% → Closer 20%) → ACT (first 7 days + kit).
// Bilingual PT/EN. Built for people with ZERO sales experience (Luis's network).
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  pt: {
    eyebrow: "Guileo Partner Academy",
    h1a: "Aprenda a vender o que",
    h1b: "vende sozinho.",
    sub: "O manual completo do Growth Partner — entenda, aprenda, pratique com a própria Gui e saia daqui pronto pra primeira venda.",
    nav: ["Entenda", "Catálogo", "A oferta", "Aprenda", "Pratique", "Níveis", "Comece"],
    // CATALOG (full — so a brand-new person understands everything we sell)
    scTag: "Passo 2 · O catálogo",
    scH: "Tudo que a Guileo vende — produtos e serviços",
    scSub: "Você não precisa decorar — precisa saber que existe. Na venda, você descobre a dor e o time monta o pacote com as peças certas.",
    svcH: "🛎️ SERVIÇOS — a gente OPERA pro cliente (todo mês)",
    svcs: [
      ["🎙️", "Agentes de voz (a Gui)", "Atende e faz ligações: pedidos, agendamentos, vendas, cobrança, confirmação"],
      ["💬", "IA no WhatsApp & SMS", "Responde, vende e agenda nas mensagens — instantâneo, qualquer idioma"],
      ["📣", "Anúncios & tráfego pago", "Campanhas no Google/Meta criadas a partir dos dados reais dos clientes dele"],
      ["✍️", "Conteúdo & social media", "Posts, reels e calendário editorial — criados, agendados e respondidos"],
      ["🎬", "Produção de vídeo", "Vídeos pro negócio: anúncios, institucional, redes"],
      ["🔄", "Automações com IA", "Follow-up, no-show, reativação, cobrança — rotinas que rodam sozinhas"],
      ["⭐", "Reviews & reputação", "Pede avaliação na hora certa, responde reviews, mantém a nota alta"],
      ["🧠", "Consultoria & growth", "Um humano estudando o negócio e otimizando tudo todo mês"],
    ],
    prodH: "📦 PRODUTOS — a gente CONSTRÓI e entrega (projeto)",
    prods: [
      ["🌐", "Sites & landing pages", "Feitos pra converter visita em cliente — com a Gui embutida"],
      ["📱", "Aplicativos mobile", "iOS e Android — do MVP ao marketplace"],
      ["⚙️", "Software sob medida", "Sistemas internos, portais, ferramentas — o que o negócio precisar"],
      ["🛒", "E-commerce / Shopify", "Loja completa com IA de suporte, recuperação de carrinho e win-back"],
      ["📊", "Dashboards & CRM", "O negócio inteiro visível num painel — leads, vendas, clientes"],
      ["📅", "Sistemas de agendamento", "Agenda online ligada à Gui — ela marca, confirma e remarca"],
    ],
    credH: "🪙 Como o cliente paga o uso: CRÉDITOS",
    cred: "Cada tarefa que a Gui executa consome créditos (~5 por tarefa: uma ligação atendida, um follow-up, uma mensagem). Os planos incluem créditos mensais — Starter 500 · Growth 2.000 · Scale 6.000 — e dá pra comprar mais. É como o cliente VÊ o que está pagando: cada crédito é trabalho feito.",
    guiJobsH: "🤖 O que a Gui faz, tarefa por tarefa (decore ESTAS)",
    guiJobs: ["🛒 Anota pedidos", "📅 Agenda & confirma", "🎯 Qualifica leads", "💰 Fecha vendas", "🧾 Envia orçamentos", "🎧 Dá suporte", "🔁 Reativa sumidos", "📦 Rastreia pedidos", "📋 Faz fichas/intake", "🔔 Manda lembretes", "↩️ Faz follow-up", "⭐ Pede avaliações"],
    cockH: "📟 O Growth Cockpit — o painel que o cliente recebe",
    cock: "É onde o dono VÊ tudo: visão geral e leads do dia · treinar a IA, análises e insights · operações (pedidos, cozinha, agenda, entregas) · conversas (chamadas, WhatsApp, SMS, social) · clientes · crescer receita (pagamentos, follow-ups, lista de espera, recorrentes, reputação, fidelidade, campanhas, públicos) · conta e plano. ~30 telas. Na demo, mostrar o painel fecha venda.",
    // 1 UNDERSTAND
    s1tag: "Passo 1 · Entenda",
    s1h: "O que é a Guileo — em uma frase",
    sentence: "A Guileo instala um time de IA + marketing que atende, vende e faz crescer o negócio do cliente sozinho, 24/7 — ele escolhe o resultado, a gente entrega.",
    s1what: "O que o cliente recebe",
    legs: [
      ["🧠", "Guileo Brain", "Uma IA (a Gui) que atende ligações e mensagens, agenda, qualifica e fecha — 24h, qualquer idioma."],
      ["📈", "Guileo AD", "Cada conversa vira dado, dado vira marketing, marketing vira receita repetida."],
      ["🛠️", "Guileo Build", "Sites, apps e software sob medida — construídos pra converter."],
    ],
    s1portal: "E ele VÊ tudo funcionando no Growth Cockpit: pedidos, agenda, conversas, pagamentos, reputação, campanhas — ~30 telas de operação real. O produto não é promessa: é painel.",
    honestH: "Venda honesta (regra da casa)",
    honest: [
      ["✅ Pode prometer", "Atendimento 24/7 · agendamentos e vendas no automático · follow-up de todo lead · no ar em 7 dias · garantia de 30 dias · humano supervisionando"],
      ["🚫 Nunca prometa", "Que a IA nunca erra (ela erra e o humano corrige) · resultado exato em $ (mostre médias) · prazo menor que 7 dias · qualquer coisa fora do pacote"],
    ],
    honestWhy: "Com garantia de 30 dias, venda exagerada = reembolso + reputação queimada. Venda honesta = cliente que fica e indica.",
    // 2 THE OFFER
    s2tag: "Passo 3 · A oferta",
    s2h: "Dois trilhos. Saiba qual oferecer.",
    trackA: { name: "Trilho A · Self-service", who: "Negócio pequeno, dono ocupado, quer começar simples", what: "Ele assina sozinho no site: Starter $49 · Growth $149 · Scale $399/mês (créditos da Gui inclusos)", you: "Você indica com seu link e ganha 20% das 3 primeiras mensalidades", ex: "Ex: Growth $149 → ~$89 pra você" },
    trackB: { name: "Trilho B · Sob medida ⭐", who: "Negócio estabelecido (clínica, restaurante movimentado, imobiliária) que perde dinheiro real todo mês", what: "Pacote desenhado pro negócio: a partir de $990 setup + $1.497+/mês — IA + marketing + o que ele precisar", you: "Você conduz a venda e ganha 20% do contrato (setup + 3 meses)", ex: "Ex: pacote típico → ~$1.096 pra você POR VENDA" },
    trackRule: "Regra de bolso: dono que reclama de \"perder ligação/cliente\" e fatura > $20k/mês → Trilho B. Resto → Trilho A. Na dúvida, agenda a demo — a conversa revela.",
    // 3 LEARN
    s3tag: "Passo 4 · Aprenda",
    s3h: "Pra quem vender — e o que dizer",
    icpH: "Comece pela SUA rede (é por isso que você foi escolhido)",
    icp: "Pense agora em 5 donos de negócio que você conhece: o dono do restaurante que você almoça, sua dentista, o corretor do seu prédio, a dona do salão, o personal. Negócios que VIVEM de ligação e agenda. Esses são seus primeiros 5.",
    msgH: "A primeira mensagem (copie e adapte)",
    msg: "Oi {Nome}! Tô trabalhando com uma empresa que instala uma IA que atende ligações e WhatsApp do negócio 24h — agenda, vende e faz follow-up sozinha. Lembrei de você na hora. Posso te mostrar em 15 min? A própria IA te liga na hora — você precisa OUVIR isso. 😄",
    objH: "As 6 objeções que você VAI ouvir (e as respostas)",
    obj: [
      ["\"Não tenho tempo\"", "\"Exatamente por isso — a Gui devolve seu tempo. São 15 minutos e a demo é a IA te ligando. Que dia fica melhor, terça ou quarta?\""],
      ["\"Quanto custa?\"", "\"Depende do que seu negócio precisa — tem desde $49/mês. Mas antes do preço, deixa eu te mostrar o que ela faz — aí você me diz quanto vale. Posso fazer ela te ligar agora?\""],
      ["\"IA vai irritar meus clientes\"", "\"Ouve a demo primeiro — todo mundo se surpreende. E tem humano supervisionando: o que a Gui não resolve, ela transfere. Seus clientes preferem a Gui às 21h do que ninguém.\""],
      ["\"Já tenho recepcionista\"", "\"Perfeito — a Gui não substitui, ela cobre o que a recepcionista não alcança: madrugada, fim de semana, 3 ligações ao mesmo tempo, follow-up de quem sumiu.\""],
      ["\"Me manda uma proposta\"", "\"Mando sim — personalizada. Mas proposta sem demo é papel. Fecha 15 min comigo essa semana, a Gui te liga, e você recebe a proposta já sabendo o que tá comprando.\""],
      ["\"Vou pensar\"", "\"Claro. Só uma pergunta: o que precisaria ser verdade pra fazer sentido? ... Então deixa eu te mostrar exatamente isso na demo. E lembra: 30 dias de garantia — o risco é nosso.\""],
    ],
    indH: "🏪 O que vender pra cada negócio (cola rápida)",
    inds: [
      ["🍽️", "Restaurante", "Pedidos e reservas por telefone/WhatsApp — nunca mais perder o rush"],
      ["🏥", "Clínica / Médico", "Agendamento 24h + lembretes que cortam no-show"],
      ["🦷", "Dentista", "Cadeira cheia: recalls de limpeza + follow-up de orçamento"],
      ["⚖️", "Advocacia", "Intake de casos 24h + consulta agendada na hora"],
      ["🔧", "Encanador / HVAC", "Emergência atendida na hora + orçamento enviado — ganha do concorrente"],
      ["🏠", "Imobiliária", "Lead respondido em segundos + visita agendada"],
      ["💪", "Academia", "Matrículas + win-back de alunos sumidos"],
      ["🛒", "E-commerce", "Suporte instantâneo + recuperação de carrinho"],
      ["🚗", "Concessionária", "Test drive agendado + follow-up de proposta"],
    ],
    demoH: "Sua arma secreta: a demo ao vivo",
    demo: "Você não precisa convencer ninguém — a Gui convence. Em qualquer conversa, oferece: \"deixa a IA te ligar agora\". Ela liga, atende como se fosse o negócio da pessoa, agenda, vende. A venda praticamente se faz.",
    discH: "🔍 As 5 perguntas de ouro (descoberta — faça ANTES de apresentar)",
    discSub: "Quem pergunta, conduz. Essas 5 fazem o dono VER a própria dor — aí a Guileo vira a resposta óbvia.",
    disc: [
      "Quantas ligações vocês perdem por dia — almoço, noite, domingo?",
      "Quem responde o WhatsApp quando vocês fecham?",
      "O que acontece com quem pede orçamento e some?",
      "Quantos clientes deixam de voltar porque ninguém chamou de volta?",
      "Se cada ligação perdida vale uns $50–100… quanto vaza por mês?",
    ],
    meetH: "📋 O roteiro da reunião de 15 minutos",
    meet: [
      ["0–3 min", "Quebra-gelo + as 5 perguntas de ouro", "Deixa ELE falar da dor. Anota os números."],
      ["3–5 min", "A frase + 'deixa eu te mostrar em vez de explicar'", "Não apresente slides ainda. Vá direto pra demo."],
      ["5–9 min", "⚡ A DEMO: a Gui liga pro celular dele", "Silêncio. Deixa ele ouvir. Esse momento vende sozinho."],
      ["9–12 min", "Mostra o Growth Cockpit + conecta com a dor dele", "\"Lembra das ligações do almoço? Aqui você veria cada uma atendida.\""],
      ["12–15 min", "Próximo passo: proposta + garantia 30 dias", "\"Te mando a proposta hoje. Em 7 dias isso tá rodando no seu negócio.\""],
    ],
    storyH: "🎬 Uma venda de verdade, do \"oi\" ao pago",
    storySub: "Acompanhe a Paula (colaboradora nova) vendendo pro Tony, dono de pizzaria:",
    story: [
      ["Seg, 10:00", "Paula manda a 1ª mensagem pro Tony (cliente do restaurante dela há anos)", "msg"],
      ["Seg, 14:30", "Tony: \"quanto custa?\" — Paula segura o preço e oferece a demo: \"a IA te liga, você precisa ouvir\"", "obj"],
      ["Ter, 16:00", "Reunião de 15 min: 5 perguntas → Tony admite que perde ~10 ligações/dia no rush", "meet"],
      ["Ter, 16:07", "A Gui liga pro celular do Tony e anota um pedido completo com upsell. Tony ri sozinho", "demo"],
      ["Ter, 16:15", "Paula mostra o Cockpit e fecha o próximo passo: \"te mando a proposta hoje\"", "cock"],
      ["Ter, 18:00", "Proposta personalizada no WhatsApp: $990 setup + $1.497/mês · recupera ~$3.900/mês", "prop"],
      ["Qui, 09:00", "Tony: \"e se não funcionar?\" — Paula: \"30 dias de garantia, o risco é nosso\" → ✅ ACEITO", "close"],
      ["7 dias depois", "Sistema no ar. Paula recebe ~$1.096 de comissão. Tony vira o case dela pro próximo cliente", "win"],
    ],
    // 4 PRACTICE
    s4tag: "Passo 5 · Pratique",
    s4h: "Treine com a Gui — ela vai ser um cliente difícil",
    s4sub: "A Gui interpreta o Marcos, dono de restaurante cético. Responda como você responderia de verdade. Ela avalia cada resposta e te mostra a ideal.",
    start: "▶ Começar o treino",
    restart: "↻ Treinar de novo",
    send: "Responder",
    placeholder: "Escreva sua resposta como se fosse no WhatsApp…",
    scoreH: "Sua nota",
    pass: "🎉 Aprovado! Você está pronto pra agendar de verdade. Manda o print pro Luis e recebe seus primeiros leads.",
    fail: "Quase! Releia as respostas ideais acima e treine de novo — aprovação é 7+.",
    ideal: "💡 Resposta forte:",
    // 5 LEVELS
    s5tag: "Passo 6 · Níveis",
    s5h: "Comece agendando. Cresça fechando.",
    lvl1: { name: "Nível 1 · Agendador", what: "Você prospecta e agenda a demo. O Luis fecha com você junto (e você aprende vendo).", earn: "10% de cada venda fechada que você agendou", req: "Requisito: completar este Academy" },
    lvl2: { name: "Nível 2 · Closer ⭐", what: "Você conduz a venda inteira: demo, proposta, fechamento.", earn: "20% de cada venda fechada (~$1.096 no pacote típico)", req: "Requisito: 3 vendas fechadas como Agendador + aprovação no treino" },
    // 6 ACT
    simH: "🧮 Simula seus ganhos",
    simDeals: "Vendas fechadas / mês",
    simLevel: "Seu nível",
    simNote: "Base: pacote típico $990 setup + $1.497/mês (valor da venda = setup + 3 meses).",
    faqH: "❓ Dúvidas de parceiro (as que todo mundo tem)",
    faq: [
      ["Preciso pagar algo pra entrar?", "Não. Zero taxa, zero mensalidade. Você investe seu tempo; a Guileo investe o produto, a entrega e o treinamento."],
      ["Preciso de CNPJ / empresa?", "Pra começar, não — você pode receber como pessoa física (RPA) ou via PIX/transferência conforme combinado no contrato de parceria. Formalizamos junto quando escalar."],
      ["Quando e como recebo a comissão?", "Após o pagamento do cliente ser confirmado — normalmente até 7 dias depois. Direto na sua conta."],
      ["E se o cliente cancelar na garantia de 30 dias?", "A comissão é paga sobre venda CONFIRMADA (passada a garantia ou cliente ativo). Se houver reembolso total, a comissão não é devida — por isso vendemos honesto."],
      ["Posso vender fora da minha cidade?", "Sim — a demo é por telefone e a entrega é remota. Brasil e EUA desde o dia 1."],
      ["Quem atende o cliente depois que eu vendo?", "O time Guileo: implantação em 7 dias, suporte e otimização contínua. Você mantém o relacionamento (e ganha pontos por isso), mas não carrega a operação."],
      ["Não entendo de tecnologia. Consigo?", "Sim — esse Academy + a demo fazem o trabalho técnico por você. Você precisa entender a DOR do dono de negócio, não o código."],
      ["E se me perguntarem algo que não sei?", "Resposta padrão: \"Ótima pergunta — vou confirmar com o time e te trago hoje ainda.\" Anota e manda pro Luis. Nunca invente."],
    ],
    glosH: "📖 Glossário rápido",
    glos: [
      ["Lead", "pessoa interessada que deixou contato"],
      ["Follow-up", "voltar a falar com quem não respondeu"],
      ["No-show", "cliente que marcou e não apareceu"],
      ["Ticket", "valor médio que o cliente gasta"],
      ["Setup", "valor único de implantação"],
      ["Mensalidade (MRR)", "receita que se repete todo mês"],
      ["ICP", "perfil de cliente ideal (quem mais precisa)"],
      ["Win-back", "reativar cliente que sumiu"],
      ["Demo", "demonstração ao vivo (a Gui ligando)"],
      ["Fechar", "cliente aceitou e pagou"],
    ],
    s6tag: "Passo 7 · Comece",
    s6h: "Seus primeiros 7 dias",
    week: [
      ["Dia 1", "Complete este Academy + passe no treino da Gui"],
      ["Dia 1", "Liste 5 donos de negócio da sua rede"],
      ["Dia 2", "Mande a primeira mensagem pros 5"],
      ["Dia 3-4", "Agende 2 demos (use: \"a IA te liga na hora\")"],
      ["Dia 5-7", "Faça as demos com o Luis · primeira comissão a caminho"],
    ],
    kitH: "Seu arsenal",
    kit: [["📱 Cola de bolso", "/cola"], ["🎤 Pitch do cliente", "/pitch"], ["📄 Gerador de proposta", "/proposta?to=Cliente&price=1497&recover=3900"], ["🤝 Deck do parceiro", "/parceiro"], ["🎯 Quiz (lead frio)", "/quiz"], ["🧮 Calculadora", "/calculator"]],
    cta: "🤝 Quero entrar — falar com o Luis",
    ctaMsg: "Oi Luis! Completei o Partner Academy e quero começar como Agendador.",
  },
  en: {
    eyebrow: "Guileo Partner Academy",
    h1a: "Learn to sell what",
    h1b: "sells itself.",
    sub: "The complete Growth Partner manual — understand, learn, practice against Gui herself, and leave ready for your first sale.",
    nav: ["Understand", "Catalog", "The offer", "Learn", "Practice", "Levels", "Start"],
    scTag: "Step 2 · The catalog",
    scH: "Everything Guileo sells — products and services",
    scSub: "You don't need to memorize it — you need to know it exists. In the sale, you find the pain and the team assembles the package with the right pieces.",
    svcH: "🛎️ SERVICES — we OPERATE for the client (monthly)",
    svcs: [
      ["🎙️", "Voice agents (Gui)", "Answers & makes calls: orders, bookings, sales, collections, confirmations"],
      ["💬", "WhatsApp & SMS AI", "Replies, sells and books in messages — instant, any language"],
      ["📣", "Ads & paid traffic", "Google/Meta campaigns built from their customers' real data"],
      ["✍️", "Content & social media", "Posts, reels and editorial calendar — created, scheduled, answered"],
      ["🎬", "Video production", "Videos for the business: ads, brand, social"],
      ["🔄", "AI automations", "Follow-up, no-show, win-back, collections — routines that run themselves"],
      ["⭐", "Reviews & reputation", "Asks for reviews at the right moment, replies, keeps the rating high"],
      ["🧠", "Consulting & growth", "A human studying the business and optimizing everything monthly"],
    ],
    prodH: "📦 PRODUCTS — we BUILD and deliver (project)",
    prods: [
      ["🌐", "Websites & landing pages", "Built to convert visits into clients — with Gui embedded"],
      ["📱", "Mobile apps", "iOS & Android — MVP to marketplace"],
      ["⚙️", "Custom software", "Internal systems, portals, tools — whatever the business needs"],
      ["🛒", "E-commerce / Shopify", "Full store with support AI, cart recovery and win-back"],
      ["📊", "Dashboards & CRM", "The whole business visible in one panel — leads, sales, customers"],
      ["📅", "Booking systems", "Online schedule wired to Gui — she books, confirms, reschedules"],
    ],
    credH: "🪙 How clients pay for usage: CREDITS",
    cred: "Every task Gui executes spends credits (~5 per task: an answered call, a follow-up, a message). Plans include monthly credits — Starter 500 · Growth 2,000 · Scale 6,000 — and more can be bought. It's how the client SEES what they pay for: every credit is work done.",
    guiJobsH: "🤖 What Gui does, task by task (memorize THESE)",
    guiJobs: ["🛒 Takes orders", "📅 Books & confirms", "🎯 Qualifies leads", "💰 Closes sales", "🧾 Sends quotes", "🎧 Gives support", "🔁 Wins back ghosts", "📦 Tracks orders", "📋 Does intake", "🔔 Sends reminders", "↩️ Follows up", "⭐ Asks for reviews"],
    cockH: "📟 The Growth Cockpit — the panel the client gets",
    cock: "Where the owner SEES everything: overview & daily leads · train the AI, analytics & insights · operations (orders, kitchen, schedule, deliveries) · conversations (calls, WhatsApp, SMS, social) · customers · grow revenue (payments, follow-ups, waitlist, recurring, reputation, loyalty, campaigns, audiences) · account & plan. ~30 screens. Showing the panel in the demo closes deals.",
    s1tag: "Step 1 · Understand",
    s1h: "What Guileo is — in one sentence",
    sentence: "Guileo installs an AI + marketing team that answers, sells and grows the client's business on its own, 24/7 — they pick the result, we deliver it.",
    s1what: "What the client gets",
    legs: [
      ["🧠", "Guileo Brain", "An AI (Gui) that answers calls & messages, books, qualifies and closes — 24h, any language."],
      ["📈", "Guileo AD", "Every conversation becomes data, data becomes marketing, marketing becomes repeat revenue."],
      ["🛠️", "Guileo Build", "Tailored sites, apps and software — built to convert."],
    ],
    s1portal: "And they SEE it all working in the Growth Cockpit: orders, schedule, conversations, payments, reputation, campaigns — ~30 screens of real operations. The product isn't a promise: it's a dashboard.",
    honestH: "Honest selling (house rule)",
    honest: [
      ["✅ You may promise", "24/7 answering · bookings & sales on autopilot · follow-up on every lead · live in 7 days · 30-day guarantee · human supervision"],
      ["🚫 Never promise", "That the AI never errs (it errs; humans correct) · exact $ results (show averages) · faster than 7 days · anything outside the package"],
    ],
    honestWhy: "With a 30-day guarantee, overselling = refund + burned reputation. Honest selling = clients who stay and refer.",
    s2tag: "Step 3 · The offer",
    s2h: "Two tracks. Know which to offer.",
    trackA: { name: "Track A · Self-service", who: "Small business, busy owner, wants to start simple", what: "They sign up on the site: Starter $49 · Growth $149 · Scale $399/mo (Gui credits included)", you: "You refer with your link and earn 20% of the first 3 months", ex: "E.g.: Growth $149 → ~$89 to you" },
    trackB: { name: "Track B · Tailored ⭐", who: "Established business (clinic, busy restaurant, realty) leaking real money monthly", what: "A package designed for them: from $990 setup + $1,497+/mo — AI + marketing + whatever they need", you: "You run the sale and earn 20% of the contract (setup + 3 months)", ex: "E.g.: typical package → ~$1,096 to you PER SALE" },
    trackRule: "Rule of thumb: an owner who complains about \"missing calls/clients\" and bills > $20k/mo → Track B. Everyone else → Track A. In doubt, book the demo — the conversation reveals it.",
    s3tag: "Step 4 · Learn",
    s3h: "Who to sell to — and what to say",
    icpH: "Start with YOUR network (that's why you were chosen)",
    icp: "Think of 5 business owners you know right now: the restaurant you lunch at, your dentist, your realtor, the salon owner, your trainer. Businesses that LIVE on calls and bookings. Those are your first 5.",
    msgH: "The first message (copy & adapt)",
    msg: "Hey {Name}! I'm working with a company that installs an AI answering a business's calls & WhatsApp 24h — it books, sells and follows up on its own. You came to mind instantly. Can I show you in 15 min? The AI itself calls you live — you need to HEAR this. 😄",
    objH: "The 6 objections you WILL hear (and the answers)",
    obj: [
      ["\"I don't have time\"", "\"That's exactly why — Gui gives you your time back. It's 15 minutes and the demo is the AI calling you. Tuesday or Wednesday?\""],
      ["\"How much is it?\"", "\"Depends on what your business needs — starts at $49/mo. But before price, let me show you what she does — then you tell me what it's worth. Can I have her call you right now?\""],
      ["\"AI will annoy my customers\"", "\"Hear the demo first — everyone's surprised. And a human supervises: what Gui can't solve, she transfers. Your customers prefer Gui at 9 PM over nobody.\""],
      ["\"I already have a receptionist\"", "\"Perfect — Gui doesn't replace her, she covers what a receptionist can't: overnight, weekends, 3 calls at once, follow-up on ghosts.\""],
      ["\"Send me a proposal\"", "\"Will do — personalized. But a proposal without the demo is paper. Give me 15 min this week, Gui calls you, and you'll read the proposal knowing what you're buying.\""],
      ["\"I'll think about it\"", "\"Of course. One question: what would need to be true for this to make sense? ... Then let me show you exactly that in the demo. And remember: 30-day guarantee — the risk is ours.\""],
    ],
    indH: "🏪 What to sell each business (quick cheat sheet)",
    inds: [
      ["🍽️", "Restaurant", "Phone/WhatsApp orders & reservations — never lose the rush again"],
      ["🏥", "Clinic / Medical", "24h booking + reminders that cut no-shows"],
      ["🦷", "Dentist", "Full chair: cleaning recalls + treatment-quote follow-up"],
      ["⚖️", "Law firm", "24h case intake + consult booked on the spot"],
      ["🔧", "Plumber / HVAC", "Emergency answered instantly + quote sent — beat the competitor"],
      ["🏠", "Real estate", "Lead answered in seconds + showing booked"],
      ["💪", "Gym", "Sign-ups + win-back of lapsed members"],
      ["🛒", "E-commerce", "Instant support + cart recovery"],
      ["🚗", "Dealership", "Test drive booked + proposal follow-up"],
    ],
    demoH: "Your secret weapon: the live demo",
    demo: "You don't have to convince anyone — Gui does. In any conversation, offer: \"let the AI call you right now\". She calls, answers as if she were their business, books, sells. The sale practically makes itself.",
    discH: "🔍 The 5 golden questions (discovery — ask BEFORE presenting)",
    discSub: "Whoever asks, leads. These 5 make the owner SEE their own pain — then Guileo becomes the obvious answer.",
    disc: [
      "How many calls do you miss per day — lunch rush, nights, Sundays?",
      "Who answers WhatsApp after you close?",
      "What happens to people who ask for a quote and go quiet?",
      "How many customers never come back because nobody called them back?",
      "If every missed call is worth $50–100… how much leaks per month?",
    ],
    meetH: "📋 The 15-minute meeting script",
    meet: [
      ["0–3 min", "Icebreaker + the 5 golden questions", "Let THEM talk about the pain. Write down the numbers."],
      ["3–5 min", "The sentence + 'let me show you instead of explaining'", "No slides yet. Go straight to the demo."],
      ["5–9 min", "⚡ THE DEMO: Gui calls their phone", "Silence. Let them listen. This moment sells by itself."],
      ["9–12 min", "Show the Growth Cockpit + connect to their pain", "\"Remember the lunch-rush calls? Here you'd see every one answered.\""],
      ["12–15 min", "Next step: proposal + 30-day guarantee", "\"Proposal in your inbox today. In 7 days this runs your business.\""],
    ],
    storyH: "🎬 A real sale, from \"hi\" to paid",
    storySub: "Follow Paula (a brand-new partner) selling to Tony, a pizzeria owner:",
    story: [
      ["Mon, 10:00", "Paula sends the first message to Tony (she's been his customer for years)", "msg"],
      ["Mon, 2:30 PM", "Tony: \"how much?\" — Paula holds the price and offers the demo: \"the AI calls you, you have to hear it\"", "obj"],
      ["Tue, 4:00 PM", "15-min meeting: 5 questions → Tony admits losing ~10 calls/day in the rush", "meet"],
      ["Tue, 4:07 PM", "Gui calls Tony's phone and takes a full order with an upsell. Tony laughs out loud", "demo"],
      ["Tue, 4:15 PM", "Paula shows the Cockpit and locks the next step: \"proposal today\"", "cock"],
      ["Tue, 6:00 PM", "Personalized proposal on WhatsApp: $990 setup + $1,497/mo · recovers ~$3,900/mo", "prop"],
      ["Thu, 9:00 AM", "Tony: \"what if it doesn't work?\" — Paula: \"30-day guarantee, the risk is ours\" → ✅ ACCEPTED", "close"],
      ["7 days later", "System live. Paula earns ~$1,096 commission. Tony becomes her case study for the next client", "win"],
    ],
    s4tag: "Step 5 · Practice",
    s4h: "Train against Gui — she'll be a tough customer",
    s4sub: "Gui plays Marcos, a skeptical restaurant owner. Reply like you would for real. She scores each answer and shows you the ideal one.",
    start: "▶ Start training",
    restart: "↻ Train again",
    send: "Reply",
    placeholder: "Type your reply like it's WhatsApp…",
    scoreH: "Your score",
    pass: "🎉 Approved! You're ready to book for real. Send Luis the screenshot and get your first leads.",
    fail: "Almost! Re-read the ideal answers above and train again — passing is 7+.",
    ideal: "💡 Strong answer:",
    s5tag: "Step 6 · Levels",
    s5h: "Start by booking. Grow by closing.",
    lvl1: { name: "Level 1 · Setter", what: "You prospect and book the demo. Luis closes with you in the room (you learn by watching).", earn: "10% of every closed sale you booked", req: "Requirement: complete this Academy" },
    lvl2: { name: "Level 2 · Closer ⭐", what: "You run the whole sale: demo, proposal, close.", earn: "20% of every closed sale (~$1,096 on a typical package)", req: "Requirement: 3 closed sales as Setter + passing the training" },
    simH: "🧮 Simulate your earnings",
    simDeals: "Closed sales / month",
    simLevel: "Your level",
    simNote: "Basis: typical package $990 setup + $1,497/mo (sale value = setup + 3 months).",
    faqH: "❓ Partner questions (the ones everyone has)",
    faq: [
      ["Do I pay anything to join?", "No. Zero fees, zero monthly. You invest your time; Guileo invests the product, delivery and training."],
      ["Do I need a company / LLC?", "Not to start — you can be paid as an individual per the partnership agreement. We formalize together when you scale."],
      ["When and how do I get paid?", "After the client's payment is confirmed — typically within 7 days. Straight to your account."],
      ["What if the client cancels within the 30-day guarantee?", "Commission is paid on CONFIRMED sales (guarantee passed or client active). On a full refund, commission isn't due — which is why we sell honest."],
      ["Can I sell outside my city?", "Yes — the demo is by phone and delivery is remote. Brazil and the US from day 1."],
      ["Who serves the client after I sell?", "The Guileo team: 7-day implementation, support and ongoing optimization. You keep the relationship (and earn for it), but you don't run the operation."],
      ["I don't get technology. Can I do this?", "Yes — this Academy + the demo do the technical work for you. You need to understand the owner's PAIN, not the code."],
      ["What if they ask something I don't know?", "Standard answer: \"Great question — let me confirm with the team and get back to you today.\" Note it, send it to Luis. Never invent."],
    ],
    glosH: "📖 Quick glossary",
    glos: [
      ["Lead", "an interested person who left contact info"],
      ["Follow-up", "reaching back out to someone who went quiet"],
      ["No-show", "booked and didn't show up"],
      ["Ticket", "average amount a customer spends"],
      ["Setup", "one-time implementation fee"],
      ["MRR", "revenue that repeats every month"],
      ["ICP", "ideal customer profile (who needs it most)"],
      ["Win-back", "reactivating a vanished customer"],
      ["Demo", "live demonstration (Gui calling)"],
      ["Close", "client accepted and paid"],
    ],
    s6tag: "Step 7 · Start",
    s6h: "Your first 7 days",
    week: [
      ["Day 1", "Finish this Academy + pass Gui's training"],
      ["Day 1", "List 5 business owners from your network"],
      ["Day 2", "Send the first message to all 5"],
      ["Day 3-4", "Book 2 demos (use: \"the AI calls you live\")"],
      ["Day 5-7", "Run the demos with Luis · first commission on its way"],
    ],
    kitH: "Your arsenal",
    kit: [["📱 Pocket card", "/cola"], ["🎤 Client pitch", "/pitch"], ["📄 Proposal builder", "/proposta?to=Client&price=1497&recover=3900"], ["🤝 Partner deck", "/parceiro"], ["🎯 Quiz (cold leads)", "/quiz"], ["🧮 Calculator", "/calculator"]],
    cta: "🤝 I'm in — talk to Luis",
    ctaMsg: "Hi Luis! I completed the Partner Academy and want to start as a Setter.",
  },
};

// ── Roleplay engine: Gui plays "Marcos", skeptical restaurant owner. 5 rounds.
// Each partner reply is scored 0–2 by intent keywords (demo-offer, value-first,
// honesty, booking ask). No API: deterministic, instant, free — voice comes later.
const ROUNDS = {
  pt: [
    { gui: "Marcos: Oi… olha, vou ser sincero, tô no meio do almoço aqui, o restaurante tá lotado. Não tenho tempo pra papo de tecnologia, não.", hint: "Objeção: tempo", good: [/15 ?min|rápid|demo|liga(r|ção)| ouvir|terça|quarta|agend/i, /tempo de volta|devolve.*tempo|exatamente por isso/i], ideal: "\"Exatamente por isso te procurei — a Gui atende o telefone enquanto seu salão tá lotado. São 15 minutos e a demo é a IA te ligando. Terça ou quarta?\"" },
    { gui: "Marcos: Hmm… e quanto custa isso aí? Porque se for caro nem perde teu tempo.", hint: "Objeção: preço cedo demais", good: [/antes do preço|antes de falar de preço|primeiro.*mostrar|o que ela faz|vale|demo/i, /\$ ?49|depende do que/i], ideal: "\"Depende do que o seu restaurante precisa — tem desde $49/mês. Mas antes do preço, deixa eu fazer a Gui te ligar — aí você me diz quanto vale nunca mais perder um pedido às 21h.\"" },
    { gui: "Marcos: Robô atendendo meu cliente? Meu público é exigente, isso vai irritar todo mundo e eu vou perder freguês.", hint: "Objeção: medo da IA", good: [/ouv|demo|surpre|liga(r|ção)/i, /humano|supervis|transfere/i, /21h|madrugada|ninguém atende|do que ninguém/i], ideal: "\"Ouve a demo primeiro — todo mundo se surpreende. E tem humano supervisionando: o que a Gui não resolve, ela transfere. Seu freguês prefere a Gui às 21h do que telefone tocando sem ninguém.\"" },
    { gui: "Marcos: Mas eu já tenho a Cida no balcão há 12 anos. Ela atende telefone. Pra que eu preciso disso?", hint: "Objeção: já tem alguém", good: [/não substitui|cobre|complementa|junto com/i, /madrugada|fim de semana|domingo|3 liga|ao mesmo tempo|follow|depois do expediente/i], ideal: "\"A Gui não substitui a Cida — ela cobre o que a Cida não alcança: domingo, 22h, três ligações ao mesmo tempo no rush, e o follow-up de quem pediu uma vez e sumiu.\"" },
    { gui: "Marcos: Tá… me manda uma proposta no WhatsApp então que eu dou uma olhada quando sobrar tempo.", hint: "Fechamento: não deixe esfriar", good: [/demo|liga(r|ção)|15 ?min|essa semana|terça|quarta|quinta|agend|marca/i, /garantia|30 dias|risco/i], ideal: "\"Mando sim — personalizada. Mas proposta sem demo é só papel. Me dá 15 min quinta, a Gui te liga na hora, e você lê a proposta sabendo o que tá comprando. E são 30 dias de garantia — o risco é nosso.\"" },
  ],
  en: [
    { gui: "Marcos: Hey… look, I'll be honest, I'm mid-lunch-rush here, the place is packed. I've got no time for tech talk.", hint: "Objection: time", good: [/15 ?min|quick|demo|call|hear|tuesday|wednesday|book/i, /time back|exactly why/i], ideal: "\"That's exactly why I reached out — Gui answers the phone while your floor is packed. It's 15 minutes and the demo is the AI calling you. Tuesday or Wednesday?\"" },
    { gui: "Marcos: Hmm… how much does it cost? If it's expensive don't waste your time.", hint: "Objection: price too early", good: [/before price|show you first|what she does|worth|demo/i, /\$ ?49|depends on/i], ideal: "\"Depends on what your restaurant needs — starts at $49/mo. But before price, let me have Gui call you — then you tell me what never missing a 9 PM order is worth.\"" },
    { gui: "Marcos: A robot answering my customers? My crowd is picky — this will annoy everyone and I'll lose regulars.", hint: "Objection: AI fear", good: [/hear|demo|surprise|call/i, /human|supervis|transfer/i, /9 ?pm|overnight|nobody answers|over nobody/i], ideal: "\"Hear the demo first — everyone's surprised. And a human supervises: what Gui can't solve, she transfers. Your regulars prefer Gui at 9 PM over a phone ringing with nobody there.\"" },
    { gui: "Marcos: But I've had Cida at the counter for 12 years. She answers the phone. Why would I need this?", hint: "Objection: already covered", good: [/doesn'?t replace|covers|complement|alongside/i, /overnight|weekend|sunday|3 calls|at once|follow|after hours/i], ideal: "\"Gui doesn't replace Cida — she covers what Cida can't: Sunday, 10 PM, three calls at once during the rush, and following up with the customer who ordered once and vanished.\"" },
    { gui: "Marcos: Fine… send me a proposal on WhatsApp and I'll look when I get a minute.", hint: "Close: don't let it cool", good: [/demo|call|15 ?min|this week|tuesday|wednesday|thursday|book/i, /guarantee|30 days|risk/i], ideal: "\"Will do — personalized. But a proposal without the demo is just paper. Give me 15 min Thursday, Gui calls you live, and you'll read it knowing what you're buying. Plus 30-day guarantee — the risk is ours.\"" },
  ],
};

function scoreReply(text, round) {
  const hits = round.good.filter((re) => re.test(text)).length;
  return Math.min(2, hits);
}

function Roleplay({ lang, t }) {
  const rounds = ROUNDS[lang] || ROUNDS.pt;
  const [step, setStep] = useState(-1); // -1 = not started
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const endRef = useRef(null);
  const done = step >= rounds.length;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs]);

  // Marcos "types" before speaking — the sim feels like a real WhatsApp thread.
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const speakGui = (text, after = 0) => {
    timers.current.push(setTimeout(() => {
      setMsgs((m) => [...m, { who: "typing" }]);
      timers.current.push(setTimeout(() => setMsgs((m) => [...m.filter((x) => x.who !== "typing"), { who: "gui", text }]), 850 + Math.min(900, text.length * 6)));
    }, after));
  };
  const begin = () => { timers.current.forEach(clearTimeout); setStep(0); setScore(0); setMsgs([]); setInput(""); speakGui(rounds[0].gui, 150); };
  const reply = () => {
    const text = input.trim();
    if (!text || done) return;
    const r = rounds[step];
    const pts = scoreReply(text, r);
    const next = step + 1;
    setMsgs((m) => [...m, { who: "me", text }]);
    setInput("");
    // feedback lands after a beat, then Marcos types his next line
    timers.current.push(setTimeout(() => {
      setMsgs((m) => [...m, { who: "fb", pts, ideal: r.ideal }]);
      setScore((s) => s + pts);
      setStep(next);
      if (next < rounds.length) speakGui(rounds[next].gui, 500);
    }, 450));
  };

  return (
    <div className="mx-auto mt-8 max-w-2xl overflow-hidden rounded-xl3 border border-g-green/25 bg-white/[0.03] shadow-lift">
      {/* header — Gui as Marcos */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-3.5">
        <div className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-g-green/30 to-g-gold/15 text-lg ring-1 ring-white/15">🌱<span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-g-deep text-[9px] ring-1 ring-g-green/60">🎭</span></div>
        <div>
          <div className="text-[13.5px] font-black text-g-word">Gui {lang === "pt" ? "como" : "as"} “Marcos” <span className="font-semibold text-g-muted">· {lang === "pt" ? "dono de restaurante" : "restaurant owner"}</span></div>
          <div className="text-[11px] font-bold text-g-green">● {lang === "pt" ? "simulação de venda" : "sales simulation"} · {done ? "✓" : `${Math.max(step, 0)}/${rounds.length}`}</div>
        </div>
        {step >= 0 && <div key={score} className="ml-auto rounded-full border border-g-gold/30 bg-g-gold/[0.08] px-3 py-1 text-[12px] font-black text-g-gold" style={{ animation: "apop .5s cubic-bezier(.34,1.56,.64,1) both" }}>{score} pts</div>}
      </div>

      {/* chat */}
      <div className="max-h-[380px] space-y-3 overflow-y-auto px-5 py-4">
        {step === -1 && (
          <div className="py-8 text-center">
            <p className="mx-auto mb-5 max-w-sm text-[13.5px] text-g-muted">{t.s4sub}</p>
            <button onClick={begin} className="btn-gold text-sm">{t.start}</button>
          </div>
        )}
        {msgs.map((m, i) => m.who === "typing" ? (
          <div key={"ty" + i} className="flex justify-start" style={{ animation: "amsg .3s ease both" }}>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3">
              {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 rounded-full bg-g-muted" style={{ animation: `adot 1.1s ease-in-out ${d * 0.18}s infinite` }} />)}
            </div>
          </div>
        ) : m.who === "fb" ? (
          <div key={i} className={`rounded-xl border px-3.5 py-2.5 text-[12px] leading-relaxed ${m.pts === 2 ? "border-g-green/30 bg-g-green/[0.07]" : m.pts === 1 ? "border-g-gold/30 bg-g-gold/[0.06]" : "border-[#d8916e]/30 bg-[#d8916e]/[0.06]"}`} style={{ animation: "amsg .45s cubic-bezier(.2,.7,.2,1) both" }}>
            <span className="inline-block font-black" style={{ animation: "apop .5s cubic-bezier(.34,1.56,.64,1) both" }}>{m.pts === 2 ? "🟢 +2" : m.pts === 1 ? "🟡 +1" : "🔴 +0"}</span>
            <span className="ml-2 text-g-ink">{t.ideal} <span className="italic text-g-word">{m.ideal}</span></span>
          </div>
        ) : (
          <div key={i} className={`flex ${m.who === "me" ? "justify-end" : "justify-start"}`} style={{ animation: "amsg .4s cubic-bezier(.2,.7,.2,1) both" }}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${m.who === "me" ? "rounded-br-md bg-g-green/20 text-g-word" : "rounded-bl-md border border-white/10 bg-white/[0.05] text-g-ink"}`}>{m.text}</div>
          </div>
        ))}
        {done && (
          <div className={`rounded-2xl border border-g-gold/35 bg-g-gold/[0.07] p-5 text-center ${score >= 7 ? "animate-breathe" : ""}`} style={{ animation: score >= 7 ? undefined : "amsg .5s ease both" }}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">{t.scoreH}</div>
            <div className="my-1 text-[40px] font-black text-g-word">{score}<span className="text-lg text-g-muted">/10</span></div>
            <p className="mx-auto max-w-sm text-[13px] text-g-ink">{score >= 7 ? t.pass : t.fail}</p>
            <button onClick={begin} className="btn mt-4 text-sm">{t.restart}</button>
            {score >= 7 && <Certificate lang={lang} score={score} />}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* input */}
      {step >= 0 && !done && (
        <div className="flex gap-2 border-t border-white/10 bg-white/[0.02] p-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && reply()} placeholder={t.placeholder}
            className="min-w-0 flex-1 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2.5 text-[13.5px] text-g-word outline-none placeholder:text-g-muted/60 focus:border-g-green/40" />
          <button onClick={reply} className="btn-bright shrink-0 !px-5 !py-2.5 text-[13px]">{t.send}</button>
        </div>
      )}
    </div>
  );
}

// Earnings simulator: deals/month slider × level (Setter 10% / Closer 20%).
// Sale value = $990 setup + 3 × $1,497 (the locked comp basis).
function EarnSim({ t }) {
  const [deals, setDeals] = useState(4);
  const [closer, setCloser] = useState(true);
  const saleValue = 990 + 1497 * 3;
  const pct = closer ? 0.2 : 0.1;
  const monthly = Math.round(saleValue * pct * deals);
  return (
    <div className="rounded-xl3 border border-g-green/30 bg-white/[0.03] p-6 shadow-lift">
      <div className="text-[13px] font-black text-g-word">{t.simH}</div>
      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between text-[12px] font-bold text-g-muted"><span>{t.simDeals}</span><span className="text-[15px] font-black text-g-word">{deals}</span></div>
            <input type="range" min="1" max="15" value={deals} onChange={(e) => setDeals(+e.target.value)} className="w-full accent-[#3E9468]" />
          </div>
          <div>
            <div className="mb-2 text-[12px] font-bold text-g-muted">{t.simLevel}</div>
            <div className="flex gap-2">
              <button onClick={() => setCloser(false)} className={`rounded-full border px-4 py-1.5 text-[12.5px] font-bold transition ${!closer ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line text-g-muted"}`}>Setter · 10%</button>
              <button onClick={() => setCloser(true)} className={`rounded-full border px-4 py-1.5 text-[12.5px] font-bold transition ${closer ? "border-g-gold/50 bg-g-gold/15 text-g-word" : "border-g-line text-g-muted"}`}>Closer · 20% ⭐</button>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-g-green/10 px-7 py-5 text-center">
          <div key={monthly} className="text-[36px] font-black leading-none text-g-word" style={{ animation: "apop .4s cubic-bezier(.34,1.56,.64,1) both" }}>{money(monthly)}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-g-green">/ {t.simDeals.includes("mês") || t.simDeals.includes("month") ? (t.simDeals.includes("mês") ? "mês" : "month") : "mo"}</div>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-g-muted">{t.simNote}</p>
    </div>
  );
}
const money = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("en-US");

// Shareable certificate — appears on passing (≥7). Name → branded card + WhatsApp
// share + print/PDF. Pride becomes viral recruiting.
function Certificate({ lang, score }) {
  const pt = lang === "pt";
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const today = new Date().toLocaleDateString(pt ? "pt-BR" : "en-US", { day: "numeric", month: "long", year: "numeric" });
  const shareTxt = pt
    ? `🎓 Acabei de me certificar no Guileo Partner Academy com nota ${score}/10! Aprendendo a vender IA que trabalha 24/7. 🌱 guileoai.com/academia`
    : `🎓 Just got certified at the Guileo Partner Academy — scored ${score}/10! Learning to sell AI that works 24/7. 🌱 guileoai.com/academia`;
  if (!show) {
    return (
      <div className="mx-auto mt-5 flex max-w-sm gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && setShow(true)}
          placeholder={pt ? "Seu nome completo" : "Your full name"}
          className="min-w-0 flex-1 rounded-full border border-g-gold/30 bg-white/[0.05] px-4 py-2.5 text-center text-[13.5px] font-bold text-g-word outline-none placeholder:font-normal placeholder:text-g-muted/60 focus:border-g-gold/60" />
        <button onClick={() => name.trim() && setShow(true)} className="btn-gold shrink-0 !px-5 !py-2.5 text-[13px]">🏆 {pt ? "Gerar certificado" : "Get certificate"}</button>
      </div>
    );
  }
  return (
    <div className="mt-6">
      <style>{`@media print{body *{visibility:hidden}.g-cert,.g-cert *{visibility:visible}.g-cert{position:fixed;inset:0;margin:auto}}`}</style>
      <div className="g-cert relative mx-auto max-w-md overflow-hidden rounded-xl3 border border-g-gold/45 bg-gradient-to-b from-[#1d1a14] to-[#14120e] p-8 text-center shadow-lift" style={{ animation: "amsg .6s cubic-bezier(.2,.7,.2,1) both" }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-g-gold to-transparent" />
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-g-gold/10 blur-3xl" />
        <img src={logo} alt="" className="mx-auto h-12 w-12 object-contain drop-shadow-[0_0_22px_rgba(214,194,154,0.45)]" />
        <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.3em] text-g-gold">Guileo Partner Academy</div>
        <div className="mt-4 text-[11px] uppercase tracking-wider text-g-muted">{pt ? "Certificamos que" : "This certifies that"}</div>
        <div className="mt-1 font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.4rem,5vw,1.9rem)" }}>{name}</div>
        <div className="mx-auto my-4 h-px w-24 bg-gradient-to-r from-transparent via-g-gold/60 to-transparent" />
        <p className="mx-auto max-w-xs text-[12.5px] leading-relaxed text-g-ink">
          {pt ? "concluiu o treinamento de vendas Guileo e foi aprovado(a) na simulação ao vivo com a Gui" : "completed the Guileo sales training and passed the live simulation against Gui"}
          <span className="font-black text-g-gold"> · {score}/10</span>
        </p>
        <div className="mt-5 flex items-center justify-between text-[10.5px] text-g-muted">
          <span>{today}</span>
          <span className="font-bold text-g-green">🌱 {pt ? "Pronto pra vender" : "Ready to sell"}</span>
        </div>
      </div>
      <div className="no-print mt-4 flex flex-wrap items-center justify-center gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(shareTxt)}`} target="_blank" rel="noopener" className="btn-bright !px-5 !py-2.5 text-[13px]">💬 {pt ? "Compartilhar" : "Share"}</a>
        <button onClick={() => window.print()} className="btn-ghost !px-5 !py-2.5 text-[13px]">🖨️ {pt ? "Salvar PDF" : "Save PDF"}</button>
        <a href={waLink(pt ? `Oi Luis! Passei no Academy com ${score}/10 — sou ${name}. Bora começar!` : `Hi Luis! Passed the Academy with ${score}/10 — I'm ${name}. Let's start!`)} target="_blank" rel="noopener" className="btn !px-5 !py-2.5 text-[13px]">🤝 {pt ? "Avisar o Luis" : "Tell Luis"}</a>
      </div>
    </div>
  );
}

const Tag = ({ children }) => <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-g-gold">{children}</div>;
const H2 = ({ children }) => <h2 className="max-w-2xl font-black leading-[1.05] tracking-tight text-g-word" style={{ fontSize: "clamp(1.6rem,3.4vw,2.5rem)" }}>{children}</h2>;

// Scroll-reveal (site language): children fade-rise when the block enters view.
// `delay` (ms) staggers siblings; `stagger` mode reveals direct children in cascade.
function Reveal({ children, className = "", delay = 0, stagger = false }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.16 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  if (stagger) {
    return (
      <div ref={ref} className={className}>
        {(Array.isArray(children) ? children : [children]).map((c, i) => (
          <div key={i} style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(20px)", transition: `opacity .65s ease ${i * 0.12}s, transform .65s cubic-bezier(.2,.7,.2,1) ${i * 0.12}s` }}>{c}</div>
        ))}
      </div>
    );
  }
  return <div ref={ref} className={className} style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(22px)", transition: `opacity .7s ease ${delay}ms, transform .7s cubic-bezier(.2,.7,.2,1) ${delay}ms` }}>{children}</div>;
}

// Top scroll progress (green→champagne hairline) + scrollspy: which section is in view.
function useScrollChrome(ids) {
  const [pct, setPct] = useState(0);
  const [active, setActive] = useState("");
  useEffect(() => {
    const onScroll = () => {
      const d = document.documentElement;
      setPct(Math.min(100, (d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight)) * 100));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }), { rootMargin: "-35% 0px -55% 0px" });
    ids.forEach((id) => { const n = document.getElementById(id); if (n) obs.observe(n); });
    return () => { window.removeEventListener("scroll", onScroll); obs.disconnect(); };
  }, []);
  return { pct, active };
}

export default function Academia() {
  const [lang, setLang] = useState("pt");
  const t = T[lang];
  useEffect(() => { document.title = "Guileo Partner Academy"; window.scrollTo(0, 0); }, []);
  const ids = ["entenda", "catalogo", "oferta", "aprenda", "pratique", "niveis", "comece"];
  const { pct, active } = useScrollChrome(ids);

  return (
    <div className="surface-real min-h-screen text-g-ink">
      <style>{`
        @keyframes ashine{to{background-position:220% center}}
        @keyframes amsg{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes apop{0%{transform:scale(.4)}70%{transform:scale(1.18)}100%{transform:scale(1)}}
        @keyframes adot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important;transition-duration:.001ms !important}}
      `}</style>
      <div className="relative z-10">
        {/* top bar — with reading progress + scrollspy */}
        <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#161512]/85 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-white/5"><div className="h-full bg-gradient-to-r from-g-green to-g-gold transition-[width] duration-200" style={{ width: `${pct}%` }} /></div>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
            <a href="/" className="flex items-center gap-2"><img src={logo} alt="Guileo" className="h-7 w-7 object-contain" /><span className="text-sm font-extrabold text-g-word">Guileo <span className="text-g-gold">Academy</span></span></a>
            <nav className="hidden items-center gap-4 md:flex">
              {t.nav.map((n, i) => <a key={n} href={`#${ids[i]}`} className={`text-[12.5px] font-semibold transition ${active === ids[i] ? "text-g-gold" : "text-g-muted hover:text-g-word"}`}>{n}</a>)}
            </nav>
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] p-1">
              {[["pt", "🇧🇷"], ["en", "🇺🇸"]].map(([c, f]) => (
                <button key={c} onClick={() => setLang(c)} aria-pressed={lang === c} className={`h-7 w-7 rounded-full text-sm transition ${lang === c ? "scale-110 bg-g-green/15 ring-1 ring-g-green/30" : "opacity-50 hover:opacity-100"}`}>{f}</button>
              ))}
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="relative overflow-hidden px-5 pb-16 pt-20 text-center">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_420px_at_50%_-10%,rgba(214,194,154,0.10),transparent)]" />
          <Reveal>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-g-gold">🎓 {t.eyebrow}</div>
            <h1 className="mx-auto max-w-3xl font-black leading-[1.02] tracking-tight" style={{ fontSize: "clamp(2rem,5vw,3.6rem)" }}>
              <span className="text-g-word">{t.h1a} </span>
              <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "ashine 7s linear infinite" }}>{t.h1b}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-g-ink">{t.sub}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-g-muted">
              {t.nav.map((n, i) => <a key={n} href={`#${ids[i]}`} className="rounded-full border border-g-line bg-white/[0.04] px-3 py-1.5 transition hover:border-g-green/40 hover:text-g-word">{i + 1}. {n}</a>)}
            </div>
          </Reveal>
        </section>

        <main className="mx-auto max-w-4xl space-y-24 px-5 pb-28">

          {/* 1 — UNDERSTAND */}
          <section id="entenda" className="scroll-mt-24">
            <Reveal><Tag>{t.s1tag}</Tag><H2>{t.s1h}</H2></Reveal>
            <Reveal className="mt-6">
              <blockquote className="rounded-xl3 border border-g-green/25 bg-g-green/[0.05] p-6 text-[17px] font-bold leading-relaxed text-g-word sm:p-7 sm:text-[19px]">“{t.sentence}”</blockquote>
            </Reveal>
            <Reveal className="mt-8">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-g-muted">{t.s1what}</div>
              <Reveal stagger className="grid gap-3 sm:grid-cols-3">
                {t.legs.map(([ic, n, d]) => (
                  <div key={n} className="card h-full !p-5"><div className="text-2xl">{ic}</div><div className="mt-2 text-[14px] font-black text-g-word">{n}</div><p className="mt-1.5 text-[12.5px] leading-relaxed text-g-muted">{d}</p></div>
                ))}
              </Reveal>
              <p className="mt-4 rounded-2xl border border-g-line bg-white/[0.03] p-4 text-[13.5px] leading-relaxed text-g-ink">📊 {t.s1portal}</p>
            </Reveal>
            <Reveal className="mt-8">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-g-gold">{t.honestH}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {t.honest.map(([h, items]) => (
                  <div key={h} className={`rounded-2xl border p-5 ${h.startsWith("✅") ? "border-g-green/25 bg-g-green/[0.05]" : "border-[#d8916e]/25 bg-[#d8916e]/[0.05]"}`}>
                    <div className="text-[13px] font-black text-g-word">{h}</div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-g-ink">{items}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12.5px] italic text-g-muted">{t.honestWhy}</p>
            </Reveal>
          </section>

          {/* 2 — THE CATALOG (full — products, services, credits, Gui's jobs, the Cockpit) */}
          <section id="catalogo" className="scroll-mt-24">
            <Reveal><Tag>{t.scTag}</Tag><H2>{t.scH}</H2><p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-g-ink">{t.scSub}</p></Reveal>

            <Reveal className="mt-8">
              <div className="mb-3 text-[13px] font-black text-g-green">{t.svcH}</div>
            </Reveal>
            <Reveal stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {t.svcs.map(([ic, n, d]) => (
                <div key={n} className="card h-full !p-4"><div className="text-xl">{ic}</div><div className="mt-1.5 text-[13px] font-black text-g-word">{n}</div><p className="mt-1 text-[11.5px] leading-relaxed text-g-muted">{d}</p></div>
              ))}
            </Reveal>

            <Reveal className="mt-8">
              <div className="mb-3 text-[13px] font-black text-g-gold">{t.prodH}</div>
            </Reveal>
            <Reveal stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {t.prods.map(([ic, n, d]) => (
                <div key={n} className="card h-full !p-4"><div className="text-xl">{ic}</div><div className="mt-1.5 text-[13px] font-black text-g-word">{n}</div><p className="mt-1 text-[11.5px] leading-relaxed text-g-muted">{d}</p></div>
              ))}
            </Reveal>

            <Reveal className="mt-8">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl3 border border-g-gold/30 bg-g-gold/[0.05] p-6">
                  <div className="text-[13px] font-black text-g-gold">{t.credH}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-g-ink">{t.cred}</p>
                </div>
                <div className="rounded-xl3 border border-g-line bg-white/[0.03] p-6">
                  <div className="text-[13px] font-black text-g-word">{t.cockH}</div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-g-muted">{t.cock}</p>
                </div>
              </div>
            </Reveal>

            <Reveal className="mt-8">
              <div className="mb-3 text-[13px] font-black text-g-word">{t.guiJobsH}</div>
              <div className="flex flex-wrap gap-2">
                {t.guiJobs.map((j) => <span key={j} className="rounded-full border border-g-green/25 bg-g-green/[0.07] px-3 py-1.5 text-[12.5px] font-bold text-g-light">{j}</span>)}
              </div>
            </Reveal>
          </section>

          {/* 3 — THE OFFER (two tracks) */}
          <section id="oferta" className="scroll-mt-24">
            <Reveal><Tag>{t.s2tag}</Tag><H2>{t.s2h}</H2></Reveal>
            <Reveal className="mt-7">
              <Reveal stagger className="grid gap-4 md:grid-cols-2">
                {[t.trackA, t.trackB].map((tr, i) => (
                  <div key={tr.name} className={`rounded-xl3 border p-6 ${i === 1 ? "border-g-gold/40 bg-g-gold/[0.05] shadow-gold" : "border-g-line bg-white/[0.03]"}`}>
                    <div className={`text-[15px] font-black ${i === 1 ? "text-g-gold" : "text-g-word"}`}>{tr.name}</div>
                    <div className="mt-4 space-y-3 text-[13px] leading-relaxed">
                      <div><span className="font-bold text-g-muted">{lang === "pt" ? "PRA QUEM:" : "FOR WHOM:"}</span> <span className="text-g-ink">{tr.who}</span></div>
                      <div><span className="font-bold text-g-muted">{lang === "pt" ? "O QUE É:" : "WHAT:"}</span> <span className="text-g-ink">{tr.what}</span></div>
                      <div><span className="font-bold text-g-muted">{lang === "pt" ? "VOCÊ GANHA:" : "YOU EARN:"}</span> <span className="font-semibold text-g-green">{tr.you}</span></div>
                    </div>
                    <div className="mt-4 rounded-xl bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-bold text-g-word">💰 {tr.ex}</div>
                  </div>
                ))}
              </Reveal>
              <p className="mt-4 rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-4 text-[13.5px] font-semibold leading-relaxed text-g-word">🎯 {t.trackRule}</p>
            </Reveal>
          </section>

          {/* 3 — LEARN */}
          <section id="aprenda" className="scroll-mt-24">
            <Reveal><Tag>{t.s3tag}</Tag><H2>{t.s3h}</H2></Reveal>
            <Reveal className="mt-7">
              <div className="rounded-xl3 border border-g-line bg-white/[0.03] p-6">
                <div className="text-[13px] font-black text-g-gold">👥 {t.icpH}</div>
                <p className="mt-2 text-[14px] leading-relaxed text-g-ink">{t.icp}</p>
              </div>
            </Reveal>
            <Reveal className="mt-6">
              <div className="mb-3 text-[13px] font-black text-g-word">{t.indH}</div>
            </Reveal>
            <Reveal stagger className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {t.inds.map(([ic, n, d]) => (
                <div key={n} className="flex h-full items-start gap-3 rounded-2xl border border-g-line bg-white/[0.03] p-4 transition hover:border-g-green/30">
                  <span className="text-xl">{ic}</span>
                  <div><div className="text-[13px] font-black text-g-word">{n}</div><p className="mt-0.5 text-[11.5px] leading-relaxed text-g-muted">{d}</p></div>
                </div>
              ))}
            </Reveal>
            <Reveal className="mt-4">
              <div className="rounded-xl3 border border-g-green/25 bg-g-green/[0.04] p-6">
                <div className="text-[13px] font-black text-g-green">💬 {t.msgH}</div>
                <p className="mt-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] p-4 text-[13.5px] italic leading-relaxed text-g-word">{t.msg}</p>
              </div>
            </Reveal>
            <Reveal className="mt-8">
              <div className="mb-3 text-[13px] font-black text-g-word">🛡️ {t.objH}</div>
              <div className="space-y-2.5">
                {t.obj.map(([o, a]) => (
                  <details key={o} className="group rounded-2xl border border-g-line bg-white/[0.03] transition open:border-g-gold/30 open:bg-g-gold/[0.04]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-[13.5px] font-bold text-g-word [&::-webkit-details-marker]:hidden">
                      {o}<span className="text-g-gold transition group-open:rotate-45">＋</span>
                    </summary>
                    <p className="px-5 pb-4 text-[13px] italic leading-relaxed text-g-ink">{a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
            <Reveal className="mt-8">
              <div className="rounded-xl3 border border-g-gold/35 bg-g-gold/[0.06] p-6">
                <div className="text-[13px] font-black text-g-gold">⚡ {t.demoH}</div>
                <p className="mt-2 text-[14px] leading-relaxed text-g-ink">{t.demo}</p>
              </div>
            </Reveal>

            {/* discovery questions — who asks, leads */}
            <Reveal className="mt-8">
              <div className="rounded-xl3 border border-g-green/25 bg-g-green/[0.04] p-6">
                <div className="text-[13px] font-black text-g-green">{t.discH}</div>
                <p className="mt-1.5 text-[12.5px] text-g-muted">{t.discSub}</p>
                <ol className="mt-4 space-y-2.5">
                  {t.disc.map((q, i) => (
                    <li key={i} className="flex items-start gap-3 text-[13.5px] leading-relaxed text-g-word">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-g-green/15 text-[11px] font-black text-g-green ring-1 ring-g-green/30">{i + 1}</span>{q}
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>

            {/* the 15-minute meeting script */}
            <Reveal className="mt-8">
              <div className="mb-3 text-[13px] font-black text-g-word">{t.meetH}</div>
            </Reveal>
            <Reveal stagger className="space-y-2">
              {t.meet.map(([when, what, how], i) => (
                <div key={i} className={`flex flex-col gap-1 rounded-2xl border px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4 ${i === 2 ? "border-g-gold/40 bg-g-gold/[0.06]" : "border-g-line bg-white/[0.03]"}`}>
                  <span className={`w-20 shrink-0 font-mono text-[11px] font-black ${i === 2 ? "text-g-gold" : "text-g-muted"}`}>{when}</span>
                  <span className="text-[13.5px] font-bold text-g-word">{what}</span>
                  <span className="text-[12px] italic text-g-muted sm:ml-auto sm:max-w-[40%] sm:text-right">{how}</span>
                </div>
              ))}
            </Reveal>

            {/* a real sale, narrated start to finish */}
            <Reveal className="mt-10">
              <div className="text-[13px] font-black text-g-word">{t.storyH}</div>
              <p className="mt-1 text-[12.5px] text-g-muted">{t.storySub}</p>
            </Reveal>
            <Reveal stagger className="relative mt-5 space-y-0">
              {t.story.map(([when, what, kind], i) => (
                <div key={i} className="relative flex gap-4 pb-5 pl-1">
                  {i < t.story.length - 1 && <span className="absolute left-[15px] top-7 h-full w-px bg-gradient-to-b from-g-green/40 to-g-gold/20" />}
                  <span className={`relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] ring-1 ${kind === "win" ? "bg-g-gold/20 ring-g-gold/50" : kind === "demo" ? "bg-g-green/20 ring-g-green/50" : "bg-white/[0.05] ring-white/15"}`}>
                    {{ msg: "💬", obj: "🛡️", meet: "🤝", demo: "📞", cock: "📟", prop: "📄", close: "✅", win: "💰" }[kind]}
                  </span>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">{when}</div>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-g-ink">{what}</p>
                  </div>
                </div>
              ))}
            </Reveal>
          </section>

          {/* 4 — PRACTICE (roleplay) */}
          <section id="pratique" className="scroll-mt-24">
            <Reveal><Tag>{t.s4tag}</Tag><H2>{t.s4h}</H2></Reveal>
            <Reveal><Roleplay lang={lang} t={t} /></Reveal>
          </section>

          {/* 5 — LEVELS */}
          <section id="niveis" className="scroll-mt-24">
            <Reveal><Tag>{t.s5tag}</Tag><H2>{t.s5h}</H2></Reveal>
            <Reveal className="mt-7">
              <Reveal stagger className="grid gap-4 md:grid-cols-2">
                {[t.lvl1, t.lvl2].map((l, i) => (
                  <div key={l.name} className={`relative rounded-xl3 border p-6 ${i === 1 ? "border-g-gold/40 bg-g-gold/[0.05] shadow-gold" : "border-g-green/25 bg-white/[0.03]"}`}>
                    <div className={`text-[15px] font-black ${i === 1 ? "text-g-gold" : "text-g-green"}`}>{l.name}</div>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-g-ink">{l.what}</p>
                    <div className="mt-4 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-[13.5px] font-black text-g-word">💰 {l.earn}</div>
                    <div className="mt-3 text-[11.5px] font-bold uppercase tracking-wide text-g-muted">🔓 {l.req}</div>
                  </div>
                ))}
              </Reveal>
            </Reveal>
            {/* earnings simulator — slider × level */}
            <Reveal className="mt-6">
              <EarnSim t={t} />
            </Reveal>
          </section>

          {/* 6 — ACT */}
          <section id="comece" className="scroll-mt-24">
            <Reveal><Tag>{t.s6tag}</Tag><H2>{t.s6h}</H2></Reveal>
            <Reveal className="mt-7">
              <Reveal stagger className="space-y-2">
                {t.week.map(([d, w], i) => (
                  <div key={i} className="flex items-center gap-4 rounded-2xl border border-g-line bg-white/[0.03] px-5 py-3.5 transition hover:border-g-green/30">
                    <span className="w-16 shrink-0 text-[11px] font-black uppercase tracking-wide text-g-gold">{d}</span>
                    <span className="text-[13.5px] font-semibold text-g-word">{w}</span>
                    <span className="ml-auto text-g-green">✓</span>
                  </div>
                ))}
              </Reveal>
            </Reveal>
            {/* partner FAQ */}
            <Reveal className="mt-10">
              <div className="mb-3 text-[13px] font-black text-g-word">{t.faqH}</div>
            </Reveal>
            <Reveal stagger className="space-y-2.5">
              {t.faq.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-g-line bg-white/[0.03] transition open:border-g-green/30 open:bg-g-green/[0.03]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-[13.5px] font-bold text-g-word [&::-webkit-details-marker]:hidden">
                    {q}<span className="text-g-green transition group-open:rotate-45">＋</span>
                  </summary>
                  <p className="px-5 pb-4 text-[13px] leading-relaxed text-g-ink">{a}</p>
                </details>
              ))}
            </Reveal>

            {/* glossary */}
            <Reveal className="mt-10">
              <div className="mb-3 text-[13px] font-black text-g-word">{t.glosH}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {t.glos.map(([term, def]) => (
                  <div key={term} className="flex items-baseline gap-2 rounded-xl border border-g-line bg-white/[0.03] px-4 py-2.5">
                    <span className="shrink-0 text-[12.5px] font-black text-g-gold">{term}</span>
                    <span className="text-[12px] leading-snug text-g-muted">— {def}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal className="mt-10">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-g-muted">{t.kitH}</div>
              <div className="flex flex-wrap gap-2">
                {t.kit.map(([n, href]) => (
                  <a key={n} href={href} target="_blank" rel="noreferrer" className="rounded-full border border-g-line bg-white/[0.04] px-4 py-2 text-[13px] font-bold text-g-word transition hover:border-g-green/40 hover:text-g-green">{n}</a>
                ))}
              </div>
            </Reveal>
            <Reveal className="mt-10 text-center">
              <a href={waLink(t.ctaMsg)} target="_blank" rel="noopener" className="btn-gold text-base">{t.cta}</a>
              <p className="mt-4 text-[12px] text-g-muted">Guileo · Tribeca Global Inc. · {lang === "pt" ? "comissões pagas por venda fechada" : "commissions paid per closed sale"}</p>
            </Reveal>
          </section>

        </main>
      </div>
    </div>
  );
}
