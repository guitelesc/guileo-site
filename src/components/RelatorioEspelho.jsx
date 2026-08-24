// RelatorioEspelho — O GROWTH REPORT COM A CARA DA LANDING (2026-08-18)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// PEDIDO DO LUIS, LITERAL: «a página tem que espelhar o site — padrão no nível da landing, com o
// mesmo design». O relatório já provava o VAZAMENTO (score, dinheiro em risco, plano em 2 fases);
// faltava a parte que a landing faz bem e ele nunca teve: os três pilares, a vitrine de produtos,
// a prova/garantia e o fechamento. Sem isso, quem abre o link vê um diagnóstico — não uma empresa.
//
// O QUE ESTE ARQUIVO É: os blocos que ESPELHAM a landing dentro do relatório, com duas diferenças
// que são a razão de existirem separados do componente da landing:
//   1. A COR é a do CLIENTE (`accent` do payload/URL), não a paleta da casa. Brain·AD·Build
//      mantêm as cores canônicas onde elas são o NOME do pilar; o resto veste a marca dele.
//   2. O CONTEÚDO é MEDIDO NELE. Cada pilar mostra as notas dos aspectos que aquele pilar cobre,
//      tiradas do payload — é o que separa "o que a Guileo faz" de "o que a Guileo faz por VOCÊ".
//
// ── AS TRAVAS (as mesmas da página que hospeda estes blocos) ────────────────────────────────────
//  · NADA INVENTADO. Todo número vem de `metricas_internas`/`previsoes` (medido no negócio dela)
//    ou de `productSystem.js` (o catálogo aprovado). Faltou o dado? o bloco não renderiza.
//    Um bloco ausente é informação; um bloco preenchido no chute é mentira.
//  · UM IDIOMA SÓ. O dicionário `E` cobre os 4 (en/pt/es/hi) e o `lang` vem do PAYLOAD, igual ao
//    resto da página. Nada de moldura EN com conteúdo PT — lei do repo.
//  · A PALAVRA DOS PILARES VEM DA LANDING (`PILLAR_COPY` em PillarsProducts.jsx). Reescrever aqui
//    criaria duas verdades sobre o mesmo pilar — o defeito que o próprio PillarsProducts narra.
//  · A LISTA DE PRODUTOS VEM DE `productSystem.js`. Produto novo aparece sozinho; produto que sai
//    some sozinho. Lista escrita à mão aqui já teria a validade vencida na próxima onda.
//  · SEM CONTADOR ANIMADO NESTES BLOCOS, DE PROPÓSITO. Este relatório é um link que o Luis MANDA:
//    a aba pode nascer em segundo plano, onde o rAF congela e um contador para no meio mostrando
//    um número FALSO (aconteceu — "4 ligações perdidas" em cima da premissa que dizia 33). Os
//    contadores que já existem na página foram consertados para NASCER no valor final; aqui a
//    decisão é mais simples e não tem como regredir: número estático nunca mente.
// ════════════════════════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { PRODUCTS, productsForPilar, productDetail } from "../data/productSystem.js";
import { GUILEO_PLANS } from "../data/guileoPlans.js";
import { PILLAR_COPY } from "./PillarsProducts.jsx";
import { PULSE_COPY, PAINEL } from "./PulseSection.jsx";
import guileoMark from "../assets/guileo-mark.png";
import { FaInstagram, FaTiktok, FaMeta, FaGoogle, FaYoutube, FaWhatsapp, FaFacebookF } from "react-icons/fa6";
import { SiOpenai } from "react-icons/si";
import { bandColor, aspectLabel, NOT_MEASURED, PERDA, GANHO } from "../lib/reportScale.js";

