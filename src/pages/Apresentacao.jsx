// APRESENTAÇÃO / QUOTE — /apresentacao/:id
// The sales & growth piece: a business owner opens this link and sees the REAL
// score measured by the evaluation engine (/api/avaliacao), what the voice agent
// already does for the business, the money at stake (with the assumption written
// out — that's what makes the number defensible), and the recommended strategy.
// First real case: Lilian, owner of Natura Spa + Salon (?accent=%234d92c2&agente=Lilian).
//
// HONESTY LAW: an aspect with score null is shown as "not measured" — never as 0,
// never silently dropped. Every $ figure carries its premissa underneath.
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LeadCaptureV2 from "../components/LeadCaptureV2.jsx";
import RelatorioVizinhanca from "../components/RelatorioVizinhanca.jsx";
import { useSeo } from "../lib/seo.js";
import { useLang } from "../i18n.jsx";
import { waLink } from "../data/contact.js";
import { productDetail, pilarDoPasso } from "../data/productSystem.js";
import { NOT_MEASURED, bandColor, aspectLabel, fmtMoney, hexRgb, PERDA, GANHO } from "../lib/reportScale.js";
/* ── OS BLOCOS QUE ESPELHAM A LANDING (2026-08-18, pedido do Luis) ──────────────────────────────
   «a página tem que espelhar o site — padrão no nível da landing, com o mesmo design». Capa+perfil
   do site dela, os números dela, Brain·AD·Build com as notas DELA, a vitrine de produtos (Pulse de
   brinde) e prova/garantia/comparação/fechamento. Moram em componente próprio porque esta página
   já é grande e porque eles são REUTILIZÁVEIS pelo próximo cliente sem tocar aqui. */
import { CapaPerfil, NumerosDoNegocio, PilaresDoNegocio, CatalogoProdutos, ProvaComparacao, espelhoCopy, PernaGrupo, pernaMeta, PERNAS, PulsePresente, CanaisGuileo, iconeDoCanal } from "../components/RelatorioEspelho.jsx";

