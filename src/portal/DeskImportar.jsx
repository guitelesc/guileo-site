/* GUILEO DESK — Sair do MindBody / Booker (2026-10-05). A dona exporta os relatórios dela (de graça,
   em CSV), solta o arquivo aqui, confere as colunas, e entram as clientes e a agenda futura.

   🚨 REGRAS DA CASA QUE ESTA TELA SEGUE
   · O CSV é lido NO NAVEGADOR (sem dependência nova): aspas, vírgula dentro de aspas, ";" e BOM.
   · Agenda SEMPRE passa por um ensaio (dry_run) antes de gravar — a recepção vê o que casa, o que
     já existe, o que bate em horário ocupado e o que não casou (com o motivo), e só então grava.
   · Horário do arquivo é a parede da UNIDADE → instante pelo fuso dela (`paraUtc`), nunca o do navegador.
   · Sem conexão = explica e bloqueia. Toda escrita confere `d?.ok === true`.
   · Textos nos 4 idiomas (T abaixo). */
import { useState, useMemo, useRef } from "react";
import { toast } from "../lib/portalApi.js";
import { Card } from "../pages/Portal.jsx";
import { chamarDesk, motivo, tx, paraUtc, moedaDo, loc } from "./deskApi.js";
import DeskExportar from "./DeskExportar.jsx";

