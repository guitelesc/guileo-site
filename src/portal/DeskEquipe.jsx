/* GUILEO DESK — Equipe, Serviços e Produtos (2026-10-05). O cadastro que a agenda e o caixa leem:
   quem atende (e as salas), em que dias e horas, o que cada uma faz, quanto cada serviço custa,
   e os produtos da prateleira.

   🚨 REGRAS DA CASA QUE ESTA TELA SEGUE
   · Conta conectada NUNCA mostra amostra; sem conexão = amostra DECLARADA e escrita bloqueada.
   · Toda escrita confere `d?.ok === true` antes de dizer "salvo". Sem ok, diz o `motivo()`.
   · Horário é minuto do dia na parede da UNIDADE; folga/bloqueio vira instante pelo fuso dela.
   · Dinheiro em centavos inteiros: o que a pessoa digita passa por `centavos()`.
   · Textos nos 4 idiomas (T abaixo). */
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "../lib/portalApi.js";
import { Card, Drawer, SectionSkeleton } from "../pages/Portal.jsx";
import DeskAcessos from "./DeskAcessos.jsx";
import DeskPonto from "./DeskPonto.jsx";
import { chamarDesk, motivo, dinheiro, centavos, hhmm, tx, lang, loc, paraUtc, diaDe, somaDias, quando } from "./deskApi.js";

