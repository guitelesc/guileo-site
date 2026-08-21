// 🚨 ENDEREÇO QUEIMADO EM 2026-08-20 — POR QUE ESTE ARQUIVO MUDOU DE HASH.
// Conferi `/assets/pitchCards-<hash>.js` em produção ANTES do deploy terminar de propagar. O
// caminho ainda não existia, o Pages respondeu com o index.html da SPA (200, text/html), e o
// `public/_headers` marca /assets/* como `immutable` — o Cloudflare congelou esse HTML naquele
// endereço. Resultado: o navegador pediu o módulo, recebeu HTML, o import quebrou e o HUB DO
// VENDEDOR ficou com a tela preta em produção.
// A LIÇÃO: conferir cedo demais NÃO é neutro. O curl CRIA a entrada de cache. Com `immutable`,
// verificar um endereço antes da hora é o mesmo que destruí-lo.
// Só se conferem assets DEPOIS do deploy responder, e sempre pelo caminho que o navegador usa.
// Pitch-card library for the Guileo seller hub. Voice: problem→solution→gain→beat-competition,
// consultative + non-aggressive. Each niche reuses Guileo's real capabilities only. PT/EN/ES.
// The "universal" master card + newest cards pull THE sentence and the objection killers
// straight from salesKit.js — one source, zero copy drift.

import { MASTER_SENTENCE, OBJECTION_KILLERS } from "./salesKit.js";

const killer = (id) => OBJECTION_KILLERS.find((o) => o.id === id);
const K_EXPENSIVE = killer("too_expensive");
const K_WRONG = killer("wrong_order");
const K_LATER = killer("later");

export const PITCH_NICHES = [
  { id: "universal",   emoji: "🌱", name: { pt: "Pitch mestre · qualquer negócio", en: "Master pitch · any business", es: "Pitch maestro · cualquier negocio" } },
  { id: "ads",         emoji: "📣", name: { pt: "Anúncios · vender RESULTADO", en: "Ads · sell the RESULT", es: "Anuncios · vender RESULTADO" } },
  { id: "website",     emoji: "🖥️", name: { pt: "Site · a casa que vende sozinha", en: "Website · the house that sells itself", es: "Sitio · la casa que vende sola" } },
  { id: "app",         emoji: "📱", name: { pt: "App · o ícone na tela do cliente", en: "App · the icon on the customer's screen", es: "App · el ícono en la pantalla del cliente" } },
  { id: "store",       emoji: "🛒", name: { pt: "Loja online · receber sem estar lá", en: "Online store · get paid without being there", es: "Tienda online · cobrar sin estar" } },
  { id: "automation",  emoji: "⚙️", name: { pt: "Automação · o trabalho que some", en: "Automation · the work that disappears", es: "Automatización · el trabajo que desaparece" } },
  { id: "restaurant",  emoji: "🍽️", name: { pt: "Restaurantes",       en: "Restaurants",        es: "Restaurantes" } },
  { id: "dental",      emoji: "🦷", name: { pt: "Consultórios odontológicos", en: "Dental offices", es: "Consultorios dentales" } },
  { id: "clinic",      emoji: "🩺", name: { pt: "Clínicas",            en: "Clinics",            es: "Clínicas" } },
  { id: "salon",       emoji: "💇", name: { pt: "Salões e barbearias", en: "Salons & barbers",   es: "Salones y barberías" } },
  { id: "homeservices",emoji: "🔧", name: { pt: "Serviços residenciais", en: "Home services",    es: "Servicios para el hogar" } },
  { id: "realestate",  emoji: "🏠", name: { pt: "Imobiliárias",        en: "Real estate",        es: "Inmobiliarias" } },
  { id: "law",         emoji: "⚖️", name: { pt: "Advocacia",           en: "Law firms",          es: "Abogados" } },
  { id: "autorepair",  emoji: "🚗", name: { pt: "Oficinas",            en: "Auto repair",        es: "Talleres mecánicos" } },
  { id: "fitness",     emoji: "🏋️", name: { pt: "Academias e estúdios", en: "Gyms & studios",    es: "Gimnasios y estudios" } },
  { id: "vet",         emoji: "🐾", name: { pt: "Veterinários",        en: "Veterinary",         es: "Veterinarios" } },
  { id: "spa",         emoji: "💆", name: { pt: "Spas",                en: "Spas",               es: "Spas" } },
  { id: "retail",      emoji: "🛍️", name: { pt: "Comércio e lojas",    en: "Retail & shops",     es: "Comercio y tiendas" } },
  { id: "cafe",        emoji: "☕", name: { pt: "Cafés e food trucks", en: "Cafés & food trucks", es: "Cafés y food trucks" } },
  { id: "cleaning",    emoji: "🧹", name: { pt: "Empresas de limpeza", en: "Cleaning companies",  es: "Empresas de limpieza" } },
];

