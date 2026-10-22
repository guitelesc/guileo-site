// Comum a todas as telas do GUILEO DESK (2026-10-05). Uma porta só para /api/desk, dinheiro no
// idioma e na moeda certos, e fuso da UNIDADE (nunca o do navegador).
import { UI_LANG } from "../pages/Portal.jsx";

export const LOCALE = { pt: "pt-BR", es: "es-ES", hi: "hi-IN", en: "en-US" };
export const lang = () => (["pt", "es", "hi"].includes(UI_LANG) ? UI_LANG : "en");
export const loc = () => LOCALE[lang()];
/** Texto nos 4 idiomas: tx({en, pt, es, hi}) — cai no inglês se faltar. */
export const tx = (o) => (o && (o[lang()] || o.en)) || "";

/** Recepcionista entrou com o código próprio ("bal_…", functions/lib/deskAcesso.js): a tela mostra só o dia. */
export const ehRecepcao = (k) => /^bal_[a-z2-7]{26}$/.test(String(k || ""));

/** POST /api/desk. Devolve { http, d } — `d` é o JSON (ou null). Nunca lança. */
export async function chamarDesk(email, key, corpo) {
  try {
    const r = await fetch("/api/desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key, lang: lang(), ...corpo }) });
    const d = await r.json().catch(() => null);
    return { http: r.status, d };
  } catch { return { http: 0, d: null }; }
}

const BR_TZ = /Sao_Paulo|Cuiaba|Fortaleza|Recife|Bahia|Manaus|Belem|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Maceio|Noronha/;
export const moedaDo = (tz) => (BR_TZ.test(tz || "") ? "BRL" : "USD");
/** centavos → "US$ 140" / "$140.00". `zeroTraco`: 0 vira "—". */
export const dinheiro = (cents, tz, { zeroTraco = false, casas = 2 } = {}) => {
  const n = Number(cents) || 0;
  if (zeroTraco && n === 0) return "—";
  return new Intl.NumberFormat(loc(), { style: "currency", currency: moedaDo(tz), minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n / 100);
};
/** "140", "140,50", "140.50" → 14050 centavos (ou null). */
export const centavos = (txt) => {
  const s = String(txt ?? "").trim().replace(/[^\d.,]/g, "");
  if (!s) return null;
  const norm = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Math.round(parseFloat(norm) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// ── fuso da unidade ──────────────────────────────────────────────────────────────────────────
export const partes = (date, tz) => {
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(date).forEach((x) => { p[x.type] = x.value; });
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd };
};
/** "YYYY-MM-DD" + minuto do dia, na parede da unidade → Date (UTC). Duas passadas acertam o horário de verão. */
export const paraUtc = (dia, minuto, tz) => {
  const [y, m, d] = dia.split("-").map(Number);
  const alvo = Date.UTC(y, m - 1, d, Math.floor(minuto / 60), minuto % 60);
  let g = alvo;
  for (let i = 0; i < 2; i++) { const p = partes(new Date(g), tz); g -= Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - alvo; }
  return new Date(g);
};
export const diaDe = (date, tz) => { const p = partes(date, tz); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };
export const minutoDe = (iso, tz) => { const p = partes(new Date(iso), tz); return p.h * 60 + p.mi; };
export const somaDias = (dia, n) => { const [y, m, d] = dia.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const diaDaSemana = (dia) => { const [y, m, d] = dia.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const hhmm = (min) => new Date(Date.UTC(2000, 0, 1, Math.floor(min / 60), min % 60)).toLocaleTimeString(loc(), { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
/** Instante ISO → "seg., 6 de out. · 14:00" no fuso da unidade. */
export const quando = (iso, tz, op = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) => {
  try { return new Date(iso).toLocaleString(loc(), { timeZone: tz, ...op }); } catch { return ""; }
};

/** Motivo técnico do banco → frase para a recepção (4 idiomas). */
const MOTIVO = {
  slot_taken: { en: "That time is already taken.", pt: "Esse horário já está ocupado.", es: "Ese horario ya está ocupado.", hi: "वह समय पहले से बुक है।" },
  closed_date: { en: "The business is closed at that time.", pt: "O negócio está fechado nesse horário.", es: "El negocio está cerrado en ese horario.", hi: "उस समय व्यवसाय बंद है।" },
  payment_mismatch: { en: "Payments don't add up to the total.", pt: "Os pagamentos não fecham com o total.", es: "Los pagos no suman el total.", hi: "भुगतान कुल से मेल नहीं खाते।" },
  giftcard_not_found: { en: "Gift card code not found.", pt: "Código do vale-presente não encontrado.", es: "Código de tarjeta regalo no encontrado.", hi: "गिफ्ट कार्ड कोड नहीं मिला।" },
  giftcard_balance: { en: "Not enough balance on that gift card.", pt: "Saldo insuficiente no vale-presente.", es: "Saldo insuficiente en la tarjeta regalo.", hi: "गिफ्ट कार्ड में पर्याप्त शेष नहीं है।" },
  package_empty: { en: "That package has no sessions left.", pt: "Esse pacote não tem mais sessões.", es: "Ese paquete no tiene más sesiones.", hi: "इस पैकेज में कोई सत्र नहीं बचा।" },
  out_of_stock: { en: "Out of stock.", pt: "Sem estoque.", es: "Sin stock.", hi: "स्टॉक खत्म।" },
  package_needs_contact: { en: "Add the client's phone or email to sell a package.", pt: "Informe telefone ou e-mail da cliente para vender pacote.", es: "Agrega teléfono o correo de la clienta para vender un paquete.", hi: "पैकेज बेचने के लिए ग्राहक का फ़ोन या ईमेल जोड़ें।" },
  giftcard_amount: { en: "Gift card amount must be at least 1.00.", pt: "O vale-presente precisa ter pelo menos 1,00.", es: "La tarjeta regalo debe ser de al menos 1,00.", hi: "गिफ्ट कार्ड कम से कम 1.00 का होना चाहिए।" },
  package_used: { en: "Can't refund: sessions of this package were already used.", pt: "Não dá para estornar: o pacote já teve sessão usada.", es: "No se puede reembolsar: ya se usaron sesiones del paquete.", hi: "रिफंड नहीं हो सकता: पैकेज के सत्र पहले ही इस्तेमाल हो चुके हैं।" },
  giftcard_used: { en: "Can't refund: the gift card sold here was already used.", pt: "Não dá para estornar: o vale vendido aqui já foi usado.", es: "No se puede reembolsar: la tarjeta regalo ya se usó.", hi: "रिफंड नहीं हो सकता: यह गिफ्ट कार्ड पहले ही इस्तेमाल हो चुका है।" },
  payments_not_connected: { en: "Connect your Stripe at guileoai.com/receber to charge online.", pt: "Conecte o seu Stripe em guileoai.com/receber para cobrar online.", es: "Conecta tu Stripe en guileoai.com/receber para cobrar en línea.", hi: "ऑनलाइन चार्ज के लिए guileoai.com/receber पर Stripe जोड़ें।" },
  no_deposit_configured: { en: "This service has no deposit set. Set it under Front desk → Team → Services.", pt: "Este serviço não tem sinal definido. Defina em Balcão → Equipe → Serviços.", es: "Este servicio no tiene depósito. Defínelo en Recepción → Equipo → Servicios.", hi: "इस सेवा का डिपॉज़िट तय नहीं है।" },
  already_paid: { en: "Deposit already paid.", pt: "Sinal já pago.", es: "Depósito ya pagado.", hi: "डिपॉज़िट पहले ही चुका दिया गया।" },
  name_required: { en: "Write a name.", pt: "Escreva um nome.", es: "Escribe un nombre.", hi: "नाम लिखें।" },
  // casal / grupo (desk_v9)
  group_size: { en: "A group booking needs 2 to 6 people.", pt: "Marcação em grupo é de 2 a 6 pessoas.", es: "Una reserva de grupo es de 2 a 6 personas.", hi: "ग्रुप बुकिंग में 2 से 6 लोग होने चाहिए।" },
  invalid_item: { en: "Check each person: name, service, professional and time.", pt: "Confira cada pessoa: nome, serviço, profissional e horário.", es: "Revisa cada persona: nombre, servicio, profesional y hora.", hi: "हर व्यक्ति जाँचें: नाम, सेवा, प्रोफ़ेशनल और समय।" },
  location_not_found: { en: "Pick a location first.", pt: "Escolha a unidade primeiro.", es: "Elige la sede primero.", hi: "पहले लोकेशन चुनें।" },
  resource_unavailable: { en: "No room or equipment free for that service at that time.", pt: "Nenhuma sala ou equipamento livre para esse serviço nesse horário.", es: "No hay sala ni equipo libre para ese servicio en ese horario.", hi: "उस समय उस सेवा के लिए कोई कमरा या उपकरण खाली नहीं।" },
  // falta automática (desk_v12)
  not_no_show: { en: "This booking isn't marked as a no-show.", pt: "Este agendamento não está marcado como falta.", es: "Esta reserva no está marcada como inasistencia.", hi: "यह बुकिंग नो-शो के रूप में चिह्नित नहीं है।" },
  invalid_minutes: { en: "Minutes must be between 0 and 240.", pt: "Os minutos têm que ficar entre 0 e 240.", es: "Los minutos deben estar entre 0 y 240.", hi: "मिनट 0 से 240 के बीच होने चाहिए।" },
  // pacotes (desk_v13)
  package_expired: { en: "That package has expired.", pt: "Esse pacote venceu.", es: "Ese paquete venció.", hi: "वह पैकेज समाप्त हो गया है।" },
  package_short: { en: "Not enough sessions left on that package for this service.", pt: "Esse pacote não tem sessões suficientes para este serviço.", es: "Ese paquete no tiene sesiones suficientes para este servicio.", hi: "इस सेवा के लिए उस पैकेज में पर्याप्त सत्र नहीं बचे।" },
  invalid_date: { en: "That date isn't valid.", pt: "Essa data não é válida.", es: "Esa fecha no es válida.", hi: "वह तारीख़ मान्य नहीं है।" },
  nothing_to_change: { en: "Nothing to change.", pt: "Nada para mudar.", es: "Nada que cambiar.", hi: "बदलने के लिए कुछ नहीं।" },
  // cupom no caixa (desk_v14) — a tela do caixa completa com a data / o limite / o valor quando o banco manda
  coupon_not_found: { en: "No coupon with that code. Check the spelling.", pt: "Nenhum cupom com esse código. Confira a escrita.", es: "No hay cupón con ese código. Revisa cómo se escribe.", hi: "उस कोड का कोई कूपन नहीं। स्पेलिंग जाँचें।" },
  coupon_inactive: { en: "This coupon is turned off.", pt: "Este cupom está desligado.", es: "Este cupón está desactivado.", hi: "यह कूपन बंद है।" },
  coupon_not_started: { en: "This coupon isn't valid yet.", pt: "Este cupom ainda não começou a valer.", es: "Este cupón aún no es válido.", hi: "यह कूपन अभी मान्य नहीं है।" },
  coupon_expired: { en: "This coupon has expired.", pt: "Este cupom venceu.", es: "Este cupón venció.", hi: "यह कूपन समाप्त हो गया है।" },
  coupon_exhausted: { en: "This coupon has reached its use limit.", pt: "Este cupom já atingiu o limite de usos.", es: "Este cupón ya llegó a su límite de usos.", hi: "यह कूपन अपनी उपयोग सीमा तक पहुँच गया है।" },
  coupon_no_base: { en: "Nothing to discount yet: add a service or product (gift cards don't take discounts).", pt: "Ainda não há o que descontar: adicione um serviço ou produto (vale-presente não leva desconto).", es: "Aún no hay qué descontar: agrega un servicio o producto (las tarjetas regalo no llevan descuento).", hi: "अभी छूट के लिए कुछ नहीं: सेवा या प्रोडक्ट जोड़ें (गिफ्ट कार्ड पर छूट नहीं)।" },
  coupon_needs_amount: { en: "This coupon has no automatic value: type how much it takes off.", pt: "Este cupom não tem valor automático: digite quanto ele desconta.", es: "Este cupón no tiene valor automático: escribe cuánto descuenta.", hi: "इस कूपन का कोई स्वचालित मूल्य नहीं: लिखें कितनी छूट है।" },
  discount_over_base: { en: "The discount is larger than what can be discounted (gift cards don't take discounts).", pt: "O desconto passou do que dá para descontar (vale-presente não leva desconto).", es: "El descuento supera lo que se puede descontar (las tarjetas regalo no llevan descuento).", hi: "छूट सीमा से ज़्यादा है (गिफ्ट कार्ड पर छूट नहीं)।" },
  // juntar fichas duplicadas (desk_v15)
  invalid_contact: { en: "That phone or email isn't valid.", pt: "Esse telefone ou e-mail não é válido.", es: "Ese teléfono o correo no es válido.", hi: "वह फ़ोन या ईमेल मान्य नहीं है।" },
  same_client: { en: "These are the same client card (same phone or email).", pt: "É a mesma ficha (mesmo telefone ou e-mail).", es: "Es la misma ficha (mismo teléfono o correo).", hi: "यह एक ही कार्ड है (वही फ़ोन या ईमेल)।" },
  already_merged: { en: "One of these cards was already merged. Open the main card and try from there.", pt: "Uma dessas fichas já foi juntada. Abra a ficha principal e tente por ela.", es: "Una de estas fichas ya se unió. Abre la ficha principal e inténtalo desde ahí.", hi: "इनमें से एक कार्ड पहले ही मिलाया जा चुका है। मुख्य कार्ड खोलें।" },
  client_not_found: { en: "I couldn't find one of these clients in your business.", pt: "Não achei uma dessas clientes no seu negócio.", es: "No encontré a una de estas clientas en tu negocio.", hi: "इनमें से एक ग्राहक आपके व्यवसाय में नहीं मिली।" },
  already_undone: { en: "This merge was already undone.", pt: "Essa junção já foi desfeita.", es: "Esa unión ya se deshizo.", hi: "यह मिलान पहले ही वापस लिया जा चुका है।" },
  undo_later_first: { en: "Undo the newer merge of these cards first.", pt: "Desfaça antes a junção mais recente dessas fichas.", es: "Deshaz antes la unión más reciente de estas fichas.", hi: "पहले इन कार्डों का नया मिलान वापस लें।" },
  // adicionais (desk_v11)
  closed_status: { en: "This booking is already closed (done, no-show or cancelled).", pt: "Este agendamento já está encerrado (concluído, faltou ou cancelado).", es: "Esta reserva ya está cerrada (hecha, no vino o cancelada).", hi: "यह बुकिंग पहले ही बंद है (पूरी, नो-शो या रद्द)।" },
  not_found: { en: "I couldn't find that booking anymore. Refresh the agenda.", pt: "Não achei mais esse agendamento. Atualize a agenda.", es: "Ya no encuentro esa reserva. Actualiza la agenda.", hi: "वह बुकिंग अब नहीं मिली। एजेंडा रीफ़्रेश करें।" },
  invalid_hours: { en: "Check the hours: the end must be after the start.", pt: "Confira os horários: o fim tem que ser depois do início.", es: "Revisa los horarios: el fin debe ser después del inicio.", hi: "समय जाँचें: अंत शुरुआत के बाद होना चाहिए।" },
  // cobrar no Stripe DO NEGÓCIO (2026-10-05, /api/desk-pagamentos)
  no_saved_card: { en: "This client has no saved card. Send her the “Save card” link first.", pt: "Esta cliente não tem cartão salvo. Mande antes o link “Salvar cartão”.", es: "Esta clienta no tiene tarjeta guardada. Envíale primero el enlace “Guardar tarjeta”.", hi: "इस ग्राहक का कोई कार्ड सेव नहीं है। पहले “कार्ड सेव करें” लिंक भेजें।" },
  no_fee_configured: { en: "This service has no no-show fee. Set it under Front desk → Team → Services.", pt: "Este serviço não tem taxa de falta. Defina em Balcão → Equipe → Serviços.", es: "Este servicio no tiene cargo por inasistencia. Defínelo en Recepción → Equipo → Servicios.", hi: "इस सेवा का नो-शो शुल्क तय नहीं है।" },
  not_no_show: { en: "Mark the appointment as no-show first.", pt: "Marque o agendamento como falta primeiro.", es: "Marca la cita como inasistencia primero.", hi: "पहले अपॉइंटमेंट को नो-शो मार्क करें।" },
  card_declined: { en: "The card was declined. Nothing was charged.", pt: "O cartão foi recusado. Nada foi cobrado.", es: "La tarjeta fue rechazada. No se cobró nada.", hi: "कार्ड अस्वीकार हुआ। कुछ भी चार्ज नहीं हुआ।" },
  permission_missing: { en: "Your Stripe key is missing a permission. Add it to the restricted key in Stripe:", pt: "Falta uma permissão na sua chave do Stripe. Acrescente na chave restrita, no Stripe:", es: "A tu clave de Stripe le falta un permiso. Agrégalo a la clave restringida en Stripe:", hi: "आपकी Stripe key में एक अनुमति नहीं है। Stripe में restricted key में जोड़ें:" },
  stripe_rejected_key: { en: "Stripe rejected your key. Connect it again at guileoai.com/receber.", pt: "O Stripe recusou a sua chave. Conecte de novo em guileoai.com/receber.", es: "Stripe rechazó tu clave. Conéctala de nuevo en guileoai.com/receber.", hi: "Stripe ने आपकी key अस्वीकार की। guileoai.com/receber पर फिर जोड़ें।" },
  stripe_error: { en: "Stripe didn't accept it. Nothing was charged.", pt: "O Stripe não aceitou. Nada foi cobrado.", es: "Stripe no lo aceptó. No se cobró nada.", hi: "Stripe ने स्वीकार नहीं किया। कुछ भी चार्ज नहीं हुआ।" },
  processing: { en: "The bank is still processing it — check again in a few minutes.", pt: "O banco ainda está processando — confira de novo em alguns minutos.", es: "El banco aún lo está procesando — revisa en unos minutos.", hi: "बैंक अभी प्रोसेस कर रहा है — कुछ मिनट में फिर देखें।" },
  no_contact: { en: "Add the client's phone or email first.", pt: "Informe antes o telefone ou e-mail da cliente.", es: "Agrega primero el teléfono o correo de la clienta.", hi: "पहले ग्राहक का फ़ोन या ईमेल जोड़ें।" },
  membership_not_found: { en: "Membership not found.", pt: "Assinatura não encontrada.", es: "Membresía no encontrada.", hi: "मेंबरशिप नहीं मिली।" },
  membership_price: { en: "This membership has no price. Set it under Recurring revenue.", pt: "Esta assinatura não tem preço. Defina em Receita recorrente.", es: "Esta membresía no tiene precio. Defínelo en Ingresos recurrentes.", hi: "इस मेंबरशिप की कीमत तय नहीं है।" },
  role_forbidden: { en: "Only the owner can do this. Ask her.", pt: "Só a dona pode fazer isso. Peça a ela.", es: "Solo la dueña puede hacer esto. Pídeselo.", hi: "यह केवल मालिक कर सकती हैं।" },
  too_many: { en: "Limit of 20 active accesses. Revoke one first.", pt: "Limite de 20 acessos ativos. Revogue um antes.", es: "Límite de 20 accesos activos. Revoca uno primero.", hi: "20 सक्रिय एक्सेस की सीमा। पहले एक हटाएँ।" },
  unauthorized: { en: "Your connection code isn't matching — paste it again in Settings.", pt: "O código de conexão não confere — cole de novo em Configurações.", es: "El código de conexión no coincide — pégalo de nuevo en Ajustes.", hi: "कनेक्शन कोड मेल नहीं खा रहा।" },
};
// PLANO (2026-10-05): a recusa 402 diz qual plano libera a ação (functions/lib/deskTrava.js).
const NOME_PLANO = { basic: "Basic", medium: "Medium", pro: "Pro", ultra: "Ultra Pro", custom: "Personalizado" };
export const nomePlano = (k) => NOME_PLANO[k] || k || "";
const PLANO = (k) => ({ en: `Available on the ${nomePlano(k)} plan.`, pt: `Disponível no plano ${nomePlano(k)}.`, es: `Disponible en el plan ${nomePlano(k)}.`, hi: `${nomePlano(k)} प्लान में उपलब्ध।` });

/** Abre o pagamento do plano do Desk no Stripe (logado: o e-mail da assinatura fica travado no da conta). */
export async function assinarDesk(email, key, plan) {
  try {
    const r = await fetch("/api/desk-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, email, key, lang: lang() }) });
    const d = await r.json().catch(() => null);
    if (d?.ok && d.url) { window.location.href = d.url; return { ok: true }; }
    return { ok: false, erro: d?.error || `HTTP ${r.status}` };
  } catch (e) { return { ok: false, erro: String(e).slice(0, 80) }; }
}

const FALHOU = { en: "That didn't go through. Try again.", pt: "Não deu certo. Tente de novo.", es: "No funcionó. Inténtalo de nuevo.", hi: "यह नहीं हुआ। फिर कोशिश करें।" };
export const motivo = (d, http) => tx((d?.reason === "plan_required" ? PLANO(d.precisa) : null) || MOTIVO[d?.reason] || (http === 401 ? MOTIVO.unauthorized : null) || FALHOU);