// ── textos ───────────────────────────────────────────────────────────────────────────────────
const T = {
  tabTeam: { en: "Team", pt: "Equipe", es: "Equipo", hi: "टीम" },
  tabServices: { en: "Services", pt: "Serviços", es: "Servicios", hi: "सेवाएँ" },
  tabProducts: { en: "Products", pt: "Produtos", es: "Productos", hi: "उत्पाद" },
  sample: { en: "Sample data — connect your account to edit your real team, services and products.", pt: "Dados de exemplo — conecte a sua conta para editar a sua equipe, serviços e produtos de verdade.", es: "Datos de ejemplo — conecta tu cuenta para editar tu equipo, servicios y productos reales.", hi: "नमूना डेटा — अपनी असली टीम, सेवाएँ और उत्पाद बदलने के लिए खाता जोड़ें।" },
  sampleBlocked: { en: "This is sample data. Connect your account to save.", pt: "Isto é uma amostra. Conecte a sua conta para salvar.", es: "Son datos de ejemplo. Conecta tu cuenta para guardar.", hi: "यह नमूना है। सेव करने के लिए खाता जोड़ें।" },
  readFail: { en: "I couldn't read your team.", pt: "Não consegui ler a sua equipe.", es: "No pude leer tu equipo.", hi: "आपकी टीम नहीं पढ़ पाया।" },
  readFailProducts: { en: "I couldn't read your products.", pt: "Não consegui ler os seus produtos.", es: "No pude leer tus productos.", hi: "आपके उत्पाद नहीं पढ़ पाया।" },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Intentar de nuevo", hi: "फिर कोशिश करें" },
  saved: { en: "Saved", pt: "Salvo", es: "Guardado", hi: "सेव हुआ" },
  save: { en: "Save", pt: "Salvar", es: "Guardar", hi: "सेव करें" },
  saving: { en: "Saving…", pt: "Salvando…", es: "Guardando…", hi: "सेव हो रहा है…" },
  edit: { en: "Edit", pt: "Editar", es: "Editar", hi: "बदलें" },
  needName: { en: "Write a name.", pt: "Escreva um nome.", es: "Escribe un nombre.", hi: "नाम लिखें।" },
  inactiveHint: { en: "Turning this off hides it from the agenda, online booking and checkout.", pt: "Desligar esconde da agenda, do agendamento online e do caixa.", es: "Apagarlo lo oculta de la agenda, la reserva en línea y la caja.", hi: "बंद करने पर यह एजेंडा, ऑनलाइन बुकिंग और चेकआउट से छिप जाएगा।" },
  active: { en: "Active", pt: "Ativo", es: "Activo", hi: "सक्रिय" },
  name: { en: "Name", pt: "Nome", es: "Nombre", hi: "नाम" },
  min: { en: "min", pt: "min", es: "min", hi: "मिनट" },
  // equipe
  pros: { en: "Professionals", pt: "Profissionais", es: "Profesionales", hi: "प्रोफ़ेशनल" },
  rooms: { en: "Rooms & equipment", pt: "Salas e equipamentos", es: "Salas y equipos", hi: "कमरे और उपकरण" },
  roomsHint: { en: "A treatment room or machine that can only be in one booking at a time. Say which services need it in the Services tab.", pt: "Uma sala ou aparelho que só pode estar em um atendimento por vez. Diga quais serviços precisam dela na aba Serviços.", es: "Una sala o equipo que solo puede estar en una reserva a la vez. Indica qué servicios la necesitan en la pestaña Servicios.", hi: "एक कमरा या मशीन जो एक समय में एक ही बुकिंग में हो सकती है। सेवाएँ टैब में बताएँ कि किन सेवाओं को इसकी ज़रूरत है।" },
  addPro: { en: "+ Add professional", pt: "+ Adicionar profissional", es: "+ Agregar profesional", hi: "+ प्रोफ़ेशनल जोड़ें" },
  addRoom: { en: "+ Add room or equipment", pt: "+ Adicionar sala ou equipamento", es: "+ Agregar sala o equipo", hi: "+ कमरा या उपकरण जोड़ें" },
  noPros: { en: "No professionals yet. Add the first one to start booking.", pt: "Ainda não há profissionais. Adicione a primeira para começar a marcar.", es: "Aún no hay profesionales. Agrega la primera para empezar a reservar.", hi: "अभी कोई प्रोफ़ेशनल नहीं है। बुकिंग शुरू करने के लिए पहला जोड़ें।" },
  noRooms: { en: "No rooms or equipment yet.", pt: "Nenhuma sala ou equipamento ainda.", es: "Aún no hay salas ni equipos.", hi: "अभी कोई कमरा या उपकरण नहीं।" },
  newPro: { en: "New professional", pt: "Nova profissional", es: "Nueva profesional", hi: "नया प्रोफ़ेशनल" },
  newRoom: { en: "New room or equipment", pt: "Nova sala ou equipamento", es: "Nueva sala o equipo", hi: "नया कमरा या उपकरण" },
  roomDesc: { en: "Description", pt: "Descrição", es: "Descripción", hi: "विवरण" },
  roomTitlePh: { en: "e.g. Massage room, Laser machine", pt: "ex.: Sala de massagem, Máquina de laser", es: "ej.: Sala de masajes, Máquina láser", hi: "जैसे: मसाज रूम, लेज़र मशीन" },
  roomLocHint: { en: "None checked = can be used at every location.", pt: "Nenhuma marcada = pode ser usada em todas as unidades.", es: "Ninguna marcada = se puede usar en todas las sedes.", hi: "कोई नहीं चुना = हर लोकेशन पर इस्तेमाल हो सकता है।" },
  usedBy: { en: "Needed by", pt: "Usada por", es: "La usan", hi: "इन सेवाओं में ज़रूरी" },
  usedByNone: { en: "No service needs it yet — set it in the Services tab.", pt: "Nenhum serviço precisa dela ainda — marque na aba Serviços.", es: "Ningún servicio la necesita aún — márcalo en la pestaña Servicios.", hi: "अभी किसी सेवा को इसकी ज़रूरत नहीं — सेवाएँ टैब में चुनें।" },
  roomOffWarn: { en: "Turning it off: these services can only be booked while another of their rooms is free.", pt: "Desligando: esses serviços só poderão ser marcados quando outra sala deles estiver livre.", es: "Al apagarla: esos servicios solo se podrán reservar cuando otra de sus salas esté libre.", hi: "बंद करने पर: ये सेवाएँ तभी बुक होंगी जब उनका कोई दूसरा कमरा खाली हो।" },
  needsRoom: { en: "Needs a room / equipment", pt: "Precisa de sala / equipamento", es: "Necesita sala / equipo", hi: "कमरा / उपकरण चाहिए" },
  needsRoomHint: { en: "None checked = doesn't need one. More than one = any free one works (the first on the list is used first).", pt: "Nenhuma marcada = não precisa. Mais de uma = serve qualquer uma livre (a primeira da lista vai primeiro).", es: "Ninguna marcada = no necesita. Más de una = sirve cualquiera libre (la primera de la lista va primero).", hi: "कोई नहीं चुना = ज़रूरत नहीं। एक से ज़्यादा = कोई भी खाली चलेगा (सूची का पहला पहले)।" },
  noRoomsYet: { en: "No rooms or equipment yet — add them in the Team tab.", pt: "Ainda não há salas ou equipamentos — cadastre na aba Equipe.", es: "Aún no hay salas ni equipos — agrégalos en la pestaña Equipo.", hi: "अभी कोई कमरा या उपकरण नहीं — टीम टैब में जोड़ें।" },
  title: { en: "Title", pt: "Cargo", es: "Cargo", hi: "पद" },
  titlePh: { en: "e.g. Massage therapist", pt: "ex.: Massoterapeuta", es: "ej.: Masajista", hi: "जैसे: मसाज थेरेपिस्ट" },
  kind: { en: "Type", pt: "Tipo", es: "Tipo", hi: "प्रकार" },
  kindStaff: { en: "Person", pt: "Pessoa", es: "Persona", hi: "व्यक्ति" },
  kindRoom: { en: "Room / equipment", pt: "Sala / equipamento", es: "Sala / equipo", hi: "कमरा / उपकरण" },
  color: { en: "Color on the agenda", pt: "Cor na agenda", es: "Color en la agenda", hi: "एजेंडा में रंग" },
  commSvc: { en: "Commission on services (%)", pt: "Comissão em serviços (%)", es: "Comisión en servicios (%)", hi: "सेवाओं पर कमीशन (%)" },
  commProd: { en: "Commission on products (%)", pt: "Comissão em produtos (%)", es: "Comisión en productos (%)", hi: "उत्पादों पर कमीशन (%)" },
  commBad: { en: "Commission must be between 0 and 100.", pt: "A comissão tem que ficar entre 0 e 100.", es: "La comisión debe estar entre 0 y 100.", hi: "कमीशन 0 से 100 के बीच होना चाहिए।" },
  performs: { en: "Services they perform", pt: "Serviços que faz", es: "Servicios que realiza", hi: "कौन-सी सेवाएँ करते हैं" },
  performsHint: { en: "None checked = can be booked for any service.", pt: "Nenhum marcado = pode ser agendada para qualquer serviço.", es: "Ninguno marcado = se puede reservar para cualquier servicio.", hi: "कोई नहीं चुना = किसी भी सेवा के लिए बुक हो सकते हैं।" },
  // profissional × serviço (desk_v10): duração, preparo, limpeza e pagamento DELA neste serviço
  rulesHint: { en: "Each checked service can have her own duration, prep and cleanup time, and pay. Empty = the service's default and her general commission.", pt: "Cada serviço marcado pode ter a duração, o preparo, a limpeza e o pagamento dela. Vazio = o padrão do serviço e a comissão geral dela.", es: "Cada servicio marcado puede tener su propia duración, preparación, limpieza y pago. Vacío = el estándar del servicio y su comisión general.", hi: "हर चुनी सेवा की उसकी अपनी अवधि, तैयारी, सफ़ाई और भुगतान हो सकता है। खाली = सेवा का डिफ़ॉल्ट और उसका सामान्य कमीशन।" },
  adjust: { en: "Adjust", pt: "Ajustar", es: "Ajustar", hi: "बदलें" },
  done: { en: "Done", pt: "Pronto", es: "Listo", hi: "हो गया" },
  ruleDur: { en: "Duration (min)", pt: "Duração (min)", es: "Duración (min)", hi: "अवधि (मिनट)" },
  rulePrep: { en: "Prep (min)", pt: "Preparo (min)", es: "Preparación (min)", hi: "तैयारी (मिनट)" },
  ruleFinish: { en: "Cleanup (min)", pt: "Limpeza (min)", es: "Limpieza (min)", hi: "सफ़ाई (मिनट)" },
  rulePay: { en: "Pay for this service", pt: "Pagamento neste serviço", es: "Pago en este servicio", hi: "इस सेवा का भुगतान" },
  payGeneral: { en: "General commission ({p}%)", pt: "Comissão geral ({p}%)", es: "Comisión general ({p}%)", hi: "सामान्य कमीशन ({p}%)" },
  payPct: { en: "Own percentage", pt: "Percentual próprio", es: "Porcentaje propio", hi: "अपना प्रतिशत" },
  payFlat: { en: "Fixed amount per service", pt: "Valor fixo por atendimento", es: "Monto fijo por servicio", hi: "प्रति सेवा निश्चित राशि" },
  payNone: { en: "No pay", pt: "Não paga", es: "Sin pago", hi: "कोई भुगतान नहीं" },
  pctLabel: { en: "Percentage", pt: "Percentual", es: "Porcentaje", hi: "प्रतिशत" },
  amountLabel: { en: "Amount", pt: "Valor", es: "Monto", hi: "राशि" },
  prepFinishShort: { en: "prep {a} · cleanup {b}", pt: "preparo {a} · limpeza {b}", es: "prep. {a} · limpieza {b}", hi: "तैयारी {a} · सफ़ाई {b}" },
  asService: { en: "as the service", pt: "como o serviço", es: "como el servicio", hi: "सेवा जैसा" },
  ownRules: { en: "own rules", pt: "regras próprias", es: "reglas propias", hi: "अपने नियम" },
  ownRule: { en: "own rule", pt: "regra própria", es: "regla propia", hi: "अपना नियम" },
  ruleBad: { en: "Check “{s}”: duration from 5 min, prep and cleanup from 0, percentage 0–100, amount 0 or more.", pt: "Confira “{s}”: duração a partir de 5 min, preparo e limpeza a partir de 0, percentual de 0 a 100, valor 0 ou mais.", es: "Revisa “{s}”: duración desde 5 min, preparación y limpieza desde 0, porcentaje 0–100, monto 0 o más.", hi: "“{s}” जाँचें: अवधि 5 मिनट से, तैयारी/सफ़ाई 0 से, प्रतिशत 0–100, राशि 0 या अधिक।" },
  worksAt: { en: "Locations", pt: "Unidades", es: "Sedes", hi: "लोकेशन" },
  worksAtHint: { en: "None checked = works at every location.", pt: "Nenhuma marcada = atende em todas as unidades.", es: "Ninguna marcada = atiende en todas las sedes.", hi: "कोई नहीं चुना = हर लोकेशन पर काम करते हैं।" },
  noServicesYet: { en: "No services yet — add them in the Services tab.", pt: "Ainda não há serviços — cadastre na aba Serviços.", es: "Aún no hay servicios — agrégalos en la pestaña Servicios.", hi: "अभी कोई सेवा नहीं — सेवाएँ टैब में जोड़ें।" },
  nServices: { en: "services", pt: "serviços", es: "servicios", hi: "सेवाएँ" },
  allServices: { en: "all services", pt: "todos os serviços", es: "todos los servicios", hi: "सभी सेवाएँ" },
  noHours: { en: "No weekly hours yet", pt: "Sem horário semanal", es: "Sin horario semanal", hi: "अभी साप्ताहिक समय नहीं" },
  hours: { en: "Hours", pt: "Horário", es: "Horario", hi: "समय" },
  timeOff: { en: "Time off", pt: "Folga / bloqueio", es: "Libre / bloqueo", hi: "छुट्टी / ब्लॉक" },
  createdSetHours: { en: "Saved — now set the weekly hours.", pt: "Salvo — agora defina o horário da semana.", es: "Guardado — ahora define el horario semanal.", hi: "सेव हुआ — अब साप्ताहिक समय तय करें।" },
  // horário
  hoursTitle: { en: "Weekly hours", pt: "Horário da semana", es: "Horario semanal", hi: "साप्ताहिक समय" },
  hoursSub: { en: "Two ranges on the same day = a break between them (lunch).", pt: "Duas faixas no mesmo dia = pausa entre elas (almoço).", es: "Dos franjas el mismo día = pausa entre ellas (almuerzo).", hi: "एक दिन में दो समय-सीमा = बीच में ब्रेक (लंच)।" },
  location: { en: "Location", pt: "Unidade", es: "Sede", hi: "लोकेशन" },
  noLocations: { en: "Add a location first (Locations screen) — hours belong to a location.", pt: "Cadastre uma unidade primeiro (tela Unidades) — o horário pertence a uma unidade.", es: "Agrega una sede primero (pantalla Sedes) — el horario pertenece a una sede.", hi: "पहले एक लोकेशन जोड़ें — समय किसी लोकेशन का होता है।" },
  closedDay: { en: "Off", pt: "Folga", es: "Libre", hi: "छुट्टी" },
  addBreak: { en: "+ break", pt: "+ pausa", es: "+ pausa", hi: "+ ब्रेक" },
  removeBreak: { en: "Remove second range", pt: "Tirar a segunda faixa", es: "Quitar la segunda franja", hi: "दूसरी समय-सीमा हटाएँ" },
  copyMon: { en: "Copy Monday to Tue–Fri", pt: "Copiar segunda para ter–sex", es: "Copiar lunes a mar–vie", hi: "सोमवार को मंगल–शुक्र पर कॉपी करें" },
  badHours: { en: "Check the hours: each end must be after its start, and the second range must start after the first ends.", pt: "Confira os horários: cada fim tem que ser depois do início, e a segunda faixa tem que começar depois que a primeira acaba.", es: "Revisa los horarios: cada fin debe ser después de su inicio, y la segunda franja debe empezar después de que termine la primera.", hi: "समय जाँचें: हर अंत शुरुआत के बाद हो, और दूसरी सीमा पहली के खत्म होने के बाद शुरू हो।" },
  saveHours: { en: "Save hours", pt: "Salvar horário", es: "Guardar horario", hi: "समय सेव करें" },
  // folga
  blockTitle: { en: "Time off / block", pt: "Folga / bloqueio", es: "Libre / bloqueo", hi: "छुट्टी / ब्लॉक" },
  blockSub: { en: "Blocks the agenda so nobody (front desk or AI) books over it.", pt: "Trava a agenda para ninguém (balcão ou IA) marcar por cima.", es: "Bloquea la agenda para que nadie (recepción o IA) reserve encima.", hi: "एजेंडा ब्लॉक करता है ताकि कोई (डेस्क या AI) उस समय बुक न करे।" },
  fromDay: { en: "From", pt: "De", es: "Desde", hi: "से" },
  toDay: { en: "To (same day = one day)", pt: "Até (mesmo dia = um dia só)", es: "Hasta (mismo día = un solo día)", hi: "तक (वही दिन = एक दिन)" },
  allDay: { en: "All day", pt: "Dia inteiro", es: "Todo el día", hi: "पूरा दिन" },
  start: { en: "Start", pt: "Início", es: "Inicio", hi: "शुरू" },
  end: { en: "End", pt: "Fim", es: "Fin", hi: "अंत" },
  reason: { en: "Reason", pt: "Motivo", es: "Motivo", hi: "कारण" },
  r_dayoff: { en: "Day off", pt: "Folga", es: "Día libre", hi: "छुट्टी" },
  r_lunch: { en: "Lunch", pt: "Almoço", es: "Almuerzo", hi: "लंच" },
  r_training: { en: "Training", pt: "Treinamento", es: "Capacitación", hi: "ट्रेनिंग" },
  r_vacation: { en: "Vacation", pt: "Férias", es: "Vacaciones", hi: "छुट्टियाँ" },
  r_other: { en: "Other", pt: "Outro", es: "Otro", hi: "अन्य" },
  otherPh: { en: "Write the reason", pt: "Escreva o motivo", es: "Escribe el motivo", hi: "कारण लिखें" },
  block: { en: "Block", pt: "Bloquear", es: "Bloquear", hi: "ब्लॉक करें" },
  blocked: { en: "Blocked", pt: "Bloqueado", es: "Bloqueado", hi: "ब्लॉक हुआ" },
  badRange: { en: "The end must be after the start.", pt: "O fim tem que ser depois do início.", es: "El fin debe ser después del inicio.", hi: "अंत शुरुआत के बाद होना चाहिए।" },
  tooLong: { en: "Up to 31 days at a time.", pt: "No máximo 31 dias de uma vez.", es: "Máximo 31 días a la vez.", hi: "एक बार में अधिकतम 31 दिन।" },
  conflictsTitle: { en: "These days were NOT blocked — there are bookings in the way:", pt: "Estes dias NÃO foram bloqueados — há agendamentos no caminho:", es: "Estos días NO se bloquearon — hay reservas en medio:", hi: "ये दिन ब्लॉक नहीं हुए — इन पर बुकिंग है:" },
  conflictsHint: { en: "Move or cancel these bookings on the agenda, then block again.", pt: "Remarque ou cancele esses agendamentos na agenda e bloqueie de novo.", es: "Mueve o cancela esas reservas en la agenda y vuelve a bloquear.", hi: "एजेंडा में इन बुकिंग को बदलें या रद्द करें, फिर दोबारा ब्लॉक करें।" },
  partial: { en: "days blocked", pt: "dias bloqueados", es: "días bloqueados", hi: "दिन ब्लॉक हुए" },
  failedDay: { en: "didn't go through", pt: "não deu certo", es: "no funcionó", hi: "नहीं हुआ" },
  // serviços
  addService: { en: "+ Add service", pt: "+ Adicionar serviço", es: "+ Agregar servicio", hi: "+ सेवा जोड़ें" },
  newService: { en: "New service", pt: "Novo serviço", es: "Nuevo servicio", hi: "नई सेवा" },
  noServices: { en: "No services yet. Add what you sell so the agenda, the AI and checkout can use it.", pt: "Ainda não há serviços. Cadastre o que você vende para a agenda, a IA e o caixa usarem.", es: "Aún no hay servicios. Agrega lo que vendes para que la agenda, la IA y la caja lo usen.", hi: "अभी कोई सेवा नहीं। जो आप बेचते हैं वह जोड़ें ताकि एजेंडा, AI और चेकआउट उसे इस्तेमाल कर सकें।" },
  category: { en: "Category", pt: "Categoria", es: "Categoría", hi: "श्रेणी" },
  categoryPh: { en: "e.g. Massage, Facials", pt: "ex.: Massagem, Facial", es: "ej.: Masajes, Faciales", hi: "जैसे: मसाज, फ़ेशियल" },
  noCategory: { en: "No category", pt: "Sem categoria", es: "Sin categoría", hi: "कोई श्रेणी नहीं" },
  duration: { en: "Duration (min)", pt: "Duração (min)", es: "Duración (min)", hi: "अवधि (मिनट)" },
  // adicionais (desk_v11)
  addonToggle: { en: "This is an add-on", pt: "É um adicional", es: "Es un adicional", hi: "यह ऐड-ऑन है" },
  addonHint: { en: "Sold on top of another service (beard design, aromatherapy, hot-stone upgrade). It can't be booked alone. Duration 0 = only a sale, takes no time.", pt: "Vendido junto com outro serviço (barba, aromaterapia, upgrade de pedra quente). Não se marca sozinho. Duração 0 = só venda, não ocupa tempo.", es: "Se vende junto con otro servicio (barba, aromaterapia, upgrade de piedras calientes). No se reserva solo. Duración 0 = solo venta, no ocupa tiempo.", hi: "किसी और सेवा के साथ बिकता है (दाढ़ी, अरोमाथेरेपी, हॉट-स्टोन अपग्रेड)। अकेले बुक नहीं होता। अवधि 0 = सिर्फ़ बिक्री, समय नहीं लेता।" },
  addonBadge: { en: "add-on", pt: "adicional", es: "adicional", hi: "ऐड-ऑन" },
  // desk_v13: serviço que debita mais de uma sessão de pacote
  pkgSessions: { en: "Package sessions it uses", pt: "Sessões de pacote que debita", es: "Sesiones de paquete que descuenta", hi: "पैकेज के कितने सत्र लेता है" },
  pkgSessionsHint: { en: "1 = one visit, one session (normal). 2 = a longer service counts as two sessions when paid with a package.", pt: "1 = uma visita, uma sessão (normal). 2 = um serviço mais longo conta como duas sessões quando pago com pacote.", es: "1 = una visita, una sesión (normal). 2 = un servicio más largo cuenta como dos sesiones cuando se paga con paquete.", hi: "1 = एक विज़िट, एक सत्र (सामान्य)। 2 = लंबी सेवा पैकेज से भुगतान पर दो सत्र गिनी जाती है।" },
  pkgBad: { en: "Package sessions must be a whole number from 1 to 20.", pt: "As sessões de pacote têm que ser um número inteiro de 1 a 20.", es: "Las sesiones de paquete deben ser un número entero de 1 a 20.", hi: "पैकेज सत्र 1 से 20 के बीच पूर्ण संख्या होनी चाहिए।" },
  pkgShort: { en: "package sessions", pt: "sessões do pacote", es: "sesiones del paquete", hi: "पैकेज सत्र" },
  durBadAddon: { en: "Duration must be 0 or more minutes.", pt: "A duração tem que ser 0 ou mais minutos.", es: "La duración debe ser 0 o más minutos.", hi: "अवधि 0 या अधिक मिनट होनी चाहिए।" },
  price: { en: "Price", pt: "Preço", es: "Precio", hi: "कीमत" },
  priceHint: { en: "0 = price on request (charged at checkout).", pt: "0 = sob consulta (valor definido no caixa).", es: "0 = precio a consultar (se define en caja).", hi: "0 = कीमत पूछने पर (चेकआउट पर तय)।" },
  bufBefore: { en: "Buffer before (min)", pt: "Intervalo antes (min)", es: "Margen antes (min)", hi: "पहले का अंतराल (मिनट)" },
  bufAfter: { en: "Buffer after (min)", pt: "Intervalo depois (min)", es: "Margen después (min)", hi: "बाद का अंतराल (मिनट)" },
  bufHint: { en: "Prep or cleanup time kept free around each booking.", pt: "Tempo de preparo ou limpeza que fica livre em volta de cada atendimento.", es: "Tiempo de preparación o limpieza libre alrededor de cada reserva.", hi: "हर बुकिंग के आसपास तैयारी या सफ़ाई का खाली समय।" },
  deposit: { en: "Deposit", pt: "Sinal", es: "Depósito", hi: "डिपॉज़िट" },
  depositHint: { en: "Paid up front through a payment link to hold the slot; it counts toward the price.", pt: "Pago adiantado por link de pagamento para garantir o horário; abate do valor.", es: "Se paga por adelantado con un enlace de pago para asegurar el horario; se descuenta del precio.", hi: "स्लॉट पक्का करने के लिए पेमेंट लिंक से पहले चुकाया जाता है; कीमत में से घटता है।" },
  noshow: { en: "No-show fee", pt: "Taxa de falta", es: "Cargo por ausencia", hi: "न आने का शुल्क" },
  noshowHint: { en: "What your policy charges if the client doesn't show up or cancels inside the window.", pt: "O que a sua política cobra se a cliente faltar ou cancelar dentro do prazo.", es: "Lo que tu política cobra si la clienta no viene o cancela dentro del plazo.", hi: "अगर ग्राहक न आए या समय-सीमा के अंदर रद्द करे तो आपकी नीति का शुल्क।" },
  cancelWin: { en: "Cancellation window (hours)", pt: "Prazo para cancelar (horas)", es: "Plazo para cancelar (horas)", hi: "रद्द करने की समय-सीमा (घंटे)" },
  cancelWinHint: { en: "Cancelling with less notice than this counts as a late cancellation.", pt: "Cancelar com menos antecedência do que isso conta como cancelamento tardio.", es: "Cancelar con menos antelación cuenta como cancelación tardía.", hi: "इससे कम समय पहले रद्द करना देर से रद्द माना जाएगा।" },
  durBad: { en: "Duration must be at least 5 minutes.", pt: "A duração tem que ser de pelo menos 5 minutos.", es: "La duración debe ser de al menos 5 minutos.", hi: "अवधि कम से कम 5 मिनट होनी चाहिए।" },
  moneyBad: { en: "Check the amounts — write only numbers, like 140 or 140.50.", pt: "Confira os valores — só números, como 140 ou 140,50.", es: "Revisa los montos — solo números, como 140 o 140,50.", hi: "राशि जाँचें — सिर्फ़ अंक लिखें, जैसे 140 या 140.50।" },
  depShort: { en: "deposit", pt: "sinal", es: "depósito", hi: "डिपॉज़िट" },
  onRequest: { en: "on request", pt: "sob consulta", es: "a consultar", hi: "पूछने पर" },
  // produtos
  addProduct: { en: "+ Add product", pt: "+ Adicionar produto", es: "+ Agregar producto", hi: "+ उत्पाद जोड़ें" },
  newProduct: { en: "New product", pt: "Novo produto", es: "Nuevo producto", hi: "नया उत्पाद" },
  noProducts: { en: "No products yet. Add what you sell at the counter.", pt: "Ainda não há produtos. Cadastre o que você vende no balcão.", es: "Aún no hay productos. Agrega lo que vendes en el mostrador.", hi: "अभी कोई उत्पाद नहीं। काउंटर पर जो बेचते हैं वह जोड़ें।" },
  brand: { en: "Brand", pt: "Marca", es: "Marca", hi: "ब्रांड" },
  stock: { en: "Stock", pt: "Estoque", es: "Stock", hi: "स्टॉक" },
  stockHint: { en: "Leave empty to not track stock. Checkout lowers it on every sale.", pt: "Deixe vazio para não controlar estoque. O caixa baixa a cada venda.", es: "Déjalo vacío para no controlar stock. La caja lo descuenta en cada venta.", hi: "स्टॉक ट्रैक न करना हो तो खाली छोड़ें। हर बिक्री पर चेकआउट इसे घटाता है।" },
  stockBad: { en: "Stock must be a whole number (or empty).", pt: "O estoque tem que ser um número inteiro (ou vazio).", es: "El stock debe ser un número entero (o vacío).", hi: "स्टॉक पूरा अंक होना चाहिए (या खाली)।" },
  noTrack: { en: "not tracked", pt: "sem controle", es: "sin control", hi: "ट्रैक नहीं" },
  lowStock: { en: "low stock", pt: "estoque baixo", es: "stock bajo", hi: "कम स्टॉक" },
  units: { en: "in stock", pt: "em estoque", es: "en stock", hi: "स्टॉक में" },
};
const t = (k) => tx(T[k]) || k;