export const PITCH_CARDS = {
  // ── MASTER CARD — works for ANY business; the solution IS the master sentence. ──
  universal: {
    pain: {
      pt: "Toda vez que o telefone toca e ninguém atende — almoço, noite, domingo — um cliente que já tinha decidido comprar vai pro concorrente.",
      en: "Every time the phone rings and no one picks up — lunch, night, Sunday — a customer who had already decided to buy goes to a competitor.",
      es: "Cada vez que suena el teléfono y nadie contesta — almuerzo, noche, domingo — un cliente que ya había decidido comprar se va al competidor.",
    },
    leak: {
      pt: "20–30 ligações perdidas por mês, a $50–100 cada: mais de $2.000/mês saindo pela porta sem ninguém somar.",
      en: "20–30 missed calls a month at $50–100 each: over $2,000/mo walking out the door with nobody adding it up.",
      es: "20–30 llamadas perdidas al mes, a $50–100 cada una: más de $2.000/mes saliendo por la puerta sin que nadie lo sume.",
    },
    solution: MASTER_SENTENCE,
    gain: [
      { pt: "Toda ligação atendida — 24/7, em inglês, português e espanhol", en: "Every call answered — 24/7, in English, Portuguese and Spanish", es: "Cada llamada contestada — 24/7, en inglés, portugués y español" },
      { pt: "Venda fechada é venda PAGA: link de pagamento por SMS na própria ligação", en: "A closed sale is a PAID sale: pay-link by SMS on the call itself", es: "Venta cerrada es venta PAGADA: link de pago por SMS en la misma llamada" },
      { pt: "Tudo visível no painel: cada ligação, transcrição e agendamento", en: "Everything visible in the dashboard: every call, transcript and booking", es: "Todo visible en el panel: cada llamada, transcripción y reserva" },
    ],
    edge: {
      pt: "Enquanto o concorrente deixa cair na caixa postal, o seu negócio atende, vende e recebe o pagamento — de madrugada, no domingo, sempre.",
      en: "While the competitor lets it hit voicemail, your business answers, sells and gets paid — at 2am, on Sunday, always.",
      es: "Mientras el competidor lo deja caer al buzón, tu negocio contesta, vende y cobra — de madrugada, el domingo, siempre.",
    },
    opener: {
      pt: "Posso te fazer uma pergunta rápida? Quantas ligações você acha que o seu negócio perde por mês — e quanto vale cada uma?",
      en: "Can I ask you something quick? How many calls do you figure your business misses a month — and what's each one worth?",
      es: "¿Te puedo hacer una pregunta rápida? ¿Cuántas llamadas crees que pierde tu negocio al mes — y cuánto vale cada una?",
    },
    discovery: [
      { pt: "Quem atende o telefone hoje quando você fecha — e o que acontece com quem liga?", en: "Who answers the phone today after you close — and what happens to the caller?", es: "¿Quién contesta el teléfono hoy cuando cierras — y qué pasa con quien llama?" },
      { pt: "Se cada ligação perdida vale $50–100, quanto isso vira por mês?", en: "If each missed call is worth $50–100, what does that add up to per month?", es: "Si cada llamada perdida vale $50–100, ¿cuánto suma eso al mes?" },
    ],
    objection: {
      q: { pt: K_EXPENSIVE.q.pt, en: K_EXPENSIVE.q.en, es: K_EXPENSIVE.q.es },
      a: { pt: K_EXPENSIVE.a.pt, en: K_EXPENSIVE.a.en, es: K_EXPENSIVE.a.es },
    },
  },

  // ── ANÚNCIOS — a carta que o vendedor usa para vender RESULTADO, não anúncio ──────────────
  // Existe porque o motor de anúncios é metade do produto e ninguém sabia explicar. A dor aqui
  // não é "preciso de anúncio" — é "já gastei e não sei se voltou", que TODO dono de negócio
  // local já viveu. A vantagem que se vende é estrutural, não uma tela mais bonita: Google e
  // Meta enxergam cliques, o dono enxerga faturamento, e o elo do meio é o TELEFONE — que
  // nenhuma plataforma de anúncio vê e a Gui atende.
  ads: {
    pain: {
      pt: "Você já pagou anúncio e ficou sem saber se voltou. A agência mandou um relatório cheio de cliques e impressões, e nenhum deles paga a conta de luz.",
      en: "You've paid for ads and never knew if it came back. The agency sent a report full of clicks and impressions — and none of them pay the light bill.",
      es: "Ya pagaste anuncios y nunca supiste si volvió. La agencia mandó un informe lleno de clics e impresiones, y ninguno paga la luz.",
    },
    leak: {
      pt: "Sem saber qual anúncio traz cliente de verdade, você corta o que estava funcionando e continua pagando o que não traz — os dois erros ao mesmo tempo.",
      en: "Without knowing which ad brings real customers, you cut the one that was working and keep paying the one that isn't — both mistakes at once.",
      es: "Sin saber qué anuncio trae clientes reales, cortas el que funcionaba y sigues pagando el que no — los dos errores a la vez.",
    },
    solution: {
      pt: "O Google e a Meta sabem cliques. Você sabe faturamento. Ninguém liga os dois porque no meio está o TELEFONE — e é ele que a Gui atende. A gente mostra, por campanha: gastou X, entraram tantos clientes, agendaram tanto. Cada $1 virou quanto.",
      en: "Google and Meta know clicks. You know revenue. Nobody connects them because the PHONE sits in the middle — and that's what Gui answers. We show you, per campaign: you spent X, this many customers came in, this much got booked. What each $1 turned into.",
      es: "Google y Meta saben clics. Tú sabes facturación. Nadie los conecta porque en medio está el TELÉFONO — y eso es lo que Gui contesta. Te mostramos, por campaña: gastaste X, entraron tantos clientes, reservaron tanto. En cuánto se convirtió cada $1.",
    },
    gain: [
      { pt: "Cada campanha com o seu próprio número: quem liga do anúncio já chega identificado", en: "Each campaign gets its own number: whoever calls from the ad arrives identified", es: "Cada campaña con su propio número: quien llama del anuncio llega identificado" },
      { pt: "Aviso ANTES do prejuízo: se uma campanha começa a queimar, você sabe na segunda — não no fim do mês", en: "A warning BEFORE the loss: if a campaign starts burning, you know on Monday — not at month's end", es: "Aviso ANTES de la pérdida: si una campaña empieza a quemar, lo sabes el lunes — no a fin de mes" },
      { pt: "E o contrário também: quando uma campanha paga 3× ou mais, a gente avisa para aumentar", en: "And the reverse: when a campaign pays 3× or more, we tell you to scale it", es: "Y al revés: cuando una campaña paga 3× o más, te avisamos para aumentar" },
    ],
    edge: {
      pt: "Qualquer agência mostra relatório. A gente atende a ligação que o anúncio gerou — por isso conseguimos dizer quanto voltou em dinheiro, e não quantos cliques deu. Nenhuma ferramenta de anúncio consegue fazer essa conta sozinha.",
      en: "Any agency shows a report. We answer the call the ad generated — that's why we can tell you how much came back in money, not how many clicks. No ad tool can do that math on its own.",
      es: "Cualquier agencia muestra un informe. Nosotros contestamos la llamada que el anuncio generó — por eso podemos decirte cuánto volvió en dinero, no cuántos clics. Ninguna herramienta de anuncios puede hacer esa cuenta sola.",
    },
    opener: {
      pt: "Uma pergunta: da última vez que você investiu em anúncio, alguém conseguiu te dizer quantos CLIENTES aquilo trouxe — não cliques, clientes?",
      en: "One question: last time you spent on ads, could anyone tell you how many CUSTOMERS it brought — not clicks, customers?",
      es: "Una pregunta: la última vez que invertiste en anuncios, ¿alguien pudo decirte cuántos CLIENTES trajo — no clics, clientes?",
    },
    discovery: [
      { pt: "Quanto você investe em anúncio por mês hoje — e como você sabe se valeu?", en: "How much do you spend on ads a month today — and how do you know if it was worth it?", es: "¿Cuánto inviertes en anuncios al mes hoy — y cómo sabes si valió?" },
      { pt: "Quando alguém liga por causa de um anúncio, alguém anota de onde veio?", en: "When someone calls because of an ad, does anyone note where they came from?", es: "Cuando alguien llama por un anuncio, ¿alguien anota de dónde vino?" },
      { pt: "Já cortou alguma campanha sem ter certeza se ela estava dando certo?", en: "Have you ever cut a campaign without being sure it wasn't working?", es: "¿Alguna vez cortaste una campaña sin estar seguro de que no funcionaba?" },
    ],
    objection: {
      // A objeção REAL deste produto não é preço — é desconfiança, e ela é merecida.
      q: { pt: "Já me prometeram isso e o relatório era enfeitado. Como sei que o número é real?",
           en: "I've been promised this before and the report was dressed up. How do I know the number is real?",
           es: "Ya me prometieron esto y el informe estaba maquillado. ¿Cómo sé que el número es real?" },
      a: { pt: "Justo — e é por isso que quando a gente NÃO sabe, o painel diz que não sabe, em vez de mostrar zero. Se o gasto de uma campanha não foi lançado, o retorno dela aparece em branco com o motivo. E o número de clientes não é estimativa: é agendamento que existe na sua agenda, com nome e horário. Você pode conferir um por um.",
           en: "Fair — and that's why when we DON'T know, the dashboard says so instead of showing zero. If a campaign's spend wasn't entered, its return shows blank with the reason. And the customer count isn't an estimate: it's a booking that exists in your calendar, with a name and a time. You can check them one by one.",
           es: "Justo — por eso cuando NO sabemos, el panel lo dice en vez de mostrar cero. Si no se cargó el gasto de una campaña, su retorno aparece en blanco con el motivo. Y el número de clientes no es estimación: es una reserva que existe en tu agenda, con nombre y hora. Puedes verificarlas una por una." },
    },
  },

  // ── AS QUATRO CARTAS DO PILAR BUILD (2026-08-20) ────────────────────────────────────────────
  // Existiam 16 cartas e só DUAS eram por produto (voz e anúncios). O vendedor sabia vender a Gui
  // e não sabia abrir a boca sobre site, app, loja e automação — metade do catálogo, sem argumento.
  //
  // 🚨 REGRA DE HONESTIDADE DESTE BLOCO: cada linha aqui é o que `productSystem.js` entrega DE
  // VERDADE hoje, e o que é projeto à parte está dito como projeto à parte, com o preço real de
  // `services.js`. Prometer app de loja dentro do plano é reembolso marcado; dizer que o nativo é
  // separado transforma a mesma frase num upsell. Preço sempre em dólar.
  website: {
    pain: {
      pt: "Seu cliente pesquisa você no celular antes de ligar. Se acha um site que demora, sem preço e sem horário, ele volta pro Google e clica no concorrente — e você nunca fica sabendo que ele existiu.",
      en: "Your customer looks you up on their phone before calling. If they find a slow site with no prices and no hours, they go back to Google and tap the competitor — and you never learn they existed.",
      es: "Tu cliente te busca en el celular antes de llamar. Si encuentra un sitio lento, sin precios y sin horarios, vuelve a Google y toca al competidor — y nunca te enteras de que existió.",
    },
    leak: {
      pt: "É a perda que ninguém consegue contar: não entra como ligação perdida, não aparece em lugar nenhum. Some.",
      en: "It is the loss nobody can count: it does not show up as a missed call, it shows up nowhere. It just vanishes.",
      es: "Es la pérdida que nadie puede contar: no entra como llamada perdida, no aparece en ningún lado. Desaparece.",
    },
    solution: {
      pt: "A gente gera o seu site a partir do que você já nos contou — seu nome, seus serviços, seus preços, seus horários — e a Gui fica atendendo dentro dele. Você edita no seu painel, sem depender de ninguém.",
      en: "We generate your site from what you already told us — your name, your services, your prices, your hours — with Gui answering inside it. You edit it in your dashboard, without depending on anyone.",
      es: "Generamos tu sitio con lo que ya nos contaste — tu nombre, tus servicios, tus precios, tus horarios — con Gui atendiendo adentro. Lo editas en tu panel, sin depender de nadie.",
    },
    gain: [
      { pt: "Preço e horário na tela: quem chega já sabe, e liga decidido", en: "Prices and hours on screen: whoever arrives already knows, and calls decided", es: "Precio y horario en pantalla: quien llega ya sabe, y llama decidido" },
      { pt: "A Gui atende DENTRO do site — visita vira conversa, não vira saída", en: "Gui answers INSIDE the site — a visit becomes a conversation, not an exit", es: "Gui atiende DENTRO del sitio — la visita se vuelve conversación, no salida" },
      { pt: "Você mesmo muda preço e serviço no painel, no mesmo dia", en: "You change prices and services yourself in the dashboard, same day", es: "Tú mismo cambias precio y servicio en el panel, el mismo día" },
    ],
    edge: {
      pt: "O concorrente tem um site parado que ninguém atualiza há dois anos. O seu responde perguntas e agenda enquanto ele dorme.",
      en: "The competitor has a frozen site nobody has updated in two years. Yours answers questions and books while he sleeps.",
      es: "El competidor tiene un sitio congelado que nadie actualiza hace dos años. El tuyo responde preguntas y agenda mientras él duerme.",
    },
    opener: {
      pt: "Deixa eu te perguntar: quando alguém procura o seu negócio no celular agora, o que aparece — e dá pra ver o preço?",
      en: "Let me ask you: when someone looks your business up on their phone right now, what shows up — and can they see the price?",
      es: "Déjame preguntarte: cuando alguien busca tu negocio en el celular ahora, ¿qué aparece — y se ve el precio?",
    },
    discovery: [
      { pt: "Quem mexe no seu site hoje quando muda um preço — e quanto tempo demora?", en: "Who touches your site today when a price changes — and how long does it take?", es: "¿Quién toca tu sitio hoy cuando cambia un precio — y cuánto tarda?" },
      { pt: "Quantas pessoas você acha que abrem seu site por semana sem nunca ligar?", en: "How many people do you figure open your site each week and never call?", es: "¿Cuánta gente crees que abre tu sitio cada semana y nunca llama?" },
    ],
    objection: { q: { pt: K_LATER.q.pt, en: K_LATER.q.en, es: K_LATER.q.es }, a: { pt: K_LATER.a.pt, en: K_LATER.a.en, es: K_LATER.a.es } },
  },

  app: {
    pain: {
      pt: "Pra te achar de novo, seu cliente precisa lembrar do seu nome, digitar no Google e passar por três concorrentes que pagaram anúncio antes de chegar em você.",
      en: "To find you again, your customer has to remember your name, type it into Google, and walk past three competitors who paid for ads before reaching you.",
      es: "Para encontrarte de nuevo, tu cliente tiene que recordar tu nombre, escribirlo en Google y pasar por tres competidores que pagaron anuncios antes de llegar a ti.",
    },
    leak: {
      pt: "Cliente fiel se perde na busca. Você paga anúncio pra reconquistar quem já era seu.",
      en: "A loyal customer gets lost in search. You pay for ads to win back someone who was already yours.",
      es: "El cliente fiel se pierde en la búsqueda. Pagas anuncios para reconquistar a quien ya era tuyo.",
    },
    solution: {
      pt: "Seu negócio vira um app na tela inicial do cliente: seu nome, seu ícone, abrindo sem barra de navegador. É gerado pra você — sem fila de aprovação de loja, sem espera. Ele te acha num toque.",
      en: "Your business becomes an app on the customer's home screen: your name, your icon, opening with no browser bar. It is generated for you — no store review queue, no waiting. They find you in one tap.",
      es: "Tu negocio se vuelve una app en la pantalla de inicio del cliente: tu nombre, tu ícono, abriendo sin barra de navegador. Se genera para ti — sin cola de revisión de tienda, sin esperar. Te encuentra en un toque.",
    },
    gain: [
      { pt: "Seu ícone na tela dele, do lado do WhatsApp — lembrança sem pagar anúncio", en: "Your icon on their screen, next to WhatsApp — recall without paying for ads", es: "Tu ícono en su pantalla, al lado de WhatsApp — recuerdo sin pagar anuncios" },
      { pt: "Agenda e pedido a um toque, com a Gui dentro", en: "Booking and ordering one tap away, with Gui inside", es: "Agenda y pedido a un toque, con Gui adentro" },
      { pt: "No ar hoje — não depende de aprovação da Apple nem do Google", en: "Live today — it does not wait on Apple or Google approval", es: "En el aire hoy — no depende de aprobación de Apple ni de Google" },
    ],
    edge: {
      pt: "Nenhum concorrente do seu tamanho tem app. Não porque não querem: porque acham que custa $10 mil e seis meses.",
      en: "No competitor your size has an app. Not because they don't want one: because they think it costs $10k and six months.",
      es: "Ningún competidor de tu tamaño tiene app. No porque no quieran: porque creen que cuesta $10 mil y seis meses.",
    },
    opener: {
      pt: "Você já imaginou o seu negócio como um ícone na tela do celular do seu cliente — do lado do WhatsApp?",
      en: "Have you ever pictured your business as an icon on your customer's phone screen — right next to WhatsApp?",
      es: "¿Alguna vez imaginaste tu negocio como un ícono en la pantalla del celular de tu cliente — al lado de WhatsApp?",
    },
    discovery: [
      { pt: "Quantos dos seus clientes voltam sozinhos, sem você gastar pra lembrar deles?", en: "How many of your customers come back on their own, without you spending to remind them?", es: "¿Cuántos de tus clientes vuelven solos, sin que gastes para recordarles?" },
      { pt: "Se ele te achasse num toque, quantas vezes a mais ele te procuraria por mês?", en: "If they found you in one tap, how many more times a month would they reach out?", es: "Si te encontrara en un toque, ¿cuántas veces más al mes te buscaría?" },
    ],
    // ⚠️ A HONESTIDADE É O ARGUMENTO: o que entra no plano é o app instalável. O app NATIVO
    // publicado na App Store e na Play Store é projeto à parte — $6.000 a $20.000, `services.js`.
    // Dizer isso ANTES do cliente perguntar é o que transforma promessa quebrada em upsell.
    objection: {
      q: { pt: "Isso é um app de verdade, daqueles da App Store?", en: "Is this a real app, the App Store kind?", es: "¿Esto es una app de verdad, de las de App Store?" },
      a: {
        pt: "Pergunta certa, e vou ser reto: o que entra no seu plano é o app instalável — o cliente aperta 'adicionar à tela inicial' e ele fica lá com o seu ícone, abrindo sem barra de navegador. Faz tudo que agenda, pede e paga, e está no ar hoje. App nativo publicado nas duas lojas é outro projeto, de $6.000 a $20.000, e a gente faz quando fizer sentido pra você. Eu prefiro te entregar o que funciona esta semana.",
        en: "Fair question, and I'll be straight: what your plan includes is the installable app — the customer taps 'add to home screen' and it sits there with your icon, opening without a browser bar. It books, orders and takes payment, and it's live today. A native app published on both stores is a separate project, $6,000 to $20,000, and we build that when it makes sense for you. I'd rather hand you what works this week.",
        es: "Buena pregunta, y voy directo: lo que incluye tu plan es la app instalable — el cliente toca 'agregar a pantalla de inicio' y queda ahí con tu ícono, abriendo sin barra de navegador. Agenda, pide y cobra, y está en el aire hoy. Una app nativa publicada en ambas tiendas es otro proyecto, de $6.000 a $20.000, y lo hacemos cuando tenga sentido para ti. Prefiero entregarte lo que funciona esta semana.",
      },
    },
  },

  store: {
    pain: {
      pt: "Você só recebe quando está lá. Fechou a porta, acabou o dinheiro do dia — e quem quis comprar às dez da noite não tinha como te pagar.",
      en: "You only get paid when you're there. Door closed, day's money over — and whoever wanted to buy at ten at night had no way to pay you.",
      es: "Solo cobras cuando estás ahí. Puerta cerrada, se acabó el dinero del día — y quien quiso comprar a las diez de la noche no tenía cómo pagarte.",
    },
    leak: {
      pt: "Todo 'depois eu passo aí pra pagar' que nunca acontece é uma venda que você já tinha ganhado e perdeu.",
      en: "Every \"I'll swing by later to pay\" that never happens is a sale you had already won and lost.",
      es: "Cada \"después paso a pagar\" que nunca ocurre es una venta que ya habías ganado y perdiste.",
    },
    solution: {
      pt: "Seu catálogo com preço e link de pagamento no ar: pacote, assinatura e gift card. O dinheiro cai no SEU Stripe desde o dia um — não passa pela nossa conta.",
      en: "Your priced catalog with pay links live: packages, memberships and gift cards. The money lands in YOUR Stripe from day one — it never passes through our account.",
      es: "Tu catálogo con precio y enlace de pago en el aire: paquetes, membresías y gift cards. El dinero llega a TU Stripe desde el día uno — no pasa por nuestra cuenta.",
    },
    gain: [
      { pt: "Recebe de madrugada e no domingo, sem você estar lá", en: "Get paid at 2am and on Sunday, without you being there", es: "Cobras de madrugada y el domingo, sin estar ahí" },
      { pt: "Pacote e assinatura: o cliente paga várias vezes de uma vez só", en: "Packages and memberships: the customer pays for many visits at once", es: "Paquete y membresía: el cliente paga varias veces de una vez" },
      { pt: "Na própria ligação a Gui manda o link e fecha — venda fechada é venda PAGA", en: "On the call itself Gui sends the link and closes — a closed sale is a PAID sale", es: "En la misma llamada Gui manda el link y cierra — venta cerrada es venta PAGADA" },
    ],
    edge: {
      pt: "O concorrente ainda anota no caderno e cobra depois. Você já recebeu antes do cliente chegar na porta.",
      en: "The competitor still writes it in a notebook and collects later. You've already been paid before the customer reaches the door.",
      es: "El competidor todavía anota en el cuaderno y cobra después. Tú ya cobraste antes de que el cliente llegue a la puerta.",
    },
    opener: {
      pt: "Quando o cliente decide comprar de você às dez da noite, ele consegue te pagar naquela hora?",
      en: "When a customer decides to buy from you at ten at night, can they actually pay you right then?",
      es: "Cuando el cliente decide comprarte a las diez de la noche, ¿puede pagarte en ese momento?",
    },
    discovery: [
      { pt: "Quanto do seu faturamento é 'eu pago quando eu for aí'?", en: "How much of your revenue is \"I'll pay when I come by\"?", es: "¿Cuánto de tu facturación es \"pago cuando pase\"?" },
      { pt: "Se o cliente pudesse pagar três visitas de uma vez, quantos topariam?", en: "If a customer could pay for three visits at once, how many would take it?", es: "Si el cliente pudiera pagar tres visitas de una vez, ¿cuántos aceptarían?" },
    ],
    // Loja completa com estoque, frete e variação de produto é projeto à parte ($2.200–$6.000).
    objection: {
      q: { pt: "E se eu precisar de estoque, frete, tamanho e cor?", en: "What if I need inventory, shipping, size and color?", es: "¿Y si necesito inventario, envío, talla y color?" },
      a: {
        pt: "Aí a gente está falando de loja completa, e isso é um projeto à parte — de $2.200 a $6.000, feito sob medida. O que entra no seu plano já vende serviço, pacote e gift card com pagamento no seu Stripe. Meu conselho: começa cobrando pelo que já dá pra cobrar esta semana, e a loja completa a gente monta quando o volume pedir.",
        en: "Then we're talking about a full store, and that's a separate project — $2,200 to $6,000, built to fit. What your plan includes already sells services, packages and gift cards with payment into your Stripe. My advice: start collecting on what you can collect this week, and we build the full store when volume calls for it.",
        es: "Ahí hablamos de tienda completa, y eso es un proyecto aparte — de $2.200 a $6.000, hecho a medida. Lo que incluye tu plan ya vende servicio, paquete y gift card con pago en tu Stripe. Mi consejo: empieza cobrando lo que ya se puede cobrar esta semana, y la tienda completa la armamos cuando el volumen lo pida.",
      },
    },
  },

  automation: {
    pain: {
      pt: "Você fecha a porta e começa o segundo expediente: passar agendamento pra planilha, mandar lembrete um por um, responder a mesma pergunta pela décima vez. Duas horas por dia que ninguém te paga.",
      en: "You close the door and start the second shift: copying bookings into a spreadsheet, sending reminders one by one, answering the same question for the tenth time. Two hours a day nobody pays you for.",
      es: "Cierras la puerta y empieza el segundo turno: pasar reservas a la planilla, mandar recordatorios uno por uno, responder la misma pregunta por décima vez. Dos horas al día que nadie te paga.",
    },
    leak: {
      pt: "Duas horas por dia é um mês inteiro de trabalho por ano — o seu, o mais caro da casa, no serviço mais barato que existe.",
      en: "Two hours a day is a full month of work a year — yours, the most expensive in the house, doing the cheapest job there is.",
      es: "Dos horas al día es un mes entero de trabajo al año — el tuyo, el más caro de la casa, en la tarea más barata que existe.",
    },
    solution: {
      pt: "A gente conecta as suas ferramentas e transforma essas rotinas em automação: o que hoje você faz na mão passa a acontecer sozinho, com registro de tudo no painel.",
      en: "We wire your tools together and turn those routines into automation: what you do by hand today starts happening on its own, with everything logged in the dashboard.",
      es: "Conectamos tus herramientas y convertimos esas rutinas en automatización: lo que hoy haces a mano pasa a ocurrir solo, con registro de todo en el panel.",
    },
    gain: [
      { pt: "As horas voltam pra você — as repetitivas, não as que dão dinheiro", en: "The hours come back to you — the repetitive ones, not the ones that make money", es: "Las horas vuelven a ti — las repetitivas, no las que dan dinero" },
      { pt: "Nada mais depende de alguém lembrar: o lembrete e o retorno saem sozinhos", en: "Nothing depends on someone remembering anymore: the reminder and the follow-up go out on their own", es: "Nada depende ya de que alguien recuerde: el recordatorio y el retorno salen solos" },
      { pt: "Tudo registrado — dá pra ver o que rodou, quando e pra quem", en: "Everything logged — you can see what ran, when and for whom", es: "Todo registrado — puedes ver qué corrió, cuándo y para quién" },
    ],
    edge: {
      pt: "O concorrente contrata mais uma pessoa pra fazer o repetitivo. Você não precisa contratar: o repetitivo simplesmente deixa de existir.",
      en: "The competitor hires one more person to do the repetitive work. You don't need to hire: the repetitive work simply stops existing.",
      es: "El competidor contrata a una persona más para lo repetitivo. Tú no necesitas contratar: lo repetitivo simplemente deja de existir.",
    },
    opener: {
      pt: "Qual é a tarefa que você faz toda semana, sempre igual, e que você odeia fazer?",
      en: "What's the task you do every week, always the same, that you hate doing?",
      es: "¿Cuál es la tarea que haces cada semana, siempre igual, y que odias hacer?",
    },
    discovery: [
      { pt: "Quanto tempo por dia some em coisa repetitiva que não é atender cliente?", en: "How much time a day disappears into repetitive work that isn't serving a customer?", es: "¿Cuánto tiempo al día se va en trabajo repetitivo que no es atender cliente?" },
      { pt: "Se essa hora voltasse pra você, você usaria pra vender ou pra descansar?", en: "If that hour came back to you, would you use it to sell or to rest?", es: "Si esa hora volviera a ti, ¿la usarías para vender o para descansar?" },
    ],
    objection: { q: { pt: K_WRONG.q.pt, en: K_WRONG.q.en, es: K_WRONG.q.es }, a: { pt: K_WRONG.a.pt, en: K_WRONG.a.en, es: K_WRONG.a.es } },
  },

  restaurant: {
    pain: {
      pt: "No sábado lotado, o telefone toca sem parar e ninguém consegue atender — cada chamada perdida é uma mesa que foi pro concorrente.",
      en: "On a packed Saturday the phone keeps ringing and nobody can pick up — every missed call is a table that went somewhere else.",
      es: "Un sábado lleno el teléfono no para de sonar y nadie alcanza a contestar — cada llamada perdida es una mesa que se fue a otro lado.",
    },
    leak: {
      pt: "Uma reserva grande perdida numa noite de sábado pode valer $300+ — e isso some sem você nem perceber.",
      en: "One big reservation lost on a Saturday night can be $300+ — and it slips away without you ever knowing.",
      es: "Una reserva grande perdida un sábado por la noche puede valer $300+ — y desaparece sin que te enteres.",
    },
    solution: {
      pt: "Você para de se preocupar com o telefone: toda ligação é atendida na hora, toda reserva entra no sistema, mesmo na correria do salão cheio.",
      en: "You stop worrying about the phone: every call gets answered instantly and every reservation lands in your book, even when the floor is slammed.",
      es: "Dejas de preocuparte por el teléfono: cada llamada se contesta al instante y cada reserva queda agendada, aun con el salón a tope.",
    },
    gain: [
      { pt: "Nenhuma reserva perdida, nem na correria", en: "Zero lost reservations, even at the rush", es: "Cero reservas perdidas, aun en la hora pico" },
      { pt: "Pedidos e dúvidas respondidos no WhatsApp na hora", en: "Orders and questions answered on WhatsApp instantly", es: "Pedidos y dudas respondidos al instante por WhatsApp" },
      { pt: "Clientes antigos chamados de volta para encher noites fracas", en: "Past guests invited back to fill slow nights", es: "Clientes antiguos invitados a volver para llenar noches flojas" },
    ],
    edge: {
      pt: "Enquanto o restaurante da esquina deixa a ligação cair na caixa postal, você atende em segundos — de noite, no domingo, sempre.",
      en: "While the place down the street lets calls go to voicemail, you answer in seconds — nights, Sundays, always.",
      es: "Mientras el restaurante de al lado deja que la llamada caiga al buzón, tú contestas en segundos — de noche, domingos, siempre.",
    },
    opener: {
      pt: "Posso te fazer uma pergunta rápida sobre as ligações que entram quando o salão tá cheio? Quantas você acha que ficam sem resposta?",
      en: "Can I ask you something quick about the calls that come in when the floor is full? How many do you figure go unanswered?",
      es: "¿Te puedo hacer una pregunta rápida sobre las llamadas que entran cuando el salón está lleno? ¿Cuántas crees que quedan sin contestar?",
    },
    discovery: [
      { pt: "Numa noite cheia, quem atende o telefone — e o que acontece quando ninguém pode?", en: "On a busy night, who picks up the phone — and what happens when no one can?", es: "En una noche llena, ¿quién contesta el teléfono — y qué pasa cuando nadie puede?" },
      { pt: "Quantas reservas você acha que perde por mês só porque ninguém atendeu?", en: "How many reservations do you think you lose a month just because nobody answered?", es: "¿Cuántas reservas crees que pierdes al mes solo porque nadie contestó?" },
    ],
    objection: {
      q: { pt: "Meu cliente não vai gostar de falar com um robô.", en: "My customers won't want to talk to a robot.", es: "A mis clientes no les va a gustar hablar con un robot." },
      a: { pt: "Faz sentido — por isso a voz é natural e calorosa, e um humano supervisiona. O cliente só sente que sempre tem alguém pronto pra ajudar, em vez de cair na caixa postal.", en: "Fair — that's why the voice is natural and warm, with a human supervising. Guests just feel like someone's always ready to help, instead of hitting voicemail.", es: "Tiene sentido — por eso la voz es natural y cálida, y un humano supervisa. El cliente solo siente que siempre hay alguien listo para ayudar, en vez de caer al buzón." },
    },
  },

  dental: {
    pain: {
      pt: "A cadeira fica vazia quando alguém falta e ninguém ligou a tempo pra preencher aquele horário.",
      en: "The chair sits empty when someone no-shows and nobody called in time to fill the slot.",
      es: "El sillón queda vacío cuando alguien falta y nadie llamó a tiempo para llenar el horario.",
    },
    leak: {
      pt: "Cada cadeira vazia custa $200+ — e algumas semanas têm várias.",
      en: "Each empty chair costs $200+ — and some weeks have several.",
      es: "Cada sillón vacío cuesta $200+ — y algunas semanas hay varios.",
    },
    solution: {
      pt: "Você deixa de correr atrás de confirmações: os lembretes saem sozinhos, as faltas viram horários reocupados e a agenda se fecha.",
      en: "You stop chasing confirmations: reminders go out on their own, no-shows get backfilled, and the schedule fills itself.",
      es: "Dejas de perseguir confirmaciones: los recordatorios salen solos, las faltas se rellenan y la agenda se llena sola.",
    },
    gain: [
      { pt: "Menos faltas com lembretes automáticos", en: "Fewer no-shows with automatic reminders", es: "Menos faltas con recordatorios automáticos" },
      { pt: "Horários vagos preenchidos pela lista de espera", en: "Open slots filled from the waitlist", es: "Horarios libres llenados desde la lista de espera" },
      { pt: "Pacientes antigos reativados para limpeza e retorno", en: "Past patients reactivated for cleanings and recalls", es: "Pacientes antiguos reactivados para limpieza y control" },
    ],
    edge: {
      pt: "Enquanto a clínica vizinha só percebe a falta quando a cadeira já tá vazia, a sua já chamou o próximo da fila.",
      en: "While the office next door only notices the no-show once the chair is empty, yours already called the next person on the list.",
      es: "Mientras el consultorio de al lado solo nota la falta cuando el sillón ya está vacío, el tuyo ya llamó al siguiente de la fila.",
    },
    opener: {
      pt: "Posso te perguntar uma coisa sobre faltas? Quando alguém cancela em cima da hora, como vocês costumam preencher esse horário?",
      en: "Can I ask you about no-shows? When someone cancels last minute, how do you usually fill that slot?",
      es: "¿Te puedo preguntar sobre las faltas? Cuando alguien cancela a último momento, ¿cómo suelen llenar ese horario?",
    },
    discovery: [
      { pt: "Quantas faltas vocês têm numa semana normal?", en: "How many no-shows do you see in a normal week?", es: "¿Cuántas faltas tienen en una semana normal?" },
      { pt: "Quem fica responsável por ligar pra confirmar os pacientes — e isso sempre acontece?", en: "Who's in charge of calling to confirm patients — and does it always happen?", es: "¿Quién se encarga de llamar para confirmar a los pacientes — y siempre se hace?" },
    ],
    objection: {
      q: { pt: "Já tenho uma recepcionista pra isso.", en: "I already have a receptionist for that.", es: "Ya tengo una recepcionista para eso." },
      a: { pt: "Ótimo — a ideia não é substituir, é cobrir o que ela não consegue: a hora do almoço, depois do expediente e os lembretes em massa. Ela fica livre pra cuidar de quem tá ali na sua frente.", en: "Great — this isn't to replace her, it's to cover what she can't: lunch hour, after-hours, and the bulk reminders. She's free to care for the patient right in front of her.", es: "Perfecto — no es para reemplazarla, es para cubrir lo que ella no alcanza: la hora del almuerzo, después del horario y los recordatorios masivos. Queda libre para atender a quien tiene enfrente." },
    },
  },

  clinic: {
    pain: {
      pt: "Pacientes ligam querendo marcar e, se ninguém atende na hora, eles desligam e procuram outra clínica.",
      en: "Patients call wanting to book, and if no one picks up right away they hang up and try another clinic.",
      es: "Los pacientes llaman para agendar y, si nadie contesta enseguida, cuelgan y buscan otra clínica.",
    },
    leak: {
      pt: "Cada paciente novo que desiste vale meses de consultas e tratamentos perdidos.",
      en: "Each new patient who gives up is months of lost visits and treatments.",
      es: "Cada paciente nuevo que se va son meses de consultas y tratamientos perdidos.",
    },
    solution: {
      pt: "Você deixa de perder paciente novo por telefone sem resposta: cada contato é atendido, qualificado e já entra na agenda.",
      en: "You stop losing new patients to an unanswered phone: every contact is answered, qualified, and booked right in.",
      es: "Dejas de perder pacientes nuevos por un teléfono sin respuesta: cada contacto se atiende, se califica y se agenda al momento.",
    },
    gain: [
      { pt: "Mais pacientes novos agendados, sem ligação perdida", en: "More new patients booked, no missed calls", es: "Más pacientes nuevos agendados, sin llamadas perdidas" },
      { pt: "Dúvidas e triagem respondidas a qualquer hora", en: "Questions and intake answered any hour", es: "Dudas y triaje respondidos a cualquier hora" },
      { pt: "Retornos e exames de rotina lembrados sozinhos", en: "Follow-ups and routine recalls reminded automatically", es: "Controles y exámenes de rutina recordados solos" },
    ],
    edge: {
      pt: "Enquanto a clínica concorrente atende só em horário comercial, a sua acolhe o paciente às 21h e no domingo — quando ele realmente liga.",
      en: "While the competing clinic only answers in business hours, yours welcomes the patient at 9pm and on Sunday — when they actually call.",
      es: "Mientras la clínica competidora atiende solo en horario de oficina, la tuya recibe al paciente a las 21h y el domingo — cuando de verdad llama.",
    },
    opener: {
      pt: "Posso te perguntar sobre os pacientes que ligam fora do horário? Você sabe quantos ficam sem retorno?",
      en: "Can I ask about the patients who call after hours? Do you know how many never get a callback?",
      es: "¿Te puedo preguntar sobre los pacientes que llaman fuera de horario? ¿Sabes cuántos se quedan sin respuesta?",
    },
    discovery: [
      { pt: "Quando o telefone toca e a recepção tá ocupada com quem chegou, o que acontece com a ligação?", en: "When the phone rings and the front desk is busy with a walk-in, what happens to the call?", es: "Cuando suena el teléfono y la recepción está ocupada con quien llegó, ¿qué pasa con la llamada?" },
      { pt: "Quantos pacientes novos vocês acham que perdem por mês por demora em responder?", en: "How many new patients do you figure you lose a month from slow responses?", es: "¿Cuántos pacientes nuevos creen que pierden al mes por responder tarde?" },
    ],
    objection: {
      q: { pt: "Saúde é coisa séria, não dá pra confiar numa IA.", en: "Health is serious — I can't trust this to an AI.", es: "La salud es algo serio, no puedo confiárselo a una IA." },
      a: { pt: "Concordo totalmente — por isso a IA só agenda, tira dúvidas e faz triagem básica, sempre com um humano supervisionando. Nada clínico é decidido por ela; ela só garante que ninguém fique sem resposta.", en: "Completely agree — that's why the AI only books, answers questions, and does basic intake, always with a human supervising. Nothing clinical is decided by it; it just makes sure no one goes unanswered.", es: "Totalmente de acuerdo — por eso la IA solo agenda, responde dudas y hace triaje básico, siempre con un humano supervisando. Nada clínico lo decide ella; solo garantiza que nadie se quede sin respuesta." },
    },
  },

  salon: {
    pain: {
      pt: "Você tá com as mãos no cabelo da cliente e o telefone toca — não dá pra atender, e quem ligava some.",
      en: "Your hands are in a client's hair and the phone rings — you can't pick up, and the caller's gone.",
      es: "Tienes las manos en el cabello de la clienta y suena el teléfono — no puedes contestar, y quien llamaba se fue.",
    },
    leak: {
      pt: "Cada horário vago que não foi preenchido é uma cadeira parada valendo $50–100.",
      en: "Every open slot you didn't fill is an idle chair worth $50–100.",
      es: "Cada hueco que no llenaste es una silla parada que vale $50–100.",
    },
    solution: {
      pt: "Você foca na cliente da cadeira: o telefone é atendido, o agendamento entra sozinho e os horários vagos se preenchem.",
      en: "You focus on the client in the chair: the phone gets answered, bookings come in on their own, and open slots fill up.",
      es: "Te concentras en la clienta de la silla: el teléfono se contesta, las citas entran solas y los huecos se llenan.",
    },
    gain: [
      { pt: "Agenda cheia sem largar a tesoura", en: "A full book without putting down the scissors", es: "Agenda llena sin soltar las tijeras" },
      { pt: "Clientes confirmadas e lembradas automaticamente", en: "Clients confirmed and reminded automatically", es: "Clientas confirmadas y recordadas automáticamente" },
      { pt: "Clientes sumidas chamadas de volta", en: "Lapsed clients invited back", es: "Clientas perdidas invitadas a volver" },
    ],
    edge: {
      pt: "Enquanto o salão concorrente deixa a ligação cair, o seu já marcou a cliente — e ela nem percebeu que você estava ocupado.",
      en: "While the competing salon lets the call drop, yours already booked the client — and she never noticed you were busy.",
      es: "Mientras el salón competidor deja caer la llamada, el tuyo ya agendó a la clienta — y ni notó que estabas ocupado.",
    },
    opener: {
      pt: "Posso te perguntar uma coisa? Quando você tá atendendo e o telefone toca, o que costuma acontecer com essa ligação?",
      en: "Can I ask you something? When you're with a client and the phone rings, what usually happens to that call?",
      es: "¿Te puedo preguntar algo? Cuando estás atendiendo y suena el teléfono, ¿qué suele pasar con esa llamada?",
    },
    discovery: [
      { pt: "Quantas ligações por dia você acha que entram enquanto você tá ocupado?", en: "How many calls a day do you think come in while you're busy?", es: "¿Cuántas llamadas al día crees que entran mientras estás ocupado?" },
      { pt: "Tem cliente boa que sumiu e você gostaria de trazer de volta?", en: "Are there good clients who drifted away that you'd love back?", es: "¿Hay clientas buenas que se alejaron y te encantaría recuperar?" },
    ],
    objection: {
      q: { pt: "Minhas clientes preferem mandar mensagem direto pra mim.", en: "My clients prefer to text me directly.", es: "Mis clientas prefieren escribirme directo a mí." },
      a: { pt: "Perfeito — ele responde justamente nessas mensagens quando você não pode, com seu tom, e marca na hora. Você só vê o resultado: a agenda cheia, sem ficar grudada no celular.", en: "Perfect — it answers exactly those messages when you can't, in your tone, and books on the spot. You just see the result: a full book, without being glued to your phone.", es: "Perfecto — responde justo esos mensajes cuando tú no puedes, con tu tono, y agenda al momento. Tú solo ves el resultado: la agenda llena, sin estar pegada al celular." },
    },
  },

  homeservices: {
    pain: {
      pt: "Você tá embaixo de uma pia com as mãos sujas e o telefone toca — quem precisa de um encanador agora liga pro próximo da lista.",
      en: "You're under a sink with dirty hands and the phone rings — someone who needs a plumber now just calls the next name on the list.",
      es: "Estás bajo un fregadero con las manos sucias y suena el teléfono — quien necesita un plomero ahora llama al siguiente de la lista.",
    },
    leak: {
      pt: "Um único serviço perdido pode valer $150–400 — e quem liga em emergência não deixa recado.",
      en: "A single missed job can be worth $150–400 — and emergency callers don't leave voicemails.",
      es: "Un solo trabajo perdido puede valer $150–400 — y quien llama por emergencia no deja mensaje.",
    },
    solution: {
      pt: "Você deixa de perder serviço por estar de mão ocupada: toda ligação é atendida, o orçamento básico é dado e o serviço já entra na agenda.",
      en: "You stop losing jobs because your hands are full: every call is answered, the basic quote is given, and the job lands on your schedule.",
      es: "Dejas de perder trabajos por tener las manos ocupadas: cada llamada se atiende, se da el presupuesto básico y el trabajo queda agendado.",
    },
    gain: [
      { pt: "Toda emergência atendida, mesmo no serviço", en: "Every emergency answered, even mid-job", es: "Cada emergencia atendida, aun en pleno trabajo" },
      { pt: "Retorno ao cliente novo em ~60 segundos", en: "New leads called back in ~60 seconds", es: "Cliente nuevo contactado en ~60 segundos" },
      { pt: "Serviços agendados sem você parar o que faz", en: "Jobs booked without stopping what you're doing", es: "Trabajos agendados sin parar lo que haces" },
    ],
    edge: {
      pt: "Enquanto o concorrente liga de volta no fim do dia, você fala com o cliente em 60 segundos — e quem responde primeiro fecha o serviço.",
      en: "While your competitor calls back at the end of the day, you reach the customer in 60 seconds — and whoever responds first wins the job.",
      es: "Mientras tu competidor devuelve la llamada al final del día, tú hablas con el cliente en 60 segundos — y quien responde primero se queda el trabajo.",
    },
    opener: {
      pt: "Posso te fazer uma pergunta? Quando o telefone toca e você tá no meio de um serviço, quantas dessas ligações você consegue atender?",
      en: "Can I ask you something? When the phone rings while you're mid-job, how many of those calls can you actually take?",
      es: "¿Te puedo hacer una pregunta? Cuando suena el teléfono y estás en medio de un trabajo, ¿cuántas de esas llamadas alcanzas a contestar?",
    },
    discovery: [
      { pt: "Quando alguém liga e cai na caixa postal, você acha que ele espera ou liga pro próximo?", en: "When someone hits your voicemail, do you think they wait or call the next guy?", es: "Cuando alguien cae en tu buzón, ¿crees que espera o llama al siguiente?" },
      { pt: "Quanto vale, em média, um serviço que você fecha?", en: "What's an average job worth to you when you land it?", es: "¿Cuánto vale, en promedio, un trabajo que cierras?" },
    ],
    objection: {
      q: { pt: "Eu mesmo atendo quando dá, não preciso disso.", en: "I just answer myself when I can, I don't need this.", es: "Yo mismo contesto cuando puedo, no necesito esto." },
      a: { pt: "Total — e nas horas que você NÃO pode atender é onde mora o dinheiro. Ele cobre exatamente esses momentos, sem você largar a chave de cano. Você só recebe o serviço já agendado.", en: "Totally — and the hours you CAN'T answer are exactly where the money is. It covers those moments without you dropping your wrench. You just get the job already booked.", es: "Claro — y las horas en que NO puedes contestar es donde está el dinero. Cubre justo esos momentos sin que sueltes la llave. Tú solo recibes el trabajo ya agendado." },
    },
  },

  realestate: {
    pain: {
      pt: "Um comprador vê o anúncio à noite, liga ou manda mensagem, ninguém responde na hora — e amanhã ele já tá com outro corretor.",
      en: "A buyer sees the listing at night, calls or texts, no one answers right away — and by tomorrow they're with another agent.",
      es: "Un comprador ve el anuncio de noche, llama o escribe, nadie responde al momento — y mañana ya está con otro agente.",
    },
    leak: {
      pt: "Um único lead bom que esfria pode ser uma comissão inteira perdida.",
      en: "A single hot lead that goes cold can be an entire commission lost.",
      es: "Un solo lead bueno que se enfría puede ser una comisión entera perdida.",
    },
    solution: {
      pt: "Você deixa de perder lead por demora: todo interessado é respondido na hora, qualificado e já tem visita marcada.",
      en: "You stop losing leads to delay: every inquiry is answered instantly, qualified, and booked for a showing.",
      es: "Dejas de perder leads por demora: cada interesado se responde al instante, se califica y se agenda una visita.",
    },
    gain: [
      { pt: "Resposta a todo interessado em ~60 segundos", en: "Every inquiry answered in ~60 seconds", es: "Respuesta a cada interesado en ~60 segundos" },
      { pt: "Leads qualificados antes de ocupar sua agenda", en: "Leads qualified before they take your time", es: "Leads calificados antes de ocupar tu agenda" },
      { pt: "Visitas marcadas e lembradas sozinhas", en: "Showings booked and reminded automatically", es: "Visitas agendadas y recordadas solas" },
    ],
    edge: {
      pt: "Enquanto o corretor concorrente vê a mensagem só de manhã, você já marcou a visita na noite anterior — e quem responde primeiro ganha o cliente.",
      en: "While the competing agent sees the message the next morning, you already booked the showing the night before — and whoever responds first wins the client.",
      es: "Mientras el agente competidor ve el mensaje recién en la mañana, tú ya agendaste la visita la noche anterior — y quien responde primero gana al cliente.",
    },
    opener: {
      pt: "Posso te perguntar uma coisa sobre os leads que entram à noite e no fim de semana? Quanto tempo costuma levar até alguém responder?",
      en: "Can I ask about the leads that come in at night and on weekends? How long does it usually take to respond?",
      es: "¿Te puedo preguntar sobre los leads que entran de noche y fin de semana? ¿Cuánto suele tardar la respuesta?",
    },
    discovery: [
      { pt: "Quando um lead chega às 22h, quem responde — e em quanto tempo?", en: "When a lead comes in at 10pm, who responds — and how fast?", es: "Cuando un lead llega a las 22h, ¿quién responde — y en cuánto tiempo?" },
      { pt: "Quantos contatos você sente que esfriam antes de você conseguir falar com eles?", en: "How many inquiries do you feel go cold before you reach them?", es: "¿Cuántos contactos sientes que se enfrían antes de poder hablar con ellos?" },
    ],
    objection: {
      q: { pt: "Esse mercado é de relacionamento, é pessoal demais pra automatizar.", en: "This business is about relationships — it's too personal to automate.", es: "Este negocio es de relación, es demasiado personal para automatizar." },
      a: { pt: "Exato — e por isso o que importa é você chegar primeiro e com calor. Ele só garante a resposta imediata e a visita marcada; o relacionamento, quem constrói é você, agora com o lead ainda quente.", en: "Exactly — which is why getting there first and warm is everything. It just secures the instant reply and the booked showing; you build the relationship, now with the lead still hot.", es: "Exacto — por eso lo que importa es que llegues primero y con calidez. Solo asegura la respuesta inmediata y la visita agendada; la relación la construyes tú, ahora con el lead aún caliente." },
    },
  },

  law: {
    pain: {
      pt: "Quem precisa de advogado liga em momento de aflição — se cai na secretária eletrônica, ele já discou pro próximo escritório.",
      en: "People who need a lawyer call in a stressful moment — if it hits voicemail, they've already dialed the next firm.",
      es: "Quien necesita un abogado llama en un momento de angustia — si cae al buzón, ya marcó al siguiente despacho.",
    },
    leak: {
      pt: "Um único caso perdido por telefone sem resposta pode valer milhares em honorários.",
      en: "A single case lost to an unanswered phone can be thousands in fees.",
      es: "Un solo caso perdido por un teléfono sin respuesta puede valer miles en honorarios.",
    },
    solution: {
      pt: "Você deixa de perder caso por ligação não atendida: todo contato é acolhido, a consulta é triada e já entra na agenda.",
      en: "You stop losing cases to missed calls: every contact is received, the matter is screened, and the consultation is booked.",
      es: "Dejas de perder casos por llamadas sin atender: cada contacto se recibe, el asunto se filtra y la consulta queda agendada.",
    },
    gain: [
      { pt: "Todo cliente potencial atendido na hora da aflição", en: "Every potential client received the moment they're stressed", es: "Cada cliente potencial atendido en su momento de angustia" },
      { pt: "Casos triados antes de chegarem na sua mesa", en: "Matters screened before they reach your desk", es: "Casos filtrados antes de llegar a tu escritorio" },
      { pt: "Consultas marcadas e confirmadas automaticamente", en: "Consultations booked and confirmed automatically", es: "Consultas agendadas y confirmadas automáticamente" },
    ],
    edge: {
      pt: "Enquanto o escritório vizinho retorna a ligação no dia seguinte, o seu acolhe o cliente no minuto em que ele liga — e quem responde primeiro fica com o caso.",
      en: "While the firm next door calls back the next day, yours receives the client the minute they call — and whoever responds first keeps the case.",
      es: "Mientras el despacho vecino devuelve la llamada al día siguiente, el tuyo recibe al cliente en el minuto en que llama — y quien responde primero se queda el caso.",
    },
    opener: {
      pt: "Posso te perguntar uma coisa? Quando alguém liga procurando ajuda e a equipe tá em audiência, o que acontece com esse contato?",
      en: "Can I ask you something? When someone calls for help and the team is in court, what happens to that contact?",
      es: "¿Te puedo preguntar algo? Cuando alguien llama buscando ayuda y el equipo está en audiencia, ¿qué pasa con ese contacto?",
    },
    discovery: [
      { pt: "Quantos clientes potenciais ligam fora do horário ou enquanto vocês estão ocupados?", en: "How many potential clients call after hours or while you're tied up?", es: "¿Cuántos clientes potenciales llaman fuera de horario o mientras están ocupados?" },
      { pt: "Quanto vale, em média, um caso que vocês aceitam?", en: "What's an average case worth when you take it on?", es: "¿Cuánto vale, en promedio, un caso que aceptan?" },
    ],
    objection: {
      q: { pt: "Questões jurídicas são confidenciais e delicadas demais pra isso.", en: "Legal matters are too confidential and delicate for this.", es: "Los asuntos legales son demasiado confidenciales y delicados para esto." },
      a: { pt: "Concordo — por isso ele não dá orientação jurídica: só acolhe, faz a triagem inicial e marca a consulta, com sigilo e um humano supervisionando. Você só recebe o caso já organizado e na agenda.", en: "Agreed — that's why it gives no legal advice: it only receives, does the initial intake, and books the consultation, confidentially and human-supervised. You just get the matter organized and on the calendar.", es: "De acuerdo — por eso no da asesoría legal: solo recibe, hace el filtro inicial y agenda la consulta, con confidencialidad y un humano supervisando. Tú solo recibes el caso ya organizado y agendado." },
    },
  },

  autorepair: {
    pain: {
      pt: "Você tá debaixo de um carro e o telefone toca — quem precisa de mecânico hoje não espera, liga pra próxima oficina.",
      en: "You're under a car and the phone rings — someone who needs a mechanic today won't wait, they call the next shop.",
      es: "Estás debajo de un auto y suena el teléfono — quien necesita mecánico hoy no espera, llama al siguiente taller.",
    },
    leak: {
      pt: "Um serviço médio perdido vale $200–500, e a oficina vive de movimento.",
      en: "An average job lost is $200–500, and a shop lives on volume.",
      es: "Un trabajo promedio perdido vale $200–500, y el taller vive del movimiento.",
    },
    solution: {
      pt: "Você deixa de perder cliente por estar com a mão na graxa: toda ligação é atendida, o serviço é estimado e a entrada do carro já é agendada.",
      en: "You stop losing customers because your hands are greasy: every call is answered, the job is estimated, and the drop-off is booked.",
      es: "Dejas de perder clientes por tener las manos en la grasa: cada llamada se atiende, se estima el trabajo y se agenda la entrada del auto.",
    },
    gain: [
      { pt: "Toda ligação atendida sem sair de baixo do carro", en: "Every call answered without coming up from under the car", es: "Cada llamada atendida sin salir de abajo del auto" },
      { pt: "Carros agendados pra encher dias parados", en: "Cars booked to fill slow days", es: "Autos agendados para llenar días flojos" },
      { pt: "Clientes lembrados da troca de óleo e revisão", en: "Customers reminded for oil changes and service", es: "Clientes recordados del cambio de aceite y revisión" },
    ],
    edge: {
      pt: "Enquanto a oficina da esquina deixa tocar e perde o cliente, a sua já agendou a entrada do carro — sem você largar a ferramenta.",
      en: "While the shop on the corner lets it ring and loses the customer, yours already booked the car in — without you dropping a tool.",
      es: "Mientras el taller de la esquina deja sonar y pierde al cliente, el tuyo ya agendó la entrada del auto — sin que sueltes la herramienta.",
    },
    opener: {
      pt: "Posso te fazer uma pergunta? Quando você tá com a mão na graxa e o telefone toca, quantas dessas ligações se perdem?",
      en: "Can I ask you something? When your hands are greasy and the phone rings, how many of those calls slip away?",
      es: "¿Te puedo hacer una pregunta? Cuando tienes las manos en la grasa y suena el teléfono, ¿cuántas de esas llamadas se pierden?",
    },
    discovery: [
      { pt: "Quem atende o telefone quando todo mundo tá ocupado num carro?", en: "Who picks up the phone when everyone's busy on a car?", es: "¿Quién contesta el teléfono cuando todos están ocupados en un auto?" },
      { pt: "Você tem dias da semana mais parados que gostaria de encher?", en: "Do you have slower days you'd like to fill up?", es: "¿Tienes días de la semana más flojos que te gustaría llenar?" },
    ],
    objection: {
      q: { pt: "Cliente quer falar com mecânico de verdade, não com máquina.", en: "Customers want to talk to a real mechanic, not a machine.", es: "El cliente quiere hablar con un mecánico de verdad, no con una máquina." },
      a: { pt: "Justo — ele só atende, anota o problema do carro e agenda a entrada; o diagnóstico de verdade é seu. A diferença é que o cliente é atendido na hora em vez de cair na caixa postal e ir embora.", en: "Fair — it only answers, notes the car's issue, and books the drop-off; the real diagnosis is yours. The difference is the customer gets answered right away instead of hitting voicemail and leaving.", es: "Justo — solo atiende, anota el problema del auto y agenda la entrada; el diagnóstico de verdad es tuyo. La diferencia es que al cliente se le atiende al instante en vez de caer al buzón e irse." },
    },
  },

  fitness: {
    pain: {
      pt: "Alguém ganha coragem pra começar e manda mensagem à noite — se ninguém responde, no dia seguinte a motivação já passou.",
      en: "Someone finally works up the nerve to start and messages at night — if no one replies, by morning the motivation's gone.",
      es: "Alguien por fin se anima a empezar y escribe de noche — si nadie responde, al día siguiente la motivación ya pasó.",
    },
    leak: {
      pt: "Cada matrícula perdida é uma mensalidade recorrente que escorre todo mês.",
      en: "Each lost sign-up is a recurring membership leaking away every month.",
      es: "Cada inscripción perdida es una mensualidad recurrente que se escapa cada mes.",
    },
    solution: {
      pt: "Você deixa de perder aluno por demora: todo interessado é respondido na hora, a aula experimental é marcada e os alunos somem menos.",
      en: "You stop losing members to delay: every prospect gets answered instantly, the trial class is booked, and members drop off less.",
      es: "Dejas de perder alumnos por demora: cada interesado se responde al instante, se agenda la clase de prueba y los alumnos abandonan menos.",
    },
    gain: [
      { pt: "Aula experimental marcada com o interessado ainda animado", en: "Trial class booked while the prospect's still pumped", es: "Clase de prueba agendada con el interesado aún motivado" },
      { pt: "Resposta imediata no WhatsApp e Instagram", en: "Instant replies on WhatsApp and Instagram", es: "Respuesta inmediata en WhatsApp e Instagram" },
      { pt: "Alunos sumidos chamados de volta antes de cancelar", en: "Drifting members invited back before they cancel", es: "Alumnos perdidos invitados a volver antes de cancelar" },
    ],
    edge: {
      pt: "Enquanto a academia concorrente responde a DM dois dias depois, você marca a aula experimental no minuto em que a pessoa decide — e a decisão ainda tá quente.",
      en: "While the competing gym answers the DM two days later, you book the trial the minute someone decides — while the urge is still hot.",
      es: "Mientras el gimnasio competidor responde el DM dos días después, tú agendas la prueba en el minuto en que la persona decide — con las ganas aún calientes.",
    },
    opener: {
      pt: "Posso te perguntar uma coisa sobre as mensagens que chegam no Instagram à noite? Quanto tempo leva até alguém responder?",
      en: "Can I ask about the messages that come in on Instagram at night? How long until someone replies?",
      es: "¿Te puedo preguntar sobre los mensajes que llegan por Instagram de noche? ¿Cuánto tarda alguien en responder?",
    },
    discovery: [
      { pt: "Quando chega uma mensagem de interessado fora do horário, quem responde — e quando?", en: "When a prospect messages after hours, who replies — and when?", es: "Cuando llega un mensaje de interesado fuera de horario, ¿quién responde — y cuándo?" },
      { pt: "Quantos alunos cancelam por mês que vocês poderiam ter segurado?", en: "How many members cancel a month that you could have kept?", es: "¿Cuántos alumnos cancelan al mes que podrían haber retenido?" },
    ],
    objection: {
      q: { pt: "A gente já posta bastante e os interessados aparecem sozinhos.", en: "We post a lot already and prospects show up on their own.", es: "Ya publicamos bastante y los interesados aparecen solos." },
      a: { pt: "Show — o problema raramente é gerar interesse, é responder rápido o suficiente pra ele virar matrícula. Ele garante que nenhuma mensagem fica horas parada, então o seu marketing finalmente vira aluno pagante.", en: "Nice — the problem is rarely generating interest, it's replying fast enough to turn it into a sign-up. This makes sure no message sits for hours, so your marketing finally becomes paying members.", es: "Genial — el problema rara vez es generar interés, es responder lo bastante rápido para que se vuelva inscripción. Esto asegura que ningún mensaje quede horas parado, así tu marketing por fin se vuelve alumnos que pagan." },
    },
  },

  vet: {
    pain: {
      pt: "Um tutor liga aflito com o bicho passando mal — se cai na caixa postal, ele corre pra outra clínica na mesma hora.",
      en: "A worried pet owner calls with a sick animal — if it hits voicemail, they rush to another clinic that same minute.",
      es: "Un dueño llama angustiado con su mascota enferma — si cae al buzón, corre a otra clínica en ese mismo instante.",
    },
    leak: {
      pt: "Cada emergência perdida é um cliente — e a família dele — que vai pra concorrência pra sempre.",
      en: "Each missed emergency is a client — and their whole family — gone to a competitor for good.",
      es: "Cada emergencia perdida es un cliente — y toda su familia — que se va a la competencia para siempre.",
    },
    solution: {
      pt: "Você deixa de perder o tutor aflito: toda ligação é acolhida na hora, a urgência é triada e o atendimento já é agendado.",
      en: "You stop losing the anxious owner: every call is received instantly, urgency is screened, and the visit is booked.",
      es: "Dejas de perder al dueño angustiado: cada llamada se recibe al instante, se filtra la urgencia y se agenda la consulta.",
    },
    gain: [
      { pt: "Tutor acolhido no momento de aflição, sempre", en: "The worried owner received in their stressful moment, always", es: "El dueño atendido en su momento de angustia, siempre" },
      { pt: "Vacinas e retornos lembrados sozinhos", en: "Vaccines and recalls reminded automatically", es: "Vacunas y controles recordados solos" },
      { pt: "Clientes antigos trazidos de volta pro check-up", en: "Past clients brought back for check-ups", es: "Clientes antiguos traídos de vuelta al chequeo" },
    ],
    edge: {
      pt: "Enquanto a clínica vizinha deixa cair na caixa postal, a sua acolhe o tutor aflito em segundos — e ele lembra de quem atendeu o pet dele.",
      en: "While the clinic next door lets it go to voicemail, yours receives the worried owner in seconds — and they remember who was there for their pet.",
      es: "Mientras la clínica vecina lo deja caer al buzón, la tuya recibe al dueño angustiado en segundos — y él recuerda quién atendió a su mascota.",
    },
    opener: {
      pt: "Posso te perguntar uma coisa? Quando um tutor liga aflito fora do horário, o que acontece com essa ligação hoje?",
      en: "Can I ask you something? When a worried owner calls after hours, what happens to that call today?",
      es: "¿Te puedo preguntar algo? Cuando un dueño llama angustiado fuera de horario, ¿qué pasa hoy con esa llamada?",
    },
    discovery: [
      { pt: "Quantas ligações vocês acham que perdem na hora do almoço e depois do expediente?", en: "How many calls do you figure you miss at lunch and after hours?", es: "¿Cuántas llamadas creen que pierden a la hora del almuerzo y después del horario?" },
      { pt: "Quantos tutores deixam de voltar pra vacina porque ninguém lembrou?", en: "How many owners skip the vaccine because nobody reminded them?", es: "¿Cuántos dueños no vuelven a la vacuna porque nadie les recordó?" },
    ],
    objection: {
      q: { pt: "Emergência com animal precisa de gente, não de IA.", en: "An animal emergency needs a person, not an AI.", es: "Una emergencia con un animal necesita una persona, no una IA." },
      a: { pt: "Concordo — por isso ela acolhe, faz a triagem da urgência e já encaminha pro veterinário ou agenda; nada clínico é decidido por ela. O ganho é que o tutor é atendido na hora em vez de ouvir a caixa postal e correr pra outra clínica.", en: "Agreed — that's why it receives, screens urgency, and routes to the vet or books; nothing clinical is decided by it. The win is the owner gets answered immediately instead of hearing voicemail and rushing elsewhere.", es: "De acuerdo — por eso recibe, filtra la urgencia y deriva al veterinario o agenda; nada clínico lo decide ella. La ganancia es que al dueño se le atiende al instante en vez de oír el buzón y correr a otra clínica." },
    },
  },

  spa: {
    pain: {
      pt: "Alguém decide se mimar e liga pra marcar — se ninguém atende, o impulso passa e a reserva nunca acontece.",
      en: "Someone decides to treat themselves and calls to book — if no one answers, the impulse fades and the booking never happens.",
      es: "Alguien decide consentirse y llama para reservar — si nadie contesta, el impulso pasa y la reserva nunca ocurre.",
    },
    leak: {
      pt: "Cada horário ocioso de cabine é receita parada — e os melhores horários são os que mais somem.",
      en: "Every idle treatment room is stalled revenue — and the prime slots are the ones that vanish.",
      es: "Cada cabina ociosa es ingreso detenido — y los mejores horarios son los que más se pierden.",
    },
    solution: {
      pt: "Você deixa de perder reserva por impulso não atendido: toda ligação é acolhida, o pacote é explicado e o horário já fica garantido.",
      en: "You stop losing impulse bookings: every call is received, the package is explained, and the slot is secured.",
      es: "Dejas de perder reservas por impulsos no atendidos: cada llamada se recibe, se explica el paquete y el horario queda asegurado.",
    },
    gain: [
      { pt: "Reservas fechadas no calor do impulso", en: "Bookings closed while the impulse is hot", es: "Reservas cerradas en el calor del impulso" },
      { pt: "Cabines vagas preenchidas, até as melhores horas", en: "Empty rooms filled, even prime hours", es: "Cabinas vacías llenadas, incluso las mejores horas" },
      { pt: "Clientes lembrados de voltar antes de esquecer de você", en: "Clients reminded to return before they forget you", es: "Clientes recordados de volver antes de olvidarte" },
    ],
    edge: {
      pt: "Enquanto o spa concorrente deixa a ligação cair, o seu acolhe a cliente no calor do impulso e já garante o horário — antes que ela mude de ideia.",
      en: "While the competing spa lets the call drop, yours welcomes the client while the impulse is hot and locks the slot — before she changes her mind.",
      es: "Mientras el spa competidor deja caer la llamada, el tuyo recibe a la clienta en el calor del impulso y asegura el horario — antes de que cambie de idea.",
    },
    opener: {
      pt: "Posso te perguntar uma coisa? Quando alguém liga querendo marcar e a equipe tá toda em atendimento, o que acontece com a ligação?",
      en: "Can I ask you something? When someone calls to book and the whole team is in session, what happens to the call?",
      es: "¿Te puedo preguntar algo? Cuando alguien llama para reservar y todo el equipo está atendiendo, ¿qué pasa con la llamada?",
    },
    discovery: [
      { pt: "Quantas ligações entram enquanto a equipe tá ocupada nas cabines?", en: "How many calls come in while the team is busy in the rooms?", es: "¿Cuántas llamadas entran mientras el equipo está ocupado en las cabinas?" },
      { pt: "Tem horários do dia que ficam ociosos e você queria preencher?", en: "Are there hours of the day that sit idle that you'd like to fill?", es: "¿Hay horas del día que quedan ociosas y te gustaría llenar?" },
    ],
    objection: {
      q: { pt: "Meu spa é sobre experiência, um atendimento frio quebraria isso.", en: "My spa is about the experience — a cold response would break it.", es: "Mi spa es sobre la experiencia, una atención fría rompería eso." },
      a: { pt: "Exatamente por isso a voz é calma e calorosa, no tom do seu spa, com um humano supervisionando. A experiência ruim de verdade é a cliente ligar animada e cair na caixa postal — isso é o que ele acaba.", en: "That's exactly why the voice is calm and warm, in your spa's tone, with a human supervising. The truly cold experience is an excited client calling and hitting voicemail — that's what this ends.", es: "Justo por eso la voz es calmada y cálida, en el tono de tu spa, con un humano supervisando. La experiencia de verdad fría es que la clienta llame entusiasmada y caiga al buzón — eso es lo que esto elimina." },
    },
  },

  retail: {
    pain: {
      pt: "Cliente manda mensagem perguntando se tem o produto e o preço — se você demora pra responder, ele compra no concorrente que respondeu antes.",
      en: "A customer messages asking if you have the item and the price — if you're slow to reply, they buy from whoever answered first.",
      es: "Un cliente escribe preguntando si tienes el producto y el precio — si tardas en responder, compra en el competidor que respondió antes.",
    },
    leak: {
      pt: "Cada pergunta sem resposta rápida é uma venda que foi pro concorrente — e ele nem volta.",
      en: "Every question without a fast answer is a sale gone to a competitor — and they don't come back.",
      es: "Cada pregunta sin respuesta rápida es una venta que se fue al competidor — y ese cliente no vuelve.",
    },
    solution: {
      pt: "Você deixa de perder venda por demora: toda pergunta no WhatsApp e Instagram é respondida na hora e o cliente é levado até a compra.",
      en: "You stop losing sales to delay: every WhatsApp and Instagram question is answered instantly and the customer is carried to the purchase.",
      es: "Dejas de perder ventas por demora: cada pregunta en WhatsApp e Instagram se responde al instante y se lleva al cliente hasta la compra.",
    },
    gain: [
      { pt: "Toda pergunta de produto respondida na hora", en: "Every product question answered instantly", es: "Cada pregunta de producto respondida al instante" },
      { pt: "Carrinhos e dúvidas convertidos em venda", en: "Carts and questions converted into sales", es: "Carritos y dudas convertidos en venta" },
      { pt: "Clientes antigos chamados de volta com novidades", en: "Past customers invited back with new arrivals", es: "Clientes antiguos invitados a volver con novedades" },
    ],
    edge: {
      pt: "Enquanto a loja concorrente responde a mensagem só amanhã, a sua responde em segundos e fecha a venda — quem responde primeiro leva o cliente.",
      en: "While the competing shop replies tomorrow, yours answers in seconds and closes the sale — whoever responds first wins the customer.",
      es: "Mientras la tienda competidora responde recién mañana, la tuya responde en segundos y cierra la venta — quien responde primero se lleva al cliente.",
    },
    opener: {
      pt: "Posso te perguntar uma coisa? Quando chega aquela mensagem de 'tem esse produto? quanto é?', em quanto tempo costuma responder?",
      en: "Can I ask you something? When that 'do you have this? how much?' message comes in, how fast do you usually reply?",
      es: "¿Te puedo preguntar algo? Cuando llega ese mensaje de '¿tienes este producto? ¿cuánto cuesta?', ¿en cuánto tiempo sueles responder?",
    },
    discovery: [
      { pt: "Quantas mensagens de cliente chegam por dia, e quantas ficam horas sem resposta?", en: "How many customer messages come in a day, and how many sit unanswered for hours?", es: "¿Cuántos mensajes de clientes llegan al día, y cuántos quedan horas sin respuesta?" },
      { pt: "Você acha que perde venda por demorar pra responder no WhatsApp?", en: "Do you think you lose sales by being slow to reply on WhatsApp?", es: "¿Crees que pierdes ventas por tardar en responder por WhatsApp?" },
    ],
    objection: {
      q: { pt: "Eu mesmo respondo as mensagens quando dá.", en: "I answer the messages myself when I can.", es: "Yo mismo respondo los mensajes cuando puedo." },
      a: { pt: "Faz sentido — e o cliente que decide na hora não espera o seu 'quando dá'. Ele responde na hora com seu tom e seus preços, e te chama só quando precisa de você. A venda não esfria mais.", en: "Makes sense — but the customer deciding right now won't wait for your 'when I can'. It replies instantly in your tone and your prices, and pulls you in only when needed. The sale stops going cold.", es: "Tiene sentido — pero el cliente que decide ahora no espera tu 'cuando pueda'. Responde al instante con tu tono y tus precios, y te llama solo cuando hace falta. La venta ya no se enfría." },
    },
  },

  cafe: {
    pain: {
      pt: "Na hora do rush o telefone toca com pedido pra viagem e ninguém consegue largar a máquina — o pedido vai pro café da esquina.",
      en: "At rush hour the phone rings with a to-go order and nobody can step away from the machine — the order goes to the café on the corner.",
      es: "En la hora pico suena el teléfono con un pedido para llevar y nadie puede soltar la máquina — el pedido se va al café de la esquina.",
    },
    leak: {
      pt: "Cada pedido por telefone perdido são $15–40 — e no rush isso acontece várias vezes por dia, todo dia.",
      en: "Each missed phone order is $15–40 — and at rush that happens several times a day, every day.",
      es: "Cada pedido perdido por teléfono son $15–40 — y en la hora pico pasa varias veces al día, todos los días.",
    },
    solution: {
      pt: "É como contratar um funcionário que nunca dorme só pro telefone: ele atende, anota o pedido, oferece o adicional, manda o link de pagamento por SMS e o pedido já chega pago no balcão.",
      en: "It's like hiring an employee who never sleeps just for the phone: it answers, takes the order, offers the add-on, sends the pay-link by SMS, and the order lands at the counter already paid.",
      es: "Es como contratar un empleado que nunca duerme solo para el teléfono: contesta, toma el pedido, ofrece el extra, envía el link de pago por SMS y el pedido llega al mostrador ya pagado.",
    },
    gain: [
      { pt: "Nenhum pedido perdido no rush — e pago antes de sair", en: "No order lost at rush — and paid before it goes out", es: "Ningún pedido perdido en la hora pico — y pagado antes de salir" },
      { pt: "Upsell automático: bebida, doce, tamanho maior", en: "Automatic upsell: drink, pastry, larger size", es: "Upsell automático: bebida, postre, tamaño más grande" },
      { pt: "Atende em inglês, português e espanhol — o bairro inteiro compra", en: "Answers in English, Portuguese and Spanish — the whole neighborhood buys", es: "Contesta en inglés, portugués y español — todo el barrio compra" },
    ],
    edge: {
      pt: "Enquanto o café da esquina deixa o telefone tocar no rush, o seu atende em 2 segundos e ainda cobra na ligação — quem atende primeiro leva o pedido.",
      en: "While the café on the corner lets the phone ring at rush, yours answers in 2 seconds and even collects on the call — whoever answers first gets the order.",
      es: "Mientras el café de la esquina deja sonar el teléfono en la hora pico, el tuyo contesta en 2 segundos y hasta cobra en la llamada — quien contesta primero se queda el pedido.",
    },
    opener: {
      pt: "Posso te perguntar uma coisa? No rush da manhã, quando o telefone toca com pedido pra viagem, quem consegue atender?",
      en: "Can I ask you something? At the morning rush, when the phone rings with a to-go order, who can actually pick up?",
      es: "¿Te puedo preguntar algo? En la hora pico de la mañana, cuando suena el teléfono con un pedido para llevar, ¿quién alcanza a contestar?",
    },
    discovery: [
      { pt: "Quantos pedidos por telefone vocês acham que perdem por dia no rush?", en: "How many phone orders do you figure you miss a day at rush?", es: "¿Cuántos pedidos por teléfono creen que pierden al día en la hora pico?" },
      { pt: "Já aconteceu de anotar pedido errado na correria — e sair no prejuízo?", en: "Ever taken an order down wrong in the chaos — and eaten the cost?", es: "¿Les ha pasado anotar mal un pedido con la prisa — y asumir la pérdida?" },
    ],
    objection: {
      q: { pt: K_WRONG.q.pt, en: K_WRONG.q.en, es: K_WRONG.q.es },
      a: { pt: K_WRONG.a.pt, en: K_WRONG.a.en, es: K_WRONG.a.es },
    },
  },

  cleaning: {
    pain: {
      pt: "Você tá no meio de uma faxina e o telefone toca com orçamento novo — não dá pra parar, e quem precisa de limpeza fecha com quem respondeu primeiro.",
      en: "You're mid-clean and the phone rings with a new quote request — you can't stop, and whoever needs cleaning books with whoever answered first.",
      es: "Estás en plena limpieza y suena el teléfono con un presupuesto nuevo — no puedes parar, y quien necesita limpieza cierra con quien respondió primero.",
    },
    leak: {
      pt: "Um cliente recorrente de limpeza vale $150–300 TODO mês — cada ligação perdida pode ser um ano de receita indo embora.",
      en: "A recurring cleaning client is worth $150–300 EVERY month — each missed call can be a year of revenue walking away.",
      es: "Un cliente recurrente de limpieza vale $150–300 CADA mes — cada llamada perdida puede ser un año de ingresos que se va.",
    },
    solution: {
      pt: "Um funcionário que nunca dorme cuida do seu telefone: atende, passa o orçamento, agenda a visita e ainda cobra o sinal pra reservar — enquanto você termina a casa que está limpando.",
      en: "An employee that never sleeps runs your phone: answers, gives the quote, books the visit, and even collects the deposit to reserve — while you finish the house you're cleaning.",
      es: "Un empleado que nunca duerme maneja tu teléfono: contesta, da el presupuesto, agenda la visita y hasta cobra el depósito para reservar — mientras terminas la casa que estás limpiando.",
    },
    gain: [
      { pt: "Todo orçamento respondido na hora — antes do concorrente", en: "Every quote answered instantly — before the competitor", es: "Cada presupuesto respondido al instante — antes que el competidor" },
      { pt: "Agendamento com sinal pago: cliente que reserva, aparece", en: "Booking with a paid deposit: clients who reserve show up", es: "Reserva con depósito pagado: el cliente que reserva sí llega" },
      { pt: "Atende em inglês, português e espanhol — nenhum cliente travado no idioma", en: "Answers in English, Portuguese and Spanish — no client lost to language", es: "Contesta en inglés, portugués y español — ningún cliente perdido por el idioma" },
    ],
    edge: {
      pt: "Enquanto a concorrente retorna a ligação à noite, a sua empresa já orçou, agendou e recebeu o sinal — quem responde primeiro fica com a casa.",
      en: "While the competitor returns the call at night, your company already quoted, booked and took the deposit — whoever responds first gets the house.",
      es: "Mientras la competencia devuelve la llamada de noche, tu empresa ya cotizó, agendó y cobró el depósito — quien responde primero se queda la casa.",
    },
    opener: {
      pt: "Posso te fazer uma pergunta? Quando você tá limpando e entra ligação de cliente novo pedindo orçamento, o que acontece com ela?",
      en: "Can I ask you something? When you're cleaning and a new customer calls for a quote, what happens to that call?",
      es: "¿Te puedo hacer una pregunta? Cuando estás limpiando y entra una llamada de un cliente nuevo pidiendo presupuesto, ¿qué pasa con ella?",
    },
    discovery: [
      { pt: "Quantos pedidos de orçamento chegam por semana — e quantos você responde no mesmo dia?", en: "How many quote requests come in a week — and how many do you answer same-day?", es: "¿Cuántas solicitudes de presupuesto llegan por semana — y cuántas respondes el mismo día?" },
      { pt: "Um cliente fixo novo vale quanto pra você por ano?", en: "What's one new recurring client worth to you per year?", es: "¿Cuánto te vale al año un cliente fijo nuevo?" },
    ],
    objection: {
      q: { pt: K_LATER.q.pt, en: K_LATER.q.en, es: K_LATER.q.es },
      a: { pt: K_LATER.a.pt, en: K_LATER.a.en, es: K_LATER.a.es },
    },
  },
};