// ── textos ───────────────────────────────────────────────────────────────────────────────────
const T = {
  dirLabel: { en: "Bring in or take out", pt: "Trazer ou levar", es: "Traer o llevar", hi: "लाएँ या ले जाएँ" },
  dirIn: { en: "Bring from MindBody or Booker", pt: "Trazer do MindBody ou Booker", es: "Traer de MindBody o Booker", hi: "MindBody या Booker से लाएँ" },
  dirOut: { en: "Download your data", pt: "Baixar a sua base", es: "Descargar tus datos", hi: "अपना डेटा डाउनलोड करें" },
  intro: { en: "Move off MindBody or Booker in 3 steps — your clients and future appointments come with you.", pt: "Saia do MindBody ou do Booker em 3 passos — suas clientes e a agenda futura vêm junto.", es: "Deja MindBody o Booker en 3 pasos — tus clientas y tu agenda futura vienen contigo.", hi: "3 चरणों में MindBody या Booker छोड़ें — आपके ग्राहक और आगे की बुकिंग साथ आती हैं।" },
  notConnected: { en: "Connect your account first (Settings → connection code). Without it I can read your file here, but I can't import anything.", pt: "Conecte a sua conta primeiro (Configurações → código de conexão). Sem isso eu leio o arquivo aqui, mas não importo nada.", es: "Conecta tu cuenta primero (Ajustes → código de conexión). Sin eso leo el archivo aquí, pero no importo nada.", hi: "पहले अपना खाता जोड़ें (सेटिंग्स → कनेक्शन कोड)। उसके बिना मैं फ़ाइल यहाँ पढ़ सकता हूँ, पर कुछ इम्पोर्ट नहीं कर सकता।" },
  step1: { en: "1 · Export from your old system (free)", pt: "1 · Exporte do sistema antigo (é grátis)", es: "1 · Exporta desde tu sistema anterior (gratis)", hi: "1 · पुराने सिस्टम से एक्सपोर्ट करें (मुफ़्त)" },
  how1: { en: "Clients: in MindBody go to Reports → Mailing Lists (Booker: Customers → Export), include name, email, phones and birthday.", pt: "Clientes: no MindBody vá em Reports → Mailing Lists (Booker: Customers → Export), com nome, e-mail, telefones e aniversário.", es: "Clientas: en MindBody ve a Reports → Mailing Lists (Booker: Customers → Export), con nombre, correo, teléfonos y cumpleaños.", hi: "ग्राहक: MindBody में Reports → Mailing Lists (Booker: Customers → Export) खोलें, नाम, ईमेल, फ़ोन और जन्मदिन शामिल करें।" },
  how2: { en: "Future appointments: Reports → Schedule at a Glance, pick today until the last booked date, all staff.", pt: "Agenda futura: Reports → Schedule at a Glance, de hoje até a última data marcada, toda a equipe.", es: "Agenda futura: Reports → Schedule at a Glance, desde hoy hasta la última fecha reservada, todo el personal.", hi: "आगे की बुकिंग: Reports → Schedule at a Glance, आज से आख़िरी बुक तारीख़ तक, पूरा स्टाफ़।" },
  how3: { en: "Click Export and choose CSV. If it downloads as Excel, open it and use File → Save As → CSV.", pt: "Clique em Export e escolha CSV. Se baixar em Excel, abra e use Arquivo → Salvar como → CSV.", es: "Haz clic en Export y elige CSV. Si se descarga en Excel, ábrelo y usa Archivo → Guardar como → CSV.", hi: "Export दबाएँ और CSV चुनें। अगर Excel में आए, तो खोलकर File → Save As → CSV करें।" },
  how4: { en: "Before the appointments, create your services and team under Team with the same names — that's how bookings find their match.", pt: "Antes da agenda, cadastre serviços e equipe em Equipe com os mesmos nomes — é assim que cada horário acha o seu par.", es: "Antes de la agenda, crea tus servicios y equipo en Equipo con los mismos nombres — así cada reserva encuentra su par.", hi: "बुकिंग से पहले, टीम में अपनी सेवाएँ और स्टाफ़ उन्हीं नामों से बनाएँ — इसी से हर बुकिंग का मिलान होता है।" },
  step2: { en: "2 · Upload the file", pt: "2 · Envie o arquivo", es: "2 · Sube el archivo", hi: "2 · फ़ाइल अपलोड करें" },
  what: { en: "What's in this file?", pt: "O que tem neste arquivo?", es: "¿Qué hay en este archivo?", hi: "इस फ़ाइल में क्या है?" },
  kClients: { en: "Clients", pt: "Clientes", es: "Clientas", hi: "ग्राहक" },
  kAppts: { en: "Future appointments", pt: "Agenda futura", es: "Agenda futura", hi: "आगे की बुकिंग" },
  choose: { en: "Choose CSV file", pt: "Escolher arquivo CSV", es: "Elegir archivo CSV", hi: "CSV फ़ाइल चुनें" },
  excel: { en: "That's an Excel file. Open it and save as CSV (File → Save As → CSV), then upload the CSV.", pt: "Esse é um arquivo do Excel. Abra e salve como CSV (Arquivo → Salvar como → CSV), depois envie o CSV.", es: "Ese es un archivo de Excel. Ábrelo y guárdalo como CSV (Archivo → Guardar como → CSV) y sube el CSV.", hi: "यह Excel फ़ाइल है। इसे खोलकर CSV में सेव करें, फिर CSV अपलोड करें।" },
  empty: { en: "I couldn't find rows in that file.", pt: "Não achei linhas nesse arquivo.", es: "No encontré filas en ese archivo.", hi: "उस फ़ाइल में पंक्तियाँ नहीं मिलीं।" },
  readErr: { en: "I couldn't read that file.", pt: "Não consegui ler esse arquivo.", es: "No pude leer ese archivo.", hi: "वह फ़ाइल नहीं पढ़ पाया।" },
  rowsRead: { en: "rows read", pt: "linhas lidas", es: "filas leídas", hi: "पंक्तियाँ पढ़ी गईं" },
  step3: { en: "3 · Check the columns", pt: "3 · Confira as colunas", es: "3 · Revisa las columnas", hi: "3 · कॉलम जाँचें" },
  mapHint: { en: "I matched the columns by their names. Fix any that are wrong.", pt: "Eu casei as colunas pelos nomes. Corrija o que estiver errado.", es: "Emparejé las columnas por su nombre. Corrige lo que esté mal.", hi: "मैंने कॉलम नाम से मिलाए हैं। जो ग़लत हो उसे ठीक करें।" },
  none: { en: "— not in file —", pt: "— não tem no arquivo —", es: "— no está en el archivo —", hi: "— फ़ाइल में नहीं —" },
  preview: { en: "Preview (first 20 rows, as they'll be imported)", pt: "Prévia (primeiras 20 linhas, do jeito que vão entrar)", es: "Vista previa (primeras 20 filas, tal como entrarán)", hi: "पूर्वावलोकन (पहली 20 पंक्तियाँ, जैसे इम्पोर्ट होंगी)" },
  f_first: { en: "First name", pt: "Nome", es: "Nombre", hi: "पहला नाम" },
  f_last: { en: "Last name", pt: "Sobrenome", es: "Apellido", hi: "उपनाम" },
  f_full: { en: "Full name", pt: "Nome completo", es: "Nombre completo", hi: "पूरा नाम" },
  f_email: { en: "Email", pt: "E-mail", es: "Correo", hi: "ईमेल" },
  f_phone: { en: "Phone (main)", pt: "Telefone (principal)", es: "Teléfono (principal)", hi: "फ़ोन (मुख्य)" },
  f_phone2: { en: "Phone (backup)", pt: "Telefone (reserva)", es: "Teléfono (respaldo)", hi: "फ़ोन (बैकअप)" },
  f_birthday: { en: "Birthday", pt: "Aniversário", es: "Cumpleaños", hi: "जन्मदिन" },
  f_notes: { en: "Notes", pt: "Observações", es: "Notas", hi: "नोट्स" },
  f_allergies: { en: "Allergies / alerts", pt: "Alergias / alertas", es: "Alergias / alertas", hi: "एलर्जी / अलर्ट" },
  f_date: { en: "Date", pt: "Data", es: "Fecha", hi: "तारीख़" },
  f_start: { en: "Start time", pt: "Hora de início", es: "Hora de inicio", hi: "शुरू का समय" },
  f_end: { en: "End time", pt: "Hora de fim", es: "Hora de fin", hi: "अंत का समय" },
  f_service: { en: "Service", pt: "Serviço", es: "Servicio", hi: "सेवा" },
  f_pro: { en: "Professional", pt: "Profissional", es: "Profesional", hi: "प्रोफ़ेशनल" },
  f_location: { en: "Location", pt: "Unidade", es: "Sede", hi: "लोकेशन" },
  f_client: { en: "Client", pt: "Cliente", es: "Clienta", hi: "ग्राहक" },
  f_ref: { en: "Appointment ID", pt: "ID do agendamento", es: "ID de la reserva", hi: "बुकिंग ID" },
  dateOrder: { en: "Dates in the file are", pt: "As datas no arquivo estão em", es: "Las fechas del archivo están en", hi: "फ़ाइल में तारीख़ें हैं" },
  mdy: { en: "Month/Day/Year (US)", pt: "Mês/Dia/Ano (EUA)", es: "Mes/Día/Año (EE. UU.)", hi: "महीना/दिन/साल (US)" },
  dmy: { en: "Day/Month/Year", pt: "Dia/Mês/Ano", es: "Día/Mes/Año", hi: "दिन/महीना/साल" },
  tzLoc: { en: "Times in the file are at", pt: "Os horários do arquivo são da unidade", es: "Las horas del archivo son de la sede", hi: "फ़ाइल का समय इस लोकेशन का है" },
  tzHint: { en: "Rows with a location name that matches one of yours use that location's time zone.", pt: "Linhas com nome de unidade igual a uma das suas usam o fuso daquela unidade.", es: "Las filas con nombre de sede igual a una de las tuyas usan el huso de esa sede.", hi: "जिन पंक्तियों में आपकी किसी लोकेशन का नाम है, वे उसी का टाइम ज़ोन लेती हैं।" },
  noLoc: { en: "Add a location first (Locations screen) — appointments need its time zone.", pt: "Cadastre uma unidade primeiro (tela Unidades) — a agenda precisa do fuso dela.", es: "Agrega una sede primero (pantalla Sedes) — la agenda necesita su huso horario.", hi: "पहले एक लोकेशन जोड़ें — बुकिंग को उसका टाइम ज़ोन चाहिए।" },
  // clientes
  needContact: { en: "Map at least a phone or email column — clients without either are skipped.", pt: "Escolha pelo menos uma coluna de telefone ou e-mail — cliente sem nenhum dos dois é pulada.", es: "Elige al menos una columna de teléfono o correo — las clientas sin ninguno se omiten.", hi: "कम से कम फ़ोन या ईमेल कॉलम चुनें — दोनों के बिना ग्राहक छोड़ दिए जाते हैं।" },
  needName: { en: "Map the name (full name, or first + last).", pt: "Escolha o nome (completo, ou nome + sobrenome).", es: "Elige el nombre (completo, o nombre + apellido).", hi: "नाम चुनें (पूरा नाम, या पहला + उपनाम)।" },
  importClients: { en: "Import clients", pt: "Importar clientes", es: "Importar clientas", hi: "ग्राहक इम्पोर्ट करें" },
  created: { en: "New", pt: "Novas", es: "Nuevas", hi: "नए" },
  updated: { en: "Already here (updated)", pt: "Já existiam (atualizadas)", es: "Ya existían (actualizadas)", hi: "पहले से थे (अपडेट)" },
  skipped: { en: "Skipped (no phone/email)", pt: "Puladas (sem telefone/e-mail)", es: "Omitidas (sin teléfono/correo)", hi: "छोड़े गए (फ़ोन/ईमेल नहीं)" },
  clientsDone: { en: "Clients imported", pt: "Clientes importadas", es: "Clientas importadas", hi: "ग्राहक इम्पोर्ट हुए" },
  stopped: { en: "Stopped partway. What's listed above already went in — fix the problem and import again (repeats are updated, not duplicated).", pt: "Parou no meio. O que está acima já entrou — resolva e importe de novo (repetidas são atualizadas, não duplicadas).", es: "Se detuvo a la mitad. Lo de arriba ya entró — corrige y vuelve a importar (las repetidas se actualizan, no se duplican).", hi: "बीच में रुक गया। ऊपर वाला पहले ही आ गया — समस्या ठीक करके फिर इम्पोर्ट करें (दोहराए गए अपडेट होंगे, डुप्लिकेट नहीं)।" },
  // agenda
  needAppt: { en: "Map at least Date, Start time, Service, Professional and Client.", pt: "Escolha pelo menos Data, Hora de início, Serviço, Profissional e Cliente.", es: "Elige al menos Fecha, Hora de inicio, Servicio, Profesional y Clienta.", hi: "कम से कम तारीख़, शुरू का समय, सेवा, प्रोफ़ेशनल और ग्राहक चुनें।" },
  check: { en: "Check first (nothing is saved)", pt: "Conferir primeiro (nada é gravado)", es: "Revisar primero (no se guarda nada)", hi: "पहले जाँचें (कुछ सेव नहीं होगा)" },
  importReal: { en: "Import for real", pt: "Importar de verdade", es: "Importar de verdad", hi: "असल में इम्पोर्ट करें" },
  dryTitle: { en: "Check result — nothing saved yet", pt: "Resultado da conferência — nada gravado ainda", es: "Resultado de la revisión — aún no se guardó nada", hi: "जाँच का नतीजा — अभी कुछ सेव नहीं हुआ" },
  realTitle: { en: "Imported", pt: "Importado", es: "Importado", hi: "इम्पोर्ट हुआ" },
  willImport: { en: "Will be imported", pt: "Vão entrar", es: "Se importarán", hi: "इम्पोर्ट होंगे" },
  imported: { en: "Imported", pt: "Entraram", es: "Importadas", hi: "इम्पोर्ट हुए" },
  duplicates: { en: "Already imported", pt: "Já importados", es: "Ya importadas", hi: "पहले से इम्पोर्ट" },
  conflicts: { en: "Clash with a busy slot", pt: "Batem em horário ocupado", es: "Chocan con un horario ocupado", hi: "व्यस्त समय से टकराते हैं" },
  unmatched: { en: "Didn't match", pt: "Não casaram", es: "No coincidieron", hi: "मेल नहीं खाए" },
  conflictsHint: { en: "Clashes are left out: that professional already has something at that time.", pt: "Os que batem ficam de fora: a profissional já tem algo nesse horário.", es: "Los que chocan quedan fuera: esa profesional ya tiene algo a esa hora.", hi: "टकराने वाले छोड़ दिए जाते हैं: उस प्रोफ़ेशनल के पास उस समय पहले से कुछ है।" },
  unmatchedHint: { en: "Create the missing service or professional under Team (same name as in the file), or fix the name in the file — then check again. Matching ignores upper/lower case.", pt: "Cadastre o serviço ou a profissional que falta em Equipe (com o mesmo nome do arquivo), ou corrija o nome no arquivo — depois confira de novo. Maiúsculas e minúsculas não importam.", es: "Crea el servicio o la profesional que falta en Equipo (con el mismo nombre del archivo), o corrige el nombre en el archivo — y revisa de nuevo. Mayúsculas y minúsculas no importan.", hi: "जो सेवा या प्रोफ़ेशनल नहीं मिला उसे टीम में (फ़ाइल वाले नाम से) बनाएँ, या फ़ाइल में नाम ठीक करें — फिर दोबारा जाँचें। बड़े/छोटे अक्षर से फ़र्क नहीं पड़ता।" },
  missingSvc: { en: "Services not found", pt: "Serviços não encontrados", es: "Servicios no encontrados", hi: "सेवाएँ नहीं मिलीं" },
  missingPro: { en: "Professionals not found", pt: "Profissionais não encontradas", es: "Profesionales no encontradas", hi: "प्रोफ़ेशनल नहीं मिले" },
  line: { en: "Line", pt: "Linha", es: "Fila", hi: "पंक्ति" },
  why: { en: "Why", pt: "Motivo", es: "Motivo", hi: "कारण" },
  w_start: { en: "date/time not understood", pt: "data/hora não entendida", es: "fecha/hora no entendida", hi: "तारीख़/समय समझ नहीं आया" },
  w_service: { en: "service not found", pt: "serviço não encontrado", es: "servicio no encontrado", hi: "सेवा नहीं मिली" },
  w_pro: { en: "professional not found", pt: "profissional não encontrada", es: "profesional no encontrada", hi: "प्रोफ़ेशनल नहीं मिला" },
  more: { en: "more", pt: "a mais", es: "más", hi: "और" },
  apptsDone: { en: "Appointments imported", pt: "Agenda importada", es: "Agenda importada", hi: "बुकिंग इम्पोर्ट हुईं" },
  nothingToImport: { en: "Nothing new to import.", pt: "Nada novo para importar.", es: "Nada nuevo para importar.", hi: "इम्पोर्ट के लिए कुछ नया नहीं।" },
  sampleBlocked: { en: "Connect your account to import.", pt: "Conecte a sua conta para importar.", es: "Conecta tu cuenta para importar.", hi: "इम्पोर्ट करने के लिए खाता जोड़ें।" },
  remindersNote: { en: "Imported appointments are marked as from MindBody and get the usual reminders.", pt: "Os agendamentos importados ficam marcados como vindos do MindBody e recebem os lembretes de sempre.", es: "Las reservas importadas quedan marcadas como de MindBody y reciben los recordatorios de siempre.", hi: "इम्पोर्ट की गई बुकिंग MindBody से आई मानी जाती हैं और सामान्य रिमाइंडर पाती हैं।" },
};
const t = (k) => tx(T[k]) || k;

