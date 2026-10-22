// OS PLANOS DO GUILEO DESK — fonte única (2026-10-05). Decisão do Luis: «Escada de mercado».
// Preço por MÊS e por UNIDADE (cada endereço/loja). Nunca escreva estes preços em outro arquivo: importe.
//
// Régua de mercado usada na decisão: MindBody US$ 139–699/mês, Booksy US$ 29,99 + US$ 20 por profissional.
// O que nos separa: a IA (assistente da Central por texto e voz) a partir do Pro, e a recepção de voz 24/7
// no Ultra Pro — no MindBody e no Booksy isso é produto à parte.
//
// HONESTIDADE (lei da casa): cada item abaixo existe e foi provado em 05/10. O que depende de chave do
// cliente (Stripe para sinal/cobrança no cartão, A2P para SMS, aprovação do WhatsApp) vai com `depende`,
// e a página mostra isso — nunca como pronto.
//
// Ainda NÃO há trava por plano dentro do Desk: hoje toda conta vê tudo. `deskInclui()` existe para quando
// a cobrança por plano entrar; até lá, nenhuma tela some para quem já usa.

export const DESK_PLANS = [
  {
    key: "basic", name: "Basic", amount: 49, price: "$49", credits: 0,
    tag: { pt: "A agenda do balcão", en: "The front-desk calendar", es: "La agenda de recepción" },
    feats: {
      pt: ["Agenda por profissional (dia e semana), arrastar para remarcar", "Bloqueios, folgas e horário de cada profissional", "Ficha da cliente com histórico e alertas", "Página pública de agendamento", "Confirmação e lembrete por e-mail", "Link para a cliente remarcar ou cancelar sozinha", "App instalável no iPad e no celular"],
      en: ["Calendar by provider (day and week), drag to reschedule", "Blocks, time off and each provider's hours", "Client card with history and alerts", "Public booking page", "Email confirmation and reminder", "Link for clients to reschedule or cancel themselves", "Installable app on iPad and phone"],
      es: ["Agenda por profesional (día y semana), arrastrar para mover", "Bloqueos, días libres y horario de cada profesional", "Ficha de la clienta con historial y alertas", "Página pública de reservas", "Confirmación y recordatorio por e-mail", "Enlace para que la clienta cambie o cancele sola", "App instalable en iPad y celular"],
    },
  },
  {
    key: "medium", name: "Medium", amount: 99, price: "$99", credits: 0,
    tag: { pt: "O balcão inteiro", en: "The whole front desk", es: "Toda la recepción" },
    inherits: "basic",
    feats: {
      pt: ["Caixa: serviço, produto, pacote, vale-presente, gorjeta, pagamento dividido", "Comissão por profissional e fechamento do dia", "Recibo por e-mail com a sua marca", "Formulários e termos com assinatura", "Fila de espera que oferece a vaga sozinha quando alguém cancela", "Agendamento que repete (toda semana, a cada N semanas)", "Importação do MindBody / Booker"],
      en: ["Checkout: service, product, package, gift card, tip, split payment", "Commission per provider and end-of-day close", "Branded email receipt", "Forms and waivers with signature", "Waitlist that offers the spot by itself when someone cancels", "Recurring bookings (weekly, every N weeks)", "Import from MindBody / Booker"],
      es: ["Caja: servicio, producto, paquete, tarjeta regalo, propina, pago dividido", "Comisión por profesional y cierre del día", "Recibo por e-mail con tu marca", "Formularios y consentimientos con firma", "Lista de espera que ofrece el lugar sola cuando alguien cancela", "Citas que se repiten (cada semana, cada N semanas)", "Importación desde MindBody / Booker"],
    },
  },
  {
    key: "pro", name: "Pro", amount: 199, price: "$199", credits: 0, featured: true,
    tag: { pt: "Com a assistente de IA", en: "With the AI assistant", es: "Con la asistente de IA" },
    inherits: "medium",
    feats: {
      pt: ["Assistente de IA na Central, por texto e por voz: abre o dia pronto, marca, confirma, cobra", "Relatórios: ocupação, quem saiu com o próximo horário, horários mais cheios, quem vende mais", "\"Alguém faltou\": quem cobre cada cliente no mesmo horário e o aviso para elas", "Sinal no agendamento (com o seu Stripe)"],
      en: ["AI assistant in the dashboard, by text and voice: opens the day ready, books, confirms, charges", "Reports: occupancy, who rebooked, busiest hours, top sellers", "\"Someone's out\": who covers each client at the same time, and the message to them", "Booking deposit (with your Stripe)"],
      es: ["Asistente de IA en el panel, por texto y voz: abre el día listo, agenda, confirma, cobra", "Informes: ocupación, quién reagendó, horas más llenas, quién vende más", "\"Alguien faltó\": quién cubre a cada clienta a la misma hora y el aviso para ellas", "Depósito al reservar (con tu Stripe)"],
    },
    depende: { pt: ["Sinal: precisa do seu Stripe conectado"], en: ["Deposit: needs your Stripe connected"], es: ["Depósito: necesita tu Stripe conectado"] },
  },
  {
    key: "ultra", name: "Ultra Pro", amount: 399, price: "$399", credits: 1500,
    tag: { pt: "A recepção que nunca fecha", en: "The front desk that never closes", es: "La recepción que nunca cierra" },
    inherits: "pro",
    feats: {
      pt: ["Recepcionista de voz 24/7 no seu telefone, que marca direto na agenda", "Resumo, humor e intenção de cada ligação, com alerta de cliente insatisfeita", "Chat no seu site com a mesma IA", "Pedido de avaliação no Google e convite para voltar", "1.500 créditos por mês (cerca de 300 ligações)"],
      en: ["24/7 voice receptionist on your phone line, booking straight into the calendar", "Summary, mood and intent of every call, with an unhappy-client alert", "Chat on your website with the same AI", "Google review requests and come-back invitations", "1,500 credits a month (about 300 calls)"],
      es: ["Recepcionista de voz 24/7 en tu teléfono, que agenda directo", "Resumen, ánimo e intención de cada llamada, con alerta de clienta insatisfecha", "Chat en tu sitio con la misma IA", "Pedido de reseña en Google e invitación a volver", "1.500 créditos al mes (unas 300 llamadas)"],
    },
    depende: { pt: ["Texto por SMS e WhatsApp: depende da aprovação das operadoras"], en: ["SMS and WhatsApp messages: pending carrier approval"], es: ["SMS y WhatsApp: depende de la aprobación de las operadoras"] },
  },
  {
    key: "custom", name: { pt: "Personalizado", en: "Custom", es: "Personalizado" }, amount: null, price: null, credits: null,
    tag: { pt: "Para redes e operações grandes", en: "For chains and larger operations", es: "Para cadenas y operaciones grandes" },
    inherits: "ultra",
    feats: {
      pt: ["Várias unidades com relatório consolidado", "Migração feita pela nossa equipe", "Agente de voz com o nome e a voz da sua marca", "Integrações e automações sob medida", "Atendimento dedicado"],
      en: ["Multiple locations with a consolidated report", "Migration done by our team", "Voice agent with your brand's name and voice", "Custom integrations and automations", "Dedicated support"],
      es: ["Varias sedes con informe consolidado", "Migración hecha por nuestro equipo", "Agente de voz con el nombre y la voz de tu marca", "Integraciones y automatizaciones a medida", "Atención dedicada"],
    },
  },
];

const ORDEM = DESK_PLANS.map((p) => p.key);
export const deskPlan = (key) => DESK_PLANS.find((p) => p.key === key) || null;
// O plano `a` inclui tudo do plano `b`? (escada: basic < medium < pro < ultra < custom)
export const deskInclui = (a, b) => ORDEM.indexOf(a) >= 0 && ORDEM.indexOf(a) >= ORDEM.indexOf(b);
export const deskTxt = (o, lang) => (o && typeof o === "object" ? o[lang] || o.en || "" : o || "");
