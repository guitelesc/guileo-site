import { NOME_DO_PAINEL } from "../portal/nome.js";
// Launch Kit — ready-to-use field assets for Guileo sellers, surfaced inside the "Alvos do dia"
// tab of /vendedor. Everything here is COPY-ready (the UI puts a 📋 button on each block):
//   • video   — a scene-by-scene sales-video script (the Natura demo: call → Gui answers → books →
//               portal → ROI, 60-90s), with the exact lines to say. pt/en/es; hi falls back to en.
//   • emails  — 5 cold-prospecting emails (restaurant, salon, clinic, home services, real estate),
//               subject + body, in EN and PT, with {nome}/{negocio} placeholders.
//   • dms     — 6 short DM openers for Instagram/WhatsApp (3 EN + 3 PT).
// Strategy stays locked: sell the GAIN, open on the owner's pain, never aggressive, no fake metrics.

export const KIT_VIDEO = {
  pt: [
    { t: "0:00–0:08", scene: "Abertura — tela preta, telefone tocando", vo: "Todo dia, negócios como o seu perdem clientes por uma coisa simples: ninguém atende." },
    { t: "0:08–0:20", scene: "Celular do salão Natura tocando fora do horário; ninguém por perto", vo: "São 20h. A Natura Spa já fechou. Mas o telefone toca — uma cliente quer marcar." },
    { t: "0:20–0:35", scene: "A Gui atende (áudio real da ligação); legenda com a fala", vo: "A Gui atende na hora, com a voz e o nome do salão: “Natura Spa, boa noite! Quer marcar sua limpeza de pele?”" },
    { t: "0:35–0:48", scene: "Tela do portal: o agendamento aparecendo sozinho", vo: "Ela confirma o horário, manda o lembrete e o agendamento cai direto no painel — sem ninguém digitar nada." },
    { t: "0:48–1:05", scene: `${NOME_DO_PAINEL} da Natura: receita recuperada, no-shows evitados`, vo: "No fim do mês, o dono vê o que voltou: agendamentos que teriam se perdido, no-shows evitados, clientes reativados." },
    { t: "1:05–1:20", scene: "Logo Guileo + selo 30 dias", vo: "No ar em 7 dias, com garantia de 30. A Guileo instala um time de IA que atende, vende e faz crescer — 24/7. Quer ver a Gui te ligando agora?" },
  ],
  en: [
    { t: "0:00–0:08", scene: "Open — black screen, a phone ringing", vo: "Every day, businesses like yours lose customers over one simple thing: nobody answers." },
    { t: "0:08–0:20", scene: "Natura salon phone ringing after hours; no one around", vo: "It's 8pm. Natura Spa is closed. But the phone rings — a client wants to book." },
    { t: "0:20–0:35", scene: "Gui answers (real call audio); caption with the line", vo: "Gui answers instantly, in the salon's own voice and name: “Natura Spa, good evening! Want to book your facial?”" },
    { t: "0:35–0:48", scene: "Portal screen: the booking appearing on its own", vo: "She confirms the time, sends the reminder, and the booking lands right in the dashboard — nobody typed a thing." },
    { t: "0:48–1:05", scene: `Natura ${NOME_DO_PAINEL}: revenue recovered, no-shows avoided`, vo: "At month's end, the owner sees what came back: bookings that would've been lost, no-shows avoided, customers reactivated." },
    { t: "1:05–1:20", scene: "Guileo logo + 30-day badge", vo: "Live in 7 days, 30-day guarantee. Guileo installs an AI team that answers, sells and grows — 24/7. Want to see Gui call you right now?" },
  ],
  es: [
    { t: "0:00–0:08", scene: "Apertura — pantalla negra, un teléfono sonando", vo: "Cada día, negocios como el tuyo pierden clientes por algo simple: nadie contesta." },
    { t: "0:08–0:20", scene: "Teléfono del salón Natura sonando fuera de horario; nadie cerca", vo: "Son las 20h. Natura Spa ya cerró. Pero el teléfono suena — una clienta quiere reservar." },
    { t: "0:20–0:35", scene: "Gui contesta (audio real de la llamada); subtítulo con la frase", vo: "Gui contesta al instante, con la voz y el nombre del salón: “Natura Spa, ¡buenas noches! ¿Quieres reservar tu limpieza facial?”" },
    { t: "0:35–0:48", scene: "Pantalla del portal: la reserva apareciendo sola", vo: "Confirma la hora, manda el recordatorio y la reserva cae directo en el panel — nadie escribió nada." },
    { t: "0:48–1:05", scene: `${NOME_DO_PAINEL} de Natura: ingresos recuperados, no-shows evitados`, vo: "A fin de mes, el dueño ve lo que volvió: reservas que se habrían perdido, no-shows evitados, clientes reactivados." },
    { t: "1:05–1:20", scene: "Logo Guileo + sello 30 días", vo: "En vivo en 7 días, garantía de 30. Guileo instala un equipo de IA que atiende, vende y hace crecer — 24/7. ¿Quieres ver a Gui llamándote ahora?" },
  ],
};

