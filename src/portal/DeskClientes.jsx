/* GUILEO DESK — Clientes (2026-10-05). A ficha da cliente que a recepção abre com a pessoa na
   frente do balcão: quem é, o que NÃO pode (alergia em faixa âmbar, impossível de não ver), quanto
   já gastou, quantas faltas, o que tem de saldo (pacote / vale), o que assinou e o histórico.

   🚨 REGRAS DA CASA QUE ESTA TELA SEGUE
   · Conta conectada NUNCA mostra amostra: lendo = esqueleto, falhou = aviso com "tentar de novo".
   · Sem conexão (`!conectado`) = ficha de EXEMPLO declarada, nenhuma chamada de rede, edição bloqueada.
   · Datas no fuso da UNIDADE (prop `tz`), dinheiro via `dinheiro()`. Textos nos 4 idiomas (T).
   · Salvar só manda as chaves que mudaram, e só diz "salvo" com `d.ok === true`. */
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "../lib/portalApi.js";
import { Card, Drawer, SectionSkeleton } from "../pages/Portal.jsx";
import { chamarDesk, motivo, dinheiro, quando, tx, diaDe, paraUtc, ehRecepcao, loc as locale } from "./deskApi.js";
import { DuplicadosAviso, JuntarDrawer, EscolherOutraFicha, Apelidos, BotaoJuntar } from "./DeskJuntar.jsx";