// Sala ou equipamento (kind 'room'; 'equipment' também é aceito pelo motor). A tela cria sempre 'room'.
const ehSala = (p) => p?.kind === "room" || p?.kind === "equipment";
// Sala "pura" = exigida pelos serviços (config.recursos), não marcada como profissional. Sala antiga com serviços
// próprios (modelo "sala no lugar da profissional") continua editável como antes.
const salaPura = (p) => ehSala(p) && !(p?.services || []).length;
const CORES = ["#D6C29A", "#2FE39A", "#3FB4FF", "#FFC23D", "#FF8A33", "#FF5A8A", "#C9A4FF", "#8E8A80"];
const RAZOES = ["dayoff", "lunch", "training", "vacation", "other"];
const campo = "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-g-word placeholder:text-g-muted [color-scheme:dark] normal-case tracking-normal";
const rotulo = "block text-[10px] uppercase tracking-wide text-g-muted";
const dica = "mt-1 text-[11px] leading-snug text-g-muted normal-case tracking-normal";
const btnLinha = "rounded-full border border-white/15 px-3 py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-[11px] font-bold text-g-word hover:border-white/30 disabled:opacity-40";
const btnPrim = "rounded-full bg-g-green px-4 py-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm font-extrabold text-[#161512] disabled:opacity-40";

// minuto do dia ⇄ "HH:MM" do <input type="time">
const paraHM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const deHM = (s) => { const x = /^(\d{1,2}):(\d{2})/.exec(String(s || "")); return x ? Number(x[1]) * 60 + Number(x[2]) : null; };
const nomeDia = (wd, formato = "short") => new Date(Date.UTC(2023, 0, 1 + wd)).toLocaleDateString(loc(), { weekday: formato, timeZone: "UTC" }); // 01/01/2023 = domingo
const valorDinheiro = (cents) => { const n = Number(cents) || 0; if (!n) return ""; const s = (n / 100).toFixed(2); return ["pt", "es"].includes(lang()) ? s.replace(".", ",") : s; };
const lerDinheiro = (s) => (String(s ?? "").trim() === "" ? 0 : centavos(s));

// ── amostra (só fora de conta conectada) ─────────────────────────────────────────────────────
const AMOSTRA = (() => {
  const h = (loc_) => [1, 2, 3, 4, 5].flatMap((w) => [{ location_id: loc_, weekday: w, start_min: 540, end_min: 780 }, { location_id: loc_, weekday: w, start_min: 840, end_min: 1080 }]);
  return {
    ok: true,
    locations: [{ id: "L1", name: "Astoria", tz: "America/New_York" }],
    services: [
      { id: "S1", name: "Deep Tissue 60min", category: "Massage", duration_min: 60, price_cents: 14000, deposit_cents: 3000, noshow_fee_cents: 5000, cancel_window_h: 24, buffer_before_min: 0, buffer_after_min: 15 },
      { id: "S2", name: "Signature Facial", category: "Facials", duration_min: 75, price_cents: 16500, deposit_cents: 0, noshow_fee_cents: 0, cancel_window_h: 24, buffer_before_min: 0, buffer_after_min: 10, pkg_sessions: 2 },
      { id: "S3", name: "Gel Manicure", category: "Nails", duration_min: 45, price_cents: 5500, deposit_cents: 0, noshow_fee_cents: 0, cancel_window_h: 12, buffer_before_min: 0, buffer_after_min: 0 },
      { id: "S4", name: "Aromatherapy", category: "Massage", duration_min: 10, price_cents: 2000, deposit_cents: 0, noshow_fee_cents: 0, cancel_window_h: 0, buffer_before_min: 0, buffer_after_min: 0, addon: true },
    ],
    pros: [
      { id: "P1", name: "Ana", title: "Massage therapist", kind: "staff", color: "#2FE39A", commission_service_pct: 40, commission_product_pct: 10, locations: ["L1"], services: ["S1"], hours: h("L1") },
      { id: "P2", name: "Bianca", title: "Esthetician", kind: "staff", color: "#3FB4FF", commission_service_pct: 35, commission_product_pct: 10, locations: ["L1"], services: ["S2"], hours: h("L1") },
      { id: "R1", name: "Room 1", title: "", kind: "room", color: "#8E8A80", commission_service_pct: 0, commission_product_pct: 0, locations: ["L1"], services: [], hours: [] },
    ],
    // desk_v10: a Ana faz a massagem em 50 min, com 10 de preparo, e ganha 50,00 fixo por atendimento.
    pro_rules: [{ pro_id: "P1", service_id: "S1", duration_min: 50, prep_min: 10, finish_min: null, pay_type: "flat", pay_amount: 5000 }],
  };
})();
const AMOSTRA_PRODUTOS = [
  { id: "X1", name: "Hydrating Serum 30ml", brand: "Glow Lab", price_cents: 6800, stock: 2 },
  { id: "X2", name: "Massage Oil", brand: "Natura", price_cents: 3200, stock: 14 },
  { id: "X3", name: "Gift wrap", brand: "", price_cents: 500, stock: null },
];

// t com variáveis: tv("payGeneral", { p: 40 }) → "Comissão geral (40%)".
const tv = (k, v) => Object.entries(v).reduce((s, [a, b]) => s.split(`{${a}}`).join(String(b)), t(k));
// Regra efetiva de (profissional, serviço): o que ela tem de próprio, senão o do serviço / a comissão geral.
const regraEfetiva = (regra, svc) => ({
  dur: regra?.duration_min ?? svc?.duration_min ?? 30,
  prep: regra?.prep_min ?? svc?.buffer_before_min ?? 0,
  finish: regra?.finish_min ?? svc?.buffer_after_min ?? 0,
});