/* ── local dictionary (page-local pattern, like Contact.jsx) ─────────────── */
const D = {
  pt: {
    report: "Relatório de Crescimento",
    preparedFor: "preparado para",
    measuredIn: (n) => `medido em ${n} aspectos do seu negócio`,
    overallScore: "Nota geral",
    aspects: "Nota por aspecto",
    snapshot: "Resumo visual",
    aspectsSub: "Cada nota vem de evidências medidas de verdade — nada estimado no olho.",
    notMeasured: "não medido",
    recommendation: "Recomendação",
    money: "O dinheiro em jogo",
    moneySub: "Números com a premissa escrita embaixo — é o que torna cada valor defensável.",
    missedCalls: "ligações perdidas estimadas por mês",
    revenueAtRisk: "receita em risco estimada por mês",
    premise: "Como chegamos neste número",
    agentDoes: (a) => `${a} já faz isso pelo seu negócio`,
    agentDoesSub: "No telefone, hoje — não é promessa de roadmap.",
    agentCards: [
      ["📞", "Atende 24/7", "Nenhuma ligação cai na caixa postal — de madrugada, feriado, hora do rush."],
      ["🌎", "EN + PT e ES nativos", "Atende em inglês, e fala português e espanhol com voz nativa — o cliente é atendido na língua dele."],
      ["📅", "Agenda na hora", "Consulta a agenda real e marca o horário durante a própria ligação."],
      ["💵", "Cota o preço exato", "Preço por serviço e por unidade, direto do catálogo — nunca inventa valor."],
      ["📝", "Captura orçamento", "Quando não há preço fechado, registra nome + telefone e o pedido para retorno."],
      ["🤝", "Reconhece quem volta", "Chama o cliente recorrente pelo nome e envia confirmação por e-mail com a marca do negócio."],
    ],
    nextLabel: "Próximo degrau",
    nextIntro: "Nota alta não é fim de linha: mede o que já está de pé, não tudo o que aquilo pode fazer. Onde existe algo a mais no catálogo Guileo, ele aparece aqui — e o que não tem, não aparece.",
    nextSteps: {
      presenca_web: "O site está de pé e rápido. O que ele ainda não faz é VENDER: catálogo com preço, pagamento e agendamento na própria página.",
      vendas_digitais: "Vender sem ninguém presente: pagamento online, link de cobrança, pacotes e gift card saindo do mesmo catálogo.",
      descoberta: "Aparecer em quem procura hoje: SEO/AEO, ficha do Google alimentada e anúncios medidos por agendamento, não por clique.",
      redes_sociais: "Publicar sem depender de inspiração: conteúdo e criativo de anúncio na sua marca, e a mensagem que chega vira lead no CRM.",
      atendimento: "Cobrir a hora em que o telefone toca e não tem ninguém — a agente atende, cota do catálogo e agenda na agenda real.",
      captura_de_leads: "Nenhum contato perdido: formulário, chat e WhatsApp caem no mesmo CRM, e a agente liga de volta em ~60 segundos.",
    },
    opportunity: "O que os seus dados mostram",
    lineLabel: (a) => `Linha da ${a} · atende 24/7`,
    stepWord: "passo",
    strategyEyebrow: "O plano",
    strategyH1a: "Duas fases: ",
    strategyH1b: "parar a perda, depois avançar.",
    stripStop: "Parar a perda",
    stripAdvance: "Avançar",
    phase1Title: "Fase 1 · Parar a perda",
    phase1Sub: "Agora. Cada passo fecha um vazamento JÁ MEDIDO neste relatório — o número é seu, não é média de mercado.",
    phase2Title: "Fase 2 · Avançar",
    phase2Sub: "Depois que o buraco para: crescer além de recuperar o que hoje se perde.",
    phase2Invite: "Nada aqui é promessa: cada ◔ é uma porta que a Guileo já sabe abrir e que ainda não foi medida no seu negócio. É por isso que vem depois — na ordem, não na fila de espera.",
    phase2Close: "Quando o buraco para de vazar, a mesma agente que já atende passa a vender, lembrar e trazer de volta. A Fase 1 é o que você para de perder; a Fase 2 é o que o seu negócio passa a fazer sozinho.",
    coverTitle: "O que a Fase 1 cobre",
    coverCap: "do dinheiro medido em risco, por mês",
    badgeMeasured: "medido",
    badgePotential: "potencial",
    potentialLabel: "Ganho potencial",
    capRisk: "em risco hoje, na janela que este passo cobre",
    capUnpriced: "serviços hoje sem preço",
    capTicket: "ticket médio, cobrado na própria ligação",
    strategy: "Estratégia recomendada",
    strategySub: "Dois movimentos: primeiro paramos o que vaza hoje, depois crescemos além disso.",
    gap: "O vazamento",
    solves: "O que resolve",
    competitors: "Concorrentes analisados",
    ctaTitle: "Pronto para fechar esses vazamentos?",
    ctaSub: "Deixe onde te encontrar e uma pessoa de verdade responde — normalmente em horas.",
    ctaHear: (a) => `📞 Ouvir a ${a} atendendo ao vivo`,
    ctaWa: "Falar com a Guileo",
    ctaCall: (a) => `Ligar para ${a} agora`,
    waMsg: (b) => `Olá! Recebi o Relatório de Crescimento de ${b} e quero conversar.`,
    loading: "Carregando seu relatório…",
    notFoundTitle: "Relatório não encontrado",
    notFoundBody: "Este link não corresponde a nenhuma avaliação — pode ter expirado ou o endereço veio incompleto. Não vamos te mostrar dado inventado.",
    notFoundCta: "Conhecer a Guileo",
    reMeasure: (a) => `Nota de hoje. Com a ${a} ativa, re-medimos em 30 dias.`,
    showMore: (n) => `ver mais ${n} evidências`,
    showLess: "ver menos",
    agentBadges: [
      (n) => (n != null ? `🔥 +${n} ligações/mês` : "🔥 +ligações"),
      "🌎 +alcance", "📈 +agendamentos", "💰 +vendas", "➕ +leads", "🔁 +retenção",
    ],
    cycleEyebrow: "O ciclo",
    cycleResult: "O que produz",
    cycleLoop: "…e tudo isso volta para a próxima ligação: quem ela já atendeu, o que já cotou e o que já agendou entram na conversa seguinte.",
    cycleBackTo: "volta ao passo 1",
    cycleMeasured: "medido no seu relatório",
    closedHours: (h) => `${h}h/semana com o telefone sem ninguém`,
    statsSources: [
      "62% das ligações para pequenos negócios não são atendidas ao vivo (411 Locals, 2024)",
      "Menos de 3% de quem cai na caixa postal deixa recado (Invoca)",
      "Contato em menos de 1h = 7× mais chance de qualificar o lead (Harvard Business Review)",
    ],
    freeWin: "✓ grátis — você mesmo faz",
    deliver: "O que entregamos",
    gainLabel: "O que você ganha",
    gainCovers: (h) => `cobre as ${h}h/semana em que hoje ninguém atende`,
    gainCalls: (n) => `recupera ~${n} ligações/mês que hoje caem na caixa postal`,
    gainRevenue: (v) => `${v}/mês que hoje estão em risco`,
    gainTicket: (t) => `cobra na própria ligação — ticket médio de ${t}, sem correr atrás`,
    gainUnpriced: (n) => `${n} serviço(s) sem preço deixam de virar cotação inventada`,
    gainLeak: (g) => `fecha o vazamento medido: ${g}`,
    gainPulse: "mede a satisfação de cada cliente — incluído, sem custo",
    eta: "ativação",
    pulseTitle: "Guileo Pulse",
    pulseTag: "de brinde",
    pulseBody: "Incluído como cortesia — mede a satisfação dos seus clientes automaticamente, depois de cada atendimento.",
    napkin: (t) => `Um único agendamento recuperado (~${t} no seu ticket médio) paga semanas de Guileo.`,
    seoDesc: "Guileo X-Ray — a nota medida de verdade, o dinheiro em jogo e a estratégia recomendada para o seu negócio.",
        date: "pt-BR",
  },
  en: {
    report: "Growth Report",
    preparedFor: "prepared for",
    measuredIn: (n) => `measured across ${n} aspects of your business`,
    overallScore: "Overall score",
    aspects: "Score by aspect",
    snapshot: "Visual snapshot",
    aspectsSub: "Every grade comes from evidence actually measured — nothing eyeballed.",
    notMeasured: "not measured",
    recommendation: "Recommendation",
    money: "The money at stake",
    moneySub: "Numbers with the assumption written underneath — that's what makes each figure defensible.",
    missedCalls: "estimated missed calls per month",
    revenueAtRisk: "estimated revenue at risk per month",
    premise: "How we got this number",
    agentDoes: (a) => `${a} already does this for your business`,
    agentDoesSub: "On the phone, today — not a roadmap promise.",
    agentCards: [
      ["📞", "Answers 24/7", "No call hits voicemail — late night, holidays, rush hour."],
      ["🌎", "EN + native PT & ES", "Answers in English and speaks Portuguese and Spanish with native voice — every caller is served in their own language."],
      ["📅", "Books on the spot", "Checks the real calendar and books the slot during the call itself."],
      ["💵", "Quotes exact prices", "Price per service, per location, straight from the catalog — never invents a number."],
      ["📝", "Captures quote requests", "When there's no fixed price, records name + phone and the request for follow-up."],
      ["🤝", "Recognizes returning clients", "Greets repeat customers by name and sends a branded email confirmation."],
    ],
    nextLabel: "Next step up",
    nextIntro: "A high score is not the finish line: it measures what already stands up, not everything it could do. Where the Guileo catalog has something more to add, it shows here — and where it doesn't, nothing is written.",
    nextSteps: {
      presenca_web: "The site is up and fast. What it still doesn't do is SELL: priced catalog, payment and booking on the page itself.",
      vendas_digitais: "Selling with nobody present: online payment, pay-links, packages and gift cards coming out of the same catalog.",
      descoberta: "Showing up for people searching today: SEO/AEO, a fed Google listing, and ads measured by bookings, not clicks.",
      redes_sociais: "Publishing without waiting for inspiration: content and ad creative in your brand, and every incoming message becoming a CRM lead.",
      atendimento: "Covering the hours when the phone rings with no one there — the agent answers, quotes from the catalog and books the real calendar.",
      captura_de_leads: "No contact lost: form, chat and WhatsApp land in the same CRM, and the agent calls back in ~60 seconds.",
    },
    opportunity: "What your own data shows",
    lineLabel: (a) => `${a}\u2019s line · answers 24/7`,
    stepWord: "step",
    strategyEyebrow: "The plan",
    strategyH1a: "Two phases: ",
    strategyH1b: "stop the loss, then advance.",
    stripStop: "Stop the loss",
    stripAdvance: "Advance",
    phase1Title: "Phase 1 · Stop the loss",
    phase1Sub: "Now. Each step closes a leak ALREADY MEASURED in this report — the number is yours, not an industry average.",
    phase2Title: "Phase 2 · Advance",
    phase2Sub: "Once the hole is plugged: growth beyond recovering what you lose today.",
    phase2Invite: "Nothing here is a promise: each ◔ is a door Guileo already knows how to open and that has not been measured in your business yet. That is why it comes second — in order, not on a waiting list.",
    phase2Close: "Once the hole stops leaking, the same agent that already answers starts selling, remembering and bringing people back. Phase 1 is what you stop losing; Phase 2 is what your business starts doing on its own.",
    coverTitle: "What Phase 1 covers",
    coverCap: "of the measured money at risk, per month",
    badgeMeasured: "measured",
    badgePotential: "potential",
    potentialLabel: "Potential gain",
    capRisk: "at risk today, in the window this step covers",
    capUnpriced: "services with no price today",
    capTicket: "average ticket, collected on the call itself",
    strategy: "Recommended strategy",
    strategySub: "Two moves: first we stop what is leaking today, then we grow beyond it.",
    gap: "The leak",
    solves: "What fixes it",
    competitors: "Competitors analyzed",
    ctaTitle: "Ready to close these leaks?",
    ctaSub: "Leave us where to reach you and a real human replies — usually within hours.",
    ctaHear: (a) => `📞 Hear ${a} answering live`,
    ctaWa: "Talk to Guileo",
    ctaCall: (a) => `Call ${a} now`,
    waMsg: (b) => `Hi! I received the Growth Report for ${b} and I'd like to talk.`,
    loading: "Loading your report…",
    notFoundTitle: "Report not found",
    notFoundBody: "This link doesn't match any evaluation — it may have expired or arrived incomplete. We won't show you invented data.",
    notFoundCta: "Meet Guileo",
    reMeasure: (a) => `Today's score. With ${a} live, we re-measure in 30 days.`,
    showMore: (n) => `show ${n} more`,
    showLess: "show less",
    agentBadges: [
      (n) => (n != null ? `🔥 +${n} calls/mo` : "🔥 +calls"),
      "🌎 +reach", "📈 +bookings", "💰 +sales", "➕ +leads", "🔁 +retention",
    ],
    cycleEyebrow: "The cycle",
    cycleResult: "What it produces",
    cycleLoop: "…and all of it feeds the next call: who she already served, what she already quoted and what she already booked come back into the next conversation.",
    cycleBackTo: "back to step 1",
    cycleMeasured: "measured in your report",
    closedHours: (h) => `${h}h/week with no one on the phone`,
    statsSources: [
      "62% of calls to small businesses go unanswered live (411 Locals, 2024)",
      "Under 3% of callers who hit voicemail leave a message (Invoca)",
      "Contact within 1 hour = 7× more likely to qualify the lead (Harvard Business Review)",
    ],
    freeWin: "✓ free — you can do this yourself",
    deliver: "What we deliver",
    gainLabel: "What you gain",
    gainCovers: (h) => `covers the ${h}h/week when no one answers today`,
    gainCalls: (n) => `recovers ~${n} calls/mo that hit voicemail today`,
    gainRevenue: (v) => `${v}/mo that is at risk today`,
    gainTicket: (t) => `collects on the call itself — ${t} average ticket, with no chasing`,
    gainUnpriced: (n) => `${n} unpriced service(s) stop becoming invented quotes`,
    gainLeak: (g) => `closes the measured leak: ${g}`,
    gainPulse: "measures every customer's satisfaction — included, at no cost",
    eta: "activation",
    pulseTitle: "Guileo Pulse",
    pulseTag: "on us",
    pulseBody: "Included as a courtesy — automatically measures your customers' satisfaction after every visit.",
    napkin: (t) => `A single recovered booking (~${t} at your average ticket) pays for weeks of Guileo.`,
    seoDesc: "Guileo Growth Report — real measured score, money at stake, and the recommended strategy.",
        date: "en-US",
  },
  es: {
    report: "Informe de Crecimiento",
    preparedFor: "preparado para",
    measuredIn: (n) => `medido en ${n} aspectos de tu negocio`,
    overallScore: "Puntaje general",
    aspects: "Puntaje por aspecto",
    snapshot: "Resumen visual",
    aspectsSub: "Cada nota viene de evidencias medidas de verdad — nada estimado a ojo.",
    notMeasured: "no medido",
    recommendation: "Recomendación",
    money: "El dinero en juego",
    moneySub: "Números con la premisa escrita debajo — eso hace cada cifra defendible.",
    missedCalls: "llamadas perdidas estimadas por mes",
    revenueAtRisk: "ingresos en riesgo estimados por mes",
    premise: "Cómo llegamos a este número",
    agentDoes: (a) => `${a} ya hace esto por tu negocio`,
    agentDoesSub: "En el teléfono, hoy — no es una promesa de roadmap.",
    agentCards: [
      ["📞", "Atiende 24/7", "Ninguna llamada cae al buzón — de madrugada, feriados, hora pico."],
      ["🌎", "EN + PT y ES nativos", "Atiende en inglés y habla portugués y español con voz nativa — cada cliente es atendido en su idioma."],
      ["📅", "Agenda al instante", "Consulta la agenda real y reserva el horario durante la misma llamada."],
      ["💵", "Cotiza el precio exacto", "Precio por servicio y por sede, directo del catálogo — nunca inventa un valor."],
      ["📝", "Captura presupuestos", "Cuando no hay precio cerrado, registra nombre + teléfono y el pedido para devolver la llamada."],
      ["🤝", "Reconoce a quien vuelve", "Saluda al cliente recurrente por su nombre y envía confirmación por correo con la marca del negocio."],
    ],
    nextLabel: "Siguiente escalón",
    nextIntro: "Una nota alta no es el final: mide lo que ya está en pie, no todo lo que eso podría hacer. Donde el catálogo Guileo tiene algo más que sumar, aparece aquí — y donde no lo tiene, no se escribe nada.",
    nextSteps: {
      presenca_web: "El sitio está en pie y es rápido. Lo que todavía no hace es VENDER: catálogo con precio, pago y agenda en la propia página.",
      vendas_digitais: "Vender sin nadie presente: pago online, links de cobro, paquetes y gift cards saliendo del mismo catálogo.",
      descoberta: "Aparecer ante quien busca hoy: SEO/AEO, ficha de Google alimentada y anuncios medidos por reservas, no por clics.",
      redes_sociais: "Publicar sin depender de la inspiración: contenido y creativo de anuncio con tu marca, y cada mensaje que llega se vuelve lead en el CRM.",
      atendimento: "Cubrir las horas en que suena el teléfono y no hay nadie — la agente atiende, cotiza del catálogo y agenda en la agenda real.",
      captura_de_leads: "Ningún contacto perdido: formulario, chat y WhatsApp caen en el mismo CRM, y la agente devuelve la llamada en ~60 segundos.",
    },
    opportunity: "Lo que muestran tus datos",
    lineLabel: (a) => `Línea de ${a} · atiende 24/7`,
    stepWord: "paso",
    strategyEyebrow: "El plan",
    strategyH1a: "Dos fases: ",
    strategyH1b: "parar la pérdida, después avanzar.",
    stripStop: "Parar la pérdida",
    stripAdvance: "Avanzar",
    phase1Title: "Fase 1 · Parar la pérdida",
    phase1Sub: "Ahora. Cada paso cierra una fuga YA MEDIDA en este informe — la cifra es tuya, no un promedio de mercado.",
    phase2Title: "Fase 2 · Avanzar",
    phase2Sub: "Cuando el agujero se cierra: crecer más allá de recuperar lo que hoy se pierde.",
    phase2Invite: "Nada aquí es una promesa: cada ◔ es una puerta que Guileo ya sabe abrir y que todavía no se midió en tu negocio. Por eso viene después — en orden, no en lista de espera.",
    phase2Close: "Cuando el agujero deja de gotear, la misma agente que ya atiende empieza a vender, recordar y traer de vuelta. La Fase 1 es lo que dejas de perder; la Fase 2 es lo que tu negocio empieza a hacer solo.",
    coverTitle: "Lo que cubre la Fase 1",
    coverCap: "del dinero medido en riesgo, por mes",
    badgeMeasured: "medido",
    badgePotential: "potencial",
    potentialLabel: "Ganancia potencial",
    capRisk: "en riesgo hoy, en la ventana que cubre este paso",
    capUnpriced: "servicios hoy sin precio",
    capTicket: "ticket promedio, cobrado en la propia llamada",
    strategy: "Estrategia recomendada",
    strategySub: "Dos movimientos: primero paramos lo que hoy se fuga, después crecemos más allá.",
    gap: "La fuga",
    solves: "Qué lo resuelve",
    competitors: "Competidores analizados",
    ctaTitle: "¿Listo para cerrar estas fugas?",
    ctaSub: "Dinos dónde contactarte y una persona real responde — normalmente en horas.",
    ctaHear: (a) => `📞 Escuchar a ${a} atendiendo en vivo`,
    ctaWa: "Hablar con Guileo",
    ctaCall: (a) => `Llamar a ${a} ahora`,
    waMsg: (b) => `¡Hola! Recibí el Informe de Crecimiento de ${b} y quiero conversar.`,
    loading: "Cargando tu informe…",
    notFoundTitle: "Informe no encontrado",
    notFoundBody: "Este enlace no corresponde a ninguna evaluación — puede haber expirado o llegó incompleto. No te mostraremos datos inventados.",
    notFoundCta: "Conocer Guileo",
    reMeasure: (a) => `Puntaje de hoy. Con ${a} activa, lo volvemos a medir en 30 días.`,
    showMore: (n) => `ver ${n} más`,
    showLess: "ver menos",
    agentBadges: [
      (n) => (n != null ? `🔥 +${n} llamadas/mes` : "🔥 +llamadas"),
      "🌎 +alcance", "📈 +reservas", "💰 +ventas", "➕ +leads", "🔁 +retención",
    ],
    cycleEyebrow: "El ciclo",
    cycleResult: "Lo que produce",
    cycleLoop: "…y todo eso vuelve a la próxima llamada: a quién ya atendió, qué ya cotizó y qué ya agendó entran en la conversación siguiente.",
    cycleBackTo: "vuelve al paso 1",
    cycleMeasured: "medido en tu informe",
    closedHours: (h) => `${h}h/semana con el teléfono sin nadie`,
    statsSources: [
      "El 62% de las llamadas a pequeños negocios no se atienden en vivo (411 Locals, 2024)",
      "Menos del 3% de quienes caen al buzón dejan mensaje (Invoca)",
      "Contacto en menos de 1h = 7× más probabilidad de calificar el lead (Harvard Business Review)",
    ],
    freeWin: "✓ gratis — lo haces tú mismo",
    deliver: "Lo que entregamos",
    gainLabel: "Lo que ganas",
    gainCovers: (h) => `cubre las ${h}h/semana en que hoy nadie atiende`,
    gainCalls: (n) => `recupera ~${n} llamadas/mes que hoy caen al buzón`,
    gainRevenue: (v) => `${v}/mes que hoy están en riesgo`,
    gainTicket: (t) => `cobra en la propia llamada — ticket promedio de ${t}, sin perseguir a nadie`,
    gainUnpriced: (n) => `${n} servicio(s) sin precio dejan de volverse cotización inventada`,
    gainLeak: (g) => `cierra la fuga medida: ${g}`,
    gainPulse: "mide la satisfacción de cada cliente — incluido, sin costo",
    eta: "activación",
    pulseTitle: "Guileo Pulse",
    pulseTag: "de regalo",
    pulseBody: "Incluido como cortesía — mide la satisfacción de tus clientes automáticamente después de cada visita.",
    napkin: (t) => `Una sola reserva recuperada (~${t} de tu ticket promedio) paga semanas de Guileo.`,
    seoDesc: "Guileo X-Ray — el puntaje medido de verdad, el dinero en juego y la estrategia recomendada para tu negocio.",
        date: "es-ES",
  },
  hi: {
    report: "ग्रोथ रिपोर्ट",
    preparedFor: "के लिए तैयार",
    measuredIn: (n) => `आपके व्यवसाय के ${n} पहलुओं में मापा गया`,
    overallScore: "कुल स्कोर",
    aspects: "पहलू के अनुसार स्कोर",
    snapshot: "त्वरित सारांश",
    aspectsSub: "हर अंक वास्तव में मापे गए प्रमाणों से आता है — कुछ भी अंदाज़े से नहीं।",
    notMeasured: "मापा नहीं गया",
    recommendation: "सिफ़ारिश",
    money: "दांव पर लगा पैसा",
    moneySub: "हर संख्या के नीचे उसकी धारणा लिखी है — यही हर आँकड़े को भरोसेमंद बनाता है।",
    missedCalls: "प्रति माह अनुमानित छूटी कॉलें",
    revenueAtRisk: "प्रति माह जोखिम में अनुमानित आय",
    premise: "यह संख्या कैसे निकली",
    agentDoes: (a) => `${a} आपके व्यवसाय के लिए यह पहले से करती है`,
    agentDoesSub: "फ़ोन पर, आज ही — यह कोई रोडमैप वादा नहीं है।",
    agentCards: [
      ["📞", "24/7 जवाब देती है", "कोई कॉल वॉइसमेल में नहीं जाती — देर रात, छुट्टी, व्यस्त समय।"],
      ["🌎", "EN + मूल PT और ES", "अंग्रेज़ी में जवाब देती है और पुर्तगाली व स्पैनिश मूल आवाज़ में बोलती है — हर ग्राहक अपनी भाषा में सुना जाता है।"],
      ["📅", "तुरंत बुकिंग", "असली कैलेंडर देखकर उसी कॉल में समय बुक करती है।"],
      ["💵", "सटीक दाम बताती है", "हर सेवा और शाखा का दाम सीधे कैटलॉग से — कभी दाम नहीं गढ़ती।"],
      ["📝", "कोटेशन दर्ज करती है", "जब तय दाम नहीं होता, नाम + फ़ोन और अनुरोध दर्ज कर फ़ॉलो-अप के लिए रखती है।"],
      ["🤝", "लौटने वालों को पहचानती है", "नियमित ग्राहक को नाम से बुलाती है और व्यवसाय की ब्रांडिंग वाला ईमेल कन्फ़र्मेशन भेजती है।"],
    ],
    nextLabel: "अगला पायदान",
    nextIntro: "ऊँचा स्कोर अंत नहीं है: वह मापता है कि क्या पहले से खड़ा है, यह नहीं कि वह क्या-क्या कर सकता है। जहाँ Guileo कैटलॉग में कुछ और जोड़ने को है, वह यहाँ दिखता है — और जहाँ नहीं है, वहाँ कुछ नहीं लिखा जाता।",
    nextSteps: {
      presenca_web: "साइट खड़ी है और तेज़ है। जो वह अब भी नहीं करती वह है बेचना: दाम वाला कैटलॉग, भुगतान और बुकिंग उसी पेज पर।",
      vendas_digitais: "बिना किसी के मौजूद हुए बेचना: ऑनलाइन भुगतान, पे-लिंक, पैकेज और गिफ़्ट कार्ड — सब उसी कैटलॉग से।",
      descoberta: "जो आज खोज रहे हैं उनके सामने दिखना: SEO/AEO, अपडेटेड Google लिस्टिंग, और बुकिंग से मापे गए विज्ञापन — क्लिक से नहीं।",
      redes_sociais: "प्रेरणा का इंतज़ार किए बिना पोस्ट करना: आपके ब्रांड में कंटेंट और विज्ञापन क्रिएटिव, और हर आने वाला मैसेज CRM में लीड बनता है।",
      atendimento: "उन घंटों को कवर करना जब फ़ोन बजता है और कोई नहीं होता — एजेंट उठाती है, कैटलॉग से दाम बताती है और असली कैलेंडर में बुक करती है।",
      captura_de_leads: "कोई संपर्क न छूटे: फ़ॉर्म, चैट और WhatsApp एक ही CRM में आते हैं, और एजेंट ~60 सेकंड में वापस कॉल करती है।",
    },
    opportunity: "आपका अपना डेटा क्या दिखाता है",
    lineLabel: (a) => `${a} की लाइन · 24/7 जवाब`,
    stepWord: "कदम",
    strategyEyebrow: "योजना",
    strategyH1a: "दो चरण: ",
    strategyH1b: "पहले नुकसान रोकें, फिर आगे बढ़ें।",
    stripStop: "नुकसान रोकें",
    stripAdvance: "आगे बढ़ें",
    phase1Title: "चरण 1 · नुकसान रोकें",
    phase1Sub: "अभी। हर कदम इस रिपोर्ट में पहले से मापे गए एक रिसाव को बंद करता है — यह आँकड़ा आपका है, कोई उद्योग औसत नहीं।",
    phase2Title: "चरण 2 · आगे बढ़ें",
    phase2Sub: "छेद बंद होने के बाद: आज जो खोते हैं उसे वापस पाने से आगे बढ़कर बढ़ना।",
    phase2Invite: "यहाँ कुछ भी वादा नहीं है: हर ◔ एक दरवाज़ा है जिसे Guileo खोलना जानती है और जो आपके व्यवसाय में अभी मापा नहीं गया। इसीलिए यह बाद में आता है — क्रम में, प्रतीक्षा सूची में नहीं।",
    phase2Close: "जब रिसाव रुक जाता है, वही एजेंट जो पहले से जवाब देती है, बेचना, याद रखना और लोगों को वापस लाना शुरू कर देती है। चरण 1 वह है जो आप खोना बंद करते हैं; चरण 2 वह है जो आपका व्यवसाय अपने आप करने लगता है।",
    coverTitle: "चरण 1 कितना कवर करता है",
    coverCap: "प्रति माह, मापे गए जोखिम वाले पैसे में से",
    badgeMeasured: "मापा गया",
    badgePotential: "संभावित",
    potentialLabel: "संभावित लाभ",
    capRisk: "आज जोखिम में, उसी विंडो में जिसे यह कदम कवर करता है",
    capUnpriced: "सेवाएँ जिनका आज दाम नहीं है",
    capTicket: "औसत टिकट, कॉल पर ही वसूला गया",
    strategy: "सुझाई गई रणनीति",
    strategySub: "दो कदम: पहले जो आज रिस रहा है उसे रोकें, फिर उससे आगे बढ़ें।",
    gap: "रिसाव",
    solves: "समाधान",
    competitors: "विश्लेषित प्रतिस्पर्धी",
    ctaTitle: "इन रिसावों को बंद करने के लिए तैयार?",
    ctaSub: "बताएँ आपसे कहाँ संपर्क करें — एक असली इंसान जवाब देगा, आमतौर पर घंटों में।",
    ctaHear: (a) => `📞 ${a} को लाइव सुनें`,
    ctaWa: "Guileo से बात करें",
    ctaCall: (a) => `${a} को अभी कॉल करें`,
    waMsg: (b) => `नमस्ते! मुझे ${b} की ग्रोथ रिपोर्ट मिली और मैं बात करना चाहता/चाहती हूँ।`,
    loading: "आपकी रिपोर्ट लोड हो रही है…",
    notFoundTitle: "रिपोर्ट नहीं मिली",
    notFoundBody: "यह लिंक किसी मूल्यांकन से मेल नहीं खाता — शायद समाप्त हो गया या अधूरा आया। हम आपको गढ़ा हुआ डेटा नहीं दिखाएँगे।",
    notFoundCta: "Guileo को जानें",
    reMeasure: (a) => `आज का स्कोर। ${a} सक्रिय होने पर 30 दिनों में फिर मापेंगे।`,
    showMore: (n) => `${n} और देखें`,
    showLess: "कम देखें",
    agentBadges: [
      (n) => (n != null ? `🔥 +${n} कॉल/माह` : "🔥 +कॉलें"),
      "🌎 +पहुँच", "📈 +बुकिंग", "💰 +बिक्री", "➕ +लीड", "🔁 +रिटेंशन",
    ],
    cycleEyebrow: "चक्र",
    cycleResult: "इससे क्या मिलता है",
    cycleLoop: "…और यह सब अगली कॉल में लौटता है: जिसे वह पहले सुन चुकी है, जो दाम बता चुकी है और जो बुकिंग कर चुकी है, वह अगली बातचीत में साथ आता है।",
    cycleBackTo: "कदम 1 पर वापस",
    cycleMeasured: "आपकी रिपोर्ट में मापा गया",
    closedHours: (h) => `${h} घंटे/सप्ताह फ़ोन पर कोई नहीं`,
    statsSources: [
      "छोटे व्यवसायों की 62% कॉलें लाइव नहीं उठतीं (411 Locals, 2024)",
      "वॉइसमेल में जाने वालों में 3% से कम संदेश छोड़ते हैं (Invoca)",
      "1 घंटे के भीतर संपर्क = लीड क्वालिफ़ाई होने की 7× संभावना (Harvard Business Review)",
    ],
    freeWin: "✓ मुफ़्त — आप खुद कर सकते हैं",
    deliver: "हम क्या देते हैं",
    gainLabel: "आपको क्या मिलता है",
    gainCovers: (h) => `उन ${h} घंटे/सप्ताह को कवर करता है जब आज कोई जवाब नहीं देता`,
    gainCalls: (n) => `~${n} कॉल/माह वापस लाता है जो आज वॉइसमेल में जाती हैं`,
    gainRevenue: (v) => `${v}/माह जो आज जोखिम में है`,
    gainTicket: (t) => `कॉल पर ही भुगतान — ${t} औसत टिकट, बिना पीछा किए`,
    gainUnpriced: (n) => `बिना कीमत वाली ${n} सेवाएँ अब गढ़ी हुई कोटेशन नहीं बनतीं`,
    gainLeak: (g) => `मापा गया रिसाव बंद करता है: ${g}`,
    gainPulse: "हर ग्राहक की संतुष्टि मापता है — शामिल, बिना शुल्क",
    eta: "सक्रियण",
    pulseTitle: "Guileo Pulse",
    pulseTag: "मुफ़्त उपहार",
    pulseBody: "सौजन्य से शामिल — हर विज़िट के बाद आपके ग्राहकों की संतुष्टि अपने आप मापता है।",
    napkin: (t) => `एक भी वापस पाई गई बुकिंग (~${t} औसत टिकट) हफ़्तों की Guileo फ़ीस चुका देती है।`,
    seoDesc: "Guileo X-Ray — असल में मापा गया स्कोर, दांव पर लगा पैसा और आपके व्यवसाय के लिए सुझाई गई रणनीति।",
        date: "hi-IN",
  },
};