const LOTE = 500;
const PREVIA = 20;
const campo = "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-g-word placeholder:text-g-muted [color-scheme:dark] normal-case tracking-normal";
const rotulo = "block text-[10px] uppercase tracking-wide text-g-muted";
const btnPrim = "rounded-full bg-g-green px-4 py-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm font-extrabold text-[#161512] disabled:opacity-40";
const btnSec = "rounded-full border border-white/15 px-4 py-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm font-bold text-g-word disabled:opacity-40";

// ── CSV ──────────────────────────────────────────────────────────────────────────────────────
// Separador = o que mais aparece FORA de aspas na primeira linha (",", ";" ou tab).
function separador(txt) {
  const conta = { ",": 0, ";": 0, "\t": 0 }; let aspas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (c === '"') aspas = !aspas;
    else if (!aspas && (c === "\n" || c === "\r")) break;
    else if (!aspas && c in conta) conta[c]++;
  }
  return Object.entries(conta).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(conta).sort((a, b) => b[1] - a[1])[0][0] : ",";
}
function lerCsv(bruto) {
  const txt = String(bruto || "").replace(/^\uFEFF/, "");
  const sep = separador(txt);
  const linhas = []; let linha = []; let cel = ""; let aspas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (aspas) {
      if (c === '"') { if (txt[i + 1] === '"') { cel += '"'; i++; } else aspas = false; }
      else cel += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(cel); cel = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      linha.push(cel); cel = ""; linhas.push(linha); linha = [];
    } else cel += c;
  }
  if (cel !== "" || linha.length) { linha.push(cel); linhas.push(linha); }
  const cheias = linhas.map((l) => l.map((x) => x.trim())).filter((l) => l.some((x) => x !== ""));
  // Relatório do MindBody às vezes traz título antes do cabeçalho: o cabeçalho é a 1ª linha com ≥2 células preenchidas.
  const iCab = Math.max(0, cheias.findIndex((l) => l.filter(Boolean).length >= 2));
  return { headers: (cheias[iCab] || []).map((h, i) => h || `#${i + 1}`), rows: cheias.slice(iCab + 1), sep };
}