// ── peças ────────────────────────────────────────────────────────────────────────────────────
function Interruptor({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="inline-flex items-center gap-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word">
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-g-green" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#161512] transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}
function IconePessoa({ cor, nome }) {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black text-[#161512]" style={{ background: cor || "#D6C29A" }}>{(nome || "?").slice(0, 1).toUpperCase()}</span>;
}
function IconeSala({ cor }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border" style={{ borderColor: `${cor || "#8E8A80"}88`, background: `${cor || "#8E8A80"}22` }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={cor || "#8E8A80"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 21h16" /><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" /><circle cx="14.5" cy="12" r="1" fill={cor || "#8E8A80"} /></svg>
    </span>
  );
}
function Aviso({ tom = "erro", children, acao }) {
  const c = tom === "erro" ? "border-red-400/30 bg-red-400/[0.06] text-red-300" : "border-g-gold/30 bg-g-gold/[0.06] text-g-light";
  return <div role={tom === "erro" ? "alert" : undefined} className={`flex items-center justify-between gap-3 rounded-xl2 border px-4 py-2.5 text-xs ${c}`}><span>{children}</span>{acao}</div>;
}

// ── tela ─────────────────────────────────────────────────────────────────────────────────────
export default function DeskEquipe({ email = "", dataKey = "", conectado = false, agenda = null, onChanged }) {
  const [aba, setAba] = useState("team");
  const dados = conectado ? agenda : (agenda?.ok ? agenda : AMOSTRA);

  const enviar = useCallback(async (corpo) => {
    if (!conectado) { toast(t("sampleBlocked")); return { ok: false, d: null }; }
    const { http, d } = await chamarDesk(email, dataKey, corpo);
    return { ok: d?.ok === true, d, http };
  }, [conectado, email, dataKey]);
  const mudou = useCallback(() => { if (typeof onChanged === "function") onChanged(); }, [onChanged]);

  if (conectado && !dados) return <SectionSkeleton rows={6} />;

  const abas = [["team", t("tabTeam")], ["services", t("tabServices")], ["products", t("tabProducts")], ["inactive", tx({ en: "Turned off", pt: "Desativados", es: "Desactivados", hi: "बंद किए गए" })]];
  return (
    <div className="space-y-4">
      <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 w-max max-w-full overflow-x-auto" role="tablist">
        {abas.map(([k, rot]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
            className={`shrink-0 whitespace-nowrap px-4 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] rounded-full text-xs font-bold ${aba === k ? "bg-g-green/20 text-g-word" : "text-g-muted hover:text-g-word"}`}>{rot}</button>
        ))}
      </div>

      {!conectado && <Aviso tom="amostra">{t("sample")}</Aviso>}
      {conectado && dados && dados.ok === false && (
        <Aviso acao={<button onClick={mudou} className="font-bold text-g-word underline">{t("retry")}</button>}>{t("readFail")}</Aviso>
      )}

      {aba === "team" && dados?.ok !== false && <AbaEquipe dados={dados} enviar={enviar} mudou={mudou} />}
      {aba === "services" && dados?.ok !== false && <AbaServicos dados={dados} enviar={enviar} mudou={mudou} />}
      {aba === "inactive" && <AbaDesativados conectado={conectado} email={email} dataKey={dataKey} enviar={enviar} mudou={mudou} />}
      {aba === "products" && <AbaProdutos conectado={conectado} email={email} dataKey={dataKey} tz={(dados?.locations || [])[0]?.tz} enviar={enviar} mudou={mudou} />}
      {aba === "team" && <CardRegras conectado={conectado} email={email} dataKey={dataKey} />}
      {aba === "team" && <CardAvisos conectado={conectado} email={email} dataKey={dataKey} tz={(dados?.locations || [])[0]?.tz} />}
      {aba === "team" && <DeskAcessos conectado={conectado} email={email} dataKey={dataKey} tz={(dados?.locations || [])[0]?.tz} pros={(dados?.pros || []).filter((p) => (p.kind || "staff") !== "room")} />}
      {aba === "team" && conectado && <DeskPonto email={email} dataKey={dataKey} modo="relatorio" />}
    </div>
  );
}

// ═══ AVISOS PARA VOCÊ — "☀️ resumo toda manhã" (2026-10-05) ═════════════════════════════════════
// Opt-in: nasce DESLIGADO. Fala com /api/resumo-manha (get · set · test), porta = e-mail + chave.
// "Salvo" e "Enviado" só com d.ok === true (e o teste só com o id da Resend na resposta).
const TA = {
  title: { en: "Notices for you", pt: "Avisos para você", es: "Avisos para ti", hi: "आपके लिए सूचनाएँ" },
  toggle: { en: "Summary every morning (≈7am)", pt: "Resumo toda manhã (≈7h)", es: "Resumen cada mañana (≈7h)", hi: "हर सुबह सारांश (≈7 बजे)" },
  hint: { en: "One email with today's bookings per location, clients with alerts, pending deposits, yesterday's numbers and the waitlist. Sections with nothing to say are left out.", pt: "Um e-mail com os horários de hoje por unidade, clientes com alerta, sinais pendentes, os números de ontem e a fila de espera. Seção sem nada a dizer não aparece.", es: "Un correo con las citas de hoy por sede, clientas con alerta, depósitos pendientes, los números de ayer y la lista de espera. Lo que no tiene datos no aparece.", hi: "एक ईमेल: आज की बुकिंग हर लोकेशन पर, अलर्ट वाले ग्राहक, बाकी डिपॉज़िट, कल के आंकड़े और वेटिंग लिस्ट। जिस हिस्से में कुछ नहीं, वह नहीं दिखता।" },
  hour: { en: "Time (business time zone)", pt: "Hora (fuso do negócio)", es: "Hora (zona horaria del negocio)", hi: "समय (व्यवसाय का टाइम ज़ोन)" },
  dest: { en: "Send to (optional)", pt: "Mandar para (opcional)", es: "Enviar a (opcional)", hi: "किसे भेजें (वैकल्पिक)" },
  destHint: { en: "Empty = your account email.", pt: "Vazio = o e-mail da sua conta.", es: "Vacío = el correo de tu cuenta.", hi: "खाली = आपके खाते का ईमेल।" },
  badEmail: { en: "That email doesn't look right.", pt: "Esse e-mail não parece certo.", es: "Ese correo no parece correcto.", hi: "यह ईमेल सही नहीं लगता।" },
  test: { en: "Send a test now", pt: "Mandar um de teste agora", es: "Enviar una prueba ahora", hi: "अभी टेस्ट भेजें" },
  testing: { en: "Sending…", pt: "Mandando…", es: "Enviando…", hi: "भेज रहे हैं…" },
  sentTo: { en: "Sent to", pt: "Enviado para", es: "Enviado a", hi: "भेजा गया:" },
  notSent: { en: "It didn't go out", pt: "Não saiu", es: "No salió", hi: "नहीं गया" },
  limit: { en: "Limit reached: 3 tests per hour.", pt: "Limite: 3 testes por hora.", es: "Límite: 3 pruebas por hora.", hi: "सीमा: हर घंटे 3 टेस्ट।" },
  last: { en: "Last one", pt: "Último", es: "Último", hi: "पिछला" },
  lastOk: { en: "sent to", pt: "enviado para", es: "enviado a", hi: "भेजा गया" },
  lastFail: { en: "didn't go out", pt: "não saiu", es: "no salió", hi: "नहीं गया" },
  lastTest: { en: "(test)", pt: "(teste)", es: "(prueba)", hi: "(टेस्ट)" },
  off: { en: "Off — nothing is sent.", pt: "Desligado — nada é enviado.", es: "Apagado — no se envía nada.", hi: "बंद — कुछ नहीं भेजा जाता।" },
  sample: { en: "Sample — connect your account to turn on the morning summary.", pt: "Amostra — conecte a sua conta para ligar o resumo da manhã.", es: "Muestra — conecta tu cuenta para activar el resumen de la mañana.", hi: "नमूना — सुबह का सारांश चालू करने के लिए खाता जोड़ें।" },
  readFail: { en: "I couldn't read your notices.", pt: "Não consegui ler os seus avisos.", es: "No pude leer tus avisos.", hi: "आपकी सूचनाएँ नहीं पढ़ पाया।" },
  monthly: { en: "Monthly report (on the 1st)", pt: "Relatório do mês (dia 1)", es: "Informe del mes (día 1)", hi: "मासिक रिपोर्ट (हर 1 तारीख)" },
  monthlyHint: { en: "On the 1st, at the time above: visits, new and returning clients, money in, calls answered, where bookings came from and each location.", pt: "No dia 1, na hora acima: visitas, clientes novas e que voltaram, o que entrou, ligações atendidas, de onde vieram os agendamentos e cada unidade.", es: "El día 1, a la hora de arriba: visitas, clientas nuevas y que volvieron, lo que entró, llamadas atendidas, de dónde vinieron las reservas y cada sede.", hi: "हर 1 तारीख को: विज़िट, नए/लौटे ग्राहक, आय, कॉल, बुकिंग स्रोत।" },
  monthlyTest: { en: "Send last month now (test)", pt: "Mandar o mês passado agora (teste)", es: "Enviar el mes pasado ahora (prueba)", hi: "पिछला महीना अभी भेजें (टेस्ट)" },
};
const ta = (k) => tx(TA[k]) || k;
// REGRAS DO BALCÃO (desk_v12): hoje, só a falta automática.
const TR = {
  title: { en: "Front desk rules", pt: "Regras do balcão", es: "Reglas de recepción", hi: "फ़्रंट डेस्क नियम" },
  noshow: { en: "Mark a no-show automatically", pt: "Marcar falta automaticamente", es: "Marcar inasistencia automáticamente", hi: "नो-शो अपने-आप मार्क करें" },
  noshowHint: { en: "If nobody taps “Checked in” by then, the booking becomes a no-show on its own. Never charges anything: the fee stays a button. One tap brings it back if she arrives after all.", pt: "Se ninguém tocar em “Chegou” até lá, o agendamento vira falta sozinho. Nunca cobra nada: a taxa continua sendo um botão. Um toque traz de volta se ela chegar afinal.", es: "Si nadie toca “Llegó” hasta entonces, la reserva pasa a inasistencia sola. Nunca cobra nada: el cargo sigue siendo un botón. Un toque la recupera si llega al final.", hi: "अगर तब तक कोई “पहुँच गए” न दबाए, बुकिंग अपने-आप नो-शो हो जाती है। कभी कुछ चार्ज नहीं करता: शुल्क एक बटन ही रहता है। अगर वह आ जाए, एक टैप से वापस।" },
  off: { en: "Off: the front desk marks every no-show by hand", pt: "Desligado: a recepção marca toda falta à mão", es: "Apagado: recepción marca cada inasistencia a mano", hi: "बंद: डेस्क हर नो-शो हाथ से मार्क करता है" },
  after: { en: "{n} min after the start time", pt: "{n} min depois do horário", es: "{n} min después de la hora", hi: "शुरू के {n} मिनट बाद" },
  mindbody: { en: "Mindbody does this at 10 min; 30 gives the client a fair margin.", pt: "O MindBody faz isso aos 10 min; 30 dá uma margem justa à cliente.", es: "Mindbody lo hace a los 10 min; 30 da un margen justo a la clienta.", hi: "Mindbody 10 मिनट पर करता है; 30 ग्राहक को उचित मार्जिन देता है।" },
  readFail: { en: "I couldn't read the rules.", pt: "Não consegui ler as regras.", es: "No pude leer las reglas.", hi: "नियम नहीं पढ़ पाया।" },
};
const trr = (k, v = {}) => Object.entries(v).reduce((s, [a, b]) => s.split(`{${a}}`).join(String(b)), tx(TR[k]) || k);

function CardRegras({ conectado, email, dataKey }) {
  const [est, setEst] = useState({ fase: conectado ? "lendo" : "amostra", min: 30 });
  const [salvando, setSalvando] = useState(false);
  const [seq, setSeq] = useState(0);
  useEffect(() => {
    if (!conectado) return undefined;
    let vivo = true;
    chamarDesk(email, dataKey, { action: "regras_get" }).then(({ d }) => { if (!vivo) return; setEst(d?.ok ? { fase: "ok", min: Number(d.auto_noshow_min) } : { fase: "erro", min: 30 }); });
    return () => { vivo = false; };
  }, [conectado, email, dataKey, seq]);
  const mudar = async (min) => {
    if (!conectado) { toast(t("sampleBlocked")); return; }
    setSalvando(true);
    const { http, d } = await chamarDesk(email, dataKey, { action: "regras_set", auto_noshow_min: min });
    setSalvando(false);
    if (d?.ok) { setEst({ fase: "ok", min }); toast(t("saved")); } else toast(motivo(d, http));
  };
  return (
    <Card>
      <div className="text-sm font-extrabold text-g-word">⏱ {trr("title")}</div>
      {est.fase === "erro" && <div className="mt-2"><Aviso acao={<button onClick={() => setSeq((n) => n + 1)} className="font-bold text-g-word underline">{t("retry")}</button>}>{trr("readFail")}</Aviso></div>}
      {est.fase === "lendo" && <p className="mt-2 text-xs text-g-muted">…</p>}
      {(est.fase === "ok" || est.fase === "amostra") && (
        <div className="mt-2 space-y-2">
          <label className={rotulo}>{trr("noshow")}
            <select value={est.min} disabled={salvando} onChange={(e) => mudar(Number(e.target.value))} className={campo}>
              <option value={0}>{trr("off")}</option>
              {[10, 15, 30, 45, 60].map((n) => <option key={n} value={n}>{trr("after", { n })}</option>)}
            </select>
          </label>
          <p className={dica}>{trr("noshowHint")}</p>
          <p className={dica}>{trr("mindbody")}</p>
        </div>
      )}
    </Card>
  );
}
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function chamarResumo(email, key, corpo) {
  try {
    const r = await fetch("/api/resumo-manha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key, lang: lang(), ...corpo }) });
    const d = await r.json().catch(() => null);
    return { http: r.status, d };
  } catch { return { http: 0, d: null }; }
}

function CardAvisos({ conectado, email, dataKey, tz }) {
  const [est, setEst] = useState({ fase: conectado ? "lendo" : "amostra", v: null });
  const [form, setForm] = useState({ on: false, hora: 7, destino: "" });
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);

  const [seq, setSeq] = useState(0);
  const ler = () => { setEst((e) => ({ ...e, fase: e.v ? e.fase : "lendo" })); setSeq((n) => n + 1); };
  useEffect(() => {
    if (!conectado) return undefined;
    let vivo = true;
    chamarResumo(email, dataKey, { action: "get" }).then(({ d }) => {
      if (!vivo) return;
      if (d?.ok === true) {
        setEst({ fase: "ok", v: d });
        setForm({ on: d.resumo_manha === true, hora: Number.isInteger(d.hora) ? d.hora : 7, destino: d.email_destino || "" });
      } else setEst((e) => ({ fase: "erro", v: e.v }));
    });
    return () => { vivo = false; };
  }, [conectado, email, dataKey, seq]);

  const salvar = async () => {
    if (!conectado) { toast(t("sampleBlocked")); return; }
    const destino = form.destino.trim();
    if (destino && !EMAIL_OK.test(destino)) { toast(ta("badEmail")); return; }
    setSalvando(true);
    const { http, d } = await chamarResumo(email, dataKey, { action: "set", resumo_manha: form.on, hora: form.hora, email_destino: destino });
    setSalvando(false);
    if (d?.ok === true) { toast(t("saved")); ler(); } else toast(d?.reason === "invalid_email" ? ta("badEmail") : motivo(d, http));
  };
  const testar = async () => {
    if (!conectado) { toast(t("sampleBlocked")); return; }
    setTestando(true);
    const { http, d } = await chamarResumo(email, dataKey, { action: "test" });
    setTestando(false);
    if (d?.ok === true && d.id) toast(`${ta("sentTo")} ${d.para}`);
    else if (d?.reason === "rate_limited") toast(ta("limit"));
    else toast(`${ta("notSent")}: ${d?.motivo || motivo(d, http)}`);
    ler();
  };

  const v = est.v;
  const fuso = v?.tz || tz || "America/New_York";
  const ult = v?.ultimo;
  const mudouForm = v && (form.on !== (v.resumo_manha === true) || form.hora !== v.hora || form.destino.trim() !== (v.email_destino || ""));
  return (
    <Card>
      <div className="text-sm font-extrabold text-g-word">☀️ {ta("title")}</div>
      {est.fase === "amostra" && <p className={dica}>{ta("sample")}</p>}
      {est.fase === "erro" && <div className="mt-2"><Aviso acao={<button onClick={ler} className="font-bold text-g-word underline">{t("retry")}</button>}>{ta("readFail")}</Aviso></div>}
      {est.fase === "lendo" && <p className="mt-2 text-xs text-g-muted">…</p>}
      {(est.fase === "ok" || est.fase === "amostra") && (
        <div className="mt-2 space-y-3">
          <Interruptor on={form.on} onChange={(on) => setForm((f) => ({ ...f, on }))} label={ta("toggle")} />
          <p className={dica}>{form.on ? ta("hint") : ta("off")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={rotulo}>{ta("hour")}
              <select value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: Number(e.target.value) }))} className={campo} disabled={!form.on}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hhmm(h * 60)}</option>)}
              </select>
              <span className={dica}>{fuso}</span>
            </label>
            <label className={rotulo}>{ta("dest")}
              <input type="email" value={form.destino} onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value }))} placeholder={v?.email_padrao || email || ""} className={campo} disabled={!form.on} autoComplete="email" />
              <span className={dica}>{ta("destHint")}</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={salvar} disabled={salvando || (conectado && !mudouForm)} className={btnPrim}>{salvando ? t("saving") : t("save")}</button>
            <button onClick={testar} disabled={testando} className={btnLinha}>{testando ? ta("testing") : ta("test")}</button>
          </div>
          {ult && (
            <p className={dica}>
              {ta("last")} {ult.tipo === "teste" ? ta("lastTest") : ""}: {ult.estado === "enviado" ? `${ta("lastOk")} ${ult.para || ""}` : ult.estado === "falhou" ? `${ta("lastFail")}${ult.motivo ? ` — ${ult.motivo}` : ""}` : "…"}
              {ult.at ? ` · ${quando(ult.at, fuso)}` : ""}
            </p>
          )}
          <BlocoMensal conectado={conectado} email={email} dataKey={dataKey} fuso={fuso} />
        </div>
      )}
    </Card>
  );
}