/* ⚠️ ASPECT_LABELS / aspectLabel / NOT_MEASURED / bandColor / fmtMoney / hexRgb MUDARAM DE CASA
   (2026-08-18) → src/lib/reportScale.js. Não é arrumação: os blocos que espelham a landing
   (RelatorioEspelho.jsx) desenham a MESMA nota, com a MESMA banda de cor e o MESMO rótulo. Deixar
   uma cópia aqui criaria duas verdades sobre o mesmo score dentro da mesma página — que é
   exatamente o defeito que a lista de produtos escrita à mão já causou na landing. */

/* "free win" detector: recommendations the owner can do alone, today, for $0.
   Giving away the free fixes is what buys credibility for the paid ones.
   Keyword stems are accent-free and cover PT/EN/ES engine prose. */
const FREE_WIN_KEYS = ["precificar", "linkar", "clicavel", "clicável", "perfis ativos", "price the", "clickable", "link the", "enlazar"];
const isFreeWin = (...texts) => {
  const t = texts.map((x) => String(x || "").toLowerCase()).join(" ");
  return FREE_WIN_KEYS.some((k) => t.includes(k));
};

/* ⚠️ BrandLogo MUDOU DE ARQUIVO (2026-08-18) → components/RelatorioEspelho.jsx, junto com a CAPA,
   que é o único lugar da página que ainda desenha a marca do cliente. Deixar a função aqui, sem
   nenhuma chamada, seria a "constante órfã" que este repo já viu derrubar produção duas vezes:
   não quebra nada, ninguém procura defeito nela, e um dia alguém a edita achando que está no ar. */

/* ── animated counter: 0 → value when the number scrolls into view ──────────
   Same easing family as ScoreRing (cubic ease-out via rAF). Respects
   prefers-reduced-motion: value renders instantly, no animation. */
function CountUp({ value, format = (n) => n, duration = 1400 }) {
  const ref = useRef(null);
  const final = typeof value === "number" && Number.isFinite(value) ? value : null;
  /* ⚠️ COMEÇA NO VALOR CERTO — nunca em zero.
     Este relatório é um link que o Luis MANDA. A aba de destino pode estar em segundo
     plano, e aba escondida NÃO recebe requestAnimationFrame: o contador congela no meio
     e o dono lê um número FALSO ("4 ligações perdidas") logo acima da premissa que diz 33.
     Foi exatamente o que apareceu na verificação desta página.
     Inverter o padrão resolve na raiz: o estado inicial é o número VERDADEIRO, e só
     zeramos dentro de run(), quando a animação de fato vai rodar numa aba visível.
     Assim TODO modo de falha (rAF congelado, observer que não dispara, timer estrangulado,
     JS que morre no meio) cai no valor certo — o pior caso vira "sem animação", nunca
     "número errado". Fallback tem que falhar PRA VERDADE. */
  const [num, setNum] = useState(final ?? 0);
  useEffect(() => {
    if (final === null) return;
    const el = ref.current;
    const semMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!el || semMovimento || document.visibilityState !== "visible") { setNum(final); return; }
    let raf, pronto = false;
    const fechar = () => { pronto = true; setNum(final); };
    const run = () => {
      const start = performance.now();
      const tick = (now) => {
        if (pronto) return;
        const p = Math.min(1, (now - start) / duration);
        setNum(Math.round((1 - Math.pow(1 - p, 3)) * final));
        if (p < 1) raf = requestAnimationFrame(tick);
        else pronto = true;
      };
      setNum(0);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      if (!pronto && entries.some((e) => e.isIntersecting)) { io.disconnect(); run(); }
    }, { threshold: 0.4 });
    io.observe(el);
    /* se a aba sumir no meio da animação, fecha no valor certo em vez de congelar */
    const onVis = () => { if (document.visibilityState !== "visible") fechar(); };
    document.addEventListener("visibilitychange", onVis);
    const rede = setTimeout(fechar, duration + 1200);
    return () => {
      io.disconnect(); cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis); clearTimeout(rede);
    };
  }, [final, duration]);
  return <span ref={ref}>{format(final === null ? value : num)}</span>;
}

/* ── REVELA AS SEÇÕES (2026-08-22) ───────────────────────────────────────────
   Um observador para a página inteira, em vez de um componente por seção: as
   seções ganham a classe `.ap-rev` no próprio JSX e este hook liga o `.ap-in`
   quando cada uma chega à vista. Menos ruído no markup e um só lugar para
   consertar se o comportamento mudar.
   ⚠️ REDE DE SEGURANÇA (a mesma do CicloDaGui, que já resolveu isto uma vez):
   timer de 1,4s revela TUDO. Sem IntersectionObserver, com ele não disparando,
   ou com o JS morrendo no meio, o relatório aparece do mesmo jeito. Este
   documento é um link que o vendedor MANDA — página em branco por causa de
   animação é o pior desfecho possível, muito pior que não ter animação. */
function useRevelaSecoes(pronto) {
  useEffect(() => {
    if (!pronto) return;
    const els = Array.from(document.querySelectorAll(".ap-rev"));
    if (!els.length) return;
    const mostrar = (el) => el.classList.add("ap-in");
    const t = setTimeout(() => els.forEach(mostrar), 1400);
    if (!("IntersectionObserver" in window)) { els.forEach(mostrar); return () => clearTimeout(t); }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { mostrar(e.target); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => { clearTimeout(t); io.disconnect(); };
  }, [pronto]);
}

/* ── A DOR MEDIDA ABRE O RELATÓRIO (2026-08-22, pedido do Luis) ───────────────
   ⚠️ O NÚMERO 24/100 SAIU DE TODOS OS RELATÓRIOS. Luis: «sem esse número, todos».
   E ele está certo pelo motivo mais caro: a nota é uma coisa que NÓS damos. Chegar
   num encanador com 5 estrelas e 45 avaliações dizendo "você é 24 de 100" é ofensa
   com cara de diagnóstico — o dono fecha a aba antes da segunda dobra, e ele não
   está errado em fechar.
   O que abre agora é um fato DELE, medido: "144h por semana com o telefone sem
   ninguém". Não é julgamento, é espelho. E é exatamente a frase que a ligação usa.

   HONESTIDADE: o número grande só aparece quando existe número no achado. Achado
   sem grandeza ("não dá para marcar sem falar com alguém") vira manchete de texto —
   inventar um número aqui seria a mentira mais fácil e mais cara desta página. */
function DorDeAbertura({ achado, accent, eyebrow }) {
  if (!achado?.titulo) return null;
  // "Pelo menos 148h por semana…" / "144h por semana…" → 148 | 144
  const m = String(achado.titulo).match(/(\d[\d.,]*)\s*h\b/i);
  const n = m ? parseInt(m[1].replace(/[.,]/g, ""), 10) : null;
  const resto = m ? String(achado.titulo).replace(m[0], "").replace(/^\s*(pelo menos|at least)\s*/i, "").trim() : String(achado.titulo);

  // `.stagger` é o padrão da casa: entrada em cascata com `rise`, e o prefers-reduced-motion já
  // está tratado no index.css. Inventar um keyframe novo aqui criaria uma segunda gramática de
  // movimento dentro do mesmo produto.
  return (
    <div className="stagger flex flex-col items-center text-center md:items-start md:text-left">
      <div className="text-[10.5px] font-black uppercase tracking-[0.18em] text-g-muted">{eyebrow}</div>

      {Number.isFinite(n) ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[64px] font-black leading-[0.9] tabular-nums sm:text-[76px]" style={{ color: accent }}>
            <CountUp value={n} />
          </span>
          <span className="text-2xl font-bold text-g-word/70">h</span>
        </div>
      ) : null}

      <h1 className={`${Number.isFinite(n) ? "mt-2" : "mt-3"} max-w-[19ch] text-balance text-[22px] font-bold leading-tight text-g-word sm:text-[26px]`}>
        {resto}
      </h1>

      {achado.evidencia && (
        <p className="mt-3 max-w-[42ch] text-[12px] leading-relaxed text-g-muted">
          {achado.evidencia}
        </p>
      )}

      {/* A resposta vem COLADA na dor. Dor sem saída é só má notícia — e má notícia
          sozinha não vende, afasta. */}
      {achado.gui && (
        <p className="mt-4 max-w-[38ch] border-l-2 pl-3 text-[13.5px] font-semibold leading-snug text-g-ink"
           style={{ borderColor: accent }}>
          {achado.gui}
        </p>
      )}
    </div>
  );
}

/* ── animated score ring (SVG, stroke-dashoffset transition) ─────────────── */
function ScoreRing({ score, accent, label, notMeasuredLabel }) {
  const measured = typeof score === "number" && Number.isFinite(score);
  const [on, setOn] = useState(false);
  const [num, setNum] = useState(measured ? score : 0);
  useEffect(() => {
    if (!measured) return;
    const t = setTimeout(() => setOn(true), 150);
    /* mesma regra do CountUp: em aba escondida o rAF congela e o anel mostraria "0"
       no lugar da nota real. Só zera para animar quando a aba está visível. */
    const semMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (semMovimento || document.visibilityState !== "visible") {
      setNum(score);
      return () => clearTimeout(t);
    }
    const start = performance.now();
    let raf, pronto = false;
    const fechar = () => { pronto = true; setNum(score); };
    const tick = (now) => {
      if (pronto) return;
      const p = Math.min(1, (now - start) / 1300);
      setNum(Math.round((1 - Math.pow(1 - p, 3)) * score));
      if (p < 1) raf = requestAnimationFrame(tick);
      else pronto = true;
    };
    setNum(0);
    raf = requestAnimationFrame(tick);
    const onVis = () => { if (document.visibilityState !== "visible") fechar(); };
    document.addEventListener("visibilitychange", onVis);
    const rede = setTimeout(fechar, 2500);
    return () => {
      clearTimeout(t); cancelAnimationFrame(raf); clearTimeout(rede);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [score, measured]);
  const R = 64, C = 2 * Math.PI * R;
  return (
    <div className="relative h-44 w-44 shrink-0 sm:h-52 sm:w-52">
      {/* o halo acende junto com o traço: é o "catch the eyes" do topo, e some quando o anel
          termina de desenhar — brilho de ENTRADA, não brilho perpétuo */}
      {measured && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-full"
          style={{
            background: `radial-gradient(circle, ${accent}22, transparent 68%)`,
            opacity: on ? 1 : 0,
            transition: "opacity 1.3s ease",
          }} />
      )}
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="#2B2720" strokeWidth="11" />
        {measured ? (
          <circle
            cx="80" cy="80" r={R} fill="none"
            stroke={accent} strokeWidth="11" strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={on ? C * (1 - score / 100) : C}
            style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.22,.61,.36,1)" }}
          />
        ) : (
          <circle
            cx="80" cy="80" r={R} fill="none"
            stroke={NOT_MEASURED} strokeWidth="11" strokeDasharray="6 10" opacity="0.6"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        {measured ? (
          <span className="text-5xl font-extrabold text-g-word sm:text-6xl" style={{ fontVariantNumeric: "tabular-nums" }}>{num}</span>
        ) : (
          <span className="text-3xl font-extrabold" style={{ color: NOT_MEASURED }}>—</span>
        )}
        <span className="mt-0.5 text-[11px] uppercase tracking-wider text-g-muted">
          {measured ? label : notMeasuredLabel}
        </span>
      </div>
    </div>
  );
}

/* ── compact snapshot: the 6 aspect bars as a mini-chart, side by side with the
   ring. Same data & same band colors as the detailed section below. */
/* ⚡ A CASCATA CONTA A HISTÓRIA SOZINHA (Luis, 2026-08-19: «aqui pode dar uma dinamizada, algo
   pra CATCH THE EYES»). As barras não enchem na ordem da lista: enchem NA ORDEM DA NOTA — as
   verdes sobem primeiro e cheias, as vermelhas ficam curtas e chegam por último. O olho vê o
   problema antes de ler qualquer palavra, e a ordem das LINHAS não muda (a leitura por aspecto
   continua a mesma) — só o atraso de cada uma. Nenhum número é tocado: a largura é sempre
   `score%`, e "não medido" continua hachurado, nunca uma barra de tamanho zero. */
function MiniBars({ aspectos, lang, notMeasuredLabel }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    /* reduced motion: nasce preenchido, sem transição — o estado final NUNCA depende do movimento */
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) { setOn(true); return; }
    const t = setTimeout(() => setOn(true), 300);
    return () => clearTimeout(t);
  }, []);

  /* ⚡ A CASCATA CONTA A HISTÓRIA SOZINHA (Luis, 2026-08-19: «aqui pode dar uma dinamizada, algo
     pra CATCH THE EYES»). As barras não enchem na ordem da lista: enchem NA ORDEM DA NOTA — as
     verdes sobem primeiro e cheias, as vermelhas ficam curtas e chegam por último. O olho vê o
     problema antes de ler qualquer palavra.
     ⚠️ O POSTO É GLOBAL, NÃO POR GRUPO: com o agrupamento por perna (abaixo), um posto calculado
     dentro de cada grupo faria a 1ª barra de cada perna sair junto, e a leitura "verde primeiro,
     vermelho por último" morreria exatamente onde ela é o argumento. Ordenando entre os SEIS, a
     história sobrevive ao agrupamento. Nenhum número é tocado: a largura é sempre `score%`, e
     "não medido" continua hachurado, nunca uma barra de tamanho zero. */
  const posto = new Map(
    aspectos
      .map((a, i) => [a.nome ?? i, a.score == null ? -1 : a.score])
      .sort((x, y) => y[1] - x[1])
      .map(([k], rank) => [k, rank])
  );

  const linha = (a, i) => {
    const medido = a.score != null;
    const cor = bandColor(a.score);
    return (
      <li key={a.nome || i}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-g-ink">{aspectLabel(a.nome, lang)}</span>
          <span className="shrink-0 text-[12px] font-bold" style={{ color: cor, fontVariantNumeric: "tabular-nums" }}>
            {medido ? a.score : notMeasuredLabel}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-g-deep">
          {medido ? (
            <div
              className="h-full rounded-full"
              style={{
                width: on ? `${a.score}%` : "0%",
                background: cor,
                transition: `width 1s cubic-bezier(.22,.61,.36,1) ${(posto.get(a.nome ?? i) ?? i) * 130}ms`,
              }}
            />
          ) : (
            <div className="h-full w-full rounded-full opacity-40" style={{ background: `repeating-linear-gradient(45deg, ${NOT_MEASURED}33 0 6px, transparent 6px 12px)` }} />
          )}
        </div>
      </li>
    );
  };

  /* ── O SNAPSHOT NO MESMO EIXO DO RESTO (Luis, 2026-08-19: «agrupa a parte do score») ─────────
     O topo mostrava os 6 aspectos em lista corrida enquanto os cards logo abaixo já vinham
     agrupados pelas 3 pernas: os MESMOS seis dados, duas organizações diferentes na mesma página.
     Agora é uma ordem só, do anel até o plano.
     ⚠️ DOIS SISTEMAS DE COR NÃO BRIGAM NA MESMA BARRA: a barra continua no `bandColor` (a FAIXA
     da nota — verde/âmbar/vermelho), e a cor da perna fica só no RÓTULO do grupo. Pintar a barra
     com a cor da perna apagaria a única informação que a barra existe pra dar.
     Aspecto fora do mapa não é chutado num grupo — cai no fim, sem rótulo. */
  const grupos = [...PERNAS, "outros"]
    .map((k) => ({
      k,
      m: k === "outros" ? null : pernaMeta(lang, k),
      itens: aspectos.filter((a) => (k === "outros" ? !PERNA_DO_ASPECTO[a.nome] : PERNA_DO_ASPECTO[a.nome] === k)),
    }))
    .filter((g) => g.itens.length > 0);

  return (
    <div className="space-y-3.5">
      {grupos.map((g) => (
        <div key={g.k}>
          {g.m && (
            <div className="mb-1.5 flex items-center gap-1.5">
              <span aria-hidden="true" className="text-[11px] leading-none">{g.m.icon}</span>
              <span className="text-[9.5px] font-black uppercase tracking-[0.16em]" style={{ color: g.m.accent }}>{g.m.badge}</span>
            </div>
          )}
          <ul className="space-y-2">{g.itens.map(linha)}</ul>
        </div>
      ))}
    </div>
  );
}