/* ── dicionário local, 4 idiomas (padrão da página: Contact.jsx / Apresentacao.jsx) ──────────── */
const E = {
  en: {
    coverAuto: "Cover, logo and colour read automatically from your own website.",
    coverBrand: "Your site publishes no cover image, so this band uses your logo and your brand colour. We never invent an image.",
    visit: "Open the site",
    where: "Locations",

    numTitle: "Your business, in your own numbers",
    numSub: "Read from your live Guileo account — measured, not estimated.",
    nServices: "services in the catalog",
    nPriced: "with a set price",
    nUnpriced: "still with no price",
    nLocations: "locations",
    nStaff: "professionals",
    nCalls: "calls on the line (30 days)",
    nBookings: "bookings (30 days)",
    nTicket: "average ticket",
    nRange: "price range",
    nOpen: "hours open per week",
    nKb: "knowledge documents the agent reads",
    sellsBarPriced: "priced",
    sellsBarUnpriced: "no price",
    sellsBarOf: (t) => `of ${t} services in the catalog`,
    funnelGone: "called and did not become a booking",
    famSells: "What you sell",
    famOps: "How you operate",
    famFunnel: "The funnel, last 30 days",
    famBrain: "What the agent already knows",
    funnelCalls: "calls on the line",
    funnelBooked: "turned into a booking",
    funnelNote: "Same window, same source. We do not call the rest \u201clost\u201d \u2014 not every call is someone trying to book, and we will not turn a real number into a claim we cannot defend.",
    unpricedWhy: "Each one becomes an invented quote on the call, or a quote request that waits for a human.",
    catTitle: "Your services, at your prices",
    catSub: "The exact catalog the agent quotes from — one price per service, per location. It never invents a number.",
    noPrice: "no price yet",
    noPriceWhy: "A service with no price becomes an invented quote on the call. These are the ones worth pricing first.",

    anatomia: "Three parts of one body: without a brain nobody answers, without a heart nothing comes in, without a body none of it stands up.",
    legNone: "Nothing in this phase — and that is on purpose: no step was invented to fill the column.",
    legSteps: (n) => `${n} step${n > 1 ? "s" : ""}`,
    legLegend: "Colour tells you WHICH LEG does the work. The seal tells you whether the gain was measured (✓) or is potential (◔).",
    pulseTag: "on us",
    pulseEyebrow: "Included, at no cost",
    pulseTitle: "Guileo Pulse",
    pulseCat: "Experience Management · a Guileo product",
    pulseWhy: "Qualtrics has to send a survey and hope someone answers. Pulse reads how the customer felt in the conversations that already happened — every call the agent takes — and turns that into one number.",
    pulseSim: "simulation",
    pulseSimNote: "The dial and the bars below are moving to SHOW YOU THE INSTRUMENT — they are a simulation, not a reading of your business.",
    pulseWays: "Two ways in — you get both",
    pulseWay1: ["🎧", "Reads the conversations that already happened", "Every call the agent takes is scored for sentiment — no one has to answer anything."],
    pulseWay2: ["✉️", "And it also sends the survey", "After the visit, a branded 1-tap survey goes out in your name, capturing what the customer asked for and how it ended — and the result reports back to you."],
    pulseInstr: "The instrument, before your first reading",
    pulseEmpty: "No score yet — it starts the day the agent goes live. We will never show you a number we did not measure.",
    pulseGiftLine: "Yours at no charge with the plan above.",
    pulseSeeMore: "See how Pulse works",
    pilTitle: "The three pillars, on your business",
    pilSub: "The same three pillars that run guileoai.com — here with YOUR measured scores under each one.",
    chTitle: "Every channel Guileo works",
    chSub: "Where we publish, answer and get found for you. This is what Guileo covers — not a reading of your business.",
    chAI: "AI discovery",
    chSocial: "Social & messaging",
    chFound: "Found by search",
    chOn: "present on your site",
    chOff: "not found on your site",
    pilWeak: "weakest link here",
    pilOrder: ["it thinks and answers","it pumps demand in","it holds everything up"],
    pilMeasured: "Measured in your business",
    pilDelivers: "What it delivers",

    catalogEyebrow: (n) => `${n} services · one system`,
    catalogTitle: "Everything Guileo delivers",
    catalogSub: "The full catalog, by pillar. What you activate is the plan in the two phases above — the rest stays here, ready.",
    giftTag: "on us",
    estimateNote: "~ marks a market estimate by sector, not a measurement of your business. Every figure measured in YOUR business is above, with its assumption written out.",

    perMo: "/mo",
    proofTitle: "Why you can trust this",
    proofSub: "Only claims that are true of the real platform — no logo wall, no invented counter.",
    seals: [
      ["🛡️", "30-day money-back", "the risk is ours"],
      ["👤", "A real human supervises", "not just a bot"],
      ["⚡", "Live in under 7 days", "we wire it all"],
      ["🌎", "16 languages", "every channel, 24/7"],
    ],
    stdTitle: "Built to standards like",
    stdSub: "We align our practices with these standards from day one — your data and your customers, carefully governed. A BAA is available on request.",

    cmpTitle: "Today vs. with the agent",
    cmpSub: "Every line on the left is measured in this report. Nothing on this table is an industry average.",
    cmpToday: "Today",
    cmpWith: "With the agent",
    cmpClosed: (h) => `${h}h/week with nobody on the phone`,
    cmpClosedW: "Answered every hour of the week, all year",
    cmpMissed: (n) => `~${n} calls/month go to voicemail`,
    cmpMissedW: "Every call answered — several at once, so the line is never busy",
    cmpRisk: (v) => `${v}/month at risk`,
    cmpRiskW: (v) => `${v}/month covered by Phase 1`,
    cmpUnpriced: (n) => `${n} service(s) with no price`,
    cmpUnpricedW: "Exact price from your catalog, or the quote request captured with name + phone",
    cmpLang: "Site in one language only",
    cmpLangW: "16 languages, native voice in each",
    cmpText: "No text channel",
    cmpTextW: "Same agent on site chat and WhatsApp, same calendar",
    cmpForm: "The main contact is a form",
    cmpFormW: "Form filled = the agent calls in ~60 seconds",

    closeTitle: "The offer, in plain numbers",
    closePlan: (n, p) => `${n} — ${p}`,
    closeVs: (v) => `against ${v}/month measured at risk in this report`,
    setupLabel: "Implementation, one time",
    setupWas: "normally",
    setupWhat: "Everything set up and live in ~7 days: your agent trained on your own catalog, your number connected, calendar wired, channels on and the cockpit handed over.",
    closeGuarantee: "30 days money-back. If it doesn't hold up, you get your money back.",
    closeNote: "Prices and plans from the Guileo catalog. What each phase activates is the plan above.",
  },
  pt: {
    coverAuto: "Capa, logo e cor lidas automaticamente do site do seu negócio.",
    coverBrand: "O seu site não publica imagem de capa, então esta faixa usa a sua logo e a sua cor de marca. A gente nunca inventa imagem.",
    visit: "Abrir o site",
    where: "Unidades",

    numTitle: "O seu negócio, nos seus próprios números",
    numSub: "Lidos da sua conta Guileo ao vivo — medidos, não estimados.",
    nServices: "serviços no catálogo",
    nPriced: "com preço definido",
    nUnpriced: "ainda sem preço",
    nLocations: "unidades",
    nStaff: "profissionais",
    nCalls: "ligações na linha (30 dias)",
    nBookings: "agendamentos (30 dias)",
    nTicket: "ticket médio",
    nRange: "faixa de preço",
    nOpen: "horas abertas por semana",
    nKb: "documentos de conhecimento que a agente lê",
    sellsBarPriced: "com preço",
    sellsBarUnpriced: "sem preço",
    sellsBarOf: (t) => `de ${t} serviços no catálogo`,
    funnelGone: "ligaram e não viraram agendamento",
    famSells: "O que você vende",
    famOps: "Como você opera",
    famFunnel: "O funil, últimos 30 dias",
    famBrain: "O que a agente já sabe",
    funnelCalls: "ligações na linha",
    funnelBooked: "viraram agendamento",
    funnelNote: "Mesma janela, mesma fonte. A gente NÃO chama o resto de \u201cperdido\u201d \u2014 nem toda ligação é alguém querendo marcar, e não vamos transformar um número real numa afirmação que não dá pra defender.",
    unpricedWhy: "Cada um vira uma cotação inventada na ligação, ou um pedido de orçamento que fica esperando uma pessoa.",
    catTitle: "Os seus serviços, com os seus preços",
    catSub: "O catálogo exato de onde a agente tira o preço — um preço por serviço, por unidade. Ela nunca inventa valor.",
    noPrice: "ainda sem preço",
    noPriceWhy: "Serviço sem preço vira cotação inventada na ligação. Estes são os primeiros que vale precificar.",

    anatomia: "Três partes de um corpo só: sem cérebro ninguém atende, sem coração não entra movimento, sem corpo nada disso fica de pé.",
    legNone: "Nada nesta fase — e é de propósito: nenhum passo foi inventado pra preencher a coluna.",
    legSteps: (n) => `${n} passo${n > 1 ? "s" : ""}`,
    legLegend: "A cor diz QUAL PERNA faz o trabalho. O selo diz se o ganho foi medido (✓) ou é potencial (◔).",
    pulseTag: "de brinde",
    pulseEyebrow: "Incluído, sem custo",
    pulseTitle: "Guileo Pulse",
    pulseCat: "Gestão de Experiência · um produto Guileo",
    pulseWhy: "A Qualtrics precisa mandar uma pesquisa e torcer pra alguém responder. O Pulse lê como o cliente se sentiu nas conversas que JÁ aconteceram — em toda ligação que a agente atende — e transforma isso numa nota só.",
    pulseSim: "simulação",
    pulseSimNote: "O ponteiro e as barras abaixo estão se movendo para MOSTRAR O INSTRUMENTO — é uma simulação, não uma medição do seu negócio.",
    pulseWays: "Dois caminhos — você recebe os dois",
    pulseWay1: ["🎧", "Lê as conversas que já aconteceram", "Toda ligação que a agente atende é pontuada por sentimento — ninguém precisa responder nada."],
    pulseWay2: ["✉️", "E também manda a pesquisa", "Depois do atendimento, sai uma pesquisa de 1 toque com a sua marca, capturando o que o cliente pediu e como terminou — e o resultado volta pra você."],
    pulseInstr: "O instrumento, antes da sua primeira medição",
    pulseEmpty: "Ainda sem nota — ela começa no dia em que a agente entra no ar. A gente nunca vai te mostrar um número que não mediu.",
    pulseGiftLine: "Seu, sem cobrança, junto com o plano acima.",
    pulseSeeMore: "Ver como o Pulse funciona",
    pilTitle: "Os três pilares, no seu negócio",
    pilSub: "Os mesmos três pilares que rodam o guileoai.com — aqui com as SUAS notas medidas embaixo de cada um.",
    chTitle: "Todo canal em que a Guileo atua",
    chSub: "Onde a gente publica, responde e é encontrada por você. Isto é o que a Guileo cobre — não é uma medição do seu negócio.",
    chAI: "Descoberta por IA",
    chSocial: "Redes e mensagens",
    chFound: "Encontrado na busca",
    chOn: "presente no seu site",
    chOff: "não encontrado no seu site",
    pilWeak: "elo mais fraco aqui",
    pilOrder: ["pensa e atende","bombeia movimento pra dentro","sustenta tudo de pé"],
    pilMeasured: "Medido no seu negócio",
    pilDelivers: "O que entrega",

    catalogEyebrow: (n) => `${n} serviços · um sistema`,
    catalogTitle: "Tudo o que a Guileo entrega",
    catalogSub: "O catálogo inteiro, por pilar. O que você ativa é o plano das duas fases acima — o resto fica aqui, pronto.",
    giftTag: "de brinde",
    estimateNote: "O ~ marca estimativa de mercado por setor, não medição do seu negócio. Todo número medido NO SEU negócio está acima, com a premissa escrita.",

    perMo: "/mês",
    proofTitle: "Por que dá pra confiar",
    proofSub: "Só o que é verdade da plataforma real — sem parede de logo, sem contador inventado.",
    seals: [
      ["🛡️", "Garantia de 30 dias", "o risco é nosso"],
      ["👤", "Um humano supervisiona", "não é só um robô"],
      ["⚡", "No ar em até 7 dias", "a gente liga tudo"],
      ["🌎", "16 idiomas", "todo canal, 24/7"],
    ],
    stdTitle: "Construído com padrões como",
    stdSub: "Alinhamos nossas práticas a esses padrões desde o dia um — seus dados e seus clientes, cuidadosamente governados. Um BAA disponível mediante solicitação.",

    cmpTitle: "Hoje × com a agente",
    cmpSub: "Cada linha da esquerda foi medida neste relatório. Nada nesta tabela é média de mercado.",
    cmpToday: "Hoje",
    cmpWith: "Com a agente",
    cmpClosed: (h) => `${h}h/semana com o telefone sem ninguém`,
    cmpClosedW: "Atendido em toda hora da semana, o ano inteiro",
    cmpMissed: (n) => `~${n} ligações/mês caem na caixa postal`,
    cmpMissedW: "Toda ligação atendida — várias ao mesmo tempo, a linha nunca dá ocupado",
    cmpRisk: (v) => `${v}/mês em risco`,
    cmpRiskW: (v) => `${v}/mês cobertos pela Fase 1`,
    cmpUnpriced: (n) => `${n} serviço(s) sem preço`,
    cmpUnpricedW: "Preço exato do seu catálogo — ou o pedido de orçamento registrado com nome + telefone",
    cmpLang: "Site em um idioma só",
    cmpLangW: "16 idiomas, voz nativa em cada um",
    cmpText: "Nenhum canal de texto",
    cmpTextW: "A mesma agente no chat do site e no WhatsApp, com a mesma agenda",
    cmpForm: "O contato principal é um formulário",
    cmpFormW: "Formulário preenchido = a agente liga em ~60 segundos",

    closeTitle: "A proposta, em números limpos",
    closePlan: (n, p) => `${n} — ${p}`,
    closeVs: (v) => `contra ${v}/mês medidos em risco neste relatório`,
    setupLabel: "Implementação, uma única vez",
    setupWas: "normalmente",
    setupWhat: "Tudo montado e no ar em ~7 dias: sua agente treinada no seu próprio catálogo, seu número conectado, agenda ligada, canais no ar e o painel na sua mão.",
    closeGuarantee: "30 dias de garantia. Se não se sustentar, você recebe o dinheiro de volta.",
    closeNote: "Preços e planos do catálogo Guileo. O que cada fase ativa é o plano acima.",
  },
  es: {
    coverAuto: "Portada, logo y color leídos automáticamente del sitio de tu negocio.",
    coverBrand: "Tu sitio no publica imagen de portada, así que esta franja usa tu logo y tu color de marca. Nunca inventamos una imagen.",
    visit: "Abrir el sitio",
    where: "Sedes",

    numTitle: "Tu negocio, en tus propios números",
    numSub: "Leídos de tu cuenta Guileo en vivo — medidos, no estimados.",
    nServices: "servicios en el catálogo",
    nPriced: "con precio definido",
    nUnpriced: "todavía sin precio",
    nLocations: "sedes",
    nStaff: "profesionales",
    nCalls: "llamadas en la línea (30 días)",
    nBookings: "reservas (30 días)",
    nTicket: "ticket promedio",
    nRange: "rango de precio",
    nOpen: "horas abiertas por semana",
    nKb: "documentos de conocimiento que lee la agente",
    sellsBarPriced: "con precio",
    sellsBarUnpriced: "sin precio",
    sellsBarOf: (t) => `de ${t} servicios en el catálogo`,
    funnelGone: "llamaron y no se volvieron reserva",
    famSells: "Lo que vendes",
    famOps: "Cómo operas",
    famFunnel: "El embudo, últimos 30 días",
    famBrain: "Lo que la agente ya sabe",
    funnelCalls: "llamadas en la línea",
    funnelBooked: "se volvieron reserva",
    funnelNote: "Misma ventana, misma fuente. NO llamamos \u201cperdido\u201d al resto \u2014 no toda llamada es alguien queriendo reservar, y no vamos a convertir un número real en una afirmación que no podemos defender.",
    unpricedWhy: "Cada uno se vuelve una cotización inventada en la llamada, o un pedido de presupuesto que espera a una persona.",
    catTitle: "Tus servicios, con tus precios",
    catSub: "El catálogo exacto del que la agente saca el precio — un precio por servicio, por sede. Nunca inventa un valor.",
    noPrice: "todavía sin precio",
    noPriceWhy: "Un servicio sin precio se vuelve una cotización inventada en la llamada. A estos conviene ponerles precio primero.",

    anatomia: "Tres partes de un mismo cuerpo: sin cerebro nadie atiende, sin corazón no entra movimiento, sin cuerpo nada de eso se sostiene.",
    legNone: "Nada en esta fase — y es a propósito: ningún paso fue inventado para llenar la columna.",
    legSteps: (n) => `${n} paso${n > 1 ? "s" : ""}`,
    legLegend: "El color dice QUÉ PIERNA hace el trabajo. El sello dice si la ganancia fue medida (✓) o es potencial (◔).",
    pulseTag: "de regalo",
    pulseEyebrow: "Incluido, sin costo",
    pulseTitle: "Guileo Pulse",
    pulseCat: "Gestión de Experiencia · un producto Guileo",
    pulseWhy: "Qualtrics tiene que mandar una encuesta y esperar que alguien responda. Pulse lee cómo se sintió el cliente en las conversaciones que YA ocurrieron — en cada llamada que atiende la agente — y lo convierte en una sola nota.",
    pulseSim: "simulación",
    pulseSimNote: "La aguja y las barras de abajo se mueven para MOSTRARTE EL INSTRUMENTO — es una simulación, no una medición de tu negocio.",
    pulseWays: "Dos caminos — recibes los dos",
    pulseWay1: ["🎧", "Lee las conversaciones que ya ocurrieron", "Cada llamada que atiende la agente se puntúa por sentimiento — nadie tiene que responder nada."],
    pulseWay2: ["✉️", "Y también manda la encuesta", "Después de la visita sale una encuesta de 1 toque con tu marca, capturando lo que pidió el cliente y cómo terminó — y el resultado vuelve a ti."],
    pulseInstr: "El instrumento, antes de tu primera medición",
    pulseEmpty: "Todavía sin nota — empieza el día en que la agente entra en operación. Nunca te mostraremos un número que no medimos.",
    pulseGiftLine: "Tuyo sin cargo, junto con el plan de arriba.",
    pulseSeeMore: "Ver cómo funciona Pulse",
    pilTitle: "Los tres pilares, en tu negocio",
    pilSub: "Los mismos tres pilares que mueven guileoai.com — aquí con TUS notas medidas debajo de cada uno.",
    chTitle: "Cada canal en el que Guileo actúa",
    chSub: "Donde publicamos, respondemos y nos encuentran por ti. Esto es lo que Guileo cubre — no es una medición de tu negocio.",
    chAI: "Descubrimiento por IA",
    chSocial: "Redes y mensajes",
    chFound: "Encontrado en la búsqueda",
    chOn: "presente en tu sitio",
    chOff: "no encontrado en tu sitio",
    pilWeak: "eslabón más débil aquí",
    pilOrder: ["piensa y atiende","bombea demanda hacia adentro","sostiene todo en pie"],
    pilMeasured: "Medido en tu negocio",
    pilDelivers: "Lo que entrega",

    catalogEyebrow: (n) => `${n} servicios · un sistema`,
    catalogTitle: "Todo lo que entrega Guileo",
    catalogSub: "El catálogo completo, por pilar. Lo que activas es el plan de las dos fases de arriba — el resto queda aquí, listo.",
    giftTag: "de regalo",
    estimateNote: "El ~ marca una estimación de mercado por sector, no una medición de tu negocio. Cada número medido EN TU negocio está arriba, con su premisa escrita.",

    perMo: "/mes",
    proofTitle: "Por qué puedes confiar",
    proofSub: "Solo lo que es cierto de la plataforma real — sin muro de logos, sin contador inventado.",
    seals: [
      ["🛡️", "Garantía de 30 días", "el riesgo es nuestro"],
      ["👤", "Un humano supervisa", "no es solo un bot"],
      ["⚡", "En vivo en 7 días", "lo conectamos todo"],
      ["🌎", "16 idiomas", "cada canal, 24/7"],
    ],
    stdTitle: "Construido con estándares como",
    stdSub: "Alineamos nuestras prácticas con estos estándares desde el día uno — tus datos y tus clientes, cuidadosamente gobernados. Un BAA disponible a pedido.",

    cmpTitle: "Hoy × con la agente",
    cmpSub: "Cada línea de la izquierda fue medida en este informe. Nada en esta tabla es un promedio de mercado.",
    cmpToday: "Hoy",
    cmpWith: "Con la agente",
    cmpClosed: (h) => `${h}h/semana con el teléfono sin nadie`,
    cmpClosedW: "Atendido cada hora de la semana, todo el año",
    cmpMissed: (n) => `~${n} llamadas/mes caen al buzón`,
    cmpMissedW: "Cada llamada atendida — varias a la vez, la línea nunca da ocupado",
    cmpRisk: (v) => `${v}/mes en riesgo`,
    cmpRiskW: (v) => `${v}/mes cubiertos por la Fase 1`,
    cmpUnpriced: (n) => `${n} servicio(s) sin precio`,
    cmpUnpricedW: "Precio exacto de tu catálogo — o el pedido de cotización registrado con nombre + teléfono",
    cmpLang: "Sitio en un solo idioma",
    cmpLangW: "16 idiomas, voz nativa en cada uno",
    cmpText: "Ningún canal de texto",
    cmpTextW: "La misma agente en el chat del sitio y en WhatsApp, con la misma agenda",
    cmpForm: "El contacto principal es un formulario",
    cmpFormW: "Formulario enviado = la agente llama en ~60 segundos",

    closeTitle: "La propuesta, en números limpios",
    closePlan: (n, p) => `${n} — ${p}`,
    closeVs: (v) => `contra ${v}/mes medidos en riesgo en este informe`,
    setupLabel: "Implementación, una sola vez",
    setupWas: "normalmente",
    setupWhat: "Todo montado y en el aire en ~7 días: tu agente entrenada con tu propio catálogo, tu número conectado, agenda enlazada, canales activos y el panel en tus manos.",
    closeGuarantee: "30 días de garantía. Si no se sostiene, recuperas tu dinero.",
    closeNote: "Precios y planes del catálogo Guileo. Lo que activa cada fase es el plan de arriba.",
  },
  hi: {
    coverAuto: "कवर, लोगो और रंग आपकी अपनी वेबसाइट से अपने आप पढ़े गए।",
    coverBrand: "आपकी साइट कोई कवर इमेज प्रकाशित नहीं करती, इसलिए यह पट्टी आपका लोगो और ब्रांड रंग इस्तेमाल करती है। हम कभी इमेज नहीं गढ़ते।",
    visit: "साइट खोलें",
    where: "शाखाएँ",

    numTitle: "आपका व्यवसाय, आपके अपने आँकड़ों में",
    numSub: "आपके लाइव Guileo खाते से पढ़ा गया — मापा गया, अनुमान नहीं।",
    nServices: "कैटलॉग में सेवाएँ",
    nPriced: "जिनका दाम तय है",
    nUnpriced: "जिनका दाम अब तक नहीं",
    nLocations: "शाखाएँ",
    nStaff: "पेशेवर",
    nCalls: "लाइन पर कॉलें (30 दिन)",
    nBookings: "बुकिंग (30 दिन)",
    nTicket: "औसत टिकट",
    nRange: "दाम की रेंज",
    nOpen: "प्रति सप्ताह खुले घंटे",
    nKb: "ज्ञान दस्तावेज़ जो एजेंट पढ़ती है",
    sellsBarPriced: "दाम के साथ",
    sellsBarUnpriced: "बिना दाम",
    sellsBarOf: (t) => `कैटलॉग की ${t} सेवाओं में से`,
    funnelGone: "कॉल कीं और बुकिंग नहीं बनीं",
    famSells: "आप क्या बेचते हैं",
    famOps: "आप कैसे चलाते हैं",
    famFunnel: "फ़नल, पिछले 30 दिन",
    famBrain: "एजेंट पहले से क्या जानती है",
    funnelCalls: "लाइन पर आईं कॉलें",
    funnelBooked: "बुकिंग में बदलीं",
    funnelNote: "वही अवधि, वही स्रोत। बाकी को हम \u201cखोया हुआ\u201d नहीं कहते \u2014 हर कॉल बुकिंग के लिए नहीं होती, और हम किसी असली आँकड़े को ऐसा दावा नहीं बनाएँगे जिसे साबित न कर सकें।",
    unpricedWhy: "हर एक कॉल पर गढ़ा हुआ दाम बन जाता है, या ऐसा कोटेशन अनुरोध जो किसी इंसान का इंतज़ार करता है।",
    catTitle: "आपकी सेवाएँ, आपके दामों पर",
    catSub: "वही कैटलॉग जिससे एजेंट दाम बताती है — हर सेवा, हर शाखा का एक दाम। वह कभी दाम नहीं गढ़ती।",
    noPrice: "अब तक दाम नहीं",
    noPriceWhy: "बिना दाम वाली सेवा कॉल पर गढ़ी हुई कोटेशन बन जाती है। पहले इन्हीं का दाम तय करना चाहिए।",

    anatomia: "एक ही शरीर के तीन हिस्से: मस्तिष्क बिना कोई जवाब नहीं देता, हृदय बिना कुछ अंदर नहीं आता, शरीर बिना कुछ भी टिकता नहीं।",
    legNone: "इस चरण में कुछ नहीं — और यह जानबूझकर है: कॉलम भरने के लिए कोई कदम गढ़ा नहीं गया।",
    legSteps: (n) => `${n} कदम`,
    legLegend: "रंग बताता है कि कौन-सा स्तंभ काम करता है। मुहर बताती है कि लाभ मापा गया (✓) है या संभावित (◔)।",
    pulseTag: "मुफ़्त उपहार",
    pulseEyebrow: "शामिल, बिना शुल्क",
    pulseTitle: "Guileo Pulse",
    pulseCat: "अनुभव प्रबंधन · एक Guileo उत्पाद",
    pulseWhy: "Qualtrics को सर्वे भेजकर उम्मीद करनी पड़ती है कि कोई जवाब देगा। Pulse उन बातचीतों से पढ़ता है जो पहले ही हो चुकी हैं — हर उस कॉल से जो एजेंट उठाती है — और उसे एक स्कोर में बदल देता है।",
    pulseSim: "सिमुलेशन",
    pulseSimNote: "नीचे का डायल और बार सिर्फ़ यंत्र दिखाने के लिए चल रहे हैं — यह सिमुलेशन है, आपके व्यवसाय की माप नहीं।",
    pulseWays: "दो रास्ते — दोनों आपको मिलते हैं",
    pulseWay1: ["🎧", "पहले हो चुकी बातचीत को पढ़ता है", "एजेंट जो भी कॉल उठाती है, उसका भाव स्कोर होता है — किसी को कुछ जवाब नहीं देना पड़ता।"],
    pulseWay2: ["✉️", "और सर्वे भी भेजता है", "सेवा के बाद आपके ब्रांड वाला 1-टैप सर्वे जाता है, जो ग्राहक की माँग और अंतिम अनुभव दर्ज करता है — और नतीजा आपके पास लौटता है।"],
    pulseInstr: "यंत्र, आपकी पहली माप से पहले",
    pulseEmpty: "अभी कोई स्कोर नहीं — यह उसी दिन शुरू होता है जब एजेंट लाइव होती है। हम कभी ऐसा नंबर नहीं दिखाएँगे जो मापा न गया हो।",
    pulseGiftLine: "ऊपर वाले प्लान के साथ, आपका बिना किसी शुल्क के।",
    pulseSeeMore: "देखें Pulse कैसे काम करता है",
    pilTitle: "तीन स्तंभ, आपके व्यवसाय पर",
    pilSub: "वही तीन स्तंभ जो guileoai.com चलाते हैं — यहाँ हर एक के नीचे आपके अपने मापे गए स्कोर के साथ।",
    chTitle: "हर चैनल जहाँ Guileo काम करती है",
    chSub: "जहाँ हम आपके लिए पोस्ट करते हैं, जवाब देते हैं और खोजे जाते हैं। यह Guileo का दायरा है — आपके व्यवसाय की माप नहीं।",
    chAI: "AI से खोज",
    chSocial: "सोशल और मैसेजिंग",
    chFound: "सर्च में मिला",
    chOn: "आपकी साइट पर मौजूद",
    chOff: "आपकी साइट पर नहीं मिला",
    pilWeak: "यहाँ सबसे कमज़ोर कड़ी",
    pilOrder: ["सोचती और जवाब देती है","माँग अंदर लाता है","सब कुछ खड़ा रखता है"],
    pilMeasured: "आपके व्यवसाय में मापा गया",
    pilDelivers: "क्या देता है",

    catalogEyebrow: (n) => `${n} सेवाएँ · एक सिस्टम`,
    catalogTitle: "Guileo जो कुछ देती है",
    catalogSub: "पूरा कैटलॉग, स्तंभ के अनुसार। आप जो सक्रिय करते हैं वह ऊपर के दो चरणों की योजना है — बाकी यहीं, तैयार।",
    giftTag: "मुफ़्त उपहार",
    estimateNote: "~ का मतलब सेक्टर-आधारित बाज़ार अनुमान है, आपके व्यवसाय का माप नहीं। आपके व्यवसाय में मापा गया हर आँकड़ा ऊपर है, अपनी धारणा के साथ।",

    perMo: "/माह",
    proofTitle: "इस पर भरोसा क्यों",
    proofSub: "सिर्फ़ वही दावे जो असली प्लेटफ़ॉर्म के लिए सच हैं — कोई लोगो-दीवार नहीं, कोई गढ़ा हुआ काउंटर नहीं।",
    seals: [
      ["🛡️", "30-दिन मनी-बैक", "जोखिम हमारा"],
      ["👤", "एक इंसान निगरानी करता है", "सिर्फ़ बॉट नहीं"],
      ["⚡", "7 दिन में लाइव", "सब हम जोड़ते हैं"],
      ["🌎", "16 भाषाएँ", "हर चैनल, 24/7"],
    ],
    stdTitle: "इन जैसे मानकों के अनुरूप बना",
    stdSub: "हम पहले दिन से अपनी प्रथाओं को इन मानकों के अनुरूप रखते हैं — आपका डेटा और आपके ग्राहक, सावधानी से नियंत्रित। अनुरोध पर BAA उपलब्ध।",

    cmpTitle: "आज × एजेंट के साथ",
    cmpSub: "बाईं ओर की हर पंक्ति इसी रिपोर्ट में मापी गई है। इस तालिका में कुछ भी उद्योग औसत नहीं है।",
    cmpToday: "आज",
    cmpWith: "एजेंट के साथ",
    cmpClosed: (h) => `${h} घंटे/सप्ताह फ़ोन पर कोई नहीं`,
    cmpClosedW: "सप्ताह के हर घंटे, पूरे साल जवाब",
    cmpMissed: (n) => `~${n} कॉल/माह वॉइसमेल में जाती हैं`,
    cmpMissedW: "हर कॉल का जवाब — एक साथ कई भी, लाइन कभी व्यस्त नहीं",
    cmpRisk: (v) => `${v}/माह जोखिम में`,
    cmpRiskW: (v) => `${v}/माह चरण 1 से कवर`,
    cmpUnpriced: (n) => `${n} सेवा(एँ) बिना दाम`,
    cmpUnpricedW: "आपके कैटलॉग से सटीक दाम — या नाम + फ़ोन के साथ दर्ज कोटेशन अनुरोध",
    cmpLang: "साइट सिर्फ़ एक भाषा में",
    cmpLangW: "16 भाषाएँ, हर एक में मूल आवाज़",
    cmpText: "कोई टेक्स्ट चैनल नहीं",
    cmpTextW: "वही एजेंट साइट चैट और WhatsApp पर, वही कैलेंडर",
    cmpForm: "मुख्य संपर्क एक फ़ॉर्म है",
    cmpFormW: "फ़ॉर्म भरा = एजेंट ~60 सेकंड में कॉल करती है",

    closeTitle: "प्रस्ताव, साफ़ आँकड़ों में",
    closePlan: (n, p) => `${n} — ${p}`,
    closeVs: (v) => `इस रिपोर्ट में मापे गए ${v}/माह जोखिम के मुक़ाबले`,
    setupLabel: "इम्प्लीमेंटेशन, एक बार",
    setupWas: "सामान्यतः",
    setupWhat: "~7 दिनों में सब कुछ चालू: आपकी एजेंट आपके अपने कैटलॉग पर प्रशिक्षित, आपका नंबर जुड़ा, कैलेंडर सेट, चैनल चालू और कॉकपिट आपके हाथ में।",
    closeGuarantee: "30 दिन मनी-बैक। अगर टिके नहीं, तो पैसा वापस।",
    closeNote: "कीमतें और प्लान Guileo कैटलॉग से। हर चरण जो सक्रिय करता है वह ऊपर की योजना है।",
  },
};
export const espelhoCopy = (lang) => E[lang] || E.en;