// RELATÓRIO DO MÊS (2026-10-05, slide 21): opcional, nasce DESLIGADO. /api/relatorio-mensal (get · set · test).
// O interruptor salva na hora; "Ligado"/"Enviado" só com d.ok === true (o teste só com o id da Resend).
function BlocoMensal({ conectado, email, dataKey, fuso }) {
  const [v, setV] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const chamar = async (corpo) => {
    try {
      const r = await fetch("/api/relatorio-mensal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key: dataKey, lang: lang(), ...corpo }) });
      return { http: r.status, d: await r.json().catch(() => null) };
    } catch { return { http: 0, d: null }; }
  };
  useEffect(() => {
    if (!conectado) return undefined;
    let vivo = true;
    chamar({ action: "get" }).then(({ d }) => { if (vivo && d?.ok === true) setV(d); });
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado, email, dataKey]);
  const alternar = async (on) => {
    if (!conectado) { toast(t("sampleBlocked")); return; }
    setOcupado("set");
    const { http, d } = await chamar({ action: "set", relatorio_mensal: on });
    setOcupado("");
    if (d?.ok === true) { setV((x) => ({ ...(x || {}), relatorio_mensal: d.relatorio_mensal === true })); toast(t("saved")); } else toast(motivo(d, http));
  };
  const testar = async () => {
    if (!conectado) { toast(t("sampleBlocked")); return; }
    setOcupado("test");
    const { http, d } = await chamar({ action: "test" });
    setOcupado("");
    if (d?.ok === true && d.id) toast(`${ta("sentTo")} ${d.para}`);
    else if (d?.reason === "rate_limited") toast(ta("limit"));
    else toast(`${ta("notSent")}: ${d?.motivo || motivo(d, http)}`);
  };
  const ult = v?.ultimo;
  return (
    <div className="mt-2 border-t border-white/10 pt-3 space-y-2">
      <Interruptor on={v?.relatorio_mensal === true} onChange={alternar} label={`📊 ${ta("monthly")}`} />
      <p className={dica}>{ta("monthlyHint")}</p>
      <button onClick={testar} disabled={ocupado === "test"} className={btnLinha}>{ocupado === "test" ? ta("testing") : ta("monthlyTest")}</button>
      {ult && <p className={dica}>{ta("last")}: {ult.mes} · {ult.estado === "enviado" ? ta("lastOk") : ult.estado === "falhou" ? ta("lastFail") : "…"}{ult.quando ? ` · ${quando(ult.quando, fuso)}` : ""}</p>}
    </div>
  );
}

// ═══ EQUIPE ═════════════════════════════════════════════════════════════════════════════════
function AbaEquipe({ dados, enviar, mudou }) {
  const [editando, setEditando] = useState(null);   // pro (ou {kind} para novo)
  const [horario, setHorario] = useState(null);     // pro
  const [folga, setFolga] = useState(null);         // pro
  const pros = dados?.pros || [];
  const services = dados?.services || [];
  const locations = dados?.locations || [];
  const regrasDe = (proId) => (dados?.pro_rules || []).filter((r) => r.pro_id === proId);
  const pessoas = pros.filter((p) => !ehSala(p));
  const salas = pros.filter(ehSala);
  // Quem precisa de cada sala (services[].recursos, vindo da agenda)
  const usadaPor = (id) => services.filter((s) => (s.recursos || []).includes(id)).map((s) => s.name);
  const nomeLoc = (id) => locations.find((l) => l.id === id)?.name || "";
  // Fechadores estáveis: o Drawer refoca o painel quando onClose muda de identidade.
  const fechaEdicao = useCallback(() => setEditando(null), []);
  const fechaHorario = useCallback(() => setHorario(null), []);
  const fechaFolga = useCallback(() => setFolga(null), []);

  const resumoHoras = (p) => {
    const hs = p.hours || [];
    if (!hs.length) return t("noHours");
    // Por unidade: dias com a mesma faixa juntos — "seg ter qua 9:00–13:00 / 14:00–18:00".
    const porLoc = {};
    hs.forEach((h) => { const l = (porLoc[h.location_id] = porLoc[h.location_id] || {}); (l[h.weekday] = l[h.weekday] || []).push(`${hhmm(h.start_min)}–${hhmm(h.end_min)}`); });
    return Object.entries(porLoc).map(([lid, dias]) => {
      const grupos = new Map();
      Object.keys(dias).map(Number).sort().forEach((w) => { const k = dias[w].join(" / "); grupos.set(k, [...(grupos.get(k) || []), nomeDia(w)]); });
      const lista = [...grupos.entries()].map(([faixa, ws]) => `${ws.join(" ")} ${faixa}`).join(", ");
      return locations.length > 1 ? `${nomeLoc(lid)}: ${lista}` : lista;
    }).join(" · ");
  };

  const linha = (p) => {
    const sala = ehSala(p);
    const pura = salaPura(p);
    const nsv = (p.services || []).length;
    const quem = sala ? usadaPor(p.id) : [];
    const locsSala = (p.locations || []).map(nomeLoc).filter(Boolean);
    return (
      <div key={p.id} className="flex flex-wrap items-center gap-3 py-3 border-t border-white/[0.06] first:border-t-0">
        {sala ? <IconeSala cor={p.color} /> : <IconePessoa cor={p.color} nome={p.name} />}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-g-word truncate">{p.name}{p.title ? <span className="font-normal text-g-muted"> · {p.title}</span> : null}</div>
          <div className="text-[11px] text-g-muted truncate">
            {pura ? (
              <>{locations.length > 1 && locsSala.length ? `${locsSala.join(", ")} · ` : ""}{quem.length ? `${t("usedBy")}: ${quem.join(", ")}` : t("usedByNone")}</>
            ) : (
              <>{nsv ? `${nsv} ${t("nServices")}` : t("allServices")} · {resumoHoras(p)}</>
            )}
            {!sala && (Number(p.commission_service_pct) || Number(p.commission_product_pct)) ? ` · ${Number(p.commission_service_pct) || 0}% / ${Number(p.commission_product_pct) || 0}%` : ""}
            {!sala && regrasDe(p.id).length ? ` · ${regrasDe(p.id).length} ${regrasDe(p.id).length === 1 ? t("ownRule") : t("ownRules")}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setEditando(p)} className={btnLinha}>{t("edit")}</button>
          {!pura && <button onClick={() => setHorario(p)} className={btnLinha}>{t("hours")}</button>}
          <button onClick={() => setFolga(p)} className={btnLinha}>{t("timeOff")}</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="text-sm font-extrabold text-g-word">{t("pros")} <span className="text-g-muted font-normal">· {pessoas.length}</span></div>
          <button onClick={() => setEditando({ kind: "staff" })} className={btnLinha}>{t("addPro")}</button>
        </div>
        {pessoas.length ? pessoas.map(linha) : <p className="py-3 text-sm text-g-muted">{t("noPros")}</p>}
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div>
            <div className="text-sm font-extrabold text-g-word">{t("rooms")} <span className="text-g-muted font-normal">· {salas.length}</span></div>
            <div className="text-[11px] text-g-muted">{t("roomsHint")}</div>
          </div>
          <button onClick={() => setEditando({ kind: "room" })} className={btnLinha}>{t("addRoom")}</button>
        </div>
        {salas.length ? salas.map(linha) : <p className="py-3 text-sm text-g-muted">{t("noRooms")}</p>}
      </Card>

      {editando && (
        <PainelPro pro={editando} services={services} locations={locations} enviar={enviar} usadaPor={usadaPor} rules={editando.id ? regrasDe(editando.id) : []} tz={locations[0]?.tz}
          onClose={fechaEdicao}
          onSaved={(id, criado, base) => { setEditando(null); mudou(); if (criado && base.kind !== "room") setHorario({ ...base, id, hours: [] }); }} />
      )}
      {horario && <PainelHorario pro={horario} locations={locations} enviar={enviar} onClose={fechaHorario} onSaved={() => { setHorario(null); mudou(); }} />}
      {folga && <PainelFolga pro={folga} locations={locations} enviar={enviar} onClose={fechaFolga} mudou={mudou} />}
    </div>
  );
}

function PainelPro({ pro, services, locations, enviar, usadaPor = () => [], rules = [], tz, onClose, onSaved }) {
  const novo = !pro.id;
  // PROFISSIONAL × SERVIÇO (desk_v10): a regra dela por serviço marcado. Campo vazio = padrão do serviço / comissão geral.
  const [regras, setRegras] = useState(() => Object.fromEntries(rules.map((r) => [r.service_id, {
    duration_min: r.duration_min ?? "", prep_min: r.prep_min ?? "", finish_min: r.finish_min ?? "",
    pay_type: r.pay_type || "", pay_amount: r.pay_type === "flat" ? valorDinheiro(r.pay_amount) : (r.pay_amount ?? "") }])));
  const [aberta, setAberta] = useState(null);   // id do serviço com a regra expandida
  const regra = (sid) => regras[sid] || { duration_min: "", prep_min: "", finish_min: "", pay_type: "", pay_amount: "" };
  const mudaRegra = (sid, campo, valor) => setRegras((x) => ({ ...x, [sid]: { ...regra(sid), [campo]: valor } }));
  const resumoRegra = (s) => {
    const r = regra(s.id); const ef = regraEfetiva({ duration_min: r.duration_min === "" ? null : Number(r.duration_min), prep_min: r.prep_min === "" ? null : Number(r.prep_min), finish_min: r.finish_min === "" ? null : Number(r.finish_min) }, s);
    const pag = r.pay_type === "none" ? t("payNone") : r.pay_type === "flat" ? `${t("payFlat").toLowerCase()} ${r.pay_amount || "0"}` : r.pay_type === "pct" ? `${r.pay_amount || 0}%` : tv("payGeneral", { p: Number(cs) || 0 });
    return `${ef.dur} ${t("min")}${r.duration_min === "" ? ` (${t("asService")})` : ""} · ${tv("prepFinishShort", { a: ef.prep, b: ef.finish })} · ${pag}`;
  };
  const [nome, setNome] = useState(pro.name || "");
  const [cargo, setCargo] = useState(pro.title || "");
  const [tipo, setTipo] = useState(ehSala(pro) ? "room" : "staff");
  const [cor, setCor] = useState(pro.color || (ehSala(pro) ? CORES[7] : CORES[0]));
  const [ativo, setAtivo] = useState(true);
  const [cs, setCs] = useState(String(pro.commission_service_pct ?? 0));
  const [cp, setCp] = useState(String(pro.commission_product_pct ?? 0));
  const [svcs, setSvcs] = useState(() => new Set(pro.services || []));
  const [locs, setLocs] = useState(() => new Set(pro.locations || (locations.length === 1 ? [locations[0].id] : [])));
  const [ocupado, setOcupado] = useState(false);
  const alterna = (set, setter, id) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); };
  // Sala nova = exigida pelo serviço (aba Serviços), sem "serviços que faz". Sala antiga que já tinha serviços
  // próprios (sala marcada no lugar da profissional) continua mostrando a lista, para não sumir nada.
  const mostraServicos = tipo === "staff" || (pro.services || []).length > 0;
  const quem = tipo === "room" && pro.id ? usadaPor(pro.id) : [];

  const salvar = async () => {
    if (!nome.trim()) { toast(t("needName")); return; }
    const ncs = Number(String(cs).replace(",", ".")), ncp = Number(String(cp).replace(",", "."));
    if (tipo === "staff" && (!Number.isFinite(ncs) || ncs < 0 || ncs > 100 || !Number.isFinite(ncp) || ncp < 0 || ncp > 100)) { toast(t("commBad")); return; }
    // Sala "pura" não manda `services`: o banco só mexe em quem-faz-o-quê quando a chave vem (desk_staff_save).
    // Equipamento continua 'room' (o motor aceita 'equipment' também, mas as outras telas leem 'room').
    const corpo = { name: nome.trim(), title: cargo.trim(), kind: tipo === "room" && pro.kind === "equipment" ? "equipment" : tipo, color: cor, active: ativo, locations: [...locs], ...(mostraServicos ? { services: [...svcs] } : {}) };
    if (tipo === "staff") { corpo.commission_service_pct = ncs; corpo.commission_product_pct = ncp; }
    // As regras por serviço vão SEMPRE para os serviços marcados (vazio = null = volta ao padrão).
    if (tipo === "staff" && mostraServicos) {
      const n = (v) => (String(v).trim() === "" ? null : Number(String(v).replace(",", ".")));
      corpo.service_rules = [];
      for (const sid of svcs) {
        const r = regra(sid); const s = services.find((x) => x.id === sid);
        const dur = n(r.duration_min), prep = n(r.prep_min), fin = n(r.finish_min);
        const pay = ["pct", "flat", "none"].includes(r.pay_type) ? r.pay_type : null;
        const amt = pay === "pct" ? n(r.pay_amount) ?? 0 : pay === "flat" ? lerDinheiro(r.pay_amount) : null;
        const ruim = [dur, prep, fin].some((v) => v != null && !Number.isFinite(v)) || (dur != null && dur < 5) || (prep != null && prep < 0) || (fin != null && fin < 0)
          || (pay === "pct" && (!Number.isFinite(amt) || amt < 0 || amt > 100)) || (pay === "flat" && (!Number.isFinite(amt) || amt < 0));
        if (ruim) { toast(tv("ruleBad", { s: s?.name || "" })); setAberta(sid); return; }
        corpo.service_rules.push({ service_id: sid, duration_min: dur, prep_min: prep, finish_min: fin, pay_type: pay, pay_amount: amt });
      }
    }
    if (!novo) corpo.id = pro.id;
    setOcupado(true);
    const r = await enviar({ action: "staff_save", pro: corpo });
    setOcupado(false);
    if (!r.ok) { if (r.d || r.http) toast(motivo(r.d, r.http)); return; }
    toast(novo && tipo === "staff" ? t("createdSetHours") : t("saved"));
    onSaved(r.d.id || pro.id, novo && ativo, { ...corpo, id: r.d.id });
  };

  return (
    <Drawer title={novo ? (tipo === "room" ? t("newRoom") : t("newPro")) : pro.name} subtitle={tipo === "room" ? t("kindRoom") : t("kindStaff")} onClose={onClose}
      actions={<button disabled={ocupado} onClick={salvar} className={btnPrim}>{ocupado ? t("saving") : t("save")}</button>}>
      <div className="space-y-3">
        <label className={rotulo}>{t("name")}<input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} autoFocus={novo} maxLength={120} /></label>
        <label className={rotulo}>{tipo === "room" ? t("roomDesc") : t("title")}<input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder={tipo === "room" ? t("roomTitlePh") : t("titlePh")} className={campo} maxLength={120} /></label>
        <div className={rotulo}>{t("kind")}
          <div className="mt-1 flex gap-1.5">
            {[["staff", t("kindStaff")], ["room", t("kindRoom")]].map(([k, rot]) => (
              <button key={k} type="button" onClick={() => setTipo(k)} aria-pressed={tipo === k}
                className={`rounded-full border px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold normal-case tracking-normal ${tipo === k ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-white/10 text-g-muted"}`}>{rot}</button>
            ))}
          </div>
        </div>
        <div className={rotulo}>{t("color")}
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button key={c} type="button" onClick={() => setCor(c)} aria-label={c} aria-pressed={cor === c}
                className={`h-9 w-9 lg:h-7 lg:w-7 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9 rounded-full border-2 ${cor === c ? "border-g-word" : "border-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        </div>
        {tipo === "staff" && (
          <div className="grid grid-cols-2 gap-2">
            <label className={rotulo}>{t("commSvc")}<input value={cs} onChange={(e) => setCs(e.target.value)} inputMode="decimal" className={campo} /></label>
            <label className={rotulo}>{t("commProd")}<input value={cp} onChange={(e) => setCp(e.target.value)} inputMode="decimal" className={campo} /></label>
          </div>
        )}
        {tipo === "room" && pro.id && (
          <div className={rotulo}>{t("usedBy")}
            <div className={dica}>{quem.length ? quem.join(", ") : t("usedByNone")}</div>
          </div>
        )}
        {mostraServicos && <div className={rotulo}>{t("performs")}
          <div className={dica}>{t("performsHint")}{tipo === "staff" ? ` ${t("rulesHint")}` : ""}</div>
          {services.length ? (
            <div className="mt-1.5 max-h-[22rem] overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/[0.06]">
              {services.map((s) => {
                const marcado = svcs.has(s.id); const r = regra(s.id); const expandida = aberta === s.id;
                const temRegra = marcado && (r.duration_min !== "" || r.prep_min !== "" || r.finish_min !== "" || r.pay_type !== "");
                return (
                  <div key={s.id} className={expandida ? "bg-white/[0.03]" : ""}>
                    <label className="flex items-center gap-2 px-3 py-2 text-sm text-g-word normal-case tracking-normal cursor-pointer min-h-[40px]">
                      <input type="checkbox" checked={marcado} onChange={() => { alterna(svcs, setSvcs, s.id); if (expandida) setAberta(null); }} className="accent-[rgb(var(--g-green))]" />
                      <span className="truncate">{s.name}</span>
                    </label>
                    {marcado && tipo === "staff" && (
                      <div className="px-3 pb-2 -mt-1 normal-case tracking-normal">
                        {expandida ? (
                          <div className="space-y-2 rounded-lg border border-white/10 p-2">
                            <div className="grid grid-cols-3 gap-2">
                              <label className={rotulo}>{t("ruleDur")}<input value={r.duration_min} onChange={(e) => mudaRegra(s.id, "duration_min", e.target.value)} placeholder={String(s.duration_min)} inputMode="numeric" className={campo} /></label>
                              <label className={rotulo}>{t("rulePrep")}<input value={r.prep_min} onChange={(e) => mudaRegra(s.id, "prep_min", e.target.value)} placeholder={String(s.buffer_before_min ?? 0)} inputMode="numeric" className={campo} /></label>
                              <label className={rotulo}>{t("ruleFinish")}<input value={r.finish_min} onChange={(e) => mudaRegra(s.id, "finish_min", e.target.value)} placeholder={String(s.buffer_after_min ?? 0)} inputMode="numeric" className={campo} /></label>
                            </div>
                            <div className={`grid gap-2 ${r.pay_type === "pct" || r.pay_type === "flat" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                              <label className={rotulo}>{t("rulePay")}
                                <select value={r.pay_type} onChange={(e) => mudaRegra(s.id, "pay_type", e.target.value)} className={campo}>
                                  <option value="">{tv("payGeneral", { p: Number(String(cs).replace(",", ".")) || 0 })}</option>
                                  <option value="pct">{t("payPct")}</option>
                                  <option value="flat">{t("payFlat")}</option>
                                  <option value="none">{t("payNone")}</option>
                                </select>
                              </label>
                              {r.pay_type === "pct" && <label className={rotulo}>{t("pctLabel")}<input value={r.pay_amount} onChange={(e) => mudaRegra(s.id, "pay_amount", e.target.value)} inputMode="decimal" placeholder="0–100" className={campo} /></label>}
                              {r.pay_type === "flat" && <label className={rotulo}>{t("amountLabel")}<input value={r.pay_amount} onChange={(e) => mudaRegra(s.id, "pay_amount", e.target.value)} inputMode="decimal" placeholder={["pt", "es"].includes(lang()) ? "0,00" : "0.00"} className={campo} /></label>}
                            </div>
                            <button type="button" onClick={() => setAberta(null)} className={`${btnLinha} w-full`}>{t("done")}</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setAberta(s.id)} className="flex w-full items-center justify-between gap-2 min-h-[36px] text-left text-[11px]">
                            <span className={`truncate ${temRegra ? "text-g-word" : "text-g-muted"}`}>{resumoRegra(s)}</span>
                            <span className="shrink-0 font-bold text-g-green">{t("adjust")}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <div className={dica}>{t("noServicesYet")}</div>}
        </div>}
        {locations.length > 0 && (
          <div className={rotulo}>{t("worksAt")}
            <div className={dica}>{tipo === "room" ? t("roomLocHint") : t("worksAtHint")}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {locations.map((l) => (
                <label key={l.id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold normal-case tracking-normal cursor-pointer ${locs.has(l.id) ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-white/10 text-g-muted"}`}>
                  <input type="checkbox" checked={locs.has(l.id)} onChange={() => alterna(locs, setLocs, l.id)} className="sr-only" />{l.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="pt-1">
          <Interruptor on={ativo} onChange={setAtivo} label={t("active")} />
          <div className={dica}>{t("inactiveHint")}</div>
          {!ativo && quem.length > 0 && <div className={`${dica} text-g-gold`}>{t("roomOffWarn")} ({quem.join(", ")})</div>}
        </div>
      </div>
    </Drawer>
  );
}

// Horário semanal: 7 linhas (dom–sáb), cada uma com até 2 faixas.
function semanaDe(hours, locId) {
  const dias = Array.from({ length: 7 }, () => ({ on: false, faixas: [] }));
  (hours || []).filter((h) => h.location_id === locId).sort((a, b) => a.start_min - b.start_min).forEach((h) => {
    const d = dias[h.weekday]; if (!d || d.faixas.length >= 2) return;
    d.on = true; d.faixas.push({ ini: paraHM(h.start_min), fim: paraHM(Math.min(h.end_min, 1439)) });
  });
  return dias;
}
function PainelHorario({ pro, locations, enviar, onClose, onSaved }) {
  const daPro = locations.filter((l) => !(pro.locations || []).length || pro.locations.includes(l.id));
  const opcoes = daPro.length ? daPro : locations;
  const [locId, setLocId] = useState(opcoes[0]?.id || "");
  const [dias, setDias] = useState(() => semanaDe(pro.hours, opcoes[0]?.id || ""));
  const [ocupado, setOcupado] = useState(false);
  const trocaLoc = (id) => { setLocId(id); setDias(semanaDe(pro.hours, id)); };

  const muda = (wd, fn) => setDias((ds) => ds.map((d, i) => (i === wd ? fn({ ...d, faixas: d.faixas.map((f) => ({ ...f })) }) : d)));
  const liga = (wd, on) => muda(wd, (d) => ({ ...d, on, faixas: on && !d.faixas.length ? [{ ini: "09:00", fim: "18:00" }] : d.faixas }));
  const pausa = (wd) => muda(wd, (d) => {
    const f0 = d.faixas[0] || { ini: "09:00", fim: "18:00" };
    const ini = deHM(f0.ini) ?? 540, fim = deHM(f0.fim) ?? 1080;
    const meio = Math.round((ini + fim) / 2 / 30) * 30;
    return { ...d, faixas: [{ ini: f0.ini, fim: paraHM(Math.max(ini + 30, meio - 30)) }, { ini: paraHM(Math.min(fim - 30, meio + 30)), fim: f0.fim }] };
  });
  const copiaSegunda = () => setDias((ds) => ds.map((d, i) => (i >= 2 && i <= 5 ? { on: ds[1].on, faixas: ds[1].faixas.map((f) => ({ ...f })) } : d)));

  const salvar = async () => {
    const hours = [];
    for (let wd = 0; wd < 7; wd++) {
      const d = dias[wd]; if (!d.on) continue;
      let fimAnterior = -1;
      for (const f of d.faixas) {
        const a = deHM(f.ini), b = deHM(f.fim);
        if (a == null || b == null || b <= a || a < fimAnterior) { toast(`${nomeDia(wd, "long")}: ${t("badHours")}`); return; }
        fimAnterior = b; hours.push({ weekday: wd, start_min: a, end_min: b });
      }
    }
    setOcupado(true);
    const r = await enviar({ action: "hours_set", pro_id: pro.id, location_id: locId, hours });
    setOcupado(false);
    if (!r.ok) { if (r.d || r.http) toast(motivo(r.d, r.http)); return; }
    toast(t("saved")); onSaved();
  };

  return (
    <Drawer title={`${t("hoursTitle")} · ${pro.name}`} subtitle={t("hoursSub")} onClose={onClose}
      actions={opcoes.length ? <><button disabled={ocupado || !locId} onClick={salvar} className={btnPrim}>{ocupado ? t("saving") : t("saveHours")}</button><button onClick={copiaSegunda} className={btnLinha}>{t("copyMon")}</button></> : null}>
      {!opcoes.length ? <p className="text-sm text-g-muted">{t("noLocations")}</p> : (
        <div className="space-y-3">
          {opcoes.length > 1 && (
            <label className={rotulo}>{t("location")}
              <select value={locId} onChange={(e) => trocaLoc(e.target.value)} className={campo}>{opcoes.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            </label>
          )}
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/10">
            {dias.map((d, wd) => (
              <div key={wd} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Interruptor on={d.on} onChange={(v) => liga(wd, v)} label={<span className="capitalize w-10 inline-block">{nomeDia(wd)}</span>} />
                  {!d.on && <span className="text-[11px] text-g-muted">{t("closedDay")}</span>}
                  {d.on && d.faixas.length < 2 && <button type="button" onClick={() => pausa(wd)} className="min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-[11px] font-bold text-g-green">{t("addBreak")}</button>}
                </div>
                {d.on && d.faixas.map((f, i) => (
                  <div key={i} className="mt-1.5 flex items-center gap-1.5">
                    <input type="time" step={900} value={f.ini} aria-label={t("start")} onChange={(e) => muda(wd, (x) => { x.faixas[i].ini = e.target.value; return x; })} className={`${campo} !mt-0 !py-1.5 !px-2`} />
                    <span className="text-g-muted text-xs">–</span>
                    <input type="time" step={900} value={f.fim} aria-label={t("end")} onChange={(e) => muda(wd, (x) => { x.faixas[i].fim = e.target.value; return x; })} className={`${campo} !mt-0 !py-1.5 !px-2`} />
                    {i === 1 && <button type="button" aria-label={t("removeBreak")} title={t("removeBreak")} onClick={() => muda(wd, (x) => ({ ...x, faixas: [{ ini: x.faixas[0].ini, fim: x.faixas[1].fim }] }))} className="grid place-items-center min-w-[40px] min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] px-1 text-g-muted hover:text-g-word">✕</button>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}

// Folga / bloqueio: um dia, ou vários (férias = uma chamada por dia, para o conflito de um dia não travar os outros).
function PainelFolga({ pro, locations, enviar, onClose, mudou }) {
  const daPro = locations.filter((l) => !(pro.locations || []).length || pro.locations.includes(l.id));
  const opcoes = daPro.length ? daPro : locations;
  const [locId, setLocId] = useState(opcoes[0]?.id || "");
  const local = opcoes.find((l) => l.id === locId) || opcoes[0] || null;
  const tz = local?.tz || "America/New_York";
  const hoje = diaDe(new Date(), tz);
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [diaTodo, setDiaTodo] = useState(true);
  const [ini, setIni] = useState("12:00");
  const [fim, setFim] = useState("13:00");
  const [razao, setRazao] = useState("dayoff");
  const [outro, setOutro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [falhas, setFalhas] = useState([]);   // [{dia, conflitos[], erro}]

  const escolheRazao = (r) => { setRazao(r); if (r === "lunch") { setDiaTodo(false); setIni("12:00"); setFim("13:00"); } if (r === "vacation" || r === "dayoff") setDiaTodo(true); };

  const bloquear = async () => {
    const fimDia = ate && ate >= de ? ate : de;
    const dias = []; for (let d = de; d <= fimDia && dias.length <= 31; d = somaDias(d, 1)) dias.push(d);
    if (dias.length > 31) { toast(t("tooLong")); return; }
    const a = diaTodo ? 0 : deHM(ini), b = diaTodo ? 1440 : deHM(fim);
    if (a == null || b == null || b <= a) { toast(t("badRange")); return; }
    const texto = razao === "other" ? (outro.trim() || t("r_other")) : t(`r_${razao}`);
    setOcupado(true); setFalhas([]); setProgresso({ feito: 0, total: dias.length });
    let certos = 0; const erros = [];
    for (const dia of dias) {
      const start = paraUtc(dia, a, tz).toISOString();
      const end = (b >= 1440 ? paraUtc(somaDias(dia, 1), 0, tz) : paraUtc(dia, b, tz)).toISOString();
      const r = await enviar({ action: "block", pro_id: pro.id, location_id: local?.id, start, end, reason: texto });
      if (r.ok) certos++;
      else if (!r.d && !r.http) { setOcupado(false); setProgresso(null); return; }   // amostra
      else erros.push({ dia, conflitos: r.d?.reason === "slot_taken" ? (r.d.conflicts || []) : null, erro: motivo(r.d, r.http) });
      setProgresso({ feito: certos + erros.length, total: dias.length });
    }
    setOcupado(false); setProgresso(null);
    if (certos) mudou();
    if (!erros.length) { toast(t("blocked")); onClose(); return; }
    setFalhas(erros);
    toast(`${certos}/${dias.length} ${t("partial")}`);
  };

  const rotuloDia = (dia) => new Date(`${dia}T12:00:00Z`).toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <Drawer title={`${t("blockTitle")} · ${pro.name}`} subtitle={t("blockSub")} onClose={onClose}
      actions={<button disabled={ocupado} onClick={bloquear} className={btnPrim}>{progresso ? `${progresso.feito}/${progresso.total}` : t("block")}</button>}>
      <div className="space-y-3">
        {opcoes.length > 1 && (
          <label className={rotulo}>{t("location")}
            <select value={locId} onChange={(e) => setLocId(e.target.value)} className={campo}>{opcoes.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          </label>
        )}
        <div className={rotulo}>{t("reason")}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {RAZOES.map((r) => (
              <button key={r} type="button" onClick={() => escolheRazao(r)} aria-pressed={razao === r}
                className={`rounded-full border px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold normal-case tracking-normal ${razao === r ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-white/10 text-g-muted"}`}>{t(`r_${r}`)}</button>
            ))}
          </div>
          {razao === "other" && <input value={outro} onChange={(e) => setOutro(e.target.value)} placeholder={t("otherPh")} maxLength={120} className={campo} />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className={rotulo}>{t("fromDay")}<input type="date" value={de} onChange={(e) => { const v = e.target.value; if (!v) return; setDe(v); if (!ate || ate < v) setAte(v); }} className={campo} /></label>
          <label className={rotulo}>{t("toDay")}<input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className={campo} /></label>
        </div>
        <Interruptor on={diaTodo} onChange={setDiaTodo} label={t("allDay")} />
        {!diaTodo && (
          <div className="grid grid-cols-2 gap-2">
            <label className={rotulo}>{t("start")}<input type="time" step={900} value={ini} onChange={(e) => setIni(e.target.value)} className={campo} /></label>
            <label className={rotulo}>{t("end")}<input type="time" step={900} value={fim} onChange={(e) => setFim(e.target.value)} className={campo} /></label>
          </div>
        )}
        {falhas.length > 0 && (
          <div role="alert" className="rounded-xl2 border border-red-400/30 bg-red-400/[0.06] p-3 text-xs text-red-200 space-y-2">
            <div className="font-bold">{t("conflictsTitle")}</div>
            {falhas.map((f) => (
              <div key={f.dia}>
                <div className="font-bold text-g-word capitalize">{rotuloDia(f.dia)}</div>
                {f.conflitos ? (
                  <ul className="mt-0.5 space-y-0.5">
                    {f.conflitos.map((c) => <li key={c.id}>· {quando(c.start, tz, { hour: "numeric", minute: "2-digit" })} — {c.name || "—"}</li>)}
                  </ul>
                ) : <div>· {t("failedDay")}: {f.erro}</div>}
              </div>
            ))}
            <div className="text-g-muted">{t("conflictsHint")}</div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

// ═══ SERVIÇOS ═══════════════════════════════════════════════════════════════════════════════
function AbaServicos({ dados, enviar, mudou }) {
  const [editando, setEditando] = useState(null);
  const services = useMemo(() => dados?.services || [], [dados]);
  const salas = useMemo(() => (dados?.pros || []).filter(ehSala), [dados]);
  const nomeSala = (id) => salas.find((p) => p.id === id)?.name || "";
  const tz = (dados?.locations || [])[0]?.tz;
  const grupos = useMemo(() => {
    const g = new Map();
    services.forEach((s) => { const c = (s.category || "").trim(); if (!g.has(c)) g.set(c, []); g.get(c).push(s); });
    return [...g.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  }, [services]);
  const categorias = useMemo(() => [...new Set(services.map((s) => (s.category || "").trim()).filter(Boolean))].sort(), [services]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setEditando({})} className={btnLinha}>{t("addService")}</button></div>
      {!services.length ? <Card><p className="text-sm text-g-muted">{t("noServices")}</p></Card> : grupos.map(([cat, lista]) => (
        <Card key={cat || "_"}>
          <div className="text-[10px] uppercase tracking-wide text-g-muted mb-1">{cat || t("noCategory")}</div>
          {lista.map((s) => (
            <button key={s.id} onClick={() => setEditando(s)} className="w-full flex items-center justify-between gap-3 py-2.5 border-t border-white/[0.06] first:border-t-0 text-left hover:bg-white/[0.02]">
              <div className="min-w-0">
                <div className="text-sm font-bold text-g-word truncate">{s.name}{s.addon && <span className="ml-2 rounded-full border border-g-gold/40 bg-g-gold/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-g-gold align-middle">{t("addonBadge")}</span>}</div>
                <div className="text-[11px] text-g-muted">
                  {s.duration_min} {t("min")}
                  {Number(s.deposit_cents) > 0 ? ` · ${t("depShort")} ${dinheiro(s.deposit_cents, tz)}` : ""}
                  {Number(s.buffer_after_min) > 0 ? ` · +${s.buffer_after_min} ${t("min")}` : ""}
                  {Number(s.pkg_sessions) > 1 ? ` · ${s.pkg_sessions} ${t("pkgShort")}` : ""}
                  {(s.recursos || []).length ? ` · ${(s.recursos || []).map(nomeSala).filter(Boolean).join(" / ")}` : ""}
                </div>
              </div>
              <div className="text-sm font-extrabold text-g-word num shrink-0">{Number(s.price_cents) > 0 ? dinheiro(s.price_cents, tz) : <span className="text-g-muted font-normal text-xs">{t("onRequest")}</span>}</div>
            </button>
          ))}
        </Card>
      ))}
      {editando && <PainelServico svc={editando} tz={tz} categorias={categorias} salas={salas} enviar={enviar} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); mudou(); }} />}
    </div>
  );
}

function PainelServico({ svc, tz, categorias, salas = [], enviar, onClose, onSaved }) {
  const novo = !svc.id;
  const [f, setF] = useState(() => ({
    name: svc.name || "", category: svc.category || "", duration: String(svc.duration_min ?? 60),
    price: valorDinheiro(svc.price_cents), bb: String(svc.buffer_before_min ?? 0), ba: String(svc.buffer_after_min ?? 0),
    deposit: valorDinheiro(svc.deposit_cents), noshow: valorDinheiro(svc.noshow_fee_cents), win: svc.cancel_window_h == null ? "" : String(svc.cancel_window_h), active: true,
    addon: !!svc.addon,
    pkg: String(svc.pkg_sessions ?? 1),
  }));
  const [ocupado, setOcupado] = useState(false);
  // Salas/equipamentos que o serviço exige (config.recursos), na ordem marcada — a 1ª é a preferida.
  const [recursos, setRecursos] = useState(() => svc.recursos || []);
  const alternaSala = (id) => setRecursos((rs) => (rs.includes(id) ? rs.filter((x) => x !== id) : [...rs, id]));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const inteiro = (s, padrao = 0) => { const n = parseInt(String(s).trim() || String(padrao), 10); return Number.isFinite(n) && n >= 0 ? n : null; };

  const salvar = async () => {
    if (!f.name.trim()) { toast(t("needName")); return; }
    const dur = inteiro(f.duration, f.addon ? 0 : 60);
    if (f.addon ? dur == null : (dur == null || dur < 5)) { toast(t(f.addon ? "durBadAddon" : "durBad")); return; }
    const price = lerDinheiro(f.price), dep = lerDinheiro(f.deposit), ns = lerDinheiro(f.noshow);
    if (price == null || dep == null || ns == null) { toast(t("moneyBad")); return; }
    const bb = inteiro(f.bb), ba = inteiro(f.ba), win = inteiro(f.win);
    const pkg = inteiro(f.pkg, 1);
    if (pkg == null || pkg < 1 || pkg > 20) { toast(t("pkgBad")); return; }
    const service = { name: f.name.trim(), category: f.category.trim(), duration_min: dur, price_cents: price, buffer_before_min: bb ?? 0, buffer_after_min: ba ?? 0,
      deposit_cents: dep, noshow_fee_cents: ns, cancel_window_h: win ?? 0, active: f.active, addon: f.addon, pkg_sessions: pkg };
    if (!novo) service.id = svc.id;
    // Só manda `recursos` se o negócio tem sala ou o serviço já tinha: sem isso o cadastro fica como sempre foi.
    // Sala desligada não aparece aqui, mas continua na lista do serviço (não some calada ao salvar).
    if (salas.length || (svc.recursos || []).length) {
      const visiveis = new Set(salas.map((p) => p.id));
      service.recursos = [...recursos.filter((id) => visiveis.has(id)), ...(svc.recursos || []).filter((id) => !visiveis.has(id))];
    }
    setOcupado(true);
    const r = await enviar({ action: "service_save", service });
    setOcupado(false);
    if (!r.ok) { if (r.d || r.http) toast(motivo(r.d, r.http)); return; }
    toast(t("saved")); onSaved();
  };

  const moeda = dinheiro(0, tz).replace(/[\d.,\s]/g, "") || "$";
  return (
    <Drawer title={novo ? t("newService") : svc.name} onClose={onClose}
      actions={<button disabled={ocupado} onClick={salvar} className={btnPrim}>{ocupado ? t("saving") : t("save")}</button>}>
      <div className="space-y-3">
        <label className={rotulo}>{t("name")}<input value={f.name} onChange={set("name")} className={campo} autoFocus={novo} maxLength={160} /></label>
        <label className={rotulo}>{t("category")}
          <input value={f.category} onChange={set("category")} placeholder={t("categoryPh")} list="desk-cats" className={campo} maxLength={60} />
          <datalist id="desk-cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={rotulo}>{t("duration")}<input value={f.duration} onChange={set("duration")} inputMode="numeric" placeholder={f.addon ? "0" : "60"} className={campo} /></label>
          <label className={rotulo}>{t("price")} ({moeda})<input value={f.price} onChange={set("price")} inputMode="decimal" placeholder="0" className={campo} /></label>
        </div>
        <div className={dica}>{t("priceHint")}</div>
        <div className="pt-1">
          <Interruptor on={f.addon} onChange={(v) => setF((x) => ({ ...x, addon: v }))} label={t("addonToggle")} />
          <div className={dica}>{t("addonHint")}</div>
        </div>
        {!f.addon && (
          <div>
            <label className={rotulo}>{t("pkgSessions")}<div className="max-w-[8rem]"><input value={f.pkg} onChange={set("pkg")} inputMode="numeric" placeholder="1" className={campo} /></div></label>
            <div className={dica}>{t("pkgSessionsHint")}</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className={rotulo}>{t("bufBefore")}<input value={f.bb} onChange={set("bb")} inputMode="numeric" className={campo} /></label>
          <label className={rotulo}>{t("bufAfter")}<input value={f.ba} onChange={set("ba")} inputMode="numeric" className={campo} /></label>
        </div>
        <div className={dica}>{t("bufHint")}</div>
        <div className={rotulo}>{t("needsRoom")}
          <div className={dica}>{salas.length ? t("needsRoomHint") : t("noRoomsYet")}</div>
          {salas.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {salas.map((p) => {
                const on = recursos.includes(p.id); const ordem = recursos.indexOf(p.id) + 1;
                return (
                  <label key={p.id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold normal-case tracking-normal cursor-pointer ${on ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-white/10 text-g-muted"}`}>
                    <input type="checkbox" checked={on} onChange={() => alternaSala(p.id)} className="sr-only" />
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color || "#8E8A80" }} />
                    {p.name}{on && recursos.length > 1 ? <span className="text-g-muted font-normal">· {ordem}</span> : null}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <label className={rotulo}>{t("deposit")} ({moeda})<input value={f.deposit} onChange={set("deposit")} inputMode="decimal" placeholder="0" className={campo} />
          <div className={dica}>{t("depositHint")}</div>
        </label>
        <label className={rotulo}>{t("noshow")} ({moeda})<input value={f.noshow} onChange={set("noshow")} inputMode="decimal" placeholder="0" className={campo} />
          <div className={dica}>{t("noshowHint")}</div>
        </label>
        <label className={rotulo}>{t("cancelWin")}<input value={f.win} onChange={set("win")} inputMode="numeric" placeholder="24" className={campo} />
          <div className={dica}>{t("cancelWinHint")}</div>
        </label>
        <div className="pt-1">
          <Interruptor on={f.active} onChange={(v) => setF((x) => ({ ...x, active: v }))} label={t("active")} />
          <div className={dica}>{t("inactiveHint")}</div>
        </div>
      </div>
    </Drawer>
  );
}

// ═══ PRODUTOS ═══════════════════════════════════════════════════════════════════════════════
function AbaProdutos({ conectado, email, dataKey, tz, enviar, mudou }) {
  const [lido, setLido] = useState({ fase: "lendo", lista: [] });
  const [seq, setSeq] = useState(0);
  const [editando, setEditando] = useState(null);
  const estado = conectado ? lido : { fase: "ok", lista: AMOSTRA_PRODUTOS };

  const reler = () => { setLido((e) => ({ fase: e.lista.length ? "relendo" : "lendo", lista: e.lista })); setSeq((n) => n + 1); };

  useEffect(() => {
    if (!conectado) return undefined;
    let vivo = true;
    chamarDesk(email, dataKey, { action: "catalog" }).then(({ d }) => {
      if (!vivo) return;
      if (d?.ok === true) setLido({ fase: "ok", lista: d.products || [] });
      else setLido((e) => ({ fase: "falhou", lista: e.lista }));
    });
    return () => { vivo = false; };
  }, [conectado, email, dataKey, seq]);

  if (estado.fase === "lendo") return <SectionSkeleton rows={4} />;
  const lista = estado.lista;
  const baixo = (p) => p.stock != null && Number(p.stock) <= 3;
  return (
    <div className="space-y-4">
      {estado.fase === "falhou" && <Aviso acao={<button onClick={reler} className="font-bold text-g-word underline">{t("retry")}</button>}>{t("readFailProducts")}</Aviso>}
      <div className="flex justify-end"><button onClick={() => setEditando({})} className={btnLinha}>{t("addProduct")}</button></div>
      {!lista.length ? (estado.fase !== "falhou" && <Card><p className="text-sm text-g-muted">{t("noProducts")}</p></Card>) : (
        <Card>
          {lista.map((p) => (
            <button key={p.id} onClick={() => setEditando(p)} className={`w-full flex items-center justify-between gap-3 py-2.5 border-t border-white/[0.06] first:border-t-0 text-left hover:bg-white/[0.02] ${baixo(p) ? "rounded-lg bg-g-gold/[0.06] px-2 -mx-2" : ""}`}>
              <div className="min-w-0">
                <div className="text-sm font-bold text-g-word truncate">{p.name}{p.brand ? <span className="font-normal text-g-muted"> · {p.brand}</span> : null}</div>
                <div className={`text-[11px] ${baixo(p) ? "text-g-gold font-bold" : "text-g-muted"}`}>
                  {p.stock == null ? t("noTrack") : `${p.stock} ${t("units")}`}{baixo(p) ? ` · ${t("lowStock")}` : ""}
                </div>
              </div>
              <div className="text-sm font-extrabold text-g-word num shrink-0">{dinheiro(p.price_cents, tz)}</div>
            </button>
          ))}
        </Card>
      )}
      {editando && <PainelProduto prod={editando} tz={tz} enviar={enviar} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); reler(); mudou(); }} />}
    </div>
  );
}

function PainelProduto({ prod, tz, enviar, onClose, onSaved }) {
  const novo = !prod.id;
  const [nome, setNome] = useState(prod.name || "");
  const [marca, setMarca] = useState(prod.brand || "");
  const [preco, setPreco] = useState(valorDinheiro(prod.price_cents));
  const [estoque, setEstoque] = useState(prod.stock == null ? "" : String(prod.stock));
  const [ativo, setAtivo] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) { toast(t("needName")); return; }
    const price = lerDinheiro(preco);
    if (price == null) { toast(t("moneyBad")); return; }
    const est = estoque.trim();
    if (est !== "" && !/^\d+$/.test(est)) { toast(t("stockBad")); return; }
    const product = { name: nome.trim(), brand: marca.trim(), price_cents: price, stock: est === "" ? "" : parseInt(est, 10), active: ativo };
    if (!novo) product.id = prod.id;
    setOcupado(true);
    const r = await enviar({ action: "product_save", product });
    setOcupado(false);
    if (!r.ok) { if (r.d || r.http) toast(motivo(r.d, r.http)); return; }
    toast(t("saved")); onSaved();
  };

  const moeda = dinheiro(0, tz).replace(/[\d.,\s]/g, "") || "$";
  return (
    <Drawer title={novo ? t("newProduct") : prod.name} onClose={onClose}
      actions={<button disabled={ocupado} onClick={salvar} className={btnPrim}>{ocupado ? t("saving") : t("save")}</button>}>
      <div className="space-y-3">
        <label className={rotulo}>{t("name")}<input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} autoFocus={novo} maxLength={160} /></label>
        <label className={rotulo}>{t("brand")}<input value={marca} onChange={(e) => setMarca(e.target.value)} className={campo} maxLength={120} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className={rotulo}>{t("price")} ({moeda})<input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="0" className={campo} /></label>
          <label className={rotulo}>{t("stock")}<input value={estoque} onChange={(e) => setEstoque(e.target.value)} inputMode="numeric" placeholder="—" className={campo} /></label>
        </div>
        <div className={dica}>{t("stockHint")}</div>
        <div className="pt-1">
          <Interruptor on={ativo} onChange={setAtivo} label={t("active")} />
          <div className={dica}>{t("inactiveHint")}</div>
        </div>
      </div>
    </Drawer>
  );
}


// ── DESATIVADOS (2026-10-05) ──────────────────────────────────────────────────────────────────
// A agenda e o catálogo só trazem o que está ATIVO: profissional, serviço ou produto desligado sumia
// de todas as listas e não havia como religar pela tela. Esta aba lê os desligados e religa.
function AbaDesativados({ conectado, email, dataKey, enviar, mudou }) {
  const [estado, setEstado] = useState({ fase: conectado ? "lendo" : "amostra", d: null });
  const [seq, setSeq] = useState(0);
  useEffect(() => {
    let vivo = true;
    if (!conectado) return () => { vivo = false; };
    chamarDesk(email, dataKey, { action: "inactive" }).then(({ d }) => { if (vivo) setEstado(d?.ok ? { fase: "ok", d } : { fase: "falhou", d: null }); });
    return () => { vivo = false; };
  }, [conectado, email, dataKey, seq]);
  const religar = async (tipo, id) => {
    const acao = tipo === "pros" ? { action: "staff_save", pro: { id, active: true } } : tipo === "services" ? { action: "service_save", service: { id, active: true } } : { action: "product_save", product: { id, active: true } };
    const r = await enviar(acao);
    if (r.ok) { toast(tx({ en: "Turned back on", pt: "Reativado", es: "Reactivado", hi: "फिर से चालू" })); setSeq((n) => n + 1); mudou(); }
    else if (r.d || r.http) toast(motivo(r.d, r.http));
  };
  if (estado.fase === "lendo") return <SectionSkeleton rows={3} />;
  if (estado.fase === "amostra") return <Aviso tom="amostra">{tx({ en: "Connect your account to see what was turned off.", pt: "Conecte sua conta para ver o que foi desativado.", es: "Conecta tu cuenta para ver lo desactivado.", hi: "बंद चीज़ें देखने के लिए खाता जोड़ें।" })}</Aviso>;
  if (estado.fase === "falhou") return <Aviso acao={<button onClick={() => setSeq((n) => n + 1)} className="font-bold text-g-word underline">{t("retry")}</button>}>{t("readFail")}</Aviso>;
  const grupos = [["pros", tx({ en: "Team and rooms", pt: "Equipe e salas", es: "Equipo y salas", hi: "टीम और कमरे" })], ["services", tx({ en: "Services", pt: "Serviços", es: "Servicios", hi: "सेवाएँ" })], ["products", tx({ en: "Products", pt: "Produtos", es: "Productos", hi: "उत्पाद" })]];
  const vazio = grupos.every(([k]) => !(estado.d?.[k] || []).length);
  if (vazio) return <Card><p className="text-sm text-g-muted">{tx({ en: "Nothing is turned off.", pt: "Nada desativado.", es: "Nada desactivado.", hi: "कुछ भी बंद नहीं है।" })}</p></Card>;
  return (
    <div className="space-y-3">
      {grupos.map(([k, rot]) => (estado.d?.[k] || []).length ? (
        <Card key={k}>
          <div className="text-sm font-bold text-g-word mb-2">{rot}</div>
          <div className="divide-y divide-white/[0.06]">
            {estado.d[k].map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 text-sm text-g-muted truncate">{x.name}</div>
                <button onClick={() => religar(k, x.id)} className="shrink-0 rounded-full border border-g-green/40 px-3 py-1 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-green">{tx({ en: "Turn on", pt: "Reativar", es: "Reactivar", hi: "चालू करें" })}</button>
              </div>
            ))}
          </div>
        </Card>
      ) : null)}
    </div>
  );
}