// ── textos ───────────────────────────────────────────────────────────────────────────────────
const T = {
  sub: { en: "Search by name, phone or email and open the client's card.", pt: "Procure por nome, telefone ou e-mail e abra a ficha da cliente.", es: "Busca por nombre, teléfono o correo y abre la ficha de la clienta.", hi: "नाम, फ़ोन या ईमेल से खोजें और ग्राहक का कार्ड खोलें।" },
  searchPh: { en: "Name, phone or email…", pt: "Nome, telefone ou e-mail…", es: "Nombre, teléfono o correo…", hi: "नाम, फ़ोन या ईमेल…" },
  searchHint: { en: "Type at least 2 letters or 3 digits.", pt: "Digite pelo menos 2 letras ou 3 números.", es: "Escribe al menos 2 letras o 3 números.", hi: "कम से कम 2 अक्षर या 3 अंक लिखें।" },
  searching: { en: "Searching…", pt: "Procurando…", es: "Buscando…", hi: "खोज रहे हैं…" },
  noResults: { en: "No client found.", pt: "Nenhuma cliente encontrada.", es: "No se encontró ninguna clienta.", hi: "कोई ग्राहक नहीं मिला।" },
  searchFail: { en: "The search didn't go through.", pt: "A busca não deu certo.", es: "La búsqueda no funcionó.", hi: "खोज नहीं हो पाई।" },
  pickOne: { en: "Pick a client on the left to open her card.", pt: "Escolha uma cliente ao lado para abrir a ficha.", es: "Elige una clienta para abrir su ficha.", hi: "कार्ड खोलने के लिए एक ग्राहक चुनें।" },
  readFail: { en: "I couldn't open this card.", pt: "Não consegui abrir esta ficha.", es: "No pude abrir esta ficha.", hi: "यह कार्ड नहीं खुल पाया।" },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Intentar de nuevo", hi: "फिर कोशिश करें" },
  sample: { en: "Sample client — connect your account to see your real clients.", pt: "Cliente de exemplo — conecte a sua conta para ver as suas clientes de verdade.", es: "Clienta de ejemplo — conecta tu cuenta para ver tus clientas reales.", hi: "नमूना ग्राहक — असली ग्राहक देखने के लिए अपना खाता जोड़ें।" },
  sampleBlocked: { en: "This is a sample — connect your account to make changes.", pt: "Isto é um exemplo — conecte a sua conta para fazer alterações.", es: "Esto es un ejemplo — conecta tu cuenta para hacer cambios.", hi: "यह नमूना है — बदलाव के लिए अपना खाता जोड़ें।" },
  trusted: { en: "Trusted client", pt: "Cliente de confiança", es: "Clienta de confianza", hi: "भरोसेमंद ग्राहक" },
  noOnline: { en: "Can't book online", pt: "Não marca online", es: "No reserva en línea", hi: "ऑनलाइन बुक नहीं कर सकती" },
  birthday: { en: "Birthday", pt: "Aniversário", es: "Cumpleaños", hi: "जन्मदिन" },
  birthdaySoon: { en: "Birthday soon", pt: "Aniversário chegando", es: "Cumpleaños pronto", hi: "जन्मदिन जल्द" },
  birthdayToday: { en: "Birthday today!", pt: "Aniversário hoje!", es: "¡Cumpleaños hoy!", hi: "आज जन्मदिन!" },
  allergies: { en: "Allergies", pt: "Alergias", es: "Alergias", hi: "एलर्जी" },
  alerts: { en: "Alerts", pt: "Alertas", es: "Alertas", hi: "चेतावनियाँ" },
  visits: { en: "Visits", pt: "Visitas", es: "Visitas", hi: "विज़िट" },
  spend: { en: "Spent", pt: "Gasto total", es: "Gasto total", hi: "कुल खर्च" },
  noShows: { en: "No-shows", pt: "Faltas", es: "Ausencias", hi: "नहीं आईं" },
  cancels: { en: "Cancellations", pt: "Cancelamentos", es: "Cancelaciones", hi: "रद्द" },
  lastVisit: { en: "Last visit", pt: "Última visita", es: "Última visita", hi: "पिछली विज़िट" },
  nextVisit: { en: "Next visit", pt: "Próxima visita", es: "Próxima visita", hi: "अगली विज़िट" },
  tab_history: { en: "History", pt: "Histórico", es: "Historial", hi: "इतिहास" },
  tab_purchases: { en: "Purchases", pt: "Compras", es: "Compras", hi: "खरीदारी" },
  tab_balances: { en: "Packages & gift cards", pt: "Pacotes e vales", es: "Paquetes y tarjetas regalo", hi: "पैकेज और गिफ्ट कार्ड" },
  tab_forms: { en: "Forms", pt: "Fichas", es: "Formularios", hi: "फ़ॉर्म" },
  tab_notes: { en: "Notes", pt: "Notas", es: "Notas", hi: "नोट्स" },
  noVisits: { en: "No visits yet.", pt: "Ainda sem visitas.", es: "Aún sin visitas.", hi: "अभी कोई विज़िट नहीं।" },
  noSales: { en: "No purchases yet.", pt: "Ainda sem compras.", es: "Aún sin compras.", hi: "अभी कोई खरीदारी नहीं।" },
  noBalances: { en: "No packages or gift cards.", pt: "Sem pacotes nem vales.", es: "Sin paquetes ni tarjetas regalo.", hi: "कोई पैकेज या गिफ्ट कार्ड नहीं।" },
  noForms: { en: "No forms submitted.", pt: "Nenhuma ficha enviada.", es: "Ningún formulario enviado.", hi: "कोई फ़ॉर्म जमा नहीं।" },
  noNotes: { en: "No notes yet.", pt: "Ainda sem notas.", es: "Aún sin notas.", hi: "अभी कोई नोट नहीं।" },
  packages: { en: "Packages", pt: "Pacotes", es: "Paquetes", hi: "पैकेज" },
  giftCards: { en: "Gift cards", pt: "Vales-presente", es: "Tarjetas regalo", hi: "गिफ्ट कार्ड" },
  sessionsLeft: { en: "sessions left", pt: "sessões restantes", es: "sesiones restantes", hi: "सत्र बाकी" },
  of: { en: "of", pt: "de", es: "de", hi: "में से" },
  // desk_v13: validade e ativação do pacote
  expiresOn: { en: "Expires", pt: "Vence em", es: "Vence el", hi: "समाप्ति" },
  expiredOn: { en: "Expired", pt: "Venceu em", es: "Venció el", hi: "समाप्त हुआ" },
  noExpiry: { en: "No expiry", pt: "Sem vencimento", es: "Sin vencimiento", hi: "कोई समाप्ति नहीं" },
  notActivated: { en: "Starts counting on the first visit", pt: "Começa a contar na 1ª visita", es: "Empieza a contar en la 1ª visita", hi: "पहली विज़िट से गिनती शुरू" },
  st_expired: { en: "Expired", pt: "Vencido", es: "Vencido", hi: "समाप्त" },
  st_exhausted: { en: "Used up", pt: "Esgotado", es: "Agotado", hi: "खत्म" },
  changeExpiry: { en: "Change expiry", pt: "Mudar validade", es: "Cambiar validez", hi: "समाप्ति बदलें" },
  newExpiry: { en: "New expiry date", pt: "Nova data de vencimento", es: "Nueva fecha de vencimiento", hi: "नई समाप्ति तारीख़" },
  expiryHint: { en: "Extending gives the client more time; it doesn't add sessions.", pt: "Estender dá mais prazo à cliente; não acrescenta sessões.", es: "Extender le da más plazo a la clienta; no agrega sesiones.", hi: "बढ़ाने से ग्राहक को ज़्यादा समय मिलता है; सत्र नहीं बढ़ते।" },
  removeExpiry: { en: "Remove expiry", pt: "Tirar vencimento", es: "Quitar vencimiento", hi: "समाप्ति हटाएँ" },
  saveExpiry: { en: "Save date", pt: "Salvar data", es: "Guardar fecha", hi: "तारीख़ सेव करें" },
  pickDate: { en: "Pick a date first.", pt: "Escolha uma data primeiro.", es: "Elige una fecha primero.", hi: "पहले तारीख़ चुनें।" },
  boughtOn: { en: "Bought", pt: "Comprado em", es: "Comprado el", hi: "खरीदा" },
  balance: { en: "Balance", pt: "Saldo", es: "Saldo", hi: "शेष" },
  inactive: { en: "Inactive", pt: "Inativo", es: "Inactiva", hi: "निष्क्रिय" },
  signed: { en: "Signed", pt: "Assinada", es: "Firmado", hi: "हस्ताक्षरित" },
  notSigned: { en: "Not signed", pt: "Sem assinatura", es: "Sin firma", hi: "हस्ताक्षर नहीं" },
  tip: { en: "tip", pt: "gorjeta", es: "propina", hi: "टिप" },
  deskNotes: { en: "Desk notes", pt: "Notas do balcão", es: "Notas de recepción", hi: "डेस्क नोट्स" },
  visitNotes: { en: "Notes from visits", pt: "Notas das visitas", es: "Notas de las visitas", hi: "विज़िट के नोट्स" },
  since: { en: "Client since", pt: "Cliente desde", es: "Clienta desde", hi: "ग्राहक कब से" },
  source: { en: "Came from", pt: "Veio por", es: "Llegó por", hi: "कहाँ से आई" },
  sms: { en: "SMS consent", pt: "Aceita SMS", es: "Acepta SMS", hi: "SMS सहमति" },
  consentTitle: { en: "Offers consent (recorded)", pt: "Permissão para ofertas (registrada)", es: "Permiso para ofertas (registrado)", hi: "ऑफ़र सहमति (दर्ज)" },
  consentSms: { en: "Text", pt: "SMS", es: "SMS", hi: "SMS" },
  consentCall: { en: "Phone", pt: "Ligação", es: "Llamada", hi: "कॉल" },
  consentNone: { en: "not recorded", pt: "não registrada", es: "no registrado", hi: "दर्ज नहीं" },
  consentHint: { en: "Only recorded consent counts for promotions. Tap to record what the client told you.", pt: "Só a permissão registrada vale para promoções. Toque para registrar o que a cliente disse.", es: "Solo el permiso registrado cuenta para promociones. Toque para registrar lo que la clienta dijo.", hi: "केवल दर्ज सहमति प्रमोशन के लिए मान्य है। ग्राहक ने जो कहा उसे दर्ज करने के लिए टैप करें।" },
  consentSaved: { en: "Recorded", pt: "Registrado", es: "Registrado", hi: "दर्ज" },
  consentFail: { en: "Couldn't record it", pt: "Não consegui registrar", es: "No pude registrarlo", hi: "दर्ज नहीं हो सका" },
  yes: { en: "Yes", pt: "Sim", es: "Sí", hi: "हाँ" },
  no: { en: "No", pt: "Não", es: "No", hi: "नहीं" },
  book: { en: "Book", pt: "Marcar", es: "Reservar", hi: "बुक करें" },
  edit: { en: "Edit card", pt: "Editar ficha", es: "Editar ficha", hi: "कार्ड बदलें" },
  editTitle: { en: "Edit client card", pt: "Editar ficha da cliente", es: "Editar ficha de la clienta", hi: "ग्राहक कार्ड बदलें" },
  allergiesPh: { en: "e.g. latex, nut oils, lidocaine", pt: "ex.: látex, óleo de castanhas, lidocaína", es: "ej.: látex, aceites de frutos secos, lidocaína", hi: "जैसे: लेटेक्स, नट ऑयल" },
  alertsPh: { en: "Anything the team must see before starting", pt: "O que a equipe precisa ver antes de começar", es: "Lo que el equipo debe ver antes de empezar", hi: "शुरू करने से पहले टीम को क्या देखना चाहिए" },
  notesPh: { en: "Preferences, history, how she likes to be treated", pt: "Preferências, histórico, como ela gosta de ser atendida", es: "Preferencias, historial, cómo le gusta ser atendida", hi: "पसंद, इतिहास, कैसे सेवा पसंद है" },
  tags: { en: "Tags", pt: "Etiquetas", es: "Etiquetas", hi: "टैग" },
  tagPh: { en: "Type a tag and press Enter", pt: "Digite uma etiqueta e aperte Enter", es: "Escribe una etiqueta y pulsa Enter", hi: "टैग लिखें और Enter दबाएँ" },
  removeTag: { en: "Remove tag", pt: "Tirar etiqueta", es: "Quitar etiqueta", hi: "टैग हटाएँ" },
  trustedHelp: { en: "Exempt from deposits and no-show fees", pt: "Isenta de sinal e de taxa de falta", es: "Exenta de depósito y de cargo por ausencia", hi: "डिपॉज़िट और नो-शो शुल्क से छूट" },
  onlineLabel: { en: "Online booking", pt: "Agendamento online", es: "Reserva en línea", hi: "ऑनलाइन बुकिंग" },
  onlineHelp: { en: "Can book online by herself", pt: "Pode marcar online sozinha", es: "Puede reservar en línea por su cuenta", hi: "खुद ऑनलाइन बुक कर सकती है" },
  save: { en: "Save", pt: "Salvar", es: "Guardar", hi: "सेव करें" },
  cancel: { en: "Cancel", pt: "Cancelar", es: "Cancelar", hi: "रद्द करें" },
  saved: { en: "Saved", pt: "Salvo", es: "Guardado", hi: "सेव हुआ" },
  nothingChanged: { en: "Nothing changed.", pt: "Nada mudou.", es: "Nada cambió.", hi: "कुछ नहीं बदला।" },
  noProfile: { en: "No desk profile yet — saving creates one.", pt: "Ainda sem ficha do balcão — salvar cria uma.", es: "Aún sin ficha de recepción — guardar crea una.", hi: "अभी डेस्क प्रोफ़ाइल नहीं — सेव करने से बनेगी।" },
  back: { en: "Back to results", pt: "Voltar à busca", es: "Volver a la búsqueda", hi: "नतीजों पर वापस" },
  st_booked: { en: "Booked", pt: "Agendado", es: "Reservado", hi: "बुक" },
  st_confirmed: { en: "Confirmed", pt: "Confirmado", es: "Confirmado", hi: "पुष्टि" },
  st_in_progress: { en: "Checked in", pt: "Chegou", es: "Llegó", hi: "पहुँचे" },
  st_completed: { en: "Completed", pt: "Concluído", es: "Terminado", hi: "पूरा" },
  st_no_show: { en: "No-show", pt: "Faltou", es: "No vino", hi: "नहीं आए" },
  st_cancelled: { en: "Cancelled", pt: "Cancelado", es: "Cancelado", hi: "रद्द" },
  st_hold: { en: "On hold", pt: "Reservando", es: "En espera", hi: "होल्ड" },
  sale_paid: { en: "Paid", pt: "Pago", es: "Pagado", hi: "भुगतान हुआ" },
  sale_completed: { en: "Paid", pt: "Pago", es: "Pagado", hi: "भुगतान हुआ" },
  sale_void: { en: "Voided", pt: "Estornada", es: "Anulada", hi: "रद्द" },
  sale_voided: { en: "Voided", pt: "Estornada", es: "Anulada", hi: "रद्द" },
  sale_refunded: { en: "Refunded", pt: "Reembolsada", es: "Reembolsada", hi: "रिफंड" },
  sale_open: { en: "Open", pt: "Em aberto", es: "Abierta", hi: "खुली" },
};
const t = (k) => tx(T[k]) || k;
const TZ_PADRAO = "America/New_York";
const ST_COR = { booked: "#3FB4FF", confirmed: "#2FE39A", in_progress: "#FFC23D", completed: "#8E8A80", no_show: "#FF5A5A", cancelled: "#5a564e", hold: "#C9A4FF" };
const rotulo = (pref, v) => (T[`${pref}${v}`] ? t(`${pref}${v}`) : String(v || "—"));