/* ── strategy step → thematic emoji, chosen by keywords in the step's own text.
   Payload text comes from the engine in Portuguese; keys are accent-free stems
   so they survive both "precificar/preço" and EN/ES variants. Order matters:
   first match wins. Fallback 🎯 (never empty). */
const STEP_EMOJI = [
  ["💬", ["whatsapp", "widget", "chat", "canal de texto", "mensagem", "sms", "text channel"]],
  ["⚡", ["speed-to-lead", "speed to lead", "60 segundos", "60 seconds", "formulario", "formulário", "form ", "lead", "responde primeiro"]],
  ["🏷️", ["preco", "preço", "precific", "catalogo", "catálogo", "cotac", "cotaç", "pricing", "price"]],
  ["📅", ["agenda", "agendamento", "marcar", "booking", "calendar"]],
  ["📱", ["instagram", "facebook", "rede social", "redes sociais", "social"]],
  ["💳", ["pagamento", "cobra", "gift", "pacote", "membership", "checkout", "venda online", "payment"]],
  ["🌐", ["site", "seo", "google", "ficha", "avaliac", "avaliaç", "review"]],
  // generic phone rule LAST: almost every step's prose mentions "ligação"
  ["📞", ["voz 24", "agente de voz", "caixa postal", "telefone", "ligac", "ligaç", "24/7", "voice agent", "call"]],
];
/* Fields are weighed most-specific first (produto → gap → recomendação): the
   product name identifies the step far better than its prose. */
const stepEmoji = (s) => {
  const fields = [s?.produto_guileo, s?.gap, s?.recomendacao].map((f) => String(f || "").toLowerCase());
  for (const field of fields) {
    if (!field) continue;
    for (const [emoji, keys] of STEP_EMOJI) if (keys.some((k) => field.includes(k))) return emoji;
  }
  return "🎯";
};

/* ── the step's product, with substance ──────────────────────────────────────
   Owner's ask (2026-08-18): "tem que ter mais informações, principalmente dos
   produtos que vamos entregar". A name badge doesn't sell — the owner can't
   tell what lands on Monday. The full spec (what it IS, 3 things it DOES, the
   activation window) lives in the product catalog, src/data/productSystem.js
   → PRODUCT_DETAIL, in 4 languages. `produto_id` is the stable key the engine
   emits; older payloads only carry the display name, so we infer from it. */
const PRODUCT_ALIAS = [
  ["answering", /voz 24|voice agent|agente de voz|recep/i],
  ["widget_whatsapp", /widget|whatsapp|chat/i],
  ["speedlead", /speed.?to.?lead|speed-to-lead/i],
  ["catalog", /cat[aá]logo|catalog/i],
  ["close_collect", /cobra|collect|cierra|fecha/i],
  ["agenda", /agenda|booking|scheduling/i],
  ["pulse", /pulse/i],
];
const productKey = (s) => {
  if (s?.produto_id) return s.produto_id;
  const t = String(s?.produto_guileo || "");
  for (const [id, re] of PRODUCT_ALIAS) if (re.test(t)) return id;
  return null;
};

/* ── O PLANO AGRUPADO POR PERNA (2026-08-18, pedido do Luis) ────────────────────────────────────
   «dividir a Fase 1 e a Fase 2 por GUILEO — o que cada perna vai fazer.» Dentro de cada fase os
   passos deixam de ser uma grade solta e viram três grupos: 🧠 Brain · 📈 AD · 🏗️ Build.
   A PERNA VEM DO DADO, em duas camadas e nesta ordem:
     1. `s.perna`, emitido pelo MOTOR (functions/lib/avaliacao.js), igual ao `fase`;
     2. `pilarDoPasso(produto_id)`, a mesma resposta pelo lado do CATÁLOGO — que é o que faz esta
        página funcionar HOJE, com os relatórios já gravados, antes de qualquer backfill.
   Passo cuja perna não dá pra saber NÃO é chutado num grupo: cai em `outros` e é desenhado
   depois dos três, sem cabeçalho. Grupo errado engana; grupo ausente só informa menos. */
const agruparPorPerna = (passos) => {
  const g = { brain: [], ad: [], build: [], outros: [] };
  for (const s of passos) {
    const k = s?.perna || pilarDoPasso(productKey(s));
    (g[k] || g.outros).push(s);
  }
  return g;
};

/* THE GAIN, IN THE OWNER'S OWN NUMBERS — never a made-up percentage.
   Every figure below comes from the payload: previsoes (missed calls, revenue
   at risk) and metricas_internas (open hours, average ticket, priced catalog).
   When a step has no number of its own, the gain quotes the measured leak the
   engine wrote — still the owner's data, never an invention. */
function gainsFor(step, money, c) {
  const id = productKey(step);
  const g = [];
  if (id === "answering") {
    if (money.closedH != null) g.push(c.gainCovers(money.closedH));
    if (money.missedCalls != null) g.push(c.gainCalls(money.missedCalls));
    if (money.riskFmt) g.push(c.gainRevenue(money.riskFmt));
  } else if (id === "close_collect") {
    if (money.ticketFmt) g.push(c.gainTicket(money.ticketFmt));
  } else if (id === "catalog") {
    if (money.unpriced) g.push(c.gainUnpriced(money.unpriced));
  } else if (id === "pulse") {
    g.push(c.gainPulse);
  }
  if (!g.length && step?.gap) g.push(c.gainLeak(step.gap));
  return g;
}

/* the gain block: its own visual signature (accent bar + accent chips) so it
   can never read as body copy. The owner lost this once in a redesign — it is
   the line that sells the step. */
