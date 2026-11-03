/* GUILEO DESK — o substituto do MindBody (2026-10-04 agenda · 2026-10-05 tudo).
   Uma tela com abas: Agenda (dia por profissional / semana) · Caixa · Clientes · Equipe · Fechamento
   · Importar. Contrato da rota em DESK-API.md; ajudantes comuns em ./deskApi.js.

   🚨 REGRAS DA CASA QUE ESTA TELA SEGUE
   · Conta conectada NUNCA mostra amostra: lendo = esqueleto, falhou = aviso com "tentar de novo".
   · Horário é SEMPRE o fuso da unidade (biz_locations.tz), nunca o do navegador.
   · Quem decide se um horário cabe é o banco (gatilho biz_appt_guard). A tela só pede; se o banco
     disser "ocupado", a tela diz "ocupado" e o cartão volta para onde estava.
   · "Confirmou / chegou / concluiu" é situação DO BALCÃO (attributes.desk_status): o motor continua
     vendo 'booked', e por isso continua mandando lembrete e pedido de avaliação.
   · Textos nos 4 idiomas da plataforma. Nada em inglês numa tela em português. */
import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense, Fragment } from "react";
import { toast } from "../lib/portalApi.js";
import { ehIos, jaInstalado, temPrompt, instalarAgora, aoMudarInstalacao } from "../lib/pwa.js";
import { NO_APP_NATIVO } from "../lib/nativeApp.js";
import { Card, Drawer, SectionSkeleton } from "../pages/Portal.jsx";
import { chamarDesk, motivo, nomePlano, assinarDesk, ehRecepcao, dinheiro, tx, lang, paraUtc, diaDe, minutoDe, somaDias, diaDaSemana, hhmm, loc as localeAtual } from "./deskApi.js";

const DeskCaixa = lazy(() => import("./DeskCaixa.jsx"));
const DeskClientes = lazy(() => import("./DeskClientes.jsx"));
const DeskEquipe = lazy(() => import("./DeskEquipe.jsx"));
const DeskFechamento = lazy(() => import("./DeskFechamento.jsx"));
const DeskImportar = lazy(() => import("./DeskImportar.jsx"));
const DeskRelatorios = lazy(() => import("./DeskRelatorios.jsx"));
// Sem lazy: aparece também fora do Suspense (aba travada e conta cancelada) e é pequeno.
import DeskExportar from "./DeskExportar.jsx";