// 5 cold emails. Each has EN + PT. {nome} = owner's first name, {negocio} = business name.
export const KIT_EMAILS = [
  {
    id: "restaurant", niche: "Restaurant", icon: "🍽️",
    pt: { subject: "Uma pergunta rápida sobre as ligações do {negocio}", body: `Oi {nome}, tudo bem?\n\nReparei que o {negocio} tem bastante movimento — e é justamente aí que costuma escapar dinheiro: ligação na correria do almoço, pedido no WhatsApp à noite, cliente que some.\n\nA gente instala uma IA que atende todas as ligações e mensagens 24/7, com a voz do seu restaurante, e já anota o pedido ou a reserva. No ar em ~7 dias, com 30 dias de garantia.\n\nPosso te mostrar em 15 min — ou melhor: quer que ela te ligue agora pra você ouvir?\n\nAbraço,\n{seller}` },
    en: { subject: "Quick question about {negocio}'s calls", body: `Hi {nome},\n\nI noticed {negocio} keeps busy — and that's exactly where money slips: a call during the lunch rush, a WhatsApp order at night, a customer who ghosts.\n\nWe install an AI that answers every call and message 24/7, in your restaurant's own voice, and takes the order or reservation right there. Live in ~7 days, 30-day guarantee.\n\nCan I show you in 15 min — or better: want it to call you now so you can hear it?\n\nBest,\n{seller}` },
  },
  {
    id: "salon", niche: "Salon & Spa", icon: "💈",
    pt: { subject: "{negocio}: quantos agendamentos escapam por semana?", body: `Oi {nome}, tudo certo?\n\nEm salão e spa, o que mais dói é a agenda com buraco e o telefone tocando enquanto você está atendendo. Cada ligação perdida é um horário vazio.\n\nA Guileo coloca uma IA que atende, agenda e manda os lembretes sozinha — reduz no-show e ainda reativa cliente antigo. Fica no ar em ~7 dias.\n\nTe mostro numa call rápida, ou peço pra ela te ligar agora. O que prefere?\n\nAbraço,\n{seller}` },
    en: { subject: "{negocio}: how many bookings slip each week?", body: `Hi {nome},\n\nIn salons and spas, the real pain is a gap in the calendar and the phone ringing while you're with a client. Every missed call is an empty slot.\n\nGuileo installs an AI that answers, books and sends reminders on its own — cutting no-shows and even reactivating past clients. Live in ~7 days.\n\nI can show you on a quick call, or have it ring you now. Which do you prefer?\n\nBest,\n{seller}` },
  },
  {
    id: "clinic", niche: "Clinic", icon: "🦷",
    pt: { subject: "Recados que a recepção do {negocio} não alcança", body: `Oi {nome}, tudo bem?\n\nNa clínica, muita gente liga fora do horário ou quando a recepção está ocupada — e não deixa recado. Esse paciente marca em outro lugar.\n\nA gente instala uma IA que atende 24/7, agenda a consulta, confirma e manda os recalls automáticos. Menos falta, mais cadeira ocupada. No ar em ~7 dias, com garantia de 30.\n\nPosso te mostrar rapidinho — ou ela te liga agora pra você sentir na prática?\n\nAbraço,\n{seller}` },
    en: { subject: "The calls {negocio}'s front desk can't catch", body: `Hi {nome},\n\nAt a clinic, plenty of people call after hours or when the front desk is busy — and leave no message. That patient books elsewhere.\n\nWe install an AI that answers 24/7, books the appointment, confirms it and sends automatic recalls. Fewer no-shows, more chairs filled. Live in ~7 days, 30-day guarantee.\n\nCan I show you quickly — or have it call you now so you feel it firsthand?\n\nBest,\n{seller}` },
  },
  {
    id: "homeservices", niche: "Plumbing & HVAC", icon: "🔧",
    pt: { subject: "Chamado de emergência às 2h — quem atende no {negocio}?", body: `Oi {nome}, beleza?\n\nEm serviço de campo, o trabalho grande costuma chegar na pior hora: vazamento de madrugada, ar parado no fim de semana. Se ninguém atende, o cliente liga pro próximo da lista.\n\nA Guileo instala uma IA que atende toda ligação, qualifica a emergência e já agenda a visita — 24/7, com a voz da sua empresa. No ar em ~7 dias.\n\nTe mostro em 15 min, ou peço pra ela te ligar agora. Qual funciona?\n\nAbraço,\n{seller}` },
    en: { subject: "A 2am emergency call — who answers for {negocio}?", body: `Hi {nome},\n\nIn field service, the big jobs come at the worst hour: a leak at midnight, no heat on the weekend. If nobody answers, the customer calls the next name on the list.\n\nGuileo installs an AI that answers every call, qualifies the emergency and books the visit — 24/7, in your company's voice. Live in ~7 days.\n\nI can show you in 15 min, or have it call you now. Which works?\n\nBest,\n{seller}` },
  },
  {
    id: "realestate", niche: "Real Estate", icon: "🏠",
    pt: { subject: "Lead do {negocio} que responde em 1 minuto fecha mais", body: `Oi {nome}, tudo bem?\n\nEm imóveis, quem responde primeiro ganha a visita. Lead que chega e espera horas por retorno já está falando com outro corretor.\n\nA gente instala uma IA que responde em ~60 segundos, qualifica orçamento e prazo, e já agenda a visita — por ligação, WhatsApp ou formulário, 24/7. No ar em ~7 dias.\n\nPosso te mostrar numa call rápida, ou ela te liga agora pra você ver o tempo de resposta. O que prefere?\n\nAbraço,\n{seller}` },
    en: { subject: "A {negocio} lead answered in 1 minute closes more", body: `Hi {nome},\n\nIn real estate, whoever replies first wins the showing. A lead that waits hours for a callback is already talking to another agent.\n\nWe install an AI that replies in ~60 seconds, qualifies budget and timeline, and books the viewing — by call, WhatsApp or form, 24/7. Live in ~7 days.\n\nI can show you on a quick call, or have it ring you now so you see the response time. Which do you prefer?\n\nBest,\n{seller}` },
  },
];