function GainBlock({ gains, label }) {
  /* VERDE: o outro lado da moeda. O card mostra em vermelho o que vaza e logo abaixo,
     em verde, o que ela passa a ganhar — o olho entende a troca sem ler uma palavra.
     `accent` saiu da assinatura de propósito: a cor aqui é o SIGNIFICADO, não a marca dela. */
  if (!gains.length) return null;
  return (
    <div className="mt-4 rounded-xl border p-3" style={{ borderColor: `${GANHO}55`, background: `${GANHO}12` }}>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: GANHO }}>💰 {label}</p>
      <ul className="mt-1.5 space-y-1">
        {gains.map((g, i) => (
          <li key={i} className="flex gap-1.5 text-[13px] font-semibold leading-snug text-g-word">
            <span aria-hidden="true" style={{ color: GANHO }}>▸</span>
            <span>{g}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── O CICLO DA GUI (bloco 6) ──────────────────────────────────────────────────
   Pedido do Luis (2026-08-19): «essa parte precisa ficar melhor, mais dinâmica, animada.
   Precisa ser inteligente. Os + talvez com movimento pra que fiquem visíveis. E agrupe de
   maneira inteligente — talvez o CICLO da Gui com tudo isso, ligado aos RESULTADOS.»

   Eram 6 caixas soltas num grid 2×3, todas com o mesmo peso. Viraram UMA trilha: a agente
   tem um loop real (atende → fala a língua dele → cota do catálogo → agenda na agenda real →
   captura quem não fecha → reconhece quem volta) e o fim volta ao começo. A ordem do ciclo é
   a coluna da ESQUERDA (disco numerado + trilho contínuo); o RESULTADO de cada etapa é a
   coluna da DIREITA, alinhada, então o dono lê "o que ela faz" na vertical e "o que isso
   produz" na vertical também, sem legenda.

   HONESTIDADE: o selo da etapa 1 é o ÚNICO número MEDIDO (previsoes.ligacoes_perdidas → money
   .missedCalls) e por isso é o único com peso de número: fundo cheio, ✓ e a legenda "medido no
   seu relatório". Os outros continuam benefício genérico (+leads, +agendamentos…), em contorno
   fino — achatar os dois no mesmo selo é exatamente o que apagaria a diferença. Nenhum número
   novo foi criado aqui: o texto dos cartões e dos selos continua vindo do dicionário.

   COR: os selos são GANHO (reportScale) — é o que ela PASSA a ganhar; a cor da cliente
   (accent) fica com a identidade dela (disco, número, trilho). Os dois sistemas não se
   misturam. MOVIMENTO com função (seção 7 da skill): cada linha entra escalonada quando chega
   à tela, o trilho "cresce" ligando um passo ao outro (é o que faz o ciclo ser lido como
   contínuo) e o "+" dá UM salto na entrada — uma vez, não pisca eterno. `prefers-reduced-motion`
   desliga tudo, e um timer de segurança revela as linhas se o IntersectionObserver não existir. */

/* a ordem do CICLO (não a ordem do dicionário): atende → idioma → cota → agenda → captura →
   reconhece. Os índices apontam para `agentCards`/`agentBadges`, então trocar a ordem aqui
   nunca inventa nem perde conteúdo. */
const CYCLE_ORDER = [0, 1, 3, 2, 4, 5];

/* o "+" com movimento: um salto só, na entrada da linha. Split em "+" ASCII — os emojis
   "➕"/"🔥" são outros code points, então nunca são partidos por engano. */
function PlusPop({ text }) {
  const i = String(text).indexOf("+");
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="gc-plus" aria-hidden="true">+</span>
      {text.slice(i + 1)}
    </>
  );
}

function CicloDaGui({ c, accent, rgb, missedCalls, agentName }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const rows = Array.from(root.querySelectorAll("[data-gc-row]"));
    const reveal = (el) => el.classList.add("gc-in");
    /* rede de segurança: sem IO (ou se ele não disparar), a seção NUNCA fica invisível */
    const t = setTimeout(() => rows.forEach(reveal), 1400);
    if (!("IntersectionObserver" in window)) { rows.forEach(reveal); return () => clearTimeout(t); }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 }
    );
    rows.forEach((r) => io.observe(r));
    return () => { clearTimeout(t); io.disconnect(); };
  }, []);

  const steps = CYCLE_ORDER.map((idx, pos) => {
    const [icon, title, body] = c.agentCards[idx];
    const raw = c.agentBadges?.[idx];
    const measured = typeof raw === "function";
    const badge = measured ? raw(missedCalls) : raw;
    return { icon, title, body, badge, measured: measured && missedCalls != null, n: pos + 1 };
  });

  return (
    <section className="ap-rev mt-16" ref={ref}>
      <style>{`
        @keyframes gcpop{0%{transform:scale(.35) translateY(7px);opacity:.2}
                         60%{transform:scale(1.4) translateY(-3px);opacity:1}
                         100%{transform:scale(1) translateY(0);opacity:1}}
        .gc-armed [data-gc-row]{opacity:0;transform:translateY(16px)}
        .gc-armed [data-gc-row].gc-in{opacity:1;transform:none;
          transition:opacity .5s ease,transform .55s cubic-bezier(.2,.7,.3,1)}
        .gc-armed .gc-line{transform:scaleY(0);transform-origin:top}
        .gc-armed .gc-in .gc-line{transform:scaleY(1);transition:transform .6s ease .12s}
        .gc-armed .gc-in .gc-plus{display:inline-block;animation:gcpop .6s cubic-bezier(.2,.9,.3,1.25) both}
        @media (prefers-reduced-motion: reduce){
          .gc-armed [data-gc-row],.gc-armed [data-gc-row].gc-in{opacity:1 !important;transform:none !important;transition:none !important}
          .gc-armed .gc-line,.gc-armed .gc-in .gc-line{transform:none !important;transition:none !important}
          .gc-armed .gc-in .gc-plus{animation:none !important}
        }
      `}</style>

      <h2 className="text-xl font-bold text-g-word">✨ {c.agentDoes(agentName)}</h2>
      <p className="mt-1 text-sm text-g-muted">{c.agentDoesSub}</p>

      {/* os dois cabeçalhos de coluna: à esquerda a ORDEM do ciclo, à direita o RESULTADO */}
      <div className="mt-5 hidden items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] sm:flex">
        <span style={{ color: accent }}>↻ {c.cycleEyebrow}</span>
        <span style={{ color: GANHO }}>{c.cycleResult}</span>
      </div>

      <ol className="gc-armed mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6"
        style={{ boxShadow: "0 22px 60px -34px rgba(0,0,0,0.9)" }}>
        {steps.map((s, i) => (
          <li key={s.n} data-gc-row className="relative pb-6 pl-14 last:pb-0"
            style={{ transitionDelay: `${i * 70}ms` }}>
            {/* o trilho: liga este passo ao próximo. Cresce na entrada — é o que faz a
                sequência ser lida como um fluxo e não como seis caixas. */}
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="gc-line absolute left-[21px] top-11 bottom-0 w-px"
                style={{ background: `linear-gradient(180deg, rgba(${rgb},0.55), rgba(${rgb},0.14))` }} />
            )}
            {/* disco numerado — identidade dela (accent), material de vidro frio da landing */}
            <span aria-hidden="true"
              className="absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-full text-base"
              style={{
                background: `rgba(${rgb},.13)`,
                boxShadow: `inset 0 0 0 1px rgba(${rgb},.4)`,
                filter: `drop-shadow(0 4px 12px rgba(${rgb},.35))`,
              }}>
              {s.icon}
            </span>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-[15rem]">
                <h3 className="font-semibold text-g-word">
                  <span className="mr-1.5 text-[12px] font-black tabular-nums" style={{ color: accent }}>{s.n}</span>
                  {s.title}
                </h3>
                <p className="mt-1 text-[13px] leading-snug text-g-ink">{s.body}</p>
              </div>
              {s.badge && (
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-block rounded-full border font-bold ${s.measured ? "px-3 py-1.5 text-[13px]" : "px-2.5 py-1 text-[11px]"}`}
                    style={
                      s.measured
                        ? { borderColor: `${GANHO}80`, background: `${GANHO}1F`, color: GANHO }
                        : { borderColor: `${GANHO}45`, background: `${GANHO}0D`, color: GANHO }
                    }
                  >
                    {s.measured && <span aria-hidden="true" className="mr-1">✓</span>}
                    <PlusPop text={s.badge} />
                  </span>
                  {/* só o número MEDIDO ganha a legenda — é o que impede o selo genérico
                      de parecer que também saiu do payload */}
                  {s.measured && (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-g-muted">
                      {c.cycleMeasured}
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}

        {/* o fecho do ciclo: o trilho tracejado volta ao passo 1 */}
        <li data-gc-row className="relative mt-2 pl-14" style={{ transitionDelay: `${steps.length * 70}ms` }}>
          <span aria-hidden="true" className="absolute left-[21px] -top-6 h-6 w-px border-l border-dashed"
            style={{ borderColor: `rgba(${rgb},0.45)` }} />
          <span aria-hidden="true"
            className="absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-full text-base"
            style={{ background: `rgba(${rgb},.10)`, boxShadow: `inset 0 0 0 1px rgba(${rgb},.35) ` }}>
            ↻
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
              style={{ borderColor: accent, color: accent }}>↻ {c.cycleBackTo}</span>
            <p className="min-w-0 flex-1 basis-[16rem] text-[13px] leading-snug text-g-ink">{c.cycleLoop}</p>
          </div>
        </li>
      </ol>
    </section>
  );
}

/* THE HEADLINE NUMBER of a Phase-1 step — the owner's own measured figure, shown in the
   landing's big-number typography (ResultsV2). Only steps that OWN a measured number get one;
   the rest keep the gain chips. Never a percentage, never a benchmark. */
function headlineFor(step, money, c) {
  const id = productKey(step);
  if (id === "answering" && money.riskFmt) return { value: money.riskFmt, cap: c.capRisk };
  if (id === "catalog" && money.unpriced) return { value: String(money.unpriced), cap: c.capUnpriced };
  if (id === "close_collect" && money.ticketFmt) return { value: money.ticketFmt, cap: c.capTicket };
  return null;
}

/* ── ONE STEP, IN THE LANDING'S OWN LANGUAGE ────────────────────────────────
   Reuses the vocabulary the owner already approved on guileoai.com:
   · glass card + inner shadow + accent top edge  → PillarsProducts
   · glowing glassy icon tile (rgba wash + inset ring + drop-shadow) → PillarsProducts / ServicesMarquee dots
   · big black number for the money figure → ResultsV2
   The DESIGN is Guileo; the COLOR is the client's ?accent. Phase 2 cards swap the accent for
   the champagne gold and carry an explicit "potential" seal — a potential gain must never be
   able to read as a measured one. */
/* ── O PASSO PROTAGONISTA (Luis apontou que "faltava impacto" e não soube dizer o quê) ────────
   O diagnóstico: o passo que sozinho cobre TODO o dinheiro em risco da Fase 1 estava desenhado
   igual aos outros três. A hierarquia já existia NO DADO — a premissa da fase diz que o agente
   de voz cobre os $1.278 inteiros — e era só a página que a escondia.
   ⚠️ E é por isso que o herói NÃO é escolhido a dedo: `heroi` é atribuído ao passo cujo número
   próprio é IGUAL ao total que a fase cobre (ver `heroiDaFase1` abaixo). Se um dia o motor mudar
   e outro passo passar a cobrir o total, o protagonismo muda junto, sozinho. Eleger "o mais
   importante" na mão seria opinião fantasiada de medição.
   O herói continua DENTRO do grupo da perna dele — protagonismo não pode quebrar o agrupamento
   que a página inteira ensina; ele só ocupa a linha toda e imprime o número maior. */
function StepCard({ step, n, accent, rgb, money, c, lang, potential, heroi = false }) {
  const d = productDetail(productKey(step), lang);
  const head = potential ? null : headlineFor(step, money, c);
  /* ⚠️ SEM REPETIR O VAZAMENTO DENTRO DO PRÓPRIO CARTÃO.
     `gainsFor` cai num fallback que RE-ESCREVE o gap quando o passo não tem número próprio
     ("fecha o vazamento medido: <gap>"). Mas o gap já está impresso três linhas acima, neste
     mesmo cartão, sob "O VAZAMENTO" — então o bloco que deveria VENDER repetia palavra por
     palavra o bloco que descreve o problema. Duas vezes a mesma frase é exatamente o que faz um
     cartão parecer genérico. Sem número próprio, o cartão já diz o que entrega (produto +
     bullets); o bloco de ganho só aparece quando tem algo a acrescentar. */
  const gains = (potential ? [] : gainsFor(step, money, c)).filter((g) => g !== c.gainLeak(step.gap));
  return (
    /* ⚠️ A FASE AGORA SE LÊ NA BORDA, NÃO NA COR (2026-08-18). Com o plano agrupado por perna, a
       cor passou a significar QUEM FAZ — então "medido × potencial" precisava de outro canal.
       Borda sólida = medido; borda TRACEJADA = potencial, o mesmo tracejado que o cartão de
       brinde já usa para dizer "isto é de outra natureza". Somado ao selo ✓/◔ que já existia, dá
       dois sinais independentes para a mesma distinção — e nenhum deles disputa com a perna.
       O hover levanta o cartão de leve: numa página longa que o Luis MANDA por link, é o retorno
       tátil que diz "isto é uma peça, dá pra percorrer" — 200ms, sem escala, sem festa. */
    <li
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl backdrop-blur transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none ${heroi ? "p-6 sm:col-span-2 sm:p-8" : "p-6"} ${potential ? "border-2 border-dashed" : "border border-white/10"} bg-white/[0.03]`}
      style={{
        boxShadow: heroi ? "0 34px 90px -40px rgba(0,0,0,0.95)" : "0 22px 60px -34px rgba(0,0,0,0.9)",
        ...(potential ? { borderColor: `rgba(${rgb},0.45)` } : null),
        ...(heroi ? { borderColor: `rgba(${rgb},0.35)` } : null),
      }}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.9),transparent)` }} />

      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]"
          style={{ background: `rgba(${rgb},0.13)`, boxShadow: `inset 0 0 0 1px rgba(${rgb},0.4)`, filter: `drop-shadow(0 4px 12px rgba(${rgb},0.45))` }}
          aria-hidden="true">
          {d?.icon || stepEmoji(step)}
        </span>
        <div className="min-w-0">
          {/* Phase 2 keeps the ENGINE's framing for the name ("Packages, Memberships & Gift
              Cards"), because that is the growth move being proposed; Phase 1 uses the catalog's
              approved product name. The delivery spec (what it is / does) comes from the catalog
              either way — we never rewrite a product claim inside the page. */}
          <div className="text-[15px] font-black leading-tight tracking-tight" style={{ color: accent }}>
            {(potential ? step.produto_guileo : d?.name) || d?.name || step.produto_guileo}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">
            {c.deliver}{d?.prazo ? ` · ⏱ ${d.prazo}` : ""}
          </div>
        </div>
        {/* "PASSO 4" em vez de um "4" solto: o número continuo 1…N só vira PLANO quando a
            palavra está junto — e é assim que ele é citado na conversa com o dono. */}
        <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-g-deep"
          style={{ background: accent }}>
          <span className="opacity-70">{c.stepWord}</span><span className="text-[12px] leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{n}</span>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
          style={{ borderColor: `rgba(${rgb},0.5)`, color: accent, background: `rgba(${rgb},0.08)` }}>
          {potential ? `◔ ${c.badgePotential}` : `✓ ${c.badgeMeasured}`}
        </span>
        {!potential && isFreeWin(step.gap, step.recomendacao) && (
          <span className="rounded-full border border-emerald-500/50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
            {c.freeWin}
          </span>
        )}
      </div>

      {/* ⚠️ O VAZAMENTO PRECISA DOER (Luis: "falta impacto"). Era rótulo miúdo cinza sobre texto
          cinza — a frase que descreve o PROBLEMA tinha menos peso que a que descreve a solução.
          Agora o rótulo é vermelho (PERDA, a mesma régua semântica do resto) e a frase ganha
          filete vermelho + texto claro. Na Fase 2 NÃO: lá o rótulo é "oportunidade", não
          vazamento — pintar de vermelho um ganho potencial seria mentir sobre o lado do número. */}
      {potential ? (
        <>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-g-muted">{c.opportunity}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-g-ink">{step.gap}</p>
        </>
      ) : (
        <div className="mt-4 border-l-2 pl-3" style={{ borderColor: PERDA }}>
          <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: PERDA }}>⚠ {c.gap}</p>
          <p className={`mt-0.5 leading-snug text-g-word ${heroi ? "text-[15px] font-semibold" : "text-[13.5px]"}`}>{step.gap}</p>
        </div>
      )}
      <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-snug text-g-word">{step.recomendacao}</p>
      {d?.whatIs && <p className="mt-2 text-[12.5px] leading-relaxed text-g-muted">{d.whatIs}</p>}
      {d?.bullets?.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-[12.5px] leading-snug text-g-ink">
          {d.bullets.map((b, i) => (
            <li key={i} className="flex gap-1.5">
              <span aria-hidden="true" style={{ color: accent }}>▸</span><span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {head && (
        <div className="mt-4 rounded-xl border p-4"
          style={{ borderColor: `rgba(${rgb},0.35)`, background: `linear-gradient(135deg, rgba(${rgb},0.14), transparent 72%)` }}>
          {/* VERMELHO: este número é sempre o que ela PERDE hoje (head só existe em passo
              medido da fase 1). Antes vinha no accent dela — azul não diz lado nenhum. */}
          <div className="text-[38px] font-black leading-none sm:text-[42px]"
            style={{ color: PERDA, fontVariantNumeric: "tabular-nums" }}>{head.value}</div>
          <div className="mt-1 text-[12px] font-semibold leading-snug text-g-ink">{head.cap}</div>
        </div>
      )}

      {/* the potential gain lives in its own block, with the dependency written by the ENGINE —
          we show the sentence it wrote, we never paraphrase it into something firmer */}
      {potential && step.potencial && (
        <div className="mt-4 rounded-xl border border-g-gold/40 bg-g-gold/[0.07] p-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-g-gold">◔ {c.potentialLabel}</p>
          <p className="mt-1 text-[13px] leading-snug text-g-ink">{step.potencial}</p>
        </div>
      )}

      {gains.length > 0 && <GainBlock gains={gains} label={c.gainLabel} />}
    </li>
  );
}

/* phase header: the landing's champagne eyebrow + font-black title, with the phase number in a
   glowing tile. Phase 1 wears the client's accent, Phase 2 the Guileo gold. */
function PhaseHeader({ n, title, sub, color, rgb, emoji, menor = false }) {
  /* CENTRALIZADO E COM EMOJI (Luis, 2026-08-19: "a fase 2 precisa centralizar o título e
     colocar emoji também, fica mais fácil de entender"). Aplicado nas DUAS fases de propósito:
     cabeçalho de fase é abertura de capítulo — uma centralizada e a outra à esquerda faria a
     página parecer desalinhada, não intencional. O emoji repete o da faixa "🩹 → 🚀" logo acima,
     então o olho reencontra a mesma marca e sabe em que metade do plano está. */
  return (
    <div className="mx-auto max-w-xl text-center" style={{ animation: "arreveal .7s ease both" }}>
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl text-[15px] font-black"
        style={{ color, background: `rgba(${rgb},0.13)`, boxShadow: `inset 0 0 0 1px rgba(${rgb},0.4), 0 8px 24px -12px rgba(${rgb},0.8)` }}>
        {n}
      </span>
      <h3 className="mt-3 font-black leading-tight tracking-tight text-g-word text-balance"
        style={{ fontSize: menor ? "clamp(1.05rem,2vw,1.35rem)" : "clamp(1.35rem,3vw,2rem)" }}>
        {emoji ? <span className="mr-2" aria-hidden="true">{emoji}</span> : null}{title}
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-g-muted">{sub}</p>
    </div>
  );
}

/* ── one aspect card: compact for the side-by-side grid ─────────────────────
   Name + score + bar on top, at most 2 evidences visible (rest behind a
   toggle), recommendation clamped to one line until expanded. Aspects marked
   as a "free win" get the credibility badge. */
/* ── O DIAGNÓSTICO NO MESMO EIXO DO PLANO (Luis, 2026-08-19) ───────────────────────────────────
   «essa parte também é bom AGRUPAR… pensa pra ficar único e inteligente.»
   Os 6 aspectos passam a viver sob as MESMAS três pernas dos pilares e das duas fases. Assim a
   página conta UMA história do topo ao fim: o mesmo Brain que aparece nos pilares é o que tem
   nota baixa no diagnóstico e é o que recebe o passo 1 do plano. Três eixos diferentes para a
   mesma coisa era o que fazia cada bloco parecer um documento distinto.

   O critério é o do catálogo — QUEM EXECUTA, não do que trata:
     🧠 Brain  → atendimento, captura_de_leads   (a agente atende e captura)
     ❤️ AD     → descoberta, redes_sociais       (o que traz movimento pra dentro)
     🏗️ Build  → presenca_web, vendas_digitais   (o corpo: o site e a máquina de vender)
   Aspecto que não estiver aqui NÃO é chutado num grupo: cai no bloco "outros", igual à regra dos
   passos do plano. */
const PERNA_DO_ASPECTO = {
  atendimento: "brain", captura_de_leads: "brain",
  descoberta: "ad", redes_sociais: "ad",
  presenca_web: "build", vendas_digitais: "build",
};

/* ── 100 NÃO É "ACABOU", É O PRÓXIMO DEGRAU ────────────────────────────────────────────────────
   A sacada do Luis: «website 100% presente, mas não VENDE por lá». O 100 de "presença web" mede
   que o site EXISTE e responde rápido — não que ele vende. Um 100 verde sozinho diz à dona "aqui
   está ótimo, não precisa de nada", e isso é falso pra ela e morto pra venda.

   ⚠️ O SCORE NÃO É TOCADO. 100 continua 100, continua verde: rebaixar nota medida para fabricar
   urgência seria a primeira mentira de um documento que se vende por não ter nenhuma. O próximo
   degrau é ADIÇÃO, não correção — e é sempre uma CAPACIDADE REAL do catálogo (productSystem.js),
   nunca um número, nunca uma promessa de resultado. Aspecto sem upside real de catálogo não
   ganha linha nenhuma: `nextSteps` simplesmente não tem a chave, e a linha não renderiza. */
function AspectRow({ a, lang, notMeasuredLabel, recLabel, freeWinLabel, showMore, showLess, delay, nextLabel, nextText }) {
  const c2 = espelhoCopy(lang);   /* rótulos de canal (presente/ausente) vivem no dicionário E */
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 250 + delay); return () => clearTimeout(t); }, [delay]);
  const measured = a.score != null;
  const color = bandColor(a.score);
  const all = a.evidencias || [];
  const evid = open ? all : all.slice(0, 2);
  const hidden = all.length - 2;
  const freeWin = isFreeWin(a.recomendacao);
  return (
    <div className="flex flex-col rounded-2xl border border-g-line bg-g-creamd/60 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate font-semibold text-g-word">{aspectLabel(a.nome, lang)}</h3>
        <span className="shrink-0 text-sm font-bold" style={{ color, fontVariantNumeric: "tabular-nums" }}>
          {measured ? `${a.score}/100` : notMeasuredLabel}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-g-deep">
        {measured ? (
          <div className="h-full rounded-full" style={{ width: on ? `${a.score}%` : "0%", background: color, transition: "width 1s cubic-bezier(.22,.61,.36,1)" }} />
        ) : (
          <div className="h-full w-full rounded-full opacity-40" style={{ background: `repeating-linear-gradient(45deg, ${NOT_MEASURED}33 0 6px, transparent 6px 12px)` }} />
        )}
      </div>
      {/* ── O ÍCONE DO CANAL, SÓ ONDE HOUVE MEDIÇÃO ───────────────────────────────────────
             `iconeDoCanal` devolve null quando a linha não tem veredito (as linhas "— não
             medido" do aspecto "descoberta" caem exatamente aqui). Então canal não medido não
             ganha ícone apagado — ele simplesmente não aparece nesta lista, e continua existindo
             inteiro e colorido na seção de canais da Guileo, onde a afirmação é sobre NÓS.
             O estado vai no aria-label, não só na cor: leitor de tela também precisa saber. */}
      {evid.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px] leading-snug text-g-ink">
          {evid.map((e, i) => {
            const ic = iconeDoCanal(e);
            if (!ic) return <li key={i}>{e}</li>;
            const Ico = ic.Icon;
            return (
              <li key={i} className="flex items-start gap-2">
                <span role="img" aria-label={`${ic.n} — ${ic.estado ? c2.chOn : c2.chOff}`}
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px]"
                  /* 🚨 AUSENTE ≠ NÃO MEDIDO. Na 1ª versão eu pintei o ícone ausente com
                     NOT_MEASURED — o MESMO cinza que a página inteira usa para "não medimos
                     isto". Mas o Facebook aqui FOI medido: o motor procurou e não achou. Cinza
                     ali fundiria as duas coisas que esta página mais separa (ausência de dado ×
                     dado que diz ausência), e é o defeito de sistema de cor que a skill descreve.
                     Ausente medido é um ACHADO, então usa PERDA — a mesma régua de "isto é um
                     buraco" do resto da página. E "não medido" continua sem ícone nenhum. */
                  style={{
                    color: ic.estado ? ic.c : PERDA,
                    background: ic.estado ? `${ic.c}1f` : `${PERDA}1a`,
                    boxShadow: `inset 0 0 0 1px ${ic.estado ? `${ic.c}55` : `${PERDA}55`}`,
                  }}><Ico /></span>
                <span className="min-w-0">{e}</span>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 self-start text-[12px] font-semibold text-g-muted underline decoration-dotted underline-offset-2 hover:text-g-ink"
        >
          {open ? showLess : showMore(hidden)}
        </button>
      )}
      {a.recomendacao && (
        <p
          className={`mt-3 border-t border-g-line pt-2.5 text-[13px] text-g-muted ${open ? "" : "line-clamp-1"}`}
          title={open ? undefined : a.recomendacao}
        >
          <span className="font-semibold text-g-ink">{recLabel}: </span>{a.recomendacao}
        </p>
      )}
      {/* o próximo degrau — o que AINDA dá pra ganhar aqui, inclusive num 100 */}
      {nextText && (
        <p className="mt-3 rounded-xl border px-3 py-2 text-[12.5px] leading-snug"
          style={{ borderColor: `${GANHO}40`, background: `${GANHO}0D`, color: "#D8D2C6" }}>
          <span className="font-bold" style={{ color: GANHO }}>↗ {nextLabel}: </span>{nextText}
        </p>
      )}
      {freeWin && (
        <span className="mt-2 inline-flex self-start rounded-full border border-emerald-500/50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
          {freeWinLabel}
        </span>
      )}
    </div>
  );
}


/* ═══ RESUMO EM UMA TELA — 1, 2, 3 ══════════════════════════════════════════════════════════════
   Luis (24/08): «o cliente precisa entender a avaliação de uma vez, e a solução em duas etapas de
   uma vez, estilo o e-mail». A página tinha 25 TELAS de rolagem: cada bloco é honesto, mas quem
   abre um link no celular não vai minerar 25 telas pra achar a conclusão — ele fecha antes.

   Isto NÃO substitui nada: é a capa do laudo. Três respostas na altura de um polegar —
   (1) o que a gente mediu, (2) o que fazer, em duas etapas, (3) quanto custa começar — e o resto
   da página passa a ser a EVIDÊNCIA de quem quiser conferir, que é exatamente o papel dela.

   ⚠️ Nenhum número novo nasce aqui. Tudo vem do mesmo payload que os blocos de baixo usam; se o
   resumo e o detalhe pudessem discordar, o resumo seria um segundo painel com o mesmo número
   diferente — o defeito mais caro desta base. Não-medido continua cinza e continua `—`. */
const RES = {
  en: { tag: "The short version", um: "What we measured", dois: "What to do — two phases", tres: "How it starts",
        risco: "at risk every month", riscoSub: "if nothing changes", pior: "Weakest point",
        f1: "Stop the loss", f2: "Advance", passos: (n) => `${n} step${n !== 1 ? "s" : ""}`,
        cobre: "covers", ver: "See the full X-Ray below ↓", nada: "no step — nothing was invented to fill it" },
  pt: { tag: "O resumo", um: "O que a gente mediu", dois: "O que fazer — duas etapas", tres: "Como começa",
        risco: "em risco por mês", riscoSub: "se nada mudar", pior: "Ponto mais fraco",
        f1: "Parar a perda", f2: "Avançar", passos: (n) => `${n} passo${n !== 1 ? "s" : ""}`,
        cobre: "cobre", ver: "O raio-X completo está abaixo ↓", nada: "nenhum passo — nada foi inventado pra preencher" },
  es: { tag: "El resumen", um: "Lo que medimos", dois: "Qué hacer — dos fases", tres: "Cómo empieza",
        risco: "en riesgo por mes", riscoSub: "si nada cambia", pior: "Punto más débil",
        f1: "Detener la pérdida", f2: "Avanzar", passos: (n) => `${n} paso${n !== 1 ? "s" : ""}`,
        cobre: "cubre", ver: "El rayos-X completo está abajo ↓", nada: "ningún paso — nada se inventó para llenarlo" },
  hi: { tag: "सारांश", um: "हमने क्या मापा", dois: "क्या करें — दो चरण", tres: "शुरुआत कैसे",
        risco: "हर महीने जोखिम में", riscoSub: "अगर कुछ नहीं बदला", pior: "सबसे कमज़ोर बिंदु",
        f1: "नुकसान रोकें", f2: "आगे बढ़ें", passos: (n) => `${n} कदम`,
        cobre: "कवर करता है", ver: "पूरा एक्स-रे नीचे है ↓", nada: "कोई कदम नहीं — भरने के लिए कुछ नहीं गढ़ा गया" },
};

function ResumoUmaTela({ lang, accent, score, aspectos, riskFmt, premissa, fase1, fase2, cobre, notMeasured, dor }) {
  const t = RES[lang] || RES.en;
  // O pior aspecto MEDIDO. Um aspecto sem nota não é "o pior" — é desconhecido, e chamar
  // desconhecido de pior é a mesma mentira do `null` virando 0.
  const medidos = (aspectos || []).filter((a) => a.score != null);
  const pior = medidos.length ? medidos.reduce((m, a) => (a.score < m.score ? a : m)) : null;
  const N = ({ n, cor, children }) => (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
            style={{ background: `${cor}22`, color: cor, border: `1px solid ${cor}66` }}>{n}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
  return (
    <div className="mb-10 rounded-3xl border border-g-line bg-g-creamd/70 p-5 backdrop-blur sm:p-7"
         style={{ boxShadow: "0 22px 60px -34px rgba(0,0,0,0.9)" }}>
      <div className="text-[10.5px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>{t.tag}</div>

      <div className="mt-5 space-y-5">
        <N n="1" cor={accent}>
          <div className="text-[13px] font-black uppercase tracking-wider text-g-muted">{t.um}</div>
          {/* ⚠️ O "24/100" SAIU DAQUI TAMBÉM (2026-08-22). Ele aparecia em DOIS lugares — o anel
              no topo e este resumo — e tirar só um deixaria a página se contradizendo: "não te
              damos nota" na primeira dobra e "você é 24" trezentos pixels abaixo.
              O ponto mais fraco FICA: apontar onde dói é diagnóstico. O que sai é a NOTA. */}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {dor?.titulo ? (
              <span className="text-[17px] font-bold leading-snug text-g-word">{dor.titulo}</span>
            ) : pior ? (
              <span className="text-[17px] font-bold leading-snug text-g-word">{aspectLabel(pior.nome, lang)}</span>
            ) : (
              <span className="text-[15px] text-g-muted">{notMeasured}</span>
            )}
            {dor?.titulo && pior && (
              <span className="text-[13px] text-g-muted">· {t.pior}: <b>{aspectLabel(pior.nome, lang)}</b></span>
            )}
          </div>
          {riskFmt && (
            <div className="mt-2.5">
              <span className="font-mono text-[22px] font-black" style={{ color: PERDA }}>{riskFmt}</span>
              <span className="text-[13.5px] text-g-muted"> {t.risco} — {t.riscoSub}</span>
              {premissa && <div className="mt-1 text-[11.5px] leading-snug text-g-muted/80">{premissa}</div>}
            </div>
          )}
        </N>

        <N n="2" cor={accent}>
          <div className="text-[13px] font-black uppercase tracking-wider text-g-muted">{t.dois}</div>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {[{ ic: "🩹", nome: t.f1, n: fase1.length, extra: cobre?.valor ? `${t.cobre} ${fmtMoney(cobre.valor, cobre.moeda, lang)}` : "", cor: PERDA },
              { ic: "🚀", nome: t.f2, n: fase2.length, extra: "", cor: GANHO }].map((f, i) => (
              <div key={i} className="rounded-2xl border border-g-line bg-white/[0.03] px-4 py-3">
                <div className="text-[14px] font-black text-g-word">{f.ic} {f.nome}</div>
                <div className="mt-1 text-[12.5px] text-g-muted">
                  {f.n ? t.passos(f.n) : t.nada}
                  {f.extra && <> · <b style={{ color: f.cor }}>{f.extra}</b></>}
                </div>
              </div>
            ))}
          </div>
        </N>
      </div>

      <a href="#plano" className="mt-5 inline-block text-[13px] font-bold" style={{ color: accent }}>{t.ver}</a>
    </div>
  );
}

export default function Apresentacao() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { lang, setLang } = useLang();

  const [state, setState] = useState({ status: "loading", data: null });

  /* ── O IDIOMA DO RELATÓRIO É O DO PAYLOAD (2026-08-18) ────────────────────
     O motor agora GRAVA em que idioma escreveu (avaliacao.js → lang). Antes a
     moldura vinha do idioma da página e o conteúdo vinha sempre em português:
     o Growth Report da Lilian (NYC, fala inglês) tinha títulos em inglês com
     evidências em português. Lei do repo: nada de texto EN em página PT, nem o
     contrário. Aqui a página segue o payload — e alinha a moldura inteira
     (navbar/rodapé) com setLang, a menos que a URL peça um idioma na mão. */
  /* ⚠️ ESTE HOOK FICA AQUI, ACIMA DOS RETURNS ANTECIPADOS (loading / error).
     Eu o coloquei lá embaixo, junto de `isCliente`, e a página inteira caiu no
     "Opa — algo saiu do trilho": nos estados de carregando e de erro a função
     retorna ANTES, o hook não é chamado, a ordem dos hooks muda entre renders e
     o React derruba o componente. Build passou verde e a produção quebrou —
     exatamente o que a lei "build verde não é prova" descreve.
     `pronto` continua controlando o trabalho; o que não pode variar é a CHAMADA. */
  useRevelaSecoes(state.status === "ok");

  const payloadLang = state.data?.lang;
  const rlang = payloadLang && D[payloadLang] ? payloadLang : lang;
  const c = D[rlang] || D.en;
  const urlLang = sp.get("lang");
  useEffect(() => {
    if (payloadLang && D[payloadLang] && !urlLang && payloadLang !== lang) setLang(payloadLang);
  }, [payloadLang, urlLang, lang, setLang]);

  // ── A MARCA VEM DO REGISTRO, NÃO DA URL (2026-08-18) ──────────────────────────────────────
  // Antes logo/accent/agente só existiam como query param — então o link CURTO (/natura, que o
  // Luis manda por mensagem) chegava sem marca nenhuma: relatório da cliente sem a logo dela.
  // Link que perde a marca ao ser encurtado é link que ninguém vai mandar. A marca agora mora no
  // payload da avaliação (quem gerou sabe de quem é); a URL continua aceita e GANHA, para o
  // vendedor conseguir testar outra cor sem mexer no banco.
  const marca = (state.data && (state.data.payload || state.data)) || {};
  const accent = sp.get("accent") || marca.accent || "#D6C29A"; // champanhe Guileo é só o fallback
  const logo = sp.get("logo") || marca.logo || "";
  const agente = sp.get("agente") || marca.agente || "";
  const agentName = agente || "Gui";
  useEffect(() => {
    let alive = true;
    if (!id) { setState({ status: "error", data: null }); return; }
    // Relative on purpose: same-origin keeps the CSP happy; local dev proxies /api → prod (vite.config.js).
    fetch(`/api/avaliacao?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        // API shape: { ok, id, avaliado_em, avaliacao:{...} } (also tolerate flat/payload shapes)
        const av = j?.avaliacao || j?.payload || (j?.score_geral != null ? j : null);
        if (j?.ok && av && av.score_geral != null) setState({ status: "ok", data: av });
        else setState({ status: "error", data: null });
      })
      .catch(() => alive && setState({ status: "error", data: null }));
    return () => { alive = false; };
  }, [id]);

  /* ── O CATÁLOGO REAL DELA (serviços + preços + unidades) ────────────────────────────────────
     A MESMA fonte de onde a agente tira o preço na ligação: o site público do cliente
     (/api/client-site → RPC client_site_public, allowlist de campos, só se published).
     A chave é o SLUG, e ele não vive no payload da avaliação — então chega pela URL
     (?catalogo=<slug>, gravado no link curto em public/_redirects). SEM SLUG, a lista de
     serviços simplesmente NÃO aparece: os agregados (quantos serviços, quantos com preço, ticket
     médio, faixa) continuam vindo de `metricas_internas`, que é medido. Preferir um bloco ausente
     a um bloco adivinhado é a regra da casa — nome de serviço chutado numa página de venda é a
     pior mentira possível, porque é a que o dono confere primeiro. */
  const catalogoSlug = (sp.get("catalogo") || sp.get("slug") || "").trim().toLowerCase();
  const [perfil, setPerfil] = useState(null);
  useEffect(() => {
    if (!catalogoSlug) { setPerfil(null); return; }
    let alive = true;
    fetch(`/api/client-site?slug=${encodeURIComponent(catalogoSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j && j.found === true) setPerfil(j); })
      .catch(() => { /* catálogo é enfeite do relatório, nunca pode derrubá-lo */ });
    return () => { alive = false; };
  }, [catalogoSlug]);

  /* ── A CAPA DO SITE DELA ────────────────────────────────────────────────────────────────────
     Luis: «tente a capa (og:image/hero); se o site dela bloquear robô, caia num fundo da marca
     dela em vez de quebrar. NUNCA invente imagem.»
     /api/capa lê og:image → twitter:image → a maior imagem do herói, e devolve VAZIO quando não
     acha (site sem capa, 403 de robô, timeout). Vazio aqui não é erro: a faixa vira o degradê da
     COR dela com a LOGO dela — identidade real, não foto de banco de imagem. O `?capa=` na URL
     ganha de tudo, pro vendedor conseguir apontar a foto certa sem esperar deploy nenhum. */
  const capaUrl = sp.get("capa") || "";
  const [capaAuto, setCapaAuto] = useState("");
  const siteAv = state.data?.site || "";
  useEffect(() => {
    if (capaUrl || !siteAv) { setCapaAuto(""); return; }
    let alive = true;
    fetch(`/api/capa?site=${encodeURIComponent(siteAv)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok && j.capa) setCapaAuto(j.capa); })
      .catch(() => { /* sem capa → fundo da marca. Nunca quebra. */ });
    return () => { alive = false; };
  }, [capaUrl, siteAv]);

  useSeo({
    title: state.data?.business ? `${c.report} · ${state.data.business} | Guileo` : `${c.report} | Guileo`,
    description: c.seoDesc,
    path: `/apresentacao/${id || ""}`,
  });

  /* ── loading skeleton ── */
  if (state.status === "loading") {
    return (
      <div className="surface-real min-h-screen text-g-ink">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="animate-pulse space-y-6">
            <div className="mx-auto h-44 w-44 rounded-full border-8 border-g-line" />
            <div className="mx-auto h-6 w-64 rounded bg-g-line/60" />
            {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-g-creamd/60" />)}
          </div>
          <p className="mt-8 text-center text-sm text-g-muted">{c.loading}</p>
        </main>
        <Footer />
      </div>
    );
  }

  /* ── honest not-found ── */
  if (state.status === "error") {
    return (
      <div className="surface-real min-h-screen text-g-ink">
        <Navbar />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <div className="text-5xl">🔍</div>
          <h1 className="mt-4 text-2xl font-bold text-g-word">{c.notFoundTitle}</h1>
          <p className="mt-3 text-g-ink">{c.notFoundBody}</p>
          <a href="https://guileoai.com" className="mt-8 inline-block rounded-full px-6 py-3 font-semibold text-g-deep" style={{ background: accent }}>
            {c.notFoundCta}
          </a>
        </main>
        <Footer />
      </div>
    );
  }

  const av = state.data;
  const aspectos = av.aspectos || [];
  const prev = av.previsoes || {};
  const perdidas = prev.ligacoes_perdidas_estimadas_mes;
  const risco = prev.receita_em_risco_estimada_mes;
  /* THE PLAN IN TWO PHASES — the phase is the ENGINE's call (`fase`), never the layout's.
     Legacy payloads (written before phases existed) carry no `fase`: every step they hold was a
     measured-leak closer, so they fall into Phase 1 and the page keeps working unchanged. */
  const estrategia = (av.estrategia || []).slice().sort((a, b) => (a.prioridade ?? 99) - (b.prioridade ?? 99));
  const fase1 = estrategia.filter((s) => s.fase !== "avancar");
  /* ⚠️ O PULSE SAI DA LISTA DE PASSOS — ele já FECHA a Fase 2 como o cartão de brinde.
     O motor emite um passo `pulse` (fase "avancar") quando o site não tem caminho de avaliação
     nem prova social. Nesse caso o dono via o Guileo Pulse DUAS vezes na mesma fase: uma como
     passo cobrado e outra como presente — que é a pior contradição possível numa página de
     venda, porque desmente o "de brinde" na linha de cima. O cartão de brinde é a apresentação
     canônica do Pulse aqui; o passo do motor continua existindo no payload (e em qualquer outra
     superfície que o leia), só não é desenhado duas vezes nesta. */
  const fase2 = estrategia.filter((s) => s.fase === "avancar" && s.produto_id !== "pulse");
  /* NUMERAÇÃO CONTÍNUA, AGRUPAMENTO SEPARADO: o número do passo é a ordem do PLANO INTEIRO
     (1…7), não a posição dentro do grupo — assim "o passo 4" quer dizer a mesma coisa no papel,
     na conversa e na tela, mesmo com os cartões reagrupados por perna. */
  const ordemGlobal = new Map();
  [...fase1, ...fase2].forEach((s, i) => ordemGlobal.set(s, i + 1));
  const grupos1 = agruparPorPerna(fase1);
  const grupos2 = agruparPorPerna(fase2);
  const cobre = av.fases?.parar?.cobre || null;
  const avisoFase2 = av.fases?.avancar?.aviso || null;
  const accentRgb = hexRgb(accent);
  const concorrentes = av.concorrentes || [];
  const when = av.avaliado_em ? new Date(av.avaliado_em).toLocaleDateString(c.date, { day: "numeric", month: "long", year: "numeric" }) : "";
  const isCliente = av.modo === "cliente";
  /* ── A LINHA DA AGENTE ────────────────────────────────────────────────────────────────────
     🚨 ANTES ISTO ERA UMA BOMBA: `showCall = agente === "Lilian"` com o número +19298288170
     escrito na mão dentro do JSX. Ou seja, QUALQUER cliente aberto com `?agente=Lilian` mostraria
     o número da Natura — e um número errado numa capa assinada é o pior defeito possível desta
     página, porque o dono liga pra conferir em 10 segundos.
     Agora o número chega por `?linha=`, o mesmo mecanismo por-cliente que já traz accent, agente,
     catálogo, logo e capa (fixados em public/_redirects). Uma fonte só para a capa E para o botão
     de ouvir a agente. Sem `?linha=`, nada renderiza — cliente sem linha não tem essa prova.
     ✅ O valor de /natura foi conferido no motor antes de entrar: +19298288170 → agente
     agent_8701kxnfhgmgefzbbwda8d86mqwj → "Lilian · Natura Spa + Salon". */
  const linhaDigits = String(sp.get("linha") || "").replace(/[^0-9]/g, "");
  const linhaTel = linhaDigits ? `+${linhaDigits.length === 10 ? "1" : ""}${linhaDigits}` : "";
  /* formatado como gente lê: (929) 828-8170. Fora do padrão US de 10/11 dígitos mostramos o E.164
     cru — melhor um formato estrangeiro correto do que um formato bonito e errado. */
  const linhaFmt = (() => {
    const d = linhaDigits.length === 11 && linhaDigits.startsWith("1") ? linhaDigits.slice(1) : linhaDigits;
    return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : linhaTel;
  })();
  const showCall = !!linhaTel;
  /* real numbers straight from the payload — never invented:
     missed calls/mo (previsoes), closed hours/wk (168 − open hours from the
     platform's own schedule), average ticket (metricas_internas). */
  const mi = av.metricas_internas || {};
  const missedCalls = typeof perdidas?.valor === "number" ? perdidas.valor : null;
  const closedH = typeof mi.agenda_horas_semana === "number" && mi.agenda_horas_semana > 0
    ? Math.max(0, 168 - mi.agenda_horas_semana) : null;
  const ticketFmt = typeof mi.ticket_medio === "number" && mi.ticket_medio > 0
    ? fmtMoney(Math.round(mi.ticket_medio), risco?.moeda, c.date) : null;
  const riskFmt = typeof risco?.valor === "number" ? fmtMoney(risco.valor, risco.moeda, c.date) : null;
  const unpriced = typeof mi.servicos === "number" && typeof mi.servicos_com_preco === "number"
    ? Math.max(0, mi.servicos - mi.servicos_com_preco) : null;
  const money = { missedCalls, closedH, ticketFmt, riskFmt, unpriced };

  /* ── OS DADOS DOS BLOCOS-ESPELHO — TODOS DERIVADOS DO QUE JÁ FOI MEDIDO ─────────────────────
     Nada aqui inventa: cada item nasce de um campo do payload e some quando o campo não existe.
     `achados` são os achados COM EVIDÊNCIA do motor (cada um traz a evidência que o gerou), então
     usá-los na coluna "hoje" da comparação é citar o relatório, não opinar sobre o negócio. */
  const achadoIds = new Set((av.achados || []).map((a) => a?.id).filter(Boolean));
  const moeda = risco?.moeda || null;
  /* MESMO IDIOMA DO PAYLOAD nos blocos-espelho — a moldura e o conteúdo não podem divergir. */
  const espelho = espelhoCopy(rlang);

  /* Fatos MEDIDOS que entram embaixo do pilar, ALÉM das notas por aspecto.
     Só o Brain tem dois — são os únicos números do relatório que pertencem inequivocamente a um
     pilar. AD e Build ficam com as notas medidas deles e mais nada: encher os dois com frase
     genérica para "equilibrar os cartões" seria trocar dado por enfeite, que é como o folheto
     começa. Cartão mais curto é honesto; cartão preenchido no chute, não. */
  /* ⚠️ REVISADO 2026-08-19 — o buraco de 150px no meio dos cards de AD e Build.
     A regra antiga («cartão mais curto é honesto») estava certa sobre NÃO inventar e errada sobre
     a conclusão: com os três cards de altura igual, AD e Build vinham com zero linha de evidência
     e o `mt-auto` empurrava os chips pro rodapé, deixando um vão morto no meio. Card com oco no
     meio não convence ninguém — e o conserto certo nunca foi frase genérica: era CONTEÚDO REAL
     que já estava no payload e não estava sendo usado.
     As evidências dos aspectos de cada perna são medidas, com prova, e já aparecem no bloco de
     score logo acima. Aqui entram no máximo 2 por perna, preferindo o ACHADO (✗) ao elogio (✓) —
     é o gap que vende. E o filtro que faz isso continuar honesto: linha "não medido" NUNCA entra,
     porque ela não é evidência de nada. Perna sem evidência medida segue sem linha nenhuma. */
  const evidenciasDaPerna = (chaves) => {
    const brutas = chaves
      .flatMap((k) => aspectos.find((a) => a.nome === k)?.evidencias || [])
      .filter((e) => typeof e === "string" && !/n[ãa]o medid|not measured|no medid|मापा नहीं|नहीं मापा/i.test(e));
    const achados = brutas.filter((e) => e.trim().startsWith("✗"));
    const resto = brutas.filter((e) => !e.trim().startsWith("✗"));
    return [...achados, ...resto].slice(0, 2).map((e) => e.replace(/^[✓✗—-]\s*/, ""));
  };
  const pilarExtras = {
    brain: [
      closedH != null ? c.closedHours(closedH) : null,
      riskFmt ? c.gainRevenue(riskFmt) : null,
    ].filter(Boolean),
    ad: evidenciasDaPerna(["descoberta", "redes_sociais"]),
    build: evidenciasDaPerna(["presenca_web", "vendas_digitais"]),
  };

  /* ── A DOR QUE ABRE (2026-08-22) ───────────────────────────────────────────────────────────
     O achado mais grave vira a primeira dobra. Prefere o de HORÁRIO: telefone sem ninguém é a
     dor que vira dinheiro perdido na frase seguinte, e é a que a ligação usa. Sem achado grave,
     cai no primeiro que existir; sem achado nenhum, o componente não renderiza (nada inventado). */
  const dorAbertura = (() => {
    const lista = Array.isArray(av?.achados) ? av.achados : [];
    return lista.find((a) => a?.id === "fora_horario")
        || lista.find((a) => a?.gravidade === "alta")
        || lista[0] || null;
  })();

  /* ── O HERÓI DA FASE 1 ────────────────────────────────────────────────────────────────────
     Luis: "falta impacto". O impacto que faltava não era brilho — era HIERARQUIA: um dos passos
     cobre sozinho TODO o dinheiro em risco, e estava desenhado igual aos outros três.
     A eleição é feita pelo DADO: é herói o passo da Fase 1 cujo número próprio é idêntico ao
     total que a fase cobre. Se amanhã o motor mudar e outro passo passar a cobrir o total, o
     protagonismo muda sozinho — e se NENHUM passo cobrir o total, não existe herói e a grade
     volta a ser uniforme. Escolher na mão seria opinião com cara de medição. */
  const heroiFase1 = riskFmt
    ? estrategia.find((s) => (s.fase || "parar") === "parar" && headlineFor(s, money, c)?.value === riskFmt)
    : null;

  /* a tabela HOJE × COM A AGENTE — uma linha por dado medido, zero linha por média de mercado */
  const linhasCmp = [
    closedH != null ? [espelho.cmpClosed(closedH), espelho.cmpClosedW] : null,
    missedCalls != null ? [espelho.cmpMissed(missedCalls), espelho.cmpMissedW] : null,
    riskFmt ? [espelho.cmpRisk(riskFmt), espelho.cmpRiskW(cobre?.valor != null ? fmtMoney(cobre.valor, cobre.moeda, c.date) : riskFmt)] : null,
    unpriced ? [espelho.cmpUnpriced(unpriced), espelho.cmpUnpricedW] : null,
    achadoIds.has("um_idioma") ? [espelho.cmpLang, espelho.cmpLangW] : null,
    achadoIds.has("sem_texto") ? [espelho.cmpText, espelho.cmpTextW] : null,
    achadoIds.has("so_formulario") ? [espelho.cmpForm, espelho.cmpFormW] : null,
  ].filter(Boolean);

  return (
    <div className="surface-real min-h-screen text-g-ink">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-16 sm:pt-20">

        {/* 0 ── CAPA + PERFIL DO SITE DELE(A) — a primeira coisa que o dono vê é o NEGÓCIO DELE.
               Capa automática (og:image/twitter:image/herói via /api/capa); site sem capa ou robô
               bloqueado → degradê da cor da marca com a logo da marca. Nunca imagem inventada. */}
        <div className="mb-10">
          <CapaPerfil
            capa={capaUrl || capaAuto} logo={logo} accent={accent} rgb={accentRgb}
            business={av.business} site={av.site} locations={perfil?.locations || []} lang={rlang}
            eyebrow={c.report} linhaData={`${c.preparedFor} ${av.business}${when ? ` · ${when}` : ""}`}
            linhaTel={linhaTel} linhaFmt={linhaFmt} linhaLabel={c.lineLabel(agentName)}
          />
        </div>

        <ResumoUmaTela
          lang={rlang} accent={accent} score={av.score_geral} aspectos={aspectos}
          riskFmt={riskFmt} premissa={risco?.premissa} fase1={fase1} fase2={fase2}
          cobre={cobre} notMeasured={NOT_MEASURED} dor={dorAbertura}
        />

        {/* 1 ── HERO: brand + score ring SIDE BY SIDE with the snapshot chart.
               md+ = two columns; mobile = stacked, centered. */}
        <header className="grid items-center gap-8 md:grid-cols-2 md:gap-10">
          {/* left: the big ring.
              ⚠️ A LOGO E O NOME SAÍRAM DAQUI (2026-08-18) — foram para a CAPA, logo acima. Com os
              dois blocos no ar a página abria com a mesma logo e o mesmo nome duas vezes em menos
              de 300px de rolagem, que é a repetição que faz um documento de venda parecer montado
              às pressas. Identidade aparece UMA vez, no lugar onde ela é o assunto; aqui o assunto
              já é a NOTA. `BrandLogo` continua no arquivo porque é ele que garante o monograma
              quando a logo do cliente quebra — quem desenha a marca agora é a capa. */}
          {/* ⚠️ AQUI MORAVA O 24/100. Ver DorDeAbertura: a nota é julgamento NOSSO; o que
              abre agora é um fato MEDIDO do negócio dele. O ScoreRing continua no arquivo
              porque a mesma medição alimenta as barras por aspecto — o que saiu foi a NOTA
              GERAL na primeira dobra, que era a linha que fechava a aba. */}
          <DorDeAbertura achado={dorAbertura} accent={accent} eyebrow={c.snapshot} />

          {/* right: the same 6 aspects as a compact mini-chart */}
          {aspectos.length > 0 && (
            <div className="rounded-2xl border border-g-line bg-g-creamd/60 p-5 sm:p-6">
              <h2 className="text-sm font-bold text-g-word">📊 {c.snapshot}</h2>
              <p className="mt-0.5 text-[11px] leading-snug text-g-muted">{c.measuredIn(aspectos.length)}</p>
              <div className="mt-4">
                <MiniBars aspectos={aspectos} lang={rlang} notMeasuredLabel={c.notMeasured} />
              </div>
            </div>
          )}
        </header>

        {/* 2 ── SCORE BY ASPECT, AGRUPADO PELAS 3 PERNAS (ver PERNA_DO_ASPECTO acima)
               ⚠️ ESPAÇAMENTO DE SEÇÃO = mt-16 EM TODA A PÁGINA (revisão 2026-08-19). Estava
               mt-14 nas seções que moram nesta página e mt-16 nas que moram em
               RelatorioEspelho.jsx — ou seja, o respiro entre seções mudava conforme o ARQUIVO,
               não conforme a intenção. Rolando, isso é aquele "quase certo" que faz a página
               parecer montada por blocos em vez de composta. Agora é um ritmo só. */}
        {/* ✂️ CORTADO PARA PROSPECT (2026-08-22, pedido do Luis: «tá muito longo»).
            Esta seção são 6 barras + 6 cartões destrinchando cada aspecto — e leva junto o
            "Próximo degrau", que mora dentro do AspectRow. É diagnóstico DE PROFUNDIDADE:
            excelente para quem já comprou e quer saber onde mexer, e peso morto para quem
            ainda está decidindo se atende a ligação. Prospect precisa de: a dor → o que fazer
            → quanto custa não fazer.
            Fica INTEIRA para `isCliente` — o cliente pagante é justamente quem lê isso. */}
        {isCliente && (
        <section className="ap-rev mt-16">
          <h2 className="text-xl font-bold text-g-word">🔍 {c.aspects}</h2>
          <p className="mt-1 text-sm text-g-muted">{c.aspectsSub}</p>
          <p className="mt-2 max-w-3xl text-[12.5px] leading-snug text-g-muted">↗ {c.nextIntro}</p>
          <div className="mt-6 space-y-8">
            {[...PERNAS, "outros"].map((key) => {
              const doGrupo = aspectos.filter((a) =>
                key === "outros" ? !PERNA_DO_ASPECTO[a.nome] : PERNA_DO_ASPECTO[a.nome] === key
              );
              if (!doGrupo.length) return null;               /* grupo vazio não vira caixa vazia */
              const m = key === "outros" ? null : pernaMeta(rlang, key);
              return (
                <div key={key}>
                  {m && (
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[17px]"
                        style={{
                          background: `rgba(${m.rgb},.13)`,
                          boxShadow: `inset 0 0 0 1px rgba(${m.rgb},.4)`,
                          filter: `drop-shadow(0 4px 12px rgba(${m.rgb},.45))`,
                        }}>{m.icon}</span>
                      {/* ⚠️ SÓ O NOME DA PERNA AQUI. A frase da anatomia ("o cérebro — pensa,
                          atende, decide…") saiu deste cabeçalho na revisão de 2026-08-19: com os
                          pilares redesenhados, ela virou o TÍTULO grande daquela seção, e a skill
                          já manda ecoá-la uma vez por grupo do PLANO. Com este cabeçalho também
                          repetindo, cada frase aparecia 4× na mesma página (12 no total, somando
                          as três pernas) — e frase repetida demais deixa de ensinar e vira ruído.
                          O reconhecimento aqui já está garantido pelo ícone, pela cor e pelo nome. */}
                      <div className="min-w-0">
                        <div className="text-[13px] font-black tracking-tight" style={{ color: m.accent }}>{m.badge}</div>
                      </div>
                    </div>
                  )}
                  <div className="stagger mt-3 grid gap-4 md:grid-cols-2">
                    {doGrupo.map((a, i) => (
                      <AspectRow
                        key={a.nome || i} a={a} lang={rlang}
                        notMeasuredLabel={c.notMeasured} recLabel={c.recommendation}
                        freeWinLabel={c.freeWin} showMore={c.showMore} showLess={c.showLess}
                        delay={i * 120}
                        nextLabel={c.nextLabel} nextText={c.nextSteps?.[a.nome]}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* 3 ── THE MONEY AT STAKE — the ONLY red section on the page (the red
               only carries urgency because nothing else on the page is red).
               Numbers animate 0 → value on scroll, like the landing's stats. */}
        {(perdidas || risco) && (
          <section className="ap-rev mt-16">
            <h2 className="text-xl font-bold text-red-400">⚠️ {c.money}</h2>
            <p className="mt-1 text-sm text-g-muted">{c.moneySub}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {perdidas && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
                  <div className="text-5xl font-extrabold text-red-400" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <CountUp value={perdidas.valor} />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-red-300">{c.missedCalls}</div>
                  <p className="mt-3 border-t border-red-500/30 pt-3 text-[12px] leading-relaxed text-g-muted">
                    <span className="font-semibold">{c.premise}: </span>{perdidas.premissa}
                  </p>
                </div>
              )}
              {risco && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
                  <div className="text-5xl font-extrabold text-red-400" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <CountUp value={risco.valor} format={(n) => fmtMoney(n, risco.moeda, c.date)} />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-red-300">{c.revenueAtRisk}</div>
                  <p className="mt-3 border-t border-red-500/30 pt-3 text-[12px] leading-relaxed text-g-muted">
                    <span className="font-semibold">{c.premise}: </span>{risco.premissa}
                  </p>
                </div>
              )}
            </div>
            {closedH != null && (
              <p className="mt-3 text-[12px] font-semibold text-red-300/90">⏰ {c.closedHours(closedH)}</p>
            )}
            {/* market stats WITH named sources — the ballast under the estimate */}
            <ul className="mt-4 space-y-1 text-[11px] leading-snug text-g-muted">
              {c.statsSources.map((s, i) => <li key={i}>· {s}</li>)}
            </ul>
          </section>
        )}

        {/* 3.5 ── OS NÚMEROS DELE(A) + O CATÁLOGO DELE(A) ─────────────────────────────────
               Vem logo depois do dinheiro em risco de propósito: o dono acabou de ler um número
               grande e vermelho, e a primeira pergunta é "de onde você tirou isso?". Esta seção é
               a resposta — as contagens da conta ao vivo dele e o catálogo exato de onde a agente
               tira o preço. Só existe em modo cliente (é o snapshot interno que a alimenta). */}
        {isCliente && (
          <NumerosDoNegocio
            mi={mi} servicos={perfil?.services || []} accent={accent} rgb={accentRgb}
            lang={rlang} moeda={moeda} locale={c.date} fmt={fmtMoney}
          />
        )}

        {/* 3.6 ── BRAIN · AD · BUILD, NO NEGÓCIO DELE(A) */}
        {aspectos.length > 0 && (
          <PilaresDoNegocio
            aspectos={aspectos} extras={pilarExtras} accent={accent} lang={rlang}
            notMeasuredLabel={c.notMeasured}
          />
        )}

        {/* 3.7 ── OS CANAIS DA GUILEO (ver CanaisGuileo em RelatorioEspelho) ─────────────────
               Fica depois dos pilares e antes do ciclo dela de propósito: os pilares dizem QUEM
               é a Guileo, os canais dizem ONDE ela atua, e só então a página volta a falar do
               negócio dela. É a última seção que fala de nós antes do plano. */}
        <CanaisGuileo lang={rlang} accent={accent} />

        {/* 4 ── O CICLO DA GUI (modo cliente) — ver CicloDaGui acima */}
        {isCliente && (
          <CicloDaGui c={c} accent={accent} rgb={accentRgb} missedCalls={missedCalls} agentName={agentName} />
        )}

        {/* 5 ── THE PLAN, IN TWO PHASES ────────────────────────────────────
               Owner's ask (2026-08-18): the plan stops being a flat list and becomes a strategy
               — PHASE 1 stops the loss he already has (each step tied to a leak measured above,
               with his own number), PHASE 2 grows beyond it (every gain explicitly POTENTIAL).
               The PHASE ITSELF COMES FROM THE ENGINE (`fase` on each item) — the layout never
               decides what is measured and what is a bet. Payloads written before the phases
               existed have no `fase`; those steps were all leak-closers, so they read as Phase 1. */}
        {estrategia.length > 0 && (
          <section id="plano" className="ap-rev relative mt-16 scroll-mt-6">
            <style>{`
              @keyframes arreveal{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
              @keyframes arshine{to{background-position:220% center}}
              @keyframes arpulse{0%,100%{opacity:.45}50%{opacity:1}}
              @media (prefers-reduced-motion: reduce){
                .ar-anim,.ar-anim *{animation:none !important}
              }
            `}</style>
            {/* calm aurora wash in the client's color — presence without stealing the text
                (same device as LegsV2/PillarsProducts, tinted by ?accent instead of hardcoded) */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-72"
              style={{ background: `radial-gradient(760px 300px at 50% 20%, rgba(${accentRgb},0.10), transparent)` }} />

            <div className="ar-anim text-center">
              <div className="text-[12px] font-bold uppercase tracking-[0.26em]" style={{ color: accent, animation: "arreveal .7s ease both" }}>
                {c.strategyEyebrow}
              </div>
              <h2 className="mx-auto mt-3 max-w-2xl font-black leading-[1.02] tracking-tight" style={{ fontSize: "clamp(1.7rem,4vw,2.6rem)" }}>
                <span className="text-g-word" style={{ animation: "arreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{c.strategyH1a}</span>
                <span className="bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(90deg, ${accent}, #D6C29A, ${accent})`, backgroundSize: "220% auto", animation: "arreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, arshine 7s linear infinite" }}>
                  {c.strategyH1b}
                </span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-g-ink" style={{ animation: "arreveal .8s ease .3s both" }}>{c.strategySub}</p>
              {/* the two-phase strip — same "phase → phase" grammar as the landing's method scene */}
              {/* ⚠️ A LISTRA PERDEU A COR (2026-08-18). Ela pintava "parar" com o azul da cliente e
                  "avançar" com o champanhe da casa — e o champanhe É a cor do Guileo AD. Com o
                  plano agora agrupado por perna, a mesma tinta diria "fase 2" e "AD" ao mesmo
                  tempo, que é a definição de código de cor quebrado. As duas fases ficam neutras;
                  quem separa fase agora é o SELO do cartão (✓ medido / ◔ potencial). */}
              <div className="mx-auto mt-5 flex max-w-md flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-wider text-g-word"
                style={{ animation: "arreveal .8s ease .35s both" }}>
                <span>🩹 {c.stripStop}</span>
                <span className="text-g-muted" style={{ animation: "arpulse 2s ease-in-out infinite" }}>→</span>
                <span>🚀 {c.stripAdvance}</span>
              </div>
              {/* a legenda que torna o código de cor legível em 5 segundos */}
              <p className="mx-auto mt-3 max-w-lg text-[11.5px] leading-snug text-g-muted" style={{ animation: "arreveal .8s ease .4s both" }}>
                {espelho.legLegend}
              </p>
            </div>

            {/* ── FASE 1 · PARAR A PERDA ─────────────────────────────────── */}
            {fase1.length > 0 && (
              <div className="ar-anim mt-12">
                <PhaseHeader n="1" emoji="🩹" title={c.phase1Title} sub={c.phase1Sub} color="#D9D2C3" rgb="217,210,195" />
                {PERNAS.map((k) => {
                  const meta = pernaMeta(rlang, k);
                  const itens = grupos1[k];
                  return (
                    <PernaGrupo key={`g1-${k}`} meta={meta} vazio={itens.length === 0} contagem={itens.length} lang={rlang}>
                      {/* o herói vai para a FRENTE do próprio grupo (não para fora dele): o
                          agrupamento por perna é lei da página, protagonismo não pode quebrá-lo. */}
                      <ol className="stagger grid gap-4 sm:grid-cols-2">
                        {[...itens].sort((a, b) => (a === heroiFase1 ? -1 : b === heroiFase1 ? 1 : 0)).map((s, i) => (
                          <StepCard key={`p1-${k}-${i}`} step={s} n={ordemGlobal.get(s)} accent={meta.accent} rgb={meta.rgb}
                            money={money} c={c} lang={rlang} potential={false} heroi={s === heroiFase1} />
                        ))}
                      </ol>
                    </PernaGrupo>
                  );
                })}
                {grupos1.outros.length > 0 && (
                  <ol className="stagger mt-6 grid gap-4 sm:grid-cols-2">
                    {grupos1.outros.map((s, i) => (
                      <StepCard key={`p1-x-${i}`} step={s} n={ordemGlobal.get(s)} accent={accent} rgb={accentRgb}
                        money={money} c={c} lang={rlang} potential={false} />
                    ))}
                  </ol>
                )}

                {/* THE PHASE TOTAL — how much of the measured money at risk this phase covers.
                    The premise comes from the engine and says exactly what was summed and what
                    was deliberately left out; a number without its premise is not allowed here. */}
                {cobre && (
                  /* ⚠️ ESTE É O NÚMERO QUE ELA LEMBRA DEPOIS DE FECHAR A ABA — então é o maior
                     tipo da página inteira (nem o H1 do plano chega perto) e ganha respiro de
                     verdade. "Impacto" aqui é decidir o que importa mais e deixar o resto menor;
                     nada mais foi aumentado junto. */
                  <div className="mt-8 overflow-hidden rounded-xl3 border p-7 text-center backdrop-blur-sm sm:p-10"
                    style={{ borderColor: `rgba(${accentRgb},0.35)`, background: `linear-gradient(135deg, rgba(${accentRgb},0.12), transparent 70%)`, boxShadow: "0 40px 90px -50px rgba(0,0,0,0.85)" }}>
                    <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: accent }}>🩹 {c.coverTitle}</p>
                    {typeof cobre.valor === "number" ? (
                      <>
                        {/* VERMELHO: é o dinheiro em risco que a Fase 1 cobre — o maior número
                            da página e o que ela vai lembrar. Cor semântica, não a marca dela. */}
                        <div className="mt-3 font-black leading-[0.92] tracking-tight"
                          style={{ fontSize: "clamp(3.4rem,11vw,6.5rem)", color: PERDA, fontVariantNumeric: "tabular-nums" }}>
                          <CountUp value={cobre.valor} format={(n) => fmtMoney(n, cobre.moeda, c.date)} />
                        </div>
                        <div className="mt-3 text-[14px] font-semibold text-g-word">{c.coverCap}</div>
                      </>
                    ) : null}
                    {cobre.premissa && (
                      <p className="mx-auto mt-5 max-w-2xl border-t pt-4 text-[12px] leading-relaxed text-g-muted" style={{ borderColor: `rgba(${accentRgb},0.25)` }}>
                        <span className="font-semibold">{c.premise}: </span>{cobre.premissa}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── FASE 2 · AVANÇAR (+ o brinde fecha a fase) ─────────────── */}
            {/* ── FASE 2 = O DEPOIS ────────────────────────────────────────────────────────
                   Luis: "a 1 e a 2 estão parecidas demais". Estavam: mesma grade, mesma densidade,
                   mesmo ritmo — e potencial não pode pesar igual a medido. A diferença é de FORMA,
                   não de cor (cor é perna, e isso não muda): mais respiro no topo, cabeçalho menor,
                   grade mais espaçada e o bloco levemente recuado em contraste. Fase 1 é a conta
                   urgente e é densa; Fase 2 é o depois e respira. */}
            {/* ── O TOQUE DA FASE 2 (Luis, 2026-08-19: «dá um toque especial na Fase 2») ─────
                   A Fase 2 é, por construção, a irmã mais leve: sem número medido, sem o $1.278,
                   tudo com selo ◔. Isso está certo e não muda — quem paga é a urgência da Fase 1.
                   Mas "mais leve" não pode virar "menos cuidada", e o toque tinha que sair do que
                   ela É, não de enfeite: ela é a única parte da página que fala do FUTURO dela.
                   Três gestos, todos de FORMA e PALAVRA — zero dado novo, zero promessa:
                     1. um HORIZONTE: uma linha fina que clareia no centro e um brilho que sobe,
                        atrás do cabeçalho. Diz "aqui é depois" sem cor nova (é luz branca a 4%,
                        não tinta — cor continua sendo perna) e sem competir com nada;
                     2. o CONVITE: o ◔ deixa de soar como ressalva e passa a soar como porta. A
                        informação é idêntica ("não medido no seu negócio"), a temperatura é outra;
                     3. o FECHO (mais abaixo): a fase deixa de terminar seca no último card. */}
            <div className="ar-anim relative mt-24">
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-12 -z-10 h-40"
                style={{ background: "linear-gradient(0deg, rgba(255,255,255,0.05), transparent 75%)" }} />
              <span aria-hidden="true" className="pointer-events-none mx-auto mb-10 block h-px max-w-2xl"
                style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)" }} />
              <PhaseHeader n="2" emoji="🚀" title={c.phase2Title} sub={c.phase2Sub} color="#D9D2C3" rgb="217,210,195" menor />
              {/* o convite vem ANTES do aviso do motor: primeiro o enquadramento, depois a ressalva
                  que o próprio motor escreveu (que continua palavra por palavra como ele emitiu). */}
              <p className="mx-auto mt-5 max-w-2xl text-center text-[13px] leading-relaxed text-g-ink">
                {c.phase2Invite}
              </p>
              {avisoFase2 && (
                <p className="mt-4 rounded-xl border border-white/12 bg-white/[0.03] p-3 text-[12.5px] leading-snug text-g-ink backdrop-blur">
                  ◔ {avisoFase2}
                </p>
              )}
              {PERNAS.map((k) => {
                const meta = pernaMeta(rlang, k);
                const itens = grupos2[k];
                return (
                  <PernaGrupo key={`g2-${k}`} meta={meta} vazio={itens.length === 0} contagem={itens.length} lang={rlang}>
                    <ol className="stagger grid gap-6 sm:grid-cols-2">
                      {itens.map((s, i) => (
                        <StepCard key={`p2-${k}-${i}`} step={s} n={ordemGlobal.get(s)} accent={meta.accent} rgb={meta.rgb}
                          money={money} c={c} lang={rlang} potential />
                      ))}
                    </ol>
                  </PernaGrupo>
                );
              })}
              <ol className="stagger mt-7 grid gap-4 sm:grid-cols-2">
                {grupos2.outros.map((s, i) => (
                  <StepCard key={`p2-x-${i}`} step={s} n={ordemGlobal.get(s)} accent={accent} rgb={accentRgb}
                    money={money} c={c} lang={rlang} potential />
                ))}

                {/* ⚠️ O CARTÃO DE BRINDE SAIU DAQUI (2026-08-18). Luis: «nossa logo e identidade no
                    Guileo Pulse, COM FORÇA; trazer aquele mesmo termômetro… tem que ser melhor que
                    a Qualtrics.» Ele era um cartãozinho tracejado do tamanho de um dos passos —
                    tamanho de brinde de balcão para um produto que tem preço, categoria e
                    concorrente com nome. Virou seção própria (`PulsePresente`), logo abaixo desta
                    fase, com a marca da GUILEO, o termômetro real e a comparação de preço. */}
              </ol>

              {/* ── O FECHO DA FASE ──────────────────────────────────────────────────────────
                     A Fase 2 terminava seca no último card. Esta linha dá sentido ao conjunto —
                     e é escrita com cuidado para NÃO ser promessa de resultado: ela não diz
                     quanto ela vai ganhar, diz o que a OPERAÇÃO passa a fazer, que é justamente
                     o que os passos acima já descrevem um a um. Sem número, sem percentual, sem
                     "vai crescer X". O contraste com a Fase 1 é a frase inteira: "o que você para
                     de perder" × "o que o negócio passa a fazer sozinho". */}
              <p className="mx-auto mt-10 max-w-2xl border-t border-white/10 pt-6 text-center text-[14px] font-semibold leading-relaxed text-g-word">
                {c.phase2Close}
              </p>
            </div>

            {/* 🎁 O PRESENTE FECHA A FASE 2 — agora como produto, não como cartão */}
            <PulsePresente lang={rlang} moeda={moeda} />

            {/* napkin math: one recovered booking vs the subscription — real ticket only */}
            {ticketFmt && (
              <p className="mt-6 rounded-xl3 border border-g-line bg-white/[0.04] p-5 text-center text-sm font-semibold text-g-word backdrop-blur-sm">
                🧮 {c.napkin(ticketFmt)}
              </p>
            )}
          </section>
        )}

        {/* 5.5 ── A VITRINE INTEIRA + O PULSE DE BRINDE ──────────────────────────────────
               O plano acima diz o que ATIVA agora; esta seção mostra a casa inteira, por pilar,
               para o dono saber com quem está falando. Lê productSystem.js: produto novo entra
               sozinho, nos 4 idiomas, sem ninguém traduzir nada. */}
        <CatalogoProdutos accent={accent} rgb={accentRgb} lang={rlang} />

        {/* 5.6 ── PROVA · PADRÕES · COMPARAÇÃO · FECHAMENTO */}
        <ProvaComparacao
          linhas={linhasCmp} accent={accent} rgb={accentRgb} lang={rlang}
          moeda={moeda} riskFmt={riskFmt}
        />

        {/* ── A VIZINHANÇA ───────────────────────────────────────────────────────────────────
               Luis (2026-08-19): «adorei a análise do concorrente, isso é importante desse motor».
               Era a única parte do documento sem desenho: uma <ul> cuspindo `k.nome`, ou seja,
               NOMEANDO os vizinhos num papel que a cliente encaminha — fofoca de bairro que queima
               quem mandou. E vinha vazia de sentido, porque o motor buscava vizinho pelo NOME dela.
               Agora é uma régua por métrica: os vizinhos são a escala, ela é o marcador aceso, e o
               veredito sai em GANHO/PERDA. O bloco se recusa a desenhar com menos de 3 medições. */}
        <RelatorioVizinhanca
          concorrentes={concorrentes}
          meuNota={av.minha_ficha?.nota ?? null}
          meuAvaliacoes={av.minha_ficha?.avaliacoes ?? null}
          accent={accent} rgb={accentRgb} lang={rlang} agentName={agentName}
        />

        {/* 6 ── FECHAMENTO: A GUILEO PEDINDO A VENDA ─────────────────────────────────────
               Luis (2026-08-19): «esse final precisa ter CAPTURA DE LEADS, e ser inteligente e
               dinâmico. Tira esse AZUL e padroniza Guileo. Tipo o lead final da landing. E já
               deixa WhatsApp, Instagram, telefone, tudo num lugar só, porém EFICIENTE.»

               Eram dois botões no ACCENT DELA e nenhuma captura: o documento inteiro terminava
               sem um campo pra ela responder. Agora é o MESMO formulário multicanal da landing
               (LeadCaptureV2, reusado por prop — não clonado), no idioma do relatório.

               🎨 REGRA DE COR ATUALIZADA (registrada na seção 4 da skill): o accent da cliente
               vale nas superfícies DELA — capa, score, números dela, catálogo dela. O FECHAMENTO
               não é superfície dela: é a GUILEO pedindo a venda. Por isso veste a marca Guileo
               (verde→dourado), igual ao Pulse. Accent de cliente num pedido de venda faz o pedido
               parecer coisa dela — e some justamente onde precisava aparecer.

               EFICIENTE = uma ação primária (o formulário) e o resto como opção secundária: a
               fileira WhatsApp · agenda · Instagram vem do componente, e a voz — o único canal
               que é DESTE relatório — entra como um link discreto, não como 5 botões brigando.
               Canal que não existe de verdade não aparece: o telefone só entra com `showCall`. */}
        <LeadCaptureV2
          embedded
          lang={rlang}
          title={c.ctaTitle}
          sub={c.ctaSub}
          interest
          source={`relatorio:${av.business || "cliente"}`}
        />
        {showCall && (
          <div className="mx-auto -mt-2 max-w-xl text-center">
            <a href={`tel:${linhaTel}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-5 py-2.5 text-[14px] font-bold text-g-word transition hover:border-g-gold/50">
              {c.ctaHear(agentName)}
            </a>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