/* ── vocabulário visual da landing, num lugar só ──────────────────────────────────────────────
   Card de vidro (PillarsProducts) + disco "glow glassy cold" (o mesmo ladrilho de ícone que os
   pilares e os pontos do ServicesMarquee usam). Qualquer classe com `backdrop-blur` ainda ganha
   a iluminação de vidro automática do index.css — por isso ela nunca sai daqui. */
const cardGlass = "relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur";
const cardShadow = { boxShadow: "0 22px 60px -34px rgba(0,0,0,0.9)" };
const TopEdge = ({ rgb }) => (
  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]"
    style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.9),transparent)` }} />
);
const IconTile = ({ children, rgb, size = "h-11 w-11 text-[20px]" }) => (
  <span aria-hidden="true" className={`grid ${size} shrink-0 place-items-center rounded-xl`}
    style={{ background: `rgba(${rgb},0.13)`, boxShadow: `inset 0 0 0 1px rgba(${rgb},0.4)`, filter: `drop-shadow(0 4px 12px rgba(${rgb},0.45))` }}>
    {children}
  </span>
);
const Head = ({ eyebrow, title, sub, accent }) => (
  <div className="text-center">
    {eyebrow && <div className="text-[12px] font-bold uppercase tracking-[0.26em]" style={{ color: accent }}>{eyebrow}</div>}
    <h2 className="mx-auto mt-3 max-w-2xl font-black leading-[1.04] tracking-tight text-g-word" style={{ fontSize: "clamp(1.6rem,3.6vw,2.3rem)" }}>{title}</h2>
    {sub && <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-g-ink">{sub}</p>}
  </div>
);

/* ── client logo with hard failure guard ─────────────────────────────────────
   NEVER a broken image: any load error (hotlink block, 404, CORS) falls back to
   the business initials in an accent circle. */
function BrandLogo({ src, name, accent }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  const initials =
    String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "•";
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name || ""}
        onError={() => setBroken(true)}
        loading="eager"
        className="h-16 w-auto max-w-full object-contain sm:h-20"
      />
    );
  }
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-g-deep sm:h-20 sm:w-20 sm:text-2xl"
      style={{ background: accent }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
   1 · CAPA + PERFIL DO SITE DELA
   Luis: «capa e perfil do site dela no topo — automático com o que já temos; se o site bloquear
   robô, cai num fundo da marca dela em vez de quebrar. NUNCA invente imagem.»
   A capa é OPCIONAL por construção: quando `capa` não chega (site sem og:image/twitter:image, ou
   robô bloqueado), a faixa vira um degradê da cor DELA com a logo DELA — que é identidade real,
   não ilustração genérica de banco de imagem. A legenda diz qual dos dois caminhos rodou, porque
   "por que a capa não apareceu" precisa ter resposta, não desconfiança.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
/* ── A LINHA DA AGENTE, NA CAPA (Luis, 2026-08-19) ────────────────────────────────────────────
   «coloca o número da IA dela ali já no perfil, tipo o símbolo do Guileo e o número de telefone
   dela — vai ser lindo. Junto ali na capa.»

   É o selo de que a agente JÁ ESTÁ VIVA na linha: marca Guileo + o número que os clientes dela
   discam e a IA atende. Fica abaixo do nome do negócio de propósito — é prova, não manchete, e
   não pode disputar com o nome dela.

   🚨 O NÚMERO VEM DE FORA, E SE NÃO VIER O BLOCO SOME. `linhaTel` chega por prop; sem prop, não
   renderiza nada. Cliente que ainda não tem linha não tem essa prova para mostrar, e inventar um
   número de exemplo numa capa assinada seria a pior mentira possível desta página — o dono liga
   para conferir em 10 segundos.

   ☎️ E É CLICÁVEL DE PROPÓSITO: o próprio relatório cobra dela, no aspecto "captura de leads",
   que «o telefone não é clicável — no celular o visitante tem que decorar o número». Repetir na
   nossa capa o erro que a gente aponta na dela seria constrangedor. */
export function CapaPerfil({ capa, logo, accent, rgb, business, site, locations = [], lang, eyebrow, linhaData, linhaTel, linhaFmt, linhaLabel }) {
  const c = espelhoCopy(lang);
  const [quebrou, setQuebrou] = useState(false);
  const temCapa = !!capa && !quebrou;
  const host = (() => { try { return new URL(site).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur" style={cardShadow}>
      <TopEdge rgb={rgb} />
      <div className="relative h-36 w-full sm:h-48"
        style={{ background: `linear-gradient(135deg, rgba(${rgb},0.55), rgba(${rgb},0.10) 60%, transparent)` }}>
        {temCapa && (
          <img src={capa} alt="" aria-hidden="true" onError={() => setQuebrou(true)}
            className="h-full w-full object-cover opacity-70" loading="eager" />
        )}
        <span aria-hidden="true" className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(12,12,12,0.92), rgba(12,12,12,0.15))" }} />
      </div>
      <div className="px-5 pb-6 sm:px-7">
        {/* A LOGO SOBREPÕE A CAPA, O NOME FICA EMBAIXO — de propósito. Na primeira versão o nome
            subia junto e ficava atravessado na borda da faixa: metade do texto sobre a foto,
            metade sobre o cartão, com a linha de corte passando no meio das letras. Sobreposição
            é para a MARCA (um bloco compacto, que aguenta); texto longo atravessando uma borda
            só produz aquele efeito de tachado. */}
        <div className="-mt-11 flex">
          {/* BrandLogo, não <img> cru: ele já resolve o caso que mais aparece na vida real —
              hotlink bloqueado / 404 / CORS — desenhando as iniciais do negócio num disco da cor
              dele. Imagem quebrada no topo de um documento de venda é pior que logo nenhuma. */}
          <div className="rounded-xl bg-black/55 p-2.5 ring-1 ring-white/15 backdrop-blur">
            <BrandLogo src={logo} name={business} accent={accent} />
          </div>
        </div>
        <div className="mt-4 min-w-0">
          {eyebrow && <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: accent }}>{eyebrow}</p>}
          <h1 className="mt-0.5 text-2xl font-black leading-tight tracking-tight text-g-word sm:text-3xl">{business}</h1>
          {linhaData && <p className="mt-1 text-[13px] text-g-muted">{linhaData}</p>}
          {/* a linha da agente — marca Guileo + número clicável */}
          {linhaTel && linhaFmt && (
            <a href={`tel:${linhaTel}`}
              /* `flex w-fit`, não `inline-flex`: o link do site logo abaixo também é inline e os
                 dois se sentavam na MESMA linha, sobrepostos. Bloco próprio, largura do conteúdo. */
              className="mt-3 flex w-fit min-h-11 items-center gap-3 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 backdrop-blur transition hover:border-white/25">
              <img src={guileoMark} alt="Guileo" className="h-8 w-8 shrink-0 object-contain" />
              <span className="min-w-0 text-left">
                {linhaLabel && (
                  <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-g-muted">{linhaLabel}</span>
                )}
                <span className="block text-[17px] font-black leading-tight tracking-tight text-g-word sm:text-[19px]"
                  style={{ fontVariantNumeric: "tabular-nums" }}>{linhaFmt}</span>
              </span>
            </a>
          )}
          {host && (
            <a href={site} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold underline decoration-dotted underline-offset-2"
              style={{ color: accent }}>
              🔗 {host} <span className="text-g-muted">· {c.visit}</span>
            </a>
          )}
        </div>
        {locations.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-g-muted">📍 {c.where}</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {locations.map((l, i) => (
                <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12.5px] leading-snug">
                  <span className="font-bold text-g-word">{l.name}</span>
                  {l.address && <span className="block text-g-muted">{l.address}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-[11px] leading-snug text-g-muted">{temCapa ? c.coverAuto : c.coverBrand}</p>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
   2 · OS NÚMEROS DELA + O CATÁLOGO DE SERVIÇOS DELA
   Os números vêm de `metricas_internas` (a conta Guileo ao vivo dela). A lista de serviços vem do
   site público do cliente (/api/client-site) — a MESMA fonte de onde a agente tira o preço.
   ⚠️ SEM AVALIAÇÃO/ESTRELAS. O Luis pediu "estrelas"; a plataforma NÃO guarda nota de avaliação
   deste negócio em lugar nenhum (só existe o link para pedir review). Inventar meia-estrela num
   documento cujo argumento inteiro é "todo número é medido" destruiria o documento. O bloco de
   estrelas simplesmente não existe — quando houver nota real, ele nasce aqui.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
/* ── UM NÚMERO DELA ────────────────────────────────────────────────────────────────────────────
   Luis (2026-08-19): «aqui também precisa ser algo padrão Guileo, original, único: movimento,
   ciclo, integração, inteligência, entrega.»

   O QUE MUDOU E POR QUÊ: eram 11 tiles idênticos, TODOS com o número no accent da cliente. Onze
   fatos pintados da mesma cor são onze fatos sem hierarquia — e num relatório cujo trabalho é
   apontar o vazamento, isso escondia justamente o achado. Número em accent não significa nada;
   número em vermelho se explica sozinho.

   Agora o tom do número diz DE QUE LADO ele está, com a mesma régua semântica do resto da página
   (PERDA/GANHO em reportScale.js):
     • PERDA   → o que está vazando hoje. Aqui é só um: "3 ainda sem preço" — o MESMO gap que o
                 passo Priced Catalog já mostra em vermelho, então a página fala uma coisa só.
     • GANHO   → o que ela já produziu (os agendamentos, dentro do funil).
     • neutro  → o retrato. 20 serviços, 3 unidades, 3 profissionais, 16 docs não são bons nem
                 ruins, e pintá-los seria inventar um juízo que o dado não carrega.
   ⚠️ O ACCENT NÃO SUMIU: segue no título da seção, nos cabeçalhos das famílias e no catálogo
   dela — ou seja, continua dizendo "isto é seu". O que ele parou de fazer foi competir com a
   cor que carrega significado.

   Número é ESTÁTICO. Nada de contador: número estático não mente, e esta página já pagou caro
   por um rAF congelado em aba de fundo. O movimento fica na ENTRADA (`.stagger`, que o index.css
   já desliga em prefers-reduced-motion) e na barra do funil, que é forma, não valor. */
/* ── O ÍCONE (Luis, 2026-08-19: «coloca um ÍCONE pra isso — DISCRETO mas IMPORTANTE») ─────────
   O que estava errado: a hierarquia por cor já estava certa, mas o bloco continuava sendo TEXTO
   PURO em caixas — onze informações onde cada número exigia LER o rótulo pra saber do que se
   trata. Isso vira parede. Com ícone, o olho reconhece a categoria antes de ler.

   As duas palavras do Luis se equilibram e definem o desenho: DISCRETO = o disco é pequeno
   (h-8) e o número continua o herói; IMPORTANTE = é o disco de vidro frio de verdade (tint .13 +
   anel interno .4), o mesmo material do resto da página, não um emoji solto perdido no canto.

   ⚠️ FAMÍLIA ÚNICA: emoji dentro do disco, que é a iconografia que a landing, o catálogo
   (`productSystem.js`) e os pilares (`PILLAR_COPY`) já usam. Misturar um SVG aqui criaria duas
   famílias na mesma tela — exatamente o que o pedido proíbe. Os símbolos foram escolhidos pelo
   SIGNIFICADO e reaproveitados de onde já existiam: 🏷️ é o mesmo do catálogo dela logo abaixo,
   📞 o mesmo do produto "answering", 📅 o mesmo do cartão "agenda na hora", 📍 o mesmo das
   unidades na capa.

   ⚠️ E O ÍCONE SEGUE A SEMÂNTICA, não a decoração: o disco herda o MESMO tom do número (vermelho
   no vazamento, verde no ganho, neutro no retrato). Ícone e cor dizendo a mesma coisa reforçam;
   dizendo coisas diferentes, brigam. */
const TOM_RGB = { "#F87171": "248,113,113", "#34D399": "52,211,153" };
const NEUTRO_RGB = "170,162,148";

function Numero({ valor, rotulo, tom, forte, icone, apagado }) {
  const rgb = TOM_RGB[tom] || NEUTRO_RGB;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
      {icone && (
        <span aria-hidden="true"
          className="mb-2.5 grid h-8 w-8 place-items-center rounded-lg text-[15px]"
          style={{
            background: `rgba(${rgb},0.13)`,
            boxShadow: `inset 0 0 0 1px rgba(${rgb},0.4)`,
            opacity: apagado ? 0.5 : 1,
          }}>{icone}</span>
      )}
      {/* os neutros são MENORES de propósito: os 11 números não têm a mesma importância, e dar o
          mesmo tamanho a todos é a própria definição de parede. Só o vazamento cresce. */}
      <div className={`${forte ? "text-[30px]" : "text-[23px]"} font-black leading-none tracking-tight`}
        style={{ color: tom || "#EFEAE0", fontVariantNumeric: "tabular-nums" }}>{valor}</div>
      <div className="mt-1 text-[11.5px] font-semibold leading-snug text-g-ink">{rotulo}</div>
    </div>
  );
}

/* cabeçalho de família — o que transforma 11 tiles soltos em quatro ideias */
function Familia({ titulo, accent, rgb, icone, children }) {
  return (
    <div>
      {/* as quatro âncoras: o cabeçalho de família também ganha disco, porque é ele que faz o
          bloco "ser visível" de relance — quatro pontos de parada antes de qualquer leitura. */}
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[17px]"
          style={{ background: `rgba(${rgb},0.13)`, boxShadow: `inset 0 0 0 1px rgba(${rgb},0.4)`, filter: `drop-shadow(0 4px 12px rgba(${rgb},0.4))` }}>{icone}</span>
        <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>{titulo}</span>
      </div>
      {children}
    </div>
  );
}

export function NumerosDoNegocio({ mi, servicos = [], accent, rgb, lang, moeda, locale, fmt }) {
  const c = espelhoCopy(lang);
  const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const semPreco = n(mi?.servicos) != null && n(mi?.servicos_com_preco) != null
    ? Math.max(0, mi.servicos - mi.servicos_com_preco) : null;

  /* cada tile só existe se o dado existe — nunca um "0" que na verdade é "não sabemos".
     `tom` só é preenchido quando o número TEM um lado; ausência de cor é decisão, não esquecimento. */
  const vende = [
    /* serviços / com preço / sem preço saíram daqui: viraram a BARRA de composição acima,
       porque separados em três tiles iguais eles não contavam a história que contam juntos. */
    [n(mi?.ticket_medio) != null && mi.ticket_medio > 0 ? fmt(Math.round(mi.ticket_medio), moeda, locale) : null, c.nTicket, null, false, "💵"],
    [n(mi?.preco_min) != null && n(mi?.preco_max) != null ? `${fmt(mi.preco_min, moeda, locale)}–${fmt(mi.preco_max, moeda, locale)}` : null, c.nRange, null, false, "💰"],
  ].filter(([v]) => v !== null && v !== undefined);

  const opera = [
    [n(mi?.unidades), c.nLocations, null, false, "📍"],
    [n(mi?.profissionais), c.nStaff, null, false, "👥"],
    [n(mi?.agenda_horas_semana), c.nOpen, null, false, "🕐"],
  ].filter(([v]) => v !== null && v !== undefined);

  const sabe = [[n(mi?.kb_docs), c.nKb, null, false, "📚"]].filter(([v]) => v !== null && v !== undefined);

  /* O FUNIL COMO RELAÇÃO, NÃO COMO DOIS TILES SOLTOS ─────────────────────────────────────────
     "27 ligações" e "3 agendamentos" ficavam em caixas separadas, e separados eles não dizem
     nada; lado a lado, na mesma barra, viram o dado mais forte da página.
     🚨 E É AQUI QUE MORA A TENTAÇÃO: 3 de 27 dá 11%, e chamar isso de "taxa de conversão" seria
     inventar uma causa. Nem toda ligação é alguém querendo marcar — a própria plataforma mede
     ligação que é dúvida, cotação, cliente antigo. Então a barra mostra a PROPORÇÃO REAL dos dois
     números medidos, o verde é só a parte que virou agendamento, e o resto fica CINZA, nunca
     vermelho: pintar de perda seria afirmar que 24 clientes se perderam, e o dado não sustenta
     isso. A frase embaixo diz exatamente isso, pro dono não completar sozinho. */
  const lig = n(mi?.ligacoes_30d);
  const ag = n(mi?.agendamentos_30d);
  const temFunil = lig != null && ag != null && lig > 0;

  if (!vende.length && !opera.length && !sabe.length && !temFunil && !servicos.length) return null;

  /* ── CONTEXTO NÃO SAI, ENCOLHE (Luis: «preciso ter TUDO, mas você sabe como fazer») ─────────
     O pedido não era cortar informação — era matar a sensação de parede. Então nenhum dos 11
     dados saiu; o que mudou foi o PESO. "3 unidades · 3 profissionais · 75h · 16 docs" são
     contexto, não argumento de venda: viram uma faixa horizontal compacta (ícone + valor + rótulo
     em linha), com um terço da altura que tinham como tiles. Continuam 100% legíveis; só param de
     ocupar o mesmo espaço que o vazamento e o funil, que são o argumento.
     O critério final é o dele: tudo visível, nada gritando junto. */
  const faixa = (itens) => (
    <div className="stagger mt-3 flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur">
      {itens.map(([v, r, , , ic]) => (
        <div key={r} className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px]"
            style={{ background: `rgba(${NEUTRO_RGB},0.13)`, boxShadow: `inset 0 0 0 1px rgba(${NEUTRO_RGB},0.4)` }}>{ic}</span>
          <span className="text-[17px] font-black leading-none tracking-tight text-g-word" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</span>
          <span className="text-[11.5px] font-semibold leading-snug text-g-ink">{r}</span>
        </div>
      ))}
    </div>
  );

  const grade = (itens) => (
    <div className="stagger mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {itens.map(([v, r, tom, forte, ic]) => <Numero key={r} valor={v} rotulo={r} tom={tom} forte={forte} icone={ic} />)}
    </div>
  );

  const comPreco = servicos.filter((s) => typeof s.price_cents === "number" && s.price_cents > 0);
  const sem = servicos.filter((s) => !(typeof s.price_cents === "number" && s.price_cents > 0));

  return (
    <section className="mt-16">
      <style>{`
        @keyframes numFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        .num-fill{transform-origin:left center;animation:numFill .9s cubic-bezier(.22,.61,.36,1) .15s both}
        @media (prefers-reduced-motion: reduce){.num-fill{animation:none !important;transform:none !important}}
      `}</style>
      <Head title={c.numTitle} sub={c.numSub} accent={accent} />

      {/* quatro famílias, na ordem em que contam a história: o que ela vende → o que isso já
          produziu → como ela opera → o que a agente já sabe. Família sem dado não renderiza. */}
      <div className="mt-7 space-y-12">
        {vende.length > 0 && (
          <Familia titulo={c.famSells} accent={accent} rgb={rgb} icone="🏷️">
            {/* ── 20 = 17 + 3, NUMA BARRA SÓ ────────────────────────────────────────────────
                   Luis apontou duas vezes: "20 serviços", "17 com preço" e "3 sem preço" eram
                   três tiles do mesmo tamanho, como se fossem três fatos independentes. São UM:
                   a composição do catálogo dela. Na mesma barra, a fatia vermelha é o vazamento
                   e ela se explica sem legenda — e é o MESMO 3 que o passo Priced Catalog cobra
                   em vermelho na Fase 1, então a página fala uma coisa só.
                   Aritmética de dois números medidos, zero número novo. */}
            {n(mi?.servicos) > 0 && n(mi?.servicos_com_preco) != null && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur" style={cardShadow}>
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[30px] font-black leading-none tracking-tight text-g-word" style={{ fontVariantNumeric: "tabular-nums" }}>{mi.servicos_com_preco}</span>
                    <span className="text-[11.5px] font-semibold text-g-ink">{c.sellsBarPriced} · {c.sellsBarOf(mi.servicos)}</span>
                  </div>
                  {semPreco > 0 && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[30px] font-black leading-none tracking-tight" style={{ color: PERDA, fontVariantNumeric: "tabular-nums" }}>{semPreco}</span>
                      <span className="text-[11.5px] font-semibold" style={{ color: PERDA }}>{c.sellsBarUnpriced}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <span className="num-fill h-full" style={{ width: `${(mi.servicos_com_preco / mi.servicos) * 100}%`, background: "rgba(239,234,224,0.55)" }} />
                  {semPreco > 0 && (
                    <span className="num-fill h-full" style={{ width: `${(semPreco / mi.servicos) * 100}%`, background: PERDA }} />
                  )}
                </div>
                {semPreco > 0 && (
                  <p className="mt-3 text-[12px] leading-snug" style={{ color: "#E8B4B4" }}>⚠️ {c.unpricedWhy}</p>
                )}
              </div>
            )}
            {grade(vende)}
          </Familia>
        )}

        {temFunil && (
          <Familia titulo={c.famFunnel} accent={accent} rgb={rgb} icone="☎️">
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur" style={cardShadow}>
              {/* 🚨 O "24" NÃO PODE SER VERDE. Ele saiu assim na 1ª passada porque eu usei
                     `text-g-light`, que no tailwind.config é #6FB892 — verde. Verde nesta página
                     significa GANHO, e pintar de verde "ligaram e NÃO viraram agendamento" é dizer
                     o contrário do que o número diz. O neutro é o tom certo: o 24 é o retrato do
                     que sobra, não um ganho e — deliberadamente — não uma perda declarada.
                     Três colunas em sm+, empilhado no 375 (onde a versão anterior quebrava feio,
                     com a seta boiando à direita do 27). */}
              <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
                <div>
                  <div className="text-[30px] font-black leading-none tracking-tight text-g-word" style={{ fontVariantNumeric: "tabular-nums" }}>{lig}</div>
                  <div className="mt-1 text-[11.5px] font-semibold leading-snug text-g-ink">{c.funnelCalls}</div>
                </div>
                <div className="sm:text-center">
                  <div className="text-[30px] font-black leading-none tracking-tight" style={{ color: GANHO, fontVariantNumeric: "tabular-nums" }}>{ag}</div>
                  <div className="mt-1 text-[11.5px] font-semibold leading-snug text-g-ink">{c.funnelBooked}</div>
                </div>
                {lig - ag > 0 && (
                  <div className="sm:text-right">
                    <div className="text-[30px] font-black leading-none tracking-tight" style={{ color: "#B5AC9E", fontVariantNumeric: "tabular-nums" }}>{lig - ag}</div>
                    <div className="mt-1 text-[11.5px] font-semibold leading-snug text-g-muted">{c.funnelGone}</div>
                  </div>
                )}
              </div>
              {/* a proporção real dos dois números medidos — forma, não afirmação */}
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="num-fill h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(2, (ag / lig) * 100))}%`, background: GANHO }} />
              </div>
              <p className="mt-3 text-[11.5px] leading-snug text-g-muted">{c.funnelNote}</p>
            </div>
          </Familia>
        )}

        {opera.length > 0 && <Familia titulo={c.famOps} accent={accent} rgb={rgb} icone="🏢">{faixa(opera)}</Familia>}
        {sabe.length > 0 && <Familia titulo={c.famBrain} accent={accent} rgb={rgb} icone="📚">{faixa(sabe)}</Familia>}
      </div>

      {servicos.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur" style={cardShadow}>
          <TopEdge rgb={rgb} />
          <div className="flex items-center gap-3">
            <IconTile rgb={rgb}>🏷️</IconTile>
            <div className="min-w-0">
              <h3 className="text-[15px] font-black tracking-tight" style={{ color: accent }}>{c.catTitle}</h3>
              <p className="text-[11.5px] leading-snug text-g-muted">{c.catSub}</p>
            </div>
          </div>
          <ul className="mt-5 divide-y divide-white/[0.06]">
            {comPreco.map((s, i) => (
              <li key={`p${i}`} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 text-[13px] leading-snug text-g-ink">{s.name}</span>
                <span className="shrink-0 text-[13px] font-black" style={{ color: accent, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(s.price_cents / 100, moeda, locale)}
                </span>
              </li>
            ))}
            {sem.map((s, i) => (
              <li key={`s${i}`} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 text-[13px] leading-snug text-g-ink">{s.name}</span>
                <span className="shrink-0 rounded-full border border-amber-400/50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                  {c.noPrice}
                </span>
              </li>
            ))}
          </ul>
          {sem.length > 0 && (
            <p className="mt-4 border-t border-white/10 pt-3 text-[12px] leading-relaxed text-g-muted">⚠️ {c.noPriceWhy}</p>
          )}
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
   3 · BRAIN · AD · BUILD — NO NEGÓCIO DELA
   A PALAVRA vem da landing (PILLAR_COPY); os NÚMEROS vêm do relatório dela. Cada pilar mostra as
   notas dos aspectos que ele cobre — é isso que separa "o que a Guileo faz" de "o que a Guileo
   faz por VOCÊ". Aspecto não medido aparece como "—" cinza, jamais como zero.
   As três cores canônicas (verde/champanhe/cobre) FICAM: nos pilares a cor é o NOME, e trocá-la
   pelo accent do cliente apagaria a identidade Brain·AD·Build que o resto do site ensina.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
const PILAR_ASPECTOS = {
  brain: ["atendimento", "captura_de_leads"],
  ad: ["descoberta", "redes_sociais"],
  build: ["presenca_web", "vendas_digitais"],
};
const hexToRgb = (hex) => {
  const h = String(hex || "#3E9468").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

export function PilaresDoNegocio({ aspectos = [], extras = {}, accent, lang, notMeasuredLabel }) {
  const c = espelhoCopy(lang);
  const t = PILLAR_COPY[lang] || PILLAR_COPY.en;
  const byName = Object.fromEntries(aspectos.map((a) => [a.nome, a]));
  return (
    <section className="mt-16 pil-v">
      {/* ══════════════════════════════════════════════════════════════════════════════════════
          O ORGANISMO — e por que esta seção deixou de ser três cards (Luis, 2026-08-19)
          «os 3 PILARES têm que se DIFERENCIAR da fase 1 e da 2… e os 3 pilares dá pra melhorar
          MUUUITO.»

          O DEFEITO ERA MEU, e é de sistema: eu tinha acabado de agrupar o diagnóstico, os pilares
          e as duas fases pelo MESMO eixo (as pernas) — o que criou a coerência que faltava — mas
          desenhei as quatro com a MESMA linguagem de card de vidro em grade. Eixo igual + forma
          igual = a pessoa rola e sente que já leu aquilo. Coerência é o EIXO ser o mesmo;
          monotonia é a FORMA ser a mesma.

          Cada seção tem um trabalho diferente, então ganha uma forma diferente:
            • PILARES  → ANATOMIA/IDENTIDADE. Ensina quem é quem, fala da GUILEO, e é a única
                         seção que não carrega número medido dela. Vira uma COMPOSIÇÃO vertical:
                         uma espinha ligando cérebro → coração → corpo, em faixas assimétricas
                         (disco grande à esquerda, conteúdo à direita). Um organismo, de cima
                         pra baixo, com a ordem dizendo a dependência sozinha.
            • FASE 1   → A CONTA URGENTE. Grade densa de cards, o total dominando.
            • FASE 2   → O DEPOIS. Mesma grade, mais ar e menos peso.

          O que MUDOU de verdade aqui (não é só layout novo):
            – a linha da anatomia virou o TÍTULO (era legenda embaixo do nome);
            – o nome da perna virou eyebrow pequeno acima dela;
            – o parágrafo explicativo encolheu para 12.5px muted (era o texto de maior corpo);
            – o disco do ícone dobrou (h-16) e ganhou a espinha passando por ele;
            – nasceu UM número-âncora por perna: a nota MAIS BAIXA medida daquela perna.

          🚨 POR QUE A ÂNCORA É A NOTA MAIS FRACA, e não uma inventada para impressionar: é o
          único número que as TRÊS pernas têm na mesma unidade (0–100), vindo do payload dela, e
          é o que a seção está tentando ensinar — onde o organismo está falhando. Perna sem
          nenhuma nota medida não ganha âncora nenhuma: o bloco simplesmente não renderiza.
          ══════════════════════════════════════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes pilPop{0%{transform:scale(.86);opacity:0}60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}
        @keyframes pilChip{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes pilSpine{from{transform:scaleY(0)}to{transform:scaleY(1)}}
        .pil-v .pil-icon{animation:pilPop .55s cubic-bezier(.2,.8,.3,1.2) both}
        .pil-v .pil-chip{animation:pilChip .4s ease both;transition:border-color .2s,background-color .2s,transform .2s}
        .pil-v .pil-chip:hover{transform:translateY(-1px)}
        .pil-v .pil-spine{transform-origin:top;animation:pilSpine .7s cubic-bezier(.22,.61,.36,1) both}
        @media (prefers-reduced-motion: reduce){
          .pil-v .pil-icon,.pil-v .pil-chip,.pil-v .pil-spine{animation:none !important;transform:none !important}
        }
      `}</style>
      <Head eyebrow={t.eyebrow} title={c.pilTitle} sub={c.pilSub} accent={accent} />
      <p className="mx-auto mt-3 max-w-xl text-center text-[12.5px] font-semibold leading-snug text-g-word">{c.anatomia}</p>

      {/* as três faixas, ligadas pela espinha — de cima pra baixo: cérebro, coração, fundação */}
      <div className="mt-10">
        {t.pillars.map((base, i) => {
          const p = pernaMeta(lang, base.pilar) || base;
          const rgb = p.rgb || hexToRgb(p.accent);
          const notas = (PILAR_ASPECTOS[p.pilar] || []).map((k) => byName[k]).filter(Boolean);
          const produtos = productsForPilar(p.pilar);
          const fatos = extras[p.pilar] || [];
          const ultimo = i === t.pillars.length - 1;
          /* a ÂNCORA: a nota mais baixa MEDIDA desta perna. Sem nota medida → sem âncora. */
          const medidas = notas.filter((a) => a.score != null);
          const ancora = medidas.length ? medidas.reduce((m, a) => (a.score < m.score ? a : m)) : null;
          return (
            <div key={p.badge} className="relative grid grid-cols-[4rem_1fr] gap-x-4 gap-y-0 sm:grid-cols-[5rem_1fr] sm:gap-x-6">
              {/* ── coluna da espinha: disco grande + o fio que liga à próxima parte ───────── */}
              <div className="relative flex flex-col items-center">
                <span className="pil-icon relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[26px] sm:h-16 sm:w-16 sm:text-[30px]"
                  style={{
                    background: `rgba(${rgb},0.13)`,
                    boxShadow: `inset 0 0 0 1px rgba(${rgb},0.42)`,
                    filter: `drop-shadow(0 6px 18px rgba(${rgb},0.5))`,
                    animationDelay: `${i * 120}ms`,
                  }}
                  aria-hidden="true">{p.icon}</span>
                {!ultimo && (
                  <span aria-hidden="true" className="pil-spine w-px flex-1"
                    style={{ background: `linear-gradient(180deg, rgba(${rgb},0.6), rgba(${rgb},0.10))`, animationDelay: `${i * 120 + 180}ms` }} />
                )}
              </div>

              {/* ── conteúdo: a ANATOMIA é o título; o nome da perna é só o eyebrow ─────────── */}
              <div className={ultimo ? "pb-0" : "pb-10"}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: p.accent }}>{p.badge}</span>
                  <span className="text-[11px] font-semibold text-g-muted">· {c.pilOrder?.[i] || p.owns}</span>
                </div>
                {p.linha && (
                  <h3 className="mt-1.5 font-black leading-[1.15] tracking-tight text-g-word text-balance"
                    style={{ fontSize: "clamp(1.15rem,2.5vw,1.6rem)" }}>{p.linha}</h3>
                )}
                <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-g-muted">{p.line}</p>

                {/* ── a âncora + as notas dela, numa linha só ─────────────────────────────── */}
                {(ancora || notas.length > 0) && (
                  <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
                    {/* ⚠️ AS NOTAS SAÍRAM DAQUI TAMBÉM (2026-08-22). Este era o TERCEIRO lugar
                        onde o número aparecia — e o pior: mostrava "0/100" em letra gigante.
                        Dizer a um encanador com 5 estrelas que ele é ZERO destrói a conversa
                        antes dela existir, e ainda é falso: 0 aqui significa "este canal não
                        existe", não "este negócio é ruim".
                        O QUE FICA é o nome do elo mais fraco — apontar onde dói é diagnóstico;
                        dar nota é julgamento. */}
                    {ancora && (
                      <div>
                        <div className="text-[24px] font-black leading-tight tracking-tight sm:text-[28px]"
                          style={{ color: bandColor(ancora.score) }}>
                          {aspectLabel(ancora.nome, lang)}
                        </div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-g-muted">
                          {c.pilWeak}
                        </div>
                      </div>
                    )}
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {notas.map((a) => {
                        const medido = a.score != null;
                        if (ancora && a.nome === ancora.nome) return null;   /* já está na âncora */
                        return (
                          <li key={a.nome} className="text-[12px] text-g-ink">
                            {/* Sem número: a COR já diz se está bom, ruim ou não medido, e cor
                                não humilha ninguém. Não medido continua escrito, nunca vira 0. */}
                            <span className="font-semibold" style={{ color: medido ? bandColor(a.score) : NOT_MEASURED }}>
                              {aspectLabel(a.nome, lang)}
                            </span>
                            {!medido && <span className="ml-1 text-[11px] text-g-muted">· {notMeasuredLabel}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* evidências medidas desta perna (nunca linha "não medido" — ver Apresentacao) */}
                {fatos.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {fatos.map((f, k) => (
                      <li key={k} className="flex gap-1.5 text-[12.5px] leading-snug text-g-word">
                        <span aria-hidden="true" style={{ color: p.accent }}>▸</span><span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* o que esta perna entrega — nomes do catálogo, nunca escritos aqui */}
                {produtos.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10.5px] font-black uppercase tracking-wider" style={{ color: p.accent }}>{c.pilDelivers}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {produtos.map((pr, k) => (
                        <span key={pr.id} className="pil-chip inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-semibold text-g-word backdrop-blur"
                          style={{ borderColor: `rgba(${rgb},0.3)`, background: `rgba(${rgb},0.07)`, animationDelay: `${k * 45}ms` }}>
                          {pr.name?.[lang] || pr.name?.en}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


/* ── A PERNA COMO IDENTIDADE VISUAL, DE UMA FONTE SÓ ─────────────────────────────────────────
   O plano (Fase 1 / Fase 2) agora vem AGRUPADO por perna, e o grupo tem que ser reconhecível como
   "aquele mesmo Brain que eu vi lá em cima". Por isso ícone, nome e COR saem de `PILLAR_COPY` —
   a landing — e não de hex redigitado aqui: mudou a marca, muda tudo junto, /natura inclusive.
   As três cores foram escolhidas por MEDIÇÃO contra o cimento #161512 (ver PillarsProducts.jsx):
   Brain #3E9468 · AD #D6C29A · Build #BE7F35, o cobre escurecido até 5.46 de contraste (WCAG AA)
   e 124 de distância do champanhe — abaixo disso AD e Build liam como a mesma cor lado a lado.

   ⚠️ HIERARQUIA DE COR — TRÊS SISTEMAS QUE NÃO PODEM BRIGAR:
     · COR DA PERNA  → dentro do PLANO (cabeçalho do grupo, ícone, borda e número do cartão).
       Aqui a cor significa QUEM FAZ. É o que torna a página didática.
     · FASE          → NÃO é mais cor. Antes a Fase 1 usava o azul da cliente e a Fase 2 o
       champanhe da casa — e o champanhe É a cor do AD, então "potencial" e "AD" viraram a mesma
       tinta. Agora a fase se lê pelo SELO (✓ medido / ◔ potencial) e pela borda tracejada do
       cartão de potencial, canais que já existiam e não competem com nada.
     · COR DA CLIENTE → tudo que é DELA: capa, anel do score, os números dela, o catálogo dela,
       o presente, a coluna "com a agente" e o fechamento. A marca dela continua na página inteira,
       só não manda mais em quem faz o quê. */
export const PERNAS = ["brain", "ad", "build"];

/* ── A ANATOMIA (Luis, 2026-08-18) — o enquadramento que torna o agrupamento didático ──────────
   «Brain é a IA, o CÉREBRO. AD é o marketing, o CORAÇÃO do negócio — bombeia movimento pra
   dentro. Build é o CORPO e a FUNDAÇÃO: app e web bem construídos, o catálogo com preço, a
   máquina de vender e cobrar.»
   A metáfora responde à pergunta que o agrupamento levanta sozinho — POR QUE três? Sem cérebro
   ninguém atende, sem coração não entra movimento, sem corpo nada disso fica de pé. Uma linha
   por perna, nos dois lugares onde a perna aparece (os pilares e os grupos das fases): é a
   repetição que faz a Lilian reconhecer o mesmo Brain nos dois blocos.

   ⚠️ ISTO É LINGUAGEM, NÃO ENTREGA. Nenhuma frase daqui promete nada: os passos continuam vindo
   do payload medido, e a metáfora só organiza o que já existe. Foi a única licença pedida.

   ⚠️ O ÍCONE DO AD É LOCAL DESTE RELATÓRIO. Na landing o AD é 📈 (gráfico); aqui é ❤️, porque a
   metáfora do coração é o que o Luis quer que ela leia. Nome e COR continuam vindo de
   PILLAR_COPY (a landing é a fonte) — só o ícone diverge, e diverge de propósito, na página
   inteira, nunca só em metade dela: ícone diferente entre a seção dos pilares e os grupos das
   fases quebraria justamente o reconhecimento que a metáfora existe para criar.
   Se o Luis quiser o coração também na landing, é UMA linha em PillarsProducts.jsx e este
   override some. */
const ANATOMIA = {
  brain: {
    icon: "🧠",
    linha: {
      en: "The brain — thinks, answers, decides, books and remembers the customer.",
      pt: "O cérebro — pensa, atende, decide, agenda e lembra do cliente.",
      es: "El cerebro — piensa, atiende, decide, agenda y recuerda al cliente.",
      hi: "मस्तिष्क — सोचता है, जवाब देता है, तय करता है, बुक करता है और ग्राहक को याद रखता है।",
    },
  },
  ad: {
    icon: "❤️",
    linha: {
      en: "The heart — pumps demand in: ads on Google, Meta and YouTube, reviews, traffic.",
      pt: "O coração — bombeia movimento pra dentro: anúncios no Google, Meta e YouTube, avaliações, tráfego.",
      es: "El corazón — bombea demanda hacia dentro: anuncios en Google, Meta y YouTube, reseñas, tráfico.",
      hi: "हृदय — माँग अंदर पंप करता है: Google, Meta और YouTube पर विज्ञापन, रिव्यू, ट्रैफ़िक।",
    },
  },
  build: {
    icon: "🏗️",
    linha: {
      en: "The body and the foundation — the site, the app, the priced catalog, the machine that sells and collects.",
      pt: "O corpo e a fundação — o site, o app, o catálogo com preço, a máquina de vender e cobrar.",
      es: "El cuerpo y la base — el sitio, la app, el catálogo con precio, la máquina de vender y cobrar.",
      hi: "शरीर और नींव — साइट, ऐप, दाम वाला कैटलॉग, बेचने और वसूलने की मशीन।",
    },
  },
};

export function pernaMeta(lang, key) {
  const t = PILLAR_COPY[lang] || PILLAR_COPY.en;
  const p = (t.pillars || []).find((x) => x.pilar === key);
  if (!p) return null;
  const a = ANATOMIA[key] || {};
  return { ...p, icon: a.icon || p.icon, linha: a.linha?.[lang] || a.linha?.en || "", rgb: hexToRgb(p.accent) };
}

/* cabeçalho de um grupo de perna dentro de uma fase. Mesmo disco de vidro dos pilares lá em cima
   (tint .13 · anel interno .4 · drop-shadow .45) — é o reconhecimento visual que amarra os dois
   blocos. `vazio` NÃO some com o grupo: mostrar as três pernas sempre é o que ensina que o plano
   é focado; e a frase diz em voz alta que nada foi inventado para preencher. */
export function PernaGrupo({ meta, vazio, contagem, lang, children }) {
  const c = espelhoCopy(lang);
  if (!meta) return null;
  return (
    <div className="mt-7">
      <div className="flex items-start gap-3">
        <IconTile rgb={meta.rgb} size="h-9 w-9 text-[16px]">{meta.icon}</IconTile>
        <div className="min-w-0">
          <div className="text-[13px] font-black tracking-tight" style={{ color: meta.accent }}>{meta.badge}</div>
          {/* a linha da anatomia, e não o `owns`: aqui a pergunta da leitora é "por que esses
              passos estão juntos?", e é a metáfora que responde. O `owns` já vive na seção dos
              pilares, logo acima — repeti-lo aqui gastaria a linha sem acrescentar nada. */}
          {meta.linha && <div className="text-[11px] leading-snug text-g-muted">{meta.linha}</div>}
        </div>
        <span aria-hidden="true" className="ml-3 hidden h-px flex-1 sm:block"
          style={{ background: `linear-gradient(90deg, rgba(${meta.rgb},0.45), transparent)` }} />
        {!vazio && contagem > 0 && (
          <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{ borderColor: `rgba(${meta.rgb},0.5)`, color: meta.accent, background: `rgba(${meta.rgb},0.08)` }}>
            {c.legSteps(contagem)}
          </span>
        )}
      </div>
      {vazio ? (
        <p className="mt-2.5 rounded-xl border border-dashed border-white/12 bg-white/[0.02] p-3 text-[12px] leading-snug text-g-muted">
          {c.legNone}
        </p>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════════════════════════════════
   3.9 · GUILEO PULSE — O BRINDE, COM CARA DE PRODUTO
   Luis (2026-08-18): «nossa LOGO e IDENTIDADE no Guileo Pulse, com força. Trazer aquele mesmo
   TERMÔMETRO… tem que ser MELHOR QUE QUALTRICS.»
   Antes o Pulse era um cartãozinho tracejado no fim da Fase 2 — do tamanho de um brinde de balcão
   para um produto que, sozinho, tem preço, concorrente e categoria. Aqui ele ganha o painel real.

   ⚠️ A MARCA AQUI É A NOSSA, NÃO A DELA. Este é o único bloco da página em que a cor do cliente
   NÃO manda: champanhe Guileo + a logo. É um produto com nome próprio sendo dado de presente —
   presente com a marca de quem recebe não parece presente, parece item de configuração.

   ⚠️ O TERMÔMETRO APARECE VAZIO, DE PROPÓSITO. Ele é o INSTRUMENTO, não a medição: ela ainda não
   tem nota, e o dia em que este arco mostrar 86 sem ninguém ter medido nada é o dia em que a
   página inteira deixa de valer. Arco tracejado, "—" no lugar do número, barras de estrela sem
   preenchimento e sem percentual. Zero número, 100% instrumento — e a frase embaixo diz por quê.
   O painel do LANDING (PulseSection) desenha os mesmos três elementos COM números de exemplo, sob
   o rótulo "painel de exemplo"; ali é uma vitrine para desconhecido, aqui é um documento com o
   nome dela no topo, e a mesma imagem muda de significado.

   Os rótulos e a comparação de preço vêm de `PAINEL` e `PULSE_COPY` — o mesmo texto aprovado da
   landing, nos 4 idiomas. Nada foi reescrito aqui.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
const GOLD = "#D6C29A", GOLD_RGB = "214,194,154";

export function PulsePresente({ lang, moeda }) {
  const c = espelhoCopy(lang);
  const G = PULSE_COPY[lang] || PULSE_COPY.en;
  const PN = PAINEL[lang] || PAINEL.en;
  /* O PREÇO É A PROVA DO PRESENTE — mas só na moeda do relatório (a mesma trava do fechamento:
     plano em R$ ao lado de add-on em $ já fez a mesma página parecer 5× mais cara). */
  const preco = moeda === "USD" ? PULSE_COPY.en.price : moeda === "BRL" ? PULSE_COPY.pt.price : null;
  return (
    <section className="relative mt-16 overflow-hidden rounded-xl3 border-2 border-dashed p-6 backdrop-blur sm:p-8"
      style={{ borderColor: `rgba(${GOLD_RGB},0.55)`, background: `linear-gradient(135deg, rgba(${GOLD_RGB},0.10), transparent 68%)`, boxShadow: "0 40px 90px -50px rgba(0,0,0,0.85)" }}>
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full blur-3xl"
        style={{ background: `rgba(${GOLD_RGB},0.16)` }} />

      {/* IDENTIDADE CENTRALIZADA (Luis, 2026-08-20: «centralizar o nome Guileo Pulse»).
             O nome do produto é o herói deste bloco — ele é a única coisa aqui que NÃO é da marca
             da cliente, e é o presente. Alinhado à esquerda ele competia com a logo e com o preço
             riscado; centralizado em coluna, o olho lê marca → nome → categoria → preço numa
             descida só, e o selo de brinde fica colado no nome em vez de brigar com ele. */}
      <div className="flex flex-col items-center text-center">
        <img src={guileoMark} alt="Guileo" className="h-12 w-12 shrink-0 object-contain" />
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          <h2 className="text-[26px] font-black leading-none tracking-tight text-g-word sm:text-[32px]">{c.pulseTitle}</h2>
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-g-deep" style={{ background: GOLD }}>
            🎁 {c.pulseTag}
          </span>
        </div>
        <div className="mt-2 text-[11.5px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>{c.pulseCat}</div>
        {preco && (
          <div className="mt-3.5">
            <div className="text-[26px] font-black leading-none tracking-tight line-through decoration-2" style={{ color: GOLD, textDecorationColor: `rgba(${GOLD_RGB},0.6)` }}>{preco}</div>
            <div className="mt-1 text-[10.5px] font-semibold text-g-muted">{c.pulseEyebrow}</div>
          </div>
        )}
      </div>

      {/* o argumento que vende: por que isto é melhor que mandar pesquisa */}
      <p className="mx-auto mt-6 max-w-2xl text-center text-[14px] font-semibold leading-relaxed text-g-word">{c.pulseWhy}</p>

      {/* ── ENCURTADO (Luis, 24/08: «precisa ser mais resumido pra converter, ninguém lê tudo»)
             O que morava aqui — o painel simulado (termômetro, estrelas, cartão da pesquisa), os
             dois caminhos e a comparação com Qualtrics/Birdeye — NÃO foi apagado: mora em /pulse,
             a casa do produto, que já lê o MESMO `PULSE_COPY`. Este relatório é o laudo do negócio
             DELA; uma landing inteira de um produto nosso no meio dele empurrava a conclusão para
             três telas abaixo e competia com o plano, que é o que ela precisa decidir.
             Aqui fica o que vende em dez segundos: o que é, por que é diferente, e o preço com o
             presente. Quem quiser o resto clica — e clicar é sinal de interesse, que a página
             longa embutida nunca me deu. */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-center text-[12.5px] font-bold" style={{ color: GOLD }}>🎁 {c.pulseGiftLine}</p>
        <a href="/pulse" target="_blank" rel="noopener noreferrer"
           className="rounded-full px-6 py-3 text-[14px] font-black text-g-deep transition hover:brightness-110 motion-reduce:transition-none"
           style={{ background: GOLD, boxShadow: `0 18px 40px -22px rgba(${GOLD_RGB},0.9)` }}>
          {c.pulseSeeMore} →
        </a>
      </div>
    </section>
  );
}
/* ════════════════════════════════════════════════════════════════════════════════════════════
   OS CANAIS — E POR QUE ELES VIRARAM UMA SEÇÃO, NÃO UM ÍCONE POR EVIDÊNCIA
   Luis: «LEMBRANDO dos ÍCONES DAS REDES SOCIAIS neles — ícones IMPORTANTE. Ou colocar uma SEÇÃO
   pra elas, IGUAL da LANDING.»

   Eu tinha travado neste item duas rodadas seguidas, e a alternativa dele desfaz o nó. O impasse
   era: pôr um ícone de estado em cada evidência exige saber se o canal está presente OU ausente —
   e no relatório da Natura o aspecto "descoberta" só tem linhas `— não medido` (a integração de
   busca está desligada). Um ícone do Google apagado ali acusaria uma ausência que NINGUÉM MEDIU,
   que é exatamente a mentira que esta página existe para não contar.

   A seção resolve porque muda o SUJEITO da frase: aqui os logos falam sobre a GUILEO — onde nós
   publicamos, respondemos e somos encontrados. É afirmação sobre nós, verdadeira para todo
   cliente, e por isso não precisa de estado presente/ausente nenhum. O Google aparece inteiro,
   colorido, sem acusar nada.

   E o estado continua existindo onde ele é honesto: na evidência MEDIDA do aspecto dela
   (`iconeDoCanal`, usado pelo AspectRow) — ✓ Instagram no site dela, ✗ Facebook ausente, ambos
   verificados pelo motor. Linha que começa com "—" (não medido) não ganha ícone nenhum.

   MESMOS ASSETS DA LANDING: react-icons/fa6, o mesmo pacote e o mesmo tratamento de chip que o
   ChannelsStrip.jsx usa no Home — nada de SVG novo desenhado à mão. O ChatGPT entra pelo
   Simple Icons (SiOpenai) porque o fa6 não tem, e entra como DESCOBERTA POR IA, não como rede
   social: o próprio catálogo já vende "encontrado pelo Google E pela IA" (produto seo_aeo).
   ════════════════════════════════════════════════════════════════════════════════════════════ */
export const CANAIS = [
  { n: "Instagram", Icon: FaInstagram, c: "#E4405F", grupo: "social" },
  { n: "TikTok", Icon: FaTiktok, c: "#EE1D52", grupo: "social" },
  { n: "Meta", Icon: FaMeta, c: "#0081FB", grupo: "social" },
  { n: "WhatsApp", Icon: FaWhatsapp, c: "#25D366", grupo: "social" },
  { n: "YouTube", Icon: FaYoutube, c: "#FF0000", grupo: "social" },
  { n: "Google", Icon: FaGoogle, c: "#4285F4", grupo: "busca" },
  { n: "ChatGPT", Icon: SiOpenai, c: "#10A37F", grupo: "ia" },
];

/* o ícone de UM canal citado numa evidência MEDIDA. `estado` só pode ser true/false — quem
   chama nunca passa "não medido", porque linha não medida não chega aqui. */
const CANAL_POR_NOME = Object.fromEntries(CANAIS.map((x) => [x.n.toLowerCase(), x]));
const APELIDOS = { facebook: { n: "Facebook", Icon: FaFacebookF, c: "#1877F2" }, meta: CANAL_POR_NOME.meta };

export function iconeDoCanal(texto) {
  const t = String(texto || "");
  /* só evidência com veredito (✓ presente / ✗ ausente) ganha ícone. "—" = não medido → null,
     e é essa linha única que impede o ícone de virar acusação sem medição. */
  const estado = t.trim().startsWith("✓") ? true : t.trim().startsWith("✗") ? false : null;
  if (estado === null) return null;
  /* nome de marca é o mesmo nos 4 idiomas, então casar por substring é seguro em qualquer lang */
  const achado = Object.entries({ ...CANAL_POR_NOME, ...APELIDOS })
    .find(([k]) => new RegExp(`\\b${k}\\b`, "i").test(t));
  return achado ? { ...achado[1], estado } : null;
}

export function CanaisGuileo({ lang, accent }) {
  const c = espelhoCopy(lang);
  const rotulo = { social: c.chSocial, busca: c.chFound, ia: c.chAI };
  return (
    <section className="mt-16">
      <Head title={c.chTitle} sub={c.chSub} accent={accent} />
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {CANAIS.map(({ n, Icon, c: cor, grupo }) => (
          <span key={n}
            role="img" aria-label={`${n} — ${rotulo[grupo]}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 backdrop-blur transition-colors hover:border-white/20"
            style={{ boxShadow: "0 10px 30px -22px rgba(0,0,0,0.9)" }}>
            <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px]"
              style={{ color: cor, background: `${cor}1f`, boxShadow: `inset 0 0 0 1px ${cor}44` }}><Icon /></span>
            <span className="text-[12.5px] font-semibold text-g-light">{n}</span>
          </span>
        ))}
      </div>
      {/* a legenda que diz de quem é a afirmação — sem ela, logo colorido vira promessa vaga */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-g-muted">
        <span>{c.chSocial}</span><span aria-hidden="true">·</span>
        <span>{c.chFound}</span><span aria-hidden="true">·</span>
        <span>{c.chAI}</span>
      </div>
    </section>
  );
}


/* ════════════════════════════════════════════════════════════════════════════════════════════
   4 · A VITRINE DE PRODUTOS + O PULSE COMO BRINDE
   Lê `productSystem.js` inteiro, agrupado por pilar: catálogo novo entra sozinho. Cada item traz
   o `resultMetric` (o número que a landing mostra grande) e um `~` quando aquele número é
   ESTIMATIVA DE MERCADO — a nota de rodapé explica. Num documento onde tudo o mais é medido no
   negócio dela, misturar estimativa sem marcar seria contaminar a parte medida.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
export function CatalogoProdutos({ accent, rgb, lang }) {
  const c = espelhoCopy(lang);
  const t = PILLAR_COPY[lang] || PILLAR_COPY.en;
  const temEstimativa = PRODUCTS.some((p) => p.resultIsEstimate);
  return (
    <section className="mt-16">
      {/* o eyebrow carrega a CONTAGEM, igual à listra da landing (ServicesMarquee): o argumento
          mais forte desta seção é que são muitos, e o número vem do próprio catálogo — então ele
          nunca mente sobre o tamanho da lista logo abaixo. */}
      <Head eyebrow={c.catalogEyebrow(PRODUCTS.length)} title={c.catalogTitle} sub={c.catalogSub} accent={accent} />
      <div className="mt-8 space-y-6">
        {t.pillars.map((p) => {
          const prgb = hexToRgb(p.accent);
          const itens = productsForPilar(p.pilar);
          if (!itens.length) return null;
          return (
            <div key={p.badge}>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: p.accent, boxShadow: `0 0 8px ${p.accent}` }} />
                <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: p.accent }}>{p.badge}</span>
                <span className="text-[11px] text-g-muted">· {p.owns}</span>
              </div>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {itens.map((pr) => {
                  const rm = pr.resultMetric || {};
                  const unidade = (rm.unit && (rm.unit[lang] || rm.unit.en)) || "";
                  const brinde = pr.id === "pulse";
                  return (
                    <li key={pr.id} className="relative flex items-start gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur"
                      style={brinde ? { borderColor: accent, borderStyle: "dashed", background: `rgba(${rgb},0.07)` } : undefined}>
                      <IconTile rgb={brinde ? rgb : prgb} size="h-10 w-10 text-[17px]">{pr.icon}</IconTile>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-bold leading-tight text-g-word">{pr.name?.[lang] || pr.name?.en}</span>
                          {brinde && (
                            <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-g-deep" style={{ background: accent }}>
                              🎁 {c.giftTag}
                            </span>
                          )}
                        </div>
                        {rm.value && (
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-[17px] font-black leading-none tracking-tight tabular-nums" style={{ color: brinde ? accent : p.accent }}>
                              {pr.resultIsEstimate ? "~" : ""}{rm.value}
                            </span>
                            <span className="text-[11px] font-semibold text-g-light/80">{unidade}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {temEstimativa && <p className="mt-5 text-[11px] leading-relaxed text-g-muted">{c.estimateNote}</p>}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
   5 · PROVA · GARANTIA · COMPARAÇÃO · FECHAMENTO
   Selos e padrões são os MESMOS da landing (TrustStrip / ProofV2), palavra por palavra — são as
   únicas alegações de confiança que a plataforma real sustenta.
   ⚠️ NÃO EXISTE "GARANTIA DE LUCRO" aqui, e é decisão consciente: a garantia real e escrita no
   catálogo de planos é 30 dias de dinheiro de volta. Prometer lucro seria a única frase inventada
   de um documento que se vende justamente por não inventar nada.
   A TABELA compara HOJE × COM A AGENTE, e cada linha da esquerda é um número MEDIDO no relatório
   dela (ou um achado com evidência). Linha sem dado não vira média de mercado: não aparece.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
const BADGES = ["HIPAA", "GDPR", "LGPD", "CCPA", "PCI DSS"];

export function ProvaComparacao({ linhas = [], accent, rgb, lang, moeda, riskFmt, planoKey = "starter" }) {
  const c = espelhoCopy(lang);
  const plano = GUILEO_PLANS.find((p) => p.key === planoKey) || GUILEO_PLANS[0];
  /* ⚠️ PREÇO SÓ NA MOEDA DO RELATÓRIO. O catálogo guarda USD e BRL; escolher pelo IDIOMA seria
     repetir o defeito da página de planos que mostrava plano em R$ e add-on em $ na mesma tela
     (5× mais caro pro leitor). Moeda que não sabemos casar → o preço não aparece, só o convite. */
  /* ⚠️ O SUFIXO DO PREÇO TAMBÉM É TEXTO (2026-08-19): guileoPlans.js guarda "$149/mo" (o
     catálogo é escrito em inglês) e o "/mo" caía cru numa página em português. O BRL já vem
     com "/mês"; aqui traduzimos só o sufixo do USD — o número e a moeda nunca mudam. */
  const preco = moeda === "USD" ? String(plano.price).replace("/mo", c.perMo)
    : moeda === "BRL" ? plano.priceBR : null;
  return (
    <section className="mt-16">
      <Head title={c.proofTitle} sub={c.proofSub} accent={accent} />

      {/* selos — os mesmos do TrustStrip da landing */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {c.seals.map(([ic, a, b]) => (
          <div key={a} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur">
            <IconTile rgb={rgb} size="h-9 w-9 text-[16px]">{ic}</IconTile>
            <div className="leading-tight">
              <div className="text-[12.5px] font-black text-g-word">{a}</div>
              <div className="text-[10.5px] text-g-muted">{b}</div>
            </div>
          </div>
        ))}
      </div>

      {/* padrões — o texto "alinhado a", nunca "certificado" (a formulação honesta do ProofV2) */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center backdrop-blur">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-g-ink">{c.stdTitle}</div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {BADGES.map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-g-word">
              🛡️ {b}
            </span>
          ))}
        </div>
        <p className="mx-auto mt-3 max-w-xl text-[12px] leading-relaxed text-g-muted">{c.stdSub}</p>
      </div>

      {/* a comparação — só linhas com dado medido */}
      {linhas.length > 0 && (
        <div className="mt-8">
          <h3 className="text-[15px] font-black tracking-tight text-g-word">⚖️ {c.cmpTitle}</h3>
          <p className="mt-1 text-[12.5px] leading-snug text-g-muted">{c.cmpSub}</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur" style={cardShadow}>
            {/* ⚠️ NO CELULAR A TABELA EMPILHA. Duas colunas em 375px dão ~170px cada, e frases como
                "várias ao mesmo tempo, a linha nunca dá ocupado" viram uma coluna de duas palavras
                por linha — tecnicamente sem overflow, na prática ilegível. Empilhado, cada linha
                vira um par "✕ hoje → ✓ com a agente", que é o mesmo argumento numa leitura só.
                O cabeçalho de coluna só existe onde há colunas; no empilhado o rótulo viaja
                DENTRO de cada célula, senão a pessoa perde qual metade está lendo. */}
            <div className="hidden grid-cols-2 gap-px border-b border-white/10 bg-white/[0.04] sm:grid">
              <div className="px-4 py-2.5 text-[10.5px] font-black uppercase tracking-wider text-red-300">✕ {c.cmpToday}</div>
              <div className="px-4 py-2.5 text-[10.5px] font-black uppercase tracking-wider" style={{ color: accent }}>✓ {c.cmpWith}</div>
            </div>
            <ul className="divide-y divide-white/[0.06]">
              {linhas.map(([hoje, depois], i) => (
                <li key={i} className="grid grid-cols-1 gap-px sm:grid-cols-2">
                  <div className="px-4 pb-2 pt-3 text-[12.5px] leading-snug text-g-muted sm:py-3">
                    <span className="mb-0.5 block text-[10px] font-black uppercase tracking-wider text-red-300 sm:hidden">✕ {c.cmpToday}</span>
                    {hoje}
                  </div>
                  <div className="px-4 pb-3 pt-2 text-[12.5px] font-semibold leading-snug text-g-word sm:py-3"
                    style={{ background: `rgba(${rgb},0.05)` }}>
                    <span className="mb-0.5 block text-[10px] font-black uppercase tracking-wider sm:hidden" style={{ color: accent }}>✓ {c.cmpWith}</span>
                    {depois}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* fechamento */}
      <div className="mt-8 overflow-hidden rounded-xl3 border p-6 backdrop-blur-sm sm:p-7"
        style={{ borderColor: `rgba(${rgb},0.35)`, background: `linear-gradient(135deg, rgba(${rgb},0.12), transparent 70%)`, ...cardShadow }}>
        <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: accent }}>🤝 {c.closeTitle}</p>
        {preco && (
          <div className="mt-1.5 text-[26px] font-black leading-tight tracking-tight text-g-word sm:text-[30px]">
            {c.closePlan(plano.name, preco)}
          </div>
        )}
        {/* VERMELHO no confronto: "$149/mo CONTRA $1.278/mês em risco". O número que ela
            perde tem que gritar mais que o que ela paga — é essa a conta que fecha a venda. */}
        {riskFmt && <div className="mt-1 text-[13.5px] font-semibold" style={{ color: PERDA }}>{c.closeVs(riskFmt)}</div>}

        {/* IMPLEMENTAÇÃO — âncora REAL, não inventada.
            O $990 riscado é o setup da nossa PRÓPRIA tabela Done-For-You (src/data/salesKit.js),
            não um "o mercado cobra ~$1.000" que a gente não consegue provar. A página inteira se
            sustenta em não afirmar número sem lastro; a oferta de fechamento é o último lugar
            onde eu abriria exceção — é justo aí que o dono confere. */}
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t pt-3"
          style={{ borderColor: `rgba(${rgb},0.25)` }}>
          <span className="text-[11px] font-black uppercase tracking-wider text-g-muted">{c.setupLabel}</span>
          <span className="text-[22px] font-black tracking-tight text-g-word tabular-nums">$490</span>
          <span className="text-[12.5px] text-g-muted">
            {c.setupWas} <s className="opacity-70">$990</s>
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-ink">{c.setupWhat}</p>

        <p className="mt-3 border-t pt-3 text-[12.5px] leading-relaxed text-g-ink" style={{ borderColor: `rgba(${rgb},0.25)` }}>
          🛡️ {c.closeGuarantee}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-g-muted">{c.closeNote}</p>
      </div>
    </section>
  );
}