// ── textos ───────────────────────────────────────────────────────────────────────────────────
const T = {
  doFee: { en: "Charge fee", pt: "Cobrar taxa", es: "Cobrar cargo", hi: "शुल्क लें" },
  planChip: { en: "{p} plan", pt: "Plano {p}", es: "Plan {p}", hi: "{p} प्लान" },
  planChange: { en: "Change plan", pt: "Mudar de plano", es: "Cambiar de plan", hi: "प्लान बदलें" },
  lockedH: { en: "Part of the {p} plan", pt: "Faz parte do plano {p}", es: "Parte del plan {p}", hi: "{p} प्लान का हिस्सा" },
  lockedP: { en: "Upgrade and this tab opens right away — your data is already here.", pt: "Assine e esta aba abre na hora — os seus dados já estão aqui.", es: "Suscríbete y esta pestaña se abre al instante — tus datos ya están aquí.", hi: "अपग्रेड करें और यह टैब तुरंत खुल जाएगा।" },
  subscribe: { en: "Subscribe to {p}", pt: "Assinar o {p}", es: "Suscribirme al {p}", hi: "{p} लें" },
  canceledH: { en: "Your Desk subscription is canceled", pt: "A assinatura do Desk foi cancelada", es: "La suscripción del Desk fue cancelada", hi: "Desk सदस्यता रद्द है" },
  canceledP: { en: "You can still see the calendar. Reactivate to book, charge and use the AI again.", pt: "A agenda continua visível. Reative para marcar, cobrar e usar a IA de novo.", es: "Aún puedes ver la agenda. Reactiva para agendar, cobrar y usar la IA.", hi: "कैलेंडर दिखता रहेगा। फिर से सक्रिय करें।" },
  reactivate: { en: "Reactivate", pt: "Reativar", es: "Reactivar", hi: "फिर से सक्रिय करें" },
  install: { en: "Install the Desk app", pt: "Instalar o app", es: "Instalar la app", hi: "ऐप इंस्टॉल करें" },
  installIos: { en: "On iPad/iPhone: tap Share ⬆︎ in Safari, then \"Add to Home Screen\".", pt: "No iPad/iPhone: no Safari, toque em Compartilhar ⬆︎ e depois em \"Adicionar à Tela de Início\".", es: "En iPad/iPhone: en Safari toca Compartir ⬆︎ y luego \"Agregar a inicio\".", hi: "iPad/iPhone: Safari में Share ⬆︎ → Add to Home Screen" },
  installOther: { en: "In your browser menu, choose \"Install app\" or \"Add to Home screen\".", pt: "No menu do navegador, escolha \"Instalar app\" ou \"Adicionar à tela inicial\".", es: "En el menú del navegador, elige \"Instalar app\" o \"Agregar a inicio\".", hi: "ब्राउज़र मेनू में Install app चुनें।" },
  installed: { en: "Desk app installed ✓", pt: "App do Desk instalado ✓", es: "App del Desk instalada ✓", hi: "ऐप इंस्टॉल ✓" },
  tabRelatorios: { en: "Reports", pt: "Relatórios", es: "Informes", hi: "रिपोर्ट" },
  // repetir
  repeat: { en: "Repeat", pt: "Repetir", es: "Repetir", hi: "दोहराएँ" },
  repeatNo: { en: "Just once", pt: "Só uma vez", es: "Solo una vez", hi: "सिर्फ़ एक बार" },
  everyW: { en: "Every {n} week(s)", pt: "A cada {n} semana(s)", es: "Cada {n} semana(s)", hi: "हर {n} हफ़्ते" },
  times: { en: "times", pt: "vezes", es: "veces", hi: "बार" },
  seriesOk: { en: "{a} of {b} booked", pt: "{a} de {b} marcados", es: "{a} de {b} reservadas", hi: "{b} में से {a} बुक" },
  seriesFail: { en: "Couldn't book:", pt: "Não deu para marcar:", es: "No se pudo reservar:", hi: "बुक नहीं हो सका:" },
  // mover (toque)
  doMove: { en: "Move", pt: "Mover", es: "Mover", hi: "स्थानांतरित करें" },
  moveTitle: { en: "Move to", pt: "Mover para", es: "Mover a", hi: "यहाँ ले जाएँ" },
  // falta da profissional
  absence: { en: "Someone's out", pt: "Alguém faltou", es: "Alguien faltó", hi: "कोई अनुपस्थित है" },
  absenceSub: { en: "Her clients for the day, and who can take each one at the same time.", pt: "As clientes dela no dia e quem pode atender cada uma no mesmo horário.", es: "Sus clientas del día y quién puede atender a cada una a la misma hora.", hi: "उस दिन के ग्राहक और कौन उसी समय ले सकता है।" },
  absenceNone: { en: "No clients left for her on this day.", pt: "Ela não tem mais clientes neste dia.", es: "No le quedan clientas este día.", hi: "इस दिन कोई ग्राहक नहीं।" },
  noCover: { en: "Nobody free at this time", pt: "Ninguém livre neste horário", es: "Nadie libre a esta hora", hi: "इस समय कोई खाली नहीं" },
  passTo: { en: "Give to {n} and tell her", pt: "Passar para {n} e avisar", es: "Pasar a {n} y avisar", hi: "{n} को दें और बताएँ" },
  askResched: { en: "Ask her to pick a new time", pt: "Pedir para remarcar", es: "Pedir que cambie la hora", hi: "नया समय चुनने को कहें" },
  told: { en: "Told by email ✓", pt: "Avisada por e-mail ✓", es: "Avisada por correo ✓", hi: "ईमेल से बताया ✓" },
  callHer: { en: "No email — call", pt: "Sem e-mail — ligue", es: "Sin correo — llama", hi: "ईमेल नहीं — कॉल करें" },
  notTold: { en: "Not sent — call", pt: "Não enviado — ligue", es: "No enviado — llama", hi: "नहीं भेजा — कॉल करें" },
  blockHerDay: { en: "Block her whole day", pt: "Bloquear o dia dela", es: "Bloquear su día", hi: "उसका पूरा दिन ब्लॉक करें" },
  blockHerDayHelp: { en: "Do this after her clients are handled — the engine won't block over bookings.", pt: "Faça depois de resolver as clientes — o sistema não bloqueia por cima de agendamento.", es: "Hazlo después de resolver a las clientas.", hi: "ग्राहकों को संभालने के बाद करें।" },
  tabAgenda: { en: "Agenda", pt: "Agenda", es: "Agenda", hi: "एजेंडा" },
  tabCaixa: { en: "Checkout", pt: "Caixa", es: "Caja", hi: "चेकआउट" },
  tabClientes: { en: "Clients", pt: "Clientes", es: "Clientas", hi: "ग्राहक" },
  tabEquipe: { en: "Team & services", pt: "Equipe e serviços", es: "Equipo y servicios", hi: "टीम और सेवाएँ" },
  tabFechamento: { en: "Day close", pt: "Fechamento", es: "Cierre", hi: "दिन का हिसाब" },
  tabImportar: { en: "Import & export", pt: "Importar e exportar", es: "Importar y exportar", hi: "इम्पोर्ट और एक्सपोर्ट" },
  sub: { en: "Your day, by professional. Drag to reschedule, click an empty slot to book.", pt: "O seu dia, por profissional. Arraste para remarcar, clique num horário vazio para marcar.", es: "Tu día, por profesional. Arrastra para reprogramar, haz clic en un hueco libre para reservar.", hi: "आपका दिन, हर प्रोफ़ेशनल के हिसाब से।" },
  day: { en: "Day", pt: "Dia", es: "Día", hi: "दिन" },
  week: { en: "Week", pt: "Semana", es: "Semana", hi: "सप्ताह" },
  today: { en: "Today", pt: "Hoje", es: "Hoy", hi: "आज" },
  prev: { en: "Previous", pt: "Anterior", es: "Anterior", hi: "पिछला" },
  next: { en: "Next", pt: "Próximo", es: "Siguiente", hi: "अगला" },
  search: { en: "Find a client on this day…", pt: "Procurar cliente neste dia…", es: "Buscar cliente en este día…", hi: "इस दिन ग्राहक खोजें…" },
  booked: { en: "Booked", pt: "Agendados", es: "Reservadas", hi: "बुक" },
  confirmed: { en: "Confirmed", pt: "Confirmados", es: "Confirmadas", hi: "पुष्टि" },
  arrived: { en: "Arrived", pt: "Chegaram", es: "Llegaron", hi: "पहुँचे" },
  completed: { en: "Done", pt: "Concluídos", es: "Terminadas", hi: "पूरा" },
  noshow: { en: "No-shows", pt: "Faltas", es: "Ausencias", hi: "नहीं आए" },
  expected: { en: "Expected revenue", pt: "Receita prevista", es: "Ingreso previsto", hi: "अपेक्षित आय" },
  closedDay: { en: "Closed this day", pt: "Fechado neste dia", es: "Cerrado este día", hi: "इस दिन बंद" },
  off: { en: "Off", pt: "Folga", es: "Libre", hi: "छुट्टी" },
  rooms: { en: "Rooms", pt: "Salas", es: "Salas", hi: "कमरे" },
  // SALAS E EQUIPAMENTOS que o serviço exige (desk_v5_1): a sala vem do motor, a tela só mostra
  room: { en: "Room / equipment", pt: "Sala / equipamento", es: "Sala / equipo", hi: "कमरा / उपकरण" },
  resourceBusy: { en: "No room or equipment free for this service at that time — pick another time.", pt: "Nenhuma sala ou equipamento livre para esse serviço nesse horário — escolha outro horário.", es: "No hay sala ni equipo libre para ese servicio en ese horario — elige otro horario.", hi: "उस समय इस सेवा के लिए कोई कमरा या उपकरण खाली नहीं — दूसरा समय चुनें।" },
  usesRoom: { en: "Uses", pt: "Usa", es: "Usa", hi: "इस्तेमाल करता है" },
  usesRoomHint: { en: "the first one free at that time is reserved automatically", pt: "a primeira livre no horário é reservada sozinha", es: "la primera libre en ese horario se reserva sola", hi: "उस समय पहला खाली अपने-आप रिज़र्व होता है" },
  noPros: { en: "No professionals at this location yet. Add your team in Team & services.", pt: "Ainda não há profissionais nesta unidade. Cadastre a equipe em Equipe e serviços.", es: "Aún no hay profesionales en esta sede. Agrega tu equipo en Equipo y servicios.", hi: "इस लोकेशन पर अभी कोई प्रोफ़ेशनल नहीं है।" },
  readFail: { en: "I couldn't read your agenda.", pt: "Não consegui ler a sua agenda.", es: "No pude leer tu agenda.", hi: "आपका एजेंडा नहीं पढ़ पाया।" },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Intentar de nuevo", hi: "फिर कोशिश करें" },
  liveNew: { en: "New booking", pt: "Reserva nova", es: "Reserva nueva", hi: "नई बुकिंग" },
  liveCancel: { en: "Cancelled", pt: "Cancelou", es: "Canceló", hi: "रद्द" },
  liveSrc: { en: "by the website or the AI", pt: "pelo site ou pela IA", es: "por el sitio o la IA", hi: "वेबसाइट या AI से" },
  liveTitle: { en: "While you were here", pt: "Enquanto você estava aqui", es: "Mientras estabas aquí", hi: "जब आप यहाँ थे" },
  liveSee: { en: "See", pt: "Ver", es: "Ver", hi: "देखें" },
  liveOk: { en: "Got it", pt: "Entendi", es: "Entendido", hi: "ठीक है" },
  liveOn: { en: "Live", pt: "Ao vivo", es: "En vivo", hi: "लाइव" },
  printDay: { en: "Print the day", pt: "Imprimir o dia", es: "Imprimir el día", hi: "दिन प्रिंट करें" },
  newBadge: { en: "NEW", pt: "NOVA", es: "NUEVA", hi: "नई" },
  sample: { en: "Sample agenda — connect your account to see your real day.", pt: "Agenda de exemplo — conecte a sua conta para ver o seu dia de verdade.", es: "Agenda de ejemplo — conecta tu cuenta para ver tu día real.", hi: "नमूना एजेंडा — अपना असली दिन देखने के लिए खाता जोड़ें।" },
  newBooking: { en: "New booking", pt: "Novo agendamento", es: "Nueva reserva", hi: "नई बुकिंग" },
  newSale: { en: "New sale", pt: "Nova venda", es: "Nueva venta", hi: "नई बिक्री" },
  blockTime: { en: "Block time", pt: "Bloquear horário", es: "Bloquear horario", hi: "समय ब्लॉक करें" },
  service: { en: "Service", pt: "Serviço", es: "Servicio", hi: "सेवा" },
  client: { en: "Client name", pt: "Nome da cliente", es: "Nombre de la clienta", hi: "ग्राहक का नाम" },
  phone: { en: "Phone or email", pt: "Telefone ou e-mail", es: "Teléfono o correo", hi: "फ़ोन या ईमेल" },
  time: { en: "Time", pt: "Horário", es: "Hora", hi: "समय" },
  from: { en: "From", pt: "De", es: "De", hi: "से" },
  to: { en: "To", pt: "Até", es: "Hasta", hi: "तक" },
  date: { en: "Date", pt: "Data", es: "Fecha", hi: "तारीख" },
  allDay: { en: "All day", pt: "Dia inteiro", es: "Todo el día", hi: "पूरा दिन" },
  reason: { en: "Reason", pt: "Motivo", es: "Motivo", hi: "कारण" },
  with: { en: "With", pt: "Com", es: "Con", hi: "के साथ" },
  note: { en: "Desk note", pt: "Nota do balcão", es: "Nota de recepción", hi: "डेस्क नोट" },
  notePh: { en: "Allergies, preferences, anything the team should know", pt: "Alergias, preferências, o que a equipe precisa saber", es: "Alergias, preferencias, lo que el equipo debe saber", hi: "एलर्जी, पसंद" },
  book: { en: "Book", pt: "Marcar", es: "Reservar", hi: "बुक करें" },
  block: { en: "Block", pt: "Bloquear", es: "Bloquear", hi: "ब्लॉक करें" },
  saveNote: { en: "Save note", pt: "Salvar nota", es: "Guardar nota", hi: "नोट सेव करें" },
  doConfirm: { en: "Confirm", pt: "Confirmar", es: "Confirmar", hi: "पुष्टि करें" },
  doArrive: { en: "Checked in", pt: "Chegou", es: "Llegó", hi: "पहुँच गए" },
  doCheckout: { en: "Check out", pt: "Fechar conta", es: "Cobrar", hi: "चेकआउट" },
  doNoShow: { en: "No-show", pt: "Faltou", es: "No vino", hi: "नहीं आए" },
  doCancel: { en: "Cancel booking", pt: "Cancelar", es: "Cancelar", hi: "रद्द करें" },
  doUnblock: { en: "Remove block", pt: "Remover bloqueio", es: "Quitar bloqueo", hi: "ब्लॉक हटाएँ" },
  doCard: { en: "Client card", pt: "Ficha da cliente", es: "Ficha de la clienta", hi: "ग्राहक कार्ड" },
  doDeposit: { en: "Deposit link", pt: "Link do sinal", es: "Enlace de depósito", hi: "डिपॉज़िट लिंक" },
  doDepositSend: { en: "Send to client", pt: "Mandar para a cliente", es: "Enviar a la clienta", hi: "ग्राहक को भेजें" },
  depositTexted: { en: "Deposit link texted to the client.", pt: "Link do sinal enviado por mensagem.", es: "Enlace enviado por mensaje.", hi: "लिंक मैसेज से भेजा गया।" },
  depositEmailed: { en: "Deposit link emailed to the client.", pt: "Link do sinal enviado por e-mail.", es: "Enlace enviado por correo.", hi: "लिंक ईमेल से भेजा गया।" },
  depositNotSent: { en: "Couldn't deliver it (text messages not enabled and no email). Copy the link and send it yourself.", pt: "Não consegui entregar (mensagem de texto não liberada e sem e-mail). Copie o link e mande você.", es: "No se pudo entregar (mensajes no habilitados y sin correo). Copia el enlace y envíalo tú.", hi: "भेज नहीं पाया — लिंक कॉपी करके खुद भेजें।" },
  depositCopied: { en: "Deposit link copied — send it to the client.", pt: "Link do sinal copiado — mande para a cliente.", es: "Enlace copiado — envíalo a la clienta.", hi: "लिंक कॉपी हुआ।" },
  depositPaid: { en: "Deposit paid", pt: "Sinal pago", es: "Depósito pagado", hi: "डिपॉज़िट चुकाया" },
  paid: { en: "Paid", pt: "Pago", es: "Pagado", hi: "भुगतान हुआ" },
  trusted: { en: "Trusted client", pt: "Cliente de confiança", es: "Clienta de confianza", hi: "भरोसेमंद ग्राहक" },
  cancelAsk: { en: "Cancel this booking? The slot opens for the waitlist.", pt: "Cancelar este agendamento? O horário volta a ficar livre para a fila de espera.", es: "¿Cancelar esta reserva? El horario queda libre.", hi: "यह बुकिंग रद्द करें?" },
  price: { en: "Price", pt: "Valor", es: "Precio", hi: "कीमत" },
  bookedBy: { en: "Booked by", pt: "Marcado por", es: "Reservado por", hi: "किसने बुक किया" },
  moved: { en: "Rescheduled", pt: "Remarcado", es: "Reprogramado", hi: "समय बदला गया" },
  bookedOk: { en: "Booked", pt: "Marcado", es: "Reservado", hi: "बुक हो गया" },
  blockedOk: { en: "Time blocked", pt: "Horário bloqueado", es: "Horario bloqueado", hi: "समय ब्लॉक हुआ" },
  saved: { en: "Saved", pt: "Salvo", es: "Guardado", hi: "सेव हुआ" },
  needName: { en: "Write the client's name.", pt: "Escreva o nome da cliente.", es: "Escribe el nombre de la clienta.", hi: "ग्राहक का नाम लिखें।" },
  // CASAL / GRUPO (2026-10-21, desk_v9)
  addPerson: { en: "+ Add a person", pt: "+ Adicionar pessoa", es: "+ Agregar persona", hi: "+ व्यक्ति जोड़ें" },
  addPersonHint: { en: "Couples, friends, mother and daughter: everyone is booked together, or no one is.", pt: "Casal, amigas, mãe e filha: todo mundo fica marcado junto, ou ninguém fica.", es: "Pareja, amigas, madre e hija: todas quedan reservadas juntas, o ninguna.", hi: "जोड़े, दोस्त, माँ-बेटी: सब एक साथ बुक होते हैं, या कोई नहीं।" },
  personN: { en: "Person {n}", pt: "Pessoa {n}", es: "Persona {n}", hi: "व्यक्ति {n}" },
  removePerson: { en: "Remove person {n}", pt: "Tirar a pessoa {n}", es: "Quitar a la persona {n}", hi: "व्यक्ति {n} हटाएँ" },
  personName: { en: "Name", pt: "Nome", es: "Nombre", hi: "नाम" },
  sameContact: { en: "Same phone or email as person 1", pt: "Mesmo telefone ou e-mail da pessoa 1", es: "Mismo teléfono o correo que la persona 1", hi: "व्यक्ति 1 वाला फ़ोन या ईमेल" },
  sideBySide: { en: "Same time as person 1: side by side.", pt: "Mesmo horário da pessoa 1: lado a lado.", es: "Misma hora que la persona 1: lado a lado.", hi: "व्यक्ति 1 के समय पर: साथ-साथ।" },
  proBusyOpt: { en: "busy at this time", pt: "ocupada nesse horário", es: "ocupada a esa hora", hi: "इस समय व्यस्त" },
  bookN: { en: "Book all {n}", pt: "Marcar as {n}", es: "Reservar las {n}", hi: "सभी {n} बुक करें" },
  groupNoRepeat: { en: "Repeating bookings work one person at a time.", pt: "Agendamento que repete é para uma pessoa por vez.", es: "La reserva que se repite es para una persona a la vez.", hi: "दोहराने वाली बुकिंग एक व्यक्ति के लिए होती है।" },
  coupleOk: { en: "Couple booked: 2 appointments", pt: "Casal marcado: 2 horários", es: "Pareja reservada: 2 citas", hi: "जोड़ा बुक हुआ: 2 बुकिंग" },
  groupOk: { en: "Group booked: {n} appointments", pt: "Grupo marcado: {n} horários", es: "Grupo reservado: {n} citas", hi: "ग्रुप बुक हुआ: {n} बुकिंग" },
  groupFail: { en: "Nothing was booked.", pt: "Nada foi marcado.", es: "No se reservó nada.", hi: "कुछ भी बुक नहीं हुआ।" },
  groupFailWho: { en: "Person {n} ({nome}): {m} Change it and book again.", pt: "Pessoa {n} ({nome}): {m} Ajuste e marque de novo.", es: "Persona {n} ({nome}): {m} Ajústalo y reserva de nuevo.", hi: "व्यक्ति {n} ({nome}): {m} बदलें और फिर बुक करें।" },
  proBusy: { en: "{p} already has a client at that time.", pt: "{p} já tem cliente nesse horário.", es: "{p} ya tiene una clienta a esa hora.", hi: "{p} के पास उस समय पहले से ग्राहक है।" },
  couple: { en: "Couple", pt: "Casal", es: "Pareja", hi: "जोड़ा" },
  group: { en: "Group", pt: "Grupo", es: "Grupo", hi: "ग्रुप" },
  groupOf: { en: "{r}, {i} of {n}", pt: "{r}, {i} de {n}", es: "{r}, {i} de {n}", hi: "{r}, {n} में से {i}" },
  together: { en: "Booked together with", pt: "Marcado junto com", es: "Reservado junto con", hi: "इनके साथ बुक" },
  cancelAll: { en: "Cancel all {n}", pt: "Cancelar os {n}", es: "Cancelar las {n}", hi: "सभी {n} रद्द करें" },
  cancelAllAsk: { en: "Cancel all {n} bookings of this {r}? The times open for the waitlist.", pt: "Cancelar os {n} agendamentos deste {r}? Os horários voltam a ficar livres para a fila de espera.", es: "¿Cancelar las {n} reservas de este {r}? Los horarios quedan libres para la lista de espera.", hi: "इस {r} की सभी {n} बुकिंग रद्द करें? समय वेटलिस्ट के लिए खुल जाएगा।" },
  cancelOnly: { en: "Cancel only this one", pt: "Cancelar só este", es: "Cancelar solo esta", hi: "सिर्फ़ यह रद्द करें" },
  cancelledAll: { en: "{n} bookings cancelled", pt: "{n} agendamentos cancelados", es: "{n} reservas canceladas", hi: "{n} बुकिंग रद्द" },
  cancelledSome: { en: "Cancelled {a} of {b}. Check the one still open.", pt: "Cancelei {a} de {b}. Confira o que ficou aberto.", es: "Cancelé {a} de {b}. Revisa la que quedó abierta.", hi: "{b} में से {a} रद्द हुईं। जो खुली रह गई उसे देखें।" },
  min: { en: "min", pt: "min", es: "min", hi: "मिनट" },
  // profissional × serviço (desk_v10)
  prepFinish: { en: "Prep / cleanup", pt: "Preparo / limpeza", es: "Preparación / limpieza", hi: "तैयारी / सफ़ाई" },
  // adicionais (desk_v11)
  addons: { en: "Add-ons", pt: "Adicionais", es: "Adicionales", hi: "ऐड-ऑन" },
  addonsHint: { en: "Extras sold with this service. Minutes are added to the booking.", pt: "Extras vendidos junto com o serviço. Os minutos entram no agendamento.", es: "Extras vendidos con el servicio. Los minutos se suman a la reserva.", hi: "इस सेवा के साथ बिकने वाले एक्स्ट्रा। मिनट बुकिंग में जुड़ते हैं।" },
  addonsNone: { en: "None", pt: "Nenhum", es: "Ninguno", hi: "कोई नहीं" },
  addonsEdit: { en: "Change add-ons", pt: "Mudar adicionais", es: "Cambiar adicionales", hi: "ऐड-ऑन बदलें" },
  addonsSave: { en: "Save add-ons", pt: "Salvar adicionais", es: "Guardar adicionales", hi: "ऐड-ऑन सेव करें" },
  addonsSaved: { en: "Add-ons updated", pt: "Adicionais atualizados", es: "Adicionales actualizados", hi: "ऐड-ऑन अपडेट हुए" },
  addonsNoFit: { en: "They don't fit: the extra minutes run into the next booking. Move it or pick fewer add-ons.", pt: "Não coube: os minutos a mais batem no próximo agendamento. Mova ou escolha menos adicionais.", es: "No cabe: los minutos extra chocan con la siguiente reserva. Muévela o elige menos adicionales.", hi: "नहीं समाया: अतिरिक्त मिनट अगली बुकिंग से टकराते हैं। उसे हटाएँ या कम ऐड-ऑन चुनें।" },
  totalTime: { en: "Total", pt: "Total", es: "Total", hi: "कुल" },
  prepLabel: { en: "Prep", pt: "Preparo", es: "Preparación", hi: "तैयारी" },
  finishLabel: { en: "Cleanup", pt: "Limpeza", es: "Limpieza", hi: "सफ़ाई" },
  cancelled: { en: "cancelled", pt: "cancelados", es: "canceladas", hi: "रद्द" },
  conflicts: { en: "Already booked in that window:", pt: "Já há agendamento nesse intervalo:", es: "Ya hay reservas en ese horario:", hi: "उस समय पहले से बुकिंग है:" },
  pickPro: { en: "Professional", pt: "Profissional", es: "Profesional", hi: "प्रोफ़ेशनल" },
  r_off: { en: "Day off", pt: "Folga", es: "Día libre", hi: "छुट्टी" },
  r_lunch: { en: "Lunch", pt: "Almoço", es: "Almuerzo", hi: "लंच" },
  r_training: { en: "Training", pt: "Treinamento", es: "Capacitación", hi: "ट्रेनिंग" },
  r_vac: { en: "Vacation", pt: "Férias", es: "Vacaciones", hi: "छुट्टियाँ" },
  st_booked: { en: "Booked", pt: "Agendado", es: "Reservado", hi: "बुक" },
  st_confirmed: { en: "Confirmed", pt: "Confirmado", es: "Confirmado", hi: "पुष्टि" },
  st_in_progress: { en: "Checked in", pt: "Chegou", es: "Llegó", hi: "पहुँचे" },
  st_completed: { en: "Completed", pt: "Concluído", es: "Terminado", hi: "पूरा" },
  st_no_show: { en: "No-show", pt: "Faltou", es: "No vino", hi: "नहीं आए" },
  st_cancelled: { en: "Cancelled", pt: "Cancelado", es: "Cancelado", hi: "रद्द" },
  // falta automática e cancelou em cima da hora (desk_v12)
  st_late_cancelled: { en: "Cancelled late", pt: "Cancelou em cima da hora", es: "Canceló a última hora", hi: "देर से रद्द" },
  lateCancelled: { en: "cancelled late", pt: "em cima da hora", es: "a última hora", hi: "देर से" },
  autoNoShow: { en: "Marked as no-show automatically at {h}: nobody checked her in. If she's here, tap “She arrived after all”.", pt: "Marcado como falta automaticamente às {h}: ninguém registrou a chegada. Se ela está aí, toque em “Chegou afinal”.", es: "Marcada como inasistencia automáticamente a las {h}: nadie registró la llegada. Si está aquí, toca “Llegó al final”.", hi: "{h} बजे अपने-आप नो-शो हुआ: किसी ने चेक-इन नहीं किया। अगर वह आ गई है, “आख़िर आ गई” दबाएँ।" },
  doArrivedAfterAll: { en: "She arrived after all", pt: "Chegou afinal", es: "Llegó al final", hi: "आख़िर आ गई" },
  arrivedAfterAll: { en: "Back on the agenda as checked in", pt: "De volta à agenda, como chegou", es: "De vuelta en la agenda, como llegó", hi: "एजेंडा में वापस, चेक-इन के रूप में" },
  undoNoFit: { en: "Can't bring it back: the slot was taken meanwhile. Book a new time.", pt: "Não dá para trazer de volta: o horário já foi ocupado. Marque um novo horário.", es: "No se puede recuperar: el horario ya fue ocupado. Reserva un nuevo horario.", hi: "वापस नहीं ला सकते: समय पहले ही भर गया। नया समय बुक करें।" },
  st_hold: { en: "On hold", pt: "Reservando", es: "En espera", hi: "होल्ड" },
  st_blocked: { en: "Blocked", pt: "Bloqueado", es: "Bloqueado", hi: "ब्लॉक" },
  src_desk: { en: "Front desk", pt: "Balcão", es: "Recepción", hi: "फ्रंट डेस्क" },
  src_gui: { en: "AI (phone/chat)", pt: "IA (telefone/chat)", es: "IA (teléfono/chat)", hi: "AI (फ़ोन/चैट)" },
  src_mindbody: { en: "MindBody (imported)", pt: "MindBody (importado)", es: "MindBody (importado)", hi: "MindBody (इम्पोर्ट)" },
};
const t = (k) => tx(T[k]) || k;
// t com variáveis: tv("bookN", { n: 2 }) → "Marcar as 2".
const tv = (k, v) => Object.entries(v).reduce((s, [a, b]) => s.split(`{${a}}`).join(String(b)), t(k));