// 6 short DM openers — 3 EN + 3 PT. Keep them 2-3 lines, warm, pain-first, non-aggressive.
export const KIT_DMS = [
  { id: "dm-pt-1", channel: "Instagram", lang: "pt", text: "Oi! Vi o perfil de vocês 👏 Uma dúvida rápida: quando o telefone toca e ninguém pode atender, o que acontece com esse cliente? A gente resolve isso com uma IA que atende 24/7 na voz do seu negócio. Posso te mostrar?" },
  { id: "dm-pt-2", channel: "WhatsApp", lang: "pt", text: "Oi {nome}! Aqui é o {seller}, da Guileo. Trabalho ajudando negócios como o {negocio} a não perder cliente por ligação ou mensagem sem resposta. Topa eu te mostrar em 2 min — ou prefere que a nossa IA te ligue pra você ouvir?" },
  { id: "dm-pt-3", channel: "Instagram", lang: "pt", text: "Oi! Pergunta sincera: quantos agendamentos vocês acham que escapam por semana por causa de mensagem que demora a responder? Tenho uma forma de fechar esse buraco em ~7 dias. Posso mandar mais?" },
  { id: "dm-en-1", channel: "Instagram", lang: "en", text: "Hi! Love the page 👏 Quick question: when the phone rings and no one can pick up, what happens to that customer? We fix that with an AI that answers 24/7 in your business's own voice. Can I show you?" },
  { id: "dm-en-2", channel: "WhatsApp", lang: "en", text: "Hi {nome}! This is {seller} from Guileo. I help businesses like {negocio} stop losing customers to unanswered calls and messages. Mind if I show you in 2 min — or want our AI to call you so you can hear it?" },
  { id: "dm-en-3", channel: "Instagram", lang: "en", text: "Hey! Honest question: how many bookings do you think slip each week from slow replies? I've got a way to close that gap in ~7 days. Can I send you more?" },
];