/** Busca válida: ≥2 letras ou ≥3 dígitos (contrato do `client_search`). */
const buscaValida = (q) => {
  const s = String(q || "").trim();
  if (/^[\d\s()+\-.]+$/.test(s)) return s.replace(/\D/g, "").length >= 3;
  return s.replace(/[^\p{L}]/gu, "").length >= 2;
};
const soDia = (iso, tz) => (iso ? quando(iso, tz, { day: "numeric", month: "short", year: "numeric" }) : "—");
const diaHora = (iso, tz) => (iso ? quando(iso, tz, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

// ── amostra (só fora de conta conectada) ─────────────────────────────────────────────────────
function amostra() {
  const dias = (n) => new Date(Date.now() + n * 86400000).toISOString();
  return {
    ok: true, contact_key: "sample",
    profile: { name: "Maria Silva", phone: "+1 718 555 0142", email: "maria.silva@example.com", allergies: "Latex · nut oils", alerts: "Lower back injury — no deep pressure on lumbar.", notes: "Prefers medium pressure and a quiet room. Likes lavender.", trusted: true, can_book_online: true, tags: ["VIP", "Massage"] },
    crm: { name: "Maria Silva", phone: "+1 718 555 0142", email: "maria.silva@example.com", birth_date: `1990-${String(new Date().getMonth() + 1).padStart(2, "0")}-28`, lifecycle: "customer", lead_source: "Instagram", first_seen_at: dias(-420), consent_sms: true },
    visits: [
      { id: "v1", start: dias(9), service: "Deep Tissue 60min", pro: "Ana", status: "confirmed", note: "" },
      { id: "v2", start: dias(-12), service: "Deep Tissue 60min", pro: "Ana", status: "completed", note: "Tight shoulders, asked for more time on neck." },
      { id: "v3", start: dias(-40), service: "Signature Facial", pro: "Bianca", status: "completed", note: "" },
      { id: "v4", start: dias(-71), service: "Deep Tissue 60min", pro: "Ana", status: "no_show", note: "" },
      { id: "v5", start: dias(-95), service: "Gel Manicure", pro: "Carla", status: "cancelled", note: "" },
    ],
    sales: [
      { id: "s1", number: 1042, at: dias(-12), total_cents: 16800, tip_cents: 2800, status: "paid", items: ["Deep Tissue 60min", "Tip"] },
      { id: "s2", number: 1007, at: dias(-40), total_cents: 49500, tip_cents: 0, status: "paid", items: ["Facial package ×3"] },
      { id: "s3", number: 981, at: dias(-60), total_cents: 3200, tip_cents: 0, status: "void", items: ["Body oil"] },
    ],
    packages: [
      { id: "pk1", name: "Facial package ×3", left: 2, total: 3, purchased_at: dias(-40), status: "active", activation: "purchase", activated_at: dias(-40), expires_at: dias(50) },
      { id: "pk2", name: "5 × Deep Tissue", left: 1, total: 5, purchased_at: dias(-200), status: "expired", activation: "purchase", activated_at: dias(-200), expires_at: dias(-20) },
      { id: "pk3", name: "Massage pack ×4", left: 4, total: 4, purchased_at: dias(-3), status: "not_activated", activation: "first_visit", activated_at: null, expires_at: null },
    ],
    gift_cards: [{ code: "GIFT-7Q2M", balance_cents: 5000, amount_cents: 10000, active: true }],
    forms: [{ id: "f1", form: "Massage intake", at: dias(-420), signed: true }, { id: "f2", form: "Facial consent", at: dias(-40), signed: false }],
    totals: { visits: 2, no_shows: 1, cancellations: 1, last_visit: dias(-12), next_visit: dias(9), spend_cents: 66300 },
  };
}
const AMOSTRA_LISTA = [
  { contact_key: "sample", name: "Maria Silva", contact: "+1 718 555 0142" },
  { contact_key: "sample2", name: "Mariana Costa", contact: "mariana@example.com" },
];

export default function DeskClientes({ email = "", dataKey = "", conectado = false, tz = TZ_PADRAO, initialContact = null, onBook }) {
  const fuso = tz || TZ_PADRAO;
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState({ fase: "parado", lista: [] }); // parado | procurando | ok | falhou
  const [aberto, setAberto] = useState(initialContact ? { contact: initialContact, name: "" } : null);
  const [ficha, setFicha] = useState(() => (!initialContact ? { fase: "parado", d: null } : conectado ? { fase: "lendo", d: null } : { fase: "ok", d: amostra() }));
  const [seq, setSeq] = useState(0);
  const [editando, setEditando] = useState(false);
  const pedido = useRef(0);
  // juntar duplicados (desk_v15): só a dona
  const dona = !ehRecepcao(dataKey);
  const [juntar, setJuntar] = useState(null);        // { keep, drop }
  const [escolher, setEscolher] = useState(false);
  const [dupSeq, setDupSeq] = useState(0);

  // Abrir direto pela prop (a agenda manda "abre a ficha da Maria") — também quando a prop muda depois.
  const [ultimoInicial, setUltimoInicial] = useState(initialContact);
  if (initialContact !== ultimoInicial) {
    setUltimoInicial(initialContact);
    if (initialContact) { setAberto({ contact: initialContact, name: "" }); setEditando(false); }
  }

  // Busca com espera de 300ms. Sem conexão: filtra a amostra, sem rede.
  useEffect(() => {
    const s = q.trim();
    if (!buscaValida(s)) { setBusca({ fase: "parado", lista: [] }); return undefined; }
    const meu = ++pedido.current;
    setBusca((b) => ({ fase: "procurando", lista: b.lista }));
    const timer = setTimeout(async () => {
      if (!conectado) {
        const n = s.toLowerCase();
        setBusca({ fase: "ok", lista: AMOSTRA_LISTA.filter((c) => `${c.name} ${c.contact}`.toLowerCase().includes(n)) });
        return;
      }
      const { d } = await chamarDesk(email, dataKey, { action: "client_search", q: s });
      if (meu !== pedido.current) return;
      const lista = Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : Array.isArray(d?.clients) ? d.clients : null;
      setBusca(lista ? { fase: "ok", lista } : { fase: "falhou", lista: [] });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, conectado, email, dataKey]);

  // Leitura da ficha.
  useEffect(() => {
    let vivo = true;
    if (!aberto?.contact) { setFicha({ fase: "parado", d: null }); return () => { vivo = false; }; }
    if (!conectado) { setFicha({ fase: "ok", d: amostra() }); return () => { vivo = false; }; }
    setFicha((f) => ({ fase: f.d && f.d._contact === aberto.contact ? "relendo" : "lendo", d: f.d && f.d._contact === aberto.contact ? f.d : null }));
    chamarDesk(email, dataKey, { action: "client_card", contact: aberto.contact }).then(({ d }) => {
      if (!vivo) return;
      if (d?.ok) setFicha({ fase: "ok", d: { ...d, _contact: aberto.contact } });
      else setFicha((f) => ({ fase: "falhou", d: f.d }));
    });
    return () => { vivo = false; };
  }, [aberto, conectado, email, dataKey, seq]);

  const recarregar = useCallback(() => setSeq((n) => n + 1), []);
  const abrir = (c) => { setAberto({ contact: c.contact, name: c.name || "" }); setEditando(false); };

  return (
    <div className="space-y-4">
      <p className="text-xs text-g-muted max-w-md">{t("sub")}</p>
      {!conectado && <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] px-4 py-2.5 text-xs text-g-light">{t("sample")}</div>}
      {dona && <DuplicadosAviso email={email} dataKey={dataKey} conectado={conectado} tz={fuso} seq={dupSeq} onComparar={(keep, drop) => setJuntar({ keep, drop })} />}

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* busca + resultados */}
        <div className={`space-y-2 ${aberto ? "hidden lg:block" : ""}`}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh")} aria-label={t("searchPh")} autoFocus={!initialContact}
            className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm text-g-word placeholder:text-g-muted" />
          <div className="rounded-xl2 border border-white/10 bg-white/[0.03] overflow-hidden">
            {busca.fase === "parado" && <div className="px-4 py-6 text-center text-xs text-g-muted">{t("searchHint")}</div>}
            {busca.fase === "procurando" && busca.lista.length === 0 && <div className="px-4 py-6 text-center text-xs text-g-muted animate-pulse">{t("searching")}</div>}
            {busca.fase === "falhou" && <div role="alert" className="px-4 py-6 text-center text-xs text-red-300">{t("searchFail")}</div>}
            {busca.fase === "ok" && busca.lista.length === 0 && <div className="px-4 py-6 text-center text-xs text-g-muted">{t("noResults")}</div>}
            {busca.lista.length > 0 && (
              <ul className={`divide-y divide-white/[0.06] ${busca.fase === "procurando" ? "opacity-60" : ""}`}>
                {busca.lista.map((c) => {
                  const ativo = aberto?.contact === c.contact;
                  return (
                    <li key={c.contact_key || c.contact}>
                      <button type="button" onClick={() => abrir(c)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.05] ${ativo ? "bg-g-green/10" : ""}`}>
                        <Inicial nome={c.name} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-g-word truncate">{c.name || "—"}</div>
                          <div className="text-[11px] text-g-muted truncate">{c.contact}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* a ficha */}
        <div className="min-w-0">
          {aberto && (
            <button type="button" onClick={() => setAberto(null)} className="lg:hidden mb-2 inline-flex items-center pr-3 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-muted hover:text-g-word">‹ {t("back")}</button>
          )}
          {!aberto && <Card className="hidden lg:block"><p className="text-sm text-g-muted">{t("pickOne")}</p></Card>}
          {aberto && ficha.fase === "lendo" && <SectionSkeleton rows={4} />}
          {aberto && ficha.fase === "falhou" && !ficha.d && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-xl2 border border-red-400/30 bg-red-400/[0.06] px-4 py-2.5 text-xs text-red-300">
              <span>{t("readFail")}</span>
              <button onClick={recarregar} className="font-bold text-g-word underline">{t("retry")}</button>
            </div>
          )}
          {aberto && ficha.d && (ficha.fase === "ok" || ficha.fase === "relendo" || ficha.fase === "falhou") && (
            <Ficha d={ficha.d} contato={aberto.contact} nomeBusca={aberto.name} tz={fuso} conectado={conectado} email={email} dataKey={dataKey}
              falhou={ficha.fase === "falhou"} recarregar={recarregar} dona={dona} onJuntar={() => setEscolher(true)}
              onBook={onBook} onEdit={() => (conectado ? setEditando(true) : toast(t("sampleBlocked")))} />
          )}
        </div>
      </div>

      {escolher && aberto && (
        <EscolherOutraFicha email={email} dataKey={dataKey} conectado={conectado} contatoAtual={aberto.contact} keyAtual={ficha.d?.contact_key}
          amostraLista={AMOSTRA_LISTA} onClose={() => setEscolher(false)} onEscolher={(c) => { setEscolher(false); setJuntar({ keep: aberto.contact, drop: c }); }} />
      )}
      {juntar && (
        <JuntarDrawer email={email} dataKey={dataKey} conectado={conectado} tz={fuso} keep={juntar.keep} drop={juntar.drop}
          onClose={() => setJuntar(null)} onMerged={() => { recarregar(); setDupSeq((n) => n + 1); }}
          onAbrir={(c) => { setJuntar(null); setAberto({ contact: c, name: "" }); setEditando(false); }} />
      )}
      {editando && ficha.d && (
        <EditarFicha d={ficha.d} contato={aberto?.contact} email={email} dataKey={dataKey}
          onClose={() => setEditando(false)} onSaved={() => { setEditando(false); recarregar(); }} />
      )}
    </div>
  );
}

function Inicial({ nome, grande = false }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-g-gold/80 font-black text-[#161512] ${grande ? "h-12 w-12 text-lg" : "h-8 w-8 text-xs"}`}>
      {(String(nome || "?").trim()[0] || "?").toUpperCase()}
    </span>
  );
}

/** Aniversário: { dist (dias até o próximo), texto } — no fuso da unidade. */
function aniversario(birth, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birth || ""));
  if (!m) return null;
  const ms = (dia) => { const [y, mo, dd] = dia.split("-").map(Number); return Date.UTC(y, mo - 1, dd); };
  const hoje = diaDe(new Date(), tz);
  const ano = Number(hoje.slice(0, 4));
  let alvo = `${ano}-${m[2]}-${m[3]}`;
  if (alvo < hoje) alvo = `${ano + 1}-${m[2]}-${m[3]}`;
  const dist = Math.round((ms(alvo) - ms(hoje)) / 86400000);
  const texto = new Date(Date.UTC(2000, +m[2] - 1, +m[3], 12)).toLocaleDateString(locale(), { day: "numeric", month: "short", timeZone: "UTC" });
  return { dist, texto };
}

function Badge({ cor, children }) {
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${cor}22`, color: cor, border: `1px solid ${cor}55` }}>{children}</span>;
}

/* CR-11 (2026-10-13): permissão para OFERTAS, REGISTRADA (db/consentimento.sql). A coluna presumida do CRM
   (consent_sms nasce TRUE) não aparece mais aqui como "Sim": só o que foi registrado — site, balcão, ligação —
   conta, com fonte e data, e é isso que a campanha por telefone lê. Toque = registro novo com prova "Balcão". */
function Consentimento({ email, dataKey, contato, conectado, t, tz }) {
  // amostra (sem conta ligada) nasce "ok e vazia"; conta real nasce "lendo" e só muda quando o servidor responder
  const [st, setSt] = useState(() => (conectado && contato ? { fase: "lendo", c: null } : { fase: "ok", c: {} }));
  useEffect(() => {
    if (!conectado || !contato) return undefined;
    let vivo = true;
    chamarDesk(email, dataKey, { action: "consent_get", contact: contato }).then(({ d }) => { if (vivo) setSt(d?.ok ? { fase: "ok", c: d.consent || {} } : { fase: "falhou", c: null }); });
    return () => { vivo = false; };
  }, [email, dataKey, contato, conectado]);
  const gravar = async (canal, granted) => {
    if (!conectado) { toast(t("sampleBlocked")); return; }
    const { d } = await chamarDesk(email, dataKey, { action: "consent_set", contact: contato, channel: canal, granted, evidence: `Balcão · ${new Date().toISOString()}` });
    if (d?.ok) { setSt({ fase: "ok", c: d.consent || {} }); toast(t("consentSaved")); } else toast(motivo(d) || t("consentFail"));
  };
  const linha = (canal, rot) => {
    const v = st.c && st.c[canal];
    return (
      <div key={canal} className="flex items-center justify-between gap-3">
        <span className="text-g-muted">{rot}{v ? <span className="block text-[10px]">{v.source} · {soDia(v.at, tz)}</span> : <span className="block text-[10px]">{t("consentNone")}</span>}</span>
        <span className="flex gap-1">
          {[[true, t("yes")], [false, t("no")]].map(([g, lab]) => (
            <button key={String(g)} type="button" onClick={() => gravar(canal, g)} aria-pressed={!!v && v.granted === g}
              className={`rounded-full border px-2.5 py-1 min-h-[32px] text-[11px] font-bold ${v && v.granted === g ? (g ? "border-g-green text-g-green" : "border-[#e0855f] text-[#e0855f]") : "border-white/15 text-g-muted"}`}>{lab}</button>
          ))}
        </span>
      </div>
    );
  };
  return (
    <div className="grid gap-1.5 pt-1">
      <div className="text-[10px] uppercase tracking-wide text-g-muted">{t("consentTitle")}</div>
      {st.fase === "falhou" ? <div className="text-[#e0855f]">{t("consentFail")}</div> : <>{linha("sms", t("consentSms"))}{linha("call", t("consentCall"))}</>}
      <p className="text-[10px] text-g-muted">{t("consentHint")}</p>
    </div>
  );
}

function Ficha({ d, contato, nomeBusca, tz, conectado, falhou, recarregar, onBook, onEdit, email = "", dataKey = "", dona = false, onJuntar }) {
  const [aba, setAba] = useState("history");
  const p = d.profile || {};
  const crm = d.crm || {};
  const tot = d.totals || {};
  const nome = p.name || crm.name || nomeBusca || contato || "—";
  const fone = p.phone || crm.phone || "";
  const mail = p.email || crm.email || "";
  const aniv = aniversario(crm.birth_date, tz);
  const visitas = Array.isArray(d.visits) ? d.visits : [];
  const vendas = Array.isArray(d.sales) ? d.sales : [];
  const pacotes = Array.isArray(d.packages) ? d.packages : [];
  const vales = Array.isArray(d.gift_cards) ? d.gift_cards : [];
  const fichas = Array.isArray(d.forms) ? d.forms : [];
  const tags = Array.isArray(p.tags) ? p.tags : [];

  const abas = [
    ["history", visitas.length], ["purchases", vendas.length], ["balances", pacotes.length + vales.length], ["forms", fichas.length], ["notes", null],
  ];

  return (
    <div className="space-y-3">
      {falhou && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl2 border border-red-400/30 bg-red-400/[0.06] px-4 py-2 text-xs text-red-300">
          <span>{t("readFail")}</span><button onClick={recarregar} className="font-bold text-g-word underline">{t("retry")}</button>
        </div>
      )}

      {/* cabeçalho */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Inicial nome={nome} grande />
            <div className="min-w-0">
              <div className="text-lg font-extrabold text-g-word truncate">{nome}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-g-muted">
                {fone && <a href={`tel:${fone.replace(/[^\d+]/g, "")}`} className="inline-block py-3 lg:py-0 [@media(pointer:coarse)]:py-3 hover:text-g-word num">{fone}</a>}
                {mail && <a href={`mailto:${mail}`} className="inline-block max-w-full py-3 lg:py-0 [@media(pointer:coarse)]:py-3 hover:text-g-word truncate">{mail}</a>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.trusted && <Badge cor="#2FE39A">✓ {t("trusted")}</Badge>}
                {p.can_book_online === false && <Badge cor="#FF8A5A">⛔ {t("noOnline")}</Badge>}
                {aniv && <Badge cor={aniv.dist <= 14 ? "#FFC23D" : "#8E8A80"}>🎂 {aniv.dist === 0 ? t("birthdayToday") : aniv.dist <= 14 ? `${t("birthdaySoon")} · ${aniv.texto}` : `${t("birthday")} · ${aniv.texto}`}</Badge>}
                {tags.map((tg) => <Badge key={tg} cor="#D6C29A">{tg}</Badge>)}
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onEdit} className="rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word hover:bg-white/[0.06]">✎ {t("edit")}</button>
            {dona && onJuntar && <BotaoJuntar onClick={onJuntar} />}
            {onBook && (
              <button type="button" onClick={() => onBook({ name: nome, contact: fone || mail || contato })}
                className="rounded-full bg-g-green px-4 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-extrabold text-[#161512]">{t("book")}</button>
            )}
          </div>
        </div>
        {!d.profile && conectado && <div className="mt-3 text-[11px] text-g-muted">{t("noProfile")}</div>}
      </Card>
      <Apelidos email={email} dataKey={dataKey} conectado={conectado} tz={tz} aliases={Array.isArray(d.aliases) ? d.aliases : []} dona={dona} recarregar={recarregar} />

      {/* faixa âmbar: alergias e alertas */}
      {(p.allergies || p.alerts) && (
        <div role="note" className="rounded-xl2 border border-amber-400/50 bg-amber-400/[0.12] px-4 py-3 space-y-1.5">
          {p.allergies && (
            <div className="flex gap-2 text-sm"><span aria-hidden>⚠️</span><span><b className="text-amber-200 uppercase text-[11px] tracking-wide mr-1.5">{t("allergies")}</b><span className="text-amber-50 font-bold">{p.allergies}</span></span></div>
          )}
          {p.alerts && (
            <div className="flex gap-2 text-sm"><span aria-hidden>🔔</span><span><b className="text-amber-200 uppercase text-[11px] tracking-wide mr-1.5">{t("alerts")}</b><span className="text-amber-50">{p.alerts}</span></span></div>
          )}
        </div>
      )}

      {/* números */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        {[
          ["visits", tot.visits ?? 0, "#F2EBDD"],
          ["spend", dinheiro(tot.spend_cents, tz), "#2FE39A"],
          ["noShows", tot.no_shows ?? 0, (tot.no_shows || 0) > 0 ? "#FF5A5A" : "#F2EBDD"],
          ["cancels", tot.cancellations ?? 0, "#F2EBDD"],
          ["lastVisit", soDia(tot.last_visit, tz), "#F2EBDD"],
          ["nextVisit", soDia(tot.next_visit, tz), tot.next_visit ? "#3FB4FF" : "#8E8A80"],
        ].map(([k, v, c]) => (
          <Card key={k} className="!p-3">
            <div className="text-[10px] uppercase tracking-wide text-g-muted">{t(k)}</div>
            <div className="text-base font-extrabold num mt-0.5 truncate" style={{ color: c }}>{v}</div>
          </Card>
        ))}
      </div>

      {/* abas */}
      <div className="flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.04] p-0.5 w-fit max-w-full" role="tablist">
        {abas.map(([k, n]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] rounded-full text-xs font-bold ${aba === k ? "bg-g-green/20 text-g-word" : "text-g-muted hover:text-g-word"}`}>
            {t(`tab_${k}`)}{n ? <span className="ml-1 text-g-muted num">{n}</span> : null}
          </button>
        ))}
      </div>

      <div className="rounded-xl2 border border-white/10 bg-white/[0.03] overflow-hidden" role="tabpanel">
        {aba === "history" && (visitas.length === 0 ? <Vazio k="noVisits" /> : (
          <ul className="divide-y divide-white/[0.06]">
            {visitas.map((v) => {
              const c = ST_COR[v.status] || "#8E8A80";
              return (
                <li key={v.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{v.service || "—"}</div>
                    <div className="text-[11px] text-g-muted">{diaHora(v.start, tz)}{v.pro ? ` · ${v.pro}` : ""}</div>
                    {v.note && <div className="mt-0.5 text-[11px] text-g-light">“{v.note}”</div>}
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: `${c}22`, color: c }}>{rotulo("st_", v.status)}</span>
                </li>
              );
            })}
          </ul>
        ))}

        {aba === "purchases" && (vendas.length === 0 ? <Vazio k="noSales" /> : (
          <ul className="divide-y divide-white/[0.06]">
            {vendas.map((s) => {
              const anulada = /void|refund/.test(String(s.status || ""));
              const itens = Array.isArray(s.items) ? s.items.map((i) => (typeof i === "string" ? i : i?.name || "")).filter(Boolean).join(", ") : String(s.items || "");
              return (
                <li key={s.id} className={`flex items-start justify-between gap-3 px-4 py-2.5 ${anulada ? "opacity-60" : ""}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{s.number ? `#${s.number} · ` : ""}{itens || "—"}</div>
                    <div className="text-[11px] text-g-muted">{diaHora(s.at, tz)}{s.tip_cents ? ` · ${dinheiro(s.tip_cents, tz)} ${t("tip")}` : ""}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-extrabold num ${anulada ? "line-through text-g-muted" : "text-g-word"}`}>{dinheiro(s.total_cents, tz)}</div>
                    <div className={`text-[10px] font-bold ${anulada ? "text-red-300" : "text-g-green"}`}>{rotulo("sale_", s.status)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

        {aba === "balances" && (pacotes.length + vales.length === 0 ? <Vazio k="noBalances" /> : (
          <div className="p-4 space-y-4">
            {pacotes.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-g-muted mb-2">{t("packages")}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {pacotes.map((k) => <PacoteCartao key={k.id} k={k} tz={tz} email={email} dataKey={dataKey} conectado={conectado} recarregar={recarregar} />)}
                </div>
              </div>
            )}
            {vales.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-g-muted mb-2">{t("giftCards")}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {vales.map((g) => (
                    <div key={g.code} className={`rounded-xl border border-white/10 bg-white/[0.04] p-3 ${g.active === false ? "opacity-60" : ""}`}>
                      <div className="flex items-center justify-between gap-2"><span className="font-mono text-sm font-bold text-g-word">{g.code}</span>{g.active === false && <span className="text-[10px] font-bold text-g-muted">{t("inactive")}</span>}</div>
                      <div className="mt-1 text-xl font-extrabold num text-g-gold">{dinheiro(g.balance_cents, tz)} <span className="text-xs font-bold text-g-muted">{t("of")} {dinheiro(g.amount_cents, tz)}</span></div>
                      <div className="text-[11px] text-g-muted">{t("balance")}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {aba === "forms" && (fichas.length === 0 ? <Vazio k="noForms" /> : (
          <ul className="divide-y divide-white/[0.06]">
            {fichas.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-g-word truncate">{f.form || "—"}</div>
                  <div className="text-[11px] text-g-muted">{soDia(f.at, tz)}</div>
                </div>
                {f.signed
                  ? <span className="shrink-0 text-xs font-bold text-g-green">✓ {t("signed")}</span>
                  : <span className="shrink-0 text-xs font-bold text-amber-300">{t("notSigned")}</span>}
              </li>
            ))}
          </ul>
        ))}

        {aba === "notes" && (
          <div className="p-4 space-y-4 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-g-muted mb-1">{t("deskNotes")}</div>
              {p.notes ? <p className="whitespace-pre-wrap text-g-word">{p.notes}</p> : <p className="text-g-muted text-xs">{t("noNotes")}</p>}
            </div>
            {visitas.some((v) => v.note) && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-g-muted mb-1">{t("visitNotes")}</div>
                <ul className="space-y-1.5">
                  {visitas.filter((v) => v.note).map((v) => (
                    <li key={v.id} className="text-xs"><span className="text-g-muted">{soDia(v.start, tz)} · {v.service}</span><div className="text-g-light">“{v.note}”</div></li>
                  ))}
                </ul>
              </div>
            )}
            {(crm.first_seen_at || crm.lead_source || conectado) && (
              <div className="grid gap-1.5 border-t border-white/10 pt-3 text-xs">
                {crm.first_seen_at && <div className="flex justify-between gap-3"><span className="text-g-muted">{t("since")}</span><span className="font-bold text-g-word">{soDia(crm.first_seen_at, tz)}</span></div>}
                {crm.lead_source && <div className="flex justify-between gap-3"><span className="text-g-muted">{t("source")}</span><span className="font-bold text-g-word">{crm.lead_source}</span></div>}
                <Consentimento email={email} dataKey={dataKey} contato={contato} conectado={conectado} t={t} tz={tz} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Um pacote da cliente: saldo, validade, estado e — só para a dona — mudar a data de vencimento (desk_v13).
function PacoteCartao({ k, tz, email, dataKey, conectado, recarregar }) {
  const total = Number(k.total) || 0; const resta = Number(k.left) || 0;
  const st = k.status || (resta > 0 ? "active" : "exhausted");
  const vencido = st === "expired";
  const [edit, setEdit] = useState(false);
  const [data, setData] = useState(() => (k.expires_at ? diaDe(new Date(k.expires_at), tz) : ""));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const dona = conectado && !ehRecepcao(dataKey);
  const salvar = async (semVencimento) => {
    if (!semVencimento && !data) { setErro(t("pickDate")); return; }
    setOcupado(true); setErro("");
    // fim do dia escolhido, no fuso da unidade — "vence em 30/11" vale o dia 30 inteiro
    const expires_at = semVencimento ? null : paraUtc(data, 23 * 60 + 59, tz).toISOString();
    const { http, d } = await chamarDesk(email, dataKey, { action: "package_edit", id: k.id, expires_at });
    setOcupado(false);
    if (d?.ok !== true) { setErro(motivo(d, http)); return; }
    setEdit(false); recarregar();
  };
  const cor = vencido ? "#F08A7E" : resta > 0 ? "#2FE39A" : "#8E8A80";
  return (
    <div className={`rounded-xl border p-3 ${vencido ? "border-red-300/25 bg-white/[0.02]" : "border-white/10 bg-white/[0.04]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`text-sm font-bold truncate ${vencido ? "text-g-muted" : "text-g-word"}`}>{k.name}</div>
        {(vencido || st === "exhausted") && <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ color: cor, borderColor: `${cor}55` }}>{t(`st_${st}`)}</span>}
      </div>
      <div className="mt-1 text-xl font-extrabold num" style={{ color: cor }}>{resta} <span className="text-xs font-bold text-g-muted">{t("of")} {total} {t("sessionsLeft")}</span></div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full" style={{ background: cor, width: `${total ? Math.min(100, (resta / total) * 100) : 0}%` }} /></div>
      <div className="mt-1.5 text-[11px] text-g-muted">{t("boughtOn")} {soDia(k.purchased_at, tz)}</div>
      <div className={`text-[11px] ${vencido ? "text-red-300 font-bold" : "text-g-muted"}`}>
        {st === "not_activated" ? t("notActivated") : k.expires_at ? `${t(vencido ? "expiredOn" : "expiresOn")} ${soDia(k.expires_at, tz)}` : t("noExpiry")}
      </div>
      {dona && !edit && st !== "exhausted" && (
        <button type="button" onClick={() => { setEdit(true); setErro(""); }} className="mt-2 text-[11px] font-bold text-g-green underline min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px]">{t("changeExpiry")}</button>
      )}
      {edit && (
        <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-g-muted">{t("newExpiry")}
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 text-sm text-g-word outline-none focus:border-g-green/50 [color-scheme:dark]" />
          </label>
          <div className="text-[11px] text-g-muted">{t("expiryHint")}</div>
          {erro && <div role="alert" className="rounded-lg border border-red-300/40 bg-red-300/[0.08] px-2.5 py-1.5 text-[11px] text-red-200">{erro}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={ocupado} onClick={() => salvar(false)} className="rounded-full bg-g-green px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-black text-[#161512] disabled:opacity-50">{t("saveExpiry")}</button>
            {k.expires_at && <button type="button" disabled={ocupado} onClick={() => salvar(true)} className="rounded-full border border-white/15 px-3 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-word disabled:opacity-50">{t("removeExpiry")}</button>}
            <button type="button" disabled={ocupado} onClick={() => setEdit(false)} className="px-2 py-1.5 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-xs font-bold text-g-muted">{t("cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Vazio({ k }) {
  return <div className="px-4 py-8 text-center text-xs text-g-muted">{t(k)}</div>;
}

function Chave({ ligado, onChange, titulo, ajuda }) {
  return (
    <button type="button" role="switch" aria-checked={!!ligado} onClick={() => onChange(!ligado)}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left">
      <span className="min-w-0"><span className="block text-sm font-bold text-g-word">{titulo}</span><span className="block text-[11px] text-g-muted">{ajuda}</span></span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${ligado ? "bg-g-green" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${ligado ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function EditarFicha({ d, contato, email, dataKey, onClose, onSaved }) {
  const p = d.profile || {};
  const inicial = {
    allergies: p.allergies || "", alerts: p.alerts || "", notes: p.notes || "",
    tags: Array.isArray(p.tags) ? p.tags : [], trusted: !!p.trusted, can_book_online: p.can_book_online !== false,
  };
  const [f, setF] = useState(inicial);
  const [tag, setTag] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const muda = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const addTag = () => {
    const v = tag.trim().replace(/,$/, "");
    if (v && !f.tags.some((x) => x.toLowerCase() === v.toLowerCase())) muda("tags", [...f.tags, v]);
    setTag("");
  };

  const salvar = async () => {
    const data = {};
    ["allergies", "alerts", "notes"].forEach((k) => { if (f[k].trim() !== inicial[k].trim()) data[k] = f[k].trim(); });
    if (f.trusted !== inicial.trusted) data.trusted = f.trusted;
    if (f.can_book_online !== inicial.can_book_online) data.can_book_online = f.can_book_online;
    if (JSON.stringify(f.tags) !== JSON.stringify(inicial.tags)) data.tags = f.tags;
    if (!Object.keys(data).length) { toast(t("nothingChanged")); return; }
    setOcupado(true);
    const { http, d: r } = await chamarDesk(email, dataKey, { action: "client_save", contact: contato, data });
    setOcupado(false);
    if (r?.ok === true) { toast(t("saved")); onSaved(); } else toast(motivo(r, http));
  };

  const campo = "mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-g-word placeholder:text-g-muted";
  return (
    <Drawer title={t("editTitle")} subtitle={p.name || contato} onClose={onClose}
      actions={<>
        <button disabled={ocupado} onClick={salvar} className="rounded-full bg-g-green px-4 py-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm font-extrabold text-[#161512] disabled:opacity-40">{t("save")}</button>
        <button disabled={ocupado} onClick={onClose} className="rounded-full border border-white/15 px-4 py-2 min-h-[40px] lg:min-h-0 [@media(pointer:coarse)]:min-h-[40px] text-sm font-bold text-g-muted">{t("cancel")}</button>
      </>}>
      <div className="space-y-3">
        <label className="block text-[10px] uppercase tracking-wide text-amber-300">⚠️ {t("allergies")}
          <textarea value={f.allergies} onChange={(e) => muda("allergies", e.target.value)} rows={2} placeholder={t("allergiesPh")} className={`${campo} border-amber-400/30`} />
        </label>
        <label className="block text-[10px] uppercase tracking-wide text-amber-300">🔔 {t("alerts")}
          <textarea value={f.alerts} onChange={(e) => muda("alerts", e.target.value)} rows={2} placeholder={t("alertsPh")} className={`${campo} border-amber-400/30`} />
        </label>
        <label className="block text-[10px] uppercase tracking-wide text-g-muted">{t("deskNotes")}
          <textarea value={f.notes} onChange={(e) => muda("notes", e.target.value)} rows={4} placeholder={t("notesPh")} className={campo} />
        </label>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-g-muted">{t("tags")}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {f.tags.map((tg) => (
              <span key={tg} className="inline-flex items-center gap-1 rounded-full border border-g-gold/40 bg-g-gold/10 px-2.5 py-1 text-[11px] font-bold text-g-gold">
                {tg}<button type="button" aria-label={`${t("removeTag")}: ${tg}`} onClick={() => muda("tags", f.tags.filter((x) => x !== tg))} className="-my-1 -mr-1.5 grid place-items-center min-w-[32px] min-h-[32px] text-g-muted hover:text-g-word">✕</button>
              </span>
            ))}
          </div>
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t("tagPh")} className={campo}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }} onBlur={addTag} />
        </div>
        <Chave ligado={f.trusted} onChange={(v) => muda("trusted", v)} titulo={t("trusted")} ajuda={t("trustedHelp")} />
        <Chave ligado={f.can_book_online} onChange={(v) => muda("can_book_online", v)} titulo={t("onlineLabel")} ajuda={t("onlineHelp")} />
      </div>
    </Drawer>
  );
}