// ── visual ───────────────────────────────────────────────────────────────────────────────────
const PX = 1.6;          // pixels por minuto (1h = 96px)
const PASSO = 15;        // grade de 15 minutos
const COR = { booked: "#3FB4FF", confirmed: "#2FE39A", in_progress: "#FFC23D", completed: "#8E8A80", no_show: "#FF5A5A", hold: "#C9A4FF", cancelled: "#5a564e", late_cancelled: "#E0894A", blocked: "#6b665c" };
const FINAL = new Set(["completed", "no_show", "cancelled", "late_cancelled"]);
const CANCELADO = (a) => a.status === "cancelled" || a.status === "late_cancelled";
const TZ0 = "America/New_York";

// ── amostra (só fora de conta conectada) ─────────────────────────────────────────────────────
export function amostra(dia) {
  const tz = TZ0;
  const loc = { id: "L1", name: "Astoria", tz };
  const pros = [["P1", "Ana", "Massage", "#7FB7A0"], ["P2", "Bianca", "Facials", "#D6C29A"], ["P3", "Carla", "Nails", "#C9A4FF"]].map(([id, name, title, color]) => ({ id, name, title, color, kind: "staff", locations: ["L1"], services: [], hours: [0, 1, 2, 3, 4, 5, 6].map((w) => ({ location_id: "L1", weekday: w, start_min: 540, end_min: 1140 })) }));
  // Sala de amostra exigida pela massagem (desk_v5_1): aparece em Equipe → Salas e equipamentos e no cartão "· Sala 1".
  pros.push({ id: "R1", name: "Sala 1", title: "", color: "#8E8A80", kind: "room", locations: ["L1"], services: [], hours: [] });
  const services = [["S1", "Deep Tissue 60min", 60, 14000], ["S2", "Signature Facial", 75, 16500], ["S3", "Gel Manicure", 45, 5500], ["S4", "Aromatherapy", 10, 2000], ["S5", "Hot stone upgrade", 0, 1500]]
    .map(([id, name, duration_min, price_cents]) => ({ id, name, duration_min, price_cents, ...(id === "S1" ? { recursos: ["R1"] } : {}), ...(id === "S4" || id === "S5" ? { addon: true } : {}),
      // desk_v13: o facial de 75 min debita 2 sessões de um pacote
      pkg_sessions: id === "S2" ? 2 : 1 }));
  const linha = (id, pro, svc, ini, nome, status, extra = {}) => { const s = services.find((x) => x.id === svc); const a = paraUtc(dia, ini, tz); return { id, pro_id: pro, service_id: svc, location_id: "L1", start: a.toISOString(), end: new Date(a.getTime() + (s?.duration_min || 60) * 60000).toISOString(), customer_name: nome, customer_contact: "", status, source: id === "A2" ? "gui" : "desk", ...extra }; };
  return { ok: true, locations: [loc], pros, services, closed: [],
    // desk_v10: a Ana tem 10 min de preparo e 15 de limpeza na massagem (faixa hachurada no cartão).
    pro_rules: [{ pro_id: "P1", service_id: "S1", duration_min: null, prep_min: 10, finish_min: 15, pay_type: "flat", pay_amount: 5000 }],
    appointments: [
    { ...linha("A1", "P1", "S1", 600, "Maria S.", "confirmed", { alert: "Lavender allergy", trusted: true, resource_id: "R1", resource: "Sala 1", addons: [{ service_id: "S4", name: "Aromatherapy", duration_min: 10, price_cents: 2000 }] }), end: paraUtc(dia, 670, tz).toISOString() },
    linha("A2", "P1", "S1", 720, "Jenny K.", "booked", { deposit_paid: true, resource_id: "R1", resource: "Sala 1" }),
    linha("A3", "P2", "S2", 630, "Olivia R.", "in_progress"), linha("A4", "P2", "S2", 840, "Sofia L.", "booked"),
    linha("A5", "P3", "S3", 570, "Emma W.", "completed", { sale_id: "x" }), linha("A6", "P3", "S3", 900, "Ava P.", "booked"),
    // desk_v12: falta marcada sozinha (ninguém registrou a chegada) e um cancelamento em cima da hora
    linha("A7", "P2", "S2", 540, "Lia P.", "no_show", { noshow_auto: true, noshow_auto_at: paraUtc(dia, 570, tz).toISOString() }),
    linha("A8", "P3", "S3", 660, "Noa R.", "late_cancelled"),
    { ...linha("B1", "P3", "S3", 780, "Lunch", "blocked"), end: paraUtc(dia, 840, tz).toISOString() },
  ] };
}

// O BALCÃO É UM APP (2026-10-05, Luis: «o Guileo Desk terá que ser app»). Enquanto o Balcão está aberto, a
// página aponta para o manifesto do Desk (public/desk.webmanifest: nome "Guileo Desk", ícone próprio, abre
// direto em ?tab=desk). Instalar daqui põe o "Guileo Desk" na tela do iPad/celular, separado do app da
// Central. Ao sair do Balcão, volta o manifesto da Central. App nativo (App Store/Play) é o próximo passo e
// depende das contas de desenvolvedor do Luis.
// Recepção (/balcao) instala um app PRÓPRIO que abre direto no balcão — o da dona abre a Central.
// AO VIVO (2026-10-05): sininho curto quando chega reserva nova ou alguém cancela. WebAudio, sem arquivo;
// o navegador só deixa tocar depois de um toque na tela — se não deixar, fica só o aviso visual.
let _somCtx = null;
function tocarSino() {
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = _somCtx || (_somCtx = new C()); const t0 = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.16); g.gain.exponentialRampToValueAtTime(0.12, t0 + i * 0.16 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.5);
      o.connect(g).connect(ctx.destination); o.start(t0 + i * 0.16); o.stop(t0 + i * 0.16 + 0.55);
    });
  } catch { /* sem som: o aviso na tela continua */ }
}