// ── detecção de colunas ──────────────────────────────────────────────────────────────────────
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const CAMPOS = {
  clients: [
    ["first", ["first name", "firstname", "first", "given name", "client first name", "primeiro nome", "nombre"]],
    ["last", ["last name", "lastname", "last", "surname", "family name", "client last name", "sobrenome", "apellido"]],
    ["full", ["client name", "client", "full name", "name", "customer name", "customer", "nome completo", "nome", "cliente"]],
    ["email", ["email", "e mail", "email address", "client email", "customer email", "correo"]],
    ["phone", ["mobile phone", "mobile", "cell phone", "cell", "cellphone", "mobile number", "celular", "phone", "phone number", "telefone", "telefono"]],
    ["phone2", ["home phone", "work phone", "other phone", "phone 2", "business phone"]],
    ["birthday", ["birth date", "birthdate", "birthday", "date of birth", "dob", "data de nascimento", "aniversario", "fecha de nacimiento"]],
    ["notes", ["notes", "client notes", "note", "comments", "observacoes", "notas"]],
    ["allergies", ["allergies", "alerts", "alert", "medical alerts", "alergias"]],
  ],
  appointments: [
    ["date", ["date", "appointment date", "appt date", "start date", "visit date", "data", "fecha"]],
    ["start", ["start time", "time", "start", "begin time", "appointment time", "appt time", "hora", "hora inicio", "inicio"]],
    ["end", ["end time", "end", "finish time", "hora fim", "hora fin", "fim"]],
    ["service", ["service", "appointment type", "service name", "session type", "visit type", "treatment", "servico", "servicio"]],
    ["pro", ["staff", "provider", "staff name", "employee", "therapist", "practitioner", "teacher", "professional", "profissional", "profesional"]],
    ["location", ["location", "location name", "site", "business location", "unidade", "sede"]],
    ["client", ["client", "client name", "customer", "customer name", "name", "cliente"]],
    ["first", ["first name", "client first name", "firstname"]],
    ["last", ["last name", "client last name", "lastname"]],
    ["phone", ["mobile phone", "client phone", "phone", "cell phone", "mobile", "home phone", "telefone", "celular"]],
    ["email", ["email", "client email", "e mail", "email address"]],
    ["ref", ["appointment id", "appt id", "visit id", "booking id", "appointment number", "confirmation", "confirmation number", "id"]],
  ],
};
function detectar(headers, tipo) {
  const hs = headers.map(norm); const usado = new Set(); const mapa = {};
  for (const [campo_, nomes] of CAMPOS[tipo]) {
    let achou = -1;
    for (const n of nomes) { achou = hs.findIndex((h, i) => !usado.has(i) && h === n); if (achou >= 0) break; }
    if (achou < 0) for (const n of nomes) { if (!n.includes(" ")) continue; achou = hs.findIndex((h, i) => !usado.has(i) && h.includes(n)); if (achou >= 0) break; }
    mapa[campo_] = achou; if (achou >= 0) usado.add(achou);
  }
  return mapa;
}

// ── datas e horas ────────────────────────────────────────────────────────────────────────────
const MESES = { jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, abr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, out: 10, nov: 11, dec: 12, dez: 12, dic: 12, ene: 1 };
const pad = (n) => String(n).padStart(2, "0");
const anoCheio = (y) => (y < 100 ? (y < 70 ? 2000 + y : 1900 + y) : y);
const valida = (y, m, d) => { if (!(y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null; const x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null; };
/** Texto → "YYYY-MM-DD". `ordem` = "mdy" | "dmy" para datas 1/2/2026. */
function lerData(s, ordem) {
  const v = String(s || "").trim(); if (!v) return null;
  let x = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (x) return valida(+x[1], +x[2], +x[3]);
  x = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v);
  if (x) { const a = +x[1], b = +x[2], y = anoCheio(+x[3]); return ordem === "dmy" || a > 12 ? valida(y, b, a) : valida(y, a, b); }
  x = /([a-zA-Z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(v);                  // Oct 6, 2026
  if (x && MESES[norm(x[1]).slice(0, 3)]) return valida(+x[3], MESES[norm(x[1]).slice(0, 3)], +x[2]);
  x = /(\d{1,2})\s+(?:de\s+)?([a-zA-Z]{3,})\.?\s+(?:de\s+)?(\d{4})/.exec(v); // 6 Oct 2026 / 6 de out de 2026
  if (x && MESES[norm(x[2]).slice(0, 3)]) return valida(+x[3], MESES[norm(x[2]).slice(0, 3)], +x[1]);
  return null;
}
/** Texto → minuto do dia ("9:00 AM", "14:30", "9am", "10/06/2026 2:15 PM"). */
function lerHora(s) {
  const v = String(s || "").trim().toLowerCase(); if (!v) return null;
  const semData = v.replace(/\d{4}-\d{1,2}-\d{1,2}t?/, " ").replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/, " ");
  const x = /(\d{1,2})(?:[:h](\d{2}))?(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?|h)?/.exec(semData.trim());
  if (!x || (x[2] == null && !x[3])) return null;
  let h = +x[1]; const m = x[2] != null ? +x[2] : 0; const ap = (x[3] || "").replace(/\./g, "");
  if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
  return h <= 23 && m <= 59 ? h * 60 + m : null;
}
// "Sobrenome, Nome" (formato comum de relatório) → "Nome Sobrenome".
const pega = (r, mapa, k) => (mapa[k] >= 0 ? String(r[mapa[k]] ?? "").trim() : "");
const tzPorNome = (nome, locations, padrao) => { const n = norm(nome); const l = n && locations.find((x) => norm(x.name) === n); return l?.tz || padrao; };
const nomeCliente = (s) => { const v = String(s || "").trim(); const x = /^([^,]+),\s*([^,]+)$/.exec(v); return x ? `${x[2]} ${x[1]}` : v; };

// ── tela ─────────────────────────────────────────────────────────────────────────────────────
export default function DeskImportar({ email = "", dataKey = "", conectado = false, agenda = null, onChanged, inicio = "trazer" }) {
  const locations = useMemo(() => agenda?.locations || [], [agenda]);
  const tzPadrao = locations[0]?.tz || "America/New_York";
  const [direcao, setDirecao] = useState(() => (inicio === "levar" ? "levar" : "trazer"));
  const [tipo, setTipo] = useState("clients");
  const [arquivo, setArquivo] = useState(null);       // { nome, headers, rows }
  const [mapa, setMapa] = useState({});
  const [ordem, setOrdem] = useState(() => (moedaDo(tzPadrao) === "BRL" ? "dmy" : "mdy"));
  const [locId, setLocId] = useState(locations[0]?.id || "");
  const [ocupado, setOcupado] = useState(false);
  const [prog, setProg] = useState(null);             // { feito, total }
  const [resCli, setResCli] = useState(null);         // { created, updated, skipped, parou }
  const [ensaio, setEnsaio] = useState(null);         // resultado dry_run somado
  const [real, setReal] = useState(null);             // resultado do import de verdade
  const input = useRef(null);

  const local = locations.find((l) => l.id === locId) || locations[0] || null;
  const tzLocal = local?.tz || tzPadrao;
  const nomeLocal = local?.name || "";
  const tzDe = (nomeLoc) => tzPorNome(nomeLoc, locations, tzLocal);

  const limpar = () => { setResCli(null); setEnsaio(null); setReal(null); };
  const trocaTipo = (k) => { setTipo(k); limpar(); if (arquivo) setMapa(detectar(arquivo.headers, k)); };

  const abrir = async (f) => {
    limpar();
    if (!f) return;
    if (/\.(xlsx?|xlsm|numbers)$/i.test(f.name)) { toast(t("excel")); return; }
    try {
      const buf = await f.arrayBuffer();
      let txt = new TextDecoder("utf-8").decode(buf);
      if (txt.includes("\uFFFD")) txt = new TextDecoder("windows-1252").decode(buf);   // export antigo do Excel/Windows
      const { headers, rows } = lerCsv(txt);
      if (!rows.length) { toast(t("empty")); setArquivo(null); return; }
      // Adivinha o tipo pelo cabeçalho: tem "date"+"staff/service" → agenda.
      const hs = headers.map(norm);
      const pareceAgenda = hs.some((h) => /(^| )(date|data|fecha)( |$)/.test(h)) && hs.some((h) => /staff|provider|service|appointment type|servico|profissional/.test(h));
      const k = pareceAgenda ? "appointments" : "clients";
      setTipo(k); setArquivo({ nome: f.name, headers, rows }); setMapa(detectar(headers, k));
      if (k === "appointments") {
        const iD = detectar(headers, k).date;
        if (iD >= 0 && rows.some((r) => { const x = /(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/.exec(r[iD] || ""); return x && +x[1] > 12; })) setOrdem("dmy");
      }
    } catch { toast(t("readErr")); }
  };

  // Linhas no formato da API (com `_line` = linha do arquivo, para a recepção achar depois).
  const linhasClientes = useMemo(() => {
    if (!arquivo || tipo !== "clients") return [];
    const col = (r, k) => pega(r, mapa, k);
    return arquivo.rows.map((r, i) => {
      const nome = col(r, "full") ? nomeCliente(col(r, "full")) : `${col(r, "first")} ${col(r, "last")}`.trim();
      const phone = col(r, "phone") || col(r, "phone2");
      const o = { name: nome, _line: i + 2 };
      if (phone) o.phone = phone;
      if (col(r, "email")) o.email = col(r, "email");
      const b = lerData(col(r, "birthday"), ordem); if (b) o.birthday = b;
      if (col(r, "notes")) o.notes = col(r, "notes").slice(0, 2000);
      if (col(r, "allergies")) o.allergies = col(r, "allergies").slice(0, 500);
      return o;
    }).filter((o) => o.name || o.phone || o.email);
  }, [arquivo, tipo, mapa, ordem]);

  const linhasAgenda = useMemo(() => {
    if (!arquivo || tipo !== "appointments") return [];
    const col = (r, k) => pega(r, mapa, k);
    return arquivo.rows.map((r, i) => {
      const dia = lerData(col(r, "date"), ordem);
      const ini = mapa.start >= 0 ? lerHora(col(r, "start")) : lerHora(col(r, "date"));
      const fim = lerHora(col(r, "end"));
      const tz = tzPorNome(col(r, "location"), locations, tzLocal);
      const o = {
        start: dia && ini != null ? paraUtc(dia, ini, tz).toISOString() : "",
        service: col(r, "service"), pro: col(r, "pro"),
        name: col(r, "client") ? nomeCliente(col(r, "client")) : `${col(r, "first")} ${col(r, "last")}`.trim(),
        contact: col(r, "phone") || col(r, "email"),
        _line: i + 2,
      };
      if (dia && ini != null && fim != null && fim > ini) o.end = paraUtc(dia, fim, tz).toISOString();
      const lnome = col(r, "location") || nomeLocal;
      if (lnome) o.location = lnome;
      if (col(r, "ref")) o.external_ref = `mb:${col(r, "ref")}`;
      return o;
    }).filter((o) => o.service || o.pro || o.name);
  }, [arquivo, tipo, mapa, ordem, locations, tzLocal, nomeLocal]);

  const okClientes = (mapa.full >= 0 || mapa.first >= 0) && (mapa.phone >= 0 || mapa.phone2 >= 0 || mapa.email >= 0);
  const okAgenda = mapa.date >= 0 && mapa.service >= 0 && mapa.pro >= 0 && (mapa.client >= 0 || mapa.first >= 0) && !!local;

  // ── envio em lotes ─────────────────────────────────────────────────────────────────────────
  const importarClientes = async () => {
    if (!conectado) { toast(t("sampleBlocked")); return; }
    const todas = linhasClientes.map((o) => { const c = { ...o }; delete c._line; return c; });
    setOcupado(true); setResCli(null);
    const soma = { created: 0, updated: 0, skipped: 0, parou: false };
    setProg({ feito: 0, total: todas.length });
    for (let i = 0; i < todas.length; i += LOTE) {
      const lote = todas.slice(i, i + LOTE);
      const { http, d } = await chamarDesk(email, dataKey, { action: "import_clients", rows: lote });
      if (d?.ok !== true) { soma.parou = true; toast(motivo(d, http)); break; }
      soma.created += Number(d.created) || 0; soma.updated += Number(d.updated) || 0; soma.skipped += Number(d.skipped) || 0;
      setProg({ feito: Math.min(i + LOTE, todas.length), total: todas.length });
      setResCli({ ...soma });
    }
    setResCli({ ...soma }); setOcupado(false); setProg(null);
    if (soma.created || soma.updated) { onChanged?.(); if (!soma.parou) toast(t("clientsDone")); }
  };

  const rodarAgenda = async (dry) => {
    if (!conectado) { toast(t("sampleBlocked")); return; }
    const todas = linhasAgenda;
    setOcupado(true); if (dry) { setEnsaio(null); setReal(null); } else setReal(null);
    const soma = { imported: 0, duplicates: 0, conflicts: 0, unmatched: [], parou: false };
    setProg({ feito: 0, total: todas.length });
    for (let i = 0; i < todas.length; i += LOTE) {
      const lote = todas.slice(i, i + LOTE);
      const { http, d } = await chamarDesk(email, dataKey, { action: "import_appointments", rows: lote, dry_run: dry });
      if (d?.ok !== true) { soma.parou = true; toast(motivo(d, http)); break; }
      soma.imported += Number(d.imported) || 0; soma.duplicates += Number(d.duplicates) || 0; soma.conflicts += Number(d.conflicts) || 0;
      soma.unmatched = soma.unmatched.concat(Array.isArray(d.unmatched) ? d.unmatched : []);
      setProg({ feito: Math.min(i + LOTE, todas.length), total: todas.length });
    }
    setOcupado(false); setProg(null);
    if (dry) setEnsaio(soma);
    else {
      setReal(soma);
      if (soma.imported) { onChanged?.(); if (!soma.parou) toast(t("apptsDone")); } else if (!soma.parou) toast(t("nothingToImport"));
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────────────────────
  const opcoesCampo = CAMPOS[tipo].map(([k]) => k);
  const previa = tipo === "clients" ? linhasClientes.slice(0, PREVIA) : linhasAgenda.slice(0, PREVIA);
  const fmtInst = (iso, tz) => { if (!iso) return "—"; try { return new Date(iso).toLocaleString(loc(), { timeZone: tz, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return iso; } };

  // Duas direções na mesma aba: trazer a base do sistema antigo, ou levar a base embora (DeskExportar).
  const Direcao = (
    <div className="flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-full border border-white/10 bg-white/[0.04] p-0.5 w-fit" role="tablist" aria-label={t("dirLabel")}>
      {[["trazer", t("dirIn")], ["levar", t("dirOut")]].map(([k, rot]) => (
        <button key={k} type="button" role="tab" aria-selected={direcao === k} disabled={ocupado} onClick={() => setDirecao(k)}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 min-h-[40px] rounded-full text-xs font-bold ${direcao === k ? "bg-g-green/20 text-g-word" : "text-g-muted hover:text-g-word"}`}>{rot}</button>
      ))}
    </div>
  );
  // O seletor já diz "Baixar a sua base": o cartão não repete o título.
  if (direcao === "levar") return <div className="space-y-4">{Direcao}<DeskExportar email={email} dataKey={dataKey} conectado={conectado} titulo={false} /></div>;

  return (
    <div className="space-y-4">
      {Direcao}
      <p className="text-xs text-g-muted max-w-xl">{t("intro")}</p>
      <ViradaDosLembretes conectado={conectado} email={email} dataKey={dataKey} />
      {!conectado && <div role="alert" className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] px-4 py-2.5 text-xs text-g-light">{t("notConnected")}</div>}

      {/* 1 — exportar */}
      <Card>
        <div className="text-sm font-extrabold text-g-word mb-2">{t("step1")}</div>
        <ol className="space-y-1.5 text-xs text-g-muted list-decimal pl-4">
          <li>{t("how1")}</li><li>{t("how2")}</li><li>{t("how3")}</li><li>{t("how4")}</li>
        </ol>
      </Card>

      {/* 2 — arquivo */}
      <Card>
        <div className="text-sm font-extrabold text-g-word mb-2">{t("step2")}</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-g-muted">{t("what")}</span>
          <div className="flex max-w-full overflow-x-auto rounded-full border border-white/10 bg-white/[0.04] p-0.5" role="tablist">
            {[["clients", t("kClients")], ["appointments", t("kAppts")]].map(([k, rot]) => (
              <button key={k} role="tab" aria-selected={tipo === k} disabled={ocupado} onClick={() => trocaTipo(k)}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] rounded-full text-xs font-bold ${tipo === k ? "bg-g-green/20 text-g-word" : "text-g-muted hover:text-g-word"}`}>{rot}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={(e) => { abrir(e.target.files?.[0]); e.target.value = ""; }} />
          <button disabled={ocupado} onClick={() => input.current?.click()} className={btnSec}>{t("choose")}</button>
          {arquivo && <span className="text-xs text-g-muted truncate">{arquivo.nome} · <span className="text-g-word font-bold num">{arquivo.rows.length}</span> {t("rowsRead")}</span>}
        </div>
      </Card>

      {/* 3 — colunas, prévia, importar */}
      {arquivo && (
        <Card>
          <div className="text-sm font-extrabold text-g-word">{t("step3")}</div>
          <div className="text-[11px] text-g-muted mb-3">{t("mapHint")}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {opcoesCampo.map((k) => (
              <label key={k} className={rotulo}>{t(`f_${k}`)}
                <select value={mapa[k] ?? -1} disabled={ocupado} onChange={(e) => { limpar(); setMapa((m) => ({ ...m, [k]: Number(e.target.value) })); }} className={campo}>
                  <option value={-1}>{t("none")}</option>
                  {arquivo.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(tipo === "appointments" || mapa.birthday >= 0) && (
              <label className={rotulo}>{t("dateOrder")}
                <select value={ordem} disabled={ocupado} onChange={(e) => { limpar(); setOrdem(e.target.value); }} className={campo}>
                  <option value="mdy">{t("mdy")}</option><option value="dmy">{t("dmy")}</option>
                </select>
              </label>
            )}
            {tipo === "appointments" && (locations.length ? (
              <label className={rotulo}>{t("tzLoc")}
                <select value={local?.id || ""} disabled={ocupado} onChange={(e) => { limpar(); setLocId(e.target.value); }} className={campo}>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.tz}</option>)}
                </select>
                <span className="mt-1 block text-[11px] text-g-muted normal-case tracking-normal">{t("tzHint")}</span>
              </label>
            ) : <div className="text-xs text-red-300 self-end">{t("noLoc")}</div>)}
          </div>

          {/* prévia */}
          <div className="mt-4 text-[10px] uppercase tracking-wide text-g-muted">{t("preview")}</div>
          <div className="mt-1 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-xs">
              <thead className="bg-white/[0.04] text-g-muted">
                {tipo === "clients" ? (
                  <tr>{["line", "f_full", "f_phone", "f_email", "f_birthday", "f_notes"].map((k) => <th key={k} className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{t(k)}</th>)}</tr>
                ) : (
                  <tr>{["line", "f_start", "f_service", "f_pro", "f_client", "f_location"].map((k) => <th key={k} className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{t(k)}</th>)}</tr>
                )}
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-g-word">
                {previa.map((o) => tipo === "clients" ? (
                  <tr key={o._line}>
                    <td className="px-2 py-1.5 text-g-muted num">{o._line}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{o.name || "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap num">{o.phone || "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{o.email || "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap num">{o.birthday || "—"}</td>
                    <td className="px-2 py-1.5 max-w-[14rem] truncate text-g-muted">{o.notes || ""}</td>
                  </tr>
                ) : (
                  <tr key={o._line}>
                    <td className="px-2 py-1.5 text-g-muted num">{o._line}</td>
                    <td className={`px-2 py-1.5 whitespace-nowrap num ${o.start ? "" : "text-red-300"}`}>{o.start ? fmtInst(o.start, tzDe(o.location)) : t("w_start")}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{o.service || "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{o.pro || "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{o.name || "—"}{o.contact ? <span className="text-g-muted"> · {o.contact}</span> : null}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-g-muted">{o.location || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ação */}
          <div className="mt-4 space-y-3">
            {prog && (
              <div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-g-green transition-all" style={{ width: `${prog.total ? Math.round((prog.feito / prog.total) * 100) : 0}%` }} /></div>
                <div className="mt-1 text-[11px] text-g-muted num">{prog.feito} / {prog.total}</div>
              </div>
            )}

            {tipo === "clients" ? (
              <>
                {!okClientes && <div className="text-xs text-red-300">{mapa.full >= 0 || mapa.first >= 0 ? t("needContact") : t("needName")}</div>}
                <button disabled={!conectado || ocupado || !okClientes || !linhasClientes.length} onClick={importarClientes} className={btnPrim}>{t("importClients")} · {linhasClientes.length}</button>
                {resCli && (
                  <div className="grid grid-cols-3 gap-2">
                    {[["created", resCli.created, "text-g-green"], ["updated", resCli.updated, "text-g-word"], ["skipped", resCli.skipped, "text-g-muted"]].map(([k, v, c]) => (
                      <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-[10px] uppercase tracking-wide text-g-muted">{t(k)}</div><div className={`text-lg font-extrabold num ${c}`}>{v}</div></div>
                    ))}
                  </div>
                )}
                {resCli?.parou && <div role="alert" className="text-xs text-red-300">{t("stopped")}</div>}
              </>
            ) : (
              <>
                {!okAgenda && locations.length > 0 && <div className="text-xs text-red-300">{t("needAppt")}</div>}
                <div className="flex flex-wrap gap-2">
                  <button disabled={!conectado || ocupado || !okAgenda || !linhasAgenda.length} onClick={() => rodarAgenda(true)} className={btnSec}>{t("check")} · {linhasAgenda.length}</button>
                  {ensaio && !ensaio.parou && (
                    <button disabled={!conectado || ocupado || !ensaio.imported || !!real} onClick={() => rodarAgenda(false)} className={btnPrim}>{t("importReal")} · {ensaio.imported}</button>
                  )}
                </div>
                {ensaio && <ResultadoAgenda r={ensaio} titulo={t("dryTitle")} rotuloOk={t("willImport")} />}
                {real && <ResultadoAgenda r={real} titulo={t("realTitle")} rotuloOk={t("imported")} />}
                {real && real.imported > 0 && <div className="text-[11px] text-g-muted">{t("remindersNote")}</div>}
                {(ensaio?.parou || real?.parou) && <div role="alert" className="text-xs text-red-300">{t("stopped")}</div>}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function ResultadoAgenda({ r, titulo, rotuloOk }) {
  const faltaSvc = [...new Set(r.unmatched.filter((u) => String(u.why || "").includes("service")).map((u) => u.service).filter(Boolean))];
  const faltaPro = [...new Set(r.unmatched.filter((u) => String(u.why || "").includes("pro")).map((u) => u.pro).filter(Boolean))];
  const MAX = 200;
  return (
    <div className="space-y-3 rounded-xl2 border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs font-bold text-g-word">{titulo}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[[rotuloOk, r.imported, "text-g-green"], [t("duplicates"), r.duplicates, "text-g-muted"], [t("conflicts"), r.conflicts, r.conflicts ? "text-yellow-200" : "text-g-muted"], [t("unmatched"), r.unmatched.length, r.unmatched.length ? "text-red-300" : "text-g-muted"]].map(([k, v, c]) => (
          <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-[10px] uppercase tracking-wide text-g-muted">{k}</div><div className={`text-lg font-extrabold num ${c}`}>{v}</div></div>
        ))}
      </div>
      {r.conflicts > 0 && <div className="text-[11px] text-g-muted">{t("conflictsHint")}</div>}
      {r.unmatched.length > 0 && (
        <>
          <div className="text-[11px] text-g-light">{t("unmatchedHint")}</div>
          {faltaSvc.length > 0 && <div className="text-xs"><span className="text-g-muted">{t("missingSvc")}: </span><span className="text-g-word font-bold">{faltaSvc.join(" · ")}</span></div>}
          {faltaPro.length > 0 && <div className="text-xs"><span className="text-g-muted">{t("missingPro")}: </span><span className="text-g-word font-bold">{faltaPro.join(" · ")}</span></div>}
          <div className="max-h-72 overflow-auto rounded-xl border border-white/10">
            <table className="min-w-full text-xs">
              <thead className="bg-white/[0.04] text-g-muted sticky top-0">
                <tr>{["line", "f_service", "f_pro", "f_client", "why"].map((k) => <th key={k} className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{t(k)}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-g-word">
                {r.unmatched.slice(0, MAX).map((u, i) => {
                  const ws = String(u.why || "").split(",").filter(Boolean);
                  return (
                    <tr key={`${u._line ?? i}-${i}`}>
                      <td className="px-2 py-1.5 text-g-muted num">{u._line ?? "—"}</td>
                      <td className={`px-2 py-1.5 whitespace-nowrap ${ws.includes("service") ? "text-red-300 font-bold" : ""}`}>{u.service || "—"}</td>
                      <td className={`px-2 py-1.5 whitespace-nowrap ${ws.includes("pro") ? "text-red-300 font-bold" : ""}`}>{u.pro || "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{u.name || "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-red-200">{ws.map((w) => t(`w_${w}`)).join(" · ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {r.unmatched.length > MAX && <div className="text-[11px] text-g-muted">+{r.unmatched.length - MAX} {t("more")}</div>}
        </>
      )}
    </div>
  );
}


// ── LEMBRETES NA VIRADA (2026-10-05) ──────────────────────────────────────────────────────────
// A agenda importada do MindBody entra SEM lembrete da Guileo (o MindBody ainda manda o dele; a
// cliente receberia dois). No dia em que o balcão larga o MindBody, este botão passa os lembretes
// e os pedidos de avaliação dos horários FUTUROS importados para a Guileo.
function ViradaDosLembretes({ conectado, email, dataKey }) {
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(null);
  const passar = async () => {
    if (!conectado) return;
    if (!window.confirm(tx({ en: "Only do this after MindBody stops sending reminders. Continue?", pt: "Faça isto só depois que o MindBody parar de mandar lembretes. Continuar?", es: "Hazlo solo cuando MindBody deje de enviar recordatorios. ¿Continuar?", hi: "यह तभी करें जब MindBody रिमाइंडर भेजना बंद कर दे। जारी रखें?" }))) return;
    setOcupado(true);
    const { http, d } = await chamarDesk(email, dataKey, { action: "take_over_reminders" });
    setOcupado(false);
    if (d?.ok) setFeito(d.appointments || 0); else toast(motivo(d, http));
  };
  return (
    <Card className="!p-4">
      <div className="text-sm font-bold text-g-word">{tx({ en: "Reminders for imported appointments", pt: "Lembretes da agenda importada", es: "Recordatorios de la agenda importada", hi: "इम्पोर्ट की गई बुकिंग के रिमाइंडर" })}</div>
      <p className="mt-1 text-xs text-g-muted">{tx({ en: "While MindBody is still running, it sends the reminders for imported appointments — Guileo stays quiet so clients don't get two. On switch-over day, hand them to Guileo.", pt: "Enquanto o MindBody ainda roda, é ele que manda o lembrete da agenda importada — a Guileo fica quieta para a cliente não receber dois. No dia da virada, passe para a Guileo.", es: "Mientras MindBody siga activo, él envía los recordatorios de la agenda importada — Guileo no envía para que la clienta no reciba dos. El día del cambio, pásalos a Guileo.", hi: "जब तक MindBody चल रहा है, इम्पोर्ट की गई बुकिंग के रिमाइंडर वही भेजता है।" })}</p>
      {feito != null
        ? <div className="mt-2 text-xs font-bold text-g-green">{tx({ en: `Done — ${feito} upcoming appointments now get Guileo reminders.`, pt: `Pronto — ${feito} horários futuros passam a receber o lembrete da Guileo.`, es: `Listo — ${feito} citas futuras reciben ahora el recordatorio de Guileo.`, hi: `हो गया — ${feito} आने वाली बुकिंग को अब Guileo रिमाइंडर मिलेगा।` })}</div>
        : <button disabled={!conectado || ocupado} onClick={passar} className="mt-2 rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word disabled:opacity-40">{tx({ en: "Hand reminders to Guileo", pt: "Passar lembretes para a Guileo", es: "Pasar recordatorios a Guileo", hi: "रिमाइंडर Guileo को दें" })}</button>}
    </Card>
  );
}