// IMPRIMIR O DIA (2026-10-05): folha simples por profissional (hora, cliente, serviço, alerta, nota) numa janela
// própria, para a parede da recepção ou a mesa da profissional. Texto escapado — nada do banco vira HTML.
function imprimirDia({ titulo, negocio, pros, appts, servico, tz }) {
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const blocos = pros.map((p) => {
    const dela = appts.filter((a) => a.pro_id === p.id && a.status !== "cancelled").sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    if (!dela.length) return "";
    const linhas = dela.map((a) => a.status === "blocked"
      ? `<tr class="b"><td>${hhmm(minutoDe(a.start, tz))}–${hhmm(minutoDe(a.end, tz))}</td><td colspan="3">— ${esc(a.note || "")}</td></tr>`
      : `<tr><td>${hhmm(minutoDe(a.start, tz))}–${hhmm(minutoDe(a.end, tz))}</td><td><b>${esc(a.customer_name)}</b>${a.alert ? `<div class="al">⚠ ${esc(a.alert)}</div>` : ""}</td><td>${esc(servico(a.service_id)?.name || "")}</td><td>${esc(a.note || "")}</td></tr>`).join("");
    return `<h2>${esc(p.name)}</h2><table>${linhas}</table>`;
  }).join("");
  const w = window.open("", "_blank", "width=820,height=900"); if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
    body{font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#161512;margin:28px}h1{font-size:20px;margin:0 0 2px}
    .n{color:#6F695D;margin-bottom:18px}h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #161512;padding-bottom:3px}
    table{width:100%;border-collapse:collapse}td{padding:6px 8px;border-bottom:1px solid #ddd;vertical-align:top}td:first-child{white-space:nowrap;width:110px;font-variant-numeric:tabular-nums}
    .b td{color:#888;font-style:italic}.al{color:#B42318;font-weight:700;font-size:12px}@media print{body{margin:12mm}}</style></head>
    <body><h1>${esc(titulo)}</h1><div class="n">${esc(negocio || "")}</div>${blocos || "<p>—</p>"}</body></html>`);
  w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch { /* a janela continua aberta para imprimir à mão */ } }, 250);
  return true;
}

function useAppDoDesk(recepcao = false) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const pega = (sel, criar) => document.head.querySelector(sel) || document.head.appendChild(criar());
    const man = pega('link[rel="manifest"]', () => Object.assign(document.createElement("link"), { rel: "manifest" }));
    const ati = pega('link[rel="apple-touch-icon"]', () => Object.assign(document.createElement("link"), { rel: "apple-touch-icon" }));
    const tit = pega('meta[name="apple-mobile-web-app-title"]', () => Object.assign(document.createElement("meta"), { name: "apple-mobile-web-app-title" }));
    const antes = { man: man.getAttribute("href"), ati: ati.getAttribute("href"), tit: tit.getAttribute("content") };
    man.setAttribute("href", recepcao ? "/balcao.webmanifest" : "/desk.webmanifest"); ati.setAttribute("href", "/desk-apple-touch.png"); tit.setAttribute("content", recepcao ? "Recepção" : "Guileo Desk");
    return () => {
      if (antes.man) man.setAttribute("href", antes.man);
      if (antes.ati) ati.setAttribute("href", antes.ati);
      if (antes.tit) tit.setAttribute("content", antes.tit);
    };
  }, [recepcao]);
}

function InstalarApp() {
  const [, setN] = useState(0);
  const [ajuda, setAjuda] = useState(false);
  useEffect(() => aoMudarInstalacao(() => setN((n) => n + 1)), []);
  if (jaInstalado() || NO_APP_NATIVO) return null;
  const clicar = async () => {
    if (temPrompt()) { const r = await instalarAgora(); if (r === "aceito") toast(t("installed")); return; }
    setAjuda((v) => !v);
  };
  return (
    <div className="relative">
      <button onClick={clicar} className="rounded-full border border-g-gold/40 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-gold">📲 {t("install")}</button>
      {ajuda && <div role="status" className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/15 bg-[#1a1916] p-3 text-xs text-g-light shadow-2xl">{t(ehIos() ? "installIos" : "installOther")}</div>}
    </div>
  );
}

// Plano mínimo de cada aba — o mesmo mapa do servidor (functions/lib/deskTrava.js), visto pela tela.
const ABA_MIN = { agenda: "basic", clientes: "basic", equipe: "basic", caixa: "medium", fechamento: "medium", importar: "medium", relatorios: "pro" };
const ORDEM_PLANOS = ["basic", "medium", "pro", "ultra", "custom"];
const planoInclui = (plano, min) => plano == null || (plano !== "nenhum" && ORDEM_PLANOS.indexOf(plano) >= ORDEM_PLANOS.indexOf(min));

function Bloqueado({ min, email, dataKey, cancelado = false }) {
  const [indo, setIndo] = useState(false);
  const vai = async () => { setIndo(true); const r = await assinarDesk(email, dataKey, cancelado ? "basic" : min); if (!r.ok) { setIndo(false); toast(r.erro || "Stripe"); } };
  return (
    <Card className="!p-6 text-center">
      <div className="text-3xl">🔒</div>
      <div className="mt-2 text-lg font-extrabold text-g-word">{cancelado ? t("canceledH") : t("lockedH").replace("{p}", nomePlano(min))}</div>
      <p className="mx-auto mt-1 max-w-md text-sm text-g-muted">{cancelado ? t("canceledP") : t("lockedP")}</p>
      {ehRecepcao(dataKey) ? <p className="mx-auto mt-3 max-w-md text-xs font-bold text-g-gold">{tx({ en: "Ask the owner to change the plan.", pt: "Peça à dona para mudar o plano.", es: "Pídele a la dueña que cambie el plan.", hi: "प्लान बदलने के लिए मालिक से कहें।" })}</p> : NO_APP_NATIVO ? <p className="mx-auto mt-3 max-w-md text-xs font-bold text-g-gold">{tx({ en: "Plans are managed at guileoai.com.", pt: "Os planos são administrados em guileoai.com.", es: "Los planes se administran en guileoai.com.", hi: "प्लान guileoai.com पर प्रबंधित होते हैं।" })}</p> : <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button disabled={indo} onClick={vai} className="rounded-full bg-g-green px-5 py-2.5 text-sm font-extrabold text-[#161512] disabled:opacity-50">{indo ? "…" : cancelado ? t("reactivate") : t("subscribe").replace("{p}", nomePlano(min))}</button>
        <a href="/desk#planos" target="_blank" rel="noopener" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-g-word">{t("planChange")}</a>
      </div>}
    </Card>
  );
}

export default function Desk({ real = null, email = "", dataKey = "" }) {
  const conectado = !!(real && email && dataKey);
  const recepcao = ehRecepcao(dataKey);
  useAppDoDesk(recepcao);
  // PLANO DO DESK: null = legado (sem trava). Demonstração mostra tudo.
  const [plano, setPlano] = useState(null);
  useEffect(() => {
    if (!conectado) return;
    chamarDesk(email, dataKey, { action: "plano" }).then(({ d }) => { if (d?.ok && !d.legado) setPlano(d.plan || "nenhum"); });
  }, [conectado, email, dataKey]);
  // Atalho do app ("Checkout" → ?aba=caixa) e links diretos abrem na aba pedida.
  const [aba, setAba] = useState(() => { try { const v = new URLSearchParams(window.location.search).get("aba"); return (recepcao ? ["agenda", "caixa", "clientes", "fechamento"] : ["agenda", "caixa", "clientes", "equipe", "fechamento", "relatorios", "importar"]).includes(v) ? v : "agenda"; } catch { return "agenda"; } });
  const [modo, setModo] = useState("dia");          // dia | semana
  const [dia, setDia] = useState(() => diaDe(new Date(), TZ0));
  const [locId, setLocId] = useState("");
  const [comSalas, setComSalas] = useState(false);
  const [estado, setEstado] = useState({ fase: "lendo", dados: null });
  const [seq, setSeq] = useState(0);
  const [sel, setSel] = useState(null);            // agendamento aberto
  const [novo, setNovo] = useState(null);          // { pro_id, minuto }
  const [bloqueio, setBloqueio] = useState(null);  // { pro_id }
  const [falta, setFalta] = useState(null);
  const [cobrarId, setCobrarId] = useState(null);   // pedido da assistente: abrir o caixa nesta cliente        // painel "alguém faltou": null | { pro_id? }
  const [caixa, setCaixa] = useState(null);        // { appointment } | {}
  const [fichaDe, setFichaDe] = useState(null);    // contato para abrir em Clientes
  const [proSemana, setProSemana] = useState("");
  const [busca, setBusca] = useState("");
  const [agora, setAgora] = useState(() => Date.now());
  const arrasto = useRef(null);
  const vistos = useRef({ chave: "", status: new Map() });   // o que já estava na tela na última leitura
  const feitosAqui = useRef(new Set());                       // mexidos NESTE balcão: não avisa de volta
  const [novos, setNovos] = useState(() => new Set());        // destacados até a recepção abrir
  const [avisos, setAvisos] = useState([]);                   // faixa "Enquanto você estava aqui"

  const dados = estado.dados;
  const loc = (dados?.locations || []).find((l) => l.id === locId) || (dados?.locations || [])[0] || null;
  const tz = loc?.tz || TZ0;

  useEffect(() => { const i = setInterval(() => setAgora(Date.now()), 60000); return () => clearInterval(i); }, []);

  // Leitura: o dia inteiro (ou a semana a partir de domingo) NO FUSO DA UNIDADE.
  const inicioSemana = somaDias(dia, -diaDaSemana(dia));
  const [de, ate] = modo === "semana" ? [inicioSemana, somaDias(inicioSemana, 7)] : [dia, somaDias(dia, 1)];
  useEffect(() => {
    let vivo = true;
    if (!conectado) { setEstado({ fase: "ok", dados: amostra(dia) }); return () => { vivo = false; }; }
    setEstado((e) => ({ fase: e.dados ? "relendo" : "lendo", dados: e.dados }));
    chamarDesk(email, dataKey, { action: "agenda", from: paraUtc(de, 0, tz).toISOString(), to: paraUtc(ate, 0, tz).toISOString() }).then(({ d }) => {
      if (!vivo) return;
      if (!d?.ok) { setEstado((e) => ({ fase: "falhou", dados: e.dados })); return; }
      // AO VIVO: compara com a leitura anterior DA MESMA janela (dia/semana). Reserva que apareceu e não foi
      // feita no balcão = "reserva nova"; passou a cancelada sem ser aqui = "cancelou".
      const lista = d.appointments || [], chave = `${de}|${ate}|${tz}`, v = vistos.current;
      if (v.chave === chave) {
        const chegou = [], cancelou = [];
        for (const a of lista) {
          if (feitosAqui.current.has(a.id)) continue;
          const antes = v.status.get(a.id);
          if (antes === undefined && a.source !== "desk" && !["blocked", "cancelled"].includes(a.status)) chegou.push(a);
          else if (antes && antes !== "cancelled" && a.status === "cancelled") cancelou.push(a);
        }
        if (chegou.length || cancelou.length) {
          setNovos((x) => { const n = new Set(x); chegou.forEach((a) => n.add(a.id)); return n; });
          const quando = new Date().toISOString();
          setAvisos((x) => [...chegou.map((a) => ({ tipo: "novo", a, quando })), ...cancelou.map((a) => ({ tipo: "cancelou", a, quando })), ...x].slice(0, 6));
          const um = chegou[0] || cancelou[0];
          toast(`🔔 ${chegou.length ? t("liveNew") : t("liveCancel")}: ${um.customer_name || "—"} · ${hhmm(minutoDe(um.start, tz))}`);
          tocarSino();
        }
      }
      vistos.current = { chave, status: new Map(lista.map((a) => [a.id, a.status])) };
      setEstado({ fase: "ok", dados: d });
    });
    return () => { vivo = false; };
  }, [conectado, email, dataKey, de, ate, tz, seq, dia]);

  const recarregar = useCallback(() => setSeq((n) => n + 1), []);
  // AO VIVO: relê sozinha a cada 45 s (com a tela visível) e quando a tela volta ao foco — reserva do site/IA
  // aparece sem a recepção recarregar. Só lê; nada muda no banco.
  useEffect(() => {
    if (!conectado) return undefined;
    const tic = () => { if (document.visibilityState === "visible") setSeq((n) => n + 1); };
    const i = setInterval(tic, 45000);
    document.addEventListener("visibilitychange", tic);
    return () => { clearInterval(i); document.removeEventListener("visibilitychange", tic); };
  }, [conectado]);
  useEffect(() => {
    if (!cobrarId || !estado.dados) return;
    const ap = (estado.dados.appointments || []).find((a) => a.id === cobrarId);
    setCaixa(ap ? { appointment: ap } : {}); setCobrarId(null);
  }, [cobrarId, estado.dados]);
  // PEDIDOS DO GUI (GuiCentral.jsx): trocar de aba, abrir "Alguém faltou" numa profissional, recarregar.
  // O pedido pode chegar antes do Balcão montar — por isso também fica em window.__deskPedido.
  useEffect(() => {
    const aplica = (p) => {
      if (!p) return;
      if (p.aba) setAba(p.aba);
      if (p.cobrar) setCobrarId(p.cobrar);
      if (p.falta) { setAba("agenda"); if (p.falta.dia) setDia(p.falta.dia); setFalta({ pro_id: p.falta.pro_id }); }
    };
    try { const p = window.__deskPedido; if (p && Date.now() - p.em < 8000) { aplica(p); window.__deskPedido = null; } } catch { /* */ }
    const h = (e) => { aplica(e.detail); try { window.__deskPedido = null; } catch { /* */ } };
    const r = () => setSeq((n) => n + 1);
    window.addEventListener("desk:pedido", h); window.addEventListener("desk:recarregar", r);
    return () => { window.removeEventListener("desk:pedido", h); window.removeEventListener("desk:recarregar", r); };
  }, []);
  const servico = useCallback((id) => (dados?.services || []).find((s) => s.id === id) || null, [dados]);
  // PROFISSIONAL × SERVIÇO (desk_v10): preparo/limpeza/duração efetivos = a regra dela, senão o do serviço.
  const regraDe = useCallback((proId, sid) => {
    const r = (dados?.pro_rules || []).find((x) => x.pro_id === proId && x.service_id === sid); const s = servico(sid);
    return { prep: r?.prep_min ?? s?.buffer_before_min ?? 0, finish: r?.finish_min ?? s?.buffer_after_min ?? 0, dur: r?.duration_min ?? s?.duration_min ?? 30 };
  }, [dados, servico]);
  const wd = diaDaSemana(dia);
  const fechado = (dados?.closed || []).find((c) => String(c.date).slice(0, 10) === dia) || null;

  // Colunas: profissionais da unidade (sem unidade = atende em todas); salas só quando pedido.
  const pros = useMemo(() => (dados?.pros || []).filter((p) => (!loc || !(p.locations || []).length || p.locations.includes(loc.id)) && (comSalas || (p.kind || "staff") !== "room")), [dados, loc, comSalas]);
  const temSalas = (dados?.pros || []).some((p) => p.kind === "room");
  // Sala/equipamento "pura" (não é marcada como profissional — é exigida pelo serviço): a coluna mostra as
  // reservas dela (a.resource_id) e não aceita marcar no vazio nem soltar cartão (viraria a sala como profissional).
  const salaPura = (p) => (p.kind === "room" || p.kind === "equipment") && !(p.services || []).length;
  const daUnidade = useCallback((a) => !loc || !a.location_id || a.location_id === loc.id, [loc]);
  const doDia = useMemo(() => (dados?.appointments || []).filter((a) => daUnidade(a) && diaDe(new Date(a.start), tz) === dia), [dados, daUnidade, tz, dia]);
  const visiveis = doDia.filter((a) => !CANCELADO(a));
  const clientes = visiveis.filter((a) => a.status !== "blocked");

  const janela = useMemo(() => {
    let ini = 24 * 60, fim = 0;
    pros.forEach((p) => (p.hours || []).filter((h) => h.weekday === wd && (!loc || !h.location_id || h.location_id === loc.id)).forEach((h) => { ini = Math.min(ini, h.start_min); fim = Math.max(fim, h.end_min); }));
    visiveis.forEach((a) => { const s = minutoDe(a.start, tz); ini = Math.min(ini, s); fim = Math.max(fim, s + (new Date(a.end) - new Date(a.start)) / 60000); });
    if (fim <= ini) { ini = 540; fim = 1140; }
    ini = Math.max(0, Math.floor(ini / 60) * 60); fim = Math.min(24 * 60, Math.ceil(fim / 60) * 60);
    return { ini, fim };
  }, [pros, visiveis, wd, loc, tz]);

  const expediente = (p, w = wd) => (p.hours || []).filter((h) => h.weekday === w && (!loc || !h.location_id || h.location_id === loc.id));
  const trabalha = (p, min) => expediente(p).some((h) => min >= h.start_min && min < h.end_min);
  const conta = (st) => clientes.filter((a) => a.status === st).length;
  const previsto = clientes.filter((a) => a.status !== "no_show").reduce((s, a) => s + (Number(servico(a.service_id)?.price_cents) || 0), 0);
  const achou = (a) => busca.trim() && `${a.customer_name || ""} ${a.customer_contact || ""}`.toLowerCase().includes(busca.trim().toLowerCase());

  // ── ações ────────────────────────────────────────────────────────────────────────────────
  const agir = async (corpo, okMsg) => {
    if (!conectado) { toast(t("sample")); return { ok: false }; }
    if (corpo.id) feitosAqui.current.add(corpo.id);
    const { http, d } = await chamarDesk(email, dataKey, corpo);
    if (d?.appointment_id) feitosAqui.current.add(d.appointment_id);
    if (d?.ok) { if (okMsg) toast(okMsg); recarregar(); return d; }
    toast(d?.reason === "resource_unavailable" ? t("resourceBusy") : motivo(d, http)); recarregar(); return d || { ok: false };
  };
  const mover = (a, pro_id, minuto) => {
    const novoInicio = paraUtc(dia, minuto, tz).toISOString();
    if (novoInicio === new Date(a.start).toISOString() && pro_id === a.pro_id) return;
    agir({ action: "move", id: a.id, start: novoInicio, pro_id }, t("moved"));
  };
  const soltar = (e, pro) => {
    e.preventDefault();
    const a = arrasto.current; arrasto.current = null;
    if (!a || salaPura(pro)) return;
    const caixaCol = e.currentTarget.getBoundingClientRect();
    const minuto = janela.ini + Math.max(0, Math.round((e.clientY - caixaCol.top - (a._dy || 0)) / PX / PASSO) * PASSO);
    mover(a, pro.id, minuto);
  };
  const cliqueVazio = (e, pro) => {
    if (fechado?.closed || salaPura(pro)) return;
    const caixaCol = e.currentTarget.getBoundingClientRect();
    setNovo({ pro_id: pro.id, minuto: janela.ini + Math.floor((e.clientY - caixaCol.top) / PX / PASSO) * PASSO });
  };
  // enviar=false → copia o link para a recepção; enviar=true → o servidor manda à cliente (texto/e-mail, com comprovante)
  const linkDoSinal = async (a, enviar = false) => {
    if (!conectado) { toast(t("sample")); return; }
    const sv = servico(a.service_id);
    const { http, d } = await chamarDesk(email, dataKey, { action: "deposit_link", id: a.id, send: enviar, contact: a.customer_contact || "", name: a.customer_name || "",
      service: sv?.name || "", tz, when_label: new Date(a.start).toLocaleString(localeAtual(), { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) });
    if (enviar) {
      if (d?.ok) { toast(d.enviado?.texto?.sent ? t("depositTexted") : t("depositEmailed")); recarregar(); }
      else toast(d?.reason === "not_delivered" ? t("depositNotSent") : motivo(d, http));
      return;
    }
    if (d?.ok && d.url) {
      try { await navigator.clipboard.writeText(d.url); toast(t("depositCopied")); } catch { window.prompt(t("doDeposit"), d.url); }
    } else toast(motivo(d, http));
  };

  const hoje = diaDe(new Date(agora), tz);
  const minutoAgora = dia === hoje ? minutoDe(new Date(agora).toISOString(), tz) : null;
  const passo = modo === "semana" ? 7 : 1;

  // ── cabeçalho comum ──────────────────────────────────────────────────────────────────────
  // Recepção (código próprio): só o dia — agenda, caixa, clientes, fechamento. O servidor recusa o resto mesmo assim.
  const abas = [["agenda", "tabAgenda"], ["caixa", "tabCaixa"], ["clientes", "tabClientes"], ["equipe", "tabEquipe"], ["fechamento", "tabFechamento"], ["relatorios", "tabRelatorios"], ["importar", "tabImportar"]]
    .filter(([k]) => !recepcao || ["agenda", "caixa", "clientes", "fechamento"].includes(k));
  const Abas = (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-0.5 pr-6 sm:pr-0.5 w-fit max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_88%,transparent)] sm:[mask-image:none]" role="tablist">
      {abas.map(([k, label]) => (
        // "Importar e exportar" nunca leva 🔒: exportar a base é livre em qualquer plano (até cancelado).
        <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} title={planoInclui(plano, ABA_MIN[k] || "basic") || k === "importar" ? undefined : t("lockedH").replace("{p}", nomePlano(ABA_MIN[k]))}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] rounded-full text-xs font-bold ${aba === k ? "bg-g-green/20 text-g-word" : "text-g-muted hover:text-g-word"}`}>{planoInclui(plano, ABA_MIN[k] || "basic") || k === "importar" ? "" : "🔒 "}{t(label)}</button>
      ))}
    </div>
  );
  const ChipPlano = recepcao ? (
    <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-black text-g-muted">{tx({ en: "Front desk access", pt: "Acesso da recepção", es: "Acceso de recepción", hi: "रिसेप्शन एक्सेस" })}</span>
  ) : plano && NO_APP_NATIVO ? (
    <span className="rounded-full border border-g-gold/40 bg-g-gold/10 px-3 py-1.5 text-[11px] font-black text-g-gold">{plano === "nenhum" ? "⚠ " + t("canceledH") : t("planChip").replace("{p}", nomePlano(plano))}</span>
  ) : plano ? (
    <a href="/desk#planos" target="_blank" rel="noopener" className="rounded-full border border-g-gold/40 bg-g-gold/10 px-3 py-1.5 text-[11px] font-black text-g-gold">{plano === "nenhum" ? "⚠ " + t("canceledH") : t("planChip").replace("{p}", nomePlano(plano))}</a>
  ) : null;
  const travada = !planoInclui(plano, ABA_MIN[aba] || "basic") && !(plano === "nenhum" && aba === "agenda");
  const Unidades = (dados?.locations || []).length > 1 ? (
    <div className="flex max-w-full overflow-x-auto rounded-full border border-white/10 bg-white/[0.04] p-0.5">
      {dados.locations.map((l) => (
        <button key={l.id} onClick={() => setLocId(l.id)} className={`shrink-0 whitespace-nowrap px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] rounded-full text-xs font-bold ${loc?.id === l.id ? "bg-g-green/20 text-g-word" : "text-g-muted hover:text-g-word"}`}>{l.name}</button>
      ))}
    </div>
  ) : null;
  const espera = <SectionSkeleton rows={5} />;
  const comum = { email, dataKey, conectado };

  if (estado.fase === "lendo" && aba === "agenda") return <div className="space-y-4">{Abas}<SectionSkeleton rows={6} /></div>;

  if (aba !== "agenda") {
    return (
      // pb: folga para a bolha da assistente (fixa no canto) nunca cobrir o último cartão.
      <div className="space-y-4 pb-24 md:pb-20">
        <div className="flex flex-wrap items-center justify-between gap-2">{Abas}<div className="flex flex-wrap items-center gap-2">{ChipPlano}{Unidades}</div></div>
        {/* Importar travado (plano básico ou cancelado): primeiro o que ela PODE fazer — baixar a base, de graça —
            e só depois o aviso do plano que libera a importação. */}
        {travada ? <div className="space-y-4">{aba === "importar" && !recepcao && <DeskExportar {...comum} />}
          <Bloqueado min={ABA_MIN[aba]} email={email} dataKey={dataKey} cancelado={plano === "nenhum"} /></div> : <Suspense fallback={espera}>
          {aba === "caixa" && (
            <div className="space-y-3">
              <Card className="!p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-g-muted">{tx({ en: "Ring up a walk-in, sell a product, a package or a gift card.", pt: "Cobre uma cliente sem hora marcada, venda produto, pacote ou vale-presente.", es: "Cobra a una clienta sin cita, vende producto, paquete o tarjeta regalo.", hi: "वॉक-इन ग्राहक से चार्ज करें, उत्पाद, पैकेज या गिफ्ट कार्ड बेचें।" })}</div>
                <button onClick={() => setCaixa({})} className="rounded-full bg-g-green px-4 py-2 text-sm font-extrabold text-[#161512]">{t("newSale")}</button>
              </Card>
              <DeskFechamento {...comum} agenda={dados} loc={loc} />
            </div>
          )}
          {aba === "clientes" && <DeskClientes {...comum} tz={tz} initialContact={fichaDe} onBook={() => setAba("agenda")} />}
          {aba === "equipe" && <DeskEquipe {...comum} agenda={dados} onChanged={recarregar} />}
          {aba === "fechamento" && <DeskFechamento {...comum} agenda={dados} loc={loc} />}
          {aba === "importar" && <DeskImportar {...comum} agenda={dados} onChanged={recarregar} />}
          {aba === "relatorios" && <DeskRelatorios {...comum} agenda={dados} loc={loc} />}
          {caixa && <DeskCaixa {...comum} agenda={dados} loc={loc} appointment={caixa.appointment || null} onClose={() => setCaixa(null)} onDone={() => { setCaixa(null); recarregar(); }} />}
        </Suspense>}
      </div>
    );
  }

  // ── AGENDA ───────────────────────────────────────────────────────────────────────────────
  // Só a 1ª letra maiúscula ("Segunda-feira, 5 de outubro"); o `capitalize` do CSS fazia "5 De Outubro".
  const tituloDiaCru = new Date(`${dia}T12:00:00Z`).toLocaleDateString(localeAtual(), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const tituloDia = tituloDiaCru.charAt(0).toUpperCase() + tituloDiaCru.slice(1);
  const quandoCurto = (iso) => { try { return new Date(iso).toLocaleString(localeAtual(), { timeZone: tz, weekday: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; } };
  const altura = (janela.fim - janela.ini) * PX;
  const horas = []; for (let m = janela.ini; m < janela.fim; m += 60) horas.push(m);

  return (
    <div className="space-y-4 pb-24 md:pb-20">
      <div className="flex flex-wrap items-center justify-between gap-2">{Abas}<div className="flex flex-wrap items-center gap-2">{ChipPlano}{Unidades}<InstalarApp /></div></div>
      {plano === "nenhum" && <Bloqueado min="basic" email={email} dataKey={dataKey} cancelado />}
      {plano === "nenhum" && !recepcao && <DeskExportar {...comum} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-g-muted max-w-md">{t("sub")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5">
            {[["dia", "day"], ["semana", "week"]].map(([k, l]) => (
              <button key={k} onClick={() => setModo(k)} className={`px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] rounded-full text-xs font-bold ${modo === k ? "bg-g-green/20 text-g-word" : "text-g-muted hover:text-g-word"}`}>{t(l)}</button>
            ))}
          </div>
          <div className="flex items-center rounded-full border border-white/10 bg-white/[0.04]">
            <button onClick={() => setDia(somaDias(dia, -passo))} aria-label={t("prev")} className="min-w-[40px] px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-g-muted hover:text-g-word">‹</button>
            <button onClick={() => setDia(hoje)} className={`px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold ${dia === hoje ? "text-g-green" : "text-g-word"}`}>{t("today")}</button>
            <button onClick={() => setDia(somaDias(dia, passo))} aria-label={t("next")} className="min-w-[40px] px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-g-muted hover:text-g-word">›</button>
          </div>
          <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs text-g-word [color-scheme:dark]" />
          {modo === "dia" && <button onClick={() => { if (!imprimirDia({ titulo: tituloDia, negocio: loc?.name || "", pros, appts: (dados?.appointments || []).filter((a) => diaDe(new Date(a.start), tz) === dia), servico, tz })) toast("Pop-up"); }} className="rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word">🖨 {t("printDay")}</button>}
          <button onClick={() => setFalta({})} className="rounded-full border border-amber-300/40 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-amber-200">🤒 {t("absence")}</button>
          <button onClick={() => setBloqueio({ pro_id: pros[0]?.id || "" })} className="rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word">{t("blockTime")}</button>
          <button onClick={() => setCaixa({})} className="rounded-full bg-g-green px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-extrabold text-[#161512]">{t("newSale")}</button>
        </div>
      </div>

      {!conectado && <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] px-4 py-2.5 text-xs text-g-light">{t("sample")}</div>}
      {avisos.length > 0 && (
        <div role="status" className="rounded-2xl border border-g-green/40 bg-g-green/[0.07] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold text-g-word">🔔 {t("liveTitle")}</div>
            <button onClick={() => { setAvisos([]); setNovos(new Set()); }} className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-g-word">{t("liveOk")}</button>
          </div>
          <ul className="mt-2 space-y-1">
            {avisos.map((v) => (
              <li key={`${v.tipo}-${v.a.id}`} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">
                  <b className={v.tipo === "novo" ? "text-g-green" : "text-[#FF8A8A]"}>{v.tipo === "novo" ? t("liveNew") : t("liveCancel")}</b>
                  <span className="text-g-word"> · {v.a.customer_name || "—"} · {quandoCurto(v.a.start)}</span>
                  <span className="text-g-muted"> · {servico(v.a.service_id)?.name || ""}{v.tipo === "novo" ? ` · ${v.a.source === "mindbody" ? t("src_mindbody") : t("liveSrc")}` : ""}</span>
                </span>
                {v.tipo === "novo" && <button onClick={() => { setDia(diaDe(new Date(v.a.start), tz)); setModo("dia"); setSel(v.a); setNovos((x) => { const n = new Set(x); n.delete(v.a.id); return n; }); }} className="shrink-0 rounded-full bg-g-green px-3 py-1 text-[11px] font-extrabold text-[#161512]">{t("liveSee")}</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {estado.fase === "falhou" && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl2 border border-red-400/30 bg-red-400/[0.06] px-4 py-2.5 text-xs text-red-300">
          <span>{t("readFail")}</span>
          <button onClick={recarregar} className="font-bold text-g-word underline">{t("retry")}</button>
        </div>
      )}

      {modo === "semana" ? (
        <Semana dados={dados} pros={pros} proSel={proSemana || pros[0]?.id || ""} setProSel={setProSemana} inicio={inicioSemana} tz={tz} daUnidade={daUnidade}
          servico={servico} expediente={expediente} hoje={hoje} abrirDia={(d) => { setDia(d); setModo("dia"); }} abrir={setSel} />
      ) : (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[["booked", clientes.length, COR.booked], ["confirmed", conta("confirmed"), COR.confirmed], ["arrived", conta("in_progress"), COR.in_progress], ["completed", conta("completed"), COR.completed], ["noshow", conta("no_show"), COR.no_show], ["expected", dinheiro(previsto, tz, { zeroTraco: true, casas: 0 }), "#D6C29A"]].map(([k, v, c]) => (
              <Card key={k} className="!p-3">
                <div className="text-[10px] uppercase tracking-wide text-g-muted">{t(k)}</div>
                <div className="text-lg font-extrabold num mt-0.5" style={{ color: c }}>{v}</div>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold text-g-word">{tituloDia}{loc ? <span className="text-g-muted font-normal"> · {loc.name}</span> : null}</div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {temSalas && <label className="flex shrink-0 items-center gap-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs text-g-muted"><input type="checkbox" checked={comSalas} onChange={(e) => setComSalas(e.target.checked)} />{t("rooms")}</label>}
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("search")}
                className="w-full sm:w-64 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs text-g-word placeholder:text-g-muted" />
            </div>
          </div>

          {fechado?.closed && <div className="rounded-xl2 border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs text-g-muted">{t("closedDay")}{fechado.note ? ` — ${fechado.note}` : ""}</div>}

          {pros.length === 0 ? (
            <Card><p className="text-sm text-g-muted">{t("noPros")}</p></Card>
          ) : (
            <div className="rounded-xl2 border border-white/10 bg-white/[0.03] overflow-auto overscroll-x-contain max-h-[70dvh] lg:max-h-[80vh]">
              <div className="min-w-full w-max">
                <div className="flex sticky top-0 z-10 bg-[#1a1916] border-b border-white/10">
                  <div className="w-14 sm:w-16 shrink-0 sticky left-0 z-[3] bg-[#1a1916]" />
                  {pros.map((p) => {
                    const n = clientes.filter((a) => a.pro_id === p.id || (salaPura(p) && a.resource_id === p.id)).length;
                    const exp = expediente(p);
                    return (
                      <div key={p.id} className="flex-1 min-w-[9rem] sm:min-w-[12rem] px-2 sm:px-3 py-2.5 border-l border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-black text-[#161512]" style={{ background: p.color || "#D6C29A" }}>{p.kind === "room" ? "▢" : (p.name || "?").slice(0, 1).toUpperCase()}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-g-word truncate">{p.name}</div>
                            <div className="text-[10px] text-g-muted truncate">{salaPura(p) ? t("room") : exp.length ? exp.map((h) => `${hhmm(h.start_min)}–${hhmm(h.end_min)}`).join(", ") : t("off")} · {n}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex relative">
                  <div className="w-14 sm:w-16 shrink-0 sticky left-0 z-[3] bg-[#1a1916] border-r border-white/[0.06]" style={{ height: altura }}>
                    {horas.map((m) => <div key={m} className="absolute right-2 -translate-y-1/2 text-[10px] text-g-muted num" style={{ top: (m - janela.ini) * PX }}>{m === janela.ini ? "" : hhmm(m)}</div>)}
                  </div>
                  {pros.map((p) => (
                    <div key={p.id} className="flex-1 min-w-[9rem] sm:min-w-[12rem] relative border-l border-white/[0.06] cursor-cell" style={{ height: altura }}
                      onClick={(e) => { if (e.target === e.currentTarget) cliqueVazio(e, p); }}
                      onDragOver={(e) => { if (arrasto.current && !salaPura(p)) e.preventDefault(); }}
                      onDrop={(e) => soltar(e, p)}>
                      {Array.from({ length: (janela.fim - janela.ini) / PASSO }).map((_, i) => {
                        const m = janela.ini + i * PASSO;
                        return (trabalha(p, m) || salaPura(p)) && !fechado?.closed ? null : <div key={i} className="absolute inset-x-0 pointer-events-none bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.025)_0_6px,transparent_6px_12px)]" style={{ top: i * PASSO * PX, height: PASSO * PX }} />;
                      })}
                      {horas.map((m) => <div key={m} className="absolute inset-x-0 border-t border-white/[0.06] pointer-events-none" style={{ top: (m - janela.ini) * PX }} />)}
                      {visiveis.filter((a) => a.pro_id === p.id || (salaPura(p) && a.resource_id === p.id)).map((a) => {
                        const s = minutoDe(a.start, tz); const dur = (new Date(a.end) - new Date(a.start)) / 60000;
                        const sv = servico(a.service_id); const c = COR[a.status] || COR.booked;
                        const bloq = a.status === "blocked";
                        const naSala = a.pro_id !== p.id;   // reserva da sala: o cartão "de verdade" está na coluna da profissional
                        const arrastavel = !FINAL.has(a.status) && !bloq && !naSala;
                        // Faixa hachurada de preparo (antes) e limpeza (depois): a profissional está ocupada, a cliente não.
                        const rg = bloq || naSala ? { prep: 0, finish: 0 } : regraDe(a.pro_id, a.service_id);
                        const faixa = (min, topo, rot) => min > 0 && <div aria-hidden title={`${rot} ${min} ${t("min")}`} className="absolute left-1 right-1 pointer-events-none rounded-sm"
                          style={{ top: (topo - janela.ini) * PX + 1, height: Math.max(min * PX - 2, 2), background: `repeating-linear-gradient(135deg, ${c}2e 0 4px, transparent 4px 9px)`, borderLeft: `3px solid ${c}55` }} />;
                        return (
                          <Fragment key={a.id}>
                          {faixa(rg.prep, s - rg.prep, t("prepLabel"))}
                          {faixa(rg.finish, s + dur, t("finishLabel"))}
                          <button type="button" draggable={arrastavel}
                            onDragStart={(e) => { arrasto.current = { ...a, _dy: e.clientY - e.currentTarget.getBoundingClientRect().top }; e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { arrasto.current = null; }}
                            onClick={() => { setSel(a); if (novos.has(a.id)) setNovos((x) => { const n = new Set(x); n.delete(a.id); return n; }); }}
                            className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden border transition-shadow hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-g-green ${achou(a) ? "ring-2 ring-g-gold" : novos.has(a.id) ? "ring-2 ring-g-green shadow-[0_0_18px_rgba(47,227,154,0.35)]" : ""} ${a.status === "completed" || a.status === "no_show" || naSala ? "opacity-60" : ""}`}
                            style={{ top: (s - janela.ini) * PX + 1, height: Math.max(dur * PX - 2, 22), background: bloq ? "repeating-linear-gradient(135deg,rgba(255,255,255,.06) 0 6px,rgba(255,255,255,.02) 6px 12px)" : `${c}22`, borderColor: `${c}66`, borderLeft: `3px solid ${c}` }}>
                            <div className="flex items-center gap-1 text-[10px] font-bold num" style={{ color: c }}>
                              <span>{hhmm(s)} · {t(`st_${a.status}`)}</span>{novos.has(a.id) && <span className="rounded bg-g-green px-1 text-[9px] font-black text-[#161512]">{t("newBadge")}</span>}
                              {a.alert && <span title={a.alert} className="text-amber-300">⚠</span>}
                              {a.sale_id && <span title={t("paid")} className="text-g-green">$</span>}
                              {a.deposit_paid && <span title={t("depositPaid")} className="text-g-green">◆</span>}
                              {a.trusted && <span title={t("trusted")}>★</span>}
                              {a.grupo && <span title={tv("groupOf", { r: a.grupo_rotulo === "casal" ? t("couple") : t("group"), i: a.grupo_n, n: a.grupo_total })} aria-label={tv("groupOf", { r: a.grupo_rotulo === "casal" ? t("couple") : t("group"), i: a.grupo_n, n: a.grupo_total })}>👥</span>}
                              {(a.addons || []).length > 0 && <span title={`${t("addons")}: ${a.addons.map((x) => x.name).join(", ")}`} className="rounded border border-current/40 px-1 text-[9px] font-black">+{a.addons.length}</span>}
                              {a.resource && dur < 40 && !naSala && <span className="truncate font-normal text-g-muted">· {a.resource}</span>}
                            </div>
                            <div className="text-xs font-bold text-g-word truncate">{a.customer_name || "—"}</div>
                            {dur >= 40 && !bloq && <div className="text-[10px] text-g-muted truncate">{naSala ? (pros.find((x) => x.id === a.pro_id)?.name || sv?.name || "") : `${sv?.name || ""}${(a.addons || []).length ? ` + ${a.addons.map((x) => x.name).join(" + ")}` : ""}${a.resource ? ` · ${a.resource}` : ""}`}</div>}
                          </button>
                          </Fragment>
                        );
                      })}
                      {minutoAgora != null && minutoAgora >= janela.ini && minutoAgora <= janela.fim && <div className="absolute inset-x-0 h-0.5 bg-red-400 pointer-events-none z-[1]" style={{ top: (minutoAgora - janela.ini) * PX }} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {doDia.some(CANCELADO) && <div className="text-[11px] text-g-muted">{doDia.filter(CANCELADO).length} {t("cancelled")}{doDia.some((a) => a.status === "late_cancelled") ? <span className="text-[#E0894A]"> · {doDia.filter((a) => a.status === "late_cancelled").length} {t("lateCancelled")}</span> : null}</div>}
        </>
      )}

      {sel && <PainelAgendamento a={sel} pros={dados?.pros || []} servico={servico} regra={regraDe(sel.pro_id, sel.service_id)} adicionais={(dados?.services || []).filter((s) => s.addon)} tz={tz} dia={dia} onClose={() => setSel(null)} agir={agir}
        doGrupo={sel.grupo ? (dados?.appointments || []).filter((x) => x.grupo === sel.grupo && x.id !== sel.id && x.status !== "cancelled") : []}
        abrirCaixa={() => { setCaixa({ appointment: sel }); setSel(null); }}
        abrirFicha={() => { setFichaDe(sel.customer_contact || null); setSel(null); setAba("clientes"); }}
        linkDoSinal={(enviar) => linkDoSinal(sel, enviar)} />}
      {novo && <NovoAgendamento base={novo} dia={dia} tz={tz} loc={loc} pros={pros} todos={dados?.pros || []} services={dados?.services || []} regras={dados?.pro_rules || []} doDia={doDia} onClose={() => setNovo(null)} agir={agir} />}
      {bloqueio && <NovoBloqueio base={bloqueio} dia={dia} tz={tz} loc={loc} pros={(dados?.pros || []).filter((p) => !loc || !(p.locations || []).length || p.locations.includes(loc.id))} onClose={() => setBloqueio(null)} agir={agir} />}
      {falta && <FaltaDaProfissional inicial={falta.pro_id || ""} dia={dia} tz={tz} loc={loc} pros={pros.filter((p) => (p.kind || "staff") !== "room")} conectado={conectado} amostra={conectado ? null : dados} email={email} dataKey={dataKey} onClose={() => setFalta(null)} agir={agir} recarregar={recarregar} />}
      {caixa && <Suspense fallback={null}><DeskCaixa {...comum} agenda={dados} loc={loc} appointment={caixa.appointment || null} onClose={() => setCaixa(null)} onDone={() => { setCaixa(null); recarregar(); }} /></Suspense>}
    </div>
  );
}

// ── semana: 7 dias de UMA profissional (ou sala) ─────────────────────────────────────────────
function Semana({ dados, pros, proSel, setProSel, inicio, tz, daUnidade, servico, expediente, hoje, abrirDia, abrir }) {
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(inicio, i));
  const pro = pros.find((p) => p.id === proSel) || pros[0];
  const doPro = (dados?.appointments || []).filter((a) => a.pro_id === pro?.id && daUnidade(a) && a.status !== "cancelled");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-g-muted">{t("pickPro")}</span>
        {pros.map((p) => (
          <button key={p.id} onClick={() => setProSel(p.id)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold ${pro?.id === p.id ? "border-g-green/50 bg-g-green/10 text-g-word" : "border-white/10 text-g-muted"}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color || "#D6C29A" }} />{p.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {dias.map((d) => {
          const lista = doPro.filter((a) => diaDe(new Date(a.start), tz) === d).sort((a, b) => new Date(a.start) - new Date(b.start));
          const exp = pro ? expediente(pro, diaDaSemana(d)) : [];
          const cab = new Date(`${d}T12:00:00Z`).toLocaleDateString(localeAtual(), { weekday: "short", day: "numeric", timeZone: "UTC" });
          return (
            <div key={d} className={`rounded-xl2 border ${d === hoje ? "border-g-green/40" : "border-white/10"} bg-white/[0.03] p-2 sm:min-h-[8rem]`}>
              <button onClick={() => abrirDia(d)} className="w-full text-left min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px]">
                <div className={`text-xs font-bold capitalize ${d === hoje ? "text-g-green" : "text-g-word"}`}>{cab}</div>
                <div className="text-[10px] text-g-muted">{exp.length ? exp.map((h) => `${hhmm(h.start_min)}–${hhmm(h.end_min)}`).join(", ") : t("off")}</div>
              </button>
              <div className="mt-2 space-y-1">
                {lista.map((a) => {
                  const c = COR[a.status] || COR.booked;
                  return (
                    <button key={a.id} onClick={() => abrir(a)} className="w-full rounded-md px-1.5 py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-left" style={{ background: `${c}22`, borderLeft: `3px solid ${c}` }}>
                      <div className="text-[10px] font-bold num" style={{ color: c }}>{hhmm(minutoDe(a.start, tz))}{a.alert ? " ⚠" : ""}{a.grupo ? " 👥" : ""}</div>
                      <div className="text-[11px] text-g-word truncate">{a.customer_name || "—"}</div>
                      {a.status !== "blocked" && <div className="text-[10px] text-g-muted truncate">{servico(a.service_id)?.name || ""}{a.resource ? ` · ${a.resource}` : ""}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PainelAgendamento({ a, pros, servico, regra = null, adicionais = [], tz, dia, onClose, agir, abrirCaixa, abrirFicha, linkDoSinal, doGrupo = [] }) {
  const [nota, setNota] = useState(a.note || "");
  // ADICIONAIS (desk_v11): troca a lista; o motor refaz o fim do horário e recusa se bater no próximo.
  const [addEdit, setAddEdit] = useState(null);   // Set de ids enquanto edita; null = fechado
  const [addErro, setAddErro] = useState("");     // recusa do motor, mostrada dentro do editor (não só no toast)
  const salvarAddons = async () => {
    setOcupado(true); setAddErro("");
    const d = await agir({ action: "addons_set", id: a.id, addons: [...addEdit] }, null);
    setOcupado(false);
    if (d?.ok) { toast(t("addonsSaved")); onClose(); return; }
    setAddErro(d?.reason === "slot_taken" ? t("addonsNoFit") : d?.reason === "resource_unavailable" ? t("resourceBusy") : motivo(d));
  };
  const addonsTxt = (a.addons || []).map((x) => `${x.name} (+${x.duration_min} ${t("min")} · ${dinheiro(x.price_cents, tz, { zeroTraco: true })})`).join(", ");
  // MOVER sem arrastar (iPad/celular: arrastar com o dedo não funciona na grade).
  const [mov, setMov] = useState(null); // { dia, minuto, pro_id }
  const [ocupado, setOcupado] = useState(false);
  const sv = servico(a.service_id); const pro = pros.find((p) => p.id === a.pro_id);
  const s = minutoDe(a.start, tz); const fim = minutoDe(a.end, tz);
  const vai = async (status, msg) => { setOcupado(true); const d = await agir({ action: "status", id: a.id, status }, msg); setOcupado(false); if (d?.ok) onClose(); };
  const btn = "rounded-full px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold border disabled:opacity-40";
  const fonte = a.source === "desk" ? t("src_desk") : a.source === "mindbody" ? t("src_mindbody") : t("src_gui");
  const bloq = a.status === "blocked";
  const temSinal = (Number(sv?.deposit_cents) || 0) > 0;
  // CASAL / GRUPO: os outros do mesmo pedido (a agenda já trouxe). Cancelar todos = um cancelamento por vez,
  // pelo mesmo caminho do botão de cancelar (libera o horário e oferece à fila de cada vaga).
  const rotuloGrupo = a.grupo_rotulo === "casal" ? t("couple") : t("group");
  const abertosDoGrupo = [a, ...doGrupo].filter((x) => !FINAL.has(x.status) && x.status !== "blocked");
  const cancelarTodos = async () => {
    if (!window.confirm(tv("cancelAllAsk", { n: abertosDoGrupo.length, r: rotuloGrupo.toLowerCase() }))) return;
    setOcupado(true); let feitos = 0;
    for (const x of abertosDoGrupo) { const d = await agir({ action: "status", id: x.id, status: "cancelled" }, null); if (d?.ok) feitos++; }
    setOcupado(false);
    toast(feitos === abertosDoGrupo.length ? tv("cancelledAll", { n: feitos }) : tv("cancelledSome", { a: feitos, b: abertosDoGrupo.length }));
    if (feitos) onClose();
  };
  return (
    <Drawer title={a.customer_name || "—"} subtitle={`${hhmm(s)}–${hhmm(fim)} · ${pro?.name || ""}${a.resource ? ` · ${a.resource}` : ""}`} onClose={onClose}
      badge={<span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: `${COR[a.status] || COR.booked}33`, color: COR[a.status] || COR.booked }}>{t(`st_${a.status}`)}</span>}
      fields={bloq ? [] : [[t("service"), sv ? `${sv.name} · ${Math.round((new Date(a.end) - new Date(a.start)) / 60000)} ${t("min")}` : ""], [t("room"), a.resource || ""],
        [t("prepFinish"), regra && (regra.prep || regra.finish) ? `${regra.prep} / ${regra.finish} ${t("min")}` : ""],
        [t("addons"), addonsTxt], [t("price"), sv ? dinheiro(sv.price_cents, tz, { zeroTraco: true }) : ""], [t("phone"), a.customer_contact || ""], [t("bookedBy"), fonte], [t("depositPaid"), a.deposit_paid ? "✓" : ""], [t("paid"), a.sale_id ? "✓" : ""]]}
      actions={bloq ? (
        <button disabled={ocupado} onClick={() => vai("cancelled", t("saved"))} className={`${btn} border-white/20 text-g-word`}>{t("doUnblock")}</button>
      ) : FINAL.has(a.status) && a.sale_id ? null : (
        <>
          {/* Faltou / cancelou: a taxa (falta ou cancelamento em cima da hora) é cobrada no cartão salvo, pelo caixa
              (DeskPagamentosOnline). Antes este painel escondia o caixa nesses casos e o botão ficava inalcançável. */}
          {!a.sale_id && (a.status === "no_show" || CANCELADO(a)) && <button disabled={ocupado} onClick={abrirCaixa} className="rounded-full border border-g-gold/40 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-gold">💳 {t("doFee")}</button>}
          {/* desk_v12: a falta (automática ou da recepção) se desfaz com um toque; o motor recusa se o horário já foi ocupado. */}
          {a.status === "no_show" && <button disabled={ocupado} onClick={async () => { setOcupado(true); const d = await agir({ action: "noshow_undo", id: a.id }, null); setOcupado(false); if (d?.ok) { toast(t("arrivedAfterAll")); onClose(); } else if (d?.reason === "slot_taken") toast(t("undoNoFit")); }} className={`${btn} border-yellow-300/40 text-yellow-200`}>{t("doArrivedAfterAll")}</button>}
          {!a.sale_id && !CANCELADO(a) && a.status !== "no_show" && <button disabled={ocupado} onClick={abrirCaixa} className="rounded-full bg-g-green px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-extrabold text-[#161512]">{t("doCheckout")}</button>}
          {a.status === "booked" && <button disabled={ocupado} onClick={() => vai("confirmed", t("saved"))} className={`${btn} border-g-green/40 text-g-green`}>{t("doConfirm")}</button>}
          {(a.status === "booked" || a.status === "confirmed") && <button disabled={ocupado} onClick={() => vai("arrived", t("saved"))} className={`${btn} border-yellow-300/40 text-yellow-200`}>{t("doArrive")}</button>}
          {!FINAL.has(a.status) && a.status !== "in_progress" && <button disabled={ocupado} onClick={() => vai("no_show", t("saved"))} className={`${btn} border-red-400/40 text-red-300`}>{t("doNoShow")}</button>}
          {!FINAL.has(a.status) && abertosDoGrupo.length > 1 && <button disabled={ocupado} onClick={cancelarTodos} className={`${btn} border-white/15 text-g-word`}>{tv("cancelAll", { n: abertosDoGrupo.length })}</button>}
          {!FINAL.has(a.status) && <button disabled={ocupado} onClick={() => { if (window.confirm(t("cancelAsk"))) vai("cancelled", t("saved")); }} className={`${btn} border-white/10 text-g-muted`}>{abertosDoGrupo.length > 1 ? t("cancelOnly") : t("doCancel")}</button>}
        </>
      )}>
      {!bloq && (
        <div className="pt-3 space-y-3">
          {a.alert && <div className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200">⚠ {a.alert}</div>}
          {a.status === "no_show" && a.noshow_auto && <div role="note" className="rounded-xl border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs text-red-200">{tv("autoNoShow", { h: a.noshow_auto_at ? hhmm(minutoDe(a.noshow_auto_at, tz)) : "" })}</div>}
          {a.trusted && <div className="text-xs text-g-green">★ {t("trusted")}</div>}
          {a.grupo && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs font-bold text-g-word">👥 {tv("groupOf", { r: rotuloGrupo, i: a.grupo_n, n: a.grupo_total })}</div>
              {doGrupo.length > 0 && <div className="mt-1 text-[11px] text-g-muted">{t("together")}</div>}
              <ul className="mt-1 space-y-1">
                {doGrupo.map((x) => (
                  <li key={x.id} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-g-word">{hhmm(minutoDe(x.start, tz))} · {x.customer_name || "—"}</span>
                    <span className="shrink-0 truncate text-g-muted">{servico(x.service_id)?.name || ""} · {pros.find((p) => p.id === x.pro_id)?.name || ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!FINAL.has(a.status) && (mov ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-g-muted">{t("moveTitle")}</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={mov.dia} onChange={(e) => e.target.value && setMov({ ...mov, dia: e.target.value })} className={campo} />
                <select value={mov.minuto} onChange={(e) => setMov({ ...mov, minuto: Number(e.target.value) })} className={campo}>{horarios.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select>
              </div>
              <select value={mov.pro_id} onChange={(e) => setMov({ ...mov, pro_id: e.target.value })} className={campo}>
                {pros.filter((p) => (p.kind || "staff") !== "room" && p.kind !== "equipment" && (!(p.services || []).length || p.services.includes(a.service_id))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button disabled={ocupado} onClick={async () => { setOcupado(true); const d = await agir({ action: "move", id: a.id, start: paraUtc(mov.dia, mov.minuto, tz).toISOString(), pro_id: mov.pro_id }, t("moved")); setOcupado(false); if (d?.ok) onClose(); }}
                  className="rounded-full bg-g-green px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-extrabold text-[#161512] disabled:opacity-40">{t("doMove")}</button>
                <button onClick={() => setMov(null)} className={`${btn} border-white/10 text-g-muted`}>✕</button>
              </div>
            </div>
          ) : null)}
          {addEdit && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-g-muted">{t("addons")}</div>
              <p className="text-[11px] text-g-muted">{t("addonsHint")}</p>
              {adicionais.map((s) => (
                <label key={s.id} className="flex min-h-[40px] items-center gap-2 text-sm text-g-word cursor-pointer">
                  <input type="checkbox" checked={addEdit.has(s.id)} onChange={() => setAddEdit((x) => { const n = new Set(x); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} className="h-4 w-4 accent-[rgb(var(--g-green))]" />
                  <span className="truncate">{s.name}</span><span className="ml-auto shrink-0 text-xs text-g-muted">+{s.duration_min} {t("min")} · {dinheiro(s.price_cents, tz, { zeroTraco: true })}</span>
                </label>
              ))}
              {addErro && <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-xs text-red-200">{addErro}</div>}
              <div className="flex gap-2">
                <button disabled={ocupado} onClick={salvarAddons} className="rounded-full bg-g-green px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-extrabold text-[#161512] disabled:opacity-40">{t("addonsSave")}</button>
                <button onClick={() => { setAddEdit(null); setAddErro(""); }} className={`${btn} border-white/10 text-g-muted`}>✕</button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!FINAL.has(a.status) && !mov && <button onClick={() => setMov({ dia: diaDe(new Date(a.start), tz) || dia, minuto: Math.round(minutoDe(a.start, tz) / PASSO) * PASSO, pro_id: a.pro_id })} className={`${btn} border-white/15 text-g-word`}>{t("doMove")}</button>}
            {!FINAL.has(a.status) && !addEdit && adicionais.length > 0 && <button onClick={() => setAddEdit(new Set((a.addons || []).map((x) => x.service_id)))} className={`${btn} border-white/15 text-g-word`}>{t("addonsEdit")}</button>}
            {a.customer_contact && <button onClick={abrirFicha} className={`${btn} border-white/15 text-g-word`}>{t("doCard")}</button>}
            {temSinal && !a.deposit_paid && !a.trusted && !FINAL.has(a.status) && (<>
              <button onClick={() => linkDoSinal(true)} className={`${btn} border-g-gold/40 text-g-gold`}>{t("doDepositSend")} · {dinheiro(sv.deposit_cents, tz)}</button>
              <button onClick={() => linkDoSinal(false)} className={`${btn} border-white/15 text-g-muted`}>{t("doDeposit")}</button>
            </>)}
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-g-muted">{t("note")}</label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} placeholder={t("notePh")}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] p-2 text-sm text-g-word placeholder:text-g-muted" />
            <button disabled={ocupado || nota === (a.note || "")} onClick={async () => { setOcupado(true); await agir({ action: "note", id: a.id, note: nota }, t("saved")); setOcupado(false); }}
              className="mt-2 rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word disabled:opacity-40">{t("saveNote")}</button>
          </div>
        </div>
      )}
    </Drawer>
  );
}

const campo = "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-g-word placeholder:text-g-muted [color-scheme:dark]";
const horarios = (() => { const h = []; for (let m = 6 * 60; m <= 22 * 60; m += PASSO) h.push(m); return h; })();

function NovoAgendamento({ base, dia, tz, loc, pros, todos = [], services, regras = [], doDia = [], onClose, agir }) {
  // desk_v10: a duração mostrada é a DA PROFISSIONAL para o serviço (se ela tiver a sua), senão a do serviço.
  const durEf = (s, proId) => regras.find((r) => r.pro_id === proId && r.service_id === s.id)?.duration_min ?? s.duration_min;
  const pro = pros.find((p) => p.id === base.pro_id);
  // Adicionais não se marcam sozinhos: ficam fora da lista de serviços e entram como caixas abaixo dela (desk_v11).
  const lista = services.filter((s) => !s.addon && (!(pro?.services || []).length || pro.services.includes(s.id)));
  const adicionais = services.filter((s) => s.addon);
  const [addSel, setAddSel] = useState(() => new Set());
  const minAddons = [...addSel].reduce((n, id) => n + (Number(adicionais.find((s) => s.id === id)?.duration_min) || 0), 0);
  const [svc, setSvc] = useState(lista[0]?.id || "");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [nota, setNota] = useState("");
  const [minuto, setMinuto] = useState(base.minuto);
  const [ocupado, setOcupado] = useState(false);
  const [semanas, setSemanas] = useState(0);   // 0 = só uma vez
  const [vezes, setVezes] = useState(4);
  const [serie, setSerie] = useState(null);    // resultado da série: { marcados, falhas }
  // CASAL / GRUPO: a pessoa 1 são os campos acima; `extras` são as pessoas 2..6. Tudo ou nada no banco (desk_v9).
  const [extras, setExtras] = useState([]);    // [{ nome, contato, mesmoContato, svc, pro_id, minuto }]
  const [falhaGrupo, setFalhaGrupo] = useState(null);   // { index, texto } — qual pessoa não coube e por quê
  const equipe = pros.filter((p) => (p.kind || "staff") === "staff");
  const fazServico = (p, sid) => !(p.services || []).length || p.services.includes(sid);
  const durDe = (sid, proId) => { const s = services.find((x) => x.id === sid); return Number(s ? durEf(s, proId) : 0) || 30; };
  // Ocupada = já tem agendamento (não cancelado) que cruza [ini, ini+dur) nesse dia. Só orienta: quem decide é o motor.
  const ocupadaEm = (proId, ini, dur) => doDia.some((a) => a.pro_id === proId && !["cancelled", "no_show"].includes(a.status)
    && minutoDe(a.start, tz) < ini + dur && minutoDe(a.end, tz) > ini);
  const proSugerida = (sid, ini, jaUsadas) => {
    const cand = equipe.filter((p) => fazServico(p, sid) && !jaUsadas.includes(p.id));
    return (cand.find((p) => !ocupadaEm(p.id, ini, durDe(sid, p.id))) || cand[0] || equipe[0])?.id || "";
  };
  const adicionar = () => {
    setFalhaGrupo(null); setSemanas(0);
    setExtras((xs) => {
      const usadas = [base.pro_id, ...xs.map((x) => x.pro_id)];
      return [...xs, { nome: "", contato: "", mesmoContato: true, svc, pro_id: proSugerida(svc, minuto, usadas), minuto }];
    });
  };
  const mudarExtra = (i, campo, valor) => { setFalhaGrupo(null); setExtras((xs) => xs.map((x, j) => (j === i ? { ...x, [campo]: valor } : x))); };
  const tirarExtra = (i) => { setFalhaGrupo(null); setExtras((xs) => xs.filter((_, j) => j !== i)); };
  const total = extras.length + 1;
  // Serviço que exige sala/equipamento (config.recursos): só para a recepção saber; quem escolhe a sala é o motor.
  const salasDoServico = ((services.find((s) => s.id === svc) || {}).recursos || []).map((id) => todos.find((p) => p.id === id)?.name).filter(Boolean);
  const marcarGrupo = async () => {
    const semNome = extras.findIndex((x) => !x.nome.trim());
    if (semNome >= 0) { setFalhaGrupo({ index: semNome + 2, texto: t("needName") }); return; }
    setOcupado(true); setFalhaGrupo(null);
    const items = [{ pro_id: base.pro_id, service_id: svc, start: paraUtc(dia, minuto, tz).toISOString(), name: nome.trim(), contact: contato.trim(), ...(nota.trim() ? { note: nota.trim() } : {}), ...(addSel.size ? { addons: [...addSel] } : {}) },
      ...extras.map((x) => ({ pro_id: x.pro_id, service_id: x.svc, start: paraUtc(dia, x.minuto, tz).toISOString(), name: x.nome.trim(), contact: (x.mesmoContato ? contato : x.contato).trim() }))];
    const d = await agir({ action: "book_group", location_id: loc?.id, items, lang: lang() }, total === 2 ? t("coupleOk") : tv("groupOk", { n: total }));
    setOcupado(false);
    if (d?.ok) { onClose(); return; }
    if (d?.index) {
      const quem = items[d.index - 1] || {};
      const m = d.reason === "slot_taken" ? tv("proBusy", { p: pros.find((p) => p.id === quem.pro_id)?.name || "" })
        : d.reason === "resource_unavailable" ? t("resourceBusy") : motivo(d);
      setFalhaGrupo({ index: d.index, texto: tv("groupFailWho", { n: d.index, nome: quem.name || "", m }) });
    }
  };
  const marcar = async () => {
    if (!nome.trim()) { toast(t("needName")); return; }
    if (extras.length) { marcarGrupo(); return; }
    setOcupado(true);
    const corpo = { action: "book", pro_id: base.pro_id, location_id: loc?.id, service_id: svc, name: nome.trim(), contact: contato.trim(), start: paraUtc(dia, minuto, tz).toISOString(), note: nota.trim(), ...(addSel.size ? { addons: [...addSel] } : {}), ...(semanas ? { repeat: { every_weeks: semanas, count: vezes } } : {}) };
    const d = await agir(corpo, semanas ? null : t("bookedOk"));
    setOcupado(false);
    if (semanas && d?.serie) {
      const n = (d.marcados || []).length;
      toast(t("seriesOk").replace("{a}", n).replace("{b}", vezes));
      if ((d.falhas || []).length) { setSerie(d); return; }   // mostra quais datas não deram
    }
    if (d?.ok) onClose();
  };
  // Mudou a hora da pessoa 1: quem estava "lado a lado" (mesma hora) vai junto; quem tinha hora própria fica.
  const mudarMinuto1 = (m) => { setExtras((xs) => xs.map((x) => (x.minuto === minuto ? { ...x, minuto: m } : x))); setMinuto(m); setFalhaGrupo(null); };
  const rotulo = "block text-[10px] uppercase tracking-wide text-g-muted";
  return (
    <Drawer title={t("newBooking")} subtitle={`${t("with")} ${pro?.name || ""}`} onClose={onClose}
      actions={<button disabled={ocupado || !svc} onClick={marcar} className="rounded-full bg-g-green px-4 py-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm font-extrabold text-[#161512] disabled:opacity-40">{extras.length ? tv("bookN", { n: total }) : t("book")}</button>}>
      <div className="space-y-3">
        {extras.length > 0 && <div className="text-xs font-bold text-g-word">{tv("personN", { n: 1 })} · {pro?.name || ""}</div>}
        <label className={rotulo}>{t("time")}
          <select value={minuto} onChange={(e) => mudarMinuto1(Number(e.target.value))} className={campo}>{horarios.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select>
        </label>
        <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("service")}
          <select value={svc} onChange={(e) => setSvc(e.target.value)} className={campo}>
            {lista.map((s) => <option key={s.id} value={s.id}>{s.name} · {durEf(s, base.pro_id)} {t("min")} · {dinheiro(s.price_cents, tz, { zeroTraco: true, casas: 0 })}</option>)}
          </select>
          {salasDoServico.length > 0 && <span className="mt-1 block text-[11px] normal-case tracking-normal text-g-muted">{t("usesRoom")}: {salasDoServico.join(" / ")} — {t("usesRoomHint")}</span>}
        </label>
        {adicionais.length > 0 && (
          <div className={rotulo}>{t("addons")}
            <div className="mt-1 rounded-xl border border-white/10 divide-y divide-white/[0.06]">
              {adicionais.map((s) => (
                <label key={s.id} className="flex min-h-[40px] items-center gap-2 px-3 text-sm text-g-word normal-case tracking-normal cursor-pointer">
                  <input type="checkbox" checked={addSel.has(s.id)} onChange={() => setAddSel((x) => { const n = new Set(x); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} className="h-4 w-4 accent-[rgb(var(--g-green))]" />
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-g-muted">+{s.duration_min} {t("min")} · {dinheiro(s.price_cents, tz, { zeroTraco: true })}</span>
                </label>
              ))}
            </div>
            {addSel.size > 0 && <span className="mt-1 block text-[11px] normal-case tracking-normal text-g-muted">{t("totalTime")}: {durEf(services.find((s) => s.id === svc) || { duration_min: 0 }, base.pro_id)} + {minAddons} = {Number(durEf(services.find((s) => s.id === svc) || { duration_min: 0 }, base.pro_id)) + minAddons} {t("min")}</span>}
          </div>
        )}
        <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("client")}<input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} autoFocus /></label>
        <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("phone")}<input value={contato} onChange={(e) => setContato(e.target.value)} className={campo} inputMode="tel" /></label>
        <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("note")}<textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder={t("notePh")} className={campo} /></label>

        {/* PESSOAS 2..6 — cada uma com serviço, profissional e hora próprios. A borda vermelha marca quem não coube. */}
        {extras.map((x, i) => {
          const n = i + 2; const errou = falhaGrupo?.index === n;
          const opcoesPro = equipe.filter((p) => fazServico(p, x.svc));
          return (
            <div key={i} className={`rounded-xl border p-3 space-y-2 ${errou ? "border-red-400/50 bg-red-400/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-g-word">{tv("personN", { n })}</span>
                <button type="button" onClick={() => tirarExtra(i)} aria-label={tv("removePerson", { n })} title={tv("removePerson", { n })}
                  className="h-10 w-10 -mr-2 rounded-full text-g-muted hover:text-g-word hover:bg-white/[0.06]">✕</button>
              </div>
              <label className={rotulo}>{t("personName")}<input value={x.nome} onChange={(e) => mudarExtra(i, "nome", e.target.value)} className={campo} autoFocus={i === extras.length - 1} /></label>
              <label className="flex min-h-[40px] items-center gap-2 text-xs text-g-word">
                <input type="checkbox" checked={x.mesmoContato} onChange={(e) => mudarExtra(i, "mesmoContato", e.target.checked)} className="h-4 w-4 accent-[rgb(var(--g-green))]" />{t("sameContact")}
              </label>
              {!x.mesmoContato && <label className={rotulo}>{t("phone")}<input value={x.contato} onChange={(e) => mudarExtra(i, "contato", e.target.value)} className={campo} inputMode="tel" /></label>}
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={rotulo}>{t("service")}
                  <select value={x.svc} onChange={(e) => { const sid = e.target.value; mudarExtra(i, "svc", sid); const atual = equipe.find((p) => p.id === x.pro_id); if (!atual || !fazServico(atual, sid)) mudarExtra(i, "pro_id", proSugerida(sid, x.minuto, [base.pro_id])); }} className={campo}>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {durEf(s, x.pro_id)} {t("min")}</option>)}
                  </select>
                </label>
                <label className={rotulo}>{t("pickPro")}
                  <select value={x.pro_id} onChange={(e) => mudarExtra(i, "pro_id", e.target.value)} className={campo}>
                    {opcoesPro.map((p) => <option key={p.id} value={p.id}>{p.name}{ocupadaEm(p.id, x.minuto, durDe(x.svc, p.id)) ? ` · ${t("proBusyOpt")}` : ""}</option>)}
                  </select>
                </label>
              </div>
              <label className={rotulo}>{t("time")}
                <select value={x.minuto} onChange={(e) => mudarExtra(i, "minuto", Number(e.target.value))} className={campo}>{horarios.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select>
                {x.minuto === minuto && <span className="mt-1 block text-[11px] normal-case tracking-normal text-g-muted">{t("sideBySide")}</span>}
              </label>
            </div>
          );
        })}
        {/* O aviso fica colado nas pessoas (logo abaixo de quem não coube), antes do botão de adicionar. */}
        {falhaGrupo && (
          <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/[0.06] p-3 text-xs text-red-200">
            <div className="font-bold">{t("groupFail")}</div>
            <div>{falhaGrupo.texto}</div>
          </div>
        )}
        {total < 6 && (
          <div>
            <button type="button" onClick={adicionar} disabled={ocupado}
              className="w-full min-h-[44px] rounded-xl border border-dashed border-white/20 px-3 py-2 text-sm font-bold text-g-word hover:bg-white/[0.04] disabled:opacity-40">{t("addPerson")}</button>
            {extras.length === 0 && <p className="mt-1 text-[11px] text-g-muted">{t("addPersonHint")}</p>}
          </div>
        )}

        {extras.length > 0 ? <p className="text-[11px] text-g-muted">{t("groupNoRepeat")}</p> : (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("repeat")}
            <select value={semanas} onChange={(e) => setSemanas(Number(e.target.value))} className={campo}>
              <option value={0}>{t("repeatNo")}</option>
              {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{t("everyW").replace("{n}", n)}</option>)}
            </select>
          </label>
          {semanas > 0 && (
            <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("times")}
              <select value={vezes} onChange={(e) => setVezes(Number(e.target.value))} className={campo}>{[2, 3, 4, 6, 8, 10, 12, 26].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </label>
          )}
        </div>
        )}
        {serie && (serie.falhas || []).length > 0 && (
          <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/[0.06] p-3 text-xs text-red-200">
            <div className="font-bold mb-1">{t("seriesFail")}</div>
            {serie.falhas.map((f, i) => <div key={i}>{new Date(f.start).toLocaleString(localeAtual(), { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{f.motivo || f.reason ? ` · ${f.reason === "resource_unavailable" ? t("resourceBusy") : (f.motivo || f.reason)}` : ""}</div>)}
          </div>
        )}
      </div>
    </Drawer>
  );
}

// ── ALGUÉM FALTOU (slide 24 da apresentação): as clientes dela e quem cobre cada horário ─────
function FaltaDaProfissional({ inicial = "", dia, tz, loc, pros, conectado, amostra, email, dataKey, onClose, agir, recarregar }) {
  const [pro, setPro] = useState(pros.some((p) => p.id === inicial) ? inicial : pros[0]?.id || "");
  const [data, setData] = useState(dia);
  const [plano, setPlano] = useState(null);       // null = lendo
  const [feito, setFeito] = useState({});         // id → { estado, texto }
  const [ocupado, setOcupado] = useState("");
  const nomeDela = pros.find((p) => p.id === pro)?.name || "";
  useEffect(() => {
    let vivo = true;
    if (!pro) return () => { vivo = false; };
    if (!conectado) {   // demonstração: as clientes de exemplo dela, e as outras profissionais como cobertura
      const outras = pros.filter((p) => p.id !== pro).map((p) => ({ pro_id: p.id, name: p.name }));
      const itens = (amostra?.appointments || []).filter((a) => a.pro_id === pro && !["blocked", "cancelled", "no_show", "completed"].includes(a.status) && diaDe(new Date(a.start), tz) === data)
        .map((a, i) => ({ id: a.id, start: a.start, customer_name: a.customer_name, service: (amostra.services || []).find((s) => s.id === a.service_id)?.name || "", cover: i % 3 === 2 ? [] : outras.slice(0, 2) }));
      setPlano({ ok: true, items: itens }); return () => { vivo = false; };
    }
    setPlano(null); setFeito({});
    chamarDesk(email, dataKey, { action: "absence_plan", pro_id: pro, from: paraUtc(data, 0, tz).toISOString(), to: paraUtc(somaDias(data, 1), 0, tz).toISOString() })
      .then(({ d }) => { if (vivo) setPlano(d?.ok ? d : { ok: false }); });
    return () => { vivo = false; };
  }, [pro, data, tz, conectado, amostra, pros, email, dataKey]);
  const avisar = async (it, mode) => {
    const { d } = await chamarDesk(email, dataKey, { action: "absence_notify", id: it.id, mode, absent_name: nomeDela, lang: lang() });
    return d?.ok ? { estado: "ok", texto: t("told") } : { estado: "falhou", texto: `${d?.motivo === "sem_email" || d?.motivo === "email_off" ? t("callHer") : t("notTold")}${d?.telefone ? ` · ${d.telefone}` : ""}` };
  };
  const passar = async (it, cover) => {
    setOcupado(it.id);
    const m = await agir({ action: "move", id: it.id, start: it.start, pro_id: cover.pro_id }, null);
    const r = m?.ok ? await avisar(it, "covered") : { estado: "falhou", texto: motivo(m) };
    setFeito((f) => ({ ...f, [it.id]: { ...r, cover: m?.ok ? cover.name : null } })); setOcupado("");
  };
  const remarcar = async (it) => { setOcupado(it.id); const r = await avisar(it, "reschedule"); setFeito((f) => ({ ...f, [it.id]: r })); setOcupado(""); };
  const bloquearDia = async () => {
    const d = await agir({ action: "block", pro_id: pro, location_id: loc?.id, start: paraUtc(data, 0, tz).toISOString(), end: paraUtc(somaDias(data, 1), 0, tz).toISOString(), reason: t("r_off") }, t("blockedOk"));
    if (d?.ok) { recarregar(); onClose(); }
  };
  const btn = "rounded-full px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold border disabled:opacity-40";
  return (
    <Drawer title={`🤒 ${t("absence")}`} subtitle={t("absenceSub")} onClose={onClose}
      actions={<button onClick={bloquearDia} disabled={!pro || !plano?.ok} className={`${btn} border-white/20 text-g-word`} title={t("blockHerDayHelp")}>{t("blockHerDay")}</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <select value={pro} onChange={(e) => setPro(e.target.value)} className={campo}>{pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className={campo} />
        </div>
        {plano === null ? <SectionSkeleton rows={3} /> : !plano.ok ? <div role="alert" className="text-xs text-red-300">{t("readFail")}</div>
          : plano.items.length === 0 ? <p className="text-sm text-g-muted">{t("absenceNone")}</p> : plano.items.map((it) => {
          const f = feito[it.id];
          return (
            <div key={it.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm font-bold text-g-word truncate">{hhmm(minutoDe(it.start, tz))} · {it.customer_name || "—"}</div>
                <div className="text-[11px] text-g-muted truncate">{it.service}</div>
              </div>
              {f ? (
                <div className={`mt-2 text-xs font-bold ${f.estado === "ok" ? "text-g-green" : "text-red-300"}`}>{f.cover ? `→ ${f.cover} · ` : ""}{f.texto}</div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {it.cover.length === 0 && <span className="text-[11px] text-g-muted self-center">{t("noCover")}</span>}
                  {it.cover.slice(0, 3).map((c) => <button key={c.pro_id} disabled={!!ocupado} onClick={() => passar(it, c)} className={`${btn} border-g-green/40 text-g-green`}>{t("passTo").replace("{n}", c.name)}</button>)}
                  <button disabled={!!ocupado} onClick={() => remarcar(it)} className={`${btn} border-white/15 text-g-word`}>{t("askResched")}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

function NovoBloqueio({ base, dia, tz, loc, pros, onClose, agir }) {
  const [pro, setPro] = useState(base.pro_id || pros[0]?.id || "");
  const [data, setData] = useState(dia);
  const [diaTodo, setDiaTodo] = useState(false);
  const [ini, setIni] = useState(12 * 60);
  const [fim, setFim] = useState(13 * 60);
  const [motivoTxt, setMotivoTxt] = useState(t("r_lunch"));
  const [ocupado, setOcupado] = useState(false);
  const [choques, setChoques] = useState(null);
  const bloquear = async () => {
    setOcupado(true); setChoques(null);
    const de = diaTodo ? 0 : ini; const ate = diaTodo ? 24 * 60 : fim;
    const d = await agir({ action: "block", pro_id: pro, location_id: loc?.id, start: paraUtc(data, de, tz).toISOString(), end: diaTodo ? paraUtc(somaDias(data, 1), 0, tz).toISOString() : paraUtc(data, ate, tz).toISOString(), reason: motivoTxt }, t("blockedOk"));
    setOcupado(false);
    if (d?.ok) onClose(); else if (Array.isArray(d?.conflicts)) setChoques(d.conflicts);
  };
  return (
    <Drawer title={t("blockTime")} onClose={onClose}
      actions={<button disabled={ocupado || !pro || (!diaTodo && fim <= ini)} onClick={bloquear} className="rounded-full bg-g-green px-4 py-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm font-extrabold text-[#161512] disabled:opacity-40">{t("block")}</button>}>
      <div className="space-y-3">
        <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("pickPro")}
          <select value={pro} onChange={(e) => setPro(e.target.value)} className={campo}>{pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("date")}<input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className={campo} /></label>
        <label className="flex items-center gap-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs text-g-word"><input type="checkbox" checked={diaTodo} onChange={(e) => setDiaTodo(e.target.checked)} />{t("allDay")}</label>
        {!diaTodo && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("from")}<select value={ini} onChange={(e) => setIni(Number(e.target.value))} className={campo}>{horarios.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select></label>
            <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("to")}<select value={fim} onChange={(e) => setFim(Number(e.target.value))} className={campo}>{horarios.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}</select></label>
          </div>
        )}
        <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("reason")}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {["r_off", "r_lunch", "r_training", "r_vac"].map((k) => (
              <button key={k} type="button" onClick={() => setMotivoTxt(t(k))} className={`rounded-full border px-2.5 py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs ${motivoTxt === t(k) ? "border-g-green/50 text-g-word" : "border-white/10 text-g-muted"}`}>{t(k)}</button>
            ))}
          </div>
          <input value={motivoTxt} onChange={(e) => setMotivoTxt(e.target.value)} className={campo} />
        </label>
        {choques && choques.length > 0 && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/[0.06] p-3 text-xs text-red-200">
            <div className="font-bold mb-1">{t("conflicts")}</div>
            {choques.map((c) => <div key={c.id}>{hhmm(minutoDe(c.start, tz))} · {c.name}</div>)}
          </div>
        )}
      </div>
    </Drawer>
  );
}
